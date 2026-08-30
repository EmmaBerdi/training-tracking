package com.training.tracking.service;

import com.training.tracking.domain.PlannedSession;
import com.training.tracking.domain.RecurringRule;
import com.training.tracking.domain.RecurringRuleException;
import com.training.tracking.domain.RecurringRulePlan;
import com.training.tracking.domain.SessionType;
import com.training.tracking.dto.CreateRecurringRuleRequest;
import com.training.tracking.dto.RecurringRuleDefinition;
import com.training.tracking.dto.RecurringRuleDto;
import com.training.tracking.dto.RulePlanEntry;
import com.training.tracking.dto.UpdateRecurringRuleRequest;
import com.training.tracking.repository.PlannedSessionRepository;
import com.training.tracking.repository.RecurringRuleExceptionRepository;
import com.training.tracking.repository.RecurringRulePlanRepository;
import com.training.tracking.repository.RecurringRuleRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Recurring rules and the occurrences they generate.
 *
 * <p>Occurrences are materialized into {@code planned_session} the first time a date range is
 * requested, rather than expanded on every read: that way status, notes and logging work on a
 * series occurrence exactly as on a one-off session, and no read path needs to know about rules.
 *
 * <p>A rule answers two questions separately: its {@code pattern} decides *when* it generates a
 * date, its {@code planMode} decides *which* workout plan lands on that date — the same plan every
 * time, one per weekday, or the next step of a rotation.
 */
@Service
public class RecurringRuleService {

    private static final short ALL_WEEKDAYS = 127;
    private static final int MAX_INTERVAL_DAYS = 365;
    private static final int WEEKDAYS_IN_WEEK = 7;
    /** Matches the position CHECK on recurring_rule_plan; only there to bound a stray request. */
    private static final int MAX_ROTATION_PLANS = 12;
    /** Upper bound for "every remaining date"; LocalDate.MAX overflows a Postgres DATE. */
    private static final LocalDate FAR_FUTURE = LocalDate.of(9999, 12, 31);

    private final RecurringRuleRepository ruleRepository;
    private final RecurringRuleExceptionRepository exceptionRepository;
    private final RecurringRulePlanRepository planRepository;
    private final PlannedSessionRepository plannedSessionRepository;
    private final ScheduleRefs refs;

    public RecurringRuleService(RecurringRuleRepository ruleRepository,
                                RecurringRuleExceptionRepository exceptionRepository,
                                RecurringRulePlanRepository planRepository,
                                PlannedSessionRepository plannedSessionRepository,
                                ScheduleRefs refs) {
        this.ruleRepository = ruleRepository;
        this.exceptionRepository = exceptionRepository;
        this.planRepository = planRepository;
        this.plannedSessionRepository = plannedSessionRepository;
        this.refs = refs;
    }

    @Transactional
    public RecurringRuleDto create(Long userId, CreateRecurringRuleRequest request) {
        RecurringRule rule = new RecurringRule();
        rule.setUserId(userId);
        rule.setStartDate(ScheduleRefs.parseDate(request.startDate()));
        rule.setCreatedAt(Instant.now());
        applyDefinition(userId, rule, request);
        ruleRepository.saveAndFlush(rule);
        return toDto(rule, writePlans(userId, rule, request));
    }

    @Transactional(readOnly = true)
    public RecurringRuleDto find(Long userId, Long ruleId) {
        RecurringRule rule = findOwned(userId, ruleId);
        return toDto(rule, plansOf(rule));
    }

    /**
     * Redefines a series from {@code request.from()} onwards. Occurrences before that date keep the
     * old definition, so a rotation reordered today does not rewrite last month's calendar.
     */
    @Transactional
    public RecurringRuleDto update(Long userId, Long ruleId, UpdateRecurringRuleRequest request) {
        RecurringRule rule = findOwned(userId, ruleId);
        LocalDate from = request.from() == null || request.from().isBlank()
                ? LocalDate.now()
                : ScheduleRefs.parseDate(request.from());
        RecurringRule tail = splitAt(rule, from);
        applyDefinition(userId, tail, request);
        // The plans below are a freshly stated cycle, so it starts at its own first step.
        tail.setRotationOffset((short) 0);
        ruleRepository.saveAndFlush(tail);
        return toDto(tail, writePlans(userId, tail, request));
    }

    /**
     * Writes any occurrence in [from, to] that does not exist yet. Runs in its own transaction so a
     * concurrent request materializing the same window cannot poison the caller's read.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void materialize(Long userId, LocalDate from, LocalDate to) {
        List<RecurringRule> rules = ruleRepository.findActiveInRange(userId, from, to);
        List<PlannedSession> created = new ArrayList<>();
        for (RecurringRule rule : rules) {
            LocalDate windowStart = max(from, rule.getStartDate());
            LocalDate windowEnd = rule.getEndDate() == null ? to : min(to, rule.getEndDate());
            if (windowStart.isAfter(windowEnd)) {
                continue;
            }
            Set<LocalDate> taken = new HashSet<>(
                    exceptionRepository.findExcludedDates(rule.getId(), windowStart, windowEnd));
            plannedSessionRepository
                    .findAllByRule_IdAndOccurrenceDateBetween(rule.getId(), windowStart, windowEnd)
                    .forEach(s -> taken.add(s.getOccurrenceDate()));
            List<RecurringRulePlan> plans = plansOf(rule);
            for (LocalDate date : occurrences(rule, windowStart, windowEnd)) {
                if (taken.add(date)) {
                    created.add(newOccurrence(rule, plans, date));
                }
            }
        }
        if (!created.isEmpty()) {
            plannedSessionRepository.saveAllAndFlush(created);
        }
    }

    /** Keeps one occurrence out of the series for good; the row itself lives on as a one-off. */
    @Transactional
    public void detachOccurrence(PlannedSession occurrence) {
        excludeDate(occurrence);
        occurrence.setRule(null);
    }

    /** Deletes one occurrence and stops the series from generating that date again. */
    @Transactional
    public void deleteOccurrence(PlannedSession occurrence) {
        excludeDate(occurrence);
        plannedSessionRepository.delete(occurrence);
    }

    /** Moves this occurrence and every later one: the series is split and re-anchored. */
    @Transactional
    public void rescheduleSeries(PlannedSession occurrence, LocalDate newDate, LocalTime newTime) {
        LocalDate occurrenceDate = occurrence.getOccurrenceDate();
        RecurringRule tail = splitAt(occurrence.getRule(), occurrenceDate);
        tail.setScheduledTime(newTime);
        if (RecurringRule.PATTERN_WEEKLY.equals(tail.getPattern())) {
            tail.setWeekdays(moveWeekday(tail.getWeekdays(),
                    occurrenceDate.getDayOfWeek(), newDate.getDayOfWeek()));
        }
        // The offset splitAt computed belongs to this occurrence, and its new date is the tail's
        // first one, so a rotating series keeps this occurrence's plan when it moves.
        tail.setStartDate(newDate);
        if (tail.getEndDate() != null && tail.getEndDate().isBefore(newDate)) {
            tail.setEndDate(newDate);
        }
        ruleRepository.save(tail);
    }

    /** Changes activity, plan and note on this occurrence and every later one. */
    @Transactional
    public void updateSeries(PlannedSession occurrence, SessionType type, String dayKey, String notes) {
        RecurringRule tail = splitAt(occurrence.getRule(), occurrence.getOccurrenceDate());
        tail.setSessionType(type);
        tail.setNotes(notes);
        // One plan for every later occurrence is exactly what a fixed series is; reordering a
        // rotation instead of replacing it is a series edit (PUT /api/recurring-rules/{id}).
        tail.setPlanMode(RecurringRule.PLAN_FIXED);
        tail.setDayKey(dayKey);
        tail.setRotationOffset((short) 0);
        clearPlans(tail);
        ruleRepository.save(tail);
    }

    /**
     * Carries the plan of a missed occurrence over to the next date of the series: everything from
     * there on slides one cycle step back. The alternative — letting the missed slot burn its step,
     * so the following dates keep the plans they already showed — needs no work at all, which is
     * why only this direction has a method.
     */
    @Transactional
    public void shiftRotationAfter(PlannedSession occurrence) {
        RecurringRule rule = occurrence.getRule();
        if (rule == null || !RecurringRule.PLAN_ROTATION.equals(rule.getPlanMode())) {
            return;
        }
        List<RecurringRulePlan> plans = plansOf(rule);
        if (plans.size() < 2) {
            return;
        }
        LocalDate missed = occurrence.getOccurrenceDate();
        LocalDate next = nextOccurrenceAfter(rule, missed);
        if (next == null) {
            return;
        }
        int carried = rotationStep(rule, missed, plans.size());
        RecurringRule tail = splitAt(rule, next);
        tail.setRotationOffset((short) carried);
        ruleRepository.save(tail);
    }

    /** Ends the series just before this occurrence and drops every later planned occurrence. */
    @Transactional
    public void endSeriesAt(PlannedSession occurrence) {
        RecurringRule rule = occurrence.getRule();
        LocalDate from = occurrence.getOccurrenceDate();
        // Nobody takes over, so every half of the series stops before this date — including this
        // one, which is deleted outright if nothing of it predates the occurrence.
        yieldFrom(rule, from, null);
    }

    public long countBySessionTypeId(Long sessionTypeId) {
        return ruleRepository.countBySessionTypeId(sessionTypeId);
    }

    /**
     * Splits the series at this date and returns the part to mutate: a fresh rule covering that date
     * onwards, so occurrences already generated before it keep the old definition. When nothing
     * precedes the date there is nothing to preserve and the original rule is returned unchanged.
     */
    private RecurringRule splitAt(RecurringRule rule, LocalDate from) {
        dropPlannedFrom(rule, from);
        if (!from.isAfter(rule.getStartDate())) {
            // The whole rule is what gets redefined, so it is the half that takes over from here.
            yieldFrom(rule, from, rule);
            return rule;
        }

        List<RecurringRulePlan> plans = plansOf(rule);
        RecurringRule tail = new RecurringRule();
        tail.setUserId(rule.getUserId());
        tail.setSeriesId(rule.getSeriesId());
        tail.setSessionType(rule.getSessionType());
        tail.setDayKey(rule.getDayKey());
        tail.setScheduledTime(rule.getScheduledTime());
        tail.setNotes(rule.getNotes());
        tail.setPattern(rule.getPattern());
        tail.setWeekdays(rule.getWeekdays());
        tail.setIntervalDays(rule.getIntervalDays());
        tail.setPlanMode(rule.getPlanMode());
        // Where the cycle stands on `from`, so the new half continues it instead of restarting.
        tail.setRotationOffset(RecurringRule.PLAN_ROTATION.equals(rule.getPlanMode()) && !plans.isEmpty()
                ? (short) rotationStep(rule, from, plans.size())
                : (short) 0);
        tail.setStartDate(from);
        tail.setEndDate(endDateAfterSplit(rule.getEndDate(), from));
        tail.setCreatedAt(Instant.now());
        ruleRepository.saveAndFlush(tail);

        for (RecurringRulePlan plan : plans) {
            planRepository.save(new RecurringRulePlan(tail, plan.getPosition(), plan.getDayKey()));
        }

        yieldFrom(rule, from, tail);
        return tail;
    }

    /**
     * Hands every date from `from` onwards to `takingOver`: the halves of the series that still reach
     * into that stretch stop before it, and the ones that lie entirely inside it go. Without this a
     * series edited twice would have two halves generating the same dates — the calendar showing each
     * session twice — because an edit only ever knows about the half it was made on.
     *
     * @param takingOver the half that owns those dates from now on, or null when the series is giving
     *                   them up for good
     */
    private void yieldFrom(RecurringRule rule, LocalDate from, RecurringRule takingOver) {
        List<RecurringRule> members = ruleRepository.findSeriesMembersFrom(
                rule.getUserId(), rule.getSeriesId(), from);
        for (RecurringRule member : members) {
            if (takingOver != null && member.getId().equals(takingOver.getId())) {
                continue;
            }
            dropPlannedFrom(member, from);
            if (takingOver != null) {
                // Dates the user struck out stay struck out, so they move to the half taking over.
                moveExceptions(member, takingOver, from);
            }
            if (member.getStartDate().isBefore(from)) {
                // Only ever shortens: a half that already ended earlier must not be revived.
                member.setEndDate(earlierOf(member.getEndDate(), from.minusDays(1)));
                ruleRepository.save(member);
            } else {
                // Nothing of this half predates the takeover. Occurrences already logged keep their
                // row; the FK drops their rule_id.
                ruleRepository.delete(member);
            }
        }
    }

    private void moveExceptions(RecurringRule source, RecurringRule target, LocalDate from) {
        for (LocalDate date : exceptionRepository.findExcludedDates(source.getId(), from, FAR_FUTURE)) {
            exceptionRepository.delete(new RecurringRuleException(source, date));
            exceptionRepository.save(new RecurringRuleException(target, date));
        }
    }

    /**
     * The end date the new half of a split carries. A series can be split at a date past its own
     * end — editing a series from today, when an earlier split already ended this half — and a rule
     * that ends before it starts is not a rule at all, so such a half covers the split date alone
     * until the caller states an end of its own.
     */
    static LocalDate endDateAfterSplit(LocalDate end, LocalDate from) {
        return end != null && end.isBefore(from) ? from : end;
    }

    /** The end date of the old half after a split: whichever comes first, so it can only shrink. */
    static LocalDate earlierOf(LocalDate end, LocalDate lastDayBeforeSplit) {
        return end == null ? lastDayBeforeSplit : min(end, lastDayBeforeSplit);
    }

    /** Removes still-planned occurrences from `from` onwards; done and skipped ones stay as history. */
    private void dropPlannedFrom(RecurringRule rule, LocalDate from) {
        List<PlannedSession> stale = plannedSessionRepository
                .findAllByRule_IdAndOccurrenceDateGreaterThanEqual(rule.getId(), from).stream()
                .filter(s -> PlannedSession.STATUS_PLANNED.equals(s.getStatus()))
                .toList();
        if (!stale.isEmpty()) {
            plannedSessionRepository.deleteAllInBatch(stale);
        }
    }

    private void excludeDate(PlannedSession occurrence) {
        exceptionRepository.save(
                new RecurringRuleException(occurrence.getRule(), occurrence.getOccurrenceDate()));
    }

    private PlannedSession newOccurrence(RecurringRule rule, List<RecurringRulePlan> plans, LocalDate date) {
        PlannedSession session = new PlannedSession();
        session.setUserId(rule.getUserId());
        session.setScheduledDate(date);
        session.setScheduledTime(rule.getScheduledTime());
        session.setSessionType(rule.getSessionType());
        session.setDayKey(resolvePlan(rule, plans, date));
        session.setNotes(rule.getNotes());
        session.setStatus(PlannedSession.STATUS_PLANNED);
        session.setRule(rule);
        session.setOccurrenceDate(date);
        session.setCreatedAt(Instant.now());
        return session;
    }

    private RecurringRule findOwned(Long userId, Long ruleId) {
        return ruleRepository.findById(ruleId)
                .filter(r -> r.getUserId().equals(userId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "recurring rule not found"));
    }

    private List<RecurringRulePlan> plansOf(RecurringRule rule) {
        return RecurringRule.PLAN_FIXED.equals(rule.getPlanMode())
                ? List.of()
                : planRepository.findAllByIdRuleIdOrderByIdPositionAsc(rule.getId());
    }

    private void clearPlans(RecurringRule rule) {
        planRepository.deleteAllByIdRuleId(rule.getId());
        planRepository.flush();
    }

    /** Everything a definition carries except its start date, which create and update set themselves. */
    private void applyDefinition(Long userId, RecurringRule rule, RecurringRuleDefinition definition) {
        rule.setSessionType(refs.sessionType(userId, definition.sessionTypeId()));
        rule.setScheduledTime(ScheduleRefs.parseTime(definition.time()));
        rule.setNotes(definition.notes());
        rule.setEndDate(ScheduleRefs.parseOptionalDate(definition.endDate()));
        applyPattern(rule, definition.pattern(), definition.weekdays(), definition.intervalDays());
        rule.setPlanMode(planMode(definition, rule.getPattern()));
        rule.setDayKey(RecurringRule.PLAN_FIXED.equals(rule.getPlanMode())
                ? refs.dayKey(userId, definition.dayId())
                : null);
        if (rule.getEndDate() != null && rule.getEndDate().isBefore(rule.getStartDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "endDate must not be before startDate");
        }
    }

    /** Replaces the rule's plan rows with the ones the request states; fixed rules end up with none. */
    private List<RecurringRulePlan> writePlans(Long userId, RecurringRule rule,
                                                RecurringRuleDefinition definition) {
        clearPlans(rule);
        if (RecurringRule.PLAN_FIXED.equals(rule.getPlanMode())) {
            return List.of();
        }
        boolean byWeekday = RecurringRule.PLAN_WEEKDAY.equals(rule.getPlanMode());
        List<RecurringRulePlan> rows = new ArrayList<>();
        List<RulePlanEntry> entries = definition.plans();
        for (int i = 0; i < entries.size(); i++) {
            RulePlanEntry entry = entries.get(i);
            short position = byWeekday ? entry.position().shortValue() : (short) i;
            rows.add(new RecurringRulePlan(rule, position, refs.dayKey(userId, entry.dayId())));
        }
        return planRepository.saveAll(rows);
    }

    /** Validates the plan mode against the rhythm and the plans it was given. */
    private static String planMode(RecurringRuleDefinition definition, String pattern) {
        String mode = definition.planMode();
        if (mode == null || mode.isBlank() || RecurringRule.PLAN_FIXED.equals(mode)) {
            return RecurringRule.PLAN_FIXED;
        }
        boolean byWeekday = RecurringRule.PLAN_WEEKDAY.equals(mode);
        if (!byWeekday && !RecurringRule.PLAN_ROTATION.equals(mode)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "planMode must be fixed, weekday or rotation");
        }
        if (byWeekday && !RecurringRule.PATTERN_WEEKLY.equals(pattern)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "planMode weekday needs the weekly pattern");
        }
        List<RulePlanEntry> entries = definition.plans();
        if (entries == null || entries.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "planMode " + mode + " needs plans");
        }
        if (entries.size() > MAX_ROTATION_PLANS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "at most " + MAX_ROTATION_PLANS + " plans per rule");
        }
        Set<Integer> positions = new HashSet<>();
        for (RulePlanEntry entry : entries) {
            if (entry.dayId() == null || entry.dayId().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "every plan entry needs a dayId");
            }
            if (!byWeekday) {
                continue;
            }
            Integer position = entry.position();
            if (position == null || position < 0 || position >= WEEKDAYS_IN_WEEK) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "weekday plan positions run from 0 (Mo) to 6 (So)");
            }
            if (!positions.add(position)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "one plan per weekday at most");
            }
        }
        return mode;
    }

    private void applyPattern(RecurringRule rule, String pattern, Integer weekdays, Integer intervalDays) {
        if (RecurringRule.PATTERN_WEEKLY.equals(pattern)) {
            if (weekdays == null || weekdays < 1 || weekdays > ALL_WEEKDAYS) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "weekly pattern needs a weekdays bitmask between 1 and " + ALL_WEEKDAYS);
            }
            rule.setPattern(RecurringRule.PATTERN_WEEKLY);
            rule.setWeekdays(weekdays.shortValue());
            rule.setIntervalDays(null);
        } else if (RecurringRule.PATTERN_INTERVAL.equals(pattern)) {
            if (intervalDays == null || intervalDays < 1 || intervalDays > MAX_INTERVAL_DAYS) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "interval pattern needs intervalDays between 1 and " + MAX_INTERVAL_DAYS);
            }
            rule.setPattern(RecurringRule.PATTERN_INTERVAL);
            rule.setIntervalDays(intervalDays.shortValue());
            rule.setWeekdays(null);
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "pattern must be weekly or interval");
        }
    }

    /** The dates a rule falls on inside [from, to]; both bounds already clamped to the rule's window. */
    static List<LocalDate> occurrences(RecurringRule rule, LocalDate from, LocalDate to) {
        List<LocalDate> dates = new ArrayList<>();
        if (RecurringRule.PATTERN_WEEKLY.equals(rule.getPattern())) {
            short mask = rule.getWeekdays();
            for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
                if ((mask & weekdayBit(d.getDayOfWeek())) != 0) {
                    dates.add(d);
                }
            }
            return dates;
        }
        int step = rule.getIntervalDays();
        long gap = ChronoUnit.DAYS.between(rule.getStartDate(), from);
        long skipped = gap <= 0 ? 0 : (gap + step - 1) / step;
        for (LocalDate d = rule.getStartDate().plusDays(skipped * step); !d.isAfter(to); d = d.plusDays(step)) {
            dates.add(d);
        }
        return dates;
    }

    /** The plan a rule puts on `date`: its pinned one, the one for that weekday, or the cycle's step. */
    static String resolvePlan(RecurringRule rule, List<RecurringRulePlan> plans, LocalDate date) {
        if (RecurringRule.PLAN_WEEKDAY.equals(rule.getPlanMode())) {
            short weekday = (short) (date.getDayOfWeek().getValue() - 1);
            return plans.stream()
                    .filter(p -> p.getPosition() == weekday)
                    .map(RecurringRulePlan::getDayKey)
                    .findFirst()
                    .orElse(null);
        }
        if (RecurringRule.PLAN_ROTATION.equals(rule.getPlanMode()) && !plans.isEmpty()) {
            return plans.get(rotationStep(rule, date, plans.size())).getDayKey();
        }
        return rule.getDayKey();
    }

    /**
     * Which step of the cycle `date` lands on. A pure function of the rule and the date, so
     * re-materializing a window, or skipping an occurrence, never shifts the rest of the rotation.
     */
    static int rotationStep(RecurringRule rule, LocalDate date, int cycleLength) {
        return (int) Math.floorMod(rule.getRotationOffset() + slotIndex(rule, date), (long) cycleLength);
    }

    /** How many dates the rule generates strictly before `date`, counted from its start. */
    static long slotIndex(RecurringRule rule, LocalDate date) {
        if (!date.isAfter(rule.getStartDate())) {
            return 0;
        }
        long days = ChronoUnit.DAYS.between(rule.getStartDate(), date);
        if (RecurringRule.PATTERN_INTERVAL.equals(rule.getPattern())) {
            int step = rule.getIntervalDays();
            return (days + step - 1) / step;
        }
        int mask = rule.getWeekdays() & ALL_WEEKDAYS;
        long weeks = days / WEEKDAYS_IN_WEEK;
        long count = weeks * Integer.bitCount(mask);
        // At most six days are left over once the whole weeks are counted in one go.
        for (LocalDate d = rule.getStartDate().plusWeeks(weeks); d.isBefore(date); d = d.plusDays(1)) {
            if ((mask & weekdayBit(d.getDayOfWeek())) != 0) {
                count++;
            }
        }
        return count;
    }

    /** The rule's next date after `date`, or null when its window ends first. */
    static LocalDate nextOccurrenceAfter(RecurringRule rule, LocalDate date) {
        LocalDate end = rule.getEndDate();
        if (RecurringRule.PATTERN_INTERVAL.equals(rule.getPattern())) {
            LocalDate next = date.plusDays(rule.getIntervalDays());
            return end != null && next.isAfter(end) ? null : next;
        }
        int mask = rule.getWeekdays() & ALL_WEEKDAYS;
        for (int i = 1; i <= WEEKDAYS_IN_WEEK; i++) {
            LocalDate next = date.plusDays(i);
            if (end != null && next.isAfter(end)) {
                return null;
            }
            if ((mask & weekdayBit(next.getDayOfWeek())) != 0) {
                return next;
            }
        }
        return null;
    }

    /** Mo=1, Di=2, Mi=4, Do=8, Fr=16, Sa=32, So=64 — matches the mask the client sends. */
    static int weekdayBit(DayOfWeek day) {
        return 1 << (day.getValue() - 1);
    }

    static short moveWeekday(short mask, DayOfWeek from, DayOfWeek to) {
        return (short) ((mask & ~weekdayBit(from)) | weekdayBit(to));
    }

    private static LocalDate max(LocalDate a, LocalDate b) {
        return a.isAfter(b) ? a : b;
    }

    private static LocalDate min(LocalDate a, LocalDate b) {
        return a.isBefore(b) ? a : b;
    }

    private static RecurringRuleDto toDto(RecurringRule rule, List<RecurringRulePlan> plans) {
        return new RecurringRuleDto(
                rule.getId(),
                rule.getSessionType().getId(),
                rule.getDayKey(),
                rule.getScheduledTime() == null ? null : rule.getScheduledTime().toString(),
                rule.getNotes(),
                rule.getPattern(),
                rule.getWeekdays() == null ? null : (int) rule.getWeekdays(),
                rule.getIntervalDays() == null ? null : (int) rule.getIntervalDays(),
                rule.getStartDate().toString(),
                rule.getEndDate() == null ? null : rule.getEndDate().toString(),
                rule.getPlanMode(),
                plans.stream()
                        .map(p -> new RulePlanEntry((int) p.getPosition(), p.getDayKey()))
                        .toList());
    }
}

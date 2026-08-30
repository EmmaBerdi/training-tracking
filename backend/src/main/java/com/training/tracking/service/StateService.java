package com.training.tracking.service;

import com.training.tracking.domain.Block;
import com.training.tracking.domain.Day;
import com.training.tracking.domain.Exercise;
import com.training.tracking.domain.Session;
import com.training.tracking.domain.SessionValue;
import com.training.tracking.domain.SessionValueId;
import com.training.tracking.domain.SessionWarmup;
import com.training.tracking.domain.SessionWarmupId;
import com.training.tracking.domain.WarmupItem;
import com.training.tracking.dto.BlockDto;
import com.training.tracking.dto.DayDto;
import com.training.tracking.dto.ExerciseDto;
import com.training.tracking.dto.PlanDto;
import com.training.tracking.dto.SessionDto;
import com.training.tracking.dto.StateDto;
import com.training.tracking.repository.BlockRepository;
import com.training.tracking.repository.DayRepository;
import com.training.tracking.repository.ExerciseRepository;
import com.training.tracking.repository.SessionRepository;
import com.training.tracking.repository.SessionValueRepository;
import com.training.tracking.repository.SessionWarmupRepository;
import com.training.tracking.repository.WarmupItemRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The whole state (plan + logs) for one user is saved as one blob, mirroring the frontend's
 * single persist() call. saveState wipes and re-inserts that user's rows rather than diffing —
 * the data volume per user is small.
 *
 * <p>Logs reference their plan by {@code day_key} rather than a FK, so the history survives both
 * the wipe-and-reinsert and the plan itself being deleted.
 */
@Service
public class StateService {

    private static final Set<String> VALID_SIDES = Set.of("B", "L", "R");
    private static final int MAX_VALUE_LENGTH = 64;

    private final DayRepository dayRepository;
    private final BlockRepository blockRepository;
    private final ExerciseRepository exerciseRepository;
    private final WarmupItemRepository warmupItemRepository;
    private final SessionRepository sessionRepository;
    private final SessionWarmupRepository sessionWarmupRepository;
    private final SessionValueRepository sessionValueRepository;
    private final ExerciseImageService exerciseImageService;

    public StateService(DayRepository dayRepository,
                         BlockRepository blockRepository,
                         ExerciseRepository exerciseRepository,
                         WarmupItemRepository warmupItemRepository,
                         SessionRepository sessionRepository,
                         SessionWarmupRepository sessionWarmupRepository,
                         SessionValueRepository sessionValueRepository,
                         ExerciseImageService exerciseImageService) {
        this.dayRepository = dayRepository;
        this.blockRepository = blockRepository;
        this.exerciseRepository = exerciseRepository;
        this.warmupItemRepository = warmupItemRepository;
        this.sessionRepository = sessionRepository;
        this.sessionWarmupRepository = sessionWarmupRepository;
        this.sessionValueRepository = sessionValueRepository;
        this.exerciseImageService = exerciseImageService;
    }

    @Transactional(readOnly = true)
    public StateDto getState(Long userId) {
        List<String> warmup = warmupItemRepository.findAllByUserIdOrderByPosition(userId).stream()
                .map(WarmupItem::getText)
                .toList();
        List<Day> days = dayRepository.findAllByUserIdOrderByPosition(userId);
        List<Block> blocks = blockRepository.findAllByUserIdOrderByPosition(userId);
        List<Exercise> exercises = exerciseRepository.findAllByBlock_UserIdOrderByPosition(userId);

        Map<Long, List<ExerciseDto>> exercisesByBlock = new LinkedHashMap<>();
        Map<Long, String> clientIdByExerciseId = new LinkedHashMap<>();
        for (Exercise ex : exercises) {
            exercisesByBlock.computeIfAbsent(ex.getBlock().getId(), k -> new ArrayList<>()).add(toDto(ex));
            clientIdByExerciseId.put(ex.getId(), ex.getClientId());
        }

        Map<Long, List<BlockDto>> blocksByDay = new LinkedHashMap<>();
        for (Block b : blocks) {
            blocksByDay.computeIfAbsent(b.getDay().getId(), k -> new ArrayList<>())
                    .add(new BlockDto(b.getKind(), b.getName(),
                            exercisesByBlock.getOrDefault(b.getId(), List.of())));
        }

        List<DayDto> dayDtos = days.stream()
                .map(d -> new DayDto(d.getDayKey(), d.getShortLabel(), d.getSlot(), d.getTitle(),
                        blocksByDay.getOrDefault(d.getId(), List.of())))
                .toList();

        return new StateDto(new PlanDto(warmup, dayDtos), buildLogs(userId, clientIdByExerciseId));
    }

    private List<SessionDto> buildLogs(Long userId, Map<Long, String> clientIdByExerciseId) {
        List<Session> sessions = sessionRepository.findAllByUserId(userId);
        if (sessions.isEmpty()) {
            return List.of();
        }

        Map<Long, List<Integer>> warmupBySession = new LinkedHashMap<>();
        for (SessionWarmup sw : sessionWarmupRepository.findAllBySession_UserId(userId)) {
            warmupBySession.computeIfAbsent(sw.getId().getSessionId(), k -> new ArrayList<>())
                    .add(sw.getId().getPosition());
        }

        Map<Long, List<SessionValue>> valuesBySession = new LinkedHashMap<>();
        for (SessionValue sv : sessionValueRepository.findAllBySession_UserId(userId)) {
            valuesBySession.computeIfAbsent(sv.getId().getSessionId(), k -> new ArrayList<>()).add(sv);
        }

        List<SessionDto> result = new ArrayList<>();
        for (Session s : sessions) {
            result.add(new SessionDto(
                    s.getSessionDate().toString(),
                    s.getDayKey(),
                    valuesOf(valuesBySession.getOrDefault(s.getId(), List.of()), clientIdByExerciseId),
                    warmupFlags(warmupBySession.getOrDefault(s.getId(), List.of()))));
        }
        return result;
    }

    /** Row presence means checked, so the flag list is only as long as its last checked position. */
    private static List<Boolean> warmupFlags(List<Integer> checkedPositions) {
        int size = checkedPositions.stream().mapToInt(Integer::intValue).max().orElse(-1) + 1;
        List<Boolean> warm = new ArrayList<>(size);
        for (int i = 0; i < size; i++) {
            warm.add(false);
        }
        checkedPositions.forEach(pos -> warm.set(pos, true));
        return warm;
    }

    private static Map<String, Map<String, List<String>>> valuesOf(
            List<SessionValue> values, Map<Long, String> clientIdByExerciseId) {
        Map<String, Map<String, List<String>>> vals = new LinkedHashMap<>();
        for (SessionValue sv : values) {
            String clientId = clientIdByExerciseId.get(sv.getId().getExerciseId());
            if (clientId == null) {
                continue; // exercise no longer exists in the current plan
            }
            List<String> setValues = vals
                    .computeIfAbsent(clientId, k -> new LinkedHashMap<>())
                    .computeIfAbsent(sv.getId().getSide(), k -> new ArrayList<>());
            int idx = sv.getId().getSetIndex();
            while (setValues.size() <= idx) {
                setValues.add("");
            }
            setValues.set(idx, sv.getValue());
        }
        return vals;
    }

    private static ExerciseDto toDto(Exercise e) {
        return new ExerciseDto(e.getClientId(), e.getName(), e.getType(), e.isUni(),
                e.getSets(), e.getSetsL(), e.getSetsR(), e.getReps(), e.getNote(), e.getDescription(),
                e.getImageId() == null ? null : e.getImageId().toString());
    }

    @Transactional
    public void saveState(Long userId, StateDto state) {
        PlanDto plan = state.plan() == null ? new PlanDto(List.of(), List.of()) : state.plan();
        List<DayDto> dayDtos = plan.days() == null ? List.of() : plan.days();
        List<SessionDto> logDtos = state.logs() == null ? List.of() : state.logs();
        rejectAmbiguousKeys(dayDtos, logDtos);
        exerciseImageService.requireOwnership(userId, referencedImageIds(dayDtos));

        wipe(userId);

        warmupItemRepository.saveAllAndFlush(toWarmupItems(userId, plan.warmup()));

        List<Day> days = new ArrayList<>();
        for (int i = 0; i < dayDtos.size(); i++) {
            days.add(toDay(userId, dayDtos.get(i), i));
        }
        dayRepository.saveAllAndFlush(days);

        Map<String, Exercise> exerciseByClientId = saveBlocksAndExercises(userId, dayDtos, days);
        saveLogs(userId, logDtos, exerciseByClientId);

        // After the exercises are back in place, so the surviving references are visible to the sweep.
        exerciseImageService.collectOrphans(userId);
    }

    /** Every image the submitted plan points at, in one pass, so ownership costs a single query. */
    private static Set<UUID> referencedImageIds(List<DayDto> dayDtos) {
        Set<UUID> ids = new LinkedHashSet<>();
        for (DayDto day : dayDtos) {
            for (BlockDto block : nullToEmpty(day.blocks())) {
                for (ExerciseDto ex : nullToEmpty(block.ex())) {
                    if (ex.imageId() != null) {
                        ids.add(ExerciseImageService.parseId(ex.imageId()));
                    }
                }
            }
        }
        return ids;
    }

    /**
     * Clears this user's plan and logs, children before parents. The order is explicit rather than
     * delegated to ON DELETE CASCADE so it holds whatever created the schema.
     */
    private void wipe(Long userId) {
        sessionValueRepository.deleteAllByUserId(userId);
        sessionWarmupRepository.deleteAllByUserId(userId);
        sessionRepository.deleteAllInBatch(sessionRepository.findAllByUserId(userId));
        exerciseRepository.deleteAllInBatch(exerciseRepository.findAllByBlock_UserIdOrderByPosition(userId));
        blockRepository.deleteAllInBatch(blockRepository.findAllByUserIdOrderByPosition(userId));
        dayRepository.deleteAllInBatch(dayRepository.findAllByUserIdOrderByPosition(userId));
        warmupItemRepository.deleteAllInBatch(warmupItemRepository.findAllByUserIdOrderByPosition(userId));
    }

    /**
     * The client addresses plans and exercises by ids it generated itself, so a payload that reuses
     * one is ambiguous rather than merely invalid — reject it instead of silently keeping one of the
     * two and binding logged values to the wrong exercise.
     */
    private static void rejectAmbiguousKeys(List<DayDto> dayDtos, List<SessionDto> logDtos) {
        Set<String> dayIds = new HashSet<>();
        Set<String> exerciseIds = new HashSet<>();
        for (DayDto day : dayDtos) {
            if (!dayIds.add(day.id())) {
                throw badRequest("duplicate day id " + day.id());
            }
            for (BlockDto block : nullToEmpty(day.blocks())) {
                for (ExerciseDto ex : nullToEmpty(block.ex())) {
                    if (!exerciseIds.add(ex.id())) {
                        throw badRequest("duplicate exercise id " + ex.id());
                    }
                }
            }
        }
        Set<String> logKeys = new HashSet<>();
        for (SessionDto log : logDtos) {
            if (!logKeys.add(log.date() + "/" + log.dayId())) {
                throw badRequest("duplicate log for " + log.date() + " / " + log.dayId());
            }
        }
    }

    private Map<String, Exercise> saveBlocksAndExercises(Long userId, List<DayDto> dayDtos, List<Day> days) {
        Map<String, Day> dayByKey = new LinkedHashMap<>();
        days.forEach(d -> dayByKey.put(d.getDayKey(), d));

        List<Block> blocks = new ArrayList<>();
        List<List<ExerciseDto>> exercisesPerBlock = new ArrayList<>();
        for (DayDto d : dayDtos) {
            List<BlockDto> dayBlocks = nullToEmpty(d.blocks());
            for (int i = 0; i < dayBlocks.size(); i++) {
                BlockDto bDto = dayBlocks.get(i);
                Block block = new Block();
                block.setUserId(userId);
                block.setDay(dayByKey.get(d.id()));
                block.setKind(bDto.kind());
                block.setName(bDto.name());
                block.setPosition(i);
                blocks.add(block);
                exercisesPerBlock.add(nullToEmpty(bDto.ex()));
            }
        }
        blockRepository.saveAllAndFlush(blocks);

        List<Exercise> exercises = new ArrayList<>();
        for (int bi = 0; bi < blocks.size(); bi++) {
            List<ExerciseDto> exDtos = exercisesPerBlock.get(bi);
            for (int i = 0; i < exDtos.size(); i++) {
                exercises.add(toExercise(exDtos.get(i), blocks.get(bi), i));
            }
        }
        exerciseRepository.saveAllAndFlush(exercises);

        Map<String, Exercise> byClientId = new LinkedHashMap<>();
        exercises.forEach(ex -> byClientId.put(ex.getClientId(), ex));
        return byClientId;
    }

    private void saveLogs(Long userId, List<SessionDto> logDtos, Map<String, Exercise> exerciseByClientId) {
        List<Session> sessions = new ArrayList<>();
        for (SessionDto logDto : logDtos) {
            Session session = new Session();
            session.setUserId(userId);
            session.setSessionDate(ScheduleRefs.parseDate(logDto.date()));
            session.setDayKey(logDto.dayId());
            sessions.add(session);
        }
        sessionRepository.saveAllAndFlush(sessions);

        List<SessionWarmup> sessionWarmups = new ArrayList<>();
        List<SessionValue> sessionValues = new ArrayList<>();
        for (int i = 0; i < logDtos.size(); i++) {
            collectWarmups(logDtos.get(i), sessions.get(i), sessionWarmups);
            collectValues(logDtos.get(i), sessions.get(i), exerciseByClientId, sessionValues);
        }
        sessionWarmupRepository.saveAllAndFlush(sessionWarmups);
        sessionValueRepository.saveAllAndFlush(sessionValues);
    }

    private List<WarmupItem> toWarmupItems(Long userId, List<String> warmup) {
        List<String> texts = nullToEmpty(warmup);
        List<WarmupItem> items = new ArrayList<>();
        for (int i = 0; i < texts.size(); i++) {
            WarmupItem item = new WarmupItem();
            item.setUserId(userId);
            item.setPosition(i);
            item.setText(texts.get(i));
            items.add(item);
        }
        return items;
    }

    private Day toDay(Long userId, DayDto d, int position) {
        Day day = new Day();
        day.setUserId(userId);
        day.setDayKey(d.id());
        day.setShortLabel(d.shortLabel());
        day.setSlot(d.slot());
        day.setTitle(d.title());
        day.setPosition(position);
        return day;
    }

    private Exercise toExercise(ExerciseDto ex, Block block, int position) {
        Exercise entity = new Exercise();
        entity.setClientId(ex.id());
        entity.setBlock(block);
        entity.setName(ex.name());
        entity.setType(ex.type());
        entity.setUni(ex.uni());
        entity.setSets(ex.sets());
        entity.setSetsL(ex.setsL());
        entity.setSetsR(ex.setsR());
        entity.setReps(ex.reps());
        entity.setNote(ex.note());
        entity.setDescription(ex.desc());
        entity.setImageId(ex.imageId() == null ? null : ExerciseImageService.parseId(ex.imageId()));
        entity.setPosition(position);
        return entity;
    }

    private void collectWarmups(SessionDto logDto, Session session, List<SessionWarmup> out) {
        List<Boolean> warm = nullToEmpty(logDto.warm());
        for (int pos = 0; pos < warm.size(); pos++) {
            if (Boolean.TRUE.equals(warm.get(pos))) {
                SessionWarmup sw = new SessionWarmup();
                sw.setId(new SessionWarmupId(session.getId(), pos));
                sw.setSession(session);
                out.add(sw);
            }
        }
    }

    private void collectValues(SessionDto logDto, Session session, Map<String, Exercise> exerciseByClientId,
                                List<SessionValue> out) {
        Map<String, Map<String, List<String>>> vals = logDto.vals() == null ? Map.of() : logDto.vals();
        for (Map.Entry<String, Map<String, List<String>>> exEntry : vals.entrySet()) {
            Exercise exercise = exerciseByClientId.get(exEntry.getKey());
            if (exercise == null) {
                continue; // exercise no longer exists in the submitted plan
            }
            for (Map.Entry<String, List<String>> sideEntry : exEntry.getValue().entrySet()) {
                String side = sideEntry.getKey();
                if (!VALID_SIDES.contains(side)) {
                    throw badRequest("side must be one of " + VALID_SIDES + ", got " + side);
                }
                List<String> setValues = nullToEmpty(sideEntry.getValue());
                for (int setIdx = 0; setIdx < setValues.size(); setIdx++) {
                    String value = setValues.get(setIdx);
                    if (value == null || value.isEmpty()) {
                        continue;
                    }
                    if (value.length() > MAX_VALUE_LENGTH) {
                        throw badRequest("logged value must be at most " + MAX_VALUE_LENGTH + " characters");
                    }
                    SessionValue sv = new SessionValue();
                    sv.setId(new SessionValueId(session.getId(), exercise.getId(), side, setIdx));
                    sv.setSession(session);
                    sv.setExercise(exercise);
                    sv.setValue(value);
                    out.add(sv);
                }
            }
        }
    }

    private static <T> List<T> nullToEmpty(List<T> list) {
        return list == null ? List.of() : list;
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}

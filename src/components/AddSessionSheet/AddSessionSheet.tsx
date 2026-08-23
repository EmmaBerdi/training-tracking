import { useState } from 'react';
import type {
  Day,
  NewRecurringRule,
  PlanMode,
  RecurrencePattern,
  RecurringRule,
  SessionType,
} from '../../types';
import { defaultSessionTypeColor, sessionTypeAccent } from '../../utils/cssVar';
import { WEEKDAY_SHORT, weekdayBit } from '../../utils/date';
import styles from './AddSessionSheet.module.scss';

/** "Einmalig" is not a rule at all — it creates a single planned session. */
type Repeat = 'once' | RecurrencePattern;

interface AddSessionSheetProps {
  date: string;
  types: SessionType[];
  days: Day[];
  /** Set to edit an existing series instead of creating something: prefills, and drops "Einmalig". */
  rule?: RecurringRule;
  onAddType: (input: {
    label: string;
    color?: string;
    icon?: string;
  }) => Promise<SessionType | null>;
  onDeleteType: (id: number) => Promise<boolean>;
  onSubmit?: (input: {
    date: string;
    time?: string;
    sessionTypeId: number;
    dayId?: string;
    notes?: string;
  }) => void;
  /** In edit mode `startDate` is the date the new definition applies from. */
  onSubmitRule: (input: NewRecurringRule) => void;
}

const REPEAT_LABEL: Record<Repeat, string> = {
  once: 'Einmalig',
  weekly: 'Wöchentlich',
  interval: 'Alle X Tage',
};

const REPEATS = Object.keys(REPEAT_LABEL) as Repeat[];

const PLAN_MODE_LABEL: Record<PlanMode, string> = {
  fixed: 'Immer derselbe',
  weekday: 'Pro Wochentag',
  rotation: 'Rotation',
};

const PLAN_MODES = Object.keys(PLAN_MODE_LABEL) as PlanMode[];

const DEFAULT_INTERVAL_DAYS = 3;

/** The weekdays of a mask, in Mo…So order. */
function selectedWeekdays(mask: number): number[] {
  return WEEKDAY_SHORT.map((_, index) => index).filter((index) => mask & (1 << index));
}

export function AddSessionSheet({
  date,
  types,
  days,
  rule,
  onAddType,
  onDeleteType,
  onSubmit,
  onSubmitRule,
}: AddSessionSheetProps) {
  const editing = rule != null;
  const [selectedDate, setSelectedDate] = useState(date);
  const [time, setTime] = useState(rule?.time ?? '');
  const [sessionTypeId, setSessionTypeId] = useState<number | null>(
    rule?.sessionTypeId ?? types[0]?.id ?? null,
  );
  const [notes, setNotes] = useState(rule?.notes ?? '');
  const [repeat, setRepeat] = useState<Repeat>(rule?.pattern ?? 'once');
  // Starts on the weekday of the tapped date, which is what "jeden Montag" means from a Monday.
  const [weekdays, setWeekdays] = useState(rule?.weekdays ?? weekdayBit(date));
  const [intervalDays, setIntervalDays] = useState(rule?.intervalDays ?? DEFAULT_INTERVAL_DAYS);
  const [endDate, setEndDate] = useState(rule?.endDate ?? '');
  const [planMode, setPlanMode] = useState<PlanMode>(rule?.planMode ?? 'fixed');
  const [dayId, setDayId] = useState(rule?.dayId ?? '');
  // A plan the series still points at can have been deleted since; those slots start out empty
  // rather than sending an id the backend would reject.
  const known = (dayId: string) => days.some((d) => d.id === dayId);
  /** Plan per weekday index, for planMode 'weekday'; a weekday left out gets no workout. */
  const [weekdayPlans, setWeekdayPlans] = useState<Record<number, string>>(() =>
    rule?.planMode === 'weekday'
      ? Object.fromEntries(
          rule.plans.filter((p) => known(p.dayId)).map((p) => [p.position, p.dayId]),
        )
      : {},
  );
  /** The cycle, in order, for planMode 'rotation'. */
  const [rotation, setRotation] = useState<string[]>(() =>
    rule?.planMode === 'rotation' ? rule.plans.map((p) => p.dayId).filter(known) : [],
  );
  const [newTypeOpen, setNewTypeOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState(defaultSessionTypeColor);
  const [newIcon, setNewIcon] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedType = types.find((t) => t.id === sessionTypeId);
  const weekdayList = selectedWeekdays(weekdays);
  const assignedWeekdays = weekdayList.filter((index) => weekdayPlans[index]);

  const toggleWeekday = (index: number) => setWeekdays((mask) => mask ^ (1 << index));

  const changeRepeat = (next: Repeat) => {
    setRepeat(next);
    // Only a weekly rhythm has weekdays to hang a plan on.
    if (next !== 'weekly' && planMode === 'weekday') setPlanMode('fixed');
  };

  const setRotationAt = (index: number, value: string) =>
    setRotation((prev) => prev.map((id, i) => (i === index ? value : id)));

  const moveRotation = (index: number, delta: number) =>
    setRotation((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(index + delta, 0, moved);
      return next;
    });

  const handleCreateType = async () => {
    const label = newLabel.trim();
    if (!label) return;
    setSaving(true);
    const created = await onAddType({ label, color: newColor, icon: newIcon.trim() || undefined });
    setSaving(false);
    if (created) {
      setSessionTypeId(created.id);
      setNewTypeOpen(false);
      setNewLabel('');
      setNewIcon('');
    }
  };

  const handleDeleteType = async () => {
    if (!selectedType?.custom) return;
    if (!window.confirm(`Kategorie "${selectedType.label}" löschen?`)) return;
    setSaving(true);
    const ok = await onDeleteType(selectedType.id);
    setSaving(false);
    if (ok) setSessionTypeId(types.find((t) => t.id !== selectedType.id)?.id ?? null);
  };

  const planIncomplete =
    repeat !== 'once' &&
    ((planMode === 'weekday' && assignedWeekdays.length === 0) ||
      // One plan is not a rotation; that is what "Immer derselbe" is for.
      (planMode === 'rotation' && rotation.filter(Boolean).length < 2));

  const incomplete =
    sessionTypeId == null ||
    (repeat === 'weekly' && weekdays === 0) ||
    (repeat === 'interval' && intervalDays < 1) ||
    planIncomplete;

  /** How the chosen plan mode travels to the backend; 'fixed' keeps using the single `dayId`. */
  const planPayload = () => {
    if (planMode === 'weekday') {
      return {
        planMode,
        plans: assignedWeekdays.map((index) => ({ position: index, dayId: weekdayPlans[index] })),
      };
    }
    if (planMode === 'rotation') {
      return {
        planMode,
        plans: rotation.filter(Boolean).map((id, index) => ({ position: index, dayId: id })),
      };
    }
    return { planMode, plans: [], dayId: dayId || undefined };
  };

  const handleSubmit = () => {
    if (sessionTypeId == null || incomplete) return;
    const shared = {
      sessionTypeId,
      time: time || undefined,
      notes: notes.trim() || undefined,
    };
    if (repeat === 'once') {
      onSubmit?.({ date: selectedDate, dayId: dayId || undefined, ...shared });
      return;
    }
    onSubmitRule({
      ...shared,
      ...planPayload(),
      pattern: repeat,
      weekdays: repeat === 'weekly' ? weekdays : undefined,
      intervalDays: repeat === 'interval' ? intervalDays : undefined,
      startDate: selectedDate,
      endDate: endDate || undefined,
    });
  };

  return (
    <>
      <h2 className={styles.title}>{editing ? 'Serie bearbeiten' : 'Termin planen'}</h2>
      <div className={styles.sub}>
        {editing
          ? 'Gilt ab dem gewählten Datum — frühere Termine bleiben, wie sie waren.'
          : 'Aktivität auswählen und einen Tag festlegen.'}
      </div>

      <div className={styles.row}>
        <div className={`${styles.field} ${styles.grow}`}>
          <label htmlFor="session-date">{repeat === 'once' ? 'Datum' : 'Ab'}</label>
          <input
            id="session-date"
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              if (e.target.value && !editing) setWeekdays(weekdayBit(e.target.value));
            }}
          />
        </div>
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor="session-time">Zeit (optional)</label>
            {time && (
              <button
                type="button"
                className={styles.clearButton}
                aria-label="Zeit löschen"
                onClick={() => setTime('')}
              >
                ×
              </button>
            )}
          </div>
          <input
            id="session-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label>Art</label>
        <div className={styles.chips}>
          {types.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`${styles.chip} ${t.id === sessionTypeId ? styles.chipOn : ''}`}
              style={sessionTypeAccent(t)}
              onClick={() => setSessionTypeId(t.id)}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.chip} ${styles.chipAdd}`}
            onClick={() => setNewTypeOpen((o) => !o)}
          >
            + Neu
          </button>
        </div>
        {/* Only user-created types can go; the seeded defaults are shared by every account. */}
        {selectedType?.custom && (
          <button
            type="button"
            className={styles.deleteType}
            disabled={saving}
            onClick={handleDeleteType}
          >
            „{selectedType.label}“ löschen
          </button>
        )}
      </div>

      {newTypeOpen && (
        <div className={styles.newType}>
          <div className={styles.field}>
            <label htmlFor="type-label">Bezeichnung</label>
            <input
              id="type-label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="z. B. Klettern"
            />
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="type-color">Farbe</label>
              <input
                id="type-color"
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
              />
            </div>
            <div className={`${styles.field} ${styles.grow}`}>
              <label htmlFor="type-icon">Icon (optional)</label>
              <input id="type-icon" value={newIcon} onChange={(e) => setNewIcon(e.target.value)} />
            </div>
          </div>
          <button
            type="button"
            className={styles.ghost}
            onClick={handleCreateType}
            disabled={!newLabel.trim() || saving}
          >
            Kategorie anlegen
          </button>
        </div>
      )}

      <div className={styles.field}>
        <label>{editing ? 'Rhythmus' : 'Wiederholung'}</label>
        <div className={styles.chips}>
          {/* An existing series is a series; turning it into a single date is a delete, not an edit. */}
          {REPEATS.filter((r) => !editing || r !== 'once').map((r) => (
            <button
              key={r}
              type="button"
              className={`${styles.segment} ${r === repeat ? styles.segmentOn : ''}`}
              onClick={() => changeRepeat(r)}
            >
              {REPEAT_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {repeat === 'weekly' && (
        <div className={styles.field}>
          <label>An diesen Tagen</label>
          <div className={styles.weekdayGrid}>
            {WEEKDAY_SHORT.map((label, index) => (
              <button
                key={label}
                type="button"
                className={`${styles.weekday} ${weekdays & (1 << index) ? styles.weekdayOn : ''}`}
                aria-pressed={(weekdays & (1 << index)) !== 0}
                onClick={() => toggleWeekday(index)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {repeat === 'interval' && (
        <div className={styles.field}>
          <label htmlFor="session-interval">Abstand in Tagen</label>
          <input
            id="session-interval"
            type="number"
            min={1}
            max={365}
            value={intervalDays}
            onChange={(e) => setIntervalDays(Number(e.target.value))}
          />
        </div>
      )}

      {days.length > 0 && (
        <div className={styles.field}>
          <label>Workout-Plan (optional)</label>
          {/* A one-off has a single date, so there is nothing to vary the plan across. */}
          {repeat !== 'once' && (
            <div className={styles.chips}>
              {PLAN_MODES.filter((m) => m !== 'weekday' || repeat === 'weekly').map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`${styles.segment} ${m === planMode ? styles.segmentOn : ''}`}
                  onClick={() => setPlanMode(m)}
                >
                  {PLAN_MODE_LABEL[m]}
                </button>
              ))}
            </div>
          )}

          {(repeat === 'once' || planMode === 'fixed') && (
            <select id="session-plan" value={dayId} onChange={(e) => setDayId(e.target.value)}>
              <option value="">— kein Workout —</option>
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          )}

          {repeat !== 'once' && planMode === 'weekday' && (
            <>
              {weekdayList.map((index) => (
                <div key={index} className={styles.planRow}>
                  <span className={styles.planKey}>{WEEKDAY_SHORT[index]}</span>
                  <select
                    value={weekdayPlans[index] ?? ''}
                    onChange={(e) =>
                      setWeekdayPlans((prev) => ({ ...prev, [index]: e.target.value }))
                    }
                  >
                    <option value="">— kein Workout —</option>
                    {days.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <div className={styles.hint}>
                {weekdayList.length === 0
                  ? 'Erst Wochentage wählen, dann bekommt jeder seinen Plan.'
                  : 'Ein Wochentag ohne Plan bekommt trotzdem seinen Termin, nur ohne Workout.'}
              </div>
            </>
          )}

          {repeat !== 'once' && planMode === 'rotation' && (
            <>
              {rotation.map((id, index) => (
                <div key={index} className={styles.planRow}>
                  <span className={styles.planKey}>{index + 1}.</span>
                  <select value={id} onChange={(e) => setRotationAt(index, e.target.value)}>
                    {days.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={styles.planMove}
                    disabled={index === 0}
                    aria-label="Nach oben"
                    onClick={() => moveRotation(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.planMove}
                    disabled={index === rotation.length - 1}
                    aria-label="Nach unten"
                    onClick={() => moveRotation(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={styles.planMove}
                    aria-label="Entfernen"
                    onClick={() => setRotation((prev) => prev.filter((_, i) => i !== index))}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={styles.addPlan}
                onClick={() => setRotation((prev) => [...prev, days[0].id])}
              >
                + Plan anhängen
              </button>
              <div className={styles.hint}>
                {rotation.length < 2
                  ? 'Mindestens zwei Pläne — jeder Termin nimmt den nächsten aus der Liste.'
                  : `Jeder Termin nimmt den nächsten Plan; nach ${rotation.length} Terminen beginnt die Rotation von vorn.`}
              </div>
            </>
          )}
        </div>
      )}

      {repeat !== 'once' && (
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor="session-end">Ende (optional)</label>
            {endDate && (
              <button
                type="button"
                className={styles.clearButton}
                aria-label="Enddatum löschen"
                onClick={() => setEndDate('')}
              >
                ×
              </button>
            )}
          </div>
          <input
            id="session-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      )}

      <div className={styles.field}>
        <label htmlFor="session-notes">Notiz (optional)</label>
        <textarea
          id="session-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <button type="button" className={styles.solid} onClick={handleSubmit} disabled={incomplete}>
        {editing ? 'Serie speichern' : repeat === 'once' ? 'Termin anlegen' : 'Serie anlegen'}
      </button>
    </>
  );
}

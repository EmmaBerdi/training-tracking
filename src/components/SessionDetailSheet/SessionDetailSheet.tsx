import { useState } from 'react';
import type {
  Day,
  EditScope,
  PlannedSession,
  PlannedSessionStatus,
  Rotation,
  SessionType,
} from '../../types';
import { sessionTypeAccent } from '../../utils/cssVar';
import { plansForType } from '../../state/planOps';
import styles from './SessionDetailSheet.module.scss';

interface SessionDetailSheetProps {
  session: PlannedSession;
  type: SessionType | undefined;
  day: Day | undefined;
  days: Day[];
  onReschedule: (date: string, time: string | undefined, scope: EditScope) => void;
  onChangePlan: (dayId: string | undefined, scope: EditScope) => void;
  onMarkStatus: (status: PlannedSessionStatus, rotation?: Rotation) => void;
  onDelete: (scope: EditScope, rotation?: Rotation) => void;
  onStartWorkout: () => void;
  /** Absent for a one-off: there is no series to edit. */
  onEditSeries?: () => void;
}

const STATUS_LABEL: Record<PlannedSessionStatus, string> = {
  planned: 'Geplant',
  done: 'Erledigt',
  skipped: 'Übersprungen',
};

/**
 * An edit that needs a question answered before it runs: which occurrences it applies to, and — for
 * a rotating series losing a date — what happens to the plan that date was going to carry.
 */
type Pending =
  | { action: 'move' | 'plan' | 'delete'; ask: 'scope' }
  | { action: 'delete' | 'skip'; ask: 'rotation' };

const SCOPE_PROMPT: Record<'move' | 'plan' | 'delete', string> = {
  move: 'Diesen Termin verschieben oder die ganze Serie ab hier?',
  plan: 'Plan nur für diesen Termin ändern oder ab hier für alle?',
  delete: 'Diesen Termin löschen oder die Serie ab hier beenden?',
};

const ROTATION_PROMPT = 'Der Plan dieses Termins — verfallen lassen oder beim nächsten nachholen?';

export function SessionDetailSheet({
  session,
  type,
  day,
  days,
  onReschedule,
  onChangePlan,
  onMarkStatus,
  onDelete,
  onStartWorkout,
  onEditSeries,
}: SessionDetailSheetProps) {
  const [date, setDate] = useState(session.date);
  const [time, setTime] = useState(session.time ?? '');
  const [dayId, setDayId] = useState(session.dayId ?? '');
  const [pending, setPending] = useState<Pending | null>(null);

  // The session's own type decides which plans fit; the one it carries now stays pickable.
  const planOptions = plansForType(days, session.sessionTypeId, [session.dayId ?? '']);
  const recurring = session.ruleId != null;
  const rotating = recurring && session.rotating === true;

  const run = (action: 'move' | 'plan' | 'delete', scope: EditScope) => {
    setPending(null);
    if (action === 'move') onReschedule(date, time || undefined, scope);
    if (action === 'plan') onChangePlan(dayId || undefined, scope);
    // Dropping one date of a rotation asks what becomes of its plan first.
    if (action === 'delete') {
      if (scope === 'one' && rotating) {
        setPending({ action: 'delete', ask: 'rotation' });
        return;
      }
      onDelete(scope);
    }
  };

  const runRotation = (action: 'delete' | 'skip', rotation: Rotation) => {
    setPending(null);
    if (action === 'delete') onDelete('one', rotation);
    else onMarkStatus('skipped', rotation);
  };

  /** A one-off never asks; a series asks which occurrences an edit means. */
  const request = (action: 'move' | 'plan' | 'delete') => {
    if (!recurring) {
      if (action === 'delete' && !window.confirm('Diesen Termin löschen?')) return;
      run(action, 'one');
      return;
    }
    setPending({ action, ask: 'scope' });
  };

  /** Skipping only needs a question when the missed plan could move to the next date. */
  const requestSkip = () => {
    if (!rotating) {
      onMarkStatus('skipped');
      return;
    }
    setPending({ action: 'skip', ask: 'rotation' });
  };

  const movable = date !== session.date || (time || undefined) !== session.time;
  const planChanged = (dayId || undefined) !== session.dayId;

  return (
    <>
      <h2 className={styles.title} style={sessionTypeAccent(type)}>
        <span className={styles.dot} />
        {type?.label ?? 'Unbekannt'}
      </h2>
      <div className={styles.sub}>
        {STATUS_LABEL[session.status]}
        {recurring && ' · Teil einer Serie'}
        {rotating && ' mit Plan-Rotation'}
      </div>

      {session.notes && <div className={styles.notes}>{session.notes}</div>}

      {day && (
        <button type="button" className={styles.ghost} onClick={onStartWorkout}>
          {day.title} — Training starten
        </button>
      )}

      {pending?.ask === 'scope' && (
        <div className={styles.scope}>
          <div className={styles.scopeText}>{SCOPE_PROMPT[pending.action]}</div>
          <button
            type="button"
            className={styles.rowButton}
            onClick={() => run(pending.action, 'one')}
          >
            Nur dieser Termin
          </button>
          <button
            type="button"
            className={styles.rowButton}
            onClick={() => run(pending.action, 'future')}
          >
            Alle künftigen Termine
          </button>
          <button type="button" className={styles.ghost} onClick={() => setPending(null)}>
            Abbrechen
          </button>
        </div>
      )}

      {pending?.ask === 'rotation' && (
        <div className={styles.scope}>
          <div className={styles.scopeText}>{ROTATION_PROMPT}</div>
          <button
            type="button"
            className={styles.rowButton}
            onClick={() => runRotation(pending.action, 'hold')}
          >
            Verfallen lassen
          </button>
          <button
            type="button"
            className={styles.rowButton}
            onClick={() => runRotation(pending.action, 'shift')}
          >
            Nachholen — alle folgenden verschieben
          </button>
          <button type="button" className={styles.ghost} onClick={() => setPending(null)}>
            Abbrechen
          </button>
        </div>
      )}

      <div className={styles.row}>
        <div className={styles.field}>
          <label>Datum</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label>Zeit</label>
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
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <button
        type="button"
        className={styles.ghost}
        onClick={() => request('move')}
        disabled={!movable}
      >
        Verschieben
      </button>

      {planOptions.length > 0 && (
        <>
          <div className={styles.field}>
            <label>Workout-Plan</label>
            <select value={dayId} onChange={(e) => setDayId(e.target.value)}>
              <option value="">— kein Workout —</option>
              {planOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className={styles.ghost}
            onClick={() => request('plan')}
            disabled={!planChanged}
          >
            Plan übernehmen
          </button>
        </>
      )}

      <div className={styles.row}>
        <button type="button" className={styles.rowButton} onClick={() => onMarkStatus('done')}>
          Erledigt markieren
        </button>
        <button type="button" className={styles.rowButton} onClick={requestSkip}>
          Überspringen{rotating ? ' …' : ''}
        </button>
      </div>

      {recurring && onEditSeries && (
        <button type="button" className={styles.ghost} onClick={onEditSeries}>
          Serie bearbeiten — Rhythmus und Pläne
        </button>
      )}

      <button type="button" className={styles.danger} onClick={() => request('delete')}>
        {recurring ? 'Löschen …' : 'Löschen'}
      </button>
    </>
  );
}

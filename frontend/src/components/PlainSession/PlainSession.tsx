import type { PlannedSession, PlannedSessionStatus, SessionType } from '../../types';
import { sessionTypeAccent } from '../../utils/cssVar';
import { formatDayLabel, formatWeekday } from '../../utils/date';
import styles from './PlainSession.module.scss';

interface PlainSessionProps {
  session: PlannedSession;
  type: SessionType | undefined;
  onMarkStatus: (status: PlannedSessionStatus) => void;
  onAttachPlan: () => void;
  /** False when the account has no plans yet — nothing to attach. */
  canAttachPlan: boolean;
}

const STATUS_LABEL: Record<PlannedSessionStatus, string> = {
  planned: 'Geplant',
  done: 'Erledigt',
  skipped: 'Übersprungen',
};

/**
 * A scheduled activity without a workout plan — a run, a bouldering session. There is nothing to
 * log set by set, but it still happened, so it gets its day and its done/skipped switch.
 */
export function PlainSession({
  session,
  type,
  onMarkStatus,
  onAttachPlan,
  canAttachPlan,
}: PlainSessionProps) {
  return (
    <section className={styles.card} style={sessionTypeAccent(type)}>
      <div className={styles.head}>
        <span className={styles.dot} />
        <span className={styles.title}>{type?.label ?? 'Termin'}</span>
        {session.ruleId != null && <span className={styles.repeat}>↻</span>}
      </div>

      <div className={styles.meta}>
        {formatWeekday(session.date)}, {formatDayLabel(session.date)}
        {session.time && ` · ${session.time.slice(0, 5)}`}
        {` · ${STATUS_LABEL[session.status]}`}
      </div>

      {session.notes && <div className={styles.notes}>{session.notes}</div>}

      <div className={styles.row}>
        <button
          type="button"
          className={styles.rowButton}
          onClick={() => onMarkStatus(session.status === 'done' ? 'planned' : 'done')}
        >
          {session.status === 'done' ? 'Nicht erledigt' : 'Erledigt markieren'}
        </button>
        <button
          type="button"
          className={styles.rowButton}
          onClick={() => onMarkStatus(session.status === 'skipped' ? 'planned' : 'skipped')}
        >
          {session.status === 'skipped' ? 'Nicht übersprungen' : 'Überspringen'}
        </button>
      </div>

      {canAttachPlan && (
        <button type="button" className={styles.ghost} onClick={onAttachPlan}>
          Workout-Plan zuordnen
        </button>
      )}
    </section>
  );
}

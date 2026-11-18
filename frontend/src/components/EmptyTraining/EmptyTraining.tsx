import styles from './EmptyTraining.module.scss';

interface EmptyTrainingProps {
  /** Nothing planned this month vs. no plans in the account at all — different next step. */
  hasPlans: boolean;
  monthLabel: string;
  onOpenCalendar: () => void;
  onAddPlan: () => void;
}

export function EmptyTraining({
  hasPlans,
  monthLabel,
  onOpenCalendar,
  onAddPlan,
}: EmptyTrainingProps) {
  return (
    <div className={styles.empty}>
      <div className={styles.icon} aria-hidden="true">
        ⌇
      </div>
      <h2 className={styles.title}>
        {hasPlans ? `Nichts geplant im ${monthLabel}` : 'Noch kein Training angelegt'}
      </h2>
      <p className={styles.text}>
        {hasPlans
          ? 'Im Kalender einen Tag antippen, um ein Training einzuplanen — danach erscheint es hier.'
          : 'Plane im Kalender, was du trainieren willst. Für Kraft-Trainings kannst du zusätzlich einen Plan mit Übungen anlegen.'}
      </p>
      <button type="button" className={styles.solid} onClick={onOpenCalendar}>
        Zum Kalender
      </button>
      <button type="button" className={styles.ghost} onClick={onAddPlan}>
        Plan mit Übungen anlegen
      </button>
    </div>
  );
}

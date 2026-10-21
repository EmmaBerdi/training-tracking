import { useState } from 'react';
import type { Day, SessionType } from '../../types';
import type { DayInput } from '../../hooks/useTrainingState';
import { sessionTypeAccent } from '../../utils/cssVar';
import styles from './PlanSheet.module.scss';

interface PlanSheetProps {
  /** The plan being edited, or undefined when creating a new one. */
  day?: Day;
  types: SessionType[];
  onSubmit: (input: DayInput) => void;
  onDelete?: () => void;
}

export function PlanSheet({ day, types, onSubmit, onDelete }: PlanSheetProps) {
  const [title, setTitle] = useState(day?.title ?? '');
  const [short, setShort] = useState(day?.short ?? '');
  // No preselection for a new plan: which activity it belongs to is the one thing worth deciding.
  const [sessionTypeId, setSessionTypeId] = useState<number | null>(day?.sessionTypeId ?? null);

  const complete = Boolean(title.trim() && short.trim() && sessionTypeId != null);

  const handleSubmit = () => {
    if (!complete || sessionTypeId == null) return;
    onSubmit({ title: title.trim(), short: short.trim(), sessionTypeId });
  };

  return (
    <>
      <h2 className={styles.title}>{day ? 'Plan bearbeiten' : 'Neuer Plan'}</h2>
      <div className={styles.sub}>
        {day
          ? 'Titel, Kürzel und Aktivität dieses Workout-Plans ändern.'
          : 'Einen neuen Workout-Plan anlegen — er gehört zu einer Aktivität, z. B. Kraft.'}
      </div>

      <div className={styles.field}>
        <label htmlFor="plan-title">Titel</label>
        <input
          id="plan-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="z. B. Gym-Workout"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="plan-short">Kürzel (Tab-Anzeige)</label>
        <input
          id="plan-short"
          value={short}
          onChange={(e) => setShort(e.target.value)}
          placeholder="z. B. Gym"
        />
      </div>

      <div className={styles.field}>
        <label>Aktivität</label>
        <div className={styles.chips}>
          {types.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`${styles.chip} ${t.id === sessionTypeId ? styles.chipOn : ''}`}
              style={sessionTypeAccent(t)}
              aria-pressed={t.id === sessionTypeId}
              onClick={() => setSessionTypeId(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className={styles.solid} onClick={handleSubmit} disabled={!complete}>
        {day ? 'Änderungen speichern' : 'Plan anlegen'}
      </button>

      {onDelete && day && (
        <button
          type="button"
          className={styles.danger}
          onClick={() => {
            if (
              window.confirm(
                `Plan "${day.title}" mit allen Übungen löschen? Bereits protokollierte Einheiten bleiben im Verlauf.`,
              )
            ) {
              onDelete();
            }
          }}
        >
          Plan löschen
        </button>
      )}
    </>
  );
}

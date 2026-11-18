import type { Day, WorkoutLog } from '../../types';
import { SIDE_LABEL } from '../../data/constants';
import { dayExercises } from '../../state/planOps';
import { bestChange, exerciseSeries, exerciseSides, latestIsRecord } from '../../state/stats';
import { formatDelta, formatValue } from '../../utils/format';
import { Sparkline } from '../Sparkline/Sparkline';
import styles from './PlanStats.module.scss';

interface PlanStatsProps {
  day: Day;
  logs: WorkoutLog[];
  from: string | null;
  selectedExId: string | null;
  onSelectExercise: (exId: string) => void;
}

/** A plan's exercises, each with where it stands and where it is heading. */
export function PlanStats({ day, logs, from, selectedExId, onSelectExercise }: PlanStatsProps) {
  const exercises = dayExercises(day);
  return (
    <section>
      <h2 className={styles.title}>{day.title}</h2>
      {exercises.length === 0 && (
        <p className={styles.empty}>Dieser Plan hat noch keine Übungen.</p>
      )}
      <ul className={styles.list}>
        {exercises.map((x) => {
          // One side stands for the exercise in the list; the detail view shows both.
          const side = exerciseSides(x)[0] ?? 'B';
          // All time for the record, so a short range never makes an old best look new.
          const allPoints = exerciseSeries(logs, x.id, side, x.type);
          const points = from ? allPoints.filter((p) => p.date >= from) : allPoints;
          const last = points[points.length - 1];
          const delta = bestChange(points);
          const record = latestIsRecord(allPoints);
          return (
            <li key={x.id}>
              <button
                type="button"
                className={`${styles.row} ${x.id === selectedExId ? styles.rowOn : ''}`}
                aria-current={x.id === selectedExId ? 'true' : undefined}
                onClick={() => onSelectExercise(x.id)}
              >
                <span className={styles.name}>
                  {x.name}
                  {x.uni && (
                    <span className={styles.side}> · {SIDE_LABEL[side].toLowerCase()}</span>
                  )}
                </span>
                <Sparkline values={points.map((p) => p.best)} />
                <span className={styles.figures}>
                  {last ? (
                    <>
                      <span className={styles.value}>
                        {formatValue(last.best, x.type)}
                        {record && <span className={styles.record}>Rekord</span>}
                      </span>
                      {delta !== null && (
                        <span className={styles.delta}>{formatDelta(delta, x.type)}</span>
                      )}
                    </>
                  ) : (
                    <span className={styles.delta}>keine Werte</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

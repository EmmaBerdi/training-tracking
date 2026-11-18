import type { Exercise, ExerciseType, Side } from '../../types';
import { UNIT } from '../../data/constants';
import { useExerciseImage } from '../../hooks/useExerciseImage';
import { exerciseTracks } from '../../state/planOps';
import { formatSet } from '../../utils/format';
import { ExerciseTrack } from '../ExerciseTrack/ExerciseTrack';
import styles from './ExerciseCard.module.scss';

interface ExerciseCardProps {
  exercise: Exercise;
  getVal: (exId: string, side: Side, i: number) => string;
  lastVal: (exId: string, side: Side, i: number) => string;
  getReps: (exId: string, side: Side, i: number) => string;
  lastReps: (exId: string, side: Side, i: number) => string;
  onOpenInfo: (exId: string) => void;
  onOpenEntry: (exId: string, side: Side, i: number, name: string, type: ExerciseType) => void;
}

const SIDE_PREFIX: Record<Side, string> = { B: '', L: 'L ', R: 'R ' };

/**
 * The most recent number logged at each set position — per position, not per workout, so a set
 * skipped last time falls back to the one before it. The chips show these too, but only while a
 * set is still empty, so without this line the comparison vanishes as soon as a value is entered.
 */
function lastSummary(
  x: Exercise,
  lastVal: ExerciseCardProps['lastVal'],
  lastReps: ExerciseCardProps['lastReps'],
): string | null {
  const parts: string[] = [];
  for (const { side, count } of exerciseTracks(x)) {
    const sets = Array.from({ length: count }, (_, i) =>
      formatSet(lastVal(x.id, side, i), lastReps(x.id, side, i)),
    );
    if (sets.some(Boolean)) parts.push(SIDE_PREFIX[side] + sets.map((v) => v || '–').join(' / '));
  }
  return parts.length ? parts.join('  ·  ') : null;
}

export function ExerciseCard({
  exercise: x,
  getVal,
  lastVal,
  getReps,
  lastReps,
  onOpenInfo,
  onOpenEntry,
}: ExerciseCardProps) {
  const sets = x.uni ? `${x.setsL || 0}/${x.setsR || 0}` : `${x.sets}`;
  const last = lastSummary(x, lastVal, lastReps);
  // The card has room for one picture; the info sheet behind it shows them all.
  const firstImage = x.imageIds?.[0];
  const thumb = useExerciseImage(firstImage);

  return (
    <div className={styles.exercise}>
      <div className={styles.head}>
        <div className={styles.heading}>
          <div className={styles.name}>{x.name}</div>
          <div className={styles.spec}>{`${sets} × ${x.reps}  ·  ${UNIT[x.type]}`}</div>
          {last && <div className={styles.last}>{`zuletzt  ${last}`}</div>}
        </div>
        {firstImage ? (
          <button
            type="button"
            className={styles.thumbButton}
            aria-label={`Anleitung zu ${x.name}`}
            onClick={() => onOpenInfo(x.id)}
          >
            {thumb ? (
              <img className={styles.thumb} src={thumb} alt="" />
            ) : (
              <span className={styles.thumb} />
            )}
          </button>
        ) : (
          x.desc && (
            <button
              type="button"
              className={styles.info}
              aria-label={`Anleitung zu ${x.name}`}
              onClick={() => onOpenInfo(x.id)}
            >
              i
            </button>
          )
        )}
      </div>

      {exerciseTracks(x).map(({ side, count }) => (
        <ExerciseTrack
          key={side}
          exId={x.id}
          name={x.name}
          type={x.type}
          side={side}
          count={count}
          getVal={getVal}
          lastVal={lastVal}
          getReps={getReps}
          lastReps={lastReps}
          onOpenEntry={onOpenEntry}
        />
      ))}

      {x.note && <div className={styles.note}>{x.note}</div>}
    </div>
  );
}

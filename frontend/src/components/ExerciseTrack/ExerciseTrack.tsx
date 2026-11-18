import type { ExerciseType, Side } from '../../types';
import { UNIT } from '../../data/constants';
import { TOUR_TARGET } from '../Tour/targets';
import styles from './ExerciseTrack.module.scss';

interface ExerciseTrackProps {
  exId: string;
  name: string;
  type: ExerciseType;
  side: Side;
  count: number;
  getVal: (exId: string, side: Side, i: number) => string;
  lastVal: (exId: string, side: Side, i: number) => string;
  getReps: (exId: string, side: Side, i: number) => string;
  lastReps: (exId: string, side: Side, i: number) => string;
  onOpenEntry: (exId: string, side: Side, i: number, name: string, type: ExerciseType) => void;
}

const SIDE_LABEL: Record<Side, string> = { B: '', L: 'L', R: 'R' };

/**
 * The small line under a chip's number. Logged reps take the unit's place: the exercise heading
 * already names the unit. An empty chip says whose number it shows, or which set it is.
 */
function chipCaption(current: string, last: string, reps: string, type: ExerciseType, i: number) {
  if (current) return reps ? `× ${reps}` : UNIT[type];
  if (last) return reps ? `zuletzt × ${reps}` : 'zuletzt';
  return `Satz ${i + 1}`;
}

export function ExerciseTrack({
  exId,
  name,
  type,
  side,
  count,
  getVal,
  lastVal,
  getReps,
  lastReps,
  onOpenEntry,
}: ExerciseTrackProps) {
  return (
    <div className={styles.track}>
      <span className={`${styles.side} ${side === 'R' ? styles.sideRight : ''}`}>
        {SIDE_LABEL[side]}
      </span>
      <div className={styles.chips} data-tour={TOUR_TARGET.sets}>
        {Array.from({ length: count }, (_, i) => {
          const current = getVal(exId, side, i);
          const last = lastVal(exId, side, i);
          const reps = current ? getReps(exId, side, i) : lastReps(exId, side, i);
          // An empty chip shows the previous workout's number as a target, greyed out.
          const shown = current || last || '·';
          return (
            <button
              key={i}
              type="button"
              className={`${styles.chip} ${current ? styles.chipFilled : styles.chipEmpty}`}
              onClick={() => onOpenEntry(exId, side, i, name, type)}
            >
              <span className={styles.chipValue}>{shown}</span>
              <span className={styles.chipUnit}>{chipCaption(current, last, reps, type, i)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

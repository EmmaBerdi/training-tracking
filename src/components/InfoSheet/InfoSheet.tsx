import type { Exercise } from '../../types';
import { UNIT } from '../../data/constants';
import { useExerciseImage } from '../../hooks/useExerciseImage';
import styles from './InfoSheet.module.scss';

interface InfoSheetProps {
  exercise: Exercise;
  onClose: () => void;
}

export function InfoSheet({ exercise: x, onClose }: InfoSheetProps) {
  const spec = x.uni ? `${x.setsL || 0}/${x.setsR || 0} × ${x.reps}` : `${x.sets} × ${x.reps}`;
  const photo = useExerciseImage(x.imageId);
  return (
    <>
      <h2 className={styles.title}>{x.name}</h2>
      <div className={styles.sub}>
        {spec} · {UNIT[x.type]}
      </div>
      {photo && <img className={styles.photo} src={photo} alt={`Aufbau für ${x.name}`} />}
      {/* The fallback line is only worth showing when the picture isn't carrying the explanation. */}
      {(x.desc || !x.imageId) && (
        <div className={styles.guide}>{x.desc || 'Keine Anleitung hinterlegt.'}</div>
      )}
      {x.note && (
        <div className={styles.cue}>
          <span className={styles.cueLabel}>Achte darauf</span>
          {x.note}
        </div>
      )}
      <button type="button" className={styles.solid} onClick={onClose}>
        Schliessen
      </button>
    </>
  );
}

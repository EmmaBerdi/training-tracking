import type { Exercise } from '../../types';
import { UNIT } from '../../data/constants';
import { useExerciseImage } from '../../hooks/useExerciseImage';
import { exerciseSpec } from '../../state/planOps';
import styles from './InfoSheet.module.scss';

interface InfoSheetProps {
  exercise: Exercise;
  onClose: () => void;
}

/** Its own component so each photo loads through its own hook. */
function Photo({ imageId, alt }: { imageId: string; alt: string }) {
  const photo = useExerciseImage(imageId);
  return photo ? <img className={styles.photo} src={photo} alt={alt} /> : null;
}

export function InfoSheet({ exercise: x, onClose }: InfoSheetProps) {
  const spec = exerciseSpec(x);
  const imageIds = x.imageIds ?? [];
  return (
    <>
      <h2 className={styles.title}>{x.name}</h2>
      <div className={styles.sub}>
        {spec} · {UNIT[x.type]}
      </div>
      {imageIds.map((id, i) => (
        <Photo key={id} imageId={id} alt={`Aufbau für ${x.name}, Bild ${i + 1}`} />
      ))}
      {/* The fallback line is only worth showing when no picture is carrying the explanation. */}
      {(x.desc || imageIds.length === 0) && (
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

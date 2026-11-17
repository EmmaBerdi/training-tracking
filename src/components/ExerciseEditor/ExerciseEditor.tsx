import { useState } from 'react';
import type { BlockRef, Exercise, ExerciseType } from '../../types';
import { EXERCISE_TYPES, MAX_IMAGES, UNIT } from '../../data/constants';
import { useExerciseImage } from '../../hooks/useExerciseImage';
import type { ExerciseActions } from '../actions';
import styles from './ExerciseEditor.module.scss';

interface ExerciseEditorProps {
  exercise: Exercise;
  blockRef: BlockRef;
  actions: ExerciseActions;
}

/** One attached photo with its remove button; its own component so each loads its own picture. */
function Thumb({ imageId, onRemove }: { imageId: string; onRemove: () => void }) {
  const preview = useExerciseImage(imageId);
  return (
    <div className={styles.thumb}>
      {preview ? (
        <img className={styles.preview} src={preview} alt="" />
      ) : (
        <span className={styles.preview} />
      )}
      <button
        type="button"
        className={styles.remove}
        aria-label="Bild entfernen"
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}

export function ExerciseEditor({ exercise: x, blockRef, actions }: ExerciseEditorProps) {
  const [uploading, setUploading] = useState(false);
  const imageIds = x.imageIds ?? [];
  const room = MAX_IMAGES - imageIds.length;

  const pickImages = async (input: HTMLInputElement) => {
    // Beyond the limit the backend would refuse the whole plan save, so the extras are left out.
    const files = Array.from(input.files ?? []).slice(0, room);
    if (!files.length) return;
    setUploading(true);
    await actions.addImages(blockRef, x.id, files);
    setUploading(false);
    // Cleared so picking the same file again still counts as a change.
    input.value = '';
  };

  return (
    <div className={styles.editor}>
      <div className={`${styles.field} ${styles.wide}`}>
        <label htmlFor={`name-${x.id}`}>Übung</label>
        <input
          id={`name-${x.id}`}
          value={x.name}
          onChange={(e) => actions.setText(blockRef, x.id, 'name', e.target.value)}
        />
      </div>
      <div className={styles.grid}>
        <div className={styles.field}>
          <label htmlFor={`type-${x.id}`}>Belastung</label>
          <select
            id={`type-${x.id}`}
            value={x.type}
            onChange={(e) => actions.setType(blockRef, x.id, e.target.value as ExerciseType)}
          >
            {EXERCISE_TYPES.map((t) => (
              <option key={t} value={t}>
                {UNIT[t]}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={`reps-${x.id}`}>Wiederholungen</label>
          <input
            id={`reps-${x.id}`}
            value={x.reps}
            onChange={(e) => actions.setText(blockRef, x.id, 'reps', e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={`uni-${x.id}`}>Seiten</label>
          <select
            id={`uni-${x.id}`}
            value={x.uni ? '1' : '0'}
            onChange={(e) => actions.setUni(blockRef, x.id, e.target.value === '1')}
          >
            <option value="0">Beidseitig</option>
            <option value="1">Links / rechts</option>
          </select>
        </div>
        {x.uni ? (
          <div className={styles.field}>
            <label>Sätze L / R</label>
            <div className={styles.setsRow}>
              <input
                type="number"
                inputMode="numeric"
                aria-label="Sätze links"
                value={x.setsL || 0}
                onChange={(e) => actions.setSets(blockRef, x.id, 'setsL', Number(e.target.value))}
              />
              <input
                type="number"
                inputMode="numeric"
                aria-label="Sätze rechts"
                value={x.setsR || 0}
                onChange={(e) => actions.setSets(blockRef, x.id, 'setsR', Number(e.target.value))}
              />
            </div>
          </div>
        ) : (
          <div className={styles.field}>
            <label htmlFor={`sets-${x.id}`}>Sätze</label>
            <input
              id={`sets-${x.id}`}
              type="number"
              inputMode="numeric"
              value={x.sets || 1}
              onChange={(e) => actions.setSets(blockRef, x.id, 'sets', Number(e.target.value))}
            />
          </div>
        )}
        <div className={`${styles.field} ${styles.wide}`}>
          <label htmlFor={`note-${x.id}`}>Notiz — kurzer Hinweis unter der Übung</label>
          <input
            id={`note-${x.id}`}
            value={x.note ?? ''}
            onChange={(e) => actions.setText(blockRef, x.id, 'note', e.target.value)}
          />
        </div>
        <div className={`${styles.field} ${styles.wide}`}>
          <label htmlFor={`desc-${x.id}`}>Anleitung — Text hinter dem i</label>
          <textarea
            id={`desc-${x.id}`}
            rows={4}
            value={x.desc ?? ''}
            onChange={(e) => actions.setText(blockRef, x.id, 'desc', e.target.value)}
          />
        </div>
        <div className={`${styles.field} ${styles.wide}`}>
          <label htmlFor={`image-${x.id}`}>Bilder — Aufbau, zum Beispiel Kastenhöhe</label>
          {imageIds.length > 0 && (
            <div className={styles.thumbs}>
              {imageIds.map((id) => (
                <Thumb
                  key={id}
                  imageId={id}
                  onRemove={() => actions.removeImage(blockRef, x.id, id)}
                />
              ))}
            </div>
          )}
          <div className={styles.imageRow}>
            {room > 0 ? (
              <input
                id={`image-${x.id}`}
                className={styles.file}
                type="file"
                accept="image/*"
                multiple
                disabled={uploading}
                onChange={(e) => void pickImages(e.currentTarget)}
              />
            ) : (
              <span className={styles.hint}>Höchstens {MAX_IMAGES} Bilder pro Übung.</span>
            )}
            {uploading && <span className={styles.hint}>lädt …</span>}
          </div>
        </div>
      </div>
      <div className={styles.buttonRow}>
        <button
          type="button"
          className={styles.smallButton}
          onClick={() => actions.moveExercise(blockRef, x.id, -1)}
        >
          ↑ Hoch
        </button>
        <button
          type="button"
          className={styles.smallButton}
          onClick={() => actions.moveExercise(blockRef, x.id, 1)}
        >
          ↓ Runter
        </button>
        <button
          type="button"
          className={`${styles.smallButton} ${styles.danger} ${styles.pushRight}`}
          onClick={() => {
            if (window.confirm(`Übung "${x.name}" löschen?`)) {
              actions.deleteExercise(blockRef, x.id);
            }
          }}
        >
          Löschen
        </button>
      </div>
    </div>
  );
}

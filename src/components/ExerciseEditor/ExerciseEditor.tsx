import { useState } from 'react';
import type { BlockRef, Exercise, ExerciseType } from '../../types';
import { EXERCISE_TYPES, UNIT } from '../../data/constants';
import { useExerciseImage } from '../../hooks/useExerciseImage';
import type { ExerciseActions } from '../actions';
import styles from './ExerciseEditor.module.scss';

interface ExerciseEditorProps {
  exercise: Exercise;
  blockRef: BlockRef;
  actions: ExerciseActions;
}

export function ExerciseEditor({ exercise: x, blockRef, actions }: ExerciseEditorProps) {
  const preview = useExerciseImage(x.imageId);
  const [uploading, setUploading] = useState(false);

  const pickImage = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (!file) return;
    setUploading(true);
    await actions.setImage(blockRef, x.id, file);
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
          <label htmlFor={`image-${x.id}`}>Bild — Aufbau, zum Beispiel Kastenhöhe</label>
          <div className={styles.imageRow}>
            {preview && <img className={styles.preview} src={preview} alt="" />}
            <input
              id={`image-${x.id}`}
              className={styles.file}
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => void pickImage(e.currentTarget)}
            />
            {uploading && <span className={styles.hint}>lädt …</span>}
            {x.imageId && !uploading && (
              <button
                type="button"
                className={styles.smallButton}
                onClick={() => void actions.setImage(blockRef, x.id, null)}
              >
                Entfernen
              </button>
            )}
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

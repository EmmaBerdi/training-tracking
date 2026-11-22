import { useState } from 'react';
import type { BlockRef, Exercise, ExerciseType } from '../../types';
import { EXERCISE_TYPES, MAX_IMAGES, MAX_STEPS, TEXTY, UNIT } from '../../data/constants';
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

/**
 * The planned progression: one row per step, the current one marked. Empty sets and reps keep the
 * plan's, which the placeholders show; an empty target value leaves entries to what was logged.
 */
function Steps({ exercise: x, blockRef, actions }: ExerciseEditorProps) {
  const steps = x.steps ?? [];
  const at = x.step ?? 0;
  const planSets = x.uni ? `${x.setsL || 0}/${x.setsR || 0}` : String(x.sets);
  return (
    <div className={`${styles.field} ${styles.wide}`}>
      <label>Progression — Stufen, z. B. W1, W2, Taper</label>
      {steps.map((s, i) => (
        <div key={i} className={styles.stepRow}>
          <input
            type="radio"
            name={`step-${x.id}`}
            aria-label={`${s.name || `Stufe ${i + 1}`} ist die aktuelle Stufe`}
            checked={i === at}
            onChange={() => actions.setStep(blockRef, x.id, i)}
          />
          <input
            className={styles.stepName}
            aria-label="Name der Stufe"
            maxLength={32}
            value={s.name}
            onChange={(e) => actions.setStepField(blockRef, x.id, i, 'name', e.target.value)}
          />
          <input
            className={styles.stepNumber}
            type="number"
            inputMode="numeric"
            aria-label="Sätze dieser Stufe"
            placeholder={planSets}
            value={s.sets ?? ''}
            onChange={(e) => actions.setStepField(blockRef, x.id, i, 'sets', e.target.value)}
          />
          <span className={styles.times}>×</span>
          <input
            className={styles.stepNumber}
            aria-label="Wiederholungen dieser Stufe"
            maxLength={64}
            placeholder={x.reps}
            value={s.reps ?? ''}
            onChange={(e) => actions.setStepField(blockRef, x.id, i, 'reps', e.target.value)}
          />
          <button
            type="button"
            className={styles.stepRemove}
            aria-label={`Stufe ${s.name || i + 1} entfernen`}
            onClick={() => actions.removeStep(blockRef, x.id, i)}
          >
            ×
          </button>
          <div className={styles.stepExtra}>
            <input
              className={styles.stepValue}
              aria-label={`Zielwert dieser Stufe in ${UNIT[x.type]}`}
              placeholder={UNIT[x.type]}
              maxLength={64}
              type={TEXTY[x.type] ? 'text' : 'number'}
              inputMode={TEXTY[x.type] ? undefined : 'decimal'}
              step={TEXTY[x.type] ? undefined : 'any'}
              value={s.value ?? ''}
              onChange={(e) => actions.setStepField(blockRef, x.id, i, 'value', e.target.value)}
            />
            <input
              className={styles.stepText}
              aria-label="Hinweis zu dieser Stufe"
              placeholder="Hinweis, z. B. Seil als Kniehebelauf"
              maxLength={500}
              value={s.text ?? ''}
              onChange={(e) => actions.setStepField(blockRef, x.id, i, 'text', e.target.value)}
            />
          </div>
        </div>
      ))}
      {steps.length < MAX_STEPS && (
        <div>
          <button
            type="button"
            className={styles.smallButton}
            onClick={() => actions.addStep(blockRef, x.id)}
          >
            + Stufe
          </button>
        </div>
      )}
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
        <Steps exercise={x} blockRef={blockRef} actions={actions} />
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
            if (
              window.confirm(
                `Übung "${x.name}" löschen? Die dafür eingetragenen Werte werden ebenfalls gelöscht.`,
              )
            ) {
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

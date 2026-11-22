import { useState } from 'react';
import type { Exercise, ExerciseType, Rating, Side } from '../../types';
import { EFFORTS, EFFORT_LABEL, TEXTY, UNIT } from '../../data/constants';
import { useExerciseImage } from '../../hooks/useExerciseImage';
import { currentStep, exerciseSpec, exerciseTracks } from '../../state/planOps';
import type { StepSuggestion } from '../../state/progression';
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
  rating: Rating | undefined;
  /** Null removes the rating. */
  onRate: (rating: Rating | null) => void;
  suggestion: StepSuggestion | null;
  onSetStep: (index: number) => void;
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
  rating,
  onRate,
  suggestion,
  onSetStep,
}: ExerciseCardProps) {
  // Only for this visit: once today's workout is rated, the suggestion goes away by itself.
  const [kept, setKept] = useState(false);
  const step = currentStep(x);
  const stepCount = x.steps?.length ?? 0;
  const last = lastSummary(x, lastVal, lastReps);
  // The card has room for one picture; the info sheet behind it shows them all.
  const firstImage = x.imageIds?.[0];
  const thumb = useExerciseImage(firstImage);

  return (
    <div className={styles.exercise}>
      <div className={styles.head}>
        <div className={styles.heading}>
          <div className={styles.name}>{x.name}</div>
          <div className={styles.spec}>{`${exerciseSpec(x)}  ·  ${UNIT[x.type]}`}</div>
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

      {step && (
        <div className={styles.step}>
          <span className={styles.stepName}>{step.name}</span>
          {step.value && (
            <span className={styles.stepValue}>
              {TEXTY[x.type] ? step.value : `${step.value} ${UNIT[x.type]}`}
            </span>
          )}
          {step.text && <span className={styles.stepText}>{step.text}</span>}
          <span className={styles.stepCount}>
            Stufe {(x.step ?? 0) + 1}/{stepCount}
          </span>
        </div>
      )}

      {suggestion && !kept && (
        <div className={styles.suggestion}>
          <div>
            Neue Woche — weiter zu <strong>{suggestion.step.name}</strong>?
            {suggestion.efforts.length > 0 && (
              <span className={styles.suggestionWhy}>
                {' '}
                Letzte Woche: {suggestion.efforts.map((e) => EFFORT_LABEL[e]).join(', ')}
              </span>
            )}
          </div>
          <div className={styles.suggestionButtons}>
            <button
              type="button"
              className={styles.advance}
              onClick={() => onSetStep(suggestion.index)}
            >
              Weiter
            </button>
            <button type="button" className={styles.stay} onClick={() => setKept(true)}>
              Bleiben
            </button>
          </div>
        </div>
      )}

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

      {(stepCount > 0 || rating) && (
        <div className={styles.effort} role="group" aria-label={`Belastung ${x.name}`}>
          <span className={styles.effortLabel}>Belastung</span>
          {EFFORTS.map((effort) => {
            const on = rating?.effort === effort;
            return (
              <button
                key={effort}
                type="button"
                className={`${styles.chip} ${on ? styles.chipOn : ''}`}
                aria-pressed={on}
                onClick={() => onRate(on ? null : { effort, step: step?.name })}
              >
                {EFFORT_LABEL[effort]}
              </button>
            );
          })}
        </div>
      )}

      {x.note && <div className={styles.note}>{x.note}</div>}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { ExerciseType, ProgressionStep, Side } from '../../types';
import {
  QUICK,
  REPS_MAX,
  REPS_MIN,
  SIDE_LABEL,
  TEXTY,
  UNIT,
  WITH_REPS,
} from '../../data/constants';
import { entryDefaults, type SetEntry } from '../../state/logOps';
import { planRepsHint } from '../../state/planOps';
import { formatSet } from '../../utils/format';
import styles from './EntrySheet.module.scss';

interface EntrySheetProps {
  name: string;
  type: ExerciseType;
  side: Side;
  index: number;
  current: string;
  last: string;
  currentReps: string;
  lastReps: string;
  /** The plan's rep text for this exercise ("8", "6-8", …), used to suggest a count. */
  planReps: string;
  step: ProgressionStep | undefined;
  /** The set before this one in the same workout. */
  previous: SetEntry;
  onSubmit: (value: string, reps: string) => void;
  onClear: () => void;
}

export function EntrySheet({
  name,
  type,
  side,
  index,
  current,
  last,
  currentReps,
  lastReps,
  planReps,
  step,
  previous,
  onSubmit,
  onClear,
}: EntrySheetProps) {
  const withReps = Boolean(WITH_REPS[type]);
  const hint = planRepsHint(planReps);
  const [start] = useState(() =>
    entryDefaults({
      current: { value: current, reps: currentReps },
      last: { value: last, reps: lastReps },
      previous,
      step,
      planReps,
    }),
  );
  const [value, setValue] = useState(start.value);
  const [reps, setReps] = useState(start.reps);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 60);
    return () => window.clearTimeout(t);
  }, []);

  const sideTxt = side === 'B' ? '' : ` · ${SIDE_LABEL[side].toLowerCase()}`;
  const quick = QUICK[type] ?? [];
  const lastTxt = formatSet(last, withReps ? lastReps : '');
  const submit = () => onSubmit(value.trim(), withReps ? reps.trim() : '');

  return (
    <>
      <h2 className={styles.title}>{name}</h2>
      <div className={styles.sub}>
        Satz {index + 1}
        {sideTxt} · {UNIT[type]}
        {lastTxt !== '' ? `  ·  zuletzt ${lastTxt}` : ''}
      </div>
      <input
        ref={inputRef}
        className={styles.big}
        value={value}
        type={TEXTY[type] ? 'text' : 'number'}
        inputMode={TEXTY[type] ? undefined : 'decimal'}
        step={TEXTY[type] ? undefined : 'any'}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
      />
      <div className={styles.quick}>
        {quick.map((q) => (
          <button key={q} type="button" onClick={() => setValue(String(q))}>
            {q}
          </button>
        ))}
      </div>
      {withReps && (
        <div className={styles.reps}>
          <label htmlFor="entry-reps">Wiederholungen</label>
          <input
            id="entry-reps"
            className={styles.repsInput}
            value={reps}
            type="number"
            inputMode="numeric"
            min={REPS_MIN}
            max={REPS_MAX}
            placeholder="optional"
            onChange={(e) => setReps(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
          {hint?.kind === 'range' && (
            <div className={styles.quick}>
              {hint.reps.map((n) => (
                <button key={n} type="button" onClick={() => setReps(String(n))}>
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <button type="button" className={styles.solid} onClick={submit}>
        Eintragen
      </button>
      <button type="button" className={styles.ghost} onClick={onClear}>
        Wert löschen
      </button>
    </>
  );
}

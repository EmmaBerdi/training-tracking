import { useState } from 'react';
import type { IntervalTimer, IntervalTimerInput, TimerStep } from '../../types';
import { TIMER_MAX_SEC, TIMER_MAX_STEPS } from '../../data/constants';
import { formatClock, roundSeconds, timerSummary } from '../../state/timerOps';
import styles from './TimersSheet.module.scss';

interface TimersSheetProps {
  timers: IntervalTimer[];
  /** How many exercises run a timer, for the warning before deleting it. */
  usesOf: (timerId: number) => number;
  /** Opens straight on a new timer, e.g. from an exercise that has none yet. */
  startWithNew?: boolean;
  onCreate: (input: IntervalTimerInput) => Promise<IntervalTimer | null>;
  onSave: (id: number, input: IntervalTimerInput) => Promise<IntervalTimer | null>;
  onDelete: (id: number) => Promise<boolean>;
  /** Runs the timer being edited for a couple of rounds, to hear it before training with it. */
  onTest: (timer: IntervalTimer) => void;
}

const NEW_TIMER: IntervalTimerInput = {
  name: '',
  prepareSec: 10,
  steps: [{ workSec: 20, restSec: 10 }],
};

/** Who is being edited: nobody (the list), a new timer, or an existing one. */
type Editing = null | 'new' | IntervalTimer;

const clampSec = (value: string) =>
  Math.min(TIMER_MAX_SEC, Math.max(0, Math.round(Number(value)) || 0));

/** The timer page: every timer of this user, and the form to add or change one. */
export function TimersSheet({
  timers,
  usesOf,
  startWithNew,
  onCreate,
  onSave,
  onDelete,
  onTest,
}: TimersSheetProps) {
  const [editing, setEditing] = useState<Editing>(startWithNew ? 'new' : null);

  if (editing) {
    return (
      <TimerForm
        key={editing === 'new' ? 'new' : editing.id}
        timer={editing === 'new' ? undefined : editing}
        uses={editing === 'new' ? 0 : usesOf(editing.id)}
        onSubmit={async (input) => {
          const saved = editing === 'new' ? await onCreate(input) : await onSave(editing.id, input);
          if (saved) setEditing(null);
        }}
        onDelete={
          editing === 'new'
            ? undefined
            : async () => {
                if (await onDelete(editing.id)) setEditing(null);
              }
        }
        onTest={onTest}
        onBack={() => setEditing(null)}
      />
    );
  }

  return (
    <>
      <h2 className={styles.title}>Timer</h2>
      <div className={styles.sub}>
        Ein Timer ist eine Runde: Arbeit, dann Pause. Wie viele Runden, legst du bei der Übung fest.
      </div>

      {timers.length === 0 ? (
        <p className={styles.empty}>Noch keine Timer.</p>
      ) : (
        timers.map((t) => (
          <button key={t.id} type="button" className={styles.row} onClick={() => setEditing(t)}>
            <span className={styles.rowName}>{t.name}</span>
            <span className={styles.rowSummary}>{timerSummary(t)}</span>
          </button>
        ))
      )}

      <button type="button" className={styles.addButton} onClick={() => setEditing('new')}>
        + Timer
      </button>
    </>
  );
}

interface TimerFormProps {
  timer?: IntervalTimer;
  uses: number;
  onSubmit: (input: IntervalTimerInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  onTest: (timer: IntervalTimer) => void;
  onBack: () => void;
}

function TimerForm({ timer, uses, onSubmit, onDelete, onTest, onBack }: TimerFormProps) {
  const [input, setInput] = useState<IntervalTimerInput>(timer ?? NEW_TIMER);
  const [busy, setBusy] = useState(false);
  const complete = input.name.trim() !== '' && input.steps.every((s) => s.workSec >= 1);

  const setStep = (index: number, change: Partial<TimerStep>) =>
    setInput((prev) => ({
      ...prev,
      steps: prev.steps.map((s, i) => (i === index ? { ...s, ...change } : s)),
    }));
  // A new interval repeats the last one's times, the usual starting point for a ladder or a
  // pyramid, but not its name: in a circuit it is the next exercise.
  const addStep = () =>
    setInput((prev) => {
      const { workSec, restSec } = prev.steps[prev.steps.length - 1];
      return { ...prev, steps: [...prev.steps, { workSec, restSec }] };
    });
  const removeStep = (index: number) =>
    setInput((prev) => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }));

  const trimmed: IntervalTimerInput = {
    ...input,
    name: input.name.trim(),
    steps: input.steps.map((s) => ({ ...s, name: s.name?.trim() || null })),
  };

  const submit = async () => {
    if (!complete || busy) return;
    setBusy(true);
    await onSubmit(trimmed);
    setBusy(false);
  };

  return (
    <>
      <h2 className={styles.title}>{timer ? 'Timer bearbeiten' : 'Neuer Timer'}</h2>
      <div className={styles.sub}>
        Eine Runde läuft die Intervalle der Reihe nach durch und dauert{' '}
        {formatClock(roundSeconds(input))}; vorbereitet wird einmal zu Beginn.
      </div>

      <div className={styles.field}>
        <label htmlFor="timer-name">Name</label>
        <input
          id="timer-name"
          maxLength={64}
          value={input.name}
          placeholder="z. B. Tabata 20/10"
          onChange={(e) => setInput((prev) => ({ ...prev, name: e.target.value }))}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="timer-prepare">Vorbereiten (s)</label>
        <input
          id="timer-prepare"
          className={styles.seconds}
          type="number"
          inputMode="numeric"
          min={0}
          max={TIMER_MAX_SEC}
          value={input.prepareSec}
          onChange={(e) => setInput((prev) => ({ ...prev, prepareSec: clampSec(e.target.value) }))}
        />
      </div>

      <div className={styles.field}>
        <label>Intervalle</label>
        {input.steps.map((s, i) => (
          <div key={i} className={styles.step}>
            <span className={styles.stepNumber}>{i + 1}</span>
            <input
              className={styles.stepName}
              maxLength={64}
              aria-label={`Übung in Intervall ${i + 1}`}
              placeholder="Übung (optional)"
              value={s.name ?? ''}
              onChange={(e) => setStep(i, { name: e.target.value })}
            />
            <button
              type="button"
              className={styles.stepRemove}
              aria-label={`Intervall ${i + 1} entfernen`}
              disabled={input.steps.length === 1}
              onClick={() => removeStep(i)}
            >
              ×
            </button>
            <div className={styles.stepTimes}>
              <div className={styles.stepTime}>
                <label htmlFor={`step-${i}-work`}>Arbeit (s)</label>
                <input
                  id={`step-${i}-work`}
                  type="number"
                  inputMode="numeric"
                  aria-label={`Arbeit in Intervall ${i + 1}, Sekunden`}
                  min={1}
                  max={TIMER_MAX_SEC}
                  value={s.workSec}
                  onChange={(e) => setStep(i, { workSec: clampSec(e.target.value) })}
                />
              </div>
              <div className={styles.stepTime}>
                <label htmlFor={`step-${i}-rest`}>Pause (s)</label>
                <input
                  id={`step-${i}-rest`}
                  type="number"
                  inputMode="numeric"
                  aria-label={`Pause nach Intervall ${i + 1}, Sekunden`}
                  min={0}
                  max={TIMER_MAX_SEC}
                  value={s.restSec}
                  onChange={(e) => setStep(i, { restSec: clampSec(e.target.value) })}
                />
              </div>
            </div>
          </div>
        ))}
        {input.steps.length < TIMER_MAX_STEPS && (
          <button type="button" className={styles.addButton} onClick={addStep}>
            + Intervall
          </button>
        )}
      </div>

      <button
        type="button"
        className={styles.solid}
        disabled={!complete || busy}
        onClick={() => void submit()}
      >
        {timer ? 'Änderungen speichern' : 'Timer anlegen'}
      </button>

      <button
        type="button"
        className={styles.ghost}
        disabled={!complete}
        onClick={() => onTest({ id: timer?.id ?? 0, ...trimmed })}
      >
        Testen (2 Runden)
      </button>

      {onDelete && timer && (
        <button
          type="button"
          className={styles.danger}
          onClick={() => {
            const warning =
              uses > 0
                ? ` ${uses === 1 ? 'Eine Übung verwendet' : `${uses} Übungen verwenden`} ihn und ${uses === 1 ? 'hat' : 'haben'} danach keinen Timer mehr.`
                : '';
            if (window.confirm(`Timer "${timer.name}" löschen?${warning}`)) void onDelete();
          }}
        >
          Timer löschen
        </button>
      )}

      <button type="button" className={styles.ghost} onClick={onBack}>
        Zurück zur Liste
      </button>
    </>
  );
}

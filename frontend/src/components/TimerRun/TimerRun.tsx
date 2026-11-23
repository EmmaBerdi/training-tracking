import type { IntervalTimer } from '../../types';
import { PHASE_LABEL } from '../../data/constants';
import { useIntervalTimer } from '../../hooks/useIntervalTimer';
import { useScrollLock } from '../../hooks/useScrollLock';
import { exerciseAt, formatClock } from '../../state/timerOps';
import styles from './TimerRun.module.scss';

interface TimerRunProps {
  timer: IntervalTimer;
  rounds: number;
  /** What is being trained, shown over the timer's own name. */
  title: string;
  onFinish: () => void;
  onClose: () => void;
}

/** The whole screen while a timer runs: the phase as colour, its countdown, and the controls. */
export function TimerRun({ timer, rounds, title, onFinish, onClose }: TimerRunProps) {
  useScrollLock();
  const run = useIntervalTimer(timer, rounds, onFinish);
  const { schedule, position, finished } = run;
  const phase = schedule[position.index];
  const next = finished ? undefined : schedule[position.index + 1];
  const exercise = finished ? null : exerciseAt(timer, schedule, position.index);
  const steps = timer.steps.length;
  const secondsLeft = Math.ceil(position.remainingMs / 1000);

  const close = () => {
    if (run.running && !window.confirm('Timer abbrechen?')) return;
    onClose();
  };

  return (
    <div
      className={styles.run}
      data-phase={finished ? 'done' : phase.kind}
      role="dialog"
      aria-modal="true"
      aria-label={`Timer ${timer.name}`}
    >
      <div className={styles.top}>
        <div>
          <div className={styles.title}>{title}</div>
          <div className={styles.timerName}>{timer.name}</div>
        </div>
        <div className={styles.topButtons}>
          <button
            type="button"
            className={styles.iconButton}
            aria-pressed={run.soundOn}
            aria-label={run.soundOn ? 'Ton aus' : 'Ton an'}
            onClick={run.toggleSound}
          >
            {run.soundOn ? '🔔' : '🔕'}
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Schließen"
            onClick={close}
          >
            ×
          </button>
        </div>
      </div>

      <div className={styles.center}>
        {/* Announced as it changes; the countdown itself would be read out every second. */}
        <div aria-live="polite">
          <div className={styles.phase}>{finished ? 'Fertig' : PHASE_LABEL[phase.kind]}</div>
          {exercise && (
            <div className={styles.exercise}>
              {exercise.upcoming ? `Gleich: ${exercise.name}` : exercise.name}
            </div>
          )}
        </div>
        <div className={styles.count}>{finished ? '✓' : formatClock(secondsLeft)}</div>
        <div className={styles.round}>
          {phase.round > 0 ? `Runde ${phase.round} / ${rounds}` : `${rounds} Runden`}
          {phase.step > 0 && steps > 1 && (
            <div className={styles.step}>{`Intervall ${phase.step} / ${steps}`}</div>
          )}
        </div>
      </div>

      <div className={styles.bottom}>
        <div className={styles.meta}>
          <span>
            {next ? `Danach: ${PHASE_LABEL[next.kind]} ${formatClock(next.seconds)}` : ' '}
          </span>
          <span>noch {formatClock(run.totalSec - run.elapsedMs / 1000)}</span>
        </div>

        {finished ? (
          <div className={styles.controls}>
            <button type="button" className={styles.secondary} onClick={run.start}>
              Nochmal
            </button>
            <button type="button" className={styles.primary} onClick={onClose}>
              Fertig
            </button>
          </div>
        ) : (
          <div className={styles.controls}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Zurück"
              onClick={run.back}
            >
              ⏮
            </button>
            <button
              type="button"
              className={styles.primary}
              onClick={run.running ? run.pause : run.start}
            >
              {run.running ? 'Pause' : run.started ? 'Weiter' : 'Start'}
            </button>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Überspringen"
              onClick={run.skip}
            >
              ⏭
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

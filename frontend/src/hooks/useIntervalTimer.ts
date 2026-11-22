import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IntervalTimer } from '../types';
import { buildSchedule, cuesFrom, phaseAt, phaseStarts, totalSeconds } from '../state/timerOps';
import { cancelCues, loadSoundOn, scheduleCue, storeSoundOn, unlockAudio } from '../utils/sound';

/** Within this much of a phase's start, "back" goes to the phase before rather than restarting it. */
const BACK_GRACE_MS = 2000;

type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
};

/**
 * One run of a timer over `rounds` rounds. Time is read off the clock — the moment the run was
 * (re)started, less what came before a pause — rather than counted down tick by tick, so a run
 * stays right when the browser throttles a background tab or a locked screen.
 */
export function useIntervalTimer(timer: IntervalTimer, rounds: number, onFinish: () => void) {
  const schedule = useMemo(() => buildSchedule(timer, rounds), [timer, rounds]);
  const starts = useMemo(() => phaseStarts(schedule), [schedule]);
  const total = totalSeconds(schedule);

  /** Milliseconds run before the latest start; the clock adds the time since `anchor`. */
  const [base, setBase] = useState(0);
  /** performance.now() at the latest start, or null while paused or not started. */
  const [anchor, setAnchor] = useState<number | null>(null);
  const [now, setNow] = useState(() => performance.now());
  const [soundOn, setSoundOn] = useState(loadSoundOn);
  const [finished, setFinished] = useState(false);

  const running = anchor !== null;
  const elapsedMs = running ? base + (now - anchor) : base;
  const position = phaseAt(schedule, elapsedMs);

  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const queueCues = useCallback(
    (fromMs: number, sound: boolean) => {
      cancelCues();
      if (!sound) return;
      for (const { cue, atSec } of cuesFrom(schedule, fromMs / 1000)) {
        scheduleCue(cue, atSec - fromMs / 1000);
      }
    },
    [schedule],
  );

  /** Starts or resumes from `fromMs`; called from a tap, which is what lets iOS play the beeps. */
  const runFrom = useCallback(
    (fromMs: number) => {
      unlockAudio();
      const t = performance.now();
      setBase(fromMs);
      setAnchor(t);
      setNow(t);
      setFinished(false);
      queueCues(fromMs, soundOn);
    },
    [queueCues, soundOn],
  );

  const pause = useCallback(() => {
    cancelCues();
    setBase(elapsedMs);
    setAnchor(null);
  }, [elapsedMs]);

  /** Moves to `toMs`, keeping the run going if it was. */
  const seek = useCallback(
    (toMs: number) => {
      if (running) runFrom(toMs);
      else setBase(toMs);
    },
    [running, runFrom],
  );

  const start = useCallback(
    () => runFrom(finished ? 0 : elapsedMs),
    [runFrom, finished, elapsedMs],
  );

  const skip = useCallback(() => {
    if (position.done) return;
    seek(position.index + 1 < schedule.length ? starts[position.index + 1] * 1000 : total * 1000);
  }, [position, schedule.length, starts, total, seek]);

  const back = useCallback(() => {
    const index = Math.min(position.index, schedule.length - 1);
    const intoPhase = elapsedMs - starts[index] * 1000;
    const target = intoPhase < BACK_GRACE_MS && index > 0 ? index - 1 : index;
    setFinished(false);
    seek(starts[target] * 1000);
  }, [position.index, schedule.length, elapsedMs, starts, seek]);

  const toggleSound = useCallback(() => {
    const next = !soundOn;
    setSoundOn(next);
    storeSoundOn(next);
    if (running) queueCues(elapsedMs, next);
  }, [soundOn, running, elapsedMs, queueCues]);

  // Redraw every frame while running, and stop at the end of the run.
  useEffect(() => {
    if (anchor === null) return;
    let frame = 0;
    const tick = () => {
      const t = performance.now();
      if (base + (t - anchor) >= total * 1000) {
        setBase(total * 1000);
        setAnchor(null);
        setFinished(true);
        onFinishRef.current();
        return;
      }
      setNow(t);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [anchor, base, total]);

  // Keep the screen on while running. The lock lapses whenever the page is hidden, so it is asked
  // for again on return; iOS also stops the audio clock meanwhile, so the beeps are re-laid too.
  const resync = useRef(() => {});
  useEffect(() => {
    resync.current = () => {
      if (running) {
        unlockAudio();
        queueCues(base + (performance.now() - (anchor ?? 0)), soundOn);
      }
    };
  });
  useEffect(() => {
    if (!running) return;
    const wakeLock = (navigator as WakeLockNavigator).wakeLock;
    let lock: WakeLockSentinelLike | null = null;
    let released = false;
    const acquire = async () => {
      try {
        const next = await wakeLock?.request('screen');
        if (released) void next?.release();
        else lock = next ?? null;
      } catch {
        // Refused (low battery, unsupported): the run still works, the screen may just dim.
      }
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void acquire();
      resync.current();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [running]);

  // Leaving the run screen takes any queued beeps with it.
  useEffect(() => cancelCues, []);

  return {
    schedule,
    position,
    elapsedMs,
    totalSec: total,
    running,
    finished,
    started: running || elapsedMs > 0,
    soundOn,
    start,
    pause,
    skip,
    back,
    toggleSound,
  };
}

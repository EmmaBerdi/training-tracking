import type { IntervalTimer } from '../types';
import type { Cue } from '../utils/sound';

export type PhaseKind = 'prepare' | 'work' | 'rest';

/**
 * One stretch of a timer run. `round` and `step` (the interval within the round) count from 1; both
 * are 0 while preparing.
 */
export interface Phase {
  kind: PhaseKind;
  seconds: number;
  round: number;
  step: number;
}

/** Where a run stands: the phase under way and the time left in it. Past the end, `done`. */
export type Position =
  | { done: false; index: number; remainingMs: number }
  | { done: true; index: number; remainingMs: 0 };

/**
 * A run of `rounds` rounds: prepare once, then each round the timer's intervals in order, work and
 * rest. No rest after the very last interval — the run is over — and zero-length phases are left
 * out, so an interval without rest goes straight into the next one.
 */
export function buildSchedule(timer: IntervalTimer, rounds: number): Phase[] {
  const phases: Phase[] = [];
  if (timer.prepareSec > 0) {
    phases.push({ kind: 'prepare', seconds: timer.prepareSec, round: 0, step: 0 });
  }
  for (let round = 1; round <= rounds; round++) {
    timer.steps.forEach((s, i) => {
      const step = i + 1;
      if (s.workSec > 0) phases.push({ kind: 'work', seconds: s.workSec, round, step });
      const last = round === rounds && step === timer.steps.length;
      if (!last && s.restSec > 0) phases.push({ kind: 'rest', seconds: s.restSec, round, step });
    });
  }
  return phases;
}

/** How long one round takes, every interval with its rest. */
export function roundSeconds(timer: Pick<IntervalTimer, 'steps'>): number {
  return timer.steps.reduce((sum, s) => sum + s.workSec + s.restSec, 0);
}

export function totalSeconds(schedule: Phase[]): number {
  return schedule.reduce((sum, p) => sum + p.seconds, 0);
}

/** The second each phase starts at, counted from the start of the run. */
export function phaseStarts(schedule: Phase[]): number[] {
  const starts: number[] = [];
  let at = 0;
  for (const p of schedule) {
    starts.push(at);
    at += p.seconds;
  }
  return starts;
}

export function phaseAt(schedule: Phase[], elapsedMs: number): Position {
  let end = 0;
  for (let index = 0; index < schedule.length; index++) {
    end += schedule[index].seconds * 1000;
    if (elapsedMs < end) return { done: false, index, remainingMs: end - elapsedMs };
  }
  return { done: true, index: schedule.length - 1, remainingMs: 0 };
}

/**
 * The exercise to show for phase `index`: during work the interval's own, during prepare and rest
 * the one coming up next, so there is time to get into position. Null when that interval has no
 * name.
 */
export function exerciseAt(
  timer: Pick<IntervalTimer, 'steps'>,
  schedule: Phase[],
  index: number,
): { name: string; upcoming: boolean } | null {
  const work = schedule.slice(index).find((p) => p.kind === 'work');
  const name = work && timer.steps[work.step - 1]?.name;
  if (!work || !name) return null;
  return { name, upcoming: schedule[index].kind !== 'work' };
}

/** Ticks counted down before each phase ends. */
const COUNTDOWN = 3;

/**
 * Every beep of the run still ahead of `elapsedSec`, by the second it falls on: a tone as work or
 * rest begins, ticks over the last seconds of each phase, and the finish where the run ends. A
 * phase too short for the whole countdown gets only the ticks that fit inside it.
 */
export function cuesFrom(schedule: Phase[], elapsedSec: number): { cue: Cue; atSec: number }[] {
  const cues: { cue: Cue; atSec: number }[] = [];
  const starts = phaseStarts(schedule);
  schedule.forEach((phase, i) => {
    if (phase.kind !== 'prepare') cues.push({ cue: phase.kind, atSec: starts[i] });
    const end = starts[i] + phase.seconds;
    for (let n = COUNTDOWN; n >= 1; n--) {
      if (end - n > starts[i]) cues.push({ cue: 'tick', atSec: end - n });
    }
  });
  cues.push({ cue: 'finish', atSec: totalSeconds(schedule) });
  return cues.filter((c) => c.atSec >= elapsedSec);
}

/** "0:20", "1:05" — what the run screen and the timer list show. */
export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** Work/rest per interval in seconds: "20/10 s", "40/10 · 60/10 s"; "40" alone without rest. */
export function timerSummary(timer: IntervalTimer): string {
  const parts = timer.steps.map((s) =>
    s.restSec > 0 ? `${s.workSec}/${s.restSec}` : `${s.workSec}`,
  );
  return `${parts.join(' · ')} s`;
}

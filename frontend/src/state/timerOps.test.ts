import { describe, expect, it } from 'vitest';
import type { IntervalTimer } from '../types';
import {
  buildSchedule,
  cuesFrom,
  exerciseAt,
  formatClock,
  phaseAt,
  phaseStarts,
  roundSeconds,
  timerSummary,
  totalSeconds,
} from './timerOps';

/** A timer of one interval per round. */
function single(prepareSec: number, workSec: number, restSec: number): IntervalTimer {
  return { id: 1, name: 'Tabata', prepareSec, steps: [{ workSec, restSec }] };
}

const TABATA = single(10, 20, 10);

describe('buildSchedule', () => {
  it('prepares once, then works and rests each round, with no rest after the last', () => {
    expect(buildSchedule(TABATA, 3)).toEqual([
      { kind: 'prepare', seconds: 10, round: 0, step: 0 },
      { kind: 'work', seconds: 20, round: 1, step: 1 },
      { kind: 'rest', seconds: 10, round: 1, step: 1 },
      { kind: 'work', seconds: 20, round: 2, step: 1 },
      { kind: 'rest', seconds: 10, round: 2, step: 1 },
      { kind: 'work', seconds: 20, round: 3, step: 1 },
    ]);
  });

  it('runs every interval of a round in order, resting after each but the very last', () => {
    const ski: IntervalTimer = {
      id: 2,
      name: 'Ski',
      prepareSec: 0,
      steps: [
        { workSec: 40, restSec: 10 },
        { workSec: 60, restSec: 10 },
      ],
    };
    expect(roundSeconds(ski)).toBe(120);
    expect(buildSchedule(ski, 2).map((p) => `${p.kind} ${p.seconds} ${p.round}.${p.step}`)).toEqual(
      [
        'work 40 1.1',
        'rest 10 1.1',
        'work 60 1.2',
        'rest 10 1.2',
        'work 40 2.1',
        'rest 10 2.1',
        'work 60 2.2',
      ],
    );
  });

  it('leaves out phases of zero length', () => {
    expect(buildSchedule(single(0, 20, 0), 2).map((p) => p.kind)).toEqual(['work', 'work']);
  });

  it('adds up a Tabata of eight rounds to four minutes plus preparing, less the last rest', () => {
    expect(totalSeconds(buildSchedule(TABATA, 8))).toBe(10 + 8 * 20 + 7 * 10);
  });
});

describe('phaseAt', () => {
  const schedule = buildSchedule(TABATA, 2);

  it('finds the phase under way and the time left in it', () => {
    expect(phaseAt(schedule, 0)).toEqual({ done: false, index: 0, remainingMs: 10_000 });
    expect(phaseAt(schedule, 10_000)).toEqual({ done: false, index: 1, remainingMs: 20_000 });
    expect(phaseAt(schedule, 29_500)).toEqual({ done: false, index: 1, remainingMs: 500 });
    expect(phaseAt(schedule, 35_000)).toEqual({ done: false, index: 2, remainingMs: 5_000 });
  });

  it('reports the end once the last phase has run out', () => {
    expect(phaseAt(schedule, 60_000)).toEqual({ done: true, index: 3, remainingMs: 0 });
    expect(phaseAt(schedule, 999_000).done).toBe(true);
  });

  it('starts each phase where the one before ends', () => {
    expect(phaseStarts(schedule)).toEqual([0, 10, 30, 40]);
  });
});

describe('cuesFrom', () => {
  const schedule = buildSchedule(single(5, 4, 2), 2); // prepare 0–5, work 5–9, rest 9–11, work 11–15

  it('beeps into work and rest, counts down each phase, and finishes at the end', () => {
    expect(cuesFrom(schedule, 0)).toEqual([
      { cue: 'tick', atSec: 2 },
      { cue: 'tick', atSec: 3 },
      { cue: 'tick', atSec: 4 },
      { cue: 'work', atSec: 5 },
      { cue: 'tick', atSec: 6 },
      { cue: 'tick', atSec: 7 },
      { cue: 'tick', atSec: 8 },
      { cue: 'rest', atSec: 9 },
      { cue: 'tick', atSec: 10 },
      { cue: 'work', atSec: 11 },
      { cue: 'tick', atSec: 12 },
      { cue: 'tick', atSec: 13 },
      { cue: 'tick', atSec: 14 },
      { cue: 'finish', atSec: 15 },
    ]);
  });

  it('leaves out what has already sounded, but keeps a cue due right now', () => {
    expect(cuesFrom(schedule, 11).map((c) => c.atSec)).toEqual([11, 12, 13, 14, 15]);
    expect(cuesFrom(schedule, 11.5)[0]).toEqual({ cue: 'tick', atSec: 12 });
  });
});

describe('exerciseAt', () => {
  const circuit: IntervalTimer = {
    id: 3,
    name: 'Zirkel',
    prepareSec: 10,
    steps: [
      { workSec: 40, restSec: 20, name: 'High Knees' },
      { workSec: 40, restSec: 20, name: null },
      { workSec: 40, restSec: 20, name: 'Rudern' },
    ],
  };
  const schedule = buildSchedule(circuit, 2);
  const at = (index: number) => exerciseAt(circuit, schedule, index);

  it('names the interval under way during its work', () => {
    expect(schedule[1].kind).toBe('work');
    expect(at(1)).toEqual({ name: 'High Knees', upcoming: false });
  });

  it('names the next interval while preparing and resting, into the next round too', () => {
    expect(at(0)).toEqual({ name: 'High Knees', upcoming: true });
    expect(at(4)).toEqual({ name: 'Rudern', upcoming: true });
    expect(schedule[6]).toMatchObject({ kind: 'rest', round: 1, step: 3 });
    expect(at(6)).toEqual({ name: 'High Knees', upcoming: true });
  });

  it('has nothing to show for an unnamed interval', () => {
    expect(at(2)).toBeNull();
    expect(at(3)).toBeNull();
  });
});

describe('formatting', () => {
  it('shows minutes and padded seconds', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(9)).toBe('0:09');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(240)).toBe('4:00');
  });

  it('summarises work and rest per interval, or work alone', () => {
    expect(timerSummary(TABATA)).toBe('20/10 s');
    expect(
      timerSummary({
        ...TABATA,
        steps: [
          { workSec: 40, restSec: 10 },
          { workSec: 60, restSec: 0 },
        ],
      }),
    ).toBe('40/10 · 60 s');
  });
});

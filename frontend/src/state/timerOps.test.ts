import { describe, expect, it } from 'vitest';
import type { IntervalTimer } from '../types';
import {
  buildSchedule,
  cuesFrom,
  formatClock,
  phaseAt,
  phaseStarts,
  timerSummary,
  totalSeconds,
} from './timerOps';

const TABATA: IntervalTimer = { id: 1, name: 'Tabata', prepareSec: 10, workSec: 20, restSec: 10 };

describe('buildSchedule', () => {
  it('prepares once, then works and rests each round, with no rest after the last', () => {
    expect(buildSchedule(TABATA, 3)).toEqual([
      { kind: 'prepare', seconds: 10, round: 0 },
      { kind: 'work', seconds: 20, round: 1 },
      { kind: 'rest', seconds: 10, round: 1 },
      { kind: 'work', seconds: 20, round: 2 },
      { kind: 'rest', seconds: 10, round: 2 },
      { kind: 'work', seconds: 20, round: 3 },
    ]);
  });

  it('leaves out phases of zero length', () => {
    const noBreaks = { ...TABATA, prepareSec: 0, restSec: 0 };
    expect(buildSchedule(noBreaks, 2).map((p) => p.kind)).toEqual(['work', 'work']);
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
  const short: IntervalTimer = { ...TABATA, prepareSec: 5, workSec: 4, restSec: 2 };
  const schedule = buildSchedule(short, 2); // prepare 0–5, work 5–9, rest 9–11, work 11–15

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

describe('formatting', () => {
  it('shows minutes and padded seconds', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(9)).toBe('0:09');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(240)).toBe('4:00');
  });

  it('summarises work and rest, or work alone', () => {
    expect(timerSummary(TABATA)).toBe('20s / 10s');
    expect(timerSummary({ ...TABATA, restSec: 0 })).toBe('20s');
  });
});

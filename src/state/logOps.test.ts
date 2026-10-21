import { describe, expect, it } from 'vitest';
import type { SessionValues, WorkoutLog } from '../types';
import * as logOps from './logOps';

function log(date: string, dayId: string, vals: Record<string, SessionValues> = {}): WorkoutLog {
  return { date, dayId, vals, warm: [] };
}

describe('finding a log', () => {
  it('matches on date and plan together, not either alone', () => {
    const logs = [log('2026-08-20', 'mo'), log('2026-08-20', 'di')];
    expect(logOps.findLog(logs, '2026-08-20', 'di')).toBe(logs[1]);
    expect(logOps.findLog(logs, '2026-08-21', 'di')).toBeUndefined();
    expect(logOps.findLog(logs, '2026-08-20', 'fr')).toBeUndefined();
  });
});

describe('reading a value', () => {
  it('returns an empty string for every kind of miss', () => {
    const entry = log('2026-08-20', 'mo', { squat: { B: ['60'] } });
    expect(logOps.getVal(entry, 'squat', 'B', 0)).toBe('60');
    expect(logOps.getVal(entry, 'squat', 'B', 5)).toBe('');
    expect(logOps.getVal(entry, 'squat', 'L', 0)).toBe('');
    expect(logOps.getVal(entry, 'bench', 'B', 0)).toBe('');
    expect(logOps.getVal(undefined, 'squat', 'B', 0)).toBe('');
  });
});

describe('writing a value', () => {
  it('starts a log for a day that has none yet', () => {
    const next = logOps.setVal([], '2026-08-20', 'mo', 'squat', 'B', 0, '60');
    expect(next).toHaveLength(1);
    expect(next[0]).toEqual({
      date: '2026-08-20',
      dayId: 'mo',
      vals: { squat: { B: ['60'] } },
      warm: [],
    });
  });

  it('updates the matching log and leaves the others alone', () => {
    const other = log('2026-08-19', 'mo', { squat: { B: ['50'] } });
    const logs = [other, log('2026-08-20', 'mo', { squat: { B: ['60'] } })];

    const next = logOps.setVal(logs, '2026-08-20', 'mo', 'squat', 'B', 0, '65');

    expect(next).toHaveLength(2);
    expect(next[0]).toBe(other);
    expect(next[1].vals.squat.B).toEqual(['65']);
  });

  it('keeps the other sides and exercises of the same log', () => {
    const logs = [log('2026-08-20', 'mo', { squat: { B: ['60'] }, row: { L: ['20'] } })];

    const next = logOps.setVal(logs, '2026-08-20', 'mo', 'row', 'R', 0, '22');

    expect(next[0].vals.squat.B).toEqual(['60']);
    expect(next[0].vals.row).toEqual({ L: ['20'], R: ['22'] });
  });

  it('leaves a gap when a later set is filled first', () => {
    const next = logOps.setVal([], '2026-08-20', 'mo', 'squat', 'B', 2, '60');
    expect(next[0].vals.squat.B).toEqual([undefined, undefined, '60']);
  });

  it('does not mutate the array or the log it was given', () => {
    const logs = [log('2026-08-20', 'mo', { squat: { B: ['60'] } })];
    const snapshot = structuredClone(logs);

    logOps.setVal(logs, '2026-08-20', 'mo', 'squat', 'B', 0, '65');
    logOps.toggleWarmup(logs, '2026-08-20', 'mo', 0);

    expect(logs).toEqual(snapshot);
  });
});

describe('warmup checkboxes', () => {
  it('toggles a position on and off, starting a log if needed', () => {
    let logs = logOps.toggleWarmup([], '2026-08-20', 'mo', 1);
    expect(logs[0].warm).toEqual([undefined, true]);

    logs = logOps.toggleWarmup(logs, '2026-08-20', 'mo', 1);
    expect(logs[0].warm[1]).toBe(false);
  });
});

describe('previous values', () => {
  const logs = [
    log('2026-08-10', 'mo', { squat: { B: ['50', '50'] } }),
    log('2026-08-17', 'mo', { squat: { B: ['55', ''] } }),
    log('2026-08-24', 'mo', { squat: { B: ['60', '60'] } }),
  ];

  it('takes the most recent entry strictly before the given date', () => {
    const previous = logOps.lastValues(logs, '2026-08-24');
    expect(previous.get(logOps.positionKey('squat', 'B', 0))).toBe('55');
  });

  it('skips blanks and falls back to the newest workout that has a value', () => {
    const previous = logOps.lastValues(logs, '2026-08-24');
    expect(previous.get(logOps.positionKey('squat', 'B', 1))).toBe('50');
  });

  it('is empty when nothing precedes the date', () => {
    expect(logOps.lastValues(logs, '2026-08-01').size).toBe(0);
  });

  it('looks across plans, since an exercise can appear on more than one', () => {
    const across = [
      log('2026-08-10', 'mo', { squat: { B: ['50'] } }),
      log('2026-08-12', 'di', { squat: { B: ['52'] } }),
    ];
    const previous = logOps.lastValues(across, '2026-08-20');
    expect(previous.get(logOps.positionKey('squat', 'B', 0))).toBe('52');
  });

  it('keeps sides apart', () => {
    const sided = [log('2026-08-10', 'mo', { row: { L: ['20'], R: ['24'] } })];
    const previous = logOps.lastValues(sided, '2026-08-20');
    expect(previous.get(logOps.positionKey('row', 'L', 0))).toBe('20');
    expect(previous.get(logOps.positionKey('row', 'R', 0))).toBe('24');
  });
});

describe('the first entry of a workout', () => {
  it('is the first non-empty value, ignoring warm-up ticks and cleared sets', () => {
    expect(logOps.startsWorkout(undefined, '60')).toBe(true);
    expect(logOps.startsWorkout({ ...log('2026-08-20', 'mo'), warm: [true] }, '60')).toBe(true);
    expect(logOps.startsWorkout(log('2026-08-20', 'mo', { squat: { B: ['', ''] } }), '60')).toBe(
      true,
    );
  });

  it('is not an empty value, nor anything after a set is already logged', () => {
    expect(logOps.startsWorkout(undefined, '')).toBe(false);
    expect(logOps.startsWorkout(log('2026-08-20', 'mo', { squat: { L: ['8'] } }), '60')).toBe(
      false,
    );
  });
});

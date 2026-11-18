import { describe, expect, it } from 'vitest';
import type { PlannedSession, SessionValues, WorkoutLog } from '../types';
import * as stats from './stats';

function log(
  date: string,
  vals: Record<string, SessionValues>,
  reps?: Record<string, SessionValues>,
  dayId = 'mo',
): WorkoutLog {
  return { date, dayId, vals, warm: [], ...(reps ? { reps } : {}) };
}

function session(
  id: number,
  date: string,
  status: PlannedSession['status'],
  type = 1,
): PlannedSession {
  return { id, date, sessionTypeId: type, status };
}

describe('ranges', () => {
  it('counts today as the last day of the range', () => {
    expect(stats.rangeStart('4w', '2026-11-18')).toBe('2026-10-22');
    expect(stats.rangeStart('all', '2026-11-18')).toBeNull();
  });
});

describe('parseValue', () => {
  it('reads numbers, a decimal comma included', () => {
    expect(stats.parseValue('62.5', 'kg')).toBe(62.5);
    expect(stats.parseValue('62,5', 'kg')).toBe(62.5);
    expect(stats.parseValue('', 'kg')).toBeNull();
    expect(stats.parseValue('viel', 'sek')).toBeNull();
  });

  it('turns band colours into steps', () => {
    expect(stats.parseValue('gelb', 'band')).toBe(1);
    expect(stats.parseValue('Schwarz', 'band')).toBe(5);
    expect(stats.parseValue('lila', 'band')).toBeNull();
  });
});

describe('exerciseSeries', () => {
  const logs = [
    log('2026-11-10', { sq: { B: ['60', '65', '65'] } }, { sq: { B: ['8', '6', '5'] } }),
    log('2026-11-03', { sq: { B: ['60', '60'] } }),
    log('2026-11-17', { sq: { B: ['70', ''] } }, { sq: { B: ['3', ''] } }),
  ];

  it('gives one point per workout, oldest first', () => {
    const points = stats.exerciseSeries(logs, 'sq', 'B', 'kg');
    expect(points.map((p) => [p.date, p.best])).toEqual([
      ['2026-11-03', 60],
      ['2026-11-10', 65],
      ['2026-11-17', 70],
    ]);
  });

  it('takes average, volume and estimated max', () => {
    const point = stats.exerciseSeries(logs, 'sq', 'B', 'kg')[1];
    expect(point.avg).toBeCloseTo(63.33, 2);
    expect(point.volume).toBe(60 * 8 + 65 * 6 + 65 * 5);
    expect(point.e1rm).toBeCloseTo(65 * (1 + 6 / 30), 5);
  });

  it('leaves volume and estimated max empty for a workout without reps', () => {
    const point = stats.exerciseSeries(logs, 'sq', 'B', 'kg')[0];
    expect(point.volume).toBeNull();
    expect(point.e1rm).toBeNull();
  });

  it('counts total reps as the volume of a bodyweight exercise', () => {
    const points = stats.exerciseSeries(
      [log('2026-11-10', { pu: { B: ['8', '7', '6'] } })],
      'pu',
      'B',
      'bw',
    );
    expect(points[0].volume).toBe(21);
    expect(points[0].e1rm).toBeNull();
  });

  it('drops workouts before the range', () => {
    expect(stats.exerciseSeries(logs, 'sq', 'B', 'kg', '2026-11-10')).toHaveLength(2);
  });

  it('merges two logs of the same day', () => {
    const same = [
      log('2026-11-10', { sq: { B: ['60'] } }, undefined, 'mo'),
      log('2026-11-10', { sq: { B: ['70'] } }, undefined, 'do'),
    ];
    expect(stats.exerciseSeries(same, 'sq', 'B', 'kg')).toMatchObject([{ best: 70, avg: 65 }]);
  });
});

describe('records', () => {
  const logs = [
    log('2026-11-03', { sq: { B: ['60', '65'] } }, { sq: { B: ['8', '5'] } }),
    log('2026-11-10', { sq: { B: ['62.5', '65'] } }, { sq: { B: ['8', '5'] } }),
  ];

  it('keeps the date a record was first set', () => {
    expect(stats.exerciseRecords(logs, 'sq', 'B', 'kg').best).toEqual({
      value: 65,
      date: '2026-11-03',
      reps: 5,
    });
  });

  it('lists the best weight per rep count', () => {
    expect(stats.exerciseRecords(logs, 'sq', 'B', 'kg').byReps).toEqual([
      { value: 65, date: '2026-11-03', reps: 5 },
      { value: 62.5, date: '2026-11-10', reps: 8 },
    ]);
  });

  it('spots a latest workout that beat all before it, not one that only tied', () => {
    const points = stats.exerciseSeries(logs, 'sq', 'B', 'kg');
    expect(stats.latestIsRecord(points)).toBe(false);
    const beaten = [...logs, log('2026-11-17', { sq: { B: ['67.5'] } })];
    expect(stats.latestIsRecord(stats.exerciseSeries(beaten, 'sq', 'B', 'kg'))).toBe(true);
  });
});

describe('bestChange and sideGap', () => {
  const series = (values: number[]) =>
    stats.exerciseSeries(
      values.map((v, i) => log(`2026-11-1${i}`, { x: { B: [String(v)] } })),
      'x',
      'B',
      'kg',
    );

  it('compares first and last workout', () => {
    expect(stats.bestChange(series([50, 55, 52.5]))).toBe(2.5);
    expect(stats.bestChange(series([50]))).toBeNull();
  });

  it('points out the weaker side from 10 % on', () => {
    expect(stats.sideGap(series([18]), series([20]), 'kg')).toEqual({ weaker: 'L', percent: 10 });
    expect(stats.sideGap(series([19]), series([20]), 'kg')).toBeNull();
    expect(stats.sideGap(series([1]), series([3]), 'band')).toBeNull();
  });
});

describe('planSummary', () => {
  it('counts workouts with entries in the range and finds the latest at all', () => {
    const logs = [
      log('2026-09-01', { sq: { B: ['60'] } }),
      log('2026-11-10', { sq: { B: ['65'] } }),
      { ...log('2026-11-12', {}), warm: [true] },
      log('2026-11-14', { sq: { B: ['70'] } }, undefined, 'di'),
    ];
    expect(stats.planSummary(logs, 'mo', '2026-11-01')).toEqual({
      workouts: 1,
      lastDate: '2026-11-10',
    });
  });
});

describe('consistency', () => {
  const today = '2026-11-18'; // a Wednesday

  it('lists every week of the range, empty ones included', () => {
    const result = stats.consistency([session(1, '2026-11-02', 'done')], '2026-11-02', today);
    expect(result.weeks.map((w) => w.start)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    expect(result.weeks[1].types).toEqual([]);
  });

  it('counts a missed past session against the rate, but not one later today', () => {
    const result = stats.consistency(
      [
        session(1, '2026-11-16', 'done'),
        session(2, '2026-11-17', 'planned'),
        session(3, today, 'planned'),
      ],
      '2026-11-16',
      today,
    );
    expect(result).toMatchObject({ due: 2, done: 1, rate: 0.5 });
  });

  it('counts complete weeks back from today, skipping weeks with nothing due', () => {
    const result = stats.consistency(
      [
        session(1, '2026-10-20', 'skipped'),
        session(2, '2026-10-27', 'done'),
        session(3, '2026-11-10', 'done'),
        session(4, today, 'planned'),
      ],
      '2026-10-19',
      today,
    );
    expect(result.streak).toBe(2);
  });
});

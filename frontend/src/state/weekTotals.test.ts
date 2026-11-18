import { describe, expect, it } from 'vitest';
import type { PlannedSession, PlannedSessionStatus } from '../types';
import { weekTotals } from './weekTotals';

let nextId = 1;

function session(
  date: string,
  sessionTypeId: number,
  status: PlannedSessionStatus = 'planned',
): PlannedSession {
  return { id: nextId++, date, sessionTypeId, status };
}

// October 2026: the grid opens on Mon 28 Sep, and 1 Oct is a Thursday.
const OCTOBER = new Date(2026, 9, 1);

describe('weekly totals', () => {
  it('counts planned, done and skipped per type within each week', () => {
    const totals = weekTotals(
      [
        session('2026-10-12', 2, 'done'),
        session('2026-10-14', 1, 'skipped'),
        session('2026-10-15', 2, 'done'),
        session('2026-10-17', 2),
      ],
      OCTOBER,
    );

    expect(totals).toEqual([
      {
        start: '2026-10-12',
        week: 42,
        types: [
          { sessionTypeId: 2, total: 3, done: 2, skipped: 0 },
          { sessionTypeId: 1, total: 1, done: 0, skipped: 1 },
        ],
      },
    ]);
  });

  it('keeps a week that straddles the month whole, and leaves out empty weeks', () => {
    const totals = weekTotals(
      [session('2026-09-28', 3, 'done'), session('2026-10-04', 3), session('2026-10-20', 3)],
      OCTOBER,
    );

    expect(totals.map((w) => [w.start, w.types[0].total])).toEqual([
      ['2026-09-28', 2],
      ['2026-10-19', 1],
    ]);
  });

  it('skips grid weeks that lie entirely in the next month', () => {
    // The last grid row of October 2026 is 2–8 Nov: loaded with the month, but not part of it.
    expect(weekTotals([session('2026-11-04', 1)], OCTOBER)).toEqual([]);
  });
});

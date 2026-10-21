import { describe, expect, it } from 'vitest';
import type { WeekdayMask } from '../types';
import {
  addMonths,
  formatTabDate,
  isoDate,
  isoWeek,
  isSameMonth,
  monthGrid,
  monthRange,
  weekdayBit,
  WEEKDAY_SHORT,
} from './date';

describe('isoDate', () => {
  it('uses the local date, not the UTC one', () => {
    // Late evening local time is already the next day in UTC; the app's dates are local.
    expect(isoDate(new Date(2026, 7, 21, 23, 30))).toBe('2026-08-21');
    expect(isoDate(new Date(2026, 7, 21, 0, 15))).toBe('2026-08-21');
  });
});

describe('monthGrid', () => {
  it('always returns six full weeks starting on a Monday', () => {
    const grid = monthGrid(new Date(2026, 7, 1));
    expect(grid).toHaveLength(42);
    expect(grid[0].getDay()).toBe(1);
  });

  it('pads with the neighbouring months so the first row is complete', () => {
    // 1 Aug 2026 is a Saturday, so the grid opens on Mon 27 July.
    const grid = monthGrid(new Date(2026, 7, 15));
    expect(isoDate(grid[0])).toBe('2026-07-27');
    expect(isoDate(grid[41])).toBe('2026-09-06');
  });

  it('starts on the first of the month when that is already a Monday', () => {
    const grid = monthGrid(new Date(2026, 5, 10)); // June 2026 starts on a Monday
    expect(isoDate(grid[0])).toBe('2026-06-01');
  });
});

describe('monthRange', () => {
  it('spans the whole padded grid, not just the calendar month', () => {
    expect(monthRange(new Date(2026, 7, 15))).toEqual({ from: '2026-07-27', to: '2026-09-06' });
  });
});

describe('addMonths', () => {
  it('normalises to the first of the target month', () => {
    expect(isoDate(addMonths(new Date(2026, 7, 31), 1))).toBe('2026-09-01');
  });

  it('crosses year boundaries in both directions', () => {
    expect(isoDate(addMonths(new Date(2026, 0, 15), -1))).toBe('2025-12-01');
    expect(isoDate(addMonths(new Date(2026, 11, 15), 1))).toBe('2027-01-01');
  });
});

describe('weekdayBit', () => {
  it('numbers weekdays Monday-first, matching the rule bitmask', () => {
    const monday: WeekdayMask = weekdayBit('2026-08-24');
    expect(monday).toBe(1);
    expect(weekdayBit('2026-08-27')).toBe(8); // Thursday
    expect(weekdayBit('2026-08-30')).toBe(64); // Sunday
  });

  it('agrees with the weekday labels shown next to the checkboxes', () => {
    const sunday = weekdayBit('2026-08-30');
    expect(WEEKDAY_SHORT[Math.log2(sunday)]).toBe('So');
  });
});

describe('isSameMonth', () => {
  it('compares month and year, not just the month number', () => {
    expect(isSameMonth('2026-08-01', new Date(2026, 7, 20))).toBe(true);
    expect(isSameMonth('2025-08-01', new Date(2026, 7, 20))).toBe(false);
    expect(isSameMonth('2026-09-01', new Date(2026, 7, 20))).toBe(false);
  });
});

describe('formatTabDate', () => {
  it('shows the weekday and day number, since the month sits in the header', () => {
    expect(formatTabDate('2026-08-24')).toBe('Mo 24.');
  });
});

describe('isoWeek', () => {
  it('counts the week holding 4 January as week 1', () => {
    expect(isoWeek('2026-01-01')).toBe(1); // a Thursday
    expect(isoWeek('2026-10-21')).toBe(43);
  });

  it('gives the first days of a year to the last week of the previous one when they fall short', () => {
    expect(isoWeek('2027-01-01')).toBe(53); // a Friday, still in 2026's 53rd week
    expect(isoWeek('2027-01-04')).toBe(1);
  });

  it('is not thrown off by the clock change', () => {
    expect(isoWeek('2026-03-30')).toBe(14); // the Monday after summer time starts
  });
});

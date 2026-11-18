import type { PlannedSession } from '../types';
import { isoDate, isoWeek, monthGrid } from '../utils/date';

/** How one activity went in one week. `total` counts everything scheduled, whatever its status. */
export interface TypeTotal {
  sessionTypeId: number;
  total: number;
  done: number;
  skipped: number;
}

export interface WeekTotal {
  /** The Monday the week starts on, as `YYYY-MM-DD`. */
  start: string;
  week: number;
  types: TypeTotal[];
}

/**
 * Planned against done, per activity, for every week of the month grid that touches `month` and has
 * anything scheduled. Types appear in the order their first session of the week happens.
 */
export function weekTotals(sessions: PlannedSession[], month: Date): WeekTotal[] {
  const grid = monthGrid(month);
  const result: WeekTotal[] = [];
  for (let i = 0; i < grid.length; i += 7) {
    const days = grid.slice(i, i + 7);
    if (!days.some((d) => d.getMonth() === month.getMonth())) continue;
    const start = isoDate(days[0]);
    const end = isoDate(days[6]);

    const byType = new Map<number, TypeTotal>();
    const inWeek = sessions
      .filter((s) => s.date >= start && s.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));
    for (const s of inWeek) {
      let entry = byType.get(s.sessionTypeId);
      if (!entry) {
        entry = { sessionTypeId: s.sessionTypeId, total: 0, done: 0, skipped: 0 };
        byType.set(s.sessionTypeId, entry);
      }
      entry.total += 1;
      if (s.status === 'done') entry.done += 1;
      if (s.status === 'skipped') entry.skipped += 1;
    }
    if (byType.size > 0) result.push({ start, week: isoWeek(start), types: [...byType.values()] });
  }
  return result;
}

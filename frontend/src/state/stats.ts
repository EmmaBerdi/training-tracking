import type { Exercise, ExerciseType, PlannedSession, Side, WorkoutLog } from '../types';
import { QUICK, WITH_REPS } from '../data/constants';
import { shiftDays, weekStart } from '../utils/date';
import { hasValues } from './logOps';
import { exerciseTracks } from './planOps';
import type { TypeTotal } from './weekTotals';

export type StatsRange = '4w' | '3m' | '6m' | '1y' | 'all';

export const STATS_RANGE_LABEL: Record<StatsRange, string> = {
  '4w': '4 W',
  '3m': '3 M',
  '6m': '6 M',
  '1y': '1 J',
  all: 'Alle',
};

export const STATS_RANGES = Object.keys(STATS_RANGE_LABEL) as StatsRange[];

const RANGE_DAYS: Record<Exclude<StatsRange, 'all'>, number> = {
  '4w': 28,
  '3m': 91,
  '6m': 182,
  '1y': 365,
};

/** The first date inside the range, counting `today` as its last day; null for "Alle". */
export function rangeStart(range: StatsRange, today: string): string | null {
  return range === 'all' ? null : shiftDays(today, -(RANGE_DAYS[range] - 1));
}

/** One side of one exercise per entry: both sides apart for left/right exercises. */
export function exerciseSides(x: Exercise): Side[] {
  return exerciseTracks(x).map((t) => t.side);
}

const BAND_ORDER = (QUICK.band ?? []).map((b) => String(b).toLowerCase());

/**
 * A logged value as a number to chart: the load, time, distance or count as entered, and for a band
 * its step on the colour scale (gelb = 1 … schwarz = 5). Null for anything that reads as neither.
 */
export function parseValue(value: string, type: ExerciseType): number | null {
  const raw = value.trim();
  if (type === 'band') {
    const step = BAND_ORDER.indexOf(raw.toLowerCase());
    return step < 0 ? null : step + 1;
  }
  const n = Number(raw.replace(',', '.'));
  return raw !== '' && Number.isFinite(n) ? n : null;
}

/** Estimated one-rep max (Epley). Only meaningful for a load, so callers keep it to kg. */
export function epley(weight: number, reps: number): number {
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

interface LoggedSet {
  date: string;
  value: number;
  reps: number | null;
}

function setsOf(
  logs: WorkoutLog[],
  exId: string,
  side: Side,
  type: ExerciseType,
  from: string | null,
): LoggedSet[] {
  const sets: LoggedSet[] = [];
  for (const log of logs) {
    if (from && log.date < from) continue;
    log.vals[exId]?.[side]?.forEach((raw, i) => {
      const value = parseValue(raw, type);
      if (value === null) return;
      const reps = Number(log.reps?.[exId]?.[side]?.[i] || NaN);
      sets.push({ date: log.date, value, reps: Number.isInteger(reps) && reps > 0 ? reps : null });
    });
  }
  return sets;
}

/** How one exercise went in one workout. */
export interface WorkoutPoint {
  date: string;
  /** The best set: heaviest, longest, furthest — whatever the type measures. */
  best: number;
  avg: number;
  /** kg × reps over the sets that have reps; for bodyweight, the total reps. */
  volume: number | null;
  /** Highest estimated one-rep max among sets with reps; kg only. */
  e1rm: number | null;
}

/**
 * One point per workout day for one side of an exercise, oldest first. Two logs on the same date
 * (the exercise on two plans) count as one workout.
 */
export function exerciseSeries(
  logs: WorkoutLog[],
  exId: string,
  side: Side,
  type: ExerciseType,
  from: string | null = null,
): WorkoutPoint[] {
  const byDate = new Map<string, LoggedSet[]>();
  for (const set of setsOf(logs, exId, side, type, from)) {
    byDate.set(set.date, [...(byDate.get(set.date) ?? []), set]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sets]) => {
      const best = Math.max(...sets.map((s) => s.value));
      const withReps = sets.filter((s): s is LoggedSet & { reps: number } => s.reps !== null);
      let volume: number | null = null;
      if (type === 'bw') volume = sets.reduce((n, s) => n + s.value, 0);
      else if (type === 'kg' && withReps.length)
        volume = withReps.reduce((n, s) => n + s.value * s.reps, 0);
      return {
        date,
        best,
        avg: sets.reduce((n, s) => n + s.value, 0) / sets.length,
        volume,
        e1rm:
          type === 'kg' && withReps.length
            ? Math.max(...withReps.map((s) => epley(s.value, s.reps)))
            : null,
      };
    });
}

export interface RecordEntry {
  value: number;
  date: string;
  reps: number | null;
}

export interface ExerciseRecords {
  /** The best set ever, first reached on `date`. */
  best: RecordEntry | null;
  /** The best value per rep count, fewest reps first; only for types logged with reps. */
  byReps: RecordEntry[];
}

/** All-time records for one side of an exercise, whatever range is on screen. */
export function exerciseRecords(
  logs: WorkoutLog[],
  exId: string,
  side: Side,
  type: ExerciseType,
): ExerciseRecords {
  // Oldest first, so a later tie never displaces the date a record was first set.
  const sets = setsOf(logs, exId, side, type, null).sort((a, b) => a.date.localeCompare(b.date));
  let best: RecordEntry | null = null;
  const byReps = new Map<number, RecordEntry>();
  for (const s of sets) {
    if (!best || s.value > best.value) best = { value: s.value, date: s.date, reps: s.reps };
    if (WITH_REPS[type] && s.reps !== null) {
      const held = byReps.get(s.reps);
      if (!held || s.value > held.value) byReps.set(s.reps, { ...s });
    }
  }
  return { best, byReps: [...byReps.values()].sort((a, b) => (a.reps ?? 0) - (b.reps ?? 0)) };
}

/** True when the latest workout beat every one before it. Needs a workout to beat. */
export function latestIsRecord(points: WorkoutPoint[]): boolean {
  if (points.length < 2) return false;
  const last = points[points.length - 1].best;
  return points.slice(0, -1).every((p) => last > p.best);
}

/** How far the best set moved from the first workout to the last; null without two to compare. */
export function bestChange(points: WorkoutPoint[]): number | null {
  if (points.length < 2) return null;
  return points[points.length - 1].best - points[0].best;
}

/** How far one side may trail the other before it is pointed out. */
const SIDE_GAP_PERCENT = 10;

/**
 * Which side trails the other in its latest workout, and by how much, once the gap reaches
 * {@link SIDE_GAP_PERCENT}. Bands are left out: steps on a colour scale have no meaningful ratio.
 */
export function sideGap(
  left: WorkoutPoint[],
  right: WorkoutPoint[],
  type: ExerciseType,
): { weaker: 'L' | 'R'; percent: number } | null {
  if (type === 'band' || !left.length || !right.length) return null;
  const l = left[left.length - 1].best;
  const r = right[right.length - 1].best;
  const stronger = Math.max(l, r);
  if (stronger <= 0) return null;
  const percent = Math.round(((stronger - Math.min(l, r)) / stronger) * 100);
  return percent >= SIDE_GAP_PERCENT ? { weaker: l < r ? 'L' : 'R', percent } : null;
}

export interface PlanSummary {
  /** Workouts of this plan inside the range that have anything entered. */
  workouts: number;
  /** The most recent such workout, at any time. */
  lastDate: string | null;
}

export function planSummary(logs: WorkoutLog[], dayId: string, from: string | null): PlanSummary {
  const done = logs.filter((l) => l.dayId === dayId && hasValues(l)).map((l) => l.date);
  return {
    workouts: done.filter((d) => !from || d >= from).length,
    lastDate: done.length ? done.reduce((a, b) => (a > b ? a : b)) : null,
  };
}

export interface ConsistencyWeek {
  /** The Monday the week starts on. */
  start: string;
  types: TypeTotal[];
}

export interface Consistency {
  /** Every week from the first to today's, empty ones included so a chart keeps its rhythm. */
  weeks: ConsistencyWeek[];
  /** Sessions that could have been done by now: every earlier one, and today's once settled. */
  due: number;
  done: number;
  skipped: number;
  /** done / due, or null with nothing due. */
  rate: number | null;
  /** Weeks in a row, back from today, in which every session due was done. */
  streak: number;
}

/**
 * Planned against done between `from` and `today`. A session still "geplant" after its day counts
 * against rate and streak like a skipped one; today's count only once marked, so a workout later
 * today doesn't count as missed in the morning. Weeks with nothing due neither extend nor break the
 * streak.
 */
export function consistency(sessions: PlannedSession[], from: string, today: string): Consistency {
  const inRange = sessions.filter((s) => s.date >= from && s.date <= today);
  const due = inRange.filter((s) => s.date < today || s.status !== 'planned');
  const byWeek = new Map<string, Map<number, TypeTotal>>();
  for (let w = weekStart(from); w <= today; w = shiftDays(w, 7)) byWeek.set(w, new Map());

  for (const s of [...inRange].sort((a, b) => a.date.localeCompare(b.date))) {
    const types = byWeek.get(weekStart(s.date));
    if (!types) continue;
    let entry = types.get(s.sessionTypeId);
    if (!entry) {
      entry = { sessionTypeId: s.sessionTypeId, total: 0, done: 0, skipped: 0 };
      types.set(s.sessionTypeId, entry);
    }
    entry.total += 1;
    if (s.status === 'done') entry.done += 1;
    if (s.status === 'skipped') entry.skipped += 1;
  }

  let streak = 0;
  for (const week of [...byWeek.keys()].reverse()) {
    const end = shiftDays(week, 6);
    const dueInWeek = due.filter((s) => s.date >= week && s.date <= end);
    if (!dueInWeek.length) continue;
    if (dueInWeek.some((s) => s.status !== 'done')) break;
    streak += 1;
  }

  const done = due.filter((s) => s.status === 'done').length;
  return {
    weeks: [...byWeek.entries()].map(([start, types]) => ({ start, types: [...types.values()] })),
    due: due.length,
    done,
    skipped: due.filter((s) => s.status === 'skipped').length,
    rate: due.length ? done / due.length : null,
    streak,
  };
}

import type { Rating, Side, WorkoutLog } from '../types';

export function findLog(logs: WorkoutLog[], date: string, dayId: string): WorkoutLog | undefined {
  return logs.find((s) => s.date === date && s.dayId === dayId);
}

/** True once anything has been entered; a log holding only checked warm-up items does not count. */
export function hasValues(log: WorkoutLog | undefined): boolean {
  return Object.values(log?.vals ?? {}).some((sides) =>
    Object.values(sides).some((values) => values?.some((v) => v !== '')),
  );
}

/**
 * Whether entering `value` into `log` is the first real entry of that workout: the moment its
 * planned session counts as done. Later entries never re-trigger it, so a session the user set back
 * to "geplant" by hand stays that way.
 */
export function startsWorkout(log: WorkoutLog | undefined, value: string): boolean {
  return value !== '' && !hasValues(log);
}

export function getVal(log: WorkoutLog | undefined, exId: string, side: Side, i: number): string {
  return log?.vals[exId]?.[side]?.[i] ?? '';
}

export function getReps(log: WorkoutLog | undefined, exId: string, side: Side, i: number): string {
  return log?.reps?.[exId]?.[side]?.[i] ?? '';
}

/** A set as entered: its value, and the reps done with it ('' when none were logged). */
export interface SetEntry {
  value: string;
  reps: string;
}

/**
 * The most recent entry for one position before `beforeDate`, across every logged workout. The reps
 * come from the same workout as the value, so the pair always describes one real set.
 *
 * Built once per render as a lookup rather than scanned per set: the exercise view asks for this
 * on every chip, and the log grows without bound.
 */
export function lastSets(logs: WorkoutLog[], beforeDate: string): Map<string, SetEntry> {
  const byPosition = new Map<string, SetEntry>();
  const earlier = logs
    .filter((s) => s.date < beforeDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Ascending, so a later workout overwrites an earlier one for the same position.
  for (const log of earlier) {
    for (const [exId, sides] of Object.entries(log.vals)) {
      for (const [side, values] of Object.entries(sides)) {
        values?.forEach((value, i) => {
          if (value === '') return;
          const reps = getReps(log, exId, side as Side, i);
          byPosition.set(positionKey(exId, side as Side, i), { value, reps });
        });
      }
    }
  }
  return byPosition;
}

export function positionKey(exId: string, side: Side, i: number): string {
  return `${exId}:${side}:${i}`;
}

export function setVal(
  logs: WorkoutLog[],
  date: string,
  dayId: string,
  exId: string,
  side: Side,
  i: number,
  value: string,
  reps = '',
): WorkoutLog[] {
  return upsert(logs, date, dayId, (log) => {
    const sideVals = [...(log.vals[exId]?.[side] ?? [])];
    sideVals[i] = value;
    const next = { ...log, vals: { ...log.vals, [exId]: { ...log.vals[exId], [side]: sideVals } } };
    // Reps never outlive their value; and a log that never had any stays without the field.
    const setReps = value === '' ? '' : reps;
    if (setReps === '' && !log.reps?.[exId]?.[side]) return next;
    const sideReps = [...(log.reps?.[exId]?.[side] ?? [])];
    sideReps[i] = setReps;
    return { ...next, reps: { ...log.reps, [exId]: { ...log.reps?.[exId], [side]: sideReps } } };
  });
}

export function getRating(log: WorkoutLog | undefined, exId: string): Rating | undefined {
  return log?.ratings?.[exId];
}

/** Sets or, with null, removes one exercise's rating; the field stays as {} once it existed. */
export function setRating(
  logs: WorkoutLog[],
  date: string,
  dayId: string,
  exId: string,
  rating: Rating | null,
): WorkoutLog[] {
  return upsert(logs, date, dayId, (log) => {
    const ratings = { ...log.ratings };
    if (rating) ratings[exId] = rating;
    else delete ratings[exId];
    return { ...log, ratings };
  });
}

export function toggleWarmup(
  logs: WorkoutLog[],
  date: string,
  dayId: string,
  index: number,
): WorkoutLog[] {
  return upsert(logs, date, dayId, (log) => {
    const warm = [...log.warm];
    warm[index] = !warm[index];
    return { ...log, warm };
  });
}

/** Applies `updater` to the log for this day, starting an empty one if none exists yet. */
function upsert(
  logs: WorkoutLog[],
  date: string,
  dayId: string,
  updater: (log: WorkoutLog) => WorkoutLog,
): WorkoutLog[] {
  const existing = findLog(logs, date, dayId);
  const next = updater(existing ?? { date, dayId, vals: {}, warm: [] });
  return existing ? logs.map((s) => (s === existing ? next : s)) : [...logs, next];
}

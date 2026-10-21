import type { Side, WorkoutLog } from '../types';

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

/**
 * The most recent entry for one position before `beforeDate`, across every logged workout.
 *
 * Built once per render as a lookup rather than scanned per set: the exercise view asks for this
 * on every chip, and the log grows without bound.
 */
export function lastValues(logs: WorkoutLog[], beforeDate: string): Map<string, string> {
  const byPosition = new Map<string, string>();
  const earlier = logs
    .filter((s) => s.date < beforeDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Ascending, so a later workout overwrites an earlier one for the same position.
  for (const log of earlier) {
    for (const [exId, sides] of Object.entries(log.vals)) {
      for (const [side, values] of Object.entries(sides)) {
        values?.forEach((value, i) => {
          if (value !== '') byPosition.set(positionKey(exId, side as Side, i), value);
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
): WorkoutLog[] {
  return upsert(logs, date, dayId, (log) => {
    const sideVals = [...(log.vals[exId]?.[side] ?? [])];
    sideVals[i] = value;
    return { ...log, vals: { ...log.vals, [exId]: { ...log.vals[exId], [side]: sideVals } } };
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

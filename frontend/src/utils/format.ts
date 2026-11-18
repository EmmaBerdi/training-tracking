import type { ExerciseType } from '../types';
import { QUICK, UNIT } from '../data/constants';

// de-CH, matching the app's Swiss spelling: a decimal point, as the values are typed in.
const NUMBER = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 1 });
const PRECISE = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 2 });

/** A charted value in its unit; a band's step goes back to its colour name. */
export function formatValue(value: number, type: ExerciseType): string {
  if (type === 'band') return String(QUICK.band?.[Math.round(value) - 1] ?? '');
  return `${(type === 'm' ? PRECISE : NUMBER).format(value)} ${UNIT[type]}`;
}

/** A change with its sign, "+7.5 kg" / "−2 Sek" / "±0 kg", its size written by `format`. */
export function formatSigned(delta: number, format: (size: number) => string): string {
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
  return `${sign}${format(Math.abs(delta))}`;
}

/** A change of a charted value in its unit; for bands the number of steps. */
export function formatDelta(delta: number, type: ExerciseType): string {
  return formatSigned(delta, (size) =>
    type === 'band'
      ? `${size} ${size === 1 ? 'Stufe' : 'Stufen'}`
      : `${(type === 'm' ? PRECISE : NUMBER).format(size)} ${UNIT[type]}`,
  );
}

/** A logged set with the reps done at it, "60 × 8"; just the value where none were logged. */
export function formatSet(value: string, reps: string | number | null | undefined): string {
  return value && reps ? `${value} × ${reps}` : value;
}

/** A plain amount without unit, for volumes and counts. */
export function formatNumber(value: number): string {
  return NUMBER.format(value);
}

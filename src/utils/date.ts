/** YYYY-MM-DD in lokaler Zeitzone (nicht UTC, wie es `toISOString()` allein liefern würde). */
export function isoDate(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Heute als `YYYY-MM-DD`. */
export function today(): string {
  return isoDate(new Date());
}

/** Montag=0 … Sonntag=6, unabhängig von der Locale (`Date#getDay()` liefert Sonntag=0). */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Neues Datum, `days` Tage nach `d` (negativ = davor), ohne `d` zu verändern. */
function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** `YYYY-MM-DD` als lokales Datum, ohne die UTC-Verschiebung von `new Date(iso)`. */
function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Erster Tag des 6×7-Rasters (montagsbeginnend) für den Monat, der `d` enthält. */
function gridStart(d: Date): Date {
  const firstOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  return addDays(firstOfMonth, -mondayIndex(firstOfMonth));
}

/** Die 42 Tage (6 Wochen × 7 Tage, montagsbeginnend) des Monatsrasters, das `d` enthält — inklusive Auffüll-Tagen aus Nachbarmonaten. */
export function monthGrid(d: Date): Date[] {
  const start = gridStart(d);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** `from`/`to`-Grenzen (YYYY-MM-DD) des kompletten 42-Tage-Rasters, nicht nur des strengen Kalendermonats. */
export function monthRange(d: Date): { from: string; to: string } {
  const grid = monthGrid(d);
  return { from: isoDate(grid[0]), to: isoDate(grid[grid.length - 1]) };
}

/** ISO-Kalenderwoche (KW) von `iso`: die Woche mit dem 4. Januar ist KW 1, Wochen beginnen montags. */
export function isoWeek(iso: string): number {
  const d = parseIso(iso);
  const thursday = addDays(d, 3 - mondayIndex(d));
  const jan4 = new Date(thursday.getFullYear(), 0, 4);
  const firstThursday = addDays(jan4, 3 - mondayIndex(jan4));
  // Gerundet, weil eine Zeitumstellung dazwischen den Abstand um eine Stunde verschiebt.
  return 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

/** Neues Datum, `delta` Monate nach `d` versetzt (negativ = davor); Tag wird auf den 1. gesetzt. */
export function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });

/** z.B. "August 2026". */
export function formatMonthLabel(d: Date): string {
  return MONTH_LABEL_FORMAT.format(d);
}

/** Wochentagskürzel, montagsbeginnend — passend zum Kalenderraster. */
export const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Bit eines Wochentags in der Maske einer wöchentlichen Regel: Mo=1, Di=2 … So=64. */
export function weekdayBit(iso: string): number {
  return 1 << mondayIndex(parseIso(iso));
}

const DAY_LABEL_FORMAT = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' });

/** z.B. "24.08." */
export function formatDayLabel(iso: string): string {
  return DAY_LABEL_FORMAT.format(parseIso(iso));
}

/** z.B. "Mo" */
export function formatWeekday(iso: string): string {
  return WEEKDAY_SHORT[mondayIndex(parseIso(iso))];
}

/** Liegt `iso` im Kalendermonat von `d`? */
export function isSameMonth(iso: string, d: Date): boolean {
  const parsed = parseIso(iso);
  return parsed.getFullYear() === d.getFullYear() && parsed.getMonth() === d.getMonth();
}

/** Kurzform für die Tab-Leiste, z.B. "Mo 24." — der Monat steht im Kopf darüber. */
export function formatTabDate(iso: string): string {
  return `${formatWeekday(iso)} ${parseIso(iso).getDate()}.`;
}

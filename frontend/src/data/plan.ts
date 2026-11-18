import type { Plan } from '../types';

export const uid = (): string => Math.random().toString(36).slice(2, 9);

/** Ein frisch angelegtes Konto startet leer — die Pläne baut sich jede Nutzerin selbst. */
export function emptyPlan(): Plan {
  return { warmup: [], days: [] };
}

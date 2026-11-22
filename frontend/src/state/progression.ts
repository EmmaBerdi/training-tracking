import type { Effort, Exercise, ProgressionStep, WorkoutLog } from '../types';
import { weekStart } from '../utils/date';
import { currentStep } from './planOps';

export interface StepSuggestion {
  /** Index of the step to move up to. */
  index: number;
  step: ProgressionStep;
  /** How the current step felt in the last week it was done, oldest first. */
  efforts: Effort[];
}

/**
 * Whether to offer moving up to the next step: once a new calendar week has started since the
 * current step was last rated. Never on the last step, and never before the current step has been
 * rated at all; a rating this week (today's included) means the week is already decided.
 */
export function suggestNextStep(
  x: Exercise,
  logs: WorkoutLog[],
  date: string,
): StepSuggestion | null {
  const steps = x.steps ?? [];
  const at = x.step ?? 0;
  const step = currentStep(x);
  if (!step || at >= steps.length - 1) return null;

  const rated = logs
    .filter((l) => l.date <= date && l.ratings?.[x.id]?.step === step.name)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!rated.length) return null;
  const lastWeek = weekStart(rated[rated.length - 1].date);
  if (lastWeek >= weekStart(date)) return null;

  return {
    index: at + 1,
    step: steps[at + 1],
    efforts: rated.flatMap((l) => {
      const rating = l.ratings?.[x.id];
      return rating && weekStart(l.date) === lastWeek ? [rating.effort] : [];
    }),
  };
}

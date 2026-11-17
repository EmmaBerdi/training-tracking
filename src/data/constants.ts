import type { BlockKind, ExerciseType } from '../types';

/**
 * How each exercise type is labelled. The keys are the single source of truth for
 * {@link EXERCISE_TYPES} and mirror the CHECK constraint on `exercises.type`.
 */
export const UNIT: Record<ExerciseType, string> = {
  kg: 'kg',
  band: 'Band',
  sek: 'Sek',
  bw: 'Wdh',
  cm: 'cm',
  m: 'm',
  min: 'Min',
};

export const EXERCISE_TYPES = Object.keys(UNIT) as ExerciseType[];

/** Types whose values are picked from a fixed word list instead of typed as a number. */
export const TEXTY: Partial<Record<ExerciseType, true>> = { band: true };

/** Suggested values offered as one-tap chips when logging a set. */
export const QUICK: Record<ExerciseType, (number | string)[]> = {
  kg: [2.5, 5, 7.5, 10, 12.5, 15, 20, 25, 30, 40],
  sek: [10, 15, 20, 30, 40, 45, 60],
  bw: [3, 5, 6, 8, 10, 12, 15, 20],
  cm: [20, 25, 30, 35, 40, 45, 50],
  m: [1.2, 1.4, 1.6, 1.8, 2.0],
  min: [15, 20, 25, 30],
  band: ['gelb', 'rot', 'grün', 'blau', 'schwarz'],
};

/** Block kinds and their labels; the keys mirror the CHECK constraint on `blocks.kind`. */
export const BLOCK_KIND_LABEL: Record<BlockKind, string> = {
  huefte: 'Hüfte',
  skill: 'Skill',
  kraft: 'Kraft',
  explosiv: 'Explosiv',
  core: 'Core',
  ausdauer: 'Ausdauer',
};

/** Photos one exercise can carry; mirrors `ExerciseDto.MAX_IMAGES` on the backend. */
export const MAX_IMAGES = 10;

export const BLOCK_KINDS = Object.keys(BLOCK_KIND_LABEL) as BlockKind[];

import type { BlockKind, Effort, ExerciseType, Mode, Side, UserStatus, View } from '../types';
import type { PhaseKind } from '../state/timerOps';

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
  kcal: 'kcal',
  interval: 'Intervall',
};

export const EXERCISE_TYPES = Object.keys(UNIT) as ExerciseType[];

/**
 * Types whose value is a load, so the reps done with it are logged next to it. For `bw` the value
 * already is the rep count; the remaining types measure something reps don't apply to.
 */
export const WITH_REPS: Partial<Record<ExerciseType, true>> = { kg: true, band: true };

/** The rep counts a set accepts; mirrors the CHECK on `session_value.reps`. */
export const REPS_MIN = 1;
export const REPS_MAX = 999;

/** How a side is named in text; empty for a bilateral exercise, which has none. */
export const SIDE_LABEL: Record<Side, string> = { B: '', L: 'Links', R: 'Rechts' };

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
  kcal: [10, 15, 20, 25, 30, 40, 50],
  band: ['gelb', 'rot', 'grün', 'blau', 'schwarz'],
  // An interval exercise logs no values, only how hard it felt.
  interval: [],
};

/**
 * Types whose sets are summed into a per-workout total, and that total's label. For `bw` the sets
 * are rep counts; for `kcal` each set is one interval round.
 */
export const TOTALLED: Partial<Record<ExerciseType, string>> = {
  bw: 'Wdh gesamt',
  kcal: 'kcal gesamt',
};

/** Effort ratings in rising order; mirrors the CHECK on `session_rating.effort`. */
export const EFFORT_LABEL: Record<Effort, string> = {
  leicht: 'leicht',
  mittel: 'mittel',
  schwer: 'schwer',
};

export const EFFORTS = Object.keys(EFFORT_LABEL) as Effort[];

/** Progression steps one exercise can carry; mirrors `ExerciseDto.MAX_STEPS` on the backend. */
export const MAX_STEPS = 20;

/** Block kinds and their labels; the keys mirror the CHECK constraint on `blocks.kind`. */
export const BLOCK_KIND_LABEL: Record<BlockKind, string> = {
  huefte: 'Hüfte',
  skill: 'Skill',
  kraft: 'Kraft',
  explosiv: 'Explosiv',
  core: 'Core',
  ausdauer: 'Ausdauer',
};

/** A button in the bottom bar: the two training modes, then the other views. */
export type NavTarget = Mode | Exclude<View, 'training'>;

/** The bottom bar's buttons, in bar order; the introduction names them the same way. */
export const NAV: Record<NavTarget, { icon: string; label: string }> = {
  log: { icon: '◉', label: 'Protokoll' },
  edit: { icon: '◎', label: 'Plan' },
  calendar: { icon: '▦', label: 'Kalender' },
  stats: { icon: '▥', label: 'Statistik' },
};

/** The longest phase a timer accepts, in seconds; mirrors the CHECKs on `interval_timer`. */
export const TIMER_MAX_SEC = 3600;

/** Intervals one timer's round can hold; mirrors `IntervalTimerRequest.MAX_STEPS` on the backend. */
export const TIMER_MAX_STEPS = 20;

/** What the run screen calls each phase of a timer. */
export const PHASE_LABEL: Record<PhaseKind, string> = {
  prepare: 'Vorbereiten',
  work: 'Arbeit',
  rest: 'Pause',
};

/** Photos one exercise can carry; mirrors `ExerciseDto.MAX_IMAGES` on the backend. */
export const MAX_IMAGES = 10;

/** Named account states, so no code compares against a bare `'invited'`. */
export const USER_STATUS = {
  invited: 'invited',
  active: 'active',
  deactivated: 'deactivated',
} as const satisfies Record<UserStatus, UserStatus>;

export const BLOCK_KINDS = Object.keys(BLOCK_KIND_LABEL) as BlockKind[];

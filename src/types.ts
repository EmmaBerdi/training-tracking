export type ExerciseType = 'kg' | 'band' | 'sek' | 'bw' | 'cm' | 'm' | 'min';

export type BlockKind = 'huefte' | 'skill' | 'kraft' | 'explosiv' | 'core' | 'ausdauer';

export type Side = 'B' | 'L' | 'R';

interface ExerciseBase {
  id: string;
  name: string;
  type: ExerciseType;
  reps: string;
  note?: string;
  desc?: string;
  /**
   * The setup photo, held as the id the upload answered with rather than as bytes: every plan edit
   * re-sends the whole plan, and the picture itself lives on the backend under this id.
   */
  imageId?: string;
}

export interface BilateralExercise extends ExerciseBase {
  uni: false;
  sets: number;
}

export interface UnilateralExercise extends ExerciseBase {
  uni: true;
  setsL: number;
  setsR: number;
}

export type Exercise = BilateralExercise | UnilateralExercise;

export interface Block {
  kind: BlockKind;
  name: string;
  ex: Exercise[];
}

export interface Day {
  id: string;
  short: string;
  /** The activity this plan is a workout for; scheduling offers a type's plans under that type. */
  sessionTypeId: number;
  title: string;
  blocks: Block[];
}

export interface Plan {
  warmup: string[];
  days: Day[];
}

/** Values logged for one exercise, keyed by side; each array is indexed by set number. */
export type SessionValues = Partial<Record<Side, string[]>>;

/** One logged workout: what was entered on `date` against the plan `dayId`. */
export interface WorkoutLog {
  date: string;
  dayId: string;
  vals: Record<string, SessionValues>;
  warm: boolean[];
}

export interface AppState {
  plan: Plan;
  logs: WorkoutLog[];
}

/** Identifies one block within the plan: the block at `index` on `dayId`. */
export interface BlockRef {
  dayId: string;
  index: number;
}

export type Mode = 'log' | 'edit';

export type PlannedSessionStatus = 'planned' | 'done' | 'skipped';

export interface SessionType {
  id: number;
  label: string;
  color?: string;
  icon?: string;
  /** True = user-created and deletable; false = seeded default, shared by every account. */
  custom: boolean;
}

export interface PlannedSession {
  id: number;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  sessionTypeId: number;
  dayId?: string; // optional link to a structured plan Day, chosen when scheduling
  status: PlannedSessionStatus;
  notes?: string;
  /** Set when this session is one occurrence of a series; drives the "nur dieser Termin?" prompt. */
  ruleId?: number;
  /** True when that series rotates its plans, so skipping asks what happens to the missed plan. */
  rotating?: boolean;
}

/** Weekday bits in a weekly rule's mask: Mo=1, Di=2, Mi=4, Do=8, Fr=16, Sa=32, So=64. */
export type WeekdayMask = number;

export type RecurrencePattern = 'weekly' | 'interval';

/**
 * Which workout each date of a series gets. The pattern says *when* the series trains, this says
 * *what*: the same plan every time, one plan per weekday, or the next plan of a rotation.
 */
export type PlanMode = 'fixed' | 'weekday' | 'rotation';

/** One plan slot: `position` is the weekday index (Mo=0) for 'weekday', the cycle step for 'rotation'. */
export interface RulePlan {
  position: number;
  dayId: string;
}

export interface RecurringRule {
  id: number;
  sessionTypeId: number;
  /** The pinned plan; only used by planMode 'fixed'. */
  dayId?: string;
  time?: string;
  notes?: string;
  pattern: RecurrencePattern;
  weekdays?: WeekdayMask;
  intervalDays?: number;
  startDate: string;
  endDate?: string;
  planMode: PlanMode;
  /** Empty for 'fixed'; keyed by weekday for 'weekday'; in cycle order for 'rotation'. */
  plans: RulePlan[];
}

/** Everything needed to create a recurring rule; the id is assigned by the backend. */
export type NewRecurringRule = Omit<RecurringRule, 'id'>;

/** Redefining a series: `from` is the first date the new definition applies to (default today). */
export type RuleUpdate = Omit<NewRecurringRule, 'startDate'> & { from?: string };

/** Which occurrences an edit to a series applies to. */
export type EditScope = 'one' | 'future';

/**
 * What skipping or deleting one occurrence of a rotation does to the plans after it: `hold` lets
 * the missed slot burn its cycle step, `shift` carries the missed plan over to the next date.
 */
export type Rotation = 'hold' | 'shift';

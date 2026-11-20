import type {
  BilateralExercise,
  Block,
  BlockKind,
  BlockRef,
  Day,
  Exercise,
  Plan,
  ProgressionStep,
  SessionType,
  Side,
  UnilateralExercise,
} from '../types';
import { uid } from '../data/plan';
import { MAX_STEPS } from '../data/constants';

function newExercise(): BilateralExercise {
  return { id: uid(), name: 'Neue Übung', type: 'kg', uni: false, sets: 3, reps: '8' };
}

/** Undefined when nothing is selected, or the selected plan is gone. */
export function curDay(plan: Plan, dayId: string): Day | undefined {
  return plan.days.find((d) => d.id === dayId);
}

export function findExercise(plan: Plan, id: string): Exercise | null {
  for (const day of plan.days) {
    for (const block of day.blocks) {
      const found = block.ex.find((x) => x.id === id);
      if (found) return found;
    }
  }
  return null;
}

/** Every exercise of a plan, block by block. */
export function dayExercises(day: Day): Exercise[] {
  return day.blocks.flatMap((b) => b.ex);
}

/** The progression step the exercise is at; undefined without steps. */
export function currentStep(x: Exercise): ProgressionStep | undefined {
  return x.steps?.[x.step ?? 0];
}

/**
 * The sides an exercise is logged on, with their set counts; a side without sets is left out. The
 * current step's set count replaces the plan's on every side the plan trains.
 */
export function exerciseTracks(x: Exercise): { side: Side; count: number }[] {
  const stepSets = currentStep(x)?.sets;
  if (!x.uni) return [{ side: 'B', count: stepSets ?? x.sets }];
  return [
    { side: 'L' as Side, count: x.setsL },
    { side: 'R' as Side, count: x.setsR },
  ]
    .filter((t) => t.count > 0)
    .map((t) => ({ ...t, count: stepSets ?? t.count }));
}

/** The rep text in force: the current step's, else the plan's. */
export function exerciseReps(x: Exercise): string {
  return currentStep(x)?.reps || x.reps;
}

/** Sets × reps as currently planned, "3 × 8" or "3/2 × 8" for left/right. */
export function exerciseSpec(x: Exercise): string {
  const counts = exerciseTracks(x).map((t) => t.count);
  const sets = x.uni ? `${counts[0] ?? 0}/${counts[1] ?? 0}` : `${counts[0]}`;
  return `${sets} × ${exerciseReps(x)}`;
}

export type PlanRepsHint = { kind: 'single'; reps: number } | { kind: 'range'; reps: number[] };

/**
 * What a plan's rep text suggests for one set: a single count ("8") to prefill, or the counts of a
 * range ("6-8") to offer. Anything else ("max", "8/Seite") suggests nothing.
 */
export function planRepsHint(planReps: string): PlanRepsHint | null {
  const single = /^\s*(\d{1,3})\s*$/.exec(planReps);
  if (single) return { kind: 'single', reps: Number(single[1]) };
  const range = /^\s*(\d{1,3})\s*[-–]\s*(\d{1,3})\s*$/.exec(planReps);
  if (!range) return null;
  const [from, to] = [Number(range[1]), Number(range[2])];
  // A wide range ("5-20") would be a wall of chips; past a handful, typing is quicker.
  if (to <= from || to - from > 5) return null;
  return { kind: 'range', reps: Array.from({ length: to - from + 1 }, (_, i) => from + i) };
}

/**
 * The plans offered when scheduling a session of one type. A plan in `keep` stays listed even if it
 * belongs to another type, so opening an entry that predates the binding never silently drops it.
 */
export function plansForType(
  days: Day[],
  sessionTypeId: number | null,
  keep: string[] = [],
): Day[] {
  return days.filter((d) => d.sessionTypeId === sessionTypeId || keep.includes(d.id));
}

/** Plans grouped by their type, in the order the types are listed; plan order holds within a type. */
export function sortByType(days: Day[], types: SessionType[]): Day[] {
  const rank = new Map(types.map((t, i) => [t.id, i]));
  const of = (d: Day) => rank.get(d.sessionTypeId) ?? types.length;
  return [...days].sort((a, b) => of(a) - of(b));
}

export function addDay(plan: Plan, day: Day): Plan {
  return { ...plan, days: [...plan.days, day] };
}

export function updateDay(
  plan: Plan,
  dayId: string,
  patch: { title: string; short: string; sessionTypeId: number },
): Plan {
  return {
    ...plan,
    days: plan.days.map((d) => (d.id === dayId ? { ...d, ...patch } : d)),
  };
}

export function deleteDay(plan: Plan, dayId: string): Plan {
  return { ...plan, days: plan.days.filter((d) => d.id !== dayId) };
}

function withDay(plan: Plan, dayId: string, updater: (day: Day) => Day): Plan {
  return { ...plan, days: plan.days.map((d) => (d.id === dayId ? updater(d) : d)) };
}

function withBlock(plan: Plan, ref: BlockRef, updater: (block: Block) => Block): Plan {
  return withDay(plan, ref.dayId, (d) => ({
    ...d,
    blocks: d.blocks.map((b, i) => (i === ref.index ? updater(b) : b)),
  }));
}

export function addBlockToDay(plan: Plan, dayId: string): Plan {
  return withDay(plan, dayId, (d) => ({
    ...d,
    blocks: [...d.blocks, { kind: 'core', name: 'Neuer Block', ex: [newExercise()] }],
  }));
}

export function deleteBlock(plan: Plan, ref: BlockRef): Plan {
  return withDay(plan, ref.dayId, (d) => ({
    ...d,
    blocks: d.blocks.filter((_, i) => i !== ref.index),
  }));
}

export function moveBlock(plan: Plan, ref: BlockRef, dir: -1 | 1): Plan {
  return withDay(plan, ref.dayId, (d) => {
    const target = ref.index + dir;
    if (target < 0 || target >= d.blocks.length) return d;
    const blocks = [...d.blocks];
    const [item] = blocks.splice(ref.index, 1);
    blocks.splice(target, 0, item);
    return { ...d, blocks };
  });
}

export function setBlockName(plan: Plan, ref: BlockRef, name: string): Plan {
  return withBlock(plan, ref, (b) => ({ ...b, name }));
}

export function setBlockKind(plan: Plan, ref: BlockRef, kind: BlockKind): Plan {
  return withBlock(plan, ref, (b) => ({ ...b, kind }));
}

export function addExercise(plan: Plan, ref: BlockRef): Plan {
  return withBlock(plan, ref, (b) => ({ ...b, ex: [...b.ex, newExercise()] }));
}

export function deleteExercise(plan: Plan, ref: BlockRef, exId: string): Plan {
  return withBlock(plan, ref, (b) => ({ ...b, ex: b.ex.filter((x) => x.id !== exId) }));
}

export function moveExercise(plan: Plan, ref: BlockRef, exId: string, dir: -1 | 1): Plan {
  return withBlock(plan, ref, (b) => {
    const idx = b.ex.findIndex((x) => x.id === exId);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= b.ex.length) return b;
    const ex = [...b.ex];
    const [item] = ex.splice(idx, 1);
    ex.splice(target, 0, item);
    return { ...b, ex };
  });
}

export type ExerciseTextField = 'name' | 'reps' | 'note' | 'desc';

export type ExerciseSetsField = 'sets' | 'setsL' | 'setsR';

function convertUni(x: Exercise, uni: boolean): Exercise {
  if (x.uni === uni) return x;
  const { id, name, type, reps, note, desc, imageIds, steps, step } = x;
  const base = { id, name, type, reps, note, desc, imageIds, steps, step };
  if (uni) {
    const fallback = (x as BilateralExercise).sets || 3;
    return { ...base, uni: true, setsL: fallback, setsR: fallback };
  }
  const ux = x as UnilateralExercise;
  const fallback = Math.max(ux.setsL || 0, ux.setsR || 0) || 3;
  return { ...base, uni: false, sets: fallback };
}

function withExercise(
  plan: Plan,
  ref: BlockRef,
  exId: string,
  updater: (exercise: Exercise) => Exercise,
): Plan {
  return withBlock(plan, ref, (b) => ({
    ...b,
    ex: b.ex.map((x) => (x.id === exId ? updater(x) : x)),
  }));
}

export function setExerciseUni(plan: Plan, ref: BlockRef, exId: string, uni: boolean): Plan {
  return withExercise(plan, ref, exId, (x) => convertUni(x, uni));
}

export function setExerciseType(
  plan: Plan,
  ref: BlockRef,
  exId: string,
  type: Exercise['type'],
): Plan {
  return withExercise(plan, ref, exId, (x) => ({ ...x, type }));
}

export function setExerciseText(
  plan: Plan,
  ref: BlockRef,
  exId: string,
  field: ExerciseTextField,
  value: string,
): Plan {
  return withExercise(plan, ref, exId, (x) => ({ ...x, [field]: value }));
}

/** Appends after the photos already there, so a new picture never reorders the old ones. */
export function addExerciseImages(
  plan: Plan,
  ref: BlockRef,
  exId: string,
  imageIds: string[],
): Plan {
  return withExercise(plan, ref, exId, (x) => ({
    ...x,
    imageIds: [...(x.imageIds ?? []), ...imageIds],
  }));
}

/** The backend collects the picture itself once nothing points at it any more. */
export function removeExerciseImage(
  plan: Plan,
  ref: BlockRef,
  exId: string,
  imageId: string,
): Plan {
  return withExercise(plan, ref, exId, (x) => ({
    ...x,
    imageIds: (x.imageIds ?? []).filter((id) => id !== imageId),
  }));
}

export function setExerciseSets(
  plan: Plan,
  ref: BlockRef,
  exId: string,
  field: ExerciseSetsField,
  value: number,
): Plan {
  const clamped = Math.min(99, Math.max(0, value || 0));
  return withExercise(plan, ref, exId, (x) => ({ ...x, [field]: clamped }) as Exercise);
}

export type StepField = 'name' | 'sets' | 'reps' | 'text';

/** A new step after the last, named for the week it would usually be: W1, W2, … */
export function addExerciseStep(plan: Plan, ref: BlockRef, exId: string): Plan {
  return withExercise(plan, ref, exId, (x) => {
    const steps = x.steps ?? [];
    if (steps.length >= MAX_STEPS) return x;
    return { ...x, steps: [...steps, { name: `W${steps.length + 1}` }], step: x.step ?? 0 };
  });
}

/** An emptied field falls back to the plan's value, so it is dropped rather than kept as ''. */
export function setExerciseStepField(
  plan: Plan,
  ref: BlockRef,
  exId: string,
  index: number,
  field: StepField,
  value: string,
): Plan {
  return withExercise(plan, ref, exId, (x) => ({
    ...x,
    steps: (x.steps ?? []).map((s, i) => {
      if (i !== index) return s;
      if (field === 'name') return { ...s, name: value };
      const next = { ...s };
      if (value.trim() === '') delete next[field];
      else if (field === 'sets')
        next.sets = Math.min(99, Math.max(0, Math.round(Number(value)) || 0));
      else next[field] = value;
      return next;
    }),
  }));
}

/** Keeps the exercise on the step it was at; removing that step lands on the one taking its place. */
export function removeExerciseStep(plan: Plan, ref: BlockRef, exId: string, index: number): Plan {
  return withExercise(plan, ref, exId, (x) => {
    const steps = (x.steps ?? []).filter((_, i) => i !== index);
    if (!steps.length) return { ...x, steps: [], step: undefined };
    const at = x.step ?? 0;
    const step = Math.min(index < at ? at - 1 : at, steps.length - 1);
    return { ...x, steps, step };
  });
}

export function setExerciseStep(plan: Plan, ref: BlockRef, exId: string, index: number): Plan {
  return withExercise(plan, ref, exId, (x) =>
    index >= 0 && index < (x.steps?.length ?? 0) ? { ...x, step: index } : x,
  );
}

export function addWarmupItem(plan: Plan): Plan {
  return { ...plan, warmup: [...plan.warmup, 'Neuer Punkt'] };
}

export function deleteWarmupItem(plan: Plan, index: number): Plan {
  return { ...plan, warmup: plan.warmup.filter((_, i) => i !== index) };
}

export function moveWarmupItem(plan: Plan, index: number, dir: -1 | 1): Plan {
  const target = index + dir;
  if (target < 0 || target >= plan.warmup.length) return plan;
  const warmup = [...plan.warmup];
  const [item] = warmup.splice(index, 1);
  warmup.splice(target, 0, item);
  return { ...plan, warmup };
}

export function setWarmupText(plan: Plan, index: number, value: string): Plan {
  return { ...plan, warmup: plan.warmup.map((w, i) => (i === index ? value : w)) };
}

import type {
  BilateralExercise,
  Block,
  BlockKind,
  BlockRef,
  Day,
  Exercise,
  Plan,
  SessionType,
  UnilateralExercise,
} from '../types';
import { uid } from '../data/plan';

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
  const { id, name, type, reps, note, desc, imageId } = x;
  const base = { id, name, type, reps, note, desc, imageId };
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

/** `imageId` undefined removes the picture; the backend collects it once nothing points at it. */
export function setExerciseImage(
  plan: Plan,
  ref: BlockRef,
  exId: string,
  imageId: string | undefined,
): Plan {
  return withExercise(plan, ref, exId, (x) => ({ ...x, imageId }));
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

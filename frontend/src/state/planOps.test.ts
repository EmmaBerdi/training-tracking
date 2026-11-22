import { describe, expect, it } from 'vitest';
import type { BilateralExercise, Day, Plan, UnilateralExercise } from '../types';
import * as planOps from './planOps';

function exercise(id: string, over: Partial<BilateralExercise> = {}): BilateralExercise {
  return { id, name: id, type: 'kg', uni: false, sets: 3, reps: '8', ...over };
}

function day(id: string, over: Partial<Day> = {}): Day {
  return {
    id,
    short: id.toUpperCase(),
    sessionTypeId: 2,
    title: `Plan ${id}`,
    blocks: [{ kind: 'core', name: 'Block', ex: [exercise('a'), exercise('b')] }],
    ...over,
  };
}

function plan(...days: Day[]): Plan {
  return { warmup: ['Hüfte kreisen'], days };
}

const FIRST_BLOCK = { dayId: 'mo', index: 0 };

describe('plans', () => {
  it('adds, renames and removes a plan without touching its siblings', () => {
    let p = plan(day('mo'), day('di'));

    p = planOps.updateDay(p, 'mo', { title: 'Oberkörper', short: 'OK', sessionTypeId: 3 });
    expect(p.days[0]).toMatchObject({ title: 'Oberkörper', short: 'OK', sessionTypeId: 3 });
    expect(p.days[1].title).toBe('Plan di');

    p = planOps.deleteDay(p, 'mo');
    expect(p.days.map((d) => d.id)).toEqual(['di']);
  });

  it('offers only the plans of the chosen type, plus any plan already attached', () => {
    const days = [day('ok', { sessionTypeId: 2 }), day('lauf', { sessionTypeId: 1 })];

    expect(planOps.plansForType(days, 2).map((d) => d.id)).toEqual(['ok']);
    expect(planOps.plansForType(days, 5)).toEqual([]);
    expect(planOps.plansForType(days, 2, ['lauf']).map((d) => d.id)).toEqual(['ok', 'lauf']);
  });

  it('groups plans by type in the order the types are listed', () => {
    const types = [
      { id: 1, label: 'Laufen', custom: false },
      { id: 2, label: 'Kraft', custom: false },
    ];
    const days = [
      day('a', { sessionTypeId: 2 }),
      day('b', { sessionTypeId: 9 }),
      day('c', { sessionTypeId: 1 }),
      day('d', { sessionTypeId: 2 }),
    ];

    expect(planOps.sortByType(days, types).map((d) => d.id)).toEqual(['c', 'a', 'd', 'b']);
  });

  it('leaves the plan untouched when the target day does not exist', () => {
    const p = plan(day('mo'));
    expect(planOps.deleteDay(p, 'nope')).toEqual(p);
  });

  it('finds an exercise anywhere in the plan, and reports a missing one as null', () => {
    const p = plan(day('mo'), day('di'));
    expect(planOps.findExercise(p, 'b')?.id).toBe('b');
    expect(planOps.findExercise(p, 'zz')).toBeNull();
  });

  it('does not mutate the plan it was given', () => {
    const p = plan(day('mo'));
    const snapshot = structuredClone(p);
    planOps.addExercise(p, FIRST_BLOCK);
    planOps.deleteDay(p, 'mo');
    planOps.setBlockName(p, FIRST_BLOCK, 'Anders');
    expect(p).toEqual(snapshot);
  });
});

describe('blocks', () => {
  it('adds a block with one starter exercise', () => {
    const p = planOps.addBlockToDay(plan(day('mo')), 'mo');
    expect(p.days[0].blocks).toHaveLength(2);
    expect(p.days[0].blocks[1]).toMatchObject({ kind: 'core', name: 'Neuer Block' });
    expect(p.days[0].blocks[1].ex).toHaveLength(1);
  });

  it('renames and retypes a block in place', () => {
    let p = plan(day('mo'));
    p = planOps.setBlockName(p, FIRST_BLOCK, 'Zieharbeit');
    p = planOps.setBlockKind(p, FIRST_BLOCK, 'kraft');
    expect(p.days[0].blocks[0]).toMatchObject({ name: 'Zieharbeit', kind: 'kraft' });
  });

  it('deletes a block by position', () => {
    const twoBlocks = day('mo', {
      blocks: [
        { kind: 'core', name: 'First', ex: [] },
        { kind: 'kraft', name: 'Second', ex: [] },
      ],
    });
    const p = planOps.deleteBlock(plan(twoBlocks), { dayId: 'mo', index: 0 });
    expect(p.days[0].blocks.map((b) => b.name)).toEqual(['Second']);
  });

  it('reorders blocks and refuses to move past either end', () => {
    const twoBlocks = day('mo', {
      blocks: [
        { kind: 'core', name: 'First', ex: [] },
        { kind: 'kraft', name: 'Second', ex: [] },
      ],
    });
    const p = plan(twoBlocks);
    expect(planOps.moveBlock(p, { dayId: 'mo', index: 0 }, 1).days[0].blocks[0].name).toBe(
      'Second',
    );
    expect(planOps.moveBlock(p, { dayId: 'mo', index: 0 }, -1)).toEqual(p);
    expect(planOps.moveBlock(p, { dayId: 'mo', index: 1 }, 1)).toEqual(p);
  });
});

describe('exercises', () => {
  it('reorders within a block and refuses to move past either end', () => {
    const p = plan(day('mo'));
    expect(planOps.moveExercise(p, FIRST_BLOCK, 'a', 1).days[0].blocks[0].ex[0].id).toBe('b');
    expect(planOps.moveExercise(p, FIRST_BLOCK, 'a', -1)).toEqual(p);
    expect(planOps.moveExercise(p, FIRST_BLOCK, 'b', 1)).toEqual(p);
  });

  it('ignores a move for an exercise that is not in the block', () => {
    const p = plan(day('mo'));
    expect(planOps.moveExercise(p, FIRST_BLOCK, 'ghost', 1)).toEqual(p);
  });

  it('clamps set counts into the range the backend accepts', () => {
    let p = plan(day('mo'));
    p = planOps.setExerciseSets(p, FIRST_BLOCK, 'a', 'sets', -4);
    expect((p.days[0].blocks[0].ex[0] as BilateralExercise).sets).toBe(0);
    p = planOps.setExerciseSets(p, FIRST_BLOCK, 'a', 'sets', 500);
    expect((p.days[0].blocks[0].ex[0] as BilateralExercise).sets).toBe(99);
    p = planOps.setExerciseSets(p, FIRST_BLOCK, 'a', 'sets', Number.NaN);
    expect((p.days[0].blocks[0].ex[0] as BilateralExercise).sets).toBe(0);
  });

  it('carries the set count across a switch to per-side tracking, and back', () => {
    const p = plan(
      day('mo', { blocks: [{ kind: 'core', name: 'B', ex: [exercise('a', { sets: 4 })] }] }),
    );

    const uni = planOps.setExerciseUni(p, FIRST_BLOCK, 'a', true);
    expect(uni.days[0].blocks[0].ex[0]).toMatchObject({ uni: true, setsL: 4, setsR: 4 });

    const back = planOps.setExerciseUni(uni, FIRST_BLOCK, 'a', false);
    expect(back.days[0].blocks[0].ex[0]).toMatchObject({ uni: false, sets: 4 });
  });

  it('takes the larger side when collapsing back to a single set count', () => {
    const unilateral: UnilateralExercise = {
      id: 'a',
      name: 'a',
      type: 'kg',
      reps: '8',
      uni: true,
      setsL: 2,
      setsR: 5,
    };
    const p = plan(day('mo', { blocks: [{ kind: 'core', name: 'B', ex: [unilateral] }] }));

    const back = planOps.setExerciseUni(p, FIRST_BLOCK, 'a', false);
    expect(back.days[0].blocks[0].ex[0]).toMatchObject({ uni: false, sets: 5 });
  });

  it('is a no-op when the side mode already matches', () => {
    const p = plan(day('mo'));
    expect(planOps.setExerciseUni(p, FIRST_BLOCK, 'a', false)).toEqual(p);
  });

  it('appends and removes pictures without touching their siblings', () => {
    let p = plan(day('mo'));

    p = planOps.addExerciseImages(p, FIRST_BLOCK, 'a', ['img-1']);
    p = planOps.addExerciseImages(p, FIRST_BLOCK, 'a', ['img-2', 'img-3']);
    expect(p.days[0].blocks[0].ex[0].imageIds).toEqual(['img-1', 'img-2', 'img-3']);
    expect(p.days[0].blocks[0].ex[1].imageIds).toBeUndefined();

    p = planOps.removeExerciseImage(p, FIRST_BLOCK, 'a', 'img-2');
    expect(p.days[0].blocks[0].ex[0].imageIds).toEqual(['img-1', 'img-3']);
  });

  it('keeps the pictures when the exercise switches sides', () => {
    let p = plan(day('mo'));
    p = planOps.addExerciseImages(p, FIRST_BLOCK, 'a', ['img-1', 'img-2']);

    const uni = planOps.setExerciseUni(p, FIRST_BLOCK, 'a', true);

    expect(uni.days[0].blocks[0].ex[0]).toMatchObject({
      uni: true,
      imageIds: ['img-1', 'img-2'],
    });
  });
});

describe('warmup', () => {
  it('adds, edits, reorders and removes items', () => {
    let p = plan(day('mo'));
    p = planOps.addWarmupItem(p);
    p = planOps.setWarmupText(p, 1, 'Ausfallschritte');
    expect(p.warmup).toEqual(['Hüfte kreisen', 'Ausfallschritte']);

    p = planOps.moveWarmupItem(p, 1, -1);
    expect(p.warmup).toEqual(['Ausfallschritte', 'Hüfte kreisen']);

    p = planOps.deleteWarmupItem(p, 0);
    expect(p.warmup).toEqual(['Hüfte kreisen']);
  });

  it('refuses to move an item past either end', () => {
    const p = plan(day('mo'));
    expect(planOps.moveWarmupItem(p, 0, -1)).toEqual(p);
    expect(planOps.moveWarmupItem(p, 0, 1)).toEqual(p);
  });
});

describe('planRepsHint', () => {
  it('reads a single count or a short range from the plan, nothing else', () => {
    expect(planOps.planRepsHint('8')).toEqual({ kind: 'single', reps: 8 });
    expect(planOps.planRepsHint(' 6 - 8 ')).toEqual({ kind: 'range', reps: [6, 7, 8] });
    expect(planOps.planRepsHint('5-20')).toBeNull();
    expect(planOps.planRepsHint('max')).toBeNull();
    expect(planOps.planRepsHint('8/Seite')).toBeNull();
  });
});

describe('exerciseTracks', () => {
  it('gives a bilateral exercise one track and drops a side without sets', () => {
    expect(planOps.exerciseTracks(exercise('sq'))).toEqual([{ side: 'B', count: 3 }]);
    const row: UnilateralExercise = {
      id: 'row',
      name: 'row',
      type: 'kg',
      uni: true,
      setsL: 2,
      setsR: 0,
      reps: '8',
    };
    expect(planOps.exerciseTracks(row)).toEqual([{ side: 'L', count: 2 }]);
  });
});

describe('progression steps', () => {
  const steps = [{ name: 'W1', sets: 3, reps: '4' }, { name: 'W2', reps: '5' }, { name: 'Taper' }];

  it('takes sets and reps from the current step, the plan where the step leaves them out', () => {
    const w1 = exercise('a', { sets: 4, reps: '6', steps, step: 0 });
    expect(planOps.exerciseTracks(w1)).toEqual([{ side: 'B', count: 3 }]);
    expect(planOps.exerciseSpec(w1)).toBe('3 × 4');
    expect(planOps.exerciseSpec({ ...w1, step: 1 })).toBe('4 × 5');
    expect(planOps.exerciseSpec({ ...w1, step: 2 })).toBe('4 × 6');
  });

  it('overrides both sides of a left/right exercise, but never adds a side', () => {
    const x: UnilateralExercise = {
      ...exercise('a'),
      uni: true,
      setsL: 3,
      setsR: 0,
      steps: [{ name: 'W1', sets: 2 }],
    };
    expect(planOps.exerciseTracks(x)).toEqual([{ side: 'L', count: 2 }]);
  });

  it('spells out left/right sets in L/R order, even with only the right side trained', () => {
    const x: UnilateralExercise = { ...exercise('a'), uni: true, setsL: 0, setsR: 3 };
    expect(planOps.exerciseSpec(x)).toBe('0/3 × 8');
    expect(planOps.exerciseSpec({ ...x, steps: [{ name: 'W1', sets: 2 }] })).toBe('0/2 × 8');
  });

  it('adds steps named by week and starts on the first', () => {
    let p = plan(day('mo'));
    p = planOps.addExerciseStep(p, FIRST_BLOCK, 'a');
    p = planOps.addExerciseStep(p, FIRST_BLOCK, 'a');
    const x = planOps.findExercise(p, 'a')!;
    expect(x.steps?.map((s) => s.name)).toEqual(['W1', 'W2']);
    expect(x.step).toBe(0);
  });

  it('names a new step after one that is not taken yet', () => {
    let p = plan(day('mo'));
    p = planOps.addExerciseStep(p, FIRST_BLOCK, 'a');
    p = planOps.addExerciseStep(p, FIRST_BLOCK, 'a');
    p = planOps.removeExerciseStep(p, FIRST_BLOCK, 'a', 0);
    p = planOps.addExerciseStep(p, FIRST_BLOCK, 'a');
    expect(planOps.findExercise(p, 'a')!.steps?.map((s) => s.name)).toEqual(['W2', 'W3']);
  });

  it('drops an emptied field so the plan value applies again', () => {
    let p = plan(
      day('mo', { blocks: [{ kind: 'core', name: 'B', ex: [exercise('a', { steps })] }] }),
    );
    p = planOps.setExerciseStepField(p, FIRST_BLOCK, 'a', 0, 'sets', '');
    p = planOps.setExerciseStepField(p, FIRST_BLOCK, 'a', 1, 'sets', '5');
    p = planOps.setExerciseStepField(p, FIRST_BLOCK, 'a', 1, 'text', 'weiter springen');
    p = planOps.setExerciseStepField(p, FIRST_BLOCK, 'a', 0, 'target', '40');
    p = planOps.setExerciseStepField(p, FIRST_BLOCK, 'a', 1, 'target', '42.5');
    p = planOps.setExerciseStepField(p, FIRST_BLOCK, 'a', 0, 'target', ' ');
    const x = planOps.findExercise(p, 'a')!;
    expect(x.steps?.[0]).toEqual({ name: 'W1', reps: '4' });
    expect(x.steps?.[1]).toEqual({
      name: 'W2',
      sets: 5,
      reps: '5',
      text: 'weiter springen',
      target: '42.5',
    });
  });

  it('stays on the same step when another is removed, and clears to [] when none are left', () => {
    let p = plan(
      day('mo', { blocks: [{ kind: 'core', name: 'B', ex: [exercise('a', { steps, step: 2 })] }] }),
    );
    p = planOps.removeExerciseStep(p, FIRST_BLOCK, 'a', 0);
    expect(planOps.findExercise(p, 'a')).toMatchObject({ step: 1 });
    expect(planOps.currentStep(planOps.findExercise(p, 'a')!)?.name).toBe('Taper');

    p = planOps.removeExerciseStep(p, FIRST_BLOCK, 'a', 1);
    expect(planOps.currentStep(planOps.findExercise(p, 'a')!)?.name).toBe('W2');

    p = planOps.removeExerciseStep(p, FIRST_BLOCK, 'a', 0);
    expect(planOps.findExercise(p, 'a')).toMatchObject({ steps: [], step: undefined });
  });

  it('ignores a step index outside the list', () => {
    const p = plan(
      day('mo', { blocks: [{ kind: 'core', name: 'B', ex: [exercise('a', { steps })] }] }),
    );
    expect(planOps.setExerciseStep(p, FIRST_BLOCK, 'a', 3)).toEqual(p);
    expect(planOps.findExercise(planOps.setExerciseStep(p, FIRST_BLOCK, 'a', 2), 'a')?.step).toBe(
      2,
    );
  });

  it('keeps the steps when switching between bilateral and left/right', () => {
    let p = plan(
      day('mo', { blocks: [{ kind: 'core', name: 'B', ex: [exercise('a', { steps, step: 1 })] }] }),
    );
    p = planOps.setExerciseUni(p, FIRST_BLOCK, 'a', true);
    expect(planOps.findExercise(p, 'a')).toMatchObject({ steps, step: 1 });
  });
});

describe('interval exercises', () => {
  const uniExercise = (id: string): UnilateralExercise => ({
    id,
    name: id,
    type: 'kg',
    uni: true,
    setsL: 2,
    setsR: 3,
    reps: '8',
  });

  it('become bilateral when switched to interval, keeping the larger side as rounds', () => {
    let p = plan(day('mo', { blocks: [{ kind: 'core', name: 'B', ex: [uniExercise('a')] }] }));
    p = planOps.setExerciseType(p, FIRST_BLOCK, 'a', 'interval');
    expect(planOps.findExercise(p, 'a')).toMatchObject({ type: 'interval', uni: false, sets: 3 });
  });

  it('log no values, and are planned in rounds — the current step’s when it sets them', () => {
    const x = exercise('a', { type: 'interval', sets: 8 });
    expect(planOps.exerciseTracks(x)).toEqual([]);
    expect(planOps.exerciseSpec(x)).toBe('8 Runden');
    const stepped = { ...x, steps: [{ name: 'W1' }, { name: 'W2', sets: 10 }], step: 1 };
    expect(planOps.intervalRounds(stepped)).toBe(10);
  });

  it('link a timer, and lose it when switched to another type', () => {
    let p = plan(day('mo'));
    p = planOps.setExerciseType(p, FIRST_BLOCK, 'a', 'interval');
    p = planOps.setExerciseTimer(p, FIRST_BLOCK, 'a', 7);
    expect(planOps.findExercise(p, 'a')?.timerId).toBe(7);

    p = planOps.setExerciseUni(p, FIRST_BLOCK, 'a', true);
    expect(planOps.findExercise(p, 'a')?.timerId).toBe(7);

    p = planOps.setExerciseType(p, FIRST_BLOCK, 'a', 'kg');
    expect(planOps.findExercise(p, 'a')?.timerId).toBeUndefined();
  });

  it('count and clear the uses of a timer across every plan', () => {
    const linked = (id: string, timerId: number) => exercise(id, { type: 'interval', timerId });
    let p = plan(
      day('mo', { blocks: [{ kind: 'core', name: 'B', ex: [linked('a', 7), linked('b', 8)] }] }),
      day('di', { blocks: [{ kind: 'core', name: 'B', ex: [linked('c', 7)] }] }),
    );
    expect(planOps.timerUses(p, 7)).toBe(2);

    p = planOps.clearTimer(p, 7);
    expect(planOps.timerUses(p, 7)).toBe(0);
    expect(planOps.findExercise(p, 'b')?.timerId).toBe(8);
  });
});

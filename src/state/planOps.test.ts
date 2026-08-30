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
    slot: 'morgens',
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

    p = planOps.updateDay(p, 'mo', { title: 'Oberkörper', short: 'OK', slot: 'nachmittags' });
    expect(p.days[0]).toMatchObject({ title: 'Oberkörper', short: 'OK', slot: 'nachmittags' });
    expect(p.days[1].title).toBe('Plan di');

    p = planOps.deleteDay(p, 'mo');
    expect(p.days.map((d) => d.id)).toEqual(['di']);
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

  it('attaches and removes a picture without touching its siblings', () => {
    let p = plan(day('mo'));

    p = planOps.setExerciseImage(p, FIRST_BLOCK, 'a', 'img-1');
    expect(p.days[0].blocks[0].ex[0].imageId).toBe('img-1');
    expect(p.days[0].blocks[0].ex[1].imageId).toBeUndefined();

    p = planOps.setExerciseImage(p, FIRST_BLOCK, 'a', undefined);
    expect(p.days[0].blocks[0].ex[0].imageId).toBeUndefined();
  });

  it('keeps the picture when the exercise switches sides', () => {
    let p = plan(day('mo'));
    p = planOps.setExerciseImage(p, FIRST_BLOCK, 'a', 'img-1');

    const uni = planOps.setExerciseUni(p, FIRST_BLOCK, 'a', true);

    expect(uni.days[0].blocks[0].ex[0]).toMatchObject({ uni: true, imageId: 'img-1' });
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

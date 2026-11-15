import { describe, expect, it } from 'vitest';
import type { Plan, SessionType } from '../types';
import {
  importedTypeLabels,
  matchSessionType,
  mergeImport,
  parsePlanImport,
  toDays,
  type ImportedPlan,
} from './planImport';

const VALID = {
  warmup: ['Hip circles 10x', 'Cat-cow'],
  days: [
    {
      short: 'A',
      title: 'Unterkörper',
      sessionType: 'Kraft',
      blocks: [
        {
          kind: 'kraft',
          name: 'Kraft',
          ex: [
            { name: 'Kniebeuge', type: 'kg', uni: false, sets: 4, reps: '6-8', note: 'RPE 8' },
            { name: 'Split Squat', type: 'kg', uni: true, setsL: 3, setsR: 3, reps: 8 },
          ],
        },
      ],
    },
  ],
  schedule: 'Mo/Do',
};

function parse(data: unknown) {
  return parsePlanImport(JSON.stringify(data));
}

function parsed(data: unknown = VALID): ImportedPlan {
  const result = parse(data);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.plan;
}

describe('parsePlanImport', () => {
  it('reads the documented format and ignores unknown keys like schedule', () => {
    const plan = parsed();
    expect(plan.warmup).toEqual(['Hip circles 10x', 'Cat-cow']);
    expect(plan.days).toHaveLength(1);
    const [squat, split] = plan.days[0].blocks[0].ex;
    expect(squat).toMatchObject({ name: 'Kniebeuge', uni: false, sets: 4, note: 'RPE 8' });
    expect(split).toMatchObject({ uni: true, setsL: 3, setsR: 3, reps: '8' });
    expect(squat.id).not.toBe(split.id);
  });

  it('treats a missing uni as bilateral', () => {
    const data = structuredClone(VALID);
    const ex = data.days[0].blocks[0].ex[0] as Record<string, unknown>;
    delete ex.uni;
    expect(parsed(data).days[0].blocks[0].ex[0]).toMatchObject({ uni: false, sets: 4 });
  });

  it('rejects text that is not JSON', () => {
    expect(parsePlanImport('{ days: ')).toEqual({ ok: false, errors: ['Kein gültiges JSON.'] });
  });

  it('collects every problem instead of stopping at the first', () => {
    const data = structuredClone(VALID) as Record<string, unknown>;
    const day = (data.days as Record<string, unknown>[])[0];
    day.short = '';
    const block = (day.blocks as Record<string, unknown>[])[0];
    block.kind = 'cardio';
    const [squat, split] = block.ex as Record<string, unknown>[];
    squat.type = 'lbs';
    delete split.setsR;

    const result = parse(data);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(4);
    expect(result.errors.join('\n')).toMatch(/short: fehlt/);
    expect(result.errors.join('\n')).toMatch(/kind: einer von/);
    expect(result.errors.join('\n')).toMatch(/Kniebeuge.*type/);
    expect(result.errors.join('\n')).toMatch(/Split Squat.*setsR/);
  });

  it('enforces the database limits', () => {
    const data = structuredClone(VALID);
    data.days[0].short = 'x'.repeat(33);
    data.days[0].blocks[0].ex[0].sets = 100;
    const result = parse(data);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(2);
  });

  it('requires at least one day', () => {
    expect(parse({ warmup: [] }).ok).toBe(false);
    expect(parse({ days: [] }).ok).toBe(false);
  });
});

describe('session types', () => {
  const types: SessionType[] = [
    { id: 1, label: 'Laufen', custom: false },
    { id: 2, label: 'Kraft', custom: false },
  ];

  it('matches labels ignoring case and spaces, but nothing looser', () => {
    expect(matchSessionType(' kraft ', types)?.id).toBe(2);
    expect(matchSessionType('Krafttraining', types)).toBeUndefined();
    expect(matchSessionType('', types)).toBeUndefined();
  });

  it('lists each label once, with a missing one as empty', () => {
    const data = structuredClone(VALID);
    data.days.push({ ...data.days[0], sessionType: 'Kraft' });
    data.days.push({ ...data.days[0], sessionType: undefined as unknown as string });
    expect(importedTypeLabels(parsed(data))).toEqual(['Kraft', '']);
  });
});

describe('mergeImport', () => {
  const existing: Plan = {
    warmup: ['cat-cow', 'Seilspringen'],
    days: [{ id: 'old', short: 'X', title: 'Alt', sessionTypeId: 1, blocks: [] }],
  };

  it('appends the days with fresh ids and the chosen type, keeping existing ones', () => {
    const days = toDays(parsed(), { Kraft: 2 });
    const plan = mergeImport(existing, days, []);
    expect(plan.days.map((d) => d.title)).toEqual(['Alt', 'Unterkörper']);
    expect(days[0]).toMatchObject({ sessionTypeId: 2, short: 'A' });
    expect(days[0].id).not.toBe('old');
    expect(days[0]).not.toHaveProperty('sessionType');
  });

  it('only adds warmup items that are not on the list yet', () => {
    const plan = mergeImport(existing, [], parsed().warmup);
    expect(plan.warmup).toEqual(['cat-cow', 'Seilspringen', 'Hip circles 10x']);
  });
});

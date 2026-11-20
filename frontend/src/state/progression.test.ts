import { describe, expect, it } from 'vitest';
import type { BilateralExercise, Effort, WorkoutLog } from '../types';
import { suggestNextStep } from './progression';

const ROW: BilateralExercise = {
  id: 'row',
  name: 'Rudern',
  type: 'kcal',
  uni: false,
  sets: 3,
  reps: '1',
  steps: [{ name: 'W1' }, { name: 'W2' }, { name: 'Taper' }],
  step: 0,
};

function rated(date: string, effort: Effort, step = 'W1'): WorkoutLog {
  return { date, dayId: 'mo', vals: {}, warm: [], ratings: { row: { effort, step } } };
}

// 2026-11-16 is a Monday.
describe('suggesting the next step', () => {
  it('offers it in a new week, with how last week went', () => {
    const logs = [rated('2026-11-10', 'leicht'), rated('2026-11-12', 'mittel')];
    expect(suggestNextStep(ROW, logs, '2026-11-17')).toEqual({
      index: 1,
      step: { name: 'W2' },
      efforts: ['leicht', 'mittel'],
    });
  });

  it('waits while the current step was last rated this week', () => {
    const logs = [rated('2026-11-12', 'leicht'), rated('2026-11-16', 'schwer')];
    expect(suggestNextStep(ROW, logs, '2026-11-18')).toBeNull();
  });

  it('only reads ratings given at the current step', () => {
    expect(suggestNextStep(ROW, [rated('2026-11-10', 'leicht', 'W2')], '2026-11-17')).toBeNull();
    expect(
      suggestNextStep({ ...ROW, step: 1 }, [rated('2026-11-10', 'leicht', 'W2')], '2026-11-17'),
    ).toMatchObject({ index: 2, efforts: ['leicht'] });
  });

  it('ignores ratings after the day being looked at', () => {
    expect(suggestNextStep(ROW, [rated('2026-11-20', 'leicht')], '2026-11-17')).toBeNull();
  });

  it('never offers anything past the last step, or without steps', () => {
    expect(
      suggestNextStep({ ...ROW, step: 2 }, [rated('2026-11-10', 'leicht', 'Taper')], '2026-11-17'),
    ).toBeNull();
    expect(suggestNextStep({ ...ROW, steps: undefined }, [], '2026-11-17')).toBeNull();
  });
});

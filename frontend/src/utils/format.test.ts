import { describe, expect, it } from 'vitest';
import { formatDelta, formatSet, formatValue } from './format';

describe('formatValue', () => {
  it('writes the value in its unit', () => {
    expect(formatValue(62.5, 'kg')).toBe('62.5 kg');
    expect(formatValue(1.85, 'm')).toBe('1.85 m');
    expect(formatValue(12, 'bw')).toBe('12 Wdh');
  });

  it('names a band step by its colour', () => {
    expect(formatValue(3, 'band')).toBe('grün');
  });
});

describe('formatDelta', () => {
  it('signs the change', () => {
    expect(formatDelta(7.5, 'kg')).toBe('+7.5 kg');
    expect(formatDelta(-5, 'sek')).toBe('−5 Sek');
    expect(formatDelta(0, 'kg')).toBe('±0 kg');
    expect(formatDelta(1, 'band')).toBe('+1 Stufe');
  });
});

describe('formatSet', () => {
  it('adds the reps only to a value that has them', () => {
    expect(formatSet('60', '8')).toBe('60 × 8');
    expect(formatSet('60', '')).toBe('60');
    expect(formatSet('', '8')).toBe('');
  });
});

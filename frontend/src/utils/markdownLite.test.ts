import { describe, expect, it } from 'vitest';
import { parseBlocks, parseSpans } from './markdownLite';

describe('parseBlocks', () => {
  it('reads headings, lists and paragraphs', () => {
    const md = '## Neu\n- Neuigkeiten im Menü\n* Version im Menü\n\nDanke fürs\nTesten!';
    expect(parseBlocks(md)).toEqual([
      { kind: 'heading', text: 'Neu' },
      { kind: 'list', items: ['Neuigkeiten im Menü', 'Version im Menü'] },
      { kind: 'paragraph', text: 'Danke fürs Testen!' },
    ]);
  });

  it('ends a paragraph where a list starts, without a blank line', () => {
    expect(parseBlocks('Neu:\n- eins')).toEqual([
      { kind: 'paragraph', text: 'Neu:' },
      { kind: 'list', items: ['eins'] },
    ]);
  });

  it('keeps anything else as text', () => {
    expect(parseBlocks('<img src=x onerror=alert(1)>')).toEqual([
      { kind: 'paragraph', text: '<img src=x onerror=alert(1)>' },
    ]);
  });
});

describe('parseSpans', () => {
  it('splits at bold runs', () => {
    expect(parseSpans('Neu: **Statistik** pro Woche')).toEqual([
      { text: 'Neu: ', bold: false },
      { text: 'Statistik', bold: true },
      { text: ' pro Woche', bold: false },
    ]);
  });

  it('leaves an unclosed marker as written', () => {
    expect(parseSpans('2 ** 3')).toEqual([{ text: '2 ** 3', bold: false }]);
  });
});

/**
 * The bit of Markdown release notes are written in: headings, "-" or "*" lists, paragraphs and
 * **bold**. Parsed into plain data so the component builds React elements from it, never HTML.
 * Anything else (links, code, nested lists) comes through as its literal text.
 */

export type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'paragraph'; text: string };

export interface Span {
  text: string;
  bold: boolean;
}

const HEADING = /^#{1,6}\s+(.*)$/;
const LIST_ITEM = /^[-*]\s+(.*)$/;

export function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const endParagraph = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };

  for (const raw of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    const heading = HEADING.exec(line);
    const item = LIST_ITEM.exec(line);
    if (!line) {
      endParagraph();
    } else if (heading) {
      endParagraph();
      blocks.push({ kind: 'heading', text: heading[1] });
    } else if (item) {
      endParagraph();
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'list') last.items.push(item[1]);
      else blocks.push({ kind: 'list', items: [item[1]] });
    } else {
      paragraph.push(line);
    }
  }
  endParagraph();
  return blocks;
}

/** Splits a line at its **bold** runs; an unclosed "**" stays as written. */
export function parseSpans(text: string): Span[] {
  return text
    .split(/\*\*(.+?)\*\*/)
    .map((part, i) => ({ text: part, bold: i % 2 === 1 }))
    .filter((span) => span.text !== '');
}

import type { Release } from '../../utils/whatsNew';
import { parseBlocks, parseSpans } from '../../utils/markdownLite';
import { formatDate } from '../../utils/date';
import styles from './WhatsNewSheet.module.scss';

interface WhatsNewSheetProps {
  releases: Release[];
  onClose: () => void;
}

function Text({ text }: { text: string }) {
  return parseSpans(text).map((span, i) =>
    span.bold ? <strong key={i}>{span.text}</strong> : span.text,
  );
}

function Notes({ notes }: { notes: string }) {
  return parseBlocks(notes).map((block, i) => {
    if (block.kind === 'heading') {
      return (
        <h4 key={i} className={styles.heading}>
          <Text text={block.text} />
        </h4>
      );
    }
    if (block.kind === 'list') {
      return (
        <ul key={i} className={styles.list}>
          {block.items.map((item, j) => (
            <li key={j}>
              <Text text={item} />
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={i} className={styles.paragraph}>
        <Text text={block.text} />
      </p>
    );
  });
}

export function WhatsNewSheet({ releases, onClose }: WhatsNewSheetProps) {
  return (
    <>
      <h2 className={styles.title}>Neuigkeiten</h2>
      <div className={styles.sub}>Was sich in der App geändert hat</div>
      {releases.length === 0 && <div className={styles.empty}>Noch keine Neuigkeiten.</div>}
      {releases.map((r) => (
        <section key={r.version} className={styles.release}>
          <h3 className={styles.releaseTitle}>{r.name || `Version ${r.version}`}</h3>
          <div className={styles.releaseMeta}>
            {[r.name && `Version ${r.version}`, r.date && formatDate(r.date)]
              .filter(Boolean)
              .join(' · ')}
          </div>
          <Notes notes={r.notes} />
        </section>
      ))}
      <button type="button" className={styles.solid} onClick={onClose}>
        Alles klar
      </button>
    </>
  );
}

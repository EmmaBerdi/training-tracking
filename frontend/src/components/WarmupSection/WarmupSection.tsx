import type { WorkoutLog } from '../../types';
import { blockAccent } from '../../utils/cssVar';
import type { WarmupActions } from '../actions';
import styles from './WarmupSection.module.scss';

interface WarmupSectionProps {
  items: string[];
  log: WorkoutLog | undefined;
  open: boolean;
  editing: boolean;
  onToggleOpen: () => void;
  onToggleItem: (index: number) => void;
  actions: WarmupActions;
}

export function WarmupSection({
  items,
  log,
  open,
  editing,
  onToggleOpen,
  onToggleItem,
  actions,
}: WarmupSectionProps) {
  const done = log?.warm ?? [];
  const doneCount = done.filter(Boolean).length;

  return (
    <div className={styles.warmup}>
      <button type="button" className={styles.toggle} onClick={onToggleOpen} aria-expanded={open}>
        <span className={styles.accentBar} style={blockAccent('explosiv')} />
        <span className={styles.blockTitle}>Aufwärmen</span>
        <span className={styles.blockMeta}>
          {editing ? items.length : `${doneCount}/${items.length}`}
          {open ? '  ▲' : '  ▼'}
        </span>
      </button>
      {open && (
        <div className={styles.body}>
          {editing
            ? items.map((item, i) => (
                <div key={i} className={styles.editRow}>
                  <input
                    value={item}
                    aria-label={`Aufwärm-Punkt ${i + 1}`}
                    onChange={(e) => actions.setWarmupText(i, e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.smallButton}
                    aria-label="Nach oben"
                    disabled={i === 0}
                    onClick={() => actions.moveWarmupItem(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.smallButton}
                    aria-label="Nach unten"
                    disabled={i === items.length - 1}
                    onClick={() => actions.moveWarmupItem(i, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={`${styles.smallButton} ${styles.danger}`}
                    aria-label="Punkt löschen"
                    onClick={() => {
                      if (window.confirm('Punkt löschen?')) actions.deleteWarmupItem(i);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))
            : items.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  className={`${styles.item} ${done[i] ? styles.itemDone : ''}`}
                  aria-pressed={Boolean(done[i])}
                  onClick={() => onToggleItem(i)}
                >
                  <span className={styles.checkbox} />
                  <span>{item}</span>
                </button>
              ))}
          {editing && (
            <button type="button" className={styles.addButton} onClick={actions.addWarmupItem}>
              + Punkt
            </button>
          )}
        </div>
      )}
    </div>
  );
}

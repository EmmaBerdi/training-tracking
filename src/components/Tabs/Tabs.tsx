import { useEffect, useRef } from 'react';
import { colorAccent } from '../../utils/cssVar';
import styles from './Tabs.module.scss';

export interface TabItem {
  id: string;
  /** Big line: the weekday and date in log mode, the plan's short label in edit mode. */
  top: string;
  /** Small line underneath: what is planned that day, or the plan's title. */
  bottom: string;
  /** Session-type color, applied as the underline of the active tab. */
  accent?: string;
  /** Already done or skipped — still selectable, just visually retired. */
  dim?: boolean;
}

interface TabsProps {
  items: TabItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Month steppers, shown at the ends of the strip in log mode. */
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  /** Trailing "new plan" button, shown while editing plans. */
  onAddPlan?: () => void;
}

export function Tabs({
  items,
  activeId,
  onSelect,
  onPrevMonth,
  onNextMonth,
  onAddPlan,
}: TabsProps) {
  const activeRef = useRef<HTMLButtonElement>(null);

  // Keep the selected day visible when the month or the selection changes.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [activeId, items.length]);

  return (
    <div className={styles.tabs}>
      {onPrevMonth && (
        <button
          type="button"
          className={`${styles.tab} ${styles.month}`}
          onClick={onPrevMonth}
          aria-label="Vorheriger Monat"
        >
          <b>‹</b>
          <span>Vorheriger Monat</span>
        </button>
      )}

      {items.map((item) => (
        <button
          key={item.id}
          ref={item.id === activeId ? activeRef : undefined}
          type="button"
          className={`${styles.tab} ${item.id === activeId ? styles.on : ''} ${
            item.dim ? styles.dim : ''
          }`}
          style={item.accent ? colorAccent(item.accent) : undefined}
          onClick={() => onSelect(item.id)}
        >
          <b>{item.top}</b>
          <span>{item.bottom}</span>
        </button>
      ))}

      {onAddPlan && (
        <button type="button" className={`${styles.tab} ${styles.add}`} onClick={onAddPlan}>
          <b>+</b>
          <span>Plan</span>
        </button>
      )}

      {onNextMonth && (
        <button
          type="button"
          className={`${styles.tab} ${styles.month}`}
          onClick={onNextMonth}
          aria-label="Nächster Monat"
        >
          <b>›</b>
          <span>Nächster Monat</span>
        </button>
      )}
    </div>
  );
}

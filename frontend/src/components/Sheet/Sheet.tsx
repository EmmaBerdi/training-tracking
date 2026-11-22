import type { ReactNode } from 'react';
import { useScrollLock } from '../../hooks/useScrollLock';
import styles from './Sheet.module.scss';

interface SheetProps {
  onClose: () => void;
  /** A dialog in the middle of the screen, for news that interrupts rather than a task at hand. */
  centered?: boolean;
  children: ReactNode;
}

export function Sheet({ onClose, centered, children }: SheetProps) {
  useScrollLock();
  return (
    <div className={`${styles.sheet} ${centered ? styles.centered : ''}`} onClick={onClose}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

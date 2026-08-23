import type { Mode } from '../../types';
import styles from './Footer.module.scss';

interface FooterProps {
  /** Which surface is on screen; the calendar outranks the mode for the active highlight. */
  view: 'training' | 'calendar';
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onOpenCalendar: () => void;
}

export function Footer({ view, mode, onModeChange, onOpenCalendar }: FooterProps) {
  const active = view === 'calendar' ? 'calendar' : mode;
  const cls = (on: boolean) => `${styles.navButton} ${on ? styles.on : ''}`;
  return (
    <footer className={styles.footer}>
      <button type="button" className={cls(active === 'log')} onClick={() => onModeChange('log')}>
        <span className={styles.ico}>◉</span>Protokoll
      </button>
      <button type="button" className={cls(active === 'edit')} onClick={() => onModeChange('edit')}>
        <span className={styles.ico}>◎</span>Plan
      </button>
      <button type="button" className={cls(active === 'calendar')} onClick={onOpenCalendar}>
        <span className={styles.ico}>▦</span>Kalender
      </button>
    </footer>
  );
}

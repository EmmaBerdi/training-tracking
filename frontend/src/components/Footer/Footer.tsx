import type { Mode, View } from '../../types';
import { NAV } from '../../data/constants';
import { TOUR_TARGET } from '../Tour/targets';
import styles from './Footer.module.scss';

interface FooterProps {
  /** Which surface is on screen; calendar and statistics outrank the mode for the highlight. */
  view: View;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onOpenCalendar: () => void;
  onOpenStats: () => void;
}

export function Footer({ view, mode, onModeChange, onOpenCalendar, onOpenStats }: FooterProps) {
  const active = view === 'training' ? mode : view;
  const cls = (on: boolean) => `${styles.navButton} ${on ? styles.on : ''}`;
  return (
    <footer className={styles.footer}>
      <button
        type="button"
        className={cls(active === 'log')}
        data-tour={TOUR_TARGET.log}
        onClick={() => onModeChange('log')}
      >
        <span className={styles.ico}>{NAV.log.icon}</span>
        {NAV.log.label}
      </button>
      <button
        type="button"
        className={cls(active === 'edit')}
        data-tour={TOUR_TARGET.edit}
        onClick={() => onModeChange('edit')}
      >
        <span className={styles.ico}>{NAV.edit.icon}</span>
        {NAV.edit.label}
      </button>
      <button
        type="button"
        className={cls(active === 'calendar')}
        data-tour={TOUR_TARGET.calendar}
        onClick={onOpenCalendar}
      >
        <span className={styles.ico}>{NAV.calendar.icon}</span>
        {NAV.calendar.label}
      </button>
      <button
        type="button"
        className={cls(active === 'stats')}
        data-tour={TOUR_TARGET.stats}
        onClick={onOpenStats}
      >
        <span className={styles.ico}>{NAV.stats.icon}</span>
        {NAV.stats.label}
      </button>
    </footer>
  );
}

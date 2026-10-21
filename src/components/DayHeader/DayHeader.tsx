import type { Day, SessionType } from '../../types';
import { sessionTypeAccent } from '../../utils/cssVar';
import styles from './DayHeader.module.scss';

export function DayHeader({ day, type }: { day: Day; type: SessionType | undefined }) {
  return (
    <div className={styles.dayHeader}>
      <div className={styles.dayTitle}>{day.title}</div>
      {type && (
        <div className={styles.dayType} style={sessionTypeAccent(type)}>
          {type.label}
        </div>
      )}
    </div>
  );
}

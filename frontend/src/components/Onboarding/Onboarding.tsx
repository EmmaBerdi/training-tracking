import { NAV, type NavTarget } from '../../data/constants';
import { useScrollLock } from '../../hooks/useScrollLock';
import styles from './Onboarding.module.scss';

interface OnboardingProps {
  onStartTour: () => void;
  onSkip: () => void;
}

/** What the app is for, in three points, each marked with the section it happens in. */
const POINTS: { target: NavTarget; title: string; text: string }[] = [
  {
    target: 'calendar',
    title: 'Planen',
    text: 'Trainings in den Kalender legen, einmalig oder als Serie, mit eigenen Workout-Plänen.',
  },
  {
    target: 'log',
    title: 'Eintragen',
    text: 'Beim Training Sätze, Gewichte und Zeiten festhalten, mit dem Wert vom letzten Mal daneben.',
  },
  {
    target: 'stats',
    title: 'Besser werden',
    text: 'Verlauf und Rekorde je Übung sehen, und wie viel vom Geplanten du geschafft hast.',
  },
];

export function Onboarding({ onStartTour, onSkip }: OnboardingProps) {
  useScrollLock();
  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.eyebrow}>Willkommen</div>
        <h1 className={styles.title}>Dein Trainingstagebuch</h1>
        <ul className={styles.points}>
          {POINTS.map((point) => (
            <li key={point.target} className={styles.point}>
              <span className={styles.pointMark}>{NAV[point.target].icon}</span>
              <span>
                <strong className={styles.pointTitle}>{point.title}</strong>
                {point.text}
              </span>
            </li>
          ))}
        </ul>
        <button type="button" className={styles.solid} onClick={onStartTour}>
          Rundgang starten
        </button>
        <button type="button" className={styles.link} onClick={onSkip}>
          Überspringen
        </button>
      </div>
    </div>
  );
}

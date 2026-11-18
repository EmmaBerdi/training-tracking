import { useEffect, useEffectEvent, useId, useRef, useState, type CSSProperties } from 'react';
import type { TourTarget } from './targets';
import styles from './Tour.module.scss';

export interface TourStep {
  /** The bubble points at the first element carrying this `data-tour` value. */
  target: TourTarget;
  title: string;
  text: string;
  /** Puts the target on screen — switches view or mode — before the step is measured. */
  show?: () => void;
}

interface TourProps {
  steps: TourStep[];
  onClose: () => void;
}

/** The highlighted element's box, for the step it was measured for. */
interface Spot {
  index: number;
  rect: DOMRect | null;
}

/** Room around the highlighted element, gap to the bubble, and the bubble's distance to the edge. */
const PAD = 6;
const GAP = 12;
const EDGE = 16;
const BUBBLE_WIDTH = 340;

function bubblePosition(rect: DOMRect): CSSProperties {
  const width = Math.min(BUBBLE_WIDTH, window.innerWidth - 2 * EDGE);
  const center = rect.left + rect.width / 2;
  const left = Math.min(Math.max(center - width / 2, EDGE), window.innerWidth - EDGE - width);
  // On the side with more room: below the header's controls, above the footer's.
  const below = window.innerHeight - rect.bottom >= rect.top;
  return below
    ? { width, left, top: rect.bottom + PAD + GAP }
    : { width, left, bottom: window.innerHeight - rect.top + PAD + GAP };
}

/** Walks through the app's real screens, dimming everything but the element each step is about. */
export function Tour({ steps, onClose }: TourProps) {
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Spot | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const textId = useId();
  const step = steps[index];
  const isLast = index === steps.length - 1;
  // Until the new step is measured the bubble stays hidden, rather than flash at the old spot.
  const current = spot?.index === index ? spot : null;

  const locate = useEffectEvent((scroll: boolean) => {
    const el = document.querySelector(`[data-tour="${steps[index].target}"]`);
    if (el && scroll) {
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'center' });
    }
    setSpot({ index, rect: el?.getBoundingClientRect() ?? null });
  });

  const enter = useEffectEvent(() => steps[index].show?.());

  useEffect(() => {
    enter();
    // show() re-renders the app; its target is only laid out once that render has painted.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => locate(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [index]);

  useEffect(() => {
    const follow = () => locate(false);
    window.addEventListener('resize', follow);
    window.addEventListener('scroll', follow, true);
    return () => {
      window.removeEventListener('resize', follow);
      window.removeEventListener('scroll', follow, true);
    };
  }, []);

  const shownIndex = current?.index;
  useEffect(() => {
    if (shownIndex !== undefined) bubbleRef.current?.focus({ preventScroll: true });
  }, [shownIndex]);

  const next = () => (isLast ? onClose() : setIndex(index + 1));
  const back = () => setIndex(Math.max(0, index - 1));

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') back();
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const rect = current?.rect ?? null;

  return (
    <div className={styles.tour}>
      {/* Takes every tap meant for the app: the tour shows the screens, it doesn't hand them over. */}
      <div className={`${styles.blocker} ${current && !rect ? styles.dim : ''}`} />
      {rect && (
        <div
          className={styles.spotlight}
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + 2 * PAD,
            height: rect.height + 2 * PAD,
          }}
        />
      )}
      {current && (
        <div
          ref={bubbleRef}
          className={`${styles.bubble} ${rect ? '' : styles.centered}`}
          style={rect ? bubblePosition(rect) : undefined}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={textId}
          tabIndex={-1}
        >
          <div className={styles.count}>
            {index + 1} / {steps.length}
          </div>
          <h2 id={titleId} className={styles.title}>
            {step.title}
          </h2>
          <p id={textId} className={styles.text}>
            {step.text}
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.end} onClick={onClose}>
              Beenden
            </button>
            {index > 0 && (
              <button type="button" className={styles.back} onClick={back}>
                Zurück
              </button>
            )}
            <button type="button" className={styles.next} onClick={next}>
              {isLast ? 'Fertig' : 'Weiter'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect } from 'react';

/** How many overlays currently hold the lock, so closing one never frees the page under another. */
let holders = 0;

/**
 * Freezes the page behind a full-screen overlay while it is mounted. On touch screens a swipe that
 * runs past the end of the overlay's own content otherwise scrolls the page underneath it.
 */
export function useScrollLock() {
  useEffect(() => {
    const root = document.documentElement;
    if (holders++ === 0) root.style.overflow = 'hidden';
    return () => {
      if (--holders === 0) root.style.overflow = '';
    };
  }, []);
}

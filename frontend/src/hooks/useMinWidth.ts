import { useSyncExternalStore } from 'react';

/** Mirrors `$tablet` in src/styles/_breakpoints.scss, for layout decisions CSS alone can't make. */
export const BREAKPOINT = { tablet: 768 } as const;

/** Whether the viewport is at least `minWidth` wide, following resizes and rotation. */
export function useMinWidth(minWidth: number): boolean {
  const query = `(min-width: ${minWidth}px)`;
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}

import { useEffect, useRef, useState } from 'react';

/**
 * The rendered width of the element `ref` is attached to, following resizes. SVG charts draw in
 * pixels, so they need the number rather than a percentage; `initial` stands in until it's measured.
 */
export function useElementWidth<T extends HTMLElement>(initial = 320) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

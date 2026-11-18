import { useEffect, useState } from 'react';
import { fetchImageUrl } from '../api/images';

/**
 * Blob URLs by image id, shared across every component that shows the same picture — the card
 * thumbnail and the info sheet behind it would otherwise fetch the same bytes twice. An id always
 * names the same picture (replacing one uploads a new id), so an entry never goes stale and the
 * URLs are held for the session rather than revoked per component.
 */
const urls = new Map<string, Promise<string | null>>();

function imageUrl(id: string): Promise<string | null> {
  let pending = urls.get(id);
  if (!pending) {
    // A failed load is forgotten rather than cached, so a picture missed while offline is retried.
    pending = fetchImageUrl(id).then((url) => {
      if (!url) urls.delete(id);
      return url;
    });
    urls.set(id, pending);
  }
  return pending;
}

/** The picture behind `imageId`, or null while it loads, if there is none, or if it failed. */
export function useExerciseImage(imageId: string | undefined): string | null {
  // The id is kept next to the URL so that switching pictures shows nothing rather than the
  // previous one for the render between the change and the new bytes arriving.
  const [loaded, setLoaded] = useState<{ id: string; url: string } | null>(null);

  useEffect(() => {
    if (!imageId) return;

    let cancelled = false;
    void imageUrl(imageId).then((url) => {
      if (!cancelled && url) setLoaded({ id: imageId, url });
    });
    return () => {
      cancelled = true;
    };
  }, [imageId]);

  return loaded && loaded.id === imageId ? loaded.url : null;
}

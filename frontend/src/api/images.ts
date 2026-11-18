import { authorizedFetch } from './base';

const PATH = '/exercise-images';

/** What an upload answers with; the id is what the plan stores against the exercise. */
export interface UploadedImage {
  id: string;
  width: number;
  height: number;
}

/**
 * Both calls return `null` on any failure, like the JSON `request` next door: the caller shows a
 * toast either way, and the reason is only useful in the console.
 */
export async function uploadImage(blob: Blob): Promise<UploadedImage | null> {
  const body = new FormData();
  // The filename is required by the multipart format but ignored — the bytes decide the type.
  body.append('file', blob, 'setup.jpg');
  try {
    // No Content-Type header: the browser has to set it itself to include the multipart boundary.
    const res = await authorizedFetch(PATH, { method: 'POST', body });
    if (!res.ok) throw new Error(`HTTP ${res.status} on POST ${PATH}`);
    return (await res.json()) as UploadedImage;
  } catch (err) {
    console.error(err);
    return null;
  }
}

/**
 * Reading a picture needs the bearer token, so it can't be an `<img src>` pointing at the API.
 * The bytes come back through the same authorized fetch and become a blob URL the browser can
 * render. The caller owns that URL — see `useExerciseImage`, which caches it for the session.
 */
export async function fetchImageUrl(id: string): Promise<string | null> {
  try {
    const res = await authorizedFetch(`${PATH}/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} on GET ${PATH}/${id}`);
    return URL.createObjectURL(await res.blob());
  } catch (err) {
    console.error(err);
    return null;
  }
}

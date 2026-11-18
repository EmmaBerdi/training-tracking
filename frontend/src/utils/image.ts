/**
 * Turns whatever the photo picker hands over into something worth uploading.
 *
 * Re-encoding through a canvas does three jobs at once: it converts the HEIC an iPhone camera
 * produces into a format the backend can read, it cuts a 4 MB photo down to a couple of hundred
 * kilobytes, and it drops the EXIF block — including the GPS coordinates of wherever the picture
 * was taken — because a canvas only carries pixels. Orientation survives, since the browser has
 * already applied it while decoding.
 */

/** Long edge of the stored picture: enough to read a box height off, small enough for mobile data. */
const MAX_EDGE = 1600;

const QUALITY = 0.82;

export async function prepareImage(file: File): Promise<Blob> {
  const source = URL.createObjectURL(file);
  try {
    const image = await decode(source);
    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);

    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas 2d context unavailable');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await encode(canvas);
  } finally {
    URL.revokeObjectURL(source);
  }
}

function decode(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('file is not an image this browser can decode'));
    image.src = source;
  });
}

function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('could not encode the image'))),
      'image/jpeg',
      QUALITY,
    );
  });
}

import type { Area } from 'react-easy-crop';

/**
 * Draws the cropped region of `imageSrc` (an object URL for the file the
 * admin selected) onto an offscreen canvas at exactly `croppedAreaPixels`
 * and encodes it back out as a Blob. This is the only place a crop actually
 * happens — everything else in react-easy-crop just computes what area to
 * cut, it never touches the underlying pixels itself.
 *
 * Mirrors the backend's own format rule (`outputFormatFor` in
 * `internal/service/image_processor.go`): PNG sources keep transparency,
 * everything else becomes JPEG, so client and server agree on output shape.
 */
export async function getCroppedImageBlob(
  imageSrc: string,
  croppedAreaPixels: Area,
  sourceType: string
): Promise<Blob> {
  const image = await loadImage(imageSrc);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(croppedAreaPixels.width);
  canvas.height = Math.round(croppedAreaPixels.height);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is not available');
  }

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const outputType = sourceType === 'image/png' ? 'image/png' : 'image/jpeg';
  const quality = outputType === 'image/jpeg' ? 0.92 : undefined;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode cropped image'));
          return;
        }
        resolve(blob);
      },
      outputType,
      quality
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('Failed to load image for cropping')));
    image.src = src;
  });
}

'use client';

import { useCallback, useState } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import { Modal } from '@/ui/Modal';
import { Button } from '@/ui/Button';
import { getCroppedImageBlob } from '@/lib/cropImage';
import { ASPECT_RATIOS, type AspectRatioKey } from '@/lib/aspectRatios';

interface ImageCropModalProps {
  open: boolean;
  /** Object URL for the file the admin just selected. */
  imageSrc: string;
  /** MIME type of the original file — decides JPEG vs PNG output. */
  sourceType: string;
  aspectRatioKey: AspectRatioKey;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}

/**
 * Mandatory crop-to-frame step between "admin picked a file" and "file gets
 * uploaded." The site's image frames always fill edge-to-edge with no
 * letterboxing (see Frontend-dev's `Media` component), which only looks
 * right if the source already matches the frame's aspect ratio — so instead
 * of an automatic crop at render time silently clipping content, the admin
 * frames the shot themselves here, with a live preview of exactly what will
 * render on the public site.
 */
export function ImageCropModal({
  open,
  imageSrc,
  sourceType,
  aspectRatioKey,
  onCancel,
  onConfirm,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const onCropComplete = useCallback((_croppedArea: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;

    setSaving(true);
    setError('');
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels, sourceType);
      onConfirm(blob);
    } catch {
      setError('Could not crop this image. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="lg"
      closeOnBackdrop={false}
      labelledBy="image-crop-modal-title"
    >
      <div className="p-6">
        <h3
          id="image-crop-modal-title"
          className="text-lg font-semibold text-[var(--color-text-primary)]"
        >
          Frame this image
        </h3>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Drag to reposition, use the slider to zoom. This is exactly how the
          image will appear on the live site — nothing outside the frame is
          kept.
        </p>

        <div className="relative mt-4 h-80 w-full overflow-hidden rounded-xl bg-[var(--color-background-tertiary)] sm:h-96">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={ASPECT_RATIOS[aspectRatioKey]}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <label
            htmlFor="crop-zoom"
            className="text-sm text-[var(--color-text-secondary)]"
          >
            Zoom
          </label>
          <input
            id="crop-zoom"
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="flex-1"
          />
        </div>

        {error && <p className="mt-3 text-sm text-[var(--color-accent-danger)]">{error}</p>}

        <div className="mt-6 flex items-center gap-3">
          <Button
            onClick={handleConfirm}
            loading={saving}
            disabled={saving || !croppedAreaPixels}
            className="flex-1"
          >
            Use this crop
          </Button>
          <Button
            onClick={onCancel}
            variant="outline"
            disabled={saving}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

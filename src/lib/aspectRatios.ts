/**
 * Sitewide crop-target vocabulary. Every image field that needs a crop step
 * picks one of these keys — never an arbitrary ratio — so the whole site
 * only ever has to support a small, deliberately chosen set of shapes. The
 * numeric values and keys mirror `AllowedAspectRatios` in Backend-dev's
 * `internal/service/image_processor.go`; keep the two in sync if this set
 * ever changes.
 */
export const ASPECT_RATIOS = {
  '16:9': 16 / 9,
  '1:1': 1,
  '4:5': 4 / 5,
} as const;

export type AspectRatioKey = keyof typeof ASPECT_RATIOS;

export function aspectRatioValue(key: AspectRatioKey): number {
  return ASPECT_RATIOS[key];
}

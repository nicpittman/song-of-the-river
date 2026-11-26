/** Limit extra Retina density on large canvases; notebook text remains native DOM. */
export function renderResolution(width: number, height: number, deviceRatio: number): number {
  const ratio = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  const area = Math.max(1, width) * Math.max(1, height);
  // Native pixels are retained; only the extra high-DPI work is reduced.
  const budget = Math.max(1, Math.sqrt(5_000_000 / area));
  return Math.min(ratio, 1.5, budget);
}

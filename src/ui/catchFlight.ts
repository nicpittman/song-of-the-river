/**
 * The path a sketch takes from a creature into the notebook: it lifts a
 * little, then drifts in one soft arc that rises before it falls, so it reads
 * as a page being tucked away rather than a thing thrown.
 */

export const CATCH_FLIGHT = {
  /** Whole flight, in milliseconds (calm: under a second). */
  ms: 850,
  /** Share of the flight spent lifting off the creature before the arc. */
  lift: 0.16,
  /** Drawing size in px. */
  size: 30,
} as const;

interface Point { x: number; y: number }

/** A point `f` (0..1) along the arc from `from` to `to`: a quadratic curve bowed upward. */
export function arcPoint(from: Point, to: Point, f: number): Point {
  const d = Math.hypot(to.x - from.x, to.y - from.y);
  // The bend sits a quarter of the way along and above both ends, so the sketch rises first.
  const control = { x: from.x + (to.x - from.x) * 0.25, y: Math.min(from.y, to.y) - Math.min(140, 30 + d * 0.22) };
  const u = 1 - f;
  return {
    x: u * u * from.x + 2 * u * f * control.x + f * f * to.x,
    y: u * u * from.y + 2 * u * f * control.y + f * f * to.y,
  };
}

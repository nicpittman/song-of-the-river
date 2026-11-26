/** Independent of CSS animation: the ending also finishes with reduced motion. */
export const ENDING_CREDITS_MS = 32000;
/** One leaf of the journal at the end: brisk, a page-turn's pace. */
export const JOURNEY_MEMORY_MS = 2000;
export const JOURNEY_AHEAD_MS = 3500;
/** A turn by hand holds the pages this much longer before they carry on. */
export const JOURNEY_HOLD_MS = 5000;

/** Measure the actual roll, including wrapped text on a small screen. The
 * gentle linear movement is essential content, independent of CSS flourishes. */
export function rollCredits(roll: HTMLElement, viewport: HTMLElement): Animation {
  return roll.animate([
    { transform: `translateY(${viewport.clientHeight * .7}px)` },
    { transform: `translateY(${-Math.max(0, roll.scrollHeight - viewport.clientHeight * .55)}px)` },
  ], { duration: ENDING_CREDITS_MS, easing: 'linear', fill: 'both' });
}

export class EndingClock {
  private timer: ReturnType<typeof setTimeout> | undefined;
  start(finish: () => void, duration = ENDING_CREDITS_MS): void { this.stop(); this.timer = setTimeout(finish, duration); }
  stop(): void { clearTimeout(this.timer); this.timer = undefined; }
}

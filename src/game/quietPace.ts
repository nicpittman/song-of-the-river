/**
 * Quiet stretches of an ordinary day pass a little faster.
 *
 * When nothing is on screen to read or watch (no words, no creature, no
 * choice waiting, no recent touch of the player's), the day's clock eases up
 * to `QUIET.boost` times its usual pace over `QUIET.up` seconds, and eases
 * back to the usual pace in `QUIET.down` seconds the moment anything appears
 * or is about to. The rules step in fixed ticks, so only how soon things
 * happen in real time changes, never what happens.
 */

import { clamp } from './core/math';

export const QUIET = {
  /** The most the day's pace is multiplied by in a quiet stretch. */
  boost: 1.6,
  /** Seconds to ease up to the full boost, once quiet has settled. */
  up: 1.5,
  /** Seconds to ease back down to the usual pace. */
  down: 0.4,
  /** Seconds of quiet before the pace begins to rise, so it never flickers between two moments. */
  settle: 1,
  /** Seconds after a gesture of the player's before a stretch can count as quiet. */
  gesture: 3,
  /** Real seconds of warning wanted before something scheduled appears (more than `down`, so the pace is back to usual first). */
  lookahead: 2,
  /** The most the player's speed and the boost together may reach. */
  cap: 5,
} as const;

const smooth = (k: number): number => k * k * (3 - 2 * k);

export class QuietPace {
  /** 0..1 along the ease. */
  private k = 0;
  /** Seconds quiet so far. */
  private calm = 0;
  /** The multiplier now applied on top of the player's speed. */
  boost = 1;

  /**
   * Moves the ease on by `dt` real seconds and returns the multiplier to apply
   * on top of `speed` (the player's chosen speed, which it never undoes).
   */
  step(dt: number, quiet: boolean, speed: number): number {
    if (dt <= 0) return this.boost;
    if (!quiet) {
      this.calm = 0;
      this.k = Math.max(0, this.k - dt / QUIET.down);
    } else {
      this.calm += dt;
      if (this.calm >= QUIET.settle) this.k = Math.min(1, this.k + dt / QUIET.up);
    }
    const top = clamp(QUIET.cap / Math.max(1, speed), 1, QUIET.boost);
    this.boost = 1 + (top - 1) * smooth(this.k);
    return this.boost;
  }

  /** Back to the usual pace at once (a new day, a phase that keeps its own pace). */
  reset(): void {
    this.k = 0;
    this.calm = 0;
    this.boost = 1;
  }
}

/**
 * Rules seconds to look ahead for something scheduled, so the pace is back to
 * usual before it shows: `QUIET.lookahead` real seconds at the current rate.
 */
export function lookaheadSeconds(rate: number): number {
  return QUIET.lookahead * Math.max(1, rate);
}

/**
 * Smoothing between scene snapshots.
 *
 * The rules publish a new `AdventureScene` about ten times a second, but the
 * valley is drawn sixty times a second. A `Follower` glides from where it is
 * drawn now to each new target over the measured interval between targets,
 * so a walker moves at an even pace instead of hopping, and nothing ever
 * snaps. An `ActionClock` does the same for a pose's 0..1 `action`, and runs
 * on its own when the rules leave `action` still.
 */

/** Longest believable jump between snapshots; anything further fades out and in rather than sliding across the map. */
export const JUMP = 360;

export class Follower {
  /** Drawn position. */
  x = 0;
  y = 0;
  /** Drawn speed, world px per second. */
  speed = 0;
  /** Set for one step after a target too far away to glide to; the owner fades through it. */
  jumped = false;
  private fromX = 0;
  private fromY = 0;
  private toX = 0;
  private toY = 0;
  private t = 1;
  /** Seconds between targets, measured and smoothed. */
  private interval = 0.1;
  private sinceTarget = 0;
  private started = false;
  /** Seconds left standing still on purpose (a wave before setting off). */
  private holding = 0;
  /** Speed the targets are moving at, world px per second. */
  private targetSpeed = 0;

  /** Offers the latest target. Only a changed target restarts the glide. */
  target(x: number, y: number): void {
    if (!this.started) {
      this.started = true;
      this.x = this.fromX = this.toX = x;
      this.y = this.fromY = this.toY = y;
      return;
    }
    if (x === this.toX && y === this.toY) return;
    if (Math.hypot(x - this.x, y - this.y) > JUMP) {
      this.x = this.fromX = this.toX = x;
      this.y = this.fromY = this.toY = y;
      this.t = 1;
      this.jumped = true;
      return;
    }
    // Long pauses (a friend standing, then setting off) do not count as the cadence.
    const sample = Math.min(0.3, Math.max(0.016, this.sinceTarget));
    this.interval += (sample - this.interval) * 0.3;
    const stepped = Math.hypot(x - this.toX, y - this.toY) / sample;
    this.targetSpeed += (stepped - this.targetSpeed) * 0.3;
    this.sinceTarget = 0;
    this.fromX = this.x;
    this.fromY = this.y;
    this.toX = x;
    this.toY = y;
    this.t = 0;
  }

  /** Stands still for `seconds` whatever the targets do, then catches up at a brisk walk. */
  hold(seconds: number): void {
    this.holding = seconds;
  }

  /** Moves the drawn position on by `dt`; returns the distance moved. */
  step(dt: number): number {
    this.sinceTarget += dt;
    const px = this.x;
    const py = this.y;
    if (this.holding > 0) {
      this.holding -= dt;
      this.fromX = this.x;
      this.fromY = this.y;
      this.t = 0;
    } else if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / this.interval);
      let nx = this.fromX + (this.toX - this.fromX) * this.t;
      let ny = this.fromY + (this.toY - this.fromY) * this.t;
      // Behind after a hold: hurry, but at a walker's pace rather than a dash.
      const limit = Math.max(30, this.targetSpeed * 1.7) * dt;
      const d = Math.hypot(nx - px, ny - py);
      if (d > limit) {
        nx = px + ((nx - px) / d) * limit;
        ny = py + ((ny - py) / d) * limit;
        this.fromX = nx;
        this.fromY = ny;
        this.t = 0;
      }
      this.x = nx;
      this.y = ny;
    }
    const moved = Math.hypot(this.x - px, this.y - py);
    const instant = dt > 0 ? moved / dt : 0;
    this.speed += (instant - this.speed) * Math.min(1, dt * 10);
    return moved;
  }

  /** Horizontal direction of travel, or 0 when still. */
  get heading(): number {
    const dx = this.toX - this.fromX;
    return this.t < 1 && Math.abs(dx) > 0.3 ? Math.sign(dx) : 0;
  }
}

/** Wraps a phase difference into -0.5..0.5. */
const wrapHalf = (d: number): number => d - Math.round(d);

export class ActionClock {
  /** Phase through the current action, 0..1. */
  value = Math.random();
  private last = -1;
  private sinceChange = 99;
  private rate = 0;

  /**
   * `scene` is the rules' action; `period` the seconds one cycle takes when the
   * rules are not driving it.
   */
  step(scene: number, dt: number, period: number): void {
    this.sinceChange += dt;
    if (scene !== this.last) {
      if (this.last >= 0 && this.sinceChange < 0.6) {
        const d = ((scene - this.last) % 1 + 1) % 1;
        if (d < 0.5) this.rate += (d / Math.max(0.016, this.sinceChange) - this.rate) * 0.5;
      }
      // Drift toward the rules' phase rather than jumping to it.
      this.value += wrapHalf(scene - this.value) * 0.5;
      this.last = scene;
      this.sinceChange = 0;
    }
    const driven = this.sinceChange < 1.2 && this.rate > 0;
    this.value = (((this.value + dt * (driven ? this.rate : 1 / period)) % 1) + 1) % 1;
  }
}

/** A small deterministic hash, for timing that varies per person but never in unison. */
export function hash01(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** A stable number for a string id. */
export function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Eases `current` toward `target` at `rate` per second, frame-rate independent. */
export function approach(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * dt);
}

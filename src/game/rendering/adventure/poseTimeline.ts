/**
 * Which painted frame a figure shows, and when the little events of a pose
 * happen (the cast going out, the strike, a hammer blow, a sprig plucked).
 *
 * `actionFrame` turns a scene pose and its 0..1 phase into a frame. Idle is
 * handled by `IdleBusiness`, which keeps a figure that is only standing about
 * from ever being still: weight shifts, glances, settling the hat, and, after
 * a few seconds in one spot, a step or two and back, or a crouch to look at
 * something. Timing is seeded per person so no two move in unison.
 */

import type { Pose } from '../../adventure/model';
import { FRAME_COUNT, type FramePose, STRIDE } from '../placeholders/explorerRig';
import { hash01 } from './motion';

export type Cue = 'none' | 'cast' | 'strike' | 'blow' | 'pluck' | 'poke';

/** What a figure can show: the painted poses, plus Haru's tracking. */
export type ShownPose = FramePose | 'track';

export interface Shown {
  pose: ShownPose;
  frame: number;
  /** Facing away from the scene's facing for a moment (looking back, strolling back). */
  turned: boolean;
  /** Happens on entering this frame. */
  cue: Cue;
  /** Cosmetic sideways offset from the scene position, world px. */
  offset: number;
  /** Breathing applies (standing or sitting still). */
  breathe: boolean;
}

export function newShown(): Shown {
  return { pose: 'idle', frame: 0, turned: false, cue: 'none', offset: 0, breathe: true };
}

/** Seconds per cycle when the rules leave `action` still. */
export const PERIOD: Record<Pose, number> = {
  idle: 6,
  walk: 1,
  carry: 1,
  fish: 9,
  forage: 4.6,
  look: 6.5,
  talk: 3,
  build: 1.15,
  sit: 7,
  wave: 1.4,
  track: 5,
};

function set(out: Shown, pose: ShownPose, frame: number, cue: Cue = 'none', breathe = false, turned = false): void {
  out.pose = pose;
  out.frame = frame;
  out.cue = cue;
  out.breathe = breathe;
  out.turned = turned;
}

/** Frame of a walk cycle from the distance walked, so the feet stay planted. */
export function strideFrame(distance: number, pose: 'walk' | 'carry'): number {
  const n = FRAME_COUNT[pose];
  const k = ((distance / STRIDE) % 1 + 1) % 1;
  return Math.floor(k * n) % n;
}

/**
 * Frame for every pose except idle and walking. `phase` is the action's
 * 0..1; `t` is the figure's own clock in seconds; `seed` varies timing per person.
 */
export function actionFrame(pose: Pose, phase: number, t: number, seed: number, out: Shown): void {
  out.offset = 0;
  switch (pose) {
    case 'fish':
      if (phase < 0.1) set(out, 'fish', 0);
      else if (phase < 0.18) set(out, 'fish', 1, 'cast');
      else if (phase < 0.84) set(out, 'fish', 2, 'none', true);
      else if (phase < 0.92) set(out, 'fish', 3, 'strike');
      else set(out, 'fish', 2, 'none', true);
      return;
    case 'forage':
      if (phase < 0.28) set(out, 'forage', 0, 'none', true);
      else if (phase < 0.48) set(out, 'forage', 1);
      else if (phase < 0.74) set(out, 'forage', 2, 'pluck');
      else set(out, 'forage', 3);
      return;
    case 'look':
      if (phase < 0.26) set(out, 'look', 0, 'none', true);
      else if (phase < 0.5) set(out, 'look', 1, 'none', true, true);
      else if (phase < 0.56) set(out, 'look', 0, 'none', true);
      else set(out, 'look', Math.floor(t * 1.3 + seed) % 2 === 0 ? 2 : 3);
      return;
    case 'talk': {
      // Gestures change about every two thirds of a second, in an order of their own.
      const beat = Math.floor(t * 1.5 + seed * 7);
      set(out, 'talk', Math.floor(hash01(beat + seed * 131) * 3), 'none', true);
      return;
    }
    case 'build':
      if (phase < 0.42) set(out, 'build', 0);
      else if (phase < 0.56) set(out, 'build', 1);
      else if (phase < 0.84) set(out, 'build', 2, 'blow');
      else set(out, 'build', 1);
      return;
    case 'sit': {
      // Warming hands, rubbing them, warming again, on an unhurried rhythm of their own.
      const beat = Math.floor(t / 2.6 + seed * 3);
      set(out, 'sit', hash01(beat + seed * 17) < 0.6 ? 0 : 1, 'none', true);
      return;
    }
    case 'track':
      // Bent to the ground, reading the signs, then rising to look along them.
      set(out, 'track', Math.min(3, Math.floor(phase * 4)), 'none', true);
      return;
    case 'wave': {
      const order = [0, 2, 1, 2];
      set(out, 'wave', order[Math.floor(t * 5) % 4]!);
      return;
    }
    default:
      set(out, 'idle', 0, 'none', true);
  }
}

// ── Idle business ──────────────────────────────────────────────────────────

type Business = 'rest' | 'shift' | 'glance' | 'hat' | 'clasp' | 'stroll' | 'crouch' | 'gaze' | 'tend';

/** How long each kind of business lasts, in seconds (min, max). */
const LENGTH: Record<Business, [number, number]> = {
  rest: [1.6, 3.6],
  shift: [2, 4],
  glance: [1.2, 2.2],
  hat: [0.9, 1.4],
  clasp: [3, 5],
  stroll: [3.5, 5],
  crouch: [2.4, 3.6],
  gaze: [1.8, 2.8],
  tend: [3, 5],
};

/** Paces a figure walks when strolling about its spot, world px per second. */
const STROLL_SPEED = 16;

export class IdleBusiness {
  private kind: Business = 'rest';
  private left = 0;
  private count: number;
  /** Where the stroll is heading, relative to the spot. */
  private goal = 0;
  private walked = 0;
  private clock = 0;
  offset = 0;

  constructor(private readonly seed: number) {
    this.count = seed % 97;
    this.left = 0.5 + hash01(seed) * 2.5;
  }

  /** Stops any stroll at once (the figure has been sent somewhere). */
  reset(): void {
    this.kind = 'rest';
    this.left = 1 + hash01(this.count++ + this.seed) * 2;
    this.goal = 0;
  }

  /**
   * `still` is how long the figure has stood on this spot; `fireside` is true
   * near a burning camp fire. Fills `out` with the frame to show.
   */
  step(dt: number, still: number, fireside: boolean, reduced: boolean, out: Shown): void {
    this.clock += dt;
    this.left -= dt;
    if (this.left <= 0 && Math.abs(this.offset - this.goal) < 0.5) this.choose(still, fireside, reduced);
    out.cue = 'none';
    out.turned = false;
    out.breathe = true;
    // Strolls walk out, pause, and walk back to the spot.
    if (this.kind === 'stroll' && this.left < LENGTH.stroll[0] * 0.45) this.goal = 0;
    const gap = this.goal - this.offset;
    if (Math.abs(gap) > 0.3) {
      const move = Math.sign(gap) * Math.min(Math.abs(gap), STROLL_SPEED * dt);
      this.offset += move;
      this.walked += Math.abs(move);
      out.pose = 'walk';
      out.frame = strideFrame(this.walked, 'walk');
      out.turned = gap < 0;
      out.breathe = false;
      out.offset = this.offset;
      return;
    }
    out.offset = this.offset;
    switch (this.kind) {
      case 'shift':
        out.pose = 'idle';
        out.frame = 1;
        break;
      case 'glance':
        out.pose = 'idle';
        out.frame = 2;
        break;
      case 'hat':
        out.pose = 'idle';
        out.frame = 3;
        break;
      case 'clasp':
        out.pose = 'idle';
        out.frame = 4;
        break;
      case 'crouch':
        out.pose = 'forage';
        out.frame = this.left > 1.2 ? 0 : 2;
        break;
      case 'gaze':
        out.pose = 'look';
        out.frame = 0;
        break;
      case 'tend': {
        out.pose = 'tend';
        const poke = Math.floor(this.clock * 0.9 + this.seed) % 2;
        out.frame = poke;
        out.cue = poke === 1 ? 'poke' : 'none';
        break;
      }
      default:
        out.pose = 'idle';
        out.frame = 0;
        // Facing back the way they came after a stroll.
        out.turned = this.kind === 'stroll' && this.walked > 0 && Math.floor(this.clock) % 2 === 0 && this.left > 1;
        break;
    }
  }

  private choose(still: number, fireside: boolean, reduced: boolean): void {
    const r = hash01(this.seed * 31 + this.count++);
    let next: Business;
    if (fireside && r < 0.4) next = 'tend';
    else if (still > 4 && !reduced && r < 0.58) next = 'stroll';
    else if (still > 4 && r < 0.7) next = 'crouch';
    else if (r < 0.74) next = 'gaze';
    else if (r < 0.82) next = 'glance';
    else if (r < 0.88) next = 'hat';
    else if (r < 0.93) next = 'clasp';
    else next = 'shift';
    // Never the same small business twice running, and rest between them.
    if (next === this.kind) next = 'rest';
    if (this.kind !== 'rest' && r > 0.5) next = 'rest';
    this.kind = next;
    const [lo, hi] = LENGTH[next];
    this.left = lo + (hi - lo) * hash01(this.seed + this.count * 7);
    if (next === 'stroll') {
      const side = hash01(this.seed + this.count * 13) < 0.5 ? -1 : 1;
      this.goal = side * (8 + hash01(this.count + this.seed * 3) * 6);
    }
  }
}

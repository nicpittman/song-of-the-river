/**
 * Camp life by day: whoever stays home keeps busy round the fire while the
 * others are out. They tend the fire, fetch an armful from the woodpile, see
 * to the garden, fish from the bank when the water is close, do their own
 * thing (Aki hammering at a building going up, Mina gathering, Haru reading
 * tracks, Yui telling a story, Sora looking out), and between these walk the
 * camp's own paths (routes from the walking map, so nobody crosses water,
 * a wall or a bridge's sides). Toward dusk each heads back to their seat, so
 * the evening begins where the rules expect them.
 *
 * Builders stay with the rules: they walk to the site and back by the
 * rules' own route. At the site the view only adds a short trip for timber
 * now and then, so a builder without hammering frames of their own still
 * looks at work.
 *
 * View only: the rules never see any of this. Timing is the layer's own
 * clock (real seconds), seeded per person so no two move in unison.
 */

import type { Pose } from '../../adventure/model';
import { routeLength, alongRoute } from '../../adventure/navigation';
import type { Vec } from '../../core/math';
import type { River } from '../../world/river';
import type { FrameInfo } from './frame';
import { hash01 } from './motion';
import { PERIOD } from './poseTimeline';

/** A friend staying home today, as the session reads it from the rules. */
export interface HomeInfo {
  id: string;
  /** The fire they live round, and their seat at it. */
  fire: Vec;
  seat: Vec;
  /** The camp's own spots (a door, the woodshed, the landing), for a short errand. */
  spots: readonly Vec[];
  /** Walks to a building site and works there (the rules move them; see `builderLife`). */
  builder: boolean;
}

/** The ordinary day, as far as camp life needs it. Null on every other kind of day. */
export interface CampDay {
  /** 0..1 through the day. */
  progress: number;
  /** Real seconds until everyone gathers at the fire for the evening. */
  homeIn: number;
  /** Wander: the camp keeps a quieter pace. */
  quiet: boolean;
  people: readonly HomeInfo[];
  /** A walking route between two points by today's ground, or null where there is none. */
  route: ((from: Vec, to: Vec) => Vec[] | null) | null;
}

/** Something carried or set down. */
export type Prop = 'wood' | 'basket' | 'basket-down' | null;

/** What camp life asks a figure to show this frame. */
export interface CampAct {
  x: number;
  y: number;
  pose: Pose;
  /** 0..1 through the pose's action. */
  action: number;
  facing: 1 | -1;
  prop: Prop;
  /** Tending: crouched at the fire, poking it now and then. */
  tend: boolean;
  /** Set for one frame when an armful is laid on the fire. */
  drop: boolean;
}

export function newCampAct(): CampAct {
  return { x: 0, y: 0, pose: 'idle', action: 0, facing: 1, prop: null, tend: false, drop: false };
}

type Kind = 'tend' | 'wood' | 'garden' | 'fish' | 'own' | 'rest' | 'errand' | 'home' | 'timber';

interface Walk {
  walk: true;
  points: Vec[];
  length: number;
  travelled: number;
  prop: Prop;
}

interface Stay {
  walk: false;
  at: Vec;
  pose: Pose;
  left: number;
  facing: 1 | -1;
  prop: Prop;
  tend: boolean;
  /** Lays an armful on the fire as the stay begins. */
  drop: boolean;
}

type Step = Walk | Stay;

/** Unhurried pottering, world px per real second; a little slower laden. */
const PACE = 44;
const LADEN = 38;
/** Where the camp's woodpile lies from the fire (see `camp.ts`), and where one stands to take from it. */
const WOODPILE: Vec = { x: -56, y: 12 };
/** Within this of the fire, the garden, the bank or a building site counts as part of camp. */
const NEAR = 320;
/** Seconds of margin kept when heading back to the seat before dusk. */
const HOME_MARGIN = 1.5;

/** Where someone can stand to fish within reach of a fire, and which way the water lies, cached per fire. */
const banks = new Map<string, { at: Vec; facing: 1 | -1 } | null>();

export function bankNear(river: River | null, fire: Vec): { at: Vec; facing: 1 | -1 } | null {
  if (!river) return null;
  const key = `${Math.round(fire.x)},${Math.round(fire.y)}`;
  if (banks.has(key)) return banks.get(key)!;
  let best: { at: Vec; facing: 1 | -1 } | null = null;
  let bestD = Infinity;
  for (let r = 70; r <= 230 && !best; r += 32) {
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const at = { x: Math.round(fire.x + Math.cos(angle) * r), y: Math.round(fire.y + Math.sin(angle) * r * 0.7) };
      const edge = river.edgeDistance(at);
      if (edge < 36 || edge > 52) continue;
      // The float lands about 50 px in front of the angler: it must land in the water.
      const right = river.edgeDistance({ x: at.x + 50, y: at.y + 6 }) < -4;
      const left = river.edgeDistance({ x: at.x - 50, y: at.y + 6 }) < -4;
      if (!right && !left) continue;
      const facing: 1 | -1 = right ? 1 : -1;
      const d = Math.hypot(at.x - fire.x, at.y - fire.y);
      if (d < bestD) { bestD = d; best = { at, facing }; }
    }
  }
  banks.set(key, best);
  return best;
}

const facingTo = (from: Vec, to: Vec, fallback: 1 | -1 = 1): 1 | -1 => (Math.abs(to.x - from.x) < 1 ? fallback : to.x > from.x ? 1 : -1);

/** One friend's camp life. */
export class CampLife {
  private steps: Step[] = [];
  private x = NaN;
  private y = NaN;
  private count = 0;
  private last: Kind = 'rest';
  private homeward = false;
  /** Builders only: the rules' work spot this stretch of work is anchored to. */
  private anchor: Vec | null = null;
  /** Own clock for the actions, real seconds. */
  private clock: number;

  constructor(
    private readonly seed: number,
    /** The person's own action, where they have the frames for it (see `Wardrobe.signature`). */
    private readonly signature: Pose | null,
  ) {
    this.clock = hash01(seed + 11) * 20;
  }

  get active(): boolean {
    return !Number.isNaN(this.x);
  }

  /** Lets the rules have the figure back. */
  reset(): void {
    this.steps.length = 0;
    this.x = NaN;
    this.y = NaN;
    this.homeward = false;
    this.anchor = null;
  }

  /**
   * A friend staying home: the whole of their day at camp. `from` is where
   * they are drawn now (used when camp life takes over).
   */
  home(info: HomeInfo, from: Vec, day: CampDay, f: FrameInfo, river: River | null, gardens: readonly Vec[], out: CampAct): CampAct {
    if (!this.active) {
      this.x = from.x;
      this.y = from.y;
      // A moment's pause first, so those at home do not all start off together.
      this.stay({ x: from.x, y: from.y }, 'idle', 0.6 + hash01(this.seed) * 2.2, facingTo(from, info.fire));
    }
    // Toward dusk, back to the seat in good time.
    if (!this.homeward) {
      const d = Math.hypot(info.seat.x - this.x, info.seat.y - this.y);
      if (day.homeIn < d / PACE * 1.4 + HOME_MARGIN + 2) {
        this.homeward = true;
        this.steps.length = 0;
        this.walkTo({ x: this.x, y: this.y }, info.seat, null, day);
        this.stay(info.seat, 'idle', 99, facingTo(info.seat, info.fire));
      }
    }
    out.drop = false;
    this.advance(f.dt, out);
    if (!this.steps.length) this.plan(info, day, f, river, gardens);
    return this.fill(out);
  }

  /**
   * A builder at the site: mostly the rules' own work there, with a short
   * trip for timber now and then. Returns null while the rules' pose is shown.
   */
  build(at: Vec, facing: 1 | -1, day: CampDay, f: FrameInfo, out: CampAct): CampAct | null {
    if (!this.anchor || Math.hypot(at.x - this.anchor.x, at.y - this.anchor.y) > 4) {
      // Just arrived (or moved on): the rules lead for a while first.
      this.reset();
      this.anchor = { x: at.x, y: at.y };
      this.x = at.x;
      this.y = at.y;
      this.stay(at, 'build', 3 + hash01(this.seed + 3) * 4, facing);
    }
    out.drop = false;
    this.advance(f.dt, out);
    if (!this.steps.length) {
      const k = this.count++;
      const hammers = this.signature === 'build';
      const r = hash01(this.seed * 7 + k);
      // Fetch timber from a pile a few steps aside (Aki less often: she has her hammering).
      if (day.homeIn > 8 && r < (hammers ? 0.35 : 0.7) && day.route) {
        const side = hash01(this.seed + k * 5) < 0.5 ? -1 : 1;
        const there = day.route(at, { x: at.x + side * (30 + r * 14), y: at.y + 6 });
        if (there && there.length && routeLength(there) < 90) {
          const pile = there[there.length - 1]!;
          this.walk([at, ...there], null);
          this.stay(pile, 'forage', 0.9, side < 0 ? -1 : 1);
          this.walk([...there].reverse().concat([at]), 'wood');
          this.stay(at, 'build', 0.5, facing, 'wood');
        }
      }
      if (!this.steps.length) this.stay(at, 'build', (hammers ? 6 : 3.5) + r * 3, facing);
    }
    this.fill(out);
    // At the work spot itself, empty-handed, the rules' own pose stands.
    return out.pose === 'build' && !out.prop && Math.hypot(out.x - at.x, out.y - at.y) < 1 ? null : out;
  }

  // ── Steps ────────────────────────────────────────────────────────────────

  private advance(dt: number, out: CampAct): void {
    this.clock += dt;
    let left = dt;
    while (left > 0 && this.steps.length) {
      const step = this.steps[0]!;
      if (step.walk) {
        const pace = step.prop === 'wood' ? LADEN : PACE;
        const need = (step.length - step.travelled) / pace;
        const used = Math.min(left, need);
        step.travelled += used * pace;
        left -= used;
        const p = alongRoute(step.points, Math.min(step.length, step.travelled));
        this.x = p.x;
        this.y = p.y;
        if (step.travelled >= step.length - 0.01) {
          this.steps.shift();
          const next = this.steps[0];
          if (next && !next.walk && next.drop) out.drop = true;
        }
      } else {
        const used = Math.min(left, step.left);
        step.left -= used;
        left -= used;
        this.x = step.at.x;
        this.y = step.at.y;
        if (step.left <= 0) this.steps.shift();
        else break;
      }
    }
  }

  private fill(out: CampAct): CampAct {
    out.x = this.x;
    out.y = this.y;
    const step = this.steps[0];
    if (!step) {
      out.pose = 'idle';
      out.prop = null;
      out.tend = false;
      return out;
    }
    if (step.walk) {
      const ahead = alongRoute(step.points, Math.min(step.length, step.travelled + 6));
      out.pose = step.prop === 'wood' ? 'carry' : 'walk';
      out.facing = facingTo({ x: this.x, y: this.y }, ahead, out.facing);
      out.prop = step.prop;
      out.tend = false;
      out.action = (step.travelled / 40) % 1;
      return out;
    }
    out.pose = step.pose;
    out.facing = step.facing;
    out.prop = step.prop;
    out.tend = step.tend;
    // The layer's clock drives the action: a steady cycle at the pose's own period.
    out.action = (this.clock / PERIOD[step.pose]) % 1;
    return out;
  }

  private stay(at: Vec, pose: Pose, seconds: number, facing: 1 | -1, prop: Prop = null, tend = false, drop = false): void {
    this.steps.push({ walk: false, at, pose, left: seconds, facing, prop, tend, drop });
  }

  private walk(points: Vec[], prop: Prop): void {
    const length = routeLength(points);
    if (length > 0.5) this.steps.push({ walk: true, points, length, travelled: 0, prop });
  }

  /** Walks from `from` to `to` by today's ground; returns where the walk ends, or null if there is no way. */
  private walkTo(from: Vec, to: Vec, prop: Prop, day: CampDay): Vec | null {
    const near = Math.hypot(to.x - from.x, to.y - from.y);
    if (near < 2) return from;
    const route = day.route ? day.route(from, to) : null;
    if (!route || route.length === 0) {
      // Without a walking map, only a step or two in the open.
      if (day.route || near > 60) return null;
      this.walk([from, to], prop);
      return to;
    }
    // Never a long way round for a small errand.
    if (routeLength(route) > Math.max(160, near * 2.2)) return null;
    const first = route[0]!;
    this.walk(Math.hypot(first.x - from.x, first.y - from.y) > 1 ? [from, ...route] : route, prop);
    return route[route.length - 1]!;
  }

  // ── Choosing the next thing to do ────────────────────────────────────────

  private plan(info: HomeInfo, day: CampDay, f: FrameInfo, river: River | null, gardens: readonly Vec[]): void {
    const here = { x: this.x, y: this.y };
    const fire = info.fire;
    const k = this.count++;
    const r = (n: number): number => hash01(this.seed * 13 + k * 31 + n);
    const slow = day.quiet ? 1.5 : 1;
    const garden = gardens.find((g) => Math.hypot(g.x - fire.x, g.y - fire.y) < NEAR) ?? null;
    const bank = bankNear(river, fire);
    const site = f.sites.find((s) => Math.hypot(s.x - fire.x, s.y - fire.y) < NEAR) ?? null;
    const own = this.signature === 'build' ? (site ? 'build' : null) : this.signature === 'fish' ? (bank ? 'fish' : null) : this.signature;
    const options: Array<[Kind, number]> = [
      ['tend', 3],
      ['wood', day.quiet ? 1 : 2.5],
      ['garden', garden ? 2 : 0],
      ['fish', bank ? (this.signature === 'fish' ? 3 : 0.8) : 0],
      ['own', own ? (day.quiet ? 3 : 2.2) : 0],
      ['rest', day.quiet ? 2.4 : 1.2],
      ['errand', info.spots.length ? 1.2 : 0],
    ];
    let total = 0;
    for (const [kind, w] of options) if (kind !== this.last) total += w;
    let pick = r(1) * total;
    let kind: Kind = 'rest';
    for (const [option, w] of options) {
      if (option === this.last || w <= 0) continue;
      pick -= w;
      if (pick <= 0) { kind = option; break; }
    }
    this.last = kind;
    // The fire side away from the seat's neighbours: the side the seat is on.
    const side: 1 | -1 = info.seat.x < fire.x ? -1 : 1;
    const hearth = { x: fire.x + side * 27, y: fire.y + 7 };
    const faceFire: 1 | -1 = side > 0 ? -1 : 1;
    switch (kind) {
      case 'tend':
        if (this.walkTo(here, hearth, null, day)) this.stay(hearth, 'idle', (4.5 + r(2) * 3) * slow, faceFire, null, true);
        break;
      case 'wood': {
        const pile = { x: fire.x + WOODPILE.x, y: fire.y + WOODPILE.y };
        const at = this.walkTo(here, pile, null, day);
        if (!at) break;
        this.stay(at, 'forage', 1.1, fire.x > at.x ? -1 : 1);
        const back = this.walkTo(at, hearth, 'wood', day);
        if (!back) break;
        // Laid on the fire, and a little tending after.
        this.stay(hearth, 'idle', (2.5 + r(3) * 2) * slow, faceFire, null, true, true);
        break;
      }
      case 'garden': {
        const spot = { x: garden!.x + (r(4) - 0.5) * 26, y: garden!.y + 20 };
        const at = this.walkTo(here, spot, 'basket', day);
        if (at) this.stay(at, 'forage', (6 + r(5) * 3) * slow, r(6) < 0.5 ? -1 : 1, 'basket-down');
        break;
      }
      case 'fish': {
        const at = this.walkTo(here, bank!.at, null, day);
        if (at) this.stay(at, 'fish', (9 + r(7) * 5) * slow, bank!.facing);
        break;
      }
      case 'own': {
        const pose = own!;
        if (pose === 'build') {
          const spot = { x: site!.x - 26 + r(8) * 10, y: site!.y + 26 };
          const at = this.walkTo(here, spot, null, day);
          if (at) this.stay(at, 'build', (6 + r(9) * 4) * slow, site!.x > at.x ? 1 : -1);
        } else if (pose === 'fish') {
          const at = this.walkTo(here, bank!.at, null, day);
          if (at) this.stay(at, 'fish', (10 + r(9) * 5) * slow, bank!.facing);
        } else {
          // Near their seat, a little out from the fire.
          const spot = { x: info.seat.x + side * (14 + r(10) * 18), y: info.seat.y + (r(11) - 0.5) * 16 };
          const at = this.walkTo(here, spot, null, day);
          if (at) this.stay(at, pose, (5 + r(12) * 3) * slow, facingTo(at, fire));
        }
        break;
      }
      case 'errand': {
        const spot = info.spots[Math.floor(r(13) * info.spots.length)]!;
        if (Math.hypot(spot.x - fire.x, spot.y - fire.y) > NEAR) break;
        const at = this.walkTo(here, spot, null, day);
        if (at) this.stay(at, r(14) < 0.5 ? 'look' : 'forage', (3 + r(15) * 2) * slow, facingTo(at, fire));
        break;
      }
      default:
        break;
    }
    // Nothing reachable, or a rest: a pause at the seat (idle life fills it).
    if (!this.steps.length) {
      if (this.walkTo(here, info.seat, null, day)) this.stay(info.seat, 'idle', (2.5 + r(16) * 2.5) * slow, facingTo(info.seat, fire));
      else this.stay(here, 'idle', 2 + r(17) * 2, facingTo(here, fire));
    }
  }
}

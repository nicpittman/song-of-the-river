/**
 * Which frames a person wears for each pose, and where things hang off them.
 *
 * Illustrated frames (`sora-walk-0` and so on, from the art library) are used
 * wherever they exist. A pose with no illustration of its own borrows the
 * person's illustrated standing frame when that still tells the truth (talking,
 * looking about, waving, waiting with a rod), and falls back to the painted
 * figure from `placeholders/explorers.ts` only where nothing illustrated can
 * serve: sitting, kneeling, crouching at the fire, hammering. A walk cycle is
 * always one art style from end to end.
 *
 * Painted figures are drawn at the illustrated figures' height, so a friend
 * keeps the same size whichever art is showing.
 */

import type { ArtLibrary } from '../art';
import { FRAME_COUNT, type FramePose, type Pt, explorerFrameId } from '../placeholders/explorerRig';
import { LOOKS } from '../placeholders/explorers';
import type { ShownPose } from './poseTimeline';
import { pointsOf } from './rigTable';


export interface Outfit {
  /** Art ids, in order. */
  ids: string[];
  /** Scale applied to the art's own size. */
  scale: number;
  painted: boolean;
  /** For painted outfits: the rig pose and frame behind each id, for attachment points. */
  rigPose: FramePose;
  rigFrames: number[];
  /** World px covered by one walk cycle, so feet stay planted. */
  stride: number;
  /** No fishing art: draw a rod and line from the hand. */
  rod: boolean;
}

/** Points on an illustrated figure, in world px from its feet, facing right. */
interface Fittings {
  /** Top of whatever is on the back, where the pack knot is tied. */
  knot: Pt;
  /** The near hand, for a borrowed rod. */
  hand: Pt;
  lantern: Pt | null;
  /** Where the painted fishing line meets the water, for ripples. */
  lineEnd: Pt | null;
}

const FITTINGS: Record<string, Fittings> = {
  sora: { knot: [-9, -44], hand: [6, -25], lantern: null, lineEnd: null },
  ren: { knot: [-8, -37], hand: [6, -25], lantern: null, lineEnd: [43, -2] },
  mina: { knot: [-8, -38], hand: [6, -24], lantern: null, lineEnd: null },
  aki: { knot: [-10, -41], hand: [6, -25], lantern: null, lineEnd: null },
  yui: { knot: [-8, -38], hand: [6, -25], lantern: [-3, -15], lineEnd: null },
  haru: { knot: [-9, -42], hand: [6, -25], lantern: null, lineEnd: null },
};
const DEFAULT_FITTINGS: Fittings = { knot: [-8, -38], hand: [6, -24], lantern: null, lineEnd: null };

const SIGNATURES: Record<string, ShownPose> = { haru: 'track', yui: 'talk', sora: 'look', mina: 'forage', aki: 'build' };

/** Painted figures stand about 57 px; illustrated ones about 48. */
const PAINTED_SCALE = 0.84;
/** Villagers are a touch smaller than the friends, who stay the stars. */
const VILLAGER_SCALE = 0.78;
/** One walk cycle in the illustrated walks (two steps), measured from the frames' footfalls. */
const ILLUSTRATED_STRIDE = 38;
const PAINTED_STRIDE = 30;

export class Wardrobe {
  private readonly outfits = new Map<ShownPose, Outfit>();
  private readonly fittings: Fittings;
  private readonly k: number;
  private readonly frameLook: string;
  private readonly paintedScale: number;
  /** The illustrated standing frame, if this person has one. */
  readonly stand: Outfit | null;
  /** One shared front-facing pivot, available only for illustrated friends. */
  readonly turn: Outfit | null;

  constructor(
    readonly look: string,
    private readonly art: ArtLibrary,
    villager: boolean,
  ) {
    this.frameLook = villager && look.startsWith('villager-') && !art.has(`${look}-idle-0`) && art.has('villager-idle-0') ? 'villager' : look;
    this.fittings = FITTINGS[look] ?? DEFAULT_FITTINGS;
    this.k = (LOOKS as Record<string, { k: number } | undefined>)[look]?.k ?? 1;
    this.paintedScale = villager ? VILLAGER_SCALE : PAINTED_SCALE;
    this.stand = this.illustrated('idle', 1) ?? this.illustrated('walk', 1, 1);
    this.turn = this.illustrated('turn', 1) ?? (villager && art.has('villager-turn-0') ? { ids:['villager-turn-0'], scale:1, painted:false, rigPose:'idle', rigFrames:[], stride:ILLUSTRATED_STRIDE, rod:false } : null);
  }

  /** How many illustrated frames a pose has. */
  private count(pose: string): number {
    let n = 0;
    while (this.art.has(explorerFrameId(this.frameLook, pose as FramePose, n))) n++;
    return n;
  }

  /** An outfit from illustrated frames, or null. `take`/`from` pick a run of them. */
  private illustrated(pose: string, take = Infinity, from = 0): Outfit | null {
    const n = this.count(pose);
    if (n <= from) return null;
    const ids: string[] = [];
    for (let i = from; i < Math.min(n, from + take); i++) ids.push(explorerFrameId(this.frameLook, pose as FramePose, i));
    return { ids, scale: 1, painted: false, rigPose: 'idle', rigFrames: [], stride: ILLUSTRATED_STRIDE, rod: false };
  }

  private painted(pose: FramePose, frames?: number[]): Outfit {
    const rigFrames = frames ?? Array.from({ length: FRAME_COUNT[pose] }, (_, i) => i);
    return { ids: rigFrames.map((i) => explorerFrameId(this.look, pose, i)), scale: this.paintedScale, painted: true, rigPose: pose, rigFrames, stride: PAINTED_STRIDE, rod: false };
  }

  /** The outfit for a pose. */
  outfit(pose: ShownPose): Outfit {
    let outfit = this.outfits.get(pose);
    if (!outfit) {
      outfit = this.choose(pose);
      this.outfits.set(pose, outfit);
    }
    return outfit;
  }

  private choose(pose: ShownPose): Outfit {
    const stand = this.stand;
    switch (pose) {
      case 'walk':
        return this.illustrated('walk') ?? stand ?? this.painted('walk');
      case 'carry': {
        // Laden: the same walk, a little shorter in the step.
        const walk = this.illustrated('walk');
        return walk ? { ...walk, stride: ILLUSTRATED_STRIDE * 0.9 } : stand ?? this.painted('carry');
      }
      case 'idle':
        return stand ?? this.painted('idle');
      case 'look':
        return this.illustrated('look') ?? stand ?? this.painted('look');
      case 'talk':
        return this.illustrated('talk') ?? stand ?? this.painted('talk');
      case 'wave':
        // A raised hand from the scouting frames where there are some; otherwise standing.
        return this.illustrated('look', 2) ?? stand ?? this.painted('wave');
      case 'fish':
        return this.illustrated('fish') ?? (stand ? { ...stand, rod: true } : this.painted('fish'));
      case 'forage':
        return this.illustrated('forage') ?? stand ?? this.painted('forage');
      case 'build':
        return this.illustrated('build') ?? stand ?? this.painted('build');
      case 'track':
        return this.illustrated('track') ?? stand ?? this.painted('forage', [0, 0, 2, 2]);
      case 'sit':
        return this.illustrated('sit') ?? stand ?? this.painted('sit');
      case 'tend':
        return stand ?? this.painted('tend');
      default:
        return stand ?? this.painted('idle');
    }
  }

  /**
   * Each friend's own action as idle life at home, where it fits: Haru practising with the bow,
   * Yui telling a story, Sora looking out, Mina gathering, Aki hammering (at a building site).
   * Only where the illustrated frames exist; Ren's fishing needs water, so not at home.
   */
  get signature(): ShownPose | null {
    const pose = SIGNATURES[this.look];
    return pose && this.count(pose === 'track' ? 'track' : pose) > 0 ? pose : null;
  }

  /** Index into an outfit for a frame of the painted timing (which has `FRAME_COUNT` frames, or 4 for tracking). */
  index(outfit: Outfit, pose: ShownPose, frame: number): number {
    // Ren's illustrated fishing is wait, bite, tug, reset: mostly waiting, the tug at the strike.
    if (pose === 'fish' && !outfit.painted && outfit.ids.length === 4) return [3, 0, 0, 2][frame] ?? 0;
    const timed = pose === 'track' ? 4 : FRAME_COUNT[pose];
    return Math.min(outfit.ids.length - 1, Math.floor((frame * outfit.ids.length) / timed));
  }

  /** The knot, tool tip, hand and lantern for a frame, in world px from the feet, facing right. */
  points(outfit: Outfit, index: number, out: WornPoints): WornPoints {
    if (outfit.painted) {
      const p = pointsOf(outfit.rigPose, outfit.rigFrames[index] ?? 0);
      const s = this.k * outfit.scale;
      out.knot[0] = p.knot[0] * s;
      out.knot[1] = p.knot[1] * s;
      out.tip = p.tip ? [p.tip[0] * s, p.tip[1] * s] : null;
      out.lantern = p.lantern ? [p.lantern[0] * s, p.lantern[1] * s] : null;
      out.hand = null;
      out.lineEnd = null;
      return out;
    }
    const f = this.fittings;
    out.knot[0] = f.knot[0];
    out.knot[1] = f.knot[1];
    out.hand = f.hand;
    out.tip = outfit.rod ? [f.hand[0] + 24, f.hand[1] - 18] : null;
    // A frame may say exactly where its lantern hangs (Yui's walk and storytelling do).
    const hung = this.art.get(outfit.ids[index]!).attachments?.lantern?.offset;
    out.lantern = hung ? [hung[0], hung[1]] : f.lantern;
    out.lineEnd = outfit.rod ? null : f.lineEnd;
    return out;
  }

  /** Height of the person on screen, world px, for hit areas and shadows. */
  get height(): number {
    return this.stand ? 48 : 57 * this.k * this.paintedScale;
  }
}

export interface WornPoints {
  knot: [number, number];
  tip: Pt | null;
  hand: Pt | null;
  lantern: Pt | null;
  lineEnd: Pt | null;
}

export function newWornPoints(): WornPoints {
  return { knot: [0, 0], tip: null, hand: null, lantern: null, lineEnd: null };
}

/**
 * The explorers' skeleton: where hips, feet, hands and head sit in every
 * painted frame. Pure numbers, no canvas, so the painter (`explorers.ts`) and
 * the valley layer agree on where a rod tip, a hammer head or the top of a pack
 * is in each frame without reading pixels.
 *
 * Coordinates are world pixels, facing RIGHT, with the origin on the ground
 * under the hips and y growing downward (canvas convention). A standing
 * explorer is about 58 px from sole to hat crown.
 */

export type Pt = [number, number];

/** The cast, in the order the notebook lists them. */
export const EXPLORER_IDS = ['sora', 'ren', 'mina', 'aki', 'yui', 'haru'] as const;
export type ExplorerId = (typeof EXPLORER_IDS)[number];

/** The valley's other people, with painted fallbacks for each illustrated look. */
export const VILLAGER_LOOKS = ['villager-a', 'villager-b', 'villager-c', 'villager-d', 'villager-e', 'villager-f', 'villager-g', 'villager-h', 'villager-i', 'villager-j', 'villager-woman', 'villager-elder', 'villager-farmer'] as const;
export type VillagerLook = (typeof VILLAGER_LOOKS)[number];

/** Every look the painter knows. */
export type LookId = ExplorerId | VillagerLook;
export const PAINTED_LOOKS: readonly LookId[] = [...EXPLORER_IDS, ...VILLAGER_LOOKS];

/**
 * Painted poses. These are the scene's poses plus `tend` (crouched at the fire
 * with a stick), which the layer uses for camp life.
 */
export type FramePose = 'idle' | 'walk' | 'carry' | 'fish' | 'forage' | 'look' | 'talk' | 'build' | 'sit' | 'wave' | 'tend';

/** Frames painted for each pose. */
export const FRAME_COUNT: Record<FramePose, number> = {
  idle: 5,
  walk: 8,
  carry: 8,
  fish: 4,
  forage: 4,
  look: 4,
  talk: 3,
  build: 3,
  sit: 2,
  wave: 3,
  tend: 2,
};

/** Ground covered by one full walk cycle (two steps), in world px. Frames advance with distance so feet never slide. */
export const STRIDE = 30;

/** Which hand holds the explorer's signature prop in a frame. */
export type Grip = 'near' | 'far' | 'none';

export interface Rig {
  /** Hip joint. */
  hip: Pt;
  /** Torso lean in radians; positive leans forward. */
  lean: number;
  /** Near and far foot (soles). */
  feet: [Pt, Pt];
  /** Near and far hand. */
  hands: [Pt, Pt];
  /** Head tilt in radians; positive nods forward. */
  nod: number;
  /** True when the head is turned to look back over the shoulder. */
  glance: boolean;
  /** Knee direction for the near and far leg: true bends the knee forward (or up when seated). */
  knees: [boolean, boolean];
  /** Who holds the signature prop. */
  grip: Grip;
  /** The tool this frame needs regardless of who is painted (a rod for fishing, a hammer for building). */
  tool: 'rod' | 'hammer' | 'stick' | 'sprig' | null;
  /** End of the tool, for the fishing line, sawdust and sparks. */
  tip: Pt | null;
  /** Seated on a low log. */
  seat: boolean;
  /** Fishing rod bends under a strike. */
  bend: number;
}

const TORSO = 16;
const NECK = 9;
export const THIGH = 12.5;
export const SHIN = 12;
export const UPPER_ARM = 8.6;
export const FOREARM = 8.2;

/** Shoulder position for a rig. */
export function shoulderOf(rig: Rig): Pt {
  return [rig.hip[0] + Math.sin(rig.lean) * TORSO, rig.hip[1] - Math.cos(rig.lean) * TORSO];
}

/** Centre of the head. */
export function headOf(rig: Rig): Pt {
  const s = shoulderOf(rig);
  const a = rig.lean + rig.nod * 0.6;
  return [s[0] + 1.2 + Math.sin(a) * NECK, s[1] - Math.cos(a) * NECK];
}

/** Where the top of a back load sits: the pack knot is tied here. */
export function backOf(rig: Rig): Pt {
  const s = shoulderOf(rig);
  return [s[0] - 7 - Math.sin(rig.lean) * 2, s[1] - 1];
}

const hang = (s: Pt, dx: number, dy = 14.5): Pt => [s[0] + dx, s[1] + dy];
const smooth = (t: number): number => t * t * (3 - 2 * t);

function base(): Rig {
  return {
    hip: [0, -24],
    lean: 0.02,
    feet: [[3, 0], [-3, 0]],
    hands: [[0, 0], [0, 0]],
    nod: 0,
    glance: false,
    knees: [true, true],
    grip: 'near',
    tool: null,
    tip: null,
    seat: false,
    bend: 0,
  };
}

/** Foot of a walk cycle at phase p (0..1): flat on the ground moving back, then lifted and swung forward. */
function stepFoot(p: number, reach: number, lift: number): Pt {
  const q = ((p % 1) + 1) % 1;
  if (q < 0.5) return [reach - 4 * reach * q, 0];
  const s = (q - 0.5) * 2;
  return [-reach + 2 * reach * smooth(s), -lift * Math.sin(Math.PI * s)];
}

function walk(frame: number, count: number, carry: boolean): Rig {
  const r = base();
  const p = frame / count;
  const reach = carry ? 6 : 7.5;
  r.feet = [stepFoot(p, reach, carry ? 3 : 3.8), stepFoot(p + 0.5, reach, carry ? 3 : 3.8)];
  // Lowest at the contacts, highest as the legs pass.
  r.hip = [0, -23.6 + 0.9 * Math.cos(4 * Math.PI * p)];
  r.lean = carry ? 0.17 : 0.07;
  const s = shoulderOf(r);
  const swing = -r.feet[0][0] / reach;
  if (carry) {
    // The far hand on a strap; the near one swings short, still holding whatever it carries.
    r.hands = [hang(s, swing * 3 + 2, 13.5), [s[0] + 3, s[1] + 7]];
  } else {
    r.hands = [hang(s, swing * 5 + 1, 14), hang(s, -swing * 4 + 1, 13.6)];
  }
  return r;
}

function idle(frame: number): Rig {
  const r = base();
  const s = shoulderOf(r);
  r.hands = [hang(s, 1.2), hang(s, -0.4, 14)];
  switch (frame) {
    case 1:
      // Weight on the back foot.
      r.hip = [-1.2, -23.8];
      r.lean = -0.03;
      r.feet = [[4.5, 0], [-2.5, 0]];
      r.hands = [hang(shoulderOf(r), 2, 14), hang(shoulderOf(r), -1.5, 14)];
      break;
    case 2:
      // A look over the shoulder.
      r.glance = true;
      r.lean = 0;
      r.hands = [hang(shoulderOf(r), 0.5), hang(shoulderOf(r), 0.2, 14)];
      break;
    case 3: {
      // Settling the hat.
      const h = headOf(r);
      r.hands = [[h[0] + 3, h[1] - 4], hang(s, -0.4, 14)];
      r.nod = 0.15;
      r.grip = 'far';
      break;
    }
    case 4: {
      // Hands clasped behind the back, looking up at the weather.
      r.lean = -0.06;
      r.nod = -0.3;
      r.hip = [0.6, -24];
      const t = shoulderOf(r);
      r.hands = [[t[0] - 5, t[1] + 12], [t[0] - 5.5, t[1] + 11.5]];
      r.grip = 'none';
      break;
    }
    default:
      break;
  }
  return r;
}

function fish(frame: number): Rig {
  const r = base();
  r.feet = [[6, 0], [-5, 0]];
  r.tool = 'rod';
  r.grip = 'far';
  switch (frame) {
    case 0:
      // Wind-up: rod back over the shoulder.
      r.lean = -0.08;
      r.hands = [[-1, -45], [-3, -43]];
      r.tip = [-26, -72];
      break;
    case 1:
      // The cast goes out.
      r.lean = 0.14;
      r.hip = [1, -23.5];
      r.hands = [[10, -37], [8, -36]];
      r.tip = [40, -54];
      break;
    case 2:
      // Waiting, rod held out low.
      r.lean = 0.03;
      r.hands = [[8, -30], [6, -31]];
      r.tip = [40, -46];
      break;
    default:
      // The strike: rod up, leaning back, the rod bowed.
      r.lean = -0.13;
      r.hip = [-1.5, -23.6];
      r.hands = [[5, -44], [3, -42]];
      r.tip = [24, -78];
      r.bend = 1;
      break;
  }
  return r;
}

function kneel(r: Rig): void {
  r.hip = [-2, -13.5];
  r.feet = [[-13, 0], [6, 0]];
  r.knees = [true, true];
  r.lean = 0.3;
}

function forage(frame: number): Rig {
  const r = base();
  kneel(r);
  r.grip = 'none';
  const s = shoulderOf(r);
  switch (frame) {
    case 0:
      r.hands = [[s[0] + 4, s[1] + 12], [s[0] + 2, s[1] + 11]];
      r.nod = 0.4;
      break;
    case 1:
      r.lean = 0.45;
      r.hands = [[11, -2], [s[0] + 3, s[1] + 11]];
      r.nod = 0.5;
      break;
    case 2:
      r.lean = 0.2;
      r.hands = [[7, -18], [s[0] + 2, s[1] + 11]];
      r.tool = 'sprig';
      r.tip = [7, -21];
      r.nod = 0.2;
      break;
    default:
      r.lean = 0.35;
      r.hands = [[16, -7], [s[0] + 2, s[1] + 11]];
      r.tool = 'sprig';
      r.tip = [16, -9];
      r.nod = 0.35;
      break;
  }
  return r;
}

function look(frame: number): Rig {
  const r = base();
  r.feet = [[5, 0], [-3.5, 0]];
  const h = headOf(r);
  const s = shoulderOf(r);
  switch (frame) {
    case 0:
      r.hands = [[h[0] + 4, h[1] - 3], hang(s, 0, 14)];
      r.grip = 'far';
      break;
    case 1:
      r.nod = -0.25;
      r.hands = [[h[0] + 4.5, h[1] - 4], hang(s, 0, 14)];
      r.grip = 'far';
      break;
    case 2:
      r.lean = 0.05;
      r.hands = [[s[0] + 14, s[1] - 9], hang(shoulderOf(r), 0, 14)];
      r.grip = 'far';
      break;
    default:
      r.lean = 0.09;
      r.nod = 0.1;
      r.hands = [[s[0] + 15, s[1] - 4], hang(shoulderOf(r), 1, 14)];
      r.grip = 'far';
      break;
  }
  return r;
}

function talk(frame: number): Rig {
  const r = base();
  r.feet = [[4, 0], [-3, 0]];
  r.lean = 0.07;
  const s = shoulderOf(r);
  switch (frame) {
    case 0:
      r.hands = [[s[0] + 5, s[1] + 12], [s[0] + 4, s[1] + 12]];
      r.nod = 0.1;
      r.grip = 'far';
      break;
    case 1:
      r.hands = [[s[0] + 9, s[1] + 2], hang(s, 0.5, 14)];
      r.nod = -0.1;
      r.grip = 'far';
      break;
    default:
      r.lean = 0.02;
      r.hands = [[s[0] + 9, s[1] + 7], [s[0] + 7, s[1] + 6]];
      r.nod = 0.05;
      r.grip = 'none';
      break;
  }
  return r;
}

function build(frame: number): Rig {
  const r = base();
  r.feet = [[7, 0], [-6, 0]];
  r.tool = 'hammer';
  r.grip = 'none';
  switch (frame) {
    case 0:
      r.lean = 0.02;
      r.hands = [[-1, -50], [6, -32]];
      r.tip = [-6, -56];
      break;
    case 1:
      r.lean = 0.12;
      r.hands = [[9, -44], [7, -31]];
      r.tip = [13, -51];
      break;
    default:
      r.hip = [1, -21];
      r.lean = 0.3;
      r.hands = [[15, -21], [10, -24]];
      r.tip = [21, -17];
      break;
  }
  return r;
}

function sit(frame: number): Rig {
  const r = base();
  r.seat = true;
  r.hip = [-3, -9.5];
  r.feet = [[11, 0], [8, 0]];
  r.knees = [true, true];
  r.grip = 'none';
  if (frame === 0) {
    r.lean = 0.16;
    const s = shoulderOf(r);
    r.hands = [[s[0] + 11, s[1] + 8], [s[0] + 10, s[1] + 9]];
  } else {
    r.lean = 0.1;
    r.nod = 0.15;
    const s = shoulderOf(r);
    r.hands = [[s[0] + 7, s[1] + 9], [s[0] + 6, s[1] + 9.5]];
  }
  return r;
}

function wave(frame: number): Rig {
  const r = base();
  r.feet = [[4, 0], [-3, 0]];
  r.lean = -0.02;
  r.grip = 'far';
  const s = shoulderOf(r);
  const x = [6, 10, 3][frame] ?? 6;
  r.hands = [[s[0] + x, s[1] - 14], hang(s, 0, 14)];
  return r;
}

function tend(frame: number): Rig {
  const r = base();
  r.hip = [-2, -14];
  r.feet = [[3, 0], [-4, 0]];
  r.knees = [true, true];
  r.lean = 0.42;
  r.tool = 'stick';
  r.grip = 'none';
  const s = shoulderOf(r);
  if (frame === 0) {
    r.hands = [[s[0] + 7, s[1] + 9], [s[0] + 4, s[1] + 11]];
    r.tip = [26, -1];
  } else {
    r.hands = [[s[0] + 8, s[1] + 6], [s[0] + 4, s[1] + 11]];
    r.tip = [25, -6];
  }
  return r;
}

/** The skeleton for one painted frame. */
export function rigFor(pose: FramePose, frame: number): Rig {
  const n = FRAME_COUNT[pose];
  const f = ((frame % n) + n) % n;
  switch (pose) {
    case 'walk':
      return walk(f, n, false);
    case 'carry':
      return walk(f, n, true);
    case 'fish':
      return fish(f);
    case 'forage':
      return forage(f);
    case 'look':
      return look(f);
    case 'talk':
      return talk(f);
    case 'build':
      return build(f);
    case 'sit':
      return sit(f);
    case 'wave':
      return wave(f);
    case 'tend':
      return tend(f);
    default:
      return idle(f);
  }
}

/**
 * Art id of one explorer frame, for example `ren-fish-2` (the ids in
 * `docs/sprites-needed.md`, so an illustrated frame replaces the painted one).
 */
export function explorerFrameId(who: string, pose: FramePose, frame: number): string {
  return `${who}-${pose}-${frame}`;
}

/** Canvas of every explorer frame, in world px, and where the ground under the hips lies in it. */
export const EXPLORER_CANVAS = { width: 88, height: 100, x: 42, y: 92 } as const;

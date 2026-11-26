/**
 * The five explorers, painted frame by frame from the skeleton in
 * `explorerRig.ts`. Same brushes and upper-left light as the rest of the
 * placeholders, at about one and a half times the size of the valley's other
 * walkers, with a slightly larger head and hat in the storybook manner.
 *
 * Each explorer reads by silhouette alone:
 *   Sora  russet coat, wide felt hat, tall staff, rucksack with a bedroll
 *   Ren   river-blue coat, broad sedge hat, a long rod over the shoulder, a creel
 *   Mina  moss-green coat, round straw hat with a ribbon, a basket on the arm
 *   Aki   ochre work coat, headband with trailing ties, a tool roll across the back
 *   Yui   plum robe to the ankles, cream shawl, hair in a bun, a lantern on a pole
 *
 * A soft dark edge is laid round the finished figure so it holds against busy
 * grass and foliage at normal zoom, the way the illustrated art is inked.
 */

import { type Ctx, type Painted, type Painter, ball, blob, bone, canvasOf, darken, ellipse, ik, lighten, line, painted, poly, rgba } from './common';
import {
  EXPLORER_CANVAS,
  type LookId,
  PAINTED_LOOKS,
  FOREARM,
  FRAME_COUNT,
  type FramePose,
  type Pt,
  type Rig,
  SHIN,
  THIGH,
  UPPER_ARM,
  backOf,
  explorerFrameId,
  headOf,
  rigFor,
  shoulderOf,
} from './explorerRig';

type Hat = 'traveller' | 'sedge' | 'straw' | 'band' | 'bun';
type Prop = 'staff' | 'rod' | 'basket' | 'tools' | 'lantern' | 'bow' | 'none';

interface Look {
  coat: string;
  trousers: string;
  sash: string;
  hat: Hat;
  /** Hat or ribbon colour. */
  hatColour: string;
  accent: string;
  prop: Prop;
  /** A robe to the ankles rather than a coat to mid-thigh. */
  long: boolean;
  /** Overall height and breadth. */
  k: number;
  girth: number;
  hair: string;
  skin: string;
}

export const LOOKS: Record<LookId, Look> = {
  sora: { coat: '#a2532f', trousers: '#4d453a', sash: '#d9b46a', hat: 'traveller', hatColour: '#5d4632', accent: '#3f5a68', prop: 'staff', long: false, k: 1.04, girth: 1, hair: '#2f2620', skin: '#e2bf98' },
  ren: { coat: '#3b6d8e', trousers: '#39414a', sash: '#c9b98e', hat: 'sedge', hatColour: '#d6b974', accent: '#8a6a3e', prop: 'rod', long: false, k: 1, girth: 1, hair: '#26211d', skin: '#d9b48e' },
  mina: { coat: '#5f7a37', trousers: '#5c4c38', sash: '#e3cf98', hat: 'straw', hatColour: '#e2c98a', accent: '#476a3a', prop: 'basket', long: false, k: 0.95, girth: 0.96, hair: '#3a2a20', skin: '#e6c4a0' },
  aki: { coat: '#c08a2c', trousers: '#4a4034', sash: '#6d4a32', hat: 'band', hatColour: '#e9e4d6', accent: '#46607a', prop: 'tools', long: false, k: 1.01, girth: 1.12, hair: '#231d19', skin: '#d4ad86' },
  haru: { coat: '#5e5a3a', trousers: '#3e3a30', sash: '#8a6a42', hat: 'band', hatColour: '#6e5a3c', accent: '#3e4a3a', prop: 'bow', long: false, k: 1.02, girth: 1.02, hair: '#241e1a', skin: '#d6b08a' },
  // The valley's people: muted cloth, nothing in the hands that suggests a trade.
  'villager-a': { coat: '#5d6872', trousers: '#4a4640', sash: '#b8ab8c', hat: 'band', hatColour: '#d8d0bc', accent: '#6e7480', prop: 'none', long: false, k: 0.97, girth: 1, hair: '#2c2622', skin: '#dcb994' },
  'villager-b': { coat: '#7a6650', trousers: '#4c4438', sash: '#c4b48c', hat: 'sedge', hatColour: '#c9b07a', accent: '#6e5a40', prop: 'none', long: false, k: 1, girth: 1.04, hair: '#2a231e', skin: '#d4ae88' },
  'villager-c': { coat: '#6d7560', trousers: '#5a5444', sash: '#c9bd9a', hat: 'bun', hatColour: '#b8ae98', accent: '#7a6a5a', prop: 'none', long: true, k: 0.94, girth: 0.98, hair: '#2e2724', skin: '#e2c1a0' },
  'villager-d': { coat: '#8a7a5c', trousers: '#4e4a42', sash: '#a89878', hat: 'straw', hatColour: '#cdb98a', accent: '#7a6a4e', prop: 'none', long: false, k: 0.92, girth: 0.96, hair: '#33291f', skin: '#dbb690' },
  // More of the valley's cloth: still muted, kept clear of the friends' own colours.
  'villager-e': { coat: '#46546e', trousers: '#3e3c3a', sash: '#bfb08c', hat: 'band', hatColour: '#d4ccb6', accent: '#5a6478', prop: 'none', long: false, k: 0.99, girth: 1.02, hair: '#28221e', skin: '#d8b48e' },
  'villager-f': { coat: '#94634a', trousers: '#4a4238', sash: '#cbb98e', hat: 'straw', hatColour: '#d2bd8c', accent: '#7a5440', prop: 'none', long: false, k: 0.95, girth: 0.98, hair: '#30271f', skin: '#dfbb94' },
  'villager-g': { coat: '#4e6862', trousers: '#40443e', sash: '#b9ae90', hat: 'sedge', hatColour: '#c4ad78', accent: '#5e6e64', prop: 'none', long: false, k: 1.01, girth: 1.03, hair: '#24201c', skin: '#d2ab86' },
  'villager-h': { coat: '#7a4c44', trousers: '#463c36', sash: '#c6b48e', hat: 'bun', hatColour: '#bcae96', accent: '#6a4a40', prop: 'none', long: true, k: 0.93, girth: 0.97, hair: '#2c2420', skin: '#e0bf9c' },
  'villager-i': { coat: '#6c7688', trousers: '#4a4844', sash: '#c4b896', hat: 'band', hatColour: '#5e6472', accent: '#5c6474', prop: 'none', long: false, k: 0.96, girth: 1, hair: '#2a2420', skin: '#dab792' },
  'villager-j': { coat: '#a39374', trousers: '#545046', sash: '#8a7a5e', hat: 'band', hatColour: '#7a6a52', accent: '#6e6250', prop: 'none', long: false, k: 0.98, girth: 1.06, hair: '#322a22', skin: '#d6b08a' },
  'villager-woman': { coat: '#5d6872', trousers: '#5a4b3d', sash: '#d2c4a9', hat: 'bun', hatColour: '#433a32', accent: '#cfc1a7', prop: 'none', long: false, k: 0.94, girth: 0.96, hair: '#332c27', skin: '#dfbd9a' },
  'villager-elder': { coat: '#886b69', trousers: '#625448', sash: '#c7b89b', hat: 'bun', hatColour: '#716b63', accent: '#b5a78e', prop: 'none', long: false, k: 0.92, girth: 0.96, hair: '#716b63', skin: '#d4b28e' },
  'villager-farmer': { coat: '#946d3c', trousers: '#625a44', sash: '#d5c3a1', hat: 'straw', hatColour: '#cdb181', accent: '#8b754e', prop: 'none', long: false, k: 0.96, girth: 1, hair: '#756f62', skin: '#d4b28e' },
  yui: { coat: '#7c3d62', trousers: '#5e3448', sash: '#d7b46a', hat: 'bun', hatColour: '#d9cba8', accent: '#b8443a', prop: 'lantern', long: true, k: 0.97, girth: 1, hair: '#2a2228', skin: '#e4c3a2' },
};

/** Canvas pixels per world pixel. */
const DENSITY = 2.5;
const SOLE = '#4a3a2c';
const WOOD = '#94724a';
const EDGE = '#1f2a26';

// ── Small geometry helpers ─────────────────────────────────────────────────

const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const scale = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
const mid = (a: Pt, b: Pt, t = 0.5): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Torso axes: `up` along the spine, `fwd` across it toward the face. */
function axes(rig: Rig): { up: Pt; fwd: Pt } {
  return { up: [Math.sin(rig.lean), -Math.cos(rig.lean)], fwd: [Math.cos(rig.lean), Math.sin(rig.lean)] };
}

/** Where the lantern hangs, if this explorer carries one in this frame. */
export function lanternOf(who: string, rig: Rig): Pt | null {
  if (who !== 'yui' || rig.grip === 'none') return null;
  const hand = rig.grip === 'near' ? rig.hands[0] : rig.hands[1];
  return [hand[0] + 7.5, hand[1] - 2.5];
}

/** Where the pack knot is tied: on top of whatever is on the back. */
export function knotOf(rig: Rig, carrying: boolean): Pt {
  const b = backOf(rig);
  return carrying ? [b[0] - 4, b[1] - 3] : [b[0] - 0.5, b[1] + 2];
}

// ── Body parts ─────────────────────────────────────────────────────────────

function leg(ctx: Ctx, look: Look, hip: Pt, foot: Pt, forward: boolean, far: boolean): Pt {
  const knee = ik(hip, foot, THIGH, SHIN, forward);
  const cloth = far ? darken(look.trousers, 0.28) : look.trousers;
  const g = look.girth;
  bone(ctx, hip, knee, 4.8 * g, 3.8 * g, cloth);
  bone(ctx, knee, foot, 3.6 * g, 2.6, cloth);
  // Leggings bound from mid-shin to the ankle.
  const wrap = far ? darken('#d8ccb0', 0.3) : '#d8ccb0';
  bone(ctx, mid(knee, foot, 0.45), add(foot, [0, -0.8]), 3.1, 2.5, wrap);
  line(ctx, [mid(knee, foot, 0.62), add(mid(knee, foot, 0.62), [2.2, -0.6])], 0.35, rgba(darken(wrap, 0.5), 0.5));
  // Straw sandal and foot.
  ellipse(ctx, foot[0] + 1.6, foot[1] - 0.7, 2.9, 1.15, far ? darken(SOLE, 0.25) : SOLE);
  ellipse(ctx, foot[0] + 1.3, foot[1] - 1.2, 2.1, 0.8, far ? darken(look.skin, 0.3) : darken(look.skin, 0.08));
  return knee;
}

function arm(ctx: Ctx, look: Look, shoulder: Pt, hand: Pt, far: boolean): Pt {
  const elbow = ik(shoulder, hand, UPPER_ARM, FOREARM, false);
  const sleeve = far ? darken(look.coat, 0.3) : lighten(look.coat, 0.1);
  const g = look.girth;
  if (!far) {
    // A darker underlay so the near arm reads against the coat behind it.
    const shade = darken(look.coat, 0.42);
    bone(ctx, shoulder, elbow, 4.9 * g, 4.2 * g, shade);
    bone(ctx, elbow, mid(elbow, hand, 0.82), 4.2 * g, 3.9 * g, shade);
  }
  bone(ctx, shoulder, elbow, 4 * g, 3.3 * g, sleeve);
  bone(ctx, elbow, mid(elbow, hand, 0.82), 3.3 * g, 3.1 * g, sleeve);
  // A paler cuff, then the hand.
  const cuff = mid(elbow, hand, 0.78);
  bone(ctx, cuff, mid(elbow, hand, 0.86), 3.2, 3, far ? darken(look.sash, 0.3) : look.sash);
  ball(ctx, hand[0], hand[1], 1.55, 1.55, far ? darken(look.skin, 0.22) : look.skin, 0.25);
  return elbow;
}

/** Coat or robe from the shoulders down, with the hem swinging with the forward leg. */
function coat(ctx: Ctx, look: Look, rig: Rig, knees: [Pt, Pt]): void {
  const s = shoulderOf(rig);
  const h = rig.hip;
  const { up, fwd } = axes(rig);
  const g = look.girth;
  const at = (base: Pt, u: number, f: number): Pt => add(base, add(scale(up, u), scale(fwd, f * g)));
  // The more forward thigh carries the front of the skirt.
  const front = knees[0][0] >= knees[1][0] ? 0 : 1;
  const knee = knees[front];
  const foot = rig.feet[front];
  let frontHem: Pt;
  let backHem: Pt;
  if (look.long) {
    frontHem = rig.seat ? mid(knee, foot, 0.75) : add(mid(knee, foot, 0.78), [1.5, 0]);
    const rear = rig.feet[1 - front];
    backHem = rig.seat ? add(h, [-4, 7]) : [Math.min(rear[0], h[0] - 3) - 2.5, Math.min(-1.5, rear[1] - 2)];
  } else {
    frontHem = add(mid(h, knee, 0.82), [2.6 * g, 1.2]);
    backHem = rig.seat ? add(h, [-5.5, 3]) : add(h, [-5.4 * g, 9.5]);
  }
  const waistF = at(h, 4, 4);
  const waistB = at(h, 4, -4.6);
  const pts: Pt[] = [
    at(s, 0.6, -4.6),
    at(s, 1.6, -0.6),
    at(s, 0.6, 3.8),
    at(mid(s, h, 0.45), 0, 4.4),
    waistF,
    frontHem,
    mid(frontHem, backHem, 0.5),
    backHem,
    waistB,
    at(mid(s, h, 0.45), 0, -5),
  ];
  blob(ctx, pts, look.coat, { light: 0.32, dark: 0.4 }, () => {
    // A fold from the collar down, and the overlapping front edge.
    line(ctx, [at(s, 1, 2.6), at(mid(s, h, 0.5), 0, 2.2), mid(waistF, frontHem, 0.5)], 0.7, rgba(lighten(look.coat, 0.35), 0.55), true);
    line(ctx, [at(s, 0, -1.6), at(mid(s, h, 0.5), 0, -2.4), mid(waistB, backHem, 0.45)], 0.6, rgba(darken(look.coat, 0.45), 0.5), true);
    // Brush texture: a few short strokes of a darker and a lighter tone.
    for (let i = 0; i < 7; i++) {
      const t = i / 7;
      const p = mid(at(s, -2, -3), mid(frontHem, backHem, 0.4), t);
      line(ctx, [add(p, [-1.2, 0.4]), add(p, [1.4, -0.3])], 0.4, rgba(i % 2 ? darken(look.coat, 0.35) : lighten(look.coat, 0.3), 0.25));
    }
    // Sash at the waist.
    line(ctx, [add(waistB, [-1, 0.6]), add(waistF, [1, 0.4])], 2.4, look.sash);
    line(ctx, [add(waistB, [-1, 1.5]), add(waistF, [1, 1.3])], 0.45, rgba(darken(look.sash, 0.4), 0.6));
    if (look.long) line(ctx, [add(waistF, [-1.2, 1]), add(waistF, [-0.4, 5.4])], 1.1, look.sash);
  });
  // Collar.
  line(ctx, [at(s, 1.2, -1.2), at(s, 0.2, 1.6), at(s, -2.6, 3.4)], 1.1, lighten(look.sash, 0.25), true);
}

function shawl(ctx: Ctx, look: Look, rig: Rig): void {
  const s = shoulderOf(rig);
  const { up, fwd } = axes(rig);
  const at = (u: number, f: number): Pt => add(s, add(scale(up, u), scale(fwd, f)));
  blob(ctx, [at(1.8, -5.4), at(2.4, 0), at(1.4, 4.6), at(-3.2, 5.2), at(-6.6, 2.4), at(-7.8, -1), at(-6.2, -5.6)], look.hatColour, { light: 0.35, dark: 0.3 }, () => {
    for (let i = 0; i < 4; i++) line(ctx, [at(1 - i * 2, -5), at(-1 - i * 2, 4)], 0.35, rgba(darken(look.hatColour, 0.3), 0.35));
  });
  // Fringe at the lower edge.
  for (let i = 0; i < 6; i++) {
    const p = mid(at(-6.4, 3), at(-7.4, -4.6), i / 5);
    line(ctx, [p, add(p, [0.2, 1.4])], 0.35, rgba(darken(look.hatColour, 0.2), 0.8));
  }
}

function head(ctx: Ctx, look: Look, rig: Rig): void {
  const s = shoulderOf(rig);
  const c = headOf(rig);
  bone(ctx, add(s, [0.6, 0]), add(c, [-0.4, 3.5]), 2.8, 2.6, darken(look.skin, 0.12));
  ctx.save();
  ctx.translate(c[0], c[1]);
  ctx.rotate(rig.lean * 0.5 + rig.nod * 0.5);
  if (rig.glance) ctx.scale(-1, 1);
  const rx = 5.3;
  const ry = 5.7;
  ball(ctx, 0, 0, rx, ry, look.skin, 0.28);
  // Hair at the back and crown, clipped to the head.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, rx + 0.1, ry + 0.1, 0, 0, Math.PI * 2);
  ctx.clip();
  ellipse(ctx, -3.4, 0.2, 3.2, 5.8, look.hair);
  ellipse(ctx, 0.2, -4.6, 5.4, 2, look.hair);
  ellipse(ctx, -1.4, -2.6, 2.6, 1.6, look.hair, 0.5);
  ctx.restore();
  ellipse(ctx, -1, 0.6, 1.05, 1.35, darken(look.skin, 0.14));
  // Eye, brow and a warm cheek.
  ellipse(ctx, 3.1, -0.4, 0.55, 0.65, '#2a2420');
  line(ctx, [[2.2, -1.9], [3.9, -2]], 0.35, rgba(look.hair, 0.7));
  ellipse(ctx, 2.6, 1.9, 1.3, 0.8, 'rgba(214,120,104,0.32)');
  ellipse(ctx, 5.2, 0.6, 0.7, 0.9, look.skin);
  hat(ctx, look);
  ctx.restore();
}

function hat(ctx: Ctx, look: Look): void {
  const c = look.hatColour;
  switch (look.hat) {
    case 'traveller':
      ellipse(ctx, 0.4, -3.3, 9.6, 2.4, darken(c, 0.2));
      blob(ctx, [[-4.8, -3.4], [-4.4, -7.4], [-1.2, -9.8], [2.8, -9.6], [5, -7], [5.2, -3.4], [0.2, -2.6]], c, { light: 0.38, dark: 0.32 });
      line(ctx, [[-4.7, -4.6], [5.1, -4.4]], 1.2, darken(c, 0.4));
      ellipse(ctx, 0.4, -3.8, 9.2, 1.7, rgba(lighten(c, 0.2), 0.55));
      line(ctx, [[-8.8, -3.6], [9.6, -3.2]], 0.5, rgba(lighten(c, 0.45), 0.6));
      break;
    case 'sedge':
      ellipse(ctx, 0.4, -2.4, 11.6, 2.2, rgba(darken(c, 0.55), 0.55));
      blob(ctx, [[-11.6, -2.6], [-6, -6.2], [0.4, -10.8], [6.6, -6.2], [12.2, -2.8], [0.4, -1.8]], c, { light: 0.4, dark: 0.3 }, () => {
        for (let i = -5; i <= 5; i++) line(ctx, [[0.4, -10.6], [0.4 + i * 2.3, -1.8]], 0.3, rgba(darken(c, 0.35), 0.4));
      });
      ellipse(ctx, 0.4, -10.4, 1, 0.7, darken(c, 0.35));
      line(ctx, [[-1.8, -1.6], [-2.4, 4.2]], 0.35, rgba('#4a3a2a', 0.7));
      break;
    case 'straw':
      ellipse(ctx, 0.2, -3.6, 10, 2.8, darken(c, 0.12));
      ellipse(ctx, 0.2, -4.1, 9.4, 2.1, lighten(c, 0.12));
      blob(ctx, [[-4.4, -4], [-4, -8.6], [0.2, -10.2], [4.4, -8.6], [4.8, -4], [0.2, -3.4]], c, { light: 0.38, dark: 0.3 });
      line(ctx, [[-4.4, -5.3], [4.8, -5.3]], 1.5, look.accent);
      line(ctx, [[-4.4, -5.2], [-7.4, -1.4], [-8, 1.6]], 0.9, look.accent, true);
      line(ctx, [[-4.2, -5], [-6, -0.8]], 0.8, darken(look.accent, 0.15));
      break;
    case 'band':
      // Short tied-up hair, then a cloth band whose ends trail behind.
      blob(ctx, [[-4.6, -3.6], [-3, -6.8], [0.4, -7.4], [3.4, -6], [4.6, -3.4], [0, -3.6]], look.hair, { light: 0.25 });
      line(ctx, [[-5.2, -2.4], [5.2, -3.2]], 1.9, c);
      line(ctx, [[-5.2, -2.4], [5.2, -3.2]], 0.5, rgba(look.accent, 0.8));
      line(ctx, [[-5, -2.2], [-9.4, -3.4], [-11.2, -1.6]], 1, c, true);
      line(ctx, [[-5, -2], [-8.8, 0.4], [-10.6, 2.6]], 0.9, darken(c, 0.12), true);
      // A pencil behind the ear.
      line(ctx, [[-1.6, -1.2], [1.2, 2.6]], 0.6, '#b58a3a');
      break;
    case 'bun':
      ball(ctx, -3.2, -4.8, 3, 2.7, look.hair, 0.22);
      line(ctx, [[-6.6, -6.4], [0.4, -3.8]], 0.5, '#c9a35a');
      ball(ctx, -6.5, -6.4, 0.75, 0.75, look.accent, 0.3);
      ellipse(ctx, 0.6, -4.4, 4.8, 1.6, look.hair);
      break;
  }
}

// ── Props ──────────────────────────────────────────────────────────────────

function staff(ctx: Ctx, hand: Pt, far: boolean): void {
  const tilt = 0.1;
  const top: Pt = [hand[0] + Math.sin(tilt) * 23, hand[1] - 23];
  const foot: Pt = [hand[0] - Math.sin(tilt) * 25, Math.min(-0.2, hand[1] + 25)];
  const wood = far ? darken(WOOD, 0.3) : WOOD;
  line(ctx, [foot, top], 1.5, wood);
  line(ctx, [add(foot, [-0.4, 0]), add(top, [-0.4, 0])], 0.45, rgba(lighten(WOOD, 0.4), far ? 0.2 : 0.55));
  ball(ctx, top[0], top[1], 1.2, 1.1, darken(wood, 0.1), 0.3);
  // A red cord tied below the crook.
  line(ctx, [add(top, [-0.6, 3]), add(top, [1.6, 3.6]), add(top, [1.2, 7.4])], 0.7, far ? darken('#a8443a', 0.3) : '#a8443a');
}

/** A short hunting bow held upright, string toward the body. */
function bow(ctx: Ctx, hand: Pt, far: boolean): void {
  const wood = far ? darken('#6e4e30', 0.3) : '#6e4e30';
  ctx.strokeStyle = wood;
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hand[0] - 1, hand[1] - 15);
  ctx.quadraticCurveTo(hand[0] + 6, hand[1], hand[0] - 1, hand[1] + 15);
  ctx.stroke();
  line(ctx, [[hand[0] - 1, hand[1] - 15], [hand[0] - 2.2, hand[1] + 15]], 0.3, 'rgba(240,236,220,0.8)');
}

function rodOverShoulder(ctx: Ctx, hand: Pt): void {
  const tip: Pt = [hand[0] - 27, hand[1] - 34];
  ctx.strokeStyle = '#8a6a3e';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hand[0] + 2, hand[1] + 2);
  ctx.quadraticCurveTo(hand[0] - 12, hand[1] - 19, tip[0], tip[1]);
  ctx.lineWidth = 1;
  ctx.stroke();
  line(ctx, [tip, [tip[0] - 0.6, tip[1] + 9]], 0.3, 'rgba(240,240,232,0.7)');
  ball(ctx, tip[0] - 0.6, tip[1] + 9.4, 0.8, 1, '#c8553e', 0.3);
}

function rodCast(ctx: Ctx, rig: Rig): void {
  const grip = mid(rig.hands[0], rig.hands[1]);
  const tip = rig.tip!;
  const d = sub(tip, grip);
  const handle = add(grip, scale(d, -0.12));
  const bow = rig.bend * 7;
  const ctrl: Pt = add(mid(handle, tip), [bow * 0.8, -bow * 0.2]);
  ctx.strokeStyle = '#7d5f37';
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(handle[0], handle[1]);
  ctx.quadraticCurveTo(ctrl[0], ctrl[1], tip[0], tip[1]);
  ctx.stroke();
  line(ctx, [handle, mid(handle, tip, 0.18)], 1.8, '#5a4430');
}

function basket(ctx: Ctx, at: Pt, size: number, far: boolean, full: boolean): void {
  const w = 5 * size;
  const h = 3.8 * size;
  const straw = far ? darken('#b8955a', 0.3) : '#b8955a';
  line(ctx, [[at[0] - w * 0.75, at[1] - h * 0.2], [at[0], at[1] - h * 1.5], [at[0] + w * 0.75, at[1] - h * 0.2]], 0.6 * size, darken(straw, 0.2), true);
  if (full) {
    ball(ctx, at[0] - 1.6 * size, at[1] - h * 0.55, 1.6 * size, 1.1 * size, '#6f8a46', 0.3);
    ball(ctx, at[0] + 1.4 * size, at[1] - h * 0.6, 1.3 * size, 1 * size, '#c96a4a', 0.3);
  }
  blob(ctx, [[at[0] - w, at[1] - h * 0.5], [at[0] + w, at[1] - h * 0.5], [at[0] + w * 0.8, at[1] + h * 0.5], [at[0] - w * 0.8, at[1] + h * 0.5]], straw, { light: 0.3 }, () => {
    for (let i = -2; i <= 2; i++) line(ctx, [[at[0] + i * w * 0.36, at[1] - h * 0.5], [at[0] + i * w * 0.3, at[1] + h * 0.5]], 0.3, rgba(darken(straw, 0.4), 0.55));
    line(ctx, [[at[0] - w, at[1]], [at[0] + w, at[1]]], 0.3, rgba(darken(straw, 0.4), 0.5));
  });
}

function lantern(ctx: Ctx, hand: Pt, far: boolean): void {
  const tip: Pt = [hand[0] + 7.5, hand[1] - 7.5];
  line(ctx, [add(hand, [-1.5, 1.5]), tip], 0.9, far ? darken(WOOD, 0.3) : darken(WOOD, 0.1));
  const l: Pt = [tip[0], tip[1] + 5];
  line(ctx, [tip, add(l, [0, -2.4])], 0.35, '#3a2e24');
  blob(ctx, [[l[0] - 2.2, l[1] - 2.2], [l[0] + 2.2, l[1] - 2.2], [l[0] + 2.6, l[1] + 0.4], [l[0] + 2, l[1] + 2.4], [l[0] - 2, l[1] + 2.4], [l[0] - 2.6, l[1] + 0.4]], far ? darken('#efd49a', 0.25) : '#f1d79b', { light: 0.45, dark: 0.15 });
  line(ctx, [[l[0] - 2.4, l[1] - 2.4], [l[0] + 2.4, l[1] - 2.4]], 0.8, '#3a2e24');
  line(ctx, [[l[0] - 2.1, l[1] + 2.5], [l[0] + 2.1, l[1] + 2.5]], 0.8, '#3a2e24');
  line(ctx, [[l[0] - 2.4, l[1]], [l[0] + 2.4, l[1]]], 0.25, rgba('#b4853e', 0.6));
}

function hammer(ctx: Ctx, hand: Pt, tip: Pt): void {
  const d = sub(tip, hand);
  const len = Math.hypot(d[0], d[1]) || 1;
  const n: Pt = [-d[1] / len, d[0] / len];
  line(ctx, [add(hand, scale(d, -0.25)), tip], 1.1, '#8a6a42');
  poly(ctx, [add(tip, scale(n, 2.4)), add(add(tip, scale(n, 2.4)), scale(d, 0.25)), add(add(tip, scale(n, -2.4)), scale(d, 0.25)), add(tip, scale(n, -2.4))], '#6e6a64', { light: 0.4 });
}

function stick(ctx: Ctx, hand: Pt, tip: Pt): void {
  line(ctx, [add(hand, scale(sub(tip, hand), -0.1)), tip], 0.9, '#6b5038');
  ball(ctx, tip[0], tip[1], 0.9, 0.8, '#e0703a', 0.5);
}

function sprig(ctx: Ctx, tip: Pt): void {
  line(ctx, [add(tip, [0, 2.6]), tip], 0.35, '#5b6e3a');
  ball(ctx, tip[0] - 1, tip[1] - 0.3, 1.2, 0.7, '#7a9a4a', 0.3);
  ball(ctx, tip[0] + 1, tip[1] - 1, 1.1, 0.7, '#8aa957', 0.3);
  ball(ctx, tip[0] + 0.2, tip[1] - 1.8, 0.6, 0.6, '#e8d36a', 0.4);
}

// ── Back loads ─────────────────────────────────────────────────────────────

function backLoad(ctx: Ctx, look: Look, rig: Rig, carrying: boolean): void {
  const b = backOf(rig);
  const { up, fwd } = axes(rig);
  const at = (u: number, f: number): Pt => add(b, add(scale(up, u), scale(fwd, f)));
  if (carrying) {
    // A big cloth-wrapped bundle tied with rope: everyone looks laden.
    blob(ctx, [at(3, -1), at(1.5, 4), at(-9, 4.6), at(-16, 1.5), at(-16.5, -5), at(-12, -9.6), at(-3, -8.2)], '#c4ad84', { light: 0.35, dark: 0.38 }, () => {
      line(ctx, [at(2, -4), at(-16, -3)], 0.8, rgba('#6b5a3c', 0.75));
      line(ctx, [at(-6, -9), at(-7, 4.5)], 0.8, rgba('#6b5a3c', 0.75));
      for (let i = 0; i < 4; i++) line(ctx, [at(-2 - i * 3.4, -7), at(-3 - i * 3.4, 3)], 0.35, rgba('#8a7752', 0.4));
    });
    return;
  }
  switch (look.prop) {
    case 'staff':
      // Rucksack with a blue bedroll on top.
      blob(ctx, [at(1.5, 0.5), at(1.5, -6.4), at(-12, -7), at(-14.5, -5.4), at(-14, 0.6)], '#7a5a3c', { light: 0.32, dark: 0.36 }, () => {
        line(ctx, [at(-4, -6.6), at(-4, 0.4)], 0.5, rgba('#3a2a1c', 0.55));
        line(ctx, [at(-9, -6.8), at(-9.4, 0.4)], 0.5, rgba('#3a2a1c', 0.55));
      });
      blob(ctx, [at(3.6, -1.6), at(3.4, -8.2), at(0.4, -9), at(-0.4, -1.4)], look.accent, { light: 0.35 });
      break;
    case 'tools': {
      // A leather tool roll slung across the back, handles showing.
      line(ctx, [at(3.4, -5.4), at(2.4, -1.2)], 1, '#7a5a36');
      line(ctx, [at(2.6, -6.6), at(4.6, -7.6)], 0.9, '#a8865a');
      line(ctx, [at(-7, -2), at(5.6, -5.2)], 1.3, '#cbb38a');
      blob(ctx, [at(1.6, -7.2), at(2.8, -3.4), at(-10, 0.2), at(-11.4, -3.6)], '#7a5236', { light: 0.3, dark: 0.35 }, () => {
        line(ctx, [at(-1.4, -5), at(-7, -3.2)], 0.45, rgba('#d8c08a', 0.6));
      });
      break;
    }
    case 'bow':
      // A quiver across the back, fletching showing.
      blob(ctx, [at(3, -2.4), at(4, 0.4), at(-12, 3.4), at(-13, 0.6)], '#6a4e34', { light: 0.3 });
      for (let i = 0; i < 3; i++) line(ctx, [at(3.4 + i * 0.6, -1.4 + i), at(6 + i * 0.6, -2.6 + i)], 0.8, '#e6dcc0');
      break;
    case 'rod':
      // A small creel on the hip.
      blob(ctx, [add(rig.hip, [-8.6, -6]), add(rig.hip, [-3, -6.4]), add(rig.hip, [-3.2, 1]), add(rig.hip, [-8.2, 1.4])], '#a88a58', { light: 0.3 }, () => {
        for (let i = 0; i < 3; i++) line(ctx, [add(rig.hip, [-8.6, -4 + i * 2]), add(rig.hip, [-3, -4.2 + i * 2])], 0.35, rgba('#6a5432', 0.6));
      });
      break;
    default:
      break;
  }
}

// ── Frame ──────────────────────────────────────────────────────────────────

/** Paints the figure (no outline) into `ctx`, origin on the ground under the hips. */
function figure(ctx: Ctx, look: Look, pose: FramePose, rig: Rig): void {
  const carrying = pose === 'carry';
  const hold = look.prop !== 'tools' && rig.grip !== 'none';
  const raised = rig.hands[0][1] < shoulderOf(rig)[1] - 5;
  const farHolds = hold && rig.grip === 'far';

  if (rig.seat) blob(ctx, [[-13, -8.6], [5, -8.2], [6.2, -4.6], [5, -0.6], [-13, -0.8], [-14, -4.6]], '#7a5c40', { light: 0.32, dark: 0.4 }, () => {
    ellipse(ctx, 5.2, -4.4, 1.2, 3.6, '#c4a676');
    line(ctx, [[-11, -6], [2, -6]], 0.4, rgba('#3d2c1e', 0.5));
  });
  if (look.prop === 'basket' && rig.seat) basket(ctx, [-16, -2.6], 1, false, true);

  // Ren's rod rests over the shoulder behind the head when it is not in use.
  if (look.prop === 'rod' && !rig.tool && hold && !carrying) rodOverShoulder(ctx, farHolds ? rig.hands[1] : rig.hands[0]);
  backLoad(ctx, look, rig, carrying);
  if (look.prop === 'rod' && !rig.tool && carrying) rodOverShoulder(ctx, rig.hands[1]);

  // Far side: arm, held prop, leg.
  const s = shoulderOf(rig);
  const farShoulder = add(s, [-1.4, 0.4]);
  if (farHolds && look.prop === 'staff') staff(ctx, rig.hands[1], true);
  if (farHolds && look.prop === 'lantern') lantern(ctx, rig.hands[1], true);
  arm(ctx, look, farShoulder, rig.hands[1], true);
  if (farHolds && look.prop === 'basket' && !rig.seat) basket(ctx, add(rig.hands[1], [0.5, 3.4]), 0.95, true, false);
  const farKnee = leg(ctx, look, add(rig.hip, [-1, 0]), rig.feet[1], rig.knees[1], true);
  const nearKnee = leg(ctx, look, rig.hip, rig.feet[0], rig.knees[0], false);

  coat(ctx, look, rig, [nearKnee, farKnee]);
  if (look.hat === 'bun') shawl(ctx, look, rig);

  // Things held in front of the body.
  if (rig.tool === 'rod') rodCast(ctx, rig);
  if (pose === 'forage') {
    if (look.prop === 'basket') basket(ctx, [19, -2.6], 1.05, false, rig.tool === 'sprig');
    else blob(ctx, [[15, -1], [17, -5.4], [21, -5], [23.6, -1], [19, 0.2]], '#cdbb92', { light: 0.32 });
  }
  if (hold && !farHolds && look.prop === 'staff') staff(ctx, rig.hands[0], false);
  if (hold && look.prop === 'bow') bow(ctx, farHolds ? rig.hands[1] : rig.hands[0], farHolds);
  if (hold && !farHolds && look.prop === 'lantern') lantern(ctx, rig.hands[0], false);

  if (!raised) arm(ctx, look, s, rig.hands[0], false);
  if (hold && !farHolds && look.prop === 'basket' && !rig.seat) basket(ctx, add(rig.hands[0], [0.6, 3.6]), 1, false, carrying);
  if (rig.tool === 'hammer' && rig.tip && !raised) hammer(ctx, rig.hands[0], rig.tip);
  if (rig.tool === 'stick' && rig.tip) stick(ctx, rig.hands[0], rig.tip);
  if (rig.tool === 'sprig' && rig.tip) sprig(ctx, rig.tip);
  // Hands on top of whatever they hold.
  if (!raised) ball(ctx, rig.hands[0][0], rig.hands[0][1], 1.55, 1.55, look.skin, 0.25);

  head(ctx, look, rig);
  // An arm raised to wave, shade the eyes or swing a hammer is in front of the face.
  if (raised) {
    arm(ctx, look, s, rig.hands[0], false);
    if (rig.tool === 'hammer' && rig.tip) hammer(ctx, rig.hands[0], rig.tip);
    ball(ctx, rig.hands[0][0], rig.hands[0][1], 1.55, 1.55, look.skin, 0.25);
  }
}

/**
 * Gouache grain: short light and dark dabs laid only over the painted figure,
 * lighter toward the upper left, and a little shade gathered at the feet, so
 * the figure has the scenery's brushed surface rather than flat fills.
 */
function grain(ctx: Ctx, w: number, h: number, ground: number): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  let seed = 9;
  const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  ctx.lineCap = 'round';
  for (let i = 0; i < 420; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const light = rnd() < 0.5 - (x / w - 0.5) * 0.3;
    const len = 2 + rnd() * 4;
    const a = -0.7 + (rnd() - 0.5) * 0.8;
    ctx.strokeStyle = light ? 'rgba(255,246,224,0.13)' : 'rgba(28,30,46,0.12)';
    ctx.lineWidth = 0.8 + rnd() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  const shade = ctx.createLinearGradient(0, ground - h * 0.22, 0, ground);
  shade.addColorStop(0, 'rgba(30,34,40,0)');
  shade.addColorStop(1, 'rgba(30,34,40,0.22)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** One frame of one explorer, outlined softly so it reads against the painted ground. */
export function paintExplorer(who: LookId, pose: FramePose, frame: number): Painted {
  const { width: W, height: H, x: CX, y: GY } = EXPLORER_CANVAS;
  const look = LOOKS[who];
  const rig = rigFor(pose, frame);
  const [body, bctx] = canvasOf(W, H, DENSITY);
  bctx.translate(CX, GY);
  bctx.scale(look.k, look.k);
  figure(bctx, look, pose, rig);
  grain(bctx, body.width, body.height, GY * DENSITY);

  // A dark silhouette, offset in eight directions under the figure, gives a soft inked edge.
  const [edge, ectx] = canvasOf(W, H, DENSITY);
  ectx.setTransform(1, 0, 0, 1, 0, 0);
  ectx.drawImage(body, 0, 0);
  ectx.globalCompositeOperation = 'source-in';
  ectx.fillStyle = EDGE;
  ectx.fillRect(0, 0, edge.width, edge.height);

  const [canvas, ctx] = canvasOf(W, H, DENSITY);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const r = 0.75 * DENSITY;
  ctx.globalAlpha = 0.34;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.drawImage(edge, Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.globalAlpha = 1;
  ctx.drawImage(body, 0, 0);
  return painted(canvas, W, H, [CX / W, GY / H]);
}

export const EXPLORERS: Record<string, Painter> = Object.fromEntries(
  PAINTED_LOOKS.flatMap((who) =>
    (Object.keys(FRAME_COUNT) as FramePose[]).flatMap((pose) =>
      Array.from({ length: FRAME_COUNT[pose] }, (_, i) => [explorerFrameId(who, pose, i), (): Painted => paintExplorer(who, pose, i)] as const),
    ),
  ),
);


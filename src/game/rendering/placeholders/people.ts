/**
 * People on the roads: side-on walkers facing RIGHT, two frames each
 * (`<id>-0` mid-stride, `<id>-1` passing), so the game mirrors them to face
 * their way and alternates frames as they walk. All share one body so they
 * agree in size and style; each differs in silhouette (hat, load, robe) and cloth.
 */

import { type Painted, type Painter, type Pt, ball, blob, bone, canvasOf, darken, ellipse, ik, lighten, line, painted, poly, rgba, shadow } from './common';

type Hat = 'none' | 'sedge' | 'cone' | 'scarf' | 'shaven' | 'bun' | 'bob' | 'topknot' | 'band';
type Prop = 'none' | 'staff' | 'pack' | 'pole' | 'hoe' | 'rod' | 'parasol' | 'bundle';

interface Walker {
  top: string;
  bottom: string;
  /** Long robe or kimono to the ankles. */
  robe: boolean;
  sash?: string;
  hat: Hat;
  prop: Prop;
  /** Overall scale (a child is smaller, with a larger head). */
  k?: number;
  head?: number;
  /** Diagonal kesa stole for the monk, or pilgrim's stole. */
  stole?: string;
}

const SKIN = '#e0bf9c';
const HAIR = '#2c2622';
const STRAW = '#d4b874';
const W = 34;
const H = 46;
const CX = 16;
const GROUND = 43;

function walker(w: Walker, frame: number): Painted {
  const [canvas, ctx] = canvasOf(W, H, 4);
  const k = w.k ?? 1;
  shadow(ctx, CX + 1.4, GROUND + 0.2, 7.5 * k, 1.8 * k);
  ctx.save();
  ctx.translate(CX, GROUND);
  ctx.scale(k, k);
  ctx.translate(-CX, -GROUND);
  // Adult body in world px: head top ~5, shoulders 14, hips 24.5, feet 43.
  const stride = frame === 0;
  const hip: Pt = [CX, 24.5];
  const shoulder: Pt = [CX + 0.4, 14.6];
  const feet: [Pt, Pt] = stride ? [[CX + 4.8, GROUND], [CX - 4.4, GROUND]] : [[CX + 0.6, GROUND], [CX - 1.6, GROUND - 2.2]];
  const hands: [Pt, Pt] = stride ? [[CX - 3.6, 23.4], [CX + 3.8, 23]] : [[CX + 0.2, 24.2], [CX + 1.2, 24]];
  if (w.prop === 'rod' || w.prop === 'hoe') hands[1] = [CX + 3.6, 19.6];
  if (w.prop === 'pole') hands[1] = [CX + 3, 15.6];
  if (w.prop === 'staff') hands[1] = [CX + 5.4, 20.6];
  if (w.prop === 'parasol') hands[1] = [CX + 3.4, 19.4];

  // Behind the body: back loads.
  if (w.prop === 'pack') {
    poly(ctx, [[CX - 10.6, 9], [CX - 3.6, 8.4], [CX - 3, 26], [CX - 10, 26.4]], '#7a5a3c', { light: 0.3 });
    line(ctx, [[CX - 9.8, 14], [CX - 3.6, 13.6]], 0.6, rgba('#3a2a1c', 0.6));
    line(ctx, [[CX - 9.8, 19.6], [CX - 3.4, 19.2]], 0.6, rgba('#3a2a1c', 0.6));
    blob(ctx, [[CX - 11.4, 8.6], [CX - 10, 4.8], [CX - 6.4, 4], [CX - 3.4, 5.6], [CX - 3, 8.8]], '#4f6b7c', { light: 0.3 });
  }
  if (w.prop === 'rod') {
    line(ctx, [hands[1], [CX - 14.6, 1.2]], 0.55, '#8a6a3e');
    line(ctx, [[CX - 14.6, 1.2], [CX - 15.4, 9]], 0.25, 'rgba(240,240,232,0.7)');
  }
  if (w.prop === 'hoe') {
    line(ctx, [hands[1], [CX - 9.4, 9.4]], 0.9, '#8a6a3e');
    poly(ctx, [[CX - 10.4, 8], [CX - 8.4, 10.4], [CX - 10.2, 14.4], [CX - 11.6, 13]], '#7b7f7e', { light: 0.35 });
  }

  // Far leg and far arm, darker.
  const legLen = 9.8;
  const legC = w.robe ? darken(w.top, 0.1) : w.bottom;
  const farHip: Pt = [hip[0] - 0.8, hip[1]];
  const farKnee = ik(farHip, feet[1], legLen, legLen, true);
  bone(ctx, farHip, farKnee, 3, 2.2, darken(legC, 0.3));
  bone(ctx, farKnee, feet[1], 2.2, 1.8, darken(legC, 0.3));
  ellipse(ctx, feet[1][0] + 0.8, feet[1][1] - 0.4, 1.7, 0.75, '#4a3a2c');
  const farElbow = ik(shoulder, hands[1], 5.2, 5.2, true);
  if (w.prop !== 'none' && w.prop !== 'pack' && w.prop !== 'bundle') {
    bone(ctx, shoulder, farElbow, 2.2, 1.8, darken(w.top, 0.3));
    bone(ctx, farElbow, hands[1], 1.8, 1.4, darken(w.top, 0.3));
    ball(ctx, hands[1][0], hands[1][1], 0.9, 0.9, darken(SKIN, 0.15), 0.2);
  }

  // Near leg.
  const nearKnee = ik(hip, feet[0], legLen, legLen, true);
  bone(ctx, hip, nearKnee, 3.2, 2.3, legC);
  bone(ctx, nearKnee, feet[0], 2.3, 1.9, legC);
  if (!w.robe) {
    // Leggings bound below the knee.
    bone(ctx, [nearKnee[0] + (feet[0][0] - nearKnee[0]) * 0.35, nearKnee[1] + (feet[0][1] - nearKnee[1]) * 0.35], feet[0], 2.1, 1.8, lighten(w.bottom, 0.25));
  }
  ellipse(ctx, feet[0][0] + 0.8, feet[0][1] - 0.4, 1.8, 0.8, '#5a4634');

  // Torso: a jacket to the hips, or a robe to the ankles that swings with the stride.
  const hemFront = w.robe ? (stride ? CX + 4.8 : CX + 3.4) : CX + 3.2;
  const hemBack = w.robe ? (stride ? CX - 4.6 : CX - 3.6) : CX - 3.4;
  const hemY = w.robe ? GROUND - 3.2 : 26.4;
  blob(ctx, [[CX - 3, 14], [CX - 0.4, 12.6], [CX + 2.6, 13.4], [CX + 3.2, 18], [CX + 3.2, 22.6], [hemFront, hemY], [CX, hemY + 0.8], [hemBack, hemY], [CX - 3.4, 22], [CX - 3.6, 17.6]], w.top, { light: 0.3, dark: 0.36 }, () => {
    if (w.sash) {
      ctx.fillStyle = w.sash;
      ctx.fillRect(CX - 5, 22, 10, 2.3);
    }
    if (w.stole) line(ctx, [[CX - 2.6, 13.6], [CX + 0.8, 19], [CX + 3.6, 23.2]], 2, w.stole);
    line(ctx, [[CX + 1.4, 13.4], [CX + 0.2, 17], [CX + 1.6, 22.2]], 0.5, rgba(darken(w.top, 0.4), 0.6), true);
  });

  // Front loads and props.
  if (w.prop === 'pole') {
    line(ctx, [[CX - 13.6, 15], [CX + 14.4, 13.4]], 0.9, '#8a6a3e');
    for (const [x, y] of [[CX - 12.4, 15], [CX + 13.2, 13.5]] as const) {
      line(ctx, [[x - 1.6, y + 7], [x, y], [x + 1.6, y + 7]], 0.35, '#5a4a36');
      blob(ctx, [[x - 3, y + 7], [x + 3, y + 7], [x + 2.4, y + 12], [x - 2.4, y + 12]], '#b08a52', { light: 0.32 }, () => {
        line(ctx, [[x - 3, y + 9.4], [x + 3, y + 9.4]], 0.5, rgba('#6a5032', 0.6));
      });
    }
  }
  if (w.prop === 'bundle') blob(ctx, [[CX - 7.6, 14.6], [CX - 5.4, 12.6], [CX - 2.6, 13.4], [CX - 2.4, 18.4], [CX - 6.6, 19.6]], '#7a5276', { light: 0.32 });
  if (w.prop === 'rod') blob(ctx, [[CX - 5.6, 22], [CX - 2.2, 22], [CX - 2.6, 26.4], [CX - 5.2, 26.4]], '#b8955a', { light: 0.3 });

  // Near arm.
  const nearElbow = ik(shoulder, hands[0], 5.2, 5.2, false);
  const sleeve = w.top === '#eeebe2' ? darken(w.top, 0.12) : lighten(w.top, 0.12);
  bone(ctx, shoulder, nearElbow, 2.6, 2.1, sleeve);
  bone(ctx, nearElbow, hands[0], 2.1, 1.7, sleeve);
  ball(ctx, hands[0][0], hands[0][1], 1, 1, SKIN, 0.2);
  if (w.prop === 'none' || w.prop === 'pack' || w.prop === 'bundle') {
    // Both arms swing: the far one is hidden behind the body when its hand is behind.
    if (stride) {
      bone(ctx, [shoulder[0] + 0.6, shoulder[1] + 0.6], [CX + 3.4, 20], 2.3, 1.9, lighten(w.top, 0.06));
      bone(ctx, [CX + 3.4, 20], [CX + 4.6, 23.4], 1.9, 1.6, lighten(w.top, 0.06));
      ball(ctx, CX + 4.8, 23.8, 1, 1, SKIN, 0.2);
    }
  }
  if (w.prop === 'staff') line(ctx, [[CX + 6.2, 10.4], [CX + 4.8, GROUND]], 0.9, '#a58456');

  // Head.
  const hk = w.head ?? 1;
  ctx.save();
  ctx.translate(CX + 0.8, 12.6);
  ctx.scale(hk, hk);
  ctx.translate(-(CX + 0.8), -12.6);
  const hx = CX + 0.8;
  const hy = 9;
  ball(ctx, hx, hy, 3.3, 3.5, SKIN, 0.28);
  ellipse(ctx, hx + 3, hy + 0.6, 0.7, 0.9, SKIN);
  if (w.hat !== 'shaven') {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(hx, hy, 3.45, 3.65, 0, 0, Math.PI * 2);
    ctx.clip();
    ellipse(ctx, hx - 1.7, hy - 0.6, 2.3, 3.4, HAIR);
    ellipse(ctx, hx + 0.2, hy - 3.1, 3.1, 1.2, HAIR);
    ctx.restore();
    ellipse(ctx, hx - 0.4, hy + 0.4, 0.7, 0.9, darken(SKIN, 0.15));
  }
  ellipse(ctx, hx + 2.1, hy - 0.1, 0.38, 0.42, '#2a2420');
  switch (w.hat) {
    case 'sedge':
      ellipse(ctx, hx + 0.2, hy - 2.4, 7.6, 2, darken(STRAW, 0.2));
      blob(ctx, [[hx - 7.6, hy - 2.6], [hx - 3, hy - 5.4], [hx + 0.2, hy - 7.6], [hx + 3.4, hy - 5.4], [hx + 7.8, hy - 2.6], [hx + 0.2, hy - 1.6]], STRAW, { light: 0.35 });
      break;
    case 'cone':
      ellipse(ctx, hx + 0.2, hy - 2.2, 5.4, 1.5, darken(STRAW, 0.2));
      blob(ctx, [[hx - 5.4, hy - 2.4], [hx - 1, hy - 6.6], [hx + 0.4, hy - 7.6], [hx + 1.6, hy - 6.6], [hx + 5.6, hy - 2.4], [hx, hy - 1.6]], lighten(STRAW, 0.05), { light: 0.35 });
      break;
    case 'scarf':
      blob(ctx, [[hx - 3.6, hy - 1.2], [hx - 2.6, hy - 3.6], [hx + 1, hy - 4.2], [hx + 3.4, hy - 2.4], [hx + 3, hy - 1], [hx - 1, hy - 1.6], [hx - 4.4, hy + 1.4]], '#e9e4d6', { light: 0.2 });
      break;
    case 'band':
      line(ctx, [[hx - 3.2, hy - 1.6], [hx + 3.2, hy - 2.2]], 1, '#e9e4d6');
      line(ctx, [[hx - 3.2, hy - 1.6], [hx - 5, hy - 0.4]], 0.6, '#e9e4d6');
      break;
    case 'bun':
      ball(ctx, hx - 3, hy - 3, 1.9, 1.6, HAIR, 0.2);
      ellipse(ctx, hx - 1.4, hy - 3.4, 0.4, 1.8, '#c9a35a', 0.9);
      break;
    case 'bob':
      blob(ctx, [[hx - 3.8, hy + 2], [hx - 3.8, hy - 2.4], [hx - 0.6, hy - 4], [hx + 3.2, hy - 2.6], [hx + 2.4, hy - 1.6], [hx - 0.4, hy - 1.2], [hx - 1.2, hy + 2.4]], HAIR, { light: 0.2 });
      break;
    case 'topknot':
      ellipse(ctx, hx - 1.4, hy - 3.6, 1.4, 0.8, HAIR, -0.3);
      break;
    default:
      break;
  }
  ctx.restore();

  if (w.prop === 'parasol') {
    line(ctx, [hands[1], [CX + 1.6, -0.6 + 3]], 0.5, '#6a4a30');
    ctx.save();
    blob(ctx, [[CX - 8.4, 4.2], [CX - 4, 0.8], [CX + 1.6, -0.2], [CX + 7.4, 0.8], [CX + 11.6, 4.2], [CX + 1.6, 3.2]], '#b8443a', { light: 0.32 }, () => {
      for (let i = -3; i <= 3; i++) line(ctx, [[CX + 1.6, -0.2], [CX + 1.6 + i * 3.2, 4.4]], 0.3, 'rgba(255,240,220,0.35)');
    });
    ctx.restore();
  }
  ctx.restore();
  return painted(canvas, W, H, [CX / W, GROUND / H]);
}

const WALKERS: Record<string, Walker> = {
  pilgrim: { top: '#eeebe2', bottom: '#eeebe2', robe: true, hat: 'sedge', prop: 'staff', stole: '#b9a98a' },
  pedlar: { top: '#5f7350', bottom: '#4a4a3e', robe: false, hat: 'scarf', prop: 'pack' },
  monk: { top: '#4a4746', bottom: '#4a4746', robe: true, hat: 'shaven', prop: 'none', stole: '#b8863a' },
  child: { top: '#c4554a', bottom: '#c4554a', robe: false, sash: '#e8cf8a', hat: 'bob', prop: 'none', k: 0.72, head: 1.2 },
  porter: { top: '#8a7652', bottom: '#5c5242', robe: false, hat: 'band', prop: 'pole' },
  'farmer-walk': { top: '#8a5a44', bottom: '#5e5446', robe: false, hat: 'cone', prop: 'hoe' },
  'fisher-walk': { top: '#4b6a78', bottom: '#3e4a4e', robe: false, hat: 'scarf', prop: 'rod' },
  'villager-walk': { top: '#3f5873', bottom: '#6b6456', robe: false, hat: 'topknot', prop: 'bundle' },
  'woman-walk': { top: '#8e4a5c', bottom: '#8e4a5c', robe: true, sash: '#d9b46a', hat: 'bun', prop: 'parasol' },
};

export const PEOPLE: Record<string, Painter> = Object.fromEntries(
  Object.entries(WALKERS).flatMap(([id, w]) => [0, 1].map((f) => [`${id}-${f}`, (): Painted => walker(w, f)])),
);


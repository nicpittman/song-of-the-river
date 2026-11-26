/**
 * Paint for the interaction overlay: the light that gathers on places, the
 * glowing line being drawn, the polished stones on a selected route.
 *
 * Everything here is painted once on small canvases (soft radial gradients,
 * like `rendering/fallbackArt.ts`) and shared by every valley. Light textures
 * are painted white so they can be tinted; the shading textures are painted in
 * ink so that light strokes stay legible over snow and bright meadow.
 */

import { Texture } from 'pixi.js';

/** Colours of the overlay, drawn from the game's palette. */
export const OVERLAY = {
  /** Warm candle light: the pools under places. */
  lamp: 0xffb46c,
  /** A brighter, paler lamp for the place a line is about to reach. */
  lampBright: 0xffd8a0,
  /** The drawn line and labels. */
  cream: 0xfff6dc,
  /** The brightest beads of light. */
  pearl: 0xfffcf4,
  /** Muted warm rust for the part of a route that cannot be. */
  rust: 0xb65a3c,
  /** A lighter rust for the beads travelling through a refused stretch. */
  rustLight: 0xe39a78,
  /** The soft dark beneath light strokes. */
  ink: 0x1d1a14,
} as const;

/** Linear blend between two 0xRRGGBB colours. */
export function mixColour(a: number, b: number, t: number): number {
  const ch = (shift: number): number => Math.round(((a >> shift) & 0xff) + (((b >> shift) & 0xff) - ((a >> shift) & 0xff)) * t) << shift;
  return ch(16) | ch(8) | ch(0);
}

export interface OverlayTextures {
  /** A wide pool of light with a gently brighter rim (white, tint it). */
  pool: Texture;
  /** A soft dark ground beneath a pool or mark, darkest toward its rim. */
  shade: Texture;
  /** A small soft dark blot, for beneath labels, rings and stones. */
  dusk: Texture;
  /** A soft round glow (white, tint it). */
  glow: Texture;
  /** A thin ring of light with a soft halo (white, tint it). */
  ring: Texture;
  /** A short horizontal hairline that fades at both ends (white, tint it). */
  hairline: Texture;
  /** A polished jade stone with its own small shadow. */
  jade: Texture;
  /** A polished pale stone, used for the bead being dragged. */
  pearl: Texture;
}

let cached: OverlayTextures | null = null;

/** The overlay's textures, painted on first use and kept for the life of the page. */
export function overlayTextures(): OverlayTextures {
  cached ??= {
    pool: radial(256, [
      [0, 'rgba(255,255,255,0.13)'],
      [0.5, 'rgba(255,255,255,0.18)'],
      [0.7, 'rgba(255,255,255,0.38)'],
      [0.82, 'rgba(255,255,255,0.6)'],
      [0.87, 'rgba(255,255,255,0.64)'],
      [0.93, 'rgba(255,255,255,0.32)'],
      [0.97, 'rgba(255,255,255,0.08)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
    shade: radial(256, [
      [0, 'rgba(29,26,20,0.04)'],
      [0.7, 'rgba(29,26,20,0.06)'],
      [0.84, 'rgba(29,26,20,0.16)'],
      [0.92, 'rgba(29,26,20,0.36)'],
      [0.97, 'rgba(29,26,20,0.12)'],
      [1, 'rgba(29,26,20,0)'],
    ]),
    dusk: radial(128, [
      [0, 'rgba(29,26,20,0.55)'],
      [0.45, 'rgba(29,26,20,0.38)'],
      [0.75, 'rgba(29,26,20,0.12)'],
      [1, 'rgba(29,26,20,0)'],
    ]),
    glow: radial(128, [
      [0, 'rgba(255,255,255,1)'],
      [0.18, 'rgba(255,255,255,0.75)'],
      [0.42, 'rgba(255,255,255,0.28)'],
      [0.7, 'rgba(255,255,255,0.07)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
    ring: radial(128, [
      [0, 'rgba(255,255,255,0)'],
      [0.46, 'rgba(255,255,255,0.04)'],
      [0.6, 'rgba(255,255,255,0.4)'],
      [0.68, 'rgba(255,255,255,1)'],
      [0.76, 'rgba(255,255,255,0.4)'],
      [0.88, 'rgba(255,255,255,0.08)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
    hairline: hairline(),
    jade: stone(['#e4f2e2', '#9cc8ae', '#5e9a80', '#2f5e4c']),
    pearl: stone(['#ffffff', '#fff6e2', '#e8d6b0', '#9c8662']),
  };
  return cached;
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** A square texture holding one radial gradient from the centre to the edge. */
function radial(size: number, stops: Array<[number, string]>): Texture {
  const [c, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, colour] of stops) g.addColorStop(at, colour);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(c);
}

function hairline(): Texture {
  const [c, ctx] = canvas(128, 8);
  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.7)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 3, 128, 2);
  return Texture.from(c);
}

/**
 * A small polished stone seen from slightly above: a soft contact shadow, a
 * rounded body lit from the upper left, a crisp highlight and a faint
 * reflected light along its lower edge. `tones` run from highlight to rim.
 */
function stone(tones: [string, string, string, string]): Texture {
  const size = 96;
  const [c, ctx] = canvas(size, size);
  const cx = size / 2;
  const cy = size / 2 - 4;
  const r = size * 0.3;

  // Contact shadow, offset down because light falls from above.
  ctx.save();
  ctx.translate(cx, cy + r * 0.7);
  ctx.scale(1, 0.45);
  const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.35);
  shadow.addColorStop(0, 'rgba(20,18,12,0.55)');
  shadow.addColorStop(0.6, 'rgba(20,18,12,0.25)');
  shadow.addColorStop(1, 'rgba(20,18,12,0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Body: slightly oval, like a river pebble.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 0.9);
  const body = ctx.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.05, 0, 0, r);
  body.addColorStop(0, tones[0]);
  body.addColorStop(0.35, tones[1]);
  body.addColorStop(0.8, tones[2]);
  body.addColorStop(1, tones[3]);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // Reflected light along the lower rim.
  const bounce = ctx.createRadialGradient(r * 0.1, r * 0.7, 0, r * 0.1, r * 0.7, r * 0.6);
  bounce.addColorStop(0, 'rgba(255,250,235,0.32)');
  bounce.addColorStop(1, 'rgba(255,250,235,0)');
  ctx.fillStyle = bounce;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // A fine dark edge so the stone holds its shape on snow.
  ctx.strokeStyle = 'rgba(25,30,24,0.55)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // Specular glint.
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.36, -r * 0.46, r * 0.22, r * 0.13, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return Texture.from(c);
}

/**
 * Procedural stand-ins for art the library does not (yet) contain. They are
 * painted on a canvas from the game's palette: small, soft and unobtrusive,
 * meant to sit beside the illustrated assets without drawing the eye.
 * No emoji, no debug shapes.
 */

import { hash2, mulberry32, hashString } from '../core/rng';
import { isPlaceholder, paintPlaceholder } from './placeholders';

export interface Painted {
  canvas: HTMLCanvasElement;
  /** Display size in world pixels. */
  width: number;
  height: number;
  anchor: [number, number];
  tiling?: boolean;
}

export const PALETTE = {
  pine: '#273f38',
  olive: '#667749',
  meadow: '#9ca65c',
  straw: '#d2be7a',
  earth: '#a18358',
  timber: '#71553e',
  river: '#518d99',
  deepWater: '#356875',
  blossom: '#eeb6b0',
  stone: '#777d77',
  snow: '#e5eaf0',
  ink: '#2b2a26',
  paper: '#f3eee2',
} as const;

function canvasOf(w: number, h: number, density = 2): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * density);
  canvas.height = Math.ceil(h * density);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(density, density);
  return [canvas, ctx];
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, 'rgba(40,50,30,0.35)');
  g.addColorStop(1, 'rgba(40,50,30,0)');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A tiny walking figure: robe, sash, straw hat. `robe` picks the cloth colour. */
function villager(robe: string): Painted {
  const [canvas, ctx] = canvasOf(26, 46, 3);
  shadow(ctx, 13, 42, 10, 3.6);
  ctx.fillStyle = '#5a4634';
  ctx.fillRect(9.6, 36, 2.6, 6);
  ctx.fillRect(13.8, 36, 2.6, 6);
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(8, 17);
  ctx.quadraticCurveTo(13, 13.5, 18, 17);
  ctx.lineTo(19.5, 37);
  ctx.quadraticCurveTo(13, 39.5, 6.5, 37);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(8, 18, 3.2, 18);
  ctx.fillStyle = '#e9dcc0';
  ctx.fillRect(7.4, 25.5, 11.2, 2.4);
  ctx.fillStyle = '#e2c4a2';
  ctx.beginPath();
  ctx.arc(13, 12.4, 3.6, 0, Math.PI * 2);
  ctx.fill();
  // Straw hat seen from above and behind: a shallow cone.
  ctx.fillStyle = '#cdb273';
  ctx.beginPath();
  ctx.ellipse(13, 10.4, 8.6, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e0c98d';
  ctx.beginPath();
  ctx.moveTo(5.2, 10);
  ctx.quadraticCurveTo(13, 0.5, 20.8, 10);
  ctx.quadraticCurveTo(13, 12.4, 5.2, 10);
  ctx.fill();
  return { canvas, width: 20, height: 35.4, anchor: [0.5, 0.92] };
}

/** A koi seen through the water, heading toward +x. */
function fish(body: string, patch: string): Painted {
  const [canvas, ctx] = canvasOf(34, 14, 3);
  // A translucent tail and paired fins give the tiny silhouette anatomy,
  // while keeping the warm koi colours quieter than the bank vegetation.
  ctx.fillStyle = 'rgba(177,167,128,0.65)';
  ctx.beginPath();
  ctx.moveTo(16, 5);
  ctx.lineTo(12, 1);
  ctx.lineTo(21, 5);
  ctx.moveTo(17, 9);
  ctx.lineTo(14, 13);
  ctx.lineTo(23, 9);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(31, 7);
  ctx.bezierCurveTo(26, 1.5, 14, 2, 8, 6);
  ctx.lineTo(1.5, 2.2);
  ctx.quadraticCurveTo(4.4, 7, 1.5, 11.8);
  ctx.lineTo(8, 8);
  ctx.bezierCurveTo(14, 12, 26, 12.5, 31, 7);
  ctx.fill();
  ctx.fillStyle = patch;
  ctx.beginPath();
  ctx.ellipse(20, 6.4, 4.6, 2.3, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(12.5, 7.4, 2.6, 1.5, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-atop';
  const shade = ctx.createLinearGradient(0, 2, 0, 12);
  shade.addColorStop(0, 'rgba(40,67,59,0.42)');
  shade.addColorStop(0.4, 'rgba(244,232,194,0.08)');
  shade.addColorStop(1, 'rgba(40,67,59,0.32)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 34, 14);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#30423b';
  ctx.beginPath();
  ctx.arc(27.2, 6.4, 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(57,76,62,0.45)';
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.arc(25.2, 7, 2.7, -1.4, 1.2);
  ctx.stroke();
  return { canvas, width: 30, height: 12.4, anchor: [0.5, 0.5] };
}

/** A white bird from above, wings spread (`up`) or mid-beat. */
function bird(up: boolean): Painted {
  const [canvas, ctx] = canvasOf(30, 20, 3);
  ctx.fillStyle = '#f6f4ee';
  ctx.strokeStyle = 'rgba(70,80,90,0.5)';
  ctx.lineWidth = 0.6;
  const tip = up ? 2 : 7.5;
  ctx.beginPath();
  ctx.moveTo(15, 9);
  ctx.quadraticCurveTo(8, up ? 3 : 8, 1, tip);
  ctx.quadraticCurveTo(8, up ? 8 : 11, 14, 12);
  ctx.lineTo(15, 17);
  ctx.lineTo(16, 12);
  ctx.quadraticCurveTo(22, up ? 8 : 11, 29, tip);
  ctx.quadraticCurveTo(22, up ? 3 : 8, 15, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d9a441';
  ctx.fillRect(14.4, 5.4, 1.2, 3.4);
  return { canvas, width: 30, height: 20, anchor: [0.5, 0.5] };
}

/** A mallard seen from above, heading toward +x, with a short wake behind it. */
function duck(): Painted {
  const [canvas, ctx] = canvasOf(30, 16, 3);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(9, 5);
  ctx.lineTo(1, 2.5);
  ctx.moveTo(9, 11);
  ctx.lineTo(1, 13.5);
  ctx.stroke();
  ctx.fillStyle = '#7a6248';
  ctx.beginPath();
  ctx.ellipse(13, 8, 7.5, 4.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b8a888';
  ctx.beginPath();
  ctx.ellipse(11.5, 8, 4.6, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2f5a48';
  ctx.beginPath();
  ctx.arc(21.5, 8, 2.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d9a441';
  ctx.fillRect(24, 7.2, 3, 1.6);
  ctx.strokeStyle = '#e1d7b9';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(20, 8, 2.7, Math.PI * 0.65, Math.PI * 1.35);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(79,66,49,0.55)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(8 + i * 2, 6.7);
    ctx.quadraticCurveTo(12 + i * 2, 8.6, 10 + i * 2, 10);
    ctx.stroke();
  }
  ctx.fillStyle = '#192e29';
  ctx.beginPath();
  ctx.arc(22.8, 7.2, 0.45, 0, Math.PI * 2);
  ctx.fill();
  return { canvas, width: 24, height: 12.8, anchor: [0.5, 0.5] };
}

/** A butterfly with its wings spread; drawn white so each can be tinted. */
function butterfly(): Painted {
  const [canvas, ctx] = canvasOf(14, 12, 4);
  ctx.fillStyle = '#ffffff';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(7 + side * 3.2, 4.6, 3.1, 3.6, side * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(7 + side * 2.4, 8.6, 2.2, 2.4, side * -0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#4a3d33';
  ctx.fillRect(6.5, 2.4, 1, 8);
  return { canvas, width: 11, height: 9, anchor: [0.5, 0.5] };
}

/** A soft round glow; used for mist, window light and fireflies. */
function glow(inner: string, outer: string, size = 128): Painted {
  const [canvas, ctx] = canvasOf(size, size, 1);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.55, outer);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return { canvas, width: size, height: size, anchor: [0.5, 0.5] };
}

/** A tongue of flame: deep orange at the root to pale gold at the tip. Drawn with normal blending so it reads on snow. */
function flame(): Painted {
  const [canvas, ctx] = canvasOf(16, 28, 4);
  const g = ctx.createLinearGradient(0, 27, 0, 1);
  g.addColorStop(0, 'rgba(196,64,24,0.95)');
  g.addColorStop(0.45, 'rgba(244,138,40,0.95)');
  g.addColorStop(1, 'rgba(255,226,140,0.9)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(8, 1);
  ctx.bezierCurveTo(11, 9, 15, 15, 14, 21);
  ctx.quadraticCurveTo(13, 27, 8, 27);
  ctx.quadraticCurveTo(3, 27, 2, 21);
  ctx.bezierCurveTo(1, 15, 5, 9, 8, 1);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,240,190,0.85)';
  ctx.beginPath();
  ctx.ellipse(8, 21, 3, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  return { canvas, width: 16, height: 28, anchor: [0.5, 0.92] };
}

/** A ring of stones round a few charred logs, for the village fire. */
function firepit(): Painted {
  const [canvas, ctx] = canvasOf(44, 24, 3);
  shadow(ctx, 23, 15, 21, 7);
  ctx.fillStyle = '#554838';
  ctx.beginPath();
  ctx.ellipse(22, 12, 12, 4.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5a3f2a';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  for (const [x1, y1, x2, y2] of [[14, 14, 29, 9], [15, 9, 30, 14], [22, 7, 22, 16]] as const) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const x = 22 + Math.cos(a) * (15.4 + Math.sin(i * 2.3) * 0.8);
    const y = 12 + Math.sin(a) * (6.8 + Math.cos(i * 1.7) * 0.5);
    const stone = ctx.createRadialGradient(x - 1.2, y - 1.2, 0.3, x, y, 4);
    stone.addColorStop(0, '#b2b0a0');
    stone.addColorStop(0.5, i % 3 === 0 ? '#8d8f78' : '#7a8074');
    stone.addColorStop(1, '#4b574b');
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.ellipse(x, y, 3.6, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.ellipse(x - 0.8, y - 1, 1.8, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return { canvas, width: 44, height: 24, anchor: [0.5, 0.5] };
}

/** A single petal, leaf or flake for the weather layer. */
function mote(colour: string, shape: 'petal' | 'leaf' | 'flake'): Painted {
  const [canvas, ctx] = canvasOf(12, 12, 3);
  ctx.fillStyle = colour;
  ctx.beginPath();
  if (shape === 'flake') ctx.arc(6, 6, 3, 0, Math.PI * 2);
  else if (shape === 'petal') ctx.ellipse(6, 6, 4.4, 2.6, 0.5, 0, Math.PI * 2);
  else {
    ctx.moveTo(1, 6);
    ctx.quadraticCurveTo(6, 0.5, 11, 6);
    ctx.quadraticCurveTo(6, 10, 1, 6);
  }
  ctx.fill();
  return { canvas, width: 12, height: 12, anchor: [0.5, 0.5] };
}

/** A row of mossy stones across a stream. */
function steppingStones(): Painted {
  const [canvas, ctx] = canvasOf(110, 40, 2);
  for (let i = 0; i < 6; i++) {
    const x = 12 + i * 17.5;
    const y = 12 + i * 3.2;
    shadow(ctx, x + 1, y + 5, 9, 3);
    ctx.fillStyle = i % 2 ? '#8a8f86' : '#7b8179';
    ctx.beginPath();
    ctx.ellipse(x, y, 8, 5, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(120,140,70,0.75)';
    ctx.beginPath();
    ctx.ellipse(x - 1, y - 1.6, 5.2, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return { canvas, width: 110, height: 40, anchor: [0.5, 0.5] };
}

/** A generic soft bush for any unknown vegetation or object id, tinted from its name. */
function tuft(id: string): Painted {
  const rng = mulberry32(hashString(id));
  const [canvas, ctx] = canvasOf(64, 56, 2);
  shadow(ctx, 32, 48, 26, 7);
  const tones = [PALETTE.pine, PALETTE.olive, '#7d8f52', PALETTE.meadow];
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = tones[Math.min(3, Math.floor((i / 14) * 4))]!;
    ctx.beginPath();
    ctx.arc(14 + rng() * 36, 44 - (i / 14) * 26 - rng() * 6, 9 + rng() * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  return { canvas, width: 64, height: 56, anchor: [0.5, 0.88] };
}

/** A quiet tiling ground material, used if a surface illustration is missing. */
function surface(base: [number, number, number], id: string): Painted {
  const size = 256;
  const [canvas, ctx] = canvasOf(size, size, 1);
  const image = ctx.createImageData(size, size);
  const seed = hashString(id) & 0xffff;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Wrapped lattice noise so the tile repeats without a seam.
      const n = 0.6 * hash2((x >> 3) % 32, (y >> 3) % 32, seed) + 0.4 * hash2(x % size, y % size, seed + 1);
      const k = 0.86 + n * 0.28;
      const i = (y * size + x) * 4;
      image.data[i] = base[0] * k;
      image.data[i + 1] = base[1] * k;
      image.data[i + 2] = base[2] * k;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return { canvas, width: 512, height: 512, anchor: [0.5, 0.5], tiling: true };
}

const SURFACES: Record<string, [number, number, number]> = {
  meadow: [156, 166, 92],
  'woodland-floor': [110, 122, 72],
  'wetland-ground': [98, 116, 70],
  'mountain-foothill': [134, 136, 104],
  'orchard-ground': [170, 164, 98],
  'riverbank-ground': [176, 152, 104],
  'rocky-ground': [140, 124, 100],
  'calm-water': [81, 141, 153],
};

/** Ids `paintFallback` paints itself (the switch below); keep in step with it. */
const OWN_IDS = new Set([
  'villager', 'farmer', 'traveller', 'fish', 'fish-pale', 'bird-up', 'bird-down', 'mist', 'lamp', 'shadow', 'smoke', 'flame',
  'firepit', 'ember', 'warmth', 'petal', 'leaf', 'leaf-red', 'flake', 'duck', 'butterfly', 'stepping-stones',
]);

/**
 * True when `paintFallback` has a specific stand-in for `id` (its own, a
 * surface, or the placeholder registry), false when it would fall through to
 * the generic bush. Game code uses it to decide whether animation frames exist.
 */
export function hasPlaceholder(id: string): boolean {
  return OWN_IDS.has(id) || id in SURFACES || isPlaceholder(id);
}

export function paintFallback(id: string): Painted {
  switch (id) {
    case 'villager':
      return villager('#3f5873');
    case 'farmer':
      return villager('#8a5a44');
    case 'traveller':
      return villager('#5f7350');
    case 'fish':
      return fish('#bc7949', '#e5dec7');
    case 'fish-pale':
      return fish('#d7d5bc', '#b16a42');
    case 'bird-up':
      return bird(true);
    case 'bird-down':
      return bird(false);
    case 'mist':
      return glow('rgba(255,255,255,0.55)', 'rgba(255,255,255,0.2)', 160);
    case 'lamp':
      return glow('rgba(255,214,140,0.9)', 'rgba(255,190,110,0.25)', 64);
    case 'shadow':
      // The same cool blue-grey as the ground shader's shade, so sprite shadows and terrain shadows agree,
      // and a tree's shadow on snow reads as shade rather than a dark patch.
      return glow('rgba(30,44,74,0.85)', 'rgba(30,44,74,0.42)', 96);
    case 'smoke':
      return glow('rgba(244,244,240,0.7)', 'rgba(236,236,232,0.3)', 96);
    case 'flame':
      return flame();
    case 'firepit':
      return firepit();
    case 'ember':
      return glow('rgba(255,236,170,1)', 'rgba(255,150,60,0.55)', 64);
    case 'warmth':
      return glow('rgba(255,176,96,0.6)', 'rgba(255,160,90,0.24)', 128);
    case 'petal':
      return mote('#f5c9c8', 'petal');
    case 'leaf':
      return mote('#d98a3a', 'leaf');
    case 'leaf-red':
      return mote('#c9553a', 'leaf');
    case 'flake':
      return mote('#ffffff', 'flake');
    case 'duck':
      return duck();
    case 'butterfly':
      return butterfly();
    case 'stepping-stones':
      return steppingStones();
    default:
      if (SURFACES[id]) return surface(SURFACES[id]!, id);
      return paintPlaceholder(id) ?? tuft(id);
  }
}

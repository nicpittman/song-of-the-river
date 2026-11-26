/**
 * Mountains and hills for the valley head: large pieces whose bases fade to
 * transparent so they can overlap in layers. Peaks are shaded per pixel from
 * a ridged height field lit from the upper left (lit west faces, cool shaded
 * east faces, gullies); `-snow` variants share the exact shape and add snow
 * above a ragged snowline. Anchored at the middle of the base.
 */

import { type Painted, type Painter, canvasOf, ellipse, fadeBottom, lighten, painted, rgba, rgbOf } from './common';
import { mulberry32, valueNoise } from '../../core/rng';

interface Summit {
  /** Fraction of the width. */
  x: number;
  /** Fraction of the height of the summit. */
  top: number;
  /** Flank steepness, px down per px across. */
  s: number;
}

interface PeakSpec {
  w: number;
  h: number;
  seed: number;
  summits: Summit[];
}

const PEAKS: PeakSpec[] = [
  { w: 820, h: 520, seed: 11, summits: [{ x: 0.5, top: 0.05, s: 0.9 }, { x: 0.3, top: 0.2, s: 0.8 }, { x: 0.71, top: 0.15, s: 0.9 }] },
  { w: 720, h: 440, seed: 23, summits: [{ x: 0.4, top: 0.1, s: 0.85 }, { x: 0.64, top: 0.14, s: 1.0 }, { x: 0.8, top: 0.34, s: 0.7 }] },
  { w: 900, h: 560, seed: 37, summits: [{ x: 0.56, top: 0.03, s: 1.0 }, { x: 0.36, top: 0.13, s: 0.85 }, { x: 0.22, top: 0.36, s: 0.7 }, { x: 0.76, top: 0.24, s: 0.85 }] },
];

const fbm = (x: number, y: number, seed: number, octaves = 4): number => {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * f, y * f, seed + i * 17) * amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / (1 - Math.pow(0.5, octaves));
};
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

interface Field {
  w: number;
  h: number;
  /** Height, alpha and the slope magnitude per pixel. */
  height: Float32Array;
  alpha: Float32Array;
}

const fields = new Map<number, Field>();

function field(spec: PeakSpec): Field {
  const cached = fields.get(spec.seed);
  if (cached) return cached;
  const { w, h, seed } = spec;
  const height = new Float32Array(w * h);
  const alpha = new Float32Array(w * h);
  const top = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let t = Infinity;
    for (const p of spec.summits) t = Math.min(t, p.top * h + Math.abs(x - p.x * w) * p.s);
    // Fall away toward both sides so the piece never ends in a cut edge.
    t = Math.max(t, h * 1.04 - Math.min(x, w - x) * 1.2);
    // Ragged crest: broad shoulders plus fine broken rock.
    t += (fbm(x / 110, 0.5, seed) - 0.5) * 80 + (fbm(x / 36, 2.5, seed + 7, 3) - 0.5) * 26 + (fbm(x / 12, 3.5, seed + 5, 3) - 0.5) * 10;
    top[x] = t;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const depth = y - top[x]!;
      const base = 1 - smooth(h * 0.66, h * 0.97, y + (fbm(x / 60, 9.5, seed + 9) - 0.5) * 70);
      alpha[i] = smooth(-0.5, 1.6, depth) * base;
      // Each summit throws a sharp ridge down its middle, wandering as it falls.
      let ridge = -Infinity;
      for (const p of spec.summits) {
        const cx = p.x * w + (fbm(y / 90, p.x * 9, seed + 3) - 0.5) * 140 * (y / h);
        ridge = Math.max(ridge, -Math.abs(x - cx) * p.s * 0.7 - (y - p.top * h) * 0.6);
        // Spurs branching down and outward from each summit.
        for (const side of [-1, 1]) {
          const sx = p.x * w + side * (y - p.top * h) * 0.55;
          ridge = Math.max(ridge, -Math.abs(x - sx) * 0.9 - (y - p.top * h) * 0.75 - 22);
        }
      }
      // Gullies: ridged noise stretched downhill.
      const n = fbm(x / 20, y / 44, seed + 1, 4);
      const gully = (1 - Math.abs(n * 2 - 1)) * 18;
      const grain = fbm(x / 6, y / 9, seed + 2, 2) * 5;
      height[i] = ridge + gully + grain;
    }
  }
  const f = { w, h, height, alpha };
  fields.set(spec.seed, f);
  return f;
}

function peak(index: number, snow: boolean): Painted {
  const spec = PEAKS[index]!;
  const { w, h, seed } = spec;
  const f = field(spec);
  const [canvas, ctx] = canvasOf(w, h, 1);
  const image = ctx.createImageData(w, h);
  const shade = rgbOf('#4a5563');
  const mid = rgbOf('#737d84');
  const lit = rgbOf('#b3b2a2');
  const pine = rgbOf('#33473d');
  const pineLit = rgbOf('#5d6f4a');
  const snowLit = rgbOf('#f4f6f8');
  const snowShade = rgbOf('#a9b7cc');
  const L = [-0.62, -0.2, 0.76];
  const len = Math.hypot(L[0]!, L[1]!, L[2]!);
  const lx = L[0]! / len;
  const ly = L[1]! / len;
  const lz = L[2]! / len;
  const lerp3 = (a: number[], b: number[], t: number): number[] => [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const a = f.alpha[i]!;
      if (a <= 0.003) continue;
      const dx = (f.height[i + 1]! - f.height[i - 1]!) * 0.5;
      const dy = (f.height[i + w]! - f.height[i - w]!) * 0.5;
      const nl = Math.hypot(dx, dy, 0.9);
      const d = Math.max(0, (-dx * lx - dy * ly + 0.9 * lz) / nl);
      const t = Math.pow(d, 1.25);
      let c = t < 0.5 ? lerp3(shade, mid, t * 2) : lerp3(mid, lit, (t - 0.5) * 2);
      const alt = 1 - y / h;
      // Forest climbs the lower slopes, raggedly.
      const treeline = 0.42 + (fbm(x / 40, y / 30, seed + 4) - 0.5) * 0.22;
      const forest = smooth(treeline + 0.04, treeline - 0.06, alt);
      if (forest > 0) c = lerp3(c, lerp3(pine, pineLit, 0.25 + t * 0.55), forest * 0.92);
      if (snow) {
        const steep = Math.hypot(dx, dy);
        const line = 0.6 + (fbm(x / 30, y / 22, seed + 6) - 0.5) * 0.2;
        const amount = smooth(line - 0.03, line + 0.04, alt) * (1 - smooth(1.4, 2.6, steep));
        if (amount > 0) c = lerp3(c, lerp3(snowShade, snowLit, Math.min(1, t * 1.15)), amount);
      }
      // A breath of haze: these are big and some way off.
      c = lerp3(c, [168, 182, 196], 0.12);
      const o = i * 4;
      image.data[o] = c[0]!;
      image.data[o + 1] = c[1]!;
      image.data[o + 2] = c[2]!;
      image.data[o + 3] = a * 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return painted(canvas, w, h, [0.5, 0.97]);
}

function foothill(index: number): Painted {
  const W = index ? 460 : 520;
  const H = index ? 230 : 260;
  const [canvas, ctx] = canvasOf(W, H, 1.5);
  const rng = mulberry32(51 + index);
  const domes = index ? [[0.3, 0.24, 0.3], [0.68, 0.36, 0.34]] : [[0.22, 0.4, 0.26], [0.5, 0.16, 0.32], [0.82, 0.34, 0.24]];
  const top = (x: number): number => {
    let t = H;
    for (const [cx, ty, r] of domes) {
      const u = (x / W - cx!) / r!;
      if (Math.abs(u) < 1) t = Math.min(t, ty! * H + (1 - Math.cos(u * Math.PI * 0.5) ** 1.6) * H * 0.62);
    }
    return t + (fbm(x / 24, 1.5, 51) - 0.5) * 8;
  };
  // Body of the hill.
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 4) ctx.lineTo(x, top(x) + 4);
  ctx.lineTo(W, H);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#4f6a42');
  g.addColorStop(1, '#2c4136');
  ctx.fillStyle = g;
  ctx.fill();
  // Tree crowns, back to front, lit from the upper left, each hill's west face brighter.
  const tones = ['#2f4a3c', '#3d5a40', '#4f6a3e', '#62783f', '#567046'];
  for (let y = 0; y < H * 0.95; y += 6.5) {
    for (let x = rng() * 8; x < W; x += 7 + rng() * 4) {
      const t = top(x);
      if (y < t - 2) continue;
      const slope = (top(x + 6) - top(x - 6)) / 12;
      const facing = Math.max(-1, Math.min(1, slope * 1.6));
      const r = 5 + rng() * 4;
      const tone = tones[Math.floor(rng() * tones.length)]!;
      const cy = y + rng() * 3;
      ellipse(ctx, x, cy, r, r * 0.86, tone);
      ellipse(ctx, x - r * 0.25, cy - r * 0.3, r * 0.62, r * 0.48, rgba(lighten(tone, 0.35), 0.25 + Math.max(0, facing) * 0.3));
      if (facing < -0.2) ellipse(ctx, x + 1, cy + 1, r * 0.9, r * 0.7, 'rgba(20,30,40,0.2)');
    }
  }
  // Soft overall light and shade, and a misty foot.
  const wash = ctx.createLinearGradient(0, 0, W, 0);
  wash.addColorStop(0, 'rgba(255,244,214,0.10)');
  wash.addColorStop(1, 'rgba(20,30,46,0.18)');
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  fadeBottom(ctx, W, H * 0.62, H * 0.98);
  return painted(canvas, W, H, [0.5, 0.97]);
}

export const LANDFORMS: Record<string, Painter> = {
  'peak-0': () => peak(0, false),
  'peak-1': () => peak(1, false),
  'peak-2': () => peak(2, false),
  'peak-0-snow': () => peak(0, true),
  'peak-1-snow': () => peak(1, true),
  'peak-2-snow': () => peak(2, true),
  'foothill-0': () => foothill(0),
  'foothill-1': () => foothill(1),
};

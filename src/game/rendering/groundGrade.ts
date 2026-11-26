/**
 * Ground contact grade: the foot of every standing sprite (rocks, cliffs, the
 * waterfall, cottages, fences, ground cover) takes on the colour of the ground
 * it stands in, darkened a little where no sky light reaches, and its very last
 * edge softens, so it sits IN the meadow rather than on it. In winter the same
 * band becomes snow banked against the base.
 *
 * It is baked into the seasonal textures the art library already keeps (one
 * per asset and season), so it costs nothing per frame and sprites still batch.
 * Scenery changes texture when the seasonal front reaches it, so the grade
 * travels down the valley with the front instead of snapping everywhere.
 *
 * Trees have their own root blend (rootBlend.ts), measured from the anchor
 * because a crown overhangs its trunk.
 */

import type { Texture } from 'pixi.js';
import { hashString, valueNoise } from '../core/rng';
import type { Season } from '../world/types';
import type { FoliageKind } from './manifest';

type Rgb = readonly [number, number, number];

/**
 * The meadow's colour per season as the ground shader actually draws it
 * (sampled from the valley in each season): olive-gold grass in spring and
 * summer, a touch fresher in spring, russet-gold in autumn, blue-white snow.
 */
export const GROUND_TONE: Record<Season, Rgb> = {
  0: [122, 134, 62],
  1: [132, 130, 64],
  2: [156, 118, 50],
  3: [198, 208, 226],
};

/** The beach: pale sand, damper and browner in autumn, frosted in winter. */
const SAND_TONE: Record<Season, Rgb> = {
  0: [196, 182, 146],
  1: [200, 184, 144],
  2: [184, 164, 124],
  3: [204, 210, 222],
};

/**
 * Bare scree and rock (round the falls, on the high shelf): a pale, warm
 * stone over a feathered edge. In winter it takes snow like the ground round it.
 */
const ROCK_TONE: Record<Season, Rgb> = {
  0: [134, 126, 104],
  1: [138, 129, 105],
  2: [136, 124, 100],
  3: [184, 192, 208],
};

/** What the ground under a sprite is made of, as far as its grade is concerned. */
export type GroundFamily = 'meadow' | 'rock';

/** Ids that stand on the beach rather than in grass. */
const SANDY = new Set(['boat-beached', 'driftwood', 'stilt-hut', 'dune-grass', 'sea-lavender', 'net-float', 'harbour-light', 'crane-stand', 'net-rack', 'fish-drying-rack']);

/**
 * Things the grade leaves alone: whatever lies flat, floats or stands in the
 * water (its foot is water, not ground), the backdrop, and animals.
 */
const UNGRADED = new Set([
  'foam-rapids', 'water-ripples', 'flow-details', 'small-pool', 'marsh', 'reedbed', 'snow-patch', 'rocky-clearing',
  'wooden-footbridge', 'stone-bridge', 'stepping-stones', 'river-stones',
  'rice-paddy', 'crop-rows', 'vegetable-rows', 'shells', 'wrack', 'rock-pool', 'fish-trap', 'weir',
  'wave-0', 'wave-1', 'wave-2', 'rock-foam', 'sand', 'sea', 'dock', 'boat', 'sea-stack',
  'ford-stone-0', 'ford-stone-1', 'ford-stone-2', 'ford-stone-3', 'lily-bed',
]);
const BACKDROP = /^(peak-|foothill-|mountain-|source-)/;

export type ContactMode = 'stand' | 'cover';

/**
 * How an asset meets the ground: `stand` for solid things (a dark contact and
 * a short band), `cover` for low plants (a deeper, softer fade into the grass),
 * or null where no grade applies.
 */
export function contactMode(id: string, foliage: FoliageKind): ContactMode | null {
  const base = id.replace(/-(spring|summer|autumn|winter)$/, '');
  if (UNGRADED.has(base) || BACKDROP.test(id)) return null;
  if (foliage === 'herb') return 'cover';
  if (foliage === 'hard') return 'stand';
  return null;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Grades the foot of a sprite's pixels in place. `anchorY` is the ground row
 * as a fraction of the height. Each column is measured from its own lowest
 * solid pixel, so a boulder's rounded foot and a cottage's walls are followed
 * exactly; columns whose lowest pixel hangs well above the ground (eaves, an
 * overhanging ledge) are left alone.
 */
export function gradeContactPixels(px: Uint8ClampedArray, w: number, h: number, season: Season, anchorY: number, mode: ContactMode, seed = 0, tone: Rgb = GROUND_TONE[season], snowy = season === 3, fullHeight = h): void {
  const winter = snowy;
  const groundRow = anchorY * h;
  const reach = mode === 'cover' ? h : w * 0.34;
  const lowest = new Float32Array(w);
  const touch = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    lowest[x] = -1;
    for (let y = h - 1; y >= 0; y--) {
      if (px[(y * w + x) * 4 + 3]! > 90) {
        lowest[x] = y;
        break;
      }
    }
    touch[x] = lowest[x]! >= 0 && lowest[x]! >= groundRow - reach ? 1 : 0;
  }
  // Smooth the foot line and the touching weight across columns, so the band has no steps or seams.
  const r = Math.max(1, Math.round(w * 0.015));
  const foot = new Float32Array(w);
  const weight = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let sum = 0, wsum = 0, tsum = 0, n = 0;
    for (let k = -r; k <= r; k++) {
      const j = x + k;
      if (j < 0 || j >= w) continue;
      n++;
      tsum += touch[j]!;
      if (touch[j]! > 0) {
        sum += lowest[j]!;
        wsum++;
      }
    }
    weight[x] = touch[x]! > 0 ? tsum / n : 0;
    foot[x] = wsum ? Math.max(lowest[x]!, sum / wsum) : lowest[x]!;
  }

  const bandBase = mode === 'cover' ? fullHeight * 0.42 : Math.max(3, Math.min(fullHeight * 0.2, w * 0.16));
  const strength = mode === 'cover' ? (winter ? 0.5 : 0.42) : winter ? 0.62 : 0.58;
  const fringeReach = mode === 'cover' ? 0.3 : 0.18;
  const fringeDepth = mode === 'cover' ? 0.55 : 0.5;
  for (let x = 0; x < w; x++) {
    const wt = weight[x]!;
    if (wt <= 0.01) continue;
    const f = foot[x]!;
    // The top of the band wanders, like grass or a drift against a wall.
    const band = bandBase * (winter ? 0.45 + 1.1 * valueNoise(x / Math.max(4, w * 0.09), 0.5, seed) : 0.75 + 0.5 * valueNoise(x / Math.max(4, w * 0.07), 0.5, seed));
    const fringe = Math.max(1.5, band * fringeReach);
    const y0 = Math.max(0, Math.floor(f - band));
    const y1 = Math.min(h - 1, Math.ceil(f + 2));
    for (let y = y0; y <= y1; y++) {
      const i = (y * w + x) * 4;
      const a = px[i + 3]!;
      if (a < 4) continue;
      const d = Math.min(1, Math.max(0, (f - y) / band));
      let t = 1 - d;
      t = t * t * (3 - 2 * t) * wt;
      const red = px[i]!, green = px[i + 1]!, blue = px[i + 2]!;
      // Water and foam keep their own colour: the fall's pool is not grass.
      const water = blue > red + 16 && blue >= green - 8 && !winter;
      const foam = Math.min(red, green, blue) > 205 && !winter;
      const keep = water || foam ? 0.2 : 1;
      let amount = strength * t * keep;
      let tr: number, tg: number, tb: number;
      if (winter) {
        // Snow banks up against the base in drifts, lit warm where it faces the light.
        const drift = valueNoise(x / 9, y / 5, seed + 3) - 0.5;
        amount = Math.min(0.8, amount * 1.2) * smooth(0.25, 0.6, t + drift * 0.6);
        const lit = 0.92 + 0.08 * (1 - x / w);
        tr = tone[0] * lit; tg = tone[1] * lit; tb = tone[2];
      } else {
        // Occlusion: the ground colour in shade, darkest right at the foot where no sky light reaches.
        const shade = 1 - (mode === 'cover' ? 0.12 : 0.18) * smooth(0.4, 0, d);
        tr = tone[0] * shade * 0.94; tg = tone[1] * shade * 0.97; tb = tone[2] * shade;
      }
      px[i] = red + (tr - red) * amount;
      px[i + 1] = green + (tg - green) * amount;
      px[i + 2] = blue + (tb - blue) * amount;
      // The last edge melts into the ground instead of ending on a cut line.
      const e = Math.min(1, Math.max(0, 1 - (f - y) / fringe));
      if (e > 0) px[i + 3] = a * (1 - e * e * fringeDepth * wt);
    }
  }
}

/** A graded copy of `texture`, or null if its pixels cannot be read (or it is a packed atlas frame). */
export function groundContact(texture: Texture, season: Season, id: string, anchorY: number, mode: ContactMode, family: GroundFamily = 'meadow'): HTMLCanvasElement | null {
  const source = texture.source.resource as CanvasImageSource | undefined;
  const w = texture.source.pixelWidth, h = texture.source.pixelHeight;
  if (!source || !w || !h) return null;
  // Only whole images: a frame packed into an atlas would need its rectangle cut out first.
  if (Math.abs(texture.frame.width - texture.source.width) > 1 || Math.abs(texture.frame.height - texture.source.height) > 1) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(source, 0, 0, w, h);
    // Only the lower part of a standing thing can meet the ground: read back just that.
    const top = mode === 'cover' ? 0 : Math.max(0, Math.floor(anchorY * h - w * 0.34 - Math.min(h * 0.2, w * 0.16) * 1.3 - 2));
    const image = ctx.getImageData(0, top, w, h - top);
    const base = id.replace(/-(spring|summer|autumn|winter)$/, '');
    const tone = SANDY.has(base) ? SAND_TONE[season] : family === 'rock' ? ROCK_TONE[season] : GROUND_TONE[season];
    gradeContactPixels(image.data, w, h - top, season, (anchorY * h - top) / (h - top), mode, hashString(id), tone, season === 3 && family !== 'rock', h);
    ctx.putImageData(image, 0, top);
    return canvas;
  } catch {
    return null;
  }
}

/**
 * Reads the baked terrain map (scree is in the blue channel of `terrainB`, see
 * fields.ts) to tell what a sprite stands on. Sprites on scree grade toward
 * bare rock; everything else toward the meadow.
 */
export function groundFamilySampler(terrainB: { data: Uint8Array; width: number; height: number }, extent: { x: number; y: number; width: number; height: number }): (x: number, y: number) => GroundFamily {
  return (x, y) => {
    const tx = Math.floor(((x - extent.x) / extent.width) * terrainB.width);
    const ty = Math.floor(((y - extent.y) / extent.height) * terrainB.height);
    if (tx < 0 || ty < 0 || tx >= terrainB.width || ty >= terrainB.height) return 'meadow';
    return terrainB.data[(ty * terrainB.width + tx) * 4 + 2]! > 0.45 * 255 ? 'rock' : 'meadow';
  };
}

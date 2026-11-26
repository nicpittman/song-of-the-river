/**
 * Seasonal recolouring. The art library holds most plants in a single season;
 * the other three are derived here by repainting foliage pixels (hue ranges
 * that read as leaves or blossom) and laying snow on lit upper surfaces.
 * Trunks, stone and timber are left alone. When the library supplies a real
 * seasonal illustration this step is simply not used for that asset.
 */

import type { Texture } from 'pixi.js';
import { hash2, hashString, valueNoise } from '../core/rng';
import { AUTUMN, SPRING, SUMMER, type Season, WINTER } from '../world/types';

import type { FoliageKind } from './manifest';
export type { FoliageKind };

const KINDS: Record<string, FoliageKind> = {
  'cherry-spring': 'blossom',
  maple: 'maple',
  pine: 'evergreen',
  'deciduous-small': 'deciduous',
  'dense-forest': 'deciduous',
  'forest-grove': 'deciduous',
  'sparse-woodland': 'deciduous',
  'orchard-tree': 'deciduous',
  'orchard-cluster': 'deciduous',
  willow: 'deciduous',
  shrubs: 'deciduous',
  deer: 'none',
  waterfall: 'hard',
  'foam-rapids': 'none',
  'stepping-stones': 'none',
  'water-ripples': 'none',
  'flow-details': 'none',
  'small-pool': 'herb',
};

export function foliageKind(id: string, category: string): FoliageKind {
  if (/^(peak-|foothill-|source-cliff$|mountain-shoulder$|mountain-panorama$)/.test(id)) return 'deciduous';
  const known = KINDS[id];
  if (known) return known;
  if (category === 'vegetation' || id === 'bank-vegetation' || id === 'undergrowth' || id === 'marsh' || id === 'reedbed') return 'herb';
  if (category === 'wildlife' || category === 'villagers') return 'none';
  return 'hard';
}

/** Winter's muted colour on timber, thatch and stone; the ground shader's winter saturation. */
const WINTER_SATURATION = 0.82;

/**
 * How fully the summer and spring greens replace an asset's own foliage colour.
 * The willow is a yellow-green tree by nature and keeps some of it.
 */
const LUSH: Record<string, number> = { willow: 0.55 };

/**
 * Patches that lie flat with their own painted ground round open water. Their
 * water is never recoloured as leaves, and in winter the painted grass round it
 * is snowed over as a whole, so a pond is not a golden island in the snow.
 */
const FLAT_PATCH = new Set(['small-pool', 'marsh', 'reedbed', 'moss-grasses', 'rice-paddy', 'crop-rows', 'vegetable-rows']);

/**
 * Returns a recoloured copy of `texture`, or null if its pixels cannot be read.
 * `variant` picks one of a few versions so a wood is not one flat colour; `id`
 * seeds the patchwork of colour within a single image, so the separate trees
 * of a clump turn differently.
 */
export function recolour(texture: Texture, kind: FoliageKind, season: Season, variant: number, id = ''): HTMLCanvasElement | null {
  const source = texture.source.resource as CanvasImageSource | undefined;
  const w = texture.source.pixelWidth;
  const h = texture.source.pixelHeight;
  if (!source || !w || !h) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, w, h);
  let image: ImageData;
  try {
    image = ctx.getImageData(0, 0, w, h);
  } catch {
    return null;
  }
  const px = image.data;
  const snowy = season === WINTER;
  // Lightness of the untouched image, read up front: snow settles on surfaces
  // that are brighter than the pixels just below them, the tops of leaf clumps,
  // boughs, roofs and stones, which is what lets the dark undersides show.
  // It is blurred a little so snow gathers in clumps rather than glittering pixel by pixel.
  const light = snowy ? blurredLightness(px, w, h) : null;
  const seed = (hashString(id) + variant * 101) | 0;
  // About one tree's width in a clump, or a few leaf masses in a single tree.
  const patchScale = Math.max(w, h) / 4.5;
  const lush = LUSH[id] ?? 1;
  const snowStrength = kind === 'evergreen' ? 1 : kind === 'herb' ? 0.55 : kind === 'hard' ? 0.95 : 0.95;
  const reach = Math.max(3, Math.round(h / 110));
  const rooted = id !== 'mountain-panorama' && (kind === 'deciduous' || kind === 'evergreen' || kind === 'blossom' || kind === 'maple' || kind === 'herb');
  const flat = FLAT_PATCH.has(id);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const j = y * w + x;
      const i = j * 4;
      if (px[i + 3]! < 8) continue;
      let [hue, sat, lig] = rgbToHsl(px[i]!, px[i + 1]!, px[i + 2]!);
      // Preserve the panorama's open sky while the same ridge pixels change season. The sky reaches
      // the horizon at 42-50% of the image; it is far more saturated (about .8) than any distant
      // ridge (at most about .46), so a row cut-off is not needed and would snow a straight band.
      if (id === 'mountain-panorama' && y < h * .62 && hue > 190 && hue < 230 && sat > .6 && lig > .56) continue;
      // Open water (teal) in a herb patch is not foliage.
      const water = kind === 'herb' && ((hue > 158 && hue < 215 && sat > 0.12)
        // The new paddies have pale, silty green water, distinct from the stronger green rice shoots.
        || (id === 'rice-paddy' && hue > 80 && hue < 190 && sat < .28 && lig > .38));
      const green = hue > 52 && hue < 175 && sat > 0.1 && !water;
      const pink = ((hue > 295 || hue < 28) && lig > 0.5 && sat > 0.16) || (kind === 'blossom' && lig > 0.72 && sat < 0.2);
      const red = (hue < 48 || hue > 335) && sat > 0.42 && lig > 0.2 && lig < 0.78;
      const grain = hash2(x >> 2, y >> 2, 7);
      // Clumps mix in conifers, painted in a darker blue-green than any broadleaf; those keep their needles.
      const needle = kind === 'deciduous' && green && hue > 104 && lig < 0.4 && (season === AUTUMN || season === WINTER);
      const leaf = ((kind === 'deciduous' && green) || (kind === 'blossom' && pink)) && !needle;
      const patch = leaf ? valueNoise(x / patchScale, y / patchScale, seed) : 0.5;

      if (leaf && season !== WINTER && !(kind === 'blossom' && season === SPRING)) {
        if (season === AUTUMN) [hue, sat, lig] = autumnLeaf(hue, sat, kind === 'blossom' ? lig * 0.66 : lig, patch + (variant ? 0.14 : -0.06) + (grain - 0.5) * 0.05);
        else [hue, sat, lig] = greenLeaf(hue, kind === 'blossom' ? 0.3 : sat, kind === 'blossom' ? lig * 0.55 : lig, season, patch, variant, lush);
      } else if (leaf && season === WINTER) {
        // Broadleaves stand bare: a pale, frosted haze of twigs that takes the snow's own blue-grey,
        // so a winter wood reads as soft and light, not dark. A little copper of dead leaves hangs on.
        const copper = variant === 1 && patch > 0.74;
        [hue, sat, lig] = copper ? [26 + patch * 8, 0.3, lig * 0.8 + 0.16] : [lerp(205, 228, patch), 0.1, 0.34 + lig * 0.34];
      } else if (kind === 'maple' && red) {
        if (season === SPRING) [hue, sat, lig] = [70 + grain * 10, 0.36, lig * 0.84];
        else if (season === SUMMER) [hue, sat, lig] = [80 + grain * 10, 0.32, lig * 0.72];
        else if (season === WINTER) [hue, sat, lig] = [30, 0.14, lig * 0.7];
      } else if ((kind === 'evergreen' && green && snowy) || (needle && snowy)) {
        // Needles go darker and bluer in the cold, so they read under the snow.
        [hue, sat, lig] = [lerp(hue, 150, 0.6), sat * 0.75, lig * 0.82];
      } else if (kind === 'herb' && green) {
        if (season === AUTUMN) [hue, sat, lig] = [50 - grain * 8, sat * 0.95, lig * 1.03];
        else if (season === WINTER) [hue, sat, lig] = [40 + grain * 6, sat * 0.6 + 0.08, lig * 0.98];
      } else if (kind === 'herb' && snowy && pink) {
        // No flowers in the snow: the painted blossom fades to dry seed heads.
        [hue, sat, lig] = [32, sat * 0.25, lig * 0.9];
      } else if (water && snowy) {
        // Winter water: darker and greyer, like the river's own winter tint.
        [hue, sat, lig] = [lerp(hue, 200, 0.5), sat * 0.7, lig * 0.9];
      } else if (kind === 'hard' && snowy && green) {
        // Moss on stone goes dull and dark in the cold; bright olive moss fought the blue snow.
        [hue, sat, lig] = [lerp(hue, 96, 0.4), sat * 0.5, lig * 0.86];
      } else if (kind === 'hard' && snowy) {
        // Timber, thatch and stone in the grey winter light: as muted as the ground's own grade,
        // so a cottage does not glow warm against the snow (see SEASON_LOOKS in ground.ts).
        sat *= WINTER_SATURATION;
      }

      let [r, g, b] = hslToRgb(hue, sat, lig);
      if (light) {
        const here = light[j]!;
        const below = y + reach < h ? light[j + reach * w]! : here;
        const facing = smooth(0.005, 0.06, here - below);
        const bright = smooth(0.28, 0.6, here);
        const clump = valueNoise(x / 7, y / 6, 5) - 0.5;
        // Snow lies heaviest on the fine twigs of a bare crown.
        const cover = (facing * (0.55 + 0.45 * bright) + bright * bright * 0.55 + 0.18 * (1 - y / h) + (leaf ? 0.16 : 0)) * snowStrength;
        const snow = smooth(0.3, 0.58, cover + clump * 0.3);
        // Warm white where the sun strikes, blue in the shade, like the ground's snow.
        r += (lerp(178, 248, bright) - r) * snow;
        g += (lerp(194, 245, bright) - g) * snow;
        b += (lerp(222, 238, bright) - b) * snow;
        if (flat && !water) {
          // A flat patch's painted grass is all ground: snow it over like the valley round it.
          const buried = 0.62 + 0.18 * clump;
          r += (lerp(170, 228, bright) - r) * buried;
          g += (lerp(186, 232, bright) - g) * buried;
          b += (lerp(206, 236, bright) - b) * buried;
        } else if (rooted) {
          // The patch of ground painted under a plant is buried too, so it fades into the
          // valley's snow instead of leaving the tree on a dark island.
          const buried = smooth(h * 0.86, h * 0.96, y) * (0.45 + 0.15 * clump);
          r += (lerp(156, 225, bright) - r) * buried;
          g += (lerp(176, 230, bright) - g) * buried;
          b += (lerp(198, 232, bright) - b) * buried;
        }
      }
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/**
 * Spring and summer foliage. The illustrations are painted olive; the
 * references are blue-green in the shade, rich mid-green in the body of a
 * crown and yellow-green only where the sun strikes. Spring is lighter and
 * fresher. `patch` and `variant` shift the green a little per tree.
 */
function greenLeaf(hue: number, sat: number, lig: number, season: Season, patch: number, variant: number, lush: number): [number, number, number] {
  const spring = season === SPRING;
  const t = smooth(0.1, 0.6, lig);
  const shift = (patch - 0.5) * 18 + (variant ? 7 : -3);
  const target = (spring ? lerp(102, 70, t) : lerp(120, 78, t)) + shift;
  // A touch deeper and quieter than the meadows, so the woods frame the river and village rather than compete.
  const s = spring ? Math.min(0.66, sat * 1.1 + 0.15) : Math.min(0.56, sat * 1.0 + 0.11);
  const l = lig * (spring ? 1.0 : 0.88) * (1 + (patch - 0.5) * 0.14 + (variant ? -0.03 : 0.02));
  return [lerp(hue, target, lush), lerp(sat, s, lush), lerp(lig, l, lush)];
}

/**
 * Autumn turns in patches: `c` (0..1, smooth across the image) runs from
 * leaves still green, through gold and orange, to russet.
 */
function autumnLeaf(hue: number, sat: number, lig: number, c: number): [number, number, number] {
  if (c < 0.3) return [lerp(hue, 84, 0.7), Math.min(0.6, sat * 1.05 + 0.1), lig * 0.95];
  const stops: Array<[number, number, number, number]> = [
    // c, hue, saturation, lightness factor
    [0.3, 66, 0.55, 1.0],
    [0.44, 44, 0.72, 1.08],
    [0.62, 28, 0.78, 1.02],
    [0.8, 12, 0.72, 0.9],
  ];
  let k = stops.length - 1;
  while (k > 0 && c < stops[k]![0]) k--;
  const a = stops[k]!;
  const b = stops[Math.min(stops.length - 1, k + 1)]!;
  const t = b === a ? 0 : clamp01((c - a[0]) / (b[0] - a[0]));
  return [lerp(a[1], b[1], t), Math.min(0.9, lerp(a[2], b[2], t) * (0.7 + sat)), lig * lerp(a[3], b[3], t)];
}

/** Lightness (0..1) of every pixel, box-blurred over a few pixels. */
function blurredLightness(px: Uint8ClampedArray, w: number, h: number): Float32Array {
  const light = new Float32Array(w * h);
  for (let j = 0; j < w * h; j++) {
    const i = j * 4;
    light[j] = (Math.max(px[i]!, px[i + 1]!, px[i + 2]!) + Math.min(px[i]!, px[i + 1]!, px[i + 2]!)) / 510;
  }
  const r = 2;
  const tmp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += light[y * w + Math.min(w - 1, Math.max(0, x + k))]!;
      tmp[y * w + x] = sum / (2 * r + 1);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x]!;
      light[y * w + x] = sum / (2 * r + 1);
    }
  }
  return light;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = (((h % 360) + 360) % 360) / 360;
  s = Math.min(1, Math.max(0, s));
  l = Math.min(1, Math.max(0, l));
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number): number => {
    t = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255];
}

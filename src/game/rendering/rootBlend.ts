/** Gentle seasonal colour at tree/soil contacts; original artwork stays untouched. */
import type { Texture } from 'pixi.js';
import type { Season } from '../world/types';
import { hashString, valueNoise } from '../core/rng';

import { GROUND_TONE } from './groundGrade';

/** The meadow's own colour per season, shared with the contact grade on rocks and buildings. */
const SOIL = GROUND_TONE;
const smooth = (a: number, b: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function blendRootPixels(px: Uint8ClampedArray, width: number, height: number, season: Season, anchor = .5, seed = 0): void {
  const soil = SOIL[season]!;
  for (let y = Math.floor(height * .82); y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (!px[i + 3]) continue;
    const grain = valueNoise(x / 19, y / 13, seed);
    const root = smooth(height * (.85 + grain * .025), height * .995, y);
    const trunk = 1 - smooth(width * .025, width * .07, Math.abs(x - width * anchor));
    const tint = root * (.26 - trunk * .13);
    for (let c = 0; c < 3; c++) px[i + c] += (soil[c]! - px[i + c]!) * tint;
    // Most of the footing remains opaque. Only its last irregular fringe softens.
    const edge = smooth(height * (.95 + grain * .025), height, y);
    px[i + 3] *= 1 - edge * (.38 - trunk * .3);
  }
}

export function groundTree(texture: Texture, season: Season, id: string, anchor: number): HTMLCanvasElement | null {
  const source = texture.source.resource as CanvasImageSource | undefined;
  if (!source) return null;
  const canvas = document.createElement('canvas');
  canvas.width = texture.source.pixelWidth; canvas.height = texture.source.pixelHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    blendRootPixels(image.data, canvas.width, canvas.height, season, anchor, hashString(id));
    ctx.putImageData(image, 0, 0);
    return canvas;
  } catch { return null; }
}

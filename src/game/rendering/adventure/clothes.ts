/**
 * Villagers' clothes. Generic villagers share an illustrated figure; each
 * look takes it with its own coat colour, by moving the figure's blue-grey
 * cloth (hue 175°–245°, little saturation) to the look's coat (see LOOKS).
 * Skin, hair, straw and wood are far from that band and stay as painted.
 * Each recoloured frame is made once and kept.
 */

import { CanvasSource, Texture } from 'pixi.js';
import { LOOKS } from '../placeholders/explorers';

/** The look whose coat is the figure's own colour: drawn as painted. */
const AS_PAINTED = 'villager-a';
const dressed = new Map<string, Texture>();

export function villagerTexture(texture: Texture, look: string): Texture {
  // These have their own complete illustrations, including their own cloth colours.
  if (!look.startsWith('villager-') || look === AS_PAINTED || look === 'villager-woman' || look === 'villager-elder' || look === 'villager-farmer') return texture;
  const coat = (LOOKS as Record<string, { coat: string } | undefined>)[look]?.coat;
  if (!coat) return texture;
  const key = `${texture.uid}:${look}`;
  const known = dressed.get(key);
  if (known) return known;
  const made = recolour(texture, coat) ?? texture;
  dressed.set(key, made);
  return made;
}

function recolour(texture: Texture, coat: string): Texture | null {
  const source = texture.source.resource as CanvasImageSource | undefined;
  if (!source || typeof document === 'undefined') return null;
  // The frame is in texture units; the image underneath is at the source's resolution.
  const res = texture.source.resolution || 1;
  const { x, y, width, height } = texture.frame;
  const w = Math.max(1, Math.round(width * res)), h = Math.max(1, Math.round(height * res));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, x * res, y * res, width * res, height * res, 0, 0, w, h);
  const image = ctx.getImageData(0, 0, w, h);
  const px = image.data;
  const [th, ts, tl] = hsl(parseInt(coat.slice(1, 3), 16), parseInt(coat.slice(3, 5), 16), parseInt(coat.slice(5, 7), 16));
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3]! < 8) continue;
    const [hue, sat, lig] = hsl(px[i]!, px[i + 1]!, px[i + 2]!);
    if (hue < 175 || hue > 245 || sat < 0.05 || lig > 0.8) continue;
    // Keep the cloth's folds: its own lightness, moved to the coat's; its saturation scaled to the coat's.
    const [r, g, b] = rgb(th, Math.min(0.85, ts * (sat / 0.2)), Math.max(0.04, Math.min(0.9, lig + (tl - 0.36))));
    px[i] = r; px[i + 1] = g; px[i + 2] = b;
  }
  ctx.putImageData(image, 0, 0);
  // Atlas frames are trimmed: keep the original's full size and trim offset, so the figure keeps its scale and place.
  const made = new CanvasSource({ resource: canvas, resolution: res, scaleMode: texture.source.scaleMode });
  return new Texture({ source: made, orig: texture.orig.clone(), ...(texture.trim ? { trim: texture.trim.clone() } : {}) });
}

function hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function rgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number): number => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

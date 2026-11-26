/**
 * The art manifest written by `scripts/build-assets.mjs`, and the pure rules
 * for choosing between an illustration and a procedural stand-in. Kept free of
 * renderer imports so it can be tested without a browser.
 */

import type { Season } from '../world/types';

export type FoliageKind = 'deciduous' | 'blossom' | 'maple' | 'evergreen' | 'herb' | 'hard' | 'none';

export interface ManifestEntry {
  attachments?: Record<string, { offset: [number,number]; diameter?: number }>;
  file: string;
  size: [number, number];
  /** Display size in logical pixels. */
  logical: [number, number];
  /** Ground-contact point, normalised to the image. */
  anchor: [number, number];
  category: string;
  kind: 'sprite' | 'surface' | 'patch' | string;
  season: string;
  group: string;
  approved: boolean;
  /** For a frame packed in an atlas: its rectangle in the atlas, in texels. */
  frame?: [number, number, number, number];
  /** Where the frame's trimmed pixels sit in its full cell (`size`), in texels. */
  trim?: [number, number];
  /** `first` loads before the title; `later` in the background afterwards. */
  phase?: 'first' | 'later';
}

export interface Manifest {
  version: number;
  assets: Record<string, ManifestEntry>;
}

/** Decides how an id will be drawn. Pure, so the fallback rule can be tested without a browser. */
export function resolveArt(manifest: Manifest | null, id: string): { source: 'image'; entry: ManifestEntry } | { source: 'fallback' } {
  const entry = manifest?.assets[id];
  return entry && entry.file ? { source: 'image', entry } : { source: 'fallback' };
}

/** How many recoloured versions a kind of art has in a season; 0 means the base image is used as is. */
export function variantCount(kind: FoliageKind, season: Season): number {
  const table: Record<FoliageKind, [number, number, number, number]> = {
    // Two of each, matching the two variants the scenery layer asks for.
    deciduous: [2, 2, 2, 2],
    blossom: [0, 2, 2, 2],
    maple: [1, 1, 0, 1],
    evergreen: [0, 0, 0, 1],
    herb: [0, 0, 1, 1],
    hard: [0, 0, 0, 1],
    none: [0, 0, 0, 0],
  };
  return table[kind][season];
}

/**
 * The art library. Every image the game draws is requested here by a stable
 * id. Ids present in `public/art/manifest.json` load the illustrated asset;
 * anything else gets a procedural stand-in painted from the game's palette, so
 * gameplay never waits on art and approved art can replace a stand-in without
 * code changes.
 */

import { Assets, Rectangle, Texture } from 'pixi.js';
import type { Season } from '../world/types';
import { type FoliageKind, foliageKind, recolour } from './seasonalArt';
import { type Manifest, type ManifestEntry, variantCount } from './manifest';
import * as fallbackArt from './fallbackArt';
import { paintFallback } from './fallbackArt';
import { isPlaceholder } from './placeholders';
import { groundTree } from './rootBlend';
import { contactMode, type GroundFamily, groundContact } from './groundGrade';

/** World pixels per logical art pixel. The library is authored at 32 px per metre. */
export const ART_SCALE = 1;

export interface Art {
  attachments?: Record<string, { offset: [number,number]; diameter?: number }>;
  id: string;
  texture: Texture;
  /** Size in world pixels at scale 1. */
  width: number;
  height: number;
  anchor: [number, number];
  /** False when this is a procedural stand-in. */
  illustrated: boolean;
  foliage: FoliageKind;
}

/**
 * Seasonal illustrations that read poorly in the valley, by group and season;
 * those seasons are recoloured in-game from the base image instead. The grove's
 * painted autumn is one flat brown and its painted winter is white to the roots.
 */
const RECOLOUR_ONLY: Record<string, readonly Season[]> = { cherry: [0, 1, 2, 3], 'forest-undergrowth': [2, 3] };
const SEASON_KEYS = ['spring', 'summer', 'autumn', 'winter'] as const;

/**
 * What a painted stand-in is made of, so scenery stand-ins turn with the
 * seasons (snow on a haystack, straw-coloured dune grass) and sit in the
 * ground like the illustrations. Animals, people, lights and effects stay 'none'.
 */
const STAND_IN_KINDS: Record<string, FoliageKind> = {
  'dune-grass': 'herb', 'sea-lavender': 'herb', 'tea-bushes': 'herb', haystack: 'hard', beehive: 'hard', well: 'hard', scarecrow: 'hard',
  'stilt-hut': 'hard', 'boat-beached': 'hard', driftwood: 'hard', 'crane-stand': 'hard', 'net-rack': 'hard', 'fish-drying-rack': 'hard',
  'rice-drying-rack': 'hard', 'crop-rows': 'herb', 'vegetable-rows': 'herb', 'charcoal-kiln': 'hard', 'market-stall': 'hard', 'mushroom-log': 'hard', 'hot-spring': 'hard',
};
const standInFoliage = (id: string): FoliageKind => STAND_IN_KINDS[id] ?? 'none';

/** What is arriving while the art loads, in the order it is fetched: the loading screen names it. */
export type LoadingStage = 'ground' | 'mountains' | 'river' | 'woods' | 'villages' | 'companions' | 'wildlife';
const STAGE_ORDER: readonly LoadingStage[] = ['ground', 'mountains', 'river', 'woods', 'villages', 'companions', 'wildlife'];
export function loadingStage(entry: Pick<ManifestEntry, 'kind' | 'category'>): LoadingStage {
  if (entry.category === 'terrain') return entry.kind === 'sprite' ? 'mountains' : 'ground';
  if (entry.category === 'rivers' || entry.category === 'crossings' || entry.category === 'paths') return 'river';
  if (entry.category === 'vegetation') return 'woods';
  if (entry.category === 'villagers') return 'companions';
  if (entry.category === 'wildlife') return 'wildlife';
  return 'villages';
}

/** Tiling materials the ground shader samples. Other surfaces in the library are not loaded. */
export const GROUND_SURFACES = ['meadow', 'woodland-floor', 'wetland-ground', 'mountain-foothill', 'orchard-ground', 'riverbank-ground', 'rocky-ground', 'calm-water'] as const;

export class ArtLibrary {
  private manifest: Manifest | null = null;
  private readonly arts = new Map<string, Art>();
  /** Seasonal recolours, keyed `id|season|variant`. */
  private readonly variants = new Map<string, Texture>();
  private readonly failed = new Set<string>();
  /** Illustrated seasonal versions of an asset: seasonal group -> season name -> asset id. */
  private readonly groups = new Map<string, Record<string, string>>();
  /** Image requests by file, shared by every id packed into the same file. */
  private readonly files = new Map<string, Promise<Texture>>();
  /** Ids still loading in the background, with their manifest entries. */
  private readonly pending = new Map<string, ManifestEntry>();
  /** A clear texel, the stand-in source for art still on its way. */
  private blank: Texture | null = null;

  /**
   * Loads the manifest and the art needed first (Seseragi, the explorers, the
   * title), resolving as soon as that is in. Pieces marked `later` (other
   * seasons' versions) then load in the background; until one arrives, an id
   * asked for gets a placeholder texture of the right size that the image
   * fills when it lands, so nothing waits and nothing is drawn wrongly sized.
   * Never rejects.
   */
  async load(base: string, onProgress: (fraction: number, stage?: LoadingStage) => void): Promise<void> {
    try {
      const response = await fetch(`${base}manifest.json`);
      if (response.ok) this.manifest = (await response.json()) as Manifest;
    } catch {
      this.manifest = null; // No library at all: the whole valley is drawn procedurally.
    }
    const wanted = Object.entries(this.manifest?.assets ?? {}).filter(
      ([id, entry]) => entry.kind !== 'surface' || (GROUND_SURFACES as readonly string[]).includes(id),
    );
    const later = wanted.filter(([, entry]) => entry.phase === 'later');
    for (const [id, entry] of later) this.pending.set(id, entry);
    // Ground and mountains first (they fill the most of the screen), then river, woods, villages, people and animals.
    const first = wanted.filter(([, entry]) => entry.phase !== 'later')
      .sort(([, a], [, b]) => STAGE_ORDER.indexOf(loadingStage(a)) - STAGE_ORDER.indexOf(loadingStage(b)));
    await this.loadEntries(base, first, onProgress);
    onProgress(1);
    this.complete = this.loadEntries(base, later, () => {});
  }

  /** Resolves once the background art has loaded too. */
  complete: Promise<void> = Promise.resolve();

  /** One request per file: atlases are shared by all the frames packed in them. */
  private sheet(base: string, entry: ManifestEntry): Promise<Texture> {
    let sheet = this.files.get(entry.file);
    if (!sheet) {
      sheet = Assets.load<Texture>({ src: `${base}${entry.file}`, data: { autoGenerateMipmaps: true } }).then((texture) => {
        texture.source.autoGenerateMipmaps = true;
        texture.source.scaleMode = 'linear';
        if (entry.kind === 'surface') texture.source.addressMode = 'repeat';
        return texture;
      });
      this.files.set(entry.file, sheet);
    }
    return sheet;
  }

  private async loadEntries(base: string, entries: Array<[string, ManifestEntry]>, onProgress: (fraction: number, stage?: LoadingStage) => void): Promise<void> {
    // Progress by pixel area, which tracks bytes far better than a count of ids:
    // one ground material weighs as much as dozens of packed animation frames.
    const weight = (entry: ManifestEntry): number => entry.frame ? entry.frame[2] * entry.frame[3] : entry.size[0] * entry.size[1];
    const total = entries.reduce((sum, [, entry]) => sum + weight(entry), 0);
    let loaded = 0;
    const loadEntry = async ([id, entry]: [string, ManifestEntry]): Promise<void> => {
        try {
          const sheet = await this.sheet(base, entry);
          // A frame packed in an atlas: its rectangle, and where its trimmed pixels sit in the full cell.
          const texture = entry.frame
            ? new Texture({
                source: sheet.source,
                frame: new Rectangle(...entry.frame),
                orig: new Rectangle(0, 0, entry.size[0], entry.size[1]),
                trim: new Rectangle(entry.trim?.[0] ?? 0, entry.trim?.[1] ?? 0, entry.frame[2], entry.frame[3]),
              })
            : sheet;
          if (entry.kind !== 'surface') {
            const group = this.groups.get(entry.group) ?? {};
            group[entry.season] = id;
            this.groups.set(entry.group, group);
          }
          const waiting = this.arts.get(id);
          if (waiting && this.pending.has(id)) {
            // Someone already holds the placeholder: fill it in place.
            const t = waiting.texture;
            t.source = texture.source;
            t.frame.copyFrom(texture.frame);
            t.orig.copyFrom(texture.orig);
            // Placeholders are made without a trim; only atlas frames have one, and those load first.
            t.updateUvs();
            t.update();
          } else {
            this.arts.set(id, {
              attachments: entry.attachments,
              id,
              texture,
              width: entry.logical[0] * ART_SCALE,
              height: entry.logical[1] * ART_SCALE,
              anchor: entry.anchor,
              illustrated: true,
              foliage: foliageKind(id, entry.category),
            });
          }
        } catch {
          this.failed.add(id); // Broken or missing file: fall back rather than fail.
          if (this.pending.has(id)) this.arts.delete(id);
        }
        this.pending.delete(id);
        loaded += weight(entry);
        // Name what is being fetched now: the next entry in line, or this one's kind at the very end.
        const next = entries[cursor]?.[1] ?? entry;
        onProgress(loaded / Math.max(1, total), loadingStage(next));
    };
    // Bound image decoding and texture creation on phones; one atlas request
    // is still shared by every frame that refers to it.
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(6, entries.length) }, async () => {
      while (cursor < entries.length) await loadEntry(entries[cursor++]!);
    }));
  }

  /** Ids that were listed but could not be loaded. */
  get missing(): string[] {
    return [...this.failed];
  }

  /**
   * True if `id` will be drawn as itself: an illustration, or a stand-in
   * painted for that id. False if it would fall back to a generic shape.
   * Used to play an animation only once its frames exist.
   */
  known(id: string): boolean {
    if (this.has(id)) return true;
    const probe = (fallbackArt as { hasPlaceholder?: (id: string) => boolean }).hasPlaceholder;
    return probe ? probe(id) : false;
  }

  /** The ids `prefix-0`, `prefix-1`, … that exist, in order: the frames of an animation. */
  frames(prefix: string): string[] {
    const out: string[] = [];
    for (let i = 0; this.known(`${prefix}-${i}`); i++) out.push(`${prefix}-${i}`);
    return out;
  }

  has(id: string): boolean {
    return (this.arts.get(id)?.illustrated ?? false) || this.pending.has(id);
  }

  get(id: string): Art {
    let art = this.arts.get(id);
    const coming = this.pending.get(id);
    if (!art && coming) {
      // Still loading: a clear texture of the final size, filled when the image arrives.
      if (!this.blank) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        this.blank = Texture.from(canvas);
      }
      const size = coming.size;
      const texture = new Texture({ source: this.blank.source, frame: new Rectangle(0, 0, 1, 1), orig: new Rectangle(0, 0, size[0], size[1]) });
      art = { attachments: coming.attachments, id, texture, width: coming.logical[0] * ART_SCALE, height: coming.logical[1] * ART_SCALE, anchor: coming.anchor, illustrated: true, foliage: foliageKind(id, coming.category) };
      this.arts.set(id, art);
    }
    if (!art) {
      const painted = paintFallback(id);
      const texture = Texture.from(painted.canvas);
      texture.source.autoGenerateMipmaps = true;
      if (painted.tiling) texture.source.addressMode = 'repeat';
      art = { id, texture, width: painted.width, height: painted.height, anchor: painted.anchor, illustrated: false, foliage: standInFoliage(id) };
      this.arts.set(id, art);
    }
    return art;
  }

  /**
   * The texture for `id` in a season. Vegetation and snow-catching objects are
   * recoloured from the base illustration; `variant` picks between a few
   * autumn hues so a wood does not turn one flat colour.
   */
  seasonal(id: string, season: Season, variant = 0, ground: GroundFamily = 'meadow'): Texture {
    const art = this.get(id);
    // An illustrated version for this season always wins over a recolour.
    const entry = this.manifest?.assets[id];
    if (entry) {
      const name = SEASON_KEYS[season];
      if (entry.season === name) return this.grounded(id, art.texture, season, ground);
      const sibling = RECOLOUR_ONLY[entry.group]?.includes(season) ? undefined : this.groups.get(entry.group)?.[name];
      if (sibling) return this.grounded(id, this.get(sibling).texture, season, ground);
    } else {
      // A painted stand-in may come in seasons too, named `<id>-spring`, `<id>-autumn` and so on.
      const painted = `${id}-${SEASON_KEYS[season]}`;
      if (isPlaceholder(painted)) return this.grounded(id, this.get(painted).texture, season, ground);
    }
    const count = variantCount(art.foliage, season);
    // A piece still loading cannot be recoloured yet; its own texture fills in when it lands.
    if (count === 0 || this.pending.has(id)) return this.grounded(id, art.texture, season, ground);
    const key = `${id}|${season}|${variant % count}`;
    let texture = this.variants.get(key);
    if (!texture) {
      const canvas = recolour(art.texture, art.foliage, season, variant % count, id);
      if (!canvas) return art.texture;
      texture = Texture.from(canvas);
      texture.source.autoGenerateMipmaps = true;
      this.variants.set(key, texture);
    }
    return this.grounded(id, texture, season, ground);
  }

  /**
   * Seats a sprite in the ground for its season: trees get the root blend,
   * everything else that stands on the ground the contact grade (see groundGrade).
   * Baked once per texture and season, so it costs nothing per frame.
   */
  private grounded(id: string, texture: Texture, season: Season, ground: GroundFamily): Texture {
    const art = this.get(id);
    if (this.pending.has(id) || /^(peak-|foothill-|mountain-|source-)/.test(id)) return texture;
    const tree = art.illustrated && ['deciduous', 'evergreen', 'maple', 'blossom'].includes(art.foliage);
    const mode = tree ? null : contactMode(id, art.foliage);
    if (!tree && !mode) return texture;
    const key = `${id}|${season}|ground-${texture.uid}${tree ? '' : `-${ground}`}`;
    let grounded = this.variants.get(key);
    if (!grounded) {
      const canvas = tree ? groundTree(texture, season, id, art.anchor[0]) : groundContact(texture, season, id, art.anchor[1], mode!, ground);
      if (!canvas) return texture;
      grounded = Texture.from(canvas); grounded.source.autoGenerateMipmaps = true;
      this.variants.set(key, grounded);
    }
    return grounded;
  }

  /** Frees recoloured textures for seasons that are no longer on screen. */
  releaseSeasons(keep: readonly Season[]): void {
    for (const [key, texture] of this.variants) {
      const season = Number(key.split('|')[1]) as Season;
      if (keep.includes(season)) continue;
      texture.destroy(true);
      this.variants.delete(key);
    }
  }
}

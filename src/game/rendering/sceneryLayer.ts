/**
 * Standing scenery: every tree, rock, reed bed and cottage as a depth-sorted
 * sprite. Each sprite changes season on its own, at the moment the seasonal
 * front reaches it, so a turning year is seen crossing the valley tree by tree.
 *
 * Besides the board's fixed scenery, the layer holds named groups that come
 * and go with the player's connections (corridor planting, bridges). New
 * groups grow in along the line the player drew.
 */

import { type Container, Sprite, Texture } from 'pixi.js';
import { valueNoise } from '../core/rng';
import type { Connection } from '../world/connections';
import type { SceneryItem } from '../world/scenery';
import { type Season, WINTER } from '../world/types';
import type { Art, ArtLibrary } from './art';
import { SEASON_LOOKS } from './ground';
import type { GroundFamily } from './groundGrade';
import { frontAlong } from './seasonFront';
import type { FoliageKind } from './manifest';
import type { Vec } from '../core/math';

interface Entry {
  sprite: Sprite;
  /** Soft shadow thrown toward the lower right, away from the light. */
  shadow: Sprite | null;
  item: SceneryItem;
  /** 0 (mountains) .. 1 (river mouth), with a little per-item scatter. */
  along: number;
  season: Season;
  /** The season whose light the sprite's tint was last set for (see gradeOf). */
  graded: Season | null;
  baseScaleX: number;
  baseScaleY: number;
  /** Seconds left of the little swell that marks a seasonal change. */
  pulse: number;
  /** Small ground cover is cleared from under footpaths. */
  clearable: boolean;
  hidden: boolean;
  focalHidden: boolean;
  storyHidden?: boolean;
  group: string | null;
  /** 0..1 growth; fixed scenery starts fully grown. */
  grown: number;
  /** Seconds before growth starts, so planting ripples along a new route. */
  delay: number;
  /** True while a removed group fades away. */
  leaving: boolean;
  /** How far the crown leans in the wind, in radians; 0 for anything that is not a tree. */
  sway: number;
  /** The ground it stands in, which its foot is graded toward (see groundGrade). */
  ground: GroundFamily;
}

/** Things that lie flat or stand in water and should not throw a shadow. */
const SHADOWLESS = new Set([
  'waterfall', 'foam-rapids', 'water-ripples', 'flow-details', 'small-pool', 'marsh', 'reedbed', 'snow-patch', 'rocky-clearing',
  'moss-grasses',
  // Fields, shore litter and sea pieces lie on the ground or the water.
  'rice-paddy', 'crop-rows', 'vegetable-rows', 'shells', 'wrack', 'rock-pool', 'sea-lavender', 'net-float', 'fish-trap', 'weir',
  'wave-0', 'wave-1', 'wave-2', 'rock-foam', 'sand', 'sea',
]);
/**
 * Painted pieces that came out cooler and brighter than the valley round them
 * (the bridges): a warm, slightly darker multiply so the stone and timber sit
 * in the same light as the banks they rest on.
 */
const FIT: Record<string, number> = { 'stone-bridge': 0xd6c7a6, 'wooden-footbridge': 0xddcdb0 };
const multiplyTint = (a: number, b: number): number =>
  (Math.round(((a >> 16) & 255) * ((b >> 16) & 255) / 255) << 16) | (Math.round(((a >> 8) & 255) * ((b >> 8) & 255) / 255) << 8) | Math.round((a & 255) * (b & 255) / 255);

/** Foreground foliage stays opaque; depth sorting handles people behind trees. */
const FOCAL_ALPHA = 1;
/** Boulders and outcrops that can stand in front of someone. */
const ROCKS = new Set(['large-rock', 'large-rocks', 'mossy-boulder', 'cliff-decoration', 'rocky-clearing', 'small-rocks']);
const SMALL = new Set(['wildflowers', 'flower-meadow', 'moss-grasses', 'small-rocks', 'shrubs', 'log', 'branches', 'undergrowth']);

/**
 * Shadows multiply the ground by this colour where they are densest: the same
 * cool shade the ground shader gives terrace edges turned from the light, so
 * a cottage's shadow and a hillside's shade are one kind of dark. Multiplying
 * (rather than laying a grey over the grass) keeps the grass's own hue, deeper.
 */
const SHADE = 0x8099cc;
/** Densest shadow right at the foot of a wall or stone, where no sky light reaches. */
const CONTACT = 0.8;
/** Soft occlusion spreading out round the base of anything standing on the ground. */
const POOL = 0.38;
/** The cast shadow, thrown away from the light. */
const CAST_DENSITY = 0.6;
/** Leafy crowns let light through; their shadows are lighter. */
const CROWN_DENSITY = 0.4;
/**
 * Light falls from the upper left, as on the ground's relief. A point `h` world
 * pixels above the ground throws its shadow this far right and down per pixel
 * of height: a high sun, so shadows are short, and the ground is foreshortened,
 * so they run more across than down.
 */
const CAST = { x: 0.56, y: 0.22 } as const;
/** Kinds whose crowns stand on a single trunk: the whole sprite stands on its anchor point. */
const CROWNED: ReadonlySet<FoliageKind> = new Set(['deciduous', 'evergreen', 'blossom', 'maple']);

interface ShadowArt {
  texture: Texture;
  anchor: [number, number];
  /** The shadow image's size relative to the sprite it belongs to. */
  span: [number, number];
}

/** Baked shadows, one per image and facing; null where the image's pixels cannot be read. */
const shadowCache = new WeakMap<Texture, Map<boolean, ShadowArt | null>>();

function shadowOf(art: Art, flip: boolean): ShadowArt | null {
  let byFacing = shadowCache.get(art.texture);
  if (!byFacing) {
    byFacing = new Map();
    shadowCache.set(art.texture, byFacing);
  }
  if (!byFacing.has(flip)) byFacing.set(flip, bakeShadow(art, flip));
  return byFacing.get(flip) ?? null;
}

/**
 * Paints the shadow a sprite throws on the ground, from its own silhouette, so
 * a fence throws a fence-shaped shadow and a cottage a cottage-shaped one; no
 * sprite stands on a round disc.
 *
 * The silhouette is read at low resolution. The lowest solid pixel of each
 * column is taken as where that part of the object meets the ground (for a
 * building, the foot of its front walls), and every pixel above it is cast
 * along CAST by its height above that point. A tree stands on its trunk, so all
 * of a crown is measured from the anchor. Three layers are blurred and
 * combined: a dark, tight contact line where the object touches the ground, a
 * soft pool of occlusion round its footprint, and the lighter cast shadow.
 */
function bakeShadow(art: Art, flip: boolean): ShadowArt | null {
  const source = art.texture.source.resource as CanvasImageSource | undefined;
  if (!source) return null;
  // About two world pixels per texel: the shadow is soft, and this keeps baking quick.
  const w = Math.max(12, Math.min(220, Math.round(art.width / 2)));
  const h = Math.max(8, Math.round((w * art.height) / art.width));
  const sample = document.createElement('canvas');
  sample.width = w;
  sample.height = h;
  const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
  if (!sampleCtx) return null;
  if (flip) sampleCtx.setTransform(-1, 0, 0, 1, w, 0);
  let alpha: Uint8ClampedArray;
  try {
    sampleCtx.drawImage(source, 0, 0, w, h);
    alpha = sampleCtx.getImageData(0, 0, w, h).data;
  } catch {
    return null;
  }

  const crowned = CROWNED.has(art.foliage);
  const density = crowned ? CROWN_DENSITY : CAST_DENSITY;
  const ax = flip ? 1 - art.anchor[0] : art.anchor[0];
  const groundRow = art.anchor[1] * h;
  // A slanted footprint is never deeper on screen than about a third of its width;
  // anything whose lowest pixel is higher than that (an eave, a branch) is off the ground.
  const deepest = groundRow - w * 0.34;
  const softCast = Math.max(1.5, w * 0.035);
  const softContact = Math.max(1.5, w * 0.022);
  const softPool = Math.max(2, w * 0.05);
  const padLeft = Math.ceil(softPool * 3);
  const padTop = padLeft;
  const padRight = Math.ceil(groundRow * CAST.x + softPool * 3);
  const padBottom = Math.ceil(groundRow * CAST.y + softPool * 3);
  const cw = w + padLeft + padRight;
  const ch = h + padTop + padBottom;
  const at = (x: number, y: number): number => (y + padTop) * cw + x + padLeft;

  // Where each column of the silhouette meets the ground, or -1 where it does not.
  const foot = new Int32Array(w).fill(-1);
  const lowestOf = new Int32Array(w).fill(-1);
  for (let x = 0; x < w; x++) {
    for (let y = h - 1; y >= 0 && lowestOf[x]! < 0; y--) if (alpha[(y * w + x) * 4 + 3]! > 90) lowestOf[x] = y;
    const lowest = lowestOf[x]!;
    if (lowest < 0) continue;
    const touches = crowned ? lowest >= groundRow - h * 0.06 : lowest >= deepest;
    if (touches) foot[x] = lowest;
  }
  // The footprint's far edge on screen: the highest point at which the object meets the ground.
  let back = groundRow;
  for (const y of foot) if (y >= 0) back = Math.min(back, y);
  back = Math.min(back, groundRow - w * 0.04);

  // Contact: a dark line just below the foot of each wall or stone, so it is not all
  // hidden behind the sprite's own edge. Pool: the footprint itself, blurred wide, which
  // spreads a soft occlusion a little way out round the base on every side.
  const contact = new Float32Array(cw * ch);
  const pool = new Float32Array(cw * ch);
  const cast = new Float32Array(cw * ch);
  for (let x = 0; x < w; x++) {
    const lowest = lowestOf[x]!;
    if (lowest < 0) continue;
    if (foot[x]! >= 0) {
      for (let k = 0; k <= 2; k++) contact[at(x, lowest + k)] = 1;
      for (let y = Math.floor(back); y <= lowest; y++) pool[at(x, y)] = 1;
    }
    // The cast shadow: every pixel of the column, thrown away from the light by its height.
    const ground = crowned ? groundRow : Math.max(lowest, deepest);
    for (let y = 0; y <= lowest; y++) {
      const a = alpha[(y * w + x) * 4 + 3]! / 255;
      if (a < 0.05) continue;
      const height = Math.max(0, ground - y);
      const i = at(Math.round(x + height * CAST.x), Math.round(ground + height * CAST.y));
      cast[i] = Math.max(cast[i]!, a);
    }
  }
  blur(cast, cw, ch, softCast);
  blur(contact, cw, ch, softContact);
  blur(pool, cw, ch, softPool);

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const image = ctx.createImageData(cw, ch);
  for (let i = 0; i < cw * ch; i++) {
    const light =
      (1 - Math.min(1, contact[i]! * 1.6) * CONTACT) * (1 - Math.min(1, pool[i]! * 1.2) * POOL) * (1 - Math.min(1, cast[i]! * 1.25) * density);
    const dark = 1 - light;
    image.data[i * 4] = 255;
    image.data[i * 4 + 1] = 255;
    image.data[i * 4 + 2] = 255;
    image.data[i * 4 + 3] = Math.round(dark * 255);
  }
  ctx.putImageData(image, 0, 0);
  const texture = Texture.from(canvas);
  return {
    texture,
    anchor: [(padLeft + ax * w) / cw, (padTop + groundRow) / ch],
    span: [cw / w, ch / h],
  };
}

/** Two passes of a box blur in each direction: close enough to a gaussian for a soft shadow. */
function blur(values: Float32Array, w: number, h: number, radius: number): void {
  const r = Math.max(1, Math.round(radius * 0.6));
  const line = new Float32Array(Math.max(w, h));
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) boxLine(values, y * w, 1, w, r, line);
    for (let x = 0; x < w; x++) boxLine(values, x, w, h, r, line);
  }
}

/** Box-blurs `count` values starting at `start`, `stride` apart, in place. */
function boxLine(values: Float32Array, start: number, stride: number, count: number, r: number, line: Float32Array): void {
  for (let i = 0; i < count; i++) line[i] = values[start + i * stride]!;
  let sum = 0;
  for (let i = -r; i <= r; i++) sum += line[Math.min(count - 1, Math.max(0, i))]!;
  for (let i = 0; i < count; i++) {
    values[start + i * stride] = sum / (2 * r + 1);
    sum += line[Math.min(count - 1, i + r + 1)]! - line[Math.max(0, i - r)]!;
  }
}

/**
 * The season's light on standing scenery, as a multiply tint. It takes the
 * warmth of the ground shader's season tint (SEASON_LOOKS): how much blue the
 * meadow's light holds back. Only the warmth: the tint's green bias is for
 * grass, and would turn slate and timber olive. So cottages, stones and trees
 * stand in the same golden light as the meadow round them. Leafy kinds take it
 * more lightly, as their colour is already set per season by the recolouring.
 * Winter is graded when the art is recoloured instead (see seasonalArt), since
 * snow on a roof must stay white.
 */
function gradeOf(season: Season, foliage: FoliageKind): number {
  if (season === WINTER) return 0xffffff;
  const [r, g, b] = SEASON_LOOKS[season].tint;
  const warmth = 1 - b / Math.max(r, g);
  const strength = foliage === 'hard' || foliage === 'none' ? 0.75 : 0.4;
  const green = 1 - warmth * 0.3 * strength;
  const blue = 1 - warmth * strength;
  return (255 << 16) | (Math.round(255 * green) << 8) | Math.round(255 * blue);
}

/**
 * Trees lean with the wind from their roots: the taller and leafier, the more.
 * Conifers are stiffer; rocks, buildings and low plants do not move at all.
 */
function swayOf(foliage: FoliageKind, height: number): number {
  if (height < 70) return 0;
  const supple = foliage === 'deciduous' || foliage === 'blossom' || foliage === 'maple' ? 1 : foliage === 'evergreen' ? 0.5 : 0;
  return supple * Math.min(0.03, 0.012 + height * 0.00008);
}
/**
 * Which colour variant a tree takes. Neighbours tend to agree, so autumn turns
 * in drifts across a wood rather than tree by tree.
 */
const variantOf = (item: SceneryItem): number => (valueNoise(item.x / 260, item.y / 260, 11) + (item.roll - 0.5) * 0.3 < 0.5 ? 0 : 1);
const easeOutBack = (t: number): number => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;

export class SceneryLayer {
  private entries: Entry[] = [];
  private target: Season;
  private time = 0;
  private readonly focalWindows = new Map<string,{left:number;right:number;top:number;bottom:number;depth:number}>();
  private people: readonly Vec[] = [];
  private readonly bridgeDecks = new Map<string, { left: number; right: number; top: number; bottom: number }>();

  /** Clear loose rocks from a finished deck, keeping walkers above the bridge. */
  reserveBridgeDeck(id: string, bounds: { left: number; right: number; top: number; bottom: number } | null): void {
    if (bounds) this.bridgeDecks.set(id, bounds); else this.bridgeDecks.delete(id);
  }
  private onBridgeDeck(entry: Entry): boolean {
    if (entry.group !== null || !['river-stones', 'small-rocks', 'mossy-boulder', 'large-rock', 'large-rocks'].includes(entry.item.asset)) return false;
    const art = this.art.get(entry.item.asset), { x, y, scale, flip } = entry.item;
    const width = art.width * scale, height = art.height * scale;
    const left = x - width * (flip ? 1 - art.anchor[0] : art.anchor[0]), top = y - height * art.anchor[1];
    return [...this.bridgeDecks.values()].some((deck) => left < deck.right && left + width > deck.left && top < deck.bottom && top + height > deck.top);
  }


  /** Loose ground cover gives the occupied ground a little breathing room. */
  private underPerson(entry: Entry): boolean {
    if (!entry.clearable || !['shrubs','undergrowth','moss-grasses'].includes(entry.item.asset)) return false;
    const art=this.art.get(entry.item.asset), scale=entry.item.scale;
    return this.people.some(p=>Math.abs(p.x-entry.item.x)<art.width*scale*.3+10 && Math.abs(p.y-entry.item.y)<art.height*scale*.35+8);
  }

  /** Only foreground crowns crossing a person's body fade; the landscape stays intact. */
  setPeople(people: readonly Vec[]): void { this.people = people; }

  private coversPerson(entry: Entry): boolean {
    const art = this.art.get(entry.item.asset), scale = entry.item.scale;
    const tree = ['deciduous', 'evergreen', 'blossom', 'maple'].includes(art.foliage) && art.height * scale >= 80;
    // Rocks big enough to hide someone standing behind them fade the same way.
    const rock = ROCKS.has(entry.item.asset) && art.height * scale >= 30;
    if (!tree && !rock) return false;
    const width = art.width * scale, height = art.height * scale;
    const left = entry.item.x - width * (entry.item.flip ? 1 - art.anchor[0] : art.anchor[0]) + width * .12;
    const top = entry.item.y - height * art.anchor[1] + height * .04;
    return this.people.some((p) => entry.item.y > p.y + 4 && left < p.x + 13 && left + width * .76 > p.x - 13 && top < p.y - 12 && top + height * .74 > p.y - 60);
  }
  /** Stills the wind in the trees. */
  reducedMotion = false;

  constructor(
    private readonly parent: Container,
    private readonly shadows: Container,
    private readonly art: ArtLibrary,
    items: readonly SceneryItem[],
    private readonly alongOf: (y: number) => number,
    season: Season,
    /** What the ground is made of at a point; meadow when not given. */
    private readonly groundAt: (x: number, y: number) => GroundFamily = () => 'meadow',
  ) {
    this.target = season;
    for (const item of items) this.entries.push(this.make(item, null, 0, false));
  }

  private make(item: SceneryItem, group: string | null, delay: number, growing: boolean): Entry {
    if(item.asset==='watermill' && this.art.has('mill-body')) item={...item,asset:'mill-body',scale:item.scale*this.art.get('watermill').width/this.art.get('mill-body').width};
    const art = this.art.get(item.asset);
    const ground = this.groundAt(item.x, item.y);
    const sprite = new Sprite(this.art.seasonal(item.asset, this.target, variantOf(item), ground));
    sprite.anchor.set(...(item.anchor ?? art.anchor));
    sprite.rotation = item.rotation ?? 0;
    sprite.width = art.width * item.scale;
    sprite.height = art.height * item.scale;
    if (item.flip) sprite.scale.x = -sprite.scale.x;
    sprite.position.set(item.x, item.y);
    sprite.zIndex = item.y + (item.zBias ?? 0);
    const shadow = this.makeShadow(item, art, growing);
    const entry: Entry = {
      sprite,
      shadow,
      item,
      along: this.alongOf(item.y) + (item.roll - 0.5) * 0.07,
      season: this.target,
      graded: null,
      baseScaleX: sprite.scale.x,
      baseScaleY: sprite.scale.y,
      pulse: 0,
      clearable: SMALL.has(item.asset) && group === null,
      hidden: false,
      focalHidden: false,
      group,
      grown: growing ? 0 : 1,
      delay,
      leaving: false,
      sway: swayOf(art.foliage, art.height * item.scale),
      ground,
    };
    if (growing) sprite.scale.set(0);
    this.grade(entry);
    this.parent.addChild(sprite);
    entry.focalHidden=this.coversFocalWindow(entry);
    return entry;
  }

  /**
   * The shadow under and beside a sprite: its silhouette cast away from the
   * light, with a dark line where it meets the ground (see bakeShadow).
   * Small or flat things throw none.
   */
  private makeShadow(item: SceneryItem, art: Art, growing: boolean): Sprite | null {
    const span = art.width * item.scale;
    if (span <= 26 || SHADOWLESS.has(item.asset)) return null;
    const baked = shadowOf(art, item.flip);
    if (!baked) return null;
    const shadow = new Sprite(baked.texture);
    shadow.anchor.set(...baked.anchor);
    shadow.width = span * baked.span[0];
    shadow.height = art.height * item.scale * baked.span[1];
    shadow.position.set(item.x, item.y);
    shadow.rotation = item.rotation ?? 0;
    shadow.tint = SHADE;
    shadow.blendMode = 'multiply';
    shadow.alpha = growing ? 0 : 1;
    this.shadows.addChild(shadow);
    return shadow;
  }

  /** Lights a sprite with its current season's grade. */
  private grade(entry: Entry): void {
    entry.graded = entry.season;
    const light = gradeOf(entry.season, this.art.get(entry.item.asset).foliage);
    const fit = FIT[entry.item.asset];
    entry.sprite.tint = fit ? multiplyTint(light, fit) : light;
  }

  /** Keep the view of an active landmark open by retiring only foreground foliage. */
  reserveFocalView(id:string,bounds:{left:number;right:number;top:number;bottom:number;depth:number}|null):void {
    if(bounds)this.focalWindows.set(id,bounds);else this.focalWindows.delete(id);
    for(const entry of this.entries)entry.focalHidden=this.coversFocalWindow(entry);
  }
  /**
   * True when a tall plant stands in front of a window (its trunk base south of
   * the window's depth) and its crown, not just its picture's empty corners,
   * overlaps it: the inner part of the sprite, above the bare lower trunk.
   */
  private coversFocalWindow(entry:Entry):boolean {
    const art=this.art.get(entry.item.asset),scale=entry.item.scale;
    if(!['deciduous','evergreen','blossom','maple','herb'].includes(art.foliage)||art.height*scale<80)return false;
    const w0=art.width*scale,h0=art.height*scale;
    const left=entry.item.x-w0*(entry.item.flip?1-art.anchor[0]:art.anchor[0])+w0*0.12,right=left+w0*0.76;
    const top=entry.item.y-h0*art.anchor[1]+h0*0.04,bottom=top+h0*0.78;
    for(const w of this.focalWindows.values())if(entry.item.y>w.depth&&left<w.right&&right>w.left&&top<w.bottom&&bottom>w.top)return true;
    return false;
  }

  setSeason(season: Season): void {
    if (season === this.target) return;
    // A new season can arrive before the last one's front has crossed the whole valley
    // (seasons skipped, or a very long valley). The ground then restarts its blend from
    // the season just ending, so every sprite the old front had not reached catches up
    // to that season too; otherwise winter trees could stand on summer grass.
    for (const entry of this.entries) {
      if (entry.season === this.target) continue;
      entry.season = this.target;
      entry.sprite.texture = this.art.seasonal(entry.item.asset, this.target, variantOf(entry.item), entry.ground);
    }
    this.target = season;
  }

  /** Replaces the sprites of a named group. Items are expected in order along the route. */
  setGroup(group: string, items: readonly SceneryItem[], animate = true): void {
    this.removeGroup(group);
    items.forEach((item, i) => this.entries.push(this.make(item, group, animate ? 0.15 + i * 0.07 : 0, animate)));
  }

  /** A story prop changes place without removing unrelated copies elsewhere. */
  setLandmarkHidden(asset: string, at: { x: number; y: number }, hidden: boolean): void {
    for (const entry of this.entries) if (entry.item.asset === asset && Math.hypot(entry.item.x - at.x, entry.item.y - at.y) < 24) entry.storyHidden = hidden;
  }

  removeGroup(group: string): void {
    for (const entry of this.entries) if (entry.group === group) entry.leaving = true;
  }

  /**
   * Makes way for the player's routes. Small ground cover is cleared from under
   * a footpath, and trees standing on any route fade out, leaving a ride
   * through the wood: the line stays visible, and so do the travellers on it.
   */
  setConnections(connections: readonly Connection[]): void {
    for (const entry of this.entries) {
      if (entry.group !== null || entry.item.fixed) continue;
      const reach = entry.clearable ? 22 : 30;
      entry.hidden = connections.some((c) => (entry.clearable ? c.type === 'path' : true) && c.line.nearest(entry.item).d < reach);
    }
  }

  /** `wave` is the seasonal front (see Ground); pass 2 when settled. */
  /**
   * `seen` is the part of the world on screen (with a margin for tall trees).
   * Sprites outside it are not drawn, which is what keeps a long valley cheap.
   */
  update(dt: number, wave: number, seen?: { left: number; top: number; right: number; bottom: number }): void {
    let removed = false;
    this.time += dt;
    const t = this.time;
    const windy = !this.reducedMotion;
    for (const entry of this.entries) {
      const sprite = entry.sprite;
      if (seen) {
        const { x, y } = entry.item;
        const inView = x > seen.left && x < seen.right && y > seen.top && y < seen.bottom;
        sprite.renderable = inView;
        if (entry.shadow) entry.shadow.renderable = inView;
        // Off screen, only what must not be missed is kept up to date: the season, and growing or leaving.
        if (!inView && entry.season === this.target && entry.grown >= 1 && !entry.leaving && entry.pulse <= 0) continue;
      }
      if (entry.sway > 0 && sprite.visible) {
        if (windy) {
          const { x, y } = entry.item;
          // Gusts cross the valley as slow waves, so a wood stirs in patches rather than all at once.
          const gust = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.3 - x * 0.0019 - y * 0.0011));
          const phase = entry.item.roll * 6.283;
          sprite.skew.x = entry.sway * gust * (0.65 * Math.sin(t * 1.15 + phase) + 0.35 * Math.sin(t * 2.6 + phase * 1.7));
        } else if (sprite.skew.x !== 0) sprite.skew.x = 0;
      }
      if (entry.season !== this.target && wave - frontAlong(entry.along, this.target) > 0.05) {
        entry.season = this.target;
        sprite.texture = this.art.seasonal(entry.item.asset, this.target, variantOf(entry.item), entry.ground);
        entry.pulse = 0.5;
      }
      // Covers both a change made here and one made by setSeason.
      if (entry.graded !== entry.season) this.grade(entry);
      let scale = 1;
      if (entry.grown < 1) {
        if (entry.delay > 0) entry.delay -= dt;
        else entry.grown = Math.min(1, entry.grown + dt * 2.2);
        scale = entry.grown <= 0 ? 0 : easeOutBack(entry.grown);
      }
      if (entry.pulse > 0) {
        entry.pulse = Math.max(0, entry.pulse - dt);
        scale *= 1 + 0.05 * Math.sin((entry.pulse / 0.5) * Math.PI);
      }
      if (entry.grown < 1 || entry.pulse > 0 || sprite.scale.y !== entry.baseScaleY) {
        sprite.scale.set(entry.baseScaleX * scale, entry.baseScaleY * scale);
      }
      // Landmark windows never make foliage transparent.
      const alpha = entry.hidden || entry.storyHidden || entry.leaving || this.onBridgeDeck(entry) || this.underPerson(entry) ? 0 : this.coversPerson(entry) ? .2 : entry.focalHidden ? FOCAL_ALPHA : 1;
      if (sprite.alpha !== alpha) {
        const rate = entry.focalHidden || sprite.alpha >= FOCAL_ALPHA - 0.01 ? dt * 1.8 : dt * 3;
        sprite.alpha += Math.sign(alpha - sprite.alpha) * Math.min(Math.abs(alpha - sprite.alpha), this.coversPerson(entry) ? dt * 8 : rate);
        sprite.visible = sprite.alpha > 0.01;
        if (entry.leaving && !sprite.visible) {
          entry.shadow?.destroy();
          sprite.destroy();
          removed = true;
        }
      }
    }
    for (const entry of this.entries) {
      if (entry.shadow && !entry.shadow.destroyed) entry.shadow.alpha = entry.sprite.alpha * Math.min(1, entry.grown * 1.5);
    }
    if (removed) this.entries = this.entries.filter((e) => !e.sprite.destroyed);
  }
}

import panorama from './panorama.json';
/**
 * The far distance above the head of the valley, painted once at load in the
 * manner of the reference art: blue rocky peaks with snow caps, lit warm from
 * the upper left and shaded blue on the right; in front of them overlapping
 * forested hills built from thousands of small tree crowns; and low cloud
 * lying in the gaps between each layer. The nearest hills are the same greens
 * as the valley's own woods and dissolve raggedly into the ground, so the
 * backdrop reads as the valley climbing away rather than a picture behind it.
 *
 * Each layer slides slightly against the others as the camera pans, which
 * gives the paper-theatre depth without a perspective camera. Seasons are
 * separate canvases cross-faded in place; autumn and winter are painted only
 * when first needed, so loading pays for one season only.
 */

import { Container, Sprite, Texture } from 'pixi.js';
import { mulberry32, type Rng, valueNoise } from '../core/rng';
import { AUTUMN, type Season, WINTER } from '../world/types';
import type { Extent } from './fields';
import type { ArtLibrary } from './art';
import { SeasonalLandscape, type LandscapeRect } from './seasonalLandscape';
import { seasonBlendAt } from './seasonFront';
import type { Weather } from '../adventure/model';

/** Clouds over the mountains by weather: how many show, how strongly, and how grey. */
const CLOUD_WEATHER: Record<Weather, { count: number; alpha: number; tint: number; low: number }> = {
  clear: { count: 3, alpha: 0.55, tint: 0xffffff, low: 0 },
  mist: { count: 6, alpha: 0.5, tint: 0xeef1f2, low: 70 },
  rain: { count: 9, alpha: 0.8, tint: 0xb9c3cc, low: 40 },
  snow: { count: 8, alpha: 0.72, tint: 0xdde2e8, low: 30 },
};
const CLOUD_COUNT = 9;

type RGB = [number, number, number];

/** World-pixel height of the backdrop band, measured down from the top of the landscape. */
const BAND = 760;
/** Canvas pixels per world pixel. The backdrop is soft and distant, so half resolution is plenty. */
const DENSITY = 0.75;
/** Extra width each side so parallax never exposes an edge. */
const MARGIN = 140;

/** A rocky range: pixel-painted so its faces can be shaded from the shape of the crest. */
interface Peaks {
  kind: 'peaks';
  /** Band y of the range's base line, and how far the highest peaks rise above it. */
  crest: number;
  relief: number;
  /** Width in world px of the largest peaks. */
  scale: number;
  lit: RGB;
  shade: RGB;
  /** Colour the foot dissolves into. */
  haze: RGB;
  /** Forest on the slopes (shaded and sunlit colours) up to `treeline` (0..1 of the relief), or null for bare rock. */
  forest: [RGB, RGB] | null;
  treeline: number;
  /** Band y below which nothing of this layer can be seen. */
  floor: number;
  parallax: number;
}

/** A belt of forested hills: rounded mounds clothed in painted tree crowns. */
interface Hills {
  kind: 'hills';
  /** Band y of the mounds' feet, and the range of their heights and half-widths. */
  foot: number;
  rise: [number, number];
  span: [number, number];
  floor: number;
  /** World px over which the bottom dissolves into the valley; 0 when another layer covers it. */
  fade: number;
  /** Crown radius in world px. */
  crown: number;
  /** Fraction of trees that are conifers. */
  conifer: number;
  lit: RGB;
  shade: RGB;
  /** Aerial perspective: how far colours lean toward the haze. */
  haze: number;
  /** How strongly autumn turns this layer (distant woods only warm slightly). */
  autumn: number;
  parallax: number;
}

type Layer = Peaks | Hills;

const HAZE: RGB = [214, 224, 232];

const LAYERS: Layer[] = [
  { kind: 'peaks', crest: 340, relief: 210, scale: 560, lit: [156, 174, 202], shade: [98, 122, 162], haze: [208, 220, 232], forest: null, treeline: 0, floor: 500, parallax: 0.1 },
  { kind: 'peaks', crest: 440, relief: 165, scale: 400, lit: [140, 160, 178], shade: [78, 102, 136], haze: [200, 212, 218], forest: [[58, 88, 98], [118, 146, 108]], treeline: 0.42, floor: 580, parallax: 0.075 },
  { kind: 'hills', foot: 520, rise: [55, 105], span: [170, 280], floor: 640, fade: 0, crown: 8, conifer: 0.3, lit: [124, 150, 112], shade: [52, 82, 90], haze: 0.3, autumn: 0.45, parallax: 0.05 },
  { kind: 'hills', foot: 595, rise: [50, 100], span: [150, 250], floor: 655, fade: 0, crown: 10, conifer: 0.25, lit: [134, 162, 84], shade: [42, 76, 66], haze: 0.12, autumn: 0.7, parallax: 0.03 },
  { kind: 'hills', foot: 712, rise: [60, 115], span: [140, 230], floor: BAND, fade: 70, crown: 12, conifer: 0.22, lit: [140, 170, 70], shade: [36, 68, 46], haze: 0, autumn: 1, parallax: 0.012 },
];

/** Snow on the peaks: caps on the summits, and a deeper mantle reaching the forest. */
const CAPS: Record<Season, number> = { 0: 0.8, 1: 0.35, 2: 0.55, 3: 1 };
const MANTLE: Record<Season, number> = { 0: 0.35, 1: 0, 2: 0.12, 3: 1 };
/** Low cloud is heavier in the cold months. */
const VEIL: Record<Season, number> = { 0: 0.85, 1: 0.7, 2: 0.9, 3: 1 };
/** The sky is multiplied by a tint: warm in autumn, overcast in winter. */
const SKY_TINT: Record<Season, RGB> = { 0: [255, 255, 255], 1: [255, 255, 255], 2: [255, 246, 232], 3: [222, 226, 236] };

type Look = 'green' | 'autumn' | 'winter';
const lookOf = (season: Season): Look => (season === AUTUMN ? 'autumn' : season === WINTER ? 'winter' : 'green');

/** A horizontal slice of the band with its own canvas. Drawing happens in band coordinates. */
interface Strip {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  top: number;
}

function makeStrip(width: number, top: number, bottom: number): Strip {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * DENSITY);
  canvas.height = Math.ceil((bottom - top) * DENSITY);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(DENSITY, 0, 0, DENSITY, 0, -top * DENSITY);
  return { canvas, ctx, top };
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scaleRGB = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const css = (c: RGB, alpha = 1): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`;

/** One mound of a hill belt. */
interface Mound {
  cx: number;
  w: number;
  h: number;
  foot: number;
  /** 0 front .. 1 back within its belt; back mounds are hazier. */
  tier: number;
  seed: number;
  /** The belt's own rolling ground, laid under the mounds. */
  base: boolean;
}

/** Band y of a mound's skyline at x, or Infinity where the mound does not reach. */
function moundTop(m: Mound, x: number, seed: number): number {
  const u = (x - m.cx) / m.w;
  if (u <= -1 || u >= 1) return Infinity;
  const shape = (0.5 + 0.5 * Math.cos(Math.PI * u)) ** 0.8;
  const wobble = m.base ? 22 * valueNoise(x / 160, m.seed % 97, seed) : 5 * valueNoise(x / 34, m.seed % 97, seed);
  return m.foot - m.h * shape - wobble;
}

/** Ridged noise gives sharp summits and smooth saddles between them. */
function peakCrest(layer: Peaks, seed: number, x: number): number {
  // Overlapping broad summits make a composed range, with fine rock breaks
  // reserved for the crest. Geometry is shared by every season's snow layers.
  const cell = Math.floor(x / layer.scale);
  let top = layer.crest;
  for (let i = cell - 2; i <= cell + 2; i++) {
    const centre = (i + 0.5 + (valueNoise(i * 7.1, 2, seed) - 0.5) * 0.35) * layer.scale;
    const height = layer.relief * (0.65 + valueNoise(i * 9.3, 5, seed) * 0.35);
    const width = layer.scale * (0.52 + valueNoise(i * 3.1, 7, seed) * 0.22);
    top = Math.min(top, layer.crest - height * Math.exp(-(Math.abs((x - centre) / width) ** 1.45)));
  }
  return top + (valueNoise(x / 43, 1, seed) - 0.5) * 14 + (valueNoise(x / 12, 2, seed) - 0.5) * 4;
}

/** One layer on screen: a container that slides for parallax, holding its season canvases. */
interface Slot {
  illustrated: boolean;
  underpainting?: boolean;
  layer: Layer;
  container: Container;
  /** Land canvases by look; hills paint autumn and winter lazily. */
  looks: Map<Look, Sprite>;
  /** The look showing, or fading in. */
  look: Look;
  top: number;
  bottom: number;
  caps: Sprite | null;
  mantle: Sprite | null;
  veil: Sprite | null;
  mounds: Mound[];
  seed: number;
}

export class Backdrop {
  readonly container = new Container();
  private readonly slots: Slot[] = [];
  private readonly sky: Sprite;
  private readonly width: number;
  private season: Season;
  private veil: number;
  private skyTint: RGB;
  private readonly painted: Array<{ layer: SeasonalLandscape; id: string }> = [];
  /** Drifting clouds over the panorama's sky, behind the peaks; how many show follows the weather. */
  private readonly clouds: Array<{ sprite: Sprite; speed: number; y: number; alpha: number }> = [];
  private cloudWeather: Weather = 'clear';
  private fromSeason: Season;
  private wave = 2;
  private transitioning = false;
  private readonly softened = new Map<string,Texture>();
  private readonly ownedTextures = new Set<Texture>();

  constructor(
    private readonly extent: Extent,
    seed: number,
    season: Season,
    private readonly art?: ArtLibrary,
    private readonly sourceX = 1250,
  ) {
    this.width = extent.width + MARGIN * 2;
    this.fromSeason = this.season = season;
    this.veil = VEIL[season];
    this.skyTint = [...SKY_TINT[season]];

    this.sky = this.spriteOf(this.paintSky(seed));
    // Sky fills the apron; the mountain band itself ends exactly at the
    // northern edge of the playable board (world y = 0).
    this.sky.y = extent.y;
    this.sky.height = Math.max(BAND, -extent.y);
    this.container.addChild(this.sky);

    // The original modular peaks provide the foreground character. The newer
    // continuous range sits quietly behind them, supporting gaps and mountain feet.
    const continuousDistance = this.art?.has('mountain-panorama') ?? false;
    if (continuousDistance) {
      // Anchored on the river's source, but wide enough to reach both edges of the
      // backdrop: a source off-centre otherwise left a strip of bare sky down one side.
      const left = extent.x - MARGIN, right = left + this.width;
      const span = Math.max(this.width, (this.sourceX - left) / .53, (right - this.sourceX) / .47);
      this.addPainted(this.container, 'mountain-panorama', {
        x:this.sourceX - span * .53, y:extent.y, width:span, height:panorama.originalDisplayHeight * panorama.retainedHeight,
      }, 0xd4dfdf);
      this.addClouds(seed);
    }

    LAYERS.forEach((layer, index) => {
      const layerSeed = seed + index * 17;
      const top = layer.kind === 'peaks' ? Math.max(0, layer.crest - layer.relief - 10) : layer.foot - 30 - layer.rise[1] - layer.crown * 2.5;
      const mounds = layer.kind === 'hills' ? this.layoutMounds(layer, layerSeed) : [];
      this.slots.push({ illustrated: false, layer, container: new Container(), looks: new Map(), look: lookOf(season), top, bottom: layer.floor, caps: null, mantle: null, veil: null, mounds, seed: layerSeed });
    });
    // Only use the shared ground underpainting when the continuous distance
    // is unavailable. Never reintroduce the wall of repeated tiny tree crowns.
    let bed: Slot | undefined;
    if (!continuousDistance) {
      const slope: Hills = {kind:'hills',foot:1000,rise:[850,940],span:[420,720],floor:1000,fade:140,crown:5,conifer:.65,lit:[119,143,104],shade:[52,78,66],haze:.14,autumn:.65,parallax:0};
      bed = {illustrated:false,underpainting:true,layer:slope,container:new Container(),looks:new Map(),look:lookOf(season),top:20,bottom:1000,caps:null,mantle:null,veil:null,mounds:this.layoutMounds(slope,seed+719),seed:seed+719};
      bed.looks.set(bed.look,this.spriteOf(this.paintSlope(bed.look,seed)));
      bed.container.addChild(bed.looks.get(bed.look)!);
      this.container.addChild(bed.container);
    }
    this.slots.forEach((slot, index) => {
      const { layer, container } = slot;
      this.container.addChild(container);
      slot.illustrated = this.addIllustrations(slot, index);
      if (slot.illustrated) {
        // The image silhouettes replace both the procedural land and its
        // unrelated snow geometry. Seasonal recolours retain the image alpha.
      } else if (layer.kind === 'peaks') {
        const painted = this.paintPeaks(layer, slot.top, slot.seed);
        slot.looks.set('green', this.spriteOf(painted.land));
        slot.caps = this.spriteOf(painted.caps);
        slot.mantle = this.spriteOf(painted.mantle);
        container.addChild(slot.looks.get('green')!, slot.mantle, slot.caps);
      } else {
        const sprite = this.spriteOf(this.paintHills(slot, slot.look));
        slot.looks.set(slot.look, sprite);
        container.addChild(sprite);
      }
      // Low cloud lies in front of this layer, settled along the skyline of the next.
      const next = this.slots[index + 1];
      if (next && !(continuousDistance && slot.illustrated)) {
        slot.veil = this.spriteOf(this.paintVeil((x) => this.skyline(next, x), slot.seed + 3, index));
        container.addChild(slot.veil);
      }
    });
    if (bed) this.slots.push(bed);
    this.applyLevels();
    if(this.art?.has('source-cliff')) {
      const source = this.art.get('source-cliff');
      this.addPainted(this.container, 'source-cliff', {
        x:this.sourceX-source.width/2, y:180-source.height, width:source.width, height:source.height,
      });
    }
  }

  setSeason(season: Season, immediate = false): void {
    if (season === this.season) {
      if (immediate) this.finishTransition();
      return;
    }
    this.fromSeason = this.season;
    this.season = season;
    this.wave = immediate ? 2 : -0.12;
    this.transitioning = !immediate;
    for (const piece of this.painted) {
      piece.layer.setTextures(this.landformTexture(piece.id, immediate ? season : this.fromSeason), this.landformTexture(piece.id, season));
      piece.layer.update(this.wave, season);
    }
    this.releaseMaskedSeasons(immediate ? [season] : [this.fromSeason, season]);
    const look = lookOf(season);
    for (const slot of this.slots) {
      if (slot.illustrated || slot.layer.kind !== 'hills' || slot.look === look) continue;
      slot.look = look;
      let sprite = slot.looks.get(look);
      if (!sprite) {
        sprite = this.spriteOf(slot.underpainting ? this.paintSlope(look,slot.seed-719) : this.paintHills(slot, look));
        slot.looks.set(look, sprite);
      }
      // The incoming look fades in on top of the outgoing one, so the layers behind never show through.
      sprite.alpha = immediate ? 1 : 0;
      sprite.visible = true;
      slot.container.addChildAt(sprite, slot.looks.size - 1);
      if (immediate) for (const other of slot.looks.values()) other.visible = other === sprite;
    }
  }

  update(dt: number, cameraX: number, centreX: number, wave = 2): void {
    this.wave = wave;
    this.driftClouds(dt);
    for (const piece of this.painted) piece.layer.update(wave, this.season);
    if (this.transitioning && wave >= 1.4) this.finishTransition();
    const k = Math.min(1, dt * 0.5);
    this.veil += (VEIL[this.season] - this.veil) * k;
    const tint = SKY_TINT[this.season];
    for (let i = 0; i < 3; i++) this.skyTint[i]! += (tint[i]! - this.skyTint[i]!) * k;
    for (const slot of this.slots) {
      slot.container.x = (cameraX - centreX) * slot.layer.parallax;
      const incoming = slot.looks.get(slot.look);
      if (incoming && incoming.alpha < 1) {
        incoming.alpha = seasonBlendAt(-BAND + (slot.top + slot.bottom) / 2, this.extent, this.season, wave);
        if (incoming.alpha >= 1) for (const sprite of slot.looks.values()) sprite.visible = sprite === incoming;
        else incoming.visible = true;
      }
    }
    this.applyLevels();
  }

  destroy():void {
    for (const piece of this.painted) piece.layer.destroy();
    for(const texture of this.ownedTextures)texture.destroy(true);
    this.ownedTextures.clear();this.softened.clear();
  }

  private finishTransition(): void {
    for (const piece of this.painted) {
      const texture = this.landformTexture(piece.id, this.season);
      piece.layer.setTextures(texture, texture);
      piece.layer.update(2, this.season);
    }
    this.fromSeason = this.season;
    this.transitioning = false;
    this.wave = 2;
    this.releaseMaskedSeasons([this.season]);
  }

  private releaseMaskedSeasons(keep: readonly Season[]): void {
    for (const [key, texture] of this.softened) {
      if (keep.some(season => key.endsWith(`:${season}`))) continue;
      this.softened.delete(key); this.ownedTextures.delete(texture); texture.destroy(true);
    }
  }

  private addPainted(parent: Container, id: string, rect: LandscapeRect, tint = 0xffffff): void {
    const layer = new SeasonalLandscape(this.landformTexture(id, this.season), rect, this.extent, tint);
    parent.addChild(layer.mesh);
    this.painted.push({layer, id});
  }

  private applyLevels(): void {
    for (const slot of this.slots) {
      const t = seasonBlendAt(-BAND + (slot.top + slot.bottom) / 2, this.extent, this.season, this.wave);
      if (slot.caps) slot.caps.alpha = CAPS[this.fromSeason] + (CAPS[this.season] - CAPS[this.fromSeason]) * t;
      if (slot.mantle) slot.mantle.alpha = MANTLE[this.fromSeason] + (MANTLE[this.season] - MANTLE[this.fromSeason]) * t;
      if (slot.veil) slot.veil.alpha = this.veil * (slot.illustrated ? 0.16 : 1);
    }
    const [r, g, b] = this.skyTint;
    this.sky.tint = ((r | 0) << 16) | ((g | 0) << 8) | (b | 0);
  }

  private spriteOf(strip: Strip): Sprite {
    const texture=Texture.from(strip.canvas);this.ownedTextures.add(texture);
    const sprite = new Sprite(texture);
    // `top` is measured down from the start of the band. Keep the entire
    // band upstream of y=0, even when the terrain apron changes size.
    sprite.position.set(this.extent.x - MARGIN, -BAND + strip.top);
    sprite.width = this.width;
    sprite.height = strip.canvas.height / DENSITY;
    return sprite;
  }

  /** Original mountain silhouettes overlap into the near slopes beneath the terrain blend. */
  private addIllustrations(slot: Slot, index: number): boolean {
    const art = this.art;
    const ids = slot.layer.kind === 'peaks' ? ['peak-0', 'peak-1', 'peak-2'] : ['foothill-0', 'foothill-1'];
    if (!art || !ids.every((id) => art.has(id))) return false;
    // Authored masses and an open source corridor replace rows of repeated stamps.
    const layouts: Array<Array<[number,number,number,number]>> = [
      [[0,-1050,-60,1500],[2,1080,-45,1450],[1,0,-80,1200]],
      [[1,-650,160,1150],[0,760,190,1220]],
      [[0,-900,300,1080],[1,1030,330,980]],
      [[1,-1450,240,830]],
      [[0,1480,310,760]],
    ];
    for (const [variant, dx, y, width] of layouts[index] ?? []) {
      const id = index===3 && art.has('mountain-shoulder') ? 'mountain-shoulder' : ids[variant % ids.length];
      const source = art.get(id);
      // Leave a strip of sky above every summit, including at the pan limit.
      const height = Math.min(width * source.height / source.width, y + 790);
      const displayWidth = height * source.width / source.height;
      this.addPainted(slot.container, id, {
        x:this.sourceX+dx-displayWidth/2, y:y-height, width:displayWidth, height,
      }, index === 0 ? 0xbdcbd5 : index === 1 ? 0xd9e1dc : 0xffffff);
    }
    return true;
  }

  /** Blend only the foot of a mountain; summits and rock detail stay precise. */
  private landformTexture(id:string,season:Season):Texture {
    const key=`${id}:${season}`;
    const saved=this.softened.get(key);if(saved)return saved;
    const original=this.art!.seasonal(id,season);
    const source=original.source.resource as CanvasImageSource;
    const canvas=document.createElement('canvas');canvas.width=original.source.pixelWidth;canvas.height=original.source.pixelHeight;
    const ctx=canvas.getContext('2d')!;
    ctx.drawImage(source,0,0,canvas.width,canvas.height);
    ctx.globalCompositeOperation='destination-in';
    const fade=ctx.createLinearGradient(0,0,0,canvas.height);
    fade.addColorStop(0,'white');fade.addColorStop(.73,'white');fade.addColorStop(.91,'rgba(255,255,255,.7)');fade.addColorStop(1,'transparent');
    ctx.fillStyle=fade;ctx.fillRect(0,0,canvas.width,canvas.height);
    const texture=Texture.from(canvas);texture.source.autoGenerateMipmaps=true;this.softened.set(key,texture);this.ownedTextures.add(texture);return texture;
  }

  /** A quiet, continuous rocky-grass slope beneath the illustrated ranges.
   * Uses the same ground material as the valley, without repeated tiny tree glyphs. */
  private paintSlope(look:Look,seed:number):Strip {
    const strip=makeStrip(this.width,300,1000),ctx=strip.ctx;
    ctx.beginPath();ctx.moveTo(0,1000);
    for(let x=0;x<=this.width+16;x+=16)ctx.lineTo(x,410+55*valueNoise(x/470,2,seed)+30*valueNoise(x/160,9,seed));
    ctx.lineTo(this.width,1000);ctx.closePath();ctx.clip();
    ctx.fillStyle=look==='winter'?'#b4c3d0':look==='autumn'?'#788565':'#6f8b69';ctx.fillRect(0,300,this.width,700);
    const material=this.art?.get('mountain-foothill').texture.source.resource as CanvasImageSource|undefined;
    if(material){ctx.globalAlpha=look==='winter'?.18:.62;for(let x=0;x<this.width;x+=420)for(let y=300;y<1000;y+=420)ctx.drawImage(material,x,y,420,420);ctx.globalAlpha=1;}
    const shade=ctx.createLinearGradient(0,300,0,1000);
    shade.addColorStop(0,look==='winter'?'rgba(189,203,217,.6)':'rgba(82,109,106,.42)');shade.addColorStop(.7,'transparent');
    ctx.fillStyle=shade;ctx.fillRect(0,300,this.width,700);
    return strip;
  }

  /** Band y of a layer's skyline at x (in the layer's own, unscrolled coordinates). */
  private skyline(slot: Slot, x: number): number {
    if (slot.layer.kind === 'peaks') return peakCrest(slot.layer, slot.seed, x);
    let top = Infinity;
    for (const m of slot.mounds) top = Math.min(top, moundTop(m, x, slot.seed));
    return top;
  }

  // ── Sky ──────────────────────────────────────────────────────────────

  /** A soft blue sky warming toward the horizon, with a few fair-weather clouds behind the peaks. */
  private paintSky(seed: number): Strip {
    const strip = makeStrip(this.width, 0, BAND);
    const ctx = strip.ctx;
    const sky = ctx.createLinearGradient(0, 0, 0, BAND);
    sky.addColorStop(0, '#a3c0da');
    sky.addColorStop(0.3, '#c9d9e4');
    sky.addColorStop(0.55, '#ebeee6');
    sky.addColorStop(0.82, 'rgba(236,238,228,1)');
    // Nothing below the near hills' crest is seen, so the sky can stop there.
    sky.addColorStop(0.9, 'rgba(236,238,228,0)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.width, BAND);
    const rng = mulberry32(seed ^ 0x5c1d);
    for (let x = rng() * 300; x < this.width; x += 520 + rng() * 600) {
      this.cloud(ctx, rng, x, 120 + rng() * 90, 220 + rng() * 220, 46 + rng() * 30, 0.85);
    }
    return strip;
  }

  /** The weather the clouds should show; they ease toward it. */
  setWeather(weather: Weather): void {
    this.cloudWeather = weather;
  }

  /** Paints the drifting clouds once: soft heaps scattered across the panorama's sky band. */
  private addClouds(seed: number): void {
    const rng = mulberry32(seed ^ 0xc10d);
    const left = this.extent.x - MARGIN;
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const length = 240 + rng() * 260, height = 44 + rng() * 34;
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(length + height * 3); canvas.height = Math.ceil(height * 3);
      const ctx = canvas.getContext('2d')!;
      this.cloud(ctx, rng, canvas.width / 2, canvas.height * 0.62, length, height, 1);
      const texture = Texture.from(canvas); this.ownedTextures.add(texture);
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      // Spread along the valley, every other one a little higher in the sky.
      sprite.x = left + ((i + rng() * 0.6) / CLOUD_COUNT) * this.width;
      const y = this.extent.y + 90 + (i % 3) * 70 + rng() * 40;
      sprite.y = y;
      sprite.alpha = 0;
      this.container.addChild(sprite);
      this.clouds.push({ sprite, speed: 3 + rng() * 5, y, alpha: 0 });
    }
  }

  private driftClouds(dt: number): void {
    if (!this.clouds.length) return;
    const look = CLOUD_WEATHER[this.cloudWeather];
    const left = this.extent.x - MARGIN, right = left + this.width;
    const k = Math.min(1, dt * 0.35);
    this.clouds.forEach((c, i) => {
      const target = i < look.count ? look.alpha * (0.75 + 0.25 * ((i * 37) % 10) / 10) : 0;
      c.alpha += (target - c.alpha) * k;
      c.sprite.alpha = c.alpha;
      c.sprite.tint = look.tint;
      c.sprite.y += (c.y + look.low - c.sprite.y) * k;
      c.sprite.x += c.speed * dt;
      if (c.sprite.x - c.sprite.width / 2 > right) c.sprite.x = left - c.sprite.width / 2;
    });
  }

  /**
   * A cloud as a cluster of soft puffs: a blue-grey underside first, then
   * warm white tops offset toward the sun, so it is lit from the upper left.
   */
  private cloud(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, length: number, height: number, alpha: number): void {
    const puffs: Array<[number, number, number]> = [];
    const count = Math.max(4, Math.round(length / 22));
    for (let i = 0; i < count; i++) {
      const u = i / (count - 1) - 0.5;
      // Billows heap up toward the middle and trail off thin at the ends.
      const r = height * (0.4 + (0.5 + 0.6 * rng()) * (1 - Math.abs(u) * 1.7));
      puffs.push([x + u * length + (rng() - 0.5) * 16, y - r * 0.5 + (rng() - 0.5) * height * 0.2, Math.max(height * 0.3, r)]);
    }
    const puff = (px: number, py: number, r: number, inner: string, outer: string): void => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, inner);
      g.addColorStop(0.72, outer);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    };
    for (const [px, py, r] of puffs) puff(px + r * 0.15, py + r * 0.25, r, `rgba(176,190,210,${0.55 * alpha})`, `rgba(186,198,216,${0.3 * alpha})`);
    for (const [px, py, r] of puffs) puff(px - r * 0.12, py - r * 0.12, r * 0.85, `rgba(255,252,244,${0.95 * alpha})`, `rgba(250,248,242,${0.8 * alpha})`);
  }

  // ── Rocky peaks ──────────────────────────────────────────────────────

  /**
   * Paints a range pixel by pixel. Each face is lit or shaded by the slope of
   * the crest above it, blurred more the further down the face it is, so a
   * sharp ridge divides sun from shadow at the summit and broadens into spurs
   * below. Fine gullies run down the faces and carry snow lower than the
   * ridges between them, which is what makes the caps look like they sit on rock.
   */
  private paintPeaks(layer: Peaks, top: number, seed: number): { land: Strip; caps: Strip; mantle: Strip } {
    const land = makeStrip(this.width, top, layer.floor);
    const caps = makeStrip(this.width, top, layer.floor);
    const mantle = makeStrip(this.width, top, layer.floor);
    const w = land.canvas.width;
    const h = land.canvas.height;
    const landPx = land.ctx.createImageData(w, h);
    const capsPx = caps.ctx.createImageData(w, h);
    const mantlePx = mantle.ctx.createImageData(w, h);

    const crest = new Float32Array(w);
    for (let cx = 0; cx < w; cx++) crest[cx] = peakCrest(layer, seed, cx / DENSITY);
    // Prefix sums of the crest, for a slope blurred over any width in constant time.
    const prefix = new Float64Array(w + 1);
    for (let cx = 0; cx < w; cx++) prefix[cx + 1] = prefix[cx]! + crest[cx]!;
    const mean = (a: number, b: number): number => {
      const lo = Math.max(0, Math.min(w - 1, a));
      const hi = Math.max(lo, Math.min(w - 1, b));
      return (prefix[hi + 1]! - prefix[lo]!) / (hi - lo + 1);
    };

    const fadeTop = layer.floor - 150;
    for (let cy = 0; cy < h; cy++) {
      const y = top + cy / DENSITY;
      const foot = smooth(fadeTop, layer.floor, y);
      for (let cx = 0; cx < w; cx++) {
        const depth = y - crest[cx]!;
        if (depth < -2) continue;
        const x = cx / DENSITY;
        // The slope of the crest above, sampled a little to one side the further down the
        // face we are, so ridges and gullies wander down the mountain instead of hanging plumb.
        const sx = cx + Math.round(depth * 0.6 * (2 * valueNoise(x / 170, depth / 160, seed + 7) - 1) * DENSITY);
        const broad = Math.max(1, Math.round((3 + depth * 0.45) * DENSITY));
        const fine = Math.max(2, Math.round((5 + depth * 0.15) * DENSITY));
        const slope =
          0.82 * ((mean(sx, sx + broad) - mean(sx - broad, sx)) / ((broad + 1) / DENSITY)) +
          0.18 * ((mean(sx, sx + fine) - mean(sx - fine, sx)) / ((fine + 1) / DENSITY));
        // Gullies run down and away from the ridge on each side.
        const side = slope < 0 ? -1 : 1;
        const gully = valueNoise((x + side * depth * 0.7) / 16, depth / 70, seed + 5) - 0.5;
        // Ribs of rock running down and outward from each ridge, the texture of the faces.
        const rib = 1 - Math.abs(2 * valueNoise((x + side * depth * 0.9) / 34, depth / 140, seed + 6) - 1);
        const sun = smooth(-0.8, 0.8, -slope * 1.2 + gully * 0.18);
        const grain = valueNoise(x / 6, y / 4, seed + 9) - 0.5;
        let col = mix(layer.shade, layer.lit, sun);
        // Lit faces catch a little warmth; gullies are faint darker streaks in the rock.
        col = mix(col, [236, 222, 196], sun * 0.12);
        col = scaleRGB(col, 0.9 + rib * 0.14 + gully * 0.1 + grain * 0.04);
        // Altitude above the base line, 0..1 at the highest summit.
        const alt = (layer.crest - y) / layer.relief;
        if (layer.forest) {
          // Woods climb the slopes to a ragged treeline, higher up the ribs than in the gullies.
          const line = layer.treeline + (valueNoise(x / 50, 3, seed) - 0.5) * 0.3 + (rib - 0.5) * 0.3;
          const tree = smooth(line + 0.04, line - 0.06, alt);
          const canopy = valueNoise(x / 4, y / 3, seed + 21);
          // Forest is rounder than rock, so its light turns more softly across the slope.
          const soft = smooth(-0.35, 0.35, -slope * 1.6);
          const woods = scaleRGB(mix(layer.forest[0], layer.forest[1], smooth(0.15, 0.85, soft * 0.8 + rib * 0.25)), 0.82 + canopy * 0.36);
          col = mix(col, woods, tree);
        }
        col = mix(col, layer.haze, foot * 0.85 + smooth(0.6, -0.5, alt) * 0.15);
        const i = (cy * w + cx) * 4;
        const edge = clamp01((depth + 2) * DENSITY * 0.8);
        landPx.data[i] = col[0];
        landPx.data[i + 1] = col[1];
        landPx.data[i + 2] = col[2];
        landPx.data[i + 3] = 255 * edge * (1 - smooth(layer.floor - 40, layer.floor, y));

        // Snow is warm white in the sun and blue in shade; it lies longer in the gullies.
        const snowCol = mix([164, 182, 210], [250, 247, 240], sun);
        const capLine = 0.76 + (valueNoise(x / 90, 7, seed) - 0.5) * 0.16 + gully * 0.2 - (1 - sun) * 0.04;
        // Below the caps, snow lies in thin streaks down the fall lines of the gullies.
        const streak = valueNoise((x + side * depth * 0.8) / 8, depth / 46, seed + 11);
        const lines = smooth(0.66, 0.72, streak + (alt - 0.4) * 0.6) * smooth(0.28, 0.4, alt);
        // Snow fades out with the land at the layer's floor, so no strip edge shows.
        const floorFade = 1 - smooth(layer.floor - 60, layer.floor - 10, y);
        const cap = Math.max(smooth(0, 0.04, alt - capLine), lines) * edge * floorFade;
        const mantleLine = -0.08 + (valueNoise(x / 60, 9, seed) - 0.5) * 0.2 + gully * 0.4;
        // Ribs of dark rock stand out of the winter mantle.
        const deep = smooth(0, 0.06, alt - mantleLine) * edge * (1 - foot) * floorFade * (1 - 0.5 * smooth(0.55, 0.9, rib));
        const snowShade = 1 + grain * 0.04;
        if (cap > 0) {
          capsPx.data[i] = snowCol[0] * snowShade;
          capsPx.data[i + 1] = snowCol[1] * snowShade;
          capsPx.data[i + 2] = snowCol[2] * snowShade;
          capsPx.data[i + 3] = 255 * cap;
        }
        if (deep > 0) {
          // Below the summits the snow is thinner: forest and rock show through it.
          const thin = alt > 0.3 ? 1 : 0.3 + 0.7 * smooth(-0.2, 0.3, alt + gully * 1.5);
          mantlePx.data[i] = snowCol[0] * snowShade;
          mantlePx.data[i + 1] = snowCol[1] * snowShade;
          mantlePx.data[i + 2] = snowCol[2] * snowShade;
          mantlePx.data[i + 3] = 255 * deep * thin;
        }
      }
    }
    land.ctx.putImageData(landPx, 0, 0);
    caps.ctx.putImageData(capsPx, 0, 0);
    mantle.ctx.putImageData(mantlePx, 0, 0);
    return { land, caps, mantle };
  }

  // ── Forested hills ───────────────────────────────────────────────────

  /** Rounded mounds overlapping along the belt, each a little different in height and breadth. */
  private layoutMounds(layer: Hills, seed: number): Mound[] {
    const rng = mulberry32(seed ^ 0x4111);
    const mounds: Mound[] = [];
    for (let cx = -layer.span[1]; cx < this.width + layer.span[1]; ) {
      const w = layer.span[0] + (layer.span[1] - layer.span[0]) * rng();
      const tier = rng();
      mounds.push({ cx, w, h: layer.rise[0] + (layer.rise[1] - layer.rise[0]) * rng(), foot: layer.foot - tier * 30, tier, seed: Math.floor(rng() * 1e6), base: false });
      cx += w * (0.75 + rng() * 0.5);
    }
    // The belt's rolling ground goes down first, so no dip between mounds reveals the layer
    // behind; then the mounds, back ones first so nearer ones overlap them.
    const base: Mound = { cx: this.width / 2, w: this.width * 4, h: layer.rise[0] * 0.9, foot: layer.foot, tier: 0.5, seed: seed % 1000, base: true };
    return [base, ...mounds.sort((a, b) => b.tier - a.tier)];
  }

  /**
   * Paints a hill belt in one of its looks. Every look uses the same seeded
   * crowns, so the cross-fade between seasons changes colour, not shape.
   */
  private paintHills(slot: Slot, look: Look): Strip {
    const layer = slot.layer as Hills;
    const strip = makeStrip(this.width, slot.top, slot.bottom);
    const ctx = strip.ctx;
    const r = layer.crown;
    for (const m of slot.mounds) {
      const rng = mulberry32(m.seed);
      const topOf = (x: number): number => moundTop(m, x, slot.seed);
      const left = Math.max(-r * 2, m.cx - m.w);
      const right = Math.min(this.width + r * 2, m.cx + m.w);
      const haze = clamp01(layer.haze + m.tier * 0.1);
      // The body: the dark of the understorey, seen between the crowns.
      const body = look === 'winter' ? mix([92, 104, 130], HAZE, haze * 0.6) : mix(scaleRGB(layer.shade, 0.7), HAZE, haze * 0.85);
      ctx.fillStyle = css(body);
      ctx.beginPath();
      ctx.moveTo(left, slot.bottom);
      for (let x = left; x <= right; x += 8) ctx.lineTo(x, Math.min(slot.bottom, topOf(x) + r * 0.45));
      ctx.lineTo(right, slot.bottom);
      ctx.closePath();
      ctx.fill();

      // Crowns, row by row from the crest down, so lower (nearer) trees overlap those above.
      let highest = Infinity;
      for (let x = left; x <= right; x += 16) highest = Math.min(highest, topOf(x));
      for (let y = highest - r * 0.3; y < slot.bottom + r; y += r * 0.72) {
        for (let x = left + rng() * r; x < right; x += r * (1.0 + rng() * 0.4)) {
          const ty = y + (rng() - 0.5) * r * 0.5;
          const roll = rng();
          const roll2 = rng();
          const crest = topOf(x);
          if (ty < crest + r * 0.2) continue;
          // Light from the upper left, modelled on a dome: the sunward flank and the
          // upper slopes are bright, the far flank falls into blue-green shade.
          const u = m.base ? (valueNoise(x / 260, 5, slot.seed) - 0.5) * 1.2 : (x - m.cx) / m.w;
          const v = clamp01((ty - crest) / (m.foot - crest + 50));
          const sun = clamp01(0.62 - 0.85 * u * (1 - 0.35 * v) - 0.3 * v + (roll2 - 0.5) * 0.18);
          const conifer = roll < layer.conifer;
          const size = r * (0.8 + roll2 * 0.4) * (conifer ? 0.85 : 1);
          this.crown(ctx, look, layer, x, ty, size, sun, haze, conifer, roll);
        }
      }
    }
    if (layer.fade > 0) this.dissolve(strip, layer, slot.seed);
    return strip;
  }

  /** One tree crown in a look: a shaded mass with a sunlit cap toward the upper left. */
  private crown(ctx: CanvasRenderingContext2D, look: Look, layer: Hills, x: number, y: number, r: number, sun: number, haze: number, conifer: boolean, roll: number): void {
    let base = mix(layer.shade, layer.lit, sun);
    if (conifer) base = mix(base, scaleRGB(layer.shade, 0.9), 0.55);
    let snowCap: RGB | null = null;
    if (look === 'autumn' && !conifer) {
      // Autumn comes in stands: whole groups turn together, and some stay green.
      const stand = valueNoise(x / 150, layer.foot / 40, 31);
      const hue: RGB = stand < 0.32 ? base : stand < 0.5 ? [200, 156, 56] : stand < 0.7 ? [206, 116, 48] : [160, 70, 42];
      const turned = stand < 0.32 ? 0 : layer.autumn * (0.7 + roll * 0.3);
      base = mix(base, scaleRGB(hue, 0.6 + sun * 0.45), turned);
    } else if (look === 'winter') {
      // Evergreens stay dark under their load; broadleaves are bare grey-brown twigs.
      base = conifer ? mix([28, 48, 56], [52, 78, 82], sun) : mix([78, 70, 82], [128, 112, 108], sun);
      snowCap = mix([160, 176, 206], [244, 241, 234], sun);
    }
    base = mix(base, HAZE, haze);
    // The sunlit cap is the same colour lifted and warmed, so crowns read as texture, not spots.
    const lit = mix(scaleRGB(base, 1.14), [226, 214, 150], 0.08 + sun * 0.1);
    const dark = scaleRGB(base, 0.94);

    ctx.fillStyle = css(dark);
    ctx.beginPath();
    if (conifer) {
      ctx.moveTo(x, y - r * 1.6);
      ctx.lineTo(x + r * 0.7, y + r * 0.5);
      ctx.lineTo(x - r * 0.7, y + r * 0.5);
    } else {
      ctx.ellipse(x, y, r, r * 0.86, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = css(lit);
    ctx.beginPath();
    if (conifer) {
      ctx.moveTo(x - r * 0.04, y - r * 1.5);
      ctx.lineTo(x - r * 0.04, y + r * 0.4);
      ctx.lineTo(x - r * 0.62, y + r * 0.4);
    } else {
      ctx.ellipse(x - r * 0.22, y - r * 0.24, r * 0.68, r * 0.56, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    if (snowCap) {
      ctx.fillStyle = css(mix(snowCap, HAZE, haze * 0.5));
      ctx.beginPath();
      if (conifer) {
        // Snow on the upper tiers and along the sunward edge.
        ctx.moveTo(x, y - r * 1.6);
        ctx.lineTo(x + r * 0.34, y - r * 0.5);
        ctx.lineTo(x - r * 0.5, y - r * 0.15);
      } else {
        // A cap of snow on top of each crown, leaving its dark flanks to show.
        ctx.ellipse(x - r * 0.2, y - r * 0.5, r * 0.58, r * 0.3, 0, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }

  /**
   * The nearest belt dissolves into the valley along a ragged line, so the
   * valley's own woods carry on from it with no straight seam.
   */
  private dissolve(strip: Strip, layer: Hills, seed: number): void {
    const { canvas, ctx } = strip;
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = image.data;
    for (let cx = 0; cx < canvas.width; cx++) {
      const x = cx / DENSITY;
      const start = layer.floor - layer.fade + 26 * (valueNoise(x / 90, 1, seed) - 0.5) + 10 * (valueNoise(x / 18, 2, seed) - 0.5);
      for (let cy = 0; cy < canvas.height; cy++) {
        const y = strip.top + cy / DENSITY;
        if (y < start) continue;
        const keep = 1 - smooth(start, start + layer.fade * 0.85, y);
        px[(cy * canvas.width + cx) * 4 + 3]! *= keep;
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  /** A soft-edged horizontal lens of colour, for mist. */
  private lens(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, colour: string): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, colour);
    g.addColorStop(0.5, colour);
    g.addColorStop(1, colour.replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = g;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }

  // ── Mist ─────────────────────────────────────────────────────────────

  /**
   * Low cloud settled along the skyline of the layer in front: it fills the
   * dips between that layer's hills and drifts across the foot of this one,
   * broken into banks so the land shows between them.
   */
  private paintVeil(line: (x: number) => number, seed: number, index: number): Strip {
    let lo = Infinity;
    let hi = -Infinity;
    for (let x = 0; x <= this.width; x += 16) {
      lo = Math.min(lo, line(x));
      hi = Math.max(hi, line(x));
    }
    // Heaped cloud between the mountains needs headroom above the skyline.
    const strip = makeStrip(this.width, lo - (index < 2 ? 190 : 110), Math.min(BAND, hi + 40));
    const ctx = strip.ctx;
    const rng = mulberry32(seed ^ 0x77e1);
    const strength = 1 - index * 0.12;
    // A thin haze hugging the skyline everywhere.
    for (let x = -60; x < this.width + 60; x += 36) {
      const y = line(x);
      ctx.save();
      ctx.translate(x, y - 14);
      ctx.scale(1, 0.4);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 90);
      g.addColorStop(0, `rgba(236,238,236,${(index < 2 ? 0.3 : 0.16) * strength})`);
      g.addColorStop(1, 'rgba(236,238,236,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-90, -90, 180, 180);
      ctx.restore();
    }
    // Banks of low cloud: long soft lenses, lit on top, gathered in some stretches and
    // absent in others so the hills show through between them.
    for (let x = rng() * 60; x < this.width; x += 34 + rng() * 40) {
      const gather = smooth(0.38, 0.7, valueNoise(x / 320, index, seed));
      if (gather <= 0.02) continue;
      const y = line(x) - 8 - rng() * 16;
      const rx = 60 + rng() * 90;
      const ry = 10 + rng() * 9;
      this.lens(ctx, x, y + ry * 0.35, rx, ry, `rgba(206,214,224,${0.32 * gather * strength})`);
      this.lens(ctx, x - rx * 0.1, y - ry * 0.2, rx * 0.85, ry * 0.8, `rgba(250,249,244,${0.5 * gather * strength})`);
    }
    // Between the mountains, heaped cloud rises from the mist.
    if (index < 2) {
      for (let x = 200 + rng() * 300; x < this.width; x += 700 + rng() * 700) {
        this.cloud(ctx, rng, x, line(x) - 16, 200 + rng() * 160, 40 + rng() * 20, 0.9);
      }
    }
    return strip;
  }
}

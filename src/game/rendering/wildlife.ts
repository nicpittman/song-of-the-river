/**
 * The valley's other lives: creatures that take no part in its puzzles but
 * make a food chain visible. Hares graze the meadows; a fox comes out of the
 * wood to hunt them and a hawk circles overhead and stoops; ducks dabble on
 * the wide water and butterflies keep to the flowers; sheep and chickens
 * belong to the village; and in autumn, if the fish have run, a bear comes
 * down to the river to take its share.
 *
 * None of this touches the simulation. It is drawn from what the valley
 * already is (its meadows, woods, water and villages), so any board gets it.
 */

import { type Container, Sprite, type Texture } from 'pixi.js';
import { type Vec, dist, pointSegment } from '../core/math';
import { type Rng, mulberry32 } from '../core/rng';
import type { River } from '../world/river';
import { zoneAt } from '../world/terrain';
import { AUTUMN, type BoardDef, type PlaceDef, type Season, WINTER } from '../world/types';
import type { ArtLibrary } from './art';

/** An animal on the ground: a sprite with a few frames, somewhere to be, and somewhere to go. */
interface Critter {
  sprite: Sprite;
  frames: Texture[];
  baseScale: number;
  x: number;
  y: number;
  target: Vec | null;
  speed: number;
  /** Counts up while moving; drives the gait. */
  stride: number;
  /** Seconds until it next decides what to do. */
  idle: number;
  /** 0..1 visibility it is easing toward. */
  present: number;
}

interface Hare extends Critter {
  patch: Vec & { r: number };
  fleeing: boolean;
  /** Seconds until a taken hare is replaced by another. */
  gone: number;
}

interface Hunt {
  fox: Critter;
  prey: Hare;
  den: Vec;
  phase: 'stalk' | 'chase' | 'home';
  /** Seconds left of the chase before the fox gives up. */
  wind: number;
}

interface Hawk {
  sprite: Sprite;
  shadow: Sprite;
  frames: Texture[];
  centre: Vec;
  angle: number;
  /** 1 while soaring, falling to 0 at the bottom of a stoop. */
  height: number;
  stoop: { prey: Hare; t: number; takes: boolean } | null;
  timer: number;
}

interface Duck {
  sprite: Sprite;
  home: Vec;
  reach: number;
  phase: number;
  pace: number;
}

interface Butterfly {
  sprite: Sprite;
  home: Vec;
  phase: number;
  pace: number;
}

/** How much of each creature is about, by season. */
const DUCKS: Record<Season, number> = { 0: 1, 1: 1, 2: 1, 3: 0 };
const BUTTERFLIES: Record<Season, number> = { 0: 0.7, 1: 1, 2: 0.25, 3: 0 };
const HARES: Record<Season, number> = { 0: 1, 1: 1, 2: 1, 3: 0.5 };

export interface WildlifeLayers {
  water: Container;
  /** Depth-sorted with the scenery. */
  land: Container;
  /** On the ground, under everything that stands. */
  ground: Container;
  sky: Container;
}

export class Wildlife {
  private readonly rng: Rng;
  private readonly ducks: Duck[] = [];
  private readonly butterflies: Butterfly[] = [];
  private readonly hares: Hare[] = [];
  private readonly flock: Critter[] = [];
  private readonly hens: Critter[] = [];
  private hunt: Hunt | null = null;
  private huntTimer: number;
  private hawk: Hawk | null = null;
  private bear: Critter | null = null;
  private season: Season;
  private time = 0;
  reducedMotion = false;
  /**
   * Where a bear would fish this autumn: the water the fish have reached, or
   * null if no run has succeeded. Set by the view from the state of the wishes.
   */
  fishing: () => Vec | null = () => null;

  constructor(
    private readonly art: ArtLibrary,
    private readonly board: BoardDef,
    private readonly river: River,
    private readonly layers: WildlifeLayers,
    season: Season,
  ) {
    this.rng = mulberry32(board.seed ^ 0xf0c5);
    this.season = season;
    this.huntTimer = 18 + this.rng() * 20;
    this.buildDucks();
    this.buildButterflies();
    this.buildHares();
    this.buildHawk();
    this.buildFarmyard();
    this.buildPasture();
  }

  setSeason(season: Season): void {
    this.season = season;
  }

  // ── Making them ─────────────────────────────────────────────────────────

  /** Ground an animal can stand on: inside the valley, dry, and not sheer rock. */
  private open(p: Vec): boolean {
    const b = this.board;
    return p.x > 30 && p.y > 30 && p.x < b.width - 30 && p.y < b.height - 30 && this.river.edgeDistance(p) > 26 && !zoneAt(b, p);
  }

  /** The open, grassy parts of the valley: its meadows and terraces, and wherever flowers were scattered. */
  private grassland(): Array<Vec & { r: number }> {
    return [
      ...this.board.places.filter((p) => p.kind === 'meadow' || p.kind === 'terrace' || p.kind === 'orchard').map((p) => ({ x: p.x, y: p.y, r: p.radius })),
      ...this.board.scatter.filter((rule) => rule.assets.some(([id]) => id === 'wildflowers' || id === 'flower-meadow')).flatMap((rule) => rule.blobs),
    ];
  }

  private pointIn(patch: Vec & { r: number }, reach = 0.85): Vec | null {
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = this.rng() * 6.28;
      const d = Math.sqrt(this.rng()) * patch.r * reach;
      const p = { x: patch.x + Math.cos(angle) * d, y: patch.y + Math.sin(angle) * d * 0.6 };
      if (this.open(p)) return p;
    }
    return null;
  }

  /** A ground animal, if its art exists yet. Frames are drawn facing right. */
  private critter(prefix: string, at: Vec, size: number, speed: number): Critter | null {
    const ids = this.art.frames(prefix);
    if (!ids.length) return null;
    const art = this.art.get(ids[0]!);
    const sprite = new Sprite(art.texture);
    sprite.anchor.set(art.anchor[0], art.anchor[1]);
    sprite.width = art.width * size;
    sprite.height = art.height * size;
    sprite.alpha = 0;
    this.layers.land.addChild(sprite);
    return { sprite, frames: ids.map((id) => this.art.get(id).texture), baseScale: Math.abs(sprite.scale.x), x: at.x, y: at.y, target: null, speed, stride: 0, idle: this.rng() * 4, present: 1 };
  }

  private buildDucks(): void {
    const main = this.river.channels[0];
    if (!main) return;
    // Ducks gather where the river is widest: a pool, by its nature.
    let best = -1;
    main.line.points.forEach((p, i) => {
      if (p.y < 0 || p.y > this.board.height || p.x < 0 || p.x > this.board.width) return;
      if (best < 0 || main.widths[i]! > main.widths[best]!) best = i;
    });
    if (best < 0 || main.widths[best]! < 110) return;
    const pool = main.line.points[best]!;
    const reach = main.widths[best]! * 0.3;
    const art = this.art.get('duck');
    for (let i = 0; i < 5; i++) {
      const sprite = new Sprite(art.texture);
      sprite.anchor.set(0.5);
      sprite.width = art.width;
      sprite.height = art.height;
      sprite.alpha = 0;
      this.layers.water.addChild(sprite);
      const home = { x: pool.x + (this.rng() - 0.5) * reach, y: pool.y + (this.rng() - 0.5) * reach * 1.4 };
      this.ducks.push({ sprite, home, reach: 14 + this.rng() * 16, phase: this.rng() * 6.28, pace: 0.25 + this.rng() * 0.2 });
    }
  }

  private buildButterflies(): void {
    const flowers = this.grassland();
    if (!flowers.length) return;
    const art = this.art.get('butterfly');
    const tints = [0xffffff, 0xf7e38a, 0xbcd7f2, 0xf5b9c4];
    for (let i = 0; i < 14; i++) {
      const home = this.pointIn(flowers[Math.floor(this.rng() * flowers.length)]!);
      if (!home) continue;
      const sprite = new Sprite(art.texture);
      sprite.anchor.set(0.5);
      sprite.tint = tints[i % tints.length]!;
      sprite.alpha = 0;
      this.layers.sky.addChild(sprite);
      this.butterflies.push({ sprite, home, phase: this.rng() * 6.28, pace: 0.5 + this.rng() * 0.5 });
    }
  }

  private buildHares(): void {
    const grass = this.grassland();
    if (!grass.length) return;
    for (let i = 0; i < 7; i++) {
      const patch = grass[i % grass.length]!;
      const at = this.pointIn(patch);
      const critter = at && this.critter('hare', at, 1, 150);
      if (critter) this.hares.push({ ...critter, patch, fleeing: false, gone: 0 });
    }
  }

  private buildHawk(): void {
    const ids = this.art.frames('hawk');
    const grass = this.grassland();
    if (!ids.length || !this.hares.length || !grass.length) return;
    const art = this.art.get(ids[0]!);
    const sprite = new Sprite(art.texture);
    sprite.anchor.set(0.5);
    sprite.width = art.width;
    sprite.height = art.height;
    const shadow = new Sprite(this.art.get('shadow').texture);
    shadow.anchor.set(0.5);
    shadow.alpha = 0.22;
    this.layers.ground.addChild(shadow);
    this.layers.sky.addChild(sprite);
    const centre = grass.reduce((a, b) => (b.r > a.r ? b : a));
    this.hawk = { sprite, shadow, frames: ids.map((id) => this.art.get(id).texture), centre: { x: centre.x, y: centre.y }, angle: this.rng() * 6.28, height: 1, stoop: null, timer: 30 + this.rng() * 30 };
  }

  /** Where grazing animals may wander: off lanes and building footprints (set up with the farmyard). */
  private grazeable: (p: Vec) => boolean = () => true;

  /** Sheep on the green beside the first village, hens in its yard. */
  private buildFarmyard(): void {
    const village = this.board.places.find((p) => p.kind === 'village');
    if (!village) return;
    // Animals keep off porches and doorsteps, and off the worn lanes between them.
    const buildingIds = new Set(['cottage', 'timber-cottage', 'farmhouse', 'watermill', 'shed', 'shrine', 'dock', 'stilt-hut']);
    const buildings = this.board.sprites.filter((s) => buildingIds.has(s.asset));
    const offLanes = (p: Vec): boolean =>
      this.board.lanes.every((lane) => {
        const reach = (lane.width ?? 44) / 2 + 10;
        return lane.points.every((a, i) => i === 0 || pointSegment(p, lane.points[i - 1]!, a).d > reach);
      });
    // A building's footprint runs out to either side of its anchor and back up the slope behind it; keep clear of it and its doorstep.
    const offBuildings = (p: Vec): boolean =>
      buildings.every((b) => {
        const k = b.scale ?? 1;
        return Math.abs(p.x - b.x) > 110 * k + 24 || p.y < b.y - 130 * k || p.y > b.y + 40;
      });
    const yardClear = (p: Vec): boolean => offLanes(p) && offBuildings(p);
    this.grazeable = yardClear;
    // A point in `patch` that is open ground and clear of the yard, or null after a few tries.
    const spotIn = (patch: Vec & { r: number }): Vec | null => {
      for (let attempt = 0; attempt < 6; attempt++) {
        const at = this.pointIn(patch, 1);
        if (at && yardClear(at)) return at;
      }
      return null;
    };
    // The green: the first clear spot found walking round the edge of the village.
    let green: (Vec & { r: number }) | null = null;
    for (let i = 0; i < 16 && !green; i++) {
      const a = (i / 16) * 6.28 + 0.6;
      const p = { x: village.x + Math.cos(a) * (village.radius + 90), y: village.y + Math.sin(a) * (village.radius + 90) * 0.7 };
      const clear = this.open(p) && yardClear(p) && !this.board.places.some((place) => place !== village && dist(p, place) < place.radius + 60);
      if (clear) green = { ...p, r: 70 };
    }
    for (let i = 0; green && i < 5; i++) {
      const at = spotIn(green);
      const sheep = at && this.critter('sheep', at, 1, 16);
      if (sheep) this.flock.push(sheep);
    }
    for (let i = 0; i < 4; i++) {
      const at = spotIn({ x: village.x, y: village.y + village.radius * 0.3, r: village.radius * 0.5 });
      const hen = at && this.art.known('chicken') ? this.single('chicken', at) : null;
      if (hen) this.hens.push(hen);
    }
  }

  /** Sheep a board places by hand (on a hill pasture, say) graze and wander like the village flock. */
  private buildPasture(): void {
    for (const s of this.board.sprites) {
      if (!/^sheep-\d$/.test(s.asset)) continue;
      const sheep = this.critter('sheep', s, s.scale ?? 1, 16);
      if (!sheep) continue;
      if (s.flip) sheep.sprite.scale.x = -sheep.baseScale;
      this.flock.push(sheep);
    }
  }

  /** A ground animal with a single image. */
  private single(id: string, at: Vec): Critter {
    const art = this.art.get(id);
    const sprite = new Sprite(art.texture);
    sprite.anchor.set(art.anchor[0], art.anchor[1]);
    sprite.width = art.width;
    sprite.height = art.height;
    sprite.alpha = 0;
    this.layers.land.addChild(sprite);
    return { sprite, frames: [art.texture], baseScale: Math.abs(sprite.scale.x), x: at.x, y: at.y, target: null, speed: 22, stride: 0, idle: this.rng() * 3, present: 1 };
  }

  // ── Moving them ─────────────────────────────────────────────────────────

  /** Steps a ground animal toward its target and draws it. Returns true when it has arrived (or has nowhere to go). */
  private step(c: Critter, dt: number, gait: number): boolean {
    let arrived = true;
    if (c.target) {
      const d = dist(c, c.target);
      const move = c.speed * dt;
      if (d > move) {
        c.x += ((c.target.x - c.x) / d) * move;
        c.y += ((c.target.y - c.y) / d) * move;
        c.stride += dt * gait;
        arrived = false;
        // Painted facing right: mirror to face the way it is going.
        if (Math.abs(c.target.x - c.x) > 2) c.sprite.scale.x = c.baseScale * (c.target.x < c.x ? -1 : 1);
      } else {
        c.x = c.target.x;
        c.y = c.target.y;
        c.target = null;
      }
    }
    const moving = !arrived;
    c.sprite.texture = c.frames[moving ? Math.floor(c.stride) % c.frames.length : 0]!;
    c.sprite.position.set(c.x, c.y - (moving ? Math.abs(Math.sin(c.stride * Math.PI)) * 3 : 0));
    c.sprite.zIndex = c.y;
    c.sprite.alpha += (c.present - c.sprite.alpha) * Math.min(1, dt * 2.5);
    return arrived;
  }

  private startle(hare: Hare, from: Vec): void {
    if (hare.fleeing || hare.gone > 0) return;
    const d = Math.max(1, dist(hare, from));
    // Bolt directly away; if that way is water or rock, anywhere else in the meadow will do.
    const away = { x: hare.x + ((hare.x - from.x) / d) * 230, y: hare.y + ((hare.y - from.y) / d) * 150 };
    hare.target = this.open(away) ? away : this.pointIn(hare.patch);
    hare.fleeing = true;
    hare.speed = 165;
  }

  private updateHares(dt: number): void {
    const abroad = HARES[this.season];
    this.hares.forEach((hare, i) => {
      if (hare.gone > 0) {
        hare.gone -= dt;
        hare.present = 0;
        if (hare.gone <= 0) {
          const at = this.pointIn(hare.patch);
          if (at) Object.assign(hare, at);
          hare.present = 1;
        }
      } else {
        hare.present = i / this.hares.length < abroad ? 1 : 0;
      }
      const arrived = this.step(hare, dt, hare.fleeing ? 9 : 5);
      if (!arrived) return;
      hare.fleeing = false;
      hare.speed = 60;
      hare.idle -= dt;
      if (hare.idle > 0) return;
      // A few hops to a fresh patch of grass, then graze again.
      hare.idle = 3 + this.rng() * 7;
      const near = { x: hare.x + (this.rng() - 0.5) * 90, y: hare.y + (this.rng() - 0.5) * 60 };
      if (this.open(near) && dist(near, hare.patch) < hare.patch.r) hare.target = near;
    });
  }

  /** A fox comes out of the nearest wood after a hare. Mostly the hare gets away. */
  private startHunt(): void {
    const prey = this.hares.filter((h) => h.gone <= 0 && h.present > 0 && !h.fleeing);
    const woods = this.board.places.filter((p) => p.kind === 'forest');
    if (!prey.length || !woods.length) return;
    const hare = prey[Math.floor(this.rng() * prey.length)]!;
    const wood = woods.reduce((a, b) => (dist(b, hare) < dist(a, hare) ? b : a));
    const d = Math.max(1, dist(wood, hare));
    const den = { x: wood.x + ((hare.x - wood.x) / d) * wood.radius * 0.9, y: wood.y + ((hare.y - wood.y) / d) * wood.radius * 0.9 };
    // The way to the hare must be dry land.
    for (let t = 0; t <= 1; t += 0.125) {
      if (this.river.edgeDistance({ x: den.x + (hare.x - den.x) * t, y: den.y + (hare.y - den.y) * t }) < 22) return;
    }
    const fox = this.critter('fox-run', den, 1, 46) ?? (this.art.has('fox') ? this.single('fox', den) : null);
    if (!fox) return;
    if (fox.frames.length === 1) {
      // The illustrated fox stands facing left and is drawn large; bring it to scale and mirror it.
      fox.sprite.scale.set(fox.sprite.scale.x * 0.6, fox.sprite.scale.y * 0.6);
      fox.baseScale = -Math.abs(fox.sprite.scale.x);
    }
    this.hunt = { fox, prey: hare, den, phase: 'stalk', wind: 3.4 };
  }

  private updateHunt(dt: number): void {
    const hunt = this.hunt;
    if (!hunt) {
      this.huntTimer -= dt;
      if (this.huntTimer <= 0) {
        this.huntTimer = 40 + this.rng() * 40;
        this.startHunt();
      }
      return;
    }
    const { fox, prey } = hunt;
    const gap = dist(fox, prey);
    if (hunt.phase === 'stalk') {
      fox.speed = 46;
      fox.target = { x: prey.x, y: prey.y };
      if (gap < 150) {
        hunt.phase = 'chase';
        this.startle(prey, fox);
      }
    } else if (hunt.phase === 'chase') {
      fox.speed = 150;
      fox.target = { x: prey.x, y: prey.y };
      hunt.wind -= dt;
      if (gap < 16) {
        // Taken. Another hare will come to the meadow in time.
        prey.gone = 30 + this.rng() * 20;
        prey.fleeing = false;
        prey.target = null;
        hunt.phase = 'home';
      } else if (hunt.wind <= 0 || !this.open(fox)) {
        hunt.phase = 'home';
      }
    } else {
      fox.speed = 70;
      fox.target = hunt.den;
      fox.present = dist(fox, hunt.den) < 60 ? 0 : 1;
      if (dist(fox, hunt.den) < 6 && fox.sprite.alpha < 0.05) {
        fox.sprite.destroy();
        this.hunt = null;
        return;
      }
    }
    this.step(fox, dt, hunt.phase === 'chase' ? 10 : 6);
  }

  private updateHawk(dt: number): void {
    const hawk = this.hawk;
    if (!hawk) return;
    const circling = { x: hawk.centre.x + Math.cos(hawk.angle) * 190, y: hawk.centre.y + Math.sin(hawk.angle) * 110 };
    let ground = circling;
    if (hawk.stoop) {
      const s = hawk.stoop;
      s.t += dt / 2.4;
      // Down in the first half, up again in the second.
      const dive = Math.sin(Math.min(1, s.t) * Math.PI);
      hawk.height = 1 - dive;
      ground = { x: circling.x + (s.prey.x - circling.x) * dive, y: circling.y + (s.prey.y - circling.y) * dive };
      if (dive > 0.55) this.startle(s.prey, ground);
      if (s.takes && dive > 0.97 && s.prey.gone <= 0) {
        s.prey.gone = 30 + this.rng() * 20;
        s.prey.fleeing = false;
        s.prey.target = null;
      }
      if (s.t >= 1) hawk.stoop = null;
    } else {
      hawk.angle += dt * 0.28;
      hawk.height = 1;
      hawk.timer -= dt;
      const prey = this.hares.filter((h) => h.gone <= 0 && h.present > 0);
      if (hawk.timer <= 0 && prey.length && this.season !== WINTER) {
        hawk.timer = 45 + this.rng() * 45;
        const hare = prey.reduce((a, b) => (dist(b, circling) < dist(a, circling) ? b : a));
        if (dist(hare, circling) < 420) hawk.stoop = { prey: hare, t: 0, takes: this.rng() < 0.3 };
      }
    }
    const lift = 70 * hawk.height;
    hawk.sprite.position.set(ground.x, ground.y - lift);
    hawk.sprite.rotation = hawk.stoop ? Math.atan2(hawk.stoop.prey.y - circling.y, hawk.stoop.prey.x - circling.x) : hawk.angle + Math.PI / 2;
    hawk.sprite.texture = hawk.frames[Math.floor(this.time * 0.7) % hawk.frames.length]!;
    hawk.shadow.position.set(ground.x + 14, ground.y + 8);
    hawk.shadow.width = 40 - 14 * hawk.height;
    hawk.shadow.height = hawk.shadow.width * 0.5;
    hawk.shadow.alpha = 0.16 + 0.16 * (1 - hawk.height);
  }

  /** In autumn a bear stands in the shallows where the fish have come, and now and then lifts one out. */
  private updateBear(dt: number): void {
    const where = this.season === AUTUMN ? this.fishing() : null;
    if (!where) {
      if (this.bear) {
        this.bear.present = 0;
        this.step(this.bear, dt, 0);
        if (this.bear.sprite.alpha < 0.03) {
          this.bear.sprite.destroy();
          this.bear = null;
        }
      }
      return;
    }
    if (!this.bear) {
      const hit = this.river.nearest(where);
      const flow = hit.channel.line.at(hit.along).angle;
      // Just inside the bank, on the near side.
      const at = { x: hit.point.x - Math.sin(flow) * hit.half * 0.75, y: hit.point.y + Math.cos(flow) * hit.half * 0.75 };
      this.bear = this.critter('bear', at, 1, 0);
      if (!this.bear) return;
    }
    const bear = this.bear;
    bear.present = 1;
    bear.idle -= dt;
    if (bear.idle <= 0) bear.idle = 9 + this.rng() * 6;
    this.step(bear, dt, 0);
    // The last two seconds of each wait, it has a fish.
    bear.sprite.texture = bear.frames[bear.idle < 2 ? bear.frames.length - 1 : 0]!;
  }

  private graze(herd: Critter[], dt: number, reach: number, abroad: number): void {
    for (const animal of herd) {
      animal.present = abroad;
      const arrived = this.step(animal, dt, 3);
      if (!arrived) continue;
      animal.idle -= dt;
      // Standing: head down to graze most of the time, up now and then.
      if (animal.frames.length > 1) animal.sprite.texture = animal.frames[animal.idle < 1.2 ? 1 : 0]!;
      if (animal.idle > 0) continue;
      animal.idle = 4 + this.rng() * 8;
      const near = { x: animal.x + (this.rng() - 0.5) * reach, y: animal.y + (this.rng() - 0.5) * reach * 0.6 };
      if (this.open(near) && this.grazeable(near) && !this.board.places.some((p: PlaceDef) => p.kind === 'forest' && dist(near, p) < p.radius)) animal.target = near;
    }
  }

  update(dt: number, paused: boolean): void {
    if (paused) return;
    this.time += dt;
    const t = this.time;
    const still = this.reducedMotion;

    const ducks = DUCKS[this.season];
    for (const duck of this.ducks) {
      const a = still ? duck.phase : t * duck.pace + duck.phase;
      duck.sprite.position.set(duck.home.x + Math.cos(a) * duck.reach, duck.home.y + Math.sin(a * 1.3) * duck.reach * 0.6);
      // Face the way it is paddling.
      duck.sprite.rotation = Math.atan2(Math.cos(a * 1.3) * 0.78, -Math.sin(a));
      duck.sprite.alpha += (ducks - duck.sprite.alpha) * Math.min(1, dt * 0.8);
    }

    const abroad = still ? 0 : BUTTERFLIES[this.season];
    this.butterflies.forEach((b, i) => {
      const a = t * b.pace + b.phase;
      b.sprite.position.set(b.home.x + Math.sin(a) * 46 + Math.sin(a * 2.7) * 14, b.home.y - 16 + Math.cos(a * 1.4) * 22 + Math.sin(a * 3.1) * 8);
      // Wings open and close: the sprite narrows and widens.
      b.sprite.width = 11 * (0.25 + 0.75 * Math.abs(Math.sin(t * 13 + b.phase)));
      b.sprite.height = 9;
      b.sprite.rotation = Math.sin(a * 2.2) * 0.5;
      // In the thinner seasons only some of them are about.
      const present = i / this.butterflies.length < abroad ? 0.95 : 0;
      b.sprite.alpha += (present - b.sprite.alpha) * Math.min(1, dt * 0.8);
    });

    if (still) return;
    this.updateHares(dt);
    this.updateHunt(dt);
    this.updateHawk(dt);
    this.updateBear(dt);
    this.graze(this.flock, dt, 70, this.season === WINTER ? 0 : 1);
    this.graze(this.hens, dt, 36, 1);
  }
}

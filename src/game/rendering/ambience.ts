import { flockOffset } from './flockPose';
/**
 * Small life that makes the valley feel inhabited when nothing is being
 * asked of it: mist lying along the river, petals, leaves and snow on the air,
 * koi holding in the current, a flock crossing overhead, lamps in the village
 * when the days shorten. None of it affects the simulation.
 */

import { Container, Graphics, Sprite } from 'pixi.js';
import { mulberry32, type Rng } from '../core/rng';
import type { River } from '../world/river';
import { AUTUMN, type BoardDef, SPRING, type Season, WINTER } from '../world/types';
import type { ArtLibrary } from './art';
import { FireLayers } from './fireLayers';

/** Mist along the river: a breath of it, never a white veil over the whole valley. */
const MIST: Record<Season, number> = { 0: 0.07, 1: 0.025, 2: 0.09, 3: 0.1 };
const MOTES: Record<Season, { count: number; art: string[]; fall: number; drift: number; size: number }> = {
  0: { count: 30, art: ['petal'], fall: 26, drift: 34, size: 0.9 },
  1: { count: 0, art: ['petal'], fall: 0, drift: 0, size: 1 },
  2: { count: 34, art: ['leaf', 'leaf-red'], fall: 38, drift: 46, size: 1 },
  3: { count: 80, art: ['flake'], fall: 44, drift: 14, size: 0.55 },
};
const LAMPS: Record<Season, number> = { 0: 0, 1: 0, 2: 0.55, 3: 1 };
/** Chimney smoke, in puffs per second per hearth: a thread in summer, a steady plume in winter. */
const SMOKE: Record<Season, number> = { 0: 0.3, 1: 0.12, 2: 0.6, 3: 1.1 };
const HOMES = new Set(['cottage', 'farmhouse', 'timber-cottage']);

interface Puff {
  sprite: Sprite;
  age: number;
  life: number;
  drift: number;
}

interface Mote {
  sprite: Sprite;
  x: number;
  y: number;
  speed: number;
  sway: number;
  phase: number;
  season: Season;
}

interface Fish {
  sprite: Sprite;
  channel: number;
  along: number;
  lane: number;
  speed: number;
  phase: number;
  /** Size relative to the art. */
  size: number;
  /** Seconds into a leap, or negative while swimming; and seconds until the next. */
  leap: number;
  nextLeap: number;
}

/** Seconds a salmon is out of the water when it leaps. */
const LEAP = 0.9;

interface Bird {
  sprite: Sprite;
  offsetX: number;
  offsetY: number;
  phase: number;
}

export class Ambience {
  private readonly rng: Rng;
  private readonly mist: Array<{ sprite: Sprite; baseX: number; phase: number; weight: number }> = [];
  private readonly motes: Mote[] = [];
  private readonly fish: Fish[] = [];
  /** Rings and drops where salmon leap, redrawn each frame. */
  private readonly rings = new Graphics();
  private readonly splashes: Array<{ x: number; y: number; k: number; kind: number }> = [];
  private readonly lamps: Sprite[] = [];
  private readonly pools: Sprite[] = [];
  private readonly flames: Sprite[] = [];
  /** Illustrated fires at the hearths and bonfires (see fireLayers.ts). */
  private readonly fires: FireLayers[] = [];
  private readonly chimneys: Array<{ x: number; y: number; debt: number; strength: number }> = [];
  private readonly puffs: Puff[] = [];
  private readonly flock = new Container();
  private readonly birds: Bird[] = [];
  private flockTimer = 18;
  private flockVelocity = { x: 0, y: 0 };
  private flockHeading = 0;
  private flying = false;
  private season: Season;
  private mistLevel: number;
  private lampLevel: number;
  private time = 0;
  reducedMotion = false;

  constructor(
    private readonly art: ArtLibrary,
    private readonly board: BoardDef,
    private readonly river: River,
    /**
     * `sorted` is the depth-sorted scenery (children ordered by zIndex = ground y).
     * Light that belongs to a place on the ground goes there, so a building in front hides it.
     */
    private readonly layers: { ground: Container; water: Container; sky: Container; lights: Container; weather: Container; sorted?: Container },
    season: Season,
  ) {
    this.rng = mulberry32(board.seed ^ 0x51ed);
    this.season = season;
    this.mistLevel = MIST[season];
    this.lampLevel = LAMPS[season];
    this.buildMist();
    this.layers.water.addChild(this.rings);
    this.buildFish();
    this.buildLamps();
    this.buildFlock();
  }

  setSeason(season: Season): void {
    this.season = season;
  }

  private buildMist(): void {
    const texture = this.art.get('mist').texture;
    const main = this.river.channels[0]!;
    for (let i = 0; i < 16; i++) {
      const p = main.line.at(this.rng() * main.line.length);
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      const size = 320 + this.rng() * 420;
      sprite.width = size * 1.7;
      sprite.height = size * 0.62;
      sprite.position.set(p.x + (this.rng() - 0.5) * 260, p.y + (this.rng() - 0.5) * 120);
      sprite.alpha = 0;
      this.layers.sky.addChild(sprite);
      this.mist.push({ sprite, baseX: sprite.x, phase: this.rng() * 6.28, weight: 0.5 + this.rng() * 0.5 });
    }
  }

  private buildFish(): void {
    for (let i = 0; i < 9; i++) {
      const channel = 0;
      const line = this.river.channels[channel]!.line;
      // The illustrated salmon where the library has it, seen through the water; painted fish otherwise.
      const salmon = this.art.has('salmon');
      const art = this.art.get(salmon ? 'salmon' : i % 3 === 0 ? 'fish-pale' : 'fish');
      const sprite = new Sprite(art.texture);
      sprite.anchor.set(0.5);
      const size = (salmon ? 0.62 : 0.75) + this.rng() * 0.3;
      sprite.width = art.width * size;
      sprite.height = art.height * size;
      sprite.alpha = 0.62;
      this.layers.water.addChild(sprite);
      this.fish.push({ sprite, channel, along: line.length * (0.36 + this.rng() * 0.5), lane: (this.rng() - 0.5) * 0.9, speed: 16 + this.rng() * 14, phase: this.rng() * 6.28, size, leap: -1, nextLeap: 4 + this.rng() * 14 });
    }
  }

  /**
   * Lantern light, the warm pool each lit home throws on the ground in front of
   * it, chimneys, and the village fire. Homes get no glow on their walls: the
   * illustrations do not say where their windows are, and a glow in the wrong
   * place reads as a fire inside the building. The light on the snow in front
   * of the doorways carries the warmth instead.
   */
  private buildLamps(): void {
    const glow = this.art.get('lamp').texture;
    const warmth = this.art.get('warmth').texture;
    const sorted = this.layers.sorted ?? this.layers.lights;
    const addLamp = (x: number, y: number, size: number, groundY: number): void => {
      const lamp = new Sprite(glow);
      lamp.anchor.set(0.5);
      lamp.width = lamp.height = size;
      lamp.position.set(x, y);
      lamp.blendMode = 'add';
      lamp.alpha = 0;
      // Just in front of the lantern it belongs to, and behind anything standing nearer.
      lamp.zIndex = groundY + 0.5;
      sorted.addChild(lamp);
      this.lamps.push(lamp);
    };
    const addPool = (x: number, y: number, width: number): void => {
      const pool = new Sprite(warmth);
      pool.anchor.set(0.5);
      pool.width = width;
      pool.height = width * 0.5;
      pool.position.set(x, y);
      pool.alpha = 0;
      this.layers.ground.addChild(pool);
      this.pools.push(pool);
    };
    for (const sprite of this.board.sprites) {
      const art = this.art.get(sprite.asset);
      const scale = sprite.scale ?? 1;
      const facing = sprite.flip ? -1 : 1;
      if (HOMES.has(sprite.asset)) {
        // Light spilling from the open front onto the ground, which lies below the sprite's foot line.
        addPool(sprite.x + facing * art.width * scale * 0.08, sprite.y + 18 * scale, art.width * scale * 0.95);
        this.chimneys.push({ x: sprite.x - facing * art.width * scale * 0.08, y: sprite.y - art.height * scale * 0.82, debt: this.rng(), strength: 1 });
      } else if (sprite.asset === 'lantern') {
        addLamp(sprite.x, sprite.y - art.height * scale * 0.62, 40, sprite.y);
        addPool(sprite.x, sprite.y + 4, 110);
      }
    }
    // Every hearth and bonfire burns with the layered fire where the art has it (one per spot).
    const layered = FireLayers.available(this.art);
    const fires = [...this.board.hearths];
    if (layered) for (const s of this.board.sprites) if (s.asset === 'bonfire' && !fires.some((h) => Math.hypot(h.x - s.x, h.y - s.y) < 60)) fires.push({ x: s.x, y: s.y });
    for (const hearth of fires) {
      const isHearth = this.board.hearths.includes(hearth);
      if (isHearth) {
        addPool(hearth.x, hearth.y + 6, 300);
        this.chimneys.push({ x: hearth.x, y: hearth.y - 22, debt: 0, strength: 1.6 });
      }
      if (layered) {
        this.fires.push(new FireLayers(this.art, sorted, this.layers.lights, hearth.x, hearth.y + 4));
        addLamp(hearth.x, hearth.y - 12, 90, hearth.y);
        continue;
      }
      if (!isHearth) continue;
      const illustrated = this.art.has('bonfire');
      const base = this.art.get(illustrated ? 'bonfire' : 'firepit');
      const pit = new Sprite(base.texture);
      pit.anchor.set(illustrated ? base.anchor[0] : 0.5, illustrated ? base.anchor[1] : 0.5);
      pit.width = base.width;
      pit.height = base.height;
      pit.position.set(hearth.x, hearth.y + (illustrated ? 9 : 0));
      pit.zIndex = hearth.y;
      sorted.addChild(pit);
      // A soft glow over the fire, sorted with it so buildings in front hide it.
      addLamp(hearth.x, hearth.y - 12, 90, hearth.y);
      if (illustrated) continue;
      const tongue = this.art.get('flame');
      for (let i = 0; i < 3; i++) {
        const flame = new Sprite(tongue.texture);
        flame.anchor.set(tongue.anchor[0], tongue.anchor[1]);
        flame.position.set(hearth.x + (i - 1) * 5, hearth.y + 1 - Math.abs(i - 1));
        flame.alpha = 0;
        // Depth-sorted at the hearth, so a cottage standing in front hides the fire.
        flame.zIndex = hearth.y + 0.6;
        sorted.addChild(flame);
        this.flames.push(flame);
      }
    }
  }

  /** Smoke rises, spreads and thins; the wind leans it down the valley. */
  private updateSmoke(dt: number, still: boolean): void {
    const rate = still ? 0 : SMOKE[this.season];
    for (const chimney of this.chimneys) {
      chimney.debt += rate * chimney.strength * dt;
      if (chimney.debt < 1 || this.puffs.length > 70) continue;
      chimney.debt -= 1;
      const sprite = new Sprite(this.art.get('smoke').texture);
      sprite.anchor.set(0.5);
      sprite.position.set(chimney.x + (this.rng() - 0.5) * 4, chimney.y);
      sprite.alpha = 0;
      // Against snow, white smoke would vanish; winter smoke is a soft blue-grey.
      sprite.tint = this.season === WINTER ? 0x9aa3b4 : 0xf2efe8;
      this.layers.sky.addChild(sprite);
      this.puffs.push({ sprite, age: 0, life: 5.5 + this.rng() * 3, drift: 5 + this.rng() * 9 });
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const puff = this.puffs[i]!;
      puff.age += dt;
      const t = puff.age / puff.life;
      if (t >= 1) {
        puff.sprite.destroy();
        this.puffs.splice(i, 1);
        continue;
      }
      puff.sprite.x += puff.drift * (0.4 + t) * dt;
      puff.sprite.y -= (20 - 9 * t) * dt;
      puff.sprite.width = puff.sprite.height = 16 + 70 * t;
      puff.sprite.alpha = 0.62 * Math.min(1, t * 6) * (1 - t) ** 1.3;
    }
  }

  private buildFlock(): void {
    const up = this.art.get('bird-up');
    for (let i = 0; i < 9; i++) {
      const sprite = new Sprite(up.texture);
      sprite.anchor.set(0.5);
      sprite.width = up.width * 0.9;
      sprite.height = up.height * 0.9;
      this.flock.addChild(sprite);
      // A loose chevron behind the leader.
      const row = Math.ceil(i / 2);
      const wing = i % 2 === 0 ? 1 : -1;
      this.birds.push({ sprite, offsetX: wing * row * 26 + (this.rng() - 0.5) * 8, offsetY: row * 22 + (this.rng() - 0.5) * 8, phase: this.rng() * 6.28 });
    }
    this.flock.visible = false;
    this.layers.sky.addChild(this.flock);
  }

  /** Sends a flock across the valley. Autumn flocks are larger and head for the river mouth. */
  private launchFlock(): void {
    const autumn = this.season === AUTUMN;
    const count = autumn ? 9 : 3 + Math.floor(this.rng() * 3);
    this.birds.forEach((bird, i) => (bird.sprite.visible = i < count));
    const fromLeft = this.rng() < 0.5;
    const startX = fromLeft ? -300 : this.board.width + 300;
    const startY = autumn ? -200 : this.rng() * this.board.height * 0.7;
    const targetX = fromLeft ? this.board.width + 400 : -400;
    const targetY = autumn ? this.board.height + 500 : startY + (this.rng() - 0.3) * 900;
    const distance = Math.hypot(targetX - startX, targetY - startY);
    const speed = 85 + this.rng() * 55;
    this.flockVelocity = { x: ((targetX - startX) / distance) * speed, y: ((targetY - startY) / distance) * speed };
    this.flock.position.set(startX, startY);
    this.flockHeading = Math.atan2(this.flockVelocity.y, this.flockVelocity.x);
    this.flock.rotation = 0;
    this.flock.visible = true;
    this.flying = true;
  }

  update(dt: number, screen: { width: number; height: number }, paused: boolean): void {
    this.time += dt;
    const still = this.reducedMotion;

    // Mist breathes in and out with the season.
    this.mistLevel += (MIST[this.season] - this.mistLevel) * Math.min(1, dt * 0.25);
    for (const puff of this.mist) {
      puff.sprite.x = puff.baseX + (still ? 0 : Math.sin(this.time * 0.05 + puff.phase) * 90);
      puff.sprite.alpha = this.mistLevel * puff.weight * (0.75 + 0.25 * Math.sin(this.time * 0.11 + puff.phase * 2));
    }

    this.lampLevel += (LAMPS[this.season] - this.lampLevel) * Math.min(1, dt * 0.3);
    this.lamps.forEach((lamp, i) => (lamp.alpha = this.lampLevel * (0.85 + 0.15 * Math.sin(this.time * 3.1 + i * 2.3))));
    for (const pool of this.pools) pool.alpha = this.lampLevel * 0.55;
    // A modest cooking fire in the warm months, built up as the evenings cool.
    const fire = 0.22 + this.lampLevel * 0.78;
    for (const f of this.fires) f.update(this.time, paused ? 0 : dt, this.lampLevel, still);
    this.flames.forEach((flame, i) => {
      const flicker = 0.7 + 0.3 * Math.sin(this.time * (9 + i * 3.7) + i * 1.9) * Math.sin(this.time * 5.3 + i);
      flame.alpha = fire * (0.75 + 0.25 * flicker);
      flame.width = ((i % 3 === 1 ? 9 : 7) + 2 * flicker) * (0.75 + fire * 0.25);
      flame.height = ((i % 3 === 1 ? 20 : 14) + 6 * flicker) * (0.5 + fire * 0.5) * (still ? 1 : 1 + 0.12 * Math.sin(this.time * 13 + i * 2));
    });
    this.updateSmoke(dt, still);

    if (!paused) this.updateFish(dt);
    if (!paused) this.updateFlock(dt, still);
    this.updateMotes(dt, screen, still);
  }

  private updateFish(dt: number): void {
    // Spring is the run upstream; the rest of the year fish idle and drift.
    const upstream = this.season === SPRING ? 1 : this.season === WINTER ? 0.1 : 0.3;
    for (const fish of this.fish) {
      const channel = this.river.channels[fish.channel]!;
      const line = channel.line;
      fish.along -= fish.speed * upstream * dt;
      // Fish cannot climb the gorge rapids: they turn back to the lower river.
      if (fish.along < line.length * 0.36) fish.along = line.length * 0.86;
      const p = line.at(fish.along);
      const hit = line.nearest(p);
      const half = channel.widths[hit.segment]! / 2;
      const weave = Math.sin(this.time * 1.3 + fish.phase) * 0.18;
      const lateral = (fish.lane + weave) * half * 0.6;
      const x = p.x - Math.sin(p.angle) * lateral;
      const y = p.y + Math.cos(p.angle) * lateral;
      const heading = p.angle + Math.PI + Math.cos(this.time * 1.3 + fish.phase) * 0.2;
      const visible = y < this.board.height + 150;
      // Now and then, mostly in the spring run, a salmon leaps clear in an arc and falls back in rings.
      fish.nextLeap -= dt * (this.season === SPRING ? 1 : 0.25);
      if (fish.leap < 0 && fish.nextLeap <= 0 && visible && !this.reducedMotion) {
        fish.leap = 0;
        fish.nextLeap = 9 + this.rng() * 16;
      }
      const s = fish.sprite;
      if (fish.leap >= 0) {
        fish.leap += dt;
        const k = fish.leap / LEAP;
        const arc = Math.sin(Math.PI * Math.min(1, k));
        s.position.set(x + Math.cos(heading) * 26 * k, y + Math.sin(heading) * 26 * k - arc * 22);
        s.rotation = heading - (0.5 - k) * 1.4 * Math.sign(Math.cos(heading) || 1);
        s.tint = 0xffffff;
        s.alpha = 0.95;
        s.scale.y = Math.abs(s.scale.x) * (0.9 + 0.1 * arc);
        if (k <= 1) this.splash(x, y, k, 0);
        if (k > 0.85) this.splash(x + Math.cos(heading) * 26, y + Math.sin(heading) * 26, k - 0.85, 1);
        if (k > 1.6) fish.leap = -1;
        if (k > 1) s.alpha = 0;
        continue;
      }
      // Under the water: tinted by it, foreshortened, the tail working as it swims.
      s.position.set(x, y);
      s.rotation = heading;
      s.tint = 0x9fc6c4;
      s.scale.y = Math.abs(s.scale.x) * 0.7;
      s.skew.y = this.reducedMotion ? 0 : Math.sin(this.time * 7 + fish.phase) * 0.07;
      s.alpha += ((visible ? 0.55 : 0) - s.alpha) * Math.min(1, dt * 2);
    }
    this.drawSplashes();
  }

  /** Rings and drops where a salmon broke the surface (`k` 0..1 through the moment). */
  private splash(x: number, y: number, k: number, kind: number): void {
    if (this.splashes.length < 24) this.splashes.push({ x, y, k, kind });
  }

  private drawSplashes(): void {
    const g = this.rings;
    g.clear();
    for (const sp of this.splashes) {
      const p = Math.min(1, sp.k * 1.4);
      g.ellipse(sp.x, sp.y, 3 + p * 14, 1.2 + p * 4.5).stroke({ color: 0xeef7f5, width: 1, alpha: (1 - p) * 0.7 });
      if (sp.kind === 1 && p < 0.6) for (let i = -1; i <= 1; i++) g.circle(sp.x + i * 4, sp.y - Math.sin(p * Math.PI) * 9 - Math.abs(i) * 2, 1.1).fill({ color: 0xf2f8f6, alpha: 0.8 * (1 - p) });
    }
    this.splashes.length = 0;
  }

  private updateFlock(dt: number, still: boolean): void {
    if (!this.flying) {
      this.flockTimer -= dt;
      if (this.flockTimer <= 0 && !still) {
        this.launchFlock();
        this.flockTimer = this.season === AUTUMN ? 38 + this.rng() * 32 : 45 + this.rng() * 45;
      }
      return;
    }
    this.flock.x += this.flockVelocity.x * dt;
    this.flock.y += this.flockVelocity.y * dt;
    const up = this.art.get('bird-up').texture;
    const down = this.art.get('bird-down').texture;
    for (const bird of this.birds) {
      const beat = Math.sin(this.time * 9 + bird.phase);
      bird.sprite.texture = beat > 0 ? up : down;
      const p=flockOffset({x:bird.offsetX,y:bird.offsetY},this.flockHeading);
      bird.sprite.position.set(p.x,p.y+beat*2);
      bird.sprite.rotation=0;
    }
    const margin = 700;
    if (this.flock.x < -margin || this.flock.x > this.board.width + margin || this.flock.y > this.board.height + margin || this.flock.y < -margin * 1.5) {
      this.flying = false;
      this.flock.visible = false;
    }
  }

  private updateMotes(dt: number, screen: { width: number; height: number }, still: boolean): void {
    const want = still ? 0 : MOTES[this.season].count;
    while (this.motes.length < want) {
      const spec = MOTES[this.season];
      const sprite = new Sprite(this.art.get(spec.art[this.motes.length % spec.art.length]!).texture);
      sprite.anchor.set(0.5);
      sprite.alpha = 0;
      this.layers.weather.addChild(sprite);
      this.motes.push({
        sprite,
        x: this.rng() * screen.width,
        y: this.rng() * screen.height,
        speed: 0.6 + this.rng() * 0.8,
        sway: 0.5 + this.rng(),
        phase: this.rng() * 6.28,
        season: this.season,
      });
    }
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const mote = this.motes[i]!;
      const spec = MOTES[mote.season];
      const surplus = i >= want || mote.season !== this.season;
      mote.y += spec.fall * mote.speed * dt;
      mote.x += (spec.drift * 0.5 + Math.sin(this.time * mote.sway + mote.phase) * spec.drift) * dt;
      const size = 10 * spec.size * (0.7 + mote.speed * 0.4);
      mote.sprite.width = mote.sprite.height = size;
      mote.sprite.rotation = this.time * mote.sway + mote.phase;
      mote.sprite.position.set(mote.x, mote.y);
      // Motes from the outgoing season finish their fall, then are not replaced.
      mote.sprite.alpha += ((surplus ? 0 : 0.85) - mote.sprite.alpha) * Math.min(1, dt * (surplus ? 0.8 : 1.5));
      if (mote.y > screen.height + 20 || mote.x > screen.width + 20 || (surplus && mote.sprite.alpha < 0.03)) {
        if (surplus) {
          mote.sprite.destroy();
          this.motes.splice(i, 1);
          continue;
        }
        mote.y = -12;
        mote.x = this.rng() * (screen.width + 80) - 80;
      }
    }
  }
}

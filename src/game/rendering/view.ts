/**
 * The valley on screen. Owns the PixiJS application and the stack of layers,
 * back to front:
 *
 *   ground      terrain, river, paths, snow (one shader)
 *   backdrop    distant mountain ridges
 *   shadows     soft shadows and pools of lamplight on the ground
 *   water       fords, fish, the stream below Seseragi in flood or frozen
 *   sorted      scenery, crossings, travellers (depth-sorted by ground position)
 *   lights      lamp glow
 *   overlay     selection, drawing preview
 *   sky         mist, birds
 *   weather     petals, leaves, snowfall (screen space)
 */

import { type Application, Container } from 'pixi.js';
import type { Simulation } from '../simulation/simulation';
import type { Connection } from '../world/connections';
import { Polyline } from '../world/geometry';
import { groundMaps } from './groundBake';
import { FireLayers } from './fireLayers';
import { placeById } from '../world/terrain';
import type { ObjectiveDef, Season } from '../world/types';
import type { ArtLibrary } from './art';
import { AgentLayer } from './agentLayer';
import { Ambience } from './ambience';
import { Backdrop } from './backdrop';
import { Camera } from './camera';
import { rainMotion } from './rainMotion';
import { ConnectionLayer } from './connectionLayer';
import { StreamWater } from './streamWater';
import { streamFlooded } from '../adventure/stream';
import { Effects } from './effects';
import { type Extent, bakeCanopy, extentOf } from './fields';
import { Ground } from './ground';
import { PlantingLayer } from './plantingLayer';
import { SceneryLayer } from './sceneryLayer';
import { groundFamilySampler } from './groundGrade';
import { Veil } from './veil';
import { Waterfalls } from './waterfalls';
import { Wildlife } from './wildlife';
import { SeaFinale } from './seaFinale';
import { AdventureLayer } from './adventure/adventureLayer';
import type { AdventureScene } from '../adventure/model';
import { Graphics } from 'pixi.js';
import { PlaceLifeLayer } from './placeLifeLayer';
import { WEATHER_INK } from './adventure/weather';
import { expeditionSeasonWave } from './seasonFront';
import { ReachReveal, type RevealLandmark, type RevealPlan } from './adventure/reveal';
import { newFrame } from './adventure/frame';

/** Scenery that lies on the water or the ground and casts no shade. */
const FLAT = new Set(['waterfall', 'foam-rapids', 'marsh', 'reedbed', 'small-pool', 'rocky-clearing', 'snow-patch']);

/** Board pieces that do not sit in the painting and are left out: the glass net float read as a beach ball, the wrack as a heavy dark strand line. */
const OFF_THEME = new Set(['net-float', 'wrack']);

/** Fords that go under when the river is high: the Takaishi stones on the way to Hanano. */
const DROWNED_AT_HIGH = ['high-stones'];

/** Seconds a new route takes to be laid along its length. */
const REVEAL_SECONDS = 1.3;

/** Seconds the seasonal front takes to cross the valley. */
const WAVE_SECONDS = 9;

/** The grid (world px) the scenery's culling rectangle is widened to. */
const CULL_GRID = 256;

/**
 * Widens a rectangle outward to the culling grid, so that as the camera drifts
 * the set of scenery drawn changes only when a grid line is crossed, rather
 * than a few sprites flipping in or out every frame. It only ever grows.
 */
const snapOutward = (r: { left: number; top: number; right: number; bottom: number }) => ({
  left: Math.floor(r.left / CULL_GRID) * CULL_GRID,
  top: Math.floor(r.top / CULL_GRID) * CULL_GRID,
  right: Math.ceil(r.right / CULL_GRID) * CULL_GRID,
  bottom: Math.ceil(r.bottom / CULL_GRID) * CULL_GRID,
});

export class ValleyView {
  readonly world = new Container();
  readonly sorted = new Container();
  readonly shadows = new Container();
  readonly water = new Container();
  readonly lights = new Container();
  readonly overlay = new Container();
  readonly sky = new Container();
  readonly weatherLayer = new Container();
  readonly camera: Camera;
  readonly extent: Extent;
  readonly ground: Ground;
  private readonly backdrop: Backdrop;
  private readonly scenery: SceneryLayer;
  private readonly connections: ConnectionLayer;
  /** The stream below Seseragi, frozen in winter and full on its flood days (expeditions only). */
  private readonly stream: StreamWater | null;
  readonly agents: AgentLayer;
  /** The expedition drawn in the valley, when there is one (see `attachAdventure`). */
  adventure: AdventureLayer | null = null;
  /** Where the adventure layer gets its scene each frame. */
  private adventureScene: (() => AdventureScene | null) | null = null;
  readonly seaFinale: SeaFinale | null;
  private readonly expeditionWeather = new Graphics();
  private readonly ambience: Ambience;
  private readonly planting: PlantingLayer;
  private readonly effects: Effects;
  private readonly wildlife: Wildlife;
  private readonly placeLife: PlaceLifeLayer;
  private readonly waterfalls: Waterfalls;
  private readonly veil: Veil;
  /** The travel day's unveiling of the next reach (see `travel`). */
  private readonly reveal: ReachReveal;
  private revealPlan: RevealPlan | null = null;
  private revealId = '';
  private revealClock = 0;
  private readonly revealFrame = newFrame();
  /** Routes still being laid: id to progress, 0..1. */
  private readonly revealing = new Map<string, number>();
  private known = new Set<string>();
  private sinceRepaint = 0;
  /** Which old beds were open when the river was last drawn. */
  private riverKey: string;
  private releasedSeason: Season | null = null;
  /** Stops traveller animation while the simulation is paused. */
  paused = false;
  private time = 0;
  /** Position of the seasonal front; 2 means settled. */
  private wave = 2;
  private season: Season;
  reducedMotion = false;
  /** The river level the ground is drawn at, eased (see `easeWaterLevel`); NaN until the first scene. */
  private waterLevel = NaN;
  private stonesDrowned = false;

  constructor(
    readonly app: Application,
    readonly art: ArtLibrary,
    readonly sim: Simulation,
  ) {
    const board = sim.board;
    this.extent = extentOf(board);
    // Spring opens with snow still on the mountains, then thaws through the first three days.
    this.season = sim.expedition && !sim.expedition.state.free ? ((sim.season + 3) % 4) as Season : sim.season;
    this.riverKey = sim.state.opened.join();
    // Laid out once per valley, or ahead of time in a worker (see groundBake.ts).
    // A board's painted bonfires give way to the moving layered fire drawn at the same spot (see Ambience).
    const layeredFire = FireLayers.available(art);
    const bake = groundMaps(board, sim.river, this.extent);
    const scenery = bake.scenery.filter((item) => !(layeredFire && item.asset === 'bonfire') && !OFF_THEME.has(item.asset));
    // Trees and buildings shade the ground they stand on; small plants and stones do not.
    const canopy = bakeCanopy(
      scenery,
      (item) => {
        const span = art.get(item.asset).width * item.scale;
        return span > 96 && !FLAT.has(item.asset) ? span * 0.46 : 0;
      },
      this.extent,
    );
    this.ground = new Ground(board, sim.river, this.extent, art, this.season, canopy);
    this.backdrop = new Backdrop(this.extent, board.seed, this.season, art, board.channels[0]?.points[0]?.[0] ?? board.width/2);
    this.sorted.sortableChildren = true;
    // The camera moves only this container: as a render group its transform reaches the GPU as one
    // uniform, rather than every child's being recomputed on the CPU each time the view pans or zooms.
    // (The ground and landscape shaders already take it as uWorldTransformMatrix.)
    this.world.isRenderGroup = true;
    this.world.addChild(this.backdrop.container, this.ground.mesh, this.shadows, this.water, this.sorted, this.lights, this.overlay, this.sky);
    app.stage.addChild(this.world, this.weatherLayer);

    this.scenery = new SceneryLayer(this.sorted, this.shadows, art, scenery, (y) => this.ground.alongOf(y), this.season, groundFamilySampler(bake.terrainB, this.extent));
    const alongOf = (y: number): number => this.ground.alongOf(y);
    this.connections = new ConnectionLayer(this.scenery, this.water, art, board, sim.river, alongOf, this.season);
    this.stream = sim.expedition ? new StreamWater(this.water, sim.river, this.season, () => streamFlooded(sim.expedition!.state.day)) : null;
    this.agents = new AgentLayer({ land: this.sorted, water: this.water, sky: this.sky }, art);
    // `sorted` lets ambience place things (a fire, say) among the scenery, so buildings in front hide them.
    const layers = { ground: this.shadows, water: this.water, sky: this.sky, lights: this.lights, weather: this.weatherLayer, sorted: this.sorted };
    this.ambience = new Ambience(art, board, sim.river, layers, this.season);
    this.planting = new PlantingLayer(this.scenery, this.shadows, art);
    this.effects = new Effects(this.sky, art);
    this.waterfalls = new Waterfalls(art, board, this.sorted);
    this.veil = new Veil(this.extent, art, this.mistEdge());
    this.world.addChild(this.veil.container);
    this.wildlife = new Wildlife(art, board, sim.river, { water: this.water, land: this.sorted, ground: this.shadows, sky: this.sky }, this.season);
    this.placeLife = new PlaceLifeLayer(sim, art, this.sorted, this.scenery);
    this.weatherLayer.addChild(this.expeditionWeather);
    this.seaFinale=sim.expedition?new SeaFinale(art):null;if(this.seaFinale)this.weatherLayer.addChild(this.seaFinale.root);
    // A bear comes to fish where a fish run has succeeded: the far end of any granted fish wish.
    this.wildlife.fishing = () => {
      for (const objective of board.objectives) {
        const journey = board.journeys.find((j) => j.id === objective.journey);
        if (journey?.traveller === 'fish' && sim.isGranted(objective)) return placeById(board, journey.to);
      }
      return null;
    };
    this.setConnections(sim.connections, false);
    // A valley reopened from a save shows the wishes already granted in it.
    for (const objective of board.objectives) if (sim.isGranted(objective)) this.flourish(objective, false);
    // In an expedition the session syncs the layer with the rules' scene each frame.
    if (sim.expedition) this.makeAdventure();
    // The reveal's ink sits over everything, its wisps with the mist.
    this.reveal = new ReachReveal(this.veil.container, art.get('mist').texture, art.get('warmth').texture);
    this.world.addChild(this.reveal.container);
    this.camera = new Camera(this.world, board, this.extent);
    this.frameReach();
    this.camera.resize(app.screen.width, app.screen.height);
    if (sim.expedition) {
      this.setSeason(sim.season);
      const s = sim.expedition.state;
      this.wave = expeditionSeasonWave(s.day, s.elapsed, s.phase);
    }
  }

  /** The layer that draws an expedition, added above everything else in the world. */
  private makeAdventure(): AdventureLayer {
    if (!this.adventure) {
      this.adventure = new AdventureLayer(this.art, { ground: this.shadows, water: this.water, sorted: this.sorted }, this.scenery, { board: this.sim.board, river: this.sim.river });
      this.adventure.season = this.season;
      this.adventure.reducedMotion = this.reducedMotion;
      this.world.addChild(this.adventure.top);
      this.markDownstream();
    }
    return this.adventure;
  }

  /**
   * Draws an expedition here from `source`, which the view calls every frame
   * for the latest scene. For the demo stage, which has no rules or session.
   */
  attachAdventure(source: () => AdventureScene | null): AdventureLayer {
    this.adventureScene = source;
    return this.makeAdventure();
  }

  resize(): void {
    this.camera.resize(this.app.screen.width, this.app.screen.height);
  }

  /**
   * Where the mist thickens: well below the lowest open reach, so the reach's
   * own places stand clear and the mist only gathers past them; off the bottom
   * of the valley once all are open.
   */
  private mistEdge(): number {
    const open = this.sim.openBottom;
    return open < this.sim.board.height - 1 ? open + 300 : this.extent.y + this.extent.height + 900;
  }

  /** Points the camera's idea of "the valley" at the reach in play, and stops it at the mist. */
  private frameReach(): void {
    const reaches = this.sim.reaches;
    if (reaches.length < 2) return;
    const index = Math.min(this.sim.state.chapter, reaches.length - 1);
    const top = index > 0 ? reaches[index - 1]!.bottom : 0;
    const open = this.sim.openBottom;
    // The view may look a little way into the mist, enough to see it thicken softly.
    const limit = open < this.sim.board.height - 1 ? open + 380 : this.extent.y + this.extent.height;
    this.camera.setRegion(this.sim.expedition ? 0 : top, reaches[index]!.bottom, limit);
  }

  /** The quiet arrow at the foot of the opened reach, pointing down the river to the next settlement. */
  private markDownstream(): void {
    const next = this.sim.reaches[this.sim.state.chapter + 1];
    this.adventure?.setDownstream(this.sim.openBottom, next ? next.name : null);
  }

  /**
   * A reach has opened: the mist draws back and the view follows the river
   * down. With `unveil` (a travel day) the mist stays where it is: `travel`
   * rolls it back over the day, and the session moves the camera.
   */
  openReach(unveil = false): void {
    this.markDownstream();
    if (!unveil && !this.revealPlan) this.veil.setEdge(this.mistEdge(), !this.reducedMotion);
    this.frameReach();
    if (!unveil) this.camera.fit();
  }

  /**
   * The travel day's unveiling, each frame: the plan for the reach being
   * walked into and the travel-day clock (game seconds), or null once the
   * group has arrived. The mist's edge follows the plan's timeline.
   */
  travel(plan: RevealPlan | null, t: number): void {
    this.revealPlan = plan;
    this.revealClock = t;
  }

  /** Called when a landmark of the reach begins to come into light. */
  set onRevealBeat(fn: (mark: RevealLandmark) => void) {
    this.reveal.onBeat = fn;
  }

  private stepReveal(dt: number): void {
    const plan = this.revealPlan;
    const f = this.revealFrame;
    f.dt = this.paused ? 0 : Math.min(0.1, dt);
    f.zoom = this.camera.zoom;
    f.reduced = this.reducedMotion;
    if (plan && (!this.reveal.active || plan.id !== this.revealId)) {
      this.revealId = plan.id;
      this.reveal.begin(plan, this.revealClock);
    } else if (!plan && this.reveal.active) {
      this.reveal.end();
      this.revealId = '';
      this.veil.setEdge(this.mistEdge(), true);
    }
    const edge = this.reveal.update(plan ? this.revealClock : null, f);
    if (edge === null) return;
    // Continuous while the day runs; a jump (a skipped day, a reopened save) rolls rather than cuts.
    const jump = Math.abs(edge - this.veil.current) > 60;
    this.veil.setEdge(edge, jump && edge > this.veil.current);
  }

  /** Frames one reach of the valley (by index), without changing what is open. */
  showReach(index: number): void {
    const reaches = this.sim.reaches;
    const reach = reaches[index];
    if (!reach || reaches.length < 2) return;
    const top = index > 0 ? reaches[index - 1]!.bottom : 0;
    this.camera.focus(this.sim.board.width / 2, (top + reach.bottom) / 2, this.camera.fitZoom);
  }

  /** Call whenever the player's landscape changes: routes drawn or reshaped, groves planted or removed. */
  setConnections(connections: readonly Connection[], animate = true): void {
    // A route not seen before is laid along its length (see `update`); everything else is drawn at once.
    if (animate && !this.reducedMotion) for (const c of connections) if (!this.known.has(c.id)) this.revealing.set(c.id, 0);
    this.known = new Set(connections.map((c) => c.id));
    if (this.sim.state.opened.join() !== this.riverKey) {
      this.riverKey = this.sim.state.opened.join();
      this.ground.refreshRiver();
    }
    for (const id of [...this.revealing.keys()]) if (!this.known.has(id)) this.revealing.delete(id);
    this.paintRoutes();
    this.scenery.setConnections(connections);
    this.connections.setConnections(connections, animate);
    // Retire old reward decorations when a place has acquired a different use.
    if(this.sim.state.identities.hanano)for(const id of ['summer-grazing','hay-making'])this.scenery.removeGroup(`wish:${id}`);
    if(this.sim.state.identities.sagi)this.scenery.removeGroup('wish:swans');
    this.planting.setPlanted(
      this.sim.board.places.filter((place) => place.kind === 'grove' || place.kind === 'reeds'),
      animate,
    );
  }

  /** Paints the worn ground of every route, with routes still being laid drawn only as far as they have got. */
  private paintRoutes(): void {
    const routes = this.sim.connections.map((c) => {
      const t = this.revealing.get(c.id);
      if (t === undefined) return c;
      const reach = c.line.length * (1 - (1 - t) ** 2);
      const points = c.line.points.filter((_, i) => c.line.cumulative[i]! <= reach);
      return points.length > 1 ? { ...c, line: new Polyline(points) } : null;
    });
    this.ground.setConnections(routes.filter((c): c is Connection => c !== null));
  }

  /** A traveller has completed a journey at this spot. */
  arrival(x: number, y: number): void {
    this.effects.arrive(x, y);
  }

  /**
   * A wish has been granted: its destination flourishes, and stays that way.
   * With `celebrate` the change is marked with a bloom of light.
   */
  flourish(objective: ObjectiveDef, celebrate: boolean): void {
    const chosen = (['summer-grazing','hay-making'].includes(objective.id) && this.sim.state.identities.hanano) || (objective.id==='swans' && this.sim.state.identities.sagi);
    if(chosen) return;
    const journey = this.sim.board.journeys.find((j) => j.id === objective.journey);
    const items = (objective.flourish ?? []).map((sprite, i) => ({
      asset: sprite.asset,
      x: sprite.x,
      y: sprite.y,
      scale: sprite.scale ?? 1,
      flip: sprite.flip ?? false,
      roll: (i * 0.37) % 1,
    }));
    this.scenery.setGroup(`wish:${objective.id}`, items, celebrate);
    if (celebrate && journey) {
      const place = placeById(this.sim.board, journey.to);
      this.effects.celebrate(place.x, place.y, place.radius);
    }
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    this.ambience.reducedMotion = reduced;
    this.effects.reducedMotion = reduced;
    this.wildlife.reducedMotion = reduced;
    this.waterfalls.reducedMotion = reduced;
    this.scenery.reducedMotion = reduced;
    if (this.adventure) this.adventure.reducedMotion = reduced;
    if (reduced && !this.sim.expedition && this.wave < 1.4) {
      this.wave = 2;
      this.ground.setSeasons(this.season, this.season);
      this.backdrop.setSeason(this.season, true);
    }
  }

  /** Removes this valley from the stage. The application and the art library outlive it. */
  destroy(): void {
    this.world.destroy({ children: true });
    // Textures the meshes and sprites do not own, and so do not free with themselves.
    this.ground.destroy();
    this.veil.destroy();
    this.backdrop.destroy();
    this.seaFinale?.destroy();
    this.weatherLayer.destroy({ children: true });
  }

  /** Begins the visible change of season. `immediate` skips the travelling front. */
  setSeason(season: Season, immediate = false): void {
    if (season === this.season) return;
    this.ground.setSeasons(immediate ? season : this.season, season);
    this.season = season;
    this.releasedSeason = null;
    this.wave = immediate || (this.reducedMotion && !this.sim.expedition) ? 2 : -0.12;
    this.scenery.setSeason(season);
    this.backdrop.setSeason(season, immediate || (this.reducedMotion && !this.sim.expedition));
    this.connections.setSeason(season);
    this.stream?.setSeason(season);
    this.ambience.setSeason(season);
    this.wildlife.setSeason(season);
    if (this.adventure) this.adventure.season = season;
  }

  /**
   * Eases the ground toward today's river level, so a change overnight is seen
   * as water rising or falling over a few seconds at dawn, never a jump.
   * Under reduced motion it still changes, a little faster.
   */
  private easeWaterLevel(target: number, dt: number): void {
    if (Number.isNaN(this.waterLevel)) this.waterLevel = target;
    const rate = this.reducedMotion ? 1.2 : 0.35;
    this.waterLevel += (target - this.waterLevel) * Math.min(1, dt * rate);
    this.ground.setLevel(this.waterLevel);
    const drowned = this.waterLevel > 0.5;
    if (drowned !== this.stonesDrowned) {
      this.stonesDrowned = drowned;
      this.connections.drowned = new Set(drowned ? DROWNED_AT_HIGH : []);
    }
  }

  /**
   * Expedition rain, never one even sheet: each rainy day has its own strength
   * (a drizzle to a downpour), gusts swell and ease it and lean it over, and
   * every drop keeps its own place, speed, length and depth (far drops fine,
   * slow and faint; near ones longer and brighter).
   */
  private drawRain(day: number, seed: number): void {
    const g = this.expeditionWeather;
    const { width, height } = this.app.screen;
    const unit = (n: number): number => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
    const strength = 0.45 + 0.55 * unit(day * 7.31 + (seed % 997));
    const gust = 0.8 + 0.2 * Math.sin(this.time * 0.23 + day) + 0.1 * Math.sin(this.time * 0.071 + 1.7);
    const wind = rainMotion(this.time, day, strength);
    const full = Math.min(240, Math.max(70, Math.round(width * height / 5200)));
    const count = Math.round(full * strength * gust);
    for (let i = 0; i < count; i++) {
      const near = unit(i * 3.17) > 0.62;
      const speed = (near ? 320 : 220) + 90 * unit(i * 5.41);
      const length = (near ? 17 : 11) + (near ? 10 : 6) * unit(i * 2.03) * (0.6 + strength * 0.6);
      const x = ((unit(i * 1.37) * (width + 120) + speed * wind.offset) % (width + 120)) - 60;
      const y = ((unit(i * 4.93) * (height + 60) + this.time * speed) % (height + 60)) - 30;
      const dx = wind.slope * length;
      const a = (near ? 0.78 : 0.56) * (0.75 + 0.25 * unit(i * 8.11));
      g.moveTo(x, y).lineTo(x + dx, y + length).stroke({ color: 0x405962, width: near ? 2.2 : 1.8, alpha: a * 0.3 });
      g.moveTo(x, y).lineTo(x + dx, y + length).stroke({ color: 0xe4ede7, width: near ? 1.3 : 1, alpha: a });
    }
  }

  get transitioning(): boolean {
    return this.wave < 1.4;
  }

  update(dt: number): void {
    this.time += dt;
    if (this.sim.expedition) {
      const s = this.sim.expedition.state;
      this.wave = expeditionSeasonWave(s.day, s.elapsed, s.phase);
    } else if (this.wave < 1.4) {
      // A long valley takes the season longer to travel.
      this.wave += (dt / (WAVE_SECONDS * Math.max(1, this.extent.height / 3800))) * 1.52;
      if (this.wave >= 1.4) {
        this.wave = 2;
        this.ground.setSeasons(this.season, this.season);
        this.art.releaseSeasons([this.season]);
      }
    }
    if (this.revealing.size) {
      for (const [id, t] of this.revealing) {
        if (t >= 1) this.revealing.delete(id);
        else this.revealing.set(id, Math.min(1, t + dt / REVEAL_SECONDS));
      }
      // Repainting the route map is the costliest thing the view does; 20 times a second is smooth enough.
      this.sinceRepaint += dt;
      if (this.sinceRepaint > 0.05 || !this.revealing.size) {
        this.sinceRepaint = 0;
        this.paintRoutes();
      }
    }
    this.camera.update(dt);
    this.ground.update(this.time, this.wave);
    this.scenery.update(dt, this.wave, snapOutward(this.camera.visible(420)));
    this.backdrop.update(dt, this.camera.x, this.sim.board.width / 2, this.wave);
    if (this.wave >= 1.4 && this.releasedSeason !== this.season) {
      this.art.releaseSeasons([this.season]);
      this.releasedSeason = this.season;
    }
    this.connections.update(dt, this.wave);
    this.stream?.update(dt);
    this.agents.update(dt, this.sim.agents, this.paused, this.camera.zoom);
    this.ambience.update(dt, this.app.screen, this.paused);
    this.effects.update(dt);
    this.wildlife.update(dt, this.paused);
    this.placeLife.update(dt, this.paused, this.reducedMotion);
    this.waterfalls.update(dt, this.paused, this.camera.zoom);
    if (this.adventure) {
      this.adventure.paused = this.paused;
      // An attached source (the demo stage) is synced here; the session syncs the game's own.
      const scene = this.adventureScene?.() ?? null;
      if (scene) this.adventure.sync(scene, dt, this.camera);
      this.easeWaterLevel(this.adventure.waterLevel, dt);
      // Falling petals and snow are drawn in screen space: darken them with the hour too.
      this.weatherLayer.tint = this.adventure.skyTint;
    }
    this.expeditionWeather.clear();
    const expedition = this.sim.expedition;
    if (expedition && expedition.state.voyage === 'preparing') {
      const weather = expedition.weather;
      this.backdrop.setWeather(weather);
      const ink = WEATHER_INK[weather];
      if (ink.alpha) this.expeditionWeather.rect(0, 0, this.app.screen.width, this.app.screen.height).fill({ color: ink.colour, alpha: ink.alpha });
      if (weather === 'rain' && !this.reducedMotion) this.drawRain(expedition.state.day, this.sim.state.seed);
      if (weather === 'snow' && !this.reducedMotion) {
        // Winter already has seasonal flakes; falling snow adds a sparse near layer.
        const { width, height } = this.app.screen;
        for (let i = 0; i < 20; i++) {
          const x = (i * 103 + Math.sin(this.time * .6 + i) * 16 + width) % width;
          const y = (i * 71 + this.time * (30 + i % 4 * 6)) % height;
          this.expeditionWeather.circle(x, y, 1 + i % 3 * .35).fill({ color: 0xf4f5ef, alpha: .5 });
        }
      }
    }
    // The painted sea belongs to the sailing clock only: the gathering's own clock must never raise it at the landing.
    if (this.sim.expedition && this.seaFinale) {
      const voyage = this.sim.expedition.state;
      // The painted boat takes over from the map's boat where it is on screen, and the map's boat fades as it does.
      this.seaFinale.update(voyage.voyage === 'sailing' ? voyage.voyageTime : -1, voyage.voyage === 'ended', this.app.screen, voyage.companions, this.reducedMotion, this.time, this.adventure?.boatOnScreen(this.camera) ?? null);
      this.adventure?.handOverBoat(this.seaFinale.root.visible ? this.seaFinale.swap : 0);
    }
    // The open sea has its own dawn palette; valley petals stay behind it.
    if (this.seaFinale?.root.visible) {
      this.weatherLayer.tint = 0xffffff;
      this.weatherLayer.setChildIndex(this.seaFinale.root, this.weatherLayer.children.length - 1);
    }
    this.stepReveal(dt);
    this.veil.update(dt);
  }
}

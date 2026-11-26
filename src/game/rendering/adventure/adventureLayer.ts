/**
 * The expedition, drawn in the valley. Depends only on the `AdventureScene`
 * snapshot (see `adventure/model.ts`), never on the rules, so the rules can
 * change freely underneath it.
 *
 * Call `sync` every frame with the latest scene; snapshots arrive about ten
 * times a second and everything is eased between them. `pick` answers what is
 * under the pointer, sightings first, then friends, buildings and places, with
 * hit areas sized in screen pixels so a thumb finds them on a phone.
 *
 * The parts, each in its own file:
 *   figures     the explorers, their poses, packs, and the leaving and homecoming
 *   trails      dotted ink lines for planned outings, footprints behind walkers
 *   places      ink marks and names, laid out so they never collide
 *   sightings   creatures arriving, lingering and leaving (or being sketched)
 *   buildings   sites, frames and finished structures
 *   plantings   things planted, growing over days
 *   camp        the evening fire
 *   daylight    the colour of the hour, lit windows, moonlight, fireflies, dawn mist
 *   downstream  the quiet arrow to the next settlement
 *   boat        the last voyage
 */

import { Container } from 'pixi.js';
import type { AdventureScene, ScenePick, StructureKind } from '../../adventure/model';
import type { Vec } from '../../core/math';
import type { River } from '../../world/river';
import type { BoardDef, Season } from '../../world/types';
import type { ArtLibrary } from '../art';
import type { Camera } from '../camera';
import type { SceneryLayer } from '../sceneryLayer';
import { Boat } from './boat';
import { Buildings } from './buildings';
import { Camp } from './camp';
import type { CampDay } from './campLife';
import { Daylight } from './daylight';
import { Downstream } from './downstream';
import { Settlements } from './settlements';
import { Figures } from './figures';
import { type FrameInfo, type Stage, newFrame, VIEW_MARGIN } from './frame';
import { Particles } from './particles';
import { Places } from './places';
import { type ScenePlanting, Plantings } from './plantings';
import { Sightings } from './sightings';
import { Glints } from './glints';
import { SpotLife } from './spotLife';
import { finishedArt, isPlanting, lookOf } from './structures';
import { Trails } from './trails';

/** The valley's containers the layer draws into. */
export interface ValleyLayers {
  /** Ground decals under everything standing (the view's `shadows`). */
  ground: Container;
  water: Container;
  /** Depth-sorted scenery. */
  sorted: Container;
}

/** Static world the layer needs: the board for its lit homes and fires, the river for bridges and moonlight. */
export interface ValleyWorld {
  board: BoardDef;
  river: River | null;
}

/** Margin round the screen inside which things are still updated, in screen px. */
const MARGIN = VIEW_MARGIN;

export class AdventureLayer {
  /**
   * Add this to the world container above everything else: the hour's wash,
   * the light that shines through it, and the ink laid over the painting.
   */
  readonly top = new Container();
  private readonly tone = new Container();
  private readonly stage: Stage;
  private readonly frame: FrameInfo = newFrame();
  private readonly figures: Figures;
  private readonly trails: Trails;
  private readonly places: Places;
  private readonly sightings: Sightings;
  /** Small things glinting by a friend's path, to be tapped and noted. */
  private readonly glints: Glints;
  private readonly buildings: Buildings;
  private readonly plantings: Plantings;
  private readonly camp: Camp;
  private oldBoatMoved: boolean | null = null;
  private readonly outpostFires = new Map<string, Camp>();
  private readonly daylight: Daylight;
  private readonly boat: Boat;
  private readonly spot: SpotLife;
  /** The same small touches of life beside someone walking, in the quiet stretches of a day (see `stirQuiet`). */
  private readonly quiet: SpotLife;
  /** Seconds until the next quiet touch may come. */
  private quietIn = 6;
  private readonly downstream: Downstream;
  private readonly settlements: Settlements;
  private readonly dust: Particles;
  private readonly sparks: Particles;
  private readonly smoke: Particles;
  private readonly lit = new Set<number>();
  private scene: AdventureScene | null = null;
  /** Plantings read from the scene's buildings, reused frame to frame. */
  private readonly planted: ScenePlanting[] = [];
  /** An ordinary day with someone at home, from the session (see `campLife.ts`); null otherwise. */
  campDay: CampDay | null = null;
  /** Freezes everything (the game is paused). */
  paused = false;
  reducedMotion = false;

  constructor(
    private readonly art: ArtLibrary,
    layers: ValleyLayers,
    private readonly scenery: SceneryLayer,
    private readonly world: ValleyWorld,
  ) {
    const glow = new Container();
    const ink = new Container();
    ink.sortableChildren = false;
    this.top.addChild(this.tone, glow, ink);
    this.stage = { ground: layers.ground, water: layers.water, sorted: layers.sorted, glow, ink };

    this.dust = new Particles(layers.sorted, art.get('ember').texture, 90);
    this.sparks = new Particles(glow, art.get('ember').texture, 60, true);
    // Enough for a full dusk plume over two fires (see `Camp.cooking`).
    this.smoke = new Particles(layers.sorted, art.get('smoke').texture, 40);
    this.daylight = new Daylight(art, this.tone, glow, world.board, world.river);
    this.trails = new Trails(ink, layers.ground, art.get('footprint').texture);
    this.buildings = new Buildings(art, this.stage, scenery, world.river, this.dust);
    this.plantings = new Plantings(art, this.stage);
    this.camp = new Camp(art, this.stage, world.board, this.smoke, this.sparks);
    const deck = (x: number, y: number): number => this.buildings.decks.lift(x, y);
    this.trails.deck = deck;
    this.figures = new Figures(art, this.stage, { dust: this.dust, sparks: this.sparks, deck });
    this.figures.river = world.river;
    this.sightings = new Sightings(art, this.stage, this.dust, this.sparks, world.river);
    this.sightings.perch = (x, y) => this.plantings.perch(x, y);
    this.glints = new Glints(this.stage, this.sparks);
    this.places = new Places(ink);
    this.spot = new SpotLife(art, layers.water, layers.sorted, this.dust);
    this.quiet = new SpotLife(art, layers.water, layers.sorted, this.dust);
    this.places.onSelect = (place) => this.lookClosely(place.at);
    this.boat = new Boat(art, this.stage);
    this.downstream = new Downstream(ink, world.river);
    this.settlements = new Settlements(scenery);
  }

  // ── The frame ────────────────────────────────────────────────────────────

  /** Draws `scene` for this frame. Call every frame, with the latest scene. */
  sync(scene: AdventureScene, dt: number, camera: Camera): void {
    this.scene = scene;
    const f = this.frame;
    f.dt = this.paused ? 0 : Math.min(0.1, dt);
    f.time += f.dt;
    f.zoom = camera.zoom;
    // The camera's one small object a frame; everything below reuses its own.
    const view = camera.visible(MARGIN / camera.zoom);
    f.left = view.left;
    f.top = view.top;
    f.right = view.right;
    f.bottom = view.bottom;
    f.reduced = this.reducedMotion;
    f.dusk = scene.dusk;
    f.fireX = scene.fire.x;
    f.fireY = scene.fire.y;

    // Older rules may not send the hour yet: read it from dusk.
    const hour = typeof scene.hour === 'number' ? scene.hour : 12 + scene.dusk * 8;
    this.daylight.update(hour, f);
    const g = this.daylight.grade;
    f.night = g.night;
    f.sun = g.sun;
    f.sunLength = g.sunLength;
    f.firelight = Math.min(1, Math.max(scene.dusk, g.night * 0.95));

    f.sites.length = 0;
    for (const b of scene.buildings) if (b.progress < 1 && b.stage === 2) f.sites.push(b.at);
    const gardens = this.figures.gardens;
    gardens.length = 0;
    for (const b of scene.buildings) if ((b.kind === 'garden' || b.kind === 'lily-bed') && b.progress >= 1) gardens.push(b.at);
    f.campDay = this.campDay;
    this.settlements.update(scene, f);
    this.camp.update(scene.fire, f, this.cooking(scene.fire, true));
    const fires = scene.campfires ?? scene.buildings.filter((b) => b.camp).map((b) => ({ id: String(b.id), at: b.camp! }));
    for (const camp of fires) {
      let fire = this.outpostFires.get(camp.id);
      if (!fire) {
        fire = new Camp(this.art, this.stage, this.world.board, this.smoke, this.sparks);
        this.outpostFires.set(camp.id, fire);
      }
      fire.update(camp.at, f, this.cooking(camp.at, false));
    }
    // Inactive outposts must stop drawing after residents move away.
    for (const [id, fire] of this.outpostFires) if (!fires.some((camp) => camp.id === id)) fire.update({ x: -10000, y: -10000 }, f);
    this.plantings.update(this.readPlantings(scene), f);
    this.buildings.update(scene.buildings, f);
    const boatMoved = scene.buildings.some(building => building.kind === 'boat') || !!scene.boat;
    if (boatMoved !== this.oldBoatMoved) {
      this.oldBoatMoved = boatMoved;
      this.scenery.setLandmarkHidden('boat-beached', { x: 668, y: 4118 }, boatMoved);
    }
    this.trails.update(scene.trails, scene.figures, f, this.sightings.tracks());
    this.figures.update(scene.figures, f);
    this.scenery.setPeople([...this.figures.feet, ...this.sightings.hidden()]);
    this.sightings.update(scene.sightings, f);
    this.glints.update(scene.glints ?? [], f);
    this.places.update(scene.places, this.figures.feet, f, this.sightings.spots());
    this.boat.update(scene.boat, f);
    this.spot.update(f);
    this.stirQuiet(scene, f);
    this.quiet.update(f);
    this.downstream.update(f);
    this.dust.update(f.dt);
    this.sparks.update(f.dt);
    this.smoke.update(f.dt);
    this.lightBuilt(scene);
  }

  /**
   * How strongly a fire is cooking by day, 0..1: thin in the morning, a
   * fuller plume toward dusk, so the day leans toward home. Fullest where
   * someone is at home tending it; the main fire keeps a thinner thread for
   * those coming back to it; Wander keeps it all quieter.
   */
  private cooking(at: Vec, main: boolean): number {
    const day = this.campDay;
    if (!day) return 0;
    const home = day.people.some((p) => Math.abs(p.fire.x - at.x) < 60 && Math.abs(p.fire.y - at.y) < 60);
    if (!home && !main) return 0;
    const k = Math.min(1, Math.max(0, day.progress));
    return (0.18 + 0.82 * k * k) * (home ? 1 : 0.55) * (day.quiet ? 0.65 : 1);
  }

  /** Plantings come among the buildings, with a growth stage: seedling, growing, grown. */
  private readPlantings(scene: AdventureScene): ScenePlanting[] {
    let n = 0;
    for (const b of scene.buildings) {
      if (!isPlanting(b.kind)) continue;
      let p = this.planted[n];
      if (!p) {
        p = { id: 0, kind: '', at: b.at, growth: 0 };
        this.planted[n] = p;
      }
      p.id = b.id;
      p.kind = b.kind;
      p.at = b.at;
      p.growth = [0.12, 0.55, 1][b.stage] ?? 1;
      n++;
    }
    this.planted.length = n;
    return this.planted;
  }

  /** Finished homes get lit windows at night. */
  private lightBuilt(scene: AdventureScene): void {
    for (const b of scene.buildings) {
      const home = b.kind === 'cottage' || b.kind === 'shelter' || b.kind === 'lookout';
      if (b.progress < 1 && this.lit.has(b.id)) {
        this.lit.delete(b.id);
        this.daylight.setBuilt(b.id, null, 0);
      }
      if (!home || b.progress < 1 || this.lit.has(b.id)) continue;
      this.lit.add(b.id);
      const look = lookOf(b.kind);
      const asset = finishedArt(b.kind, (id) => this.art.has(id));
      this.daylight.setBuilt(b.id, b.at, look.skirt * 0.9, asset, look.scale);
    }
  }

  /**
   * Between the day's moments, now and then a small bird lifts from the grass
   * (or rings spread on the water) beside a friend walking in view, so a long
   * walk is never quite empty. Never while a creature is showing, never
   * announced, and only in daylight.
   */
  private stirQuiet(scene: AdventureScene, f: FrameInfo): void {
    this.quietIn -= f.dt;
    if (this.quietIn > 0 || f.reduced) return;
    this.quietIn = 6 + Math.random() * 6;
    if (scene.hour < 7 || scene.hour > 17.5 || scene.sightings.some((s) => !s.id.startsWith('resident-'))) return;
    const inView = (at: Vec): boolean => at.x > f.left + 40 && at.x < f.right - 40 && at.y > f.top + 60 && at.y < f.bottom - 60;
    const walkers = scene.figures.filter((p) => p.role === 'friend' && p.visible && p.pose === 'walk' && inView(p.at));
    const who = walkers[Math.floor(Math.random() * walkers.length)];
    if (!who) return;
    const side = Math.random() < 0.5 ? -1 : 1;
    const at = { x: who.at.x + side * (34 + Math.random() * 30), y: who.at.y - 6 + Math.random() * 18 };
    const river = this.world.river;
    this.quiet.start(at.x, at.y, river ? river.edgeDistance(at) < 30 : false, f);
    this.quiet.release();
  }

  /** A small touch of life where the player looks closely. */
  private lookClosely(at: Vec): void {
    const river = this.world.river;
    const wet = river ? river.edgeDistance(at) < 30 : false;
    this.spot.start(at.x, at.y, wet, this.frame);
  }

  // ── The pointer ──────────────────────────────────────────────────────────

  /** What is under `at`: sightings first, then friends, buildings and places. */
  pick(at: Vec, zoom: number): ScenePick | null {
    const sighting = this.sightings.pick(at.x, at.y, zoom);
    if (sighting) return { kind: 'sighting', id: sighting };
    const glint = this.glints.pick(at.x, at.y, zoom);
    if (glint) return { kind: 'glint', id: glint };
    const friend = this.figures.pick(at.x, at.y, zoom);
    if (friend) return { kind: 'friend', id: friend };
    const building = this.buildings.pick(at.x, at.y, zoom);
    if (building !== null) return { kind: 'building', id: building };
    const planting = this.plantings.pick(at.x, at.y, zoom);
    if (typeof planting === 'number') return { kind: 'building', id: planting };
    const place = this.places.pick(at.x, at.y, zoom);
    if (place) return { kind: 'place', id: place };
    // A tap on a landmark's picture (Shiobashi's bridge) means the place it stands for.
    const landmark = this.buildings.pickLandmark(at.x, at.y, zoom);
    const named = landmark ? this.places.pick(landmark.x, landmark.y, Math.min(zoom, 0.2)) : null;
    if (named) return { kind: 'place', id: named };
    return null;
  }

  /** Hover polish for mouse users; touch relies on press and selection instead. */
  setHover(pick: ScenePick | null): void {
    this.figures.setHover(pick?.kind === 'friend' ? pick.id : null);
    this.places.setHover(pick?.kind === 'place' ? pick.id : null);
  }

  /** Immediate feedback for a finger or button going down on something. */
  pressed(pick: ScenePick): void {
    if (pick.kind === 'friend') this.figures.pressed(pick.id);
    else if (pick.kind === 'place') this.places.pressed(pick.id);
  }

  /** A tap has landed: answer it in the picture at once, before the rules reply. */
  tapped(pick: ScenePick): void {
    this.pressed(pick);
    if (pick.kind === 'place') {
      const place = this.scene?.places.find((p) => p.id === pick.id);
      if (place) this.lookClosely(place.at);
    } else if (pick.kind === 'sighting') this.sightings.sketch(pick.id);
    else if (pick.kind === 'glint') this.glints.take(pick.id);
  }

  // ── For the rest of the game ────────────────────────────────────────────

  /** Where the opened valley ends and what lies downstream (null once the whole river is open), for the arrow there. */
  setDownstream(bottom: number, next: string | null): void {
    this.downstream.set(bottom, next);
  }

  /**
   * How the river stands in the latest scene, -1 low, 0 middle, 1 high: the
   * scene's own level, or read from the places it closes while the rules do
   * not send one.
   */
  get waterLevel(): number {
    const scene = this.scene;
    if (!scene) return 0;
    if (scene.level) return scene.level === 'high' ? 1 : scene.level === 'low' ? -1 : 0;
    let island = false;
    let bar = false;
    for (const p of scene.places) {
      if (p.id === 'ukishima' && p.state === 'closed') island = true;
      if (p.id === 'koishihama' && p.state !== 'closed') bar = true;
    }
    return island ? 1 : bar ? -1 : 0;
  }

  /** The structure being placed, according to the latest scene. */
  get placing(): StructureKind | null {
    return this.scene?.placing ?? null;
  }

  /** Tint for screen-space layers outside the world (falling petals and snow), so they darken with the hour. */
  get skyTint(): number {
    return this.daylight.tint;
  }

  set season(season: Season) {
    this.frame.season = season;
  }

  /** The interface's place-name toggle. */
  get namesVisible(): boolean {
    return this.places.namesVisible;
  }

  set namesVisible(on: boolean) {
    this.places.namesVisible = on;
  }

  /** The interface's routes toggle: every trail drawn strongly. */
  get routesVisible(): boolean {
    return this.trails.emphasise;
  }

  set routesVisible(on: boolean) {
    this.trails.emphasise = on;
  }

  /** Where a friend is drawn (eased), for a camera that follows them. */
  friendAt(id: string): Vec | null {
    return this.figures.at(id);
  }

  /** The boat on screen, for the painted sea to take over from: hull centre and width in screen pixels, or null with no boat afloat. */
  boatOnScreen(camera: Camera): { x: number; y: number; width: number } | null {
    if (!this.scene?.boat) return null;
    const hull = this.boat.hullSize;
    const at = camera.worldToScreen({ x: this.boat.x, y: this.boat.y });
    // The painted hull is centred on its point; the map's hull art reads centred near its anchor too.
    return { x: at.x, y: at.y + hull.height * 0.04 * camera.zoom, width: hull.width * camera.zoom };
  }

  /** Fades the map's boat as the painted sea's boat takes over. */
  handOverBoat(k: number): void {
    this.boat.handOver(k);
  }

  /** Where the boat is drawn, for the camera on the last voyage. */
  voyagePosition(): Vec {
    return this.scene?.boat ? { x: this.boat.x, y: this.boat.y } : { x: this.frame.fireX, y: this.frame.fireY };
  }

  destroy(): void {
    this.top.destroy({ children: true });
  }
}

/**
 * The living valley. A fixed-timestep, deterministic simulation of the year
 * turning and of inhabitants setting out on journeys across the landscape the
 * player has shaped. It knows nothing about rendering: the view reads `agents`
 * and listens to events.
 *
 * Travellers are never commanded. Each journey periodically sends someone
 * out; they take the shortest open route for the season, and if the way is
 * shut they walk up to the obstacle, hesitate, and turn back. That scouting
 * behaviour is how the game explains a failing route without a dashboard.
 *
 * The player's goals are wishes (`ObjectiveDef`): journeys the inhabitants
 * want to make in a particular season. Granting every wish completes the valley.
 */

import {
  COST_CHANNEL,
  COST_PLANT,
  COST_STONES,
  MARKS_PER_SEASON,
  connectionCost,
  marksAfterSeason,
  rerouteCost,
} from '../campaign/interventions';
import { Emitter } from '../core/events';
import { type Vec, dist } from '../core/math';
import { nextRandom } from '../core/rng';
import { type Connection, type ConnectionData, type Verdict, buildConnection } from '../world/connections';
import { polylineIntersections } from '../world/geometry';
import { findRoute } from '../world/network';
import { River } from '../world/river';
import { placeById, zoneAt } from '../world/terrain';
import { type BoardDef, type FordDef, type JourneyDef, type ObjectiveDef, type PlaceDef, type ReachDef, SPRING, type Season, type Traveller } from '../world/types';
import { type Closure, closureOf } from './conditions';
import { flightRoute } from './flight';
import { type Leg, landLegs, legLength } from './legs';
import { waterRoute } from './water';
import { PlaceLife, newLifeState, restoreLifeState, type LifeState } from './placeLife';
import { ExpeditionAdventure } from '../adventure/expedition';
import type { AdventureState } from '../adventure/state';
import type { Cue } from '../adventure/model';
import { identityFor, type IdentityId } from '../world/identities';

/** Seconds of simulated time per fixed step. */
export const TICK = 0.1;
/** Default length of a season at normal speed. */
export const SEASON_SECONDS = 75;

const SPEED: Record<Traveller, number> = { deer: 70, villager: 50, fish: 64, bird: 130 };
/** How long a traveller hesitates at an obstacle before turning back. */
const HESITATION = 1.6;
const GROVE_RADIUS = 74;
const REEDS_RADIUS = 62;
/** The widest water stepping stones can be laid across. */
const STONES_MAX_WIDTH = 150;

export type GameMode = 'journey' | 'free';

/** Something the player has planted. Saved as a point; the place it makes is derived. */
export interface PlantData {
  id: string;
  /** Decided by the ground: reeds on wet ground, a grove anywhere else. */
  kind: 'grove' | 'reeds';
  x: number;
  y: number;
}

/** The player's whole mark on the valley; what undo and redo exchange. */
export interface Landscape {
  identities?: Record<string, string>;
  connections: ConnectionData[];
  planted: PlantData[];
  /** Ids of old river beds the player has opened. */
  opened: string[];
  /** Stepping stones the player has laid, as points on the river. */
  stones: Array<{ id: string; x: number; y: number }>;
}

/** Everything needed to resume a valley. Plain JSON. */
export interface GameState extends Landscape {
  /** The adventure's own state; absent only for the old route-puzzle boards. */
  adventure?: AdventureState;
  identities: Record<string, string>;
  life: LifeState;
  boardId: string;
  mode: GameMode;
  seed: number;
  rng: number;
  tick: number;
  nextId: number;
  /** Brushstrokes left this season (Journey mode). */
  marks: number;
  /** Brushstrokes spent in all, net of undo. Compared with the valley's par. */
  strokes: number;
  /** Completed journeys per journey id, indexed by the season the traveller set out in. */
  arrivals: Record<string, number[]>;
  /** Seconds until each journey's next departure. */
  timers: Record<string, number>;
  /** Departures so far per journey; alternates the direction of travel. */
  departures: Record<string, number>;
  /** Ids of granted wishes. */
  completed: string[];
  outcome: 'playing' | 'won';
  /** The year in which the last wish was granted. */
  wonYear: number | null;
  /**
   * How far down the valley the Journey has come: the index of the lowest
   * reach that is open. Reaches below it are still under mist.
   */
  chapter: number;
  /** When the current chapter opened, and how many strokes had been spent by then. */
  chapterTick: number;
  chapterStrokes: number;
  /** Blossoms earned for each finished chapter, and the detail of the most recent. */
  ratings: number[];
  lastRating: Blossom[] | null;
  /** True once the chapter's allotted years have passed with wishes still ungranted. Play continues. */
  overtime: boolean;
  /** Short notes about memorable firsts, shown on the result screen. */
  moments: string[];
}

export interface Agent {
  id: number;
  traveller: Traveller;
  journey: string;
  /** The season the traveller set out in; a completed journey counts toward that season's wishes. */
  season: Season;
  /** The place the traveller is making for; where it counts as having arrived. */
  destination: string;
  legs: Leg[];
  leg: number;
  /** Distance travelled along the current leg, in the direction of travel. */
  along: number;
  /** Sideways offset from the line, so groups do not walk in single file. */
  sway: number;
  speed: number;
  x: number;
  y: number;
  /** Heading in radians. */
  angle: number;
  /** A scout turns back at this distance on its final leg; null for ordinary travellers. */
  turnAt: number | null;
  phase: 'going' | 'resting' | 'hesitating' | 'returning';
  wait: number;
  /** Seconds since setting out. */
  age: number;
  /** True once the traveller has arrived or gone home; the view fades it out. */
  done: boolean;
}

export interface SimEvents {
  /** The expedition changed; `cue` names a sound that belongs to the moment, `at` where it happened. */
  adventure: { cue?: Cue; at?: Vec };
  activity: { place: string; identity: string; kind: string };
  season: { season: Season; year: number };
  arrive: { agent: Agent; journey: JourneyDef; place: string; season: Season };
  blocked: { journey: JourneyDef; closure: Closure };
  /** A wish was granted. */
  objective: { objective: ObjectiveDef };
  won: Record<string, never>;
  /** A reach is complete and the one below it has opened. */
  chapter: { finished: number; next: number };
  /** The allotted years are up and wishes remain. Not an ending: the valley plays on. */
  overtime: Record<string, never>;
  /** The landscape changed: a route or a planting was added, reshaped, removed or restored. */
  network: Record<string, never>;
  marks: { marks: number };
}

export type EditResult = { ok: true; connection: Connection; cost: number } | { ok: false; reason: string; at: Vec | null };
export type PlantResult = { ok: true; place: PlaceDef; cost: number } | { ok: false; reason: string; at: Vec | null };
export type OpenResult = { ok: true; cost: number } | { ok: false; reason: string; at: Vec | null };
export type StonesResult = { ok: true; ford: FordDef; cost: number } | { ok: false; reason: string; at: Vec | null };

/** Whether a journey can be made in a season, and if not, what is in the way. */
export interface Outlook {
  /** True if the two ends are joined at all, whatever the season. */
  joined: boolean;
  /** What shuts the way in that season; null if it is open (or not joined). */
  closure: Closure | null;
}

export interface Blossom {
  label: string;
  earned: boolean;
}

export function newGameState(board: BoardDef, mode: GameMode, seed = board.seed): GameState {
  return {
    boardId: board.id,
    mode,
    seed,
    rng: seed >>> 0,
    tick: 0,
    identities: {},
    life: newLifeState(),
    connections: [],
    planted: [],
    opened: [],
    stones: [],
    nextId: 1,
    marks: MARKS_PER_SEASON,
    strokes: 0,
    arrivals: Object.fromEntries(board.journeys.map((j) => [j.id, [0, 0, 0, 0]])),
    // Stagger first departures so the valley does not move in lockstep.
    timers: Object.fromEntries(board.journeys.map((j, i) => [j.id, 2 + i * 1.5])),
    departures: Object.fromEntries(board.journeys.map((j) => [j.id, 0])),
    completed: [],
    outcome: 'playing',
    wonYear: null,
    // Free Play has the whole river from the start.
    chapter: mode === 'free' ? (board.reaches?.length ?? 1) - 1 : 0,
    chapterTick: 0,
    chapterStrokes: 0,
    ratings: [],
    lastRating: null,
    overtime: false,
    moments: [],
  };
}

const plantedPlace = (plant: PlantData): PlaceDef =>
  plant.kind === 'reeds'
    ? { id: plant.id, name: 'Reed bed', kind: 'reeds', x: plant.x, y: plant.y, radius: REEDS_RADIUS, links: [], rest: true, note: 'Planted by you. Birds rest here on their way through.' }
    : { id: plant.id, name: 'Young grove', kind: 'grove', x: plant.x, y: plant.y, radius: GROVE_RADIUS, links: ['corridor'], rest: true, note: 'Planted by you. Deer and birds shelter here, and corridors can meet.' };

/** Stones the player lays are like any others in the valley: the spring melt covers them. */
const laidFord = (stones: { id: string; x: number; y: number }): FordDef => ({ id: stones.id, name: 'your stepping stones', x: stones.x, y: stones.y, radius: 62, floods: [SPRING] });

/** Reeds grow where the ground is wet; everywhere else a planting becomes a grove. */
function plantKindAt(board: BoardDef, at: Vec): PlantData['kind'] {
  const inside = (blobs: readonly { x: number; y: number; r: number }[]): boolean => blobs.some((b) => dist(at, b) < b.r * 0.85);
  // Marsh and water meadow alike are too wet for trees.
  const wet = board.patches.some((patch) => patch.material === 'wetland' && inside(patch.blobs)) || (board.floodplains ?? []).some((plain) => inside(plain.blobs));
  return wet ? 'reeds' : 'grove';
}

export class Simulation {
  readonly expedition: ExpeditionAdventure | null;
  readonly life: PlaceLife;
  readonly events = new Emitter<SimEvents>();
  /**
   * The valley as it stands: the authored board plus whatever the player has
   * planted. `places` grows and shrinks in place, so anything holding this
   * object always sees the current valley.
   */
  readonly board: BoardDef;
  readonly river: River;
  readonly agents: Agent[] = [];
  connections: Connection[] = [];
  seasonSeconds = SEASON_SECONDS;

  private nextAgentId = 1;
  private accumulator = 0;
  /** Journeys already reported as blocked this season, so the player is told once. */
  private reported = new Set<string>();

  constructor(
    private readonly authored: BoardDef,
    readonly state: GameState,
  ) {
    state.identities = Object.fromEntries(Object.entries(state.identities && typeof state.identities==='object' ? state.identities : {}).filter(([place,id])=>typeof id==='string'&&identityFor(place,id)&&authored.places.some(p=>p.id===place)));
    state.life = restoreLifeState(state.life);
    this.life = new PlaceLife(this);
    this.board = { ...authored, places: [], fords: [], weirs: [...(authored.weirs ?? [])] };
    this.river = new River(authored);
    this.river.setOpened(state.opened);
    this.rebuild();
    this.expedition = state.adventure ? new ExpeditionAdventure(this) : null;
  }

  // ── Time ────────────────────────────────────────────────────────────────

  get time(): number {
    return this.state.tick * TICK;
  }
  get season(): Season {
    return (Math.floor(this.time / this.seasonSeconds) % 4) as Season;
  }
  get year(): number {
    return Math.floor(this.time / (this.seasonSeconds * 4)) + 1;
  }
  /** Progress through the current year, 0..1. */
  get yearProgress(): number {
    return (this.time / (this.seasonSeconds * 4)) % 1;
  }

  // ── Reaches ─────────────────────────────────────────────────────────────

  /** The valley's reaches from the mountains down; a simple valley is a single reach. */
  get reaches(): ReachDef[] {
    const b = this.authored;
    return b.reaches ?? [{ id: b.id, name: b.name, subtitle: b.subtitle, bottom: b.height, par: b.par, opening: b.opening }];
  }

  /** The reach the Journey is working on. */
  get reach(): ReachDef {
    return this.reaches[Math.min(this.state.chapter, this.reaches.length - 1)]!;
  }

  /** World y below which the valley is still under mist. */
  get openBottom(): number {
    return this.reach.bottom;
  }

  private isOpen(def: { reach?: number }): boolean {
    return (def.reach ?? 0) <= this.state.chapter;
  }

  /** The wishes of every reach that has opened. */
  get wishes(): ObjectiveDef[] {
    return this.authored.objectives.filter((o) => this.isOpen(o));
  }

  /** Why nothing can be done at a spot, if it lies in a reach that has not opened. */
  private veiled(...points: Vec[]): string | null {
    return points.some((p) => p.y > this.openBottom) ? 'The mist has not lifted from the valley below.' : null;
  }

  /** Advances by real elapsed seconds (already scaled by game speed), in fixed steps. */
  advance(seconds: number): void {
    this.accumulator += seconds;
    // Never try to catch up more than a few seconds after a stalled tab.
    this.accumulator = Math.min(this.accumulator, 4);
    while (this.accumulator >= TICK) {
      this.accumulator -= TICK;
      this.step();
    }
  }

  /** Simulates forward to the start of the next season. Journeys in between are evaluated as normal. */
  skipToNextSeason(): void {
    if (this.expedition) return this.expedition.skipToNextSeason();
    const season = this.season;
    while (this.season === season) this.step();
  }

  /** One fixed step. */
  step(): void {
    // The expedition keeps its own calendar and sets the clock itself (see `setClock`).
    if (this.expedition) return this.expedition.step(TICK);
    const before = this.season;
    this.state.tick++;
    const season = this.season;
    if (season !== before) this.onSeasonChange(season);

    for (const journey of this.authored.journeys) if (this.isOpen(journey)) this.updateJourney(journey, season);
    for (const agent of this.agents) this.updateAgent(agent);
    this.life.step(TICK);
    if (Object.keys(this.state.identities).length) this.checkWishes();
    for (let i = this.agents.length - 1; i >= 0; i--) if (this.agents[i]!.done) this.agents.splice(i, 1);

    const state = this.state;
    const allowed = this.authored.years * 4 * this.seasonSeconds;
    if (!this.expedition && state.mode === 'journey' && state.outcome === 'playing' && !state.overtime && (state.tick - state.chapterTick) * TICK >= allowed) {
      state.overtime = true;
      this.events.emit('overtime', {});
    }
  }

  /**
   * Sets the clock to a tick, telling everyone if the season turned. The
   * expedition calls this as its days pass, so the painted season always
   * matches its calendar.
   */
  setClock(tick: number): void {
    const before = this.season;
    this.state.tick = tick;
    if (this.season !== before) this.onSeasonChange(this.season);
  }

  /** The wild travellers' share of one step, while an expedition day is running. */
  stepWildlife(): void {
    const season = this.season;
    for (const journey of this.authored.journeys) if (this.isOpen(journey)) this.updateJourney(journey, season);
    for (const agent of this.agents) this.updateAgent(agent);
    for (let i = this.agents.length - 1; i >= 0; i--) if (this.agents[i]!.done) this.agents.splice(i, 1);
  }

  private onSeasonChange(season: Season): void {
    this.reported.clear();
    if (!this.expedition && this.state.mode === 'journey') {
      this.state.marks = marksAfterSeason(this.state.marks);
      this.events.emit('marks', { marks: this.state.marks });
    }
    // Travellers caught short of a new obstacle turn back when they reach it.
    for (const agent of this.agents) this.checkLegAhead(agent, season);
    this.events.emit('season', { season, year: this.year });
  }

  // ── Journeys and travellers ─────────────────────────────────────────────

  /**
   * The way a traveller would go, and whether it is open. Land travellers
   * follow the player's connections; fish follow the river; birds hop between
   * resting places. Null if nothing joins the two ends.
   */
  private wayFor(journey: JourneyDef, season: Season, from: string, to: string): { legs: Leg[]; closure: Closure | null; turnAt: number | null } | null {
    if (journey.traveller === 'fish') {
      const route = waterRoute(this.board, this.river, this.connections, season, placeById(this.board, from), placeById(this.board, to));
      return route && { ...route, turnAt: route.closure ? lastLength(route.legs) : null };
    }
    if (journey.traveller === 'bird') {
      const route = flightRoute(this.board, this.connections, from, to);
      return route && { ...route, turnAt: route.closure ? lastLength(route.legs) : null };
    }
    const open = findRoute(this.connections, journey.traveller, season, from, to);
    if (open) return { legs: landLegs(open), closure: null, turnAt: null };
    // A route exists but the season has shut it: go as far as the obstacle.
    const wished = findRoute(this.connections, journey.traveller, season, from, to, true);
    if (!wished) return null;
    const legs = landLegs(wished);
    for (let i = 0; i < legs.length; i++) {
      const closure = closureOf(legs[i]!.connection!, season);
      if (closure) return { legs: legs.slice(0, i + 1), closure, turnAt: this.turnPoint(legs[i]!, closure) };
    }
    return { legs, closure: null, turnAt: null };
  }

  /** Whether a wish's journey can be made in its season, and what is in the way if not. */
  outlook(objective: ObjectiveDef): Outlook {
    const journey = this.authored.journeys.find((j) => j.id === objective.journey)!;
    const way = this.wayFor(journey, objective.season, journey.from, journey.to);
    return { joined: way !== null, closure: way?.closure ?? null };
  }

  private updateJourney(journey: JourneyDef, season: Season): void {
    // Chosen identities replace the old mixed-use meadow with a real activity.
    if (this.state.identities.hanano && ['deer-meadow', 'hay-walk'].includes(journey.id)) return;
    const timers = this.state.timers;
    timers[journey.id] = (timers[journey.id] ?? journey.every) - TICK;
    if (timers[journey.id]! > 0) return;
    // A little irregularity keeps departures from feeling mechanical.
    timers[journey.id] = journey.every * (0.8 + 0.4 * nextRandom(this.state));
    if (!journey.seasons.includes(season)) return;

    // Walkers go there and back by turns. Fish and flocks are on migration: one way only.
    const migrant = journey.traveller === 'fish' || journey.traveller === 'bird';
    const outbound = migrant || (this.state.departures[journey.id] ?? 0) % 2 === 0;
    const from = outbound ? journey.from : journey.to;
    const to = outbound ? journey.to : journey.from;

    const way = this.wayFor(journey, season, from, to);
    if (!way || way.legs.length === 0) {
      if (way?.closure && !this.reported.has(journey.id)) {
        this.reported.add(journey.id);
        this.events.emit('blocked', { journey, closure: way.closure });
      }
      return;
    }
    if (!way.closure) {
      this.state.departures[journey.id] = (this.state.departures[journey.id] ?? 0) + 1;
      this.spawn(journey, season, to, way.legs, null);
      return;
    }
    // The way is shut: a scout goes as far as the obstacle and turns back, so the player can see where.
    this.spawn(journey, season, to, way.legs, way.turnAt);
    if (!this.reported.has(journey.id)) {
      this.reported.add(journey.id);
      this.events.emit('blocked', { journey, closure: way.closure });
    }
    // Scouts set out less often than travellers with somewhere to go.
    timers[journey.id]! += journey.every * 0.6;
  }

  /** Distance along a leg (in travel direction) at which a land traveller meets a closure. */
  private turnPoint(leg: Leg, closure: Closure): number {
    const reversed = leg.from > leg.to;
    const edge = reversed ? leg.line.length - closure.span[1] : closure.span[0];
    return Math.max(8, edge - 14);
  }

  private spawn(journey: JourneyDef, season: Season, destination: string, legs: Leg[], turnAt: number | null): void {
    const agent: Agent = {
      id: this.nextAgentId++,
      traveller: journey.traveller,
      journey: journey.id,
      season,
      destination,
      legs,
      leg: 0,
      along: 0,
      sway: (nextRandom(this.state) - 0.5) * 12,
      speed: SPEED[journey.traveller] * (0.9 + 0.2 * nextRandom(this.state)),
      x: 0,
      y: 0,
      angle: 0,
      turnAt,
      phase: 'going',
      wait: 0,
      age: 0,
      done: false,
    };
    this.place(agent);
    this.agents.push(agent);
  }

  private updateAgent(agent: Agent): void {
    agent.age += TICK;
    const leg = agent.legs[agent.leg]!;
    const length = legLength(leg);
    const lastLeg = agent.leg === agent.legs.length - 1;

    if (agent.phase === 'hesitating' || agent.phase === 'resting') {
      agent.wait -= TICK;
      if (agent.wait > 0) return;
      if (agent.phase === 'hesitating') agent.phase = 'returning';
      else {
        agent.phase = 'going';
        agent.leg++;
        agent.along = 0;
      }
    } else if (agent.phase === 'returning') {
      agent.along -= agent.speed * TICK;
      if (agent.along <= 0) {
        if (agent.leg === 0) agent.done = true;
        else {
          agent.leg--;
          agent.along = legLength(agent.legs[agent.leg]!);
        }
      }
    } else {
      agent.along += agent.speed * TICK;
      if (lastLeg && agent.turnAt !== null && agent.along >= agent.turnAt) {
        agent.along = agent.turnAt;
        agent.phase = 'hesitating';
        agent.wait = HESITATION;
      } else if (agent.along >= length) {
        if (lastLeg) this.arrive(agent);
        else if (leg.rest) {
          agent.along = length;
          agent.phase = 'resting';
          agent.wait = leg.rest;
        } else {
          agent.leg++;
          agent.along = 0;
          this.checkLegAhead(agent, this.season);
        }
      }
    }
    if (!agent.done) this.place(agent);
  }

  /** If the rest of a land traveller's route has closed, it becomes a scout that turns back at the obstacle. */
  private checkLegAhead(agent: Agent, season: Season): void {
    if (agent.phase !== 'going') return;
    for (let i = agent.leg; i < agent.legs.length; i++) {
      const leg = agent.legs[i]!;
      const closure = leg.connection && closureOf(leg.connection, season);
      if (!closure) continue;
      const turnAt = this.turnPoint(leg, closure);
      // Already past the obstacle on the current leg: let them finish.
      if (i === agent.leg && agent.along > turnAt) continue;
      agent.legs = agent.legs.slice(0, i + 1);
      agent.turnAt = turnAt;
      return;
    }
  }

  private arrive(agent: Agent): void {
    agent.done = true;
    const journey = this.authored.journeys.find((j) => j.id === agent.journey)!;
    // A journey belongs to the season it began in, even if the traveller arrives just after the turn.
    const tally = (this.state.arrivals[journey.id] ??= [0, 0, 0, 0]);
    tally[agent.season] = (tally[agent.season] ?? 0) + 1;
    this.events.emit('arrive', { agent, journey, place: agent.destination, season: agent.season });
    this.checkWishes();
  }

  private place(agent: Agent): void {
    const leg = agent.legs[agent.leg]!;
    const reversed = leg.from > leg.to;
    const p = leg.line.at(reversed ? leg.from - agent.along : leg.from + agent.along);
    let heading = reversed ? p.angle + Math.PI : p.angle;
    if (agent.phase === 'returning') heading += Math.PI;
    agent.x = p.x - Math.sin(p.angle) * agent.sway;
    agent.y = p.y + Math.cos(p.angle) * agent.sway;
    agent.angle = heading;
  }

  // ── Wishes ──────────────────────────────────────────────────────────────

  /** Journeys counted toward a wish so far. */
  progress(objective: ObjectiveDef): number {
    const meadow = this.state.identities.hanano;
    if (meadow && ['summer-grazing', 'hay-making'].includes(objective.id)) return Math.min(objective.count, this.life.count('hanano', meadow));
    const reach = this.state.identities['seseragi-pool'];
    if (objective.id === 'salmon-run' && ['fishing-reach','mill-reach'].includes(reach)) return Math.min(objective.count,this.life.count('seseragi-pool',reach));
    const wetland = this.state.identities.sagi;
    if (objective.id === 'swans' && wetland) return Math.min(objective.count,this.life.count('sagi',wetland));
    return Math.min(objective.count, this.state.arrivals[objective.journey]?.[objective.season] ?? 0);
  }

  isGranted(objective: ObjectiveDef): boolean {
    return this.state.completed.includes(objective.id);
  }

  private checkWishes(): void {
    if (this.expedition) return;
    const state = this.state;
    for (const objective of this.wishes) {
      if (this.isGranted(objective) || this.progress(objective) < objective.count) continue;
      state.completed.push(objective.id);
      this.events.emit('objective', { objective });
    }
    // Free Play grants wishes too, but has no chapters and never ends.
    if (state.mode !== 'journey' || state.outcome !== 'playing') return;
    const chapter = state.chapter;
    if (!this.authored.objectives.filter((o) => (o.reach ?? 0) === chapter).every((o) => this.isGranted(o))) return;
    state.lastRating = this.rate();
    state.ratings[chapter] = state.lastRating.filter((b) => b.earned).length;
    if (chapter < this.reaches.length - 1) {
      // The reach is in song: the mist lifts from the one below.
      state.chapter = chapter + 1;
      state.chapterTick = state.tick;
      state.chapterStrokes = state.strokes;
      state.overtime = false;
      this.events.emit('chapter', { finished: chapter, next: chapter + 1 });
    } else {
      state.outcome = 'won';
      state.wonYear = this.year;
      this.events.emit('won', {});
    }
  }

  /** How the current chapter stands: one blossom for each line earned. */
  private rate(): Blossom[] {
    const state = this.state;
    const chapter = state.chapter;
    const done = this.authored.objectives.filter((o) => (o.reach ?? 0) === chapter).every((o) => this.isGranted(o));
    // A year means every season once. A reach that opens part-way through a season is given the
    // rest of that season free, and there is a little grace for the last travellers to arrive.
    const seasonTicks = this.seasonSeconds / TICK;
    const opened = state.chapterTick / seasonTicks;
    const deadline = (Math.floor(opened) + (Number.isInteger(opened) ? 4 : 5) + 0.3) * seasonTicks;
    const par = this.reach.par;
    return [
      { label: 'Every wish granted', earned: done },
      { label: chapter === 0 ? 'Within the first year' : 'Within a year', earned: done && state.tick <= deadline },
      { label: `With ${par} brushstrokes or fewer`, earned: done && state.strokes - state.chapterStrokes <= par },
    ];
  }

  /** The rating of the chapter most recently finished, or of the current one so far. */
  blossoms(): Blossom[] {
    return this.state.lastRating ?? this.rate();
  }

  // ── Player edits ────────────────────────────────────────────────────────

  /** Identity changes are free in the prototype, and participate in normal undo. */
  chooseIdentity(place: string, id: IdentityId): OpenResult {
    if (!identityFor(place,id) || !this.board.places.some((p)=>p.id===place&&p.y<=this.openBottom)) return {ok:false,reason:'That identity is not available here.',at:null};
    this.state.identities[place]=id;
    this.state.life.timers[place]=0;
    this.state.life.actors=this.state.life.actors.filter((a)=>a.place!==place);
    this.rebuild();
    return {ok:true,cost:0};
  }

  private get limited(): boolean {
    return !this.expedition && this.state.mode === 'journey';
  }

  private others(excludeId?: string): Connection[] {
    return excludeId ? this.connections.filter((c) => c.id !== excludeId) : this.connections;
  }

  /**
   * Validates a prospective connection without changing anything; used for the
   * live preview. Pass the `id` of an existing connection when previewing a
   * reshape, so it is not checked against itself.
   */
  preview(data: Omit<ConnectionData, 'id'> & { id?: string }): Verdict {
    return buildConnection(this.board, this.river, { ...data, id: data.id ?? 'preview' }, this.others(data.id));
  }

  /** What a previewed connection would cost to add. */
  costOf(connection: Connection): number {
    return this.limited ? connectionCost(connection) : 0;
  }

  addConnection(data: Omit<ConnectionData, 'id'>): EditResult {
    const verdict = buildConnection(this.board, this.river, { ...data, id: `c${this.state.nextId}` }, this.connections);
    if (!verdict.ok) return verdict;
    const veiled = this.veiled(...verdict.connection.line.points);
    if (veiled) return { ok: false, reason: veiled, at: null };
    const cost = connectionCost(verdict.connection);
    if (this.limited && this.state.marks < cost) return { ok: false, reason: this.shortOf(cost, 'A footbridge takes'), at: null };
    this.state.nextId++;
    this.state.connections.push(toData(verdict.connection));
    this.spend(cost);
    this.rebuild();
    return { ok: true, connection: verdict.connection, cost: this.limited ? cost : 0 };
  }

  /** Replaces a connection's control points. Costs strokes only if the route now works differently. */
  reshapeConnection(id: string, control: Vec[]): EditResult {
    const index = this.state.connections.findIndex((c) => c.id === id);
    const before = this.connections.find((c) => c.id === id);
    if (index < 0 || !before) return { ok: false, reason: 'That route is gone.', at: null };
    const verdict = buildConnection(this.board, this.river, { ...this.state.connections[index]!, control }, this.others(id));
    if (!verdict.ok) return verdict;
    const veiled = this.veiled(...verdict.connection.line.points);
    if (veiled) return { ok: false, reason: veiled, at: null };
    const cost = rerouteCost(before, verdict.connection);
    if (this.limited && cost > this.state.marks) return { ok: false, reason: this.shortOf(cost, 'That changes the route, which takes'), at: null };
    this.state.connections[index] = toData(verdict.connection);
    this.spend(cost);
    this.rebuild();
    return { ok: true, connection: verdict.connection, cost: this.limited ? cost : 0 };
  }

  removeConnection(id: string): boolean {
    const index = this.state.connections.findIndex((c) => c.id === id);
    if (index < 0) return false;
    this.state.connections.splice(index, 1);
    this.rebuild();
    return true;
  }

  /** What would grow at a spot (reeds on wet ground, a grove elsewhere), or why nothing can. */
  canPlant(at: Vec): PlantResult {
    const fail = (reason: string): PlantResult => ({ ok: false, reason, at });
    const board = this.board;
    const veiled = this.veiled(at);
    if (veiled) return fail(veiled);
    const kind = plantKindAt(board, at);
    const r = kind === 'reeds' ? REEDS_RADIUS : GROVE_RADIUS;
    if (at.x < r || at.y < r || at.x > board.width - r || at.y > board.height - r) return fail('That is beyond the valley.');
    if (board.sea && at.y > board.sea.y - 40) return fail('Nothing will take root in salt sand.');
    if (zoneAt(board, at)) return fail('Nothing will take root on bare rock.');
    // Reeds like the water's edge; trees want dry feet.
    const shore = this.river.edgeDistance(at);
    if (kind === 'reeds' ? shore < 8 : shore < r * 0.75) return fail(kind === 'reeds' ? 'Reeds cannot root in the stream itself.' : 'Too close to the water for a grove.');
    const near = board.places.find((place) => dist(at, place) < place.radius + r + 14);
    if (near) return fail(`Too close to ${near.name}.`);
    if (board.fords.some((ford) => dist(at, ford) < ford.radius + r)) return fail('That would crowd the stepping stones.');
    if (this.connections.some((c) => c.line.nearest(at).d < (c.type === 'path' ? r * 0.9 : r * 0.4))) return fail('A route already runs here.');
    if (this.limited && this.state.marks < COST_PLANT) return { ok: false, reason: this.shortOf(COST_PLANT, ''), at: null };
    const plant: PlantData = { id: `g${this.state.nextId}`, kind, x: Math.round(at.x), y: Math.round(at.y) };
    return { ok: true, place: plantedPlace(plant), cost: this.limited ? COST_PLANT : 0 };
  }

  /** Plants a grove or a reed bed: somewhere for deer to shelter, corridors to meet, and birds to rest. */
  plant(at: Vec): PlantResult {
    const result = this.canPlant(at);
    if (!result.ok) return result;
    this.state.nextId++;
    this.state.planted.push({ id: result.place.id, kind: result.place.kind === 'reeds' ? 'reeds' : 'grove', x: result.place.x, y: result.place.y });
    this.spend(COST_PLANT);
    this.rebuild();
    return result;
  }

  /** Whether stepping stones could be laid at a spot on the river, or why not. */
  canLayStones(at: Vec): StonesResult {
    const hit = this.river.nearest(at);
    const fail = (reason: string): StonesResult => ({ ok: false, reason, at: hit.point });
    const veiled = this.veiled(hit.point);
    if (veiled) return fail(veiled);
    if (hit.d > hit.half + 10) return fail('Stepping stones belong in the water.');
    if (hit.half * 2 > STONES_MAX_WIDTH) return fail('The river runs too wide and deep here for stepping stones.');
    if (zoneAt(this.board, hit.point)) return fail('The water runs too fast between the rocks.');
    const near = this.board.fords.find((ford) => dist(hit.point, ford) < ford.radius + 90);
    if (near) return fail(`${near.name.charAt(0).toUpperCase()}${near.name.slice(1)} are just here.`);
    if (this.limited && this.state.marks < COST_STONES) return { ok: false, reason: this.shortOf(COST_STONES, ''), at: null };
    const ford = laidFord({ id: `s${this.state.nextId}`, x: Math.round(hit.point.x), y: Math.round(hit.point.y) });
    return { ok: true, ford, cost: this.limited ? COST_STONES : 0 };
  }

  /** Lays stepping stones: a new place for deer or villagers to cross, which fish will avoid while it is in use. */
  layStones(at: Vec): StonesResult {
    const result = this.canLayStones(at);
    if (!result.ok) return result;
    this.state.nextId++;
    this.state.stones.push({ id: result.ford.id, x: result.ford.x, y: result.ford.y });
    this.spend(COST_STONES);
    this.rebuild();
    return result;
  }

  /** Takes up stones the player laid. Refused while a route still crosses on them. */
  removeStones(id: string): { ok: true } | { ok: false; reason: string } {
    const index = this.state.stones.findIndex((s) => s.id === id);
    if (index < 0) return { ok: false, reason: 'Those stones were here before you.' };
    if (this.connections.some((c) => c.crossings.some((x) => x.ford?.id === id))) return { ok: false, reason: 'A route still crosses on these stones.' };
    this.state.stones.splice(index, 1);
    this.rebuild();
    return { ok: true };
  }

  /** Whether an old river bed can be opened, or why not. */
  canOpen(id: string): OpenResult {
    const bed = this.river.beds.find((b) => b.id === id);
    if (!bed) return { ok: false, reason: 'That channel already runs.', at: null };
    const veiled = this.veiled(...bed.line.points);
    if (veiled) return { ok: false, reason: veiled, at: null };
    // Deer cannot wade a channel, so opening one must not cut a corridor. Footpaths are simply bridged.
    for (const corridor of this.connections) {
      if (corridor.type !== 'corridor') continue;
      const cut = polylineIntersections(corridor.line, bed.line)[0];
      if (cut) return { ok: false, reason: 'The deer cross this bed. Water here would cut their way.', at: cut };
    }
    // Nothing the player has made may be lost to the water: try every route against the river as it would be.
    this.river.setOpened([...this.state.opened, id]);
    let lost: Verdict | null = null;
    const kept: Connection[] = [];
    for (const data of this.state.connections) {
      const verdict = buildConnection(this.board, this.river, data, kept);
      if (!verdict.ok) {
        lost = verdict;
        break;
      }
      kept.push(verdict.connection);
    }
    this.river.setOpened(this.state.opened);
    if (lost && !lost.ok) return { ok: false, reason: `A route crosses this bed, and with water in it: ${lost.reason.charAt(0).toLowerCase()}${lost.reason.slice(1)}`, at: lost.at };
    if (this.limited && this.state.marks < COST_CHANNEL) return { ok: false, reason: this.shortOf(COST_CHANNEL, 'Opening a channel takes'), at: null };
    return { ok: true, cost: this.limited ? COST_CHANNEL : 0 };
  }

  /** Lets the river into one of its old beds. Fish can then swim it; footpaths across it are bridged. */
  openChannel(id: string): OpenResult {
    const result = this.canOpen(id);
    if (!result.ok) return result;
    this.state.opened.push(id);
    this.spend(COST_CHANNEL);
    this.rebuild();
    return result;
  }

  /** Removes a planting, and with it any corridor that ended there. */
  removePlant(id: string): boolean {
    const index = this.state.planted.findIndex((p) => p.id === id);
    if (index < 0) return false;
    this.state.planted.splice(index, 1);
    this.state.connections = this.state.connections.filter((c) => c.from !== id && c.to !== id);
    this.rebuild();
    return true;
  }

  /** A copy of the player's mark on the valley, for undo. */
  landscape(): Landscape {
    return {
      identities: { ...this.state.identities },
      connections: this.state.connections.map((c) => ({ ...c, control: c.control.map((p) => ({ ...p })) })),
      planted: this.state.planted.map((p) => ({ ...p })),
      opened: [...this.state.opened],
      stones: this.state.stones.map((s) => ({ ...s })),
    };
  }

  /** Restores an earlier landscape (undo/redo) and returns `refund` strokes to the allowance. */
  restore(landscape: Landscape, refund: number): void {
    this.state.identities = { ...(landscape.identities ?? {}) };
    this.state.connections = landscape.connections.map((c) => ({ ...c, control: c.control.map((p) => ({ ...p })) }));
    this.state.planted = landscape.planted.map((p) => ({ ...p }));
    this.state.opened = [...landscape.opened];
    this.state.stones = landscape.stones.map((s) => ({ ...s }));
    this.state.strokes = Math.max(0, this.state.strokes - refund);
    if (this.limited && refund !== 0) {
      this.state.marks = Math.max(0, this.state.marks + refund);
      this.events.emit('marks', { marks: this.state.marks });
    }
    this.rebuild();
  }

  private shortOf(cost: number, lead: string): string {
    const left = this.state.marks;
    if (cost <= 1 || !lead) return 'No brushstrokes left this season. More arrive with the next.';
    return `${lead} ${cost} brushstrokes, and ${left === 0 ? 'none are' : left === 1 ? 'only one is' : `only ${left} are`} left this season.`;
  }

  private spend(cost: number): void {
    if (cost === 0) return;
    this.state.strokes += cost;
    if (!this.limited) return;
    this.state.marks -= cost;
    this.events.emit('marks', { marks: this.state.marks });
  }

  /** Re-derives the valley from the saved landscape and re-homes travellers. */
  private rebuild(): void {
    this.river.setOpened(this.state.opened);
    const fords = this.board.fords;
    fords.length = 0;
    fords.push(...this.authored.fords, ...this.state.stones.map(laidFord));
    const places = this.board.places;
    places.length = 0;
    places.push(...this.authored.places.map((p) => {
      const choice = identityFor(p.id, this.state.identities[p.id]);
      return choice ? { ...p, identity:choice.id, links: [...choice.links], rest: choice.rest, note: `${choice.title}. ${choice.needs} ${choice.tradeoff}` } : { ...p, links: [...p.links] };
    }), ...this.state.planted.map(plantedPlace));
    const riverRole = this.state.identities['seseragi-pool'];
    const pool = places.find((p) => p.id === 'seseragi-pool');
    this.board.weirs = [...(this.authored.weirs ?? [])];
    if (pool && ['fishing-reach', 'mill-reach'].includes(riverRole)) {
      const hit = this.river.nearest(pool);
      // The landing is on the west bank, not in the navigable fish pool.
      const bank = { x: hit.point.x - hit.half - 42, y: hit.point.y + 55 };
      places.push({ id:'fuchi-landing', name:'Fuchi Landing', kind:'landing', ...bank, radius:55, links:['path'], note:'A village footpath reaches the bank here. The fish stay in the river.' });
      if (riverRole === 'mill-reach') this.board.weirs.push({id:'identity-mill-weir',name:'the mill weir at Fuchi',x:hit.point.x,y:hit.point.y+100});
    }

    // Each route is checked against those before it, so a saved valley obeys the same rules as a drawn one.
    const built: Connection[] = [];
    for (const data of this.state.connections) {
      if (!places.some((p) => p.id === data.from) || !places.some((p) => p.id === data.to)) continue;
      const verdict = buildConnection(this.board, this.river, data, built);
      // A saved route that no longer validates (the board changed between versions) is dropped quietly.
      if (verdict.ok) built.push(verdict.connection);
    }
    this.connections = built;
    this.state.connections = built.map(toData);

    // Travellers on a route that was reshaped follow its new line; those on a route that is gone give up.
    const byId = new Map(built.map((c) => [c.id, c]));
    const season = this.season;
    for (const agent of this.agents) {
      let lost = false;
      agent.legs = agent.legs.map((leg) => {
        if (!leg.connection) return leg;
        const connection = byId.get(leg.connection.id);
        if (!connection) {
          lost = true;
          return leg;
        }
        const reversed = leg.from > leg.to;
        return { ...leg, connection, line: connection.line, from: reversed ? connection.line.length : 0, to: reversed ? 0 : connection.line.length };
      });
      if (lost) {
        agent.done = true;
        continue;
      }
      agent.along = Math.min(agent.along, legLength(agent.legs[agent.leg]!));
      if (agent.turnAt !== null) agent.turnAt = Math.min(agent.turnAt, legLength(agent.legs[agent.legs.length - 1]!));
      this.checkLegAhead(agent, season);
    }
    for (let i = this.agents.length - 1; i >= 0; i--) if (this.agents[i]!.done) this.agents.splice(i, 1);
    this.reported.clear();
    this.events.emit('network', {});
  }
}

/** Length of the final leg: where a scout that reaches the end of its legs turns back. */
const lastLength = (legs: readonly Leg[]): number => (legs.length ? legLength(legs[legs.length - 1]!) : 0);

const toData = (c: ConnectionData): ConnectionData => ({
  id: c.id,
  type: c.type,
  from: c.from,
  to: c.to,
  control: c.control.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 })),
});

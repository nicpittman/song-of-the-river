/**
 * The authored description of a valley. Boards are plain data: the renderer
 * and the simulation contain no level-specific logic.
 *
 * Units are world pixels (32 px ≈ 1 m). +y points downstream, toward the
 * viewer; the mountains are at the top of every board.
 */

import type { Vec } from '../core/math';

export const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;
export type Season = 0 | 1 | 2 | 3;
export const SPRING: Season = 0;
export const SUMMER: Season = 1;
export const AUTUMN: Season = 2;
export const WINTER: Season = 3;

/** What the player can draw. Each type serves one kind of traveller. */
export type ConnectionType = 'corridor' | 'path';
/**
 * Who travels. Deer and villagers walk the player's connections. Fish swim the
 * river itself, and birds fly between resting places, so neither needs a drawn line.
 */
export type Traveller = 'deer' | 'villager' | 'fish' | 'bird';
export type LandTraveller = 'deer' | 'villager';

export const TRAVELLER_USES: Record<LandTraveller, ConnectionType> = { deer: 'corridor', villager: 'path' };

/**
 * `grove` and `reeds` are what the player plants; the rest are authored.
 * `water` marks a spot on the river that fish travel between (a pool, the river mouth);
 * `wetland` is marsh where birds rest.
 */
export type PlaceKind =
  | 'forest' | 'meadow' | 'wetland' | 'water'
  // Places people have made. Scenery is kept clear of them so they read as clearings.
  | 'village' | 'terrace' | 'orchard' | 'fields' | 'landing' | 'shrine'
  // What the player plants.
  | 'grove' | 'reeds';

/** Kinds of place that are kept open: no trees are scattered into them. */
export const CLEARINGS: readonly PlaceKind[] = ['village', 'terrace', 'orchard', 'fields', 'landing', 'shrine'];

export interface Blob {
  x: number;
  y: number;
  r: number;
}

/** A named landscape feature that connections can start or end at. */
export interface PlaceDef {
  identity?: string;
  id: string;
  name: string;
  kind: PlaceKind;
  x: number;
  y: number;
  radius: number;
  /** Connection types this place accepts, most natural first. */
  links: ConnectionType[];
  /** One line shown when the place is selected. */
  note: string;
  /** True where migrating birds can rest: wetlands, woods, anything the player plants. */
  rest?: boolean;
}

/** A river channel: a centreline with a width at each control point, listed from source to mouth. */
export interface ChannelDef {
  id: string;
  points: Array<[x: number, y: number, width: number]>;
  /**
   * An old, silted-up bed. It carries no water until the player opens it
   * (the one piece of river-shaping the game allows).
   */
  closed?: boolean;
  /** What the player sees when an old bed is selected or opened. */
  name?: string;
  /** Seasons in which the channel runs too shallow for fish. */
  dry?: Season[];
}

/**
 * Low ground beside the river that goes under water when the river is high.
 * Routes across it are closed while it floods, and only reeds will grow on it.
 */
export interface FloodplainDef {
  id: string;
  name: string;
  blobs: Blob[];
  /** Seasons in which the river covers it: spring (the melt), autumn (the rains), or both. */
  floods: Season[];
  /**
   * Old channels that carry the high water away once the player opens them.
   * With any one of them open, this ground stays dry all year.
   */
  relievedBy?: string[];
}

/** Something built across the river that fish cannot pass. */
export interface WeirDef {
  id: string;
  name: string;
  x: number;
  y: number;
}

/** A natural shallows where stepping stones let travellers cross without a bridge. */
export interface FordDef {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  /** Seasons in which high water covers the stones. */
  floods: Season[];
}

/** Ground no land connection can pass through. */
export interface ZoneDef {
  id: string;
  name: string;
  blobs: Blob[];
  /** Gentle explanation shown when a drawn route enters the zone. */
  reason: string;
}

export interface HillDef extends Blob {
  /** Added altitude at the centre, in the same 0..1 units as `altitude()`. */
  h: number;
}

export type GroundMaterial = 'woodland' | 'wetland' | 'rocky' | 'orchard' | 'scree';

export interface PatchDef {
  material: GroundMaterial;
  blobs: Blob[];
}

export interface SpriteDef {
  asset: string;
  x: number;
  y: number;
  scale?: number;
  flip?: boolean;
}

/**
 * A body of woodland. Trees are massed so their canopies overlap, tallest in
 * the heart of the wood and stepping down through smaller trees to shrubs at
 * an irregular edge. The same shape lays woodland floor on the ground, so the
 * wood and the land under it always agree.
 */
export interface WoodsDef {
  blobs: Blob[];
  /** Tree mix: `mixed` broadleaf and conifer, `pine` upland conifers, `broadleaf` lowland. */
  kind: 'mixed' | 'pine' | 'broadleaf';
  /** Typical distance between trunks in the heart of the wood. Smaller is denser. */
  spacing: number;
  /** Size multiplier for the trees. */
  scale: number;
}

/** A strip of bare, trodden or tilled earth. Lanes are scenery; nothing travels them by rule. */
export interface LaneDef {
  points: Vec[];
  /** Width in world pixels. Defaults to a cart-track's 44; furrows are much narrower. */
  width?: number;
  /** Painted wear only; a grassy old track remains a usable walking route. */
  wear?: number;
  ruts?: boolean;
}

/** A natural group of rocks around a point: a few large stones with smaller ones gathered at their feet. */
export interface OutcropDef extends Vec {
  /** Roughly how many stones. */
  size: number;
  /** How far the group spreads. */
  spread: number;
}

/** Scatter `count` sprites over a set of blobs, keeping `spacing` apart and out of the water. */
export interface ScatterDef {
  /** Asset ids with relative weights. */
  assets: Array<[id: string, weight: number]>;
  blobs: Blob[];
  count: number;
  spacing: number;
  scale: [min: number, max: number];
}

/** Decoration strung along both banks of a channel. */
export interface BankDef {
  channel: string;
  assets: Array<[id: string, weight: number]>;
  /** Average distance between items along the bank. */
  every: number;
  /** Distance from the water's edge; negative values stand items in the shallows. */
  offset: [min: number, max: number];
  /** Room each item claims, so banks can be lined densely or sparsely. Defaults to 26. */
  spacing?: number;
  scale: [min: number, max: number];
  /** Only between these fractions of the channel's length. */
  span?: [from: number, to: number];
}

/** A recurring trip that inhabitants want to make. */
export interface JourneyDef {
  id: string;
  traveller: Traveller;
  from: string;
  to: string;
  /** Seasons in which travellers set out. */
  seasons: Season[];
  /** Seconds between departures. */
  every: number;
  /** Index of the reach this journey belongs to; nobody sets out on it until that reach has opened. */
  reach?: number;
}

/**
 * A wish: something the valley's inhabitants want to do in one season of the
 * year. Granting every wish completes the valley.
 */
/**
 * A stretch of the valley, from the mountains down. In Journey mode each reach
 * is a chapter: the ones below lie under mist until the one above is complete.
 */
export interface ReachDef {
  id: string;
  name: string;
  subtitle: string;
  /** World y where this reach ends and the next begins. */
  bottom: number;
  /** Brushstrokes within which a graceful solution to this reach fits. */
  par: number;
  /** First hint shown when the reach opens. */
  opening: string;
}

export interface ObjectiveDef {
  id: string;
  title: string;
  /** Short description for the wish card. */
  text: string;
  /** A sentence for the journal, written once the wish has been granted. */
  story: string;
  journey: string;
  season: Season;
  /** Travellers who must set out in `season` and arrive. */
  count: number;
  /**
   * What appears in the valley once the wish is granted, and stays: lanterns
   * on the terrace, a herd at rest in the wood. The reward is in the world.
   */
  flourish?: SpriteDef[];
  /** Index of the reach this wish belongs to; it is not asked for until that reach has opened. */
  reach?: number;
}

export interface BoardDef {
  id: string;
  name: string;
  subtitle: string;
  width: number;
  height: number;
  seed: number;
  /** Ground above this altitude is snowbound in winter. See `altitude()`. */
  snowAltitude: number;
  /** Rises that count as high ground: they lift `altitude()` and so hold winter snow. */
  hills: HillDef[];
  /** Landforms that shape how the ground is painted (ridges, knolls, bluffs) without changing the rules. */
  relief: HillDef[];
  channels: ChannelDef[];
  /** Land standing in the river: gravel bars and wooded islets. Purely scenic; routes ignore them. */
  islands: Blob[];
  /** Stretches of clear, shallow water over a pale bed. Fords are shallow without being listed here. */
  shallows: Blob[];
  fords: FordDef[];
  /** Widest water a footbridge can span. */
  maxBridgeSpan: number;
  zones: ZoneDef[];
  places: PlaceDef[];
  patches: PatchDef[];
  woods: WoodsDef[];
  outcrops: OutcropDef[];
  /** Worn ground around settlements: lanes, yards and furrows that are part of the scenery, not routes. */
  lanes: LaneDef[];
  sprites: SpriteDef[];
  scatter: ScatterDef[];
  banks: BankDef[];
  /** Water meadows: ground the river takes back when it rises. */
  floodplains?: FloodplainDef[];
  /** Weirs on the river. Fish must find a way round them. */
  weirs?: WeirDef[];
  /** How far a flock will fly between resting places, in world pixels. */
  flight?: number;
  /** Where a fire is lit in the cold months. */
  hearths: Vec[];
  journeys: JourneyDef[];
  objectives: ObjectiveDef[];
  /**
   * One set of routes that completes the valley. It proves the board is
   * solvable (the tests play it through) and furnishes the valley behind the menu.
   */
  solution: Array<{ type: ConnectionType; from: string; to: string; control: Vec[] }>;
  /** Brushstrokes within which a graceful solution fits; earns the third blossom. */
  par: number;
  /**
   * The valley's reaches, from the mountains down, if it has more than one.
   * A valley without this is a single reach covering the whole board.
   */
  reaches?: ReachDef[];
  /**
   * The distance over which the land falls from the mountains to the plain;
   * `altitude()` measures height against it. Defaults to the board's height.
   * A long valley sets it to the length of its upper reach, so only that reach is high ground.
   */
  altitudeSpan?: number;
  /** Where the river meets the sea: everything below this line is open water. */
  sea?: { y: number };
  /** Number of years the Journey mode allows before the valley is assessed. */
  years: number;
  /** First hint shown in Journey mode. */
  opening: string;
}

export type { Vec };

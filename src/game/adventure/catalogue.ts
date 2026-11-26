/**
 * The shapes of authored content: places, the things that can be found at
 * them, the leads that point from one to another, and what the friends learn
 * by going. The content itself lives in `places/`, one file per reach.
 */

import type { Vec } from '../core/math';
import type { Activity, JournalCategory, PlaceKind, PlaceState, StructureKind, WaterLevel, Weather } from './model';
import type { Way } from './course';

/** When something holds. Every listed field must match; an empty object always holds. */
export interface Conditions {
  /** 0 spring, 1 summer, 2 autumn, 3 winter. */
  seasons?: number[];
  levels?: WaterLevel[];
  weather?: Weather[];
  /** A building that must be finished, or a planting that must be grown. */
  structure?: StructureKind;
  /** Only in a year whose way down from Mio is this one (words that would otherwise hint at another year's way). */
  way?: Way;
  /** Only in a Journey: words about its promises, never true in Free Play. */
  journey?: boolean;
}

/** Stepping stones and crossings. Each is open at some water levels; the bridge whenever built. */
export type Crossing = 'high-stones' | 'middle-stones' | 'brook-stones' | 'low-stones' | 'mio-bridge' | 'estuary-bridge';

/** A rule that makes a place closed or special. The first that holds wins. */
export interface PlaceRule {
  when: Conditions;
  state: Exclude<PlaceState, 'open'>;
  /** Shown on the map and in the place card: "Under water until the river falls." */
  line: string;
  /** Added to the odds of outings here while it holds (special places only). */
  odds?: number;
  /** The forecast reason for `odds`, without its sign: "Salmon running on the melt". */
  reason?: string;
  /** Limits `odds` to these activities. */
  activities?: Activity[];
  /** Knowledge and a nearby work can supply an alternative to this closure. */
  bypass?: { find: string; structure: StructureKind; within?: number; line: string; via?: Vec };
}

/** Something the friends can come to know about a place by going there. */
export interface LearnDef {
  text: string;
  /** Names an observation another find can be worked out from (see `FindDef.knowing`). */
  id?: string;
  /** A dependable geographical clue, recorded by this observation rather than a reward roll. */
  hearsOf?: string[];
  /** Learned only by an outing of this kind. */
  activity?: Activity;
  /** Learned only on a day when this holds. */
  when?: Conditions;
  person?: string;
}

export interface PlaceDef {
  id: string;
  /** A proper name, used the same way in every line: "Fuchi", "Hanano". */
  name: string;
  /** Settlements are set large, minor spots small; ordinary places if omitted. */
  kind?: PlaceKind;
  region: number;
  /** Where the friends stand to work, on walkable ground (or ground the low water uncovers). */
  at: Vec;
  /** Optional landmark anchor; expeditions still use the dry standing point in `at`. */
  marker?: Vec;
  /** For the place sketch: `place-<habitat>`. */
  habitat: string;
  note: string;
  /** One evocative line naming the place, a reason to walk there tomorrow: "Someone keeps a kiln at Sumiyaki, in the western pines." */
  teaser?: string;
  activities: Activity[];
  /** More that can be done here only in Free Play, e.g. calling on Sora at his hut. */
  freeActivities?: Activity[];
  /** Stones or a bridge that must be passable to get here. */
  crossing?: Crossing;
  rules?: PlaceRule[];
  /** A second spot a little farther on, for long outings and followed forks. */
  farther?: { name: string; at: Vec; lines: string[] };
  /** Beat lines by activity, three to eight words each. Generic lines fill any gaps. */
  lines: Partial<Record<Activity, string[]>>;
  /** Supplies an ordinary outing brings home, by activity, before gifts and weather. */
  yields?: Partial<Record<Activity, number>>;
  learn: LearnDef[];
}

export interface SightingDef {
  /** Spots in the valley where it may show. Empty means beside the building or planting its conditions name. */
  near: Vec[];
  /** The tag beside it: "A dipper bobbing on the stones". */
  line: string;
  /**
   * A rare moment: it shows only when this holds as well as the find's own
   * `when` (cranes in the stubble on a misty or snowy day once the cold comes).
   * Its hint names both, softly.
   */
  moment?: Conditions;
}

export interface FindDef {
  id: string;
  name: string;
  /** The journal entry, one or two short sentences. */
  text: string;
  /** The entry in Free Play, where it differs (a friend who joins without the Journey's promise). */
  freeText?: string;
  category: JournalCategory;
  region: number;
  rare?: boolean;
  /** Places named by this discovery, without another lucky roll. */
  reveals?: string[];
  /**
   * Needed by the story. Certain whenever the right kind of outing goes to the
   * right place in ordinary conditions, and its forecast says why.
   */
  story?: { reason: string };
  /** Time at the destination needed to survey it, after all walking is reserved. */
  survey?: number;
  reward?: { provisions?: number; materials?: number };
  /** Places it can be brought home from. Omit for things that are only sketched. */
  at?: string[];
  /** Kinds of outing that can bring it home; any listed at the place if omitted. */
  activities?: Activity[];
  /** Only on the farther-on part of a long outing or a followed fork. */
  farther?: boolean;
  when?: Conditions;
  /** Another find that must be in the journal first. */
  after?: string;
  /** Another find that settles the same need: once it is in the journal, this one is no longer offered. */
  unless?: string;
  /** The daytime tag when it goes into the pack, without naming it: "Something silver in the deep water." */
  tag: string;
  /** A gentle pointer while it is still unfound: "When the melt brings them up." */
  hint: string;
  /**
   * Worked out rather than stumbled on. Once any of `clues` is known (a find in
   * the journal, or a learned line with that `id`), going as the clue suggests
   * brings this home for certain; `line` is said at the fire, `{name}` being
   * whoever found it. Without the clue it comes only by luck, and rarely.
   */
  knowing?: { clues: string[]; line: string };
  /** Can show in the valley for a moment and be sketched. */
  sighting?: SightingDef;
  /** A sign of this creature: once it is home, the creature shows itself the next day. */
  follows?: string;
}

/**
 * A lead: a friend notices something at one place that will be worth going to
 * another for. Following it while it holds makes the find certain.
 */
export interface LeadDef {
  id: string;
  /** Knowledge needed before these directions can be offered. */
  after?: string;
  /** Places where it can be noticed; 'camp' means by anyone who stays by the fire. */
  from: string[];
  /** When it can be noticed. */
  when: Conditions;
  to: string;
  find: string;
  /** The line by the fire, and on the map: "A gravel bar will show below Fuchi when the water drops." */
  line: string;
  /** The lead holds through the first run of days, from tomorrow on, when this holds and the place is open. */
  holds: Conditions;
}

export interface RegionContent {
  places: PlaceDef[];
  finds: FindDef[];
  leads: LeadDef[];
}

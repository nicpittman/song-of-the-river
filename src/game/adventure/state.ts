/**
 * The expedition's saved state: one plain JSON object, the single source of
 * truth. Everything the player sees is derived from it (see `view.ts` and
 * `scene.ts`); nothing else needs saving. Purely cosmetic motion, such as the
 * friends pottering about the settlement, is computed from the clock and
 * never stored.
 */

import { FREE_PLAY_START } from './discovery';
import { USUAL_COURSE, type Course } from './course';
import type { Vec } from '../core/math';
import type { Activity, DaySummary, DayPhase, Equipment, MorningReport, OutingPlan, PackHint, Pose, StructureKind, UnpackItem } from './model';
import { ECONOMY } from './economy';
import { FOUNDERS, FREE_PLAY_GROUP, FREE_PLAY_HOMES } from './people';
import { FREE_OPENING } from './places/freeplay';
import { OPENING } from './narrative';

/** Bump when the shape changes; older adventure saves are then started afresh. */
export const ADVENTURE_VERSION = 9;

export interface Person {
  id: string;
  base: number;
  lodging?: number | string;
  /** Outings completed, by activity. */
  practice: Partial<Record<Activity, number>>;
  /** Newest first, at most five. */
  memories: string[];
  /** The day they said, by the fire, the one small thing they would like built (see `wishes.ts`). */
  wish?: number;
}

/** One stretch of a friend's day: a walk, or a beat spent doing something in one spot. */
export interface Leg {
  kind: 'walk' | 'beat';
  /** Seconds into the day. */
  start: number;
  end: number;
  /** The route, for a walk. */
  points?: Vec[];
  /** Where a beat happens. */
  at?: Vec;
  pose: Pose;
  /** The beat's paper tag. */
  text?: string;
  sketch?: string | null;
  /** The pack shows its knot from this leg on. */
  reveal?: boolean;
  /** A beat that is a fork, waiting for an answer. */
  fork?: boolean;
}

export type Bundle = (
  | { kind: 'supplies'; amount: number }
  | { kind: 'materials'; amount: number }
  | { kind: 'find'; find: string }
  | { kind: 'lead'; lead: string }
  | { kind: 'nothing' }) & { sourcePlace?: string; sourceActivity?: Activity };

/** What happens after a fork. */
export type ForkEffect = 'follow' | 'stay' | 'back';

export interface Fork {
  text: string;
  choices: string[];
  /** Index into `choices`, once answered (by the player, or by the friend’s nature). */
  answer: number | null;
}

export interface Outing extends OutingPlan {
  /** Fixed at the start of the day. */
  score: number;
  certain: boolean;
  /** Whether the outing went on to the farther spot. */
  farther: boolean;
  legs: Leg[];
  /** Decided when the last legs are laid; hidden from the player until the evening. */
  bundles: Bundle[];
  pack: PackHint | null;
  fork: Fork | null;
}

export interface Building {
  id: number;
  kind: StructureKind;
  x: number;
  y: number;
  region: number;
  /** Days of work done. */
  work: number;
  /** The day it was placed; plantings grow from this. */
  placed: number;
  /** Actual contributors, retained through an in-flight save for the evening account. */
  worked?: { day: number; by: string[] };
}

export interface Lead {
  id: string;
  place: string;
  find: string;
  line: string;
  given: number;
  /** The last day it holds. */
  expires: number;
}

export interface Sighting {
  id: string;
  find: string;
  at: Vec;
  /** Seconds into the day when it shows, and for how long. */
  appear: number;
  life: number;
  sketched: boolean;
  /** Seconds into the day when it was sketched, for the brief confirmation. */
  sketchedAt?: number;
}

/** Two friends' paths crossing today: they stop a moment and talk (see `crossings.ts`). */
export interface Crossing {
  id: string;
  /** Who speaks first, and who answers. */
  a: string;
  b: string;
  /** The moment on their walks where they meet, and the seconds they talk. */
  at: number;
  from: number;
  to: number;
  /** Where their legs' clock stands at `from` and at `to`: the same moment to stand still, a little apart to stroll on as they talk. */
  held: [number, number];
  /** For `a` and `b`, the stretch of their day the moment is made up within (see `crossingClock`). */
  spans: [[number, number], [number, number]];
  /** Which exchange from `crossingLines.ts`. */
  exchange: string;
}

/** A small thing glinting by a friend's path today (see `glints.ts`). */
export interface Glint {
  id: string;
  /** Which small find (see `smallFinds.ts`). */
  find: string;
  at: Vec;
  appear: number;
  life: number;
  /** Whose path it glints by. */
  person: string;
  found: boolean;
  /** Seconds into the day when it was looked at, for the brief confirmation. */
  foundAt?: number;
}

/** What setting down a bundle by the fire does. */
export interface UnpackEffect {
  person: string;
  provisions: number;
  materials: number;
  find: string | null;
  lead: Lead | null;
}

export interface Evening {
  items: UnpackItem[];
  effects: UnpackEffect[];
  shown: number;
  tomorrow: string;
  /** Chore status under the lead ("Two more days on the cottage."). */
  tomorrowNote?: string;
  /** The place the lead names. */
  tomorrowPlace?: string;
  /** Tomorrow's river sign, read at dusk: the same line the morning will show. */
  tomorrowSign?: string;
  settled: boolean;
}

export interface Note {
  id: number;
  day: number;
  text: string;
}

export interface FarewellWalk {
  person: string;
  points: Vec[];
  /** Seconds the walk to the boat takes. */
  seconds: number;
}

export interface AdventureState {
  version: typeof ADVENTURE_VERSION;
  /** What this run settled when it began: where Ren and Mina are found, and the way down from Mio. */
  course: Course;
  /** Free Play: the whole river open from the first morning, friends met by wandering, no story gates. */
  free: boolean;
  day: number;
  phase: DayPhase;
  /** Seconds into the current phase (daylight, the evening fire, or the night). */
  elapsed: number;
  /** "Skip to evening": the rest of the day runs quickly, with the same result. */
  hurry: boolean;
  region: number;
  provisions: number;
  materials: number;
  dayStart: { provisions: number; materials: number; packed?: number };
  history: DaySummary[];
  people: Person[];
  plans: OutingPlan[];
  resting: string[];
  /** Project worked on today, also retained after its last beam is fitted. */
  workedOn: number | null;
  outings: Outing[];
  buildings: Building[];
  equipment: Equipment[];
  /** Places on the map. */
  known: string[];
  /** Places heard of but not yet found: only exploring goes there. */
  rumoured: string[];
  visits: Record<string, number>;
  /** Learned lines, by place, as indices into the place’s `learn` list, in the order learned. */
  learned: Record<string, number[]>;
  /** Journal entries found: the day, and who (a friend’s id, or 'sketch'). */
  discoveries: Record<string, { day: number; by: string }>;
  leads: Lead[];
  /** Every lead ever given, so none is given twice. */
  given: string[];
  sightings: Sighting[];
  /** Today's crossings of paths. */
  crossings: Crossing[];
  /** Exchanges said lately, newest last, so the same words are not heard again soon. */
  heard: string[];
  /** Today's glint, if any. */
  glints: Glint[];
  /** Small finds noticed by a glint: the day, whose path, and the place they were bound for. */
  smallFinds: Record<string, { day: number; person: string; place: string }>;
  /** Creatures whose signs were brought home: they show themselves the next day. */
  tracked: string[];
  evening: Evening | null;
  morning: MorningReport | null;
  /** News gathered by the fire for tomorrow morning’s report. */
  news: string[];
  /** Places revealed today, for tomorrow morning’s report. */
  revealed: string[];
  /** The way on is open: tomorrow everyone goes down to the next settlement. */
  moving: boolean;
  notes: Note[];
  /** Beat lines used lately, so the same words are not seen again soon. */
  recent: string[];
  nextId: number;
  voyage: 'preparing' | 'gathering' | 'sailing' | 'ended';
  voyageTime: number;
  companions: string[];
  farewell: FarewellWalk[];
  /** The boat has been out past the bar at least once. */
  sailed: boolean;
  /** Free Play's almanac: the year it was written for (counted from the first spring), its finds, and the season each belongs to (-1 for a friend to meet). */
  almanac: { year: number; finds: string[]; seasons: number[] };
  /** This Journey opens Wander when it reaches Mio, and the journal says so that evening. */
  opensWander: boolean;
}

/** A new journey from the mountain hut; `free` for Free Play, `groupStart` for an established group already in Seseragi (tests). */
export function newAdventure(free = false, groupStart = false, course: Course = USUAL_COURSE): AdventureState {
  const mountain = !free && !groupStart;
  return {
    version: ADVENTURE_VERSION,
    course,
    free,
    day: 1,
    phase: 'morning',
    elapsed: 0,
    hurry: false,
    region: free ? 1 : 0,
    provisions: ECONOMY.startingProvisions,
    materials: ECONOMY.startingMaterials,
    dayStart: { provisions: ECONOMY.startingProvisions, materials: ECONOMY.startingMaterials },
    history: [],
    // Free Play begins with Haru and Yui at Mio; the others join when someone visits them.
    people: (free ? [...FREE_PLAY_GROUP] : mountain ? ['sora'] : [...FOUNDERS]).map((id) => ({ id, ...(free ? FREE_PLAY_HOMES[id]! : { base: 0, ...(mountain ? { lodging: 'yamagoya' } : {}) }), practice: {}, memories: [] })),
    plans: [],
    resting: [],
    workedOn: null,
    outings: [],
    buildings: [],
    equipment: [],
    known: free ? [...FREE_PLAY_START.known] : mountain ? [...new Set(['yamagoya', 'kamimori', 'fuchi', 'taki', course.ren])] : [],
    rumoured: free ? [...FREE_PLAY_START.heard] : [],
    visits: free ? { seseragi: 1, mio: 1, kawagiri: 1 } : mountain ? { yamagoya: 1 } : {},
    learned: {},
    discoveries: {},
    leads: [],
    given: [],
    sightings: [],
    crossings: [],
    heard: [],
    glints: [],
    smallFinds: {},
    tracked: [],
    evening: null,
    morning: null,
    news: [],
    revealed: [],
    moving: false,
    notes: free ? [{ id: 1, day: 1, text: FREE_OPENING }] : !groupStart ? [{ id: 1, day: 1, text: OPENING }] : [],
    recent: [],
    nextId: free || !groupStart ? 2 : 1,
    voyage: 'preparing',
    voyageTime: 0,
    companions: [],
    farewell: [],
    sailed: false,
    almanac: { year: -1, finds: [], seasons: [] },
    opensWander: false,
  };
}

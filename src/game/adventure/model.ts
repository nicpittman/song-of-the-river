/**
 * The public face of the expedition game.
 *
 * Three parties meet here and nowhere else:
 *
 *  - the rules (`ExpeditionAdventure`) own all state and produce two snapshots:
 *    `view()` for the notebook and `scene()` for the valley;
 *  - the interface (`src/ui`) draws an `AdventureView` and sends `AdventureCommand`s;
 *  - the valley layer (`src/game/rendering/adventureLayer.ts`) draws an
 *    `AdventureScene` and answers `pick()` for the pointer.
 *
 * Snapshots are plain data, rebuilt whenever something changes. Nothing in them
 * may be mutated by the receiver. World positions are in board units.
 */

import type { Course } from './course';
import type { Vec } from '../core/math';

// ── Vocabulary ──────────────────────────────────────────────────────────────

/** `track` is Haru the hunter's gift: following animals by their signs. */
export type Activity = 'explore' | 'fish' | 'forage' | 'investigate' | 'visit' | 'track';
export type Equipment = 'walking-staff' | 'field-kit' | 'fishing-kit' | 'rain-cape';
/** `stair` is parked for the gameplay pass: the rules do not offer it yet. */
export type StructureKind = 'garden' | 'ford-bridge' | 'bridge' | 'platform' | 'shelter' | 'cottage' | 'dock' | 'lookout' | 'boat' | 'stones' | 'stair' | PlantingKind;
/** Which way a place lies from home: up toward the mountains, over the river, or on down the valley. */
export type Direction = 'upstream' | 'across' | 'downstream';
/** Things grown from finds and placed like buildings, for free. They grow over a few days. */
export type PlantingKind = 'willow' | 'fruit-tree' | 'lily-bed';
export type Weather = 'clear' | 'mist' | 'rain' | 'snow';
/** `night` is the few seconds between the evening fire and the next morning, when darkness passes over the valley. */
export type DayPhase = 'morning' | 'day' | 'evening' | 'night';

/** How the river stands today. The whole game turns on this. */
export type WaterLevel = 'low' | 'middle' | 'high';
export type WaterTrend = 'falling' | 'steady' | 'rising';

/** Odds are always shown as a word and up to three ink pips, never as a number. */
export type Chance = 'unlikely' | 'even' | 'likely' | 'certain';

/** What a friend is carrying home. Shown as a knot on their pack; opened by the fire. */
/** How remarkable a bundle is; the fire sets them down in this order, story last. */
export type PackHint = 'plain' | 'unusual' | 'rare' | 'story';

export type JournalCategory = 'wildlife' | 'fish' | 'birds' | 'plants' | 'curiosities' | 'keepsakes' | 'encounters';

// ── What the player decides ─────────────────────────────────────────────────

export interface SecondStop { place: string; activity: Activity }

/** One outing for one day. Everything optional has a sensible default. */
export interface OutingPlan {
  person: string;
  place: string;
  activity: Activity;
  /** Visit a settlement and return, rather than moving camp. */
  visitOnly?: boolean;
  /** One thing from the shared kit; each item can only go with one friend a day. */
  item: Equipment | null;
  companion: string | null;
  /** A day's walk to a finished shelter, which becomes this person's overnight base. */
  lodging?: number | string;
  /** Finish an outing at this known hut or inn instead of walking home. */
  overnight?: string;
  /** One optional shorter visit on the way home. */
  second?: SecondStop;
  /** On a moving day: a stop in the reach being left, then on to the new camp by dusk. */
  detour?: SecondStop;
}

export type NotebookPage = 'plan' | 'map' | 'journal' | 'friends' | 'make';

export type AdventureCommand =
  | { type: 'notebook'; page?: NotebookPage; person?: string; place?: string; lodging?: number | string }
  | { type: 'assign'; plan: OutingPlan }
  | { type: 'move-everyone'; place: string }
  /** On the moving morning: a stop on the way down for one friend, or none. */
  | { type: 'detour'; person: string; stop: SecondStop | null }
  | { type: 'camp'; person: string; shelter: number | string }
  | { type: 'cancel-plan'; person: string }
  | { type: 'undo-plan' }
  | { type: 'redo-plan' }
  | { type: 'recover-building'; id: number }
  /** Keep a friend by the fire today: they tend camp, help any building, and bring one supply. */
  | { type: 'rest'; person: string }
  | { type: 'begin' }
  | { type: 'travel' }
  /** Let the rest of today pass quickly (to the evening fire). */
  | { type: 'skip' }
  /** Answer a choice tag. Unanswered choices resolve by the friend's own nature. */
  | { type: 'choose'; tag: string; choice: number }
  /** Look closely at a place: pins its card in the valley. Null puts it away. Allowed at any time of day. */
  | { type: 'inspect'; place: string | null }
  /** Record a creature that is showing in the valley right now. */
  | { type: 'sketch'; sighting: string }
  /** Look at a small thing glinting by the path right now: it goes into the journal's small finds. */
  | { type: 'notice'; glint: string }
  /** Collect the day's returns for the Journal, step one bundle, or finish. */
  | { type: 'evening'; step: 'collect' | 'next' | 'finish' | 'morning' }
  | { type: 'craft'; equipment: Equipment }
  | { type: 'place'; kind: StructureKind }
  | { type: 'cancel-placement' }
  | { type: 'landscape'; enabled: boolean }
  | { type: 'focus'; point: Vec }
  /** Pan the view to a point without changing the zoom (an edge marker pointing to a creature). */
  | { type: 'look'; point: Vec }
  | { type: 'follow'; person: string }
  | { type: 'sail'; companions: string[] }
  | { type: 'continue-valley' };

// ── Snapshot for the notebook ───────────────────────────────────────────────

export interface RiverView {
  level: WaterLevel;
  trend: WaterTrend;
  /** Tomorrow's level as far as anyone can tell. */
  tomorrow: WaterLevel;
  /** One plain sentence, for example "The water has fallen. New ground lies exposed." */
  line: string;
  /** True on the morning the level has just changed, so the notebook can mark the shift. */
  shifted: boolean;
}

export interface FriendView {
  id: string;
  name: string;
  base: number;
  baseName: string;
  lodging?: number | string;
  /** "The wanderer". */
  role: string;
  colour: string;
  /** Id of an ink sketch (see `SketchId` conventions in the interface). */
  portrait: string;
  gift: Activity;
  ambition: string;
  status: 'home' | 'planned' | 'resting' | 'out' | 'building' | 'aboard';
  /** "Fishing at Fuchi pool", "At home". */
  statusLine: string;
  /** A first conversation is happening here; the portrait can quietly invite a look. */
  storyNow?: boolean;
  /** What they are carrying today, if out. */
  pack: PackHint | null;
  /** Up to five short lines, newest first. */
  memories: string[];
  /** Outings completed, by activity. Three or more reads as "practised". */
  practice: Partial<Record<Activity, number>>;
  /** Where they stand, for "find in the valley". */
  at: Vec;
  /** The one small thing they would like built, once said; or what it became. */
  wish?: { text: string; granted: boolean };
}

/** One possible find at a place. Unfound ones are drawn as dotted outlines. */
export interface FindSlot {
  id: string;
  found: boolean;
  /** Null until found. */
  name: string | null;
  sketch: string;
  rare: boolean;
  /** False when today's season, water or weather rules it out. */
  today: boolean;
  /** A gentle pointer for unfound entries, for example "After rain". Null when there is nothing to say. */
  hint: string | null;
}

export type PlaceState = 'open' | 'closed' | 'special';

/** How large the name is set: the three settlements, ordinary places, and small spots. */
export type PlaceKind = 'settlement' | 'place' | 'minor';

export interface PlaceView {
  habitat?: string;
  id: string;
  name: string;
  kind: PlaceKind;
  /** The settlement the friends live in now: shown as home, never as somewhere to send anyone. */
  home: boolean;
  /** Not yet reached: only this hint is known ("Smoke past the ridge."), and only exploring goes there. Null once found. */
  rumour: string | null;
  direction: Direction;
  region: number;
  at: Vec;
  /** One short line of description. */
  note: string;
  state: PlaceState;
  /** Why it is closed or special today: "Under water until the river falls." Null when simply open. */
  stateLine: string | null;
  activities: Activity[];
  /** An unexpired lead that points here, in one line. */
  lead: string | null;
  /** Days the lead has left, when there is one. */
  leadDays: number | null;
  finds: FindSlot[];
  visits: number;
  /**
   * What the friends have learned here so far, one plain line each, oldest first:
   * "Salmon rest here when the water is high." Grows with visits; empty before the first.
   */
  learned: string[];
}

/** What the notebook shows before the player commits to an outing. */
export interface Forecast {
  provisions?: number;
  materials?: number;
  /** Provisions reserved for the walk, separate from its expected return. */
  provisionCost?: number;
  /** Observable opportunities, independent of the short, ranked reason list. */
  newGround?: boolean;
  followingLead?: boolean;
  /** An observable reason to revisit, without naming the undiscovered reward. */
  discoveryHint?: string;
  closesTomorrow?: boolean;
  /** Null when the outing can be planned; otherwise the reason it cannot. */
  problem: string | null;
  chance: Chance;
  /** 0 to 3 filled pips; `certain` is three pips and a ring. */
  pips: 0 | 1 | 2 | 3;
  /** At most four reasons, strongest first. */
  reasons: Array<{ sign: '+' | '-'; text: string }>;
  /** "Back by midday", "A long day", "Home after dark". */
  length: string;
  /** How many beats the trail has (one to three). */
  beats: number;
}

export interface PlanView extends OutingPlan {
  forecast: Forecast;
  /** This plan moves camp (down the river, or to a village in this reach): a stop on the way is possible. */
  moving?: boolean;
}

export interface StructureView {
  id: StructureKind;
  name: string;
  /** Names of the places it opens the way to, said before the player commits. */
  opens: string[];
  cost: number;
  effect: string;
  sketch: string;
  status: 'locked' | 'available' | 'building' | 'built';
  /** Why it cannot be started, when it cannot. */
  problem: string | null;
  /** 0..1 while building. */
  progress: number;
  workRemaining: number;
  region: number;
  at: Vec | null;
  repeatable?: boolean;
  count?: number;
  builders?: string[];
  siteId?: number;
  recoverable?: number;
  /** A story work: Aki's promise, the dock, the boat. Everything else stands once placed. */
  major?: boolean;
  /** Whose quiet wish this is, once they have said it. */
  wish?: { person: string; name: string; granted: boolean };
}

export interface EquipmentView {
  id: Equipment;
  name: string;
  cost: number;
  effect: string;
  owned: boolean;
  /** Who is taking it today, if anyone. */
  with: string | null;
}

export interface JournalEntry {
  conversation?: Array<{ speaker: string; text: string }>;
  id: string;
  category: JournalCategory;
  sketch: string;
  found: boolean;
  /** Null until found. */
  name: string | null;
  text: string | null;
  rare: boolean;
  region: number;
  /** For found entries: "Day 3 · Mina". */
  credit: string | null;
  /** For unfound entries in regions already reached. */
  hint: string | null;
  /** The small collection this entry belongs to, by name ("Birds of the river"), if any. */
  set: string | null;
}

/** A small thing noticed by the way, as the journal keeps it. */
export interface SmallFindView {
  id: string;
  /** "A jay’s feather". */
  name: string;
  line: string;
  sketch: string;
  /** "Day 6 · on the way to Fuchi". */
  credit: string;
}

/** A small collection in the journal, filling as entries are found. Completing one changes something in the valley. */
export interface JournalSet {
  id: string;
  name: string;
  /** Sketch id of the set's first entry, to draw it by. */
  sketch: string;
  found: number;
  total: number;
  complete: boolean;
  /** Before it is full, what filling it may bring; once full, what came. */
  reward: string;
  came: string;
}

export interface DaySummary {
  day: number;
  provisions: number;
  /** Provisions paid at the fire, apart from travel costs. Absent in older entries. */
  supper?: number;
  /** Provisions packed before setting off. Absent in older entries. */
  packed?: number;
  materials: number;
  /** What came back from the day's outings, before supper or building. */
  gathered?: { provisions: number; materials: number };
  /** What was in the stores once supper was eaten. */
  left?: { provisions: number; materials: number };
  lines: string[];
  standout: string | null;
  items?: UnpackItem[];
  tomorrow?: string;
  tomorrowPlace?: string;
  tomorrowNote?: string;
}

export interface NoteView {
  id: number;
  day: number;
  text: string;
}

/** One bundle set down by the fire. Shown one at a time, rarest last. */
export interface UnpackItem {
  id: string;
  person: string;
  kind: 'supplies' | 'materials' | 'find' | 'lead' | 'nothing';
  hint: PackHint;
  /** "Four days of provisions", "Star moss", "Nothing unusual today". */
  title: string;
  /** One short sentence. */
  text: string;
  sketch: string | null;
  provisions: number;
  materials: number;
  /** For a story item, what came of it: "Ren joins us." */
  outcome?: string;
  /** Shared work is told once, with everyone who helped credited together. */
  contributors?: string[];
}

/** What changed overnight, for the notebook to show at a glance each morning. Names are place names. */
export interface MorningReport {
  /** The river's news, when the level has changed: "The water has fallen. The stones at Old Ford are showing again." */
  river: string | null;
  /** "Clear skies." */
  weather: string;
  /** Places that opened with the water or the season, or were found yesterday. */
  opened: string[];
  /** Places that closed. */
  closed: string[];
  /** Leads brought home last night, one line each. */
  leads: string[];
  /** Leads on their last day. */
  expiring: string[];
  /** Anything else: a building finished, someone joined, a planting grown, a new reach. */
  news: string[];
}

export interface EveningView {
  total: number;
  items: UnpackItem[];
  /** How many have been set down so far. */
  shown: number;
  /** The line about tomorrow, shown once everything is unpacked: always a place and a reason. */
  tomorrow: string;
  /** Chore status, shown small under the lead: "4 of 6 provisions packed for Mio." */
  tomorrowNote?: string;
  /** The place id the lead names, when there is one, so the line can link to it. */
  tomorrowPlace?: string;
  /** Tomorrow's river sign, the last thing the evening says. */
  tomorrowSign?: string;
}

/**
 * A small paper tag pinned to a point in the valley. The interface draws it;
 * the game projects `anchor` to the screen every frame (see `ScreenTag`).
 */
export interface TagView {
  id: string;
  /** `place` is the card of the place being inspected: `id` is the place id, and the interface fills it from the matching `PlaceView`. */
  kind: 'beat' | 'choice' | 'unpack' | 'sighting' | 'note' | 'place';
  anchor: Vec;
  person: string | null;
  sketch: string | null;
  /** Three to eight words. */
  text: string;
  /** A quieter second line under the text, such as how to keep a creature. */
  hint?: string;
  pack: PackHint | null;
  /** Two or three words each, for `choice` tags. */
  choices: string[];
  /** Seconds of game time until it slips away; 0 for tags that wait for the player. */
  remaining: number;
  /** First conversations set a reading pace fitted to their existing visit budget. */
  readingRate?: number;
}

/** The drawn river map. Static for a session apart from `reach`. */
export interface Chart {
  width: number;
  /** Full height of the river, mountains to sea. */
  height: number;
  /** Each channel as a centre line with half-widths, already simplified for drawing. */
  channels: Array<Array<{ x: number; y: number; half: number }>>;
  woods: Array<{ x: number; y: number; r: number }>;
  hills: Array<{ x: number; y: number; r: number }>;
  /** Top and bottom of each region, and its names. */
  regions: Array<{ id: string; name: string; title: string; top: number; bottom: number }>;
  /** Where the sea begins, if it is on the map. */
  sea: number | null;
  bridges?: Array<{ x: number; y: number; half?: number }>;
}

export interface AdventureView {
  /** Stable only while the underlying morning plans and rules are unchanged. Never saved. */
  planningKey?: object;
  /** The river's sign this morning: today's water or weather, and where something may show. */
  sign?: { find: string; place: string; line: string } | null;
  departure?: { destination: string; surveyed: boolean; place: string | null; prepared: boolean; work: string | null; cost: number; packed: boolean; materialsCost: number; materialsPacked: boolean } | null;
  creditsReplay?: boolean;
  mode: 'journey' | 'free';
  /** Where this run put Ren and Mina, and its way down from Mio. */
  course: Course;
  /** Places where the way on is found this year. */
  wayPlaces: string[];
  /** Free Play's almanac for this season (see aims.ts), each ticked once seen; empty in a Journey. */
  aims: AlmanacAim[];
  /** Free Play's long wanderings (see wanderings.ts); empty in a Journey. */
  wanderings: Wandering[];
  day: number;
  phase: DayPhase;
  /** The evening page waits until the gathering and sunset have played. */
  eveningReady: boolean;
  lodgings: Array<{ id: number | string; region: number; name: string; at: Vec }>;
  /** Every finished work, including repeated structures in different places. */
  sites?: Array<{ id: number; kind: StructureKind; region: number; name: string; at: Vec }>;
  /** 0..1 through the daylight; 0 in the morning. */
  dayProgress: number;
  /** "Morning", "Daylight", "Dusk", "Evening". */
  hour: string;
  season: number;
  year: number;
  yearProgress: number;
  weather: Weather;
  paused: boolean;
  speed: 1 | 2 | 4;

  /** Index of the farthest region reached; the map is unfolded this far. */
  region: number;
  chart: Chart;
  river: RiverView;
  /** The one thing the daily loop is waiting for now: "Mina is waiting for a plan." */
  nextStep: string;
  /** One line on what the story is waiting for. Never an instruction list. */
  goal: string;
  provisions: number;
  materials: number;

  friends: FriendView[];
  places: PlaceView[];
  plans: PlanView[];
  /** The last morning planning change can be taken back, before setting out. */
  canUndoPlan?: boolean;
  canRedoPlan?: boolean;
  structures: StructureView[];
  equipment: EquipmentView[];
  journal: JournalEntry[];
  /** The journal's small collections in the reaches reached so far. */
  sets: JournalSet[];
  /** Little things noticed by the way when they glinted, oldest first, and how many there are to notice in all. */
  smallFinds: { found: SmallFindView[]; total: number };
  /** Places in this reach nobody has even heard of yet, by direction from home. */
  frontier: Record<Direction, number>;
  /** Newest first, at most thirty. */
  notes: NoteView[];
  history: DaySummary[];
  tags: TagView[];
  evening: EveningView | null;
  /** What changed overnight; null outside the morning. */
  morning: MorningReport | null;

  placing: StructureKind | null;
  landscaping: boolean;
  canSail: boolean;
  canTravel: boolean;
  travelCost: number;
  voyage: 'preparing' | 'gathering' | 'sailing' | 'ended';
  /** On the voyage: the reach the boat is passing, as a quiet label, and one pencilled line from this journey. */
  voyageCaption: { reach: string | null; line: string | null } | null;
  /** How far the voyage's cut fade covers the view (0..1); set by the session. */
  voyageCut?: number;
  /** The book's last page, once the boat has reached the sea. */
  /** `notes`: a few closing lines this journey earned (the hut book, a friend who stayed, this year's course). */
  ending: { sailed: string[]; days: number; line: string; notes?: string[] } | null;

  /** Pure and cheap: what would happen if this outing were planned now. */
  forecast(plan: OutingPlan): Forecast;
  itinerary(plan: OutingPlan): Vec[];
  moveEveryoneProblem(place: string): string | null;
  /** On the moving morning: what a stop on the way would bring, and whether the friend can still reach the new camp by dusk. */
  detour(person: string, stop: SecondStop): Forecast;
  /** On the moving morning: a few open places near a friend's road down, nearest first. */
  detourStops(person: string): SecondStop[];
  route(person: string, place: string | Vec): Vec[];
}

/** A tag with its screen position, handed to the interface every frame. */
export interface ScreenTag extends TagView {
  /** Projected bodies that captions must leave visible. */
  people?: Array<{ x: number; y: number; w: number; h: number }>;
  headroom?: number;
  x: number;
  y: number;
  /** False when the anchor is off screen or under mist. */
  visible: boolean;
}

// ── Snapshot for the valley ─────────────────────────────────────────────────

export type Pose = 'idle' | 'walk' | 'carry' | 'fish' | 'forage' | 'look' | 'talk' | 'build' | 'sit' | 'wave' | 'track';

export interface SceneFigure {
  id: string;
  /** Friends are the player's explorers. Villagers are the valley's other people, who only go about their day and cannot be sent anywhere. */
  role: 'friend' | 'villager';
  /** Prefix of the art frames to draw with (`<look>-<pose>-<n>`): a friend's id, or a villager look such as `villager-a`. */
  look: string;
  at: Vec;
  /** -1 faces left, 1 faces right. */
  facing: -1 | 1;
  pose: Pose;
  /** 0..1 through the current pose's action, for timing a cast or a hammer blow. */
  action: number;
  pack: PackHint | null;
  item: Equipment | null;
  /** False while aboard the boat or otherwise not drawn on land. */
  visible: boolean;
  /** True for the friend the player has picked up in the notebook. */
  selected: boolean;
}

export interface ScenePlace {
  id: string;
  name: string;
  kind: PlaceKind;
  /** Only rumoured: draw a faint mark, not a name. */
  rumour: boolean;
  at: Vec;
  state: PlaceState;
  lead: boolean;
  /** True for the place under consideration in the notebook. */
  selected: boolean;
}

export interface SceneSighting {
  id: string;
  /** Art or sketch id of the creature. */
  species: string;
  at: Vec;
  /** Seconds since it appeared, and how long it stays. */
  age: number;
  life: number;
  /** True when this creature is not in the journal yet: draw the quiet ring. */
  fresh: boolean;
  /** Sketched a moment ago: the pencil closes round it and it is drawn away. */
  sketched?: boolean;
}

export interface SceneBuilding {
  id: number;
  kind: StructureKind;
  at: Vec;
  camp?: Vec;
  /** 0..1; 1 when complete. */
  progress: number;
  /** Growth of a planting: 0 a seedling, 1 growing, 2 grown. Always 2 for buildings. */
  stage: 0 | 1 | 2;
}

export interface SceneTrail {
  person: string;
  points: Vec[];
  /** 0..1 of the way along; 0 for an outing that is only planned. */
  progress: number;
  planned: boolean;
}

/** A small thing glinting on the ground by a friend's path, to be tapped and noted. */
export interface SceneGlint {
  id: string;
  at: Vec;
  /** Seconds since it began to glint, and how long it lasts untouched. */
  age: number;
  life: number;
  /** Looked at a moment ago: it gives one last bright twinkle and is gone. */
  found?: boolean;
}

export interface AdventureScene {
  figures: SceneFigure[];
  places: ScenePlace[];
  sightings: SceneSighting[];
  /** Small things glinting now (see `glints.ts`). Like a creature showing, something for the eye: tapped, noted in the journal. */
  glints?: SceneGlint[];
  buildings: SceneBuilding[];
  trails: SceneTrail[];
  /** The evening fire at the current home. */
  fire: Vec;
  /** Other occupied fires, including visited huts and shelters. */
  campfires?: Array<{ id: string; at: Vec }>;
  /** 0 by day, rising to 1 at the evening fire. Drives lamplight and long shadows. */
  dusk: number;
  /**
   * The time of day as a clock hour, 0 to 24, moving continuously. Morning
   * planning rests near 7, the day runs from 7 to about 18, the evening fire
   * rests near 20, and the night then passes in a few seconds (20 through 24
   * and round to 7). The valley darkens and lightens from this alone.
   */
  hour: number;
  /**
   * How the river stands today. The valley shows it: islands cut off, stones
   * and gravel bars under water. Optional while the rules catch up; the layer
   * reads it from the places' states when absent.
   */
  level?: WaterLevel;
  /**
   * Each settlement's growth: its stage (0 to 3) and what has appeared there.
   * Parked for the gameplay pass: the rules send stage 0 with nothing added.
   */
  settlements: Array<{ region: number; stage: number; additions: Array<{ kind: 'plot' | 'rack' | 'cottage'; at: Vec }> }>;
  /** The boat on the final voyage, when it is under way. */
  boat: { at: Vec; angle: number; aboard: string[] } | null;
  placing: StructureKind | null;
}

export type ScenePick =
  | { kind: 'friend'; id: string }
  | { kind: 'place'; id: string }
  | { kind: 'sighting'; id: string }
  | { kind: 'glint'; id: string }
  | { kind: 'building'; id: number };

// ── Sound ───────────────────────────────────────────────────────────────────

/** Every sound the expedition game can ask for. The audio director maps these to samples. */
export type Cue =
  | 'click' | 'menu-click' | 'menu-hover' | 'refuse'
  | 'leaf-open' | 'leaf-close' | 'page-turn'
  | 'token-lift' | 'token-place'
  | 'begin-day' | 'evening' | 'morning'
  | 'beat' | 'choice' | 'pack-plain' | 'pack-unusual' | 'pack-rare'
  | 'unpack' | 'find' | 'rare-find' | 'lead' | 'supplies'
  | 'sighting' | 'sketch'
  | 'cast' | 'splash' | 'rustle'
  | 'build-place' | 'hammer' | 'build-done'
  | 'river-shift' | 'season' | 'region'
  | 'farewell' | 'sail';

/** One of the year's almanac lines. */
export interface AlmanacAim {
  line: string;
  done: boolean;
  /** The season it belongs to (0 spring to 3 winter); none for a friend to meet. */
  season?: number;
  /** A known place to go for it. */
  place?: string;
}

/** One of Free Play's long wanderings, with its quiet count. */
export interface Wandering {
  id: string;
  line: string;
  found: number;
  total: number;
  /** "two of six", "14 of 27", "not yet". */
  progress: string;
  done: boolean;
  /** A word more, once earned. */
  note?: string;
}

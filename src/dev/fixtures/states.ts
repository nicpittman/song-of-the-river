/**
 * Hand-written notebook states for the demo page, chosen with `?state=`.
 *
 * Tag anchors here are in the pixels of the backdrop picture (1440 × 860),
 * not board units: the demo has no camera, so it pins tags to features of the
 * still (the path, the shrine, the fire) and maps them as the picture scales.
 */

import { USUAL_COURSE } from '../../game/adventure/course';
import { SETS } from '../../game/adventure/collections';
import type { AdventureView, MorningReport, NotebookPage, PlaceView, TagView, UnpackItem } from '../../game/adventure/model';
import { buildChart } from './chart';
import { forecastFor } from './forecast';
import { CAMP, equipment, friends, hideUnfound, journal, laterFriends, places, structures } from './world';

export type Backdrop = 'day' | 'dusk' | 'night';

export interface DemoState {
  view: AdventureView;
  /** What the demo asks the notebook to open once it has the view. */
  open?: { page: NotebookPage; person?: string; place?: string };
  backdrop: Backdrop;
  /** For the map spread: count the newest region as not yet unfolded, so it unfolds. */
  unfold?: boolean;
  /** Close the morning book after loading, as a player looking at the valley would. */
  foldLeaf?: boolean;
  /** Learned lines already read, by place, so later ones show as new. */
  seenLearned?: Record<string, number>;
}

export const STATE_NAMES = [
  'morning',
  'picked',
  'consider',
  'planned',
  'day',
  'shifted',
  'evening',
  'unpacked',
  'night',
  'journal',
  'friends',
  'map',
  'late',
  'inspect',
  'inspect-new',
  'inspect-closed',
  'voyage',
  'ending',
] as const;
export type StateName = (typeof STATE_NAMES)[number];

/** The fire and the paths in the backdrop picture, for pinning tags. */
export const SPOTS = {
  fire: { x: 700, y: 470 },
  spring: { x: 820, y: 250 },
  pool: { x: 860, y: 600 },
  path: { x: 660, y: 330 },
  pond: { x: 560, y: 450 },
  mill: { x: 600, y: 640 },
};

function baseView(): AdventureView {
  const placeList = places();
  const view: AdventureView = {
    mode: 'journey',
    course: USUAL_COURSE,
    wayPlaces: ['furumichi', 'yamagoya', 'omagari'],
    aims: [],
    wanderings: [],
    voyageCaption: null,
    ending: null,
    frontier: { upstream: 3, across: 2, downstream: 4 },
    day: 1,
    phase: 'morning',
    eveningReady: false,
    lodgings: [],
    dayProgress: 0,
    hour: 'Morning',
    season: 0,
    year: 1,
    yearProgress: 0.24,
    weather: 'mist',
    paused: true,
    speed: 1,
    region: 0,
    chart: buildChart(),
    river: { level: 'high', trend: 'rising', tomorrow: 'high', line: 'Snowmelt fills the river to its banks.', shifted: false },
    nextStep: 'Three companions are waiting for a plan.',
    goal: 'Find where the old marker by the spring points.',
    provisions: 4, materials: 2,
    friends: friends(),
    places: placeList,
    plans: [],
    structures: structures(),
    equipment: equipment(),
    journal: [],
    history: [],
    notes: [
      { id: 3, day: 1, text: 'We came down to Seseragi, where the stream bends below the spring.' },
      { id: 2, day: 1, text: 'Snowmelt is running high and loud.' },
      { id: 1, day: 1, text: 'Sora, Ren and Mina set out from the mountain hut.' },
    ],
    tags: [],
    evening: null,
    morning: null,
    sets: [],
    smallFinds: { found: [], total: 0 },
    placing: null,
    landscaping: false,
    canSail: false, canTravel: false, travelCost: 6,
    voyage: 'preparing',
    route: (person, place) => [view.friends.find((f) => f.id === person)!.at, view.places.find((p) => p.id === place)!.at],
    moveEveryoneProblem: () => null,
    detour: () => ({ problem: null, chance: 'even', pips: 2, reasons: [], length: 'Catches up by dusk', beats: 2 }),
    detourStops: () => [],
    itinerary: (plan) => [view.friends.find((f) => f.id === plan.person)!.at, view.places.find((p) => p.id === plan.place)!.at, ...(plan.second ? [view.places.find((p) => p.id === plan.second!.place)!.at] : [])],
    forecast: (plan) => forecastFor(view, plan),
  };
  return view;
}

const place = (view: AdventureView, id: string): PlaceView => {
  const p = view.places.find((x) => x.id === id);
  if (!p) throw new Error(`No place ${id}`);
  return p;
};

/** Spring high water: the low crossings are under water. */
function springFlood(view: AdventureView): void {
  for (const id of ['gravel', 'stones']) {
    const p = place(view, id);
    p.state = 'closed';
    p.stateLine = 'Under water until the river falls.';
  }
  const falls = place(view, 'falls');
  falls.state = 'special';
  falls.stateLine = 'Salmon are leaping the falls in the snowmelt.';
}

/** Day one's knowledge: a few places visited before the journey began. */
function firstKnowledge(view: AdventureView): void {
  const pool = place(view, 'pool');
  pool.visits = 3;
  pool.learned = ['The deep water stays calm even in snowmelt.', 'Char rest under the far bank at dawn.', 'Something long and silver moves at dusk.'];
  pool.lead = 'Ren saw silver at dusk. It may come again tonight.';
  pool.leadDays = 2;
  pool.finds[0].found = true;
  const spring = place(view, 'spring');
  spring.visits = 1;
  spring.learned = ['A weathered marker points downstream.'];
  spring.finds[1].found = true;
  const grove = place(view, 'grove');
  grove.visits = 1;
  grove.learned = ['Deer tracks cross the moss toward the clearing.'];
  for (const id of ['meadow', 'old-way', 'heron', 'ridge', 'hollow', 'shrine', 'stones', 'gravel']) {
    for (const f of place(view, id).finds) f.hint = hintFor(id);
  }
  place(view, 'gravel').finds[0].today = false;
}

function hintFor(id: string): string {
  const hints: Record<string, string> = {
    gravel: 'When the water is low',
    stones: 'Under the stones',
    meadow: 'At the edge of the woods',
    'old-way': 'Somewhere along the road',
    heron: 'In still water',
    ridge: 'From high up',
    hollow: 'After rain',
    shrine: 'Ask the keeper',
  };
  return hints[id] ?? 'Somewhere near';
}

function finishWorld(view: AdventureView): AdventureView {
  view.journal = journal(view.places);
  // Found entries carry the day and the finder, as the notebook's history.
  view.journal
    .filter((e) => e.found)
    .forEach((e, i) => {
      const finder = view.friends[i % Math.min(3, view.friends.length)];
      e.credit = `Day ${1 + ((i * 2) % Math.max(1, view.day))} · ${finder.name}`;
    });
  hideUnfound(view.places);
  view.sets = setsOf(view);
  return view;
}

/** The journal's sets, counted from its entries in the reaches reached. */
function setsOf(view: AdventureView): AdventureView['sets'] {
  const names = [...new Set(view.journal.filter((e) => e.set && e.region <= view.region).map((e) => e.set as string))];
  return names.map((name) => {
    const entries = view.journal.filter((e) => e.set === name);
    const found = entries.filter((e) => e.found).length;
    const def = SETS.find((set) => set.name === name);
    return { id: def?.id ?? name.toLowerCase().replace(/[^a-z]+/g, '-'), name, sketch: entries[0]!.sketch, found, total: entries.length, complete: found === entries.length, reward: def?.reward ?? '', came: def?.came ?? '' };
  });
}

function morningReport(partial: Partial<MorningReport>): MorningReport {
  return { river: null, weather: 'Mist on the water until midday.', opened: [], closed: [], leads: [], expiring: [], news: [], ...partial };
}

function plan(
  view: AdventureView,
  person: string,
  placeId: string,
  activity: AdventureView['plans'][number]['activity'],
  item: AdventureView['plans'][number]['item'] = null,
): void {
  const outing = { person, place: placeId, activity, item, companion: null };
  view.plans.push({ ...outing, forecast: forecastFor(view, outing) });
  const f = view.friends.find((x) => x.id === person)!;
  f.status = 'planned';
  f.statusLine = `Going to ${place(view, placeId).name}`;
  if (item) view.equipment.find((e) => e.id === item)!.with = person;
}

function dayOne(): AdventureView {
  const view = baseView();
  springFlood(view);
  firstKnowledge(view);
  view.morning = morningReport({ news: ['We have settled in Seseragi, below the spring.'], closed: ['gravel', 'stones'] });
  return view;
}

function planned(): AdventureView {
  const view = dayOne();
  plan(view, 'sora', 'spring', 'explore');
  plan(view, 'ren', 'pool', 'fish', 'fishing-kit');
  view.nextStep = 'Mina is waiting for a plan.';
  return view;
}

function inDay(): AdventureView {
  const view = planned();
  view.phase = 'day';
  view.hour = 'Daylight';
  view.dayProgress = 0.42;
  view.paused = false;
  view.morning = null;
  view.nextStep = 'The companions are out. Watch, or skip to evening.';
  const mina = view.friends.find((f) => f.id === 'mina')!;
  mina.status = 'resting';
  mina.statusLine = 'By the fire in Seseragi';
  const out = (id: string, line: string, pack: AdventureView['friends'][number]['pack']): void => {
    const f = view.friends.find((x) => x.id === id)!;
    f.status = 'out';
    f.statusLine = line;
    f.pack = pack;
  };
  out('sora', 'Exploring the mountain spring', 'plain');
  out('ren', 'Fishing at Fuchi pool', 'unusual');
  view.plans = [];
  view.tags = [
    tag('beat-ren', 'beat', SPOTS.pool, 'ren', 'mountain-char-fish', 'Something silver in the deep water.', 'unusual'),
    tag('beat-sora', 'beat', SPOTS.spring, 'sora', null, 'Sora kneels by the cold spring.', null),
    {
      ...tag('choice-sora', 'choice', SPOTS.path, 'sora', null, 'Tracks lead up past the spring.', null),
      choices: ['Follow', 'Turn back'],
      remaining: 5.2,
    },
  ];
  return view;
}

function shifted(): AdventureView {
  const view = baseView();
  firstKnowledge(view);
  view.day = 3;
  view.season = 1;
  view.weather = 'clear';
  view.provisions = 6;
  view.river = { level: 'middle', trend: 'falling', tomorrow: 'low', line: 'The water has fallen. New ground lies exposed.', shifted: true };
  const gravel = place(view, 'gravel');
  gravel.lead = 'The gravel bar is showing while the water stays low.';
  gravel.leadDays = 2;
  gravel.finds[0].today = true;
  const tarn = place(view, 'tarn');
  tarn.lead = 'A newt was seen at the tarn edge.';
  tarn.leadDays = 1;
  view.structures[0].status = 'built';
  view.structures[0].progress = 1;
  view.morning = morningReport({
    river: 'The river fell in the night. The gravel bar is showing.',
    weather: 'Clear and bright. Summer has come.',
    opened: ['gravel', 'stones'],
    leads: ['gravel'],
    expiring: ['tarn'],
    news: ['The garden by camp is finished.'],
  });
  view.nextStep = 'Three companions are waiting for a plan.';
  view.notes.unshift({ id: 9, day: 3, text: 'The river fell in the night.' });
  return view;
}

const UNPACK: UnpackItem[] = [
  {
    id: 'u1',
    person: 'mina',
    kind: 'supplies',
    hint: 'plain',
    title: 'Two days of provisions',
    text: 'Mina kept the fire in Seseragi.',
    sketch: null,
    provisions: 2, materials: 2,
  },
  {
    id: 'u2',
    person: 'sora',
    kind: 'lead',
    hint: 'plain',
    title: 'A lead: Kagami-numa',
    text: 'Tracks lead up toward the tarn. They will not last past the next rain.',
    sketch: null,
    provisions: 0, materials: 2,
  },
  {
    id: 'u3',
    person: 'sora',
    kind: 'find',
    hint: 'unusual',
    title: 'White-throated dipper',
    text: 'It walked straight into the water.',
    sketch: 'dipper-bird',
    provisions: 1, materials: 2,
  },
  {
    id: 'u4',
    person: 'ren',
    kind: 'find',
    hint: 'rare',
    title: 'Silver eel',
    text: 'Long as an arm, and quick as light.',
    sketch: 'silver-eel',
    provisions: 0, materials: 2,
  },
];

/** Where each bundle is set down around the fire. */
const UNPACK_SPOTS = [
  { x: 670, y: 480 },
  { x: 720, y: 500 },
  { x: 690, y: 450 },
  { x: 735, y: 465 },
];

function evening(shown: number): AdventureView {
  const view = inDay();
  view.phase = 'evening';
  view.hour = 'Evening';
  view.dayProgress = 1;
  view.paused = false;
  view.nextStep = 'The companions are home. See what they brought.';
  for (const f of view.friends) {
    f.status = 'home';
    f.statusLine = 'By the fire';
  }
  view.evening = { total: UNPACK.length, items: UNPACK, shown, tomorrow: 'The water is falling. The gravel bar may show by morning.' };
  view.tags = unpackTags(view);
  return view;
}

export function unpackTags(view: AdventureView): TagView[] {
  const evening = view.evening;
  if (!evening) return [];
  return evening.items.slice(0, evening.shown).map((item, i) => ({
    ...tag(item.id, 'unpack', UNPACK_SPOTS[i % UNPACK_SPOTS.length], item.person, item.sketch, item.title, item.hint),
    remaining: 0,
  }));
}

export function tag(
  id: string,
  kind: TagView['kind'],
  at: { x: number; y: number },
  person: string | null,
  sketchId: string | null,
  text: string,
  pack: TagView['pack'],
): TagView {
  return { id, kind, anchor: { ...at }, person, sketch: sketchId, text, pack, choices: [], remaining: kind === 'beat' ? 6 : 0 };
}

/** A well-thumbed notebook a few days in: half the journal filled, memories and practice. */
function middling(): AdventureView {
  const view = shifted();
  view.day = 6;
  view.river.shifted = false;
  view.morning = null;
  const foundIds = [
    'spring-marker',
    'dipper-bird',
    'wagtail-bird',
    'leaping-salmon',
    'willow-cutting',
    'fern-crozier',
    'fishing-knowledge',
    'mountain-char-fish',
    'plover-bird',
    'violet-flower',
    'deer-tracks',
    'wish-plaque',
    'heron-bird',
    'birch-bark-scroll',
  ];
  for (const p of view.places) {
    for (const f of p.finds) {
      if (foundIds.includes(f.id)) {
        f.found = true;
        p.visits = Math.max(p.visits, 1);
        if (!p.learned.length) p.learned = [`${p.name} is worth a second look.`];
      }
    }
  }
  const [sora, ren, mina] = view.friends;
  sora.practice = { explore: 4, investigate: 1 };
  sora.memories = [
    'Followed tracks to the tarn and saw the mountain twice.',
    'Found the old marker by the spring.',
    'Got lost in the mist, then found the way.',
  ];
  ren.practice = { fish: 5, explore: 1 };
  ren.memories = ['Caught a char under the far bank.', 'Saw the salmon leap at Taki falls.'];
  mina.practice = { forage: 2, explore: 1 };
  mina.memories = ['Wrapped a willow cutting in damp moss.'];
  view.notes.unshift(
    { id: 12, day: 6, text: 'Ren brought home a char as long as a forearm.' },
    { id: 11, day: 5, text: 'Mina planted the willow cutting by the garden.' },
    { id: 10, day: 4, text: 'The stepping stones are dry again.' },
  );
  return view;
}

function lateGame(): AdventureView {
  const view = middling();
  view.day = 24;
  view.season = 3;
  view.weather = 'snow';
  view.region = 2;
  view.provisions = 9;
  view.friends = laterFriends();
  for (const f of view.friends) f.at = { ...CAMP };
  view.river = { level: 'low', trend: 'steady', tomorrow: 'low', line: 'The winter river runs low and clear.', shifted: false };
  for (const s of view.structures) {
    s.status = 'built';
    s.progress = 1;
    s.problem = null;
  }
  view.equipment.forEach((e) => (e.owned = true));
  view.canSail = true;
  view.nextStep = 'Five companions are waiting. The boat is ready when you are.';
  view.goal = 'The boat is ready. The sea is a day downstream.';
  view.morning = morningReport({ weather: 'Light snow, no wind.', news: ['The boat is finished and tied at the dock.'] });
  for (const p of view.places) {
    if (p.region > 0) {
      p.visits = 1;
      p.learned = [`${p.name} has been seen once.`];
    }
  }
  return view;
}

/** Builds a demo state by name. */
export function buildState(name: StateName): DemoState {
  switch (name) {
    case 'morning':
      return { view: finishWorld(dayOne()), backdrop: 'day' };
    case 'picked':
      return { view: finishWorld(dayOne()), backdrop: 'day', open: { page: 'plan', person: 'ren' } };
    case 'consider':
      return { view: finishWorld(dayOne()), backdrop: 'day', open: { page: 'plan', person: 'ren', place: 'pool' } };
    case 'planned':
      return { view: finishWorld(planned()), backdrop: 'day' };
    case 'day':
      return { view: finishWorld(inDay()), backdrop: 'day' };
    case 'shifted':
      return { view: finishWorld(shifted()), backdrop: 'day' };
    case 'evening':
      return { view: finishWorld(evening(2)), backdrop: 'dusk' };
    case 'unpacked':
      return { view: finishWorld(evening(4)), backdrop: 'dusk' };
    case 'night': {
      const view = evening(4);
      view.phase = 'night';
      view.hour = 'Night';
      view.evening = null;
      view.tags = [];
      view.nextStep = 'The valley sleeps.';
      return { view: finishWorld(view), backdrop: 'night' };
    }
    case 'journal':
      return { view: finishWorld(middling()), backdrop: 'day', open: { page: 'journal' } };
    case 'friends':
      return { view: finishWorld(middling()), backdrop: 'day', open: { page: 'friends' } };
    case 'map': {
      const view = middling();
      view.region = 1;
      for (const p of view.places.filter((x) => x.region === 1).slice(0, 3)) {
        p.visits = 1;
        p.learned = ['First seen from the old road.'];
      }
      return { view: finishWorld(view), backdrop: 'day', open: { page: 'map' }, unfold: true };
    }
    case 'late':
      return { view: finishWorld(lateGame()), backdrop: 'day' };
    case 'inspect': {
      // In the morning, with the leaf folded away to look at the valley: the card offers "Send someone".
      const view = dayOne();
      place(view, 'pool').learned.push('Ren saw a long silver shape turn under the far bank.');
      view.tags = [{ ...tag('pool', 'place', SPOTS.pool, null, null, 'Fuchi pool', null), remaining: 0 }];
      return { view: finishWorld(view), backdrop: 'day', foldLeaf: true, seenLearned: { pool: 3 } };
    }
    case 'inspect-new':
    case 'inspect-closed': {
      // During the day: looking closely is allowed at any time.
      const view = inDay();
      const id = name === 'inspect-new' ? 'hollow' : 'gravel';
      view.tags = [{ ...tag(id, 'place', SPOTS.pond, null, null, place(view, id).name, null), remaining: 0 }];
      return { view: finishWorld(view), backdrop: 'day' };
    }
    case 'voyage': {
      const view = lateGame();
      view.voyage = 'sailing';
      view.phase = 'day';
      view.morning = null;
      return { view: finishWorld(view), backdrop: 'day' };
    }
    case 'ending': {
      const view = lateGame();
      view.voyage = 'ended';
      view.phase = 'day';
      view.morning = null;
      for (const f of view.friends.slice(0, 4)) f.status = 'aboard';
      return { view: finishWorld(view), backdrop: 'day' };
    }
  }
}

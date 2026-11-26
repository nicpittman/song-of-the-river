/**
 * The demo's world: friends, places, structures, kit and journal entries as
 * plain data, close to what the rules will produce. Each state in `states.ts`
 * copies these and adjusts them.
 */

import type {
  Activity,
  EquipmentView,
  FindSlot,
  FriendView,
  JournalCategory,
  JournalEntry,
  PlaceView,
  StructureView,
} from '../../game/adventure/model';
import { riverX } from './chart';

/** Where the group's fire is: in Seseragi, by the stream. */
export const CAMP = { x: riverX(560) - 190, y: 560 };

export function friends(): FriendView[] {
  const base = (id: string, name: string, role: string, colour: string, gift: Activity, ambition: string): FriendView => ({
    id,
    base: 0, baseName: 'Seseragi',
    name,
    role,
    colour,
    portrait: `friend-${id}`,
    gift,
    ambition,
    status: 'home',
    statusLine: 'In Seseragi',
    pack: null,
    memories: [],
    practice: {},
    at: { ...CAMP },
  });
  return [
    base('sora', 'Sora', 'The wanderer', '#9c5a3c', 'explore', 'Follow the river beyond the last hill.'),
    base('ren', 'Ren', 'The fisher', '#4f7f8a', 'fish', 'Find where the river begins to taste of salt.'),
    base('mina', 'Mina', 'The botanist', '#6f8a4f', 'forage', 'Plant something from every reach of the river.'),
  ];
}

export function laterFriends(): FriendView[] {
  const list = friends();
  list.push(
    {
      ...list[0],
      id: 'aki',
      name: 'Aki',
      role: 'The carpenter',
      colour: '#8a6a4a',
      portrait: 'friend-aki',
      gift: 'investigate',
      ambition: 'Build a boat that can carry a small garden.',
    },
    {
      ...list[0],
      id: 'yui',
      name: 'Yui',
      role: 'The keeper of stories',
      colour: '#8a6a80',
      portrait: 'friend-yui',
      gift: 'visit',
      ambition: 'Bring home a story nobody has heard.',
    },
  );
  return list;
}

interface PlaceDef {
  id: string;
  name: string;
  kind?: PlaceView['kind'];
  region: number;
  /** Depth down the valley, and how far from the river's centre. */
  y: number;
  off: number;
  activities: Activity[];
  note: string;
  finds: Array<[string, string, boolean?]>;
}

const find = (id: string, name: string, rare = false): [string, string, boolean] => [id, name, rare];

const PLACES: PlaceDef[] = [
  {
    id: 'seseragi',
    name: 'Seseragi',
    kind: 'settlement',
    region: 0,
    y: 560,
    off: -190,
    activities: ['visit', 'forage'],
    note: 'A handful of roofs where the stream bends. We live here.',
    finds: [find('hut-lantern', 'The old hut lantern')],
  },
  {
    id: 'tarn',
    name: 'Kagami-numa',
    region: 0,
    y: 80,
    off: 0,
    activities: ['investigate', 'explore', 'fish'],
    note: 'A high tarn holding a second mountain.',
    finds: [find('mountain-reflection', 'The mountain reflected'), find('newt-tracks', 'Fire-bellied newt')],
  },
  {
    id: 'spring',
    name: 'The mountain spring',
    region: 0,
    y: 190,
    off: 70,
    activities: ['explore', 'investigate', 'fish'],
    note: 'Cold clear water. A weathered marker points downstream.',
    finds: [
      find('spring-marker', 'A river on old paper'),
      find('dipper-bird', 'White-throated dipper'),
      find('banded-stone', 'A banded stone', true),
    ],
  },
  {
    id: 'falls',
    name: 'Taki falls',
    region: 0,
    y: 400,
    off: 0,
    activities: ['fish', 'explore'],
    note: 'The river drops over mossy steps.',
    finds: [find('wagtail-bird', 'Grey wagtail'), find('leaping-salmon', 'Leaping salmon', true)],
  },
  {
    id: 'birches',
    name: 'The birch slope',
    kind: 'minor',
    region: 0,
    y: 700,
    off: 300,
    activities: ['forage', 'explore'],
    note: 'Pale trunks on a steep bank.',
    finds: [find('birch-bark-scroll', 'Birch bark scroll'), find('chanterelle-mushroom', 'Chanterelles')],
  },
  {
    id: 'grove',
    name: 'Kamimori grove',
    region: 0,
    y: 880,
    off: -330,
    activities: ['explore', 'forage', 'investigate'],
    note: 'Moss, fern and deer tracks beneath the pines.',
    finds: [find('willow-cutting', 'Willow cutting'), find('serow-tracks', 'Serow', true), find('fern-crozier', 'Fern croziers')],
  },
  {
    id: 'pool',
    name: 'Fuchi pool',
    region: 0,
    y: 1060,
    off: 0,
    activities: ['fish', 'explore', 'investigate'],
    note: 'A sheltered bank, with silver movement in the deep water.',
    finds: [find('fishing-knowledge', 'The quiet cast'), find('mountain-char-fish', 'Mountain char'), find('silver-eel', 'Silver eel', true)],
  },
  {
    id: 'gravel',
    name: 'The gravel bar',
    region: 0,
    y: 1220,
    off: 10,
    activities: ['forage', 'investigate'],
    note: 'A long bar of stones the river covers and uncovers.',
    finds: [find('river-agate-stone', 'River agate', true), find('plover-bird', 'Little ringed plover')],
  },
  {
    id: 'meadow',
    name: 'The fern clearing',
    region: 0,
    y: 1330,
    off: -260,
    activities: ['forage', 'explore'],
    note: 'Quiet flowers at the edge of the woods.',
    finds: [find('violet-flower', 'Wood violet'), find('deer-tracks', 'Sika deer')],
  },
  {
    id: 'stones',
    name: 'Stepping stones',
    kind: 'minor',
    region: 0,
    y: 1480,
    off: 0,
    activities: ['explore', 'fish'],
    note: 'An old crossing to the far bank.',
    finds: [find('crab-shell', 'Freshwater crab')],
  },
  {
    id: 'shrine',
    name: 'The moss shrine',
    region: 0,
    y: 1580,
    off: 260,
    activities: ['visit', 'investigate'],
    note: 'A small roof under the cedars, kept by someone.',
    finds: [find('wish-plaque', 'A wooden wish plaque'), find('keeper-story', 'The shrine keeper')],
  },
  {
    id: 'old-way',
    name: 'The old river road',
    region: 0,
    y: 1700,
    off: -200,
    activities: ['explore', 'investigate', 'visit'],
    note: 'An abandoned way leads south.',
    finds: [find('downstream-chart', 'The road to Mio')],
  },
  {
    id: 'heron',
    name: 'Heron shallows',
    kind: 'minor',
    region: 0,
    y: 1930,
    off: 40,
    activities: ['fish', 'explore'],
    note: 'Still water where the herons stand.',
    finds: [find('heron-bird', 'Grey heron'), find('loach-fish', 'Pond loach')],
  },
  {
    id: 'ridge',
    name: 'Hawk ridge',
    region: 0,
    y: 2140,
    off: 330,
    activities: ['explore'],
    note: 'A bare ridge with a view down the valley.',
    finds: [find('kite-bird', 'Black kite'), find('far-view-map', 'A first sight of Mio', true)],
  },
  {
    id: 'hollow',
    name: 'Badger hollow',
    region: 0,
    y: 2330,
    off: -300,
    activities: ['forage', 'explore', 'investigate'],
    note: 'A damp hollow under old oaks.',
    finds: [find('badger-paw', 'Badger'), find('truffle-mushroom', 'Black truffle', true)],
  },
  {
    id: 'orchard',
    name: 'Mio orchard',
    region: 1,
    y: 2700,
    off: -280,
    activities: ['forage', 'explore', 'visit'],
    note: 'Old fruit trees still bear.',
    finds: [find('orchard-letter', 'A letter beneath the apples'), find('plum-blossom', 'Mountain plum')],
  },
  {
    id: 'weir',
    name: 'The weir',
    kind: 'minor',
    region: 1,
    y: 2900,
    off: 0,
    activities: ['fish', 'investigate'],
    note: 'A low wall of stones across the river.',
    finds: [find('ayu', 'Sweetfish')],
  },
  {
    id: 'mio',
    name: 'Mio',
    kind: 'settlement',
    region: 1,
    y: 3020,
    off: -330,
    activities: ['visit', 'investigate'],
    note: 'An orchard village around a mill pond.',
    finds: [find('mill-song', 'A work song')],
  },
  {
    id: 'inn',
    name: 'The lantern house',
    region: 1,
    y: 3150,
    off: -230,
    activities: ['visit', 'investigate'],
    note: 'A carpenter remembers the boats.',
    finds: [find('bridge-plans', 'The carpenter’s crossing')],
  },
  {
    id: 'terraces',
    name: 'Plum terraces',
    kind: 'minor',
    region: 1,
    y: 3300,
    off: 280,
    activities: ['forage', 'visit'],
    note: 'Stepped gardens on the sunny bank.',
    finds: [find('salted-plum-seed', 'Salted plums')],
  },
  {
    id: 'mill',
    name: 'The willow mill',
    region: 1,
    y: 3480,
    off: 20,
    activities: ['fish', 'investigate', 'visit'],
    note: 'The wheel turns with the river.',
    finds: [find('boat-plans', 'A boat in the mill ledger', true)],
  },
  {
    id: 'reed-garden',
    name: 'The far-bank garden',
    region: 1,
    y: 3650,
    off: 360,
    activities: ['forage', 'visit', 'explore'],
    note: 'Reachable after a bridge.',
    finds: [find('iris', 'Water iris')],
  },
  {
    id: 'kingfisher',
    name: 'Kingfisher bank',
    kind: 'minor',
    region: 1,
    y: 3850,
    off: -120,
    activities: ['fish', 'explore'],
    note: 'A flash of blue along the cut bank.',
    finds: [find('kingfisher-bird', 'Kingfisher')],
  },
  {
    id: 'bend',
    name: 'The long bend',
    region: 1,
    y: 4150,
    off: -160,
    activities: ['explore', 'investigate', 'forage'],
    note: 'Reeds hide a way into the lower valley.',
    finds: [find('estuary-chart', 'Beyond the long bend')],
  },
  {
    id: 'ferry',
    name: 'Ferry stones',
    kind: 'minor',
    region: 1,
    y: 4380,
    off: 0,
    activities: ['visit', 'explore'],
    note: 'Where a ferry once crossed.',
    finds: [find('ferry-bell-tool', 'A ferry bell')],
  },
  {
    id: 'marsh',
    name: 'Sagi reedlands',
    region: 2,
    y: 4750,
    off: -300,
    activities: ['explore', 'forage', 'investigate'],
    note: 'White birds settle in the reeds.',
    finds: [find('reed-chart', 'Channels through the reeds'), find('egret', 'Great egret')],
  },
  {
    id: 'harbour',
    name: 'Kawagiri',
    kind: 'settlement',
    region: 2,
    y: 5080,
    off: -150,
    activities: ['visit', 'investigate', 'fish'],
    note: 'A half-forgotten boatyard.',
    finds: [find('sailor-story', 'A sailor’s story')],
  },
  {
    id: 'saltflats',
    name: 'The salt flats',
    kind: 'minor',
    region: 2,
    y: 5300,
    off: 330,
    activities: ['forage', 'explore'],
    note: 'Shining flats at low tide.',
    finds: [find('glasswort-herb', 'Glasswort')],
  },
  {
    id: 'islet',
    name: 'The tide garden',
    region: 2,
    y: 5530,
    off: 30,
    activities: ['forage', 'investigate', 'fish'],
    note: 'Salt flowers where the waters meet.',
    finds: [find('sea-lavender-flower', 'Sea lavender')],
  },
  {
    id: 'dunes',
    name: 'The dune pines',
    kind: 'minor',
    region: 2,
    y: 5800,
    off: -360,
    activities: ['explore', 'forage'],
    note: 'Twisted pines on the sand.',
    finds: [find('pine-cone-seed', 'A salt pine cone')],
  },
  {
    id: 'mouth',
    name: 'The river mouth',
    region: 2,
    y: 6050,
    off: 0,
    activities: ['explore', 'investigate', 'fish'],
    note: 'Beyond the last reeds, only the sea.',
    finds: [find('sea-glass', 'Sea glass', true)],
  },
];

export function places(): PlaceView[] {
  return PLACES.map((d) => ({
    id: d.id,
    name: d.name,
    kind: d.kind ?? 'place',
    home: d.kind === 'settlement' && d.region === 0,
    rumour: null,
    direction: d.region === 0 && d.y < 1700 ? ('upstream' as const) : ('downstream' as const),
    region: d.region,
    at: { x: riverX(d.y) + d.off, y: d.y },
    note: d.note,
    state: 'open',
    stateLine: null,
    activities: d.activities,
    lead: null,
    leadDays: null,
    finds: d.finds.map(([id, name, rare]): FindSlot => ({ id, found: false, name, sketch: id, rare: !!rare, today: true, hint: null })),
    visits: 0,
    learned: [],
  }));
}

/** The finds' names are only known once found; this hides them for unfound slots. */
export function hideUnfound(list: PlaceView[]): void {
  for (const p of list) for (const f of p.finds) if (!f.found) f.name = null;
}

export function structures(): StructureView[] {
  const s = (
    id: StructureView['id'],
    name: string,
    cost: number,
    effect: string,
    status: StructureView['status'] = 'available',
    problem: string | null = null,
  ): StructureView => ({
    id,
    name,
    opens: id === 'bridge' ? ['Mukoniwa', 'Kitsuneyama Shrine'] : [],
    cost,
    effect,
    sketch: `structure-${id}`,
    status,
    problem,
    progress: status === 'built' ? 1 : 0,
    workRemaining: status === 'built' ? 0 : 2,
    region: 0,
    at: null,
  });
  return [
    s('garden', 'Garden', 3, 'Brings creatures close to camp.'),
    s('platform', 'Fishing platform', 5, 'Makes high-water fishing safe.'),
    s('shelter', 'Trail shelter', 6, 'Opens the long walk south.'),
    s('bridge', 'Footbridge', 8, 'Opens the far bank.', 'locked', 'Needs the carpenter’s plans.'),
    s('lookout', 'Lookout', 5, 'Shows sightings across the valley.'),
    s('cottage', 'Cottage', 10, 'A home for a new companion.', 'locked', 'Someone must ask to stay.'),
    s('dock', 'Dock', 9, 'Boats can tie up at camp.', 'locked', 'Only by the wide river.'),
    s('boat', 'Boat', 12, 'Carries us to the sea.', 'locked', 'Needs the boat plans.'),
  ];
}

export function equipment(): EquipmentView[] {
  return [
    { id: 'rain-cape', name: 'Rain cape', cost: 2, effect: 'Rain does not spoil the day.', owned: true, with: null },
    { id: 'fishing-kit', name: 'Fishing kit', cost: 3, effect: 'Better odds at the water.', owned: true, with: null },
    { id: 'walking-staff', name: 'Walking staff', cost: 2, effect: 'Long walks come home sooner.', owned: false, with: null },
    { id: 'field-kit', name: 'Field kit', cost: 3, effect: 'Better odds when looking closely.', owned: false, with: null },
  ];
}

/** A find's journal category, read from the words in its id. */
function categoryOf(id: string, rare: boolean): JournalCategory {
  const has = (...words: string[]): boolean => words.some((w) => id.includes(w));
  if (has('bird', 'heron', 'egret')) return 'birds';
  if (has('fish', 'salmon', 'eel', 'ayu', 'quiet-cast', 'crab', 'knowledge')) return 'fish';
  if (has('flower', 'blossom', 'mushroom', 'fern', 'willow', 'seed', 'herb', 'iris')) return 'plants';
  if (has('tracks', 'paw')) return 'wildlife';
  if (has('story', 'keeper', 'song')) return 'encounters';
  return rare ? 'curiosities' : 'keepsakes';
}

/** A few small collections, so the journal's sets have something to show. */
function setOf(id: string, region: number): string | null {
  if (region === 0 && id.endsWith('-bird')) return 'Birds of the springs';
  if (['river-agate-stone', 'banded-stone', 'crab-shell', 'wish-plaque'].includes(id)) return 'Things the water keeps';
  if (region === 0 && (id.endsWith('-fish') || id === 'leaping-salmon' || id === 'fishing-knowledge')) return 'The quiet waters';
  return null;
}

/** The journal is every possible find, by category and region. */
export function journal(list: PlaceView[]): JournalEntry[] {
  const entries: JournalEntry[] = [];
  for (const p of list) {
    for (const f of p.finds) {
      const category = categoryOf(f.id, f.rare);
      entries.push({
        id: f.id,
        category,
        sketch: f.sketch,
        found: f.found,
        name: f.found ? f.name : null,
        text: f.found ? `Noted at ${p.name.replace(/^The /, 'the ')}.` : null,
        rare: f.rare,
        region: p.region,
        credit: null,
        set: setOf(f.id, p.region),
        hint: f.found ? null : (f.hint ?? `Somewhere near ${p.name.replace(/^The /, 'the ')}`),
      });
    }
  }
  return entries;
}

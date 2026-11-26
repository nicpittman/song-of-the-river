/**
 * How places become known. Each reach begins with a few places round home
 * and a couple more only heard of. The rest are found by going:
 *
 *   explore from a known place   and you hear of the places beyond it (an
 *                                explorer, a friend with the staff or with
 *                                group, hears of all of them; anyone else, one)
 *   explore to a heard-of place  and you find it: from then on it is on the map
 *
 * Tracking hears of one place beyond, too; a lead names its place outright;
 * a finished lookout lets you hear of every place in its reach.
 */

import type { Vec } from '../core/math';

export const DISCOVERY = true;
import { PLACES, placeDef } from './content';
import type { Direction } from './model';
import { REGIONS } from './regions';
import { isSecretPlace } from './places/freeplay';

/** What can be heard of from each place, nearest first. */
export const BEYOND: Readonly<Record<string, readonly string[]>> = {
  // Seseragi
  suisha: ['fuchi', 'furukawa'],
  hatake: ['umezono', 'numata', 'sagi'],
  umezono: ['kamimori', 'yamagoya', 'kikori'],
  shidanohara: ['kamimori', 'fuchi', 'sagi'],
  sagi: ['ukishima', 'furukawa'],
  fuchi: ['koishihama', 'hazama', 'takaishi'],
  kamimori: ['takaishi', 'yamagoya', 'fuchi', 'shidanohara', 'umezono', 'sumiyaki', 'kikori'],
  // Sora knows the mountain above the hut: exploring from home finds the falls and hears of the tarn.
  yamagoya: ['taki', 'kagami', 'hazama', 'fuchi'],
  hazama: ['taki', 'takaishi'],
  taki: ['izumi', 'kagami'],
  takaishi: ['hanano'],
  hanano: ['shimomori', 'shimizu'],
  shimomori: ['kaede'],
  kagami: ['matsuyama', 'sumiyaki'],
  matsuyama: ['izumi'],
  furumichi: ['numata', 'ashihara'],
  ashihara: ['kaede'],
  ukishima: ['furukawa'],
  furukawa: [],
  // Mio
  toroya: ['tanada', 'makiba', 'yanagi'],
  ringozaka: ['hachiya', 'ishigawara'],
  kurumaya: ['yanagi', 'tanada', 'ishigawara'],
  tanada: ['jizo', 'nishibayashi'],
  yanagi: ['omagari', 'mukoniwa'],
  makiba: ['nishibayashi', 'miyamori'],
  nishibayashi: ['jizo', 'omagari', 'miyamori', 'takebayashi'],
  jizo: ['omagari'],
  omagari: ['ashiura', 'sugawara'],
  mukoniwa: ['kitsuneyama', 'higashida', 'higashimori'],
  kitsuneyama: ['higashida'],
  higashida: ['chabatake'],
  miyamori:['nishibayashi'],
  higashimori:['kitsuneyama','higashida','chabatake'],
  // Kawagiri
  ashikari: ['shiobashi', 'matsubara'],
  shiobashi: ['east-marsh'],
  kawagiri: ['funaya', 'takayuka', 'far-shore', 'kawaguchi', 'todai', 'fish-traps', 'east-marsh'],
  takayuka: ['funaya', 'fish-traps', 'shiohara'],
  shirasagi: ['aonuma', 'ashikari', 'matsubara'],
  hosokawa: ['fish-traps', 'funaya'],
  'fish-traps': ['east-marsh'],
  'east-marsh': ['far-shore'],
  matsubara: ['aonuma', 'ashikari', 'shiodamari'],
  funaya: ['shiohara'],
  shiohara: ['shiokawa', 'iso', 'shirahama', 'kawaguchi', 'amiya'],
  shiokawa: ['kawaguchi'],
  kawaguchi: ['todai', 'shirahama'],
  shirahama: ['iso', 'todai'],
};

/** The mountain above Seseragi: optional ground off the road south, offered at most once a morning. */
export const UPLANDS: ReadonlySet<string> = new Set(['yamagoya', 'taki', 'kagami', 'matsuyama', 'izumi', 'sumiyaki', 'hazama', 'takaishi', 'hanano']);
/** The mountain's own small stories: certain when sought, never part of the road south. */
export const UPLAND_STORIES: ReadonlySet<string> = new Set(['hut-book', 'burner', 'first-water']);

/** What is said of a place before anyone has been. A hint, never its name. */
export const RUMOURS: Readonly<Record<string, string>> = {
  taki: 'The roar of a waterfall up the valley.',
  kagami: 'A still water high under the peaks.',
  takaishi: 'The Old Ford: stepping stones below the falls.',
  hazama: 'A ledge path into the gorge.',
  fuchi: 'A deep pool where the gorge opens.',
  koishihama: 'Clean stones below the deep pool, at low water.',
  kamimori: 'Deer paths into the western wood.',
  hanano: 'A high meadow across the river.',
  shimomori: 'An oak wood above the side valley.',
  ukishima: 'Lanterns on a knoll among cherries.',
  furukawa: 'An old dry river bed across the meadow.',
  furumichi: 'Cart ruts going south under the grass.',
  ashihara: 'Reeds on the far side of the lower river.',
  yamagoya: 'A hut on the shelf below the falls.',
  matsuyama: 'Old pines on the mountain shoulder.',
  sumiyaki: 'Smoke from the western pines.',
  izumi: 'Spring water tumbling down the waterfall.',
  kaede: 'One great tree alone on the far bank.',
  shimizu: 'A cold spring under the eastern ridge.',
  kikori: 'Axes ringing west of the orchard path.',
  chabatake: 'Rows of tea bushes above the east farm.',
  takebayashi: 'Bamboo creaking past the western woods.',
  shiodamari: 'Tide pools in the rocks beyond the pines.',
  amiya: 'Nets drying out on the salt flats.',
  numata: 'Marsh birds calling at the valley’s foot.',
  yanagi: 'Willows trailing in the river below the mill.',
  nishibayashi: 'A wood on the slope above the bend.',
  omagari: 'Where the river swings wide into reeds.',
  ashiura: 'A bay full of birds inside the bend.',
  mukoniwa: 'Roses over a wall on the far bank.',
  kitsuneyama: 'A shrine on the hill across the river.',
  hachiya: 'Bees humming above the orchard.',
  ishigawara: 'Shallow bright water over stones.',
  makiba: 'Sheep bells on the western hill.',
  tanada: 'Water stepping down terraces below the village.',
  jizo: 'A small shrine by the road south.',
  higashida: 'Haystacks across the narrows.',
  sugawara: 'Sand inside the bend, when the water drops.',
  'fish-traps': 'Woven fish traps in the current below the reedlands.',
  'east-marsh': 'Heron pools beside the raised eastern path to Kawagiri.',
  'far-shore': 'A quiet beach beyond the eastern marsh.',
  miyamori:'A cedar path in the deep western wood.',
  higashimori:'A high wood above the far bank.',
  funaya: 'Old hulls by the water.',
  matsubara: 'Wind-bent pines on a sandy rise.',
  shiohara: 'Salt flowers where the water turns brackish.',
  iso: 'Dark rocks and pools at the sea’s edge.',
  shirahama: 'A white beach at the river mouth.',
  kawaguchi: 'The place where the river meets the sea.',
  aonuma: 'Herons standing in a pond in the reeds.',
  ashikari: 'Bundles of cut reeds by a hut.',
  shiokawa: 'Where the tide stops in a salt creek.',
  todai: 'A light at the river mouth.',
  // Known from the start of a Journey; in Free Play, only heard of at first.
  suisha: 'A mill wheel turning by Seseragi.',
  hatake: 'Kitchen plots below Seseragi.',
  umezono: 'Plum trees on the slope above Seseragi.',
  shidanohara: 'A fern clearing on the road to the woods.',
  sagi: 'Herons fishing in the water meadow.',
  shiobashi: 'A little stone bridge above the estuary.',
  shirasagi: 'White birds over the reeds where the banks flatten.',
  takayuka: 'Houses on stilts by a landing.',
  hosokawa: 'A narrow creek winding through the reeds.',
};

/** Known when each reach is first reached. */
export const KNOWN_AT_START: Readonly<Record<number, readonly string[]>> = {
  0: ['seseragi', 'suisha', 'hatake', 'kamimori'],
  1: ['mio', 'toroya', 'ringozaka', 'kurumaya'],
  2: ['ashikari', 'shiobashi', 'shirasagi', 'hosokawa'],
};

/** Kawagiri when the high path brings the group down the east bank, straight to the village. */
export const EAST_ARRIVAL = {
  known: ['kawagiri', 'shiobashi', 'east-marsh', 'fish-traps'],
  heard: ['takayuka', 'funaya', 'matsubara'],
} as const;

/** Heard of from home, before anyone has explored. */
export const HEARD_AT_START: Readonly<Record<number, readonly string[]>> = {
  0: [],
  1: ['yanagi', 'makiba', 'nishibayashi'],
  2: ['matsubara', 'shiohara'],
};

/**
 * Free Play's first map. Haru and Yui make camp at Mio, mid-river, and know
 * only its own corner, the two other villages by name, and a few paths heard
 * of upstream and down. Everything else is found by going.
 */
export const FREE_PLAY_START = {
  known: [...KNOWN_AT_START[1]!, 'seseragi', 'kawagiri'],
  heard: [...HEARD_AT_START[1]!, 'furumichi', 'suisha', 'shirasagi', 'hosokawa'],
};

/** Which way a place lies from home. */
export function directionOf(id: string): Direction {
  const place = placeDef(id);
  if (place.crossing) return 'across';
  const home: Vec = REGIONS[place.region]!.settlement;
  return place.at.y < home.y - 150 ? 'upstream' : 'downstream';
}

export const rumourOf = (id: string): string => RUMOURS[id] ?? 'A way on, not yet found.';

/** How many places in a reach nobody has heard of, by direction. */
export function frontierOf(region: number, known: readonly string[], rumoured: readonly string[]): Record<Direction, number> {
  const counts: Record<Direction, number> = { upstream: 0, across: 0, downstream: 0 };
  for (const place of PLACES) {
    if (place.region !== region || isSecretPlace(place.id) || known.includes(place.id) || rumoured.includes(place.id)) continue;
    counts[directionOf(place.id)]++;
  }
  return counts;
}

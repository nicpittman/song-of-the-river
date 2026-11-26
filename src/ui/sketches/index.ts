/**
 * Ink sketches: every small drawing the interface shows (friends, finds,
 * structures, tools, places) as inline SVG in forest-green pen line with one
 * or two pale washes, plus the small marks used beside text (chance pips, the
 * pack knot, leads, place states, weather, seasons).
 *
 * Ids: `friend-<id>`, `structure-<kind>`, `item-<equipment>`, `place-<habitat>`,
 * and a discovery's own id for finds. An id without its own drawing falls back
 * (see `fallbackFor`): to a generic drawing for its journal category if it is
 * a find in `content.ts` (a small bird, a fish, a plant, a creature's tracks,
 * a keepsake parcel, a figure, a small view); to one chosen by a keyword in
 * the id (fish, bird, feather, antler, den, flower, leaf, mushroom, stone,
 * shell, track, map, letter, tool, star); to one chosen by its prefix; and
 * finally to a small leaf sprig, so new content never shows a blank.
 */

import { FINDS as FIND_DEFS } from '../../game/adventure/content';
import type { JournalCategory } from '../../game/adventure/model';
import { FALLBACKS } from './fallbacks';
import { FINDS } from './finds';
import { ARRIVALS } from './arrivals';
import { WISH_SKETCHES } from './wishes';
import { WANDER_SKETCHES } from './wander';
import { FRIENDS } from './friends';
import { ITEMS } from './items';
import { PLACES } from './places';
import { MORE_PLACES } from './places-more';
import { render, type Drawing } from './pen';
import { STRUCTURES } from './structures';

export { resourceMark, knot, leadMark, pips, placeMark, seasonMark, weatherMark } from './marks';
export { portrait } from './portrait';
export type { PortraitOptions } from './portrait';
export type { Chance, KnotKind, PlaceState, WeatherKind } from './marks';

export interface SketchOptions {
  /** False draws the dotted outline of something not yet found. Default true. */
  found?: boolean;
  /** Box size in CSS pixels. Default 48. */
  size?: number;
}

/** Every drawing made for a specific id, by kind. */
const BESPOKE: Record<string, Drawing> = { ...FRIENDS, ...STRUCTURES, ...ITEMS, ...PLACES, ...MORE_PLACES, ...FINDS, ...ARRIVALS, ...WISH_SKETCHES, 'seseragi-welcome': {wash:[['straw','M5 26 17 14 29 26v14H5Z'],['blossom','M32 39c0-5 3-9 6-12 2 3 6 7 6 12Z']],line:['M3 27 17 13 31 27M7 24v16h20V24M14 40v-9h6v9','M32 41l12-3M32 38l12 3','M38 37c-3-2-3-6 0-10 0 3 3 4 2 7 2-1 2-3 1-4 2 3 1 6-3 7'],detail:['M9 21h16M3 42h42','M38 23c-2-2 1-3-1-5M41 21c-1-2 1-3 0-4'],dots:[[34.5,30,0.5],[42,29,0.45]]}, 'ren-meeting': FRIENDS['friend-ren']!, 'mina-meeting': FRIENDS['friend-mina']!,
  'sora-meeting': FRIENDS['friend-sora']!, 'bathing-monkeys': FINDS['snow-monkeys']!,
  // Worked-out finds drawn with their nearest kin: cress by a spring, a hollow tree, a heron.
  'hidden-spring': FINDS['watercress']!, 'wild-hive': FINDS['hollow-oak']!, 'mist-herons': FINDS['heron']!, ...WANDER_SKETCHES };

/** The keyword fallbacks, in the order they are tried. A word in the id matching any listed word picks that drawing. */
const KEYWORDS: Array<[string, string[]]> = [
  ['any-fish', ['fish', 'salmon', 'trout', 'carp', 'ayu', 'eel', 'minnow', 'catch', 'cast']],
  ['any-feather', ['feather', 'feathers', 'quill', 'plume', 'moult']],
  ['any-antler', ['antler', 'antlers', 'horn', 'horns']],
  ['any-den', ['den', 'dens', 'burrow', 'sett', 'lair', 'earth', 'nest']],
  ['any-bird', ['bird', 'heron', 'crane', 'duck', 'kingfisher', 'owl', 'swallow', 'egret', 'wing', 'wings', 'migrant', 'migrants', 'goose', 'gull']],
  ['any-mushroom', ['mushroom', 'fungus', 'toadstool', 'shiitake']],
  ['any-flower', ['flower', 'blossom', 'bloom', 'petal', 'iris', 'lily', 'camellia']],
  ['any-leaf', ['leaf', 'leaves', 'fern', 'moss', 'willow', 'reed', 'reeds', 'grass', 'herb', 'cutting', 'sprout', 'seed', 'seeds']],
  ['any-shell', ['shell', 'snail', 'clam', 'tide', 'oyster']],
  ['any-stone', ['stone', 'stones', 'rock', 'pebble', 'glass', 'gem', 'bead', 'crystal']],
  ['any-track', ['track', 'tracks', 'print', 'prints', 'snowprint', 'paw', 'footprint', 'hoofprint', 'trail', 'spoor', 'slot', 'slots', 'sign', 'signs', 'slide', 'scrape', 'form']],
  ['any-map', ['map', 'chart', 'road', 'route']],
  ['any-letter', ['letter', 'note', 'notes', 'story', 'plans', 'ledger', 'book', 'scroll', 'page']],
  ['any-parcel', ['parcel', 'gift', 'bundle', 'package']],
  ['any-tool', ['tool', 'tools', 'kit', 'staff', 'rod', 'saw', 'hammer', 'rope', 'sail', 'sailcloth', 'cape']],
  ['any-star', ['star', 'reflection', 'wish', 'light', 'moon', 'sun', 'lantern']],
];

/** A find without a drawing of its own is drawn as a generic member of its journal category. */
const BY_CATEGORY: Record<JournalCategory, string> = {
  birds: 'any-bird',
  fish: 'any-fish',
  plants: 'any-leaf',
  wildlife: 'any-track',
  keepsakes: 'any-parcel',
  encounters: 'any-person',
  curiosities: 'any-place',
};

const CATEGORY_OF = new Map<string, JournalCategory>(FIND_DEFS.map((f) => [f.id, f.category]));

/**
 * Broad categories, where a thing named in the id (a feather, an antler, a
 * den, tracks, a shell) is a better guess than the category's generic drawing.
 * Birds, fish, plants and people are drawn by category first.
 */
const NAMED_FIRST = new Set<JournalCategory>(['wildlife', 'keepsakes', 'curiosities']);

/** Signs an animal leaves. Named in an id, they win in any category: heron prints are tracks, not a bird. */
const SIGNS = new Set(['any-track', 'any-feather', 'any-den', 'any-antler']);

/** When no keyword matches, the id's prefix still says what sort of thing it is. */
const PREFIXES: Array<[string, string]> = [
  ['friend-', 'any-person'],
  ['structure-', 'any-structure'],
  ['item-', 'any-tool'],
  ['place-', 'any-place'],
];

/** The drawing id an unknown id falls back to. */
export function fallbackFor(id: string): string {
  const words = id.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const matches = KEYWORDS.filter(([, keys]) => words.some((w) => keys.includes(w))).map(([fallback]) => fallback);
  const named = matches.find((m) => SIGNS.has(m)) ?? matches[0];
  const category = CATEGORY_OF.get(id);
  if (category) {
    if (named && (SIGNS.has(named) || NAMED_FIRST.has(category))) return named;
    return BY_CATEGORY[category];
  }
  if (named) return named;
  // A second, looser pass: a keyword inside a compound word ("goldfish", "seashell").
  for (const [fallback, keys] of KEYWORDS) if (keys.some((k) => k.length > 3 && id.includes(k))) return fallback;
  for (const [prefix, fallback] of PREFIXES) if (id.startsWith(prefix)) return fallback;
  return 'any-sprig';
}

/** True when this id has a drawing of its own rather than a fallback. */
export function hasSketch(id: string): boolean {
  return id in BESPOKE;
}

/** Returns inline SVG markup for the sketch with this id. */
export function sketch(id: string, options: SketchOptions = {}): string {
  const found = options.found !== false;
  const size = options.size ?? 48;
  const drawing = BESPOKE[id] ?? FALLBACKS[id] ?? FALLBACKS[fallbackFor(id)] ?? FALLBACKS['any-sprig'] ?? FRIENDS['friend-sora'];
  return render(id, drawing, { found, size });
}

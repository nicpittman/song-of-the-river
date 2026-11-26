/**
 * How each kind of creature behaves when it shows itself, and which painted
 * frames it uses. Species ids come from the rules (an art or sketch id) and
 * are matched loosely: `salmon`, `cherry-salmon` and `fish` all rise; `heron`
 * and `crane` glide down and land; anything unknown perches like a small bird.
 */

import type { Art, ArtLibrary } from '../art';

export type Family = 'fish' | 'wader' | 'swimmer' | 'runner' | 'flutter' | 'percher';

const FAMILIES: Array<[RegExp, Family]> = [
  // Before the fish: a kingfisher perches, it does not leap from the water.
  [/kingfisher/, 'percher'],
  [/salmon|carp|trout|fish|char|eel|mullet/, 'fish'],
  [/heron|crane|egret|stork/, 'wader'],
  [/duck|swan|goose|otter|grebe|teal|mandarin|seal/, 'swimmer'],
  [/sheep|deer|stag|fawn|fox|hare|tanuki|serow|marten|boar|bear|wolf|squirrel|frog|badger|leopard|monkey/, 'runner'],
  [/butterfl|swallowtail|dragonfl|moth|bee/, 'flutter'],
];

/** Closest painted creature for a species id, for ids that are not art themselves. */
const STAND_INS: Array<[RegExp, string]> = [
  // Names that would otherwise catch on a later pattern: a kingfisher is no fish, a hawk-moth no hawk, a swallowtail no swallow.
  [/kingfisher/, 'kingfisher'],
  [/moth|swallowtail/, 'butterfly'],
  [/seal/, 'seal'],
  [/salmon/, 'salmon'],
  [/carp/, 'carp-jump'],
  [/fish|trout|char|mullet/, 'salmon'],
  [/heron/, 'heron'],
  [/crane|egret|stork/, 'crane-stand'],
  [/duck|teal|grebe|mandarin/, 'duck'],
  [/swan|goose/, 'swan'],
  [/otter/, 'otter-0'],
  [/stag/, 'stag-walk-0'],
  [/fawn/, 'fawn-walk-0'],
  [/deer/, 'deer'],
  [/sheep/, 'sheep-0'],
  [/fox/, 'fox'],
  [/hare|rabbit/, 'hare-0'],
  [/tanuki|badger/, 'tanuki-0'],
  [/butterfl/, 'butterfly'],
  [/dragonfl/, 'dragonfly'],
  [/kingfisher|blue/, 'kingfisher'],
  // Perchers in their own colours, rather than every small bird a kingfisher.
  [/dipper/, 'dipper'],
  [/woodpecker/, 'woodpecker'],
  [/bush-warbler/, 'bush-warbler'],
  [/skylark|lark/, 'skylark'],
  [/wagtail/, 'wagtail'],
  [/white-eye/, 'white-eye'],
  [/bunting/, 'reed-bunting'],
  [/cormorant/, 'cormorant'],
  [/pheasant/, 'pheasant'],
  [/swallow/, 'swallow-0'],
  [/hawk|kite|eagle/, 'hawk-0'],
  [/owl/, 'owl'],
  [/frog/, 'frog'],
  [/monkey/, 'monkey'],
  [/boar/, 'boar-0'],
  [/gull/, 'gull-0'],
  // Shore birds in a little flock, rather than the kingfisher's perch.
  [/oystercatcher|sanderling|plover/, 'small-birds'],
];

/** Colours washed over the shared butterfly drawing: a pale green moon moth, a dusky hawk-moth, a yellow swallowtail. */
const TINTS: Array<[RegExp, number]> = [
  [/moon-moth/, 0xcfe8b4],
  [/hawk-moth/, 0xb8977a],
  [/swallowtail/, 0xf3d873],
];

export interface Creature {
  family: Family;
  /** Standing (or swimming) still. */
  still: Art;
  /** Walking or running frames, for runners. */
  gait: Art[];
  /** Flying frames, for birds arriving and leaving. */
  flying: Art[];
  /** A heron's strike. */
  strike: Art | null;
  /** A wash over plain art, so one butterfly drawing serves the moths and swallowtails in their own colours. */
  tint: number;
}

function arts(art: ArtLibrary, ids: readonly string[]): Art[] {
  return ids.map((id) => art.get(id));
}

export function creatureOf(species: string, art: ArtLibrary): Creature {
  const id = species.toLowerCase();
  const family = FAMILIES.find(([re]) => re.test(id))?.[1] ?? 'percher';
  let stillId = art.known(id) ? id : STAND_INS.find(([re]) => re.test(id))?.[1] ?? (family === 'percher' ? 'songbird' : 'bird-up');
  if (stillId === 'carp-jump' || stillId === 'salmon') stillId = art.known('carp-jump') && id.includes('carp') ? 'carp-jump' : 'salmon';
  const base = stillId.replace(/-(walk|run)?-?\d$/, '');
  const gaitIds = [`${base}-walk`, `${base}-run`, base].map((p) => art.frames(p)).find((frames) => frames.length > 1) ?? [];
  const flyIds = family === 'wader' ? art.frames('crane-fly') : family === 'percher' ? (art.frames(base).length > 1 ? art.frames(base) : ['bird-up', 'bird-down']) : [];
  return {
    family,
    // A walking creature keeps the same identity and right-facing convention when it stops.
    still: art.get(family === 'runner' && gaitIds.length > 1 ? gaitIds[0]! : stillId),
    gait: arts(art, gaitIds),
    flying: arts(art, flyIds),
    strike: family === 'wader' && art.known('heron-strike') && id.includes('heron') ? art.get('heron-strike') : null,
    tint: TINTS.find(([re]) => re.test(id))?.[1] ?? 0xffffff,
  };
}

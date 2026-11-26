/**
 * The course of a Journey: each run is its own year on the river. The valley
 * is the same, but a few things are settled from the run's seed when Sora
 * sets out:
 *
 *  - where Ren is fishing (the deep pool at Fuchi, the high tarn at
 *    Kagami-numa, or the plunge pool under Taki's falls);
 *  - where Mina is gathering (her herbs by the village, or the Kamimori woods);
 *  - the way down from Mio: the stakes in Omagari's reeds at low water, the
 *    herons over Kitsuneyama (which Mukoniwa's gardener watches) on a clear
 *    day, or the old ridge track above Higashimori at high water, which comes
 *    down the eastern shore to Kawagiri itself.
 *
 * The seed favours one set of clues, but all three routes remain valid. A
 * cottage never obliges the player to build a bridge as well.
 */

import { hashString, mulberry32 } from '../core/rng';

export const REN_SPOTS = ['fuchi', 'kagami', 'taki'] as const;
export const MINA_SPOTS = ['seseragi', 'kamimori'] as const;
export const WAYS = ['reeds', 'herons', 'high-path'] as const;

export type RenSpot = (typeof REN_SPOTS)[number];
export type MinaSpot = (typeof MINA_SPOTS)[number];
export type Way = (typeof WAYS)[number];

export interface Course {
  ren: RenSpot;
  mina: MinaSpot;
  way: Way;
}

export const USUAL_COURSE: Course = { ren: 'fuchi', mina: 'seseragi', way: 'reeds' };

export function courseOf(seed: number): Course {
  const rng = mulberry32(hashString(`course:${seed}`));
  const pick = <T>(options: readonly T[]): T => options[Math.floor(rng() * options.length)]!;
  return { ren: pick(REN_SPOTS), mina: pick(MINA_SPOTS), way: pick(WAYS) };
}

/** What the valley says about Ren before anyone has met him. */
export const REN_WORDS: Record<RenSpot, { goal: string; lead: string; suggest: string; fish: string }> = {
  fuchi: {
    goal: 'Follow the water down to Fuchi. Someone fishes the deep pool there, and knows the valley below.',
    lead: 'Someone has been fishing the deep pool at Fuchi, and might know the valley below.',
    suggest: 'A fisher waits beside the deep pool downstream.',
    fish: 'Ren knows the deep pool. Fish for the journey.',
  },
  kagami: {
    goal: 'Someone is fishing the high tarn at Kagami-numa. A fisher up here may know the valley below.',
    lead: 'A line of smoke over Kagami-numa: someone is fishing the high tarn, and might know the valley below.',
    suggest: 'Someone is fishing the high tarn, where the swans rest.',
    fish: 'Ren knows the tarn’s cold water. Fish for the journey.',
  },
  taki: {
    goal: 'Someone is camped by Taki’s falls, waiting for the white water to settle. Climb up and ask about the valley below.',
    lead: 'A rod was propped by Taki’s falls today, waiting for the melt to drop. Whoever it belongs to might know the valley below.',
    suggest: 'Someone sits by the roaring falls upstream, watching the white water.',
    fish: 'Ren has watched the plunge pool since the thaw. Fish for the journey.',
  },
};

/** Where this year began and how it came down, for the very end: "This year we found Ren at Taki, …". */
const REN_FOUND: Record<RenSpot, string> = { fuchi: 'by the deep pool at Fuchi', kagami: 'up at the high tarn', taki: 'waiting out the melt at Taki' };
const WAY_DOWN: Record<Way, string> = { reeds: 'by the old stakes through the reeds', herons: 'following the herons', 'high-path': 'along the high path' };
export function courseLine(course: Course): string {
  return `This year we found Ren ${REN_FOUND[course.ren]}, and came down from Mio ${WAY_DOWN[course.way]}. Rivers change. There were other ways down.`;
}

/** The way down from Mio this year: the find that shows it and where it is found. */
export const WAY_ROUTES: Record<Way, { find: string; place: string }> = {
  reeds: { find: 'reed-way', place: 'omagari' },
  herons: { find: 'heron-way', place: 'kitsuneyama' },
  'high-path': { find: 'high-path', place: 'higashimori' },
};

/** Where the friends first sleep in Kawagiri: the reed cutters' hut, or (down the east bank) the village itself. */
export const arrivalOf = (course: Course): 'ashikari' | 'kawagiri' => (course.way === 'high-path' ? 'kawagiri' : 'ashikari');

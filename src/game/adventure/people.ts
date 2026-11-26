/**
 * The cast. Sora starts at the mountain hut, meeting Ren and Mina downstream; Haru keeps a camp
 * in Kawagiri; Aki joins in Mio and Yui in Kawagiri. Each has a gift (the activity they are best at) and a
 * nature, which decides what they do at a fork when the player leaves it to them.
 */

import type { Activity, OutingPlan } from './model';

/** What a friend does at a fork if nobody answers: follow it on, or stay and see. */
export type Nature = 'follow' | 'stay';

export interface PersonDef {
  id: string;
  name: string;
  role: string;
  /** The one strong garment colour the valley layer paints them in. */
  colour: string;
  gift: Activity;
  /** Walking pace; a single physical difference, without a skill sheet. */
  pace: number;
  nature: Nature;
  ambition: string;
  /** The forecast reason when they go out on their gift: "Ren knows this water". */
  giftReason: string;
  /**
   * A line each on reaching Mio, on reaching Kawagiri, and on sailing for the
   * sea, told as narration that names the friend: kept as memories, and the
   * first of them told in the morning's news. Empty where the friend was not
   * there yet.
   */
  story: [string, string, string];
  /** What they say as they step aboard for the sea, in their own voice. */
  aboard: string;
}

export const PEOPLE: readonly PersonDef[] = [
  {
    id: 'sora', pace: 240, name: 'Sora', role: 'The mountain boy', colour: '#9c5a3c', gift: 'explore', nature: 'follow',
    ambition: 'See the sea he has dreamed of since childhood.',
    giftReason: 'Sora has a nose for new ground',
    story: ['Sora has never walked this far. He says so twice, grinning.', 'Sora sniffs the wind. He is almost sure it smells of the sea.', 'Sora is first aboard, and the last to stop looking back.'],
    aboard: '“One more look at the mountain. All right.”',
  },
  {
    id: 'ren', pace: 180, name: 'Ren', role: 'The fisher', colour: '#4f7488', gift: 'fish', nature: 'stay',
    ambition: 'Find where the river begins to taste of salt.',
    giftReason: 'Ren knows this water',
    story: ['Ren tastes the river. Softer down here, he says.', 'Gulls and reeds. Ren tastes the water again: different, but not salt. Not yet.', 'Ren trails a line behind the boat, all the way out.'],
    aboard: '“Never been on a boat that wasn’t tied to something.”',
  },
  {
    id: 'mina', pace: 205, name: 'Mina', role: 'The botanist', colour: '#6f8150', gift: 'forage', nature: 'stay',
    ambition: 'Plant something from every reach of the river.',
    giftReason: 'Mina has a botanist’s eye',
    story: ['Mina has started a new seed bag for this reach, and labels it carefully.', 'Mina’s seed bags are nearly full.', 'Mina plants the last seed from home beside the dock.'],
    aboard: '“Last seed from home, planted by the dock. Now I can go.”',
  },
  {
    id: 'aki', pace: 190, name: 'Aki', role: 'The carpenter', colour: '#8a6a4a', gift: 'investigate', nature: 'stay',
    ambition: 'Build a boat that can carry a small garden.',
    giftReason: 'Aki reads old work closely',
    story: ['', 'Aki is past the reeds now, farther than Grandfather got. He sketches hulls in every margin.', 'Aki checks every plank twice, then laughs. “He’d have liked her.”'],
    aboard: '“He wrote he’d come back for her when I could row. I can row. Cast off.”',
  },
  {
    id: 'haru', pace: 250, name: 'Haru', role: 'The hunter', colour: '#6d7a3e', gift: 'track', nature: 'follow',
    ambition: 'Learn every track between the mountains and the sea.',
    giftReason: 'Haru reads the signs',
    story: ['', 'The sideways tracks were crabs. Haru laughed for a mile.', 'Haru counts the gulls, and loses count.'],
    aboard: '“No tracks out there. I’ll learn to read the water.”',
  },
  {
    id: 'yui', pace: 175, name: 'Yui', role: 'The keeper of stories', colour: '#8c6f86', gift: 'visit', nature: 'stay',
    ambition: 'Bring home a story nobody has heard.',
    giftReason: 'Yui is easy to talk to',
    story: ['', 'Yui asks “And then?” at every pause, until there is nothing left to tell.', 'Yui begins a new story on the first page: ours.'],
    aboard: '“Forty years of other people’s endings. Now mine.”',
  },
];

/** Homes in Free Play: Haru and Yui camp at Mio; everyone else keeps their own home along the river, and comes along once met. */
export const FREE_PLAY_HOMES: Readonly<Record<string, { base: number; lodging?: string }>> = {
  haru: { base: 1 },
  yui: { base: 1 },
  sora: { base: 0, lodging: 'yamagoya' },
  ren: { base: 0 },
  mina: { base: 0 },
  aki: { base: 1 },
};

/** Free Play sets out with these two: Haru leads, and Yui comes for a story of her own. */
export const FREE_PLAY_GROUP = ['haru', 'yui'] as const;
/** Free Play's friends as the notebook lists them: the two who set out, then the river from the springs down. */
export const FREE_PLAY_ORDER: readonly string[] = [...FREE_PLAY_GROUP, 'sora', 'ren', 'mina', 'aki'];

/** The first three friends: the established group the journey tests start from. */
export const FOUNDERS = ['sora', 'ren', 'mina'] as const;

export function personDef(id: string): PersonDef {
  const person = PEOPLE.find((p) => p.id === id);
  if (!person) throw new Error(`Unknown person ${id}`);
  return person;
}

export const nameOf = (id: string): string => PEOPLE.find((p) => p.id === id)?.name ?? 'Someone';

export function outingPace(plan: OutingPlan): number {
  return Math.min(personDef(plan.person).pace, plan.companion ? personDef(plan.companion).pace : Infinity);
}

/** Small, reusable story beats. The journey stays in the landscape and notebook. */
import type { AdventureState } from './state';

export const OPENING = 'Sora grew up among the mountains, dreaming of the sea. As the spring snow begins to melt, he decides to leave Yamagoya and follow the river south. He has never been this way before.';
export const SESERAGI_LEAD = 'Ren points out Seseragi’s roofs farther down the valley. There is a fire by the mill.';

export interface MeetingLine {
  speaker: 'traveller' | 'resident';
  text: string;
  /** A little room for a gesture or a joke to land, in real seconds. */
  pause?: number;
}
const traveller = (text: string, pause?: number): MeetingLine => ({ speaker: 'traveller', text, pause });
const resident = (text: string, pause?: number): MeetingLine => ({ speaker: 'resident', text, pause });

/** Brief exchanges, with a reply to an invitation rather than an unanswered monologue. */
const MEETING_WORDS: Record<string, readonly MeetingLine[]> = {
  'boatyard-moulds': [
    traveller('“Could a little boat carry us out to sea?”'),
    resident('“A young carpenter from Mio learned on those moulds, long ago. He went home to build one of his own.”', .3),
    traveller('“That was Aki’s grandfather!”'),
    resident('“Then she’s waiting for you. Patch her by a dock, wait for a sound sail and a falling tide. She’ll take you.”'),
  ],
  miller: [
    traveller('“Is there a road south?”'),
    resident('“Furumichi. Here, let me… oh. Spilt my tea.”', .35),
    traveller('“Your tea!”'),
    resident('“Never mind. Here’s the river. I’ll draw the road beside it.”'),
    traveller('“Will it take us to Mio?”'),
    resident('“Past the lower fields. Look for the waymark.”'),
  ],
  ren: [
    traveller('“Does this river reach the sea?”'),
    resident('“It had better. All this water, and not a pinch of salt in it.”', .35),
    traveller('“I’m going to find it.”'),
    resident('“Then I’m coming. Someone has to cook.”'),
    traveller('“Thank you. I’d like that.”'),
    resident('“Look. Those roofs below. Seseragi. We can stop there.”'),
  ],
  mina: [
    traveller('“Hey there. What are you doing?”'),
    resident('“Picking mint. Here, rub a leaf, then smell.”', .3),
    traveller('“Oh, we can take some of that with us to the sea.”'),
    resident('“The sea? I’d like to see what grows there. Room for one more?”'),
    traveller('“Please do. There’s room by our fire.”'),
  ],
  aki: [
    traveller('“We’re following the river to the sea.”'),
    resident('“Grandfather built a boat for that. She got as far as the reeds.”', .3),
    traveller('“What stopped him?”'),
    resident('“Mio. Always one more roof to mend. He never went back for her.”', .3),
    traveller('“Will you come with us?”'),
    resident('“First, I promised Mio a cottage or a footbridge. Then I’ll come with you, and take Grandfather’s boat the rest of the way.”'),
  ],
  haru: [
    traveller('“Are those tracks?”'),
    resident('“No idea. They go sideways. I nearly followed them home.”', .35),
    traveller('“We’re looking for the sea.”'),
    resident('“You’re here. From somewhere high you’d see how far it goes.”'),
    traveller('“You won’t come?”'),
    resident('“Someone has to watch the pines. One day I’ll walk it the other way, right up to the snow. Wave when you sail past.”'),
  ],
  yui: [
    traveller('“We’re following the river out to sea.”'),
    resident('“I’ve lived beside it all my life. I’ve only heard stories of what’s past it.”'),
    traveller('“Will you tell us one?”'),
    resident('“May I come instead? I’d like a story of my own.”', .25),
    traveller('“I’d love that.”'),
    resident('“Then I’ll start packing. I’ve kept a few things put by for a day like this.”'),
  ],
};
/** Free Play is quieter: a line each way at a meeting. Anyone met comes along, except Sora, who has his own journey. */
const FREE_WORDS: Record<string, readonly MeetingLine[]> = {
  sora: [
    traveller('“We walked up from the sea.”'),
    resident('“The sea? I’m going there myself one day. My own way, though.”'),
  ],
  ren: [
    traveller('“Catching anything?”'),
    resident('“Plenty. Not a pinch of salt in any of them. Mind if I come along?”'),
  ],
  mina: [
    traveller('“What are you picking?”'),
    resident('“Mint. Rub a leaf. I’d like to see what grows by the sea.”'),
  ],
  aki: [
    traveller('“That roof looks nearly done.”'),
    resident('“Nearly. Bring me good timber and I’ll build you anything.”'),
  ],
  miller: [
    traveller('“Do you know the roads round here?”'),
    resident('“Every one. I’ll draw them beside the river.”'),
  ],
};
const REN_AT_MILL = [
  traveller('“Still turning, then?”'),
  resident('“Ren! Has the river run out of fish?”'),
  traveller('“No. We’re going to see if the sea has any.”'),
  resident('“Furumichi, below the village. Here, let me… oh. Spilt my tea.”', .35),
  traveller('“Your tea’s halfway to the sea already.”'),
  resident('“A river on my table. I’ll draw the road in the tea beside it. Past the fields, the waymark to Mio.”'),
] as const;
const REN_MEETS_MINA = [
  traveller('“We’re going south. The fish still need salt.”'),
  ...MEETING_WORDS.mina!.slice(1),
] as const;

/** The same remembered exchange is used in the world and in the notebook. */
export function meetingWords(person: string, visitor: string, free = false): readonly MeetingLine[] | undefined {
  if (free) return FREE_WORDS[person] ?? MEETING_WORDS[person]?.slice(0, 2);
  if (person === 'miller' && visitor === 'ren') return REN_AT_MILL;
  if (person === 'mina' && visitor === 'ren') return REN_MEETS_MINA;
  return MEETING_WORDS[person];
}

/** What the valley says of the reaches not yet followed, for the River Map: a rumour each, keyed by region id. */
export const REACH_AHEAD: Record<string, string> = {
  mio: 'Orchards, a lantern-lit inn, and a long slow bend, they say. Somebody there still remembers the boats.',
  kawagiri: 'Reeds, boats drawn up on the sand, and a light over the water. Ren says he will know it by the taste.',
};

export interface MeetingTiming {
  /** Simulation seconds per real second; independent of the chosen travel speed. */
  rate: number;
  lines: Array<MeetingLine & { start: number; end: number }>;
}
const timings = new WeakMap<readonly MeetingLine[], Map<number, MeetingTiming>>();

/** Fit the existing visit budget while giving each line its own natural reading time. */
export function meetingTiming(words: readonly MeetingLine[], available: number): MeetingTiming {
  let cache = timings.get(words);
  if (!cache) { cache = new Map(); timings.set(words, cache); }
  const known = cache.get(available);
  if (known) return known;
  const seconds = words.map(line => {
    const count = line.text.trim().split(/\s+/).length;
    const punctuation = (line.text.match(/[,.?!…]/g) ?? []).length;
    return Math.max(1.6, Math.min(4.8, .8 + count * .19 + punctuation * .09)) + (line.pause ?? .16);
  });
  const duration = seconds.reduce((sum, n) => sum + n, 0);
  const rate = Math.min(.85, Math.max(0, available) / Math.max(.01, duration));
  let start = 0;
  const lines = words.map((line, i) => {
    const end = start + seconds[i]! * rate;
    const timed = { ...line, start, end }; start = end; return timed;
  });
  const timing = { rate, lines };
  cache.set(available, timing);
  return timing;
}

export function catchWords(person: string, activity: string, region: number, habitat = '', day = 1): string | null {
  const pick = (lines: readonly string[]) => lines[Math.max(0, day - 1) % lines.length]!;
  // Ren's salt is saved for the bar: before it, the water is only ever nearly there.
  if (person === 'ren' && activity === 'fish') return ['estuary', 'beach', 'saltmarsh', 'rockpools'].includes(habitat)
    ? pick(['“Caught one! The line smells of the sea. Nearly there.”', '“Sea fish, or near enough. I’ll dry these by the fire.”', '“Enough for the voyage. Don’t tell me it’s salty. I want to taste it out past the bar.”'])
    : region >= 2 ? pick(['“Brackish. Not yet.”', '“A good catch. Save a few for the boat.”', '“Supper, and some for tomorrow.”'])
      : region >= 1 ? pick(['“Fish for supper. Still fresh water, though.”', '“These will travel well, dried.”', '“A full line. Mint would go well with these.”'])
        : pick(['“Caught a good fish. No salt yet. Farther downstream, then.”', '“Supper’s caught. Who’s keeping the fire?”', '“These will see us a little farther down the river.”']);
  // Haru only goes out with us in Free Play, where she leads.
  if (person === 'haru' && (activity === 'fish' || activity === 'forage')) return pick(region >= 2
    ? ['“Supper. The pines never fed me this well.”', '“Enough for two, and a bit for whoever turns up.”', '“I counted them before I caught them. Old habit.”']
    : ['“Not bad, for a hunter.”', '“Supper. Yui can have the big one if she tells me a story.”', '“Everything up here tastes of trees.”']);
  if (person === 'haru' && activity === 'track') return pick(['“That’s another for the count.”', '“New prints. I’ve given them a page of their own.”', '“Followed them all the way to a puddle. Then they flew.”']);
  if (person === 'mina' && activity === 'forage') return pick(['“Found some herbs for supper. They grow well beside this river.”', '“Something for the pot, and a few seeds to keep.”', '“Enough for supper. Leave the small plants to grow.”']);
  // Farther down the river, everyone has something to say about supper.
  if (region < 1) return null;
  if (person === 'sora') return pick(region >= 2
    ? ['“Supper, and the sea not far off.”', '“Enough for the boat, if Ren doesn’t eat it all.”']
    : ['“Enough for supper, and some for the road.”', '“Look how much! Everything grows bigger down here.”']);
  if (person === 'ren') return pick(['“Not fish, but I can make something of it.”', '“Leave it with me. I’ll make it taste of something.”']);
  if (person === 'aki') return pick(['“Not timber, but it’ll feed us.”', '“Grandfather always said: eat first, then build.”']);
  if (person === 'yui') return pick(['“Enough for supper. I’ll tell you where I found it later.”', '“The tide was kind today.”']);
  return null;
}

const FRIENDS = ['Sora', 'Ren', 'Mina', 'Aki', 'Haru', 'Yui'] as const;

/**
 * Whether a friend's words fit where the story stands: every friend they name
 * is with us, a boat is only talked of once there is one to plan, and Yui's
 * own shore is the only place she has lived all her life.
 */
export function fitsStory(line: string, state: AdventureState, region: number): boolean {
  for (const name of FRIENDS) if (line.includes(name) && !state.people.some((p) => p.id === name.toLowerCase())) return false;
  const boatPlanned = !state.free && state.region >= 2 || !!state.discoveries['boat-ledger'] || !!state.discoveries['boatyard-moulds'] || state.buildings.some((b) => b.kind === 'boat' || b.kind === 'dock');
  if (/\b(boat|hull|mast|voyage)\b/i.test(line) && !boatPlanned) return false;
  if (line.includes('lived here all my life') && region !== 2) return false;
  return true;
}

/** Said on the way home with timber, fibre or stone, farther down the river where it is all for a bridge or a boat. */
export function timberWords(person: string, region: number): readonly string[] | null {
  if (region < 1) return null;
  const mio: Record<string, readonly string[]> = {
    sora: ['“Wood! Is that enough yet?”', '“Heavy, but I didn’t drop any.”', '“I found a good straight one. Look.”'],
    mina: ['“Good wood. Heavy, mind.”', '“Some reeds for tying, too.”', '“I left the mossy ones. Something lives in them.”'],
    ren: ['“Wood. Can’t eat it, but there you are.”', '“Enough for a few more boards.”', '“My back says that’s plenty for one day.”'],
    haru: ['“Wood. I’d rather it were tracks, but it’ll do.”', '“Heavy. The deer had the right idea, not carrying anything.”', '“Good straight ones. I tested them all on my shoulder.”'],
    yui: ['“Good wood. I’ll remember where we found it.”', '“My arms will tell this story better than I will.”', '“Enough for something. Aki will know what.”'],
    aki: ['“Good timber. That’s a day’s building.”', '“Straight grain. Grandfather would have liked this.”', '“Seasoned already. Somebody cut this years ago.”'],
  };
  const kawagiri: Record<string, readonly string[]> = {
    sora: ['“Wood for the boat! How many more, do you think?”', '“More for the boat. I carried it all myself.”', '“Is this enough for a mast?”'],
    mina: ['“Good boards for the boat, and a seed pod I found on the way.”', '“Aki will be pleased with these.”', '“Reeds for rope. The cutters showed me how.”'],
    ren: ['“Planks. I’d rather they were fish, but there you are.”', '“More for the boat. My arms would like a word.”', '“Wood for the boat. Ask me again why I came.”'],
    haru: ['“Driftwood. The gulls watched me carry every piece.”', '“Planks off the shore. Dry, for once.”', '“That’s the last of the good wood by the pines. Don’t tell anyone.”'],
    aki: ['“Good straight planks. She’ll float on these.”', '“Nearly enough for the hull. Nearly.”', '“Driftwood. Dry right through. Lovely.”'],
    yui: ['“The boat’s getting closer. I can feel it in my arms.”', '“Good wood. The old boats were built from this shore.”', '“Good wood. Aki says I carry like a sailor.”'],
  };
  return (region === 1 ? mio : kawagiri)[person] ?? null;
}

/** Said on the way home from finding a path on, farther down the river. */
export function wayWords(person: string, region: number): readonly string[] | null {
  if (region < 1) return null;
  const lines: Record<string, readonly string[]> = {
    sora: ['“A new path! I’ll draw it on the map tonight.”', '“There’s a way on from here. Come and see.”', '“I found a path nobody told us about.”'],
    mina: ['“A path on through. I tied a bit of grass to mark it.”', '“There’s a way on. Lovely ferns all along it.”', '“A path on. The flowers led me to it.”'],
    ren: ['“There’s a way on. It goes downhill, which is a good sign.”', '“Found a path. Nobody’s fished along it for years.”', '“A way on. The sea’s that way, probably.”'],
    haru: ['“A path on. Deer have used it longer than we have.”', '“Found a way through. Followed a fox most of it.”', '“There’s a way on. Nobody’s walked it but the hares.”'],
    aki: ['“A good path on from here. Someone kept it up once.”', '“There’s a way through. Easy enough to carry timber along.”', '“Found a path. Old cart ruts, still there.”'],
    yui: ['“There’s a path on. I’ve lived here all my life and never knew.”', '“A way on. I’ll have to ask who made it.”', '“A path on. There’s a story behind that, I’m sure.”'],
  };
  return lines[person] ?? null;
}

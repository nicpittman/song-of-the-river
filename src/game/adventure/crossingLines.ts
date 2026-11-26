/**
 * What two friends say when their paths cross during the day: two or three
 * short lines, plain and warm, each in their own voice. `a` asks, `b` answers;
 * the conditions are about `b` (what they are out doing, whether they are on
 * their way out or home) and about the day. Two may meet coming from
 * different ways, or part after sharing a stretch of road.
 *
 * `{place}` is where `b` is going or has been. Lines are checked with
 * `fitsStory`, so nobody unmet is ever named.
 */

import type { Activity, Weather } from './model';

export interface Exchange {
  id: string;
  /** Who may ask, and who may answer; anyone when omitted. */
  a?: string[];
  b?: string[];
  /** What the one answering is out doing today. */
  doing?: Activity[];
  /** Whether the one answering is on the way out (before their first stop) or home. */
  way?: 'out' | 'home';
  seasons?: number[];
  weather?: Weather[];
  regions?: number[];
  /** Only in Wander (true) or only in a Journey (false). */
  free?: boolean;
  /** Only when the two came from different ways, not when they part after sharing a road. */
  apart?: boolean;
  /** Journal entries that must already be found. */
  needs?: string[];
  /**
   * One beat of a pair's running thread (see `threads.ts`): said only after
   * the beat before it, on an earlier day, and then never again.
   */
  thread?: { id: string; beat: number };
  /** Too long for the road: said only by the fire. */
  byFire?: boolean;
  lines: ReadonlyArray<readonly ['a' | 'b', string]>;
}

export const EXCHANGES: readonly Exchange[] = [
  // Fishing.
  { id: 'luck', doing: ['fish'], way: 'home', lines: [['a', '“Any luck?”'], ['b', '“Two trout and a sore thumb.”']] },
  { id: 'biting', b: ['ren'], doing: ['fish'], way: 'home', lines: [['a', '“Anything biting?”'], ['b', '“Midges. The fish were busy.”'], ['a', '“Beans for supper, then.”']] },
  { id: 'fish-out', doing: ['fish'], way: 'out', lines: [['a', '“Off to {place}?”'], ['b', '“If the fish are there, so am I.”']] },
  { id: 'cold-fish', b: ['ren'], doing: ['fish'], seasons: [3], lines: [['a', '“Fishing, in this cold?”'], ['b', '“The fish don’t mind it. Why should I?”'], ['a', '“Your nose is blue.”']] },
  { id: 'soaked', doing: ['fish'], weather: ['rain'], lines: [['a', '“You’re soaked through.”'], ['b', '“Fish like rain. I’m told I should too.”']] },
  { id: 'families', a: ['mina', 'yui'], b: ['ren'], doing: ['fish'], way: 'home', lines: [['a', '“Did you bring me one?”'], ['b', '“One. The others had families.”']] },
  { id: 'clever-trout', a: ['yui', 'sora'], b: ['ren'], doing: ['fish'], lines: [['a', '“Tell me something about the river.”'], ['b', '“It’s wet. And the trout are clever this year.”']] },
  { id: 'ask-at-supper', a: ['haru', 'aki'], b: ['ren'], doing: ['fish'], lines: [['a', '“Fish, or no fish?”'], ['b', '“Ask me again at supper.”']] },

  // Foraging.
  { id: 'basket-spring', b: ['mina'], doing: ['forage'], way: 'home', seasons: [0], lines: [['a', '“What’s in the basket?”'], ['b', '“Wild garlic, and a few violets for nobody in particular.”']] },
  { id: 'mushrooms', doing: ['forage'], way: 'home', seasons: [2], lines: [['a', '“Mushrooms?”'], ['b', '“The good kind. I checked twice.”'], ['a', '“Check a third time, for me.”']] },
  { id: 'ripe', doing: ['forage'], way: 'out', lines: [['a', '“Where are you off to?”'], ['b', '“{place}. Something should be ripe by now.”']] },
  { id: 'purple', doing: ['forage'], way: 'home', seasons: [1], lines: [['a', '“Your hands are purple.”'], ['b', '“Berries. I ate fewer than I picked. Mostly.”']] },
  { id: 'hips', doing: ['forage'], seasons: [3], lines: [['a', '“Anything growing, this time of year?”'], ['b', '“Rose hips, under the snow. You have to know where.”']] },
  { id: 'sorrel', a: ['ren'], b: ['mina'], doing: ['forage'], lines: [['a', '“What have you got there?”'], ['b', '“Sorrel. It goes with fish.”'], ['a', '“Then I’d better catch some.”']] },
  { id: 'leaves-and-hope', a: ['aki', 'sora'], b: ['mina'], doing: ['forage'], lines: [['a', '“Need a hand with that basket?”'], ['b', '“It’s light. Mostly leaves, and hope.”']] },

  // Exploring.
  { id: 'good-part', b: ['sora'], doing: ['explore'], way: 'out', lines: [['a', '“Where are you going?”'], ['b', '“Don’t know yet. That’s the good part.”']] },
  { id: 'real-path', b: ['sora'], doing: ['explore'], way: 'home', lines: [['a', '“Find anything?”'], ['b', '“A path that goes somewhere. I’ll show you tomorrow.”'], ['a', '“Is it a real path?”']] },
  { id: 'mist-view', doing: ['explore'], way: 'home', weather: ['mist'], lines: [['a', '“Could you see anything?”'], ['b', '“Mist, mostly. And then, for a moment, everything.”']] },
  { id: 'half-a-plan', doing: ['explore'], way: 'out', lines: [['a', '“You look like someone with a plan.”'], ['b', '“Half of one. The other half is round the next bend.”']] },
  { id: 'not-lost', a: ['haru', 'ren'], b: ['sora'], doing: ['explore'], lines: [['a', '“Lost?”'], ['b', '“Not lost. Exploring. It’s different.”'], ['a', '“Looks the same from here.”']] },
  { id: 'tell-tonight', free: true, doing: ['explore'], lines: [['a', '“Where does that path go?”'], ['b', '“I’ll tell you tonight.”']] },

  // Visiting.
  { id: 'grandmothers-songs', b: ['yui'], doing: ['visit'], way: 'home', lines: [['a', '“Who did you see?”'], ['b', '“An old woman at {place}. She knew my grandmother’s songs.”'], ['a', '“Sing them tonight?”']] },
  { id: 'kettle', doing: ['visit'], way: 'out', lines: [['a', '“Visiting?”'], ['b', '“They’ll have the kettle on. They always do.”']] },
  { id: 'news', doing: ['visit'], way: 'home', lines: [['a', '“Any news?”'], ['b', '“Plenty. Most of it about the weather.”']] },
  { id: 'plums', doing: ['visit'], way: 'out', seasons: [2, 3], lines: [['a', '“What’s in the cloth?”'], ['b', '“Dried plums. Nobody turns away a guest with plums.”']] },
  { id: 'new-story', a: ['mina', 'sora'], b: ['yui'], doing: ['visit'], way: 'home', lines: [['a', '“You look happy.”'], ['b', '“Someone told me a story I’d never heard. That doesn’t happen often.”']] },

  // Looking closely.
  { id: 'joinery', b: ['aki'], doing: ['investigate'], way: 'home', lines: [['a', '“What did you find?”'], ['b', '“Old joinery. Somebody cut those beams with care.”']] },
  { id: 'slowly', doing: ['investigate'], way: 'out', lines: [['a', '“Off to look at something?”'], ['b', '“At everything, slowly. That’s the trick.”']] },
  { id: 'fence-knot', a: ['sora'], b: ['aki'], doing: ['investigate', 'explore', 'visit'], lines: [['a', '“Aki! What are you looking at?”'], ['b', '“A good knot in an old fence post. Don’t laugh.”'], ['a', '“I wasn’t going to.”']] },

  // Tracking.
  { id: 'two-deer', b: ['haru'], doing: ['track'], way: 'out', lines: [['a', '“Tracks?”'], ['b', '“Deer, two of them. Not far.”'], ['a', '“Don’t let them hear you coming.”']] },
  { id: 'never-do', b: ['haru'], doing: ['track'], way: 'home', lines: [['a', '“Did you catch up with them?”'], ['b', '“I never do. That’s not the point.”']] },
  { id: 'snow-tracks', doing: ['track'], weather: ['snow'], lines: [['a', '“Easy tracking, in the snow.”'], ['b', '“Too easy. Everything walked everywhere last night.”']] },
  { id: 'quiet', a: ['sora'], b: ['haru'], doing: ['track'], lines: [['a', '“Can I come next time?”'], ['b', '“If you can walk quietly.”'], ['a', '“I can be very quiet!”']] },
  { id: 'fox-watching', a: ['aki', 'yui', 'mina'], b: ['haru'], doing: ['track'], lines: [['a', '“Seen anything?”'], ['b', '“A fox, watching me. I pretended not to notice.”']] },

  // Two friends in particular.
  { id: 'only-deer', a: ['haru'], b: ['yui'], lines: [['a', '“Still writing it all down?”'], ['b', '“Someone has to. You’d only remember the deer.”'], ['a', '“The deer were the best part.”']] },
  { id: 'not-rushing', a: ['yui'], b: ['haru'], way: 'out', lines: [['a', '“Where are you rushing off to?”'], ['b', '“I’m not rushing. Everyone else is slow.”']] },
  { id: 'mind-feet', a: ['aki'], b: ['sora'], lines: [['a', '“Mind your feet on those stones.”'], ['b', '“I always mind them. They don’t mind me.”']] },
  { id: 'workshop', a: ['haru', 'ren'], b: ['aki'], lines: [['a', '“Carrying your whole workshop again?”'], ['b', '“Only the bits I need. All of them.”']] },
  { id: 'whistling', a: ['yui'], b: ['aki'], lines: [['a', '“You’re whistling.”'], ['b', '“Grandfather’s tune. It helps the walking.”'], ['a', '“I know that one. I’ll write it down.”']] },
  { id: 'burrs', a: ['mina', 'yui'], b: ['haru'], lines: [['a', '“You’ve burrs all down your sleeve.”'], ['b', '“They wanted a lift. I hadn’t the heart to say no.”']] },
  { id: 'the-eel', a: ['ren'], b: ['yui'], lines: [['a', '“Another story for your book?”'], ['b', '“Two. One of them is about you.”'], ['a', '“Leave out the part with the eel.”']] },
  { id: 'blossom-hair', a: ['yui', 'sora'], b: ['mina'], seasons: [0], lines: [['a', '“Is that blossom in your hair?”'], ['b', '“It fell there. I decided to keep it.”']] },
  { id: 'humming', a: ['sora'], b: ['yui'], lines: [['a', '“Yui, what are you humming?”'], ['b', '“A walking song. It makes the path shorter.”'], ['a', '“Does it really?”']] },
  { id: 'mint-again', a: ['sora'], b: ['mina'], lines: [['a', '“You smell of mint again.”'], ['b', '“I always smell of mint. Ask Ren.”']] },
  { id: 'measuring', a: ['mina', 'yui'], b: ['aki'], lines: [['a', '“What are you measuring?”'], ['b', '“That tree. One day it wants to be a roof beam.”']] },

  // The day itself.
  { id: 'toes', seasons: [3], weather: ['snow'], lines: [['a', '“Cold enough for you?”'], ['b', '“My toes went home an hour ago.”']] },
  { id: 'ducks', weather: ['rain'], lines: [['a', '“Wet one.”'], ['b', '“The ducks seem pleased about it.”']] },
  { id: 'heard-you', apart: true, weather: ['mist'], lines: [['a', '“I nearly walked past you.”'], ['b', '“I heard you long before I saw you.”']] },
  { id: 'shade', seasons: [1], weather: ['clear'], lines: [['a', '“Hot, isn’t it?”'], ['b', '“I’m walking in every bit of shade I can find.”']] },
  { id: 'turning', seasons: [2], lines: [['a', '“The leaves are turning.”'], ['b', '“I know. I keep stopping to look.”']] },
  { id: 'warblers', seasons: [0], weather: ['clear', 'mist'], lines: [['a', '“Hear that?”'], ['b', '“Warblers. Back for the spring.”']] },
  { id: 'apples', regions: [1], seasons: [2], lines: [['a', '“Apples in the orchards yet?”'], ['b', '“A few. I left the high ones for the birds.”']] },
  { id: 'feet-in-charge', way: 'home', lines: [['a', '“Heading back?”'], ['b', '“Slowly. My feet are in charge now.”']] },
  { id: 'save-tea', way: 'out', lines: [['a', '“Off to {place}?”'], ['b', '“That’s the idea. Save me some tea.”']] },
  { id: 'salt-close', regions: [2], free: false, lines: [['a', '“Smell that?”'], ['b', '“Salt. We’re close now.”']] },
  { id: 'sea-wind', regions: [2], free: true, lines: [['a', '“Wind’s off the sea today.”'], ['b', '“I can taste it. A good day for the shore.”']] },
  { id: 'long-way', free: true, lines: [['a', '“No hurry today?”'], ['b', '“None at all. That’s why I took the long way.”']] },

  // Threads: a few beats between the same two friends, in order, over the Journey.
  // Ren is sure Sora will fall in the river one day.
  { id: 'not-yet', thread: { id: 'falling-in', beat: 0 }, free: false, a: ['ren'], b: ['sora'], lines: [['a', '“Slow down, or you’ll be in the river.”'], ['b', '“I’ve never fallen in.”'], ['a', '“Not yet.”']] },
  { id: 'wet-boots', thread: { id: 'falling-in', beat: 1 }, free: false, regions: [1, 2], a: ['ren'], b: ['sora'], lines: [['a', '“Your boots are wet to the knee.”'], ['b', '“I stepped in. That’s not falling in.”'], ['a', '“It’s halfway.”']] },
  { id: 'sea-counts', thread: { id: 'falling-in', beat: 2 }, free: false, regions: [2], a: ['sora'], b: ['ren'], lines: [['a', '“If I fell in here, would it count? It’s nearly the sea.”'], ['b', '“It counts double. Stay away from the edge.”']] },
  // Ren and Mina: fish, or plants.
  { id: 'not-my-fish', thread: { id: 'fish-or-plants', beat: 0 }, free: false, a: ['ren'], b: ['mina'], lines: [['a', '“Fish keep a person going. Leaves don’t.”'], ['b', '“The fish eat the leaves, Ren.”'], ['a', '“Not my fish.”']] },
  { id: 'best-stew', thread: { id: 'fish-or-plants', beat: 1 }, free: false, regions: [1, 2], a: ['mina'], b: ['ren'], lines: [['a', '“You said that was your best stew yet.”'], ['b', '“The trout were very fresh.”'], ['a', '“It was the sorrel.”']] },
  { id: 'seaweed', thread: { id: 'fish-or-plants', beat: 2 }, free: false, regions: [2], a: ['ren'], b: ['mina'], lines: [['a', '“Out past the bar there are no plants at all. Only fish.”'], ['b', '“There’s seaweed.”'], ['a', '“Seaweed doesn’t count.”']] },
  // Aki doubts Yui's stories, until one of them turns out to be his grandfather's.
  { id: 'heron-baby', thread: { id: 'yuis-stories', beat: 0 }, free: false, a: ['yui'], b: ['aki'], lines: [['a', '“A heron once carried a baby all the way up to Mio. It’s true.”'], ['b', '“I’m from Mio.”'], ['a', '“Then you’ll have heard it.”']] },
  { id: 'tall-carpenter', thread: { id: 'yuis-stories', beat: 1 }, free: false, byFire: true, a: ['yui'], b: ['aki'], lines: [['a', '“When I was small, a carpenter came down the river. Seven feet tall. He left a sail with my mother, and never came back for it.”'], ['b', '“There’s a carpenter in all your stories.”'], ['a', '“There usually was one.”']] },
  { id: 'sail-mark', thread: { id: 'yuis-stories', beat: 2 }, free: false, byFire: true, needs: ['mended-sail'], a: ['aki'], b: ['yui'], lines: [['a', '“There’s a mark sewn in the corner of the sail. It’s Grandfather’s. He put it on everything he made.”'], ['b', '“I did say.”'], ['a', '“You said he was seven feet tall.”'], ['b', '“I was very small.”']] },
];

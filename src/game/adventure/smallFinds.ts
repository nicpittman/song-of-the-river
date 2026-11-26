/**
 * Small finds: little things that glint by the way for a moment (a feather, a
 * lost glove, a moss-covered jizo) and, looked at, become one line in the
 * journal. Each can be noticed once. They are drawn with the journal's
 * generic sketches (`any-feather`, `any-stone`...), so they need no art.
 *
 * `regions` is where along the river it can be (0 Seseragi, 1 Mio, 2
 * Kawagiri); `when` narrows it to seasons or weather.
 */

import type { Conditions } from './catalogue';

export interface SmallFindDef {
  id: string;
  /** With its article, lower case: "a jay’s feather". */
  name: string;
  /** The journal’s one line. */
  line: string;
  /** A generic journal sketch to draw it by. */
  sketch: string;
  regions: number[];
  when?: Conditions;
}

const ANY = [0, 1, 2];

export const SMALL_FINDS: readonly SmallFindDef[] = [
  // Seseragi: the upper valley, its pines, shrine and mill.
  { id: 'jay-feather', name: 'a jay’s feather', line: 'A jay’s feather by the path, barred blue like a scrap of sky.', sketch: 'any-feather', regions: [0, 1] },
  { id: 'lost-glove', name: 'a lost glove', line: 'One knitted glove set on a post, so its owner might find it again.', sketch: 'any-parcel', regions: [0, 1], when: { seasons: [2, 3] } },
  { id: 'carved-stone', name: 'a carved stone', line: 'A river stone with a spiral cut into it, worn soft by many thumbs.', sketch: 'any-stone', regions: [0] },
  { id: 'boundary-marker', name: 'an old boundary marker', line: 'A mossy marker stone. The village name on it is not one anyone remembers.', sketch: 'any-stone', regions: [0, 1] },
  { id: 'snail-shell', name: 'a snail shell', line: 'An empty snail shell, banded brown and cream, on a mossy rock.', sketch: 'any-shell', regions: [0, 1], when: { seasons: [0, 1, 2] } },
  { id: 'moss-jizo', name: 'a moss-covered jizo', line: 'A little stone jizo under the moss, its red bib still bright. Someone keeps it.', sketch: 'any-person', regions: [0, 1] },
  { id: 'fox-acorns', name: 'a fox’s cached acorns', line: 'Acorns pushed into a hollow root: somebody’s winter, put away.', sketch: 'any-den', regions: [0, 1], when: { seasons: [2, 3] } },
  { id: 'caught-kite', name: 'a kite caught in a tree', line: 'A paper kite in the high branches, its tail still dancing.', sketch: 'any-star', regions: [0, 1], when: { seasons: [0, 1], weather: ['clear'] } },
  { id: 'dropped-hairpin', name: 'a dropped hairpin', line: 'A lacquered hairpin in the grass, a tiny plum flower on its end.', sketch: 'any-flower', regions: ANY },
  { id: 'shrine-bell', name: 'a little brass bell', line: 'A bell no bigger than a thumbnail, still on its red cord.', sketch: 'any-star', regions: [0] },
  { id: 'straw-sandal', name: 'a straw sandal', line: 'A worn straw sandal by the stepping stones. Its pair must be downstream.', sketch: 'any-parcel', regions: [0, 1] },
  { id: 'owl-pellet', name: 'an owl pellet', line: 'An owl pellet under the pines, all fur and tiny bones.', sketch: 'any-den', regions: [0] },
  { id: 'ice-leaf', name: 'a leaf in the ice', line: 'A maple leaf caught in a skin of ice, red as the day it fell.', sketch: 'any-leaf', regions: [0, 1], when: { seasons: [3] } },
  { id: 'cicada-shell', name: 'a cicada shell', line: 'A cicada’s empty shell clinging to the bark, split neatly down the back.', sketch: 'any-shell', regions: [0, 1], when: { seasons: [1] } },
  { id: 'pottery-shard', name: 'a pottery shard', line: 'A shard of blue-glazed bowl in the bank. Somebody had good taste.', sketch: 'any-stone', regions: ANY },
  { id: 'pine-cone', name: 'a perfect pine cone', line: 'A pine cone without a scale out of place. It is in my pocket now.', sketch: 'any-leaf', regions: [0, 2] },
  // Mio: orchards, willows and the farms across the narrows.
  { id: 'willow-whistle', name: 'a willow whistle', line: 'A whistle cut from willow, left on a fence. It still plays one note.', sketch: 'any-tool', regions: [1] },
  { id: 'scarecrow-hat', name: 'a scarecrow’s hat', line: 'A straw hat blown off a scarecrow, caught in the reeds.', sketch: 'any-parcel', regions: [1], when: { seasons: [1, 2] } },
  { id: 'old-coin', name: 'an old coin', line: 'A coin with a square hole, green with age, in the cart ruts.', sketch: 'any-stone', regions: [1, 2] },
  { id: 'spinning-top', name: 'a wooden top', line: 'A child’s spinning top under the hedge, its red paint nearly gone.', sketch: 'any-tool', regions: [1] },
  { id: 'wall-persimmon', name: 'a persimmon on a wall', line: 'One persimmon set on a wall, as if for whoever came by.', sketch: 'any-leaf', regions: [1], when: { seasons: [2] } },
  { id: 'heron-plume', name: 'a heron’s plume', line: 'A long grey heron plume by the shallows, light as breath.', sketch: 'any-feather', regions: [1, 2] },
  { id: 'wish-plaque', name: 'a wooden wish plaque', line: 'A little wooden plaque, its wish washed off by the rain. Only “please” is left.', sketch: 'any-letter', regions: [0, 1] },
  { id: 'speckled-eggshell', name: 'a speckled eggshell', line: 'Half a speckled eggshell under the hedge. Somebody has flown.', sketch: 'any-shell', regions: [0, 1], when: { seasons: [0] } },
  { id: 'frog-stone', name: 'a frog-shaped stone', line: 'A stone that looks exactly like a frog. I checked twice that it wasn’t one.', sketch: 'any-stone', regions: ANY },
  { id: 'paper-crane', name: 'a paper crane', line: 'A folded paper crane tucked into a fence post, a little damp.', sketch: 'any-bird', regions: [0, 1] },
  { id: 'clover', name: 'a four-leaf clover', line: 'A four-leaf clover in the verge. I counted twice.', sketch: 'any-leaf', regions: ANY, when: { seasons: [0, 1] } },
  { id: 'snow-rabbit', name: 'a snow rabbit', line: 'A little snow rabbit on a wall, berry eyes and leaf ears. Someone was patient.', sketch: 'any-track', regions: ANY, when: { seasons: [3] } },
  { id: 'wooden-button', name: 'a wooden button', line: 'A carved wooden button on the path, a pine on its face.', sketch: 'any-stone', regions: ANY },
  // Kawagiri: the reed beds, the estuary and the shore.
  { id: 'gull-feather', name: 'a gull’s feather', line: 'A gull’s feather on the sand, grey tipped with black.', sketch: 'any-feather', regions: [2] },
  { id: 'rope-knot', name: 'a sailor’s knot', line: 'A knot on a frayed end of rope. Whoever tied it meant it.', sketch: 'any-tool', regions: [2] },
  { id: 'crab-moult', name: 'a crab’s old shell', line: 'A crab’s cast-off shell by the reeds, perfect and empty.', sketch: 'any-shell', regions: [2] },
  { id: 'reed-raft', name: 'a little reed raft', line: 'A raft folded from reeds, run aground in the estuary mud.', sketch: 'any-leaf', regions: [2], when: { seasons: [0, 1, 2] } },
  { id: 'boxwood-comb', name: 'a boxwood comb', line: 'A boxwood comb in the dune grass, missing two teeth.', sketch: 'any-tool', regions: [2] },
  { id: 'urchin-shell', name: 'an urchin shell', line: 'A sea urchin’s shell, pale green and light as paper.', sketch: 'any-shell', regions: [2] },
  { id: 'tide-tile', name: 'a tide-worn tile', line: 'A roof tile smoothed by the tide, its crest still faint.', sketch: 'any-stone', regions: [2] },
  { id: 'mermaids-purse', name: 'a mermaid’s purse', line: 'A skate’s egg case on the tideline. The old folk call it a mermaid’s purse.', sketch: 'any-shell', regions: [2] },
];

const index = new Map(SMALL_FINDS.map((f) => [f.id, f]));

export const smallFindDef = (id: string): SmallFindDef | undefined => index.get(id);

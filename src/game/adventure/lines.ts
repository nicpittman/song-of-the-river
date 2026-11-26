/**
 * Shared writing: the lines that are not tied to one place. Most are five to
 * fifteen words, plain and concrete. Places supply their own beat lines; these
 * fill the gaps and say what happened when nothing special did.
 */

import type { Activity, Weather } from './model';

/** Beat lines for any place, by activity. */
export const GENERIC_BEATS: Record<Activity, string[]> = {
  explore: ['Off the path to see.', 'A slow loop round.', 'Stopping to look and listen.', 'Over the next rise.'],
  fish: ['Casting into the current.', 'A few steps along between casts.', 'The line drifts and settles.', 'Waiting for a pull.'],
  forage: ['Kneeling among the green.', 'Picking slowly along.', 'The basket filling.', 'Moving to a better patch.'],
  investigate: ['Looking closely.', 'Turning things over.', 'Kneeling for a better look.', 'Following a hunch.'],
  visit: ['Tea and slow talk.', 'Helping with a chore.', 'Hearing the news.', 'Sitting on the step together.'],
  track: ['Reading prints in soft ground.', 'Following a line of bent grass.', 'Kneeling at a fresh sign.', 'Quiet steps, downwind.'],
};

/** The daytime tag when the pack holds only provisions. */
export const SUPPLY_TAGS: Record<Activity, string[]> = {
  explore: ['Kindling and a few mushrooms.', 'Pockets full of useful things.'],
  fish: ['A string of fish for the pot.', 'A good catch, nothing strange.'],
  forage: ['A full basket.', 'Greens and roots for supper.'],
  investigate: ['Odds and ends worth keeping.', 'A few useful scraps.'],
  visit: ['A gift to carry home.', 'Sent home with rice.'],
  track: ['A few good things along the trail.', 'Kindling gathered on the way.'],
};

/** The daytime tag when exploring found the way somewhere new, with nothing else in the pack. */
export const WAY_TAGS = ['A new path for the map.', 'Found the way on.'];

/** The daytime tag when the pack is empty. */
export const EMPTY_TAGS: Record<Activity, string[]> = {
  explore: ['Nothing new today.', 'A good walk, and that is all.'],
  fish: ['Nothing biting today.', 'Quiet water today.'],
  forage: ['Slim pickings today.', 'Not much growing here now.'],
  investigate: ['Nothing to see today.', 'The place kept its secrets.'],
  visit: ['Nobody home today.', 'A short visit.'],
  track: ['The trail went cold.', 'Old signs, nothing fresh.'],
};

/** By the fire, for a provisions bundle. */
export const SUPPLY_TEXT: Record<Activity, string> = {
  explore: 'Firewood, mushrooms and a few useful stones.',
  fish: 'Fish for the pot, and some to dry.',
  forage: 'Greens, roots and seeds.',
  investigate: 'Bits and pieces that will come in handy.',
  visit: 'A gift from the people there.',
  track: 'Kindling and mushrooms from along the trail.',
};

/** By the fire, for an empty pack. Kind, never a scolding. */
export const EMPTY_TEXT = [
  'The river kept its secrets today.',
  'Nothing in the pack, but a good day out.',
  'Some days are like that.',
  'Home with nothing but a story.',
];

export const REST_TEXT = 'Kept the fire in and mended what needed mending.';
export const GARDEN_REST_TEXT = 'Tended the garden and the fire.';
export const WEATHER_WORDS: Record<Weather, string> = {
  clear: 'Clear skies.',
  mist: 'Mist on the water.',
  rain: 'Rain on the hills.',
  snow: 'Snow in the air.',
};

/**
 * What can happen at a fork. Each kind of fork has a pool of small situations;
 * one that fits the place, the weather and the season is chosen, avoiding any
 * seen lately. The three choices always mean the same thing, in this order:
 * follow on, stay (wait or look closer), turn back.
 */
export interface ForkDef {
  text: string;
  /** Follow on, stay (wait or look closer), turn back. */
  choices: [string, string, string];
  /** Only at these habitats. */
  habitats?: string[];
  /** Only in this weather. */
  weather?: Weather[];
  /** Only in these seasons (0 spring, 1 summer, 2 autumn, 3 winter). */
  seasons?: number[];
}

const WATERSIDE = ['reeds', 'creek', 'pond', 'riverbank', 'stones', 'saltmarsh', 'estuary', 'mill', 'pool', 'tarn'];
const TREES = ['woodland', 'pines', 'orchard'];

export const FORKS: Record<string, ForkDef[]> = {
  gather: [
    { text: 'There may be more to gather beyond the path.', choices: ['Try a little farther', 'Gather close by', 'Bring the basket home'] },
    { text: 'The basket’s half full already.', choices: ['Fill it farther on', 'Sort what’s here', 'Head back while it’s light'] },
    { text: 'Someone has picked here before us. Not long ago.', choices: ['Try past their trail', 'Find what they missed', 'Leave it to them'] },
    { text: 'Mushrooms in a ring, and more under the trees.', choices: ['Follow them in', 'Pick from the ring', 'Leave them be'], habitats: TREES },
    { text: 'Berries on the far side of a ditch.', choices: ['Hop the ditch', 'Pick this side', 'Leave them for the birds'], seasons: [1, 2] },
    { text: 'Wild garlic, by the smell of it. Close by somewhere.', choices: ['Follow your nose', 'Search the bank here', 'Save it for later'], seasons: [0] },
    { text: 'A bee goes past, heavy with pollen.', choices: ['Follow the bee', 'Look at the flowers here', 'Let it go'], seasons: [0, 1] },
    { text: 'Windfalls in the grass, and more up the slope.', choices: ['Climb the slope', 'Pick up the windfalls', 'Take what we have'], habitats: ['orchard', 'garden', 'meadow', 'hut'], seasons: [2] },
    { text: 'Watercress at the edge, and thicker farther out.', choices: ['Wade out to it', 'Pick from the edge', 'Keep our feet dry'], habitats: WATERSIDE },
    { text: 'The rain’s brought the snails out. Mushrooms too, maybe.', choices: ['Look farther in', 'Check under the leaves', 'Get out of the wet'], weather: ['rain'] },
    { text: 'Something green under the snow.', choices: ['Dig a bit farther on', 'Brush it off and look', 'Too cold, head home'], weather: ['snow'] },
    { text: 'The mist hides how far the patch goes.', choices: ['Walk into the mist', 'Stay where we can see', 'Turn back'], weather: ['mist'] },
  ],
  shore: [
    { text: 'Something glints farther along the sand.', choices: ['Go and see', 'Look closer', 'Turn back'] },
    { text: 'The tide’s going out. More beach every minute.', choices: ['Follow the tide out', 'Sift the wet sand', 'Back before it turns'] },
    { text: 'Driftwood piled up at the far end of the bay.', choices: ['Walk to the pile', 'Look through what’s here', 'Leave it'] },
    { text: 'A gull is tugging at something by the water.', choices: ['Shoo it and see', 'Watch from here', 'Leave the gull to it'] },
    { text: 'Shells along the tideline, thicker farther on.', choices: ['Walk the tideline', 'Fill a pocket here', 'That’s plenty'] },
    { text: 'Little bubbles in the wet sand.', choices: ['Dig along the beach', 'Dig right here', 'Leave them be'] },
    { text: 'Fog rolling in off the sea.', choices: ['A little farther', 'Wait for it to lift', 'Head back now'], weather: ['mist'] },
  ],
  inspect: [
    { text: 'An old mark points away from the path.', choices: ['See where it leads', 'Set the details down', 'Leave it for another day'] },
    { text: 'A low stone wall, half buried, runs off into the green.', choices: ['Follow the wall', 'Look at the stones', 'Leave it'] },
    { text: 'A cairn, with one newer stone on top.', choices: ['Look for the next one', 'Look it over', 'Leave it standing'] },
    { text: 'Scratches on a tree, too neat for an animal.', choices: ['Look for more', 'Look closer', 'Leave them be'], habitats: TREES },
    { text: 'An old rope tied to a post, trailing into the water.', choices: ['Follow the rope', 'Look at the knot', 'Leave it be'], habitats: [...WATERSIDE, 'boatyard'] },
    { text: 'A sound like a little bell, somewhere ahead.', choices: ['Go and find it', 'Listen a while', 'Head home'] },
    { text: 'Flat stones under the moss, like a path.', choices: ['Walk where it goes', 'Clear one and look', 'Leave it'] },
    { text: 'Someone’s old fire ring. The ash is cold.', choices: ['Look for their path', 'Look around it', 'Leave it'] },
    { text: 'A bit of broken pot in the earth.', choices: ['Search farther on', 'Look at this piece', 'Put it back'] },
    { text: 'Footprints in the snow. Not ours.', choices: ['See where they go', 'Look at them closely', 'Head back'], weather: ['snow'] },
  ],
  tracks: [
    { text: 'The prints divide at a patch of bare earth.', choices: ['Follow the fresher prints', 'Read the ground', 'Leave the trail'] },
    { text: 'A tuft of fur caught on a bramble.', choices: ['Keep following', 'Look closer', 'Leave it'] },
    { text: 'Fresh droppings. It was here this morning.', choices: ['Track it farther', 'Look around here', 'Give it some room'] },
    { text: 'The prints go down to the water and stop.', choices: ['Try the far bank', 'Wait and watch', 'Call it a day'] },
    { text: 'A rustle in the bushes, then nothing.', choices: ['Creep after it', 'Keep very still', 'Back away quietly'] },
    { text: 'The trail climbs into rougher ground.', choices: ['Climb after it', 'Look from here', 'Leave the trail'] },
    { text: 'A nibbled twig, still wet.', choices: ['Go after it', 'Look closer', 'Leave it'] },
    { text: 'Bent reeds, as if something big went through.', choices: ['Push in after it', 'Wait at the edge', 'Back to dry ground'], habitats: WATERSIDE },
    { text: 'The rain is washing the prints away.', choices: ['Hurry after them', 'Read what’s left', 'Let them go'], weather: ['rain'] },
    { text: 'Clear prints in fresh snow.', choices: ['Follow them on', 'Sketch the prints', 'Leave them be'], weather: ['snow'] },
  ],
  water: [
    { text: 'Something moves in the deeper water.', choices: ['Try the deeper pool', 'Watch for another rise', 'Bring the line in'] },
    { text: 'Fish rising downstream, just out of reach.', choices: ['Move down to them', 'Keep casting here', 'Pack up the line'] },
    { text: 'A heavy tug, then the line goes slack.', choices: ['Try farther along', 'Cast again here', 'Call it a day'] },
    { text: 'A heron is fishing the next pool down.', choices: ['Try past the heron', 'Watch how it fishes', 'Leave it the pool'] },
    { text: 'Little fish keep stealing the bait.', choices: ['Try deeper water', 'Change the bait', 'Pack up'] },
    { text: 'Ripples under the far bank, where the branches hang.', choices: ['Cast under the branches', 'Try once more here', 'Bring the line in'] },
    { text: 'Cold water where the stream comes in.', choices: ['Fish the cold water', 'Stay in the warm', 'Head home'], habitats: ['riverbank', 'creek', 'stones', 'pool', 'mill', 'tarn'] },
    { text: 'An old boat pulled up a little way along.', choices: ['Fish beside it', 'Fish from here', 'Leave it be'], habitats: ['estuary', 'saltmarsh', 'reeds', 'pond', 'riverbank', 'beach'] },
    { text: 'The tide’s turning. The fish come in with it.', choices: ['Follow the tide in', 'Stay on this spot', 'Back before it’s high'], habitats: ['estuary', 'saltmarsh', 'beach', 'rockpools'] },
    { text: 'Rain dimpling the water. They’re biting now.', choices: ['Try the next bend', 'Stay put and fish', 'Too wet, head back'], weather: ['rain'] },
    { text: 'Mist low on the water. Hard to see the float.', choices: ['Find a clearer spot', 'Fish by feel', 'Try another day'], weather: ['mist'] },
    { text: 'Ice along the edges, open water in the middle.', choices: ['Edge out a little', 'Fish from the bank', 'Too cold, head home'], weather: ['snow'] },
  ],
  people: [
    { text: 'We’re asked to stay for a meal.', choices: ['Join them for supper', 'Stay and listen', 'Carry the news home'] },
    { text: 'Someone needs a hand with the nets.', choices: ['Go along and help', 'Talk while they work', 'Thank them and go'] },
    { text: 'An old man starts a story about the river.', choices: ['Ask him to go on', 'Listen quietly', 'Promise to come back'] },
    { text: 'The children want to show us something down the lane.', choices: ['Go with them', 'Wait here for them', 'Say goodbye for today'] },
    { text: 'Tea’s poured, and there’s a second pot on.', choices: ['Stay for another cup', 'Ask about the river', 'Head off with thanks'] },
    { text: 'There’s a spot up the hill only locals know.', choices: ['Ask them to show us', 'Hear more about it', 'Take the news home'] },
    { text: 'A woman is carrying wood up the hill on her own.', choices: ['Help carry it up', 'Walk and talk with her', 'Wish her well'] },
    { text: 'A dog trots ahead and keeps looking back at us.', choices: ['Follow the dog', 'Give it a scratch', 'Head home'] },
    { text: 'Someone has a boat story, if we have the time.', choices: ['Go down to the boats', 'Sit and listen', 'Save it for tomorrow'], habitats: ['boatyard', 'village', 'inn'] },
    { text: 'The shrine keeper nods at the steps behind her.', choices: ['Take the steps up', 'Help with the sweeping', 'Bow and go home'], habitats: ['shrine'] },
    { text: 'Rain on the roof, and a dry seat by the stove.', choices: ['Help out in the yard', 'Sit and talk a while', 'Thank them and go'], weather: ['rain', 'snow'] },
  ],
  woodland: [
    { text: 'Tracks lead on under the trees.', choices: ['Follow them', 'Look closer', 'Turn back'] },
    { text: 'A clearing ahead, full of light.', choices: ['Go into the clearing', 'Look from here', 'Turn back'] },
    { text: 'A woodpecker knocking somewhere ahead.', choices: ['Find the woodpecker', 'Listen a while', 'Turn back'] },
    { text: 'The path splits round a huge old tree.', choices: ['Take the narrow way', 'Look at the tree', 'Turn back'] },
    { text: 'Dark under the trees, and the path keeps going.', choices: ['Keep going', 'Stop and listen', 'Turn back'] },
    { text: 'Leaves coming down all at once in the wind.', choices: ['Walk on through them', 'Stand and watch', 'Turn back'], seasons: [2] },
    { text: 'Deep snow under the trees ahead.', choices: ['Push on through', 'Shake a branch and watch', 'Head back'], weather: ['snow'] },
  ],
  rock: [
    { text: 'A narrow way leads on up the rock.', choices: ['Climb on', 'Look closer', 'Turn back'] },
    { text: 'Water dripping down the rock into a little pool.', choices: ['Climb to where it starts', 'Look in the pool', 'Turn back'] },
    { text: 'A ledge runs round the corner, out of sight.', choices: ['Edge round it', 'Look from here', 'Turn back'] },
    { text: 'Loose stones on the slope.', choices: ['Try the slope', 'Look for another way', 'Leave it'] },
    { text: 'A hollow in the rock, just big enough to sit in.', choices: ['Climb in', 'Look in from outside', 'Leave it'] },
    { text: 'A bigger pool farther out on the rocks.', choices: ['Hop out to it', 'Look in this one', 'Head back'], habitats: ['rockpools'] },
    { text: 'The rock’s wet and slippery today.', choices: ['Go carefully on', 'Rest here a while', 'Turn back'], weather: ['rain', 'mist'] },
  ],
  open: [
    { text: 'A faint path runs on through the grass.', choices: ['Follow it', 'Look closer', 'Turn back'] },
    { text: 'A rise ahead. You’d see a long way from up there.', choices: ['Walk up', 'Look round from here', 'Turn back'] },
    { text: 'A hawk hanging still over the field.', choices: ['Walk under it', 'Watch it hunt', 'Turn back'] },
    { text: 'An old signpost, leaning, the words worn off.', choices: ['Go the way it points', 'Look it over', 'Turn back'] },
    { text: 'A gate in the hedge, left open.', choices: ['Go through', 'Look over it', 'Turn back'], habitats: ['farm', 'orchard', 'garden'] },
    { text: 'Butterflies over the flowers, more of them farther on.', choices: ['Follow them', 'Sit and watch', 'Turn back'], seasons: [0, 1] },
    { text: 'Mist over the field. The path goes into it.', choices: ['Walk into the mist', 'Wait for it to clear', 'Turn back'], weather: ['mist'] },
  ],
  wet: [
    { text: 'Wings stirring in the reeds ahead.', choices: ['Go and see', 'Wait quietly', 'Turn back'] },
    { text: 'Old boards into the reeds, half sunk.', choices: ['Try the boards', 'Look from the end', 'Turn back'] },
    { text: 'The frogs go quiet all at once, just ahead.', choices: ['Creep closer', 'Stay still', 'Turn back'] },
    { text: 'The ground gets softer. Water underfoot.', choices: ['Squelch on', 'Look around here', 'Back to dry ground'] },
    { text: 'A channel through the reeds, shallow enough to wade.', choices: ['Wade along it', 'Look along it', 'Turn back'] },
    { text: 'Geese calling, somewhere out on the marsh.', choices: ['Go towards them', 'Listen', 'Turn back'], seasons: [2, 3] },
  ],
};

/** Which fork fits which habitat. */
export const FORK_FOR_HABITAT: Record<string, keyof typeof FORKS> = {
  woodland: 'woodland', pines: 'woodland', orchard: 'woodland', garden: 'open',
  pool: 'water', stones: 'water', riverbank: 'water', creek: 'water', mill: 'water', estuary: 'water', pond: 'water',
  waterfall: 'rock', gorge: 'rock', gravel: 'rock', rockpools: 'rock',
  meadow: 'open', road: 'open', tarn: 'water', hut: 'open',
  reeds: 'wet', saltmarsh: 'wet',
  village: 'people', shrine: 'people', boatyard: 'people', inn: 'people',
  beach: 'shore',
};

/** The forks of a kind that fit this place, weather and season. */
export function forksThatFit(kind: string, habitat: string, weather: Weather, season: number): ForkDef[] {
  return (FORKS[kind] ?? FORKS.open!).filter((f) =>
    (!f.habitats || f.habitats.includes(habitat)) && (!f.weather || f.weather.includes(weather)) && (!f.seasons || f.seasons.includes(season)));
}

/** The tag when a friend turns back from a fork. */
export const TURNED_BACK = 'Turning back with a light pack.';

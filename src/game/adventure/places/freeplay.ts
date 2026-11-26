/**
 * Free Play's own places and finds. Haru and Yui set out from Mio, so Sora is
 * someone to meet up at his hut, like everyone else. And each reach keeps one
 * place that no rumour points to: when every other place in that reach is on
 * the map, it shows itself by the fire (see `wanderings.ts`). None of this is
 * ever found in a Journey.
 */

import type { RegionContent } from '../catalogue';

const AUTUMN = 2;
const WINTER = 3;

export const FREE_PLAY_CONTENT: RegionContent = {
  places: [
    {
      id: 'yunotani', name: 'Yunotani', region: 0, at: { x: 380, y: 300 }, habitat: 'pool',
      note: 'A hot spring in a hidden fold under the peaks.',
      teaser: 'Steam rises from a hidden fold under the peaks at Yunotani.',
      activities: ['explore', 'forage', 'track', 'investigate'],
      lines: {
        explore: ['Up through the steam.', 'Warm stones underfoot.', 'Over the last ridge.'],
        forage: ['Cress in the warm runnels.', 'Moss as green as summer.', 'Kneeling by the warm water.'],
        track: ['Prints round the warm pool.', 'Grey hair on a rock.', 'Something bathes here.'],
        investigate: ['Hand in the warm water.', 'Steam off the stones.', 'Where the heat comes from.'],
      },
      yields: { forage: 1 },
      learn: [
        { text: 'The water stays warm even under deep snow.' },
        { text: 'Monkeys come down to bathe when the snow comes.', when: { seasons: [WINTER] } },
        { text: 'Haru sits with her feet in the water and says nothing for a long while. Then: “I could get used to mountains.”', person: 'haru' },
      ],
    },
    {
      id: 'iori', name: 'Iori', region: 1, at: { x: 380, y: 4260 }, habitat: 'shrine',
      note: 'A hermit’s hut and a mossy shrine, deep in the western wood.',
      teaser: 'An old hermit keeps a shrine at Iori, deep in the western wood.',
      activities: ['visit', 'explore', 'investigate'],
      lines: {
        visit: ['Tea with the hermit.', 'Sweeping the shrine steps.', 'A long, easy quiet.'],
        explore: ['Under the old cedars.', 'Along a path of moss.', 'Deeper into the wood.'],
        investigate: ['Moss on the old stones.', 'Carvings worn soft.', 'Offerings from long ago.'],
      },
      yields: { visit: 1 },
      learn: [
        { text: 'The hermit has kept the shrine for forty years. He counts the seasons by the moss.' },
        { text: 'He knew Aki’s grandfather. “Mended my roof once. Wouldn’t take a coin.”', person: 'aki' },
        { text: 'Yui asks the hermit for a story. He gives her a riddle instead, and she is pleased with it for days.', person: 'yui' },
      ],
    },
    {
      id: 'kakureura', name: 'Kakure-ura', region: 2, at: { x: 2460, y: 5840 }, habitat: 'beach',
      note: 'A little cove past the lighthouse, hidden from the river.',
      teaser: 'Past the lighthouse, the cove at Kakure-ura is known only to the gulls.',
      activities: ['explore', 'forage', 'fish'],
      lines: {
        explore: ['Round the rocks.', 'Sand nobody has walked.', 'Into the hidden cove.'],
        forage: ['Shells along the tideline.', 'Kneeling by the pools.', 'Sea lettuce on the stones.'],
        fish: ['A line off the rocks.', 'Waiting on the tide.', 'Small fish in clear water.'],
      },
      yields: { forage: 1, fish: 1 },
      learn: [
        { text: 'You can only see the cove from the water, or from the rocks behind the lighthouse.' },
        { text: 'Haru finds sideways prints in the sand and laughs. “Crabs. Still crabs.”', person: 'haru' },
      ],
    },
  ],

  finds: [
    {
      id: 'sora-meeting', name: 'Sora', category: 'encounters', region: 0,
      story: { reason: 'Someone lives up at the hut below the falls' },
      at: ['yamagoya'], activities: ['visit', 'explore', 'investigate'],
      text: 'Sora lives at Yamagoya with the wind and a shelf of old maps. He has never been farther than the village, and has dreamed of the sea since he was small. When we say we walked up from it, he goes very quiet. “I’ll get there,” he says. “My own way.” He shows us his maps instead.',
      tag: 'A boy at the hut door.', hint: 'Someone lives up at the hut below the falls.',
    },
    {
      id: 'warm-spring', name: 'The warm spring', category: 'curiosities', region: 0,
      at: ['yunotani'], activities: ['explore', 'investigate'],
      text: 'Water that comes out of the mountain as warm as a bath. We sat with our feet in it until the light went.',
      tag: 'Steam off still water.', hint: 'Somewhere under the peaks, the water runs warm.',
    },
    {
      id: 'bathing-monkeys', name: 'Monkeys in the hot water', category: 'wildlife', region: 0, rare: true,
      at: ['yunotani'], activities: ['track', 'explore'], when: { seasons: [AUTUMN, WINTER] },
      text: 'A whole troop up to their chins in the steam, eyes half shut. One baby fell asleep on its mother’s head.',
      tag: 'Grey shapes in the steam.', hint: 'When the cold comes, someone else likes the warm water.',
    },
    {
      id: 'hermit', name: 'The hermit of Iori', category: 'encounters', region: 1,
      at: ['iori'], activities: ['visit'],
      text: 'An old man in a patched coat, who keeps the shrine because someone once left it to him. He has not been down to the village in years, and asks after it kindly, as if it were a relative.',
      tag: 'Tea in a quiet clearing.', hint: 'Someone keeps the old shrine in the western wood.',
    },
    {
      id: 'moss-garden', name: 'The hermit’s moss garden', category: 'plants', region: 1,
      at: ['iori'], activities: ['investigate', 'explore'],
      text: 'Forty kinds of moss, he says, and he has named every one. Some of the names are rude.',
      tag: 'Green, in forty shades.', hint: 'Something is tended very slowly at the shrine.',
    },
    {
      id: 'hidden-cove', name: 'The hidden cove', category: 'curiosities', region: 2,
      at: ['kakureura'], activities: ['explore'],
      text: 'Sand like sugar, rocks on both sides, and water so clear you can count the stones. Nobody else knows it is here.',
      tag: 'Clear water between the rocks.', hint: 'Past the lighthouse, somewhere only the gulls go.',
    },
    {
      id: 'nautilus-shell', name: 'A paper nautilus', category: 'keepsakes', region: 2, rare: true,
      at: ['kakureura'], activities: ['forage', 'explore'],
      text: 'A shell as thin as paper, washed in whole. Yui says the old stories call it the sea’s letter.',
      tag: 'Something white and very light.', hint: 'The cove keeps something fragile on its tideline.',
    },
  ],

  leads: [],
};

/** The place each reach keeps back until every other place in it is found. */
export const SECRET_PLACES: Readonly<Record<number, string>> = { 0: 'yunotani', 1: 'iori', 2: 'kakureura' };

const SECRETS = new Set(Object.values(SECRET_PLACES));
export const isSecretPlace = (id: string): boolean => SECRETS.has(id);

/** Finds only Free Play has: Sora's meeting, and what the secret places keep. */
export const FREE_PLAY_FINDS: ReadonlySet<string> = new Set(FREE_PLAY_CONTENT.finds.map((f) => f.id));

/** Said by the fire the evening a reach's secret shows itself. */
export const SECRET_REVEALS: Readonly<Record<string, { title: string; text: string }>> = {
  yunotani: {
    title: 'Steam under the peaks',
    text: 'Coming down off the mountain at dusk, we saw steam rising from a fold under the peaks that nobody has ever mentioned. Warm water, perhaps, up where everything should be frozen.',
  },
  iori: {
    title: 'A bell in the western wood',
    text: 'A small bell rang somewhere deep in the western wood as the light went. There is a path under the cedars we had never noticed, swept clean.',
  },
  kakureura: {
    title: 'A cove past the light',
    text: 'From the rocks behind the lighthouse, Yui spotted a strip of white sand round the point, tucked out of sight of the river. “That,” she said, “is going in the story.”',
  },
};

/** The first page of a Free Play notebook. */
export const FREE_OPENING = 'Haru has left the Matsubara pines to watch themselves for once. She and Yui make camp at Mio, halfway up the river. “Where first?” asks Yui. Haru shrugs. “Wherever the path looks nicest. We’ve all year.”';

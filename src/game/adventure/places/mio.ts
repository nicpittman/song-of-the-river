/**
 * Mio, the middle river: orchard country and the long bend. Aki the carpenter
 * lives at the lantern house, the mill keeps old boat drawings in its loft, and
 * the far bank waits for a bridge. The way on is through the reeds at the
 * bend, or the herons’ line seen from the hill shrine.
 */

import type { RegionContent } from '../catalogue';

const SPRING = 0;
const SUMMER = 1;
const AUTUMN = 2;
const WINTER = 3;

export const MIO: RegionContent = {
  places: [
    {
      id:'miyamori', name:'Miyamori', region:1, at:{x:150,y:3540}, habitat:'woodland',
      note:'The deep western wood. Old cedars shade a path used by charcoal carriers.',
      teaser:'At Miyamori, the wood closes round the old charcoal path.',
      activities:['explore','track','forage'],
      lines:{explore:['Light between the cedar trunks.'],track:['Fresh prints in the damp needles.'],forage:['Gathering fallen kindling.']},
      learn:[{text:'The cedar path joins the lower wood at Nishibayashi.',activity:'explore',hearsOf:['nishibayashi']},{text:'Bird calls carry farther here after rain.'}],
    },
    {
      id:'higashimori', name:'Higashimori', region:1, at:{x:2020,y:4020}, habitat:'woodland', crossing:'mio-bridge',
      note:'A quiet wood above the eastern bank, looking back over Mio’s bend.',
      teaser:'Higashimori’s trees stand dark above the far bank.',
      activities:['explore','track','forage'],
      lines:{explore:['The whole river bend between the branches.'],track:['A narrow run through the ferns.'],forage:['Dry twigs below the old beeches.']},
      learn:[{text:'The beeches here are older than anything in Mio.'},{text:'From here, a deer path climbs towards Kitsuneyama Shrine.',activity:'explore',hearsOf:['kitsuneyama']},{text:'Above the wood, an old track keeps to the ridge, high and dry over the wet meadows.',when:{way:'high-path',levels:['middle','high']}}],
    },
    {
      id: 'ringozaka', name: 'Ringozaka', region: 1, at: { x: 440, y: 2820 }, habitat: 'orchard',
      note: 'The old orchard slope. Someone still tends the trees.',
      teaser: 'Someone still tends the old trees on the slope at Ringozaka.',
      activities: ['forage', 'explore', 'visit'],
      rules: [
        { when: { seasons: [SPRING] }, state: 'special', line: 'The orchard is in blossom.', odds: 1, reason: 'Blossom and bees', activities: ['explore'] },
        { when: { seasons: [AUTUMN] }, state: 'special', line: 'Apples ready to pick.', odds: 1, reason: 'Apples ready', activities: ['forage'] },
      ],
      farther: {
        name: 'the top of the slope', at: { x: 330, y: 2700 },
        lines: ['Up through the top rows.', 'The river shining below.', 'Under the oldest tree.'],
      },
      lines: {
        forage: ['Reaching into the branches.', 'Windfalls in the long grass.', 'A ladder against the tree.'],
        explore: ['Down the rows slowly.', 'Bees in every tree.', 'Along the old stone wall.'],
        visit: ['Helping the old man prune.', 'Talking over the wall.', 'Sharing a pear in the shade.'],
      },
      yields: { forage: 1, visit: 1 },
      learn: [
        { text: 'An old man tends the trees and likes help.', activity: 'visit' },
        { text: 'The apples are ready in autumn.', when: { seasons: [AUTUMN] } },
        { text: 'The blossom draws bees from all over the valley.', when: { seasons: [SPRING] } },
        { text: 'The old man in the orchard hands Mina a pear. “Eat it, and plant the pips by the sea.” She saves every pip in her seed bag.', person: 'mina' },
      ],
    },
    {
      id: 'mio', name: 'Mio', kind: 'settlement', region: 1, at: { x: 610, y: 3210 }, marker: { x: 600, y: 3310 }, habitat: 'village',
      note: 'An orchard village beside the river, with a lantern-lit inn and a busy mill.',
      teaser: 'Mio’s orchards run down to the river, and its mill is never quiet.',
      activities: ['visit'],
      lines: { visit: ['Tea by the village fire.', 'Asking about the river downstream.', 'Sharing news with the villagers.'] },
      yields: { visit: 1 },
      learn: [{ text: 'The lantern house welcomes travellers across the village yard.' }, { text: 'The fire is lit by the well.' }],
    },
    {
      id: 'toroya', name: 'Toroya Inn', region: 1, at: { x: 665, y: 3220 }, marker: { x: 690, y: 3133 }, habitat: 'inn',
      note: 'Mio’s inn, hung with lanterns. A carpenter lodges here, and fixes the roof when he isn’t on it.',
      teaser: 'The lanterns at Toroya Inn are lit early, and a carpenter lodges there.',
      activities: ['visit', 'investigate', 'explore'],
      rules: [
        { when: { weather: ['rain', 'snow'] }, state: 'special', line: 'A full house, out of the weather.', odds: 1, reason: 'Everyone is in today', activities: ['visit'] },
      ],
      lines: {
        visit: ['Tea by the long hearth.', 'Talking with the carpenter.', 'Stories over supper.'],
        investigate: ['Counting the lanterns.', 'Looking over the old beams.', 'Names carved by the door.'],
      },
      yields: { visit: 1 },
      learn: [
        { text: 'Aki the carpenter mends the roof here.', activity: 'visit' },
        { text: 'Aki won’t leave Mio until a cottage, or the narrows footbridge, stands finished.', activity: 'visit', when: { journey: true } },
        { text: 'Every lantern stands for a boat that went to the sea.', activity: 'investigate' },
        { text: 'On wet days the whole village comes in.', when: { weather: ['rain', 'snow'] } },
        { text: 'Aki pats a roof post. “Mended this, too. Grandfather made the beams; I hope my roof lasts as long.”', person: 'aki', activity: 'visit' },
        { text: 'Aki stops under the one unlit lantern by the door. “Grandfather’s. They light one for every boat that reaches the sea. We’ll send word.”', person: 'aki' },
        { text: 'Mio’s old carpenter carved toy boats for children all along the river, pegged together like real ones.', activity: 'visit' },
        { text: 'The innkeeper wants Ren’s way with river fish. Ren wants the chestnut stew. By supper they have swapped, and each says theirs was better.', person: 'ren' },
      ],
    },
    {
      id: 'kurumaya', name: 'Kurumaya Mill', region: 1, at: { x: 870, y: 3480 }, habitat: 'mill',
      note: 'The willow mill. The wheel turns with the river.',
      teaser: 'Kurumaya Mill keeps its old papers in the loft.',
      activities: ['fish', 'investigate', 'visit', 'explore'],
      rules: [
        { when: { levels: ['high'] }, state: 'special', line: 'The wheel is racing with the high water.', odds: -1, reason: 'The race is too fast', activities: ['fish'] },
        { when: { levels: ['low'] }, state: 'special', line: 'The race runs slow. The old sluice shows.', odds: 1, reason: 'The sluice is dry to look at', activities: ['investigate'] },
      ],
      lines: {
        fish: ['Casting into the mill pool.', 'Below the wheel, in the foam.', 'A few steps down the race.'],
        investigate: ['Up in the mill loft.', 'Unfolding the old drawings.', 'Looking over the old gears.'],
        visit: ['Talking with the miller.', 'Helping with the sacks.', 'Tea on the mill step.'],
      },
      yields: { fish: 1, visit: 1 },
      learn: [
        { text: 'The miller keeps old drawings in the loft.', activity: 'investigate' },
        { text: 'Eels come up the race at night.', activity: 'fish' },
        { text: 'At high water the wheel races and the pool is wild.', when: { levels: ['high'] } },
        { text: 'The miller tells Ren the eels are born in the sea. Ren looks at the eel, then down the river, and goes quiet for the rest of the day.', person: 'ren' },
        { text: 'The miller has had word from Suisha Mill. “Travellers going to the sea, it says. And something about tea.” Sora laughs.', person: 'sora' },
      ],
    },
    {
      id: 'yanagi', name: 'Yanagi', region: 1, at: { x: 970, y: 3665 }, marker: { x: 1015, y: 3665 }, habitat: 'riverbank',
      note: 'The willow bank below the mill.',
      teaser: 'Willows trail their fingers in the water at Yanagi, below the mill.',
      activities: ['fish', 'forage', 'explore', 'track'],
      rules: [
        { when: { levels: ['high'] }, state: 'special', line: 'The willows stand in the water.', odds: -1, reason: 'The bank is under', activities: ['forage'] },
      ],
      lines: {
        track: ['A slide worn in the bank.', 'Fish scales on a stone.', 'Prints under the roots.'],
        fish: ['Casting under the willows.', 'The line drifts in the shade.', 'Waiting at the slack water.'],
        forage: ['Cutting willow wands.', 'Kneeling at the waterline.', 'Picking cress in the shallows.'],
        explore: ['Along under the willows.', 'Watching the far bank.', 'Stepping over the roots.'],
      },
      yields: { fish: 1, forage: 1 },
      learn: [
        { text: 'Otters slide down the bank under the far willows.', activity: 'track' },
        { text: 'A willow cutting will root anywhere there is water.', activity: 'forage' },
        { text: 'An otter lives under the far roots.', activity: 'explore' },
        { text: 'There is a garden on the far bank, Mukoniwa, if a bridge could reach it.' },
        { text: 'Mina pushes a willow cutting into the wet bank and pats the mud round it. “For whoever comes this way next.”', person: 'mina' },
        { id: 'flood-drift', text: 'At high water the river runs brown past the willows, carrying sticks and reeds down towards the bend.', when: { levels: ['high'] } },
      ],
    },
    {
      id: 'nishibayashi', name: 'Nishibayashi', region: 1, at: { x: 260, y: 3880 }, habitat: 'woodland',
      note: 'The west wood, on the slope above the bend.',
      teaser: 'The west wood at Nishibayashi climbs above the bend, dim and green.',
      activities: ['forage', 'explore', 'investigate', 'track'],
      rules: [
        { when: { seasons: [AUTUMN] }, state: 'special', line: 'Chestnuts falling.', odds: 1, reason: 'Chestnuts falling', activities: ['forage'] },
      ],
      farther: {
        name: 'the charcoal burners’ glade', at: { x: 90, y: 3700 },
        lines: ['Deeper into the wood.', 'Along an old cart track.', 'Into a quiet glade.'],
      },
      lines: {
        track: ['A narrow path through the bracken.', 'Prints by the old cart track.', 'Waiting where the trail crosses.'],
        forage: ['Kneeling in the bracken.', 'Mushrooms by a stump.', 'Filling a basket slowly.'],
        explore: ['A loop through the trees.', 'Following an old track.', 'Light through the leaves.'],
        investigate: ['An old cart track.', 'A ring of blackened stones.', 'Tracks in soft ground.'],
      },
      yields: { forage: 1 },
      learn: [
        { text: 'A tanuki family keeps to the old cart track.', activity: 'track' },
        { text: 'Charcoal burners worked here once.', activity: 'investigate' },
        { text: 'Chestnuts fall in autumn.', when: { seasons: [AUTUMN] } },
        { text: 'A tanuki family lives by the old track.', activity: 'explore' },
        { text: 'Ren finds an old iron pot in the charcoal burners’ glade and scrubs it out in the stream. “Still good. Nobody makes them like this now.”', person: 'ren' },
      ],
    },
    {
      id: 'omagari', name: 'Omagari', region: 1, at: { x: 590, y: 4080 }, habitat: 'reeds',
      note: 'The long bend, deep in reeds.',
      teaser: 'At Omagari the river bends long and slow, and the reeds grow over your head.',
      activities: ['explore', 'investigate', 'forage'],
      rules: [
        { when: { levels: ['high'] }, state: 'closed', line: 'The bend is flooded where the path runs.' },
        { when: { levels: ['middle'] }, state: 'special', line: 'The tops of the old stakes show. We can trace them from the higher bank.' },
      ],
      farther: {
        name: 'the old stakes', at: { x: 668, y: 4118 },
        lines: ['Out along the line of stakes.', 'Into the reeds.', 'Where the stakes run out.'],
      },
      lines: {
        explore: ['Along the edge of the bend.', 'Reeds over our heads.', 'Out to a dry hummock.'],
        investigate: ['Old stakes in a line.', 'Kneeling at the water’s edge.', 'Parting the reeds.'],
        forage: ['Cutting reeds for thatch.', 'Picking along the bank.', 'Wild mint by the path.'],
      },
      yields: { forage: 1 },
      learn: [
        { text: 'The path round the bend floods at high water.' },
        { text: 'The old stakes show as the river falls. At middle water we can follow their tops from the higher bank.', when: { levels: ['middle', 'low'] } },
        { text: 'A line of old stakes runs out into the reeds, and something grey lies at the end of it.', activity: 'investigate' },
        { text: 'Aki wades out to the grey boat in the reeds and runs a thumb along her side. “Grandfather’s joints. I’d know them anywhere.”', person: 'aki' },
        { text: 'Past the grey boat, the stakes go on through the reeds, as if someone meant to walk them all the way down.', when: { levels: ['middle', 'low'] } },
      ],
    },
    {
      id: 'ashiura', name: 'Ashiura', region: 1, at: { x: 530, y: 4190 }, habitat: 'reeds',
      note: 'The reed bay inside the bend, full of birds.',
      teaser: 'Ashiura’s reed bay is loud with birds from first light.',
      activities: ['fish', 'explore', 'forage', 'investigate'],
      rules: [
        { when: { seasons: [WINTER] }, state: 'special', line: 'Ducks crowding the open water.', odds: 1, reason: 'Ducks in for the winter', activities: ['explore'] },
        { when: { levels: ['high'] }, state: 'special', line: 'The bay has flooded the reeds. The higher bank stays dry, but the old stakes are hidden.', odds: -1, reason: 'Flooded reeds', activities: ['forage'] },
      ],
      lines: {
        fish: ['Casting across still water.', 'Waiting by the reed edge.', 'A slow line in the bay.'],
        explore: ['Round the bay quietly.', 'Watching the egrets.', 'Out on a fallen willow.'],
        investigate: ['Following the higher bank.', 'Looking for the tops of old stakes.', 'Tracing a way past the bend.'],
        forage: ['Lotus roots in the mud.', 'Kneeling at the edge.', 'Cutting a few reeds.'],
      },
      yields: { fish: 1, forage: 1 },
      learn: [
        { text: 'At high water the bay spreads into the reeds and the roots are out of reach.', when: { levels: ['high'] } },
        { text: 'Old stakes lead south past the bend. From this higher bank we can trace them once the river falls to middle water.', activity: 'investigate' },
        { text: 'Egrets fish the shallows in summer.', when: { seasons: [SUMMER, SPRING] } },
        { text: 'Ducks crowd in when the cold comes.', when: { seasons: [WINTER, AUTUMN] } },
        { text: 'Sora tries to count the ducks on the bay. He gets to forty, loses his place, and starts again. Then again.', person: 'sora' },
      ],
    },
    {
      id: 'mukoniwa', name: 'Mukoniwa', region: 1, at: { x: 1570, y: 3570 }, habitat: 'garden', crossing: 'mio-bridge',
      note: 'The far-bank garden, gone wild.',
      teaser: 'A garden has gone wild across the water at Mukoniwa.',
      activities: ['forage', 'visit', 'explore'],
      rules: [
        { when: { seasons: [SUMMER] }, state: 'special', line: 'The garden is full of flowers.', odds: 1, reason: 'Everything in flower', activities: ['forage', 'explore'] },
      ],
      lines: {
        forage: ['Seed heads into a cloth.', 'Kneeling among the flowers.', 'Cuttings from the old roses.'],
        visit: ['Talking with the gardener.', 'Helping weed a bed.', 'Tea on the garden bench.'],
        explore: ['Along the overgrown paths.', 'Past the stone lantern.', 'Round the walled beds.'],
      },
      yields: { forage: 1, visit: 1 },
      learn: [
        { text: 'Only the bridge reaches the far bank.' },
        { text: 'A gardener still comes here from the hill.', activity: 'visit' },
        { text: 'Seeds from every reach of the river grow here.', activity: 'forage' },
        { text: 'Mina shows the gardener her seed bag at last: a twist of paper from every place we have slept. The gardener shows Mina hers. They are still at it at dusk.', person: 'mina' },
      ],
    },
    {
      id: 'kitsuneyama', name: 'Kitsuneyama Shrine', region: 1, at: { x: 1700, y: 3450 }, habitat: 'shrine', crossing: 'mio-bridge',
      note: 'The hill shrine above the far bank, kept by stone foxes.',
      teaser: 'Stone foxes keep Kitsuneyama Shrine, on the hill above the far bank.',
      activities: ['explore', 'visit', 'investigate'],
      farther: {
        name: 'the top of the hill', at: { x: 1850, y: 3300 },
        lines: ['Up to the top of the hill.', 'The whole bend below.', 'Watching the birds go over.'],
      },
      lines: {
        explore: ['Up the mossy steps.', 'Round the shrine slowly.', 'Looking out over the bend.'],
        visit: ['Leaving rice at the shrine.', 'Talking with a pilgrim.', 'Sitting on the steps.'],
        investigate: ['Reading the old stones.', 'Behind the shrine.', 'A little stone fox.'],
      },
      learn: [
        { text: 'The pilgrims come up from the far bank, never from Mio.', activity: 'visit' },
        { text: 'From the hilltop you can see the whole bend, and the mist beyond it.', activity: 'explore' },
        { text: 'Stone foxes guard the shrine.', activity: 'investigate' },
        { text: 'On clear mornings herons cross the hill, one after another, always the same way.', when: { way: 'herons', weather: ['clear'] } },
      ],
    },
  ],

  finds: [
    {
      id: 'orchard-blossom', name: 'Orchard blossom', category: 'plants', region: 1,
      at: ['ringozaka'], activities: ['explore', 'forage'], when: { seasons: [SPRING] },
      text: 'The branches hum with visiting wings.',
      tag: 'Petals caught in the pack straps.', hint: 'At Ringozaka, in spring.',
    },
    {
      id: 'late-apples', name: 'The late apples', category: 'plants', region: 1,
      at: ['ringozaka'], activities: ['forage'], when: { seasons: [AUTUMN] },
      text: 'Small, red and very sweet. A few were left on the high branches for the birds.',
      tag: 'A sweet smell from the basket.', hint: 'At Ringozaka, in autumn.',
    },
    {
      id: 'orchard-keeper', name: 'The orchard keeper', category: 'encounters', region: 1,
      at: ['ringozaka'], activities: ['visit'],
      text: 'An old man who prunes the trees every winter, because, he says, nobody else will.',
      tag: 'A slow talk under the trees.', hint: 'Someone tends the old orchard.',
    },
    {
      id: 'aki-meeting', name: 'Aki the carpenter', category: 'encounters', region: 1,
      story: { reason: 'Someone is hammering on the inn roof' },
      at: ['toroya'], activities: ['visit'],
      text: 'Aki is up on the inn roof with a mouthful of nails. His grandfather was Mio’s carpenter, and built a boat for the sea; she got as far as the reeds below the village before Mio called him home to mend something. He never went back for her. Aki wants to come with us and take that boat to sea, once we help him keep his promise to Mio: a village cottage or a footbridge at the narrows.',
      freeText: 'Aki is up on the inn roof with a mouthful of nails. His grandfather built a boat for the sea, and she got as far as the reeds below the village. Aki climbs down, wipes his hands, and says he could build anything along this river, given good timber. Even a boat that goes the whole way.',
      tag: 'A long talk on the roof.', hint: 'Someone is hammering on the inn roof at Toroya.',
    },
    {
      id: 'lanterns', name: 'A lantern for every boat', category: 'curiosities', region: 1,
      at: ['toroya', 'jizo'], activities: ['investigate'],
      text: 'Paper lanterns along every beam, each with the name of a boat that reached the sea. One by the door has never been lit: the old carpenter’s, whose boat got as far as the reeds.',
      tag: 'Names on paper, in rows.', hint: 'Inspect the inn’s lanterns.',
    },
    {
      id: 'boat-ledger', name: 'Grandfather’s boat plans', category: 'keepsakes', region: 1,
      story: { reason: 'The miller keeps old boat plans in the loft' },
      at: ['kurumaya'], activities: ['investigate'], after: 'aki-meeting', unless: 'boatyard-moulds',
      text: 'Folded in the mill loft, where the old carpenter left them for safekeeping: the plans for his boat. Aki knows the hand at once. “Room for a family, provisions and one small garden. That was always his idea.” Up in the bow, Grandfather has drawn one more seat, far too small for a grown man.',
      tag: 'A drawing worth copying.', hint: 'Among the papers at Kurumaya Mill.',
    },
    {
      id: 'eel', name: 'An eel by the wheel', category: 'fish', region: 1,
      at: ['kurumaya'], activities: ['fish'], when: { levels: ['middle', 'low'] },
      text: 'It came up the mill race in the dark. The miller says it was born in the sea.',
      tag: 'Something long and dark on the line.', hint: 'At Kurumaya Mill, when the race runs slow.',
    },
    {
      id: 'willow-cutting', name: 'Willow cutting', category: 'plants', region: 1,
      at: ['yanagi'], activities: ['forage'],
      text: 'Wrapped in damp moss, it will root anywhere there is water.',
      tag: 'Something green, wrapped in moss.', hint: 'On the willow bank at Yanagi.',
    },
    {
      id: 'otter', name: 'Otter at the willows', category: 'wildlife', region: 1, rare: true,
      at: ['yanagi'], activities: ['explore', 'fish'],
      text: 'It rolled in the shallows, looked straight at us, and was gone.',
      tag: 'A sleek head in the water.', hint: 'Under the far roots of the willows.',
      sighting: { near: [{ x: 1060, y: 3665 }], line: 'An otter rolling in the shallows' },
    },
    {
      id: 'tanuki', name: 'The tanuki', category: 'wildlife', region: 1,
      at: ['nishibayashi','miyamori','higashimori', 'takebayashi'], activities: ['explore'],
      text: 'Round as a tea kettle, it sat under the ferns and looked at us for a long moment. Then it waddled off without hurrying.',
      tag: 'Something round under the ferns.', hint: 'By the old tracks in Mio’s deep woods.',
      sighting: { near: [{ x: 300, y: 3830 }, { x: 380, y: 2900 }], line: 'A tanuki under the ferns' },
    },
    {
      id: 'tanuki-trail', name: 'The tanuki’s trail', category: 'curiosities', region: 1,
      at: ['nishibayashi', 'miyamori', 'higashimori'], activities: ['track'], follows: 'tanuki',
      text: 'Small round prints along the old cart track, the same way every night, as tidy as a lane.',
      tag: 'Small round prints.', hint: 'Tracking in Nishibayashi.',
    },
    {
      id: 'otter-slide', name: 'The otter slide', category: 'curiosities', region: 1,
      at: ['yanagi'], activities: ['track'], follows: 'otter',
      text: 'A smooth chute worn in the bank under the far willows. Something here slides into the river for fun.',
      tag: 'A slide worn in the bank.', hint: 'Tracking at Yanagi.',
    },
    {
      id: 'chestnuts', name: 'Chestnuts', category: 'plants', region: 1,
      at: ['nishibayashi', 'chabatake', 'higashimori'], activities: ['forage'], when: { seasons: [AUTUMN] },
      text: 'Spiny cases split open on the path. Roasted, they taste of smoke and autumn.',
      tag: 'A basket of spiny cases.', hint: 'In Nishibayashi, in autumn.',
    },
    {
      id: 'charcoal-kiln', name: 'The charcoal burners’ ring', category: 'keepsakes', region: 1,
      at: ['nishibayashi'], activities: ['investigate'], farther: true,
      text: 'A ring of blackened stones in a glade, and a clay pipe someone dropped long ago.',
      tag: 'Black stones in a ring.', hint: 'Deep in Nishibayashi.',
    },
    {
      id: 'reed-way', survey: 14, name: 'The way through the reeds', category: 'curiosities', region: 1,
      story: { reason: 'The old stakes are there to follow' },
      at: ['omagari', 'ashiura'], activities: ['investigate', 'explore'], when: { levels: ['middle', 'low'] },
      text: 'Where the bend turns, a line of old stakes runs into the reeds. From the higher bank we trace them south, all the way to the lower river.',
      tag: 'A line of stakes, going south.', hint: 'As the water falls, old stakes show at Omagari and Ashiura. Trace them from the higher bank.',
    },
    {
      id: 'old-boat', name: 'The boat in the reeds', category: 'keepsakes', region: 1,
      at: ['omagari'], activities: ['explore', 'investigate'], farther: true,
      text: 'A little river boat pulled up into the reeds long ago, grey and dry, her joints still tight. Someone made it as far as this, and walked home.',
      tag: 'A grey shape in the reeds.', hint: 'Out along the old stakes at Omagari.',
    },
    {
      id: 'swallows', name: 'Swallows under the eaves', category: 'birds', region: 1,
      at: ['toroya'], activities: ['visit', 'investigate'], when: { seasons: [SPRING, SUMMER] },
      text: 'Nests under every eave of the lantern house, and swallows in and out of them all day.',
      tag: 'Wings flicking past the eaves.', hint: 'Watch the inn’s eaves in spring or summer.',
      sighting: { near: [{ x: 640, y: 3170 }], line: 'Swallows round the lantern house' },
    },
    {
      id: 'rice-planting', name: 'Rice planting', category: 'encounters', region: 1,
      at: ['toroya'], activities: ['visit'], when: { seasons: [SPRING] },
      text: 'The whole village up to its knees in the terraces, planting in rows and singing to keep time.',
      tag: 'Muddy to the knees, and singing.', hint: 'In Mio, in spring.',
    },
    {
      id: 'flood-wrack', name: 'The flood line in the willows', category: 'curiosities', region: 1,
      at: ['yanagi'], activities: ['explore', 'forage'], when: { levels: ['high'] },
      text: 'Sticks, reeds and a wooden spoon caught high in the willows, exactly where the flood reached.',
      tag: 'Drift caught in the branches.', hint: 'At Yanagi, at high water.',
    },
    {
      id: 'frogs', name: 'Frog song', category: 'wildlife', region: 1,
      at: ['ashiura'], activities: ['explore', 'fish'], when: { seasons: [SPRING, SUMMER] },
      text: 'Every ditch round the bay sings at dusk, loud enough to talk over.',
      tag: 'A chorus from the ditches.', hint: 'At Ashiura, on a warm evening.',
      sighting: { near: [{ x: 760, y: 4020 }, { x: 860, y: 4110 }], line: 'A frog, and a plop' },
    },
    {
      id: 'wild-garlic', name: 'Wild garlic', category: 'plants', region: 1,
      at: ['nishibayashi', 'takebayashi'], activities: ['forage'], when: { seasons: [SPRING] },
      text: 'A green carpet under the trees, and a smell you can follow from the cart track.',
      tag: 'A strong green smell.', hint: 'In Nishibayashi, in spring.',
    },
    {
      id: 'egret', name: 'Little egret', category: 'birds', region: 1,
      at: ['ashiura'], activities: ['explore'], when: { seasons: [SPRING, SUMMER], levels: ['middle', 'low'] },
      text: 'White as paper, with yellow feet it stirs the mud with.',
      tag: 'Something white in the shallows.', hint: 'In Ashiura’s mud in the warm months, when the water is down.',
      sighting: { near: [{ x: 925, y: 4100 }, { x: 760, y: 3660 }], line: 'An egret stirring the mud' },
    },
    {
      id: 'mandarin', name: 'Mandarin ducks', category: 'birds', region: 1, rare: true,
      at: ['ashiura'], activities: ['explore'], when: { seasons: [AUTUMN, WINTER] },
      text: 'A pair, painted as if for a festival. They keep to each other all winter.',
      tag: 'Bright colours on the water.', hint: 'In Ashiura, when the cold comes.',
      sighting: { near: [{ x: 820, y: 4080 }, { x: 740, y: 3980 }], line: 'Mandarin ducks among the reeds' },
    },
    {
      id: 'stubble-cranes', name: 'Cranes in the stubble', category: 'birds', region: 1, rare: true, when: { seasons: [AUTUMN, WINTER] },
      text: 'Two cranes danced in the cut rice field, bowing and leaping as if nobody were watching. Then they noticed us, and walked away with great dignity.',
      tag: 'Tall grey shapes in the field.', hint: 'In the cut rice fields, when the cold comes with mist or snow.',
      sighting: { near: [{ x: 520, y: 3440 }, { x: 230, y: 3290 }], line: 'Cranes dancing in the stubble', moment: { weather: ['mist', 'snow'] } },
    },
    {
      id: 'wild-boar', name: 'The wild boar', category: 'wildlife', region: 1, when: { seasons: [AUTUMN] },
      text: 'Snuffling under the oaks for acorns, she ignored us completely. Her half-grown young followed her in a line.',
      tag: 'Rooting under the oaks.', hint: 'Under the oaks of Mio’s woods, in autumn.',
      sighting: { near: [{ x: 180, y: 3520 }, { x: 280, y: 3850 }], line: 'A boar rooting for acorns' },
    },
    {
      id: 'mill-carp', name: 'Carp at the mill', category: 'fish', region: 1, when: { seasons: [SUMMER], levels: ['high', 'middle'] },
      text: 'A big golden carp leapt in the mill race and fell back with a slap. The miller says it is older than he is.',
      tag: 'A splash in the mill race.', hint: 'At Kurumaya Mill, when the summer water runs high.',
      sighting: { near: [{ x: 880, y: 3500 }, { x: 960, y: 3640 }], line: 'A carp leaps in the mill race' },
    },
    {
      id: 'seed-packet', name: 'A folded seed packet', category: 'keepsakes', region: 1,
      at: ['mukoniwa'], activities: ['visit', 'forage'],
      text: 'In the gardener’s hand: “Plant these somewhere you hope to stay.”',
      tag: 'A small paper fold.', hint: 'In Mukoniwa, the far-bank garden.',
    },
    {
      id: 'old-roses', name: 'The old roses', category: 'plants', region: 1,
      at: ['mukoniwa'], activities: ['forage', 'explore'], when: { seasons: [SPRING, SUMMER] },
      text: 'Roses gone half wild over the garden wall, still sweet. Nobody remembers who planted them.',
      tag: 'A sweet smell over the wall.', hint: 'In Mukoniwa, in spring and summer.',
    },
    {
      id: 'heron-way', survey: 14, name: 'The herons’ way', category: 'curiosities', region: 1,
      story: { reason: 'The herons fly south past the hill' },
      at: ['kitsuneyama'], activities: ['explore'], farther: true, when: { weather: ['clear'] },
      text: 'From the hilltop we watched the herons fly south along a line of pools. That is the way down.',
      tag: 'Watching the birds go south.', hint: 'On clear days, herons fly from Kitsuneyama Shrine towards the lower pools. Climb the hill and follow their line.',
    },
    {
      id: 'high-path', survey: 14, name: 'The high path', category: 'curiosities', region: 1,
      story: { reason: 'The old track keeps dry above the flood' },
      at: ['higashimori'], activities: ['explore'],
      text: 'Above Higashimori an old charcoal track keeps to the ridge, high over the wet meadows. It runs all the way down the eastern shore to the village by the sea.',
      tag: 'A dry track along the ridge.', hint: 'An old track above Higashimori keeps to the ridge, clear of the river in every season. Look above the wood.',
    },
    {
      id: 'stone-fox', name: 'A stone fox', category: 'keepsakes', region: 1, rare: true,
      at: ['kitsuneyama'], activities: ['investigate'],
      text: 'A small stone fox with a red bib, half buried behind the shrine. We set it upright again.',
      tag: 'A small stone face.', hint: 'Behind Kitsuneyama Shrine.',
    },
    {
      id: 'willow-kingfisher', name: 'A kingfisher on the willow', category: 'birds', region: 1,
      when: { seasons: [SUMMER, AUTUMN, WINTER], structure: 'willow' },
      text: 'It fishes from the willow we planted, now that the branches reach the water.',
      tag: 'Blue on a willow branch.', hint: 'Willows over quiet water draw it.',
      sighting: { near: [], line: 'A kingfisher on the young willow' },
    },
    {
      id: 'white-eye', name: 'White-eyes in the blossom', category: 'birds', region: 1,
      when: { seasons: [SPRING], structure: 'fruit-tree' },
      text: 'Little green birds with white rings round their eyes, upside down in the blossom of our apple tree.',
      tag: 'Green birds in the blossom.', hint: 'Where an apple tree flowers in spring.',
      sighting: { near: [], line: 'White-eyes in the apple blossom' },
    },
  ],

  leads: [
    {
      id: 'aki-ledger', from: ['toroya'], when: {},
      to: 'kurumaya', find: 'boat-ledger', holds: {},
      line: 'Aki remembers a set of boat plans in the loft at Kurumaya Mill.',
    },
    {
      id: 'bend-stakes', from: ['kurumaya', 'yanagi', 'toroya'], when: { levels: ['high', 'middle'] },
      to: 'omagari', find: 'reed-way', holds: { levels: ['middle', 'low'] },
      line: 'As the river falls, old stakes show at Omagari. Their tops can be followed from the higher bank.',
    },
    {
      id: 'apples', from: ['ringozaka'], when: { seasons: [SUMMER] },
      to: 'ringozaka', find: 'late-apples', holds: { seasons: [AUTUMN] },
      line: 'The apples will be ready in autumn.',
    },
    {
      id: 'garden-herons', from: ['mukoniwa'], when: {},
      to: 'kitsuneyama', find: 'heron-way', holds: { weather: ['clear'] },
      line: 'Mukoniwa’s gardener watches the herons cross the shrine hill on clear mornings, always flying south.',
    },
    {
      id: 'ridge-track', from: ['mukoniwa', 'kitsuneyama', 'higashida'], when: {},
      to: 'higashimori', find: 'high-path', holds: {},
      line: 'An old charcoal track runs above Higashimori, clear of the river in every season.',
    },
    {
      id: 'far-bank', from: ['yanagi', 'kurumaya'], when: { structure: 'bridge' },
      to: 'mukoniwa', find: 'seed-packet', holds: {},
      line: 'With the bridge done, Mukoniwa is ours to see.',
    },
  ],
};

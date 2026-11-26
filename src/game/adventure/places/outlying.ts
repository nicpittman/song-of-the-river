/**
 * The outlying places: up on the mountain above Seseragi, and spread down the
 * length of Mio and Kawagiri. None is known at the start; each is heard of by
 * exploring a neighbour, then found by going (see `discovery.ts`).
 */

import { REED_CAMP, LIGHTHOUSE } from '../../world/boards/kawagiriSites';
import type { RegionContent } from '../catalogue';

const SPRING = 0;
const SUMMER = 1;
const AUTUMN = 2;
const WINTER = 3;

export const OUTLYING: RegionContent = {
  places: [
    // ── The mountain above Seseragi ──
    {
      id: 'matsuyama', name: 'Matsuyama', region: 0, at: { x: 760, y: 120 }, habitat: 'pines',
      note: 'The pine shoulder below the peaks.',
      teaser: 'The pines on Matsuyama’s shoulder sigh in the wind off the peaks.',
      activities: ['explore', 'forage', 'track'],
      rules: [{ when: { seasons: [WINTER] }, state: 'special', line: 'Snow in the pines.', odds: -1, reason: 'Deep snow under the pines' }],
      lines: {
        explore: ['Up through the old pines.', 'Wind in the needles.', 'Out onto the shoulder.'],
        forage: ['Pine cones into the basket.', 'Kneeling in the needles.', 'Resin on the fingers.'],
        track: ['Prints between the roots.', 'Cones stripped by something.', 'A feather on a low branch.'],
      },
      yields: { forage: 1 },
      learn: [
        { text: 'Squirrels strip the cones on the high stumps.', activity: 'track' },
        { text: 'From the shoulder you can see Kagami-numa below.', activity: 'explore' },
        { text: 'Something white has walked across the snow here, unhurried, on feathered feet.', when: { seasons: [WINTER] } },
      ],
    },
    {
      id: 'sumiyaki', name: 'Sumiyaki', region: 0, at: { x: 160, y: 330 }, marker: { x: 100, y: 246 }, habitat: 'woodland',
      note: 'A charcoal burner’s clearing in the western pines.',
      teaser: 'Someone keeps a kiln at Sumiyaki, in the western pines.',
      activities: ['visit', 'explore', 'investigate'],
      rules: [{ when: { seasons: [AUTUMN, WINTER] }, state: 'special', line: 'The kiln is lit for the cold months.', odds: 1, reason: 'The burner is home', activities: ['visit'] }],
      lines: {
        visit: ['Tea by the warm kiln.', 'Helping stack the wood.', 'Listening to the burner’s stories.'],
        explore: ['Round the smoky clearing.', 'Along the burner’s paths.', 'Up to the cutting ground.'],
        investigate: ['Looking into the kiln.', 'Old marks on the stacks.', 'Ash and old pottery.'],
      },
      yields: { visit: 1 },
      learn: [
        { text: 'The burner lights the kiln when the cold comes.', when: { seasons: [AUTUMN, WINTER] } },
        { text: 'Charcoal from here warms the whole village.', activity: 'visit' },
        { text: 'The burner looks at Sora for a long moment. “You’ve grown,” he says, and pours the tea.', activity: 'visit', person: 'sora' },
      ],
    },
    {
      id: 'izumi', name: 'Izumi', region: 0, at: { x: 1090, y: 80 }, marker: { x: 1196, y: 90 }, habitat: 'tarn',
      note: 'The high spring the river begins from.',
      teaser: 'The river begins at Izumi, from one cold spring.',
      activities: ['explore', 'investigate', 'forage'],
      lines: {
        explore: ['Up the last of the stair.', 'Where the water comes out of the rock.', 'Above everything.'],
        investigate: ['Watching the spring well up.', 'Moss on the wet rock.', 'Kneeling by the first water.'],
        forage: ['Cress at the spring’s lip.', 'Picking mountain herbs.', 'Kneeling on cold stone.'],
      },
      yields: { forage: 1 },
      learn: [
        { text: 'The whole river starts here, in one cold spring.' },
        { text: 'The path climbs from Matsuyama, over bare rock.' },
        { text: 'Ren tastes the first water. “No salt. We have a long way to go.”', person: 'ren' },
        { text: 'Mina leaves the cress at the very lip of the spring. “It was here first.”', activity: 'forage', person: 'mina' },
      ],
    },
    // ── The south of Seseragi ──
    {
      id: 'kaede', name: 'Kaede', region: 0, at: { x: 1700, y: 1880 }, habitat: 'meadow', crossing: 'low-stones',
      note: 'The old maple alone on the far bank.',
      teaser: 'An old maple stands alone on the far bank at Kaede.',
      activities: ['explore', 'forage', 'track'],
      rules: [{ when: { seasons: [AUTUMN] }, state: 'special', line: 'The maple has turned scarlet.', odds: 1, reason: 'The maple is at its best', activities: ['explore'] }],
      lines: {
        explore: ['Round the great trunk.', 'Lying in the maple’s shade.', 'Across the open grass.'],
        forage: ['Seed wings in the grass.', 'Mushrooms by the roots.', 'Picking along the hedge.'],
        track: ['A hollow at the maple’s foot.', 'Prints across the grass.', 'Something lives in the trunk.'],
      },
      yields: { forage: 1 },
      learn: [
        { text: 'You reach it over the low stones, when they show.' },
        { text: 'The maple turns before every other tree in the valley.', when: { seasons: [AUTUMN] } },
      ],
    },
    {
      id: 'numata', name: 'Numata', region: 0, at: { x: 420, y: 2470 }, habitat: 'reeds',
      note: 'A still pond fringed with reeds, beside the old road at the valley’s foot.',
      teaser: 'The pond at Numata lies quiet behind its fringe of reeds.',
      activities: ['explore', 'forage', 'fish'],
      rules: [{ when: { levels: ['high'] }, state: 'special', line: 'The pond has risen into the reeds.', odds: -1, reason: 'Water over the banks', activities: ['forage'] }],
      lines: {
        explore: ['Following the pond’s edge.', 'Looking through the reeds.', 'Watching the still water.'],
        forage: ['Cutting good reeds.', 'Picking along the pond’s edge.', 'Kneeling in soft ground.'],
        fish: ['A line in still water.', 'Waiting by the reeds.', 'Small fish in the shallows.'],
      },
      yields: { forage: 1, fish: 1 },
      learn: [
        { text: 'Bitterns boom here on spring evenings.', when: { seasons: [SPRING] } },
        { text: 'When the river rises, the pond spreads into the reeds.', when: { levels: ['high'] } },
      ],
    },
    // ── Mio ──
    {
      id: 'hachiya', name: 'Hachiya', region: 1, at: { x: 290, y: 2950 }, habitat: 'garden',
      note: 'The beekeeper’s hut and hives above the orchard.',
      teaser: 'Bees hum around the hives at Hachiya, above the orchard.',
      activities: ['visit', 'forage', 'explore'],
      rules: [{ when: { seasons: [WINTER] }, state: 'special', line: 'The hives are wrapped for winter.', odds: -1, reason: 'Bees asleep', activities: ['forage'] }],
      lines: {
        visit: ['Talking with the beekeeper.', 'Smoke and slow hands.', 'Honey on bread.'],
        forage: ['Clover by the hives.', 'Picking where the bees work.', 'Careful among the hives.'],
      },
      yields: { visit: 1, forage: 1 },
      learn: [
        { text: 'The bees work Ringozaka’s blossom in spring.', when: { seasons: [SPRING] } },
        { text: 'The beekeeper trades honey for news.', activity: 'visit' },
        { text: 'Ren trades a fish for a jar of honey. The beekeeper says it’s a small fish. Ren says it’s a small jar. They both look very pleased.', person: 'ren' },
        { text: 'The beekeeper says a bee that has drunk its fill flies home as straight as a thread.', activity: 'visit' },
      ],
    },
    {
      id: 'ishigawara', name: 'Ishigawara', region: 1, at: { x: 1110, y: 2930 }, habitat: 'gravel',
      note: 'The stony shallows where the river runs wide.',
      teaser: 'The river runs wide and bright over the stones at Ishigawara.',
      activities: ['fish', 'explore', 'investigate'],
      rules: [{ when: { levels: ['high'] }, state: 'closed', line: 'Under fast water while the river is high.' }],
      lines: {
        fish: ['Casting across the riffles.', 'Wading the shallows.', 'A few steps between casts.'],
        explore: ['Stone to stone.', 'Out to the middle.', 'Bright water all round.'],
        investigate: ['Turning river stones.', 'Looking for shapes.', 'Kneeling in the shallows.'],
      },
      yields: { fish: 1 },
      learn: [
        { text: 'The shallows go under at high water.' },
        { text: 'Dace feed in the riffles.', activity: 'fish' },
        { id: 'bee-line', text: 'Ren watches bees drinking at the edge of the shallows. They don’t go back up to Hachiya. They rise and go off south-west in a line, towards the bamboo.', activity: 'fish', person: 'ren', when: { seasons: [SPRING, SUMMER, AUTUMN] } },
        { id: 'bee-line', text: 'Bees drink at the edge of the shallows, then rise and go off south-west in a line, away from Hachiya, towards the bamboo.', when: { seasons: [SPRING, SUMMER, AUTUMN] } },
      ],
    },
    {
      id: 'makiba', name: 'Makiba', region: 1, at: { x: 200, y: 3300 }, habitat: 'meadow',
      note: 'The hill pasture and its farmhouse, west of Mio.',
      teaser: 'The farmhouse at Makiba looks out over its hill pasture.',
      activities: ['visit', 'forage', 'explore'],
      lines: {
        visit: ['Helping with the sheep.', 'Milk and talk at the farm.', 'Mending a fence together.'],
        forage: ['Mushrooms in the pasture.', 'Picking along the wall.', 'Herbs by the farm track.'],
        explore: ['Up the pasture slope.', 'Along the dry-stone wall.', 'The whole bend below.'],
      },
      yields: { visit: 1, forage: 1 },
      learn: [
        { text: 'The farm keeps sheep on the hill all summer.', activity: 'visit' },
        { text: 'Field mushrooms come up after autumn rain.', when: { seasons: [AUTUMN] } },
        { text: 'The farmer’s girl asks Sora where he’s going. “The sea.” “What’s it like?” Sora thinks about it. “I’ll tell you on the way back.”', person: 'sora' },
      ],
    },
    {
      id: 'tanada', name: 'Tanada', region: 1, at: { x: 510, y: 3470 }, habitat: 'garden',
      note: 'The rice terraces stepping down below Mio.',
      teaser: 'The rice terraces at Tanada step down below Mio, full of sky.',
      activities: ['forage', 'visit', 'fish'],
      rules: [{ when: { seasons: [SPRING] }, state: 'special', line: 'Planting time: every terrace flooded.', odds: 1, reason: 'Everyone out planting', activities: ['visit'] }],
      lines: {
        forage: ['Along the terrace edges.', 'Greens on the banks.', 'Kneeling at the water channel.'],
        visit: ['Helping plant a row.', 'Talking on the terrace wall.', 'Tea at the field hut.'],
        fish: ['Loach in the channels.', 'A line in the flooded field.', 'Waiting by the sluice.'],
      },
      yields: { forage: 1, fish: 1 },
      learn: [
        { text: 'The terraces are flooded for planting in spring.', when: { seasons: [SPRING] } },
        { text: 'Loach live in the water channels.', activity: 'fish' },
        { text: 'An old woman on the terrace wall watches Ren fish the channel. “Loach. My husband swore by them.” “Fried?” “In soup, with ginger.” Ren asks her to say it again, slowly.', activity: 'fish', person: 'ren' },
      ],
    },
    {
      id: 'jizo', name: 'Jizo Shrine', kind: 'minor', region: 1, at: { x: 520, y: 3800 }, habitat: 'shrine',
      note: 'A wayside shrine on the road to the bend.',
      teaser: 'A little Jizo Shrine waits by the road to the bend, with fresh flowers at its feet.',
      activities: ['visit', 'investigate'],
      lines: {
        visit: ['Leaving rice for the travellers.', 'Talking with a passer-by.', 'Sitting in the shade.'],
        investigate: ['Reading the worn stone.', 'Looking at the little offerings.', 'Behind the shrine.'],
      },
      learn: [
        { text: 'Travellers leave something here for the road.', activity: 'visit' },
        { text: 'The stone is older than the village.', activity: 'investigate' },
        { text: 'Sora leaves a flat grey stone from the stream at Yamagoya. He has carried it the whole way without a word.', person: 'sora' },
        { text: 'Mina tucks a sprig of mint in with the flowers. A woman on the road stops to smile. “He’ll like that. Nobody brings him anything green.”', person: 'mina' },
      ],
    },
    {
      id: 'higashida', name: 'Higashida', region: 1, at: { x: 1870, y: 3310 }, habitat: 'village', crossing: 'mio-bridge',
      note: 'The east farm and its fields across the narrows.',
      teaser: 'The east farm at Higashida works its fields across the narrows.',
      activities: ['visit', 'forage', 'investigate'],
      lines: {
        visit: ['Tea at the east farm.', 'Helping at the harvest.', 'Talking over the gate.'],
        forage: ['Gleaning the field edges.', 'Picking by the haystacks.', 'Along the east hedge.'],
        investigate: ['Round the old barn.', 'Looking at the farm tools.', 'The family’s boundary stone.'],
      },
      yields: { visit: 1, forage: 1 },
      learn: [
        { text: 'Only the bridge reaches the east farm.' },
        { text: 'They grow buckwheat on the high field.', activity: 'forage' },
      ],
    },
    {
      id: 'sugawara', name: 'Sugawara', region: 1, at: { x: 925, y: 4100 }, habitat: 'gravel', crossing: 'mio-bridge',
      note: 'The point bar inside the long bend, there only at low water.',
      teaser: 'When the water is low, a point bar shows at Sugawara inside the bend.',
      activities: ['explore', 'forage', 'investigate'],
      rules: [{ when: { levels: ['high', 'middle'] }, state: 'closed', line: 'Under water until the river runs low.' }],
      lines: {
        explore: ['Out along the bar.', 'Wet sand and stones.', 'Driftwood to sit on.'],
        forage: ['Combing the drift line.', 'Kneeling in the sand.', 'Picking along the edge.'],
        investigate: ['Turning over the drift.', 'Prints in wet sand.', 'Something half buried.'],
      },
      yields: { forage: 1 },
      learn: [
        { text: 'The bar only shows at low water.' },
        { text: 'Floods leave strange things on it.', activity: 'investigate' },
      ],
    },
    // ── Kawagiri ──
    {
      id: 'aonuma', name: 'Aonuma', region: 2, at: { x: 340, y: 4720 }, habitat: 'pond',
      note: 'The heron pond in the reedlands.',
      teaser: 'Herons stalk the still pond at Aonuma.',
      activities: ['fish', 'explore'],
      lines: {
        fish: ['Casting from the reeds.', 'Still water, slow line.', 'Herons fishing too.'],
        explore: ['Round the pond, keeping low.', 'Waiting in the reeds.', 'Rings on the water.'],
      },
      yields: { fish: 1 },
      learn: [
        { text: 'The herons fish here at dawn.', activity: 'explore' },
        { text: 'Crucian carp in the warm shallows.', activity: 'fish' },
        { id: 'grey-light', text: 'Night herons sleep in the pines through bright days, and only come down to fish when the light is grey.', activity: 'explore' },
      ],
    },
    {
      id: 'ashikari', name: 'Ashikari', region: 2, at: REED_CAMP, habitat: 'hut',
      note: 'A few reed cutters’ houses round one yard, on the edge of the reedlands.',
      teaser: 'The reed cutters at Ashikari keep a fire going in their yard.',
      activities: ['visit', 'forage', 'explore'],
      rules: [{ when: { seasons: [WINTER] }, state: 'special', line: 'Reed cutting season.', odds: 1, reason: 'The cutters are working', activities: ['visit', 'forage'] }],
      lines: {
        visit: ['Talking with the reed cutters.', 'Bundling reeds together.', 'Tea in the reed hut.'],
        forage: ['Cutting reeds for thatch.', 'Picking along the ditch.', 'Kneeling at the cut ends.'],
      },
      yields: { visit: 1, forage: 1 },
      learn: [
        { text: 'The reeds are cut in winter, when they are dry.', when: { seasons: [WINTER] } },
        { text: 'Every roof in Kawagiri is thatched from here.', activity: 'visit' },
        { text: 'The reed cutters have heard about the boat. “Come past this way when you go,” they tell Sora. “We’ll be on the bank to wave.”', person: 'sora' },
      ],
    },
    {
      id: 'shiokawa', name: 'Shiokawa', kind: 'minor', region: 2, at: { x: 640, y: 5610 }, habitat: 'creek',
      note: 'The head of the salt creek, where the tide stops.',
      teaser: 'At Shiokawa the tide climbs the creek, and stops.',
      activities: ['fish', 'investigate', 'explore'],
      lines: {
        fish: ['Casting where the tide turns.', 'A line in brackish water.', 'Waiting for the flood.'],
        investigate: ['Watching the tide line.', 'Crabs in the mud banks.', 'Reading the drift.'],
      },
      yields: { fish: 1 },
      learn: [
        { text: 'This is as far as the sea comes up.', activity: 'investigate' },
        { text: 'Fish wait here for the tide.', activity: 'fish' },
        { text: 'Ren kneels where the tide stops and tastes the creek. He says nothing for a long while. Then: “Closer.”', person: 'ren' },
      ],
    },
    {
      id: 'todai', name: 'Todai Lighthouse', kind: 'minor', region: 2, at: LIGHTHOUSE, habitat: 'estuary',
      note: 'The harbour light at the river mouth.',
      teaser: 'Todai Lighthouse burns warmly above the river mouth.',
      activities: ['visit', 'explore'],
      lines: {
        visit: ['Talking with the lamp keeper.', 'Trimming the wick together.', 'Tea at the top of the steps.'],
        explore: ['Round the lamp house.', 'Out along the jetty.', 'The sea on three sides.'],
      },
      yields: { visit: 1 },
      learn: [
        { text: 'The keeper lights the lamp every dusk.', activity: 'visit' },
        { text: 'From the steps you can see the whole mouth.', activity: 'explore' },
        { text: 'Yui and the lamp keeper trade stories at the top of the steps. He has lit the way out for twenty years and never once taken it. “Then I’ll bring you one back,” Yui says.', person: 'yui' },
      ],
    },
    // ── Added 20 Nov: one more on each bank of each reach ──
    {
      id: 'shimizu', name: 'Shimizu', region: 0, at: { x: 1990, y: 650 }, habitat: 'tarn', crossing: 'high-stones',
      note: 'A spring under the eastern ridge, where the meadow water starts.',
      teaser: 'A cold spring rises under the ridge at Shimizu.',
      activities: ['explore', 'forage', 'investigate'],
      rules: [{ when: { seasons: [WINTER] }, state: 'closed', line: 'Frozen and snowbound.' }],
      lines: {
        explore: ['Up the spring’s little stream.', 'Cold air off the water.', 'The ridge close above.'],
        forage: ['Watercress at the spring’s edge.', 'Kneeling on wet stones.', 'Picking along the runnel.'],
        investigate: ['A ladle left by the spring.', 'Moss on the old stones.', 'Looking into the clear pool.'],
      },
      yields: { forage: 1 },
      learn: [
        { text: 'The spring stays open until deep winter.' },
        { text: 'Someone keeps a ladle here for travellers.', activity: 'investigate' },
      ],
    },
    {
      id: 'kikori', name: 'Kikori', region: 0, at: { x: 250, y: 1260 }, habitat: 'woodland',
      note: 'The woodcutters’ clearing between Kamimori and the orchard.',
      teaser: 'Axes ring in the woodcutters’ clearing at Kikori.',
      activities: ['visit', 'forage', 'investigate'],
      rules: [{ when: { seasons: [WINTER] }, state: 'special', line: 'Felling season: the cutters are in.', odds: 1, reason: 'The woodcutters are working', activities: ['visit', 'forage'] }],
      lines: {
        visit: ['Tea by the woodpile.', 'Helping stack the cut logs.', 'Listening to the axes.'],
        forage: ['Dry offcuts for the fire.', 'Kindling from the chips.', 'Gathering fallen branches.'],
        investigate: ['The marks on the felled trunks.', 'An old saw on a peg.', 'Counting rings in a stump.'],
      },
      yields: { visit: 1, forage: 1 },
      learn: [
        { text: 'The woodcutters work through the winter.', when: { seasons: [WINTER] } },
        { text: 'Offcuts make good materials.', activity: 'forage' },
      ],
    },
    {
      id: 'chabatake', name: 'Chabatake', region: 1, at: { x: 2300, y: 3640 }, habitat: 'garden', crossing: 'mio-bridge',
      note: 'Tea bushes in clipped rows on the slope above the east farm.',
      teaser: 'Rows of tea bushes climb the slope at Chabatake.',
      activities: ['visit', 'forage', 'explore'],
      rules: [{ when: { seasons: [SPRING] }, state: 'special', line: 'First picking: the new leaves are in.', odds: 1, reason: 'The first tea leaves', activities: ['visit', 'forage'] }],
      lines: {
        visit: ['Picking with the farm family.', 'Tea from this year’s leaves.', 'Talking along the rows.'],
        forage: ['Pinching the new tips.', 'A basket on the hip.', 'Between the clipped rows.'],
        explore: ['Up through the rows.', 'The whole bend of the river below.', 'Along the top hedge.'],
      },
      yields: { visit: 1, forage: 1 },
      learn: [
        { text: 'The first leaves are picked in spring.', when: { seasons: [SPRING] } },
        { text: 'The east farm dries its tea in the barn.', activity: 'visit' },
      ],
    },
    {
      id: 'takebayashi', name: 'Takebayashi', region: 1, at: { x: 110, y: 4300 }, habitat: 'woodland',
      note: 'A bamboo grove on the western edge, creaking in the wind.',
      teaser: 'The bamboo at Takebayashi creaks in the wind.',
      activities: ['explore', 'forage', 'investigate'],
      rules: [{ when: { seasons: [SPRING] }, state: 'special', line: 'Bamboo shoots are pushing up.', odds: 1, reason: 'Shoots for the pot', activities: ['forage'] }],
      lines: {
        explore: ['Green light between the stems.', 'The grove creaking overhead.', 'A path worn through the culms.'],
        forage: ['Cutting good canes.', 'Digging for young shoots.', 'Bundling poles to carry.'],
        investigate: ['Names cut into the bamboo.', 'An old water pipe of split cane.', 'Listening to the wind in it.'],
      },
      yields: { forage: 1 },
      learn: [
        { text: 'Young shoots come up in spring.', when: { seasons: [SPRING] } },
        { text: 'Cane makes light, strong materials.', activity: 'forage' },
      ],
    },
    {
      id: 'shiodamari', name: 'Shiodamari', region: 2, at: { x: 2620, y: 5390 }, habitat: 'rockpools',
      note: 'Tide pools in the rocks past the coastal pines.',
      teaser: 'The rock pools at Shiodamari fill and empty with the tide.',
      activities: ['investigate', 'forage', 'fish'],
      rules: [{ when: { levels: ['high'] }, state: 'special', line: 'The tide is over most of the pools.', odds: -1, reason: 'The pools are under the tide', activities: ['investigate', 'forage'] }],
      lines: {
        investigate: ['Lying flat over a pool.', 'Anemones closing at a touch.', 'Turning a stone, and back.'],
        forage: ['Picking along the rocks.', 'Seaweed in a basket.', 'Careful on the wet stones.'],
        fish: ['A line into the deep pool.', 'Waiting on the rocks.', 'Small fish in the weed.'],
      },
      yields: { forage: 1, fish: 1 },
      learn: [
        { text: 'The pools are best when the water is low.', when: { levels: ['low'] } },
        { text: 'Little crabs hide under every stone.', activity: 'investigate' },
      ],
    },
    {
      id: 'amiya', name: 'Amiya', region: 2, at: { x: 230, y: 5320 }, habitat: 'hut',
      note: 'A fishermen’s net hut out on the salt flats.',
      teaser: 'Nets hang drying by the hut at Amiya, out on the flats.',
      activities: ['visit', 'fish', 'forage'],
      lines: {
        visit: ['Mending nets with the fishermen.', 'Tea on an upturned box.', 'Stories about the big catch.'],
        fish: ['Out with the small net.', 'Wading on the flats.', 'Sorting the catch.'],
        forage: ['Picking along the flats.', 'Samphire in a basket.', 'Shells in the mud.'],
      },
      yields: { visit: 1, fish: 1 },
      learn: [
        { text: 'The fishermen go out on the falling tide.' },
        { text: 'They trade fish for news from upriver.', activity: 'visit' },
        { text: 'The fishermen ask Ren how far he has come. He tells them. “All that way for salt?” “And fish,” says Ren. “Mostly salt.”', person: 'ren' },
      ],
    },
  ],

  finds: [
    { id: 'squirrel-cones', name: 'Stripped cones', category: 'curiosities', region: 0, at: ['matsuyama'], activities: ['track', 'forage'], text: 'Pine cones stripped to the core in neat spirals. A squirrel’s table, on a high stump.', tag: 'A pile of stripped cones.', hint: 'Under the pines at Matsuyama.' },
    { id: 'nutcracker', name: 'Spotted nutcracker', category: 'birds', region: 0, at: ['matsuyama'], activities: ['explore'], when: { seasons: [SUMMER, AUTUMN] }, text: 'Brown, speckled white, and loud. It buries pine seeds and remembers where.', tag: 'A loud speckled bird.', hint: 'In the high pines, in summer and autumn.' },
    { id: 'burner', name: 'The charcoal burner', category: 'encounters', region: 0, at: ['sumiyaki'], activities: ['visit'], story: { reason: 'The charcoal burner is glad to see a traveller' }, reward: { materials: 1 }, text: 'He has watched the kiln for thirty winters and knows every path on the mountain. He remembers a boy from Yamagoya who asked where the smoke went. “Down the valley,” he told him. “Same as everything.” He sends us home with split pine.', tag: 'A long talk by the kiln.', hint: 'Someone keeps a kiln in the western pines.' },
    { id: 'kiln-shard', name: 'An old kiln shard', category: 'keepsakes', region: 0, rare: true, at: ['sumiyaki'], activities: ['investigate'], text: 'A piece of glazed pot from a kiln much older than the burner’s. Someone made fine things up here once.', tag: 'A glazed fragment in the ash.', hint: 'In the ash of the old kiln at Sumiyaki.' },
    { id: 'first-water', name: 'The first water', category: 'curiosities', region: 0, at: ['izumi'], activities: ['explore', 'investigate'], story: { reason: 'The river has to begin somewhere up here' }, text: 'The river begins here, cold enough to ache, out of a crack in the rock no wider than a hand. All of it is on its way to the sea.', tag: 'Cold water out of the rock.', hint: 'At the high spring, Izumi.' },
    { id: 'ptarmigan', name: 'Rock ptarmigan', category: 'birds', region: 0, rare: true, at: ['matsuyama', 'izumi'], activities: ['explore', 'track'], when: { seasons: [AUTUMN, WINTER] }, text: 'Turning white for the snow, and so sure of it that it walked between our boots. The burner calls it the thunder bird.', tag: 'Something white that walked away.', hint: 'High on the mountain, once the cold comes.' },
    { id: 'alpine-cress', name: 'Mountain cress', category: 'plants', region: 0, at: ['izumi', 'shimizu'], activities: ['forage'], when: { seasons: [SPRING, SUMMER] }, text: 'Tiny and peppery, growing only where the spring water keeps the rock wet.', tag: 'A pinch of green from the spring.', hint: 'At the spring’s lip, in the warm months.' },
    { id: 'maple-leaf', name: 'The first red leaf', category: 'plants', region: 0, at: ['kaede'], activities: ['explore', 'forage'], when: { seasons: [AUTUMN] }, text: 'The old maple turns first. One leaf pressed flat in the journal.', tag: 'A scarlet leaf.', hint: 'Under the old maple, in autumn.' },
    { id: 'scops-owl', name: 'Scops owl', category: 'birds', region: 0, at: ['kaede'], activities: ['track', 'explore'], text: 'No bigger than a hand, asleep in the maple’s hollow with its ear tufts up.', tag: 'Two ear tufts in a hollow.', hint: 'In the old maple’s hollow.' },
    { id: 'bittern', name: 'Bittern', category: 'birds', region: 0, at: ['numata'], activities: ['explore'], when: { seasons: [SPRING, SUMMER] }, text: 'Heard across the marsh like someone blowing over a bottle. Seen once, pretending to be a reed.', tag: 'A deep boom from the reeds.', hint: 'In the Numata reeds, on a spring evening.' },
    { id: 'marsh-marigold', name: 'Marsh marigold', category: 'plants', region: 0, at: ['numata'], activities: ['forage'], when: { seasons: [SPRING] }, text: 'Bright yellow cups along the ditches, the first colour of the year down here.', tag: 'Yellow cups in the basket.', hint: 'Along the marsh ditches, in spring.' },
    { id: 'honeycomb', name: 'A piece of honeycomb', category: 'plants', region: 1, at: ['hachiya', 'chabatake'], activities: ['visit'], when: { seasons: [SUMMER, AUTUMN] }, text: 'Given at the hives, wrapped in a leaf. It tasted of every flower in Ringozaka.', tag: 'Something sticky, wrapped in a leaf.', hint: 'From the beekeeper, after the blossom.' },
    { id: 'beekeeper', name: 'The beekeeper', category: 'encounters', region: 1, at: ['hachiya'], activities: ['visit'], text: 'She talks to the bees every morning, she says, and tells them the news.', tag: 'A slow talk among the hives.', hint: 'Someone keeps bees above the orchard.' },
    { id: 'dace', name: 'Dace', category: 'fish', region: 1, at: ['ishigawara'], activities: ['fish'], text: 'Quick and silver, flicking up the riffles in shoals.', tag: 'Quick silver fish.', hint: 'In the riffles at Ishigawara.' },
    { id: 'striped-stone', name: 'A striped stone', category: 'curiosities', region: 1, at: ['ishigawara'], activities: ['investigate', 'explore'], when: { levels: ['low'] }, text: 'Black and white in perfect bands, rolled smooth by a long way of river.', tag: 'A banded stone.', hint: 'In the shallows, at low water.' },
    { id: 'sheep-pose', name: 'A particularly handsome sheep', category: 'wildlife', region: 1, at: ['makiba'], activities: ['visit', 'explore'], text: 'A sheep striking a particularly handsome pose. One foot up, head on one side. It held still just long enough for a sketch, then went back to its grass.', tag: 'A particularly handsome pose.', hint: 'On the hillside at Makiba.', sighting: { near: [{ x: 290, y: 3340 }], line: 'A sheep striking a particularly handsome pose' } },
    { id: 'shepherd', name: 'The shepherd', category: 'encounters', region: 1, at: ['makiba'], activities: ['visit'], text: 'He counts his sheep twice a day and has never once got the same number.', tag: 'Laughing at the farm gate.', hint: 'Someone keeps sheep on the hill pasture.' },
    { id: 'field-mushrooms', name: 'Field mushrooms', category: 'plants', region: 1, at: ['makiba', 'miyamori', 'takebayashi'], activities: ['forage'], when: { seasons: [AUTUMN] }, text: 'White caps in the short grass after rain, gone by noon if you are slow.', tag: 'White caps in the basket.', hint: 'On the pasture, after autumn rain.' },
    { id: 'loach', name: 'Loach', category: 'fish', region: 1, at: ['tanada'], activities: ['fish'], text: 'Whiskered little fish in the terrace channels. The children catch them by hand.', tag: 'Whiskers in the net.', hint: 'In the water channels at Tanada.' },
    { id: 'rice-frogs', name: 'Tree frogs on the terraces', category: 'wildlife', region: 1, at: ['tanada'], activities: ['forage', 'visit'], when: { seasons: [SPRING, SUMMER] }, text: 'Bright green and no bigger than a thumbnail, singing from every terrace wall.', tag: 'Green and small, on a leaf.', hint: 'On the terraces in the warm months.' },
    { id: 'road-offering', name: 'An offering for the road', category: 'keepsakes', region: 1, at: ['jizo'], activities: ['visit', 'investigate'], text: 'A small carved stone left at the shrine by someone going south. We left one too.', tag: 'A small carved stone.', hint: 'At the wayside shrine.' },
    { id: 'buckwheat', name: 'Buckwheat flowers', category: 'plants', region: 1, at: ['higashida'], activities: ['forage', 'visit'], when: { seasons: [SUMMER, AUTUMN] }, text: 'A white haze over the east farm’s high field, humming with bees.', tag: 'White flowers, humming.', hint: 'At the east farm, in summer.' },
    { id: 'farm-cat', name: 'The farm cat', category: 'wildlife', region: 1, at: ['higashida'], activities: ['visit', 'investigate'], text: 'Orange, enormous, and in charge of the barn. It followed us to the bridge.', tag: 'Orange fur on the gatepost.', hint: 'Around the east farm’s barn.' },
    { id: 'flood-treasure', name: 'A carved spoon', category: 'keepsakes', region: 1, rare: true, at: ['sugawara'], activities: ['investigate', 'forage'], when: { levels: ['low'] }, knowing: { clues: ['flood-wrack', 'flood-drift'], line: '{name} brushes the sand off it. “Washed down from the willows at Yanagi, like everything the flood took.”' }, text: 'A wooden spoon with a fish carved on the handle, washed down from somewhere upriver.', tag: 'Something carved in the drift.', hint: 'On the point bar, at low water.' },
    { id: 'sandpiper', name: 'Common sandpiper', category: 'birds', region: 1, at: ['sugawara'], activities: ['explore'], when: { seasons: [SPRING, SUMMER, AUTUMN] }, text: 'It bobs its tail and flies off low over the water, calling all the way.', tag: 'A bobbing bird on the sand.', hint: 'On the point bar, in the warm months.' },
    { id: 'pond-carp', name: 'Crucian carp', category: 'fish', region: 2, at: ['aonuma'], activities: ['fish'], text: 'Golden-bronze and lazy, in the warm shallows of the heron pond.', tag: 'Bronze scales on the line.', hint: 'In the heron pond.' },
    { id: 'mist-herons', name: 'Night herons in the grey', category: 'birds', region: 2, rare: true, at: ['aonuma'], activities: ['explore', 'fish'], when: { weather: ['mist', 'rain'] }, knowing: { clues: ['grey-light', 'night-heron'], line: '“Grey enough for them,” {name} whispers. “They think it’s evening.”' }, text: 'At midday, in the grey, a dozen night herons stood round the pond like old men fishing, and took no notice of us at all.', tag: 'Grey shapes round the pond.', hint: 'When the pond is as dim as dusk.' },
    { id: 'wild-hive', name: 'A wild hive', category: 'wildlife', region: 1, rare: true, at: ['takebayashi'], activities: ['explore', 'investigate'], when: { seasons: [SPRING, SUMMER, AUTUMN] }, reward: { provisions: 1 }, knowing: { clues: ['bee-line'], line: '“Straight from the shallows,” {name} says. “The bees knew the way all along.”' }, text: 'An old cedar at the edge of the bamboo, hollow and humming. Wild bees come and go from a split in its bark, and a little comb has spilled out below.', tag: 'Humming in an old tree.', hint: 'Somewhere the bees go home to.' },
    { id: 'night-heron', name: 'Night heron', category: 'birds', region: 2, at: ['aonuma'], activities: ['explore'], text: 'Hunched and red-eyed on a low branch, asleep until the light goes grey.', tag: 'A hunched grey shape.', hint: 'At the heron pond, if you stay still.' },
    { id: 'reed-cutters', name: 'The reed cutters', category: 'encounters', region: 2, at: ['ashikari'], activities: ['visit'], text: 'Three sisters who have cut the reeds together for forty winters and still argue about the best bed.', tag: 'Laughing in the reed hut.', hint: 'At the reed cutters’ hut.' },
    { id: 'reed-whistle', name: 'A reed whistle', category: 'keepsakes', region: 2, at: ['ashikari'], activities: ['visit', 'forage'], text: 'Cut and given to us by the sisters. It plays two notes, one sad and one not.', tag: 'A whistle cut from a reed.', hint: 'Ask the reed cutters.' },
    { id: 'tide-crabs', name: 'Mud crabs', category: 'wildlife', region: 2, at: ['shiokawa'], activities: ['investigate', 'fish'], text: 'A whole bank of them, waving one big claw each at the tide.', tag: 'Claws waving on the mud.', hint: 'At the head of the salt creek.' },
    { id: 'sea-bream', name: 'Sea bream', category: 'fish', region: 2, at: ['shiokawa', 'fish-traps'], activities: ['fish'], when: { levels: ['middle', 'high'] }, text: 'Pink and silver, come up the creek on the tide. The first sea fish of the journey.', tag: 'Something pink from salt water.', hint: 'In the salt creek, when the tide is in.' },
    { id: 'lamp-keeper', name: 'The lamp keeper', category: 'encounters', region: 2, at: ['todai'], activities: ['visit'], text: 'He has lit the harbour lamp every dusk for twenty years. He has never been to sea.', tag: 'Tea at the top of the steps.', hint: 'Someone keeps the harbour light.' },
    { id: 'gulls', name: 'Black-tailed gulls', category: 'birds', region: 2, at: ['todai'], activities: ['explore'], text: 'They sound like cats, and stand on the lamp house roof in a row.', tag: 'Mewing from the roof.', hint: 'Round the harbour light.' },
  ],

  leads: [
    // The mountain: optional ways on, noticed only up there, so they never crowd the road south.
    {
      id: 'to-izumi', from: ['taki', 'matsuyama'], when: {},
      to: 'izumi', find: 'first-water', holds: {},
      line: 'Above Taki the stream keeps getting smaller. Somewhere up at Izumi, the river begins.',
    },
    {
      id: 'to-sumiyaki', from: ['yamagoya', 'kagami'], when: {},
      to: 'sumiyaki', find: 'burner', holds: {},
      line: 'Smoke over the western pines: someone keeps a kiln at Sumiyaki, and probably a kettle.',
    },
    {
      id: 'tarn-ice', from: ['kagami', 'matsuyama'], when: { seasons: [AUTUMN] },
      to: 'kagami', find: 'singing-ice', holds: { seasons: [WINTER] },
      line: 'When winter comes, Kagami-numa freezes hard enough to walk on.',
    },
    {
      id: 'thunder-bird', from: ['sumiyaki'], when: {},
      to: 'matsuyama', find: 'ptarmigan', holds: { seasons: [AUTUMN, WINTER] },
      line: 'After the first cold, the burner says, a white bird walks on Matsuyama.',
    },
  ],
};

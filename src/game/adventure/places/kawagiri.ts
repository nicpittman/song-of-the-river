/**
 * Kawagiri, the open estuary: reedlands, a last little landing, and the sea.
 * Yui keeps stories and a sail here. Grandfather’s boat needs her plans (left
 * at the Mio mill, or the boatyard moulds he learned on), a dock, one sail
 * (Yui’s, which he left with her mother and never came back for, or the one in the boatyard loft) and a reading of the tide (at the
 * river mouth, or in Yui’s song).
 *
 * The beach at Shirahama is best at low water and after rain.
 */

import { COAST_CAMP, COAST_BRIDGE, BOATYARD, COAST_MOUTH, COAST_PINES, FISH_TRAPS, STILT_HOUSES, FAR_SHORE } from '../../world/boards/kawagiriSites';
import type { RegionContent } from '../catalogue';

const SPRING = 0;
const SUMMER = 1;
const AUTUMN = 2;
const WINTER = 3;

export const KAWAGIRI: RegionContent = {
  places: [
    {
      id: 'shiobashi', name: 'Shiobashi Bridge', region: 2, at: { x: 1430, y: COAST_BRIDGE.y }, marker: COAST_BRIDGE, habitat: 'riverbank',
      note: 'A little stone bridge above the estuary. Beyond it, a dry path follows the eastern bank to Kawagiri.',
      teaser: 'Shiobashi Bridge crosses the river before it branches into the reeds.',
      activities: ['explore', 'fish', 'investigate'],
      lines: { explore: ['Across the old stone bridge.', 'Village smoke beyond the eastern dunes.'], fish: ['A line below the bridge.'], investigate: ['The worn stones are firm underfoot.'] },
      learn: [{ text: 'The bridge stands above the highest tide.' }, { text: 'The eastern path goes round the creek heads, then down to the sea.', activity: 'explore' }, { text: 'Mina finds a little pink flower in the cracks of the old bridge. “Thrift. It only grows near the sea.” She says it again, quieter.', person: 'mina' }],
    },
    {
      id: 'east-marsh', name: 'East marsh', region: 2, at: { x: 1800, y: 5300 }, habitat: 'saltmarsh', crossing: 'estuary-bridge',
      note: 'The far-bank reed beds. A raised path stays dry beside the tidal pools.',
      teaser: 'A raised path stays dry through the reeds of the East marsh.',
      activities: ['forage', 'track', 'explore'],
      rules: [{ when: { levels: ['high'] }, state: 'special', line: 'High water fills the pools. Gather reeds along the raised path.', odds: -1, reason: 'Keep to the raised path', activities: ['forage'] }],
      lines: { forage: ['Cutting strong reeds for thatch.'], track: ['Heron prints beside a tidal pool.'], explore: ['Following the raised path toward the far shore.'] },
      learn: [
        { text: 'Shiobashi Bridge, the old stone crossing upstream, stays open in every season.' },
        { text: 'The ridge path leads to a quiet beach on the eastern shore.', activity: 'explore', hearsOf: ['far-shore'] },
      ],
    },
    {
      id: 'far-shore', name: 'Far shore', region: 2, at: FAR_SHORE, habitat: 'beach', crossing: 'estuary-bridge',
      note: 'A quiet beach beyond the eastern dunes. Gather driftwood or look for shells.',
      teaser: 'Past the dunes, the Far shore is quiet but for gulls and driftwood.',
      activities: ['forage', 'investigate', 'explore'],
      lines: { forage: ['Driftwood along the high-water line.'], investigate: ['Small shells between the pebbles.'], explore: ['The whole estuary, seen from the other shore.'] },
      learn: [
        { text: 'The tide leaves driftwood along the dunes.', activity: 'forage' },
        { text: 'Todai Lighthouse is back along the dunes, towards the river mouth.', activity: 'explore' },
      ],
    },
    {
      id: 'fish-traps', name: 'Fish traps', region: 2,
      at: FISH_TRAPS, habitat: 'riverbank',
      note: 'Woven traps in the current. Fish from the bank or inspect the willow frames.',
      teaser: 'Woven traps sit in the current at the Fish traps, and someone mends them.',
      activities: ['fish', 'investigate', 'explore'],
      lines: { fish: ['Checking the woven traps.', 'Lifting a trap from the current.'], investigate: ['Repairing a willow frame.', 'Checking the trap openings.'] },
      yields: { fish: 2 },
      learn: [
        { text: 'The traps catch fish in every season. Ren knows where to set them.', activity: 'fish' },
        { text: 'Flexible willow makes a strong trap frame.', activity: 'investigate' },
        { text: 'Aki turns an old trap over in his hands. “Willow, and not a nail in it. I couldn’t do better.” He spends the afternoon trying anyway.', activity: 'investigate', person: 'aki' },
      ],
    },

    {
      id: 'shirasagi', name: 'Shirasagi', region: 2, at: { x: 460, y: 4740 }, habitat: 'reeds',
      note: 'The white-heron reedlands, where the banks flatten.',
      teaser: 'White herons stand in the reeds at Shirasagi, where the banks flatten.',
      activities: ['explore', 'forage', 'investigate', 'track'],
      rules: [
        { when: { seasons: [AUTUMN] }, state: 'special', line: 'The sky is full of birds arriving.', odds: 1, reason: 'Autumn arrivals', activities: ['explore'] },
      ],
      lines: {
        track: ['Long prints in the soft mud.', 'A trail into the reeds.', 'Watching from a dyke, very still.'],
        explore: ['Along a dyke through the reeds.', 'Herons lifting ahead.', 'Out to the open water.'],
        forage: ['Cutting reeds for the roof.', 'Picking along a ditch.', 'Kneeling in soft mud.'],
        investigate: ['An old eel trap.', 'Footprints of a heron.', 'Parting the reeds.'],
      },
      yields: { forage: 1 },
      learn: [
        { text: 'The herons walk the same ditch every morning.', activity: 'track' },
        { text: 'White herons nest here in summer.', when: { seasons: [SPRING, SUMMER] } },
        { text: 'In autumn the sky fills with birds coming in.', when: { seasons: [AUTUMN] } },
        { text: 'Yui keeps so still in the reeds that a heron walks right past her boots. “Nobody will believe that one,” she whispers.', person: 'yui' },
      ],
    },
    {
      id: 'kawagiri', name: 'Kawagiri', kind: 'settlement', region: 2, at: COAST_CAMP, habitat: 'village',
      note: 'A fishing village on the eastern shore, with a boatyard and a light above the sea.',
      teaser: 'Kawagiri smells of smoke and nets, and the sea is very close.',
      activities: ['visit'],
      lines: { visit: ['Tea by the village fire.', 'Asking about the river downstream.', 'Sharing news with the villagers.'] },
      yields: { visit: 1 },
      learn: [{ text: 'The village fire is lit among the drying racks.' }, { text: 'Someone in the stilt houses by the landing keeps the old stories.', when: { journey: true } }],
    },
    {
      id: 'takayuka', name: 'Takayuka', region: 2, at: STILT_HOUSES, habitat: 'village',
      note: 'The stilt houses by the landing, where someone keeps the old stories.',
      teaser: 'In the stilt houses at Takayuka, someone keeps the stories of the river.',
      activities: ['visit', 'investigate', 'fish', 'explore'],
      rules: [
        { when: { weather: ['rain', 'snow'] }, state: 'special', line: 'Everyone mending nets indoors.', odds: 1, reason: 'Everyone is in today', activities: ['visit'] },
      ],
      lines: {
        visit: ['Tea with the net menders.', 'Listening to old stories.', 'Helping carry the catch.'],
        investigate: ['Down along the landing.', 'Looking at the old boats.', 'Reading the tide marks.'],
        fish: ['Casting off the landing.', 'A line in brackish water.', 'Waiting with the old men.'],
      },
      yields: { visit: 1, fish: 1 },
      learn: [
        { text: 'A story keeper called Yui lives here.', activity: 'visit', when: { journey: true } },
        { text: 'The old landing is only posts now. Nothing bigger than a punt can tie up.', activity: 'fish' },
        { text: 'Yui watches the river go out from the landing steps. There is nowhere here for a boat to wait.', activity: 'visit', when: { journey: true } },
        { text: 'The net menders swap stories with Yui until the tea goes cold. She owes them two, they say.', activity: 'visit', person: 'yui' },
        { text: 'The landing water is brackish: half river, half sea.', activity: 'fish' },
      ],
    },
    {
      id: 'funaya', name: 'Funaya Boatyard', region: 2, at: BOATYARD, habitat: 'boatyard',
      note: 'A boatyard on the eastern shore. An old boatbuilder tends the hulls and keeps the boat moulds.',
      teaser: 'Funaya Boatyard still smells of tar.',
      activities: ['investigate', 'explore', 'visit'],
      rules: [
        { when: { levels: ['high'] }, state: 'special', line: 'Water over the slipway.', odds: -1, reason: 'The slipway is under', activities: ['investigate', 'explore'] },
      ],
      lines: {
        investigate: ['In the boat shed’s gloom.', 'Wooden moulds on the wall.', 'Up into the loft.'],
        explore: ['Round the old slipway.', 'Among the upturned hulls.', 'Along the rotten jetty.'],
        visit: ['Talking with the old boatbuilder.', 'Tea among the shavings.', 'Hearing about the last boat.'],
      },
      yields: { investigate: 1 },
      learn: [
        { text: 'The old boatbuilder still comes down to look at the moulds.', activity: 'visit' },
        { text: 'The boat moulds are still on the wall.', activity: 'investigate' },
        { text: 'The slipway goes under at high water.', when: { levels: ['high'] } },
        { text: 'Aki goes over the moulds on the wall with his thumb. “Same lines as Grandfather’s. He only made her smaller, for the river.”', person: 'aki' },
        { text: 'Sora shows the old boatbuilder a plank he planed for the boat. “Long strokes. With the grain.” He tries again. “That’s it. Smooth as an egg.”', person: 'sora', when: { structure: 'dock' } },
        { text: 'Ren asks the old boatbuilder what swims out past the bar. “Big ones,” he says. “Bring a bigger pot.”', person: 'ren', when: { structure: 'dock' } },
        { text: 'Mina asks the old boatbuilder what grows on the far shores. “Pines, if you’re lucky. Take seeds if you want a garden.” Mina pats her seed bag.', person: 'mina', when: { structure: 'dock' } },
        { text: 'The old boatbuilder tells Yui about a first boat that sank right off the slipway. “Don’t you put that in a story.” Yui already has.', person: 'yui' },
      ],
    },
    {
      id: 'hosokawa', name: 'Hosokawa', kind: 'minor', region: 2, at: { x: 780, y: 4880 }, habitat: 'creek',
      note: 'A narrow creek winding through the reeds.',
      teaser: 'A narrow creek winds away through the reeds at Hosokawa.',
      activities: ['fish', 'explore'],
      rules: [
        { when: { levels: ['middle'] }, state: 'special', line: 'Mullet coming up on the tide.', odds: 1, reason: 'Mullet up the creek', activities: ['fish'] },
      ],
      lines: {
        fish: ['Casting where the creek bends.', 'Mullet jumping ahead.', 'A slow line on the tide.'],
        explore: ['Along the creek bank.', 'A cormorant drying its wings.', 'Through the tall reeds.'],
      },
      yields: { fish: 1 },
      learn: [
        { text: 'The creek fills and empties with the tide twice a day.' },
        { text: 'Mullet come up the creek on the tide.', activity: 'fish' },
        { text: 'Cormorants dry their wings on the posts.', activity: 'explore' },
        { text: 'Aki watches the cormorants drying their wings on the posts. “They’ve got it worked out. Fish all morning, sit all afternoon.”', person: 'aki' },
      ],
    },
    {
      id: 'matsubara', name: 'Matsubara', region: 2, at: COAST_PINES, habitat: 'pines',
      note: 'A camp among the coastal pines: a tarp, a kettle, and tracks drawn in the sand.',
      teaser: 'Smoke rises from a camp among the coastal pines at Matsubara.',
      activities: ['forage', 'explore', 'track'],
      rules: [
        { when: { seasons: [AUTUMN] }, state: 'special', line: 'Mushrooms under the pines.', odds: 1, reason: 'Pine mushroom season', activities: ['forage'] },
      ],
      lines: {
        track: ['Tracks in the sandy rise.', 'A feather in the needles.', 'Following a line of prints.'],
        forage: ['Kneeling in the pine needles.', 'Gathering cones.', 'Looking under the low branches.'],
        explore: ['Through the bent pines.', 'Sea wind in the branches.', 'Up onto the sandy rise.'],
      },
      yields: { forage: 1 },
      learn: [
        { text: 'Pheasants roost in the low pines.', activity: 'track' },
        { text: 'The pines all lean away from the sea.', activity: 'explore' },
        { text: 'Pine mushrooms come up in autumn.', when: { seasons: [AUTUMN] } },
        { text: 'Aki knocks on a pine trunk and listens. “There’s a good mast in that one.” He looks up at it a while, then leaves it standing.', person: 'aki' },
        { text: 'Ren fills his pockets with pine needles. “For smoking fish.” Mina says they make good tea. They agree to try both.', person: 'ren' },
      ],
    },
    {
      id: 'shiohara', name: 'Shiohara', region: 2, at: { x: 540, y: 5530 }, habitat: 'saltmarsh',
      note: 'The tide garden, where salt flowers grow.',
      teaser: 'Salt flowers bloom in the tide garden at Shiohara.',
      activities: ['forage', 'investigate', 'fish', 'explore'],
      rules: [
        { when: { levels: ['high'] }, state: 'special', line: 'Mostly under water.', odds: -1, reason: 'Covered by high water', activities: ['forage', 'investigate'] },
      ],
      lines: {
        forage: ['Picking salt greens.', 'Kneeling in the pools.', 'Along the muddy edge.'],
        investigate: ['Watching the little pools.', 'Something skipping on the mud.', 'Reading the drift line.'],
        fish: ['Casting into a channel.', 'Waiting for the turn.', 'A line in the brackish pool.'],
      },
      yields: { forage: 1 },
      learn: [
        { text: 'Salt flowers open in summer and keep on into autumn.', activity: 'forage' },
        { text: 'The garden is mostly under at high water.', when: { levels: ['high'] } },
        { text: 'Mudskippers come out on the low mud.', activity: 'investigate' },
        { text: 'Mina nibbles a salt-flower leaf and pulls a face. “Seeds, then. Not supper.”', person: 'mina' },
      ],
    },
    {
      id: 'iso', name: 'Iso', region: 2, at: { x: 120, y: 5985 }, habitat: 'rockpools',
      note: 'The rocky point: dark rocks and pools at the edge of the sea.',
      teaser: 'The rock pools at Iso fill and empty with the sea.',
      activities: ['investigate', 'forage', 'fish'],
      rules: [
        { when: { levels: ['high'] }, state: 'closed', line: 'The pools are under the sea.' },
        { when: { levels: ['low'] }, state: 'special', line: 'Every pool is open at low water.', odds: 1, reason: 'Low water opens the pools', activities: ['investigate', 'forage'] },
      ],
      lines: {
        investigate: ['Peering into a rock pool.', 'Lifting a weedy stone.', 'Tide marks on the rock.'],
        forage: ['Seaweed into the basket.', 'Kneeling at a pool.', 'Along the wet ledges.'],
        fish: ['Casting off the point.', 'Waves on the rocks.', 'A line into deep water.'],
      },
      yields: { forage: 1, fish: 1 },
      learn: [
        { text: 'Starfish and crabs hide under the weed at low water.', activity: 'forage' },
        { text: 'The pools are only open when the water is low.' },
        { text: 'The rocks carry marks of every tide.', activity: 'investigate' },
        { text: 'Yui sits by a rock pool until the crabs forget she’s there. She names the smallest one. Nobody is allowed to say it’s just a crab.', person: 'yui' },
      ],
    },
    {
      id: 'shirahama', name: 'Shirahama', region: 2, at: { x: 400, y: 5975 }, habitat: 'beach',
      note: 'The white beach on the west side of the river mouth.',
      teaser: 'The sand at Shirahama is white as rice.',
      activities: ['forage', 'explore', 'investigate'],
      rules: [
        { when: { levels: ['high'] }, state: 'special', line: 'The water is in. Only the top of the beach.', odds: -1, reason: 'Little beach showing' },
        { when: { levels: ['low'] }, state: 'special', line: 'The sands run far out at low water.', odds: 1, reason: 'Low water shows the best of it', activities: ['forage', 'explore'] },
        { when: { weather: ['rain'] }, state: 'special', line: 'Rough water. Things wash up.', odds: 1, reason: 'Things wash up in rough weather', activities: ['explore', 'forage'] },
      ],
      farther: {
        name: 'the dunes behind the beach', at: { x: 350, y: 5900 },
        lines: ['Up into the dunes.', 'Marram grass and wind.', 'Looking out over the strand.'],
      },
      lines: {
        forage: ['Combing the tideline.', 'Kneeling in wet sand.', 'Shells into a pocket.'],
        explore: ['Walking the wave edge.', 'Bare feet in cold sea.', 'Down the long white beach.'],
        investigate: ['Turning over the drift.', 'Something half buried.', 'Reading the wrack line.'],
      },
      yields: { forage: 1 },
      learn: [
        { text: 'Low water shows the best of the beach.' },
        { text: 'After rough weather, things wash up.', when: { weather: ['rain'] } },
        { text: 'Cherry shells collect in the hollows.', activity: 'forage' },
      ],
    },
    {
      // Its mark stands on the sand east of the mouth: the painted estuary is wider than the river line.
      id: 'kawaguchi', name: 'Kawaguchi', region: 2, at: COAST_MOUTH, marker: { x: 1985, y: 5965 }, habitat: 'estuary',
      note: 'The river mouth. Beyond the last reeds, only the sea.',
      teaser: 'At Kawaguchi the last reeds give way, and there is only the sea.',
      activities: ['explore', 'investigate', 'fish'],
      rules: [
        { when: { levels: ['high'] }, state: 'special', line: 'The tide is in over the bar.', odds: -1, reason: 'The bar is under the tide', activities: ['explore'] },
        { when: { levels: ['low'] }, state: 'special', line: 'The bar is out. Seals rest on it.', odds: 1, reason: 'The sand bar is out', activities: ['explore'] },
      ],
      lines: {
        explore: ['Out to the last sand spit.', 'The sea, all the way out.', 'Where fresh water meets salt.'],
        investigate: ['Watching the current turn.', 'Marking where the water stands.', 'Reading the ripples.'],
        fish: ['Casting into the sea.', 'Bass in the breaking water.', 'A long cast past the bar.'],
      },
      yields: { fish: 1 },
      learn: [
        { text: 'At low water a sand bar shows across the mouth.', when: { levels: ['low'] } },
        { text: 'The current turns with the tide.', activity: 'investigate' },
        { text: 'Seals sometimes rest on the bar.', activity: 'explore' },
        { text: 'Ren stands a long time where the river meets the waves. He doesn’t taste it. “Not yet. I want the first one from the boat.”', person: 'ren' },
      ],
    },
  ],

  finds: [
    {
      id: 'coastal-path', name: 'Across to the coast', category: 'encounters', region: 2,
      story: { reason: 'A dry path leads from the bridge to the seaside village' },
      at: ['shiobashi'], activities: ['explore', 'investigate'],
      reveals: ['kawagiri', 'matsubara'],
      text: 'Beyond the bridge, the path skirts the tidal creeks and runs south to Kawagiri. A light stands above the shore. Smoke rises from the village roofs.',
      tag: '“There! Roofs, and smoke, right down by the shore.”',
      hint: 'Follow the eastern path from Shiobashi Bridge, the stone crossing.',
    },
    {
      id: 'east-marsh-feather', name: 'A heron’s flight feather', category: 'keepsakes', region: 2,
      at: ['east-marsh'], activities: ['track', 'explore'],
      text: 'One long grey feather beside a pool, light enough to lift in the sea breeze.',
      tag: 'A grey feather beside the pool.', hint: 'Track along the eastern marsh pools.',
    },
    {
      id: 'far-shore-shell', name: 'A shell from the far shore', category: 'keepsakes', region: 2,
      at: ['far-shore'], activities: ['investigate'],
      text: 'A small shell with a violet lip. Above the beach, the harbour light came on.',
      tag: 'Violet inside a shell.', hint: 'Inspect the pebbles beyond the eastern dunes.',
    },
    {
      id: 'white-herons', name: 'White herons', category: 'birds', region: 2,
      at: ['shirasagi'], activities: ['explore'], when: { seasons: [SPRING, SUMMER] },
      text: 'A whole colony in the reeds, white as paper lanterns.',
      tag: 'White wings rising.', hint: 'In Shirasagi, in the warm months.',
      sighting: { near: [{ x: 300, y: 4690 }, { x: 720, y: 4880 }], line: 'White herons lifting' },
    },
    {
      id: 'autumn-arrivals', name: 'Autumn arrivals', category: 'birds', region: 2,
      at: ['shirasagi'], activities: ['explore'], when: { seasons: [AUTUMN] },
      text: 'The sky fills with geese and the reedlands answer.',
      tag: 'Skeins of birds coming in.', hint: 'In Shirasagi, in autumn.',
    },
    {
      id: 'eel-trap', name: 'An old eel trap', category: 'keepsakes', region: 2,
      at: ['shirasagi', 'fish-traps'], activities: ['investigate'],
      text: 'Woven willow, still sound. We hung it in camp for luck.',
      tag: 'Something woven in the reeds.', hint: 'Hidden in the ditches of Shirasagi.',
    },
    {
      id: 'haru-meeting', name: 'Haru the hunter', category: 'encounters', region: 2,
      story: { reason: 'Smoke from a camp among the pines' },
      at: ['matsubara'], activities: ['explore', 'track', 'visit'],
      text: 'Haru’s camp is a tarp, a kettle and a notebook of tracks, each one drawn and counted. The sideways prints from the sand have a page to themselves, and a question mark. She pours another cup and draws the shore for us in the sand: the bar, the light, the dunes where she sits to watch. Her camp stays here among the pines.',
      freeText: 'Haru’s camp is a tarp, a kettle and a notebook of tracks, each one drawn and counted. The sideways prints from the sand have a page to themselves, and a question mark. She pours another cup, and says she will come out with us whenever there are tracks to follow.',
      tag: 'Tea at a hunter’s camp.', hint: 'Someone keeps a camp among the Matsubara pines.',
    },
    {
      id: 'yui-meeting', name: 'Yui, keeper of stories', category: 'encounters', region: 2,
      story: { reason: 'Someone at the landing keeps the old stories' },
      at: ['takayuka'], activities: ['visit'],
      text: 'Yui sits on the landing steps with a book older than the stilt houses. She asks for our story from the first morning, and at every pause she says, “And then?” Ren tells the salt part twice.',
      tag: 'A long evening of stories.', hint: 'Someone at Takayuka, the stilt houses, keeps the old stories.',
    },
    {
      id: 'mended-sail', name: 'The mended sail', category: 'keepsakes', region: 2,
      story: { reason: 'Yui has a sail put by' },
      at: ['takayuka'], activities: ['visit'], after: 'yui-meeting', unless: 'loft-sail',
      text: 'Yui has kept it folded and dry for a very long time, waiting for someone to need it.',
      tag: 'Something folded, heavy and dry.', hint: 'Yui has something put by for travellers.',
    },
    {
      id: 'tide-song', name: 'The tide song', category: 'encounters', region: 2,
      story: { reason: 'Yui knows the old tide song' },
      at: ['takayuka'], activities: ['visit'], after: 'yui-meeting',
      text: 'An old song that counts the tide: go out on the falling water, and follow the darker blue. “Nobody ever told me what comes after the darker blue,” Yui says. “You will.”',
      tag: 'A tune worth remembering.', hint: 'Yui knows a song about the tide.',
    },
    {
      id: 'boatyard-moulds', name: 'The boatbuilder’s moulds', category: 'keepsakes', region: 2,
      story: { reason: 'The moulds are still on the wall' },
      at: ['funaya'], activities: ['investigate', 'visit'], after: 'aki-meeting', unless: 'boat-ledger', reward: { materials: 2 },
      text: 'The old boatbuilder remembers a young carpenter from Mio who came down to learn on these moulds, then went home up the river to build a little boat of his own. He asked how to fit a little seat up in the bow, for a child. She never came down to the sea. Between the moulds and what Aki remembers, we can make her sound. He sends us off with an armful of seasoned offcuts.',
      tag: 'Shapes of a boat on the wall.', hint: 'In the boat shed at Funaya Boatyard.',
    },
    {
      id: 'loft-sail', name: 'A sail in the loft', category: 'keepsakes', region: 2,
      story: { reason: 'The loft is dry enough to search' },
      at: ['funaya'], activities: ['investigate'], unless: 'mended-sail', when: { levels: ['middle', 'low'] }, reward: { materials: 1 },
      text: 'Rolled in the boatyard loft, patched and sound, with a spare spar beside it. It smells of tar and summers.',
      tag: 'Canvas, rolled tight.', hint: 'Up in the Funaya Boatyard loft, when the slipway is dry.',
    },
    {
      id: 'mullet', name: 'Grey mullet', category: 'fish', region: 2,
      at: ['hosokawa', 'shiobashi', 'fish-traps'], activities: ['fish'],
      text: 'They jump for no reason anyone knows, and come up the creek on every tide.',
      tag: 'A jumping fish on the line.', hint: 'In Hosokawa, the reed creek.',
      sighting: { near: [{ x: 790, y: 4860 }, { x: 840, y: 5040 }], line: 'A mullet leaps in the creek' },
    },
    {
      id: 'beach-gulls', name: 'Gulls on the beach', category: 'birds', region: 2,
      text: 'Black-tailed gulls stood facing the wind in a long row, as if waiting for something to be announced.',
      tag: 'A row of white birds.', hint: 'Along the beach, facing the wind.',
      sighting: { near: [{ x: 420, y: 5950 }, { x: 2200, y: 5800 }, { x: 2500, y: 5980 }], line: 'Gulls facing the wind' },
    },
    {
      id: 'black-kite', name: 'The black kite', category: 'birds', region: 2, when: { weather: ['clear'] },
      text: 'It circled over the boatyard all morning, whistling, and stole a fish from the drying rack when nobody was looking.',
      tag: 'A whistle from high up.', hint: 'Over the harbour, on a clear day.',
      sighting: { near: [{ x: 2060, y: 5470 }, { x: 1800, y: 5740 }], line: 'A kite whistling overhead' },
    },
    {
      id: 'cormorant', name: 'Cormorant', category: 'birds', region: 2,
      at: ['hosokawa', 'shiobashi'], activities: ['explore'],
      text: 'It holds its wings out to dry like washing on a line.',
      tag: 'Dark wings held wide.', hint: 'On the posts along Hosokawa.',
      sighting: { near: [{ x: 800, y: 4900 }, { x: 880, y: 5160 }], line: 'A cormorant drying its wings' },
    },
    {
      id: 'matsutake', name: 'Pine mushrooms', category: 'plants', region: 2, rare: true,
      at: ['matsubara'], activities: ['forage'], when: { seasons: [AUTUMN] },
      text: 'Hidden under the needles, and they smell of the whole autumn wood.',
      tag: 'A wonderful smell from the basket.', hint: 'Under the pines of Matsubara, in autumn.',
    },
    {
      id: 'green-pheasant', name: 'Green pheasant', category: 'birds', region: 2,
      at: ['matsubara'], activities: ['explore'],
      text: 'A sudden clatter, and green and red feathers going away low.',
      tag: 'A clatter of wings.', hint: 'In the pines of Matsubara.',
      sighting: { near: [{ x: COAST_PINES.x + 50, y: COAST_PINES.y + 20 }], line: 'A pheasant in the pines' },
    },
    {
      id: 'pheasant-feather', name: 'A pheasant’s feather', category: 'keepsakes', region: 2,
      at: ['matsubara'], activities: ['track'], follows: 'green-pheasant', after: 'haru-meeting',
      text: 'Long, barred and copper-green. Haru put it in her hat band.',
      tag: 'A long barred feather.', hint: 'Tracking in Matsubara.',
    },
    {
      id: 'heron-prints', name: 'Heron prints', category: 'curiosities', region: 2,
      at: ['shirasagi', 'east-marsh'], activities: ['track'], follows: 'white-herons',
      text: 'Long three-toed prints along the same ditch, every morning, at the same slow pace.',
      tag: 'Long prints in the mud.', hint: 'Tracking in Shirasagi.',
    },
    {
      id: 'whitebait', name: 'Whitebait', category: 'fish', region: 2,
      at: ['hosokawa', 'amiya'], activities: ['fish'], when: { seasons: [SPRING] },
      text: 'Glassy little fish running up the creek in shoals, so clear you see their eyes first.',
      tag: 'Something glassy in the net.', hint: 'In Hosokawa, in spring.',
    },
    {
      id: 'clams', name: 'Clams from the mud', category: 'fish', region: 2,
      at: ['shiohara', 'amiya'], activities: ['forage', 'fish'], when: { levels: ['low'] },
      text: 'Dug from the low mud with our fingers and cooked on the spot over driftwood.',
      tag: 'A heavy, rattling basket.', hint: 'In the Shiohara mud, at low water.',
    },
    {
      id: 'reed-bunting', name: 'Reed bunting', category: 'birds', region: 2,
      at: ['shirasagi'], activities: ['explore', 'track'], when: { seasons: [AUTUMN, WINTER] },
      text: 'Sparrow-brown, with a black cap, clinging sideways to a single reed in the wind.',
      tag: 'Something small on a swaying reed.', hint: 'In Shirasagi, in the cold months.',
      sighting: { near: [{ x: 430, y: 4760 }], line: 'A bunting on a swaying reed' },
    },
    {
      id: 'salt-flower', name: 'Salt flower', category: 'plants', region: 2,
      at: ['shiohara', 'east-marsh'], activities: ['forage'], when: { seasons: [SUMMER, AUTUMN] },
      text: 'Lilac flowers on a plant that drinks the tide.',
      tag: 'Lilac flowers in the basket.', hint: 'In Shiohara, in summer.',
    },
    {
      id: 'mudskipper', name: 'Mudskipper', category: 'wildlife', region: 2,
      at: ['shiohara'], activities: ['investigate'], when: { levels: ['middle', 'low'] },
      text: 'A fish that walks on the mud and blinks. Nobody believed us.',
      tag: 'Something skipping on the mud.', hint: 'On the open mud of Shiohara.',
    },
    {
      id: 'tide-marks', name: 'The turning tide', category: 'curiosities', region: 2,
      story: { reason: 'The tide marks are plain to read' },
      at: ['kawaguchi', 'iso'], activities: ['investigate'], when: { levels: ['middle', 'low'] },
      text: 'Marks on the rock show how high the sea comes, and when it turns. Leave on the falling tide.',
      tag: 'Notes on how the water moves.', hint: 'Watch the water at Kawaguchi or Iso.',
    },
    {
      id: 'starfish', name: 'Starfish', category: 'wildlife', region: 2,
      at: ['iso', 'shiodamari'], activities: ['investigate', 'forage'], when: { levels: ['low'] },
      text: 'Orange, five-armed, and slowly walking somewhere on a thousand tiny feet.',
      tag: 'Something orange in a pool.', hint: 'In the pools at Iso, at low water.',
    },
    {
      id: 'shore-crab', name: 'Shore crab', category: 'wildlife', region: 2,
      at: ['iso', 'shirahama', 'shiodamari'], activities: ['investigate', 'forage'], when: { levels: ['middle', 'low'] },
      text: 'It held its claws up at us, very brave for its size.',
      tag: 'Something sideways in the weed.', hint: 'Under the weed, when the water is out.',
    },
    {
      id: 'oystercatcher', name: 'Oystercatcher', category: 'birds', region: 2,
      text: 'Black and white with an orange beak, and a piping call you hear before you see it.',
      tag: 'A piping call on the rocks.', hint: 'On the rocks and the beach.',
      sighting: { near: [{ x: 140, y: 5990 }, { x: 470, y: 6010 }], line: 'Oystercatchers piping on the rocks' },
    },
    {
      id: 'cherry-shells', name: 'Cherry shells', category: 'curiosities', region: 2,
      at: ['shirahama'], activities: ['forage', 'explore'], when: { levels: ['middle', 'low'] },
      text: 'Thin as petals and as pink. The beach is full of them after a spring tide.',
      tag: 'Something pink in the sand.', hint: 'In the hollows of the beach.',
    },
    {
      id: 'moon-shell', name: 'A moon shell', category: 'curiosities', region: 2,
      at: ['shirahama'], activities: ['forage', 'investigate'], when: { levels: ['low'] },
      text: 'Round and smooth as a moon. Hold it to your ear and it sounds like the river did.',
      tag: 'Something round and smooth.', hint: 'Far out on the sand at low water.',
    },
    {
      id: 'cowrie', name: 'A cowrie', category: 'curiosities', region: 2, rare: true,
      at: ['shirahama'], activities: ['forage'], farther: true, when: { levels: ['low'] },
      text: 'Glossy as a little pot, spotted brown. It must have come a long way on the warm water.',
      tag: 'Something glossy in the wet sand.', hint: 'Behind Shirahama, in the dunes, at low water.',
    },
    {
      id: 'sea-glass', name: 'Sea glass', category: 'keepsakes', region: 2,
      at: ['shirahama'], activities: ['forage', 'explore'],
      text: 'Blue-green and frosted by the sand. Once it was a bottle somewhere.',
      tag: 'A frosted blue glint.', hint: 'Along the tideline.',
    },
    {
      id: 'driftwood', name: 'Sea-polished wood', category: 'keepsakes', region: 2,
      at: ['shirahama', 'kawaguchi'], activities: ['explore', 'investigate'],
      text: 'Silver-grey and smooth as bone. It came from farther away than anyone knows.',
      tag: 'Something long and grey.', hint: 'Washed up along the beach.',
    },
    {
      id: 'kelp', name: 'Kelp', category: 'plants', region: 2,
      at: ['shirahama', 'iso'], activities: ['forage'], when: { weather: ['rain', 'mist'] },
      text: 'Long brown ribbons torn up by the weather. Good for the garden, and for soup.',
      tag: 'Heavy, wet and brown.', hint: 'After rough weather.',
    },
    {
      id: 'net-float', name: 'A glass net float', category: 'keepsakes', region: 2,
      at: ['shirahama'], activities: ['explore', 'investigate'], when: { weather: ['rain'] },
      text: 'A green glass ball in a net of old rope, from a fishing boat nobody here has heard of.',
      tag: 'Something green and round.', hint: 'Washed up after rain and rough water.',
    },
    {
      id: 'bottle-letter', name: 'A letter in a bottle', category: 'keepsakes', region: 2, rare: true,
      at: ['shirahama'], activities: ['explore', 'investigate'], farther: true, when: { weather: ['rain'] },
      text: 'Too faded to read, except the last line: “Wherever you are, I hope it is beautiful.”',
      tag: 'Something with paper inside.', hint: 'Up in the Shirahama dunes, after a storm.',
    },
    {
      id: 'sanderlings', name: 'Sanderlings', category: 'birds', region: 2, when: { levels: ['middle', 'low'] },
      text: 'They run with the waves like clockwork toys, in and out, never wet.',
      tag: 'Little birds running.', hint: 'At the wave edge on the beach.',
      sighting: { near: [{ x: 440, y: 6010 }, { x: 700, y: 5975 }], line: 'Sanderlings running with the waves' },
    },
    // Wishes (see `wishes.ts`): only ever brought home by the friend whose wish was built.
    {
      id: 'sea-eagle', name: 'A sea eagle', category: 'birds', region: 2, rare: true,
      text: 'From the lookout Haru watched a sea eagle work the marsh, wings like a door. When it had gone she pointed past the lighthouse to a grey line that did not move. Not cloud, this time: the sea, all the way out.',
      tag: 'Broad wings over the marsh.', hint: 'Over the marsh, seen from somewhere high and still.',
    },
    {
      id: 'tide-night', name: 'A night under the shelter', category: 'keepsakes', region: 2,
      text: 'We sat up under the new roof long after the fire. Yui told the one about the first boat, and somebody told it back wrong, on purpose. The tide came in under us all.',
      tag: 'Voices late under the roof.', hint: 'Under a roof by the water, when the tide comes in at night.',
    },
    {
      id: 'seal', name: 'A seal on the bar', category: 'wildlife', region: 2, rare: true,
      at: ['kawaguchi'], activities: ['explore'], when: { levels: ['low'] },
      text: 'It lay on the sand bar like a log, then raised its head and looked at us for a long time.',
      tag: 'A dark shape on the bar.', hint: 'On the sand bar at low water; closer in the mist.',
      sighting: { near: [{ x: 1155, y: 5970 }, { x: 170, y: 6150 }], line: 'A seal raising its head', moment: { weather: ['mist'] } },
    },
    {
      id: 'first-sea', name: 'Down to the open sea', category: 'curiosities', region: 2,
      story: { reason: 'The river opens onto the sea' },
      at: ['kawaguchi', 'shirahama', 'far-shore'], activities: ['explore'],
      text: 'We have heard it and smelled it; now we walk right down to it. Open water as far as we can see, and nothing between us and it but sand. We sit a long while. Sora watches a sail pass the harbour light. “I want to know what it feels like out there.”',
      freeText: 'We walk right down to the open water and sit on the sand a long while, watching a sail go out past the harbour light.',
      tag: 'A long look at the horizon.', hint: 'Where the river meets the sea.',
    },
    {
      id:'strand-memory', name:'The net-menders’ beach', category:'encounters', region:2,
      at:['shirahama'], activities:['investigate','explore'], story:{reason:'Old mooring posts stand above the tide'},
      text:'Grooves circle the old posts at Shirahama. Whole families once hauled their boats onto this sand, then sat mending nets until the harbour lamp was lit. We sit in the same shelter from the wind.',
      tag:'“They pulled their boats up here. You can still see the rope marks.”',hint:'Read the worn posts above Shirahama’s tideline.',
    },
    {
      id:'pool-memory', name:'The hours in the rock', category:'curiosities', region:2,
      at:['iso'], activities:['investigate'], story:{reason:'The pools show where the tide has been'},
      text:'At Iso, pale rings mark the pools on black stone. Tiny shells cling below the last wet line. We mark the falling water in the notebook; the sea has a rhythm of its own.',
      tag:'“See the wet line? The tide is going out.”',hint:'Look closely at Iso’s rock pools.',
    },

  ],

  leads: [
    {
      id: 'yui-sail', from: ['takayuka'], when: { structure: 'dock' },
      to: 'takayuka', find: 'mended-sail', holds: {},
      line: 'Yui says the sail is ready whenever we are.',
    },
    {
      id: 'loft', from: ['funaya'], when: { levels: ['high'] },
      to: 'funaya', find: 'loft-sail', holds: { levels: ['middle', 'low'] },
      line: 'There is canvas up in the Funaya Boatyard loft, once the slipway dries.',
    },
    {
      id: 'storm-beach', from: ['shirahama', 'takayuka', 'iso'], when: { weather: ['mist'] },
      to: 'shirahama', find: 'net-float', holds: { weather: ['rain'] },
      line: 'The net menders say the next rough day will wash things up at Shirahama.',
    },
    {
      id: 'low-sands', from: ['shirahama', 'shiohara'], when: { levels: ['high', 'middle'] },
      to: 'shirahama', find: 'moon-shell', holds: { levels: ['low'] },
      line: 'When the water is low, the sands at Shirahama run far out.',
    },
    {
      id: 'mouth-tide', from: ['shiohara', 'takayuka'], when: {},
      to: 'kawaguchi', find: 'tide-marks', holds: { levels: ['middle', 'low'] },
      line: 'At Kawaguchi you can watch the tide turn.',
    },
  ],
};

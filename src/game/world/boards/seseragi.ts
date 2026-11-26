/**
 * Valley I: Seseragi, "the murmuring stream".
 *
 * COMPOSITION. The river is the subject, and it changes character all the way down:
 *
 *   - At the top it drops off the mountain in a waterfall into a plunge pool, runs
 *     shallow over the high stones on a bare rocky shelf, then pinches into a gorge.
 *   - It opens into Fuchi, the deep pool at the gorge foot where a brook from the
 *     eastern side valley comes in, crosses the middle stones, and swings east in one
 *     broad bend round the water meadows. On a knoll inside the bend stands Ukishima Shrine,
 *     the shrine among cherries; an old silted channel cuts across the meadow's neck.
 *   - Below the bend it narrows over a rapid, widens into the mill pool beside the
 *     village, and runs out over the low stones, past the reed marsh, on down the valley.
 *
 *   Woods are separate masses with open ground between: Kamimori in the west with a
 *   deer clearing at its heart, Shimomori on the eastern knoll above the side valley,
 *   pines on the high shoulders, and forest only on the valley's outer slopes. Hanano,
 *   the high meadow, sits open under the eastern ridge. The village has room: a mill on
 *   the pool, a landing, kitchen plots, an orchard on its own slope.
 *
 * PUZZLE. A year of the great migration, with the village's year alongside it.
 *
 *   Spring teaches drawing (the walk to the shrine blossom) and that stones in use stop
 *   fish: the salmon run up to Fuchi, and the middle stones lie on their way. The
 *   deer must cross by the high stones instead. (The low stones and any stones the
 *   player lays are under the melt.)
 *   Summer teaches that deer and people keep apart: the deer's line from the high
 *   stones to Shimomori cuts the valley in two, so the haymakers must go round it,
 *   behind Shimomori or over the high moor.
 *   Autumn teaches the water meadows and the flyway: the rains drown the meadow, and
 *   the herons will not rest at Sagi-ike beside a busy path; the swans need it.
 *   Winter teaches the snowline: the high stones are snowed in, so the deer need a
 *   crossing below it, and the middle stones are free now that the salmon are upriver.
 *
 *   Traps (first instincts that fail for a reason the valley shows):
 *     1. Spring deer over the middle stones: nearest, but the salmon stop below them.
 *     2. The haymakers' straight line to Hanano: it cuts the deer's way.
 *     3. The haymakers over the middle stones (possible once the deer go by Hanano):
 *        it takes the only winter crossing below the snow.
 *     4. The straight walk to the shrine across the water meadow: it drowns in autumn,
 *        and it frightens the herons off the pool the swans rest at.
 *     5. Leaving the deer on the high stones for winter: snowed in.
 *
 *   Solution A (routes only, 6 strokes, in `solution`): the shrine walk round by the
 *   dry levee; the deer by the high stones and the brook stones; the deer up to Hanano;
 *   the haymakers over the low stones and round behind Shimomori; the winter deer over
 *   the middle stones.
 *   Solution B (9 strokes): the straight meadow walk; the deer by Hanano; the haymakers
 *   over the high moor and a footbridge above the high stones; in autumn open the old
 *   channel to keep the meadow dry and plant a grove for the swans; the winter deer
 *   over the middle stones.
 *   A planner can do it in 5: let the salmon pass first, then lay one corridor over the
 *   middle stones late in spring that also serves the winter.
 */

import { type BoardDef, type LaneDef, type SpriteDef, AUTUMN, SPRING, SUMMER, WINTER } from '../types';

const ALL_YEAR = [SPRING, SUMMER, AUTUMN, WINTER];

/** A row of sprites from one point to another, as planted trees or a fence line. */
const row = (asset: string, x0: number, y0: number, x1: number, y1: number, n: number, scale: number, jitter = 0): SpriteDef[] =>
  Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    return { asset, x: Math.round(x0 + (x1 - x0) * t + (i % 2 ? jitter : -jitter)), y: Math.round(y0 + (y1 - y0) * t), scale: scale * (i % 3 === 1 ? 0.94 : 1), flip: i % 2 === 1 };
  });

const point = (x: number, y: number): { x: number; y: number } => ({ x, y });

/**
 * The valley's lanes: one road the length of the west bank, from the high stones
 * past the camp, through Kamimori and down through the village toward Mio, with a
 * few short branches to real destinations. Few, calm and joined: every lane ends at
 * a door, a yard, a landing or another lane.
 */
const LANES: LaneDef[] = [
  // The road: from the high stones, through Kamimori and its clearing, past the fern meadow and the old way, into the village.
  {
    width: 34,
    points: [
      point(978, 452), point(860, 470), point(735, 482), point(640, 540), point(575, 660), point(530, 800), point(525, 930),
      point(570, 1060), point(600, 1180), point(570, 1310), point(585, 1480), point(590, 1640), point(530, 1770), point(450, 1850),
    ],
  },
  // The tended village path reaches the lower meadows.
  { width: 34, points: [point(450, 1850), point(365, 1930), point(320, 2030), point(250, 2110), point(215, 2250)] },
  // Beyond the meadows only grass-covered cart ruts lead past Furumichi's waymark.
  // This same lane guides walkers; its end joins Mio's old road on the higher bank.
  { width: 40, wear: .85, ruts: true, points: [point(215, 2250), point(460, 2310), point(620, 2360), point(700, 2400), point(720, 2460), point(760, 2500)] },
  // The village street: to the mill door, with the landing stage below it.
  { width: 30, points: [point(450, 1850), point(560, 1838), point(660, 1808), point(735, 1792)] },
  { width: 24, points: [point(600, 1830), point(630, 1890), point(648, 1942)] },
  // Up to the orchard.
  { width: 22, points: [point(450, 1850), point(380, 1770), point(330, 1690)] },
];

export const seseragi: BoardDef = {
  id: 'seseragi',
  name: 'Seseragi',
  subtitle: 'The murmuring stream',
  width: 2200,
  height: 2500,
  seed: 2086,
  snowAltitude: 0.7,
  hills: [],

  relief: [
    // The mountains, stacked beyond the top of the valley.
    { x: 300, y: -260, r: 620, h: 0.4 }, { x: 1150, y: -480, r: 760, h: 0.5 }, { x: 1950, y: -260, r: 640, h: 0.42 },
    // The rocky shelf the high stones lie on, and the shoulders either side of it.
    { x: 560, y: 260, r: 420, h: 0.18 }, { x: 1700, y: 380, r: 440, h: 0.16 },
    // Ridges along the outer edges.
    { x: -320, y: 700, r: 620, h: 0.28 }, { x: -340, y: 1700, r: 640, h: 0.22 },
    { x: 2520, y: 600, r: 620, h: 0.28 }, { x: 2540, y: 1700, r: 640, h: 0.22 },
    // Kamimori's rise and Shimomori's knoll.
    { x: 400, y: 920, r: 340, h: 0.12 }, { x: 1900, y: 1180, r: 330, h: 0.13 },
    // Bluffs either side of the gorge.
    { x: 760, y: 700, r: 220, h: 0.17 }, { x: 1110, y: 760, r: 220, h: 0.17 },
    // The orchard slope and Ukishima Shrine's knoll.
    { x: 230, y: 1560, r: 260, h: 0.08 }, { x: 1320, y: 1430, r: 150, h: 0.07 },
    // The side valley's southern shoulder.
    { x: 1850, y: 700, r: 220, h: 0.07 },
  ],

  channels: [
    {
      id: 'main',
      points: [
        [1280, -530, 22], [1298, -420, 28], [1238, -335, 32], [1258, -220, 36], [1204, -60, 50], [1194, 76, 54],
        // The plunge pool at the waterfall's foot.
        [1172, 196, 176], [1112, 318, 92],
        // The high stones, spread wide and shallow over the shelf.
        [1052, 432, 128],
        // The gorge.
        [1000, 548, 70], [936, 660, 54], [902, 780, 50], [926, 884, 62],
        // Fuchi, the deep pool at the gorge foot.
        [912, 1008, 236], [990, 1118, 120],
        // The middle stones, then the broad bend round the water meadows.
        [1072, 1178, 138], [1232, 1248, 124], [1430, 1336, 168], [1560, 1468, 204], [1504, 1622, 156],
        // A rapid where it narrows, then the mill pool.
        [1330, 1722, 94], [1110, 1796, 132], [890, 1890, 290], [770, 2000, 250],
        // Out over the low stones, past the reed marsh, and on down the valley to the next reach.
        [790, 2122, 118], [900, 2214, 146], [1010, 2310, 170], [1082, 2410, 156], [1100, 2500, 150], [1100, 2590, 150],
        // Beyond the board the river runs on toward the lower valley (trimmed off when a reach is joined below).
        [1150, 2820, 176], [1090, 3080, 210], [1120, 3400, 250],
      ],
    },
    {
      id: 'brook',
      points: [[2400, 744, 26], [2150, 786, 30], [1890, 852, 34], [1640, 912, 38], [1420, 956, 44], [1220, 990, 48], [1046, 1012, 52], [980, 1020, 56]],
    },
    {
      id: 'old-channel',
      name: 'the old channel',
      closed: true,
      points: [[1118, 1238, 64], [1030, 1330, 68], [1080, 1440, 70], [1000, 1530, 70], [1050, 1650, 68], [1112, 1784, 64]],
    },
  ],
  islands: [
    // The willow islet in the mill pool.
    { x: 870, y: 1912, r: 40 }, { x: 900, y: 1924, r: 30 },
  ],
  shallows: [
    { x: 1150, y: 200, r: 80 },
    { x: 1530, y: 1530, r: 110 },
    { x: 1020, y: 2320, r: 90 },
  ],

  fords: [
    { id: 'high-stones', name: 'the high stones', x: 1052, y: 432, radius: 84, floods: [] },
    { id: 'middle-stones', name: 'the middle stones', x: 1072, y: 1178, radius: 84, floods: [] },
    { id: 'brook-stones', name: 'the brook stones', x: 1420, y: 956, radius: 64, floods: [] },
    { id: 'low-stones', name: 'the low stones', x: 900, y: 2214, radius: 90, floods: [SPRING] },
  ],
  maxBridgeSpan: 130,

  zones: [
    {
      id: 'gorge',
      name: 'the gorge',
      reason: 'The gorge is too steep to cross.',
      blobs: [
        { x: 1004, y: 540, r: 66 }, { x: 966, y: 600, r: 74 }, { x: 934, y: 664, r: 78 }, { x: 912, y: 730, r: 78 },
        { x: 904, y: 796, r: 76 }, { x: 918, y: 860, r: 72 },
      ],
    },
  ],

  places: [
    {
      id: 'seseragi', name: 'Seseragi', kind: 'village', x: 470, y: 1900, radius: 165, links: ['path'],
      note: 'The village: a mill on the pool, a landing, and a kettle always on.',
    },
    {
      id: 'ukishima', name: 'Ukishima Shrine', kind: 'shrine', x: 1320, y: 1450, radius: 115, links: ['path'],
      note: 'The shrine on its knoll, an island when the meadows flood.',
    },
    {
      id: 'kamimori', name: 'Kamimori', kind: 'forest', x: 470, y: 960, radius: 190, links: ['corridor'], rest: true,
      note: 'The western wood. The deer keep a clearing at its heart.',
    },
    {
      id: 'shimomori', name: 'Shimomori', kind: 'forest', x: 1830, y: 1220, radius: 185, links: ['corridor'], rest: true,
      note: 'The sheltered wood above the side valley. Deer winter here.',
    },
    {
      id: 'hanano', name: 'Hanano', kind: 'meadow', x: 1690, y: 560, radius: 140, links: ['corridor', 'path'],
      note: 'The high meadow: summer grass for deer and hay for the village. Snowbound in winter.',
    },
    {
      id: 'kagami', name: 'Kagami-numa', kind: 'wetland', x: 430, y: 40, radius: 110, links: [], rest: true,
      note: 'The high tarn, where the swans gather before they come down the valley.',
    },
    {
      id: 'sagi', name: 'Sagi-ike', kind: 'wetland', x: 900, y: 1580, radius: 85, links: [], rest: true,
      note: 'The heron pool in the water meadow. Birds rest here if no one walks close by.',
    },
    {
      id: 'ashihara', name: 'Ashihara', kind: 'wetland', x: 1360, y: 2260, radius: 125, links: [], rest: true,
      note: 'The reed marsh on the lower river, where the swans spend the winter.',
    },
    {
      id: 'seseragi-pool', name: 'Fuchi', kind: 'water', x: 912, y: 1004, radius: 70, links: [],
      note: 'The deep pool below the gorge, where the salmon spawn.',
    },
    {
      id: 'seseragi-foot', name: 'The lower reach', kind: 'water', x: 1092, y: 2450, radius: 70, links: [],
      note: 'Where the river leaves the upper valley. The salmon come up past it each spring.',
    },
  ],

  floodplains: [
    {
      id: 'water-meadow',
      name: 'the water meadow',
      floods: [AUTUMN],
      relievedBy: ['old-channel'],
      blobs: [
        { x: 860, y: 1570, r: 150 }, { x: 960, y: 1640, r: 140 }, { x: 1060, y: 1560, r: 150 }, { x: 1140, y: 1650, r: 120 },
        { x: 990, y: 1470, r: 120 }, { x: 1200, y: 1580, r: 100 },
      ],
    },
  ],

  // Woodland floor is laid automatically under `woods`; these are the other grounds.
  patches: [
    // The mountain source: bare rock and scree round the falls and the high shelf.
    { material: 'rocky', blobs: [{ x: 1180, y: -60, r: 520 }, { x: 600, y: -120, r: 460 }, { x: 1800, y: -100, r: 460 }, { x: 1080, y: 380, r: 220 }] },
    { material: 'scree', blobs: [{ x: 1250, y: 120, r: 150 }, { x: 1060, y: 150, r: 110 }, { x: 990, y: 560, r: 120 }, { x: 930, y: 680, r: 130 }, { x: 900, y: 800, r: 124 }, { x: 940, y: 900, r: 100 }] },
    // Wet ground: the high tarn, the heron pool, the reed marsh on the lower river.
    { material: 'wetland', blobs: [{ x: 430, y: 40, r: 160 }, { x: 900, y: 1590, r: 110 }, { x: 1370, y: 2270, r: 200 }, { x: 1600, y: 2420, r: 220 }, { x: 420, y: 2470, r: 170 }] },
    // The orchard and the shrine's grass.
    { material: 'orchard', blobs: [{ x: 230, y: 1560, r: 190 }, { x: 1320, y: 1450, r: 120 }] },
  ],

  woods: [
    // Kamimori: a ring of trees round the deer's clearing, heavier on its uphill side.
    { kind: 'mixed', spacing: 108, scale: 0.95, blobs: [{ x: 470, y: 700, r: 170 }, { x: 690, y: 770, r: 140 }, { x: 250, y: 760, r: 170 }, { x: 300, y: 600, r: 150 }, { x: 760, y: 950, r: 120 }, { x: 170, y: 990, r: 140 }] },
    // Low trees across its open southern side, so the clearing shows from the valley.
    { kind: 'broadleaf', spacing: 90, scale: 0.55, blobs: [{ x: 280, y: 1150, r: 100 }, { x: 680, y: 1130, r: 90 }] },
    // Shimomori, on its knoll above the side valley, thinning toward the river.
    { kind: 'broadleaf', spacing: 104, scale: 0.95, blobs: [{ x: 1850, y: 1200, r: 190 }, { x: 2040, y: 1060, r: 170 }, { x: 1990, y: 1370, r: 140 }, { x: 1700, y: 1300, r: 90 }] },
    // Pines on the high shoulders, in stands rather than a sheet.
    { kind: 'pine', spacing: 140, scale: 0.85, blobs: [{ x: 150, y: 330, r: 190 }, { x: 760, y: 120, r: 140 }] },
    { kind: 'pine', spacing: 150, scale: 0.85, blobs: [{ x: 2080, y: 360, r: 190 }, { x: 1470, y: 220, r: 110 }] },
    // The valley's outer slopes: separate masses with open hillside between.
    { kind: 'mixed', spacing: 150, scale: 1.1, blobs: [{ x: -360, y: 320, r: 270 }, { x: -200, y: 520, r: 160 }] },
    { kind: 'mixed', spacing: 150, scale: 1.1, blobs: [{ x: -480, y: 1060, r: 260 }] },
    { kind: 'mixed', spacing: 150, scale: 1.1, blobs: [{ x: -380, y: 2320, r: 280 }] },
    { kind: 'pine', spacing: 170, scale: 1, blobs: [{ x: -260, y: 1640, r: 150 }] },
    { kind: 'mixed', spacing: 150, scale: 1.1, blobs: [{ x: 2520, y: 230, r: 260 }] },
    { kind: 'mixed', spacing: 150, scale: 1.1, blobs: [{ x: 2560, y: 1180, r: 250 }] },
    { kind: 'mixed', spacing: 150, scale: 1.1, blobs: [{ x: 2640, y: 2200, r: 280 }] },
    // A copse on the lower east bank.
    { kind: 'broadleaf', spacing: 96, scale: 0.85, blobs: [{ x: 1990, y: 1900, r: 120 }, { x: 2100, y: 1980, r: 90 }] },
  ],

  outcrops: [
    // Round the falls and on the high shelf.
    { x: 1300, y: 130, size: 9, spread: 110 }, { x: 1040, y: 230, size: 8, spread: 100 }, { x: 1380, y: 300, size: 5, spread: 80 }, { x: 900, y: 420, size: 5, spread: 70 }, { x: 1230, y: 470, size: 5, spread: 70 },
    // The gorge rims.
    { x: 820, y: 600, size: 6, spread: 66 }, { x: 1040, y: 680, size: 6, spread: 70 }, { x: 800, y: 820, size: 5, spread: 60 }, { x: 1030, y: 880, size: 5, spread: 60 },
    // Hanano, the side valley and the bend.
    { x: 1500, y: 640, size: 4, spread: 60 }, { x: 2080, y: 820, size: 5, spread: 60 }, { x: 1700, y: 1580, size: 4, spread: 60 }, { x: 1440, y: 1800, size: 4, spread: 56 },
  ],

  lanes: LANES,

  sprites: [
    // The waterfall and the plunge pool.
    { asset: 'waterfall', x: 1196, y: 104, scale: 2.1 },
    { asset: 'foam-rapids', x: 1170, y: 168, scale: 0.9 },
    { asset: 'foam-rapids', x: 1110, y: 318, scale: 0.6, flip: true },
    { asset: 'cliff-decoration', x: 1300, y: 60, scale: 1.2 },
    { asset: 'cliff-decoration', x: 1080, y: 70, scale: 1.1, flip: true },
    // The gorge: crags on both rims, a few pines clinging to them.
    { asset: 'cliff-decoration', x: 860, y: 610, scale: 1.2 }, { asset: 'cliff-decoration', x: 1030, y: 640, scale: 1.1, flip: true },
    { asset: 'cliff-decoration', x: 830, y: 760, scale: 1.15, flip: true }, { asset: 'cliff-decoration', x: 1000, y: 800, scale: 1.2 },
    { asset: 'pine', x: 1060, y: 740, scale: 0.65, flip: true }, { asset: 'pine', x: 790, y: 860, scale: 0.6 },
    { asset: 'foam-rapids', x: 936, y: 664, scale: 0.7 },
    { asset: 'foam-rapids', x: 904, y: 790, scale: 0.7, flip: true },
    { asset: 'foam-rapids', x: 926, y: 892, scale: 0.8 },
    // Kagami-numa, the high tarn.
    { asset: 'small-pool', x: 420, y: 50, scale: 2.2 },
    { asset: 'small-pool', x: 520, y: 90, scale: 1.2, flip: true },
    { asset: 'wetland-reeds', x: 320, y: 80, scale: 0.75 }, { asset: 'wetland-reeds', x: 580, y: 100, scale: 0.6, flip: true }, { asset: 'wetland-reeds', x: 470, y: 120, scale: 0.55 },
    { asset: 'mossy-boulder', x: 330, y: 10, scale: 0.8 }, { asset: 'large-rock', x: 560, y: 30, scale: 0.7, flip: true },
    // Hanano: a hay shed and a lone pine under the ridge.
    { asset: 'pine', x: 1860, y: 460, scale: 0.85 }, { asset: 'pine', x: 1910, y: 500, scale: 0.6, flip: true },
    { asset: 'large-rock', x: 1560, y: 470, scale: 0.8 }, { asset: 'mossy-boulder', x: 1780, y: 690, scale: 0.7 },
    ...row('fence', 1560, 660, 1700, 690, 2, 0.6),
    // Kamimori's clearing.
    { asset: 'log', x: 540, y: 1010, scale: 0.8 },
    // The brook's little fall in the side valley.
    { asset: 'waterfall', x: 2110, y: 800, scale: 0.9 },
    { asset: 'foam-rapids', x: 2090, y: 806, scale: 0.5 },
    // Ukishima Shrine: the shrine on its knoll, cherries and lanterns.
    { asset: 'shrine', x: 1340, y: 1500, scale: 1 },
    { asset: 'cherry-spring', x: 1210, y: 1430, scale: 0.95 },
    { asset: 'cherry-spring', x: 1425, y: 1492, scale: 0.8, flip: true },
    { asset: 'cherry-spring', x: 1390, y: 1585, scale: 0.7 },
    { asset: 'lantern', x: 1280, y: 1530, scale: 0.5 }, { asset: 'lantern', x: 1400, y: 1530, scale: 0.5, flip: true },
    // Sagi-ike, the heron pool in the water meadow.
    { asset: 'small-pool', x: 900, y: 1590, scale: 1.1 },
    { asset: 'wetland-reeds', x: 840, y: 1600, scale: 0.65 }, { asset: 'wetland-reeds', x: 960, y: 1570, scale: 0.6, flip: true },
    { asset: 'heron', x: 920, y: 1610, scale: 0.55 },
    // Stones left along the banks of the old channel, where the river ran once.
    { asset: 'small-rocks', x: 1097, y: 1350, scale: 0.55, flip: true }, { asset: 'mossy-boulder', x: 989, y: 1389, scale: 0.5 }, { asset: 'small-rocks', x: 1124, y: 1387, scale: 0.55 }, { asset: 'river-stones', x: 1010, y: 1426, scale: 0.55, flip: true },
    { asset: 'moss-grasses', x: 1066, y: 1549, scale: 0.55 }, { asset: 'river-stones', x: 958, y: 1590, scale: 0.55 }, { asset: 'small-rocks', x: 1095, y: 1596, scale: 0.55, flip: true }, { asset: 'mossy-boulder', x: 1012, y: 1716, scale: 0.5 },
    // A pair of trees on the open west bank.
    { asset: 'sparse-woodland', x: 230, y: 1300, scale: 0.85 },
    // Seseragi village, spread out with yards between.
    { asset: 'farmhouse', x: 370, y: 1790 },
    { asset: 'cottage', x: 220, y: 1980, scale: 0.9, flip: true },
    { asset: 'timber-cottage', x: 480, y: 2040, scale: 0.8 },
    { asset: 'shed', x: 110, y: 1860, scale: 0.6 },
    // The mill on the pool's north-west bank, its wheel in the water; the landing stage on the west bank below it.
    { asset: 'watermill', x: 780, y: 1776, scale: 0.85 },
    { asset: 'dock', x: 655, y: 1982, scale: 0.9 },
    { asset: 'signpost', x: 600, y: 1890, scale: 0.6 },
    { asset: 'lantern', x: 470, y: 1900, scale: 0.5 },
    { asset: 'cherry-spring', x: 560, y: 1720, scale: 0.8 },
    { asset: 'fence', x: 345, y: 2092, scale: 0.7 }, { asset: 'fence', x: 425, y: 2097, scale: 0.7 }, { asset: 'fence', x: 505, y: 2101, scale: 0.7 },
    // The kitchen plots south of the village.
    { asset: 'vegetable-rows', x: 380, y: 2170, scale: 0.95 },
    { asset: 'crop-rows', x: 560, y: 2215, scale: 0.8, flip: true },
    // The orchard on its own slope, in rows.
    ...row('orchard-tree', 150, 1500, 370, 1490, 3, 0.7), ...row('orchard-tree', 170, 1600, 390, 1592, 3, 0.72), ...row('orchard-tree', 200, 1700, 360, 1696, 2, 0.7),
    // The lower river.
    { asset: 'foam-rapids', x: 1330, y: 1730, scale: 0.7 },
    { asset: 'willow', x: 1200, y: 1840, scale: 0.55 },
    { asset: 'heron', x: 1290, y: 2290, scale: 0.55 },
    // The old maple, alone in the open grass of the east bank.
    { asset: 'maple', x: 1700, y: 1880, scale: 1.35 },
    { asset: 'sparse-woodland', x: 1560, y: 2130, scale: 1 },
    { asset: 'forest-grove', x: 2010, y: 1640, scale: 0.9, flip: true },
    { asset: 'sparse-woodland', x: 600, y: 1330, scale: 0.85, flip: true },
  ],

  scatter: [
    // Flower drifts on Hanano and in the water meadow.
    { assets: [['wildflowers', 3], ['flower-meadow', 5]], blobs: [{ x: 1640, y: 560, r: 150 }, { x: 1800, y: 620, r: 110 }], count: 26, spacing: 52, scale: [0.75, 1.15] },
    { assets: [['wildflowers', 2], ['moss-grasses', 2]], blobs: [{ x: 1080, y: 1520, r: 140 }], count: 8, spacing: 80, scale: [0.5, 0.8] },
    // Reeds in the marsh on the lower river.
    { assets: [['wetland-reeds', 4], ['reedbed', 3], ['marsh', 2]], blobs: [{ x: 1370, y: 2270, r: 170 }, { x: 1600, y: 2420, r: 200 }, { x: 420, y: 2480, r: 150 }], count: 34, spacing: 80, scale: [0.6, 1] },
    // A few stones and shrubs on the open grass, sparing.
    { assets: [['shrubs', 3], ['mossy-boulder', 1], ['wildflowers', 2]], blobs: [{ x: 1720, y: 1680, r: 200 }, { x: 700, y: 1330, r: 160 }], count: 12, spacing: 110, scale: [0.5, 0.85] },
  ],

  banks: [
    { channel: 'main', assets: [['river-stones', 4], ['mossy-boulder', 3], ['small-rocks', 3], ['large-rock', 1]], every: 44, offset: [-8, 12], scale: [0.4, 0.78], spacing: 20 },
    { channel: 'main', assets: [['bank-vegetation', 4], ['wetland-reeds', 3], ['moss-grasses', 2]], every: 80, offset: [30, 54], scale: [0.5, 0.85], spacing: 26 },
    { channel: 'main', assets: [['cliff-decoration', 3], ['large-rock', 3], ['mossy-boulder', 2]], every: 34, offset: [8, 56], scale: [0.7, 1.1], span: [0.2, 0.36] },
    { channel: 'brook', assets: [['river-stones', 3], ['small-rocks', 3], ['mossy-boulder', 1]], every: 50, offset: [-5, 8], scale: [0.34, 0.6], spacing: 17 },
    { channel: 'brook', assets: [['bank-vegetation', 3], ['moss-grasses', 2]], every: 96, offset: [30, 44], scale: [0.45, 0.7], spacing: 22 },
  ],

  flight: 940,
  hearths: [{ x: 283, y: 1992 }],

  journeys: [
    { id: 'blossom-walk', traveller: 'villager', from: 'seseragi', to: 'ukishima', seasons: [SPRING, AUTUMN], every: 9 },
    { id: 'salmon-run', traveller: 'fish', from: 'seseragi-foot', to: 'seseragi-pool', seasons: [SPRING], every: 6 },
    { id: 'deer-woods', traveller: 'deer', from: 'kamimori', to: 'shimomori', seasons: ALL_YEAR, every: 8 },
    { id: 'deer-meadow', traveller: 'deer', from: 'kamimori', to: 'hanano', seasons: [SUMMER], every: 8 },
    { id: 'hay-walk', traveller: 'villager', from: 'seseragi', to: 'hanano', seasons: [SUMMER], every: 9 },
    { id: 'swans', traveller: 'bird', from: 'kagami', to: 'ashihara', seasons: [AUTUMN], every: 8 },
  ],

  // The year's wishes, in the order the seasons bring them.
  objectives: [
    {
      id: 'blossom-viewing', title: 'Blossom Viewing', journey: 'blossom-walk', season: SPRING, count: 3,
      text: 'The village walks out to the cherries at Ukishima Shrine.',
      story: 'When the cherries opened on Ukishima Shrine, the whole village walked out to sit beneath them.',
      flourish: [{ asset: 'lantern', x: 1250, y: 1500, scale: 0.5 }, { asset: 'lantern', x: 1400, y: 1500, scale: 0.5, flip: true }, { asset: 'flower-meadow', x: 1320, y: 1520, scale: 0.7 }],
    },
    {
      id: 'salmon-run', title: 'The Salmon Run', journey: 'salmon-run', season: SPRING, count: 3,
      text: 'Cherry salmon swim up the river to Fuchi.',
      story: 'The salmon came up the river on the melt and climbed past the village to spawn in Fuchi.',
      flourish: [{ asset: 'heron', x: 840, y: 1090, scale: 0.55 }, { asset: 'water-ripples', x: 900, y: 1010, scale: 0.8 }, { asset: 'water-ripples', x: 960, y: 1050, scale: 0.6 }],
    },
    {
      id: 'first-green', title: 'First Green', journey: 'deer-woods', season: SPRING, count: 3,
      text: 'Deer cross from Kamimori to Shimomori.',
      story: 'With the first green the deer went over the high stones and down to Shimomori.',
      flourish: [{ asset: 'wildflowers', x: 1640, y: 1060, scale: 0.8 }, { asset: 'flower-meadow', x: 1600, y: 1140, scale: 0.8 }],
    },
    {
      id: 'summer-grazing', title: 'Summer Grazing', journey: 'deer-meadow', season: SUMMER, count: 3,
      text: 'Deer climb from Kamimori to the high meadow.',
      story: 'The herd spent the long days on Hanano, where the grass is sweetest.',
      flourish: [{ asset: 'deer', x: 1640, y: 590, scale: 0.7 }, { asset: 'deer', x: 1720, y: 560, scale: 0.6, flip: true }],
    },
    {
      id: 'hay-making', title: 'Hay Making', journey: 'hay-walk', season: SUMMER, count: 3,
      text: 'The village climbs to Hanano to cut the hay.',
      story: 'They cut the hay on Hanano and carried it home the long way round, so the deer were never troubled.',
      flourish: [{ asset: 'shed', x: 1790, y: 640, scale: 0.55 }, { asset: 'signpost', x: 1760, y: 680, scale: 0.55 }],
    },
    {
      id: 'moon-viewing', title: 'Moon Viewing', journey: 'blossom-walk', season: AUTUMN, count: 3,
      text: 'The village goes to Ukishima Shrine for the harvest moon.',
      story: 'On the night of the harvest moon they sat on the shrine knoll and watched it rise over the bend.',
      flourish: [{ asset: 'lantern', x: 1230, y: 1440, scale: 0.5 }, { asset: 'lantern', x: 1420, y: 1450, scale: 0.5, flip: true }],
    },
    {
      id: 'swans', title: 'The Swans Come Down', journey: 'swans', season: AUTUMN, count: 3,
      text: 'Swans fly from the high tarn to the marshes, resting on the way.',
      story: 'The swans came down the valley in the first cold, resting at Kamimori and the heron pool, and wintered in the reeds.',
      flourish: [{ asset: 'heron', x: 1440, y: 2250, scale: 0.6 }, { asset: 'wetland-reeds', x: 1330, y: 2240, scale: 0.7 }],
    },
    {
      id: 'winter-passage', title: 'The Winter Passage', journey: 'deer-woods', season: WINTER, count: 4,
      text: 'Deer reach the shelter of Shimomori below the snow.',
      story: 'When the snow closed the high stones, the deer crossed by the middle stones to the shelter of Shimomori.',
      flourish: [{ asset: 'deer', x: 1650, y: 1260, scale: 0.8 }, { asset: 'deer', x: 1690, y: 1290, scale: 0.66, flip: true }, { asset: 'deer', x: 1610, y: 1300, scale: 0.72 }],
    },
  ],

  // Solution A, six brushstrokes, in the order the seasons ask for the routes.
  solution: [
    // Spring: walk to the shrine round the dry side of the meadow, well clear of the heron pool.
    { type: 'path', from: 'seseragi', to: 'ukishima', control: [{ x: 560, y: 1560 }, { x: 760, y: 1330 }, { x: 1040, y: 1310 }] },
    // Spring: the deer by the high stones and the brook stones, leaving the middle stones to the salmon.
    { type: 'corridor', from: 'kamimori', to: 'shimomori', control: [{ x: 760, y: 560 }, { x: 1052, y: 432 }, { x: 1260, y: 700 }, { x: 1420, y: 956 }, { x: 1620, y: 1080 }] },
    // Summer: up to Hanano by the high stones.
    { type: 'corridor', from: 'kamimori', to: 'hanano', control: [{ x: 740, y: 520 }, { x: 1052, y: 432 }, { x: 1400, y: 480 }] },
    // Summer: the haymakers over the low stones and round behind Shimomori.
    { type: 'path', from: 'seseragi', to: 'hanano', control: [{ x: 540, y: 2300 }, { x: 780, y: 2310 }, { x: 900, y: 2214 }, { x: 1060, y: 2120 }, { x: 1220, y: 2060 }, { x: 1780, y: 1640 }, { x: 2090, y: 1300 }, { x: 2110, y: 900 }, { x: 1950, y: 680 }] },
    // Winter: below the snow, over the middle stones.
    { type: 'corridor', from: 'kamimori', to: 'shimomori', control: [{ x: 780, y: 1180 }, { x: 960, y: 1210 }, { x: 1072, y: 1178 }, { x: 1180, y: 1120 }, { x: 1400, y: 1150 }, { x: 1600, y: 1180 }] },
  ],

  par: 7,
  years: 2,
  opening: 'The cherries are out on Ukishima Shrine. Draw a walk from Seseragi to the shrine.',
};

/**
 * Reach II: Mio, "the waterway". Belonging and creation: orchard country.
 *
 * Drawn in valley coordinates (y 2500 at the foot of Seseragi, 4500 where the
 * reedlands of Kawagiri begin), so every landmark carries the same numbers as
 * the journey that visits it. `intoOwnFrame` moves it into its own frame.
 *
 * COMPOSITION, from the top:
 *
 *   - The river leaves Seseragi broad and lively and swings east in a wide bend,
 *     with a stony gravel bar on its inside bank and a willow islet in mid-stream.
 *     A brook comes down from the eastern hills to meet it.
 *   - On the warm western slope the old orchard stands in terraced rows, with the
 *     keeper's hut at its top and hives at its foot. The road from Seseragi passes
 *     below it on the way into the village.
 *   - Mio village: the lantern house (the inn) facing a shared yard with a well and
 *     a hearth, a farmhouse with sheep on the hill pasture, cottages spaced apart,
 *     and an empty plot beside the yard where a new cottage can go up.
 *   - Below the village the land steps down in rice terraces and vegetable plots,
 *     with footpaths on the bunds between them, toward the river.
 *   - The willow mill on the west bank, where the river turns into the narrows; a
 *     timber weir holds the mill pool. The narrows are where a footbridge can cross
 *     to the far-bank garden and the east farm with its fields.
 *   - A wayside shrine stands where the charcoal burners' track leaves the road
 *     for the western woods.
 *   - The river sweeps west in the long bend, reedy and slow, with a gravel point bar
 *     on its inside and an old boat drawn up in the reeds; then on into Kawagiri.
 *
 *   Woods are shaped masses on the valley sides (the ridges rise to west and east),
 *   with open meadow on the valley floor. The through road runs the west bank from
 *   Seseragi to Kawagiri without crossing the river.
 */

import { type BoardDef, AUTUMN, SPRING } from '../types';
import { along, bar, intoOwnFrame, pts, row } from './layout';
import { seseragi } from './seseragi';

/** Where Mio begins and ends in the valley. */
export const MIO_TOP = 2500;
export const MIO_BOTTOM = 4500;

// ── Fields ──────────────────────────────────────────────────────────────────

/** Rice terraces below the village: three steps of paddies falling toward the river. */
const PADDY_COLUMNS = [410, 510, 610];
const PADDY_ROWS = [3400, 3472, 3546];
const PADDIES = PADDY_ROWS.flatMap((y, r) =>
  PADDY_COLUMNS.map((x, c) => ({ asset: 'rice-paddy', x: x - r * 14 + (c === 1 ? 4 : 0), y: y + (c - 1) * 5, scale: 0.6, flip: (r + c) % 2 === 1 })),
);


// ── The board ───────────────────────────────────────────────────────────────

const valley: BoardDef = {
  ...seseragi,
  id: 'mio',
  name: 'Mio',
  subtitle: 'Orchards and the long bend',
  height: MIO_BOTTOM - MIO_TOP,
  hills: [],
  zones: [],
  fords: [],
  journeys: [],
  objectives: [],
  solution: [],
  weirs: [],
  opening: 'Follow the river.',

  relief: [
    // The valley sides, carrying on from Seseragi's ridges and falling away toward the sea.
    { x: -300, y: 2750, r: 640, h: 0.26 }, { x: -340, y: 3500, r: 680, h: 0.24 }, { x: -300, y: 4300, r: 640, h: 0.2 },
    { x: 2520, y: 2700, r: 640, h: 0.24 }, { x: 2560, y: 3500, r: 680, h: 0.26 }, { x: 2500, y: 4300, r: 620, h: 0.2 },
    // The orchard's warm slope, and the low rise the village stands on.
    { x: 190, y: 2800, r: 380, h: 0.13 }, { x: 380, y: 3170, r: 260, h: 0.05 },
    // The charcoal burners' hill in the western woods.
    { x: 60, y: 3760, r: 320, h: 0.1 },
    // The east farm's knoll, and the lookout hill above its fields.
    { x: 1830, y: 3260, r: 300, h: 0.07 }, { x: 1980, y: 3720, r: 330, h: 0.11 },
    // A shoulder of the eastern hills where the brook comes down.
    { x: 2050, y: 2780, r: 300, h: 0.08 },
  ],

  channels: [
    {
      id: 'main',
      points: [
        // Out of Seseragi and into the broad eastern bend.
        [1100, 2500, 150], [1125, 2620, 165], [1180, 2760, 190], [1225, 2900, 215], [1215, 3040, 225],
        // Running south-west past the village toward the mill.
        [1150, 3180, 215], [1065, 3310, 190], [995, 3420, 160], [985, 3490, 140],
        // The narrows, where the footbridge can cross.
        [1040, 3550, 112], [1090, 3600, 104], [1110, 3680, 140],
        // The long bend, sweeping west and back.
        [1060, 3800, 185], [930, 3920, 210], [820, 4040, 230], [800, 4160, 235], [880, 4290, 235], [1010, 4400, 235],
        [1100, 4500, 240], [1120, 4600, 260],
      ],
    },
    {
      id: 'brook',
      points: [
        [3050, 2850, 14], [2840, 2905, 18], [2640, 2875, 22], [2470, 2945, 25], [2300, 2995, 28], [2140, 2955, 30],
        [1980, 3010, 33], [1840, 3075, 36], [1700, 3040, 38], [1560, 3092, 42], [1430, 3066, 46], [1310, 3080, 52],
      ],
    },
  ],

  islands: [
    // The gravel bar on the inside of the upper bend.
    ...bar(1118, 2840, 1100, 3010, 84, 6),
    // The willow islet in mid-stream.
    ...bar(1244, 3005, 1262, 3080, 70, 4),
    // The point bar on the inside of the long bend.
    ...bar(915, 4020, 936, 4190, 96, 6),
  ],
  shallows: [
    { x: 1150, y: 2940, r: 80 }, { x: 1250, y: 3045, r: 60 },
    // Over the weir and below it.
    { x: 990, y: 3470, r: 60 },
    { x: 1300, y: 3075, r: 50 },
    { x: 890, y: 4110, r: 80 }, { x: 930, y: 4240, r: 60 },
  ],

  places: [
    { id: 'mio-orchard', name: 'Old orchard', kind: 'orchard', x: 440, y: 2820, radius: 150, links: ['path'], note: 'Fruit trees in terraced rows on a warm slope.' },
    { id: 'mio-hamlet', name: 'Mio', kind: 'village', x: 610, y: 3190, radius: 150, links: ['path'], note: 'An orchard village beside the middle river.' },
    { id: 'mio-terraces', name: 'The rice terraces', kind: 'fields', x: 450, y: 3500, radius: 140, links: ['path'], note: 'Paddies stepping down toward the river.' },
    { id: 'mio-kiln', name: 'The charcoal clearing', kind: 'terrace', x: 90, y: 3700, radius: 110, links: [], note: 'A kiln smokes in a clearing in the western woods.' },
    { id: 'mio-farm', name: 'The east farm', kind: 'village', x: 1870, y: 3310, radius: 120, links: ['path'], note: 'A farmhouse on the far bank, with oxen in the meadow.' },
    { id: 'mio-garden', name: 'The far-bank garden', kind: 'meadow', x: 1570, y: 3570, radius: 120, links: ['path'], note: 'Wild flowers beside the old crossing.' },
  ],

  floodplains: [
    // The long bend's reedy meadow, and the point bar opposite: under water with the melt and the autumn rains.
    { id: 'bend-meadow', name: 'the reedy bend', floods: [SPRING, AUTUMN], blobs: [{ x: 690, y: 4110, r: 120 }, { x: 640, y: 4030, r: 90 }, { x: 740, y: 4210, r: 90 }] },
    { id: 'point-bar', name: 'the point bar', floods: [SPRING], blobs: [{ x: 935, y: 4110, r: 56 }] },
  ],

  patches: [
    // The orchard, the yard round the inn, the far-bank garden.
    { material: 'orchard', blobs: [{ x: 440, y: 2820, r: 250 }, { x: 330, y: 2740, r: 170 }, { x: 1570, y: 3570, r: 150 }, { x: 2040, y: 3640, r: 150 }] },
    // Wet ground: the head of the reach, the long bend, the brook mouth, the east backwater.
    {
      material: 'wetland',
      blobs: [
        { x: 470, y: 2540, r: 130 }, { x: 620, y: 4080, r: 180 }, { x: 720, y: 4200, r: 150 }, { x: 520, y: 3990, r: 110 },
        { x: 1360, y: 3110, r: 80 }, { x: 1260, y: 4380, r: 170 }, { x: 640, y: 4400, r: 120 },
      ],
    },
    // Rock at the narrows and on the lookout hill.
    { material: 'rocky', blobs: [{ x: 960, y: 3560, r: 80 }, { x: 1185, y: 3600, r: 80 }, { x: 1960, y: 3680, r: 110 }, { x: 160, y: 2660, r: 120 }] },
  ],

  woods: [
    // The western ridge: one long wood in two masses, darker toward the ridge.
    { kind: 'mixed', spacing: 120, scale: 1, blobs: [{ x: -280, y: 2740, r: 260 }, { x: -60, y: 2900, r: 150 }, { x: -320, y: 3040, r: 240 }, { x: -140, y: 2620, r: 150 }] },
    // The charcoal burners' wood, wrapped round its clearing.
    { kind: 'mixed', spacing: 110, scale: 0.95, blobs: [{ x: -140, y: 3600, r: 230 }, { x: 60, y: 3540, r: 130 }, { x: -40, y: 3880, r: 200 }, { x: 170, y: 3880, r: 110 }, { x: -320, y: 3760, r: 220 }] },
    // Pines on the west shoulder above the long bend.
    { kind: 'pine', spacing: 130, scale: 0.9, blobs: [{ x: 120, y: 4250, r: 110 }] },
    { kind: 'mixed', spacing: 140, scale: 1.05, blobs: [{ x: -320, y: 4300, r: 240 }, { x: -200, y: 4460, r: 140 }] },
    // A copse below the orchard, between the road and the river.
    { kind: 'broadleaf', spacing: 92, scale: 0.7, blobs: [{ x: 930, y: 2710, r: 60 }, { x: 870, y: 2760, r: 50 }] },
    // The eastern hills: broadleaf woods carrying on from Seseragi's, with the brook between them.
    { kind: 'broadleaf', spacing: 110, scale: 0.95, blobs: [{ x: 2300, y: 2620, r: 250 }, { x: 2060, y: 2580, r: 150 }, { x: 2420, y: 2860, r: 160 }] },
    { kind: 'mixed', spacing: 120, scale: 1, blobs: [{ x: 2420, y: 3300, r: 260 }, { x: 2250, y: 3460, r: 150 }, { x: 2560, y: 3500, r: 220 }] },
    { kind: 'broadleaf', spacing: 110, scale: 0.95, blobs: [{ x: 2230, y: 4050, r: 240 }, { x: 1980, y: 4120, r: 160 }, { x: 2420, y: 4280, r: 220 }, { x: 1800, y: 4200, r: 100 }] },
    // Pines on the lookout hill.
    { kind: 'pine', spacing: 120, scale: 0.85, blobs: [{ x: 2090, y: 3810, r: 90 }] },
    // A copse by the far-bank garden.
    { kind: 'broadleaf', spacing: 90, scale: 0.75, blobs: [{ x: 1720, y: 3700, r: 80 }] },
  ],

  outcrops: [
    // Stones gathered at the narrows, clear of where the footbridge lands.
    { x: 955, y: 3540, size: 7, spread: 70 }, { x: 1170, y: 3530, size: 6, spread: 60 }, { x: 1020, y: 3650, size: 5, spread: 55 }, { x: 1195, y: 3655, size: 6, spread: 60 },
    // Above the orchard and on the lookout hill.
    { x: 150, y: 2650, size: 5, spread: 70 }, { x: 1950, y: 3640, size: 5, spread: 60 },
    // Old stones in the reeds at the long bend.
    { x: 520, y: 4170, size: 4, spread: 50 },
    // Where the brook comes out of the hills.
    { x: 2200, y: 2950, size: 5, spread: 60 },
  ],

  lanes: [
    // The road from Seseragi, below the orchard and into the village yard.
    { width: 40, wear: .85, ruts: true, points: pts(760, 2500, 720, 2560, 630, 2630, 650, 2740, 690, 2830, 640, 2930, 560, 3030, 540, 3130, 600, 3225) },
    // The road on south: past the fields and the mill, the wayside shrine, the long bend, into Kawagiri.
    { points: pts(600, 3225, 700, 3255, 760, 3330, 720, 3440, 715, 3560, 690, 3700, 610, 3790, 570, 3900, 590, 4040, 560, 4200, 520, 4350, 480, 4500, 470, 4560) },
    // The orchard walk between the terraces, to the keeper's hut.
    { width: 26, points: pts(690, 2830, 560, 2815, 440, 2825, 330, 2840, 270, 2880) },
    // The shared yard in front of the lantern house, and the well.
    { width: 70, points: pts(560, 3235, 640, 3250, 700, 3245) },
    // To the cottage and on round to the farmhouse door.
    { width: 26, points: pts(560, 3030, 470, 3072, 390, 3118, 345, 3165, 270, 3172) },
    { width: 26, points: pts(700, 3255, 790, 3200, 840, 3120) },
    // The mill yard.
    { width: 34, points: pts(718, 3490, 790, 3500, 840, 3492) },
    // Down to the narrows, where a footbridge can cross.
    { width: 30, points: pts(715, 3560, 840, 3585, 940, 3592, 1005, 3592) },
    // One footpath along the terraces from the road.
    { width: 16, points: pts(715, 3600, 560, 3605, 420, 3600, 330, 3612) },
    // The wayside shrine, and the charcoal burners' track into the western woods.
    { width: 22, points: pts(610, 3790, 530, 3775, 470, 3770) },
    { width: 24, points: pts(470, 3770, 350, 3760, 230, 3730, 130, 3705) },
    // Through the reeds to the old boat at the long bend.
    { width: 20, points: pts(590, 4040, 625, 4080, 640, 4100) },
    // The far bank: from the footbridge to the garden and on to the east farm.
    { width: 30, points: pts(1175, 3585, 1320, 3565, 1460, 3575, 1570, 3570, 1660, 3470, 1760, 3380, 1850, 3330) },
    // From the east farm up to its fields.
    { width: 22, points: pts(1850, 3330, 1950, 3420, 2000, 3500) },
  ],

  sprites: [
    // ── The orchard: terraced rows on the warm slope, the keeper's hut, the hives.
    ...along('orchard-tree', pts(300, 2690, 420, 2675, 560, 2690, 650, 2715), 96, 0.64, 11),
    ...along('orchard-tree', pts(280, 2765, 420, 2752, 560, 2762, 640, 2780), 96, 0.66, 12),
    ...along('orchard-tree', pts(300, 2905, 430, 2895, 560, 2900, 630, 2915), 96, 0.66, 13),
    ...along('orchard-tree', pts(330, 2975, 440, 2970, 540, 2978), 96, 0.64, 14),
    { asset: 'shed', x: 255, y: 2862, scale: 0.6 },
    { asset: 'beehive', x: 205, y: 2900, scale: 0.9 }, { asset: 'beehive', x: 228, y: 2915, scale: 0.85, flip: true },
    { asset: 'haystack', x: 330, y: 2620, scale: 0.8 },
    { asset: 'large-rock', x: 190, y: 2740, scale: 0.7 },

    // ── Mio village: the lantern house on its yard, cottages spaced apart.
    { asset: 'timber-cottage', x: 665, y: 3170, scale: 0.78 },
    { asset: 'lantern', x: 612, y: 3192, scale: 0.5 }, { asset: 'lantern', x: 724, y: 3192, scale: 0.5, flip: true },
    { asset: 'well', x: 655, y: 3305, scale: 0.9 },
    { asset: 'signpost', x: 548, y: 3200, scale: 0.6 },
    { asset: 'cottage', x: 410, y: 3062, scale: 0.62, flip: true },
    { asset: 'cottage', x: 845, y: 3108, scale: 0.6 },
    { asset: 'shed', x: 935, y: 3140, scale: 0.55, flip: true },
    { asset: 'farmhouse', x: 230, y: 3152, scale: 0.7 },
    { asset: 'cherry-spring', x: 500, y: 3150, scale: 0.6 },
    { asset: 'maple', x: 790, y: 2990, scale: 0.7 },
    { asset: 'sparse-woodland', x: 980, y: 3240, scale: 0.6 },
    // The hill pasture behind the farmhouse, fenced, with the flock.
    ...row('fence', 60, 3250, 330, 3262, 4, 0.62),
    ...row('fence', 340, 3290, 340, 3420, 2, 0.6),
    { asset: 'sheep-0', x: 230, y: 3330, scale: 1 }, { asset: 'sheep-1', x: 290, y: 3360, scale: 1, flip: true },
    { asset: 'sheep-0', x: 330, y: 3310, scale: 0.95, flip: true }, { asset: 'sheep-1', x: 260, y: 3400, scale: 1 },
    { asset: 'sheep-0', x: 340, y: 3390, scale: 0.9 },

    // ── The rice terraces and plots, with a scarecrow and the drying rack.
    ...PADDIES,
    { asset: 'scarecrow', x: 555, y: 3505, scale: 0.9 },
    { asset: 'rice-drying-rack', x: 690, y: 3405, scale: 0.9 },
    { asset: 'haystack', x: 640, y: 3640, scale: 0.85 },
    { asset: 'haystack', x: 672, y: 3660, scale: 0.7, flip: true },
    // Kitchen plots and a grain strip below the terraces.
    { asset: 'vegetable-rows', x: 330, y: 3660, scale: 0.85 },
    { asset: 'crop-rows', x: 495, y: 3690, scale: 0.85, flip: true },

    // ── The willow mill on the west bank, its weir, the willows down to the narrows.
    { asset: 'watermill', x: 868, y: 3478, scale: 0.75 },
    { asset: 'willow', x: 772, y: 3580, scale: 0.6 },
    ...row('weir', 925, 3436, 1060, 3418, 2, 0.75),
    { asset: 'foam-rapids', x: 995, y: 3446, scale: 0.6 },
    { asset: 'willow', x: 905, y: 3640, scale: 0.6, flip: true }, { asset: 'willow', x: 870, y: 3760, scale: 0.65 }, { asset: 'willow', x: 1210, y: 3730, scale: 0.55 },
    { asset: 'foam-rapids', x: 1092, y: 3610, scale: 0.55, flip: true },
    { asset: 'signpost', x: 990, y: 3610, scale: 0.55 },

    // ── The wayside shrine where the woods track leaves the road.
    { asset: 'shrine', x: 470, y: 3752, scale: 0.42 },
    { asset: 'lantern', x: 505, y: 3790, scale: 0.45 },
    { asset: 'maple', x: 430, y: 3720, scale: 0.85 },
    { asset: 'charcoal-kiln', x: 95, y: 3700, scale: 1 },
    { asset: 'log', x: 150, y: 3735, scale: 0.6 }, { asset: 'branches', x: 50, y: 3740, scale: 0.7 },

    // ── The long bend: reeds, an old boat drawn up, the heron's corner.
    { asset: 'boat-beached', x: 668, y: 4118, scale: 0.9 },
    { asset: 'heron', x: 712, y: 4240, scale: 0.55 },
    { asset: 'lantern', x: 560, y: 4060, scale: 0.45 },
    { asset: 'willow', x: 470, y: 4120, scale: 0.6 },
    { asset: 'river-stones', x: 935, y: 4125, scale: 0.6 }, { asset: 'small-rocks', x: 918, y: 4070, scale: 0.6, flip: true },

    // ── The upper river: the gravel bar, the willow islet, the brook mouth.
    { asset: 'willow', x: 1252, y: 3046, scale: 0.42 },
    { asset: 'river-stones', x: 1110, y: 2935, scale: 0.6 }, { asset: 'small-rocks', x: 1100, y: 2990, scale: 0.55, flip: true }, { asset: 'river-stones', x: 1122, y: 2872, scale: 0.5 },
    { asset: 'maple', x: 1460, y: 2760, scale: 1.1 },
    { asset: 'heron', x: 1330, y: 3100, scale: 0.5, flip: true },

    // ── Kitsuneyama's hill shrine, above the far-bank garden.
    { asset: 'shrine', x: 1700, y: 3410, scale: 0.55 },
    { asset: 'lantern', x: 1725, y: 3450, scale: 0.38 },

    // ── The far bank: the garden by the crossing, the east farm and its fields.
    { asset: 'cherry-spring', x: 1500, y: 3520, scale: 0.75 }, { asset: 'cherry-spring', x: 1650, y: 3610, scale: 0.65, flip: true },
    { asset: 'lantern', x: 1540, y: 3600, scale: 0.5 }, { asset: 'lantern', x: 1610, y: 3545, scale: 0.45, flip: true },
    { asset: 'flower-meadow', x: 1570, y: 3640, scale: 0.9 }, { asset: 'flower-meadow', x: 1440, y: 3610, scale: 0.75, flip: true },
    { asset: 'farmhouse', x: 1890, y: 3290, scale: 0.72, flip: true },
    { asset: 'shed', x: 2010, y: 3330, scale: 0.55 },
    { asset: 'haystack', x: 1720, y: 3250, scale: 0.85 },
    ...row('fence', 1520, 3150, 1760, 3160, 4, 0.6),
    // The east farm's fields on the slope above it.
    { asset: 'crop-rows', x: 1990, y: 3560, scale: 0.9 }, { asset: 'crop-rows', x: 2120, y: 3585, scale: 0.85, flip: true },
    { asset: 'vegetable-rows', x: 2050, y: 3660, scale: 0.85 },
    { asset: 'haystack', x: 1930, y: 3620, scale: 0.8 },
    { asset: 'pine', x: 1970, y: 3700, scale: 0.75 },
  ],

  scatter: [
    // Flowers on the open meadows either side of the village.
    { assets: [['wildflowers', 3], ['flower-meadow', 2], ['moss-grasses', 1]], blobs: [{ x: 880, y: 2820, r: 170 }, { x: 1500, y: 2650, r: 180 }, { x: 1450, y: 3300, r: 160 }], count: 18, spacing: 70, scale: [0.5, 0.85] },
    // Reeds in the long bend and at the head of the reach.
    { assets: [['wetland-reeds', 4], ['reedbed', 2], ['marsh', 1]], blobs: [{ x: 640, y: 4100, r: 170 }, { x: 740, y: 4220, r: 120 }, { x: 470, y: 2550, r: 110 }, { x: 1260, y: 4380, r: 150 }], count: 30, spacing: 70, scale: [0.55, 0.95] },
    // A few shrubs and stones on open ground, sparing.
    { assets: [['shrubs', 3], ['mossy-boulder', 1], ['wildflowers', 2]], blobs: [{ x: 800, y: 3880, r: 120 }, { x: 1600, y: 4000, r: 200 }, { x: 330, y: 4380, r: 140 }], count: 12, spacing: 100, scale: [0.5, 0.85] },
  ],

  banks: [
    // Stones at the waterline, and bank plants above them, down the whole reach.
    { channel: 'main', assets: [['river-stones', 4], ['small-rocks', 3], ['mossy-boulder', 2]], every: 58, offset: [-8, 10], scale: [0.4, 0.72], spacing: 20 },
    { channel: 'main', assets: [['bank-vegetation', 4], ['moss-grasses', 2], ['wetland-reeds', 2], ['shrubs', 1]], every: 86, offset: [28, 54], scale: [0.5, 0.85], spacing: 26 },
    // Reeds standing in the slow water round the long bend.
    { channel: 'main', assets: [['wetland-reeds', 4], ['reedbed', 1]], every: 60, offset: [-10, 18], scale: [0.55, 0.9], spacing: 30, span: [0.62, 0.95] },
    { channel: 'brook', assets: [['river-stones', 3], ['small-rocks', 3], ['mossy-boulder', 1]], every: 80, offset: [-5, 8], scale: [0.34, 0.55], spacing: 20 },
    { channel: 'brook', assets: [['bank-vegetation', 3], ['moss-grasses', 2], ['wetland-reeds', 1]], every: 90, offset: [28, 42], scale: [0.45, 0.7], spacing: 22 },
  ],

  hearths: [{ x: 550, y: 3300 }, { x: 1850, y: 3395 }],
};

export const mio: BoardDef = intoOwnFrame(valley, MIO_TOP);

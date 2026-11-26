/**
 * A fixed valley for testing the rules: a stream with a gorge, two fords (one
 * snowed in over winter, one flooded in spring), two woods, a meadow, a
 * village and a terrace. It began as a copy of the first shipped valley and is
 * kept frozen, so the shipped valleys can be recomposed without rewriting tests.
 */

import { type Blob, type BoardDef, AUTUMN, SPRING, SUMMER, WINTER } from '../../world/types';

const column = (x: number, from: number, to: number, step: number, r: number): Blob[] => {
  const out: Blob[] = [];
  for (let y = from; y <= to; y += step) out.push({ x, y, r });
  return out;
};

const ALL_YEAR = [SPRING, SUMMER, AUTUMN, WINTER];

export const brook: BoardDef = {
  id: 'brook',
  name: 'Brook',
  subtitle: 'The murmuring stream',
  width: 1800,
  height: 2200,
  seed: 2086,
  snowAltitude: 0.66,
  hills: [
    { x: 300, y: 430, r: 400, h: 0.08 },
    { x: 1540, y: 300, r: 380, h: 0.09 },
  ],

  relief: [
    // Foothills stacking up toward the mountains.
    { x: 300, y: -160, r: 540, h: 0.34 }, { x: 900, y: -400, r: 660, h: 0.44 }, { x: 1520, y: -190, r: 540, h: 0.34 },
    // The ridges that wall the valley on either side.
    { x: -260, y: 260, r: 560, h: 0.26 }, { x: -320, y: 1080, r: 600, h: 0.24 }, { x: -260, y: 1900, r: 560, h: 0.18 },
    { x: 2060, y: 180, r: 560, h: 0.26 }, { x: 2120, y: 1000, r: 600, h: 0.24 }, { x: 2060, y: 1820, r: 560, h: 0.17 },
    // Upland shoulders.
    { x: 330, y: 300, r: 430, h: 0.17 }, { x: 1560, y: 230, r: 430, h: 0.18 },
    // The rise Kamimori stands on, and the knoll that shelters Shimomori.
    { x: 250, y: 880, r: 380, h: 0.14 }, { x: 1640, y: 1010, r: 350, h: 0.16 },
    // Bluffs either side of the gorge.
    { x: 680, y: 1070, r: 210, h: 0.11 }, { x: 1020, y: 1100, r: 200, h: 0.11 },
    // The cherry terrace and the high meadow.
    { x: 1440, y: 1810, r: 250, h: 0.08 }, { x: 1330, y: 630, r: 220, h: 0.06 },
  ],

  channels: [
    {
      id: 'main',
      points: [
        [1040, -700, 44], [1000, -380, 50], [930, -80, 58], [965, 150, 64], [1090, 360, 96],
        // The high stones: the stream spreads wide and shallow.
        [1010, 610, 128],
        // The gorge.
        [880, 800, 76], [800, 1000, 60], [880, 1210, 62], [1030, 1390, 86],
        // The low stones, a narrower reach, then the village pool.
        [1030, 1570, 150], [960, 1710, 96], [840, 1900, 236], [800, 2060, 170],
        [890, 2230, 190], [1000, 2440, 320], [1000, 2800, 660],
      ],
    },
    {
      id: 'brook',
      points: [[1960, 270, 28], [1640, 420, 32], [1400, 470, 36], [1200, 440, 42], [1085, 388, 46]],
    },
  ],
  islands: [
    { x: 842, y: 1906, r: 46 },
    { x: 806, y: 2074, r: 30 },
  ],
  shallows: [
    { x: 1090, y: 360, r: 90 },
    { x: 890, y: 2230, r: 150 },
  ],

  fords: [
    { id: 'high-ford', name: 'the high stones', x: 1010, y: 610, radius: 84, floods: [] },
    { id: 'low-ford', name: 'the low stones', x: 1030, y: 1570, radius: 92, floods: [SPRING] },
  ],
  maxBridgeSpan: 150,

  zones: [
    {
      id: 'gorge',
      name: 'the gorge',
      reason: 'The gorge is too steep to cross.',
      blobs: [
        { x: 872, y: 850, r: 82 }, { x: 832, y: 925, r: 84 }, { x: 800, y: 1000, r: 86 }, { x: 820, y: 1080, r: 84 },
        { x: 852, y: 1150, r: 84 }, { x: 885, y: 1215, r: 84 }, { x: 940, y: 1290, r: 80 }, { x: 995, y: 1350, r: 72 },
      ],
    },
  ],

  places: [
    {
      id: 'kamimori', name: 'Kamimori', kind: 'forest', x: 430, y: 1000, radius: 200, links: ['corridor'],
      note: 'The upper wood, where the deer spend the warm months.',
    },
    {
      id: 'shimomori', name: 'Shimomori', kind: 'forest', x: 1420, y: 1120, radius: 205, links: ['corridor'],
      note: 'A sheltered wood below the ridge. Deer winter here.',
    },
    {
      id: 'hanano', name: 'Hanano', kind: 'meadow', x: 1320, y: 640, radius: 120, links: ['corridor', 'path'],
      note: 'A high meadow, sweet in summer and buried in winter.',
    },
    {
      id: 'seseragi', name: 'Seseragi', kind: 'village', x: 470, y: 1740, radius: 140, links: ['path'],
      note: 'Three roofs, a mill on the pool, and a kettle always on.',
    },
    {
      id: 'sakura', name: 'Sakura-daira', kind: 'terrace', x: 1400, y: 1800, radius: 130, links: ['path', 'corridor'],
      note: 'The cherry terrace. The village walks here when the blossom opens.',
    },
  ],

  // Woodland floor is laid automatically under `woods`; these are the other grounds.
  patches: [
    { material: 'rocky', blobs: [{ x: 200, y: 20, r: 430 }, { x: 760, y: -80, r: 460 }, { x: 1320, y: 0, r: 430 }, { x: 1800, y: 40, r: 380 }, ...column(900, -700, -200, 250, 900)] },
    { material: 'scree', blobs: [{ x: 872, y: 850, r: 124 }, { x: 820, y: 950, r: 140 }, { x: 800, y: 1050, r: 144 }, { x: 850, y: 1160, r: 138 }, { x: 905, y: 1250, r: 132 }, { x: 985, y: 1340, r: 112 }] },
    { material: 'scree', blobs: [{ x: 960, y: 150, r: 90 }] },
    { material: 'wetland', blobs: [{ x: 1150, y: 2140, r: 190 }, { x: 640, y: 2200, r: 180 }, { x: 1260, y: 2380, r: 270 }, { x: 600, y: 2450, r: 290 }] },
    { material: 'orchard', blobs: [{ x: 430, y: 1960, r: 190 }, { x: 470, y: 1750, r: 150 }, { x: 1400, y: 1800, r: 170 }] },
  ],

  woods: [
    // Kamimori and the forest it belongs to, running up the western side of the valley.
    { kind: 'mixed', spacing: 104, scale: 1, blobs: [{ x: 430, y: 1000, r: 240 }, { x: 240, y: 860, r: 270 }, { x: 110, y: 1180, r: 250 }, { x: 80, y: 560, r: 300 }] },
    // Shimomori and the eastern forest.
    { kind: 'mixed', spacing: 104, scale: 1, blobs: [{ x: 1420, y: 1120, r: 245 }, { x: 1620, y: 980, r: 280 }, { x: 1730, y: 1330, r: 250 }, { x: 1760, y: 680, r: 300 }] },
    // Forest climbing the ridges beyond the valley floor: larger trees, set wider.
    { kind: 'mixed', spacing: 150, scale: 1.2, blobs: [...column(-400, -200, 2700, 300, 410), { x: 130, y: 2180, r: 230 }] },
    { kind: 'mixed', spacing: 150, scale: 1.2, blobs: [...column(2200, -200, 2700, 300, 410), { x: 1730, y: 2040, r: 250 }] },
    // Pines on the upland shoulders and thinning into the foothills.
    { kind: 'pine', spacing: 128, scale: 0.86, blobs: [{ x: 260, y: 270, r: 270 }, { x: 640, y: 150, r: 220 }, { x: 1260, y: 110, r: 210 }, { x: 1570, y: 290, r: 270 }] },
    { kind: 'pine', spacing: 170, scale: 0.8, blobs: [{ x: 900, y: -160, r: 560 }] },
    // Copses in the open valley.
    { kind: 'broadleaf', spacing: 92, scale: 0.8, blobs: [{ x: 690, y: 1500, r: 100 }] },
    { kind: 'broadleaf', spacing: 92, scale: 0.8, blobs: [{ x: 1230, y: 1510, r: 105 }] },
    { kind: 'broadleaf', spacing: 92, scale: 0.78, blobs: [{ x: 600, y: 600, r: 110 }] },
    { kind: 'broadleaf', spacing: 96, scale: 0.8, blobs: [{ x: 1190, y: 2040, r: 105 }] },
  ],

  outcrops: [
    { x: 770, y: 480, size: 6, spread: 80 }, { x: 1200, y: 780, size: 5, spread: 70 }, { x: 560, y: 1340, size: 5, spread: 66 },
    { x: 1250, y: 260, size: 7, spread: 90 }, { x: 500, y: 250, size: 7, spread: 90 }, { x: 1580, y: 560, size: 4, spread: 60 },
    { x: 700, y: 2100, size: 4, spread: 56 }, { x: 1010, y: 240, size: 6, spread: 70 },
    // The rims of the gorge.
    { x: 720, y: 930, size: 6, spread: 70 }, { x: 930, y: 1040, size: 6, spread: 70 }, { x: 760, y: 1180, size: 6, spread: 70 }, { x: 1010, y: 1250, size: 5, spread: 64 },
  ],

  lanes: [
    { points: [{ x: 385, y: 1735 }, { x: 470, y: 1770 }, { x: 556, y: 1752 }] },
    { points: [{ x: 470, y: 1770 }, { x: 462, y: 1848 }, { x: 430, y: 1960 }] },
    { points: [{ x: 556, y: 1752 }, { x: 640, y: 1796 }, { x: 706, y: 1856 }] },
    { points: [{ x: 1338, y: 1836 }, { x: 1404, y: 1806 }, { x: 1466, y: 1836 }] },
  ],

  sprites: [
    // Seseragi village, in its clearing beside the pool.
    { asset: 'farmhouse', x: 385, y: 1708 },
    { asset: 'timber-cottage', x: 556, y: 1724, scale: 0.9 },
    { asset: 'cottage', x: 462, y: 1826, scale: 0.92 },
    { asset: 'shed', x: 318, y: 1804, scale: 0.6 },
    { asset: 'lantern', x: 496, y: 1764, scale: 0.5 },
    { asset: 'signpost', x: 612, y: 1780, scale: 0.6 },
    { asset: 'watermill', x: 712, y: 1846, scale: 0.9 },
    { asset: 'cherry-spring', x: 640, y: 1652, scale: 0.8 },
    // The orchard behind the village, planted in rows.
    { asset: 'fence', x: 300, y: 1900, scale: 0.7 }, { asset: 'fence', x: 380, y: 1900, scale: 0.7 }, { asset: 'fence', x: 540, y: 1900, scale: 0.7 },
    { asset: 'orchard-tree', x: 300, y: 1970, scale: 0.74 }, { asset: 'orchard-tree', x: 392, y: 1968, scale: 0.7, flip: true },
    { asset: 'orchard-tree', x: 484, y: 1972, scale: 0.76 }, { asset: 'orchard-tree', x: 576, y: 1968, scale: 0.7, flip: true },
    { asset: 'orchard-tree', x: 346, y: 2052, scale: 0.72, flip: true }, { asset: 'orchard-tree', x: 438, y: 2054, scale: 0.76 },
    { asset: 'orchard-tree', x: 530, y: 2050, scale: 0.7 },
    // Sakura-daira, the cherry terrace.
    { asset: 'shrine', x: 1404, y: 1776, scale: 0.85 },
    { asset: 'lantern', x: 1350, y: 1818, scale: 0.5 },
    { asset: 'lantern', x: 1456, y: 1818, scale: 0.5, flip: true },
    { asset: 'cherry-spring', x: 1290, y: 1756 },
    { asset: 'cherry-spring', x: 1512, y: 1748, scale: 0.9, flip: true },
    { asset: 'cherry-spring', x: 1330, y: 1906, scale: 0.86 },
    { asset: 'cherry-spring', x: 1500, y: 1886, scale: 0.95 },
    { asset: 'cherry-spring', x: 1230, y: 1850, scale: 0.8, flip: true },
    // The river.
    { asset: 'waterfall', x: 956, y: 176, scale: 1.7 },
    { asset: 'foam-rapids', x: 806, y: 1000, scale: 0.8 },
    { asset: 'foam-rapids', x: 876, y: 1214, scale: 0.8, flip: true },
    { asset: 'foam-rapids', x: 1004, y: 1368, scale: 0.7 },
    { asset: 'foam-rapids', x: 1090, y: 330, scale: 0.6, flip: true },
    { asset: 'foam-rapids', x: 884, y: 792, scale: 0.7 },
    // The islet in the village pool.
    { asset: 'willow', x: 842, y: 1912, scale: 0.6 },
    { asset: 'wetland-reeds', x: 812, y: 1926, scale: 0.6 },
    { asset: 'wetland-reeds', x: 872, y: 1920, scale: 0.55, flip: true },
    { asset: 'river-stones', x: 806, y: 2078, scale: 0.7 },
    { asset: 'willow', x: 1010, y: 1960, scale: 0.8 },
    { asset: 'heron', x: 1010, y: 2210, scale: 0.55 },
    { asset: 'heron', x: 760, y: 2260, scale: 0.5, flip: true },
  ],

  scatter: [
    // Flowers gather in drifts rather than dotting the whole meadow.
    { assets: [['wildflowers', 3], ['flower-meadow', 4]], blobs: [{ x: 1320, y: 640, r: 135 }], count: 13, spacing: 60, scale: [0.6, 0.95] },
    { assets: [['wildflowers', 3], ['flower-meadow', 3], ['moss-grasses', 2]], blobs: [{ x: 640, y: 760, r: 150 }, { x: 1180, y: 1700, r: 150 }, { x: 610, y: 1380, r: 130 }], count: 26, spacing: 64, scale: [0.6, 0.95] },
    { assets: [['wetland-reeds', 4], ['reedbed', 3], ['marsh', 2]], blobs: [{ x: 1150, y: 2140, r: 180 }, { x: 640, y: 2200, r: 170 }, { x: 1260, y: 2380, r: 250 }, { x: 600, y: 2450, r: 270 }], count: 44, spacing: 74, scale: [0.6, 1] },
  ],

  banks: [
    // Boulders line the banks and stand in the shallows, as rivers in this country do.
    { channel: 'main', assets: [['river-stones', 4], ['mossy-boulder', 3], ['small-rocks', 3], ['large-rock', 1]], every: 38, offset: [-9, 10], scale: [0.4, 0.78], spacing: 19 },
    { channel: 'main', assets: [['bank-vegetation', 4], ['wetland-reeds', 3], ['moss-grasses', 2], ['wildflowers', 1]], every: 66, offset: [12, 38], scale: [0.5, 0.85], spacing: 24 },
    { channel: 'main', assets: [['cliff-decoration', 3], ['large-rock', 3], ['mossy-boulder', 2]], every: 30, offset: [8, 56], scale: [0.7, 1.1], span: [0.4, 0.575] },
    { channel: 'brook', assets: [['river-stones', 3], ['small-rocks', 3], ['mossy-boulder', 1]], every: 44, offset: [-5, 8], scale: [0.34, 0.6], spacing: 17 },
    { channel: 'brook', assets: [['bank-vegetation', 3], ['moss-grasses', 2]], every: 90, offset: [8, 24], scale: [0.45, 0.7], spacing: 22 },
  ],

  hearths: [{ x: 604, y: 1850 }],

  journeys: [
    { id: 'deer-woods', traveller: 'deer', from: 'kamimori', to: 'shimomori', seasons: ALL_YEAR, every: 8 },
    { id: 'deer-meadow', traveller: 'deer', from: 'kamimori', to: 'hanano', seasons: [SPRING, SUMMER, AUTUMN], every: 9 },
    { id: 'blossom-walk', traveller: 'villager', from: 'seseragi', to: 'sakura', seasons: ALL_YEAR, every: 10 },
    { id: 'meadow-walk', traveller: 'villager', from: 'seseragi', to: 'hanano', seasons: [SUMMER, AUTUMN], every: 10 },
  ],

  // The year's wishes, in the order the seasons bring them.
  objectives: [
    {
      id: 'blossom-viewing', title: 'Blossom Viewing', journey: 'blossom-walk', season: SPRING, count: 3,
      text: 'The village walks to the cherry terrace.',
      story: 'When the blossom opened, the whole village crossed the river to sit under it.',
      flourish: [
        { asset: 'lantern', x: 1300, y: 1846, scale: 0.5 }, { asset: 'lantern', x: 1404, y: 1870, scale: 0.5 }, { asset: 'lantern', x: 1500, y: 1838, scale: 0.5, flip: true },
        { asset: 'flower-meadow', x: 1352, y: 1856, scale: 0.7 }, { asset: 'flower-meadow', x: 1456, y: 1862, scale: 0.7, flip: true },
      ],
    },
    {
      id: 'first-green', title: 'First Green', journey: 'deer-woods', season: SPRING, count: 3,
      text: 'Deer cross from Kamimori to Shimomori.',
      story: 'With the first green the deer came down through the high stones to Shimomori.',
      flourish: [{ asset: 'wildflowers', x: 1290, y: 1010, scale: 0.8 }, { asset: 'flower-meadow', x: 1240, y: 1090, scale: 0.8 }, { asset: 'wildflowers', x: 1268, y: 1180, scale: 0.7, flip: true }],
    },
    {
      id: 'summer-grazing', title: 'Summer Grazing', journey: 'deer-meadow', season: SUMMER, count: 3,
      text: 'Deer climb from Kamimori to the high meadow.',
      story: 'The herd spent the long days on Hanano, where the grass is sweetest.',
      flourish: [{ asset: 'deer', x: 1286, y: 660, scale: 0.72 }, { asset: 'deer', x: 1356, y: 628, scale: 0.6, flip: true }, { asset: 'flower-meadow', x: 1318, y: 700, scale: 0.8 }],
    },
    {
      id: 'moon-viewing', title: 'Moon Viewing', journey: 'meadow-walk', season: AUTUMN, count: 3,
      text: 'The village climbs to Hanano for the harvest moon.',
      story: 'They carried lanterns up to the high meadow and watched the moon rise over the ridge.',
      flourish: [{ asset: 'lantern', x: 1250, y: 690, scale: 0.5 }, { asset: 'lantern', x: 1392, y: 690, scale: 0.5, flip: true }, { asset: 'signpost', x: 1322, y: 742, scale: 0.55 }],
    },
    {
      id: 'winter-passage', title: 'The Winter Passage', journey: 'deer-woods', season: WINTER, count: 4,
      text: 'Deer reach the shelter of Shimomori.',
      story: 'Below the snowline, by the low stones, the deer found their way to shelter.',
      flourish: [{ asset: 'deer', x: 1300, y: 1236, scale: 0.8 }, { asset: 'deer', x: 1340, y: 1262, scale: 0.66, flip: true }, { asset: 'deer', x: 1262, y: 1270, scale: 0.72 }],
    },
  ],

  // One graceful way to grant every wish, in six brushstrokes, in the order the seasons ask for them.
  solution: [
    // Spring: a footbridge above the pool stays dry through the melt, and the high stones carry the deer.
    { type: 'path', from: 'seseragi', to: 'sakura', control: [{ x: 944, y: 1744 }] },
    { type: 'corridor', from: 'kamimori', to: 'shimomori', control: [{ x: 700, y: 700 }, { x: 1010, y: 610 }, { x: 1250, y: 820 }] },
    // Summer: from Shimomori it is a short climb to the high meadow.
    { type: 'corridor', from: 'hanano', to: 'shimomori', control: [{ x: 1352, y: 850 }] },
    // Autumn: the moon-viewers go round behind the wood, so they never cross the deer.
    { type: 'path', from: 'sakura', to: 'hanano', control: [{ x: 1620, y: 1560 }, { x: 1690, y: 1120 }, { x: 1600, y: 760 }] },
    // Winter: the low stones lie below the snow.
    { type: 'corridor', from: 'kamimori', to: 'shimomori', control: [{ x: 720, y: 1340 }, { x: 1030, y: 1570 }, { x: 1215, y: 1400 }] },
  ],

  par: 7,
  years: 2,
  opening: 'The village wants to see the blossom. Draw from Seseragi to the cherry terrace.',
};

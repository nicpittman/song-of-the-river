/**
 * Reach III: Kawagiri, "river mist". Change, arrivals and possibility.
 *
 * Drawn in valley coordinates (y 4500 below Mio's long bend down to 6800, out at
 * sea), so every landmark carries the same numbers as the journey that visits it.
 *
 * COMPOSITION, from the top:
 *
 *   - The river slows and spreads. On the west bank the Sagi reedlands: reed beds,
 *     wet ground and the heron pond, with the reed cutters' hut at their edge.
 *   - Across a small upstream footbridge, Kawagiri on the raised eastern bank: two fishers' houses with room between,
 *     a drying yard of fish and net racks round a hearth, stilt huts standing in the
 *     shallows, traps set in the current, boats drawn up. South of it, open ground
 *     by the water for a dock and a boat to be built.
 *   - Across the main river a long low island of willows and reeds, and beyond it an
 *     eastern back channel with salt-marsh creeks and mudflats that go under at high
 *     water.
 *   - The tide garden: salt flowers and shallow pools at the head of a tidal creek.
 *   - Dunes, and the shell strand below them on the west shore; the river mouth
 *     opening between sandbars to the sea, with a small light on the eastern spit;
 *     black pines on the eastern dunes. Few trees, big sky, pale ground.
 */

import { type BoardDef, AUTUMN, SPRING } from '../types';
import { along, bar, intoOwnFrame, pts } from './layout';
import { COAST_CAMP, COAST_YARD, COAST_FIRE, COAST_PINES, FISH_TRAPS, STILT_HOUSES, BOATYARD, COAST_MOUTH, LIGHTHOUSE, FAR_SHORE, REED_CAMP, REED_FIRE } from './kawagiriSites';
import { seseragi } from './seseragi';

export const KAWAGIRI_TOP = 4500;
export const KAWAGIRI_BOTTOM = 6800;
/** The shoreline: everything below it is open sea. */
const SHORE = 6090;

const valley: BoardDef = {
  ...seseragi,
  id: 'kawagiri',
  name: 'Kawagiri',
  subtitle: 'The reeds and the open sea',
  width: 2700,
  height: KAWAGIRI_BOTTOM - KAWAGIRI_TOP,
  sea: { y: SHORE },
  hills: [],
  zones: [],
  fords: [],
  journeys: [],
  objectives: [],
  solution: [],
  weirs: [],
  opening: 'Follow the river.',

  relief: [
    // The valley sides, sinking toward the coast.
    { x: -320, y: 4750, r: 620, h: 0.17 }, { x: -300, y: 5400, r: 560, h: 0.1 },
    { x: 2520, y: 4750, r: 620, h: 0.17 }, { x: 2520, y: 5400, r: 560, h: 0.1 },
    // The raised bank the landing stands on.
    { ...COAST_CAMP, r: 260, h: 0.05 }, { ...REED_CAMP, r: 150, h: 0.04 },
    // Dunes behind the west strand and on the east shore.
    { x: 250, y: 5900, r: 150, h: 0.05 }, { x: 470, y: 5880, r: 130, h: 0.045 }, { x: 110, y: 5830, r: 120, h: 0.04 },
    { x: 2120, y: 5930, r: 170, h: 0.05 }, { x: 2350, y: 5900, r: 160, h: 0.05 }, { x: 2600, y: 5950, r: 160, h: 0.04 },
  ],

  channels: [
    {
      id: 'main',
      points: [
        [1030, 4400, 235], [1100, 4500, 240],
        // Slowing and spreading past the reedlands and the landing; the west bank holds its line.
        [1150, 4640, 270], [1185, 4780, 310], [1130, 4920, 340], [1065, 5040, 370], [1060, 5150, 420], [1120, 5350, 480],
        // Widening gently past the tide garden to the mouth, between the western spit and the eastern dunes.
        [1140, 5480, 520], [1150, 5620, 640], [1170, 5760, 620], [1190, 5900, 760],
        // The channel ends just past the shore, swelling as it goes so the mouth flares open into a bay; beyond, the sea is the water.
        [1230, 6040, 900], [1300, 6260, 1300],
      ],
    },
    {
      // The back channel behind the long island.
      id: 'east-arm',
      points: [[1300, 4790, 56], [1440, 4930, 74], [1550, 5120, 90], [1585, 5320, 92], [1540, 5460, 86], [1470, 5520, 80], [1410, 5565, 80]],
    },
    // Salt-marsh creeks winding in from the water and ending in the mud.
    { id: 'east-creek', points: [[1570, 5180, 36], [1660, 5150, 28], [1730, 5185, 22], [1820, 5160, 16], [1900, 5190, 10]] },
    { id: 'east-creek-2', points: [[1440, 5665, 56], [1540, 5650, 46], [1640, 5650, 40], [1740, 5620, 30], [1800, 5660, 22], [1890, 5640, 14], [1950, 5670, 8]] },
    // The tidal creek whose head is the tide garden.
    { id: 'salt-creek', points: [[860, 5555, 46], [790, 5585, 36], [735, 5565, 26], [690, 5590, 18], [650, 5578, 10]] },
    // The heron pond in the reedlands: a short, broad stretch of still water.
    { id: 'heron-pond', points: [[230, 4655, 80], [300, 4690, 110], [365, 4680, 70]] },
  ],

  islands: [
    // A long sandbar in the river below the landing, drawn out along the current.
    ...bar(1180, 5235, 1228, 5445, 104),
    // A reedy islet near the east bank, high enough to stay dry.
    ...bar(1305, 5645, 1365, 5845, 128),
    // The long bar splitting the mouth, and a smaller one off the east point: awash at high water.
    ...bar(1115, 5865, 1195, 6075, 116),
    ...bar(1455, 5945, 1500, 6070, 84, 5),
  ],
  shallows: [
    { x: 1205, y: 5340, r: 90 },
    { x: 1155, y: 5970, r: 130 }, { x: 1480, y: 6010, r: 100 }, { x: 1335, y: 5740, r: 90 },
  ],

  places: [
    { id: 'kawagiri-reeds', name: 'Sagi reedlands', kind: 'wetland', x: 460, y: 4740, radius: 130, links: [], rest: true, note: 'Reed beds and a heron pond on the slow river.' },
    { id: 'kawagiri-landing', name: 'Kawagiri', kind: 'village', ...COAST_CAMP, radius: 150, links: ['path'], note: 'The last little settlement before the sea.' },
    { id: 'salt-meadow', name: 'Tide garden', kind: 'wetland', x: 540, y: 5530, radius: 120, links: ['path'], note: 'Salt flowers and shallow pools.' },
    { id: 'shell-strand', name: 'The shell strand', kind: 'landing', x: 400, y: 5975, radius: 110, links: ['path'], note: 'Shells, driftwood and rock pools below the dunes.' },
    { id: 'open-water', name: 'The river mouth', kind: 'water', x: 760, y: 5930, radius: 120, links: [], note: 'The mountains end here. The river does not.' },
  ],

  floodplains: [
    // The east mudflats: under the high water of spring and autumn.
    { id: 'east-mudflats', name: 'the mudflats', floods: [SPRING, AUTUMN], blobs: [{ x: 1720, y: 5260, r: 90 }, { x: 1780, y: 5320, r: 70 }, { x: 1690, y: 5420, r: 80 }, { x: 1760, y: 5560, r: 70 }] },
    // The mouth sandbars show only at low water.
    { id: 'mouth-bars', name: 'the sandbars', floods: [SPRING, AUTUMN], blobs: [{ x: 1140, y: 5930, r: 70 }, { x: 1175, y: 6020, r: 70 }, { x: 1480, y: 6010, r: 60 }] },
    // The reedlands go wet with the melt.
    { id: 'landing-bar', name: 'the landing bar', floods: [SPRING], blobs: bar(1180, 5235, 1228, 5445, 110) },
    { id: 'reed-flats', name: 'the reed flats', floods: [SPRING], blobs: [{ x: 600, y: 4640, r: 70 }, { x: 640, y: 4600, r: 50 }, { x: 330, y: 4800, r: 60 }] },
  ],

  patches: [
    // Wet ground: the reedlands, the long island, the east salt marsh, the tide garden.
    {
      material: 'wetland',
      blobs: [
        { x: 460, y: 4700, r: 220 }, { x: 250, y: 4820, r: 160 }, { x: 680, y: 4620, r: 140 },
        { x: 1360, y: 5200, r: 120 }, { x: 1380, y: 5450, r: 110 },
        { x: 1700, y: 5250, r: 230 }, { x: 1720, y: 5520, r: 200 }, { x: 1950, y: 5350, r: 180 },
        { x: 560, y: 5520, r: 150 }, { x: 700, y: 5600, r: 100 },
      ],
    },
    // Bare rock at the far end of the strand, where the rock pools are.
    { material: 'rocky', blobs: [{ x: 120, y: 5990, r: 110 }] },
  ],

  woods: [
    // The last woods of the valley sides, thinning to the coast.
    { kind: 'broadleaf', spacing: 120, scale: 0.85, blobs: [{ x: -220, y: 4640, r: 240 }, { x: -60, y: 4560, r: 130 }, { x: -300, y: 4900, r: 180 }] },
    { kind: 'broadleaf', spacing: 120, scale: 0.85, blobs: [{ x: 2380, y: 4620, r: 240 }, { x: 2200, y: 4560, r: 120 }, { x: 2520, y: 4880, r: 180 }] },
    // Black pines on the dunes, the way coastal villages plant them against the wind.
    { kind: 'pine', spacing: 115, scale: 0.75, blobs: [{ x: 2430, y: 5200, r: 85 }] },
    { kind: 'pine', spacing: 120, scale: 0.8, blobs: [{ x: 2540, y: 5580, r: 90 }, { x: 2640, y: 5700, r: 130 }, { x: 2400, y: 5620, r: 70 }] },
    { kind: 'pine', spacing: 130, scale: 0.75, blobs: [{ x: -80, y: 5780, r: 140 }, { x: -300, y: 5760, r: 150 }] },
  ],

  outcrops: [
    // The rocks at the end of the strand.
    { x: 90, y: 5995, size: 5, spread: 70 },
    { x: 300, y: 6025, size: 4, spread: 50 },
    // Stones on the raised bank below the landing.
    { x: 900, y: 5080, size: 4, spread: 50 },
  ],

  lanes: [
    // Arrive at the reed cutters' hut on the western bank.
    { points: pts(470, 4560, 470, 4660, 540, 4800, 590, 4920, 620, 5000, 640, 5170) },
    // The old footbridge stands above the branching estuary. Roads meet both deck ends.
    { width: 26, points: pts(540, 4800, 760, 4700, 900, 4640, 1150, 4640, 1430, 4640, 1700, 4730, 2000, 4890) },
    // The raised eastern path goes round the heads of BOTH tidal creeks.
    { width: 28, points: [...pts(2000, 4890, 2050, 5100, 2060, 5350), COAST_CAMP, COAST_YARD] },
    { width: 22, points: [...pts(2060, 5350, 2240, 5260), COAST_PINES] },
    { width: 60, points: pts(1980, 5540, 2080, 5550, 2170, 5540) },
    { width: 22, points: [COAST_YARD, ...pts(1900, 5570, 1800, 5510), FISH_TRAPS] },
    // Round the creek head to the stilt houses, then down the beach to the light.
    { width: 26, points: [COAST_YARD, ...pts(2160, 5630), STILT_HOUSES, ...pts(2220, 5910), LIGHTHOUSE] },
    { width: 24, points: [...pts(2160, 5680, 2080, 5720, 1960, 5750), BOATYARD] },
    { width: 24, points: [BOATYARD, ...pts(1810, 5880), COAST_MOUTH] },
    { width: 18, wear: .5, points: [...pts(2220, 5910, 2360, 5950), FAR_SHORE] },
    // Optional western strand and reedland walks remain in the landscape.
    { points: pts(640, 5170, 700, 5300, 590, 5470, 540, 5540, 560, 5680, 470, 5790, 420, 5890, 400, 5960) },
    { width: 20, points: pts(540, 4800, 420, 4810, 330, 4840, 268, 4848) },
  ],

  sprites: [
    // ── Sagi reedlands: the heron pond, the reed cutters' hut and stacks.
    { asset: 'heron', x: 300, y: 4708, scale: 0.6 }, { asset: 'heron', x: 375, y: 4660, scale: 0.5, flip: true },
    { asset: 'crane-stand', x: 220, y: 4700, scale: 0.9 },
    { asset: 'shed', x: 250, y: 4832, scale: 0.55 },
    { asset: 'haystack', x: 305, y: 4842, scale: 0.7 }, { asset: 'haystack', x: 325, y: 4858, scale: 0.6, flip: true },
    { asset: 'willow', x: 140, y: 4740, scale: 0.6 },

    // Ashikari, the reed cutters' hamlet and the western overnight stop: a few small roofs round one yard, reed stacks drying.
    { asset: 'shed', x: 600, y: 5080, scale: 0.65 },
    { asset: 'cottage', x: 510, y: 5045, scale: 0.5 },
    { asset: 'timber-cottage', x: 722, y: 5120, scale: 0.44, flip: true },
    { asset: 'haystack', x: 545, y: 5125, scale: 0.55 }, { asset: 'haystack', x: 566, y: 5140, scale: 0.48, flip: true },
    { asset: 'fish-drying-rack', x: 660, y: 5165, scale: 0.75 },
    { asset: 'lantern', x: 640, y: 5105, scale: 0.4 },
    { asset: 'signpost', x: 690, y: 5060, scale: 0.55 },
    // ── Kawagiri, on the raised eastern shore. Doors face the open yard.
    { asset: 'cottage', x: COAST_CAMP.x - 90, y: COAST_CAMP.y - 30, scale: 0.68 },
    { asset: 'cottage', x: COAST_CAMP.x + 100, y: COAST_CAMP.y + 20, scale: 0.6, flip: true },
    { asset: 'shed', x: BOATYARD.x - 40, y: BOATYARD.y - 40, scale: 0.55 },
    { asset: 'fish-drying-rack', x: COAST_YARD.x - 130, y: COAST_YARD.y + 40, scale: 1 },
    { asset: 'fish-drying-rack', x: COAST_YARD.x + 100, y: COAST_YARD.y + 20, scale: 0.9, flip: true },
    { asset: 'net-rack', x: BOATYARD.x - 40, y: BOATYARD.y, scale: 1 },
    { asset: 'lantern', x: COAST_CAMP.x + 20, y: COAST_CAMP.y + 10, scale: 0.45 },
    { asset: 'signpost', x: COAST_CAMP.x + 70, y: COAST_CAMP.y - 40, scale: 0.55 },
    { asset: 'stilt-hut', x: STILT_HOUSES.x - 90, y: STILT_HOUSES.y - 50, scale: 0.85 },
    { asset: 'stilt-hut', x: STILT_HOUSES.x + 90, y: STILT_HOUSES.y - 30, scale: 0.8, flip: true },
    // Two more out over the shallows by the landing, as stilt houses should be.
    { asset: 'stilt-hut', x: BOATYARD.x - 70, y: BOATYARD.y + 110, scale: 0.85, flip: true },
    { asset: 'stilt-hut', x: BOATYARD.x + 60, y: BOATYARD.y + 170, scale: 0.8 },
    { asset: 'fish-trap', x: 1500, y: FISH_TRAPS.y, scale: 0.9 },
    { asset: 'fish-trap', x: 1100, y: 5180, scale: 0.9, flip: true },
    { asset: 'fish-trap', x: 810, y: 5582, scale: 0.8 },
    { asset: 'boat', x: 1480, y: 5830, scale: 0.9 },
    { asset: 'boat-beached', x: BOATYARD.x - 20, y: BOATYARD.y + 70, scale: 0.9 },
    { asset: 'duck', x: 1120, y: 4760, scale: 0.75 },
    { asset: 'duck', x: 1140, y: 4775, scale: 0.65 },

    // ── The long island and the east salt marsh.
    { asset: 'willow', x: 1360, y: 5080, scale: 0.6 }, { asset: 'willow', x: 1390, y: 5300, scale: 0.5, flip: true },
    { asset: 'willow', x: 1332, y: 5742, scale: 0.42 }, { asset: 'wetland-reeds', x: 1310, y: 5690, scale: 0.7 }, { asset: 'wetland-reeds', x: 1355, y: 5795, scale: 0.6, flip: true },
    { asset: 'heron', x: 1700, y: 5340, scale: 0.55 },
    { asset: 'sandpiper', x: 1620, y: 5560, scale: 1 }, { asset: 'sandpiper', x: 1650, y: 5575, scale: 0.9, flip: true },
    { asset: 'shed', x: 1960, y: 5050, scale: 0.55 },

    // ── The tide garden: salt flowers round shallow pools at the creek head.
    { asset: 'small-pool', x: 520, y: 5545, scale: 0.9 }, { asset: 'small-pool', x: 600, y: 5505, scale: 0.6, flip: true },
    ...along('sea-lavender', pts(430, 5480, 500, 5460, 580, 5470), 40, 1, 31, 10),
    ...along('sea-lavender', pts(450, 5600, 540, 5610, 620, 5590), 40, 1, 32, 10),
    { asset: 'stepping-stones', x: 555, y: 5585, scale: 0.5 },

    // ── Dunes and the shell strand.
    ...along('wrack', pts(160, 6005, 300, 6015, 440, 6011, 580, 6005), 120, 1, 43, 6),
    { asset: 'shells', x: 360, y: 5975, scale: 1 }, { asset: 'shells', x: 470, y: 5989, scale: 0.9, flip: true }, { asset: 'shells', x: 250, y: 5985, scale: 0.8 },
    { asset: 'driftwood', x: 520, y: 5995, scale: 1 }, { asset: 'driftwood', x: 280, y: 5985, scale: 0.8, flip: true },
    { asset: 'net-float', x: 420, y: 5995, scale: 1 },
    { asset: 'rock-pool', x: 150, y: 6005, scale: 1 }, { asset: 'rock-pool', x: 60, y: 5965, scale: 0.8, flip: true },
    { asset: 'sandpiper', x: 330, y: 6025, scale: 1 }, { asset: 'sandpiper', x: 355, y: 6035, scale: 0.9 },
    { asset: 'boat-beached', x: 620, y: 5975, scale: 1, flip: true },
    // ── The river mouth: the light on the eastern spit, surf on the bar.
    { asset: 'haru-camp', x: COAST_PINES.x, y: COAST_PINES.y - 30, scale: 0.8 },
    { asset: 'harbour-light', x: LIGHTHOUSE.x - 30, y: LIGHTHOUSE.y - 30, scale: 1.2 },
    { asset: 'river-stones', x: 1290, y: 6090, scale: 1.1 },
    { asset: 'river-stones', x: 170, y: 6175, scale: 1.2 }, { asset: 'river-stones', x: 230, y: 6200, scale: 0.8, flip: true },
  ],

  scatter: [
    // Marram on the dunes behind both strands.
    { assets: [['moss-grasses', 4], ['dune-grass', 1]], blobs: [{ x: 230, y: 5945, r: 110 }, { x: 480, y: 5950, r: 100 }, { x: 640, y: 5945, r: 50 }, { x: 1850, y: 5975, r: 100 }, { x: 2100, y: 5965, r: 120 }, { x: 2380, y: 5975, r: 120 }], count: 16, spacing: 95, scale: [0.5, 0.8] },
    // Reed beds: the reedlands, the long island, the tide creek, the east marsh.
    { assets: [['wetland-reeds', 4], ['reedbed', 3], ['marsh', 2]], blobs: [{ x: 470, y: 4660, r: 170 }, { x: 640, y: 4600, r: 110 }, { x: 260, y: 4840, r: 120 }], count: 34, spacing: 64, scale: [0.6, 1] },
    { assets: [['wetland-reeds', 3], ['reedbed', 2]], blobs: [{ x: 1370, y: 5150, r: 90 }, { x: 1380, y: 5420, r: 90 }, { x: 1300, y: 4900, r: 50 }], count: 16, spacing: 56, scale: [0.55, 0.9] },
    { assets: [['wetland-reeds', 3], ['marsh', 2], ['sea-lavender', 2]], blobs: [{ x: 1720, y: 5300, r: 200 }, { x: 1800, y: 5560, r: 160 }, { x: 2000, y: 5380, r: 150 }], count: 26, spacing: 72, scale: [0.6, 0.95] },
    { assets: [['sea-lavender', 3], ['moss-grasses', 1]], blobs: [{ x: 640, y: 5640, r: 110 }], count: 8, spacing: 50, scale: [0.8, 1.1] },
    // Grasses on the open banks.
    { assets: [['moss-grasses', 3], ['wildflowers', 2], ['shrubs', 1]], blobs: [{ x: 280, y: 5300, r: 220 }, { x: 1900, y: 4800, r: 220 }], count: 16, spacing: 90, scale: [0.5, 0.8] },
  ],

  banks: [
    // Reeds stand in the slow water, with a few stones; they give out toward the open mouth.
    { channel: 'main', assets: [['wetland-reeds', 4], ['bank-vegetation', 2], ['river-stones', 1]], every: 70, offset: [-6, 30], scale: [0.5, 0.85], spacing: 28, span: [0, 0.62] },
    { channel: 'main', assets: [['river-stones', 3], ['small-rocks', 2]], every: 110, offset: [-6, 8], scale: [0.4, 0.65], spacing: 22, span: [0, 0.5] },
    { channel: 'east-arm', assets: [['wetland-reeds', 4], ['reedbed', 1], ['bank-vegetation', 1]], every: 60, offset: [-6, 24], scale: [0.5, 0.85], spacing: 26 },
    { channel: 'salt-creek', assets: [['wetland-reeds', 2], ['sea-lavender', 2]], every: 50, offset: [0, 18], scale: [0.5, 0.8], spacing: 22 },
    { channel: 'heron-pond', assets: [['wetland-reeds', 3], ['reedbed', 1]], every: 36, offset: [-4, 16], scale: [0.5, 0.85], spacing: 22 },
  ],

  hearths: [REED_FIRE, COAST_FIRE],
};

export const kawagiri: BoardDef = intoOwnFrame(valley, KAWAGIRI_TOP);

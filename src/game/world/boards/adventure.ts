/**
 * One river from the mountain springs to the sea: Seseragi (the upper reach,
 * with a small camp beneath the mountains), Mio (orchard country) and Kawagiri
 * (the reeds, the landing and the open sea), joined end to end.
 */

import { Polyline, smoothCurve } from '../geometry';
import { composeValley } from '../compose';
import type { BankDef, BoardDef, ChannelDef } from '../types';
import { kawagiri, KAWAGIRI_TOP } from './kawagiri';
import { mio, MIO_TOP } from './mio';
import { seseragi } from './seseragi';

export { mio } from './mio';
export { kawagiri } from './kawagiri';

/** Seseragi as the journey begins it: the camp where the little group first lives. */
const upper: BoardDef = {
  ...seseragi,
  journeys: seseragi.journeys.filter((j) => j.traveller !== 'villager'),
  objectives: [],
  solution: [],
  places: [
    ...seseragi.places,
    { id: 'spring-camp', name: 'Spring camp', kind: 'village', x: 640, y: 340, radius: 85, links: ['path'], note: 'Our first roof beneath the mountains.' },
  ],
  sprites: [
    ...seseragi.sprites,
    { asset: 'shed', x: 600, y: 318, scale: 0.65 },
    { asset: 'cottage', x: 735, y: 372, scale: 0.6 },
    { asset: 'bonfire', x: 585, y: 410, scale: 0.42 },
  ],
  lanes: [
    ...seseragi.lanes,
    // The camp's yard, between the shed and the cottage, opening onto the road.
    { width: 40, points: [{ x: 602, y: 344 }, { x: 650, y: 386 }, { x: 690, y: 426 }, { x: 735, y: 482 }] },
  ],
};

const joined = composeValley('river-adventure', 'Song of the River', 'A winding river. Shifting seasons. A distant sea.', [upper, mio, kawagiri]);

/** Where each reach of the main river begins, in valley y. */
const JOINS = [MIO_TOP, KAWAGIRI_TOP];

/** The main channel of each reach, in order: `main`, `main@mio`, `main@kawagiri`. */
const isMain = (c: ChannelDef): boolean => c.id === 'main' || c.id.startsWith('main@');

/**
 * The main river becomes one uninterrupted curve: each reach keeps its own
 * points between the joins. One curve keeps the banks, the flow and the fish
 * continuous where the reaches meet.
 */
function joinMainRiver(channels: readonly ChannelDef[]): ChannelDef[] {
  const mains = channels.filter(isMain);
  const top = (i: number): number => (i === 0 ? -Infinity : JOINS[i - 1]!);
  const bottom = (i: number): number => (i === mains.length - 1 ? Infinity : JOINS[i]!);
  const points = mains.flatMap((c, i) => c.points.filter(([, y]) => y >= top(i) && y < bottom(i)));
  return [{ id: 'main', points }, ...channels.filter((c) => !isMain(c))];
}

/**
 * Each reach lines its own stretch of the main river. A reach's bank rules were
 * written as fractions of its own river; they become fractions of the whole one.
 */
function joinMainBanks(banks: readonly BankDef[], river: Polyline): BankDef[] {
  const share = [0, ...JOINS.map((y) => river.nearest({ x: 1100, y }).along / river.length), 1];
  const upperLength = new Polyline(smoothCurve(seseragi.channels[0]!.points.map(([x, y]) => ({ x, y })), 14)).length;
  return banks.map((bank) => {
    if (!bank.channel.startsWith('main')) return bank;
    const index = bank.channel === 'main' ? 0 : bank.channel === 'main@mio' ? 1 : 2;
    const [from, to] = bank.span ?? [0, 1];
    const start = share[index]!;
    const end = share[index + 1]!;
    // Seseragi's banks were written for its own river, which runs a little past its foot.
    const span: [number, number] =
      index === 0
        ? [Math.min(end, (from * upperLength) / river.length), Math.min(end, (to * upperLength) / river.length)]
        : [start + from * (end - start), start + to * (end - start)];
    return { ...bank, channel: 'main', span };
  });
}

joined.channels = joinMainRiver(joined.channels);
const mainLine = new Polyline(smoothCurve(joined.channels[0]!.points.map(([x, y]) => ({ x, y })), 14));
joined.banks = joinMainBanks(joined.banks, mainLine);

/**
 * Two small streams off the west slope, to break up the long west bank.
 *  - Numata's stream runs through the reed marsh, opening into a still pool
 *    among the reeds (where the fishing is), and on to the river. The old road
 *    south from Seseragi wades it below Furumichi, with no stones: it floods
 *    for a few days a year and freezes in winter (see `adventure/stream.ts`).
 *  - Nishibayashi's comes down out of the west wood below the village and
 *    under the track by Omagari, with stepping stones that never flood.
 */
joined.channels.push(
  { id: 'numata-stream', points: [[-160, 2410, 12], [60, 2445, 14], [250, 2480, 18], [370, 2500, 84], [450, 2525, 120], [530, 2515, 72], [640, 2545, 22], [742, 2532, 20], [860, 2560, 22], [1040, 2556, 30]] },
  { id: 'nishi-stream', points: [[-300, 3940, 14], [-120, 3975, 18], [60, 4010, 20], [230, 3995, 22], [400, 4015, 26], [578, 3985, 28], [640, 3952, 28], [720, 3918, 30], [840, 3898, 34]] },
);
joined.fords.push(
  { id: 'nishi-stones', name: 'the wood stones', x: 578, y: 3985, radius: 46, floods: [] },
);
// Where each stream comes off the slope: a little fall among mossy stones.
joined.sprites.push(
  { asset: 'waterfall', x: 18, y: 2410, scale: 0.55 }, { asset: 'mossy-boulder', x: -30, y: 2440, scale: 0.6 }, { asset: 'small-rocks', x: 60, y: 2385, scale: 0.5, flip: true },
  { asset: 'waterfall', x: -110, y: 3955, scale: 0.55 }, { asset: 'mossy-boulder', x: -60, y: 3995, scale: 0.6, flip: true },
);
joined.banks.push(
  // Reeds along Numata's stream, leaving the old road's crossing open (about three quarters of the way down).
  ...([[0, 0.655], [0.85, 1]] as const).map(([from, to]) => ({ channel: 'numata-stream', span: [from, to] as [number, number], assets: [['wetland-reeds', 4], ['reedbed', 2], ['bank-vegetation', 1]] as [string, number][], every: 40, offset: [-6, 18] as [number, number], scale: [0.5, 0.85] as [number, number], spacing: 22 })),
  { channel: 'nishi-stream', assets: [['bank-vegetation', 3], ['moss-grasses', 2], ['river-stones', 1]], every: 60, offset: [8, 26], scale: [0.45, 0.7], spacing: 22 },
);

/**
 * The valley's eastern outer slope, wooded from the mountains to above the
 * coast, as the west side is. A portrait phone frames the reach by its height,
 * which shows this margin; bare, it read as an empty band of meadow.
 */
const EAST_SLOPE = Array.from({ length: 16 }, (_, i) => {
  const y = 120 + i * 330;
  return { kind: (i % 3 === 0 ? 'pine' : 'mixed') as 'pine' | 'mixed', spacing: 150, scale: 1.05,
    blobs: [{ x: 2980 + (i % 2) * 90, y, r: 250 }, { x: 3260, y: y + 160, r: 220 }] };
});
/** And the western slope, matching it, so both edges of the valley close in with trees. */
const WEST_SLOPE = Array.from({ length: 16 }, (_, i) => {
  const y = 280 + i * 330;
  return { kind: (i % 3 === 1 ? 'pine' : 'mixed') as 'pine' | 'mixed', spacing: 150, scale: 1.05,
    blobs: [{ x: -420 - (i % 2) * 90, y, r: 240 }, { x: -700, y: y + 160, r: 220 }] };
});
joined.woods = [...joined.woods, ...EAST_SLOPE, ...WEST_SLOPE];

/**
 * Footpaths on the east bank, so that side reads as part of the valley: over the
 * ledge behind Taki's falls and down to Hanano (the long way round at high water),
 * and along the bank from Shimomori's wood to Kaede.
 */
/** Small landmarks beside the places added on 20 Nov, so each shows in the valley. */
joined.sprites = [
  ...joined.sprites,
  { asset: 'small-pool', x: 2020, y: 680, scale: 0.7 },
  // The charcoal burner's camp at Sumiyaki, tucked in behind the pines.
  { asset: 'haru-camp', x: 70, y: 228, scale: 0.75, flip: true },
  { asset: 'shed', x: 290, y: 1240, scale: 0.6 }, { asset: 'log', x: 220, y: 1290, scale: 0.8 },
  { asset: 'vegetable-rows', x: 2340, y: 3680, scale: 0.7 }, { asset: 'vegetable-rows', x: 2270, y: 3705, scale: 0.65, flip: true },
  { asset: 'rock-pool', x: 2650, y: 5420, scale: 0.8 },
  { asset: 'shed', x: 260, y: 5300, scale: 0.55, flip: true },
  // Along the high path on Mio's far bank, so the meadow below Higashimori is not a blank.
  { asset: 'sparse-woodland', x: 1560, y: 3930, scale: 0.8 }, { asset: 'sparse-woodland', x: 1700, y: 4330, scale: 0.75, flip: true },
  { asset: 'mossy-boulder', x: 1905, y: 4470, scale: 0.6 }, { asset: 'small-rocks', x: 1640, y: 4150, scale: 0.55 },
  { asset: 'shrubs', x: 1800, y: 4060, scale: 0.6, flip: true }, { asset: 'log', x: 2075, y: 4290, scale: 0.7 },
];

joined.lanes = [
  ...joined.lanes,
  { width: 24, wear: .7, points: [{ x: 660, y: 420 }, { x: 760, y: 360 }, { x: 860, y: 300 }, { x: 940, y: 220 }, { x: 1030, y: 140 }, { x: 1110, y: 80 }, { x: 1196, y: 46 }, { x: 1280, y: 70 }, { x: 1360, y: 140 }, { x: 1430, y: 240 }, { x: 1520, y: 330 }, { x: 1600, y: 430 }, { x: 1650, y: 510 }, { x: 1690, y: 580 }] },
  // Mio's far bank: from Mukoniwa's garden through Higashimori and on down the eastern shore to
  // Shiobashi's road (the high path), and on from Higashida's farm to the tea fields at Chabatake.
  { width: 22, wear: .7, points: [{ x: 1570, y: 3570 }, { x: 1700, y: 3700 }, { x: 1880, y: 3880 }, { x: 2020, y: 4020 }, { x: 2060, y: 4200 }, { x: 1990, y: 4420 }, { x: 1850, y: 4600 }, { x: 1700, y: 4730 }] },
  { width: 20, wear: .6, points: [{ x: 2000, y: 3500 }, { x: 2150, y: 3570 }, { x: 2300, y: 3640 }] },
  { width: 24, wear: .7, points: [{ x: 1800, y: 1180 }, { x: 1815, y: 1280 }, { x: 1790, y: 1380 }, { x: 1770, y: 1480 }, { x: 1760, y: 1580 }, { x: 1730, y: 1680 }, { x: 1720, y: 1780 }, { x: 1700, y: 1880 }] },
];

export const adventureValley: BoardDef = joined;

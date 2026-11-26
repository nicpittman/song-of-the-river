/**
 * A hand-shaped river chart for the notebook demo: one river from the
 * mountain springs to the sea, with a tributary from the high tarn, woods and
 * hills either side. Built from a few sine curves so it is smooth and stable.
 */

import type { Chart } from '../../game/adventure/model';

export const CHART_WIDTH = 1600;
export const CHART_HEIGHT = 6800;
export const SEA_Y = 6300;

export const REGIONS: Chart['regions'] = [
  { id: 'seseragi', name: 'Seseragi', title: '', top: 0, bottom: 2500 },
  { id: 'mio', name: 'Mio', title: 'II · The middle river', top: 2500, bottom: 4500 },
  { id: 'kawagiri', name: 'Kawagiri', title: 'III · The open estuary', top: 4500, bottom: 6800 },
];

/** The river's centre line at a given depth down the valley. */
export function riverX(y: number): number {
  return 820 + 250 * Math.sin(y / 640 + 0.5) + 90 * Math.sin(y / 260 + 1.2);
}

/** The river's half-width: a thread at the spring, broad in the estuary. */
function riverHalf(y: number): number {
  return 22 + (y / CHART_HEIGHT) ** 1.3 * 110;
}

function mainChannel(): Chart['channels'][number] {
  const points: Chart['channels'][number] = [];
  for (let y = 60; y <= SEA_Y + 40; y += 55) points.push({ x: riverX(y), y, half: riverHalf(y) });
  return points;
}

function tributary(): Chart['channels'][number] {
  const from = { x: 430, y: 70 };
  const joinY = 760;
  const to = { x: riverX(joinY), y: joinY };
  const points: Chart['channels'][number] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x = from.x + (to.x - from.x) * t + Math.sin(t * Math.PI * 2) * 40;
    const y = from.y + (to.y - from.y) * t;
    points.push({ x, y, half: 9 + t * 7 });
  }
  return points;
}

/** Woods and hills, placed off the river on alternating banks. */
function scatter(): { woods: Chart['woods']; hills: Chart['hills'] } {
  const woods: Chart['woods'] = [];
  const hills: Chart['hills'] = [];
  for (let y = 120; y < SEA_Y - 200; y += 230) {
    const k = Math.round(y / 230);
    const side = k % 2 === 0 ? -1 : 1;
    const x = riverX(y) + side * (300 + ((k * 97) % 180));
    if (x > 90 && x < CHART_WIDTH - 90) woods.push({ x, y, r: 90 + ((k * 53) % 70) });
    if (k % 3 === 0) {
      const hx = side > 0 ? 120 + ((k * 31) % 120) : CHART_WIDTH - 140 - ((k * 29) % 120);
      hills.push({ x: hx, y: y + 80, r: 70 + ((k * 41) % 60) });
    }
  }
  return { woods, hills };
}

export function buildChart(): Chart {
  const { woods, hills } = scatter();
  return {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    channels: [mainChannel(), tributary()],
    woods,
    hills,
    regions: REGIONS,
    sea: SEA_Y,
  };
}

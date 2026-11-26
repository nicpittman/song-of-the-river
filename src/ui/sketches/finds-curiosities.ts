/**
 * Curiosities: views and moments drawn as tiny landscapes (a rainbow in the
 * spray, the mountain twice, the long view, the first sight of the sea), and
 * small things picked up and turned over in the hand (an agate, a stone shell,
 * cherry shells, a moon shell, a cowrie).
 */

import { oval, ring, type Drawing } from './pen';

/** A rainbow in the spray: the falls at the right, a mist of spray, three bands of an arc across it. */
const sprayRainbow: Drawing = {
  wash: [
    ['blossom', 'M7.4 36c0-10.4 6.8-17.8 15.6-17.8S38.6 25.6 38.6 36h-4c0-8-5.2-13.8-11.6-13.8S11.4 28 11.4 36Z'],
    ['river', 'M30.4 30c3-2.6 9.2-2.8 13.4 0 .6 4.8-.8 8.8-3.4 11.6H32c-2.4-3.4-2.8-7.6-1.6-11.6Z'],
  ],
  line: [
    'M7.2 36c0-10.4 6.8-17.8 15.8-17.8S38.8 25.6 38.8 36',
    'M11.4 36c0-8 5.2-13.8 11.6-13.8S34.6 28 34.6 36',
    'M36.6 5.4c.2 8 0 16.4-.6 24.8M41 5.4c.2 7.6.2 15.6-.2 23.4',
    'M4.2 41.8c13.2-1.4 26.4-1.4 39.8 0',
  ],
  detail: [
    'M9.4 36c0-9.2 6-16 13.6-16s13.6 6.8 13.6 16',
    'M38.8 9c0 5.6 0 11.2-.4 16.8',
    'M31.6 33.4c1.2-.8 2.6-.8 3.8 0M38 36.4c1.2-.8 2.6-.8 3.8 0M33.6 38.8c1-.6 2-.6 3 0',
  ],
};

/** The mountain twice: a peak and its exact reflection in a still tarn. */
const tarnTwice: Drawing = {
  wash: [
    ['straw', 'M7 26 16.6 12.4l4.6 5.4 6.4-9.4L41 26Z'],
    ['river', 'M4.4 26.2h39.6v6c-1.6 3.6-3.4 7.2-5.6 9.6H10c-2.4-2.6-4.4-6.2-5.6-9.6Z'],
  ],
  line: [
    'M6.8 26.2 16.6 12.4l4.6 5.4 6.4-9.6 13.6 18',
    'M4.2 26.2h39.8',
  ],
  detail: [
    'M6.8 26.2 16.6 40l4.6-5.4 6.4 9.6 13.6-18',
    'M24.4 12.8l3.2-4.4 3 4M13.6 16.8l3-4.4 2.2 2.6',
    'M9 30.6c2.4-.6 4.8-.6 7.2 0M30 33c2.4-.6 4.8-.6 7.2 0',
  ],
};

/** A river agate: a rounded pebble cut through, its bands like a cut onion, clear at the heart. */
const riverAgate: Drawing = {
  wash: [
    ['straw', 'M10 26.2c0-8 6.2-14 14.4-14S38.6 18 38.6 26s-6.2 13.8-14.4 13.8S10 34.2 10 26.2Z'],
    ['river', 'M19.6 26.4c0-3 2.2-5.2 4.8-5.2s4.6 2.2 4.6 5c0 3-2.2 5-4.8 5s-4.6-2-4.6-4.8Z'],
  ],
  line: [
    'M10 26.2c0-8 6.2-14 14.4-14S38.6 18 38.6 26s-6.2 13.8-14.4 13.8S10 34.2 10 26.2Z',
    'M13.4 26.2c0-6 4.8-10.6 11-10.6s10.8 4.6 10.8 10.4-4.8 10.4-11 10.4-10.8-4.4-10.8-10.2Z',
  ],
  detail: [
    'M16.6 26.2c0-4.4 3.4-7.6 7.8-7.6s7.6 3.2 7.6 7.4-3.4 7.6-7.8 7.6-7.6-3.2-7.6-7.4Z',
    'M19.6 26.4c0-3 2.2-5.2 4.8-5.2s4.6 2.2 4.6 5c0 3-2.2 5-4.8 5s-4.6-2-4.6-4.8Z',
  ],
};

/** A shell in the stone: a coiled fossil shell, ribbed, set in a broken grey stone. */
const stoneShell: Drawing = {
  wash: [['straw', 'M6.8 30c-.6-7.6 4.4-15.4 13.2-17.2 8.6-1.8 17.4 1.8 20.4 9.2 2.6 6.6-.4 14-7.6 17-8.6 3.6-24.6 1.6-26-9Z']],
  line: [
    'M6.6 30c-.6-7.6 4.4-15.4 13.2-17.2 8.6-1.8 17.6 1.8 20.6 9.2 2.6 6.6-.4 14.2-7.6 17.2-8.6 3.6-24.8 1.6-26.2-9.2Z',
    'M23.4 26.6c0-1.4 1.2-2 2.2-1.6 1.6.6 1.8 2.8.6 4-1.8 1.8-5 1.4-6.2-1-1.6-3 .6-6.8 4-7.6 4.4-1 8.4 2.2 8.4 6.8 0 5-4.4 9-9.6 8.6',
  ],
  detail: [
    'M28.8 22.4l2-1.6M31.2 26.4l2.4-.4M30.2 31.2l2.2 1M26.6 34.4l1 2.2M21.6 35.2l-.2 2.4M17.6 32.6l-2 1.4M16.6 27.4l-2.4-.2M18.6 22.8l-1.8-1.6',
    'M10.4 21.6l3.4 1.6M36.4 36l-2-2',
  ],
};

/** The long view: Seseragi's small roofs below the ridge; mist hides the next bend. */
const longView: Drawing = {
  wash: [
    ['leaf', 'M4.4 22c6 1 10 4.2 12.6 8.8l-2 12.8H4.4Z'],
    ['river', 'M18.6 43.6c3.6-6 2.4-10 8-13.8s9.6-6.4 13.4-10.4l3.4.4c-4 4.6-8.4 7.6-13.6 11.2-5 3.4-3.6 7.2-7 12.6Z'],
  ],
  line: [
    'M4.2 21.8c6.2 1 10.4 4.4 13 9.2 1 2 1.6 4.4 2 7',
    'M18.6 43.6c3.6-6 2.4-10 8-13.8s9.6-6.4 13.4-10.4',
    'M22.2 43.8c3.4-5.4 2-9.2 7.2-12.6s9.8-6.6 14-11.2',
    'M20 13.6c4-2 8-2 12 0s8 2 12 0',
  ],
  detail: ['M7 35l3-2 3 2M8 35v3h4v-3', 'M12 40l3-2 3 2M13 40v2h4v-2', 'M16 33l3-2 3 2M17 33v4h4v-4', ring(22.3, 36, 1), 'M8 26.2l-.4-2.4M10.4 27.4l.4-2.4'],
};

/** A lantern for every boat: three paper lanterns hung from a beam, each with a name down its side. */
const lanterns: Drawing = {
  wash: [
    ['straw', 'M8.4 19.8c0-2 1.8-3.2 4.4-3.2s4.4 1.2 4.4 3.2v7.2c0 2-1.8 3.2-4.4 3.2s-4.4-1.2-4.4-3.2ZM31 22.8c0-1.8 1.6-3 4-3s4 1.2 4 3v6.4c0 1.8-1.6 3-4 3s-4-1.2-4-3Z'],
    ['blossom', 'M19.8 23.4c0-2.2 1.8-3.4 4.4-3.4s4.4 1.2 4.4 3.4v8c0 2.2-1.8 3.4-4.4 3.4s-4.4-1.2-4.4-3.4Z'],
  ],
  line: [
    'M4.2 10.4c13.2-.8 26.6-.8 39.8 0',
    'M12.8 10.6v6M24.2 10.6v9.4M35 10.6v9.2',
    'M8.4 19.8c0-2 1.8-3.2 4.4-3.2s4.4 1.2 4.4 3.2v7.2c0 2-1.8 3.2-4.4 3.2s-4.4-1.2-4.4-3.2Z',
    'M19.8 23.4c0-2.2 1.8-3.4 4.4-3.4s4.4 1.2 4.4 3.4v8c0 2.2-1.8 3.4-4.4 3.4s-4.4-1.2-4.4-3.4Z',
    'M31 22.8c0-1.8 1.6-3 4-3s4 1.2 4 3v6.4c0 1.8-1.6 3-4 3s-4-1.2-4-3Z',
  ],
  detail: [
    'M8.6 21.6h8.4M8.6 25.2h8.4M20 25.6h8.4M20 29.4h8.4M31.2 24.6h7.6M31.2 27.6h7.6',
    'M12.8 20.4v1.6M12.8 23v1.4M24.2 24.4v2M24.2 27.2v1.6M35 23.8v1.6M35 26.4v1.2',
    'M12.8 30.2v2M24.2 34.8v2M35 32.2v2',
  ],
};

/** The way through the reeds: a line of old stakes running away into tall reeds. */
const reedWay: Drawing = {
  wash: [
    ['river', 'M4.4 34.4c13-1.6 26.4-1.6 39.6 0v8.2H4.4Z'],
    ['leaf', 'M29.4 34.4c.4-8 1.6-15.6 4.4-22.4 2.6 6.4 4.4 13.4 5 21 .4-6 1.6-11.6 3.4-16.6l1.8 18Z'],
  ],
  line: [
    'M7.2 43.4v-9M13.2 40.6v-8M18.6 38.2v-7M23.4 36.4v-6M27.6 35v-5',
    'M31.4 34.4c.2-7.4 1.2-14.4 3.2-21.2M35.4 34.4c0-8.2.8-16.2 2.6-24M39.8 34.6c.2-6 1-12 2.6-17.4',
    'M4.2 34.4c13-1.6 26.4-1.6 39.8 0',
  ],
  detail: [
    'M37.4 13.6c-.6-1.8-.2-3.4 1.2-4.2.6 1.6.2 3.2-1.2 4.2Z',
    'M8.6 38.6c1.4-.5 2.8-.5 4.2 0M15 37.4c1.2-.4 2.4-.4 3.6 0M20.4 36.6c1-.4 2-.4 3 0',
    'M33.6 24.6c-1.6-1.6-2.4-3.6-2.4-6',
  ],
};

/** A heron in flight, side on: wings down, neck folded, legs trailing. */
function heronFlying(x: number, y: number, s: number): string {
  const n = (v: number): string => (Math.round(v * 100) / 100).toString();
  const p = (dx: number, dy: number): string => `${n(x + dx * s)} ${n(y + dy * s)}`;
  return (
    `M${p(-6, 0)}C${p(-3, -1.6)} ${p(1, -1.6)} ${p(4, 0)}` +
    `M${p(-1.4, -0.8)}C${p(-1, 1.6)} ${p(0.4, 3)} ${p(2, 3.6)}` +
    `M${p(-6, 0)}C${p(-7, -0.6)} ${p(-7.8, -0.2)} ${p(-8.6, 0.4)}` +
    `M${p(4, 0)}L${p(8, 0.8)}`
  );
}

/** The herons' way: herons flying south over a chain of pools that leads away down the valley. */
const heronWay: Drawing = {
  wash: [['river', `${oval(12, 40.4, 6.4, 1.8)}${oval(25, 36.6, 5, 1.4)}${oval(35, 33.4, 3.6, 1)}${oval(41.4, 31.2, 2.4, 0.7)}`]],
  line: [
    heronFlying(16, 14, 1.2),
    heronFlying(28, 19, 1),
    heronFlying(37, 12, 0.8),
    oval(12, 40.4, 6.4, 1.8),
    oval(25, 36.6, 5, 1.4),
    oval(35, 33.4, 3.6, 1),
  ],
  detail: [oval(41.4, 31.2, 2.4, 0.7), 'M4.2 27.6c8-2 14-2.4 20-1.6s12 .4 19.8-1.6'],
};

/** The turning tide: a rock face banded with tide marks, the sea below it falling away. */
const tideMarks: Drawing = {
  wash: [
    ['straw', 'M8 42.2V12.6c4.2-2.4 10-3 14.6-1.2 1.6 8.4 1.8 20.6 0 30.8Z'],
    ['river', 'M4.4 36.2c4.2-1 8.4-1 12.6 0s8.4 1 12.6 0 8.4-1 14.4 0v6.4H4.4Z'],
  ],
  line: [
    'M8 42.2V12.6c4.2-2.4 10-3 14.6-1.2 1.6 8.4 1.8 20.6 0 30.8',
    'M4.2 36.2c4.2-1 8.4-1 12.6 0s8.4 1 12.6 0 8.6-1 14.6 0',
    'M34.4 13.6v11.2M31.4 21.8l3 3 3-3',
  ],
  detail: ['M8.4 19.6c4.6.4 9.4.4 14.2 0M8.4 24.6c4.6.4 9.4.4 14.4 0M8.4 29.4c4.6.4 9.4.4 14.4 0', 'M28 40c2-.6 4-.6 6 0'],
};

/** One cherry shell: a thin fan, ribbed from the hinge. */
function fanShell(x: number, y: number, s: number, tilt: number): [string, string] {
  const n = (v: number): string => (Math.round(v * 100) / 100).toString();
  const a = (tilt * Math.PI) / 180;
  const pt = (dx: number, dy: number): string => {
    const rx = dx * Math.cos(a) - dy * Math.sin(a);
    const ry = dx * Math.sin(a) + dy * Math.cos(a);
    return `${n(x + rx * s)} ${n(y + ry * s)}`;
  };
  const outline = `M${pt(0, 3)}C${pt(-3, 2)} ${pt(-5, -1)} ${pt(-4, -3.6)}C${pt(-2.4, -5.6)} ${pt(2.4, -5.6)} ${pt(4, -3.6)}C${pt(5, -1)} ${pt(3, 2)} ${pt(0, 3)}Z`;
  const ribs = `M${pt(0, 3)}L${pt(-2.6, -3.8)}M${pt(0, 3)}L${pt(0, -4.4)}M${pt(0, 3)}L${pt(2.6, -3.8)}`;
  return [outline, ribs];
}

const SHELLS = [fanShell(14, 22, 1.6, -14), fanShell(30, 18, 1.4, 18), fanShell(24, 34, 1.7, 4), fanShell(37.6, 32, 1.1, -30)];

/** Cherry shells: thin pink shells like petals, scattered on the sand. */
const cherryShells: Drawing = {
  wash: [['blossom', SHELLS.map(([o]) => o).join('')]],
  line: SHELLS.map(([o]) => o),
  detail: SHELLS.map(([, r]) => r),
};

/** A moon shell: round and smooth, its whorl turning in to a small navel. */
const moonShell: Drawing = {
  wash: [['straw', 'M24.4 37.4c-8.4 0-14-5.6-14-12.4s5.6-12.4 13.6-12.4 13.6 5.2 13.6 11.6c0 7.2-5.4 13.2-13.2 13.2Z']],
  line: [
    'M24.4 37.6c-8.4 0-14.2-5.6-14.2-12.6s5.8-12.4 13.8-12.4 13.6 5.2 13.6 11.6c0 7.2-5.4 13.4-13.2 13.4Z',
    'M24.2 30c-3 0-5-2.2-5-4.8s2.2-4.6 4.8-4.6 4.4 2 4.4 4.2',
  ],
  detail: ['M28.4 24.8c0 3.4-2 6.4-5 7.6M30 18.6c3 1.8 4.8 4.8 4.8 8.2', ring(24, 25.4, 1.2)],
};

/** A cowrie: a glossy dome, spotted, with the toothed slit along its underside. */
const cowrie: Drawing = {
  wash: [
    ['straw', oval(24, 25.6, 13.6, 9.4)],
    ['blossom', 'M14 28.6c6.4 2.4 13.6 2.4 20 0-1.8 4-5.6 6.2-10 6.2s-8.2-2.2-10-6.2Z'],
  ],
  line: [oval(24, 25.6, 13.6, 9.4), 'M12.6 29.4c7.2 2.2 15.6 2.2 22.8 0'],
  detail: ['M15.6 30.2l.6 1.4M18.6 30.8l.4 1.4M21.6 31.2l.2 1.4M24.6 31.2v1.4M27.6 31l-.2 1.4M30.6 30.6l-.4 1.4', 'M16 19.6c2.4-2.4 5.6-3.6 9-3.6'],
  dots: [[20.4, 22, 0.7], [25.4, 20.6, 0.6], [29.6, 23, 0.7], [17.4, 25.4, 0.55], [23.6, 25.2, 0.6], [32, 26.6, 0.5], [27.6, 27, 0.5]],
};

/** The first sight of the sea: the last two hills part, the river runs on into open water. */
const firstSea: Drawing = {
  wash: [
    ['river', 'M14.2 29.2h19.6c-2.4 1.4-5.6 2.2-9.8 2.2s-7.4-.8-9.8-2.2ZM22.8 44c.2-4 .8-8.4 1.6-12.4 1 4 1.6 8.4 1.8 12.4Z'],
    ['leaf', 'M4.4 17.4c6.6 2 11 8 12.8 17.4l-2 8.8H4.4ZM43.6 15.6c-6.8 2-11.2 8.2-13 18.6l1.8 9.4h11.2Z'],
  ],
  line: [
    'M4.2 17.4c6.6 2 11 8 12.8 17.4 .4 2.6.6 5.4.4 8.4',
    'M43.8 15.6c-6.8 2-11.2 8.2-13 18.6-.4 2.8-.4 6 0 9.2',
    'M13.6 29.2h20.8',
    'M22.6 44c.2-4 .8-8.4 1.8-12.4 1 4 1.6 8.4 1.8 12.4',
  ],
  detail: ['M17.6 31.6c2-.4 4-.4 6 0M26 32.6c1.8-.4 3.6-.4 5.4 0', 'M19.4 26.8c1.4-.8 2.8-.8 4 0'],
};

/** The high path: a track along the wooded ridge, dry above the flooded river below. */
const highPath: Drawing = {
  wash: [['river', 'M3 40Q14 34 24 38T45 35V44H3Z'], ['leaf', 'M5 23Q9 11 14 22ZM33 17Q37 6 42 17Z']],
  line: ['M3 30Q12 22 22 24T45 15', 'M3 33Q12 25 22 27T45 18', 'M9.5 22V27M37.5 16V21', 'M3 40Q14 34 24 38T45 35'],
  detail: ['M14 26.5l2-.8m5 0 2-.4m6-2.6 2-1', 'M8 41.5q2-1 4 0m14-1.5q2-1 4 0'],
};

export const CURIOSITIES: Record<string, Drawing> = {
  'old-watercourse': {
    wash: [['river', 'M17 6C34 18 5 27 21 43L29 43C13 27 42 18 25 6Z']],
    line: ['M17 6C34 18 5 27 21 43', 'M25 6C42 18 13 27 29 43', 'M10 7C26 20 0 28 13 42'],
    detail: ['M9 12l2 2m1 5-1 3m-3 6v3m2 5 1 2', 'M23 11l3 2m-6 17 3 2'],
  },
  'spray-rainbow': sprayRainbow,
  'tarn-twice': tarnTwice,
  'river-agate': riverAgate,
  'stone-shell': stoneShell,
  'long-view': longView,
  lanterns,
  'reed-way': reedWay,
  'heron-way': heronWay,
  'high-path': highPath,
  'tide-marks': tideMarks,
  'cherry-shells': cherryShells,
  'moon-shell': moonShell,
  cowrie,
  'first-sea': firstSea,
};

/**
 * The finds of the new Seseragi places and the later seasons in Mio and
 * Kawagiri: the plum orchard and Tomi's kitchen plots, the mill and its pool,
 * the old riverbed, the lantern house's eaves, the terraces, the bay.
 */

import { oval, ring, type Drawing } from './pen';
import { bloom } from './places';

/** A small perching songbird facing left: body, tail, the eye left to `dots`. */
function songbird(x: number, y: number, s = 1): string {
  const n = (v: number): string => (Math.round(v * 100) / 100).toString();
  const p = (dx: number, dy: number): string => `${n(x + dx * s)} ${n(y + dy * s)}`;
  return (
    `M${p(-6, -1)}C${p(-5.4, -4.6)} ${p(-1.4, -6)} ${p(1.6, -4.4)}C${p(4.6, -2.8)} ${p(6, 0)} ${p(11, 3.6)}` +
    `C${p(7.2, 3.4)} ${p(5, 3)} ${p(3.6, 2.6)}C${p(1.4, 4.4)} ${p(-3.4, 4)} ${p(-5, 1.6)}` +
    `M${p(-6, -1)}L${p(-8.4, -0.4)}L${p(-5.8, 0.4)}`
  );
}

/** Plum blossom: a bare twig with round white five-petalled flowers, out before the leaves. */
const plumBlossom: Drawing = {
  wash: [['blossom', `${bloom(20, 16, 5.2, 10)}${bloom(32, 26, 4.6, -8)}${bloom(14, 32, 4, 20)}`]],
  line: ['M6 42c6-6 12-10 20-12.6 6-2 11-6 15.6-12.4', 'M20.4 30.6c-1.4-3.6-1-7.4.6-10.6', bloom(20, 16, 5.2, 10), bloom(32, 26, 4.6, -8), bloom(14, 32, 4, 20)],
  detail: ['M38.6 19.6c1.4-.4 2.4-1.4 2.8-2.8'],
  dots: [[20, 16, 0.7], [32, 26, 0.6], [14, 32, 0.55], [41.6, 15.6, 0.7]],
};

/** Green plums: hard round fruit on short stalks among narrow leaves. */
const ume: Drawing = {
  wash: [
    ['leaf', `${ring(17, 28, 5)}${ring(28.6, 31, 4.6)}${ring(23, 39, 4.2)}`],
    ['leaf', 'M30 18c4-4.6 9.4-5.4 13.4-3.6-2.6 4.4-8 5.8-13.4 3.6Z'],
  ],
  line: [
    'M5 12c8 1.6 16 2.6 25 6 4 1.6 8 1.2 13-1',
    ring(17, 28, 5),
    ring(28.6, 31, 4.6),
    ring(23, 39, 4.2),
    'M17 23c.4-2.4 1-4 1.8-5.6M28.6 26.4c0-2.4-.4-4.4-1.2-6.4M23 34.8c-.4-6-.4-10.6 0-14.4',
    'M30 18c4-4.6 9.4-5.4 13.4-3.6-2.6 4.4-8 5.8-13.4 3.6Z',
    'M12.6 13.4c-3.4 2.6-7.6 3-11 1.4 3-3 7.2-3.6 11-1.4Z',
  ],
  detail: ['M15 26.6c.8-.8 1.8-1.2 2.8-1.2M27 29.8c.6-.6 1.4-1 2.4-1', 'M31.4 17.8l10-3'],
};

/** Bush warbler: small, olive and plain, singing from a plum twig, a pale eyebrow its only mark. */
const bushWarbler: Drawing = {
  wash: [['leaf', 'M15.6 23c.6-3.6 4.6-5 7.6-3.4 3 1.6 4.4 4.4 9.4 8-3.8-.2-6-.6-7.4-1-2.2 1.8-7.2 1.4-8.8-1-.4-1-.6-1.8-.8-2.6Z']],
  line: [songbird(21.6, 24, 1), 'M6 34.6c8-2.6 18-3.8 30-2.8 3 .2 5.4.8 7.6 1.6', 'M21 27.4l-.6 5M24 27.6l.8 4.6', 'M34 31.8c1.4-1.2 3-1.8 4.8-1.6'],
  detail: ['M17.4 20.6c1.4-.8 3-1 4.4-.6', 'M11.4 20.4c-1.2-1-1.4-2.4-.6-3.6M9.6 22.2c-1.6-.4-2.4-1.4-2.4-2.8'],
  dots: [[17.6, 22.2, 0.7]],
};

/** Tomi's garden: an old woman with a hoe at the end of her kitchen rows, a twist of seeds in her hand. */
const tomi: Drawing = {
  wash: [
    ['straw', 'M14.6 19.4c-2.4 6.4-3.6 13.4-3.6 21.2h9.8c0-7.4-.8-14.4-2.6-21Z'],
    ['leaf', 'M24 38.4c6.6-1.4 13.2-1.6 19.6-.6v5c-6.6-1-13.2-.8-19.6.6Z'],
  ],
  line: [
    ring(16.2, 15.2, 2.7),
    'M13.6 13.4c1.6-1.8 3.8-2 5.6-.8',
    'M14.4 19.4c-2.4 6.4-3.6 13.4-3.6 21.4h10c0-7.4-.8-14.4-2.6-21.2',
    'M18.6 22.6c2.4 1.6 4.4 3.8 5.6 6.4',
    'M28.8 12.8 22.4 41M20.6 41.2c1.4-.6 2.8-.6 4.2 0',
    'M24 38.4c6.6-1.4 13.2-1.6 19.6-.6M24 43c6.6-1.4 13.2-1.6 19.6-.6',
  ],
  detail: ['M27.4 37.6l-.6-2.4M31.4 37.2l.4-2.6M35.4 37l-.4-2.4M39.4 37.2l.4-2.4', 'M14.8 18c.6.4 1.6.4 2.2 0'],
  dots: [[15.2, 15, 0.35], [17.2, 15, 0.35], [8.4, 26.2, 0.6], [7.4, 27.8, 0.5]],
};

/** The first beans: three young pods hanging from a twining vine. */
const firstBeans: Drawing = {
  wash: [
    ['leaf', 'M15.6 14.4c1.6 5.4 1.4 12.6-.8 20.6-1.6-.4-2.4-1.6-2.2-3.4 1-5.6 1.4-11.4 1.2-17.2ZM25.4 17.4c1.8 6 1.8 13.4-.4 21.8-1.4-.4-2.2-1.6-2-3.4 1-6 1.4-12.2 1.2-18.4Z'],
    ['leaf', 'M31 9.6c3.6-2.8 8.4-2.8 11.2-.4-2.6 3.4-7.6 3.6-11.2.4Z'],
  ],
  line: [
    'M4.4 9.8c8.4-1.2 17.4-1 26.6.4 3 .6 5.6 0 8-1.8',
    'M15.6 14.4c1.6 5.4 1.4 12.6-.8 20.6-1.6-.4-2.4-1.6-2.2-3.4 1-5.6 1.4-11.4 1.2-17.2',
    'M25.4 17.4c1.8 6 1.8 13.4-.4 21.8-1.4-.4-2.2-1.6-2-3.4 1-6 1.4-12.2 1.2-18.4',
    'M33.6 14.4c1.2 4.2 1.2 9.2-.4 14.8-1.2-.4-1.8-1.4-1.6-2.8.8-4 1-8 .8-12',
    'M15 10.2c.2 1.4.4 2.8.6 4.2M24.6 10.8l.8 6.6M33.2 10.6l.4 3.8',
    'M31 9.6c3.6-2.8 8.4-2.8 11.2-.4-2.6 3.4-7.6 3.6-11.2.4Z',
  ],
  detail: ['M14.6 20.4l.6.4M14.2 25.6l.6.4M24.6 23.4l.6.4M24.2 29.2l.6.4M33 19.4l.6.4', 'M8 9.6c-1.6 1.8-2 3.8-1.2 5.6'],
};

/** Winter radish: a long white root, earth still on it, under a crown of leaves. */
const daikon: Drawing = {
  wash: [
    ['leaf', 'M22 12c-3.4-3.6-4-7.4-1.6-9.4 2.6 1.6 3.4 5 1.6 9.4ZM25.6 12.4c1.6-4.2 4.8-6.4 8.2-5.6-.4 3.4-3.6 5.6-8.2 5.6Z'],
    ['straw', 'M18.8 38.4c2.6 2.6 5.2 4 8 4.4'],
  ],
  line: [
    'M19.6 13.6c-.6 9.6 1.4 20 6.6 31 .6.6 1.4.4 1.6-.4.6-10.6.4-20.8-1.4-30.6-2.2-.8-4.6-.8-6.8 0Z',
    'M22 12c-3.4-3.6-4-7.4-1.6-9.4 2.6 1.6 3.4 5 1.6 9.4Z',
    'M25.6 12.4c1.6-4.2 4.8-6.4 8.2-5.6-.4 3.4-3.6 5.6-8.2 5.6Z',
    'M21 12.8c-3.6-.6-6.8 0-9.2 2 2.8 1.6 6.4 1.4 9.2-2Z',
  ],
  detail: ['M21 20.2l1.6.4M21.8 26l1.6.4M23 31.8l1.4.4', 'M20.6 5.6l1 5.8M31 8.2l-4.4 3.6M14.4 14.4l5.6-1'],
};

/** A coin in the race: an old round coin with a square hole, lying among the stones of a dry channel. */
const millCoin: Drawing = {
  wash: [['straw', ring(24, 26, 10)]],
  line: [ring(24, 26, 10), 'M21 23h6v6h-6Z', 'M4.4 41.6c4-2 8-2.4 12-1.2M31 41.8c4.4-1.6 8.6-1.8 12.6-.4'],
  detail: [ring(24, 26, 8.2), 'M17.4 20.4l1.2 1.2M30.6 20.4l-1.2 1.2M17.4 31.6l1.2-1.2M30.6 31.6l-1.2-1.2', oval(10, 39.2, 3, 1.4), oval(38, 38.6, 3.6, 1.6)],
};

/** One dragonfly seen from above: long body, two pairs of narrow wings. */
function dragonfly(x: number, y: number, s: number, deg = 0): string {
  const n = (v: number): string => (Math.round(v * 100) / 100).toString();
  // Tilted into flight, so the long body never stands upright like a trunk.
  const [c, sn] = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
  const p = (dx: number, dy: number): string => `${n(x + (dx * c - dy * sn) * s)} ${n(y + (dx * sn + dy * c) * s)}`;
  return (
    `M${p(0, -3)}L${p(0.2, 12)}` +
    `M${p(0, -1)}C${p(-4, -3.4)} ${p(-9, -3.6)} ${p(-11, -2)}C${p(-9, -0.4)} ${p(-4, -0.2)} ${p(0, -0.6)}` +
    `M${p(0, -1)}C${p(4, -3.4)} ${p(9, -3.6)} ${p(11, -2)}C${p(9, -0.4)} ${p(4, -0.2)} ${p(0, -0.6)}` +
    `M${p(0, 1)}C${p(-3.6, 0.6)} ${p(-8, 1.4)} ${p(-9.6, 3.2)}C${p(-7.4, 4)} ${p(-3.4, 3)} ${p(0, 1.6)}` +
    `M${p(0, 1)}C${p(3.6, 0.6)} ${p(8, 1.4)} ${p(9.6, 3.2)}C${p(7.4, 4)} ${p(3.4, 3)} ${p(0, 1.6)}`
  );
}

/** Blue dragonflies hunting over the mill pool. */
const dragonflies: Drawing = {
  wash: [
    ['river', 'M4.4 38.4c13-1.4 26.4-1.4 39.6 0v4.4H4.4Z'],
  ],
  line: [dragonfly(18, 16, 1, 62), dragonfly(34, 26, 0.75, -55), 'M4.2 38.4c13-1.4 26.4-1.4 39.8 0'],
  detail: ['M10 41.4c2-.6 4-.6 6 0M28 41c2-.6 4-.6 6 0', 'M6 22c1.6-.8 3-.8 4.4 0M40 14c1.4-.6 2.6-.6 3.8 0'],
  dots: [[18 - 3 * Math.sin(62 * Math.PI / 180) * -1, 16 - 3 * Math.cos(62 * Math.PI / 180), 1], [34 + 3 * 0.75 * Math.sin(-55 * Math.PI / 180), 26 - 3 * 0.75 * Math.cos(-55 * Math.PI / 180), 0.8]],
};

/** Fiddleheads: three fern shoots unrolling, each tip curled like a violin's scroll. */
const fiddleheads: Drawing = {
  wash: [['leaf', `${ring(16, 14.6, 4)}${ring(28.6, 19.4, 3.4)}${ring(37.6, 26.4, 2.8)}`]],
  line: [
    'M15.4 42.4c-.8-8.4-.4-17 1.6-23.6 2-1 3.4-2.8 3-5-.4-2.4-2.8-3.8-5.2-3.2-2.4.6-3.6 3-2.8 5.2.6 1.6 2.2 2.4 3.6 1.8 1.2-.4 1.6-1.8 1-2.8',
    'M27.4 42.4c-.4-7.2 0-13.8 1.6-18.8 1.8-.8 2.8-2.4 2.4-4.2-.4-2-2.4-3.2-4.4-2.6-2 .6-3 2.6-2.2 4.4.6 1.2 1.8 1.8 3 1.4',
    'M37.4 42.4c-.2-5.6.2-10.6 1.4-14.6 1.4-.6 2.2-2 1.8-3.4-.4-1.6-2-2.4-3.6-1.8-1.4.4-2.2 2-1.6 3.4',
    'M8 42.6c11-1.2 22-1.2 33 0',
  ],
  detail: ['M16.2 26.6l-1.6-.6M16 32l-1.6-.6M28.4 30l-1.4-.6M28.2 35l-1.4-.6M38 34l-1.2-.6'],
};

/** Copper pheasant: russet and shy, slipping away low, its long barred tail behind it. */
const copperPheasant: Drawing = {
  wash: [
    ['blossom', 'M10.4 22.6c1.2-3.4 4.6-4.4 7.2-2.6 3.4-.4 7 1 9.6 3.6 4.4 1 9.4 3.4 16.6 8-6 .2-11.4-.4-16.6-2-3 1.8-7.6 2-11.6.4-2.6-1.6-4.2-4.4-5.2-7.4Z'],
    ['straw', 'M27 23.6c4.4 1 9.4 3.4 16.6 8-6 .2-11.4-.4-16.6-2Z'],
  ],
  line: [
    'M10.2 22.6c1.2-3.4 4.6-4.4 7.4-2.6 3.4-.4 7 1 9.6 3.6 4.4 1 9.4 3.4 16.8 8',
    'M44 31.6c-6 .2-11.4-.4-16.8-2-3 1.8-7.6 2-11.6.4-2.6-1.6-4.2-4.4-5.4-7.4',
    'M10.2 22.6l-3 .6 2.8 1.2',
    'M17.4 31.4l-.8 6.8 2.4 1M21.6 31.6l1 6.6 2.2.6',
    'M4.4 40.6c12-1.4 24-1.4 36 0',
  ],
  detail: ['M30 26.2l-.6 2.4M33.6 27.4l-.6 2.4M37.2 28.8l-.6 2.2M40.4 30.2l-.4 1.6', 'M15.2 22.4c2 1.8 4.6 2.6 7.6 2.4'],
  dots: [[12.4, 21.8, 0.6]],
};

/** The flood line: a pale mark across a great boulder in the old bed, higher than the person beside it. */
const floodLine: Drawing = {
  wash: [
    ['straw', 'M8.4 42.4c-1.6-10 .8-20.2 7.2-27.6 6.6-2.2 14.4-1.6 20 2 4.4 7.6 5.8 16.2 4.2 25.6Z'],
    ['river', 'M10.4 22.6c9-2.4 19-2.6 28.2-.8l.4 2.4c-9.4-1.8-19.4-1.6-28.6 1Z'],
  ],
  line: ['M8.2 42.6c-1.6-10 .8-20.4 7.4-27.8 6.6-2.2 14.4-1.6 20.2 2 4.4 7.6 5.8 16.2 4.2 25.8', 'M10.6 23c9-2.4 19-2.6 28.2-.8', ring(43, 32.4, 1.4), 'M43 33.8v5M43 38.8l-1.4 3.6M43 38.8l1.4 3.6M41.4 35.6h3.2', 'M4.2 42.6h39.8'],
  detail: ['M14 31c3-.6 6-.6 9 0M24 36.6c3-.6 6-.4 9 .4M20 17.6c2.4-.4 4.6-.2 6.8.6'],
};

/** Watercress: rounded leaflets on soft stems in a seep of cold water. */
const watercress: Drawing = {
  wash: [
    ['leaf', `${oval(16, 20, 3.4, 2.6)}${oval(23.4, 15.6, 3, 2.4)}${oval(30.4, 19.4, 3.4, 2.6)}${oval(19.6, 27.2, 3, 2.2)}${oval(28, 26.4, 3, 2.2)}`],
    ['river', 'M4.4 36.2c13-1.6 26.4-1.6 39.6 0v6.4H4.4Z'],
  ],
  line: [
    'M23.6 37.2c-.4-6.6-.2-13.6.2-21',
    'M23.6 31.6c-2.6-1.2-3.8-2.6-4-4.4M23.6 30.6c2-1.4 3.6-2.8 4.4-4.2M23.6 24c-3.6-1-6.2-2.2-7.6-4M23.6 23.6c3.2-.8 5.6-2.2 6.8-4.2',
    oval(16, 20, 3.4, 2.6),
    oval(23.4, 15.6, 3, 2.4),
    oval(30.4, 19.4, 3.4, 2.6),
    oval(19.6, 27.2, 3, 2.2),
    oval(28, 26.4, 3, 2.2),
    'M4.2 36.2c13-1.6 26.4-1.6 39.8 0',
  ],
  detail: ['M10 39.6c2-.6 4-.6 6 0M32 39.8c2-.6 4-.6 6 0'],
};

/** The boat in the reeds: a little grey river boat pulled up long ago, reeds grown up round it. */
const oldBoat: Drawing = {
  wash: [
    ['straw', 'M8.6 30.4h29.2c-2 4.6-6.6 7-14.6 7s-12.6-2.4-14.6-7Z'],
    ['leaf', 'M34.6 37c.6-9.4 2.2-18.4 5-26.4 1.6 8.6 2.6 17.6 3 26.4Z'],
  ],
  line: [
    'M8.4 30.4h29.6c-2 4.6-6.6 7-14.8 7S10.4 35 8.4 30.4Z',
    'M7.4 29.4c.6.4 1 .8 1 1M38.8 29.4c-.6.4-1 .8-1 1',
    'M36.6 37.4c.4-8.4 1.6-16.6 3.8-24.4M40.6 37.4c0-7.6.6-15 1.8-22M33 37.4c-.2-6 .4-11.6 1.8-17',
    'M4.2 40.2c13-1.4 26.4-1.4 39.8 0',
  ],
  detail: ['M14 31v5M20 31v6M26.4 31v6M32 31v5', 'M40 12.6c-.6-1.8-.2-3.4 1.2-4.4.6 1.8.2 3.4-1.2 4.4Z', 'M6.2 33.6l-.4-3.2M4.8 34l-1.2-2.8'],
};

/** A swallow in flight: swept wings and a deep forked tail. */
function swallow(x: number, y: number, s: number): string {
  const n = (v: number): string => (Math.round(v * 100) / 100).toString();
  const p = (dx: number, dy: number): string => `${n(x + dx * s)} ${n(y + dy * s)}`;
  return (
    `M${p(-7, -2.4)}C${p(-4, -1.6)} ${p(-1.6, -0.4)} ${p(0, 0)}C${p(1.6, -0.4)} ${p(4, -1.6)} ${p(7, -2.4)}` +
    `M${p(-1, -0.2)}C${p(-0.6, 1.6)} ${p(0.6, 1.6)} ${p(1, -0.2)}` +
    `M${p(-0.4, 1.4)}L${p(-1.8, 4.6)}M${p(0.4, 1.4)}L${p(1.8, 4.6)}`
  );
}

/** Swallows under the eaves: mud nests along a roof's edge, birds coming and going. */
const swallows: Drawing = {
  wash: [
    ['straw', 'M4.4 8.6c13.2-1.6 26.4-2.4 39.6-2.6v4.4c-13.2.4-26.4 1.2-39.6 2.8Z'],
    ['straw', 'M12.4 12.8c0 2.6 1.6 4 3.6 4s3.6-1.4 3.6-4ZM28.4 12c0 2.6 1.6 4 3.6 4s3.6-1.4 3.6-4Z'],
  ],
  line: [
    'M4.2 8.6c13.2-1.6 26.6-2.4 39.8-2.6M4.2 12.6c13.2-1.6 26.6-2.4 39.8-2.6',
    'M12.4 12.8c0 2.6 1.6 4 3.6 4s3.6-1.4 3.6-4',
    'M28.4 12c0 2.6 1.6 4 3.6 4s3.6-1.4 3.6-4',
    swallow(16, 30, 1.3),
    swallow(33, 24, 1),
    swallow(36, 37, 0.8),
  ],
  detail: ['M8 12v2M24 11.4v2M40 10.6v2'],
};

/** A planter bent to the work, knee-deep, a bundle of seedlings in one hand. */
function planter(x: number, y: number, s: number): string {
  const n = (v: number): string => (Math.round(v * 100) / 100).toString();
  const p = (dx: number, dy: number): string => `${n(x + dx * s)} ${n(y + dy * s)}`;
  return (
    `M${p(-3.4, -6.6)}a${n(1.6 * s)} ${n(1.6 * s)} 0 1 0 ${n(3.2 * s)} 0a${n(1.6 * s)} ${n(1.6 * s)} 0 1 0 ${n(-3.2 * s)} 0Z` +
    `M${p(-0.6, -5.8)}C${p(1.6, -5.4)} ${p(3.6, -3.4)} ${p(4, 0)}` +
    `M${p(0.6, -4.8)}L${p(-1.4, -1)}M${p(4, 0)}L${p(3, 4)}M${p(4, 0)}L${p(5.6, 4)}` +
    `M${p(-1.4, -1)}L${p(-1.8, 1.6)}`
  );
}

/** Rice planting: the village knee-deep in a flooded terrace, planting in rows. */
const ricePlanting: Drawing = {
  wash: [
    ['river', 'M4.4 30.4c13-1.2 26.4-1.2 39.6 0v8.4c-13-1.2-26.4-1.2-39.6 0Z'],
    ['leaf', 'M4.4 20.4c13-1.2 26.4-1.2 39.6 0v4.4c-13-1.2-26.4-1.2-39.6 0Z'],
  ],
  line: [
    'M4.2 30.4c13-1.2 26.4-1.2 39.8 0M4.2 38.8c13-1.2 26.4-1.2 39.8 0',
    'M4.2 24.8c13-1.2 26.4-1.2 39.8 0',
    planter(12, 32, 1.3),
    planter(24, 31, 1.2),
    planter(35, 32, 1.1),
  ],
  detail: [
    'M7 36.4v-2M9.4 36.4v-2M18 36v-2M20.4 36v-2M28.6 36v-2M31 36v-2M40 36.2v-2',
    'M6 22.6v-1.6M10 22.4v-1.6M14 22.4v-1.6M18 22.4v-1.6M22 22.4v-1.6M26 22.4v-1.6M30 22.4v-1.6M34 22.4v-1.6M38 22.4v-1.6',
  ],
};

/** The flood line in the willows: sticks, reeds and a wooden spoon caught high in a willow's fork. */
const floodWrack: Drawing = {
  wash: [
    ['leaf', 'M10.6 12.4c3.6-5.2 9.4-6.8 14-4.8 4.4-1.8 10.4.2 12.4 4.6-6.4 2.4-14.4 2.6-26.4.2Z'],
    ['straw', 'M14.4 21.6c6.4-.8 13-.6 19.6.6l-.4 2.6c-6.6-1.2-13.2-1.4-19.6-.6Z'],
  ],
  line: [
    'M21.2 42.4c-.4-7-.4-13.6.4-20.4M26.8 42.4c.4-7 .2-13.6-.6-20.4',
    'M21.6 22c-2-3-4.6-5.2-7.6-6.6M26.2 22c1.8-3.4 4.4-6 7.6-7.8',
    'M13.8 22c6.6-1 13.4-.8 20.2.6M15 24.6c5.8-.8 11.6-.6 17.6.6',
    'M29 18.4l7.4-4.6',
    oval(37.6, 13, 1.8, 1.2),
    'M4.2 42.6h39.8',
  ],
  detail: ['M12.4 14c-.8 3.2-1 6.6-.6 10M35.6 13.8c.8 3.4.8 6.8.2 10M17.4 23.2l.6-1.6M24 23.6l.4-1.8M30.4 23.8l.4-1.6'],
};

/** Frog song: a frog on the edge of a ditch at dusk, throat puffed out to sing. */
const frogs: Drawing = {
  wash: [
    ['leaf', 'M12.4 30.6c0-6.4 4.8-11 11-11 5 0 8.4 2.8 9.6 7 3 1.2 4.6 3.4 4.6 6.4-6.8 1.6-17.6 1.6-25.2-2.4Z'],
    ['river', 'M4.4 38.4c13-1.4 26.4-1.4 39.6 0v4.4H4.4Z'],
  ],
  line: [
    'M12.4 30.6c0-6.4 4.8-11 11-11 5 0 8.4 2.8 9.6 7 3 1.2 4.6 3.4 4.6 6.4',
    'M12.4 30.6c3.4 1.8 8 2.8 13.2 2.8M37.6 33c-2.4.6-5.2.8-8 .6',
    'M28.2 21.6c0-1.8 1.2-3 2.8-3s2.8 1.2 2.8 3',
    oval(35.8, 30, 3.2, 2.6),
    'M17 32.6c-2 .8-4 2.4-5 4.6h5.2M30 34c1.4 1.2 2.2 2.4 2.4 3.6h3.4',
    'M4.2 38.4c13-1.4 26.4-1.4 39.8 0',
  ],
  detail: ['M17.4 25.2c1.4-.6 2.8-.6 4 0M20.4 28.4c1-.4 2-.4 3 0', 'M40.6 26.4c1.4-.6 2.4-1.8 2.6-3.2M41 30c1.6 0 2.8-.6 3.4-1.6'],
  dots: [[31, 21.4, 0.8]],
};

/** Wild garlic: broad pointed leaves and round heads of small starry white flowers. */
const wildGarlic: Drawing = {
  wash: [
    ['leaf', 'M12 42c-2.4-9.2-1.6-17.6 2.4-24.4 3.4 7.6 3.8 15.8 1.4 24.4ZM30.6 42c-1-9.4 1.2-17.4 6-24 2.2 8.4 1.4 16.4-2.6 24Z'],
    ['straw', `${ring(24, 13.6, 5)}`],
  ],
  line: [
    'M12 42c-2.4-9.2-1.6-17.6 2.4-24.4 3.4 7.6 3.8 15.8 1.4 24.4',
    'M30.6 42c-1-9.4 1.2-17.4 6-24 2.2 8.4 1.4 16.4-2.6 24',
    'M23.8 42c-.4-8.4-.2-16.8.2-23.8',
    'M24 18.2l-3.8-3.6M24 18.2l-1-5M24 18.2l2.4-4.6M24 18.2l4.2-2.8M24 18.2l-4.6-.6',
  ],
  detail: ['M14 35l.4-10M33 35l1.6-10', 'M6 42.4h36'],
  dots: [[20, 14.4, 0.9], [22.8, 12.8, 0.9], [26.6, 13.4, 0.9], [28.4, 15.4, 0.8], [19.4, 17.6, 0.8], [24.4, 10.4, 0.8]],
};

/** A rose, seen from the front: an open cup of petals round a tight spiral heart. */
function rose(x: number, y: number, r: number): string {
  const n = (v: number): string => (Math.round(v * 100) / 100).toString();
  return (
    `M${n(x - r)} ${n(y)}c0-${n(r * 1.2)} ${n(r * 0.8)}-${n(r * 1.1)} ${n(r)}-${n(r * 1.1)}s${n(r)} ${n(r * 0.1)} ${n(r)} ${n(r * 1.1)}-${n(r * 0.6)} ${n(r)}-${n(r)} ${n(r)}-${n(r)}-${n(r * 0.2)}-${n(r)}-${n(r)}Z` +
    `M${n(x + r * 0.2)} ${n(y)}c0-${n(r * 0.4)}-${n(r * 0.4)}-${n(r * 0.5)}-${n(r * 0.5)}-${n(r * 0.2)}-${n(r * 0.2)} ${n(r * 0.4)} ${n(r * 0.2)} ${n(r * 0.6)} ${n(r * 0.6)} ${n(r * 0.4)}`
  );
}

/** The old roses: sprays of half-wild roses over the top of a garden wall. */
const oldRoses: Drawing = {
  wash: [
    ['blossom', `${ring(14, 18, 4.4)}${ring(26, 14, 4.8)}${ring(36, 20, 3.8)}`],
    ['straw', 'M4.4 28.2h39.6v14.2H4.4Z'],
  ],
  line: [rose(14, 18, 4.2), rose(26, 14, 4.6), rose(36, 20, 3.6), 'M4.2 28.2h39.8', 'M14.6 22.2c.6 2 .6 4-.4 6M26 18.8c0 3.2-.6 6.4-2 9.6M35.6 23.6c-.6 1.6-.6 3.2 0 4.6'],
  detail: [
    'M4.4 33h12M18.4 33h12.4M32.4 33h11.6M10 37.6h12.4M24.4 37.6h12M4.4 42.2h39.6',
    'M16.6 28.4V33M30.6 28.4V33M22.4 33v4.6M36.4 33v4.6',
    'M19.6 22.6c1.6-1.6 3.4-2 5.2-1.6-1.4 1.6-3.2 2-5.2 1.6ZM30 24c1.4 1.4 3.2 1.8 5 1.2-1.2-1.6-3-2-5-1.2Z',
  ],
};

/** A whitebait: slender and clear, all eye. */
function whitebait(x: number, y: number, s: number, tilt: number): string {
  const n = (v: number): string => (Math.round(v * 100) / 100).toString();
  const a = (tilt * Math.PI) / 180;
  const p = (dx: number, dy: number): string => {
    const rx = dx * Math.cos(a) - dy * Math.sin(a);
    const ry = dx * Math.sin(a) + dy * Math.cos(a);
    return `${n(x + rx * s)} ${n(y + ry * s)}`;
  };
  return `M${p(-6, 0)}C${p(-4, -1.6)} ${p(2, -1.4)} ${p(5, 0)}L${p(7, -1.4)}L${p(6.6, 0)}L${p(7, 1.4)}L${p(5, 0)}C${p(2, 1.4)} ${p(-4, 1.6)} ${p(-6, 0)}Z`;
}

const SHOAL: Array<[number, number, number, number]> = [[12, 16, 1.1, -6], [24, 13, 1, -2], [35, 18, 1.05, 4], [16, 26, 1, 0], [29, 25, 1.1, -4], [21, 35, 1, 2], [34, 33, 0.95, -6]];

/** Whitebait: a shoal of glassy little fish running up the creek, their eyes the first thing you see. */
const whitebaitShoal: Drawing = {
  wash: [['river', 'M6 20c4-10 30-12 36-2 4 6 2 16-6 20-10 4-26 4-30-6-1.6-4-1.6-8 0-12Z']],
  line: SHOAL.map(([x, y, s, t]) => whitebait(x, y, s, t)),
  dots: SHOAL.map(([x, y, s, t]): [number, number, number] => {
    const a = (t * Math.PI) / 180;
    return [x + -4.2 * s * Math.cos(a), y + -4.2 * s * Math.sin(a), 0.75];
  }),
};

/** Clams from the mud: one closed shell and one open, ribbed, on the low mud. */
const clams: Drawing = {
  wash: [
    ['straw', 'M8 30.4c0-6.4 4.6-10.6 10.4-10.6s10.4 4.2 10.4 10.6c-3.4 2-6.8 3-10.4 3s-7-1-10.4-3Z'],
    ['blossom', 'M28.6 34.4c2-4.4 5.2-6.6 8.6-6.6s6 2.2 6.8 6.6c-2.4 1.2-4.8 1.8-7.4 1.8s-5.6-.6-8-1.8Z'],
  ],
  line: [
    'M8 30.4c0-6.4 4.6-10.6 10.4-10.6s10.4 4.2 10.4 10.6c-3.4 2-6.8 3-10.4 3s-7-1-10.4-3Z',
    'M28.4 34.4c2-4.4 5.2-6.6 8.6-6.6s6 2.2 6.8 6.6c-2.4 1.2-4.8 1.8-7.4 1.8s-5.6-.6-8-1.8Z',
    'M29.2 34.2c2.4-1.6 5-2.4 8-2.4s5.4.8 6.4 2.2',
    'M4.2 39.8c13-1.4 26.4-1.4 39.8 0',
  ],
  detail: ['M11 26.4c4.6-1.6 10-1.6 14.8 0M10 29.4c5.4-1.4 11.4-1.4 17 0M13.4 23.2c3-1 6.4-1 9.4 0', 'M8 42.6c2.4-.6 4.8-.6 7.2 0M28 42.8c2.4-.6 4.8-.6 7.2 0'],
};

/** Reed bunting: a sparrow-brown bird with a black cap, clinging sideways to one reed in the wind. */
const reedBunting: Drawing = {
  wash: [
    ['straw', 'M18.8 21.2c2.4-3 6.6-3.4 9.4-1.2 2.4 2 3.4 5 3 8.6-.4 3.4-2.4 6.6-5.4 9-1.8-.6-3.2-1.8-4.2-3.4-2.6-1.6-4-4.4-3.8-7.4.2-2 .4-3.8 1-5.6Z'],
    ['leaf', 'M10.6 42.6c.4-12.4 2.2-24.4 5.6-35.6l1.8.2c-3 11.2-4.6 23-5 35.4Z'],
  ],
  line: [
    'M10.4 42.6c.4-12.4 2.2-24.4 5.8-35.8',
    'M18.8 21.2c2.4-3 6.6-3.4 9.4-1.2 2.4 2 3.4 5 3 8.6-.4 3.4-2.4 6.6-5.4 9-1.8-.6-3.2-1.8-4.2-3.4-2.6-1.6-4-4.4-3.8-7.4',
    'M26 37.6c1 2 2.4 3.6 4.4 4.8',
    'M18.8 21.2l-2.6-.4 2 2',
    'M19.6 29.4c-2 .4-3.6.2-5.4-.6M21 31.6c-2 .8-4 .8-6.2.2',
  ],
  detail: ['M18.8 21.2c2-1.6 4.8-2 7.4-1M19.6 23.6c1.8.4 3.2 1.2 4.2 2.4', 'M24.8 28.6c1.4.6 2.4 1.6 3 3'],
  dots: [[20.6, 22.4, 0.65], [21.6, 20.6, 1.2], [23.4, 20.2, 1.1]],
};

export const SEASONAL: Record<string, Drawing> = {
  'plum-blossom': plumBlossom,
  ume,
  'bush-warbler': bushWarbler,
  tomi,
  'first-beans': firstBeans,
  daikon,
  'mill-coin': millCoin,
  dragonflies,
  fiddleheads,
  'copper-pheasant': copperPheasant,
  'flood-line': floodLine,
  watercress,
  'old-boat': oldBoat,
  swallows,
  'rice-planting': ricePlanting,
  'flood-wrack': floodWrack,
  frogs,
  'wild-garlic': wildGarlic,
  'old-roses': oldRoses,
  whitebait: whitebaitShoal,
  clams,
  'reed-bunting': reedBunting,
};

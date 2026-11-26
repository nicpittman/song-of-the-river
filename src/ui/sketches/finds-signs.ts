/**
 * Signs and the hunter: the finds Haru brings into the game. Tracks along a
 * lane, a form pressed in the grass, a slide in the bank, doors of a sett, a
 * fox's earth, hair caught on a rock; a shed antler, a barred feather; and
 * Haru herself under the oaks. The prints are drawn to their animal: a hare's
 * long hind feet, a tanuki's small round pads, a heron's long three toes.
 */

import { oval, ring, type Drawing } from './pen';

/** A tanuki's print: four round toes over a round pad. */
function roundPrint(x: number, y: number, s = 1): string {
  return (
    ring(x, y + 1.1 * s, 1.1 * s) +
    ring(x - 1.5 * s, y - 0.9 * s, 0.5 * s) +
    ring(x - 0.5 * s, y - 1.6 * s, 0.5 * s) +
    ring(x + 0.5 * s, y - 1.6 * s, 0.5 * s) +
    ring(x + 1.5 * s, y - 0.9 * s, 0.5 * s)
  );
}

/** A heron's print: three long forward toes and a short back one, pointing up the page. */
function heronPrint(x: number, y: number): string {
  return `M${x} ${y}l-2.6-4.6M${x} ${y}l.1-5.4M${x} ${y}l2.6-4.6M${x} ${y}l.1 1.8`;
}

/** Haru under the oaks: the hunter with her bow, an oak trunk beside her. */
const haruMeeting: Drawing = {
  wash: [
    ['blossom', 'M17 20.4c2.2-.8 4.6-.8 6.8 0 1.4 1.8 2 3.6 1.8 5.4-3.4.6-7 .6-10.4 0-.2-1.8.4-3.6 1.8-5.4Z'],
    ['leaf', 'M30.6 12.6c2-4.4 7-6.4 11-4.4 3 1.4 3.6 5 1.6 7.4-1.8 2.4-5.4 2.8-8.6 1.8-2.4-.6-4.6-2-4-4.8Z'],
  ],
  line: [
    ring(20.4, 15.6, 2.7),
    'M22.4 13.6c1.2-.2 2.2.2 2.8 1',
    'M16.8 20.6c2.4-1 4.8-1 7.2 0l1.4 5.2c-3.4.6-6.8.6-10.2 0Z',
    'M17.4 25.8c-.6 5-.6 10 .2 15M23.6 25.8c.6 5 .6 10-.2 15',
    'M28.6 13.4c2.6 4.2 3.4 9 3.2 13.6-.2 4.6-1.4 9-3.4 12.8',
    'M28.6 13.4c-.4 8.8-.4 17.6.2 26.4',
    'M37.4 42.2c-.6-7.8-.4-15.4.8-22.8',
    'M4.4 42.4c13-1.2 26.4-1.2 39.6 0',
  ],
  detail: ['M38 26c1.6-.6 3-.6 4.2.2M37.8 32.6c-1.4-.4-2.6-.2-3.6.4', 'M15.6 22.4l-2.6-6.4M14.4 22l-1.4-6.6', 'M19.4 18.2c.6.4 1.4.4 2 0'],
  dots: [[19.4, 15.4, 0.35], [21.4, 15.4, 0.35]],
};

/** A shed antler lying in the bracken. */
const shedAntler: Drawing = {
  wash: [
    ['straw', 'M10.6 36.2c5.6-6.6 12.6-11.4 20.6-14 4.4-1.4 8.6-2 12.6-1.6l-.4 2.6c-3.8-.2-7.8.4-11.8 1.8-7.4 2.6-14 7-19.2 13.2Z'],
    ['leaf', 'M4.4 41.8c4-3.6 8.6-5.4 13.4-5.4 2.4-3 6-4.4 10.2-4 3.4-2.6 8-3 12.2-1 1.8 2.6 2.6 6 2.2 10.4Z'],
  ],
  line: [
    'M10.4 36.4c5.6-6.8 12.8-11.6 20.8-14.2 4.4-1.4 8.6-2 12.6-1.6',
    'M18.8 29.4c-1.4-3.6-1.4-7.4 0-11.2',
    'M25.8 25c-.2-3.6 1-7 3.4-10',
    'M34.6 21.6c1.2-3 3.2-5.4 6.2-7',
    'M8.6 38.4c.6-1.6 2-2.6 3.6-2.6',
  ],
  detail: [
    'M6.4 41c2-2.2 4.4-3.4 7.2-3.6M30.4 32.6c1.6-1.2 3.4-1.6 5.4-1.2M17.6 37.4c1.4-1.2 3-1.6 4.8-1.4',
    'M14 33l.6-1.2M21.6 27.4l.6-1.2M29.4 23.8l.6-1',
  ],
};

/** A hare's form: a hollow pressed in long grass, with the long hind prints leading out of it. */
const hareForm: Drawing = {
  wash: [
    ['straw', oval(18.4, 28.6, 10.4, 4.6)],
    ['leaf', 'M4.4 32.6c2-6 4-11 6.2-14.6 1 4 1.8 8.4 2.2 13 1.4-6.4 3.4-11.4 6-15 .6 5 .6 10.2 0 15.4 2-4.8 4.6-8.4 7.6-10.8-.4 4.6-1.6 9-3.4 13Z'],
  ],
  line: [
    'M8 28.4c0-2.8 4.6-5 10.4-5s10.4 2.2 10.4 5-4.6 5-10.4 5S8 31.2 8 28.4Z',
    'M30.6 32.4c.4-1.4 1.8-2 2.8-1.2.8.8.4 2.8-1 3.4-1.2.4-2.2-.6-1.8-2.2Z',
    'M36.4 37.6c.4-1.4 1.8-2 2.8-1.2.8.8.4 2.8-1 3.4-1.2.4-2.2-.6-1.8-2.2Z',
  ],
  detail: [
    'M10.6 28.6c2.4-1.6 5.2-2.4 8-2.4 3 0 5.6.8 7.6 2.2',
    'M6 25.6c.8-4 1.8-7.4 3.4-10.4M14.4 23.4c.6-3.6 1.6-6.8 3-9.6M21.6 23.4c.6-2.8 1.6-5.4 3-7.6M30.4 25.4c.6-2.6 1.6-4.8 3.2-6.6',
  ],
  dots: [[34.2, 34, 0.6], [32.8, 35.6, 0.5], [40, 39.2, 0.6], [38.6, 40.8, 0.5]],
};

/** Serow sign: tufts of grey hair caught on a rock edge, and droppings on the ledge below. */
const serowSign: Drawing = {
  wash: [
    ['straw', 'M5 42.2c.8-8.6 3.6-16 8.6-21.8 4.4-1.6 9.6-1.4 13.4.6 3.4 4.4 5.2 9.6 5.6 15.6l10.8.4v5.2Z'],
    ['river', 'M16.4 19.4c1.6-1.8 3.8-2.6 6.2-2.2-.6 2.2-2.4 3.6-4.8 3.8Z'],
  ],
  line: [
    'M4.8 42.4c.8-8.6 3.6-16 8.8-22 4.4-1.6 9.6-1.4 13.4.6 3.4 4.4 5.2 9.6 5.6 15.6',
    'M32.6 36.6l11.4.4',
    'M16 19.8c1.2-2.6 3.6-3.8 6.6-3.4M17.4 20.4c-.2-2.6.8-4.6 3-5.8',
  ],
  detail: ['M9.4 32c2.6-.8 5.2-.6 7.6.6M20.4 27c2.2-.2 4.2.4 6 1.6', 'M19.6 17.6l2.4-1.8M15.6 20.8l-1.4-2'],
  dots: [[36.4, 35.4, 0.8], [38.2, 35.2, 0.8], [37.3, 34, 0.75], [39.8, 35.6, 0.7], [35.2, 34.2, 0.6]],
};

const TANUKI_PRINTS = [roundPrint(10, 38, 1.1), roundPrint(17, 33.4, 1.05), roundPrint(23.6, 29.4, 1), roundPrint(30, 25.6, 0.95), roundPrint(36, 22.2, 0.9)];

/** The tanuki's trail: small round prints running neatly up an old cart track. */
const tanukiTrail: Drawing = {
  wash: [['straw', 'M4.6 42.4c8-7.6 17.8-14 28.4-19.4 3.8-2 7.4-3.6 11-5v6.6c-3.4 1.4-6.8 3-10.4 4.8-9.8 5-19 10.8-26.6 17.6Z']],
  line: ['M4.4 42.4c8-7.6 17.8-14 28.4-19.4 3.8-2 7.4-3.6 11.2-5', 'M13.4 44.2c7.4-6.4 15.6-11.6 24.4-16 2.2-1.2 4.4-2.2 6.2-3', ...TANUKI_PRINTS],
  detail: ['M8.6 36.6l-.6-1.6M42.4 21.8l.4-1.6'],
};

/** The otter slide: a smooth chute worn down the bank into the river under a willow. */
const otterSlide: Drawing = {
  wash: [
    ['leaf', 'M4.4 24.6c6.8-1.2 13-1 18.4.8 4.2 1.4 6.8 5 8.6 10.2l-27 .2Z'],
    ['river', 'M4.4 36.8c13-1.4 26.4-1.6 39.6-.4v6H4.4Z'],
  ],
  line: [
    'M4.2 24.6c6.8-1.2 13-1 18.4.8 4.2 1.4 6.8 5 8.8 10.4',
    'M17.4 25.4c2.8 1.8 4.6 5 5.8 9.6M14.4 25.2c3 2.2 5 5.6 6.2 10.4',
    'M4.2 36.8c13-1.4 26.4-1.6 39.8-.4',
    'M34.6 36.4c.4-8 .2-16-.6-23.6',
  ],
  detail: [
    'M30.6 14.6c-1 4-1.2 8-.6 12M34 12.6c.2 4.6.2 9-.2 13.4M37.6 14c1 4 1.2 8 .8 12',
    'M22.4 39.6c1.8-.6 3.6-.6 5.4 0M26.6 41.6c1.4-.4 2.8-.4 4.2 0',
  ],
};

const HERON_PRINTS = [heronPrint(12, 40), heronPrint(19.6, 34.6), heronPrint(26.4, 29.8), heronPrint(33.8, 24.2)];

/** Heron prints: long three-toed prints along the soft edge of a ditch. */
const heronPrints: Drawing = {
  wash: [['river', 'M28 4.4c4.8 6 9.4 11.6 16 15.2v6.4c-7.2-3.8-12.4-9.8-17.6-16.4Z']],
  line: ['M26.2 4.6c5 6.6 10.2 12.6 17.8 16.6', 'M22 6.4c5 7 10.8 13.2 18.6 17.8', ...HERON_PRINTS],
  detail: ['M8 44.4c2-.6 4-.6 6 0M40.4 31c1.6-.4 3.2-.4 4.6 0'],
};

/** The badger sett: several dark doors in a bank under oak roots, spoil heaped before them. */
const badgerSett: Drawing = {
  wash: [
    ['straw', 'M4.4 38c3-9 10.6-14.6 19.6-14.6S40.6 29 43.6 38Z'],
    ['leaf', 'M10.6 13.4c3.4-4.6 9.4-6 14-3.4 4.4-2.4 10.6-.8 12.6 3.6 1.4 3.4-.8 6.6-4.6 7-3.6 2.8-9.6 3-13.2.6-4 .8-8.4-.4-9.4-3.4-.6-1.6-.4-3 .6-4.4Z'],
  ],
  line: [
    'M4.2 38.2c3-9 10.6-14.8 19.8-14.8s16.8 5.8 19.8 14.8',
    'M10.6 36.4c0-2.8 1.8-4.6 4-4.6s4 1.8 4 4.6',
    'M22 34.4c0-2.6 1.6-4.4 3.8-4.4s3.8 1.8 3.8 4.4',
    'M32.4 36.6c0-2.2 1.4-3.8 3.2-3.8s3.2 1.6 3.2 3.8',
    'M24 23.4c-.4-3.6-.2-6.6.8-9.2',
    'M8.4 41.6c2-1.6 4.2-2.2 6.8-1.8M26.6 41.4c2.2-1.4 4.6-1.8 7.2-1',
  ],
  detail: ['M20.4 25.6c1.2-1.6 2.8-2.4 4.6-2.2M27.4 25c1.4.6 2.4 1.8 2.8 3.4', 'M12 40.4l.6-1M30.2 40.2l.6-1'],
};

/** The fox's earth: one den door in a dry bank above the water, a few feathers at the door. */
const foxEarth: Drawing = {
  wash: [
    ['straw', 'M4.4 33.4c3.4-9.2 11-15 19.6-15s16.2 5.8 19.6 15Z'],
    ['river', 'M4.4 38.4c13-1.2 26.4-1.2 39.6 0v4.2H4.4Z'],
  ],
  line: [
    'M4.2 33.6c3.4-9.2 11-15.2 19.8-15.2s16.4 6 19.8 15.2',
    'M17.4 33.4c0-4.6 3-7.6 6.6-7.6s6.6 3 6.6 7.6',
    'M4.2 38.4c13-1.2 26.4-1.2 39.8 0',
    'M32.8 32.8c2.4-1.6 4.8-2 7.2-1.2-2.2 1.4-4.6 1.8-7.2 1.2Z',
    'M35.4 30.6c2.2-.4 4 .2 5.2 1.6',
  ],
  detail: ['M8.8 25.6l-.6-2.4M11 23.6l.4-2.6M37.2 23.8l-.4-2.6M39.4 25.6l.4-2.4', 'M34 32.6l5.2-.8', 'M12 41c1.6-.5 3.2-.5 4.8 0M28 41.2c1.6-.5 3.2-.5 4.8 0'],
};

/** A pheasant's tail feather: long, narrow, barred across. */
const pheasantFeather: Drawing = {
  wash: [
    ['straw', 'M9.6 40.6c4.6-9.4 11.4-19 20.8-28.6 2.8-2.8 5.6-5 8.2-6.6.6 1.6.2 3.6-1 5.6-6.6 10-14.4 19.4-24.6 28Z'],
    ['leaf', 'M30.6 13.6c2.6-2.8 5.4-5.2 8-6.8.4 1.4 0 3-.8 4.6-1.8 1-4.4 1.8-7.2 2.2Z'],
  ],
  line: [
    'M9.6 40.6c4.6-9.4 11.4-19 20.8-28.6 2.8-2.8 5.6-5 8.2-6.6.6 1.6.2 3.6-1 5.6-6.6 10-14.4 19.4-24.6 28',
    'M7.4 43.2c6.6-9.8 15.6-20 30.2-37.2',
  ],
  detail: [
    'M14.8 34.6l2.4 1.4M18.4 29.8l2.6 1.2M22.2 25l2.6 1M26 20.4l2.6.8M29.8 16l2.4.8M33.6 11.8l2.2.6',
    'M13 37.4l-1.6-1.2M16.8 32.6l-1.8-1.2M20.6 27.6l-1.8-1.2',
  ],
};

export const SIGNS: Record<string, Drawing> = {
  'haru-meeting': haruMeeting,
  'shed-antler': shedAntler,
  'hare-form': hareForm,
  'serow-sign': serowSign,
  'tanuki-trail': tanukiTrail,
  'otter-slide': otterSlide,
  'heron-prints': heronPrints,
  'badger-sett': badgerSett,
  'fox-earth': foxEarth,
  'pheasant-feather': pheasantFeather,
};

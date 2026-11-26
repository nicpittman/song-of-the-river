/**
 * Keepsakes: things people made, left or lost along the river, each drawn as
 * the object itself (a bowl, a book, a lantern, a trap, a sail, a bottle) so
 * no two read alike even as a dotted outline.
 */

import { oval, ring, type Drawing } from './pen';

const num = (v: number): string => (Math.round(v * 100) / 100).toString();

/** A ring of rounded stones seen in perspective, the front ones larger. */
function stoneRing(cx: number, cy: number, rx: number, ry: number, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.3;
    const front = (Math.sin(a) + 1) / 2;
    const x = cx + rx * Math.cos(a);
    const y = cy + ry * Math.sin(a);
    out.push(oval(Number(num(x)), Number(num(y)), 2.4 + front * 1.2, 1.5 + front * 0.9));
  }
  return out;
}

/** The bowl behind the falls: a small clay bowl on a dry ledge, the water falling past in front. */
const behindTheFalls: Drawing = {
  wash: [
    ['river', 'M6.6 12.6c2.6-.6 5.4-.4 7.6.4.6 10.2.4 20.4-.4 30.6-2.4.6-4.8.4-7-.2-.6-10.4-.6-20.6-.2-30.8ZM33.8 13c2.4-.8 5-.8 7.6-.2.4 10.2.2 20.4-.4 30.6-2.2.6-4.6.6-7 0-.6-10-.6-20.2-.2-30.4Z'],
    ['straw', 'M17.6 25.6c.4 3.6 2.8 5.8 6.4 5.8s6-2.2 6.4-5.8c-4.2-.8-8.6-.8-12.8 0Z'],
  ],
  line: [
    // The overhang the water pours from, and the dry ledge under it.
    'M4.6 12.2c12.8-1.4 25.8-1.4 38.8 0',
    'M5.2 33c12.6-.6 25.2-.6 37.6 0',
    // The bowl: rim, belly and foot.
    oval(24, 25.6, 6.4, 1.6),
    'M17.6 25.6c.4 3.6 2.8 5.8 6.4 5.8s6-2.2 6.4-5.8',
    'M21.8 31.2l-.4 1.8M26.2 31.2l.4 1.8',
    // The curtains of falling water either side.
    'M7.4 12.6c-.4 10.4-.2 20.6.6 31',
    'M13.6 12.8c.6 10.2.4 20.4-.4 30.6',
    'M34.4 12.8c-.6 10.2-.4 20.4.4 30.6',
    'M40.6 12.6c.4 10.4.2 20.6-.6 31',
  ],
  detail: [
    'M10.4 13.4c-.2 6-.2 12 .2 18M11.8 36c0 2.4 0 4.6-.2 6.8M37.4 13.4c.2 6 .2 12-.2 18M36.2 36c0 2.4 0 4.6.2 6.8',
    'M16.8 13.2v3.6M20.4 13.4v2.4M27.6 13.4v2.4M31.2 13.2v3.6',
    'M20.4 27.6c1.4.8 2.8 1 4.2.8',
    'M16 36.4c2-.6 4-.6 6 0M26 38c2-.6 4-.6 6 0',
  ],
};

/** Steps cut in the rock: worn footholds stepping down a rock face. */
const STEPS =
  'M6.6 9.8c2.4-.4 4.8-.4 7 0 .6 1.6.6 3.4.2 5 2.2-.4 4.4-.4 6.6 0 .6 1.6.6 3.4.2 5 2.2-.4 4.4-.4 6.6 0 .6 1.6.6 3.4.2 5 2.2-.4 4.4-.4 6.6 0 .6 1.6.6 3.4.2 5 2.2-.4 4.4-.4 6.6 0 .6 1.8.8 3.6.6 5.4';
const carvedSteps: Drawing = {
  wash: [
    ['river', `${STEPS}c-.2 2.8 0 5.4.6 8-12.4.6-25 .6-37.4-.2-.8-11.6-.6-23.2.4-34.2Z`],
    ['leaf', 'M6.4 9.6c1-1.6 2.6-2 4.2-1.2 1-.8 2.4-.6 3 .6-2.4.4-4.8.6-7.2.6ZM33.4 29.8c1-1.2 2.4-1.4 3.6-.6.8-.6 2-.4 2.6.6-2 .2-4.2.2-6.2 0Z'],
  ],
  line: [
    STEPS,
    // The rock face falling away below the steps.
    'M6.6 9.8c-1 11-1.2 22.4-.4 34.2',
    'M40.8 35.4c-.2 2.8 0 5.4.6 8',
    'M4.4 44c13-.6 26-.6 39 0',
  ],
  detail: [
    // Each tread is hollowed by feet.
    'M8.4 10.6c1.2.6 2.6.6 3.8 0M15 15.6c1.2.6 2.6.6 3.8 0M21.6 20.6c1.2.6 2.6.6 3.8 0M28.2 25.6c1.2.6 2.6.6 3.8 0M34.8 30.6c1.2.6 2.6.6 3.8 0',
    // Cracks and bedding in the rock.
    'M9.4 18.6c2.4.6 4.6.4 6.6-.6M8.8 27c3.6.8 7.2.6 10.8-.6M10.6 35.8c4.4.6 9 .4 13.4-.8M27.6 40c2.6.4 5.2.2 7.6-.6',
    'M14.6 22.2l1.6 2.4M20.8 31l1.2 2.2',
  ],
};

/** The book of names: a thick book lying open, both pages listed with hand-written names, a pencil on a string. */
const hutBook: Drawing = {
  wash: [
    ['straw', 'M24 17.6c-5.2-2.6-11.4-3.2-17.4-2.2l-3 20.6c6.6-1 13.4-.4 20.4 2.6 7-3 13.8-3.6 20.4-2.6l-3-20.6c-6-1-12.2-.4-17.4 2.2Z'],
    ['river', 'M28.6 42.8l8.8-2 .4 1.6-8.8 2Z'],
  ],
  line: [
    'M24 17.6c-5.2-2.6-11.4-3.2-17.4-2.2l-3 20.6c6.6-1 13.4-.4 20.4 2.6',
    'M24 17.6c5.2-2.6 11.4-3.2 17.4-2.2l3 20.6c-6.6-1-13.4-.4-20.4 2.6',
    'M24 17.6v21',
    // The page block beneath: the book is thick.
    'M3.6 36l-.4 2.4c6.8-.8 13.8-.2 20.8 2.8 7-3 14-3.6 20.8-2.8l-.4-2.4',
    // A pencil tied to the spine.
    'M24 41.2c.8 1.8 2.6 2.4 4.6 1.8',
    'M28.6 42.8l8.8-2 .4 1.6-8.8 2Z',
    'M37.4 40.8l2.4-.2-2 1.8',
  ],
  detail: [
    // Names, line under line, each in a different hand.
    'M9.6 19.6c.8-.6 1.4.4 2.2-.2s1.4.4 2.2-.2 1.2.2 2 0M9 23c.8-.6 1.6.4 2.4-.2s1.6.4 2.4-.2M8.6 26.4c.8-.6 1.4.4 2.2-.2s1.4.4 2.2-.2 1.4.4 2.2-.2 1 .2 1.8.2M8.2 29.8c.8-.6 1.6.4 2.4-.2s1.4.4 2.2-.2M7.8 33.2c.8-.6 1.4.4 2.2-.2s1.6.4 2.4-.2 1.4.4 2.2-.2',
    'M27.4 19.2c.8-.6 1.4.4 2.2-.2s1.6.4 2.4-.2 1.4.4 2.2-.2M27.8 22.6c.8-.6 1.4.4 2.2-.2s1.4.4 2.2-.2M28.2 26c.8-.6 1.6.4 2.4-.2s1.4.4 2.2-.2 1.4.4 2.2-.2 1 .2 1.8.2M28.6 29.4c.8-.6 1.4.4 2.2-.2s1.4.4 2.2-.2',
  ],
};

/** The drowned lantern: a stone lantern lying on its side on the river bed, under a still surface. */
const drownedLantern: Drawing = {
  wash: [
    ['river', 'M4.6 10.4c13-1.4 26-1.4 39 0 .6 10.6.4 21.4-.4 32-12.8.8-25.6.8-38.2 0-.8-10.6-.8-21.4-.4-32Z'],
    ['leaf', 'M6.4 25.6c1.4-.4 2.8-.4 4 0v13.6c-1.2.4-2.6.4-4 0ZM30.4 22.6c.6 6.2.6 12.6 0 19 1.6-1.4 3.6-4.6 5.4-8.6-1.6-4.2-3.4-7.8-5.4-10.4Z'],
  ],
  line: [
    // The water surface.
    'M4 10.6c13.2-1.2 26.6-1.2 40 0',
    // Base block, post, the stand, the fire box with its window, the roof, the knob.
    'M6.6 25.6c1.4-.4 2.8-.4 4 0 .3 4.6.3 9 0 13.6-1.2.4-2.6.4-4 0-.3-4.6-.3-9 0-13.6Z',
    'M10.6 29.6c3.2-.4 6.4-.4 9.6 0M10.6 35c3.2.4 6.4.4 9.6 0',
    'M20.2 25.4h2.8v14.2h-2.8Z',
    'M23 26.8h6.8v11.4H23Z',
    'M24.8 30.4h3.2v4.2h-3.2Z',
    'M29.8 22.4c.4 6.4.4 12.8 0 19.4l1.4-.4c1.6-2.8 3.4-5.4 5-7.4v-3.8c-1.6-2-3.4-4.6-5-7.4Z',
    ring(38.4, 32.1, 2),
    // The river bed it rests on.
    'M4 42.6c13-.8 27-.8 40 0',
  ],
  detail: [
    'M7.6 13.8c2-.5 4-.5 6 0M30 14.6c2-.5 4-.5 6 0',
    ring(27.2, 22.4, 0.8),
    ring(28.6, 17.6, 0.6),
    'M12.4 42.4c-.4-2.2.2-4 1.4-5.6M14 42.4c.2-1.6 1-3 2.2-4M41.4 42.2c-.6-2-.4-3.8.6-5.4',
    'M13.4 31.2l1.8 1.2M16.2 33.4l1.4-1',
  ],
};

/** An owl's feather: broad and round-tipped, barred across, its edge soft and fringed. */
const owlFeather: Drawing = {
  wash: [
    ['straw', 'M17.6 37.4c-5.4-2.2-8.8-6.4-8.6-11.8.2-6.4 4.6-12.4 10.8-16 3.8-2.2 7.6-3 10.6-2 3 1 4.6 3.8 4.2 7.8-.6 6.6-5 14.4-11.4 19.8-2 1.8-3.8 2.4-5.6 2.2Z'],
  ],
  line: [
    'M17.6 37.4c-5.4-2.2-8.8-6.4-8.6-11.8.2-6.4 4.6-12.4 10.8-16 3.8-2.2 7.6-3 10.6-2 3 1 4.6 3.8 4.2 7.8-.6 6.6-5 14.4-11.4 19.8-2 1.8-3.8 2.4-5.6 2.2Z',
    // The quill.
    'M14 45.4c1.2-3.4 2.8-6.8 4.6-10.2 3.4-6.6 7.4-13.4 12.2-20.4l1.6-2.4',
  ],
  detail: [
    // Dark bars across the vane.
    'M10 23.4c2.6 1.2 5.4 1.4 8.4.6M12 17.4c2.6 1.4 5.6 1.8 9 1M16.4 12c2.6 1.4 5.4 1.8 8.6 1.2M11.4 30c2.4 1 4.6 1.2 7 .6',
    'M26.6 21.8c2.4.4 4.8.2 7-.8M23.4 27.6c2 .4 4.2.2 6.4-.8M21.2 33c1.6.4 3.4.2 5-.6M29.6 15.6c1.6.2 3.2 0 4.6-.6',
    // The soft fringe along the leading edge, and down at the base.
    'M9.4 27.6l-1.2.6M9.2 24.2l-1.4.2M10 20.6l-1.2-.4M11.8 17l-1-.8M14.2 13.8l-.8-1',
    'M17.6 37.4c-1.6.4-2.8 1.4-3.6 2.8M18.8 37.2c-.6 1.4-.8 2.8-.6 4.2M16.6 36.6c-1.6-.2-3 .2-4.2 1.2',
  ],
};

/** The hollow oak: a thick trunk opening on a dry hollow, a child's carved boat inside. */
const hollowOak: Drawing = {
  wash: [
    ['leaf', 'M12.6 44c2.6-6 3.4-14 2.6-24-.4-4.6-1.4-9-2.8-13.2h22.6c-1.4 4.2-2.4 8.6-2.8 13.2-.8 10 0 18 2.6 24Z'],
    ['straw', 'M19.4 31.4c3 .6 6.4.6 9.6-.2-.6 1.8-2 2.8-4.4 2.8s-4.4-.8-5.2-2.6ZM24.6 23.2c2 1.8 3.2 4 3.4 6.8h-3.4Z'],
  ],
  line: [
    // The trunk, flaring into roots, and two limbs going up out of frame.
    'M12.4 4.4c1.8 5 3 10.4 3.2 16 .4 9.4-.8 17.4-3.4 23.6-1.4.4-3.4 1-5.4 1',
    'M35.6 4.4c-1.8 5-3 10.4-3.2 16-.4 9.4.8 17.4 3.4 23.6 1.4.4 3.4 1 5.4 1',
    'M20.4 44.6c1.2-1.4 2.4-2 3.6-2s2.4.6 3.6 2',
    // The hollow, its rolled lip of bark.
    'M24 17c4 0 6.6 4.6 6.6 10.2s-2.6 10-6.6 10-6.6-4.4-6.6-10S20 17 24 17Z',
    'M24 15.2c5 0 8.4 5.4 8.4 12s-3.4 11.6-8.4 11.6-8.4-5-8.4-11.6 3.4-12 8.4-12Z',
    // The toy boat: hull, mast, sail.
    'M19.4 31.4c3 .6 6.4.6 9.6-.2-.6 1.8-2 2.8-4.4 2.8s-4.4-.8-5.2-2.6Z',
    'M24.2 31.6v-9.2',
    'M24.6 23.2c2 1.8 3.2 4 3.4 6.8h-3.4',
  ],
  detail: [
    'M14.2 9.6c.6 3 .8 5.6.6 8.4M33.8 9.6c-.6 3-.8 5.6-.6 8.4M13.4 30.8c.4 3.2.2 6.4-.6 9.4M34.6 30.8c-.4 3.2-.2 6.4.6 9.4',
    'M18.2 6.2c.4 2.2.4 4.4 0 6.6M29.8 6.2c-.4 2.2-.4 4.4 0 6.6M24 4.6v6.8',
    'M21 34.8c2 .6 4 .6 6 0',
  ],
};

/** A wish for the sea: two small wooden plaques hung by cords from a rail, an old faded one and ours. */
const seaWish: Drawing = {
  wash: [
    ['straw', 'M9.6 19.6c4.4-.8 8.8-1 13-.6.6 3.6.6 7.4 0 11-4.4.6-8.8.6-13.2 0-.4-3.4-.4-7 .2-10.4ZM25.6 22c4.4-.4 8.8-.4 13 0 .4 3.8.4 7.6 0 11.4-4.4.4-8.8.4-13 0-.4-3.8-.4-7.6 0-11.4Z'],
    ['river', 'M27.6 29.4c3-.4 6-.4 9 0v2.4c-3 .3-6 .3-9 0Z'],
  ],
  line: [
    // The rail.
    'M4.6 10.4c12.8-.8 25.6-.8 38.6 0',
    // The old plaque, hanging a little crooked.
    'M9.6 19.6c4.4-.8 8.8-1 13-.6.6 3.6.6 7.4 0 11-4.4.6-8.8.6-13.2 0-.4-3.4-.4-7 .2-10.4Z',
    'M12.6 19.2l3.6-8.6 3.4 8.4',
    // Ours, new and level.
    'M25.6 22c4.4-.4 8.8-.4 13 0 .4 3.8.4 7.6 0 11.4-4.4.4-8.8.4-13 0-.4-3.8-.4-7.6 0-11.4Z',
    'M28.6 21.8l3.4-11.2 3.4 11.2',
  ],
  detail: [
    // The old wish, worn almost away; ours, with a line of sea drawn under it.
    'M12.4 23.2c1.6-.4 2.6.2 4 0M13 26.4c1.2-.2 2 .2 3 0',
    'M28.2 25c1.2-.6 2 .4 3-.2s2 .4 3-.2 1.4.2 2.2 0M28.2 27.4c1.2-.6 2 .4 3-.2s2 .4 3-.2',
    'M27.6 30.6c3-.4 6-.4 9 0',
    'M15 10.8c.6.6 1.6.6 2.4 0M31 10.8c.6.6 1.6.6 2.4 0',
  ],
};

/** The waymark: a squared stone post with a rounded head, mossed over, an arrow cut down its face. */
const waymark: Drawing = {
  wash: [
    ['river', 'M18.4 42.6c-.4-9.4-.4-18.6.2-27.6.6-3.2 2.8-5 5.6-5s5 1.8 5.4 5c.6 9 .6 18.2.2 27.6Z'],
    ['leaf', 'M18.4 16.6c1.6-2.4 3.8-3 5.4-1.4 1.2-1.2 3-1 4 .4-.2 2-1.6 3-3.2 2.4-1.6 1-3.8 1-6.2-1.4ZM18.4 36c1.8-1 3.4-.6 4 1 .6 2 .2 4-.6 5.6h-3.4Z'],
  ],
  line: [
    'M18.4 42.6c-.4-9.4-.4-18.6.2-27.6.6-3.2 2.8-5 5.6-5s5 1.8 5.4 5c.6 9 .6 18.2.2 27.6',
    // The side face, so it reads as a squared post.
    'M29.6 15c1.4.8 2.4 1.6 3 2.6.4 8.4.4 16.6 0 24.8',
    // The cut arrow, pointing on down the river.
    'M24 21.6v12M21.4 30.8l2.6 3 2.6-3',
    'M6.4 43c12-.8 24.2-.8 36 0',
  ],
  detail: [
    'M21.6 18.6c.8-.6 1.6-.6 2.4 0s1.6.6 2.4 0',
    'M12 43c.4-2 1.4-3.6 2.8-4.6M14 43c0-1.6.6-3 1.6-4M34.6 43c.4-2 1.4-3.4 2.8-4.4M36.6 43.2c.2-1.4.8-2.6 1.8-3.4',
    'M20.2 25.4l.4 1.4M27.6 37.4l-.6 1.2',
  ],
  dots: [[22.6, 38.6, 0.4], [20.8, 40.2, 0.35], [26.6, 15.6, 0.35]],
};

/** A boat in the mill ledger: the open ledger, ruled for figures, the boat drawn across the spread. */
const boatLedger: Drawing = {
  wash: [
    ['straw', 'M28.4 18c3 2.6 4.6 5.6 5 9.4h-5Z'],
    ['river', 'M12.6 28.6c7.4 1.6 15.4 1.6 22.8 0-1.2 3-3.6 4.6-7 4.8h-9c-3.4-.2-5.6-1.8-6.8-4.8Z'],
  ],
  line: [
    'M24 14.4c-5-2.4-10.6-3-16.4-2v24.4c5.8-1 11.4-.4 16.4 2',
    'M24 14.4c5-2.4 10.6-3 16.4-2v24.4c-5.8-1-11.4-.4-16.4 2',
    'M24 14.4v24.4',
    'M12.6 28.6c7.4 1.6 15.4 1.6 22.8 0-1.2 3-3.6 4.6-7 4.8h-9c-3.4-.2-5.6-1.8-6.8-4.8Z',
    'M28.4 29.2V17.6',
    'M28.4 18c3 2.6 4.6 5.6 5 9.4h-5',
  ],
  detail: [
    // The ledger's ruled columns and the miller's neat entries.
    'M18.4 13v12.6M36.4 13.2v12.2',
    'M10 17.4c2.4-.3 4.6-.3 7 .1M10 20.6c2.4-.3 4.6-.3 7 .1M10 23.8c2.4-.3 4.6-.3 7 .1',
    'M19.6 17.6h2.6M19.6 20.8h2.6M19.6 24h2',
    'M31 15.4c1.6-.2 3.4-.2 4.6 0M37.6 15.6h1.6',
    'M15.6 31.6c.5.4 1.2.4 1.6 0M20 32.2c.5.4 1.2.4 1.6 0',
  ],
};

/** The charcoal burners' ring: blackened stones round a dead fire, a clay pipe lying in the grass. */
const charcoalKiln: Drawing = {
  wash: [
    ['river', 'M10 24.6c0-4.4 6.4-7.4 14-7.4s14 3 14 7.4-6.4 7.6-14 7.6-14-3.2-14-7.6Z'],
    ['straw', 'M12.2 41.2c6.4-.6 13.2-1.2 19.6-1.4.2-1.6.6-3.2 1.4-4.6h3.6c.6 2 .4 4.2-.6 6-4.6.6-9 1-13.6 1.4-3.6.2-7 .2-10.4 0Z'],
  ],
  line: [
    ...stoneRing(24, 24.4, 13, 6, 9),
    // The clay pipe: a long thin stem and its small bowl.
    'M10.8 42.4c7.6-.6 15-1.2 22.4-1.6',
    'M10.8 40.8c7.4-.4 14.6-1 21.6-1.6',
    oval(10.8, 41.6, 0.4, 0.8),
    'M32.4 39.2c-.2-1.4.2-2.8.8-4h4c.6 2 .4 4.2-.6 6-1.2.6-2.6.6-3.8-.4',
    oval(35.2, 35.2, 2, 0.6),
  ],
  detail: [
    // Ash and charcoal inside the ring.
    'M19 24.8c1.4-.8 2.8-.6 4 .2 1.2-.8 2.6-.8 3.6 0 1.2-.6 2.4-.4 3.4.4',
    'M20.4 22.4l1.4.6M26.4 22.2l1.2.8',
    'M4.6 36.2c.4-1.6 1.2-2.8 2.4-3.6M6.2 36.4c.2-1.2.8-2.2 1.6-2.8M41.4 32.6c.2-1.6.8-2.8 1.8-3.6M42.8 32.8c0-1.2.4-2.2 1.2-3',
  ],
  dots: [[22, 24.2, 0.5], [25.2, 23.4, 0.45], [27.6, 25.4, 0.5], [23.6, 26.2, 0.4], [20.4, 26, 0.4]],
};

/** A folded seed packet: a paper packet, its top folded twice over, a sprout drawn on it, seeds spilling. */
const seedPacket: Drawing = {
  wash: [
    ['straw', 'M13.6 10.6c6.8-.8 13.6-1 20.4-.4l1 27c-7 .8-14.2 1-21.4.6Z'],
    ['leaf', 'M24 24.6c-2.6-.4-4.4-2-4.8-4.4 2.6.2 4.4 1.8 4.8 4.4ZM24.4 22.8c.6-2.4 2.4-3.8 4.8-3.8-.6 2.4-2.4 3.8-4.8 3.8Z'],
  ],
  line: [
    'M13.6 10.6c6.8-.8 13.6-1 20.4-.4l1 27c-7 .8-14.2 1-21.4.6Z',
    // The top folded down twice.
    'M13.8 14.4c6.8-.6 13.6-.8 20.4-.4',
    'M13.9 17.6c6.8-.6 13.6-.8 20.4-.4',
    // A sprout drawn on the front.
    'M24 31c-.2-2.4 0-5.2.4-8',
    'M24 24.6c-2.6-.4-4.4-2-4.8-4.4 2.6.2 4.4 1.8 4.8 4.4Z',
    'M24.4 22.8c.6-2.4 2.4-3.8 4.8-3.8-.6 2.4-2.4 3.8-4.8 3.8Z',
    // Seeds spilling from the open corner.
    oval(37.4, 40.4, 1, 0.6),
    oval(33.6, 42.6, 1, 0.6),
    oval(39.6, 43.4, 0.9, 0.55),
  ],
  detail: [
    // The gardener's few words.
    'M17 34.2c1.2-.6 2 .4 3-.2s2 .4 3-.2 2 .4 3-.2 1.4.2 2.2 0',
    'M21.6 31.6c1.6-.4 3.4-.4 5 0',
    'M15.6 12.2h4.4',
  ],
};

/** A stone fox: a small fox carved sitting upright, a red bib tied at its neck, its tail curled round. */
const stoneFox: Drawing = {
  wash: [
    ['river', 'M21.6 19.8c-3.4 2.6-5.4 7.6-5.6 13.4-.1 3.4.4 6.4 1.4 8.6h13.2c1-2.2 1.5-5.2 1.4-8.6-.2-5.8-2.2-10.8-5.6-13.4ZM19.6 13.4l-1.8-7.2 5 4.2h2.4l5-4.2-1.8 7.2c.8 2.6-.2 5.2-2.4 6.6L24 21.8 22 20c-2.2-1.4-3.2-4-2.4-6.6Z'],
    ['blossom', 'M20.6 20.4c2.2.9 4.6.9 6.8 0L24 27.4Z'],
  ],
  line: [
    // Ears and head, narrowing to the muzzle.
    'M19.6 13.4l-1.8-7.2 5 4.2c.8-.3 1.6-.3 2.4 0l5-4.2-1.8 7.2',
    'M19.6 13.4c-.8 2.6.2 5.2 2.4 6.6l2 1.8 2-1.8c2.2-1.4 3.2-4 2.4-6.6',
    // Body, the two front legs, and the base it sits on.
    'M21.6 20.4c-3.4 2.6-5.4 7.4-5.6 13-.1 3.4.4 6.2 1.4 8.4',
    'M26.4 20.4c3.4 2.6 5.4 7.4 5.6 13 .1 3.4-.4 6.2-1.4 8.4',
    'M22 30.2v11.6M26 30.2v11.6',
    'M13.6 42c6.8-.6 13.8-.6 20.8 0l-.2 3c-6.8.4-13.6.4-20.4 0Z',
    // The tail, curled up the right side.
    'M31.4 39.6c3.6-.6 6.2-2.8 7-6.4.6-3-.4-5.8-2.4-7.4-1 2.6-1.4 5.2-2.8 7.4',
    // The bib.
    'M20.6 20.4c2.2.9 4.6.9 6.8 0L24 27.4Z',
  ],
  detail: [
    'M20.8 14.6l1.6.8M27.2 14.6l-1.6.8',
    'M19.4 9.6l.6 2.2M28.6 9.6l-.6 2.2',
    'M35.8 27.8c.4 1 .4 2 0 3',
    'M10 45c.4-1.6 1.2-2.8 2.4-3.6M38 45c-.2-1.4.2-2.6 1.2-3.6M39.6 45.2c.2-1.2.8-2.2 1.6-2.8',
  ],
  dots: [[24, 20.6, 0.55]],
};

/** An old eel trap: a long woven willow cone, the funnel mouth open, its tail end bound shut. */
const eelTrap: Drawing = {
  wash: [['straw', 'M11 16.6c10 1.4 20 4.4 28 8.4v2c-8 4-18 7-28 8.4-3-1.6-4.6-5.2-4.6-9.4s1.6-7.8 4.6-9.4Z']],
  line: [
    // The open mouth.
    oval(11, 26, 4.4, 9.4),
    oval(11.6, 26, 1.8, 4),
    // The body tapering to the tail.
    'M11 16.6c10 1.4 20 4.4 28 8.4',
    'M11 35.4c10-1.4 20-4.4 28-8.4',
    // The tail, bound with a twist of willow, the ends sticking out.
    'M38.6 24.4l2.4-.8.4 4.8-2.4-.8',
    'M41.2 24.4c1.4-.6 2.4-1.2 3.4-2M41.4 27.6c1.4.6 2.4 1.2 3.4 2M41.4 26h3',
    // The hanging cord.
    'M20 18.2c1.4-4.6 4-7 7.4-7.4 2.4-.2 4 1.4 4.4 3.8.2 1.6-.2 3.4-1 5.2',
  ],
  detail: [
    // Hoops of willow round the body.
    'M18.4 17.8c1.6 2.4 2.4 5.2 2.4 8.2s-.8 5.8-2.4 8.2',
    'M25.6 19.4c1.4 2 2 4.2 2 6.6s-.6 4.6-2 6.6',
    'M32.4 21.6c1 1.4 1.4 2.8 1.4 4.4s-.4 3-1.4 4.4',
    // The long rods running to the tail.
    'M14.4 21c8 1 16.6 2.6 24.2 4.4M14.4 31c8-1 16.6-2.6 24.2-4.4M15 26c8 0 16 0 23.6 0',
    // The funnel inside the mouth.
    'M11 16.6l.6 5.4M11 35.4l.6-5.4M6.6 26h3.2',
  ],
};

/** The mended sail: folded into a soft pile, the folds showing at the front, a stitched patch on top. */
const mendedSail: Drawing = {
  wash: [
    ['straw', 'M8.6 22.4c4.6-3 8.8-5.6 12.6-7.2 6.4 0 12.8.6 19.2 1.6l.2 10c-4 3-8 5.8-12.6 8.6-6.4-.4-12.8-1-19.4-1.8Z'],
    ['river', 'M22.4 18.6c2.4-1.4 4.6-2.6 6.4-3.2 2.4.2 4.6.4 6.6.8-1.8 1.2-3.8 2.4-6.2 3.6-2.2-.4-4.4-.8-6.8-1.2Z'],
  ],
  line: [
    // The top of the pile.
    'M8.6 22.4c4.6-3 8.8-5.6 12.6-7.2 6.4 0 12.8.6 19.2 1.6-4.2 2.8-8.4 5.2-12.6 7.6-6.4-.8-12.8-1.6-19.2-2Z',
    // The front, folds rolling over at the left end.
    'M8.6 22.4c-1.4.6-2 1.6-1.8 2.8.2 1 1 1.6 2 1.8-1.4.4-2 1.4-1.8 2.6.2 1 1 1.6 2 1.8-1.4.4-1.8 1.4-1.6 2.4.2 1 1 1.4 1.8 1.6',
    'M27.8 24.4v10.8',
    'M9.2 34.4c6.2.4 12.4 .4 18.6.8',
    // The right side falling away.
    'M40.4 16.8l.2 10c-4 3-8 5.8-12.8 8.4',
    // The patch.
    'M22.4 18.6c2.4-1.4 4.6-2.6 6.4-3.2 2.4.2 4.6.4 6.6.8-1.8 1.2-3.8 2.4-6.2 3.6-2.2-.4-4.4-.8-6.8-1.2Z',
  ],
  detail: [
    'M9 27c6.2.4 12.6.6 18.8.8M9 30.8c6.2.4 12.6.6 18.8.8',
    // Stitches round the patch.
    'M23.6 17.2l.8.8M25.8 16l.8.8M28 15l.6.8M31.4 15.6l-.2 1M34 16.2l-.4.8M30.8 18.2l-.2-.9M27.4 19.2l.2-.9',
    // The seams of the canvas running over the fold.
    'M14.6 18.6c4 .4 8.2.8 12.4 1.4',
    'M31.4 29.2c2.4-1.6 4.8-3.2 7-4.8',
  ],
};

/** The boatbuilder's moulds: curved frames for a small hull, hung in a row on pegs along the shed wall. */
function mould(cx: number, top: number, w: number, h: number): string[] {
  const l = cx - w / 2;
  const r = cx + w / 2;
  const outer = `M${num(l)} ${num(top)}C${num(l)} ${num(top + h * 0.7)} ${num(cx - w * 0.28)} ${num(top + h)} ${num(cx)} ${num(top + h)}S${num(r)} ${num(top + h * 0.7)} ${num(r)} ${num(top)}`;
  const t = 1.8;
  const inner = `M${num(l + t)} ${num(top + 1.6)}C${num(l + t)} ${num(top + h * 0.62)} ${num(cx - w * 0.22)} ${num(top + h - t)} ${num(cx)} ${num(top + h - t)}S${num(r - t)} ${num(top + h * 0.62)} ${num(r - t)} ${num(top + 1.6)}`;
  const bar = `M${num(l - 0.8)} ${num(top)}h${num(w + 1.6)}v1.6h${num(-(w + 1.6))}Z`;
  const cord = `M${num(cx - 2)} ${num(top)}l2 -3.4 2 3.4`;
  return [outer, inner, bar, cord];
}
const boatyardMoulds: Drawing = {
  wash: [
    ['straw', 'M14.4 17.6c0 10 4 16.4 9.6 16.4s9.6-6.4 9.6-16.4ZM4.6 17.6c0 6.2 1.8 10.4 4.8 10.4s4.8-4.2 4.8-10.4ZM34 17.6c0 7.6 2.4 12.6 4.8 12.6s4.8-5 4.8-12.6Z'],
    ['river', 'M4 10.4c13.4-.6 26.6-.6 40 0l-.2 1.8c-13.2.4-26.4.4-39.6 0Z'],
  ],
  line: [
    // The peg rail.
    'M4 10.6c13.4-.6 26.6-.6 40 0',
    ...mould(9.4, 17.6, 9.6, 10.6),
    ...mould(24, 17.6, 19.2, 16.8),
    ...mould(38.8, 17.6, 9.6, 12.8),
  ],
  detail: [
    // Plank seams of the wall behind.
    'M4.4 38.6c13-.4 26-.4 39 0M4.4 44c13-.4 26-.4 39 0',
    'M15.6 38.6v5.4M33.2 38.8v5.2',
  ],
  dots: [[9.4, 14.2, 0.6], [24, 14.2, 0.6], [38.8, 14.2, 0.6]],
};

/** A sail in the loft: a long roll of patched canvas tied with cord, lying on the boards under the rafters. */
const loftSail: Drawing = {
  wash: [
    ['straw', 'M9.4 24.4c10-.6 20-.6 30 0 1.8.4 2.6 3 2.6 5.8s-.8 5.4-2.6 5.8c-10 .6-20 .6-30 0Z'],
    ['blossom', 'M24.4 25.4c2.6-.2 5.2-.2 7.8 0 .2 2.4.2 4.8 0 7.2-2.6.2-5.2.2-7.8 0-.2-2.4-.2-4.8 0-7.2Z'],
  ],
  line: [
    // The roof slope and a rafter.
    'M4 18.6c8.6-4.4 17.4-8.8 26.4-13.2',
    'M4 22.4c8.6-4.4 17.4-8.8 26.4-13.2',
    // The roll: the far end, the near end showing its spiral, the long sides.
    'M9.4 24.4c10-.6 20-.6 30 0M9.4 36c10 .6 20 .6 30 0',
    'M39.4 24.4c1.8.4 2.6 3 2.6 5.8s-.8 5.4-2.6 5.8',
    oval(9.4, 30.2, 3, 5.8),
    // Two cords round it.
    'M16.6 24.2c.8 3.8.8 7.8 0 12M34.2 24.2c.8 3.8.8 7.8 0 12',
    // The patch.
    'M24.4 25.4c2.6-.2 5.2-.2 7.8 0 .2 2.4.2 4.8 0 7.2-2.6.2-5.2.2-7.8 0-.2-2.4-.2-4.8 0-7.2Z',
    // The loft boards.
    'M4 40.2c13.4-.6 26.6-.6 40 0',
  ],
  detail: [
    'M9.6 27.6c1.2 0 1.8 1.2 1.6 2.6-.2 1.4-1.2 2.2-2.2 1.8-1-.4-1-2 0-2.6',
    'M25.6 26.4v.9M27.6 26.2v.9M29.6 26.2v.9M31.2 28l-.9.1M31.2 30.2l-.9.1M25.6 31.4v.9M28.2 31.6v.9',
    'M14.6 43.4c3-.4 6-.4 9 0M28 43.4c3-.4 6-.4 9 0',
    'M18 14.4l3 3.6',
  ],
};

/** Sea glass: a blue-green bead frosted by the sand, softly squared by the sea, a thread still through it. */
const seaGlass: Drawing = {
  wash: [
    ['river', 'M14.6 26.4c-.4-6 3.2-10.2 9-10.6 6.2-.4 10.6 3.2 10.6 9.4 0 6.4-4 10.6-10.2 10.6-5.6 0-9-3.6-9.4-9.4Z'],
    ['river', 'M18 28.6c-.2-3.6 2.4-6.4 6-6.6 3.8-.2 6.2 2.2 6.2 6 0 3.6-2.4 6.2-6 6.2-3.4 0-6-2.2-6.2-5.6Z'],
  ],
  line: [
    'M14.6 26.4c-.4-6 3.2-10.2 9-10.6 6.2-.4 10.6 3.2 10.6 9.4 0 6.4-4 10.6-10.2 10.6-5.6 0-9-3.6-9.4-9.4Z',
    oval(24.4, 25.6, 2.4, 2.1),
    'M22.2 26.4c-3 .8-6.6 3-9.4 6.4-1.6 2-1.2 4 .8 4.6 1.8.6 3.4-.6 3.8-2.4',
    'M26.6 24.8c3-.6 6.4-1.6 9.4-3.6 1.8-1.2 3.6-.8 4.2.8',
    'M8.4 39.6c10-1 21.4-1 31.6 0',
  ],
  detail: ['M17.8 22c1-2.2 2.6-3.6 4.6-4.2', 'M18.6 31.2l.5.5M30.4 30.4l.4.6M29.8 19.6l.6-.2M22 33.4l.6.2M31.4 25.6l.5.3', 'M12 43c4-.6 8-.6 12 0'],
};

/** Sea-polished wood: a pale forked branch, smoothed by the water, lying on the sand. */
const driftwood: Drawing = {
  wash: [['straw', 'M4.4 36.8c8-1.6 18-2 27-1.2 4 .4 8 .2 12.4-.6l-.4 5c-12.8 1.2-26 1.2-39 0Z']],
  line: [
    'M5 31.6c4.6-2.4 10.2-3.2 16-3 5.4.2 10-.6 14-3.2l5.6-4.2c.7-.5 1.5.2 1 .9l-4.4 5.2c2.2.2 4.2 1 5.6 2.4.6.6 0 1.4-.8 1-2-.8-4.4-1-7 .2-4.8 2-10 2.8-15.4 2.8-5 0-9.4.4-13 1.2-1.6.3-2.6-1.4-1.6-3.3Z',
    'M4.6 37c8-1.2 18-1.6 26.6-.8 4.2.4 8.2.2 12.4-.6',
    oval(38.8, 34.6, 2.2, 1.3),
  ],
  detail: ['M9 31.6c5-1 10.4-1.4 16-1.2M14 33.4c4-.4 8-.6 12-.4M33.6 28.2c2.2-1 4.2-2.6 5.8-4.4', oval(20.6, 30.8, 1.4, 0.7), 'M8 40.6c2.4-.6 4.8-.6 7.2 0M27 41c2.4-.6 4.8-.6 7.2 0'],
};

/** A glass net float: a green glass ball held in a mesh of old rope, a loop to hang it by. */
const netFloat: Drawing = {
  wash: [
    ['leaf', ring(24, 27.4, 12)],
    ['river', 'M8 41.2c10.6-1 21.4-1 32 0l-.4 2.6c-10.4.6-20.8.6-31.2 0Z'],
  ],
  line: [
    ring(24, 27.4, 12),
    // The rope mesh: meridians over the ball, and a band round its middle.
    'M24 15.4c-5.4 3-8 7.4-8 12s2.6 9 8 12',
    'M24 15.4c5.4 3 8 7.4 8 12s-2.6 9-8 12',
    'M12.2 25.6c7.8 2.6 15.8 2.6 23.6 0',
    'M13.6 33.2c6.8 2.2 14 2.2 20.8 0',
    // The knot and loop at the top.
    'M22.6 15.4c-.4-2.6.2-5 1.4-7 1.2 2 1.8 4.4 1.4 7',
    'M24 8.4c-1.6-1-2.4-2.4-2-3.6.4-1 1.6-1.2 2.4-.6.8-.6 2-.4 2.4.6.4 1.2-.6 2.6-2.8 3.6',
  ],
  detail: [
    'M24 15.4V39.4',
    'M14.2 20.2c6.4 1.6 13.2 1.6 19.6 0',
    // A highlight, and the green showing through.
    'M15.8 21c.8-1.8 2-3.2 3.6-4',
    'M7.6 44c2.6-.5 5.2-.5 7.8 0',
  ],
  dots: [[24, 26.6, 0.6], [16.4, 26.6, 0.45], [31.6, 26.6, 0.45]],
};

/** A letter in a bottle: a corked bottle lying on the sand, a rolled letter tied with thread inside. */
const bottleLetter: Drawing = {
  wash: [
    ['river', 'M8.8 21c5.6-.6 13.4-.6 19 0 2 .4 3.4 1.4 4.2 2.8l1.4 2.2c1.6.2 3.4.2 5 0v4.4c-1.6-.2-3.4-.2-5 0l-1.4 2.2c-.8 1.4-2.2 2.4-4.2 2.8-5.6.6-13.4.6-19 0-2.4-.4-3.6-3.2-3.6-7.2s1.2-6.8 3.6-7.2Z'],
    ['straw', 'M11.6 24.8c4.6-.3 9.4-.3 14 0v6.4c-4.6.3-9.4.3-14 0Z'],
  ],
  line: [
    'M8.8 21c5.6-.6 13.4-.6 19 0 2 .4 3.4 1.4 4.2 2.8l1.4 2.2c1.6.2 3.4.2 5 0v4.4c-1.6-.2-3.4-.2-5 0l-1.4 2.2c-.8 1.4-2.2 2.4-4.2 2.8-5.6.6-13.4.6-19 0-2.4-.4-3.6-3.2-3.6-7.2s1.2-6.8 3.6-7.2Z',
    // The cork.
    'M38.4 25.6c1.6-.2 3-.2 4.2.2.3 1.6.3 3.2 0 4.8-1.2.4-2.6.4-4.2.2',
    // The rolled letter and its thread.
    'M11.6 24.8c4.6-.3 9.4-.3 14 0M11.6 31.2c4.6.3 9.4.3 14 0',
    oval(25.6, 28, 1.2, 3.2),
    'M18.4 24.6c.4 2.2.4 4.6 0 6.8',
    'M4 39c13-.8 27-.8 40 0',
  ],
  detail: [
    oval(11.6, 28, 1.2, 3.2),
    'M18.4 31.4c-.4 1.2-1.2 1.8-2 2.2M18.6 31.4c.6 1 1.4 1.6 2.4 1.8',
    'M9.4 22.6c3.2-.4 6.6-.4 10 0',
    'M10 42.4c2.6-.5 5.2-.5 7.8 0M28.4 42.6c2.6-.5 5.2-.5 7.8 0',
  ],
};

export const KEEPSAKES: Record<string, Drawing> = {
  'behind-the-falls': behindTheFalls,
  'carved-steps': carvedSteps,
  'hut-book': hutBook,
  'drowned-lantern': drownedLantern,
  'owl-feather': owlFeather,
  'hollow-oak': hollowOak,
  'sea-wish': seaWish,
  waymark,
  'boat-ledger': boatLedger,
  'charcoal-kiln': charcoalKiln,
  'seed-packet': seedPacket,
  'stone-fox': stoneFox,
  'eel-trap': eelTrap,
  'mended-sail': mendedSail,
  'boatyard-moulds': boatyardMoulds,
  'loft-sail': loftSail,
  'sea-glass': seaGlass,
  driftwood,
  'net-float': netFloat,
  'bottle-letter': bottleLetter,
};

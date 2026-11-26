/**
 * Habitats: the kinds of place an outing can go, as tiny landscape vignettes.
 * Each is built around one thing you would recognise from across the valley:
 * the spring's waterfall, the woodland's pines, the tarn's reflection.
 */

import { type Drawing } from './pen';

const r2 = (v: number): string => (Math.round(v * 100) / 100).toString();

/**
 * A soft lens of wash: a gently waved top edge from x0 to x1 at height y and
 * a rounded belly `depth` below it, so ground and water tints never end in a
 * ruled edge.
 */
export function lens(x0: number, x1: number, y: number, depth: number): string {
  const w = x1 - x0;
  return (
    `M${r2(x0)} ${r2(y)}C${r2(x0 + w * 0.3)} ${r2(y - 1.6)} ${r2(x0 + w * 0.7)} ${r2(y - 1.6)} ${r2(x1)} ${r2(y - 0.2)}` +
    `C${r2(x1 + 1)} ${r2(y + depth * 0.6)} ${r2(x1 - w * 0.15)} ${r2(y + depth)} ${r2(x0 + w * 0.5)} ${r2(y + depth)}` +
    `C${r2(x0 + w * 0.15)} ${r2(y + depth)} ${r2(x0 - 1)} ${r2(y + depth * 0.6)} ${r2(x0)} ${r2(y)}Z`
  );
}

/**
 * A small five-petalled flower as one scalloped outline, so a bloom reads as
 * a bloom and not as a ring with a dot. `turn` rotates it a little.
 */
export function bloom(cx: number, cy: number, r: number, turn = 0): string {
  const inner = r * 0.5;
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a = ((turn + i * 72 - 90) * Math.PI) / 180;
    return [cx + Math.cos(a) * inner, cy + Math.sin(a) * inner];
  });
  const arc = r * 0.42;
  let d = `M${r2(pts[0][0])} ${r2(pts[0][1])}`;
  for (let i = 1; i <= 5; i++) {
    const [x, y] = pts[i % 5];
    d += `A${r2(arc)} ${r2(arc)} 0 1 1 ${r2(x)} ${r2(y)}`;
  }
  return `${d}Z`;
}

const spring: Drawing = {
  wash: [
    ['river', 'M20.8 14.6h7l.6 17.6c5.6.4 11 1.2 13.4 2.6.8 3-6.2 5.8-17.8 5.8S5.6 37.8 6.4 34.8c2.4-1.4 8.6-2.2 14-2.6Z'],
    ['leaf', 'M7.4 22.4c1-4 3.8-7 7.6-7.6 2.6-.4 4.6.4 5.6 1.8l-.2 3.2c-4.2-.4-8.6.6-13 2.6ZM28 14.8c1.6-2.8 4-4.2 7-3.8 3.4.6 5.8 3 6.8 6.6-4.4-1.6-9-2.2-13.8-1.6Z'],
  ],
  line: [
    // Rocks either side of the fall, broken into faces.
    'M5.6 32.4c-.4-3.8 0-7.4 1.4-10.2l3.4-5.4 5-2.4 3.6.8 1.6 2.2',
    'M27.8 15.6l2.8-3.8 4.4-1.2 4.4 2.2 2.6 5.4.4 6.8-1.6 7.2',
    // The fall itself, from a lip of rock.
    'M20.6 15.2c.6 5.8.4 11.6-.4 17.4M27.8 15.4c-.4 5.8 0 11.6.8 17.2',
    'M19.2 15c3.4-.9 6.8-.9 10 0',
    // The pool it falls into.
    'M5.8 34.6c6-2.8 30.4-2.8 36.4 0 1.2 3-6.2 6.6-18.2 6.6S4.6 37.6 5.8 34.6Z',
  ],
  detail: [
    'M22.6 16.4v14M25 16.6v14.6M26.8 18.4v11.4',
    'M14.6 36.6c2-.6 4-.6 6 0M27 36.8c2.2-.6 4.4-.6 6.6 0M20.8 38.8c2-.5 4-.5 6 0',
    'M10.4 16.8l1.6 6.6 5.6 2.4M35 10.6l-.8 6.4 4.8 3.6 3 1M7 22.2l5 1.2',
    'M18.4 33.2c1.4-1 3-1.2 4.4-.6M26.4 32.8c1.6-.8 3.2-.8 4.6 0',
  ],
};

const woodland: Drawing = {
  wash: [
    ['leaf', 'M14 6.6 6.8 19.4h4.4L5.6 29.4h17L17 19.4h4.4ZM28.8 14.6l-5.6 9.8h3.4l-4.4 7.4h13.2l-4.4-7.4h3.4Z'],
    ['straw', lens(4.6, 43.4, 40.4, 3.6)],
  ],
  line: [
    // A tall pine and a smaller one behind.
    'M14 6.4 6.8 19.6h4.4L5.6 29.6h17L17 19.6h4.4Z',
    'M14 29.6v10',
    'M28.8 14.4l-5.6 10h3.4l-4.4 7.6h13.2l-4.4-7.6h3.4Z',
    'M28.8 32v7.2',
    // A broad old trunk at the edge of the page, its crown out of sight.
    'M38.2 40c.8-6.6.8-14.6-.4-22.4-.6-4-.4-8 .4-11.6M43.6 40.2c-.6-7.4-.4-15.6.6-23.2.4-3.6.4-7.2-.2-10.8',
    'M3.8 40c13.4-1.4 26.8-1.4 40.4 0',
  ],
  detail: [
    'M10 24.4l4-2.2 4 2.2M11.6 15.2l2.4-1.8 2.4 1.8M26 28l2.8-1.8 2.8 1.8',
    'M39.8 14.6c1 1.6 1.4 3.4 1 5.4M40.4 27c.8 1.4 1 3 .6 4.6',
    'M18.4 37.8c.6-1.2 1.4-2 2.4-2.4M33.6 38c.4-1 1.2-1.8 2.2-2.2M8 38.2l-.8-1.6',
  ],
};

const river: Drawing = {
  wash: [
    ['river', 'M15.2 5.6c3.6-.8 7.6-.8 11.4 0-1.2 6 .8 11 5.8 15.4 4.8 4.4 7.2 11 6.6 20.6-5.4 1.2-11.4 1.4-17 .4.8-8.2-1.6-13.8-5.6-18.2-4-4.6-4.4-10.8-1.2-18.2Z'],
    ['leaf', 'M5.2 12.4c3.6-.6 6.6-2.2 9-4.4-1.6 6.6-1 12.6 2.6 17 3.4 4.2 5.4 9 5 15.6-5.4.8-11 .6-16-.4-1.4-9.4-1.6-18.8-.6-27.8Z'],
  ],
  line: [
    // Two banks winding down the page, the water between them.
    'M14.6 4.6c-2.6 7.8-2.6 14.8 1.8 19.8 4 4.6 6.6 10.4 5.6 19',
    'M27 4.6c-1.4 6.6.4 11.8 5.6 16.6 5 4.6 7.6 11.8 6.6 22.2',
    // A stone in midstream with the current parting round it.
    'M25.4 29.4c-.2-1.6 1.2-2.8 3-2.8 1.8 0 3 1.2 2.8 2.6-.2 1.2-1.6 1.8-3 1.8s-2.6-.4-2.8-1.6Z',
  ],
  detail: [
    'M18 10.4c1.4-.8 3-.8 4.4 0M19.8 16.2c1.6-.8 3.2-.8 4.8 0M22.4 21.6c1.6-.6 3.2-.4 4.6.4',
    'M24.6 33.4c1.6-.6 3.4-.4 5 .6M29.6 38.4c1.6-.6 3.2-.4 4.6.6M32.6 30c1 .6 1.6 1.4 1.6 2.4M24.2 27.4c-.8.4-1.2 1-1.4 1.8',
    'M8.4 20.6l-.6-2M10.6 31.2l-.8-1.8M7.2 36.4l.4-2M42.4 14.2l.8-1.6M40.6 9.4l.8-1.6',
  ],
};

const tarn: Drawing = {
  wash: [
    ['river', 'M4.8 27.8c3.4-1.2 11.8-1.8 19.2-1.8s16 .6 19.2 1.8c1.4 4.4-6.4 9-19.2 9S3.4 32.2 4.8 27.8Z'],
    ['leaf', 'M6.2 26.4 16.8 11.2l5 6.2 6.2-8.2 13.8 17.2c-5.8-.6-12-.8-17.8-.8s-12.4.2-17.8.8Z'],
  ],
  line: [
    // The mountain shoulder, standing on the water's edge.
    'M5.2 26.8 16.8 10.4l5 6.4 6.2-8.6 14.6 18.6',
    // The still water, a long flat oval.
    'M4.4 27.6c3.4-1.2 12-1.8 19.6-1.8s16.2.6 19.6 1.8c1.4 4.6-6.6 9.6-19.6 9.6S3 32.2 4.4 27.6Z',
  ],
  detail: [
    // Its reflection, upside down and broken by the faintest ripple.
    'M8.4 28.8 16.8 34.6l3.4-3.2M22.8 30.6 28 35l8.8-6.2',
    'M13 31.4h3M28.4 31.8h4M20 33.8h3',
    'M26.6 10.4l-1.4 2.2M28 8.6l1.6 2.4M15.4 12.4l-1 1.6',
  ],
};

const ruins: Drawing = {
  wash: [
    ['straw', 'M19.6 41.4V29.6h7.6v-4.4h7v6.4h5.6v9.8Z'],
    ['leaf', lens(4.4, 43.6, 40.8, 3.6)],
  ],
  line: [
    // An old road marker: a standing stone with a little cap.
    'M9.6 41V18.8l3.2-2.6 3.2 2.6V41',
    // A broken wall stepping down.
    'M19.6 41.2V29.6h7.6v-4.4h7v6.4h5.6v9.6',
    'M3.8 41.2c13.4-.8 26.8-.8 40.4 0',
  ],
  detail: [
    // Worn characters cut into the marker.
    'M12.8 21.6v3.4M11.6 27.6h2.4M12.8 27.6v3M11.8 33.4l2 1.6',
    // The joints between stones.
    'M19.6 35.4h20.2M27.2 29.6v5.8M23.4 35.4v5.8M31 35.4v5.8M36.6 31.6v3.8M30.6 25.2v4.4M27.2 30.4h7',
    'M17 40.4l-.6-2.2M18 40.6l.4-2.4M7 40.6l-.8-2M43 40.4l-.4-2',
  ],
};

const meadow: Drawing = {
  wash: [
    ['leaf', 'M4.6 33.6c7-3.4 14.6-4.4 21.2-2.6 6-2.6 12-2.8 17.8-.4 1.8 3.4 1.2 7.4-.6 10.4-12.2 1.6-24.8 1.6-37 0-2-2.4-2.4-5-1.4-7.4Z'],
    ['blossom', `${bloom(12.4, 20.8, 4.2, 8)}${bloom(33.2, 16, 4.2, -10)}${bloom(24.2, 24.8, 3.6, 30)}`],
  ],
  line: [
    // A gentle rise of ground.
    'M3.8 33.8c7-3.6 15-4.6 22-2.8 6-2.6 12.4-2.8 18.4-.4',
    // Long grasses bending over.
    'M7.6 33c-.4-6 .8-11.4 4-15.8M19.8 31c.4-5.2-.6-9.8-3.4-13.6M29.2 30.4c.6-5.4 2.6-9.6 6-12.8M40.6 30.8c-.6-4.8-2.6-8.4-5.6-11',
    // Three flowers on their stems.
    bloom(12.4, 20.8, 3.6, 8),
    bloom(33.2, 16, 3.6, -10),
    bloom(24.2, 24.8, 3, 30),
    'M12.4 23.6c.2 3 0 6-.6 8.8M33.2 18.8c-.6 4-.6 7.6 0 11.4M24.2 27.2c0 1.6.2 3 .4 4.2',
  ],
  detail: [
    'M5.6 38.2c.6-1.4 1.4-2.4 2.6-3M15 37.2l.8-2.4M22 38.6l-.6-2.2M30.6 37.4c.4-1.2 1.2-2 2.2-2.4M38.6 38.4l.6-2.4',
    'M12.2 28c1.6-.8 2.8-.6 3.6.6M33 25.2c-1.4-.2-2.4.4-2.8 1.6',
  ],
  dots: [[12.4, 20.8, 0.6], [33.2, 16, 0.6], [24.2, 24.8, 0.5]],
};

const tree = (cx: number, top: number, r: number): string =>
  `M${cx} ${top + 2 * r - 0.4}c${-r * 0.56} ${0} ${-r} ${-r * 0.36} ${-r} ${-r * 0.96}c0 ${-r * 0.64} ${r * 0.42} ${-r * 1.04} ${r} ${-r * 1.04}s${r} ${r * 0.4} ${r} ${r * 1.04}c0 ${r * 0.6} ${-r * 0.44} ${r * 0.96} ${-r} ${r * 0.96}Z`;

const orchard: Drawing = {
  wash: [
    ['leaf', `${tree(14.6, 8.8, 8.6)}${tree(31.6, 12.6, 6.8)}${tree(42, 17.4, 4.6)}`],
    ['straw', lens(4.4, 43.6, 38.6, 4)],
  ],
  line: [
    // Three fruit trees in a row, getting smaller as they go back.
    tree(14.6, 8.4, 8.6),
    'M14.4 25.4c.4 4.4.2 8.4-.6 12.4M14.2 30.4l-3-2.6M14.4 31.2l3.2-2.8',
    tree(31.6, 12.2, 6.8),
    'M31.6 25.4c.4 3.4.2 6.8-.4 10',
    tree(41.8, 17, 4.4),
    'M41.8 25.6c.2 2.6 0 5-.4 7.4',
    // The ground.
    'M3.8 38.6c13.4-1.4 27-1.4 40.4 0',
  ],
  detail: [
    'M9.4 15.8c1-1.6 2.6-2.6 4.4-2.8M28.4 17.6c.8-1.2 2-2 3.4-2.2',
    'M8.6 41.4c2-.6 4-.6 6 0M26 41.2c2-.6 4-.6 6 0',
  ],
  dots: [[11, 19.6, 0.9], [17.6, 16.6, 0.9], [15.4, 22.2, 0.9], [19.4, 20.8, 0.85], [29.4, 20.8, 0.8], [34.4, 18.4, 0.8], [33.6, 22.6, 0.8], [40.6, 21.8, 0.7], [43, 23.4, 0.65]],
};

const village: Drawing = {
  wash: [
    ['straw', 'M22.4 22.4 30.6 11.6h7.2l7.4 10.8ZM3.6 29.4l9.6-12.4h8.4l9.4 12.4Z'],
    ['leaf', lens(4.4, 43.6, 40.8, 3.4)],
  ],
  line: [
    // A farther house, partly hidden.
    'M22.6 22.6 30.6 11.6h7.2l7.6 11',
    'M42 22.4v14.4',
    // A nearer house: deep roof, walls, door.
    'M3.4 29.6 13.2 16.8h8.6l9.6 12.8c-9.4-.6-18.6-.6-28 0Z',
    'M12.4 15.2h10.2',
    'M6.4 29.4v11M28.6 29.4v11',
    'M14.6 40.2v-6.6h5v6.6',
    'M3.8 40.6c13.4-1 27-1 40.4 0',
  ],
  detail: [
    'M7.6 27l1.6-2.6M11.4 27.2l1.4-4M15.4 27.2l.8-5.6M19.6 27.2l-.8-5.6M23.6 27.2l-1.4-4M27.2 27l-1.6-2.6',
    'M30.6 20.6l1-2.2M34.2 20.6l.2-3.6M38.2 20.6l-.8-2.6',
    'M33.6 30.2h4.6v3.6h-4.6ZM9 32.6h3.4v3H9ZM22.6 32.6H26v3h-3.4Z',
    'M35.4 9.6c-.6-1.8.4-3 0-4.6M36.4 9.2c.6-1.4 1.6-2 1.4-3.6',
  ],
};

/** A raised bed seen from the side: a long low mound. */
const bed = (x0: number, x1: number, y: number, h: number): string =>
  `M${x0} ${y}c${(x1 - x0) * 0.1} ${-h} ${(x1 - x0) * 0.9} ${-h} ${x1 - x0} 0`;

const garden: Drawing = {
  wash: [
    ['leaf', `${lens(5.6, 30.6, 38.4, 3.4)}${lens(8.4, 28.6, 30.6, 2.8)}${lens(11.2, 26.4, 23.6, 2.4)}`],
    ['straw', 'M33.4 15.4c1.6-2.4 2.8-3.6 4.4-4 1.6.4 2.8 1.6 4.4 4-2.8.8-6 .8-8.8 0Z'],
  ],
  line: [
    // Three beds going back, each a little shorter.
    bed(4.8, 31, 39.6, 4.4),
    bed(7.8, 28.8, 31.8, 3.6),
    bed(10.6, 26.6, 24.8, 3),
    'M4.4 40c13.2-.8 26.4-.8 39.6 0',
    // A scarecrow keeping watch: pole, arms, head and a little straw hat.
    'M37.8 40.2V18.6',
    'M31.6 23.6c4-.6 8.2-.6 12.4 0',
    'M36.2 18.2c-.4-1.4.4-2.6 1.6-2.6s2 1.2 1.6 2.6c-.4 1-1.8 1.4-3.2 0Z',
    'M33.2 15.6c1.6-2.6 2.8-3.8 4.6-4.2 1.8.4 3 1.6 4.6 4.2-3 .8-6.2.8-9.2 0Z',
    'M34.8 23.8c-.4 3.4.2 6 1.8 8M40.8 23.8c.4 3.4-.2 6-1.8 8',
  ],
  detail: [
    // Rows of sprouts.
    'M9.6 35.4c-.4-1.2 0-2.2 1-2.8M9.6 35.4c.6-.8 1.6-1 2.4-.6M15.6 34.8c-.4-1.2 0-2.2 1-2.8M15.6 34.8c.6-.8 1.6-1 2.4-.6M21.6 34.8c-.4-1.2 0-2.2 1-2.8M21.6 34.8c.6-.8 1.6-1 2.4-.6M27 35.4c-.4-1.2 0-2.2 1-2.8M27 35.4c.6-.8 1.6-1 2.4-.6',
    'M12.4 28.6c-.2-1 .2-1.8 1-2.2M17.4 28.2c-.2-1 .2-1.8 1-2.2M22.6 28.2c-.2-1 .2-1.8 1-2.2',
    'M15 22.2c-.2-.8.2-1.4.8-1.8M19.6 21.8c-.2-.8.2-1.4.8-1.8',
    'M31.6 23.6l-1 1.6M44 23.6l1 1.6',
  ],
};

const wetland: Drawing = {
  wash: [
    ['river', 'M4.4 30.8c13.4-1.6 26.8-1.6 39.4 0 1.6 3.8 1.2 8.4-.8 11.6-12.4 1.4-25 1.4-37.6 0-1.8-3.4-2.2-7.8-1-11.6Z'],
    ['leaf', 'M8.4 30.6c-.4-6 .6-12.4 3-18.6l4 4.4c-1.2 4.4-1.4 9.2-.6 14.2ZM32 30.6c.2-5.6 1.6-10.6 4.4-15.2l3 5c-1.6 3.4-2.2 6.8-2 10.2Z'],
  ],
  line: [
    // Flat water reaching across.
    'M3.6 30.8c13.6-1.4 27.2-1.4 40.8 0',
    // Two clumps of reeds, with cattail heads.
    'M9.6 30.4c-.4-6.2.4-12 2.4-17.6M13 30.4c0-5.2.8-9.4 2.4-13M6.6 30.4c-.6-3.6-.4-7 .4-10',
    'M33.8 30.4c.4-5.6 1.6-10.2 3.6-14M37.2 30.4c-.2-3.6.2-6.8 1.4-9.6M31.2 30.4c-.6-3-1.4-5.4-2.6-7.4',
    'M11.4 15.2c-.4-1.8 0-3.8 1-5.2.8 1.6.8 3.6-.2 5.4M36.6 18.4c-.2-1.8.4-3.6 1.6-4.8.6 1.6.4 3.6-.8 5.2',
    // A lily pad.
    'M18.6 37.8c.2-1.4 2.4-2.4 5-2.4s4.6 1 4.6 2.4-2 2.2-4.6 2.2-5.2-.6-5-2.2ZM23.6 37.6l2.2-1.6',
  ],
  detail: [
    'M6 34.6c2-.6 4-.6 6 0M30.4 35.2c2.2-.6 4.4-.6 6.6 0M12.6 41.2c2.2-.6 4.4-.6 6.6 0M33.6 41.4c1.8-.5 3.6-.5 5.4 0',
    'M15.6 20.6c1.6-.4 2.8 0 3.6 1.2M28.6 22.4c-1.4.2-2.4 1-2.8 2.2',
  ],
};

const estuary: Drawing = {
  wash: [
    ['river', 'M4.4 18.6c13-.6 26.2-.6 39.2 0 .6 2.4.4 4.8-.6 7.2-4.8.8-8 3-9.6 6.6-1.8 3.8-2.8 7-3 10.4-3.4.6-7.2.6-10.6 0-.2-3.4-1.4-7-3.4-10.2-2.2-3.6-5.8-6-11.2-6.8-1.2-2.4-1.4-4.8-.8-7.2Z'],
    ['straw', 'M4.6 27c5.6.8 9.4 3 11.4 6.4 2 3.2 3 6.4 3.2 9.6-4.4.4-9 .2-13.4-.6-1.6-5-2-10.2-1.2-15.4ZM43.4 27c-5 .8-8.2 3-10 6.2-1.8 3.4-2.6 6.6-2.8 9.8 4.2.4 8.4.2 12.4-.6 1.4-5 1.6-10.2.4-15.4Z'],
  ],
  line: [
    // The sea's horizon.
    'M3.6 18.2c13.6-.4 27.2-.4 40.8 0',
    // The river's banks opening out to meet it.
    'M3.6 25.8c6.2.6 10.2 3 12.4 6.8 2.2 3.6 3.4 7.4 3.4 11.4',
    'M44.4 25.8c-5.4.6-9 2.8-11 6.6-2 4-3 7.6-3 11.6',
    // A sandbar at the mouth.
    'M18.6 26.2c2-1.2 4.4-1.6 7.2-1.2 1.6.2 3 .8 3.8 1.6',
    // Gulls over the open water.
    'M14.4 10.6c1-.9 2.2-.9 2.8.2.6-1.1 1.8-1.1 2.8-.2M26 7.4c.8-.7 1.8-.7 2.4.2.6-.9 1.6-.9 2.4-.2',
  ],
  detail: [
    'M10.6 21.6c2-.6 4-.6 6 0M27 21.2c2.4-.6 4.8-.6 7.2 0M36.6 22.6c1.6-.4 3.2-.4 4.8 0',
    'M21.4 32.4c1.6-.6 3.2-.6 4.8 0M22.6 38.4c1.4-.6 2.8-.6 4.2 0',
    'M6.4 30.6l-.6-1.6M9.6 34.6l-.8-1.4M40.6 31.4l.8-1.6',
  ],
};

export const PLACES: Record<string, Drawing> = {
  // A waterfall between rocks into a pool.
  'place-waterfall': spring,
  'place-woodland': woodland,
  // Two winding banks with a stone midstream: a small creek.
  'place-creek': river,
  'place-tarn': tarn,
  // A waymark stone and a broken wall beside the old road.
  'place-road': ruins,
  'place-meadow': meadow,
  'place-orchard': orchard,
  'place-village': village,
  'place-inn': village,
  'place-garden': garden,
  // Reeds with cattails and a lily pad.
  'place-reeds': wetland,
  'place-estuary': estuary,
};

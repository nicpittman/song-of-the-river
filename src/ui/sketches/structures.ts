/**
 * The structures the friends can build, drawn as they stand in the
 * painted valley: a fenced flower bed, an arched footbridge, a fishing deck,
 * a lean-to, a thatched cottage, a jetty, a raised lookout, the little
 * river boat, and stepping stones across a stream.
 */

import { ring, type Drawing } from './pen';
import { bloom, lens } from './places';

/** A loose line of water, used under the bridge, deck, jetty and boat. */
const WATER = 'M4.6 42.2c2.6-1 5.2-1 7.8 0s5.2 1 7.8 0 5.2-1 7.8 0 5.2 1 7.8 0 4.2-.8 6.2 0';

const garden: Drawing = {
  wash: [
    ['blossom', `${bloom(14, 17.8, 4.6, 6)}${bloom(22.8, 14.8, 5, -12)}${bloom(29.8, 18, 4.4, 20)}${bloom(38.6, 21.4, 4, -4)}`],
    ['leaf', lens(6, 42, 33.2, 8.4)],
  ],
  line: [
    // The bed, mounded a little above the ground.
    'M5.6 33.2c6.4-3 30.4-3.2 36.8-.2',
    // Flowers on their stems.
    'M13.6 31.8c-.4-3.8 0-7.4.6-10.6M22.6 31.4c-.2-5 .2-9.4.4-13.2M30.4 31.6c.2-4.2-.1-7.6-.6-10.6M37.8 32.2c0-3.2.4-5.8.8-8',
    bloom(14, 17.8, 3.8, 6),
    bloom(22.8, 14.8, 4.2, -12),
    bloom(29.8, 18, 3.6, 20),
    bloom(38.6, 21.4, 3.2, -4),
    // A low fence in front: posts and two rails.
    'M8 30.8v11.6M16.2 31.4v11.2M24.2 31.6v11M32.2 31.4v11.2M40.2 30.8v11.6',
    'M6.6 35.6c11.4-.9 23.4-.9 35 0M6.6 39.8c11.4-.6 23.4-.6 35 0',
  ],
  detail: [
    'M14 26.6c-1.8-.6-2.8-2-2.6-3.6 1.8.2 2.8 1.6 2.6 3.6ZM22.8 25c1.8-.8 3.4-.4 4.2 1-1.6.8-3.2.4-4.2-1ZM30.2 26.6c-1.6-.4-2.6-1.6-2.4-3.2 1.6.2 2.6 1.4 2.4 3.2Z',
    'M7.4 30.4l1.2-.8M15.6 31l1.2-.8M39.6 30.4l1.2-.8',
  ],
  dots: [[14, 17.8, 0.7], [22.8, 14.8, 0.8], [29.8, 18, 0.65], [38.6, 21.4, 0.6]],
};

const bridge: Drawing = {
  wash: [
    ['river', lens(4, 44, 37, 7)],
    ['straw', 'M4.8 29.4C14 19.6 34 19.6 43.2 29.4l-1.4 2.8C33 23.8 15 23.8 6.2 32.2Z'],
  ],
  line: [
    // The arched deck: its walking surface and the beam beneath.
    'M4.6 29.6C14 19.4 34 19.4 43.4 29.6',
    'M6 32.4C15 23.6 33 23.6 42 32.4',
    'M4.6 29.6 6 32.4M43.4 29.6 42 32.4',
    // The hand rail and its posts.
    'M7.2 23.6C15.4 14.6 32.6 14.6 40.8 23.6',
    'M9 22l.5 5.4M16.4 17.4l.2 5.4M24 15.8v5.2M31.6 17.4l-.2 5.4M39 22l-.5 5.4',
    // Two piers down into the water.
    'M12.6 29.4v10.4M35.4 29.4v10.4',
    WATER,
  ],
  detail: [
    'M11 29.4l.8-1.6M17 26.4l.4-1.6M23 25.2l.2-1.6M29 25.6l-.1-1.6M35 27.6l-.4-1.6',
    'M15.4 39.6c1.4-.5 2.8-.5 4.2 0M28.2 39.4c1.4-.5 2.8-.5 4.2 0',
  ],
};

const platform: Drawing = {
  wash: [
    ['river', lens(13.6, 44, 34.4, 8.8)],
    ['straw', 'M4.2 25.4h27.4l2.6 3.6H6.4Z'],
  ],
  line: [
    // The bank it is built out from.
    'M3.6 24.8c2.6-.4 4.6.4 6.4 1.6M3.8 44.2c1.2-5 2-10.6 2.4-15.2',
    // The deck, seen a little from above, on four posts.
    'M4.2 25.4h27.4l2.6 3.6H6.4Z',
    'M10.2 29v12.6M19.4 29v13M28.6 29v13M33.4 28.6v10.8',
    // A post at the deck's end and a rod propped against it, its line in the water.
    'M31 25.2v-7',
    'M31.2 24.6C35 18.8 38.8 13 43.4 8.4',
    'M43.4 8.4c.8 6.4.6 13-.4 19.2',
    'M14.6 35.8c4.4-1 9-1 13.4 0s9.2 1 13.4 0',
  ],
  detail: [
    'M11.6 25.6l1 3.2M17.4 25.6l.8 3.2M23.2 25.6l.7 3.2M29 25.6l.6 3.2',
    'M40.4 29.6c1.4-.5 2.8-.5 4 0M20 40.4c1.4-.5 2.8-.5 4.2 0',
  ],
  dots: [[43, 28.2, 0.8]],
};

const shelter: Drawing = {
  wash: [
    ['straw', 'M6.6 21.2 40.2 13.2l1.4 3.2L7.4 24.4Z'],
    ['leaf', lens(4.4, 43.6, 41, 3.4)],
  ],
  line: [
    // A single-pitched roof, high at the back, on two posts.
    'M6.6 21.4 40.2 13.4l1.4 3.2L7.4 24.4Z',
    'M10.2 23.6v17M37.6 16.6v24',
    // Its back wall of upright boards, half height.
    'M10.4 30.4c9-1.8 18-3.6 27-4.4',
    'M4 40.8c13-1.2 27-1.2 40 0',
    // Firewood stacked under the roof.
    ring(17.8, 38, 2.1),
    ring(22.4, 38.1, 2.1),
    ring(20.1, 34.2, 2.1),
  ],
  detail: [
    'M14.8 22.4l-.6-1.8M21 21l-.6-1.8M27.2 19.4l-.6-1.8M33.4 17.8l-.6-1.8',
    'M16 29.6v2.4M28 27.2v12.8M33 26.4v13.8',
  ],
  dots: [[17.8, 38, 0.6], [22.4, 38.1, 0.6], [20.1, 34.2, 0.6]],
};

const cottage: Drawing = {
  wash: [
    ['straw', 'M5 25.4 17.8 9.2h12.6l12.8 16.2Z'],
    ['leaf', lens(4.4, 43.6, 40.8, 3.4)],
  ],
  line: [
    // A deep thatched roof with a short ridge.
    'M4.8 25.8c.2-.6.6-1 1.2-1.4L17.6 9.4h12.8l11.6 15c.6.4 1 .8 1.2 1.4-12.6-.6-25.4-.6-38.4 0Z',
    'M16.4 7.6h15.2',
    // Low walls, a door and two windows.
    'M9.4 25.4v15.2M38.6 25.4v15.2',
    'M6.8 40.8c11.4-.4 23-.4 34.4 0',
    'M21 40.6v-9.4h6v9.4',
    'M12.8 29.6h5.2v4.4h-5.2ZM30 29.6h5.2v4.4H30Z',
  ],
  detail: [
    'M10.2 22.4l2-3M14 22.6l2.4-4.8M18.4 22.6l1.6-6.4M24 22.8V15M29.6 22.6l-1.6-6.4M34 22.6l-2.4-4.8M37.8 22.4l-2-3',
    'M15.4 31.8h2.6M32.6 31.8h2.6M24 31.4v9.2',
    'M31 7.4c.6-2 2.4-3 2-4.6',
  ],
};

const dock: Drawing = {
  wash: [
    ['river', lens(4, 44, 35.8, 8)],
    ['straw', 'M4 26.6h35.6v3.4H4Z'],
  ],
  line: [
    // A long jetty on posts, out into open water.
    'M4 26.6h35.6v3.4H4',
    'M8.4 30v10.4M16.6 30v11.2M25 30v11.2M33.4 30v11.2M39.4 30v10',
    // A mooring post at the end with a rope dropping to the water.
    'M38 26.4v-7.2M36.4 19c1-.6 2.2-.6 3.2 0',
    'M38.6 22.6c2.6.6 4.6 2.6 5 6.2.2 2.4-.4 4.6-1.6 6.4',
    // A lantern on a pole at the landward end.
    'M7.6 26.4V11.6M7.6 12c1.6 0 3 .4 4.2 1.2M10.6 13.4v2.2M9.2 15.6h2.8v4H9.2Z',
    'M4.4 37.2c2.6-1 5.2-1 7.8 0s5.2 1 7.8 0 5.2-1 7.8 0 5.2 1 7.8 0 4.2-.8 6.2 0',
  ],
  detail: [
    'M10 26.8v3M15 26.8v3M20 26.8v3M25 26.8v3M30 26.8v3M35 26.8v3',
    'M12.6 42.2c1.4-.5 2.8-.5 4.2 0M27.6 42.6c1.4-.5 2.8-.5 4.2 0',
  ],
  dots: [[10.6, 17.6, 0.9]],
};

const lookout: Drawing = {
  wash: [
    ['leaf', 'M6 41.4c1.2-5 4.2-8.6 8.8-9.8 3.2-3 8.2-3.6 12.6-2.6 4-1.4 8.8.6 11.4 4.2 2.4 2.4 3.4 5 3.4 8.2Z'],
    ['straw', 'M12.4 16.4c3.8-2.4 7.6-5 11.6-7.8 4 2.8 7.8 5.4 11.6 7.8-7.6.4-15.6.4-23.2 0Z'],
  ],
  line: [
    // The rock it stands on.
    'M5.6 41.8c1-5.2 4.2-9 8.8-10.2 3.2-3.2 8.4-3.8 12.8-2.6 4.2-1.6 9 .4 11.6 4 2.4 2.4 3.6 5.2 3.6 8.8',
    'M4.4 42c13-.8 26.4-.8 39.4 0',
    // Four legs, a deck with a rail, and a plain plank roof.
    'M17.2 31.2V16.6M30.8 31.2V16.6M20.4 30v-8M27.6 30v-8',
    'M14.8 22.6h18.4M15.2 19.2h17.6',
    'M12.4 16.4c3.8-2.4 7.6-5 11.6-7.8 4 2.8 7.8 5.4 11.6 7.8-7.6.4-15.6.4-23.2 0Z',
    'M24 7.4V5',
  ],
  detail: [
    'M17.6 26.4l13 .2',
    'M10.6 37.4c1.6-.8 3.4-1 5.2-.6M28.6 35.6c1.8-.4 3.6 0 5 .8M21 39.6c1.6-.4 3.2-.4 4.8.2',
    'M17.6 19.4v3M22 19.4v3M26 19.4v3M30.4 19.4v3',
  ],
};

const boat: Drawing = {
  wash: [
    ['straw', 'M25 9.4c5.2 1 10 1 15 0-.6 6.6-.6 13 0 19.6-5-1-9.8-1-15 0Z'],
    ['river', lens(4, 44, 36.6, 7.2)],
  ],
  line: [
    // A shallow hull with a raised bow, the mast, and a square sail on its yard.
    'M4.6 30.8c.8-.6 1.6-.8 2.6-.6 11.2.8 22.4.8 33.6 0 1-.2 2 0 2.6.6-2.8 5.6-8.4 8.4-19.4 8.4S7.6 36.4 4.6 30.8Z',
    'M4.6 30.8c-.6-1.4-.4-3 .6-4.2',
    'M24.4 31V6.4',
    'M24.8 9.2c5.4 1.1 10.4 1.1 15.4 0-.7 6.6-.7 13.2 0 19.8-5-1.1-10-1.1-15.4 0',
    'M3.6 41.8c2.6-1 5.2-1 7.8 0s5.2 1 7.8 0 5.2-1 7.8 0 5.2 1 7.8 0 4.2-.8 6.2 0',
  ],
  detail: [
    'M24.8 14.2c5 .9 10 .9 15 0M24.8 19.2c5 .9 10 .9 15 0M24.8 24.2c5 .9 10 .9 15 0',
    'M8.6 33.4c10 .8 20.4.8 30.6 0',
    'M24.4 9.4 12.2 30.4',
  ],
  dots: [[24.4, 6.2, 0.7]],
};

/** A trumpet flower of a day lily, open towards the viewer. */
function lily(x: number, y: number): string {
  return `M${x} ${y}c-2-1.2-3.2-3.2-3-5.8 1.6.2 2.6 1.4 3.2 2.8.4-1.8 1.6-3 3.4-3.2.2 2.6-1.2 4.8-3.6 6.2Z`;
}

/** A bed of day lilies: an edged bed, arching strap leaves and three orange trumpets on tall stems. */
const lilyBed: Drawing = {
  wash: [
    ['straw', `${lily(14.6, 21.6)}${lily(24.4, 17.4)}${lily(33.8, 22.4)}`],
    ['leaf', 'M6.4 38.2c1.6-4.6 4-7.6 7-9.4 3.4 1 6.2 3.4 8.6 6.8 2.2-3.6 5.4-6 9.2-7 3.4 1.6 6.6 4.8 10.6 9.6Z'],
  ],
  line: [
    lily(14.6, 21.6),
    lily(24.4, 17.4),
    lily(33.8, 22.4),
    'M14.6 21.8c-.2 5.2 0 10.6.6 15.8M24.4 17.6c.2 6.6.2 13.4-.2 20M33.8 22.6c0 5 .2 10-.4 15',
    'M12.6 37.6c-1.6-3.6-4-6.2-7.4-7.6M17 37.6c1-4.6 3.6-7.8 7.4-9.4M28.6 37.6c-1.4-3.8-4.2-6.4-8-7.4M31.6 37.6c1.8-3.6 5-6 9.4-6.8',
    'M5.6 38.2c12.2-1.4 24.6-1.4 36.8 0',
    'M5.6 38.2v3.6M42.4 38.2v3.6M5.6 41.8c12.2-1.2 24.6-1.2 36.8 0',
  ],
  detail: ['M9.4 40l.6-1.6M15 40.2l.4-1.8M21 40.2v-1.8M27 40.2l-.2-1.8M33 40.2l-.4-1.8M38.6 40l-.6-1.6'],
};

/** A young willow: a slim staked trunk by the water, its long strands falling like a curtain from an arched crown. */
const youngWillow: Drawing = {
  wash: [
    ['leaf', 'M13.6 31.2c-.8-8.6 3.2-16.4 11-17.4 7.8-1 11.8 6.6 10.6 17.4-3.4-1.6-7-2.4-10.8-2.4s-7.6.8-10.8 2.4Z'],
    ['river', 'M8.4 40.6c6-1.2 12-1.2 18 0s11.6 1.2 16.2 0v3H8.4Z'],
  ],
  line: [
    'M24.4 39.6c-.4-6.6-.2-13.2.6-19.6',
    'M29.4 40.2V27.4',
    'M24.6 32.4l4.8.6',
    'M13.6 31.2c-.8-8.6 3.2-16.4 11-17.4 7.8-1 11.8 6.6 10.6 17.4',
    'M8.4 40.8c6-1.2 12-1.2 18 0s11.6 1.2 16.4 0',
  ],
  detail: [
    'M16.4 19.6c-.8 3.6-1 7.6-.4 11.6M19.6 16.2c-.8 4.4-.8 9.2 0 13.6M23 14.6c-.4 4.4-.2 8.8.4 13.2M27.6 14.6c.8 4.4 1 8.8.4 13.2M31.4 16.6c1 4.2 1.2 8.6.6 13M34 20.4c.8 3.6.8 7.4.2 11',
    'M25 20.4l-3.4-3.4M25.2 22l3.6-3.6',
  ],
};

/** A young apple tree: a round crown with a few apples, tied to a stake in fresh ground. */
const fruitTree: Drawing = {
  wash: [
    ['leaf', 'M13.8 20.6c0-6.2 4.6-10.8 10.4-10.8s10.4 4.4 10.4 10.4c0 5.4-4.6 8.6-10.4 8.6s-10.4-3-10.4-8.2Z'],
    ['blossom', `${ring(18.6, 23, 1.7)}${ring(28.6, 17.4, 1.7)}${ring(30.2, 24.2, 1.6)}`],
  ],
  line: [
    'M13.8 20.6c0-6.2 4.6-10.8 10.4-10.8s10.4 4.4 10.4 10.4c0 5.4-4.6 8.6-10.4 8.6s-10.4-3-10.4-8.2Z',
    'M24.2 29v11.2M24.2 31.6l-3.4-3M24.2 33.4l3.6-3.4',
    'M29.6 40.4v-9.2M24.4 35.6l5.2-.6',
    ring(18.6, 23, 1.7),
    ring(28.6, 17.4, 1.7),
    ring(30.2, 24.2, 1.6),
  ],
  detail: ['M18.6 21.2l.4-1.2M28.6 15.6l.4-1.2M30.2 22.6l.4-1.2', 'M18 16.4c1.2-1.6 2.8-2.6 4.8-3'],
};

/** Flat stones set across a stream, from bank to bank. */
const steppingStones: Drawing = {
  wash: [
    ['river', 'M3.6 30.2c8-4.4 18.6-11 28-16.2 4.6-2.6 9.2-4.2 13.4-5v16.6c-6.2 2.4-13.8 6.8-21.4 11.6-6 3.8-12.6 7-20 8.6Z'],
    ['straw', 'M4.800000000000001 37.6c0-2.9 2.3-4.2 4.6 -4.2s4.6 1.3 4.6 4.2c0 2.3-2.3 3.6-4.6 3.6s-4.6-1.3-4.6-3.6ZM12.999999999999998 32.4c0-2.8 2.2-4.0 4.4 -4.0s4.4 1.2 4.4 4.0c0 2.2-2.2 3.5-4.4 3.5s-4.4-1.2-4.4-3.5ZM20.8 27.6c0-2.6 2.1-3.8 4.2 -3.8s4.2 1.2 4.2 3.8c0 2.2-2.1 3.4-4.2 3.4s-4.2-1.2-4.2-3.4ZM28.4 23.2c0-2.5 2.0-3.7 4 -3.7s4 1.1 4 3.7c0 2.1-2.0 3.2-4 3.2s-4-1.1-4-3.2ZM35.6 19.2c0-2.4 1.9-3.5 3.8 -3.5s3.8 1.1 3.8 3.5c0 2.0-1.9 3.1-3.8 3.1s-3.8-1.1-3.8-3.1Z'],
  ],
  line: [
    // The two banks of the stream.
    'M3.6 30.2c8-4.4 18.6-11 28-16.2 4.6-2.6 9.2-4.2 13.4-5',
    'M3.6 45.8c7.4-1.6 14-4.8 20-8.6 7.6-4.8 15.2-9.2 21.4-11.6',
    'M4.800000000000001 37.6c0-2.9 2.3-4.2 4.6 -4.2s4.6 1.3 4.6 4.2c0 2.3-2.3 3.6-4.6 3.6s-4.6-1.3-4.6-3.6ZM12.999999999999998 32.4c0-2.8 2.2-4.0 4.4 -4.0s4.4 1.2 4.4 4.0c0 2.2-2.2 3.5-4.4 3.5s-4.4-1.2-4.4-3.5ZM20.8 27.6c0-2.6 2.1-3.8 4.2 -3.8s4.2 1.2 4.2 3.8c0 2.2-2.1 3.4-4.2 3.4s-4.2-1.2-4.2-3.4ZM28.4 23.2c0-2.5 2.0-3.7 4 -3.7s4 1.1 4 3.7c0 2.1-2.0 3.2-4 3.2s-4-1.1-4-3.2ZM35.6 19.2c0-2.4 1.9-3.5 3.8 -3.5s3.8 1.1 3.8 3.5c0 2.0-1.9 3.1-3.8 3.1s-3.8-1.1-3.8-3.1Z',
  ],
  detail: [
    // Water moving round the stones.
    'M13.2 38.6c1.2.6 2.6.6 3.8 0M21 33.6c1.2.6 2.6.6 3.8 0M28.6 28.8c1.2.6 2.4.6 3.6 0M35.8 24.4c1 .6 2.2.6 3.4 0',
    'M6.8 26.6l1.4-.6M44 30.4l1-.8',
  ],
};

export const STRUCTURES: Record<string, Drawing> = {
  'structure-garden': garden,
  'structure-bridge': bridge,
  'structure-ford-bridge': bridge,
  'structure-stones': steppingStones,
  'structure-platform': platform,
  'structure-shelter': shelter,
  'structure-cottage': cottage,
  'structure-dock': dock,
  'structure-lookout': lookout,
  'structure-boat': boat,
  'structure-lily-bed': lilyBed,
  'structure-willow': youngWillow,
  'structure-fruit-tree': fruitTree,
};

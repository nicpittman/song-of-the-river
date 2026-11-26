/**
 * The four shared tools: a walking staff with its gourd, a field satchel with
 * a notebook and a glass, a rod with its creel, and a straw rain cape.
 */

import { ring, type Drawing } from './pen';

const walkingStaff: Drawing = {
  wash: [
    ['straw', 'M34.6 14.4c-1.8.2-2.6 1.6-2.4 2.8.2.8.6 1.4 1.2 1.8-2.6.8-4 3-3.6 5.4.4 2.6 2.4 4 4.8 4s4.4-1.6 4.6-4.2c.2-2.4-1.2-4.4-3.4-5.2.8-.4 1.4-1.2 1.2-2.2-.2-1.4-1.2-2.4-2.4-2.4Z'],
    ['blossom', 'M27.6 10.4c1.4-.6 2.8-.4 3.6.6l-1.8 3.4c-1.2-.4-2-1.6-1.8-4Z'],
  ],
  line: [
    // A long staff leaning across the page, a knot of root at its head.
    'M11.6 45C17.8 32 24.4 18.4 32.2 5.4',
    'M30.8 6.4c.6-1.6 1.8-2.4 3.2-2.2.8 1.2.6 2.8-.6 3.8',
    // The gourd hanging on its cord.
    'M28.8 11.6c2 .6 3.8 1.4 5.4 2.8',
    'M34.6 14.4c-1.8.2-2.6 1.6-2.4 2.8.2.8.6 1.4 1.2 1.8-2.6.8-4 3-3.6 5.4.4 2.6 2.4 4 4.8 4s4.4-1.6 4.6-4.2c.2-2.4-1.2-4.4-3.4-5.2.8-.4 1.4-1.2 1.2-2.2-.2-1.4-1.2-2.4-2.4-2.4Z',
  ],
  detail: [
    // Cord binding, a stopper, and grain along the shaft.
    'M27.4 12.2l2.6 1.4M28.2 10.8l2.6 1.4',
    'M34.4 14.4l.4-1.6',
    'M18.6 32.6l1.6-3.2M14.6 40.4l1.2-2.4',
    'M32.2 22.6c1 .6 1.6 1.6 1.6 2.8',
  ],
};

const fieldKit: Drawing = {
  wash: [
    ['straw', 'M7.4 22.4h25.2l-1 19.4c-7.6.6-15.4.6-23 0Z'],
    ['river', 'M36.6 27.6c2.8 0 5 2.2 5 5s-2.2 5-5 5-5-2.2-5-5 2.2-5 5-5Z'],
  ],
  line: [
    // The satchel, its flap and buckle, and the strap rising out of the page.
    'M7.4 22.4h25.2l-1 19.4c-7.6.6-15.4.6-23 0Z',
    'M7.6 22.6c.6 4.8 4.6 7.6 12.4 7.6s11.8-2.8 12.4-7.6',
    'M18.4 29.6h3.4v3.6h-3.4Z',
    'M8.6 22.4C9.6 12 17 5.6 24.8 5.4c5.4-.2 9.6 2.4 12 6.4',
    // A notebook standing in the bag.
    'M12.8 22.4v-6.8l11.6-1.6v8.4',
    // A hand glass leaning on the bag.
    'M41.8 32.6c-.1 2.9-2.4 5.1-5.3 5-2.8-.1-5-2.4-4.9-5.3.1-2.8 2.4-5 5.3-4.9 1.8.1 3.2.9 4.1 2.2',
    'M40.4 36.6l4 4.4',
  ],
  detail: [
    'M15.2 18.4l6.8-1M15.2 20.6l5-.6',
    'M10.4 37.4c6.4.4 12.6.4 19 0',
    'M34.4 30.4c.8-.8 1.8-1.2 2.8-1.2',
  ],
  dots: [[20.1, 31.4, 0.55]],
};

const fishingKit: Drawing = {
  wash: [
    ['straw', 'M6.8 26.2h22.6l-1.8 16.2H8.6Z'],
    ['river', 'M34.4 30.4c2.6-1.6 7-1.4 9.2.6.6 1.6-1.6 2.8-4.6 2.8s-5-1.6-4.6-3.4Z'],
  ],
  line: [
    // A wicker creel with a domed lid and a carrying strap.
    'M6.8 26.2h22.6l-1.8 16.2H8.6Z',
    'M6.2 26.4c1.4-3.2 6.6-4.8 11.8-4.8s10.4 1.6 11.8 4.8',
    'M7.4 26.4C6.6 18 11 12.2 18 12c6.6-.2 10.6 5 11 12.2',
    ring(18, 23.6, 1.2),
    // The rod across it, and its line falling to a small hook.
    'M23 45.4 43.8 5.6',
    'M43.8 5.6c.9 7 .7 14-.4 20.2',
    'M43.4 25.8c.2 1.6-.8 2.6-2 2.4-.8-.2-1.2-.8-1.2-1.6',
  ],
  detail: [
    // The weave.
    'M7.6 30.6h21.2M8 34.8h20.4M8.4 39h19.6',
    'M11.4 26.4l.6 16M15.8 26.4l.2 16M20.2 26.4v16M24.6 26.4l-.4 16',
    'M26.6 38.8l1.8-.9M27.8 36.6l1.8-.9',
    'M36.2 31.4c1.8-.6 3.6-.6 5.4 0',
  ],
};

const rainCape: Drawing = {
  wash: [
    ['straw', 'M20 7.8c2.6-1 5.4-1 8 0 1.6 6 5.4 11 12.4 17.4-1 6.6-1 12.6 1.4 18.4-6-1.4-12-1.6-17.8-1.6s-11.8.2-17.8 1.6c2.4-5.8 2.4-11.8 1.4-18.4C14.6 18.8 18.4 13.8 20 7.8Z'],
    ['river', 'M38.6 6.4c1.2 1.6 1.8 3 1.4 4.2-.4 1-1.6 1.2-2.4.4-.6-.8-.2-2.4 1-4.6Z'],
  ],
  line: [
    // A cape of layered straw, wide at the hem, tied at the throat.
    'M20 7.6c2.6-1 5.4-1 8 0 1.6 6 5.6 11 12.6 17.6-1 6.6-1 12.6 1.4 18.4-6-1.4-12-1.6-18-1.6s-12 .2-18 1.6c2.4-5.8 2.4-11.8 1.4-18.4C14.4 18.6 18.4 13.6 20 7.6Z',
    'M20.6 8.8c2.2 1.2 4.6 1.2 6.8 0',
    'M24 9.6l-1.6 4.6M24 9.6l1.8 4.4',
    // Two tiers of straw ends where the layers overlap.
    'M12.6 25.6c7.6 1.8 15.2 1.8 22.8 0',
    'M8.8 35c10 1.8 20.4 1.8 30.4 0',
    // A few drops running off it.
    'M38.6 6.4c1.2 1.6 1.8 3 1.4 4.2-.4 1-1.6 1.2-2.4.4-.6-.8-.2-2.4 1-4.6Z',
  ],
  detail: [
    'M16 17.6l-1 4.4M19.2 15.4l-.8 5.6M24 14.8v6.6M28.8 15.4l.8 5.6M32 17.6l1 4.4',
    'M13 27.6l-1 5.4M17.4 28.4l-.6 5.6M22 28.8l-.2 5.6M26.4 28.8l.2 5.6M31 28.4l.6 5.6M35.2 27.6l1 5.4',
    'M9.8 37.2l-.8 5M14.6 38l-.4 4.6M19.6 38.4l-.2 4.4M24.6 38.6v4.2M29.4 38.4l.2 4.4M34.2 38l.4 4.6M38.6 37.2l.8 5',
  ],
};

export const ITEMS: Record<string, Drawing> = {
  'item-walking-staff': walkingStaff,
  'item-field-kit': fieldKit,
  'item-fishing-kit': fishingKit,
  'item-rain-cape': rainCape,
};

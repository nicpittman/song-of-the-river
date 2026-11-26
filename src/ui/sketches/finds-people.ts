/**
 * Encounters: the people met along the river, as small whole figures at
 * their work or as the telling thing they left on the table. Smaller and
 * busier than the friends' head-and-shoulders portraits, so the two never
 * look alike.
 */

import { ring, type Drawing } from './pen';

/** The shrine keeper: a woman sweeping the steps with a long broom. */
const shrineKeeper: Drawing = {
  wash: [
    ['blossom', 'M15.6 18.6c-1.8 6-2.8 13-3 22.4h11.4c-.4-9.2-1.4-16.4-3.2-22.4-1.6-.6-3.6-.6-5.2 0Z'],
    ['straw', 'M28 43.6h16v-7.6h-10v3.8h-3v3.8Z'],
  ],
  line: [
    ring(18.2, 14.6, 2.8),
    'M15.6 18.6c-1.8 6-2.8 13-3 22.4h11.4c-.4-9.2-1.4-16.4-3.2-22.4-1.6-.6-3.6-.6-5.2 0Z',
    'M19.8 21.4c2.4 2.2 4.2 4.8 5.6 8M16.6 22c2.8 2.8 5.4 5.4 8.2 7',
    'M31.6 14.4 22.6 38.8',
    'M22.6 38.8c-1.8.6-3.2 2.4-3.8 4.6M22.6 38.8c-.6 1.4-.8 3-.6 4.8M22.6 38.8c.6 1.2 1.2 2.8 1.6 4.4',
    'M28 43.6h16M31 39.8h13M34 36h10',
  ],
  detail: ['M14.4 30.4c3 .6 6 .6 9 0', 'M12.6 43.4c.8-.8 1.8-1 2.8-.4-.8.8-1.8 1-2.8.4ZM8.4 42.6c.6-.8 1.6-1 2.4-.6-.6.8-1.6 1-2.4.6Z'],
  dots: [[17.2, 14.4, 0.4], [19.2, 14.4, 0.4]],
};

/** The miller's road: the old road drawn on the table in spilled tea, the cup beside it, a finger tracing it. */
const miller: Drawing = {
  wash: [
    ['straw', 'M5 24.6h38l-3.6 9.4H8.6Z'],
    ['river', 'M9.6 29.4c3-2 5-.4 8-1.6s4.4-2.8 7.6-2.2 5 1.6 8.4.4l.4 1.4c-3.6 1.4-5.6.2-8.6-.4s-4.4 1.2-7.6 2.4-5 .2-7.8 1.4Z'],
  ],
  line: [
    'M5 24.6h38l-3.6 9.4H8.6Z',
    'M10.4 34v8.4M37.6 34v8.4',
    'M9.6 30c3-2 5-.4 8-1.6s4.4-2.8 7.6-2.2 5 1.6 8.4.4',
    'M34.2 21.6c0 1.8 1.6 2.8 3.8 2.8s3.8-1 3.8-2.8v-4.4h-7.6Z',
    'M41.8 18.4c1.6 0 2.2 1 2 2-.2 1-1 1.6-2.2 1.6',
  ],
  detail: [
    'M10.6 32.2l1.4-.4M13.8 31.4l1.4-.4M17 30.8l1.4-.6M20.4 30l1.4-.6M23.6 29.2l1.4-.4M27 28.8l1.4.2M30.4 29.2l1.4 0',
    'M35.6 15.4c-.8-1-.4-2 .4-2.6M38.6 15.2c-.8-1-.4-2 .4-2.6',
  ],
  dots: [[33.8, 28.2, 0.7]],
};

/** The orchard keeper: an old man in a cap, reaching up with a pruning saw to an apple bough. */
const orchardKeeper: Drawing = {
  wash: [
    ['straw', 'M13.6 17.8c-2 5-3 12-3 23.2h10.4c0-8.6-.8-15.6-2.4-21.4Z'],
    ['leaf', 'M30 9.6c2.2-2.6 6.4-2.8 8.6-.4 2.6-1.4 5.4 0 5.4 2.8 0 2.6-2.2 4.2-5 3.8-2.4 1.8-6 1.6-8-.6-2-1.6-2.4-3.8-1-5.6Z'],
  ],
  line: [
    ring(16, 14.2, 2.8),
    'M13 12.6c1.8-1.6 4.4-1.6 6.2 0',
    'M13.6 17.8c-2 5-3 12-3 23.2h10.4c0-8.6-.8-15.6-2.4-21.4',
    'M18.4 20c2.6-1.6 5-3.6 7-6',
    'M24.6 15.4l7.4-4.6',
    'M41.6 42.2c-1-10-.6-20 1.4-30',
    'M42.6 22.2c-4.2-2-8-5.8-10.8-10.4',
  ],
  detail: [
    'M26.6 14.6l.6.8M28.4 13.4l.6.8M30.2 12.4l.6.8',
    'M15 17.2c.6.8 1.4 1.2 2.2 1.2',
    'M8.6 42.2c4-.6 8-.6 12 0',
  ],
  dots: [[36.4, 16, 1.1], [39.8, 18.4, 1], [15, 14, 0.35], [17, 14, 0.35]],
};

/** Aki at the lantern house: the carpenter up a ladder, mending the eaves with a hammer. */
const akiMeeting: Drawing = {
  wash: [
    ['straw', 'M4.4 13.4c12-2.4 26-4.6 39.6-6v3c-14 1.4-27.6 3.6-39.6 6Z'],
    ['blossom', 'M30 19.8c-1 3.6-1.4 7.2-1 10.6h4.4c.6-3.4.4-7-.6-10.6Z'],
  ],
  line: [
    'M4.2 13.4c12-2.4 26-4.6 39.8-6',
    'M4.2 16.4c12-2.4 26-4.4 39.8-6',
    'M8.2 16v27.6',
    'M26.8 44 32.2 13.4M33.4 44l5-31.6',
    ring(31.2, 17.2, 2.3),
    'M30 19.8c-1 3.6-1.4 7.2-1 10.6h4.4c.6-3.4.4-7-.6-10.6',
    'M32.6 21c1.6-1.6 2.6-3.4 3-5.4',
    'M34.8 14.6l3 1.4M36.4 15.2l-1.2 2.4',
    'M29.8 30.4l-.8 5.4M32.6 30.4l1 5.4',
  ],
  detail: [
    'M28.6 37.6h6.2M27.8 41.6h6.4M30.6 26h3.6M31.2 22h3.4',
    'M10 17.6v2M14 17v2M18 16.4v2M22 15.8v2M26 15.2v2',
    'M29.2 16.4c1.4-.8 2.8-.8 4.2 0',
  ],
};

/** Yui at the landing: an older woman on a bench, her book of stories open on her lap. */
const yuiMeeting: Drawing = {
  wash: [
    ['blossom', 'M17.2 18c-2.2 4-3 9-2.8 15 2.8 1.2 6.6 1.6 10.6 1.2l.4-6.6c.6-3.4.2-6.6-1.2-9.6-2.4-.8-4.8-.8-7 0Z'],
    ['straw', 'M16.8 27.6l5.4 1.6 5.4-1.6v5l-5.4 1.6-5.4-1.6Z'],
  ],
  line: [
    ring(20.2, 14.2, 2.8),
    ring(20.2, 10.4, 1.4),
    'M17.2 18c-2.2 4-3 9-2.8 15 2.8 1.2 6.6 1.6 10.6 1.2M24.2 18c1.4 3 1.8 6.2 1.2 9.6',
    'M16.8 27.6l5.4 1.6 5.4-1.6v5l-5.4 1.6-5.4-1.6Z',
    'M22.2 29.2v5',
    'M8.6 37.8h28M11 37.8v5.6M34.2 37.8v5.6',
  ],
  detail: ['M18 29.4l3 .8M18 31l3 .8M23.4 30.2l3-.8M23.4 31.8l3-.8', 'M19 17c.8.6 1.8.6 2.6 0'],
  dots: [[19.2, 14, 0.35], [21.2, 14, 0.35]],
};

/** The tide song: someone singing at the water's edge as the tide goes out. */
const tideSong: Drawing = {
  wash: [
    ['river', 'M22 35.4c3-1 6-1 9 0s6 1 13 0v6.8H20Z'],
    ['blossom', 'M12 19.4c-1.4 6-2 13-1.6 21.6h7.4c0-8.6-.6-15.6-2-21.6-1.2-.4-2.6-.4-3.8 0Z'],
  ],
  line: [
    ring(14, 15.8, 2.6),
    'M12 19.4c-1.4 6-2 13-1.6 21.6h7.4c0-8.6-.6-15.6-2-21.6-1.2-.4-2.6-.4-3.8 0Z',
    'M22 35.4c3-1 6-1 9 0s6 1 13 0',
    'M4.2 42c8-1 14-1.6 20-2.6s12-2.6 19.8-3',
  ],
  detail: [
    // The song drifting out over the water.
    'M18.6 15c2-1.2 4.2-.8 5.6.6 1.2 1.2 3 1.4 4.4.4M18.8 18c2.2-.4 4 .4 5.2 1.8 1.2 1.2 2.8 1.4 4.2.6',
    'M28 31.2c2.6-.6 5.2-.6 7.8 0M33.6 27.6c2.2-.5 4.4-.5 6.6 0M38.6 24.4c1.8-.4 3.6-.4 5.4 0',
  ],
};

export const ENCOUNTERS: Record<string, Drawing> = {
  'coastal-path': { wash: [['river', 'M4 38Q16 32 24 38T44 38V43H4Z']], line: ['M4 31H44M4 35H44M8 24V39M40 24V39M8 25Q24 11 40 25M8 29Q24 15 40 29M17 21V31M31 21V31'] },
  'shrine-keeper': shrineKeeper,
  miller,
  'orchard-keeper': orchardKeeper,
  'aki-meeting': akiMeeting,
  'yui-meeting': yuiMeeting,
  'tide-song': tideSong,
};

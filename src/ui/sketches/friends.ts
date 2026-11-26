/**
 * The five friends as small head-and-shoulders portraits. Each is known by a
 * hat and a prop, the way the painted explorers are: Sora's bedroll and staff,
 * Ren's sedge hat and rod, Mina's straw hat and basket, Aki's headband and
 * saw, Yui's hairpin and scroll, Haru's shoulder cape, quiver and bow.
 */

import { oval, ring, type Drawing } from './pen';

/** Shoulders falling away from the neck; shared so the five sit at the same height. */
const LEFT_SHOULDER = 'M10.6 45.2c.5-6.9 4.4-11.9 10.2-13.8';
const RIGHT_SHOULDER = 'M27.2 31.4c5.8 1.8 9.6 6.8 10.2 13.8';
const NECK = 'M21.4 26.6c.1 1.6-.1 3.2-.5 4.6M26.6 26.6c-.1 1.6.1 3.2.6 4.6';
/** The crossed collar of a kimono-style coat. */
const COLLAR = 'M20.9 31.3c1.7 2.7 3.3 5.3 4.6 8.6M27.1 31.3c-.8 1.2-1.6 2.4-2.3 3.5';
/** A coat's wash, shoulder to shoulder. */
const COAT = 'M11.4 45.4c.7-6.6 4.6-11.4 10-13.2l3 3.2 2.6-3.1c5.3 1.8 8.8 6.6 9.6 13.1Z';
const EYES: Array<[number, number, number]> = [[21.7, 21.6, 0.5], [26.3, 21.6, 0.5]];

const sora: Drawing = {
  wash: [
    ['straw', COAT],
    ['blossom', 'M10.6 27.6c4-1.2 8.4-1.4 12.6-1l1.6 4.6c-4.6-.4-9.4-.2-14 .8Z'],
  ],
  line: [
    // Head, bare but for a cloth band knotted at the side.
    'M18.2 20.4c-.3-4.2 2.4-7.1 5.9-7.1 3.6 0 6.1 2.7 6 6.7-.1 4-2.6 6.8-6 6.8-3.3 0-5.7-2.5-5.9-6.4Z',
    'M18.3 17.4c3.8-1.3 7.7-1.3 11.6.1',
    'M29.8 17.3l2.8-1.4M29.9 17.8l2.3 1.9',
    NECK,
    LEFT_SHOULDER,
    RIGHT_SHOULDER,
    COLLAR,
    // A bedroll strapped across the top of the pack, its ends showing past the shoulders.
    'M13.1 27.4c-1.5.1-2.5 1.1-2.4 2.3.1 1.2 1.1 2.1 2.6 2.1',
    'M13.2 27.4c2.2-.2 4.3-.2 6.3 0M28.4 27.3c2.3-.1 4.6 0 6.8.2M13.3 31.8c1.6-.1 3.3-.2 5-.1M30.2 31.6c1.7 0 3.4 0 5 .2',
    oval(35.3, 29.6, 1.25, 2.15),
    // Pack straps over the shoulders.
    'M17.6 32.4c.6 3.8.5 8-.4 12.6M30.6 32.4c-.5 3.8-.3 8 .5 12.6',
    // The walking staff, a gourd tied near its top, and the hand that holds it.
    'M40.4 6.8c-.4 12.8-.2 25.6.6 39',
    'M41.2 12.4c1.8-.2 2.8 1 2.6 2.4-.2 1.3-1.6 1.9-2.8 1.5M41.2 16.4c2.2.1 3.4 1.6 3 3.4-.3 1.6-2 2.3-3.4 1.8',
    'M37.4 35.6c1.3-1.1 2.8-1.2 4.4-.3',
  ],
  detail: ['M14.8 28.6l.6 2.4M32.6 28.6l-.4 2.4', 'M40.6 12.2l1.8-.6', 'M22.2 24.2c1.2.6 2.5.6 3.6 0'],
  dots: EYES,
};

const ren: Drawing = {
  wash: [
    ['river', COAT],
    ['straw', 'M11.8 18.4C16.2 12.8 20.3 9.3 24 8.5c3.8.9 8 4.4 12.4 9.9-3.6 1.4-7.9 2-12.4 2s-8.7-.6-12.2-2Z'],
  ],
  line: [
    // The sedge hat: a wide low cone with a small knob at its peak.
    'M11.4 18.6C15.8 13 20 9.3 24 8.3c4 1 8.2 4.6 12.8 10.3-3.7 1.4-8.2 2-12.8 2s-9-.6-12.6-2Z',
    'M23.2 8.5c.1-.9.5-1.4 1-1.4s.8.5.8 1.3',
    // Chin and jaw below the brim; a cord under the chin.
    'M19.3 20.4c.3 3.8 2.2 6.3 4.8 6.3 2.6 0 4.4-2.5 4.6-6.3',
    'M19.6 20.6c1.2 2.4 2.6 4 4.4 5.2',
    NECK,
    LEFT_SHOULDER,
    RIGHT_SHOULDER,
    COLLAR,
    // The rod rising from the hand, and the line falling from its tip to a float.
    'M31.8 41.6C35.8 29.4 39.8 17.8 45 5.6',
    'M45 5.6c.7 5.8.6 11.4-.4 16.6',
    oval(44.5, 23.6, 0.9, 1.4),
    'M30.4 39.6c1.3-1.2 3.2-1.4 4.8-.4',
  ],
  detail: ['M24 8.8l-5.4 10.8M24 8.8l-.1 11.6M24 8.8l5.6 10.6M24 8.8l-9.4 8.6M24 8.8l9.8 8.4', 'M14.4 36.6l2.2 1.6M33.6 36.2l-1.8 1.4'],
  dots: [[21.8, 22.3, 0.5], [26.4, 22.3, 0.5]],
};

const mina: Drawing = {
  wash: [
    ['leaf', COAT],
    ['straw', 'M10.8 16.4c1.6-2.3 3.8-3.2 6.8-3.5.4-3.4 3-5.6 6.2-5.6 3.4 0 6 2.4 6.4 5.6 3.2.3 5.6 1.2 7.2 3.5-1 1.8-6.6 3-13.4 3s-12.4-1.2-13.2-3ZM11.6 37.8h15l-1.6 7.8H13.2Z'],
  ],
  line: [
    // A round straw hat: brim, domed crown, a ribbon band with its tail loose.
    'M10.6 16.5c1.7-2.4 7-3.6 13.4-3.6s11.8 1.2 13.4 3.6c-1 1.8-6.6 3-13.4 3s-12.4-1.2-13.4-3Z',
    'M17.6 15.4c0-4.4 2.8-7.3 6.4-7.3s6.4 2.9 6.4 7.3',
    'M30.3 14.9l3.2 3.9M30.4 14.6l1.2 4.8',
    // Face under the brim.
    'M18.9 19.5c.2 4.3 2.4 7.1 5.1 7.1 2.8 0 4.9-2.8 5.1-7.1',
    NECK,
    // The left shoulder stops behind the basket.
    'M11.4 37.6c1.6-3 4.6-5.3 9.6-6.2',
    RIGHT_SHOULDER,
    COLLAR,
    // A basket held in front, its handle, and a sprig of something just picked.
    'M11 37.8h15.6l-1.7 7.9H12.6Z',
    'M13.4 37.7c1.2-5.4 9.8-5.4 11 0',
    'M16.4 37.4c-1.6-2.4-1-4.7 1.4-5.6.8 2.2 0 4.2-1.4 5.6Z',
    'M20.6 37.4c.4-2.8 2.2-4.2 4.6-4-.4 2.4-2.2 3.8-4.6 4Z',
  ],
  detail: [
    'M17.6 14c4.2 1 8.6 1 12.8 0',
    'M11.8 41.6h14.2M14.6 38l.7 7.6M18.8 38v7.6M22.9 38l-.6 7.6',
    'M16.4 37.4l.8-3.6M20.6 37.4l2.6-2.4',
  ],
  dots: [[21.8, 21.8, 0.5], [26.2, 21.8, 0.5]],
};

const aki: Drawing = {
  wash: [
    ['straw', COAT],
    ['river', 'M35.6 29.4 42.8 10.2l3.4 1.4-5.6 19.6Z'],
  ],
  line: [
    // Head with short hair and a twisted headband knotted above the brow.
    'M18.2 20.4c-.3-4.2 2.4-7.1 5.9-7.1 3.6 0 6.1 2.7 6 6.7-.1 4-2.6 6.8-6 6.8-3.3 0-5.7-2.5-5.9-6.4Z',
    'M18.4 15.6c.4-3.2 2.8-5.6 5.6-5.6 3 0 5.4 2.2 5.8 5.4',
    'M18 16.8c4.2 1.5 8.4 1.5 12.6-.1',
    'M19.2 16.6c-1.4-1.6-3.2-2-4.4-1.2M19.2 17.1c-1.8.4-3 1.6-3 3',
    // A carpenter's pencil behind the ear.
    'M29.8 18.6l3.4-3',
    NECK,
    LEFT_SHOULDER,
    RIGHT_SHOULDER,
    COLLAR,
    // A pull saw over the shoulder: the bound handle, then the long blade.
    'M31.2 41.2 35.8 29.4',
    'M35.6 29.4 42.8 10.2l3.4 1.4-5.6 19.6Z',
    'M30 39.4c1.4-1 3.2-1.1 4.6-.2',
  ],
  detail: [
    'M42.6 13.4l1 .5M41.8 15.6l1 .5M41 17.8l1 .5M40.2 20l1 .5M39.4 22.2l1 .5M38.6 24.4l1 .5M37.8 26.6l1 .5',
    'M33.4 34.8l1.6.7M32.6 37l1.6.6',
    'M15.2 34.6c1.6.8 2.4 2.2 2.2 4',
  ],
  dots: EYES,
};

const yui: Drawing = {
  wash: [
    ['blossom', COAT],
    ['straw', 'M13.6 36.4h21v6.4h-21Z'],
  ],
  line: [
    // Hair drawn back into a bun with a plain pin through it.
    'M17.8 21c-.8-5.2 1.8-9 6.2-9s7 3.8 6.2 9',
    'M18.4 18.2c.2 4.8 2.6 8.4 5.6 8.4s5.4-3.6 5.6-8.4',
    ring(24, 9.8, 2.7),
    'M19.8 7.6l8.8 4.4',
    NECK,
    LEFT_SHOULDER,
    RIGHT_SHOULDER,
    COLLAR,
    // An open scroll held across the chest, rolled at both ends.
    'M13.6 36.4c7-.3 14-.3 21 0M13.6 42.8c7 .3 14 .3 21 0',
    oval(13.6, 39.6, 1.4, 3.2),
    oval(34.6, 39.6, 1.4, 3.2),
    'M34.6 42.8c.3 1.4 1 2.2 2 2.4',
  ],
  detail: [
    'M17.2 38.6h6.2M17.2 40.8h9.4M25.4 38.6h6',
    'M20.6 14.2c1.4-1 3-1.4 4.6-1.2',
  ],
  dots: [[21.8, 21.8, 0.5], [26.2, 21.8, 0.5]],
};

const haru: Drawing = {
  wash: [
    ['leaf', COAT],
    ['blossom', 'M12.4 38.4c1.4-4.2 4.4-6.8 8.8-7.8l2.8 2.6 2.8-2.6c4.4 1 7.4 3.6 8.8 7.8-3.8 1.6-7.8 2.4-11.6 2.4s-7.8-.8-11.6-2.4Z'],
  ],
  line: [
    // Face, and short dark hair drawn back into a little tail.
    'M18.6 18.6c.2 4.6 2.6 8 5.4 8s5.2-3.4 5.4-8',
    'M18.2 19.4c-.6-4.6 2-7.8 5.8-7.8 3.6 0 6.2 3 5.8 7.4',
    'M29.4 15.4c1.6-.4 3 .2 3.8 1.4-1.2.6-2.6.4-3.6-.4',
    NECK,
    // A short shoulder cape over the tunic.
    'M12.2 38.4c1.4-4.2 4.4-6.8 8.8-7.8l3 2.6 3-2.6c4.4 1 7.4 3.6 8.8 7.8-3.8 1.6-7.8 2.4-11.8 2.4s-8-.8-11.8-2.4Z',
    'M11.4 39.6c-.6 1.8-.8 3.6-.8 5.6M36.6 39.6c.6 1.8.8 3.6.8 5.6',
    // The quiver behind the left shoulder, arrows showing.
    'M10.6 31.4l4.6-9.4 2.6 1.2-4.2 8.8',
    'M15.2 22l-.8-3.4M16.6 22.6l.4-3.4',
    // The bow held upright at the right, and its string.
    'M39.6 8.2c3.6 6 4.6 12.4 4.4 18.4-.2 6.2-1.6 12.2-4.4 18.2',
    'M39.6 8.2c-.4 12.2-.4 24.4 0 36.6',
    'M37.8 27.2c1.4-.8 3-.8 4.6 0',
  ],
  detail: ['M13.6 18.6l1.4.8M14.8 18.4l.8 1.4M16 19.2l1 1.2', 'M22.2 23.4c1.2.6 2.4.6 3.6 0', 'M17.4 33.6c4.4 1.4 8.8 1.4 13.2 0'],
  dots: [[21.8, 21.4, 0.5], [26.2, 21.4, 0.5]],
};

export const FRIENDS: Record<string, Drawing> = {
  'friend-sora': sora,
  'friend-ren': ren,
  'friend-mina': mina,
  'friend-aki': aki,
  'friend-yui': yui,
  'friend-haru': haru,
};

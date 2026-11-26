/**
 * What every part of the adventure layer needs to know about the frame being
 * drawn. One object, rewritten in place each frame, so the hot path allocates
 * nothing.
 */

import type { Container } from 'pixi.js';
import type { Season } from '../../world/types';
import type { CampDay } from './campLife';

export interface FrameInfo {
  /** Seconds since the last frame; 0 while paused. */
  dt: number;
  /** The layer's own clock, which stops while paused. */
  time: number;
  zoom: number;
  /** The visible world, with a margin for tall things (`VIEW_MARGIN` screen pixels each side). */
  left: number;
  top: number;
  right: number;
  bottom: number;
  reduced: boolean;
  /** The scene's dusk, 0..1. */
  dusk: number;
  /** How dark it is, 0 (day) .. 1 (deep night). */
  night: number;
  /** Strength of the camp fire's light on its surroundings, 0..1. */
  firelight: number;
  fireX: number;
  fireY: number;
  /** Strength of sun shadows, 0 at night. */
  sun: number;
  /** How far sun shadows reach, 1 at midday, longer toward evening. */
  sunLength: number;
  season: Season;
  /** Building sites still going up, for a carpenter to hammer at when she has nothing else to do. */
  sites: Array<{ x: number; y: number }>;
  /** An ordinary day with someone at home: camp life and the cooking smoke read it (see `campLife.ts`). */
  campDay: CampDay | null;
}

export function newFrame(): FrameInfo {
  return { dt: 0, time: 0, zoom: 1, left: 0, top: 0, right: 0, bottom: 0, reduced: false, dusk: 0, night: 0, firelight: 0, fireX: 0, fireY: 0, sun: 1, sunLength: 1, season: 0, sites: [], campDay: null };
}

/**
 * The containers the layer draws into. Ground, water and sorted belong to the
 * valley; `grade`, `glow` and `ink` are the layer's own and sit above all of
 * the scenery (see `AdventureLayer.top`).
 */
export interface Stage {
  /** Lies on the ground under everything standing: shadows, footprints, worn earth. */
  ground: Container;
  /** On the water, under anything standing: rises, ripples, wakes. */
  water: Container;
  /** Depth-sorted with the scenery by ground position. */
  sorted: Container;
  /** Additive light above the time-of-day wash: fire, lanterns, windows. */
  glow: Container;
  /** Ink marks laid over the painting: trails, place names, rings. Never darkened. */
  ink: Container;
}

/** Screen pixels added round the visible world in `FrameInfo` (left/top/right/bottom), so tall things just off screen still draw. */
export const VIEW_MARGIN = 140;

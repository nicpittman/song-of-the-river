/**
 * The placeholder registry: one painter per id, gathered from each family.
 * `paintFallback` consults it for any id it does not paint itself.
 *
 * Conventions: anything that moves faces RIGHT so the game can mirror it;
 * animation frames are separate ids with a numeric suffix (`deer-walk-0`..3);
 * layered things are separate ids (`mill-body`, `mill-wheel`).
 * Each painter runs only when its id is first requested.
 */

import type { Painted, Painter } from './common';
import { ANIMALS } from './animals';
import { PEOPLE } from './people';
import { FARM } from './farm';
import { VILLAGE } from './village';
import { LANDFORMS } from './landforms';
import { WATER } from './water';
import { FIRE } from './fire';
import { SHORE } from './shore';
import { EXPLORERS } from './explorers';
import { EXPEDITION } from './expedition';

export { MILL_WHEEL_CENTRE, MILL_WHEEL_OFFSET } from './village';

const REGISTRY: Record<string, Painter> = { ...ANIMALS, ...PEOPLE, ...FARM, ...VILLAGE, ...LANDFORMS, ...WATER, ...FIRE, ...SHORE, ...EXPLORERS, ...EXPEDITION };

export function isPlaceholder(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(REGISTRY, id);
}

export function paintPlaceholder(id: string): Painted | null {
  return isPlaceholder(id) ? REGISTRY[id]!() : null;
}

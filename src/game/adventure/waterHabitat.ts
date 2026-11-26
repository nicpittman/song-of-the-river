/** Aquatic sightings share the river geometry used to paint the water. */
import type { Vec } from '../core/math';
import type { River } from '../world/river';

/** A kingfisher only dives: it waits on its perch by the bank. */
export const livesInWater = (species: string): boolean => !/kingfisher/.test(species) && /salmon|carp|trout|fish|char|eel|duck|swan|goose|otter|grebe|teal|mullet|mandarin/.test(species);

/** Keep both spawn points and swimming drift inside the lowest ordinary waterline. */
export function inWater(river: River, point: Vec): Vec {
  const hit = river.nearest(point);
  const reach = Math.max(0, hit.half - 40);
  const k = hit.d > 0 ? Math.min(1, reach / hit.d) : 0;
  return { x: hit.point.x + (point.x - hit.point.x) * k, y: hit.point.y + (point.y - hit.point.y) * k };
}

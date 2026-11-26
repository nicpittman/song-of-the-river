import type { ExpeditionAdventure } from './expedition';
import type { Forecast, SecondStop } from './model';

interface PlanningCache {
  key: string;
  identity: object;
  forecasts: Map<string, Forecast>;
  stops: Record<string, SecondStop[]>;
}

const caches = new WeakMap<ExpeditionAdventure, PlanningCache>();

/** Reuse planning work across cosmetic snapshots, never across changed rules. */
export function planningCache(a: ExpeditionAdventure): PlanningCache {
  const s = a.state;
  // These values also cover direct state changes in review scenes and tests.
  // Camera, selection and the cosmetic clock deliberately leave this intact.
  const key = JSON.stringify([a.seed, s.day, s.phase, s.free, s.course, s.region,
    s.provisions, s.materials, s.voyage, s.moving, s.people, s.plans, s.resting,
    s.buildings, s.equipment, s.known, s.rumoured, s.discoveries, s.leads,
    s.visits, s.learned, s.given, s.tracked, s.almanac]);
  const previous = caches.get(a);
  if (s.phase === 'morning' && previous?.key === key) return previous;
  const cache: PlanningCache = { key, identity: {}, forecasts: new Map(), stops: {} };
  caches.set(a, cache);
  return cache;
}

/**
 * Where the friends live in each reach, taken from the painted board rather
 * than written down twice: the hearth nearest the settlement, moved onto open
 * ground if a house or the water is in the way, and a few spots round it (a
 * door, the woodshed, the well, the landing) for small walks.
 *
 * The same footprints keep walkers out of buildings (see `navigation.ts`).
 */

import { CAMP_SEATS, type CampOrigin } from './campSeats';
import { dist, pointSegment, type Vec } from '../core/math';
import type { River } from '../world/river';
import type { BoardDef, SpriteDef } from '../world/types';
import type { Pose } from './model';

export interface CampSpot {
  name: string;
  at: Vec;
  /** What a friend does on arriving there. */
  pose: Pose;
}

export interface Camp {
  fire: CampOrigin;
  spots: CampSpot[];
}

/**
 * Drawn size of each building-like sprite at scale 1, in board units (from the
 * art manifest; procedural stand-ins sized to match). Anchored at the bottom centre.
 */
export const FOOTPRINTS: Readonly<Record<string, readonly [number, number]>> = {
  farmhouse: [288, 199], cottage: [192, 185], 'timber-cottage': [256, 248], shed: [96, 99],
  watermill: [288, 244], 'mill-body': [230, 165], dock: [108, 96], shrine: [160, 190],
  well: [56, 64], 'stilt-hut': [140, 149], 'fish-drying-rack': [120, 80], 'net-rack': [110, 80],
  'rice-drying-rack': [120, 80], haystack: [70, 60], 'harbour-light': [84, 123], 'haru-camp': [110, 88], 'charcoal-kiln': [80, 60],
  'boat-beached': [130, 50], beehive: [40, 40], lantern: [35, 64], signpost: [29, 64], scarecrow: [40, 70],
};

/** Things a friend walks round but may stand beside (small props) are not solid ground blockers. */
const SOLID = new Set(['farmhouse', 'cottage', 'timber-cottage', 'shed', 'watermill', 'mill-body', 'shrine', 'well', 'stilt-hut', 'charcoal-kiln', 'harbour-light', 'haru-camp']);

const SPOT_FOR: Record<string, { name: string; pose: Pose }> = {
  farmhouse: { name: 'the farmhouse door', pose: 'look' },
  cottage: { name: 'a cottage door', pose: 'look' },
  'timber-cottage': { name: 'a cottage door', pose: 'talk' },
  shed: { name: 'the woodshed', pose: 'carry' },
  watermill: { name: 'the mill', pose: 'carry' },
  dock: { name: 'the landing', pose: 'carry' },
  well: { name: 'the well', pose: 'carry' },
  signpost: { name: 'the signpost', pose: 'talk' },
  'fish-drying-rack': { name: 'the drying racks', pose: 'forage' },
  'net-rack': { name: 'the nets', pose: 'forage' },
  'rice-drying-rack': { name: 'the rice racks', pose: 'forage' },
  'stilt-hut': { name: 'the stilt huts', pose: 'look' },
};

/** The rectangle a sprite covers: its whole image, or just the ground it stands on. */
function rect(s: SpriteDef, part: 'image' | 'ground'): { left: number; right: number; top: number; bottom: number } | null {
  const size = FOOTPRINTS[s.asset];
  if (!size) return null;
  const scale = s.scale ?? 1;
  const w = size[0] * scale;
  const h = size[1] * scale;
  if (part === 'image') return { left: s.x - w / 2, right: s.x + w / 2, top: s.y - h, bottom: s.y };
  return { left: s.x - w * 0.42, right: s.x + w * 0.42, top: s.y - h * 0.4, bottom: s.y };
}

/** True if `p` is inside a building's drawn image (with a margin), so a person there would be hidden. */
export function underBuilding(board: BoardDef, p: Vec, margin = 14): boolean {
  return board.sprites.some((s) => {
    const r = rect(s, 'image');
    return !!r && p.x > r.left - margin && p.x < r.right + margin && p.y > r.top - margin && p.y < r.bottom + margin;
  });
}

/** The ground footprints of solid buildings, for the walking map. */
export function buildingFootprints(board: BoardDef): Array<{ left: number; right: number; top: number; bottom: number }> {
  return board.sprites.flatMap((s) => (SOLID.has(s.asset) ? [rect(s, 'ground')!] : []));
}

const cache = new WeakMap<BoardDef, Map<string, Camp>>();

/** Clear ground beyond the road's edge, leaving room for the whole firepit. */
export function fireBesidePaths(board: BoardDef, at: Vec): boolean {
  return board.lanes.every(lane => lane.points.slice(1).every((b, i) => pointSegment(at, lane.points[i]!, b).d >= (lane.width ?? 26) / 2 + 30));
}

/** The camp for the settlement at `centre` (a settlement place's position). */
export function campAt(board: BoardDef, river: River, centre: Vec, outpost = false, bounds?: { top: number; bottom: number }): Camp {
  let byBoard = cache.get(board);
  if (!byBoard) cache.set(board, (byBoard = new Map()));
  const key = `${centre.x},${centre.y}:${outpost}:${bounds?.top ?? ''}:${bounds?.bottom ?? ''}`;
  const known = byBoard.get(key);
  if (known) return known;

  const open = (p: Vec, margin: number): boolean => (!bounds || (p.y >= bounds.top + 40 && p.y < bounds.bottom - 50)) && river.edgeDistance(p) > 45 && !underBuilding(board, p, margin);
  const hearth = outpost ? centre : board.hearths.reduce((best, h) => (dist(h, centre) < dist(best, centre) ? h : best), board.hearths[0] ?? centre);
  // Keep the logical centre on the painted fire. Fit people around it, rather
  // than moving the centre until a nominal ring fits and leaving the fire behind.
  const clearFire = (p: Vec): boolean => open(p, 6) && fireBesidePaths(board, p);
  const fire: CampOrigin = { ...(clearFire(hearth) ? hearth : nearestOpen(hearth, clearFire, 320) ?? hearth) };
  const seats: Vec[] = [];
  for (const offset of CAMP_SEATS) {
    const ideal = { x: fire.x + offset.x, y: fire.y + offset.y };
    const clear = (p: Vec): boolean => open(p, 6) && dist(p, fire) >= 60 && seats.every((other) => dist(p, other) >= 36);
    seats.push(nearestOpen(ideal, clear, 220) ?? ideal);
  }
  fire.seats = seats;

  const spots: CampSpot[] = [];
  const nearby = board.sprites.filter((s) => SPOT_FOR[s.asset] && dist(s, fire) < 380).sort((a, b) => dist(a, fire) - dist(b, fire));
  for (const sprite of nearby) {
    const door = nearestOpen({ x: sprite.x, y: sprite.y + 24 }, (p) => open(p, 10), 80);
    if (!door || dist(door, fire) < 60 || spots.some((s) => dist(s.at, door) < 70)) continue;
    spots.push({ ...SPOT_FOR[sprite.asset]!, at: door });
    if (spots.length >= 5) break;
  }
  const camp = { fire, spots };
  byBoard.set(key, camp);
  return camp;
}

/** The closest point to `from` (on a small spiral) that passes `ok`. */
function nearestOpen(from: Vec, ok: (p: Vec) => boolean, reach = 240): Vec | null {
  if (ok(from)) return { x: from.x, y: from.y };
  for (let r = 10; r <= reach; r += 10) {
    const steps = Math.max(8, Math.round((r * Math.PI * 2) / 14));
    let best: Vec | null = null;
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2 + Math.PI / 2;
      const p = { x: Math.round(from.x + Math.cos(angle) * r), y: Math.round(from.y + Math.sin(angle) * r) };
      if (ok(p) && (!best || p.y > best.y)) best = p;
    }
    if (best) return best;
  }
  return null;
}

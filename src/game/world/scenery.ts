/**
 * Composing the valley's standing scenery. Boards describe the landscape in
 * broad strokes (a wood here, an outcrop there, reeds along that bank) and
 * this module turns each stroke into individual trees, stones and plants.
 *
 * The aim is composition rather than coverage: woods are massed with a dense
 * heart and a stepped, ragged edge; rocks gather in groups; open ground is left
 * open. Placement is deterministic, so a valley looks the same every session.
 */

import { type Rng, mulberry32, valueNoise } from '../core/rng';
import { Polyline } from './geometry';
import type { River } from './river';
import { type BoardDef, CLEARINGS, type LaneDef, type OutcropDef, type WoodsDef } from './types';

/** How far the painted landscape extends beyond the playable board on each side. */
export const APRON = { left: 800, right: 800, top: 900, bottom: 640 } as const;

export interface SceneryItem {
  asset: string;
  rotation?: number;
  anchor?: [number, number];
  x: number;
  y: number;
  scale: number;
  flip: boolean;
  /** Stable 0..1 number for per-item variation (seasonal timing, autumn hue). */
  roll: number;
  /** Depth-sort adjustment, for things travellers walk over (bridges). */
  zBias?: number;
  /** Placed by hand in the board file. Authored pieces are never cleared to make way for a route. */
  fixed?: boolean;
}

type Weighted = ReadonlyArray<readonly [id: string, weight: number]>;

/**
 * A tilled plot as rows of furrows: `rows` narrow lanes of bare earth, `spacing`
 * apart, each `length` long, centred on (x, y) and running at `angle` radians.
 * Boards use this to lay out vegetable plots and field strips beside a village.
 */
export function furrows(x: number, y: number, length: number, rows: number, spacing: number, angle = 0): LaneDef[] {
  const along = { x: Math.cos(angle), y: Math.sin(angle) };
  // Rows step away from the viewer; depth is foreshortened because the valley is seen at a slant.
  const across = { x: -Math.sin(angle), y: Math.cos(angle) * 0.6 };
  const out: LaneDef[] = [];
  for (let i = 0; i < rows; i++) {
    const off = (i - (rows - 1) / 2) * spacing;
    const cx = x + across.x * off;
    const cy = y + across.y * off;
    out.push({
      width: 9,
      points: [
        { x: cx - (along.x * length) / 2, y: cy - (along.y * length) / 2 },
        { x: cx + (along.x * length) / 2, y: cy + (along.y * length) / 2 },
      ],
    });
  }
  return out;
}

/** Tree mixes by position in a wood: heart, shoulder, edge. Scales are relative to the wood's own scale. */
const WOODS: Record<WoodsDef['kind'], { heart: Weighted; shoulder: Weighted; edge: Weighted }> = {
  mixed: {
    heart: [['dense-forest', 4], ['forest-grove', 4], ['sparse-woodland', 2], ['pine', 2]],
    shoulder: [['forest-grove', 3], ['sparse-woodland', 3], ['deciduous-small', 3], ['maple', 1.5], ['pine', 1.5]],
    edge: [['deciduous-small', 3], ['shrubs', 4], ['undergrowth', 2], ['maple', 1]],
  },
  broadleaf: {
    heart: [['sparse-woodland', 4], ['forest-grove', 3], ['dense-forest', 2], ['maple', 1]],
    shoulder: [['sparse-woodland', 3], ['deciduous-small', 4], ['maple', 2], ['willow', 0.6]],
    edge: [['deciduous-small', 3], ['shrubs', 4], ['undergrowth', 2], ['flower-meadow', 1]],
  },
  pine: {
    heart: [['pine', 6], ['dense-forest', 2], ['forest-grove', 1]],
    shoulder: [['pine', 5], ['forest-grove', 1], ['mossy-boulder', 0.6]],
    edge: [['pine', 3], ['shrubs', 2], ['moss-grasses', 2], ['large-rock', 0.6]],
  },
};
const HEART_SCALE: [number, number] = [0.9, 1.15];
const SHOULDER_SCALE: [number, number] = [0.66, 0.9];
const EDGE_SCALE: [number, number] = [0.5, 0.78];

/** Buildings get a skirt of small plants, so they stand in the ground rather than on it. */
const BUILDINGS = new Set(['cottage', 'timber-cottage', 'farmhouse', 'watermill', 'shed', 'shrine', 'dock']);
/**
 * Upright plants with ragged edges that turn with the meadow. Flat mats of moss
 * are left out: against the yard's worn earth they read as pasted-on ovals.
 */
const SKIRT: Weighted = [['wildflowers', 4], ['shrubs', 2], ['small-rocks', 1]];

const STONES: Weighted = [['large-rock', 3], ['mossy-boulder', 3], ['cliff-decoration', 1.5]];
const PEBBLES: Weighted = [['small-rocks', 4], ['river-stones', 2], ['moss-grasses', 2]];

function weighted(rng: Rng, assets: Weighted): string {
  const total = assets.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [id, w] of assets) {
    r -= w;
    if (r <= 0) return id;
  }
  return assets[assets.length - 1]![0];
}

const between = (rng: Rng, range: readonly [number, number]): number => range[0] + (range[1] - range[0]) * rng();

/**
 * How deep inside a wood a point lies: 0 at the edge, 1 in the heart, negative
 * outside. Slow noise bends the outline so no wood has a round edge.
 */
export function woodDepth(woods: WoodsDef, x: number, y: number, seed: number): number {
  let depth = -1;
  for (const b of woods.blobs) depth = Math.max(depth, 1 - Math.hypot(x - b.x, y - b.y) / b.r);
  return depth + (valueNoise(x / 150, y / 150, seed) - 0.5) * 0.34 + (valueNoise(x / 46, y / 46, seed + 3) - 0.5) * 0.1;
}

export function layoutScenery(board: BoardDef, river: River): SceneryItem[] {
  const rng = mulberry32(board.seed);
  const items: SceneryItem[] = [];
  const cell = 96;
  const grid = new Map<string, Array<{ x: number; y: number; r: number }>>();

  const crowded = (x: number, y: number, r: number): boolean => {
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    const reach = Math.ceil((r + 90) / cell);
    for (let gx = cx - reach; gx <= cx + reach; gx++) {
      for (let gy = cy - reach; gy <= cy + reach; gy++) {
        for (const other of grid.get(`${gx},${gy}`) ?? []) {
          if (Math.hypot(other.x - x, other.y - y) < (other.r + r) * 0.82) return true;
        }
      }
    }
    return false;
  };
  const claim = (x: number, y: number, r: number): void => {
    const k = `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
    const list = grid.get(k);
    if (list) list.push({ x, y, r });
    else grid.set(k, [{ x, y, r }]);
  };
  const add = (asset: string, x: number, y: number, scale: number, room: number): void => {
    items.push({ asset, x, y, scale, flip: rng() < 0.5, roll: rng() });
    claim(x, y, room);
  };

  /** Settlements, terraces and fords stay open so they read clearly and remain easy to touch. */
  const reserved = (x: number, y: number): boolean =>
    board.places.some((p) => CLEARINGS.includes(p.kind) && Math.hypot(p.x - x, p.y - y) < p.radius * 0.85) ||
    board.fords.some((f) => Math.hypot(f.x - x, f.y - y) < f.radius + 40);
  // Lanes and yards stay clear: nothing grows on trodden ground. (Furrows are narrow and are left alone.)
  const roads = board.lanes
    .filter((lane) => (lane.width ?? 44) > 14)
    .map((lane) => {
      const xs = lane.points.map((p) => p.x);
      const ys = lane.points.map((p) => p.y);
      const box = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
      return { half: (lane.width ?? 44) / 2, line: new Polyline(lane.points), box };
    });
  /** True if a thing reaching `margin` from (x, y) would stand on a lane. */
  const onLane = (x: number, y: number, margin: number): boolean =>
    roads.some((road) => {
      const reach = road.half + margin;
      if (x < road.box.left - reach || x > road.box.right + reach || y < road.box.top - reach || y > road.box.bottom + reach) return false;
      return road.line.nearest({ x, y }).d < reach;
    });
  // Old river beds are kept clear as well, so nothing is drowned when the player lets the water back in.
  const inBounds = (x: number, y: number): boolean =>
    x > -APRON.left && x < board.width + APRON.right && y > -250 && y < (board.sea ? board.sea.y - 60 : board.height + APRON.bottom) && river.bedDistance({ x, y }) > 46;

  // Authored pieces first: they are the composition's fixed points and everything else works around them.
  for (const sprite of board.sprites) {
    // Placed sheep are drawn by the wildlife, so they can graze and wander.
    if (/^sheep-\d$/.test(sprite.asset)) continue;
    items.push({ asset: sprite.asset, x: sprite.x, y: sprite.y, scale: sprite.scale ?? 1, flip: sprite.flip ?? false, roll: rng(), fixed: true });
    claim(sprite.x, sprite.y, 44);
    if (!BUILDINGS.has(sprite.asset)) continue;
    // A few low plants at the foot of the walls, in front (so they overlap the base) and at the corners.
    const reach = 46 * (sprite.scale ?? 1);
    for (const [dx, dy] of [[-1.5, 0.05], [-0.7, 0.2], [0.5, 0.22], [1.45, 0.08]] as const) {
      const x = sprite.x + dx * reach + (rng() - 0.5) * 12;
      const y = sprite.y + dy * reach + 4 + rng() * 6;
      if (river.edgeDistance({ x, y }) < 8 || onLane(x, y, 2)) continue;
      items.push({ asset: weighted(rng, SKIRT), x, y, scale: 0.45 + rng() * 0.3, flip: rng() < 0.5, roll: rng() });
    }
  }

  board.outcrops.forEach((outcrop) => layoutOutcrop(outcrop));
  board.woods.forEach((woods, index) => layoutWoods(woods, board.seed + index * 101));

  for (const rule of board.scatter) {
    const areas = rule.blobs.map((b) => b.r * b.r);
    const totalArea = areas.reduce((a, b) => a + b, 0);
    let placed = 0;
    for (let attempt = 0; attempt < rule.count * 40 && placed < rule.count; attempt++) {
      let pickArea = rng() * totalArea;
      let blob = rule.blobs[0]!;
      for (let i = 0; i < rule.blobs.length; i++) {
        pickArea -= areas[i]!;
        if (pickArea <= 0) {
          blob = rule.blobs[i]!;
          break;
        }
      }
      const angle = rng() * Math.PI * 2;
      const radius = Math.sqrt(rng()) * blob.r;
      const x = blob.x + Math.cos(angle) * radius;
      const y = blob.y + Math.sin(angle) * radius;
      const asset = weighted(rng, rule.assets);
      const scale = between(rng, rule.scale);
      if (!inBounds(x, y) || river.edgeDistance({ x, y }) < 30 || reserved(x, y) || onLane(x, y, 8) || crowded(x, y, rule.spacing / 2)) continue;
      add(asset, x, y, scale, rule.spacing / 2);
      placed++;
    }
  }

  for (const rule of board.banks) {
    const channel = river.channels.find((c) => c.id === rule.channel);
    if (!channel) continue;
    const [from, to] = rule.span ?? [0, 1];
    const line = channel.line;
    let side = 1;
    for (let d = line.length * from + rng() * rule.every; d < line.length * to; d += rule.every * (0.6 + rng() * 0.8)) {
      const p = line.at(d);
      const half = channel.widths[line.nearest(p).segment]! / 2;
      const offset = half + between(rng, rule.offset);
      side = -side;
      const x = p.x - Math.sin(p.angle) * offset * side;
      const y = p.y + Math.cos(p.angle) * offset * side;
      const asset = weighted(rng, rule.assets);
      const scale = between(rng, rule.scale) * (p.y < 140 ? 0.48 : 1);
      const room = rule.spacing ?? 26;
      if (!inBounds(x, y) || y < -120 || y > board.height + APRON.bottom - 40) continue;
      if (river.edgeDistance({ x, y }) < rule.offset[0] - 3 || reserved(x, y) || onLane(x, y, 4) || crowded(x, y, room)) continue;
      // A wide clump of reeds by a ford would hide its stones: keep a bigger berth there.
      if (board.fords.some((f) => Math.hypot(f.x - x, f.y - y) < f.radius + 40 + scale * 70)) continue;
      add(asset, x, y, scale, room);
    }
  }
  return items;

  /** A few large stones set close together, with smaller ones gathered round them. */
  function layoutOutcrop(outcrop: OutcropDef): void {
    const big = Math.max(1, Math.round(outcrop.size * 0.4));
    for (let i = 0; i < outcrop.size; i++) {
      const large = i < big;
      const angle = rng() * Math.PI * 2;
      const reach = (large ? 0.45 : 1) * outcrop.spread * Math.sqrt(rng());
      const x = outcrop.x + Math.cos(angle) * reach;
      // Groups spread wider than they are deep: the valley is seen at a slant.
      const y = outcrop.y + Math.sin(angle) * reach * 0.6;
      if (river.edgeDistance({ x, y }) < 6 || onLane(x, y, large ? 14 : 4)) continue;
      add(weighted(rng, large ? STONES : PEBBLES), x, y, large ? 0.75 + rng() * 0.45 : 0.5 + rng() * 0.4, large ? 30 : 14);
    }
  }

  function layoutWoods(woods: WoodsDef, seed: number): void {
    const mix = WOODS[woods.kind];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const b of woods.blobs) {
      minX = Math.min(minX, b.x - b.r * 1.2);
      maxX = Math.max(maxX, b.x + b.r * 1.2);
      minY = Math.min(minY, b.y - b.r * 1.2);
      maxY = Math.max(maxY, b.y + b.r * 1.2);
    }
    // Enough tries to fill the wood: rejection by spacing does the rest.
    const attempts = Math.ceil(((maxX - minX) * (maxY - minY)) / (woods.spacing * woods.spacing)) * 5;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const x = minX + rng() * (maxX - minX);
      const y = minY + rng() * (maxY - minY);
      const pick = rng();
      const size = rng();
      if (!inBounds(x, y)) continue;
      const depth = woodDepth(woods, x, y, seed);
      if (depth < 0.02) continue;
      const tier = depth > 0.34 ? 'heart' : depth > 0.15 ? 'shoulder' : 'edge';
      const range = tier === 'heart' ? HEART_SCALE : tier === 'shoulder' ? SHOULDER_SCALE : EDGE_SCALE;
      const room = (woods.spacing * (tier === 'heart' ? 1 : tier === 'shoulder' ? 0.84 : 0.62)) / 2;
      if (river.edgeDistance({ x, y }) < 34 || reserved(x, y) || onLane(x, y, room * 0.55) || crowded(x, y, room)) continue;
      const palette = mix[tier];
      let choice = palette[palette.length - 1]![0];
      let r = pick * palette.reduce((sum, [, w]) => sum + w, 0);
      for (const [id, w] of palette) {
        r -= w;
        if (r <= 0) {
          choice = id;
          break;
        }
      }
      items.push({ asset: choice, x, y, scale: (range[0] + (range[1] - range[0]) * size) * woods.scale, flip: rng() < 0.5, roll: rng() });
      claim(x, y, room);
    }
  }
}

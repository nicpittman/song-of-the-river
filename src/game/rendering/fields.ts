/**
 * Field maps: low-resolution data textures that tell the ground shader what
 * is where. They are baked on the CPU from the board description, so the
 * landscape is drawn from the same data the simulation reasons about.
 *
 *   terrainA  R woodland   G wetland    B rocky
 *   terrainB  R orchard    G altitude   B scree
 *   water     R signed distance to the bank   G,B flow direction
 *   relief    R light and shadow   G terrace level   (see bakeRelief)
 *   paths     R footpath   G woodland corridor   B animal track   (canvas, redrawn on edits)
 */

import { hash2, valueNoise } from '../core/rng';
import type { Connection } from '../world/connections';
import type { River } from '../world/river';
import { APRON, type SceneryItem, woodDepth } from '../world/scenery';
import { altitude } from '../world/terrain';
import type { Vec } from '../core/math';
import type { BoardDef, GroundMaterial, LaneDef } from '../world/types';

export interface Extent {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const extentOf = (board: BoardDef): Extent => ({
  x: -APRON.left,
  y: -APRON.top,
  width: board.width + APRON.left + APRON.right,
  height: board.height + APRON.top + APRON.bottom,
});

export interface DataMap {
  data: Uint8Array;
  width: number;
  height: number;
}

/** World pixels per texel. */
export const TERRAIN_STEP = 8;
export const WATER_STEP = 4;
export const PATH_STEP = 3;
/** A long valley paints its routes a little coarser, so redrawing them stays quick. */
export const pathStep = (extent: Extent): number => (extent.height > 5200 ? 4 : PATH_STEP);
/** The water map stores distances within ± this many world pixels of the bank. */
export const WATER_RANGE = 64;
/** Altitude is stored as `altitude / ALTITUDE_SCALE` to fit 0..1. */
export const ALTITUDE_SCALE = 1.6;

const CHANNEL: Record<GroundMaterial, number> = { woodland: 0, wetland: 1, rocky: 2, orchard: 4, scree: 6 };

export function bakeTerrain(board: BoardDef, extent: Extent): { a: DataMap; b: DataMap } {
  const width = Math.ceil(extent.width / TERRAIN_STEP);
  const height = Math.ceil(extent.height / TERRAIN_STEP);
  const maps = [new Uint8Array(width * height * 4), new Uint8Array(width * height * 4)];
  const weight = new Float32Array(width * height * 8);

  for (const patch of board.patches) {
    const channel = CHANNEL[patch.material];
    for (const blob of patch.blobs) {
      const x0 = Math.max(0, Math.floor((blob.x - blob.r - extent.x) / TERRAIN_STEP));
      const x1 = Math.min(width - 1, Math.ceil((blob.x + blob.r - extent.x) / TERRAIN_STEP));
      const y0 = Math.max(0, Math.floor((blob.y - blob.r - extent.y) / TERRAIN_STEP));
      const y1 = Math.min(height - 1, Math.ceil((blob.y + blob.r - extent.y) / TERRAIN_STEP));
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const dx = extent.x + (tx + 0.5) * TERRAIN_STEP - blob.x;
          const dy = extent.y + (ty + 0.5) * TERRAIN_STEP - blob.y;
          const d = Math.hypot(dx, dy) / blob.r;
          if (d >= 1) continue;
          // A gentle dome rather than a disc: the shader thresholds it against
          // noise, so the patch gets an irregular, organic outline.
          const falloff = 1 - d * d;
          const i = (ty * width + tx) * 8 + channel;
          weight[i] = Math.min(1, weight[i]! + falloff * 0.9);
        }
      }
    }
  }

  // Woodland floor follows the woods themselves, so the trees and the ground under them share one outline.
  board.woods.forEach((woods, index) => {
    for (const blob of woods.blobs) {
      const reach = blob.r * 1.25;
      const x0 = Math.max(0, Math.floor((blob.x - reach - extent.x) / TERRAIN_STEP));
      const x1 = Math.min(width - 1, Math.ceil((blob.x + reach - extent.x) / TERRAIN_STEP));
      const y0 = Math.max(0, Math.floor((blob.y - reach - extent.y) / TERRAIN_STEP));
      const y1 = Math.min(height - 1, Math.ceil((blob.y + reach - extent.y) / TERRAIN_STEP));
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const depth = woodDepth(woods, extent.x + (tx + 0.5) * TERRAIN_STEP, extent.y + (ty + 0.5) * TERRAIN_STEP, board.seed + index * 101);
          const i = (ty * width + tx) * 8;
          weight[i] = Math.max(weight[i]!, Math.min(1, Math.max(0, (depth + 0.1) * 3.4)));
        }
      }
    }
  });

  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const i = ty * width + tx;
      const wx = extent.x + (tx + 0.5) * TERRAIN_STEP;
      const wy = extent.y + (ty + 0.5) * TERRAIN_STEP;
      for (let c = 0; c < 3; c++) maps[0]![i * 4 + c] = weight[i * 8 + c]! * 255;
      maps[0]![i * 4 + 3] = 255;
      maps[1]![i * 4] = weight[i * 8 + 4]! * 255;
      maps[1]![i * 4 + 1] = Math.min(255, Math.max(0, (altitude(board, wx, wy) / ALTITUDE_SCALE) * 255));
      maps[1]![i * 4 + 2] = weight[i * 8 + 6]! * 255;
      maps[1]![i * 4 + 3] = 255;
    }
  }
  return { a: { data: maps[0]!, width, height }, b: { data: maps[1]!, width, height } };
}

/**
 * The river as a distance field. Besides the channels themselves it carries
 * the islands that stand in the water and how shallow each stretch is, so
 * pools, bars and fords can all be drawn by the one water shader.
 *
 *   R  signed distance to the bank (0.5 = waterline, lower = further into the water)
 *   G,B  direction of flow
 *   A  depth factor: 1 for ordinary water, toward 0 over shallows and fords
 */
export function bakeWater(river: River, board: BoardDef, extent: Extent): DataMap {
  const width = Math.ceil(extent.width / WATER_STEP);
  const height = Math.ceil(extent.height / WATER_STEP);
  const data = new Uint8Array(width * height * 4);
  const best = new Float32Array(width * height).fill(WATER_RANGE);
  for (let i = 0; i < width * height; i++) {
    data[i * 4 + 1] = 128;
    data[i * 4 + 2] = 255; // default flow: straight down the valley
    data[i * 4 + 3] = 255;
  }

  for (const channel of river.channels) {
    const pts = channel.line.points;
    for (let s = 0; s < pts.length - 1; s++) {
      const a = pts[s]!;
      const b = pts[s + 1]!;
      const ha = channel.widths[s]! / 2;
      const hb = channel.widths[s + 1]! / 2;
      const reach = Math.max(ha, hb) + WATER_RANGE;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy || 1;
      const len = Math.sqrt(len2);
      const fx = Math.round((dx / len) * 127 + 128);
      const fy = Math.round((dy / len) * 127 + 128);
      const x0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - reach - extent.x) / WATER_STEP));
      const x1 = Math.min(width - 1, Math.ceil((Math.max(a.x, b.x) + reach - extent.x) / WATER_STEP));
      const y0 = Math.max(0, Math.floor((Math.min(a.y, b.y) - reach - extent.y) / WATER_STEP));
      const y1 = Math.min(height - 1, Math.ceil((Math.max(a.y, b.y) + reach - extent.y) / WATER_STEP));
      for (let ty = y0; ty <= y1; ty++) {
        const wy = extent.y + (ty + 0.5) * WATER_STEP;
        for (let tx = x0; tx <= x1; tx++) {
          const wx = extent.x + (tx + 0.5) * WATER_STEP;
          const t = Math.min(1, Math.max(0, ((wx - a.x) * dx + (wy - a.y) * dy) / len2));
          const sd = Math.hypot(wx - (a.x + dx * t), wy - (a.y + dy * t)) - (ha + (hb - ha) * t);
          const i = ty * width + tx;
          if (sd >= best[i]!) continue;
          best[i] = sd;
          data[i * 4 + 1] = fx;
          data[i * 4 + 2] = fy;
        }
      }
    }
  }

  const each = (blob: { x: number; y: number }, reach: number, visit: (i: number, d: number) => void): void => {
    const x0 = Math.max(0, Math.floor((blob.x - reach - extent.x) / WATER_STEP));
    const x1 = Math.min(width - 1, Math.ceil((blob.x + reach - extent.x) / WATER_STEP));
    const y0 = Math.max(0, Math.floor((blob.y - reach - extent.y) / WATER_STEP));
    const y1 = Math.min(height - 1, Math.ceil((blob.y + reach - extent.y) / WATER_STEP));
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        visit(ty * width + tx, Math.hypot(extent.x + (tx + 0.5) * WATER_STEP - blob.x, extent.y + (ty + 0.5) * WATER_STEP - blob.y));
      }
    }
  };
  // Below the shoreline everything is water. The line wanders, so the coast has bays and points.
  if (board.sea) {
    for (let ty = 0; ty < height; ty++) {
      const wy = extent.y + (ty + 0.5) * WATER_STEP;
      if (wy < board.sea.y - 140) continue;
      for (let tx = 0; tx < width; tx++) {
        const wx = extent.x + (tx + 0.5) * WATER_STEP;
        const shore = board.sea.y + 70 * (valueNoise(wx / 380, 3, board.seed) - 0.5) + 26 * (valueNoise(wx / 90, 7, board.seed) - 0.5);
        const i = ty * width + tx;
        const sd = Math.max(-WATER_RANGE, shore - wy);
        if (sd >= best[i]!) continue;
        best[i] = sd;
        // The sea has no current of its own: one gentle drift everywhere, so the water texture does not band.
        data[i * 4 + 1] = 150;
        data[i * 4 + 2] = 150;
      }
    }
  }
  // An island is land inside the water: wherever it stands, the bank is the island's own shore.
  for (const island of board.islands) each(island, island.r + WATER_RANGE, (i, d) => (best[i] = Math.max(best[i]!, island.r - d)));
  for (const shallow of [...board.shallows, ...board.fords.map((f) => ({ x: f.x, y: f.y, r: f.radius * 1.5 }))]) {
    each(shallow, shallow.r, (i, d) => {
      const s = 1 - d / shallow.r;
      if (s > 0) data[i * 4 + 3] = Math.min(data[i * 4 + 3]!, 255 * (1 - 0.85 * Math.min(1, s * 2)));
    });
  }
  for (let i = 0; i < width * height; i++) data[i * 4] = Math.max(0, Math.min(255, (0.5 + best[i]! / (2 * WATER_RANGE)) * 255));
  return { data, width, height };
}

/**
 * Water meadows: where the river spreads when it is high. Written into the
 * spare channels of the canopy map (G for the spring melt, B for the autumn
 * rains) as how low the ground lies, so the shader can let the flood creep out
 * from the middle of a meadow and draw back again as the year turns. A meadow
 * relieved by an opened channel is left out: it stays dry.
 */
export function bakePlains(board: BoardDef, river: River, extent: Extent, into: DataMap): void {
  const { data, width, height } = into;
  for (let i = 0; i < width * height; i++) data[i * 4 + 1] = data[i * 4 + 2] = 0;
  for (const plain of board.floodplains ?? []) {
    if (plain.relievedBy?.some((id) => river.channels.some((c) => c.id === id))) continue;
    const channels = [...(plain.floods.includes(0) ? [1] : []), ...(plain.floods.includes(2) ? [2] : [])];
    for (const blob of plain.blobs) {
      const x0 = Math.max(0, Math.floor((blob.x - blob.r - extent.x) / TERRAIN_STEP));
      const x1 = Math.min(width - 1, Math.ceil((blob.x + blob.r - extent.x) / TERRAIN_STEP));
      const y0 = Math.max(0, Math.floor((blob.y - blob.r - extent.y) / TERRAIN_STEP));
      const y1 = Math.min(height - 1, Math.ceil((blob.y + blob.r - extent.y) / TERRAIN_STEP));
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const d = Math.hypot(extent.x + (tx + 0.5) * TERRAIN_STEP - blob.x, extent.y + (ty + 0.5) * TERRAIN_STEP - blob.y) / blob.r;
          if (d >= 1) continue;
          const i = (ty * width + tx) * 4;
          for (const c of channels) data[i + c] = Math.max(data[i + c]!, (1 - d * d) * 255);
        }
      }
    }
  }
}

/**
 * Where trees and buildings stand. The ground shader darkens the land beneath
 * them and lets less snow settle there, which is what seats a sprite in the
 * landscape instead of on top of it.
 */
export function bakeCanopy(items: readonly SceneryItem[], footprint: (item: SceneryItem) => number, extent: Extent): DataMap {
  const width = Math.ceil(extent.width / TERRAIN_STEP);
  const height = Math.ceil(extent.height / TERRAIN_STEP);
  const cover = new Float32Array(width * height);
  for (const item of items) {
    const r = footprint(item);
    if (r <= 0) continue;
    const cx = item.x + r * 0.12;
    const cy = item.y - r * 0.1;
    const x0 = Math.max(0, Math.floor((cx - r - extent.x) / TERRAIN_STEP));
    const x1 = Math.min(width - 1, Math.ceil((cx + r - extent.x) / TERRAIN_STEP));
    const y0 = Math.max(0, Math.floor((cy - r * 0.7 - extent.y) / TERRAIN_STEP));
    const y1 = Math.min(height - 1, Math.ceil((cy + r * 0.7 - extent.y) / TERRAIN_STEP));
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const dx = (extent.x + (tx + 0.5) * TERRAIN_STEP - cx) / r;
        const dy = (extent.y + (ty + 0.5) * TERRAIN_STEP - cy) / (r * 0.7);
        const d2 = dx * dx + dy * dy;
        if (d2 < 1) cover[ty * width + tx] = Math.min(1, cover[ty * width + tx]! + (1 - d2) * 0.8);
      }
    }
  }
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = cover[i]! * 255;
    data[i * 4 + 3] = 255;
  }
  return { data, width, height };
}

/** Height of one terrace, in the same loose units as hill heights. */
const TERRACE = 0.052;

/**
 * Bakes the lie of the land into light and shadow.
 *
 * The valley is drawn from above, so height cannot be shown by silhouette.
 * Two kinds of shading stand in for it. Slopes are lit from the upper left,
 * so every hill has a bright flank and a dim one. On top of that the land is
 * treated like layered paper: height is stepped into a few broad terraces
 * whose edges follow the contours, each edge catching light on its sunward
 * side and throwing a soft shadow on the other. The river sits in its own cut.
 *
 * Shading is computed here in floating point and stored, rather than derived
 * in the shader from an 8-bit height map, which would band.
 */
export function bakeRelief(board: BoardDef, water: DataMap, extent: Extent): DataMap {
  const step = WATER_STEP;
  const width = Math.ceil(extent.width / step);
  const height = Math.ceil(extent.height / step);
  const smooth = new Float32Array(width * height);
  const stepped = new Float32Array(width * height);
  const forms = [...board.hills, ...board.relief];
  // Each form only reaches two radii out (beyond that its contribution is dropped), and a gorge
  // only matters at the water's edge: gather per row the few that can touch it, instead of
  // testing all of them at every texel.
  const reach = forms.map((f) => ({ f, r: f.r * 2, r2: f.r * f.r }));
  const gorges = board.zones.flatMap((z) => z.blobs.map((b) => ({ x: b.x, y: b.y, r: b.r * 1.3 })));
  const rowForms: typeof reach = [];
  const rowGorges: typeof gorges = [];

  for (let ty = 0; ty < height; ty++) {
    const wy = extent.y + (ty + 0.5) * step;
    rowForms.length = 0;
    for (const form of reach) if (Math.abs(wy - form.f.y) < form.r) rowForms.push(form);
    rowGorges.length = 0;
    for (const g of gorges) if (Math.abs(wy - g.y) < g.r) rowGorges.push(g);
    for (let tx = 0; tx < width; tx++) {
      const wx = extent.x + (tx + 0.5) * step;
      let h = 0;
      for (const { f: hill, r, r2 } of rowForms) {
        if (Math.abs(wx - hill.x) >= r) continue;
        const d2 = ((wx - hill.x) ** 2 + (wy - hill.y) ** 2) / r2;
        if (d2 < 4) h += hill.h * Math.exp(-d2 * 1.6);
      }
      // Rolling ground, and contour lines that wander rather than tracing perfect ovals.
      h += 0.05 * (valueNoise(wx / 520, wy / 520, board.seed) - 0.5) + 0.016 * (valueNoise(wx / 170, wy / 170, board.seed + 1) - 0.5);
      const q = h / TERRACE;
      const f = q - Math.floor(q);
      // Flat treads with a short riser between them.
      const riser = Math.min(1, Math.max(0, (f - 0.7) / 0.3));
      const i = ty * width + tx;
      stepped[i] = Math.floor(q) + riser * riser * (3 - 2 * riser);
      // The river runs in a cut below its banks (a smooth dip, not another terrace).
      const sd = (water.data[i * 4]! / 255 - 0.5) * 2 * WATER_RANGE;
      const cut = 1 - Math.min(1, Math.max(0, sd / 56));
      if (cut <= 0) {
        smooth[i] = h;
        continue;
      }
      // Banks are gentle everywhere except where the river has cut a gorge.
      let gorge = 0;
      for (const b of rowGorges) gorge = Math.max(gorge, 1 - Math.hypot(wx - b.x, wy - b.y) / b.r);
      smooth[i] = h - (0.022 + 0.1 * Math.min(1, Math.max(0, gorge * 2.5))) * cut * cut;
    }
  }

  const data = new Uint8Array(width * height * 4);
  const index = (x: number, y: number): number => Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x));
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const i = ty * width + tx;
      const here = stepped[i]!;
      const at = (d: number): number => stepped[index(tx - d, ty - d)]!;
      // Ground that stands between this spot and the light shades it; the nearer and taller, the darker.
      const cast = Math.max(at(3) - here, (at(7) - here) * 0.8, (at(12) - here) * 0.55);
      // A lip of light where the land drops away toward the sun.
      const lip = here - at(3);
      // Broad hill shading from the slope of the untreaded land.
      const slope = (smooth[index(tx + 4, ty + 4)]! - smooth[index(tx - 4, ty - 4)]!) / (8 * step * Math.SQRT2);
      const flank = Math.max(-1, Math.min(1, slope * 2600));
      const shade = 0.5 - 0.4 * Math.min(1, Math.max(0, cast)) + 0.3 * Math.min(1, Math.max(0, lip)) + 0.24 * flank;
      data[i * 4] = Math.min(255, Math.max(0, shade * 255));
      data[i * 4 + 1] = Math.min(255, Math.max(0, (here * TERRACE) / 0.34) * 255);
      data[i * 4 + 3] = 255;
    }
  }
  return { data, width, height };
}

/** Tileable RGB value noise; three independent channels at different grain. */
export function bakeNoise(size = 256): DataMap {
  const data = new Uint8Array(size * size * 4);
  const octave = (x: number, y: number, period: number, seed: number): number => {
    const fx = (x / size) * period;
    const fy = (y / size) * period;
    const xi = Math.floor(fx);
    const yi = Math.floor(fy);
    const tx = fx - xi;
    const ty = fy - yi;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const at = (ix: number, iy: number): number => hash2(((ix % period) + period) % period, ((iy % period) + period) % period, seed);
    const top = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
    const bottom = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
    return top + (bottom - top) * sy;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) {
        const v = 0.5 * octave(x, y, 4, c * 31 + 1) + 0.3 * octave(x, y, 8, c * 31 + 2) + 0.14 * octave(x, y, 16, c * 31 + 3) + 0.06 * octave(x, y, 32, c * 31 + 4);
        data[i + c] = v * 255;
      }
      data[i + 3] = 255;
    }
  }
  return { data, width: size, height: size };
}

/**
 * Paints the player's connections into the path map. The shader erodes the
 * soft edges with noise, so a route reads as worn ground rather than a stroke.
 */
export function paintPaths(canvas: HTMLCanvasElement, extent: Extent, connections: readonly Connection[], lanes: readonly LaneDef[] = [], beds: readonly LaneDef[] = []): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const step = pathStep(extent);
  ctx.setTransform(1 / step, 0, 0, 1 / step, -extent.x / step, -extent.y / step);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const strokePoints = (points: readonly Vec[], colour: string, width: number): void => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  };
  const stroke = (connection: Connection, colour: string, width: number): void => strokePoints(connection.line.points, colour, width);
  // Village lanes and yards: worn ground that is scenery rather than a route.
  // Old river beds go into red and blue together, which the shader reads as gravel.
  for (const bed of beds) for (let i = 0; i < 4; i++) strokePoints(smoothLane(bed.points), 'rgb(60,0,60)', (bed.width ?? 60) * (1 - i * 0.14));
  for (const lane of lanes) {
    const width = lane.width ?? 44;
    const wear = Math.min(1, Math.max(0, lane.wear ?? 1));
    if (lane.ruts) {
      // Two narrow wheel tracks, with grass between them; navigation keeps the full lane.
      for (const side of [-1, 1]) {
        const points = lane.points.map((point, index) => {
          const before = lane.points[Math.max(0, index - 1)]!, after = lane.points[Math.min(lane.points.length - 1, index + 1)]!;
          const length = Math.hypot(after.x - before.x, after.y - before.y) || 1;
          return { x: point.x - (after.y - before.y) / length * side * width * .24, y: point.y + (after.x - before.x) / length * side * width * .24 };
        });
        const rut=smoothLane(points);
        // A narrow core survives the long valley’s coarser route texture; soft shoulders remain overgrown.
        strokePoints(rut, `rgb(${Math.round(70 * wear)},0,0)`, 14);
        strokePoints(rut, `rgb(${Math.round(155 * wear)},0,0)`, 8);
      }
      continue;
    }
    // Broad lanes get soft shoulders; furrows are drawn as crisp narrow lines.
    const steps = width > 20 ? 5 : 2;
    for (let i = 0; i < steps; i++) strokePoints(smoothLane(lane.points), `rgb(${Math.round(230 * wear / steps)},0,0)`, width * (1 - i * 0.15));
  }
  /** Nested strokes that add up to a soft-shouldered ridge `width` wide, peaking at `peak` (0..255). */
  const ridge = (connection: Connection, channel: 0 | 1 | 2, width: number, peak: number, steps = 6): void => {
    const level = Math.round(peak / steps);
    const rgb = [0, 0, 0];
    rgb[channel] = level;
    for (let i = 0; i < steps; i++) stroke(connection, `rgb(${rgb.join(',')})`, width * (1 - (i / steps) * 0.78));
  };

  for (const connection of connections) {
    if (connection.type === 'path') {
      ridge(connection, 0, 40, 255);
    } else {
      // A broad band of undergrowth with a narrow animal track down the middle.
      ridge(connection, 1, 120, 250);
      ridge(connection, 2, 16, 255, 3);
    }
  }
}

/** Lanes are authored as a few points; round them off so yards do not have corners. */
function smoothLane(points: readonly Vec[]): Vec[] {
  if (points.length < 3) return [...points];
  const out: Vec[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const c = points[i + 1]!;
    for (let t = 0.25; t <= 0.76; t += 0.25) {
      const u = 1 - t;
      out.push({ x: u * u * ((a.x + b.x) / 2) + 2 * u * t * b.x + t * t * ((b.x + c.x) / 2), y: u * u * ((a.y + b.y) / 2) + 2 * u * t * b.y + t * t * ((b.y + c.y) / 2) });
    }
  }
  out.push(points[points.length - 1]!);
  return out;
}

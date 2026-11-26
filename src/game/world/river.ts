/**
 * River geometry. Channels are authored as centreline control points with a
 * width at each; this module smooths them and answers the spatial questions
 * the rest of the game asks: is this point in the water, where does this route
 * cross, how wide is the river there.
 *
 * There is no fluid simulation. Seasonal change is a single offset applied to
 * every channel's half-width (see `WATER_OFFSET`).
 */

import { type Vec, dist, lerp, segmentIntersection } from '../core/math';
import { Polyline, smoothCurve } from './geometry';
import { RiverIndex } from './riverIndex';
import type { BoardDef, ChannelDef, Season } from './types';

/** World pixels added to each bank per season: spring melt swells the river, summer draws it down. */
export const WATER_OFFSET: Record<Season, number> = { 0: 24, 1: -12, 2: 3, 3: -5 };

export interface Channel {
  id: string;
  line: Polyline;
  /** Full width at each point of `line`. */
  widths: number[];
  def: ChannelDef;
}

export interface RiverHit {
  channel: Channel;
  /** Distance from the centreline. */
  d: number;
  /** Half the channel width at the closest point. */
  half: number;
  along: number;
  point: Vec;
}

export interface RiverCrossing extends Vec {
  channel: Channel;
  /** Index of the route segment that crosses. */
  segment: number;
  /** Distance along the route. */
  along: number;
  /** River width at the crossing. */
  width: number;
  /** Direction of the river at the crossing, radians. */
  flow: number;
}

const SAMPLE_STEP = 14;

export class River {
  /** Channels that carry water now. Routes, fish and the water shader all read this. */
  channels: Channel[];
  /** Old beds the player has not opened. Dry land for every purpose but planting trees. */
  beds: Channel[];
  private readonly all: Channel[];
  private index: RiverIndex | null = null;

  constructor(board: BoardDef) {
    this.all = board.channels.map((def) => {
      const control = def.points.map(([x, y]) => ({ x, y }));
      const line = new Polyline(smoothCurve(control, SAMPLE_STEP));
      // Width follows the control points: interpolate by nearest control span.
      const controlLine = new Polyline(control);
      const widths = line.points.map((p) => {
        const hit = controlLine.nearest(p);
        const i = hit.segment;
        const span = controlLine.cumulative[i + 1]! - controlLine.cumulative[i]!;
        const t = span > 0 ? (hit.along - controlLine.cumulative[i]!) / span : 0;
        return lerp(def.points[i]![2], def.points[i + 1]![2], t);
      });
      return { id: def.id, line, widths, def };
    });
    this.channels = [];
    this.beds = [];
    this.setOpened([]);
  }

  /** Says which of the old beds the player has opened. */
  setOpened(ids: readonly string[]): void {
    const channels = this.all.filter((c) => !c.def.closed || ids.includes(c.id));
    if (this.index && channels.length === this.channels.length && channels.every((c,i) => c === this.channels[i])) return;
    this.channels = channels;
    this.index = new RiverIndex(channels);
    this.beds = this.all.filter((c) => c.def.closed && !ids.includes(c.id));
  }

  /** Distance from `p` to the nearest old bed's centreline, or Infinity if there is none. */
  bedDistance(p: Vec): number {
    let best = Infinity;
    for (const bed of this.beds) best = Math.min(best, bed.line.nearest(p).d - bed.widths[0]! / 2);
    return best;
  }

  /** Closest channel to `p`, measured to the water's edge rather than the centreline. */
  nearest(p: Vec): RiverHit {
    return this.index!.nearest(p)!;
  }

  /** Distance from `p` to the water's edge at normal level. Negative inside the water. */
  edgeDistance(p: Vec): number {
    const hit = this.nearest(p);
    return hit.d - hit.half;
  }

  /** Every place the polyline `route` crosses a channel centreline, in route order. */
  crossings(route: Polyline): RiverCrossing[] {
    const out: RiverCrossing[] = [];
    const pts = route.points;
    for (let s = 0; s < pts.length - 1; s++) {
      const a = pts[s]!;
      const b = pts[s + 1]!;
      for (const channel of this.channels) {
        const c = channel.line.points;
        for (let i = 0; i < c.length - 1; i++) {
          const hit = segmentIntersection(a, b, c[i]!, c[i + 1]!);
          if (!hit) continue;
          out.push({
            x: hit.x,
            y: hit.y,
            channel,
            segment: s,
            along: route.cumulative[s]! + dist(a, hit),
            width: lerp(channel.widths[i]!, channel.widths[i + 1]!, hit.u),
            flow: Math.atan2(c[i + 1]!.y - c[i]!.y, c[i + 1]!.x - c[i]!.x),
          });
        }
      }
    }
    out.sort((p, q) => p.along - q.along);
    // A route vertex lying exactly on the centreline touches two segments of each
    // polyline and would be reported up to four times; keep one hit per place.
    return out.filter((hit, i) => i === 0 || hit.channel !== out[i - 1]!.channel || hit.along - out[i - 1]!.along > 6);
  }
}

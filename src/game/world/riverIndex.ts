/** River-edge queries, pruning distant groups while preserving authored shoreline queries. */
import { lerp, pointSegment, type Vec } from '../core/math';
import type { Channel, RiverHit } from './river';

interface Bounds {
  x0: number; y0: number; x1: number; y1: number;
  half: number;
}
interface Segment extends Bounds {
  channel: Channel;
  index: number;
  order: number;
}
interface Branch extends Bounds {
  segments?: Segment[];
  left?: Branch;
  right?: Branch;
}

function branch(segments: Segment[]): Branch {
  const bounds: Bounds = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, half: 0 };
  for (const segment of segments) {
    bounds.x0 = Math.min(bounds.x0, segment.x0); bounds.x1 = Math.max(bounds.x1, segment.x1);
    bounds.y0 = Math.min(bounds.y0, segment.y0); bounds.y1 = Math.max(bounds.y1, segment.y1);
    bounds.half = Math.max(bounds.half, segment.half);
  }
  if (segments.length <= 8) return { ...bounds, segments };
  const horizontal = bounds.x1 - bounds.x0 > bounds.y1 - bounds.y0;
  segments.sort((a, b) => horizontal ? a.x0+a.x1-b.x0-b.x1 : a.y0+a.y1-b.y0-b.y1);
  const middle = segments.length >> 1;
  return { ...bounds, left: branch(segments.slice(0, middle)), right: branch(segments.slice(middle)) };
}

/** Lower bound on distance to any water edge in this box, including varying widths. */
function lowerBound(p: Vec, box: Bounds): number {
  return Math.hypot(Math.max(box.x0-p.x, 0, p.x-box.x1), Math.max(box.y0-p.y, 0, p.y-box.y1)) - box.half;
}

export class RiverIndex {
  private readonly parts: Array<{ tree: Branch } | { segment: Segment }> = [];

  constructor(channels: readonly Channel[]) {
    let segments: Segment[] = [];
    let order = 0;
    const flush = (): void => {
      if (segments.length) this.parts.push({ tree: branch(segments) });
      segments = [];
    };
    for (const channel of channels) for (let i = 0; i < channel.line.points.length-1; i++) {
      const a = channel.line.points[i]!, b = channel.line.points[i+1]!;
      const segment: Segment = { channel, index: i, order: order++,
        x0: Math.min(a.x,b.x), y0: Math.min(a.y,b.y), x1: Math.max(a.x,b.x), y1: Math.max(a.y,b.y),
        half: Math.max(channel.widths[i]!,channel.widths[i+1]!)/2 };
      // The original shoreline query has a 400px horizontal rejection. It
      // cannot discard a better hit when half-width + horizontal half-span
      // fits inside that margin. Index those runs exactly. Very wide estuary
      // segments retain their original evaluation order and rejection, so
      // existing shores and saved boat/dock sites do not move during this optimisation.
      if (segment.half + Math.abs(b.x-a.x)/2 <= 400) segments.push(segment);
      else { flush(); this.parts.push({segment}); }
    }
    flush();
  }

  nearest(p: Vec): RiverHit | null {
    let best: Segment | null = null;
    let edge = Infinity, distance = Infinity, position = 0, half = 0;
    const consider = (segment: Segment): void => {
      const { channel, index } = segment;
      const hit = pointSegment(p,channel.line.points[index]!,channel.line.points[index+1]!);
      const width = lerp(channel.widths[index]!,channel.widths[index+1]!,hit.t)/2;
      const next = hit.d-width;
      if (next < edge || next === edge && (!best || segment.order < best.order)) {
        best = segment; edge = next; distance = hit.d; position = hit.t; half = width;
      }
    };
    const visit = (node: Branch, bound: number): void => {
      if (bound > edge + 1e-9) return;
      if (node.segments) {
        for (const segment of node.segments) if (lowerBound(p,segment) <= edge + 1e-9) consider(segment);
        return;
      }
      const left = node.left!, right = node.right!;
      const l = lowerBound(p,left), r = lowerBound(p,right);
      if (l <= r) { visit(left,l); visit(right,r); }
      else { visit(right,r); visit(left,l); }
    };
    for (const part of this.parts) {
      if ('tree' in part) visit(part.tree,lowerBound(p,part.tree));
      else {
        const segment = part.segment, {channel,index} = segment;
        const reach = edge + 400;
        if (Math.abs(p.x-channel.line.points[index]!.x) > reach && Math.abs(p.x-channel.line.points[index+1]!.x) > reach) continue;
        consider(segment);
      }
    }
    const segment = best as Segment | null;
    if (!segment) return null;
    const { channel, index } = segment;
    const a = channel.line.points[index]!, b = channel.line.points[index+1]!;
    return { channel, d: distance, half, along: lerp(channel.line.cumulative[index]!,channel.line.cumulative[index+1]!,position),
      point: { x: lerp(a.x,b.x,position), y: lerp(a.y,b.y,position) } };
  }
}

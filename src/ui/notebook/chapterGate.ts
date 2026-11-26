import type { AdventureView } from '../../game/adventure/model';
import type { Vec } from '../../game/core/math';
/** A destination in the paper mist, on the same bank as the road onward. */
export function chapterGate(view: AdventureView): { id: string; name: string; at: Vec } | null {
  if (!view.canTravel) return null;
  const next = view.chart.regions[view.region + 1];
  if (!next) return null;
  const river = view.chart.channels[0] ?? [];
  const edge = river.reduce((best, p) => Math.abs(p.y - next.top) < Math.abs(best.y - next.top) ? p : best, river[0] ?? {x:view.chart.width*.5,y:next.top,half:120});
  return {id: next.id, name: next.name, at: {x: Math.max(130, edge.x + (view.region === 1 && view.course.way === 'high-path' ? 1 : -1) * ((edge.half ?? 100) + 180)), y: next.top + 150}};
}

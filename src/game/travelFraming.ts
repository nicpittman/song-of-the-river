import { clamp, type Vec } from './core/math';

/** A glimpse ahead, while the walking companions stay near the centre. */
export function travelFraming(group: Vec, landmarkX: number, mistY: number, width: number, height: number, zoom: number, narrow: boolean): Vec {
  return {
    x: group.x + clamp((landmarkX - group.x) * (narrow ? .62 : .45), -width / zoom * .16, width / zoom * .16),
    y: group.y + clamp(mistY - group.y, -height / zoom * .12, height / zoom * .18),
  };
}

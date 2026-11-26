/** Bank-to-bank placement, calibrated against the illustrated bridge's deck ends. */
import type { Vec } from '../core/math';
import type { Connection, Crossing } from '../world/connections';
import type { River } from '../world/river';
import { WATER_OFFSET } from '../world/river';

// Deck contacts, measured in the trimmed source image; rails and piles extend beyond them.
export const BRIDGE_DECK: readonly [Vec, Vec] = [{x:.08,y:.76},{x:.94,y:.52}];
export function bridgePlacement(connection: Pick<Connection, 'line'>, crossing: Crossing, river: River, width: number, height: number, deck: readonly [Vec,Vec] = BRIDGE_DECK) {
  const margin = Math.max(...Object.values(WATER_OFFSET)) + 12;
  const bank = (direction: number): Vec => {
    let p: Vec = crossing;
    for (let d = 4; d <= 900; d += 4) {
      p = connection.line.at(Math.max(0, Math.min(connection.line.length, crossing.along + d * direction)));
      if (river.edgeDistance(p) >= margin) break;
    }
    return {x:p.x,y:p.y};
  };
  let a=bank(-1),b=bank(1);
  if (b.x<a.x) [a,b]=[b,a];
  const dx=b.x-a.x,dy=b.y-a.y;
  const nativeX=(deck[1].x-deck[0].x)*width;
  const nativeY=(deck[1].y-deck[0].y)*height;
  return {
    x:(a.x+b.x)/2,y:(a.y+b.y)/2,
    scale:Math.hypot(dx,dy)/Math.hypot(nativeX,nativeY),
    rotation:Math.atan2(dy,dx)-Math.atan2(nativeY,nativeX),
    anchor:[(deck[0].x+deck[1].x)/2,(deck[0].y+deck[1].y)/2] as [number,number],
    banks:[a,b] as const,
  };
}

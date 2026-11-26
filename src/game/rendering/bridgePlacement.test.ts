import { describe,expect,it } from 'vitest';
import { bridgePlacement,BRIDGE_DECK } from './bridgePlacement';
import { River,WATER_OFFSET } from '../world/river';
import { Polyline } from '../world/geometry';
import { seseragi } from '../world/boards/seseragi';
import type { Connection } from '../world/connections';

describe('bridges span the drawn route between real banks',()=>{
 for(const angle of [0,Math.PI/3,-Math.PI/3,Math.PI/2])it(`grounds both deck ends at route angle ${angle}`,()=>{
  const river=new River({...seseragi,channels:[{id:'test',points:[[-1000,-600,160],[1000,600,160]]}]});
  // Cross the test channel at varying oblique angles, away from the endpoints.
  const dx=Math.cos(angle)*800,dy=Math.sin(angle)*800;
  const line=new Polyline([{x:-dx,y:-dy},{x:dx,y:dy}]);
  const hit=river.crossings(line)[0]!;
  const c={line} as Connection;
  const p=bridgePlacement(c,{...hit,angle,style:'bridge',ford:null},river,192,91);
  const halfX=(BRIDGE_DECK[1].x-BRIDGE_DECK[0].x)*192*p.scale/2;
  const halfY=(BRIDGE_DECK[1].y-BRIDGE_DECK[0].y)*91*p.scale/2;
  for(const sign of [-1,1]){
   const x=p.x+sign*(halfX*Math.cos(p.rotation)-halfY*Math.sin(p.rotation));
   const y=p.y+sign*(halfX*Math.sin(p.rotation)+halfY*Math.cos(p.rotation));
   expect(river.edgeDistance({x,y})).toBeGreaterThan(Math.max(...Object.values(WATER_OFFSET))+10);
   expect(line.nearest({x,y}).d).toBeLessThan(.001);
  }
 });
});

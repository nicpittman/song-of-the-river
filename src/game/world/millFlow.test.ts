import { expect,it } from 'vitest';
import { millWheelSpeed } from './millFlow';
import { River } from './river';
import { seseragi } from './boards/seseragi';
it('drives the wheel with actual seasonal water contact, stopping above or beside dry water',()=>{
 const river=new River({...seseragi,channels:[{id:'mill',points:[[0,-1000,100],[0,1000,100]],dry:[1]}]});
 expect(millWheelSpeed(river,{x:0,y:0},0)).toBeGreaterThan(0);
 expect(millWheelSpeed(river,{x:0,y:0},1)).toBe(0);
 expect(millWheelSpeed(river,{x:100,y:0},0)).toBe(0);
 expect(millWheelSpeed(river,{x:65,y:0},0)).toBeGreaterThan(0);
 expect(millWheelSpeed(river,{x:65,y:0},2)).toBe(0);
 expect(millWheelSpeed(river,{x:0,y:0},3)).toBeLessThan(millWheelSpeed(river,{x:0,y:0},0));
});
it('the authored village wheel reaches the summer river',()=>{
 const mill=seseragi.sprites.find(s=>s.asset==='watermill')!;
 const scale=(mill.scale??1)*288/230;
 const paddle={x:mill.x+67*scale,y:mill.y+(-41+80*.5)*scale};
 expect(millWheelSpeed(new River(seseragi),paddle,1)).toBeGreaterThan(.1);
});

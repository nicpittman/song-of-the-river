import {expect,it} from 'vitest';
import {dampAngle} from './math';
it('flock headings cross the angle boundary without a full spin',()=>{
 const a=Math.PI-.01,b=-Math.PI+.01;
 expect(dampAngle(a,b,5,.1)-a).toBeGreaterThan(0);
 expect(dampAngle(a,b,5,.1)-a).toBeLessThan(.02);
 expect(dampAngle(a,b,5,0)).toBe(a);
});

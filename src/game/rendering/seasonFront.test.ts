import { expect, it } from 'vitest';
import { expeditionSeasonWave, frontAlong, seasonBlendAt } from './seasonFront';
it('spring and summer reach the low river before the peaks; winter does the reverse',()=>{
 for(const season of [0,1] as const)expect(frontAlong(.9,season)).toBeLessThan(frontAlong(.1,season));
 for(const season of [2,3] as const)expect(frontAlong(.1,season)).toBeLessThan(frontAlong(.9,season));
});
it('spreads the front over three saved days and holds it during planning and after dusk', () => {
  expect(expeditionSeasonWave(10, 0, 'morning')).toBeCloseTo(-.12);
  expect(expeditionSeasonWave(10, 400, 'morning')).toBeCloseTo(-.12);
  expect(expeditionSeasonWave(10, 40, 'day')).toBeCloseTo(expeditionSeasonWave(11, 0, 'morning'));
  expect(expeditionSeasonWave(11, 40, 'day')).toBeCloseTo(expeditionSeasonWave(12, 0, 'morning'));
  expect(expeditionSeasonWave(12, 40, 'day')).toBeCloseTo(1.4);
  expect(expeditionSeasonWave(11, 300, 'evening')).toBeCloseTo(expeditionSeasonWave(11, 40, 'day'));
  const span = { y: 0, height: 6800 };
  expect(seasonBlendAt(300, span, 3, expeditionSeasonWave(10, 20, 'day'))).toBeGreaterThan(.5);
  expect(seasonBlendAt(6500, span, 3, expeditionSeasonWave(10, 20, 'day'))).toBe(0);
  expect(seasonBlendAt(6500, span, 0, expeditionSeasonWave(13, 20, 'day'))).toBeGreaterThan(0);
  expect(seasonBlendAt(300, span, 0, expeditionSeasonWave(13, 20, 'day'))).toBe(0);
});

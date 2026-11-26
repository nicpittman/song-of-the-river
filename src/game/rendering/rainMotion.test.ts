import { expect, it } from 'vitest';
import { rainMotion } from './rainMotion';

it.each([0, 15, 1000, 10000])('draws rain along its actual velocity after %s seconds', time => {
  const dt = .001, rain = rainMotion(time, 9, .7);
  const velocity = (rainMotion(time + dt, 9, .7).offset - rain.offset) / dt;
  expect(velocity).toBeCloseTo(rain.slope, 4);
  expect(velocity).toBeGreaterThan(0);
  expect(velocity).toBeLessThan(.3);
});

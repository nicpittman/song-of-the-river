import { expect, it } from 'vitest';
import { routeInk } from './routeInk';

it('rounds a sharp turn while keeping the camp and destination fixed', () => {
  const route = routeInk([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }]);
  expect(route.d).toContain('Q');
  expect(route.samples[0]).toEqual({ x: 0, y: 0 });
  expect(route.samples.at(-1)).toEqual({ x: 50, y: 50 });
  for (const p of route.samples) {
    expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(50);
    expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(50);
    expect(Math.min(Math.abs(p.y), Math.abs(p.x - 50))).toBeLessThanOrEqual(7);
  }
});

it('handles repeated points and tiny bends without invalid numbers or overshoot', () => {
  const route = routeInk([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: .2, y: 0 }, { x: .2, y: .1 }, { x: 20, y: .1 }]);
  expect(route.d).not.toMatch(/NaN|Infinity/);
  expect(route.samples.every(p => p.x >= 0 && p.x <= 20 && p.y >= 0 && p.y <= .100001)).toBe(true);
  expect(routeInk([])).toEqual({ d: '', samples: [] });
});

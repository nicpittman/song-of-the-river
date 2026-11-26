import { expect, it } from 'vitest';
import { sightingClock } from './sightingClock';

it('shows the fraction of the real sketch window remaining, with its tip moving clockwise', () => {
  const full = sightingClock(0, 12), half = sightingClock(6, 12), last = sightingClock(11, 12), end = sightingClock(12, 12);
  expect(full.to - full.from).toBeCloseTo(Math.PI * 2);
  expect(half.to - half.from).toBeCloseTo(Math.PI);
  expect(last.remaining).toBeCloseTo(1 / 12);
  expect(end.to - end.from).toBe(0);
  expect(full.from).toBeLessThan(half.from);
  expect(half.from).toBeLessThan(last.from);
  expect(sightingClock(15, 12).remaining).toBe(0);
  expect(sightingClock(0, 0).remaining).toBe(0);
  expect(sightingClock(-1, 12).remaining).toBe(1);
});

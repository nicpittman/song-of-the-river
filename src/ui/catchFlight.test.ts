import { expect, it } from 'vitest';
import { arcPoint } from './catchFlight';

it('starts at the creature, ends at the book, and rises before it falls', () => {
  const from = { x: 300, y: 400 }, to = { x: 30, y: 760 };
  expect(arcPoint(from, to, 0)).toEqual(from);
  expect(arcPoint(from, to, 1)).toEqual(to);
  // Early on it is above where it started; it never jumps.
  expect(arcPoint(from, to, 0.15).y).toBeLessThan(from.y);
  let last = from;
  for (let i = 1; i <= 40; i++) {
    const p = arcPoint(from, to, i / 40);
    expect(Math.hypot(p.x - last.x, p.y - last.y)).toBeLessThan(60);
    last = p;
  }
});

import { expect, it } from 'vitest';
import { SnowTracks } from './snowTracks';

it('leaves tracks for villagers and animals without expedition routes, then fades them', () => {
  const snow = new SnowTracks();
  const walkers = ['villager-1', 'deer'].map((id, i) => ({ id, at: { x: i * 100, y: 20 }, moving: true }));
  expect(snow.update(walkers, .1)).toHaveLength(0);
  expect(snow.update(walkers.map(walker => ({ ...walker, at: { x: walker.at.x + 10, y: 20 } })), .1)).toHaveLength(2);
  expect(snow.update([], 10)).toHaveLength(0);
});

it('does not draw a teleport trail, and bounds long walks', () => {
  const snow = new SnowTracks();
  snow.update([{ id: 'sora', at: { x: 0, y: 0 }, moving: true }], .1);
  expect(snow.update([{ id: 'sora', at: { x: 2000, y: 3000 }, moving: true }], .1)).toHaveLength(0);
  for (let x = 2010; x < 2510; x += 10) snow.update([{ id: 'sora', at: { x, y: 3000 }, moving: true }], .01);
  expect(snow.update([], 0).length).toBeLessThanOrEqual(12);
});

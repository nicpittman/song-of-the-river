import { expect, it, vi } from 'vitest';
import type { Container } from 'pixi.js';
import { Camera } from './camera';
import type { BoardDef } from '../world/types';

function camera(): Camera {
  const world = { scale: { set: () => {} }, position: { set: () => {} } } as unknown as Container;
  const c = new Camera(world, { width: 4000, height: 4000 } as BoardDef, { x: 0, y: 0, width: 4000, height: 4000 });
  c.resize(800, 600);
  return c;
}

it('keeps a firm glide (dusk at the fire) through a drag already under way, and gives way to a new one', () => {
  const now = vi.spyOn(performance, 'now');
  let t = 1000; now.mockImplementation(() => t);
  const c = camera();
  c.drag(10, 0); t += 16; c.drag(10, 0);
  const taken = c.taken;
  t += 16; c.ease(500, 500, 1, 3.6, true);
  // The finger that was already down keeps moving: the glide goes on, and the camera is not taken.
  for (let i = 0; i < 30; i++) { t += 16; c.drag(40, 0); c.update(0.016); }
  expect(c.taken).toBe(taken);
  c.endDrag();
  for (let i = 0; i < 200; i++) { t += 16; c.update(0.016); }
  expect(Math.hypot(c.x - 500, c.y - 500)).toBeLessThan(2);
  // A new gesture after the glide began takes over as usual.
  c.ease(1500, 1500, 1, 3.6, true);
  t += 1000; c.drag(40, 0);
  expect(c.taken).toBe(taken + 1);
  now.mockRestore();
});

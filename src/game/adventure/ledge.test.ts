import { expect, it } from 'vitest';
import { placeDef } from './content';
import { placeToday } from './conditions';
import { newExpedition } from './testing';

it('opens the long way to Hanano behind the falls once the ledge is found, while the ford itself still floods', () => {
  const { a } = newExpedition();
  a.state.day = 1; // spring melt: high water, the stones under
  const w = () => a.world();
  expect(w().today.level).toBe('high');
  expect(placeToday(placeDef('hanano'), w().today, a.state).state).toBe('closed');
  (a as unknown as { updateGround(): void }).updateGround();
  expect(a.nav.route({ x: 640, y: 440 }, { x: 1690, y: 580 }, 2500)).toBeNull();

  a.state.discoveries['behind-the-falls'] = { day: 1, by: 'sora' };
  (a as unknown as { updateGround(): void }).updateGround();
  expect(placeToday(placeDef('hanano'), w().today, a.state).state).not.toBe('closed');
  expect(placeToday(placeDef('takaishi'), w().today, a.state).state).toBe('closed');
  const route = a.nav.route({ x: 640, y: 440 }, { x: 1690, y: 580 }, 2500)!;
  expect(route).not.toBeNull();
  // Round the head of the river, not over the flooded stones.
  expect(Math.min(...route.map((p) => p.y))).toBeLessThan(120);
});

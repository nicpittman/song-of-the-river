import { expect, it } from 'vitest';
import { findPossible } from './conditions';
import { findDef, placeDef } from './content';
import { holds, todayOf } from './world';
import { newExpedition } from './testing';

it('keeps the high route dry at every water height and the herons visible on clear winter days', () => {
  const { a } = newExpedition(7, false, { ren: 'fuchi', mina: 'seseragi', way: 'high-path' });
  for (const level of ['low', 'middle', 'high'] as const) {
    expect(findPossible(findDef('high-path'), placeDef('higashimori'), 'explore', { ...todayOf(7, 1), level }, a.state)).toBe(true);
  }
  a.state.course.way = 'herons';
  const winter = { ...todayOf(7, 10), weather: 'clear' as const };
  expect(findPossible(findDef('heron-way'), placeDef('kitsuneyama'), 'explore', winter, a.state)).toBe(true);
  expect(findPossible(findDef('heron-way'), placeDef('kitsuneyama'), 'explore', { ...winter, weather: 'mist' }, a.state)).toBe(false);
  // Every route can have its own local clue in Wander, while Journey keeps its course.
  expect(holds({ way: 'high-path' }, winter, a.state)).toBe(false);
  a.state.free = true;
  expect(holds({ way: 'high-path' }, winter, a.state)).toBe(true);
});

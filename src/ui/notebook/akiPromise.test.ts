import { expect, it } from 'vitest';
import { newExpedition } from '../../game/adventure/testing';
import { akiPromise } from './akiPromise';

it('keeps Aki’s build promise visible before the route is surveyed, updates during work, and clears when fulfilled', () => {
  const { a } = newExpedition();
  a.state.region = 1;
  expect(akiPromise(a.view())).toBeNull();
  a.state.discoveries['aki-meeting'] = { day: 1, by: 'ren' };
  expect(a.view().departure?.surveyed).toBe(false);
  expect(akiPromise(a.view())).toMatchObject({ line: expect.stringContaining('help Aki build'), action: 'Choose something to build →' });
  const cottage = { id: 901, kind: 'cottage' as const, region: 1, x: 600, y: 3200, work: 0, placed: 1 };
  a.state.buildings.push(cottage);
  expect(akiPromise(a.view())).toMatchObject({ line: expect.stringContaining('taking shape'), action: 'Choose builders →' });
  cottage.work = 100;
  expect(akiPromise(a.view())).toBeNull();
  a.state.free = true;
  a.sim.state.mode = 'free';
  expect(akiPromise(a.view())).toBeNull();
});

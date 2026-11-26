import { expect, it } from 'vitest';
import { newExpedition } from './testing';
import { Simulation } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';
import { NARROWS } from './structures';
import { departureOf, goalLine, readyToMove } from './progression';
import { suggestedOutings } from '../../ui/notebook/recommendations';

it('opens far-bank exploration after the bridge without claiming the road to Kawagiri is surveyed', () => {
  const { sim, a } = newExpedition(2086, false, { ren: 'fuchi', mina: 'seseragi', way: 'herons' });
  const s = a.state;
  s.region = 1; s.day = 3; s.provisions = 30; s.materials = 10;
  for (const person of s.people) { person.base = 1; delete person.lodging; }
  s.known.push('mio', 'toroya', 'omagari');
  s.discoveries['aki-meeting'] = { day: 1, by: 'sora' };
  s.buildings.push({ id: 100, kind: 'bridge', region: 1, ...NARROWS, work: 2, placed: 1 });
  // Loading a completed-bridge save gets the same invitation as finishing it.
  const loaded = new Simulation(adventureValley, structuredClone(sim.state)).expedition!;
  expect(loaded.state.known).toContain('mukoniwa');
  expect(loaded.state.rumoured).toEqual(expect.arrayContaining(['kitsuneyama', 'higashimori']));
  expect(departureOf(loaded.state)).toMatchObject({ prepared: true, packed: true, surveyed: false, place: 'kitsuneyama' });
  expect(readyToMove(loaded.state)).toBe(false);
  expect(goalLine(loaded.state)).toMatch(/still need to find the way south/);
  expect(goalLine(loaded.state)).not.toMatch(/Everything is packed/);
  expect(suggestedOutings(loaded.view()).some(row => ['mukoniwa', 'kitsuneyama', 'higashimori'].includes(row.place))).toBe(true);
  // An alternative route works too; there is no mandatory temple visit.
  loaded.state.discoveries['high-path'] = { day: 3, by: 'ren' };
  expect(readyToMove(loaded.state)).toBe(true);
  expect(goalLine(loaded.state)).toMatch(/Everything is packed/);
});

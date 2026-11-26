import { expect, it, vi } from 'vitest';
import { newExpedition, plan } from './testing';
import { suggestedOutings } from '../../ui/notebook/recommendations';

it('reuses forecasts and recommendations across cosmetic notebook refreshes', () => {
  const { a } = newExpedition();
  const first = a.view();
  const outing = plan('ren', 'fuchi', 'fish');
  const forecast = first.forecast(outing);
  const suggestions = suggestedOutings(first);
  a.selection = { person: 'ren', place: 'fuchi' };
  a.inspected = 'fuchi';
  a.life += 10;
  const next = a.view();
  expect(next.planningKey).toBe(first.planningKey);
  const route = vi.spyOn(a.nav, 'route');
  expect(next.forecast(outing)).toEqual(forecast);
  expect(route).not.toHaveBeenCalled();
  expect(suggestedOutings(next)).toBe(suggestions);
  // A UI caller cannot corrupt the cached reasons.
  forecast.reasons.length = 0;
  expect(next.forecast(outing).reasons.length).toBeGreaterThan(0);
});

it('refreshes planning when supplies, equipment, knowledge, work or assignments change', () => {
  const { a } = newExpedition();
  const changes = [
    () => { a.state.provisions = 0; },
    () => { a.state.equipment.push('rain-cape'); },
    () => { a.state.known.push('sumiyaki'); },
    () => { a.state.buildings.push({ id: 99, kind: 'garden', region: 0, x: 500, y: 1900, placed: 1, work: 0 }); },
    () => { a.rest('ren'); },
    () => { a.state.people[0]!.practice.explore = 8; },
    () => { a.state.day++; },
  ];
  for (const change of changes) {
    const before = a.view().planningKey;
    change();
    expect(a.view().planningKey).not.toBe(before);
  }
});

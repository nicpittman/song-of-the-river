import { expect, it } from 'vitest';
import { newExpedition, plan } from '../../game/adventure/testing';
import { planningPins, planRoutes } from './planRoutes';

it('keeps the first visit when the route passes the second place on its way out', () => {
  const { a } = newExpedition();
  const view = a.view();
  const first = view.places.find(p => p.id === 'suisha')!.at;
  const second = view.places.find(p => p.id === 'hatake')!.at;
  const shown = planRoutes({ ...view, itinerary: () => [second, { x: second.x + 2, y: second.y + 2 }, first, second] }, 'sora', 'suisha', { place: 'hatake', activity: 'forage' });
  expect(shown[0]!.points).toContainEqual(first);
  expect(shown[0]!.points.at(-1)).toEqual(second);
  expect(shown[0]!.destination).toBe('Suisha Mill → Hatake');
});

it('previews a replacement route while keeping the committed face pin and saved outing', () => {
  const { a } = newExpedition();
  a.assign(plan('sora', 'kamimori', 'explore'));
  const view = a.view();
  const oldPin = planningPins(view).find((p) => p.person === 'sora')!.at;
  const route = planRoutes(view, 'sora', 'suisha', undefined, 'sora').find((r) => r.person === 'sora')!;
  expect(route.provisional).toBe(true);
  expect(route.destination).toBe('Suisha Mill');
  expect(route.points.at(-1)).toEqual(view.places.find((p) => p.id === 'suisha')!.at);
  expect(planningPins(view).find((p) => p.person === 'sora')!.at).toEqual(oldPin);
  expect(a.state.plans[0]!.place).toBe('kamimori');
});

it('joins the displayed base marker for explorers and companions, with their own colours and separate previews', () => {
  const { a } = newExpedition();
  expect(a.assign(plan('sora', 'kamimori', 'explore', null, 'mina'))).toEqual({ ok: true });
  const view = a.view();
  const routes = planRoutes(view, 'ren', 'suisha');
  expect(routes.map((r) => r.person)).toEqual(['sora', 'mina', 'ren']);
  for (const route of routes) {
    const person = view.friends.find((f) => f.id === route.person)!;
    expect(route.colour).toBe(person.colour);
    expect(route.points[0]).toEqual(view.places.find((p) => p.kind === 'settlement' && p.region === person.base)!.at);
    expect(route.provisional).toBe(route.person === 'ren');
  }
  expect(new Set(routes.map((r) => r.colour)).size).toBe(3);
});

it('puts an unfinished project and its builders on the morning map', () => {
  const { a } = newExpedition();
  a.state.materials = 6; a.state.discoveries['aki-meeting'] = { day: 1, by: 'sora' };
  const site = { x: 1000, y: 340 };
  expect(a.place('bridge', site)).toEqual({ ok: true });
  expect(a.rest('ren')).toEqual({ ok: true });
  const view = a.view();
  expect(view.structures.find((s) => s.id === 'bridge')!.at).toEqual(site);
  const routes = planRoutes(view, null, null);
  expect(routes).toHaveLength(1);
  expect(routes[0]!.person).toBe('ren');
  expect(routes[0]!.destination).toBe('River footbridge');
  expect(routes[0]!.points.at(-1)).toEqual(site);
  expect(routes[0]!.provisional).toBe(false);
});

it('labels a move by the real hut rather than the town it belongs to', () => {
  const { a } = newExpedition();
  a.state.known.push('yamagoya'); a.state.visits.yamagoya = 1;
  expect(a.camp('sora', 'yamagoya')).toEqual({ ok: true });
  const view = a.view();
  const route = planRoutes(view, null, null)[0]!;
  expect(route.destination).toBe('Yamagoya');
  expect(route.points.at(-1)!.y).toBeLessThan(700);
  expect(route.points.at(-1)).toEqual(view.lodgings.find((l) => l.id === 'yamagoya')!.at);
});

it('draws from a remote shelter symbol after moving base, rather than from a fire seat or the old town', () => {
  const { a } = newExpedition();
  const id = a.state.nextId++;
  const at = { x: 600, y: 650 };
  a.state.buildings.push({ id, kind: 'shelter', ...at, region: 0, work: 0, placed: 1 });
  a.state.people.find((p) => p.id === 'ren')!.lodging = id;
  a.state.known.push('izumi');
  const view = a.view();
  const realPosition = { ...view.friends.find((f) => f.id === 'ren')!.at };
  const route = planRoutes(view, 'ren', 'izumi')[0]!;
  expect(route.points[0]).toEqual(at);
  expect(route.points[0]).not.toEqual(realPosition);
  expect(route.points.at(-1)).toEqual(view.places.find((p) => p.id === 'izumi')!.at);
  expect(view.friends.find((f) => f.id === 'ren')!.at).toEqual(realPosition);
});

it('keeps one face per person at home until confirmed, moves it to the destination, and returns it on cancellation', () => {
  const { a } = newExpedition();
  const home = a.view().places.find((place) => place.id === 'seseragi')!.at;
  expect(planningPins(a.view())).toHaveLength(3);
  expect(planningPins(a.view()).every((pin) => pin.at.x === home.x && pin.at.y === home.y)).toBe(true);
  a.assign(plan('ren', 'suisha', 'fish'));
  const pins = planningPins(a.view());
  expect(new Set(pins.map((pin) => pin.person)).size).toBe(3);
  expect(pins.find((pin) => pin.person === 'ren')!.at).toEqual(a.view().places.find((place) => place.id === 'suisha')!.at);
  expect(pins.find((pin) => pin.person === 'sora')!.at).toEqual(home);
  a.cancelPlan('ren');
  expect(planningPins(a.view()).find((pin) => pin.person === 'ren')!.at).toEqual(home);
});

it('puts a moving person’s face on the shelter rather than its parent town', () => {
  const { a } = newExpedition();
  a.state.known.push('yamagoya'); a.state.visits.yamagoya = 1;
  expect(a.camp('sora', 'yamagoya').ok).toBe(true);
  const view = a.view();
  const pin = planningPins(view).find((pin) => pin.person === 'sora')!;
  expect(pin.at).toEqual(view.lodgings.find((lodging) => lodging.id === 'yamagoya')!.at);
  expect(pin.label).toContain('Yamagoya');
});

it('joins the drawn camp to the nearest point on a route without the roaming-seat spur',async()=>{
  const {trimCampApproach}=await import('./planRoutes');
  const points=trimCampApproach([{x:200,y:200},{x:600,y:200},{x:600,y:0}],{x:500,y:190});
  expect(points[0]).toEqual({x:500,y:200});
  expect(points).not.toContainEqual({x:200,y:200});
  expect(points.at(-1)).toEqual({x:600,y:0});
});

it('retains the upstream bridge approach when a downstream regional journey starts on the far bank', () => {
  const { a } = newExpedition();
  a.state.region = 1; a.state.course.way = 'high-path';
  for (const person of a.state.people) person.base = 1;
  a.state.discoveries['high-path'] = { day: 1, by: 'sora' };
  a.state.buildings.push({ id: 99, kind: 'cottage', region: 1, x: 500, y: 3210, work: 2, placed: 1 });
  a.state.provisions = 30; a.state.materials = 10;
  const view = a.view();
  const upstreamBridge = { x: 1090, y: 2900 };
  const onward = { x: 1800, y: 4200 };
  const shown = planRoutes({ ...view, route: () => [{ x: 600, y: 3210 }, upstreamBridge, onward] }, 'sora', 'kawagiri')[0]!;
  expect(shown.points).toContainEqual(upstreamBridge);
  expect(shown.points.at(-1)!.x).toBeGreaterThan(1100);
});

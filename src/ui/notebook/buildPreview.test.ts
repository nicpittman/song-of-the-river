import { expect, it } from 'vitest';
import { newExpedition, plan, playToMorning } from '../../game/adventure/testing';
import { buildPreview } from './buildPreview';

it('previews the builders who will actually finish the work when the day begins', () => {
  const { a, sim } = newExpedition();
  const s = a.state;
  s.day = 4; s.region = 1; s.materials = 12; s.provisions = 30;
  s.discoveries['aki-meeting'] = { day: 1, by: 'sora' };
  s.known.push('mio', 'toroya', 'tanada');
  for (const person of s.people) person.base = 1;
  expect(a.place('cottage', { x: 560, y: 3200 })).toEqual({ ok: true });
  let view = a.view(), project = view.structures.find(p => p.id === 'cottage')!;
  expect(buildPreview(view, project)).toContain('can finish it today');
  expect(a.assign(plan('ren', 'tanada', 'forage')).ok).toBe(true);
  expect(a.assign(plan('mina', 'toroya', 'visit')).ok).toBe(true);
  view = a.view(); project = view.structures.find(p => p.id === 'cottage')!;
  expect(buildPreview(view, project)).toBe('Sora · about 2 days with these hands.');
  a.rest('sora');
  playToMorning(sim);
  expect(a.view().structures.find(p => p.id === 'cottage')!.workRemaining).toBe(1);
  view = a.view(); project = view.structures.find(p => p.id === 'cottage')!;
  expect(buildPreview(view, project)).toContain('can finish it today');
  playToMorning(sim);
  expect(a.view().structures.find(p => p.id === 'cottage')!.status).toBe('built');
});

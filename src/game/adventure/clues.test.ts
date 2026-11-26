import { expect, it } from 'vitest';
import { newExpedition, plan, playToMorning } from './testing';
import { placeDef } from './content';
import { isOpen } from './conditions';

it('reliably turns a fishing observation into a route to test when the water falls', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const { sim, a } = newExpedition(seed);
    expect(a.state.known).not.toContain('furukawa');
    a.assign(plan('ren', 'suisha', 'fish')); a.rest('sora'); a.rest('mina');
    playToMorning(sim);
    expect(a.state.rumoured).toContain('furukawa');
    expect(a.state.history[0]!.items!.find((item) => item.title === 'At Suisha Mill')!.text).toContain('old watercourse');
    while ((!isOpen(placeDef('furukawa'), a.world().today, a.state) || a.world().today.level !== 'low') && a.state.day < 40) playToMorning(sim);
    expect(a.assign(plan('sora', 'furukawa', 'explore'))).toEqual({ ok: true });
    playToMorning(sim);
    expect(a.state.known).toEqual(expect.arrayContaining(['furukawa', 'furumichi']));
    expect(a.state.history[0]!.items!.find((item) => item.title === 'The higher bank')!.text).toContain('towpath');
  }
});

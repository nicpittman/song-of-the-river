import { expect, it } from 'vitest';
import { newExpedition } from '../../game/adventure/testing';
import { Simulation } from '../../game/simulation/simulation';
import { adventureValley } from '../../game/world/boards/adventure';
import { chapterGate } from './chapterGate';
import { planRoutes, planningPins } from './planRoutes';

it('stages the group on a shared pin in the mist, then begins the actual downstream journey', () => {
  const { a,sim }=newExpedition();
  a.state.discoveries.waymark={day:1,by:'sora'}; a.state.provisions=20; a.state.materials=10;
  const before=a.view(); const gate=chapterGate(before)!;
  expect(gate.id).toBe('mio'); expect(gate.at.y).toBe(before.chart.regions[0]!.bottom+150);
  const edge=before.chart.channels[0]!.reduce((best,p)=>Math.abs(p.y-2500)<Math.abs(best.y-2500)?p:best);
  expect(gate.at.x).toBeLessThan(edge.x-edge.half);
  expect(a.moveEveryone('mio').ok).toBe(true);
  const view=a.view();
  expect(a.state.phase).toBe('morning'); expect(a.state.provisions).toBe(20);
  expect(planningPins(view).every(p=>p.at.x===gate.at.x&&p.at.y===gate.at.y)).toBe(true);
  for(const route of planRoutes(view,null,null)) {
    expect(route.points.at(-1)).toEqual(gate.at);
    expect(route.points.every(p=>p.y<=gate.at.y)).toBe(true);
  }
  const loaded=new Simulation(adventureValley,structuredClone(sim.state)).expedition!;
  expect(loaded.state.phase).toBe('morning'); expect(loaded.state.plans).toEqual(a.state.plans);
  expect(loaded.begin().ok).toBe(true); expect(loaded.state.moving).toBe(true);
  expect(loaded.state.outings.every(o=>o.legs.filter(leg=>leg.kind==='walk').at(-1)!.points!.at(-1)!.y>gate.at.y)).toBe(true);
});

it('does not require Mina to leave the upper valley, but still requires Ren', () => {
  const {a}=newExpedition(); a.state.people=a.state.people.filter(p=>p.id!=='mina');
  a.state.discoveries.waymark={day:1,by:'sora'};a.state.provisions=20;a.state.materials=10;
  expect(chapterGate(a.view())?.id).toBe('mio');
  a.state.people=a.state.people.filter(p=>p.id!=='ren');
  expect(chapterGate(a.view())).toBeNull();expect(a.moveEveryone('mio').ok).toBe(false);
});

import { expect, it, vi } from 'vitest';
import { Simulation } from '../../game/simulation/simulation';
import { adventureValley } from '../../game/world/boards/adventure';
import { newExpedition, plan, playToMorning, runUntil } from '../../game/adventure/testing';
import type { AdventureCommand, UnpackItem } from '../../game/adventure/model';
import { storesLedger, returnStory, standoutOf } from './evening';
import { Notebook } from './index';

it('highlights new geography from the saved report, identically after a reload', () => {
  const { a, sim } = newExpedition();
  a.assign(plan('sora', 'kamimori', 'explore')); a.begin();
  runUntil(sim, () => a.view().eveningReady); a.collectReturns();
  const report = a.state.history[0]!;
  const standout = standoutOf(report.items!);
  expect(standout?.label).toBe('New ground');
  expect(standout?.item.title).toContain('Found:');
  const saved = new Simulation(adventureValley, structuredClone(sim.state));
  expect(standoutOf(saved.expedition!.state.history[0]!.items!)).toEqual(standout);
});

it('emphasises a completed project on a day at camp', () => {
  const { a, sim } = newExpedition();
  // Story works take days; small ones stand at once. A footbridge finished by the whole group in a day.
  a.state.materials = 6; a.state.discoveries['aki-meeting'] = { day: 1, by: 'sora' }; a.place('bridge', { x: 1000, y: 340 });
  a.rest('sora'); a.rest('ren'); a.begin(); runUntil(sim, () => a.view().eveningReady); a.collectReturns();
  expect(standoutOf(a.state.history[0]!.items!)).toMatchObject({ label: 'A lasting change', item: { title: 'River footbridge', text: 'Finished today.' } });
  const completion = a.state.history[0]!.items!.filter(item => item.title === 'River footbridge');
  expect(completion).toHaveLength(1);
  expect(completion[0]!.contributors).toEqual(['sora', 'ren', 'mina']);
  const resumed = new Simulation(adventureValley, structuredClone(sim.state)).expedition!;
  expect(resumed.state.history[0]!.items!.find(item => item.title === 'River footbridge')?.contributors).toEqual(['sora', 'ren', 'mina']);
});

it('keeps the important result and its explanation together when a catch and field note arrive too', () => {
  const item = (id: string, kind: UnpackItem['kind'], title: string, text: string): UnpackItem => ({ id, person: 'ren', kind, title, text, hint: 'plain', sketch: null, provisions: 0, materials: 0 });
  const catchFish = item('catch', 'supplies', 'Provisions', '“Three fish. Enough for tomorrow.”');
  const field = item('field', 'nothing', 'At the mill', 'A kingfisher darts over the pool.');
  const discovery = item('route', 'find', 'Found: the old road', 'The old road leads south beyond the mill.');
  expect(returnStory([discovery, catchFish, field])).toEqual({ outcome: discovery, text: discovery.text });
  expect(returnStory([catchFish, field])?.text).toBe(catchFish.text);
  expect(returnStory([])).toBeNull();
});

it('separates the Mio journey’s provisions from supper, including after a reload', () => {
  const { a, sim } = newExpedition();
  a.state.provisions = a.state.dayStart.provisions = 10;
  a.state.discoveries.waymark = { day: 1, by: 'sora' };
  expect(a.travel().ok).toBe(true);
  const travelling = new Simulation(adventureValley, structuredClone(sim.state));
  playToMorning(travelling);
  const saved = new Simulation(adventureValley, structuredClone(travelling.state)).expedition!;
  const report = saved.state.history[0]!;
  expect(report).toMatchObject({ supper: 1, packed: 4, provisions: -3 });
  expect(report.items!.find(item => item.title === 'Arrived in Mio')?.outcome).toContain('innkeeper');
  const [food, wood] = storesLedger(report);
  expect(food).toMatchObject({ kind: 'provisions', left: saved.state.provisions });
  expect(food!.moves).toEqual(expect.arrayContaining(['packed 4 for the road', 'supper 1']));
  expect(wood).toMatchObject({ kind: 'materials', left: saved.state.materials });
});

it('takes a tomorrow link through the evening fade to a selected place, without beginning an outing', () => {
  const { a, sim } = newExpedition();
  a.assign(plan('sora', 'kamimori', 'explore')); a.begin();
  runUntil(sim, () => a.view().eveningReady); a.collectReturns();
  vi.useFakeTimers(); vi.stubGlobal('window', globalThis);
  try {
    const ui = Object.assign(Object.create(Notebook.prototype), {
      morningTimer: 0, pendingPlace: null, view: a.view(),
      spread: { close: vi.fn() }, openBook: vi.fn(), today: { focusPlace: vi.fn() },
      el: { classList: { add: vi.fn(), remove: vi.fn() } },
      actions: { cue: vi.fn(), togglePause: vi.fn(), expedition: (command: AdventureCommand) => a.command(command) },
    });
    ui.sleep('takaishi');
    expect(a.state.phase).toBe('evening');
    expect(ui.spread.close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(a.state.phase).toBe('morning'); expect(a.state.day).toBe(2);
    ui.resumePlanning(a.view());
    expect(ui.openBook).toHaveBeenCalledWith('today');
    expect(ui.today.focusPlace).toHaveBeenCalledWith('takaishi');
    expect(a.state.plans).toEqual([]); expect(a.state.outings).toEqual([]);
    expect(ui.pendingPlace).toBeNull();
  } finally { vi.useRealTimers(); vi.unstubAllGlobals(); }
});

it('keeps the new morning closed when the player closed the evening notebook',()=>{
  const {a}=newExpedition();
  const ui=Object.assign(Object.create(Notebook.prototype),{
    closedForMorning:true,tonightShown:true,spread:{endTonight:vi.fn()},openBook:vi.fn(),strip:{unfold:vi.fn()},
  });
  ui.onPhase(a.view());
  expect(ui.openBook).not.toHaveBeenCalled();expect(ui.closedForMorning).toBe(false);
  ui.onPhase(a.view());expect(ui.openBook).toHaveBeenCalledWith('today',true);
});

it('marks a small collection only on its actual completion day, including after reload',async()=>{
  const {collectionsCompletedOn}=await import('./evening');
  const {a,sim}=newExpedition();
  for(const [i,id] of ['dipper','kingfisher','heron','plover'].entries()) a.state.discoveries[id]={day:i+1,by:'ren'};
  expect(collectionsCompletedOn(a.view(),4).map(set=>set.id)).toContain('river-birds');
  expect(collectionsCompletedOn(a.view(),5)).toEqual([]);
  a.state.day=4;
  const loaded=new Simulation(adventureValley,structuredClone(sim.state));
  expect(collectionsCompletedOn(loaded.expedition!.view(),4).map(set=>set.id)).toContain('river-birds');
});

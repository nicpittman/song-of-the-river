import { expect, it, vi } from 'vitest';
import type { AdventureCommand } from '../../game/adventure/model';
import { newExpedition, plan } from '../../game/adventure/testing';
import { Today } from './today';
import { Strip } from './strip';
import { mapStopHints } from './stopHints';

/** Exercise the real keyboard/command path independently of browser painting. */
function planningHarness() {
  const { a } = newExpedition();
  const render = vi.fn();
  const ui = Object.assign(Object.create(Today.prototype), {
    active: true, making: false, view: a.view(), selectedLodging: null, planError: null, render,
    sel: { person: 'sora', place: null, activity: null, item: null, companion: null },
    actions: { expedition: (command: AdventureCommand) => a.command(command), cue: vi.fn() },
    nudgeWaiting: vi.fn(),
    card: { querySelector: vi.fn() },
  });
  return { a, ui: ui as Today, state: ui, render };
}

it('confirms a shelter move through the same action used by the primary button', () => {
  const { a, ui, state } = planningHarness();
  const id = a.state.nextId++;
  a.state.buildings.push({ id, kind: 'shelter', x: 600, y: 650, region: 0, work: 0, placed: 1 });
  state.selectedLodging = id; state.view = a.view();
  expect(ui.handleAction('e')).toBe(true);
  expect(a.state.plans[0]).toMatchObject({ person: 'sora', lodging: id });
  expect(state.sel.person).toBeNull();
});

it('keeps the person and base selected when a move is refused, with a visible reason', () => {
  const { a, ui, state, render } = planningHarness();
  state.selectedLodging = 999;
  ui.handleAction('e');
  expect(a.state.plans).toEqual([]);
  expect(state.sel.person).toBe('sora');
  expect(state.selectedLodging).toBe(999);
  expect(state.planError).toContain('Finish the shelter');
  expect(render).toHaveBeenCalled();
});

it('uses stable person numbers for the current destination without sending them', () => {
  const { a, ui, state } = planningHarness();
  state.sel.place = 'kamimori'; state.sel.activity = 'forage';
  expect(ui.handleAction('3')).toBe(true);
  expect(state.sel).toMatchObject({ person: 'mina', place: 'kamimori', activity: 'forage' });
  expect(a.state.plans).toEqual([]);
  expect(ui.handleAction('e')).toBe(true);
  expect(a.state.plans[0]).toMatchObject({ person: 'mina', place: 'kamimori', activity: 'forage' });
  expect(state.sel.place).toBeNull(); // Suggestions return; no new destination is automatically chosen.
});

it('inspects a sent person through their number without cancelling the saved route', () => {
  const { a, ui, state } = planningHarness();
  a.assign(planForTest());
  state.view = a.view();
  Object.assign(state, { tellGame: vi.fn() });
  const before = structuredClone(a.state.plans);
  expect(ui.handleAction('1')).toBe(true);
  expect(state.sel.person).toBe('sora');
  expect(a.state.plans).toEqual(before);
});

it('follows a daytime portrait directly, without opening another menu', () => {
  const command = vi.fn(), onMorning = vi.fn(), unfold = vi.fn();
  const strip = Object.assign(Object.create(Strip.prototype), { view: { phase: 'day' }, command, onMorning, unfold }) as Strip;
  strip.focusPerson('ren');
  expect(command).toHaveBeenCalledWith({ type: 'follow', person: 'ren' });
  expect(unfold).toHaveBeenCalledWith(false);
  expect(onMorning).not.toHaveBeenCalled();
});

function planForTest() { return { person: 'sora', place: 'kamimori', activity: 'explore' as const, item: null, companion: null }; }

it('reviews an explicit map stop without replacing the original outing until Add stop', () => {
  const { a, state, ui } = planningHarness();
  const original = planForTest();
  a.assign(original); state.view = a.view(); state.tellGame = vi.fn();
  const hint = [...mapStopHints(state.view).values()][0]![0]!;
  state.previewMapStop(hint);
  expect(state.editingPerson).toBe('sora');
  expect(state.sel.second).toEqual(hint.stop);
  expect(a.state.plans).toEqual([original]);
  ui.handleAction('e');
  expect(a.state.plans[0]).toMatchObject({ ...original, second: hint.stop });
});

it('does not turn an ordinary place-pin click into a second-stop proposal', () => {
  const { a, state } = planningHarness();
  const original = planForTest();
  a.assign(original); state.view = a.view(); state.tellGame = vi.fn();
  state.sel.person = null;
  const hint = [...mapStopHints(state.view).values()][0]![0]!;
  state.tapPlace(hint.stop.place, 'mouse');
  expect(state.sel.place).toBe(hint.stop.place);
  expect(state.sel.second).toBeUndefined();
  expect(state.editingPerson).toBeUndefined();
  expect(a.state.plans).toEqual([original]);
});

it('undoes an added stop through Today and dismisses the stale proposal', () => {
  const { a, state, ui } = planningHarness();
  const original = planForTest();
  a.command({ type: 'assign', plan: original }); state.view = a.view(); state.tellGame = vi.fn();
  const hint = [...mapStopHints(state.view).values()][0]![0]!;
  state.previewMapStop(hint); ui.handleAction('e');
  expect(a.state.plans[0].second).toEqual(hint.stop);
  state.view = a.view(); state.undoPlan();
  expect(a.state.plans).toEqual([original]);
  expect(state.sel.place).toBeNull();
  expect(state.editingPerson).toBeNull();
});

it('can visit the village while already living there instead of silently choosing a camp day', () => {
  const { a, ui, state } = planningHarness();
  state.sel.place = 'seseragi';
  ui.handleAction('e');
  expect(a.state.plans[0]).toMatchObject({ person: 'sora', place: 'seseragi', activity: 'visit', visitOnly: true });
  expect(a.state.resting).not.toContain('sora');
});

it('offers one group camp plan at a new town and allows a numbered individual selection', () => {
  const { a, ui, state } = planningHarness();
  a.state.known.push('yamagoya'); a.state.visits.yamagoya = 1;
  for (const person of a.state.people) person.lodging = 'yamagoya';
  state.view = a.view(); state.sel.person = null;
  state.considerPlace('seseragi');
  expect(state.sel).toMatchObject({ place: 'seseragi', overnight: 'seseragi', everyone: true });
  ui.handleAction('1');
  expect(state.sel).toMatchObject({ person: 'sora', everyone: false });
  ui.handleAction('e');
  expect(a.state.plans).toHaveLength(1);
  expect(a.state.plans[0]).toMatchObject({ person: 'sora', place: 'seseragi', activity: 'visit' });
  expect(a.state.plans[0]!.visitOnly).not.toBe(true);
});

it('returns from the build list to ordinary planning after placement', () => {
  const { a, state } = planningHarness();
  state.making = true;
  state.told = { key: '|', at: performance.now() };
  expect(state.isEcho()).toBe(false);
  state.showPlan();
  expect(state.making).toBe(false);
  expect(state.sel.person).toBeNull();
  expect(a.state.plans).toEqual([]);
});

it('begins with E after one confirmed outing without assigning the other people', () => {
  const { a, ui, state } = planningHarness();
  state.sel.place = 'kamimori'; state.sel.activity = 'explore';
  ui.handleAction('e');
  expect(a.state.plans).toHaveLength(1);
  state.view = a.view();
  expect(ui.handleAction('e')).toBe(true);
  expect(a.state.phase).toBe('day');
  expect(a.state.outings.map((outing) => outing.person)).toEqual(['sora']);
  expect(a.state.resting).toEqual(['ren', 'mina']);
});

it('links a suggested place to its map position and recommended person without committing a plan', () => {
  const { a, state } = planningHarness();
  const centreOn = vi.fn(), focusPlace = vi.fn();
  state.board = { centreOn, focusPlace };
  state.personPinned = true;
  state.making = true;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  try {
    state.focusPlace('kamimori');
    expect(state.sel).toMatchObject({ place: 'kamimori', person: 'sora' });
    expect(state.making).toBe(false);
    expect(centreOn).toHaveBeenCalledWith(a.view().places.find((p) => p.id === 'kamimori')!.at);
    expect(focusPlace).toHaveBeenCalledWith('kamimori');
    expect(a.state.plans).toEqual([]);
  } finally { vi.unstubAllGlobals(); }
});

it('previews the purpose and person from a resource suggestion without sending them', () => {
  const { a, state } = planningHarness();
  state.board = { centreOn: vi.fn(), focusPlace: vi.fn() };
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  try {
    state.focusPlace('kamimori', 'mina', 'forage');
    expect(state.sel).toMatchObject({ place: 'kamimori', person: 'mina', activity: 'forage', item: null, companion: null });
    expect(a.state.plans).toEqual([]);
  } finally { vi.unstubAllGlobals(); }
});

it('adds a second map stop without replacing the first, then confirms one outing', () => {
  const { a, ui, state } = planningHarness();
  a.state.day = 4;
  for (const id of ['suisha', 'hatake']) if (!a.state.known.includes(id)) a.state.known.push(id);
  state.view = a.view();
  state.sel = { person: 'sora', place: 'suisha', activity: 'fish', item: null, companion: null };
  Object.assign(state, { pickingSecond: true });
  expect(ui.handleAction('e')).toBe(true);
  expect(a.state.plans).toHaveLength(0);
  (ui as unknown as { tapPlace(id: string, pointer: string): void }).tapPlace('hatake', 'mouse');
  expect(state.sel.place).toBe('suisha');
  expect((state.sel as { second?: { place: string } }).second?.place).toBe('hatake');
  expect(ui.handleAction('e')).toBe(true);
  expect(a.state.plans[0]).toMatchObject({ person: 'sora', place: 'suisha', second: { place: 'hatake' } });
});

it('keeps choosing a second stop after an invalid pin and explains the combined daylight limit', () => {
  const { a, state } = planningHarness();
  a.state.day = 4;
  for (const id of ['suisha', 'hatake', 'yamagoya']) if (!a.state.known.includes(id)) a.state.known.push(id);
  state.view = a.view();
  state.sel = { person: 'sora', place: 'suisha', activity: 'fish', item: null, companion: null };
  state.pickingSecond = true;
  state.tapPlace('suisha', 'mouse');
  expect(state.planError).toContain('different place');
  expect(state.pickingSecond).toBe(true);
  state.tapPlace('yamagoya', 'touch');
  expect(state.planError).toMatch(/daylight|closed|route/i);
  expect(state.pickingSecond).toBe(true);
  expect(state.sel.place).toBe('suisha');
  expect(state.sel.second).toBeUndefined();
  state.tapPlace('hatake', 'touch');
  expect(state.sel.second).toMatchObject({ place: 'hatake' });
  expect(state.planError).toBeNull();
  expect(state.pickingSecond).toBe(false);
});

it('marks second-stop chances from the combined trip rather than a separate outing', () => {
  const { a, state } = planningHarness();
  a.state.day = 4;
  for (const id of ['suisha', 'hatake', 'yamagoya']) if (!a.state.known.includes(id)) a.state.known.push(id);
  state.view = a.view();
  state.sel = { person: 'sora', place: 'suisha', activity: 'fish', item: null, companion: null };
  state.pickingSecond = true;
  const chances = state.chancesFor(state.view);
  expect(chances.has('hatake')).toBe(true);
  expect(chances.has('suisha')).toBe(false);
  expect(chances.has('yamagoya')).toBe(false);
});

it('begins with saved plans while another destination is only being previewed', () => {
  const { a, state } = planningHarness();
  a.assign(plan('ren', 'suisha', 'fish'));
  state.view = a.view();
  state.sel.place = 'kamimori'; state.sel.activity = 'explore';
  state.beginDay();
  expect(a.state.phase).toBe('day');
  expect(a.state.outings.map((outing) => outing.person)).toEqual(['ren']);
  expect(a.state.resting).toContain('sora');
  expect(state.nudgeWaiting).not.toHaveBeenCalled();
});

it('preserves both confirmed stops while editing, then atomically replaces them with Send', () => {
  const { a, ui, state } = planningHarness();
  a.state.day = 4;
  for (const id of ['suisha', 'hatake']) if (!a.state.known.includes(id)) a.state.known.push(id);
  const outing = { ...plan('sora', 'suisha', 'fish'), second: { place: 'hatake', activity: 'forage' as const } };
  expect(a.assign(outing).ok).toBe(true);
  state.view = a.view(); state.tellGame = vi.fn();
  state.inspectPerson('sora');
  state.takeBack('sora');
  expect(a.state.plans).toEqual([outing]);
  expect(state.sel).toMatchObject(outing);
  expect(state.sel.second).not.toBe(outing.second);
  state.sel.activity = 'visit'; delete state.sel.second;
  expect(ui.handleAction('e')).toBe(true);
  expect(a.state.plans).toEqual([plan('sora', 'suisha', 'visit')]);
});

it('keeps the original plan if its proposed replacement is refused', () => {
  const { a, state } = planningHarness();
  const outing = planForTest();
  a.assign(outing); state.view = a.view(); state.tellGame = vi.fn();
  state.takeBack('sora');
  state.send({ ...outing, place: 'unknown' });
  expect(a.state.plans).toEqual([outing]);
  expect(state.editingPerson).toBe('sora');
  expect(state.planError).toBeTruthy();
});

it('starts the original confirmed trip when Begin is pressed during an edit', () => {
  const { a, state } = planningHarness();
  const outing = planForTest();
  a.assign(outing); state.view = a.view(); state.tellGame = vi.fn();
  state.takeBack('sora'); state.sel.place = 'suisha';
  state.beginDay();
  expect(a.state.phase).toBe('day');
  expect(a.state.outings[0]).toMatchObject(outing);
});

it('chooses the best available person for a clue’s activity, rather than the destination default', () => {
  const { a, state } = planningHarness();
  state.board = { centreOn: vi.fn(), focusPlace: vi.fn() };
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  try {
    state.focusPlace('suisha', undefined, 'fish');
    expect(state.sel).toMatchObject({ place: 'suisha', person: 'ren', activity: 'fish' });
    expect(a.state.plans).toEqual([]);
    a.state.rumoured.push('furukawa'); state.view = a.view();
    state.focusPlace('furukawa', undefined, 'investigate');
    expect(state.sel).toMatchObject({ place: 'furukawa', activity: 'explore' });
  } finally { vi.unstubAllGlobals(); }
});

it('keeps an existing hut as the destination when its relocation plan is edited', () => {
  const { a, ui, state } = planningHarness();
  a.state.known.push('yamagoya'); a.state.visits.yamagoya = 1;
  expect(a.camp('sora', 'yamagoya').ok).toBe(true);
  state.view = a.view(); state.tellGame = vi.fn();
  state.takeBack('sora'); state.view = a.view();
  expect(state.selectedLodging).toBe('yamagoya');
  expect(state.sel.place).toBe('yamagoya');
  ui.handleAction('e');
  expect(a.state.plans[0]).toMatchObject({ person: 'sora', lodging: 'yamagoya' });
});

it('preserves a committed outing when a dragged replacement is refused', () => {
  const { a, state } = planningHarness();
  const original = planForTest(); a.assign(original);
  a.state.provisions = 0; state.view = a.view();
  state.drop('sora', 'board', 'suisha', 'sora');
  expect(a.state.plans).toEqual([original]);
  expect(state.planError).toContain('packs are empty');
  expect(state.sel.place).toBe('suisha');
});

it('opens an individual camp move when a portrait is dropped onto a new village', () => {
  const { a, state } = planningHarness();
  a.state.known.push('yamagoya'); a.state.visits.yamagoya = 1;
  for (const person of a.state.people) person.lodging = 'yamagoya';
  const original = planForTest(); a.assign(original); state.view = a.view(); state.tellGame = vi.fn();
  state.drop('sora', 'board', 'seseragi', 'sora');
  expect(a.state.plans).toEqual([original]);
  expect(state.sel).toMatchObject({ person: 'sora', place: 'seseragi', overnight: 'seseragi', everyone: false });
});

it('edits a locked camp move without cancelling it until its replacement is sent', () => {
  const { a, state, ui } = planningHarness();
  for (const p of a.state.people) p.lodging = 'yamagoya';
  a.state.known.push('yamagoya', 'fuchi'); a.state.visits.yamagoya = 1;
  expect(a.assign(plan('ren', 'seseragi', 'visit')).ok).toBe(true);
  state.view = a.view(); state.tellGame = vi.fn();
  state.takeBack('ren');
  expect(state.sel).toMatchObject({ person: 'ren', place: 'seseragi', overnight: 'seseragi' });
  expect(a.state.plans[0]!.place).toBe('seseragi');
  state.sel = { person:'ren', place:'fuchi', activity:'fish', item:null, companion:null };
  ui.handleAction('e');
  expect(a.state.plans).toEqual([plan('ren', 'fuchi', 'fish')]);
});

it('takes the Mio construction lead into building rather than proposing a village visit', () => {
  const { a, state } = planningHarness();
  a.state.region = 1; a.state.known.push('mio');
  a.state.discoveries['aki-meeting'] = {day:1,by:'sora'};
  state.view = a.view(); state.showMake = vi.fn();
  state.focusPlace('mio');
  expect(state.showMake).toHaveBeenCalledOnce();
  expect(a.state.plans).toEqual([]);
});

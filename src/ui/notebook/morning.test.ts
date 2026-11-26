import { expect, it, vi } from 'vitest';
import { newExpedition, plan } from '../../game/adventure/testing';
import type { AdventureCommand } from '../../game/adventure/model';
import { dayNotice, morningStatus } from './morning';
import { Notebook } from './index';

it('treats one outing or an explicit camp choice as ready, and ignores a merely selected person', () => {
  const { a } = newExpedition();
  expect(morningStatus(a.view())?.ready).toBe(false);
  a.selection.person = 'sora';
  expect(morningStatus(a.view())?.ready).toBe(false);
  a.assign(plan('sora', 'kamimori', 'explore'));
  expect(morningStatus(a.view())).toMatchObject({ ready: true, label: 'Morning · Day not started' });
  a.cancelPlan('sora'); a.rest('ren');
  expect(morningStatus(a.view())?.ready).toBe(true);
  a.begin();
  expect(morningStatus(a.view())).toBeNull();
  expect(dayNotice(a.view())).toBeNull();
  expect(dayNotice({ ...a.view(), paused: true })).toEqual({ label: 'Day paused', action: 'Resume · Space' });
  expect(morningStatus({ ...a.view(), phase: 'morning', placing: 'shelter' })).toBeNull();
});

function harness() {
  const { a } = newExpedition();
  const openBook = vi.fn();
  const ui = Object.assign(Object.create(Notebook.prototype), {
    view: a.view(), openBook, spread: { opened: false },
    el: { classList: { contains: () => true }, closest: () => null },
    actions: { cue: vi.fn(), expedition: (command: AdventureCommand) => a.command(command) },
  });
  const key = () => ({ key: 'e', target: { closest: () => null }, preventDefault: vi.fn() });
  return { a, ui, openBook, key };
}

it('uses E from the closed valley to open planning, then to start one confirmed outing', () => {
  const { a, ui, openBook, key } = harness();
  const first = key(); ui.onKey(first);
  expect(first.preventDefault).toHaveBeenCalled();
  expect(openBook).toHaveBeenCalledWith('today');
  expect(a.state.phase).toBe('morning');
  a.assign(plan('sora', 'kamimori', 'explore')); ui.view = a.view();
  ui.onKey(key());
  expect(a.state.phase).toBe('day');
  expect(a.state.outings).toHaveLength(1);
  expect(a.state.resting).toEqual(['ren', 'mina']);
});

it('does not start a day through a settings or main-menu overlay', () => {
  const { a, ui, key } = harness();
  a.assign(plan('sora', 'kamimori', 'explore')); ui.view = a.view();
  ui.el.closest = () => ({});
  ui.onKey(key());
  expect(a.state.phase).toBe('morning');
});

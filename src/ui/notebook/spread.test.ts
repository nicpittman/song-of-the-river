import { afterEach, expect, it, vi } from 'vitest';
import { newExpedition, runUntil } from '../../game/adventure/testing';
import { Spread } from './spread';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function openingBook(mode = 'journey', day = 1, reduced = false) {
  vi.useFakeTimers();
  vi.stubGlobal('window', { setTimeout, clearTimeout, matchMedia: () => ({ matches: reduced }) });
  vi.stubGlobal('document', { activeElement: null });
  vi.stubGlobal('HTMLElement', class {});
  vi.stubGlobal('requestAnimationFrame', vi.fn());
  const classes = new Set<string>();
  const el = {
    classList: {
      add: (...names: string[]) => names.forEach(n => classes.add(n)),
      remove: (...names: string[]) => names.forEach(n => classes.delete(n)),
      toggle: (name: string, on: boolean) => on ? classes.add(name) : classes.delete(name),
    },
    closest: () => null, setAttribute: vi.fn(), removeAttribute: vi.fn(),
  };
  const book = Object.assign(Object.create(Spread.prototype), {
    el, view: { mode, day, phase: 'morning', chart: {} }, isOpen: false,
    actions: { cue: vi.fn() }, onToggle: vi.fn(), render: vi.fn(),
    today: { show: vi.fn() }, curl: { cancel: vi.fn() },
  }) as Spread;
  return { book, classes };
}

it('unfolds the first morning once, cancels cleanly on close, and unfolds a fresh Journey', () => {
  const { book, classes } = openingBook();
  book.open('today');
  expect(classes.has('is-unfolding')).toBe(true);
  vi.advanceTimersByTime(500);
  expect(classes.has('is-unfolding')).toBe(true);
  book.close();
  expect(classes.has('is-unfolding')).toBe(false);
  book.open('today');
  expect(classes.has('is-unfolding')).toBe(false);
  book.close();
  Object.assign(book, { view: { mode: 'journey', day: 1, phase: 'morning', chart: {} } });
  book.open('today');
  // A prior opening timer must not cut short this new Journey's fold.
  vi.advanceTimersByTime(300);
  expect(classes.has('is-unfolding')).toBe(true);
  vi.advanceTimersByTime(480);
  expect(classes.has('is-unfolding')).toBe(false);
  expect(classes.has('is-open')).toBe(true);
});

it.each([['free', 1, false], ['journey', 2, false], ['journey', 1, true]] as const)(
  'keeps the quick opening for %s day %i, reduced motion %s', (mode, day, reduced) => {
    const { book, classes } = openingBook(mode, day, reduced);
    book.open('today');
    expect(classes.has('is-unfolding')).toBe(false);
    vi.advanceTimersByTime(200);
    expect(classes.has('is-opening')).toBe(false);
  },
);

it('preserves the selected collection when opening it from Journal or People', () => {
  vi.stubGlobal('requestAnimationFrame', vi.fn());
  const turn = vi.fn();
  const collections = { set: 'The mountain water' };
  const spread = Object.assign(Object.create(Spread.prototype), {
    view: { phase: 'morning' }, isOpen: true, page: 'journal', collections,
    actions: { cue: vi.fn() }, turn, render: vi.fn(),
  }) as Spread;
  spread.open('collections');
  expect(collections.set).toBe('The mountain water');
  expect(turn).toHaveBeenLastCalledWith(true, false);
  spread.open('friends');
  spread.open('collections');
  expect(collections.set).toBe('The mountain water');
  expect(turn).toHaveBeenLastCalledWith(false, false);
});

it('uses Today at the evening Journal to reach morning planning without starting unplanned expeditions', () => {
  const { sim, a } = newExpedition();
  a.rest('sora'); a.rest('ren'); a.rest('mina'); a.begin();
  runUntil(sim, () => a.view().eveningReady);
  a.collectReturns();
  const sleep = vi.fn(() => { a.finishEvening(); a.finishEvening(); });
  const spread = Object.assign(Object.create(Spread.prototype), { view: a.view(), tonight: { sleep } }) as Spread;
  spread.open('today');
  expect(sleep).toHaveBeenCalledOnce();
  expect(a.state.day).toBe(2);
  expect(a.state.phase).toBe('morning');
  expect(a.state.plans).toEqual([]);
  expect(a.view().friends.every((f) => f.status === 'home')).toBe(true);
  expect(a.state.history[0]!.items!.length).toBeGreaterThan(0);
});

it('limits the menu archive to Journal and Collections, including keyboard navigation', () => {
  const { book } = openingBook();
  const tabs = ['today', 'journal', 'collections', 'friends', 'map'].map(page => ({ dataset: { page }, hidden: false }));
  Object.assign(book, { index: { querySelectorAll: () => tabs } });
  book.setArchive(true);
  expect(tabs.filter(tab => !tab.hidden).map(tab => tab.dataset.page)).toEqual(['journal', 'collections']);
  book.open('today'); expect(book.opened).toBe(false);
  book.open('friends'); expect(book.opened).toBe(false);
  book.setArchive(false); expect(tabs.every(tab => !tab.hidden)).toBe(true);
});

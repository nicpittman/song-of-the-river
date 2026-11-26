import { expect, it, vi } from 'vitest';
import { Game } from './game';
import { Menu } from '../ui/menu';
import { defaultSave } from './core/save';
import { newGameState } from './simulation/simulation';
import { adventureValley } from './world/boards/adventure';

it.each(['journey', 'free', 'all'] as const)('clears %s progress without replacing the title landscape or its framing', scope => {
  const save = defaultSave();
  save.journey = newGameState(adventureValley, 'journey');
  save.free = newGameState(adventureValley, 'free');
  const view = { camera: { x: 910, y: 1430, zoom: .63 } }, sim = {};
  const game = Object.assign(Object.create(Game.prototype), {
    save, phase: 'menu', view, sim,
    ui: { showMenu: vi.fn() }, showMenu: vi.fn(),
  });
  game.menuModel = () => ({ hasJourney: !!game.save.journey, canContinue: !!(game.save.journey || game.save.free) });
  game.makeActions().resetProgress(scope);
  expect(game.save.journey).toBe(scope === 'free' ? save.journey : null);
  expect(game.save.free).toBe(scope === 'journey' ? save.free : null);
  expect(game.ui.showMenu).toHaveBeenCalledWith(game.menuModel());
  expect(game.showMenu).not.toHaveBeenCalled();
  expect(game.view).toBe(view);
  expect(game.sim).toBe(sim);
  expect(game.view.camera).toEqual({ x: 910, y: 1430, zoom: .63 });
});

it('keeps the same landscape drift running through Settings, Hotkeys and Back without reframing on navigation', () => {
  const camera = { x: 920, y: 1450, zoom: .6, fitZoom: .5, rate: 9, focus: vi.fn(), snap: vi.fn() };
  const view = { camera, update: vi.fn(), paused: false };
  const game = Object.assign(Object.create(Game.prototype), {
    app: { ticker: { maxFPS: 60 } }, view, phase: 'menu', paused: false, session: null, tool: null, tour: null,
    clock: 10, hintTimer: 0,
    sim: { advance: vi.fn(), board: { width: 2400 }, reaches: [{ bottom: 2500 }] },
  });
  const content = { classList: { add: vi.fn() } };
  const menu = Object.assign(Object.create(Menu.prototype), {
    model: {}, actions: game.makeActions(), el: { dataset: {} },
    body: { replaceChildren: vi.fn(), querySelector: () => null },
    mainView: () => content, settingsView: () => content, hotkeysView: () => content,
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  try {
    let frames = 0;
    for (const page of ['main', 'settings', 'hotkeys', 'settings', 'main']) {
      menu.go(page);
      expect(camera.focus).toHaveBeenCalledTimes(frames);
      for (let i = 0; i < 20; i++) { game.frame(.1); frames++; }
      expect(camera.focus).toHaveBeenCalledTimes(frames);
      expect(camera.focus.mock.lastCall).toEqual([
        1200 + Math.sin(game.clock * .05) * 200,
        1500 + Math.cos(game.clock * .037) * 260,
        .65,
      ]);
    }
    expect(view.update).toHaveBeenCalledTimes(100);
    expect(camera.snap).not.toHaveBeenCalled();
    expect(camera.focus.mock.calls[0][0]).not.toBe(camera.focus.mock.lastCall![0]);
  } finally { vi.unstubAllGlobals(); }
});

it('opens the saved Journey as the real journal archive without changing its save or resuming the world', async () => {
  const { newExpedition } = await import('./adventure/testing');
  const { sim } = newExpedition();
  const saved = structuredClone(sim.state);
  const before = JSON.stringify(saved);
  const showArchive = vi.fn();
  const game = Object.assign(Object.create(Game.prototype), { session: null, save: { journey: saved }, ui: { showArchive } });
  game.makeActions().openJournal();
  expect(showArchive).toHaveBeenCalledOnce();
  expect(showArchive.mock.calls[0][0]).toMatchObject({ phase: 'night', region: 0 });
  expect(showArchive.mock.calls[0][0].journal.length).toBeGreaterThan(100);
  expect(showArchive.mock.calls[0][0].sets.length).toBeGreaterThan(0);
  expect(JSON.stringify(saved)).toBe(before);
});

it.each([
  { paused: true, book: false, phase: 'day', expected: 30 },
  { paused: false, book: true, phase: 'day', expected: 30 },
  { paused: false, book: false, phase: 'evening', expected: 30 },
  { paused: false, book: false, phase: 'day', expected: 60 },
])('uses $expected FPS with paused=$paused, notebook=$book and phase=$phase without changing the simulation time step', ({ paused, book, phase, expected }) => {
  const session = { frame: vi.fn() }, view = { update: vi.fn() };
  const game = Object.assign(Object.create(Game.prototype), {
    view, session, paused, phase: 'play', clock: 0, sinceSave: 0,
    app: { ticker: { maxFPS: 60 } },
    sim: { expedition: { state: { phase } } },
    ui: { notebookOpen: () => book }, openWander: vi.fn(),
  });
  game.frame(1 / expected);
  expect(game.app.ticker.maxFPS).toBe(expected);
  expect(session.frame).toHaveBeenCalledWith(1 / expected);
  expect(view.update).toHaveBeenCalledWith(1 / expected);
});

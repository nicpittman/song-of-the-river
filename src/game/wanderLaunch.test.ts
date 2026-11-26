import { expect, it, vi } from 'vitest';
import { Game } from './game';
import { defaultSave, parseSave } from './core/save';
import { newExpedition } from './adventure/testing';

function endedJourney() {
  const { sim, a } = newExpedition();
  a.state.region = 2; a.state.day = 22; a.state.voyage = 'ended'; a.state.companions = ['sora', 'ren'];
  for (const person of a.state.people) { person.base = 2; delete person.lodging; }
  return structuredClone(sim.state);
}

it('opens the completed valley in Wander at a new morning, preserving the Journey archive', () => {
  const save = defaultSave(); save.journey = endedJourney(); save.last = 'journey';
  const before = JSON.stringify(save.journey);
  const game = Object.assign(Object.create(Game.prototype), {
    save, sim: { state: save.journey, expedition: { state: save.journey.adventure } },
    persist: vi.fn(), showMenu: vi.fn(), play: vi.fn(),
  });
  game.makeActions().finishJourney();
  expect(game.save.free).toMatchObject({ mode: 'free', adventure: { free: true, day: 23, phase: 'morning', voyage: 'preparing' } });
  expect(JSON.stringify(save.journey)).toBe(before);
  // Exercise the serialized slots used by itch, then the real menu action.
  game.save = parseSave(JSON.stringify(game.save));
  game.makeActions().startFreePlay('river-adventure');
  const launched = game.play.mock.calls[0][1];
  expect(launched.mode).toBe('free');
  expect(launched.adventure.free).toBe(true);
  expect(launched.adventure.voyage).toBe('preparing');
  expect(game.menuModel().wanderLabel).toMatch(/Wander$/);
  expect(JSON.stringify(game.save.journey)).toBe(before);
});

it('repairs an ended Journey stored in an old Wander slot without altering either stored slot', () => {
  const save = defaultSave(); save.free = endedJourney(); save.journey = endedJourney();
  const before = JSON.stringify(save);
  const game = Object.assign(Object.create(Game.prototype), { save, play: vi.fn() });
  game.makeActions().startFreePlay('river-adventure');
  expect(game.play.mock.calls[0][1]).toMatchObject({ mode: 'free', adventure: { free: true, voyage: 'preparing', phase: 'morning' } });
  expect(JSON.stringify(save)).toBe(before);
});

it('resumes an existing Wander without replacing it with the completed Journey', () => {
  const { sim, a } = newExpedition(); a.state.free = true; sim.state.mode = 'free';
  a.state.day = 9; a.state.materials = 17;
  const save = defaultSave(); save.free = structuredClone(sim.state); save.journey = endedJourney();
  const game = Object.assign(Object.create(Game.prototype), { save, play: vi.fn() });
  game.makeActions().startFreePlay('river-adventure');
  expect(game.play.mock.calls[0][1]).toMatchObject({ mode: 'free', adventure: { free: true, day: 9, materials: 17 } });
});

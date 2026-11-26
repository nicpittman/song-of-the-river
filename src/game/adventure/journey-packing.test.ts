import { expect, it } from 'vitest';
import { newExpedition, playToMorning } from './testing';
import { readyToMove } from './progression';
import { ECONOMY } from './economy';
import { Simulation } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';
import { suggestedOutings } from '../../ui/notebook/recommendations';

it('needs the road’s provisions and one material for Mio, then packs both exactly once', () => {
  const { a, sim } = newExpedition();
  const food = ECONOMY.journeys[0]!, wood = ECONOMY.journeyMaterials[0]!;
  expect(wood).toBe(1);
  a.state.day = 4;
  a.state.discoveries.waymark = { day: 3, by: 'sora' };
  a.state.provisions = food; a.state.materials = 0;
  expect(readyToMove(a.state)).toBe(false);
  expect(a.view().departure).toMatchObject({ cost: food, packed: true, materialsCost: wood, materialsPacked: false, work: null });
  expect(a.travel().ok).toBe(false);
  expect(a.state.provisions).toBe(food); expect(a.state.materials).toBe(0);
  a.state.materials = wood; a.state.provisions = food - 1;
  expect(readyToMove(a.state)).toBe(false);
  expect(a.travel().ok).toBe(false);
  a.state.provisions = food;
  expect(readyToMove(a.state)).toBe(true);
  expect(a.travel()).toEqual({ ok: true });
  expect(a.state.provisions).toBe(0); expect(a.state.materials).toBe(0);
  expect(a.travel().ok).toBe(false);
  expect(a.state.provisions).toBe(0); expect(a.state.materials).toBe(0);
  const saved = new Simulation(adventureValley, structuredClone(sim.state));
  playToMorning(sim); playToMorning(saved);
  expect(a.state.region).toBe(1);
  expect(saved.expedition!.state).toEqual(a.state);
  // Mio shares its supper with newcomers, so the first morning there is not spent finding food.
  expect(a.state.provisions).toBe(ECONOMY.welcome[1]! - ECONOMY.dailyUpkeep);
});

it('names both supplies in the journey advice and offers gathering when materials are missing', () => {
  const { a } = newExpedition();
  a.state.discoveries.waymark = { day: 1, by: 'sora' };
  a.state.provisions = 5; a.state.materials = 0;
  expect(a.view().goal).toMatch(/a little more (food|timber)/);
  expect(a.view().canTravel).toBe(false);
  expect(suggestedOutings(a.view()).some((suggestion) => suggestion.purpose === 'materials' && suggestion.reason.includes('for the road ahead'))).toBe(true);
});

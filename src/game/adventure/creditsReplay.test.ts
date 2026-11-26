import { describe, expect, it } from 'vitest';
import { Simulation } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';
import { creditsReplay } from './creditsReplay';
import { newGameState } from '../simulation/simulation';
import { newAdventure } from './state';
import { VOYAGE_SECONDS } from './calendar';
import { newExpedition, runUntil } from './testing';

describe('the settings credits cutscene', () => {
  it('plays the existing voyage to its ending without changing its source save', () => {
    const { sim } = newExpedition();
    const before = structuredClone(sim.state);
    const replay = new Simulation(adventureValley, creditsReplay(sim.state));
    expect(replay.expedition!.state.region).toBe(2);
    expect(replay.expedition!.state.voyage).toBe('sailing');
    expect(replay.expedition!.scene().boat).not.toBeNull();
    runUntil(replay, () => replay.expedition!.state.voyage === 'ended');
    expect(replay.expedition!.state.voyageTime).toBe(VOYAGE_SECONDS);
    expect(replay.expedition!.view().ending!.sailed).toHaveLength(3);
    expect(sim.state).toEqual(before);
  });

  it('plays the Journey ending even when the last save was Wander', () => {
    const state = newGameState(adventureValley, 'free');
    state.adventure = newAdventure(true);
    const wander = new Simulation(adventureValley, state);
    const replay = new Simulation(adventureValley, creditsReplay(wander.state));
    runUntil(replay, () => replay.expedition!.state.voyage === 'ended');
    expect(replay.expedition!.view().ending).not.toBeNull();
    expect(wander.expedition!.state.free).toBe(true);
  });

  it('works before a journey has been started', () => {
    const replay = new Simulation(adventureValley, creditsReplay());
    expect(replay.expedition!.scene().boat).not.toBeNull();
    expect(replay.expedition!.view().voyage).toBe('sailing');
  });
});

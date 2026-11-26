/** A valley of two reaches, played as chapters: the lower one stays under mist until the upper is in song. */

import { describe, expect, it } from 'vitest';
import { composeValley } from '../world/compose';
import { AUTUMN } from '../world/types';
import { brook } from './fixtures/brook';
import { pond } from './fixtures/pond';
import { Simulation, newGameState } from './simulation';

const valley = composeValley('river', 'River', 'Two reaches', [brook, pond]);
const lower = brook.height;

describe('a valley of several reaches', () => {
  it('lays the reaches end to end and says which wishes belong to which', () => {
    expect(valley.height).toBe(brook.height + pond.height);
    expect(valley.reaches?.map((r) => [r.id, r.bottom])).toEqual([['brook', brook.height], ['pond', brook.height + pond.height]]);
    expect(valley.places.find((p) => p.id === 'pool')?.y).toBe(lower + 100);
    expect(valley.objectives.map((o) => o.reach)).toEqual([...brook.objectives.map(() => 0), ...pond.objectives.map(() => 1)]);
    // Only the upper reach is high ground: nothing in the lower one is ever snowbound.
    expect(valley.altitudeSpan).toBe(brook.height);
    expect(valley.channels.map((c) => c.id)).toEqual(['main', 'brook', 'main@pond', 'old-bed@pond']);
  });

  it('keeps the lower reach under mist until the upper one is complete', () => {
    const sim = new Simulation(valley, newGameState(valley, 'journey'));
    expect(sim.wishes).toHaveLength(brook.objectives.length);
    expect(sim.openBottom).toBe(lower);
    const planted = sim.plant({ x: 390, y: lower + 450 });
    expect(planted.ok).toBe(false);
    if (!planted.ok) expect(planted.reason).toMatch(/mist/i);
    expect(sim.openChannel('old-bed@pond').ok).toBe(false);
    // Nobody sets out on the lower reach's journeys yet.
    for (let i = 0; i < 600; i++) sim.step();
    expect(sim.agents.some((a) => a.traveller === 'fish' || a.traveller === 'bird')).toBe(false);
  });

  it('opens the next reach when the first is in song, rates each, and ends after the last', () => {
    const sim = new Simulation(valley, newGameState(valley, 'journey'));
    const chapters: number[] = [];
    let won = false;
    sim.events.on('chapter', (e) => chapters.push(e.next));
    sim.events.on('won', () => (won = true));
    const pending = [...brook.solution];
    while (sim.state.chapter === 0 && sim.year <= 2) {
      while (pending.length && sim.addConnection(pending[0]!).ok) pending.shift();
      sim.step();
    }
    expect(chapters).toEqual([1]);
    expect(sim.state.ratings).toEqual([3]);
    expect(sim.wishes).toHaveLength(valley.objectives.length);
    expect(sim.openBottom).toBe(valley.height);

    // The lower reach: let the fish round the weir, and give the flock somewhere to rest.
    expect(sim.openChannel('old-bed@pond').ok).toBe(true);
    while (sim.state.marks < 2) sim.step();
    expect(sim.plant({ x: 390, y: lower + 450 }).ok).toBe(true);
    expect(sim.plant({ x: 660, y: lower + 740 }).ok).toBe(true);
    for (let i = 0; i < 12 && !won; i++) sim.skipToNextSeason();
    expect(won).toBe(true);
    expect(sim.state.completed).toContain('flyway');
    expect(sim.state.ratings).toHaveLength(2);
    expect(sim.state.ratings[1]).toBeGreaterThanOrEqual(1);
    expect(sim.season === AUTUMN || sim.state.outcome === 'won').toBe(true);
  });

  it('gives Free Play the whole river from the start', () => {
    const sim = new Simulation(valley, newGameState(valley, 'free'));
    expect(sim.openBottom).toBe(valley.height);
    expect(sim.plant({ x: 390, y: lower + 450 }).ok).toBe(true);
  });
});

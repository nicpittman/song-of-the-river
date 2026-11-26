/** The mountain above Seseragi: an optional side trip that pays for the walk and never crowds the road south. */
import { describe, expect, it } from 'vitest';
import { suggestedOutings } from '../../ui/notebook/recommendations';
import { FINDS, LEADS, placeDef } from './content';
import { UPLANDS, UPLAND_STORIES } from './discovery';
import { newExpedition, plan, playToMorning } from './testing';

const SIDE_LEADS = ['to-izumi', 'to-sumiyaki', 'tarn-ice', 'thunder-bird'];

function settledInSeseragi(seed: number) {
  const { a, sim } = newExpedition(seed, true);
  a.assign(plan('sora', 'fuchi', 'explore')); playToMorning(sim);
  a.command({ type: 'move-everyone', place: 'seseragi' }); playToMorning(sim);
  return { a, sim };
}

describe('the uplands', () => {
  it('give each side story a certain, daylight-sized walk from Seseragi', () => {
    const { a } = settledInSeseragi(1);
    for (const id of UPLAND_STORIES) {
      const find = FINDS.find((f) => f.id === id)!;
      const place = find.at![0]!;
      if (!a.state.known.includes(place)) a.state.known.push(place);
      const forecast = a.view().forecast(plan('sora', place, find.activities![0]!));
      expect(forecast.problem, `${id} at ${place}`).toBeNull();
      expect(forecast.discoveryHint).toBe(find.story!.reason);
    }
  });

  it('notices its leads only up on the mountain, so the road south keeps its evening line', () => {
    for (const id of SIDE_LEADS) {
      const lead = LEADS.find((l) => l.id === id)!;
      expect(lead.from.every((from) => UPLANDS.has(from)), id).toBe(true);
      expect(placeDef(lead.to).region).toBe(0);
    }
  });

  it('offers at most one upland idea a morning, beside the clues', () => {
    for (const seed of [1, 2086]) {
      const { a, sim } = settledInSeseragi(seed);
      for (let day = 0; day < 5 && a.state.region === 0; day++) {
        const view = a.view();
        const suggestions = suggestedOutings(view);
        const optional = suggestions.filter((s) => UPLANDS.has(s.place) && !view.goal.includes(placeDef(s.place).name) && !s.reason.includes('Today'));
        expect(optional.length).toBeLessThanOrEqual(1);
        if (!a.state.discoveries.miller) expect(suggestions.some((s) => s.place === 'suisha')).toBe(true);
        a.assign(plan('ren', a.state.discoveries.miller ? 'furumichi' : 'suisha', a.state.discoveries.miller ? 'explore' : 'visit'));
        a.assign(plan('mina', 'hatake', 'forage'));
        a.assign(plan('sora', 'yamagoya', 'investigate'));
        playToMorning(sim);
      }
      expect(a.state.discoveries['hut-book']).toBeTruthy();
    }
  });
});

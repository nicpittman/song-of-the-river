import { describe, expect, it } from 'vitest';
import { REVEAL_TIMES, crestTime, revealBeats, revealEdge, type RevealPlan } from './reveal';

const plan: RevealPlan = {
  id: 'mio',
  from: 2800,
  to: 4800,
  landmarks: [
    { id: 'ringozaka', name: 'Ringozaka', at: { x: 440, y: 2820 }, settlement: false },
    { id: 'mio', name: 'Mio', at: { x: 610, y: 3210 }, settlement: true },
    { id: 'kurumaya', name: 'Kurumaya Mill', at: { x: 870, y: 3480 }, settlement: false },
    { id: 'kitsuneyama', name: 'Kitsuneyama Shrine', at: { x: 1700, y: 3450 }, settlement: false },
    { id: 'omagari', name: 'Omagari', at: { x: 590, y: 4080 }, settlement: false },
  ],
};

describe('the travel-day unveiling', () => {
  it('rolls the mist back steadily from the old reach to the new one, finishing well before dusk', () => {
    expect(revealEdge(plan, 0)).toBe(plan.from);
    expect(revealEdge(plan, REVEAL_TIMES.end)).toBe(plan.to);
    let last = -Infinity;
    for (let t = 0; t <= 40; t += 0.5) {
      const edge = revealEdge(plan, t);
      expect(edge).toBeGreaterThanOrEqual(last);
      last = edge;
    }
    // The group arrives at 36 s and dusk falls at 40 s.
    expect(REVEAL_TIMES.end).toBeLessThan(32);
  });

  it('brings landmarks into light in river order, never two at once', () => {
    const beats = revealBeats(plan);
    const sorted = [...beats].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(1.6);
    expect(beats[0]).toBeLessThan(beats[1]!);
    expect(beats[1]).toBeLessThan(beats[4]!);
    // Each one only once the mist has actually left it.
    plan.landmarks.forEach((mark, i) => expect(revealEdge(plan, beats[i]!)).toBeGreaterThan(mark.at.y));
    expect(Math.max(...beats)).toBeLessThan(REVEAL_TIMES.end + 6);
  });

  it('crests into view of the settlement in the first half of the day', () => {
    const crest = crestTime(plan)!;
    expect(crest).toBeGreaterThan(5);
    expect(crest).toBeLessThan(20);
  });
});

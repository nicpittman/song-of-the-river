import { expect, it } from 'vitest';
import { WAY_TAGS } from './lines';
import { newExpedition } from './testing';

it('tells a day that only found the way somewhere new as news, never as “Nothing new today”', () => {
  let checked = 0;
  for (let seed = 1; seed < 12; seed++) {
    for (const place of newExpedition(seed).a.state.known) {
      const { a } = newExpedition(seed);
      const plan = { person: 'sora', place, activity: 'explore' as const, item: null, companion: null };
      const f = a.view().forecast(plan);
      if (f.problem || !f.reasons.some((r) => r.text.startsWith('Reveals '))) continue;
      if (!a.assign(plan).ok || !a.begin().ok) continue;
      const outing = a.state.outings[0]!;
      if (outing.bundles.some((b) => b.kind !== 'nothing')) continue;
      expect(WAY_TAGS).toContain(outing.legs.find((leg) => leg.reveal)?.text);
      expect(outing.pack).toBe('unusual');
      checked++;
    }
  }
  expect(checked).toBeGreaterThan(2);
});

import { expect, it } from 'vitest';
import { riverSign } from './signs';
import { newExpedition, playToMorning, runUntil } from './testing';

it('reads the morning and points at a known place, and its creature always comes that day', () => {
  let signs = 0;
  for (const seed of [1, 2, 3, 4, 5, 2086]) {
    const { a, sim } = newExpedition(seed);
    for (let day = 0; day < 6; day++) {
      const sign = riverSign(a.world());
      if (sign) {
        signs++;
        expect(a.state.known).toContain(sign.place);
        expect(sign.line).toMatch(/^(A clear|Mist|Rain|Fresh snow|The water|The river)/);
        expect(sign.line).toMatch(/near /);
        expect(a.view().sign).toEqual(sign);
        a.rest('sora'); a.begin();
        expect(a.state.sightings.map((x) => x.find)).toContain(sign.find);
      }
      playToMorning(sim);
    }
  }
  expect(signs).toBeGreaterThan(15);
});

it('names a creature already in the journal, and only hints at a new one', () => {
  const { a } = newExpedition();
  const sign = riverSign(a.world())!;
  expect(sign).toBeTruthy();
  if (!a.state.discoveries[sign.find]) expect(sign.line).toContain('Something new may show');
  a.state.discoveries[sign.find] = { day: 1, by: 'sketch' };
  const again = riverSign(a.world());
  if (again?.find === sign.find) expect(again.line).toContain('perhaps:');
});

it('ends the evening on the same sign the morning will show', () => {
  let checked = 0;
  for (const seed of [1, 2, 3, 2086]) {
    const { a, sim } = newExpedition(seed);
    for (let day = 0; day < 6; day++) {
      a.rest('sora'); a.begin();
      runUntil(sim, () => a.state.phase === 'evening' && !!a.state.evening?.settled, 6000);
      const promised = a.state.evening?.tomorrowSign;
      const place = a.state.evening?.tomorrowPlace;
      playToMorning(sim);
      const sign = a.view().sign;
      if (promised) { checked++; expect(sign?.line).toBe(promised); }
      else if (sign && !(a.state.region === 0 && a.state.day <= 3)) expect(sign.place).toBe(place);
    }
  }
  expect(checked).toBeGreaterThan(8);
});

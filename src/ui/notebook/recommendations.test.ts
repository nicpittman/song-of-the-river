import { expect, it } from 'vitest';
import { newExpedition, plan, playToMorning } from '../../game/adventure/testing';
import { clueActivity, defaultActivity, interestingPlaces, recommendPeople, suggestedOutings } from './recommendations';
import { placeToday } from '../../game/adventure/conditions';
import { placeDef } from '../../game/adventure/content';
import { todayOf } from '../../game/adventure/world';

it('suggests strengths for the chosen purpose without assigning anybody', () => {
  const { a } = newExpedition();
  const view = a.view();
  const mill = view.places.find((p) => p.id === 'suisha')!;
  const wood = view.places.find((p) => p.id === 'kamimori')!;
  expect(recommendPeople(view, mill, 'fish')[0]!.id).toBe('ren');
  expect(recommendPeople(view, wood, 'forage')[0]!.id).toBe('mina');
  expect(recommendPeople(view, wood, 'explore')[0]!.id).toBe('sora');
  expect(defaultActivity(view.friends.find((f) => f.id === 'ren')!, mill)).toBe('fish');
  expect(a.state.plans).toEqual([]);
});

it('puts food first when packs are low, and recognises the food already planned', () => {
  const { a } = newExpedition();
  a.state.provisions = 0;
  const advice = suggestedOutings(a.view());
  expect(advice[0]).toMatchObject({ purpose: 'provisions' });
  expect(advice[0]!.reason).toContain('packs are low');
  const chosen = advice[0]!;
  a.assign(plan(chosen.person, chosen.place, chosen.activity));
  const following = suggestedOutings(a.view());
  expect(following.every((suggestion) => suggestion.person !== chosen.person)).toBe(true);
  expect(following[0]?.reason).not.toContain('packs are low');
});

it('offers contrasting, achievable purposes with visible reasons and no uncommitted mutation', () => {
  const { a } = newExpedition();
  const before = structuredClone(a.state);
  const view = a.view(), advice = suggestedOutings(view);
  expect(advice.length).toBeGreaterThanOrEqual(2);
  expect(advice.length).toBeLessThanOrEqual(3);
  expect(new Set(advice.map((entry) => entry.place)).size).toBe(advice.length);
  expect(new Set(advice.map((entry) => entry.purpose)).size).toBe(advice.length);
  for (const entry of advice) {
    expect(view.forecast(plan(entry.person, entry.place, entry.activity)).problem).toBeNull();
    expect(entry.reason).not.toMatch(/Reveals|waymark|long-view/);
  }
  expect(advice.every((entry) => !entry.reason.includes('Materials for'))).toBe(true);
  expect(a.state).toEqual(before);
});

it('leaves assigned and unreachable people out of the recommendations', () => {
  const { a } = newExpedition();
  a.assign(plan('ren', 'suisha', 'fish'));
  a.state.known.push('izumi');
  const view = a.view();
  const mill = view.places.find((p) => p.id === 'suisha')!;
  expect(recommendPeople(view, mill).some((f) => f.id === 'ren')).toBe(false);
  const spring = view.places.find((p) => p.id === 'izumi')!;
  for (const f of recommendPeople(view, spring)) expect(view.forecast(plan(f.id, spring.id, defaultActivity(f, spring))).problem).toBeNull();
});

it('marks a few useful places and keeps the home camp available for rest or building', () => {
  const { a } = newExpedition();
  const view = a.view();
  const suggestions = interestingPlaces(view);
  expect(suggestions.size).toBeGreaterThan(0);
  expect(suggestions.size).toBeLessThanOrEqual(3);
  expect(suggestions.has('seseragi')).toBe(false);
  expect(recommendPeople(view, view.places.find((p) => p.id === 'seseragi')!)).toHaveLength(3);
  a.rest('sora'); a.rest('ren'); a.rest('mina');
  expect(interestingPlaces(a.view()).size).toBe(0);
});

it('prioritises an exposed crossing before closure and suggests exploring its frontier', () => {
  const { a } = newExpedition();
  const ford = placeDef('takaishi');
  const day = Array.from({ length: 35 }, (_, i) => i + 4).find((day) => placeToday(ford, todayOf(a.seed, day), a.state).state !== 'closed' && placeToday(ford, todayOf(a.seed, day + 1), a.state).state === 'closed')!;
  expect(day).toBeDefined();
  a.state.day = day; a.state.known.push(ford.id); a.state.provisions = 30; a.state.materials = 20;
  expect(suggestedOutings(a.view())[0]).toMatchObject({ place: ford.id, activity: 'explore', purpose: 'opportunity', reason: 'A chance to look before the water changes' });
});

it('suggests the activity that can follow a clue instead of another productive outing at its place', () => {
  const { a } = newExpedition();
  a.state.day = 4; a.state.known.push('koishihama'); a.state.provisions = 30;
  a.state.leads.push({ id: 'to-koishihama', place: 'koishihama', find: 'river-agate', line: 'A bright stone on the bank.', given: 3, expires: 4 });
  const suggestion = suggestedOutings(a.view()).find((entry) => entry.purpose === 'opportunity');
  expect(suggestion).toMatchObject({ place: 'koishihama', activity: 'forage', reason: 'A bright stone on the bank. The signs are still fresh.' });
  expect(clueActivity(a.view(), a.view().places.find((p) => p.id === 'koishihama')!)).toBe('forage');
});

it('keeps the solo opening suggestion aligned with the visible invitation to meet the fisher', () => {
  const { a } = newExpedition(41, true);
  const view = a.view();
  expect(view.goal).toContain('Fuchi');
  const suggestion = suggestedOutings(view)[0]!;
  expect(suggestion).toMatchObject({ place: 'fuchi', person: 'sora' });
  expect(view.forecast(plan(suggestion.person, suggestion.place, suggestion.activity)).discoveryHint).toContain('fisher');
  expect(a.state.plans).toEqual([]);
});

it('suggests timber for the next boat project before more food once supper is covered', () => {
  const { a } = newExpedition(); a.state.region = 2;
  for (const person of a.state.people) person.base = 2;
  a.state.known.push('kawagiri', 'matsubara', 'funaya', 'hosokawa');
  a.state.discoveries['aki-meeting'] = { day: 1, by: 'sora' };
  a.state.discoveries['boat-ledger'] = { day: 1, by: 'sora' };
  a.state.materials = 1; a.state.provisions = 6;
  expect(suggestedOutings(a.view())[0]).toMatchObject({ purpose: 'materials', reason: expect.stringContaining('dock') });
});

it('keeps Ren’s familiar mill visit among day two’s useful choices alongside a side path',()=>{
  const {a}=newExpedition(2086,true);
  a.state.people.push({id:'ren',base:0,lodging:'yamagoya',practice:{},memories:[]});
  a.state.day=2; a.state.known.push('suisha','seseragi');a.state.provisions=4;
  const ideas = suggestedOutings(a.view());
  expect(ideas).toEqual(expect.arrayContaining([expect.objectContaining({person:'ren',place:'suisha',activity:'visit'})]));
  expect(ideas.at(-1)?.purpose).toBe('wander');
});

it('keeps two useful ideas and a reachable daily detour or river sign, stable on refresh but varied across days', () => {
  const { a } = newExpedition();
  a.state.known.push('yamagoya','taki','umezono','hatake','sumiyaki','hanano','furumichi');
  a.state.provisions = 30; a.state.materials = 20;
  const choices = new Set<string>();
  for (let day = 4; day <= 9; day++) {
    a.state.day = day;
    const view = a.view(), ideas = suggestedOutings(view);
    expect(ideas).toHaveLength(3);
    const hunches = ['wander', 'sign', 'gamble'];
    expect(ideas.filter(idea => !hunches.includes(idea.purpose)).length).toBeGreaterThanOrEqual(1);
    expect(ideas.filter(idea => hunches.includes(idea.purpose)).length).toBeLessThanOrEqual(2);
    const detour = ideas[2]!;
    expect(hunches).toContain(detour.purpose);
    expect(new Set(ideas.map(idea => idea.place)).size).toBe(3);
    expect(view.forecast(plan(detour.person, detour.place, detour.activity)).problem).toBeNull();
    expect(suggestedOutings(a.view()).at(-1)).toEqual(detour);
    choices.add(detour.place);
  }
  expect(choices.size).toBeGreaterThan(1);
});

it('keeps Seseragi available after Ren joins, beside a northern detour rather than yesterday’s pool', () => {
  const { a, sim } = newExpedition(2086, true);
  a.assign(plan('sora', 'fuchi', 'explore'));
  playToMorning(sim);
  expect(a.state.history[0]!.tomorrowPlace).toBe('seseragi');
  const advice = suggestedOutings(a.view());
  expect(advice.find(idea => idea.purpose === 'move-camp')).toMatchObject({ place: 'seseragi', reason: expect.stringContaining('Ren') });
  expect(advice[0]!.purpose).not.toBe('move-camp');
  expect(advice.at(-1)).toMatchObject({ purpose: 'wander', place: 'taki' });
  expect(advice.some(idea => idea.place === 'suisha')).toBe(true);
  expect(a.state.plans).toEqual([]);
  expect(a.command({ type: 'move-everyone', place: 'seseragi' }).ok).toBe(true);
  expect(suggestedOutings(a.view()).some(idea => idea.purpose === 'move-camp')).toBe(false);
  playToMorning(sim);
  expect(suggestedOutings(a.view()).some(idea => idea.purpose === 'move-camp')).toBe(false);
});


it('offers three readable first-day directions, including a reachable upstream walk',()=>{
  const {a}=newExpedition(2086,true),view=a.view();
  const ideas=suggestedOutings(view);
  expect(ideas.map(i=>i.place)).toEqual(['fuchi','kamimori','taki']);
  expect(view.places.find(p=>p.id==='taki')!.at.y).toBeLessThan(view.friends[0]!.at.y);
  for(const idea of ideas) expect(view.forecast(plan(idea.person,idea.place,idea.activity)).problem).toBeNull();
});

it('sometimes turns a row into a gamble, and only ever where something is still to be found today', async () => {
  const { PlaytestBot } = await import('../../game/adventure/bot');
  const { courseOf } = await import('../../game/adventure/course');
  let gambles = 0;
  for (const seed of [2086, 7, 4242]) {
    const { a } = newExpedition(seed, true, courseOf(seed));
    const bot = new PlaytestBot(a, seed, () => {}, { morning: () => {
      const view = a.view();
      const rows = suggestedOutings(view);
      expect(rows.length).toBeLessThanOrEqual(3);
      expect(new Set(rows.map((row) => row.place)).size).toBe(rows.length);
      const gamble = rows.filter((row) => row.purpose === 'gamble');
      expect(gamble.length).toBeLessThanOrEqual(1);
      if (!gamble[0]) return;
      gambles++;
      if (view.region === 0) expect(view.day).toBeGreaterThan(3);
      const row = gamble[0];
      expect(row.reason).toBe('Might be nothing. Might be something.');
      const place = view.places.find((p) => p.id === row.place)!;
      expect(place.rumour).toBeNull();
      expect(place.state).not.toBe('closed');
      expect(place.finds.some((find) => !find.found && find.today)).toBe(true);
      const forecast = view.forecast(plan(row.person, row.place, row.activity));
      expect(forecast.problem).toBeNull();
      expect(['unlikely', 'even']).toContain(forecast.chance);
      // A pip means a find is possible for this very outing today: the gamble is never empty.
      expect(forecast.pips).toBeGreaterThan(0);
    } });
    for (let day = 0; day < 16 && a.state.voyage !== 'ended'; day++) bot.playDay();
  }
  expect(gambles).toBeGreaterThan(0);
});

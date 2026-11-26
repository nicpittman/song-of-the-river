import { FREE_OPENING } from './places/freeplay';
import { expect, it } from 'vitest';
import { newAdventure } from './state';
import { OPENING, catchWords, fitsStory, meetingWords, meetingTiming, SESERAGI_LEAD, timberWords, wayWords } from './narrative';
import { PLACES } from './content';
import { newExpedition, plan, playToMorning } from './testing';
import { buildTags } from './view';

it('keeps the opening poem in a new mountain journey, and gives Free Play its own', () => {
  expect(newAdventure().notes).toContainEqual({ id: 1, day: 1, text: OPENING });
  expect(newAdventure().nextId).toBe(2);
  expect(newAdventure(true).notes).toEqual([{ id: 1, day: 1, text: FREE_OPENING }]);
  expect(newAdventure(false, true).notes).toEqual([]);
});

it('lets Sora and Ren talk about the sea during the actual first meeting', () => {
  const { a } = newExpedition(2086, true);
  expect(a.assign(plan('sora', 'fuchi', 'explore')).ok).toBe(true);
  a.begin();
  const outing = a.state.outings[0]!;
  expect(outing.bundles).toContainEqual({ kind: 'find', find: 'ren-meeting' });
  const first = outing.legs.find((leg) => leg.kind === 'beat')!;
  const words: string[] = [];
  const identities = new Set<string>();
  for (let t = first.start + .1; t < outing.legs.filter(leg => leg.kind === 'beat').at(-1)!.end; t += .1) {
    a.state.elapsed = t;
    words.push(...buildTags(a).filter((tag) => tag.id.startsWith('meeting-')).map((tag) => tag.text));
    for (const tag of buildTags(a).filter((tag) => tag.id.startsWith('meeting-'))) identities.add(tag.id);
  }
  expect(words.some((text) => text.startsWith('Sora:') && text.includes('sea'))).toBe(true);
  expect(words.some((text) => text.startsWith('Ren:') && text.includes('salt'))).toBe(true);
  expect(words.some((text) => text.startsWith('Ren:') && text.includes('Someone has to cook'))).toBe(true);
  expect(words.some(text => text.startsWith('Sora:') && text.includes('Thank you'))).toBe(true);
  expect(words.some(text => text.startsWith('Ren:') && text.includes('Seseragi'))).toBe(true);
  expect(identities.size).toBe(6);
});

it('gives short replies and longer lines different reading time without extending a visit', () => {
  const words = meetingWords('ren', 'sora')!;
  for (const available of [6, 12, 24]) {
    const timing = meetingTiming(words, available);
    expect(timing.lines.at(-1)!.end).toBeLessThanOrEqual(available + 1e-8);
    const short = timing.lines.find(line => line.text.includes('Thank you'))!;
    const joke = timing.lines.find(line => line.text.includes('pinch of salt'))!;
    expect((joke.end - joke.start) / timing.rate).toBeGreaterThan((short.end - short.start) / timing.rate);
    expect(timing.lines.at(-1)!.end / timing.rate).toBeGreaterThan(12);
    expect(timing.lines.at(-1)!.end / timing.rate).toBeLessThan(19);
  }
});

it('lets Ren recognise the miller, while a stranger asks about the road', () => {
  expect(meetingWords('miller', 'ren')![0]!.text).toContain('Still turning');
  expect(meetingWords('miller', 'sora')![0]!.text).toContain('road south');
  expect(meetingWords('mina', 'ren')![0]!.text).toContain('salt');
});

it('remembers both sides of the introduction and leads to the visible village without naming Mina', () => {
  const { a, sim } = newExpedition(2086, true);
  a.assign(plan('sora','fuchi','explore')); playToMorning(sim);
  const remembered = a.view().journal.find(entry => entry.id === 'ren-meeting')!.conversation!;
  expect(remembered.map(line => line.speaker)).toEqual(['Sora','Ren','Sora','Ren','Sora','Ren']);
  expect(a.state.history[0]!.tomorrow).toBe(SESERAGI_LEAD);
  expect(a.state.history[0]!.tomorrow).not.toMatch(/Mina|herbs|botanist/);
});


it('saves Ren’s salt for the bar and gives Mina a concrete herb return', () => {
  expect(catchWords('ren', 'fish', 0)).toContain('No salt yet');
  expect(catchWords('ren', 'fish', 1)).toContain('Still fresh water');
  expect(catchWords('ren', 'fish', 2, 'estuary')).toContain('smells of the sea');
  expect(catchWords('ren', 'fish', 2, 'creek')).toContain('Brackish');
  expect(catchWords('mina', 'forage', 0)).toContain('herbs');
  expect(catchWords('sora', 'explore', 0)).toBeNull();
});

it('lets simple projects start early, while Aki teaches complex construction', () => {
  const { a } = newExpedition(); a.state.materials = 20;
  expect(a.buildingProblem('platform')).toBeNull();
  expect(a.buildingProblem('shelter')).toBeNull();
  expect(a.buildingProblem('bridge')).toContain('carpenter');
  a.state.discoveries['aki-meeting'] = { day: 1, by: 'sora' };
  expect(a.buildingProblem('bridge')).toBeNull();
});

it('gives the friends their own words in the middle reaches, not only in the mountains', () => {
  const own = (region: number) => PLACES.filter((p) => p.region === region).flatMap((p) => p.learn.filter((l) => l.person)).length;
  expect(own(1)).toBeGreaterThanOrEqual(10);
  expect(own(2)).toBeGreaterThanOrEqual(12);
  expect(catchWords('aki', 'forage', 1)).toMatch(/^“/);
  expect(timberWords('yui', 2)?.length).toBeGreaterThan(1);
  expect(wayWords('sora', 0)).toBeNull();
  expect(timberWords('sora', 0)).toBeNull();
});

it('keeps friends’ words to where the story stands: no unmet names, no boat before there is one to plan', () => {
  const s = newAdventure(true);
  s.region = 1;
  expect(fitsStory('“Aki will be pleased with these.”', s, 1)).toBe(s.people.some((p) => p.id === 'aki'));
  expect(fitsStory('“Wood for the boat!”', s, 1)).toBe(false);
  expect(fitsStory('“There’s a path on. I’ve lived here all my life and never knew.”', s, 1)).toBe(false);
  expect(fitsStory('“There’s a path on. I’ve lived here all my life and never knew.”', s, 2)).toBe(true);
  s.discoveries['boat-ledger'] = { day: 1, by: 'haru' };
  expect(fitsStory('“Wood for the boat!”', s, 1)).toBe(true);
});

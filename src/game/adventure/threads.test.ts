import { describe, expect, it } from 'vitest';
import { FINDS } from './content';
import { EXCHANGES } from './crossingLines';
import { HEARD_KEPT } from './crossings';
import { LANTERN_LIT, endingNotes } from './endingWords';
import { HULL_CARVING, dusk, hullText } from './evening';
import { aboardWords } from './finale';
import { meetingWords } from './narrative';
import { personDef } from './people';
import { restoreAdventure } from './restore';
import { newExpedition } from './testing';
import { REN_CONCEDES, STILL_TIME, THREADS, beatDue, beatsOf, keepHeard, threadAboard, threadDone, threadItems } from './threads';
import type { AdventureState } from './state';
import type { UnpackItem } from './model';

/** One evening's thread beat, if any, as threadItems would add it. */
function evening(s: AdventureState, options: Parameters<typeof threadItems>[2] = {}): UnpackItem | null {
  const items: UnpackItem[] = [];
  threadItems(s, (item) => items.push({ ...item, id: `t${items.length}` }), options);
  expect(items.length).toBeLessThanOrEqual(1);
  return items[0] ?? null;
}
const said = (s: AdventureState): string[] => s.heard.filter((id) => EXCHANGES.find((e) => e.id === id)?.thread);
const join = (s: AdventureState, id: string): void => { s.people.push({ id, base: s.region, practice: {}, memories: [] }); };

describe('friends’ running threads', () => {
  it('has three threads of three beats, each beat between the same two friends, in Journey only', () => {
    for (const thread of THREADS) {
      const beats = beatsOf(thread);
      expect(beats.map((b) => b.thread!.beat), thread).toEqual([0, 1, 2]);
      const pair = new Set([...beats[0]!.a!, ...beats[0]!.b!]);
      for (const b of beats) {
        expect(b.free, b.id).toBe(false);
        expect(new Set([...b.a!, ...b.b!]), b.id).toEqual(pair);
        for (const [, text] of b.lines) expect(text, b.id).not.toMatch(/—|\bfriends?\b/i);
      }
    }
    expect(THREADS.some((t) => beatsOf(t).some((b) => b.a!.includes('sora') || b.b!.includes('sora')))).toBe(true);
  });

  it('tells each beat only after the one before it, a beat an evening, as the river goes down', () => {
    const { a } = newExpedition();
    const s = a.state;
    expect(evening(s)!.text).toContain('Fish keep a person going');
    expect(evening(s)!.text).toContain('Not yet.');
    // Seseragi has had its say; the next beats wait for Mio.
    expect(evening(s)).toBeNull();
    s.region = 1;
    expect(evening(s)!.title).toBe('Mina and Ren, at supper');
    expect(evening(s)!.text).toContain('Your boots are wet to the knee');
    s.region = 2;
    expect(evening(s)!.text).toContain('There’s seaweed');
    const last = evening(s)!;
    expect(last.text).toContain('It counts double');
    expect(last.hint).toBe('story');
    expect(said(s)).toEqual(['not-my-fish', 'not-yet', 'best-stew', 'wet-boots', 'seaweed', 'sea-counts']);
    expect(threadDone(s, 'fish-or-plants') && threadDone(s, 'falling-in')).toBe(true);
    expect(evening(s)).toBeNull();
  });

  it('never runs a later beat before an earlier one, nor the same beat twice', () => {
    const { a } = newExpedition();
    const s = a.state;
    s.region = 2;
    const [first, second, third] = beatsOf('fish-or-plants');
    expect(beatDue(s, first!)).toBe(true);
    expect(beatDue(s, second!)).toBe(false);
    expect(beatDue(s, third!)).toBe(false);
    s.heard.push(first!.id);
    expect(beatDue(s, first!)).toBe(false);
    expect(beatDue(s, second!)).toBe(true);
  });

  it('waits for another evening when a thread had its beat on the road today', () => {
    const { a } = newExpedition();
    const s = a.state;
    s.heard.push('not-my-fish');
    s.region = 1;
    expect(evening(s, { talked: ['not-my-fish'] })!.text).toContain('Not yet.');
    expect(said(s)).not.toContain('best-stew');
  });

  it('keeps arrival evenings, the voyage and Wander clear of threads', () => {
    const { a } = newExpedition();
    expect(evening(a.state, { arrived: true })).toBeNull();
    a.state.voyage = 'sailing';
    expect(evening(a.state)).toBeNull();
    const wander = newExpedition().a.state;
    wander.free = true;
    expect(evening(wander)).toBeNull();
    expect(threadDone({ ...wander, heard: EXCHANGES.map((e) => e.id) }, 'falling-in')).toBe(false);
  });

  it('remembers said beats for good, while ordinary words are forgotten after a while', () => {
    const ordinary = EXCHANGES.filter((e) => !e.thread).map((e) => e.id).slice(0, HEARD_KEPT + 5);
    const kept = keepHeard(['not-yet', ...ordinary, 'not-my-fish'], HEARD_KEPT);
    expect(kept).toContain('not-yet');
    expect(kept).toContain('not-my-fish');
    expect(kept.filter((id) => !['not-yet', 'not-my-fish'].includes(id))).toEqual(ordinary.slice(-HEARD_KEPT));
    const { a } = newExpedition();
    a.state.heard = kept;
    expect(restoreAdventure(JSON.parse(JSON.stringify(a.state))).heard).toEqual(kept);
  });

  it('lets Aki doubt Yui until her sail turns out to be Grandfather’s', () => {
    const { a } = newExpedition();
    const s = a.state;
    s.region = 2;
    s.heard.push('not-my-fish', 'best-stew', 'seaweed', 'not-yet', 'wet-boots', 'sea-counts');
    join(s, 'aki');
    // Met at the landing, not yet one of us: she still tells her stories by our fire.
    expect(evening(s)).toBeNull();
    s.discoveries['yui-meeting'] = { day: 1, by: 'sora' };
    expect(evening(s)!.text).toContain('A heron once carried a baby');
    expect(evening(s)!.text).toContain('Seven feet tall');
    // The mark is only found once the sail is unfolded: tonight, as Yui brings it, counts.
    expect(evening(s)).toBeNull();
    const payoff = evening(s, { tonight: new Set(['mended-sail']), quiet: true })!;
    expect(payoff.title).toBe('Aki and Yui, at supper');
    expect(payoff.text).toContain('It’s Grandfather’s');
    expect(payoff.text).toContain('I was very small');
    expect(payoff.hint).toBe('story');
  });

  it('pays off aboard and under the ending', () => {
    const { a } = newExpedition();
    const s = a.state;
    expect(threadAboard(s, 'ren')).toBeNull();
    expect(endingNotes(s)).not.toContain(STILL_TIME);
    s.heard.push(...beatsOf('fish-or-plants').map((b) => b.id), ...beatsOf('falling-in').map((b) => b.id));
    expect(threadAboard(s, 'ren')).toBe(REN_CONCEDES);
    s.voyage = 'gathering';
    s.companions = ['sora', 'ren', 'mina'];
    s.farewell = s.companions.map((person, i) => ({ person, points: [], seconds: 2 + i }));
    expect(aboardWords(s).find((w) => w.person === 'ren')!.line).toBe(`Ren: ${REN_CONCEDES}`);
    expect(endingNotes(s)).toContain(STILL_TIME);
  });
});

describe('Grandfather’s boat', () => {
  it('is heard of in Seseragi, before anyone has met Aki', () => {
    expect(FINDS.find((f) => f.id === 'seseragi-welcome')!.text).toMatch(/carpenter from Mio.*sail a real one to the sea/);
  });

  it('was built in Mio from lines learned at Funaya, and never went up the river', () => {
    const moulds = FINDS.find((f) => f.id === 'boatyard-moulds')!.text;
    expect(moulds).toContain('went home up the river to build');
    expect(moulds).not.toMatch(/took her up the river/);
    expect(meetingWords('boatyard-moulds', 'sora')!.map((l) => l.text).join(' ')).not.toMatch(/went up the river from here/);
    expect(FINDS.find((f) => f.id === 'boat-ledger')!.text).toContain('one more seat, far too small for a grown man');
  });

  it('comes down from the reeds with Grandfather’s reason cut under the little seat, found in the reeds or not', () => {
    for (const foundBefore of [false, true]) {
      const { a } = newExpedition();
      const s = a.state;
      s.region = 2;
      s.day = 9;
      join(s, 'aki');
      if (foundBefore) s.discoveries['old-boat'] = { day: 4, by: 'aki' };
      s.buildings.push({ id: 100, kind: 'boat', region: 2, x: 1820, y: 5920, work: 0, placed: 9 });
      const hull = dusk(a.world()).items.find((i) => i.title === 'Grandfather’s boat')!;
      expect(hull.person).toBe('aki');
      expect(hull.text).toContain(HULL_CARVING);
      expect(hull.text).toContain('“I was the boy.”');
      expect(hull.kind).toBe(foundBefore ? 'nothing' : 'find');
    }
    expect(hullText(true)).not.toContain('make her ready');
  });

  it('pays off as Aki steps aboard, and with Grandfather’s lantern lit in Mio', () => {
    expect(HULL_CARVING).toContain('when he can row');
    expect(personDef('aki').aboard).toContain('I can row. Cast off.');
    const { a } = newExpedition();
    expect(endingNotes(a.state)).toContain(LANTERN_LIT);
    a.state.free = true;
    expect(endingNotes(a.state)).not.toContain(LANTERN_LIT);
  });
});

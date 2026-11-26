import { describe, expect, it } from 'vitest';
import { PlaytestBot } from './bot';
import { LEADS, PLACES, placeDef } from './content';
import { goalLine } from './progression';
import { structureDef } from './structures';
import { newExpedition, plan, runUntil } from './testing';
import type { UnpackItem } from './model';
import { choreNote } from './evening';

it('never says the sea preparations are complete while a sail or tide reading is missing', () => {
  const { a } = newExpedition();
  a.state.region = 2; a.state.provisions = 20;
  a.state.known.push('kawagiri');
  a.state.discoveries['boat-ledger'] = { day: 1, by: 'sora' };
  a.state.buildings.push({ id: 100, kind: 'boat', region: 2, x: 1820, y: 5920, work: 3, placed: 1 });
  expect(choreNote(a.world())).toContain('need a sail');
  expect(a.canSail).toBe(false);
  a.state.discoveries['loft-sail'] = { day: 1, by: 'sora' };
  expect(choreNote(a.world())).toContain('read the tide');
  expect(a.canSail).toBe(false);
  a.state.discoveries['tide-marks'] = { day: 1, by: 'sora' };
  expect(choreNote(a.world())).toBe('Everything is packed for the sea.');
  expect(a.canSail).toBe(true);
});

const RANK = { plain: 0, unusual: 1, rare: 2, story: 3 } as const;
const FILLER = /Nobody has been|expires|stays on the map|^Pack |Camp −|Finish the /;

describe('the evening rules', () => {
  it('folds a meeting and a joining into one story, set down last', () => {
    const { sim, a } = newExpedition();
    a.state.region = 2;
    for (const person of a.state.people) person.base = 2;
    a.state.known.push('kawagiri'); a.state.buildings.push({id:1,kind:'dock',region:2,x:1800,y:5800,work:2,placed:1}); a.state.known.push('takayuka');
    a.assign(plan('sora', 'takayuka', 'visit')); a.begin();
    runUntil(sim, () => a.state.phase === 'evening');
    const items = a.state.evening!.items;
    expect(items.filter((i) => i.title.includes('Yui'))).toHaveLength(1);
    expect(items.find(item => item.sketch === 'yui-meeting')).toMatchObject({ hint: 'story', outcome: 'Yui joins us.' });
    expect(items.at(-1)).toMatchObject({ sketch: 'mended-sail', hint: 'story' });
  });

  it('keeps one supplies bundle per person, and one line for a group move', () => {
    const { sim, a } = newExpedition();
    a.assign(plan('sora', 'kamimori', 'forage'));
    a.begin();
    runUntil(sim, () => a.state.phase === 'evening');
    const supplies = a.state.evening!.items.filter((i) => i.kind === 'supplies' || i.kind === 'materials');
    const people = supplies.map((i) => i.person);
    expect(new Set(people).size).toBe(people.length);
    for (const item of supplies) expect(item.title).toMatch(/^\d+ (provision|material)/);
    expect(a.state.evening!.items.some((i) => i.title.startsWith('Based in'))).toBe(false);
  });

  it('always ends on a named place and a reason, never on chores or filler, over a whole journey', () => {
    for (const seed of [3]) {
      const { a } = newExpedition(seed);
      const bot = new PlaytestBot(a, seed);
      const seen: Array<{ day: number; items: UnpackItem[]; tomorrow: string }> = [];
      for (let i = 0; i < 40 && a.state.voyage !== 'ended'; i++) {
        bot.playDay();
        const day = a.state.history[0];
        if (day?.items) seen.push({ day: day.day, items: day.items, tomorrow: day.tomorrow ?? '' });
      }
      expect(seen.length).toBeGreaterThan(10);
      for (const { items, tomorrow } of seen) {
        const ranks = items.map((i) => RANK[i.hint]);
        expect(ranks).toEqual([...ranks].sort((x, y) => x - y));
        expect(tomorrow, tomorrow).not.toMatch(FILLER);
        // Authored lead lines name their place on the map; every other closing line names it outright.
        expect(LEADS.some((l) => l.line === tomorrow) || PLACES.some((p) => tomorrow.includes(p.name)) || /Mio|Kawagiri|Seseragi|sea/.test(tomorrow), tomorrow).toBe(true);
        // A joining is told as "Aki comes along" (its outcome says "Aki joins us."), or folded into the meeting; never a second "joins" or "Based in" line.
        expect(items.filter((i) => / joins /.test(i.title) || i.title.startsWith('Based in'))).toHaveLength(0);
      }
    }
  });

  it('gives every place a teaser that names it', () => {
    for (const place of PLACES) {
      expect(place.teaser, place.id).toBeTruthy();
      expect(place.teaser!.includes(placeDef(place.id).name), place.id).toBe(true);
    }
  });

  it('does not call the boat ready while timber is short', () => {
    const { a } = newExpedition();
    a.state.region = 2;
    a.state.discoveries['boatyard-moulds'] = { day: 1, by: 'sora' };
    a.state.buildings.push({ id: 90, kind: 'dock', x: 600, y: 5200, region: 2, placed: 1, work: 3 });
    a.state.materials = structureDef('boat').cost - 1;
    expect(goalLine(a.state)).toBe('The dock is done. A little more timber, and we can start on her.');
    expect(goalLine(a.state)).not.toContain('Everything is ready');
  });

  it('says who brought timber in yesterday, and how much more the dock needs', () => {
    const { a } = newExpedition();
    a.state.region = 2;
    a.state.discoveries['boatyard-moulds'] = { day: 1, by: 'sora' };
    a.state.day = 5;
    a.state.known.push('kawagiri');
    a.state.materials = structureDef('dock').cost - 2;
    const item = (person: string, materials: number) => ({ id: person, person, kind: 'materials', hint: 'plain', title: '', text: '', sketch: null, provisions: 0, materials });
    a.state.history.unshift({ day: 4, provisions: 0, materials: 3, lines: [], standout: null, items: [item('ren', 2), item('mina', 0), item('aki', 1)] as never });
    expect(goalLine(a.state)).toBe('Ren and Aki brought in timber. A little more timber, and we can start on the dock.');
  });
});

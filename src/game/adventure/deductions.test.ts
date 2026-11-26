import { describe, expect, it } from 'vitest';
import { isOpen } from './conditions';
import { findDef, placeDef } from './content';
import { DEDUCTIONS, knows } from './deductions';
import type { ExpeditionAdventure } from './expedition';
import type { Activity } from './model';
import { NARROWS } from './structures';
import { newExpedition, plan } from './testing';
import { holds, todayOf } from './world';
import type { Conditions } from './catalogue';

interface Step { person: string; place: string; activity: Activity; when?: Conditions }
interface Deduction {
  name: string;
  region: number;
  /** The plain fact: what is noticed, and the words that say it. */
  notice: Step & { says: string };
  clue: string;
  /** Acting on it. */
  act: Step;
  find: string;
  /** The quiet acknowledgement at the fire. */
  ack: string;
  setup?: (a: ExpeditionAdventure) => void;
}

const WARM = { seasons: [0, 1, 2] };

const CASES: Deduction[] = [
  {
    name: 'butterbur on dry ground means a spring under the plums',
    region: 0,
    notice: { person: 'mina', place: 'kamimori', activity: 'forage', says: 'It only grows where water runs, even when the water’s under the ground' },
    clue: 'butterbur',
    act: { person: 'mina', place: 'umezono', activity: 'forage', when: WARM },
    find: 'hidden-spring',
    ack: 'I said there’d be water under it',
    setup: (a) => { a.state.known.push('umezono'); },
  },
  {
    name: 'coins dropped in the race come back when it runs dry',
    region: 0,
    notice: { person: 'sora', place: 'suisha', activity: 'visit', says: 'dropped coins into the race for luck' },
    clue: 'lucky-coins',
    act: { person: 'sora', place: 'suisha', activity: 'investigate', when: { levels: ['low'] } },
    find: 'mill-coin',
    ack: 'The dry race gave one back',
  },
  {
    name: 'bees drinking at the shallows fly home to a wild hive in the bamboo',
    region: 1,
    notice: { person: 'ren', place: 'ishigawara', activity: 'fish', says: 'towards the bamboo', when: { ...WARM, levels: ['middle', 'low'] } },
    clue: 'bee-line',
    act: { person: 'sora', place: 'takebayashi', activity: 'explore', when: WARM },
    find: 'wild-hive',
    ack: 'The bees knew the way all along',
    setup: (a) => { a.state.known.push('ishigawara', 'takebayashi'); },
  },
  {
    name: 'what the flood carries past the willows lands on the bar at low water',
    region: 1,
    notice: { person: 'ren', place: 'yanagi', activity: 'fish', says: 'carrying sticks and reeds down towards the bend', when: { levels: ['high'] } },
    clue: 'flood-drift',
    act: { person: 'mina', place: 'sugawara', activity: 'forage', when: { levels: ['low'] } },
    find: 'flood-treasure',
    ack: 'Washed down from the willows at Yanagi',
    setup: (a) => {
      a.state.known.push('yanagi', 'sugawara');
      a.state.buildings.push({ id: 101, kind: 'bridge', region: 1, ...NARROWS, work: 2, placed: 1 });
    },
  },
  {
    name: 'night herons fish when the light is grey',
    region: 2,
    notice: { person: 'sora', place: 'aonuma', activity: 'explore', says: 'only come down to fish when the light is grey' },
    clue: 'grey-light',
    act: { person: 'sora', place: 'aonuma', activity: 'explore', when: { weather: ['mist', 'rain'] } },
    find: 'mist-herons',
    ack: 'They think it’s evening',
    setup: (a) => { a.state.known.push('aonuma'); },
  },
];

function start(seed: number, c: Deduction): ExpeditionAdventure {
  const { a } = newExpedition(seed);
  a.state.region = c.region;
  for (const person of a.state.people) person.base = c.region;
  a.state.provisions = 30;
  c.setup?.(a);
  return a;
}

/** Jumps to the first morning from `from` on when this outing's place is open and its conditions hold. */
function goTo(a: ExpeditionAdventure, seed: number, step: Step, from: number): boolean {
  const place = placeDef(step.place);
  for (let day = from; day < from + 60; day++) {
    const today = todayOf(seed, day);
    if (!holds(step.when, today, a.state) || !isOpen(place, today, a.state)) continue;
    a.state.day = day;
    return true;
  }
  return false;
}

function go(a: ExpeditionAdventure, step: Step): void {
  expect(a.assign(plan(step.person, step.place, step.activity))).toEqual({ ok: true });
  a.runToMorning();
}

describe('deductions: something noticed, acted on, understood', () => {
  it('every worked-out find is one of these, and says nothing of mechanics', () => {
    expect(DEDUCTIONS.map((f) => f.id).sort()).toEqual(CASES.map((c) => c.find).sort());
    for (const find of DEDUCTIONS) {
      expect(find.rare, find.id).toBe(true);
      for (const words of [find.text, find.knowing!.line, find.hint]) {
        expect(words).not.toMatch(/—|unlock/i);
      }
    }
  });

  for (const c of CASES) {
    it(c.name, () => {
      for (const seed of [1, 7, 2086]) {
        const a = start(seed, c);
        expect(knows(a.state, c.clue)).toBe(false);
        expect(goTo(a, seed, c.notice, a.state.day)).toBe(true);
        go(a, c.notice);
        expect(knows(a.state, c.clue), `${seed}: ${c.clue} noticed`).toBe(true);
        expect(a.state.history[0]!.items!.find((item) => item.title === `At ${placeDef(c.notice.place).name}`)?.text).toContain(c.notice.says);

        expect(goTo(a, seed, c.act, a.state.day)).toBe(true);
        go(a, c.act);
        expect(a.state.discoveries[c.find], `${seed}: ${c.find} found`).toBeTruthy();
        const item = a.state.history[0]!.items!.find((i) => i.sketch === c.find)!;
        expect(item.outcome).toContain(c.ack);
      }
    });
  }

  it('without the observation, the same outing only rarely turns anything up, and nobody claims to have known', () => {
    let lucky = 0, tries = 0;
    for (const c of CASES) {
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const a = start(seed, c);
        if (!goTo(a, seed, c.act, a.state.day)) continue;
        tries++;
        go(a, c.act);
        if (!a.state.discoveries[c.find]) continue;
        lucky++;
        expect(a.state.history[0]!.items!.find((i) => i.sketch === c.find)!.outcome).toBeUndefined();
      }
    }
    expect(tries).toBeGreaterThan(20);
    expect(lucky / tries).toBeLessThan(0.3);
  });

  it('keeps the find’s own words in the journal, whoever found it', () => {
    expect(findDef('hidden-spring').text).toContain('butterbur');
    expect(findDef('wild-hive').text).toContain('bamboo');
  });
});

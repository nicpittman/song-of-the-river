import { describe, expect, it } from 'vitest';
import { dist } from '../core/math';
import { mulberry32 } from '../core/rng';
import { placeActivities, placeDef } from './content';
import { EXCHANGES } from './crossingLines';
import { HEARD_KEPT, crossingClock, crossingWords, scheduleCrossings } from './crossings';
import type { ExpeditionAdventure } from './expedition';
import { GLINT_LIFE, glintable, scheduleGlints } from './glints';
import { restoreAdventure } from './restore';
import { outingStop } from './trail';
import { stanceOf } from './scene';
import { SMALL_FINDS } from './smallFinds';
import { newExpedition, plan } from './testing';
import { buildTags } from './view';
import { PlaytestBot } from './bot';

/** A day begun with everyone sent somewhere different in the reach, at random but the same every run. */
function randomDay(seed: number, day: number, free = false): ExpeditionAdventure | null {
  const { a } = newExpedition(seed);
  a.state.day = day;
  if (free) a.state.free = true;
  const rng = mulberry32(seed * 100 + day);
  const known = a.state.known.filter((id) => placeDef(id).kind !== 'settlement' && placeDef(id).region === a.state.region);
  for (const p of a.state.people) {
    for (let k = 0; k < 6; k++) {
      const place = known[Math.floor(rng() * known.length)]!;
      const acts = placeActivities(placeDef(place), false);
      if (a.assign(plan(p.id, place, acts[Math.floor(rng() * acts.length)]!)).ok) break;
    }
  }
  return a.begin().ok ? a : null;
}

function days(free = false): ExpeditionAdventure[] {
  const out: ExpeditionAdventure[] = [];
  for (const seed of [1, 2, 3, 7, 42, 2086]) for (let day = 2; day <= 14; day++) {
    const a = randomDay(seed, day, free);
    if (a) out.push(a);
  }
  return out;
}

/** Every ordinary day of a whole Journey played by the bot, as it stood when the day began. */
function journeyDays(seed: number): ExpeditionAdventure[] {
  const { a } = newExpedition(seed, true);
  const begun: string[] = [];
  const begin = a.begin.bind(a);
  a.begin = () => {
    const answer = begin();
    if (answer.ok && a.state.phase === 'day' && !a.state.moving) begun.push(JSON.stringify(a.state));
    return answer;
  };
  const bot = new PlaytestBot(a, seed, () => {});
  for (let i = 0; i < 40 && a.state.voyage !== 'ended'; i++) bot.playDay();
  return begun.map((json) => {
    const { sim, a: day } = newExpedition(seed, true);
    sim.state.adventure = JSON.parse(json);
    return day;
  });
}

const all = [...days(), ...journeyDays(1), ...journeyDays(42)];
const withCrossing = all.filter((a) => a.state.crossings.length > 0);
const withGlint = all.filter((a) => a.state.glints.length > 0);

describe('paths crossing', () => {
  it('happens on some days, at most twice, between two friends both walking close by', () => {
    expect(withCrossing.length).toBeGreaterThan(all.length * 0.05);
    for (const a of all) expect(a.state.crossings.length).toBeLessThanOrEqual(2);
    for (const a of withCrossing) for (const c of a.state.crossings) {
      expect(c.a).not.toBe(c.b);
      const at = (id: string) => a.state.outings.find((o) => o.person === id)!.legs.find((l) => l.kind === 'walk' && c.at >= l.start && c.at < l.end);
      expect(at(c.a)).toBeTruthy();
      expect(at(c.b)).toBeTruthy();
      // They talk for a moment, between a second and a half and three.
      expect(c.to - c.from).toBeGreaterThanOrEqual(1.5);
      expect(c.to - c.from).toBeLessThanOrEqual(3);
      // Close enough to talk where they stand.
      a.state.elapsed = (c.from + c.to) / 2;
      expect(dist(stanceOf(a, c.a).at, stanceOf(a, c.b).at)).toBeLessThanOrEqual(92);
      const words = crossingWords(a.state, c)!;
      expect(words.lines.length).toBeGreaterThanOrEqual(2);
      expect(words.lines.length).toBeLessThanOrEqual(3);
    }
  });

  it('moves no leg: the moment is made up inside the stretch it borrows from', () => {
    for (const a of withCrossing) for (const c of a.state.crossings) for (const [i, person] of [c.a, c.b].entries()) {
      const [s0, s1] = c.spans[i]!;
      expect(crossingClock(a.state, person, s0 - 0.01).t).toBeCloseTo(s0 - 0.01, 6);
      expect(crossingClock(a.state, person, s1 + 0.01).t).toBeCloseTo(s1 + 0.01, 6);
      expect(crossingClock(a.state, person, s1 - 1e-4).t).toBeCloseTo(s1, 2);
      // The clock never runs backwards, and never too fast.
      let last = s0;
      for (let t = s0; t < s1; t += 0.05) {
        const clock = crossingClock(a.state, person, t);
        expect(clock.t).toBeGreaterThanOrEqual(last - 1e-9);
        last = clock.t;
        expect(!!clock.talking).toBe(t >= c.from && t < c.to);
      }
    }
    // Scheduling reads the legs and leaves them as they were.
    const a = withCrossing[0]!;
    const before = JSON.stringify(a.state.outings);
    scheduleCrossings(a.world());
    expect(JSON.stringify(a.state.outings)).toBe(before);
  });

  it('keeps clear of forks, first meetings, creatures showing and the moving day', () => {
    for (const a of withCrossing) for (const c of a.state.crossings) {
      for (const outing of a.state.outings) for (const leg of outing.legs) if (leg.fork) expect(c.to <= leg.start - 1 || c.from >= leg.end + 1).toBe(true);
      for (const x of a.state.sightings) if (dist(x.at, stanceOf(a, c.a).at) < 600) expect(c.to <= x.appear - 1 || c.from >= x.appear + x.life + 1).toBe(true);
    }
    const { a } = newExpedition(7, true);
    a.state.moving = true;
    expect(scheduleCrossings(a.world())).toEqual([]);
    // Never two bound for the same place, and never by either one's home fire.
    for (const day of withCrossing) for (const c of day.state.crossings) {
      const [x, y] = [c.a, c.b].map((id) => day.state.outings.find((o) => o.person === id)!);
      expect(outingStop(x!, c.at).place).not.toBe(outingStop(y!, c.at).place);
      day.state.elapsed = c.from;
      for (const o of [x!, y!]) expect(dist(stanceOf(day, o.person).at, o.legs[0]!.points![0]!)).toBeGreaterThan(200);
    }
  });

  it('shows as one conversation card, speaker by speaker, at a reading pace', () => {
    const a = withCrossing[0]!;
    const c = a.state.crossings[0]!;
    const words = crossingWords(a.state, c)!;
    const seen: string[] = [];
    for (const line of words.lines) {
      a.state.elapsed = (line.start + line.end) / 2;
      const tag = buildTags(a).find((t) => t.id.startsWith(`meeting-${c.a}-with${c.b}`))!;
      expect(tag.person).toBe(line.speaker);
      expect(tag.readingRate).toBeLessThan(1);
      seen.push(tag.text);
    }
    expect(new Set(seen.map((t) => t.split(':')[0])).size).toBe(2);
    a.state.elapsed = c.to + 0.1;
    expect(buildTags(a).some((t) => t.id.includes(`with${c.b}`))).toBe(false);
  });

  it('never repeats words within several days', () => {
    const a = withCrossing[0]!;
    const heard: string[] = [];
    for (let i = 0; i < 8; i++) for (const c of scheduleCrossings(a.world())) heard.push(c.exchange);
    for (let i = 0; i < heard.length; i++) expect(heard.slice(Math.max(0, i - HEARD_KEPT + 1), i)).not.toContain(heard[i]);
    // Thread beats are kept for good (see threads.ts); ordinary words only for a while.
    expect(a.state.heard.filter((id) => !EXCHANGES.find((e) => e.id === id)?.thread).length).toBeLessThanOrEqual(HEARD_KEPT);
  });

  it('names nobody not yet met, and keeps Wander’s words to Wander', () => {
    expect(EXCHANGES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(EXCHANGES.map((e) => e.id)).size).toBe(EXCHANGES.length);
    for (const who of ['haru', 'yui', 'aki']) expect(EXCHANGES.some((e) => e.a?.includes(who) || e.b?.includes(who))).toBe(true);
    for (const a of withCrossing) for (const c of a.state.crossings) {
      const words = crossingWords(a.state, c)!;
      for (const line of words.lines) for (const name of ['Sora', 'Ren', 'Mina', 'Aki', 'Haru', 'Yui']) {
        if (line.text.includes(name)) expect(a.state.people.some((p) => p.id === name.toLowerCase())).toBe(true);
      }
      expect(EXCHANGES.find((e) => e.id === c.exchange)!.free).not.toBe(true);
    }
  });
});

describe('glints', () => {
  it('come rarely: about one day in two or three, at most one a day, never on the moving day', () => {
    expect(withGlint.length).toBeGreaterThan(all.length * 0.15);
    expect(withGlint.length).toBeLessThan(all.length * 0.7);
    for (const a of all) expect(a.state.glints.length).toBeLessThanOrEqual(1);
    const { a } = newExpedition(7, true);
    a.state.moving = true;
    a.state.day = 5;
    expect(scheduleGlints(a.world())).toEqual([]);
  });

  it('show by a friend out for the day, clear of crossings, the same way every time', () => {
    for (const a of withGlint) {
      const g = a.state.glints[0]!;
      expect(g.life).toBe(GLINT_LIFE);
      a.state.elapsed = g.appear + 1.5;
      expect(dist(stanceOf(a, g.person).at, g.at)).toBeLessThan(140);
      for (const c of a.state.crossings) expect(g.appear + g.life <= c.from - 2 || g.appear >= c.to + 2).toBe(true);
      expect(scheduleGlints(a.world())).toEqual(a.state.glints);
    }
  });

  it('go into the journal once, with a quiet confirmation, and are not found again', () => {
    const a = withGlint[0]!;
    const g = a.state.glints[0]!;
    a.state.elapsed = g.appear - 0.5;
    expect(a.command({ type: 'notice', glint: g.id }).ok).toBe(false);
    a.state.elapsed = g.appear + 1;
    const caption = buildTags(a).find((t) => t.id === g.id)!;
    expect(caption.hint).toBe('tap to look');
    expect(a.command({ type: 'notice', glint: g.id }).ok).toBe(true);
    expect(a.state.smallFinds[g.find]).toMatchObject({ day: a.state.day, person: g.person });
    expect(buildTags(a).find((t) => t.id === `${g.id}-sketched`)!.text).toMatch(/^Noted: /);
    const noted = { ...a.state.smallFinds };
    expect(a.command({ type: 'notice', glint: g.id }).ok).toBe(true);
    expect(a.state.smallFinds).toEqual(noted);
    expect(glintable(a.world(), g.at)).not.toContain(g.find);
    expect(a.view().smallFinds.found.map((f) => f.id)).toEqual([g.find]);
    // Once one has been looked at, the next needs no hint.
    a.state.glints = [{ ...g, id: 'glint-x', found: false }];
    a.state.elapsed = g.appear + 1;
    expect(buildTags(a).find((t) => t.id === 'glint-x')!.hint).toBeUndefined();
  });

  it('fade when left alone', () => {
    const a = withGlint[0]!;
    const g = a.state.glints[0]!;
    a.state.elapsed = g.appear + g.life + 0.1;
    expect(a.command({ type: 'notice', glint: g.id }).ok).toBe(false);
    expect(a.scene().glints).toEqual([]);
  });

  it('come a little oftener in Wander', () => {
    const glinting = (list: ExpeditionAdventure[]): number => list.filter((a) => a.state.glints.length).length;
    expect(glinting(days(true))).toBeGreaterThan(glinting(days()));
  });

  it('have at least thirty things to find, across every reach and season', () => {
    expect(SMALL_FINDS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(SMALL_FINDS.map((f) => f.id)).size).toBe(SMALL_FINDS.length);
    for (const region of [0, 1, 2]) for (const season of [0, 1, 2, 3]) {
      expect(SMALL_FINDS.filter((f) => f.regions.includes(region) && (!f.when?.seasons || f.when.seasons.includes(season))).length).toBeGreaterThanOrEqual(5);
    }
  });
});

describe('saving a day with crossings and glints', () => {
  it('round-trips mid-day, and keeps what was found and heard', () => {
    const a = withCrossing.find((x) => x.state.glints.length) ?? withCrossing[0]!;
    const g = a.state.glints[0];
    if (g) { a.state.elapsed = g.appear + 1; a.command({ type: 'notice', glint: g.id }); }
    a.state.elapsed = a.state.crossings[0]!.from + 0.3;
    const saved = JSON.parse(JSON.stringify(a.state));
    const back = restoreAdventure(saved);
    expect(back.crossings).toEqual(a.state.crossings);
    expect(back.glints).toEqual(a.state.glints);
    expect(back.smallFinds).toEqual(a.state.smallFinds);
    expect(back.heard).toEqual(a.state.heard);
    // A crossing that would bend the clock backwards is dropped, not trusted.
    const broken = JSON.parse(JSON.stringify(a.state));
    broken.crossings[0].spans[0] = [broken.crossings[0].from + 0.1, broken.crossings[0].to];
    expect(restoreAdventure(broken).crossings.length).toBe(a.state.crossings.length - 1);
  });
});

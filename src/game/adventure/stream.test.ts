import { describe, expect, it } from 'vitest';
import { adventureValley } from '../world/boards/adventure';
import { PlaytestBot } from './bot';
import { openGround } from './conditions';
import { WalkingMap } from './navigation';
import { readyToMove } from './progression';
import { valleyRiver } from './regions';
import { STREAM_CROSSING, furumichiReport, streamCrossable, streamCrossingLine, streamFlooded, streamFrozen } from './stream';
import { structureDef } from './structures';
import { newExpedition } from './testing';
import { todayOf } from './world';

const SEED = 2086;
/** Furumichi, above the stream, and the road on towards Mio below it. */
const above = { x: 700, y: 2400 };
const below = { x: 650, y: 2740 };

type Expedition = ReturnType<typeof newExpedition>['a'];

/** A walk across the stream on this day, or null. */
function walkAcross(a: Expedition, day: number, from = above, to = below) {
  const nav = new WalkingMap(adventureValley, valleyRiver());
  nav.setOpenGround(openGround(adventureValley, todayOf(SEED, day), a.state));
  return nav.route(from, to, 4500);
}

/** The morning the group is packed for Mio, with the way known. */
function packed(day: number): Expedition {
  const { a } = newExpedition(SEED);
  a.state.discoveries.waymark = { day: 1, by: 'sora' };
  a.state.provisions = 20; a.state.materials = 10; a.state.day = day;
  return a;
}

describe('the stream below Seseragi', () => {
  it('reports the crossing honestly in a traveller’s recap as water, ice and stonework change', () => {
    const { a } = newExpedition(SEED);
    a.state.day = 5;
    expect(furumichiReport(a.state, 'low')).toContain('shallow enough to wade');
    expect(furumichiReport(a.state, 'high')).toContain('river is high, but');
    expect(furumichiReport(a.state, 'low')).toContain('south, over the stream and into the mist');
    a.state.day = 7;
    expect(furumichiReport(a.state, 'high')).toContain('cannot cross today');
    a.state.day = 8;
    expect(furumichiReport(a.state, 'middle')).toContain('drop tomorrow');
    a.state.day = 10;
    expect(furumichiReport(a.state, 'low')).toContain('over the ice');
    a.state.day = 7;
    a.state.buildings.push({ id: 900, kind: 'stones', region: 0, ...STREAM_CROSSING, work: 100, placed: 1 });
    expect(furumichiReport(a.state, 'high')).toContain('stepping stones keep the road open');
    expect(furumichiReport(a.state, 'high')).not.toContain('cannot cross');
  });
  it('describes the current Furumichi crossing using the same flooding, ice and stone rules as travel', () => {
    const { a } = newExpedition();
    a.state.known.push('furumichi');
    for (const [day, words] of [[5, 'shallow enough to wade'], [7, 'crossing is closed for a day or two'], [8, 'until tomorrow'], [10, 'stream is frozen']] as const) {
      a.state.day = day;
      expect(a.view().places.find(p => p.id === 'furumichi')!.stateLine).toContain(words);
      expect(streamCrossable(a.state)).toBe(![7, 8].includes(day));
    }
    a.state.day = 7;
    a.state.buildings.push({ id: 99, kind: 'stones', region: 0, ...STREAM_CROSSING, work: 0, placed: 1 });
    expect(streamCrossable(a.state)).toBe(true);
    expect(streamCrossingLine(a.state)).toContain('stepping stones keep the crossing open');
  });
  it('floods for two days at the start of spring and of autumn, and never in the opening spring', () => {
    const flooded = Array.from({ length: 24 }, (_, i) => i + 1).filter(streamFlooded);
    expect(flooded).toEqual([7, 8, 13, 14, 19, 20]);
    expect(streamFrozen(22)).toBe(true);
    expect(streamFrozen(16)).toBe(false);
  });

  it('has no stones of its own', () => {
    expect(adventureValley.fords.some((f) => Math.hypot(f.x - STREAM_CROSSING.x, f.y - STREAM_CROSSING.y) < 200)).toBe(false);
  });

  it('is shut in the spring melt and the autumn rains without stones', () => {
    const { a } = newExpedition(SEED);
    for (const day of [13, 14, 19, 20]) {
      expect(streamCrossable(a.state, day)).toBe(false);
      expect(walkAcross(a, day), `day ${day}`).toBeNull();
    }
  });

  it('can be waded in summer at low water, and in the rest of spring and autumn', () => {
    const { a } = newExpedition(SEED);
    expect(todayOf(SEED, 17).level).toBe('low');
    for (const day of [15, 17, 21]) expect(walkAcross(a, day), `day ${day}`).not.toBeNull();
  });

  it('freezes in winter, and can be walked anywhere along it', () => {
    const { a } = newExpedition(SEED);
    // Across the marsh pool, well away from the road's crossing.
    const pool = [{ x: 330, y: 2380 }, { x: 330, y: 2660 }] as const;
    const summer = walkAcross(a, 17, ...pool)!;
    const winter = walkAcross(a, 22, ...pool)!;
    expect(winter).not.toBeNull();
    expect(winter.length).toBeLessThan(summer.length);
    expect(Math.max(...winter.map((p) => p.x))).toBeLessThan(600);
  });

  it('stays open at middle and low water once stepping stones are set across it', () => {
    const a = packed(13);
    expect(a.buildingProblem('stones')).toBeNull();
    expect(a.place('stones', STREAM_CROSSING)).toEqual({ ok: true });
    expect(a.state.materials).toBe(10 - structureDef('stones').cost);
    for (const day of [13, 14, 19, 20]) {
      expect(streamCrossable(a.state, day)).toBe(true);
      expect(walkAcross(a, day), `day ${day}`).not.toBeNull();
    }
  });

  it('takes stones only at the road’s crossing, and only once someone has seen the stream', () => {
    const { a } = newExpedition(SEED);
    a.state.materials = 10;
    a.state.known = a.state.known.filter((id) => id !== 'furumichi');
    expect(a.buildingProblem('stones')).toBe('Follow the old road south to the stream first.');
    a.state.known.push('furumichi');
    expect(a.buildingProblem('stones')).toBeNull();
    expect(a.siteProblem('stones', { x: 520, y: 2000 })).toBe('The stones belong where the old road meets the stream, below Furumichi.');
    expect(a.siteProblem('stones', STREAM_CROSSING)).toBeNull();
  });

  it('refuses the move to Mio while the stream is up, in plain words, and allows it when it drops', () => {
    const a = packed(19);
    expect(readyToMove(a.state)).toBe(false);
    const refused = a.moveEveryone('mio');
    expect(refused).toEqual({ ok: false, reason: 'The stream below Seseragi is running high with the rains. It should drop in a day or two, or we could set stepping stones across.' });
    expect(a.view().goal.startsWith(refused.ok ? '' : refused.reason)).toBe(true);
    a.state.day = 21;
    expect(a.moveEveryone('mio')).toEqual({ ok: true });
  });

  it('warns the day before the flood, and says when it will drop', () => {
    const { a } = newExpedition(SEED);
    a.state.day = 18;
    expect(a.view().river.line).toBe('The autumn rains are coming. The stream below Seseragi will be up tomorrow, for a couple of days.');
    a.state.day = 19;
    expect(a.view().river.line).toBe('The stream below Seseragi is up with the rains. It should drop in a day or two.');
    a.state.day = 20;
    expect(a.view().river.line).toBe('The stream below Seseragi is still up. It should be down by tomorrow.');
  });

  it('says the stream once on a flooded morning: the story line carries it, the river line keeps to the river', () => {
    const a = packed(12);
    for (const p of a.state.people) a.rest(p.id);
    expect(a.begin().ok).toBe(true);
    a.runToMorning();
    expect(a.state.day).toBe(13);
    expect(a.view().goal).toContain('stream below Seseragi');
    expect(a.state.morning?.river).toBeTruthy();
    expect(a.state.morning?.river ?? '').not.toContain('stream');
  });

  it('lets the bot reach the sea when it meets the flood on the way out', () => {
    // Seed 1 is packed for Mio on the first day of the autumn rains.
    const { a } = newExpedition(1, true);
    const actions: string[] = [];
    const bot = new PlaytestBot(a, 1, (line) => actions.push(line));
    for (let i = 0; i < 60 && a.state.voyage !== 'ended'; i++) bot.playDay();
    expect(a.state.voyage).toBe('ended');
    expect(a.state.day).toBeLessThanOrEqual(26);
  });
});

it('offers something worth seeing near home while the stream holds the story up', async () => {
  const { newExpedition } = await import('./testing');
  const { streamFlooded } = await import('./river');
  const { packedToMove } = await import('./progression');
  let checked = 0;
  for (let seed = 1; seed < 30 && !checked; seed++) {
    const { a } = newExpedition(seed);
    const day = [7, 8, 19, 20].find((d) => streamFlooded(d))!;
    a.state.day = day;
    a.state.known.push('seseragi', 'furumichi');
    a.state.discoveries['waymark'] = { day: 1, by: 'sora' };
    a.state.provisions = 30; a.state.materials = 30;
    if (!packedToMove(a.state)) continue;
    const goal = a.view().goal;
    if (goal.includes('While we wait:')) checked++;
  }
  expect(checked).toBe(1);
});

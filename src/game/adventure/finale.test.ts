import { expect, it } from 'vitest';
import { VOYAGE_SECONDS } from './calendar';
import { aboardReading, aboardWords, AT_THE_BAR, gatheringSeconds, SORA_AT_SEA, voyageCaption, voyageLines, voyageStops, WANDER_SAIL, wanderLines } from './finale';
import { newAdventure } from './state';
import { endingWords } from './endingWords';

it('names the actual lone sailor in the ending', () => {
  const s = newAdventure(true);
  s.companions = ['ren'];
  expect(endingWords(s)).toMatch(/^Ren turns to a clean page/);
});

it('presents one ordered voyage beat at a time, with at least five and a half seconds to read each', () => {
  const s = newAdventure(false, true);
  s.voyage = 'sailing'; s.companions = s.people.map(person => person.id);
  const beats: Array<{ line: string | null; reach: string | null; duration: number }> = [];
  for (let tick = 0; tick < VOYAGE_SECONDS * 10; tick++) {
    s.voyageTime = tick / 10;
    const caption = voyageCaption(s)!;
    expect(caption).not.toBeNull();
    const last = beats.at(-1);
    if (last?.line === caption.line) {
      expect(caption.reach).toBe(last.reach);
      last.duration += .1;
    } else beats.push({ ...caption, duration: .1 });
  }
  expect(beats.map(beat => beat.line)).toEqual([
    'The rope falls loose. The shore begins to slip behind.', ...voyageLines(s),
  ]);
  expect(beats.map(beat => beat.reach)).toEqual([null, 'Seseragi', 'Mio', 'Kawagiri', 'The sea', 'The sea']);
  expect(beats.every(beat => beat.duration > 5.4)).toBe(true);
  expect(beats.at(-1)!.line).toBe(SORA_AT_SEA);
  expect(beats.at(-1)!.duration).toBeCloseTo(VOYAGE_SECONDS - AT_THE_BAR);
  expect(voyageLines(s)[0]).not.toContain('Day 3');
});

it('lets each boarding reply finish before the next speaker, keeps the landing short, then holds before casting off', () => {
  const s = newAdventure(false, true);
  s.voyage = 'gathering';
  s.farewell = s.people.map((person, i) => ({ person: person.id, points: [], seconds: 2 + (i % 3) }));
  const words = aboardWords(s);
  const seen: string[] = [];
  for (let tick = 0; tick < gatheringSeconds(s) * 10; tick++) {
    s.voyageTime = tick / 10;
    const line = voyageCaption(s)?.line;
    if (line && seen.at(-1) !== line) seen.push(line);
  }
  expect(seen).toEqual(words.map(word => word.line));
  for (let i = 1; i < words.length; i++) expect(words[i].at - words[i - 1].at).toBeGreaterThanOrEqual(aboardReading(words[i - 1].line));
  expect(gatheringSeconds(s) - words.at(-1)!.at).toBeGreaterThan(aboardReading(words.at(-1)!.line));
  // Never more than four words at the landing, and the whole gathering well under half a minute.
  expect(words.length).toBeLessThanOrEqual(4);
  expect(gatheringSeconds(s)).toBeLessThan(30);
});

it('keeps the camera timeline ordered and follows the boat through the extended sea reply', () => {
  const s = newAdventure(false, true);
  s.buildings.push({ id: 1, kind: 'boat', x: 1820, y: 5940, region: 2, work: 3, placed: 1 });
  const stops = voyageStops(s, true);
  expect(stops.every((stop, i) => !i || stop.t >= stops[i - 1].t)).toBe(true);
  expect(stops.at(-1)!.t).toBe(VOYAGE_SECONDS);
  expect(stops.some(stop => stop.t > AT_THE_BAR && stop.t < VOYAGE_SECONDS)).toBe(true);
});

it('glides down the river without stopping at each point, and moves up the valley only behind the cut', async () => {
  const { voyageCamera, voyageCutCover, VOYAGE_CUT } = await import('./finale');
  const s = newAdventure(false, true);
  s.buildings.push({ id: 1, kind: 'boat', x: 1820, y: 5940, region: 2, work: 3, placed: 1 });
  const stops = voyageStops(s, true);
  const step = 1 / 60;
  let slowest = Infinity;
  for (let t = step; t < VOYAGE_SECONDS; t += step) {
    const a = voyageCamera(stops, t - step), b = voyageCamera(stops, t);
    const moved = Math.hypot(b.at.x - a.at.x, b.at.y - a.at.y);
    if (Math.abs(t - VOYAGE_CUT) < step * 1.5) { expect(voyageCutCover(t)).toBeGreaterThan(0.9); continue; }
    // Never a leap: under about 40 world units a frame anywhere else in the voyage.
    expect(moved, `at ${t.toFixed(2)}s`).toBeLessThan(40);
    // Mid-river (well clear of the cut and the end) the view keeps moving.
    if (t > 9 && t < VOYAGE_SECONDS - 4) slowest = Math.min(slowest, moved);
  }
  expect(slowest).toBeGreaterThan(0.05);
});

it('gives a Wander sail its own few words: Haru on the water, never the Journey’s', () => {
  const s = newAdventure(true);
  s.buildings.push({ id: 1, kind: 'boat', x: 1820, y: 5940, region: 2, work: 3, placed: 1 });
  s.voyage = 'sailing'; s.companions = ['haru', 'yui'];
  const lines = new Set<string>();
  for (let tick = 0; tick < WANDER_SAIL * 10; tick++) {
    s.voyageTime = tick / 10;
    const line = voyageCaption(s)?.line;
    if (line) lines.add(line);
  }
  expect([...lines]).toEqual(['We push off from the bank.', ...wanderLines(s)]);
  expect([...lines].some((l) => l.startsWith('Haru:'))).toBe(true);
  expect([...lines].join(' ')).not.toMatch(/first bend|Sora/);
  // Later sails find other words.
  const first = wanderLines(s);
  s.sailed = true;
  expect(wanderLines(s)).not.toEqual(first);
  const stops = voyageStops(s, false);
  expect(stops.at(-1)!.t).toBe(WANDER_SAIL);
  expect(stops.every((stop) => stop.at.y > 5000)).toBe(true);
});

import { expect, it, vi } from 'vitest';
import { newExpedition, plan, playToMorning, runUntil } from './testing';
import { buildTags } from './view';
import { newMembers } from './progression';
import { NARROWS, structureDef } from './structures';
import { Simulation } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';
import { AdventureSession } from '../adventureSession';
import { DAY_PLAY_SECONDS, DAY_SECONDS } from './calendar';
import { meetingTiming, meetingWords } from './narrative';

it('meets Mina naturally on settling in Seseragi, with one welcome, and her mint kept for a later day', () => {
  const { a, sim } = newExpedition(2086, true);
  a.assign(plan('sora', 'fuchi', 'explore')); playToMorning(sim);
  expect(a.state.people.map((p) => p.id)).toEqual(['sora', 'ren']);
  expect(a.moveEveryone('seseragi')).toEqual({ ok: true });
  a.begin();
  runUntil(sim, () => buildTags(a).some((tag) => tag.id.startsWith('meeting-') && tag.id.includes('-mina-')));
  expect(buildTags(a).some((tag) => tag.id.startsWith('meeting-') && tag.id.includes('-mina-'))).toBe(true);
  const saved = new Simulation(adventureValley, structuredClone(sim.state));
  playToMorning(sim); playToMorning(saved);
  expect(saved.expedition!.state).toEqual(a.state);
  expect(a.state.people.map((p) => p.id)).toEqual(['sora', 'ren', 'mina']);
  expect(a.state.people.every((p) => p.lodging === undefined)).toBe(true);
  for (const id of ['seseragi-welcome', 'mina-meeting']) {
    expect(a.state.discoveries[id]).toBeDefined();
    expect(a.state.history[0]!.items!.filter((item) => item.sketch === id)).toHaveLength(1);
  }
  // Her mint is a memory of meeting her, so it waits for a later day in the woods.
  expect(a.state.discoveries['wild-mint']).toBeUndefined();
});

it('has a real miller reply during the visit and keeps the exchange in the journal', () => {
  const { a, sim } = newExpedition();
  a.assign(plan('sora', 'suisha', 'visit')); a.begin();
  const beat = a.state.outings[0]!.legs.find((leg) => leg.kind === 'beat')!;
  const duration = a.state.outings[0]!.legs.filter(leg => leg.kind === 'beat').reduce((sum, leg) => sum + leg.end - leg.start, 0);
  const reply = meetingTiming(meetingWords('miller','sora')!, duration).lines[1]!;
  a.state.elapsed = beat.start + (reply.start + reply.end) / 2;
  expect(buildTags(a).some((tag) => tag.text.startsWith('Miller:') && tag.text.includes('Furumichi'))).toBe(true);
  expect(a.scene().figures.find((f) => f.id === 'miller')?.pose).toBe('talk');
  playToMorning(sim);
  expect(a.view().journal.find((entry) => entry.id === 'miller')?.conversation?.map((line) => line.speaker)).toEqual(['Sora', 'Miller', 'Sora', 'Miller', 'Sora', 'Miller']);
  expect(a.state.known).toContain('furumichi');
});

it('lets either promised village project free Aki to join, using the actual Mio crossing', () => {
  const { a } = newExpedition();
  a.state.region = 1; a.state.discoveries['aki-meeting'] = { day: 1, by: 'sora' };
  const bridge = { id: 90, kind: 'bridge' as const, ...NARROWS, region: 1, work: structureDef('bridge').work, placed: 1 };
  a.state.buildings.push(bridge);
  expect(newMembers(a.state)).toContain('aki');
  bridge.y = 430;
  expect(newMembers(a.state)).not.toContain('aki');
});

function sessionHarness() {
  const { a, sim } = newExpedition();
  const advance = vi.fn();
  const frameOn = vi.fn();
  // The notebook stands open, so no stretch counts as quiet: these tests measure the usual pace (quiet stretches: see `quietPace.test.ts`).
  const session = Object.assign(Object.create(AdventureSession.prototype), {
    host: { paused: false, speed: 4, reducedMotion: false, ui: { updateTags: vi.fn(), notebookOpen: () => true }, app: { screen: { width: 390, height: 844 } } },
    sim: { expedition: a, advance }, view: { adventure: { sync: vi.fn() }, camera: { taken: 0, ease: vi.fn() }, travel: vi.fn() },
    input: { placing: null }, dirty: false, sinceRefresh: -Infinity, screenTags: () => [], frameOn,
  }) as AdventureSession;
  return { a, sim, session, advance, frameOn };
}

it('keeps first conversations at reading pace, then resumes the selected travel speed', () => {
  const { a, session, advance } = sessionHarness();
  // The established-group fixture has no first Ren encounter; the miller is still new.
  a.assign(plan('sora', 'suisha', 'visit')); a.begin();
  const beat = a.state.outings[0]!.legs.find((leg) => leg.kind === 'beat')!;
  a.state.elapsed = beat.start + .1;
  session.frame(.1);
  expect(advance.mock.lastCall![0]).toBeCloseTo(.1 * buildTags(a).find(tag => tag.id.startsWith('meeting-'))!.readingRate!);
  a.state.elapsed = 0;
  session.frame(.1);
  expect(advance.mock.lastCall![0]).toBeCloseTo(.4 * DAY_SECONDS / DAY_PLAY_SECONDS);
});

it.each([1, 2, 4] as const)('plays ordinary daylight in thirty real seconds at 1×, respecting %i× speed', speed => {
  const { a, session, advance } = sessionHarness();
  const host = (session as unknown as { host: { speed: number } }).host;
  host.speed = speed;
  a.rest('sora'); a.rest('ren'); a.rest('mina'); a.begin();
  // One real frame carries the same established fraction of walking and work time.
  session.frame(.1);
  expect(advance.mock.lastCall![0]).toBeCloseTo(.1 * speed * DAY_SECONDS / 30);
});

it('keeps the morning, paused time and chapter arrivals out of the faster daylight rate', () => {
  const { a, session, advance } = sessionHarness();
  const host = (session as unknown as { host: { speed: number; paused: boolean } }).host;
  host.speed = 1;
  session.frame(.1);
  expect(advance).toHaveBeenLastCalledWith(.1);
  host.paused = true;
  advance.mockClear(); session.frame(.1);
  expect(advance).not.toHaveBeenCalled();
  host.paused = false;
  a.state.day = 4; a.state.provisions = 6; a.state.materials = 2;
  a.state.discoveries.waymark = { day: 3, by: 'sora' };
  expect(a.travel().ok).toBe(true);
  session.frame(.1);
  expect(advance).toHaveBeenLastCalledWith(.1);
});

it('leaves the free camera alone during the group’s travelling day', () => {
  const { a, session, frameOn } = sessionHarness();
  a.state.day = 4; a.state.provisions = 6; a.state.materials = 2;
  a.state.discoveries.waymark = { day: 3, by: 'sora' };
  expect(a.travel()).toEqual({ ok: true });
  session.frame(.1);
  expect(frameOn).not.toHaveBeenCalled();
  // The view walks down with the group in a gentle, interruptible glide, and gives way for good once the player takes the camera.
  const view = (session as unknown as { view: { camera: { taken: number; ease: ReturnType<typeof vi.fn> }; travel: ReturnType<typeof vi.fn> } }).view;
  expect(view.travel).toHaveBeenLastCalledWith(expect.objectContaining({ to: 4800 }), expect.any(Number));
  expect(view.camera.ease).toHaveBeenCalled();
  view.camera.ease.mockClear();
  view.camera.taken++;
  session.frame(.1);
  expect(view.camera.ease).not.toHaveBeenCalled();
});

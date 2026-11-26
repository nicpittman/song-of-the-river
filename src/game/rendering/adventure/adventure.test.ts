import { describe, expect, it } from 'vitest';
import { Container, Texture } from 'pixi.js';
import type { AdventureScene, SceneFigure } from '../../adventure/model';
import type { ArtLibrary } from '../art';
import type { Camera } from '../camera';
import type { SceneryLayer } from '../sceneryLayer';
import type { BoardDef } from '../../world/types';
import { AdventureLayer } from './adventureLayer';
import { gradeAt, newGrade } from './grade';
import { type Box, type LabelItem, layoutLabels } from './labelLayout';
import { ActionClock, Follower } from './motion';
import { IdleBusiness, actionFrame, newShown, strideFrame } from './poseTimeline';
import { finishedArt, stageOf } from './structures';

describe('label layout', () => {
  const item = (x: number, y: number, priority: number): LabelItem => ({ x, y, w: 80, h: 14, priority, wanted: true, slot: -1, left: 0, top: 0 });
  const overlap = (a: LabelItem, b: LabelItem): boolean => a.left < b.left + b.w && a.left + a.w > b.left && a.top < b.top + b.h && a.top + a.h > b.top;

  it('never lets two shown names overlap, however crowded', () => {
    const items = Array.from({ length: 14 }, (_, i) => item(100 + (i % 4) * 30, 100 + Math.floor(i / 4) * 12, i));
    layoutLabels(items, [], 6, [], [], []);
    const shown = items.filter((i) => i.slot >= 0);
    expect(shown.length).toBeGreaterThan(0);
    for (const a of shown) for (const b of shown) if (a !== b) expect(overlap(a, b)).toBe(false);
  });

  it('keeps names off figures and gives the most important name the first choice', () => {
    const figure: Box = { left: 60, top: 106, right: 140, bottom: 160 };
    const items = [item(100, 100, 1), item(100, 104, 50)];
    layoutLabels(items, [figure], 6, [], [], []);
    expect(items[1]!.slot).toBeGreaterThanOrEqual(0);
    for (const i of items.filter((i) => i.slot >= 0)) expect(i.left < figure.right && i.left + i.w > figure.left && i.top < figure.bottom && i.top + i.h > figure.top).toBe(false);
  });
});

describe('the colour of the hour', () => {
  it('is neutral at midday, dark blue but not black at night, and never jumps', () => {
    const g = newGrade();
    gradeAt(12, g);
    expect(g.mul).toEqual([1, 1, 1]);
    gradeAt(23, g);
    expect(g.night).toBe(1);
    expect(g.mul[2]).toBeGreaterThan(g.mul[0]);
    expect(Math.min(...g.mul)).toBeGreaterThan(0.25);
    const prev = newGrade();
    for (let h = 0; h < 24; h += 0.02) {
      gradeAt(h, prev);
      gradeAt(h + 0.02, g);
      for (let c = 0; c < 3; c++) expect(Math.abs(g.mul[c]! - prev.mul[c]!)).toBeLessThan(0.02);
    }
  });
});

describe('easing between snapshots', () => {
  it('glides at an even pace instead of hopping, and snaps only across the map', () => {
    const f = new Follower();
    f.target(0, 0);
    const steps: number[] = [];
    for (let i = 1; i <= 20; i++) {
      f.target(i * 3, 0);
      for (let k = 0; k < 6; k++) steps.push(f.step(1 / 60));
    }
    const later = steps.slice(30);
    expect(Math.max(...later)).toBeLessThan(1.2);
    expect(Math.min(...later)).toBeGreaterThan(0.1);
    f.target(5000, 0);
    expect(f.jumped).toBe(true);
  });

  it('runs an action on its own when the rules leave it still', () => {
    const clock = new ActionClock();
    const start = clock.value;
    for (let i = 0; i < 30; i++) clock.step(0.2, 1 / 60, 2);
    expect(clock.value).not.toBe(start);
  });
});

describe('poses', () => {
  it('walks frame by frame with the distance covered', () => {
    const frames = Array.from({ length: 16 }, (_, i) => strideFrame(i * 3.75, 'walk'));
    expect(new Set(frames).size).toBe(8);
  });

  it('casts, waits and strikes through a fishing action', () => {
    const shown = newShown();
    const cues: string[] = [];
    for (let p = 0; p < 1; p += 0.01) {
      actionFrame('fish', p, 0, 1, shown);
      cues.push(shown.cue);
    }
    expect(cues).toContain('cast');
    expect(cues).toContain('strike');
  });

  it('never leaves an idle figure still, and keeps its business close to its spot', () => {
    const business = new IdleBusiness(1234);
    const shown = newShown();
    const seen = new Set<string>();
    let furthest = 0;
    for (let i = 0; i < 60 * 60; i++) {
      business.step(1 / 60, i / 60, false, false, shown);
      seen.add(`${shown.pose}-${shown.frame}`);
      furthest = Math.max(furthest, Math.abs(shown.offset));
    }
    expect(seen.size).toBeGreaterThan(3);
    expect(furthest).toBeLessThanOrEqual(15);
  });
});

describe('structures', () => {
  it('passes from a pegged site through three stages to finished', () => {
    expect([0, 0.2, 0.5, 0.9, 1].map(stageOf)).toEqual([-1, 0, 1, 2, 3]);
    expect(finishedArt('bridge', (id) => id === 'footbridge')).toBe('footbridge');
    expect(finishedArt('bridge', () => false)).toBe('wooden-footbridge');
  });
});

describe('the adventure layer', () => {
  const art = {
    get: (id: string) => ({ id, texture: Texture.WHITE, width: 40, height: 60, anchor: [0.5, 1], illustrated: false, foliage: 'none' }),
    has: () => false,
    known: () => true,
    frames: () => [],
    seasonal: () => Texture.WHITE,
  } as unknown as ArtLibrary;
  const scenery = { setLandmarkHidden: () => {}, setPeople: () => {}, reserveFocalView: () => {}, reserveBridgeDeck: () => {}, setGroup: () => {}, removeGroup: () => {} } as unknown as SceneryLayer;
  const board = { sprites: [], hearths: [] } as unknown as BoardDef;
  const camera = { x: 500, y: 500, zoom: 1, visible: (m: number) => ({ left: -m, top: -m, right: 1000 + m, bottom: 1000 + m }) } as unknown as Camera;
  const fig = (x: number): SceneFigure => ({ id: 'ren', role: 'friend', look: 'ren', at: { x, y: 500 }, facing: 1, pose: 'walk', action: 0, pack: 'rare', item: null, visible: true, selected: false });
  const scene = (x: number, sightings = false): AdventureScene => ({
    figures: [fig(x)],
    places: [],
    sightings: sightings ? [{ id: 'heron-1', species: 'heron', at: { x, y: 500 }, age: 3, life: 8, fresh: true }] : [],
    buildings: [{ id: 1, kind: 'shelter', at: { x: 700, y: 600 }, progress: 0.5, stage: 2 }],
    trails: [{ person: 'ren', points: [{ x: 300, y: 500 }, { x: 600, y: 500 }], progress: 0.5, planned: false }],
    fire: { x: 200, y: 520 },
    dusk: 0,
    hour: 10,
    boat: null,
    placing: null,
    settlements: [],
  });
  const make = (): AdventureLayer => new AdventureLayer(art, { ground: new Container(), water: new Container(), sorted: new Container() }, scenery, { board, river: null });

  it('eases a walker toward each new snapshot rather than teleporting', () => {
    const layer = make();
    layer.sync(scene(400), 1 / 60, camera);
    layer.sync(scene(430), 1 / 60, camera);
    const at = layer.friendAt('ren')!;
    expect(at.x).toBeGreaterThan(400);
    expect(at.x).toBeLessThan(430);
  });

  it('picks sightings before friends, and friends with a thumb-sized area', () => {
    const layer = make();
    for (let i = 0; i < 30; i++) layer.sync(scene(400, true), 1 / 60, camera);
    expect(layer.pick({ x: 400, y: 470 }, 1)).toEqual({ kind: 'sighting', id: 'heron-1' });
    for (let i = 0; i < 90; i++) layer.sync(scene(400), 1 / 60, camera);
    expect(layer.pick({ x: 420, y: 470 }, 1)).toEqual({ kind: 'friend', id: 'ren' });
    expect(layer.pick({ x: 700, y: 590 }, 1)).toEqual({ kind: 'building', id: 1 });
    expect(layer.pick({ x: 900, y: 900 }, 1)).toBeNull();
  });
});

describe('art', () => {
  it('has a painted stand-in for every explorer frame, pack, structure stage and planting the layer asks for', async () => {
    const { hasPlaceholder } = await import('../fallbackArt');
    const { EXPLORER_IDS, FRAME_COUNT, explorerFrameId } = await import('../placeholders/explorerRig');
    const { STRUCTURE_LOOKS } = await import('./structures');
    for (const who of EXPLORER_IDS) for (const [pose, n] of Object.entries(FRAME_COUNT)) for (let i = 0; i < n; i++) expect(hasPlaceholder(explorerFrameId(who, pose as never, i)), `${who} ${pose} ${i}`).toBe(true);
    for (const id of ['pack-plain', 'pack-unusual', 'pack-rare', 'footprint', 'worn-earth', 'willow-sapling', 'blossom-sapling', 'reed-planting', 'woodpile', 'embers', 'window-glow']) expect(hasPlaceholder(id), id).toBe(true);
    for (const [kind, look] of Object.entries(STRUCTURE_LOOKS)) {
      expect(hasPlaceholder(`${kind}-site`), kind).toBe(true);
      for (let i = 0; i < 3; i++) expect(hasPlaceholder(`${look.stages}-${i}`), kind).toBe(true);
    }
  });

  it('both authored watermills keep their paddles in the river, including the Mio mill', async () => {
    const manifest = (await import('../../../../public/art/manifest.json')).default as unknown as { assets: Record<string, { logical: [number, number]; attachments?: Record<string, { offset: [number, number]; diameter?: number }> }> };
    const { millWheelSpeed } = await import('../../world/millFlow');
    const { Simulation, newGameState } = await import('../../simulation/simulation');
    const { adventureValley } = await import('../../world/boards/adventure');
    const sim = new Simulation(adventureValley, newGameState(adventureValley, 'free'));
    const old = manifest.assets.watermill!;
    const body = manifest.assets['mill-body']!;
    const attachment = body.attachments!.wheel!;
    const mills = adventureValley.sprites.filter((s) => s.asset === 'watermill');
    expect(mills).toHaveLength(2);
    for (const mill of mills) {
      const scale = ((mill.scale ?? 1) * old.logical[0]) / body.logical[0];
      const paddle = { x: mill.x + attachment.offset[0] * scale, y: mill.y + attachment.offset[1] * scale + attachment.diameter! * 0.5 * scale };
      expect(millWheelSpeed(sim.river, paddle, 1), `mill at ${mill.x},${mill.y}`).toBeGreaterThan(0);
    }
  });
});

describe('wardrobe', () => {
  it('keeps each illustrated villager’s identity when walking, turning and talking', async () => {
    const { Wardrobe } = await import('./wardrobe');
    const { explorerFor } = await import('./rigTable');
    const { villagerTexture } = await import('./clothes');
    const manifest = (await import('../../../../public/art/manifest.json')).default;
    const art = { has: (id: string) => id in manifest.assets } as unknown as ArtLibrary;
    for (const who of ['villager-woman', 'villager-elder', 'villager-farmer']) {
      expect(explorerFor(who)).toBe(who);
      const wardrobe = new Wardrobe(who, art, true);
      expect(wardrobe.outfit('walk').ids).toEqual([0, 1, 2, 3].map((n) => `${who}-walk-${n}`));
      expect(wardrobe.turn?.ids).toEqual([`${who}-turn-0`]);
      expect(wardrobe.outfit('talk').ids).toEqual([`${who}-idle-0`]);
      expect(wardrobe.outfit('sit').painted).toBe(false);
      // Preserve their painted cloth, rather than tinting their own illustration as the generic man.
      expect(villagerTexture(Texture.EMPTY, who)).toBe(Texture.EMPTY);
    }
  });

  it('wears illustrated frames where they exist and painted ones only where nothing illustrated serves', async () => {
    const { Wardrobe } = await import('./wardrobe');
    const real = new Set(['sora-walk-0', 'sora-walk-1', 'sora-walk-2', 'sora-walk-3', 'sora-idle-0', 'sora-look-0', 'sora-look-1', 'sora-look-2', 'sora-look-3']);
    const art = { has: (id: string) => real.has(id) } as unknown as ArtLibrary;
    const sora = new Wardrobe('sora', art, false);
    expect(sora.outfit('walk')).toMatchObject({ painted: false, ids: ['sora-walk-0', 'sora-walk-1', 'sora-walk-2', 'sora-walk-3'] });
    expect(sora.outfit('carry').painted).toBe(false);
    expect(sora.outfit('talk').ids).toEqual(['sora-idle-0']);
    expect(sora.outfit('fish')).toMatchObject({ painted: false, rod: true });
    expect(sora.outfit('sit')).toMatchObject({ painted: false, ids: ['sora-idle-0'] });
    const villager = new Wardrobe('villager-a', art, true);
    expect(villager.outfit('walk')).toMatchObject({ painted: true, scale: 0.78 });
  });
});

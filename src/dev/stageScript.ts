/**
 * A scripted day in Seseragi for the demo stage (`stage.html`): plain
 * `AdventureScene` snapshots built from a clock, with no expedition rules.
 *
 *   0-8 s     morning at camp; three outings planned as dotted trails
 *   8-58 s    Sora, Ren and Mina set off along winding trails; each tries
 *             every pose at the far end; packs show what they carry; Aki
 *             builds a shelter from a pegged site to finished; Yui keeps camp
 *   34-75 s   sightings: a fresh salmon in the pool (sketched), a fox in the
 *             meadow (already known), a kingfisher on the planted willow
 *   58-84 s   home along the same trails, laden, in the golden hour
 *   78-92 s   dusk; all five by the fire
 *   92-114 s  night passes, then a rose dawn
 *   114-134 s the boat goes down the river with three aboard
 */

import type { AdventureScene, PackHint, Pose, SceneFigure, ScenePlace, SceneSighting, SceneTrail } from '../game/adventure/model';
import type { Vec } from '../game/core/math';
import { Polyline, smoothCurve } from '../game/world/geometry';
import { seat } from '../game/adventure/motion';
import { campOf } from '../game/adventure/regions';

export const LENGTH = 134;

/** Seseragi's hearth and the seats round it, from the same geography the rules use. */
const FIRE: Vec = campOf(0).fire;
const WALK = 30;
const at = (dx: number, dy: number): Vec => ({ x: FIRE.x + dx, y: FIRE.y + dy });

/** Where each friend potters at camp by day, and sits by the fire in the evening. */
const HOME: Record<string, Vec> = {
  sora: at(-40, 30),
  ren: at(46, 34),
  mina: at(-70, 52),
  aki: at(10, 58),
  yui: at(90, 44),
};
const FIRESIDE: Record<string, Vec> = Object.fromEntries(['sora', 'ren', 'mina', 'aki', 'yui', 'haru'].map((id, i) => [id, seat(FIRE, i)]));

interface Outing {
  person: string;
  /** Control points from camp to the place; smoothed and given a little wander. */
  control: Vec[];
  leave: number;
  /** Order of poses tried at the far end. */
  poses: Pose[];
  pack: PackHint;
  line?: Polyline;
}

const POSES: Pose[] = ['look', 'talk', 'fish', 'forage', 'build', 'sit', 'wave', 'idle'];
const SPELL = 3.3;
const RETURN = 58;

const OUTINGS: Outing[] = [
  { person: 'sora', control: [HOME.sora!, at(30, -20), { x: 372, y: 1905 }, { x: 430, y: 1840 }, { x: 540, y: 1760 }, { x: 630, y: 1600 }, { x: 700, y: 1450 }, { x: 742, y: 1362 }], leave: 8, poses: POSES, pack: 'unusual' },
  { person: 'ren', control: [HOME.ren!, { x: 470, y: 2090 }, { x: 590, y: 2056 }, { x: 640, y: 2030 }, { x: 640, y: 1992 }], leave: 9, poses: ['fish', 'fish', 'fish', 'look', 'talk', 'forage', 'build', 'sit', 'wave', 'idle'], pack: 'rare' },
  { person: 'mina', control: [HOME.mina!, { x: 190, y: 2060 }, { x: 118, y: 2000 }, { x: 100, y: 1880 }, { x: 128, y: 1770 }, { x: 160, y: 1702 }], leave: 10.5, poses: ['forage', 'forage', ...POSES.filter((p) => p !== 'forage')], pack: 'plain' },
];

for (const o of OUTINGS) {
  // A gentle wander so the trail winds rather than ruling straight lines.
  const points = smoothCurve(o.control, 8).map((p, i, all) => {
    const k = Math.sin((i / all.length) * Math.PI);
    return { x: p.x + Math.sin(i * 0.35) * 6 * k, y: p.y + Math.cos(i * 0.27) * 4 * k };
  });
  o.line = new Polyline(points);
}

const PLACES: Array<Omit<ScenePlace, 'selected'>> = [
  { id: 'seseragi', name: 'Seseragi', at: { x: 452, y: 1872 }, state: 'open', lead: false, rumour: false, kind: 'settlement' },
  { id: 'fuchi', name: 'Fuchi pool', at: { x: 780, y: 1905 }, state: 'open', lead: false, rumour: false, kind: 'place' },
  { id: 'mill', name: 'The old mill', at: { x: 860, y: 1800 }, state: 'open', lead: false, rumour: false, kind: 'minor' },
  { id: 'stone', name: 'The mossy stone', at: { x: 764, y: 1330 }, state: 'open', lead: false, rumour: false, kind: 'place' },
  { id: 'meadow', name: 'The fern meadow', at: { x: 160, y: 1690 }, state: 'open', lead: false, rumour: false, kind: 'place' },
  { id: 'orchard', name: 'The orchard rows', at: { x: 410, y: 1450 }, state: 'open', lead: false, rumour: false, kind: 'minor' },
  { id: 'shrine', name: 'The blossom shrine', at: { x: 1300, y: 1440 }, state: 'special', lead: false, rumour: false, kind: 'place' },
  { id: 'path', name: 'The stone path', at: { x: 1000, y: 1560 }, state: 'open', lead: false, rumour: false, kind: 'minor' },
  { id: 'bend', name: 'The willow bend', at: { x: 1235, y: 1830 }, state: 'open', lead: true, rumour: false, kind: 'place' },
  { id: 'reeds', name: 'The reed beds', at: { x: 1300, y: 2160 }, state: 'closed', lead: false, rumour: false, kind: 'place' },
  { id: 'landing', name: 'The landing', at: { x: 735, y: 2060 }, state: 'open', lead: false, rumour: false, kind: 'minor' },
  { id: 'grove', name: 'Kamimori grove', at: { x: 470, y: 1000 }, state: 'open', lead: false, rumour: false, kind: 'place' },
  { id: 'falls', name: 'The falling pools', at: { x: 950, y: 880 }, state: 'closed', lead: false, rumour: false, kind: 'place' },
  { id: 'spring', name: 'The mountain spring', at: { x: 1030, y: 60 }, state: 'special', lead: false, rumour: false, kind: 'place' },
];

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const ramp = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));

/** Clock hour for the script: a short morning, the day, a golden afternoon, dusk, a quick night and dawn. */
export function hourAt(t: number): number {
  if (t < 8) return 7 + t * 0.05;
  if (t < 78) return 7.4 + ((t - 8) / 70) * 10.6;
  if (t < 92) return 18 + ((t - 78) / 14) * 2;
  if (t < 106) return (20 + ((t - 92) / 14) * 9) % 24;
  if (t < 114) return 5 + ((t - 106) / 8) * 2.6;
  return 9 + (t - 114) * 0.05;
}

function duskAt(t: number): number {
  if (t < 76) return 0;
  if (t < 90) return ramp(t, 76, 90);
  if (t < 100) return 1;
  return 1 - ramp(t, 100, 106);
}

function walker(id: string, from: Vec, to: Vec, start: number, t: number, pose: Pose, pack: PackHint | null): SceneFigure | null {
  const d = Math.hypot(to.x - from.x, to.y - from.y);
  const k = clamp01(((t - start) * WALK) / Math.max(1, d));
  if (t < start) return null;
  return figure(id, { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k }, to.x >= from.x ? 1 : -1, k < 1 ? pose : 'idle', pack);
}

function figure(id: string, at: Vec, facing: 1 | -1, pose: Pose, pack: PackHint | null, action = 0): SceneFigure {
  const villager = id.startsWith('villager');
  return { id, role: villager ? 'villager' : 'friend', look: villager ? `villager-${id.slice(-1)}` : id, at, facing, pose, action, pack, item: null, visible: true, selected: false };
}

/** The valley's other people about their day: a walk to the mill and back, a chat by the fence, someone resting. */
function villagers(t: number): SceneFigure[] {
  const out: SceneFigure[] = [];
  const there = (t % 40) < 20;
  const k = ((t % 20) / 20);
  const from: Vec = there ? { x: 300, y: 2110 } : { x: 700, y: 1880 };
  const to: Vec = there ? { x: 700, y: 1880 } : { x: 300, y: 2110 };
  const walking = k < 0.8;
  const p = walking ? { x: from.x + (to.x - from.x) * (k / 0.8), y: from.y + (to.y - from.y) * (k / 0.8) } : to;
  out.push(figure('villager-a', p, to.x > from.x ? 1 : -1, walking ? 'walk' : 'idle', null));
  out.push(figure('villager-b', { x: 520, y: 2112 }, 1, 'talk', null, (t * 0.3) % 1));
  out.push(figure('villager-c', { x: 556, y: 2116 }, -1, t % 30 < 18 ? 'talk' : 'idle', null, (t * 0.3) % 1));
  out.push(figure('villager-d', { x: 210, y: 1980 }, 1, t > 80 && t < 106 ? 'idle' : 'sit', null));
  return out;
}

/** One friend's outing at time `t`: the figure, and the trail while it matters. */
function outing(o: Outing, t: number): { fig: SceneFigure; trail: SceneTrail | null } {
  const line = o.line!;
  const there = o.leave + line.length / WALK;
  const back = RETURN + line.length / WALK;
  const pack = t > 45 ? o.pack : null;
  const trail = (progress: number, planned: boolean): SceneTrail => ({ person: o.person, points: line.points, progress, planned });
  if (t < o.leave) return { fig: figure(o.person, HOME[o.person]!, 1, 'idle', null), trail: trail(0, true) };
  if (t < there) {
    const p = line.at((t - o.leave) * WALK);
    return { fig: figure(o.person, p, Math.cos(p.angle) < 0 ? -1 : 1, 'walk', null), trail: trail((t - o.leave) * WALK / line.length, false) };
  }
  const end = line.points[line.points.length - 1]!;
  if (t < RETURN) {
    const spell = Math.floor((t - there) / SPELL);
    const pose = o.poses[spell % o.poses.length]!;
    const action = ((t - there) % SPELL) / SPELL;
    const facing: 1 | -1 = o.person === 'mina' ? -1 : 1;
    return { fig: figure(o.person, end, facing, pose, pack, pose === 'fish' ? ((t - there) / 9) % 1 : action), trail: null };
  }
  if (t < back) {
    const p = line.at(line.length - (t - RETURN) * WALK);
    return { fig: figure(o.person, p, Math.cos(p.angle) < 0 ? 1 : -1, 'carry', pack), trail: { person: o.person, points: [...line.points].reverse(), progress: (t - RETURN) * WALK / line.length, planned: false } };
  }
  // Home: walk over to the fire and sit as the light goes.
  const sitAt = FIRESIDE[o.person]!;
  const home = HOME[o.person]!;
  const sitting = t > 80;
  if (!sitting) return { fig: figure(o.person, home, home.x < FIRE.x ? 1 : -1, 'idle', pack), trail: null };
  const w = walker(o.person, home, sitAt, 80, t, 'walk', pack)!;
  if (w.pose === 'idle') {
    w.pose = 'sit';
    w.facing = sitAt.x < FIRE.x ? 1 : -1;
  }
  return { fig: w, trail: null };
}

function sighting(id: string, species: string, at: Vec, from: number, life: number, t: number, fresh: boolean, until = Infinity): SceneSighting | null {
  if (t < from || t > from + life || t > until) return null;
  return { id, species, at, age: t - from, life, fresh };
}

/**
 * The scene at script time `t` (seconds, wrapped to the script's length).
 * `heavy` adds sightings and buildings up to the load the layer must carry at
 * 60 fps (five friends, four sightings, eight buildings), for profiling.
 */
export function sceneAt(raw: number, heavy = false): AdventureScene {
  const t = ((raw % LENGTH) + LENGTH) % LENGTH;
  const figures: SceneFigure[] = [];
  const trails: SceneTrail[] = [];
  const voyage = t >= 114;
  for (const o of OUTINGS) {
    const { fig, trail } = outing(o, t);
    if (t < 8 && o.person === 'ren') fig.selected = true;
    fig.visible = !voyage;
    figures.push(fig);
    if (trail && !voyage) trails.push(trail);
  }
  // Aki builds the shelter, then comes to the fire.
  const site: Vec = { x: 600, y: 1700 };
  const akiAt: Vec = { x: 556, y: 1712 };
  const via: Vec = { x: 372, y: 1905 };
  const toVia = Math.hypot(via.x - HOME.aki!.x, via.y - HOME.aki!.y) / WALK;
  if (t < 6) figures.push(figure('aki', HOME.aki!, 1, 'idle', null));
  else if (t < 6 + toVia) figures.push(walker('aki', HOME.aki!, via, 6, t, 'walk', null)!);
  else if (t < 62) {
    const w = walker('aki', via, akiAt, 6 + toVia, t, 'walk', null)!;
    if (w.pose === 'idle') {
      w.pose = 'build';
      w.facing = 1;
      w.action = (t * 0.9) % 1;
    }
    figures.push(w);
  } else {
    const back = Math.hypot(via.x - akiAt.x, via.y - akiAt.y) / WALK;
    const w = t < 62 + back ? walker('aki', akiAt, via, 62, t, 'walk', null)! : walker('aki', via, FIRESIDE.aki!, 62 + back, t, 'walk', null)!;
    figures.push(w.pose === 'idle' ? figure('aki', FIRESIDE.aki!, 1, 'idle', null) : w);
  }
  // Yui keeps camp: talks with whoever is about, waves people off and home.
  const yuiPose: Pose = t > 84 ? 'sit' : t > 20 && t < 30 ? 'talk' : 'idle';
  figures.push(figure('yui', t > 84 ? FIRESIDE.yui! : HOME.yui!, t > 84 ? 1 : -1, yuiPose, null));
  // Haru follows tracks along the meadow edge, and comes to the fire at dusk.
  if (t < 82) figures.push(figure('haru', { x: 250, y: 1560 }, 1, t < 12 ? 'idle' : 'track', null, ((t - 12) / 5) % 1));
  else figures.push(walker('haru', { x: 250, y: 1560 }, FIRESIDE.haru!, 82, t, 'walk', null)!.pose === 'idle' ? figure('haru', FIRESIDE.haru!, FIRESIDE.haru!.x < FIRE.x ? 1 : -1, 'sit', null) : walker('haru', { x: 250, y: 1560 }, FIRESIDE.haru!, 82, t, 'walk', null)!);
  figures.push(...villagers(t));
  for (const fig of figures) if (voyage) fig.visible = false;

  const sightings = [
    sighting('salmon-1', 'salmon', { x: 868, y: 1968 }, 34, 9, t, true, 42.5),
    sighting('fox-1', 'fox', { x: 120, y: 1636 }, 40, 9, t, false),
    sighting('kingfisher-1', 'kingfisher', { x: 640, y: 1842 }, 64, 9, t, true),
  ].filter((s): s is SceneSighting => s !== null);
  if (heavy) {
    sightings.push({ id: 'heron-x', species: 'heron', at: { x: 760, y: 2140 }, age: (t % 20) + 1, life: 40, fresh: true });
    sightings.push({ id: 'deer-x', species: 'deer', at: { x: 260, y: 1560 }, age: (t % 20) + 1, life: 40, fresh: false });
    sightings.push({ id: 'duck-x', species: 'duck', at: { x: 980, y: 1940 }, age: (t % 20) + 1, life: 40, fresh: true });
    sightings.push({ id: 'butterfly-x', species: 'butterfly', at: { x: 200, y: 2100 }, age: (t % 20) + 1, life: 40, fresh: false });
  }


  return {
    figures,
    places: PLACES.map((p) => ({ ...p, selected: (p.id === 'fuchi' && t > 2 && t < 8) || (p.id === 'stone' && t > 30 && t < 36) })),
    sightings,
    buildings: [
      { id: 1, kind: 'shelter', at: site, progress: t < 8 ? 0 : ramp(t, 12, 58), stage: 2 },
      { id: 2, kind: 'garden', at: { x: 120, y: 2110 }, progress: 1, stage: 2 },
      // The willow Mina planted by the pool grows from a staked seedling over the day.
      { id: 9, kind: 'willow', at: { x: 640, y: 1842 }, progress: 1, stage: t < 30 ? 0 : t < 60 ? 1 : 2 },
      ...(heavy
        ? [
            { id: 3, kind: 'cottage' as const, at: { x: 200, y: 1500 }, progress: 0.5, stage: 2 as const },
            { id: 4, kind: 'lookout' as const, at: { x: 880, y: 1450 }, progress: 1, stage: 2 as const },
            { id: 5, kind: 'platform' as const, at: { x: 640, y: 2100 }, progress: 0.3, stage: 2 as const },
            { id: 6, kind: 'garden' as const, at: { x: 300, y: 2200 }, progress: 0.9, stage: 2 as const },
            { id: 7, kind: 'shelter' as const, at: { x: 1000, y: 1700 }, progress: 0.05, stage: 2 as const },
            { id: 8, kind: 'cottage' as const, at: { x: 120, y: 1820 }, progress: 1, stage: 2 as const },
          ]
        : []),
    ],
    trails,
    fire: FIRE,
    dusk: duskAt(t),
    hour: hourAt(t),
    boat: voyage ? { at: { x: 770 + ramp(t, 114, 134) * 80, y: 2110 + ramp(t, 114, 134) * 300 }, angle: 1.35, aboard: ['sora', 'ren', 'mina'] } : null,
    placing: null,
    settlements: [{ region: 0, stage: t > 100 ? 1 : 0, additions: t > 100 ? [{ kind: 'rack', at: { x: 470, y: 2110 } }] : [] }],
  };
}

/** A good camera for the demo: the camp and the three outings. */
export const CAMERA = { x: 440, y: 1880, zoom: 0.72 };

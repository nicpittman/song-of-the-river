/**
 * The valley's snapshot: who stands where doing what, the places, creatures,
 * buildings and trails, the hour and the dusk. Built every frame, so it reuses
 * stored arrays and computes positions directly from the clock.
 */

import { clamp, dist, smoothstep, type Vec } from '../core/math';
import { CAMP_GATHER_SECONDS, DAYLIGHT_HOURS, DAY_SECONDS, NIGHT_SECONDS, UNPACK_SECONDS, VOYAGE_SECONDS } from './calendar';
import { placeToday } from './conditions';
import { placeDef } from './content';
import type { ExpeditionAdventure } from './expedition';
import type { AdventureScene, SceneBuilding, SceneFigure, SceneGlint, ScenePlace, SceneSighting, SceneTrail } from './model';
import { builderLife, homeLife, onLegs, seat, type Stance } from './motion';
import { campOf, type CampSpot } from './regions';
import { isShowing } from './sightings';
import { crossingClock, crossingSpot } from './crossings';
import { structureDef } from './structures';
import { packShown, trailEnd } from './trail';
import { afloat, boatAt, landingSpot, moorings, voyageHour } from './finale';
import { eveningFire, homeRegion, isComplete, lodgingOf, occupiedCamps, openedTo, setOutFrom, shelterFire, stageOf } from './world';
import { completeSets } from './collections';
import { villagerFigures } from './villagers';
import { meetingFigures } from './meetings';
import { canWorkOn, workTrip } from './construction';
import { COAST_BRIDGE } from '../world/boards/kawagiriSites';
import { journeyFor } from './travel';

const plannedRoutes = new Map<string, Vec[]>();
/** How far apart two friends stand to talk when their paths cross. */
const TALK_APART = 26;
/** A resident creature is always settled in: past its arrival, nowhere near leaving. */
const RESIDENT_AGE = 3;
const RESIDENT_LIFE = 1e6;
/** Seconds a sketched creature stays in the scene, marked, while the pencil takes it. */
const SKETCH_SHOWN = 1.2;

export function buildScene(a: ExpeditionAdventure): AdventureScene {
  const s = a.state;
  const t = s.elapsed;
  return {
    figures: [...s.people.map((p) => figure(a, p.id)), ...villagerFigures(s, a.life, a.seed), ...meetingFigures(s, a.life)],
    places: [...s.known, ...s.rumoured].filter((id) => placeDef(id).region <= openedTo(s)).map((id): ScenePlace => {
      const place = placeDef(id);
      return {
        id, name: place.name, kind: place.kind ?? 'place', at: place.marker ?? place.at, rumour: s.rumoured.includes(id),
        state: placeToday(place, a.world().today, s).state,
        lead: s.leads.some((l) => l.place === id && l.expires >= s.day),
        selected: a.selection.place === id || a.inspected === id,
      };
    }),
    sightings: [
      // A creature just sketched stays a moment, marked, so the drawing knows it was sketched rather than gone.
      ...(s.phase === 'day' ? s.sightings.filter((x) => x.sketched ? t - (x.sketchedAt ?? -99) < SKETCH_SHOWN : isShowing(x, t)).map((x): SceneSighting => ({ id: x.id, species: x.find, at: x.at, age: t - x.appear, life: x.life, fresh: !s.discoveries[x.find], ...(x.sketched ? { sketched: true } : {}) })) : []),
      ...residents(a),
    ],
    // A glint just looked at stays a moment for its last twinkle.
    glints: s.phase === 'day' ? s.glints.filter((g) => g.found ? t - (g.foundAt ?? -99) < SKETCH_SHOWN : isShowing(g, t)).map((g): SceneGlint => ({ id: g.id, at: g.at, age: t - g.appear, life: g.life, ...(g.found ? { found: true } : {}) })) : [],
    buildings: [...(openedTo(s) >= 2 ? [{ id: -1, kind: 'bridge' as const, at: COAST_BRIDGE, progress: 1, stage: 2 as const }] : []), ...s.buildings.filter((b) => b.kind !== 'boat' || s.voyage === 'preparing').map((b): SceneBuilding => {
      const def = structureDef(b.kind);
      // The finished boat lies moored in the water; once it sails, the voyage draws it.
      const at = b.kind === 'boat' && def.work <= b.work ? afloat({ x: b.x, y: b.y }) : { x: b.x, y: b.y };
      return { id: b.id, kind: b.kind, at, camp: b.kind === 'shelter' && isComplete(b) ? shelterFire(b) : undefined, progress: def.work > 0 ? Math.min(1, b.work / def.work) : 1, stage: stageOf(b, s.day) };
    })],
    trails: trails(a),
    fire: eveningFire(s),
    campfires: occupiedCamps(s).slice(1).map((camp) => ({ id: camp.id, at: camp.at })),
    dusk: duskOf(a),
    hour: hourOf(a),
    // Settlement growth is parked: every settlement is at its first stage.
    settlements: [0, 1, 2].filter((r) => r <= openedTo(s)).map((region) => ({ region, stage: 0, additions: [] })),
    boat: boat(a),
    placing: null,
  };
}

/** Where a friend is and what they are doing, now. */
export function stanceOf(a: ExpeditionAdventure, id: string): Stance {
  const s = a.state;
  const index = Math.max(0, s.people.findIndex((p) => p.id === id));
  const base = homeRegion(s, id);
  const fire = setOutFrom(s, { region: base }, id);

  if (s.voyage !== 'preparing' && s.companions.includes(id)) {
    const walk = s.farewell.find((f) => f.person === id);
    if (s.voyage === 'gathering' && walk && walk.points.length > 0) {
      return onLegs(id, [{ kind: 'walk', start: 0, end: walk.seconds, points: walk.points, pose: 'walk' }], Math.min(a.state.voyageTime, walk.seconds - 0.01), fire);
    }
    return { at: moorings(s) ?? fire, pose: 'sit', facing: 1, action: 0 };
  }
  // Those staying come down to the landing to see the boat off.
  if (s.voyage === 'gathering' || s.voyage === 'sailing') {
    const stayers = s.people.filter((p) => !s.companions.includes(p.id));
    const k = stayers.findIndex((p) => p.id === id);
    const spot = landingSpot(s, k);
    const from = seat(fire, index);
    const walked = clamp((s.voyage === 'gathering' ? s.voyageTime : 99) / 2.5, 0, 1);
    if (walked < 1) return { at: { x: from.x + (spot.x - from.x) * walked, y: from.y + (spot.y - from.y) * walked }, pose: 'walk', facing: spot.x > from.x ? 1 : -1, action: (a.life * 1.6) % 1 };
    return { at: spot, pose: 'wave', facing: 1, action: (a.life * 0.9 + k * 0.3) % 1 };
  }

  if (s.phase === 'day') {
    const outing = s.outings.find((o) => o.person === id || o.companion === id);
    if (outing) {
      // Paths crossing: read the legs by the clock that holds them still to talk (and makes the time up either side).
      const clock = crossingClock(s, outing.person, t(a));
      const stance = onLegs(id, outing.legs, clock.t, seat(fire, index));
      if (clock.talking) {
        const c = clock.talking;
        const first = c.a === outing.person;
        const other = crossingSpot(s, c, first ? c.b : c.a);
        const me = crossingSpot(s, c, outing.person);
        if (c.held[1] - c.held[0] < 0.01) stance.pose = 'talk';
        // Two who meet on the same spot step a little apart to talk, face to face, easing in and out of it.
        if (other && me && dist(other, me) < TALK_APART) {
          const ease = smoothstep(0, 0.35, Math.min(t(a) - c.from, c.to - t(a)));
          const mid = { x: (other.x + me.x) / 2, y: (other.y + me.y) / 2 };
          stance.at = { x: stance.at.x + (mid.x + (first ? -TALK_APART / 2 : TALK_APART / 2) - stance.at.x) * ease, y: stance.at.y + (mid.y - stance.at.y) * ease };
          stance.facing = first ? 1 : -1;
        } else if (other && Math.abs(other.x - stance.at.x) > 1) stance.facing = other.x > stance.at.x ? 1 : -1;
      }
      const beat = outing.legs.find(leg => leg.kind === 'beat' && t(a) >= leg.start && t(a) < leg.end);
      const meeting = beat && outing.bundles.some(bundle =>
        bundle.kind === 'find' && (bundle.find.endsWith('-meeting') || ['miller', 'boatyard-moulds'].includes(bundle.find)) && dist(stance.at, placeDef(bundle.sourcePlace ?? outing.place).at) < 50);
      if (meeting) { stance.at = { ...beat.at! }; stance.pose = 'talk'; stance.facing = 1; }
      if (outing.companion !== id) return stance;
      return { ...stance, at: { x: stance.at.x - 18, y: stance.at.y + 10 } };
    }
    const work = workSite(a, id);
    if (work) return builderLife(id, index, t(a), work.trip.fire, work.site, DAY_SECONDS - 3, work.trip.spot, work.trip.route);
    // Home life also ends at the fire; resting people never jump from an errand into their seat.
    if (t(a) >= DAY_SECONDS - CAMP_GATHER_SECONDS) {
      const from = homeLife(id, index, a.life - (t(a) - (DAY_SECONDS - CAMP_GATHER_SECONDS)), fire, lodgingOf(s, id) ? [] : homeSpots(a, base), a.seed).at;
      const to = seat(fire, index);
      const k = clamp((t(a) - (DAY_SECONDS - CAMP_GATHER_SECONDS)) / CAMP_GATHER_SECONDS, 0, 1);
      return { at: { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k }, pose: k < 1 ? 'walk' : 'sit', facing: to.x > from.x ? 1 : -1, action: (a.life * 1.6) % 1 };
    }
  }

  if (s.phase === 'evening') {
    const evening = s.evening;
    const last = evening && evening.shown > 0 ? evening.items[evening.shown - 1] : undefined;
    const sinceShown = evening ? s.elapsed - (CAMP_GATHER_SECONDS + (evening.shown - 1) * UNPACK_SECONDS) : Infinity;
    const place = seat(fire, index);
    if (last?.person === id && sinceShown < 1) return { at: { x: place.x, y: place.y - 8 }, pose: 'carry', facing: 1, action: sinceShown };
    return { at: place, pose: 'sit', facing: place.x < fire.x ? 1 : -1, action: (a.life * 0.3 + index * 0.37) % 1 };
  }
  if (s.phase === 'night') {
    const place = seat(fire, index);
    return { at: place, pose: 'sit', facing: place.x < fire.x ? 1 : -1, action: 0 };
  }

  if (s.phase === 'morning') return { at: seat(fire, index), pose: 'sit', facing: index % 2 ? -1 : 1, action: 0 };
  return homeLife(id, index, a.life, fire, lodgingOf(s, id) ? [] : homeSpots(a, base), a.seed);
}

/** The building a friend staying home walks over to work on today, and the way there, if any (the view reads it too). */
export function workSite(a: ExpeditionAdventure, id: string) {
  const s = a.state;
  if (!s.resting.includes(id)) return null;
  const reachable = (b: (typeof s.buildings)[number]) => canWorkOn(s, id, b, a.nav);
  const site = s.buildings.find((b) => !isComplete(b) && reachable(b))
    ?? [...s.buildings].reverse().find((b) => ((b.worked?.day === s.day && b.worked.by.includes(id)) || b.id === s.workedOn) && reachable(b));
  const trip = site ? workTrip(s, id, site, a.nav) : null;
  return site && trip?.route ? { site, trip: { ...trip, route: trip.route } } : null;
}

/** The settlement's spots, plus a garden to tend and any building going up. */
function homeSpots(a: ExpeditionAdventure, region: number): CampSpot[] {
  const s = a.state;
  const camp = campOf(region);
  const spots = [...camp.spots];
  for (const b of s.buildings) {
    if (b.region !== region || Math.hypot(b.x - camp.fire.x, b.y - camp.fire.y) > 600) continue;
    if (!isComplete(b)) spots.push({ name: 'the building site', at: { x: b.x - 24, y: b.y + 24 }, pose: 'build' });
    else if (b.kind === 'garden' || b.kind === 'lily-bed') spots.push({ name: 'the garden', at: { x: b.x, y: b.y + 18 }, pose: 'forage' });
  }
  return spots;
}

function t(a: ExpeditionAdventure): number {
  return a.state.elapsed;
}

function figure(a: ExpeditionAdventure, id: string): SceneFigure {
  const s = a.state;
  const stance = stanceOf(a, id);
  const outing = s.outings.find((o) => o.person === id);
  const plan = s.plans.find((p) => p.person === id);
  // Aboard once the walk to the boat is done: from then on they ride in the boat itself.
  const walk = s.farewell.find((f) => f.person === id);
  const aboard = s.companions.includes(id) && (s.voyage === 'sailing' || s.voyage === 'ended' || (s.voyage === 'gathering' && !!walk && s.voyageTime >= walk.seconds));
  return {
    id,
    role: 'friend',
    look: id,
    at: stance.at,
    facing: stance.facing,
    pose: stance.pose,
    action: clamp(stance.action, 0, 1),
    pack: s.phase === 'day' && outing ? packShown(outing, s.elapsed) : null,
    item: s.phase === 'day' ? outing?.item ?? null : plan?.item ?? null,
    visible: !aboard,
    selected: a.selection.person === id,
  };
}

/**
 * The day's walked lines, flattened once per outing (again when a fork adds legs)
 * so the trail renderer can keep its drawing between frames.
 */
const dayRoutes = new WeakMap<object, { count: number; points: Vec[] }>();
const dayRoute = (legs: ReadonlyArray<{ points?: Vec[] }>): Vec[] => {
  let route = dayRoutes.get(legs);
  if (!route || route.count !== legs.length) dayRoutes.set(legs, (route = { count: legs.length, points: legs.flatMap((l) => l.points ?? []) }));
  return route.points;
};

function trails(a: ExpeditionAdventure): SceneTrail[] {
  const s = a.state;
  if (s.phase === 'day') {
    return s.outings.map((o) => ({
      person: o.person,
      points: dayRoute(o.legs),
      progress: clamp(s.elapsed / Math.max(1, trailEnd(o)), 0, 1),
      planned: false,
    }));
  }
  if (s.phase !== 'morning') return [];
  return s.plans.map((p) => {
    const key = `${a.seed}:${s.day}:${s.region}:${p.person}:${homeRegion(s, p.person)}:${s.people.find((person) => person.id === p.person)?.lodging ?? 'town'}:${s.buildings.map((b) => `${b.id}:${b.kind}:${b.x}:${b.y}:${b.work}`).join()}:${p.place}:${p.lodging ?? ''}:${p.activity}:${p.detour?.place ?? ''}:${Object.keys(s.discoveries).join()}`;
    let points = plannedRoutes.get(key);
    if (!points) {
      points = p.detour ? a.detourRoute(p.person, p.detour) : journeyFor(a.world(), p, stanceOf(a, p.person).at).out;
      plannedRoutes.set(key, points);
      if (plannedRoutes.size > 64) plannedRoutes.delete(plannedRoutes.keys().next().value!);
    }
    return { person: p.person, points, progress: 0, planned: true };
  });
}

/** Creatures that came to stay once a collection was finished. Out by day, settled at night. */
function residents(a: ExpeditionAdventure): SceneSighting[] {
  const s = a.state;
  if (s.phase === 'night') return [];
  return completeSets(s).flatMap((set) => {
    const c = set.consequence;
    if (c.kind !== 'creature' || set.region > openedTo(s)) return [];
    return [{ id: `resident-${set.id}`, species: c.species, at: c.at, age: RESIDENT_AGE, life: RESIDENT_LIFE, fresh: false }];
  });
}

/** 0 by day, rising through the last of the light to 1 at the evening fire. */
function duskOf(a: ExpeditionAdventure): number {
  const s = a.state;
  if (s.phase === 'morning') return 0;
  if (s.phase === 'day') return smoothstep(DAY_SECONDS * 0.8, DAY_SECONDS, s.elapsed) * 0.7;
  return 1;
}

/** The clock hour: planning rests near 7, the day runs 7 to 18, the fire near 20, the night sweeps round to 7. */
function hourOf(a: ExpeditionAdventure): number {
  const s = a.state;
  if (s.voyage !== 'preparing') return voyageHour(s);
  if (s.phase === 'morning') return 7;
  if (s.phase === 'day') return 7 + DAYLIGHT_HOURS * clamp(s.elapsed / DAY_SECONDS, 0, 1);
  if (s.phase === 'evening') return 18 + 2 * clamp(s.elapsed / CAMP_GATHER_SECONDS, 0, 1);
  return (20 + 11 * clamp(s.elapsed / NIGHT_SECONDS, 0, 1)) % 24;
}

function boat(a: ExpeditionAdventure): AdventureScene['boat'] {
  const s = a.state;
  if (s.voyage === 'preparing') return null;
  const mooring = moorings(s);
  if (!mooring) return null;
  if (s.voyage === 'gathering') {
    // Each friend steps aboard as they arrive.
    const aboard = s.farewell.filter((f) => s.voyageTime >= f.seconds).map((f) => f.person);
    return { at: mooring, angle: Math.PI / 2, aboard };
  }
  const at = boatAt(s, s.voyage === 'ended' ? VOYAGE_SECONDS : s.voyageTime)!;
  return { at: at.at, angle: at.angle, aboard: [...s.companions] };
}


/**
 * Saves are untrusted local JSON. An adventure from an older version starts
 * afresh; a current one is read field by field, keeping only known content
 * and finite numbers. Anything malformed in a day under way restarts that day
 * from its morning, so a broken save never stops the game.
 */

import { MINA_SPOTS, REN_SPOTS, USUAL_COURSE, WAYS } from './course';
import type { Vec } from '../core/math';
import { FINDS, LEADS, PLACES, hasFind, hasPlace } from './content';
import type { Activity, DayPhase, Equipment, MorningReport, OutingPlan, PackHint, Pose, StructureKind, UnpackItem } from './model';
import { PEOPLE } from './people';
import { REGIONS } from './regions';
import { ADVENTURE_VERSION, newAdventure, type AdventureState, type Bundle, type Crossing, type Evening, type Glint, type Lead, type Leg, type Outing, type Sighting } from './state';
import { EXCHANGES } from './crossingLines';
import { HEARD_KEPT } from './crossings';
import { keepHeard } from './threads';
import { smallFindDef } from './smallFinds';
import { EQUIPMENT, STRUCTURES } from './structures';
import { lodgingById } from './world';

type Raw = Record<string, unknown>;

const ACTIVITIES: readonly Activity[] = ['explore', 'fish', 'forage', 'investigate', 'visit', 'track'];
const POSES: readonly Pose[] = ['idle', 'walk', 'carry', 'fish', 'forage', 'look', 'talk', 'build', 'sit', 'wave', 'track'];
const PHASES: readonly DayPhase[] = ['morning', 'day', 'evening', 'night'];
const HINTS: readonly PackHint[] = ['plain', 'unusual', 'rare', 'story'];

const object = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v.slice(0, 400) : fallback);
const strings = (v: unknown): string[] => list(v).filter((x): x is string => typeof x === 'string').slice(0, 400);
const number = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
const integer = (v: unknown, min: number, max: number, fallback: number): number => Math.floor(number(v, min, max, fallback));
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);
const point = (v: unknown): Vec => {
  const p = object(v);
  return { x: number(p.x, -500, 3000, 0), y: number(p.y, -500, 7500, 0) };
};

export function restoreAdventure(value: unknown): AdventureState {
  const raw = object(value);
  const base = newAdventure(raw.free === true);
  if (raw.version !== ADVENTURE_VERSION) return base;

  const s: AdventureState = { ...base };
  const course = object(raw.course);
  s.course = { ren: oneOf(course.ren, REN_SPOTS, USUAL_COURSE.ren), mina: oneOf(course.mina, MINA_SPOTS, USUAL_COURSE.mina), way: oneOf(course.way, WAYS, USUAL_COURSE.way) };
  s.day = integer(raw.day, 1, 99999, 1);
  s.phase = oneOf(raw.phase, PHASES, 'morning');
  s.elapsed = number(raw.elapsed, 0, 120, 0);
  s.hurry = raw.hurry === true;
  s.region = integer(raw.region, 0, REGIONS.length - 1, 0);
  s.provisions = integer(raw.provisions, 0, 9999, base.provisions);
  s.materials = integer(raw.materials, 0, 9999, base.materials);
  const start = object(raw.dayStart);
  s.dayStart = {
    provisions: integer(start.provisions, 0, 9999, s.provisions),
    materials: integer(start.materials, 0, 9999, s.materials),
    ...(typeof start.packed === 'number' ? { packed: integer(start.packed, 0, 9999, 0) } : {}),
  };
  const stores = (v: unknown) => { const o = object(v); return { provisions: integer(o.provisions, 0, 9999, 0), materials: integer(o.materials, 0, 9999, 0) }; };
  s.history = list(raw.history).slice(0, 120).map((v) => {
    const day = object(v);
    return {
      day: integer(day.day, 1, s.day, 1),
      provisions: integer(day.provisions, -9999, 9999, 0),
      materials: integer(day.materials, -9999, 9999, 0),
      lines: strings(day.lines).slice(0, 8),
      standout: typeof day.standout === 'string' ? text(day.standout) : null,
      ...(typeof day.supper === 'number' ? { supper: integer(day.supper, 0, 9999, 0) } : {}),
      ...(typeof day.packed === 'number' ? { packed: integer(day.packed, 0, 9999, 0) } : {}),
      ...(day.gathered && typeof day.gathered === 'object' ? { gathered: stores(day.gathered) } : {}),
      ...(day.left && typeof day.left === 'object' ? { left: stores(day.left) } : {}),
      ...(Array.isArray(day.items) ? {
        items: list(day.items).map((item) => readItem(item, (id): id is string => typeof id === 'string' && PEOPLE.some((p) => p.id === id))).filter((item): item is UnpackItem => !!item),
        tomorrow: text(day.tomorrow),
        ...(typeof day.tomorrowPlace === 'string' && hasPlace(day.tomorrowPlace) ? { tomorrowPlace: day.tomorrowPlace } : {}),
        ...(typeof day.tomorrowNote === 'string' ? { tomorrowNote: text(day.tomorrowNote) } : {}),
      } : {}),
    };
  });
  s.nextId = integer(raw.nextId, 1, 1e9, 1);

  s.people = list(raw.people).flatMap((v) => {
    const p = object(v);
    if (!PEOPLE.some((d) => d.id === p.id)) return [];
    const practice = Object.fromEntries(Object.entries(object(p.practice)).filter(([k]) => ACTIVITIES.includes(k as Activity)).map(([k, n]) => [k, integer(n, 0, 9999, 0)]));
    return [{ id: p.id as string, base: integer(p.base, 0, s.free ? 2 : s.region, s.region), practice, memories: strings(p.memories).slice(0, 5), ...(p.wish !== undefined ? { wish: integer(p.wish, 1, s.day, s.day) } : {}) }];
  }).filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i);
  if (s.people.length === 0) s.people = base.people;
  const member = (id: unknown): id is string => typeof id === 'string' && s.people.some((p) => p.id === id);

  s.equipment = [...new Set(strings(raw.equipment))].filter((id): id is Equipment => EQUIPMENT.some((e) => e.id === id));
  s.known = [...new Set(strings(raw.known))].filter(hasPlace);
  s.rumoured = [...new Set(strings(raw.rumoured))].filter((id) => hasPlace(id) && !s.known.includes(id));
  s.visits = counts(raw.visits, hasPlace);
  s.learned = Object.fromEntries(Object.entries(object(raw.learned)).filter(([id]) => hasPlace(id)).map(([id, v]) => {
    const size = PLACES.find((p) => p.id === id)!.learn.length;
    return [id, [...new Set(list(v).filter((i): i is number => Number.isInteger(i) && (i as number) >= 0 && (i as number) < size))]];
  }));
  s.discoveries = Object.fromEntries(Object.entries(object(raw.discoveries)).filter(([id]) => hasFind(id)).map(([id, v]) => {
    const d = object(v);
    return [id, { day: integer(d.day, 1, s.day, 1), by: d.by === 'sketch' || member(d.by) ? (d.by as string) : 'sketch' }];
  }));
  s.given = strings(raw.given).filter((id) => LEADS.some((l) => l.id === id));
  s.leads = list(raw.leads).flatMap((v) => (readLead(v) ? [readLead(v)!] : []));
  s.buildings = list(raw.buildings).flatMap((v) => {
    const b = object(v);
    const def = STRUCTURES.find((d) => d.id === b.kind);
    if (!def) return [];
    const at = point(b);
    const id = integer(b.id, 1, 1e9, s.nextId);
    s.nextId = Math.max(s.nextId, id + 1);
    return [{ id, kind: def.id as StructureKind, x: at.x, y: at.y, region: integer(b.region, 0, s.free ? 2 : s.region, 0), work: number(b.work, 0, def.work, 0), placed: integer(b.placed, 1, s.day, s.day), ...(b.worked ? { worked: { day: integer(object(b.worked).day, 1, s.day, s.day), by: [...new Set(strings(object(b.worked).by).filter(member))] } } : {}) }];
  }).filter((b, i, all) => all.findIndex((c) => c.id === b.id) === i &&
    (STRUCTURES.find((d) => d.id === b.kind)?.repeatable || all.findIndex((c) => c.kind === b.kind) === i));

  for (const person of s.people) {
    const saved = list(raw.people).map(object).find((p) => p.id === person.id);
    const shelter = lodgingById(s, typeof saved?.lodging === 'number' || typeof saved?.lodging === 'string' ? saved.lodging : undefined);
    if (shelter?.region === person.base) person.lodging = shelter.id;
  }

  s.notes = list(raw.notes).flatMap((v) => {
    const n = object(v);
    if (typeof n.text !== 'string') return [];
    const id = integer(n.id, 1, 1e9, s.nextId);
    s.nextId = Math.max(s.nextId, id + 1);
    return [{ id, day: integer(n.day, 1, s.day, 1), text: text(n.text) }];
  }).slice(0, 30);
  s.recent = strings(raw.recent).slice(-60);
  s.heard = keepHeard(strings(raw.heard).filter((id) => EXCHANGES.some((e) => e.id === id)), HEARD_KEPT);
  s.smallFinds = Object.fromEntries(Object.entries(object(raw.smallFinds)).flatMap(([id, v]) => {
    const f = object(v);
    return smallFindDef(id) && member(f.person) ? [[id, { day: integer(f.day, 1, s.day, 1), person: f.person, place: hasPlace(text(f.place)) ? (f.place as string) : 'seseragi' }]] : [];
  }));
  s.tracked = strings(raw.tracked).filter((id) => FINDS.some((f) => f.id === id && f.sighting));
  s.news = strings(raw.news).slice(0, 12);
  s.revealed = strings(raw.revealed).filter(hasPlace);
  s.moving = raw.moving === true;
  s.morning = readMorning(raw.morning);

  s.plans = list(raw.plans).flatMap((v) => (readPlan(v, member) ? [readPlan(v, member)!] : []));
  s.resting = strings(raw.resting).filter(member);
  s.workedOn = s.buildings.some((b) => b.id === raw.workedOn) ? raw.workedOn as number : null;
  s.voyage = oneOf(raw.voyage, ['preparing', 'gathering', 'sailing', 'ended'] as const, 'preparing');
  s.voyageTime = number(raw.voyageTime, 0, 60, 0);
  s.companions = strings(raw.companions).filter(member);
  s.farewell = list(raw.farewell).flatMap((v) => {
    const f = object(v);
    return member(f.person) ? [{ person: f.person, points: list(f.points).map(point).slice(0, 2000), seconds: number(f.seconds, 0.1, 30, 3) }] : [];
  });
  if (s.voyage !== 'preparing' && s.companions.length === 0) s.voyage = 'preparing';
  s.sailed = raw.sailed === true;
  const almanac = object(raw.almanac);
  s.opensWander = raw.opensWander === true;
  const finds = strings(almanac.finds);
  const seasons = Array.isArray(almanac.seasons) ? almanac.seasons : [];
  const kept = finds.map((id, i) => ({ id, season: integer(seasons[i], -1, 3, -1) })).filter((f) => hasFind(f.id)).slice(0, 12);
  s.almanac = { year: integer(almanac.year, -1, 99999, -1), finds: kept.map((f) => f.id), seasons: kept.map((f) => f.season) };

  if (s.phase === 'day') {
    s.outings = list(raw.outings).flatMap((v) => (readOuting(v, member) ? [readOuting(v, member)!] : []));
    s.sightings = list(raw.sightings).flatMap((v) => (readSighting(v) ? [readSighting(v)!] : []));
    s.crossings = list(raw.crossings).flatMap((v) => (readCrossing(v, member) ? [readCrossing(v, member)!] : []));
    s.glints = list(raw.glints).flatMap((v) => (readGlint(v, member) ? [readGlint(v, member)!] : []));
    if (s.outings.length !== list(raw.outings).length) restartDay(s);
  }
  if (s.phase === 'evening' || s.phase === 'night') {
    s.evening = readEvening(raw.evening, member);
    if (!s.evening) {
      s.phase = 'night';
      s.elapsed = 0;
    }
  }
  s.nextId = Math.max(s.nextId, ...s.notes.map((n) => n.id + 1), ...s.buildings.map((b) => b.id + 1));
  return s;
}

/** A day that could not be read is begun again from its morning, plans and all. */
function restartDay(s: AdventureState): void {
  s.phase = 'morning';
  s.elapsed = 0;
  s.outings = [];
  s.sightings = [];
  s.crossings = [];
  s.glints = [];
  // A broken moving day restarts as an ordinary morning, not as half an arrival.
  s.moving = false;
}

function counts(v: unknown, valid: (id: string) => boolean): Record<string, number> {
  return Object.fromEntries(Object.entries(object(v)).filter(([id]) => valid(id)).map(([id, n]) => [id, integer(n, 0, 99999, 0)]));
}

function readPlan(v: unknown, member: (id: unknown) => id is string): OutingPlan | null {
  const p = object(v);
  if (!member(p.person) || !hasPlace(text(p.place))) return null;
  const activity = oneOf(p.activity, ACTIVITIES, 'explore');
  const item = EQUIPMENT.some((e) => e.id === p.item) ? (p.item as Equipment) : null;
  const companion = member(p.companion) && p.companion !== p.person ? p.companion : null;
  const overnight = typeof p.overnight === 'string' && p.overnight === p.place && PLACES.some((place) => place.id === p.overnight && ['hut', 'inn'].includes(place.habitat)) ? p.overnight : undefined;
  const second = object(p.second);
  const extra = hasPlace(text(second.place)) && second.place !== p.place && ACTIVITIES.includes(second.activity as Activity) ? { second: { place: second.place as string, activity: second.activity as Activity } } : {};
  const detour = object(p.detour);
  const stop = hasPlace(text(detour.place)) && ACTIVITIES.includes(detour.activity as Activity) ? { detour: { place: detour.place as string, activity: detour.activity as Activity } } : {};
  return { ...extra, ...stop, ...(p.visitOnly === true ? { visitOnly: true } : {}), person: p.person, place: p.place as string, activity, item, companion, ...(overnight ? { overnight } : {}), ...((Number.isInteger(p.lodging) && (p.lodging as number) > 0) || (typeof p.lodging === 'string' && PLACES.some((place) => place.id === p.lodging && ['hut', 'inn'].includes(place.habitat))) ? { lodging: p.lodging as number | string } : {}) };
}

function readLead(v: unknown): Lead | null {
  const l = object(v);
  const def = LEADS.find((d) => d.id === l.id);
  if (!def) return null;
  return { id: def.id, place: def.to, find: def.find, line: def.line, given: integer(l.given, 0, 99999, 0), expires: integer(l.expires, 0, 99999, 0) };
}

function readLeg(v: unknown): Leg | null {
  const l = object(v);
  if (l.kind !== 'walk' && l.kind !== 'beat') return null;
  const leg: Leg = { kind: l.kind, start: number(l.start, 0, 120, 0), end: number(l.end, 0, 120, 0), pose: oneOf(l.pose, POSES, 'walk') };
  if (l.kind === 'walk') leg.points = list(l.points).map(point).slice(0, 2000);
  if (l.at) leg.at = point(l.at);
  if (typeof l.text === 'string') leg.text = text(l.text);
  if (typeof l.sketch === 'string' || l.sketch === null) leg.sketch = l.sketch as string | null;
  if (l.reveal === true) leg.reveal = true;
  if (l.fork === true) leg.fork = true;
  return leg.kind === 'walk' && leg.points!.length === 0 ? null : leg;
}

function readBundle(v: unknown): Bundle | null {
  const b = object(v);
  const source = hasPlace(text(b.sourcePlace)) && ACTIVITIES.includes(b.sourceActivity as Activity) ? { sourcePlace: b.sourcePlace as string, sourceActivity: b.sourceActivity as Activity } : {};
  if (b.kind === 'supplies' || b.kind === 'materials') return { ...source, kind: b.kind, amount: integer(b.amount, 0, 4, 0) };
  if (b.kind === 'find' && hasFind(text(b.find))) return { ...source, kind: 'find', find: b.find as string };
  if (b.kind === 'lead' && LEADS.some((l) => l.id === b.lead)) return { ...source, kind: 'lead', lead: b.lead as string };
  if (b.kind === 'nothing') return { ...source, kind: 'nothing' };
  return null;
}

function readOuting(v: unknown, member: (id: unknown) => id is string): Outing | null {
  const o = object(v);
  const plan = readPlan(v, member);
  if (!plan) return null;
  const legs = list(o.legs).map(readLeg);
  const bundles = list(o.bundles).map(readBundle);
  if (legs.length === 0 || legs.some((l) => !l) || bundles.some((b) => !b)) return null;
  const f = object(o.fork);
  const fork = o.fork && typeof f.text === 'string'
    ? { text: text(f.text), choices: strings(f.choices).slice(0, 3), answer: typeof f.answer === 'number' && Number.isInteger(f.answer) ? f.answer : null }
    : null;
  return {
    ...plan,
    score: integer(o.score, -10, 20, 0),
    certain: o.certain === true,
    farther: o.farther === true,
    legs: legs as Leg[],
    bundles: bundles as Bundle[],
    pack: o.pack === null ? null : oneOf(o.pack, HINTS, 'plain'),
    fork,
  };
}

function readSighting(v: unknown): Sighting | null {
  const x = object(v);
  if (!FINDS.some((f) => f.id === x.find && f.sighting)) return null;
  return { id: text(x.id, 's'), find: x.find as string, at: point(x.at), appear: number(x.appear, 0, 60, 0), life: number(x.life, 0, 20, 7.5), sketched: x.sketched === true, ...(typeof x.sketchedAt === 'number' && Number.isFinite(x.sketchedAt) ? { sketchedAt: Math.max(0, Math.min(60, x.sketchedAt)) } : {}) };
}

function readCrossing(v: unknown, member: (id: unknown) => id is string): Crossing | null {
  const c = object(v);
  if (!member(c.a) || !member(c.b) || c.a === c.b || !EXCHANGES.some((e) => e.id === c.exchange)) return null;
  const pair = (x: unknown): [number, number] | null => (Array.isArray(x) && x.length === 2 && x.every((n) => typeof n === 'number' && Number.isFinite(n)) ? [number(x[0], 0, 60, 0), number(x[1], 0, 60, 0)] : null);
  const held = pair(c.held), spans = list(c.spans).map(pair);
  if (!held || spans.length !== 2 || spans.some((p) => !p)) return null;
  const at = number(c.at, 0, 60, 0), from = number(c.from, 0, at, at), to = number(c.to, at, 60, at);
  // A stretch that does not hold the talk would bend the clock backwards: such a crossing is dropped.
  if (spans.some((p) => p![0] >= from || p![1] <= to) || held[0] > held[1]) return null;
  return { id: text(c.id, 'c'), a: c.a, b: c.b, at, from, to, held, spans: [spans[0]!, spans[1]!], exchange: c.exchange as string };
}

function readGlint(v: unknown, member: (id: unknown) => id is string): Glint | null {
  const g = object(v);
  if (!smallFindDef(text(g.find)) || !member(g.person)) return null;
  return { id: text(g.id, 'glint'), find: g.find as string, at: point(g.at), appear: number(g.appear, 0, 60, 0), life: number(g.life, 0, 20, 9), person: g.person, found: g.found === true, ...(typeof g.foundAt === 'number' && Number.isFinite(g.foundAt) ? { foundAt: Math.max(0, Math.min(60, g.foundAt)) } : {}) };
}

function readItem(i: unknown, member: (id: unknown) => id is string): UnpackItem | null {
  const u = object(i);
  if (!member(u.person)) return null;
  return {
    id: text(u.id), person: u.person, kind: oneOf(u.kind, ['supplies', 'materials', 'find', 'lead', 'nothing'] as const, 'nothing'), hint: oneOf(u.hint, HINTS, 'plain'),
    title: text(u.title), text: text(u.text), sketch: typeof u.sketch === 'string' ? u.sketch : null, provisions: integer(u.provisions, 0, 99, 0), materials: integer(u.materials, 0, 99, 0),
    ...(typeof u.outcome === 'string' ? { outcome: text(u.outcome) } : {}),
    ...(Array.isArray(u.contributors) ? { contributors: [...new Set(strings(u.contributors).filter(member))] } : {}),
  };
}

function readEvening(v: unknown, member: (id: unknown) => id is string): Evening | null {
  const e = object(v);
  const items = list(e.items).map((item) => readItem(item, member));
  const effects = list(e.effects).map((x) => {
    const f = object(x);
    if (!member(f.person)) return null;
    return { person: f.person, provisions: integer(f.provisions, 0, 99, 0), materials: integer(f.materials, 0, 99, 0), find: hasFind(text(f.find)) ? (f.find as string) : null, lead: f.lead ? readLead(f.lead) : null };
  });
  if (items.some((i) => !i) || effects.some((x) => !x) || items.length !== effects.length) return null;
  return { items: items as UnpackItem[], effects: effects as Evening['effects'], shown: integer(e.shown, 0, items.length, 0), tomorrow: text(e.tomorrow),
    ...(typeof e.tomorrowNote === 'string' ? { tomorrowNote: text(e.tomorrowNote) } : {}),
    ...(typeof e.tomorrowSign === 'string' ? { tomorrowSign: text(e.tomorrowSign) } : {}),
    ...(typeof e.tomorrowPlace === 'string' && hasPlace(e.tomorrowPlace) ? { tomorrowPlace: e.tomorrowPlace } : {}),
    settled: e.settled === true };
}

function readMorning(v: unknown): MorningReport | null {
  if (!v || typeof v !== 'object') return null;
  const m = object(v);
  return {
    river: typeof m.river === 'string' ? text(m.river) : null,
    weather: text(m.weather),
    opened: strings(m.opened),
    closed: strings(m.closed),
    leads: strings(m.leads),
    expiring: strings(m.expiring),
    news: strings(m.news),
  };
}

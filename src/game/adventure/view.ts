/**
 * The notebook's snapshot: everything the interface shows, as plain data.
 * Rebuilt whenever something changes and a few times a second, so it is kept
 * simple and cheap. `forecast` is the one function in it, pure and cheap too.
 */

import { almanacAims, whileWeWait } from './aims';
import { wanderings } from './wanderings';
import { FREE_PLAY_FINDS } from './places/freeplay';
import { planningCache } from './planningCache';
import { riverSign } from './signs';
import { CAMP_GATHER_SECONDS, DAY_SECONDS, DAYS_PER_SEASON, seasonOf, yearOf } from './calendar';
import { buildChart } from './chart';
import { directionOf, frontierOf, rumourOf } from './discovery';
import { voyageCaption } from './finale';
import { setOf, setViews } from './collections';
import { findPossible, placeToday } from './conditions';
import { buildingProblem as buildingProblemFor, canWorkOn, underWay } from './construction';
import { ACTIVITY_DOING, FINDS, PLACES, findText, placeActivities, placeDef } from './content';
import { meetingSpot } from './meetings';
import type { ExpeditionAdventure } from './expedition';
import { daysLeft } from './leads';
import type {
  AdventureView, Chart, StructureKind, EquipmentView, FindSlot, FriendView, JournalEntry, PlaceView, PlanView, RiverView, StructureView, TagView,
} from './model';
import { assess, forecastOf, unplanned } from './odds';
import { endingNotes, endingWords } from './endingWords';
import { FREE_PLAY_ORDER, PEOPLE, nameOf } from './people';
import { PROVISIONS, departureOf, goalLine, isWayOnPlace, packedToMove, readyToMove } from './progression';
import { streamCrossable, streamCrossingLine } from './stream';
import { campOf, REGIONS } from './regions';
import { riverLine, shiftedOn, tomorrowGuess } from './river';
import { stanceOf } from './scene';
import { meetingWords, meetingTiming } from './narrative';
import { arrivalOf } from './travel';
import { journeyFor } from './travel';
import { outingStop, packShown } from './trail';
import { isShowing } from './sightings';
import { crossingClock, crossingTagId, crossingWords, spokenBy } from './crossings';
import { SMALL_FINDS, smallFindDef } from './smallFinds';
import type { AdventureState } from './state';
import { EQUIPMENT, STRUCTURES, isPlanting, structureDef, structureLabel } from './structures';
import { sentence } from './text';
import { wishOf, wishStatus, wishesFor } from './wishes';
import { availableLodgings, homeName, isComplete, lodgingById, openedTo, type World } from './world';

/** Seconds a beat's tag stays up; the reveal stays a little longer. */
const BEAT_TAG = 6;
const REVEAL_TAG = 8;

const charts = new WeakMap<object, Chart>();

/** Seconds the "Sketched" confirmation stays where the creature was. */
const SKETCHED_TAG = 1.5;
/** And the "Noted" one where a small thing glinted: a little longer, as its name is new. */
const NOTED_TAG = 2;
/** A glint's caption, before anyone knows what it is. */
const GLINT_WORDS = ['Something glints.', 'Something catches the light.', 'A glint by the path.', 'Something small shines.'];

export function buildView(a: ExpeditionAdventure): AdventureView {
  const s = a.state;
  const w = a.world();
  const progress = s.phase === 'day' ? Math.min(1, s.elapsed / DAY_SECONDS) : s.phase === 'morning' ? 0 : 1;
  let chart = charts.get(a.sim);
  if (!chart) {
    chart = buildChart(a.sim.board, a.sim.river);
    charts.set(a.sim, chart);
  }
  const planning = planningCache(a);
  const { forecasts, stops } = planning;
  const conversations = s.phase === 'day' ? buildTags(a).filter((tag) => tag.id.startsWith('meeting-')) : [];
  return {
    planningKey: planning.identity,
    mode: a.sim.state.mode,
    course: s.course,
    wayPlaces: PLACES.filter((p) => isWayOnPlace(s, p.id)).map((p) => p.id),
    aims: s.free ? almanacAims(s).map((aim) => ({ ...aim })) : [],
    wanderings: s.free ? wanderings(s) : [],
    departure: departureOf(s),
    day: s.day,
    phase: s.phase,
    eveningReady: s.phase === 'evening' && s.elapsed >= CAMP_GATHER_SECONDS,
    lodgings: availableLodgings(s).map((l) => ({ id: l.id, region: l.region, name: l.name, at: l.at })),
    sites: s.buildings.filter(isComplete).map((b) => ({ id: b.id, kind: b.kind, region: b.region, name: structureDef(b.kind).name, at: { x: b.x, y: b.y } })),
    dayProgress: progress,
    hour: hourWord(s, progress),
    season: seasonOf(s.day),
    year: yearOf(s.day),
    // The painted clock never runs into tomorrow before the night has passed.
    yearProgress: (((s.day - 1) % (DAYS_PER_SEASON * 4)) + Math.min(progress, 0.99)) / (DAYS_PER_SEASON * 4),
    weather: w.today.weather,
    paused: false,
    speed: 1,
    region: s.region,
    chart,
    river: riverView(a, w),
    nextStep: loopLine(s),
    goal: journeyGoal(w),
    sign: s.phase === 'morning' ? riverSign(w) : null,
    provisions: s.provisions,
    materials: s.materials,
    friends: (s.free ? FREE_PLAY_ORDER.filter(id => s.people.some(member => member.id === id)).map(id => ({ id })) : s.people).map((p) => ({ ...friendView(a, p.id), storyNow: conversations.some((tag) => tag.id.startsWith(`meeting-${p.id}-`)) || (s.phase === 'day' && !!crossingClock(s, p.id, s.elapsed).talking) })),
    places: [...s.known, ...s.rumoured, ...(s.phase === 'morning' && readyToMove(s) && !s.free ? [REGIONS[s.region + 1]!.id] : [])].filter((id, i, all) => all.indexOf(id) === i && placeDef(id).region <= openedTo(s) + (readyToMove(s) ? 1 : 0)).map((id) => placeView(a, w, id)),
    frontier: frontierOf(s.region, s.known, s.rumoured),
    plans: s.plans.map((plan): PlanView => ({ ...plan, moving: a.isMove(plan.person), ...(plan.detour ? { detour: { ...plan.detour } } : {}), forecast: { ...forecastOf(assess(w, plan)), ...(placeDef(plan.place).region > s.region && readyToMove(s) ? { problem: null, length: 'One day travelling together' } : {}) } })),
    canUndoPlan: a.canUndoPlan,
    canRedoPlan: a.canRedoPlan,
    structures: structureViews(a),
    equipment: equipmentViews(s),
    journal: journal(s),
    sets: setViews(s),
    smallFinds: smallFindViews(s),
    history: s.history.map((day) => ({ ...day, lines: [...day.lines], ...(day.items ? { items: day.items.map((item) => ({ ...item })) } : {}) })),
    notes: s.notes.slice(0, 30).map((n) => ({ id: n.id, day: n.day, text: n.text })),
    tags: buildTags(a),
    evening: s.evening && (s.phase === 'evening' || s.phase === 'night')
      ? { total: s.evening.items.length, items: s.evening.items.slice(0, s.evening.shown), shown: s.evening.shown, ...eveningLead(s.evening) }
      : null,
    morning: s.phase === 'morning' ? s.morning : null,
    placing: null,
    landscaping: false,
    itinerary: (plan) => { if (plan.detour) return a.detourRoute(plan.person, plan.detour); const trip = journeyFor(a.world(), plan); return [...trip.out, placeDef(plan.place).marker ?? placeDef(plan.place).at, ...trip.on.slice(1)]; },
    moveEveryoneProblem: (place) => a.moveEveryoneProblem(place),
    detour: (person, stop) => {
      const key = JSON.stringify(['detour', person, stop.place, stop.activity]);
      const forecast = forecasts.get(key) ?? a.detourForecast(person, stop);
      forecasts.set(key, forecast);
      return { ...forecast, reasons: forecast.reasons.map((reason) => ({ ...reason })) };
    },
    detourStops: (person) => (stops[person] ??= a.detourStops(person)).map((stop) => ({ ...stop })),
    canSail: a.canSail,
    canTravel: s.phase === 'morning' && readyToMove(s),
    travelCost: PROVISIONS[s.region] ?? 0,
    voyage: s.voyage,
    voyageCaption: s.moving && s.phase === 'day'
      ? { reach: s.elapsed < 5 ? `Leaving ${REGIONS[s.region]!.name}` : s.elapsed < arrivalOf(s.outings) ? null : REGIONS[s.region + 1]!.name,
        line: s.elapsed < 5 ? 'We follow the river down.' : s.elapsed < arrivalOf(s.outings) ? 'On the road to our next home.' : 'A new reach of the river. A place to begin again.' }
      : voyageCaption(s),
    ending: s.voyage === 'ended'
      ? { sailed: s.companions.map(nameOf), days: s.day, line: endingWords(s), notes: endingNotes(s) }
      : null,
    route: (person, place) => {
      if (typeof place !== 'string') return a.router()(stanceOf(a, person).at, place);
      if (!s.free && placeDef(place).region > s.region) return a.nav.route(stanceOf(a,person).at, a.arrivalFire(placeDef(place).region), REGIONS[placeDef(place).region]!.bottom) ?? [];
      const plan = s.plans.find((p) => p.person === person && p.place === place);
      const lodging = lodgingById(s, plan?.lodging);
      return a.router()(stanceOf(a, person).at, lodging ? lodging.fire : placeDef(place).kind === 'settlement' ? campOf(placeDef(place).region).fire : placeDef(place).at);
    },
    forecast: (plan) => {
      const key = JSON.stringify([plan.person, plan.place, plan.activity, plan.item, plan.companion, !!plan.visitOnly, plan.lodging, plan.overnight, plan.second?.place, plan.second?.activity]);
      const cached = forecasts.get(key);
      if (cached) return { ...cached, reasons: cached.reasons.map(reason => ({...reason})) };
      const forecast = forecastOf(assess({ ...w, state: { ...s, plans: s.plans.filter((p) => p.person !== plan.person) } }, plan));
      forecast.problem ??= a.relocationProblem(plan);
      forecasts.set(key, forecast);
      return { ...forecast, reasons: forecast.reasons.map(reason => ({...reason})) };
    },
  };
}

function hourWord(s: AdventureState, progress: number): string {
  if (s.phase === 'morning') return 'Morning';
  if (s.phase === 'evening') return 'Evening';
  if (s.phase === 'night') return 'Night';
  return progress < 0.25 ? 'Morning' : progress < 0.75 ? 'Daylight' : 'Dusk';
}

function riverView(a: ExpeditionAdventure, w: World): RiverView {
  const s = a.state;
  return {
    level: w.today.level,
    trend: w.today.trend,
    tomorrow: tomorrowGuess(a.seed, s.day),
    line: riverLine(a.seed, s.day, s.region),
    shifted: s.phase === 'morning' && shiftedOn(a.seed, s.day),
  };
}

/** The one thing the daily loop is waiting for. */
function loopLine(s: AdventureState): string {
  if (s.moving && s.phase === 'day') return `Moving together to ${REGIONS[s.region + 1]!.name}.`;
  if (s.voyage === 'gathering') return 'Everyone is gathering at the boat.';
  if (s.voyage === 'sailing') return 'Down the river to the sea.';
  if (s.phase === 'morning') {
    const waiting = unplanned(s).map(nameOf);
    if (s.plans.length === 0 && s.resting.length === 0) {
      const site = s.buildings.find((b) => !isComplete(b));
      if (!site) return 'Choose a place to visit, or take a day at camp.';
      if (s.people.some((p) => { const project = underWay(s, p.base); return project && canWorkOn(s, p.id, project); })) return 'Work is waiting. Begin the day to build, or choose an outing first.';
      return `Nobody is camped near enough to work on ${structureLabel(structureDef(site.kind).name)} in ${REGIONS[site.region]!.name}. Move a camp there, or choose an outing.`;
    }
    if (waiting.length === 0) return 'Ready for the day.';
    return `${sentence(waiting)} ${waiting.length === 1 ? 'stays' : 'stay'} home unless assigned an outing.`;
  }
  if (s.phase === 'day') {
    const forked = s.outings.find((o) => o.fork && o.fork.answer === null && o.legs.some((l) => l.fork && s.elapsed >= l.start));
    if (forked) return `${nameOf(forked.person)} is waiting at a fork.`;
    return 'Out until dusk. Everyone will be home by evening.';
  }
  if (s.phase === 'evening') return 'Unpacking by the fire.';
  return 'Night falls over the valley.';
}

function friendView(a: ExpeditionAdventure, id: string): FriendView {
  const s = a.state;
  const def = PEOPLE.find((p) => p.id === id)!;
  const person = s.people.find((p) => p.id === id)!;
  const outing = s.outings.find((o) => o.person === id || o.companion === id);
  const plan = s.plans.find((p) => p.person === id || p.companion === id);
  const resting = s.resting.includes(id);
  const building = resting && s.buildings.some((b) => !isComplete(b) && canWorkOn(s, id, b, a.nav));
  const home = homeName(s, id);

  let status: FriendView['status'] = 'home';
  let line = `At home in ${home}`;
  if ((s.voyage === 'sailing' || s.voyage === 'gathering') && s.companions.includes(id)) {
    status = 'aboard';
    line = 'Sailing for the sea';
  } else if (s.phase === 'day' && outing) {
    status = 'out';
    const lodging = lodgingById(s, outing.lodging);
    const stop = outingStop(outing, s.elapsed);
    line = lodging ? `Moving to ${lodging.name}` : outing.person === id ? `${ACTIVITY_DOING[stop.activity]} at ${placeDef(stop.place).name}` : `At ${placeDef(stop.place).name} with ${nameOf(outing.person)}`;
  } else if (s.phase === 'morning' && plan) {
    status = 'planned';
    line = plan.person === id ? `Going to ${lodgingById(s, plan.lodging)?.name ?? placeDef(plan.place).name}` : `Going with ${nameOf(plan.person)}`;
    if (plan.second) line += ` → ${placeDef(plan.second.place).name}`;
    if (plan.overnight) line += ' · staying overnight';
  } else if (resting && (s.phase === 'morning' || s.phase === 'day')) {
    status = building ? 'building' : 'resting';
    line = building ? 'Staying home to build' : `Staying home in ${home}`;
  }

  return {
    id,
    name: def.name,
    base: person.base,
    baseName: home,
    lodging: person.lodging,
    role: def.role,
    colour: def.colour,
    portrait: `friend-${id}`,
    gift: def.gift,
    ambition: def.ambition,
    status,
    statusLine: line,
    pack: s.phase === 'day' && outing ? packShown(outing, s.elapsed) : null,
    memories: [...person.memories],
    practice: { ...person.practice },
    at: stanceOf(a, id).at,
    ...friendWish(s, id),
  };
}

/** The People page's quiet line: what they would like built, once said, or what it became. */
function friendWish(s: AdventureState, id: string): { wish?: { text: string; granted: boolean } } {
  const wish = wishOf(id);
  const status = wishStatus(s, id);
  if (!wish || (status !== 'wanted' && status !== 'granted')) return {};
  return { wish: { text: status === 'granted' ? wish.has : wish.wants, granted: status === 'granted' } };
}

function placeView(a: ExpeditionAdventure, w: World, id: string): PlaceView {
  const s = a.state;
  const place = placeDef(id);
  const today = placeToday(place, w.today, s);
  const lead = s.leads.find((l) => l.place === id && l.expires >= s.day);
  const learned = (s.learned[id] ?? []).map((i) => place.learn[i]?.text).filter((t): t is string => !!t);
  const finds: FindSlot[] = FINDS.filter((f) => f.at?.includes(id)).map((f) => {
    const found = !!s.discoveries[f.id];
    return {
      id: f.id,
      found,
      name: found ? f.name : null,
      sketch: f.id,
      rare: !!f.rare,
      today: place.activities.some((act) => findPossible(f, place, act, w.today, s)),
      hint: found ? null : f.hint,
    };
  });
  return {
    id,
    habitat: place.habitat,
    name: s.rumoured.includes(id) ? ({ waterfall: 'Waterfall?', hut: 'Ridge hut?', pool: 'Deep pool?', tarn: 'High lake?', woodland: 'Woodland trail?', meadow: 'Meadow?', road: 'Old road?', reeds: 'Reed beds?', pines: 'Pine ridge?' }[place.habitat] ?? `A way ${directionOf(id)}`) : place.name,
    kind: place.kind ?? 'place',
    home: s.people.some(person => person.lodging === id || place.kind === 'settlement' && person.base === place.region && person.lodging === undefined),
    rumour: s.rumoured.includes(id) ? rumourOf(id) : null,
    direction: directionOf(id),
    region: place.region,
    // Coastal neighbours need an enlarged map, not offsets that misrepresent
    // their walking distances. The bridge symbol still belongs on its span.
    at: place.region === 2 && place.id !== 'shiobashi' ? place.at : place.marker ?? place.at,
    note: s.rumoured.includes(id) ? rumourOf(id) : place.note,
    state: today.state,
    stateLine: id === 'furumichi' && !s.rumoured.includes(id) ? [today.line, streamCrossingLine(s)].filter(Boolean).join(' ') : today.line,
    activities: s.rumoured.includes(id) ? ['explore'] : [...placeActivities(place, s.free)],
    lead: lead?.line ?? null,
    leadDays: lead ? daysLeft(lead, s.day) : null,
    finds: s.rumoured.includes(id) ? [] : finds,
    visits: s.visits[id] ?? 0,
    learned,
  };
}

function structureViews(a: ExpeditionAdventure): StructureView[] {
  const s = a.state;
  return STRUCTURES.filter((d) => d.region <= openedTo(s) && (!isPlanting(d.id) || (d.requires && s.discoveries[d.requires]))).map((d) => {
    const placed = s.buildings.find((b) => b.kind === d.id && b.region === s.region && !isComplete(b)) ?? s.buildings.find((b) => b.kind === d.id && !isComplete(b)) ?? s.buildings.find((b) => b.kind === d.id);
    const problem = placed && (!d.repeatable || !isComplete(placed)) ? null : buildingProblemFor(s, d.id);
    const status: StructureView['status'] = placed ? (isComplete(placed) ? 'built' : 'building') : problem ? 'locked' : 'available';
    return {
      id: d.id,
      repeatable: d.repeatable,
      count: s.buildings.filter((b) => b.kind === d.id && isComplete(b)).length,
      builders: placed && !isComplete(placed) ? s.people.filter((p) => canWorkOn(s, p.id, placed, a.nav)).map((p) => p.id) : [],
      name: d.name,
      opens: opensFor(s, d.id),
      cost: d.cost,
      // The Furumichi flood clause belongs to the upper valley only.
      effect: d.id === 'shelter' && s.region !== 0 ? d.effect.replace(/ Near Furumichi.*$/, '') : d.effect,
      sketch: `structure-${d.id}`,
      status,
      problem,
      progress: placed ? (d.work > 0 ? placed.work / d.work : 1) : 0,
      workRemaining: Math.max(0, Math.round((d.work - (placed?.work ?? 0)) * 1e6) / 1e6),
      siteId: placed?.id,
      recoverable: placed && !isComplete(placed) && d.work ? Math.floor(d.cost * (1 - placed.work / d.work) + 1e-8) : 0,
      region: placed?.region ?? s.region,
      at: placed ? { x: placed.x, y: placed.y } : null,
      ...(d.major ? { major: true } : {}),
      ...structureWish(s, d.id),
    };
  });
}

/** A said (or granted) wish for this kind, by someone in the group. */
function structureWish(s: AdventureState, kind: StructureKind): { wish?: { person: string; name: string; granted: boolean } } {
  const wish = wishesFor(kind).find((w) => ['wanted', 'granted'].includes(wishStatus(s, w.person) ?? ''));
  return wish ? { wish: { person: wish.person, name: nameOf(wish.person), granted: wishStatus(s, wish.person) === 'granted' } } : {};
}

/** The places a work opens the way to, by name, among those already known or heard of. */
function opensFor(s: AdventureState, kind: StructureKind): string[] {
  const crossing: Partial<Record<StructureKind, string>> = { bridge: 'mio-bridge', 'ford-bridge': 'high-stones' };
  return PLACES.filter((p) => (crossing[kind] && p.crossing === crossing[kind] || p.rules?.some((r) => r.bypass?.structure === kind && s.discoveries[r.bypass.find])) && (s.known.includes(p.id) || s.rumoured.includes(p.id)))
    .map((p) => (s.known.includes(p.id) ? p.name : `${rumourOf(p.id).replace(/\.$/, '').toLowerCase()}`));
}

function equipmentViews(s: AdventureState): EquipmentView[] {
  return EQUIPMENT.map((e) => {
    const holder = [...s.plans, ...s.outings].find((p) => p.item === e.id);
    return { id: e.id, name: e.name, cost: e.cost, effect: e.effect, owned: s.equipment.includes(e.id), with: holder ? nameOf(holder.person) : null };
  });
}

function journal(s: AdventureState): JournalEntry[] {
  // Every page is in the book from the start; places not yet reached keep their hints to themselves.
  const opened = openedTo(s);
  // Wander keeps every discovery. A Journey keeps only this year's routes;
  // its total is fixed when the course is chosen, before the first page opens.
  return FINDS.filter((f) => s.free || !FREE_PLAY_FINDS.has(f.id)).map((f) => {
    const found = s.discoveries[f.id];
    const companion = f.id.endsWith('-meeting') && s.people.some((person) => person.id === f.id.replace('-meeting', ''));
    const known = !!found || companion;
    const speaker = f.id === 'miller' ? 'miller' : f.id.replace('-meeting', '');
    const dialogue = found ? meetingWords(speaker, found.by, s.free) : undefined;
    return {
      id: f.id,
      category: f.category,
      sketch: f.id,
      found: known,
      name: known ? f.name : null,
      text: known ? findText(f, s.free) : null,
      conversation: dialogue?.map(line => ({ speaker: line.speaker === 'traveller' ? (found.by === 'sketch' ? 'Traveller' : nameOf(found.by)) : speaker === 'miller' ? 'Miller' : speaker === 'boatyard-moulds' ? 'Boatbuilder' : nameOf(speaker), text: line.text })),
      rare: !!f.rare,
      region: f.region,
      credit: found ? `Day ${found.day} · ${found.by === 'sketch' ? 'Sketched' : nameOf(found.by)}` : companion ? 'Travelling with us' : null,
      hint: known ? null : f.region <= opened ? f.hint : 'Somewhere further down the river.',
      set: setOf(f.id)?.name ?? null,
    };
  });
}

/** The paper tags pinned in the valley now. Cheap enough to build every frame. */
export function buildTags(a: ExpeditionAdventure): TagView[] {
  const s = a.state;
  const out: TagView[] = [];
  const t = s.elapsed;

  if (s.phase === 'day') {
    // Two friends whose paths have crossed, talking: one conversation card, as a first meeting's.
    const talking = new Set<string>();
    for (const c of s.crossings) {
      if (t < c.from || t >= c.to) continue;
      talking.add(c.a).add(c.b);
      const words = crossingWords(s, c);
      const index = words?.lines.findIndex((line) => t >= line.start && t < line.end) ?? -1;
      const line = words?.lines[index];
      if (!words || !line) continue;
      out.push({ id: crossingTagId(c, index), kind: 'beat', anchor: stanceOf(a, line.speaker).at, person: line.speaker, sketch: null, text: spokenBy(line.speaker, line.text), pack: null, choices: [], remaining: line.end - t, readingRate: words.rate });
    }
    for (const outing of s.outings) {
      if (talking.has(outing.person)) continue;
      const leg = outing.legs.find((l) => t >= l.start && t < l.end && (l.kind === 'beat' || l.reveal));
      if (!leg) continue;
      const at = stanceOf(a, outing.person).at;
      if (leg.fork && outing.fork && outing.fork.answer === null) {
        out.push({ id: `fork-${outing.person}`, kind: 'choice', anchor: at, person: outing.person, sketch: null, text: outing.fork.text, pack: null, choices: [...outing.fork.choices], remaining: Math.max(0, leg.end - t) });
        continue;
      }
      const stop = outingStop(outing, t);
      const meeting = outing.bundles.find((b) => b.kind === 'find' && (b.find.endsWith('-meeting') || ['miller', 'boatyard-moulds'].includes(b.find)) && (b.sourcePlace ?? outing.place) === stop.place);
      const meetingAt = placeDef(meeting?.sourcePlace ?? outing.place).at;
      const firstBeat = outing.legs.find((l) => l.kind === 'beat' && l.at && Math.hypot(l.at.x - meetingAt.x, l.at.y - meetingAt.y) < 50);
      const newcomer = meeting?.kind === 'find' ? meeting.find.replace('-meeting', '') : null;
      const words = newcomer ? meetingWords(newcomer, outing.person, s.free) : undefined;
      const start = firstBeat?.start ?? 0;
      const conversationBeats = outing.legs.filter((l) => l.kind === 'beat' && l.at && Math.hypot(l.at.x - meetingAt.x, l.at.y - meetingAt.y) < 50);
      const available = conversationBeats.reduce((sum, l) => sum + l.end - l.start, 0);
      const spoken = conversationBeats.reduce((sum, l) => sum + Math.max(0, Math.min(t, l.end) - l.start), 0);
      const timing = words ? meetingTiming(words, available) : undefined;
      const line = timing?.lines.findIndex(line => spoken >= line.start && spoken < line.end) ?? -1;
      if (newcomer && timing && line >= 0 && leg.kind === 'beat' && t >= start && conversationBeats.includes(leg)) {
        const said = timing.lines[line]!;
        const visitorSpeaks = said.speaker === 'traveller';
        const speaker = visitorSpeaks ? outing.person : newcomer;
        const anchor = visitorSpeaks ? at : meetingSpot(meeting?.sourcePlace ?? outing.place);
        const remaining = Math.min(leg.end - t, said.end - spoken);
        out.push({ id: `meeting-${outing.person}-${newcomer}-${line}`, kind: 'beat', anchor, person: speaker, sketch: null, text: `${speaker === 'miller' ? 'Miller' : speaker === 'boatyard-moulds' ? 'Boatbuilder' : nameOf(speaker)}: ${said.text}`, pack: null, choices: [], remaining, readingRate: timing.rate });
        continue;
      }
      if (meeting) continue; // Let the conversation end quietly, without a generic encounter caption.
      const shown = leg.reveal ? REVEAL_TAG : BEAT_TAG;
      const remaining = Math.min(leg.end, leg.start + shown) - t;
      if (remaining <= 0 || !leg.text) continue;
      out.push({ id: `beat-${outing.person}-${leg.start}`, kind: 'beat', anchor: at, person: outing.person, sketch: leg.sketch ?? null, text: leg.text, pack: leg.reveal ? outing.pack : null, choices: [], remaining });
    }
    // Until the first sketch, a creature's caption carries a pencilled hint of how to keep it.
    const novice = !FINDS.some((f) => s.discoveries[f.id]?.by === 'sketch');
    for (const sighting of s.sightings) {
      const find = FINDS.find((f) => f.id === sighting.find)!;
      // Just sketched: the caption becomes a short confirmation with the drawing.
      if (sighting.sketched) {
        const since = t - (sighting.sketchedAt ?? -99);
        if (since >= 0 && since < SKETCHED_TAG) out.push({ id: `${sighting.id}-sketched`, kind: 'sighting', anchor: sighting.at, person: null, sketch: find.id, text: `Sketched: ${find.name}`, pack: null, choices: [], remaining: SKETCHED_TAG - since });
        continue;
      }
      if (!isShowing(sighting, t)) continue;
      out.push({ id: sighting.id, kind: 'sighting', anchor: sighting.at, person: null, sketch: s.discoveries[find.id] ? find.id : null, text: find.sighting!.line, hint: novice ? 'tap to sketch' : undefined, pack: null, choices: [], remaining: sighting.appear + sighting.life - t });
    }
    // A small thing glinting by the path; until the first is noticed, its caption says how.
    const firstGlint = Object.keys(s.smallFinds).length === 0;
    for (const glint of s.glints) {
      const find = smallFindDef(glint.find);
      if (!find) continue;
      if (glint.found) {
        const since = t - (glint.foundAt ?? -99);
        // The '-sketched' ending gives it a found creature's way out: the drawing lifts into the book.
        if (since >= 0 && since < NOTED_TAG) out.push({ id: `${glint.id}-sketched`, kind: 'sighting', anchor: glint.at, person: null, sketch: find.sketch, text: `Noted: ${find.name}`, pack: null, choices: [], remaining: NOTED_TAG - since });
        continue;
      }
      if (!isShowing(glint, t)) continue;
      out.push({ id: glint.id, kind: 'sighting', anchor: glint.at, person: null, sketch: null, text: GLINT_WORDS[s.day % GLINT_WORDS.length]!, hint: firstGlint ? 'tap to look' : undefined, pack: null, choices: [], remaining: glint.appear + glint.life - t });
    }
  }

  if (a.inspected) {
    const place = placeDef(a.inspected);
    out.push({ id: place.id, kind: 'place', anchor: place.at, person: null, sketch: `place-${place.habitat}`, text: place.name, pack: null, choices: [], remaining: 0 });
  }
  return out;
}

/** The closing lead, its chore note and its place, once every bundle is down. */
function eveningLead(evening: NonNullable<AdventureState['evening']>): { tomorrow: string; tomorrowNote?: string; tomorrowPlace?: string; tomorrowSign?: string } {
  if (evening.shown < evening.items.length) return { tomorrow: '' };
  return { tomorrow: evening.tomorrow, ...(evening.tomorrowNote ? { tomorrowNote: evening.tomorrowNote } : {}), ...(evening.tomorrowPlace ? { tomorrowPlace: evening.tomorrowPlace } : {}), ...(evening.tomorrowSign ? { tomorrowSign: evening.tomorrowSign } : {}) };
}

/** The story's next step; while it waits on the stream, something worth seeing meanwhile. */
function journeyGoal(w: World): string {
  const s = w.state;
  const goal = goalLine(s);
  if (!s.free && s.phase === 'morning' && s.region === 1 && s.course.way === 'herons' && w.today.weather !== 'clear'
    && s.known.includes('kitsuneyama') && !departureOf(s)?.surveyed && placeToday(placeDef('kitsuneyama'), w.today, s).state !== 'closed') {
    const meanwhile = whileWeWait(w);
    return `Mist and cloud hide the herons’ line today.${meanwhile ? ` Meanwhile: ${meanwhile}` : ' The hill will keep for a clear morning.'}`;
  }
  if (s.free || s.phase !== 'morning' || s.region !== 0 || !packedToMove(s) || streamCrossable(s)) return goal;
  const meanwhile = whileWeWait(w);
  return meanwhile ? `${goal} While we wait: ${meanwhile}` : goal;
}

/** The small finds noticed so far, in the order they were found. */
function smallFindViews(s: AdventureState): AdventureView['smallFinds'] {
  const found = SMALL_FINDS.filter((f) => s.smallFinds[f.id])
    .sort((x, y) => s.smallFinds[x.id]!.day - s.smallFinds[y.id]!.day)
    .map((f) => {
      const note = s.smallFinds[f.id]!;
      return { id: f.id, name: f.name.charAt(0).toUpperCase() + f.name.slice(1), line: f.line, sketch: f.sketch, credit: `Day ${note.day} · by ${nameOf(note.person)}’s path to ${placeDef(note.place).name}` };
    });
  return { found, total: SMALL_FINDS.length };
}

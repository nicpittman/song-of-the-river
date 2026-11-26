import { catchWords, fitsStory, SESERAGI_LEAD } from './narrative';
/**
 * Dusk and the fire. When the day ends everyone is home; what they learned
 * and where they went is recorded at once, and their bundles are set down by
 * the fire one at a time, rarest last. Each bundle takes effect as it is set
 * down (provisions counted, finds into the journal, leads onto the map). The
 * evening ends with one line about tomorrow, always a reason to go somewhere.
 */

import { freeAims } from './aims';
import { REN_WORDS, arrivalOf, WAY_ROUTES, WAYS } from './course';
import { hashString } from '../core/rng';
import { ECONOMY, expectedResources } from './economy';
import { findPossible, isOpen } from './conditions';
import { ACTIVITY_DOING, FINDS, LEADS, findDef, findText, placeDef } from './content';
import { leadDef, leadSettled, makeLead } from './leads';
import { EMPTY_TEXT, GARDEN_REST_TEXT, REST_TEXT, SUPPLY_TEXT } from './lines';
import type { Activity, PackHint, StructureKind, UnpackItem } from './model';
import type { PlaceDef } from './catalogue';
import { FREE_PLAY_HOMES, nameOf, personDef } from './people';
import { BEYOND, directionOf, rumourOf } from './discovery';
import { yearOf } from './calendar';
import { SEA_PROVISIONS, WAY_ON_FINDS, departureOf, gateRoutes, goalLine, isWayOnPlace, newMembers, readyToMove, sailFound, tideFound } from './progression';
import { REGIONS } from './regions';
import type { AdventureState, Bundle, Evening, Outing, UnpackEffect } from './state';
import { FINISHED, structureDef, structureLabel } from './structures';
import { wishItems } from './wishes';
import { threadItems } from './threads';
import { deductionLine } from './deductions';
import { secretsDue } from './wanderings';
import { SECRET_REVEALS } from './places/freeplay';
import { numberWord, sentence } from './text';
import { homeName, homeRegion, holds, isBuilt, isComplete, lodgingById, todayOf, type Today, type World } from './world';
import { canWorkOn } from './construction';
import { planProblem } from './odds';
import { journeyFor } from './travel';
import { furumichiReport } from './stream';

const RANK: Record<PackHint, number> = { plain: 0, unusual: 1, rare: 2, story: 3 };
const CAMP_LEADS = LEADS.filter((l) => l.from.includes('camp'));
const JOINING: Record<string, string> = {
  aki: 'Aki lays down his hammer. His promise to Mio is kept. At dusk he wades out to the grey boat in the reeds below the village and pats her side. “Not long now. Past the reeds, this time.”',
  yui: 'Yui brings her notebook down to the dock. She has a few ideas for the voyage.',
};
const ARRIVING: Record<number, string> = {
  1: 'The old road brings us down among orchards: lanterns at the inn, a mill wheel turning, and the river bending long and slow beyond. Mio is home for now.',
  2: 'The river spreads into reed beds, and gulls go over though there is no sea in sight yet. We sleep at Ashikari, the reed cutters’ hut. Upstream, a stone bridge leads to the eastern shore.',
};
/** The reach is named for its village; coming down through the reeds, the reeds are where we arrive. */
const ARRIVED_AT: Record<number, string> = { 2: 'the reed beds' };
/** Kawagiri reached by the high path, down the east bank. */
const ARRIVING_EAST = 'The high path comes down through the pines to the shore. Kawagiri is all boats and drying nets, and the sea is right there, at the end of the street.';
const NONE = { provisions: 0, materials: 0, find: null, lead: null } as const;
/** A creature the player caught with a tap is told as theirs. */
export const SKETCHED = 'Sketched: ';
/** The one line for a creature that showed and was not caught. */
export const GOT_AWAY = 'Just a glimpse';
/** The evening the first Journey reaches Mio, and Wander opens. */
export const WANDER_OPEN = 'Wander is open';
/** A missed creature is mentioned once, and then not again for a few days. */
const GLIMPSE_QUIET_DAYS = 3;

/** Everyone is home: record the day and lay out the bundles. `arrived` is the evening the group comes down into a new reach. */
export function dusk(w: World, options: { arrived?: boolean; welcomeLine?: string; missed?: readonly string[]; talked?: readonly string[] } = {}): Evening {
  const s = w.state;
  const items: Array<{ item: UnpackItem; effect: UnpackEffect }> = [];
  const add = (item: Omit<UnpackItem, 'id'>, effect: Omit<UnpackEffect, 'person'>): void => {
    items.push({ item: { ...item, id: `u${s.day}-${items.length}` }, effect: { ...effect, person: item.person } });
  };
  /** Who settled where tonight, told once for the whole group. */
  const moves: Array<{ person: string; home: string; stay: boolean }> = [];

  /** Each stop of a day out is recorded as an outing: practice, memories, what was learned and found. */
  const record = (outing: Outing, stops: readonly Outing[]): void => {
    for (const stop of stops) {
      const { found, heard, story } = recordOuting(w, stop);
      if (found) {
        const place = placeDef(found);
        add({ person: outing.person, kind: 'nothing', hint: isWayOnPlace(w.state, place.id) ? 'story' : 'unusual', title: `Found: ${place.name}`, text: place.note, sketch: `place-${place.habitat}`, provisions: 0, materials: 0 }, NONE);
      }
      for (const id of heard) {
        add({ person: outing.person, kind: 'nothing', hint: 'unusual', title: `A way on, ${directionOf(id)}`, text: rumourOf(id), sketch: null, provisions: 0, materials: 0 }, NONE);
      }

      if (story) add({ person: outing.person, kind: 'nothing', hint: 'plain', title: `At ${placeDef(stop.place).name}`, text: story, sketch: null, provisions: 0, materials: 0 }, NONE);
    }
  };

  for (const outing of s.outings) {
    const destination = placeDef(outing.place);
    if (destination.kind === 'settlement' && !outing.visitOnly) {
      // A stop on the way down is told first, as any day out would be.
      if (outing.detour) record(outing, [{ ...outing, ...outing.detour, lodging: undefined, detour: undefined }]);
      const person = s.people.find((p) => p.id === outing.person)!;
      person.base = destination.region;
      if (outing.lodging === undefined) {
        s.visits[destination.id] = Math.max(1, s.visits[destination.id] ?? 0);
        if (destination.id === 'kawagiri') for (const id of ['funaya', 'takayuka', 'far-shore', 'kawaguchi', 'todai', 'fish-traps', 'east-marsh']) reveal(s, id);
      }
      if (outing.lodging !== undefined) person.lodging = outing.lodging;
      else delete person.lodging;
      const home = lodgingById(s, outing.lodging)?.name ?? destination.name;
      remember(person, `Settled in at ${home}.`);
      moves.push({ person: person.id, home, stay: false });
      for (const bundle of outing.bundles) add(...bundleItem(w, outing, bundle));
      continue;
    }
    const before = items.length;
    record(outing, [outing, ...(outing.second ? [{ ...outing, ...outing.second, second: undefined }] : [])]);
    // A day that found a place, heard of one or learned something was not an ordinary day.
    const eventful = items.length > before;
    for (const bundle of outing.bundles) if (!eventful || bundle.kind !== 'nothing') add(...bundleItem(w, outing, bundle));
    const bed = lodgingById(s, outing.overnight);
    if (bed) for (const id of [outing.person, outing.companion]) {
      const person = s.people.find((p) => p.id === id);
      if (!person) continue;
      person.base = bed.region;
      person.lodging = bed.id;
      remember(person, `A dry night at ${bed.name}, and an early start.`);
      moves.push({ person: person.id, home: bed.name, stay: true });
    }
  }

  for (const find of FINDS.filter((f) => s.discoveries[f.id]?.day === s.day && s.discoveries[f.id]?.by === 'sketch' && !items.some((i) => i.item.sketch === f.id))) {
    add({ person: s.people[0]!.id, kind: 'find', hint: find.rare ? 'rare' : 'unusual', title: `${SKETCHED}${find.name}`, text: findText(find, s.free), sketch: find.id, provisions: 0, materials: 0 }, NONE);
  }
  // The best creature that showed and went unsketched is remembered, and comes first tomorrow.
  const away = (options.missed ?? []).filter((id) => !s.discoveries[id]).map(findDef).sort((a, b) => Number(!!b.rare) - Number(!!a.rare))[0];
  if (away) {
    const lately = s.history.some((day) => day.day > s.day - GLIMPSE_QUIET_DAYS && day.items?.some((item) => item.title === GOT_AWAY));
    if (!s.tracked.includes(away.id) && !lately) add({ person: s.people[0]!.id, kind: 'nothing', hint: 'plain', title: GOT_AWAY, text: `${away.sighting?.line ?? away.tag.replace(/\.$/, '')}, and then gone.`, sketch: null, provisions: 0, materials: 0 }, NONE);
    if (!s.tracked.includes(away.id)) s.tracked.push(away.id);
  }

  // The day work on the boat begins, her hull comes down from the reeds; told before the day's building.
  // Whether or not anyone found her in the reeds before, this is when Aki reads what Grandfather left in her.
  const boatSite = s.buildings.find(site => site.kind === 'boat' && site.placed === s.day);
  if (!s.free && boatSite) {
    const first = !s.discoveries['old-boat'];
    add({ person: s.people.some(person => person.id === 'aki') ? 'aki' : s.people[0]!.id, kind: first ? 'find' : 'nothing', hint: 'story', title: 'Grandfather’s boat', text: hullText(isComplete(boatSite)), sketch: 'old-boat', provisions: 0, materials: 0 }, { ...NONE, find: first ? 'old-boat' : null });
  }
  restingItems(w, add);
  if (!s.free && s.region === 1 && isBuilt(s, 'cottage')) reveal(s, 'omagari');
  campLead(w, add);
  const beforeWishes = items.length;
  wishItems(w, add, options.arrived);
  const wished = items.slice(beforeWishes).some((e) => e.item.title.endsWith(', by the fire'));
  // The first Journey to reach Mio, or to see its first year out, opens Wander; the journal says so, once, that evening.
  const reachedMio = options.arrived && s.region === 1;
  if (s.opensWander && !s.free && (reachedMio || yearOf(s.day) >= 2)) {
    s.opensWander = false;
    const words = reachedMio
      ? 'A traveller by the inn fire says some people walk this river with nowhere to be, a bend at a time, just to see it.'
      : 'A whole year on the river now, spring round to spring again.';
    add({ person: s.people[0]!.id, kind: 'nothing', hint: 'story', title: WANDER_OPEN, text: `${words} Wander is on the menu now: the whole river, at your own pace.`, sketch: null, provisions: 0, materials: 0 }, NONE);
  }
  const garden = s.buildings.find((b) => s.people.some((p) => p.base === b.region) && b.kind === 'garden' && isComplete(b));
  // Whoever stayed by the fire picks it; on a day everyone was out, it waits.
  const picker = garden && (s.resting.find((id) => homeRegion(s, id) === garden.region) ?? s.resting[0]);
  if (picker) add({ person: picker, kind: 'supplies', hint: 'plain', title: '1 provision', text: 'Something ready in the kitchen plot.', sketch: null, provisions: 1, materials: 0 }, { provisions: 1, materials: 0, find: null, lead: null });

  const lookout = s.buildings.find((b) => b.kind === 'lookout' && b.region === s.region && isComplete(b));
  if (lookout) {
    const ridge = ['yamagoya', 'nishibayashi', 'matsubara'][s.region]!;
    reveal(s, ridge);
    for (const id of BEYOND[ridge] ?? []) hearOf(s, id);
  }

  const arriving = s.outings.flatMap((o) => o.bundles.flatMap((b) => (b.kind === 'find' ? [b.find] : [])));
  for (const id of newMembers(s, arriving)) {
    const encounter = s.outings.find((o) => o.bundles.some((b) => b.kind === 'find' && b.find === `${id}-meeting`));
    const host = s.people.find((p) => p.id === (encounter?.person ?? s.discoveries[`${id}-meeting`]?.by));
    // A new friend walks back with the person they met, including an overnight stay or individual move.
    // In Free Play they keep their own home along the river.
    const walksWith = s.free ? undefined : encounter ? host : (id === 'ren' || id === 'mina') ? host ?? s.people[0] : undefined;
    const home = s.free ? FREE_PLAY_HOMES[id] : walksWith;
    s.people.push({ id, base: home?.base ?? s.region, practice: {}, memories: [], ...(home?.lodging !== undefined ? { lodging: home.lodging } : {}) });
    const move = walksWith && moves.find((m) => m.person === walksWith.id);
    if (move) moves.push({ ...move, person: id });
    const outcome = `${nameOf(id)} joins us.`;
    // A meeting and a joining on the same evening are one story: the meeting's words, and the outcome.
    const meeting = items.find((e) => e.item.sketch === `${id}-meeting`);
    if (meeting) meeting.item.outcome = outcome;
    else add({ person: id, kind: 'nothing', hint: 'story', title: `${nameOf(id)} comes along`, text: JOINING[id] ?? `${nameOf(id)} will come with us.`, sketch: `friend-${id}`, provisions: 0, materials: 0, outcome }, NONE);
    s.news.push(`${nameOf(id)} has joined us.`);
    if (id === 'yui' && !s.free && !sailFound(s)) {
      const sail = findDef('mended-sail');
      add({ person: encounter?.person ?? host?.id ?? s.people[0]!.id, kind: 'find', hint: 'story', title: sail.name, text: 'Yui brings the folded sail to the dock. “Kept it dry all these years. Now we have somewhere to go.”', sketch: sail.id, provisions: 0, materials: 0 }, { ...NONE, find: sail.id });
    }
    // Ren knows the water: before anyone needs it, he warns of the stream below the village.
    if (id === 'ren' && !s.free && s.region === 0) s.news.push('Ren: “The stream below Seseragi floods for a couple of days with the melt, and again with the autumn rains. Nobody crosses then.”');
  }

  // Two friends' running thread, after anything tonight it might be about (Yui's sail).
  threadItems(s, add, { arrived: options.arrived, talked: options.talked, quiet: wished, tonight: new Set(items.flatMap((e) => (e.effect.find ? [e.effect.find] : []))) });

  // A reach found end to end shows one more place, by the fire.
  for (const id of secretsDue(s)) {
    reveal(s, id);
    const place = placeDef(id);
    add({ person: s.people[0]!.id, kind: 'nothing', hint: 'story', title: SECRET_REVEALS[id]!.title, text: SECRET_REVEALS[id]!.text, sketch: `place-${place.habitat}`, provisions: 0, materials: 0 }, NONE);
  }

  if (!options.arrived) groupMoves(s, moves, add);
  else {
    const name = REGIONS[s.region]!.name;
    const east = s.region === 2 && arrivalOf(s.course) === 'kawagiri';
    add({ person: s.people[0]!.id, kind: 'nothing', hint: 'story', title: `Arrived in ${east ? name : ARRIVED_AT[s.region] ?? name}`, text: (east ? ARRIVING_EAST : ARRIVING[s.region]) ?? `${name} is our new home.`, sketch: `arrival-${REGIONS[s.region]!.id}`, provisions: 0, materials: 0, ...(options.welcomeLine ? { outcome: options.welcomeLine } : {}) }, NONE);
  }

  // Two friends bringing home the same find tell it once.
  const told = new Set<string>();
  const unique = items.filter((e) => e.item.kind !== 'find' || !e.item.sketch || (!told.has(e.item.sketch) && !!told.add(e.item.sketch)));
  const merged = mergeSupplies(unique);
  const ordered = merged.map((entry, i) => ({ ...entry, i })).sort((a, b) => RANK[a.item.hint] - RANK[b.item.hint] || a.i - b.i);
  return { items: ordered.map((e) => e.item), effects: ordered.map((e) => e.effect), shown: 0, tomorrow: '', settled: false };
}

/**
 * The hull comes down from Mio's reeds to the dock, and Aki finds why
 * Grandfather turned back: the little bow seat from his plans, and the line
 * cut under it. Paid off as Aki steps aboard.
 */
export const HULL_CARVING = '“Gone home to meet the boy. Back for her when he can row.”';
export function hullText(ready: boolean): string {
  return `We float the grey hull down from the reeds below Mio to our dock. Under the little bow seat, cut in Grandfather’s hand: ${HULL_CARVING} Aki reads it twice. “I was the boy.” He runs a thumb along her joints. “Still sound.${ready ? '' : ' Let’s make her ready.'}”`;
}

/** The last village gets its own welcome: the walk down the river ends here. */
const SETTLE_TEXT: Record<string, string> = {
  Kawagiri: 'The fishing families make room by the drying racks. The sea is just over the dunes, and you can hear it all night.',
};

/** One line for the group's moves: "We settle in Seseragi", "Ren stays the night at Toroya Inn". */
function groupMoves(s: AdventureState, moves: ReadonlyArray<{ person: string; home: string; stay: boolean }>, add: Add): void {
  const groups = new Map<string, { people: string[]; home: string; stay: boolean }>();
  for (const move of moves) {
    const key = `${move.stay}:${move.home}`;
    const group = groups.get(key) ?? { people: [], home: move.home, stay: move.stay };
    if (!group.people.includes(move.person)) group.people.push(move.person);
    groups.set(key, group);
  }
  for (const { people, home, stay } of groups.values()) {
    const everyone = people.length > 1 && people.length === s.people.length;
    const who = everyone ? 'We' : sentence(people.map(nameOf));
    const plural = people.length > 1;
    const title = stay ? `${who} ${plural ? 'stay' : 'stays'} the night at ${home}` : `${who} ${plural ? 'settle' : 'settles'} in ${home}`;
    const text = stay ? 'A dry roof for the night, and an early start from there.' : SETTLE_TEXT[home] ?? 'Bedrolls down by a new fire. In the morning we walk out from here.';
    add({ person: people[0]!, kind: 'nothing', hint: 'unusual', title, text, sketch: stay ? 'structure-shelter' : null, provisions: 0, materials: 0 }, NONE);
  }
}

/** Everything one person carried home to eat or build with, as one bundle. */
function mergeSupplies(items: ReadonlyArray<{ item: UnpackItem; effect: UnpackEffect }>): Array<{ item: UnpackItem; effect: UnpackEffect }> {
  const out: Array<{ item: UnpackItem; effect: UnpackEffect }> = [];
  const byPerson = new Map<string, { item: UnpackItem; effect: UnpackEffect }>();
  for (const entry of items) {
    const isSupply = entry.item.kind === 'supplies' || entry.item.kind === 'materials';
    if (!isSupply) {
      out.push(entry);
      continue;
    }
    const held = byPerson.get(entry.item.person);
    if (!held) {
      const copy = { item: { ...entry.item }, effect: { ...entry.effect } };
      byPerson.set(entry.item.person, copy);
      out.push(copy);
      continue;
    }
    held.item.provisions += entry.item.provisions;
    held.item.materials += entry.item.materials;
    held.effect.provisions += entry.effect.provisions;
    held.effect.materials += entry.effect.materials;
    // Food words lead: Ren's catch says more than "useful timber".
    if (entry.item.provisions > 0 && held.item.provisions === entry.item.provisions) held.item.text = entry.item.text;
  }
  for (const { item } of byPerson.values()) {
    item.kind = item.provisions > 0 ? 'supplies' : 'materials';
    item.title = supplyTitle(item.provisions, item.materials);
  }
  return out;
}

/** "3 provisions · 1 material". */
export function supplyTitle(provisions: number, materials: number): string {
  const parts = [
    provisions ? `${provisions} ${provisions === 1 ? 'provision' : 'provisions'}` : '',
    materials ? `${materials} ${materials === 1 ? 'material' : 'materials'}` : '',
  ].filter(Boolean);
  return parts.join(' · ') || 'Nothing to carry';
}

/** The closing line of the evening: a place and a reason to go there, with chore status kept apart. */
export interface TomorrowLead {
  line: string;
  place?: string;
  note?: string;
}

const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
const LEVEL_STEP: Record<string, number> = { low: 0, middle: 1, high: 2 };
const FORAGE_WORDS: Record<string, string> = {
  orchard: 'fruit', garden: 'greens', woodland: 'mushrooms', meadow: 'herbs', gravel: 'cress', reeds: 'roots',
  saltmarsh: 'samphire', beach: 'shellfish', rockpools: 'shellfish', pines: 'pine nuts', farm: 'greens',
};
const ROUTE_LINES: Record<string, (to: string) => string> = {
  furumichi: (to) => `The old road at Furumichi may still be marked for ${to}.`,
  yamagoya: () => 'From Yamagoya’s ridge, Seseragi lies below. Its old path might join the road beyond the village.',
  omagari: (to) => `As the river falls, Omagari’s old stakes may show a way to ${to}. We can trace them from the higher bank.`,
  kitsuneyama: (to) => `The herons over Kitsuneyama Shrine seem to know a way to ${to}.`,
  higashimori: (to) => `While the river runs full, the old track above Higashimori may stay dry all the way to ${to}.`,
};

/** Once the bundles are known: the line about tomorrow. Called after `dusk`, so it sees the new leads. */
export function tomorrowFor(w: World, evening: Evening, tomorrowWorld?: World): TomorrowLead {
  const s = w.state;
  const note = choreNote(w);
  const tomorrow = todayOf(w.seed, s.day + 1);
  const ahead: World = { seed: w.seed, today: tomorrow, route: tomorrowWorld?.route,
    state: { ...s, day: tomorrow.day, phase: 'morning', plans: [], resting: [], outings: [] } };
  const reachable = new Map<string, boolean>();
  const canVisit = (id: string, activity?: Activity, survey = 0): boolean => {
    const key = `${id}|${activity ?? ''}|${survey}`;
    const cached = reachable.get(key);
    if (cached !== undefined) return cached;
    const place = placeDef(id);
    const can = s.people.some((person) => (activity ? [activity] : place.activities).some((doing) => {
      const plan = { person: person.id, place: id, activity: doing, item: null, companion: null, ...(place.kind === 'settlement' ? { visitOnly: true } : {}) };
      if (!planProblem(ahead, plan) && (!survey || journeyFor(ahead, plan).field >= survey)) return true;
      return place.kind === 'settlement' && !survey && !planProblem(ahead, { ...plan, visitOnly: false });
    }));
    reachable.set(key, can);
    return can;
  };
  const with_ = (lead: { line: string; place?: string }): TomorrowLead => ({ ...lead, ...(note ? { note } : {}) });
  const here = s.known.map(placeDef).filter((p) => p.region === s.region && p.id !== `${REGIONS[s.region]?.id}-welcome`);
  const openTomorrow = here.filter((p) => isOpen(p, tomorrow, s) && canVisit(p.id));

  // Ready to go: the biggest reason of all.
  const next = REGIONS[s.region + 1];
  // The lead already says everything is packed; the chore note would only repeat it.
  if (next && readyToMove(s)) return { line: `Everything is packed. In the morning the river can take us all down to ${next.name}.`, place: next.id };

  // (a) Something noticed today.
  const newLead = [...evening.effects].reverse().find((e) => e.lead)?.lead;
  if (newLead && canVisit(newLead.place, undefined, findDef(newLead.find).survey)) return with_({ line: newLead.line, place: newLead.place });

  // (b) A place the river or the season opens by morning.
  const opening = openTomorrow.filter((p) => !isOpen(p, w.today, s));
  if (opening.length > 0) {
    const place = opening.find((p) => s.leads.some((l) => l.place === p.id)) ?? opening.find((p) => !s.visits[p.id]) ?? opening[0]!;
    return with_({ line: openingLine(w.today, tomorrow, place.name, place.habitat, !!place.crossing), place: place.id });
  }

  // (c) A lead on its last good day.
  const ending = s.leads.find((l) => l.expires === s.day + 1 && !s.discoveries[l.find] && canVisit(l.place, undefined, findDef(l.find).survey));
  if (ending) return with_({ line: `${ending.line.replace(/[.!]$/, '')}. Best not leave it long.`, place: ending.place });

  // (d) The way on, turned into a place.
  const progress = progressLead(ahead, tomorrow, openTomorrow.map((p) => p.id));
  if (progress) return with_(progress);

  // A lead still holding.
  const live = s.leads.find((l) => l.expires > s.day && !s.discoveries[l.find] && canVisit(l.place, undefined, findDef(l.find).survey));
  if (live) return with_({ line: live.line, place: live.place });

  // (e) Somewhere nobody has walked yet.
  const unvisited = openTomorrow.find((p) => !s.visits[p.id] && p.teaser);
  if (unvisited) return with_({ line: unvisited.teaser!, place: unvisited.id });

  const promising = openTomorrow.find((p) => FINDS.some((f) => !s.discoveries[f.id] && p.activities.some((act) => findPossible(f, p, act, tomorrow, s))));
  if (promising) return with_({ line: promising.teaser ?? `Something is still waiting to be found at ${promising.name}.`, place: promising.id });

  const quiet = [...openTomorrow].sort((a, b) => (s.visits[a.id] ?? 0) - (s.visits[b.id] ?? 0))[0];
  if (quiet) return with_({ line: quiet.teaser ?? `Nobody has walked out to ${quiet.name} in a while.`, place: quiet.id });
  const home = REGIONS[s.region]!;
  return with_({ line: `The kettle will be on in ${home.name} in the morning.`, place: home.id });
}

/** "The water is falling; Koishihama’s stones should show by morning." */
function openingLine(today: Today, tomorrow: Today, name: string, habitat: string, crossing: boolean): string {
  if (tomorrow.season !== today.season) return `${SEASON_NAMES[tomorrow.season]} comes in the night, and ${name} should open with it.`;
  const fall = LEVEL_STEP[tomorrow.level]! - LEVEL_STEP[today.level]!;
  if (fall < 0) {
    if (crossing) return `The water is falling; the stones across to ${name} should be clear by morning.`;
    if (habitat === 'gravel') return `The water is falling; ${name}’s stones should show by morning.`;
    return `The water is falling; ${name} should open by morning.`;
  }
  if (fall > 0) return `The river is rising; by morning it should be up enough for ${name}.`;
  return `The weather is turning; ${name} should be open by morning.`;
}

/** The reach's progress as a place to go: "Fuchi’s fish would see us to Mio." */
function progressLead(w: World, tomorrow: Today, open: readonly string[]): { line: string; place?: string } | null {
  const s = w.state;
  const known = (id: string): boolean => s.known.includes(id) && open.includes(id);
  // Free Play points at its pages to fill: the first one with a place open tomorrow.
  if (s.free && s.voyage === 'preparing') {
    const aim = freeAims(s).find((a) => a.place && known(a.place));
    return aim ? { line: aim.line, place: aim.place } : null;
  }
  if (s.free || s.voyage === 'ended' || s.moving) return null;
  const found = (id: string): boolean => !!s.discoveries[id];
  const has = (id: string): boolean => s.people.some((p) => p.id === id);
  const atPlace = (id: string, line: string) => (known(id) ? { line, place: id } : null);
  const next = REGIONS[s.region + 1];

  if (s.region === 0 && !has('ren') && !found('ren-meeting')) { const l = atPlace(s.course.ren, REN_WORDS[s.course.ren].lead); if (l) return l; }
  if (s.region === 0 && has('ren') && !s.visits.seseragi) { const l = atPlace('seseragi', SESERAGI_LEAD); if (l) return l; }
  if (s.region === 0 && s.course.mina === 'kamimori' && has('ren') && s.visits.seseragi && !has('mina') && !found('mina-meeting')) { const l = atPlace('kamimori', 'The village botanist has been out gathering in the Kamimori woods for days. Someone could find her there.'); if (l) return l; }
  if (s.region === 1 && !found('aki-meeting')) { const l = atPlace('toroya', 'A carpenter lodges at Toroya Inn, and remembers the boats that went down to the sea.'); if (l) return l; }

  if (next && s.region < 2) {
    const departure = departureOf(s);
    if (!departure) return null;
    if (!departure.surveyed) {
      if (s.region === 1 && departure.prepared) return { line: goalLine(s), ...(departure.place ? { place: departure.place } : {}) };
      for (const route of gateRoutes(s)) if (known(route.place) && ROUTE_LINES[route.place]) return { line: ROUTE_LINES[route.place]!(next.name), place: route.place };
      return null;
    }
    // Aki's promise is his to tell: before anyone has met him, the reach's other leads speak instead.
    if (!departure.prepared && departure.work && !found('aki-meeting')) return null;
    if (!departure.prepared && departure.work) {
      if (departure.work.includes(' or ')) return { line: 'Aki promised Mio a cottage or a footbridge before he goes. Then he can finish the trip his grandfather began.', place: 'mio' };
      return departure.work.includes('cottage')
        ? { line: `Once Aki’s cottage stands in ${REGIONS[s.region]!.name}, his promise is kept, and he comes with us to ${next.name}.`, place: REGIONS[s.region]!.id }
        : { line: `A footbridge over the ${REGIONS[s.region]!.name} narrows would keep Aki’s promise. Then he comes with us to ${next.name}.`, ...(departure.place ? { place: departure.place } : {}) };
    }
    if (!departure.packed) return foodLead(w, tomorrow, open, `would see us to ${next.name}`);
    if (!departure.materialsPacked) return timberLead(w, tomorrow, open, `would see us to ${next.name}`);
    return null;
  }

  if (s.region !== 2 || s.voyage === 'sailing') return null;
  if (!s.known.includes('kawagiri') && !s.buildings.some((b) => b.region === 2 && ['dock', 'boat'].includes(b.kind))) return atPlace('shiobashi', 'Cross the stone arches of Shiobashi Bridge, then follow the path along the eastern bank.');
  if (s.people.every((p) => p.base === 2 && p.lodging !== undefined) && !s.buildings.some((b) => b.kind === 'boat')) return atPlace('kawagiri', 'Kawagiri’s fire is across the bridge, down by the sea. We could carry our packs there together.');
  if (!found('boat-ledger') && !found('boatyard-moulds')) return atPlace('funaya', 'Someone at Funaya Boatyard must remember how boats are made.');
  const placed = (kind: StructureKind): boolean => s.buildings.some((b) => b.kind === kind && b.region === s.region);
  if (!isBuilt(s, 'dock') && !placed('dock') && s.materials < structureDef('dock').cost) return timberLead(w, tomorrow, open, 'would build us a dock at the landing');
  if (isBuilt(s, 'dock') && !isBuilt(s, 'boat') && !placed('boat') && s.materials < structureDef('boat').cost) return timberLead(w, tomorrow, open, 'would go into the boat');
  if (!sailFound(s)) {
    if (!found('yui-meeting')) { const l = atPlace('takayuka', 'Someone in the stilt houses at Takayuka keeps the stories of the river, and might keep a sail.'); if (l) return l; }
    else if (!found('mended-sail')) { const l = atPlace('takayuka', 'Yui at Takayuka has something folded away for travellers.'); if (l) return l; }
    const l = atPlace('funaya', 'There may be an old sail rolled up in the loft at Funaya Boatyard.');
    if (l) return l;
  }
  if (!tideFound(s)) return atPlace('kawaguchi', 'At Kawaguchi the rocks keep the hours of the tide.') ?? atPlace('iso', 'The rock pools at Iso fill and empty with the tide.');
  if (s.provisions < SEA_PROVISIONS) return foodLead(w, tomorrow, open, 'would see us out to sea');
  return null;
}

/** The best place for food tomorrow, as a reason: "Fuchi’s fish would see us to Mio." */
function foodLead(w: World, tomorrow: Today, open: readonly string[], purpose: string): { line: string; place: string } | null {
  const best = bestFor(w, tomorrow, open, 'provisions');
  if (!best) return null;
  const word = best.activity === 'fish' ? 'fish' : FORAGE_WORDS[best.place.habitat] ?? 'stores';
  const owner = /s$/i.test(best.place.name) ? `The ${word} at ${best.place.name}` : `${best.place.name}’s ${word}`;
  return { line: `${owner} ${purpose}.`, place: best.place.id };
}

/** The best place for timber tomorrow: "Timber from Kamimori would go into the boat." */
function timberLead(w: World, tomorrow: Today, open: readonly string[], purpose: string): { line: string; place: string } | null {
  const best = bestFor(w, tomorrow, open, 'materials');
  if (!best) return null;
  const word = best.activity === 'forage' ? 'Timber' : 'Old boards';
  return { line: `${word} from ${best.place.name} ${purpose}.`, place: best.place.id };
}

function bestFor(w: World, tomorrow: Today, open: readonly string[], kind: 'provisions' | 'materials'): { place: PlaceDef; activity: Activity } | null {
  const s = w.state;
  const ahead: World = { ...w, today: tomorrow };
  let best: { place: PlaceDef; activity: Activity; amount: number } | null = null;
  for (const id of open) {
    const place = placeDef(id);
    // Nobody takes boards from a house people live in.
    if (place.kind === 'settlement' || place.region !== s.region || (kind === 'materials' && ['village', 'inn'].includes(place.habitat))) continue;
    for (const activity of place.activities) for (const person of s.people) {
      const plan = { person: person.id, place: id, activity, item: null, companion: null };
      if (planProblem(ahead, plan)) continue;
      const amount = expectedResources(ahead, place, plan)[kind];
      if (amount > (best?.amount ?? 0)) best = { place, activity, amount };
    }
  }
  return best;
}

/** "four of six", "none of six". */
const outOf = (n: number, total: number): string => `${n > 0 ? numberWord(n) : 'none'} of ${numberWord(total)}`;

/** Chore status, kept small under the lead: "Four of six provisions packed for Mio." */
export function choreNote(w: World): string | undefined {
  const s = w.state;
  if (s.free || s.voyage === 'ended' || s.moving) return undefined;
  const next = REGIONS[s.region + 1];
  const daysOn = (kind: StructureKind): string | undefined => {
    const building = s.buildings.find((b) => b.kind === kind && b.region === s.region && !isComplete(b));
    if (!building) return undefined;
    const def = structureDef(kind);
    const left = Math.ceil(Math.max(0, def.work - building.work) - 1e-6);
    return `${sentence([numberWord(left)])} more ${left === 1 ? 'day' : 'days'} on ${structureLabel(def.name)}.`;
  };
  if (next && s.region < 2) {
    const departure = departureOf(s);
    if (departure?.surveyed) {
      if (!departure.prepared && departure.work) return daysOn('cottage') ?? daysOn('bridge') ?? (s.discoveries['aki-meeting'] ? 'A cottage or a narrows footbridge would keep Aki’s promise to Mio.' : undefined);
      if (readyToMove(s)) return `Everything is packed for ${next.name}.`;
      const parts = [`${outOf(Math.min(s.provisions, departure.cost), departure.cost)} ${departure.cost === 1 ? 'provision' : 'provisions'}`];
      if (departure.materialsCost) parts.push(`${outOf(Math.min(s.materials, departure.materialsCost), departure.materialsCost)} ${departure.materialsCost === 1 ? 'material' : 'materials'}`);
      return `${sentence(parts)} packed for ${next.name}.`;
    }
  }
  if (s.region === 2 && s.voyage !== 'sailing') {
    if (!isBuilt(s, 'dock') && !isBuilt(s, 'boat') && !s.buildings.some(b => b.kind === 'dock') && (s.discoveries['boat-ledger'] || s.discoveries['boatyard-moulds'])) return 'We need a dock on the estuary bank to bring the old boat alongside for repairs.';
    const building = daysOn('dock') ?? daysOn('boat');
    if (building) return building;
    const boat = structureDef('boat').cost;
    if (isBuilt(s, 'dock') && !isBuilt(s, 'boat')) return s.materials >= boat ? 'Timber enough for the boat is put by.' : `${sentence([outOf(s.materials, boat)])} materials put by for the boat.`;
    if (isBuilt(s, 'boat')) {
      if (!sailFound(s)) return 'The boat is restored. We still need a sail.';
      if (!tideFound(s)) return 'The sail is ready. We still need to read the tide.';
      return s.provisions >= SEA_PROVISIONS ? 'Everything is packed for the sea.' : `${sentence([outOf(s.provisions, SEA_PROVISIONS)])} provisions packed for the sea.`;
    }
  }
  const other = s.buildings.find((b) => b.region === s.region && !isComplete(b) && !structureDef(b.kind).planting);
  return other ? daysOn(other.kind) : undefined;
}

/** Sets down one bundle by the fire. */
export function applyEffect(state: AdventureState, effect: UnpackEffect): void {
  // A recorded discovery's one-off reward must not be paid again on replay/load.
  if (effect.find && state.discoveries[effect.find]) return;
  state.provisions = Math.max(0, state.provisions + effect.provisions);
  state.materials = Math.max(0, state.materials + effect.materials);
  if (effect.find && !state.discoveries[effect.find]) {
    // The route actually surveyed determines which bank the arrival follows.
    const route = WAYS.find(way => WAY_ROUTES[way].find === effect.find);
    if (route && state.region === 1 && !WAYS.some(way => state.discoveries[WAY_ROUTES[way].find])) state.course = { ...state.course, way: route };
    state.discoveries[effect.find] = { day: state.day, by: effect.person };
    for (const id of findDef(effect.find).reveals ?? []) reveal(state, id);
    const follows = findDef(effect.find).follows;
    if (follows && !state.tracked.includes(follows)) state.tracked.push(follows);
    const person = state.people.find((p) => p.id === effect.person);
    if (person) remember(person, `Day ${state.day}: ${findDef(effect.find).name}.`);
  }
  if (effect.lead && !state.given.includes(effect.lead.id)) {
    state.given.push(effect.lead.id);
    state.leads.push(effect.lead);
    reveal(state, effect.lead.place);
  }
}

/**
 * Records a day out: practice, memories, what was learned, and what was
 * discovered. Going to a place only heard of finds it; exploring or tracking
 * from a known place hears of the places beyond (all of them for an explorer,
 * or anyone with the staff or group; otherwise one).
 */
function recordOuting(w: World, outing: Outing): { found: string | null; heard: string[]; story: string | null } {
  const s = w.state;
  const place = placeDef(outing.place);
  const found = s.rumoured.includes(place.id) ? place.id : null;
  if (found) reveal(s, found);
  s.visits[place.id] = (s.visits[place.id] ?? 0) + 1;
  for (const id of [outing.person, outing.companion]) {
    const person = s.people.find((p) => p.id === id);
    if (!person) continue;
    person.practice[outing.activity] = (person.practice[outing.activity] ?? 0) + 1;
    const doing = id === outing.person ? ACTIVITY_DOING[outing.activity] : `With ${nameOf(outing.person)}`;
    remember(person, `Day ${s.day}: ${doing} at ${place.name}.`);
  }
  const learned = (s.learned[place.id] ??= []);
  let story: string | null = null;
  const noticed: string[] = [];
  // One thing learned a visit: a line that points somewhere new first, then a
  // friend's own words, then the place's next fact. The rest wait for later visits.
  let shown = -1, rank = 0;
  place.learn.forEach((line, index) => {
    if (learned.includes(index)) return;
    if (line.activity && line.activity !== outing.activity) return;
    if (line.person && line.person !== outing.person && line.person !== outing.companion) return;
    if (!holds(line.when, w.today, s)) return;
    const pointsOn = (line.hearsOf ?? []).some((id) => !s.known.includes(id) && !s.rumoured.includes(id));
    if (pointsOn) {
      for (const id of line.hearsOf!) {
        if (s.known.includes(id) || s.rumoured.includes(id)) continue;
        noticed.push(id);
        hearOf(s, id);
      }
      learned.push(index);
    }
    // Something plainly noticed (a line with an id, see `deductions.ts`) is told as soon as it is true, like a friend's words.
    const r = pointsOn ? 3 : line.person || line.id ? 2 : 1;
    if (r > rank) { rank = r; shown = index; }
  });
  if (shown >= 0) {
    story = place.learn[shown]!.text;
    if (!learned.includes(shown)) learned.push(shown);
  }
  const field = outing.legs.filter((leg) => leg.kind === 'beat' && !leg.fork && leg.at &&
    (Math.hypot(leg.at.x - place.at.x, leg.at.y - place.at.y) < 50 || place.farther && Math.hypot(leg.at.x - place.farther.at.x, leg.at.y - place.farther.at.y) < 50))
    .reduce((seconds, leg) => seconds + leg.end - leg.start, 0);
  if (FINDS.some((find) => find.survey && find.survey > field + .01 && !s.discoveries[find.id] &&
    findPossible(find, place, outing.activity, w.today, s, outing.person))) {
    story = `The walk from ${homeName(s, outing.person)} left too little daylight to follow the whole way. A night nearer ${place.name} would leave longer to look.`;
  }
  const heard: string[] = [...noticed];
  if (outing.activity === 'explore' || outing.activity === 'track') {
    const beyond = (BEYOND[place.id] ?? []).filter((id) => !s.known.includes(id) && placeDef(id).region <= (s.free ? REGIONS.length - 1 : s.region));
    const wide = outing.activity === 'explore' && (personDef(outing.person).gift === 'explore' || outing.item === 'walking-staff' || !!outing.companion);
    const newlyFound = outing.activity === 'explore' ? beyond.shift() : undefined;
    if (newlyFound) {
      reveal(s, newlyFound);
      const routeClue = place.learn.find((line) => line.activity === 'explore' && holds(line.when, w.today, s));
      if (routeClue && !place.learn.some((line) => line.person && line.text === story)) story = routeClue.text;
    }
    heard.push(...beyond.filter((id) => !s.rumoured.includes(id)).slice(0, wide ? 2 : 1));
    for (const id of heard) hearOf(s, id);
    if (newlyFound) return { found: newlyFound, heard, story: place.id === 'furumichi' ? furumichiReport(s, w.today.level) : story };
  }
  if (place.id === 'furumichi') {
    // Keep a failed-survey explanation, but never let a generic learned fact hide the water.
    story = `${furumichiReport(s, w.today.level)}${story?.startsWith('The walk from ') ? ` ${story}` : ''}`;
  }
  return { found, heard, story };
}

/** A place is on the map once someone has been there (or a lead names it outright). */
export function reveal(state: AdventureState, id: string): void {
  state.rumoured = state.rumoured.filter((r) => r !== id);
  if (state.known.includes(id)) return;
  state.known.push(id);
  state.revealed.push(id);
}

/** A place is heard of: a faint mark on the map, reached only by exploring. */
export function hearOf(state: AdventureState, id: string): void {
  if (state.known.includes(id) || state.rumoured.includes(id)) return;
  state.rumoured.push(id);
}

function remember(person: { memories: string[] }, line: string): void {
  person.memories.unshift(line);
  person.memories.length = Math.min(person.memories.length, 5);
}

type Add = (item: Omit<UnpackItem, 'id'>, effect: Omit<UnpackEffect, 'person'>) => void;

/** A friend's words, if they fit where the story stands. */
const spoken = (w: World, line: string | null, region: number): string | null => line && fitsStory(line, w.state, region) ? line : null;

function bundleItem(w: World, outing: Outing, bundle: Bundle): Parameters<Add> {
  outing = { ...outing, place: bundle.sourcePlace ?? outing.place, activity: bundle.sourceActivity ?? outing.activity };
  const person = outing.person;
  if (bundle.kind === 'supplies' || bundle.kind === 'materials') {
    const n = bundle.amount;
    const material = bundle.kind === 'materials';
    const resources = { provisions: material ? 0 : n, materials: material ? n : 0 };
    return [
      { person, kind: bundle.kind, hint: 'plain', title: material ? supplyTitle(0, n) : supplyTitle(n, 0), text: material ? 'Useful timber, fibre and stone.' : (spoken(w, catchWords(person, outing.activity, w.state.free ? placeDef(outing.place).region : w.state.region, placeDef(outing.place).habitat, w.today.day), placeDef(outing.place).region) ?? SUPPLY_TEXT[outing.activity]), sketch: null, ...resources },
      { ...resources, find: null, lead: null },
    ];
  }
  if (bundle.kind === 'find') {
    const find = findDef(bundle.find);
    const resources = { provisions: find.reward?.provisions ?? 0, materials: find.reward?.materials ?? 0 };
    return [
      { person, kind: 'find', hint: find.id.endsWith('-meeting') || WAY_ON_FINDS.has(find.id) ? 'story' : find.rare ? 'rare' : 'unusual', title: find.id.endsWith('-meeting') ? `Met ${find.name}` : find.name, text: findText(find, w.state.free), sketch: find.id,
        ...(find.id === 'aki-meeting' && !w.state.free ? { outcome: 'We said we’d help Aki build a cottage or footbridge in Mio. Then he’ll come with us.' } : {}),
        ...(deductionLine(find, w.state, person) ? { outcome: deductionLine(find, w.state, person)! } : {}), ...resources },
      { ...resources, find: find.id, lead: null },
    ];
  }
  if (bundle.kind === 'lead') {
    const def = leadDef(bundle.lead);
    const place = placeDef(def.to);
    return [
      { person, kind: 'lead', hint: 'unusual', title: `A lead: ${place.name}`, text: def.line, sketch: `place-${place.habitat}`, provisions: 0, materials: 0 },
      { provisions: 0, materials: 0, find: null, lead: makeLead(w.seed, w.state, def.id, w.state.day) },
    ];
  }
  const kind = EMPTY_TEXT[hashString(`${w.seed}:${w.state.day}:${person}:empty`) % EMPTY_TEXT.length]!;
  return [
    { person, kind: 'nothing', hint: 'plain', title: 'Nothing unusual today', text: kind, sketch: null, provisions: 0, materials: 0 },
    { provisions: 0, materials: 0, find: null, lead: null },
  ];
}

/** Friends who stayed home: a supply for tending things, or a day's building. */
function restingItems(w: World, add: Add): void {
  const s = w.state;
  if (s.resting.length === 0) return;
  // A site someone reached today, before any work was counted on it, still has them as its builder.
  const reached = s.buildings.find((b) => b.id === s.workedOn && !b.worked);
  const nav = w.route ? { route: w.route } : undefined;
  let campProvisions = ECONOMY.campProvisions;
  const told = new Set<number>();
  for (const id of s.resting) {
    const projects = s.buildings.filter((b) => b.worked?.day === s.day && b.worked.by.includes(id));
    if (!projects.length && reached && canWorkOn(s, id, reached, nav)) projects.push(reached);
    for (const building of projects) {
      if (told.has(building.id)) continue;
      told.add(building.id);
      const def = structureDef(building.kind);
      const done = isComplete(building);
      const left = Math.ceil(Math.max(0, def.work - building.work) - 1e-6);
      add(
        { person: id, contributors: building.worked ? s.people.map(person => person.id).filter(person => building.worked!.by.includes(person) && s.resting.includes(person)) : [id], kind: 'nothing', hint: done ? 'story' : 'plain', title: def.name, text: done ? 'Finished today.' : `${sentence([numberWord(left)])} more ${left === 1 ? 'day' : 'days'} of work.`, sketch: `structure-${def.id}`, provisions: 0, materials: 0, ...(done && FINISHED[def.id] ? { outcome: FINISHED[def.id] + (building.kind === 'bridge' && building.region === 1 && !departureOf(s)?.surveyed ? ' The far-bank garden and wooded paths are open. We still need to chart the way south.' : '') } : {}) },
        { provisions: 0, materials: 0, find: null, lead: null },
      );
    }
    if (projects.length) continue;
    const n = campProvisions;
    campProvisions = 0;
    const garden = s.buildings.some((b) => b.kind === 'garden' && b.region === homeRegion(s, id) && isComplete(b));
    add(
      { person: id, kind: n ? 'supplies' : 'nothing', hint: 'plain', title: n ? supplyTitle(n, 0) : 'Tending camp', text: garden ? GARDEN_REST_TEXT : REST_TEXT, sketch: null, provisions: n, materials: 0 },
      { provisions: n, materials: 0, find: null, lead: null },
    );
  }
}

/**
 * Something noticed from home. Someone who stayed in may bring a lead; and if
 * there is no lead at all, the settlement always offers one, so every evening
 * points somewhere.
 */
function campLead(w: World, add: Add): void {
  const s = w.state;
  const leadsToday = s.outings.some((o) => o.bundles.some((b) => b.kind === 'lead'));
  if (leadsToday || (s.resting.length === 0 && s.leads.length > 0)) return;
  const def = CAMP_LEADS.find((l) => placeDef(l.to).region === s.region && !s.given.includes(l.id) && !leadSettled(s, l.find) && holds(l.when, w.today, s));
  if (!def) return;
  const person = s.resting[0] ?? s.people[0]!.id;
  const place = placeDef(def.to);
  add(
    { person, kind: 'lead', hint: 'unusual', title: `A lead: ${place.name}`, text: def.line, sketch: `place-${place.habitat}`, provisions: 0, materials: 0 },
    { provisions: 0, materials: 0, find: null, lead: makeLead(w.seed, s, def.id, s.day) },
  );
}


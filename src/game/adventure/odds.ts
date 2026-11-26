/**
 * The odds of an outing, and the forecast the notebook shows before the
 * player commits. One small score, built from reasons the player can read:
 *
 *   +2 the friend's gift is this kind of outing      +1 a companion
 *   +1 practised (three or more outings of the kind) +1 the right item
 *   ±1 the place today (salmon running, mist, ice)   -1 rain or snow, no cape
 *   +1 a building that helps (platform, lookout, shelter)
 *
 * Score 0 or less is "unlikely", 1 to 2 "even", 3 or more "likely". Following
 * a lead, or going for a story find in ordinary conditions, is "certain".
 * The same assessment decides the day, so the forecast never lies.
 */

import { dist } from '../core/math';
import { expectedResources, outingCost } from './economy';
import { journeyFor, MIN_FIELD_SECONDS, walkSeconds } from './travel';
export { HOME_BY, PACE, walkSeconds, routeSeconds } from './travel';
import type { FindDef, PlaceDef } from './catalogue';
import { findPossible, placeToday } from './conditions';
import { FINDS, PLACES, hasPlace, placeActivities, placeDef } from './content';
import type { Activity, Chance, Forecast, OutingPlan } from './model';
import { nameOf, outingPace, personDef } from './people';
import { BEYOND } from './discovery';
import type { AdventureState, Lead } from './state';
import { equipmentDef } from './structures';
import { campOf } from './regions';
import { numberWord, sentence } from './text';
import { availableLodgings, homeName, homeRegion, lodgingById, lodgingOf, overnightAt, nearestBuilt, readyBuildings, setOutFrom, todayOf, type World } from './world';

/** Places at least this many seconds' walk away count as far. */
const FAR_WALK = 7;

export const PROBABILITY: Record<Exclude<Chance, 'certain'>, number> = { unlikely: 0.25, even: 0.5, likely: 0.8 };

const PRACTICE_NOUN: Record<Activity, string> = {
  explore: 'exploring',
  fish: 'fishing',
  forage: 'foraging',
  investigate: 'looking closely',
  visit: 'visiting',
  track: 'tracking',
};

export interface Reason {
  sign: '+' | '-';
  text: string;
  /** Strength, for ordering; certain reasons come first. */
  weight: number;
}

export interface Assessment {
  problem: string | null;
  score: number;
  certain: boolean;
  chance: Chance;
  pips: 0 | 1 | 2 | 3;
  reasons: Reason[];
  /** The find a certain outing brings home. */
  sure: FindDef | null;
  lead: Lead | null;
  /** Unfound finds that could come home today. */
  candidates: FindDef[];
  beats: number;
  farther: boolean;
  /** Seconds of walking each way. */
  walk: number;
  provisions: number;
  materials: number;
  provisionCost: number;
  geography: boolean;
  closesTomorrow: boolean;
  length: string;
}

const isWet = (w: World): boolean => w.today.weather === 'rain' || w.today.weather === 'snow';

/** Why this outing cannot be planned this morning, or null. */
export function planProblem(w: World, plan: OutingPlan): string | null {
  const s = w.state;
  if (s.voyage === 'gathering' || s.voyage === 'sailing') return 'The boat is leaving.';
  if (s.phase !== 'morning') return 'The day has begun. Plans are made in the morning.';
  if (!s.people.some((p) => p.id === plan.person)) return 'That person is not with us yet.';
  if (!hasPlace(plan.place)) return 'Nobody knows the way there yet.';
  const relocating = placeDef(plan.place).kind === 'settlement' && !plan.visitOnly;
  const camping = plan.lodging !== undefined;
  if (!s.free && !relocating && s.provisions <= 0 && (![plan.activity, ...(plan.second ? [plan.second.activity] : [])].every((activity) => activity === 'forage' || activity === 'fish'))) return 'The packs are empty. A day fishing or gathering would fill them.';
  const base = homeRegion(s, plan.person);
  if (camping) {
    const shelter = lodgingById(s, plan.lodging);
    if (!shelter) return 'No roof there yet. Finish the shelter, or explore the hut first.';
    if (placeDef(plan.place).kind !== 'settlement' || placeDef(plan.place).region !== shelter.region || plan.activity !== 'visit') return 'Choose the shelter as today’s destination.';
    if (shelter.region !== base) return 'Move to this town before using its shelter.';
    if (lodgingOf(s, plan.person)?.id === shelter.id) return `Already staying at ${shelter.name}.`;
    if (typeof shelter.id === 'string' && placeToday(placeDef(shelter.id), w.today, s).state === 'closed') return 'The way to this hut is closed today.';
    if (walkSeconds(setOutFrom(s, shelter, plan.person), shelter.fire, outingPace(plan)) > 32) return 'Too far to reach before dusk.';
  }
  if (!camping && relocating && placeDef(plan.place).region === base && !lodgingOf(s, plan.person)) return 'That is home.';
  if (relocating && plan.companion) return 'Each companion moves on their own.';
  const heardOf = s.rumoured.includes(plan.place);
  if (!s.known.includes(plan.place) && !heardOf) return 'Nobody knows the way there yet.';
  if (heardOf && plan.activity !== 'explore') return 'Nobody has found the way there yet. Someone will have to explore.';
  const place = placeDef(plan.place);
  if (plan.overnight !== undefined) {
    const bed = overnightAt(s, plan.overnight);
    if (!bed || bed.id !== place.id || bed.region !== base || relocating || camping) return 'Nobody knows a hut or inn to sleep at there.';
    if (lodgingOf(s, plan.person)?.id === bed.id) return 'Already sleeping here; the day ends here anyway.';
  }
  if (place.region > (s.free ? 2 : s.region)) return 'The mist has not lifted from there yet.';
  if (!s.free && !relocating && place.region !== base) return `Move ${nameOf(plan.person)}’s camp to ${['Seseragi', 'Mio', 'Kawagiri'][place.region]} first.`;
  const today = placeToday(place, w.today, s);
  if (today.state === 'closed') return today.line;
  if (plan.companion && !s.people.some((p) => p.id === plan.companion)) return 'That person is not with us yet.';
  if (plan.second) {
    if (relocating || camping || plan.overnight) return 'Choose a second stop or an overnight move for this outing.';
    if (!hasPlace(plan.second.place) || plan.second.place === plan.place) return 'Choose a different place for the second stop.';
    const second = placeDef(plan.second.place);
    if (second.kind === 'settlement' || !s.known.includes(second.id) || second.region !== place.region) return 'Choose a known place in the same reach for a second stop.';
    const there = placeToday(second, w.today, s);
    if (there.state === 'closed') return `${second.name}: ${there.line}`;
    if (!second.activities.includes(plan.second.activity)) return `Choose an activity available at ${second.name}.`;
  }
  const journey = journeyFor(w, plan);
  if (!journey.reachable) return 'No way across today. When the water falls, or with a bridge, there will be.';
  if (!relocating && journey.field < MIN_FIELD_SECONDS * (plan.second ? 2 : 1)) return plan.second ? 'Not daylight enough for both stops and the walk home. Pick a nearer second stop, or just one.' : `Too far from ${homeName(s, plan.person)} to work and return by dusk. ${closerCamp(w, plan)}`;
  if (!placeActivities(place, s.free).includes(plan.activity) && !(heardOf && plan.activity === 'explore') && !(relocating && plan.activity === 'visit')) return `Nobody can ${plan.activity === 'investigate' ? 'look closely' : plan.activity} at ${place.name}.`;
  if (plan.companion !== null) {
    if (homeRegion(s, plan.companion) !== base || lodgingOf(s, plan.companion)?.id !== lodgingOf(s, plan.person)?.id) return 'They are sleeping in different places, so they can’t set out together.';
    if (plan.companion === plan.person) return 'Choose someone else to go along.';
    if (!s.people.some((p) => p.id === plan.companion)) return 'That person is not with us yet.';
    if (s.plans.some((p) => p.person === plan.companion)) return `${nameOf(plan.companion)} has a plan of their own.`;
    const taken = s.plans.find((p) => p.person !== plan.person && p.companion === plan.companion);
    if (taken) return `${nameOf(plan.companion)} is already going with ${nameOf(taken.person)}.`;
  }
  const along = s.plans.find((p) => p.companion === plan.person);
  if (along) return `${nameOf(plan.person)} is going with ${nameOf(along.person)}.`;
  if (plan.item) {
    if (!s.equipment.includes(plan.item)) return `We have no ${equipmentDef(plan.item).name.toLowerCase()} yet.`;
    const holder = s.plans.find((p) => p.person !== plan.person && p.item === plan.item);
    if (holder) return `${nameOf(holder.person)} is taking the ${equipmentDef(plan.item).name.toLowerCase()}.`;
  }
  const committed = s.plans.filter((p) => p.person !== plan.person).reduce((n, p) => n + outingCost(w, p), 0);
  if (committed + outingCost(w, plan) > s.provisions) return 'Too long a walk for what is in the packs. Start from nearer, or fish and gather first.';
  return null;
}

/** A live lead pointing here, if following it today would make its find certain. */
export function leadFor(w: World, place: PlaceDef, activity: Activity, person?: string, field = Infinity, taken: ReadonlySet<string> = new Set()): Lead | null {
  for (const lead of w.state.leads) {
    if (lead.place !== place.id || w.today.day <= lead.given || w.today.day > lead.expires) continue;
    if (w.state.discoveries[lead.find] || taken.has(lead.find)) continue;
    const find = FINDS.find((f) => f.id === lead.find);
    if (find && (find.survey ?? 0) <= field && findPossible(find, place, activity, w.today, w.state, person)) return lead;
  }
  return null;
}

/**
 * Finds the friends planned ahead of this one will bring home first: outings set
 * off in plan order, so two friends never both count on the same story or lead.
 */
function claimedAhead(w: World, plan: OutingPlan): Set<string> {
  const s = w.state;
  const claimed = new Set<string>();
  if (s.phase !== 'morning') return claimed;
  const index = s.plans.findIndex((p) => p.person === plan.person);
  for (const ahead of (index < 0 ? s.plans : s.plans.slice(0, index))) {
    if (ahead.person === plan.person) continue;
    const sure = assess(w, ahead, undefined, new Set(claimed)).sure;
    if (sure) claimed.add(sure.id);
  }
  return claimed;
}

export function assess(w: World, plan: OutingPlan, fieldBudget?: number, ahead?: ReadonlySet<string>): Assessment {
  const s = w.state;
  const problem = fieldBudget === undefined ? planProblem(w, plan) : null;
  const place = hasPlace(plan.place) ? placeDef(plan.place) : null;
  if (!place || plan.second && !hasPlace(plan.second.place)) return emptyAssessment(problem ?? 'Nobody knows the way there yet.');

  const person = personDef(plan.person);
  const wet = isWet(w);
  const caped = plan.item === 'rain-cape';
  const journey = journeyFor(w, plan);
  const field = fieldBudget ?? journey.field / (plan.second ? 2 : 1);
  const walk = journey.outward;
  const farther = fieldBudget === undefined && !plan.second && !!place.farther && (plan.activity === 'explore' || plan.item === 'walking-staff');
  const beats = farther ? 3 : 2;

  const reasons: Reason[] = [];
  let score = 0;
  const add = (points: number, text: string): void => {
    score += points;
    reasons.push({ sign: points >= 0 ? '+' : '-', text, weight: Math.abs(points) });
  };

  // Not a score, only something worth knowing.
  const note = (sign: '+' | '-', text: string, weight: number): void => {
    reasons.push({ sign, text, weight });
  };
  const fishing = plan.activity === 'fish';
  const built = (kind: string): boolean => readyBuildings(s).some((b) => b.kind === kind && b.region === place.region);

  // Who goes: the right friend is clearly better, anyone else can still go.
  if (person.gift === plan.activity) add(2, person.giftReason);
  else {
    const better = s.people.find((p) => p.id !== plan.person && personDef(p.id).gift === plan.activity);
    if (better) note('-', `${nameOf(better.id)} would do better here`, 0.6);
    else if (plan.activity === 'track') note('-', 'Nobody here reads tracks yet', 0.6);
  }
  const practice = s.people.find((p) => p.id === plan.person)?.practice[plan.activity] ?? 0;
  if (practice >= 3) add(1, `Practised at ${PRACTICE_NOUN[plan.activity]}`);

  // What they carry, and who goes with them: one clear thing each.
  if (plan.item === 'fishing-kit' && fishing) add(1, 'The fishing kit');
  if (plan.item === 'field-kit' && FIELD_WORK.includes(plan.activity)) add(1, 'The field kit');
  if (plan.item === 'walking-staff' && place.farther && plan.activity !== 'explore') note('+', `The staff: on to ${place.farther.name}`, 1);
  if (plan.companion) add(1, `${nameOf(plan.companion)} along for the walk`);

  // The place, the river and the weather today.
  const platform = fishing && !!nearestBuilt(s, 'platform', place.at, 650);
  const rule = placeToday(place, w.today, s).rule;
  if (rule?.odds && rule.reason && (!rule.activities || rule.activities.includes(plan.activity))) {
    if (platform && rule.odds < 0) note('+', 'The platform is safe at high water', 0.8);
    else add(rule.odds, rule.reason);
  }
  const sheltered = !!lodgingOf(s, plan.person);
  if (wet && caped) note('+', 'The cape keeps the weather off', 0.5);
  else if (wet && sheltered) note('+', 'A dry start from the overnight base', 0.5);
  else if (wet) add(-1, w.today.weather === 'snow' ? 'No cape in the snow' : 'No cape in the rain');

  // What has been built.
  if (platform) add(1, 'The fishing platform nearby');
  if (fishing && place.region === 2 && built('dock')) add(1, 'Fishing off the dock');
  if (plan.activity === 'explore' && built('lookout')) add(1, 'Seen first from the lookout');
  if (sheltered) add(1, `Starting from ${homeName(s, plan.person)}`);

  // Geography is a dependable primary result; finds remain contextual surprises.
  const beyond = (BEYOND[place.id] ?? []).filter((id) => !s.known.includes(id) && placeDef(id).region <= s.region);
  const geography = plan.activity === 'explore' && (s.rumoured.includes(place.id) || beyond.length > 0);
  if (s.rumoured.includes(place.id)) note('+', 'Finding the way there', 8);
  if (plan.activity === 'explore' && beyond[0]) note('+', `Reveals ${placeDef(beyond[0]).name}`, 7);
  else if (plan.activity === 'explore' && !geography) note('-', 'Every way on from here is known', 0.5);
  else if (plan.activity === 'track' && beyond.length) note('+', 'Tracks may lead somewhere new', 1.6);

  // Tomorrow.
  const closesTomorrow = placeToday(place, todayOf(w.seed, w.today.day + 1), s).state === 'closed' && placeToday(place, w.today, s).state !== 'closed';
  if (closesTomorrow) {
    note('+', 'Last chance before it closes', 0.7);
  }

  const packed = new Set([
    ...s.outings.flatMap((o) => o.person === plan.person ? [] : o.bundles.flatMap((b) => b.kind === 'find' ? [b.find] : [])),
    ...(ahead ?? (fieldBudget === undefined ? claimedAhead(w, plan) : [])),
  ]);
  const candidates = FINDS.filter((f) => !s.discoveries[f.id] && !packed.has(f.id) && (farther || !f.farther) && (f.survey ?? 0) <= field && findPossible(f, place, plan.activity, w.today, s, plan.person));
  const encounter = candidates.find((find) => find.id.endsWith('-meeting'));
  const lead = encounter ? null : leadFor(w, place, plan.activity, plan.person, field, packed);
  const needsTime = FINDS.some((f) => f.survey && f.survey > field && !s.discoveries[f.id] && findPossible(f, place, plan.activity, w.today, s, plan.person));
  if (needsTime) note('-', 'Time for a visit, but not the whole survey; sleep nearer to leave longer to look.', 10);
  const missingClue = FINDS.find((f) => f.story && f.after && !s.discoveries[f.after] && !s.discoveries[f.id] && !(f.unless && s.discoveries[f.unless]) && f.at?.includes(place.id) && f.activities?.includes(plan.activity));
  if (missingClue) note('+', missingClue.hint, 6);
  const story = encounter ?? candidates.find((f) => f.story) ?? null;
  const sure = lead ? FINDS.find((f) => f.id === lead.find)! : story;
  if (lead) reasons.unshift({ sign: '+', text: lead.expires === w.today.day ? 'Following a lead, on its last day' : 'Following a lead', weight: 9 });
  else if (story?.story) reasons.unshift({ sign: '+', text: story.story.reason, weight: 9 });
  else if (candidates.length === 0 && !geography) reasons.push({ sign: '-', text: 'Nothing new to find here now', weight: 3 });

  let { provisions, materials } = expectedResources(w, place, plan);
  if (place.id === 'furukawa' && plan.activity === 'forage' && s.discoveries['cress-bed'] && w.today.season !== 3) note('+', 'The cress bed we left growing', 5);
  if (provisions > 0) note('+', `Usually ${numberWord(provisions)} ${provisions === 1 ? 'provision' : 'provisions'}`, 4);
  if (materials > 0) note('+', `Usually ${numberWord(materials)} ${materials === 1 ? 'material' : 'materials'}`, 4);
  if (plan.second || fieldBudget !== undefined) { provisions = Math.ceil(provisions / 2); materials = Math.ceil(materials / 2); }
  if (plan.second && fieldBudget === undefined) {
    const second = assess(w, { ...plan, ...plan.second, second: undefined }, field);
    provisions += second.provisions; materials += second.materials;
    note('+', `Then ${plan.second.activity} at ${placeDef(plan.second.place).name} · two shorter visits`, 8);
  }
  const picnic = outingCost(w, plan);
  if (picnic) note('-', `${sentence([numberWord(picnic)])} ${picnic === 1 ? 'provision' : 'provisions'} for the long walk`, 3.5);
  if (plan.activity === 'forage' && built('garden')) note('+', 'One more provision, thanks to the garden', 0.4);

  const certain = !!sure || geography;
  const chance: Chance = certain ? 'certain' : chanceOf(score);
  const pips = certain ? 3 : candidates.length === 0 ? 0 : (({ unlikely: 1, even: 2, likely: 3 }) as const)[chance as Exclude<Chance, 'certain'>];
  reasons.sort((a, b) => b.weight - a.weight);
  return {
    problem, score, certain, chance, pips, reasons: reasons.slice(0, 4), sure, lead, candidates,
    beats, farther, walk, provisions, materials, provisionCost: picnic, geography, closesTomorrow, length: plan.second ? 'Two stops · home by dusk' : lengthOf(walk, farther),
  };
}

export function chanceOf(score: number): Exclude<Chance, 'certain'> {
  return score <= 0 ? 'unlikely' : score <= 2 ? 'even' : 'likely';
}

/** The kinds of outing the field kit helps with. */
const FIELD_WORK: readonly Activity[] = ['forage', 'investigate', 'track'];

function lengthOf(walk: number, farther: boolean): string {
  if (farther) return 'A long day';
  return walk >= FAR_WALK ? 'Home by dusk' : 'Back by mid-afternoon';
}

function emptyAssessment(problem: string): Assessment {
  return {
    problem, score: 0, certain: false, chance: 'unlikely', pips: 0, reasons: [], sure: null, lead: null, candidates: [],
    beats: 1, farther: false, walk: 3, provisions: 0, materials: 0, provisionCost: 0, geography: false, closesTomorrow: false, length: '',
  };
}

export function forecastOf(a: Assessment): Forecast {
  return {
    provisions: a.provisions,
    materials: a.materials,
    provisionCost: a.provisionCost,
    newGround: a.geography,
    followingLead: !!a.lead,
    discoveryHint: a.sure?.story?.reason,
    closesTomorrow: a.closesTomorrow,
    problem: a.problem,
    chance: a.chance,
    pips: a.pips,
    reasons: a.reasons.map((r) => ({ sign: r.sign, text: r.text })),
    length: a.length,
    beats: a.beats,
  };
}

/** Friends standing in the morning without a plan or a rest. */
export function unplanned(state: AdventureState): string[] {
  const busy = new Set<string>([...state.resting]);
  for (const p of state.plans) {
    busy.add(p.person);
    if (p.companion) busy.add(p.companion);
  }
  return state.people.map((p) => p.id).filter((id) => !busy.has(id));
}

/** Suggest only a known camp; unexplored routes remain the player's question. */
function closerCamp(w: World, plan: OutingPlan): string {
  const place = placeDef(plan.place), from = setOutFrom(w.state, place, plan.person);
  const camps = availableLodgings(w.state).filter((c) => c.region === place.region && c.id !== lodgingOf(w.state, plan.person)?.id);
  const town = PLACES.find((p) => p.kind === 'settlement' && p.region === place.region && w.state.known.includes(p.id));
  if (town) camps.push({ id: town.id, region: town.region, name: town.name, at: town.at, fire: campOf(town.region).fire });
  const nearer = camps.filter((camp) => dist(camp.fire, place.at) < dist(from, place.at) * .75)
    .sort((a, b) => dist(a.fire, place.at) - dist(b.fire, place.at))[0];
  return nearer ? `It is closer from ${nearer.name}, or from a shelter nearer still.` : 'A night at a nearer hut or shelter would do it.';
}

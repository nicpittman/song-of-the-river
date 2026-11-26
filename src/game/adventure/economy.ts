import { placeDef } from './content';
/** Small, shared balance knobs. Geography and weather determine the purpose of an outing. */
import { dist } from '../core/math';
import type { PlaceDef } from './catalogue';
import type { OutingPlan } from './model';
import { personDef } from './people';
import { holds, lodgingOf, nearestBuilt, readyBuildings, setOutFrom, type World } from './world';

export const ECONOMY = {
  startingProvisions: 4, startingMaterials: 3, dailyUpkeep: 1, campProvisions: 1,
  ambitiousDistance: 1700, expeditionCost: 1,
  journeys: [4, 5] as readonly number[], sea: 8,
  journeyMaterials: [1, 0] as readonly number[],
  /** The supper a reach shares with newcomers on the evening they arrive, so the first day there is not spent finding food. */
  welcome: [0, 2, 4] as readonly number[],
  /** And the timber a coast village can spare, since the boat is built there. */
  welcomeMaterials: [0, 0, 3] as readonly number[],
};

const FOOD = new Set(['garden', 'orchard', 'farm', 'pasture', 'terraces']);
const SALVAGE = new Set(['mill', 'hut', 'boatyard', 'road', 'village', 'ruins']);

export function expectedResources(w: World, place: PlaceDef, plan: OutingPlan): { provisions: number; materials: number } {
  const gifted = personDef(plan.person).gift === plan.activity;
  let provisions = 0;
  let materials = 0;
  if (plan.activity === 'fish') {
    provisions = Math.max(1, place.yields?.fish ?? 1) + (gifted ? 1 : 0);
    const rule = place.rules?.find((r) => holds(r.when, w.today, w.state) && r.activities?.includes('fish'));
    if (rule?.odds && rule.odds > 0) provisions++;
    if (rule?.odds && rule.odds < 0 && !nearestBuilt(w.state, 'platform', place.at, 650)) provisions--;
    if (readyBuildings(w.state).some((b) => b.region === place.region && b.kind === 'dock')) provisions++;
  } else if (plan.activity === 'forage') {
    const cress = place.id === 'furukawa' && !!w.state.discoveries['cress-bed'] && w.today.season !== 3;
    if (cress) provisions = 2 + (gifted ? 1 : 0);
    else if (FOOD.has(place.habitat)) provisions = 2 + (gifted ? 1 : 0) + (w.today.season === 2 ? 1 : 0);
    else materials = 2 + (gifted ? 1 : 0) + (w.today.weather === 'clear' ? 0 : -1);
    if (w.today.season === 3) { provisions = Math.max(0, provisions - 1); materials = Math.max(1, materials - 1); }
    if (readyBuildings(w.state).some((b) => b.region === place.region && b.kind === 'garden')) provisions++;
  } else if (plan.activity === 'investigate' && SALVAGE.has(place.habitat)) materials = 1 + (gifted ? 1 : 0);
  else if (plan.activity === 'visit') provisions = place.yields?.visit ?? 0;
  return { provisions: Math.min(4, Math.max(plan.activity === 'fish' ? 1 : 0, provisions)), materials: Math.min(4, materials) };
}

/** Distant outings need a shared picnic; a shelter removes that recurring cost. */
export function expeditionCost(w: World, place: PlaceDef, person = w.state.people[0]!.id): number {
  if (place.kind === 'settlement') return 0;
  const sheltered = !!lodgingOf(w.state, person);
  return !sheltered && dist(setOutFrom(w.state, place, person), place.at) >= ECONOMY.ambitiousDistance ? ECONOMY.expeditionCost : 0;
}

/** A two-stop trip takes one picnic, based on its more distant destination. */
export function outingCost(w: World, plan: OutingPlan): number {
  const gathering = (activity: string) => activity === 'forage' || activity === 'fish';
  if (w.state.provisions <= 0 && gathering(plan.activity) && (!plan.second || gathering(plan.second.activity))) return 0;
  const first = expeditionCost(w, placeDef(plan.place), plan.person);
  return plan.second ? Math.max(first, expeditionCost(w, placeDef(plan.second.place), plan.person)) : first;
}

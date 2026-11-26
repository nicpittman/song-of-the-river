/** Advice explains a useful purpose, without exposing discovery rolls or unrevealed names. */
import { REN_WORDS } from '../../game/adventure/course';
import type { Activity, AdventureView, FriendView, PlaceView } from '../../game/adventure/model';
import { ECONOMY } from '../../game/adventure/economy';
import { FINDS } from '../../game/adventure/content';
import { UPLANDS, UPLAND_STORIES } from '../../game/adventure/discovery';
import { seaPreparation } from './seaPreparation';
import { campRegion } from './campPoint';
import { hashString } from '../../game/core/rng';

export interface OutingSuggestion {
  place: string;
  person: string;
  activity: Activity;
  purpose: 'move-camp' | 'discovery' | 'opportunity' | 'provisions' | 'materials' | 'wander' | 'sign' | 'gamble';
  reason: string;
}
const advice = new WeakMap<object, OutingSuggestion[]>();
/** The mountain's side stories are worth a look, never the goal's urgency. */
const SIDE_STORIES = new Set(FINDS.filter((f) => UPLAND_STORIES.has(f.id)).map((f) => f.story?.reason));
const FOOD_WORDS: Partial<Record<Activity, string>> = { fish: 'The fish are rising', forage: 'Something ripe for the pot', visit: 'Nobody leaves without supper' };
const WOOD_WORDS: Partial<Record<Activity, string>> = { forage: 'Dry wood and good fibre under the trees', investigate: 'Sound old timber, worth carrying home' };
export function defaultActivity(friend: FriendView | null, place: PlaceView): Activity {
  if (place.kind === 'settlement') return 'visit';
  if (place.rumour) return 'explore';
  return friend && place.activities.includes(friend.gift) ? friend.gift : place.activities[0]!;
}

export function recommendPeople(view: AdventureView, place: PlaceView, activity?: Activity | null): FriendView[] {
  return view.friends.filter((f) => f.status === 'home' && (view.mode !== 'free' && place.kind === 'settlement' || f.base === place.region)).map((person, index) => {
    const doing = activity ?? defaultActivity(person, place);
    let forecast = view.forecast({ person: person.id, place: place.id, activity: doing, item: null, companion: null, ...(place.kind === 'settlement' ? { visitOnly: true } : {}) });
    // A town can be within a day's move even when a return visit is too far.
    if (forecast.problem && place.kind === 'settlement' && (person.base !== place.region || person.lodging !== undefined)) {
      const move = view.forecast({ person: person.id, place: place.id, activity: 'visit', item: null, companion: null });
      if (!move.problem) forecast = move;
    }
    const home = place.kind === 'settlement' && person.base === place.region && person.lodging === undefined;
    const geography = forecast.newGround;
    const foodPlace = ['pool', 'river', 'mill', 'waterfall', 'reeds'].includes(place.habitat ?? '');
    const score = (doing === 'visit' && person.id === 'ren' && forecast.discoveryHint ? 5 : 0) + (doing === person.gift ? 2 : 0) + (geography ? 3 : 0) + (forecast.provisions ?? 0) + (forecast.materials ?? 0) + (doing === 'fish' && foodPlace ? 1 : 0);
    return { person, index, score: score + (home && person.id === 'aki' && view.structures.some((s) => s.status === 'building' && s.region === place.region) ? 3 : 0), available: home || !forecast.problem };
  }).filter((p) => p.available).sort((a, b) => b.score - a.score || a.index - b.index).map((p) => p.person);
}

/** A clue link carries its observable purpose; ordinary map taps keep their usual defaults. */
export function clueActivity(view: AdventureView, place: PlaceView): Activity | undefined {
  if (place.rumour) return 'explore';
  const options = place.activities.map((activity) => {
    const person = recommendPeople(view, place, activity)[0];
    if (!person) return { activity, rank: 0 };
    const forecast = view.forecast({ person: person.id, place: place.id, activity, item: null, companion: null });
    return { activity, rank: forecast.followingLead ? 2 : forecast.discoveryHint ? 1 : 0 };
  }).sort((a, b) => b.rank - a.rank);
  return options[0]?.rank ? options[0].activity : undefined;
}

export function interestingPlaces(view: AdventureView): Set<string> {
  return new Set(suggestedOutings(view).map((suggestion) => suggestion.place));
}

/** Three contrasting purposes, using only information already visible in the notebook. */
/**
 * Free Play's morning advice keeps to the reach where the camp is (the first
 * friend's home, wherever camp has moved), so it never weighs long walks for
 * friends who live far off. A Journey's places are all in its own reach.
 */
const local = (view: AdventureView, region: number): boolean => view.mode !== 'free' || region === campRegion(view);

export function suggestedOutings(view: AdventureView): OutingSuggestion[] {
  if(view.mode!=='free' && view.day===1 && view.friends.length===1 && view.friends[0]?.baseName==='Yamagoya') {
    if(view.friends[0]!.status!=='home') return [];
    // The fisher first, wherever this run put Ren; then the woods, and whichever water he is not at.
    const ren = view.course.ren;
    return [
      {place:ren,person:'sora',activity:'explore' as const,purpose:'discovery' as const,reason:REN_WORDS[ren].suggest},
      {place:'kamimori',person:'sora',activity:'explore' as const,purpose:'discovery' as const,reason:view.course.mina==='kamimori' ? 'Someone is gathering among the Kamimori trees.' : 'A woodland path leads away through the trees.'},
      ren==='taki'
        ? {place:'fuchi',person:'sora',activity:'explore' as const,purpose:'opportunity' as const,reason:'Downstream, a deep pool lies where the gorge opens.'}
        : {place:'taki',person:'sora',activity:'explore' as const,purpose:'opportunity' as const,reason:'Upstream, the falls are roaring with the melting snow.'},
    ].filter(s=>view.places.some(p=>p.id===s.place) && !view.plans.some(p=>p.place===s.place) && !view.forecast({...s,item:null,companion:null}).problem);
  }
  const identity = view.planningKey ?? view;
  const cached = advice.get(identity);
  if (cached) return cached;
  const forecasts = new Map<string, ReturnType<AdventureView['forecast']>>();
  const snapshot = { ...view, forecast: (plan: Parameters<AdventureView['forecast']>[0]) => {
    const key = `${plan.person}|${plan.place}|${plan.activity}|${!!plan.visitOnly}`;
    let forecast = forecasts.get(key);
    if (!forecast) { forecast = view.forecast(plan); forecasts.set(key, forecast); }
    return forecast;
  } };
  const packedFood = view.plans.reduce((sum, plan) => sum + (plan.forecast.provisions ?? 0) - (plan.forecast.provisionCost ?? 0), 0);
  const packedMaterials = view.plans.reduce((sum, plan) => sum + (plan.forecast.materials ?? 0), 0);
  const food = view.provisions + packedFood, materials = view.materials + packedMaterials;
  const foodTarget = view.mode === 'free' ? ECONOMY.dailyUpkeep + 1 : (view.region < 2 ? view.travelCost : ECONOMY.sea) + ECONOMY.dailyUpkeep;
  const seaWork = seaPreparation(view)?.build;
  const pendingMio = view.mode !== 'free' && view.region === 1 && !view.departure?.prepared &&
    view.journal.some((entry) => entry.id === 'aki-meeting' && entry.found) && !view.structures.some((s) => s.region === 1 && s.status === 'building');
  const project = seaWork ? view.structures.find((s) => s.id === seaWork && s.status !== 'building')
    : pendingMio ? view.structures.filter((s) => s.id === 'cottage' || s.id === 'bridge').sort((a, b) => a.cost - b.cost)[0] : undefined;
  const woodTarget = Math.max(view.departure?.materialsCost ?? 0, project?.cost ?? 0);
  const candidates: Array<OutingSuggestion & { rank: number }> = [];
  const wandering: OutingSuggestion[] = [];
  const seseragi = view.mode === 'journey' && view.region === 0 && view.phase === 'morning' && !view.departure?.surveyed && !view.plans.length
    ? view.places.find(place => place.id === 'seseragi' && !place.rumour && !place.visits && !place.home)
    : undefined;
  if (seseragi && view.friends.some(friend => friend.id === 'ren' && friend.status === 'home') && !view.moveEveryoneProblem(seseragi.id)) {
    candidates.push({ place: seseragi.id, person: 'ren', activity: 'visit', purpose: 'move-camp', reason: view.goal, rank: 145 });
  }
  if (view.canTravel && !view.plans.some(plan => plan.moving)) {
    const next = view.places.find(place => place.kind === 'settlement' && place.region === view.region + 1);
    const person = view.friends.find(friend => friend.status === 'home');
    if (next && person) candidates.push({ place: next.id, person: person.id, activity: 'visit', purpose: 'move-camp', reason: view.goal, rank: 140 });
  }
  for (const place of view.places) {
    if (!local(view, place.region)) continue;
    if (!view.friends.some((p) => p.base === place.region)) continue;
    if (place.state === 'closed' || view.plans.some(plan=>plan.place===place.id)) continue;
    for (const activity of place.activities) {
      const local = view.mode==='free' ? {...snapshot,friends:view.friends.filter(person=>person.base===place.region)} : snapshot;
      const person = recommendPeople(local, place, activity)[0];
      if (!person) continue;
      const forecast = snapshot.forecast({ person: person.id, place: place.id, activity, item: null, companion: null, ...(place.kind === 'settlement' ? { visitOnly: true } : {}) });
      if (forecast.problem || (place.kind === 'settlement' && person.baseName === place.name)) continue;
      if (activity === 'explore' && place.kind !== 'settlement' && !view.wayPlaces.includes(place.id) && !forecast.followingLead && !view.goal.includes(place.name)) {
        wandering.push({ place: place.id, person: person.id, activity, purpose: 'wander', reason: place.rumour ?? place.note ?? 'A different path to follow today.' });
      }
      const add = (purpose: OutingSuggestion['purpose'], reason: string, rank: number) => candidates.push({ place: place.id, person: person.id, activity, purpose, reason, rank: rank + (purpose === 'discovery' && view.goal.includes(place.name) ? 20 : 0) });
      if (view.day === 2 && place.id === 'suisha' && activity === 'visit' && person.id === 'ren' && !view.journal.some(e=>e.id==='miller'&&e.found)) add('discovery','Ren knows the miller. He may know the road south.',120);
      if (view.day===2 && place.id===view.course.ren && activity==='fish' && person.id==='ren') add('provisions',REN_WORDS[view.course.ren].fish,115);
      const geography = forecast.newGround;
      if (view.mode !== 'free' && view.region === 1 && view.departure?.prepared && !view.departure.surveyed && activity === 'explore' && ['mukoniwa', 'kitsuneyama', 'higashimori'].includes(place.id)) {
        add('discovery', forecast.discoveryHint ?? (place.rumour || 'Beyond the new bridge, the paths run south through gardens and woods.'), view.wayPlaces.includes(place.id) ? 118 : 108);
      }
      if (pendingMio && place.id === 'mio') continue;
      if (activity === 'explore' && (geography || place.visits === 0)) add('discovery', place.rumour ?? (geography ? 'Paths run on past the edge of our map' : place.note || 'Nobody has walked out here yet'), geography ? 58 : 35);
      if (place.id === 'yamagoya' && view.day <= 2 && person.id === 'sora') continue;
      if (forecast.discoveryHint && SIDE_STORIES.has(forecast.discoveryHint)) candidates.push({ place: place.id, person: person.id, activity, purpose: 'discovery', reason: forecast.discoveryHint, rank: 60 });
      else if (forecast.discoveryHint) add('discovery', forecast.discoveryHint, 79);
      const closing = forecast.closesTomorrow;
      const following = forecast.followingLead;
      if (following || closing || place.state === 'special') {
        const urgent = closing || (following && place.leadDays !== null && place.leadDays <= 1);
        const useful = geography || forecast.chance === 'certain' || (forecast.provisions ?? 0) > 0 || (forecast.materials ?? 0) > 0;
        if (useful) add('opportunity', closing ? 'A chance to look before the water changes' : following ? (urgent ? `${place.lead ?? 'A clue from the journal.'} The signs are still fresh.` : place.lead ?? 'A clue from the journal') : place.stateLine ?? 'A good day for it', (urgent ? 100 : following ? 78 : 62) + (geography ? 4 : 0) + (forecast.chance === 'certain' ? 1 : 0));
      }
      // Yields live on the slip; the suggestion gives a reason to go, and only then the need.
      if ((forecast.provisions ?? 0) > 0) add('provisions', `${FOOD_WORDS[activity] ?? 'Food for the packs'}${food <= 2 ? ', and the packs are low' : food < foodTarget ? ', for the road ahead' : ''}`, (food <= 2 ? 110 : food < foodTarget ? 70 : 20) + forecast.provisions!);
      if ((forecast.materials ?? 0) > 0) {
        const needed = materials < woodTarget;
        const purpose = pendingMio ? 'for Aki’s promised work' : project ? `for the ${project.name.replace(/^The /, '').toLowerCase()}` : 'for the road ahead';
        add('materials', `${WOOD_WORDS[activity] ?? 'Good timber to carry home'}${needed ? `, ${purpose}` : ''}`, (needed ? 85 : materials < 3 ? 60 : 22) + forecast.materials!);
      }
    }
  }
  const places = new Set<string>(), purposes = new Set<string>();
  // The mountain is a side trip: one upland idea at most, and none while something urgent waits below.
  const pressing = candidates.some((c) => c.rank >= 100 && !UPLANDS.has(c.place));
  let upland = false;
  const kept = candidates.sort((a, b) => b.rank - a.rank).filter((candidate) => {
    if (places.has(candidate.place) || purposes.has(candidate.purpose) || places.size === 2) return false;
    const high = UPLANDS.has(candidate.place) && candidate.rank < 99;
    if (high && (upland || pressing)) return false;
    if (high) upland = true;
    places.add(candidate.place); purposes.add(candidate.purpose); return true;
  });
  const result = kept.map(({ rank: _rank, ...suggestion }) => suggestion);
  // A daily side path is an invitation, independent of the strongest progression score.
  // Hash ordering is stable across refreshes/reloads, so the list never shuffles under a click.
  const detours = wandering.filter(suggestion => !places.has(suggestion.place) && !(upland && UPLANDS.has(suggestion.place)));
  const unvisited = detours.filter(suggestion => {
    const place = view.places.find(place => place.id === suggestion.place)!;
    return !place.visits && !place.home;
  });
  const fresh = detours.filter(suggestion => {
    const place = view.places.find(place => place.id === suggestion.place)!;
    return !place.visits || place.finds.some(find => !find.found);
  });
  let paths = unvisited.length ? unvisited : fresh.length ? fresh : detours;
  // The opening leaves room to look back towards the mountains, rather than
  // sending the third traveller straight back to yesterday's pool.
  if (view.region === 0 && view.day <= 3) {
    const northern = paths.filter(suggestion => view.places.find(place => place.id === suggestion.place)!.at.y < view.friends.find(friend => friend.id === suggestion.person)!.at.y - 100);
    if (northern.length) paths = northern;
  }
  const detour = paths.sort((a,b) => hashString(`wander:${view.day}:${view.region}:${a.place}`) - hashString(`wander:${view.day}:${view.region}:${b.place}`))[0];
  // Keep the ordering stable within a day, without always putting the road
  // onward above everything else. Urgent windows and empty packs keep priority.
  if (view.day % 2 === 0 && result.length > 1 && result[0]!.purpose !== 'opportunity' && (result[0]!.purpose === 'move-camp' || view.wayPlaces.includes(result[0]!.place))) {
    [result[0], result[1]] = [result[1]!, result[0]!];
  }
  // The river's sign takes the third row when it points somewhere new to the list:
  // a hunch from today's water or weather, rather than another answer.
  const signRow = riverSignRow(snapshot, places);
  if (signRow) result.push(signRow);
  else if (detour) result.push(detour);
  // One row may become a gamble: somewhere with something still to find, on a day it is no sure thing.
  // It takes the place of the plain detour, or of an unpressing supply errand; never the story or the river's sign.
  const gamble = gambleRow(snapshot, new Set([...places, ...(signRow ? [signRow.place] : [])]));
  if (gamble) {
    const last = result.length - 1;
    // Only an errand nothing presses on: not low packs, not food or timber the road ahead still needs.
    const errand = result.findIndex((row, i) => i < kept.length && (row.purpose === 'provisions' || row.purpose === 'materials') && kept[i]!.rank < 60);
    if (last >= 0 && result[last]!.purpose === 'wander') result[last] = gamble;
    else if (errand >= 0) { result.splice(errand, 1); result.splice(signRow ? result.length - 1 : result.length, 0, gamble); }
    else if (result.length < 3) result.push(gamble);
  }
  advice.set(identity, result);
  return result;
}

function riverSignRow(view: AdventureView, taken: ReadonlySet<string>): OutingSuggestion | null {
  const sign = view.sign;
  // The opening days keep their curated suggestions; the river's signs begin once the valley is familiar.
  if (view.region === 0 && view.day <= 3) return null;
  if (!sign || view.mode === 'free' || taken.has(sign.place) || view.plans.some((plan) => plan.place === sign.place)) return null;
  const place = view.places.find((p) => p.id === sign.place);
  if (!place || place.state === 'closed' || place.rumour) return null;
  const activity: Activity = place.activities.includes('explore') ? 'explore' : place.activities[0]!;
  const person = recommendPeople(view, place, activity)[0];
  if (!person || view.forecast({ person: person.id, place: place.id, activity, item: null, companion: null }).problem) return null;
  return { place: place.id, person: person.id, activity, purpose: 'sign', reason: sign.line };
}

/** The gamble's words: no promise, no name for what might be there. */
export const GAMBLE_LINE = 'Might be nothing. Might be something.';

/**
 * A known, open place with something genuinely still to find there today, on a
 * day the odds are no better than even. Always true: the forecast only gives a
 * pip when a find is possible for that outing today. Rare and long-unfound
 * things weigh more; the choice is stable within a day.
 */
export function gambleRow(view: AdventureView, taken: ReadonlySet<string>): OutingSuggestion | null {
  if (view.region === 0 && view.day <= 3) return null;
  let best: (OutingSuggestion & { score: number }) | null = null;
  for (const place of view.places) {
    if (place.rumour || place.home || place.kind === 'settlement' || place.state === 'closed') continue;
    if (taken.has(place.id) || view.plans.some((plan) => plan.place === place.id)) continue;
    if (!local(view, place.region)) continue;
    if (!view.friends.some((f) => f.base === place.region)) continue;
    const waiting = place.finds.filter((find) => !find.found && find.today);
    if (!waiting.length) continue;
    for (const activity of place.activities) {
      const person = recommendPeople(view, place, activity)[0];
      if (!person) continue;
      const forecast = view.forecast({ person: person.id, place: place.id, activity, item: null, companion: null });
      if (forecast.problem || forecast.pips === 0 || (forecast.chance !== 'unlikely' && forecast.chance !== 'even')) continue;
      // A lead, a story or new ground already has its own row and its own reason.
      if (forecast.followingLead || forecast.discoveryHint || forecast.newGround) continue;
      const score = waiting.filter((find) => find.rare).length * 3 + waiting.length + (forecast.chance === 'even' ? 1 : 0)
        + (hashString(`gamble:${view.day}:${place.id}`) % 100) / 50;
      if (!best || score > best.score) best = { place: place.id, person: person.id, activity, purpose: 'gamble', reason: GAMBLE_LINE, score };
    }
  }
  if (!best) return null;
  const { score: _score, ...row } = best;
  return row;
}

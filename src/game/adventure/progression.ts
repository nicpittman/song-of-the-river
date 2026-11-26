/**
 * The journey downstream. Each reach has a gate with two ways through, every
 * one stated in a sentence: know the way on, and prepare for the longer journey.
 *
 *   Seseragi to Mio: survey Furumichi’s old road or the view from Yamagoya’s ridge.
 *   Mio to Kawagiri: this year's way (the stakes in the reeds, the herons' way,
 *   or the high path; see course.ts), and fulfil Aki's promise to the village
 *   with a cottage or the narrows footbridge.
 *
 * And the road down takes provisions, packed the evening the friends decide.
 *
 * Then the sea: Grandfather's boat (his plans, left with the Kurumaya miller, or the
 * Funaya moulds he learned on; brought down from Mio's reeds and restored at a dock), one sail (Yui's, or the one
 * in the Funaya Boatyard loft), and a reading of the tide (at Kawaguchi or Iso, or
 * in Yui's song).
 */

import { freeAims } from './aims';
import { REN_WORDS, WAY_ROUTES, WAYS } from './course';
import { ECONOMY } from './economy';
import { SESERAGI_LEAD } from './narrative';
import type { StructureKind } from './model';
import type { AdventureState } from './state';
import { isBuilt, isComplete, readyBuildings } from './world';
import { NARROWS, structureDef } from './structures';
import { dist } from '../core/math';
import { numberWord, sentence } from './text';
import { nameOf } from './people';
import { stonesLaid, streamCrossable, streamFlooded, streamShutLine } from './stream';


interface Route {
  find: string;
  place: string;
}

const SESERAGI_ROUTES: readonly Route[] = [{ find: 'waymark', place: 'furumichi' }, { find: 'long-view', place: 'yamagoya' }];

/** The routes out of a reach this year: the find that shows the way, and the place it is found. */
export function gateRoutes(state: AdventureState, region = state.region): readonly Route[] {
  const preferred = region === 1 && isBuilt(state, 'cottage') && !readyBuildings(state).some(b => b.region === 1 && b.kind === 'bridge' && dist(b, NARROWS) < 170) ? 'reeds' : state.course.way;
  return region === 0 ? SESERAGI_ROUTES : region === 1 ? [WAY_ROUTES[preferred], ...WAYS.filter(way => way !== preferred).map(way => WAY_ROUTES[way])] : [];
}

/** Only work promised to Mio counts; an unrelated bridge elsewhere does not. */
export function akiPromiseKept(state: AdventureState): boolean {
  return readyBuildings(state).some((b) => b.region === 1 && (b.kind === 'cottage' || b.kind === 'bridge' && dist(b, NARROWS) < 170));
}

function villageWork(state: AdventureState): string {
  const projects = state.buildings.filter((b) => b.region === 1 && (b.kind === 'cottage' || b.kind === 'bridge' && dist(b, NARROWS) < 170));
  const project = projects.find(isComplete) ?? projects[0];
  return project ? project.kind === 'cottage' ? 'Village cottage' : 'Mio footbridge' : 'Village cottage or Mio footbridge';
}

/** A readable account of the existing chapter gate, never a second quest state. */
export function departureOf(state: AdventureState) {
  if (state.free || state.region >= 2 || state.moving) return null;
  const routes = gateRoutes(state);
  const prepared = state.region === 0 || akiPromiseKept(state);
  const route = routes.find((r) => found(state, r.find)) ?? routes.find((r) => state.known.includes(r.place) || state.rumoured.includes(r.place)) ?? routes[0]!;
  return { destination: ['Mio', 'Kawagiri'][state.region]!, surveyed: found(state, route.find),
    place: state.known.includes(route.place) || state.rumoured.includes(route.place) ? route.place : null,
    prepared,
    work: state.region === 1 ? villageWork(state) : null, cost: PROVISIONS[state.region]!, packed: state.provisions >= PROVISIONS[state.region]!,
    materialsCost: JOURNEY_MATERIALS[state.region] ?? 0, materialsPacked: state.materials >= (JOURNEY_MATERIALS[state.region] ?? 0) };
}

/** Supplies the road down from each reach takes. */
export const PROVISIONS: readonly number[] = ECONOMY.journeys;
export const JOURNEY_MATERIALS: readonly number[] = ECONOMY.journeyMaterials;
export const journeyPacking = (region: number): string => `${numberWord(PROVISIONS[region]!)} provisions${JOURNEY_MATERIALS[region] ? ` and ${numberWord(JOURNEY_MATERIALS[region]!)} ${JOURNEY_MATERIALS[region] === 1 ? 'material' : 'materials'}` : ''}`;
/** Supplies the voyage to the sea takes. */
export const SEA_PROVISIONS = ECONOMY.sea;

const found = (state: AdventureState, id: string): boolean => !!state.discoveries[id];

const ALL_ROUTES: readonly Route[] = [...SESERAGI_ROUTES, ...WAYS.map((w) => WAY_ROUTES[w])];
/** Finds that show the way on from a reach, or out to the sea. The fire sets them down last. */
export const WAY_ON_FINDS: ReadonlySet<string> = new Set([...ALL_ROUTES.map((r) => r.find), 'coastal-path', 'boat-ledger', 'boatyard-moulds', 'mended-sail', 'loft-sail', 'tide-marks', 'tide-song']);
/** Whether the way on is found at this place, this year. */
export const isWayOnPlace = (state: AdventureState, id: string): boolean => [0, 1].some((region) => gateRoutes(state, region).some((r) => r.place === id));

/** True when a surveyed route and any later construction preparations are ready. */
export function gateOpen(state: AdventureState): boolean {
  if (state.free) return false;
  const routes = gateRoutes(state);
  return routes.some((r) => found(state, r.find)) && (state.region === 0 || akiPromiseKept(state));
}

/** True when the friends can set off down the river tomorrow. */
export function readyToMove(state: AdventureState): boolean {
  if (state.region === 0 && !state.free && ['ren'].some((id) => !state.people.some((person) => person.id === id))) return false;
  if (state.region === 0 && !state.free && !streamCrossable(state)) return false;
  return packedToMove(state);
}

/** The way on is known and the road down's supplies are packed. */
export function packedToMove(state: AdventureState): boolean {
  return gateOpen(state) && state.provisions >= (PROVISIONS[state.region] ?? Infinity) && state.materials >= (JOURNEY_MATERIALS[state.region] ?? 0);
}

export const sailFound = (state: AdventureState): boolean => found(state, 'mended-sail') || found(state, 'loft-sail');
export const tideFound = (state: AdventureState): boolean => found(state, 'tide-marks') || found(state, 'tide-song');

export function readyToSail(state: AdventureState): boolean {
  if (state.free) return state.voyage === 'preparing' && isBuilt(state, 'boat');
  return boatReady(state) && state.provisions >= SEA_PROVISIONS;
}

function boatReady(state: AdventureState): boolean {
  return state.region === 2 && state.voyage === 'preparing' && isBuilt(state, 'boat') && sailFound(state) && tideFound(state);
}

/** Ren and Mina after meeting; Aki once his promise is kept; Yui once there is a dock. Haru stays local (in Free Play, everyone joins once met). */
export function newMembers(state: AdventureState, arriving: readonly string[] = []): string[] {
  const joining: string[] = [];
  const has = (id: string): boolean => state.people.some((p) => p.id === id);
  // Free Play: the friends along the river come along once someone has been to see them.
  // Sora is met, but keeps to his own journey: he never comes along in Free Play.
  if (state.free) return ['ren', 'mina', 'aki', 'haru', 'yui'].filter((id) => !has(id) && (found(state, `${id}-meeting`) || arriving.includes(`${id}-meeting`)));
  if (!has('ren') && (found(state, 'ren-meeting') || arriving.includes('ren-meeting'))) joining.push('ren');
  if (!has('mina') && (found(state, 'mina-meeting') || arriving.includes('mina-meeting'))) joining.push('mina');
  // Haru keeps her camp among the pines and never joins.
  if (state.region >= 1 && !has('aki') && (found(state, 'aki-meeting') || arriving.includes('aki-meeting')) && akiPromiseKept(state)) joining.push('aki');
  if (state.region >= 2 && !has('yui') && (found(state, 'yui-meeting') || arriving.includes('yui-meeting')) && isBuilt(state, 'dock')) joining.push('yui');
  return joining;
}

/** One line on what the story is waiting for, in the group's own words. */
export function goalLine(state: AdventureState): string {
  if (state.voyage === 'ended') return 'The valley is ours to wander. The river goes on.';
  if (state.free) return freeAims(state)[0]!.line;
  if (state.moving) return 'Today we follow the river down to our next home.';
  if (state.region === 0 && !state.people.some((p) => p.id === 'ren')) return REN_WORDS[state.course.ren].goal;
  const way = (routes: readonly Route[]): boolean => routes.some((r) => found(state, r.find));
  const destination = ['Mio', 'Kawagiri'][state.region];
  if (gateOpen(state) && destination) {
    if (state.region === 0 && packedToMove(state) && !streamCrossable(state)) return streamShutLine(state);
    if (readyToMove(state)) return state.region === 0 && !stonesLaid(state, state.day + 1) && streamFlooded(state.day + 1)
      ? `Everything is packed for ${destination}. Better go today: the stream below Seseragi will be up tomorrow.`
      : `Everything is packed for ${destination}. We can all go down together in a day.`;
    // Say what is still missing, not two bare numbers.
    // The stores show the counts; the friends just say what the packs still want.
    const food = state.provisions < ECONOMY.journeys[state.region]!;
    const wood = state.materials < (JOURNEY_MATERIALS[state.region] ?? 0);
    const missing = food && wood ? 'a little more food and timber' : food ? 'a little more food' : wood ? 'a little more timber' : '';
    const known = `We know the way to ${destination}${state.region === 1 ? ', and the sea beyond it' : ''}.`;
    return missing ? `${known} With ${missing} in the packs, we can go.` : `${known} The road down wants ${journeyPacking(state.region)}.`;
  }
  if (state.region === 0) {
    if (!state.visits.seseragi && state.known.includes('seseragi')) return SESERAGI_LEAD;
    // Some have gone down to the village and some are still at the hut: say who still has to come.
    const up = state.people.filter((p) => p.base === 0 && p.lodging === 'yamagoya').map((p) => nameOf(p.id));
    const down = state.people.filter((p) => p.base === 0 && p.lodging === undefined).map((p) => nameOf(p.id));
    if (state.visits.seseragi && up.length && down.length) return `${sentence(down)} ${down.length === 1 ? 'is' : 'are'} settled in Seseragi. ${sentence(up)} ${up.length === 1 ? 'is' : 'are'} still up at Yamagoya. There is room by the village fire for everyone.`;
    if (!way(SESERAGI_ROUTES) && !state.known.includes('furumichi') && !found(state, 'carved-steps')) return 'The miller at Suisha Mill may know the road south. Yamagoya’s ridge path looks down over Seseragi, too.';
    if (!way(SESERAGI_ROUTES)) return 'The old road at Furumichi runs south, and its waymark may still point to Mio. Yamagoya’s ridge path may join the road below Seseragi.';
  }
  if (state.region === 1) {
    if (!found(state, 'aki-meeting')) return 'Someone is hammering on the roof at Toroya Inn. They may know the river below.';
    if (!way(gateRoutes(state))) return `${akiPromiseKept(state) ? 'Aki’s promise is kept. We still need to find the way south. ' : ''}${wayGoal(state)}`;
    return 'We know the way to Kawagiri. First, Aki’s promise to Mio: a cottage in the village or a footbridge at the narrows. Then he comes with us.';
  }
  if (!state.known.includes('kawagiri') && !state.buildings.some((b) => b.region === 2 && ['dock', 'boat'].includes(b.kind))) return 'Shiobashi Bridge crosses the river above the reeds. Follow its eastern path towards the village by the sea.';
  if (state.people.every((p) => p.base === 2 && p.lodging !== undefined) && !state.buildings.some((b) => b.kind === 'boat')) return 'Kawagiri is across the bridge and down the eastern shore. The fishing families there would make room for us by their fire.';
  if (!found(state, 'boat-ledger') && !found(state, 'boatyard-moulds')) return 'The sea is close enough to smell. A boat would carry us the last of the way; someone here must know how they are made.';
  const underway = (kind: StructureKind): boolean => state.buildings.some((b) => b.kind === kind && b.region === state.region && !isComplete(b));
  if (!isBuilt(state, 'dock') && !isBuilt(state, 'boat')) {
    if (underway('dock')) return 'The dock is going up at the landing. Then we can restore the old boat.';
    return buildLine(state, 'dock', 'We need a dock to bring Grandfather’s old boat ashore for repairs.', 'There is timber enough for the dock. Choose a spot on the bank.');
  }
  if (!isBuilt(state, 'boat')) {
    if (underway('boat')) return state.buildings.some((b) => b.kind === 'boat' && b.placed === state.day) && (state.phase === 'morning' || state.phase === 'day')
      ? 'Today we bring Grandfather’s boat down from the reeds to the dock.'
      : 'Grandfather’s boat is being restored beside the dock.';
    return buildLine(state, 'boat', 'The dock is done.', 'The dock is done, and there is timber enough to restore the old boat.');
  }
  if (!sailFound(state)) return 'The boat will want a sail.';
  if (!tideFound(state)) return 'We need to know when the tide turns.';
  if (state.provisions < SEA_PROVISIONS) {
    const short = SEA_PROVISIONS - state.provisions;
    return `The boat is ready. ${short === 1 ? 'One more good supper' : 'A little more food'} for the voyage, and we can sail.`;
  }
  return 'The boat is ready. Choose who sails, and when.';
}

/**
 * The morning's word on the dock or the boat: who brought timber in yesterday,
 * and how much more it needs, rather than two bare numbers.
 */
function buildLine(state: AdventureState, kind: StructureKind, opening: string, enough: string): string {
  const cost = structureDef(kind).cost;
  const yesterday = state.history[0]?.day === state.day - 1 ? state.history[0] : undefined;
  const bringers = [...new Set((yesterday?.items ?? []).filter((i) => i.materials > 0).map((i) => i.person))].map(nameOf);
  const brought = bringers.length ? `${sentence(bringers)} brought in timber.` : '';
  if (state.materials >= cost) return [brought, enough].filter(Boolean).join(' ');
  const more = `A little more timber, and we can start on ${kind === 'boat' ? 'her' : `the ${kind}`}.`;
  return [brought || opening, more].join(' ');
}

/** What the story waits for in Mio until this year's way down is found. */
function wayGoal(state: AdventureState): string {
  const bridged = readyBuildings(state).some((b) => b.kind === 'bridge' && dist(b, NARROWS) < 170);
  // The west-bank stakes are a real alternative after choosing the cottage.
  if (!bridged && akiPromiseKept(state)) return 'Our promise to Mio is kept. On this bank, old stakes at Omagari and Ashiura show the way south as the water falls. At middle or low water we can trace them from the higher bank.';
  switch (state.course.way) {
    case 'reeds':
      return 'The path south disappears into Omagari’s reeds. At middle or low water, old stakes can be traced from the higher bank.';
    case 'herons':
      if (!bridged) return 'The way south lies on the far bank. Bridge the narrows, and ask at Mukoniwa’s garden.';
      return state.known.includes('kitsuneyama')
        ? 'On a clear day, the herons over Kitsuneyama Shrine fly south along the river’s pools. From the hill, we could follow them.'
        : 'Mukoniwa’s gardener watches the herons every morning. Someone should ask where they go.';
    case 'high-path':
      if (!bridged) return 'The far bank’s woods run south toward the sea. Bridge the narrows, and look for a way above Higashimori.';
      return 'An old track above Higashimori keeps to the ridge, clear of the river. Look above the wood for the way down the eastern shore.';
  }
}

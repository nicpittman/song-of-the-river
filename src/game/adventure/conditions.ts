/**
 * What the river and the season allow today: which crossings are passable,
 * whether each place is open, closed or special, and which finds could be
 * brought home. These are the rules the player learns by going.
 */

import type { BoardDef } from '../world/types';
import type { Crossing, FindDef, PlaceDef, PlaceRule } from './catalogue';
import { placeDef } from './content';
import { FREE_PLAY_FINDS } from './places/freeplay';
import type { Activity, PlaceState, WaterLevel } from './model';
import type { OpenGround } from './navigation';
import type { AdventureState } from './state';
import { NARROWS } from './structures';
import { holds, isBuilt, readyBuildings, type Today } from './world';
import { bridgeGround } from './bridges';
import { valleyRiver } from './regions';
import { COAST_BRIDGE } from '../world/boards/kawagiriSites';
import { dist, type Vec } from '../core/math';
import { STREAM_CHANNEL, STREAM_CROSSING, streamCrossable, streamFrozen } from './stream';

/** Water levels at which each set of stepping stones can be walked. */
const STONES_SHOW: Record<Exclude<Crossing, 'mio-bridge' | 'estuary-bridge'>, WaterLevel[]> = {
  'high-stones': ['middle', 'low'],
  'middle-stones': ['middle', 'low'],
  'brook-stones': ['middle', 'low'],
  'low-stones': ['low'],
};

const CROSSING_CLOSED: Record<Crossing, string> = {
  'high-stones': 'Old Ford is flooded. Wait for middle or low water, or build a footbridge here.',
  'middle-stones': 'The middle stones are flooded. Return at middle or low water, or build a bridge.',
  'brook-stones': 'The brook crossing is flooded. Return at middle or low water, or bridge it.',
  'low-stones': 'These stones open at low water. A bridge here keeps the crossing open.',
  'mio-bridge': 'Across the Mio narrows. Build a footbridge beside the mill to reach this bank.',
  'estuary-bridge': 'Shiobashi’s stone bridge leads to the eastern bank above the estuary.',
};

/** Before learning bridgework, show the usable environmental solution. */
const CROSSING_WAIT: Partial<Record<Crossing, string>> = {
  'high-stones': 'Old Ford is flooded. The stones reappear at middle or low water.',
  'middle-stones': 'The middle stones are flooded. Return at middle or low water.',
  'brook-stones': 'The brook crossing is flooded. Return at middle or low water.',
  'low-stones': 'These stones are submerged. Return at low water.',
};

/** The ledge behind Taki's falls, where the stream is narrowest. */
export const FALLS_LEDGE: Vec = { x: 1196, y: 46 };

export function crossingOpen(crossing: Crossing, today: Today, state: AdventureState): boolean {
  if (crossing === 'estuary-bridge') return true; // Shiobashi Bridge is an existing, all-season footbridge.
  const target = crossing === 'mio-bridge' ? NARROWS :
    crossing === 'high-stones' ? { x: 1052, y: 432 } : crossing === 'middle-stones' ? { x: 1072, y: 1178 } : crossing === 'brook-stones' ? { x: 1420, y: 956 } : { x: 900, y: 2214 };
  if (readyBuildings(state, today.day).some((b) => b.kind === 'bridge' && dist(b, target) < 170)) return true;
  if (crossing === 'high-stones' && isBuilt(state, 'ford-bridge', today.day)) return true;
  if (crossing === 'mio-bridge') return false;
  return STONES_SHOW[crossing].includes(today.level);
}

export interface PlaceToday {
  state: PlaceState;
  /** Why it is closed or special; null when simply open. */
  line: string | null;
  rule: PlaceRule | null;
  /** Dry approach used by an established alternative path. */
  via?: Vec;
}

export function placeToday(place: PlaceDef, today: Today, state: AdventureState): PlaceToday {
  // Beyond the high stones (not the ford itself) the ledge behind the falls is the long way round.
  const ledge = place.crossing === 'high-stones' && place.id !== 'takaishi' && (state.free || !!state.discoveries['behind-the-falls']);
  if (place.crossing && !ledge && !crossingOpen(place.crossing, today, state)) {
    const bridgework = state.free || !!state.discoveries['aki-meeting'];
    return { state: 'closed', line: (!bridgework && CROSSING_WAIT[place.crossing]) || CROSSING_CLOSED[place.crossing], rule: null };
  }
  const rule = (place.rules ?? []).find((r) => holds(r.when, today, state)) ?? null;
  if (!rule) return { state: 'open', line: null, rule: null };
  const alternative = rule.bypass;
  if (alternative && state.discoveries[alternative.find] && readyBuildings(state, today.day).some((b) => b.kind === alternative.structure && b.region === place.region && (!alternative.within || dist(b, place.at) <= alternative.within))) {
    return { state: 'special', line: alternative.line, rule: null, via: alternative.via };
  }
  const stones = place.crossing && place.crossing !== 'mio-bridge' && place.crossing !== 'estuary-bridge' ? STONES_SHOW[place.crossing] : null;
  if (stones && !stones.includes(today.level) && rule.state === 'special') {
    return { state: 'special', line: 'The stones are submerged. The bridge stays open above them.', rule };
  }
  return { state: rule.state, line: rule.line, rule };
}

export const isOpen = (place: PlaceDef, today: Today, state: AdventureState): boolean => placeToday(place, today, state).state !== 'closed';

/** The kinds of outing that can bring a find home from a place. */
export function findActivities(find: FindDef, place: PlaceDef): Activity[] {
  return find.activities ?? place.activities;
}

/** A find is behind us once it is home; a meeting, too, once that friend is with us (Yui sets out with us in Free Play). */
const metOrFound = (state: AdventureState, id: string): boolean =>
  !!state.discoveries[id] || id.endsWith('-meeting') && state.people.some((p) => p.id === id.replace('-meeting', ''));

/** Whether a find could come home from this place today, by this kind of outing, if luck allows. */
export function findPossible(find: FindDef, place: PlaceDef, activity: Activity, today: Today, state: AdventureState, person?: string): boolean {
  // Nobody is met twice; and Free Play's own finds (Sora at his hut, the secret places) are never found in a Journey.
  if (find.id.endsWith('-meeting') && state.people.some((p) => p.id === find.id.replace('-meeting', ''))) return false;
  if (!state.free && FREE_PLAY_FINDS.has(find.id)) return false;
  // This year's Ren, Mina and way down from Mio are where the year put them.
  if (find.id === 'ren-meeting' && place.id !== state.course.ren) return false;
  if (find.id === 'mina-meeting' && state.course.mina === 'kamimori' && place.id !== 'kamimori') return false;
  if (!find.at?.includes(place.id)) return false;
  if (!findActivities(find, place).includes(activity)) return false;
  if (find.after && !metOrFound(state, find.after)) return false;
  if (find.unless && state.discoveries[find.unless]) return false;
  // Survey time is checked against the person's actual route in the assessment.
  void person;
  return holds(find.when, today, state);
}

/**
 * Ground the walkers can use today besides dry land: stepping stones that
 * show, the gravel bar at low water, and a finished bridge.
 */
export function openGround(board: BoardDef, today: Today, state: AdventureState): OpenGround[] {
  const ground: OpenGround[] = board.id === 'river-adventure' ? bridgeGround(valleyRiver(), COAST_BRIDGE) : [];
  const fordCrossing: Record<string, Exclude<Crossing, 'mio-bridge' | 'estuary-bridge'>> = {
    'high-stones': 'high-stones',
    'middle-stones': 'middle-stones',
    'brook-stones': 'brook-stones',
    'low-stones': 'low-stones',
  };
  for (const ford of board.fords) {
    const crossing = fordCrossing[ford.id];
    // The circle reaches a little past the stones so the grid finds dry land on both banks.
    // Stones with no crossing rule of their own (the small side streams) are always open.
    // Under water they are no footing, bridge or none: a bridge over them carries its own deck below.
    if (crossing ? STONES_SHOW[crossing].includes(today.level) : !ford.floods.length) ground.push({ at: { x: ford.x, y: ford.y }, r: ford.radius + 36 });
  }
  if (board.id === 'river-adventure') ground.push(...streamGround(today.day, state));
  if (today.level === 'low') ground.push({ at: placeDef('koishihama').at, r: 90 });
  // The dry ledge behind Taki's falls, once someone has found it (always, in Free Play):
  // the long way round to the east bank when the stones are under water.
  if (state.free || state.discoveries['behind-the-falls']) ground.push({ at: FALLS_LEDGE, r: 64 });
  for (const bridge of readyBuildings(state, today.day).filter((b) => b.kind === 'bridge' || b.kind === 'ford-bridge')) ground.push(...bridgeGround(valleyRiver(), bridge));
  return ground;
}

/** The stream below Seseragi carries no stones of its own. */
const STREAM_REACH = 80;
/** The ice stops short of the river, whose own water stays open. */
const ICE_END_X = 960;

/**
 * Where the stream below Seseragi can be walked today: at the road's crossing
 * whenever it is down or stones carry it, and anywhere along it once it has
 * frozen. Each circle reaches past the water so the grid finds both banks.
 */
function streamGround(day: number, state: AdventureState): OpenGround[] {
  const ground: OpenGround[] = streamCrossable(state, day) ? [{ at: STREAM_CROSSING, r: STREAM_REACH }] : [];
  if (!streamFrozen(day)) return ground;
  const stream = valleyRiver().channels.find((c) => c.id === STREAM_CHANNEL);
  if (!stream) return ground;
  const points = stream.line.points;
  for (let i = 0; i < points.length; i += 2) {
    const p = points[i]!;
    if (p.x > ICE_END_X) break;
    ground.push({ at: p, r: stream.widths[i]! / 2 + 44 });
  }
  return ground;
}

/** Future companions live in the landscape before the expedition meets them. */
import type { SceneFigure } from './model';
import type { AdventureState } from './state';
import { placeDef } from './content';
import { openedTo } from './world';
import { onLegs } from './motion';

/**
 * Where someone waits, beside the place mark; by the tarn the right of the mark is water,
 * and in Seseragi the mark sits behind the big timber house, so Mina waits up the open path by the signpost.
 */
const STAND: Record<string, { x: number; y: number }> = { kagami: { x: -28, y: 6 }, seseragi: { x: 95, y: -58 } };
/** Where someone not yet met stands at `place` (their words hang from here too). */
export function meetingSpot(place: string): { x: number; y: number } {
  const at = placeDef(place).at, off = STAND[place] ?? { x: 24, y: 8 };
  return { x: at.x + off.x, y: at.y + off.y };
}

const MEETINGS = [
  { person: 'ren', place: 'fuchi', pose: 'fish' as const },
  { person: 'mina', place: 'seseragi', pose: 'forage' as const },
  { person: 'aki', place: 'toroya', pose: 'build' as const },
  { person: 'haru', place: 'matsubara', pose: 'sit' as const },
  { person: 'yui', place: 'takayuka', pose: 'talk' as const },
];

export function meetingFigures(state: AdventureState, clock: number): SceneFigure[] {
  return MEETINGS.flatMap(({ person, place, pose }): SceneFigure[] => {
    if (person === 'ren') place = state.course.ren;
    if (person === 'mina') place = state.course.mina;
    const encounter = state.outings.find((o) => o.bundles.some((b) => b.kind === 'find' && b.find === `${person}-meeting`));
    if (person === 'mina' && encounter) place = encounter.bundles.find((b) => b.kind === 'find' && b.find === 'mina-meeting')?.sourcePlace ?? encounter.place;
    const home = placeDef(place);
    const arrived = state.phase === 'day' && state.outings.some((o) => (o.place === place || o.second?.place === place) && o.legs.some((leg) => leg.kind === 'beat' && state.elapsed >= leg.start));
    if (state.people.some((p) => p.id === person) || home.region > openedTo(state) || (!state.known.includes(place) && !arrived) || state.phase === 'night') return [];
    const returning = state.phase === 'day' ? state.outings.find((outing) => outing.bundles.some((bundle) => bundle.kind === 'find' && bundle.find === `${person}-meeting`) && state.elapsed >= Math.max(0, ...outing.legs.filter((leg) => leg.kind === 'beat' && leg.at && Math.hypot(leg.at.x - home.at.x, leg.at.y - home.at.y) < 50).map((leg) => leg.end))) : undefined;
    if (returning && person !== 'haru') {
      const stance = onLegs(person, returning.legs, state.elapsed, home.at);
      return [{ id: `meeting-${person}`, look: person, role: 'villager', at: { x: stance.at.x - 18, y: stance.at.y + 10 }, pose: stance.pose, facing: stance.facing, action: stance.action, pack: null, item: null, visible: true, selected: false }];
    }
    const visitor = state.phase === 'day' && state.outings.some((o) => (o.place === place || o.second?.place === place) && o.legs.some((leg) => leg.kind === 'beat' && leg.at && Math.hypot(leg.at.x - home.at.x, leg.at.y - home.at.y) < 50 && state.elapsed >= leg.start && state.elapsed < leg.end));
    return [{ id: `meeting-${person}`, look: person, role: 'villager', at: meetingSpot(place), pose: visitor ? 'talk' : pose, facing: (STAND[place]?.x ?? 24) < 0 ? 1 : -1, action: (clock * .5) % 1, pack: null, item: null, visible: true, selected: false }];
  });
}

/** Friends moving to the same camp meet on the road, then share a lane and a walking clock. */
import { dist, type Vec } from '../core/math';
import { DAY_SECONDS } from './calendar';
import { placeDef } from './content';
import { routeLength } from './navigation';
import { outingPace } from './people';
import type { Leg, Outing } from './state';
import type { Router } from './trail';

/** World units between walkers in a line: about a figure and a half. */
const SPACING = 34;

export function keepCampMovesTogether(outings: Outing[], route: Router, regional = false): void {
  const groups = new Map<string, Outing[]>();
  for (const outing of outings) {
    const place = placeDef(outing.place);
    if (place.kind !== 'settlement' || outing.visitOnly) continue;
    const key = `${outing.place}:${outing.lodging ?? ''}`;
    const group = groups.get(key) ?? []; group.push(outing); groups.set(key, group);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    // The welcoming conversation belongs to its discoverer; everyone else listens nearby.
    const leader = group.find(outing => outing.bundles.some(bundle => bundle.kind === 'find' && bundle.find.endsWith('-meeting'))) ?? group[0]!;
    const template = leader.legs.map(leg => ({ ...leg }));
    const walks = template.filter(leg => leg.kind === 'walk');
    if (!walks.length) continue;
    const first = walks[0]!.points!;
    // Different overnight homes meet farther along the shared road; nobody
    // walks all the way back upstream just to collect the others.
    const joinIndex = Math.min(Math.max(0, first.length - 4), Math.max(...group.map(outing => {
      const from = outing.legs.find(leg => leg.kind === 'walk')!.points![0]!;
      let nearest = 0;
      for (let i = 1; i < first.length; i++) if (dist(from, first[i]!) < dist(from, first[nearest]!)) nearest = i;
      return nearest;
    })));
    const sharedFirst = first.slice(joinIndex);
    const paths = new Map<Outing, Map<Leg, Vec[]>>();
    const approaches = new Map<Outing, Vec[]>();
    const slowest = Math.min(...group.map(outingPace));
    for (const outing of group) {
      const ownWalks = outing.legs.filter(leg => leg.kind === 'walk');
      const from = ownWalks[0]?.points?.[0], to = ownWalks.at(-1)?.points?.at(-1);
      const join = sharedFirst[0]!;
      approaches.set(outing, from && dist(from, join) > 1 ? route(from, join) : [join]);
      const byLeg = new Map<Leg, Vec[]>();
      for (const leg of walks) {
        let points = leg === walks[0] ? [...sharedFirst] : [...leg.points!];
        if (leg === walks.at(-1) && to && dist(to, points.at(-1)!) > 1) points.push(...route(points.at(-1)!, to).slice(1));
        byLeg.set(leg, points);
      }
      paths.set(outing, byLeg);
    }
    const gather = Math.max(.4, ...group.map(outing => routeLength(approaches.get(outing)!) / slowest));
    const seconds = new Map(walks.map((leg, index) => [leg, regional ? leg.end - leg.start : Math.max(1, ...group.map(outing => routeLength(paths.get(outing)!.get(leg)!) / slowest)) + (index === 0 ? gather : 0)]));
    const walking = [...seconds.values()].reduce((sum, n) => sum + n, 0);
    const beats = template.filter(leg => leg.kind === 'beat').reduce((sum, leg) => sum + leg.end - leg.start, 0);
    const limit = DAY_SECONDS - (regional ? 0 : 1);
    // Leave the line room to arrive: about half a second per follower.
    const tail = (group.length - 1) * .5;
    const walkScale = Math.min(1, (limit - .2 - tail) / walking);
    const beatScale = beats ? Math.min(1, Math.max(0, limit - tail - walking * walkScale) / beats) : 1;
    // Single file: each follower keeps a fixed walking distance behind the one ahead,
    // on the same line, so the group reads as a line of travellers rather than a knot.
    // The leader's clock (and any welcome) is untouched; followers arrive a moment later.
    const shared = paths.get(leader)!.get(walks[0]!)!;
    const sharedSeconds = Math.max(.5, seconds.get(walks[0]!)! * walkScale - gather * walkScale);
    const gap = Math.min(SPACING / Math.max(1, routeLength(shared) / sharedSeconds), sharedSeconds / (2 * group.length));
    const lastEnd = walking * walkScale + beats * beatScale;
    const followers = [leader, ...group.filter(outing => outing !== leader)];
    for (const outing of group) {
      const place = followers.indexOf(outing);
      const lag = Math.max(0, Math.min(place * gap, limit - lastEnd));
      let t = 0;
      const end = paths.get(outing)!.get(walks.at(-1)!)!.at(-1)!;
      outing.legs = template.flatMap((leg): Leg[] => {
        const duration = leg.kind === 'walk' ? seconds.get(leg)! * walkScale : (leg.end - leg.start) * beatScale;
        const start = t; t += duration;
        const from = start + (leg === walks[0] ? 0 : lag), to = t + lag;
        if (leg.kind === 'beat') return [{ ...leg, start: from, end: to, at: template.indexOf(leg) > template.indexOf(walks.at(-1)!) ? end : leg.at, ...(outing === leader ? {} : { text: undefined, sketch: null, pose: 'look' }) }];
        if (leg === walks[0]) {
          const joinAt = start + Math.min(gather * walkScale + lag, duration / 2 + lag);
          return [
            { kind: 'walk', pose: 'walk', start, end: joinAt, points: approaches.get(outing)! },
            { ...leg, start: joinAt, end: to, points: paths.get(outing)!.get(leg)! },
          ];
        }
        return [{ ...leg, start: from, end: to, points: paths.get(outing)!.get(leg)! }];
      });
    }
  }
}

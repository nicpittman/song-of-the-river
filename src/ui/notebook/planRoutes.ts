/** Notebook routes join the displayed base symbols; physical travel retains its real route. */
import type { AdventureView, SecondStop } from '../../game/adventure/model';
import type { Vec } from '../../game/core/math';
import { dist } from '../../game/core/math';
import { chapterGate } from './chapterGate';
import { mapBase } from './campPoint';

export interface PlanRoute {
  person: string;
  name: string;
  colour: string;
  destination: string;
  points: Vec[];
  provisional: boolean;
}

/** One face per person: home until a plan is confirmed, then its route endpoint. */
export function planningPins(view: AdventureView): Array<{ person: string; at: Vec; owner: string; label: string }> {
  const routes = planRoutes(view, null, null);
  return view.friends.map((friend) => {
    const route = routes.find((r) => r.person === friend.id);
    const at = route?.points.at(-1) ?? mapBase(view, friend);
    return { person: friend.id, at, owner: route && chapterGate(view)?.name === route.destination ? `journey-${chapterGate(view)!.id}` : `${at.x},${at.y}`, label: route ? `${friend.name} → ${route.destination}. View plan.` : `${friend.name} at ${friend.baseName}. Choose an outing.` };
  });
}

export function planRoutes(view: AdventureView, selectedPerson: string | null, selectedPlace: string | null, selectedSecond?: SecondStop, editingPerson?: string | null, detourPreview?: { person: string; stop: SecondStop } | null): PlanRoute[] {
  // A stop on the way being chosen shows on the map before it is set.
  const stopOf = (person: string): SecondStop | undefined => detourPreview?.person === person ? detourPreview.stop : view.plans.find((p) => p.person === person)?.detour;
  const routes: Array<{ person: string; target: string | Vec; destination: string; provisional: boolean }> = [];
  for (const plan of view.plans) {
    const destination = view.lodgings.find((l) => l.id === plan.lodging)?.name ?? view.places.find((p) => p.id === plan.place)?.name ?? plan.place;
    for (const person of [plan.person, ...(plan.companion ? [plan.companion] : [])]) {
      if (person === editingPerson && person === selectedPerson && selectedPlace) continue;
      routes.push({ person, target: plan.place, destination, provisional: false });
    }
  }
  for (const project of view.structures.filter((s) => s.status === 'building' && s.at)) {
    for (const person of view.friends.filter((f) => f.status === 'building' && f.base === project.region)) {
      if (person.id === editingPerson && person.id === selectedPerson && selectedPlace) continue;
      routes.push({ person: person.id, target: project.at!, destination: project.name, provisional: false });
    }
  }
  if (selectedPerson && selectedPlace && !routes.some((r) => r.person === selectedPerson)) {
    routes.push({ person: selectedPerson, target: selectedPlace, destination: view.places.find((p) => p.id === selectedPlace)?.name ?? selectedPlace, provisional: true });
  }
  return routes.flatMap((route) => {
    const friend = view.friends.find((f) => f.id === route.person);
    if (!friend) return [];
    const origin = mapBase(view, friend);
    const gate=chapterGate(view);
    if (gate && route.target===gate.id) {
      const boundary=view.chart.regions[view.region]!.bottom;
      const stop=view.plans.some((p) => p.person === friend.id && p.place === gate.id) ? stopOf(friend.id) : undefined;
      // A stop on the way down may lie upstream of camp: its trail keeps the whole way there.
      if (stop) return [{person:friend.id,name:friend.name,colour:friend.colour,destination:route.destination,points:[origin,...view.itinerary({ person: friend.id, place: gate.id, activity: 'visit', item: null, companion: null, detour: stop }).slice(1).filter(p=>p.y<boundary-80),gate.at],provisional:route.provisional}];
      const walk=view.route(friend.id,route.target);
      const points=trimCampApproach(walk, origin).filter(p=>p.y<boundary-80);
      // A single shared lane reads clearly when the whole group travels together.
      return [{person:friend.id,name:friend.name,colour:friend.colour,destination:route.destination,points:[origin,...points,gate.at],provisional:route.provisional}];
    }

    const assigned = route.provisional ? undefined : view.plans.find((p) => p.person === friend.id || p.companion === friend.id);
    // Moving camp within the reach by way of a stop: the walk goes there first, then on to the village.
    const stop = assigned?.moving && assigned.person === friend.id ? stopOf(friend.id) : undefined;
    if (assigned && stop) {
      const end = view.lodgings.find((l) => l.id === assigned.lodging)?.at ?? view.places.find((p) => p.id === assigned.place)?.at;
      const walk = view.itinerary({ ...assigned, detour: stop }).slice(1);
      // The walk ends at their seat by the fire; the trail ends at the village's own mark instead.
      if (end) {
        let cut = walk.length;
        while (cut > 0 && dist(walk[cut - 1]!, end) < 120) cut--;
        walk.splice(cut);
        walk.push(end);
      }
      return [{ person: friend.id, name: friend.name, colour: friend.colour, destination: route.destination, points: [origin, ...walk], provisional: route.provisional }];
    }
    const proposal = assigned?.second || assigned?.visitOnly ? assigned : route.provisional && selectedSecond && typeof route.target === 'string' ? { person: friend.id, place: route.target, activity: 'explore' as const, item: null, companion: null, second: selectedSecond } : null;
    const walk = proposal ? view.itinerary(proposal) : view.route(friend.id, route.target);
    // Omit the small walk from an individual's campfire seat to the shared lane.
    const points = proposal ? walk.slice(1) : trimCampApproach(walk, origin);
    const lastStop = proposal?.second ? view.places.find((p) => p.id === proposal.second!.place) : null;
    const end = lastStop?.at ?? view.lodgings.find((l) => l.id === assigned?.lodging)?.at
      ?? (typeof route.target === 'string' ? view.places.find((p) => p.id === route.target)?.at : route.target);
    // An itinerary already ends at its second stop. It may pass that place
    // on the way to the first; trimming at that early pass erases the detour.
    if (end && !proposal) {
      const nearEnd = points.findIndex((p, i) => i > 0 && dist(p, end) < 100);
      if (nearEnd >= 0) points.splice(nearEnd);
    }
    if (end && (!points.length || dist(points[points.length - 1]!, end) > .1)) points.push(end);
    return [{ person: friend.id, name: friend.name, colour: friend.colour, destination: lastStop ? `${route.destination} → ${lastStop.name}` : route.destination, points: [origin, ...points], provisional: route.provisional }];
  });
}

/** Join the shared camp mark at its nearest point on the actual route, omitting a roaming seat’s spur. */
export function trimCampApproach(walk: Vec[], origin: Vec): Vec[] {
  if(walk.length<2) return [...walk];
  let best=Infinity, cut=0;
  let join=walk[0]!;
  for(let i=0;i<walk.length-1;i++) {
    const a=walk[i]!, b=walk[i+1]!;
    const dx=b.x-a.x,dy=b.y-a.y;
    const t=Math.max(0,Math.min(1,((origin.x-a.x)*dx+(origin.y-a.y)*dy)/(dx*dx+dy*dy||1)));
    const at={x:a.x+t*dx,y:a.y+t*dy};
    const gap=dist(at,origin);
    if(gap<best) {best=gap;cut=i+1;join=at;}
  }
  return [join,...walk.slice(cut)];
}

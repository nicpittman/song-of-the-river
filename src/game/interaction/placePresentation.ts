import type { PlaceDef } from '../world/types';
import { identityFor } from '../world/identities';

/** These describe the actual connection rules, including places without land routes. */
export function placePresentation(place: PlaceDef): { role: string; hint: string; colour: number } {
  const chosen=identityFor(place.id,place.identity);
  if(chosen)return {role:chosen.title,hint:chosen.needs,colour:0xf0d4a0};
  if (place.kind === 'water') return { role: 'River · Fish', hint: 'Fish follow the river. Keep their passage clear.', colour: 0xa6dce0 };
  if (!place.links.length && place.rest) return { role: 'Refuge · Birds', hint: 'Birds need quiet resting places within flight range. Groves can fill a gap.', colour: 0xbadcc5 };
  const wildlife = place.links.includes('corridor');
  const people = place.links.includes('path');
  const kind = { forest: 'Woodland', grove: 'Grove', meadow: 'Meadow', village: 'Village', shrine: 'Shrine', wetland: 'Wetland', reeds: 'Reedbed', terrace: 'Terrace', orchard: 'Orchard', fields: 'Fields', landing: 'Landing', water: 'River' }[place.kind];
  return {
    role: `${kind} · ${wildlife && people ? 'Deer & people' : wildlife ? 'Deer' : people ? 'People' : 'Birds'}`,
    hint: wildlife && people ? 'Draw a woodland corridor or a footpath to another compatible place.' : wildlife ? 'Draw a woodland corridor to another deer habitat.' : people ? 'Draw a footpath to another place people visit.' : 'A quiet place to observe the valley.',
    colour: wildlife && !people ? 0xc6dda0 : people ? 0xf0d4a0 : 0xbadcc5,
  };
}

/**
 * A small valley for testing fish, birds and the river itself: one straight
 * river with a weir, an old bed looping round it, a ford below, a water meadow,
 * and two marshes too far apart to fly between.
 */

import { AUTUMN, type BoardDef, SPRING, SUMMER } from '../../world/types';

export const pond: BoardDef = {
  id: 'pond', name: 'Pond', subtitle: 'A test valley', width: 1000, height: 1100, seed: 7, snowAltitude: 2,
  hills: [], relief: [], islands: [], shallows: [], zones: [], woods: [], outcrops: [], lanes: [], sprites: [], scatter: [], banks: [], hearths: [],
  channels: [
    { id: 'main', points: [[500, -100, 60], [500, 500, 60], [500, 1200, 60]] },
    { id: 'old-bed', name: 'the old bed', closed: true, points: [[500, 300, 30], [650, 380, 30], [700, 500, 30], [650, 620, 30], [500, 700, 30]] },
  ],
  floodplains: [{ id: 'meadow', name: 'the water meadow', blobs: [{ x: 270, y: 760, r: 110 }], floods: [SPRING], relievedBy: ['old-bed'] }],
  weirs: [{ id: 'weir', name: 'the mill weir', x: 500, y: 500 }],
  fords: [{ id: 'stones', name: 'the stones', x: 500, y: 850, radius: 60, floods: [] }],
  maxBridgeSpan: 100,
  flight: 500,
  places: [
    { id: 'mouth', name: 'The river mouth', kind: 'water', x: 500, y: 1050, radius: 40, links: [], note: '' },
    { id: 'pool', name: 'The spawning pool', kind: 'water', x: 500, y: 100, radius: 40, links: [], note: '' },
    { id: 'west', name: 'West wood', kind: 'forest', x: 200, y: 850, radius: 90, links: ['corridor'], note: '' },
    { id: 'east', name: 'East wood', kind: 'forest', x: 820, y: 850, radius: 90, links: ['corridor'], note: '' },
    { id: 'north-wood', name: 'North wood', kind: 'forest', x: 330, y: 60, radius: 50, links: ['corridor'], note: '' },
    { id: 'isle', name: 'Isle wood', kind: 'forest', x: 590, y: 500, radius: 50, links: ['corridor'], note: '' },
    { id: 'home', name: 'Home', kind: 'village', x: 150, y: 560, radius: 70, links: ['path'], note: '' },
    { id: 'farm', name: 'Farm', kind: 'village', x: 380, y: 200, radius: 60, links: ['path'], note: '' },
    { id: 'mill', name: 'Mill', kind: 'village', x: 350, y: 980, radius: 50, links: ['path'], note: '' },
    { id: 'ferry', name: 'Ferry', kind: 'village', x: 820, y: 520, radius: 50, links: ['path'], note: '' },
    { id: 'north-marsh', name: 'North marsh', kind: 'wetland', x: 150, y: 150, radius: 80, links: [], rest: true, note: '' },
    { id: 'south-marsh', name: 'South marsh', kind: 'wetland', x: 850, y: 1000, radius: 80, links: [], rest: true, note: '' },
  ],
  patches: [{ material: 'wetland', blobs: [{ x: 660, y: 740, r: 110 }] }],
  journeys: [
    { id: 'run', traveller: 'fish', from: 'mouth', to: 'pool', seasons: [SPRING, SUMMER], every: 6 },
    { id: 'passage', traveller: 'bird', from: 'north-marsh', to: 'south-marsh', seasons: [AUTUMN], every: 8 },
  ],
  objectives: [
    { id: 'spawning', title: 'Spawning', text: '', story: '', journey: 'run', season: SPRING, count: 3 },
    { id: 'flyway', title: 'Flyway', text: '', story: '', journey: 'passage', season: AUTUMN, count: 2 },
  ],
  solution: [], par: 4, years: 2, opening: '',
};

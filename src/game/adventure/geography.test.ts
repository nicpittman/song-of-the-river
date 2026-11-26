import { describe, expect, it } from 'vitest';
import { dist } from '../core/math';
import { adventureValley } from '../world/boards/adventure';
import { River } from '../world/river';
import { openGround, placeToday } from './conditions';
import { PLACES } from './content';
import { WalkingMap } from './navigation';
import { seat } from './campSeats';
import { REGIONS, campOf } from './regions';
import { fireBesidePaths, underBuilding } from './settlement';
import { shelterFire } from './world';
import { newAdventure } from './state';
import { todayOf } from './world';

const river = new River(adventureValley);
const nav = new WalkingMap(adventureValley, river);

describe('the settlements', () => {
  it('keeps every painted firepit clear of the road, and moves shelter fires beside a path', () => {
    for (const fire of [...adventureValley.hearths, ...adventureValley.sprites.filter(sprite => sprite.asset === 'bonfire')]) {
      expect(fireBesidePaths(adventureValley, fire), `${fire.x},${fire.y}`).toBe(true);
    }
    for (const shelter of [{ x: 640, y: 366 }, { x: 650, y: 2640 }, { x: 2080, y: 5480 }]) {
      const fire = shelterFire(shelter);
      expect(fireBesidePaths(adventureValley, fire)).toBe(true);
      expect(nav.walkable(fire)).toBe(true);
      expect(dist(fire, { x: shelter.x, y: shelter.y + 100 })).toBeLessThan(200);
    }
  });
  it('lights each fire, and keeps every camp spot, on open ground clear of houses and water', () => {
    for (let r = 0; r < REGIONS.length; r++) {
      const camp = campOf(r);
      expect(adventureValley.hearths.some((hearth) => dist(hearth, camp.fire) < 1)).toBe(true);
      for (let i = 0; i < 6; i++) expect(dist(seat(camp.fire, i), camp.fire)).toBeGreaterThan(60);
      for (const p of [camp.fire, ...Array.from({ length: 6 }, (_, i) => seat(camp.fire, i)), ...camp.spots.map((s) => s.at)]) {
        expect(nav.walkable(p), `${REGIONS[r]!.name} ${p.x},${p.y}`).toBe(true);
        expect(underBuilding(adventureValley, p, 6), `${REGIONS[r]!.name} ${p.x},${p.y}`).toBe(false);
      }
      expect(camp.spots.length).toBeGreaterThanOrEqual(3);
      expect(dist(camp.fire, REGIONS[r]!.settlement)).toBeLessThan(260);
    }
  });
});

describe('walking', () => {
  it('reaches every place from its settlement when it is open, along routes that keep out of houses and deep water', () => {
    const state = newAdventure();
    // The far bank of Mio is reached by the bridge.
    state.buildings.push({ id: 1, kind: 'bridge', x: 1090, y: 3580, region: 1, work: 2, placed: 1 });
    state.buildings.push({ id: 2, kind: 'bridge', x: 1150, y: 4640, region: 2, work: 2, placed: 1 });
    const checked = new Set<string>();
    // High water, the first fall, low water, autumn, winter.
    for (const day of [1, 3, 4, 6, 9]) {
      const today = todayOf(2086, day);
      const ground = openGround(adventureValley, today, state);
      nav.setOpenGround(ground);
      for (const place of PLACES) {
        if (placeToday(place, today, state).state === 'closed') continue;
        const route = nav.route(campOf(place.region).fire, place.at, 6800);
        expect(route, `${place.id} on day ${day}`).not.toBeNull();
        checked.add(place.id);
        for (let i = 1; i < route!.length; i++) {
          const a = route![i - 1]!;
          const b = route![i]!;
          for (let k = 0; k <= 4; k++) {
            const p = { x: a.x + ((b.x - a.x) * k) / 4, y: a.y + ((b.y - a.y) * k) / 4 };
            expect(nav.insideBuilding(p), `${place.id} through a building at ${p.x},${p.y}`).toBe(false);
            const crossing = ground.some((g) => dist(g.at, p) < g.r);
            if (!crossing) expect(river.edgeDistance(p), `${place.id} through water at ${p.x},${p.y}`).toBeGreaterThan(0);
          }
        }
      }
    }
    expect(checked.size).toBe(PLACES.length);
  });

  it('keeps to the lanes where a lane goes the right way', () => {
    nav.setOpenGround([]);
    const route = nav.route(campOf(0).fire, PLACES.find((p) => p.id === 'kamimori')!.at, 6800)!;
    const onLane = route.filter((p) => nav.onLane(p)).length;
    expect(onLane / route.length).toBeGreaterThan(0.6);
  });
});

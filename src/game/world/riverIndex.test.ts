import { expect, it } from 'vitest';
import { lerp, pointSegment, type Vec } from '../core/math';
import { mulberry32 } from '../core/rng';
import { adventureValley } from './boards/adventure';
import { River, type RiverHit } from './river';

/** Original authored-order traversal, independent of the new spatial lookup. */
function exhaustive(river: River, p: Vec): RiverHit {
  let best: RiverHit | null = null, edge = Infinity;
  for (const channel of river.channels) for (let i = 0; i < channel.line.points.length-1; i++) {
    const a = channel.line.points[i]!, b = channel.line.points[i+1]!;
    const reach = edge+400;
    if (Math.abs(p.x-a.x) > reach && Math.abs(p.x-b.x) > reach) continue;
    const hit = pointSegment(p,a,b), half = lerp(channel.widths[i]!,channel.widths[i+1]!,hit.t)/2;
    if (hit.d-half < edge) {
      edge = hit.d-half;
      best = {channel,d:hit.d,half,along:lerp(channel.line.cumulative[i]!,channel.line.cumulative[i+1]!,hit.t),
        point:{x:lerp(a.x,b.x,hit.t),y:lerp(a.y,b.y,hit.t)}};
    }
  }
  return best!;
}

it('preserves existing river-edge queries through all three reaches, including wide and overlapping channels', () => {
  const river = new River(adventureValley), random = mulberry32(3719);
  const points: Vec[] = Array.from({length:1200},()=>({x:random()*3000-200,y:random()*7500-200}));
  // Banks and the centre of the widest sea-mouth segments exercise negative lower bounds.
  for (const channel of river.channels) for (let i = 0; i < channel.line.points.length; i += 23) {
    const at = channel.line.points[i]!;
    for (const offset of [-1,0,1]) points.push({x:at.x+channel.widths[i]!/2+offset,y:at.y});
  }
  for (const point of points) {
    const actual = river.nearest(point), expected = exhaustive(river,point);
    expect(actual.channel.id).toBe(expected.channel.id);
    expect(actual.d).toBeCloseTo(expected.d,8);
    expect(actual.half).toBeCloseTo(expected.half,8);
    expect(actual.along).toBeCloseTo(expected.along,8);
    expect(actual.point.x).toBeCloseTo(expected.point.x,8);
    expect(actual.point.y).toBeCloseTo(expected.point.y,8);
    expect(river.edgeDistance(point)).toBeCloseTo(expected.d-expected.half,8);
  }
});

it('rebuilds the lookup when an old bed opens and closes', () => {
  const board = {...adventureValley,channels:[
    {id:'main',points:[[100,0,40],[100,1000,40]] as [number,number,number][]},
    {id:'old-bed',closed:true,points:[[700,0,100],[700,1000,100]] as [number,number,number][]},
  ]};
  const river = new River(board), p = {x:700,y:500};
  expect(river.nearest(p).channel.id).toBe('main');
  river.setOpened(['old-bed']);
  expect(river.nearest(p).channel.id).toBe('old-bed');
  expect(river.edgeDistance(p)).toBeCloseTo(-50);
  river.setOpened([]);
  expect(river.nearest(p).channel.id).toBe('main');
  expect(river.beds.map(b=>b.id)).toEqual(['old-bed']);
});

it('keeps authored channel order for equal distances', () => {
  const points = [[100,0,40],[100,1000,40]] as [number,number,number][];
  const river = new River({...adventureValley,channels:[{id:'first',points},{id:'second',points}]});
  expect(river.nearest({x:100,y:500}).channel.id).toBe('first');
});

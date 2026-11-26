import { describe, expect, it } from 'vitest';
import { CHIP, FACE_STEP, MAP_TOKEN_SIZE, NEAR, STACK_FACES, chipRect, mapTokenSeat, seatFaces, stackWidth } from './mapTokens';

const clear = (a: {x:number;y:number;w:number;h:number}, b: {x:number;y:number;w:number;h:number}) => a.x >= b.x+b.w || a.x+a.w <= b.x || a.y >= b.y+b.h || a.y+a.h <= b.y;
const centreDistance = (seat: {x:number;y:number;w:number;h:number}, pin: {x:number;y:number}) => Math.hypot(seat.x+seat.w/2-pin.x,seat.y+seat.h/2-pin.y);

describe('map portrait seats', () => {
  it('keeps the inn and neighbouring settlement clickable with a whole group nearby', () => {
    const obstacles = [{ x: 95, y: 100, w: 44, h: 44 }, { x: 125, y: 65, w: 44, h: 44 }, { x: 140, y: 105, w: 90, h: 20 }];
    for (let i = 0; i < 6; i++) {
      const seat = mapTokenSeat({x:117,y:122},obstacles,{width:300,height:250});
      expect(seat).not.toBeNull();
      for (const box of obstacles) expect(clear(seat!,box)).toBe(true);
      obstacles.push(seat!);
    }
  });

  it('leaves a portrait off an impossibly small map instead of covering its only destination', () => {
    expect(mapTokenSeat({x:22,y:22},[{x:0,y:0,w:44,h:44}],{width:44,height:44})).toBeNull();
  });

  it('sits directly against a clear pin’s click target, without a preset row offset', () => {
    const pin = {x:150,y:150};
    const seat = mapTokenSeat(pin,[{x:128,y:128,w:44,h:44}],{width:320,height:300})!;
    expect(centreDistance(seat,pin)).toBe(39); // 22px target + 16px portrait + 1px separation.
    expect(seat.x+16).toBe(pin.x);
    expect(seat.y+16).toBeLessThan(pin.y);
  });

  it('uses the nearby side when a label blocks the top, rather than drifting farther above it', () => {
    const pin = {x:150,y:150};
    const obstacles = [{x:128,y:128,w:44,h:44},{x:80,y:90,w:160,h:38}];
    const seat = mapTokenSeat(pin,obstacles,{width:320,height:300})!;
    expect(centreDistance(seat,pin)).toBe(39);
    for (const obstacle of obstacles) expect(clear(seat,obstacle)).toBe(true);
  });

  it('packs six faces around their pin, keeping each previous face and the place name clear', () => {
    const pin = {x:180,y:180};
    const obstacles = [{x:158,y:158,w:44,h:44},{x:203,y:171,w:100,h:18}];
    for (let i = 0; i < 6; i++) {
      const seat = mapTokenSeat(pin,obstacles,{width:360,height:360})!;
      expect(seat).not.toBeNull();
      expect(centreDistance(seat,pin)).toBeLessThan(80);
      for (const obstacle of obstacles) expect(clear(seat,obstacle)).toBe(true);
      obstacles.push(seat);
    }
  });
});

it('keeps fractional zoom positions just as close as whole-pixel positions', () => {
  for (let i = 0; i < 100; i++) {
    const pin = {x:150+i*2.1397,y:170+i*1.7139};
    const seat = mapTokenSeat(pin,[{x:pin.x-22,y:pin.y-22,w:44,h:44}],{width:600,height:600})!;
    expect(seat).not.toBeNull();
    expect(centreDistance(seat,pin)).toBeCloseTo(39,8);
  }
});

it('can sit closer to a normal visible mark without covering its selection ring', () => {
  const pin = {x:150,y:150}, ring = {x:134,y:134,w:32,h:32};
  const seat = mapTokenSeat(pin,[ring],{width:320,height:300})!;
  expect(centreDistance(seat,pin)).toBe(33);
  expect(clear(seat,ring)).toBe(true);
});

describe('stacks of faces at a crowded place', () => {
  const pin = {x:180,y:180};
  const mark = {x:158,y:158,w:44,h:44}, name = {x:203,y:171,w:100,h:18};

  it('gathers three or more friends into one overlapping stack of its real size, within NEAR of the place', () => {
    for (const count of [3,4,5]) {
      const seats = seatFaces(pin,count,[mark],{width:360,height:360},[name]);
      expect(seats.kind).toBe('stack');
      if (seats.kind !== 'stack') continue;
      expect(seats.shown).toBe(count);
      expect(seats.box.w).toBe(stackWidth(count,false));
      expect(seats.box.w).toBe(MAP_TOKEN_SIZE+(count-1)*FACE_STEP);
      expect(seats.box.h).toBe(MAP_TOKEN_SIZE);
      expect(centreDistance(seats.box,pin)).toBeLessThanOrEqual(NEAR);
      expect(clear(seats.box,mark)).toBe(true);
      expect(clear(seats.box,name)).toBe(true);
    }
  });

  it('counts friends beyond a hand of faces on a chip', () => {
    const seats = seatFaces(pin,7,[mark],{width:360,height:360},[name]);
    expect(seats).toMatchObject({kind:'stack',shown:STACK_FACES-1});
    if (seats.kind === 'stack') expect(seats.box.w).toBe(stackWidth(STACK_FACES-1,true));
  });

  it('keeps two friends apart when both fit beside the place, and stacks them when they do not', () => {
    expect(seatFaces(pin,2,[mark],{width:360,height:360},[name]).kind).toBe('apart');
    // Marks hem the place in on every side but one gap just wide enough for a single face.
    const hemmed = [mark,{x:120,y:110,w:120,h:36},{x:120,y:202,w:120,h:60},{x:110,y:146,w:46,h:56},{x:240,y:146,w:30,h:56}];
    const seats = seatFaces(pin,2,hemmed,{width:360,height:360});
    expect(seats.kind).toBe('stack');
    if (seats.kind !== 'stack') return;
    expect(centreDistance(seats.box,pin)).toBeLessThanOrEqual(NEAR);
    for (const box of hemmed) expect(clear(seats.box,box)).toBe(true);
  });

  it('falls back to one face and a chip in the tightest spot, still within NEAR', () => {
    // Room for one portrait to the right of the place, not for a hand of faces.
    const tight = [mark,{x:150,y:100,w:60,h:57},{x:150,y:203,w:60,h:60},{x:100,y:150,w:57,h:60},{x:236,y:150,w:60,h:60}];
    const seats = seatFaces(pin,4,tight,{width:360,height:360});
    expect(seats).toMatchObject({kind:'stack',shown:1});
    if (seats.kind !== 'stack') return;
    expect(seats.box.w).toBe(MAP_TOKEN_SIZE);
    expect(centreDistance(seats.box,pin)).toBeLessThanOrEqual(NEAR);
    for (const box of tight) expect(clear(seats.box,box)).toBe(true);
  });

  it('would rather cover the quiet margin of a neighbouring ring than leave its place, never the mark itself', () => {
    // Walls on three sides; above, a neighbour's ring leaves no clear spot within NEAR, but its drawn mark is small.
    const own = {x:161,y:161,w:38,h:38};
    const ring = {x:164,y:101,w:32,h:32,core:{x:172,y:109,w:16,h:16}};
    const walls = [{x:0,y:0,w:140,h:360},{x:220,y:0,w:140,h:360},{x:0,y:200,w:360,h:160}];
    expect(mapTokenSeat(pin,[own,{...ring,core:undefined},...walls],{width:360,height:360})).toSatisfy((seat: {x:number;y:number;w:number;h:number}) => centreDistance(seat,pin) > NEAR);
    const seats = seatFaces(pin,3,[own,ring,...walls],{width:360,height:360});
    expect(seats).toMatchObject({kind:'stack',shown:3});
    if (seats.kind !== 'stack') return;
    expect(centreDistance(seats.box,pin)).toBeLessThanOrEqual(NEAR);
    for (const box of [own,ring.core,...walls]) expect(clear(seats.box,box)).toBe(true);
    expect(clear(seats.box,ring)).toBe(false);
  });

  it('keeps a stack clear of portraits already seated, as a single obstacle', () => {
    const seats = seatFaces(pin,3,[mark],{width:360,height:360},[name]);
    if (seats.kind !== 'stack') throw new Error('expected a stack');
    const next = mapTokenSeat(pin,[mark,seats.box],{width:360,height:360},[name])!;
    expect(clear(next,seats.box)).toBe(true);
  });
});

describe('a lone face’s "+N" chip', () => {
  const pin = {x:180,y:180};
  const mark = {x:158,y:158,w:44,h:44};
  // Room for one portrait to the right of the place, not for a hand of faces.
  const walls = [mark,{x:150,y:100,w:60,h:57},{x:150,y:203,w:60,h:60},{x:100,y:150,w:57,h:60},{x:236,y:150,w:60,h:60}];

  it('is drawn where chipRect says, poking past the face’s corner', () => {
    const face = {x:100,y:100,w:MAP_TOKEN_SIZE,h:MAP_TOKEN_SIZE};
    expect(chipRect(face,'bottom-right')).toEqual({x:100+MAP_TOKEN_SIZE+CHIP.out.x-CHIP.w,y:100+MAP_TOKEN_SIZE+CHIP.out.y-CHIP.h,w:CHIP.w,h:CHIP.h});
    expect(chipRect(face,'top-left')).toEqual({x:100-CHIP.out.x,y:100-CHIP.out.y,w:CHIP.w,h:CHIP.h});
    const tucked = chipRect(face,'bottom-right',true);
    expect(clear(tucked,{x:face.x-100,y:face.y,w:100,h:200})).toBe(true);
    expect(tucked.x+tucked.w).toBeLessThanOrEqual(face.x+face.w);
    expect(tucked.y+tucked.h).toBeLessThanOrEqual(face.y+face.h);
  });

  it('moves to another corner rather than cover a name beside the face', () => {
    // A pocket right of the place with room for one face and its chip, not a hand of faces.
    const pocket = [mark,{x:150,y:100,w:110,h:57},{x:150,y:203,w:110,h:60},{x:100,y:150,w:57,h:60},{x:248,y:150,w:60,h:60}];
    const open = seatFaces(pin,4,pocket,{width:360,height:360});
    if (open.kind !== 'stack' || !open.chip) throw new Error('expected a lone face with a chip');
    expect(open).toMatchObject({shown:1,corner:'bottom-right',tucked:false});
    // A neighbour's name just right of the face, where the lower-right chip would poke out.
    const name = {x:open.box.x+open.box.w+1,y:open.chip.y,w:40,h:18};
    const seats = seatFaces(pin,4,pocket,{width:360,height:360},[name]);
    expect(seats).toMatchObject({kind:'stack',shown:1});
    if (seats.kind !== 'stack') return;
    expect(seats.corner).not.toBe('bottom-right');
    expect(centreDistance(seats.box,pin)).toBeLessThanOrEqual(NEAR);
    expect(clear(seats.chip!,name)).toBe(true);
    expect(clear(seats.box,name)).toBe(true);
  });

  it('hides an ordinary neighbouring name before covering it, and never an important one', () => {
    // The only seat within NEAR has a neighbour's name across it.
    const name = {x:205,y:165,w:80,h:18};
    const firm = seatFaces(pin,4,walls,{width:360,height:360},[name]);
    if (firm.kind !== 'stack') throw new Error('expected a stack');
    expect(firm.hides).toBeUndefined();
    expect(clear(firm.box,name)).toBe(true);
    expect(clear(firm.chip!,name)).toBe(true);
    const ordinary = {...name,yields:true};
    const seats = seatFaces(pin,4,walls,{width:360,height:360},[ordinary]);
    if (seats.kind !== 'stack') throw new Error('expected a stack');
    expect(centreDistance(seats.box,pin)).toBeLessThanOrEqual(NEAR);
    expect(seats.hides).toEqual([ordinary]);
  });

  it('never overlaps a name that stays shown, wherever names and marks fall', () => {
    let seed = 7;
    const rand = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let lone = 0;
    for (let trial = 0; trial < 400; trial++) {
      const obstacles = [mark];
      for (let i = 0; i < 6; i++) obstacles.push({x:100+rand()*160,y:100+rand()*160,w:30+rand()*40,h:30+rand()*40});
      const names = Array.from({length:5},() => ({x:110+rand()*140,y:110+rand()*140,w:40+rand()*60,h:18,yields:rand()<0.5}));
      const seats = seatFaces(pin,4,obstacles.filter((o) => !(o !== mark && o.x < pin.x && o.x+o.w > pin.x && o.y < pin.y && o.y+o.h > pin.y)),{width:360,height:360},names);
      if (seats.kind !== 'stack' || seats.shown !== 1) continue;
      lone++;
      const hidden = seats.hides ?? [];
      for (const name of names) {
        if (hidden.includes(name)) { expect(name.yields).toBe(true); continue; }
        expect(clear(seats.chip!,name)).toBe(true);
        expect(clear(seats.box,name)).toBe(true);
      }
    }
    expect(lone).toBeGreaterThan(20);
  });
});

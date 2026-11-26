import { afterEach, expect, it, vi } from 'vitest';
import { TagLayer } from './tags';

afterEach(() => vi.unstubAllGlobals());

function positionCaption(x: number, y: number, headroom: number, width = 800, height = 600) {
  vi.stubGlobal('window', { innerWidth: width, innerHeight: height });
  const body = { x: x - 18, y: y - headroom, w: 36, h: headroom + 5 };
  const live = {
    tag: { kind: 'beat', person: 'sora', x, y, headroom, people: [body] },
    w: 170, h: 40, ox: 0, oy: 0, timer: null,
    el: { style: { transform: '', opacity: '' } }, tail: { style: {} }, dot: { style: {} },
  };
  const layer = Object.assign(Object.create(TagLayer.prototype), {
    view: null, reserved: [], insets: { top: 10, bottom: 10, left: 10, right: 10 },
  });
  layer.place([live], .1);
  const numbers = live.el.style.transform.match(/[-\d.]+/g)!.map(Number);
  return { live, body, x: numbers[0]!, y: numbers[1]!, layer };
}

it('places a caption above the projected head rather than over the person', () => {
  for (const headroom of [48, 90, 160]) {
    const placed = positionCaption(400, 400, headroom);
    expect(placed.y + placed.live.h).toBeLessThan(placed.body.y);
    expect(placed.live.el.style.opacity).toBe('1');
  }
});

it('keeps near-edge captions in the viewport and hides a passing note if it cannot avoid the body', () => {
  const placed = positionCaption(22, 95, 90, 320, 500);
  expect(placed.x).toBeGreaterThanOrEqual(10);
  expect(placed.x + placed.live.w).toBeLessThanOrEqual(310);
  expect(placed.y).toBeGreaterThanOrEqual(10);
  const overlap = placed.x < placed.body.x + placed.body.w && placed.x + placed.live.w > placed.body.x && placed.y < placed.body.y + placed.body.h && placed.y + placed.live.h > placed.body.y;
  expect(overlap ? placed.live.el.style.opacity === '0' : true).toBe(true);
});

it('keeps evening notes in chronological order above the banner as the camera and crowd move',()=>{
  vi.stubGlobal('window',{innerWidth:900,innerHeight:700});
  const card=(id:string)=>({tag:{id,kind:'unpack',people:[{x:250,y:50,w:400,h:500}]},w:320,h:72,ox:0,oy:0,
    el:{offsetWidth:320,offsetHeight:72,dataset:{},style:{transform:'',opacity:''}},tail:{style:{}},dot:{style:{}}});
  const first=card('one'),second=card('two'),third=card('three');
  const layer=Object.assign(Object.create(TagLayer.prototype),{
    view:{evening:{items:[{id:'one'},{id:'two'},{id:'three'}]}},
    lead:{getBoundingClientRect:()=>({top:400})},reserved:[],insets:{top:20,bottom:20,left:20,right:20},
    // Reduced motion, so each card stands in its place at once (no rising from hands).
    el:{closest:()=>true},leavingBundles:new Map(),group:null,
  });
  for(let frame=0;frame<60;frame++) layer.place([third,first,second],.1);
  const y=(notice:ReturnType<typeof card>)=>Number(notice.el.style.transform.match(/translate\([^,]+,\s*([-\d.]+)/)![1]);
  expect(y(first)+72).toBeLessThan(y(second));
  expect(y(second)+72).toBeLessThan(y(third));
  expect(y(third)+72).toBeLessThanOrEqual(376);
  const before=first.el.style.transform;
  first.tag.people=[];
  layer.place([third,first,second],.1);
  expect(first.el.style.transform).toBe(before);
});

it.each([390, 900])('centres the nightly banner and each recap card independently of the camp and camera at %i px', width => {
  vi.stubGlobal('window', { innerWidth: width, innerHeight: 700 });
  const banner = { offsetWidth: Math.min(380, width - 40), offsetHeight: 46, textContent: 'Tomorrow, the river.', style: { transform: '' }, getBoundingClientRect: () => ({ top: 476 }) };
  const card = (id: string, width: number) => ({ tag: { id, kind: 'unpack' }, w: width, h: 60, ox: 0, oy: 0,
    el: { offsetWidth: width, offsetHeight: 60, dataset: {}, style: { transform: '', opacity: '' } }, tail: { style: {} }, dot: { style: {} } });
  const first = card('one', 220), second = card('two', 300);
  const layer = Object.assign(Object.create(TagLayer.prototype), {
    view: { evening: { items: [{ id: 'one' }, { id: 'two' }] } }, lead: banner,
    reserved: [], insets: { top: 20, bottom: 20, left: 20, right: 20 },
    el: { closest: () => true }, leavingBundles: new Map(), group: { x: 50, y: 40, w: 100, h: 50 },
  });
  const x = (transform: string) => Number(transform.match(/translate\(([-\d.]+)/)![1]);
  const check = () => {
    layer.updateLead({ text: banner.textContent });
    layer.place([first, second], .1);
    expect(x(banner.style.transform) + banner.offsetWidth / 2).toBe(width / 2);
    expect(x(first.el.style.transform) + first.w / 2).toBe(width / 2);
    expect(x(second.el.style.transform) + second.w / 2).toBe(width / 2);
  };
  check();
  const before = banner.style.transform;
  layer.group = { x: 730, y: 550, w: 100, h: 100 };
  check();
  expect(banner.style.transform).toBe(before);
  const passing = { ...card('passing', 170), tag: { id: 'passing', kind: 'beat', x: 450, y: 400, remaining: 5, people: [] } };
  layer.place([first, passing, second], .1);
  expect(x(first.el.style.transform) + first.w / 2).toBe(width / 2);
  expect(x(second.el.style.transform) + second.w / 2).toBe(width / 2);
});

it('pins an interactive choice while the traveller and neighbouring captions move', () => {
  const placed = positionCaption(400, 400, 60);
  placed.live.tag.kind = 'choice'; Object.assign(placed.live.tag, { id: 'fork-sora', remaining: 8 });
  placed.layer.place([placed.live], .1);
  const before = placed.live.el.style.transform;
  placed.live.tag.x = 550; placed.live.tag.y = 450;
  placed.live.tag.people = [{ x: 250, y: 100, w: 450, h: 200 }];
  placed.layer.reserved = [{ left: 100, top: 200, width: 200, height: 60 }];
  for (let i = 0; i < 20; i++) placed.layer.place([placed.live], .1);
  expect(placed.live.el.style.transform).toBe(before);
});

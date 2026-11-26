import { afterEach, expect, it, vi } from 'vitest';
import { TagLayer } from './tags';

afterEach(() => vi.unstubAllGlobals());

type Rect = { x: number; y: number; w: number; h: number };
const drawn = (l: { el: { style: { transform: string } }; w: number; h: number }): Rect => {
  const [x, y] = l.el.style.transform.match(/[-\d.]+/g)!.map(Number);
  return { x: x!, y: y!, w: l.w, h: l.h };
};
const touch = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const shown = (l: { el: { style: { opacity: string } } }): boolean => l.el.style.opacity !== '0';

function phone() {
  vi.stubGlobal('window', { innerWidth: 390, innerHeight: 844 });
  const mk = (tag: Record<string, unknown>, w: number, h: number) => ({ tag: { headroom: 40, remaining: 5, people: [] as Rect[], ...tag } as Record<string, any>, w, h, ox: 0, oy: 0, timer: null,
    el: { style: { transform: '', opacity: '', pointerEvents: '' } }, tail: { style: {} }, dot: { style: {} } });
  const layer = Object.assign(Object.create(TagLayer.prototype), { view: null, insets: { top: 10, bottom: 10, left: 10, right: 10 },
    reserved: [{ left: 64, top: 0, width: 262, height: 76 }, { left: 8, top: 786, width: 374, height: 50 }] });
  return { mk, layer };
}

it('never lets a friend’s line and a creature’s caption show over each other as the friend walks past', () => {
  const { mk, layer } = phone();
  const line = mk({ id: 'beat-ren-3', kind: 'beat', person: 'ren', x: 200, y: 300 }, 240, 70);
  const walker = mk({ id: 'beat-mina', kind: 'beat', person: 'mina', x: 120, y: 250 }, 190, 42);
  const near = mk({ id: 's1-0', kind: 'sighting', person: null, x: 150, y: 340 }, 200, 32);
  const far = mk({ id: 's1-1', kind: 'sighting', person: null, x: 165, y: 560 }, 220, 32);
  const all = [line, walker, near, far];
  let hidden = 0;
  for (let i = 0; i < 300; i++) {
    line.tag.y = 300 + i * 0.6; line.tag.x = 200 + Math.sin(i / 20) * 10; walker.tag.y = 250 + i * 0.3;
    const people = [{ x: line.tag.x - 15, y: line.tag.y - 45, w: 30, h: 45 }, { x: walker.tag.x - 15, y: walker.tag.y - 45, w: 30, h: 45 }];
    for (const l of all) l.tag.people = people;
    layer.place([near, far, walker, line], 1 / 60);
    const r = all.map(drawn);
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) if (shown(all[a]!) && shown(all[b]!)) expect(touch(r[a]!, r[b]!)).toBe(false);
    hidden += all.filter((l) => !shown(l)).length;
  }
  // Stepping aside is a brief crossing, not a caption blinking all walk long.
  expect(hidden).toBeLessThan(30);
});

it('keeps a pinned conversation off a creature that comes out under it', () => {
  const { mk, layer } = phone();
  const speech = mk({ id: 'meeting-sora-ren', kind: 'beat', person: 'ren', x: 160, y: 455 }, 240, 52);
  for (let i = 0; i < 10; i++) layer.place([speech], .05);
  const card = drawn(speech);
  const creature = mk({ id: 's1-0', kind: 'sighting', person: null, x: card.x + 60, y: card.y + 40 }, 140, 32);
  for (let i = 0; i < 40; i++) layer.place([creature, speech], .05);
  const body = { x: creature.tag.x - 12, y: creature.tag.y - 12, w: 24, h: 24 };
  expect(touch(drawn(speech), body)).toBe(false);
  expect(shown(speech)).toBe(true);
});

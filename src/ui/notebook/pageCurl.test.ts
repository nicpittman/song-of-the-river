import { afterEach, expect, it, vi } from 'vitest';
import { bezier, foldAt, isolateSnapshot, PageCurl } from './pageCurl';

afterEach(() => vi.unstubAllGlobals());

const area = (polygon: Array<{ x: number; y: number }>): number => Math.abs(polygon.reduce((sum, p, i) => {
  const q = polygon[(i + 1) % polygon.length];
  return sum + p.x * q.y - q.x * p.y;
}, 0)) / 2;

it.each([1, -1])('keeps the leaf intact through a turn in direction %s', direction => {
  const page = { x: direction === 1 ? 500 : 0, y: 20, w: 500, h: 700 };
  const hinge = direction === 1 ? page.x : page.x + page.w;
  const from = { x: hinge + direction * page.w, y: page.y };
  expect(foldAt(page, from, from)).toBeNull();
  for (let i = 1; i <= 100; i++) {
    const t = i / 100;
    const corner = { x: from.x - direction * 2 * page.w * t, y: page.y + 120 * Math.sin(Math.PI * t) };
    const fold = foldAt(page, from, corner)!;
    expect(area(fold.flat) + area(fold.gone)).toBeCloseTo(page.w * page.h, 5);
    expect(area(fold.flap)).toBeCloseTo(area(fold.gone), 5);
    expect([...fold.flat, ...fold.flap].every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    if (i === 100) {
      expect(area(fold.flat)).toBeCloseTo(0);
      expect(Math.min(...fold.flap.map(p => p.x))).toBeCloseTo(direction === 1 ? 0 : 500);
      expect(Math.max(...fold.flap.map(p => p.x))).toBeCloseTo(direction === 1 ? 500 : 1000);
    }
  }
});

it('keeps desktop and compact easing continuous and forward-moving', () => {
  for (const easing of [bezier(0.4, 0.2, 0.5, 1), bezier(0.3, 0.2, 0.7, 0.85)]) {
    let previous = 0;
    for (let i = 0; i <= 100; i++) {
      const value = easing(i / 100);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThanOrEqual(1);
      previous = value;
    }
    expect(previous).toBe(1);
  }
});

class SnapshotNode {
  constructor(private values: Record<string, string>, private children: SnapshotNode[] = []) {}
  get attributes(): Array<{ name: string; value: string }> { return Object.entries(this.values).map(([name, value]) => ({ name, value })); }
  getAttribute(name: string): string | null { return this.values[name] ?? null; }
  setAttribute(name: string, value: string): void { this.values[name] = value; }
  removeAttribute(name: string): void { delete this.values[name]; }
  querySelectorAll(): SnapshotNode[] { return this.children; }
}

it('isolates copied SVG definitions and labels without changing external references', () => {
  const definition = new SnapshotNode({ id: 'river-fill' });
  const label = new SnapshotNode({ id: 'place-label', 'data-k': 'place' });
  const drawing = new SnapshotNode({ fill: 'url(#river-fill)', style: 'clip-path:url("#river-fill")', href: '#river-fill', 'aria-labelledby': 'place-label external-label', 'data-k': 'map' });
  const external = new SnapshotNode({ href: '/art/fish.svg#fish', fill: 'url(#external-gradient)' });
  const root = new SnapshotNode({ id: 'page', 'data-k': 'root' }, [definition, label, drawing, external]);
  isolateSnapshot(root as unknown as HTMLElement, 'turn-1-');
  expect(root.getAttribute('id')).toBe('turn-1-page');
  expect(definition.getAttribute('id')).toBe('turn-1-river-fill');
  expect(drawing.getAttribute('fill')).toBe('url(#turn-1-river-fill)');
  expect(drawing.getAttribute('style')).toBe('clip-path:url("#turn-1-river-fill")');
  expect(drawing.getAttribute('href')).toBe('#turn-1-river-fill');
  expect(drawing.getAttribute('aria-labelledby')).toBe('turn-1-place-label external-label');
  expect([root, label, drawing].every(node => node.getAttribute('data-k') === null)).toBe(true);
  expect(external.getAttribute('href')).toBe('/art/fish.svg#fish');
  expect(external.getAttribute('fill')).toBe('url(#external-gradient)');
});

it('settles an interrupted turn without leaving a transformed or clipped live page', () => {
  const cancel = vi.fn();
  vi.stubGlobal('cancelAnimationFrame', cancel);
  const style = { transform: 'matrix(1,0,0,1,10,20)', transformOrigin: '0 0', clipPath: 'polygon(0 0,0 0,0 0)', willChange: 'transform', zIndex: '3' };
  const remove = vi.fn();
  const curl = Object.assign(Object.create(PageCurl.prototype), { frame: 42, landing: { style }, layer: { remove } }) as PageCurl;
  curl.cancel();
  curl.cancel();
  expect(cancel).toHaveBeenCalledWith(42);
  expect(Object.values(style).every(value => value === '')).toBe(true);
  expect(remove).toHaveBeenCalledOnce();
});

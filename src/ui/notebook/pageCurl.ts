/**
 * The page turn: a leaf taken by its top corner and drawn across the book.
 *
 * The corner travels over and a little down; the page folds along the line
 * halfway between where the corner was and where it is now. That crease
 * starts as a slant across the corner, sweeps the page, and stands upright
 * in the gutter as the leaf lands. Past the crease the page beneath shows;
 * the folded-over part is the back of the leaf, which is the page being
 * turned to, and a soft roll of light and shadow sits along the crease.
 *
 * Just before the book's pages are replaced, the outgoing pages are copied.
 * The copies lie exactly over the book and are cut away as the leaf moves;
 * the leaf's back is the live page it lands as, swung about the crease.
 *
 * On a phone, where the book shows one page, the outgoing page peels away
 * from its hinge, its back plain paper, and the new page is there beneath.
 *
 * The copies live beside the book, not inside it, so the styles of the page
 * being turned to never reach them.
 */

import { h, svgEl } from '../dom';

type Pt = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };
/** Where the leaf is at one moment. */
type Fold = {
  /** A point on the crease, and the direction across it toward the side folded away. */
  mid: Pt;
  across: Pt;
  /** The part of the page still lying flat. */
  flat: Pt[];
  /** The part folded away, where it used to lie: the page beneath shows here. */
  gone: Pt[];
  /** The folded part where it lies now, and its free edge from one end of the crease to the other. */
  flap: Pt[];
  free: Pt[];
};

const INK = '#463a22';

/** A CSS-style cubic-bezier easing. */
export function bezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  return (t) => {
    let u = t;
    for (let i = 0; i < 8; i++) {
      const x = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u - t;
      const d = 3 * (1 - u) * (1 - u) * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u * u * (1 - x2);
      if (Math.abs(d) < 1e-6) break;
      u -= x / d;
    }
    return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
  };
}

/** An unhurried lift, quickest through the middle, a long soft landing. */
const SPREAD_EASE = bezier(0.4, 0.2, 0.5, 1);
/** One page peeling away: it gathers pace and is gone. */
const SINGLE_EASE = bezier(0.3, 0.2, 0.7, 0.85);

const between = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);
const n = (v: number): string => v.toFixed(2);
const outline = (poly: Pt[], dx = 0, dy = 0): string => (poly.length < 3 ? 'M0 0Z' : `M${poly.map((p) => `${n(p.x - dx)} ${n(p.y - dy)}`).join('L')}Z`);

/** The part of a polygon on one side of a line; points made on the line are marked as on the crease. */
function cut(poly: Pt[], mid: Pt, across: Pt, keep: 1 | -1): Array<Pt & { crease?: boolean }> {
  const side = (p: Pt): number => ((p.x - mid.x) * across.x + (p.y - mid.y) * across.y) * keep;
  const out: Array<Pt & { crease?: boolean }> = [];
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const da = side(a), db = side(b);
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) {
      const k = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, crease: true });
    }
  });
  return out;
}

/** Draws a polygon in a hair toward its middle, so what lies beside it laps it and no seam opens. */
function inset(poly: Pt[], by: number): Pt[] {
  if (poly.length < 3) return poly;
  const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length, cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
  return poly.map((p) => {
    const d = Math.hypot(cx - p.x, cy - p.y) || 1;
    return { x: p.x + ((cx - p.x) / d) * by, y: p.y + ((cy - p.y) / d) * by };
  });
}

/**
 * The fold for a page hinged at `hingeX`, its free top corner at `from`,
 * when that corner has been carried to `corner`.
 */
export function foldAt(page: Box, from: Pt, corner: Pt): Fold | null {
  const dx = from.x - corner.x, dy = from.y - corner.y, len = Math.hypot(dx, dy);
  if (len < 0.5) return null;
  const across = { x: dx / len, y: dy / len };
  const mid = { x: (from.x + corner.x) / 2, y: (from.y + corner.y) / 2 };
  const rect = [{ x: page.x, y: page.y }, { x: page.x + page.w, y: page.y }, { x: page.x + page.w, y: page.y + page.h }, { x: page.x, y: page.y + page.h }];
  const flat = cut(rect, mid, across, -1);
  const gone = cut(rect, mid, across, 1);
  const over = (p: Pt): Pt => {
    const d = (p.x - mid.x) * across.x + (p.y - mid.y) * across.y;
    return { x: p.x - 2 * d * across.x, y: p.y - 2 * d * across.y };
  };
  const flap = gone.map(over);
  // The free edge runs from one end of the crease round to the other, not along the crease itself.
  let free: Pt[] = [];
  const a = gone.findIndex((p, i) => p.crease && gone[(i + 1) % gone.length].crease);
  if (a >= 0) for (let i = 1; i <= gone.length; i++) free.push(flap[(a + i) % gone.length]);
  else free = flap;
  return { mid, across, flat, gone, flap, free };
}

const LIGHT =
  '<defs>' +
  `<linearGradient id="nb-pt-roll" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${INK}"/><stop offset=".09" stop-color="${INK}"/><stop offset=".28" stop-color="#fffdf6"/><stop offset=".62" stop-color="${INK}"/><stop offset="1" stop-color="${INK}" stop-opacity="0"/></linearGradient>` +
  `<linearGradient id="nb-pt-under" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${INK}"/><stop offset=".35" stop-color="${INK}" stop-opacity=".4"/><stop offset="1" stop-color="${INK}" stop-opacity="0"/></linearGradient>` +
  '<linearGradient id="nb-pt-wash" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:var(--wash-straw,#e6d7a8)" stop-opacity="0"/><stop offset=".19" style="stop-color:var(--wash-straw,#e6d7a8)"/><stop offset="1" style="stop-color:var(--wash-straw,#e6d7a8)" stop-opacity="0"/></linearGradient>' +
  '<filter id="nb-pt-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>' +
  '<clipPath id="nb-pt-pages"></clipPath>' +
  '<clipPath id="nb-pt-beside"><path clip-rule="evenodd"/></clipPath>' +
  '</defs>' +
  '<g clip-path="url(#nb-pt-pages)">' +
  '<rect data-part="wash" fill="url(#nb-pt-wash)" opacity="0"/>' +
  '<path data-part="under" fill="url(#nb-pt-under)" opacity="0"/>' +
  `<g clip-path="url(#nb-pt-beside)"><path data-part="cast" fill="${INK}" filter="url(#nb-pt-soft)" opacity="0"/></g>` +
  '</g>' +
  '<path data-part="back" style="fill:var(--ivory-deep,#ece5d2)" visibility="hidden"/>' +
  '<path data-part="roll" fill="url(#nb-pt-roll)"/>' +
  `<path data-part="edge" fill="none" stroke="${INK}" stroke-width="1" stroke-linejoin="round" stroke-opacity="0"/>`;

/** The light on a turning leaf: the roll along its crease, the shade beneath it, the shadow it casts, the morning wash. */
class Light {
  readonly el = svgEl('svg', { class: 'nb-pageturn-light', 'aria-hidden': 'true' });
  private readonly part: Record<string, SVGElement> = {};
  private readonly grad: Record<string, SVGElement> = {};
  private readonly rollStops: SVGStopElement[];
  private readonly beside: SVGElement;
  private readonly blur: SVGElement;
  private readonly bounds: Box;

  /**
   * @param pages the pages the shadows may fall on
   * @param width one page's width
   * @param plainBack whether the leaf's back is drawn here as plain paper (no page lands as it)
   */
  constructor(pages: Box[], private readonly width: number, plainBack: boolean, private readonly daybreak: boolean) {
    this.el.innerHTML = LIGHT;
    this.el.querySelectorAll<SVGElement>('[data-part]').forEach((p) => (this.part[p.dataset.part ?? ''] = p));
    for (const id of ['roll', 'under', 'wash']) this.grad[id] = this.el.querySelector<SVGElement>(`#nb-pt-${id}`)!;
    this.rollStops = [...this.grad.roll.querySelectorAll('stop')];
    this.beside = this.el.querySelector<SVGElement>('#nb-pt-beside path')!;
    this.blur = this.el.querySelector<SVGElement>('feGaussianBlur')!;
    const clip = this.el.querySelector('#nb-pt-pages')!;
    for (const p of pages) clip.append(svgEl('rect', { x: p.x, y: p.y, width: p.w, height: p.h, rx: 7 }));
    const left = Math.min(...pages.map((p) => p.x)), right = Math.max(...pages.map((p) => p.x + p.w));
    const top = Math.min(...pages.map((p) => p.y)), bottom = Math.max(...pages.map((p) => p.y + p.h));
    this.bounds = { x: left, y: top, w: right - left, h: bottom - top };
    set(this.part.wash, { x: left, y: top, width: right - left, height: bottom - top });
    if (plainBack) this.part.back.removeAttribute('visibility');
  }

  /** @param lifted 0 lying flat, 1 at the height of the turn */
  draw(fold: Fold | null, lifted: number): void {
    if (!fold || fold.flap.length < 3) {
      for (const p of ['roll', 'back', 'edge', 'under', 'cast']) set(this.part[p], { d: 'M0 0Z' });
      return;
    }
    const { mid, across, flap } = fold;
    const shape = outline(flap);
    // How far the leaf's back reaches from the crease.
    const reach = Math.max(1, ...flap.map((p) => (mid.x - p.x) * across.x + (mid.y - p.y) * across.y));

    // The roll: the paper turns away at the crease, catches the light just past it, and settles flat.
    const span = Math.min(reach, this.width * 0.5);
    set(this.grad.roll, { x1: mid.x, y1: mid.y, x2: mid.x - across.x * span, y2: mid.y - across.y * span });
    [0.2, 0.07, 0.15, 0.04].forEach((strength, i) => set(this.rollStops[i], { 'stop-opacity': strength * lifted }));
    set(this.part.roll, { d: shape });
    set(this.part.back, { d: shape });
    set(this.part.edge, { d: `M${fold.free.map((p) => `${n(p.x)} ${n(p.y)}`).join('L')}`, 'stroke-opacity': 0.1 + 0.16 * lifted });

    // Under the roll: the page beneath is shaded where the leaf curls up from it.
    const depth = this.width * (0.05 + 0.13 * lifted);
    set(this.grad.under, { x1: mid.x, y1: mid.y, x2: mid.x + across.x * depth, y2: mid.y + across.y * depth });
    set(this.part.under, { d: outline(fold.gone), opacity: 0.26 * Math.pow(lifted, 0.8) });

    // The leaf's shadow, ahead of its free edge: softest when the leaf is highest, closing as it lands.
    const lead = 3 + 11 * lifted;
    set(this.part.cast, { d: outline(flap, across.x * lead, across.y * lead - 3 * lifted), opacity: 0.3 * Math.pow(lifted, 0.8) });
    set(this.blur, { stdDeviation: 3 + 9 * lifted });
    const b = this.bounds;
    set(this.beside, { d: `M${n(b.x - 40)} ${n(b.y - 40)}h${n(b.w + 80)}v${n(b.h + 80)}h${n(-b.w - 80)}Z${shape}` });

    // Daybreak only: a straw wash of morning light follows the crease across.
    if (this.daybreak) {
      set(this.grad.wash, { x1: mid.x - across.x * this.width * 0.3, y1: mid.y - across.y * this.width * 0.3, x2: mid.x + across.x * this.width * 1.3, y2: mid.y + across.y * this.width * 1.3 });
      set(this.part.wash, { opacity: 0.32 * Math.pow(lifted, 0.6) });
    }
  }
}

function set(el: Element, attrs: Record<string, string | number>): void {
  for (const k in attrs) {
    const v = attrs[k];
    el.setAttribute(k, typeof v === 'number' ? v.toFixed(3) : v);
  }
}

/** Gives a copied page the scroll positions of the page it was copied from. */
function matchScroll(from: HTMLElement, to: HTMLElement): void {
  const a = [from, ...from.querySelectorAll<HTMLElement>('*')];
  const b = [to, ...to.querySelectorAll<HTMLElement>('*')];
  for (let i = 0; i < a.length && i < b.length; i++) {
    if (a[i].scrollTop) b[i].scrollTop = a[i].scrollTop;
    if (a[i].scrollLeft) b[i].scrollLeft = a[i].scrollLeft;
  }
}

let snapshotSerial = 0;

/** Copies must not steal the live page's SVG gradients, clips or labelled IDs. */
export function isolateSnapshot(page: HTMLElement, prefix: string): void {
  const nodes = [page, ...page.querySelectorAll<HTMLElement>('*')];
  const ids = new Map<string, string>();
  for (const node of nodes) {
    const id = node.getAttribute('id');
    if (id) ids.set(id, `${prefix}${id}`);
  }
  for (const node of nodes) {
    node.removeAttribute('data-k');
    for (const attribute of [...node.attributes]) {
      let value = attribute.value;
      if (attribute.name === 'id') value = ids.get(value) ?? value;
      else if (['href', 'xlink:href'].includes(attribute.name) && value.startsWith('#')) value = `#${ids.get(value.slice(1)) ?? value.slice(1)}`;
      else if (['aria-labelledby', 'aria-describedby', 'aria-controls', 'for'].includes(attribute.name)) value = value.split(/\s+/).map(id => ids.get(id) ?? id).join(' ');
      else value = value.replace(/url\((['"]?)#([^)'"\s]+)\1\)/g, (_match, quote: string, id: string) => `url(${quote}#${ids.get(id) ?? id}${quote})`);
      if (value !== attribute.value) node.setAttribute(attribute.name, value);
    }
  }
}

export class PageCurl {
  private frame = 0;
  private layer: HTMLElement | null = null;
  /** The live page being shown as the leaf's back, so it can be laid flat again. */
  private landing: HTMLElement | null = null;

  constructor(
    private readonly book: HTMLElement,
    private readonly left: HTMLElement,
    private readonly right: HTMLElement,
  ) {}

  /**
   * Call just before the book's pages change. `forward` turns the right page
   * over to the left; otherwise the left page comes back to the right.
   * `daybreak` is the one slower turn, from the evening's page to the morning.
   */
  play(forward: boolean, daybreak = false): void {
    this.cancel();
    const frame = this.book.parentElement;
    const bookBox = this.book.getBoundingClientRect();
    if (!frame || bookBox.width < 2) return;
    const box = (el: HTMLElement): Box => {
      const r = el.getBoundingClientRect();
      return { x: r.left - bookBox.left, y: r.top - bookBox.top, w: r.width, h: r.height };
    };
    const leftBox = box(this.left), rightBox = box(this.right);

    // Copy the outgoing pages into a stand-in for the book, laid exactly over it.
    const ghost = this.book.cloneNode(false) as HTMLElement;
    const copy = (page: HTMLElement): HTMLElement | null => {
      if (getComputedStyle(page).display === 'none') return null;
      const c = page.cloneNode(true) as HTMLElement;
      isolateSnapshot(c, `nb-turn-${++snapshotSerial}-`);
      // Pictures are already loaded: draw them at once, not a frame late.
      c.querySelectorAll('img').forEach((img) => { img.decoding = 'sync'; img.loading = 'eager'; });
      ghost.append(c);
      return c;
    };
    const ghostLeft = copy(this.left), ghostRight = copy(this.right);
    const layer = h('div', 'nb-pageturn', { 'aria-hidden': 'true', inert: '' }, [ghost]);
    layer.style.cssText = `left:${this.book.offsetLeft}px;top:${this.book.offsetTop}px;width:${this.book.offsetWidth}px;height:${this.book.offsetHeight}px`;
    frame.append(layer);
    this.layer = layer;
    if (ghostLeft) matchScroll(this.left, ghostLeft);
    if (ghostRight) matchScroll(this.right, ghostRight);

    const dir = forward ? 1 : -1;
    // The corner's path, in page widths from the top of the hinge: out and down, across, and up to land.
    const path = [
      { x: 1, y: 0 },
      { x: between(0.6, 0.68), y: between(0.22, 0.29) },
      { x: -between(0.5, 0.6), y: between(0.17, 0.24) },
      { x: -1, y: 0 },
    ];
    const along = (u: number, hinge: Pt, w: number): Pt => {
      const v = 1 - u;
      const k = [v * v * v, 3 * v * v * u, 3 * v * u * u, u * u * u];
      const x = k.reduce((s, c, i) => s + c * path[i].x, 0), y = k.reduce((s, c, i) => s + c * path[i].y, 0);
      return { x: hinge.x + dir * w * x, y: hinge.y + w * y };
    };
    const pace = between(0.96, 1.04);
    const spread = !!ghostLeft && !!ghostRight && leftBox.w > 1 && rightBox.w > 1 && leftBox.x + leftBox.w <= rightBox.x + 6;

    let draw: (t: number) => void;
    let duration: number;

    if (spread) {
      const near = forward ? ghostRight! : ghostLeft!;
      const still = forward ? ghostLeft! : ghostRight!;
      const live = forward ? this.left : this.right;
      const page = forward ? rightBox : leftBox, farBox = forward ? leftBox : rightBox;
      const hinge = { x: forward ? page.x : page.x + page.w, y: page.y };
      const from = { x: hinge.x + dir * page.w, y: page.y };
      const light = new Light([leftBox, rightBox], page.w, false, daybreak);
      layer.append(light.el);
      this.landing = live;
      live.style.transformOrigin = '0 0';
      live.style.willChange = 'transform';
      // Over its facing page while it is in the air.
      live.style.zIndex = '3';
      duration = daybreak ? 900 : 780 * pace;
      draw = (t) => {
        const u = SPREAD_EASE(t);
        const fold = foldAt(page, from, along(u, hinge, page.w));
        if (!fold) {
          live.style.clipPath = 'polygon(0 0,0 0,0 0)';
          near.style.clipPath = still.style.clipPath = '';
        } else {
          const { mid, across } = fold;
          // The leaf's back is the page it lands as: mirrored through the gutter, then over the crease, which is a swing about where they meet.
          const a = 2 * across.x * across.x - 1, b = 2 * across.x * across.y, c = -2 * across.x * across.y, d = 1 - 2 * across.y * across.y;
          const ox = 2 * hinge.x - farBox.x, oy = farBox.y;
          const k = (ox - mid.x) * across.x + (oy - mid.y) * across.y;
          live.style.transform = `matrix(${a},${b},${c},${d},${ox - 2 * k * across.x - farBox.x},${oy - 2 * k * across.y - farBox.y})`;
          live.style.clipPath = `path('${outline(fold.gone.map((p) => ({ x: 2 * hinge.x - p.x, y: p.y })), farBox.x, farBox.y)}')`;
          // The copies give way under the leaf (lapping it a hair, so no seam opens).
          const hole = inset(fold.flap, 1.2);
          near.style.clipPath = `path(evenodd,'${outline(fold.flat, page.x, page.y)}${outline(hole, page.x, page.y)}')`;
          still.style.clipPath = `path(evenodd,'M0 0H${n(farBox.w)}V${n(farBox.h)}H0Z${outline(hole, farBox.x, farBox.y)}')`;
        }
        light.draw(fold, Math.pow(Math.sin(Math.PI * u), 0.6));
      };
    } else {
      // One page showing: it peels away from its hinge, and the new page is there beneath it.
      const pageGhost = leftBox.w > 1 ? ghostLeft : rightBox.w > 1 ? ghostRight : null;
      const sheet = pageGhost ?? ghost;
      if (!pageGhost) ghost.classList.add('is-sheet');
      const page: Box = pageGhost ? (leftBox.w > 1 ? leftBox : rightBox) : { x: 0, y: 0, w: bookBox.width, h: bookBox.height };
      const hinge = { x: forward ? page.x : page.x + page.w, y: page.y };
      const from = { x: hinge.x + dir * page.w, y: page.y };
      const light = new Light([page], page.w, true, daybreak);
      layer.append(light.el);
      duration = daybreak ? 720 : 620 * pace;
      draw = (t) => {
        const u = SINGLE_EASE(t);
        const fold = foldAt(page, from, along(u, hinge, page.w));
        sheet.style.clipPath = fold ? `path('${outline(fold.flat, page.x, page.y)}')` : '';
        light.draw(fold, Math.pow(Math.sin(Math.PI * u), 0.6));
      };
    }

    const start = performance.now();
    const step = (now: number): void => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      draw(t);
      if (t < 1) this.frame = requestAnimationFrame(step);
      else this.cancel();
    };
    draw(0);
    this.frame = requestAnimationFrame(step);
  }

  /** Ends a turn at once: the copies go, and the book is as it will be. */
  cancel(): void {
    cancelAnimationFrame(this.frame);
    const page = this.landing;
    if (page) {
      page.style.transform = '';
      page.style.transformOrigin = '';
      page.style.clipPath = '';
      page.style.willChange = '';
      page.style.zIndex = '';
      this.landing = null;
    }
    this.layer?.remove();
    this.layer = null;
  }
}

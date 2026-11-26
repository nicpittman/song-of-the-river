/**
 * Places as ink on a map laid lightly over the painting: a small hand-drawn
 * ring and a name in the book's serif. Open places are a plain ring; closed
 * ones a broken, faded ring; special ones a second fine ring in rust ink;
 * a lead adds a small leaf. Minor places are a smaller mark whose name shows
 * on hover, when selected, or close up. Names are placed so they never
 * overlap each other, the marks, or the figures (see `labelLayout.ts`).
 *
 * A place responds when touched: it swells on hover, ripples on a press, and
 * when it is inspected or selected an ink ring settles round it, its name
 * comes forward, and there is a small touch of life at the spot (see `PlaceLife`).
 */

import { type Container, Graphics, Text } from 'pixi.js';
import type { ScenePlace } from '../../adventure/model';
import { type FrameInfo, VIEW_MARGIN } from './frame';
import { type Box, type LabelItem, layoutLabels, slotOrigin } from './labelLayout';

/** Where a fixed name sits: settlements above their mark, places below. */
const FIXED_SLOT = { settlement: 3, place: 0, minor: 0 } as const;

/** Where a creature's caption sits, in screen pixels from the creature: half its width, and its band above. */
const CAPTION_HALF = 150, CAPTION_LOW = 14, CAPTION_HIGH = 110;
import { approach } from './motion';

const INK = 0x24362e;
const INK_SOFT = 0x4f6157;
const RUST = 0x9c5a3c;
/** Lettering ink: the notebook's green-black, a touch softer than the marks. */
const INK_LETTER = 0x2f4238;
const IVORY = 0xf6f1e4;
const FONT = "'Cormorant Garamond', 'Iowan Old Style', Palatino, Georgia, serif";
/** Names are drawn at twice their screen size and scaled down, so they stay crisp. */
const FONT_PX = 32;
/** On-screen size of a name: settlements are lettered large and spaced, like a cartographer's towns. */
const NAME_PX = { settlement: 27, place: 19, minor: 16 } as const;
const STATES = ['open', 'closed', 'special'] as const;
const KINDS = ['settlement', 'place', 'minor'] as const;
/** Seconds between layouts of the names; figures move, so names are rechecked often. */
const LAYOUT_EVERY = 1;

interface PlaceView {
  place: ScenePlace;
  /** Where the layout set a settlement's name (its left edge), before it is kept inside the screen. */
  laidLeft?: number;
  mark: Graphics;
  halo: Graphics;
  settle: Graphics;
  /** Whether the halo and the settling ring have anything in them, so an empty one is not cleared every frame. */
  haloDrawn: boolean;
  settleDrawn: boolean;
  name: Text;
  /** What the mark was last drawn for. */
  drawn: number;
  labelAlpha: number;
  slot: number;
  hover: number;
  press: number;
  /** Seconds since this place was selected or inspected; drives the settling ring. */
  selectedFor: number;
  wasSelected: boolean;
  seen: number;
  gone: number;
  nightStyle: boolean;
  /** On-screen size of the name, px. */
  size: number;
  underFigure: number;
  /** Gives way to a creature's caption written over the name. */
  underCaption: number;
}

export class Places {
  private readonly views = new Map<string, PlaceView>();
  private readonly items: LabelItem[] = [];
  private readonly list: PlaceView[] = [];
  private readonly order: number[] = [];
  private readonly placed: Box[] = [];
  private readonly prefer: number[] = [];
  private readonly obstacles: Box[] = [];
  private sinceLayout = 99;
  private layoutZoom = 0;
  private generation = 0;
  private hovered: string | null = null;
  private feet: readonly { x: number; y: number }[] = [];
  private creatures: readonly { x: number; y: number }[] = [];
  /** The interface's place-name toggle. */
  namesVisible = true;
  /** Called when a place becomes selected, so the layer can add a touch of life there. */
  onSelect: (place: ScenePlace) => void = () => {};

  constructor(private readonly ink: Container) {}

  setHover(id: string | null): void {
    this.hovered = id;
  }

  pressed(id: string): void {
    const view = this.views.get(id);
    if (view) view.press = 1;
  }

  /** `figures` are the drawn figures' feet, so names keep off them. */
  update(places: readonly ScenePlace[], figures: readonly { x: number; y: number }[], f: FrameInfo, creatures: readonly { x: number; y: number }[] = []): void {
    this.generation++;
    this.feet = figures;
    this.creatures = creatures;
    for (const place of places) {
      let view = this.views.get(place.id);
      if (!view) {
        view = this.make(place);
        this.views.set(place.id, view);
        this.sinceLayout = 99;
      }
      if (view.place.name !== place.name) view.name.text = place.kind === 'settlement' ? place.name.toUpperCase() : place.name;
      view.place = place;
      view.seen = this.generation;
      if (place.selected && !view.wasSelected) {
        view.selectedFor = 0;
        this.onSelect(place);
      }
      view.wasSelected = place.selected;
    }
    this.sinceLayout += f.dt || 0.016;
    if (this.sinceLayout > LAYOUT_EVERY || Math.abs(f.zoom - this.layoutZoom) > 0.00001) this.layout(figures, f);
    for (const [id, view] of this.views) {
      const present = view.seen === this.generation;
      view.gone = approach(view.gone, present ? 0 : 1, 3, f.dt);
      if (!present && view.gone > 0.99) {
        view.mark.destroy();
        view.halo.destroy();
        view.settle.destroy();
        view.name.destroy();
        this.views.delete(id);
        continue;
      }
      this.keepInView(view, f);
      this.draw(view, f);
    }
  }

  /**
   * A reach's name is lettered wide; on a narrow screen it would run off the
   * edge. Each frame it slides inward just enough to stay whole on screen, but
   * never so far that it no longer stands over its own mark.
   */
  private keepInView(view: PlaceView, f: FrameInfo): void {
    if (view.place.kind !== 'settlement' || view.laidLeft === undefined || view.slot < 0) return;
    const w = view.name.getLocalBounds().width * view.name.scale.x;
    // The frame's bounds carry a margin beyond the screen; the name keeps 12 pixels inside the screen itself.
    const pad = 12 / f.zoom, inset = VIEW_MARGIN / f.zoom;
    const mark = view.place.at.x;
    let x = Math.min(Math.max(view.laidLeft, f.left + inset + pad), f.right - inset - pad - w);
    x = Math.min(Math.max(x, mark - w + pad), mark - pad);
    if (Math.abs(view.name.x - x) > 0.01) view.name.x = x;
  }

  private make(place: ScenePlace): PlaceView {
    const mark = new Graphics();
    const halo = new Graphics();
    const settle = new Graphics();
    const settlement = place.kind === 'settlement';
    // Lettered on the map like the notebook's captions: settlements in spaced roman capitals,
    // places in a quiet italic, in ink on a soft wash of paper, so they read over grass, water and trees alike.
    const name = new Text({
      text: settlement ? place.name.toUpperCase() : place.name,
      style: {
        fontFamily: FONT,
        fontSize: FONT_PX,
        fontStyle: settlement ? 'normal' : 'italic',
        fontWeight: '600',
        fill: INK_LETTER,
        letterSpacing: settlement ? 9 : 0.6,
        stroke: { color: IVORY, width: 7, alpha: 0.5, join: 'round' },
        dropShadow: { color: IVORY, alpha: 1, blur: 9, distance: 0, angle: 0 },
      },
    });
    name.anchor.set(0, 0);
    name.alpha = 0;
    // Settling ring under the mark, mark over it, name on top.
    this.ink.addChild(settle, halo, mark, name);
    return { place, mark, halo, settle, haloDrawn: false, settleDrawn: false, name, drawn: -1, labelAlpha: 0, slot: settlement ? 3 : -1, hover: 0, press: 0, selectedFor: 99, wasSelected: false, seen: 0, gone: 0, nightStyle: false, size: NAME_PX[place.kind ?? 'place'], underFigure: 1, underCaption: 1 };
  }

  /** Re-chooses where every name goes. */
  private layout(figures: readonly { x: number; y: number }[], f: FrameInfo): void {
    this.sinceLayout = 0;
    this.layoutZoom = f.zoom;
    const gap = 9 / f.zoom;
    this.list.length = 0;
    let n = 0;
    for (const view of this.views.values()) {
      if (view.seen !== this.generation) continue;
      const p = view.place;
      const k = view.size / FONT_PX / f.zoom;
      let item = this.items[n];
      if (!item) {
        item = { x: 0, y: 0, w: 0, h: 0, priority: 0, wanted: false, slot: -1, left: 0, top: 0, fixed: false };
        this.items[n] = item;
      }
      item.x = p.at.x;
      item.y = p.at.y;
      // Text.width already includes the previous zoom compensation. Measuring
      // local bounds prevents that scale being applied again on every layout.
      item.w = view.name.getLocalBounds().width * k;
      item.h = FONT_PX * 1.05 * k;
      const hovered = this.hovered === p.id;
      item.priority = (p.selected ? 100 : 0) + (hovered ? 90 : 0) + (p.state === 'special' ? 20 : 0) + (p.lead ? 15 : 0) + (p.kind === 'minor' ? 0 : p.kind === 'settlement' ? 60 : 10) + (p.state === 'closed' ? -5 : 0);
      item.wanted = this.wantsName(p, hovered, f.zoom);
      // Settlements and named places keep one fixed spot (above and below their mark); only minor spots move to make room.
      item.fixed = p.kind !== 'minor';
      this.prefer[n] = view.slot;
      this.list.push(view);
      n++;
    }
    this.items.length = n;
    this.prefer.length = n;
    // Marks and figures are in the way of names.
    let o = 0;
    const box = (l: number, t: number, r: number, b: number): void => {
      let bx = this.obstacles[o];
      if (!bx) {
        bx = { left: 0, top: 0, right: 0, bottom: 0 };
        this.obstacles[o] = bx;
      }
      bx.left = l;
      bx.top = t;
      bx.right = r;
      bx.bottom = b;
      o++;
    };
    const m = 7 / f.zoom;
    for (const view of this.list) box(view.place.at.x - m, view.place.at.y - m, view.place.at.x + m, view.place.at.y + m);
    for (const fig of figures) box(fig.x - 14, fig.y - 62, fig.x + 14, fig.y + 4);
    // Fixed names go where they always go, and the minor ones keep clear of them. Where two
    // places sit close, the lesser name takes the next side of its mark that is clear of
    // the greater one's, so the two never print over each other.
    const at = { x: 0, y: 0 };
    const fixedFirst = this.items.map((_, i) => i).filter((i) => this.items[i]!.fixed).sort((a, b) => this.items[b]!.priority - this.items[a]!.priority);
    const marks = o;
    for (const i of fixedFirst) {
      const item = this.items[i]!;
      const home = FIXED_SLOT[this.list[i]!.place.kind ?? 'place'];
      item.slot = -1;
      if (!item.wanted) continue;
      for (const slot of [home, 1, 2, home === 3 ? 0 : 3]) {
        slotOrigin(item, slot, gap, at);
        let clear = true;
        for (let j = marks; clear && j < o; j++) {
          const other = this.obstacles[j]!;
          if (at.x < other.right && at.x + item.w > other.left && at.y < other.bottom && at.y + item.h > other.top) clear = false;
        }
        if (!clear) continue;
        item.slot = slot;
        break;
      }
      // Nowhere clear: it keeps its usual spot rather than vanish.
      if (item.slot < 0) item.slot = home;
      slotOrigin(item, item.slot, gap, at);
      item.left = at.x;
      item.top = at.y;
      box(at.x, at.y, at.x + item.w, at.y + item.h);
    }
    this.obstacles.length = o;
    layoutLabels(this.items, this.obstacles, gap, this.order, this.placed, this.prefer);
    for (let i = 0; i < n; i++) {
      const view = this.list[i]!;
      const item = this.items[i]!;
      if (item.fixed) {
        view.slot = item.slot;
        if (item.slot >= 0) {
          view.laidLeft = item.left;
          view.name.position.set(item.left, item.top);
          view.name.scale.set(view.size / FONT_PX / f.zoom);
        }
        continue;
      }
      if (item.slot < 0) {
        view.slot = -1;
        continue;
      }
      // A name that has to move fades out first, then reappears in its new place.
      if (view.slot !== item.slot && view.labelAlpha > 0.05) {
        view.slot = -2;
        continue;
      }
      view.slot = item.slot;
      view.name.position.set(item.left, item.top);
      view.name.scale.set(view.size / FONT_PX / f.zoom);
    }
  }

  private wantsName(p: ScenePlace, hovered: boolean, zoom: number): boolean {
    // A place only heard of has a faint mark and no name until someone goes there.
    if (p.rumour) return false;
    if (p.selected || hovered) return true;
    if (!this.namesVisible) return false;
    if (zoom < 0.3) return false;
    if (p.kind === 'settlement') return zoom > 0.22;
    if (p.kind === 'minor') return zoom > 0.7;
    return zoom > 0.36 || p.state === 'special' || p.lead;
  }

  private draw(view: PlaceView, f: FrameInfo): void {
    const p = view.place;
    const hovered = this.hovered === p.id;
    const px = 1 / f.zoom;
    view.hover = approach(view.hover, hovered ? 1 : 0, 12, f.dt);
    view.press = Math.max(0, view.press - f.dt * 1.6);
    view.selectedFor += f.dt;
    // What the mark shows, as one number, so an unchanged mark is not redrawn.
    const key = STATES.indexOf(p.state) * 16 + (p.lead ? 8 : 0) + (p.selected ? 4 : 0) + KINDS.indexOf(p.kind ?? 'place');
    if (key !== view.drawn) {
      view.drawn = key;
      this.drawMark(view.mark, p);
    }
    const fade = 1 - view.gone;
    const scale = px * (1 + view.hover * 0.18 + (p.selected ? 0.12 : 0) - view.press * 0.12);
    view.mark.position.set(p.at.x, p.at.y);
    view.mark.scale.set(scale);
    // A mark gives way to a friend standing on it.
    let under = 1;
    for (const foot of this.feet) if (Math.abs(foot.x - p.at.x) < 16 && Math.abs(foot.y - p.at.y) < 12) under = 0.3;
    view.underFigure = approach(view.underFigure, under, 6, f.dt);
    view.mark.alpha = fade * view.underFigure * (p.rumour ? 0.38 : p.state === 'closed' ? 0.62 : 0.9);
    view.mark.visible = f.zoom > 0.22 || p.selected;

    // A press sends out a ripple of ink.
    if (view.haloDrawn) view.halo.clear();
    view.haloDrawn = view.press > 0;
    if (view.press > 0) {
      view.halo.position.set(p.at.x, p.at.y);
      view.halo.scale.set(px);
      if (view.press > 0) view.halo.circle(0, 0, 10 + (1 - view.press) * 26).stroke({ color: INK, width: 1.2, alpha: view.press * 0.7 });
    }

    // The settling ring: drawn in from wide to rest when a place is picked.
    if (view.settleDrawn) view.settle.clear();
    view.settleDrawn = p.selected;
    if (p.selected) {
      const s = Math.min(1, view.selectedFor / 0.7);
      const ease = 1 - (1 - s) ** 3;
      const r = 46 - 18 * ease;
      view.settle.position.set(p.at.x, p.at.y);
      view.settle.scale.set(px);
      view.settle.ellipse(0, -3, r * 1.55, r * .8).fill({ color: 0xe6d7a8, alpha: .10 * ease * fade });
      view.settle.ellipse(0, -3, r * 1.2, r * .62).fill({ color: 0xf4e7be, alpha: .18 * ease * fade });
      view.settle.ellipse(0, -3, r * .8, r * .42).fill({ color: 0xfff3d2, alpha: .25 * ease * fade });
    }

    // Name: dark ink by day, pale ink at night so it holds against the dark.
    const night = f.night > 0.55;
    if (night !== view.nightStyle) {
      view.nightStyle = night;
      view.name.style.fill = night ? 0xeadfc4 : INK_LETTER;
      view.name.style.stroke = { color: night ? 0x1c2638 : IVORY, width: 7, alpha: night ? 0.35 : 0.5, join: 'round' };
      view.name.style.dropShadow = { color: night ? 0x1c2638 : IVORY, alpha: night ? 0.7 : 1, blur: 9, distance: 0, angle: 0 };
    }
    const wanted = view.slot >= 0 ? (p.state === 'closed' ? 0.62 : 1) : 0;
    view.labelAlpha = approach(view.labelAlpha, wanted, view.slot >= 0 ? 6 : 10, f.dt);
    // A creature's pencil caption stands above it; a name under the caption steps back.
    let veiled = 1;
    const n = view.name, z = f.zoom;
    for (const c of this.creatures) {
      if (n.x < c.x + CAPTION_HALF / z && n.x + n.width > c.x - CAPTION_HALF / z && n.y < c.y - CAPTION_LOW / z && n.y + n.height > c.y - CAPTION_HIGH / z) veiled = 0.12;
    }
    view.underCaption = approach(view.underCaption, veiled, 6, f.dt);
    view.name.alpha = view.labelAlpha * fade * view.underCaption;
    view.name.visible = view.name.alpha > 0.01;
    if (view.slot === -2 && view.labelAlpha < 0.05) {
      view.slot = -1;
      this.sinceLayout = 99;
    }
    if (p.selected) view.name.alpha = Math.min(1, view.name.alpha * (1 + view.hover * 0.1));
  }

  /** The mark at screen scale (the view scales it by 1/zoom). */
  private drawMark(g: Graphics, p: ScenePlace): void {
    g.clear();
    const r = p.kind === 'minor' ? 3.4 : p.kind === 'settlement' ? 4 : 5;
    if (p.selected) g.circle(0, 0, r + 3.2).fill({ color: IVORY, alpha: 0.75 });
    else g.circle(0, 0, r + 2).fill({ color: IVORY, alpha: 0.42 });
    if (p.state === 'closed') {
      // A broken ring: clearly there, gently unavailable.
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.3;
        g.arc(0, 0, r, a, a + 0.9).stroke({ color: INK_SOFT, width: 1.2, alpha: 0.9 });
      }
      g.moveTo(-r * 0.55, r * 0.55).lineTo(r * 0.55, -r * 0.55).stroke({ color: INK_SOFT, width: 1, alpha: 0.75 });
    } else {
      g.circle(0, 0, r).stroke({ color: p.state === 'special' ? RUST : INK, width: p.selected ? 1.8 : 1.35 });
      g.circle(0, 0, p.kind === 'minor' ? 1 : 1.4).fill({ color: p.state === 'special' ? RUST : INK });
      // Special places are inviting: a second, finer ring in rust ink.
      if (p.state === 'special') g.circle(0, 0, r + 3.4).stroke({ color: RUST, width: 0.8, alpha: 0.7 });
    }
    if (p.state === 'special') {
      // A small four-pointed star above and to the right: something is happening here.
      const sx = r + 4;
      const sy = -r - 3;
      g.moveTo(sx, sy - 3.6).quadraticCurveTo(sx, sy, sx + 3.6, sy).quadraticCurveTo(sx, sy, sx, sy + 3.6).quadraticCurveTo(sx, sy, sx - 3.6, sy).quadraticCurveTo(sx, sy, sx, sy - 3.6).fill({ color: RUST, alpha: 0.9 });
    }
    if (p.lead) {
      // A leaf-shaped mark beside the ring.
      const lx = -r - 7;
      const ly = -r - 1;
      g.moveTo(lx - 4, ly + 3).quadraticCurveTo(lx - 3, ly - 4, lx + 4, ly - 4).quadraticCurveTo(lx + 3, ly + 3, lx - 4, ly + 3).fill({ color: 0x5f7a37, alpha: 0.95 });
      g.moveTo(lx - 4, ly + 3).lineTo(lx + 2, ly - 2.5).stroke({ color: IVORY, width: 0.7, alpha: 0.8 });
    }
  }

  /** The place under a world point: its mark (generously) or its name. */
  pick(x: number, y: number, zoom: number): string | null {
    let best: string | null = null;
    let bestD = Infinity;
    const reach = 24 / zoom;
    for (const view of this.views.values()) {
      if (view.gone > 0.5) continue;
      const p = view.place;
      const d = Math.hypot(x - p.at.x, y - p.at.y);
      if (d < reach && d < bestD) {
        best = p.id;
        bestD = d;
      }
      const n = view.name;
      if (n.visible && n.alpha > 0.3 && x > n.x - 4 / zoom && x < n.x + n.width + 4 / zoom && y > n.y - 4 / zoom && y < n.y + n.height + 4 / zoom && bestD > 0) {
        if (best === null) {
          best = p.id;
          bestD = reach;
        }
      }
    }
    return best;
  }
}

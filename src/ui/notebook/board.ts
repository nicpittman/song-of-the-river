/**
 * The map board: the river drawn from `view.chart`, one section per region
 * that has been reached, with places as small ink marks, planned friends as
 * tokens on their places with a thin trail from camp, and the unknown south
 * dissolving into paper mist.
 *
 * Used twice: in the planning leaf (`leaf` mode) and on the river-map spread
 * (`atlas` mode, which also shows how well each place is known). A newly
 * reached region inks itself in the first time it is seen: the paper unrolls
 * downstream and its river and places are drawn in (see `inkIn`).
 *
 * Marks and tokens are real buttons positioned in percentages over the drawing,
 * so the board reads the same at any width. Names are placed in pixels once
 * the board has a size (and again whenever it changes), avoiding each other.
 */

import type { SecondStop, AdventureView, Chance, FriendView, PlaceView, StructureKind } from '../../game/adventure/model';
import type { Vec } from '../../game/core/math';
import { h, svgEl } from '../dom';
import { chartMarkup, type Slice } from './chart';
import { leadMark, placeMark } from '../sketches';
import { friendToken, reducedMotion, sketchEl } from './ink';
import { type Placement, type Rect, SOFT, placeLabels, textWidth } from './labels';
import { campPoint, mapPosition, reach } from './campPoint';
import { chapterGate } from './chapterGate';
import { planningPins, planRoutes } from './planRoutes';
import { routeInk } from './routeInk';
import { interestingPlaces } from './recommendations';
import { FACE_STEP, MAP_TOKEN_SIZE, type Obstacle, seatFaces, stackWidth } from './mapTokens';
import type { StopHint } from './stopHints';
import { PACE } from '../../game/adventure/travel';
import { DAY_SECONDS, DAYLIGHT_HOURS } from '../../game/adventure/calendar';
import '../../styles/map-reveal.css';
import '../../styles/face-stack.css';

export interface BoardOptions {
  mode: 'leaf' | 'atlas';
  selectedPlace: string | null;
  selectedSecond?: SecondStop;
  /** A stop on the way being chosen for a moving friend, drawn before it is set. */
  detourPreview?: { person: string; stop: SecondStop } | null;
  pickingSecond?: boolean;
  stopHints?: ReadonlyMap<string, readonly StopHint[]>;
  selectedPerson: string | null;
  editingPerson?: string | null;
  selectedLodging?: number | string | null;
  /** Where the group's fire is, in board units; null hides the camp mark. */
  camp: Vec | null;
  /** In the atlas: a region to ink in as it is shown, even on the first render (see `inkIn`). */
  unfold: number | null;
  /** Places that opened overnight (drawn to the eye) and leads on their last day. */
  opened: string[];
  expiring: string[];
  /**
   * With a friend picked up: their chance at each place, as small pips under
   * its mark, so two places can be weighed at a glance.
   */
  chances?: Map<string, { chance: Chance; pips: number }>;
  /** A place that quietly invites the next tap (the first morning only). */
  invite?: string | null;
}

export interface BoardHandlers {
  /** A place was tapped or clicked; `pointer` says how ('mouse', 'touch', 'pen', or '' for the keyboard). */
  place(id: string, pointer: string): void;
  /** The mouse came over a place, or left it (null). */
  hover?(id: string | null): void;
  /** A planned (leaf) or out (atlas) friend's token was tapped. */
  token(friend: string): void;
  stop?(hint: StopHint): void;
  /** The region mostly in view changed while scrolling. */
  region?(index: number): void;
  project?(kind: StructureKind): void;
  lodging?(id: number | string): void;
}

/** How tall the strip of mist below the last known region is, in pixels. */
const MIST_HEIGHT = 150;
const drawings = new WeakMap<AdventureView['chart'], Map<string, string>>();
function drawing(chart: AdventureView['chart'], slice: Slice): string {
  let cache = drawings.get(chart);
  if (!cache) { cache = new Map(); drawings.set(chart, cache); }
  const key = `${slice.top}:${slice.bottom}`;
  let markup = cache.get(key);
  if (markup === undefined) { markup = chartMarkup(chart, slice); cache.set(key, markup); }
  return markup;
}
/** Cartographer's lettering: settlements large and spaced, places plain, minor spots small and italic. */
const LETTERING: Record<PlaceView['kind'], { font: string; height: number; spacing: number; upper: boolean }> = {
  settlement: { font: '600 17px "Cormorant Garamond"', height: 21, spacing: 0.24, upper: true },
  place: { font: '500 14.5px "Cormorant Garamond"', height: 18, spacing: 0, upper: false },
  minor: { font: 'italic 500 13px "Cormorant Garamond"', height: 16, spacing: 0, upper: false },
};
const LABEL_HEIGHT = 18;
/** The visible part of a mark, for keeping names off it. */
const MARK_BOX = 14;
const TOKEN_SIZE = 26;
/** Below this map width (a phone) friends at one place stack as a row of faces. */

/** Space between a place's mark and the slip beside it. */
const SLIP_GAP = 22;

interface MapToken { el: HTMLElement; at: Vec; owner: string; offset: number; name: string }

/** A stack of faces spread out for choosing one; collapsing restores the stack. */
interface FannedStack { stack: HTMLElement; faces: HTMLElement[]; collapse(focus: boolean): void }

interface Section {
  el: HTMLElement;
  slice: Slice;
  places: PlaceView[];
  marks: Map<string, HTMLButtonElement>;
  tokens: MapToken[];
  /** Overlapping stacks of faces at crowded places, rebuilt with each layout. */
  stacks?: HTMLElement[];
  occupied?: Obstacle[];
  /** Place names, with their place's position: kept clear of portraits only while a spot near the friend allows it. */
  names?: Array<Rect & { at: { x: number; y: number }; id: string; yields: boolean; placement: Placement; width: number }>;
  /** Ordinary names hidden so a lone face could stay beside its place (see seatFaces); shown again before each seating. */
  yielded?: string[];
}

/** The coastal reach, Kawagiri: its map opens closer than the others (one − step out from 2.1). */
const COASTAL_REGION = 2;
const COASTAL_ZOOM = 1.9;

export class Board {
  readonly el = h('div', 'nb-board');
  readonly scale = h('span', 'nb-map-scale', { title: 'About half an hour along a route at an ordinary walking pace. Bends, equipment and each companion’s pace affect the journey.' }, ['≈ ½h walk']);
  private readonly inner = h('div', 'nb-board-inner');
  private readonly trails = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  readonly zoomControls = h('nav', 'nb-map-zoom', { 'aria-label': 'Map zoom' });
  private zoom = 1;
  private zoomTouched = false;
  private coastalDetail = false;
  /** Kawagiri's first framing waits until the map is actually showing (a hidden page has no size to scroll). */
  private reachFramePending = false;
  private renderedChart: AdventureView['chart'] | null = null;
  private readonly landscapes = new Map<string, SVGSVGElement>();
  private readonly labelLayouts = new Map<string, ReturnType<typeof placeLabels>>();
  private sections: Section[] = [];
  private view: AdventureView | null = null;
  private options: BoardOptions | null = null;
  private lastWidth = 0;
  private currentRegion = -1;
  private opportunities = new Set<string>();
  /** How the last press began, so a click can tell a mouse from a finger. */
  private lastPointer = '';
  /** The slip shown beside a place, and which place. */
  private slip: { el: HTMLElement; place: string } | null = null;
  private fanned: FannedStack | null = null;
  /** The farthest region this map has drawn; a farther one inks itself in as it is first seen. */
  private inkedTo = -1;
  /** The game the map was last drawn for. */
  private inkMode: AdventureView['mode'] | null = null;
  /** A region inking itself in: from when it was first on screen (null until then). */
  private inking: { region: number; start: number | null } | null = null;
  /** The player has moved the map since the ink began: the map stops guiding the eye. */
  private inkScrollTaken = false;

  constructor(private readonly handlers: BoardHandlers) {
    this.trails.setAttribute('class', 'nb-trails');
    this.trails.setAttribute('aria-hidden', 'true');
    this.el.append(this.inner, this.scale);
    for (const [label, symbol, delta] of [['Zoom out', '−', -.2], ['Zoom in', '+', .2]] as const) {
      const button = h('button', 'nb-map-zoom-button', { type: 'button', 'aria-label': label }, [symbol]);
      button.addEventListener('click', () => { this.zoomTouched = true; this.setZoom(this.zoom + delta); });
      this.zoomControls.append(button);
    }
    this.paintZoom();
    new ResizeObserver(() => {
      const width = this.inner.clientWidth;
      if (width && width !== this.lastWidth) this.layout();
      if (this.reachFramePending && this.el.clientHeight) this.frameReach();
    }).observe(this.el);
    this.el.addEventListener('scroll', () => this.trackRegion(), { passive: true });
    for (const type of ['pointerdown', 'wheel', 'touchstart'] as const) this.el.addEventListener(type, () => (this.inkScrollTaken = true), { passive: true });
    this.el.addEventListener('pointerdown', (e) => (this.lastPointer = e.pointerType), { capture: true });
    this.el.addEventListener('keydown', () => (this.lastPointer = ''), { capture: true });
    this.listenForPans();
    this.listenForStacks();
  }

  /** A spread stack folds away again on a tap elsewhere, a chosen face, Escape, or focus leaving it. */
  private listenForStacks(): void {
    const within = (fan: FannedStack, target: EventTarget | null): boolean =>
      target instanceof Node && (fan.stack.contains(target) || fan.faces.some((face) => face.contains(target)));
    document.addEventListener('pointerdown', (e) => {
      if (this.fanned && !within(this.fanned, e.target)) this.fanned.collapse(false);
    }, { capture: true });
    this.el.addEventListener('click', (e) => {
      const fan = this.fanned;
      if (fan && fan.faces.some((face) => face.contains(e.target as Node))) fan.collapse(false);
    });
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.fanned) { e.stopPropagation(); this.fanned.collapse(true); }
    });
    this.el.addEventListener('focusout', (e) => {
      const fan = this.fanned;
      if (fan && e.relatedTarget && !within(fan, e.relatedTarget)) fan.collapse(false);
    });
  }

  private paintZoom(): void {
    const buttons = Array.from(this.zoomControls.children) as HTMLButtonElement[];
    buttons[0]!.disabled = this.zoom <= this.minZoom + 0.001;
    buttons[1]!.disabled = this.zoom >= 3;
  }

  /**
   * How far out the map may draw: the width of the page, or on a wide, short
   * board (a tablet's single page) a little less, so a reach's known places fit
   * its height together (see `frame`).
   */
  private minZoom = 1;

  private setZoom(value: number): void {
    const next = Math.max(this.minZoom, Math.min(3, Math.round(value * 100) / 100));
    if (next === this.zoom) return;
    const centreX = (this.el.scrollLeft + this.el.clientWidth / 2) / Math.max(1, this.inner.clientWidth);
    const centreY = (this.el.scrollTop + this.el.clientHeight / 2) / Math.max(1, this.inner.clientHeight);
    this.zoom = next;
    this.inner.style.width = `${next * 100}%`;
    this.layout();
    this.el.scrollLeft = centreX * this.inner.clientWidth - this.el.clientWidth / 2;
    this.el.scrollTop = centreY * this.inner.clientHeight - this.el.clientHeight / 2;
    this.paintZoom();
  }

  /**
   * The map moves under the hand: dragging its paper with a mouse pans it,
   * within the drawing's own edges. (Fingers pan it natively; the wheel scrolls.)
   */
  private listenForPans(): void {
    let pan: { x: number; y: number; top: number; left: number; id: number; moved: boolean } | null = null;
    this.el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      if ((e.target as Element).closest('button, .nb-slip')) return;
      pan = { x: e.clientX, y: e.clientY, top: this.el.scrollTop, left: this.el.scrollLeft, id: e.pointerId, moved: false };
    });
    window.addEventListener('pointermove', (e) => {
      if (!pan || e.pointerId !== pan.id) return;
      const dx = e.clientX - pan.x;
      const dy = e.clientY - pan.y;
      if (!pan.moved && Math.hypot(dx, dy) < 4) return;
      pan.moved = true;
      this.el.classList.add('is-panning');
      this.el.scrollTop = pan.top - dy;
      this.el.scrollLeft = pan.left - dx;
    });
    const end = (): void => {
      pan = null;
      this.el.classList.remove('is-panning');
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  /**
   * Lays a slip beside a place, never over it: to its right where there is
   * room, else to its left, held inside the drawing. Null takes it away.
   */
  showSlip(place: string | null, el: HTMLElement | null): void {
    this.slip?.el.remove();
    this.slip = null;
    if (!place || !el || !this.view) return;
    const section = this.sections.find((s) => s.places.some((p) => p.id === place));
    const at = this.view.places.find((p) => p.id === place)?.at;
    if (!section || !at) return;
    el.classList.add('nb-slip-on-board');
    section.el.append(el);
    this.slip = { el, place };
    this.placeSlip();
  }

  /** Re-places the slip (after a resize or a re-render). */
  private placeSlip(): void {
    const slip = this.slip;
    const view = this.view;
    if (!slip || !view) return;
    const section = this.sections.find((s) => s.places.some((p) => p.id === slip.place));
    const at = view.places.find((p) => p.id === slip.place)?.at;
    if (!section || !at) return;
    if (slip.el.parentElement !== section.el) section.el.append(slip.el);
    const width = this.inner.clientWidth;
    const scale = width / view.chart.width;
    const x = at.x * scale;
    const y = (at.y - section.slice.top) * scale;
    const w = slip.el.offsetWidth;
    const hgt = slip.el.offsetHeight;
    const height = section.el.offsetHeight;
    const gap = SLIP_GAP;
    let left = x + gap;
    if (left + w > width - 4) left = x - gap - w;
    left = Math.max(4, Math.min(left, width - w - 4));
    const top = Math.max(4, Math.min(y - hgt * 0.35, height - hgt - 4));
    slip.el.style.left = `${left.toFixed(0)}px`;
    slip.el.style.top = `${top.toFixed(0)}px`;
    // Bring the place and its slip into view together.
    const within = section.el.offsetTop + top;
    const view0 = this.el.scrollTop;
    const viewH = this.el.clientHeight;
    if (within < view0 + 4 || within + hgt > view0 + viewH - 4) {
      this.el.scrollTo({ top: Math.max(0, within - Math.max(8, (viewH - hgt) / 2)), behavior: 'smooth' });
    }
  }

  /** The place mark under a screen point, if any (for dropping a friend's token). */
  placeAt(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('.nb-place');
    if (!el || !this.el.contains(el)) return null;
    return el.dataset.k?.replace(/^place-/, '') ?? null;
  }

  /** Marks the place a dragged token would land on. */
  markDropTarget(place: string | null): void {
    this.el.querySelectorAll('.nb-place.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
    if (!place) return;
    this.el.querySelector(`.nb-place[data-k="place-${CSS.escape(place)}"]`)?.classList.add('is-drop-target');
  }

  /** Brings the settlement (or any point) to the middle of the view. */
  centreOn(at: Vec): void {
    this.reveal(at, false, 0.45, true);
  }

  /**
   * Frames a set of places together (home and what is known around it), names
   * and all, in the middle of the board. A wide, short board that cannot hold
   * them draws the map a little smaller first; anything that still will not
   * fit keeps `focus` (home and today's suggestions) in view instead.
   */
  frame(points: Vec[], focus: Vec[] = points): void {
    const view = this.view;
    if (!view || !points.length || !this.el.clientHeight) return;
    const box = (list: Vec[]) => {
      const px = list.map((at) => this.toBoardPx(at, this.inner.clientWidth / view.chart.width)).filter((p): p is { x: number; y: number } => !!p);
      if (!px.length) return null;
      // Names sit to the right of most marks, a portrait or two above.
      return { left: Math.min(...px.map((p) => p.x)) - 40, right: Math.max(...px.map((p) => p.x)) + 120, top: Math.min(...px.map((p) => p.y)) - 52, bottom: Math.max(...px.map((p) => p.y)) + 44 };
    };
    let all = box(points);
    if (!all) return;
    const width = this.el.clientWidth, height = this.el.clientHeight;
    if (!this.zoomTouched && view.region !== COASTAL_REGION && width >= 600 && all.bottom - all.top > height) {
      this.minZoom = Math.max(0.6, Math.min(1, this.zoom * height / (all.bottom - all.top)));
      if (this.minZoom < this.zoom) { this.zoom = this.minZoom; this.inner.style.width = `${(this.zoom * 100).toFixed(1)}%`; this.layout(); this.paintZoom(); }
      all = box(points)!;
    }
    // Across, only a map wider than its page can miss anything.
    const fits = (b: NonNullable<typeof all>): boolean => b.bottom - b.top <= height && (b.right - b.left <= width || this.inner.clientWidth <= width + 1);
    // As much of what is known as the page holds, never at the cost of `focus` (or, failing that, home: the first point).
    const near = box(focus);
    const keep = near && fits(near) ? near : box(points.slice(0, 1)) ?? all;
    const left = Math.min(keep.left, Math.max(keep.right - width, (all.left + all.right) / 2 - width / 2));
    const top = Math.min(keep.top, Math.max(keep.bottom - height, (all.top + all.bottom) / 2 - height / 2));
    this.el.scrollTo({ top: Math.max(0, top), left: Math.max(0, left), behavior: 'auto' });
  }

  /** Kawagiri's map: home and the places known in the reach, framed together a step further out than the close coastal default. */
  private frameReach(): void {
    const view = this.view;
    if (!view || view.region !== COASTAL_REGION) { this.reachFramePending = false; return; }
    if (!this.el.clientHeight) { this.reachFramePending = true; return; }
    this.reachFramePending = false;
    const home = campPoint(view) ?? view.places.find((place) => place.region === COASTAL_REGION && place.kind === 'settlement')?.at;
    if (!home) return;
    const known = view.places.filter((place) => place.region === COASTAL_REGION && !place.rumour).map((place) => place.at);
    this.frame([home, ...known], [home]);
  }

  render(view: AdventureView, options: BoardOptions): void {
    if (this.renderedChart !== view.chart) {
      this.renderedChart = view.chart;
      this.landscapes.clear();
      this.labelLayouts.clear();
      this.zoom = 1; this.minZoom = 1; this.zoomTouched = false; this.coastalDetail = false;
      this.inner.style.width = '100%';
    }
    const detail = view.region === COASTAL_REGION && !this.coastalDetail && !this.zoomTouched;
    if (detail) {
      this.coastalDetail = true; this.zoom = COASTAL_ZOOM; this.inner.style.width = `${COASTAL_ZOOM * 100}%`;
    }
    this.view = view;
    this.options = options;
    this.opportunities = view.phase === 'morning' ? interestingPlaces(view) : new Set();
    this.el.dataset.mode = options.mode;
    this.sections = [];
    this.slip?.el.remove();
    this.inner.replaceChildren();
    const { chart } = view;
    const last = reach(view);
    // A new game in the same book (a Journey, then Wander) starts its map afresh. Wander
    // opens the whole river at once, so nothing in it inks itself in.
    const freshGame = view.mode !== this.inkMode;
    if (freshGame) { this.inkMode = view.mode; this.inkedTo = -1; this.inking = null; }
    this.noteInking(last, view.mode === 'free' ? null : options.unfold);
    const inking = this.inkingNow();
    for (let i = 0; i <= last; i++) {
      const region = chart.regions[i];
      const section = this.buildSection(view, i, { top: region.top, bottom: region.bottom });
      if (inking && inking.region === i) this.inkIn(section, inking.elapsed);
      this.inner.append(section.el);
    }
    if (last < chart.regions.length - 1) {
      const mist = this.buildMist(view, last + 1);
      if (inking && inking.region === last) { mist.classList.add('is-inking-mist'); mist.style.setProperty('--ink-skip', `${-inking.elapsed}ms`); }
      this.inner.append(mist);
    }
    this.inner.append(this.trails);
    this.lastWidth = 0;
    this.layout();
    this.paintZoom();
    // A new game opens its map on the camp, not wherever the last game's map was left.
    if (freshGame && !detail) requestAnimationFrame(() => {
      const camp = view.places.find((place) => place.kind === 'settlement' && place.region === view.region);
      if (camp) this.centreOn(camp.at);
    });
    if (detail) requestAnimationFrame(() => this.frameReach());
  }

  /** Move existing portraits without rebuilding the map or disturbing its scroll. */
  updatePositions(view: AdventureView): void {
    this.view = view;
    let moved = false;
    const tokens = this.sections.flatMap((s) => s.tokens.map((t) => ({ section: s, token: t })));
    for (const { section, token } of tokens) {
      if (!token.owner.startsWith('at-')) continue;
      const friend = view.friends.find((f) => `at-${f.id}` === token.owner);
      if (!friend) continue;
      const at=mapPosition(view,friend);
      if (Math.abs(at.x-token.at.x) < 1 && Math.abs(at.y-token.at.y) < 1) continue;
      moved = true;
      const next = this.sections.find((s) => at.y >= s.slice.top && at.y < s.slice.bottom);
      if (!next) continue;
      if (next !== section) {
        section.tokens = section.tokens.filter((t) => t !== token); next.tokens.push(token); next.el.append(token.el);
      }
      token.at = at;
      token.el.style.left = pct(at.x, view.chart.width);
      token.el.style.top = pct(at.y - next.slice.top, next.slice.bottom - next.slice.top);
      token.el.setAttribute('aria-label', `${friend.name}: ${friend.statusLine}`);
    }
    if (moved) this.layoutTokens();
  }

  /** Scrolls the board so a region's top is at the top of the view. */
  scrollToRegion(index: number, smooth = true): void {
    const section = this.sections[index];
    if (!section) return;
    // Kawagiri opens framed on home and its known places, not on the reach's top edge (Shiobashi Bridge).
    if (index === COASTAL_REGION && this.coastalDetail && !this.zoomTouched) return this.frameReach();
    this.el.scrollTo({ top: section.el.offsetTop - 4, behavior: smooth ? 'smooth' : 'auto' });
  }

  /**
   * Brings a board point into view, if it is not comfortably visible: at
   * `fraction` of the way down (lower numbers when a card covers the foot).
   */
  reveal(at: Vec, smooth = true, fraction = 0.42, always = false): void {
    const gate=this.view ? chapterGate(this.view) : null;
    if(gate && at.y>this.view!.chart.regions[this.view!.region]!.bottom) at=gate.at;
    const section = this.sections.find((s) => at.y >= s.slice.top && at.y < s.slice.bottom);
    if (!section || !this.view) return;
    const y = section.el.offsetTop + (at.y - section.slice.top) * section.el.offsetHeight / (section.slice.bottom-section.slice.top);
    const x = at.x * this.inner.clientWidth / this.view.chart.width;
    const view = this.el.clientHeight;
    const horizontal = x > this.el.scrollLeft + 40 && x < this.el.scrollLeft + this.el.clientWidth - 40;
    if (!always && horizontal && y > this.el.scrollTop + 40 && y < this.el.scrollTop + view * Math.min(1, fraction * 2) - 30) return;
    this.el.scrollTo({ top: Math.max(0, y - view * fraction), left: Math.max(0, x - this.el.clientWidth / 2), behavior: smooth ? 'smooth' : 'auto' });
  }

  /** Focuses a place's mark (keyboard players arriving from elsewhere). */
  focusPlace(id: string): void {
    for (const s of this.sections) s.marks.get(id)?.focus({ preventScroll: true });
  }

  private buildSection(view: AdventureView, index: number, slice: Slice): Section {
    const { chart } = view;
    const options = this.options!;
    const region = chart.regions[index];
    const el = h('section', 'nb-section', { 'aria-label': region.name });
    el.dataset.region = String(index);
    el.style.aspectRatio = `${chart.width} / ${slice.bottom - slice.top}`;
    const landscapeKey = `${slice.top}:${slice.bottom}`;
    let landscape = this.landscapes.get(landscapeKey);
    if (!landscape) {
      el.innerHTML = `<svg class="nb-chart" viewBox="0 ${slice.top} ${chart.width} ${slice.bottom - slice.top}" preserveAspectRatio="none" aria-hidden="true">${drawing(chart, slice)}</svg>`;
      landscape = el.firstElementChild as SVGSVGElement;
      this.landscapes.set(landscapeKey, landscape);
    } else {
      // Only the pins change when a plan changes. Keep the painted river's
      // existing DOM rather than parsing all its paths on every selection.
      el.append(landscape);
    }
    el.append(h('div', 'nb-region-name', { 'aria-hidden': 'true' }, [h('span', 'nb-caps', null, [region.title])]));

    const section: Section = { el, slice, places: [], marks: new Map(), tokens: [] };
    const places = view.places.filter((p) => p.region === index).sort((a, b) => a.at.y - b.at.y);
    for (const place of places) {
      const mark = this.placeMark(view, place, options);
      mark.style.left = pct(place.at.x, chart.width);
      mark.style.top = pct(place.at.y - slice.top, slice.bottom - slice.top);
      el.append(mark);
      section.marks.set(place.id, mark);
      section.places.push(place);
      const hints = options.stopHints?.get(place.id);
      if (hints?.length) {
        const row = h('div', 'nb-stop-hints', { role: 'group', 'aria-label': `Possible stops at ${place.name}` });
        row.style.left = pct(place.at.x, chart.width);
        row.style.top = pct(place.at.y - slice.top, slice.bottom - slice.top);
        // One route note per pin; selecting a companion changes whose stops are offered.
        for (const hint of hints.slice(0, 1)) {
          const friend = view.friends.find(p => p.id === hint.person);
          if (!friend) continue;
          const label = `${friend.name} · Stop here on the way`;
          const arrow = svgEl('svg', { viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.35,
            'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'nb-stop-hint-arrow' });
          arrow.append(svgEl('path', { d: 'M3 16V11c0-4 10-1 10-5V3m-3 3 3-3 3 3' }), svgEl('circle', { cx: 3, cy: 17, r: 1 }));
          const stop = h('button', 'nb-stop-hint', { type: 'button', 'aria-label': `${label} · ${place.name}`, title: label }, [
            arrow,
            h('span', 'nb-stop-hint-label', { 'aria-hidden': 'true' }, [`${friend.name} · Stop here`]),
          ]);
          stop.dataset.k = `stop-${hint.person}-${place.id}`;
          stop.addEventListener('click', event => { event.stopPropagation(); this.handlers.stop?.(hint); });
          row.append(stop);
        }
        el.append(row);
      }
    }

    for (const project of view.structures.filter((s) => s.status === 'building' && s.at && s.region === index)) {
      const mark = h('button', 'nb-project-mark', { type: 'button', 'aria-label': `${project.name}: choose builders`, title: `${project.name} · choose builders` }, [sketchEl(project.sketch, 22)]);
      mark.style.left = pct(project.at!.x, chart.width);
      mark.style.top = pct(project.at!.y - slice.top, slice.bottom - slice.top);
      mark.dataset.k = `project-${project.id}`;
      mark.addEventListener('click', () => this.handlers.project?.(project.id));
      el.append(mark);
    }
    for (const site of (view.sites ?? []).filter((s) => s.kind !== 'shelter' && s.region === index)) {
      const mark = h('button', 'nb-project-mark is-built', { type: 'button', 'aria-label': `${site.name}: completed`, title: `${site.name} · completed` }, [sketchEl(`structure-${site.kind}`, 22)]);
      mark.style.left = pct(site.at.x, chart.width);
      mark.style.top = pct(site.at.y - slice.top, slice.bottom - slice.top);
      mark.dataset.k = `site-${site.id}`;
      mark.addEventListener('click', () => this.handlers.project?.(site.kind));
      el.append(mark);
    }
    for (const lodging of view.lodgings.filter((l) => typeof l.id === 'number' && l.region === index)) {
      const mark = h('button', 'nb-project-mark is-lodging', { type: 'button', 'aria-label': `${lodging.name}: choose an overnight base`, title: `${lodging.name} · stay overnight` }, [sketchEl('structure-shelter', 22)]);
      mark.style.left = pct(lodging.at.x, chart.width); mark.style.top = pct(lodging.at.y - slice.top, slice.bottom - slice.top);
      mark.dataset.k = `lodging-${lodging.id}`;
      mark.classList.toggle('is-selected', options.selectedLodging === lodging.id);
      mark.setAttribute('aria-pressed', String(options.selectedLodging === lodging.id));
      mark.addEventListener('click', () => this.handlers.lodging?.(lodging.id)); el.append(mark);
    }

    // Tokens: in the leaf, friends sit on the places they are planned for; in the atlas, friends who are out stand where they are.
    const offsets = new Map<string, number>();
    const addToken = (friend: FriendView, at: Vec, place: string, label: string): void => {
      if (at.y < slice.top || at.y >= slice.bottom) return;
      const anchor = `${at.x},${at.y}`;
      const n = offsets.get(anchor) ?? 0;
      offsets.set(anchor, n + 1);
      const token = h('button', 'nb-board-token', { type: 'button', 'aria-label': label });
      token.style.setProperty('--friend', friend.colour);
      token.dataset.k = `token-${friend.id}`;
      token.append(friendToken(friend, TOKEN_SIZE));
      token.style.left = pct(at.x, chart.width);
      token.style.top = pct(at.y - slice.top, slice.bottom - slice.top);
      token.style.setProperty('--n', String(n));
      token.style.setProperty('--pin-x', `${(n % 3) * 24 - 18}px`);
      token.style.setProperty('--pin-y', `${-40 - Math.floor(n / 3) * 28}px`);
      token.addEventListener('click', () => this.handlers.token(friend.id));
      el.append(token);
      section.tokens.push({ el: token, at, owner: place, offset: n, name: friend.name });
    };
    if (options.mode === 'leaf') {
      for (const pin of planningPins(view)) addToken(view.friends.find((friend) => friend.id === pin.person)!, pin.at, pin.owner, pin.label);
    } else for (const friend of view.friends) addToken(friend, mapPosition(view,friend), `at-${friend.id}`, `${friend.name}: ${friend.statusLine}`);

    this.sections.push(section);
    return section;
  }

  /** The paper mist below the last reached region: the river runs on a little way and fades out. */
  private buildMist(view: AdventureView, index: number): HTMLElement {
    const { chart } = view;
    const region = chart.regions[index];
    const el = h('section', 'nb-mist', { 'aria-label': 'Beyond the mist' });
    el.style.height = `${MIST_HEIGHT}px`;
    const span = (region.bottom - region.top) * 0.26;
    el.innerHTML =
      `<svg class="nb-chart" viewBox="0 ${region.top} ${chart.width} ${span}" preserveAspectRatio="none" aria-hidden="true">` +
      drawing(chart, { top: region.top, bottom: region.top + span }) +
      '</svg>' +
      '<div class="nb-mist-veil" aria-hidden="true"><svg viewBox="0 0 300 120" preserveAspectRatio="none">' +
      '<path d="M10 40c40-12 80 6 120-4s70-10 110 2" /><path d="M60 72c30-8 70 4 104-2s52-6 90 4"/><path d="M0 100c48-6 96 6 150-2s100-4 150 2"/></svg></div>';
    el.append(h('p', 'nb-mist-line', null, ['The river runs on into the mist.']));
    const gate = chapterGate(view);
    if (gate) {
      const at = { ...gate.at, y: region.top + span * .46 };
      // A regular settlement mark sits in the mist, on the route’s own bank.
      const destination = h('button', 'nb-place is-settlement is-journey-gate', {type:'button', 'aria-label':`Plan the journey to ${gate.name}`});
      destination.dataset.k = `place-${gate.id}`;
      destination.classList.toggle('is-selected',this.options?.selectedPlace===gate.id);
      destination.setAttribute('aria-pressed',String(this.options?.selectedPlace===gate.id));
      destination.style.left = pct(at.x, chart.width);
      destination.style.top = '46%';
      destination.innerHTML = '<span class="nb-place-ring"></span>' + placeMark('open', 18);
      destination.append(h('span','nb-gate-name',null,[gate.name]));
      destination.addEventListener('click',()=>this.handlers.place(gate.id,this.lastPointer));
      el.append(destination);
      const section: Section = {el, slice:{top:region.top,bottom:region.top+span}, places:[], marks:new Map([[gate.id,destination]]),tokens:[]};
      // Map coordinates use a fixed 150 world-unit gateway, independent of responsive mist height.
      section.slice.bottom = region.top + 150 / .46;
      this.sections.push(section);
      for (const [n,pin] of planningPins(view).filter(p=>p.owner===`journey-${gate.id}`).entries()) {
        const friend=view.friends.find(f=>f.id===pin.person)!;
        const token=h('button','nb-board-token',{type:'button','aria-label':pin.label},[friendToken(friend,TOKEN_SIZE)]);
        token.dataset.k=`token-${friend.id}`;
        token.style.left=pct(gate.at.x,chart.width); token.style.top='46%';
        token.style.setProperty('--friend',friend.colour); token.style.setProperty('--pin-x',`${(n%3)*24-18}px`); token.style.setProperty('--pin-y',`${-40-Math.floor(n/3)*28}px`);
        token.addEventListener('click',()=>this.handlers.token(friend.id)); el.append(token);
        section.tokens.push({el:token,at:gate.at,owner:pin.owner,offset:n,name:friend.name});
      }
      el.querySelector('.nb-mist-line')?.remove();
    }
    return el;
  }

  private placeMark(view: AdventureView, place: PlaceView, options: BoardOptions): HTMLButtonElement {
    const classes = ['nb-place', `is-${place.state}`, `is-${place.kind}`];
    if (place.rumour) classes.push('is-rumoured');
    if (place.lead) classes.push('has-lead');
    if (place.visits === 0 && place.kind !== 'settlement') classes.push('is-unvisited');
    if (place.visits > 0 && place.kind !== 'settlement') classes.push('is-visited');
    if (place.id === options.selectedPlace || place.id === options.selectedSecond?.place) classes.push('is-selected');
    if (options.pickingSecond && options.chances?.has(place.id)) classes.push('is-second-option');
    if (options.opened.includes(place.id)) classes.push('is-news');
    if (expiring(place, options)) classes.push('is-expiring');
    if (options.invite === place.id) classes.push('is-invited');
    if (view.plans.some((p) => p.place === place.id)) classes.push('is-planned');
    if (this.opportunities.has(place.id)) classes.push('is-opportunity');
    if (view.lodgings.some((l) => l.id === place.id)) classes.push('is-lodging');
    const state = place.state === 'closed' ? 'closed today' : place.state === 'special' ? 'special today' : 'open';
    const lastDay = expiring(place, options) ? ', its last day' : '';
    const odds = options.chances?.get(place.id);
    const chanceWords = odds ? `, ${odds.chance} for the person in hand` : '';
    const lead = place.lead ? `, a lead${lastDay}: ${place.lead}` : '';
    const fresh = options.opened.includes(place.id) ? ', open since last night' : '';
    const opportunity = this.opportunities.has(place.id) ? ', worth exploring' : '';
    const visited = place.home ? 'camp' : place.rumour ? 'not yet discovered' : place.visits > 0 ? 'visited' : 'not yet visited';
    const b = h('button', classes.join(' '), { type: 'button', 'aria-label': `${place.name}, ${visited}, ${state}${fresh}${lead}${chanceWords}${opportunity}`, title: `${place.name} · ${visited}${opportunity ? ' · worth exploring' : ''}` });
    b.dataset.k = `place-${place.id}`;
    b.setAttribute('aria-pressed', String(place.id === options.selectedPlace || place.id === options.selectedSecond?.place));
    const glyph = h('span', 'nb-place-mark', { 'aria-hidden': 'true' });
    glyph.innerHTML = markGlyph(place);
    const name = h('span', 'nb-place-name', { 'aria-hidden': 'true' }, mapNameLines(place).map(line => h('span', 'nb-map-name-line', null, [line])));
    b.append(glyph, name);
    b.append(knowledge(place));

    b.addEventListener('click', () => this.handlers.place(place.id, this.lastPointer));
    b.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') this.handlers.hover?.(place.id);
    });
    b.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this.handlers.hover?.(null);
    });
    return b;
  }

  // ── A newly reached region inks itself in ─────────────────────────────

  /**
   * The first render sets how far the map counts as drawn. A farther region
   * afterwards (or one the river-map spread asks to unfold) inks itself in the
   * first time it is on screen.
   */
  private noteInking(last: number, unfold: number | null): void {
    if (this.inkedTo < 0 && unfold === null) { this.inkedTo = last; return; }
    const region = unfold ?? (last > this.inkedTo ? last : null);
    this.inkedTo = Math.max(this.inkedTo, last);
    if (region !== null && this.inking?.region !== region) this.inking = { region, start: null };
  }

  /** The region still inking in, and how far through it is (ms), or null. */
  private inkingNow(): { region: number; elapsed: number } | null {
    const inking = this.inking;
    if (!inking) return null;
    const elapsed = inking.start === null ? 0 : performance.now() - inking.start;
    if (elapsed >= INK_MS) { this.inking = null; return null; }
    return { region: inking.region, elapsed };
  }

  /**
   * Dresses a section to ink itself in: the paper unrolls downstream, the
   * river's banks come first and its wash after, then each place is set down
   * in the order the paper reaches it and its name is written, and last the
   * group's pins at the new camp. A re-render part-way picks up where the
   * ink had got to (`--ink-skip`). Reduced motion: one short crossfade.
   */
  private inkIn(section: Section, elapsed: number): void {
    const el = section.el;
    el.classList.add('is-inking');
    if (reducedMotion(this.el)) el.classList.add('is-inking-quiet');
    el.style.setProperty('--ink-skip', `${-elapsed}ms`);
    const span = section.slice.bottom - section.slice.top;
    for (const place of section.places) {
      section.marks.get(place.id)?.style.setProperty('--ink-y', ((place.at.y - section.slice.top) / span).toFixed(3));
    }
  }

  /** The first time an inking region is on screen: start its clock and lead the eye down to it. */
  private startInking(): void {
    const inking = this.inking;
    if (!inking || inking.start !== null || !this.el.offsetParent) return;
    inking.start = performance.now();
    this.inkScrollTaken = false;
    const region = inking.region;
    // After the page's own framing has settled: the join with the old reach, then down to the new home as it inks in.
    window.setTimeout(() => {
      const section = this.sections[region];
      if (!section || this.inkScrollTaken) return;
      const smooth = !reducedMotion(this.el);
      this.el.scrollTo({ top: Math.max(0, section.el.offsetTop - this.el.clientHeight * 0.3), behavior: 'auto' });
      window.setTimeout(() => {
        const home = section.places.find((p) => p.kind === 'settlement');
        if (home && !this.inkScrollTaken) this.reveal(home.at, smooth, 0.4, true);
      }, smooth ? 650 : 0);
    }, 90);
  }

  /** Places names and draws trails now that the board has a size. */
  private layout(): void {
    const view = this.view;
    const width = this.inner.clientWidth;
    if (!view || !width) return;
    this.startInking();
    this.lastWidth = width;
    const scale = width / view.chart.width;
    this.scale.style.width = `${(PACE * DAY_SECONDS / DAYLIGHT_HOURS / 2) * scale}px`;
    for (const section of this.sections) this.layoutSection(section, scale, width);
    this.drawTrails(scale, width);
    this.placeSlip();
  }

  private layoutSection(section: Section, scale: number, width: number): void {
    const height = (section.slice.bottom - section.slice.top) * scale;
    const toPx = (at: Vec): { x: number; y: number } => ({ x: at.x * scale, y: (at.y - section.slice.top) * scale });
    const obstacles: Array<Rect & { owner: string }> = [];
    // The region's name in the top-left corner.
    obstacles.push({ x: 0, y: 0, w: 170, h: 30, owner: '' });
    for (const place of section.places) {
      const p = toPx(place.at);
      const box = place.kind === 'settlement' ? MARK_BOX + 10 : MARK_BOX;
      obstacles.push({ x: p.x - box / 2, y: p.y - box / 2, w: box, h: box, owner: place.id });
    }
    // Built works, building sites and overnight shelters are marks too: names keep off them.
    for (const mark of section.el.querySelectorAll<HTMLElement>('.nb-project-mark')) {
      const x = Number.parseFloat(mark.style.left) * width / 100, y = Number.parseFloat(mark.style.top) * height / 100;
      obstacles.push({ x: x - 13, y: y - 13, w: 26, h: 26, owner: '' });
    }
    // Faces gather beside a place: names leave room for them just above it, so a portrait never has to sit on a word.
    const gathered = new Map<string, { x: number; y: number; n: number }>();
    for (const token of section.tokens) {
      if (token.at.y < section.slice.top || token.at.y >= section.slice.bottom) continue;
      const p = toPx(token.at), key = `${Math.round(p.x)},${Math.round(p.y)}`;
      const group = gathered.get(key) ?? { x: p.x, y: p.y, n: 0 };
      group.n++; gathered.set(key, group);
    }
    for (const group of gathered.values()) {
      // Three or more friends gather into one overlapping stack of faces: keep room for its real width.
      const stacked = group.n >= 3;
      const across = stacked ? stackWidth(Math.min(group.n, 5), false) + 2 : Math.min(group.n, 3) * (MAP_TOKEN_SIZE + 2), rows = stacked ? 1 : Math.ceil(group.n / 3);
      obstacles.push({ x: group.x - across / 2, y: group.y - 20 - rows * (MAP_TOKEN_SIZE + 2), w: across, h: rows * (MAP_TOKEN_SIZE + 2), owner: SOFT });
    }
    const requests = section.places.map((place) => {
      const p = toPx(place.at);
      const type = LETTERING[place.kind];
      const lines = mapNameLines(place).map(line => type.upper ? line.toUpperCase() : line);
      const width = Math.max(...lines.map(text => textWidth(text, type.font) + text.length * type.spacing * 17 + 4));
      return {
        id: place.id,
        x: p.x,
        y: p.y,
        width,
        height: type.height * lines.length,
        priority: labelPriority(place, this.view!, this.options!, this.opportunities),
        required: place.kind !== 'minor',
        always: place.kind === 'settlement',
        gap: place.kind === 'settlement' ? 20 : 17,
      };
    });
    const layoutKey = JSON.stringify([width, height, requests, obstacles]);
    let placed = this.labelLayouts.get(layoutKey);
    if (!placed) {
      placed = placeLabels(requests, obstacles, { width, height }, width < 480);
      if (this.labelLayouts.size >= 32) this.labelLayouts.clear();
      this.labelLayouts.set(layoutKey, placed);
    }
    for (const place of section.places) {
      const mark = section.marks.get(place.id);
      const name = mark?.querySelector<HTMLElement>('.nb-place-name');
      if (!mark || !name) continue;
      const at = placed.get(place.id) ?? null;
      applyPlacement(name, at, requests.find((r) => r.id === place.id)!.width);
      mark.classList.toggle('is-quiet', !at);
    }
    // Optional route notes choose space after place names, never over a pin or name.
    const hintRows = [...section.el.querySelectorAll<HTMLElement>('.nb-stop-hints')];
    const hintObstacles = [...obstacles];
    for (const request of requests) {
      const at = placed.get(request.id);
      if (at) hintObstacles.push({ x: request.x + at.dx, y: request.y + at.dy, w: request.width, h: request.height, owner: '' });
    }
    const hintRequests = hintRows.map((hint, i) => {
      hint.hidden = false;
      return { id: `stop-${i}`, x: Number.parseFloat(hint.style.left) * width / 100,
        y: Number.parseFloat(hint.style.top) * height / 100, width: hint.offsetWidth,
        height: hint.offsetHeight, priority: 0, gap: 23 };
    });
    const hintPlacements = placeLabels(hintRequests, hintObstacles, { width, height });
    hintRows.forEach((hint, i) => {
      const at = hintPlacements.get(`stop-${i}`);
      hint.hidden = !at;
      if (at) {
        hint.style.setProperty('--stop-x', `${at.dx}px`);
        hint.style.setProperty('--stop-y', `${at.dy}px`);
      }
    });
    // Keep the visible mark, selection ring and name clear. The place button
    // retains its larger hit area; its invisible padding need not push faces away.
    const occupied: Obstacle[] = [];
    for (const hint of hintRows) if (!hint.hidden) occupied.push(stopHintBox(hint, width, height));
    // The region's name: portraits keep off it as names do.
    const regionName = section.el.querySelector<HTMLElement>('.nb-region-name');
    if (regionName) occupied.push({ x: regionName.offsetLeft, y: regionName.offsetTop, w: regionName.offsetWidth || 170, h: regionName.offsetHeight || 30 });
    for (const mark of section.el.querySelectorAll<HTMLElement>('.nb-place, .nb-project-mark')) {
      const x=Number.parseFloat(mark.style.left)*width/100;
      const y=Number.parseFloat(mark.style.top)*(section.el.clientHeight || height)/100;
      const radius = mark.classList.contains('nb-project-mark') ? 22 : mark.classList.contains('is-settlement') ? 19 : 16;
      // The drawn mark itself, which even the most crowded portraits keep off (see mapTokenSeat).
      // (A place's mark with the little row of knowledge dots under it.)
      const ink = mark.classList.contains('nb-project-mark') ? 16 : mark.classList.contains('is-settlement') ? 12 : 8;
      const dots = mark.classList.contains('nb-project-mark') ? 0 : 6;
      occupied.push({x:x-radius,y:y-radius,w:radius*2,h:radius*2,core:{x:x-ink,y:y-ink,w:ink*2,h:ink*2+dots}});
      if (mark.querySelector('.nb-place-lead, .nb-place-condition')) occupied.push({x:x+2,y:y-27,w:23,h:20});
      const gateName=mark.querySelector<HTMLElement>('.nb-gate-name');
      if(gateName) occupied.push({x:x+22,y:y-11,w:textWidth(gateName.textContent ?? '', '500 18px \"Cormorant Garamond\"'),h:22});
    }
    // Names are kept clear only while that keeps a portrait near its friend (see mapTokenSeat).
    const names: NonNullable<Section['names']> = [];
    for (const place of section.places) {
      const label=placed.get(place.id), request=requests.find(r=>r.id===place.id)!;
      // An ordinary name (not a settlement, nor chosen, planned, led to or otherwise of note) may give way to a lone face.
      if(label) names.push({x:request.x+label.dx,y:request.y+label.dy,w:request.width,h:request.height,at:{x:request.x,y:request.y},id:place.id,yields:place.kind!=='settlement'&&request.priority<100,placement:label,width:request.width});
    }
    section.occupied = occupied;
    section.names = names;
    this.placeTokens(section, scale, width);
  }

  private layoutTokens(): void {
    if (!this.view || !this.lastWidth) return;
    const scale = this.lastWidth / this.view.chart.width;
    for (const section of this.sections) this.placeTokens(section, scale, this.lastWidth);
  }

  private placeTokens(section: Section, scale: number, width: number): void {
    if (this.fanned && section.stacks?.includes(this.fanned.stack)) this.fanned = null;
    for (const stack of section.stacks ?? []) stack.remove();
    section.stacks = [];
    for (const id of section.yielded ?? []) {
      const name = section.names?.find((n) => n.id === id), mark = section.marks.get(id), el = mark?.querySelector<HTMLElement>('.nb-place-name');
      if (!name || !mark || !el) continue;
      applyPlacement(el, name.placement, name.width);
      mark.classList.remove('is-quiet');
    }
    section.yielded = [];
    const occupied: Obstacle[] = [...(section.occupied ?? [])];
    const names = section.names ?? [];
    const height = (section.slice.bottom - section.slice.top) * scale;
    // Mist sections use a fixed paper height rather than the world scale.
    const tokenHeight=section.el.clientHeight || height;
    const bounds = { width, height: tokenHeight };
    // Friends at the same place are seated together: apart, or as one stack of faces.
    const groups = new Map<string, { p: { x: number; y: number }; tokens: MapToken[] }>();
    for (const token of section.tokens) {
      const p={x:token.at.x*scale,y:(token.at.y-section.slice.top)/(section.slice.bottom-section.slice.top)*tokenHeight};
      const key = `${Math.round(p.x)},${Math.round(p.y)}`;
      const group = groups.get(key) ?? { p, tokens: [] };
      group.tokens.push(token); groups.set(key, group);
    }
    for (const { p, tokens } of groups.values()) {
      for (const token of tokens) unstack(token.el);
      // Faces never hide the name of the very place they are gathered at.
      const own = (n: { at: { x: number; y: number } }): boolean => Math.abs(n.at.x - p.x) < 2 && Math.abs(n.at.y - p.y) < 2;
      const seats = seatFaces(p, tokens.length, [...occupied, ...names.filter(own)], bounds, names.filter((n) => !own(n)));
      if (seats.kind === 'apart') {
        tokens.forEach((token, i) => {
          const seat = seats.seats[i] ?? null;
          token.el.hidden = !seat;
          if (!seat) return;
          setPin(token.el, seat.x - p.x, seat.y - p.y);
          occupied.push(seat);
        });
        continue;
      }
      occupied.push(seats.box);
      // A lone face's chip is drawn past its corner: later portraits keep off it too.
      if (seats.chip && seats.shown < tokens.length) occupied.push(seats.chip);
      // An ordinary name the lone face had to sit on goes quiet, as crowded ordinary names do on a narrow map.
      for (const hidden of seats.hides ?? []) {
        const name = names.find((n) => n === hidden), mark = name && section.marks.get(name.id), el = mark?.querySelector<HTMLElement>('.nb-place-name');
        if (!name || !mark || !el) continue;
        applyPlacement(el, null, name.width);
        mark.classList.add('is-quiet');
        section.yielded.push(name.id);
      }
      const stack = this.buildStack(section, p, tokens, seats.box, seats.shown, bounds);
      stack.classList.toggle('chip-left', !!seats.corner?.endsWith('left'));
      stack.classList.toggle('chip-top', !!seats.corner?.startsWith('top'));
      stack.classList.toggle('chip-tucked', !!seats.tucked);
      section.stacks.push(stack);
    }
  }

  /**
   * Several friends at one place: their faces overlap like a fanned hand, the
   * first on top. Tapping the stack spreads the faces out over the map, on a
   * little paper, so each friend can be chosen; with no room even for that,
   * one face and a "+N" chip stand for them all.
   */
  private buildStack(section: Section, p: { x: number; y: number }, tokens: MapToken[], box: Rect, shown: number, bounds: { width: number; height: number }): HTMLElement {
    const count = tokens.length;
    const who = tokens.map((t) => t.name).join(', ');
    const stack = h('button', 'nb-face-stack', { type: 'button', 'aria-expanded': 'false', 'aria-label': `${who}: show each companion` });
    stack.title = who;
    stack.style.left = tokens[0]!.el.style.left;
    stack.style.top = tokens[0]!.el.style.top;
    if (shown < count) stack.append(h('span', 'nb-face-chip', { 'aria-hidden': 'true' }, [`+${count - shown}`]));
    stack.classList.toggle('is-single', shown === 1);
    section.el.append(stack);
    const fold = (): void => {
      stack.classList.remove('is-fanned');
      stack.setAttribute('aria-expanded', 'false');
      setBox(stack, p, box);
      tokens.forEach((token, i) => {
        const el = token.el;
        el.hidden = false;
        el.classList.add('is-stacked');
        el.classList.remove('is-fanned');
        el.classList.toggle('is-tucked', i >= shown);
        el.tabIndex = -1;
        el.setAttribute('aria-hidden', 'true');
        el.style.zIndex = String(4 + Math.max(0, shown - i));
        setPin(el, box.x + Math.min(i, shown - 1) * FACE_STEP - p.x, box.y - p.y);
      });
    };
    const spread = (): void => {
      this.fanned?.collapse(false);
      const step = matchMedia('(pointer: coarse)').matches ? 44 : 36;
      const perRow = Math.max(1, Math.floor((bounds.width - 16 - MAP_TOKEN_SIZE) / step) + 1);
      const cols = Math.min(count, perRow), rows = Math.ceil(count / perRow);
      const w = (cols - 1) * step + MAP_TOKEN_SIZE, hgt = (rows - 1) * step + MAP_TOKEN_SIZE;
      const left = clamp(box.x + box.w / 2 - w / 2, 8, bounds.width - 8 - w);
      const top = clamp(box.y, 8, bounds.height - 8 - hgt);
      stack.classList.add('is-fanned');
      stack.setAttribute('aria-expanded', 'true');
      setBox(stack, p, { x: left - 6, y: top - 6, w: w + 12, h: hgt + 12 });
      tokens.forEach((token, i) => {
        const el = token.el;
        el.classList.add('is-fanned');
        el.classList.remove('is-tucked');
        el.tabIndex = 0;
        el.removeAttribute('aria-hidden');
        el.style.zIndex = '31';
        setPin(el, left + (i % perRow) * step - p.x, top + Math.floor(i / perRow) * step - p.y);
      });
      this.fanned = {
        stack, faces: tokens.map((t) => t.el),
        collapse: (focus) => { if (this.fanned?.stack === stack) this.fanned = null; fold(); if (focus) stack.focus(); },
      };
      if (this.lastPointer === '') tokens[0]!.el.focus();
    };
    stack.addEventListener('click', () => (this.fanned?.stack === stack ? this.fanned.collapse(true) : spread()));
    fold();
    return stack;
  }

  /** Thin trails from camp to each planned place, drawn over every section. */
  private drawTrails(scale: number, width: number): void {
    const view = this.view!;
    this.trails.setAttribute('width', String(width));
    this.trails.setAttribute('height', '0');
    this.trails.setAttribute('height', String(this.inner.scrollHeight));
    this.trails.replaceChildren();
    if (this.options?.mode !== 'leaf') return;
    const { selectedPerson, selectedPlace } = this.options;
    for (const plan of planRoutes(view, selectedPerson, selectedPlace, this.options.selectedSecond, this.options.editingPerson, this.options.detourPreview)) {
      const points = plan.points.map((p) => this.toBoardPx(p, scale)).filter((p): p is { x: number; y: number } => !!p);
      if (points.length < 2) continue;
      const ink = routeInk(points);
      const group = svgEl('g');
      group.style.setProperty('--friend', plan.colour);
      const title = svgEl('title'); title.textContent = `${plan.name} → ${plan.destination}${plan.provisional ? ' (preview)' : ''}`;
      const path = svgEl('path');
      path.setAttribute('d', ink.d);
      path.setAttribute('class', plan.provisional ? 'nb-trail is-provisional' : 'nb-trail');
      group.append(title, path);
      if (!plan.provisional) {
        const curve = ink.samples;
        const lengths = curve.slice(1).map((p, i) => Math.hypot(p.x - curve[i]!.x, p.y - curve[i]!.y));
        let remaining = lengths.reduce((sum, length) => sum + length, 0) * .65;
        for (let i = 0; i < lengths.length; i++) {
          const length = lengths[i]!;
          if (remaining > length) { remaining -= length; continue; }
          if (length < 1) continue;
          const a = curve[i]!, b = curve[i + 1]!, k = remaining / length;
          const arrow = svgEl('path', { d: 'M-4,-3 L0,0 L-4,3', class: 'nb-trail-arrow', transform: `translate(${a.x + (b.x - a.x) * k},${a.y + (b.y - a.y) * k}) rotate(${Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI})` });
          group.append(arrow); break;
        }
      }
      this.trails.append(group);
    }
  }

  private toBoardPx(at: Vec, scale: number): { x: number; y: number } | null {
    const section = this.sections.find((s) => at.y >= s.slice.top && at.y < s.slice.bottom);
    if (!section) return null;
    return { x: at.x * scale, y: section.el.offsetTop + (at.y - section.slice.top) * section.el.offsetHeight / (section.slice.bottom-section.slice.top) };
  }

  private trackRegion(): void {
    const mid = this.el.scrollTop + this.el.clientHeight * 0.4;
    let index = 0;
    this.sections.forEach((s, i) => {
      if (s.el.offsetTop <= mid) index = i;
    });
    if (index === this.currentRegion) return;
    this.currentRegion = index;
    this.handlers.region?.(index);
  }
}

function stopHintBox(hint: HTMLElement, width: number, height: number): Rect {
  const w = hint.offsetWidth, h = hint.offsetHeight;
  return {
    x: Number.parseFloat(hint.style.left) * width / 100 + (Number.parseFloat(hint.style.getPropertyValue('--stop-x')) || 0),
    y: Number.parseFloat(hint.style.top) * height / 100 + (Number.parseFloat(hint.style.getPropertyValue('--stop-y')) || 0),
    w, h,
  };
}

function pct(value: number, of: number): string {
  return `${((value / of) * 100).toFixed(3)}%`;
}

/** Selected first, then where friends are going, leads, special places, well-known places, open, closed. */
function labelPriority(place: PlaceView, view: AdventureView, options: BoardOptions, interesting: ReadonlySet<string> = new Set()): number {
  if (place.id === options.selectedPlace) return 1000;
  if (place.kind === 'settlement') return 900;
  let p = place.kind === 'minor' ? -200 : 0;
  if (options.opened.includes(place.id) || expiring(place, options)) p += 400;
  if (view.plans.some((plan) => plan.place === place.id)) p += 300;
  if (place.lead) p += 200;
  if (interesting.has(place.id)) p += 200;
  if (place.state === 'special') p += 120;
  if (place.state === 'open') p += 60;
  p += Math.min(place.visits, 5) * 10;
  // Ties break toward the top of the map, so reading order is stable.
  return p - place.at.y / 100000;
}

export function mapNameLines(place: Pick<PlaceView, 'region' | 'name'> & { rumour?: string | null }): string[] {
  const name = shownName(place);
  const split = name.lastIndexOf(' ');
  return place.region === 2 && name.length >= 13 && split > 0
    ? [name.slice(0, split), name.slice(split + 1)] : [name];
}

/** A place only heard of is lettered in faint italics with a dotted rule (see phone.css), so its name drops the question mark. */
export function shownName(place: { name: string; rumour?: string | null }): string {
  return place.rumour ? place.name.replace(/\s*\?$/, '') : place.name;
}

function applyPlacement(name: HTMLElement, at: Placement | null, width: number): void {
  // A quiet name, shown on hover or focus, sits to the right on a small paper chip.
  const placement = at ?? { side: 'right' as const, dx: 13, dy: -LABEL_HEIGHT / 2 };
  name.dataset.side = placement.side;
  name.style.width = `${Math.ceil(width)}px`;
  name.style.transform = `translate(${placement.dx.toFixed(1)}px, ${placement.dy.toFixed(1)}px)`;
}

/** The ink mark for a place: a ring for open, a tinted ring with rays for special, a struck rust ring for closed; a small pennant for a lead. */
function markGlyph(place: PlaceView): string {
  if (place.kind === 'settlement') {
    // A settlement: three small roofs in a ring.
    return (
      '<svg viewBox="0 0 26 26" width="26" height="26"><circle class="m-town" cx="13" cy="13" r="11.5"/>' +
      '<path class="m-roofs" d="M6.5 15.5 9.5 12.6 12.5 15.5M8 15.5v3h3v-3M13.5 13 16.6 10 19.6 13M15 13v3.4h3.2V13M10.6 9.6 12.8 7.6 15 9.6"/>' +
      '</svg><span class="nb-place-ring"></span>'
    );
  }
  const size = place.kind === 'minor' ? 18 : 22;
  const lead = place.lead ? `<span class="nb-place-lead">${leadMark(16)}</span>` : '';
  const visited = place.visits > 0;
  const visit = `<svg class="mark nb-visit-mark" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"${visited ? '' : ' stroke-dasharray="2 3"'}/>${visited ? '<path d="m7.5 12 3 3 6-7"/>' : ''}</svg>`;
  const condition = place.state === 'open' ? '' : `<span class="nb-place-condition">${placeMark(place.state, 13)}</span>`;
  return `<span class="nb-place-ring"></span>${visit}${condition}${lead}`;
}

/** Up to three small dots under a mark in the atlas: how much has been learned there. */
function knowledge(place: PlaceView): HTMLElement {
  const known = Math.min(3, place.learned.length);
  const el = h('span', 'nb-knowledge', { 'aria-hidden': 'true' });
  for (let i = 0; i < 3; i++) el.append(h('i', i < known ? 'is-on' : null));
  return el;
}

/** How long a newly reached region takes to ink itself in, in milliseconds (matches map-reveal.css). */
const INK_MS = 3000;
/** A lead on its last day: named so by the morning report, or with a day or less left. */
function expiring(place: PlaceView, options: BoardOptions): boolean {
  return options.expiring.includes(place.id) || (!!place.lead && place.leadDays !== null && place.leadDays <= 1);
}

const clamp = (v: number, low: number, high: number): number => Math.max(low, Math.min(high, v));

function setPin(el: HTMLElement, x: number, y: number): void {
  el.style.setProperty('--pin-x', `${x}px`);
  el.style.setProperty('--pin-y', `${y}px`);
}

/** Positions a stack's own button (its hit area, chip and, when spread, paper backing) over a box near its place. */
function setBox(el: HTMLElement, p: { x: number; y: number }, box: Rect): void {
  setPin(el, box.x - p.x, box.y - p.y);
  el.style.width = `${box.w}px`;
  el.style.height = `${box.h}px`;
}

/** A face that was part of a stack stands on its own again. */
function unstack(el: HTMLElement): void {
  el.classList.remove('is-stacked', 'is-fanned', 'is-tucked');
  el.removeAttribute('tabindex');
  el.removeAttribute('aria-hidden');
  el.style.zIndex = '';
}

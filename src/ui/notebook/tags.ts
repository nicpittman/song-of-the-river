/**
 * Paper tags pinned in the valley: what a friend is doing (beat), a fork in
 * their day (choice), a bundle set down by the fire (unpack), a creature
 * showing (sighting), a passing note, and the card of a place looked at
 * closely (place).
 *
 * `update` runs every frame with screen positions. A tag is built and measured
 * once; after that only its transform and opacity change. Tags rise in, hold,
 * and slip away toward the notebook tab. At most four show at once; where two
 * would overlap, the less important one is eased upward out of the way (the
 * nudge is smoothed, the anchor never is, so a tag never lags the valley).
 */

import type { AdventureCommand, AdventureView, FriendView, PlaceView, ScreenTag, TagView, UnpackItem } from '../../game/adventure/model';
import type { UiActions } from '../contract';
import { h } from '../dom';
import { portraitMarkup } from './portrait';
import { flourish } from './flourish';
import { caps, packKnot, reducedMotion, sketchEl, wordButton } from './ink';
import { placeFor } from './overnight';
import { type LearnedMemory, placeCardBody } from './placeCard';
import { supplyWords } from './words';
import { LEAD_TAG, shortLine } from '../../game/rendering/adventure/fireside';
import { arcPoint, CATCH_FLIGHT } from '../catchFlight';
import '../../styles/valley-tags.css';

const MAX_TAGS = 4;
/** How far the fireside column keeps from the fire, and how much it rides above it. */
/** Below this window height one tag fewer shows at a time. */
const SHORT_SCREEN = 780;
/** Length of the tail from the anchor to the bottom of a tag. */
const TAIL = 12;
/** Space kept between two tags. */
const GAP = 8;
/** Keep tags this far inside the window. */
const MARGIN = 10;
/** A creature's caption stands this far above it, clear of the pencil ring drawn round it. */
const RING = 24;
/** A little more room under a creature's caption, so the tag clears the creature. */
const PATCH = 6;
/** How long the last pencil strokes take before a sketch lifts into the book, in milliseconds. */
const SKETCH_SETTLE = 300;
/** A choice the game has not timed for us is assumed to wait this long. */
const DEFAULT_CHOICE_SECONDS = 8;

/** At or below this width a creature off the edge of the view gets a small pencil mark pointing to it. */
const PHONE = 760;
/** How far inside the safe frame an edge mark sits (its centre), and the extra room kept at the top and foot for the notebook's slips. */
const EDGE = 24;
const EDGE_TOP = 58;
const EDGE_FOOT = 92;

const PRIORITY: Record<TagView['kind'], number> = { place: 5, choice: 4, unpack: 3, sighting: 2, beat: 1, note: 0 };
/**
 * Which of two tags steps aside (fades for a moment) when they would still
 * touch on screen: a creature's caption gives way to words being read, since
 * the pencil ring still marks the creature; choices and place cards never do.
 */
const YIELD: Record<TagView['kind'], number> = { place: 5, choice: 4, unpack: 3, beat: 2, sighting: 1, note: 0 };
/** Half the width of a creature as it shows, round its anchor; no other tag covers it. */
const BODY = 24;

interface Live {
  tag: ScreenTag;
  el: HTMLElement;
  tail: HTMLElement;
  dot: HTMLElement;
  timer: HTMLElement | null;
  w: number;
  h: number;
  /** The smoothed nudge, added to the tag's natural position. */
  ox: number;
  oy: number;
  /** The longest `remaining` seen, so a choice's line can run down from full. */
  total: number;
  lastScale: number;
  /** The place tag's content key, to rebuild it when what is known changes. */
  key: string;
  /** For place cards: how many learned lines had been read when it opened. */
  seen: number;
  leaving: boolean;
  pinned?: { x: number; y: number };
  /** For a conversation: where its speaker stood on screen when the pin was last set, so the card travels with the view as it moves. */
  pinAt?: { x: number; y: number };
  /** Where it was drawn last frame, so neighbours keep their order rather than swapping through each other. */
  drawn?: { x: number; y: number };
}

export interface TagHandlers {
  command(c: AdventureCommand): void;
  /** "Send someone" on a place card in the morning. */
  sendTo(place: string): void;
  /** Where the notebook tab is, for tags to slip away toward. */
  tab(): { x: number; y: number } | null;
  /** Rectangles of the notebook's own slips on screen (day line, strip, tab, controls), which tags keep clear of. */
  reserved(): DOMRect[];
}

/** How often the reserved rectangles are measured again, in milliseconds. */
const RESERVED_MS = 250;

export class TagLayer {
  readonly el = h('div', 'nb-tags', { 'aria-live': 'polite' });
  private readonly live = new Map<string, Live>();
  private readonly measure = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entries => {
    for (const entry of entries) {
      const live = [...this.live.values()].find(card => card.el === entry.target);
      if (live) { live.w = live.el.offsetWidth; live.h = live.el.offsetHeight; }
    }
  });
  private view: AdventureView | null = null;
  private lastFrame = performance.now();
  /** The safe frame (notch, home indicator) tags keep inside, read from the layer's own padding. */
  private insets = { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN };
  private insetsStale = true;
  private reserved: DOMRect[] = [];
  private reservedAt = 0;
  /** The line about tomorrow, settled low over the fire before the book opens. */
  private lead: HTMLElement | null = null;
  private leadLayout: { key: string; w: number; h: number; top: number } | null = null;
  /** Sketches already sent flying into the book, by their caption's id. */
  private readonly flown = new Set<string>();
  /** Entries found, and the last rise in that count (for the tally the sketch brings). */
  private found = -1;
  private rose: { from: number; to: number; total: number; at: number } | null = null;
  /** Bundles by the fire on their way out, which the others wait below until they have gone. */
  private readonly leavingBundles = new Map<Live, Box>();
  /** Where the fireside column hangs from, and the top of the group round the fire, read once an evening (see `placeBundles`). */
  private fireFrame: { top: number; heads: number } | null = null;
  /** Pencil marks at the edge of a phone's view, each pointing to a creature showing out of sight. */
  private readonly edges = new Map<string, { el: HTMLElement; tag: ScreenTag }>();

  constructor(
    private readonly actions: UiActions,
    private readonly memory: LearnedMemory,
    private readonly handlers: TagHandlers,
  ) {
    window.addEventListener('resize', () => (this.insetsStale = true));
  }

  private readInsets(): void {
    const style = getComputedStyle(this.el);
    this.insets = {
      top: parseFloat(style.paddingTop) || MARGIN,
      right: parseFloat(style.paddingRight) || MARGIN,
      bottom: parseFloat(style.paddingBottom) || MARGIN,
      left: parseFloat(style.paddingLeft) || MARGIN,
    };
    this.insetsStale = false;
  }

  setView(view: AdventureView): void {
    this.view = view;
    const found = view.journal.filter((e) => e.found).length;
    if (this.found >= 0 && found > this.found) this.rose = { from: this.found, to: found, total: view.journal.length, at: performance.now() };
    this.found = found;
    for (const live of this.live.values()) {
      // A bundle whose tag arrived a moment before the evening's own snapshot is drawn again once its details are known.
      if (live.tag.kind === 'unpack' && live.key === 'pending' && !live.leaving && view.evening?.items.some((i) => i.id === live.tag.id)) {
        const inner = live.el.querySelector<HTMLElement>('.nb-tag-paper');
        if (inner) {
          inner.replaceChildren();
          live.el.classList.remove('is-find', 'is-lead', 'is-supplies', 'is-nothing');
          live.key = '';
          this.fill(live, inner);
          live.w = live.el.offsetWidth;
          live.h = live.el.offsetHeight;
        }
        continue;
      }
      // A pinned place card follows what is known about the place as it grows.
      if (live.tag.kind !== 'place' || live.leaving) continue;
      const place = view.places.find((p) => p.id === live.tag.id);
      if (place && placeKey(place, view) !== live.key) this.refill(live, place);
    }
  }

  /** The line about tomorrow: centred in the viewport, above the bottom controls. */
  private updateLead(tag: ScreenTag | null): void {
    if (!tag) {
      const old = this.lead;
      if (!old) return;
      this.lead = null; this.leadLayout = null;
      old.classList.add('is-leaving');
      window.setTimeout(() => old.remove(), 400);
      return;
    }
    if (!this.lead) {
      this.lead = h('p', 'nb-fire-lead', { role: 'status' }, [tag.text]);
      this.el.append(this.lead);
    } else if (this.lead.textContent !== tag.text) this.lead.textContent = tag.text;
    const el = this.lead;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const key = `${vw}:${vh}:${tag.text}`;
    if (this.leadLayout?.key !== key) {
      const w = el.offsetWidth, hgt = el.offsetHeight;
      // Under the group round the fire, read once where they sit, then held: it belongs to the screen, not the moving crowd.
      const floor = Math.min(vh - this.insets.bottom, ...this.reserved.filter((r) => r.top > vh / 2).map((r) => r.top)) - 18;
      const feet = tag.people?.length ? Math.max(...tag.people.map((p) => p.y + p.h)) + 14 : vh * .68;
      this.leadLayout = { key, w, h: hgt, top: Math.max(this.insets.top, Math.min(Math.max(feet, vh * .5), floor - hgt)) };
    }
    const { w, top: y } = this.leadLayout;
    const x = vw / 2 - w / 2;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }

  /** True while a place card is pinned (so a tap elsewhere or Escape can put it away). */
  hasPlaceCard(): boolean {
    for (const live of this.live.values()) if (live.tag.kind === 'place' && !live.leaving) return true;
    return false;
  }

  update(tags: ScreenTag[]): void {
    if (this.insetsStale) this.readInsets();
    const now = performance.now();
    if (now - this.reservedAt > RESERVED_MS) {
      this.reservedAt = now;
      this.reserved = this.handlers.reserved();
    }
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.updateLead(tags.find((t) => t.id === LEAD_TAG) ?? null);
    // An exchange is one card, even as its speaker and line change.
    tags = tags.filter((t) => t.id !== LEAD_TAG).map(tag => tag.id.startsWith('meeting-') ? { ...tag, id: tag.id.replace(/-\d+$/, '') } : tag);
    for (const tag of tags) {
      if (tag.kind !== 'sighting' || !tag.id.endsWith('-sketched') || this.flown.has(tag.id)) continue;
      this.flown.add(tag.id);
      if (!tag.visible || !tag.sketch) continue;
      const { sketch, x, y } = tag;
      // The ring closes and the hatching goes in first; then the drawing lifts away.
      if (reducedMotion(this.el)) this.fly(sketch, x, y);
      else window.setTimeout(() => this.fly(sketch, x, y), SKETCH_SETTLE);
    }
    const evening = tags.length>0 && tags.every(tag=>tag.kind==='unpack');
    if (!tags.some((tag) => tag.kind === 'unpack')) this.fireFrame = null;
    const limit=evening ? window.innerHeight<500?1:window.innerHeight<740?2:3 : window.innerHeight<SHORT_SCREEN?MAX_TAGS-1:MAX_TAGS;
    const shown = chooseShown(tags,limit);
    const ids = new Set(shown.map((t) => t.id));

    for (const [id, live] of this.live) {
      if (!ids.has(id) && !live.leaving)
        this.leave(
          live,
          !tags.some((t) => t.id === id && t.visible),
        );
    }
    const active: Live[] = [];
    for (const tag of shown) {
      let live = this.live.get(tag.id);
      if (!live || live.leaving) live = this.create(tag);
      const changedSpeech = tag.id.startsWith('meeting-') && (live.tag.text !== tag.text || live.tag.person !== tag.person);
      // One box per conversation: the next line is written into the same box, which glides from where it was toward the new speaker.
      const before = changedSpeech ? naturalBox(live, window.innerWidth, window.innerHeight, this.insets) : null;
      live.tag = tag;
      if (changedSpeech) {
        const inner = live.el.querySelector<HTMLElement>('.nb-tag-paper');
        if (inner) { inner.replaceChildren(); this.fill(live, inner); live.w = live.el.offsetWidth; live.h = live.el.offsetHeight; }
        const after = naturalBox(live, window.innerWidth, window.innerHeight, this.insets);
        live.ox += before!.x - after.x;
        live.oy += before!.y - after.y;
        // The card stays where it is as the next speaker takes up the line.
        if (live.pinAt) live.pinAt = { x: tag.x, y: tag.y };
      }
      active.push(live);
    }
    this.settleBundles(active);
    this.place(active, dt);
    this.pointOut(tags);
  }

  /**
   * On a phone, a creature showing beyond the edge of the view gets a quiet
   * pencil mark at that edge, pointing to it. Pressing it pans the view there
   * (it does not sketch: that still takes the creature itself).
   */
  private pointOut(tags: ScreenTag[]): void {
    const vw = window.innerWidth, vh = window.innerHeight;
    const away = vw <= PHONE ? tags.filter((t) => t.kind === 'sighting' && !t.visible && t.remaining > 0 && !t.id.endsWith('-sketched')) : [];
    const ids = new Set(away.map((t) => t.id));
    for (const [id, mark] of this.edges) {
      if (ids.has(id)) continue;
      this.edges.delete(id);
      mark.el.classList.add('is-gone');
      mark.el.onpointerdown = null;
      window.setTimeout(() => mark.el.remove(), reducedMotion(this.el) ? 0 : 260);
    }
    const left = this.insets.left + EDGE, right = vw - this.insets.right - EDGE;
    const top = this.insets.top + EDGE_TOP, bottom = vh - this.insets.bottom - EDGE_FOOT;
    const cx = (left + right) / 2, cy = (top + bottom) / 2;
    for (const tag of away) {
      let mark = this.edges.get(tag.id);
      if (!mark) {
        const el = h('div', 'nb-edge-mark', { role: 'button', tabindex: '0', 'aria-label': `Look: ${tag.text}` });
        el.innerHTML = EDGE_MARK;
        const created = { el, tag };
        const look = (event: Event): void => {
          event.preventDefault();
          event.stopPropagation();
          this.actions.cue('click');
          this.handlers.command({ type: 'look', point: created.tag.anchor });
        };
        el.onpointerdown = look;
        el.onkeydown = (event) => { if (event.key === 'Enter' || event.key === ' ') look(event); };
        this.el.append(el);
        mark = created;
        this.edges.set(tag.id, mark);
      }
      mark.tag = tag;
      // Where the line from the middle of the view to the creature leaves the frame.
      const dx = tag.x - cx, dy = tag.y - cy;
      const k = Math.min(dx ? (dx > 0 ? right - cx : left - cx) / dx : Infinity, dy ? (dy > 0 ? bottom - cy : top - cy) / dy : Infinity, 1);
      const x = cx + dx * k, y = cy + dy * k;
      mark.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${Math.atan2(dy, dx).toFixed(3)}rad)`;
    }
  }

  /**
   * By the fire every bundle keeps its short line (the column hangs clear
   * above the group, so there is room to read it); a name is written once.
   */
  private settleBundles(active: Live[]): void {
    const bundles = active.filter((l) => l.tag.kind === 'unpack');
    const order = this.view?.evening?.items.map((i) => i.id) ?? [];
    // A bundle from the same hands as the one above it keeps only the face.
    const sorted = [...bundles].sort((a, b) => setDown(order, a) - setDown(order, b));
    const repeats = new Set(sorted.filter((live, i) => i > 0 && !!live.tag.person && sorted[i - 1]!.tag.person === live.tag.person));
    for (const live of bundles) {
      const repeat = repeats.has(live);
      if (repeat === live.el.classList.contains('is-same-hands')) continue;
      live.el.classList.toggle('is-same-hands', repeat);
      live.w = live.el.offsetWidth;
      live.h = live.el.offsetHeight;
    }
  }

  /** Builds and measures a new tag, then lets it rise in. */
  private create(tag: ScreenTag): Live {
    const old = this.live.get(tag.id);
    if (old) old.el.remove();
    const el = h('div', `nb-tag is-${tag.kind}${tag.id.startsWith('meeting-') ? ' is-speech' : ''}`);
    const inner = h('div', 'nb-tag-paper');
    el.append(inner);
    const tail = h('div', 'nb-tag-tail', { 'aria-hidden': 'true' });
    // The pencil ring round a creature stands in for the dot.
    const dot = h('div', `nb-tag-dot${tag.kind === 'sighting' ? ' is-ringed' : ''}`, { 'aria-hidden': 'true' });
    const live: Live = {
      tag,
      el,
      tail,
      dot,
      timer: null,
      w: 0,
      h: 0,
      ox: 0,
      oy: 0,
      total: tag.remaining,
      lastScale: -1,
      key: '',
      seen: 0,
      leaving: false,
    };
    this.fill(live, inner);
    this.el.append(tail, dot, el);
    live.w = el.offsetWidth;
    live.h = el.offsetHeight;
    el.classList.add('is-rising');
    this.live.set(tag.id, live);
    this.measure?.observe(el);
    return live;
  }

  private fill(live: Live, inner: HTMLElement): void {
    const tag = live.tag;
    const view = this.view;
    const friend = view?.friends.find((f) => f.id === tag.person) ?? null;
    if (tag.kind === 'place') {
      const place = view?.places.find((p) => p.id === tag.id);
      if (place && view) {
        live.seen = this.memory.read(place);
        live.key = placeKey(place, view);
        inner.append(...this.placeContent(place, view, live.seen));
      }
      live.el.setAttribute('role', 'dialog');
      live.el.setAttribute('aria-label', place?.name ?? 'A place');
      return;
    }
    if (tag.kind === 'unpack') {
      const item = view?.evening?.items.find((i) => i.id === tag.id) ?? null;
      if (!item) live.key = 'pending';
      live.el.classList.add(`is-${tag.pack ?? item?.hint ?? 'plain'}`, `is-${item?.kind ?? 'find'}`);
      inner.append(bundle(tag, item, friend, view));
      // A rare bundle earns one small flourish as it is set down, and the story an ink swash under it; nothing else does.
      const hint = tag.pack ?? item?.hint;
      const art = inner.querySelector<HTMLElement>('.nb-sketch');
      if ((hint === 'rare' || hint === 'story') && art && !reducedMotion(this.el)) flourish(art);
      if (hint === 'story') inner.append(swash());
      return;
    }
    if (tag.kind === 'sighting') {
      this.fillSighting(live, inner);
      return;
    }
    // A small mark beside a caption: the thing itself, or who it is about. Place notes carry none.
    const mark = tag.kind === 'note' ? null : tag.person ? speakerFace(tag.person,30) : tag.sketch ? sketchEl(tag.sketch,22) : null;
    inner.append(h('div', 'nb-tag-row', null, [mark, h('p', 'nb-tag-text', null, [tag.text]), tag.pack ? packKnot(tag.pack) : null]));
    if (tag.kind === 'choice') {
      const choices = h('div', 'nb-tag-choices', { role: 'group', 'aria-label': tag.text });
      tag.choices.forEach((label, i) => {
        choices.append(
          wordButton(
            label,
            () => {
              this.actions.cue('click');
              this.handlers.command({ type: 'choose', tag: tag.id, choice: i });
            },
            'nb-tag-choice',
          ),
        );
      });
      const timer = h('div', 'nb-tag-time', { 'aria-hidden': 'true' });
      // Nothing is missed by watching: left alone, the friend decides by their own nature.
      const left = h('p', 'nb-tag-left', null, [`${friend?.name ?? 'They'} can decide.`]);
      inner.append(choices, left, timer);
      live.timer = timer;
      live.total = Math.max(tag.remaining, DEFAULT_CHOICE_SECONDS);
    }
  }

  /** A creature's caption: a paper tag with the creature's sketch once it is known, which pressing sketches. */
  private fillSighting(live: Live, inner: HTMLElement): void {
    const tag = live.tag;
    const sketched = tag.id.endsWith('-sketched');
    // The pencilled hint keeps together ("· tap to sketch"), so a narrow caption breaks before it rather than inside it.
    const words = tag.hint ? [`${tag.text} `, h('span', 'nb-tag-hint', null, [`· ${tag.hint}`])] : [tag.text];
    inner.append(h('div', 'nb-tag-row', null, [tag.sketch ? sketchEl(tag.sketch, 22) : null, h('p', 'nb-tag-text', null, words)]));
    if (sketched) {
      live.el.classList.add('is-sketched');
      return;
    }
    // The caption is the bigger target on a phone: pressing it sketches the creature too.
    // It acts on the press, not the click, because the caption moves with the creature.
    // A glint's caption looks at the small thing instead.
    const glint = tag.id.startsWith('glint-');
    const sketch = (event: Event): void => { event.preventDefault(); event.stopPropagation(); this.handlers.command(glint ? { type: 'notice', glint: tag.id } : { type: 'sketch', sighting: tag.id }); };
    live.el.setAttribute('role', 'button');
    live.el.tabIndex = 0;
    live.el.setAttribute('aria-label', glint ? `Look: ${tag.text}` : `Sketch: ${tag.text}`);
    live.el.onpointerdown = sketch;
    live.el.onkeydown = (event) => { if (event.key === 'Enter' || event.key === ' ') sketch(event); };
  }

  private placeContent(place: PlaceView, view: AdventureView, seen: number): HTMLElement[] {
    const close = wordButton('×', () => this.handlers.command({ type: 'inspect', place: null }), 'nb-tag-close');
    close.setAttribute('aria-label', 'Put the card away');
    const parts: HTMLElement[] = [close, ...placeCardBody(place, { seen })];
    if (view.phase === 'morning' && place.state !== 'closed') {
      parts.push(h('footer', 'nb-tag-actions', null, [wordButton('Send someone', () => this.handlers.sendTo(place.id), 'nb-tag-send')]));
    }
    return parts;
  }

  private refill(live: Live, place: PlaceView): void {
    const view = this.view!;
    const inner = live.el.querySelector<HTMLElement>('.nb-tag-paper');
    if (!inner) return;
    live.key = placeKey(place, view);
    inner.replaceChildren(...this.placeContent(place, view, live.seen));
    live.w = live.el.offsetWidth;
    live.h = live.el.offsetHeight;
  }

  /** Lets a tag go: toward the notebook tab when its moment is over, a quick fade when it only went off screen. */
  private leave(live: Live, offScreen: boolean): void {
    live.leaving = true;
    live.el.classList.remove('is-rising');
    if (live.tag.kind === 'place') {
      const place = this.view?.places.find((p) => p.id === live.tag.id);
      if (place) this.memory.markRead(place);
    }
    let remove = (): void => {
      this.measure?.unobserve(live.el);
      live.el.remove();
      live.tail.remove();
      live.dot.remove();
      if (this.live.get(live.tag.id) === live) this.live.delete(live.tag.id);
    };
    live.tail.style.opacity = '0';
    live.dot.style.opacity = '0';
    if (offScreen || reducedMotion(this.el) || live.tag.kind !== 'unpack') {
      live.el.style.transition = 'opacity 160ms ease-out';
      live.el.style.opacity = '0';
      window.setTimeout(remove, 180);
      return;
    }
    const from = live.el.style.transform;
    const position = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(from);
    const x = Number(position?.[1] ?? 0), y = Number(position?.[2] ?? 0);
    // The bundles below wait under it until it has gone, so two never cross.
    this.leavingBundles.set(live, { x, y, w: live.w, h: live.h });
    const gone = remove;
    remove = (): void => { this.leavingBundles.delete(live); gone(); };
    // The oldest note leaves upward in its own lane; it never flies across the banner.
    const animation = live.el.animate([
      {transform:from,opacity:1},
      {transform:`translate(${x}px, ${y-10}px)`,opacity:0},
    ],{duration:340,easing:'ease-out',fill:'forwards'});
    animation.onfinish = remove;
  }

  /**
   * The bundles by the fire: a column above the friends sitting round it,
   * read top to bottom like a quiet conversation. It hangs from its top, so a
   * new bundle fades in under the last and nothing already there moves; when
   * the oldest goes, the rest glide up together. None ever crosses another.
   */
  private placeBundles(active: Live[], dt: number): void {
    const vw = window.innerWidth, vh = window.innerHeight;
    const order = this.view?.evening?.items.map((item) => item.id) ?? [];
    const sorted = [...active].sort((a, b) => setDown(order, a) - setDown(order, b));
    // Heights arrive from ResizeObserver; no per-frame layout flush.
    // Below the season tab and the other slips at the top, and never down over the heads round the fire.
    // Both are read once, as the first bundle is set down, so the column never follows the crowd, the camera or a slip that grows for a moment.
    this.fireFrame ??= {
      top: Math.max(this.insets.top, ...this.reserved.filter((r) => r.bottom < vh / 2).map((r) => r.bottom + GAP + 4)),
      heads: Math.max(vh * .4, Math.min(...(sorted[0]?.tag.people ?? []).map((p) => p.y), vh * .68)),
    };
    const { top, heads } = this.fireFrame;
    // The column hangs from its top: a new bundle is set down under the last, and the ones above stay where they are.
    const boxes = fireColumn(sorted, vw / 2, top, vw, this.insets);
    // Only if the column would reach the heads does it lift, as one.
    const lowest = Math.max(...[...boxes.values()].map((b) => b.y + b.h));
    const lift = Math.min(Math.max(0, lowest - (heads - 16)), Math.max(0, top - this.insets.top));
    const k = 1 - Math.exp(-dt * 5);
    let floor = Math.max(-Infinity, ...[...this.leavingBundles.values()].map((b) => b.y + b.h + GAP));
    for (const live of sorted) {
      const box = boxes.get(live)!;
      box.y -= lift;
      if (!live.el.dataset.stacked) {
        // Set down where it will stay: it only fades in, a few pixels low, and settles.
        live.ox = box.x;
        live.oy = reducedMotion(this.el) ? box.y : box.y + 6;
        live.el.dataset.stacked = 'true';
        if (!reducedMotion(this.el)) live.el.classList.add('is-set-down');
      }
      live.ox = box.x;
      live.oy += (box.y - live.oy) * k;
      // Never over the one above it: a card on its way up waits below it.
      live.oy = Math.max(live.oy, floor);
      floor = live.oy + live.h + GAP;
      live.el.style.transform = `translate(${live.ox.toFixed(1)}px,${live.oy.toFixed(1)}px)`;
      // One lifted up under the season tab waits unseen until the oldest has gone.
      live.el.style.opacity = live.oy >= this.insets.top - 2 ? '1' : '0';
      live.tail.style.opacity = live.dot.style.opacity = '0';
    }
  }

  /**
   * A creature just sketched: its small ink drawing lifts from it and drifts
   * in a soft arc into the notebook, which takes it with a small bump while
   * the count ticks on. With reduced motion it only fades.
   */
  private fly(sketch: string, x: number, y: number): void {
    const host = this.el.parentElement ?? this.el;
    const target = this.handlers.tab();
    const ink = h('div', 'nb-catch-fly', { 'aria-hidden': 'true' }, [sketchEl(sketch, CATCH_FLIGHT.size)]);
    host.append(ink);
    const half = CATCH_FLIGHT.size / 2 + 7;
    const at = (p: { x: number; y: number }, scale: number, turn = 0): string => `translate(${(p.x - half).toFixed(1)}px, ${(p.y - half).toFixed(1)}px) rotate(${turn.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
    const start = { x, y: y - 14 };
    const done = (): void => { ink.remove(); this.arrive(!!target && !reducedMotion(this.el)); };
    if (!target || reducedMotion(this.el)) {
      const fade = ink.animate([{ transform: at(start, 1), opacity: 0 }, { transform: at(start, 1), opacity: 1, offset: .3 }, { transform: at(start, 1), opacity: 0 }], { duration: 900, easing: 'ease-in-out', fill: 'forwards' });
      fade.onfinish = done;
      return;
    }
    const frames: Keyframe[] = [{ transform: at(start, .85), opacity: 0, offset: 0 }];
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const p = arcPoint(start, target, f);
      frames.push({
        transform: at(p, 1 - .5 * f * f, -10 * Math.sin(f * Math.PI)),
        opacity: f > .92 ? 1 - (f - .92) / .08 * .6 : 1,
        offset: CATCH_FLIGHT.lift + (1 - CATCH_FLIGHT.lift) * f,
      });
    }
    const flight = ink.animate(frames, { duration: CATCH_FLIGHT.ms, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' });
    flight.onfinish = done;
  }

  /** The book takes the sketch: a small bump, and the count ticks on beside it. */
  private arrive(bump: boolean): void {
    const host = this.el.parentElement ?? this.el;
    const book = host.querySelector<HTMLElement>('.nb-tab .nb-tab-book');
    if (book && bump) book.animate([{ transform: 'none' }, { transform: 'translateY(-2px) rotate(-4deg) scale(1.1)', offset: .35 }, { transform: 'none' }], { duration: 360, easing: 'ease-out' });
    const rose = this.rose && performance.now() - this.rose.at < 5000 ? this.rose : null;
    this.rose = null;
    const tab = this.handlers.tab();
    if (!rose || !tab) return;
    const was = h('span', 'nb-catch-was', null, [String(rose.from)]);
    const now = h('span', 'nb-catch-now', null, [String(rose.to)]);
    const tally = h('div', `nb-catch-tally${bump ? '' : ' is-still'}`, { 'aria-hidden': 'true' }, [h('span', 'nb-catch-num', null, [was, now]), h('span', 'nb-catch-of', null, [` / ${rose.total}`])]);
    host.append(tally);
    const r = book?.getBoundingClientRect();
    // Clear of the bar the book sits in, and of the screen's edge, so it reads as its own small note.
    const bar = book?.closest<HTMLElement>('.nb-bar')?.getBoundingClientRect();
    const half = tally.offsetWidth / 2 + 14;
    tally.style.left = `${Math.round(Math.min(Math.max(r ? r.left + r.width / 2 : tab.x, half), window.innerWidth - half))}px`;
    tally.style.top = `${Math.round(bar ? bar.top - 8 : r ? r.top - 8 : tab.y - 22)}px`;
    window.setTimeout(() => tally.remove(), 2200);
  }

  /** Positions every shown tag: natural spot above its anchor, nudged apart, kept on screen. */
  private place(active: Live[], dt: number): void {
    const recap = active.filter(live => live.tag.kind === 'unpack');
    if (recap.length) {
      this.placeBundles(recap, dt);
      active = active.filter(live => live.tag.kind !== 'unpack');
      if (!active.length) return;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const safe = this.insets;
    // Target boxes in priority order: earlier ones hold their place, later ones move.
    // Each is kept on screen first, so the nudging below works on where tags will really be.
    const keepOnScreen = (b: { x: number; y: number; w: number; h: number }): void => {
      b.x = Math.min(Math.max(b.x, safe.left), vw - b.w - safe.right);
      b.y = Math.min(Math.max(b.y, safe.top), vh - b.h - safe.bottom);
    };
    // The creatures showing: no tag but a creature's own caption may cover one.
    const creatures: Obstacle[] = active.filter((live) => live.tag.kind === 'sighting' && !live.tag.id.endsWith('-sketched'))
      .map((live) => ({ x: live.tag.x - BODY, y: live.tag.y - BODY - 6, w: BODY * 2, h: BODY + 12, owner: live.tag.id }));
    const people = active[0]?.tag.people ?? [];
    for (const live of active) {
      if (!live.pinned || live.tag.kind === 'choice') continue;
      // A conversation's card keeps its place beside the speakers, not on the glass: as the view glides, it glides with them.
      if (live.pinAt) {
        live.pinned = { x: live.pinned.x + live.tag.x - live.pinAt.x, y: live.pinned.y + live.tag.y - live.pinAt.y };
        live.pinAt = { x: live.tag.x, y: live.tag.y };
      }
      // A line that has come to lie over a creature, or over the people talking, lets go and finds a place clear of them.
      const box = { ...live.pinned, w: live.w, h: live.h };
      if (creatures.some((c) => c.owner !== live.tag.id && overlaps(c, box)) || people.some((p) => overlaps(p, box))) live.pinned = live.pinAt = undefined;
    }
    const boxes = active.map(live => live.pinned ? { ...live.pinned, w: live.w, h: live.h } : naturalBox(live, vw, vh, safe));
    boxes.forEach(keepOnScreen);
    // The notebook's own slips count as tags already placed that never move, so tags never sit on them.
    const fixed: Obstacle[] = this.reserved.map((r) => ({ x: r.left, y: r.top, w: r.width, h: r.height }));
    fixed.push(...recap.filter(live => live.el.style.opacity !== '0').map(live => ({ x: live.ox, y: live.oy, w: live.w, h: live.h })));
    const controls = fixed.length;
    fixed.push(...people, ...creatures);
    const all: Obstacle[] = [...fixed, ...boxes];
    const mine = (o: Obstacle, live: Live): boolean => o.owner === live.tag.id;
    // Which of two tags was higher on screen last frame, so a pair keeps its order as their anchors drift past each other.
    const above = (b: Live, a: Live): boolean | null => b.drawn && a.drawn ? b.drawn.y + b.h / 2 < a.drawn.y + a.h / 2 : null;
    for (let pass = 0; pass < 4; pass++) {
      for (let i = fixed.length; i < all.length; i++) {
        const live = active[i - fixed.length]!;
        if (live.pinned) continue;
        for (let j = 0; j < i; j++) {
          const a = all[j];
          const b = all[i];
          if (mine(a, live)) continue;
          if (a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP) {
            // Move the less important tag up (or, off a slip, away from it), but never onto one of the notebook's slips.
            const up = a.y - GAP - b.h;
            const down = a.y + a.h + GAP;
            const other = j >= fixed.length ? active[j - fixed.length]! : null;
            const preferUp = (other ? above(live, other) : null) ?? (j >= controls || a.y + a.h / 2 > vh / 2);
            const clear = (y: number): boolean => y > safe.top && y + b.h < vh - safe.bottom && !fixed.some((r) => !mine(r, live) && overlaps(r, { ...b, y }));
            b.y = preferUp ? (clear(up) ? up : down) : clear(down) ? down : up;
            keepOnScreen(b);
          }
        }
      }
    }
    // Pinned decisions/exchanges never shuffle when a neighbour arrives.
    const pinned = active.flatMap((live, i) => live.pinned ? [boxes[i]!] : []);
    const loose = active.flatMap((live, i) => live.pinned ? [] : [{ box: boxes[i]!, order: live.drawn?.y ?? boxes[i]!.y, owner: live.tag.id }]);
    settleColumn(loose, [...fixed, ...pinned], vh, safe);
    const k = 1 - Math.exp(-dt * 14);
    const drawn = active.map((live, i) => {
      const tag = live.tag;
      const box = boxes[i];
      box.x = Math.min(Math.max(box.x, safe.left), vw - live.w - safe.right);
      box.y = Math.min(Math.max(box.y, safe.top), vh - live.h - safe.bottom);
      const natural = naturalBox(live, vw, vh, safe);
      if (tag.kind === 'choice' || tag.id?.startsWith('meeting-')) {
        live.pinned = { x: box.x, y: box.y };
        if (tag.kind !== 'choice') live.pinAt = { x: tag.x, y: tag.y };
        live.ox = box.x - natural.x; live.oy = box.y - natural.y;
      } else if (!live.drawn) {
        // A new tag starts where it will stay, rather than sliding out from under another.
        live.ox = box.x - natural.x; live.oy = box.y - natural.y;
      } else {
        live.ox += (box.x - natural.x - live.ox) * k;
        live.oy += (box.y - natural.y - live.oy) * k;
      }
      const x = Math.max(safe.left, Math.min(natural.x + live.ox, vw - live.w - safe.right));
      const y = Math.max(safe.top, Math.min(natural.y + live.oy, vh - live.h - safe.bottom));
      return { x, y, w: live.w, h: live.h, travel: Math.hypot(box.x - x, box.y - y) };
    });
    // Two tags still crossing on screen (one gliding past the other to its new side): one steps aside until they are clear.
    const yielding = new Set<number>();
    for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
      const a = drawn[i]!, b = drawn[j]!;
      if (!(a.x < b.x + b.w - 2 && b.x < a.x + a.w - 2 && a.y < b.y + b.h - 2 && b.y < a.y + a.h - 2)) continue;
      const firm = (n: number): boolean => YIELD[active[n]!.tag.kind] >= YIELD.choice || !!active[n]!.pinned;
      const ti = firm(i) ? -1 : drawn[i]!.travel, tj = firm(j) ? -1 : drawn[j]!.travel;
      // The one on its way somewhere gives way; otherwise the lesser kind.
      const loser = Math.abs(ti - tj) > 4 ? (ti > tj ? i : j) : YIELD[active[i]!.tag.kind] < YIELD[active[j]!.tag.kind] ? i : j;
      if (!firm(loser)) yielding.add(loser);
    }
    active.forEach((live, i) => {
      const tag = live.tag;
      const { x, y } = drawn[i]!;
      live.drawn = { x, y };
      // When there is no room near a crowded/top-edge group, a passing
      // caption waits rather than covering a person. Choices remain interactive.
      const obscures = people.some((body) => overlaps(body, { x, y, w: live.w, h: live.h }));
      // Speech and what a friend is doing never blink out mid-line; only passing notes step aside, or a tag crossing another.
      const hidden = (obscures && tag.kind === 'note') || yielding.has(i);
      live.el.style.opacity = hidden ? '0' : '1';
      live.el.style.pointerEvents = yielding.has(i) ? 'none' : '';
      live.tail.style.opacity = live.dot.style.opacity = hidden ? '0' : '1';
      live.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      // The tail runs from the anchor to the nearest edge of the tag: its side when beside the anchor, else its top or bottom.
      // A friend's line ends at their head, not their feet.
      const ay = tag.person && tag.kind !== 'unpack' && tag.headroom ? tag.y - (tag.headroom - 10) * 0.8 : tag.y;
      const beside = tag.x < x || tag.x > x + live.w;
      const attachX = beside ? (x > tag.x ? x : x + live.w) : Math.min(Math.max(tag.x, x + 14), x + live.w - 14);
      const attachY = beside ? Math.min(Math.max(ay, y + 18), y + live.h - 18) : ay < y ? y : y + live.h;
      const dx = attachX - tag.x;
      const dy = attachY - ay;
      const len = Math.hypot(dx, dy);
      // A creature's line starts at its pencil ring, not at its feet, and only when the caption was pushed away from it.
      const skip = tag.kind === 'sighting' ? Math.min(len, RING) : 0;
      if (tag.kind === 'sighting' && len - skip < 14) live.tail.style.opacity = '0';
      const sx = tag.x + (len ? (dx / len) * skip : 0), sy = ay + (len ? (dy / len) * skip : 0);
      live.tail.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) rotate(${Math.atan2(dy, dx).toFixed(3)}rad) scaleX(${(len - skip).toFixed(1)})`;
      live.dot.style.transform = `translate(${tag.x.toFixed(1)}px, ${ay.toFixed(1)}px)`;
      if (live.timer && tag.kind === 'choice') {
        live.total = Math.max(live.total, tag.remaining);
        const scale = Math.round((tag.remaining / live.total) * 200) / 200;
        if (scale !== live.lastScale) {
          live.lastScale = scale;
          live.timer.style.transform = `scaleX(${scale})`;
        }
      }
    });
  }
}

/**
 * One bundle set down by the fire, drawn after its kind so the four never
 * read alike: a find is its sketch and its name; a lead is the lead mark, the
 * place, the line and the days it holds; provisions are a plain knot and a
 * number; nothing is a single quiet line.
 */
function bundle(tag: ScreenTag, item: UnpackItem | null, friend: FriendView | null, view: AdventureView | null): HTMLElement {
  const kind=item?.kind ?? 'find';
  let title=item?.title ?? tag.text;
  if(kind==='lead') title=(view ? placeFor(view,title)?.name : null) ?? title.replace(/^A lead:\s*/i,'');
  if(item && (kind==='supplies' || kind==='materials')) {
    title=[item.provisions ? supplyWords(item.provisions) : '',item.materials ? `${item.materials} ${item.materials===1?'material':'materials'}` : ''].filter(Boolean).join(' · ');
  }
  const art=tag.sketch && kind==='find' ? sketchEl(tag.sketch,20,true,'nb-tag-find-mark') : null;
  return h('div','nb-tag-row',null,[
    friend ? speakerFace(friend.id,32) : tag.sketch ? sketchEl(tag.sketch,28) : null,
    h('div','nb-tag-words',null,[
      friend ? h('p','nb-tag-who',null,[caps(friend.name)]) : null,
      h('p','nb-tag-title',null,[title,art]),
      kind==='supplies' || kind==='materials' ? null : short(item),
    ]),
  ]);
}

/** At most one short line under a bundle's title in the valley; the full words wait in the book. */
function short(item: UnpackItem | null): HTMLElement | null {
  const line = item ? shortLine(item) : null;
  return line ? h('p', 'nb-tag-text', null, [line]) : null;
}

/** A soft ink swash drawn in under the story's tag: a flourish, never a glow. */
function swash(): HTMLElement {
  const el = h('span', 'nb-tag-swash', { 'aria-hidden': 'true' });
  el.innerHTML = '<svg viewBox="0 0 120 14" preserveAspectRatio="none"><path pathLength="1" d="M3 9.5c14-5 27-6.5 41-3.4 9 2 15 4.4 26 3.6 13-1 26-6.6 44-5.4"/><path pathLength="1" d="M88 11.2c6-1.6 11-1.8 16-.8"/></svg>';
  return el;
}

/**
 * The screen-centred fireside column, in the order bundles were set down,
 * hanging from `top`.
 */
/** Where a bundle comes in tonight's order; one set down a moment before the notebook's snapshot knows of it is the newest. */
function setDown(order: string[], live: Live): number {
  const i = order.indexOf(live.tag.id);
  return i < 0 ? Infinity : i;
}

function fireColumn(lives: Live[], centre: number, top: number, vw: number, safe: Insets): Map<Live, Box> {
  const boxes = new Map<Live, Box>();
  let y = top;
  for (const live of lives) {
    const x = Math.min(Math.max(centre - live.w / 2, safe.left), vw - live.w - safe.right);
    boxes.set(live, { x, y, w: live.w, h: live.h });
    y += live.h + GAP;
  }
  return boxes;
}

type Insets = { top: number; right: number; bottom: number; left: number };
type Box = { x: number; y: number; w: number; h: number };
/** Something tags keep clear of; a creature's own caption may stand over its `owner`. */
type Obstacle = Box & { owner?: string };

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP;
}

/**
 * The last word on overlaps, for narrow screens where tags cannot sit side by
 * side: top to bottom, each tag that still touches one above it (or a slip)
 * steps down below it. If the stack then runs off the bottom, it is lifted.
 */
function settleColumn(loose: Array<{ box: Box; order: number; owner: string }>, fixed: Obstacle[], vh: number, safe: Insets): void {
  // In the order they stood last frame, so two tags never trade places by stepping through each other.
  const order = [...loose].sort((a, b) => a.order - b.order);
  const placed: Obstacle[] = [...fixed];
  for (const { box: b, owner } of order) {
    for (let guard = 0; guard < 8; guard++) {
      const hit = placed.find((p) => p.owner !== owner && overlaps(p, b));
      if (!hit) break;
      b.y = hit.y + hit.h + GAP;
    }
    placed.push(b);
  }
  const lowest = Math.max(...order.map(({ box }) => box.y + box.h), 0);
  const over = lowest - (vh - safe.bottom);
  if (over > 0) for (const { box } of order) box.y = Math.max(safe.top, box.y - over);
}

/**
 * Where a tag would sit with nothing in its way: above its anchor. A place
 * card sits beside its place, on whichever side has room; on a narrow screen,
 * where neither side does, it sits below the place (or above, near the bottom).
 */
function naturalBox(live: Live, vw: number, vh: number, safe: Insets): { x: number; y: number; w: number; h: number } {
  const { tag, w, h: hgt } = live;
  if (tag.kind === 'place') {
    if (tag.x + 26 + w < vw - safe.right) return { x: tag.x + 26, y: tag.y - hgt * 0.4, w, h: hgt };
    if (tag.x - 26 - w > safe.left) return { x: tag.x - 26 - w, y: tag.y - hgt * 0.4, w, h: hgt };
    const below = tag.y + TAIL + hgt < vh - safe.bottom;
    return { x: tag.x - w / 2, y: below ? tag.y + TAIL : tag.y - TAIL - hgt, w, h: hgt };
  }
  const lift = tag.person ? tag.headroom ?? 64 : tag.kind === 'sighting' ? RING + PATCH - TAIL / 2 : 0;
  const above = tag.y - lift - TAIL - hgt > safe.top;
  if (tag.person && !above) {
    const right = tag.x + 32 + w <= vw - safe.right;
    return { x: right ? tag.x + 32 : tag.x - 32 - w, y: Math.max(safe.top, tag.y - lift - hgt), w, h: hgt };
  }
  return { x: tag.x - w / 2, y: above ? tag.y - lift - TAIL - hgt : tag.y + TAIL, w, h: hgt };
}

/** The tags to show this frame: visible ones, most important first, newest first among equals, at most four. */
function chooseShown(tags: ScreenTag[], max: number): ScreenTag[] {
  return tags
    .map((tag, index) => ({ tag, index }))
    .filter(({ tag }) => tag.visible)
    .sort((a, b) => PRIORITY[b.tag.kind] - PRIORITY[a.tag.kind] || b.index - a.index)
    .slice(0, max)
    .map(({ tag }) => tag);
}

function placeKey(place: PlaceView, view: AdventureView): string {
  return `${view.phase}|${place.state}|${place.stateLine}|${place.lead}|${place.leadDays}|${place.visits}|${place.learned.length}|${place.finds.map((f) => (f.found ? 1 : 0)).join('')}`;
}

function speakerFace(id:string,size:number):HTMLElement {
  const el=h('span','nb-speaker-face',{'aria-hidden':'true'});el.innerHTML=portraitMarkup(id,size);return el;
}

/**
 * A pencilled tick pointing right (it is turned to face the creature): the
 * same pale paper edge under warm graphite as the ring round a creature.
 */
const EDGE_MARK = `<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
<g fill="none" stroke-linecap="round" stroke-linejoin="round">
<path d="M5.4 14.3 Q12 13.7 19.6 14 M13.6 8.9 Q16.8 11.6 19.8 14 Q16.6 16.5 13.8 19.2" stroke="#f6efe0" stroke-opacity=".85" stroke-width="4.4"/>
<path d="M5.4 14.3 Q12 13.7 19.6 14" stroke="#5a4e42" stroke-opacity=".7" stroke-width="1.3"/>
<path d="M13.6 8.9 Q16.8 11.6 19.8 14 Q16.6 16.5 13.8 19.2" stroke="#5a4e42" stroke-opacity=".9" stroke-width="1.7"/>
</g>
</svg>`;

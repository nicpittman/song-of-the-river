/**
 * The book: the game's main interface. A real book over a softly quietened
 * valley: two facing pages across a gutter, a stack of page edges, a cloth
 * cover, and paper index tabs down the fore-edge for its parts: Today (the
 * morning's turn), the field journal, the collections, friends and the river
 * map. It opens by itself each morning on Today, closes when the day begins,
 * opens again on the journal after the fire, and ends on its last page.
 *
 * Arrow keys turn between the tabs; Escape or "Close" folds it away and
 * returns focus to where it came from.
 *
 * On a phone the book shows one page at a time, its tabs along the top edge:
 * swipe, or step with the small page turner at the foot.
 */

import type { AdventureCommand, AdventureView } from '../../game/adventure/model';
import type { UiActions } from '../contract';
import { h } from '../dom';
import { Board } from './board';
import { focusKey, reducedMotion, restoreFocus, wordButton } from './ink';
import { collectionsPages, type CollectionsState } from './pages/collectionsPage';
import { friendsPages, type FriendsState } from './pages/friendsPage';
import { journalPages, type JournalState, type Tonight } from './pages/journalPage';
import { mapLeftPage, mapRightPage } from './pages/mapPage';
import type { LearnedMemory } from './placeCard';
import type { Today } from './today';
import { flourish, inkIn } from './flourish';
import { endingCard } from './voyage';
import { placeSlip } from './slip';
import { reach } from './campPoint';
import { PageCurl } from './pageCurl';

export type SpreadPage = 'today' | 'journal' | 'collections' | 'friends' | 'map' | 'ending';

/** The book's tabs, each with the pale wash its paper is tinted. (The ending is the last page, with no tab.) */
const PAGES: Array<{ id: SpreadPage; label: string; wash: string }> = [
  { id: 'today', label: 'Today', wash: 'straw' },
  { id: 'journal', label: 'Journal', wash: 'leaf' },
  { id: 'collections', label: 'Collections', wash: 'blossom' },
  { id: 'friends', label: 'People', wash: 'leaf' },
  { id: 'map', label: 'River map', wash: 'river' },
];

/** How long the book is given to open or close, in milliseconds (a little over the CSS, which takes 140 to 180). */
const OPEN_MS = 200;
const UNFOLD_MS = 780;
/** The gap between one find inking in and the next. */
const INK_STEP = 260;

export class Spread {
  readonly el = h('div', 'nb-spread', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Notebook' });
  private readonly scrim = h('div', 'nb-spread-scrim');
  private readonly index = h('nav', 'nb-tabs', { 'aria-label': 'Notebook pages' });
  private readonly book = h('div', 'nb-book');
  private readonly left = h('section', 'nb-page is-left');
  private readonly right = h('section', 'nb-page is-right');
  private readonly curl = new PageCurl(this.book, this.left, this.right);
  private readonly atlas: Board;
  private page: SpreadPage = 'journal';
  private isOpen = false;
  private archive = false;
  private view: AdventureView | null = null;
  private key = '';
  private returnFocus: HTMLElement | null = null;
  private readonly journal: JournalState = { category: null, entry: null };
  private readonly friends: FriendsState = { friend: null };
  private readonly collections: CollectionsState = { set: null };
  /** The farthest region the map has been shown unfolded to; a newer one unfolds as it is shown. */
  private unfoldedTo = -1;
  /** On a phone, which page of the spread is showing. */
  private side: 'left' | 'right' = 'left';
  private readonly turner = h('nav', 'nb-page-turner', { 'aria-label': 'Turn the page' });
  /** Journal entries already seen inked in; a rare one found since is inked with a flourish. */
  private inked: Set<string> | null = null;
  private readonly narrow = window.matchMedia('(max-width: 760px)');
  /** After the fire: tonight's finds and the way to sleep, written at the head of the journal. */
  private tonight: Tonight | null = null;
  /** Tonight's finds already inked in, so a refresh does not draw them twice. */
  private readonly tonightInked = new Set<string>();
  /** At the very end: the way back into the valley. */
  private onReturn: (() => void) | null = null;
  private closing = 0;
  private opening = 0;
  private unfoldedJourney: AdventureView['chart'] | null = null;
  /** The place whose slip is pinned on the river map. */
  private atlasPlace: string | null = null;
  private renderedJournalDay: number | null = null;
  private renderedPage: SpreadPage | null = null;

  constructor(
    private readonly actions: UiActions,
    private readonly command: (c: AdventureCommand) => void,
    readonly memory: LearnedMemory,
    private readonly today: Today,
    /** Called whenever the book opens or closes. */
    private readonly onToggle: () => void,
  ) {
    this.atlas = new Board({
      // On the river map a place answers with its slip, read-only: what it is, how well known, what might be found.
      place: (id) => this.atlasSlip(this.atlasPlace === id ? null : id),
      hover: () => undefined,
      project: () => this.command({ type: 'notebook', page: 'make' }),
      lodging: (id) => this.command({ type: 'notebook', page: 'plan', lodging: id }),
      token: (id) => {
        this.close();
        this.command({ type: 'follow', person: id });
      },
    });
    this.scrim.addEventListener('click', () => this.close());
    const close = wordButton('×', () => this.close(), 'nb-book-close', 'spread-close');
    close.setAttribute('aria-label', 'Close notebook');
    this.index.append(...PAGES.map((p) => this.indexButton(p.id, p.label, p.wash)));
    this.book.append(this.left, h('div', 'nb-gutter', { 'aria-hidden': 'true' }), this.right, this.index);
    this.el.append(this.scrim, h('div', 'nb-spread-frame', null, [close, this.book, this.turner]));
    this.el.addEventListener('keydown', (e) => this.onKey(e));
    this.listenForSwipes();
    window.addEventListener('resize', () => this.curl.cancel(), { passive: true });
    this.el.setAttribute('inert', '');
  }

  setArchive(archive: boolean): void {
    this.archive = archive; this.tonight = null; this.key = '';
    if (archive) this.inked = null;
    this.index.querySelectorAll<HTMLElement>('[data-page]').forEach(button => { button.hidden = archive && !['journal', 'collections'].includes(button.dataset.page ?? ''); });
  }

  get opened(): boolean {
    return this.isOpen;
  }

  /** Carry an explicitly inspected destination into tomorrow’s planning. */
  get nextMorningPlace(): string | null { return this.page === 'map' ? this.atlasPlace : this.page === 'today' ? this.today.selectedPlace : null; }

  /** Open, or still settling closed. */
  get busy(): boolean {
    return this.isOpen || this.el.classList.contains('is-closing');
  }

  get current(): SpreadPage {
    return this.page;
  }

  scrollMap(dy: number): boolean {
    if (!this.isOpen) return false;
    if (this.page === 'today') this.today.scrollMap(dy);
    else if (this.page === 'map') this.atlas.el.scrollBy({ top: dy, behavior: 'auto' });
    else return false;
    return true;
  }

  /** The demo and the first update can set how far the map counts as already unfolded. */
  seenRegion(region: number): void {
    this.unfoldedTo = region;
  }

  /**
   * Opens the book (with a soft settle) or turns to a page of the open book.
   * `daybreak` marks the one slower turn, from the evening's page to the morning.
   */
  open(page: SpreadPage, daybreak = false, side?: 'left'): void {
    if (this.archive && page !== 'journal' && page !== 'collections') return;
    if (page === 'today' && this.view?.phase === 'evening' && this.tonight) { this.tonight.sleep(); return; }
    if (page === 'journal' && (!this.isOpen || this.page !== 'journal')) this.journal.day = null;
    if (!this.isOpen) {
      this.returnFocus = document.activeElement instanceof HTMLElement && !this.el.contains(document.activeElement) ? document.activeElement : null;
      this.isOpen = true;
      window.clearTimeout(this.closing);
      window.clearTimeout(this.opening);
      const firstMorning = page === 'today' && this.view?.mode === 'journey' && this.view.day === 1 && this.view.phase === 'morning' && this.unfoldedJourney !== this.view.chart;
      if (firstMorning) this.unfoldedJourney = this.view!.chart;
      const unfold = firstMorning && !reducedMotion(this.el);
      this.el.classList.remove('is-closing');
      this.el.classList.add('is-open', 'is-opening');
      this.el.classList.toggle('is-unfolding', unfold);
      this.opening = window.setTimeout(() => this.el.classList.remove('is-opening', 'is-unfolding'), unfold ? UNFOLD_MS : OPEN_MS);
      this.el.removeAttribute('inert');
      this.actions.cue('leaf-open');
      this.onToggle();
    } else if (page !== this.page) {
      this.actions.cue('page-turn');
      // Later tabs lie further on in the book; a new day is always a page on.
      this.turn(daybreak || this.order(page) > this.order(this.page), daybreak);
    }
    this.page = page;
    // The map's drawing is its right page; Today's board is its right page; the others begin on the left.
    this.side = side ?? (page === 'map' || page === 'today' ? 'right' : 'left');
    this.key = '';
    this.render();
    requestAnimationFrame(() => this.index.querySelector<HTMLElement>('[aria-current="page"]')?.focus({ preventScroll: true }));
  }

  /** The year's almanac: the Collections page, on its Almanac tab, at the season we are in. */
  openAlmanac(): void {
    if (this.view?.aims.length) { this.collections.tab = 'almanac'; this.collections.season = null; }
    this.open('collections', false, 'left');
  }

  /** After the fire: the journal, with tonight's finds inked in and the way to sleep. */
  openTonight(tonight: Tonight): void {
    this.journal.day = null;
    this.journal.browsingField = false;
    this.open('journal');
    this.tonight = tonight;
    this.key = '';
    this.render();
  }

  /** The evening is over: tonight's page is no longer written at the head of the journal. */
  endTonight(render = true): void {
    if (!this.tonight) return;
    this.tonight = null;
    this.key = '';
    if (this.isOpen && render) this.render();
  }

  /** Tonight's bundles keep arriving as friends come home; the open journal follows them. */
  refreshTonight(items: Tonight['items'], tomorrow: string): void {
    if (!this.tonight || !this.isOpen) return;
    if (items.length === this.tonight.items.length && tomorrow === this.tonight.tomorrow) return;
    this.tonight = { ...this.tonight, items, tomorrow };
    this.key = '';
    this.render();
  }

  /** Shows (or with null, puts away) a place's read-only slip on the river map. */
  private atlasSlip(id: string | null, hovering = false): void {
    if (!hovering) this.atlasPlace = id;
    const view = this.view;
    const place = view?.places.find((p) => p.id === id);
    if (!view || !place) {
      this.atlas.showSlip(null, null);
      return;
    }
    const none = (): void => undefined;
    this.atlas.showSlip(
      place.id,
      placeSlip(view, place, { person: null, place: place.id, activity: null, item: null, companion: null }, true, {
        send: none,
        sendFriend: none,
        activity: none,
        item: none,
        companion: none,
        rest: none,
        refuse: none,
        close: () => this.atlasSlip(null),
      }),
    );
  }

  /** The journey's end, as the book's last page. */
  openEnding(onReturn: () => void): void {
    this.onReturn = onReturn;
    this.open('ending');
  }

  /** Closes the book with a soft settle, back to the valley. */
  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.curl.cancel();
    window.clearTimeout(this.opening);
    this.el.classList.remove('is-opening', 'is-unfolding');
    this.today.show(false);
    this.el.classList.add('is-closing');
    this.el.setAttribute('inert', '');
    this.actions.cue('leaf-close');
    this.closing = window.setTimeout(() => {
      this.el.classList.remove('is-open', 'is-closing');
      this.onToggle();
    }, OPEN_MS);
    this.onToggle();
    if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
  }

  update(view: AdventureView, render = true): void {
    this.atlas.updatePositions(view);
    if (this.unfoldedTo < 0) this.unfoldedTo = reach(view);
    this.inked ??= new Set(view.journal.filter((e) => e.found).map((e) => e.id));
    this.view = view;
    if (this.isOpen && render) this.render();
  }

  private render(): void {
    const view = this.view;
    if (!view) return;
    this.book.dataset.page = this.page;
    this.el.dataset.page = this.page;
    if (this.page === 'today') {
      this.renderToday();
      return;
    }
    this.today.show(false);
    const key = JSON.stringify([
      this.page,
      this.tonight ? [this.tonight.items.length, this.tonight.tomorrow] : null,
      this.journal.day, this.journal.browsingField, // Specimen/category selection updates its own DOM in place.
      this.friends,
      this.collections,
      view.region,
      view.journal.map((e) => e.found),
      this.page === 'friends' ? view.friends.map((f) => [f.status, f.statusLine, f.memories.length]) : null,
      this.page === 'map' ? view.places.map((p) => [p.id, p.rumour, p.state, p.visits, p.learned.length, !!p.lead]) : null,
      this.page === 'map' ? view.notes[0]?.id : null, view.history[0]?.day,
      this.page === 'collections' ? [view.season, view.aims.map((a) => [a.done, a.place ?? null])] : null,
    ]);
    if (key === this.key) return;
    this.key = key;
    const focus = focusKey(this.el);
    this.index.querySelectorAll<HTMLElement>('[data-page]').forEach((b) => {
      if (b.dataset.page === this.page) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    this.book.dataset.page = this.page;
    let pages: [HTMLElement, HTMLElement];
    if (this.page === 'journal') {
      pages = journalPages(
        view,
        this.journal,
        () => this.render(),
        () => {
          this.actions.cue('click');
          // On a phone, choosing a specimen turns to the page that shows it.
          this.side = 'left';
          this.renderTurner();
        },
        this.tonight,
        (place) => {
          if (view.phase === 'evening' && this.tonight?.plan) this.tonight.plan(place);
          else if (view.phase === 'morning') { this.open('today'); this.today.focusPlace(place); }
        },
      );
    } else if (this.page === 'collections') {
      pages = collectionsPages(
        view,
        this.collections,
        () => this.render(),
        () => {
          this.actions.cue('click');
          // On a phone, choosing a collection turns to the page that shows it.
          this.side = 'right';
        },
        () => this.actions.cue('click'),
        (id) => {
          // An almanac note's place, shown on the river map (as the map's own notes once did).
          const place = view.places.find((p) => p.id === id);
          if (!place) return;
          this.campCentred = true;
          this.open('map');
          requestAnimationFrame(() => this.atlas.reveal(place.at, true));
        },
      );
    } else if (this.page === 'friends') {
      pages = friendsPages(
        view,
        this.friends,
        () => this.render(),
        () => {
          this.actions.cue('click');
          this.side = 'right';
        },
        (id) => {
          this.close();
          this.command({ type: 'follow', person: id });
        },
      );
    } else if (this.page === 'ending') {
      pages = this.endingPages(view);
    } else {
      pages = this.mapPages(view);
    }
    const journalDay = this.journal.day ?? view.history[0]?.day ?? 0;
    const preserve = this.page === 'journal' && this.renderedPage === 'journal' && this.renderedJournalDay === journalDay;
    const leftScroll = this.left.scrollTop, rightScroll = this.right.scrollTop;
    const reportScroll = this.left.querySelector('.nb-evening-scroll')?.scrollTop ?? 0;
    this.left.replaceChildren(pages[0]);
    this.right.replaceChildren(pages[1]);
    this.inkFresh(view);
    this.renderTurner();
    restoreFocus(this.el, focus);
    if (preserve) {
      this.left.scrollTop = leftScroll; this.right.scrollTop = rightScroll;
      const report = this.left.querySelector('.nb-evening-scroll');
      if (report) report.scrollTop = reportScroll;
    } else if (this.page === 'journal') this.left.scrollTop = 0;
    this.renderedPage = this.page; this.renderedJournalDay = journalDay;
  }

  /** Today's pages are Today's own; the book only lays them in and tells Today it is showing. */
  private renderToday(): void {
    this.index.querySelectorAll<HTMLElement>('[data-page]').forEach((b) => {
      if (b.dataset.page === 'today') b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    // The map/people component stays together on the right; decisions read first on the left.
    if (this.left.firstChild !== this.today.right) this.left.replaceChildren(this.today.right);
    if (this.right.firstChild !== this.today.left) this.right.replaceChildren(this.today.left);
    this.today.show(true);
    this.key = '';
    this.renderTurner();
  }

  /**
   * Entries found since the journal was last open ink themselves in, one
   * after another, rarest last; a rare one with the one flourish. Tonight's
   * own finds at the head of the page do the same.
   */
  private inkFresh(view: AdventureView): void {
    const inked = this.inked;
    if (!inked || this.page !== 'journal' || reducedMotion(this.el)) {
      if (inked) for (const e of view.journal) if (e.found) inked.add(e.id);
      return;
    }
    const fresh = view.journal.filter((e) => e.found && !inked.has(e.id)).sort((a, b) => Number(a.rare) - Number(b.rare));
    fresh.forEach((e, i) => {
      inked.add(e.id);
      const art = this.book.querySelector<HTMLElement>(`[data-k="entry-${CSS.escape(e.id)}"] .nb-sketch`);
      if (!art) return;
      if (e.rare) window.setTimeout(() => flourish(art), INK_STEP * i);
      else inkIn(art, INK_STEP * i);
    });
    let step = 0;
    this.book.querySelectorAll<HTMLElement>('.nb-tonight-find').forEach((row) => {
      const id = row.dataset.item ?? '';
      const art = row.querySelector<HTMLElement>('.nb-tonight-sketch');
      if (!art || this.tonightInked.has(id)) return;
      this.tonightInked.add(id);
      if (row.classList.contains('is-rare')) window.setTimeout(() => flourish(art), INK_STEP * step);
      else inkIn(art, INK_STEP * step);
      step += 1;
    });
  }

  /** The last page: how the journey ended, and the river as it was followed. */
  private endingPages(view: AdventureView): [HTMLElement, HTMLElement] {
    const left = h('div', 'nb-page-body is-ending', null, [
      endingCard(
        view,
        () => {
          this.actions.cue('click');
          this.onReturn?.();
        },
        () => {
          this.actions.cue('click');
          this.close();
          this.actions.startJourney('river-adventure');
        },
        () => this.actions.openCredits?.(),
      ),
    ]);
    return [left, this.mapPages(view)[1]];
  }

  /** The phone's page turner: which of the two pages shows, and the way to the other. */
  private renderTurner(): void {
    this.book.dataset.side = this.side;
    const other = this.side === 'left' ? 'right' : 'left';
    const label = this.side === 'left' ? 'Turn the page' : 'Turn back';
    const b = wordButton(label, () => this.showSide(other), 'nb-turn', 'turn');
    // On a phone the way out sits here too, within the thumb's reach.

    if (this.page === 'today') {
      // Today is one page on a phone (the morning folds into the board's): only the way out.
      this.turner.replaceChildren();
      return;
    }
    if (this.tonight && this.side === 'right') {
      // Tonight's second page (the sketch): the way on to the morning stays in reach, not only on page one.
      const tonight = this.tonight;
      this.turner.replaceChildren(b, wordButton('Next morning →', () => tonight.sleep(), 'nb-turn nb-turn-on', 'turn-sleep'));
      return;
    }
    this.turner.replaceChildren(h('span', 'nb-turn-count', null, [this.side === 'left' ? '1 of 2' : '2 of 2']), b);
  }

  private showSide(side: 'left' | 'right'): void {
    if (side === this.side) return;
    this.side = side;
    this.actions.cue('page-turn');
    this.turn(side === 'right');
    this.renderTurner();
    (side === 'left' ? this.left : this.right).scrollTop = 0;
  }

  /** A horizontal swipe on a phone turns between the two pages of the spread. */
  private listenForSwipes(): void {
    let start: { x: number; y: number; id: number } | null = null;
    this.book.addEventListener('pointerdown', (e) => {
      if (this.narrow.matches) start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    });
    this.book.addEventListener('pointerup', (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) < 56 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
      this.showSide(dx < 0 ? 'right' : 'left');
    });
    this.book.addEventListener('pointercancel', () => (start = null));
  }

  /** Free Play's River Map opens on the camp once, then keeps wherever the reader leaves it. */
  private campCentred = false;

  private mapPages(view: AdventureView): [HTMLElement, HTMLElement] {
    const far = reach(view);
    const unfold = far > this.unfoldedTo ? far : null;
    this.unfoldedTo = Math.max(this.unfoldedTo, far);
    const right = mapRightPage(this.atlas);
    const left = mapLeftPage(view, this.atlas);
    this.atlas.render(view, { mode: 'atlas', selectedPlace: null, selectedPerson: null, camp: null, unfold, opened: [], expiring: [] });
    // Bring the newly opened reach into view as it unfolds; in Free Play, where the whole river is open, the camp.
    const camp = view.mode === 'free' && !this.campCentred ? view.places.find((p) => p.kind === 'settlement' && p.region === view.friends[0]?.base) : undefined;
    if (camp) requestAnimationFrame(() => requestAnimationFrame(() => {
      // Only once the page is really showing, so the scroll lands.
      if (this.campCentred || !this.atlas.el.isConnected || !this.atlas.el.clientHeight) return;
      this.campCentred = true;
      this.atlas.centreOn(camp.at);
    }));
    else if (unfold !== null) requestAnimationFrame(() => this.atlas.scrollToRegion(unfold));
    return [left, right];
  }

  /** One paper tab on the book's fore-edge. */
  private indexButton(page: SpreadPage, label: string, wash: string): HTMLButtonElement {
    const b = h('button', 'nb-book-tab', { type: 'button' }, [h('span', 'nb-book-tab-word', null, [label])]);
    b.dataset.k = `index-${page}`;
    b.dataset.page = page;
    b.style.setProperty('--tab-wash', `var(--wash-${wash})`);
    b.addEventListener('click', () => this.open(page));
    return b;
  }

  /** Tabs the player can turn to now: Today and the ending are not always there. */
  setTabs(view: AdventureView): void {
    this.index.querySelectorAll<HTMLElement>('[data-page="today"]').forEach((b) => (b.hidden = view.voyage === 'ended'));
    // The collection's count rides on its tab, and gives a small ink pulse when it grows.
    const tab = this.index.querySelector<HTMLElement>('[data-page="collections"]');
    if (!tab) return;
    const name = 'Collections';
    const found = view.journal.filter((entry) => entry.found).length;
    let count = tab.querySelector<HTMLElement>('.nb-book-tab-count');
    if (!count) { count = h('span', 'nb-book-tab-count', { 'aria-hidden': 'true' }); tab.append(count); }
    const before = Number(count.dataset.found ?? found);
    count.dataset.found = String(found);
    count.textContent = `${found}/${view.journal.length}`;
    tab.setAttribute('aria-label', `${name}, ${found} of ${view.journal.length} found`);
    if (found > before) { count.classList.remove('is-new'); void count.offsetWidth; count.classList.add('is-new'); }
  }

  /** Where a page lies in the book: the tabs in order, then the last page. */
  private order(page: SpreadPage): number {
    const i = PAGES.findIndex((p) => p.id === page);
    return i < 0 ? PAGES.length : i;
  }

  /**
   * Turns a leaf, forward or back. Call before the pages change: the leaf
   * carries the outgoing pages with it (skipped when motion is reduced).
   */
  private turn(forward: boolean, daybreak = false): void {
    if (reducedMotion(this.el)) return;
    this.curl.play(forward, daybreak);
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.close();
      return;
    }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && (e.target as HTMLElement).closest('.nb-tabs')) {
      e.preventDefault();
      const pages = this.archive ? PAGES.filter(page => page.id === 'journal' || page.id === 'collections') : PAGES;
      const i = pages.findIndex((p) => p.id === this.page);
      const next = pages[(i + (e.key === 'ArrowRight' ? 1 : pages.length - 1)) % pages.length];
      this.open(next.id);
      return;
    }
    if (e.key === 'Tab') this.trapFocus(e);
  }

  /** Keeps keyboard focus inside the open book. */
  private trapFocus(e: KeyboardEvent): void {
    const focusables = [...this.el.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]')].filter((el) => el.offsetParent !== null && !el.closest('.nb-pageturn'));
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

/**
 * Today: the morning's turn, as the first two pages of the book.
 *
 *   right page  one fixed row of people and the expedition map
 *   left page   conditions, suggested places or one destination's choices,
 *               shared resources and Begin Day
 *
 * One confirmed outing is enough to begin; unassigned people stay at home.
 * A deliberate camp day is also possible. Picking a person and a place may happen in either order;
 * the card rises on the page as soon as there is something to say.
 *
 * By day the pages are read-only: where everyone is, and the knots on their
 * packs. On a phone the same parts form one bounded grid; only the current
 * advice scrolls, while the map, people and confirmation remain available.
 */

import type { Activity, AdventureCommand, AdventureView, Chance, Equipment, OutingPlan, SecondStop } from '../../game/adventure/model';
import type { UiActions } from '../contract';
import { h, svgEl } from '../dom';
import { Board, shownName } from './board';
import { mapStopHints, plannedStopsAt, type StopHint } from './stopHints';
import { campShelf, personChoices } from './camp';
import { campPoint, reach } from './campPoint';
import { caps, focusKey, friendToken, restoreFocus, stampButton, wordButton } from './ink';
import { makeList } from './make';
import { clueActivity, recommendPeople, suggestedOutings } from './recommendations';
import { placeIds } from './overnight';
import { type DetourHandlers, type Selection, defaultActivity, detourList, detourSlip, placeSlip, planFor } from './slip';
import type { LearnedMemory } from './placeCard';
import { riverSection } from './riverMark';
import { resourceMark, weatherMark } from '../sketches';
import { morningStatus } from './morning';
import { scrollCue } from './scrollCue';
import { seaPreparation } from './seaPreparation';
import { akiPromise } from './akiPromise';
import { voyageChooser } from './voyage';
import { ACTIVITY_WORDS, LEVEL_WORDS, TREND_WORDS, WEATHER_WORDS, listNames, resourceWords } from './words';

export class Today {
  /** Fixed people and the map, read first. */
  readonly left = h('div', 'nb-today nb-today-left', { 'aria-label': 'People and expedition map' });
  /** Conditions, the selected opportunity, and confirmation. */
  readonly right = h('div', 'nb-today nb-today-right', { 'aria-label': 'Conditions and expedition choices' });
  private readonly top = h('div', 'nb-leaf-top');
  private readonly decisions = h('div', 'nb-plan-body');
  private readonly suggestions = h('div', 'nb-plan-suggestions');
  private readonly departureSlot = h('div', 'nb-departure-slot');
  private readonly morningFoot = h('footer', 'nb-morning-foot');
  private readonly shelf = h('div', 'nb-shelf');
  private readonly newsToggle = h('button', 'nb-news-toggle', { type: 'button', 'aria-expanded': 'false' });
  private readonly boardWrap = h('div', 'nb-board-wrap');
  private readonly stepper = h('nav', 'nb-stepper', { 'aria-label': 'Reaches of the river' });
  /** The place the mouse is resting on (its slip shows while it does). */
  private readonly card = h('div', 'nb-plan-detail');
  /** A friend's token being carried across the board, if any. */
  private drag: { person: string; from: 'shelf' | 'board'; x: number; y: number; id: number; ghost: HTMLElement | null; held: string | null } | null = null;
  /** Set after a drag ends, to swallow the click that follows it. */
  private dragged = false;
  private readonly makeSlot = h('div', 'nb-make-slot');
  private readonly foot = h('footer', 'nb-leaf-foot nb-today-foot');
  private readonly board: Board;
  private view: AdventureView | null = null;
  private sel: Selection = { person: null, place: null, activity: null, item: null, companion: null };
  private making = false;
  private pickingSecond = false;
  /** On the moving morning: the friend whose stop on the way is being chosen, and the stop in hand. */
  private detourFor: string | null = null;
  private detourStop: SecondStop | null = null;
  private personPinned = false;
  /** Editing is a preview; the committed outing survives until Send replaces it. */
  private editingPerson: string | null = null;
  private detailsOpen = false;
  private selectedLodging: number | string | null = null;
  private planError: string | null = null;
  private boardKey = '';
  private viewKey = '';
  private topKey = '';
  private shelfKey = '';
  private suppliesKey = '';
  private footerKey = '';
  private decisionPlace = '';
  /** True while Today is the open page; it renders only then. */
  private active = false;
  private newsOpen = false;
  /** Lines from the interface for Today's page, by the day they arrived. */
  private notices: Array<{ day: number; text: string }> = [];
  private sailing = new Set<string>();
  private regionInView = 0;
  private revealJourney = false;
  /** What Today last told the game it has in hand, and when (see `isEcho`). */
  private told = { key: '', at: 0 };

  constructor(
    private readonly actions: UiActions,
    private readonly memory: LearnedMemory,
    /** Turns the book to another of its pages (the river map, for the full list of places; the almanac, under Collections). */
    private readonly openPage: (page: 'map' | 'almanac') => void,
  ) {
    this.board = new Board({
      place: (id, pointer) => this.tapPlace(id, pointer),
      hover: (id) => this.hover(id),
      token: (id) => (this.dragged ? undefined : this.inspectPerson(id)),
      stop: hint => this.previewMapStop(hint),
      region: (i) => this.markStepper(i),
      project: () => this.showMake(),
      lodging: (id) => this.showLodging(id),
    });
    // The map's own footer: walking scale or reaches, the key, the zoom. A strip under the drawing, never over its names.
    this.boardWrap.append(this.board.el, h('div', 'nb-map-foot', null, [this.board.scale, this.stepper, this.legend, this.board.zoomControls]));
    scrollCue(this.card);
    this.listenForDrags();
    this.newsToggle.addEventListener('click', () => this.toggleNews());
    this.left.append(this.shelf, this.boardWrap);
    this.decisions.append(this.suggestions, this.makeSlot, this.card);
    this.right.append(this.newsToggle, this.top, this.decisions, this.departureSlot, this.morningFoot, this.foot);
    for (const page of [this.left, this.right]) page.addEventListener('keydown', (e) => this.onKey(e));
  }

  /** A line for this morning's page (the season turning, a new year); kept until the next day. */
  addNotice(text: string): void {
    // Anything after the morning belongs to the next morning's page.
    const view = this.view;
    const day = !view ? 0 : view.phase === 'morning' ? view.day : view.day + 1;
    this.notices = this.notices.filter((n) => n.day >= day - 1 && n.text !== text);
    this.notices.push({ day, text });
    this.viewKey = '';
    if (this.active) this.render();
  }

  /** Called by the book when Today becomes, or stops being, the open page. */
  show(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    if (active) this.render(true);
    else this.putCardAway(false);
  }

  /** Phone: the morning's news, folded into a strip above the board, opens and closes. */
  private toggleNews(): void {
    this.newsOpen = !this.newsOpen;
    this.actions.cue('page-turn');
    this.render();
  }

  /**
   * True when an `openNotebook` call is only the game repeating back the
   * selection Today has just told it about (the `notebook` command is
   * echoed), so it must not reopen or reset anything.
   */
  isEcho(person?: string, place?: string): boolean {
    return !this.making && this.told.key === `${person ?? ''}|${place ?? ''}` && performance.now() - this.told.at < 1000;
  }

  /** A friend picked up and/or a place under consideration (from the valley or a place card). */
  consider(person?: string, place?: string): void {
    if (!person && !place) return;
    this.newsOpen = false;
    this.selectedLodging = null;
    this.personPinned = !!person;
    if (person) this.sel.person = person;
    if (place) {
      this.sel.place = place;
      const destination = this.view?.places.find((p) => p.id === place);
      if (!person && destination) this.sel.person = recommendPeople(this.view!, destination)[0]?.id ?? null;
    }
    this.sel.activity = null;
    this.making = false;
    if (this.active) this.render();
  }

  get selectedPlace(): string | null { return this.sel.place; }

  /** Building uses the same decision area as an expedition. */
  showMake(): void {
    this.making = true;
    if (this.active) this.render();
  }

  showPlan(): void {
    if (!this.making) return;
    this.making = false;
    this.putCardAway(false);
    if (this.active) this.render();
  }

  showLodging(id: number | string): void {
    this.planError = null;
    if (typeof id === 'string') { this.considerPlace(id, true); return; }
    this.selectedLodging = id;
    this.sel.place = null;
    this.making = false;
    const base = this.view?.lodgings.find((l) => l.id === id);
    if (!this.view?.friends.some((f) => f.id === this.sel.person && (f.status === 'home' || f.id === this.editingPerson) && f.base === base?.region && f.lodging !== id)) this.sel.person = this.view?.friends.find((f) => f.status === 'home' && f.base === base?.region && f.lodging !== id)?.id ?? null;
    this.render();
  }

  private readonly legend = h('p', 'nb-map-legend', { 'aria-hidden': 'true' }, ['○ Unvisited · ✓ Visited']);

  update(view: AdventureView): void {
    const first = !this.view;
    if (view.canTravel && !this.view?.canTravel) this.revealJourney = true;
    const previousPeople = this.view?.friends.map((f) => f.id) ?? [];
    if (view.phase === 'morning' && view.day !== this.view?.day) this.newsOpen = false;
    this.view = view;
    // The key is for the first days; after that the marks speak for themselves and the names need the room.
    this.legend.hidden = view.day > 3;
    this.board.updatePositions(view);
    for (const p of view.places) this.memory.know(p);
    this.validateSelection(view);
    if (this.detourFor && !view.plans.some(plan => plan.person === this.detourFor && plan.moving)) { this.detourFor = null; this.detourStop = null; }
    const key = viewKey(view);
    if (key === this.viewKey) return;
    this.viewKey = key;
    for (const friend of view.friends) if (first || !previousPeople.includes(friend.id)) this.sailing.add(friend.id);
    for (const id of this.sailing) if (!view.friends.some((f) => f.id === id)) this.sailing.delete(id);
    if (view.mode !== 'free') this.sailing.add('sora');
    if (this.active) this.render();
  }

  private validateSelection(view: AdventureView): void {
    const friend = view.friends.find((f) => f.id === this.sel.person);
    if (this.sel.person && !friend) {
      this.sel.person = null;
      this.sel.item = null;
      this.sel.companion = null;
      this.personPinned = false;
    }
    if (this.sel.place && !view.places.some((p) => p.id === this.sel.place)) this.sel.place = null;
    const place = view.places.find((p) => p.id === this.sel.place);
    if (place && !this.sel.person && view.phase === 'morning') this.sel.person = recommendPeople(view, place, this.sel.activity)[0]?.id ?? null;
    const lodging = view.lodgings.find((l) => l.id === this.selectedLodging);
    if (lodging && !this.sel.person && view.phase === 'morning') this.sel.person = view.friends.find((f) => f.status === 'home' && f.base === lodging.region && f.lodging !== lodging.id)?.id ?? null;
  }

  private render(scrollToCamp = false): void {
    const view = this.view;
    if (!view) return;
    const focus = focusKey(this.left) ?? focusKey(this.right);
    const morning = view.phase === 'morning';
    // The very first morning: the waiting friends quietly invite a tap, until the first outing is planned.
    this.left.classList.toggle('is-first', firstMorning(view));
    this.right.classList.toggle('is-readonly', !morning);
    this.right.classList.toggle('is-open', this.newsOpen);
    this.right.classList.toggle('is-making', this.making);
    this.right.classList.toggle('has-decision', !!(this.sel.place || this.sel.person || this.selectedLodging !== null));
    this.newsToggle.setAttribute('aria-expanded', String(this.newsOpen));
    this.newsToggle.replaceChildren(h('span', 'nb-news-line', null, [`${WEATHER_WORDS[view.weather]} · ${LEVEL_WORDS[view.river.level]}`]), h('span', 'nb-news-more', null, [this.newsOpen ? 'Hide forecast' : 'Forecast']));
    this.renderTop(view);
    this.renderMorningFoot(view);
    const destination = `${this.sel.place ?? ''}|${this.selectedLodging ?? ''}`;
    // A slip put away (sent, or closed) hands the map its height back: frame home and what is known again.
    const slipClosed = this.decisionPlace !== '' && this.decisionPlace !== '|' && destination === '|';
    this.renderBoard(view, scrollToCamp || slipClosed);
    const scroller = this.card.querySelector<HTMLElement>('.nb-slip-body');
    const scroll = destination === this.decisionPlace ? scroller?.scrollTop ?? 0 : 0;
    const detailScroll = destination === this.decisionPlace ? this.card.scrollTop : 0;
    this.renderCard(view);
    this.card.querySelectorAll<HTMLElement>('.nb-slip-body').forEach(scrollCue);
    const nextScroller = this.card.querySelector<HTMLElement>('.nb-slip-body');
    if (nextScroller) nextScroller.scrollTop = scroll;
    this.card.scrollTop = detailScroll;
    // On a phone the map gives up height when a slip opens: keep the chosen place in sight once the page has settled.
    const chosen = destination !== this.decisionPlace && this.sel.place ? view.places.find((p) => p.id === this.sel.place) : undefined;
    if (chosen) requestAnimationFrame(() => this.board.reveal(chosen.at, true, 0.5));
    this.decisionPlace = destination;
    this.renderFoot(view);
    restoreFocus(this.left, focus);
    restoreFocus(this.right, focus);
  }

  private renderTop(view: AdventureView): void {
    const key = JSON.stringify([this.viewKey, this.notices, this.sailing.size]);
    if (key === this.topKey) { this.renderShelf(view); return; }
    this.topKey = key;
    const head = h('header', 'nb-leaf-head', null, [caps(`Day ${view.day} · ${view.hour}`)]);
    const parts: HTMLElement[] = [head, this.riverRow(view)];
    const opportunities: HTMLElement[] = [];
    // The opening line is told over the valley as the Journey begins (see the slow open), not repeated here.
    const notices = this.notices.filter((n) => n.day === view.day);
    if (notices.length) opportunities.push(h('p', 'nb-notices', null, [notices[0].text]));
    // Story and wonder lead; a place suggested only for its supplies says what kind of place it is
    // (its yield is on its slip).
    const suggested = suggestedOutings(view);
    const openingMove = suggested.some(suggestion => suggestion.purpose === 'move-camp');
    const promise = akiPromise(view);
    if (promise) {
      opportunities.push(h('section', 'nb-aki-promise', { 'aria-label': 'Aki’s promise' }, [caps('Aki’s promise'),
        h('p', null, null, [promise.line]),
        wordButton(promise.action, () => this.showMake(), 'nb-quiet', 'aki-promise-build'),
      ]));
    }
    opportunities.push(caps('Worth a look'));
    if (suggested.length) {
      const list = h('ul', 'nb-suggested-places');
      for (const suggestion of suggested) {
        const place = view.places.find((p) => p.id === suggestion.place)!;
        const person = view.friends.find((p) => p.id === suggestion.person)!;
        const select = () => this.focusPlace(place.id, suggestion.person, suggestion.activity);
        const label = suggestion.purpose === 'move-camp' ? `Move camp to ${place.name}`
          : place.id === 'yamagoya' ? suggestion.activity === 'investigate' ? 'The hut book at home' : 'The view from Yamagoya' : shownName(place);
        const link = wordButton(label, select, `nb-suggestion-link${place.rumour ? ' is-rumoured' : ''}`, `suggest-${place.id}`);
        const who = suggestion.purpose === 'move-camp' ? null : wordButton(person.name, select, 'nb-suggested-person', `suggest-person-${place.id}`);
        who?.prepend(friendToken(person, 22));
        list.append(h('li', null, null, [h('div', 'nb-suggestion-heading', null, [link, who]), h('span', isSupply(suggestion.purpose) ? 'is-note' : suggestion.purpose === 'sign' || suggestion.purpose === 'gamble' ? 'is-sign' : null, null, [suggestion.reason])]));
      }
      opportunities.push(list);
    } else if (view.friends.some(f => f.status === 'home')) {
      opportunities.push(h('p', 'nb-plan-prompt', null, ['Choose a place on the map. Anyone without an outing stays home.']));
    }
    // The boat, when it is ready, is the morning's one real choice: it heads the list so it shows without scrolling on a phone.
    this.departureSlot.replaceChildren();
    if (view.canSail && view.voyage === 'preparing') {
      this.departureSlot.append(
        voyageChooser(view, this.sailing, {
          toggle: (id) => {
            if (view.mode !== 'free' && id === 'sora') return;
            if (this.sailing.has(id)) this.sailing.delete(id);
            else this.sailing.add(id);
            this.actions.cue('click');
            this.render();
          },
          sail: () => this.sail(view),
        }),
      );
    }
    const sea = seaPreparation(view);
    if (sea) this.departureSlot.append(wordButton(sea.label, () => sea.build ? this.showMake() : this.focusPlace(sea.place!, undefined, sea.activity), 'nb-quiet nb-sea-next'));
    else if (view.aims.length) {
      // The year's almanac: small things the river allows, a couple each season, what is in season now first; ticked once seen.
      const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
      // Three invitations here; the whole year's notes live under Collections.
      const unseen = view.aims.filter(aim => !aim.done);
      const shown = (unseen.length ? unseen : view.aims).slice(0, 3);
      const items = shown.map((aim) => {
        const later = aim.season !== undefined && aim.season !== view.season && !aim.done;
        const when = later ? h('span', 'nb-aim-when', null, [`In ${SEASONS[aim.season!]}`]) : null;
        return h('li', `${aim.done ? 'is-done' : ''}${later ? ' is-later' : ''}`.trim() || null, null, [when, aim.place && !aim.done && !later ? wordButton(aim.line, () => this.focusPlace(aim.place!), 'nb-aim-link') : aim.line]);
      });
      const seen = view.aims.filter(aim => aim.done).length;
      items.push(h('li', 'nb-aims-rest', null, [`${seen} of ${view.aims.length} seen · kept in the journal`])) ;
      opportunities.push(h('div', 'nb-aims', { 'aria-label': 'This year’s almanac' }, [h('p', 'nb-aims-title', null, ['From the almanac']), h('ul', null, null, items),
        // The whole year's notes live under Collections, on the Almanac tab.
        wordButton('All almanac notes →', () => this.openPage('almanac'), 'nb-quiet nb-aims-more')]));
    }
    else if (view.goal && !openingMove) opportunities.push(h('p', 'nb-goal', null, [view.goal]));
    // The road on is a checklist only once there is a road: the way found, or its place known after the first day.
    if (view.departure && (view.departure.surveyed || (!openingMove && view.departure.place !== null && view.day > 1))) {
      const trip = view.departure;
      const route = wordButton(trip.surveyed ? '✓ Way south found' : `○ Find the way south${trip.place ? ` · ${view.places.find(p => p.id === trip.place)?.name ?? ''}` : ''}`, () => { if (trip.place) this.focusPlace(trip.place); else this.openPage('map'); }, trip.surveyed ? 'nb-quiet is-done' : 'nb-quiet');
      const work = trip.work ? wordButton(trip.prepared ? `✓ ${trip.work} finished` : `Finish ${trip.work.toLowerCase()} →`, () => this.showMake(), trip.prepared ? 'nb-quiet is-done' : 'nb-quiet') : null;
      opportunities.push(h('div', 'nb-departure', { 'aria-label': `Preparing for ${trip.destination}` }, [h('strong', null, null, [`Towards ${trip.destination}`]), route, work,
        h('span', trip.packed && trip.materialsPacked ? 'is-done' : null, null, [`${trip.packed ? '✓' : '○'} ${trip.cost} provisions${trip.materialsCost ? ` · ${trip.materialsPacked ? '✓' : '○'} ${trip.materialsCost} ${trip.materialsCost === 1 ? 'material' : 'materials'}` : ''}`]),
      ]));
    }
    const town = view.places.find((place) => place.kind === 'settlement' && place.region === view.region);
    if (!openingMove && town && view.friends.length > 1 && view.friends.every((person) => person.base === town.region && person.lodging !== undefined)) opportunities.push(wordButton(`Move camp to ${town.name} →`, () => this.focusPlace(town.id), 'nb-quiet'));
    if (view.phase === 'morning') {
      const ready = view.friends.filter(person => person.status !== 'home');
      if (ready.length && moveMorning(view)) {
        // The walk down is one day together; anyone may stop somewhere on the way and catch up by dusk.
        const plans = h('section', 'nb-ready-plans nb-way-down', { 'aria-label': 'Stops on the way down' }, [caps('Ready for the day')]);
        for (const person of ready) plans.append(this.wayDownRow(view, person.id));
        opportunities.push(plans);
      } else if (ready.length) {
        const plans = h('section', 'nb-ready-plans', { 'aria-label': 'Change today’s plans' }, [caps('Ready for the day')]);
        for (const person of ready) {
          const edit = wordButton(`${person.name} · Change plan`, () => this.takeBack(person.id), 'nb-quiet');
          edit.prepend(friendToken(person, 24));
          plans.append(edit);
        }
        opportunities.push(plans);
      }
      const pending = view.structures.find(s => s.major && s.status === 'building' && s.builders?.length);
      if (pending && pending.id !== sea?.build && !promise) {
        opportunities.unshift(wordButton(`Choose builders · ${pending.name} →`, () => this.showMake(), 'nb-construction-next'));
      }
    }
    opportunities.push(wordButton('All known places →', () => this.openPage('map'), 'nb-quiet'));
    this.top.replaceChildren(...parts);
    this.suggestions.replaceChildren(...opportunities);
    this.renderShelf(view);
  }

  private renderShelf(view: AdventureView): void {
    const key = JSON.stringify([this.viewKey, this.sel.person, this.sel.place, this.sel.activity]);
    if (key === this.shelfKey) return;
    this.shelfKey = key;
    const selected = view.places.find((p) => p.id === this.sel.place);
    this.shelf.replaceChildren(
      campShelf(view, this.sel.person, {
        stay: (id) => this.rest(id),
        pick: (id) => (view.phase === 'morning' ? this.pickPerson(id) : this.follow(id)),
        takeBack: (id) => (view.phase === 'morning' ? this.inspectPerson(id) : this.follow(id)),
      }, selected && selected.kind !== 'settlement' && !moveMorning(view) ? recommendPeople(view, selected, this.sel.activity)[0]?.id : undefined),
    );
  }

  /** The foot of the left page: provisions, and the way to make something. */
  private renderMorningFoot(view: AdventureView): void {
    const key = JSON.stringify([this.viewKey, this.making]);
    if (key === this.suppliesKey) return;
    this.suppliesKey = key;
    const make = wordButton(
      this.making ? 'Back to planning' : 'Build & equipment',
      () => {
        this.making = !this.making;
        this.actions.cue('page-turn');
        this.render();
      },
      'nb-quiet',
      'make-toggle',
    );
    const provisions = suppliesMark(view);
    provisions.title = `${resourceWords(view)} · Camp provisions: 1 provision/day`;
    this.morningFoot.replaceChildren(provisions, make);
  }

  /** By day, a friend on the shelf is followed in the valley. */
  private follow(id: string): void {
    this.actions.cue('click');
    this.command({ type: 'follow', person: id });
  }

  private riverRow(view: AdventureView): HTMLElement {
    const { river } = view;
    const drawing = h('span', 'nb-river-drawing', { 'aria-hidden': 'true' });
    drawing.innerHTML = riverSection(river, { width: 120, height: 46, tiny: false });
    // Today and tomorrow side by side: the sky and the water now, then the water tomorrow.
    const sky = h('span', 'nb-river-sky', { 'aria-hidden': 'true' });
    sky.innerHTML = weatherMark(view.weather, 18);
    const words = h('div', 'nb-river-words', null, [
      h('p', 'nb-river-today', null, [caps('Today'), sky, h('span', null, null, [`${WEATHER_WORDS[view.weather]}. `]), h('span', null, null, [LEVEL_WORDS[river.level], h('span', 'nb-river-trend', null, [`, ${TREND_WORDS[river.trend]}`])])]),
      h('p', 'nb-river-tomorrow', null, [caps('Tomorrow'), river.tomorrow === river.level ? `${LEVEL_WORDS[river.tomorrow]}, much the same` : LEVEL_WORDS[river.tomorrow]]),
    ]);
    const row = h('section', `nb-river${river.shifted ? ' is-shifted' : ''}`, { 'aria-label': 'The river today' }, [drawing, words]);
    // The overnight report's sentence wins; otherwise the river's own line on a morning it changed.
    const sentence = view.morning?.river ?? (river.shifted ? river.line : null);
    if (sentence) row.append(h('p', 'nb-river-line', null, [sentence]));
    return row;
  }

  private renderBoard(view: AdventureView, scrollToCamp: boolean): void {
    if (this.making) {
      this.makeSlot.replaceChildren(
        makeList(view, {
          place: (kind) => this.command({ type: 'place', kind }),
          craft: (equipment) => {
            this.actions.cue('click');
            this.command({ type: 'craft', equipment });
          },
          refuse: () => this.actions.cue('refuse'),
          recover: (id) => { this.command({ type: 'recover-building', id }); this.render(); },
          work: (person) => {
            const worker = view.friends.find((f) => f.id === person);
            this.command({ type: worker?.status === 'building' ? 'cancel-plan' : 'rest', person });
            this.actions.cue('token-place');
          },
        }),
      );
    } else {
      this.makeSlot.replaceChildren();
    }
    const camp = campPoint(view);
    const chances = this.chancesFor(view);
    // The first mornings, before anything is planned: the first place worth a look breathes a soft ring, saying "tap me".
    const invite = firstMorning(view) && chances ? bestPlace(chances)
      : earlyMorning(view) && !this.sel.place && !this.sel.person && !this.making ? suggestedOutings(view).find((s) => s.purpose !== 'move-camp')?.place ?? null : null;
    const key =
      boardKey(view, this.detourFor ? this.detourStop?.place ?? null : this.sel.place) +
      (camp ? `${camp.x},${camp.y}` : '') +
      `|${this.editingPerson ?? ''}|${this.sel.second?.place ?? ''}|${this.sel.second?.activity ?? ''}|${this.pickingSecond}|${this.sel.person ?? ''}|${this.selectedLodging ?? ''}|${invite ?? ''}|${chances ? [...chances.values()].map((c) => c.pips).join('') : ''}|${view.phase}`;
    if (key !== this.boardKey) {
      this.boardKey = key;
      const scroll = this.board.el.scrollTop;
      this.board.render(view, {
        // By day the board shows where everyone is, as the river map does.
        mode: view.phase === 'morning' ? 'leaf' : 'atlas',
        selectedPlace: this.detourFor ? this.detourStop?.place ?? null : this.sel.place,
        selectedSecond: this.sel.second,
        detourPreview: this.detourFor && this.detourStop ? { person: this.detourFor, stop: this.detourStop } : null,
        pickingSecond: this.pickingSecond,
        // Second stops are offered on the place page, never floating over the map.
        editingPerson: this.editingPerson,
        selectedPerson: this.sel.person,
        selectedLodging: this.selectedLodging,
        camp,
        unfold: null,
        opened: placeIds(view, view.morning?.opened),
        expiring: placeIds(view, view.morning?.expiring),
        chances: chances ?? undefined,
        invite,
      });
      this.board.el.scrollTop = scroll;
      this.renderStepper(view);
    }
    if (scrollToCamp && camp && !this.sel.place) {
      // Each time Today opens the map comes back to rest on home and the places worth a look.
      // Home and the places known around it, framed together; if they cannot all fit, home and the places worth a look.
      const homeRegion = view.friends[0]?.base ?? view.region;
      const suggested = suggestedOutings(view).map((s) => view.places.find((p) => p.id === s.place)?.at).filter((at): at is { x: number; y: number } => !!at && (view.canTravel || Math.abs(at.y - camp.y) < 1400));
      const known = view.places.filter((p) => p.region === homeRegion && Math.abs(p.at.y - camp.y) < 1600).map((p) => p.at);
      requestAnimationFrame(() => this.board.frame([camp, ...known, ...suggested], [camp, ...suggested]));
    }
    if (this.revealJourney && view.canTravel && !this.sel.place) {
      const destination = view.places.find(place => place.kind === 'settlement' && place.region === view.region + 1);
      if (destination) {
        this.revealJourney = false;
        requestAnimationFrame(() => this.board.reveal(destination.at, true, .64));
      }
    }
  }

  /** Region names over the board's top-right corner, once the map is longer than one reach. */
  private renderStepper(view: AdventureView): void {
    this.stepper.replaceChildren();
    this.stepper.classList.toggle('has-regions', reach(view) > 0);
    if (reach(view) === 0) return;
    for (let i = 0; i <= reach(view); i++) {
      const b = wordButton(view.chart.regions[i].name, () => this.board.scrollToRegion(i), 'nb-step', `step-${i}`);
      if (i === this.regionInView) b.setAttribute('aria-current', 'true');
      this.stepper.append(b);
    }
  }

  /**
   * The picked-up friend's chance at every open place, for the pips on the
   * board: what they would most likely do there, with nothing else added.
   */
  private chancesFor(view: AdventureView): Map<string, { chance: Chance; pips: number }> | null {
    const friend = view.friends.find((f) => f.id === this.sel.person);
    if (!friend || view.phase !== 'morning') return null;
    const out = new Map<string, { chance: Chance; pips: number }>();
    if (this.detourFor === friend.id) {
      for (const place of view.places) {
        if (place.state === 'closed' || place.kind === 'settlement' || place.region !== view.region || !place.activities.length) continue;
        const f = view.detour(friend.id, { place: place.id, activity: defaultActivity(friend, place) });
        if (!f.problem) out.set(place.id, { chance: f.chance, pips: f.pips });
      }
      return out;
    }
    for (const place of view.places) {
      if (place.state === 'closed' || place.kind === 'settlement' || place.region !== friend.base) continue;
      const first = this.pickingSecond && this.sel.place ? view.places.find(p => p.id === this.sel.place) : null;
      const f = view.forecast(first
        ? { ...planFor(friend, first, this.sel), second: { place: place.id, activity: defaultActivity(friend, place) } }
        : { person: friend.id, place: place.id, activity: defaultActivity(friend, place), item: null, companion: null });
      if (!f.problem) out.set(place.id, { chance: f.chance, pips: f.pips });
    }
    return out;
  }

  private markStepper(index: number): void {
    this.regionInView = index;
    this.stepper.querySelectorAll('.nb-step').forEach((b, i) => {
      if (i === index) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
  }

  /**
   * The slip beside the place in hand (or the one the mouse rests on): what it
   * is, the held friend's chance there, and Send. The map stays in view.
   */
  private renderCard(view: AdventureView): void {
    view = this.planningView(view);
    const selectedPerson = view.friends.find((f) => f.id === this.sel.person);
    const stopping = view.friends.find((f) => f.id === this.detourFor);
    if (stopping && view.plans.some(plan => plan.person === stopping.id && plan.moving)) {
      this.right.classList.add('has-card');
      const place = view.places.find((p) => p.id === this.detourStop?.place);
      const handlers: DetourHandlers = {
        choose: (stop) => { this.detourStop = stop; this.planError = null; this.actions.cue('click'); this.render(); },
        activity: (activity) => { if (this.detourStop) this.detourStop = { ...this.detourStop, activity }; this.planError = null; this.actions.cue('click'); this.render(); },
        confirm: () => this.confirmDetour(),
        others: () => { this.detourStop = null; this.planError = null; this.actions.cue('click'); this.render(); },
        close: () => this.putCardAway(true),
        problem: this.planError,
      };
      this.card.replaceChildren(place && this.detourStop ? detourSlip(view, stopping, place, this.detourStop, handlers) : detourList(view, stopping, handlers));
      return;
    }
    if (view.phase === 'morning' && selectedPerson && selectedPerson.status !== 'home') {
      const plan = view.plans.find((p) => p.person === selectedPerson.id || p.companion === selectedPerson.id);
      const destination = view.lodgings.find((l) => l.id === plan?.lodging)?.name ?? view.places.find((p) => p.id === plan?.place)?.name;
      const close = wordButton('×', () => this.putCardAway(true), 'nb-slip-close'); close.setAttribute('aria-label', 'Back to suggested places');
      this.right.classList.add('has-card');
      this.card.replaceChildren(h('section', 'nb-base-options nb-confirmed-plan', null, [close, friendToken(selectedPerson, 42),
        h('h3', 'nb-slip-name', null, [selectedPerson.name]),
        h('p', null, null, [destination ? `✓ ${plan?.detour ? `${ACTIVITY_WORDS[plan.detour.activity]} at ${view.places.find((p) => p.id === plan.detour!.place)?.name ?? plan.detour.place}, then ` : `${ACTIVITY_WORDS[plan!.activity]} · `}${destination}${plan?.second ? ` → ${view.places.find((p) => p.id === plan.second!.place)?.name ?? plan.second.place}` : ''}${plan?.overnight ? ' · staying overnight' : ''}` : selectedPerson.statusLine]),
        h('p', 'nb-base-hint', null, [`Home: ${selectedPerson.baseName}`]),
        plan?.moving ? this.wayDownRow(view, selectedPerson.id, true) : null,
        plan && !plan.moving && !plan.second && mapStopHints(view, plan.person).size
          ? wordButton('Add stop', () => { this.pickingSecond = true; this.takeBack(plan.person); }, 'nb-quiet', 'add-plan-stop') : null,
        wordButton('Change plan', () => this.takeBack(selectedPerson.id), 'nb-quiet', 'change-plan'),
      ]));
      return;
    }
    const lodging = view.lodgings.find((l) => l.id === this.selectedLodging);
    if (lodging) {
      this.right.classList.add('has-card');
      const people = view.friends.filter((f) => f.status === 'home' && f.base === lodging.region && f.lodging !== lodging.id);
      const person = people.find((f) => f.id === this.sel.person) ?? people[0];
      const chooser = personChoices(people, person?.id ?? null, undefined, (id) => { if (id !== this.sel.person) this.pickPerson(id, true); });
      const town = view.places.find((place) => place.kind === 'settlement' && place.region === lodging.region);
      const problem = person && town ? view.forecast({ person: person.id, place: town.id, activity: 'visit', item: null, companion: null, lodging: lodging.id }).problem : null;
      const move = person ? stampButton(`Move ${person.name} here · E`, () => problem ? this.actions.cue('refuse') : this.stay(person.id, lodging.id), 'move-camp') : null;
      if (move) { move.disabled = !!problem; move.classList.toggle('is-ready', !problem); }
      const close = wordButton('×', () => this.putCardAway(true), 'nb-slip-close'); close.setAttribute('aria-label', 'Close shelter');
      this.card.replaceChildren(h('section', 'nb-slip', null, [close, h('header', 'nb-slip-head', null, [h('h3', 'nb-slip-name', null, [lodging.name]), h('p', 'nb-slip-known', null, ['An overnight base · moving uses today'])]),
        h('div', 'nb-slip-body', null, [chooser, problem || this.planError ? h('p', 'nb-problem', { role: 'status' }, [problem ?? this.planError!]) : null]),
        person && view.phase === 'morning' ? h('footer', 'nb-slip-go', null, [move]) : h('p', 'nb-slip-note', null, ['Choose someone to move here in the morning.']),
      ]));
      return;
    }
    const id = this.sel.place;
    const place = view.places.find((p) => p.id === id);
    this.right.classList.toggle('has-card', !!place);
    if (!place) {
      const person = view.friends.find((f) => f.id === this.sel.person);
      if (!person) { this.card.replaceChildren(); return; }
      const close = wordButton('×', () => this.putCardAway(true), 'nb-slip-close', 'slip-close'); close.setAttribute('aria-label', 'Back to suggested places');
      const options = h('div', 'nb-base-options', null, [close, h('p', 'nb-plan-prompt', null, [`${person.name} sleeps in ${person.baseName}. Choose a place on the map, or stay here today.`])]);
      if (person && view.phase === 'morning') {
        options.append(wordButton('Stay at camp · R', () => this.rest(person.id), 'nb-quiet'));
        for (const project of view.structures.filter(s => s.status === 'building' && s.builders?.includes(person.id))) {
          options.append(wordButton(`Build · ${project.name}`, () => { this.command({ type: 'rest', person: person.id }); this.putCardAway(true); }, 'nb-quiet'));
        }
        for (const lodging of view.lodgings.filter((l) => l.region === person.base && l.id !== person.lodging)) {
          options.append(wordButton(`Move to ${lodging.name}`, () => this.stay(person.id, lodging.id), 'nb-quiet'));
        }
        if (person.lodging !== undefined) {
          const town = view.places.find((p) => p.kind === 'settlement' && p.region === person.base);
          if (town) options.append(wordButton(`Move back to ${town.name}`, () => this.send({ person: person.id, place: town.id, activity: 'visit', item: null, companion: null }), 'nb-quiet'));
        }
        if (view.lodgings.some((l) => l.region === person.base)) options.append(h('p', 'nb-base-hint', null, ['Moving takes today. Tomorrow’s walks start at the new base.']));
      }
      this.card.replaceChildren(options);
      return;
    }
    const readOnly = view.phase !== 'morning';
    this.card.replaceChildren(
      placeSlip(view, place, this.sel, readOnly, {
        moveEveryone: (place) => this.moveEveryone(place),
        everyone: (enabled) => { this.sel.everyone = enabled; this.render(); },
        addPlannedStop: hint => this.previewMapStop(hint),
        sendFriend: (person) => { if (person !== this.sel.person) this.pickPerson(person, true); },
        activity: (a: Activity) => {
          this.sel.activity = a;
          if (!this.personPinned) this.sel.person = recommendPeople(view, place, a)[0]?.id ?? null;
          this.actions.cue('click');
          this.render();
        },
        item: (e: Equipment | null) => {
          this.sel.item = e;
          this.actions.cue('click');
          this.render();
        },
        companion: (id: string | null) => {
          this.sel.companion = id;
          this.actions.cue('click');
          this.render();
        },
        send: (plan: OutingPlan) => this.send(plan),
        rest: (person: string) => this.rest(person),
        close: () => this.putCardAway(true),
        refuse: () => this.actions.cue('refuse'),
        base: () => { this.sel.place = null; this.render(); },
        stay: (person, id) => this.stay(person, id),
        second: () => { this.pickingSecond = !this.pickingSecond; this.planError = null; this.actions.cue('click'); this.render(); },
        secondActivity: activity => { if (this.sel.second) this.sel.second.activity = activity; this.planError = null; this.actions.cue('click'); this.render(); },
        removeSecond: () => { delete this.sel.second; this.pickingSecond = false; this.render(); },
        pickingSecond: this.pickingSecond,
        addingStop: !!this.sel.second && !!this.editingPerson && !view.plans.find(p => p.person === this.editingPerson)?.second,
        updatingStop: !!this.sel.second && !!this.editingPerson && !!view.plans.find(p => p.person === this.editingPerson)?.second,
        overnight: (place) => { this.sel.overnight = place; if (!place) this.sel.everyone = false; this.render(); },
        problem: this.planError,
        peopleOnShelf: true,
        detailsOpen: this.detailsOpen,
        details: (open) => { this.detailsOpen = open; },
      }),
    );
  }

  /** The mouse resting on a place shows its slip; leaving brings back the one in hand. */
  private hover(_id: string | null): void {
    // A location opens only when selected; pointer movement never moves a menu.
  }

  /** Only an explicit suggestion click recentres the map; assigning people keeps it still. */
  focusPlace(id: string, person?: string, activity?: Activity): void {
    if (id === 'mio' && !person && !activity && this.view?.region === 1 && !this.view.departure?.prepared && this.view.journal.some(e => e.id === 'aki-meeting' && e.found)) { this.showMake(); return; }
    const place = this.view?.places.find((p) => p.id === id);
    if (!place) return;
    this.making = false;
    if (place.rumour) activity = 'explore';
    else activity ??= clueActivity(this.view!, place);
    this.personPinned = false;
    this.considerPlace(id, true);
    if (person || activity) {
      this.sel.person = person ?? recommendPeople(this.view!, place, activity)[0]?.id ?? this.sel.person;
      if (activity) this.sel.activity = activity;
      this.sel.item = null; this.sel.companion = null;
      this.render();
    }
    requestAnimationFrame(() => { this.board.centreOn(place.at); this.board.focusPlace(id); });
  }

  /** Tapping a place opens its advice; Send confirms the proposed plan. */
  private tapPlace(id: string, _pointer: string): void {
    if (this.dragged || !this.view?.places.some((p) => p.id === id)) return;
    if (this.detourFor && this.view.plans.some(plan => plan.person === this.detourFor && plan.moving)) {
      const friend = this.view.friends.find((f) => f.id === this.detourFor);
      const place = this.view.places.find((p) => p.id === id)!;
      if (friend && place.kind !== 'settlement' && place.region === this.view.region && place.activities.length) {
        this.detourStop = { place: id, activity: defaultActivity(friend, place) };
        this.planError = null;
        this.actions.cue('click');
        this.render();
        return;
      }
      this.detourFor = null; this.detourStop = null;
    }
    if (this.pickingSecond && this.sel.place && this.sel.person) {
      const view = this.planningView(this.view);
      const person = view.friends.find(p => p.id === this.sel.person);
      const first = view.places.find(p => p.id === this.sel.place);
      const place = view.places.find(p => p.id === id);
      if (!person || !first || !place) return;
      const second = { place: id, activity: defaultActivity(person, place) };
      const problem = view.forecast({ ...planFor(person, first, this.sel), second }).problem;
      if (problem) {
        this.planError = problem; this.actions.cue('refuse'); this.render(); return;
      }
      this.sel.second = second;
      this.planError = null; this.pickingSecond = false;
      this.actions.cue('token-place'); this.render(); return;
    }
    const fromBuild = this.making;
    this.making = false;
    this.considerPlace(id, fromBuild);
  }

  /**
   * Friends' tokens can be carried: picked up from the shelf (or from the
   * place they are going to) and dropped on a place. While carried, every
   * place they could go shows their chance; dropped off the map, a planned
   * friend is called back to the fire.
   */
  private listenForDrags(): void {
    this.left.addEventListener('pointerdown', (e) => {
      if (this.view?.phase !== 'morning' || e.button !== 0 || e.pointerType === 'touch') return;
      const el = (e.target as Element).closest<HTMLElement>('.nb-camper.is-waiting, .nb-camper.is-planned, .nb-board-token');
      const person = el?.dataset.k?.replace(/^(camp|token)-/, '');
      if (!el || !person) return;
      this.drag = { person, from: el.classList.contains('nb-board-token') ? 'board' : 'shelf', x: e.clientX, y: e.clientY, id: e.pointerId, ghost: null, held: this.sel.person };
    });
    window.addEventListener('pointermove', (e) => {
      const drag = this.drag;
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.ghost) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < DRAG_START) return;
        this.beginCarry(drag);
      }
      if (drag.ghost) drag.ghost.style.transform = `translate(${e.clientX - 22}px, ${e.clientY - 22}px)`;
      this.board.markDropTarget(this.board.placeAt(e.clientX, e.clientY));
      e.preventDefault();
    });
    const end = (e: PointerEvent): void => {
      const drag = this.drag;
      if (!drag || e.pointerId !== drag.id) return;
      this.drag = null;
      if (!drag.ghost) return;
      drag.ghost.remove();
      this.board.markDropTarget(null);
      this.left.classList.remove('is-carrying');
      this.dragged = true;
      window.setTimeout(() => (this.dragged = false), 0);
      this.drop(drag.person, drag.from, e.type === 'pointerup' ? this.board.placeAt(e.clientX, e.clientY) : null, drag.held);
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  /** The token leaves the shelf: a ghost follows the pointer, and the map shows this friend's chances. */
  private beginCarry(drag: NonNullable<Today['drag']>): void {
    const view = this.view;
    const friend = view?.friends.find((f) => f.id === drag.person);
    if (!view || !friend) return;
    const ghost = friendToken(friend, 44, 'nb-carried');
    drag.ghost = ghost;
    // Inside the notebook (so its styles apply), on no transformed layer (so `fixed` means the screen).
    (this.right.closest('.nb') ?? document.body).append(ghost);
    this.left.classList.add('is-carrying');
    this.actions.cue('token-lift');
    this.sel.person = drag.person;
    this.sel.place = null;
    
    this.render();
  }

  /** The token is set down: on a place, the friend goes there; off the map, a planned friend comes home. */
  private drop(person: string, from: 'shelf' | 'board', placeId: string | null, held: string | null): void {
    const view = this.view;
    const friend = view?.friends.find((f) => f.id === person);
    const place = view?.places.find((p) => p.id === placeId);
    if (!view || !friend) return;
    // Home recalls a plan; another village opens an individual move without discarding it.
    if (place?.kind === 'settlement') {
      if (friend.base !== place.region || friend.lodging !== undefined) {
        this.sel.person = person; this.personPinned = true;
        this.editingPerson = friend.status === 'planned' ? person : null;
        this.considerPlace(place.id, true);
        // Dropping someone on another village is a clear wish to move them there.
        this.sel.overnight = place.id; this.sel.everyone = false; this.render();
        return;
      }
      if (friend.status === 'planned') {
        this.command({ type: 'cancel-plan', person });
        this.actions.cue('token-place');
      }
      this.sel.person = held;
      this.render();
      return;
    }
    if (place && place.state !== 'closed' && place.activities.length) {
      const plan = planFor(friend, place, null);
      const problem = view.forecast(plan).problem;
      if (problem) {
        this.planError = problem;
        this.sel = { person, place: place.id, activity: plan.activity, item: null, companion: null };
        this.editingPerson = friend.status === 'planned' ? person : null;
        this.personPinned = true;
        this.actions.cue('refuse');
        this.render();
        return;
      }
      this.send(plan);
      return;
    }
    if (place) this.actions.cue('refuse');
    if (from === 'board' && !place) {
      this.command({ type: 'cancel-plan', person });
      this.actions.cue('token-place');
    }
    this.sel.person = held;
    this.render();
  }

  private renderFoot(view: AdventureView): void {
    const key = JSON.stringify([this.viewKey, this.making, !!this.sel.person, !!this.sel.place, this.selectedLodging]);
    if (key === this.footerKey) return;
    this.footerKey = key;
    if (view.phase !== 'morning') {
      // By day the foot only says what the day is doing.
      this.foot.replaceChildren(h('p', 'nb-begin-note is-day', null, [view.nextStep]));
      return;
    }
    const waiting = view.friends.filter((f) => f.status === 'home');
    const ready = morningStatus(view)?.ready ?? false;
    if (view.canSail && !ready) {
      this.foot.replaceChildren();
      return;
    }

    const reviewing = this.making || !!(this.sel.person && (this.sel.place || this.selectedLodging !== null));
    const begin = stampButton(
      reviewing ? 'Begin the day' : 'Begin the day · E',
      () => this.beginDay(),
      'begin',
    );
    // The slip owns the primary action while editing; committed plans remain ready to begin.
    begin.classList.toggle('is-ready', ready && !reviewing);
    begin.setAttribute('aria-disabled', String(!ready));
    const status = ready
      ? h('p', 'nb-begin-note is-ready', null, [waiting.length ? view.structures.some(site => site.status === 'building' && site.builders?.some(id => waiting.some(friend => friend.id === id))) ? 'Unassigned companions will help with the building.' : `${listNames(waiting.map((f) => f.name))} ${waiting.length === 1 ? 'stays' : 'stay'} home.` : 'Ready for the day.'])
      : h('p', 'nb-begin-note', { id: 'nb-begin-note' }, [earlyMorning(view) ? 'Tap a place’s name on the map to plan an outing.' : 'Choose one outing, or a day at camp.']);
    if (!ready) begin.setAttribute('aria-describedby', 'nb-begin-note');
    // The words sit in their own span so a narrow phone can show the curls alone (labels stay for screen readers).
    const curl = (mirror: boolean): SVGElement => {
      const svg = svgEl('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
      if (mirror) svg.style.transform = 'scaleX(-1)';
      svg.append(svgEl('path', { d: 'M8 5 3.5 9.5 8 14M4 9.5h9c8 0 8 11 0 11h-2' }));
      return svg;
    };
    const undo = wordButton('', () => this.undoPlan(), 'nb-plan-undo', 'undo-plan');
    undo.replaceChildren(curl(false), h('span', 'nb-undo-word', null, ['Undo']));
    undo.setAttribute('aria-label', 'Undo last plan change');
    undo.title = 'Undo last plan change';
    undo.disabled = !view.canUndoPlan;
    const redo = view.canRedoPlan ? wordButton('', () => this.undoPlan(true), 'nb-plan-undo', 'redo-plan') : null;
    redo?.replaceChildren(h('span', 'nb-undo-word', null, ['Redo']), curl(true));
    redo?.setAttribute('aria-label', 'Redo last plan change');
    if (redo) redo.title = 'Redo last plan change';
    this.foot.replaceChildren(h('div', 'nb-begin-status', null, [h('div', 'nb-begin-heading', null, [h('span', 'nb-day-not-started', null, ['Day not started']), undo, redo]), status]), begin);
  }

  private undoPlan(redo = false): void {
    const answer = this.command({ type: redo ? 'redo-plan' : 'undo-plan' });
    if (answer && !answer.ok) { this.actions.cue('refuse'); return; }
    this.putCardAway(false);
    this.actions.cue('token-lift');
    this.render();
  }

  /** Only this card treats the edited traveller as available; the map keeps their saved route. */
  private planningView(view: AdventureView): AdventureView {
    if (!this.editingPerson || view.phase !== 'morning') return view;
    const plan = view.plans.find((p) => p.person === this.editingPerson);
    return { ...view, friends: view.friends.map((friend) => friend.id === this.editingPerson || friend.id === plan?.companion
      ? { ...friend, status: 'home' as const } : friend) };
  }

  /** Pointer and keyboard use the same departure guard. */
  private beginDay(): void {
    const view = this.view;
    if (!view || view.phase !== 'morning') return;
    if (!morningStatus(view)?.ready) {
      this.actions.cue('refuse');
      this.nudgeWaiting();
      return;
    }
    this.actions.cue('click');
    this.command({ type: 'begin' });
  }

  /** A pressed but unready "Begin" gives the waiting friends a small lift, to say who is holding the day. */
  private nudgeWaiting(): void {
    this.left.querySelectorAll<HTMLElement>('.nb-camper.is-waiting').forEach((el) => {
      el.classList.remove('is-nudged');
      void el.offsetWidth;
      el.classList.add('is-nudged');
    });
  }

  private pickPerson(id: string, keepActivity = false): void {
    if (id !== this.editingPerson) this.editingPerson = null;
    this.planError = null;
    this.newsOpen = false;
    this.personPinned = true;
    this.sel.everyone = false;
    if (this.sel.person === id && !this.sel.place) {
      this.sel.person = null;
      this.actions.cue('token-place');
    } else {
      this.sel.person = id;
      if (!keepActivity && !this.sel.place) this.sel.activity = null;
      this.sel.item = null;
      this.sel.companion = null;
      this.actions.cue('token-lift');
    }
    this.making = false;
    this.tellGame();
    this.render();
  }

  /** Return to suggestions after confirmation, preserving the map's position. */
  private suggestNext(_settled: string[]): void {
    this.pickingSecond = false;
    this.editingPerson = null;
    this.sel = { person: null, place: null, activity: null, item: null, companion: null };
    this.selectedLodging = null;
    this.personPinned = false;
    this.tellGame();
  }

  private considerPlace(id: string, keep = false): void {
    this.pickingSecond = false; delete this.sel.second;
    this.planError = null;
    this.newsOpen = false;
    this.selectedLodging = null;
    if (this.sel.place === id && !keep) {
      this.sel.place = null;
    } else {
      this.detailsOpen = false;
      this.sel.place = id;
      this.sel.overnight = undefined;
      this.sel.everyone = false;
      this.sel.item = null;
      this.sel.companion = null;
      const place = this.view?.places.find((p) => p.id === id);
      this.sel.activity = place && this.view ? clueActivity(this.view, place) ?? null : null;
      if (place && !this.personPinned) this.sel.person = recommendPeople(this.view!, place, this.sel.activity)[0]?.id ?? null;
      // Moving camp is the default only where the story is heading (the move-camp
      // suggestion, or the goal naming this town); otherwise a village is a visit,
      // and staying the night is one tick away on the slip.
      const storyMove = !!place && !!this.view && (
        this.view.mode === 'journey' && (suggestedOutings(this.view).some((s) => s.purpose === 'move-camp' && s.place === place.id) || this.view.goal.includes(place.name))
        // Coming home from a hut to this village is a move too.
        || this.view.friends.some((f) => f.base === place.region && f.lodging !== undefined));
      if (place?.kind === 'settlement' && storyMove && this.view?.friends.some((f) => f.base !== place.region || f.lodging !== undefined)) {
        this.sel.overnight = place.id;
        this.sel.everyone = !this.personPinned && this.view.friends.length > 1;
      }
    }
    this.actions.cue('click');
    this.tellGame();
    this.render();
  }

  /** Looking at a confirmed plan never cancels it. Editing is an explicit action. */
  private inspectPerson(id: string): void {
    if (!this.view) return;
    if (this.view.phase !== 'morning') { this.follow(id); return; }
    if (this.view.friends.find((f) => f.id === id)?.status === 'home') { this.pickPerson(id); return; }
    this.editingPerson = null;
    this.detourFor = null; this.detourStop = null;
    this.sel = { person: id, place: null, activity: null, item: null, companion: null };
    this.selectedLodging = null;
    this.making = false;
    this.tellGame();
    this.render();
  }

  /** Open a replacement proposal without removing the confirmed plan. */
  private takeBack(id: string, second?: SecondStop): void {
    const view = this.view;
    if (!view) return;
    this.personPinned = true;
    this.detourFor = null; this.detourStop = null;
    const plan = view.plans.find((p) => p.person === id || p.companion === id);
    id = plan?.person ?? id;
    this.editingPerson = id;
    this.sel = {
      person: id,
      place: typeof plan?.lodging === 'string' ? plan.lodging : plan?.place ?? this.sel.place,
      activity: plan?.activity ?? null,
      item: plan?.item ?? null,
      companion: plan?.companion ?? null,
      overnight: plan?.overnight ?? (plan && !plan.visitOnly && plan.lodging === undefined && view.places.some((place) => place.id === plan.place && place.kind === 'settlement') ? plan.place : undefined),
      second: second ? { ...second } : plan?.second ? { ...plan.second } : undefined,
    };
    this.selectedLodging = plan?.lodging ?? null;
    this.actions.cue('token-lift');
    this.tellGame();
    this.render();
  }

  /** A friend's line on the moving morning: a quiet way to add a stop on the way, or the stop and a way to take it off. */
  private wayDownRow(view: AdventureView, id: string, inCard = false): HTMLElement {
    const person = view.friends.find((f) => f.id === id)!;
    const stop = view.plans.find((p) => p.person === id)?.detour;
    const name = inCard ? '' : `${person.name} · `;
    if (!stop) {
      const add = wordButton(`${name}Stop on the way`, () => this.openDetour(id), 'nb-quiet', `detour-add-${id}`);
      if (!inCard) add.prepend(friendToken(person, 24));
      return add;
    }
    const place = view.places.find((p) => p.id === stop.place)?.name ?? stop.place;
    const change = wordButton(`${name}${ACTIVITY_WORDS[stop.activity]} at ${place}`, () => this.openDetour(id), 'nb-quiet', `detour-change-${id}`);
    if (!inCard) change.prepend(friendToken(person, 24));
    const remove = wordButton('×', () => this.removeDetour(id), 'nb-quiet nb-detour-remove', `detour-remove-${id}`);
    remove.setAttribute('aria-label', `No stop for ${person.name}: straight down with everyone`);
    return h('div', 'nb-detour-row', null, [change, remove]);
  }

  private openDetour(person: string, stop?: SecondStop): void {
    const plan = this.view?.plans.find((p) => p.person === person);
    this.making = false;
    this.editingPerson = null;
    this.selectedLodging = null;
    this.planError = null;
    this.detourFor = person;
    this.detourStop = stop ? { ...stop } : plan?.detour ? { ...plan.detour } : null;
    this.sel = { person, place: null, activity: null, item: null, companion: null };
    this.actions.cue('click');
    this.tellGame();
    this.render();
  }

  /** A map hint opens a review; the original confirmed trip survives until Send. */
  private previewMapStop(hint: StopHint): void {
    if (!this.view) return;
    const available = plannedStopsAt(this.view, hint.stop.place).some(choice => choice.person === hint.person && choice.moving === hint.moving);
    if (!available) { this.actions.cue('refuse'); return; }
    if (hint.moving) this.openDetour(hint.person, hint.stop);
    else this.takeBack(hint.person, hint.stop);
  }

  private confirmDetour(): void {
    if (!this.detourFor || !this.detourStop) return;
    const answer = this.command({ type: 'detour', person: this.detourFor, stop: this.detourStop });
    if (answer && !answer.ok) { this.planError = answer.reason; this.render(); return; }
    this.putCardAway(false);
    this.render();
  }

  private removeDetour(person: string): void {
    this.command({ type: 'detour', person, stop: null });
    if (this.detourFor === person) this.putCardAway(false);
    this.render();
  }

  private moveEveryone(place: string): void {
    const answer = this.command({ type: 'move-everyone', place });
    if (answer && !answer.ok) { this.planError = answer.reason; this.render(); return; }
    this.planError = null;
    this.suggestNext(this.view?.friends.map((person) => person.id) ?? []);
    this.actions.cue('token-place'); this.render();
  }

  private send(plan: OutingPlan): void {
    const answer = this.command({ type: 'assign', plan });
    if (answer && !answer.ok) { this.planError = answer.reason; this.render(); return; }
    this.planError = null;
    this.actions.cue('token-place');
    this.suggestNext([plan.person, ...(plan.companion ? [plan.companion] : [])]);
    this.render();
  }

  private rest(id: string): void {
    this.command({ type: 'rest', person: id });
    this.actions.cue('token-place');
    this.suggestNext([id]);
    this.render();
  }

  private stay(person: string, lodging: number | string): void {
    const answer = this.command({ type: 'camp', person, shelter: lodging });
    if (answer && !answer.ok) { this.planError = answer.reason; this.render(); return; }
    this.planError = null;
    this.suggestNext([person]); this.render();
  }

  private sail(view: AdventureView): void {
    const companions = view.friends.filter((f) => this.sailing.has(f.id)).map((f) => f.id);
    this.actions.cue('click');
    const answer = this.command({ type: 'sail', companions });
    if (answer && !answer.ok) { this.planError = answer.reason; this.render(); }
  }

  private putCardAway(render: boolean): void {
    this.planError = null;
    this.pickingSecond = false;
    this.detourFor = null;
    this.detourStop = null;
    this.selectedLodging = null;
    this.personPinned = false;
    this.editingPerson = null;
    const place = this.view?.places.find((p) => p.id === this.sel.place);
    if (place) this.memory.markRead(place);
    this.sel = { person: null, place: null, activity: null, item: null, companion: null };
    this.tellGame();
    if (render) {
      this.actions.cue('click');
      this.render();
    }
  }

  /** Lets the valley mark the friend picked up and the place under consideration. */
  private tellGame(): void {
    this.told = { key: `${this.sel.person ?? ''}|${this.sel.place ?? ''}`, at: performance.now() };
    this.command({ type: 'notebook', page: 'plan', person: this.sel.person ?? undefined, place: this.sel.place ?? undefined });
  }

  private command(c: AdventureCommand): ReturnType<UiActions['expedition']> {
    return this.actions.expedition(c);
  }

  scrollMap(dy: number): void { this.board.el.scrollBy({ top: dy, behavior: 'auto' }); }

  handleAction(key: string): boolean {
    if (!this.active || this.view?.phase !== 'morning' || this.making) return false;
    if (/^[1-6]$/.test(key)) {
      const person = this.view.friends[Number(key) - 1];
      if (!person) return true;
      if (person.status === 'home') { if (this.sel.person !== person.id || this.sel.everyone) this.pickPerson(person.id, true); }
      else this.inspectPerson(person.id);
      return true;
    }
    const friend = this.view.friends.find((f) => f.id === this.sel.person && (f.status === 'home' || f.id === this.editingPerson));
    if (key === 'r' && friend) { this.rest(friend.id); return true; }
    if (key !== 'e') return false;
    if (this.detourFor && this.detourStop) { this.confirmDetour(); return true; }
    if (this.sel.everyone && this.sel.place) { this.moveEveryone(this.sel.place); return true; }
    if (friend && this.selectedLodging !== null) { this.stay(friend.id, this.selectedLodging); return true; }
    const place = this.view.places.find((p) => p.id === this.sel.place);
    if (friend && place) {
      if (this.pickingSecond) return true;
      const plan = planFor(friend, place, this.sel);
      if (!this.view.forecast(plan).problem) this.send(plan);
      else this.actions.cue('refuse');
      return true;
    }
    if (this.view.friends.some((f) => f.status !== 'home')) this.beginDay();
    else if (!friend) this.pickPerson(this.view.friends.find((f) => f.status === 'home')!.id);
    return true;
  }

  /** Escape puts the card or the make list away first; only then does it reach the book, which closes. */
  private onKey(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    if (this.pickingSecond) { e.stopPropagation(); this.pickingSecond = false; this.render(); return; }
    if (this.sel.person || this.sel.place) {
      e.stopPropagation();
      this.putCardAway(true);
    } else if (this.making) {
      e.stopPropagation();
      this.making = false;
      this.render();
    }
  }
}

/** Everything on Today's pages that can change, as a cheap comparison string. */
function viewKey(v: AdventureView): string {
  return JSON.stringify([
    v.day,
    v.phase,
    v.hour,
    v.nextStep,
    v.canUndoPlan, v.canRedoPlan,
    v.morning,
    v.river,
    v.provisions, v.materials,
    v.region,
    v.canSail,
    v.voyage,
    v.friends.map((f) => [f.id, f.base, f.status, f.statusLine, f.pack]),
    v.plans.map((p) => [p.person, p.place, p.lodging, p.overnight, p.second, p.detour, p.activity, p.item, p.companion, p.visitOnly]),
    v.places.map((p) => [p.id, p.rumour, p.state, p.stateLine, p.lead, p.leadDays, p.visits, p.learned.length, p.finds.map((f) => f.found)]),
    v.structures.map((s) => [s.id, s.status, s.problem, Math.round(s.progress * 20)]),
    v.equipment.map((e) => [e.id, e.owned, e.with]),
  ]);
}

/** What the board draws; the board is only rebuilt when this changes, so its scroll never jumps. */
function boardKey(v: AdventureView, selected: string | null): string {
  return JSON.stringify([
    selected,
    v.day, v.weather, v.provisions, v.materials,
    v.morning?.opened,
    v.morning?.expiring,
    v.region,
    v.friends.map((f) => [f.id, f.base, f.lodging, f.status]),
    v.plans.map((p) => [p.person, p.place, p.lodging, p.companion, p.second, p.detour, p.visitOnly]),
    v.lodgings.map((l) => [l.id, l.at]),
    v.structures.map((s) => [s.id, s.status, s.at]),
    v.sites?.map((s) => [s.id, s.at]),
    v.places.map((p) => [p.id, p.rumour, p.state, !!p.lead, p.visits === 0]),
  ]);
}

/** The morning everyone is planned to move camp: down the river, or to a village in this reach. */
function moveMorning(v: AdventureView): boolean {
  return v.phase === 'morning' && v.mode === 'journey' && v.plans.length > 0 && v.plans.every((p) => p.moving);
}

/** Supplies are a reason to go, but not a story: the slip carries the yield. */
function isSupply(purpose: string): boolean {
  return purpose === 'provisions' || purpose === 'materials';
}

/** How far a token must move before it counts as carried rather than tapped. */
const DRAG_START = 8;

/** Day one, before anyone has been sent or rested: the only time the book offers a nudge. */
function firstMorning(view: AdventureView): boolean {
  return view.day === 1 && view.phase === 'morning' && view.friends.every((f) => f.status === 'home');
}

/** The first mornings of a game, with nothing planned yet: the only time the map points at a place. */
function earlyMorning(view: AdventureView): boolean {
  return view.phase === 'morning' && view.day <= (view.mode === 'free' ? 1 : 2) && !view.plans.length && view.friends.every((f) => f.status === 'home');
}

/** The place with the best chance (the first such, in the order of the river). */
function bestPlace(chances: Map<string, { chance: Chance; pips: number }>): string | null {
  let best: string | null = null;
  let pips = -1;
  for (const [id, c] of chances) {
    const score = c.chance === 'certain' ? 4 : c.pips;
    if (score > pips) {
      best = id;
      pips = score;
    }
  }
  return best;
}

/** Supplies at a glance, with what the bundle will hold once today's making is paid for. */
function suppliesMark(view: AdventureView): HTMLElement {
  const el = h('p', 'nb-supplies-mark', { title: resourceWords(view) });
  el.innerHTML = `${resourceMark('provisions', 22)}<span>${view.provisions}</span>${resourceMark('materials', 22)}<span>${view.materials}</span>`;

  return el;
}

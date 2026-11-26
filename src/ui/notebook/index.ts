/**
 * The expedition notebook: the whole interface of the expedition game, and
 * the key menu of it. It follows the day's rhythm:
 *
 *   morning   the book opens by itself on Today; plan, then "Begin the day"
 *   day       the book closes; one bar at the foot holds the notebook, the
 *             group and the controls; tags appear in the valley
 *   evening   bundles are set down by the fire one at a time; then the book
 *             opens on the journal with tonight's finds, and the way to sleep
 *   night     everything steps aside except the season tab
 *
 * The book is the game's main interface (see `spread.ts`). See `contract.ts`
 * for how the game drives this.
 */

import type { AdventureCommand, AdventureView, NotebookPage, ScreenTag, StructureKind } from '../../game/adventure/model';
import { structureDef, structureLabel } from '../../game/adventure/structures';
import type { UiActions } from '../contract';
import { h } from '../dom';
import '../../styles/notebook.css';
import '../../styles/planning.css';
import '../../styles/day-loop.css';
import '../../styles/journey-polish.css';
import { BarState, Controls, MorningNotice, Sky, Tab } from './dayLine';
import { morningStatus } from './morning';
import { wordButton } from './ink';
import { LearnedMemory } from './placeCard';
import { Spread, type SpreadPage } from './spread';
import { Strip } from './strip';
import { TagLayer } from './tags';
import { Today } from './today';
import { reach } from './campPoint';
import { VoyageCaption } from './voyage';
import { EndingScreen } from './ending';

/** After the boat reaches the sea, the view holds on the water this long before the book opens. */
const SEA_HOLD_MS = 4000;

/** Wander opening: how long the valley (and the friends at home in it) shows before the book opens on Today. */
const WANDER_BEAT_MS = 2200;

/** How long the fireside must be still (everything down, nobody still walking home) before the journal opens. */

export class Notebook {
  readonly el = h('section', 'nb', { 'aria-label': 'River expedition' });
  private archiving = false;
  private readonly memory = new LearnedMemory();
  private readonly sky = new Sky();
  /** Where the sky marks sit when there is no season tab to hold them. */
  private readonly skySlip = h('div', 'nb-sky-slip');
  /** The one persistent slip: notebook, group and controls on a single line. */
  private readonly bar = h('div', 'nb-bar', { role: 'toolbar', 'aria-label': 'Notebook and day controls' });
  private readonly controls: Controls;
  private readonly barState: BarState;
  private readonly tab: Tab;
  private readonly morningNotice: MorningNotice;
  private clockObserver: ResizeObserver | null = null;
  private readonly today: Today;
  private readonly strip: Strip;
  private readonly tags: TagLayer;
  private readonly spread: Spread;
  private readonly placing = h('div', 'nb-placing', { role: 'status', 'aria-live': 'polite' });
  private readonly voyage: VoyageCaption;
  private readonly firesideSkip = wordButton('Skip to journal', () => this.actions.expedition({ type: 'skip' }), 'nb-quiet nb-scene-skip nb-fireside-skip');
  private endingTimer = 0;
  private readonly endingScreen: EndingScreen;
  private view: AdventureView | null = null;
  private phase: AdventureView['phase'] | null = null;
  private placingKey = '';
  private endingShown = false;
  /** True while the game is held for tonight's page. */
  private readonly bookListeners: Array<() => void> = [];
  /** Whether tonight's journal has been opened yet this evening, and since when it could have been. */
  private tonightShown = false;
  private morningTimer = 0;
  private pendingPlace: string | null = null;
  private closedForMorning = false;
  /** While Wander's first look at the valley lasts: the timer that then opens the book. */
  private beatTimer = 0;
  /** The interface has just come up for a game: its first snapshot decides whether Wander's first look plays. */
  private arriving = false;

  constructor(private readonly actions: UiActions) {
    const command = (c: AdventureCommand): void => { this.actions.expedition(c); };
    this.controls = new Controls(
      actions,
      () => this.cycleSpeed(),
      () => this.strip.skip(),
    );
    this.tab = new Tab(() => this.onTab());
    this.barState = new BarState();
    this.morningNotice = new MorningNotice(() => this.clockAction());
    this.today = new Today(actions, this.memory, (page) => page === 'almanac' ? this.spread.openAlmanac() : this.openBook(page));
    this.strip = new Strip(actions, command, (person) => { this.openBook('today'); if (person) this.today.consider(person); });
    this.tags = new TagLayer(actions, this.memory, {
      command,
      sendTo: (place) => {
        command({ type: 'inspect', place: null });
        this.openBook('today');
        this.today.consider(undefined, place);
      },
      tab: () => this.tab.centre(),
      reserved: () => this.reservedRects(),
    });
    this.voyage = new VoyageCaption(() => command({ type: 'skip' }));
    this.endingScreen = new EndingScreen(actions);
    this.spread = new Spread(actions, command, this.memory, this.today, () => {
      if (this.archiving) {
        if (!this.spread.opened) {
          this.archiving = false; this.spread.setArchive(false); this.el.classList.remove('is-archive'); this.visible(false);
        }
        return;
      }
      this.syncTab();
      if (!this.spread.opened && this.tonightShown && this.view?.phase === 'evening' && !this.morningTimer) { this.closedForMorning = true; this.sleep(); }
      for (const listener of this.bookListeners) listener();
    });
    this.bar.append(this.tab.el, this.strip.toggle, this.barState.provisions, this.controls.el);
    this.sky.mount(null, this.skySlip);
    this.el.append(
      this.tags.el,
      this.skySlip,
      this.morningNotice.el,
      this.strip.el,
      this.bar,
      this.placing,
      this.voyage.el,
      this.voyage.skip,
      this.voyage.cut,
      this.firesideSkip,
      this.spread.el,
      this.endingScreen.el,
    );
    document.addEventListener('keydown', (e) => this.onKey(e));
    // A pinned place card goes away on a tap anywhere else.
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (!this.tags.hasPlaceCard()) return;
        if ((e.target as Element | null)?.closest?.('.nb-tag.is-place')) return;
        command({ type: 'inspect', place: null });
      },
      true,
    );
  }

  /** True while the book is open or still opening or closing: nothing else may show over it. */
  bookBusy(): boolean {
    return this.spread.busy;
  }

  /** Listens for the book opening or closing (the interface holds its notes until it is closed). */
  onBookChange(listener: () => void): void {
    this.bookListeners.push(listener);
  }

  /** A line for Today's page: the season turning, a new year, someone arriving. */
  notice(text: string): void {
    this.today.addNotice(text);
  }

  /** Tucks the sky marks into the season tab (the clock's element), or takes them back with null. */
  attachClock(clock: HTMLElement | null): void {
    this.sky.mount(clock, this.skySlip);
    this.el.classList.toggle('has-clock', !!clock?.querySelector('.clock-head'));
    this.clockObserver?.disconnect();
    const tab = clock?.querySelector('.clock-tab');
    if (tab) {
      this.clockObserver = new ResizeObserver(() => this.el.style.setProperty('--morning-top', `${Math.max(60, Math.ceil(tab.getBoundingClientRect().bottom + 6))}px`));
      this.clockObserver.observe(tab);
    }
  }

  showArchive(view: AdventureView): void {
    this.archiving = true; this.el.classList.add('is-archive');
    this.visible(true); this.spread.setArchive(true);
    this.spread.update(view, false); this.spread.open('journal');
  }

  updateDaylight(progress: number, dt: number): void {
    this.sky.updateDaylight(progress, dt);
  }

  visible(on: boolean): void {
    if (on && !this.el.classList.contains('is-active')) this.arriving = true;
    this.el.classList.toggle('is-active', on);
    if (!on) this.spread.close();
    if (!on) { window.clearTimeout(this.beatTimer); this.beatTimer = 0; }
    if (!on) { window.clearTimeout(this.morningTimer); this.morningTimer = 0; this.pendingPlace = null; this.el.classList.remove('is-next-morning'); window.clearTimeout(this.endingTimer); this.endingScreen.hide(); this.endingShown = false; }
  }

  update(view: AdventureView): void {
    const first = !this.view;
    // A different game in the same book (a Journey, then Wander) arrives afresh, as one opened from the menu does.
    if (this.view && this.view.mode !== view.mode) this.arriving = true;
    if (first) this.spread.seenRegion(reach(view));
    this.view = view;
    const phaseChanged = view.phase !== this.phase;
    this.phase = view.phase;
    const voyaging = view.voyage === 'gathering' || view.voyage === 'sailing';
    for (const p of ['morning', 'day', 'evening', 'night'] as const) this.el.classList.toggle(`is-${p}`, view.phase === p);
    this.el.classList.toggle('is-voyaging', voyaging);
    // The season tab lives outside the notebook; the whole interface steps aside for the voyage.
    this.el.closest('.sr-ui')?.classList.toggle('is-voyaging', voyaging);
    // When the boat is ready to go the book closes: the voyage is the valley's.
    if ((voyaging || view.placing) && this.spread.opened) this.spread.close();
    this.el.classList.toggle('is-ended', view.voyage === 'ended');
    this.el.classList.toggle('is-placing', !!view.placing);
    // The bar fades out for the evening and night with opacity alone (see day-end.css): out of reach while it is gone,
    // and its little book drawn afresh as it comes back (some browsers otherwise leave an inline drawing blank).
    const away = view.phase === 'evening' || view.phase === 'night';
    if (this.bar.inert !== away) this.bar.inert = away;

    this.firesideSkip.hidden = view.phase !== 'evening' || view.eveningReady || this.spread.opened;
    this.sky.update(view);
    this.controls.update(view);
    this.barState.update(view);
    this.today.update(view);
    this.strip.update(view);
    this.tags.setView(view);
    this.spread.update(view, !(phaseChanged && view.phase==='morning'));
    this.spread.setTabs(view);

    if (this.arriving) {
      this.arriving = false;
      // Coming into Wander, the valley shows first (the mist, the friends at home by the fire), then the book.
      if (view.mode === 'free' && view.phase === 'morning' && view.voyage === 'preparing') {
        if (this.spread.opened) this.spread.close();
        window.clearTimeout(this.beatTimer);
        this.beatTimer = window.setTimeout(() => this.endBeat(true), WANDER_BEAT_MS);
      }
    }
    if (phaseChanged) this.onPhase(view);
    this.maybeOpenTonight(view);
    this.renderPlacing(view);
    this.voyage.update(view);
    this.renderEnding(view);
    this.syncTab();
    this.resumePlanning(view);
  }

  /** A report link waits for the real new-morning snapshot before selecting. */
  private resumePlanning(view: AdventureView): void {
    if (view.phase !== 'morning' || !this.pendingPlace) return;
    const place = this.pendingPlace; this.pendingPlace = null;
    this.openBook('today'); this.today.focusPlace(place);
  }

  updateTags(tags: ScreenTag[]): void {
    const view = this.view;
    const quiet = !view || view.phase === 'night' || view.voyage === 'gathering' || view.voyage === 'sailing' || this.spread.opened;
    this.tags.update(quiet ? [] : tags);
  }

  /** From the game: open a page, optionally with a friend picked up or a place under consideration. */
  show(page: NotebookPage = 'plan', person?: string, place?: string, lodging?: number | string): void {
    if (lodging === undefined && page === 'plan' && this.today.isEcho(person, place)) return;
    // The game's own "open on Today" waits for Wander's first look; anything the player asked for ends it.
    if (this.beatTimer) {
      if (page === 'plan' && !person && !place && lodging === undefined) return;
      this.endBeat(false);
    }
    if (page === 'journal' || page === 'friends' || page === 'map') {
      this.openBook(page);
      return;
    }
    const morning = this.view?.phase === 'morning';
    if (!morning && place) {
      // Outside the morning there is nothing to plan; a place is looked at closely instead.
      this.actions.expedition({ type: 'inspect', place });
      return;
    }
    this.openBook('today');
    if (lodging !== undefined) this.today.showLodging(lodging);
    else if (page === 'make') this.today.showMake();
    else { this.today.showPlan(); this.today.consider(person, place); }
  }

  /** The notebook's own slips that are showing, for tags to keep clear of. */
  private reservedRects(): DOMRect[] {
    const clock = this.el.querySelector<HTMLElement>('.clock-tab');
    const slips = [this.bar, this.strip.el, this.skySlip, this.morningNotice.el, ...(clock ? [clock] : [])];
    return slips
      .filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).opacity !== '0')
      .map((el) => el.getBoundingClientRect());
  }

  private onPhase(view: AdventureView): void {
    this.tonightShown = false;
    this.spread.endTonight(false);
    if (view.phase === 'morning' && view.voyage === 'preparing') {
      // The morning is the player's to plan: the book opens by itself on Today.
      // If it is still open on tonight's page, that page turns to the morning.
      if (!this.closedForMorning && !this.beatTimer) this.openBook('today', true);
      this.closedForMorning = false;
    } else {
      // The day, the fire and the night belong to the valley.
      this.spread.close();
      this.strip.unfold(false);
    }
  }

  /** Wander's first look at the valley is over: the book opens on Today (unless something else already opened it). */
  private endBeat(open: boolean): void {
    window.clearTimeout(this.beatTimer);
    this.beatTimer = 0;
    if (open && this.view?.phase === 'morning' && !this.spread.opened) this.openBook('today', true);
    this.syncTab();
  }

  /**
   * When the last bundle is down by the fire and everyone is home, the book
   * opens on the journal: tonight's finds ink themselves in, then the line
   * about tomorrow and the way to sleep.
   */
  private maybeOpenTonight(view: AdventureView): void {
    const evening = view.evening;
    if (this.tonightShown || !view.eveningReady || view.phase !== 'evening' || !evening) return;
    if (evening.shown < evening.total) {
      this.actions.expedition({ type: 'evening', step: 'collect' });
      return;
    }
    this.tonightShown = true;
    if (!view.paused) {
      if (this.actions.holdEvening) this.actions.holdEvening();
      else this.actions.togglePause();
    }
    this.spread.openTonight({ items: evening.items, tomorrow: evening.tomorrow, sleep: () => this.sleep(), plan: (place) => this.sleep(place) });
  }

  private syncTab(): void {
    const view = this.view;
    if (!view) return;
    let line = '';
    if (view.phase === 'morning') {
      line = morningStatus(view)?.ready ? 'Ready to begin' : 'Today’s plans';
    } else if (view.phase === 'evening') {
      line = 'By the fire';
    }
    this.tab.set(line, false);
    this.morningNotice.update(view, this.spread.opened || this.beatTimer !== 0);
    this.tab.el.setAttribute('aria-expanded', String(this.spread.opened));
    this.el.classList.toggle('has-book', this.spread.opened);
  }

  /** The one way from tonight's page to the night: let the game go on and let the evening end. */
  private sleep(place?: string): void {
    if (this.morningTimer || this.view?.phase !== 'evening') return;
    this.actions.cue('click');
    this.pendingPlace = place ?? this.spread.nextMorningPlace ?? this.pendingPlace;
    if (this.spread.opened) this.el.classList.add('is-next-morning');
    this.morningTimer = window.setTimeout(() => {
      this.morningTimer = 0;
      this.actions.expedition({ type: 'evening', step: 'morning' });
      if (this.view?.paused) this.actions.togglePause();
      this.el.classList.remove('is-next-morning');
    }, 30);
  }

  /** The book in the bar: Today in the morning, tonight's page after the fire, the journal otherwise. */
  private onTab(): void {
    this.actions.cue('click');
    if(this.morningTimer) { this.closedForMorning=false; return; }
    if (this.tonightShown && this.view?.phase === 'evening' && this.view.evening) {
      this.spread.openTonight({ items: this.view.evening.items, tomorrow: this.view.evening.tomorrow, sleep: () => this.sleep(), plan: (place) => this.sleep(place) });
      return;
    }
    this.openBook(this.view?.phase === 'morning' ? 'today' : 'journal');
  }

  private clockAction(): void {
    if (!this.view) return;
    if (this.view.phase === 'day' && this.view.paused) {
      this.actions.cue('click'); this.actions.togglePause(); return;
    }
    const status = morningStatus(this.view);
    if (!status) return;
    this.actions.cue('click');
    if (status.ready) this.actions.expedition({ type: 'begin' });
    else this.openBook('today');
  }

  private openBook(page: NotebookPage | SpreadPage, daybreak = false): void {
    const target: SpreadPage = page === 'plan' || page === 'make' ? 'today' : page;
    this.spread.open(target, daybreak);
  }

  private cycleSpeed(): void {
    const speed = this.view?.speed ?? 1;
    this.actions.cue('click');
    this.actions.setSpeed(speed === 1 ? 2 : speed === 2 ? 4 : 1);
  }

  /** While a structure is being placed in the valley: one line and a way out. */
  private renderPlacing(view: AdventureView): void {
    const key = view.placing ?? '';
    if (key === this.placingKey) return;
    this.placingKey = key;
    this.placing.replaceChildren();
    if (!view.placing) return;
    const name = structureLabel(view.structures.find((s) => s.id === view.placing)?.name ?? view.placing);
    this.placing.append(
      h('p', null, null, [`Choose a place in the valley for ${name}.`, h('small', 'nb-placing-where', null, [placingWhere(view.placing)])]),
      wordButton(
        'Cancel',
        () => {
          this.actions.cue('click');
          this.actions.expedition({ type: 'cancel-placement' });
        },
        'nb-quiet',
      ),
    );
  }

  /** The journey's end is the book's last page. */
  private renderEnding(view: AdventureView): void {
    const ended = view.voyage === 'ended';
    if (ended === this.endingShown) return;
    this.endingShown = ended;
    window.clearTimeout(this.endingTimer);
    if (!ended) { this.endingScreen.hide(); return; }
    // The boat grows small on open water; only then does the book open on its last page.
    this.endingTimer = window.setTimeout(() => {
      this.endingScreen.show(view);
    }, SEA_HOLD_MS);
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.el.classList.contains('is-active')) return;
    if (this.el.closest('.menu-open')) return;
    const target = e.target as HTMLElement;
    if (e.altKey || e.ctrlKey || e.metaKey || target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const key = e.key.toLowerCase();
    if ((key === 'w' || key === 's' || e.key === 'ArrowUp' || e.key === 'ArrowDown') && this.spread.scrollMap(key === 'w' || e.key === 'ArrowUp' ? -90 : 90)) { e.preventDefault(); return; }
    if (e.repeat) return;
    if ((key === 'e' || key === 'r' || /^[1-6]$/.test(key)) && this.view?.voyage === 'preparing' && !this.view.placing) {
      if (key === 'e' && this.view.phase === 'morning' && !this.spread.opened) {
        e.preventDefault(); this.clockAction(); return;
      }
      if (key === 'e' && this.view.phase === 'evening') {
        // Before the book opens, E belongs to the fire: the game skips the unpacking to the book.
        if (!this.tonightShown) return;
        e.preventDefault();
        this.sleep();
        return;
      }
      if (this.today.handleAction(key)) { e.preventDefault(); return; }
    }
    if (e.key !== 'Escape') return;
    if (this.tags.hasPlaceCard()) {
      this.actions.expedition({ type: 'inspect', place: null });
    } else if (this.view?.placing) {
      this.actions.expedition({ type: 'cancel-placement' });
    } else if (this.spread.opened) {
      e.preventDefault(); e.stopPropagation(); this.spread.close();
    }
  }
}

/** Where a work can go, in a few words, while it is being placed: the ground it needs, near home. */
function placingWhere(kind: StructureKind): string {
  const def = structureDef(kind);
  if (def.at) return 'It belongs in one particular spot, where the path meets the water.';
  if (kind === 'bridge') return 'Tap a narrow stretch of the river near camp.';
  if (def.site === 'bank') return 'Tap the riverbank near camp, close to the water.';
  return 'Tap open ground near camp, a little back from the water.';
}

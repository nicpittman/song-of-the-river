import '../styles/fonts.css';
/**
 * The HTML interface layered over the valley canvas. See `contract.ts` for the
 * boundary with the game. The root lets pointer events fall through to the
 * canvas everywhere except on real controls.
 */

import '../styles/tokens.css';
import '../styles/kit.css';
import '../styles/ui.css';
import '../styles/menu.css';

import type { Season } from '../game/world/types';
import type { LoadingStage } from '../game/rendering/art';
import type { HudState, JournalCard, MenuModel, ResultModel, SelectionView, Ui, UiActions } from './contract';
import { SEASON_COLOURS, SEASON_NAMES, clamp, h } from './dom';
import { Notebook } from './notebook/index';
import { Hud } from './hud';
import { ICONS } from './icons';
import { Journal } from './journal';
import { Menu } from './menu';
import { Credits } from './credits';
import { Results } from './results';

export type { Ui, UiActions } from './contract';

const TOAST_MS = 3200;
const ANNOUNCE_MS = 2600;
/** A newly opened mode stays a little longer than a season's name. */
const OPENED_MS = 7000;
const FOUND_MS = 3500;
/** The loading paper stays at least this long once the title shows, so a cached load still reads as a moment. */
const MIN_LOADING_MS = 600;
/** How long the swash takes to sweep to a new progress value (matches the CSS transition). */
const SWEEP_MS = 450;
/** What the loading line says while each kind of art arrives. */
const LOADING_WORDS: Record<LoadingStage, string> = {
  ground: 'Laying the ground…',
  mountains: 'Raising the mountains…',
  river: 'Filling the river…',
  woods: 'Planting the woods…',
  villages: 'Building the villages…',
  companions: 'Waking the companions…',
  wildlife: 'Calling the birds and deer…',
};
/** Each loading line stays at least this long. */
const STAGE_HOLD_MS = 650;
/** Long enough for the paper to dissolve and the entries to rise in. */
const REVEAL_MS = 2600;

export function createUi(root: HTMLElement, actions: UiActions, initialMenu: MenuModel | null = null): Ui {
  root.classList.add('sr-ui');
  root.textContent = '';

  // Reduced motion: the setting wins; null follows the system.
  const systemReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let motionSetting: boolean | null = null;
  const applyMotion = (): void => {
    root.classList.toggle('is-reduced', motionSetting ?? systemReduce.matches);
  };
  systemReduce.addEventListener('change', applyMotion);
  const setMotion = (v: boolean | null): void => {
    motionSetting = v;
    applyMotion();
  };
  applyMotion();

  const hud = new Hud(actions);
  const notebook = new Notebook(actions);
  const journal = new Journal();
  const credits = new Credits(actions);
  const menu = new Menu(actions, setMotion);
  const results = new Results(actions);

  const hint = h('p', 'hint sr-popup', { role: 'status', 'aria-live': 'polite' });
  const announceName = h('span', 'announce-name');
  const announceYear = h('span', 'announce-year');
  const announce = h('div', 'announce sr-halo is-block', { 'aria-live': 'polite' }, [announceName, h('span', 'announce-rule'), announceYear]);
  const toastEl = h('div', 'toast sr-popup', { role: 'status', 'aria-live': 'polite' });
  // Something newly opened (Wander): a small paper note under the season tab, like the valley's own notes.
  const openedName = h('strong', 'opened-name');
  const openedLine = h('span', 'opened-line');
  const opened = h('div', 'opened-note', { role: 'status', 'aria-live': 'polite' }, [h('span', 'opened-kicker', null, ['Now open']), openedName, openedLine]);
  opened.addEventListener('pointerdown', () => opened.classList.remove('is-shown'));
  const foundTitle = h('span', 'found-title');
  const foundGlyph = h('span', 'found-glyph');
  foundGlyph.innerHTML = ICONS.book;
  const found = h('div', 'found sr-popup', { role: 'status', 'aria-live': 'polite' }, [foundGlyph, h('span', 'found-label', null, ['Journal:']), foundTitle]);

  // The slow open of a new Journey: a caption over the world, and a tap anywhere to move on.
  const openingLine = h('p', 'opening-line');
  const opening = h('div', 'opening', { 'aria-live': 'polite' }, [openingLine]);
  let openingSkip: (() => void) | null = null;
  /** The latest snapshot while the opening holds the notebook back. */
  let heldModel: Parameters<Ui['updateAdventure']>[0] | null = null;
  let openingTimer = 0;
  opening.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    actions.gesture();
    openingSkip?.();
  });

  root.append(hud.el, notebook.el, opening, hint, found, announce, toastEl, opened, menu.el, results.el, journal.el, credits.el);
  hud.clock.mount();

  // Loading: the menu opens at once on plain paper, taking over from the page's own
  // paper so nothing changes on screen; the title fades in once its typeface is ready.
  root.classList.add('is-loading');
  menu.startLoading(initialMenu);
  const pagePaper = document.getElementById('loading');
  requestAnimationFrame(() => requestAnimationFrame(() => pagePaper?.remove()));
  // Progress is drawn as the title's swash, revealed left to right. It only starts
  // moving once the title shows, so even an instant (cached) load sweeps in visibly.
  let titledAt = 0;
  let progress = 0;
  let sweptAt = 0;
  let drawn = '';
  const drawProgress = (): void => {
    if (!titledAt || performance.now() - titledAt < 200) return;
    const value = `${(-12 + progress * 112).toFixed(1)}%`;
    if (value === drawn) return;
    drawn = value;
    menu.swash.style.setProperty('--sr-swash', value);
    sweptAt = performance.now() + SWEEP_MS;
  };
  const titled = fontsReady().then(() => {
    root.classList.add('is-titled');
    titledAt = performance.now();
    // Let the title settle in before its swash begins to draw.
    window.setTimeout(drawProgress, 220);
  });
  let loadingPromise: Promise<void> | null = null;
  // The line under the title: each stage holds a moment, so quick ones never flicker past unread.
  let stageShown: LoadingStage | null = null;
  let stageAt = 0;
  let stageWaiting: LoadingStage | null = null;
  let stageTimer = 0;
  const showStage = (stage: LoadingStage): void => {
    if (stage === stageShown) return;
    const wait = stageShown ? STAGE_HOLD_MS - (performance.now() - stageAt) : 0;
    stageWaiting = stage;
    if (wait > 0) {
      if (!stageTimer) stageTimer = window.setTimeout(() => { stageTimer = 0; if (stageWaiting) showStage(stageWaiting); }, wait);
      return;
    }
    stageShown = stage;
    stageAt = performance.now();
    menu.loadingNote.textContent = LOADING_WORDS[stage];
  };

  // One delegated listener: any press or key inside the interface counts as a gesture.
  const gesture = (): void => actions.gesture();
  root.addEventListener('pointerup', gesture);
  root.addEventListener('keydown', gesture);

  let toastTimer = 0;
  /** True while an expedition is shown: its notes go through the notebook (see toast, hint, announceSeason). */
  let adventureShown = false;
  /** A note that arrived while the book was open, shown once it closes. */
  let pendingToast: string | null = null;
  /** A title (Wander opening) that arrived while the book was open, shown once it closes. */
  let pendingOpened: [string, string] | null = null;
  let openedTimer = 0;
  /** The hint shows only while the book is not in the way. */
  const showHint = (): void => {
    hint.classList.toggle('is-shown', !!hintText && !(adventureShown && notebook.bookBusy()));
  };
  notebook.onBookChange(() => {
    showHint();
    if (!notebook.bookBusy() && pendingOpened) {
      const [name, line] = pendingOpened;
      pendingOpened = null;
      ui.announceOpened?.(name, line);
    }
    if (!notebook.bookBusy() && pendingToast) {
      const text = pendingToast;
      pendingToast = null;
      ui.toast(text);
    }
  });
  let announceTimer = 0;
  let foundTimer = 0;
  let hintText: string | null = null;

  const ui: Ui = {
    showCredits: () => credits.show(),
    // The expedition notebook. The perimeter year clock moves into it while an expedition is shown.
    showAdventure(visible: boolean): void {
      adventureShown = visible;
      notebook.visible(visible);
      if (visible) {
        notebook.el.prepend(hud.clock.el);
        notebook.attachClock(hud.clock.el);
        hud.clock.rebuild();
      } else {
        notebook.attachClock(null);
        hud.el.prepend(hud.clock.el);
      }
    },

    updateAdventure(model): void {
      if (openingSkip) {
        heldModel = model;
        return;
      }
      notebook.update(model);
      hud.clock.setLabel(model.season as Season, model.year, null);
      hud.clock.setProgress(model.yearProgress);
    },

    updateDaylight(progress, dt): void {
      notebook.updateDaylight(progress, dt);
    },

    updateTags(tags): void {
      notebook.updateTags(tags);
    },

    playOpening(text: string, skip: () => void): void {
      openingSkip = skip;
      openingLine.textContent = text;
      clearTimeout(openingTimer);
      root.classList.remove('is-opened');
      root.classList.add('is-opening');
      opening.classList.remove('is-shown');
      void opening.offsetWidth;
      opening.classList.add('is-shown');
    },

    endOpening(): void {
      if (!openingSkip) return;
      openingSkip = null;
      opening.classList.remove('is-shown');
      root.classList.remove('is-opening');
      root.classList.add('is-opened');
      openingTimer = window.setTimeout(() => root.classList.remove('is-opened'), 1200);
      const model = heldModel;
      heldModel = null;
      if (model) ui.updateAdventure(model);
    },

    openNotebook(page, person, place, lodging): void {
      if (openingSkip) return;
      notebook.show(page, person, place, lodging);
    },

    setLoading(fraction: number, stage?: LoadingStage): void {
      if (stage) showStage(stage);
      const f = clamp(fraction, 0, 1);
      if (f <= progress) return;
      progress = f;
      drawProgress();
    },

    loadingDone(): Promise<void> {
      if (loadingPromise) return loadingPromise;
      loadingPromise = titled.then(() => wait(Math.max(0, titledAt + 230 - performance.now()))).then(() => {
        // Finish the swash, then hold at least the minimum time before the paper goes.
        progress = 1;
        drawProgress();
        const now = performance.now();
        return wait(Math.max(sweptAt - now + 80, titledAt + MIN_LOADING_MS - now));
      }).then(() => {
        // The paper dissolves, the menu's own scrim and entries take over.
        root.classList.remove('is-loading');
        root.classList.add('is-revealing');
        window.setTimeout(() => root.classList.remove('is-revealing'), REVEAL_MS);
      });
      return loadingPromise;
    },

    showMenu(model: MenuModel): void {
      setMotion(model.settings.reducedMotion);
      menu.show(model);
      root.classList.add('menu-open');
    },

    hideMenu(): void {
      menu.hide();
      root.classList.remove('menu-open');
    },

    showHud(visible: boolean): void {
      root.classList.toggle('hud-on', visible);
      if (visible) hud.clock.rebuild();
    },

    update(state: HudState): void {
      hud.update(state);
    },

    setSelection(selection: SelectionView | null): void {
      hud.setSelection(selection);
    },

    toast(text: string, at?: { x: number; y: number }): void {
      // During an expedition a note never shows over the book: it waits until the book is closed.
      if (adventureShown && notebook.bookBusy()) {
        pendingToast = text;
        return;
      }
      clearTimeout(toastTimer);
      toastEl.classList.remove('is-shown');
      toastEl.textContent = text;
      if (at) {
        toastEl.classList.add('is-placed');
        const w = toastEl.offsetWidth;
        const hgt = toastEl.offsetHeight;
        const vw = root.clientWidth || window.innerWidth;
        const margin = 16;
        const x = clamp(at.x, margin + w / 2, vw - margin - w / 2);
        const y = clamp(at.y - 18 - hgt, margin + 48, (root.clientHeight || window.innerHeight) - hgt - margin);
        toastEl.style.left = `${x}px`;
        toastEl.style.top = `${y}px`;
      } else {
        toastEl.classList.remove('is-placed');
        toastEl.style.left = '';
        toastEl.style.top = '';
      }
      void toastEl.offsetWidth;
      toastEl.classList.add('is-shown');
      toastTimer = window.setTimeout(() => toastEl.classList.remove('is-shown'), TOAST_MS);
    },

    announceSeason(season: Season, year: number): void {
      // During an expedition the turn of the season is a line on Today's page, not a title over it.
      if (adventureShown) {
        notebook.notice(year > 1 && season === 0 ? `${SEASON_NAMES[season]} again. A new year begins.` : `${SEASON_NAMES[season]} has come.`);
        return;
      }
      clearTimeout(announceTimer);
      announceName.textContent = SEASON_NAMES[season];
      announceYear.textContent = `Year ${year}`;
      announce.style.setProperty('--season', SEASON_COLOURS[season]);
      announce.classList.remove('is-shown');
      void announce.offsetWidth;
      announce.classList.add('is-shown');
      announceTimer = window.setTimeout(() => announce.classList.remove('is-shown'), ANNOUNCE_MS);
    },

    announceOpened(name: string, line: string): void {
      if (adventureShown && notebook.bookBusy()) { pendingOpened = [name, line]; return; }
      clearTimeout(openedTimer);
      openedName.textContent = name;
      openedLine.textContent = line;
      opened.classList.remove('is-shown');
      void opened.offsetWidth;
      opened.classList.add('is-shown');
      openedTimer = window.setTimeout(() => opened.classList.remove('is-shown'), OPENED_MS);
    },

    celebrateObjective(id: string): void {
      hud.celebrate(id);
    },

    journalFound(card: JournalCard): void {
      // The expedition's journal inks its own finds in, in the book.
      if (adventureShown) return;
      clearTimeout(foundTimer);
      foundTitle.textContent = card.title;
      found.classList.remove('is-shown');
      void found.offsetWidth;
      found.classList.add('is-shown');
      foundTimer = window.setTimeout(() => found.classList.remove('is-shown'), FOUND_MS);
    },

    showArchive: view => notebook.showArchive(view),

    notebookOpen: () => notebook.el.classList.contains('has-book'),

    showJournal(cards: JournalCard[]): void {
      journal.show(cards);
    },

    hint(text: string | null): void {
      if (text === hintText) return;
      hintText = text;
      if (text) hint.textContent = text;
      showHint();
    },

    showResults(model: ResultModel): void {
      results.show(model);
      root.classList.add('results-open');
    },

    hideResults(): void {
      results.hide();
      root.classList.remove('results-open');
    },
  };
  return ui;
}

const wait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

/** Show the title only once its real face is ready; a failed font request still settles. */
function fontsReady(): Promise<void> {
  const fonts = document.fonts;
  if (!fonts?.load) return Promise.resolve();
  const load = Promise.all([
    fonts.load('600 48px "Cormorant Garamond"'),
    fonts.load('500 25px "Cormorant Garamond"'),
    fonts.load('italic 500 20px "Cormorant Garamond"'),
  ]).then(() => undefined, () => undefined);
  return load;
}

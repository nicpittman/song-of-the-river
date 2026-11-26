/**
 * The boundary between the game and its HTML interface. The game owns all
 * state and calls `Ui` to show it; the interface owns the DOM and calls
 * `UiActions` when the player asks for something. Neither side reaches into
 * the other.
 *
 * Vocabulary: the player-facing word for an objective is a "wish": something
 * the valley's inhabitants want to do in a particular season.
 */

import type { AdventureCommand, AdventureView, Cue, NotebookPage, ScreenTag } from '../game/adventure/model';
import type { Settings } from '../game/core/save';
import type { Season } from '../game/world/types';
import type { LoadingStage } from '../game/rendering/art';

export interface ObjectiveView {
  id: string;
  title: string;
  text: string;
  traveller: 'deer' | 'villager' | 'fish' | 'bird';
  season: Season;
  progress: number;
  count: number;
  done: boolean;
  /** Why the journey is currently failing, if it is (for example "Snow has closed the high ground."). */
  note: string | null;
  /**
   * True for a wish that belongs to the coming season rather than this one.
   * It cannot be granted yet; it is shown so the player can prepare for it.
   */
  upcoming: boolean;
}

/** One card of the nature journal: something the player has seen happen in a valley. */
export interface JournalCard {
  id: string;
  title: string;
  /** A sentence or two, shown once the entry has been found. */
  text: string;
  kind: 'wildlife' | 'season' | 'place' | 'craft';
  found: boolean;
}

/** Everything the in-game interface shows. Passed every frame; implementations must diff cheaply. */
export interface HudState {
  valley: string;
  subtitle: string;
  mode: 'journey' | 'free';
  season: Season;
  year: number;
  /** Progress through the current year, 0..1. Drives the perimeter clock. */
  yearProgress: number;
  /** Years allowed in Journey mode; null in Free Play. */
  years: number | null;
  paused: boolean;
  speed: 1 | 2 | 4;
  /** Interventions left this season; null in Free Play (unlimited). */
  marks: number | null;
  marksCap: number;
  /**
   * The wishes to show: this season's (granted or not), then the coming
   * season's ungranted ones with `upcoming` set. Usually two to four cards.
   */
  objectives: ObjectiveView[];
  /** Wishes granted so far in this valley, out of how many there are. Journey and Free Play alike. */
  wishesGranted: number;
  wishesTotal: number;
  canUndo: boolean;
  canRedo: boolean;
  placesVisible: boolean;
  routesVisible: boolean;
}

/** The contextual chip shown when a place or a route is selected. */
export interface SelectionView {
  identity?: { place: string; current: string; choices: Array<{ id: string; title: string; description: string; needs: string; tradeoff: string }> };
  title: string;
  detail: string;
  tone: 'info' | 'open' | 'closed';
  /** Shows a Remove control (routes only). */
  removable: boolean;
}

export interface ValleyCard {
  id: string;
  name: string;
  subtitle: string;
  /** False for valleys that exist in the campaign but are not built yet. */
  available: boolean;
  /** Journey mode unlocks valleys in order; Free Play ignores this. */
  unlocked: boolean;
  completed: boolean;
  /** Best result so far in Journey mode: 0 (not completed) to 3 blossoms. */
  blossoms: number;
}

export interface MenuModel {
  /** Wander is on the menu once a Journey has reached Mio. */
  wanderOpen?: boolean;
  journeyComplete?: boolean;
  settingsOpen?: boolean;
  hasJourney?:boolean;
  journeyLabel?:string;
  /** Where a saved Wander valley was left, for example "Day 12 · Kawagiri". */
  wanderLabel?: string;
  canContinue: boolean;
  /** For example "Seseragi · Autumn, year 1". */
  continueLabel: string;
  valleys: ValleyCard[];
  settings: Settings;
  journal: JournalCard[];
}

export interface ResultModel {
  won: boolean;
  valley: string;
  headline: string;
  journeys: Array<{ title: string; text: string; done: boolean }>;
  /** One or two notable moments from the playthrough. */
  moments: string[];
  /** When not won: one sentence per ungranted wish explaining why. */
  shortfalls: string[];
  hasNext: boolean;
  /**
   * The valley's rating, shown as up to three blossoms: one line per blossom
   * saying what it is for and whether it was earned. Empty when not won.
   */
  blossoms: Array<{ label: string; earned: boolean }>;
}

export interface UiActions {
  reviewStage?(stage: import('../game/adventure/review').ReviewStage): void;
  openCredits?(): void;
  finishJourney?(): void;
  replayCredits?(): void;
  /** Everything the expedition notebook and its tags ask of the game. */
  expedition(command: AdventureCommand): { ok: true } | { ok: false; reason: string } | void;
  /** Interface sounds (page turns, tokens, clicks). The game decides how they are played. */
  cue(cue: Cue): void;
  startJourney(boardId: string): void;
  startFreePlay(boardId: string): void;
  continueGame(): void;
  resumeJourney?():void;
  togglePause(): void;
  /** Hold the fireside recap without ducking music or ambience. */
  holdEvening?(): void;
  setSpeed(speed: 1 | 2 | 4): void;
  skipSeason(): void;
  undo(): void;
  redo(): void;
  fitView(): void;
  /** Toggle labels and clearing marks on places that accept routes. */
  showPlaces(): void;
  toggleRoutes(): void;
  chooseIdentity(place: string, identity: string): void;
  removeSelected(): void;
  /** Opens the journal from inside a valley (the menu shows it from `MenuModel.journal`). */
  openJournal(): void;
  /** The player tapped an objective card: the game frames that journey in the world. */
  reviewObjective(id: string): void;
  openMenu(): void;
  setVolumes(music: number, sfx: number): void;
  /** null follows the operating system preference. */
  setReducedMotion(value: boolean | null): void;
  resetProgress(scope: 'journey' | 'free' | 'all'): void;
  keepWatching(): void;
  retry(): void;
  nextValley(): void;
  toMenu(): void;
  /** Any click or key inside the interface; used to unlock audio. */
  gesture(): void;
}

export interface Ui {
  showCredits?(): void;
  /** Shows or hides the whole expedition interface (notebook tab, day line, tags). */
  showAdventure(visible: boolean): void;
  /** A fresh snapshot. Called when something changes and a few times a second; diff cheaply. */
  updateAdventure(view: AdventureView): void;
  /** Lightweight frame update for the moving sun; does not rebuild the notebook. */
  updateDaylight?(progress: number, dt: number): void;
  /**
   * The slow open of a new Journey: the interface steps aside and `text` settles
   * over the valley as a quiet caption. A tap anywhere calls `skip`. The notebook
   * holds its snapshots until `endOpening`.
   */
  playOpening?(text: string, skip: () => void): void;
  /** The opening is over: the interface returns (the game then opens the book). */
  endOpening?(): void;
  /** Screen positions of the paper tags pinned in the valley. Called every frame; only move elements here. */
  updateTags(tags: ScreenTag[]): void;
  /** Opens the notebook, optionally with a friend picked up or a place under consideration. */
  notebookOpen?(): boolean;
  openNotebook(page?: NotebookPage, person?: string, place?: string, lodging?: number | string): void;
  /** Loading screen progress, 0..1, and what is arriving now (named in a line under the title). */
  setLoading(fraction: number, stage?: LoadingStage): void;
  /** Shows "Begin" on the loading screen and resolves when the player taps it. */
  loadingDone(): Promise<void>;
  showMenu(model: MenuModel): void;
  hideMenu(): void;
  showHud(visible: boolean): void;
  update(state: HudState): void;
  setSelection(selection: SelectionView | null): void;
  /** A short, gentle message. `at` is a screen position to appear near; omit for the default spot. */
  toast(text: string, at?: { x: number; y: number }): void;
  /** A quiet title when the season turns. */
  announceSeason(season: Season, year: number): void;
  /** A title written over the valley when something new opens (Wander, at Mio). Waits for the book to close. */
  announceOpened?(name: string, line: string): void;
  celebrateObjective(id: string): void;
  /** Tells the player a journal card was just found. Brief and quiet. */
  journalFound(card: JournalCard): void;
  /** A single guiding line for the opening of a valley; null hides it. */
  hint(text: string | null): void;
  /** Shows the journal cards over the valley; closing it is the interface's own business. */
  showJournal(cards: JournalCard[]): void;
  showArchive?(view: AdventureView): void;
  showResults(model: ResultModel): void;
  hideResults(): void;
}

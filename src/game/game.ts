/**
 * The game session: ties the simulation, the view, input, audio, saving and
 * the interface together. It holds no rules of its own. The simulation decides
 * what happens, the view shows it, and this class passes news between them.
 */

import { adventureValley } from './world/boards/adventure';
import { ADVENTURE_VERSION, newAdventure, type AdventureState } from './adventure/state';
import { USUAL_COURSE, courseOf } from './adventure/course';
import { FINDS, findText, placeDef } from './adventure/content';
import { FREE_PLAY_FINDS } from './adventure/places/freeplay';
import { REGIONS } from './adventure/regions';
import { FREE_PLAY_ORDER } from './adventure/people';
import { creditsReplay } from './adventure/creditsReplay';
import { AdventureSession } from './adventureSession';
import type { Application } from 'pixi.js';
import { reviewGame } from './adventure/review';
import { yearOf } from './adventure/calendar';
import { REVIEW_TOOLS, WANDER_ALWAYS_OPEN } from '../flags';
import type { HudState, JournalCard, MenuModel, ObjectiveView, ResultModel, SelectionView, Ui, UiActions } from '../ui/contract';
import type { AudioDirector, Sfx } from './audio/audio';
import type { AudioScene } from './audio/tracks';
import { MARKS_CAP } from './campaign/interventions';
import { explainShortfall } from './campaign/objectives';
import type { Vec } from './core/math';
import { type SaveFile, clearProgress, loadSave, writeSave } from './core/save';
import { ConnectTool, type Selection } from './interaction/connectTool';
import { History } from './interaction/history';
import { PointerInput } from './interaction/pointer';
import { placePresentation } from './interaction/placePresentation';
import { identityForObjective, identitiesFor, identityFor, type IdentityId } from './world/identities';
import type { ArtLibrary } from './rendering/art';
import { ValleyView } from './rendering/view';
import { type ClosureCause, closureOf, describeClosure } from './simulation/conditions';
import { type GameMode, type GameState, Simulation, newGameState } from './simulation/simulation';
import { BOARDS, boardById } from './world/boards';
import { placeById } from './world/terrain';

import { type BoardDef, type ObjectiveDef, SEASON_NAMES, type Season } from './world/types';

type Phase = 'menu' | 'play' | 'tour' | 'results';

const SCENES: readonly AudioScene[] = ['spring', 'summer', 'autumn', 'winter'];
const AUTOSAVE_SECONDS = 15;
/** The journal card that explains each kind of closure, found the first time it is seen. */
const CLOSURE_CARDS: Partial<Record<ClosureCause, string>> = { flood: 'spring-melt', snow: 'snowline', meadow: 'water-meadow', weir: 'weir', stones: 'fish-and-stones', gap: 'flyway' };
/** A refusal that comes from the rule that deer and people keep apart. */
const KEEP_APART = /cross|cut across|already carry|out of the deer/i;

export class Game {
  readonly actions: UiActions;
  private ui!: Ui;
  private save: SaveFile = loadSave();
  private sim!: Simulation;
  private view: ValleyView | null = null;
  private tool: ConnectTool | null = null;
  /** The expedition's wiring, when the valley in play is an expedition. */
  private session: AdventureSession | null = null;
  private pointer: PointerInput | null = null;
  private history!: History;
  private phase: Phase = 'menu';
  private paused = false;
  private speed: 1 | 2 | 4 = 1;
  private clock = 0;
  private sinceSave = 0;
  private replayingCredits = false;
  private lastArrivalSound = 0;
  private hintTimer = 0;
  /** One-off guiding lines already shown in this valley. */
  private tipsShown = new Set<string>();
  /** Development (`?play` without `&opening`): new Journeys skip the slow open, for scripts and tests. */
  skipOpening = false;
  private tour: { stops: Array<Vec & { zoom: number }>; index: number; wait: number } | null = null;
  private unsubscribe: Array<() => void> = [];

  constructor(
    private readonly app: Application,
    private readonly art: ArtLibrary,
    private readonly audio: AudioDirector,
  ) {
    this.audio.setVolumes(this.save.settings.music, this.save.settings.sfx);
    this.actions = this.makeActions();
    app.ticker.add((ticker) => this.frame(Math.min(0.1, ticker.deltaMS / 1000)));
    app.renderer.on('resize', () => this.view?.resize());
    window.addEventListener('keydown', (e) => this.key(e));
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
      if (this.save.settings.reducedMotion === null) this.view?.setReducedMotion(this.reducedMotion);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.persist(); app.ticker.stop(); }
      else app.ticker.start();
    });
    window.addEventListener('pagehide', () => this.persist());
  }

  attach(ui: Ui): void {
    this.ui = ui;
  }

  get reducedMotion(): boolean {
    return this.save.settings.reducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ── Opening and closing valleys ─────────────────────────────────────────

  /** The valley behind the menu: the journey's own valley, quiet, with nothing drawn over it. */
  showMenu(settingsOpen = false): void {
    this.persist();
    this.replayingCredits = false;
    const board = adventureValley;
    const state = newGameState(board, 'free');
    this.open(board, state, 'menu');
    this.ui.showHud(false);
    this.ui.showAdventure?.(false);
    this.ui.hint(null);
    this.ui.setSelection(null);
    this.ui.hideResults();
    this.ui.showMenu({ ...this.menuModel(), settingsOpen });
    this.audio.setScene('menu');
  }

  private play(board: BoardDef, state: GameState, opening = false): void {
    this.open(board, state, 'play');
    this.ui.hideMenu();
    this.ui.hideResults();
    this.ui.showHud(!this.sim.expedition);
    this.ui.showAdventure?.(!!this.sim.expedition);
    this.audio.setScene(SCENES[this.sim.season]!);
    if (!this.replayingCredits) this.save.last = state.mode;
    const fresh = state.tick === 0 && state.connections.length === 0;
    if (this.session) this.session.start(opening && !this.replayingCredits);
    else if (fresh) this.introduceReach();
    else this.ui.hint(null);
    this.persist();
  }

  /** Says what the reach in play is asking for first, and points at the two places concerned. */
  private introduceReach(): void {
    const sim = this.sim;
    if(sim.board.id==='seseragi') {
      this.ui.hint('Tap Hanano, Fuchi or Sagi-ike. What kind of place could each become?');
      this.tool?.hintPlaces(['hanano','seseragi-pool','sagi'],12);
      this.hintTimer=12;
      return;
    }
    const chapter = sim.state.mode === 'journey' ? sim.state.chapter : 0;
    this.ui.hint(sim.reaches[chapter]!.opening);
    this.hintTimer = 0;
    const wish = sim.board.objectives.find((o) => (o.reach ?? 0) === chapter);
    const first = sim.board.journeys.find((j) => j.id === wish?.journey);
    if (first) this.tool!.hintPlaces([first.from, first.to]);
  }

  private open(board: BoardDef, state: GameState, phase: Phase): void {
    this.close();
    this.phase = phase;
    this.paused = false;
    this.audio.setPaused(false);
    this.speed = 1;
    this.tour = null;
    this.hintTimer = 0;
    this.tipsShown.clear();
    this.sim = new Simulation(board, state);
    this.history = new History(this.sim);
    const view = new ValleyView(this.app, this.art, this.sim);
    view.setReducedMotion(this.reducedMotion);
    this.view = view;
    if (this.sim.expedition && phase === 'play') {
      this.session = new AdventureSession(this.sessionHost(), this.sim, view);
      this.pointer = new PointerInput(this.app.canvas, view.camera, this.session.input);
    } else {
    this.tool = new ConnectTool(this.sim, view, this.history, {
      toast: (text, world) => {
        this.ui.toast(text, world ? view.camera.worldToScreen(world) : undefined);
        if (KEEP_APART.test(text)) this.discover('keep-apart');
      },
      sound: (name) => (name === 'plant' ? this.audio.play('connect', { pitch: 0.75 }) : this.audio.play(name)),
      selectionChanged: (selection) => this.ui.setSelection(this.describeSelection(selection)),
      hoverChanged: (place) => {
        const detail = this.describeSelection(place ? { kind: 'place', place } : this.tool?.selected ?? null);
        this.ui.setSelection(place && detail ? { ...detail, removable: false, identity: undefined } : detail);
      },
      previewChanged: (title, detail) => this.ui.setSelection({ title, detail, tone: 'info', removable: false }),
      edited: (kind) => this.afterEdit(kind),
    });
    this.pointer = new PointerInput(this.app.canvas, view.camera, this.tool);
    this.tool.guidesVisible = phase === 'play';
    this.pointer.enabled = phase === 'play';
    }
    this.pointer.onGesture = () => this.audio.unlock();

    const events = this.sim.events;
    this.unsubscribe = [
      events.on('adventure', ({ cue, at }) => this.session?.onAdventure(cue, at)),
      events.on('network', () => {
        view.setConnections(this.sim.connections);
        this.tool?.networkChanged();
      }),
      events.on('season', ({ season, year }) => this.onSeason(season, year)),
      events.on('arrive', ({ agent, journey, season }) => this.onArrive(agent.x, agent.y, journey.id, journey.traveller, season)),
      events.on('blocked', ({ closure }) => {
        if (this.phase !== 'play' || this.sim.expedition) return;
        this.ui.toast(describeClosure(closure), view.camera.worldToScreen(closure.at));
        const card = CLOSURE_CARDS[closure.cause];
        if (card) this.discover(card);
      }),
      events.on('objective', ({ objective }) => this.onWish(objective)),
      events.on('activity', () => this.ui.setSelection(this.describeSelection(this.tool?.selected ?? null))),
      events.on('won', () => this.onWon()),
      events.on('chapter', ({ finished }) => this.onChapter(finished)),
      events.on('overtime', () => this.onOvertime()),
    ];
  }

  private close(): void {
    for (const off of this.unsubscribe) off();
    this.unsubscribe = [];
    this.pointer?.dispose();
    this.session?.dispose();
    this.session = null;
    this.tool?.dispose();
    this.view?.destroy();
    this.pointer = null;
    this.tool = null;
    this.view = null;
  }

  // ── Frame ───────────────────────────────────────────────────────────────

  private frame(dt: number): void {
    const view = this.view;
    if (!view) return;
    // Paper/menu scenes need only 30 frames; travelling keeps the full 60.
    const fps = this.phase === 'menu' || this.phase === 'results' || this.paused || this.session && (this.sim.expedition?.state.phase !== 'day' || this.ui.notebookOpen?.()) ? 30 : 60;
    if (this.app.ticker.maxFPS !== fps) this.app.ticker.maxFPS = fps;
    this.clock += dt;
    if (this.session) {
      this.session.frame(dt);
      view.paused = this.paused;
      view.update(dt);
      this.openWander();
      if ((this.sinceSave += dt) > AUTOSAVE_SECONDS) this.persist();
      return;
    }
    const running = !this.paused && this.phase !== 'results';
    if (running) this.sim.advance(dt * (this.phase === 'play' ? this.speed : 1));
    view.paused = !running;

    if (this.phase === 'menu') {
      // A slow drift so the valley behind the menu is never still.
      const board = this.sim.board;
      view.camera.rate = 0.6;
      const upper = this.sim.reaches[0]!.bottom;
      view.camera.focus(board.width / 2 + Math.sin(this.clock * 0.05) * 200, upper * 0.6 + Math.cos(this.clock * 0.037) * 260, Math.max(0.42, view.camera.fitZoom * 1.3));
    } else if (this.tour) {
      this.advanceTour(dt);
    }

    view.update(dt);
    this.tool?.update(dt);

    if (this.hintTimer > 0 && (this.hintTimer -= dt) <= 0) this.ui.hint(null);
    if (this.phase === 'play') {
      this.ui.update(this.hudState());
      if ((this.sinceSave += dt) > AUTOSAVE_SECONDS) this.persist();
    }
  }

  private hudState(): HudState {
    const sim = this.sim;
    const journey = sim.state.mode === 'journey';
    const wishes = sim.wishes;
    const next = ((sim.season + 1) % 4) as Season;
    // The tally counts the reach in play (in Free Play, the whole valley).
    const mine = journey ? wishes.filter((o) => (o.reach ?? 0) === sim.state.chapter) : wishes;
    return {
      valley: sim.reach.name,
      subtitle: sim.reach.subtitle,
      mode: sim.state.mode,
      season: sim.season,
      year: sim.year,
      yearProgress: sim.yearProgress,
      years: journey && !sim.state.overtime ? sim.board.years : null,
      paused: this.paused,
      speed: this.speed,
      marks: journey ? sim.state.marks : null,
      marksCap: MARKS_CAP,
      // This season's wishes, then a look ahead at the next season's.
      objectives: [
        ...wishes.filter((o) => o.season === sim.season).map((o) => this.wishView(o, false)),
        ...wishes.filter((o) => o.season === next && !sim.isGranted(o)).map((o) => this.wishView(o, true)),
      ],
      wishesGranted: mine.filter((o) => sim.isGranted(o)).length,
      wishesTotal: mine.length,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      placesVisible: this.tool?.guidesVisible ?? false,
      routesVisible: this.tool?.routesVisible ?? false,
    };
  }

  private wishView(objective: ObjectiveDef, upcoming: boolean): ObjectiveView {
    const sim = this.sim;
    const journey = sim.board.journeys.find((j) => j.id === objective.journey)!;
    const done = sim.isGranted(objective);
    // Only remark on a way its season will shut; a way not yet made needs no comment.
    const identity = identityForObjective(objective.id,sim.state.identities);
    const closure = done || identity ? null : sim.outlook(objective).closure;
    const note = identity && !done ? sim.life.problem(identity.place) : closure ? describeClosure(closure) : null;
    return {
      id: objective.id,
      title: identity ? identity.title + (objective.id==='hay-making'?' · A tradition':'') : objective.title,
      text: identity ? identity.description : objective.text,
      traveller: identity && identity.id!=='fish-run' ? identity.activity==='graze'?'deer':['birds','pollinate'].includes(identity.activity)?'bird':'villager' : journey.traveller,
      season: objective.season,
      progress: sim.progress(objective),
      count: objective.count,
      done,
      note,
      upcoming,
    };
  }

  // ── What the simulation tells us ────────────────────────────────────────

  private onSeason(season: Season, year: number): void {
    this.view?.setSeason(season);
    if (this.phase === 'menu') return;
    if (this.session) {
      this.ui.announceSeason(season, year);
      this.session.onSeason();
      return;
    }
    this.audio.setScene(SCENES[season]!);
    this.audio.play('season');
    this.ui.announceSeason(season, year);
    if(this.sim.expedition)return;
    // A new season is a moment to take stock: the routes show themselves briefly.
    this.tool?.showRoutes(5);
    const entry = (['full-year', 'summer', 'autumn', 'winter'] as const)[season];
    if (season !== 0 || year > 1) this.discover(entry);
    if (year === 1 && season === 1) this.tip('seasons', 'The year turns on its own. Each season brings its own wishes; the faint cards show what is coming.');
    if (year === 1 && season === 2) this.tip('grove', 'Hold still on open ground to plant a grove, where corridors can meet.');
  }

  /** Shows a guiding line once per valley. */
  private tip(id: string, text: string): void {
    if (this.tipsShown.has(id) || this.phase !== 'play') return;
    this.tipsShown.add(id);
    this.ui.hint(text);
    this.hintTimer = 9;
  }

  /** Records a journal card the first time its subject is seen. */
  private discover(id: string): void {
    if (this.phase === 'menu' || this.save.journal.includes(id)) return;
    const card = this.journalCards().find((c) => c.id === id);
    if (!card) return;
    this.save.journal.push(id);
    writeSave(this.save);
    this.ui.journalFound({ ...card, found: true });
  }

  private journalCards(): JournalCard[] {
    const state=this.sim?.state.adventure??this.save.journey?.adventure??this.save.free?.adventure;
    if (state?.version === ADVENTURE_VERSION) {
      const after = state.voyage === 'ended' || state.free;
      const found = (id: string): boolean => !!state.discoveries[id] || id.endsWith('-meeting') && state.people.some(p => p.id === id.replace('-meeting', ''));
      return FINDS.filter((f) => (state.free || !FREE_PLAY_FINDS.has(f.id)) && (found(f.id) || after)).map((f) => ({
        id: f.id, title: f.name, text: findText(f, state.free), kind: ['wildlife', 'birds', 'fish'].includes(f.category) ? 'wildlife' : 'place', found: found(f.id),
      }));
    }
    // No river walked yet (or a save from an older version): the journal is still blank.
    return [];
  }

  private onArrive(x: number, y: number, journeyId: string, traveller: string, season: Season): void {
    if (this.phase === 'menu') return;
    this.view!.arrival(x, y);
    if(this.sim.expedition)return;
    this.discover(traveller === 'villager' ? 'villagers' : traveller);
    if (this.clock - this.lastArrivalSound > 0.5) {
      this.lastArrivalSound = this.clock;
      const screen = this.view!.camera.worldToScreen({ x, y }).x / Math.max(1, this.app.screen.width);
      this.audio.play('arrive', { pan: Math.max(-1, Math.min(1, screen * 2 - 1)) * 0.6 });
    }
    const state = this.sim.state;
    const total = state.arrivals[journeyId]!.reduce((a, b) => a + b, 0);
    const who = traveller === 'bird' ? 'flock' : traveller;
    const when = `${SEASON_NAMES[season].toLowerCase()} of year ${this.sim.year}`;
    if (total === 1 && state.moments.length < 6) state.moments.push(`The first ${who} made the journey in ${when}.`);
  }

  /** A wish has been granted: the place it leads to flourishes. */
  private onWish(objective: ObjectiveDef): void {
    if (this.phase === 'menu') return void this.view?.flourish(objective, false);
    this.view!.flourish(objective, true);
    this.audio.play('objective');
    this.ui.celebrateObjective(objective.id);
    this.discover(`wish:${objective.id}`);
    const identity=identityForObjective(objective.id,this.sim.state.identities);
    const place=identity?this.sim.board.places.find(p=>p.id===identity.place):undefined;
    this.sim.state.moments.unshift(identity ? `${place?.name??'The valley'} found its rhythm as a ${identity.title.toLowerCase()}. ${identity.description}` : objective.story);
    this.persist();
  }

  /** Records the blossoms a finished reach earned. */
  private recordReach(index: number): void {
    const reach = this.sim.reaches[index]!;
    if (!this.save.completed.includes(reach.id)) this.save.completed.push(reach.id);
    this.save.best[reach.id] = Math.max(this.save.best[reach.id] ?? 0, this.sim.state.ratings[index] ?? 0);
  }

  /** A reach is in song and the one below has opened. The player is told, then follows the river down. */
  private onChapter(finished: number): void {
    if (this.phase !== 'play') return;
    this.recordReach(finished);
    this.persist();
    this.audio.play('complete');
    this.tool?.clearSelection();
    this.pointer!.enabled = false;
    this.phase = 'results';
    this.ui.showHud(false);
    this.ui.hint(null);
    this.ui.showResults(this.resultModel(true, finished));
  }

  /** After a chapter's results: the mist lifts and the view travels down to the new reach. */
  private followRiver(): void {
    this.ui.hideResults();
    this.ui.showHud(true);
    this.phase = 'play';
    this.pointer!.enabled = true;
    this.view!.camera.rate = 1.4;
    this.view!.openReach();
    this.introduceReach();
    this.discover('downstream');
  }

  /** The last reach is complete: the whole valley is in song. */
  private onWon(): void {
    if (this.phase !== 'play') return;
    const board = this.sim.board;
    this.recordReach(this.sim.reaches.length - 1);
    this.persist();
    this.audio.play('complete');
    this.tool?.clearSelection();
    this.ui.showHud(false);
    this.ui.hint(null);
    this.pointer!.enabled = false;
    this.phase = 'tour';
    this.speed = 1;
    // Let the world itself report the result: visit each place that has flourished, from the mountains down.
    const camera = this.view!.camera;
    const near = Math.min(1.1, camera.fitZoom * 2.1);
    const stops: Array<Vec & { zoom: number }> = [];
    const visited = new Set<string>();
    for (const objective of board.objectives) {
      const journey = board.journeys.find((j) => j.id === objective.journey);
      if (!journey || visited.has(journey.to)) continue;
      visited.add(journey.to);
      const to = placeById(board, journey.to);
      stops.push({ x: to.x, y: to.y, zoom: near });
    }
    stops.sort((a, b) => a.y - b.y);
    // A long valley would make a long tour: keep to a handful of stops, spread along the river.
    const few = stops.length > 6 ? stops.filter((_, i) => i % Math.ceil(stops.length / 6) === 0) : stops;
    few.push({ x: board.width / 2, y: few.length ? few[few.length - 1]!.y : board.height / 2, zoom: camera.fitZoom });
    this.tour = { stops: few, index: -1, wait: 0 };
  }

  private advanceTour(dt: number): void {
    const tour = this.tour!;
    const camera = this.view!.camera;
    tour.wait -= dt;
    if (tour.wait > 0) return;
    tour.index++;
    const stop = tour.stops[tour.index];
    if (!stop) {
      this.tour = null;
      camera.rate = 9;
      this.phase = 'results';
      this.ui.showResults(this.resultModel(true));
      return;
    }
    camera.rate = this.reducedMotion ? 9 : 1.1;
    camera.focus(stop.x, stop.y, stop.zoom);
    tour.wait = this.reducedMotion ? 1.2 : 3.4;
  }

  /** The allotted years are up with wishes ungranted. The player is told why, and may simply carry on. */
  private onOvertime(): void {
    if (this.phase !== 'play') return;
    this.persist();
    this.tool?.clearSelection();
    this.pointer!.enabled = false;
    this.phase = 'results';
    this.ui.showHud(false);
    this.ui.showResults(this.resultModel(false));
  }

  /** `finished` is the reach just completed, when the results are for a chapter rather than the whole Journey. */
  private resultModel(won: boolean, finished = this.sim.state.chapter): ResultModel {
    const sim = this.sim;
    const reach = sim.reaches[finished]!;
    const wishes = sim.board.objectives.filter((o) => (o.reach ?? 0) === finished);
    const last = finished >= sim.reaches.length - 1;
    return {
      won,
      valley: reach.name,
      headline: won ? (last && sim.reaches.length > 1 ? 'The whole river is in song' : `${reach.name} is in song`) : `Two years in ${reach.name}`,
      journeys: wishes.map((o) => ({ title: o.title, text: o.text, done: sim.isGranted(o) })),
      moments: sim.state.moments.slice(0, 2),
      shortfalls: won ? [] : wishes.filter((o) => !sim.isGranted(o)).map((o) => explainShortfall(sim, o)),
      hasNext: won && !last,
      blossoms: won ? sim.blossoms() : [],
    };
  }

  // ── Selection and edits ─────────────────────────────────────────────────

  private describeSelection(selection: Selection): SelectionView | null {
    if (!selection) return null;
    if (selection.kind === 'place') {
      const place = selection.place;
      const presentation = placePresentation(place);
      const wish = this.sim.wishes.find((o) => {
        if (this.sim.isGranted(o) || o.season !== this.sim.season) return false;
        const journey = this.sim.board.journeys.find((j) => j.id === o.journey);
        return journey?.from === place.id || journey?.to === place.id;
      });
      const chosen = identityFor(place.id,this.sim.state.identities[place.id]);
      const choices = identitiesFor(place.id);
      return { title: chosen ? `${place.name} · ${chosen.title}` : place.name, detail: chosen ? `${chosen.description} ${this.sim.life.problem(place.id) ?? chosen.needs}` : `${place.note} ${wish ? `This season: ${wish.text}` : presentation.hint}`, tone: 'info', removable: place.kind === 'grove' || place.kind === 'reeds',
        identity: choices.length ? { place:place.id, current:chosen?.id??'', choices:choices.map((d)=>({id:d.id,title:d.title,description:d.description,needs:d.needs,tradeoff:d.tradeoff+' Changing use can retire incompatible routes; Undo restores them.'})) } : undefined };
    }
    if (selection.kind === 'bed') {
      const bed = this.sim.river.beds.find((b) => b.id === selection.id);
      if (!bed) return null;
      const name = bed.def.name ?? 'an old river bed';
      return { title: name.charAt(0).toUpperCase() + name.slice(1), detail: 'Dry now. Hold still here and the river returns to it, for two brushstrokes. Fish could swim it.', tone: 'info', removable: false };
    }
    if (selection.kind === 'stones') {
      const used = this.sim.connections.some((c) => c.crossings.some((x) => x.ford?.id === selection.id));
      return { title: 'Your stepping stones', detail: used ? 'A route crosses here. The spring melt covers them, and fish keep away while they are in use.' : 'Laid by you. Draw a route across them. The spring melt will cover them.', tone: 'info', removable: !used };
    }
    const connection = this.sim.connections.find((c) => c.id === selection.id);
    if (!connection) return null;
    const now = closureOf(connection, this.sim.season);
    const shut = ([0, 1, 2, 3] as Season[]).filter((s) => closureOf(connection, s));
    const crossing = connection.crossings[0];
    const how = !crossing ? 'Stays on dry ground' : crossing.style === 'bridge' ? 'Crosses by footbridge' : `Crosses at ${crossing.ford?.name ?? 'the stones'}`;
    const when = shut.length ? `closed in ${shut.map((s) => SEASON_NAMES[s].toLowerCase()).join(' and ')}` : 'open all year';
    return {
      title: connection.type === 'corridor' ? 'Woodland corridor' : 'Footpath',
      detail: now ? `${describeClosure(now)} Drag the line to reshape it.` : `${how}; ${when}. Drag the line to reshape it.`,
      tone: now ? 'closed' : 'open',
      removable: true,
    };
  }

  private afterEdit(kind?: 'draw' | 'reshape' | 'remove' | 'plant' | 'open' | 'stones'): void {
    if (this.sim.expedition) return;
    this.ui.setSelection(this.describeSelection(this.tool?.selected ?? null));
    if (kind === 'reshape') this.discover('reshape');
    const routes = this.sim.connections;
    if (routes.length) {
      this.discover('first-line');
      // The first route is down: stop pointing and let the valley speak.
      this.tool?.hintPlaces([]);
      if (this.hintTimer <= 0) this.ui.hint(null);
    }
    const crossings = routes.flatMap((c) => c.crossings);
    if (crossings.some((c) => c.style === 'stones')) this.discover('stepping-stones');
    if (crossings.some((c) => c.style === 'bridge')) {
      this.discover('footbridge');
      if (this.sim.state.mode === 'journey') this.tip('bridge', 'A footbridge takes two brushstrokes, and stays open all year.');
    }
    if (this.sim.state.planted.some((p) => p.kind === 'grove')) this.discover('grove');
    if (this.sim.state.planted.some((p) => p.kind === 'reeds')) this.discover('reeds');
    if (this.sim.state.opened.length) this.discover('channel');
    if (this.sim.state.stones.length) this.discover('laid-stones');
    this.persist();
  }

  /**
   * A Journey opens Wander for good once it comes down into Mio's mist, or once
   * its first year has passed (wherever the companions are), with a title over
   * the valley the first time.
   */
  private openWander(): void {
    if (this.save.wanderOpen || this.replayingCredits || this.sim.state.mode !== 'journey') return;
    const s = this.sim.expedition?.state;
    if (!s) return;
    // Told during the day, before the evening: partway down the walk into Mio's mist, or out on the year's first new day.
    const walkingToMio = s.phase === 'day' && s.moving && s.elapsed > 10 && s.outings.some((o) => placeDef(o.place).region >= 1);
    if (!(walkingToMio || s.region >= 1 || (s.phase === 'day' && yearOf(s.day) >= 2))) return;
    const already = WANDER_ALWAYS_OPEN || !!this.save.free;
    this.save.wanderOpen = true;
    this.persist();
    if (!already) this.ui.announceOpened?.('Wander', 'The whole river, at your own pace. Now on the menu.');
  }

  private persist(): void {
    this.sinceSave = 0;
    if (this.replayingCredits) return;
    if (this.phase !== 'menu' && this.sim) {
      if (this.sim.state.mode === 'journey') {
        this.save.journey = structuredClone(this.sim.state);
      }
      else this.save.free = structuredClone(this.sim.state);
    }
    writeSave(this.save);
  }

  // ── Menu ────────────────────────────────────────────────────────────────

  menuModel(): MenuModel {
    const resumable = this.save.last === 'journey' ? this.save.journey : this.save.last === 'free' ? this.save.free : null;
    let label = '';
    if (resumable) {
      // A label is never worth a hung title screen: anything odd in the save just leaves it blank.
      try {
        const board = boardById(resumable.boardId);
        const probe = resumable.adventure ? null : new Simulation(board, structuredClone(resumable));
        if (resumable.adventure) label = resumable.mode === 'free' ? `${wanderPlace(resumable.adventure)} · Wander` : `Day ${resumable.adventure.day} · ${REGIONS[resumable.adventure.region]?.name ?? 'Seseragi'}`;
        else label = `${probe!.reach.name} · ${SEASON_NAMES[probe!.season]}, year ${probe!.year}${resumable.mode === 'free' ? ' · Wander' : ''}`;
      } catch {
        label = '';
      }
    }
    return { wanderOpen: WANDER_ALWAYS_OPEN || this.save.wanderOpen || !!this.save.free, journeyComplete: this.save.journey?.adventure?.version === ADVENTURE_VERSION && this.save.journey.adventure.voyage === 'ended', hasJourney:!!this.save.journey,journeyLabel: this.save.journey?.adventure?.version === ADVENTURE_VERSION ? `Day ${this.save.journey.adventure.day} · ${REGIONS[this.save.journey.adventure.region]?.name ?? 'Seseragi'}` : undefined,wanderLabel: this.save.free?.adventure?.version === ADVENTURE_VERSION ? wanderPlace(this.save.free.adventure) : undefined, canContinue: !!resumable, continueLabel: label, valleys:[], settings: this.save.settings, journal: this.journalCards() };
  }

  /**
   * Opens a valley. `id` may name the valley or one of its reaches. A Journey
   * begun at the first reach starts afresh; choosing a later reach returns to
   * the Journey in progress and shows that part of the river. Free Play always
   * picks up where it was left.
   */
  private start(mode: GameMode, id: string, resume: boolean): void {
    const board = (id==='river-adventure' || id==='seseragi' || id==='mio' || id==='kawagiri') ? adventureValley : BOARDS.find((b) => b.id === id || b.reaches?.some((r) => r.id === id)) ?? boardById(id);
    const index = Math.max(0, board.reaches?.findIndex((r) => r.id === id) ?? 0);
    const saved = mode === 'journey' ? this.save.journey : this.save.free;
    const usable = saved && saved.boardId === board.id ? structuredClone(saved) : null;
    // Each new run along the river gets its own year: its own weather, water, sightings and signs.
    // (The valley itself is drawn from the board's seed, so it looks the same every time.)
    const seed = board.id === adventureValley.id ? (Math.random() * 2 ** 32) >>> 0 : board.seed;
    const state = usable && (resume || index > 0) ? usable : newGameState(board, mode, seed);
    if (board.id === adventureValley.id && !state.adventure) {
      state.adventure = newAdventure(mode === 'free', false, mode === 'free' ? USUAL_COURSE : courseOf(state.seed));
      // A Journey that will open Wander at Mio says so in its journal there (not while Wander is always open for making it).
      if (mode === 'journey') state.adventure.opensWander = !WANDER_ALWAYS_OPEN && !this.save.wanderOpen;
      state.chapter = 0;
    }
    // The view is built from the chapter, so it must already say how much of the
    // river is open: all of it in Free Play, otherwise as far as the friends have come.
    // The selected slot defines the mode, including saves from older builds.
    state.mode = mode;
    if (state.adventure) {
      if (mode === 'free' && state.adventure.voyage === 'ended') {
        const valley = new Simulation(board, state);
        valley.expedition!.returnToValley();
        valley.expedition!.nextMorning();
      }
      state.adventure.free = mode === 'free';
      state.chapter = state.adventure.free ? (board.reaches?.length ?? 1) - 1 : state.adventure.region ?? 0;
    }
    // A Journey begun afresh opens slowly on the hut at dawn; a loaded one goes straight to its page.
    const opening = mode === 'journey' && state !== usable && !!state.adventure && !this.skipOpening;
    this.play(board, state, opening);
    if (index > 0 && index <= this.sim.state.chapter) this.view!.showReach(index);
  }

  private makeActions(): UiActions {
    return {
      expedition: (command) => {
        if (this.replayingCredits && command.type === 'continue-valley') return void this.showMenu(true);
        // A pause left on from the morning would hold the boat at the dock, with its controls hidden.
        if (command.type === 'sail' && this.paused) { this.paused = false; this.audio.setPaused(false); }
        return this.session?.command(command);
      },
      reviewStage: (stage) => {
        if (!REVIEW_TOOLS) return;
        this.persist(); this.replayingCredits = true;
        this.play(adventureValley, reviewGame(stage));
      },
      replayCredits: () => {
        this.persist();
        const source = this.save.last === 'free' ? this.save.free : this.save.journey;
        this.replayingCredits = true;
        this.play(adventureValley, creditsReplay(source));
      },
      openCredits: () => this.ui.showCredits?.(),
      finishJourney: () => {
        if (!this.replayingCredits && this.sim?.expedition?.state.voyage === 'ended') {
          this.persist();
          if (this.sim.state.mode === 'free') this.sim.expedition.returnToValley();
          // The completed Journey is kept; offer its valley as Free Play when that slot is empty.
          if (!this.save.free) {
            const free = new Simulation(adventureValley, structuredClone(this.sim.state));
            free.expedition!.returnToValley();
            free.expedition!.nextMorning();
            this.save.free = structuredClone(free.state);
          }
        }
        this.showMenu();
      },
      cue: (cue) => this.audio.cue(cue),
      startJourney: (id) => this.start('journey', id, false),
      // Free Play is a standing sandbox: reopening a valley picks up where it was left.
      startFreePlay: (id) => this.start('free', id, true),
      resumeJourney:()=>{const state=this.save.journey;if(state)this.start('journey',state.boardId,true);else this.start('journey','river-adventure',false);},
      continueGame: () => {
        const state = this.save.last === 'free' ? this.save.free : this.save.journey;
        if (state) this.start(state.mode, state.boardId, true);
      },
      holdEvening: () => { this.paused = true; },
      togglePause: () => {
        this.paused = !this.paused;
        this.audio.setPaused(this.paused);
      },
      setSpeed: (speed) => (this.speed = speed),
      skipSeason: () => {
        if (this.phase !== 'play') return;
        if (this.session) return this.session.command({ type: 'skip' });
        this.sim.skipToNextSeason();
        this.persist();
      },
      undo: () => {
        if (this.history.undo()) this.audio.play('remove');
        this.afterEdit();
      },
      redo: () => {
        if (this.history.redo()) this.audio.play('connect');
        this.afterEdit();
      },
      fitView: () => this.view?.camera.fit(),
      showPlaces: () => this.tool?.showPlaces(),
      toggleRoutes: () => {
        if (this.tool) this.tool.routesVisible = !this.tool.routesVisible;
      },
      chooseIdentity: (place,id) => {
        if(!identityFor(place,id))return;
        const commit=this.history.begin();
        const result=this.sim.chooseIdentity(place,id as IdentityId);
        if(!result.ok)return void this.ui.toast(result.reason);
        commit(0);this.afterEdit();this.persist();this.audio.play('connect');
        if(['fishing-reach','mill-reach'].includes(id))this.tool?.hintPlaces(['seseragi','fuchi-landing'],6);
      },
      removeSelected: () => this.tool?.removeSelected(),
      openJournal: () => {
        if (this.session) { this.ui.openNotebook('journal'); return; }
        const saved = this.save.journey ?? this.save.free;
        if (saved?.adventure && this.ui.showArchive) {
          const archive = new Simulation(adventureValley, structuredClone(saved));
          this.ui.showArchive({ ...archive.expedition!.view(), phase: 'night' });
        } else this.ui.showJournal(this.journalCards());
      },
      reviewObjective: (id) => {
        const objective = this.sim.board.objectives.find((o) => o.id === id);
        const journey = this.sim.board.journeys.find((j) => j.id === objective?.journey);
        if (!journey || !this.view) return;
        const identity=identityForObjective(objective!.id,this.sim.state.identities);
        const activity=identity && identity.id!=='fish-run';
        const from = placeById(this.sim.board, activity?(['graze'].includes(identity.activity)?'kamimori':['birds'].includes(identity.activity)?'kagami':identity.activity==='pollinate'?identity.place:'seseragi'):journey.from);
        const to = placeById(this.sim.board, activity?(identity.place==='seseragi-pool'?'fuchi-landing':identity.place):journey.to);
        const camera = this.view.camera;
        const span = Math.hypot(from.x - to.x, from.y - to.y) + from.radius + to.radius + 200;
        const zoom = Math.max(camera.fitZoom, Math.min(1, Math.min(this.app.screen.width, this.app.screen.height) / span));
        camera.focus((from.x + to.x) / 2, (from.y + to.y) / 2, zoom);
        this.tool?.hintPlaces([from.id, to.id], 4);
        this.tool?.showRoutes(4);
      },
      openMenu: () => this.showMenu(this.replayingCredits),
      setVolumes: (music, sfx) => {
        this.save.settings.music = music;
        this.save.settings.sfx = sfx;
        this.audio.setVolumes(music, sfx);
        writeSave(this.save);
      },
      setReducedMotion: (value) => {
        this.save.settings.reducedMotion = value;
        this.view?.setReducedMotion(this.reducedMotion);
        writeSave(this.save);
      },
      resetProgress: (scope) => {
        this.save = clearProgress(this.save, scope);
        writeSave(this.save);
        if (this.phase === 'menu' && this.view) {
          // Refresh the saved-game entries in place; the title valley is still the same scene.
          this.ui.showMenu(this.menuModel());
        } else {
          // Do not persist the game whose progress has just been cleared.
          this.phase = 'menu';
          this.showMenu();
        }
      },
      keepWatching: () => {
        // After a chapter's results there is nothing to keep watching but the river going on.
        if (this.sim.state.outcome === 'playing' && !this.sim.state.overtime && this.sim.state.lastRating && this.phase === 'results' && this.sim.state.chapter > 0 && this.sim.state.tick === this.sim.state.chapterTick) return this.followRiver();
        this.ui.hideResults();
        this.ui.showHud(true);
        this.phase = 'play';
        this.pointer!.enabled = true;
        this.view!.camera.rate = 9;
      },
      retry: () => this.start('journey', this.sim.board.id, false),
      // "Next" after a chapter: the mist lifts from the reach below, on the same valley.
      nextValley: () => this.followRiver(),
      toMenu: () => this.showMenu(),
      gesture: () => this.audio.unlock(),
    };
  }

  /** What the expedition session needs from the game. */
  private sessionHost(): ConstructorParameters<typeof AdventureSession>[0] {
    const game = this;
    return {
      app: this.app,
      get ui() {
        return game.ui;
      },
      audio: this.audio,
      get paused() {
        return game.paused;
      },
      get speed() {
        return game.speed;
      },
      get reducedMotion() {
        return game.reducedMotion;
      },
      get creditsReplay() { return game.replayingCredits; },
      persist: () => this.persist(),
    };
  }

  private key(e: KeyboardEvent): void {
    if (e.defaultPrevented || this.phase !== 'play' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName) && e.key !== 'Escape') return;
    const camera = this.view!.camera;
    const a = this.actions;
    // The player's own keys take the camera back from any scripted glide.
    if (/^(a|d|w|s|Arrow.*)$/i.test(e.key)) camera.interrupt();
    if (this.session?.key(e)) return void e.preventDefault();
    if (this.session && ['j', 'J', 'b', 'B'].includes(e.key)) {
      this.ui.openNotebook(e.key.toLowerCase() === 'b' ? 'make' : 'plan');
      e.preventDefault();
      return;
    }
    const handled = ((): boolean => {
      switch (e.key) {
        case ' ':
          return a.togglePause(), true;
        case '1':
          return a.setSpeed(1), true;
        case '2':
          return a.setSpeed(2), true;
        case '3':
        case '4':
          return a.setSpeed(4), true;
        case 'n':
        case 'N':
          return a.skipSeason(), true;
        case 'z':
        case 'Z':
          return e.shiftKey ? a.redo() : a.undo(), true;
        case 'y':
        case 'Y':
          return a.redo(), true;
        case 'f':
        case 'F':
        case '0':
          return a.fitView(), true;
        case 'p':
        case 'P':
          return a.showPlaces(), true;
        case 'c':
        case 'C':
          return a.toggleRoutes(), true;
        case 'Delete':
        case 'Backspace':
          return a.removeSelected(), true;
        case 'Escape':
          return this.tool?.selected ? this.tool.clearSelection() : a.openMenu(), true;
        case 'a':
        case 'A':
        case 'ArrowLeft':
          return camera.panBy(90, 0), true;
        case 'd':
        case 'D':
        case 'ArrowRight':
          return camera.panBy(-90, 0), true;
        case 'w':
        case 'W':
        case 'ArrowUp':
          return camera.panBy(0, 90), true;
        case 's':
        case 'S':
        case 'ArrowDown':
          return camera.panBy(0, -90), true;
        case '+':
        case '=':
          return camera.zoomAt(this.app.screen.width / 2, this.app.screen.height / 2, 1.25), true;
        case '-':
        case '_':
          return camera.zoomAt(this.app.screen.width / 2, this.app.screen.height / 2, 0.8), true;
        default:
          return false;
      }
    })();
    if (handled) e.preventDefault();
  }

  /**
   * Development only (`?play&finale`): a late journey, played to the morning
   * the boat is ready by the playtest bot, one tap from sailing.
   */
  async startFinale(): Promise<void> {
    if (!import.meta.env.DEV) return;
    const { PlaytestBot } = await import('./adventure/bot');
    const state = newGameState(adventureValley, 'journey', adventureValley.seed);
    state.adventure = newAdventure();
    const sim = new Simulation(adventureValley, state);
    const rules = sim.expedition!;
    const bot = new PlaytestBot(rules, adventureValley.seed);
    for (let i = 0; i < 60 && !rules.canSail; i++) bot.playDay();
    this.play(adventureValley, sim.state);
  }

  /** Test and debugging hooks; not used by the game itself. */
  get debug(): { sim: Simulation; view: ValleyView | null; phase: Phase } {
    return { sim: this.sim, view: this.view, phase: this.phase };
  }
}

export type { Sfx };

/** Where a Wander valley was left: its day, and the reach where camp is now (the first friend's home). */
function wanderPlace(adventure: AdventureState): string {
  const lead = FREE_PLAY_ORDER.map((id) => adventure.people.find((p) => p.id === id)).find((p) => p !== undefined);
  return `Day ${adventure.day} · ${REGIONS[lead?.base ?? adventure.region]?.name ?? 'Mio'} · Wander`;
}

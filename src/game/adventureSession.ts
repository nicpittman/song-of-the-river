/**
 * The expedition's side of the game session: it carries news between the
 * rules (`ExpeditionAdventure`), the valley layer, the notebook, the pointer
 * and the audio. It holds no rules of its own.
 *
 * Every frame: the rules step (unless paused), the valley is synced to the
 * rules' scene, and the paper tags are projected to the screen. A few times a
 * second, and whenever something changes: the notebook gets a fresh view, and
 * the audio its scene and listener. The camera only moves on its own at the
 * edges of the day: to the hearth at dusk, and home in the morning.
 */

import { arrivalOf as courseArrival } from './adventure/course';
import { livesInWater } from './adventure/waterHabitat';
import type { Application } from 'pixi.js';
import { clamp, dist, type Vec } from './core/math';
import type { AudioDirector } from './audio/audio';
import type { ExpeditionAdventure } from './adventure/expedition';
import type { AdventureCommand, AdventureView, Cue, DayPhase, ScreenTag, StructureKind, TagView } from './adventure/model';
import { completeSets } from './adventure/collections';
import { PLACES } from './adventure/content';
import { REGIONS, regionAt } from './adventure/regions';
import { eveningFire, homeRegion, lodgingOf, openedTo, setOutFrom } from './adventure/world';
import { campOf } from './adventure/regions';
import { openGround } from './adventure/conditions';
import { seat } from './adventure/campSeats';
import { WalkingMap } from './adventure/navigation';
import { QUIET, QuietPace, lookaheadSeconds } from './quietPace';
import type { CampDay, HomeInfo } from './rendering/adventure/campLife';
import { watchedPerson } from './adventure/sightings';
import { gatheringView, landingView, voyageCamera, voyageCutCover, voyageStops, VOYAGE_CUT, type Stop } from './adventure/finale';
import { buildTags } from './adventure/view';
import { stanceOf, workSite } from './adventure/scene';
import { CAMP_GATHER_SECONDS, DAY_PLAY_SECONDS, DAY_SECONDS } from './adventure/calendar';
import { arrivalOf } from './adventure/travel';
import { AdventureInput } from './interaction/adventureInput';
import type { ValleyView } from './rendering/view';
import type { Simulation } from './simulation/simulation';
import type { Ui } from '../ui/contract';
import { type Answer, yes } from './adventure/construction';
import { OPENING } from './adventure/narrative';
import { FiresideUnpack, LEAD_TAG, isQuiet } from './rendering/adventure/fireside';
import { travelFraming } from './travelFraming';
import { REVEAL_TIMES, type RevealPlan, crestTime, revealBeats, revealEdge } from './rendering/adventure/reveal';

/** How often the notebook and the soundscape are refreshed when nothing has changed. */
const REFRESH_SECONDS = 0.25;
/** Below this width the notebook is a bottom sheet, so framed subjects sit higher on screen. */
const NARROW = 700;
/** At or below this width the view holds one friend's part of the reach, so creatures are asked to show near them (see `SightingWatch`). */
const PHONE = 760;
/** Zoom at which the friends read clearly at home, on a phone and on a desktop. */
const HOME_ZOOM = { narrow: 0.6, wide: 0.62 };
/** The least time a day caption stays up, in real milliseconds, at any game speed. */
const READ_MS = 6500;
/** How far down the screen the group round the fire sits while the bundles are set down. */
const FIRE_GROUP_AT = 0.6;
/** The rules' own unpacking sounds, which the fireside replaces with its own while it plays. */
const UNPACK_CUES = new Set<Cue>(['unpack', 'find', 'rare-find', 'lead', 'supplies']);
const WATERFALLS: Vec[] = PLACES.filter((p) => p.habitat === 'waterfall').map((p) => p.at).concat([{ x: 2110, y: 800 }]);
/**
 * The slow open of a new Journey (seconds): the view rests close on the hut,
 * Sora steps out of the cottage to the fire, the opening line settles over
 * the valley, then the view eases out and the book opens on Today.
 */
const OPENING_TIMES = { stepOut: 1.4, walk: 3.3, easeOut: 5.4, end: 10 };
/** The cottage door at Yamagoya, where Sora steps out (see the board's camp sprites). */
const COTTAGE_DOOR: Vec = { x: 728, y: 390 };
/** How close the view rests on the hut at the very start. */
const OPENING_ZOOM = { narrow: 1.3, wide: 1.55 };
/**
 * The travel day's unveiling (see `rendering/adventure/reveal.ts`): the
 * landmarks of each reach that come into light as the mist rolls back, in the
 * order of the river, and the one line that goes with the reach's name when
 * the group crests into view of it. Presentation only.
 */
const REVEAL: Record<number, { landmarks: string[]; line: string }> = {
  1: { landmarks: ['ringozaka', 'mio', 'kurumaya', 'kitsuneyama', 'omagari'], line: 'Orchards on the slope, a mill wheel turning, and smoke from the roofs below.' },
  2: { landmarks: ['matsubara', 'shirasagi', 'shiobashi', 'ashikari'], line: 'The reed cutters make room by their fire. Across the bridge, the path goes on towards the sea.' },
};
/** Kawagiri when the high path brings the group down the east bank. */
const REVEAL_EAST = { landmarks: ['shiobashi', 'east-marsh', 'fish-traps', 'kawagiri'], line: 'Pines give way to dunes, boats drawn up on the sand, and the sea beyond.' };
/** How long the reach's name and line stay up once it crests into view (travel-day seconds, at reading pace). */
const CREST_SECONDS = 6.5;
/** Where the mist's edge lies for a reach: a little below its foot (as the view's own mist line). */
const mistBelow = (region: number): number => REGIONS[region]!.bottom + 300;
/** The middle of some points. */
const mean = (points: Vec[]): Vec => ({ x: points.reduce((sum, p) => sum + p.x, 0) / points.length, y: points.reduce((sum, p) => sum + p.y, 0) / points.length });
/** Gestures that keep a quiet stretch from speeding up. */
const GESTURES = ['pointerdown', 'wheel', 'keydown', 'touchstart'] as const;
const WETLANDS: Vec[] = PLACES.filter((p) => ['reeds', 'pond', 'tarn', 'saltmarsh', 'creek'].includes(p.habitat)).map((p) => p.at);

export interface SessionHost {
  readonly app: Application;
  readonly ui: Ui;
  readonly audio: AudioDirector;
  readonly paused: boolean;
  readonly speed: 1 | 2 | 4;
  readonly reducedMotion: boolean;
  readonly creditsReplay?: boolean;
  persist(): void;
}

export class AdventureSession {
  readonly input: AdventureInput;
  private dirty = true;
  private readonly completedCollections = new Set<string>();
  private sinceRefresh = 0;
  private phase: DayPhase;
  private region: number;
  /** The voyage's camera path, worked out once when the boat sets off. */
  private voyageStops: Stop[] | null = null;
  /** The voyage time last framed, to notice the moment the view cuts. */
  private voyageCutAt = -1;
  private landscaping = false;
  /** The slow open of a new Journey, while it plays (see `OPENING_TIMES`). */
  private opening: { t: number; start: number; eased: boolean } | null = null;
  /** Tonight's unpacking at the fire, from dusk until the book opens (see `fireside.ts`). */
  private fireside: FiresideUnpack | null = null;
  /** Finish the journey from a freely panned view before any fireside words begin. */
  private firesideFocus: { at: Vec; zoom: number; taken: number; left: number } | null = null;
  /** The camp the evening view is framing now, and the camera's `taken` count when dusk framed it (a later gesture keeps the view). */
  private firesideCamp: { at: Vec; taken: number } | null = null;
  /** Day captions on screen, with when each first showed (wall clock), so none goes before it can be read. */
  private readonly captions = new Map<string, { tag: TagView; since: number }>();
  /** Today's unveiling of the next reach, while the group walks down to it. */
  private reveal: RevealPlan | null = null;
  /** The camera follows the group on a travel day until the player takes it (`Camera.taken`). */
  private travelFollow: { day: number; taken: number } | null = null;
  /** On an ordinary day the camera stays with whoever is out, until the player takes it (see `followDay`). */
  private dayFollow: { day: number; taken: number } | null = null;
  /** Quiet stretches of an ordinary day pass a little faster (see `quietPace.ts`). */
  get pace(): QuietPace {
    return (this.paceState ??= new QuietPace());
  }
  private paceState?: QuietPace;
  /** The rate the rules advanced at last frame, rules seconds per real second (for the debug readout too). */
  rate = 1;
  /** Whether last frame was quiet: nothing to read or watch, nothing coming, no recent gesture. */
  private quiet = false;
  /** Wall clock of the player's last gesture, and the camera's `taken` count last seen. */
  private gestureAt = -Infinity;
  private takenSeen = -1;
  /** Who is at home today, refreshed with the notebook (see `campDay`). */
  private home: { key: string; people: HomeInfo[] } | null = null;
  /** The view's own walking map for camp life, apart from the rules' so their cached routes are never touched. */
  private campNav: WalkingMap | null = null;
  private campDayView: CampDay | null = null;
  private readonly onGesture = (): void => { this.gestureAt = performance.now(); };

  constructor(
    private readonly host: SessionHost,
    private readonly sim: Simulation,
    private readonly view: ValleyView,
  ) {
    this.input = new AdventureInput(sim, view, (c) => this.command(c), (text) => host.ui.toast(text), () => {
      host.ui.hint(null);
      host.persist();
      this.dirty = true;
      host.ui.openNotebook('plan');
    });
    for(const set of completeSets(this.rules.state)) this.completedCollections.add(set.id);
    this.phase = this.rules.state.phase;
    this.region = this.rules.state.region;
    // A tap while the bundles are being set down skips to the book; drags still pan the map.
    const tap = this.input.tap.bind(this.input);
    this.input.tap = (at: Vec) => { if (!this.nextFireside()) tap(at); };
    // Each landmark is written in with the pen; the reach's own settlement with the longer bell.
    view.onRevealBeat = (mark) => {
      if (mark.settlement) this.host.audio.cue('region', { pan: this.panOf(mark.at) });
      else this.host.audio.cue('sketch', { pan: this.panOf(mark.at), pitch: 0.9 });
    };
    // Any touch, wheel or key of the player's holds the day at its usual pace for a few seconds.
    if (typeof window !== 'undefined') for (const type of GESTURES) window.addEventListener(type, this.onGesture, { passive: true, capture: true });
  }

  private get rules(): ExpeditionAdventure {
    return this.sim.expedition!;
  }

  /**
   * Called once the valley is open: show the interface and frame home. A new
   * Journey (`opening`) first plays its slow open over the world.
   */
  start(opening = false): void {
    const ui = this.host.ui;
    ui.hint(null);
    ui.showHud(false);
    ui.showAdventure(true);
    if (opening && this.rules.state.phase === 'morning' && this.rules.state.day === 1 && ui.playOpening) {
      this.beginOpening();
      return;
    }
    this.frameHome(true);
    this.refresh();
    if (this.rules.state.phase === 'morning') ui.openNotebook('plan');
  }

  /** Dawn at Yamagoya: the view close on the hut, and the opening line as a caption. */
  private beginOpening(): void {
    this.opening = { t: 0, start: performance.now(), eased: false };
    const camera = this.view.camera;
    camera.bottomInset = 0;
    const fire = eveningFire(this.rules.state);
    // Between the cottage and the fire, a little above, so Sora walks across the middle of the view.
    camera.focus((fire.x + COTTAGE_DOOR.x) / 2, (fire.y + COTTAGE_DOOR.y) / 2 - 6, this.narrow ? OPENING_ZOOM.narrow : OPENING_ZOOM.wide);
    camera.snap();
    this.host.ui.playOpening!(OPENING, () => this.finishOpening());
    // Hold the first notebook snapshot until the caption ends, so its opening is visible.
    this.refresh();
  }

  /** The opening ends (or is skipped): the view eases out to home and the book opens on Today. */
  private finishOpening(): void {
    const opening = this.opening;
    if (!opening) return;
    this.opening = null;
    if (!opening.eased) this.frameHome(false);
    this.host.ui.endOpening?.();
    this.dirty = true;
    this.refresh();
    if (this.rules.state.phase === 'morning') this.host.ui.openNotebook('plan');
  }

  /** While the opening plays, Sora is drawn stepping out of the cottage to the fire (view only). */
  private stageOpening(scene: ReturnType<ExpeditionAdventure['scene']>): void {
    const opening = this.opening!;
    // Wall-clock time, so a slow first few frames never stretch the opening (the caption's fade is wall-clock too).
    opening.t = ((performance.now() - opening.start) / 1000) * (this.host.reducedMotion ? 2 : 1);
    const sora = scene.figures.find((f) => f.id === 'sora');
    if (sora) {
      const { stepOut, walk } = OPENING_TIMES;
      const k = clamp((opening.t - stepOut) / (walk - stepOut), 0, 1);
      if (k < 1) {
        const seat = sora.at;
        const ease = k * k * (3 - 2 * k);
        sora.at = { x: COTTAGE_DOOR.x + (seat.x - COTTAGE_DOOR.x) * ease, y: COTTAGE_DOOR.y + (seat.y - COTTAGE_DOOR.y) * ease };
        sora.facing = seat.x < COTTAGE_DOOR.x ? -1 : 1;
        sora.pose = 'walk';
        // In the doorway at first: not yet out.
        sora.visible = opening.t > stepOut * 0.6;
      }
    }
    if (!opening.eased && opening.t >= OPENING_TIMES.easeOut) {
      opening.eased = true;
      this.frameHome(false);
      this.view.camera.rate = this.host.reducedMotion ? 9 : 1.1;
    }
    if (opening.t >= OPENING_TIMES.end) this.finishOpening();
  }

  /** True while the slow open of a new Journey is playing. */
  get openingPlaying(): boolean {
    return this.opening !== null;
  }

  /** News from the rules: a sound, perhaps, and always a refresh. */
  onAdventure(cue?: Cue, at?: Vec): void {
    this.dirty = true;
    for(const set of completeSets(this.rules.state)) if(!this.completedCollections.has(set.id)) {
      this.completedCollections.add(set.id);
      if(cue!=='sketch') this.host.audio.cue('sketch',{pitch:.92});
    }
    // While the fireside plays, its own sounds go with the tags (see `stepFireside`).
    const unpacking = this.unpacking && !!cue && UNPACK_CUES.has(cue);
    if (cue && !unpacking) this.host.audio.cue(cue, at ? { pan: this.panOf(at) } : undefined);
    // A creature arriving also makes its own small sound: water creatures a splash, the rest a rustle.
    if (cue === 'sighting' && at) {
      const sighting = this.rules.state.sightings.find((x) => x.at.x === at.x && x.at.y === at.y);
      if (sighting) this.host.audio.cue(livesInWater(sighting.find) ? 'splash' : 'rustle', { pan: this.panOf(at) });
    }
    const s = this.rules.state;
    if (s.region !== this.region) {
      this.region = s.region;
      this.view.openReach();
    }
    if (s.phase !== this.phase) this.phaseChanged(this.phase, s.phase);
  }

  onSeason(): void {
    this.host.audio.cue('season');
  }

  // ── Frame ───────────────────────────────────────────────────────────────

  frame(dt: number): void {
    const host = this.host;
    // The rules decide what time does in each phase; morning only moves life at home.
    // First meetings have a reading pace even when ordinary travel is accelerated.
    // The selected speed is retained; the free camera remains entirely available.
    const reading = this.rules.state.phase === 'day' ? buildTags(this.rules).filter(tag => tag.id.startsWith('meeting-') || tag.kind === 'choice') : [];
    const readingRate = reading.length ? Math.min(...reading.map(tag => tag.readingRate ?? .65)) : null;
    // The voyage is told in captions, so it always runs at a reading pace too.
    const voyage = this.rules.state.voyage === 'gathering' || this.rules.state.voyage === 'sailing';
    // The travel day unveils a whole reach: it keeps a reading pace too, so each name can be read as it is written.
    const travelling = this.rules.state.moving && this.rules.state.phase === 'day';
    // Shorter real-time days keep the established journey/survey/work budget.
    // First conversations, choices, chapter arrivals and the evening retain their pace.
    const daylightRate = this.rules.state.phase === 'day' ? DAY_SECONDS / DAY_PLAY_SECONDS : 1;
    // The rules cannot see the screen: on a phone, say whose part of the reach is in view.
    this.rules.watching = this.phone ? { person: this.rules.selection.person } : null;
    // An ordinary stretch of day: the player's speed, and a little more while nothing is on screen (see `quietPace.ts`).
    const ordinary = readingRate === null && this.rules.state.phase === 'day' && !voyage && !travelling;
    const boost = this.pace.step(host.paused ? 0 : dt, ordinary && this.quiet, host.speed);
    this.rate = readingRate ?? (this.rules.state.phase === 'evening' || voyage || travelling ? 1 : host.speed * daylightRate * (ordinary ? boost : 1));
    if (!host.paused) this.sim.advance(dt * this.rate);
    if (!host.paused) this.stepFireside(dt);

    const state = this.rules.state;
    host.ui.updateDaylight?.(state.phase === 'morning' ? 0 : state.phase === 'day' ? state.elapsed / DAY_SECONDS : 1, host.paused ? 0 : dt);

    const scene = this.rules.scene();
    scene.placing = this.input.placing;
    if (this.opening) this.stageOpening(scene);
    if (this.view.adventure) this.view.adventure.campDay = this.campDay();
    this.view.adventure?.sync(scene, dt, this.view.camera);
    this.stepReveal(scene);
    this.followDay(scene, reading);
    const tags = this.screenTags();
    host.ui.updateTags(tags);
    this.quiet = this.quietNow(tags, scene);
    if (this.rules.state.voyage === 'gathering' || this.rules.state.voyage === 'sailing') this.followVoyage(scene.boat?.at ?? null);
    else { this.voyageStops = null; this.voyageCutAt = -1; }


    this.sinceRefresh += dt;
    // The paper wash over the voyage's one cut is drawn every frame while it shows, so it rises and falls smoothly and is full at the cut itself.
    if (state.voyage === 'sailing' && state.free && Math.abs(state.voyageTime - VOYAGE_CUT) < 0.8) this.dirty = true;
    if (this.dirty || this.sinceRefresh >= REFRESH_SECONDS) {
      this.refresh();
      this.sound(scene.hour);
    }
  }

  private refresh(): void {
    this.dirty = false;
    this.sinceRefresh = 0;
    this.host.ui.updateAdventure(this.snapshot());
  }

  private snapshot(): AdventureView {
    const view = this.rules.view();
    view.paused = this.host.paused;
    view.speed = this.host.speed;
    view.placing = this.input.placing;
    view.landscaping = this.landscaping;
    view.creditsReplay = this.host.creditsReplay;
    // The book waits for the fireside to finish (or be skipped) before it opens on tonight's page.
    if (this.fireside && view.phase === 'evening') view.eveningReady = this.fireside.done;
    if (this.reveal) view.voyageCaption = this.travelCaption(this.reveal);
    view.voyageCut = view.voyage === 'sailing' && this.rules.state.free ? voyageCutCover(this.rules.state.voyageTime) : 0;
    return view;
  }

  private screenTags(): ScreenTag[] {
    const camera = this.view.camera;
    const width = this.host.app.screen.width;
    const height = this.host.app.screen.height;
    const headroom = 64 * camera.zoom + 10;
    const people = this.rules.state.people.map((person) => {
      const at = camera.worldToScreen(stanceOf(this.rules, person.id).at);
      return { x: at.x - 18 * camera.zoom, y: at.y - headroom, w: 36 * camera.zoom, h: headroom + 5 };
    });
    // While the bundles are set down, the fire is part of the group too: nothing covers it.
    if (this.unpacking) {
      const fire = camera.worldToScreen(eveningFire(this.rules.state));
      people.push({ x: fire.x - 30 * camera.zoom, y: fire.y - 36 * camera.zoom, w: 60 * camera.zoom, h: 50 * camera.zoom });
    }
    return [...this.readable(buildTags(this.rules).filter(tag=>!this.rules.state.moving || tag.kind!=='beat' || this.rules.state.outings.some(o=>o.detour && o.person===tag.person))), ...this.firesideTags()].map((tag) => {
      // A friend's words hang from where the friend is drawn, not where the rules have them, so the line meets them.
      // Someone not yet met is drawn as \`meeting-<id>\`: their words hang from that figure too.
      const drawn = tag.person && tag.kind !== 'unpack' ? this.view.adventure?.friendAt(tag.person) ?? this.view.adventure?.friendAt(`meeting-${tag.person}`) ?? null : null;
      const p = camera.worldToScreen(drawn ?? tag.anchor);
      return { ...tag, id:tag.id.startsWith('meeting-') ? tag.id.replace(/-\d+$/, '') : tag.id, x: p.x, y: p.y, people, headroom, visible: tag.kind === 'unpack' || (p.x > 16 && p.x < width - 16 && p.y > 16 && p.y < height - 16) };
    });
  }

  /**
   * Captions stay long enough to read whatever the game speed: at 2× or 4× a
   * day's caption would otherwise be gone in a second or two. One that the rules
   * have let go is kept (following its person) until it has shown for
   * `READ_MS`, unless that person already has a newer one.
   */
  private readable(tags: TagView[]): TagView[] {
    const now = performance.now();
    if (this.rules.state.phase !== 'day') { this.captions.clear(); return tags; }
    const out = [...tags];
    const live = new Set(tags.map((t) => t.id));
    for (const tag of tags) {
      if (tag.kind === 'beat' || tag.kind === 'sighting') {
        const seen = this.captions.get(tag.id);
        this.captions.set(tag.id, { tag, since: seen?.since ?? now });
      }
    }
    for (const [id, { tag, since }] of this.captions) {
      if (live.has(id)) continue;
      // A sketched creature's caption goes with it; the pencil flourish says the rest.
      if (tag.kind === 'sighting' && (id.endsWith('-sketched') || this.rules.state.sightings.some((x) => x.id === id && x.sketched) || this.rules.state.glints.some((x) => x.id === id && x.found))) { this.captions.delete(id); continue; }
      const conversation = id.startsWith('meeting-') ? id.replace(/-\d+$/, '') : null;
      const newer = tags.some(t => (conversation && t.id !== id && t.id.replace(/-\d+$/, '') === conversation) || (tag.person !== null && t.person === tag.person && (t.kind === 'beat' || t.kind === 'choice')));
      // Conversation lines already receive their own reading time. An extra
      // fixed hold here left the last reply hanging after the pair had moved on.
      if (conversation || now - since >= READ_MS || newer) { this.captions.delete(id); continue; }
      out.push({ ...tag, anchor: tag.person && this.rules.state.people.some(p=>p.id===tag.person) ? stanceOf(this.rules, tag.person).at : tag.anchor, remaining: 0 });
    }
    return out;
  }

  // ── The travel day ──────────────────────────────────────────────────────

  /** The plan for unveiling the reach the group is walking into today, or null. */
  private revealPlan(): RevealPlan | null {
    const s = this.rules.state;
    if (s.free || !s.moving || s.phase !== 'day' || s.region + 1 >= REGIONS.length) return null;
    const next = s.region + 1;
    const id = `reach-${next}-day-${s.day}`;
    if (this.reveal?.id === id) return this.reveal;
    const plan = next === 2 && courseArrival(s.course) === 'kawagiri' ? REVEAL_EAST : REVEAL[next];
    const ids = plan?.landmarks ?? [];
    const landmarks = ids.map((id) => PLACES.find((p) => p.id === id)).filter((p) => !!p).map((p) => ({ id: p.id, name: p.name, at: p.at, settlement: p.kind === 'settlement' || next === 2 && p.id === 'ashikari' }));
    const arrival = arrivalOf(s.outings);
    return { id, from: mistBelow(s.region), to: mistBelow(next), landmarks, arrival };
  }

  /** Each frame of a travel day: the mist rolls back with the clock, and the camera walks down with the group. */
  private stepReveal(scene: ReturnType<ExpeditionAdventure['scene']>): void {
    const plan = this.revealPlan();
    this.reveal = plan;
    const t = this.rules.state.elapsed;
    this.view.travel(plan, t);
    if (plan) this.followTravel(plan, t, scene);
    else this.travelFollow = null;
  }

  /**
   * The quiet words of a travel day: leaving, then the reach's name and one
   * line as it crests into view, then nothing until the fire.
   */
  private travelCaption(plan: RevealPlan): AdventureView['voyageCaption'] {
    const s = this.rules.state;
    const t = s.elapsed;
    if (t < 5) return { reach: `Leaving ${REGIONS[s.region]!.name}`, line: 'We follow the river down.' };
    const arrival = plan.arrival ?? 24;
    if (t >= 8 && t < Math.min(15,arrival-8)) return {reach:null,line:s.people.some(p=>p.id==='ren') ? 'Ren: “Still fresh water. We’ll have to keep going.”' : 'Sora: “The river knows the way.”'};
    if (t >= 16 && t < arrival-1) return {reach:null,line:s.people.some(p=>p.id==='mina') ? 'Mina: “Look how the trees have changed.”' : 'Sora: “I’ve never walked this far before.”'};
    const crest = crestTime(plan);
    if (crest !== null && t >= crest && t < crest + CREST_SECONDS) {
      return { reach: REGIONS[s.region + 1]!.name, line: (s.region + 1 === 2 && courseArrival(s.course) === 'kawagiri' ? REVEAL_EAST : REVEAL[s.region + 1])?.line ?? null };
    }
    return null;
  }

  /**
   * The camera eases along with the group and leans toward what is coming
   * out of the mist. Any pan, pinch, wheel, key or tap-to-follow of the
   * player's own takes over at once, for the rest of the day.
   */
  private followTravel(plan: RevealPlan, t: number, scene: ReturnType<ExpeditionAdventure['scene']>): void {
    const camera = this.view.camera;
    const day = this.rules.state.day;
    if (!this.travelFollow || this.travelFollow.day !== day) this.travelFollow = { day, taken: camera.taken };
    if (camera.taken !== this.travelFollow.taken || t > REVEAL_TIMES.end + 1.5) return;
    // The camera walks with the group; a friend stopping on the way catches up later.
    const stopping = new Set(this.rules.state.outings.filter((o) => o.detour).map((o) => o.person));
    const group = scene.figures.filter((f) => f.role === 'friend' && f.visible && !stopping.has(f.id));
    const walkers = group.length ? group : scene.figures.filter((f) => f.role === 'friend' && f.visible);
    if (!walkers.length) return;
    const c = { x: walkers.reduce((sum, f) => sum + f.at.x, 0) / walkers.length, y: walkers.reduce((sum, f) => sum + f.at.y, 0) / walkers.length };
    if (plan.arrival !== undefined && t >= plan.arrival) {
      // The greeting belongs with the group at the village, not with landmarks farther downstream.
      if (!this.host.reducedMotion) camera.ease(c.x, c.y - 65, this.narrow ? .58 : .62, .7);
      return;
    }
    // Lean toward the landmark coming into light, sideways; down the valley, keep the mist's edge in the lower part of the view.
    const beats = revealBeats(plan);
    let lean = c.x;
    let best = Infinity;
    plan.landmarks.forEach((mark, i) => {
      const age = t - beats[i]!;
      if (age > -1.5 && age < 4.5 && Math.abs(age) < best) { best = Math.abs(age); lean = mark.at.x; }
    });
    const screen = this.host.app.screen;
    camera.bottomInset = 0;
    const edge = revealEdge(plan, Math.max(t, REVEAL_TIMES.start));
    // The group near the top of the view, the lifting mist below them: as much of the reach as fits between.
    const span = Math.max(500, edge + 260 - (c.y - 160));
    const usableH = Math.max(200, screen.height - (this.narrow ? 220 : 200));
    const zoom = clamp(usableH / span, this.narrow ? 0.3 : 0.36, this.narrow ? 0.5 : 0.56);
    const halfH = screen.height / (2 * zoom);
    // The edge sits about two thirds down; never so far that the group leaves the top.
    const desiredY = edge - halfH * 0.34;
    // A phone's view is narrow: lean further, so a landmark off to the side is actually seen.
    const { x, y } = travelFraming(c, lean, desiredY, screen.width, screen.height, zoom, this.narrow);
    if (this.host.reducedMotion) {
      // No continuous drift under reduced motion: one framing of the way down, set once.
      if (t > REVEAL_TIMES.start) return;
      const settle = plan.landmarks.find((m) => m.settlement)?.at ?? c;
      const fit = clamp(usableH / (Math.abs(settle.y - c.y) + 600), 0.3, 0.6);
      camera.ease((c.x + settle.x) / 2, (c.y + settle.y) / 2, fit, 9);
      return;
    }
    camera.ease(x, y, zoom, 0.45);
  }

  /**
   * An ordinary day, after the opening glide over the plans: the view keeps
   * quiet watch over whoever is out. A conversation is framed close enough
   * to read the faces, the pair a little below the middle so the words stand
   * clear above them; between moments it walks along with them, and leans to
   * take in a creature showing nearby. On a phone it keeps to one friend.
   * Any pan, pinch, wheel, key or tap of the player's own takes over for the
   * rest of the day.
   */
  private followDay(scene: ReturnType<ExpeditionAdventure['scene']>, reading: TagView[]): void {
    const s = this.rules.state;
    const camera = this.view.camera;
    if (s.phase !== 'day' || s.moving || s.voyage === 'gathering' || s.voyage === 'sailing' || this.opening || this.host.reducedMotion) { this.dayFollow = null; return; }
    if (!this.dayFollow || this.dayFollow.day !== s.day) return;
    if (camera.taken !== this.dayFollow.taken) { this.dayFollow = null; return; }
    // Let the opening glide show the day's plans first.
    if (s.elapsed < 2.5) return;
    const drawn = (id: string): Vec | null => this.view.adventure?.friendAt(id) ?? (s.people.some((p) => p.id === id) ? stanceOf(this.rules, id).at : null);
    const out = s.outings.map((o) => o.person);
    const watched = this.phone ? watchedPerson(s, this.rules.watching) : null;
    const screen = this.host.app.screen;
    let points: Vec[] = [];
    let zoom: number;
    // A conversation (or a choice) with the friend in view: the speakers, close.
    const talk = reading.filter((tag) => !watched || tag.id.startsWith(`meeting-${watched}-`) || tag.person === watched);
    if (talk.length) {
      for (const tag of talk) {
        points.push(tag.anchor);
        const person = tag.id.startsWith('meeting-') ? tag.id.split('-')[1]! : tag.person;
        const at = person ? drawn(person) : null;
        if (at) points.push(at);
      }
      zoom = this.narrow ? 1.05 : 0.8;
    } else {
      const who = watched ? [watched] : out;
      points = who.map(drawn).filter((p): p is Vec => !!p);
      zoom = this.narrow ? 0.82 : Math.max(camera.zoom, 0.62);
      // A creature showing near them is taken in too, if it fits.
      const centre = points.length ? mean(points) : null;
      const near = centre ? scene.sightings.filter((x) => !x.id.startsWith('resident-') && !x.sketched && dist(x.at, centre) < (this.narrow ? 300 : 520)) : [];
      if (near.length) points.push(near[0]!.at);
    }
    if (!points.length) return;
    // Everything in view, with room for the words above and the bar below.
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const p of points) { left = Math.min(left, p.x); right = Math.max(right, p.x); top = Math.min(top, p.y - 64); bottom = Math.max(bottom, p.y + 10); }
    const fit = Math.min((screen.width - 60) / Math.max(1, right - left), (screen.height * 0.42) / Math.max(1, bottom - top));
    zoom = clamp(Math.min(zoom, fit), this.narrow ? 0.5 : 0.45, 1.15);
    // The subject a little below the middle: tags rise above heads, and the bar sits at the foot.
    const below = this.narrow ? 0.6 : 0.56;
    const x = (left + right) / 2;
    const y = (top + bottom) / 2 - (screen.height * below - screen.height / 2) / zoom;
    camera.ease(x, y, zoom, talk.length ? 1.1 : 0.55);
  }

  // ── Quiet stretches and camp life ───────────────────────────────────────

  /**
   * True when nothing is on screen to read or watch and nothing is about to
   * be: no words or card showing, no creature or glint, no choice waiting, no
   * beat, homecoming or creature due within a couple of real seconds, the book
   * shut, and no gesture of the player's for a few seconds.
   */
  private quietNow(tags: readonly ScreenTag[], scene: ReturnType<ExpeditionAdventure['scene']>): boolean {
    const s = this.rules.state;
    const now = performance.now();
    const taken = this.view.camera.taken;
    if (taken !== this.takenSeen) {
      if (this.takenSeen >= 0) this.gestureAt = now;
      this.takenSeen = taken;
    }
    if (s.phase !== 'day' || s.moving || s.voyage === 'gathering' || s.voyage === 'sailing' || this.opening || this.input.placing || this.host.paused) return false;
    if (now - this.gestureAt < QUIET.gesture * 1000) return false;
    if (this.host.ui.notebookOpen?.()) return false;
    if (tags.some((tag) => tag.visible)) return false;
    // A creature or a glint in view (or just outside it, where a glance finds it).
    if (scene.sightings.some((x) => !x.id.startsWith('resident-') && this.inView(x.at, 120))) return false;
    const glints = (scene as { glints?: ReadonlyArray<{ at: Vec }> }).glints;
    if (glints?.some((g) => this.inView(g.at, 120))) return false;
    // A choice waiting is always worth the usual pace, wherever it is.
    if (s.outings.some((o) => o.fork && o.fork.answer === null)) return false;
    // Anything due soon where the view is: the pace is back to usual before it shows.
    const t = s.elapsed;
    const ahead = t + lookaheadSeconds(this.rate);
    if (ahead >= DAY_SECONDS - CAMP_GATHER_SECONDS) return false;
    const soon = (at: Vec, appear: number, life: number): boolean => appear + life > t && appear <= ahead && this.inView(at, 260);
    if (s.sightings.some((x) => !x.sketched && soon(x.at, x.appear, x.life))) return false;
    const due = (s as { glints?: ReadonlyArray<{ at: Vec; appear: number; life: number; found?: boolean }> }).glints;
    if (due?.some((g) => !g.found && soon(g.at, g.appear, g.life))) return false;
    let home = s.outings.length > 0;
    for (const outing of s.outings) {
      const end = outing.legs[outing.legs.length - 1]?.end ?? 0;
      if (t < end) home = false;
      const drawn = this.view.adventure?.friendAt(outing.person) ?? stanceOf(this.rules, outing.person).at;
      if (!this.inView(drawn, 260)) continue;
      // A beat beginning (words above them), or the homecoming.
      if (end > t && end <= ahead) return false;
      for (const leg of outing.legs) if (leg.start > t && leg.start <= ahead) return false;
    }
    // Everyone back: dusk is near, and comes at its own pace.
    return !home;
  }

  /** True when a world point is on screen, or within `margin` screen pixels of it. */
  private inView(at: Vec, margin: number): boolean {
    const p = this.view.camera.worldToScreen(at);
    const screen = this.host.app.screen;
    return p.x > -margin && p.x < screen.width + margin && p.y > -margin && p.y < screen.height + margin;
  }

  /**
   * Who stays home today, with their fire, seat and the camp's spots, for the
   * view's camp life. Null on any day but an ordinary one.
   */
  private campDay(): CampDay | null {
    const s = this.rules.state;
    if (s.phase !== 'day' || s.moving || s.voyage === 'gathering' || s.voyage === 'sailing' || this.opening) { this.home = null; return null; }
    const key = `${s.day}:${s.region}:${s.outings.map((o) => `${o.person}+${o.companion ?? ''}`).join()}:${s.resting.join()}:${s.buildings.map((b) => `${b.id}:${b.work >= 0}`).join()}`;
    if (this.home?.key !== key) {
      const out = new Set(s.outings.flatMap((o) => (o.companion ? [o.person, o.companion] : [o.person])));
      const people: HomeInfo[] = [];
      s.people.forEach((person, index) => {
        if (out.has(person.id)) return;
        const base = homeRegion(s, person.id);
        const fire = setOutFrom(s, { region: base }, person.id);
        people.push({ id: person.id, fire, seat: seat(fire, index), spots: lodgingOf(s, person.id) ? [] : campOf(base).spots.map((spot) => spot.at), builder: !!workSite(this.rules, person.id) });
      });
      this.home = { key, people };
    }
    // The rules close an outing day a little after the last one home, unless someone is building.
    const builders = this.home.people.some((p) => p.builder) || s.workedOn !== null;
    const lastReturn = Math.max(8, ...s.outings.flatMap((o) => o.legs.map((l) => l.end)));
    const close = (builders || !s.outings.length ? DAY_SECONDS : Math.min(DAY_SECONDS, lastReturn + 5)) - CAMP_GATHER_SECONDS;
    const day = this.campDayView ??= { progress: 0, homeIn: 0, quiet: false, people: [], route: (from, to) => this.campRoute(from, to) };
    day.progress = s.elapsed / DAY_SECONDS;
    day.homeIn = Math.max(0, close - s.elapsed) / Math.max(0.05, this.rate);
    day.quiet = s.free;
    day.people = this.home.people;
    return day.people.length ? day : null;
  }

  /** A walking route for camp life, by today's ground, on the view's own walking map. */
  private campRoute(from: Vec, to: Vec): Vec[] | null {
    const nav = this.campNav ??= new WalkingMap(this.sim.board, this.sim.river);
    nav.setOpenGround(openGround(this.sim.board, this.rules.world().today, this.rules.state));
    return nav.route(from, to, REGIONS[openedTo(this.rules.state)]!.bottom);
  }

  // ── The fireside ────────────────────────────────────────────────────────

  private get unpacking(): boolean {
    return !!this.fireside && !this.fireside.done && this.rules.state.phase === 'evening';
  }

  /** Sets down tonight's bundles to the fireside's rhythm, then lets the book open. */
  private stepFireside(dt: number): void {
    const evening = this.rules.state.evening;
    if (!this.fireside || this.fireside.done || this.rules.state.phase !== 'evening' || !evening) return;
    // Split camps: before a bundle from another fire rises, the view goes to that fire; back to the main one for the lead.
    const camp = this.firesideCamp;
    if (camp && !this.firesideFocus && this.view.camera.taken === camp.taken) {
      const item = evening.items[evening.shown];
      const away = item && !isQuiet(item, evening.items) && this.rules.state.people.some((p) => p.id === item.person);
      const want = !item ? eveningFire(this.rules.state) : away ? setOutFrom(this.rules.state, { region: this.rules.state.region }, item.person) : camp.at;
      if (dist(want, camp.at) > 200) { this.frameFires(want); return; }
    }
    const focus = this.firesideFocus;
    if (focus) {
      const camera = this.view.camera;
      focus.left -= dt;
      // A new gesture deliberately takes the free camera. Never fight it or wait forever at a clamped edge.
      const settling = camera.taken === focus.taken && focus.left > 0 &&
        (dist(camera, focus.at) * camera.zoom > 55 || Math.abs(camera.zoom - focus.zoom) > .06);
      if (settling) return;
      this.firesideFocus = null;
    }
    const next = this.fireside.step(dt, evening.shown, evening.items.length, evening.settled);
    if (next === 'rise') {
      const item = evening.items[evening.shown]!;
      this.rules.command({ type: 'evening', step: 'next' });
      // A bundle with nothing of its own to say is set down without a tag, sound or pause.
      if (isQuiet(item, evening.items)) { this.fireside.quiet(); this.dirty = true; return; }
      this.fireside.hold(item);
      const at = stanceOf(this.rules, item.person).at;
      const opts = { pan: this.panOf(at) };
      // Quiet by default; a rare find has its chime, and the story a longer, lower one.
      if (item.hint === 'story') this.host.audio.cue('rare-find', { ...opts, pitch: 0.84 });
      else if (item.hint === 'rare') this.host.audio.cue('rare-find', opts);
      else this.host.audio.cue(item.kind === 'supplies' || item.kind === 'materials' ? 'supplies' : item.kind === 'lead' ? 'lead' : item.kind === 'find' ? 'find' : 'unpack', opts);
    } else if (next === 'settle') {
      this.rules.command({ type: 'evening', step: 'collect' });
    }
    if (next) this.dirty = true;
  }

  /** A tap or E while the bundles are being set down: the next one now (the last tap opens the book). */
  private nextFireside(): boolean {
    if (!this.unpacking) return false;
    if (this.fireside!.next()) this.rules.command({ type: 'evening', step: 'collect' });
    this.dirty = true;
    return true;
  }

  /** "Skip to journal": everything at once, and the book. */
  private skipFireside(): boolean {
    if (!this.unpacking) return false;
    this.fireside!.skip();
    this.rules.command({ type: 'evening', step: 'collect' });
    this.dirty = true;
    return true;
  }

  /** Each bundle set down so far, over whoever brought it, and then the line about tomorrow. */
  private firesideTags(): TagView[] {
    const evening = this.rules.state.evening;
    if (!this.unpacking || !evening) return [];
    const tags: TagView[] = evening.items.slice(0, evening.shown).filter((item) => !isQuiet(item, evening.items)).map((item) => ({
      id: item.id, kind: 'unpack', anchor: stanceOf(this.rules, item.person).at, person: item.person,
      sketch: item.sketch, text: item.title, pack: item.hint, choices: [], remaining: 0,
    }));
    if (this.fireside!.leadShowing && evening.tomorrow) {
      tags.push({ id: LEAD_TAG, kind: 'note', anchor: eveningFire(this.rules.state), person: null, sketch: null, text: evening.tomorrow, pack: null, choices: [], remaining: 0 });
    }
    return tags;
  }

  /**
   * Eases the view once onto the friends round the fire, close enough that
   * they read as people, with the group a little below the middle: the
   * bundles rise above their heads and the line about tomorrow settles below.
   * Any pan or zoom of the player's own takes over at once.
   */
  private frameFires(fire: Vec = eveningFire(this.rules.state)): void {
    const s = this.rules.state;
    const seats = s.people.map((p) => stanceOf(this.rules, p.id).at).filter((at) => Math.hypot(at.x - fire.x, at.y - fire.y) < 240);
    // Bodies stand about 64 units tall above where they sit.
    const xs = [fire.x, ...seats.flatMap((p) => [p.x - 20, p.x + 20])];
    const ys = [fire.y, ...seats.flatMap((p) => [p.y - 64, p.y + 6])];
    const group = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    const screen = this.host.app.screen;
    // The group takes at most about half the width and a third of the height.
    const zoom = Math.max(this.homeZoom() * 0.75, Math.min(1.7, (screen.width * 0.85) / (group.w + 40), (screen.height * 0.32) / (group.h + 20)));
    const camera = this.view.camera;
    camera.bottomInset = 0;
    const at = { x: group.x, y: group.y - (screen.height * FIRE_GROUP_AT - screen.height / 2) / zoom };
    // Firm: a drag, wheel or key still running on from the day does not cancel it; only a new gesture does.
    camera.ease(at.x, at.y, zoom, this.host.reducedMotion ? 9 : 3.6, true);
    this.firesideFocus = { at, zoom, taken: camera.taken, left: 1.8 };
    this.firesideCamp = { at: fire, taken: this.firesideCamp?.taken ?? camera.taken };
  }

  /** The soundscape follows the day and the camera. */
  private sound(hour: number): void {
    const s = this.rules.state;
    const today = this.rules.world().today;
    const camera = this.view.camera;
    const centre = { x: camera.x, y: camera.y };
    // On the voyage the sound follows the view down the river, reach by reach, into the sea.
    const region = s.voyage === 'sailing' || s.moving ? regionAt(centre) : s.region;
    this.host.audio.setScene({ season: today.season, weather: today.weather, hour, region });
    const reach = 700 / Math.max(0.2, camera.zoom);
    const nearness = (d: number): number => clamp(1 - d / reach, 0, 1) * clamp((camera.zoom - 0.2) / 0.4, 0, 1);
    const nearest = (points: Vec[]): number => Math.min(...points.map((p) => dist(p, centre)));
    const sea = this.sim.board.sea ? Math.max(0, this.sim.board.sea.y - centre.y) : Infinity;
    this.host.audio.setListener({
      riverNearness: nearness(Math.max(0, this.sim.river.edgeDistance(centre))),
      waterfallNearness: nearness(nearest(WATERFALLS)),
      seaNearness: nearness(sea),
      wetlandNearness: nearness(nearest(WETLANDS)),
    });
  }

  // ── The edges of the day ────────────────────────────────────────────────

  private phaseChanged(from: DayPhase, to: DayPhase): void {
    this.phase = to;
    this.rules.presentingEvening = to === 'evening';
    if (to !== 'morning' && this.view.camera.bottomInset > 0) {
      // The planning sheet has closed: the view settles back inside the opened reach.
      this.view.camera.bottomInset = 0;
      this.view.camera.panBy(0, 0);
    }
    // A travel day has its own camera: it walks down with the group (see `followTravel`).
    if (from === 'morning' && to === 'day' && !this.rules.state.moving) {
      this.frameOutings();
      this.dayFollow = { day: this.rules.state.day, taken: this.view.camera.taken };
    }
    if (to === 'evening') {
      // At dusk the view settles once on the hearth, and the bundles are unpacked there.
      // Always, however freely the day was panned: the evening begins at the fire.
      this.fireside = new FiresideUnpack();
      this.firesideCamp = null;
      this.frameFires();
    } else { this.fireside = null; this.firesideFocus = null; this.firesideCamp = null; }
    if (to === 'morning' && from !== 'morning') {
      this.frameHome(false);
    }
    this.host.persist();
  }

  /**
   * Begin the day: one slow glide to a framing that holds every planned route
   * and destination, with home. Not following: any touch of the camera stops it.
   */
  private frameOutings(): void {
    const trails = this.rules.scene().trails;
    const fire = eveningFire(this.rules.state);
    const screen = this.host.app.screen;
    // Room for the season tab above, the bar below and the names and tags round the edges.
    const usableW = Math.max(200, screen.width - (this.narrow ? 48 : 160));
    const usableH = Math.max(200, screen.height - (this.narrow ? 210 : 220));
    const frame = (points: Vec[]): { x: number; y: number; fit: number } => {
      let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
      for (const p of points) {
        left = Math.min(left, p.x); right = Math.max(right, p.x);
        top = Math.min(top, p.y); bottom = Math.max(bottom, p.y);
      }
      // Meetings and tags stand just below a destination, names to its side: leave them room.
      left -= 60; right += 60; top -= 50; bottom += 110;
      return { x: (left + right) / 2, y: (top + bottom) / 2, fit: Math.min(usableW / (right - left), usableH / (bottom - top)) };
    };
    const points: Vec[] = [fire, ...trails.flatMap((t) => t.points)];
    if (points.length < 2) return;
    let view = frame(points);
    // A phone that cannot hold everyone keeps to the friend today's creatures come to.
    const watched = this.phone ? watchedPerson(this.rules.state, this.rules.watching) : null;
    if (watched && view.fit < 0.3) view = frame([fire, ...trails.filter((t) => t.person === watched).flatMap((t) => t.points)]);
    const zoom = clamp(view.fit, 0.3, this.narrow ? 0.8 : 0.85);
    this.view.camera.ease(view.x, view.y, zoom, this.host.reducedMotion ? 9 : 1.2);
  }

  /** Frames the settlement at a zoom where the friends read clearly. */
  private frameHome(immediate: boolean): void {
    const fire = eveningFire(this.rules.state);
    this.frameOn(fire, Math.max(this.view.camera.fitZoom, this.homeZoom()));
    if (immediate) this.view.camera.snap();
  }

  private homeZoom(): number {
    return this.narrow ? HOME_ZOOM.narrow : HOME_ZOOM.wide;
  }

  private get narrow(): boolean {
    return this.host.app.screen.width < NARROW;
  }

  private get phone(): boolean {
    return this.host.app.screen.width <= PHONE;
  }

  /** Centres a subject, keeping it clear of the notebook's bottom sheet on a phone. */
  private frameOn(at: Vec, zoom: number): void {
    const camera = this.view.camera;
    camera.rate = this.host.reducedMotion ? 9 : 1.4;
    // The sheet only stands open while planning; by day the subject sits in the middle.
    const sheetOpen = this.narrow && this.rules.state.phase === 'morning' && this.rules.state.voyage === 'preparing';
    camera.bottomInset = sheetOpen ? this.host.app.screen.height * 0.55 : 0;
    const lift = sheetOpen ? (this.host.app.screen.height * 0.25) / zoom : 0;
    camera.focus(at.x, at.y + lift, zoom);
  }

  /**
   * The one time the view moves by itself: at the landing while everyone
   * gathers, then a glide down the whole river with the boat (see `finale.ts`).
   */
  private followVoyage(boatAt: Vec | null): void {
    const s = this.rules.state;
    const camera = this.view.camera;
    camera.bottomInset = 0;
    if (s.voyage === 'gathering') {
      // Frame the boat afloat and the group boarding it, a little toward the bank they walk from.
      // The sailing starts from this same framing (see `voyageStops`), so casting off never jumps.
      const view = gatheringView(s, !this.narrow);
      const at = view?.at ?? boatAt ?? landingView(s);
      if (at) this.frameOn(at, view?.zoom ?? (this.narrow ? 0.95 : 1.0));
      return;
    }
    this.voyageStops ??= voyageStops(s, !this.narrow);
    const at = voyageCamera(this.voyageStops, s.voyageTime);
    // The path is already smooth; the camera only has to keep up with it.
    camera.rate = 9;
    camera.focus(at.at.x, at.at.y, at.zoom);
    // At the cut the view jumps behind the fade, rather than chasing the path up the valley.
    if (s.free && s.voyageTime >= VOYAGE_CUT && this.voyageCutAt < VOYAGE_CUT) camera.snap();
    this.voyageCutAt = s.voyageTime;
  }

  // ── Commands ────────────────────────────────────────────────────────────

  command(c: AdventureCommand): Answer {
    const rules = this.rules;
    const ui = this.host.ui;
    let result: Answer = yes;
    if (c.type === 'skip' && this.skipFireside()) { this.refresh(); return yes; }
    switch (c.type) {
      case 'notebook':
        rules.selection = { person: c.person ?? null, place: c.place ?? null };
        ui.openNotebook(c.page, c.person, c.place, c.lodging);
        break;
      case 'focus':
        this.frameOn(c.point, Math.max(0.8, this.view.camera.zoom));
        break;
      case 'look':
        // A gentle pan to something off the edge of the view, keeping the zoom.
        this.frameOn(c.point, this.view.camera.zoom);
        break;
      case 'follow': {
        const friend = rules.view().friends.find((f) => f.id === c.person);
        if (friend) this.frameOn(friend.at, Math.max(0.9, this.view.camera.zoom));
        rules.selection = { ...rules.selection, person: c.person };
        break;
      }
      case 'place':
        this.startPlacing(c.kind);
        break;
      case 'cancel-placement':
        this.input.place(null);
        ui.hint(null);
        break;
      case 'landscape':
        // Drawing paths is not part of the expedition; the flag is kept so the notebook can show it off.
        this.landscaping = false;
        break;
      case 'continue-valley': {
        this.host.persist();
        // Back to the valley as Free Play: the night passes, and the sailors are home by morning.
        this.view.seaFinale?.leave();
        rules.command(c);
        this.view.openReach();
        this.frameHome(false);
        break;
      }
      default: {
        if (c.type === 'assign' || c.type === 'rest' || c.type === 'cancel-plan') rules.inspected = null;
        const answer = rules.command(c);
        result = answer;
        if (!answer.ok) ui.toast(answer.reason);
        // The sea is the valley's own: the old illustrated horizon is not used.
        if (c.type === 'sail' && answer.ok) this.view.seaFinale?.reset();
        // The mist stays: it rolls back over the travel day as the group walks into the new reach.
        if (answer.ok && (c.type === 'travel' || (c.type === 'begin' || c.type === 'move-everyone') && rules.state.moving)) this.view.openReach(rules.state.moving && rules.state.phase === 'day');
      }
    }
    this.dirty = true;
    if(c.type==='evening' && c.step==='morning' && result.ok) this.refresh();
    if (c.type !== 'notebook' && c.type !== 'focus' && c.type !== 'look' && c.type !== 'follow') this.host.persist();
    return result;
  }

  private startPlacing(kind: StructureKind): void {
    const problem = this.rules.buildingProblem(kind);
    if (problem) {
      this.host.ui.toast(problem);
      this.host.audio.cue('refuse');
      return;
    }
    this.input.place(kind);
    this.host.ui.hint(kind === 'bridge' ? 'Tap the Mio narrows, just above the mill.' : 'Tap a spot near home to place it.');
    if (kind === 'ford-bridge') { this.host.ui.hint('Tap the Old Ford below the falls.'); this.frameOn({ x: 1052, y: 432 }, 0.8); }
    if (kind === 'stones') { this.host.ui.hint('Tap where the old road meets the stream, below Furumichi.'); this.frameOn({ x: 742, y: 2532 }, 0.8); }
    if (kind === 'bridge') this.frameOn({ x: 1090, y: 3580 }, 0.8);
  }

  /** Escape cancels a placement; nothing else in the loop needs a keyboard. */
  key(e: KeyboardEvent): boolean {
    if ((e.key === 'e' || e.key === 'E' || e.key === 'Enter') && this.nextFireside()) return true;
    if (e.key === 'Escape' && this.input.placing) {
      this.command({ type: 'cancel-placement' });
      return true;
    }
    return false;
  }

  private panOf(at: Vec): number {
    const x = this.view.camera.worldToScreen(at).x / Math.max(1, this.host.app.screen.width);
    return clamp(x * 2 - 1, -1, 1) * 0.6;
  }

  dispose(): void {
    if (typeof window !== 'undefined') for (const type of GESTURES) window.removeEventListener(type, this.onGesture, { capture: true });
    this.input.dispose();
  }
}

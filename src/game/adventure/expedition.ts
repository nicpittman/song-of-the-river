/**
 * The expedition rules: a day as one turn.
 *
 *   Morning  the player decides everything: who goes where to do what, with
 *            which item and companion, who stays home, what to build. No clock
 *            runs. "Begin the day" commits.
 *   Day      about a minute of daylight resolves the plans: trails of beats,
 *            at most one fork, a few creatures to sketch. Nothing is required,
 *            and the result is the same at any speed or skipped.
 *   Evening  everyone is home; bundles are set down by the fire, rarest last,
 *            and a line about tomorrow points somewhere.
 *   Night    a few seconds of darkness, then the next morning.
 *
 * All state is in `sim.state.adventure` (see `state.ts`). This class holds
 * only caches and passing interface state (selection, an inspected place).
 */

import { recordDay } from './dayHistory';
import { writeAlmanac } from './aims';
import { isSecretPlace } from './places/freeplay';
import { ECONOMY, outingCost } from './economy';
import { clamp, type Vec } from '../core/math';
import { hashString, mulberry32 } from '../core/rng';
import type { Simulation } from '../simulation/simulation';
import { TICK } from '../simulation/simulation';
import { CAMP_GATHER_SECONDS, DAY_SECONDS, DAYS_PER_SEASON, NIGHT_SECONDS, UNPACK_SECONDS, VOYAGE_SECONDS, clockTick, seasonOf } from './calendar';
import { isOpen, openGround, placeToday } from './conditions';
import { canWorkOn, buildingProblem, no, placeStructure, recoverBuilding, siteProblem as siteRule, underWay, workDuring, workTrip, yes, type Answer } from './construction';
import { PLACES, hasPlace, placeActivities, placeDef } from './content';
import { applyEffect, dusk, hearOf, reveal, tomorrowFor } from './evening';
import { DISCOVERY, EAST_ARRIVAL, HEARD_AT_START, KNOWN_AT_START } from './discovery';
import { arrivalOf } from './course';
import { dist } from '../core/math';
import { NARROWS } from './structures';
import { opportunities } from './opportunities';
import { pruneLeads } from './leads';
import { WEATHER_WORDS } from './lines';
import type { AdventureCommand, AdventureScene, AdventureView, Cue, Equipment, Forecast, OutingPlan, SecondStop, StructureKind, Weather } from './model';
import { routeLength, WalkingMap } from './navigation';
import { assess, forecastOf, planProblem, unplanned } from './odds';
import { nameOf, outingPace, personDef } from './people';
import { PROVISIONS, JOURNEY_MATERIALS, SEA_PROVISIONS, goalLine, readyToMove, readyToSail } from './progression';
import { campOf, regionAt, REGIONS } from './regions';
import { restoreAdventure } from './restore';
import { riverLine, shiftedOn } from './river';
import { buildScene, stanceOf } from './scene';
import { scheduleSightings, isShowing, type SightingWatch } from './sightings';
import { scheduleCrossings } from './crossings';
import { isThreadBeat } from './threads';
import { scheduleGlints } from './glints';
import { riverSign } from './signs';
import type { AdventureState, Outing } from './state';
import { equipmentDef, isMajor, isPlanting, structureDef } from './structures';
import { outingStop, continueAfterFork, departDetour, departOuting, detourField, natureChoice, type Router } from './trail';
import { detourJourney, MIN_FIELD_SECONDS, type Journey } from './travel';
import { numberWord } from './text';
import { keepCampMovesTogether } from './campTravel';
import { buildView } from './view';
import { GATHER_HOLD, barSeconds, boardingSeconds, gatheringSeconds, moorings, sailSeconds } from './finale';
import { seat } from './motion';
import { homeRegion, isComplete, lodgingById, openedTo, setOutFrom, stageOf, worldOf, type World } from './world';

export type { Answer } from './construction';

/** Sub-steps per fixed step when the rest of the day is skipped. */
const HURRY = 8;
/** Seconds between hammer blows heard from a building site. */
const HAMMER_EVERY = 5;
/** When the first bundle is set down by the fire. */
const FIRST_UNPACK = CAMP_GATHER_SECONDS;

const BEAT_CUE: Record<string, Cue> = { fish: 'cast', forage: 'rustle', investigate: 'rustle' };

export class ExpeditionAdventure {
  readonly nav: WalkingMap;
  /** The friend and place picked up in the notebook, for highlighting. */
  selection: { person: string | null; place: string | null } = { person: null, place: null };
  /** The place whose card is pinned in the valley. */
  inspected: string | null = null;
  /** A cosmetic clock for life at home. Runs in every phase; never saved. */
  life = 0;
  /** Presentation owns the return rhythm while a live fireside sequence runs. */
  presentingEvening = false;
  /** On a narrow screen, the friend the view keeps to, so today's creatures show where they can be seen (see `SightingWatch`). Never saved. */
  watching: SightingWatch | null = null;
  private planHistory: Array<{ day: number; plans: OutingPlan[]; resting: string[] }> = [];

  private planFuture: Array<{ day: number; plans: OutingPlan[]; resting: string[] }> = [];

  get canRedoPlan(): boolean {
    return this.state.phase === 'morning' && this.state.voyage === 'preparing' && this.planFuture.at(-1)?.day === this.state.day;
  }

  get canUndoPlan(): boolean {
    return this.state.phase === 'morning' && this.state.voyage === 'preparing' && this.planHistory.at(-1)?.day === this.state.day;
  }

  /** Only planning commands are reversible; watching or inspecting never adds a step. */
  private changePlan(change: () => Answer): Answer {
    const s = this.state;
    const before = { day: s.day, plans: structuredClone(s.plans), resting: [...s.resting] };
    const answer = change();
    if (answer.ok && s.phase === 'morning' && JSON.stringify([before.plans, before.resting]) !== JSON.stringify([s.plans, s.resting])) {
      if (this.planHistory.at(-1)?.day !== s.day) this.planHistory = [];
      this.planFuture = [];
      this.planHistory.push(before);
      if (this.planHistory.length > 30) this.planHistory.shift();
    }
    return answer;
  }

  private undoPlan(): Answer {
    if (!this.canUndoPlan) return this.refuse('No morning plan to undo.');
    this.planFuture.push({ day: this.state.day, plans: structuredClone(this.state.plans), resting: [...this.state.resting] });
    const before = this.planHistory.pop()!;
    this.state.plans = structuredClone(before.plans);
    this.state.resting = [...before.resting];
    this.inspected = null;
    this.emit('token-lift');
    return yes;
  }

  private redoPlan(): Answer {
    if (!this.canRedoPlan) return this.refuse('No morning plan to redo.');
    const after = this.planFuture.pop()!;
    this.planHistory.push({ day: this.state.day, plans: structuredClone(this.state.plans), resting: [...this.state.resting] });
    this.state.plans = structuredClone(after.plans);
    this.state.resting = [...after.resting];
    this.inspected = null; this.emit('token-place');
    return yes;
  }

  constructor(readonly sim: Simulation) {
    sim.state.adventure = restoreAdventure(sim.state.adventure);
    sim.seasonSeconds = DAY_SECONDS * DAYS_PER_SEASON;
    sim.state.chapter = openedTo(this.state);
    this.nav = new WalkingMap(sim.board, sim.river);
    if (this.state.known.length === 0) {
      for (let r = 0; r <= openedTo(this.state); r++) this.settle(r);
      this.state.revealed = [];
    }
    // A save made at night resumes at the next morning.
    if (this.state.phase === 'night') this.dawn(false);
    if (!this.state.morning && this.state.phase === 'morning') this.state.morning = this.firstMorning();
    writeAlmanac(this.world());
    const { phase, elapsed } = this.state;
    sim.state.tick = clockTick(this.state.day, phase === 'morning' ? 0 : phase === 'day' ? elapsed : DAY_SECONDS, TICK);
    this.updateGround();
  }

  get state(): AdventureState {
    return this.sim.state.adventure!;
  }

  get seed(): number {
    return this.sim.state.seed;
  }

  world(day = this.state.day): World {
    const world = worldOf(this.seed, this.state, day);
    let prepared = false;
    world.route = (from, to) => {
      if (!prepared) { this.nav.setOpenGround(openGround(this.sim.board, world.today, this.state)); prepared = true; }
      return this.nav.route(from, to, REGIONS[openedTo(this.state)]!.bottom);
    };
    return world;
  }

  /** Today's weather, for the valley's own sky. */
  get weather(): Weather {
    return this.world().today.weather;
  }

  // ── Commands ────────────────────────────────────────────────────────────

  /** Everything the notebook and the tags ask of the rules. Interface-only commands are the session's. */
  command(c: AdventureCommand): Answer {
    switch (c.type) {
      case 'assign': return this.changePlan(() => this.assign(c.plan));
      case 'move-everyone': return this.changePlan(() => this.moveEveryone(c.place));
      case 'detour': return this.changePlan(() => this.detour(c.person, c.stop));
      case 'camp': return this.changePlan(() => this.camp(c.person, c.shelter));
      case 'cancel-plan': return this.changePlan(() => this.cancelPlan(c.person));
      case 'rest': return this.changePlan(() => this.rest(c.person));
      case 'undo-plan': return this.undoPlan();
      case 'redo-plan': return this.redoPlan();
      case 'begin': return this.begin();
      case 'travel': return this.travel();
      case 'skip': return this.skip();
      case 'choose': return this.choose(c.tag, c.choice);
      case 'sketch': return this.sketch(c.sighting);
      case 'notice': return this.notice(c.glint);
      case 'evening': return c.step === 'morning' ? this.nextMorning() : c.step === 'collect' ? this.collectReturns() : c.step === 'next' ? this.unpackNext() : this.finishEvening();
      case 'craft': return this.craft(c.equipment);
      case 'recover-building': return recoverBuilding(this.state, c.id);
      case 'inspect': return this.inspect(c.place);
      case 'sail': return this.sail(c.companions);
      case 'continue-valley': return this.returnToValley();
      default: return yes;
    }
  }

  /** In a Journey, a plan into the next reach down is the whole group's journey there. Free Play has no journey down: every reach is open. */
  private goingDown(): boolean {
    const s = this.state;
    return !s.free && s.plans.some((p) => placeDef(p.place).region > s.region);
  }

  /** Plans a friend's outing, replacing any plan or rest they had. */
  assign(plan: OutingPlan): Answer {
    const s = this.state;
    const clean: OutingPlan = { person: plan.person, place: plan.place, activity: plan.activity, item: plan.item ?? null, companion: plan.companion ?? null, ...(plan.lodging !== undefined ? { lodging: plan.lodging } : {}), ...(plan.overnight !== undefined ? { overnight: plan.overnight } : {}), ...(plan.second ? { second: { ...plan.second } } : {}), ...(plan.visitOnly ? { visitOnly: true } : {}) };
    const others = { ...s, plans: this.goingDown() ? [] : s.plans.filter((p) => p.person !== clean.person) };
    const problem = planProblem({ ...this.world(), state: others }, clean) ?? this.relocationProblem(clean);
    if (problem) return this.refuse(problem);
    s.plans = others.plans;
    s.resting = s.resting.filter((id) => id !== clean.person && id !== clean.companion);
    s.plans.push(clean);
    this.inspected = null;
    this.emit('token-place');
    return yes;
  }

  /** Moving camp is today's outing; tomorrow's expeditions start at the shelter. */
  camp(person: string, shelter: number | string): Answer {
    if (!this.state.people.some((p) => p.id === person)) return this.refuse('That person is not with us yet.');
    const lodging = lodgingById(this.state, shelter);
    if (!lodging) return this.refuse('No roof there yet. Finish the shelter, or explore the hut first.');
    const destination = PLACES.find((p) => p.kind === 'settlement' && p.region === lodging.region)!;
    return this.assign({ person, place: destination.id, activity: 'visit', item: null, companion: null, lodging: shelter });
  }

  /** One optional group action reuses the existing, saved individual travel plans. */
  private everyonePlans(place: string): OutingPlan[] {
    const destination = placeDef(place);
    return this.state.people.filter((person) => person.base !== destination.region || person.lodging !== undefined)
      .map((person) => ({ person: person.id, place, activity: 'visit', item: null, companion: null }));
  }

  moveEveryoneProblem(place: string): string | null {
    const s = this.state;
    if (s.phase !== 'morning' || s.voyage !== 'preparing') return 'Plan the move in the morning.';
    if (!hasPlace(place) || placeDef(place).kind !== 'settlement') return 'Choose a town for the companions’ new camp.';
    const destination = placeDef(place);
    if (!s.free && destination.region > s.region) {
      if (destination.region !== s.region + 1) return 'Follow the river through the next region first.';
      if (!readyToMove(s)) return goalLine(s);
      this.updateGround();
      return s.people.every((person, index) => this.nav.route(stanceOf(this, person.id).at, seat(this.arrivalFire(destination.region), index), REGIONS[destination.region]!.bottom)) ? null : 'Someone’s route downstream is closed today.';
    }
    if (!s.known.includes(place)) return 'Find this town before making it our base.';
    const plans = this.everyonePlans(place);
    if (!plans.length) return 'Everyone is already based here.';
    const w = { ...this.world(), state: { ...s, plans, resting: [] } };
    for (const plan of plans) {
      const problem = planProblem(w, plan) ?? this.relocationProblem(plan);
      if (problem) return `${nameOf(plan.person)}: ${problem}`;
    }
    return null;
  }

  moveEveryone(place: string): Answer {
    const problem = this.moveEveryoneProblem(place);
    if (problem) return this.refuse(problem);
    if (!this.state.free && placeDef(place).region > this.state.region) {
      this.state.plans = this.state.people.map((person) => ({ person: person.id, place, activity: 'visit', item: null, companion: null }));
      this.state.resting = [];
      this.inspected = null;
      this.emit('token-place');
      return yes;
    }
    const plans = this.everyonePlans(place);
    this.state.plans = plans;
    this.state.resting = this.state.people.filter((person) => !plans.some((plan) => plan.person === person.id)).map((person) => person.id);
    this.inspected = null;
    this.emit('token-place');
    return yes;
  }

  /** Moving home still uses a real, reachable walk within today's daylight. */
  relocationProblem(plan: OutingPlan): string | null {
    const place = placeDef(plan.place);
    if (place.kind !== 'settlement' || plan.visitOnly) return null;
    const lodging = lodgingById(this.state, plan.lodging);
    const target = lodging?.fire ?? campOf(place.region).fire;
    const route = this.nav.route(stanceOf(this, plan.person).at, target, REGIONS[openedTo(this.state)]!.bottom);
    if (!route) return 'The way there is under water. Wait for it to fall, or bridge the crossing.';
    return routeLength(route) / outingPace(plan) > 35 ? 'Too far to move in one day. Try a nearer town or shelter first.' : null;
  }

  /** The move plan of a friend on the moving morning, or undefined. */
  private movePlan(person: string): OutingPlan | undefined {
    const s = this.state;
    if (s.phase !== 'morning' || s.free) return undefined;
    const next = REGIONS[s.region + 1];
    // Down to the next reach, or moving camp to a village in this one.
    return s.plans.find((p) => p.person === person && (p.place === next?.id || (placeDef(p.place).kind === 'settlement' && !p.visitOnly && placeDef(p.place).region === s.region)));
  }

  /** True when this friend's plan today is to move camp, so they may stop somewhere on the way. */
  isMove(person: string): boolean {
    return !!this.movePlan(person);
  }

  /** Where a moving friend settles tonight, and whether it is down in the next reach. */
  private moveEnd(person: string): { at: Vec; name: string; down: boolean } {
    const s = this.state;
    const plan = this.movePlan(person)!;
    const index = s.people.findIndex((p) => p.id === person);
    const next = REGIONS[s.region + 1];
    if (plan.place === next?.id) return { at: seat(this.arrivalFire(s.region + 1), index), name: next.name, down: true };
    const place = placeDef(plan.place);
    return { at: seat(lodgingById(s, plan.lodging)?.fire ?? campOf(place.region).fire, index), name: lodgingById(s, plan.lodging)?.name ?? place.name, down: false };
  }

  /** Walks that may cross into the reach the group is moving down to. */
  private moveRouter(): Router {
    const bottom = REGIONS[Math.min(REGIONS.length - 1, this.state.region + 1)]!.bottom;
    return (from, to) => this.nav.route(from, to, bottom) ?? [from, to];
  }

  /** A friend's walk on the moving day by way of a stop: from where they slept, to their seat at the new camp. */
  private detourWalk(person: string, stop: SecondStop): Journey {
    const end = this.moveEnd(person);
    const bottom = REGIONS[Math.min(REGIONS.length - 1, this.state.region + (end.down ? 1 : 0))]!.bottom;
    return detourJourney({ ...this.world(), route: (from, to) => this.nav.route(from, to, bottom) }, person, stop, stanceOf(this, person).at, end.at);
  }

  /** Why this stop on the way down cannot be made, or null. */
  detourProblem(person: string, stop: SecondStop): string | null {
    const s = this.state;
    if (!this.movePlan(person)) return 'A stop on the way is for the moving morning.';
    if (!hasPlace(stop.place) || !s.known.includes(stop.place)) return 'Nobody knows the way there yet.';
    const place = placeDef(stop.place);
    const next = { name: this.moveEnd(person).name };
    if (place.kind === 'settlement' || place.region !== s.region) return `Choose a place in ${REGIONS[s.region]!.name} to stop on the way.`;
    const today = placeToday(place, this.world().today, s);
    if (today.state === 'closed') return today.line;
    if (!placeActivities(place, s.free).includes(stop.activity)) return `Choose an activity available at ${place.name}.`;
    const journey = this.detourWalk(person, stop);
    if (!journey.reachable) return 'No way across today. When the water falls, or with a bridge, there will be.';
    if (journey.field < MIN_FIELD_SECONDS) return `Not daylight enough to stop at ${place.name} and still reach ${next.name} by dusk.`;
    return null;
  }

  /** Gives a friend a stop on the way down, or takes it away. The move itself is unchanged. */
  detour(person: string, stop: SecondStop | null): Answer {
    const plan = this.movePlan(person);
    if (!plan) return this.refuse('A stop on the way is for the moving morning.');
    if (!stop) {
      delete plan.detour;
      this.emit('token-lift');
      return yes;
    }
    const problem = this.detourProblem(person, stop);
    if (problem) return this.refuse(problem);
    plan.detour = { place: stop.place, activity: stop.activity };
    this.emit('token-place');
    return yes;
  }

  /** What a stop on the way would bring, as an ordinary forecast; its length says when they catch up. */
  detourForecast(person: string, stop: SecondStop): Forecast {
    const s = this.state;
    const journey = this.detourWalk(person, stop);
    const others = { ...s, plans: s.plans.filter((p) => p.person !== person) };
    const a = assess({ ...this.world(), state: others }, { person, place: stop.place, activity: stop.activity, item: null, companion: null }, detourField(journey));
    const forecast = forecastOf(a);
    // A shorter visit brings home less; say what it usually brings, not what a whole day would.
    forecast.reasons = forecast.reasons.filter((r) => !r.text.startsWith('Usually '));
    if (a.provisions > 0) forecast.reasons.unshift({ sign: '+', text: `Usually ${numberWord(a.provisions)} ${a.provisions === 1 ? 'provision' : 'provisions'}` });
    if (a.materials > 0) forecast.reasons.unshift({ sign: '+', text: `Usually ${numberWord(a.materials)} ${a.materials === 1 ? 'material' : 'materials'}` });
    forecast.problem = this.detourProblem(person, stop);
    const end = this.moveEnd(person);
    forecast.length = end.down ? `Catches up at ${end.name} by dusk` : `On to ${end.name} by dusk`;
    return forecast;
  }

  /** A few open places near a friend's road down, the least out of the way first. */
  detourStops(person: string): SecondStop[] {
    const s = this.state;
    if (!this.movePlan(person)) return [];
    const gift = personDef(person).gift;
    return s.known.map((id) => placeDef(id))
      .filter((place) => place.kind !== 'settlement' && place.region === s.region && place.activities.length > 0)
      .map((place) => ({ place: place.id, activity: place.activities.includes(gift) ? gift : place.activities.find((a) => a !== 'visit') ?? place.activities[0]! }))
      .filter((stop) => !this.detourProblem(person, stop))
      .map((stop) => { const j = this.detourWalk(person, stop); return { stop, walk: j.outward + j.homeward, sure: this.detourForecast(person, stop).chance === 'certain' }; })
      // A stop sure to bring something comes first; then the least out of the way.
      .sort((x, y) => Number(y.sure) - Number(x.sure) || x.walk - y.walk)
      .slice(0, 4)
      .map((x) => x.stop);
  }

  /** The way a friend's stop on the way down takes them, for the maps. */
  detourRoute(person: string, stop: SecondStop): Vec[] {
    const j = this.detourWalk(person, stop);
    return [...j.out, ...j.back.slice(1)];
  }

  cancelPlan(person: string): Answer {
    const s = this.state;
    if (s.phase !== 'morning') return this.refuse('The day has begun. Plans are made in the morning.');
    s.plans = (this.goingDown() ? [] : s.plans.filter((p) => p.person !== person)).map((p) => p.companion === person ? { ...p, companion: null } : p);
    s.resting = s.resting.filter((id) => id !== person);
    this.emit('token-lift');
    return yes;
  }

  /** Keeps a friend home today: they tend things and help any building. */
  rest(person: string): Answer {
    const s = this.state;
    if (s.phase !== 'morning') return this.refuse('The day has begun. Plans are made in the morning.');
    if (!s.people.some((p) => p.id === person)) return this.refuse('That person is not with us yet.');
    s.plans = (this.goingDown() ? [] : s.plans.filter((p) => p.person !== person)).map((p) => (p.companion === person ? { ...p, companion: null } : p));
    if (!s.resting.includes(person)) s.resting.push(person);
    this.emit('token-place');
    return yes;
  }

  /** The one commit: the plans are locked and the day begins. */
  begin(): Answer {
    const s = this.state;
    if (s.voyage === 'gathering' || s.voyage === 'sailing') return this.refuse('The boat is leaving.');
    if (s.phase !== 'morning') return this.refuse('The day is already under way.');
    if (s.plans.length === 0 && s.resting.length === 0 && !s.people.some(person => { const project = underWay(s, person.base); return project && canWorkOn(s, person.id, project, this.nav); })) return this.refuse('Choose an outing, or a day at camp.');
    if (this.goingDown()) {
      const destination=REGIONS[s.region+1]?.id;
      if (!s.people.every(person=>s.plans.some(plan=>plan.person===person.id&&plan.place===destination)) || s.resting.length) return this.refuse('Plan a journey for everyone, or choose outings here today.');
      return this.travel();
    }
    this.updateGround();
    const w = this.world();
    // Validate the whole plan again before spending. Saves and changed conditions
    // cannot bypass shared kit, route closures or the shared picnic budget.
    for (const plan of s.plans) {
      const problem = planProblem(w, plan) ?? this.relocationProblem(plan);
      if (problem) return this.refuse(problem);
    }
    const picnic = s.plans.reduce((n, p) => n + outingCost(w, p), 0);
    // Only the outings need assigning. Everyone else keeps their current home
    // and joins the existing camp/construction routine after validation succeeds.
    s.resting.push(...unplanned(s));
    s.dayStart.packed = picnic;
    s.provisions -= picnic;
    const forked = this.forkToday(w);
    // One at a time, so two friends never bring home the same lead.
    s.outings = [];
    s.workedOn = null;
    for (const plan of s.plans) {
      const outing = departOuting(w, plan, plan.person === forked, this.router(), stanceOf(this, plan.person).at);
      // Moving camp within the reach by way of a stop: the same walk as a stop on the way down.
      s.outings.push(plan.detour ? departDetour({ ...w, route: this.router() }, { ...outing, detour: { ...plan.detour } }, stanceOf(this, plan.person).at, this.moveEnd(plan.person).at) : outing);
    }
    keepCampMovesTogether(s.outings.filter((o) => !o.detour), this.router());
    s.plans = [];
    s.sightings = scheduleSightings(w, this.watching);
    // Then the quieter moments, each kept clear of the creatures and of one another.
    s.crossings = scheduleCrossings(w);
    s.glints = scheduleGlints(w, this.watching);
    s.tracked = [];
    s.phase = 'day';
    s.elapsed = 0;
    s.morning = null;
    this.inspected = null;
    this.emit('begin-day');
    return yes;
  }

  /** Where the group's first fire is in the reach they come down into: Kawagiri's is the reed cutters' hut, unless this run's way comes down the east bank to the village. */
  arrivalFire(region: number): Vec {
    if (region !== 2 || arrivalOf(this.state.course) === 'kawagiri') return campOf(region).fire;
    const arrival = { ...this.state, known: [...this.state.known, 'ashikari'], visits: { ...this.state.visits, ashikari: 1 } };
    return lodgingById(arrival, 'ashikari')!.fire;
  }

  /** Pack for the road when the player is ready; discovering a route never forces departure. */
  travel(): Answer {
    const s = this.state;
    if (s.phase !== 'morning') return this.refuse('Plan the move in the morning.');
    if (!readyToMove(s)) return this.refuse(goalLine(s));
    this.updateGround();
    const next = REGIONS[s.region + 1]!;
    const detours = new Map(s.plans.flatMap((p) => p.detour && p.place === next.id ? [[p.person, p.detour] as const] : []));
    for (const [person, stop] of detours) {
      const problem = this.detourProblem(person, stop);
      if (problem) return this.refuse(`${nameOf(person)}: ${problem}`);
    }
    const outings: Outing[] = [];
    const starts = s.people.map((person) => stanceOf(this, person.id).at);
    const paths = s.people.map((_, index) => this.nav.route(starts[index]!, seat(this.arrivalFire(s.region + 1), index), next.bottom));
    if (paths.some((points) => !points)) return this.refuse('Someone’s way downstream is under water today. Wait for it to fall, or bridge the crossing.');
    // Leave time to actually arrive and read the welcome, rather than stretching every walk until dusk.
    const walking = paths.map((points, index) => ({ seconds: routeLength(points!) / personDef(s.people[index]!.id).pace, together: !detours.has(s.people[index]!.id) }));
    const arrival = clamp(Math.max(...(walking.some((w) => w.together) ? walking.filter((w) => w.together) : walking).map((w) => w.seconds)), 24, 30);
    const w = this.world();
    const route = this.moveRouter();
    // Set before the stops are laid: a lead noticed on the way down would point back up the river.
    s.moving = true;
    s.outings = outings;
    for (const [index, person] of s.people.entries()) {
      const to = seat(this.arrivalFire(s.region + 1), index);
      const points = paths[index]!;
      const stop = detours.get(person.id);
      const move: Outing = { ...(s.region + 1 === 2 && arrivalOf(s.course) === 'ashikari' ? { lodging: 'ashikari' } : {}), person: person.id, place: next.id, activity: 'visit', item: null, companion: null,
        score: 0, certain: true, farther: false, bundles: [], pack: null, fork: null,
        legs: [{ kind: 'walk', start: index * .25, end: arrival, points, pose: 'walk' },
          { kind: 'beat', start: arrival, end: DAY_SECONDS, at: to, pose: 'look' }],
      };
      // One at a time, so two friends stopping on the way never bring home the same find.
      outings.push(stop ? departDetour({ ...w, route }, { ...move, detour: { ...stop } }, starts[index]!, to) : move);
    }
    keepCampMovesTogether(outings.filter((o) => !o.detour), route, true);
    s.dayStart.packed = PROVISIONS[s.region]!;
    s.provisions -= s.dayStart.packed;
    s.materials -= JOURNEY_MATERIALS[s.region] ?? 0;
    s.plans = [];
    s.resting = [];
    // The walk down has its own creatures, by the road.
    s.sightings = scheduleSightings(w, this.watching);
    s.crossings = [];
    s.glints = [];
    s.workedOn = null;
    s.morning = null;
    s.phase = 'day';
    s.elapsed = 0;
    this.sim.state.chapter = openedTo(s);
    this.emit('farewell', campOf(s.region).fire);
    return yes;
  }

  /** Lets the rest of the day pass quickly. The result is the same. */
  skip(): Answer {
    const s = this.state;
    // The voyage can be skipped to the open sea.
    if (s.voyage === 'gathering' || s.voyage === 'sailing') {
      s.voyage = 'sailing';
      s.voyageTime = Math.max(s.voyageTime, sailSeconds(s) - 4);
      this.change();
      return yes;
    }
    if (this.state.phase !== 'day') return no('Nothing to skip just now.');
    this.state.hurry = true;
    this.change();
    return yes;
  }

  /** Answers the fork a friend is waiting at. Tags are `fork-<person>`. */
  choose(tag: string, choice: number): Answer {
    const s = this.state;
    const outing = s.outings.find((o) => `fork-${o.person}` === tag);
    const leg = outing?.legs.find((l) => l.fork);
    if (!outing?.fork || !leg || outing.fork.answer !== null || s.phase !== 'day') return no('That moment has passed.');
    if (s.elapsed < leg.start || choice < 0 || choice >= outing.fork.choices.length) return no('That moment has passed.');
    continueAfterFork(this.world(), outing, choice, s.elapsed, this.router());
    this.emit('click');
    return yes;
  }

  /** Sketches a creature that is showing right now. */
  sketch(id: string): Answer {
    const s = this.state;
    const sighting = s.sightings.find((x) => x.id === id);
    if (!sighting || s.phase !== 'day' || !isShowing(sighting, s.elapsed)) return no('It has gone.');
    // A second tap on the same creature is not a second sketch.
    if (sighting.sketched) return yes;
    sighting.sketched = true;
    sighting.sketchedAt = s.elapsed;
    if (!s.discoveries[sighting.find]) s.discoveries[sighting.find] = { day: s.day, by: 'sketch' };
    this.emit('sketch', sighting.at);
    return yes;
  }

  /** Looks at a small thing glinting by the path right now: one line in the journal's small finds. */
  notice(id: string): Answer {
    const s = this.state;
    const glint = s.glints.find((x) => x.id === id);
    if (!glint || s.phase !== 'day' || !isShowing(glint, s.elapsed)) return no('It has gone.');
    if (glint.found) return yes;
    glint.found = true;
    glint.foundAt = s.elapsed;
    if (!s.smallFinds[glint.find]) s.smallFinds[glint.find] = { day: s.day, person: glint.person, place: s.outings.find((o) => o.person === glint.person)?.place ?? REGIONS[s.region]!.id };
    this.emit('sketch', glint.at);
    return yes;
  }

  craft(id: Equipment): Answer {
    const s = this.state;
    const def = equipmentDef(id);
    if (!def) return this.refuse('Unknown item.');
    if (s.equipment.includes(id)) return this.refuse('Already in the kit.');
    if (s.materials < def.cost) return this.refuse(`Needs ${def.cost} materials.`);
    s.materials -= def.cost;
    s.equipment.push(id);
    this.emit('hammer');
    return yes;
  }

  inspect(place: string | null): Answer {
    if (place !== null && (!hasPlace(place) || !this.state.known.includes(place))) return no('Nobody knows that place yet.');
    this.inspected = place;
    this.emit(place ? 'leaf-open' : 'leaf-close');
    return yes;
  }

  /** Why a building or planting cannot go here, or null. The pointer asks this while placing. */
  siteProblem(kind: StructureKind, at: Vec): string | null {
    const problem = buildingProblem(this.state, kind) ?? siteRule(this.state, this.sim.board, this.sim.river, kind, at);
    if (problem || !isMajor(kind)) return problem;
    return this.siteBuilders(kind, at).length ? null : 'Nobody can reach this site, work and return before dusk. Choose a closer site or move camp first.';
  }

  /** The placement preview names these people before any materials are spent. */
  siteBuilders(kind: StructureKind, at: Vec): string[] {
    const site = { ...at, kind, region: regionAt(at) };
    return this.state.people.filter((p) => workTrip(this.state, p.id, site, this.nav)).map((p) => nameOf(p.id));
  }

  place(kind: StructureKind, at: Vec): Answer {
    const problem = this.siteProblem(kind, at);
    if (problem) return this.refuse(problem);
    const answer = placeStructure(this.state, this.sim.board, this.sim.river, kind, at);
    if (!answer.ok) return this.refuse(answer.reason);
    // A small work stands as soon as it is placed; a story work starts as a frame.
    if (!isMajor(kind) && !isPlanting(kind)) { this.emit('build-done', this.state.buildings[this.state.buildings.length - 1]!); this.updateGround(); }
    else this.emit('build-place', at);
    return yes;
  }

  buildingProblem(kind: StructureKind): string | null {
    return buildingProblem(this.state, kind);
  }

  get canSail(): boolean {
    return readyToSail(this.state) && this.state.phase === 'morning';
  }

  sail(companions: string[]): Answer {
    const s = this.state;
    if (!this.canSail) return this.refuse(this.state.phase !== 'morning' ? 'Boats leave in the morning. Turn to the next day, then gather at the boat.' : goalLine(this.state));
    const chosen = [...new Set(companions)].filter((id) => s.people.some((p) => p.id === id));
    if (chosen.length === 0) return this.refuse('Choose at least one person to sail.');
    if (!s.free && !chosen.includes('sora')) return this.refuse('Sora has followed the river all this way. Keep a place for him aboard.');
    const boat = s.buildings.find((b) => b.kind === 'boat')!;
    s.farewell = chosen.map((person, i) => {
      const from = seat(setOutFrom(s, { region: s.region }, person), s.people.findIndex((p) => p.id === person));
      const points = this.router()(from, { x: boat.x - 16 + i * 8, y: boat.y + 14 });
      return { person, points, seconds: boardingSeconds(from, boat) + i * 0.4 };
    });
    s.companions = chosen;
    if (!s.free) {
      s.provisions -= SEA_PROVISIONS;
      this.tellStory(2, chosen);
    }
    s.voyage = 'gathering';
    s.voyageTime = 0;
    this.emit('farewell');
    return yes;
  }

  /**
   * After the sea: the valley again, as Free Play. Everything built stays;
   * the friends who sailed are home after a night.
   */
  returnToValley(): Answer {
    const s = this.state;
    if (s.voyage !== 'ended') return no('The boat has not reached the sea.');
    // After a Journey the whole valley is ours; a Free Play valley stays as far as it has been wandered.
    const wandering = s.free;
    s.free = true;
    if (!wandering) for (let r = 0; r < REGIONS.length; r++) this.settle(r);
    this.sim.state.mode = 'free';
    this.sim.state.chapter = openedTo(s);
    s.voyage = 'preparing';
    s.voyageTime = 0;
    s.companions = [];
    s.farewell = [];
    s.plans = [];
    s.resting = [];
    s.phase = 'night';
    s.elapsed = 0;
    this.change();
    return yes;
  }

  // ── Time ────────────────────────────────────────────────────────────────

  /** One fixed step of the simulation. */
  step(dt: number): void {
    const s = this.state;
    this.life += dt;
    if (s.voyage === 'gathering' || s.voyage === 'sailing') return this.stepVoyage(dt);
    if (s.phase === 'day') {
      const steps = s.hurry ? HURRY : 1;
      for (let i = 0; i < steps && s.phase === 'day'; i++) this.daylight(dt);
    } else if (s.phase === 'evening') this.fireside(dt);
    else if (s.phase === 'night') this.night(dt);
  }

  private daylight(dt: number): void {
    const s = this.state;
    const before = s.elapsed;
    const now = Math.round((before + dt) * 1000) / 1000;
    s.elapsed = now;
    this.sim.setClock(clockTick(s.day, now, TICK));
    this.sim.stepWildlife();

    for (const outing of s.outings) this.legEvents(outing, before, now);
    for (const sighting of s.sightings) {
      if (sighting.appear > before && sighting.appear <= now) this.emit('sighting', sighting.at);
    }
    const finished = workDuring(s, before, now, this.nav);
    if (finished) { this.emit('build-done', finished); s.news.push(`${structureDef(finished.kind).name} is finished.`); this.updateGround(); }
    const site = s.resting.length > 0 ? underWay(s) : null;
    if (site && Math.floor(before / HAMMER_EVERY) !== Math.floor(now / HAMMER_EVERY)) this.emit('hammer', site);
    const unresolved = s.outings.some((o) => o.fork && o.fork.answer === null);
    const lastReturn = Math.max(8, ...s.outings.flatMap((o) => o.legs.filter((l) => !s.moving || l.kind === 'walk').map((l) => l.end)));
    const builders = s.workedOn !== null || s.resting.some((id) => { const project = underWay(s, homeRegion(s, id)); return project && canWorkOn(s, id, project, this.nav); });
    const closes = builders || unresolved ? DAY_SECONDS : Math.min(DAY_SECONDS, lastReturn + 5);
    if (now >= closes - 1e-9) this.beginEvening();
  }

  /** Cues as beats begin, and forks that nobody answered resolving by nature. */
  private legEvents(outing: Outing, before: number, now: number): void {
    const forkLeg = outing.legs.find((l) => l.fork);
    if (outing.fork && outing.fork.answer === null && forkLeg && now >= forkLeg.end) {
      continueAfterFork(this.world(), outing, natureChoice(outing.person), forkLeg.end, this.router());
    }
    for (const leg of outing.legs) {
      if (leg.start <= before || leg.start > now) continue;
      const at = leg.at ?? leg.points?.[0];
      if (leg.reveal && outing.pack) this.emit(`pack-${outing.pack}` as Cue, at);
      else if (leg.fork) this.emit('choice', at);
      else if (leg.kind === 'beat') this.emit(BEAT_CUE[outingStop(outing, leg.start + .001).activity] ?? 'beat', at);
    }
  }

  private beginEvening(): void {
    const s = this.state;
    const arrived = s.moving;
    let welcomeLine: string | undefined;
    if (s.moving) {
      s.moving = false;
      s.region = Math.min(REGIONS.length - 1, s.region + 1);
      this.sim.state.chapter = s.region;
      this.settle(s.region);
      s.news.unshift(`We have come down the river to ${REGIONS[s.region]!.name}.`);
      this.tellStory(s.region - 1);
      const welcome = ECONOMY.welcome[s.region] ?? 0;
      if (welcome > 0 && !s.free) {
        s.provisions += welcome;
        s.materials += ECONOMY.welcomeMaterials[s.region] ?? 0;
        welcomeLine = (s.region === 2 && arrivalOf(s.course) === 'kawagiri' ? WELCOME_EAST : WELCOME[s.region]) ?? 'Our new neighbours shared their supper.';
        s.news.push(welcomeLine);
      }
      // Halfway down, a first hint that the river can be walked for its own sake.
      if (s.region === 1 && !s.free) s.news.push('Some people never leave the river, the innkeeper says, and some never stop walking it.');
    }
    const w = this.world();
    s.phase = 'evening';
    s.elapsed = 0;
    s.hurry = false;
    const missed = s.sightings.filter((x) => !x.sketched).map((x) => x.find);
    // A thread's beat said on the road today: the next one waits for another evening.
    const talked = s.crossings.map((c) => c.exchange).filter(isThreadBeat);
    s.sightings = [];
    s.crossings = [];
    s.glints = [];
    const unfinished = s.buildings.filter((b) => !isComplete(b)).map((b) => b.id);
    // The arrival itself is the evening's story, told last by the fire.
    const evening = dusk(w, { arrived, welcomeLine, missed, talked });

    s.evening = evening;
    this.emit('evening', campOf(s.region).fire);
    const finished = s.buildings.find((b) => unfinished.includes(b.id) && isComplete(b));
    if (finished) this.emit('build-done', finished);
  }

  private fireside(dt: number): void {
    const s = this.state;
    const evening = s.evening!;
    s.elapsed = Math.round((s.elapsed + dt) * 1000) / 1000;
    while (!this.presentingEvening && evening.shown < evening.items.length && s.elapsed >= FIRST_UNPACK + evening.shown * UNPACK_SECONDS) this.showNext();
    // Stay on the evening page until the player turns it or closes the notebook.
  }

  /** Sets down the next bundle now, and keeps the rest to the same rhythm after it. */
  unpackNext(): Answer {
    const s = this.state;
    const evening = s.evening;
    if (s.phase !== 'evening' || !evening) return no('Nothing to unpack.');
    if (evening.shown >= evening.items.length) return this.finishEvening();
    this.showNext();
    s.elapsed = FIRST_UNPACK + (evening.shown - 1) * UNPACK_SECONDS;
    return yes;
  }

  /** One idempotent Journal handoff, even when a delayed click arrives after dawn. */
  nextMorning(): Answer {
    if (this.state.phase === 'morning') return yes;
    if (this.state.phase !== 'evening' && this.state.phase !== 'night') return no('The day is still in progress.');
    this.finishEvening();
    if (this.state.phase === 'night') this.finishEvening();
    return yes;
  }

  /** Sets down everything left and lets the night pass; at night, brings the morning. */
  finishEvening(): Answer {
    const s = this.state;
    if (s.phase === 'night') {
      this.dawn(true);
      return yes;
    }
    if (s.phase !== 'evening' || !s.evening) return no('It is not evening.');
    while (s.evening.shown < s.evening.items.length) this.showNext();
    this.beginNight();
    return yes;
  }

  /** One quiet handoff to the Journal, retaining the same effects and saved report. */
  collectReturns(): Answer {
    const evening = this.state.evening;
    if (this.state.phase !== 'evening' || !evening) return no('It is not evening.');
    const pending = evening.shown < evening.items.length;
    while (evening.shown < evening.items.length) this.showNext(false);
    this.settleEvening();
    if (pending) this.emit('unpack', campOf(this.state.region).fire);
    return yes;
  }

  private showNext(sound = true): void {
    const s = this.state;
    const evening = s.evening!;
    const item = evening.items[evening.shown]!;
    applyEffect(s, evening.effects[evening.shown]!);
    evening.shown++;
    const cue: Cue = (item.kind === 'supplies' || item.kind === 'materials') ? 'supplies' : item.kind === 'lead' ? 'lead' : item.kind === 'find' ? (item.hint === 'rare' ? 'rare-find' : 'find') : 'unpack';
    if (sound) this.emit(cue, campOf(s.region).fire);
    if (evening.shown === evening.items.length) this.settleEvening();
  }

  private settleEvening(): void {
    const s = this.state;
    const evening = s.evening;
    if (!evening || evening.settled) return;
    evening.settled = true;
    const paid = Math.min(s.provisions, ECONOMY.dailyUpkeep);
    s.provisions -= paid;
    // Upkeep is paid quietly; the tally shows it, the closing line stays a reason to go somewhere.
    const lead = tomorrowFor(this.world(), evening, this.world(this.state.day + 1));
    evening.tomorrow = lead.line;
    if (lead.note) evening.tomorrowNote = lead.note; else delete evening.tomorrowNote;
    if (lead.place) evening.tomorrowPlace = lead.place; else delete evening.tomorrowPlace;
    // The evening ends on what the river says about tomorrow (from day 4, as the morning does).
    const sign = s.region === 0 && s.day + 1 <= 3 || readyToMove(s) ? null : riverSign(this.world(s.day + 1));
    if (sign && sign.place !== evening.tomorrowPlace) evening.tomorrowSign = sign.line; else delete evening.tomorrowSign;
    recordDay(s, paid);
    this.updateGround();
  }

  private beginNight(): void {
    this.settleEvening();
    const s = this.state;
    s.phase = 'night';
    s.elapsed = 0;
    this.change();
  }

  private night(dt: number): void {
    const s = this.state;
    s.elapsed = Math.round((s.elapsed + dt) * 1000) / 1000;
    if (s.elapsed >= NIGHT_SECONDS) this.dawn(true);
  }

  /** The next morning: the river moves, leads age, and the notebook gets the overnight news. */
  private dawn(announce: boolean): void {
    this.planHistory = [];
    this.planFuture = [];
    const s = this.state;
    const yesterday = this.world();
    const wasOpen = new Set(s.known.filter((id) => isOpen(placeDef(id), yesterday.today, s)));
    s.day++;
    const moved = s.moving;
    if (moved) {
      s.moving = false;
      const fromRegion = s.region;
      s.region = Math.min(REGIONS.length - 1, s.region + 1);
      this.sim.state.chapter = s.region;
      this.settle(s.region);
      for (const person of s.people) if (person.base === fromRegion) {
        person.base = s.region;
        if (s.region === 2 && arrivalOf(s.course) === 'ashikari') person.lodging = 'ashikari'; else delete person.lodging;
      }
      s.news.unshift(`We have come down the river to ${REGIONS[s.region]!.name}.`);
      this.tellStory(s.region - 1);
    }
    s.phase = 'morning';
    s.dayStart = { provisions: s.provisions, materials: s.materials };
    s.elapsed = 0;
    s.hurry = false;
    s.plans = [];
    s.resting = [];
    s.workedOn = null;
    s.outings = [];
    s.sightings = [];
    s.crossings = [];
    s.glints = [];
    s.evening = null;
    pruneLeads(s, s.day);
    for (const b of s.buildings) {
      if (stageOf(b, s.day) === 2 && stageOf(b, s.day - 1) < 2) s.news.push(`${placedName(b.kind)} has grown.`);
    }
    s.morning = this.report(wasOpen);
    s.news = [];
    s.revealed = [];
    s.notes.unshift({ id: s.nextId++, day: s.day, text: riverLine(this.seed, s.day, s.region) });
    s.notes.length = Math.min(s.notes.length, 30);
    writeAlmanac(this.world());
    this.sim.setClock(clockTick(s.day, 0, TICK));
    this.updateGround();
    if (!announce) return;
    if (moved) this.emit('region', campOf(s.region).fire);
    if (shiftedOn(this.seed, s.day)) this.emit('river-shift');
    this.emit('morning', campOf(s.region).fire);
  }

  /**
   * A small moment for each friend at a turn of the journey: kept as a memory,
   * one told as news. The reach's own friend tells it where there is one (Mina
   * on reaching Mio, Ren on reaching Kawagiri); otherwise it goes round.
   */
  private tellStory(beat: number, who: readonly string[] = this.state.people.map((p) => p.id)): void {
    const s = this.state;
    const told = who.flatMap((id) => {
      const line = personDef(id).story[beat];
      const person = s.people.find((p) => p.id === id);
      if (!line || !person) return [];
      person.memories.unshift(line);
      person.memories.length = Math.min(person.memories.length, 5);
      return [{ id, text: line }];
    });
    const teller = told.find((t) => t.id === STORY_TELLERS[beat]) ?? told[s.day % Math.max(1, told.length)];
    if (teller) s.news.push(teller.text);
  }

  private report(wasOpen: Set<string>): AdventureState['morning'] {
    const s = this.state;
    const today = this.world();
    const here = s.known.filter((id) => placeDef(id).region === s.region);
    const opened = here.filter((id) => isOpen(placeDef(id), today.today, s) && (!wasOpen.has(id) || s.revealed.includes(id)));
    const closed = here.filter((id) => wasOpen.has(id) && !isOpen(placeDef(id), today.today, s));
    return {
      // When the story's line is about the stream this morning, the river's sentence keeps to the river.
      river: shiftedOn(this.seed, s.day) ? riverLine(this.seed, s.day, s.region, !goalLine(s).includes('stream below Seseragi')) : null,
      weather: WEATHER_WORDS[today.today.weather],
      opened: opened.map((id) => placeDef(id).name),
      closed: closed.map((id) => placeDef(id).name),
      leads: opportunities(today),
      expiring: s.leads.filter((l) => l.expires === s.day).map((l) => `Last day for the clue at ${placeDef(l.place).name}.`),
      news: [...s.news],
    };
  }

  private firstMorning(): AdventureState['morning'] {
    const s = this.state;
    const today = this.world().today;
    const closed = s.known.filter((id) => !isOpen(placeDef(id), today, s)).map((id) => placeDef(id).name);
    return { river: null, weather: WEATHER_WORDS[today.weather], opened: [], closed, leads: opportunities(this.world()), expiring: [], news: [] };
  }

  /** Puts the reach's first places on the map, and the few already heard of; in Free Play, all of them. */
  private settle(region: number): void {
    const s = this.state;
    // Down the east bank, the group comes straight to Kawagiri and knows that shore first.
    const east = !s.free && region === 2 && arrivalOf(s.course) === 'kawagiri';
    const known = s.free ? PLACES.filter((p) => p.region === region && !isSecretPlace(p.id)).map((p) => p.id) : east ? EAST_ARRIVAL.known : KNOWN_AT_START[region] ?? [];
    for (const id of known) reveal(s, id);
    for (const id of east ? EAST_ARRIVAL.heard : HEARD_AT_START[region] ?? []) (DISCOVERY ? hearOf : reveal)(s, id);
    if (region === 2 && !east) s.visits.ashikari = Math.max(1, s.visits.ashikari ?? 0);
    // Home is home: its settlement counts as visited from the start.
    for (const place of PLACES) if (place.region === region && place.kind === 'settlement' && (region !== 2 || s.free || east)) s.visits[place.id] = Math.max(1, s.visits[place.id] ?? 0);
  }

  private stepVoyage(dt: number): void {
    const s = this.state;
    s.voyageTime += dt;
    if (s.voyage === 'gathering') {
      // Everyone is aboard: hold a moment at first light, with a bell from the landing.
      const hold = gatheringSeconds(s) - GATHER_HOLD;
      if (s.voyageTime - dt < hold && s.voyageTime >= hold) this.emit('morning', moorings(s) ?? undefined);
      if (s.voyageTime >= gatheringSeconds(s)) {
        s.voyage = 'sailing';
        s.voyageTime = 0;
        this.emit('sail', moorings(s) ?? undefined);
      }
      return;
    }
    // The bar, and open water.
    if (s.voyageTime - dt < barSeconds(s) && s.voyageTime >= barSeconds(s)) this.emit('region');
    if (s.free && s.voyageTime >= sailSeconds(s)) return this.homeFromSea();
    if (s.voyageTime >= VOYAGE_SECONDS) {
      s.voyage = 'ended';
      s.sailed = true;
      s.voyageTime = VOYAGE_SECONDS;
      s.notes.unshift({ id: s.nextId++, day: s.day, text: 'Beyond the reeds, the river becomes the sea.' });
      this.change();
    }
  }

  /** A Wander sail is a day out: everyone is home by dark, the boat back at its mooring, ready for another day. */
  private homeFromSea(): void {
    const s = this.state;
    const first = !s.sailed;
    s.sailed = true;
    s.notes.unshift({ id: s.nextId++, day: s.day, text: first ? 'Out past the bar today, to the sea, and home by dark.' : 'Out on the boat again, and home by dark.' });
    s.voyage = 'preparing';
    s.voyageTime = 0;
    s.companions = [];
    s.farewell = [];
    s.plans = [];
    s.resting = [];
    s.phase = 'night';
    s.elapsed = 0;
    this.change();
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /**
   * One outing a day at most is given a fork. The first day has none; day two
   * always has one, so it is met early; after that most days do. An outing
   * sure of a find never forks, so turning back cannot lose it.
   */
  private forkToday(w: World): string | null {
    const s = this.state;
    if (s.day < 2) return null;
    const eligible = s.plans.filter((p) => {
      const a = assess(w, p);
      return a.beats === 2 && !a.sure && !a.farther;
    });
    if (eligible.length === 0) return null;
    const rng = mulberry32(hashString(`fork:${this.seed}:${s.day}`));
    if (s.day !== 2 && rng() > 0.8) return null;
    return eligible[Math.floor(rng() * eligible.length)]!.person;
  }

  router(): Router {
    const bottom = REGIONS[openedTo(this.state)]!.bottom;
    return (from, to) => this.nav.route(from, to, bottom) ?? [from, to];
  }

  private updateGround(): void {
    // A completed crossing makes the first far-bank paths visible, without
    // giving away the discovery that actually charts the road to the sea.
    if (this.state.buildings.some(b => b.region === 1 && b.kind === 'bridge' && isComplete(b) && dist(b, NARROWS) < 170)) {
      reveal(this.state, 'mukoniwa');
      hearOf(this.state, 'kitsuneyama');
      hearOf(this.state, 'higashimori');
    }
    this.nav.setOpenGround(openGround(this.sim.board, this.world().today, this.state));
  }

  private refuse(reason: string): Answer {
    this.emit('refuse');
    return no(reason);
  }

  private emit(cue?: Cue, at?: Vec): void {
    this.sim.events.emit('adventure', { cue, at });
  }

  private change(): void {
    this.sim.events.emit('adventure', {});
  }

  // ── Snapshots ───────────────────────────────────────────────────────────

  view(): AdventureView {
    return buildView(this);
  }

  scene(): AdventureScene {
    return buildScene(this);
  }

  /** Dev and test helper: plays forward to the next morning with everyone left at home. */
  runToMorning(): void {
    const s = this.state;
    if (s.phase === 'morning') {
      for (const id of unplanned(s)) this.rest(id);
      this.begin();
    }
    for (let guard = 0; guard < 4000 && s.phase !== 'morning'; guard++) { this.step(TICK); if (s.phase === 'evening' && this.state.phase === 'evening' && s.elapsed >= CAMP_GATHER_SECONDS) this.nextMorning(); }
  }

  /** Dev helper: on to the next season. */
  skipToNextSeason(): void {
    const season = seasonOf(this.state.day);
    for (let guard = 0; guard < 8 && seasonOf(this.state.day) === season; guard++) this.runToMorning();
  }
}

/** Whose news it is on reaching each reach: Mina's seed bag in Mio, Ren's tasting in Kawagiri. */
const STORY_TELLERS: readonly string[] = ['mina', 'ren'];

/** What our hosts share when we arrive. */
const WELCOME: Record<number, string> = {
  1: 'The innkeeper at Toroya sent over a pot of something with chestnuts in it.',
  2: 'The reed cutters at Ashikari shared their supper, a string of dried fish, and a bundle of old boards for the boat.',
};
const WELCOME_EAST = 'The fishing families at Kawagiri shared their supper, a string of dried fish, and a bundle of old boards for the boat.';

function placedName(kind: StructureKind): string {
  const names: Partial<Record<StructureKind, string>> = { 'lily-bed': 'The lily bed', willow: 'The young willow', 'fruit-tree': 'The apple tree' };
  return names[kind] ?? 'The planting';
}

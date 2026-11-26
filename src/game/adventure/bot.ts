/**
 * A seeded playtest bot. It plays the way a thoughtful first-time player
 * might: follows leads, chases what the forecast says is likely, tries new
 * places, builds what the story asks for, sketches some creatures and answers
 * some forks. It is not optimal on purpose. Used by the tests and by
 * `scripts/adventure-playthrough.ts`; the game itself never runs it.
 */

import { WAY_ROUTES } from './course';
import type { Vec } from '../core/math';
import { hashString, mulberry32, type Rng } from '../core/rng';
import { CAMP_GATHER_SECONDS } from './calendar';
import { TICK } from '../simulation/simulation';
import { isOpen } from './conditions';
import { placeDef } from './content';
import type { ExpeditionAdventure } from './expedition';
import type { Activity, Equipment, OutingPlan, StructureKind } from './model';
import { assess, unplanned } from './odds';
import { packedToMove, readyToMove } from './progression';
import { STREAM_CROSSING, streamCrossable } from './stream';
import { personDef } from './people';
import { REGIONS, campOf } from './regions';
import { availableLodgings, homeRegion, isComplete, isBuilt, lodgingOf } from './world';
import { isMajor, structureDef } from './structures';
import { wishesFor } from './wishes';

export interface BotLog {
  (line: string): void;
}

/** Optional hooks for watching the bot play. */
export interface BotWatch {
  /** At the start of the morning, before anything is decided. */
  morning?: () => void;
  /** After the morning's decisions, before the day begins. */
  planned?: () => void;
  /** After every step of the day, evening and night. */
  stepped?: () => void;
}

/** What the bot wants built in each reach, in order, once the story allows it. */
const WANTS: StructureKind[][] = [
  ['shelter', 'lookout', 'garden', 'platform'],
  ['cottage', 'bridge', 'willow', 'fruit-tree'],
  ['dock', 'boat', 'lookout', 'shelter'],
];

const ITEM_FOR: Partial<Record<Activity, Equipment>> = { fish: 'fishing-kit', forage: 'field-kit', investigate: 'field-kit', explore: 'walking-staff' };

export class PlaytestBot {
  private readonly rng: Rng;

  constructor(private readonly a: ExpeditionAdventure, seed: number, private readonly log: BotLog = () => {}, private readonly watch: BotWatch = {}) {
    this.rng = mulberry32(hashString(`bot:${seed}`));
  }

  /** Plays one whole day, morning to morning. */
  playDay(): void {
    const a = this.a;
    const s = a.state;
    if (a.canSail) {
      a.sail(s.people.map((p) => p.id));
      this.log(`Day ${s.day}: sailing for the sea with ${s.people.map((p) => personDef(p.id).name).join(', ')}.`);
      for (let guard = 0; guard < 2000 && s.voyage !== 'ended'; guard++) a.step(TICK);
      return;
    }
    this.crossStream();
    if (readyToMove(s)) {
      const next = REGIONS[s.region + 1]!;
      if (a.moveEveryone(next.id).ok) this.stopOnTheWay();
      const departed = s.plans.length ? a.begin() : a.travel();
      if (departed.ok) {
        for (let guard = 0; guard < 2000 && s.phase !== 'morning'; guard++) {
          a.step(TICK);
          if (s.phase === 'evening' && s.elapsed >= CAMP_GATHER_SECONDS) a.nextMorning();
        }
        return;
      }
    }
    this.watch.morning?.();
    this.build();
    this.kit();
    this.plan();
    this.watch.planned?.();
    const begun = a.begin();
    if (!begun.ok) throw new Error(`Day ${s.day}: ${begun.reason}`);
    this.watchDay();
    for (let guard = 0; guard < 2000 && s.phase !== 'morning'; guard++) {
      a.step(TICK);
      if (s.phase === 'evening' && s.elapsed >= CAMP_GATHER_SECONDS) a.nextMorning();
      this.watch.stepped?.();
    }
  }

  /** Packed, but the stream below Seseragi is up: half the time set stones across, otherwise wait for it to drop. */
  private crossStream(): void {
    const a = this.a;
    const s = a.state;
    if (s.region !== 0 || !packedToMove(s) || streamCrossable(s) || a.buildingProblem('stones')) return;
    if (this.rng() < 0.5 && a.place('stones', STREAM_CROSSING).ok) this.log(`Day ${s.day}: placed stones.`);
  }

  /** On the moving morning, sometimes one friend takes the most promising stop on the way down. */
  private stopOnTheWay(): void {
    const a = this.a;
    if (this.rng() < 0.4) return;
    const best = a.state.people.flatMap((person) => a.detourStops(person.id).map((stop) => ({ person: person.id, stop, forecast: a.detourForecast(person.id, stop) })))
      .filter((x) => !x.forecast.problem && (x.forecast.chance === 'certain' || x.forecast.pips >= 2 || (x.forecast.provisions ?? 0) + (x.forecast.materials ?? 0) > 0))
      .sort((x, y) => Number(y.forecast.chance === 'certain') - Number(x.forecast.chance === 'certain') || y.forecast.pips - x.forecast.pips)[0];
    if (best && a.detour(best.person, best.stop).ok) this.log(`Day ${a.state.day}: ${personDef(best.person).name} stops at ${placeDef(best.stop.place).name} on the way down.`);
  }

  private build(): void {
    const a = this.a;
    const s = a.state;
    if (s.buildings.some((b) => !isComplete(b) && b.region === s.region)) return;
    for (const kind of WANTS[s.region] ?? []) {
      if (!this.wanted(kind) || a.buildingProblem(kind)) continue;
      const site = this.siteFor(kind);
      if (!site) continue;
      const placed = a.place(kind, site);
      if (placed.ok) this.log(`Day ${s.day}: placed ${kind}.`);
      if (placed.ok && isMajor(kind)) return;
    }
  }

  /** Builds the gate structure only on the route the bot has found; the garden when there is spare. */
  private wanted(kind: StructureKind): boolean {
    const s = this.a.state;
    if (s.buildings.some((b) => b.kind === kind)) return false;
    const found = (id: string): boolean => !!s.discoveries[id];
    // A small work someone has asked for, when there is timber to spare beyond the next story work.
    const spare = (): boolean => s.materials >= structureDef(kind).cost + (s.region === 2 ? 10 : 3);
    const wished = (): boolean => wishesFor(kind).some((w) => s.people.find((p) => p.id === w.person)?.wish !== undefined && !s.discoveries[w.find] && homeRegion(s, w.person) === s.region) && spare();
    switch (kind) {
      case 'shelter': return s.region === 2 ? wished() : found('waymark') && !isBuilt(s, 'lookout');
      case 'lookout': return s.region === 2 ? wished() : found('long-view') && !found('waymark') && !isBuilt(s, 'shelter');
      case 'garden': return s.materials >= 7 || wished();
      case 'platform': return wished();
      // In a year whose way down is on the far bank, the bridge keeps Aki's promise and opens the way.
      case 'cottage': return found('aki-meeting') && s.course.way === 'reeds';
      case 'bridge': return s.course.way !== 'reeds' ? found('aki-meeting') : isBuilt(s, 'cottage') && s.materials >= 9;
      default: return true;
    }
  }

  private siteFor(kind: StructureKind): Vec | null {
    // Small works go by the fire, where the group lives.
    return this.siteNear(kind, campOf(this.a.state.region).fire);
  }

  private siteNear(kind: StructureKind, fire: Vec): Vec | null {
    const a = this.a;
    if (kind === 'bridge') return { x: 1090, y: 3580 };
    for (let r = 120; r < 1000; r += 60) {
      for (let k = 0; k < 16; k++) {
        const angle = (k / 16) * Math.PI * 2;
        const at = { x: Math.round(fire.x + Math.cos(angle) * r), y: Math.round(fire.y + Math.sin(angle) * r) };
        if (!a.siteProblem(kind, at)) return at;
      }
    }
    return null;
  }

  private kit(): void {
    const s = this.a.state;
    for (const item of ['rain-cape', 'fishing-kit', 'walking-staff', 'field-kit'] as Equipment[]) {
      if (!s.equipment.includes(item) && s.materials >= 12) {
        this.a.craft(item);
        this.log(`Day ${s.day}: made the ${item}.`);
        return;
      }
    }
  }

  private plan(): void {
    const a = this.a;
    const s = a.state;
    // In the mountain opening, bring the newly met group down to the known
    // village before preparing the journey. This is a test-player decision.
    if (s.region === 0 && s.known.includes('seseragi') && s.people.some((p) => p.id === 'ren') && s.people.every((p) => p.lodging === 'yamagoya')) {
      for (const person of s.people) a.assign({ person: person.id, place: 'seseragi', activity: 'visit', item: null, companion: null });
      return;
    }
    if (s.region === 2 && s.known.includes('kawagiri') && s.people.some((p) => p.base === 2 && p.lodging !== undefined) && a.moveEveryone('kawagiri').ok) return;
    // Scouting onward is an actual outing from an overnight base, not a global shelter bonus.
    const routeFinds = s.region === 0 ? ['waymark', 'long-view'] : [WAY_ROUTES[s.course.way].find];
    if (s.region < 2 && !routeFinds.some((id) => s.discoveries[id]) && !s.people.some((p) => lodgingOf(s, p.id))) {
      const explorer = s.people.find((p) => p.id === 'sora')!;
      for (const base of availableLodgings(s).filter((base) => base.region === s.region)) {
        if (a.camp(explorer.id, base.id).ok) break;
      }
    }
    // A story work is a group job: Aki (or whoever is newest) and one more stay to build.
    if (s.buildings.some((b) => !isComplete(b) && b.region === s.region)) {
      const builders = [s.people.find((p) => p.id === 'aki'), ...[...s.people].reverse().filter((p) => p.id !== 'aki')].filter((p) => !!p).slice(0, s.people.length > 2 ? 2 : 1);
      for (const builder of builders) a.rest(builder!.id);
    }
    const w = a.world();
    const taken = new Set<string>();
    for (const person of unplanned(s)) {
      let best: { plan: OutingPlan; value: number } | null = null;
      for (const id of [...s.known, ...s.rumoured]) {
        const place = placeDef(id);
        if (place.region !== s.region || !isOpen(place, w.today, s)) continue;
        for (const activity of place.activities) {
          const plan: OutingPlan = { person, place: id, activity, item: null, companion: null };
          const value = this.value(plan, taken);
          if (!best || value > best.value) best = { plan, value };
        }
      }
      if (!best || best.value < 4) {
        a.rest(person);
        continue;
      }
      const item = this.itemFor(best.plan);
      const answer = a.assign({ ...best.plan, item });
      if (!answer.ok) a.rest(person);
      else taken.add(best.plan.place);
    }
  }

  private value(plan: OutingPlan, taken: Set<string>): number {
    const a = this.a;
    const s = a.state;
    const odds = assess(a.world(), plan);
    if (odds.problem) return -1;
    const foodValue = s.provisions < 4 ? 18 : s.provisions < 10 ? 7 : 1;
    const materialValue = s.materials < 5 ? 13 : s.materials < 12 ? 7 : 1;
    let value = odds.provisions * foodValue + odds.materials * materialValue + odds.pips * 3 + odds.candidates.length;
    if (odds.sure?.story) value += 35;
    if (odds.lead) value += 15;
    else if (odds.certain) value += 25;
    // The bot likes to find new places, and to hear of them.
    if (odds.reasons.some((r) => r.text === 'Finding the way there')) value += 22;
    if (odds.reasons.some((r) => r.text.startsWith('Reveals '))) value += 22;
    if (!s.visits[plan.place]) value += 8;
    if (taken.has(plan.place)) value -= 40; // A sensible player rarely sends everyone to the same door.
    if (personDef(plan.person).gift === plan.activity) value += 3;
    return value + this.rng() * 10;
  }

  private itemFor(plan: OutingPlan): Equipment | null {
    const s = this.a.state;
    const w = this.a.world();
    const used = new Set(s.plans.map((p) => p.item));
    const wet = w.today.weather === 'rain' || w.today.weather === 'snow';
    const wanted = wet ? 'rain-cape' : ITEM_FOR[plan.activity];
    return wanted && s.equipment.includes(wanted) && !used.has(wanted) ? wanted : null;
  }

  private watchDay(): void {
    const a = this.a;
    const s = a.state;
    for (let guard = 0; guard < 2000 && s.phase === 'day'; guard++) {
      a.step(TICK);
      this.watch.stepped?.();
      for (const sighting of s.sightings) {
        if (!sighting.sketched && s.elapsed >= sighting.appear + 1 && s.elapsed < sighting.appear + 1 + TICK && this.rng() < 0.6) a.sketch(sighting.id);
      }
      for (const outing of s.outings) {
        const leg = outing.legs.find((l) => l.fork);
        if (outing.fork && outing.fork.answer === null && leg && s.elapsed >= leg.start + 2 && s.elapsed < leg.start + 2 + TICK && this.rng() < 0.5) {
          a.choose(`fork-${outing.person}`, this.rng() < 0.6 ? 0 : 1);
        }
      }
    }
  }
}

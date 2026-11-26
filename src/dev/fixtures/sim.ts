/**
 * A pretend rules engine for the notebook demo. It answers commands by
 * changing its fixture so the interface can be felt end to end: plan, begin,
 * watch a short day with beats and a fork, unpack by the fire, a few seconds
 * of night, and the next morning with the river changed.
 *
 * Nothing here is the real game; timings are short so a whole day fits in
 * half a minute.
 */

import type { AdventureCommand, AdventureView, FriendView, TagView } from '../../game/adventure/model';
import { forecastFor } from './forecast';
import { SPOTS, tag, unpackTags, type Backdrop } from './states';
import { CAMP } from './world';

/** Seconds of demo time in a day at 1×. */
const DAY_SECONDS = 30;
/** Seconds a beat tag stays. */
const BEAT_SECONDS = 6;
/** Seconds a choice waits before the friend decides. */
const CHOICE_SECONDS = 8;
const NIGHT_MS = 3000;

interface Scheduled {
  at: number;
  done: boolean;
  run: () => void;
}

export class DemoRules {
  private clock = 0;
  private schedule: Scheduled[] = [];

  constructor(
    /** The fixture being played; the demo may swap in a real snapshot before it starts. */
    public view: AdventureView,
    private readonly push: () => void,
    private readonly setBackdrop: (b: Backdrop) => void,
    /** The real session answers a `notebook` command by opening the notebook; the demo does the same. */
    private readonly openNotebook: (c: Extract<AdventureCommand, { type: 'notebook' }>) => void,
  ) {
    view.forecast = (plan) => forecastFor(this.view, plan);
  }

  /** Advances the pretend day; called every frame with real seconds. */
  tick(dt: number): void {
    const v = this.view;
    let changed = false;
    if (v.phase === 'day' && !v.paused && v.voyage === 'preparing') {
      const step = dt * v.speed;
      this.clock += step;
      v.dayProgress = Math.min(1, this.clock / DAY_SECONDS);
      for (const s of this.schedule) {
        if (!s.done && this.clock >= s.at) {
          s.done = true;
          s.run();
        }
      }
      for (const t of v.tags) t.remaining = Math.max(0, t.remaining - step);
      const expired = v.tags.filter((t) => t.kind === 'beat' && t.remaining <= 0);
      const timedOut = v.tags.find((t) => t.kind === 'choice' && t.remaining <= 0);
      if (expired.length) v.tags = v.tags.filter((t) => !expired.includes(t));
      if (timedOut) this.resolveChoice(timedOut, -1);
      if (this.clock >= DAY_SECONDS) this.toEvening();
      changed = true;
    }
    if (changed) this.push();
  }

  command(c: AdventureCommand): void {
    const v = this.view;
    switch (c.type) {
      case 'assign': {
        v.plans = v.plans.filter((p) => p.person !== c.plan.person);
        v.plans.push({ ...c.plan, forecast: forecastFor(v, c.plan) });
        this.setStatus(c.plan.person, 'planned', `Going to ${v.places.find((p) => p.id === c.plan.place)?.name ?? ''}`);
        if (c.plan.item) v.equipment.forEach((e) => (e.with = e.id === c.plan.item ? c.plan.person : e.with === c.plan.person ? null : e.with));
        if (c.plan.companion) this.setStatus(c.plan.companion, 'planned', 'Going along');
        break;
      }
      case 'cancel-plan': {
        const plan = v.plans.find((p) => p.person === c.person);
        v.plans = v.plans.filter((p) => p.person !== c.person);
        v.equipment.forEach((e) => {
          if (e.with === c.person) e.with = null;
        });
        this.setStatus(c.person, 'home', 'In Seseragi');
        if (plan?.companion) this.setStatus(plan.companion, 'home', 'In Seseragi');
        break;
      }
      case 'rest':
        this.setStatus(c.person, 'resting', 'By the fire in Seseragi');
        break;
      case 'begin':
        this.begin();
        break;
      case 'skip':
        if (v.phase === 'day') this.toEvening();
        break;
      case 'choose': {
        const t = v.tags.find((x) => x.id === c.tag);
        if (t) this.resolveChoice(t, c.choice);
        break;
      }
      case 'evening':
        this.evening(c.step);
        break;
      case 'inspect':
        v.tags = v.tags.filter((t) => t.kind !== 'place');
        if (c.place) {
          const place = v.places.find((p) => p.id === c.place);
          if (place) v.tags.push({ ...tag(place.id, 'place', SPOTS.pool, null, null, place.name, null), remaining: 0 });
        }
        break;
      case 'craft': {
        const e = v.equipment.find((x) => x.id === c.equipment);
        if (e && !e.owned && v.provisions >= e.cost) {
          e.owned = true;
          v.provisions -= e.cost;
        }
        break;
      }
      case 'place':
        v.placing = c.kind;
        // The demo has no valley to click: a site is "chosen" after a moment.
        window.setTimeout(() => {
          const s = v.structures.find((x) => x.id === c.kind);
          if (v.placing === c.kind && s) {
            s.status = 'building';
            s.progress = 0;
            v.placing = null;
            this.push();
          }
        }, 1400);
        break;
      case 'cancel-placement':
        v.placing = null;
        break;
      case 'sail':
        v.voyage = 'gathering';
        for (const id of c.companions) this.setStatus(id, 'aboard', 'Aboard');
        window.setTimeout(() => {
          v.voyage = 'sailing';
          this.push();
        }, 1500);
        window.setTimeout(() => {
          v.voyage = 'ended';
          this.push();
        }, 4500);
        break;
      case 'continue-valley':
        v.voyage = 'preparing';
        v.canSail = false;
        for (const f of v.friends) if (f.status === 'aboard') this.setStatus(f.id, 'home', 'In Seseragi');
        break;
      case 'notebook':
        this.openNotebook(c);
        break;
      default:
        // focus, follow, sketch, landscape: the valley's business, nothing to show here.
        break;
    }
    this.refreshNextStep();
    this.push();
  }

  private setStatus(id: string, status: FriendView['status'], line: string): void {
    const f = this.view.friends.find((x) => x.id === id);
    if (!f) return;
    f.status = status;
    f.statusLine = line;
  }

  private refreshNextStep(): void {
    const v = this.view;
    if (v.phase !== 'morning') return;
    const waiting = v.friends.filter((f) => f.status === 'home').map((f) => f.name);
    if (!waiting.length) v.nextStep = 'Everyone has a plan. Begin the day when you are ready.';
    else if (waiting.length === 1) v.nextStep = `${waiting[0]} is waiting for a plan.`;
    else v.nextStep = `${waiting.slice(0, -1).join(', ')} and ${waiting[waiting.length - 1]} are waiting for a plan.`;
  }

  private begin(): void {
    const v = this.view;
    if (v.phase !== 'morning' || v.friends.some((f) => f.status === 'home')) return;
    v.phase = 'day';
    v.hour = 'Daylight';
    v.paused = false;
    v.dayProgress = 0;
    v.morning = null;
    v.nextStep = 'The companions are out. Watch, or skip to evening.';
    for (const s of v.structures) {
      if (s.status === 'building' && s.progress === 0) {
        v.provisions = Math.max(0, v.provisions - s.cost);
        s.progress = 0.05;
      }
    }
    const out: FriendView[] = [];
    for (const plan of v.plans) {
      const place = v.places.find((p) => p.id === plan.place);
      const f = v.friends.find((x) => x.id === plan.person);
      if (!f || !place) continue;
      f.status = 'out';
      f.statusLine = `${plan.activity === 'fish' ? 'Fishing' : plan.activity === 'forage' ? 'Foraging' : 'Exploring'} at ${place.name.replace(/^The /, 'the ')}`;
      out.push(f);
    }
    v.plans = [];
    v.tags = [];
    this.clock = 0;
    const spots = [SPOTS.spring, SPOTS.pool, SPOTS.pond, SPOTS.mill];
    this.schedule = [];
    out.forEach((f, i) => {
      const at = spots[i % spots.length];
      this.schedule.push({
        at: 2 + i * 3,
        done: false,
        run: () => this.addTag(tag(`b1-${f.id}`, 'beat', at, f.id, null, `${f.name} sets out along the bank.`, null)),
      });
      this.schedule.push({
        at: 12 + i * 4,
        done: false,
        run: () => {
          f.pack = i === 0 ? 'rare' : 'unusual';
          this.addTag(
            tag(`b2-${f.id}`, 'beat', at, f.id, null, i === 0 ? 'Something silver in the deep water.' : 'A bright feather in the reeds.', f.pack),
          );
        },
      });
    });
    if (out[0]) {
      const f = out[0];
      this.schedule.push({
        at: 6,
        done: false,
        run: () =>
          this.addTag({
            ...tag(`choice-${f.id}`, 'choice', SPOTS.path, f.id, null, 'Tracks lead on past the spring.', null),
            choices: ['Follow', 'Turn back'],
            remaining: CHOICE_SECONDS,
          }),
      });
    }
    this.setBackdrop('day');
  }

  private addTag(t: TagView): void {
    if (t.kind === 'beat') t.remaining = BEAT_SECONDS;
    this.view.tags = [...this.view.tags.filter((x) => x.id !== t.id), t];
  }

  private resolveChoice(t: TagView, choice: number): void {
    const v = this.view;
    v.tags = v.tags.filter((x) => x.id !== t.id);
    const name = v.friends.find((f) => f.id === t.person)?.name ?? 'They';
    const text =
      choice === 1
        ? `${name} turns back toward the river.`
        : choice === 0
          ? `${name} follows the tracks uphill.`
          : `${name} follows their curiosity.`;
    this.addTag(tag(`after-${t.id}`, 'beat', SPOTS.path, t.person, null, text, null));
  }

  private toEvening(): void {
    const v = this.view;
    v.phase = 'evening';
    v.hour = 'Evening';
    v.dayProgress = 1;
    v.nextStep = 'The companions are home. See what they brought.';
    const items = v.friends
      .filter((f) => f.status === 'out' || f.status === 'resting')
      .map((f, i) => ({
        id: `u-${f.id}-${v.day}`,
        person: f.id,
        kind: f.status === 'resting' ? ('supplies' as const) : ('find' as const),
        hint: f.status === 'resting' ? ('plain' as const) : (f.pack ?? 'plain'),
        title: f.status === 'resting' ? 'Two days of provisions' : i === 0 ? 'Silver eel' : 'Kingfisher feather',
        text: f.status === 'resting' ? `${f.name} kept the fire.` : i === 0 ? 'Long as an arm, and quick as light.' : 'Blue as the deep pool.',
        sketch: f.status === 'resting' ? null : i === 0 ? 'silver-eel' : 'kingfisher-bird',
        provisions: f.status === 'resting' ? 2 : 1, materials: 2,
      }))
      // Rarest last.
      .sort((a, b) => rank(a.hint) - rank(b.hint));
    for (const f of v.friends) {
      f.status = 'home';
      f.statusLine = 'By the fire';
      f.at = { ...CAMP };
    }
    v.evening = { total: items.length, items, shown: items.length ? 1 : 0, tomorrow: 'The water is falling. The gravel bar may show by morning.' };
    v.tags = unpackTags(v);
    this.setBackdrop('dusk');
  }

  private evening(step: 'collect' | 'next' | 'finish' | 'morning'): void {
    const v = this.view;
    if (!v.evening) return;
    if (step === 'next' && v.evening.shown < v.evening.items.length) {
      v.evening.shown += 1;
      v.provisions += v.evening.items[v.evening.shown - 1].provisions;
      v.tags = unpackTags(v);
      return;
    }
    if (step === 'next') return;
    for (const item of v.evening.items.slice(v.evening.shown)) v.provisions += item.provisions;
    if (step === 'collect') { v.evening.shown = v.evening.items.length; return; }
    if (step === 'morning') this.toMorning();
    else this.toNight();
  }

  private toNight(): void {
    const v = this.view;
    v.phase = 'night';
    v.hour = 'Night';
    v.evening = null;
    v.tags = [];
    v.nextStep = 'The valley sleeps.';
    this.setBackdrop('night');
    window.setTimeout(() => this.toMorning(), NIGHT_MS);
  }

  private toMorning(): void {
    const v = this.view;
    v.day += 1;
    v.phase = 'morning';
    v.hour = 'Morning';
    v.paused = true;
    v.dayProgress = 0;
    for (const f of v.friends) {
      f.status = 'home';
      f.statusLine = 'In Seseragi';
      f.pack = null;
    }
    v.equipment.forEach((e) => (e.with = null));
    // The river falls overnight: the low crossings open and a lead appears.
    const fell = v.river.level === 'high';
    v.river = fell
      ? { level: 'middle', trend: 'falling', tomorrow: 'low', line: 'The water has fallen. New ground lies exposed.', shifted: true }
      : { ...v.river, shifted: false };
    const opened: string[] = [];
    if (fell) {
      for (const p of v.places) {
        if (p.state === 'closed') {
          p.state = 'open';
          p.stateLine = null;
          opened.push(p.id);
        }
      }
      const gravel = v.places.find((p) => p.id === 'gravel');
      if (gravel) {
        gravel.lead = 'The gravel bar is showing while the water stays low.';
        gravel.leadDays = 2;
      }
    }
    v.morning = {
      river: fell ? 'The river fell in the night. The gravel bar is showing.' : null,
      weather: 'Clear and bright.',
      opened,
      closed: [],
      leads: fell ? ['gravel'] : [],
      expiring: v.places.filter((p) => p.leadDays === 1).map((p) => p.id),
      news: [],
    };
    for (const p of v.places) if (p.leadDays !== null && !opened.includes(p.id) && p.id !== 'gravel') p.leadDays = Math.max(1, p.leadDays - 1);
    v.weather = 'clear';
    this.refreshNextStep();
    this.setBackdrop('day');
    this.push();
  }
}

function rank(hint: 'plain' | 'unusual' | 'rare' | 'story'): number {
  return hint === 'plain' ? 0 : hint === 'unusual' ? 1 : 2;
}

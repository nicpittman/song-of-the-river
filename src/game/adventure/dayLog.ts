/**
 * A readable log of everything the player would see in a day: the morning's
 * news and plans with their forecasts, every tag in the valley as it appears,
 * the bundles by the fire and the line about tomorrow. Used to judge the
 * writing and the rhythm from the tests and the playthrough script.
 */

import { seasonName } from './calendar';
import { placeDef } from './content';
import type { ExpeditionAdventure } from './expedition';
import { nameOf } from './people';
import { buildTags } from './view';

export class DayLog {
  readonly lines: string[] = [];
  private seen = new Set<string>();
  /** Leads already logged as new: a lead is news once, then only a mark on the map. */
  private told = new Set<string>();
  private shown = 0;

  constructor(private readonly a: ExpeditionAdventure) {}

  /** The morning, after the plans are made. */
  morning(): void {
    const a = this.a;
    const view = a.view();
    const s = a.state;
    this.seen.clear();
    this.shown = 0;
    this.lines.push('', `DAY ${s.day} · ${seasonName(view.season)} · ${view.weather} · river ${view.river.level}, ${view.river.trend}`);
    this.lines.push(`  River: ${view.river.line}`);
    const m = view.morning;
    if (m) {
      if (m.river) this.lines.push(`  Overnight: ${m.river}`);
      if (m.opened.length) this.lines.push(`  Opened: ${m.opened.join(', ')}`);
      if (m.closed.length) this.lines.push(`  Closed: ${m.closed.join(', ')}`);
      for (const lead of m.leads) {
        this.lines.push(this.told.has(lead) ? `  (On the map: ${lead})` : `  New lead: ${lead}`);
        this.told.add(lead);
      }
      for (const line of m.expiring) this.lines.push(`  ${line}`);
      for (const line of m.news) this.lines.push(`  News: ${line}`);
    }
    this.lines.push(`  Story: ${view.goal}`);
    this.lines.push(`  On the map: ${view.places.map((p) => `${p.name}${p.state === 'closed' ? ' (closed)' : p.state === 'special' ? ' (special)' : ''}${p.lead ? ' [lead]' : ''}`).join(', ')}`);
    for (const plan of view.plans) {
      const f = plan.forecast;
      const pips = '●'.repeat(f.pips) + (f.chance === 'certain' ? '◎' : '');
      const extras = [plan.item, plan.companion && `with ${nameOf(plan.companion)}`].filter(Boolean).join(', ');
      this.lines.push(`  Plan: ${nameOf(plan.person)} → ${placeDef(plan.place).name}, ${plan.activity}${extras ? ` (${extras})` : ''} · ${f.chance} ${pips} · ${f.length} · ${f.beats} beats`);
      for (const r of f.reasons) this.lines.push(`        ${r.sign} ${r.text}`);
    }
    for (const id of s.resting) this.lines.push(`  ${nameOf(id)} stays home.`);
    this.lines.push(`  Provisions: ${s.provisions} · Materials: ${s.materials}`);
  }

  /** Called after every step: new tags, the fire's bundles, tomorrow's line. */
  step(): void {
    const a = this.a;
    const s = a.state;
    const at = (): string => `[${String(Math.floor(s.elapsed)).padStart(2, '0')}s]`;
    if (s.phase === 'day') {
      for (const tag of buildTags(a)) {
        if (this.seen.has(tag.id)) continue;
        this.seen.add(tag.id);
        const who = tag.person ? `${nameOf(tag.person)}: ` : '';
        if (tag.kind === 'beat') this.lines.push(`  ${at()} ${who}${tag.text}${tag.pack ? `  (knot: ${tag.pack})` : ''}`);
        if (tag.kind === 'choice') this.lines.push(`  ${at()} ${who}${tag.text}  [${tag.choices.join(' / ')}]`);
        if (tag.kind === 'sighting') this.lines.push(`  ${at()} Sighting: ${tag.text}`);
      }
      for (const o of s.outings) {
        const key = `answer-${o.person}`;
        if (o.fork?.answer != null && !this.seen.has(key)) {
          this.seen.add(key);
          this.lines.push(`  ${at()} ${nameOf(o.person)} chose: ${o.fork.choices[o.fork.answer]}`);
        }
      }
    }
    if ((s.phase === 'evening' || s.phase === 'night') && s.evening) {
      if (this.shown === 0 && s.evening.shown > 0) this.lines.push('  By the fire:');
      while (this.shown < s.evening.shown) {
        const item = s.evening.items[this.shown++]!;
        this.lines.push(`    ${nameOf(item.person)} · ${item.title} (${item.hint}): ${item.text}`);
      }
      const key = `tomorrow-${s.day}`;
      if (s.evening.shown >= s.evening.items.length && !this.seen.has(key)) {
        this.seen.add(key);
        this.lines.push(`  Tomorrow: ${s.evening.tomorrow}`);
      }
    }
  }
}

/**
 * Every worthwhile thing to do this morning, with the best friend for it and
 * how the others compare, so a log shows whether the choices are flat.
 */
export function optionsLog(a: ExpeditionAdventure): string[] {
  const s = a.state;
  const view = a.view();
  const home = s.people.map((p) => p.id);
  const lines: string[] = [];
  let worthwhile = 0;
  for (const place of view.places) {
    if (place.region !== s.region || place.state === 'closed') continue;
    for (const activity of place.activities) {
      const forecasts = home.map((person) => ({ person, f: view.forecast({ person, place: place.id, activity, item: null, companion: null }) }));
      const order = ['certain', 'likely', 'even', 'unlikely'];
      forecasts.sort((x, y) => order.indexOf(x.f.chance) - order.indexOf(y.f.chance));
      const best = forecasts[0]!;
      const supplyRun = forecasts.some((x) => x.f.reasons.some((r) => r.text.startsWith('Usually ')));
      if (best.f.pips === 0 && !supplyRun) continue;
      if (best.f.chance !== 'unlikely' || supplyRun) worthwhile++;
      const others = forecasts.slice(1).map((x) => `${nameOf(x.person)} ${x.f.chance}`).join(', ');
      const why = best.f.reasons.map((r) => `${r.sign}${r.text}`).join('; ');
      lines.push(`    ${place.name} · ${activity}: ${nameOf(best.person)} ${best.f.chance} (${why}) | ${others}`);
    }
  }
  return [`  Day ${s.day}: ${worthwhile} worthwhile options for ${home.length} friends, ${s.provisions} provisions. ${view.goal}`, ...lines];
}

/**
 * Leads: something noticed at one place that will be worth going to another
 * for. A lead holds through the first run of days, from tomorrow on, when its
 * place is open and its own conditions hold ("while the water stays low"),
 * and then it is gone. Following one while it holds makes its find certain.
 *
 * The river and the weather are seeded, so the end of a lead is known the
 * moment it is given, and the map can say how many days it has left.
 */

import type { LeadDef } from './catalogue';
import { isOpen } from './conditions';
import { FINDS, LEADS, placeDef } from './content';
import type { AdventureState, Lead } from './state';
import { holds, todayOf } from './world';

/** How far ahead a lead looks for its days. */
const LOOKAHEAD = 12;
/** A lead whose days never come still lasts this long. */
const FALLBACK_DAYS = 4;
/** A lead that holds whenever its place is open lasts at most this long. */
const MOST_DAYS = 6;

export function leadDef(id: string): LeadDef {
  const def = LEADS.find((l) => l.id === id);
  if (!def) throw new Error(`Unknown lead ${id}`);
  return def;
}

export function makeLead(seed: number, state: AdventureState, id: string, day: number): Lead {
  const def = leadDef(id);
  return { id, place: def.to, find: def.find, line: def.line, given: day, expires: leadExpiry(seed, state, def, day) };
}

/** The last day a lead given on `day` holds. */
export function leadExpiry(seed: number, state: AdventureState, def: LeadDef, day: number): number {
  const place = placeDef(def.to);
  const good = (d: number): boolean => {
    const today = todayOf(seed, d);
    return isOpen(place, today, state) && holds(def.holds, today, state);
  };
  let first = -1;
  for (let d = day + 1; d <= day + LOOKAHEAD; d++) {
    if (good(d)) {
      first = d;
      break;
    }
  }
  if (first < 0) return day + FALLBACK_DAYS;
  let last = first;
  while (last + 1 <= first + MOST_DAYS - 1 && good(last + 1)) last++;
  return last;
}

/** Days a lead has left, counting today; zero once it has gone. */
export function daysLeft(lead: Lead, day: number): number {
  return Math.max(0, lead.expires - day + 1);
}

/** A lead's find is home, or another find has settled the same need (one sail is enough). */
export function leadSettled(state: AdventureState, find: string): boolean {
  const unless = FINDS.find((f) => f.id === find)?.unless;
  return !!state.discoveries[find] || !!unless && !!state.discoveries[unless];
}

/** Drops leads that no longer hold or whose find is already home. */
export function pruneLeads(state: AdventureState, day: number): void {
  state.leads = state.leads.filter((l) => l.expires >= day && !leadSettled(state, l.find));
}

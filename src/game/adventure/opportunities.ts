/** A few current possibilities, written into the existing notebook margins. */
import { isOpen, placeToday } from './conditions';
import { placeDef } from './content';
import { BEYOND, rumourOf } from './discovery';
import { todayOf, type World } from './world';

export function opportunities(w: World): string[] {
  const s = w.state;
  const tomorrow = todayOf(w.seed, s.day + 1);
  const options: Array<{ place: string; line: string; rank: number; about?: string }> = [];
  for (const lead of s.leads) {
    if (s.discoveries[lead.find] || placeDef(lead.place).region !== s.region) continue;
    options.push({ place: lead.place, line: lead.line, rank: lead.expires === s.day ? 10 : 6 });
  }
  for (const id of [...s.known, ...s.rumoured]) {
    const p = placeDef(id);
    if (p.region !== s.region || p.kind === 'settlement') continue;
    const open = isOpen(p, w.today, s);
    const alternative = placeToday(p, w.today, s);
    if (alternative.via) options.push({ place: id, line: `${p.name}: the high path is still dry.`, rank: 7 });
    if (!open && isOpen(p, tomorrow, s)) options.push({ place: id, line: `${p.name} should open as the water falls.`, rank: 9 });
    else if (open && p.crossing && !isOpen(p, tomorrow, s)) options.push({ place: id, line: `Cross to ${p.name} today, before the river rises.`, rank: 9 });
    else if (open && s.rumoured.includes(id)) options.push({ place: id, line: rumourOf(id), rank: 5, about: id });
    else if (open && p.activities.includes('explore') && (BEYOND[id] ?? []).some((to) => !s.known.includes(to))) {
      const next = (BEYOND[id] ?? []).find((to) => !s.known.includes(to))!;
      options.push({ place: id, line: beyondLine(p.name, next), rank: 4, about: next });
    }
    else if (open && !s.visits[id]) options.push({ place: id, line: p.teaser ?? `Nobody has walked out to ${p.name} yet.`, rank: 2 });
  }
  // One line per place, and one per unknown place ahead: two ways to the same rocks read as the same note twice.
  const chosen = new Set<string>();
  return options.sort((a, b) => b.rank - a.rank).filter((o) => {
    if (chosen.has(o.place) || (o.about && chosen.has(`about:${o.about}`))) return false;
    chosen.add(o.place);
    if (o.about) chosen.add(`about:${o.about}`);
    return true;
  }).slice(0, 3).map((o) => o.line);
}

/** A wonder rather than a map note: what is said of the next unknown place, heard from this one. */
function beyondLine(from: string, next: string): string {
  const rumour = rumourOf(next).replace(/\.$/, '').replace(/^[^:]*: /, '');
  return `Past ${from}: ${rumour.charAt(0).toLowerCase()}${rumour.slice(1)}.`;
}

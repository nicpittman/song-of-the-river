import { nameOf } from './people';
import type { AdventureState } from './state';

/** One short journal entry per finished day; no new report screen. */
export function recordDay(s: AdventureState, supper: number): void {
  if (s.history.some((entry) => entry.day === s.day)) return;
  const items = s.evening?.items ?? [];
  const lines = s.people.flatMap((person) => {
    const theirs = items.filter((i) => i.person === person.id);
    if (!theirs.length) return [];
    const food = theirs.reduce((n, i) => n + i.provisions, 0);
    const materials = theirs.reduce((n, i) => n + i.materials, 0);
    const result = [...theirs].reverse().find((i) => i.kind === 'find' || i.title.startsWith('Found:') || i.title.startsWith('Based in')) ?? theirs.find((i) => i.kind === 'nothing');
    const observation = theirs.find((i) => i.title.startsWith('At '))?.text;
    const gains = [food ? `${food} provisions` : '', materials ? `${materials} materials` : ''].filter(Boolean);
    return [`${nameOf(person.id)}: ${[observation ?? result?.title, ...gains].filter(Boolean).join(' · ') || 'back at camp'}.`];
  });
  s.history.unshift({ day: s.day, provisions: s.provisions - s.dayStart.provisions, supper,
    ...(s.dayStart.packed !== undefined ? { packed: s.dayStart.packed } : {}),
    materials: s.materials - s.dayStart.materials, lines,
    gathered: { provisions: items.reduce((n, i) => n + Math.max(0, i.provisions), 0), materials: items.reduce((n, i) => n + Math.max(0, i.materials), 0) },
    left: { provisions: s.provisions, materials: s.materials },
    standout: [...items].reverse().find((i) => i.kind === 'find')?.title ?? null, ...(s.evening ? { items: items.map((item) => ({ ...item })), tomorrow: s.evening.tomorrow,
      tomorrowPlace: s.evening.tomorrowPlace, tomorrowNote: s.evening.tomorrowNote } : {}) });
  s.history.length = Math.min(s.history.length, 120);
}

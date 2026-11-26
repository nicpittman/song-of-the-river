/** A few actual pages from this journey, never a score or a completion checklist. */
import type { AdventureView, JournalEntry } from '../../game/adventure/model';
import { WISH_FINDS } from '../../game/adventure/wishes';

export function journeyMemories(view: AdventureView): JournalEntry[] {
  const day = (entry: JournalEntry) => Number(/Day (\d+)/.exec(entry.credit ?? '')?.[1] ?? 0);
  const found = view.journal.filter((entry) => entry.found && entry.name).sort((a, b) => day(a) - day(b));
  const pages: JournalEntry[] = [];
  for (let region = 0; region <= view.region; region++) {
    const local = found.filter((entry) => entry.region === region);
    const page = local.find((entry) => ['birds', 'wildlife', 'plants', 'curiosities'].includes(entry.category)) ?? local[0];
    if (page) pages.push(page);
  }
  const mint = found.find((entry) => entry.id === 'wild-mint');
  if (mint && !pages.includes(mint)) pages.push(mint);
  // Something built for a friend, if anything was: the journey remembers it.
  const wish = found.find((entry) => WISH_FINDS.has(entry.id));
  if (wish && !pages.includes(wish)) pages.splice(Math.min(pages.length, 3), 0, wish);
  for (const page of [...found].reverse()) {
    if (pages.length >= 4) break;
    if (!pages.includes(page)) pages.push(page);
  }
  // Four pages at most; the wish page is kept over the mint.
  while (pages.length > 4) pages.splice(mint && pages.includes(mint) && mint !== wish ? pages.indexOf(mint) : pages.findIndex((page) => page !== wish), 1);
  return pages.sort((a, b) => day(a) - day(b));
}

/** One leaf of the ending's journal: a page from the journey, or one of its small collections. */
export type JourneyLeaf =
  | { kind: 'memory'; entry: JournalEntry }
  | { kind: 'collection'; name: string; sketches: string[]; names: string[]; complete: boolean; came: string };

/**
 * The journal leafed through at the end: the journey's own pages first, then
 * each small collection that holds anything at all. Nothing empty is shown.
 */
export function journeyLeaves(view: AdventureView): JourneyLeaf[] {
  const leaves: JourneyLeaf[] = journeyMemories(view).map((entry) => ({ kind: 'memory', entry }));
  const found = view.journal.filter((entry) => entry.found && entry.name);
  const sets = [...view.sets].sort((a, b) => Number(b.complete) - Number(a.complete));
  for (const set of sets) {
    const kept = found.filter((entry) => entry.set === set.name);
    if (kept.length) leaves.push({ kind: 'collection', name: set.name, sketches: kept.slice(0, 6).map((entry) => entry.sketch), names: kept.map((entry) => entry.name!), complete: set.complete, came: set.came });
  }
  return leaves;
}

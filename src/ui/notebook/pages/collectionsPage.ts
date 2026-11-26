/**
 * The journal's small collections, under their own tab. Left: every set as a
 * name and a row of its sketches, found ones drawn and the rest dotted, so a
 * set visibly fills. Right: the set in hand, larger, each entry with its name
 * (or its hint) and who found it, how far along it is in words, and in faded
 * ink what filling it may bring to the valley. A finished set stands in full
 * ink and says what came.
 */

import type { AdventureView, JournalEntry } from '../../../game/adventure/model';
import { h } from '../../dom';
import { caps, sketchEl, wordButton } from '../ink';
import { numberWord } from '../words';
import { SETS } from '../../../game/adventure/collections';

export interface CollectionsState {
  /** The player's selection survives tab changes. */
  set: string | null;
  /** Which of the page's own tabs is open: the small collections or, in Wander, the year's almanac. */
  tab?: 'sets' | 'almanac';
  /** The almanac's season in hand (0 spring to 3 winter, -1 any season); null for the season we are in. */
  season?: number | null;
}

/** The page's own tabs, in the field journal's way of choosing: words, the open one inked and underlined. */
function subTabs(view: AdventureView, state: CollectionsState, rerender: () => void, click: () => void): HTMLElement | null {
  if (!view.aims.length) return null;
  const nav = h('nav', 'nb-categories nb-subtabs', { 'aria-label': 'Collections pages' });
  for (const [tab, label] of [['sets', 'Collections'], ['almanac', 'Almanac']] as const) {
    const chosen = (state.tab ?? 'sets') === tab;
    const b = wordButton(label, () => {
      if ((state.tab ?? 'sets') === tab) return;
      state.tab = tab;
      click();
      rerender();
    }, chosen ? 'is-chosen' : '', `subtab-${tab}`);
    if (chosen) b.setAttribute('aria-current', 'page');
    nav.append(b);
  }
  return nav;
}

/** The collection catalogue defines both set order and specimen order. */
export function orderedCollections(view: AdventureView): Array<{ set: AdventureView['sets'][number]; entries: JournalEntry[] }> {
  const entries = new Map(view.journal.map(entry => [entry.id, entry]));
  return SETS.flatMap(definition => {
    const set = view.sets.find(set => set.id === definition.id);
    if (!set) return [];
    const specimens = definition.finds.map(id => entries.get(id)).filter((entry): entry is JournalEntry => !!entry);
    return specimens.length ? [{ set, entries: specimens }] : [];
  });
}

export function collectionsPages(
  view: AdventureView, state: CollectionsState, rerender: () => void, pick: () => void,
  /** The sub-tabs change the page in place, without turning to the other side. */
  click: () => void = pick,
  /** An almanac note with a known place: show it on the river map. */
  onPlace?: (place: string) => void,
): [HTMLElement, HTMLElement] {
  // In a Journey there is no almanac; the choice is kept for Wander.
  if (view.aims.length && state.tab === 'almanac') return almanacPages(view, state, rerender, pick, click, onPlace);
  const collections = orderedCollections(view);
  // Small things noticed by the way keep their own page, once there is something on it.
  const small = view.smallFinds?.found.length ? view.smallFinds : null;
  if (!collections.some(({ set }) => set.name === state.set) && !(small && state.set === SMALL_FINDS)) state.set = collections[0]?.set.name ?? (small ? SMALL_FINDS : null);

  const list = h('ul', 'nb-sets');
  for (const { set, entries } of collections) {
    const chosen = set.name === state.set;
    const b = h('button', `nb-set${chosen ? ' is-chosen' : ''}${set.complete ? ' is-complete' : ''}`, { type: 'button', 'aria-pressed': String(chosen) });
    b.dataset.k = `set-${set.id}`;
    const row = h('span', 'nb-set-row', { 'aria-hidden': 'true' }, entries.map((e) => sketchEl(e.sketch, 26, e.found)));
    b.append(h('span', 'nb-set-head', null, [h('span', 'nb-set-name', null, [set.name]), h('span', 'nb-set-count', null, [tally(set)])]), row);
    b.setAttribute('aria-label', set.complete ? `${set.name}, finished` : `${set.name}, ${tally(set)}`);
    b.addEventListener('click', () => {
      state.set = set.name;
      pick();
      rerender();
    });
    list.append(h('li', null, null, [b]));
  }
  if (small) {
    const chosen = state.set === SMALL_FINDS;
    const b = h('button', `nb-set nb-small-finds${chosen ? ' is-chosen' : ''}`, { type: 'button', 'aria-pressed': String(chosen) });
    b.dataset.k = 'set-small-finds';
    const count = small.found.length === 1 ? 'one so far' : `${numberWord(small.found.length)} so far`;
    b.append(h('span', 'nb-set-head', null, [h('span', 'nb-set-name', null, [SMALL_FINDS]), h('span', 'nb-set-count', null, [count])]),
      h('span', 'nb-set-row', { 'aria-hidden': 'true' }, small.found.slice(-6).map((f) => sketchEl(f.sketch, 26, true))));
    b.setAttribute('aria-label', `${SMALL_FINDS}, ${count}`);
    b.addEventListener('click', () => {
      state.set = SMALL_FINDS;
      pick();
      rerender();
    });
    list.append(h('li', null, null, [b]));
  }

  const left = h('div', 'nb-page-body', null, [
    subTabs(view, state, rerender, click) ?? caps('Collections'),
    h('h2', 'nb-page-title', null, ['Small collections']),
    h('p', 'nb-page-lead', null, ['A few things that belong together, for whenever you happen on them.']),
    collections.length || small ? list : h('p', 'nb-page-lead', null, ['Nothing gathered yet.']),
  ]);

  if (small && state.set === SMALL_FINDS) return [left, smallFindsPage(small)];
  const selected = collections.find(({ set }) => set.name === state.set);
  const set = selected?.set ?? null;
  const entries = selected?.entries ?? [];
  const right = h(
    'div',
    'nb-page-body',
    null,
    set
      ? [
          caps(set.complete ? 'Finished' : 'Collection'),
          h('h3', 'nb-set-title', null, [set.name]),
          h('p', 'nb-set-progress', null, [progress(set)]),
          plate(entries),
          set.complete ? h('p', 'nb-set-reward is-came', null, [set.came]) : h('p', 'nb-set-reward', null, [set.reward]),
        ]
      : [],
  );
  return [left, right];
}

/** The small finds' entry among the collections, by name. */
const SMALL_FINDS = 'Small finds';

/** The small finds' own page: what was noticed, line by line, each with its day and whose path it was by. */
function smallFindsPage(small: NonNullable<AdventureView['smallFinds']>): HTMLElement {
  const notes = h('ul', 'nb-small-notes');
  for (const f of small.found) {
    notes.append(h('li', 'nb-small-note', null, [
      sketchEl(f.sketch, 30, true),
      h('span', 'nb-small-words', null, [h('strong', null, null, [f.name]), h('span', 'nb-small-line', null, [f.line]), h('span', 'nb-specimen-credit', null, [f.credit])]),
    ]));
  }
  return h('div', 'nb-page-body', null, [
    caps('By the way'),
    h('h3', 'nb-set-title', null, [SMALL_FINDS]),
    h('p', 'nb-set-progress', null, ['Little things that caught the light, and were looked at.']),
    notes,
  ]);
}

function plate(entries: JournalEntry[]): HTMLElement {
  const grid = h('ul', 'nb-plate-grid is-set');
  // A hint is written once: the next unfound entry with the same hint says only that it is still to find.
  const hinted = new Set<string>();
  for (const e of entries) {
    const repeat = !e.found && !!e.hint && hinted.has(e.hint);
    if (!e.found && e.hint) hinted.add(e.hint);
    grid.append(
      h('li', `nb-specimen${e.found ? '' : ' is-unfound'}${e.rare ? ' is-rare' : ''}`, { 'aria-label': e.found ? e.name ?? '' : `Not yet found${e.hint ? `: ${e.hint}` : ''}` }, [
        sketchEl(e.sketch, 72, e.found),
        h('span', `nb-specimen-name${repeat ? ' is-repeat' : ''}`, null, [e.found ? e.name ?? '' : repeat || !e.hint ? 'Still to find' : e.hint]),
        e.found && e.credit ? h('span', 'nb-specimen-credit', null, [e.credit]) : null,
      ]),
    );
  }
  return grid;
}

type SetView = AdventureView['sets'][number];

const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];

/** The year's almanac by season, in the calendar's order, then the notes for any season (friends to meet). */
export function almanacSeasons(view: AdventureView): Array<{ season: number; name: string; aims: AdventureView['aims'] }> {
  const groups = [0, 1, 2, 3, -1].map(season => ({
    season,
    name: season < 0 ? 'Any season' : SEASON_NAMES[season]!,
    aims: view.aims.filter(aim => (aim.season ?? -1) === season),
  }));
  return groups.filter(group => group.aims.length);
}

/**
 * The year's almanac, as the collections are laid out. Left: each season as a
 * name, a count and a row of small marks, filled for each note seen. Right: the
 * season in hand, every note in it, ticked once seen; a note with a known place
 * shows it on the river map.
 */
function almanacPages(view: AdventureView, state: CollectionsState, rerender: () => void, pick: () => void, click: () => void, onPlace?: (place: string) => void): [HTMLElement, HTMLElement] {
  const now = view.season % 4;
  const groups = almanacSeasons(view);
  const chosenSeason = groups.some(g => g.season === state.season) ? state.season! : (groups.find(g => g.season === now) ?? groups[0])?.season ?? now;
  const seen = view.aims.filter(aim => aim.done).length;

  const list = h('ul', 'nb-sets nb-almanac-seasons');
  for (const group of groups) {
    const got = group.aims.filter(aim => aim.done).length;
    const chosen = group.season === chosenSeason;
    const complete = got === group.aims.length;
    const b = h('button', `nb-set${chosen ? ' is-chosen' : ''}${complete ? ' is-complete' : ''}`, { type: 'button', 'aria-pressed': String(chosen) });
    b.dataset.k = `season-${group.season}`;
    const dots = h('span', 'nb-count-dots nb-almanac-dots', { 'aria-hidden': 'true' }, group.aims.map(aim => h('i', aim.done ? 'is-on' : null)));
    const when = group.season === now ? ' · now' : '';
    b.append(h('span', 'nb-set-head', null, [h('span', 'nb-set-name', null, [group.name, when ? h('small', 'nb-almanac-now', null, [when]) : null]), h('span', 'nb-set-count', null, [got === 0 ? `none of ${numberWord(group.aims.length)} seen` : complete ? 'all seen' : `${numberWord(got)} of ${numberWord(group.aims.length)} seen`])]), dots);
    b.setAttribute('aria-label', `${group.name}${group.season === now ? ', this season' : ''}, ${got} of ${group.aims.length} seen`);
    b.addEventListener('click', () => {
      state.season = group.season;
      pick();
      rerender();
    });
    list.append(h('li', complete ? 'is-complete' : null, null, [b]));
  }

  const left = h('div', 'nb-page-body', null, [
    subTabs(view, state, rerender, click),
    h('h2', 'nb-page-title', null, ['This year’s almanac']),
    h('p', 'nb-page-lead', null, [`A few things to look for, season by season. ${seen ? `${seen} of ${view.aims.length}` : 'None yet'} seen; anything you find stays in the journal.`]),
    list,
  ]);

  const group = groups.find(g => g.season === chosenSeason);
  const timing = (season: number): string => season < 0 ? 'Any season' : season === now ? 'This season' : season > now ? 'Later this year' : 'Earlier this year';
  const notes = h('ul', 'nb-almanac-notes');
  for (const aim of group?.aims ?? []) {
    const place = aim.place && !aim.done ? view.places.find(p => p.id === aim.place) : undefined;
    const missed = !aim.done && aim.season !== undefined && aim.season < now;
    const line = place && onPlace
      ? wordButton(aim.line, () => onPlace(place.id), 'nb-aim-link', `aim-${place.id}`)
      : h('span', 'nb-almanac-line', null, [aim.line]);
    notes.append(h('li', aim.done ? 'is-done' : missed ? 'is-missed' : null, null, [
      line,
      h('span', 'nb-almanac-state', null, [aim.done ? 'Seen · in the journal' : missed ? 'Missed this year; it can wait for another' : place ? `Near ${place.name}` : 'Still to see']),
    ]));
  }
  const got = group?.aims.filter(aim => aim.done).length ?? 0;
  const total = group?.aims.length ?? 0;
  const right = h('div', 'nb-page-body', null, group ? [
    caps(timing(group.season)),
    h('h3', 'nb-set-title', null, [group.name]),
    h('p', 'nb-set-progress', null, [got === total ? `All ${numberWord(total)} seen.` : got === 0 ? 'Nothing seen yet.' : `${cap(numberWord(got))} seen, ${numberWord(total - got)} still to see.`]),
    notes,
    h('p', 'nb-set-reward', null, ['Anything missed can wait for another year.']),
  ] : []);
  return [left, right];
}

/** "two of four", small beside the name. */
function tally(set: SetView): string {
  return set.complete ? 'all found' : set.found === 0 ? `none of ${numberWord(set.total)}` : `${numberWord(set.found)} of ${numberWord(set.total)}`;
}

/** One natural line under the set's title. */
function progress(set: SetView): string {
  if (set.complete) return `All ${numberWord(set.total)} found.`;
  if (set.found === 0) return 'Nothing on this page yet.';
  const left = set.total - set.found;
  return left === 1 ? 'One still to find.' : `${cap(numberWord(set.found))} found, ${numberWord(left)} still to find.`;
}

const cap = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The field journal as a two-page spread. Left: how much has been noted, by
 * reach of the river, an index of categories, the entry in hand drawn large,
 * and the journey's own history (the latest finds, dated and signed). Right:
 * every entry as plates of sketches by category, found ones drawn and signed,
 * unfound ones dotted with a hint, so the pages visibly fill as the days go.
 */

import type { AdventureView, JournalCategory, JournalEntry, UnpackItem } from '../../../game/adventure/model';
import { h } from '../../dom';
import { caps, sketchEl, stampButton, wordButton } from '../ink';
import { CATEGORY_ORDER, CATEGORY_WORDS } from '../words';
import { dayReport, eveningLeft, eveningRight } from '../evening';
import { placeFor } from '../overnight';
import { OPENING } from '../../../game/adventure/narrative';
import { FREE_OPENING } from '../../../game/adventure/places/freeplay';

export interface JournalState {
  category: JournalCategory | null;
  entry: string | null;
  day?: number | null;
  fieldOpen?: boolean;
  browsingField?: boolean;
}

/** Tonight's return, written at the head of the journal when the book opens after the fire. */
export interface Tonight {
  items: UnpackItem[];
  tomorrow: string;
  sleep(): void;
  plan?(place: string): void;
}

export function journalPages(
  view: AdventureView,
  state: JournalState,
  rerender: () => void,
  click: () => void,
  tonight: Tonight | null = null,
  planPlace?: (place: string) => void,
): [HTMLElement, HTMLElement] {
  // Tonight and saved days share the same illustrated spread. The field guide is an explicit side trip.
  const saved = view.history.find((day) => day.day === state.day) ?? view.history[0];
  const live = tonight && (state.day == null || state.day === view.history[0]?.day) ? tonight : null;
  if (!state.browsingField && (live || saved?.items)) {
    const day = live ? view.day : saved!.day;
    const report = live ?? { day, items: saved!.items!, tomorrow: saved!.tomorrow ?? '',
      tomorrowNote: saved!.tomorrowNote, tomorrowPlace: saved!.tomorrowPlace,
      ...(saved === view.history[0] && view.phase === 'morning' && planPlace ? { plan: planPlace } : {}) };
    const left = eveningLeft(view, report, dayHeader(view, state, rerender));
    const right = eveningRight(view, report.items, day, id => {
      state.browsingField = true; state.fieldOpen = true; state.entry = id;
      state.category = view.journal.find(entry => entry.id === id)?.category ?? null;
      click(); rerender();
    });
    right.append(h('footer', 'nb-eve-sketch-foot', null, [wordButton('Field journal →', () => {
      state.browsingField = true; state.fieldOpen = true; click(); rerender();
    }, 'nb-quiet', 'browse-field')]));
    return [left, right];
  }
  const reached = view.journal;
  const categories = CATEGORY_ORDER.filter((c) => reached.some((e) => e.category === c));
  if (!state.category || !categories.includes(state.category)) state.category = categories[0] ?? null;
  if (!state.entry || !reached.some((e) => e.id === state.entry)) {
    const first = reached.filter((e) => e.category === state.category);
    state.entry = (first.find((e) => e.found) ?? first[0])?.id ?? null;
  }
  const entry = reached.find((e) => e.id === state.entry) ?? null;

  // Selecting a plate changes the specimen, never the saved daily account or its DOM.
  const selectEntry = (): void => {
    const selected = reached.find((e) => e.id === state.entry);
    const detail = selected ? entryDetail(selected) : null;
    if (detail) field.querySelector('.nb-entry')?.replaceWith(detail);
    field.open = state.fieldOpen ?? field.open;
    // Chosen from far down the list, the entry is brought to where it can be read, without hunting for it.
    if (detail?.isConnected && field.open) {
      let scroller = detail.parentElement;
      while (scroller && scroller !== document.body && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
      const view = scroller && scroller !== document.body ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
      const box = detail.getBoundingClientRect();
      if (box.top < view.top || box.bottom > view.bottom) detail.scrollIntoView({ block: box.height > view.bottom - view.top ? 'start' : 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    field.querySelectorAll<HTMLButtonElement>('.nb-categories button').forEach((button) => {
      const chosen = button.dataset.k === `cat-${state.category}`;
      button.classList.toggle('is-chosen', chosen);
      if (chosen) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
    right.querySelectorAll<HTMLButtonElement>('.nb-specimen').forEach((button) => {
      const chosen = button.dataset.k === `entry-${state.entry}`;
      button.classList.toggle('is-chosen', chosen);
      button.setAttribute('aria-pressed', String(chosen));
    });
  };

  const found = reached.filter((e) => e.found).length;
  const field = h('details', 'nb-field-guide');
  field.open = state.fieldOpen ?? !view.history.length;
  const fieldToggle = h('summary', null, null, [`Field journal · ${found} of ${reached.length} noticed`]);
  fieldToggle.dataset.k = 'field-guide';
  field.append(fieldToggle,
    h('h2', 'nb-page-title', null, ['Things we have noticed']),
    regionCounts(view, reached),
    categoryIndex(categories, reached, state, selectEntry, click),
    entry ? entryDetail(entry) : h('p', 'nb-page-lead', null, ['Nothing noted yet.']),
  );
  const recent = lately(reached);
  if (recent) field.append(recent);
  field.addEventListener('toggle', () => { if (field.isConnected) state.fieldOpen = field.open; });
  const first = view.notes.find((note) => note.text === OPENING || note.text === FREE_OPENING)?.text;
  const opening = !tonight && first && (!view.history.length || (state.day ?? view.history[0]?.day) === 1)
    ? h('p', 'nb-opening-story', null, [first]) : null;
  const report = h('div', tonight ? 'nb-evening-scroll' : null, null, [
    state.browsingField ? null : opening,
    state.browsingField ? null : daySummary(view, state, rerender, view.phase === 'evening' && !tonight?.plan ? undefined : planPlace), field,
  ]);
  const left = h('div', `nb-page-body${state.browsingField ? ' is-field-page' : tonight ? ' is-evening-journal' : ''}`, null, [
    state.browsingField ? h('header', 'nb-field-back', null, [wordButton('← Daily journal', () => { state.browsingField = false; click(); rerender(); }, 'nb-quiet', 'back-to-days')]) : null,
    report,
    tonight ? h('footer', 'nb-tonight-go', null, [readyStamp('Next morning · E', tonight.sleep, 'tonight-sleep')]) : null,
  ]);

  const right = h(
    'div',
    'nb-page-body',
    null,
    categories.map((c) =>
      plate(
        c,
        reached.filter((e) => e.category === c),
        state,
        selectEntry,
        click,
      ),
    ),
  );
  return [left, right];
}

/** "Day 3 · Evening", with arrows to each earlier day's saved account. */
function dayHeader(view: AdventureView, state: JournalState, rerender: () => void): HTMLElement | null {
  if (!view.history.length) return null;
  const entry = view.history.find((d) => d.day === state.day) ?? view.history[0]!;
  const at = view.history.indexOf(entry);
  const older = wordButton('←', () => {
    if (at + 1 < view.history.length) { state.day = view.history[at + 1]!.day; rerender(); }
  }, 'nb-day-arrow', 'day-older');
  const newer = wordButton('→', () => {
    if (at > 0) { state.day = at === 1 ? null : view.history[at - 1]!.day; rerender(); }
  }, 'nb-day-arrow', 'day-newer');
  older.setAttribute('aria-label', 'Previous day'); newer.setAttribute('aria-label', 'Next day');
  older.disabled = at + 1 >= view.history.length; newer.disabled = at === 0;
  return h('header', 'nb-eve-head', null, [caps(`Day ${entry.day} · Evening`), h('nav', 'nb-day-index', { 'aria-label': 'Journal days' }, [older, newer])]);
}

/** Latest by default; arrows open each earlier day's saved illustrated account. */
function daySummary(view: AdventureView, state: JournalState, rerender: () => void, planPlace?: (place: string) => void): HTMLElement | null {
  if (!view.history.length) return null;
  const entry = view.history.find((d) => d.day === state.day) ?? view.history[0]!;
  const at = view.history.indexOf(entry);
  const older = wordButton('←', () => {
    if (at + 1 < view.history.length) { state.day = view.history[at + 1]!.day; rerender(); }
  }, 'nb-day-arrow', 'day-older');
  const newer = wordButton('→', () => {
    if (at > 0) { state.day = at === 1 ? null : view.history[at - 1]!.day; rerender(); }
  }, 'nb-day-arrow', 'day-newer');
  older.setAttribute('aria-label', 'Previous day'); newer.setAttribute('aria-label', 'Next day');
  older.disabled = at + 1 >= view.history.length; newer.disabled = at === 0;
  const choose = h('nav', 'nb-day-index', { 'aria-label': 'Journal days' }, [older, newer]);
  const signed = (n: number): string => n > 0 ? `+${n}` : String(n);
  const next = entry.tomorrow ? placeFor(view, entry.tomorrow) : null;
  return h('section', 'nb-day-summary', { 'aria-label': `Day ${entry.day} summary` }, [
    h('header', null, null, [caps(`Day ${entry.day} · Evening`), choose]),
    h('p', 'nb-day-balance', null, [`${signed(entry.provisions)} ${Math.abs(entry.provisions) === 1 ? 'provision' : 'provisions'} · ${signed(entry.materials)} ${Math.abs(entry.materials) === 1 ? 'material' : 'materials'}`]),
    entry.items ? dayReport(view, entry) : h('ul', null, null, entry.lines.map((line) => h('li', null, null, [line]))),
    !entry.items && entry.standout ? h('p', 'nb-day-standout', null, [entry.standout]) : null,
    entry.tomorrow ? h('p', 'nb-report-tomorrow', null, [entry.tomorrow]) : null,
    at === 0 && next && planPlace && (view.phase === 'morning' || view.phase === 'evening') ? wordButton(`Consider ${next.name} →`, () => planPlace(next.id), 'nb-report-plan', 'report-plan') : null,
  ]);
}

/** One line per reach: its name, a row of small dots (filled for each find), and the count. */
function regionCounts(view: AdventureView, reached: JournalEntry[]): HTMLElement {
  const list = h('ul', 'nb-region-counts');
  for (let i = 0; i < view.chart.regions.length; i++) {
    const entries = reached.filter((e) => e.region === i);
    const got = entries.filter((e) => e.found).length;
    const dots = h('span', 'nb-count-dots', { 'aria-hidden': 'true' });
    for (const e of entries) dots.append(h('i', e.found ? (e.rare ? 'is-on is-rare' : 'is-on') : null));
    list.append(
      h('li', null, null, [
        h('span', 'nb-count-name', null, [view.chart.regions[i].name]),
        dots,
        h('span', 'nb-count-n', null, [`${got} of ${entries.length}`]),
      ]),
    );
  }
  return list;
}

function categoryIndex(
  categories: JournalCategory[],
  reached: JournalEntry[],
  state: JournalState,
  rerender: () => void,
  click: () => void,
): HTMLElement {
  const nav = h('nav', 'nb-categories', { 'aria-label': 'Categories' });
  for (const c of categories) {
    const entries = reached.filter((e) => e.category === c);
    const got = entries.filter((e) => e.found).length;
    const b = wordButton(
      CATEGORY_WORDS[c],
      () => {
        state.category = c;
        state.entry = (entries.find((e) => e.found) ?? entries[0])?.id ?? null;
        click();
        rerender();
        // The plates are all on the facing page: bring this one into view.
        document.getElementById(`nb-plate-${c}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      },
      c === state.category ? 'is-chosen' : '',
      `cat-${c}`,
    );
    b.append(h('span', 'nb-cat-count', null, [`${got}/${entries.length}`]));
    if (c === state.category) b.setAttribute('aria-current', 'true');
    nav.append(b);
  }
  return nav;
}

function entryDetail(entry: JournalEntry): HTMLElement {
  return h('article', `nb-entry${entry.found ? '' : ' is-unfound'}`, { 'aria-live': 'polite' }, [
    sketchEl(entry.sketch, 104, entry.found, 'nb-entry-sketch'),
    h('div', 'nb-entry-words', null, [
      h('h3', 'nb-entry-name', null, [entry.found ? (entry.name ?? '') : 'Not yet found']),
      entry.found && entry.text ? h('p', 'nb-entry-text', null, [entry.text]) : null,
      entry.conversation?.length ? h('details', 'nb-entry-conversation', null, [h('summary', null, null, ['Our conversation']), ...entry.conversation.map((line) => h('p', null, null, [h('strong', null, null, [`${line.speaker}: `]), line.text]))]) : null,
      !entry.found && entry.hint ? h('p', 'nb-entry-text', null, [entry.hint]) : null,
      entry.rare ? caps('Rare', 'nb-entry-rare') : null,
      entry.credit ? caps(entry.credit, 'nb-entry-credit') : null,
    ]),
  ]);
}

/** One plate: every entry of a category, found first in the order of the river, then the unfound. */
function plate(category: JournalCategory, entries: JournalEntry[], state: JournalState, rerender: () => void, click: () => void): HTMLElement {
  const got = entries.filter((e) => e.found).length;
  const wrap = h('section', 'nb-plate', { id: `nb-plate-${category}`, 'aria-label': CATEGORY_WORDS[category] });
  wrap.append(
    h('h4', 'nb-plate-head', null, [
      h('span', 'nb-plate-name', null, [CATEGORY_WORDS[category]]),
      h('span', 'nb-plate-count', null, [`${got} of ${entries.length}`]),
    ]),
  );
  const ordered = [...entries].sort((a, b) => Number(b.found) - Number(a.found) || a.region - b.region);
  const grid = h('ul', 'nb-plate-grid');
  for (const e of ordered) {
    const chosen = e.id === state.entry;
    const b = h('button', `nb-specimen${e.found ? '' : ' is-unfound'}${chosen ? ' is-chosen' : ''}${e.rare ? ' is-rare' : ''}`, {
      type: 'button',
      'aria-label': e.found ? `${e.name}${e.rare ? ', rare' : ''}` : `Not yet found${e.hint ? `: ${e.hint}` : ''}`,
      'aria-pressed': String(chosen),
    });
    b.dataset.k = `entry-${e.id}`;
    const credit = e.found && e.credit ? h('span', 'nb-specimen-credit', null, [e.credit]) : null;
    b.append(sketchEl(e.sketch, 58, e.found), h('span', 'nb-specimen-name', null, [e.found ? (e.name ?? '') : (e.hint ?? '?')]), credit ?? '');
    b.addEventListener('click', () => {
      state.fieldOpen = true;
      state.entry = e.id;
      state.category = category;
      click();
      rerender();
    });
    grid.append(h('li', null, null, [b]));
  }
  wrap.append(grid);
  return wrap;
}

/** The journey's own history: the most recent finds, with the day and who found them, newest first. */
function lately(entries: JournalEntry[]): HTMLElement | null {
  const dated = entries
    .filter((e) => e.found && e.credit)
    .map((e) => ({ e, day: Number(/Day (\d+)/.exec(e.credit ?? '')?.[1] ?? 0) }))
    // Only what was found on a day: friends credited as "Travelling with us" are not news.
    .filter(({ day }) => day > 0)
    .sort((a, b) => b.day - a.day)
    .slice(0, 5);
  if (!dated.length) return null;
  const list = h('ul', 'nb-lately', { 'aria-label': 'Recently in the journal' });
  for (const { e } of dated) {
    const [day, who] = (e.credit ?? '').split(' · ');
    // "Ren · sketched by Sora, day 3": the find first, then who and when, in words.
    const when = (day ?? '').replace(/^Day/, 'day');
    list.append(h('li', null, null, [h('span', null, null, [e.name ?? '']), h('small', 'nb-lately-credit', null, [who ? ` · sketched by ${who}, ${when}` : ` · ${when}`])]));
  }
  return h('section', 'nb-lately-wrap', null, [caps('Recently in the journal'), list]);
}

/** The page's one action, already the plain next step. */
function readyStamp(label: string, onClick: () => void, key: string): HTMLButtonElement {
  const b = stampButton(label, onClick, key);
  b.classList.add('is-ready');
  return b;
}

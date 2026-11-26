/** A saved day's illustrated returns, shared by tonight and older Journal pages. */
import { PEOPLE } from '../../game/adventure/people';
import { WISH_FINDS } from '../../game/adventure/wishes';
import { GOT_AWAY, SKETCHED } from '../../game/adventure/evening';
import type { AdventureView, DaySummary, FriendView, JournalEntry, UnpackItem } from '../../game/adventure/model';
import { h } from '../dom';
import { caps, friendToken, sketchEl, stampButton, wordButton } from './ink';
import { leadMark, resourceMark } from '../sketches';
import { placeFor } from './overnight';
import { listNames } from './words';
import { isQuiet, shortLine } from '../../game/rendering/adventure/fireside';
import { scrollCue } from './scrollCue';
import '../../styles/day-end.css';

const COLLECTION_WORDS: Record<string,string> = {
  'river-birds':'A kingfisher has settled by the mill.',
  'mountain-water':'A dipper returns to the mountain stream.',
  woods:'Deer begin to use the woodland clearing.',
  'before-us':'A traveller stops at the shrine on the knoll to hang up a wish.',
  'orchard-year':'White-eyes linger among the orchard branches.',
  'willow-water':'An egret returns to the willows.',
  'far-bank':'Someone comes over the bridge to help with the east farm’s fields.',
  'rock-pools':'Oystercatchers keep to the rocks at Iso now, piping at the tide.',
  shells:'Sanderlings gather along the sand.',
  'sea-gifts':'Someone keeps watch over the strand.',
};
export function collectionsCompletedOn(view: AdventureView, day: number) {
  return view.sets.filter(set=>set.complete && Math.max(0,...view.journal.filter(entry=>entry.set===set.name && entry.found).map(entry=>Number(/Day (\d+)/.exec(entry.credit ?? '')?.[1] ?? 0)))===day);
}

/** The player's own part of the day: what they sketched with a tap, and what got away. */
export const isCatch = (item: UnpackItem): boolean => item.title.startsWith(SKETCHED) || item.title === GOT_AWAY;

/** "You sketched", first on the page: the catches as small ink sketches, then the one that got away. */
function catchStrip(items: UnpackItem[]): HTMLElement | null {
  const sketched = items.filter((item) => item.title.startsWith(SKETCHED) && item.sketch);
  const away = items.find((item) => item.title === GOT_AWAY);
  if (!sketched.length && !away) return null;
  return h('section', 'nb-eve-catch', { 'aria-label': 'You sketched' }, [
    sketched.length ? caps('You sketched', 'nb-eve-person-kicker') : null,
    sketched.length ? h('ul', 'nb-eve-catch-list', null, sketched.map((item) => h('li', item.hint === 'rare' ? 'is-rare' : null, { title: item.text }, [
      sketchEl(item.sketch!, 30, true), h('span', null, null, [item.title.slice(SKETCHED.length)]),
    ]))) : null,
    // Under its own small heading, so it never reads as one more find (a found kingfisher's words may also say "gone").
    away ? h('p', 'nb-eve-away', null, [caps(GOT_AWAY, 'nb-eve-away-kicker'), ' ', away.text]) : null,
  ]);
}

/** Prefer the consequence of a plan over another ordinary resource bundle. */
export function standoutOf(items: UnpackItem[]): { item: UnpackItem; label: string } | null {
  const ranked = items.filter((item) => !isCatch(item)).map((item) => {
    if (item.title.startsWith('Arrived in ')) return { item, label: 'A new reach', rank: 7 };
    if (item.title.startsWith('Met ')) return { item, label: 'Someone new', rank: 6 };
    if (item.sketch?.startsWith('friend-')) return { item, label: 'Joining us', rank: 6 };
    if (item.title.startsWith('Found:')) return { item, label: 'New ground', rank: 5 };
    if (item.kind === 'find' && item.sketch && WISH_FINDS.has(item.sketch)) return { item, label: 'A wish granted', rank: 5 };
    if (item.text === 'Finished today.') return { item, label: 'A lasting change', rank: 4 };
    if (item.title.startsWith('Based in')) return { item, label: 'A new home', rank: 4 };
    if (item.kind === 'find') return { item, label: 'A discovery', rank: item.hint === 'rare' ? 4 : 3 };
    if (item.kind === 'lead') return { item, label: 'A clue for tomorrow', rank: 2 };
    return { item, label: '', rank: 0 };
  }).filter((entry) => entry.rank > 0).sort((a, b) => b.rank - a.rank);
  return ranked[0] ?? null;
}

/** Keep a discovery's explanation with its headline, rather than replacing it with a catch quote. */
export function returnStory(items: UnpackItem[]): { outcome: UnpackItem; text: string } | null {
  if (!items.length) return null;
  const meaningful = standoutOf(items)?.item;
  const outcome = meaningful ?? items.find((item) => item.kind === 'nothing') ?? items[0];
  const voice = items.find((item) => item.kind === 'supplies' && item.text.startsWith('“'));
  const field = items.find((item) => item.title.startsWith('At '));
  return { outcome, text: meaningful ? outcome.text : voice?.text ?? field?.text ?? outcome.text };
}

export function dayReport(view: AdventureView, entry: DaySummary): HTMLElement {
  const results = h('div', 'nb-day-report');
  const standout = standoutOf(entry.items ?? []);
  // Chapter arrivals have no individual discoverer; ordinary finds belong with their person.
  if (standout?.item.title.startsWith('Arrived in ')) results.append(h('aside', 'nb-day-end-find', null, [h('div', null, null, [caps(standout.label), h('h3', null, null, [standout.item.title]), h('p', null, null, [standout.item.text])])]));
  const rows = h('ul', 'nb-day-end-people');
  for (const person of view.friends) {
    const items = (entry.items ?? []).filter((item) => item.person === person.id);
    if (!items.length || items.every((item) => item.title === 'Tending camp' && !item.provisions && !item.materials)) continue;
    const food = items.reduce((n, item) => n + item.provisions, 0), materials = items.reduce((n, item) => n + item.materials, 0);
    const { outcome, text } = returnStory(items)!;
    const highlight = standout && !standout.item.title.startsWith('Arrived in ') && items.some((item) => item.id === standout.item.id);
    // The label names the line under it, never the person above it.
    const words = h('div', 'nb-day-end-words', null, [h('strong', null, null, [person.name]), highlight && outcome?.id === standout!.item.id ? caps(standout!.label) : null, h('span', null, null, [outcome?.title ?? 'Back at camp'])]);
    if (text && outcome?.title !== 'Tending camp') words.append(h('p', null, null, [text]));
    const finds = items.filter((item, index, all) => item.kind === 'find' && item.sketch && all.findIndex((other) => other.kind === 'find' && other.sketch === item.sketch) === index);
    if (finds.length) words.append(h('ul', 'nb-person-finds', { 'aria-label': `${person.name}’s discoveries` }, finds.map((find) => h('li', null, { title: find.text }, [sketchEl(find.sketch!, 40), find.title === outcome.title ? null : h('span', null, null, [find.title, find.hint === 'story' && find.text ? h('small', 'nb-person-find-line', null, [find.text]) : null])]))));
    const gains = h('span', 'nb-day-end-gains');
    if (food) gains.innerHTML += `${resourceMark('provisions', 18)}+${food}`;
    if (materials) gains.innerHTML += `${resourceMark('materials', 18)}+${materials}`;
    rows.append(h('li', highlight ? 'is-standout' : null, null, [friendToken(person, 32), words, gains]));
  }
  results.append(rows);
  return results;
}

// ── Tonight's page ──────────────────────────────────────────────────────────

const HINT_RANK: Record<string, number> = { plain: 0, unusual: 1, rare: 2, story: 3 };

/**
 * The evening's headline: the story if there is one (the last, as the fire
 * told it), else the rarest thing brought home. A day of plain supplies has
 * no headline.
 */
export function headlineOf(items: UnpackItem[]): UnpackItem | null {
  let best: UnpackItem | null = null;
  let score = -1;
  for (const item of items) {
    const value = (HINT_RANK[item.hint] ?? 0) * 10 + (item.kind === 'find' ? 2 : item.kind === 'lead' ? 1 : 0);
    if (value >= score) { best = item; score = value; }
  }
  if (!best || (best.hint === 'plain' && best.kind !== 'find')) return null;
  return best;
}

/** Who the headline is about: someone met or joining (named in it), else whoever brought it. */
function subjectOf(view: AdventureView, item: UnpackItem): Pick<FriendView, 'id' | 'name' | 'colour' | 'pack'> | null {
  const resident = PEOPLE.find(p => item.sketch === `${p.id}-meeting` || item.sketch === `friend-${p.id}`);
  if (resident && !view.friends.some(f => f.id === resident.id)) return { ...resident, pack: null };
  const named = view.friends.find((f) => f.id !== item.person && (item.title.includes(f.name) || item.sketch === `${f.id}-meeting` || item.sketch === `friend-${f.id}`));
  return named ?? view.friends.find((f) => f.id === item.person) ?? null;
}

function labelOf(item: UnpackItem): string {
  if (item.hint === 'story') return standoutOf([item])?.label || 'Tonight';
  if (item.kind === 'lead') return 'A lead';
  if (item.hint === 'rare') return 'A rare find';
  if (item.hint === 'unusual') return 'Something unusual';
  return 'Today';
}

export interface TonightPage {
  day?: number;
  items: UnpackItem[];
  tomorrow: string;
  tomorrowPlace?: string;
  tomorrowNote?: string;
  sleep?(): void;
  plan?(place: string): void;
}

/**
 * Tonight's left page: the headline as one card (portrait, words, outcome),
 * the other finds as a short list, the tally small; then, held at the foot of
 * the page on every screen, the lead, its small note, and Next morning.
 */
export function eveningLeft(view: AdventureView, tonight: TonightPage, header: HTMLElement | null): HTMLElement {
  const items = tonight.items.filter(item => item.kind !== 'lead' || item.text.trim() !== tonight.tomorrow.trim());
  const headline = headlineOf(items);
  // Bundles with nothing of their own to say (no words, or the lead's words again) stay off the page.
  const scroll = h('div', 'nb-evening-scroll nb-eve', null, [headline?.title.startsWith('Arrived in ') ? headlineCard(view, headline) : null]);
  const people = h('div', 'nb-eve-travellers');
  for (const person of view.friends) {
    const own = items.filter((item) => item.person === person.id && !item.title.startsWith('Arrived in ') && !isCatch(item) && !isQuiet(item, items, tonight.tomorrow));
    if (!own.length) continue;
    const place = own.find((item) => item.title.startsWith('At '));
    const food = own.reduce((sum, item) => sum + item.provisions, 0), wood = own.reduce((sum, item) => sum + item.materials, 0);
    const gains = h('span', 'nb-eve-person-gains');
    const gainMark=(kind:'provisions'|'materials',amount:number) => { const mark=h('span','nb-eve-resource',{'aria-hidden':'true'}); mark.innerHTML=resourceMark(kind,20); gains.append(mark,` +${amount} `); };
    if (food) gainMark('provisions',food);
    if (wood) gainMark('materials',wood);
    const standout=standoutOf(items)?.item;
    const featured=standout && own.includes(standout) && !standout.title.startsWith('Arrived in ') ? standout : null;
    const section = h('section', `nb-eve-traveller${featured?' is-standout':''}`, { 'aria-label': `${person.name}’s day` }, [
      h('header', 'nb-eve-person-head', null, [friendToken(person, 36), h('div', null, null, [h('strong', null, null, [person.name]), place ? h('span', null, null, [place.title]) : null]), gains]),
    ]);
    // On a phone each row is kept short; a tap opens it in full (see phone.css).
    section.addEventListener('click', () => section.classList.toggle('is-open'));
    // The day's story beat comes first in its row, its label right above its own title, so a phone sees it without scrolling.
    if (featured) section.append(h('div', 'nb-eve-standout', null, [
      caps(labelOf(featured), 'nb-eve-person-kicker'),
      h('h3', 'nb-eve-standout-title', null, [featured.title]),
      featured.text ? h('p', 'nb-eve-person-story', null, [featured.text]) : null,
      featured.outcome ? h('p', 'nb-eve-standout-outcome', null, [featured.outcome]) : null,
      workCredit(view, featured),
    ]));
    const events = own.filter((item) => item !== place && item !== featured && item.kind !== 'supplies' && item.kind !== 'materials');
    if (events.length) section.append(h('ul', 'nb-eve-finds', null, events.map((item) => findRow(view, item))));
    if (!featured && place?.text) section.append(h('p','nb-eve-person-story',null,[place.text]));
    const voice = own.find((item) => item.kind === 'supplies' && item.text.startsWith('“'));
    if (voice) section.append(h('p', 'nb-eve-person-voice', null, [voice.text]));
    if (featured) people.prepend(section); else people.append(section);
  }
  const caught = catchStrip(items);
  if (caught) scroll.append(caught);
  scroll.append(people);
  for (const set of collectionsCompletedOn(view,tonight.day ?? view.day)) {
    const art=view.journal.filter(entry=>entry.set===set.name && entry.found);
    scroll.append(h('section','nb-collection-finished',{'aria-label':`${set.name} completed`},[
      caps('A small collection, complete'),
      h('h3',null,null,[set.name]),
      h('div','nb-collection-sketches',null,art.map(entry=>sketchEl(entry.id,34))),
      h('p',null,null,[COLLECTION_WORDS[set.id] ?? 'A page filled in.']),
    ]));
  }
  if (!tonight.items.length) scroll.append(h('p', 'nb-eve-quiet', null, ['A quiet day. Everyone is home.']));
  const stores = storesSection(view.history.find(entry => entry.day === (tonight.day ?? view.day)));
  if (stores) scroll.append(stores);

  const evening = view.evening;
  const current = tonight.day === undefined || tonight.day === view.day;
  const placeId = tonight.tomorrowPlace ?? (current ? evening?.tomorrowPlace : undefined);
  const place = placeId ? view.places.find((p) => p.id === placeId) ?? null : tonight.tomorrow ? placeFor(view, tonight.tomorrow) : null;
  const building = place?.id === 'mio' && !view.departure?.prepared && view.journal.some(e => e.id === 'aki-meeting' && e.found);
  const consider = place && tonight.plan ? wordButton(building ? 'Consider building →' : `Consider ${place.name} →`, () => tonight.plan!(place.id), 'nb-report-plan nb-eve-consider', 'report-plan') : null;
  const sleep = tonight.sleep ? stampButton('Next morning · E', tonight.sleep, 'tonight-sleep') : null;
  sleep?.classList.add('is-ready');
  const note = tonight.tomorrowNote ?? (current ? evening?.tomorrowNote : undefined);
  const foot = h('footer', 'nb-tonight-go nb-eve-go', null, [
    tonight.tomorrow ? h('p', 'nb-eve-lead', null, [tonight.tomorrow]) : null,
    note ? h('p', 'nb-eve-note', null, [note]) : null,
    current && evening?.tomorrowSign && !note ? h('p', 'nb-eve-sign', null, [caps('By morning'), ' ', evening.tomorrowSign]) : null,
    consider || sleep ? h('div', 'nb-eve-actions', null, [consider, sleep]) : null,
  ]);
  scrollCue(scroll);
  return h('div', 'nb-page-body is-evening-journal is-evening-page', null, [header ?? h('header','nb-eve-head'), scroll, foot]);
}

function headlineCard(view: AdventureView, item: UnpackItem): HTMLElement {
  const who = subjectOf(view, item);
  const portrait = who ? friendToken(who, 56, 'nb-eve-portrait') : item.sketch ? sketchEl(item.sketch, 56, true, 'nb-eve-portrait') : null;
  const by = view.friends.find((f) => f.id === item.person);
  const credit = by && by.id !== who?.id ? caps(`${by.name}`, 'nb-eve-by') : null;
  return h('article', `nb-eve-headline is-${item.hint}`, null, [
    portrait,
    h('div', 'nb-eve-words', null, [
      h('p', 'nb-eve-kicker', null, [caps(labelOf(item)), credit]),
      h('h3', 'nb-eve-title', null, [item.title]),
    ]),
    item.text ? h('p', 'nb-eve-quote', null, [item.text]) : null,
    item.outcome ? h('p', 'nb-eve-outcome', null, [item.outcome]) : null,
  ]);
}

function findRow(view: AdventureView, item: UnpackItem): HTMLElement {
  const by = view.friends.find((f) => f.id === item.person);
  let mark: HTMLElement | null;
  if (item.kind === 'find' && item.sketch) mark = sketchEl(item.sketch, 30, true, 'nb-tonight-sketch');
  else if (item.kind === 'lead') { mark = h('span', 'nb-eve-lead-mark', { 'aria-hidden': 'true' }); mark.innerHTML = leadMark(18); }
  else if (item.kind === 'supplies' || item.kind === 'materials') mark = h('span','nb-eve-resource',{'aria-hidden':'true'});
  else if (item.sketch?.startsWith('place-')) mark = sketchEl(item.sketch, 30);
  else mark = by ? friendToken(by, 24) : null;
  if (mark && (item.kind === 'supplies' || item.kind === 'materials')) mark.innerHTML = resourceMark(item.materials && !item.provisions ? 'materials' : 'provisions',20);
  // A secondary find keeps its words too: a story beat in full (the miller's tea map), anything else its first line.
  const detail = item.kind === 'lead' ? item.text
    : item.kind === 'find' && item.hint === 'story' ? [item.text, item.outcome].filter(Boolean).join(' ') || null
    // Something said aloud keeps its whole quotation rather than stopping before the closing mark.
    : (item.kind === 'nothing' || item.kind === 'find') && item.text.trim().startsWith('“') && item.text.length <= 170 ? item.text.trim()
    : item.kind === 'nothing' || item.kind === 'find' ? shortLine(item, 110) : null;
  const row = h('li', `nb-eve-find is-${item.kind} is-${item.hint}${item.kind === 'find' && item.sketch ? ' nb-tonight-find' : ''}${item.hint === 'rare' ? ' is-rare' : ''}`, { title: item.text }, [
    h('span', 'nb-eve-mark', null, [mark]),
    h('span', 'nb-eve-find-title', null, [item.title, detail ? h('small', 'nb-eve-find-line', null, [detail]) : null, workCredit(view, item)]),
    null,
  ]);
  row.dataset.item = item.id;
  return row;
}

function workCredit(view: AdventureView, item: UnpackItem): HTMLElement | null {
  if (!item.contributors || item.contributors.length < 2) return null;
  const names = item.contributors.map(id => view.friends.find(person => person.id === id)?.name).filter((name): name is string => !!name);
  return h('small', 'nb-eve-work-credit', null, [`${item.text === 'Finished today.' ? 'Built together' : 'Worked on'} by ${listNames(names)}.`]);
}

/** The day's gains are already listed beside each person. Explain what was spent. */
/** One line of the stores ledger: what came in, what went out, and what is left. */
export interface StoresLine { kind: 'provisions' | 'materials'; moves: string[]; left: number }

/**
 * The day's stores, as a short ledger at the foot of the page. Provisions:
 * gathered, packed for the road, supper, and what is left. Materials:
 * gathered, used on building, and what is left.
 */
export function storesLedger(entry: DaySummary | undefined): StoresLine[] {
  if (!entry?.left) return [];
  const gathered = entry.gathered ?? { provisions: 0, materials: 0 };
  const food: string[] = [];
  if (gathered.provisions) food.push(`gathered ${gathered.provisions}`);
  if (entry.packed) food.push(`packed ${entry.packed} for the road`);
  if (entry.supper) food.push(`supper ${entry.supper}`);
  const wood: string[] = [];
  const used = gathered.materials - entry.materials;
  if (gathered.materials || used < 0) wood.push(`gathered ${Math.max(gathered.materials, entry.materials)}`);
  if (used > 0) wood.push(`used ${used}`);
  return [
    { kind: 'provisions', moves: food, left: entry.left.provisions },
    { kind: 'materials', moves: wood, left: entry.left.materials },
  ];
}

function storesSection(entry: DaySummary | undefined): HTMLElement | null {
  const lines = storesLedger(entry);
  if (!lines.length) return null;
  return h('section', 'nb-eve-stores', { 'aria-label': 'The stores tonight' }, [
    caps('The stores tonight', 'nb-eve-stores-head'),
    ...lines.map((line) => {
      const mark = h('span', 'nb-eve-resource', { 'aria-hidden': 'true' });
      mark.innerHTML = resourceMark(line.kind, 20);
      return h('p', 'nb-eve-stores-line', null, [
        mark,
        h('span', 'nb-eve-stores-what', null, [line.kind === 'provisions' ? 'Provisions' : 'Materials', line.moves.length ? h('small', null, null, [line.moves.join(' · ')]) : null]),
        h('span', 'nb-eve-stores-left', null, [String(line.left), h('small', null, null, [' left'])]),
      ]);
    }),
  ]);
}

/**
 * Tonight's right page: today's new sketches, drawn large with their journal
 * words. With nothing new, the headline's own drawing; else a quiet note.
 * The whole collection stays on its own tabs.
 */
export function eveningRight(view: AdventureView, items: UnpackItem[], day = view.day, inspect?: (id: string) => void): HTMLElement {
  const today = `Day ${day} `;
  const fresh = view.journal.filter((e) => e.found && e.credit?.startsWith(today));
  const body = h('div', 'nb-page-body nb-eve-sketchbook');
  body.append(h('h2', 'nb-eve-sketch-head', null, [caps(fresh.length > 1 ? 'New in the journal' : 'In the journal')]));
  if (fresh.length) {
    const size = fresh.length === 1 ? 210 : fresh.length === 2 ? 150 : 104;
    const told = headlineOf(items)?.text;
    body.append(h('div', `nb-eve-plates is-${Math.min(fresh.length, 3)}`, null, fresh.map((e) => sketchPlate(e, size, e.text === told, inspect))));
    return body;
  }
  const headline = headlineOf(items);
  if (headline?.sketch) {
    body.append(h('figure', 'nb-eve-plate is-headline', null, [
      sketchEl(headline.sketch, 210, true, 'nb-eve-plate-art'),
      h('figcaption', null, null, [h('h3', 'nb-eve-plate-name', null, [headline.title]), headline.outcome ? h('p', 'nb-eve-plate-text', null, [headline.outcome]) : null]),
    ]));
    return body;
  }
  body.append(h('p', 'nb-eve-quiet', null, ['Nothing new for the sketchbook today.']));
  return body;
}

function sketchPlate(entry: JournalEntry, size: number, toldAlready = false, inspect?: (id: string) => void): HTMLElement {
  const plate = h('figure', `nb-eve-plate nb-tonight-find${entry.rare ? ' is-rare' : ''}`, null, [
    sketchEl(entry.sketch, size, true, 'nb-eve-plate-art nb-tonight-sketch'),
    h('figcaption', null, null, [
      h('h3', 'nb-eve-plate-name', null, [entry.name ?? '']),
      entry.text && !toldAlready ? h('p', 'nb-eve-plate-text', null, [entry.text]) : null,
      h('p', 'nb-eve-plate-credit', null, [entry.rare ? caps('Rare') : null, entry.credit ? caps(entry.credit) : null]),
    ]),
  ]);
  if (inspect) {
    const art = plate.querySelector('.nb-eve-plate-art');
    if (art) {
      const button = wordButton('', () => inspect(entry.id), 'nb-sketch-inspect');
      button.setAttribute('aria-label', `Read about ${entry.name ?? 'this sketch'} in the field journal`);
      art.replaceWith(button); button.append(art);
    }
  }
  plate.dataset.item = `entry-${entry.id}`;
  return plate;
}

import '../styles/fonts.css';
/**
 * The style guide (`/styleguide.html`): every piece of the paper system on
 * one page, built from the real interface code so it cannot drift from the
 * game. Colour tokens with their contrast on ivory, the type scale, the kit
 * classes in each state, the screens' components (clock, HUD sheets, popups,
 * results, journal leaves), the small marks, and every sketch at 48 and 24 px,
 * found and unfound.
 *
 * Query options: `?only=<prefix>` limits the sketch sheet to ids with that
 * prefix; `?cat=<category>` shows only the finds of one journal category;
 * `?big=<px>` draws the sheet at another size for close review.
 */

import '../styles/tokens.css';
import '../styles/kit.css';
import '../styles/ui.css';
import '../styles/menu.css';

import landscape from '../../assets/references/master_style.png';
import { EQUIPMENT, FINDS, PEOPLE, PLACES, STRUCTURES } from '../game/adventure/content';
import type { HudState, JournalCard, UiActions } from '../ui/contract';
import { SeasonClock } from '../ui/clock';
import { h } from '../ui/dom';
import { Hud } from '../ui/hud';
import { Journal } from '../ui/journal';
import { Results } from '../ui/results';
import { titleLockup } from '../ui/menu';
import { fallbackFor, hasSketch, knot, leadMark, pips, placeMark, portrait, seasonMark, sketch, weatherMark } from '../ui/sketches';

const params = new URLSearchParams(location.search);

/** Every action is a no-op: the guide shows, it does not play. */
const actions = new Proxy({}, { get: () => () => undefined }) as UiActions;

const root = document.getElementById('guide')!;
root.className = 'sr-ui sg';

/* ---------- Helpers ---------- */

function section(title: string, lede: string, ...body: Node[]): HTMLElement {
  return h('section', 'sg-section', { id: title.toLowerCase().replace(/\W+/g, '-') }, [
    h('h2', 'sg-h2', null, [title]),
    h('p', 'sg-lede', null, [lede]),
    ...body,
  ]);
}

function specimen(label: string, content: Node | string, note?: string): HTMLElement {
  const box = h('div', 'sg-specimen');
  if (typeof content === 'string') box.innerHTML = content;
  else box.append(content);
  return h('figure', 'sg-figure', null, [box, h('figcaption', 'sg-cap', null, [label, note ? h('span', 'sg-note', null, [note]) : null])]);
}

const grid = (...items: Node[]): HTMLElement => h('div', 'sg-grid', null, items);
const row = (...items: Node[]): HTMLElement => h('div', 'sg-row', null, items);

/** A window onto the landscape, holding its own interface root, for things that sit over the valley. */
function stage(height: number, ...content: Node[]): HTMLElement {
  const ui = h('div', 'sr-ui sg-stage-ui', null, content);
  const frame = h('div', 'sg-stage', null, [ui]);
  frame.style.height = `${height}px`;
  frame.style.backgroundImage = `url(${landscape})`;
  return frame;
}

function luminance(hex: string): number {
  const v = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

const contrast = (a: string, b: string): number => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

/* ---------- Header ---------- */

const head = h('header', 'sg-head', null, [
  titleLockup('div'),
  h('p', 'sg-lede', null, ['The paper system: flat warm ivory, hairline forest-green rules, one serif, words for buttons, pen sketches with a pale wash.']),
  h('nav', 'sg-toc', null, ['Favicon', 'Colour', 'Type', 'Kit', 'Clock', 'Over the valley', 'Sheets', 'Marks', 'Sketches'].map((t) =>
    h('a', 'sr-word', { href: `#${t.toLowerCase().replace(/\W+/g, '-')}` }, [t]))),
]);

/* ---------- Favicon ---------- */

const brand = `${import.meta.env.BASE_URL}art/brand/`;
const faviconImage = (size: number): HTMLElement => h('img', null, {
  src: `${brand}favicon-${size}.png`, width: String(size), height: String(size),
  alt: 'Pine-green mountain, ivory summit and winding blue river',
});
const faviconStudy = grid(
  h('figure', 'sg-figure', null, [
    h('div', 'sg-favicon-hero', null, [faviconImage(128)]),
    h('figcaption', 'sg-cap', null, ['The mountain spring and the river', h('span', 'sg-note', null, ['A small painterly mark in pine, olive, mineral blue and warm ivory.'])]),
  ]),
  h('figure', 'sg-figure', null, [
    h('div', null, null, [
      h('div', 'sg-favicon-tab', null, [faviconImage(16), h('span', null, null, ['Song of the River'])]),
      h('div', 'sg-favicon-tab is-dark', null, [faviconImage(16), h('span', null, null, ['Song of the River'])]),
    ]),
    h('figcaption', 'sg-cap', null, ['Browser tabs · 16px', h('span', 'sg-note', null, ['Shown at native size on light and dark backgrounds.'])]),
  ]),
  h('figure', 'sg-figure', null, [
    h('div', 'sg-favicon-sizes', null, [16, 32, 48].map(size =>
      h('div', 'sg-favicon-size', null, [faviconImage(size), h('span', 'sg-cap', null, [`${size}px`])]))),
    h('figcaption', 'sg-cap', null, ['Native icon sizes · transparent PNG']),
  ]),
);
const faviconDownloads = row(...[
  ['favicon.ico', 'Browser ICO'], ['favicon-512.png', '512px PNG'], ['apple-touch-icon.png', 'Apple touch icon'],
].map(([file, label]) => h('a', 'sr-word', { href: `${brand}${file}`, download: file }, [label])));

/* ---------- Colour ---------- */

const IVORY = '#f6f1e4';
const COLOURS: Array<[string, string, string]> = [
  ['--ivory', '#f6f1e4', 'every panel, leaf, tag and popup'],
  ['--ivory-deep', '#ece5d2', 'the facing page, pressed fills'],
  ['--green-ink', '#24362e', 'all text and line work'],
  ['--green-ink-soft', '#4f6157', 'secondary text'],
  ['--green-ink-faint', '#8b968b', 'disabled, dotted outlines (never body text)'],
  ['--rust-ink', '#9c5a3c', 'closed, refused, the minus sign'],
  ['--rule', 'rgba(36,54,46,.22)', '1px hairline'],
  ['--rule-strong', 'rgba(36,54,46,.6)', 'panel edges, underlines'],
  ['--wash-river', '#bcd7d6', 'sketch tint'],
  ['--wash-blossom', '#ecc9c6', 'sketch tint'],
  ['--wash-leaf', '#cfdcb8', 'sketch tint'],
  ['--wash-straw', '#e6d7a8', 'sketch tint'],
  ['--teal', '#3f7f86', 'the title swash only'],
];
const colours = h('div', 'sg-swatches', null, COLOURS.map(([name, value, use]) => {
  const ratio = value.startsWith('#') ? contrast(value, IVORY) : null;
  return h('div', 'sg-swatch', null, [
    h('span', 'sg-chipcolour', { style: `background:var(${name})` }),
    h('span', 'sg-swatch-name', null, [name]),
    h('span', 'sg-swatch-use', null, [`${value} · ${use}`]),
    ratio ? h('span', 'sr-caps', null, [`${ratio.toFixed(1)} : 1 on ivory${ratio >= 4.5 ? '' : ratio >= 3 ? ' (large only)' : ''}`]) : null,
  ]);
}));

/* ---------- Type ---------- */

const TYPE: Array<[string, string, string]> = [
  ['--t-display 42', 'font:500 var(--t-display)/1.05 var(--serif)', 'Summer'],
  ['--t-title 28', 'font:600 var(--t-title)/1.15 var(--serif)', 'Where shall we go?'],
  ['--t-lead 19 italic', 'font:italic 500 var(--t-lead)/1.3 var(--serif)', 'Send little people into a beautiful, shifting world.'],
  ['--t-word 17', 'font:500 var(--t-word)/1.3 var(--serif)', 'Mina returned with willow seeds.'],
  ['--t-body 16.5', 'font:500 var(--t-body)/1.4 var(--serif)', 'The sheltered pool holds fish even in cold weather. Silver bodies move against the current.'],
  ['--t-small 14 italic', 'font:italic 500 var(--t-small)/1.35 var(--serif)', 'A grey silhouette in the quiet shallows.'],
  ['--t-caps 11', '', 'Day 2 of 3 · Seseragi'],
];
const type = h('div', 'sg-type', null, TYPE.map(([name, style, text]) =>
  h('div', 'sg-type-row', null, [h('span', 'sr-caps sg-type-name', null, [name]), h(style ? 'p' : 'span', style ? 'sg-type-sample' : 'sr-caps', style ? { style } : null, [text])])));

/* ---------- Kit ---------- */

const words = (cls: string, labels: string[], extra = ''): HTMLElement =>
  row(...labels.map((l) => h('button', `sr-word ${cls} ${extra}`.trim(), { type: 'button' }, [l])));

const toggle = h('div', 'sr-toggle', { role: 'radiogroup', 'aria-label': 'Reduced motion' }, ['System', 'On', 'Off'].map((l, i) =>
  h('button', null, { type: 'button', role: 'radio', 'aria-checked': String(i === 0) }, [l])));
const slider = h('input', 'sr-slider', { type: 'range', value: '70', 'aria-label': 'Music' });
slider.style.setProperty('--v', '70%');
slider.addEventListener('input', () => slider.style.setProperty('--v', `${slider.value}%`));

const panel = h('div', 'sr-paper sg-panel', null, [
  h('p', 'sr-caps', null, ['A paper panel']),
  h('p', 'sg-panel-title', null, ['Kamimori grove']),
  h('p', 'sg-panel-text', null, ['Moss, fern and deer tracks beneath the pines.']),
  h('hr', 'sr-rule'),
  h('div', 'sr-row', null, [h('span', null, null, ['Chance']), h('span', 'sg-inline', null, [h('i', null, null, ['likely ']), fromHtml(pips(3, 12))])]),
  h('div', 'sr-row', null, [h('span', null, null, ['Water']), h('i', null, null, ['high, falling'])]),
  row(h('button', 'sr-word is-primary', { type: 'button' }, ['Send Mina']), h('button', 'sr-word is-quiet', { type: 'button' }, ['Not today'])),
]);

const confirm = h('div', 'sr-paper sg-panel', null, [
  h('p', 'sg-panel-text', null, [h('i', null, null, ['Forget every valley walked?'])]),
  row(h('button', 'sr-word', { type: 'button' }, ['Keep it']), h('button', 'sr-word is-primary is-danger', { type: 'button' }, ['Start over'])),
]);

function fromHtml(markup: string): Element {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild!;
}

const kit = h('div', null, null, [
  grid(
    specimen('.sr-word', words('', ['Journal', 'Back', 'Keep it']), 'a word, underlined; thicker on hover and focus'),
    specimen('.sr-word.sg-hover', words('', ['Journal', 'Back']).cloneNode(true) as HTMLElement, 'hover, shown statically'),
    specimen('.sr-word.is-primary', words('is-primary', ['Begin the day', 'Send']), 'small capitals, a firm underline'),
    specimen('.sr-word.is-quiet', words('is-quiet', ['Not today', 'Menu'])),
    specimen('.sr-word.is-danger', words('is-danger', ['Start over…', 'Remove'])),
    specimen('.sr-word:disabled', row(...['Undo', 'Redo'].map((l) => h('button', 'sr-word', { type: 'button', disabled: '' }, [l])))),
    specimen('.sr-word with a mark', row(h('button', 'sr-word', { type: 'button' }, [fromHtml(seasonMark(0, 18)), 'Seasons']))),
    specimen('.sr-chip', row(h('span', 'sr-chip', null, ['Ren', fromHtml(knot('rare', 18))]), h('span', 'sr-chip', null, [fromHtml(weatherMark('rain', 18)), 'Rain'])), 'a small paper label'),
    specimen('.sr-caps', h('p', 'sr-caps', null, ['Notes from the river'])),
    specimen('portrait(id, { size })', row(...PEOPLE.map((p) => fromHtml(portrait(p.id, { size: 48 }))), fromHtml(portrait('kiko', { size: 48 }))), 'the friends\' painted faces; an unknown friend gets their sketch'),
    specimen('.sr-rule, .sr-rule.is-short', h('div', null, null, [h('hr', 'sr-rule'), h('br'), h('hr', 'sr-rule is-short')])),
    specimen('.sr-slider', slider),
    specimen('.sr-toggle', toggle, 'the chosen word is inked and underlined'),
  ),
  grid(specimen('.sr-paper with rows', panel), specimen('A confirmation', confirm)),
]);
// The static hover specimen.
kit.querySelectorAll('.sg-figure:nth-child(2) .sr-word').forEach((b) => b.classList.add('sg-hover'));

/* ---------- Clock ---------- */

function clockAt(season: 0 | 1 | 2 | 3, progress: number, days: number | null, year = 1, years: number | null = null): HTMLElement {
  const clock = new SeasonClock();
  const host = h('div', 'sg-clock-host', null, [clock.el]);
  clock.setDays(days);
  clock.setLabel(season, year, years);
  clock.setProgress(progress);
  return host;
}
const clocks = grid(
  specimen('Expedition: spring, day 1', clockAt(0, 0.02, 3)),
  specimen('Expedition: summer, day 2', clockAt(1, 0.25 + 0.25 * 0.45, 3)),
  specimen('Expedition: autumn, day 3, year 2', clockAt(2, 0.5 + 0.25 * 0.9, 3, 2)),
  specimen('Expedition: winter, day 1', clockAt(3, 0.75 + 0.03, 3)),
  specimen('Free play: summer, no days', clockAt(1, 0.4, null, 1, 2)),
  specimen('Free play: winter', clockAt(3, 0.9, null, 2, 2)),
);

/* ---------- Over the valley: HUD sheets, popups, the season title ---------- */

const hud = new Hud(actions);
const hudState: HudState = {
  valley: 'Seseragi', subtitle: 'Mountain springs', mode: 'journey', season: 1, year: 1, yearProgress: 0.36, years: 2,
  paused: false, speed: 1, marks: 2, marksCap: 3, wishesGranted: 1, wishesTotal: 3, canUndo: true, canRedo: false,
  placesVisible: true, routesVisible: false,
  objectives: [
    { id: 'a', title: 'Deer cross to the meadow', text: 'They need a quiet way past the village.', traveller: 'deer', season: 1, progress: 1, count: 3, done: false, note: null, upcoming: false },
    { id: 'b', title: 'Fish reach the pool', text: 'Stones in the shallows would help.', traveller: 'fish', season: 1, progress: 3, count: 3, done: true, note: null, upcoming: false },
    { id: 'c', title: 'Swallows return', text: 'Reeds by the bend.', traveller: 'bird', season: 2, progress: 0, count: 2, done: false, note: null, upcoming: true },
  ],
};
hud.update(hudState);
hud.setSelection({ title: 'The path to Fuchi pool', detail: 'Open while the water is low.', tone: 'open', removable: true });
(hud.el.querySelector('.seasonal-opportunities') as HTMLDetailsElement).open = true;
const hudStage = stage(560, hud.el);
hudStage.querySelector('.sr-ui')!.classList.add('hud-on');
requestAnimationFrame(() => hud.clock.rebuild());

const popups = stage(380,
  h('p', 'hint sr-popup is-shown', null, ['Tap a companion, then a place. They will go at first light.']),
  h('div', 'toast sr-popup is-shown', { style: 'bottom:150px' }, ['Ren is resting by the fire.']),
  h('div', 'found sr-popup is-shown', { style: 'top:24px' }, [h('span', 'found-glyph', null, [fromHtml(sketch('kingfisher', { size: 24 }))]), h('span', 'found-label', null, ['Journal:']), h('span', 'found-title', null, ['A flash of river blue'])]),
  h('div', 'announce is-shown sg-still', { style: 'top:auto;bottom:-10px;left:auto;right:24px;transform:none' }, [h('span', 'announce-name', null, ['Summer']), h('span', 'announce-rule'), h('span', 'announce-year', null, ['Year 1'])]),
);

/* ---------- The popup kit ---------- */

const kitStage = stage(300,
  h('div', 'sg-kit-row', null, [
    h('div', 'sg-kit-cell', null, [h('span', 'sr-caption', null, ['Fuchi pool']), h('p', 'sr-caps sg-kit-name', null, ['.sr-caption'])]),
    h('div', 'sg-kit-cell', null, [
      h('div', 'sr-slip', null, [h('p', 'sr-caps', null, ['Kamimori grove']), h('p', null, null, ['Moss, fern and deer tracks beneath the pines.'])]),
      h('p', 'sr-caps sg-kit-name', null, ['.sr-slip']),
    ]),
    h('div', 'sg-kit-cell', null, [h('div', 'sr-notice is-shown', null, ['Ren is resting by the fire.']), h('p', 'sr-caps sg-kit-name', null, ['.sr-notice'])]),
    h('div', 'sg-kit-cell', null, [
      h('div', 'sr-dialog sg-kit-dialog', null, [
        h('p', 'sg-panel-text', null, [h('i', null, null, ['Forget every valley walked?'])]),
        row(h('button', 'sr-word', { type: 'button' }, ['Keep it']), h('button', 'sr-word is-primary is-danger', { type: 'button' }, ['Start over'])),
      ]),
      h('p', 'sr-caps sg-kit-name', null, ['.sr-dialog']),
    ]),
  ]),
);

/* ---------- Sheets: results and the journal ---------- */

const results = new Results(actions);
results.show({
  won: true, valley: 'Seseragi', headline: 'The spring runs clear to the sea', hasNext: true, shortfalls: [],
  journeys: [], moments: ['Ren saw a kingfisher on the second morning.'],
  blossoms: [{ label: 'Every wish granted', earned: true }, { label: 'Within two years', earned: true }, { label: 'Nothing left closed', earned: false }],
});
const journal = new Journal();
const cards: JournalCard[] = [
  ...FINDS.slice(0, 4).map((d) => ({ id: d.id, title: d.name, text: d.text, kind: 'wildlife' as const, found: true })),
  ...['heron', 'sea-glass', 'moss', 'deer-tracks'].map((id) => ({ id, title: '', text: '', kind: 'wildlife' as const, found: false })),
];
journal.show(cards);
const sheets = grid(stage(640, results.el), stage(640, journal.el));

/* ---------- Marks ---------- */

const markRow = (size: number): HTMLElement => row(
  ...([0, 1, 2, 3] as const).map((c) => fromHtml(pips(c, size * 0.6))),
  fromHtml(pips('certain', size * 0.6)),
  fromHtml(knot('plain', size)), fromHtml(knot('unusual', size)), fromHtml(knot('rare', size)),
  fromHtml(leadMark(size)), fromHtml(placeMark('open', size)), fromHtml(placeMark('closed', size)), fromHtml(placeMark('special', size)),
  ...(['clear', 'mist', 'rain', 'snow'] as const).map((w) => fromHtml(weatherMark(w, size))),
  ...[0, 1, 2, 3].map((s) => fromHtml(seasonMark(s, size))),
);
const chanceWords = h('div', 'sg-chances', null, (['unlikely', 'even', 'likely', 'certain'] as const).map((word, i) =>
  h('span', 'sg-chance', null, [h('i', null, null, [word]), fromHtml(pips(i === 3 ? 'certain' : ((i + 1) as 1 | 2 | 3), 12))])));
const marks = h('div', null, null, [
  specimen('Chance words with their pips', chanceWords),
  specimen('At 20 px: pips 0 to 3 and certain; knot plain, unusual, rare; lead; place open, closed, special; clear, mist, rain, snow; spring to winter', markRow(20)),
  specimen('At 40 px', markRow(40)),
]);

/* ---------- Sketches ---------- */

const big = Number(params.get('big')) || 48;
const only = params.get('only');
const SKETCH_LIST: Array<[string, string[]]> = [
  ['Friends', [...new Set([...PEOPLE.map((p) => `friend-${p.id}`), 'friend-haru'])]],
  ['Structures', STRUCTURES.map((s) => `structure-${s.id}`)],
  ['Tools', EQUIPMENT.map((e) => `item-${e.id}`)],
  ['Places', [...new Set(PLACES.map((d) => d.habitat))].map((x) => `place-${x}`)],
  ...(['birds', 'fish', 'wildlife', 'plants', 'curiosities', 'keepsakes', 'encounters'] as const).map((c): [string, string[]] =>
    [`Finds: ${c}`, FINDS.filter((d) => d.category === c).map((d) => d.id)]),
  ['Fallbacks by category and keyword', ['any-fish', 'any-bird', 'any-feather', 'any-mushroom', 'any-flower', 'any-leaf', 'any-shell', 'any-stone', 'any-track', 'any-map', 'any-letter', 'any-parcel', 'any-antler', 'any-den', 'any-tool', 'any-star', 'any-person', 'any-structure', 'any-place', 'any-sprig']],
  ['Unknown ids (examples)', ['golden-carp', 'hawk-feather', 'stag-antlers', 'badger-den', 'boar-tracks', 'blue-iris', 'old-letter', 'river-snail', 'mystery-thing']],
];
const cat = params.get('cat');
const sketchBlocks = SKETCH_LIST.map(([title, ids]) => {
  if (cat && title !== `Finds: ${cat}`) return null;
  const list = only ? ids.filter((i) => i.startsWith(only)) : ids;
  if (!list.length) return null;
  return h('div', 'sg-sketch-group', null, [
    h('h3', 'sr-caps sg-h3', null, [title]),
    h('div', 'sg-sketches', { style: `--cell:${big * 2 + 70}px` }, list.map((id) => {
      const cell = h('figure', 'sg-sketch');
      cell.innerHTML =
        `<div class="sg-sketch-pair">${sketch(id, { size: big })}${sketch(id, { size: big, found: false })}</div>` +
        `<div class="sg-sketch-pair is-small">${sketch(id, { size: 24 })}${sketch(id, { size: 24, found: false })}</div>`;
      const fallback = !hasSketch(id) && !id.startsWith('any-') ? ` → ${fallbackFor(id)}` : '';
      const name = FINDS.find((f) => f.id === id)?.name;
      cell.append(h('figcaption', 'sg-cap', null, [id + fallback, name ? h('span', 'sg-note', null, [name]) : null]));
      return cell;
    })),
  ]);
}).filter((x): x is HTMLDivElement => !!x);

/* ---------- Page ---------- */

if (only || cat || params.get('big')) {
  root.append(...sketchBlocks);
} else {
  root.append(
    head,
    section('Favicon', 'One mountain spring, one winding river. Broad colour shapes keep the valley recognisable in a tiny tab.', faviconStudy, faviconDownloads),
    section('Colour', 'The paper system tokens. Body text uses green ink or soft green ink only; both pass 4.5 : 1 on ivory.', colours),
    section('Type', 'One serif, Cormorant Garamond, for everything. Labels are small capitals with wide tracking.', type),
    section('Kit', 'The handful of classes every screen is built from (kit.css).', kit),
    section('Clock', 'The annual timer: a paper tab hanging from the top edge. Four quarters of the year; solid is past, dotted is to come, the ring is now, the wash is today.', clocks),
    section('Popups', 'One kit for everything that sits over the valley: a caption written on it, a slip beside a thing, a notice that comes and goes, a dialog to read and answer. Add .sr-transient to make a caption or slip come and go.', kitStage),
    section('Over the valley', 'The free-play sheets, the selection chip, a hint, a toast, a journal note and the season title, as they sit on the landscape.', hudStage, popups),
    section('Sheets', 'Results and the field journal, the two sheets that open over the valley.', sheets),
    section('Marks', 'Small marks that sit beside text and weigh what the text weighs.', marks),
    section('Sketches', 'Every drawing at 48 and 24 px, found and unfound (dotted, no wash).', ...sketchBlocks),
  );
}

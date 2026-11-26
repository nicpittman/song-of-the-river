/**
 * The field journal: a paper sheet over the valley or the title screen,
 * grouped by what the leaves record. A found leaf carries its sketch, a title
 * and a line or two; the rest show the same sketch as a dotted outline and
 * give nothing else away.
 */

import type { JournalCard } from './contract';
import { button, h } from './dom';
import { sketch } from './sketches';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
export const inWords = (n: number): string => WORDS[n] ?? String(n);

const GROUPS: Array<{ kind: JournalCard['kind']; title: string }> = [
  { kind: 'craft', title: 'Craft' },
  { kind: 'wildlife', title: 'Wildlife' },
  { kind: 'season', title: 'Seasons' },
  { kind: 'place', title: 'Places' },
];

/**
 * Journal cards from the valley game use their own ids; this picks the
 * expedition sketch that shows the same thing. Anything else goes to the
 * sketch library, which finds a drawing by keyword.
 */
const SKETCH_FOR: Record<string, string> = {
  'first-line': 'friend-sora', villagers: 'friend-mina', 'stepping-stones': 'any-stone', weir: 'any-stone',
  footbridge: 'structure-bridge', reshape: 'place-river', channel: 'place-river', grove: 'place-woodland',
  reeds: 'place-wetland', deer: 'deer-tracks', 'keep-apart': 'deer-tracks', fish: 'salmon', 'fish-and-stones': 'salmon',
  bird: 'heron', flyway: 'migrants', 'spring-melt': 'blossom', summer: 'place-meadow', autumn: 'apples',
  winter: 'snowprint', snowline: 'snowprint', 'full-year': 'mountain-reflection',
};

const sketchIdFor = (c: JournalCard): string => (c.id.startsWith('wish:') ? 'any-star' : SKETCH_FOR[c.id] ?? c.id);

export class Journal {
  readonly el: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly count: HTMLElement;
  private readonly body: HTMLElement;
  private readonly scroller: HTMLElement;
  private readonly closeBtn: HTMLButtonElement;
  private returnFocus: HTMLElement | null = null;

  constructor() {
    this.count = h('p', 'journal-count');
    this.body = h('div', 'journal-body');
    this.closeBtn = button('sr-word journal-close', 'Close the journal', '×', () => this.hide());
    this.scroller = h('div', 'journal-scroll', { tabindex: '0', 'aria-label': 'Journal pages' }, [this.body]);
    this.panel = h('div', 'journal-panel sr-dialog', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sr-journal-title' }, [
      h('header', 'journal-head', null, [h('h2', 'journal-title', { id: 'sr-journal-title' }, ['Field journal']), this.count, this.closeBtn]),
      this.scroller,
    ]);
    const veil = h('div', 'sheet-veil');
    veil.addEventListener('click', () => this.hide());
    this.el = h('div', 'journal overlay', null, [veil, this.panel]);

    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
      } else if (e.key === 'Tab') {
        // Keep focus inside the journal: the close word and the scrolling pages.
        const stops = [this.closeBtn, this.scroller];
        const i = stops.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        stops[(i + (e.shiftKey ? stops.length - 1 : 1)) % stops.length].focus();
      }
    });
  }

  get isOpen(): boolean {
    return this.el.classList.contains('is-open');
  }

  show(cards: JournalCard[]): void {
    const found = cards.filter((c) => c.found).length;
    this.count.textContent = cards.length === 0
      ? 'Still blank. It fills as the river is walked.'
      : found === 0
      ? `${inWords(cards.length)} pages, all still blank`
      : `${inWords(found)} of ${inWords(cards.length)} pages filled`;

    const sections: HTMLElement[] = [];
    for (const g of GROUPS) {
      const list = cards.filter((c) => c.kind === g.kind);
      if (!list.length) continue;
      const n = list.filter((c) => c.found).length;
      sections.push(h('section', 'journal-group', { 'aria-label': g.title }, [
        h('h3', 'journal-group-title sr-caps', null, [g.title, h('span', null, null, [`${n} of ${list.length}`])]),
        h('ul', 'journal-grid', { role: 'list' }, list.map((c) => this.leaf(c))),
      ]));
    }
    this.body.replaceChildren(...sections);
    this.scroller.scrollTop = 0;
    if (!this.isOpen) this.returnFocus = document.activeElement as HTMLElement | null;
    this.el.classList.add('is-open');
    requestAnimationFrame(() => this.closeBtn.focus({ preventScroll: true }));
  }

  hide(): void {
    if (!this.isOpen) return;
    this.el.classList.remove('is-open');
    const back = this.returnFocus;
    this.returnFocus = null;
    if (back && back.isConnected && back !== document.body) back.focus({ preventScroll: true });
    else if (this.el.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  }

  private leaf(c: JournalCard): HTMLElement {
    const art = h('span', 'jcard-art');
    art.innerHTML = sketch(sketchIdFor(c), { found: c.found, size: 56 });
    if (!c.found) {
      return h('li', 'jcard is-unfound', null, [art, h('p', 'jcard-text', null, ['Not yet found'])]);
    }
    return h('li', `jcard is-${c.kind}`, null, [art, h('h4', 'jcard-title', null, [c.title]), h('p', 'jcard-text', null, [c.text])]);
  }
}

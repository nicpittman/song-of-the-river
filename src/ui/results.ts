/**
 * The end-of-valley card. When every wish is granted it shows the valley's
 * blossoms, inked one after another; when the time is up first it says,
 * gently, what is still wanted, and lets the player carry on.
 */

import type { ResultModel, UiActions } from './contract';
import { h } from './dom';
import { seasonMark } from './sketches';

/** The rating blossom is the spring season mark: the same drawing wherever a blossom means "earned". */
const blossom = (size: number): string => seasonMark(0, size);

export class Results {
  readonly el: HTMLElement;
  private readonly card: HTMLElement;

  constructor(private readonly actions: UiActions) {
    this.card = h('div', 'results-card sr-dialog', { role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'sr-results-title' });
    this.el = h('div', 'results overlay', null, [h('div', 'sheet-veil'), this.card]);
  }

  show(m: ResultModel): void {
    const parts: HTMLElement[] = [];

    if (m.won && m.blossoms.length) {
      const earned = m.blossoms.filter((b) => b.earned).length;
      const row = h('div', 'bloom-row', { role: 'img', 'aria-label': `${earned} of ${m.blossoms.length} blossoms` });
      m.blossoms.forEach((b, i) => {
        const g = h('span', b.earned ? 'bloom is-earned' : 'bloom is-bare');
        g.style.setProperty('--i', String(i));
        g.innerHTML = blossom(34);
        row.append(g);
      });
      const labels = h('ul', 'bloom-labels', null, m.blossoms.map((b) => {
        const li = h('li', `sr-row${b.earned ? ' is-earned' : ''}`, null, [b.label, h('span', 'visually-hidden', null, [b.earned ? ', earned' : ', not this time'])]);
        return li;
      }));
      parts.push(h('div', 'blooms', null, [row, labels]));
    }

    if (!m.won && m.shortfalls.length) parts.push(h('div', 'shortfalls', null, m.shortfalls.map((s) => h('p', null, null, [s]))));
    if (m.moments.length) parts.push(h('div', 'moments', null, m.moments.slice(0, 2).map((s) => h('p', null, null, [s]))));

    const word = (label: string, fn: () => void, rank: 'primary' | 'plain' | 'quiet'): HTMLButtonElement => {
      const b = h('button', rank === 'plain' ? 'sr-word' : `sr-word is-${rank}`, { type: 'button' }, [label]);
      b.addEventListener('click', fn);
      return b;
    };
    const words: HTMLButtonElement[] = [];
    if (m.won) {
      if (m.hasNext) words.push(word('Next valley', () => this.actions.nextValley(), 'primary'));
      words.push(word('Keep watching', () => this.actions.keepWatching(), m.hasNext ? 'plain' : 'primary'));
    } else {
      words.push(word('Keep going', () => this.actions.keepWatching(), 'primary'));
      words.push(word('Start again', () => this.actions.retry(), 'plain'));
    }
    words.push(word('Menu', () => this.actions.toMenu(), 'quiet'));

    this.card.replaceChildren(
      h('p', 'results-valley sr-caps', null, [m.valley]),
      h('h2', 'results-headline', { id: 'sr-results-title' }, [m.headline]),
      h('hr', 'sr-rule is-short'),
      ...parts,
      h('div', 'results-actions', null, words),
    );
    this.el.dataset.outcome = m.won ? 'won' : 'open';
    this.el.classList.add('is-open');
    requestAnimationFrame(() => words[0]?.focus({ preventScroll: true }));
  }

  hide(): void {
    this.el.classList.remove('is-open');
    if (this.el.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  }
}

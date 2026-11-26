import '../../styles/day-end.css';
/** The sea stays in view while the final words roll, then the menu returns. */
import type { AdventureView } from '../../game/adventure/model';
import type { UiActions } from '../contract';
import { h } from '../dom';
import { caps, sketchEl, wordButton } from './ink';
import { GAME_CREDITS } from '../../game/credits';
import { EndingClock, JOURNEY_AHEAD_MS, JOURNEY_HOLD_MS, JOURNEY_MEMORY_MS, rollCredits } from './endingClock';
import { PageCurl } from './pageCurl';
import { listNames } from './words';
import { journeyLeaves } from './journeyMemories';

export class EndingScreen {
  readonly el = h('section', 'nb-finale', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Song of the River: ending and credits' });
  private readonly clock = new EndingClock();
  private rolling: Animation | null = null;
  constructor(private readonly actions: UiActions) {}
  show(view: AdventureView): void {
    this.hide();
    const menu = (): void => { this.hide(); if (this.actions.finishJourney) this.actions.finishJourney(); else this.actions.toMenu(); };
    const credits = wordButton('Credits & sources', () => { menu(); this.actions.openCredits?.(); }, 'nb-finale-sources');
    const back = wordButton('Main menu', menu, 'nb-finale-menu');
    const sailed = view.ending?.sailed ?? [];
    const roll = h('div', 'nb-finale-roll', null, [caps('The river meets the sea'), h('h2', null, null, ['Song of the River']),
      h('p', 'nb-finale-story', null, [sailed.length ? `${listNames(sailed)} followed the river to the open sea.` : 'The river becomes the sea.']),
      view.ending?.line ? h('p','nb-finale-terms',null,[view.ending.line]) : null,
      ...(view.ending?.notes ?? []).map((note) => h('p', 'nb-finale-terms', null, [note])),
      // Ren's salt and Sora's first sight of the sea are said once, on the voyage itself.
      caps('A game by'), h('p', null, null, [h('a', null, { href: GAME_CREDITS.website, target: '_blank', rel: 'noopener noreferrer' }, [GAME_CREDITS.creator])]),
      h('p', 'nb-finale-terms', null, [GAME_CREDITS.jam]),
      caps('Art'), h('p', null, null, [GAME_CREDITS.art]),
      caps('Development assistance'), h('p', null, null, [GAME_CREDITS.development]),
      caps(`Music · ${GAME_CREDITS.music}`), h('p', null, null, [GAME_CREDITS.tracks]), h('p', 'nb-finale-terms', null, [GAME_CREDITS.musicTerms]),
      caps('Sound & ambience'), h('p', null, null, ['Kenney and the CC0 / public-domain recording community']),
      caps('Made with'), h('p', null, null, ['PixiJS · TypeScript · Vite']),
      h('p', 'nb-finale-terms', null, [`Code: ${GAME_CREDITS.codeTerms}. Project artwork and writing: ${GAME_CREDITS.assetTerms}. Music and third-party terms are separate.`]),
      h('p', 'nb-finale-thanks', null, ['Thank you for following the river.']),
      h('p','nb-finale-terms',null,[GAME_CREDITS.ratingRequest]),
      h('p', 'nb-finale-terms', null, ['Wander offers a more open adventure along the whole river, at your own pace.']),
    ]);
    const viewport = h('div', 'nb-finale-window', null, [roll]);
    this.el.replaceChildren(viewport, h('footer', null, null, [wordButton('Our journey in sketches', () => this.showMemories(view, menu), 'nb-finale-sources'), credits, back]));
    this.el.classList.add('is-shown');
    requestAnimationFrame(() => {
      if (!roll.isConnected) return;
      this.rolling = rollCredits(roll, viewport);
      this.clock.start(() => this.showMemories(view, menu));
      back.focus({ preventScroll: true });
    });
  }
  /**
   * The journal leafed through, briskly: the journey's pages, then its small
   * collections, then the open sea ahead. ‹ › (or the arrow keys, or a swipe)
   * turn back and forth; a turn by hand holds the pages a moment before they
   * carry on by themselves.
   */
  private showMemories(view: AdventureView, finish: () => void): void {
    this.rolling?.cancel(); this.rolling = null; this.clock.stop(); this.stopLeafing();
    const leaves = journeyLeaves(view);
    const window = this.el.querySelector<HTMLElement>('.nb-finale-window');
    if (!leaves.length || !window) { finish(); return; }
    window.classList.add('is-memories');
    const page = h('div', 'nb-memory-page');
    const book = h('div', 'nb-memory-book', null, [page, h('div', 'nb-memory-blank')]);
    const curl = new PageCurl(book, page, book.lastElementChild as HTMLElement);
    const back = h('button', 'nb-memory-turn', { type: 'button', 'aria-label': 'Previous page' }, ['‹']);
    const next = h('button', 'nb-memory-turn', { type: 'button', 'aria-label': 'Next page' }, ['›']);
    const count = h('span', 'nb-memory-count', { 'aria-live': 'polite' });
    window.replaceChildren(h('div', 'nb-memory-leafing', null, [book, h('nav', 'nb-memory-nav', { 'aria-label': 'Journal pages' }, [back, count, next])]));
    const last = leaves.length; // The page after the last leaf looks ahead.
    let at = 0;
    const draw = (): HTMLElement => {
      const leaf = leaves[at];
      if (!leaf) {
        // The last page looks forward: the open water, not the valley behind.
        return h('article', 'nb-journey-memory', null, [
          h('div', 'nb-memory-words', null, [caps('Ahead'), h('h3', null, null, ['The open sea']), h('p', null, null, [view.ending?.line ?? 'The river goes on, and so do we.'])]),
        ]);
      }
      if (leaf.kind === 'memory') {
        const entry = leaf.entry;
        const sentence = entry.text?.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? entry.text ?? '';
        return h('article', 'nb-journey-memory', null, [
          h('div', 'nb-memory-illustration', null, [sketchEl(entry.sketch, 100)]),
          h('div', 'nb-memory-words', null, [caps('Along the river'), h('h3', null, null, [entry.name ?? '']), h('p', null, null, [sentence])]),
        ]);
      }
      return h('article', 'nb-journey-memory is-collection', null, [
        h('div', 'nb-memory-illustration', null, leaf.sketches.map((id) => sketchEl(id, 45))),
        h('div', 'nb-memory-words', null, [caps('Kept in our journal'), h('h3', null, null, [leaf.name]), h('p', null, null, [leaf.complete ? leaf.came : `${listNames(leaf.names.map((name, i) => (i ? name.replace(/^The /, 'the ') : name)))}.`])]),
      ]);
    };
    const paint = (): void => {
      page.replaceChildren(draw());
      count.textContent = `${at + 1} / ${last + 1}`;
      back.disabled = at === 0;
      next.disabled = at === last;
    };
    const schedule = (hold = 0): void => {
      this.clock.start(() => (at < last ? go(1, false) : finish()), hold + (at < last ? JOURNEY_MEMORY_MS : JOURNEY_AHEAD_MS));
    };
    const go = (step: 1 | -1, byHand: boolean): void => {
      const to = at + step;
      if (to < 0 || to > last) return;
      curl.play(step > 0);
      at = to;
      paint();
      page.firstElementChild?.classList.add('is-turned');
      schedule(byHand ? JOURNEY_HOLD_MS : 0);
    };
    back.addEventListener('click', () => go(-1, true));
    next.addEventListener('click', () => go(1, true));
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault(); e.stopPropagation();
      go(e.key === 'ArrowLeft' ? -1 : 1, true);
    };
    let swipe: { x: number; y: number; id: number } | null = null;
    book.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') swipe = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
    book.addEventListener('pointerup', (e) => {
      if (!swipe || e.pointerId !== swipe.id) return;
      const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
      swipe = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1, true);
    });
    book.addEventListener('pointercancel', () => (swipe = null));
    globalThis.addEventListener('keydown', onKey, { capture: true });
    this.stopLeafing = () => { globalThis.removeEventListener('keydown', onKey, { capture: true }); curl.cancel(); this.stopLeafing = () => {}; };
    paint();
    schedule();
  }
  private stopLeafing: () => void = () => {};
  hide(): void { this.stopLeafing(); this.rolling?.cancel(); this.rolling = null; this.clock.stop(); this.el.classList.remove('is-shown'); this.el.replaceChildren(); }
}

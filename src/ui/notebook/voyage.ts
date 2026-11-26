import { GAME_CREDITS, INSPIRATIONS } from '../../game/credits';
/**
 * The end of the journey: choosing who sails when the boat is ready, and the
 * quiet ending card once the voyage is over.
 */

import type { AdventureView } from '../../game/adventure/model';
import { h } from '../dom';
import { portraitMarkup } from './portrait';
import { caps, friendToken, sketchEl, stampButton, wordButton } from './ink';
import { listNames } from './words';
import '../../styles/voyage-caption.css';

export interface VoyageHandlers {
  toggle(id: string): void;
  sail(): void;
}

/** A small framed section at the top of the leaf: who will sail, and "Gather at the boat". */
export function voyageChooser(view: AdventureView, chosen: Set<string>, handlers: VoyageHandlers): HTMLElement {
  const section = h('section', 'nb-voyage', { 'aria-label': 'The boat is ready' });
  section.append(
    h('header', null, null, [caps('The boat is ready'), h('p', 'nb-voyage-line', null, [view.mode === 'free' ? 'Who will sail to the sea? There is no hurry.' : 'Sora is ready. Who will go with him?'])]),
  );
  const row = h('div', 'nb-voyage-row', { role: 'group', 'aria-label': 'Who will sail' });
  for (const f of view.friends) {
    const required = view.mode !== 'free' && f.id === 'sora';
    const on = required || chosen.has(f.id);
    const b = h('button', `nb-voyager${on ? ' is-on' : ''}`, { type: 'button', 'aria-pressed': String(on) });
    b.dataset.k = `sail-${f.id}`;
    if (required) { b.disabled = true; b.title = 'Sora’s journey to the sea'; b.setAttribute('aria-label', 'Sora, aboard for his journey to the sea'); }
    b.append(friendToken(f, 30), h('span', null, null, [f.name]));
    b.addEventListener('click', () => handlers.toggle(f.id));
    row.append(b);
  }
  const gather = stampButton('Gather at the boat', handlers.sail, 'gather');
  const ready = view.friends.some(f => (view.mode !== 'free' && f.id === 'sora') || chosen.has(f.id));
  gather.disabled = !ready;
  gather.classList.toggle('is-ready', ready);
  section.append(row, h('div', 'nb-voyage-go', null, [gather]));
  return section;
}

/** The book's last page: who sailed, how long it took, what this journey's journal holds, and the way back. */
export function endingCard(view: AdventureView, onReturn: () => void, onBeginAgain: () => void, onCredits: () => void = () => {}): HTMLElement {
  const ending = view.ending;
  const names = ending?.sailed ?? [];
  const sailed = names.length ? `${listNames(names)} sailed out where the river meets the sea.` : 'The boat sailed out where the river meets the sea.';
  const days = ending ? `${capital(spelled(ending.days))} ${ending.days === 1 ? 'day' : 'days'} from the springs.` : '';
  // What this player's journal holds, drawn rather than counted: one sketch for each collection completed.
  const sets = view.sets.filter((s) => s.complete);
  const row = h('ul', 'nb-ending-sets', { 'aria-label': 'Collections completed' });
  for (const set of sets) {
    row.append(h('li', null, null, [sketchEl(set.sketch, 34), h('span', null, null, [set.name])]));
  }
  const found = view.journal.filter((e) => e.found).length;
  return h('section', 'nb-ending', { role: 'dialog', 'aria-label': 'The sea', 'aria-modal': 'false' }, [
    caps('Song of the River'),
    h('h2', 'nb-ending-title', null, ['The sea']),
    h('p', 'nb-ending-line', null, [sailed]),
    h('p', 'nb-ending-days', null, [days, ' ', `${capital(spelled(found))} ${found === 1 ? 'page' : 'pages'} of the journal filled.`]),
    sets.length ? row : h('span'),
    h('p', 'nb-ending-after', null, [ending?.line ?? 'The river goes on, and so do we.']),
    ...(ending?.notes ?? []).map((note) => h('p', 'nb-ending-after', null, [note])),
    h('div', 'nb-credits-window', { 'aria-label': 'Credits', tabindex: '0' }, [
      h('div', 'nb-credits-roll', null, [
        caps('Song of the River'),
        h('p', null, null, ['Sora · Ren · Mina · Haru · Aki · Yui']),
        caps('Illustrations'),
        h('p', null, null, [GAME_CREDITS.creator]),
        h('p', null, null, [`${GAME_CREDITS.art} · art`]),
        h('p', null, null, [`${GAME_CREDITS.development} · development assistance`]),
        caps('Music'),
        h('p', null, null, ['Suno · Gentle Discovery · Riverside Journey · Winter Felt']),
        h('p', null, null, [GAME_CREDITS.musicTerms]),
        caps('Sound & ambience'),
        h('p', null, null, ['Kenney and the public-domain recording community']),
        wordButton('Credits & sources', onCredits, 'nb-quiet'),
        caps('Made with'),
        h('p', null, null, ['PixiJS · TypeScript']),
        h('p', 'nb-ending-after', null, [`Code: ${GAME_CREDITS.codeTerms}. Project artwork and writing: ${GAME_CREDITS.assetTerms}. Separate music and third-party terms apply.`]),
        caps('Inspirations'),
        h('p', null, null, [INSPIRATIONS.map((game) => game.name).join(' · ')]),
        h('p', 'nb-ending-after', null, ['Thank you for following the river.']),
        h('p', 'nb-ending-after', null, [GAME_CREDITS.ratingRequest]),
      ]),
    ]),
    wordButton(view.creditsReplay ? 'Back to menu' : 'Return to the valley', onReturn, 'nb-ending-return', 'return'),
    view.creditsReplay ? null : wordButton('Begin again', onBeginAgain, 'nb-quiet nb-ending-again', 'again'),
  ]);
}

/** The quiet words on the voyage: the reach the boat is passing, and one pencilled line. */
export class VoyageCaption {
  readonly el = h('div', 'nb-voyage-caption', { 'aria-live': 'polite' });
  private readonly face=h('span','nb-voyage-speaker',{'aria-hidden':'true'});
  private readonly reach = h('p', 'nb-voyage-reach');
  private readonly line = h('p', 'nb-voyage-line');
  private shown = { reach: '', line: '' };
  readonly skip: HTMLButtonElement;
  /** A full-screen wash of paper that covers the voyage's one cut. */
  readonly cut = h('div', 'nb-voyage-cut', { 'aria-hidden': 'true' });

  constructor(onSkip: () => void) {
    this.skip = wordButton('Skip to the sea', onSkip, 'nb-quiet nb-scene-skip nb-voyage-skip', 'voyage-skip');
    this.skip.hidden = true;
    this.el.append(this.face, this.reach, this.line);
  }

  update(view: AdventureView): void {
    const caption = view.voyageCaption;
    const sailing = view.voyage === 'gathering' || view.voyage === 'sailing';
    // Mounted beside the caption, so its transform and changing words never
    // move or hide this control, including the quiet moments between replies.
    this.skip.hidden = !sailing;
    // A Wander sail is only a day out: skipping it brings everyone home.
    const skipLabel = view.mode === 'free' ? 'Skip home' : 'Skip to the sea';
    if (this.skip.textContent !== skipLabel) this.skip.textContent = skipLabel;
    this.cut.style.opacity = (view.voyageCut ?? 0).toFixed(3);
    if (!caption?.reach && !caption?.line) {
      // Nothing to say: the last words and the paper's shape stay just as they were while they fade, so no empty paper is left behind.
      this.el.classList.remove('is-on');
      return;
    }
    const speaker=caption?.line?.match(/^(Sora|Ren|Mina|Aki|Haru|Yui):/)?.[1];
    this.face.hidden=!speaker;
    if(speaker && this.face.dataset.speaker!==speaker) {this.face.dataset.speaker=speaker;this.face.innerHTML=portraitMarkup(speaker.toLowerCase(),32);}
    this.el.classList.toggle('has-speaker',!!speaker);
    this.el.classList.toggle('is-final-voyage', sailing);
    this.el.classList.add('is-on');
    this.set(this.reach, 'reach', caption?.reach ?? '');
    this.set(this.line, 'line', caption?.line ?? '');
  }

  /**
   * Words fade in and out rather than switching. A line that ends just as the
   * next begins is not faded out between them: the new words settle into the
   * same place, so nothing blinks.
   */
  private set(el: HTMLElement, key: 'reach' | 'line', text: string): void {
    if (!text) {
      this.shown[key]='';el.textContent='';
      el.classList.remove('is-shown');el.hidden=true;
      return;
    }
    el.hidden=false;
    if (this.shown[key] === text) return;
    const swap = !!this.shown[key] && el.classList.contains('is-shown');
    this.shown[key] = text;
    el.textContent = text;
    el.classList.add('is-shown');
    if (swap) { el.classList.remove('is-swapped'); void el.offsetWidth; el.classList.add('is-swapped'); }
  }

}

const ONES = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
/** "twenty-one": the ending reads its numbers aloud (past ninety-nine, figures). */
function spelled(n: number): string {
  if (n < 20) return ONES[n] ?? String(n);
  if (n > 99) return String(n);
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ''}`;
}
const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

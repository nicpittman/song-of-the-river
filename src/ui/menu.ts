/**
 * The title screen over the live valley: the lockup, a line of welcome, the
 * six friends and a few words to choose from, set straight on the landscape
 * over a feathered veil of mist; settings open in the same place.
 *
 * It is also the loading screen. While the art arrives the whole window is
 * ivory paper and the title's teal swash is drawn from left to right as
 * progress. When loading is done that paper lifts away to the valley: the
 * title never moves.
 */

import type { Settings } from '../game/core/save';
import type { MenuModel, UiActions } from './contract';
import { REVIEW_STAGES } from '../game/adventure/review';
import { REVIEW_TOOLS } from '../flags';
import { PEOPLE } from '../game/adventure/content';
import { h } from './dom';
import { TITLE_SWASH } from './icons';
import { placeMark, portrait, resourceMark, seasonMark, sketch } from './sketches';

type View = 'loading' | 'main' | 'settings' | 'hotkeys' | 'howto' | 'review';

/** The selection swash follows the word, independently of its larger hit target. */
const settingWord = (label: string): HTMLElement => h('span', 'setting-word', { 'data-label': label }, [label]);

/** How long the veil takes to rise before the game is built behind it (matches menu.css). */
const VEIL_UP_MS = 560;
/** How long it takes to lift off the morning, and when, during the lift, the notebook and season tab follow. */
const VEIL_LIFT_MS = 1500;
const ARRIVE_AFTER_MS = 550;

const wait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));
const frames = (n: number): Promise<void> =>
  new Promise((r) => {
    const step = (left: number): void => {
      if (left <= 0) r();
      else requestAnimationFrame(() => step(left - 1));
    };
    step(n);
  });


/** The title, set as the moodboard lockup: "Song" and "River" upright, "of the" small and italic, a swash beneath. */
export function titleLockup(tag: 'h1' | 'div' = 'h1'): HTMLElement {
  const title = h(tag, 'title');
  title.innerHTML = `<span>Song</span> <em>of the</em> <span>River</span>`;
  const swash = h('span', 'title-swash');
  swash.innerHTML = TITLE_SWASH;
  return h('div', 'lockup', null, [title, swash]);
}

export class Menu {
  readonly el: HTMLElement;
  private readonly card: HTMLElement;
  private readonly body: HTMLElement;
  private model: MenuModel | null = null;
  private settings: Settings = { music: 0.42, sfx: 0.5, reducedMotion: null };
  private view: View = 'main';
  /** The brush swash under the title; while loading it is revealed as progress. */
  readonly swash: HTMLElement;
  /** While loading: a quiet line under the title naming what is arriving. */
  readonly loadingNote = h('p', 'menu-loading-note', { 'aria-live': 'polite' });
  /** The warm mist that covers the valley while a game is being opened behind it. */
  private veil: HTMLElement | null = null;
  private launching = false;

  constructor(
    private readonly actions: UiActions,
    private readonly onMotion: (value: boolean | null) => void,
  ) {
    this.body = h('div', 'menu-body');
    const lockup = titleLockup();
    this.swash = lockup.querySelector('.title-swash') as HTMLElement;
    this.card = h('div', 'menu-card', null, [h('header', 'menu-head', null, [lockup, this.loadingNote]), this.body]);
    this.el = h('div', 'menu overlay', { role: 'dialog', 'aria-modal': 'false', 'aria-label': 'Song of the River' }, [
      h('div', 'menu-paper'),
      h('div', 'menu-inner', null, [this.card]),
    ]);
    this.el.addEventListener('click', (event) => {
      if ((event.target as Element).closest('button:not(:disabled)')) this.actions.cue('menu-click');
    }, true);
    this.el.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.view === 'hotkeys' || this.view === 'howto') { e.preventDefault(); e.stopPropagation(); this.go('settings'); }
      else if (this.view === 'settings') { e.preventDefault(); e.stopPropagation(); this.go('main'); }
      else if (this.view === 'main' && this.model?.canContinue) { e.preventDefault(); this.launch(this.model.continueLabel, () => this.actions.continueGame()); }
    });
  }

  /** Opens straight onto the loading state: the lockup on paper, no entries yet. */
  startLoading(model: MenuModel | null = null): void {
    this.view = 'loading';
    this.body.replaceChildren(this.mainView(model));
    this.el.dataset.view = 'loading';
    this.el.classList.add('is-open');
  }

  show(model: MenuModel): void {
    const wasOpen = this.el.classList.contains('is-open');
    const fromLoading = this.view === 'loading';
    this.model = model;
    this.settings = { ...model.settings };
    if (!wasOpen || fromLoading) this.view = 'main';
    if (model.settingsOpen) this.view = 'settings';
    this.render(!wasOpen && !fromLoading);
    this.el.classList.add('is-open');
  }

  hide(): void {
    this.el.classList.remove('is-open');
    if (this.el.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  }

  private go(view: View): void {
    this.view = view;
    this.render(true);
  }

  private render(focus: boolean): void {
    const m = this.model;
    if (!m || this.view === 'loading') return;
    const content = this.view === 'main' ? this.mainView(m) : REVIEW_TOOLS && this.view === 'review' ? this.reviewView() : this.view === 'hotkeys' ? this.hotkeysView() : this.view === 'howto' ? this.howToView() : this.settingsView();
    content.classList.add('view');
    this.body.replaceChildren(content);
    this.el.dataset.view = this.view;
    if (focus) {
      requestAnimationFrame(() => {
        const first = this.body.querySelector('button:not([disabled]), input') as HTMLElement | null;
        first?.focus({ preventScroll: true });
      });
    }
  }

  /**
   * The four entries. While loading (no model yet) the same words are laid out
   * but hidden, so the card already has its final size and the title its final place.
   */
  private reviewButton(label:string, action:()=>void): HTMLButtonElement { const b=h('button','sr-word',{type:'button'},[label]); b.addEventListener('click',action); return b; }

  private reviewEntry(): HTMLButtonElement {
    const button=this.reviewButton('Review',()=>this.go('review'));
    button.classList.add('menu-review-entry');
    const mark=h('span',null,{'aria-hidden':'true'});
    mark.innerHTML='<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="10" cy="10" r="7.5"/><path d="m13 6-2 5-4 3 2-5 4-3Z"/></svg>';
    button.prepend(mark); return button;
  }

  private reviewView(): HTMLElement {
    const panel = h('section','settings review-menu', null, [h('h2',null,null,['Review the journey']), h('p',null,null,['Disposable scenes. Saved journeys stay untouched.'])]);
    for (const [id,label] of REVIEW_STAGES) panel.append(this.reviewButton(label, () => this.launch(label, () => this.actions.reviewStage?.(id))));
    panel.append(this.reviewButton('Back',()=>this.go('main')));
    return panel;
  }

  private mainView(m: MenuModel | null): HTMLElement {
    const entry = (label: string, onClick: () => void, sub?: string): HTMLButtonElement => {
      // The label carries its own text as data so a hidden bold copy can reserve its width.
      const b = h('button', 'entry', { type: 'button' }, [
        h('span', 'entry-label', { 'data-label': label }, [label]),
        sub ? h('span', 'entry-sub', null, [sub]) : null,
      ]);
      if (label==='Journey' || label==='Wander' || label==='Journey complete') {
        b.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse' && this.model && !this.launching) this.actions.cue('menu-hover');});
        b.addEventListener('focus',()=>{if(this.model && !this.launching) this.actions.cue('menu-hover');});
      }
      b.addEventListener('click', onClick);
      return b;
    };
    const journey = (): void => {
      if (!m) return;
      if (m.journeyComplete) { this.actions.openJournal(); return; }
      const where = m.journeyLabel ?? 'Seseragi, spring';
      if (!m.hasJourney) this.launch(where, () => this.actions.startJourney('river-adventure'));
      else if (this.actions.resumeJourney) this.launch(where, () => this.actions.resumeJourney!());
      else this.launch(where, () => this.actions.continueGame());
    };
    const freePlay = (): void => this.launch(m?.wanderLabel ?? 'Mio, with Haru and Yui', () => this.actions.startFreePlay('river-adventure'));
    const entries = [
      entry(m?.journeyComplete ? 'Journey complete' : 'Journey', journey, m?.journeyComplete ? 'Remember our journey' : m?.journeyLabel),
      m?.wanderOpen ? entry('Wander', freePlay, m.wanderLabel ?? 'The river, at your own pace') : null,
      entry('Credits', () => this.actions.openCredits?.()),
      entry('Settings', () => this.go('settings')),
    ].filter((e): e is HTMLButtonElement => e !== null);
    entries.forEach((e, i) => e.style.setProperty('--i', String(i)));
    return h('div', 'menu-main', null, [this.friendsRow(), h('nav', 'entries', { 'aria-label': 'Main menu' }, [h('hr', 'sr-rule is-short'), ...entries, ...(REVIEW_TOOLS && this.actions.reviewStage ? [this.reviewEntry()] : [])])]);
  }

  /**
   * Starts a game softly. Within a frame of the press the words ease away and
   * a warm mist rises over the valley; only once it is fully up is the game
   * built behind it (the heavy, blocking part), and then the mist lifts slowly
   * onto the morning, the valley first and the notebook after it. The time
   * the start takes is recorded as the performance measure `sr-start`.
   */
  private launch(where: string, start: () => void): void {
    if (this.launching) return;
    this.launching = true;
    const root = this.el.parentElement;
    const reduced = root?.classList.contains('is-reduced') ?? false;
    const veil = this.ensureVeil(where);
    this.el.classList.add('is-leaving');
    root?.classList.add('is-arriving');
    veil.classList.remove('is-lifting');
    void veil.offsetWidth;
    veil.classList.add('is-up');
    void wait(reduced ? 220 : VEIL_UP_MS)
      .then(() => frames(2))
      .then(() => {
        performance.mark('sr-start-begin');
        start();
        performance.mark('sr-start-end');
        performance.measure('sr-start', 'sr-start-begin', 'sr-start-end');
        // Let the new valley paint once under the mist before it lifts.
        return frames(3);
      })
      .then(() => this.lift(veil, reduced));
  }

  private lift(veil: HTMLElement, reduced: boolean): void {
    const root = this.el.parentElement;
    veil.classList.add('is-lifting');
    veil.classList.remove('is-up');
    window.setTimeout(() => {
      root?.classList.remove('is-arriving');
      root?.classList.add('is-arrived');
      window.setTimeout(() => root?.classList.remove('is-arrived'), 1000);
    }, reduced ? 0 : ARRIVE_AFTER_MS);
    window.setTimeout(() => {
      veil.classList.remove('is-lifting');
      this.el.classList.remove('is-leaving');
      this.launching = false;
    }, reduced ? 320 : VEIL_LIFT_MS);
  }

  /** The veil sits just after the menu in the interface, so it stays when the menu itself goes. */
  private ensureVeil(where: string): HTMLElement {
    if (!this.veil) {
      const veil = h('div', 'start-veil', { 'aria-hidden': 'true' });
      veil.addEventListener('pointerdown', (e) => {
        const ring = h('span', 'river-ring');
        ring.style.left = `${e.clientX}px`;
        ring.style.top = `${e.clientY}px`;
        veil.append(ring);
        window.setTimeout(() => ring.remove(), 1400);
      });
      this.veil = veil;
      this.el.after(veil);
    }
    // The title's swash, drawn in by a sliding window as the veil rises (index.html
    // styles .river-line; it moves by transforms only, so it keeps its pace while the
    // game is built), then breathing slowly. A tap leaves a ring.
    this.veil.innerHTML =
      `<div class="start-veil-line">${seasonMark(0, 22)}<span>${where.replace(/[<&]/g, '')}</span></div>` +
      `<div class="river-line" style="--p:0"><div class="river-line-window"><div class="river-line-ink">${TITLE_SWASH}</div></div></div>`;
    const line = this.veil.querySelector('.river-line') as HTMLElement;
    requestAnimationFrame(() => requestAnimationFrame(() => line.style.setProperty('--p', '1')));
    return this.veil;
  }

  /** The little people the tagline speaks of: the six friends, painted, in a quiet row. */
  private friendsRow(): HTMLElement {
    const row = h('ul', 'menu-friends', { 'aria-label': PEOPLE.map((p) => p.name).join(', ') });
    for (const p of PEOPLE) {
      const li = h('li', null, { title: `${p.name}, ${p.role.toLowerCase()}` });
      li.innerHTML = portrait(p.id, { size: 46 });
      row.append(li);
    }
    return row;
  }

  private settingsView(): HTMLElement {
    const s = this.settings;
    const slider = (label: string, value: number, set: (v: number) => void): HTMLElement => {
      const id = `sr-${label.toLowerCase()}`;
      const input = h('input', 'sr-slider', { type: 'range', id, min: '0', max: '100', step: '1' });
      input.value = String(Math.round(value * 100));
      input.style.setProperty('--v', `${input.value}%`);
      input.addEventListener('input', () => {
        input.style.setProperty('--v', `${input.value}%`);
        set(Number(input.value) / 100);
        this.actions.setVolumes(this.settings.music, this.settings.sfx);
      });
      return h('div', 'sr-row setting', null, [h('label', 'setting-label', { for: id }, [label]), input]);
    };

    const motionOpts: Array<[string, boolean | null]> = [['System', null], ['On', true], ['Off', false]];
    const toggle = h('div', 'sr-toggle', { role: 'radiogroup', 'aria-labelledby': 'sr-motion-label' });
    const paintToggle = (): void => {
      Array.from(toggle.children).forEach((b, i) => {
        const on = motionOpts[i][1] === this.settings.reducedMotion;
        b.setAttribute('aria-checked', String(on));
        b.setAttribute('tabindex', on ? '0' : '-1');
      });
    };
    for (const [label, value] of motionOpts) {
      const b = h('button', null, { type: 'button', role: 'radio' }, [settingWord(label)]);
      b.addEventListener('click', () => {
        this.settings.reducedMotion = value;
        paintToggle();
        this.onMotion(value);
        this.actions.setReducedMotion(value);
      });
      toggle.append(b);
    }
    // Arrow keys move between the choices, as in any radio group.
    toggle.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const kids = Array.from(toggle.children) as HTMLButtonElement[];
      const at = kids.indexOf(document.activeElement as HTMLButtonElement);
      const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
      const next = kids[(at + step + kids.length) % kids.length];
      next.focus();
      next.click();
    });
    paintToggle();

    const reset = h('div', 'reset');
    let chosen: 'journey' | 'free' | 'all' = 'journey';
    const scope = h('div', 'sr-toggle sr-clear-scope', { role: 'radiogroup', 'aria-label': 'Which progress to clear' });
    for (const [value, label] of [['journey', 'Journey'], ['free', 'Wander'], ['all', 'Both']] as const) {
      const choice = h('button', null, { type: 'button', role: 'radio', 'aria-checked': String(value === chosen), tabindex: value === chosen ? '0' : '-1' }, [settingWord(label)]);
      choice.addEventListener('click', () => {
        chosen = value;
        for (const item of Array.from(scope.children)) { item.setAttribute('aria-checked', String(item === choice)); item.setAttribute('tabindex', item === choice ? '0' : '-1'); }
      });
      scope.append(choice);
    }
    scope.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const choices = Array.from(scope.children) as HTMLButtonElement[];
      const at = choices.indexOf(document.activeElement as HTMLButtonElement);
      const next = choices[(at + (event.key === 'ArrowLeft' ? choices.length - 1 : 1)) % choices.length];
      next.focus(); next.click();
    });
    const askReset = (): void => {
      const name = chosen === 'all' ? 'both saved games' : chosen === 'free' ? 'Wander' : 'Journey';
      const keep = h('button', 'sr-word', { type: 'button' }, [settingWord('Keep it')]);
      const yes = h('button', 'sr-word is-primary is-danger', { type: 'button' }, [settingWord('Start over')]);
      keep.addEventListener('click', () => {
        idleReset();
        (reset.firstElementChild as HTMLElement | null)?.focus();
      });
      yes.addEventListener('click', () => {
        this.actions.resetProgress(chosen);
        this.go('main');
      });
      reset.replaceChildren(h('p', 'reset-note', null, [`Clear ${name}?`]), h('div', 'reset-row', null, [keep, yes]));
      keep.focus();
    };
    const idleReset = (): void => {
      const b = h('button', 'sr-word is-danger', { type: 'button' }, [settingWord('Start over…')]);
      b.addEventListener('click', askReset);
      reset.replaceChildren(scope, b);
    };
    idleReset();

    const howto = h('button', 'sr-word sr-howto', { type: 'button' }, [settingWord('How to play')]);
    howto.addEventListener('click', () => this.go('howto'));
    const hotkeys = h('button', 'sr-word sr-hotkeys', { type: 'button' }, [settingWord('Hotkeys')]);
    hotkeys.addEventListener('click', () => this.go('hotkeys'));
    const back = h('button', 'sr-word back', { type: 'button' }, [settingWord('Back')]);
    back.addEventListener('click', () => this.go('main'));

    return h('section', 'settings', { 'aria-labelledby': 'sr-settings-title' }, [
      h('hr', 'sr-rule is-short'),
      h('h2', 'sr-caps view-title', { id: 'sr-settings-title' }, ['Settings']),
      h('div', 'setting-list', null, [
        slider('Music', s.music, (v) => (this.settings.music = v)),
        slider('Sound', s.sfx, (v) => (this.settings.sfx = v)),
        h('div', 'sr-row setting', null, [h('span', 'setting-label', { id: 'sr-motion-label' }, ['Reduced motion']), toggle]),
        h('div', 'sr-row setting setting-reset', null, [h('span', 'setting-label', null, ['Progress']), reset]),
      ]),
      h('nav', 'settings-nav', { 'aria-label': 'Settings navigation' }, [howto, hotkeys, back]),
    ]);
  }

  /**
   * How to play: the day's loop in five short steps, each beside a small piece
   * of the game's own ink (a place on the map, a note on the way, the stores,
   * the morning stamp, the friends), not a screenshot.
   */
  private howToView(): HTMLElement {
    const svg = (markup: string, cls = ''): HTMLElement => { const el = h('span', `howto-ink ${cls}`.trim(), { 'aria-hidden': 'true' }); el.innerHTML = markup; return el; };
    const faces = (ids: readonly string[], size: number): HTMLElement => {
      const row = h('span', 'howto-faces', { 'aria-hidden': 'true' });
      for (const id of ids) { const li = h('span'); li.innerHTML = portrait(id, { size }); row.append(li); }
      return row;
    };
    const step = (title: string, text: string, visual: HTMLElement): HTMLElement =>
      h('li', 'howto-step', null, [h('div', 'howto-visual', null, [visual]), h('div', 'howto-words', null, [h('h3', null, null, [title]), h('p', null, null, [text])])]);
    const place = h('span', 'howto-place', null, [svg(placeMark('open', 22)), h('em', null, null, ['Kamimori']), faces(['ren'], 26)]);
    const note = h('span', 'howto-note', null, [svg(sketch('any-parcel', { found: true, size: 22 })), h('span', null, null, ['Something small shines.', h('small', null, null, [' tap to look'])])]);
    const stores = h('span', 'howto-stores', null, [svg(resourceMark('provisions', 22)), h('b', null, null, ['25']), svg(resourceMark('materials', 22)), h('b', null, null, ['30'])]);
    const stamp = h('span', 'howto-stamp', null, ['Next morning']);
    const back = h('button', 'sr-word back', { type: 'button' }, [settingWord('Back to settings')]);
    back.addEventListener('click', () => this.go('settings'));
    return h('section', 'settings howto', { 'aria-labelledby': 'sr-howto-title' }, [
      h('h2', 'sr-caps view-title', { id: 'sr-howto-title' }, ['How to play']),
      h('ol', 'howto-steps', null, [
        step('Plan the morning', 'Open the notebook, tap a place on the river map, and choose who goes there.', place),
        step('Watch the day', 'Companions walk out on their own. Tap the little notes that appear along the way.', note),
        step('Unpack at the fire', 'Provisions feed everyone at supper. Materials build bridges, cottages and the boat.', stores),
        step('Turn the page', 'When you have read the evening, go on to the next morning.', stamp),
        step('Follow the river down', 'Meet companions, move camp, and mend Grandfather’s boat to reach the sea. Notice everything.', faces(PEOPLE.map((p) => p.id), 24)),
      ]),
      h('p', 'howto-after', null, ['Wander, a quieter way to roam the whole river, opens once your Journey reaches Mio, or after its first year.']),
      back,
    ]);
  }

  private hotkeysView(): HTMLElement {
    const keys = [
      ['1–6', 'Choose a traveller while planning'], ['E', 'Confirm the current plan, begin the day, or go to next morning'],
      ['R', 'Keep the selected traveller at camp'], ['J / B', 'Open the notebook / building page'],
      ['Space', 'Pause or resume the day'], ['W / S · ↑ / ↓', 'Scroll the notebook map'],
      ['Esc', 'Close the current choice or menu'], ['Drag · wheel', 'Pan the landscape · zoom'],
    ];
    const back = h('button', 'sr-word back', { type: 'button' }, [settingWord('Back to settings')]);
    back.addEventListener('click', () => this.go('settings'));
    return h('section', 'settings', { 'aria-labelledby': 'sr-hotkeys-title' }, [
      h('h2', 'sr-caps view-title', { id: 'sr-hotkeys-title' }, ['Hotkeys']),
      h('dl', 'hotkey-list', null, keys.flatMap(([key, meaning]) => [h('dt', null, null, [key]), h('dd', null, null, [meaning])])), back,
    ]);
  }
}

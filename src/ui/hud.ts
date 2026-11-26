/**
 * The free-play valley interface: the valley's name, time controls, wish
 * cards, brushstrokes, edit tools and the selection chip, each on its own
 * small sheet of paper with words for buttons. `update` is called every
 * frame, so each part keeps a copy of what it last drew and only writes to
 * the DOM when that changes.
 */

import type { HudState, ObjectiveView, SelectionView, UiActions } from './contract';
import { SeasonClock } from './clock';
import { SEASON_NAMES, button, h } from './dom';
import { ICONS, traveller } from './icons';
import { MarksChip } from './marks';
import { seasonMark } from './sketches';

const SEASON_WASHES = ['blossom', 'leaf', 'straw', 'river'] as const;

const COMPACT = '(max-width: 760px), (max-height: 500px)';
const MOVE_MS = 420;
const LEAVE_MS = 420;

interface ObjCache {
  upcoming: boolean;
  title: string;
  text: string;
  traveller: string;
  season: number;
  progress: number;
  count: number;
  done: boolean;
  note: string | null;
}

class ObjectiveCard {
  readonly el: HTMLButtonElement;
  private readonly icon: HTMLElement;
  private readonly dot: HTMLElement;
  private readonly title: HTMLElement;
  private readonly text: HTMLElement;
  private readonly note: HTMLElement;
  private readonly pips: HTMLElement;
  private readonly when: HTMLElement;
  private readonly whenText: Text;
  private cache: ObjCache | null = null;
  private celebrateTimer = 0;

  constructor(readonly id: string, onTap: (card: ObjectiveCard) => void) {
    this.icon = h('span', 'obj-icon');
    this.dot = h('span', 'obj-dot');
    this.title = h('span', 'obj-title');
    this.text = h('span', 'obj-text');
    this.note = h('span', 'obj-note');
    this.pips = h('span', 'obj-pips');
    this.whenText = document.createTextNode('');
    this.when = h('span', 'obj-when', null, [h('span', 'obj-when-dot'), this.whenText]);
    const check = h('span', 'obj-check');
    check.innerHTML = ICONS.check;
    this.el = h('button', 'obj', { type: 'button' }, [
      h('span', 'obj-figure', null, [this.icon, this.dot]),
      h('span', 'obj-main', null, [h('span', 'obj-detail', null, [this.when, this.title, this.text, this.note]), this.pips]),
      check,
    ]);
    this.el.addEventListener('click', () => onTap(this));
  }

  set(o: ObjectiveView): void {
    const c = this.cache;
    if (!c || c.traveller !== o.traveller) this.icon.innerHTML = traveller(o.traveller);
    if (!c || c.title !== o.title) this.title.textContent = o.title;
    if (!c || c.text !== o.text) this.text.textContent = o.text;
    if (!c || c.note !== o.note) {
      this.note.textContent = o.note ?? '';
      this.el.classList.toggle('has-note', !!o.note);
    }
    if (!c || c.season !== o.season) {
      this.dot.style.background = `var(--wash-${SEASON_WASHES[o.season]})`;
      this.whenText.data = `in ${SEASON_NAMES[o.season]}`;
    }
    if (!c || c.upcoming !== o.upcoming) this.el.classList.toggle('is-upcoming', o.upcoming);
    if (!c || c.count !== o.count) this.buildPips(o.count);
    if (!c || c.count !== o.count || c.progress !== o.progress) this.fillPips(o.progress, o.count);
    if (!c || c.done !== o.done) this.el.classList.toggle('is-done', o.done);
    if (!c || c.title !== o.title || c.progress !== o.progress || c.count !== o.count || c.done !== o.done || c.season !== o.season || c.upcoming !== o.upcoming) {
      const state = o.done ? 'granted' : o.upcoming ? `coming in ${SEASON_NAMES[o.season]}` : `${Math.min(o.progress, o.count)} of ${o.count}`;
      this.el.setAttribute('aria-label', `${o.title}. ${o.text} ${o.upcoming ? '' : `${SEASON_NAMES[o.season]}. `}${state}. Show in the valley.`);
    }
    this.cache = { upcoming: o.upcoming, title: o.title, text: o.text, traveller: o.traveller, season: o.season, progress: o.progress, count: o.count, done: o.done, note: o.note };
  }

  private buildPips(count: number): void {
    this.pips.textContent = '';
    this.pips.classList.toggle('is-bar', count > 10);
    if (count > 10) {
      this.pips.append(h('span', 'obj-bar'));
      return;
    }
    for (let i = 0; i < count; i++) this.pips.append(h('span', 'pip'));
  }

  private fillPips(progress: number, count: number): void {
    if (count > 10) {
      (this.pips.firstElementChild as HTMLElement).style.setProperty('--p', String(Math.min(1, progress / Math.max(1, count))));
      return;
    }
    const kids = this.pips.children;
    for (let i = 0; i < kids.length; i++) kids[i].classList.toggle('is-on', i < progress);
  }

  celebrate(): void {
    this.el.classList.remove('is-celebrating');
    void this.el.offsetWidth;
    this.el.classList.add('is-celebrating');
    clearTimeout(this.celebrateTimer);
    this.celebrateTimer = window.setTimeout(() => this.el.classList.remove('is-celebrating'), 1800);
  }
}

export class Hud {
  readonly el: HTMLElement;
  readonly clock = new SeasonClock();
  private readonly compact = window.matchMedia(COMPACT);

  private readonly valley: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly tally: HTMLElement;
  private readonly pauseBtn: HTMLButtonElement;
  private readonly speedBtn: HTMLButtonElement;
  private readonly objList: HTMLElement;
  private readonly nowList: HTMLElement;
  private readonly soonList: HTMLElement;
  /** The season's brushstrokes. */
  readonly marks = new MarksChip();
  private spentOnce = false;
  private readonly undoBtn: HTMLButtonElement;
  private readonly redoBtn: HTMLButtonElement;
  private readonly placesBtn: HTMLButtonElement;
  private readonly routesBtn: HTMLButtonElement;
  private readonly selection: HTMLElement;
  private readonly selTitle: HTMLElement;
  private readonly selDetail: HTMLElement;
  private readonly selRemove: HTMLButtonElement;
  private readonly identities: HTMLDetailsElement;
  private readonly identityChoices: HTMLElement;
  private readonly identityPreview: HTMLElement;
  private identityKey = '';

  private readonly cards = new Map<string, ObjectiveCard>();
  private orderKey = '';
  private open: ObjectiveCard | null = null;
  private last = {
    valley: '\0', subtitle: '\0', paused: null as boolean | null, speed: 0, marks: -2 as number | null, marksCap: -1,
    canUndo: null as boolean | null, canRedo: null as boolean | null, mode: '', granted: -1, total: -1,
  };
  private speed: 1 | 2 | 4 = 1;
  private selKey = '';

  constructor(private readonly actions: UiActions) {
    // Top left: menu and the valley's name.
    this.valley = h('span', 'valley-name');
    this.subtitle = h('span', 'valley-sub');
    this.tally = h('span', 'tally', { role: 'img' });
    const menuBtn = button('sr-word', 'Menu', 'Menu', () => actions.openMenu());
    const journalBtn = button('sr-word', 'Journal', 'Journal', () => actions.openJournal());
    const tl = h('div', 'hud-tl', null, [h('div', 'hud-sheet sheet-valley sr-slip', null, [
      h('span', 'valley', null, [h('span', 'valley-line', null, [this.valley, this.tally]), this.subtitle]),
      h('span', 'hud-words', null, [menuBtn, journalBtn]),
    ])]);

    // Top right: time.
    this.pauseBtn = button('sr-word btn-pause', 'Pause', 'Pause', () => actions.togglePause());
    this.speedBtn = button('sr-word btn-speed', 'Speed', '1×', () => {
      const next = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
      actions.setSpeed(next);
    });
    const skipBtn = button('sr-word', 'Skip to the next season', 'Next season', () => actions.skipSeason());
    const tr = h('div', 'hud-tr', null, [h('div', 'hud-sheet hud-words sr-slip', { role: 'group', 'aria-label': 'Time' }, [this.pauseBtn, this.speedBtn, skipBtn])]);

    // Bottom left: journeys.
    // This season's wishes, then the coming season's: two groups so that phones can give the second its own short row.
    this.nowList = h('div', 'obj-group obj-now', { role: 'list', 'aria-label': 'This season' });
    this.soonList = h('div', 'obj-group obj-soon', { role: 'list', 'aria-label': 'Coming next' });
    this.objList = h('div', 'objectives', null, [this.nowList, this.soonList]);
    const opportunities = h('details', 'seasonal-opportunities hud-sheet sr-slip', null, [h('summary', 'sr-caps', null, ['Seasonal life']), this.objList]);
    const bl = h('div', 'hud-bl', null, [opportunities]);

    // Bottom right: marks and edit tools.
    this.undoBtn = button('sr-word', 'Undo', 'Undo', () => actions.undo());
    this.redoBtn = button('sr-word', 'Redo', 'Redo', () => actions.redo());
    const fitBtn = button('sr-word', 'Show the whole valley', 'Whole valley', () => actions.fitView());
    this.placesBtn = button('sr-word btn-places', 'Show named places', 'Places', () => actions.showPlaces());
    this.placesBtn.title = 'Show or hide named places (P)';
    this.routesBtn = button('sr-word btn-routes', 'Show current connections', 'Routes', () => actions.toggleRoutes());
    this.routesBtn.title = 'Show or hide current connections (C)';
    const br = h('div', 'hud-br', null, [
      h('div', 'hud-sheet sheet-tools sr-slip', null, [
        this.marks.el,
        h('div', 'hud-words', { role: 'group', 'aria-label': 'Edit' }, [this.placesBtn, this.routesBtn, this.undoBtn, this.redoBtn, fitBtn]),
      ]),
    ]);

    // Bottom centre: what is selected.
    this.selTitle = h('span', 'sel-title');
    this.selDetail = h('span', 'sel-detail');
    this.selRemove = button('sr-word is-danger sel-remove', 'Remove this path', 'Remove', () => actions.removeSelected());
    this.identityChoices = h('div', 'identity-choices sr-toggle');
    this.identityPreview = h('div', 'identity-preview');
    this.identities = h('details', 'identity-editor', null, [h('summary', 'sr-caps', null, ['Shape this place']), this.identityChoices, this.identityPreview]);
    this.selection = h('div', 'selection sr-slip sr-transient', { role: 'status', 'aria-live': 'polite' }, [
      h('div', 'chip-sel', null, [h('span', 'sel-dot'), h('span', 'sel-text', null, [this.selTitle, this.selDetail]), this.selRemove]),
      this.identities,
    ]);

    this.el = h('div', 'hud', null, [this.clock.el, tl, tr, bl, br, this.selection]);

    // Tapping anywhere outside an expanded journey chip folds it away.
    document.addEventListener('pointerdown', (e) => {
      if (this.open && !this.open.el.contains(e.target as Node)) this.setOpen(null);
    }, true);
    this.compact.addEventListener('change', () => this.setOpen(null));
  }

  update(s: HudState): void {
    const L = this.last;
    const guides = String(s.placesVisible);
    if (this.placesBtn.getAttribute('aria-pressed') !== guides) this.placesBtn.setAttribute('aria-pressed', guides);
    const routes = String(s.routesVisible);
    if (this.routesBtn.getAttribute('aria-pressed') !== routes) this.routesBtn.setAttribute('aria-pressed', routes);
    this.clock.setLabel(s.season, s.year, s.mode === 'journey' ? s.years : null);
    this.clock.setProgress(s.yearProgress);

    if (s.valley !== L.valley) this.valley.textContent = L.valley = s.valley;
    if (s.subtitle !== L.subtitle) this.subtitle.textContent = L.subtitle = s.subtitle;
    if (s.mode !== L.mode) this.el.dataset.mode = L.mode = s.mode;

    if (s.paused !== L.paused) {
      L.paused = s.paused;
      this.pauseBtn.textContent = s.paused ? 'Play' : 'Pause';
      this.pauseBtn.setAttribute('aria-label', s.paused ? 'Play' : 'Pause');
      this.el.classList.toggle('is-paused', s.paused);
    }
    if (s.speed !== L.speed) {
      L.speed = this.speed = s.speed;
      this.speedBtn.textContent = `${s.speed}×`;
      this.speedBtn.setAttribute('aria-label', `Speed ${s.speed} times. Change speed`);
    }
    if (s.marks !== L.marks || s.marksCap !== L.marksCap) {
      // The first stroke ever spent gets a single pulse so the eye finds the marks.
      if (!this.spentOnce && L.marks !== -2 && L.marks !== null && s.marks !== null && s.marks < L.marks && s.marksCap === L.marksCap) {
        this.spentOnce = true;
        this.marks.pulse();
      }
      L.marks = s.marks;
      L.marksCap = s.marksCap;
      this.marks.set(s.marks, s.marksCap);
    }
    if (s.canUndo !== L.canUndo) this.undoBtn.disabled = !(L.canUndo = s.canUndo);
    if (s.canRedo !== L.canRedo) this.redoBtn.disabled = !(L.canRedo = s.canRedo);
    if (s.wishesGranted !== L.granted || s.wishesTotal !== L.total) this.drawTally(s.wishesGranted, s.wishesTotal);

    this.updateObjectives(s.objectives);
  }

  /** A row of small blossoms: one per wish, filled once granted. */
  private drawTally(granted: number, total: number): void {
    const L = this.last;
    if (total !== L.total) {
      this.tally.textContent = '';
      for (let i = 0; i < total; i++) {
        const g = h('span', 'tally-glyph');
        g.innerHTML = seasonMark(0, 14);
        this.tally.append(g);
      }
    }
    L.granted = granted;
    L.total = total;
    this.tally.hidden = total <= 0;
    const kids = this.tally.children;
    for (let i = 0; i < kids.length; i++) {
      kids[i].classList.toggle('is-on', i < granted);
      kids[i].classList.toggle('is-bare', i >= granted);
    }
    const label = `${Math.min(granted, total)} of ${total} wishes granted`;
    this.tally.setAttribute('aria-label', label);
    this.tally.title = label;
  }

  /**
   * Cards are matched by id: persisting cards keep their element and glide to
   * their new place, new ones fade in, and departing ones fade out where they stood.
   */
  private updateObjectives(list: ObjectiveView[]): void {
    let key = '';
    for (const o of list) key += `${o.id}${o.upcoming ? '~' : ''}|`;
    if (key !== this.orderKey) {
      const first = this.orderKey === '';
      this.orderKey = key;
      const animate = !first && this.hudVisible() && !this.el.closest('.is-reduced');
      const before = new Map<ObjectiveCard, DOMRect>();
      if (animate) for (const card of this.cards.values()) before.set(card, card.el.getBoundingClientRect());

      const keep = new Set(list.map((o) => o.id));
      for (const [id, card] of this.cards) {
        if (keep.has(id)) continue;
        this.cards.delete(id);
        if (animate) this.leave(card);
        else card.el.remove();
      }
      const added: ObjectiveCard[] = [];
      for (const o of list) {
        let card = this.cards.get(o.id);
        if (!card) {
          card = new ObjectiveCard(o.id, (c) => this.tap(c));
          card.el.setAttribute('role', 'listitem');
          this.cards.set(o.id, card);
          added.push(card);
        }
        card.set(o);
        (o.upcoming ? this.soonList : this.nowList).append(card.el);
      }
      // Departing ghosts stay last so they never push a live card about.
      for (const ghost of Array.from(this.objList.querySelectorAll('.obj.is-leaving'))) this.objList.append(ghost);
      if (this.open && !keep.has(this.open.id)) this.open = null;

      if (animate) {
        for (const card of added) {
          const rest = getComputedStyle(card.el).opacity;
          card.el.animate([{ opacity: 0, transform: 'translateY(8px) scale(0.97)' }, { opacity: rest, transform: 'none' }], { duration: 520, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)', delay: 120, fill: 'backwards' });
        }
        for (const [card, r0] of before) {
          if (!this.cards.has(card.id)) continue;
          const r1 = card.el.getBoundingClientRect();
          const dx = r0.left - r1.left;
          const dy = r0.top - r1.top;
          if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
          card.el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: MOVE_MS, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' });
        }
      }
      return;
    }
    for (const o of list) this.cards.get(o.id)!.set(o);
  }

  private hudVisible(): boolean {
    return getComputedStyle(this.el).visibility !== 'hidden';
  }

  /** Lifts a departing card out of the flow and lets it fade where it stood. */
  private leave(card: ObjectiveCard): void {
    const el = card.el;
    const box = el.getBoundingClientRect();
    const host = this.objList.getBoundingClientRect();
    el.classList.remove('is-open');
    el.classList.add('is-leaving');
    el.setAttribute('aria-hidden', 'true');
    el.tabIndex = -1;
    Object.assign(el.style, { position: 'absolute', left: `${box.left - host.left}px`, top: 'auto', bottom: `${host.bottom - box.bottom}px`, width: `${box.width}px`, height: `${box.height}px`, margin: '0' });
    const a = el.animate([{ opacity: getComputedStyle(el).opacity, transform: 'none' }, { opacity: 0, transform: 'translateY(4px) scale(0.97)' }], { duration: LEAVE_MS, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)', fill: 'forwards' });
    a.onfinish = () => el.remove();
  }

  private tap(card: ObjectiveCard): void {
    this.setOpen(this.open === card ? null : card);
    this.actions.reviewObjective(card.id);
  }

  private setOpen(card: ObjectiveCard | null): void {
    if (this.open) {
      this.open.el.classList.remove('is-open');
      this.open.el.setAttribute('aria-expanded', 'false');
    }
    this.open = card;
    if (!card) return;
    // The popover is anchored above the whole row of wishes, not the card itself.
    const el = card.el;
    el.style.setProperty('--x', `${el.offsetLeft}px`);
    el.style.setProperty('--up', `${el.offsetTop + el.offsetHeight}px`);
    el.classList.add('is-open');
    el.setAttribute('aria-expanded', 'true');
  }

  celebrate(id: string): void {
    this.cards.get(id)?.celebrate();
  }

  setSelection(sel: SelectionView | null): void {
    if (!sel) {
      this.selKey = '';
      this.selection.classList.remove('is-shown');
      this.identities.open=false;
      return;
    }
    const key = `${sel.title}\0${sel.detail}\0${sel.tone}\0${sel.removable}`;
    if (key !== this.selKey) {
      this.selKey = key;
      this.selTitle.textContent = sel.title;
      this.selDetail.textContent = sel.detail;
      this.selDetail.hidden = !sel.detail;
      this.selection.dataset.tone = sel.tone;
      this.selRemove.hidden = !sel.removable;
    }
    this.selection.classList.add('is-shown');
    const identityKey = JSON.stringify(sel.identity ?? null);
    if (identityKey !== this.identityKey) {
      this.identityKey = identityKey;
      this.drawIdentity(sel.identity);
    }
  }

  /** The "Shape this place" fold: a few named characters for a place, one chosen at a time, then confirmed. */
  private drawIdentity(model: SelectionView['identity']): void {
    this.identities.hidden = !model;
    this.identityChoices.replaceChildren();
    this.identityPreview.replaceChildren();
    if (!model) return;
    for (const choice of model.choices) {
      const b = button('identity-choice', choice.title, choice.title, () => {
        for (const child of this.identityChoices.children) child.setAttribute('aria-checked', String(child === b));
        const chosen = model.current === choice.id;
        const confirm = button('sr-word is-primary', `Choose ${choice.title}`, chosen ? 'Already chosen' : `Choose ${choice.title}`, () => {
          this.actions.chooseIdentity(model.place, choice.id);
          this.identities.open = false;
        });
        confirm.disabled = chosen;
        this.identityPreview.replaceChildren(
          h('p', null, null, [choice.description]),
          h('p', 'identity-needs', null, [choice.needs]),
          h('p', 'identity-tradeoff', null, [choice.tradeoff]),
          h('span', 'identity-cost sr-caps', null, ['Free to try · Undo available']),
          confirm,
        );
      });
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(model.current === choice.id));
      this.identityChoices.append(b);
    }
  }
}

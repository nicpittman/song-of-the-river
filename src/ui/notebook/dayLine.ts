/**
 * The closed notebook: the little that stays on screen while the landscape
 * has the stage.
 *
 *   - The sky and the river (`Sky`): today's weather and a tiny river mark,
 *     tucked into the season tab that hangs at the top of the screen, so the
 *     hour of the year, the sky and the water read as one object.
 *   - One bar at the foot (`Bar`): the notebook, the group as a row of
 *     tokens, and pause, speed, skip and menu, all on a single slip within
 *     reach of the thumb.
 *
 * Every piece is flat ivory paper, so it reads the same over a bright summer
 * meadow and a dark blue night.
 */

import type { AdventureView } from '../../game/adventure/model';
import type { UiActions } from '../contract';
import { h } from '../dom';
import notebookIcon from '../assets/notebook-tab.svg?url';
import { ICONS } from '../icons';
import { resourceMark, weatherMark } from '../sketches';
import { keyed, wordButton } from './ink';
import { riverSection } from './riverMark';
import { LEVEL_SHORT, LEVEL_WORDS, TREND_WORDS, WEATHER_WORDS, resourceWords } from './words';
import { dayNotice } from './morning';

/** A quiet, persistent distinction between planning and a running/paused day. */
export class MorningNotice {
  readonly el = h('div', 'nb-morning-notice', { role: 'status', 'aria-live': 'polite' });
  private readonly label = h('span');
  private readonly action: HTMLButtonElement;
  constructor(onAction: () => void) {
    this.action = wordButton('', onAction, 'nb-morning-action');
    this.el.append(this.label, this.action);
    this.el.hidden = true;
  }
  update(view: AdventureView, bookOpen: boolean): void {
    const status = dayNotice(view);
    this.el.hidden = !status || bookOpen;
    if (!status) return;
    if (this.label.textContent !== status.label) this.label.textContent = status.label;
    if (this.action.textContent !== status.action) this.action.replaceChildren(...keyed(status.action));
  }
}

/** Today's weather and the river, as two small marks for the season tab. */
export class Sky {
  readonly el = h('span', 'nb-sky', { role: 'img' });
  private readonly weather = h('span', 'nb-sky-weather', { 'aria-hidden': 'true' });
  private readonly river = h('span', 'nb-sky-river', { 'aria-hidden': 'true' });
  private key = '';
  private readonly daylight = h('span','nb-daylight',{role:'img','aria-label':'Morning'});
  private sun: SVGGElement;
  private sunProgress: number | null = null;
  private sunChart: AdventureView['chart'] | null = null;

  constructor() {
    this.daylight.innerHTML = '<svg viewBox="0 0 216 20" width="216" height="20" aria-hidden="true"><path class="nb-sun-track" d="M0 15H216M0 13v4M108 13v4M216 13v4"/><g class="nb-travelling-sun"><circle cx="0" cy="0" r="3.5"/><path d="M-6 0h-2M6 0h2M0-6v-2M0 6v2M-4.5-4.5l-1-1M4.5-4.5l1-1M-4.5 4.5l-1 1M4.5 4.5l1 1"/></g></svg>';
    this.sun=this.daylight.querySelector('g')!;
    this.el.append(this.weather, this.river);
  }

  /**
   * Places the marks in the season tab's head when there is one (the clock's
   * own element, moved into the notebook while an expedition is shown), or
   * in a slip of their own at the top when there is not.
   */
  mount(clock: HTMLElement | null, fallback: HTMLElement): void {
    const head = clock?.querySelector('.clock-head');
    (head ?? fallback).append(this.el);
    (clock?.querySelector('.clock-tab') ?? fallback).append(this.daylight);
    this.el.classList.toggle('is-in-tab', !!head);
  }

  /** Follow the simulation every frame, rather than jumping at notebook refreshes. */
  updateDaylight(progress: number, dt: number): void {
    this.sunProgress = stepSun(this.sunProgress, progress, dt);
    this.sun.setAttribute('transform', `translate(${216*this.sunProgress} ${12-5*Math.sin(Math.PI*this.sunProgress)})`);
  }

  update(view: AdventureView): void {
    const progress=Math.max(0,Math.min(1,view.dayProgress));
    // A loaded journey has its own clock; do not retain the previous session's dusk.
    if (this.sunChart !== view.chart) { this.sunChart = view.chart; this.sunProgress = null; }
    this.updateDaylight(progress, 0);
    const hour=view.phase==='morning'?'Morning · day not started':view.phase==='day'?(progress<.25?'Morning':progress<.65?'Midday':progress<.9?'Late afternoon':'Dusk'):'Evening';
    this.daylight.setAttribute('aria-label',hour); this.daylight.title=hour;
    const { river } = view;
    const key = `${view.weather}|${river.level}|${river.trend}|${river.tomorrow}|${hour}`;
    if (key === this.key) return;
    this.key = key;
    this.weather.innerHTML = weatherMark(view.weather, 18);
    this.river.innerHTML = riverSection(river, { width: 26, height: 15, tiny: true }) + trendArrow(river.trend);
    const tomorrow = river.tomorrow === river.level ? '' : `, ${LEVEL_SHORT[river.tomorrow]} tomorrow`;
    this.el.setAttribute('aria-label', `${hour}. ${WEATHER_WORDS[view.weather]}. ${LEVEL_WORDS[river.level]}, ${TREND_WORDS[river.trend]}${tomorrow}.`);
    this.el.title = `${WEATHER_WORDS[view.weather]} · ${LEVEL_WORDS[river.level]}, ${TREND_WORDS[river.trend]}`;
  }
}

/** Smooth fixed-step clock samples; pause holds still and a new morning resets. */
export function stepSun(previous: number | null, target: number, dt: number): number {
  target = Math.max(0, Math.min(1, target));
  if (previous === null || target === 0) return target;
  if (dt <= 0) return previous;
  const next = previous + (Math.max(previous, target) - previous) * (1 - Math.exp(-dt / .1));
  return Math.abs(target - next) < .00001 ? target : next;
}

function trendArrow(trend: AdventureView['river']['trend']): string {
  if (trend === 'steady') return '<svg class="nb-trend" viewBox="0 0 8 16" width="8" height="16" aria-hidden="true"><path d="M1 8h6"/></svg>';
  const d = trend === 'rising' ? 'M4 13V3M1.6 5.4 4 3l2.4 2.4' : 'M4 3v10M1.6 10.6 4 13l2.4-2.4';
  return `<svg class="nb-trend" viewBox="0 0 8 16" width="8" height="16" aria-hidden="true"><path d="${d}"/></svg>`;
}

/** Pause, speed, skip to evening (by day) and menu: quiet ink glyphs at the end of the bar. */
export class Controls {
  readonly el = h('div', 'nb-controls');
  private readonly pause: HTMLButtonElement;
  private readonly speed: HTMLButtonElement;
  private readonly skip: HTMLButtonElement;
  private key = '';

  constructor(
    actions: UiActions,
    private readonly onSpeed: () => void,
    onSkip: () => void,
  ) {
    this.pause = iconButton('Pause', ICONS.pause, () => actions.togglePause());
    this.speed = h('button', 'nb-control nb-speed', { type: 'button' });
    this.speed.addEventListener('click', () => this.onSpeed());
    this.skip = iconButton('Skip to evening', ICONS.skip, onSkip);
    this.skip.classList.add('nb-skip');
    const menu = iconButton('Menu', ICONS.menu, () => actions.openMenu());
    this.el.append(this.pause, this.speed, this.skip, menu);
  }

  update(view: AdventureView): void {
    const key = `${view.paused}|${view.speed}|${view.phase}`;
    this.el.classList.toggle('is-resting', view.phase !== 'day');
    if (key === this.key) return;
    this.key = key;
    this.pause.innerHTML = view.paused ? ICONS.play : ICONS.pause;
    this.pause.setAttribute('aria-label', view.paused ? 'Resume' : 'Pause');
    this.speed.textContent = `${view.speed}×`;
    this.speed.setAttribute('aria-label', `Speed ${view.speed} times. Change speed.`);
    // Time can only be paused, hurried or skipped while the day is running.
    const running = view.phase === 'day';
    this.skip.hidden = !running;
    this.pause.hidden = !running;
    this.speed.hidden = !running;
  }
}

function iconButton(label: string, icon: string, onClick: () => void): HTMLButtonElement {
  const b = h('button', 'nb-control', { type: 'button', 'aria-label': label, title: label });
  b.innerHTML = icon;
  b.addEventListener('click', onClick);
  return b;
}

/** The notebook: a small closed book, and on wider screens one line on what it holds now. */
export class Tab {
  readonly el = h('button', 'nb-tab', { type: 'button', 'aria-controls': 'nb-leaf', 'aria-expanded': 'false' });
  private readonly sub = h('span', 'nb-tab-sub');

  private readonly book = h('span', 'nb-tab-book', { 'aria-hidden': 'true' });

  constructor(onClick: () => void) {
    const book = this.book;
    book.append(h('img', null, { src: notebookIcon, width: '22', height: '26', alt: '', draggable: 'false' }));
    this.el.append(book, h('span', 'nb-tab-words', null, [h('span', 'nb-tab-title', null, ['Notebook']), this.sub]));
    this.el.addEventListener('click', onClick);
  }

  set(line: string, waiting: boolean): void {
    if (this.sub.textContent !== line) this.sub.textContent = line;
    this.el.classList.toggle('is-waiting', waiting);
    this.el.setAttribute('aria-label', `Notebook. ${line}`);
  }

  /** Centre of the tab on screen: where tags slip away to. */
  centre(): { x: number; y: number } | null {
    // Only a tab that is really on screen can be flown to (hidden, it measures as the top-left corner).
    const r = this.el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(this.el).visibility === 'hidden' || this.el.closest('[inert]')) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
}

/** Shared resources in the valley bar. Readiness lives under the clock. */
export class BarState {
  readonly provisions = h('span', 'nb-bar-supplies', { role: 'img' });
  private key = '';

  update(view: AdventureView): void {
    const key = `${view.provisions}|${view.materials}`;
    if (key === this.key) return;
    this.key = key;
    this.provisions.innerHTML = `${resourceMark('provisions', 22)}<span>${view.provisions}</span>${resourceMark('materials', 20)}<span>${view.materials}</span>`;
    this.provisions.setAttribute('aria-label', resourceWords(view));
    this.provisions.title = resourceWords(view);
  }
}

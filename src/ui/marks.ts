/**
 * The season's brushstrokes: one ink mark per change the player may still make
 * this season, with a quiet caption so the marks explain themselves. A spent
 * mark fades like wet ink lifting; a new season draws fresh marks one by one.
 * Hover (or a long press) shows a one-line explanation.
 */

import { h, svgEl } from './dom';
import { brushStroke } from './icons';

const STEP = 10;
const TIP = 'Each change to the valley takes a brushstroke. Three more arrive every season.';
const LONG_PRESS_MS = 450;
const TIP_TOUCH_MS = 3200;

export class MarksChip {
  readonly el: HTMLElement;
  private readonly svg: SVGSVGElement;
  private readonly tip: HTMLElement;
  private readonly count: HTMLElement;
  private marks: number | null = -1;
  private cap = -1;
  private tipTimer = 0;
  private pressTimer = 0;

  constructor() {
    this.svg = svgEl('svg', { class: 'marks-svg', 'aria-hidden': 'true' });
    this.tip = h('span', 'marks-tip sr-slip sr-transient', { role: 'tooltip', id: 'sr-marks-tip' }, [TIP]);
    this.count = h('span', 'marks-count', { 'aria-hidden': 'true' });
    this.el = h('div', 'marks', { role: 'img', tabindex: '0', 'aria-describedby': 'sr-marks-tip' }, [
      h('span', 'marks-ink', null, [h('span', 'marks-total', null, [this.svg as unknown as Node, this.count]), h('span', 'marks-caption', { 'aria-hidden': 'true' }, ['Brushstrokes'])]),
      this.tip,
    ]);

    const show = (): void => { clearTimeout(this.tipTimer); this.el.classList.add('is-tip'); this.tip.classList.add('is-shown'); };
    const hide = (): void => { clearTimeout(this.tipTimer); this.el.classList.remove('is-tip'); this.tip.classList.remove('is-shown'); };
    this.el.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') show(); });
    this.el.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') hide(); });
    this.el.addEventListener('focus', show);
    this.el.addEventListener('blur', hide);
    // Long press on touch: show the line for a few seconds.
    this.el.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      clearTimeout(this.pressTimer);
      this.pressTimer = window.setTimeout(() => {
        show();
        this.tipTimer = window.setTimeout(hide, TIP_TOUCH_MS);
      }, LONG_PRESS_MS);
    });
    const cancel = (): void => clearTimeout(this.pressTimer);
    this.el.addEventListener('pointerup', cancel);
    this.el.addEventListener('pointercancel', cancel);
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Null means unlimited in Free Play; the panel stays visible in both modes. */
  set(marks: number | null, cap: number): void {
    if (marks === this.marks && cap === this.cap) return;
    const prev = this.marks;
    const first = prev === -1 || cap !== this.cap;
    this.el.hidden = false;
    this.count.textContent = marks === null ? 'Unlimited' : `${marks} / ${cap}`;
    this.tip.textContent = marks === null ? 'Wander has unlimited brushstrokes. Draw, plant and reshape at your own pace.' : TIP;
    this.svg.style.display = marks === null ? 'none' : '';
    if (cap !== this.cap) {
      this.cap = cap;
      this.svg.textContent = '';
      const w = Math.max(1, cap * STEP + 2);
      this.svg.setAttribute('viewBox', `0 0 ${w} 24`);
      this.svg.style.width = `${w}px`;
      for (let i = 0; i < cap; i++) {
        // The stroke sits in a positioned group so its own CSS animations never fight the placement.
        const g = svgEl('g', { transform: `translate(${i * STEP - 1} 0)` });
        g.append(svgEl('path', { d: brushStroke(i), class: 'brush' }));
        this.svg.append(g);
      }
    }
    this.marks = marks;
    if (marks === null) {
      this.el.setAttribute('aria-label', 'Unlimited brushstrokes in Wander');
      return;
    }

    const kids = this.svg.querySelectorAll('.brush');
    const before = first || prev === null ? marks : prev;
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i] as SVGPathElement;
      const on = i < marks;
      k.classList.toggle('is-spent', !on);
      k.classList.remove('is-spending', 'is-drawing');
      if (first) continue;
      if (!on && i < before) {
        // Just spent: let the ink lift.
        void k.getBoundingClientRect();
        k.classList.add('is-spending');
      } else if (on && i >= before) {
        // A fresh season: draw the new strokes in, one after another.
        k.style.setProperty('--d', `${(i - before) * 0.16}s`);
        void k.getBoundingClientRect();
        k.classList.add('is-drawing');
      }
    }
    const label = marks === 1 ? '1 brushstroke left this season' : `${marks} brushstrokes left this season`;
    this.el.setAttribute('aria-label', label);
  }

  /** A single soft pulse to draw the eye here (the first time a stroke is spent). */
  pulse(): void {
    this.el.classList.remove('is-pulsing');
    void this.el.offsetWidth;
    this.el.classList.add('is-pulsing');
    window.setTimeout(() => this.el.classList.remove('is-pulsing'), 2400);
  }
}

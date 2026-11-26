/**
 * The one flourish in the notebook, kept for rare things: the sketch draws
 * itself in with a fine stroke, a pale wash blooms under it, and three ink
 * flecks settle beside it. About a second, then stillness. Pale, warm and
 * low in contrast; never a glow, never repeated.
 */

import { h } from '../dom';

/** Plays the flourish once on a sketch element (an `.nb-sketch` holding an inline SVG). */
export function flourish(art: HTMLElement): void {
  art.classList.add('has-flourish');
  // Every stroke is given a length of one, so a single dash can draw it in.
  art.querySelectorAll('path, circle, ellipse, line, polyline').forEach((shape) => shape.setAttribute('pathLength', '1'));
  const wash = h('span', 'nb-flourish-wash', { 'aria-hidden': 'true' });
  const flecks = h('span', 'nb-flourish-flecks', { 'aria-hidden': 'true' }, [h('i'), h('i'), h('i')]);
  art.prepend(wash);
  art.append(flecks);
  window.setTimeout(() => {
    art.classList.remove('has-flourish');
    art.querySelectorAll('[pathLength]').forEach((shape) => shape.removeAttribute('pathLength'));
    art.classList.add('has-flourished');
    flecks.remove();
  }, 1600);
}

/**
 * The plain ink-in, for an ordinary find written into the journal: the
 * drawing traces itself in once, after `delay` ms. No wash, no flecks.
 */
export function inkIn(art: HTMLElement, delay: number): void {
  art.style.setProperty('--ink-delay', `${delay}ms`);
  art.classList.add('is-inking');
  art.querySelectorAll('path, circle, ellipse, line, polyline').forEach((shape) => shape.setAttribute('pathLength', '1'));
  window.setTimeout(() => {
    art.classList.remove('is-inking');
    art.querySelectorAll('[pathLength]').forEach((shape) => shape.removeAttribute('pathLength'));
  }, delay + 1100);
}

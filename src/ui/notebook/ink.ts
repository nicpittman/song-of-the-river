/**
 * Small pieces of ink that every part of the notebook uses: word buttons,
 * small-capital labels, chance pips, sketches, friend tokens and pack knots.
 * Each returns a fresh element; none keeps state.
 */

import type { FriendView, PackHint } from '../../game/adventure/model';
import { h } from '../dom';
import { knot, sketch } from '../sketches';
import { portraitMarkup } from './portrait';
import { PACK_WORDS } from './words';

/**
 * A button that is a word with an ink underline. `key` lets a re-render put
 * focus back on the same control (see `restoreFocus`).
 */
export function wordButton(label: string, onClick: () => void, cls = '', key?: string): HTMLButtonElement {
  const b = h('button', `nb-word ${cls}`.trim(), { type: 'button' }, keyed(label));
  if (key) b.dataset.k = key;
  b.addEventListener('click', onClick);
  return b;
}

/** A trailing keyboard hint (" · E", " · 1–6") in its own span, so touch screens can leave it out. */
const KEY_HINT = / · (E|R|Space|Esc|[1-6](–[1-6])?)$/;
export function keyed(label: string): Array<string | HTMLElement> {
  const m = KEY_HINT.exec(label);
  return m ? [label.slice(0, m.index), h('span', 'nb-keyhint', null, [m[0]])] : [label];
}

/**
 * The one strong action on a page ("Send Ren", "Begin the day"): small capitals
 * inside a hairline box, so it reads as the next thing to do.
 */
export function stampButton(label: string, onClick: () => void, key?: string): HTMLButtonElement {
  const b = h('button', 'nb-stamp', { type: 'button' }, [h('span', 'nb-stamp-word', null, keyed(label))]);
  if (key) b.dataset.k = key;
  b.addEventListener('click', onClick);
  return b;
}

export function caps(text: string, cls = ''): HTMLElement {
  return h('span', `nb-caps ${cls}`.trim(), null, [text]);
}

/** Inline SVG sketch wrapped in a span, so it can carry classes and a title. */
export function sketchEl(id: string, size: number, found = true, cls = ''): HTMLElement {
  const el = h('span', `nb-sketch ${cls}`.trim(), { 'aria-hidden': 'true' });
  el.innerHTML = sketch(id, { found, size });
  return el;
}

/** A friend's portrait sketch in a ring of their colour. */
export function friendToken(friend: Pick<FriendView, 'id' | 'colour' | 'pack'>, size: number, cls = ''): HTMLElement {
  const el = h('span', `nb-token ${cls}`.trim(), { 'aria-hidden': 'true' });
  el.style.setProperty('--friend', friend.colour);
  el.style.setProperty('--size', `${size}px`);
  // The face sits in its own clipped circle, so the pack knot can rest on the ring's edge.
  el.innerHTML = `<span class="nb-face">${portraitMarkup(friend.id, Math.max(16, size - 4))}</span>`;
  if (friend.pack) el.append(packKnot(friend.pack));
  return el;
}

/** The knot on a pack: a tied cloth bundle, plain, unusual (straw) or rare (river, with a glint). */
export function packKnot(hint: PackHint, size = 18): HTMLElement {
  const el = h('span', `nb-knot is-${hint}`, { role: 'img', 'aria-label': PACK_WORDS[hint] });
  el.innerHTML = knot(hint === 'story' ? 'rare' : hint, size);
  return el;
}

/** A tiny fire, for camp and for friends resting by it. */
export function fireGlyph(size = 16): HTMLElement {
  const el = h('span', 'nb-fire', { 'aria-hidden': 'true' });
  el.innerHTML =
    `<svg viewBox="0 0 16 16" width="${size}" height="${size}">` +
    '<path class="fire-flame" d="M8 2.6c1.8 2 3.2 3.6 3.2 5.6a3.2 3.2 0 0 1-6.4 0c0-1.2.6-2 1.3-2.8.2 1 .7 1.6 1.3 1.8-.4-1.6 0-3 .6-4.6Z"/>' +
    '<path class="fire-logs" d="M3.4 13.6l9.2-1.8M3.6 11.8l9 1.9"/></svg>';
  return el;
}

/**
 * Re-rendering replaces elements; this puts focus back on the control with the
 * same `data-k` key, so keyboard players never lose their place.
 */
export function focusKey(root: HTMLElement): string | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !root.contains(active)) return null;
  return active.dataset.k ?? null;
}

export function restoreFocus(root: HTMLElement, key: string | null): void {
  if (!key) return;
  const el = root.querySelector<HTMLElement>(`[data-k="${CSS.escape(key)}"]`);
  el?.focus({ preventScroll: true });
}

/** True when motion should be kept to a minimum (the game's setting or the system's). */
export function reducedMotion(el: HTMLElement): boolean {
  if (el.closest('.is-reduced')) return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

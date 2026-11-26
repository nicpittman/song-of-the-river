/** Tiny DOM helpers shared by the interface modules. */

import type { Season } from '../game/world/types';

export const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;
/** Each season's tint: the paper system's washes (blossom, leaf, straw, river). */
export const SEASON_COLOURS = ['#ecc9c6', '#cfdcb8', '#e6d7a8', '#bcd7d6'] as const;
export const seasonName = (s: Season): string => SEASON_NAMES[s] ?? 'Spring';

type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string | null,
  attrs?: Record<string, string> | null,
  children?: Child[],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (children) for (const c of children) if (c) el.append(c);
  return el;
}

/** A plain `<button type="button">`. */
export function button(cls: string, label: string, content: string | Node, onClick: () => void): HTMLButtonElement {
  const b = h('button', cls, { type: 'button', 'aria-label': label });
  if (typeof content === 'string') b.innerHTML = content;
  else b.append(content);
  b.addEventListener('click', onClick);
  return b;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  if (attrs) for (const k in attrs) el.setAttribute(k, String(attrs[k]));
  return el;
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

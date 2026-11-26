/**
 * The pen: how every sketch is put on paper.
 *
 * A drawing is described as data on a 48 x 48 grid: one or two pale washes,
 * the pen line, finer detail and a few solid dots. `render` turns it into
 * inline SVG. The washes are laid first and slightly off register, as a
 * watercolour tint would be under a field-notes drawing; the line goes on top
 * in `currentColor`, so the surrounding text colour inks it.
 *
 * An unfound drawing keeps only its main line, as a dotted outline with no
 * wash, so the player can recognise the shape of what is still out there.
 */

/** The four pale watercolour tints of the paper system (see `tokens.css`). */
export type Wash = 'river' | 'blossom' | 'leaf' | 'straw';

/** Fallback colours when a sketch is shown outside `.sr-ui`, where the tokens are not defined. */
const WASH_HEX: Record<Wash, string> = {
  river: '#bcd7d6',
  blossom: '#ecc9c6',
  leaf: '#cfdcb8',
  straw: '#e6d7a8',
};

export interface Drawing {
  /** Pale tints under the line: a tone and a closed path. One or two is the house style. */
  wash: Array<[Wash, string]>;
  /** The pen line: the shape itself. These are the strokes an unfound sketch shows dotted. */
  line: string[];
  /** Finer strokes (fur, ripples, veins, texture). Thinner and softer; omitted when unfound. */
  detail?: string[];
  /** Small solid ink marks as [x, y, r] (eyes, seeds, knots). Omitted when unfound. */
  dots?: Array<[number, number, number]>;
}

export interface RenderOptions {
  found: boolean;
  /** Displayed size in CSS pixels; the grid is always 48 units. */
  size: number;
}

/** The line is 1.2 px at 48 px. Smaller sketches keep a slightly heavier line so they do not fade away. */
function lineWidth(size: number): number {
  return 1.2 * Math.sqrt(48 / Math.max(12, size));
}

const num = (v: number): string => (Math.round(v * 100) / 100).toString();

/** Inline SVG markup for a drawing. */
export function render(id: string, d: Drawing, { found, size }: RenderOptions): string {
  const w = lineWidth(size);
  const open = `<svg class="sketch${found ? '' : ' is-unfound'}" data-sketch="${id}" width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">`;
  if (!found) {
    // Dots of ink along the outline: a zero-length dash with round caps is a dot.
    const dotted = d.line.map((p) => `<path d="${p}"/>`).join('');
    return `${open}<g stroke-width="${num(w * 1.05)}" stroke-dasharray="0.01 ${num(w * 2.5)}" opacity=".75">${dotted}</g></svg>`;
  }
  const washes = d.wash
    .map(([tone, p]) => `<path d="${p}" style="fill:var(--wash-${tone},${WASH_HEX[tone]})"/>`)
    .join('');
  const line = d.line.map((p) => `<path d="${p}"/>`).join('');
  const detail = (d.detail ?? []).map((p) => `<path d="${p}"/>`).join('');
  const dots = (d.dots ?? []).map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
  return (
    open +
    (washes ? `<g class="sk-wash" stroke="none" transform="translate(.9 .7)" style="mix-blend-mode:multiply">${washes}</g>` : '') +
    `<g stroke-width="${num(w)}">${line}</g>` +
    (detail ? `<g stroke-width="${num(w * 0.62)}" opacity=".8">${detail}</g>` : '') +
    (dots ? `<g fill="currentColor" stroke="none">${dots}</g>` : '') +
    '</svg>'
  );
}

/** A circle as path data, so every shape in a drawing can be one kind of thing. */
export function ring(cx: number, cy: number, r: number): string {
  return `M${num(cx - r)} ${num(cy)}a${num(r)} ${num(r)} 0 1 0 ${num(2 * r)} 0a${num(r)} ${num(r)} 0 1 0 ${num(-2 * r)} 0Z`;
}

/** An ellipse as path data. */
export function oval(cx: number, cy: number, rx: number, ry: number): string {
  return `M${num(cx - rx)} ${num(cy)}a${num(rx)} ${num(ry)} 0 1 0 ${num(2 * rx)} 0a${num(rx)} ${num(ry)} 0 1 0 ${num(-2 * rx)} 0Z`;
}

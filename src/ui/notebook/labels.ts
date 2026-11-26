/**
 * Place-name placement for the map board. With a dozen or more places in a
 * reach, names must never sit on each other or on another place's mark.
 *
 * Greedy and deterministic: the most important names choose first, each trying
 * a few positions around its mark in a fixed order of preference. A name that
 * finds no free spot is left off; its mark stays, and the name appears when the
 * place is hovered, focused or selected.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LabelRequest {
  id: string;
  /** The mark's centre, in pixels within the section. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Higher chooses first. */
  priority: number;
  /** Settlements and ordinary places keep a name when they can: off every other name, if not off every mark. */
  required?: boolean;
  /** A settlement's name is always written, in the least crowded spot if no spot is clear. */
  always?: boolean;
  /** Space between the mark's centre and its name; larger marks need more. */
  gap?: number;
}

export type Side = 'right' | 'left' | 'above' | 'below' | 'right-up' | 'left-up';

export interface Placement {
  side: Side;
  /** Top-left of the label box, relative to the mark's centre. */
  dx: number;
  dy: number;
}

/** Space between a mark's centre and its name. */
const DEFAULT_GAP = 12;
/** Breathing room kept around every name. */
const PAD = 2;
/** An obstacle with this owner is only room kept for something (portraits beside a place): a name keeps off it when it easily can. */
export const SOFT = '~soft';
/** The first few candidate spots sit right beside the mark; the rest are farther out. */
const NEAR_CANDIDATES = 6;
/** On a small map, names this important (planned, a lead, worth a look today) are written even if a mark is in the way. */
const STRICT_KEEP = 200;

function candidates(r: LabelRequest): Array<{ side: Side; dx: number; dy: number }> {
  const { width: w, height: h } = r;
  const GAP = r.gap ?? DEFAULT_GAP;
  return [
    { side: 'right', dx: GAP, dy: -h / 2 },
    { side: 'left', dx: -GAP - w, dy: -h / 2 },
    { side: 'below', dx: -w / 2, dy: GAP - 2 },
    { side: 'above', dx: -w / 2, dy: -GAP - h + 2 },
    { side: 'right-up', dx: GAP - 3, dy: -h - 3 },
    { side: 'left-up', dx: 3 - GAP - w, dy: -h - 3 },
    { side: 'below', dx: -w / 2, dy: GAP + 34 },
    { side: 'above', dx: -w / 2, dy: -GAP - h - 34 },
    // A crowded corner: the name slides along its mark before it gives up.
    { side: 'right', dx: GAP, dy: h / 2 + 2 },
    { side: 'left', dx: -GAP - w, dy: h / 2 + 2 },
    { side: 'below', dx: 0, dy: GAP - 2 },
    { side: 'below', dx: -w, dy: GAP - 2 },
    { side: 'above', dx: 0, dy: -GAP - h + 2 },
    { side: 'above', dx: -w, dy: -GAP - h + 2 },
    { side: 'right', dx: GAP + 22, dy: -h / 2 },
    { side: 'left', dx: -GAP - 22 - w, dy: -h / 2 },
    { side: 'below', dx: -w / 2, dy: GAP + 20 },
    { side: 'above', dx: -w / 2, dy: -GAP - h - 20 },
  ];
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w + PAD && b.x < a.x + a.w + PAD && a.y < b.y + b.h + PAD && b.y < a.y + a.h + PAD;
}

/**
 * Chooses a position for each label, or null when it cannot be placed cleanly.
 * `obstacles` are marks and tokens, keyed by the place they belong to so a name
 * never counts its own mark as in the way.
 */
export function placeLabels(
  requests: LabelRequest[],
  obstacles: Array<Rect & { owner: string }>,
  bounds: { width: number; height: number },
  /** A small map (a phone's): an ordinary place's name goes quiet rather than sit on another place's mark. */
  strict = false,
): Map<string, Placement | null> {
  const result = new Map<string, Placement | null>();
  const taken: Rect[] = [];
  const order = [...requests].sort((a, b) => b.priority - a.priority);
  for (const r of order) {
    let chosen: Placement | null = null;
    let fallback: { c: Placement; box: Rect; crowd: number; names: number } | null = null;
    const clean: Array<{ c: Placement; box: Rect; soft: boolean; near: boolean }> = [];
    const spots = candidates(r);
    for (let index = 0; index < spots.length; index++) {
      const c = spots[index]!;
      const box: Rect = { x: r.x + c.dx, y: r.y + c.dy, w: r.width, h: r.height };
      if (box.x < 2 || box.y < 2 || box.x + box.w > bounds.width - 2 || box.y + box.h > bounds.height - 2) continue;
      const names = taken.filter((t) => overlaps(t, box)).length;
      const crowd = names * 2 + obstacles.filter((o) => o.owner !== r.id && o.owner !== SOFT && overlaps(o, box)).length;
      if (crowd > 0) {
        if (!fallback || crowd < fallback.crowd) fallback = { c, box, crowd, names };
        continue;
      }
      clean.push({ c, box, soft: obstacles.some((o) => o.owner === SOFT && overlaps(o, box)), near: index < NEAR_CANDIDATES });
    }
    // Close beside the mark and clear of the room kept for faces; then close beside it; then anywhere clear.
    const pick = clean.find((x) => x.near && !x.soft) ?? clean.find((x) => x.near) ?? clean.find((x) => !x.soft) ?? clean[0];
    if (pick) { chosen = pick.c; taken.push(pick.box); }
    // Names never sit on names: an ordinary place with no clean spot goes quiet (its name shows on hover or focus) unless the only thing in the way is a mark.
    if (!chosen && fallback && (r.always || (r.required && fallback.names === 0 && (!strict || r.priority >= STRICT_KEEP)))) {
      chosen = fallback.c;
      taken.push(fallback.box);
    }
    result.set(r.id, chosen);
  }
  return result;
}

let measureCanvas: CanvasRenderingContext2D | null = null;

/** Width of a line of text in the notebook's serif, for placing names before they are drawn. */
export function textWidth(text: string, font: string): number {
  measureCanvas ??= document.createElement('canvas').getContext('2d');
  if (!measureCanvas) return text.length * 6.5;
  measureCanvas.font = font;
  return measureCanvas.measureText(text).width;
}

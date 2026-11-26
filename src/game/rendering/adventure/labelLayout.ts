/**
 * Where each place name goes so that no two names overlap, and none sits on a
 * figure or another place's mark. Greedy by priority: the selected or hovered
 * place first, then special places and leads, then the rest; each name tries
 * below its mark, then right, left and above, and is left out (mark only) if
 * nothing fits. Pure, so it can be tested without a renderer.
 */

export interface LabelItem {
  /** The place's mark, world px. */
  x: number;
  y: number;
  /** Size of the name, world px at the current zoom. */
  w: number;
  h: number;
  /** Higher goes first. */
  priority: number;
  /** Whether this name wants to show at all. */
  wanted: boolean;
  /** A name with a fixed spot, placed by the caller; others keep clear of it. */
  fixed?: boolean;
  /** Result: chosen slot (0 below, 1 right, 2 left, 3 above) or -1 if left out. */
  slot: number;
  /** Result: top-left of the name. */
  left: number;
  top: number;
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const SLOTS = 4;

/** Top-left of `item`'s name in `slot`, with `gap` world px between mark and name. */
export function slotOrigin(item: LabelItem, slot: number, gap: number, out: { x: number; y: number }): void {
  switch (slot) {
    case 0:
      out.x = item.x - item.w / 2;
      out.y = item.y + gap;
      break;
    case 1:
      out.x = item.x + gap * 1.4;
      out.y = item.y - item.h / 2;
      break;
    case 2:
      out.x = item.x - gap * 1.4 - item.w;
      out.y = item.y - item.h / 2;
      break;
    default:
      out.x = item.x - item.w / 2;
      out.y = item.y - gap - item.h;
      break;
  }
}

const overlaps = (a: Box, l: number, t: number, r: number, b: number): boolean => l < a.right && r > a.left && t < a.bottom && b > a.top;

/**
 * Lays out `items` in place. `order` is a scratch array of indices (reused
 * between calls); `obstacles` are boxes names must avoid (figures, marks);
 * `placed` is scratch storage for accepted name boxes. `prefer` gives each
 * item's slot from last time, tried first so names do not hop about.
 */
export function layoutLabels(items: LabelItem[], obstacles: readonly Box[], gap: number, order: number[], placed: Box[], prefer: readonly number[]): void {
  order.length = 0;
  for (let i = 0; i < items.length; i++) order.push(i);
  order.sort((a, b) => items[b]!.priority - items[a]!.priority);
  let count = 0;
  const o = { x: 0, y: 0 };
  for (const index of order) {
    const item = items[index]!;
    // A fixed name was placed by the caller; it only stands in the others' way.
    if (item.fixed) continue;
    item.slot = -1;
    if (!item.wanted) continue;
    const first = prefer[index] ?? -1;
    for (let k = -1; k < SLOTS; k++) {
      const slot = k < 0 ? first : k;
      if (slot < 0 || (k >= 0 && slot === first)) continue;
      slotOrigin(item, slot, gap, o);
      const l = o.x;
      const t = o.y;
      const r = l + item.w;
      const b = t + item.h;
      let free = true;
      for (const box of obstacles) {
        if (overlaps(box, l, t, r, b)) {
          free = false;
          break;
        }
      }
      for (let j = 0; free && j < count; j++) if (overlaps(placed[j]!, l, t, r, b)) free = false;
      if (!free) continue;
      item.slot = slot;
      item.left = l;
      item.top = t;
      let box = placed[count];
      if (!box) {
        box = { left: 0, top: 0, right: 0, bottom: 0 };
        placed[count] = box;
      }
      box.left = l;
      box.top = t;
      box.right = r;
      box.bottom = b;
      count++;
      break;
    }
  }
}

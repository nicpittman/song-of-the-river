import type { Rect } from './labels';

export const MAP_TOKEN_SIZE = 32;
const GAP = 1;
/** How far a portrait may stray from its friend's place while keeping clear of every name, in pixels. */
export const NEAR = 44;
/** A crowded place: a portrait may step this far out (still plainly beside its place) before it would cover a name. */
const BESIDE = 76;
/** Faces in a stack overlap the one before by about 60%, like a fanned hand. */
export const FACE_STEP = Math.round(MAP_TOKEN_SIZE * 0.4);
/** The most faces a stack draws; any more are counted on a small "+N" chip. */
export const STACK_FACES = 5;
/** How far the "+N" chip reaches past the last face of a hand. */
export const CHIP_REACH = 14;
/**
 * A lone face's "+N" chip: its drawn size, and how far it pokes past the face's
 * corner, or (tucked, where nothing beside the face is free) how far inside it
 * sits (see face-stack.css).
 */
export const CHIP = { w: 24, h: 17, out: { x: 5, y: 3 }, tucked: { x: -1, y: -1 } };
/** Which corner of a lone face its chip sits on, nearest first when all else is equal. */
export type ChipCorner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
const CORNERS: readonly ChipCorner[] = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];

/** Where a lone face's chip is drawn, for a face at `face`. */
export function chipRect(face: Rect, corner: ChipCorner, tucked = false): Rect {
  const right = corner.endsWith('right'), bottom = corner.startsWith('bottom');
  const out = tucked ? CHIP.tucked : CHIP.out;
  return {
    x: right ? face.x + face.w + out.x - CHIP.w : face.x - out.x,
    y: bottom ? face.y + face.h + out.y - CHIP.h : face.y - out.y,
    w: CHIP.w, h: CHIP.h,
  };
}

const TOKEN = { w: MAP_TOKEN_SIZE, h: MAP_TOKEN_SIZE };
const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
const intersects = (a: Rect, b: Rect): boolean => a.x < b.x+b.w+GAP && a.x+a.w+GAP > b.x && a.y < b.y+b.h+GAP && a.y+a.h+GAP > b.y;
type Bounds = { width: number; height: number };
type Point = { x: number; y: number };
/**
 * Something a portrait keeps clear of. A mark's `core` is the ink actually
 * drawn: in the most crowded places a portrait may cover the quiet margin of a
 * mark's ring (never the mark) rather than leave its friend's place behind.
 */
export type Obstacle = Rect & { core?: Rect };
const cores = (obstacles: readonly Obstacle[]): Rect[] => obstacles.map((o) => o.core ?? o);

/** The width of a stack drawing `shown` faces, with a chip when some are left uncounted. */
export const stackWidth = (shown: number, chip: boolean): number => MAP_TOKEN_SIZE + (shown - 1) * FACE_STEP + (chip ? CHIP_REACH : 0);

/**
 * Closest clear portrait centre to the pin. Marks, rings and other portraits
 * (`obstacles`) are always kept clear; names (`soft`) are too while a spot
 * beside the friend's place allows it (a little farther out at a crowded
 * place), but a portrait would rather sit over a name than wander far from
 * where its friend really is.
 */
export function mapTokenSeat(pin: Point, obstacles: readonly Obstacle[], bounds: Bounds, soft: readonly Rect[] = []): Rect | null {
  const all = [...obstacles, ...soft];
  return search(pin, TOKEN, all, bounds, NEAR) ?? search(pin, TOKEN, all, bounds, BESIDE)
    ?? crowded(pin, TOKEN, obstacles, bounds, soft) ?? search(pin, TOKEN, all, bounds, Infinity);
}

/**
 * Within NEAR as a last resort: over the quiet margin of a ring but clear of
 * names, then over a name but clear of rings, then over both (never a mark).
 */
function crowded(pin: Point, size: { w: number; h: number }, obstacles: readonly Obstacle[], bounds: Bounds, soft: readonly Rect[]): Rect | null {
  const inked = cores(obstacles);
  const margins = obstacles.some((o) => o.core);
  return (margins ? search(pin, size, [...inked, ...soft], bounds, NEAR) : null) ?? search(pin, size, obstacles, bounds, NEAR)
    ?? (margins ? search(pin, size, inked, bounds, NEAR) : null);
}

/** Faces at one place: each in its own seat, or gathered as one overlapping stack. */
export type FaceSeats =
  | { kind: 'apart'; seats: Array<Rect | null> }
  /**
   * `shown` faces are drawn overlapping in `box`; the rest are counted on a chip.
   * A lone face (`shown` 1) carries its chip on `corner` (inside the face when
   * `tucked`), drawn at `chip`, never over a name.
   */
  | { kind: 'stack'; box: Rect; shown: number; corner?: ChipCorner; tucked?: boolean; chip?: Rect; hides?: Rect[] };

/** A name a portrait keeps clear of; an ordinary one (`yields`) may be hidden, as a last resort, to keep a lone face beside its place. */
export type Name = Rect & { yields?: boolean };

/**
 * Seats `count` faces belonging to one place. Three or more always gather
 * into a stack, two do when they could not both sit plainly beside it. A stack
 * is one obstacle of its real size and keeps within NEAR of its place: the
 * whole hand of faces where it fits clear of names, else a single face with a
 * "+N" chip on its corner (no wider than one portrait), which may cover a
 * ring's margin or a name before it would leave its place.
 */
export function seatFaces(pin: Point, count: number, obstacles: readonly Obstacle[], bounds: Bounds, soft: readonly Name[] = []): FaceSeats {
  if (count <= 0) return { kind: 'apart', seats: [] };
  const all = [...obstacles, ...soft];
  if (count === 2) {
    const first = search(pin, TOKEN, all, bounds, NEAR);
    const second = first && search(pin, TOKEN, [...all, first], bounds, NEAR);
    if (first && second) return { kind: 'apart', seats: [first, second] };
  }
  if (count >= 2) {
    const shown = count > STACK_FACES ? STACK_FACES - 1 : count;
    const hand = { w: stackWidth(shown, shown < count), h: MAP_TOKEN_SIZE };
    // The whole hand where it fits: clear of everything, else over the quiet margin of a ring but clear of names.
    const full = search(pin, hand, all, bounds, NEAR) ?? (obstacles.some((o) => o.core) ? search(pin, hand, [...cores(obstacles), ...soft], bounds, NEAR) : null);
    if (full) return { kind: 'stack', box: full, shown };
    // A lone face stands for them all, the chip tucked on whichever corner keeps it off every name and mark.
    const lone = loneFace(pin, obstacles, bounds, soft);
    if (lone) {
      const chip = chipRect(lone.face, lone.corner, lone.tucked);
      // Any ordinary name the face or chip would cover is hidden instead (see loneFace).
      const hides = soft.filter((name) => overlaps(name, lone.face) || overlaps(name, chip));
      return { kind: 'stack', box: lone.face, shown: 1, corner: lone.corner, tucked: lone.tucked, chip, ...(hides.length ? { hides } : {}) };
    }
  }
  const seats: Array<Rect | null> = [];
  const taken = [...obstacles];
  for (let i = 0; i < count; i++) {
    const seat = mapTokenSeat(pin, taken, bounds, soft);
    seats.push(seat);
    if (seat) taken.push(seat);
  }
  return { kind: 'apart', seats };
}

/**
 * One face and its "+N" chip, which never cover a name. Within NEAR: clear of
 * all, then over a ring's margin; then over an ordinary name, which is hidden
 * (as crowded ordinary names already are on a narrow map); then a little
 * farther out, and farther. Each fallback tries the chip on every corner of
 * the face and keeps the nearest; with no corner free it tucks the chip inside
 * the face rather than move farther.
 */
function loneFace(pin: Point, obstacles: readonly Obstacle[], bounds: Bounds, soft: readonly Name[]): { face: Rect; corner: ChipCorner; tucked: boolean } | null {
  const all = [...obstacles, ...soft];
  const inked = cores(obstacles);
  const margins = obstacles.some((o) => o.core);
  const firm = soft.filter((name) => !name.yields);
  type Tier = { face: readonly Rect[]; chip: readonly Rect[]; near: number };
  // The chip keeps clear of whatever the face does, and of every drawn mark besides.
  const tier = (face: readonly Rect[], names: readonly Rect[], near: number): Tier => ({ face, chip: [...face, ...names, ...inked], near });
  const tiers: Tier[] = [
    tier(all, soft, NEAR),
    ...(margins ? [tier([...inked, ...soft], soft, NEAR)] : []),
    ...(firm.length < soft.length ? [tier([...obstacles, ...firm], firm, NEAR), ...(margins ? [tier([...inked, ...firm], firm, NEAR)] : [])] : []),
    tier(all, soft, BESIDE), tier([...obstacles, ...firm], firm, BESIDE), tier(all, soft, Infinity),
  ];
  for (const { face: faceClear, chip: chipClear, near } of tiers) {
    let best: { face: Rect; corner: ChipCorner; tucked: boolean } | null = null, distance = Infinity;
    for (const corner of CORNERS) {
      const chip = chipRect({ x: -TOKEN.w/2, y: -TOKEN.h/2, ...TOKEN }, corner);
      const face = searchShape(pin, [
        { dx: -TOKEN.w/2, dy: -TOKEN.h/2, ...TOKEN, obstacles: faceClear },
        { dx: chip.x, dy: chip.y, w: chip.w, h: chip.h, obstacles: chipClear },
      ], bounds, near);
      if (!face) continue;
      const d = Math.hypot(face.x + face.w/2 - pin.x, face.y + face.h/2 - pin.y);
      if (d < distance - 1e-6) { best = { face, corner, tucked: false }; distance = d; }
    }
    if (best) return best;
    // Inside the face's own corner the chip covers nothing else.
    const face = search(pin, TOKEN, faceClear, bounds, near);
    if (face) return { face, corner: 'bottom-right', tucked: true };
  }
  return null;
}

function search(pin: Point, size: { w: number; h: number }, obstacles: readonly Rect[], bounds: Bounds, near: number): Rect | null {
  return searchShape(pin, [{ dx: -size.w/2, dy: -size.h/2, w: size.w, h: size.h, obstacles }], bounds, near);
}

/** One part of a seated shape: a rect offset from the shape's centre, and what that part must keep clear of. */
type Part = { dx: number; dy: number; w: number; h: number; obstacles: readonly Rect[] };

/**
 * Closest clear centre for a shape of one or more parts (a face, say, and its
 * chip), each part keeping clear of its own obstacles and within the map.
 * Returns the first part's rect.
 */
function searchShape(pin: Point, parts: readonly Part[], bounds: Bounds, near: number): Rect | null {
  let left = -Infinity, right = Infinity, top = -Infinity, bottom = Infinity;
  for (const part of parts) {
    left = Math.max(left, 2-part.dx); right = Math.min(right, bounds.width-2-part.dx-part.w);
    top = Math.max(top, 2-part.dy); bottom = Math.min(bottom, bounds.height-2-part.dy-part.h);
  }
  if (right < left || bottom < top) return null;
  const clamp = (v: number, a: number, b: number): number => Math.max(a,Math.min(b,v));
  // The nearest free centre lies on a forbidden rectangle's boundary (expanded
  // by the part's size), or on the map edge. Searching those coordinates
  // also handles tight corners between labels without a coarse grid or fixed rows.
  const xs = new Set([clamp(pin.x,left,right),left,right]);
  const ys = new Set([clamp(pin.y,top,bottom),top,bottom]);
  for (const part of parts) for (const box of part.obstacles) {
    xs.add(clamp(box.x-part.dx-part.w-GAP,left,right)); xs.add(clamp(box.x+box.w-part.dx+GAP,left,right));
    ys.add(clamp(box.y-part.dy-part.h-GAP,top,bottom)); ys.add(clamp(box.y+box.h-part.dy+GAP,top,bottom));
  }
  const xx = [...xs].sort((a,b)=>(a-pin.x)**2-(b-pin.x)**2);
  const yy = [...ys].sort((a,b)=>(a-pin.y)**2-(b-pin.y)**2 || a-b);
  let best: Rect | null = null, distance = near === Infinity ? Infinity : near*near + 1e-6;
  for (const x of xx) {
    const dx = (x-pin.x)**2;
    if (dx >= distance) break;
    for (const y of yy) {
      const d = dx+(y-pin.y)**2;
      if (d >= distance) break;
      if (parts.some((part) => { const box = {x:x+part.dx,y:y+part.dy,w:part.w,h:part.h}; return part.obstacles.some(obstacle=>intersects(box,obstacle)); })) continue;
      const first = parts[0]!;
      best = {x:x+first.dx,y:y+first.dy,w:first.w,h:first.h}; distance = d;
    }
  }
  return best;
}

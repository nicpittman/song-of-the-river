/**
 * Small drawing helpers shared by the finds and the fallbacks: shapes that
 * repeat (a blossom, a hoof print, a butterfly) are written once and placed by
 * position, so each drawing file stays a list of what is drawn rather than how.
 */

const num = (v: number): string => (Math.round(v * 100) / 100).toString();

/**
 * Places a shape written in relative path commands (lower case only, after the
 * opening point) at x, y, optionally scaled. `rel` must not contain arcs.
 */
export function place(x: number, y: number, rel: string, scale = 1): string {
  // Each scaled number gets its own leading space: written back to back, "0.5" after "2.75" would read as one number.
  const scaled = scale === 1 ? rel : rel.replace(/-?\d*\.?\d+/g, (m) => ` ${num(Number(m) * scale)}`);
  return `M${num(x)} ${num(y)}${scaled}`;
}

/** Reflects relative path commands left to right (every x delta changes sign). Handles c, s, l, h, v. */
export function mirror(rel: string): string {
  const out: string[] = [];
  const tokens = rel.match(/[a-zA-Z]|-?\d*\.?\d+/g) ?? [];
  let cmd = '';
  let k = 0;
  for (const t of tokens) {
    if (/[a-zA-Z]/.test(t)) {
      cmd = t;
      k = 0;
      out.push(t);
      continue;
    }
    const v = Number(t);
    let flip = false;
    if (cmd === 'h') flip = true;
    else if (cmd === 'c' || cmd === 's' || cmd === 'l' || cmd === 'm') flip = k % 2 === 0;
    out.push(` ${num(flip ? -v : v)}`);
    k++;
  }
  return out.join('').replace(/([a-zA-Z]) /g, '$1');
}

/** Point at an angle (degrees, 0 = up, clockwise) and radius from a centre. */
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}

/**
 * A five-petalled blossom outline as one closed path: each petal swells out
 * from the heart and has the small notch at its tip that a cherry petal has.
 */
export function bloom(cx: number, cy: number, r: number, turn = 0): string {
  const p = (rad: number, deg: number): string => polar(cx, cy, rad, deg).map(num).join(' ');
  let d = `M${p(r * 0.3, turn - 36)}`;
  for (let i = 0; i < 5; i++) {
    const a = turn + i * 72;
    d += `C${p(r * 1.02, a - 44)} ${p(r * 1.14, a - 16)} ${p(r * 0.86, a)}`;
    d += `C${p(r * 1.14, a + 16)} ${p(r * 1.02, a + 44)} ${p(r * 0.3, a + 36)}`;
  }
  return `${d}Z`;
}

/** Short strokes radiating between two radii: spokes, rays, stamens, paddles. */
export function radial(cx: number, cy: number, r0: number, r1: number, count: number, turn = 0): string {
  let d = '';
  for (let i = 0; i < count; i++) {
    const a = turn + (i * 360) / count;
    const [x0, y0] = polar(cx, cy, r0, a);
    const [x1, y1] = polar(cx, cy, r1, a);
    d += `M${num(x0)} ${num(y0)}L${num(x1)} ${num(y1)}`;
  }
  return d;
}

/** A cloven hoof print, pointing up, centred on x, y: two slots side by side. */
export function hoof(x: number, y: number): string {
  const half = 'c-1.9.1-2.7-1.3-2.6-3.3.1-1.9 1-3.5 2.4-4.5.7 2.5.9 5.1.2 7.8Z';
  return place(x - 0.5, y + 3.8, half) + place(x + 0.5, y + 3.8, mirror(half));
}

/** A small paw print (pad and four toes), pointing up, centred on x, y. */
export function paw(x: number, y: number): string {
  const pad = place(x - 1.9, y + 1.3, 'c-.1-1.5.8-2.5 1.9-2.5s2 1 1.9 2.5c-.1 1.1-.9 1.8-1.9 1.8s-1.8-.7-1.9-1.8Z');
  const toe = (tx: number, ty: number): string => place(tx - 0.65, ty, 'c0-.6.3-1 .65-1s.65.4.65 1-.3 1-.65 1-.65-.4-.65-1Z');
  return pad + toe(x - 2.3, y - 1.6) + toe(x - 0.8, y - 2.8) + toe(x + 0.8, y - 2.8) + toe(x + 2.3, y - 1.6);
}

/** A butterfly seen from above, wings open, centred on x, y. Returns [outline, antennae]. */
export function butterfly(x: number, y: number, s = 1): [string, string] {
  const upper = 'c-1.8-3.6-5.4-5-7-3.4-1.4 1.4.6 4.6 7 4.6';
  const lower = 'c-1.4.8-4.4 2-4.8 4.2-.3 1.6 1.6 1.8 3 .6 1-.8 1.6-2.4 1.8-4.6';
  const outline =
    place(x, y - 0.4 * s, upper, s) +
    place(x, y - 0.4 * s, mirror(upper), s) +
    place(x, y + 0.6 * s, lower, s) +
    place(x, y + 0.6 * s, mirror(lower), s) +
    place(x, y - 2.4 * s, 'c.2 2.4.2 4.8 0 7.2', s);
  const feelers = place(x, y - 2.4 * s, 'c-.4-1.4-1.2-2.4-2.2-2.8', s) + place(x, y - 2.4 * s, 'c.4-1.4 1.2-2.4 2.2-2.8', s);
  return [outline, feelers];
}

/** An apple with its dimple at the top centre x, y. */
export function apple(x: number, y: number, s = 1): string {
  return place(
    x,
    y,
    'c-1.6-1.2-4.4-1.6-6.4-.2-2.6 1.8-3.4 5.6-2.4 9 1 3.6 3.6 6 6.4 6 1 0 1.6-.4 2.4-.4s1.4.4 2.4.4c2.8 0 5.4-2.4 6.4-6 1-3.4.2-7.2-2.4-9-2-1.4-4.8-1-6.4.2Z',
    s,
  );
}

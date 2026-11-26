/**
 * Small marks used across the interface: chance pips, the pack knot, the lead
 * mark, closed and special place marks, weather and seasons.
 *
 * Marks are drawn on a 24-unit grid (the pips on a 34 x 12 strip) and keep a
 * pen line of about 1.1 px whatever size they are shown at, because they sit
 * beside text and should weigh what the text weighs.
 */

import type { Wash } from './pen';
import fishIcon from '../assets/resource-fish.png';
import twigIcon from '../assets/resource-twigs.png';

const WASH_HEX: Record<Wash, string> = { river: '#bcd7d6', blossom: '#ecc9c6', leaf: '#cfdcb8', straw: '#e6d7a8' };
const n = (v: number): string => (Math.round(v * 100) / 100).toString();

interface MarkParts {
  wash?: Array<[Wash, string]>;
  line: string[];
  dots?: Array<[number, number, number]>;
}

/** API-generated line drawings with real alpha, kept in the existing inline-mark contract. */
export function resourceMark(kind: 'provisions' | 'materials', size = 24): string {
  const src = kind === 'provisions' ? fishIcon : twigIcon;
  return `<svg class="mark" data-mark="${kind}" width="${size}" height="${size}" viewBox="0 0 128 128" aria-hidden="true" focusable="false"><image href="${src}" width="128" height="128"/></svg>`;
}

/** Inline SVG for a mark on a w x h grid, shown `size` px tall. */
function mark(name: string, w: number, h: number, size: number, parts: MarkParts, extra = ''): string {
  const unit = h / size;
  const stroke = n(1.1 * unit);
  const washes = (parts.wash ?? [])
    .map(([tone, d]) => `<path d="${d}" style="fill:var(--wash-${tone},${WASH_HEX[tone]})"/>`)
    .join('');
  const lines = parts.line.map((d) => `<path d="${d}"/>`).join('');
  const dots = (parts.dots ?? []).map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
  return (
    `<svg class="mark" data-mark="${name}" width="${n((size * w) / h)}" height="${size}" viewBox="0 0 ${w} ${h}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${extra}>` +
    (washes ? `<g stroke="none" transform="translate(.5 .4)" style="mix-blend-mode:multiply">${washes}</g>` : '') +
    lines +
    (dots ? `<g fill="currentColor" stroke="none">${dots}</g>` : '') +
    '</svg>'
  );
}

/* ---------- Chance pips ---------- */

/** A filled pip: a slightly uneven blot of ink rather than a perfect disc. */
const blot = (x: number): string =>
  `M${n(x - 2.1)} 6.1c-.1-1.3.8-2.2 2.1-2.2 1.3 0 2.2.9 2.1 2.1-.1 1.3-.9 2.1-2.2 2.1-1.2 0-2-.8-2-2Z`;
/** An empty pip: a fine open ring, its ends just meeting. */
const hoop = (x: number): string =>
  `M${n(x + 1.9)} 5.5c.3 1.3-.6 2.4-1.8 2.5-1.3.1-2.2-.8-2.1-2.1.1-1.2 1-2.1 2.2-2 .8.1 1.4.5 1.7 1.2`;

export type Chance = 0 | 1 | 2 | 3 | 'certain';

/**
 * Three ink pips for a chance word: unlikely (1), even (2), likely (3), and
 * certain (all three, with a pen loop drawn round them). `size` is the height.
 */
export function pips(chance: Chance, size = 12): string {
  const filled = chance === 'certain' ? 3 : chance;
  const xs = [9, 17, 25];
  const solid: string[] = [];
  const open: string[] = [];
  xs.forEach((x, i) => (i < filled ? solid : open).push(i < filled ? blot(x) : hoop(x)));
  const loop = chance === 'certain'
    ? ['M5 1.9C10.4 .2 24.4 0 30.4 1.8c3.4 1.1 3.4 6.6-.2 8.1-5.8 2.1-18.6 2.3-24.6.3C1.6 8.8 1.4 3.4 7.6 1.3']
    : [];
  const label = chance === 'certain' ? 'certain' : ['none', 'unlikely', 'even', 'likely'][chance];
  return mark(`pips-${label}`, 34, 12, size, { line: [...open, ...loop] }).replace(
    '</svg>',
    `<g fill="currentColor" stroke="none">${solid.map((d) => `<path d="${d}"/>`).join('')}</g></svg>`,
  );
}

/* ---------- The pack knot ---------- */

export type KnotKind = 'plain' | 'unusual' | 'rare';

/** A transparent cloth bundle; a small glint distinguishes special returns. */
export function knot(kind: KnotKind = 'plain', size = 20): string {
  const bundle = 'M4.4 11.8c2.4-1.5 5-2.1 7.6-2.1s5.2.6 7.6 2.1c.9 2.6.9 5.3 0 7.9-2.4 1-5 1.4-7.6 1.4s-5.2-.4-7.6-1.4c-.9-2.6-.9-5.3 0-7.9Z';
  const parts: MarkParts = { line: [bundle, 'M11 9.7C8.8 9 7 7 7.2 5c1.9-.1 3.8 1.6 4.4 4.2M13 9.7c2.2-.7 4-2.7 3.8-4.7-1.9-.1-3.8 1.6-4.4 4.2', 'M10.2 10.6c-1.2 2.2-1.6 4.8-1.4 7.6M13.8 10.6c1.2 2.2 1.6 4.8 1.4 7.6'], dots: [[12, 9.4, .9]] };
  if (kind !== 'plain') parts.wash = [[kind === 'rare' ? 'river' : 'straw', bundle]];
  if (kind === 'rare') parts.line.push('M19.4 1.6c.4 2.6 1.3 3.6 3.4 4.1-2.1.5-3 1.5-3.4 4.1-.4-2.6-1.3-3.6-3.4-4.1 2.1-.5 3-1.5 3.4-4.1Z');
  if (kind === 'unusual') parts.dots!.push([20.4, 5.6, 1.1]);
  return mark(`knot-${kind}`, 24, 24, size, parts);
}

/* ---------- Leads and place states ---------- */

/** A lead: a short dotted trail ending in an open arrowhead, over a dab of straw. */
export function leadMark(size = 20): string {
  return mark('lead', 24, 24, size, {
    wash: [['straw', 'M14.4 4.6c3-1.4 6.4.2 6.6 3.4.2 3.4-2.6 5.6-5.6 5-3-.6-4.2-6.8-1-8.4Z']],
    line: ['M12.6 13.4c2.8-1.6 4.8-3.6 6.6-6.4', 'M14.6 6.2l4.8.6.6 4.6'],
    dots: [[3.6, 20, 1.05], [6.6, 17.6, 1.05], [9.6, 15.4, 1.05]],
  });
}

export type PlaceState = 'open' | 'closed' | 'special';

/**
 * How a place stands today. Open is a small ringed dot; closed is a rope
 * slung between two posts, in rust; special is a four-point star on straw.
 */
export function placeMark(state: PlaceState, size = 20): string {
  if (state === 'closed') {
    return mark('place-closed', 24, 24, size, {
      line: ['M5.6 6.6c-.2 4.6-.1 9 .2 13.4M18.4 6.6c.2 4.6.1 9-.2 13.4', 'M4.2 6.6h2.8M17 6.6h2.8', 'M5.8 9c3.8 4.4 8.6 4.4 12.4 0', 'M12 12.4v1.4', 'M10.3 13.8h3.4l-.2 3.8h-3Z'],
    }, ' style="color:var(--rust-ink,#9c5a3c)"');
  }
  if (state === 'special') {
    const star = 'M12 3.4c.7 4.2 2 6.6 5.6 8.4-3.6 1.8-4.9 4.2-5.6 8.4-.7-4.2-2-6.6-5.6-8.4 3.6-1.8 4.9-4.2 5.6-8.4Z';
    return mark('place-special', 24, 24, size, { wash: [['straw', star]], line: [star] });
  }
  return mark('place-open', 24, 24, size, {
    line: ['M17.6 12.4c-.2 3.2-2.6 5.4-5.8 5.3-3.2-.1-5.5-2.6-5.4-5.7.2-3.1 2.8-5.3 5.9-5.1 2.2.1 3.8 1.2 4.7 2.8'],
    dots: [[12, 12.1, 1.3]],
  });
}

/* ---------- Weather ---------- */

export type WeatherKind = 'clear' | 'mist' | 'rain' | 'snow';

const CLOUD = 'M6.2 13.6c-2 0-3.2-1.3-3.1-2.9.1-1.6 1.5-2.7 3.2-2.5.4-2.6 2.6-4.3 5.2-4.2 2.4.1 4.2 1.6 4.8 3.7 2.2-.4 4.2 1 4.3 3 .1 1.8-1.3 2.9-3.2 2.9Z';

export function weatherMark(kind: WeatherKind, size = 20): string {
  switch (kind) {
    case 'clear':
      return mark('weather-clear', 24, 24, size, {
        wash: [['straw', 'M12 6.4c3.4 0 5.6 2.4 5.6 5.6s-2.4 5.6-5.6 5.6-5.6-2.4-5.6-5.6 2.2-5.6 5.6-5.6Z']],
        line: [
          'M16.4 11.8c.1 2.6-1.8 4.6-4.3 4.6-2.6.1-4.5-1.8-4.5-4.4 0-2.5 1.9-4.4 4.4-4.4 1.6 0 2.8.7 3.6 1.8',
          'M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M18.6 5.4l-1.5 1.5M6.9 17.1l-1.5 1.5',
        ],
      });
    case 'mist':
      return mark('weather-mist', 24, 24, size, {
        wash: [['river', 'M3.6 10.2c4.4-2.2 11.6-2.6 17-.6.8 1.6.6 3.2-.4 4.6-5.4-1.4-11.6-1.2-16.4.6-1-1.4-1.2-3-.2-4.6Z']],
        line: [
          'M3.4 8.6c2.4-1.2 4.8-1.2 7.2 0s4.8 1.2 7.2 0',
          'M6.4 12.6c2.4-1.2 4.8-1.2 7.2 0s4.6 1.2 7 0',
          'M3 16.6c2.4-1.2 4.8-1.2 7.2 0s4.8 1.2 7.2 0',
        ],
      });
    case 'rain':
      return mark('weather-rain', 24, 24, size, {
        wash: [['river', CLOUD]],
        line: [CLOUD, 'M7.4 16.4l-1.2 3M11.6 16.4l-1.2 3M15.8 16.4l-1.2 3'],
      });
    case 'snow':
      return mark('weather-snow', 24, 24, size, {
        wash: [['river', CLOUD]],
        line: [CLOUD],
        dots: [[6.8, 17.4, 0.9], [11.6, 19.6, 0.9], [16.2, 17.2, 0.9], [9.2, 21.8, 0.75], [14.2, 22, 0.75]],
      });
  }
}

/* ---------- Seasons ---------- */

const PETAL = 'M12 11.2c-1.9-1.6-2.4-4.2-1.2-6 .3-.5.8-.5 1 .1l.2.6.2-.6c.2-.6.7-.6 1-.1 1.2 1.8.7 4.4-1.2 6Z';
const MAPLE_HALF: Array<[number, number]> = [[12, 3], [13.6, 7.4], [17.4, 5.4], [16.2, 10], [20.6, 10.6], [16.8, 13.6], [17.8, 16.6], [12.8, 15.4]];
const MAPLE = (() => {
  const right = MAPLE_HALF;
  const left = right.slice(1, -1).reverse().map(([x, y]) => [24 - x, y] as [number, number]);
  return `M${[...right, [12.4, 15.6] as [number, number], [11.6, 15.6] as [number, number], ...left.map(([x, y]) => [x, y] as [number, number])]
    .map(([x, y]) => `${n(x)} ${n(y)}`)
    .join('L')}Z`;
})();

/** The four seasons: blossom, a summer leaf, a maple leaf, a snowflake. 0 is spring. */
export function seasonMark(season: number, size = 20): string {
  switch (((season % 4) + 4) % 4) {
    case 0: {
      const petals = [0, 72, 144, 216, 288].map((a) => transformPath(PETAL, a, 12, 12.4));
      return mark('season-spring', 24, 24, size, {
        wash: [['blossom', 'M12 4.4c4.6 0 7.8 3.4 7.6 7.8-.2 4.2-3.4 7.4-7.6 7.4s-7.6-3.2-7.6-7.6 3-7.6 7.6-7.6Z']],
        line: petals,
        dots: [[12, 12.4, 1.1]],
      });
    }
    case 1:
      return mark('season-summer', 24, 24, size, {
        wash: [['leaf', 'M5 19c-.6-7.4 4-12.8 14.4-14-1 9.6-6.2 14.4-14.4 14Z']],
        line: ['M5 19c-.6-7.4 4-12.8 14.4-14-1 9.6-6.2 14.4-14.4 14Z', 'M4.2 20 15.4 8.8', 'M8.6 15.6l-.2-3.6M11.2 13l-.2-3.4M8.6 15.6l3.6.2M11.2 13l3.4.2'],
      });
    case 2:
      return mark('season-autumn', 24, 24, size, {
        wash: [['straw', MAPLE], ['blossom', 'M12 3.4l4.4 4.4-1 5.6-3.4 2.2-3.4-2.2-1-5.6Z']],
        line: [MAPLE, 'M12 15.6v5.6', 'M12 15.4V7.2M12 12.4l3.6-3.4M12 12.4 8.4 9'],
      });
    default:
      return mark('season-winter', 24, 24, size, {
        wash: [['river', 'M12 3.8c4.8 0 8.2 3.4 8.2 8.2s-3.4 8.2-8.2 8.2-8.2-3.4-8.2-8.2 3.4-8.2 8.2-8.2Z']],
        line: [0, 60, 120].map((a) => rotateFlake(a)),
      });
  }
}

function rotateFlake(deg: number): string {
  const arm = 'M12 3.6V20.4M12 6.4l-2-2M12 6.4l2-2M12 17.6l-2 2M12 17.6l2 2';
  return transformPath(arm, deg, 12, 12);
}

/**
 * Rotates absolute path data about a point. Only the commands used above are
 * supported: M, L, V, H (made absolute) and relative l and c, which rotate as vectors.
 */
function transformPath(d: string, deg: number, cx: number, cy: number): string {
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const rot = (x: number, y: number, about: boolean): [number, number] => {
    const dx = about ? x - cx : x;
    const dy = about ? y - cy : y;
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    return about ? [rx + cx, ry + cy] : [rx, ry];
  };
  const out: string[] = [];
  let px = 0;
  let py = 0;
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+/g) ?? [];
  let i = 0;
  let cmd = '';
  const next = (): number => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === 'M' || cmd === 'L') {
      px = next();
      py = next();
      const [x, y] = rot(px, py, true);
      out.push(`${cmd}${n(x)} ${n(y)}`);
      if (cmd === 'M') cmd = 'L';
    } else if (cmd === 'V' || cmd === 'H') {
      if (cmd === 'V') py = next();
      else px = next();
      const [x, y] = rot(px, py, true);
      out.push(`L${n(x)} ${n(y)}`);
    } else if (cmd === 'l') {
      const [x, y] = rot(next(), next(), false);
      out.push(`l${n(x)} ${n(y)}`);
    } else if (cmd === 'c') {
      const pts: number[] = [];
      for (let k = 0; k < 3; k++) {
        const [x, y] = rot(next(), next(), false);
        pts.push(x, y);
      }
      out.push(`c${pts.map(n).join(' ')}`);
    } else if (cmd === 'Z' || cmd === 'z') {
      out.push('Z');
      cmd = '';
    } else {
      i++;
    }
  }
  return out.join('');
}

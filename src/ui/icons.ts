/**
 * Older interface marks, kept for the parts of the game that still use them:
 * a few pen icons on a 24px grid, the traveller silhouettes of the valley
 * wishes, the brushstroke generator, the journal vignettes and the title's
 * swash. New drawings belong in `sketches/`, which share the same pen.
 */

const icon = (body: string, extra = ''): string =>
  `<svg class="ico" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${extra}>${body}</svg>`;

export const ICONS = {
  routes: icon('<circle cx="5" cy="17" r="2"/><circle cx="19" cy="7" r="2"/><path d="M7 17h4a4 4 0 0 0 0-8H9a3 3 0 0 1 0-6h4M13 7h4"/>'),
  menu: icon('<path d="M5 8.2h14M5 12.2h9.5M5 16.2h12"/>'),
  pause: icon('<path d="M9.6 7.2v9.6M14.4 7.2v9.6"/>'),
  play: icon('<path d="M9 6.9 17.2 12 9 17.1Z"/>'),
  skip: icon('<path d="M6.8 7.2 13.4 12l-6.6 4.8ZM17 7.2v9.6"/>'),
  undo: icon('<path d="M9 6.6 5.2 10.4 9 14.2"/><path d="M5.6 10.4h8.2a4.4 4.4 0 0 1 0 8.8h-2.6"/>'),
  redo: icon('<path d="M15 6.6l3.8 3.8-3.8 3.8"/><path d="M18.4 10.4h-8.2a4.4 4.4 0 0 0 0 8.8h2.6"/>'),
  fit: icon('<path d="M5 9.2V5h4.2M14.8 5H19v4.2M19 14.8V19h-4.2M9.2 19H5v-4.2"/><path d="M9.5 13.6c1.2-1.6 2.6-1.6 3.6-.4s2.3 1.2 3.4-.6" stroke-width="1.2"/>'),
  places: icon('<circle cx="12" cy="12" r="6.8"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><path d="M12 2.8v2M21.2 12h-2M12 21.2v-2M2.8 12h2"/>'),
  close: icon('<path d="M8 8l8 8M16 8l-8 8"/>'),
  check: icon('<path d="M6.2 12.6 10.2 16.4 17.8 7.8"/>'),
  back: icon('<path d="M14.2 6.6 8.8 12l5.4 5.4"/>'),
  lock: icon('<rect x="6.5" y="11" width="11" height="8.2" rx="1.6"/><path d="M9 11V8.6a3 3 0 0 1 6 0V11"/>'),
  leaf: icon('<path d="M6 18c0-7 4.5-11 12-12-.5 7.5-4.8 12-12 12Z"/><path d="M6 18 13 11"/>'),
  book: icon('<path d="M12 7.4C10 6 7.4 5.6 4.8 6v11.4c2.6-.4 5.2 0 7.2 1.4 2-1.4 4.6-1.8 7.2-1.4V6c-2.6-.4-5.2 0-7.2 1.4Z"/><path d="M12 7.4v11.2"/>'),
};

/** Doe with a young stag's antlers, side view, ink silhouette. */
export const DEER = `<svg class="sil" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
<g fill="currentColor">
<path d="M7.6 14.6c.2-1.9 2.6-2.7 6.2-2.6 2.6.1 4.4-.1 5.6-.8l1.8-4.6c.3-.7 1-1 1.7-.9l1.2.3c.6.1 1.1.5 1.3 1l1.4 1.3c.3.3.2.8-.2.9l-2 .4c-.5.1-.9.4-1 .9l-1.6 5.6c-.4 1.6-1.5 2.9-3 3.4l-2.6.7c-2.6.6-5.6.4-7.6-.6-1.2-.6-1.5-1.8-1.2-3Z"/>
<path d="M7.9 14.4c-.6-.4-1.2-.5-1.7-.2.3.8.9 1.2 1.5 1.3Z"/>
<path d="M22.4 6.6c-.9-.3-1.4-1.1-1.4-2 .9.1 1.6.7 1.9 1.6Z"/>
</g>
<g fill="none" stroke="currentColor" stroke-linecap="round">
<path d="M10.2 18.2 9.4 22.6l.3 4M12.4 18.8l.4 3.8-.4 3.8M18.2 18.4l.3 4-.6 4M20.2 17.4l.9 4.6.2 4" stroke-width="1.15"/>
<path d="M23.4 6.4c-.2-1.6-.9-2.8-2.1-3.7M22.7 4.3l1.6-1.4M22.1 3.4l-1.4-.9" stroke-width=".9"/>
</g>
</svg>`;

/** A walker in a kasa hat with a staff and a small pack. */
export const VILLAGER = `<svg class="sil" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
<g fill="currentColor">
<path d="M9.4 9.6c2-2.4 4.2-4 6.6-4.6 2.4.6 4.6 2.2 6.6 4.6-.6.5-1.6.7-3 .7h-7.2c-1.4 0-2.4-.2-3-.7Z"/>
<circle cx="16" cy="11.9" r="1.7"/>
<path d="M13.3 14.2c1.6-.8 3.8-.8 5.4 0l1.1 8.2c-.1.6-.5.9-1.1.9h-5.4c-.6 0-1-.3-1.1-.9Z"/>
<path d="M12.9 14.9c-1.4.2-2.2 1.2-2.3 2.6l-.2 2.6c0 .5.4.8.9.8h1.4Z"/>
</g>
<g fill="none" stroke="currentColor" stroke-linecap="round">
<path d="M14.6 23.2l-.9 4.4M17.6 23.2l1.2 4.4" stroke-width="1.3"/>
<path d="M18.6 15.8l2.8 1.4M22.2 11.8l1.6 16" stroke-width="1"/>
</g>
</svg>`;

/** A river fish (an ayu) holding against the current, over two ripples. */
export const FISH = `<svg class="sil" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
<g fill="currentColor">
<path d="M4.6 15.4c2.6-3.4 6.8-5 11.4-4.6 3.2.3 5.8 1.6 7.8 3.4l4-2.8c.6-.4 1.2.1 1 .7l-1.4 3.7 1.5 3.7c.2.6-.4 1.1-1 .7l-4.1-2.8c-2 1.8-4.6 3-7.8 3.3-4.6.4-8.8-1.2-11.4-4.6-.2-.3-.2-.5 0-.7Z"/>
<path d="M12.6 11.2c1.2-2 3.2-3 5.4-2.8l-.4 2.7Z"/>
<path d="M15.6 19.6c.8 1.3 2.2 1.9 3.6 1.7l-.6-2Z"/>
</g>
<circle cx="8.3" cy="14.9" r=".95" fill="#f6f1e4"/>
<path d="M11.2 12.6c.9 1.6.9 3.6 0 5.2" fill="none" stroke="#f6f1e4" stroke-width=".8" stroke-linecap="round"/>
<path d="M6.4 25.4c1.8-.9 3.6-.9 5.4 0s3.6.9 5.4 0M16.8 28.2c1.4-.7 2.8-.7 4.2 0s2.8.7 4.2 0" fill="none" stroke="currentColor" stroke-width=".9" stroke-linecap="round" opacity=".55"/>
</svg>`;

/** A swallow in flight, wings raised, forked tail. */
export const BIRD = `<svg class="sil" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
<g fill="currentColor">
<path d="M8.2 18.6c4-.4 8.4-1.6 12.4-2.8 1.6-.5 2.8-.9 3.8-1 1-.1 1.9.4 2.3 1.2l1.7.5c.3.1.3.5 0 .6l-1.7.5c-.6 1.5-2.2 2.6-4.4 3.1-3.8.9-8.6.6-14.1-2.1Z"/>
<path d="M14.6 17.6c-.2-4.2 1.2-8.2 4.4-11.4.4-.4 1-.1.9.5-.3 3.4.2 6.8 2 9.6Z"/>
<path d="M16.6 17.8C14.4 12.8 10.4 9 5 7.2c-.6-.2-1 .5-.6.9 3.2 3.2 5.2 7 6 11.2Z"/>
<path d="M9.4 18.4 3.6 16c-.5-.2-.9.4-.5.8l4 2.6-3.4 2.9c-.4.4 0 1 .5.8l6-3.2Z"/>
</g>
</svg>`;

export type TravellerKind = 'deer' | 'villager' | 'fish' | 'bird';
export const traveller = (kind: TravellerKind): string =>
  kind === 'deer' ? DEER : kind === 'fish' ? FISH : kind === 'bird' ? BIRD : VILLAGER;



/** Deterministic jitter so each mark keeps its own hand-drawn shape. */
function rand(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/**
 * A single tapered brushstroke, roughly vertical, in a 10×24 box. Pressure
 * swells early and tails off, with a slight lean and curve that differ per mark.
 */
export function brushStroke(index: number): string {
  const r = rand(index + 7);
  const x0 = 5 + (r() - 0.5) * 2.2;
  const y0 = 2.6 + r() * 1.2;
  const x2 = 5 + (r() - 0.5) * 2.6;
  const y2 = 21.4 - r() * 1.2;
  const cx = 5 + (r() - 0.5) * 3.4;
  const cy = 11 + (r() - 0.5) * 3;
  const maxW = 3.1 + r() * 1.1;
  const N = 12;
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const u = 1 - t;
    const x = u * u * x0 + 2 * u * t * cx + t * t * x2;
    const y = u * u * y0 + 2 * u * t * cy + t * t * y2;
    const dx = 2 * u * (cx - x0) + 2 * t * (x2 - cx);
    const dy = 2 * u * (cy - y0) + 2 * t * (y2 - cy);
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const w = (maxW * Math.sin(Math.PI * Math.pow(t, 0.5)) * (0.92 + 0.08 * Math.sin(t * 9 + index))) / 2 + 0.18;
    left.push(`${(x + nx * w).toFixed(2)} ${(y + ny * w).toFixed(2)}`);
    right.push(`${(x - nx * w).toFixed(2)} ${(y - ny * w).toFixed(2)}`);
  }
  return `M${left.join('L')}L${right.reverse().join('L')}Z`;
}

/** Small ink landscapes for the valley picker, one per valley slot. */
export function vignette(index: number): string {
  const river = 'stroke="#3f7f86" stroke-width="1.4"';
  const ink = 'stroke="currentColor" stroke-width="1.1"';
  const motifs = [
    // Mountain stream through woodland.
    `<path ${ink} d="M4 30 18 13l7 8 9-12 12 14 10-8 12 15"/><path ${ink} opacity=".5" d="M12 34c3-4 5-4 7-1M58 33c2-3 4-3 6 0"/><path ${river} d="M36 22c-3 5 4 7 1 11s-8 4-7 9"/>`,
    // Terraced hills above a village river.
    `<path ${ink} d="M2 26c10-9 20-12 30-10s18 7 34 2"/><path ${ink} opacity=".55" d="M10 29c8-5 16-7 24-6M18 32c7-3 13-4 20-3M44 24c6 0 11-1 18-4"/><path ${river} d="M4 40c14-6 22 0 34-3s18-6 30-2"/>`,
    // Low hills opening to an estuary and the sea.
    `<path ${ink} d="M2 22c8-6 14-7 22-3 6-4 12-5 18-2"/><path ${ink} opacity=".5" d="M46 20h24M52 24h18"/><path ${river} d="M14 42c6-8 14-9 22-11s16-4 34-6"/>`,
  ];
  return `<svg class="vignette" viewBox="0 0 72 44" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${motifs[index % motifs.length]}</svg>`;
}

/** The brush swash under the title, echoing the moodboard lockup. */
export const TITLE_SWASH = `<svg class="swash" viewBox="0 0 220 18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M2 13.6c34-6.4 74-9.4 118-8.6 32 .6 62 3 96-1.6 1.4-.2 2 .9.8 1.5-34 9.6-64 7.7-98 5.6-40-2.4-76-1.4-115.4 4.6-1.9.3-3.1-1.1-1.4-1.5Z"/></svg>`;

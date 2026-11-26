/** A memory of each arrival, drawn with the notebook's pen and two quiet washes. */
import type { Drawing } from './pen';

const mio: Drawing = {
  wash: [['straw', 'M12 25 24 15 37 25 34 28H14ZM15 28h19v12H15Z'], ['blossom', 'M4 18c-4-4 0-9 4-8 2-5 8-3 8 1 5 0 6 6 2 8-3 5-9 4-11 1Z']],
  line: ['M10 26 24 14 39 26 35 29H14Z', 'M15 29v11h19V29M21 40v-8h7v8', 'M6 40c4-8 4-15 3-21M9 27l6-7', 'M33 21v-8h4v11', 'M33 13h4M35 13v-3', 'M2 43c10-3 18-1 25-2 6-1 11 0 18 2'],
  detail: ['M12 24h23M13 27h23', 'M17 31h2v3h-2M30 31h2v3h-2', 'M34 15v3h2v-3', 'M4 14h3M11 12h2M15 16h2M6 20h2', 'M27 43c5-1 9-1 13 1'],
};

const coast: Drawing = {
  wash: [['river', 'M3 34c7-3 13 2 21 0s14-2 21 0v8H3Z'], ['straw', 'M11 17h9v4h-9ZM12 21h7l3 14H9Z']],
  line: ['M10 17h11v4H10ZM12 17v-5l4-3 4 3v5M12 21 9 35h13l-3-14', 'M9 35h13M14 35v-5h3v5', 'M3 38c5-2 8-2 12 0s7 2 11 0 7-2 12 0 5 1 7 0', 'M28 29c4-3 9-3 13 0l-4 4h-6Z', 'M34 29V17l8 11H34', 'M24 11c2-2 4-2 6 0M30 8c2-2 4-2 6 0'],
  detail: ['M13 23h6M11 28h10M14 14h3', 'M4 43c4-1 7-1 10 0M21 43c5-1 8-1 12 0', 'M7 15H3M24 15h4'],
};

const crossing: Drawing = {
  wash: [['river', 'M20 9h9c-4 7-5 14-3 21 1 5 5 10 7 14H20c-3-6-5-10-5-15 0-8 3-15 5-20Z'], ['straw', 'M6 23c10-9 24-9 36 0v6h-7c-3-8-12-8-17 0H6Z']],
  line: ['M6 23c10-9 24-9 36 0v6h-7c-3-8-12-8-17 0H6Z', 'M6 21v-4M42 21v-4M9 20c9-7 22-7 30 0', 'M22 6c-5 6-5 9-6 12M30 6c-4 5-5 7-5 11M17 31c0 4 2 8 5 12M26 31c0 4 2 8 6 12', 'M36 41v-9M32 35l4-6 4 6M34 30l2-5 3 5'],
  detail: ['M10 21v6M16 18v6M23 17v4M30 18v3M37 21v6', 'M20 34h3M23 39h4M2 31l3-3M5 34l2-2'],
};

export const ARRIVALS: Record<string, Drawing> = {
  'arrival-mio': mio, 'place-mio': mio,
  // The chapter arrives on the western bank; the town is reached across its bridge.
  'arrival-kawagiri': crossing, 'place-kawagiri': coast,
};

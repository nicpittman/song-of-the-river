/** A shrinking clockwise arc: one complete turn is the actual sketch window. */
export function sightingClock(age: number, life: number): { from: number; to: number; remaining: number } {
  const remaining = life > 0 ? Math.max(0, Math.min(1, 1 - age / life)) : 0;
  const to = -Math.PI / 2 + Math.PI * 2;
  return { from: to - Math.PI * 2 * remaining, to, remaining };
}

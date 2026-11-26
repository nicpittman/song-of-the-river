import { expect, it } from 'vitest';
import { travelFraming } from './travelFraming';

it.each([390, 1280])('keeps the party in view on a %s px screen even when the mist and landmark are far away', width => {
  const group = { x: 900, y: 4800 }, zoom = .36, height = 800;
  for (const offset of [-5000, 5000]) {
    const target = travelFraming(group, group.x + offset, group.y + offset, width, height, zoom, width < 700);
    expect(Math.abs(target.x - group.x) * zoom).toBeLessThanOrEqual(width * .16 + .001);
    expect(Math.abs(target.y - group.y) * zoom).toBeLessThanOrEqual(height * .18 + .001);
  }
});

import { expect, it } from 'vitest';
import { contactMode, GROUND_TONE, gradeContactPixels } from './groundGrade';

/** A grey block standing on the ground row, transparent above `top`. */
function block(w: number, h: number, top: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = top; y < h; y++) for (let x = 0; x < w; x++) px.set([90, 90, 90, 255], (y * w + x) * 4);
  return px;
}

it('grades only the foot of a standing sprite toward the season and softens its last edge', () => {
  const w = 60, h = 80;
  const summer = block(w, h, 10);
  gradeContactPixels(summer, w, h, 1, 1, 'stand', 7);
  const at = (px: Uint8ClampedArray, x: number, y: number): number[] => [...px.slice((y * w + x) * 4, (y * w + x) * 4 + 4)];
  // The top of the block is untouched.
  expect(at(summer, 30, 20)).toEqual([90, 90, 90, 255]);
  // Near the foot it leans to the summer grass (more red/green than blue) and the edge softens.
  const foot = at(summer, 30, h - 3);
  expect(foot[1]!).toBeGreaterThan(foot[2]!);
  expect(at(summer, 30, h - 1)[3]!).toBeLessThan(255);

  const winter = block(w, h, 10);
  gradeContactPixels(winter, w, h, 3, 1, 'stand', 7);
  // Snow banks up: somewhere along the foot it is far lighter and bluer than the grey stone.
  let snowy = 0;
  for (let x = 0; x < w; x++) if (at(winter, x, h - 3)[2]! > 150) snowy++;
  expect(snowy).toBeGreaterThan(w * 0.3);
  expect(GROUND_TONE[3][2]).toBeGreaterThan(GROUND_TONE[1][2]);
});

it('leaves overhangs alone and skips flat and water-borne pieces', () => {
  const w = 60, h = 80;
  // A ledge whose lowest pixel hangs far above the ground row.
  const ledge = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < 20; y++) for (let x = 0; x < w; x++) ledge.set([90, 90, 90, 255], (y * w + x) * 4);
  const before = ledge.slice();
  gradeContactPixels(ledge, w, h, 1, 1, 'stand');
  expect(ledge).toEqual(before);
  expect(contactMode('cottage', 'hard')).toBe('stand');
  expect(contactMode('wildflowers-winter', 'herb')).toBe('cover');
  expect(contactMode('river-stones', 'hard')).toBeNull();
  expect(contactMode('peak-0', 'deciduous')).toBeNull();
  expect(contactMode('heron', 'none')).toBeNull();
});

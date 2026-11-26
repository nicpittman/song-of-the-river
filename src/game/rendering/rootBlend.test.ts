import { expect, it } from 'vitest';
import { blendRootPixels } from './rootBlend';

it('grades only the tree footing, preserves the trunk, and softens the side fringe', () => {
  const width = 100, height = 100;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set([60, 70, 45, 255], i);
  const offset = (x: number, y: number): number => (y * width + x) * 4;
  pixels.set([120, 130, 140, 0], offset(10, 99));
  const before = pixels.slice();
  blendRootPixels(pixels, width, height, 0);
  expect(pixels.slice(0, offset(0, 82))).toEqual(before.slice(0, offset(0, 82)));
  expect(pixels.slice(offset(10, 99), offset(10, 99) + 4)).toEqual(before.slice(offset(10, 99), offset(10, 99) + 4));
  expect(pixels[offset(0, 99)]).toBeGreaterThan(60);
  expect(pixels[offset(0, 99) + 3]).toBeLessThan(255);
  expect(pixels[offset(50, 99) + 3]).toBeGreaterThan(235);
  expect(pixels[offset(50, 99) + 3]).toBeGreaterThan(pixels[offset(0, 99) + 3]!);
});

it('uses seasonal soil colour and produces repeatable texture edges', () => {
  const base = new Uint8ClampedArray(40 * 100 * 4).fill(255);
  const summer = base.slice(), winter = base.slice(), repeated = base.slice();
  blendRootPixels(summer, 40, 100, 1, .5, 42);
  blendRootPixels(winter, 40, 100, 3, .5, 42);
  blendRootPixels(repeated, 40, 100, 1, .5, 42);
  expect(summer).toEqual(repeated);
  const i = 99 * 40 * 4;
  expect(winter[i + 2]).toBeGreaterThan(summer[i + 2]!);
  expect(winter[i + 3]).toBe(summer[i + 3]);
});

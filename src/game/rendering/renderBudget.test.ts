import { expect, it } from 'vitest';
import { renderResolution } from './renderBudget';

it('retains the existing detail on ordinary and mobile viewports', () => {
  expect(renderResolution(1440, 900, 2)).toBe(1.5);
  expect(renderResolution(390, 844, 3)).toBe(1.5);
  expect(renderResolution(1920, 1080, 1)).toBe(1);
});

it('bounds extra Retina pixels on large displays while preserving native resolution', () => {
  const ratio = renderResolution(2298, 1662, 2);
  expect(ratio).toBeGreaterThanOrEqual(1);
  expect(2298 * 1662 * ratio ** 2).toBeCloseTo(5_000_000);
  expect(renderResolution(3840, 2160, 2)).toBe(1);
});

it('handles loading-size canvases and missing pixel ratios', () => {
  expect(renderResolution(0, 0, 2)).toBe(1.5);
  expect(renderResolution(1440, 900, NaN)).toBe(1);
});

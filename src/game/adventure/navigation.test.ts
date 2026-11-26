import { expect, it } from 'vitest';
import { segmentEntersRectangle } from './navigation';

it('detects walls between otherwise clear grid nodes in both directions', () => {
  const shed = { left: 574, right: 626, top: 292, bottom: 318 };
  expect(segmentEntersRectangle({ x: 608, y: 288 }, { x: 608, y: 320 }, shed)).toBe(true);
  expect(segmentEntersRectangle({ x: 608, y: 320 }, { x: 608, y: 288 }, shed)).toBe(true);
  expect(segmentEntersRectangle({ x: 550, y: 290 }, { x: 650, y: 320 }, shed)).toBe(true);
  expect(segmentEntersRectangle({ x: 560, y: 288 }, { x: 560, y: 320 }, shed)).toBe(false);
  expect(segmentEntersRectangle({ x: 574, y: 288 }, { x: 574, y: 320 }, shed)).toBe(false);
  expect(segmentEntersRectangle({ x: 570, y: 288 }, { x: 574, y: 292 }, shed)).toBe(false);
});

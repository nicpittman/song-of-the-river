import { expect, it } from 'vitest';
import { Container, Sprite, Texture } from 'pixi.js';
import { coverOver } from './sightings';

function rock(x: number, y: number, w: number, h: number): Sprite {
  const s = new Sprite(Texture.WHITE);
  s.anchor.set(0.5, 1);
  s.width = w; s.height = h;
  s.position.set(x, y);
  s.zIndex = y;
  return s;
}

it('finds the scenery drawn over a creature, so the creature can sit on top of it', () => {
  const sorted = new Container();
  const creature = new Sprite(Texture.WHITE);
  creature.zIndex = 100;
  const front = rock(200, 130, 80, 60); // base below the creature, covering it
  const behind = rock(200, 90, 80, 60); // further back: drawn under the creature anyway
  const aside = rock(400, 130, 80, 60); // in front, but somewhere else
  sorted.addChild(creature, front, behind, aside);
  expect(coverOver(creature, 200, 95, 100)).toBe(130);
  sorted.removeChild(front);
  expect(coverOver(creature, 200, 95, 100)).toBe(-Infinity);
});

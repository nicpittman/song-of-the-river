import { expect, it, vi } from 'vitest';
import { Controls, Sky, stepSun } from './dayLine';
import { newExpedition } from '../../game/adventure/testing';

it('moves the sun continuously between clock samples without overshoot or backward steps', () => {
  let shown = 0;
  let previous = 0;
  for (let frame = 0; frame <= 1800; frame++) {
    const target = Math.floor(frame / 3) * 3 / 1800;
    shown = stepSun(shown, target, 1 / 60);
    expect(shown).toBeGreaterThanOrEqual(previous);
    expect(shown).toBeLessThanOrEqual(target);
    expect(shown - previous).toBeLessThan(.002);
    previous = shown;
  }
});

it('holds on pause, smoothly reaches evening and resets only for a new morning', () => {
  expect(stepSun(null, .4, 0)).toBe(.4);
  expect(stepSun(.4, .5, 0)).toBe(.4);
  const dusk = stepSun(.8, 1, 1 / 60);
  expect(dusk).toBeGreaterThan(.8);
  expect(dusk).toBeLessThan(.85);
  expect(stepSun(dusk, 0, 0)).toBe(0);
  expect(stepSun(.5, .4, 1 / 60)).toBe(.5);
});

it('reads a loaded journey’s own daylight instead of retaining the previous session’s dusk', () => {
  const { a } = newExpedition();
  const sun = { setAttribute: vi.fn() };
  const sky = Object.assign(Object.create(Sky.prototype), {
    sun, sunProgress: .9, sunChart: {}, key: '', weather: {}, river: {},
    daylight: { setAttribute: vi.fn() }, el: { setAttribute: vi.fn() },
  });
  sky.update({ ...a.view(), phase: 'day', dayProgress: .3 });
  expect(sky.sunProgress).toBe(.3);
  expect(sun.setAttribute).toHaveBeenCalledWith('transform', expect.stringContaining('translate(64.8 '));
});

it('keeps skip, pause and speed available on an all-companions construction day', () => {
  const { a } = newExpedition();
  a.state.region = 1; a.state.materials = 20;
  for (const friend of a.state.people) friend.base = 1;
  a.state.discoveries['aki-meeting'] = { day: 1, by: 'sora' };
  expect(a.place('cottage', { x: 500, y: 3210 }).ok).toBe(true);
  expect(a.begin().ok).toBe(true);
  expect(a.state.outings).toHaveLength(0);
  const button = () => ({ hidden: true, setAttribute: vi.fn() });
  const pause = button(), skip = button(), speed = button();
  const controls = Object.assign(Object.create(Controls.prototype), {
    el: { classList: { toggle: vi.fn() } }, pause, skip, speed, key: '',
  }) as Controls;
  controls.update(a.view());
  expect([pause.hidden, skip.hidden, speed.hidden]).toEqual([false, false, false]);
});

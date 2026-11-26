import { expect, it, vi } from 'vitest';
import { AdventureSession } from './adventureSession';
import { newExpedition, runUntil } from './adventure/testing';
import { FiresideUnpack } from './rendering/adventure/fireside';

function sessionAtFire() {
  const { a, sim } = newExpedition();
  a.rest('sora'); a.begin(); runUntil(sim, () => a.state.phase === 'evening');
  const camera = { x: 900, y: 900, zoom: 1, taken: 3 };
  const fireside = new FiresideUnpack(), step = vi.spyOn(fireside, 'step').mockReturnValue(null);
  const session = Object.assign(Object.create(AdventureSession.prototype), {
    sim: { expedition: a }, view: { camera }, fireside,
    firesideFocus: { at: { x: 500, y: 1800 }, zoom: 1, taken: camera.taken, left: 1.8 },
  }) as unknown as { stepFireside(dt: number): void };
  return { session, camera, step };
}

it('waits for the hearth framing before starting evening notices after a distant pan', () => {
  const { session, camera, step } = sessionAtFire();
  session.stepFireside(.5); expect(step).not.toHaveBeenCalled();
  camera.x = 500; camera.y = 1800;
  session.stepFireside(.1); expect(step).toHaveBeenCalledOnce();
});

it('yields to a new camera gesture and never waits forever at the landscape boundary', () => {
  const first = sessionAtFire(); first.camera.taken++;
  first.session.stepFireside(.1); expect(first.step).toHaveBeenCalledOnce();
  const second = sessionAtFire();
  for (let i = 0; i < 20; i++) second.session.stepFireside(.1);
  expect(second.step).toHaveBeenCalled();
});

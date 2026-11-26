import { afterEach, expect, it, vi } from 'vitest';
import { AdventureSession } from './adventureSession';
import { newExpedition } from './adventure/testing';

afterEach(() => vi.restoreAllMocks());

function openingSession() {
  const { a } = newExpedition();
  const events: string[] = [];
  const finishOpening = vi.fn();
  const session = Object.assign(Object.create(AdventureSession.prototype), {
    sim: { expedition: a },
    host: {
      reducedMotion: false, app: { screen: { width: 1200 } },
      ui: { playOpening: () => events.push('hold notebook') },
    },
    view: { camera: { focus: vi.fn(), snap: vi.fn() } },
    refresh: () => events.push('first snapshot'), finishOpening,
  }) as AdventureSession;
  // Private presentation methods are exercised without a renderer or wall-clock waits.
  return { session: session as unknown as { beginOpening(): void; stageOpening(scene: { figures: [] }): void }, events, finishOpening };
}

it('holds notebook updates before the first snapshot, leaving the fold until after the intro', () => {
  const { session, events } = openingSession();
  session.beginOpening();
  expect(events).toEqual(['hold notebook', 'first snapshot']);
});

it('ends the introductory caption at ten seconds', () => {
  const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
  const { session, finishOpening } = openingSession();
  session.beginOpening();
  Object.assign(session, { opening: { start: 1000, t: 0, eased: true } });
  now.mockReturnValue(10999);
  session.stageOpening({ figures: [] });
  expect(finishOpening).not.toHaveBeenCalled();
  now.mockReturnValue(11000);
  session.stageOpening({ figures: [] });
  expect(finishOpening).toHaveBeenCalledOnce();
});

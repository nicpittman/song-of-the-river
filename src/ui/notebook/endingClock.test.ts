import { afterEach, expect, it, vi } from 'vitest';
import { ENDING_CREDITS_MS, EndingClock, JOURNEY_MEMORY_MS, rollCredits } from './endingClock';
afterEach(() => vi.useRealTimers());
it('returns to the menu after credits without relying on an animation-end event', () => {
  vi.useFakeTimers(); const finish = vi.fn(); const clock = new EndingClock();
  clock.start(finish); vi.advanceTimersByTime(ENDING_CREDITS_MS - 1); expect(finish).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1); expect(finish).toHaveBeenCalledOnce();
});
it('cancels an old ending when leaving or starting another replay', () => {
  vi.useFakeTimers(); const old = vi.fn(), current = vi.fn(); const clock = new EndingClock();
  clock.start(old); vi.advanceTimersByTime(2000); clock.start(current);
  vi.advanceTimersByTime(ENDING_CREDITS_MS); expect(old).not.toHaveBeenCalled(); expect(current).toHaveBeenCalledOnce();
  clock.start(old); clock.stop(); vi.runAllTimers(); expect(old).not.toHaveBeenCalled();
});

it('rolls the entire measured credits with continuous linear movement', () => {
  const animation = { cancel: vi.fn() };
  const animate = vi.fn(() => animation);
  expect(rollCredits({ scrollHeight: 1400, animate } as unknown as HTMLElement, { clientHeight: 300 } as HTMLElement)).toBe(animation);
  expect(animate).toHaveBeenCalledWith([
    { transform: 'translateY(210px)' }, { transform: 'translateY(-1235px)' },
  ], { duration: ENDING_CREDITS_MS, easing: 'linear', fill: 'both' });
});

it('turns journal recap pages at the faster cadence without triggering stale credit timers', () => {
  vi.useFakeTimers(); const clock = new EndingClock();
  const creditsDone = vi.fn(), nextMemory = vi.fn();
  clock.start(creditsDone);
  clock.start(nextMemory, JOURNEY_MEMORY_MS);
  vi.advanceTimersByTime(JOURNEY_MEMORY_MS - 1); expect(nextMemory).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1); expect(nextMemory).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(ENDING_CREDITS_MS); expect(creditsDone).not.toHaveBeenCalled();
});

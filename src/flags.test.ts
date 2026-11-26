import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it.each([false, true])('enables Review only when the development build flag is %s', async dev => {
  vi.stubEnv('DEV', dev); vi.resetModules();
  expect((await import('./flags')).REVIEW_TOOLS).toBe(dev);
});

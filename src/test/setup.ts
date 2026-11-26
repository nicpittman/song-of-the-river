/** Pixi checks the user agent at import time, including in Node-only rule tests.
 * Vitest's isolated VM does not always inherit Node 22's navigator global.
 * Supply just that capability; renderer tests still do not have a browser DOM.
 */
if (typeof navigator === 'undefined') {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'Node.js' } });
}

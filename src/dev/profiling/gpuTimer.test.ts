import { expect, it, vi } from 'vitest';
import { GpuTimer } from './gpuTimer';
function fixture(supported = true) {
  const gl = { CURRENT_QUERY: 1, QUERY_RESULT_AVAILABLE: 2, QUERY_RESULT: 3,
    getExtension: () => supported ? { TIME_ELAPSED_EXT: 4, GPU_DISJOINT_EXT: 5 } : null,
    isContextLost: () => false, getQuery: () => null, createQuery: vi.fn(() => ({})), beginQuery: vi.fn(), endQuery: vi.fn(), deleteQuery: vi.fn(),
    getParameter: vi.fn(() => false), getQueryParameter: vi.fn((_q: unknown, parameter: number): boolean | number => parameter === 2 ? false : 6_500_000),
  };
  return { gl, timer: new GpuTimer(gl as unknown as WebGL2RenderingContext) };
}
it('polls GPU availability asynchronously and converts only a valid GPU result from nanoseconds', () => {
  const { gl, timer } = fixture(); const result = vi.fn();
  timer.begin(result); timer.end(); timer.poll();
  expect(result).not.toHaveBeenCalled(); expect(timer.outstanding).toBe(1);
  expect(gl.getQueryParameter.mock.calls.every(call => call[1] === gl.QUERY_RESULT_AVAILABLE)).toBe(true);
  gl.getQueryParameter.mockImplementation((_q, parameter) => parameter === 2 ? true : 6_500_000);
  timer.poll(); expect(result).toHaveBeenCalledWith(6.5); expect(timer.outstanding).toBe(0);
});
it('discards pending GPU samples on a disjoint event', () => {
  const { gl, timer } = fixture(); const result = vi.fn();
  timer.begin(result); timer.end(); gl.getParameter.mockReturnValue(true); timer.poll();
  expect(timer.disjoint).toBe(true); expect(result).not.toHaveBeenCalled(); expect(gl.deleteQuery).toHaveBeenCalledOnce();
});
it('keeps unsupported GPU timing absent and bounds pending queries without blocking', () => {
  const unsupported = fixture(false); unsupported.timer.begin(vi.fn()); unsupported.timer.end();
  expect(unsupported.timer.supported).toBe(false); expect(unsupported.gl.createQuery).not.toHaveBeenCalled();
  const { gl, timer } = fixture();
  for (let i = 0; i < 40; i++) { timer.begin(vi.fn()); timer.end(); }
  expect(timer.outstanding).toBe(12); expect(gl.createQuery).toHaveBeenCalledTimes(12);
  timer.clear(); expect(timer.outstanding).toBe(0); expect(gl.deleteQuery).toHaveBeenCalledTimes(12);
});

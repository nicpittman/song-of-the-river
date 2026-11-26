import { expect, it } from 'vitest';
import { distribution, summarise, type FrameSample } from './metrics';

it('keeps CPU, intentional 30 fps intervals and real GPU timings separate', () => {
  const frames: FrameSample[] = [0, 1, 2].map(i => ({ at: i * 1000 / 30, interval: i ? 1000 / 30 : null,
    cpu: 3, renderCpu: 1, gpu: null, draws: 10, triangles: 200, uploads: 0 }));
  const summary = summarise(frames, 100, 30, false);
  expect(summary.gpuMs).toBeNull(); expect(summary.cpuMs?.mean).toBe(3);
  expect(summary.missedFrameBudget).toBe(0); expect(summary.renderedFps).toBe(30);
  frames[0]!.gpu = 6;
  expect(summarise(frames, 100, 30, false).gpuMs?.mean).toBe(6);
  expect(summarise(frames, 100, 30, true).gpuMs).toBeNull();
});
it('ignores invalid measurements, handles no samples and does not conflate a percentile with a maximum', () => {
  expect(distribution([])).toBeNull();
  const d = distribution([...Array(99).fill(2), 80, NaN, Infinity, -1])!;
  expect(d.samples).toBe(100); expect(d.p95).toBe(2); expect(d.max).toBe(80);
});

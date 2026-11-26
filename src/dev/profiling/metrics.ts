/** Diagnostics only. GPU duration never comes from a CPU clock or a frame interval. */
export interface Distribution { samples: number; mean: number; p50: number; p95: number; max: number }
export interface FrameSample {
  at: number;
  interval: number | null;
  cpu: number;
  renderCpu: number;
  gpu: number | null;
  draws: number;
  triangles: number;
  uploads: number;
}
export function distribution(values: readonly number[]): Distribution | null {
  const sorted = values.filter(value => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const percentile = (p: number) => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]!;
  return { samples: sorted.length, mean: sorted.reduce((sum, n) => sum + n, 0) / sorted.length,
    p50: percentile(.5), p95: percentile(.95), max: sorted.at(-1)! };
}
export function summarise(frames: readonly FrameSample[], duration: number, targetFps: number, disjoint: boolean) {
  const values = (key: 'cpu' | 'renderCpu' | 'draws' | 'triangles' | 'uploads') => distribution(frames.map(frame => frame[key]));
  const intervals = frames.flatMap(frame => frame.interval === null ? [] : [frame.interval]);
  return {
    frames: frames.length, durationMs: duration, targetFps, renderedFps: duration > 0 ? frames.length * 1000 / duration : 0,
    cpuMs: values('cpu'), renderSubmissionMs: values('renderCpu'), frameIntervalMs: distribution(intervals),
    // Any disjoint event invalidates GPU results from the entire measurement window.
    gpuMs: disjoint ? null : distribution(frames.flatMap(frame => frame.gpu === null ? [] : [frame.gpu])),
    gpuDisjoint: disjoint, draws: values('draws'), triangles: values('triangles'), textureUploads: values('uploads'),
    missedFrameBudget: intervals.filter(interval => interval > 1000 / targetFps * 1.5).length,
  };
}

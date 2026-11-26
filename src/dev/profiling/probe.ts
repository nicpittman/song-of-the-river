import { UPDATE_PRIORITY, type Application } from 'pixi.js';
import { GpuTimer } from './gpuTimer';
import { summarise, type FrameSample } from './metrics';

type Method = (...args: number[]) => unknown;
interface RenderHost { render(...args: unknown[]): unknown }
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Hooks exist only on the dedicated dev page and are removed after a suite. */
export class FrameProbe {
  private readonly renderer: RenderHost;
  private readonly render: RenderHost['render'];
  private readonly restored: Array<() => void> = [];
  private readonly timer: GpuTimer;
  private readonly sections: Array<() => void> = [];
  private renderDepth = 0;
  private current: FrameSample | null = null;
  private frames: FrameSample[] | null = null;
  private previous: number | null = null;
  private tickAt = 0;
  private observed: PerformanceObserver | null = null;
  private longTasks: Array<{ at: number; ms: number }> = [];
  private cpuSections = new Map<string, number[]>();
  constructor(readonly app: Application, readonly gl: WebGL2RenderingContext) {
    this.timer = new GpuTimer(gl);
    this.renderer = app.renderer as unknown as RenderHost;
    this.render = this.renderer.render;
    this.renderer.render = (...args) => {
      const sample = this.current;
      if (!sample || this.renderDepth) return Reflect.apply(this.render, this.renderer, args);
      const started = performance.now(); this.renderDepth++;
      const timed = this.timer.begin(ms => { sample.gpu = ms; });
      try { return Reflect.apply(this.render, this.renderer, args); }
      finally { if (timed) this.timer.end(); this.renderDepth--; sample.renderCpu += performance.now() - started; }
    };
    for (const [name, count, instances] of [
      ['drawArrays', 2, -1], ['drawElements', 1, -1], ['drawArraysInstanced', 2, 3], ['drawElementsInstanced', 1, 4],
    ] as const) this.hook(gl, name, args => {
      const sample = this.current; if (!sample) return;
      sample.draws++;
      const n = args[count] ?? 0, mode = args[0];
      const triangles = mode === gl.TRIANGLES ? n / 3 : mode === gl.TRIANGLE_STRIP || mode === gl.TRIANGLE_FAN ? Math.max(0, n - 2) : 0;
      sample.triangles += triangles * (instances < 0 ? 1 : args[instances] ?? 1);
    });
    for (const name of ['texImage2D', 'texSubImage2D', 'texImage3D', 'texSubImage3D']) this.hook(gl, name, () => { if (this.current) this.current.uploads++; });
    app.ticker.add(this.before, this, UPDATE_PRIORITY.HIGH + 100);
    app.ticker.add(this.after, this, UPDATE_PRIORITY.UTILITY - 100);
    if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('longtask')) {
      this.observed = new PerformanceObserver(list => { for (const entry of list.getEntries()) this.longTasks.push({ at: entry.startTime, ms: entry.duration }); });
      this.observed.observe({ type: 'longtask' });
    }
  }
  get gpuSupported(): boolean { return this.timer.supported; }
  private hook(host: object, key: string, count: (args: number[]) => void): void {
    const methods = host as Record<string, Method>;
    const original = methods[key]; if (typeof original !== 'function') return;
    const hadOwn = Object.hasOwn(host, key);
    methods[key] = function (...args) { count(args); return Reflect.apply(original, this, args); };
    this.restored.push(() => { if (hadOwn) methods[key] = original; else delete methods[key]; });
  }
  /** Inclusive CPU timings; parent and child timings must never be added together. */
  section(host: object, name: string, label: string): void {
    const methods = host as Record<string, (...args: unknown[]) => unknown>;
    const original = methods[name]; if (typeof original !== 'function') return;
    const hadOwn = Object.hasOwn(host, name), probe = this;
    methods[name] = function (...args) {
      if (!probe.frames) return Reflect.apply(original, this, args);
      const started = performance.now();
      try { return Reflect.apply(original, this, args); }
      finally { const values = probe.cpuSections.get(label) ?? []; values.push(performance.now() - started); probe.cpuSections.set(label, values); }
    };
    this.sections.push(() => { if (hadOwn) methods[name] = original; else delete methods[name]; });
  }
  resetSections(): void {
    for (const restore of this.sections.splice(0).reverse()) restore();
    this.cpuSections.clear();
  }
  private before(): void {
    this.timer.poll();
    if (!this.frames) return;
    const now = performance.now(); this.tickAt = now;
    this.current = { at: now, interval: this.previous === null ? null : now - this.previous, cpu: 0, renderCpu: 0, gpu: null, draws: 0, triangles: 0, uploads: 0 };
    this.previous = now;
  }
  private after(): void {
    if (!this.current || !this.frames) return;
    this.current.cpu = performance.now() - this.tickAt;
    this.frames.push(this.current); this.current = null;
  }
  async sample(ms: number) {
    if (document.hidden) throw new Error('Keep the profiling tab visible. Background throttling invalidates the capture.');
    if (this.gl.isContextLost()) throw new Error('The WebGL context was lost. Reload before profiling.');
    this.timer.reset(); this.previous = null; this.cpuSections.clear();
    const frames: FrameSample[] = []; this.frames = frames;
    const started = performance.now();
    let hidden = false;
    const changed = () => { hidden ||= document.hidden; };
    document.addEventListener('visibilitychange', changed);
    await delay(ms);
    const ended = performance.now(); this.frames = null; this.current = null;
    document.removeEventListener('visibilitychange', changed);
    // Yield to the driver; never synchronously wait for the GPU.
    const deadline = performance.now() + 1500;
    while (this.timer.outstanding && performance.now() < deadline) { await delay(25); this.timer.poll(); }
    if (this.gl.isContextLost()) throw new Error('WebGL was lost during capture; the window was discarded.');
    if (hidden) throw new Error('The tab was hidden during capture; this window was discarded.');
    const { distribution } = await import('./metrics');
    return { ...summarise(frames, ended - started, this.app.ticker.maxFPS || 60, this.timer.disjoint),
      cpuSections: Object.fromEntries([...this.cpuSections].map(([name, values]) => [name, distribution(values)])),
      longTasks: this.longTasks.filter(task => task.at >= started && task.at < ended),
      pendingGpuQueries: this.timer.outstanding, samples: frames,
    };
  }
  dispose(): void {
    this.frames = null; this.current = null;
    this.timer.clear(); this.observed?.disconnect();
    this.app.ticker.remove(this.before, this); this.app.ticker.remove(this.after, this);
    this.renderer.render = this.render; this.resetSections();
    for (const restore of this.restored.reverse()) restore();
  }
}

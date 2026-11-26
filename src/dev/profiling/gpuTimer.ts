/** Khronos asynchronous timer-query protocol: no finish(), readPixels() or busy waiting. */
interface TimerExtension { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number }
interface Pending { query: WebGLQuery; result(ms: number): void }
export class GpuTimer {
  private readonly extension: TimerExtension | null;
  private readonly pending: Pending[] = [];
  private active: Pending | null = null;
  disjoint = false;
  constructor(private readonly gl: WebGL2RenderingContext) {
    this.extension = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension | null;
  }
  get supported(): boolean { return !!this.extension; }
  get outstanding(): number { return this.pending.length; }
  begin(result: (ms: number) => void): boolean {
    if (!this.extension || this.active || this.pending.length >= 12 || this.disjoint || this.gl.isContextLost()) return false;
    // Do not interfere with another developer tool's query.
    if (this.gl.getQuery(this.extension.TIME_ELAPSED_EXT, this.gl.CURRENT_QUERY)) return false;
    const query = this.gl.createQuery();
    if (!query) return false;
    this.active = { query, result };
    this.gl.beginQuery(this.extension.TIME_ELAPSED_EXT, query);
    return true;
  }
  end(): void {
    if (!this.active || !this.extension) return;
    this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);
    this.pending.push(this.active); this.active = null;
  }
  poll(): void {
    if (!this.extension || this.gl.isContextLost()) return;
    if (this.gl.getParameter(this.extension.GPU_DISJOINT_EXT)) { this.disjoint = true; this.clear(); return; }
    for (let i = 0; i < this.pending.length;) {
      const item = this.pending[i]!;
      if (!this.gl.getQueryParameter(item.query, this.gl.QUERY_RESULT_AVAILABLE)) { i++; continue; }
      const ns = Number(this.gl.getQueryParameter(item.query, this.gl.QUERY_RESULT));
      this.gl.deleteQuery(item.query); this.pending.splice(i, 1);
      if (Number.isFinite(ns) && ns >= 0) item.result(ns / 1e6);
    }
  }
  reset(): void { this.clear(); this.disjoint = false; }
  clear(): void {
    if (this.active) { this.end(); }
    for (const { query } of this.pending) this.gl.deleteQuery(query);
    this.pending.length = 0;
  }
}

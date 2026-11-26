import { dist, type Vec } from '../../core/math';

interface Walker { id: string; at: Vec; moving: boolean }
interface Print extends Vec { angle: number; atTime: number }

/** Tracks follow visible feet, so villagers and animals leave them too, even without an expedition route. */
export class SnowTracks {
  private time = 0;
  private readonly trails = new Map<string, { last: Vec; prints: Print[]; seen: number }>();

  update(walkers: readonly Walker[], dt: number): Array<Print & { alpha: number }> {
    this.time += dt;
    for (const walker of walkers) {
      let trail = this.trails.get(walker.id);
      if (!trail) { trail = { last: { ...walker.at }, prints: [], seen: this.time }; this.trails.set(walker.id, trail); }
      trail.seen = this.time;
      const gap = dist(trail.last, walker.at);
      if (gap > 100) { trail.last = { ...walker.at }; continue; } // arrival, load or camera scene change
      if (!walker.moving || gap < 9) continue;
      const angle = Math.atan2(walker.at.y - trail.last.y, walker.at.x - trail.last.x);
      trail.prints.push({ ...trail.last, angle, atTime: this.time });
      if (trail.prints.length > 12) trail.prints.shift();
      trail.last = { ...walker.at };
    }
    const shown: Array<Print & { alpha: number }> = [];
    for (const [id, trail] of this.trails) {
      trail.prints = trail.prints.filter(print => this.time - print.atTime < 9);
      for (const print of trail.prints) shown.push({ ...print, alpha: .5 * (1 - (this.time - print.atTime) / 9) });
      if (this.time - trail.seen > 9) this.trails.delete(id);
    }
    return shown;
  }

  clear(): void { this.trails.clear(); }
}

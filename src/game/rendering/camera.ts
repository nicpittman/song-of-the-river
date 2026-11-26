/**
 * Pan and zoom over the valley, built to feel direct:
 *
 *   - Dragging moves the map exactly with the finger, with no easing lag, and
 *     letting go while moving lets it glide to rest.
 *   - Zooming holds the point under the cursor or between the fingers still on
 *     screen for the whole of the motion.
 *   - Everything else (fit, focus, keyboard, scripted tours) eases to a target.
 *
 * The view is clamped so it never leaves the painted landscape.
 */

import type { Container } from 'pixi.js';
import { type Vec, clamp, damp } from '../core/math';
import type { BoardDef } from '../world/types';
import type { Extent } from './fields';

const MAX_ZOOM = 1.7;
/** How much taller than the opened reach the view may be when fully pulled back. */
const MIST_ALLOWANCE = 1.5;
/** How quickly a glide dies away, per second. */
const FRICTION = 4.2;
/** A wheel, key or drag still trailing on this soon after a firm glide begins is the old gesture, not a new one. */
const FIRM_GRACE_MS = 350;

export class Camera {
  x: number;
  y: number;
  zoom = 1;
  private tx: number;
  private ty: number;
  private tz = 1;
  private viewW = 1;
  private viewH = 1;
  /** Easing rate; lowered during scripted tours for a slower glide. */
  rate = 9;
  /** While zooming: the screen point and the world point that must stay together. */
  private anchor: { sx: number; sy: number; wx: number; wy: number } | null = null;
  /** Glide after a drag, in world pixels per second. */
  private vx = 0;
  private vy = 0;
  private dragging = false;
  private lastDrag = 0;
  /** The stretch of the valley that `fit` frames, and how far down the view may travel. */
  private region: { top: number; bottom: number; limit: number } | null = null;

  /**
   * Screen pixels at the foot of the view covered by a panel (the notebook's
   * sheet on a phone). The view may travel that much further south, so a subject
   * near the bottom of the opened reach can still be framed above the panel.
   */
  bottomInset = 0;

  /**
   * True while a scripted glide (`ease`) is under way. Any player gesture
   * (drag, pinch, wheel, keys) calls `interrupt`, which stops it where it is.
   */
  private easing = false;

  /**
   * When a firm glide began (`ease(..., firm)`), or -Infinity. A firm glide is
   * not given up to a gesture already under way when it began (a finger still
   * down, a wheel or key still running on), only to one begun after it.
   */
  private firmSince = -Infinity;
  /** When the finger or mouse now down first moved the map, or null while none is. */
  private held: number | null = null;

  /**
   * Counts every time the player (or a direct framing) takes the camera, so a
   * scripted follow can tell it has been overridden and give way for good.
   */
  taken = 0;

  constructor(
    private readonly world: Container,
    private readonly board: BoardDef,
    private readonly extent: Extent,
  ) {
    this.x = this.tx = board.width / 2;
    this.y = this.ty = board.height / 2;
  }

  /**
   * The farthest the view may pull back. It never shows beyond the painted
   * landscape, but on a tall narrow screen it may look some way past the opened
   * reach into the mist (`MIST_ALLOWANCE`), so that a phone held upright can
   * still take in most of the valley's width.
   */
  get minZoom(): number {
    const open = (this.region?.limit ?? Infinity) - this.extent.y;
    const height = Math.min(this.extent.height, open * MIST_ALLOWANCE);
    return Math.max(this.viewW / this.extent.width, this.viewH / height);
  }

  /** Zoom at which the whole playable valley is visible (or as much as the landscape allows). */
  get fitZoom(): number {
    const height = this.region ? this.region.bottom - this.region.top : this.board.height;
    const fit = Math.min(this.viewW / (this.board.width * 1.02), this.viewH / (height * 1.02));
    return clamp(fit, this.minZoom, MAX_ZOOM);
  }

  /**
   * Says which stretch of a long valley is in play: `fit` frames from `top`
   * to `bottom`, and the view cannot travel below `limit` (where the mist lies).
   */
  setRegion(top: number, bottom: number, limit: number): void {
    this.region = { top, bottom, limit };
    this.setTarget(this.tx, this.ty, this.tz);
  }

  resize(width: number, height: number): void {
    const first = this.viewW === 1;
    this.viewW = width;
    this.viewH = height;
    if (first) this.fit(true);
    else this.setTarget(this.tx, this.ty, this.tz);
  }

  fit(immediate = false): void {
    this.release();
    const middle = this.region ? (this.region.top + this.region.bottom) / 2 : this.board.height / 2;
    this.setTarget(this.board.width / 2, middle, this.fitZoom);
    if (immediate) this.snap();
  }

  /** Glides to centre on a world point, optionally changing zoom. */
  focus(x: number, y: number, zoom = this.tz): void {
    this.taken++;
    this.release();
    this.easing = false;
    this.firmSince = -Infinity;
    this.setTarget(x, y, zoom);
  }

  /**
   * A slow scripted glide to a framing, given up the moment the player touches
   * the camera. `rate` is the easing rate for this glide only.
   */
  ease(x: number, y: number, zoom: number, rate: number, firm = false): void {
    this.release();
    this.setTarget(x, y, zoom);
    this.rate = rate;
    this.easing = true;
    this.firmSince = firm ? performance.now() : -Infinity;
  }

  /** True while a firm glide should not yet give way: the gesture began before it, or is only just trailing on. */
  private get holding(): boolean {
    if (!this.easing || this.firmSince === -Infinity) return false;
    return (this.held !== null && this.held < this.firmSince) || performance.now() - this.firmSince < FIRM_GRACE_MS;
  }

  /** The player has taken the camera: a scripted glide stops where it is, now. */
  interrupt(): void {
    if (this.holding) return;
    this.taken++;
    if (!this.easing) return;
    this.easing = false;
    this.firmSince = -Infinity;
    this.rate = 9;
    this.tx = this.x;
    this.ty = this.y;
    this.tz = this.zoom;
  }

  /** Eased pan by a screen distance (keyboard, scripted moves). */
  panBy(screenDx: number, screenDy: number): void {
    if (this.holding) return;
    this.release();
    this.setTarget(this.tx - screenDx / this.tz, this.ty - screenDy / this.tz, this.tz);
  }

  /** Direct pan: the map moves exactly this far, now. Used while a finger or the mouse is dragging it. */
  drag(screenDx: number, screenDy: number): void {
    const now = performance.now();
    this.held ??= now;
    if (this.holding) { this.lastDrag = now; return; }
    this.interrupt();
    const dt = Math.max(1, now - this.lastDrag) / 1000;
    this.lastDrag = now;
    const dx = -screenDx / this.zoom;
    const dy = -screenDy / this.zoom;
    this.anchor = null;
    this.setTarget(this.x + dx, this.y + dy, this.tz);
    this.x = this.tx;
    this.y = this.ty;
    // Remember how fast it was going, smoothed over the last few moves, for the glide on release.
    if (this.dragging && dt < 0.1) {
      this.vx = this.vx * 0.6 + (dx / dt) * 0.4;
      this.vy = this.vy * 0.6 + (dy / dt) * 0.4;
    } else {
      this.vx = this.vy = 0;
    }
    this.dragging = true;
    this.apply();
  }

  /** The drag has ended; the map keeps whatever speed it had and glides to rest. */
  endDrag(): void {
    this.held = null;
    if (!this.dragging) return;
    this.dragging = false;
    // A drag that stopped before the finger lifted should not fling.
    if (performance.now() - this.lastDrag > 80) this.vx = this.vy = 0;
  }

  private release(): void {
    this.anchor = null;
    this.dragging = false;
    this.vx = this.vy = 0;
  }

  /** Zooms by `factor`, keeping the world point under the screen position fixed there. */
  zoomAt(screenX: number, screenY: number, factor: number): void {
    if (this.holding) return;
    this.interrupt();
    this.vx = this.vy = 0;
    const world = this.screenToWorld(screenX, screenY);
    this.anchor = { sx: screenX, sy: screenY, wx: world.x, wy: world.y };
    this.tz = clamp(this.tz * factor, this.minZoom, MAX_ZOOM);
  }

  screenToWorld(screenX: number, screenY: number): Vec {
    return { x: this.x + (screenX - this.viewW / 2) / this.zoom, y: this.y + (screenY - this.viewH / 2) / this.zoom };
  }

  worldToScreen(p: Vec): Vec {
    return { x: (p.x - this.x) * this.zoom + this.viewW / 2, y: (p.y - this.y) * this.zoom + this.viewH / 2 };
  }

  /** The part of the world on screen, with a margin; used to skip work for what cannot be seen. */
  visible(margin = 0): { left: number; top: number; right: number; bottom: number } {
    const halfW = this.viewW / (2 * this.zoom) + margin;
    const halfH = this.viewH / (2 * this.zoom) + margin;
    return { left: this.x - halfW, top: this.y - halfH, right: this.x + halfW, bottom: this.y + halfH };
  }

  private limit(x: number, y: number, zoom: number): Vec {
    const halfW = this.viewW / (2 * zoom);
    const halfH = this.viewH / (2 * zoom);
    const e = this.extent;
    const floor = Math.min(e.y + e.height, (this.region?.limit ?? Infinity) + this.bottomInset / zoom);
    return {
      x: halfW * 2 >= e.width ? e.x + e.width / 2 : clamp(x, e.x + halfW, e.x + e.width - halfW),
      // A view taller than the opened reach hangs from the top, so the excess is mist to the south.
      y: halfH * 2 >= floor - e.y ? e.y + halfH : clamp(y, e.y + halfH, floor - halfH),
    };
  }

  private setTarget(x: number, y: number, zoom: number): void {
    this.tz = clamp(zoom, this.minZoom, MAX_ZOOM);
    const p = this.limit(x, y, this.tz);
    this.tx = p.x;
    this.ty = p.y;
  }

  snap(): void {
    this.release();
    this.x = this.tx;
    this.y = this.ty;
    this.zoom = this.tz;
    this.apply();
  }

  update(dt: number): void {
    if (this.anchor) {
      // Zoom eases; position is whatever keeps the anchored point where it was on screen.
      this.zoom = damp(this.zoom, this.tz, 14, dt);
      if (Math.abs(this.zoom - this.tz) < 0.0005) this.zoom = this.tz;
      const a = this.anchor;
      const p = this.limit(a.wx - (a.sx - this.viewW / 2) / this.zoom, a.wy - (a.sy - this.viewH / 2) / this.zoom, this.zoom);
      this.x = this.tx = p.x;
      this.y = this.ty = p.y;
      if (this.zoom === this.tz) this.anchor = null;
    } else if (this.dragging) {
      // The drag itself placed the map; nothing to ease.
    } else if (this.vx !== 0 || this.vy !== 0) {
      const p = this.limit(this.x + this.vx * dt, this.y + this.vy * dt, this.zoom);
      // Stop dead at the edge of the landscape rather than pressing against it.
      if (p.x !== this.x + this.vx * dt) this.vx = 0;
      if (p.y !== this.y + this.vy * dt) this.vy = 0;
      this.x = this.tx = p.x;
      this.y = this.ty = p.y;
      const slow = Math.exp(-FRICTION * dt);
      this.vx *= slow;
      this.vy *= slow;
      if (Math.hypot(this.vx, this.vy) * this.zoom < 6) this.vx = this.vy = 0;
    } else {
      this.x = damp(this.x, this.tx, this.rate, dt);
      this.y = damp(this.y, this.ty, this.rate, dt);
      this.zoom = damp(this.zoom, this.tz, this.rate, dt);
      if (this.easing && Math.abs(this.x - this.tx) < 0.5 && Math.abs(this.y - this.ty) < 0.5 && Math.abs(this.zoom - this.tz) < 0.0005) {
        this.easing = false;
        this.firmSince = -Infinity;
        this.rate = 9;
      }
    }
    this.apply();
  }

  private apply(): void {
    this.world.scale.set(this.zoom);
    this.world.position.set(this.viewW / 2 - this.x * this.zoom, this.viewH / 2 - this.y * this.zoom);
  }
}

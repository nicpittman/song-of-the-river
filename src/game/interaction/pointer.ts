/**
 * Pointer input for the valley: one model for mouse, pen and touch.
 *
 *   - A press on something the tool cares about (a place, a selected route)
 *     starts a draw or an edit.
 *   - A press on open ground pans. Two fingers pinch-zoom and pan together.
 *   - A short press without movement is a tap.
 *   - A long press held still on open ground is a hold (used for planting).
 *
 * The canvas sets `touch-action: none`, so the browser never scrolls or zooms
 * the page underneath a gesture.
 */

import type { Vec } from '../core/math';
import type { Camera } from '../rendering/camera';

export interface GestureTarget {
  /** Return true to claim the gesture for drawing or editing; false lets it pan the camera. */
  press(world: Vec, touch: boolean): boolean;
  /**
   * The pointer has been held still on unclaimed ground. Return true to claim
   * the rest of the gesture (it will no longer pan the camera).
   */
  hold(world: Vec, touch: boolean): boolean;
  drag(world: Vec): void;
  release(world: Vec): void;
  cancel(): void;
  tap(world: Vec, touch: boolean): void;
  hover(world: Vec | null): void;
}

const TAP_SLOP = 9;
const TAP_MS = 450;
const HOLD_MS = 420;

export class PointerInput {
  private readonly pointers = new Map<number, Vec>();
  private claimed = false;
  private moved = false;
  private downAt: Vec = { x: 0, y: 0 };
  private downTime = 0;
  private pinchDistance = 0;
  private pinchCentre: Vec = { x: 0, y: 0 };
  private holdTimer = 0;
  /** Set false to ignore input (menus, scripted camera tours). */
  enabled = true;
  /** Called on any user gesture; browsers only unlock audio from one. */
  onGesture: () => void = () => {};

  constructor(
    private readonly element: HTMLElement,
    private readonly camera: Camera,
    private target: GestureTarget,
  ) {
    element.style.touchAction = 'none';
    element.addEventListener('pointerdown', this.onDown);
    element.addEventListener('pointermove', this.onMove);
    element.addEventListener('pointerup', this.onUp);
    element.addEventListener('pointercancel', this.onCancel);
    element.addEventListener('pointerleave', this.onLeave);
    element.addEventListener('wheel', this.onWheel, { passive: false });
    element.addEventListener('contextmenu', this.onContextMenu);
  }

  setTarget(target:GestureTarget):void {this.target.cancel();this.pointers.clear();this.claimed=false;this.camera.endDrag();this.target=target;}

  dispose(): void {
    window.clearTimeout(this.holdTimer);
    const el = this.element;
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointercancel', this.onCancel);
    el.removeEventListener('pointerleave', this.onLeave);
    el.removeEventListener('wheel', this.onWheel);
    el.removeEventListener('contextmenu', this.onContextMenu);
  }

  private local(e: PointerEvent | WheelEvent): Vec {
    const rect = this.element.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private onDown = (e: PointerEvent): void => {
    if (!this.enabled) return;
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    try {
      this.element.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic events in tests have no capturable pointer.
    }
    if (this.pointers.size === 1) {
      this.downAt = p;
      this.downTime = performance.now();
      this.moved = false;
      const touch = e.pointerType === 'touch';
      this.claimed = this.target.press(this.camera.screenToWorld(p.x, p.y), touch);
      window.clearTimeout(this.holdTimer);
      if (!this.claimed) {
        this.holdTimer = window.setTimeout(() => {
          // Still down, still alone, still where it started: a hold.
          if (this.pointers.size !== 1 || this.moved || this.claimed || !this.enabled) return;
          this.claimed = this.target.hold(this.camera.screenToWorld(this.downAt.x, this.downAt.y), touch);
          if (this.claimed) this.moved = true;
        }, HOLD_MS);
      }
    } else if (this.pointers.size === 2) {
      window.clearTimeout(this.holdTimer);
      // A second finger always means "move the camera": abandon any draw in progress.
      if (this.claimed) this.target.cancel();
      this.claimed = false;
      this.moved = true;
      this.beginPinch();
    }
  };

  private beginPinch(): void {
    const [a, b] = [...this.pointers.values()];
    this.pinchDistance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
    this.pinchCentre = { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 };
  }

  private onMove = (e: PointerEvent): void => {
    const p = this.local(e);
    if (!this.pointers.has(e.pointerId)) {
      if (this.enabled && e.pointerType === 'mouse') this.target.hover(this.camera.screenToWorld(p.x, p.y));
      return;
    }
    const previous = this.pointers.get(e.pointerId)!;
    this.pointers.set(e.pointerId, p);
    if (!this.enabled) return;

    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const centre = { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 };
      // Two fingers carry the map with them and scale it about the point between them.
      this.camera.drag(centre.x - this.pinchCentre.x, centre.y - this.pinchCentre.y);
      if (this.pinchDistance > 0) this.camera.zoomAt(centre.x, centre.y, distance / this.pinchDistance);
      this.pinchDistance = distance;
      this.pinchCentre = centre;
      return;
    }
    if (!this.moved && Math.hypot(p.x - this.downAt.x, p.y - this.downAt.y) < TAP_SLOP) return;
    this.moved = true;
    if (!this.claimed) window.clearTimeout(this.holdTimer);
    if (this.claimed) this.target.drag(this.camera.screenToWorld(p.x, p.y));
    else this.camera.drag(p.x - previous.x, p.y - previous.y);
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.local(e);
    this.pointers.delete(e.pointerId);
    window.clearTimeout(this.holdTimer);
    if (this.pointers.size === 0) this.camera.endDrag();
    this.onGesture();
    if (!this.enabled) return;
    if (this.pointers.size === 1) {
      // One finger of a pinch lifted: carry on panning with the other, never draw.
      return;
    }
    if (this.pointers.size > 1) return void this.beginPinch();
    const world = this.camera.screenToWorld(p.x, p.y);
    if (!this.moved && performance.now() - this.downTime < TAP_MS) {
      if (this.claimed) this.target.cancel();
      this.target.tap(world, e.pointerType === 'touch');
    } else if (this.claimed) {
      this.target.release(world);
    }
    this.claimed = false;
  };

  private onCancel = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    window.clearTimeout(this.holdTimer);
    if (this.claimed) this.target.cancel();
    this.claimed = false;
  };

  private onLeave = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && !this.pointers.has(e.pointerId)) this.target.hover(null);
  };

  private onContextMenu = (e: Event): void => e.preventDefault();

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    if (!this.enabled) return;
    const p = this.local(e);
    // Wheels and trackpads report in very different units: a mouse notch may be
    // 100 "pixels" or 3 "lines", a trackpad swipe a stream of small ones, a pinch
    // arrives as ctrl+wheel. Bring them to one scale and cap each step, so no
    // device can make the map lurch.
    const lines = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
    const step = Math.max(-70, Math.min(70, lines)) * (e.ctrlKey ? 0.011 : 0.0026);
    this.camera.zoomAt(p.x, p.y, Math.exp(-step));
  };
}

/**
 * The player's brush. There are no tool palettes: what a gesture does depends
 * on where it is made.
 *
 *   - Press on a place and draw toward another: a ribbon of light follows the
 *     gesture, bends through fords it passes near, and shows where it cannot
 *     go. Release on a compatible place to make the route.
 *   - Or tap one place, then another, for a gently bowed default route.
 *   - Tap a route to select it. Drag any part of a selected route to reshape
 *     it like a painted line; drag a bend back into line to remove it.
 *   - Hold still on open ground and something grows there: reeds on wet
 *     ground, otherwise a grove where deer shelter and corridors can meet.
 *   - Hold still on an old river bed and the water returns to it.
 *   - Hold still on shallow water and stepping stones are laid there.
 *
 * The tool never substitutes a different route from the one shown: what the
 * preview draws is exactly what will be built.
 */

import { Container, Graphics } from 'pixi.js';
import { type Vec, damp, dist, pointSegment } from '../core/math';
import type { ValleyView } from '../rendering/view';
import type { Simulation } from '../simulation/simulation';
import {
  type Connection,
  type Verdict,
  connectionTypeFor,
  defaultControl,
  routeLine,
  snapToFords,
  traceToControl,
} from '../world/connections';
import { smoothCurve, thin } from '../world/geometry';
import type { Channel } from '../world/river';
import { placeAt, placeById } from '../world/terrain';
import type { PlaceDef } from '../world/types';
import type { History } from './history';
import { OVERLAY } from './overlayArt';
import { DARK, type PlaceLook, PlaceLights, brighter } from './placeLights';
import type { GestureTarget } from './pointer';
import { RouteLight } from './routeLight';
import { connectionCost } from '../campaign/interventions';
import { closureOf, describeClosure } from '../simulation/conditions';

export type Selection =
  | { kind: 'place'; place: PlaceDef }
  | { kind: 'connection'; id: string }
  | { kind: 'bed'; id: string }
  | { kind: 'stones'; id: string }
  | null;

export interface ToolHost {
  toast(text: string, world?: Vec): void;
  sound(name: 'tap' | 'draw' | 'connect' | 'remove' | 'invalid' | 'plant'): void;
  selectionChanged(selection: Selection): void;
  hoverChanged(place: PlaceDef | null): void;
  previewChanged(title: string, detail: string): void;
  /** Called after any successful change to the landscape. */
  edited(kind: 'draw' | 'reshape' | 'remove' | 'plant' | 'open' | 'stones'): void;
}

interface Draft {
  from: PlaceDef;
  trace: Vec[];
  to: PlaceDef | null;
  line: Vec[];
  verdict: Verdict | null;
}

interface Reshape {
  id: string;
  control: Vec[];
  index: number;
  line: Vec[];
  verdict: Verdict;
}

/** A hold in progress: something is taking root, or water is finding its way back into an old bed. */
interface Planting {
  at: Vec;
  /** Progress, 0..1; the change is made when it reaches 1. */
  t: number;
  /** Why this cannot be done here, or null if the spot is good. */
  problem: string | null;
  /** Size of the ring on the ground. */
  radius: number;
  /** The old bed being opened, if that is what the hold is on. */
  bed?: string;
  /** True if the hold is on the water: stepping stones are being laid. */
  stones?: boolean;
}

/** Seconds a hold takes to plant, once it has begun. */
const PLANT_SECONDS = 0.8;

/** A route that has just been made, and the light running along it. */
interface Pulse {
  id: string;
  /** The place the light runs toward. */
  to: string;
  /** Progress, 0..1. */
  t: number;
  flared: boolean;
}

/** Seconds the reward pulse takes to run the length of a new route. */
const PULSE_SECONDS = 1.2;

export class ConnectTool implements GestureTarget {
  /** Quiet labels and clearing marks make routeable places readable on touch screens. */
  guidesVisible = true;
  /** Adventure path sketching deliberately leaves planting and river engineering to construction. */
  allowInterventions = true;
  routesVisible = false;
  /** Overlay layers, back to front: light on the ground, the line, small marks, names. */
  private readonly layers = [new Container(), new Container(), new Container(), new Container()] as const;
  private readonly lights: PlaceLights;
  private readonly route: RouteLight;
  private readonly looks = new Map<string, PlaceLook>();
  /** Eases to 1 while a line being drawn has found its destination. */
  private lock = 0;
  /** Connection ids seen last frame, to notice new routes; null until the first frame. */
  private known: Set<string> | null = null;
  private pulses: Pulse[] = [];
  /** Touch screens get larger stones on a selected route. */
  private readonly coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  private readonly plantRing = new Graphics();
  private planting: Planting | null = null;
  private draft: Draft | null = null;
  private reshape: Reshape | null = null;
  private selection: Selection = null;
  private hovered: PlaceDef | null = null;
  private tapGuide: { key: string; line: Vec[]; verdict: Verdict } | null = null;
  /** Places gently pulsed to guide the player (opening hint, objective review). */
  private hinted: string[] = [];
  private hintUntil = Infinity;
  /** Until this time, every route is softly lit (after a season turns, or when a wish is reviewed). */
  private showUntil = 0;
  private time = 0;

  constructor(
    private readonly sim: Simulation,
    private readonly view: ValleyView,
    private readonly history: History,
    private readonly host: ToolHost,
  ) {
    const [ground, line, marks, labels] = this.layers;
    view.overlay.addChild(ground, line, marks, labels);
    this.lights = new PlaceLights(sim.board.places, ground, labels);
    this.route = new RouteLight(line, marks);
    // The planting ring lies on the ground, so it is flattened like everything else seen at a slant.
    this.plantRing.scale.set(1, 0.6);
    this.plantRing.visible = false;
    marks.addChild(this.plantRing);
  }

  // ── Selection ───────────────────────────────────────────────────────────

  get selected(): Selection {
    return this.selection;
  }

  private select(selection: Selection): void {
    this.tapGuide = null;
    this.selection = selection;
    this.host.selectionChanged(selection);
  }

  clearSelection(): void {
    if (this.selection) this.select(null);
  }

  /** Softly lights every route for a few seconds, so the player can take stock of what they have made. */
  showRoutes(seconds = 4): void {
    this.showUntil = this.time + seconds;
  }

  /** Makes the valley's routeable places visible without requiring mouse hover. */
  showPlaces(): void {
    this.guidesVisible = !this.guidesVisible;
  }

  /** Pulses the given places for `seconds` (or until cleared). */
  hintPlaces(ids: string[], seconds = Infinity): void {
    this.hinted = ids;
    this.hintUntil = this.time + seconds;
  }

  removeSelected(): void {
    const selection = this.selection;
    if (!selection) return;
    // Only what the player made can be removed: routes, and what they planted.
    if (selection.kind === 'bed') return;
    if (selection.kind === 'place' && selection.place.kind !== 'grove' && selection.place.kind !== 'reeds') return;
    const commit = this.history.begin();
    if (selection.kind === 'stones') {
      const result = this.sim.removeStones(selection.id);
      if (!result.ok) return void this.host.toast(result.reason);
    } else {
      const removed = selection.kind === 'connection' ? this.sim.removeConnection(selection.id) : this.sim.removePlant(selection.place.id);
      if (!removed) return;
    }
    commit(0);
    this.select(null);
    this.host.sound('remove');
    this.host.edited('remove');
  }

  /** Catches up with the landscape after any change (an edit, undo, redo). */
  networkChanged(): void {
    this.tapGuide = null;
    const places = this.sim.board.places;
    this.lights.sync(places);
    const selection = this.selection;
    if (selection?.kind === 'connection' && !this.connection(selection.id)) this.select(null);
    if (selection?.kind === 'place') {
      const place=places.find((p)=>p.id===selection.place.id);
      this.select(place?{kind:'place',place}:null);
    }
    if (selection?.kind === 'bed' && !this.sim.river.beds.some((b) => b.id === selection.id)) this.select(null);
    if (selection?.kind === 'stones' && !this.sim.state.stones.some((s) => s.id === selection.id)) this.select(null);
  }

  private connection(id: string): Connection | undefined {
    return this.sim.connections.find((c) => c.id === id);
  }

  /** Screen-constant sizes: a length in screen pixels expressed in world units. */
  private px(screen: number): number {
    return screen / this.view.camera.zoom;
  }

  // ── Gestures ────────────────────────────────────────────────────────────

  press(world: Vec, touch: boolean): boolean {
    this.host.hoverChanged(null);
    const reach = this.px(touch ? 30 : 20);
    if (this.selection?.kind === 'connection') {
      const connection = this.connection(this.selection.id);
      if (connection) {
        const control = connection.control.map((p) => ({ ...p }));
        let index = control.findIndex((p) => dist(p, world) < reach);
        if (index < 0 && connection.line.nearest(world).d < reach) {
          // Grabbing the line between bends adds a bend at that spot.
          const along = connection.line.nearest(world).along;
          index = control.findIndex((p) => connection.line.nearest(p).along > along);
          if (index < 0) index = control.length;
          control.splice(index, 0, { ...world });
        }
        if (index >= 0) {
          this.reshape = { id: connection.id, control, index, line: connection.line.points, verdict: { ok: true, connection } };
          return true;
        }
      }
    }
    const place = this.placeNear(world, 0.8, 0);
    if (!place || !place.links.length) return false;
    this.draft = { from: place, trace: [{ ...world }], to: null, line: [], verdict: null };
    return true;
  }

  hold(world: Vec): boolean {
    if(!this.allowInterventions)return false;
    // Holding on a route or a place means something else; only open ground can be planted.
    if (this.placeNear(world, 1, this.px(10))) return false;
    if (this.sim.connections.some((c) => c.line.nearest(world).d < this.px(18))) return false;
    this.select(null);
    const bed = this.bedNear(world);
    if (bed) {
      const result = this.sim.canOpen(bed.id);
      this.planting = { at: bed.line.nearest(world).point, t: 0, problem: result.ok ? null : result.reason, radius: 46, bed: bed.id };
    } else if (this.sim.river.edgeDistance(world) < 0) {
      const result = this.sim.canLayStones(world);
      const at = this.sim.river.nearest(world).point;
      this.planting = { at, t: 0, problem: result.ok ? null : result.reason, radius: 54, stones: true };
    } else {
      this.planting = { at: { ...world }, t: 0, ...this.plantCheck(world) };
    }
    this.host.sound('tap');
    return true;
  }

  private bedNear(world: Vec): Channel | undefined {
    return this.sim.river.beds.find((bed) => bed.line.nearest(world).d < bed.widths[0]! / 2 + this.px(22));
  }

  private plantCheck(at: Vec): { problem: string | null; radius: number } {
    const result = this.sim.canPlant(at);
    return result.ok ? { problem: null, radius: result.place.radius } : { problem: result.reason, radius: 68 };
  }

  drag(world: Vec): void {
    if (this.planting) {
      // A planting can be nudged while it takes root; a river bed is where it is.
      if (!this.planting.bed && !this.planting.stones) Object.assign(this.planting, { at: { ...world } }, this.plantCheck(world));
      return;
    }
    if (this.reshape) return this.dragReshape(world);
    const draft = this.draft;
    if (!draft) return;
    const last = draft.trace[draft.trace.length - 1]!;
    if (dist(last, world) > this.px(5)) {
      draft.trace.push({ ...world });
      this.host.sound('draw');
    }
    const target = this.placeNear(world, 1, this.px(26));
    draft.to = target && target.id !== draft.from.id && connectionTypeFor(draft.from, target) ? target : null;
    if (draft.to) {
      const type = connectionTypeFor(draft.from, draft.to)!;
      const control = snapToFords(this.sim.board, this.sim.river, draft.from, draft.to, traceToControl(draft.from, draft.to, draft.trace));
      draft.verdict = this.sim.preview({ type, from: draft.from.id, to: draft.to.id, control });
      draft.line = routeLine(draft.from, draft.to, control).points;
    } else {
      draft.verdict = null;
      draft.line = smoothCurve(thin(draft.trace, this.px(12)), 10);
    }
    const type = draft.to ? connectionTypeFor(draft.from, draft.to) : null;
    const verdict = draft.verdict;
    if (draft.to && verdict) {
      const cost = verdict.ok ? connectionCost(verdict.connection) : null;
      const closure = verdict.ok ? closureOf(verdict.connection, this.sim.season) : null;
      const affordable = this.sim.state.mode === 'free' || this.sim.state.marks >= (cost ?? 0);
      this.host.previewChanged(`${draft.from.name} → ${draft.to.name}`, verdict.ok
        ? `${type === 'corridor' ? 'Woodland corridor for deer' : 'Footpath for people'}. ${closure ? `${describeClosure(closure)} ` : ''}${this.sim.state.mode === 'free' ? 'Release to connect.' : `${cost} brushstroke${cost === 1 ? '' : 's'}. ${affordable ? 'Release to connect.' : 'Wait for more brushstrokes next season.'}`}`
        : `${verdict.reason} Adjust the line before releasing.`);
    } else {
      this.host.previewChanged(`Drawing from ${draft.from.name}`, 'Guide the line to a glowing destination. Other places accept a different kind of journey.');
    }
  }

  release(world: Vec): void {
    // Letting go before a grove has taken root simply abandons it.
    if (this.planting) return void (this.planting = null);
    if (this.reshape) return this.releaseReshape();
    const draft = this.draft;
    this.draft = null;
    this.host.hoverChanged(null);
    if (!draft) return;
    if (!draft.to) {
      // Only remark on a line that clearly set out for somewhere; stray drags inside a wood are ignored.
      if (dist(world, draft.from) > draft.from.radius + this.px(60)) this.host.toast('A route needs somewhere to arrive.', world);
      return;
    }
    const type = connectionTypeFor(draft.from, draft.to)!;
    const control = snapToFords(this.sim.board, this.sim.river, draft.from, draft.to, traceToControl(draft.from, draft.to, draft.trace));
    this.build({ type, from: draft.from.id, to: draft.to.id, control }, world);
  }

  cancel(): void {
    this.draft = null;
    this.reshape = null;
    this.planting = null;
    this.host.hoverChanged(null);
  }

  /** Advances a planting in progress and plants the grove when the hold completes. */
  private updatePlanting(dt: number, breath: number): void {
    const ring = this.plantRing;
    const planting = this.planting;
    ring.visible = !!planting;
    if (!planting) return;
    planting.t = Math.min(1, planting.t + dt / PLANT_SECONDS);
    const colour = planting.problem ? OVERLAY.rust : OVERLAY.lampBright;
    const radius = planting.radius;
    const width = this.px(1);
    ring.position.set(planting.at.x, planting.at.y);
    ring
      .clear()
      .circle(0, 0, radius)
      .fill({ color: colour, alpha: 0.1 + 0.06 * breath })
      .circle(0, 0, radius)
      .stroke({ width: width * 1.5, color: colour, alpha: 0.35 })
      .moveTo(0, -radius)
      .arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + planting.t * Math.PI * 2)
      .stroke({ width: width * 4, color: colour, alpha: 0.95, cap: 'round' });
    if (planting.t < 1) return;

    this.planting = null;
    ring.visible = false;
    const commit = this.history.begin();
    const planted = planting.bed || planting.stones ? null : this.sim.plant(planting.at);
    const result = planted ?? (planting.stones ? this.sim.layStones(planting.at) : this.sim.openChannel(planting.bed!));
    if (!result.ok) {
      this.host.toast(result.reason, result.at ?? planting.at);
      this.host.sound('invalid');
      return;
    }
    commit(result.cost);
    this.host.sound('plant');
    this.host.edited(planting.bed ? 'open' : planting.stones ? 'stones' : 'plant');
    if (planted?.ok) this.lights.flare(planted.place.id);
  }

  tap(world: Vec, touch: boolean): void {
    const place = this.placeNear(world, 1, this.px(touch ? 18 : 6));
    if (place) {
      this.host.sound('tap');
      const first = this.selection?.kind === 'place' ? this.selection.place : null;
      if (first && first.id !== place.id) {
        const type = connectionTypeFor(first, place);
        if (type) {
          // Tap-then-tap: an alternative to drawing, for small screens and unsteady hands.
          this.select(null);
          this.build({ type, from: first.id, to: place.id, control: defaultControl(first, place) }, world, ' Try drawing a way around.');
          return;
        }
        this.host.toast(`Nothing travels between ${first.name} and ${place.name}.`, world);
      }
      return this.select({ kind: 'place', place });
    }
    const bed = this.bedNear(world);
    if (bed) {
      this.host.sound('tap');
      return this.select({ kind: 'bed', id: bed.id });
    }
    const laid = this.sim.state.stones.find((s) => dist(world, s) < 50 + this.px(10));
    if (laid) {
      this.host.sound('tap');
      return this.select({ kind: 'stones', id: laid.id });
    }
    const reach = this.px(touch ? 26 : 16);
    let best: Connection | null = null;
    let bestD = reach;
    for (const connection of this.sim.connections) {
      const d = connection.line.nearest(world).d;
      if (d < bestD) {
        best = connection;
        bestD = d;
      }
    }
    if (best) this.host.sound('tap');
    this.select(best ? { kind: 'connection', id: best.id } : null);
  }

  hover(world: Vec | null): void {
    const next = world ? this.placeNear(world, 1, 0) : null;
    const place = next && next.y <= this.sim.openBottom ? next : null;
    if (place?.id !== this.hovered?.id) this.host.hoverChanged(place);
    this.hovered = place;
    this.view.app.canvas.style.cursor = this.hovered ? this.hovered.links.length ? 'crosshair' : 'pointer' : 'grab';
  }

  private placeNear(world: Vec, radiusScale: number, slack: number): PlaceDef | null {
    const label = this.lights.atLabel(world, this.px(1));
    if (label && label.y <= this.sim.openBottom) return label;
    const place = placeAt(this.sim.board, world, slack);
    if (!place) return null;
    if (place.y > this.sim.openBottom) return null;
    return dist(world, place) <= place.radius * radiusScale + slack ? place : null;
  }

  private build(data: { type: Connection['type']; from: string; to: string; control: Vec[] }, at: Vec, advice = ''): void {
    const commit = this.history.begin();
    const result = this.sim.addConnection(data);
    if (!result.ok) {
      this.host.toast(result.reason + (result.at ? advice : ''), result.at ?? at);
      this.host.sound('invalid');
      return;
    }
    commit(result.cost);
    this.host.sound('connect');
    this.host.edited('draw');
  }

  private dragReshape(world: Vec): void {
    const reshape = this.reshape!;
    const connection = this.connection(reshape.id);
    if (!connection) return void (this.reshape = null);
    reshape.control[reshape.index] = { ...world };
    const from = placeById(this.sim.board, connection.from);
    const to = placeById(this.sim.board, connection.to);
    const control = snapToFords(this.sim.board, this.sim.river, from, to, reshape.control);
    reshape.verdict = this.sim.preview({ id: connection.id, type: connection.type, from: connection.from, to: connection.to, control });
    reshape.line = routeLine(from, to, control).points;
  }

  private releaseReshape(): void {
    const reshape = this.reshape!;
    this.reshape = null;
    const connection = this.connection(reshape.id);
    if (!connection) return;
    const from = placeById(this.sim.board, connection.from);
    const to = placeById(this.sim.board, connection.to);
    let control = reshape.control.map((p) => ({ ...p }));
    // A bend dragged back into line with its neighbours is removed: the way to delete a control point.
    const before = control[reshape.index - 1] ?? from;
    const after = control[reshape.index + 1] ?? to;
    if (pointSegment(control[reshape.index]!, before, after).d < this.px(14)) control.splice(reshape.index, 1);
    control = snapToFords(this.sim.board, this.sim.river, from, to, control);
    const commit = this.history.begin();
    const result = this.sim.reshapeConnection(reshape.id, control);
    if (!result.ok) {
      this.host.toast(result.reason, result.at ?? control[reshape.index] ?? from);
      this.host.sound('invalid');
      return;
    }
    commit(result.cost);
    this.host.sound(result.cost > 0 ? 'connect' : 'tap');
    this.host.edited('reshape');
  }

  // ── Drawing the overlay ─────────────────────────────────────────────────
  //
  // Light, not lines: places glow softly from the ground, the line being drawn
  // is a ribbon of light with beads travelling toward its destination, and a
  // selected route softens, with polished stones at its bends. The pieces are
  // painted by `PlaceLights` and `RouteLight`; this decides what is lit.

  update(dt: number): void {
    this.time += dt;
    if (this.time > this.hintUntil) this.hinted = [];
    const reduced = this.view.reducedMotion;
    const px = this.px(1);
    const breath = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(this.time * 2.2);
    const draft = this.draft;

    this.lights.update(dt, this.time, px, this.placeLooks(), reduced);
    this.updatePlanting(dt, breath);

    const route = this.route;
    route.begin(px, this.time);
    this.lock = draft?.to ? damp(this.lock, 1, 12, dt) : draft ? damp(this.lock, 0, 12, dt) : 0;

    const selected = this.selection?.kind === 'connection' ? this.connection(this.selection.id) : undefined;
    if (selected) {
      const reshape = this.reshape;
      const bad = reshape && !reshape.verdict.ok ? reshape.verdict : null;
      route.selected(reshape ? reshape.line : selected.line.points, bad?.at ?? null, breath, !reduced);
      route.stones(reshape ? reshape.control : selected.control, reshape ? reshape.index : -1, this.coarse ? 22 : 17, !!bad);
      if (bad) route.fault(bad.at, breath);
    }

    // What is already there matters to what can be drawn: light the routes of the
    // other kind (deer and people keep apart) while a line is being drawn or reshaped.
    const drawing = draft?.to ? connectionTypeFor(draft.from, draft.to) : this.reshape ? selected?.type : null;
    const remind = Math.min(1, Math.max(0, this.showUntil - this.time));
    for (const connection of this.sim.connections) {
      if (connection === selected) continue;
      const strength = drawing && connection.type !== drawing ? 0.5 : Math.max(this.routesVisible ? 0.6 : 0, remind * 0.42);
      if (strength > 0.02) route.ribbon(connection.line.points, { strength, flow: 0, taperStart: false, taperEnd: false, faultAt: null, beads: false });
    }

    this.drawPulses(dt, reduced);

    if (draft) {
      const bad = draft.verdict && !draft.verdict.ok ? draft.verdict : null;
      const lock = this.lock;
      route.ribbon(draft.line, {
        strength: 0.82 + 0.18 * lock,
        flow: reduced ? 0 : 30 + 26 * lock,
        taperStart: true,
        taperEnd: !!draft.to,
        faultAt: bad?.at ?? null,
        beads: true,
      });
      const head = draft.line[draft.line.length - 1];
      if (head) {
        route.cursor(head, breath, 1 - lock);
        if (draft.to && !bad) route.landing(head, lock);
      }
      if (bad) route.fault(bad.at, breath);
    }
    // Tapping a named place also previews the exact curve a second tap makes.
    // Drawing a custom line remains available when that easy curve is blocked.
    const from = this.selection?.kind === 'place' ? this.selection.place : null;
    if (!draft && !this.reshape && from && this.hovered) {
      const to = this.hovered;
      const type = connectionTypeFor(from, to);
      if (type) {
        const key = `${from.id}|${to.id}`;
        if (this.tapGuide?.key !== key) {
          const control = defaultControl(from, to);
          this.tapGuide = { key, verdict: this.sim.preview({ type, from: from.id, to: to.id, control }), line: routeLine(from, to, control).points };
        }
        const { verdict, line } = this.tapGuide;
        route.ribbon(line, { strength: 0.48, flow: 0, taperStart: true, taperEnd: true, faultAt: verdict.ok ? null : verdict.at, beads: false });
        if (!verdict.ok) route.fault(verdict.at, breath);
      }
    }
    route.end();
  }

  /** How strongly each place is lit this frame, from hints, hovering, selection and any line being drawn. */
  private placeLooks(): Map<string, PlaceLook> {
    const looks = this.looks;
    looks.clear();
    const lift = (id: string, look: Partial<PlaceLook>): void => void looks.set(id, brighter(looks.get(id) ?? DARK, look));
    const visible = this.sim.board.places.filter((place) => place.y <= this.sim.openBottom);
    if (this.guidesVisible && !this.draft && !this.reshape) {
      for (const place of visible) {
        lift(place.id, { label: 0.92, light: 0.14, breathe: 0.2 });
      }
    }
    for (const id of this.hinted) if (visible.some((place) => place.id === id)) lift(id, { light: 0.6, breathe: 1, label: 0.95 });
    const draft = this.draft;
    const origin = draft?.from ?? (this.selection?.kind === 'place' ? this.selection.place : null);
    if (origin) {
      // Everywhere this line could arrive glows faintly; the one it has found glows bright.
      for (const place of visible) {
        if (place.id === origin.id || !connectionTypeFor(origin, place)) continue;
        if (draft?.to?.id === place.id) lift(place.id, draft.verdict?.ok === false ? { light: 0.6, label: 1 } : { light: 1, bright: 1, motes: 1, label: 1 });
        else lift(place.id, { light: 0.45, breathe: 0.5, motes: 0.25, label: 1 });
      }
      lift(origin.id, { light: 0.55, bright: 1, label: 1 });
    } else if (this.hovered && !this.reshape && this.selection?.kind !== 'connection') {
      lift(this.hovered.id, { light: 0.45, label: 1, bright: 0.8 });
    }
    if (this.selection?.kind === 'place' && !draft) lift(this.selection.place.id, { light: 0.55, breathe: 0.4, label: 1, bright: 1 });
    return looks;
  }

  /**
   * Notices routes that have just been made (by comparing connection ids with
   * the last frame) and runs one pulse of light along each, start to end.
   */
  private drawPulses(dt: number, reduced: boolean): void {
    const connections = this.sim.connections;
    if (!this.known) {
      // The first frame only learns what already exists: routes loaded with the valley are not new.
      this.known = new Set(connections.map((c) => c.id));
    } else if (connections.some((c) => !this.known!.has(c.id)) || connections.length !== this.known.size) {
      for (const c of connections) if (!this.known.has(c.id)) this.pulses.push({ id: c.id, to: c.to, t: 0, flared: false });
      this.known = new Set(connections.map((c) => c.id));
    }
    this.pulses = this.pulses.filter((pulse) => {
      const connection = this.connection(pulse.id);
      pulse.t += dt / PULSE_SECONDS;
      if (!connection || pulse.t >= 1) return false;
      if (!pulse.flared && pulse.t > 0.8) {
        // The light arrives: the destination brightens for a moment.
        pulse.flared = true;
        this.lights.flare(pulse.to);
      }
      this.route.pulse(connection.line.points, pulse.t, reduced);
      return true;
    });
  }

  dispose(): void {
    this.plantRing.destroy();
    this.lights.destroy();
    this.route.destroy();
    for (const layer of this.layers) layer.destroy({ children: true });
  }
}

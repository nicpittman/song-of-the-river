/**
 * Everyone in the valley, and the two moments that matter most:
 *
 *  - Setting off. A friend who has been at camp and starts along a trail
 *    first turns and waves back; those staying behind wave them off.
 *  - Coming home. Someone returning with a pack is seen from a distance by
 *    those at camp, who shade their eyes; when they arrive the others wave,
 *    and the bundle is set down by the fire (a rare one with a small lift of
 *    warm motes).
 *
 * The layer only sees snapshots, so these are read from motion: where a
 * figure was resting, where it is now, and what it carries.
 */

import type { SceneFigure } from '../../adventure/model';
import type { ArtLibrary } from '../art';
import type { River } from '../../world/river';
import { type CampAct, CampLife, newCampAct } from './campLife';
import { type FigureFx, FigureView } from './figure';
import type { FrameInfo, Stage } from './frame';
import { seedOf } from './motion';
import { burst, newBurst } from './particles';

/** Within this distance of the fire counts as being at camp. */
const CAMP = 120;
/** Beyond this, a friend is properly away. */
const AWAY = 260;
/** Close enough for camp to see someone coming home. */
const SIGHTED = 420;

interface Story {
  /** Rested at camp long enough to be setting off from it. */
  settled: boolean;
  away: boolean;
  sighted: boolean;
}

const scratch = newBurst();

export class Figures {
  private readonly views = new Map<string, FigureView>();
  private readonly stories = new Map<string, Story>();
  private readonly byId = new Map<string, SceneFigure>();
  /** Camp life for each friend staying home today (see `campLife.ts`). */
  private readonly lives = new Map<string, { life: CampLife; act: CampAct }>();
  /** Finished gardens near home, for camp life to tend; set by the layer each frame. */
  readonly gardens: Array<{ x: number; y: number }> = [];
  river: River | null = null;
  /** Drawn feet of every figure, for keeping names off them. */
  readonly feet: Array<{ x: number; y: number }> = [];

  constructor(
    private readonly art: ArtLibrary,
    private readonly stage: Stage,
    private readonly fx: FigureFx,
  ) {}

  get(id: string): FigureView | undefined {
    return this.views.get(id);
  }

  update(figures: readonly SceneFigure[], f: FrameInfo): void {
    this.byId.clear();
    for (const fig of figures) {
      this.byId.set(fig.id, fig);
      if (!this.views.has(fig.id)) {
        this.views.set(fig.id, new FigureView(fig.id, fig.look, fig.role, this.art, this.stage));
        this.stories.set(fig.id, { settled: false, away: false, sighted: false });
      }
    }
    let n = 0;
    for (const [id, view] of this.views) {
      const fig = this.byId.get(id) ?? null;
      view.update(fig, f, this.fx, fig && !view.villager ? this.campAct(view, fig, f) : null);
      if (fig && !view.villager) this.watch(view, fig, f);
      if (view.gone) {
        view.destroy();
        this.views.delete(id);
        this.stories.delete(id);
        continue;
      }
      if (!view.root.visible) continue;
      let foot = this.feet[n];
      if (!foot) {
        foot = { x: 0, y: 0 };
        this.feet[n] = foot;
      }
      foot.x = view.x;
      foot.y = view.y;
      n++;
    }
    this.feet.length = n;
  }

  /** What camp life asks of a friend this frame, or null when the rules have them. */
  private campAct(view: FigureView, fig: SceneFigure, f: FrameInfo): CampAct | null {
    const day = f.campDay;
    const info = day?.people.find((p) => p.id === fig.id);
    let entry = this.lives.get(fig.id);
    if (!day || !info || !fig.visible) {
      entry?.life.reset();
      return null;
    }
    if (!entry) {
      entry = { life: new CampLife(seedOf(view.id) % 100003, view.signature), act: newCampAct() };
      this.lives.set(fig.id, entry);
    }
    if (info.builder) {
      // Walking to the site and home again is the rules' own; only the work at the site is added to.
      if (fig.pose !== 'build' && fig.pose !== 'carry') { entry.life.reset(); return null; }
      return entry.life.build(fig.at, fig.facing, day, f, entry.act);
    }
    return entry.life.home(info, view.x || view.y ? { x: view.x, y: view.y } : fig.at, day, f, this.river, this.gardens, entry.act);
  }

  /** Reads departures and homecomings from how a figure moves relative to the fire. */
  private watch(view: FigureView, fig: SceneFigure, f: FrameInfo): void {
    const story = this.stories.get(view.id)!;
    // Pottering round camp is not setting off, nor coming home.
    if (view.busy) {
      story.settled = false;
      return;
    }
    const d = Math.hypot(view.x - f.fireX, view.y - f.fireY);
    if (d < CAMP && view.stillFor > 2) story.settled = true;
    if (d > AWAY) story.away = true;

    // Setting off: from rest at camp, moving outward.
    if (story.settled && view.speed > 6 && !view.reacting) {
      story.settled = false;
      story.sighted = false;
      view.react('waveback', 1.1, f.fireX);
      this.others(view, f, (other) => other.react('wave', 1.7, view.x));
    }

    // Coming home with something: those at camp see them from a distance.
    if (story.away && fig.pack && !story.sighted && d < SIGHTED && d > CAMP) {
      story.sighted = true;
      this.others(view, f, (other) => other.react('gaze', 1.9, view.x));
    }

    // Arrived: the others wave, and the bundle is set down by the fire.
    if (story.away && d < CAMP && view.resting) {
      story.away = false;
      story.sighted = false;
      if (fig.pack) {
        view.react('setdown', 1.6, f.fireX);
        if (fig.pack === 'rare' && !f.reduced) {
          const b = burst(scratch, view.x + (f.fireX > view.x ? 13 : -13), view.y - 4, view.y);
          b.vy = -18;
          b.spread = 26;
          b.gravity = -3;
          b.life = 1;
          b.size = 2.4;
          b.grow = 0.5;
          b.tint = 0xffe6b0;
          b.alpha = 0.6;
          b.drag = 1.2;
          this.fx.sparks.emit(b, 7);
        }
      }
      this.others(view, f, (other) => other.react('wave', 1.5, view.x));
    }
  }

  /** Calls `act` for each other figure resting at camp and not already busy reacting. */
  private others(self: FigureView, f: FrameInfo, act: (other: FigureView) => void): void {
    for (const other of this.views.values()) {
      if (other === self || !other.resting || other.reacting) continue;
      if (Math.hypot(other.x - f.fireX, other.y - f.fireY) > CAMP * 1.6) continue;
      const fig = this.byId.get(other.id);
      if (!fig || !fig.visible || other.villager) continue;
      const asked = other.asked;
      if (asked !== 'idle' && asked !== 'sit') continue;
      act(other);
    }
  }

  setHover(id: string | null): void {
    for (const view of this.views.values()) view.setHover(view.id === id);
  }

  pressed(id: string): void {
    this.views.get(id)?.pressed();
  }

  pick(x: number, y: number, zoom: number): string | null {
    let best: string | null = null;
    let bestD = Infinity;
    for (const view of this.views.values()) {
      const d = view.hits(x, y, zoom);
      if (d < bestD) {
        bestD = d;
        best = view.id;
      }
    }
    return best;
  }

  /** Where a figure is drawn, for anything that follows it (the camera, a tag). */
  at(id: string): { x: number; y: number } | null {
    const view = this.views.get(id);
    return view ? { x: view.x, y: view.y } : null;
  }
}


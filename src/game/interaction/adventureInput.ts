/**
 * The pointer in the expedition valley. Drags always pan the map; a tap
 * answers whatever is under it:
 *
 *   a creature showing itself   sketch it into the journal
 *   a small thing glinting      note it among the journal's small finds
 *   a friend                    open the day's plan for them
 *   a place                     look closely at it (its card appears there)
 *   something built             open the notebook's making page
 *   open ground                 stop looking closely
 *
 * While a structure is being placed, the pointer previews the site (the
 * finished art, ghosted, in a ring that is pale where it can go and rust
 * where it cannot) and a tap commits it.
 *
 * Feedback never depends on hover: a press answers at once on touch, and
 * hover is extra polish for a mouse.
 */

import { Graphics, Sprite, Text } from 'pixi.js';
import type { Vec } from '../core/math';
import type { AdventureCommand, StructureKind } from '../adventure/model';
import type { Simulation } from '../simulation/simulation';
import { finishedArt, lookOf } from '../rendering/adventure/structures';
import type { ValleyView } from '../rendering/view';
import type { GestureTarget } from './pointer';
import { structureDef } from '../adventure/structures';

/**
 * The two placement calls the rules provide. Typed loosely while the rules
 * are being rewritten: `place` may answer with a reason string, an object
 * `{ ok, reason }`, or nothing at all.
 */
interface Placement {
  siteProblem(kind: StructureKind, at: Vec): string | null;
  siteBuilders?(kind: StructureKind, at: Vec): string[];
  place(kind: StructureKind, at: Vec): unknown;
}

const OK_RING = 0xe9e2b8;
const NO_RING = 0x9c5a3c;

export class AdventureInput implements GestureTarget {
  placing: StructureKind | null = null;
  private readonly ring = new Graphics();
  private readonly ghost = new Sprite();
  private readonly builderNote = new Text({ text: '', style: { fontFamily: 'Cormorant Garamond', fontSize: 19, fill: 0x293c32, stroke: { color: 0xf1eddf, width: 4 }, align: 'center', wordWrap: true, wordWrapWidth: 290 } });
  private at: Vec | null = null;

  constructor(
    private readonly sim: Simulation,
    private readonly view: ValleyView,
    private readonly command: (c: AdventureCommand) => void,
    private readonly toast: (text: string) => void,
    private readonly placed: () => void = () => {},
  ) {
    view.overlay.addChild(this.ring, this.ghost, this.builderNote);
    this.builderNote.anchor.set(0.5, 0);
    this.ghost.visible = false;
    this.builderNote.visible = false;
  }

  private get rules(): Placement | null {
    return this.sim.expedition as unknown as Placement | null;
  }

  press(world: Vec): boolean {
    const pick = this.view.adventure?.pick(world, this.view.camera.zoom);
    if (pick) this.view.adventure!.pressed(pick);
    // Never claim the gesture: a drag that starts on a friend still pans the map.
    return false;
  }

  hold(): boolean {
    return false;
  }

  drag(): void {}

  release(): void {}

  cancel(): void {}

  hover(at: Vec | null): void {
    this.at = at;
    const layer = this.view.adventure;
    const pick = at && layer && !this.placing ? layer.pick(at, this.view.camera.zoom) : null;
    layer?.setHover(pick);
    this.view.app.canvas.style.cursor = pick || this.placing ? 'pointer' : '';
    this.preview();
  }

  /** Starts (or with null, stops) placing a structure. */
  place(kind: StructureKind | null): void {
    this.placing = kind;
    this.preview();
  }

  private preview(): void {
    this.ring.clear();
    this.ghost.visible = false;
    this.builderNote.visible = false;
    const kind = this.placing;
    const at = kind ? structureDef(kind).at ?? this.at : this.at;
    const rules = this.rules;
    if (!kind || !at || !rules) return;
    const problem = rules.siteProblem(kind, at);
    const look = lookOf(kind);
    const art = this.view.art.get(finishedArt(kind, (id) => this.view.art.has(id)));
    const width = art.width * look.scale;
    const px = 1 / this.view.camera.zoom;
    this.ring.ellipse(at.x, at.y, width * 0.6, width * 0.26).fill({ color: problem ? NO_RING : OK_RING, alpha: 0.16 });
    this.ring.ellipse(at.x, at.y, width * 0.6, width * 0.26).stroke({ color: problem ? NO_RING : OK_RING, width: 1.6 * px, alpha: 0.85 });
    this.ghost.texture = art.texture;
    this.ghost.anchor.set(art.anchor[0], art.anchor[1]);
    this.ghost.width = width;
    this.ghost.height = art.height * look.scale;
    this.ghost.position.set(at.x, at.y);
    this.ghost.alpha = problem ? 0.25 : 0.6;
    this.ghost.visible = true;
    const builders = rules.siteBuilders?.(kind, at) ?? [];
    this.builderNote.text = problem ?? (structureDef(kind).planting ? 'Plant here' : `${builders.join(' / ')} can build · leave a builder at camp`);
    this.builderNote.scale.set(px);
    this.builderNote.position.set(at.x, at.y + 32 * px);
    this.builderNote.visible = true;
  }

  tap(at: Vec): void {
    const layer = this.view.adventure;
    if (this.placing) {
      this.commit(this.placing, at);
      return;
    }
    const pick = layer?.pick(at, this.view.camera.zoom) ?? null;
    if (pick) layer!.tapped(pick);
    switch (pick?.kind) {
      case 'sighting':
        this.command({ type: 'sketch', sighting: pick.id });
        break;
      case 'glint':
        this.command({ type: 'notice', glint: pick.id });
        break;
      case 'friend':
        this.command({ type: 'notebook', page: 'plan', person: pick.id });
        break;
      case 'place':
        this.command({ type: 'inspect', place: pick.id });
        break;
      case 'building':
        this.command({ type: 'notebook', page: 'make' });
        break;
      default:
        this.command({ type: 'inspect', place: null });
        break;
    }
  }

  private commit(kind: StructureKind, at: Vec): void {
    const rules = this.rules;
    if (!rules) return;
    const problem = rules.siteProblem(kind, at);
    if (problem) {
      this.toast(problem);
      return;
    }
    const result = rules.place(kind, at);
    const reason = typeof result === 'string' ? result : result && typeof result === 'object' && (result as { ok?: boolean }).ok === false ? (result as { reason?: string }).reason ?? null : null;
    if (reason) {
      this.toast(reason);
      return;
    }
    this.place(null);
    this.placed();
  }

  dispose(): void {
    this.view.app.canvas.style.cursor = '';
    this.ring.destroy();
    this.ghost.destroy();
    this.builderNote.destroy();
  }
}

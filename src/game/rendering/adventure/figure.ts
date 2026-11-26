/**
 * One person in the valley: a frame chosen from the pose (illustrated where
 * the art exists, painted where it does not; see `wardrobe.ts`), eased
 * between scene snapshots, with everything that hangs off it: the contact
 * shadow and the long evening shadow on the ground, the pack knot, the
 * fishing line and float, the warm rim of firelight, Yui's lantern after
 * dark, and the ink ring when the player picks them. Villagers are drawn the
 * same way but cannot be picked.
 */

import { villagerTexture } from './clothes';
import { Container, Graphics, Sprite } from 'pixi.js';
import type { Pose, SceneFigure } from '../../adventure/model';
import type { CampAct, Prop } from './campLife';
import { FRAME_COUNT, type LookId } from '../placeholders/explorerRig';
import type { ArtLibrary } from '../art';
import type { FrameInfo, Stage } from './frame';
import { ActionClock, Follower, approach, hash01, seedOf } from './motion';
import { type Burst, type Particles, burst, newBurst } from './particles';
import { IdleBusiness, PERIOD, type Shown, actionFrame, newShown } from './poseTimeline';
import { explorerFor } from './rigTable';
import type { ShownPose } from './poseTimeline';
import { type Outfit, Wardrobe, type WornPoints, newWornPoints } from './wardrobe';
import { TurnPose } from './turnPose';

/** Shared pools for the small events figures make. */
export interface FigureFx {
  /** Sawdust, drops, leaves: sorted with the scenery. */
  dust: Particles;
  /** Sparks: additive, above the evening wash. */
  sparks: Particles;
  /** Height of a bridge deck under a walker's feet, so they climb the drawn arch. */
  deck?: (x: number, y: number) => number;
}

/**
 * Brief responses the layer asks for at the two moments that matter: a wave
 * back at camp when setting off, the others waving or shading their eyes as
 * someone comes home, and the bundle set down by the fire.
 */
export type Reaction = 'none' | 'wave' | 'gaze' | 'setdown' | 'waveback';

/** Where the float lands, in front of the angler (local px, facing right). */
const FLOAT_X = 50;
const FLOAT_Y = 6;
const INK = 0x24362e;
const WARM = 0xff9a52;
const scratch: Burst = newBurst();

export class FigureView {
  readonly who: LookId;
  readonly villager: boolean;
  readonly root = new Container();
  private readonly body = new Sprite();
  private readonly knot = new Sprite();
  /** Something carried or set down in camp life (an armful of wood, a basket). */
  private readonly prop = new Sprite();
  private propKind: Prop = null;
  /** Camp life's wishes for this frame, when it has the figure (see `campLife.ts`). */
  private act: CampAct | null = null;
  private readonly tackle = new Graphics();
  /** Whether the tackle has anything in it, so an empty one is not cleared every frame. */
  private tackleDrawn = false;
  private readonly shadow: Sprite;
  private readonly long: Sprite;
  private readonly rim = new Sprite();
  private readonly lamp: Sprite;
  private readonly ring = new Graphics();
  private readonly follow = new Follower();
  private readonly clock = new ActionClock();
  private readonly business: IdleBusiness;
  private readonly shown: Shown = newShown();
  private readonly wardrobe: Wardrobe;
  private readonly worn: WornPoints = newWornPoints();
  private outfit: Outfit;
  private index = 0;
  /** True when the frame was chosen by idle business rather than the scene. */
  private idling = false;
  private readonly seed: number;
  /** Height relative to an illustrated figure (48 px), for shadows and hit areas. */
  private readonly k: number;
  private shownId = '';
  /** The pose and frame last shown, so a cue fires once on entering a frame even when the art does not change. */
  private lastPose: ShownPose = 'idle';
  private lastFrame = -2;
  private knotHint = '';
  /** Distance walked, for the stride. */
  private walked = 0;
  /** Seconds on the same spot. */
  private still = 0;
  /** Smoothed facing, -1..1; passes through 0 when turning so the figure squashes round. */
  private turn = 1;
  private readonly pivot = new TurnPose();
  private alpha = 0;
  private settle = 0;
  private hover = 0;
  private press = 0;
  private moteIn = 2;
  /** Seconds left of the friend's own action played as idle life, and until the next. */
  private sigLeft = 0;
  private sigNext: number;
  private reaction: Reaction = 'none';
  private reactLeft = 0;
  private reactFace: 1 | -1 = 1;
  /** The bundle has been set down by the fire. */
  private setDown = false;
  /** When the figure last turned round. */
  private turnedAt = -9;
  private castAt = -9;
  private strikeAt = -9;
  private time: number;
  /** True once the scene no longer lists this figure; it fades and is then destroyed. */
  gone = false;
  /** Drawn position (feet), for picking and for trails. */
  x = 0;
  y = 0;
  facing: 1 | -1 = 1;
  pose: ShownPose = 'idle';

  constructor(
    readonly id: string,
    look: string,
    role: 'friend' | 'villager',
    private readonly art: ArtLibrary,
    stage: Stage,
  ) {
    this.villager = role === 'villager';
    this.who = explorerFor(look || id);
    this.wardrobe = new Wardrobe(this.who, art, this.villager);
    this.outfit = this.wardrobe.outfit('idle');
    this.seed = seedOf(id);
    this.k = this.wardrobe.height / 48;
    this.business = new IdleBusiness(this.seed);
    this.time = hash01(this.seed) * 50;
    this.sigNext = 8 + hash01(this.seed + 5) * 14;

    this.shadow = this.groundSprite('shadow', stage.ground);
    this.long = this.groundSprite('shadow', stage.ground);
    this.long.anchor.set(0.08, 0.5);
    this.long.alpha = 0;

    this.knot.anchor.set(0.5, 0.85);
    this.knot.visible = false;
    this.prop.visible = false;
    this.root.addChild(this.body, this.knot, this.prop, this.tackle);
    this.root.alpha = 0;
    stage.sorted.addChild(this.root);

    this.rim.blendMode = 'add';
    this.rim.tint = WARM;
    this.rim.visible = false;
    this.lamp = new Sprite(art.get('lamp').texture);
    this.lamp.anchor.set(0.5);
    this.lamp.blendMode = 'add';
    this.lamp.width = this.lamp.height = 44;
    this.lamp.visible = false;
    stage.glow.addChild(this.rim, this.lamp);

    this.ring.ellipse(0, 0, 19, 7).stroke({ color: INK, width: 1.3, alpha: 0.75 });
    this.ring.ellipse(0, 0, 22, 8.4).stroke({ color: INK, width: 0.6, alpha: 0.35 });
    this.ring.alpha = 0;
    stage.ink.addChild(this.ring);
  }

  private groundSprite(asset: string, parent: Container): Sprite {
    const sprite = new Sprite(this.art.get(asset).texture);
    sprite.anchor.set(0.5);
    parent.addChild(sprite);
    return sprite;
  }

  /** Brief response to a press: the ring tightens and the figure lifts a little. */
  pressed(): void {
    this.press = 1;
  }

  /** Plays a short reaction facing toward `towardX`. A wave back also stands still before walking on. */
  react(kind: Reaction, seconds: number, towardX: number): void {
    this.reaction = kind;
    this.reactLeft = seconds;
    this.reactFace = towardX < this.x ? -1 : 1;
    if (kind === 'waveback') this.follow.hold(seconds);
  }

  /** True while standing on one spot (not walking). */
  get resting(): boolean {
    return this.follow.speed < 2 && this.still > 0.4;
  }

  get speed(): number {
    return this.follow.speed;
  }

  get stillFor(): number {
    return this.still;
  }

  get reacting(): boolean {
    return this.reactLeft > 0;
  }

  /** The friend's own action, where they have frames for it, for camp life to choose. */
  get signature(): Pose | null {
    const pose = this.villager ? null : this.wardrobe.signature;
    return pose === 'track' || pose === 'talk' || pose === 'look' || pose === 'forage' || pose === 'build' || pose === 'fish' ? pose : null;
  }

  /** True while camp life has the figure. */
  get busy(): boolean {
    return this.act !== null;
  }

  /** The pose the figure is being asked for (camp life's, or the scene's). */
  get asked(): Pose {
    return this.act?.pose ?? this.scenePose;
  }
  private scenePose: Pose = 'idle';

  setHover(on: boolean): void {
    this.hover = on ? 1 : 0;
  }

  /** `fig` is null once the scene has dropped this figure. `act` is camp life's wish for this frame, if it has the figure. */
  update(fig: SceneFigure | null, f: FrameInfo, fx: FigureFx, act: CampAct | null = null): void {
    const dt = f.dt;
    this.time += dt;
    const target = fig !== null && fig.visible;
    this.act = act && target ? act : null;
    this.scenePose = fig?.pose ?? 'idle';
    if (fig) {
      const at = this.act ?? fig.at;
      this.follow.target(at.x, at.y);
      if (this.follow.jumped) {
        // Too far to glide: fade through the move instead.
        this.follow.jumped = false;
        this.alpha = 0;
        this.business.reset();
      }
    }
    const moved = this.follow.step(dt);
    this.walked += moved;
    this.still = moved > 0.05 ? 0 : this.still + dt;
    this.alpha = this.villager ? approach(this.alpha, target ? 1 : 0, target ? 5 : 4, dt) : target ? 1 : 0;
    if (!fig && this.alpha < 0.01) this.gone = true;

    this.choosePose(fig, f);
    this.place(fig, f, fx);
    this.dress(fig, f, fx);
  }

  private choosePose(fig: SceneFigure | null, f: FrameInfo): void {
    const shown = this.shown;
    const act = this.act;
    const pose = act?.pose ?? fig?.pose ?? 'idle';
    if (this.reactLeft > 0) {
      this.reactLeft -= f.dt;
      if (this.reactLeft <= 0 && this.reaction === 'setdown') this.setDown = true;
      if (this.react0(pose, shown)) return;
    }
    if (this.follow.speed > 5) this.setDown = false;
    const moving = this.follow.speed > 5;
    const fireside = f.firelight > 0.2 && Math.abs(this.x - f.fireX) < 70 && Math.abs(this.y - f.fireY) < 50;
    this.idling = false;
    if (moving && (pose === 'walk' || pose === 'carry' || pose === 'idle' || this.follow.speed > 14)) {
      shown.pose = pose === 'carry' ? 'carry' : 'walk';
      // The frame follows the distance walked (see `dress`), so the feet stay planted.
      shown.frame = -1;
      shown.turned = false;
      shown.cue = 'none';
      shown.breathe = false;
      shown.offset = 0;
      this.business.reset();
    } else if (act?.tend && !moving) {
      // Crouched at the fire by day, poking it now and then.
      const poke = f.reduced ? 0 : Math.floor(this.time * 0.8 + (this.seed % 7)) % 2;
      shown.pose = 'tend';
      shown.frame = poke;
      shown.cue = poke === 1 ? 'poke' : 'none';
      shown.turned = false;
      shown.breathe = true;
      shown.offset = approach(shown.offset, 0, 4, f.dt);
    } else if (pose === 'idle' && !act && this.signatureLife(f, shown)) {
      // Busy with something of their own.
    } else if (pose === 'idle' || pose === 'walk' || pose === 'carry') {
      // Standing about (or waiting mid-walk): never quite still.
      this.business.step(f.dt, this.still, fireside, f.reduced, shown);
      if (pose === 'carry' && shown.pose === 'walk') shown.pose = 'carry';
      this.idling = true;
    } else {
      this.clock.step(act ? act.action : fig?.action ?? 0, f.dt, PERIOD[pose]);
      actionFrame(pose, this.clock.value, this.time, this.seed % 1000, shown);
      shown.offset = approach(shown.offset, 0, 4, f.dt);
    }
  }

  /**
   * Now and then a friend standing about at home does their own thing for a few
   * seconds (see `Wardrobe.signature`). Returns true while they are at it.
   */
  private signatureLife(f: FrameInfo, shown: Shown): boolean {
    const pose = this.villager ? null : this.wardrobe.signature;
    if (!pose || this.still < 3) {
      this.sigLeft = 0;
      return false;
    }
    if (this.sigLeft <= 0) {
      this.sigNext -= f.dt;
      if (this.sigNext > 0) return false;
      this.sigNext = 14 + hash01(this.seed + Math.floor(this.time)) * 16;
      // A carpenter hammers only where something is going up.
      if (pose === 'build' && !f.sites.some((s) => Math.abs(s.x - this.x) < 70 && Math.abs(s.y - this.y) < 50)) return false;
      this.sigLeft = 4 + hash01(this.seed * 3 + Math.floor(this.time)) * 3;
    }
    this.sigLeft -= f.dt;
    const frames = pose === 'track' ? 4 : FRAME_COUNT[pose];
    shown.pose = pose;
    shown.frame = f.reduced ? 0 : Math.floor(this.time * 3.5) % frames;
    shown.cue = 'none';
    shown.turned = false;
    shown.breathe = true;
    shown.offset = 0;
    return true;
  }

  /** Fills `shown` for the current reaction; false when the pose in hand does not allow one. */
  private react0(pose: string, shown: Shown): boolean {
    const free = pose === 'idle' || pose === 'walk' || pose === 'carry' || pose === 'sit';
    if (!free) return false;
    shown.cue = 'none';
    shown.offset = 0;
    shown.breathe = true;
    shown.turned = false;
    if (pose === 'sit') {
      // Seated friends simply turn to look.
      shown.pose = 'sit';
      shown.frame = 0;
      return true;
    }
    switch (this.reaction) {
      case 'wave':
      case 'waveback':
        shown.pose = 'wave';
        shown.frame = [0, 2, 1, 2][Math.floor(this.time * 5) % 4]!;
        shown.breathe = false;
        return true;
      case 'gaze':
        shown.pose = 'look';
        shown.frame = 0;
        return true;
      case 'setdown':
        shown.pose = 'forage';
        shown.frame = this.reactLeft > 0.8 ? 0 : 3;
        return true;
      default:
        return false;
    }
  }

  private place(fig: SceneFigure | null, f: FrameInfo, fx: FigureFx): void {
    const shown = this.shown;
    const heading = this.follow.heading;
    let facing: number = this.act?.facing ?? fig?.facing ?? this.facing;
    if (heading !== 0 && this.follow.speed > 5) facing = heading;
    if (shown.turned) facing = -facing;
    if (this.reactLeft > 0 && this.reaction !== 'none') facing = this.reactFace;
    // Turn at most about once a second, so a figure never flickers between facings.
    const want: 1 | -1 = facing < 0 ? -1 : 1;
    if (want !== this.facing && ((this.follow.speed < 5 && !shown.turned) || this.time - this.turnedAt >= (this.wardrobe.turn ? TurnPose.duration : 1))) {
      this.facing = want;
      this.turnedAt = this.time;
    }
    // Through a turn the figure narrows to a sliver and widens again, rather than mirroring at once.
    this.turn = f.reduced ? this.facing : approach(this.turn, this.facing, 11, f.dt);
    // Every illustrated pose uses the same identity-preserving pivot.
    const canPivot = this.wardrobe.turn !== null && !this.wardrobe.outfit(shown.pose).painted;
    this.pivot.step(this.facing, f.dt, f.reduced || !canPivot);

    this.x = this.follow.x + shown.offset;
    this.y = this.follow.y;
    const visible = this.alpha > 0.01 && this.x > f.left && this.x < f.right && this.y > f.top && this.y < f.bottom + 80;
    this.root.visible = visible;
    this.shadow.visible = visible;

    this.press = Math.max(0, this.press - f.dt * 3);
    this.settle = Math.max(0, this.settle - f.dt * 6);
    const deck = fx.deck?.(this.x, this.y) ?? 0;
    const lift = this.press * 2 + deck;
    this.root.position.set(this.x, this.y - lift);
    this.root.zIndex = this.y;
    this.root.alpha = this.alpha;
    // A pivot stays full width; other rigs keep their original eased turn.
    const squash = Math.max(0.12, Math.abs(this.turn));
    const breathe = shown.breathe && !f.reduced ? 1 + 0.014 * Math.sin(this.time * 1.75 + this.seed) : 1;
    const sx = canPivot ? (this.pivot.active ? 1 : this.facing) : Math.sign(this.turn || this.facing) * squash;
    this.root.scale.set(sx, breathe * (1 - this.settle * 0.035));

    // Contact shadow, stretched toward the lower right as the sun drops.
    const sun = f.sun * this.alpha;
    this.shadow.position.set(this.x + 2 + 6 * (f.sunLength - 1), this.y - deck + 1 + 1.2 * (f.sunLength - 1));
    this.shadow.width = 30 * this.k * (0.8 + 0.4 * f.sunLength);
    this.shadow.height = 9 * this.k;
    this.shadow.rotation = 0.18 * (f.sunLength - 1);
    this.shadow.alpha = 0.34 * Math.max(sun, f.firelight * 0.5);

    const ringAlpha = Math.max(fig?.selected ? 1 : 0, this.hover * 0.6, this.press);
    this.ring.alpha = approach(this.ring.alpha, ringAlpha * this.alpha, 10, f.dt);
    this.ring.visible = this.ring.alpha > 0.01;
    this.ring.position.set(this.x, this.y);
    this.ring.scale.set(1 - this.press * 0.12 + this.hover * 0.04);
  }

  /** Chooses the outfit and frame for what is shown, keeping painted bodies out of idle business where an illustrated stand serves. */
  private wear(): void {
    const shown = this.shown;
    let outfit = this.wardrobe.outfit(shown.pose);
    if (this.pivot.active && this.wardrobe.turn) {
      this.outfit = this.wardrobe.turn;
      this.index = 0;
      return;
    }
    if (this.idling && outfit.painted && this.wardrobe.stand && shown.pose !== 'walk' && shown.pose !== 'carry') outfit = this.wardrobe.stand;
    this.outfit = outfit;
    if (shown.frame < 0) {
      const cycle = ((this.walked / outfit.stride) % 1 + 1) % 1;
      this.index = Math.floor(cycle * outfit.ids.length) % outfit.ids.length;
    } else if (this.idling && (shown.pose === 'walk' || shown.pose === 'carry')) {
      this.index = Math.floor((shown.frame / 8) * outfit.ids.length) % outfit.ids.length;
    } else this.index = this.wardrobe.index(outfit, shown.pose, shown.frame);
  }

  private dress(fig: SceneFigure | null, f: FrameInfo, fx: FigureFx): void {
    const shown = this.shown;
    this.wear();
    const outfit = this.outfit;
    const id = outfit.ids[this.index]!;
    const entering = id !== this.shownId;
    if (entering) {
      if (this.pose !== shown.pose) this.settle = 1;
      this.shownId = id;
      this.pose = shown.pose;
      const a = this.art.get(id);
      // Shared villagers borrow coat colours; individually illustrated residents keep their own paint.
      const texture = this.villager && !outfit.painted ? villagerTexture(a.texture, this.who) : a.texture;
      this.body.texture = texture;
      this.body.anchor.set(a.anchor[0], a.anchor[1]);
      this.body.width = a.width * outfit.scale;
      this.body.height = a.height * outfit.scale;
      this.rim.texture = texture;
      this.rim.anchor.set(a.anchor[0], a.anchor[1]);
      this.wardrobe.points(outfit, this.index, this.worn);
    }
    if (shown.frame !== this.lastFrame || shown.pose !== this.lastPose) {
      this.lastFrame = shown.frame;
      this.lastPose = shown.pose;
      if (shown.cue !== 'none') this.cue(f, fx);
    }
    const points = this.worn;
    const sx = this.root.scale.x;

    // The pack knot rides on the back, telling the player what is coming home.
    const hint = fig?.pack ?? null;
    if (hint !== this.knotHint) {
      this.knotHint = hint ?? '';
      if (hint) this.knot.texture = this.art.get(`pack-${hint}`).texture;
      this.knot.visible = !!hint;
    }
    // The pack is behind the chest in the front-facing pivot illustration.
    this.knot.visible = !!hint && !this.pivot.active;
    // Set down by the fire, the bundle sits on the ground in front of its bearer; carried home it is a fuller load.
    const kn = this.art.get('pack-plain');
    const laden = shown.pose === 'carry' && !this.setDown ? 1.45 : 1;
    this.knot.width = kn.width * laden;
    this.knot.height = kn.height * laden;
    if (hint && this.setDown) this.knot.position.set(13, 1);
    else if (hint) this.knot.position.set(points.knot[0], points.knot[1] + (laden - 1) * 6);
    // A rare bundle now and then lets two or three fine warm motes lift off it: a flourish, not a glow.
    if (hint === 'rare' && this.root.visible && !f.reduced) {
      this.moteIn -= f.dt;
      if (this.moteIn <= 0) {
        this.moteIn = 3.5 + hash01(this.seed + Math.floor(this.time)) * 3;
        const b = burst(scratch, this.x + points.knot[0] * sx, this.y + points.knot[1] - 4, this.y);
        b.vy = -14;
        b.spread = 10;
        b.gravity = -3;
        b.life = 0.9;
        b.size = 2.4;
        b.grow = 0.5;
        b.tint = 0xffe6b0;
        b.alpha = 0.55;
        b.drag = 1;
        fx.sparks.emit(b, 3);
      }
    }

    this.drawProp(f, fx);
    this.drawTackle(f);

    // Firelight: a warm copy of the frame, offset toward the fire, adds a lit rim on that side.
    const dx = f.fireX - this.x;
    const dy = f.fireY - this.y;
    const d = Math.hypot(dx, dy);
    const near = Math.max(0, 1 - d / 190);
    const lit = f.firelight * near * near * this.alpha;
    this.rim.visible = this.root.visible && lit > 0.02;
    if (this.rim.visible) {
      const flicker = f.reduced ? 1 : 0.88 + 0.12 * Math.sin(this.time * 9 + this.seed);
      this.rim.position.set(this.root.x + (dx / (d || 1)) * 1.1, this.root.y + (dy / (d || 1)) * 0.6);
      this.rim.scale.set(this.root.scale.x * Math.abs(this.body.scale.x), this.root.scale.y * this.body.scale.y);
      this.rim.alpha = Math.min(0.62, lit * 0.75) * flicker;
    }

    // The long shadow thrown away from the fire.
    const throwShadow = f.firelight * Math.max(0, 1 - d / 260) * this.alpha;
    this.long.visible = this.root.visible && throwShadow > 0.02;
    if (this.long.visible) {
      this.long.position.set(this.x, this.y + 1);
      this.long.rotation = Math.atan2(-dy, -dx);
      this.long.width = 36 + d * 0.32;
      this.long.height = 10 * this.k;
      this.long.alpha = throwShadow * 0.42;
    }

    // Yui's lantern lights itself after dark.
    const lantern = this.who === 'yui' ? points.lantern : null;
    const glow = lantern ? Math.max(f.night, f.dusk * 0.6) * this.alpha : 0;
    this.lamp.visible = this.root.visible && glow > 0.03;
    if (lantern && this.lamp.visible) {
      const flicker = f.reduced ? 1 : 0.85 + 0.15 * Math.sin(this.time * 7.3);
      this.lamp.position.set(this.root.x + lantern[0] * sx, this.root.y + lantern[1]);
      this.lamp.alpha = glow * 0.9 * flicker;
    }
  }

  /** An armful of wood carried to the fire, a basket carried or set down beside the work. */
  private drawProp(f: FrameInfo, fx: FigureFx): void {
    const act = this.act;
    const kind: Prop = act && this.reactLeft <= 0 ? act.prop : null;
    if (kind !== this.propKind) {
      this.propKind = kind;
      if (kind) {
        const asset = kind === 'wood' ? 'driftwood' : 'basket';
        this.prop.texture = this.art.get(asset).texture;
        const a = this.art.get(asset);
        this.prop.anchor.set(a.anchor[0], a.anchor[1]);
        if (kind === 'wood') {
          this.prop.width = 25;
          this.prop.height = 10;
          this.prop.rotation = -0.12;
        } else {
          this.prop.width = kind === 'basket' ? 13 : 15;
          this.prop.height = kind === 'basket' ? 10.5 : 12;
          this.prop.rotation = 0;
        }
      }
    }
    this.prop.visible = !!kind && this.root.visible && !this.pivot.active;
    if (kind && this.prop.visible) {
      const hand = this.worn.hand ?? [6, -25];
      // Held in front at the hands; a basket set down sits on the ground beside the work.
      if (kind === 'basket-down') this.prop.position.set(15, 1);
      else if (kind === 'wood') this.prop.position.set(hand[0] + 1, hand[1] + 4);
      else this.prop.position.set(hand[0] + 2, hand[1] + 9);
    }
    // An armful laid on the fire: a few sparks and a breath of smoke.
    if (act?.drop && !f.reduced && this.root.visible) {
      this.settle = 1;
      // The hearth spot faces the fire about 27 px away.
      const b = burst(scratch, this.x + this.facing * 26, this.y - 14, this.y - 6);
      b.vy = -30;
      b.spread = 24;
      b.gravity = -5;
      b.life = 1.1;
      b.size = 2.6;
      b.grow = 0.4;
      b.tint = 0xffb45a;
      b.alpha = 0.9;
      b.drag = 0.6;
      fx.sparks.emit(b, 5);
    }
  }

  /**
   * While fishing: rings where an illustrated line meets the water, or, for a
   * painted angler or one borrowing a rod, the rod, line, float and ripples.
   */
  private drawTackle(f: FrameInfo): void {
    const g = this.tackle;
    if (this.tackleDrawn) g.clear();
    this.tackleDrawn = false;
    if (this.shown.pose !== 'fish' || !this.root.visible) return;
    this.tackleDrawn = true;
    const t = this.time;
    const w = this.worn;
    if (w.lineEnd) {
      for (let i = 0; i < 2; i++) {
        const p = f.reduced ? 0.4 + i * 0.3 : (t * 0.4 + i * 0.5) % 1;
        g.ellipse(w.lineEnd[0], w.lineEnd[1] + 0.5, 2.5 + p * 12, 1 + p * 3.6).stroke({ color: 0xe6f2f0, width: 0.7, alpha: (1 - p) * 0.7 });
      }
      return;
    }
    const tip = w.tip;
    if (!tip) return;
    const tx = tip[0];
    const ty = tip[1];
    if (this.outfit.rod && w.hand) g.moveTo(w.hand[0], w.hand[1]).quadraticCurveTo((w.hand[0] + tx) / 2, (w.hand[1] + ty) / 2 - 3, tx, ty).stroke({ color: 0x7d5f37, width: 1.1 });
    // After the cast the float flies out; after a strike it is pulled up out of the water.
    const flying = Math.min(1, (t - this.castAt) / 0.45);
    const lifted = Math.max(0, 1 - (t - this.strikeAt) / 0.7);
    let fxp = FLOAT_X;
    let fyp = FLOAT_Y;
    if (this.shown.frame === 0) {
      fxp = tx + 2;
      fyp = ty + 10;
    } else if (flying < 1) {
      fxp = tx + (FLOAT_X - tx) * flying;
      fyp = ty + (FLOAT_Y - ty) * flying - Math.sin(Math.PI * flying) * 16;
    } else if (lifted > 0) {
      fyp = FLOAT_Y - lifted * 10;
      fxp = FLOAT_X - lifted * 6;
    } else if (!f.reduced) {
      // Bobbing, with now and then a nibble that pulls it under.
      const nibble = hash01(Math.floor(t * 0.7) + this.seed) < 0.25 ? Math.max(0, Math.sin((t * 0.7 % 1) * Math.PI * 3)) * 1.6 : 0;
      fyp = FLOAT_Y + Math.sin(t * 2.4 + this.seed) * 0.6 + nibble;
    }
    const sag = this.shown.frame === 3 ? 0 : 7;
    g.moveTo(tx, ty).quadraticCurveTo((tx + fxp) / 2, Math.max(ty, fyp) + sag, fxp, fyp - 1.2).stroke({ color: 0xf2ede0, width: 0.5, alpha: 0.85 });
    const onWater = this.shown.frame === 2 && flying >= 1 && lifted === 0;
    if (onWater) {
      for (let i = 0; i < 2; i++) {
        const p = f.reduced ? 0.4 + i * 0.3 : ((t * 0.45 + i * 0.5) % 1);
        g.ellipse(FLOAT_X, FLOAT_Y + 0.6, 3 + p * 13, 1.1 + p * 4).stroke({ color: 0xe6f2f0, width: 0.7, alpha: (1 - p) * 0.75 });
      }
    }
    g.ellipse(fxp, fyp - 0.8, 1.1, 1.6).fill({ color: 0xc8553e });
    g.ellipse(fxp, fyp - 2, 0.7, 0.6).fill({ color: 0xf4efe0 });
  }

  private cue(f: FrameInfo, fx: FigureFx): void {
    const w = this.worn;
    // Illustrated frames have no tool tip of their own: the hand stands in for it.
    const points = { tip: w.tip ?? (w.hand ? ([w.hand[0] + 6, w.hand[1] + 2] as const) : null) };
    const sx = this.root.scale.x;
    const at = (lx: number, ly: number, depth: number): Burst => burst(scratch, this.x + lx * sx, this.y + ly, depth);
    switch (this.shown.cue) {
      case 'cast':
        this.castAt = this.time;
        break;
      case 'strike': {
        this.strikeAt = this.time;
        if (f.reduced) break;
        const b = at(FLOAT_X, FLOAT_Y, this.y + 4);
        b.vy = -46;
        b.spread = 44;
        b.gravity = 150;
        b.life = 0.7;
        b.size = 2.2;
        b.tint = 0xe8f4f4;
        fx.dust.emit(b, 7);
        break;
      }
      case 'blow': {
        if (!points.tip || f.reduced) break;
        const b = at(points.tip[0], points.tip[1] + 2, this.y + 2);
        b.vy = -22;
        b.spread = 40;
        b.gravity = 80;
        b.life = 0.8;
        b.size = 1.7;
        b.tint = 0xd9c08a;
        b.drag = 1.5;
        fx.dust.emit(b, 5);
        break;
      }
      case 'pluck': {
        if (!points.tip || f.reduced) break;
        const b = at(points.tip[0], points.tip[1], this.y + 2);
        b.vy = -14;
        b.spread = 16;
        b.gravity = 12;
        b.life = 1.2;
        b.size = 1.8;
        b.tint = 0x8aa957;
        fx.dust.emit(b, 2);
        break;
      }
      case 'poke': {
        if (!points.tip || f.reduced) break;
        // A small lean into the poke.
        this.settle = Math.max(this.settle, 0.7);
        const b = at(points.tip[0], points.tip[1], this.y);
        b.vy = -38;
        b.spread = 26;
        b.gravity = -6;
        b.life = 1.1;
        b.size = 3;
        b.grow = 0.4;
        b.tint = 0xffb45a;
        b.drag = 0.6;
        fx.sparks.emit(b, 6);
        break;
      }
      default:
        break;
    }
  }

  /** Hit test in world px, generous and zoom-aware. */
  hits(x: number, y: number, zoom: number): number {
    if (this.alpha < 0.3 || this.villager) return Infinity;
    // At least 44 screen px across and tall, so a thumb finds them on a phone.
    const pad = 8 / zoom;
    const half = Math.max(13 * this.k + pad, 24 / zoom);
    const top = Math.min(this.y - 50 * this.k - pad, this.y - 52 / zoom);
    if (x < this.x - half || x > this.x + half || y < top || y > this.y + Math.max(6 + pad, 10 / zoom)) return Infinity;
    return Math.hypot(x - this.x, (y - (this.y - 24 * this.k)) * 0.6);
  }

  destroy(): void {
    this.root.destroy({ children: true });
    this.shadow.destroy();
    this.long.destroy();
    this.rim.destroy();
    this.lamp.destroy();
    this.ring.destroy();
  }
}

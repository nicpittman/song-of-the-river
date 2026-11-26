/**
 * Light that gathers on places while the player works: a soft pool of warm
 * light lying on the ground under each place (flattened, because the valley is
 * seen at a slant), a few motes of light drifting up from places a line could
 * reach, and the place's name in a small serif label just above it.
 *
 * The tool says how strongly each place should be lit; this class eases
 * toward that, so everything fades rather than switches. All display objects
 * are created once per place and only their alpha, scale and position change.
 */

import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { damp, lerp, type Vec } from '../core/math';
import type { PlaceDef } from '../world/types';
import { OVERLAY, overlayTextures } from './overlayArt';
import { placePresentation } from './placePresentation';

/** How a place should look this frame. Every value is 0..1. */
export interface PlaceLook {
  /** Strength of the pool of light. */
  light: number;
  /** How much the light breathes (0 holds it steady). */
  breathe: number;
  /** Warmth to brightness: 0 is lamp light, 1 the paler light of a chosen destination. */
  bright: number;
  /** Motes of light rising from the place. */
  motes: number;
  /** Visibility of the name label. */
  label: number;
}

export const DARK: PlaceLook = { light: 0, breathe: 0, bright: 0, motes: 0, label: 0 };

/** Combines two looks, keeping the stronger of each quality. */
export function brighter(a: PlaceLook, b: Partial<PlaceLook>): PlaceLook {
  return {
    light: Math.max(a.light, b.light ?? 0),
    breathe: Math.max(a.breathe, b.breathe ?? 0),
    bright: Math.max(a.bright, b.bright ?? 0),
    motes: Math.max(a.motes, b.motes ?? 0),
    label: Math.max(a.label, b.label ?? 0),
  };
}

/** Ground seen at a slant: circles on the ground appear this much shorter than wide. */
const SLANT = 0.6;
const LOOK_KEYS = ['light', 'breathe', 'bright', 'motes', 'label'] as const;
const MOTES_PER_PLACE = 5;
/** Seconds a mote takes to rise and fade. */
const MOTE_LIFE = 3.6;
const LABEL_FONT = "'Cormorant Garamond', 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";

interface Lamp {
  place: PlaceDef;
  look: PlaceLook;
  pool: Sprite;
  motes: Sprite[];
  label: Container;
  name: Text;
  rule: Sprite;
  role: Text;
  flow: Graphics;
  colour: number;
  flowFrame: number;
  edge: Graphics;
  edgeZoom: number;
  /** Offsets the breathing so neighbouring places do not pulse in step. */
  phase: number;
  /** A brief flare when a route arrives (seconds remaining). */
  flare: number;
}

export class PlaceLights {
  private readonly lamps = new Map<string, Lamp>();

  /** Labels are part of the place's pointer target, even above its ground region. */
  atLabel(world: Vec, px: number): PlaceDef | null {
    for (const lamp of this.lamps.values()) {
      if (!lamp.label.visible || lamp.label.alpha < 0.2) continue;
      const half = Math.max(lamp.name.width, lamp.role.width) * px / 2 + px * 6;
      if (Math.abs(world.x - lamp.label.x) <= half && world.y >= lamp.label.y - lamp.name.height * px && world.y <= lamp.label.y + 23 * px) return lamp.place;
    }
    return null;
  }

  constructor(
    places: readonly PlaceDef[],
    private readonly ground: Container,
    private readonly labels: Container,
  ) {
    this.sync(places);
  }

  /** Adds lights for places that have appeared (planted groves) and removes those that have gone. */
  sync(places: readonly PlaceDef[]): void {
    const live = new Set(places.map((p) => p.id));
    for (const [id, lamp] of this.lamps) {
      if (live.has(id)) continue;
      this.destroyLamp(lamp);
      this.lamps.delete(id);
    }
    places.forEach((place, i) => {
      if (!this.lamps.has(place.id)) this.lamps.set(place.id, this.makeLamp(place, i));
      else {
        const lamp=this.lamps.get(place.id)!;lamp.place=place;
        lamp.role.text=placePresentation(place).role;
      }
    });
  }

  private destroyLamp(lamp: Lamp): void {
    lamp.edge.destroy();
    lamp.flow.destroy();
    lamp.pool.destroy();
    for (const mote of lamp.motes) mote.destroy();
    lamp.label.destroy({ children: true });
  }

  private makeLamp(place: PlaceDef, index: number): Lamp {
    const tex = overlayTextures();
    const pool = new Sprite({ texture: tex.pool, anchor: 0.5, visible: false });
    pool.blendMode = 'add';
    const motes: Sprite[] = [];
    for (let i = 0; i < MOTES_PER_PLACE; i++) {
      const mote = new Sprite({ texture: tex.glow, anchor: 0.5, visible: false, tint: OVERLAY.lampBright });
      mote.blendMode = 'add';
      motes.push(mote);
    }
    // Four short arcs read as a clearing, without drawing a node over its art.
    const edge = new Graphics();
    const flow = new Graphics();
    this.ground.addChild(pool, edge, flow, ...motes);

    const presentation = placePresentation(place);
    const name = new Text({
      text: place.name,
      anchor: { x: 0.5, y: 1 },
      style: {
        fontFamily: LABEL_FONT,
        fontSize: 20,
        fontWeight: '500',
        letterSpacing: 1.1,
        fill: 0x213d32,
        stroke: { color: 0xfff7e4, width: 3, join: 'round' },
        padding: 10,
        dropShadow: { color: OVERLAY.ink, alpha: 0.2, blur: 1, distance: 1, angle: Math.PI / 2 },
      },
    });
    const rule = new Sprite({ texture: tex.hairline, anchor: { x: 0.5, y: 0.5 }, tint: OVERLAY.lamp });
    const label = new Container({ visible: false });
    const role = new Text({ text: presentation.role, anchor: { x: 0.5, y: 0 }, style: {
      fontFamily: 'system-ui, sans-serif', fontSize: 11, fontWeight: '600', letterSpacing: 0.2,
      fill: 0x263c32, stroke: { color: 0xfff7e4, width: 2.5, join: 'round' }, padding: 4,
      
    } });
    role.y = 5;
    label.addChild(name, rule, role);
    rule.position.set(0, 1);
    this.labels.addChild(label);

    return {
      place,
      look: { ...DARK },
      pool,
      motes,
      label,
      name,
      rule,
      role,
      flow,
      colour: presentation.colour,
      flowFrame: -1,
      edge,
      edgeZoom: 0,
      phase: index * 1.7,
      flare: 0,
    };
  }

  /** A brief brightening of a place, as a new route arrives at it. */
  flare(id: string): void {
    const lamp = this.lamps.get(id);
    if (lamp) lamp.flare = 1.1;
  }

  /**
   * Eases every place toward its requested look and lays out its light.
   * `px` converts screen pixels to world units at the current zoom.
   */
  update(dt: number, time: number, px: number, looks: ReadonlyMap<string, PlaceLook>, reducedMotion: boolean): void {
    for (const [id, lamp] of this.lamps) {
      const target = looks.get(id) ?? DARK;
      const look = lamp.look;
      // Light rises a little faster than it falls, so responses feel immediate but leave gently.
      for (const key of LOOK_KEYS) {
        look[key] = damp(look[key], target[key], target[key] > look[key] ? 9 : 4.5, dt);
      }
      lamp.flare = Math.max(0, lamp.flare - dt);
      this.layout(lamp, time, px, reducedMotion);
    }
  }

  private layout(lamp: Lamp, time: number, px: number, reducedMotion: boolean): void {
    const { place, look } = lamp;
    const flare = Math.sin(Math.min(1, lamp.flare / 1.1) * Math.PI) * 0.6;
    const breath = reducedMotion ? 0 : Math.sin(time * 1.5 + lamp.phase) * look.breathe;
    const light = Math.min(1, look.light * (1 + breath * 0.22) + flare);
    const lit = light > 0.01;

    lamp.edge.visible = false;
    lamp.flow.visible = look.light > 0.25;
    const r = place.radius * 0.8;
    if (lamp.flow.visible) {
      if (Math.abs(lamp.edgeZoom - px) > 0.01) {
        lamp.edgeZoom = px;
        lamp.edge.clear();
        // A continuous, gently irregular region, rather than a circular button.
        for (let i = 0; i <= 64; i++) {
          const a = i / 64 * Math.PI * 2;
          const reach = r * (1 + 0.045 * Math.sin(a * 3 + lamp.phase) + 0.025 * Math.cos(a * 5));
          const x = Math.cos(a) * reach;
          const y = Math.sin(a) * reach * SLANT;
          if (!i) lamp.edge.moveTo(x, y); else lamp.edge.lineTo(x, y);
        }
        lamp.edge.closePath().fill({ color: lamp.colour, alpha: 0.035 })
          .stroke({ color: lamp.colour, width: px * 1.2, alpha: 0.5 });
      }
      lamp.edge.position.set(place.x, place.y);
      lamp.edge.alpha = 0;
      const frame = reducedMotion ? 0 : Math.floor(time * 18);
      if (frame !== lamp.flowFrame) {
        lamp.flowFrame = frame;
        lamp.flow.clear();
        const phase = reducedMotion ? lamp.phase : time * 0.55 + lamp.phase;
        for (let row = 0; row < 2; row++) {
          for (let i = 0; i <= 28; i++) {
            const t = i / 28;
            const x = (t - 0.5) * r * 1.25;
            const y = (Math.sin(t * Math.PI * 2 + phase + row * 1.3) * 0.1 + (row - 0.5) * 0.2) * r * SLANT;
            if (!i) lamp.flow.moveTo(x, y); else lamp.flow.lineTo(x, y);
          }
          lamp.flow.stroke({ color: lamp.colour, width: px * 1.25, alpha: 0.24 });
        }
      }
      lamp.flow.position.set(place.x, place.y);
      lamp.flow.alpha = look.label * (0.65 + light * 0.35);
    }

    const rx = place.radius * (0.96 + breath * 0.025 + flare * 0.06);
    lamp.pool.visible = lit;
    if (lit) {
      lamp.pool.position.set(place.x, place.y);
      lamp.pool.width = rx * 2;
      lamp.pool.height = rx * 2 * SLANT;
      lamp.pool.alpha = Math.pow(light, 0.75) * 0.55;
      lamp.pool.tint = OVERLAY.lamp;
    }
    const weight = look.bright > 0.45 ? '600' : '500';
    if (lamp.name.style.fontWeight !== weight) lamp.name.style.fontWeight = weight;

    // Motes: each rises from somewhere inside the pool and fades, on its own clock.
    const moteLevel = reducedMotion ? 0 : look.motes;
    for (let i = 0; i < lamp.motes.length; i++) {
      const mote = lamp.motes[i]!;
      mote.visible = moteLevel > 0.02;
      if (!mote.visible) continue;
      const seed = lamp.phase * 13.1 + i * 2.39;
      const life = (time / MOTE_LIFE + i / lamp.motes.length + lamp.phase) % 1;
      const angle = seed * 2.17;
      const reach = 0.25 + 0.55 * ((seed * 0.618) % 1);
      const x = place.x + Math.cos(angle) * place.radius * reach + Math.sin(time * 0.9 + seed) * px * 6;
      const y = place.y + Math.sin(angle) * place.radius * reach * SLANT - life * px * 70;
      mote.position.set(x, y);
      const size = px * (10 + 6 * ((seed * 0.37) % 1));
      mote.width = mote.height = size;
      mote.alpha = moteLevel * Math.sin(life * Math.PI) ** 1.5 * 0.85;
    }

    // Label: constant size on screen, resting just above the pool, rising a touch as it appears.
    const shown = look.label;
    lamp.label.visible = shown > 0.01;
    if (lamp.label.visible) {
      const rise = reducedMotion ? 0 : (1 - shown) * 6;
      lamp.label.position.set(place.x, place.y - place.radius * SLANT * 0.92 - px * (8 - rise));
      lamp.label.scale.set(px);
      lamp.label.alpha = shown;
      lamp.rule.width = lamp.name.width * lerp(0.35, 0.8, shown);
      lamp.rule.alpha = 0.3 + look.bright * 0.7;
      lamp.role.alpha = look.bright > 0.3 ? 1 : 0;
    }
  }

  destroy(): void {
    for (const lamp of this.lamps.values()) this.destroyLamp(lamp);
    this.lamps.clear();
  }
}


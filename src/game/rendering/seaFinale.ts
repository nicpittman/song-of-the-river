/** A painted dawn at sea, using the game's boat, people and paper palette. */
import { ColorMatrixFilter, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { clamp, smoothstep } from '../core/math';
import { hash2 } from '../core/rng';
import type { ArtLibrary } from './art';
import { AT_THE_BAR } from '../adventure/finale';
/** The painted open sea fades in only once the boat is out past the bar, never while it is still at the landing or on the river. */
const SEA_FROM = AT_THE_BAR - 0.5;
const HORIZON = .43;
/** The painted boat takes over from the map's boat this quickly, at the same spot and size, so only one boat ever reads. */
const SWAP = .3;
/** Then it drifts from where the map's boat was to its painted place. */
const SETTLE = 3.2;

/** Where the map's boat is drawn on screen, for the hand-over: hull centre in screen pixels, and its hull's width there. */
export interface BoatHandoff { x: number; y: number; width: number }

export class SeaFinale {
  readonly root = new Container();
  private readonly background: Sprite;
  private readonly texture: Texture;
  private readonly water = new Graphics();
  private readonly birds = new Graphics();
  private readonly lighthouse: Sprite;
  private readonly lighthouseGlow = new Graphics();
  private readonly vessel = new Container();
  /** Everything but the boat: it fades in over the map while the boat swaps over at its own, quicker pace. */
  private readonly scene = new Container();
  /** How far the painted boat has taken over from the map's (0..1): the map's boat fades by the same amount. */
  swap = 0;
  private readonly group = new Container();
  private left = false;
  private passengerKey = '';
  private hullHeight = 0;

  constructor(private readonly art: ArtLibrary) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 768;
    const ctx = canvas.getContext('2d')!;
    const wash = ctx.createLinearGradient(0, 0, 0, 768);
    for (const [at, colour] of [[0, '#a5babb'], [.28, '#d9dbca'], [.425, '#f1e7c9'], [.435, '#a5c2bc'], [.65, '#7fa9a6'], [1, '#517f89']] as [number, string][]) wash.addColorStop(at, colour);
    ctx.fillStyle = wash; ctx.fillRect(0, 0, 1024, 768);
    // Fine translucent cloud strokes; the paper grain still shows through them.
    for (let i = 0; i < 16; i++) {
      const x = hash2(i, 1, 7) * 1100 - 60, y = 55 + hash2(i, 2, 7) * 230;
      ctx.fillStyle = `rgba(247,239,216,${.04 + hash2(i, 3, 7) * .05})`;
      ctx.beginPath(); ctx.ellipse(x, y, 80 + hash2(i, 4, 7) * 160, 3 + hash2(i, 5, 7) * 8, -.025, 0, Math.PI * 2); ctx.fill();
    }
    const glow = ctx.createRadialGradient(620, 307, 3, 620, 307, 130);
    glow.addColorStop(0, 'rgba(254,240,193,.48)'); glow.addColorStop(1, 'rgba(254,240,193,0)');
    ctx.fillStyle = glow; ctx.fillRect(400, 170, 440, 260);
    ctx.fillStyle = 'rgba(250,237,199,.68)'; ctx.beginPath(); ctx.arc(620, 303, 16, 0, Math.PI * 2); ctx.fill();
    // Low wooded headlands, kept to the edges so the boat has open water ahead.
    for (const [side, base, depth, colour] of [[0, 336, 33, '#91aaa2'], [1, 338, 24, '#9eb4a8'], [0, 346, 19, '#7d9d95']] as [number, number, number, string][]) {
      ctx.fillStyle = colour; ctx.beginPath();
      const start = side ? 1024 : 0, end = side ? 710 : 300;
      ctx.moveTo(start, base);
      for (let i = 0; i <= 22; i++) {
        const k = i / 22, x = start + (end - start) * k;
        const y = base - (Math.sin(k * Math.PI) * depth + hash2(i, side, depth) * 5) * (1 - k);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(end, base + 3); ctx.lineTo(start, base + 9); ctx.closePath(); ctx.fill();
    }
    // Flecks of reflected morning light, widening towards the viewer.
    for (let i = 0; i < 130; i++) {
      const k = hash2(i, 8, 11), y = 345 + k * 420;
      const x = 620 + (hash2(i, 9, 11) - .5) * (25 + k * 240);
      ctx.strokeStyle = `rgba(241,225,179,${.04 + (1 - k) * .12})`; ctx.lineWidth = .7 + k;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3 + k * 19, y); ctx.stroke();
    }
    const pixels = ctx.getImageData(0, 0, 1024, 768);
    for (let y = 0; y < 768; y++) for (let x = 0; x < 1024; x++) {
      const noise = (hash2(x, y, 29) - .5) * 5, index = (y * 1024 + x) * 4;
      for (let c = 0; c < 3; c++) pixels.data[index + c] += noise;
    }
    ctx.putImageData(pixels, 0, 0);
    this.texture = Texture.from(canvas); this.background = new Sprite(this.texture);
    this.scene.addChild(this.background, this.water, this.birds);
    this.root.addChild(this.scene, this.vessel); this.root.visible = false;
    const tower = art.get('harbour-light');
    this.lighthouse = new Sprite(tower.texture);
    this.lighthouse.anchor.set(tower.anchor[0], tower.anchor[1]);
    // Graded into the dawn haze: half its own colour, half the cool grey-green of the far headland,
    // so it sits back on the horizon like the painted hills rather than on top of them.
    const haze = new ColorMatrixFilter();
    const keep = .5, [hr, hg, hb] = [.66, .74, .71];
    haze.matrix = [keep, 0, 0, 0, hr * (1 - keep), 0, keep, 0, 0, hg * (1 - keep), 0, 0, keep, 0, hb * (1 - keep), 0, 0, 0, 1, 0];
    this.lighthouse.filters = [haze];
    this.scene.addChildAt(this.lighthouse, 1);
    this.scene.addChildAt(this.lighthouseGlow, 2);
    const a = art.get('boat'), hull = new Sprite(a.texture);
    hull.anchor.set(.5); hull.width = 110; hull.height = 110 * a.height / a.width;
    const sail = new Graphics();
    sail.moveTo(-7, 0).lineTo(-7, -64).stroke({ color: 0x785e40, width: 1.6 });
    sail.moveTo(-6, -62).quadraticCurveTo(25, -48, 23, -20).lineTo(-6, -24).fill({ color: 0xeee6cf });
    sail.moveTo(-2, -56).quadraticCurveTo(12, -43, 14, -24).stroke({ color: 0xc6bea4, width: .65 });
    // Passengers sit in front of the hull's far side, low enough that the gunwale reads in front of their laps.
    this.hullHeight = hull.height;
    this.vessel.addChild(sail, hull, this.group);
  }
  leave(): void { this.left = true; this.root.visible = false; this.swap = 0; }
  reset(): void { this.left = false; }

  update(time: number, ended: boolean, screen: { width: number; height: number }, companions: readonly string[], reduced = false, life = time, from: BoatHandoff | null = null): void {
    if (this.left || (!ended && time < SEA_FROM)) { this.root.visible = false; this.swap = 0; return; }
    if (this.passengerKey !== companions.join(',')) {
      this.passengerKey = companions.join(',');
      for (const child of this.group.removeChildren()) child.destroy();
      const n = companions.length, gap = Math.min(14, 76 / Math.max(1, n));
      companions.forEach((id, i) => {
        const a = this.art.get(`${id}-idle-0`);
        const person = new Sprite(a.texture);
        person.anchor.set(.5, 1);
        person.height = 28; person.width = 28 * a.width / a.height;
        // Standing in the hull: the near gunwale crops them at the waist (see the mask below).
        person.position.set((i - (n - 1) / 2) * gap - 4, this.hullHeight * .02 + (i % 2) * 1.2);
        this.group.addChild(person);
      });
      // Keep only what shows above the gunwale.
      const rim = new Graphics().rect(-60, -80, 120, 80 - this.hullHeight * .13).fill(0xffffff);
      this.group.addChild(rim); this.group.mask = rim;
    }
    const since = ended ? Infinity : time - SEA_FROM;
    this.root.visible = true; this.scene.alpha = clamp(since / 2.5, 0, 1);
    this.swap = from ? clamp(since / SWAP, 0, 1) : 1;
    this.vessel.alpha = this.swap;
    const w = screen.width, h = screen.height, t = clamp((time - SEA_FROM) / 6, 0, 1), motion = reduced ? 0 : life;
    this.background.width = w; this.background.height = h;
    const tower = this.art.get('harbour-light');
    this.lighthouse.height = Math.min(60, h * .085);
    this.lighthouse.width = this.lighthouse.height * tower.width / tower.height;
    this.lighthouse.position.set(w * .91, h * .443);
    // Graded into the dawn haze: cooler, lighter and softer than the foreground art.
    this.lighthouse.tint = 0xffffff; this.lighthouse.alpha = .9;
    this.lighthouseGlow.clear().circle(this.lighthouse.x, this.lighthouse.y - this.lighthouse.height * .84, 2.1 + (reduced ? 0 : Math.sin(life * 1.4) * .4)).fill({ color: 0xffdc96, alpha: .6 });
    this.water.clear(); this.birds.clear();
    for (let i = 0; i < 48; i++) {
      const depth = (i / 48) ** 1.7, y = h * (HORIZON + .025 + depth * .54);
      const x = (i * 137 + motion * (1 + i * .08) * 1.6) % (w + 150) - 75, span = 10 + depth * 80;
      this.water.moveTo(x, y).quadraticCurveTo(x + span * .45, y - 1.5, x + span, y).stroke({ color: i % 3 ? 0xd2dfd1 : 0x527e87, width: .5 + depth * .5, alpha: .10 + (i % 3) * .035 });
    }
    for (let i = 0; i < 3; i++) {
      const x = w * (.19 + i * .045) + Math.sin(motion * .06) * 12, y = h * (.29 + i * .014), wing = reduced ? 2 : 1.5 + Math.sin(motion * 1.1 + i) * 2;
      this.birds.moveTo(x - 5, y - wing).quadraticCurveTo(x - 2, y - 3, x, y).quadraticCurveTo(x + 2, y - 3, x + 5, y - wing).stroke({ color: 0x637f7d, width: .85, alpha: .5 });
    }
    let x = w * (.5 + t * .025), y = h * (.69 - t * .06), scale = (.9 - t * .4) * (w < 600 ? 1.05 : 1.35);
    if (from) {
      // Start exactly where (and as large as) the map's boat is, then ease to the painted place.
      const k = smoothstep(0, SETTLE, since - SWAP * .6);
      x = from.x + (x - from.x) * k; y = from.y + (y - from.y) * k;
      const s0 = from.width / 110; scale = s0 + (scale - s0) * k;
    }
    this.water.ellipse(x, y + 6, 37 * scale, 6 * scale).fill({ color: 0x376970, alpha: .14 });
    this.water.moveTo(x - 12 * scale, y + 14 * scale).quadraticCurveTo(x - 2, y + 24, x + 22 * scale, y + 38 * scale).stroke({ color: 0xd4e2d6, width: 1, alpha: .3 });
    // A real swell: two slow waves so the bob never looks mechanical.
    const heave = Math.sin(motion * .9) * 4.4 + Math.sin(motion * 1.7 + 1.3) * 1.6;
    const roll = Math.sin(motion * .75 + .6) * .055 + Math.sin(motion * 1.9) * .014;
    this.vessel.position.set(x, y + heave * scale); this.vessel.scale.set(scale); this.vessel.rotation = roll;
  }
  destroy(): void { this.texture.destroy(true); }
}

/**
 * How high a walker stands above the bridge's level line while crossing it.
 *
 * The walking ground for a bridge is a level band on the map, but the drawn
 * deck arches up over the water. Each illustration carries the centre line
 * of its walkway (between the rails), traced in image coordinates; laid with
 * the same placement as the sprite, it gives the lift at any point along the
 * deck, so a walker climbs the arch instead of passing under it.
 */
import type { Vec } from '../../core/math';

/** Walkway centre lines, west to east, in trimmed-image fractions. The ends sit on the deck contacts, where lift is nothing. */
export const WALKWAYS: Record<string, readonly Vec[]> = {
  'wooden-footbridge': [
    { x: 0.02, y: 0.77 }, { x: 0.11, y: 0.76 }, { x: 0.19, y: 0.74 }, { x: 0.27, y: 0.6 }, { x: 0.43, y: 0.34 },
    { x: 0.55, y: 0.29 }, { x: 0.7, y: 0.32 }, { x: 0.84, y: 0.43 }, { x: 0.94, y: 0.52 }, { x: 1.02, y: 0.56 },
  ],
  'stone-bridge': [
    { x: -0.02, y: 0.74 }, { x: 0.12, y: 0.67 }, { x: 0.23, y: 0.53 }, { x: 0.4, y: 0.35 }, { x: 0.61, y: 0.26 },
    { x: 0.8, y: 0.32 }, { x: 0.91, y: 0.47 }, { x: 0.96, y: 0.53 }, { x: 1.04, y: 0.66 },
  ],
};

export interface DeckPlacement {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  anchor: readonly [number, number];
}

interface Deck {
  /** The level line the walking band follows. */
  y: number;
  xs: number[];
  lifts: number[];
}

/** Lift fades out over this band either side of a deck's level line. */
const NEAR = 28;
const FADE = 14;

export class BridgeDecks {
  private readonly decks = new Map<string, Deck>();

  /** Lays an illustration's walkway with the sprite's own placement. */
  set(id: string, asset: string, size: { width: number; height: number }, p: DeckPlacement, level: number): void {
    const walkway = WALKWAYS[asset];
    if (!walkway) { this.decks.delete(id); return; }
    const cos = Math.cos(p.rotation), sin = Math.sin(p.rotation);
    const points = walkway.map((w) => {
      const lx = (w.x - p.anchor[0]) * size.width * p.scale;
      const ly = (w.y - p.anchor[1]) * size.height * p.scale;
      return { x: p.x + lx * cos - ly * sin, y: p.y + lx * sin + ly * cos };
    }).sort((a, b) => a.x - b.x);
    this.decks.set(id, { y: level, xs: points.map((q) => q.x), lifts: points.map((q) => Math.max(0, level - q.y)) });
  }

  delete(id: string): void {
    this.decks.delete(id);
  }

  /** World px a walker at (x, y) stands above the ground: the deck's height there, or 0 off every deck. */
  lift(x: number, y: number): number {
    for (const deck of this.decks.values()) {
      const off = Math.abs(y - deck.y);
      if (off > NEAR + FADE || x <= deck.xs[0]! || x >= deck.xs[deck.xs.length - 1]!) continue;
      let i = 1;
      while (deck.xs[i]! < x) i++;
      const t = (x - deck.xs[i - 1]!) / (deck.xs[i]! - deck.xs[i - 1]! || 1);
      const height = deck.lifts[i - 1]! + (deck.lifts[i]! - deck.lifts[i - 1]!) * t;
      return height * Math.min(1, Math.max(0, (NEAR + FADE - off) / FADE));
    }
    return 0;
  }
}

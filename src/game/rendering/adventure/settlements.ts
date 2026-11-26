/**
 * What each settlement has grown into: a new vegetable plot, a drying rack, a
 * cottage. They join the scenery as it stands (seasons, shade and wind), and
 * they arrive quietly: an addition that appears in daylight waits for the dark
 * before it grows in, so nothing pops into view while the player is watching.
 */

import type { AdventureScene } from '../../adventure/model';
import type { SceneryLayer } from '../sceneryLayer';
import type { FrameInfo } from './frame';

const LOOKS = {
  plot: { asset: 'vegetable-rows', scale: 0.9 },
  rack: { asset: 'fish-drying-rack', scale: 0.8 },
  cottage: { asset: 'cottage', scale: 0.6 },
} as const;

export class Settlements {
  /** Additions already standing, by key. */
  private readonly shown = new Set<string>();
  private started = false;

  constructor(private readonly scenery: SceneryLayer) {}

  update(scene: AdventureScene, f: FrameInfo): void {
    const settlements = scene.settlements ?? [];
    // Additions made while it is light wait for the dark; the very first scene shows what is already there.
    const dark = f.night > 0.5;
    for (const s of settlements) {
      s.additions.forEach((add, i) => {
        const key = `${s.region}:${i}:${add.kind}`;
        if (this.shown.has(key)) return;
        if (!dark && this.started) return;
        this.shown.add(key);
        const look = LOOKS[add.kind];
        this.scenery.setGroup(`settlement:${key}`, [{ asset: look.asset, x: add.at.x, y: add.at.y, scale: look.scale, flip: i % 2 === 1, roll: (i * 0.37) % 1, fixed: true }], this.started);
      });
    }
    this.started = true;
  }
}

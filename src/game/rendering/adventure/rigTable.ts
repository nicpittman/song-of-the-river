/**
 * Points of interest in every painted explorer frame, worked out once from
 * the skeleton: where the pack knot sits, where a rod tip or hammer head is,
 * where Yui's lantern hangs. Looked up by pose and frame with no allocation.
 */

import { EXPLORER_IDS, type LookId, PAINTED_LOOKS, FRAME_COUNT, type FramePose, type Pt, rigFor } from '../placeholders/explorerRig';
import { knotOf, lanternOf } from '../placeholders/explorers';

export interface FramePoints {
  /** Knot on a light pack, and on the laden bundle when carrying. */
  knot: Pt;
  /** End of the tool in use, if any. */
  tip: Pt | null;
  /** Yui's lantern, if she holds it in this frame. */
  lantern: Pt | null;
}

const POSES = Object.keys(FRAME_COUNT) as FramePose[];

function build(): Map<FramePose, FramePoints[]> {
  const table = new Map<FramePose, FramePoints[]>();
  for (const pose of POSES) {
    const frames: FramePoints[] = [];
    for (let i = 0; i < FRAME_COUNT[pose]; i++) {
      const rig = rigFor(pose, i);
      frames.push({ knot: knotOf(rig, pose === 'carry'), tip: rig.tip, lantern: lanternOf('yui', rig) });
    }
    table.set(pose, frames);
  }
  return table;
}

let table: Map<FramePose, FramePoints[]> | null = null;

export function pointsOf(pose: FramePose, frame: number): FramePoints {
  table ??= build();
  return table.get(pose)![frame]!;
}

/** The painted look an id stands for; unknown ids borrow one of the friends' looks, always the same one. */
export function explorerFor(id: string): LookId {
  if ((PAINTED_LOOKS as readonly string[]).includes(id)) return id as LookId;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return EXPLORER_IDS[h % EXPLORER_IDS.length]!;
}


/**
 * How each kind of structure looks while it goes up and when it is done.
 * Finished structures use the illustrated library where it has the right
 * thing, and a painted placeholder (`placeholders/expedition.ts`) where it
 * does not.
 */

import type { PlantingKind, StructureKind } from '../../adventure/model';

export interface StructureLook {
  /** Art for the finished structure when the library has no `<kind>` image of its own. */
  finished: string;
  scale: number;
  /** Prefix of the three painted stages it passes through (`<prefix>-0..2`). */
  stages: 'frame' | 'deck-frame' | 'garden-bed' | 'boat-ribs';
  /** Width of the worn earth round the site; 0 for none (a bridge over water). */
  skirt: number;
}

export const STRUCTURE_LOOKS: Record<Exclude<StructureKind, PlantingKind>, StructureLook> = {
  garden: { finished: 'flower-meadow', scale: 0.8, stages: 'garden-bed', skirt: 130 },
  'ford-bridge': { finished: 'wooden-footbridge', scale: 0.85, stages: 'deck-frame', skirt: 0 },
  bridge: { finished: 'wooden-footbridge', scale: 0.85, stages: 'deck-frame', skirt: 0 },
  platform: { finished: 'dock', scale: 0.72, stages: 'deck-frame', skirt: 90 },
  shelter: { finished: 'shed', scale: 0.75, stages: 'frame', skirt: 150 },
  cottage: { finished: 'cottage', scale: 0.62, stages: 'frame', skirt: 170 },
  dock: { finished: 'dock', scale: 0.8, stages: 'deck-frame', skirt: 100 },
  lookout: { finished: 'lookout', scale: 0.85, stages: 'frame', skirt: 120 },
  boat: { finished: 'boat', scale: 1.7, stages: 'boat-ribs', skirt: 140 },
  // Laid stones across a stream, and steps cut up a slope: stone pieces rather than timber frames.
  stones: { finished: 'stepping-stones', scale: 0.6, stages: 'deck-frame', skirt: 0 },
  stair: { finished: 'stepping-stones', scale: 0.5, stages: 'garden-bed', skirt: 70 },
};

const PLANTINGS: readonly string[] = ['willow', 'fruit-tree', 'lily-bed'] satisfies PlantingKind[];

/** Plantings are listed with the buildings but grow rather than being built (see `plantings.ts`). */
export function isPlanting(kind: string): boolean {
  return PLANTINGS.includes(kind);
}

/** The look for a kind, with a cottage-like default for kinds added later. */
export function lookOf(kind: string): StructureLook {
  return (STRUCTURE_LOOKS as Record<string, StructureLook | undefined>)[kind] ?? STRUCTURE_LOOKS.shelter;
}

/** Ids the sprite list documents for each kind's finished image, where it differs from the kind. */
const FINISHED_IDS: Record<string, string> = { bridge: 'footbridge', 'ford-bridge': 'footbridge' };

/**
 * Art for a finished structure: an illustrated `<kind>` image (see
 * `docs/sprites-needed.md`) when the library has one, else the look's own.
 */
export function finishedArt(kind: string, has: (id: string) => boolean): string {
  const id = FINISHED_IDS[kind] ?? kind;
  return has(id) ? id : lookOf(kind).finished;
}

/** Art for a stage: the documented `<kind>-site` / `<kind>-frame` if illustrated, else the painted family stage. */
export function stageArt(kind: string, stage: number, has: (id: string) => boolean): string {
  if (stage < 0) return has('site-pegs') ? 'site-pegs' : `${kind}-site`;
  if (has(`${kind}-frame`)) return `${kind}-frame`;
  return `${lookOf(kind).stages}-${stage}`;
}

/** Which stage a site shows at `progress`: -1 pegged out, 0..2 the painted stages, 3 finished. */
export function stageOf(progress: number): number {
  if (progress >= 1) return 3;
  if (progress < 0.08) return -1;
  if (progress < 0.42) return 0;
  if (progress < 0.78) return 1;
  return 2;
}

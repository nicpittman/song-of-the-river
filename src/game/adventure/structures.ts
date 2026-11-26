/**
 * What the friends can make: buildings placed in the valley, and the shared
 * kit of single items. Every building changes something the forecast can put
 * into words (see `odds.ts`), so the player can see what it is for.
 */

import type { Vec } from '../core/math';
import type { Equipment, PlantingKind, StructureKind } from './model';

export type Site = 'ground' | 'bank' | 'narrows';

export interface StructureDef {
  id: StructureKind;
  name: string;
  cost: number;
  /** Days of work by a friend who stays home to build. Aki works twice as fast. Small works and plantings need none: they stand once placed. */
  work: number;
  /** A story work (Aki's promise, the dock, the boat): real workdays with builders at the site. */
  major?: boolean;
  /** Grown from a find rather than built: free, placed at once, and grows over a few days. */
  planting?: boolean;
  /** Additional sites may be built after the current project is complete. */
  repeatable?: boolean;
  /** The reach it belongs to; it can be built there or farther down. */
  region: number;
  /** A find that must be in the journal first, if any. */
  requires?: string;
  site: Site;
  /** Where it must go, for works that belong to one spot (a bridge at the narrows). */
  at?: Vec;
  /** Art for the valley layer's placement ghost. */
  asset: string;
  scale: number;
  effect: string;
}

export const STRUCTURES: readonly StructureDef[] = [
  {
    id: 'garden', repeatable: true, name: 'Wildflower garden', cost: 2, work: 0, region: 0, site: 'ground', asset: 'flower-meadow', scale: 0.65,
    effect: 'Herbs by the fire and butterflies over them. There is a little more for the pot each day.',
  },
  {
    id: 'platform', repeatable: true, name: 'Fishing platform', cost: 2, work: 0, region: 0, site: 'bank', asset: 'dock', scale: 0.7,
    effect: 'Planks over moving water. Someone could fish from it till dark, high water or not.',
  },
  {
    id: 'lookout', repeatable: true, name: 'River lookout', cost: 3, work: 0, region: 0, site: 'ground', asset: 'shrine', scale: 0.55,
    effect: 'A quiet perch above the reach. New ground shows from it, and birds come close to anyone who sits still.',
  },
  {
    id: 'shelter', repeatable: true, name: 'Walkers’ shelter', cost: 3, work: 0, region: 0, site: 'ground', asset: 'shed', scale: 0.7,
    effect: 'A roof partway out, open on one side. Sleep there and set off from there. Near Furumichi, with the higher bank known, it keeps the south road open in floods.',
  },
  {
    id: 'stones', name: 'Stepping stones', cost: 2, work: 0, region: 0, site: 'narrows', at: { x: 742, y: 2532 }, asset: 'stepping-stones', scale: 0.6,
    effect: 'Flat stones across the stream below Furumichi. The road south stays open when the melt or the autumn rains bring the water up.',
  },
  {
    id: 'ford-bridge', name: 'Old Ford footbridge', cost: 3, work: 0, region: 0, requires: 'aki-meeting', site: 'narrows', at: { x: 1052, y: 432 }, asset: 'wooden-footbridge', scale: 1,
    effect: 'Keeps the Old Ford and Hanano reachable when the stones go under.',
  },
  {
    id: 'bridge', repeatable: true, major: true, name: 'River footbridge', cost: 4, work: 2, region: 0, requires: 'aki-meeting', site: 'narrows', asset: 'wooden-footbridge', scale: 1,
    effect: 'Built at a narrow crossing, it keeps both banks joined at high water. At the Mio narrows it opens the far-bank garden and the hill path.',
  },
  {
    id: 'cottage', repeatable: true, major: true, name: 'Village cottage', cost: 5, work: 2, region: 1, requires: 'aki-meeting', site: 'ground', asset: 'cottage', scale: 0.7,
    effect: 'The cottage promised to Mio. Finish it with the carpenter and he can come with us. He builds twice as fast as anyone.',
  },
  {
    id: 'dock', repeatable: true, major: true, name: 'Estuary dock', cost: 4, work: 2, region: 2, requires: 'aki-meeting', site: 'bank', asset: 'dock', scale: 1,
    effect: 'Fishing in Kawagiri goes better, and there is somewhere to bring Grandfather’s boat alongside. Someone at the landing has been waiting for one.',
  },
  {
    id: 'boat', major: true, name: 'Grandfather’s boat', cost: 5, work: 3, region: 2, requires: 'aki-meeting', site: 'bank', asset: 'boat', scale: 1,
    effect: 'Bring Aki’s grandfather’s boat down from the reeds and make her sound again. Room for every companion, provisions and one small garden.',
  },
  {
    id: 'lily-bed', repeatable: true, name: 'A bed of day lilies', cost: 0, work: 0, region: 0, requires: 'day-lilies', site: 'ground', planting: true, asset: 'wildflowers', scale: 0.6,
    effect: 'Lilies from Hanano, planted wherever you like.',
  },
  {
    id: 'willow', repeatable: true, name: 'A young willow', cost: 0, work: 0, region: 1, requires: 'willow-cutting', site: 'bank', planting: true, asset: 'willow', scale: 0.6,
    effect: 'A cutting from Yanagi, planted by the water.',
  },
  {
    id: 'fruit-tree', repeatable: true, name: 'An apple tree', cost: 0, work: 0, region: 1, requires: 'late-apples', site: 'ground', planting: true, asset: 'orchard-tree', scale: 0.6,
    effect: 'Pips from Ringozaka, planted to grow.',
  },
];

/** Days after planting when a planting is growing, and when it is grown. */
export const GROWTH_DAYS: readonly [number, number] = [2, 5];

export const PLANTINGS: readonly PlantingKind[] = ['lily-bed', 'willow', 'fruit-tree'];

export const isPlanting = (kind: StructureKind): kind is PlantingKind => (PLANTINGS as readonly string[]).includes(kind);

export interface EquipmentDef {
  id: Equipment;
  name: string;
  cost: number;
  effect: string;
}

export const EQUIPMENT: readonly EquipmentDef[] = [
  { id: 'rain-cape', name: 'Rain cape', cost: 1, effect: 'Keeps one person dry, so rain and snow don’t spoil their day.' },
  { id: 'walking-staff', name: 'Walking staff', cost: 1, effect: 'Whoever carries it goes on to the farther spot.' },
  { id: 'fishing-kit', name: 'Fishing kit', cost: 2, effect: 'Whoever fishes with it does better.' },
  { id: 'field-kit', name: 'Field kit', cost: 2, effect: 'Helps whoever forages, looks closely or follows tracks.' },
];

/** Where the Mio footbridge must go: the narrows just above the willow mill. */
export const NARROWS: Vec = { x: 1090, y: 3580 };

/** Story works take real workdays; everything else stands once placed. */
export const isMajor = (kind: StructureKind): boolean => !!STRUCTURES.find((s) => s.id === kind)?.major;

/** What the fire says when a story work is finished: everyone's small moment. */
export const FINISHED: Partial<Record<StructureKind, string>> = {
  cottage: 'The last shingle went on at dusk. The new neighbours lit the stove and stood in the doorway, not quite believing it.',
  bridge: 'Aki walked it first, then jumped on the middle plank twice. It held. Children were across before he was off it.',
  dock: 'The dock is done. Aki tests the mooring. “We can bring Grandfather’s boat down here now.”',
  boat: 'Grandfather’s boat sits on the water again, her old hull patched and oiled. Everyone climbs in once, just to see.',
};

/** A work's name inside a sentence: "the village cottage", but "Grandfather’s boat". */
export function structureLabel(name: string): string {
  return /^\p{Lu}\p{Ll}+’s /u.test(name) ? name : `the ${name.replace(/^The /, '').toLowerCase()}`;
}

export function structureDef(kind: StructureKind): StructureDef {
  return STRUCTURES.find((s) => s.id === kind)!;
}

export function equipmentDef(id: Equipment): EquipmentDef {
  return EQUIPMENT.find((e) => e.id === id)!;
}

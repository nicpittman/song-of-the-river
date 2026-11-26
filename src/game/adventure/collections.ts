/**
 * The journal's small collections: a few entries that belong together. They
 * fill as the friends find things, and a finished one changes something in
 * the valley, quietly: the kingfisher starts perching at the mill, a keeper
 * appears sweeping the shrine steps. Nothing announces it; none is required.
 */

import type { Vec } from '../core/math';
import type { JournalSet } from './model';
import type { AdventureState } from './state';

export type SetConsequence =
  /** A creature that now lives at a spot and can be seen there any day. */
  | { kind: 'creature'; species: string; at: Vec }
  /** One of the valley's people, now going about their day at a spot. */
  | { kind: 'villager'; look: string; at: Vec };

export interface SetDef {
  id: string;
  name: string;
  region: number;
  finds: string[];
  consequence: SetConsequence;
  /** Said in faded ink before the page is full: what filling it might bring, and where. */
  reward: string;
  /** Said once it is full: what came. */
  came: string;
}

export const SETS: readonly SetDef[] = [
  {
    id: 'river-birds', name: 'Birds of the river', region: 0,
    finds: ['dipper', 'kingfisher', 'heron', 'plover'],
    consequence: { kind: 'creature', species: 'kingfisher', at: { x: 700, y: 1810 } },
    reward: 'Fill this page, and a kingfisher may come to perch by Suisha Mill.',
    came: 'A kingfisher perches by Suisha Mill now.',
  },
  {
    id: 'mountain-water', name: 'The mountain water', region: 0,
    finds: ['spray-rainbow', 'tarn-twice', 'char', 'newt'],
    consequence: { kind: 'creature', species: 'dipper', at: { x: 1060, y: 250 } },
    reward: 'Fill this page, and a dipper may come back to the stream below Taki.',
    came: 'A dipper bobs on the stones below Taki again.',
  },
  {
    id: 'woods', name: 'The two woods', region: 0,
    finds: ['star-moss', 'deer-clearing', 'woodpecker', 'badger-sett', 'shed-antler'],
    consequence: { kind: 'creature', species: 'deer-crossing', at: { x: 240, y: 1660 } },
    reward: 'Fill this page, and deer may cross the clearing near Umezono.',
    came: 'Deer cross the clearing near Umezono now.',
  },
  {
    id: 'before-us', name: 'Those who came before', region: 0,
    finds: ['carved-steps', 'waymark', 'hut-book', 'sea-wish'],
    consequence: { kind: 'villager', look: 'villager-d', at: { x: 1300, y: 1470 } },
    reward: 'Fill this page, and someone may come to pray at Ukishima Shrine.',
    came: 'Someone comes to pray at Ukishima Shrine now.',
  },
  {
    id: 'orchard-year', name: 'The orchard year', region: 1,
    finds: ['orchard-blossom', 'late-apples', 'orchard-keeper', 'chestnuts'],
    consequence: { kind: 'creature', species: 'white-eye', at: { x: 420, y: 2800 } },
    reward: 'Fill this page, and white-eyes may stay among the Ringozaka trees.',
    came: 'White-eyes stay among the Ringozaka trees now.',
  },
  {
    id: 'willow-water', name: 'Willow and water', region: 1,
    finds: ['willow-cutting', 'eel', 'egret', 'otter-slide'],
    consequence: { kind: 'creature', species: 'egret', at: { x: 760, y: 3650 } },
    reward: 'Fill this page, and an egret may come back to the willows at Yanagi.',
    came: 'An egret fishes under the willows at Yanagi now.',
  },
  {
    id: 'far-bank', name: 'Across the narrows', region: 1,
    finds: ['buckwheat', 'farm-cat', 'old-roses', 'seed-packet'],
    // A farmhand comes to work the east farm's fields.
    consequence: { kind: 'villager', look: 'villager-e', at: { x: 1905, y: 3345 } },
    reward: 'Fill this page, and someone may come to work the fields at Higashida.',
    came: 'Someone works the fields at Higashida now.',
  },
  {
    id: 'rock-pools', name: 'The rock pools', region: 2,
    finds: ['starfish', 'shore-crab', 'pool-memory', 'oystercatcher'],
    // Oystercatchers keep to the Iso rocks.
    consequence: { kind: 'creature', species: 'oystercatcher', at: { x: 150, y: 5965 } },
    reward: 'Fill this page, and oystercatchers may keep to the rocks at Iso.',
    came: 'Oystercatchers keep to the rocks at Iso now.',
  },
  {
    id: 'shells', name: 'Shells of Shirahama', region: 2,
    finds: ['cherry-shells', 'moon-shell', 'sea-glass', 'cowrie'],
    consequence: { kind: 'creature', species: 'sanderlings', at: { x: 440, y: 6010 } },
    reward: 'Fill this page, and sanderlings may run the sand at Shirahama.',
    came: 'Sanderlings run the sand at Shirahama now.',
  },
  {
    id: 'sea-gifts', name: 'What the sea brings', region: 2,
    finds: ['driftwood', 'kelp', 'net-float', 'first-sea'],
    consequence: { kind: 'villager', look: 'villager-b', at: { x: 520, y: 5990 } },
    reward: 'Fill this page, and someone may come to watch the strand at Shirahama.',
    came: 'Someone watches the strand at Shirahama now.',
  },
];

export const setOf = (find: string): SetDef | undefined => SETS.find((s) => s.finds.includes(find));

export function isSetComplete(set: SetDef, state: AdventureState): boolean {
  return set.finds.every((id) => !!state.discoveries[id]);
}

export function setViews(state: AdventureState): JournalSet[] {
  return SETS.map((set) => {
    const found = set.finds.filter((id) => !!state.discoveries[id]).length;
    return { id: set.id, name: set.name, sketch: set.finds[0]!, found, total: set.finds.length, complete: found === set.finds.length, reward: set.reward, came: set.came };
  });
}

export const completeSets = (state: AdventureState): SetDef[] => SETS.filter((set) => isSetComplete(set, state));

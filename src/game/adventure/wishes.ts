/**
 * Wishes: each companion quietly wants one small thing built. They say it
 * once by the fire, after they have settled in; nothing tracks it as a task.
 * When a finished building of that kind stands in the reach where they live,
 * the fire gives them a second small story: a find of their own (only ever
 * found this way), a memory, and a different word as they board for the sea.
 *
 * Wishes gate nothing. See docs/companion-wishes-2026-11-18.md.
 */

import { findDef } from './content';
import type { StructureKind, UnpackItem } from './model';
import { nameOf } from './people';
import type { AdventureState, Building, UnpackEffect } from './state';
import { homeRegion, readyBuildings, type World } from './world';
import { dist } from '../core/math';
import { COAST_MOUTH } from '../world/boards/kawagiriSites';

export interface WishDef {
  person: string;
  structure: StructureKind;
  /** The journal entry the wish brings: a find with no place, never rolled for. */
  find: string;
  /** Said once by the fire, in their voice. */
  said: string;
  /** The People page, once said and once granted. */
  wants: string;
  has: string;
  /** Their word on stepping aboard, once granted. */
  aboard: string;
  /** Places heard of from it, if it shows the way ahead. */
  hears?: string[];
}

export const WISHES: readonly WishDef[] = [
  {
    person: 'ren', structure: 'platform', find: 'dusk-iwana',
    said: '“Three planks over moving water, that’s all. I’d fish off them till the light went.”',
    wants: 'Would like a fishing platform: three planks over moving water.',
    has: 'Fishes from the platform at dusk.',
    aboard: '“Fished off my own planks at dusk. Now a whole boat. Moving up in the world.”',
  },
  {
    person: 'mina', structure: 'garden', find: 'herb-bed',
    said: '“A little bed of herbs near the fire. Somewhere to put the seeds before the bag splits.”',
    wants: 'Would like a garden near the fire, for her seeds.',
    has: 'Keeps a herb bed in the garden.',
    aboard: '“The herbs will manage without me. I left them instructions.”',
  },
  {
    person: 'haru', structure: 'lookout', find: 'sea-eagle', hears: ['todai', 'shirahama'],
    said: '“Somewhere high and quiet. Birds stop minding you if you sit still long enough.”',
    wants: 'Would like a lookout: somewhere high and quiet to sit.',
    has: 'Sits up at the lookout, counting birds.',
    aboard: '“I saw it from the lookout first. Now I get to go and check.”',
  },
  {
    person: 'yui', structure: 'shelter', find: 'tide-night',
    said: '“A roof by the landing, open on the sea side. I’d like to hear the tide come in from bed.”',
    wants: 'Would like a shelter by the water, to hear the tide from bed.',
    has: 'Has slept under the shelter with the tide coming in.',
    aboard: '“One night with the tide under the floor. I want more of those.”',
  },
];

export const wishOf = (person: string): WishDef | undefined => WISHES.find((w) => w.person === person);
export const wishesFor = (kind: StructureKind): WishDef[] => WISHES.filter((w) => w.structure === kind);
export const WISH_FINDS: ReadonlySet<string> = new Set(WISHES.map((w) => w.find));

/** A finished building of the wished-for kind where they live now. */
export function wishBuilding(state: AdventureState, wish: WishDef): Building | undefined {
  const region = wish.person === 'haru' && !state.people.some(p => p.id === 'haru') ? 2 : homeRegion(state, wish.person);
  return readyBuildings(state).find((b) => b.kind === wish.structure && b.region === region &&
    (wish.person !== 'yui' || b.region === 2 && dist(b, COAST_MOUTH) <= 700));
}

/** How a wish reads on the People page and in the build list: unsaid, wanted, or granted. */
export function wishStatus(state: AdventureState, person: string): 'unsaid' | 'wanted' | 'granted' | null {
  const wish = wishOf(person);
  if (!wish || !state.people.some((p) => p.id === person) && !(person === 'haru' && state.discoveries['haru-meeting'])) return null;
  if (state.discoveries[wish.find]) return 'granted';
  return person === 'haru' && state.discoveries['haru-meeting'] || state.people.find((p) => p.id === person)?.wish ? 'wanted' : 'unsaid';
}

/** Their word on boarding: the wish's line once granted, otherwise their own. */
export function aboardLine(state: AdventureState, person: string, usual: string): string {
  const wish = wishOf(person);
  return wish && state.discoveries[wish.find] ? wish.aboard : usual;
}

/** Wishes granted so far, in the order they were granted. */
export function grantedWishes(state: AdventureState): WishDef[] {
  return WISHES.filter((w) => state.discoveries[w.find]).sort((a, b) => state.discoveries[a.find]!.day - state.discoveries[b.find]!.day);
}

type Add = (item: Omit<UnpackItem, 'id'>, effect: Omit<UnpackEffect, 'person'>) => void;
const NONE = { provisions: 0, materials: 0, find: null, lead: null } as const;

/**
 * By the fire, for the people already in the group before tonight: every
 * wish now standing is granted (as that person's find), and otherwise one
 * unsaid wish is said. Story beats still unpack after these.
 */
export function wishItems(w: World, add: Add, arrived = false): void {
  const s = w.state;
  // An arrival evening belongs to the new reach; wishes wait for a quieter night.
  if (s.voyage !== 'preparing' || arrived) return;
  let spoken = false;
  for (const wish of WISHES) {
    const person = s.people.find((p) => p.id === wish.person);
    if (!person && wish.person === 'haru' && s.region === 2 && s.discoveries['haru-meeting'] && !s.discoveries[wish.find] && wishBuilding(s, wish)) {
      const find = findDef(wish.find);
      const traveller = s.people.find(p => p.base === 2)?.id ?? 'sora';
      add({ person: traveller, kind: 'find', hint: 'rare', title: find.name, text: find.text, sketch: find.id, provisions: 0, materials: 0 }, { ...NONE, find: find.id });
      for (const id of wish.hears ?? []) if (!s.known.includes(id) && !s.rumoured.includes(id)) s.rumoured.push(id);
      continue;
    }
    if (!person || s.discoveries[wish.find]) continue;
    if (wishBuilding(s, wish)) {
      const find = findDef(wish.find);
      add({ person: wish.person, kind: 'find', hint: 'rare', title: find.name, text: grantText(s, wish), sketch: find.id, provisions: 0, materials: 0 }, { ...NONE, find: find.id });
      for (const id of wish.hears ?? []) if (!s.known.includes(id) && !s.rumoured.includes(id)) s.rumoured.push(id);
      person.wish ??= s.day;
      continue;
    }
    if (person.wish || spoken) continue;
    spoken = true;
    person.wish = s.day;
    add({ person: wish.person, kind: 'nothing', hint: 'plain', title: `${nameOf(wish.person)}, by the fire`, text: wish.said, sketch: null, provisions: 0, materials: 0 }, NONE);
  }
}

function grantText(s: AdventureState, wish: WishDef): string {
  if (wish.person !== 'yui') return findDef(wish.find).text;
  const yui = s.people.find(p => p.id === 'yui');
  const partnerId = ['haru', 'ren', 'mina', 'aki', 'sora'].find(id => s.people.some(p => p.id === id && p.base === yui?.base && p.lodging === yui?.lodging));
  if (!partnerId) return 'Yui sat under the new roof long after the fire, writing the first lines of a story while the tide came in below.';
  const partner = nameOf(partnerId);
  return `Yui and ${partner} sat up under the new roof long after the fire. Yui told the one about the first boat; ${partner} told it back wrong, on purpose. They listened to the tide coming in below.`;
}

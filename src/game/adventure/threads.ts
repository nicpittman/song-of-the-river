/**
 * Threads: a few friends share a running joke or doubt across the Journey,
 * a beat at a time. Each beat is an exchange in `crossingLines.ts` marked with
 * its thread and place in it. It is said when the two cross paths on a day
 * out, or else by the fire, and only after the beat before it was said on an
 * earlier day. Said beats stay in `heard` for good, so a thread never runs
 * backwards or repeats. Each thread pays off once: Ren's word aboard, a note
 * under the ending, or (for Aki and Yui) its own last beat.
 *
 * Journey only: Wander has its own friends and no story to run through.
 */

import { EXCHANGES, type Exchange } from './crossingLines';
import { fitsStory } from './narrative';
import { nameOf } from './people';
import type { AdventureState } from './state';
import type { UnpackItem } from './model';
import type { UnpackEffect } from './state';

/** Most urgent first: Yui joins late, so her thread with Aki gets the fire when two are due. */
export const THREADS = ['yuis-stories', 'fish-or-plants', 'falling-in'] as const;
export type ThreadId = typeof THREADS[number];

/** A thread's beats, in order. */
export const beatsOf = (thread: string): Exchange[] =>
  EXCHANGES.filter((e) => e.thread?.id === thread).sort((a, b) => a.thread!.beat - b.thread!.beat);

const THREAD_BEATS: ReadonlySet<string> = new Set(EXCHANGES.filter((e) => e.thread).map((e) => e.id));
export const isThreadBeat = (id: string): boolean => THREAD_BEATS.has(id);

/** `heard` kept to its last `kept` ordinary exchanges, with every thread beat ever said kept too. */
export function keepHeard(heard: readonly string[], kept: number): string[] {
  const ordinary = heard.filter((id) => !isThreadBeat(id)).slice(-kept);
  const beats = [...new Set(heard.filter(isThreadBeat))];
  return [...beats, ...ordinary];
}

/**
 * Whether this beat is the next one due: not said yet, and every beat before
 * it already heard. On the road `heard` is the record as the day began; by the
 * fire, beats said on the road today are kept out (see `threadItems`), so a
 * beat always follows the one before it on a later day. `tonight` is what is
 * being set down by the fire this evening, counted as found.
 */
export function beatDue(state: AdventureState, ex: Exchange, tonight: ReadonlySet<string> = new Set()): boolean {
  if (!ex.thread || state.free) return false;
  if (state.heard.includes(ex.id)) return false;
  if (ex.needs && !ex.needs.every((id) => state.discoveries[id] || tonight.has(id))) return false;
  const before = beatsOf(ex.thread.id).filter((b) => b.thread!.beat < ex.thread!.beat);
  return before.every((b) => state.heard.includes(b.id));
}

/** Every beat of a thread has been said. */
export const threadDone = (state: AdventureState, thread: ThreadId): boolean =>
  !state.free && beatsOf(thread).every((b) => state.heard.includes(b.id));

/** "Ren: “Not yet.” Sora: …", for the fire. */
export function beatText(ex: Exchange): string {
  const [a, b] = [ex.a![0]!, ex.b![0]!];
  return ex.lines.map(([who, text]) => `${nameOf(who === 'a' ? a : b)}: ${text}`).join(' ');
}

type Add = (item: Omit<UnpackItem, 'id'>, effect: Omit<UnpackEffect, 'person'>) => void;
const NONE = { provisions: 0, materials: 0, find: null, lead: null } as const;

/**
 * By the fire: at most one beat an evening, from the first thread with one
 * due. Never from a thread that had a beat on the road today (`talked`), never
 * on an arrival evening (which belongs to the new reach) or once the voyage is
 * under way, and only a thread's last beat on an evening a friend has just
 * said their wish (`quiet`). Yui sits in once she has been met, before she
 * joins: her stories are told at whichever fire is nearest. A last beat is a
 * story beat, and unpacks last, after whatever it is about.
 */
export function threadItems(state: AdventureState, add: Add, options: { arrived?: boolean; talked?: readonly string[]; quiet?: boolean; tonight?: ReadonlySet<string> } = {}): void {
  if (state.free || state.voyage !== 'preparing' || options.arrived) return;
  const present = (id: string): boolean => state.people.some((p) => p.id === id) || (id === 'yui' && !!state.discoveries['yui-meeting']);
  for (const thread of THREADS) {
    const beats = beatsOf(thread);
    if (beats.some((b) => options.talked?.includes(b.id))) continue;
    const beat = beats.find((ex) => beatDue(state, ex, options.tonight));
    if (!beat) continue;
    const last = beat === beats[beats.length - 1];
    if (options.quiet && !last) continue;
    const [a, b] = [beat.a![0]!, beat.b![0]!];
    if (![a, b].every(present)) continue;
    if (beat.regions && !beat.regions.includes(state.region)) continue;
    if (!beat.lines.every(([, text]) => fitsStory(text, state, state.region))) continue;
    state.heard = [...state.heard, beat.id];
    add({ person: a, kind: 'nothing', hint: last ? 'story' : 'plain', title: `${nameOf(a)} and ${nameOf(b)}, at supper`, text: beatText(beat), sketch: null, provisions: 0, materials: 0 }, NONE);
    return;
  }
}

/** Ren's word aboard, once he and Mina have argued it all the way down to the seaweed. */
export const REN_CONCEDES = '“Mina packed seaweed for the voyage. A plant, from the sea. Fine. It counts.”';
/** Under the ending, once Ren has been waiting all the way down. */
export const STILL_TIME = 'Sora never did fall in the river. Ren says there is still time.';

/** A thread's payoff as a friend steps aboard, if they have one; otherwise null. */
export function threadAboard(state: AdventureState, person: string): string | null {
  if (person === 'ren' && threadDone(state, 'fish-or-plants')) return REN_CONCEDES;
  return null;
}

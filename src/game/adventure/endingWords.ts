import { courseLine } from './course';
import { grantedWishes } from './wishes';
import { nameOf } from './people';
import type { AdventureState } from './state';
import { STILL_TIME, threadDone } from './threads';

/** Under every Journey's ending: Mio hears, and the old carpenter's lantern is lit at last (see Toroya Inn). */
export const LANTERN_LIT = 'Word went back up the river. At Toroya Inn in Mio, they lit the old carpenter’s lantern by the door.';
/** The same voyage, remembered through what this group chose to carry. */
export function endingWords(state: AdventureState): string {
  const [first] = state.companions;
  if (first && state.companions.length === 1) return `${nameOf(first)} turns to a clean page. Beyond the harbour light, the sea goes on.`;
  // Two or more small works built for friends: the valley keeps them.
  const granted = grantedWishes(state).filter((w) => state.companions.includes(w.person));
  if (granted.length >= 2) return `Behind us, ${listOf(granted.map((w) => LEFT_BEHIND[w.person]!))} carry on without us. Ahead, the first empty page.`;
  const plants = ['wild-mint', 'star-moss', 'salt-flower', 'kelp'].filter((id) => state.discoveries[id]).length;
  if (state.companions.includes('mina') && plants >= 2) return 'A little garden rides beside the mast. Mina saves a space for whatever grows on the next shore.';
  if (state.companions.includes('yui')) return 'Yui turns to a clean page. “And then?” she asks. Ahead, there is no far bank in sight.';
  return 'The mountains slip out of sight. The companions make room by the mast, and the first empty page waits.';
}

const LEFT_BEHIND: Record<string, string> = {
  ren: 'Ren’s platform', mina: 'Mina’s herbs', haru: 'Haru’s lookout', yui: 'Yui’s shelter',
};
const listOf = (names: string[]): string => names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/**
 * A few last lines under the ending, each only when this journey earned it:
 * the hut book's empty line, the friend who stayed with her pines, the
 * lantern lit for Grandfather's boat, Ren still waiting for Sora to fall in,
 * and the year's course, so a second year on the river reads as a different one.
 */
export function endingNotes(state: AdventureState): string[] {
  const notes: string[] = [];
  if (state.discoveries['hut-book']) notes.push('In the hut book at Yamagoya, under the old faded GOING TO THE SEA, there is room for one more line.');
  if (!state.free) notes.push(LANTERN_LIT);
  if (threadDone(state, 'falling-in')) notes.push(STILL_TIME);
  if (!state.free) notes.push(courseLine(state.course));
  return notes;
}

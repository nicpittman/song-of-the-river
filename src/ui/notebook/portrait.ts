/**
 * A friend's face for the notebook: the painted portrait crop from the sketch
 * library, in its own soft round frame. Kept as one small function so every
 * token, card and page asks for a face the same way.
 */

import { portrait } from '../sketches';

/** Markup for a friend's portrait at `size` px. */
export function portraitMarkup(friendId: string, size: number): string {
  return portrait(friendId, { size });
}

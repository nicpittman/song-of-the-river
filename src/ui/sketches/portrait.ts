/**
 * The friends' illustrated portraits: a head-and-shoulders crop of each
 * friend's own painted sprite (built by `scripts/build-portraits.mjs` into
 * `public/art/portraits/<id>.webp`), set in a soft round frame tinted with a
 * pale wash of their garment colour.
 *
 * Wherever a friend is shown as a person (the main menu, the notebook's
 * friend tokens, the bottom bar) this is the face to use; the ink sketches
 * (`sketch('friend-<id>')`) stay for small marks and as the fallback for a
 * friend with no portrait yet.
 */

import { PEOPLE } from '../../game/adventure/content';
import { render } from './pen';
import { FRIENDS } from './friends';

export interface PortraitOptions {
  /** Diameter in CSS pixels. Default 48. The crops are 128 px, sharp up to 64 px on a 2x screen. */
  size?: number;
}

/** Friends with a painted portrait crop. */
const PAINTED = new Set(['sora', 'ren', 'mina', 'aki', 'yui', 'haru']);

const COLOUR = new Map(PEOPLE.map((p) => [p.id, p.colour]));

/** The served path of a portrait; relative, like the rest of the art, so the game works from a subfolder. */
const portraitUrl = (id: string): string => `${import.meta.env.BASE_URL ?? './'}art/portraits/${id}.webp`;

/**
 * Markup for a friend's portrait, `size` px across. Accepts the friend's id
 * (`'ren'`) or their sketch id (`'friend-ren'`). An unknown friend gets their
 * ink sketch in the same frame, so a new friend is never a blank.
 */
export function portrait(id: string, options: PortraitOptions = {}): string {
  const friend = id.replace(/^friend-/, '');
  const size = options.size ?? 48;
  const colour = COLOUR.get(friend) ?? '#8b968b';
  const style = `--portrait-size:${size}px;--portrait-tint:${colour}`;
  const name = PEOPLE.find((p) => p.id === friend)?.name ?? friend;
  if (PAINTED.has(friend)) {
    return (
      `<span class="portrait" data-friend="${friend}" style="${style}" role="img" aria-label="${name}">` +
      `<img src="${portraitUrl(friend)}" alt="" width="${size}" height="${size}" decoding="async" draggable="false">` +
      '</span>'
    );
  }
  const drawing = FRIENDS[`friend-${friend}`] ?? FRIENDS['friend-sora'];
  return `<span class="portrait is-sketch" data-friend="${friend}" style="${style}" role="img" aria-label="${name}">${render(`friend-${friend}`, drawing, { found: true, size: Math.round(size * 0.86) })}</span>`;
}

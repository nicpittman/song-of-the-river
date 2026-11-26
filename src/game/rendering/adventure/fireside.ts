/**
 * Unpacking at the fire, in the valley, before the book opens.
 *
 * After dusk everyone sits by the fire; the camera eases once to frame it.
 * Then the day's bundles are set down one at a time, in the evening's own
 * order (plain, unusual, rare, story last), each as a paper tag over the
 * person who brought it. When the last has had its moment, the line about
 * tomorrow settles low over the fire, and then the notebook opens on the
 * evening page. Each note gets time for its own words; E skips straight to the book.
 *
 * This is only the timeline. It runs on game time (so pausing pauses it) and
 * says what should happen next; the session carries it out. The rules keep
 * their own rhythm as a fallback, but this one is always ahead of it.
 */

/** Seconds of game time. */
export const FIRESIDE = {
  /** Sitting down and the camera settling, before the first bundle. */
  gather: 1,
  /** Between one bundle and the next. Also the beat the last one keeps before the lead. */
  step: 1.9,
  /** How long the lead holds over the fire before the book opens. */
  lead: 3,
} as const;

/** The id of the screen tag that carries the line about tomorrow. */
export const LEAD_TAG = 'evening-lead';

export type FiresideStep = 'rise' | 'settle' | 'open' | null;

export class FiresideUnpack {
  private t = 0;
  private leadAt: number | null = null;
  /** When the last bundle with a tag of its own was set down; the one before, to undo a quiet one. */
  private lastRise: number | null = null;
  private beforeRise: number | null = null;
  private holdSeconds: number = FIRESIDE.step;
  /** True once the book may open: the sequence ran out, or was skipped. */
  done = false;

  /**
   * Advances the timeline. `shown`/`total` are the evening's bundles set down
   * so far and in all; `settled` is true once the line about tomorrow is known.
   * Returns what the session should do now: set down the next bundle, settle an
   * evening with nothing to unpack, open the book, or nothing.
   */
  step(dt: number, shown: number, total: number, settled: boolean): FiresideStep {
    if (this.done) return null;
    this.t += dt;
    if (shown < total) {
      if (this.t < (this.lastRise === null ? FIRESIDE.gather : this.lastRise + this.holdSeconds)) return null;
      this.beforeRise = this.lastRise;
      this.lastRise = this.t;
      return 'rise';
    }
    if (!settled) return this.t >= FIRESIDE.gather ? 'settle' : null;
    // The last bundle keeps one beat of its own before the lead settles.
    this.leadAt ??= Math.max(this.t, this.lastRise === null ? FIRESIDE.gather : this.lastRise + this.holdSeconds);
    if (this.t >= this.leadAt + FIRESIDE.lead) {
      this.done = true;
      return 'open';
    }
    return null;
  }

  /** The bundle just set down shows no tag (see `isQuiet`): it takes no time, and the next comes at once. */
  quiet(): void {
    this.lastRise = this.beforeRise;
  }

  /** A longer spoken line gets more room than a bare title or resource tally. */
  hold(item: { title: string; text: string; outcome?: string; kind: string }): void {
    const line = item.kind === 'supplies' || item.kind === 'materials' ? '' : shortLine(item) ?? '';
    const words = `${item.title} ${line}`.trim().split(/\s+/).length;
    this.holdSeconds = Math.max(FIRESIDE.step, Math.min(4.8, 0.9 + words / 4.2));
  }

  /** The lead line is over the fire now. */
  get leadShowing(): boolean {
    return !this.done && this.leadAt !== null && this.t >= this.leadAt;
  }

  /**
   * E, a tap or a click: on to the next bundle now, as a reader turns to the
   * next line; with everything set down, on to the lead; with the lead over
   * the fire, the book. Returns true once that last tap opens the book.
   */
  next(): boolean {
    if (this.done) return true;
    if (this.leadAt !== null) { this.done = true; return true; }
    this.t = Math.max(this.t, this.lastRise === null ? FIRESIDE.gather : this.lastRise + this.holdSeconds);
    return false;
  }

  /** "Skip to journal": straight to the book. */
  skip(): void {
    this.done = true;
  }
}

/** The barest kinds of bundle: no words, or words another bundle (or the lead) already says. */
export interface QuietCheck { kind: string; text: string; title: string }
export function isQuiet(item: QuietCheck, all: readonly QuietCheck[], tomorrow = ''): boolean {
  if (item.kind !== 'nothing') return false;
  const text = item.text.trim();
  if (!text) return true;
  return text === tomorrow.trim() || all.some((other) => other !== item && other.text.trim() === text);
}

/** One short line for a tag in the valley: the outcome, else the first sentence if it is short. Full words belong in the book. */
export function shortLine(item: { text: string; outcome?: string }, max = 80): string | null {
  if (item.outcome) return item.outcome;
  const text = item.text.trim();
  if (!text) return null;
  let first = /^.+?[.!?…](?:[”’"])?(?=\s|$)/.exec(text)?.[0] ?? text;
  // The first sentence of a longer quotation still closes its quote.
  if (first.startsWith('“') && !first.includes('”')) first += '”';
  return first.length <= max ? first : null;
}

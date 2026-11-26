/**
 * SampleBank: fetches the sound files in the background and decodes them when
 * they are wanted.
 *
 * - Fetching needs no AudioContext, so it can begin as soon as the title is up,
 *   before the player's first tap. It runs a few files at a time, in the order
 *   given, so it never competes hard with anything else loading.
 * - Decoding needs the context. Short effects are decoded as soon as both the
 *   bytes and the context exist. Beds are large once decoded (a 22 s stereo
 *   loop is about 8 MB of PCM), so they are decoded only when first needed and
 *   may be released again; their compressed bytes are kept.
 * - Every failure is quiet: a missing file just means `get()` keeps returning
 *   null and the caller uses its synthesised fallback.
 */

const MAX_PARALLEL_FETCHES = 3;

type Entry = {
  bytes: ArrayBuffer | null;
  buffer: AudioBuffer | null;
  state: 'queued' | 'fetching' | 'fetched' | 'decoding' | 'ready' | 'failed';
  /** Decode as soon as the bytes and the context are both available. */
  eager: boolean;
  waiters: Array<(buffer: AudioBuffer) => void>;
};

export class SampleBank {
  private readonly entries = new Map<string, Entry>();
  private readonly queue: string[] = [];
  private active = 0;
  private ctx: BaseAudioContext | null = null;
  private loggedFailure = false;

  constructor(private readonly base: string) {}

  /**
   * Queue files for fetching, in order. `eager` files are decoded as soon as
   * possible; the rest wait for `request()`. Calling again with known files does
   * nothing, so it is safe to call from several places.
   */
  prefetch(files: readonly string[], eager: (file: string) => boolean): void {
    for (const file of files) {
      if (this.entries.has(file)) continue;
      this.entries.set(file, { bytes: null, buffer: null, state: 'queued', eager: eager(file), waiters: [] });
      this.queue.push(file);
    }
    this.pump();
  }

  /** Give the bank its context: eager files that are already fetched decode now. */
  attach(ctx: BaseAudioContext): void {
    if (this.ctx) return;
    this.ctx = ctx;
    for (const [file, entry] of this.entries) {
      if (entry.eager && entry.state === 'fetched') this.decode(file, entry);
    }
  }

  /** The decoded buffer, or null if it is not ready (yet). Never blocks. */
  get(file: string): AudioBuffer | null {
    return this.entries.get(file)?.buffer ?? null;
  }

  /**
   * Ask for a buffer that may not be decoded yet. `ready` runs once it is (at
   * once if it already is); it never runs if the file fails. A file nobody has
   * queued yet jumps to the front of the fetch queue. Returns false only when
   * the file has already failed, so the caller can stop asking.
   */
  request(file: string, ready: (buffer: AudioBuffer) => void): boolean {
    let entry = this.entries.get(file);
    if (!entry) {
      entry = { bytes: null, buffer: null, state: 'queued', eager: true, waiters: [] };
      this.entries.set(file, entry);
      this.queue.unshift(file);
      this.pump();
    }
    if (entry.state === 'failed') return false;
    if (entry.buffer) {
      ready(entry.buffer);
      return true;
    }
    entry.waiters.push(ready);
    entry.eager = true;
    if (entry.state === 'fetched') this.decode(file, entry);
    return true;
  }

  /** Drop a decoded buffer to save memory; the compressed bytes stay, so it can be decoded again. */
  release(file: string): void {
    const entry = this.entries.get(file);
    if (!entry || entry.state !== 'ready' || !entry.bytes) return;
    entry.buffer = null;
    entry.eager = false;
    entry.state = 'fetched';
  }

  private pump(): void {
    while (this.active < MAX_PARALLEL_FETCHES && this.queue.length > 0) {
      const file = this.queue.shift()!;
      const entry = this.entries.get(file)!;
      this.active++;
      entry.state = 'fetching';
      void this.fetchOne(file, entry).finally(() => {
        this.active--;
        this.pump();
      });
    }
  }

  private async fetchOne(file: string, entry: Entry): Promise<void> {
    try {
      const response = await fetch(this.base + file);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      entry.bytes = await response.arrayBuffer();
      entry.state = 'fetched';
      if (entry.eager && this.ctx) this.decode(file, entry);
    } catch (error) {
      this.fail(file, entry, error);
    }
  }

  private decode(file: string, entry: Entry): void {
    const ctx = this.ctx;
    if (!ctx || !entry.bytes) return;
    entry.state = 'decoding';
    // decodeAudioData detaches the buffer it is given; keep the original for later re-decodes.
    const copy = entry.bytes.slice(0);
    ctx.decodeAudioData(copy).then(
      (buffer) => {
        entry.buffer = buffer;
        entry.state = 'ready';
        const waiters = entry.waiters.splice(0);
        for (const ready of waiters) ready(buffer);
      },
      (error: unknown) => this.fail(file, entry, error),
    );
  }

  private fail(file: string, entry: Entry, error: unknown): void {
    entry.state = 'failed';
    entry.waiters.length = 0;
    entry.bytes = null;
    if (!this.loggedFailure) {
      this.loggedFailure = true;
      console.info(`[audio] Sound ${this.base}${file} unavailable (${String(error)}); using synthesised sound instead.`);
    }
  }
}

import { describe, expect, it } from 'vitest';
import { BEDS, CUE_SOUNDS, SPOTS, allSfxFiles } from './sfxManifest';

/**
 * The few `node:fs` calls these tests need. The project does not carry Node's
 * type definitions (the game runs in the browser), so they are typed here and
 * the module is loaded by a name the type checker does not try to resolve.
 */
interface NodeFs {
  readFileSync(path: URL): Uint8Array;
  readdirSync(path: URL): string[];
  statSync(path: URL): { size: number; isDirectory(): boolean };
  existsSync(path: URL): boolean;
}
const NODE_FS = 'node:fs';
const fs = (await import(/* @vite-ignore */ NODE_FS)) as NodeFs;

const ROOT = new URL('../../../', import.meta.url);
const SFX_DIR = new URL('public/audio/sfx/', ROOT);
const text = (url: URL): string => new TextDecoder().decode(fs.readFileSync(url));

/** Largest single file we allow; the longest bed is about 225 KB. */
const MAX_FILE_BYTES = 320 * 1024;
/** The whole folder must stay small enough to fetch in the background on a slow connection. */
const MAX_TOTAL_BYTES = 3 * 1024 * 1024;

/** Every file under public/audio/sfx, as paths relative to it ("fx/click-1.m4a"). */
function filesOnDisk(dir: URL = SFX_DIR, prefix = ''): string[] {
  // Dotfiles (.DS_Store) are not shipped sounds.
  return fs.readdirSync(dir).filter((name) => !name.startsWith('.')).flatMap((name) => {
    const url = new URL(name, dir);
    if (fs.statSync(url).isDirectory()) return filesOnDisk(new URL(name + '/', dir), prefix + name + '/');
    return [prefix + name];
  });
}

/** The `Cue` union, read from the model source so a new cue cannot slip past these tests. */
function cueNames(): string[] {
  const source = text(new URL('src/game/adventure/model.ts', ROOT));
  const block = /export type Cue =([\s\S]*?);/.exec(source);
  if (!block) throw new Error('Cue type not found in model.ts');
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/**
 * Duration in seconds of an .m4a file, from its movie header ('mvhd') box.
 * Enough of the MP4 format to check loop points without decoding audio.
 */
function m4aDuration(url: URL): number {
  const bytes = fs.readFileSync(url);
  const at = indexOfAscii(bytes, 'mvhd');
  if (at < 0) throw new Error(`no mvhd box in ${url.pathname}`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // After the 4-byte type: 1 byte version, 3 bytes flags, then times, timescale and duration.
  const version = bytes[at + 4];
  if (version === 1) {
    const timescale = view.getUint32(at + 8 + 16);
    const duration = Number(view.getBigUint64(at + 8 + 16 + 4));
    return duration / timescale;
  }
  const timescale = view.getUint32(at + 8 + 8);
  const duration = view.getUint32(at + 8 + 8 + 4);
  return duration / timescale;
}

function indexOfAscii(bytes: Uint8Array, word: string): number {
  const codes = [...word].map((ch) => ch.charCodeAt(0));
  for (let i = 0; i + codes.length <= bytes.length; i++) {
    if (codes.every((code, k) => bytes[i + k] === code)) return i;
  }
  return -1;
}

describe('sound files', () => {
  const onDisk = filesOnDisk(SFX_DIR);

  it('give every cue in the model at least one sample that exists', () => {
    const names = cueNames();
    expect(names.length).toBeGreaterThan(20);
    for (const name of names) {
      const sound = CUE_SOUNDS[name as keyof typeof CUE_SOUNDS];
      expect(sound, `no sound for cue '${name}'`).toBeDefined();
      expect(sound.files.length, `cue '${name}' has no files`).toBeGreaterThan(0);
      for (const file of sound.files) expect(fs.existsSync(new URL(file, SFX_DIR)), `${file} missing`).toBe(true);
    }
    expect(Object.keys(CUE_SOUNDS).sort()).toEqual([...names].sort());
  });

  it('give the frequent cues several alternates', () => {
    for (const cue of ['click', 'beat', 'hammer', 'page-turn', 'token-place'] as const) {
      expect(CUE_SOUNDS[cue].files.length, cue).toBeGreaterThanOrEqual(3);
    }
  });

  it('match the folder exactly: nothing missing, nothing unlisted', () => {
    const listed = allSfxFiles();
    expect([...onDisk].sort()).toEqual([...listed].sort());
    for (const bed of Object.values(BEDS)) expect(listed).toContain(bed.file);
    for (const spot of Object.values(SPOTS)) for (const file of spot.files) expect(listed).toContain(file);
  });

  it('are AAC in .m4a and stay small', () => {
    let total = 0;
    for (const file of onDisk) {
      expect(file.endsWith('.m4a'), file).toBe(true);
      const size = fs.statSync(new URL(file, SFX_DIR)).size;
      expect(size, `${file} is ${size} bytes`).toBeLessThanOrEqual(MAX_FILE_BYTES);
      expect(size, `${file} is empty`).toBeGreaterThan(200);
      total += size;
    }
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_BYTES);
  });

  it('have bed loop points inside each bed file', () => {
    for (const [id, bed] of Object.entries(BEDS)) {
      const duration = m4aDuration(new URL(bed.file, SFX_DIR));
      expect(bed.loopStart, id).toBeGreaterThan(0);
      expect(bed.loopEnd, id).toBeGreaterThan(bed.loopStart + 10);
      // The file carries the same padding after the loop as before it.
      expect(duration, id).toBeGreaterThanOrEqual(bed.loopEnd + bed.loopStart - 0.05);
    }
  });

  it('are all credited', () => {
    const credits = text(new URL('CREDITS.md', ROOT));
    for (const file of onDisk) expect(credits, `${file} not in CREDITS.md`).toContain(`audio/sfx/${file}`);
  });
});

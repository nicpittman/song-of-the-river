/**
 * Every sampled sound the game ships, and how each one should be played.
 *
 * All files live under `public/audio/sfx/` and are CC0 or public-domain dedications;
 * `CREDITS.md` at the project root lists the source of every one. The files are
 * built from the originals by a processing script (trim, soften, loudness-match,
 * loop), so their levels already sit together; `gain` here only fine-tunes.
 *
 * Nothing in this file touches WebAudio, so the tests can check it against the
 * folder on disk.
 */
import type { Cue } from '../adventure/model';
import type { Sfx } from './audio';

/** Relative, like the music: the build is served from an itch.io subpath. */
export const SFX_BASE = './audio/sfx/';

/** How one `Cue` is voiced. */
export interface CueSound {
  /** Alternates under SFX_BASE. One is picked at random, never the same one twice running. */
  readonly files: readonly string[];
  /** Linear gain on top of the file's own (already matched) level. */
  readonly gain: number;
  /** Random pitch spread either side, in semitones, so repeats are never identical. */
  readonly pitchJitter: number;
  /** Random level spread either side, in dB. */
  readonly gainJitter: number;
  /** Most copies of this cue that may sound at once; the oldest is faded out to make room. */
  readonly voices: number;
  /** Minimum milliseconds between two starts. Bursts closer than this are thinned, not queued. */
  readonly spacing: number;
  /** Synthesised stand-in while the sample is still loading (or if it failed); null for silence. */
  readonly fallback: Sfx | null;
}

/** Defaults for a cue heard now and then; frequent cues override them. */
function cue(files: string[], overrides: Partial<Omit<CueSound, 'files'>> = {}): CueSound {
  return {
    files,
    gain: 0.8,
    pitchJitter: 0.5,
    gainJitter: 1.5,
    voices: 2,
    spacing: 80,
    fallback: null,
    ...overrides,
  };
}

/** `fx/<name>-1.m4a` … `fx/<name>-<count>.m4a`. */
function alternates(name: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `fx/${name}-${i + 1}.m4a`);
}

/** Bells are tuned objects: they get only a hair of pitch variation. */
const BELL = { pitchJitter: 0.15, gainJitter: 1, voices: 2 } as const;

export const CUE_SOUNDS: Record<Cue, CueSound> = {
  click: cue(alternates('click', 3), { gain: 1, pitchJitter: 0.8, voices: 3, spacing: 35, fallback: 'tap' }),
  'menu-click': cue(alternates('click', 3), { gain: 0.12, pitchJitter: 0.5, voices: 2, spacing: 60 }),
  'menu-hover': cue(alternates('click', 3), { gain: 0.04, pitchJitter: 0.15, voices: 1, spacing: 180 }),
  refuse: cue(alternates('refuse', 2), { gain: 1, spacing: 150, fallback: 'invalid' }),

  'leaf-open': cue(alternates('leaf-open', 2), { gain: 0.48, voices: 1, spacing: 220 }),
  'leaf-close': cue(alternates('leaf-close', 2), { gain: 0.48, voices: 1, spacing: 220 }),
  'page-turn': cue(alternates('page-turn', 4), { gain: 0.34, pitchJitter: 0.35, voices: 1, spacing: 260 }),

  'token-lift': cue(alternates('token-lift', 2), { gain: 0.7, pitchJitter: 0.8, spacing: 60 }),
  'token-place': cue(alternates('token-place', 3), { gain: 0.75, pitchJitter: 0.8, spacing: 60, fallback: 'tap' }),

  'begin-day': cue(['fx/begin-day.m4a'], { gain: 0.75, pitchJitter: 0.3, voices: 1, spacing: 1000 }),
  evening: cue(['fx/evening.m4a'], { ...BELL, gain: 0.7, voices: 1, spacing: 2000 }),
  morning: cue(['fx/morning.m4a'], { ...BELL, gain: 0.55, voices: 1, spacing: 2000 }),

  beat: cue(alternates('beat', 4), { gain: 0.6, pitchJitter: 1, voices: 3, spacing: 150 }),
  choice: cue(['fx/choice.m4a'], { gain: 0.75, pitchJitter: 0.4, voices: 1, spacing: 400 }),
  'pack-plain': cue(['fx/pack-plain.m4a'], { gain: 0.6 }),
  'pack-unusual': cue(['fx/pack-unusual.m4a'], { gain: 0.6 }),
  'pack-rare': cue(['fx/pack-rare.m4a'], { ...BELL, gain: 0.5 }),

  unpack: cue(alternates('unpack', 3), { gain: 0.8, pitchJitter: 0.8, spacing: 120 }),
  find: cue(['fx/find.m4a'], { ...BELL, gain: 0.6, fallback: 'arrive' }),
  'rare-find': cue(['fx/rare-find.m4a'], { ...BELL, gain: 0.65, voices: 1, fallback: 'objective' }),
  lead: cue(['fx/lead.m4a'], { gain: 0.55, pitchJitter: 0.6, voices: 1 }),
  supplies: cue(['fx/supplies.m4a'], { gain: 0.7 }),

  sighting: cue(['fx/sighting.m4a'], { ...BELL, gain: 0.35, spacing: 500 }),
  sketch: cue(['fx/sketch.m4a'], { gain: 0.5, pitchJitter: 0.6, voices: 1, spacing: 300 }),

  cast: cue(['fx/cast.m4a'], { gain: 0.6, pitchJitter: 1, spacing: 300 }),
  splash: cue(alternates('splash', 3), { gain: 0.6, pitchJitter: 1, spacing: 120 }),
  rustle: cue(alternates('rustle', 3), { gain: 0.7, pitchJitter: 1, voices: 3, spacing: 90 }),

  'build-place': cue(alternates('build-place', 2), { gain: 0.8, spacing: 200, fallback: 'connect' }),
  hammer: cue(alternates('hammer', 3), { gain: 0.6, pitchJitter: 1.2, gainJitter: 2.5, spacing: 140 }),
  'build-done': cue(['fx/build-done.m4a'], { ...BELL, gain: 0.8, voices: 1, spacing: 1000, fallback: 'objective' }),

  'river-shift': cue(['fx/river-shift.m4a'], { gain: 0.8, pitchJitter: 0.4, voices: 1, spacing: 1500 }),
  season: cue(['fx/season.m4a'], { gain: 0.7, pitchJitter: 0.3, voices: 1, spacing: 2000, fallback: 'season' }),
  region: cue(['fx/region.m4a'], { ...BELL, gain: 0.75, voices: 1, spacing: 2000, fallback: 'complete' }),

  farewell: cue(['fx/farewell.m4a'], { gain: 0.45, pitchJitter: 0.3, voices: 1, spacing: 2000 }),
  sail: cue(['fx/sail.m4a'], { gain: 0.8, pitchJitter: 0.3, voices: 1, spacing: 2000 }),
};

// ── Ambience ────────────────────────────────────────────────────────────────

/** Looping beds. Their mix is decided in `soundscape.ts`. */
export type BedId =
  | 'river' | 'wind' | 'birds' | 'dawn' | 'cicadas'
  | 'crickets' | 'frogs' | 'rain' | 'sea' | 'fire';

export interface BedSound {
  readonly file: string;
  /**
   * Loop points in seconds. Each file carries half a second of wrap-around audio
   * on both sides of the loop, so looping [loopStart, loopEnd] is seamless even
   * when a browser keeps the AAC encoder's priming samples.
   */
  readonly loopStart: number;
  readonly loopEnd: number;
}

/** Seconds of wrap-around padding on each side of every bed loop (set by the processing script). */
const BED_PAD = 0.5;

function bed(name: BedId, loopSeconds: number): BedSound {
  return { file: `bed/${name}.m4a`, loopStart: BED_PAD, loopEnd: BED_PAD + loopSeconds };
}

export const BEDS: Record<BedId, BedSound> = {
  river: bed('river', 22),
  wind: bed('wind', 22),
  birds: bed('birds', 26),
  dawn: bed('dawn', 22),
  cicadas: bed('cicadas', 18),
  crickets: bed('crickets', 16),
  frogs: bed('frogs', 16),
  rain: bed('rain', 20),
  sea: bed('sea', 24),
  fire: bed('fire', 16),
};

/** Occasional single calls placed somewhere in the stereo field. */
export type SpotId = 'uguisu' | 'owl' | 'crow' | 'gull' | 'creak';

export interface SpotSound {
  readonly files: readonly string[];
  readonly gain: number;
}

export const SPOTS: Record<SpotId, SpotSound> = {
  uguisu: { files: ['spot/uguisu-1.m4a', 'spot/uguisu-2.m4a', 'spot/uguisu-3.m4a'], gain: 0.55 },
  owl: { files: ['spot/owl-1.m4a', 'spot/owl-2.m4a'], gain: 0.5 },
  crow: { files: ['spot/crow-1.m4a', 'spot/crow-2.m4a'], gain: 0.35 },
  gull: { files: ['spot/gull-1.m4a', 'spot/gull-2.m4a'], gain: 0.35 },
  creak: { files: ['spot/creak.m4a'], gain: 0.4 },
};

/**
 * Every file, in the order it should be fetched: short effects first (they are
 * tiny and the player hears them soonest), then the beds most scenes need, then
 * the rest.
 */
export function allSfxFiles(): string[] {
  const effects = Object.values(CUE_SOUNDS).flatMap((c) => c.files);
  const bedOrder: BedId[] = ['river', 'wind', 'birds', 'fire', 'crickets', 'dawn', 'rain', 'frogs', 'cicadas', 'sea'];
  const beds = bedOrder.map((id) => BEDS[id].file);
  const spots = Object.values(SPOTS).flatMap((s) => s.files);
  return [...new Set([...effects, ...beds, ...spots])];
}

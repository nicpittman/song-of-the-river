/**
 * AudioDirector: music, ambience and sound effects.
 *
 * Public methods (all cheap, all safe to call before audio is unlocked; calls
 * made earlier only record the desired state):
 *
 *   unlock()                         Call from every user gesture. Creates or resumes the context.
 *   preload()                        Start fetching the sampled effects and beds in the background.
 *                                    Optional: the first setScene() or unlock() starts it anyway.
 *   setVolumes(music, sfx)           0..1 each. Ambience follows the sfx volume, lower.
 *   setScene('menu' | 'spring' ...)  The old form: music and ambience for a mood.
 *   setScene({ season, weather, hour, region })
 *                                    The expedition form. Call it whenever any of these change (every
 *                                    frame is fine; unchanged values cost nothing). `season` is a name
 *                                    or the 0..3 index; `hour` is the clock 0..24 (dawn chorus as the
 *                                    morning opens, birds by day, insects, frogs and the fire in the
 *                                    evening, a hushed night); `region` 0..2; omitted fields keep
 *                                    their last value. Music follows the season.
 *   setListener({ riverNearness, waterfallNearness, seaNearness, wetlandNearness })
 *                                    How close the camera is to each, 0 far .. 1 right there. Every
 *                                    field optional. Call per frame or when the camera settles.
 *   setPaused(paused)                Ducks everything and stops the occasional calls.
 *   cue(cue, { pan?, pitch? })       A sampled effect for one of the game's `Cue`s, with a little
 *                                    random variation; falls back to a synthesised sound (or
 *                                    silence) while its sample is still loading.
 *   play(sfx, { pitch?, pan? })      The older synthesised effects, unchanged.
 *   dispose()
 *
 * Design notes:
 * - Browsers refuse to start audio before a user gesture, so no context exists
 *   until `unlock()`.
 * - Music is streamed through HTMLAudioElement (never decoded whole, which would
 *   cost tens of MB on mobile) and routed into WebAudio when possible so it can
 *   be crossfaded sample-accurately and ducked with everything else.
 * - Effects and ambience beds are small CC0 recordings under `public/audio/sfx`
 *   (see `sfxManifest.ts` and CREDITS.md). They load lazily after the title is
 *   up and never block anything. The original synthesised ambience and effects
 *   remain as the fallback for any file that is missing or not loaded yet, so
 *   the game is never silent and still works with no files at all.
 * - Every level change is a ramp or a glide; a gain that jumps produces an audible click.
 */
import type { Cue } from '../adventure/model';
import { SampledAmbience } from './ambienceBeds';
import { CuePlayer } from './cuePlayer';
import { SampleBank } from './samples';
import { CUE_SOUNDS, SFX_BASE, allSfxFiles } from './sfxManifest';
import {
  DEFAULT_CONDITIONS, bedCutoffs, bedLevels, isDawnOnset, isNightOnset, pickSpot, seasonName, spotRates,
  type Conditions, type SoundListener, type SoundScene,
} from './soundscape';
import { MUSIC_BASE, nextMusic, type AudioScene } from './tracks';

export type { SoundListener, SoundScene } from './soundscape';

export type Sfx =
  | 'tap' | 'draw' | 'connect' | 'remove' | 'invalid'
  | 'arrive' | 'objective' | 'season' | 'complete';

const MUSIC_CROSSFADE_S = 4;
/**
 * Looping without a gap. An element's own loop leaves a short silence (the
 * file's silent tail, then the seek back), so near the end of each play-through
 * the same track starts again on the other deck and the two crossfade. Inside
 * the last RELAY_WINDOW_S seconds a sustained near-silence (the tail) starts the
 * relay at once; otherwise it starts RELAY_LEAD_S before the end.
 */
const RELAY_WINDOW_S = 14;
const RELAY_LEAD_S = 2.5;
const RELAY_FADE_S = 2.2;
const RELAY_QUIET_RMS = 0.006;
const RELAY_QUIET_S = 0.4;
const RELAY_TICK_MS = 200;
const AMBIENCE_CROSSFADE_S = 5;
/** Ambience sits under the music; this scales it relative to the SFX volume. */
const AMBIENCE_LEVEL = 0.6;
/** Level everything ducks to while the game is paused (tab hidden goes to 0). */
const PAUSE_DUCK = 0.25;
const DRAW_MIN_INTERVAL_MS = 90;

/**
 * Glide time constants (seconds; a glide is ~95% done after three of them).
 * A new season, region or weather drifts in over several seconds; the clock
 * and the camera move quickly, because the night lasts only a few seconds.
 */
const TAU_SCENE = 1.6;
const TAU_HOUR = 0.3;
const TAU_LISTENER = 0.25;
const TAU_TICK = 0.5;
/** Collect bursts of setScene/setListener calls into one mix update. */
const MIX_DEBOUNCE_MS = 50;
/** The ambience clock: dawn settling, occasional calls, releasing idle beds. */
const AMBIENCE_TICK_MS = 1000;
/** No two occasional calls closer than this. */
const SPOT_MIN_GAP_MS = 5000;
/** Wait after the title appears before fetching sounds, so the first frames have the network. */
const PRELOAD_DELAY_MS = 400;

/** Per-scene ambience mix. Gains are linear and deliberately small. */
interface AmbienceProfile {
  river: number;        // river bed level
  riverCutoff: number;  // Hz; lower = more muffled (winter)
  wind: number;         // wind level
  gust: number;         // gust depth per LFO, 0..0.28 (two LFOs sum, base is 0.6)
  windFreq: number;     // Hz; centre of the band-passed wind
  insects: number;      // cricket shimmer level
  birds: number;        // bird bus level
  birdInterval: number; // mean seconds between bird calls; 0 = none
}

const PROFILES: Record<AudioScene, AmbienceProfile> = {
  menu:   { river: 0.09, riverCutoff: 800,  wind: 0.025, gust: 0.10, windFreq: 550, insects: 0,     birds: 0.5,  birdInterval: 6 },
  spring: { river: 0.12, riverCutoff: 900,  wind: 0.03,  gust: 0.12, windFreq: 600, insects: 0,     birds: 0.8,  birdInterval: 3.5 },
  summer: { river: 0.12, riverCutoff: 1000, wind: 0.02,  gust: 0.08, windFreq: 500, insects: 0.012, birds: 1,    birdInterval: 2.2 },
  autumn: { river: 0.12, riverCutoff: 850,  wind: 0.07,  gust: 0.28, windFreq: 450, insects: 0,     birds: 0.6,  birdInterval: 7 },
  winter: { river: 0.09, riverCutoff: 500,  wind: 0.045, gust: 0.18, windFreq: 300, insects: 0,     birds: 0.35, birdInterval: 18 },
};

/** D major pentatonic (D E F# A B). Degree 0 = D4; every 5 degrees is an octave. */
const PENTA_STEPS = [0, 2, 4, 7, 9] as const;
function penta(degree: number): number {
  const octave = Math.floor(degree / 5);
  const step = PENTA_STEPS[((degree % 5) + 5) % 5];
  const midi = 62 + octave * 12 + step;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const randInt = (n: number): number => Math.floor(Math.random() * n);
const noop = (): void => undefined;

/**
 * Click-free move of an AudioParam from wherever it currently is (or from `from`).
 * cancelAndHoldAtTime pins the in-flight automation value; where it's missing
 * (Firefox) `param.value` reports the current computed value instead.
 */
function rampParam(ctx: BaseAudioContext, param: AudioParam, value: number, seconds: number, from?: number): void {
  const now = ctx.currentTime;
  if (from === undefined && typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(now);
  } else {
    const start = from ?? param.value;
    param.cancelScheduledValues(now);
    param.setValueAtTime(start, now);
  }
  param.linearRampToValueAtTime(value, now + Math.max(0.01, seconds));
}

/** Node factories: raw WebAudio wiring is verbose, these keep the graph readable. */
function gainNode(ctx: BaseAudioContext, value: number, dest?: AudioNode | AudioParam): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  if (dest instanceof AudioParam) g.connect(dest);
  else if (dest) g.connect(dest);
  return g;
}

function filterNode(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, q: number, dest: AudioNode): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  f.connect(dest);
  return f;
}

/** StereoPannerNode is missing on older Safari; fall back to a passthrough. */
function makePanner(ctx: BaseAudioContext, pan: number): AudioNode {
  if (typeof ctx.createStereoPanner === 'function') {
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    return p;
  }
  return ctx.createGain();
}

function createContext(): AudioContext | null {
  const w = window as Window & { webkitAudioContext?: typeof AudioContext };
  const Ctor = window.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor({ latencyHint: 'interactive' });
  } catch {
    return null;
  }
}

/** One buffer of pink-ish noise (Paul Kellet's economy filter), shared by river and wind. */
function makeNoiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, peak = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    data[i] = b0 + b1 + b2 + white * 0.1848;
    peak = Math.max(peak, Math.abs(data[i]));
  }
  for (let i = 0; i < data.length; i++) data[i] = (data[i] / peak) * 0.9;
  return buf;
}

/**
 * One of two music players. Two decks let one fade out while the other fades in.
 * Elements and their MediaElementSource nodes are created once and reused,
 * because createMediaElementSource may only be called once per element.
 */
class MusicDeck {
  readonly el: HTMLAudioElement;
  /** WebAudio fade gain, or null when we fall back to `el.volume`. */
  private readonly gain: GainNode | null;
  /** Listens to the track itself (before the fade), to hear a silent tail coming. */
  private readonly analyser: AnalyserNode | null = null;
  private readonly samples: Float32Array<ArrayBuffer> | null = null;
  /** Seconds of near-silence heard in a row near the end of the track. */
  quietFor = 0;
  private readonly ctx: AudioContext | null;
  private readonly fallbackScale: () => number;
  /** Track name currently loaded (sounding or fading out); null when stopped. */
  file: string | null = null;
  /** True when this deck should be audible; used to resume after hide/autoplay refusal. */
  wanted = false;
  /** Fade level 0..1. Authoritative only in fallback mode (WebAudio tracks its own). */
  private level = 0;
  /** Set by load(): the next fade must start from silence, not the old track's level. */
  private fromSilence = false;
  private stepTimer: number | undefined;
  private doneTimer: number | undefined;

  constructor(ctx: AudioContext | null, dest: AudioNode | null, fallbackScale: () => number, onError: (deck: MusicDeck) => void) {
    this.ctx = ctx;
    this.fallbackScale = fallbackScale;
    this.el = new Audio();
    this.el.loop = true;
    this.el.preload = 'auto';
    this.el.addEventListener('error', () => { if (this.file) onError(this); });
    let gain: GainNode | null = null;
    if (ctx && dest) {
      try {
        const src = ctx.createMediaElementSource(this.el);
        gain = ctx.createGain();
        gain.gain.value = 0;
        src.connect(gain);
        gain.connect(dest);
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 512;
        this.samples = new Float32Array(this.analyser.fftSize);
        src.connect(this.analyser);
      } catch {
        gain = null; // Unsupported: element.volume fallback below.
      }
    }
    this.gain = gain;
    this.applyVolume();
  }

  load(file: string): void {
    this.clearTimers();
    // Rapid back-to-back scene changes can cut the tail of an old fade-out here
    // (swapping src is itself a discontinuity); seasons are minutes apart, so we
    // accept that rather than queueing loads.
    this.fromSilence = true;
    this.level = 0;
    this.applyVolume();
    this.file = file;
    this.el.src = MUSIC_BASE + file;
  }

  resume(): void {
    if (this.wanted && this.file && this.el.paused) {
      // play() rejects if autoplay is refused; the next unlock() retries.
      this.el.play()?.catch(noop);
    }
  }

  pause(): void {
    if (!this.el.paused) this.el.pause();
  }

  fadeTo(target: number, seconds: number, onDone?: () => void): void {
    this.clearTimers();
    if (this.gain && this.ctx) {
      rampParam(this.ctx, this.gain.gain, target, seconds, this.fromSilence ? 0 : undefined);
      this.fromSilence = false;
      this.level = target;
      if (onDone) this.doneTimer = window.setTimeout(onDone, seconds * 1000 + 50);
      return;
    }
    // Fallback: step element.volume from JS. Coarser, but still click-free in practice.
    const start = this.level;
    const t0 = performance.now();
    this.stepTimer = window.setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / (seconds * 1000));
      this.level = start + (target - start) * k;
      this.applyVolume();
      if (k >= 1) {
        window.clearInterval(this.stepTimer);
        onDone?.();
      }
    }, 50);
  }

  /** True when the track itself is all but silent right now (always false without WebAudio). */
  isQuiet(): boolean {
    if (!this.analyser || !this.samples) return false;
    this.analyser.getFloatTimeDomainData(this.samples);
    let sum = 0;
    for (const v of this.samples) sum += v * v;
    return Math.sqrt(sum / this.samples.length) < RELAY_QUIET_RMS;
  }

  /** Re-apply volume in fallback mode (music volume or duck changed). */
  applyVolume(): void {
    if (!this.gain) this.el.volume = clamp(this.level * this.fallbackScale(), 0, 1);
  }

  stop(): void {
    this.clearTimers();
    this.wanted = false;
    this.file = null; // Cleared first so the 'error' handler ignores the unload.
    this.el.pause();
    this.el.removeAttribute('src');
    this.el.load(); // Releases the network stream.
  }

  private clearTimers(): void {
    window.clearInterval(this.stepTimer);
    window.clearTimeout(this.doneTimer);
  }
}

interface NoteOpts {
  gain: number;
  /** Decay time in seconds after the attack. */
  dur: number;
  attack?: number;
  /** Triangle layer level relative to the sine (adds a little warmth/edge). */
  tri?: number;
  /** Extra sine partials as [frequency ratio, level]; they decay faster than the body. */
  partials?: ReadonlyArray<readonly [number, number]>;
  /** Start pitch multiplier that glides down to the note in 50 ms (thud). */
  drop?: number;
  pan: number;
}

/** Gentle octave + twelfth: warm mallet. */
const SOFT: ReadonlyArray<readonly [number, number]> = [[2, 0.18], [3, 0.06]];
/** Brighter, with a slightly inharmonic partial for a small-bell shimmer. */
const BELL: ReadonlyArray<readonly [number, number]> = [[2, 0.3], [2.76, 0.12], [4, 0.06]];

/** Persistent ambience nodes whose parameters change per scene. */
interface Ambience {
  riverLevel: GainNode;
  riverFilter: BiquadFilterNode;
  windLevel: GainNode;
  windFilter: BiquadFilterNode;
  gustDepth: GainNode;
  insectLevel: GainNode;
  birdBus: GainNode;
}

export class AudioDirector {
  private musicVol: number;
  private sfxVol: number;
  private scene: AudioScene = 'menu';
  private unlocked = false;
  private disposed = false;
  private gamePaused = false;
  private hidden = false;

  private ctx: AudioContext | null = null;
  private duck: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private sfxIn: AudioNode | null = null;
  private ambBus: GainNode | null = null;
  private amb: Ambience | null = null;

  private decks: [MusicDeck, MusicDeck] | null = null;
  private activeDeck = 0;
  private readonly failedTracks = new Set<string>();
  private loggedMusicFailure = false;

  private relayTimer: number | undefined;
  private birdTimer: number | undefined;
  private suspendTimer: number | undefined;
  private lastDrawAt = 0;

  // Sampled sound.
  private readonly bank = new SampleBank(SFX_BASE);
  private preloadTimer: number | undefined;
  private preloadRequested = false;
  private cues: CuePlayer | null = null;
  private sampled: SampledAmbience | null = null;
  /** Where, when and in what weather we are, as the ambience rules see it. */
  private conditions: Conditions = { ...DEFAULT_CONDITIONS };
  /** The last hour given to setScene, for spotting dawn and nightfall; null before the first. */
  private lastHour: number | null = null;
  /** performance.now() when this morning's light came up; null when no dawn has been seen. */
  private dawnAt: number | null = null;
  private mixTimer: number | undefined;
  private pendingTau = Infinity;
  private ambienceTimer: number | undefined;
  private lastSpotAt = 0;
  /** Which synthesised layers are currently stepping aside for their recordings (to avoid re-ramping). */
  private synthMask = '';
  private readonly onsetTimers = new Set<number>();

  private readonly onVisibility = (): void => this.setHidden(document.hidden);

  constructor(volumes: { music: number; sfx: number }) {
    this.musicVol = clamp(volumes.music, 0, 1);
    this.sfxVol = clamp(volumes.sfx, 0, 1);
  }

  /** Call from every user gesture (cheap after the first): creates or resumes the context. */
  unlock(): void {
    if (this.disposed) return;
    if (!this.unlocked) {
      this.unlocked = true;
      this.ctx = createContext();
      if (this.ctx) this.buildGraph(this.ctx);
      const dest = this.musicBus;
      const scale = (): number => this.musicVol * this.duckTarget();
      const onError = (deck: MusicDeck): void => this.onMusicError(deck);
      this.decks = [new MusicDeck(this.ctx, dest, scale, onError), new MusicDeck(this.ctx, dest, scale, onError)];
      document.addEventListener('visibilitychange', this.onVisibility);
      this.hidden = document.hidden;
      this.applyDuck();
      this.applyScene(true);
      this.preload();
      this.pendingTau = Infinity;
      this.applyMix(TAU_SCENE);
      this.ambienceTimer = window.setInterval(() => this.ambienceTick(), AMBIENCE_TICK_MS);
      this.relayTimer = window.setInterval(() => this.relayTick(), RELAY_TICK_MS);
    }
    if (this.ctx && this.ctx.state !== 'running' && !this.hidden) this.ctx.resume().catch(noop);
    // Retry any music whose play() was refused (iOS can do this outside a gesture).
    if (!this.hidden) this.decks?.forEach((d) => d.resume());
  }

  /**
   * Begin fetching the sampled sounds in the background. Idempotent. Fetching
   * waits a moment and runs a few files at a time, so it never holds up the
   * loading screen; decoding waits for the context.
   */
  preload(): void {
    if (this.disposed || this.preloadRequested) return;
    this.preloadRequested = true;
    if (typeof fetch !== 'function') return;
    this.preloadTimer = window.setTimeout(() => {
      // Effects and calls are small and wanted at any moment. Ambience beds (1.6 MB, the sea's
      // among them) are fetched only when first heard: each asks for its own file as it fades in.
      this.bank.prefetch(allSfxFiles().filter((file) => !file.startsWith('bed/')), () => true);
    }, PRELOAD_DELAY_MS);
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVol = clamp(music, 0, 1);
    this.sfxVol = clamp(sfx, 0, 1);
    if (this.disposed || !this.unlocked) return;
    this.applyBusVolumes(0.08);
    this.decks?.forEach((d) => d.applyVolume());
  }

  /**
   * Set the mood. A string is the original form ('menu' or a season name). An
   * object describes the expedition scene; see the notes at the top of the file.
   */
  setScene(scene: AudioScene | SoundScene): void {
    if (this.disposed) return;
    this.preload();
    if (typeof scene === 'string') {
      this.setMood(scene);
      return;
    }
    const c = this.conditions;
    const season = seasonName(scene.season);
    let tau = Infinity;
    if (season !== c.season || (scene.weather !== undefined && scene.weather !== c.weather) ||
        (scene.region !== undefined && scene.region !== c.region)) {
      tau = TAU_SCENE;
    }
    c.season = season;
    if (scene.weather !== undefined) c.weather = scene.weather;
    if (scene.region !== undefined) c.region = scene.region;
    if (scene.hour !== undefined && Number.isFinite(scene.hour) && scene.hour !== c.hour) {
      this.onHour(scene.hour);
      tau = Math.min(tau, TAU_HOUR);
    }
    // Music and the synthesised fallback follow the season.
    if (season !== this.scene) {
      this.scene = season;
      if (this.unlocked) this.applyScene(false);
    }
    if (tau < Infinity) this.requestMix(tau);
  }

  /** Tell the director how close the camera is to the water. Fields are 0..1 and optional. */
  setListener(listener: SoundListener): void {
    if (this.disposed) return;
    const c = this.conditions;
    const before = [c.river, c.waterfall, c.sea, c.wetland];
    if (listener.riverNearness !== undefined) c.river = clamp(listener.riverNearness, 0, 1);
    if (listener.waterfallNearness !== undefined) c.waterfall = clamp(listener.waterfallNearness, 0, 1);
    if (listener.seaNearness !== undefined) c.sea = clamp(listener.seaNearness, 0, 1);
    if (listener.wetlandNearness !== undefined) c.wetland = clamp(listener.wetlandNearness, 0, 1);
    const after = [c.river, c.waterfall, c.sea, c.wetland];
    if (after.some((v, i) => v !== before[i])) this.requestMix(TAU_LISTENER);
  }

  setPaused(paused: boolean): void {
    if (this.disposed || paused === this.gamePaused) return;
    this.gamePaused = paused;
    if (!this.unlocked) return;
    this.applyDuck();
    this.scheduleBirds();
  }

  /**
   * Play the sampled sound for a game cue. Small random pitch and level keep
   * repeats from sounding mechanical; `pitch` multiplies the playback rate and
   * `pan` places it (-1 left .. 1 right). While the sample is still loading the
   * cue uses its synthesised stand-in, or stays silent if it has none.
   */
  cue(cue: Cue, opts?: { pan?: number; pitch?: number }): void {
    const ctx = this.ctx;
    if (!ctx || this.disposed || this.hidden || ctx.state !== 'running') return;
    if (this.cues?.play(cue, opts)) return;
    const fallback = CUE_SOUNDS[cue].fallback;
    if (fallback) this.play(fallback, opts);
  }

  play(sfx: Sfx, opts?: { pitch?: number; pan?: number }): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxIn || this.disposed || this.hidden || ctx.state !== 'running') return;
    if (sfx === 'draw') {
      const now = performance.now();
      if (now - this.lastDrawAt < DRAW_MIN_INTERVAL_MS) return;
      this.lastDrawAt = now;
    }
    const ratio = opts?.pitch && opts.pitch > 0 ? opts.pitch : 1;
    const basePan = clamp(opts?.pan ?? 0, -1, 1);
    const t = ctx.currentTime + 0.005;
    // Each note gets a small random pan offset so chords feel spacious, not mono.
    const n = (degree: number, at: number, o: Omit<NoteOpts, 'pan'>): void =>
      this.note(ctx, penta(degree) * ratio, t + at, { ...o, pan: basePan + (Math.random() - 0.5) * 0.3 });

    switch (sfx) {
      case 'tap':
        n(7, 0, { gain: 0.05, dur: 0.35, tri: 0.1 });
        break;
      case 'draw':
        n(10 + randInt(3), 0, { gain: 0.022, dur: 0.12, tri: 0.05 });
        break;
      case 'connect':
        [5, 7, 9].forEach((d, i) => n(d, i * 0.075, { gain: 0.09, dur: 0.9, tri: 0.15, partials: SOFT }));
        break;
      case 'remove':
        [7, 4].forEach((d, i) => n(d, i * 0.1, { gain: 0.07, dur: 0.6, tri: 0.1 }));
        break;
      case 'invalid':
        // A brief downward pitch drop on a low sine reads as a soft felt thud.
        n(-2, 0, { gain: 0.16, dur: 0.4, tri: 0.2, drop: 1.6 });
        break;
      case 'arrive':
        n(8 + randInt(5), 0, { gain: 0.07, dur: 1.2, tri: 0.05, partials: BELL });
        break;
      case 'objective':
        [5, 7, 8, 10].forEach((d, i) => n(d, i * 0.11, { gain: 0.08, dur: 1.1, tri: 0.12, partials: SOFT }));
        break;
      case 'season':
        [0, 2, 3, 5].forEach((d, i) => n(d, i * 0.04, { gain: 0.05, dur: 1.8, attack: 0.8, tri: 0.2 }));
        break;
      case 'complete':
        [5, 7, 8, 10, 9, 11, 12].forEach((d, i) => n(d, i * 0.11, { gain: 0.07, dur: 1.0, tri: 0.1, partials: SOFT }));
        [0, 3, 5, 7, 10].forEach((d) => n(d, 0.85, { gain: 0.05, dur: 3.0, attack: 0.03, tri: 0.15, partials: SOFT }));
        break;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.clearTimeout(this.birdTimer);
    window.clearTimeout(this.suspendTimer);
    window.clearTimeout(this.preloadTimer);
    window.clearTimeout(this.mixTimer);
    window.clearInterval(this.ambienceTimer);
    window.clearInterval(this.relayTimer);
    this.onsetTimers.forEach((t) => window.clearTimeout(t));
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.decks?.forEach((d) => d.stop());
    this.sampled?.dispose();
    this.ctx?.close().catch(noop);
    this.ctx = null;
  }

  // ---------------------------------------------------------------- ambience

  /** The original string form of setScene: a mood for the menu or a season. */
  private setMood(scene: AudioScene): void {
    if (scene === 'menu') {
      // The title screen: a spring morning by the water, whatever the save says.
      this.conditions = { ...DEFAULT_CONDITIONS, river: this.conditions.river };
      this.lastHour = null;
      this.dawnAt = null;
    } else {
      this.conditions.season = scene;
    }
    this.requestMix(TAU_SCENE);
    if (scene === this.scene) return;
    this.scene = scene;
    if (this.unlocked) this.applyScene(false);
  }

  /** The clock moved: note dawn and nightfall, which bring their own calls. */
  private onHour(hour: number): void {
    const previous = this.lastHour;
    this.conditions.hour = hour;
    this.lastHour = hour;
    if (isDawnOnset(previous, hour)) {
      this.dawnAt = performance.now();
      // The bush warbler greets a spring morning: one call as the light comes, sometimes a second.
      if (this.conditions.season === 'spring' && this.conditions.weather !== 'rain') {
        this.afterDelay(1200 + Math.random() * 1500, () => this.playSpot('uguisu', 1));
        if (Math.random() < 0.6) this.afterDelay(7000 + Math.random() * 5000, () => this.playSpot('uguisu', 0.8));
      }
    }
    if (isNightOnset(previous, hour) && this.conditions.season !== 'winter' && Math.random() < 0.6) {
      this.afterDelay(500 + Math.random() * 800, () => this.playSpot('owl', 0.9));
    }
  }

  private afterDelay(ms: number, run: () => void): void {
    const timer = window.setTimeout(() => {
      this.onsetTimers.delete(timer);
      run();
    }, ms);
    this.onsetTimers.add(timer);
  }

  private playSpot(spot: Parameters<SampledAmbience['playSpot']>[0], level: number): void {
    if (this.disposed || this.hidden || this.ctx?.state !== 'running') return;
    this.lastSpotAt = performance.now();
    this.sampled?.playSpot(spot, level);
  }

  /** Coalesce changes into one mix update, using the quickest glide any of them asked for. */
  private requestMix(tau: number): void {
    this.pendingTau = Math.min(this.pendingTau, tau);
    if (!this.unlocked || this.mixTimer !== undefined) return;
    this.mixTimer = window.setTimeout(() => {
      this.mixTimer = undefined;
      const glide = this.pendingTau;
      this.pendingTau = Infinity;
      this.applyMix(glide);
    }, MIX_DEBOUNCE_MS);
  }

  /** Current conditions, with the dawn's age filled in. */
  private currentConditions(): Conditions {
    const dawnAge = this.dawnAt === null ? Infinity : (performance.now() - this.dawnAt) / 1000;
    return { ...this.conditions, dawnAge };
  }

  private applyMix(tau: number): void {
    if (!this.ctx || !this.sampled || this.disposed) return;
    const c = this.currentConditions();
    this.sampled.setLevels(bedLevels(c), bedCutoffs(c), Number.isFinite(tau) ? tau : TAU_SCENE);
    this.applySynthLevels(TAU_SCENE);
  }

  /** Once a second: let the dawn settle, place an occasional call, free beds nobody needs. */
  private ambienceTick(): void {
    if (this.disposed || this.hidden || !this.sampled || this.ctx?.state !== 'running') return;
    // Gradual change only (the dawn settling). A change already waiting in requestMix brings its own glide.
    if (this.mixTimer === undefined) this.applyMix(TAU_TICK);
    this.sampled.releaseIdle();
    if (this.gamePaused) return;
    const now = performance.now();
    if (now - this.lastSpotAt < SPOT_MIN_GAP_MS) return;
    const spot = pickSpot(spotRates(this.currentConditions()), AMBIENCE_TICK_MS / 1000, Math.random());
    if (spot) this.playSpot(spot, 1);
  }

  /**
   * The synthesised layers are the fallback: each one fades out once its
   * recording is actually playing, and back in if that recording stops.
   */
  private applySynthLevels(seconds: number, force = false): void {
    const ctx = this.ctx;
    const a = this.amb;
    if (!ctx || !a) return;
    const s = this.sampled;
    const river = s?.playing('river') ? 0 : 1;
    const wind = s?.playing('wind') ? 0 : 1;
    const birds = s?.playing('birds') ? 0 : 1;
    const insects = s && (s.playing('crickets') || s.playing('cicadas')) ? 0 : 1;
    const mask = `${river}${wind}${birds}${insects}`;
    if (!force && mask === this.synthMask) return;
    this.synthMask = mask;
    const p = PROFILES[this.scene];
    rampParam(ctx, a.riverLevel.gain, p.river * river, seconds);
    rampParam(ctx, a.windLevel.gain, p.wind * wind, seconds);
    rampParam(ctx, a.insectLevel.gain, p.insects * insects, seconds);
    rampParam(ctx, a.birdBus.gain, p.birds * birds, seconds);
  }

  // ---------------------------------------------------------------- internals

  /**
   * buses -> duck (pause/hide) -> limiter -> destination.
   * Ambience follows the SFX volume but has its own bus so it can sit lower.
   */
  private buildGraph(ctx: AudioContext): void {
    // A fast, high-ratio compressor acting as a safety limiter for stacked SFX.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(ctx.destination);

    this.duck = gainNode(ctx, 0, limiter);
    this.musicBus = gainNode(ctx, 0, this.duck);
    this.sfxBus = gainNode(ctx, 0, this.duck);
    this.ambBus = gainNode(ctx, 0, this.duck);
    // One shared gentle lowpass keeps every SFX soft without a filter per note.
    this.sfxIn = filterNode(ctx, 'lowpass', 3800, 0.5, this.sfxBus);
    this.amb = this.buildAmbience(ctx, this.ambBus);
    // Recorded effects are already softened, so they skip the synth lowpass and go straight to the bus.
    this.bank.attach(ctx);
    this.cues = new CuePlayer(ctx, this.bank, this.sfxBus);
    this.sampled = new SampledAmbience(ctx, this.bank, this.ambBus);
    this.applyBusVolumes(0.5);
  }

  private buildAmbience(ctx: AudioContext, out: AudioNode): Ambience {
    const noise = makeNoiseBuffer(ctx, 6);
    /** A free-running sine LFO into `target`, scaled by `depth`. */
    const lfo = (hz: number, depth: number, target: GainNode | AudioParam): void => {
      const osc = ctx.createOscillator();
      osc.frequency.value = hz;
      const g = gainNode(ctx, depth);
      osc.connect(g);
      if (target instanceof AudioParam) g.connect(target);
      else g.connect(target);
      osc.start();
    };
    const loopNoise = (rate: number, offset: number, dest: AudioNode): void => {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      src.playbackRate.value = rate;
      src.connect(dest);
      src.start(0, offset);
    };

    // River: lowpassed noise with slow, unrelated drifts in brightness and loudness.
    const riverLevel = gainNode(ctx, 0, out);
    const riverMod = gainNode(ctx, 1, riverLevel);
    const riverFilter = filterNode(ctx, 'lowpass', 800, 0.4, riverMod);
    lfo(0.05, 250, riverFilter.frequency);
    lfo(0.09, 0.2, riverMod.gain);
    loopNoise(1, 0, riverFilter);

    // Wind: same buffer, offset and slowed so it doesn't correlate with the river.
    // Two LFOs at incommensurate rates sum (via gustDepth) into irregular gusts.
    const windLevel = gainNode(ctx, 0, out);
    const windMod = gainNode(ctx, 0.6, windLevel);
    const windFilter = filterNode(ctx, 'bandpass', 500, 0.9, windMod);
    const gustDepth = gainNode(ctx, 0, windMod.gain);
    lfo(0.071, 1, gustDepth);
    lfo(0.113, 1, gustDepth);
    loopNoise(0.85, 2.7, windFilter);

    // Insects: a high sine trilled at ~23 Hz and swelling slowly, like distant crickets.
    const insectLevel = gainNode(ctx, 0, out);
    const swell = gainNode(ctx, 0.5, insectLevel);
    const trill = gainNode(ctx, 0.5, swell);
    lfo(23, 0.5, trill.gain);
    lfo(0.37, 0.5, swell.gain);
    const insectOsc = ctx.createOscillator();
    insectOsc.frequency.value = 4600;
    insectOsc.connect(trill);
    insectOsc.start();

    // Birds: chirps are created on demand; this bus (with a top-end softener) persists.
    const birdBus = gainNode(ctx, 0, filterNode(ctx, 'lowpass', 6000, 0.7, out));

    return { riverLevel, riverFilter, windLevel, windFilter, gustDepth, insectLevel, birdBus };
  }

  private applyScene(first: boolean): void {
    const playing = this.decks?.[this.activeDeck];
    // Let a piece finish through seasonal changes; the next choice uses the
    // current season. Otherwise short days could continually interrupt the theme.
    if (first || this.scene === 'menu' || !playing?.file || !playing.wanted) {
      this.setMusic(nextMusic('menu', null, this.failedTracks), first ? 2.5 : MUSIC_CROSSFADE_S);
    }
    const ctx = this.ctx;
    const a = this.amb;
    if (ctx && a) {
      const p = PROFILES[this.scene];
      const s = first ? 3 : AMBIENCE_CROSSFADE_S;
      rampParam(ctx, a.riverFilter.frequency, p.riverCutoff, s);
      rampParam(ctx, a.windFilter.frequency, p.windFreq, s);
      rampParam(ctx, a.gustDepth.gain, p.gust, s);
      this.applySynthLevels(s, true);
    }
    this.scheduleBirds();
  }

  private setMusic(track: string | null, seconds: number): void {
    if (!this.decks) return;
    const target = track && !this.failedTracks.has(track) ? track : null;
    const active = this.decks[this.activeDeck];
    const other = this.decks[1 - this.activeDeck];
    const fadeIn = (d: MusicDeck): void => {
      d.wanted = true;
      if (!this.hidden) d.resume();
      d.fadeTo(1, seconds);
    };
    const fadeOut = (d: MusicDeck): void => {
      if (!d.file) return;
      d.wanted = false;
      d.fadeTo(0, seconds, () => d.stop());
    };

    if (target && active.file === target) {
      // Same file across scenes: keep playing without a restart.
      if (!active.wanted) fadeIn(active);
      return;
    }
    fadeOut(active);
    if (!target) return;
    // Reversing a crossfade in progress: bring the old deck back rather than restart it.
    if (other.file !== target) other.load(target);
    fadeIn(other);
    this.activeDeck = 1 - this.activeDeck;
  }

  /** At a track's quiet tail, crossfade to the theme or the current seasonal piece. */
  private relayTick(): void {
    const decks = this.decks;
    if (!decks || this.hidden) return;
    const active = decks[this.activeDeck];
    const other = decks[1 - this.activeDeck];
    const el = active.el;
    if (!active.file || !active.wanted || other.file || el.paused || !Number.isFinite(el.duration) || el.duration < 20) return;
    const left = el.duration - el.currentTime;
    if (left > RELAY_WINDOW_S) {
      active.quietFor = 0;
      return;
    }
    active.quietFor = active.isQuiet() ? active.quietFor + RELAY_TICK_MS / 1000 : 0;
    if (left > RELAY_LEAD_S && active.quietFor < RELAY_QUIET_S) return;
    const file = nextMusic(this.scene, active.file, this.failedTracks);
    if (!file) return;
    active.wanted = false;
    active.fadeTo(0, RELAY_FADE_S, () => active.stop());
    other.load(file);
    other.wanted = true;
    other.resume();
    other.fadeTo(1, RELAY_FADE_S);
    this.activeDeck = 1 - this.activeDeck;
  }

  private onMusicError(deck: MusicDeck): void {
    if (deck.file) this.failedTracks.add(deck.file);
    if (!this.loggedMusicFailure) {
      this.loggedMusicFailure = true;
      console.info(`[audio] Music file ${MUSIC_BASE}${deck.file ?? ''} unavailable; continuing without music.`);
    }
    deck.stop();
  }

  private applyBusVolumes(seconds: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus || !this.sfxBus || !this.ambBus) return;
    rampParam(ctx, this.musicBus.gain, this.musicVol, seconds);
    rampParam(ctx, this.sfxBus.gain, this.sfxVol, seconds);
    rampParam(ctx, this.ambBus.gain, this.sfxVol * AMBIENCE_LEVEL, seconds);
  }

  private duckTarget(): number {
    return this.hidden ? 0 : this.gamePaused ? PAUSE_DUCK : 1;
  }

  private applyDuck(): void {
    if (this.ctx && this.duck) rampParam(this.ctx, this.duck.gain, this.duckTarget(), this.hidden ? 0.25 : 0.8);
    // Fallback-mode music can't ramp with the graph; it steps, which is acceptable for a rare event.
    this.decks?.forEach((d) => d.applyVolume());
  }

  /** Tab hidden: fade out, then suspend the context and pause streams to save battery. */
  private setHidden(hidden: boolean): void {
    if (this.disposed || hidden === this.hidden) return;
    this.hidden = hidden;
    window.clearTimeout(this.suspendTimer);
    this.applyDuck();
    this.scheduleBirds();
    if (hidden) {
      this.suspendTimer = window.setTimeout(() => {
        this.decks?.forEach((d) => d.pause());
        this.ctx?.suspend().catch(noop);
      }, 300);
    } else {
      this.ctx?.resume().catch(noop);
      this.decks?.forEach((d) => d.resume());
    }
  }

  /** Single self-rescheduling timer; stops entirely while paused or hidden. */
  private scheduleBirds(): void {
    window.clearTimeout(this.birdTimer);
    this.birdTimer = undefined;
    const interval = PROFILES[this.scene].birdInterval;
    if (!this.ctx || !this.amb || this.disposed || this.gamePaused || this.hidden || interval <= 0) return;
    const delayMs = interval * (0.35 + Math.random() * 1.3) * 1000;
    this.birdTimer = window.setTimeout(() => {
      // Synthesised chirps only while the recorded birds are not playing.
      if (this.ctx?.state === 'running' && !this.sampled?.playing('birds')) this.birdCall();
      this.scheduleBirds();
    }, delayMs);
  }

  /** One bird call: 1-4 short soft glissandi, mostly upward, from a random direction. */
  private birdCall(): void {
    const ctx = this.ctx;
    if (!ctx || !this.amb) return;
    const panner = makePanner(ctx, Math.random() * 1.6 - 0.8);
    panner.connect(this.amb.birdBus);
    const type: OscillatorType = Math.random() < 0.6 ? 'sine' : 'triangle';
    const base = 1800 + Math.random() * 1800;
    const count = 1 + randInt(4);
    let t = ctx.currentTime + 0.02;
    for (let i = 0; i < count; i++) {
      const dur = 0.05 + Math.random() * 0.09;
      const f0 = base * (0.9 + Math.random() * 0.2);
      const f1 = f0 * (Math.random() < 0.65 ? 1.25 + Math.random() * 0.35 : 0.72);
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.04, t + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(env);
      env.connect(panner);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      const last = i === count - 1;
      osc.onended = (): void => {
        env.disconnect();
        if (last) panner.disconnect();
      };
      t += dur + 0.04 + Math.random() * 0.08;
    }
  }

  /**
   * A soft mallet / felt-piano tone: sine fundamental plus a touch of triangle,
   * optional upper partials that decay faster than the body (the felt "thunk"),
   * fast attack and exponential decay.
   */
  private note(ctx: AudioContext, freq: number, when: number, o: NoteOpts): void {
    if (!this.sfxIn) return;
    const attack = o.attack ?? 0.006;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(o.gain, when + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, when + attack + o.dur);
    const panner = makePanner(ctx, o.pan);
    env.connect(panner);
    panner.connect(this.sfxIn);

    const end = when + attack + o.dur + 0.05;
    const voices: Array<[type: OscillatorType, ratio: number, level: number]> = [['sine', 1, 1]];
    if (o.tri) voices.push(['triangle', 1, o.tri]);
    for (const [ratio, level] of o.partials ?? []) voices.push(['sine', ratio, level]);

    voices.forEach(([type, ratio, level], i) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      const f = freq * ratio;
      if (o.drop) {
        osc.frequency.setValueAtTime(f * o.drop, when);
        osc.frequency.exponentialRampToValueAtTime(f, when + 0.05);
      } else {
        osc.frequency.value = f;
      }
      const g = ctx.createGain();
      g.gain.setValueAtTime(level, when);
      if (ratio !== 1) g.gain.setTargetAtTime(0, when, o.dur * 0.15);
      osc.connect(g);
      g.connect(env);
      osc.start(when);
      osc.stop(end);
      if (i === 0) {
        osc.onended = (): void => {
          env.disconnect();
          panner.disconnect();
        };
      }
    });
  }
}

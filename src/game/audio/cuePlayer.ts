/**
 * CuePlayer: plays the short sampled effects behind `AudioDirector.cue()`.
 *
 * Three things keep fifty hearings of the same click from grating:
 * - several recordings per frequent cue, never the same one twice running;
 * - a little random pitch and level on every play;
 * - voice limits: a cue that fires again too soon is dropped, and when too
 *   many copies are sounding the oldest is faded out to make room.
 */
import type { Cue } from '../adventure/model';
import { CUE_SOUNDS } from './sfxManifest';
import type { SampleBank } from './samples';

/** Hard ceiling on sampled effects sounding at once, across all cues. */
const MAX_TOTAL_VOICES = 14;
/** Fade used when a voice is stolen; short, but long enough not to click. */
const STEAL_FADE_S = 0.03;

interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  endsAt: number;
}

interface CueState {
  lastFile: number;
  lastStart: number;
  voices: Voice[];
}

export interface CueOptions {
  /** -1 (left) .. 1 (right). */
  pan?: number;
  /** Playback-rate multiplier; 1 is as recorded. */
  pitch?: number;
}

/** Pick an index in [0, count) that differs from `last` whenever there is a choice. */
export function pickAlternate(count: number, last: number, random: number): number {
  if (count <= 1) return 0;
  if (last < 0 || last >= count) return Math.min(count - 1, Math.floor(random * count));
  const pick = Math.floor(random * (count - 1));
  return pick >= last ? pick + 1 : pick;
}

export class CuePlayer {
  private readonly states = new Map<Cue, CueState>();

  constructor(
    private readonly ctx: AudioContext,
    private readonly bank: SampleBank,
    private readonly out: AudioNode,
  ) {}

  /**
   * Play a cue's sample. Returns false when there is no sample ready, so the
   * caller can fall back to a synthesised sound; returns true when the cue was
   * handled, including when it was deliberately thinned out.
   */
  play(cue: Cue, opts: CueOptions = {}): boolean {
    const sound = CUE_SOUNDS[cue];
    const state = this.state(cue);
    const nowMs = performance.now();
    if (nowMs - state.lastStart < sound.spacing) return true;

    const index = pickAlternate(sound.files.length, state.lastFile, Math.random());
    // If the chosen alternate is still loading, any other loaded one will do.
    const buffer = this.bank.get(sound.files[index]) ?? this.anyLoaded(sound.files);
    if (!buffer) return false;

    const now = this.ctx.currentTime;
    this.prune(state, now);
    if (state.voices.length >= sound.voices) this.steal(state.voices.shift()!, now);
    if (this.totalVoices() >= MAX_TOTAL_VOICES) return true;

    const semitones = (Math.random() * 2 - 1) * sound.pitchJitter;
    const rate = (opts.pitch && opts.pitch > 0 ? opts.pitch : 1) * Math.pow(2, semitones / 12);
    const decibels = (Math.random() * 2 - 1) * sound.gainJitter;
    const level = sound.gain * Math.pow(10, decibels / 20);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    gain.gain.value = level;
    source.connect(gain);
    const panner = this.panner(opts.pan ?? 0);
    if (panner) {
      gain.connect(panner);
      panner.connect(this.out);
    } else {
      gain.connect(this.out);
    }

    const start = now + 0.005;
    source.start(start);
    const voice: Voice = { source, gain, endsAt: start + buffer.duration / rate };
    source.onended = (): void => {
      gain.disconnect();
      panner?.disconnect();
    };
    state.voices.push(voice);
    state.lastFile = index;
    state.lastStart = nowMs;
    return true;
  }

  private state(cue: Cue): CueState {
    let state = this.states.get(cue);
    if (!state) {
      state = { lastFile: -1, lastStart: -Infinity, voices: [] };
      this.states.set(cue, state);
    }
    return state;
  }

  private anyLoaded(files: readonly string[]): AudioBuffer | null {
    for (const file of files) {
      const buffer = this.bank.get(file);
      if (buffer) return buffer;
    }
    return null;
  }

  private prune(state: CueState, now: number): void {
    state.voices = state.voices.filter((v) => v.endsAt > now);
  }

  private totalVoices(): number {
    const now = this.ctx.currentTime;
    let total = 0;
    for (const state of this.states.values()) {
      this.prune(state, now);
      total += state.voices.length;
    }
    return total;
  }

  /** Fade a voice out quickly instead of cutting it, which would click. */
  private steal(voice: Voice, now: number): void {
    const g = voice.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + STEAL_FADE_S);
    try {
      voice.source.stop(now + STEAL_FADE_S + 0.01);
    } catch {
      // Already stopped: nothing to do.
    }
  }

  /** A stereo panner, or null where it is missing (older Safari) or not needed. */
  private panner(pan: number): StereoPannerNode | null {
    if (Math.abs(pan) < 0.01 || typeof this.ctx.createStereoPanner !== 'function') return null;
    const node = this.ctx.createStereoPanner();
    node.pan.value = Math.min(1, Math.max(-1, pan));
    return node;
  }
}

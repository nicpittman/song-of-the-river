/**
 * SampledAmbience: the looping recorded beds (river, wind, birds, insects, rain,
 * sea, fire...) and the occasional single calls placed among them.
 *
 * Each bed is one looping buffer source -> lowpass -> gain -> the ambience bus.
 * Levels are only ever moved with `setTargetAtTime`, which glides from wherever
 * the gain is; a gain that jumps would click. A bed whose level has sat at zero
 * for a while is stopped and its decoded audio released, because decoded beds
 * are large; it is decoded again the next time it is wanted.
 */
import { BEDS, SPOTS, type BedId, type SpotId } from './sfxManifest';
import type { SampleBank } from './samples';
import type { BedLevels } from './soundscape';

/** Below this a bed counts as silent. */
const SILENT = 0.002;
/** How long a silent bed keeps its decoded buffer before it is released. */
const RELEASE_AFTER_S = 45;
/** The waterfall is the river recording slowed down: deeper, heavier water. */
const WATERFALL_RATE = 0.72;
/** A bed that starts (or restarts after release) fades in over a couple of seconds. */
const FADE_IN_TAU = 0.6;

/**
 * Glide an AudioParam toward `value` with time constant `tau` seconds (about
 * 95% there after 3 tau), starting from its current value. Where
 * cancelAndHoldAtTime is missing (Firefox) `param.value` reports the current
 * computed value, which is pinned first so cancelling cannot make it jump.
 */
export function chaseParam(ctx: BaseAudioContext, param: AudioParam, value: number, tau: number): void {
  const now = ctx.currentTime;
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(now);
  } else {
    const current = param.value;
    param.cancelScheduledValues(now);
    param.setValueAtTime(current, now);
  }
  param.setTargetAtTime(value, now, Math.max(0.01, tau));
}

type VoiceId = BedId | 'waterfall';

class BedVoice {
  readonly gain: GainNode;
  readonly filter: BiquadFilterNode;
  source: AudioBufferSourceNode | null = null;
  target = 0;
  /** ctx time at which the target last fell to silence. */
  silentSince = 0;
  private requested = false;

  constructor(
    private readonly ctx: AudioContext,
    out: AudioNode,
    readonly file: string,
    private readonly loopStart: number,
    private readonly loopEnd: number,
    private readonly rate: number,
  ) {
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 12000;
    this.filter.Q.value = 0.5;
    this.filter.connect(this.gain);
    this.gain.connect(out);
  }

  get playing(): boolean {
    return this.source !== null;
  }

  /** Make sure the loop is running (decoding it first if need be). */
  ensure(bank: SampleBank): void {
    if (this.source || this.requested) return;
    this.requested = true;
    const accepted = bank.request(this.file, (buffer) => {
      this.requested = false;
      if (this.source || this.target <= SILENT) return;
      this.start(buffer);
    });
    // A file that failed to load leaves the synthesised fallback in place.
    if (!accepted) this.requested = false;
  }

  stop(): void {
    if (!this.source) return;
    try {
      this.source.stop();
    } catch {
      // Already stopped.
    }
    this.source.disconnect();
    this.source = null;
  }

  private start(buffer: AudioBuffer): void {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const end = Math.min(this.loopEnd, buffer.duration);
    source.loopStart = this.loopStart;
    source.loopEnd = end;
    source.playbackRate.value = this.rate;
    source.connect(this.filter);
    // Start somewhere inside the loop so beds that start together do not line up.
    const offset = this.loopStart + Math.random() * (end - this.loopStart);
    const at = this.ctx.currentTime + 0.02;
    source.start(at, offset);
    this.source = source;
    // The gain may already be at its target while the buffer was decoding: fade in from silence.
    const g = this.gain.gain;
    g.cancelScheduledValues(0);
    g.setValueAtTime(0, at);
    g.setTargetAtTime(this.target, at, FADE_IN_TAU);
  }
}

export class SampledAmbience {
  private readonly voices: Record<VoiceId, BedVoice>;
  private readonly spotBus: GainNode;
  private readonly lastSpotFile = new Map<SpotId, string>();

  constructor(
    private readonly ctx: AudioContext,
    private readonly bank: SampleBank,
    out: AudioNode,
  ) {
    const voice = (id: BedId, rate = 1): BedVoice => {
      const bed = BEDS[id];
      return new BedVoice(ctx, out, bed.file, bed.loopStart, bed.loopEnd, rate);
    };
    this.voices = {
      river: voice('river'),
      waterfall: voice('river', WATERFALL_RATE),
      wind: voice('wind'),
      birds: voice('birds'),
      dawn: voice('dawn'),
      cicadas: voice('cicadas'),
      crickets: voice('crickets'),
      frogs: voice('frogs'),
      rain: voice('rain'),
      sea: voice('sea'),
      fire: voice('fire'),
    };
    // Calls get a gentle top-end roll-off so they sit back in the scene.
    this.spotBus = ctx.createGain();
    const soften = ctx.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 6500;
    this.spotBus.connect(soften);
    soften.connect(out);
  }

  /** True once this bed's recording is actually sounding (so its synthesised stand-in can step aside). */
  playing(id: VoiceId): boolean {
    return this.voices[id].playing;
  }

  /** Glide every bed toward its level with time constant `tau` seconds. */
  setLevels(levels: BedLevels, cutoffs: { river: number; wind: number; waterfall: number }, tau: number): void {
    const now = this.ctx.currentTime;
    for (const id of Object.keys(this.voices) as VoiceId[]) {
      const v = this.voices[id];
      const target = Math.max(0, levels[id]);
      if (target > SILENT) v.ensure(this.bank);
      else if (v.target > SILENT) v.silentSince = now;
      if (Math.abs(target - v.target) > 1e-4) chaseParam(this.ctx, v.gain.gain, target, tau);
      v.target = target;
    }
    chaseParam(this.ctx, this.voices.river.filter.frequency, cutoffs.river, tau);
    chaseParam(this.ctx, this.voices.waterfall.filter.frequency, cutoffs.waterfall, tau);
    chaseParam(this.ctx, this.voices.wind.filter.frequency, cutoffs.wind, tau);
  }

  /** Stop and release beds that have been silent for a while. Call now and then. */
  releaseIdle(): void {
    const now = this.ctx.currentTime;
    const wanted = new Set<string>();
    for (const v of Object.values(this.voices)) {
      if (v.target > SILENT || now - v.silentSince < RELEASE_AFTER_S) wanted.add(v.file);
    }
    for (const v of Object.values(this.voices)) {
      if (wanted.has(v.file) || !v.playing) continue;
      v.stop();
      this.bank.release(v.file);
    }
  }

  /** One call from somewhere in the scene. Skipped quietly if its recording is not loaded. */
  playSpot(spot: SpotId, level: number): void {
    const sound = SPOTS[spot];
    const others = sound.files.filter((f) => f !== this.lastSpotFile.get(spot));
    const choices = others.length > 0 ? others : sound.files;
    const file = choices[Math.floor(Math.random() * choices.length)];
    const buffer = this.bank.get(file);
    if (!buffer) return;
    this.lastSpotFile.set(spot, file);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = Math.pow(2, ((Math.random() * 2 - 1) * 0.4) / 12);
    const gain = this.ctx.createGain();
    gain.gain.value = sound.gain * level * Math.pow(10, ((Math.random() * 2 - 1) * 2) / 20);
    source.connect(gain);
    let tail: AudioNode = gain;
    if (typeof this.ctx.createStereoPanner === 'function') {
      const pan = this.ctx.createStereoPanner();
      pan.pan.value = (Math.random() * 2 - 1) * 0.7;
      gain.connect(pan);
      tail = pan;
    }
    tail.connect(this.spotBus);
    source.onended = (): void => {
      gain.disconnect();
      tail.disconnect();
    };
    source.start(this.ctx.currentTime + 0.02);
  }

  dispose(): void {
    for (const v of Object.values(this.voices)) v.stop();
  }
}

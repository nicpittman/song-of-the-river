import { describe, expect, it } from 'vitest';
import { QUIET, QuietPace, lookaheadSeconds } from './quietPace';
import { newExpedition, plan } from './adventure/testing';
import { isShowing } from './adventure/sightings';
import { DAY_PLAY_SECONDS, DAY_SECONDS } from './adventure/calendar';

const FRAME = 1 / 60;

function run(pace: QuietPace, seconds: number, quiet: boolean, speed = 1): number[] {
  const out: number[] = [];
  for (let t = 0; t < seconds - 1e-9; t += FRAME) out.push(pace.step(FRAME, quiet, speed));
  return out;
}

describe('quiet stretches', () => {
  it('ease up gently after a moment of quiet, and back down quickly', () => {
    const pace = new QuietPace();
    const settling = run(pace, QUIET.settle - 0.05, true);
    expect(Math.max(...settling)).toBe(1);
    const rising = run(pace, QUIET.up + 0.1, true);
    // Never a jump: each frame changes the pace by only a little.
    for (let i = 1; i < rising.length; i++) expect(Math.abs(rising[i]! - rising[i - 1]!)).toBeLessThan(0.02);
    expect(pace.boost).toBeCloseTo(QUIET.boost, 5);
    const falling = run(pace, QUIET.down + 0.02, false);
    for (let i = 1; i < falling.length; i++) expect(falling[i]!).toBeLessThanOrEqual(falling[i - 1]!);
    expect(pace.boost).toBe(1);
  });

  it('holds while paused and never undoes or overshoots the player’s speed', () => {
    const pace = new QuietPace();
    run(pace, 4, true, 1);
    expect(pace.step(0, false, 1)).toBeCloseTo(QUIET.boost, 5);
    for (const speed of [1, 2, 4]) {
      const p = new QuietPace();
      const all = run(p, 5, true, speed);
      expect(Math.min(...all)).toBeGreaterThanOrEqual(1);
      expect(speed * Math.max(...all)).toBeLessThanOrEqual(Math.max(speed, QUIET.cap) + 1e-9);
    }
  });

  it('looks far enough ahead to be back to the usual pace before anything shows', () => {
    expect(QUIET.lookahead).toBeGreaterThan(QUIET.down);
    expect(lookaheadSeconds(3.2)).toBeCloseTo(QUIET.lookahead * 3.2);
  });

  it('change only how soon a day passes, never what happens in it', () => {
    const play = (boosted: boolean): { state: string; real: number; steps: number } => {
      const { sim, a } = newExpedition(7);
      a.assign(plan('sora', 'kamimori', 'track'));
      a.assign(plan('ren', 'suisha', 'explore'));
      a.rest('mina');
      a.begin();
      let state = '';
      let steps = 0;
      const step = sim.step.bind(sim);
      sim.step = () => {
        const was = a.state.phase;
        step();
        steps++;
        if (!state && was === 'day' && a.state.phase !== 'day') state = JSON.stringify(a.state);
      };
      const pace = new QuietPace();
      let real = 0;
      // Frames of uneven length, quiet whenever no creature is showing.
      for (let i = 0; i < 20000 && !state; i++) {
        const dt = FRAME * (0.6 + ((i * 7919) % 13) / 13);
        const quiet = boosted && !a.state.sightings.some((x) => isShowing(x, a.state.elapsed));
        const rate = (DAY_SECONDS / DAY_PLAY_SECONDS) * pace.step(dt, quiet, 1);
        sim.advance(dt * rate);
        real += dt;
      }
      return { state, real, steps };
    };
    const usual = play(false);
    const quick = play(true);
    expect(usual.state).not.toBe('');
    expect(quick.state).toBe(usual.state);
    expect(quick.steps).toBe(usual.steps);
    expect(quick.real).toBeLessThan(usual.real);
  });
});

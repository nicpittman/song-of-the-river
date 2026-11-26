/**
 * Travellers. One figure per simulated agent, placed from the simulation's
 * positions each frame with a little life added on top: a walking bob for
 * deer and villagers, a swimming wriggle for fish under the water, a beating
 * chevron for a flock overhead.
 */

import { flockOffset, flockBank } from './flockPose';
import { dampAngle } from '../core/math';
import { Container, Sprite, type Texture } from 'pixi.js';
import type { Agent } from '../simulation/simulation';
import type { ArtLibrary } from './art';

interface Figure {
  /** The sprite, or for a flock the container holding its birds. */
  body: Container;
  birds: Sprite[];
  flight?: { heading: number; bank: number; offsets: Array<{x:number;y:number}> };
  baseScale: number;
  phase: number;
  /** The illustration faces left; procedural figures have no facing. */
  facesLeft: boolean;
  flipped: boolean;
  /** How high a flock is flying, 0 (settled) to 1. */
  aloft: number;
  /** Walk-cycle textures, if this traveller has them; otherwise it is a single still image. */
  cycle: Texture[];
}

const VILLAGER_ART = ['villager', 'farmer', 'traveller'];
/** Walkers with a side-on walk cycle (drawn facing right), used in place of the still figures once painted. */
const WALKERS = ['villager-walk', 'villager-farmer-walk', 'villager-walk', 'villager-woman-walk', 'villager-elder-walk'];
const DEER = ['deer-walk', 'deer-walk', 'stag-walk', 'deer-walk', 'fawn-walk'];
const FLOCK = 7;
/** World pixels a flock is drawn above the ground it is crossing. */
const ALTITUDE = 38;

export interface AgentLayers {
  /** Depth-sorted with the scenery: deer and villagers. */
  land: Container;
  /** On the water, under bridges and trees: fish. */
  water: Container;
  /** Above everything: birds. */
  sky: Container;
}

export class AgentLayer {
  private readonly figures = new Map<number, Figure>();

  constructor(
    private readonly layers: AgentLayers,
    private readonly art: ArtLibrary,
  ) {}

  /**
   * `zoom` is the camera zoom. Seen from far off, travellers are drawn larger
   * than life so a journey can be followed across the whole valley; close up
   * they settle to their true size.
   */
  update(dt: number, agents: readonly Agent[], paused: boolean, zoom: number): void {
    const seen = new Set<number>();
    const boost = Math.min(2, Math.max(1, 0.8 / zoom));
    for (const agent of agents) {
      seen.add(agent.id);
      let figure = this.figures.get(agent.id);
      if (!figure) {
        figure = this.create(agent);
        this.figures.set(agent.id, figure);
      }
      const still = agent.phase === 'hesitating' || agent.phase === 'resting' || paused;
      if (agent.traveller === 'fish') this.swim(figure, agent, dt, still, boost);
      else if (agent.traveller === 'bird') this.fly(figure, agent, dt, agent.phase === 'hesitating' || agent.phase === 'resting', paused, boost);
      else this.walk(figure, agent, dt, still, boost);
      figure.body.alpha = Math.min(agent.traveller === 'fish' ? 0.86 : 1, figure.body.alpha + dt * 1.6);
    }
    for (const [id, figure] of this.figures) {
      if (seen.has(id)) continue;
      figure.body.alpha -= dt * 1.8;
      if (figure.body.alpha <= 0) {
        figure.body.destroy({ children: true });
        this.figures.delete(id);
      }
    }
  }

  private walk(figure: Figure, agent: Agent, dt: number, still: boolean, boost: number): void {
    const deer = agent.traveller === 'deer';
    if (!still) figure.phase += dt * (deer ? 11 : 9);
    const hop = still ? 0 : Math.abs(Math.sin(figure.phase)) * (deer ? 3.2 : 1.6);
    const body = figure.body;
    body.position.set(agent.x, agent.y - hop);
    body.zIndex = agent.y;
    if (figure.cycle.length) {
      // Step through the walk; standing still shows the first frame.
      const frame = still ? 0 : Math.floor(figure.phase / (deer ? 2.6 : 2.2)) % figure.cycle.length;
      (body as Sprite).texture = figure.cycle[frame]!;
    }
    const heading = Math.cos(agent.angle);
    if (Math.abs(heading) > 0.15) figure.flipped = heading > 0 === figure.facesLeft;
    body.scale.set(figure.baseScale * boost * (figure.flipped ? -1 : 1), figure.baseScale * boost);
    body.rotation = still ? 0 : Math.sin(figure.phase) * 0.035;
  }

  private swim(figure: Figure, agent: Agent, dt: number, still: boolean, boost: number): void {
    figure.phase += dt * (still ? 4 : 9);
    const body = figure.body;
    body.position.set(agent.x, agent.y);
    // The tail sweeps; a fish holding station below an obstacle still works against the current.
    body.rotation = agent.angle + Math.sin(figure.phase) * 0.16;
    body.scale.set(figure.baseScale * boost);
  }

  private fly(figure: Figure, agent: Agent, dt: number, settled: boolean, paused: boolean, boost: number): void {
    if (!paused) figure.phase += dt * (settled ? 3 : 9);
    if(!paused)figure.aloft += ((settled ? 0 : 1) - figure.aloft) * Math.min(1, dt * 2.5);
    const body = figure.body;
    body.position.set(agent.x, agent.y - ALTITUDE * figure.aloft);
    // The formation turns; the painterly bird silhouettes remain upright.
    const flight = figure.flight!;
    const previous = flight.heading;
    if (!paused && !settled) flight.heading = dampAngle(previous, agent.angle, 5, dt);
    if (!paused) flight.bank = flockBank(previous, flight.heading) * figure.aloft;
    const bank = flight.bank;
    body.rotation = 0;
    body.scale.set(boost * (0.7 + 0.3 * figure.aloft));
    const up = this.art.get('bird-up').texture;
    const down = this.art.get('bird-down').texture;
    figure.birds.forEach((bird, i) => {
      const beat = Math.sin(figure.phase + i * 0.9);
      bird.texture = settled ? down : beat > 0 ? up : down;
      const p = flockOffset(flight.offsets[i]!, flight.heading);
      bird.position.set(p.x, p.y);
      bird.rotation = settled ? Math.sin(i * 2.4) * 0.04 : bank;
    });
  }

  private create(agent: Agent): Figure {
    if (agent.traveller === 'bird') return this.createFlock(agent);
    const fish = agent.traveller === 'fish';
    const deer = agent.traveller === 'deer';
    // Prefer a side-on walk cycle, which can face either way; fall back to the still figure.
    const walker = deer ? DEER[agent.id % DEER.length]! : WALKERS[agent.id % WALKERS.length]!;
    const available = [walker, deer ? 'deer-walk' : 'villager-walk'].map((prefix) => this.art.frames(prefix)).find((frames) => frames.length > 0);
    const cycle = fish || !available ? [] : available.map((id) => this.art.get(id).texture);
    const still = fish ? (this.art.has('salmon') ? 'salmon' : agent.id % 3 === 0 ? 'fish-pale' : 'fish') : deer ? 'deer' : VILLAGER_ART[agent.id % VILLAGER_ART.length]!;
    const art = this.art.get(cycle.length ? available![0]! : still);
    const sprite = new Sprite(art.texture);
    sprite.anchor.set(art.anchor[0], art.anchor[1]);
    // Wildlife is drawn a little over life size so it stays readable when the whole valley is in view.
    const size = fish ? 1.15 + (agent.id % 3) * 0.12 : cycle.length ? 1.1 : deer ? 0.9 + (agent.id % 3) * 0.06 : 1.25;
    sprite.width = art.width * size;
    sprite.height = art.height * size;
    sprite.alpha = 0;
    (fish ? this.layers.water : this.layers.land).addChild(sprite);
    return {
      body: sprite,
      birds: [],
      baseScale: Math.abs(sprite.scale.x),
      phase: agent.id * 1.7,
      // Walk cycles and painted stand-ins face right; the illustrated standing deer faces left.
      facesLeft: art.illustrated && !fish && !cycle.length,
      flipped: false,
      aloft: 1,
      cycle,
    };
  }

  private createFlock(agent: Agent): Figure {
    const body = new Container();
    const art = this.art.get('bird-up');
    const birds: Sprite[] = [];
    for (let i = 0; i < FLOCK; i++) {
      const bird = new Sprite(art.texture);
      bird.anchor.set(0.5);
      bird.width = art.width;
      bird.height = art.height;
      // A loose chevron behind the leader.
      const row = Math.ceil(i / 2);
      const wing = i % 2 === 0 ? 1 : -1;
      bird.position.set(wing * row * 24 + ((agent.id * 7 + i * 13) % 9) - 4, row * 20 + ((agent.id * 5 + i * 11) % 7) - 3);
      body.addChild(bird);
      birds.push(bird);
    }
    body.alpha = 0;
    this.layers.sky.addChild(body);
    return { body, birds, flight: { heading: agent.angle, bank: 0, offsets: birds.map(b=>({x:b.x,y:b.y})) }, baseScale: 1, phase: agent.id * 1.3, facesLeft: false, flipped: false, aloft: 1, cycle: [] };
  }
}

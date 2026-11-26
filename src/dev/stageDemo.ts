import '../styles/fonts.css';
/**
 * The demo stage (`stage.html`): the real valley picture with the adventure
 * layer fed a scripted scene (`stageScript.ts`), no expedition rules at all.
 * Not part of the shipped game.
 *
 * Query options:
 *   t=<s>        start the script at this time
 *   rate=<k>     script speed (default 1)
 *   hold         freeze the script clock (figures still breathe and move about)
 *   season=<0-3> spring, summer, autumn, winter
 *   x, y, z      camera centre and zoom
 *   reduced      reduced motion
 *   level=<l>    the river standing low, middle or high
 *   heavy        five friends, four sightings and eight buildings, for profiling
 *   grid         world coordinate grid, for placing things
 *   sheet        contact sheet of every explorer frame instead (see `stageSheet.ts`)
 *
 * `window.__stage.at(t)` jumps the script; `window.__ready` is set once drawn.
 */

import { Application, Graphics, Text } from 'pixi.js';
import type { AdventureScene } from '../game/adventure/model';
import { ArtLibrary } from '../game/rendering/art';
import { ValleyView } from '../game/rendering/view';
import { Simulation, TICK, newGameState } from '../game/simulation/simulation';
import { adventureValley } from '../game/world/boards/adventure';
import type { Season } from '../game/world/types';
import { CAMERA, LENGTH, hourAt, sceneAt } from './stageScript';

interface StageHandle {
  at(t: number): void;
  time(): number;
}

const query = new URLSearchParams(location.search);
const ready = (): void => {
  (window as unknown as { __ready: boolean }).__ready = true;
};

async function fontsLoaded(): Promise<void> {
  await Promise.all([document.fonts.load("600 32px 'Cormorant Garamond'"), document.fonts.load("500 32px 'Cormorant Garamond'")]);
}

function drawGrid(view: ValleyView): void {
  const g = new Graphics();
  for (let x = 0; x <= 2400; x += 100) g.moveTo(x, -200).lineTo(x, 2600).stroke({ color: x % 500 ? 0xffffff : 0xff3030, width: 1, alpha: 0.6 });
  for (let y = -200; y <= 2600; y += 100) g.moveTo(0, y).lineTo(2400, y).stroke({ color: y % 500 ? 0xffffff : 0xff3030, width: 1, alpha: 0.6 });
  view.world.addChild(g);
  for (let x = 0; x <= 2400; x += 200) {
    for (let y = 0; y <= 2600; y += 200) {
      const label = new Text({ text: `${x},${y}`, style: { fontSize: 14, fill: 0xffffff, stroke: { color: 0, width: 3 } } });
      label.position.set(x + 3, y + 3);
      view.world.addChild(label);
    }
  }
}

function clockText(t: number): string {
  const h = hourAt(t);
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${t.toFixed(1)} s · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

async function main(): Promise<void> {
  await fontsLoaded();
  if (query.has('sheet')) {
    const { showSheet } = await import('./stageSheet');
    const poses = (query.get('poses') ?? 'idle,walk,carry,fish,forage,look,talk,build,sit,wave,tend').split(',') as never[];
    showSheet(Number(query.get('zoom') ?? 2), poses);
    ready();
    return;
  }

  const stage = document.getElementById('stage')!;
  const app = new Application();
  await app.init({ preference: 'webgl', resizeTo: stage, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2), backgroundColor: 0xdfe6e0 });
  stage.appendChild(app.canvas);
  const art = new ArtLibrary();
  await art.load('./art/', () => {});

  // The valley in free play, so every reach is open; the season set by its clock.
  const season = Number(query.get('season') ?? 0) as Season;
  const state = newGameState(adventureValley, 'free');
  const sim = new Simulation(adventureValley, state);
  state.tick = Math.round((season * sim.seasonSeconds + 1) / TICK);
  const view = new ValleyView(app, art, sim);
  view.setReducedMotion(query.has('reduced'));

  // The script publishes a new scene ten times a second, as the rules will.
  let t = Number(query.get('t') ?? 0);
  const rate = query.has('hold') ? 0 : Number(query.get('rate') ?? 1);
  const heavy = query.has('heavy');
  const level = query.get('level') as AdventureScene['level'] | null;
  const script = (at: number): AdventureScene => ({ ...sceneAt(at, heavy), ...(level ? { level } : {}) });
  let scene: AdventureScene = script(t);
  let published = Math.floor(t * 10);
  const layer = view.attachAdventure(() => scene);
  (window as unknown as { __layer: unknown; __view: unknown }).__layer = layer;
  (window as unknown as { __view: unknown }).__view = view;

  const zoom = Number(query.get('z') ?? CAMERA.zoom);
  view.camera.focus(Number(query.get('x') ?? CAMERA.x), Number(query.get('y') ?? CAMERA.y), zoom);
  view.camera.rate = 1000;
  if (query.has('grid')) drawGrid(view);

  const clock = document.getElementById('clock');
  app.ticker.add((ticker) => {
    const dt = Math.min(0.1, ticker.deltaMS / 1000);
    t = (t + dt * rate) % LENGTH;
    if (Math.floor(t * 10) !== published) {
      published = Math.floor(t * 10);
      scene = script(t);
    }
    view.update(dt);
    if (clock) clock.textContent = clockText(t);
  });

  const handle: StageHandle = {
    at: (to) => {
      t = to;
      scene = script(t);
    },
    time: () => t,
  };
  (window as unknown as { __stage: StageHandle }).__stage = handle;
  ready();
}

void main();

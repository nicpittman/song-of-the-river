/**
 * Entry point: load the art, wait for the player's first tap (which also
 * unlocks audio), then hand over to the game.
 */

import { Application } from 'pixi.js';
import { AudioDirector } from './game/audio/audio';
import { Game } from './game/game';
import { ArtLibrary, type LoadingStage } from './game/rendering/art';
import { createUi, type Ui } from './ui/ui';
import { prebakeGround } from './game/rendering/groundBake';
import { adventureValley } from './game/world/boards/adventure';
import { renderResolution } from './game/rendering/renderBudget';
// Phone sizes last, so they win over the earlier sheets' small-screen rules.
import './styles/phone.css';

async function boot(): Promise<void> {
  const stage = document.getElementById('stage')!;
  const art = new ArtLibrary();
  const audio = new AudioDirector({ music: 0.42, sfx: 0.5 });
  // Network and terrain preparation can run while WebGL initializes too.
  const loading: { fraction: number; stage?: LoadingStage; ui: Ui | null } = { fraction: 0, ui: null };
  const groundReady = prebakeGround(adventureValley);
  const artReady = art.load('./art/', (fraction, stage) => {
    loading.fraction = fraction;
    loading.stage = stage;
    loading.ui?.setLoading(fraction, stage);
  });

  const app = new Application();
  await app.init({
    preference: 'webgl',
    resizeTo: stage,
    antialias: true,
    autoDensity: true,
    // Retain native pixels; bound extra Retina work on large displays.
    resolution: renderResolution(stage.clientWidth, stage.clientHeight, window.devicePixelRatio),
    backgroundColor: 0xdfe6e0,
    powerPreference: 'low-power',
  });
  stage.appendChild(app.canvas);
  vividOnWideScreens(app);
  app.renderer.on('resize', (width: number, height: number) => {
    const resolution = renderResolution(width, height, window.devicePixelRatio);
    if (Math.abs(app.renderer.resolution - resolution) > .01) app.renderer.resize(width, height, resolution);
  });

  const game = new Game(app, art, audio);
  const ui = createUi(document.getElementById('ui') ?? document.body.appendChild(Object.assign(document.createElement('div'), { id: 'ui' })), game.actions, game.menuModel());
  game.attach(ui);
  loading.ui = ui;
  ui.setLoading(loading.fraction, loading.stage);

  // Reuse the worker's maps rather than triggering a second, synchronous bake.
  await Promise.all([groundReady, artReady]);
  if (art.missing.length) console.info(`Song of the River: ${art.missing.length} art files could not be loaded; drawing stand-ins.`);
  game.showMenu();

  // Development shortcuts: ?play jumps straight into the first valley, and the game is exposed for tests.
  const params = new URLSearchParams(location.search);
  if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
  if (import.meta.env.DEV && params.has('play')) {
    ui.setLoading(1);
    void ui.loadingDone();
    // Scripts that drive the game skip the slow open of a new Journey; `?play&opening` keeps it.
    game.skipOpening = !params.has('opening');
    if (params.has('finale')) void game.startFinale();
    else game.actions.startJourney('river-adventure');
    return;
  }
  await ui.loadingDone();
  audio.unlock();
}

/**
 * Phones and recent Macs have wide-gamut (P3) screens, where a plain sRGB canvas looks a little washed
 * out beside native apps. On those screens the canvas is drawn in Display P3 while the art keeps its
 * values, so its colours read a touch richer; ordinary screens are untouched. Costs nothing per frame.
 */
function vividOnWideScreens(app: Application): void {
  // `?srgb` keeps the plain canvas, to compare the two.
  if (!window.matchMedia?.('(color-gamut: p3)').matches || new URLSearchParams(location.search).has('srgb')) return;
  const gl = (app.renderer as unknown as { gl?: WebGL2RenderingContext }).gl;
  if (gl && 'drawingBufferColorSpace' in gl) gl.drawingBufferColorSpace = 'display-p3';
}

/** If the game cannot start (WebGL blocked, no GPU), say so on the paper rather than loading forever. */
function cannotStart(error: unknown): void {
  console.error('Song of the River could not start.', error);
  const note = document.createElement('div');
  note.setAttribute('role', 'alert');
  note.style.cssText = 'position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:24px;text-align:center;'
    + 'background:radial-gradient(ellipse 85% 75% at 50% 44%,#ece5d3 0%,#ded6bf 58%,#cbc2a7 100%);color:#3b4a44;'
    + 'font:italic 20px/1.5 "Cormorant Garamond",Georgia,serif;';
  note.innerHTML = '<p style="max-width:28em;margin:0">The river could not be drawn in this browser.<br>'
    + 'Try turning on hardware acceleration, or opening the game in another browser.</p>';
  document.body.appendChild(note);
}

boot().catch(cannotStart);

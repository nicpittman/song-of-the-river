/** Dedicated dev entry; not imported by the game and not an input to the release build. */
import { Application, type Container } from 'pixi.js';
import { AudioDirector } from '../game/audio/audio';
import { Game } from '../game/game';
import { ArtLibrary } from '../game/rendering/art';
import { createUi } from '../ui/ui';
import { prebakeGround } from '../game/rendering/groundBake';
import { adventureValley } from '../game/world/boards/adventure';
import { type ReviewStage } from '../game/adventure/review';
import { FrameProbe } from './profiling/probe';
import { renderResolution } from '../game/rendering/renderBudget';
import type { Distribution } from './profiling/metrics';
import '../styles/phone.css';

type Measurement = Awaited<ReturnType<FrameProbe['sample']>>;
interface Row extends Measurement { name: string; setupMs: number; resolution: number; framebuffer: number[]; camera: { x: number; y: number; zoom: number } }
interface ProfileReport {
  version: 1; status: 'running' | 'complete' | 'failed'; createdAt: string;
  environment: Record<string, unknown>; rows: Row[]; notes: string[]; errors: string[];
}
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = element('status'), run = element<HTMLButtonElement>('run'), download = element<HTMLButtonElement>('download');
const progress = element<HTMLProgressElement>('progress'), measurements = element('measurements');
const params = new URLSearchParams(location.search);
// Fast mode is for checking the harness, not for performance conclusions.
const warmup = params.has('smoke') ? 250 : 1500, duration = params.has('smoke') ? 500 : 3500;
let report: ProfileReport | null = null;
let lastFile = '';
let running = false;
let resized = false;
window.addEventListener('resize', () => { if (running) resized = true; });

function showResults(): void {
  if (!report) return;
  const ms = (d: Distribution | null) => d ? d.p95.toFixed(2) : 'unavailable';
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  for (const name of ['Scene', 'FPS', 'CPU p95', 'GPU p95', 'Draws p95']) head.append(Object.assign(document.createElement('th'), { textContent: name }));
  for (const row of report.rows) {
    const tr = table.createTBody().insertRow();
    for (const text of [row.name, row.renderedFps.toFixed(1), ms(row.cpuMs), ms(row.gpuMs), String(row.draws?.p95 ?? 0)]) tr.insertCell().textContent = text;
  }
  measurements.replaceChildren(table);
}
async function saveReport(): Promise<void> {
  if (!report) return;
  try {
    const response = await fetch('/__river_profile/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(report) });
    if (!response.ok) throw new Error(`Report endpoint returned ${response.status}`);
    const saved = await response.json() as { file: string }; lastFile = saved.file;
  } catch (error) {
    const message = `Automatic local save failed; use Download report. ${String(error)}`;
    if (!report.errors.includes(message)) report.errors.push(message);
  }
}

async function boot(): Promise<void> {
  const app = new Application();
  await app.init({ preference: 'webgl', resizeTo: element('stage'), antialias: true, autoDensity: true,
    resolution: renderResolution(element('stage').clientWidth, element('stage').clientHeight, devicePixelRatio), backgroundColor: 0xdfe6e0, powerPreference: 'low-power' });
  element('stage').append(app.canvas);
  const art = new ArtLibrary(), audio = new AudioDirector({ music: 0, sfx: 0 });
  const game = new Game(app, art, audio);
  // Review scenes already avoid saves. This hard guard also covers the menu and pagehide.
  // It exists only on this disposable profiler's Game instance, never in the released game.
  (game as unknown as { persist(): void }).persist = () => {};
  const ui = createUi(element('ui'), game.actions); game.attach(ui);
  prebakeGround(adventureValley);
  await art.load('./art/', fraction => { ui.setLoading(fraction); status.textContent = `Loading art · ${Math.round(fraction * 100)}%`; });
  game.showMenu(); await ui.loadingDone();
  const gl = app.canvas.getContext('webgl2');
  if (!gl) throw new Error('WebGL 2 is unavailable. This page cannot collect GPU queries on this browser.');
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = String(debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  status.textContent = `Ready · ${renderer}. Run once, then leave the tab in front.`; run.disabled = false;
  const closeBook = () => { element('ui').querySelector<HTMLElement>('.nb-spread.is-open .nb-book-close')?.click(); };
  const ensurePaused = () => { if (!(game as unknown as { paused: boolean }).paused) game.actions.togglePause(); };
  let activeProbe: FrameProbe | null = null;
  const prepare = async (stage: ReviewStage, day = false) => {
    activeProbe?.resetSections();
    if (!game.actions.reviewStage) throw new Error('Review scenes are unavailable.');
    game.actions.reviewStage(stage);
    closeBook();
    const rules = game.debug.sim.expedition!;
    if (day) {
      const view = rules.view();
      const stops = view.region === 1 ? ['nishibayashi', 'kurumaya', 'ringozaka', 'toroya'] : ['kawaguchi', 'fish-traps', 'matsubara', 'funaya', 'takayuka', 'east-marsh'];
      for (const [i, friend] of view.friends.entries()) {
        const place = view.places.find(place => place.id === stops[i % stops.length]); if (!place) continue;
        const activity = place.activities.includes(friend.gift) ? friend.gift : place.activities[0]!;
        game.actions.expedition({ type: 'assign', plan: { person: friend.id, place: place.id, activity, item: null, companion: null } });
      }
      if (!rules.state.plans.length) game.actions.expedition({ type: 'rest', person: rules.state.people[0]!.id });
      const answer = game.actions.expedition({ type: 'begin' });
      if (answer && !answer.ok) throw new Error(`Could not prepare ${stage}: ${answer.reason}`);
      closeBook();
    } else ensurePaused();
    const at = stage === 'coast' ? { x: 1580, y: 5640, zoom: .66 } : { x: 1080, y: 3400, zoom: .58 };
    const camera = game.debug.view!.camera;
    camera.focus(at.x, at.y, at.zoom); camera.snap();
  };
  const suite = async () => {
    if (running) return;
    running = true; resized = false; run.disabled = true; download.hidden = true;
    const probe = new FrameProbe(app, gl); activeProbe = probe;
    report = { version: 1, status: 'running', createdAt: new Date().toISOString(), rows: [], errors: [], notes: [
      'GPU timings use asynchronous EXT_disjoint_timer_query_webgl2. Missing or invalid timings stay null; CPU time is never labelled GPU time.',
      'GPU time covers Pixi WebGL commands, not the browser compositor, CSS backdrop filters, display scanout, VRAM, temperature or system-wide GPU utilisation.',
      'CPU sections are inclusive. Do not add nested sections together. Instrumentation has some overhead; compare like-for-like rows.',
      'Layer comparisons pause the same Mio scene and hold its camera. Disabling a layer measures its draw cost; its update logic still runs.',
      'This is the current device/browser/viewport only. A narrow desktop viewport is not a real phone benchmark.',
    ], environment: { userAgent: navigator.userAgent, renderer, vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      webglVersion: gl.getParameter(gl.VERSION), timerQuerySupported: probe.gpuSupported,
      softwareRenderer: /swiftshader|llvmpipe|softpipe|software raster/i.test(renderer),
      viewport: [innerWidth, innerHeight], devicePixelRatio, startingResolution: app.renderer.resolution,
      contextAttributes: gl.getContextAttributes(), hardwareConcurrency: navigator.hardwareConcurrency,
      smokeTest: params.has('smoke'), warmupMs: warmup, sampleMs: duration,
    } };
    if (!probe.gpuSupported) report.notes.push('This browser does not expose GPU timer queries. Frame, draw-count and CPU data are still useful; GPU conclusions require another capture.');
    const cleanupSections: Array<() => void> = [];
    // Restore wrappers before a review stage destroys its previous view.
    const instrument = () => {
      const view = game.debug.view!;
      probe.section(view, 'update', 'world.update'); probe.section(view.ground, 'update', 'ground.update');
      const internals = view as unknown as Record<string, object>;
      for (const name of ['scenery', 'ambience', 'wildlife', 'waterfalls', 'backdrop']) if (internals[name]) probe.section(internals[name]!, 'update', `${name}.update`);
      if (view.adventure) probe.section(view.adventure, 'sync', 'adventure.sync');
    };
    let count = 0;
    const capture = async (name: string, setup?: () => void | Promise<void>) => {
      status.textContent = `${++count}/13 · ${name} · warming up`; progress.value = (count - 1) / 13;
      const before = performance.now(); await setup?.();
      const setupMs = performance.now() - before;
      await wait(warmup);
      status.textContent = `${count}/13 · ${name} · measuring`;
      const measurement = await probe.sample(duration);
      if (resized) throw new Error('The window was resized during the run. Start again at a fixed size.');
      const camera = game.debug.view!.camera;
      report!.rows.push({ ...measurement, name, setupMs, resolution: app.renderer.resolution,
        framebuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight], camera: { x: camera.x, y: camera.y, zoom: camera.zoom } });
      showResults(); await saveReport();
    };
    let restoreCamera: (() => void) | undefined;
    try {
      await capture('Menu', () => { probe.resetSections(); game.showMenu(); instrument(); });
      await capture('Settings', () => { probe.resetSections(); game.showMenu(true); instrument(); });
      await capture('Mio · travelling', async () => { await prepare('mio', true); instrument(); });
      await capture('Coast · travelling', async () => { await prepare('coast', true); instrument(); });
      await capture('Full map · notebook', async () => { await prepare('full-map'); ui.openNotebook('plan'); instrument(); });
      await capture('Full map · scrolling', () => {
        const map = element('ui').querySelector<HTMLElement>('.nb-board');
        if (!map) throw new Error('The full-map notebook did not open.');
        let active = true;
        const scroll = (now: number) => { if (!active) return; map.scrollTop = (map.scrollHeight - map.clientHeight) * (.5 + .5 * Math.sin(now / 950)); requestAnimationFrame(scroll); };
        requestAnimationFrame(scroll); cleanupSections.push(() => { active = false; });
      });
      cleanupSections.forEach(cleanup => cleanup());
      await prepare('mio'); closeBook();
      const view = game.debug.view!, camera = view.camera;
      await wait(warmup);
      const updateCamera = camera.update;
      camera.update = () => {}; restoreCamera = () => { camera.update = updateCamera; };
      instrument();
      await capture('A/B · full scene before');
      const disable = async (name: string, target: Container) => {
        const was = target.renderable; target.renderable = false;
        try { await capture(name); } finally { target.renderable = was; }
      };
      await disable('A/B · ground off', view.ground.mesh);
      await disable('A/B · shadows off', view.shadows);
      await disable('A/B · scenery & figures off', view.sorted);
      await disable('A/B · weather off', view.weatherLayer);
      const resolution = app.renderer.resolution;
      try {
        app.renderer.resize(app.screen.width, app.screen.height, 1);
        await capture('A/B · resolution 1x');
      } finally { app.renderer.resize(app.screen.width, app.screen.height, resolution); }
      await capture('A/B · full scene after');
      report.status = 'complete'; progress.value = 1;
      await saveReport();
      status.textContent = `Complete. ${lastFile ? `Saved locally: ${lastFile}` : 'Download the report below.'}${!probe.gpuSupported ? ' GPU timers unavailable on this browser.' : ''}`;
    } catch (error) {
      report.status = 'failed'; report.errors.push(String(error)); status.textContent = `Capture stopped: ${String(error)}`; await saveReport();
    } finally {
      cleanupSections.forEach(cleanup => cleanup()); restoreCamera?.(); probe.dispose(); activeProbe = null;
      running = false; run.disabled = false; download.hidden = false;
    }
  };
  run.addEventListener('click', () => { void suite(); });
  download.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'song-of-the-river-gpu-profile.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  // An automation uses this same page and suite; no alternative renderer or fake scenes.
  Object.assign(window, { __riverGpuProfile: { run: suite, get report() { return report; } } });
}
if (import.meta.env.DEV) void boot().catch(error => { status.textContent = `Profiler unavailable: ${String(error)}`; console.error(error); });
else status.textContent = 'This diagnostic is available only on the local development server.';

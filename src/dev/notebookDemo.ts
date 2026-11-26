/**
 * The notebook demo (`notebook.html?state=<name>`): the real expedition
 * interface mounted over a still of the valley, driven by hand-written
 * fixtures and a pretend rules engine, so the notebook can be designed and
 * felt while the real rules are elsewhere.
 *
 * Query options: `state` (see `STATE_NAMES`), `shot` (hide the state picker,
 * for screenshots), `fold` (on the map state, unfold the newest reach), and
 * `real=<name>` to load a snapshot saved from the real rules into
 * `src/dev/fixtures/real/<name>.json` (a local folder, not part of the game).
 */

import type { AdventureCommand, AdventureView, Cue, ScreenTag } from '../game/adventure/model';
import type { UiActions } from '../ui/contract';
import { createUi } from '../ui/ui';
import { DemoRules } from './fixtures/sim';
import { type Backdrop, STATE_NAMES, type StateName, buildState } from './fixtures/states';

/** The backdrop picture's size, and how much of its bottom edge to crop (a stray caption sits there). */
const PICTURE = { width: 1440, height: 860, crop: 48, src: '/shots/c-meadow.png' };

const params = new URLSearchParams(location.search);
const requested = params.get('state') ?? 'morning';
const stateName: StateName = (STATE_NAMES as readonly string[]).includes(requested) ? (requested as StateName) : 'morning';
const demo = buildState(stateName);

/** Snapshots saved from the real rules, when the local folder has any. */
const REAL = import.meta.glob<AdventureView>('./fixtures/real/*.json', { import: 'default' });
const realName = params.get('real');
/** In real mode tags are in board units; this is the board point at the centre of the screen. */
let realCamera: { x: number; y: number } | null = null;

const stage = document.getElementById('stage')!;
stage.style.backgroundImage = `url(${PICTURE.src})`;

/** The still covers the window like the canvas would: scale and offset, shared by tags. */
function pictureFrame(): { scale: number; x: number; y: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = Math.max(vw / PICTURE.width, vh / (PICTURE.height - PICTURE.crop));
  return { scale, x: (vw - PICTURE.width * scale) / 2, y: 0 };
}

function layoutBackdrop(): void {
  const f = pictureFrame();
  stage.style.backgroundSize = `${PICTURE.width * f.scale}px ${PICTURE.height * f.scale}px`;
  stage.style.backgroundPosition = `${f.x}px ${f.y}px`;
}
window.addEventListener('resize', layoutBackdrop);
layoutBackdrop();

function setBackdrop(b: Backdrop): void {
  document.body.dataset.backdrop = b;
}
setBackdrop(demo.backdrop);

const log = (...args: unknown[]): void => console.debug('[notebook demo]', ...args);

let rules: DemoRules;
const actions: UiActions = {
  expedition: (c: AdventureCommand) => {
    log('command', c);
    rules.command(c);
  },
  cue: (c: Cue) => log('cue', c),
  startJourney: () => undefined,
  startFreePlay: () => undefined,
  continueGame: () => undefined,
  togglePause: () => {
    rules.view.paused = !rules.view.paused;
    push();
  },
  setSpeed: (s) => {
    rules.view.speed = s;
    push();
  },
  skipSeason: () => undefined,
  undo: () => undefined,
  redo: () => undefined,
  fitView: () => undefined,
  showPlaces: () => undefined,
  toggleRoutes: () => undefined,
  chooseIdentity: () => undefined,
  removeSelected: () => undefined,
  openJournal: () => ui.openNotebook('journal'),
  reviewObjective: () => undefined,
  openMenu: () => log('menu'),
  setVolumes: () => undefined,
  setReducedMotion: () => undefined,
  resetProgress: () => undefined,
  keepWatching: () => undefined,
  retry: () => undefined,
  nextValley: () => undefined,
  toMenu: () => undefined,
  gesture: () => undefined,
};

const ui = createUi(document.getElementById('ui')!, actions);

function push(): void {
  // A fresh snapshot object each time, as the rules will send.
  ui.updateAdventure({ ...rules.view });
}

rules = new DemoRules(demo.view, push, setBackdrop, (c) => ui.openNotebook(c.page, c.person, c.place));

/** Pins the fixture's tags to the still, with a slow drift to show that they follow the valley exactly. */
function screenTags(time: number): ScreenTag[] {
  const f = pictureFrame();
  const driftX = Math.sin(time / 2400) * 6;
  const driftY = Math.cos(time / 3100) * 4;
  stage.style.backgroundPosition = `${f.x + driftX}px ${f.y + driftY}px`;
  return rules.view.tags.map((t) => {
    const x = realCamera ? t.anchor.x - realCamera.x + window.innerWidth / 2 + driftX : t.anchor.x * f.scale + f.x + driftX;
    const y = realCamera ? t.anchor.y - realCamera.y + window.innerHeight * 0.4 + driftY : t.anchor.y * f.scale + f.y + driftY;
    return { ...t, x, y, visible: x > -40 && x < window.innerWidth + 40 && y > -40 && y < window.innerHeight + 40 };
  });
}

async function start(): Promise<void> {
  const loader = realName ? REAL[`./fixtures/real/${realName}.json`] : undefined;
  if (loader) {
    // A real snapshot: its plain data, with the demo's stand-in forecast.
    rules.view = { ...(await loader()), forecast: rules.view.forecast };
    const at = rules.view.friends[0]?.at ?? { x: 0, y: 0 };
    realCamera = { x: at.x, y: at.y };
    setBackdrop(rules.view.phase === 'evening' ? 'dusk' : rules.view.phase === 'night' ? 'night' : 'day');
  }
  ui.setLoading(1);
  await ui.loadingDone();
  ui.hideMenu();
  ui.showAdventure(true);
  if (demo.unfold && params.has('fold')) {
    // Pretend the map was last seen one reach shorter, so the newest reach unfolds.
    const shorter = { ...rules.view, region: rules.view.region - 1 };
    ui.updateAdventure(shorter);
  }
  if (demo.seenLearned) {
    // Let the notebook first see the places as they were, so the lines learned since show as new.
    const seen = demo.seenLearned;
    const before = rules.view.places.map((p) => ({ ...p, learned: p.learned.slice(0, seen[p.id] ?? p.learned.length) }));
    ui.updateAdventure({ ...rules.view, places: before });
  }
  push();
  if (demo.open) ui.openNotebook(demo.open.page, demo.open.person, demo.open.place);
  if (demo.foldLeaf) window.setTimeout(() => document.querySelector<HTMLButtonElement>('[data-k="spread-close"]')?.click(), 300);
  let last = performance.now();
  const frame = (now: number): void => {
    rules.tick(Math.min(0.1, (now - last) / 1000));
    last = now;
    ui.updateTags(screenTags(now));
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function stateSwitcher(): void {
  if (params.has('shot')) return;
  const select = document.createElement('select');
  select.id = 'switcher';
  select.setAttribute('aria-label', 'Demo state');
  for (const name of STATE_NAMES) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    option.selected = name === stateName;
    select.append(option);
  }
  select.addEventListener('change', () => {
    params.set('state', select.value);
    location.search = params.toString();
  });
  document.body.append(select);
}

stateSwitcher();
void start();

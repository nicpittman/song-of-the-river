// Temporary harness: runs the game with a stub interface so gameplay can be
// tested before the real interface exists. Not part of the shipped build.
import { Application } from 'pixi.js';
import { AudioDirector } from '../game/audio/audio';
import { Game } from '../game/game';
import { ArtLibrary } from '../game/rendering/art';
import { brook } from '../game/simulation/fixtures/brook';
import { pond } from '../game/simulation/fixtures/pond';
import { registerBoard } from '../game/world/boards';
import { composeValley } from '../game/world/compose';
import type { BoardDef } from '../game/world/types';
import type { Ui } from '../ui/contract';

// The frozen test valley can be opened with ?board=brook: scripted playtests draw on it by coordinate.
registerBoard(brook);
// Every valley file under world/boards can be opened by id (?board=mio), whether or not it is in the campaign yet.
const files = import.meta.glob(['../game/world/boards/*.ts', '!../game/world/boards/*.test.ts'], { eager: true }) as Record<string, Record<string, unknown>>;
for (const module of Object.values(files)) {
  for (const value of Object.values(module)) {
    const board = value as Partial<BoardDef> | null;
    if (board && typeof board === 'object' && typeof board.id === 'string' && Array.isArray(board.channels) && Array.isArray(board.places)) registerBoard(board as BoardDef);
  }
}
// Two reaches joined, the lower one ending in the sea: for looking at the mist, chapters and the coast.
registerBoard(composeValley('two-reaches', 'Two reaches', 'A test of chapters', [brook, { ...pond, sea: { y: 900 } }]));
// The same valley with a water meadow and an old river bed, for looking at floods and channel opening.
registerBoard({
  ...brook,
  id: 'brook-wet',
  channels: [...brook.channels, { id: 'old-bed', name: 'the old east channel', closed: true, points: [[965, 1705, 34], [1100, 1800, 34], [1125, 1900, 34], [1010, 2000, 34], [860, 2060, 34]] }],
  floodplains: [{ id: 'meadow', name: 'the water meadow', blobs: [{ x: 620, y: 1420, r: 170 }, { x: 760, y: 1560, r: 120 }], floods: [0], relievedBy: ['old-bed'] }],
});

const log = document.getElementById('log')!;
const say = (text: string): void => {
  log.textContent = text;
  (window as unknown as { __log: string[] }).__log.push(text);
};
(window as unknown as { __log: string[] }).__log = [];
const ui: Ui = {
  showAdventure: () => {},
  // The latest snapshots, for scripted playtests to read.
  updateAdventure: (view) => {
    (window as unknown as { __adventure: unknown }).__adventure = view;
  },
  updateTags: (tags) => {
    (window as unknown as { __tags: unknown }).__tags = tags;
  },
  openNotebook: (page) => say(`notebook: ${page ?? 'plan'}`),
  setLoading: () => {},
  loadingDone: () => Promise.resolve(),
  showMenu: () => {},
  hideMenu: () => {},
  showHud: () => {},
  update: (state) => {
    (window as unknown as { __hud: unknown }).__hud = state;
  },
  setSelection: (s) => s && say(`[${s.tone}] ${s.title}: ${s.detail}`),
  toast: (text) => say(`toast: ${text}`),
  announceSeason: (season, year) => say(`season ${season} year ${year}`),
  celebrateObjective: (id) => say(`objective ${id}`),
  hint: (text) => text && say(`hint: ${text}`),
  journalFound: (card) => say(`journal: ${card.title}`),
  showJournal: () => {},
  showResults: (m) => say(`results: ${m.headline} ${JSON.stringify(m.shortfalls)}`),
  hideResults: () => {},
};
const stage = document.getElementById('stage')!;
const app = new Application();
await app.init({ preference: 'webgl', resizeTo: stage, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2), backgroundColor: 0xdfe6e0 });
stage.appendChild(app.canvas);
const art = new ArtLibrary();
await art.load('./art/', () => {});
// Start from a clean slate: clear any save before the game reads it.
localStorage.clear();
const game = new Game(app, art, new AudioDirector({ music: 0, sfx: 0 }));
game.attach(ui);
(window as unknown as { __game: Game }).__game = game;
// ?board=<id> opens another valley; ?free opens it in Free Play.
const query = new URLSearchParams(location.search);
const boardId = query.get('board') ?? 'seseragi';
if (query.has('free')) game.actions.startFreePlay(boardId);
else game.actions.startJourney(boardId);

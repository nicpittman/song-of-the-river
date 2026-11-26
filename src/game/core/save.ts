/**
 * Local persistence. One versioned JSON document in localStorage holds
 * settings, campaign progress and one saved valley per mode. Anything missing,
 * corrupt or from an unknown version falls back to defaults rather than
 * failing: a broken save should never stop the game from opening.
 */

import type { GameState } from '../simulation/simulation';
import { ADVENTURE_VERSION } from '../adventure/state';

export const SAVE_VERSION = 4;
const KEY = 'song-of-the-river';

export interface Settings {
  music: number;
  sfx: number;
  /** null follows the operating system's reduced-motion preference. */
  reducedMotion: boolean | null;
}

export interface SaveFile {
  version: number;
  settings: Settings;
  /** Ids of valleys completed in Journey mode. */
  completed: string[];
  /** Best rating per valley, in blossoms (1 to 3). */
  best: Record<string, number>;
  /** Journal entries discovered so far. */
  journal: string[];
  journey: GameState | null;
  free: GameState | null;
  /** Which mode `Continue` resumes. */
  last: 'journey' | 'free' | null;
  /** Wander opens once a Journey has come down to Mio. */
  wanderOpen: boolean;
}

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const defaultSave = (): SaveFile => ({
  version: SAVE_VERSION,
  settings: { music: 0.42, sfx: 0.5, reducedMotion: null },
  completed: [],
  best: {},
  journal: [],
  journey: null,
  free: null,
  last: null,
  wanderOpen: false,
});

export type ClearScope = 'journey' | 'free' | 'all';

/** Clear one standing save without disturbing the other or the sound settings. */
export function clearProgress(save: SaveFile, scope: ClearScope): SaveFile {
  // Starting over never closes Wander again: once open (or played), it stays on the menu.
  const next = { ...save, wanderOpen: save.wanderOpen || !!save.free || (save.journey?.adventure?.region ?? 0) >= 1 };
  if (scope !== 'free') {
    next.journey = null;
    next.completed = []; next.best = {}; next.journal = [];
  }
  if (scope !== 'journey') next.free = null;
  if (!next.last || !next[next.last]) next.last = next.journey ? 'journey' : next.free ? 'free' : null;
  return next;
}

/** Parses a stored document, tolerating anything. */
export function parseSave(text: string | null): SaveFile {
  const base = defaultSave();
  if (!text) return base;
  try {
    const raw = JSON.parse(text) as Partial<SaveFile> | null;
    if (!raw || typeof raw !== 'object' || raw.version !== SAVE_VERSION) return base;
    return {
      ...base,
      settings: {
        music: typeof raw.settings?.music === 'number' && Number.isFinite(raw.settings.music) ? Math.max(0, Math.min(1, raw.settings.music)) : base.settings.music,
        sfx: typeof raw.settings?.sfx === 'number' && Number.isFinite(raw.settings.sfx) ? Math.max(0, Math.min(1, raw.settings.sfx)) : base.settings.sfx,
        reducedMotion: typeof raw.settings?.reducedMotion === 'boolean' ? raw.settings.reducedMotion : null,
      },
      completed: Array.isArray(raw.completed) ? raw.completed.filter((v) => typeof v === 'string') : [],
      best: raw.best && typeof raw.best === 'object' ? Object.fromEntries(Object.entries(raw.best).filter(([, v]) => typeof v === 'number')) : {},
      journal: Array.isArray(raw.journal) ? raw.journal.filter((v) => typeof v === 'string') : [],
      journey: isGameState(raw.journey) ? raw.journey : null,
      free: isGameState(raw.free) ? raw.free : null,
      last: raw.last === 'journey' || raw.last === 'free' ? raw.last : null,
      wanderOpen: raw.wanderOpen === true,
    };
  } catch {
    return base;
  }
}

function isGameState(value: unknown): value is GameState {
  const s = value as Partial<GameState> | null | undefined;
  return (
    !!s &&
    typeof s.boardId === 'string' &&
    typeof s.tick === 'number' &&
    Array.isArray(s.connections) &&
    Array.isArray(s.planted) &&
    Array.isArray(s.opened) &&
    Array.isArray(s.stones) &&
    typeof s.chapter === 'number' &&
    Array.isArray(s.ratings) &&
    typeof s.arrivals === 'object' &&
    (s.mode === 'journey' || s.mode === 'free') &&
    // A river saved by another version of the adventure is not resumed (no migration): it counts as no save.
    (s.adventure === undefined || (typeof s.adventure === 'object' && s.adventure !== null && s.adventure.version === ADVENTURE_VERSION && Array.isArray(s.adventure.people)))
  );
}

export function loadSave(storage: Storage | null = safeStorage()): SaveFile {
  try {
    return parseSave(storage?.getItem(KEY) ?? null);
  } catch {
    return defaultSave();
  }
}

export function writeSave(save: SaveFile, storage: Storage | null = safeStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(save));
  } catch {
    // Private browsing or a full quota: play on without saving.
  }
}

/** localStorage can throw on access inside sandboxed iframes (itch.io with cookies blocked). */
function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

import { describe, expect, it } from 'vitest';
import { clearProgress, defaultSave, loadSave, parseSave, writeSave, type Storage } from './save';
import { newGameState } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';
import { newAdventure } from '../adventure/state';

describe('separate Journey and Free Play saves', () => {
  it('restores mute and explicit motion choices, and recovers malformed settings', () => {
    const save = defaultSave();
    save.settings = { music: 0, sfx: 0.27, reducedMotion: true };
    expect(parseSave(JSON.stringify(save)).settings).toEqual(save.settings);
    const corrupt = { ...save, settings: { music: 'loud', sfx: 5, reducedMotion: 'on' } };
    expect(parseSave(JSON.stringify(corrupt)).settings).toEqual({ music: 0.42, sfx: 1, reducedMotion: null });
  });
  const saved = () => {
    const save = defaultSave();
    save.journey = newGameState(adventureValley, 'journey'); save.journey.adventure = newAdventure();
    save.free = newGameState(adventureValley, 'free'); save.free.adventure = newAdventure(true);
    save.free.adventure.day = 19; save.free.adventure.materials = 17;
    save.last = 'free'; save.completed = ['seseragi'];
    return save;
  };
  it('persists and resumes Free Play independently of Journey', () => {
    const values = new Map<string, string>();
    const storage: Storage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => { values.set(k, v); }, removeItem: (k) => { values.delete(k); } };
    const save = saved(); writeSave(save, storage);
    const loaded = loadSave(storage);
    expect(loaded.free?.adventure).toMatchObject({ day: 19, materials: 17, free: true });
    expect(loaded.journey?.adventure?.day).toBe(1);
    expect(loaded.last).toBe('free');
  });
  it.each(['journey', 'free', 'all'] as const)('clears %s without changing settings or the retained mode', (scope) => {
    const original = saved();
    const result = clearProgress(original, scope);
    expect(result.settings).toEqual(original.settings);
    expect(result.journey).toBe(scope === 'free' ? original.journey : null);
    expect(result.free).toBe(scope === 'journey' ? original.free : null);
    expect(result.last).toBe(scope === 'journey' ? 'free' : scope === 'free' ? 'journey' : null);
    expect(original.journey).not.toBeNull(); expect(original.free).not.toBeNull();
  });
  it.each(['journey', 'free', 'all'] as const)('keeps Wander on the menu after clearing %s once it was open or played', (scope) => {
    expect(clearProgress({ ...saved(), wanderOpen: false }, scope).wanderOpen).toBe(true);
    expect(clearProgress({ ...defaultSave(), wanderOpen: true }, scope).wanderOpen).toBe(true);
    expect(clearProgress(defaultSave(), scope).wanderOpen).toBe(false);
  });
});

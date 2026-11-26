/**
 * Music track configuration.
 *
 * The local Suno music is unlicensed / non-commercial and excluded from source exports,
 * so any of these may be missing at runtime. The AudioDirector treats a missing
 * or undecodable file as "this scene is silent" and carries on.
 */

/** Every distinct audio mood the game can be in. Seasons double as levels. */
export type AudioScene = 'menu' | 'spring' | 'summer' | 'autumn' | 'winter';

/**
 * Relative on purpose: the production build is served from an itch.io subpath,
 * so an absolute `/audio/` would point at the wrong host directory.
 */
export const MUSIC_BASE = './audio/music/';

/**
 * File name (under MUSIC_BASE) per scene, or null for no music.
 * Scenes that share a file keep it playing seamlessly across the transition.
 */
export const MUSIC_TRACKS: Record<AudioScene, string | null> = {
  // The menu and spring and autumn have no piece of their own; each borrows a neighbour's, so the theme never repeats.
  menu: 'summer.m4a',
  spring: 'summer.m4a',
  summer: 'summer.m4a',
  autumn: 'winter.m4a',
  winter: 'winter.m4a',
};

/** Riverside Journey returns between seasonal pieces, regardless of season changes. */
export const MAIN_THEME = 'theme.m4a';
/**
 * The piece after `current`: the theme and the scene's piece take turns, so no
 * song plays twice in a row. Only when one file is missing does the other
 * follow itself, so the music never stops.
 */
export function nextMusic(scene: AudioScene, current: string | null, unavailable?: ReadonlySet<string>): string | null {
  const seasonal = MUSIC_TRACKS[scene];
  const order = current === MAIN_THEME ? [seasonal, MAIN_THEME] : [MAIN_THEME, seasonal];
  const playable = (file: string | null): file is string => !!file && !unavailable?.has(file);
  return order.find((file) => playable(file) && file !== current) ?? order.find(playable) ?? null;
}

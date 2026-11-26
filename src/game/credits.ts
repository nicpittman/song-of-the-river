/** Shared public attribution; source-by-source sound records live in CREDITS.md. */
export const GAME_CREDITS = {
  creator: 'pCO₂ · Nic Pittman',
  website: 'https://pco2.io',
  repository: 'https://github.com/nicpittman/song-of-the-river',
  jam: 'Made for GitHub Game Off 2026 · SHIFT',
  art: 'ChatGPT / OpenAI',
  development: 'Claude · ChatGPT',
  music: 'Suno',
  tracks: 'Gentle Discovery · Riverside Journey · Winter Felt',
  musicTerms: 'Unlicensed · non-commercial',
  codeTerms: 'PolyForm Noncommercial 1.0.0',
  assetTerms: 'CC BY-NC 4.0',
  ratingRequest: 'If you enjoyed the journey, please leave a rating on itch.io. It helps others find the river.',
  technology: 'PixiJS · TypeScript · Vite',
} as const;

/** Creative influences, separate from asset sources and licences. */
export const INSPIRATIONS = [
  { name: 'Ravenhaul', url: 'https://bippinbits.itch.io/ravenhaul', note: 'A quick rhythm of planning, journeys and returns.' },
  { name: 'Final Fantasy Tactics', url: 'https://final-fantasy-tactics-the-ivalice-chronicles.square-enix-games.com/', note: 'Clear, tactile character selection and the satisfaction of committing a move.' },
  { name: 'A Highland Song', url: 'https://www.inklestudios.com/a-highland-song/', note: 'Wonder, discovery and the pull of a meaningful journey.' },
  { name: 'Tiny Glade', url: 'https://pouncelight.games/tiny-glade/', note: 'The pleasure of watching a small, living landscape.' },
  { name: 'Minami Lane', url: 'https://store.steampowered.com/app/2678990/Minami_Lane/', note: 'Compact daily decisions and a warm sense of place.' },
  { name: 'Kanagawa', url: 'https://iellogames.com/games/kanagawa/', note: 'Illustrated landscapes, seasonal colour and quiet choices.' },
  { name: 'Pokémon', url: 'https://corporate.pokemon.co.jp/en/business/games/', note: 'The joy of finding wildlife and filling a collection journal.' },
] as const;

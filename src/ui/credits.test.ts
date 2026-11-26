import { expect, it } from 'vitest';
import { soundCredits } from './credits';
import { allSfxFiles } from '../game/audio/sfxManifest';
import { GAME_CREDITS } from '../game/credits';
import artLedger from '../../public/licenses/art-sources.json';
import artManifest from '../../public/art/manifest.json';
it('keeps every shipped sound traceable in the readable credits page', () => {
  const credits = soundCredits();
  for (const file of allSfxFiles()) {
    const rows = credits.filter((credit) => credit.file === `audio/sfx/${file}`);
    expect(rows.length, file).toBeGreaterThan(0);
    for (const row of rows) { expect(row.url).toMatch(/^https:\/\//); expect(row.licence).toMatch(/CC0|Public domain/); }
  }
  expect(GAME_CREDITS.creator).toBe('pCO₂ · Nic Pittman');
  expect(GAME_CREDITS.musicTerms).toBe('Unlicensed · non-commercial');
});

it('credits only the shipped illustrations and retains the project and jam links', () => {
  expect(artLedger.assets.map((asset) => asset.id).sort()).toEqual(Object.keys(artManifest.assets).sort());
  expect(artLedger.author).toBe('ChatGPT / OpenAI');
  expect(GAME_CREDITS.website).toBe('https://pco2.io');
  expect(GAME_CREDITS.repository).toBe('https://github.com/nicpittman/song-of-the-river');
  expect(GAME_CREDITS.jam).toContain('GitHub Game Off 2026');
});

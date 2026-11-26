/**
 * Every id the game shows must have a drawing of its own. Fallbacks exist so
 * new content never shows a blank, but they are a safety net, not a design:
 * this test makes a missing drawing fail loudly instead of quietly turning
 * into a generic sprig in the journal.
 *
 * Finds are checked against `DRAWN_FINDS`, the finds that existed when the
 * library was last brought up to date. A find added since is listed (and must
 * still render through its category fallback) rather than failing the build;
 * draw it, then add its id here.
 */

import { describe, expect, it } from 'vitest';
import { EQUIPMENT, FINDS, PEOPLE, PLACES, STRUCTURES } from '../../game/adventure/content';
import { fallbackFor, hasSketch, sketch } from './index';

/** The finds drawn in the last sketch pass. */
const DRAWN_FINDS: readonly string[] = [
  'dusk-iwana', 'herb-bed', 'sea-eagle', 'tide-night',
  'haru-meeting', 'shed-antler', 'hare-form', 'serow-sign', 'tanuki-trail', 'otter-slide', 'heron-prints', 'badger-sett',
  'fox-earth', 'pheasant-feather',
  'plum-blossom', 'ume', 'bush-warbler', 'tomi', 'first-beans', 'daikon', 'mill-coin', 'dragonflies', 'fiddleheads',
  'copper-pheasant', 'flood-line', 'watercress', 'old-boat', 'swallows', 'rice-planting', 'flood-wrack', 'frogs',
  'wild-garlic', 'old-roses', 'whitebait', 'clams', 'reed-bunting',
  'spray-rainbow', 'dipper', 'behind-the-falls', 'tarn-twice', 'newt', 'swans', 'deer-crossing', 'char',
  'hart-fern', 'carved-steps', 'serow', 'hut-book', 'cherry-salmon', 'kingfisher', 'drowned-lantern',
  'river-agate', 'stone-shell', 'plover', 'star-moss', 'deer-clearing', 'shiitake', 'owl-feather', 'fox',
  'day-lilies', 'long-view', 'skylark', 'usuyukiso', 'wild-grapes', 'woodpecker', 'hollow-oak',
  'winter-deer', 'heron', 'shrine-keeper', 'sea-wish', 'miller', 'waymark', 'reed-warbler', 'swallowtails',
  'wagtail', 'moon-moth', 'hawk-moth', 'orchard-blossom', 'late-apples', 'orchard-keeper', 'aki-meeting',
  'lanterns', 'boat-ledger', 'eel', 'willow-cutting', 'otter', 'tanuki', 'chestnuts', 'charcoal-kiln',
  'reed-way', 'egret', 'mandarin', 'seed-packet', 'heron-way', 'stone-fox', 'willow-kingfisher', 'white-eye',
  'white-herons', 'autumn-arrivals', 'eel-trap', 'yui-meeting', 'mended-sail', 'tide-song',
  'boatyard-moulds', 'loft-sail', 'mullet', 'cormorant', 'matsutake', 'green-pheasant', 'salt-flower',
  'mudskipper', 'tide-marks', 'starfish', 'shore-crab', 'oystercatcher', 'cherry-shells', 'moon-shell',
  'cowrie', 'sea-glass', 'driftwood', 'kelp', 'net-float', 'bottle-letter', 'sanderlings', 'seal',
  'first-sea',
  'hidden-spring', 'wild-hive', 'mist-herons',
  'snow-monkeys', 'snow-hare', 'autumn-stag', 'spotted-fawn', 'mist-owl', 'stubble-cranes', 'wild-boar', 'mill-carp', 'beach-gulls', 'black-kite',
];

const ids = {
  finds: FINDS.map((f) => f.id).filter((id) => DRAWN_FINDS.includes(id)),
  places: [...new Set(PLACES.map((p) => `place-${p.habitat}`))],
  structures: STRUCTURES.map((s) => `structure-${s.id}`),
  items: EQUIPMENT.map((e) => `item-${e.id}`),
  friends: PEOPLE.map((p) => `friend-${p.id}`),
};

describe('sketch library', () => {
  for (const [kind, list] of Object.entries(ids)) {
    it(`has a bespoke drawing for every ${kind} id`, () => {
      const missing = list.filter((id) => !hasSketch(id));
      expect(missing).toEqual([]);
    });
  }

  it('lists finds added since the last pass, drawn for now by their category', () => {
    const added = FINDS.filter((f) => !DRAWN_FINDS.includes(f.id) && !hasSketch(f.id));
    if (added.length) console.info(`Finds still to draw: ${added.map((f) => `${f.id} (${fallbackFor(f.id)})`).join(', ')}`);
    for (const f of added) expect(fallbackFor(f.id)).toMatch(/^any-/);
  });

  it('draws found and unfound versions as inline SVG', () => {
    for (const id of [...Object.values(ids).flat(), ...FINDS.map((f) => f.id)]) {
      expect(sketch(id)).toMatch(/^<svg[^>]*class="sketch"/);
      expect(sketch(id, { found: false, size: 24 })).toContain('is-unfound');
    }
  });

  it('falls back by name, then category, then prefix, then to a sprig', () => {
    expect(fallbackFor('golden-carp')).toBe('any-fish');
    expect(fallbackFor('stag-antlers')).toBe('any-antler');
    expect(fallbackFor('badger-den')).toBe('any-den');
    expect(fallbackFor('place-somewhere')).toBe('any-place');
    expect(fallbackFor('mystery-thing')).toBe('any-sprig');
    expect(sketch('mystery-thing')).toContain('<path');
  });

  it('writes only well-formed path data', () => {
    const numbersFor: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
    for (const id of [...Object.values(ids).flat(), ...FINDS.map((f) => f.id)]) {
      for (const [, d] of sketch(id).matchAll(/ d="([^"]*)"/g)) {
        const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
        expect(tokens.join('').length, `${id}: stray characters in ${d.slice(0, 40)}`).toBe(d.replace(/[\s,]/g, '').length);
        let i = 0;
        while (i < tokens.length) {
          const command = tokens[i++];
          const n = numbersFor[command.toUpperCase()];
          expect(n, `${id}: unknown command ${command}`).toBeDefined();
          let count = 0;
          while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
            i++;
            count++;
          }
          if (n > 0) expect(count % n === 0 && count > 0, `${id}: ${command} has ${count} numbers in ${d.slice(0, 40)}`).toBe(true);
        }
      }
    }
  });
});

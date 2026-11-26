import { GAME_CREDITS, INSPIRATIONS } from '../game/credits';
/** A readable credits page, built from the source ledger. */
import ledger from '../../CREDITS.md?raw';
import codeLicence from '../../public/licenses/PolyForm-Noncommercial-1.0.0.txt?raw';
import assetLicence from '../../public/licenses/CC-BY-NC-4.0.txt?raw';
import fontLicence from '../../public/licenses/Cormorant-Garamond-OFL.txt?raw';
import type { UiActions } from './contract';
import { button, h } from './dom';
import { portrait } from './sketches';
import { TITLE_SWASH } from './icons';
import { PEOPLE } from '../game/adventure/people';
import '../styles/credits.css';

export interface SoundCredit { file: string; use: string; author: string; url: string; licence: string }
export function soundCredits(markdown = ledger): SoundCredit[] {
  return markdown.split('\n').filter((line) => line.startsWith('| `audio/sfx/')).map((line) => {
    const [, file, use, author, url, licence] = line.split('|').map((part) => part.trim());
    return { file: file.replaceAll('`', ''), use, author: author.replaceAll('`', ''), url, licence };
  }).filter((credit) => /^https:\/\//.test(credit.url));
}
export const creditLink = (label: string, url: string): HTMLAnchorElement => h('a', 'credits-source', { href: url, target: '_blank', rel: 'noopener noreferrer' }, [label]);
/** The six friends, side by side, as on the menu. */
function friendsRow(): HTMLElement {
  const row = h('ul', 'credits-friends', { 'aria-label': PEOPLE.map((p) => p.name).join(', ') });
  for (const p of PEOPLE) {
    const li = h('li', null, { title: `${p.name}, ${p.role.toLowerCase()}` });
    li.innerHTML = portrait(p.id, { size: 44 });
    li.append(h('span', null, null, [p.name]));
    row.append(li);
  }
  return row;
}

/** A credit block: a small-caps heading, then its lines. */
const block = (title: string, ...lines: Array<HTMLElement | string>): HTMLElement =>
  h('section', 'credits-block', null, [h('h3', 'credits-caps', null, [title]), ...lines.map((line) => typeof line === 'string' ? h('p', null, null, [line]) : line)]);

/** Legal details stay in the credits; no raw Markdown or text-file navigation. */
function licenceDetails(label: string, text: string): HTMLElement {
  const readable = text.replace(/^#{1,6} /gm, '').replace(/\*{2,3}/g, '').replace(/\[([^\]]+)\]\(#[^)]+\)/g, '$1');
  return h('details', 'credits-record credits-licence', null, [
    h('summary', null, null, [label]), h('pre', null, null, [readable]),
  ]);
}

export function creditIntro(): HTMLElement {
  return h('div', 'credits-intro', null, [
    h('div', 'credits-byline', null, [
      h('p', 'credits-caps', null, ['A game by']),
      h('h2', null, null, [creditLink('pCO₂', GAME_CREDITS.website), ' · Nic Pittman']),
      h('p', 'credits-soft', null, ['Design, direction and development']),
      h('p', 'credits-jam', null, [GAME_CREDITS.jam, ' · ', creditLink('Source on GitHub', GAME_CREDITS.repository)]),
    ]),
    h('div', 'credits-pair', null, [
      block('Illustrations', 'ChatGPT / OpenAI', h('p', 'credits-soft', null, ['Landscapes, characters and animation frames. Notebook ink, light and water are drawn in code.'])),
      block('Music', 'Suno', h('p', 'credits-soft', null, ['Gentle Discovery · Riverside Journey · Winter Felt']), h('p', 'credits-terms is-small', null, ['Unlicensed, non-commercial. Separate music terms; excluded from the public source export.'])),
      block('Development assistance', GAME_CREDITS.development),
      block('Typeface', 'Cormorant Garamond', h('p', 'credits-soft', null, ['Christian Thalmann · SIL Open Font License 1.1']), licenceDetails('Read the typeface licence', fontLicence)),
    ]),
    h('section', 'credits-inspirations', null, [h('h3', 'credits-caps', null, ['Inspirations']), h('ul', null, null,
      INSPIRATIONS.map((game) => h('li', null, null, [creditLink(game.name, game.url), h('span', null, null, [`: ${game.note}`])]))),
    ]),
  ]);
}
export class Credits {
  readonly el = h('section', 'credits-page', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'credits-title' });
  private readonly close = button('sr-word credits-close', 'Close credits', '×', () => this.hide());
  private returnFocus: HTMLElement | null = null;
  constructor(private readonly actions: Pick<UiActions, 'replayCredits' | 'cue'>) {
    const sources = new Map<string, SoundCredit[]>();
    for (const credit of soundCredits()) sources.set(credit.url, [...(sources.get(credit.url) ?? []), credit]);
    const sounds = h('section', 'credits-sounds', null, [h('h3', 'credits-caps', null, ['Sounds of the valley']), h('p', 'credits-soft', null, ['Creative Commons Zero (CC0) and public-domain recordings, edited and mixed for the river. Thank you to every contributor. Open a source to see the files used.'])]);
    for (const [url, records] of sources) {
      const record = records[0]!;
      const terms = h('p', 'credits-terms', null, [record.licence]); terms.classList.add('is-licence');
      const details = h('details', 'credits-record', null, [h('summary', null, null, [record.author.split(':')[0]!]), terms, creditLink('Original source', url)]);
      details.append(h('ul', null, null, records.map((r) => h('li', null, null, [h('code', null, null, [r.file]), `: ${r.use}`]))));
      sounds.append(details);
    }
    this.el.append(h('article', 'credits-paper', null, [
      h('header', 'credits-head', null, [
        h('p', 'credits-caps', null, ['Song of the River']),
        h('h1', null, { id: 'credits-title' }, ['Credits']),
        friendsRow(),
        button('sr-word credits-cutscene', 'Watch the ending again', 'Watch the ending', () => { this.actions.cue('menu-click'); this.hide(); this.actions.replayCredits?.(); }),
        this.close,
      ]),
      h('div', 'credits-scroll', { tabindex: '0', 'aria-label': 'Credits and sources' }, [creditIntro(), sounds,
        h('section', 'credits-block', null, [h('h3', 'credits-caps', null, ['Made with']), h('p', null, null, [creditLink('PixiJS', 'https://pixijs.com/'), ' · ', creditLink('TypeScript', 'https://www.typescriptlang.org/'), ' · ', creditLink('Vite', 'https://vite.dev/'), ' · ', creditLink('Cormorant Garamond', 'https://github.com/CatharsisFonts/Cormorant')])]),
        block('Licences',
          h('p', 'credits-terms', null, [`Source code: ${GAME_CREDITS.codeTerms}. Source available for noncommercial use.`]),
          h('p', 'credits-terms', null, [`Project artwork and writing: ${GAME_CREDITS.assetTerms}, to the extent of rights held. You may share and adapt them noncommercially with credit, a licence link and an indication of changes.`]),
          h('p', 'credits-terms', null, ['Credit: Song of the River - Nic Pittman (pCO2), https://pco2.io. Reference-guided illustrations: ChatGPT / OpenAI.']),
          h('p', 'credits-terms', null, ['Nic Pittman retains his rights in his contributions. Music, recordings, fonts and dependencies retain their separate terms.']),
          h('p', 'credits-terms', null, ['These asset terms include original illustrations, sprites, portraits, animations, notebook artwork, narrative, dialogue and promotional material. Software that draws sketches uses the code licence. Third-party material is excluded. No exclusive copyright in generated images, trademark rights or endorsement is promised.']),
          licenceDetails('Read the code licence', codeLicence),
          licenceDetails('Read the artwork and writing licence', assetLicence),
        ),
        (() => { const wave = h('div', 'credits-swash', { 'aria-hidden': 'true' }); wave.innerHTML = TITLE_SWASH; return wave; })(),
        h('p', 'credits-thanks', null, ['Thank you for following the river.']),
        h('p', 'credits-rating', null, [GAME_CREDITS.ratingRequest]),
      ]),
    ]));
    this.el.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.hide(); }
      if (event.key !== 'Tab') return;
      const stops = [...this.el.querySelectorAll<HTMLElement>('button, a, summary, [tabindex="0"]')].filter((node) => node.getClientRects().length > 0);
      const at = stops.indexOf(document.activeElement as HTMLElement);
      event.preventDefault(); stops[(at + (event.shiftKey ? stops.length - 1 : 1)) % stops.length]?.focus();
    });
  }
  show(): void { this.returnFocus = document.activeElement as HTMLElement; this.el.classList.add('is-open'); this.close.focus({ preventScroll: true }); }
  hide(): void { this.el.classList.remove('is-open'); if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true }); }
}

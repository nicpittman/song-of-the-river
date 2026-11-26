/**
 * The river map as a two-page spread. Left: the reaches of the river (how
 * well each is known), what the story is waiting for, and the most recent
 * notes. Right: the whole river drawn as far as it has been followed,
 * unfolding southward as new reaches open, with mist beyond.
 */

import type { AdventureView } from '../../../game/adventure/model';
import { h } from '../../dom';
import type { Board } from '../board';
import { leadMark, placeMark } from '../../sketches';
import { caps, wordButton } from '../ink';
import { numberWord } from '../words';
import { reach } from '../campPoint';
import { REACH_AHEAD } from '../../../game/adventure/narrative';

/** How many notes the left page has room for. */
const NOTES = 7;

export function mapLeftPage(view: AdventureView, board: Board): HTMLElement {
  const reaches = h('ol', 'nb-reaches');
  const here = reach(view);
  view.chart.regions.forEach((region, i) => {
    const known = i <= here;
    if (known) {
      const places = view.places.filter((p) => p.region === i);
      const visited = places.filter((p) => p.visits > 0).length;
      const kicker = i === here ? 'Where we are' : 'Followed';
      reaches.append(h('li', i === here ? 'is-here' : null, null, [
        caps(region.title || kicker),
        wordButton(region.name, () => board.scrollToRegion(i), 'nb-reach-name', `reach-${i}`),
        h('span', 'nb-reach-line', null, [places.length > 10 ? `${visited} of ${places.length} places visited` : `${capitalise(numberWord(visited))} of ${numberWord(places.length)} places visited`]),
      ]));
      return;
    }
    // The reaches ahead are rumours: named, never drawn, told as the valley tells them.
    reaches.append(h('li', 'is-unknown', null, [
      caps(i === here + 1 ? 'Next, downriver' : 'Further on, they say'),
      h('span', 'nb-reach-name is-unknown', null, [region.name]),
      h('span', 'nb-reach-line', null, [REACH_AHEAD[region.id] ?? 'Only a name so far.']),
    ]));
  });
  const notes = h('ul', 'nb-notes');
  // Each day by what it brought home; a quiet day by what the river did.
  for (const n of view.notes.slice(0, NOTES)) {
    const best = view.history.find((d) => d.day === n.day)?.standout;
    notes.append(h('li', null, null, [caps(`Day ${n.day}`), h('span', null, null, [best ? best.replace(/^Found: /, '') : n.text])]));
  }
  return h('div', 'nb-page-body', null, [
    caps('River map'),
    h('h2', 'nb-page-title', null, ['From the springs to the sea']),
    view.goal ? h('p', 'nb-page-lead', null, [view.goal]) : null,
    ...(view.wanderings.length ? wanderingsList(view, board) : [reaches]),
    view.notes.length ? caps('Along the way', 'nb-notes-head') : null,
    view.notes.length ? notes : null,
  ]);
}

/** Free Play's long wanderings, in place of the reaches: every corner of each, the friends, the journal, the sea. */
function wanderingsList(view: AdventureView, board: Board): HTMLElement[] {
  const list = h('ul', 'nb-wanderings');
  for (const w of view.wanderings) {
    const reachIndex = view.chart.regions.findIndex((r) => w.id === `reach-${r.id}`);
    const line = reachIndex >= 0
      ? wordButton(w.line, () => board.scrollToRegion(reachIndex), 'nb-wander-line nb-aim-link', `reach-${reachIndex}`)
      : h('span', 'nb-wander-line', null, [w.line]);
    list.append(h('li', w.done ? 'is-done' : null, null, [line, h('span', 'nb-wander-count', null, [w.progress]), w.note ? h('span', 'nb-wander-note', null, [w.note]) : null]));
  }
  return [caps('Wanderings', 'nb-notes-head'), list];
}

export function mapRightPage(board: Board): HTMLElement {
  return h('div', 'nb-page-body is-atlas', null, [
    board.el, board.zoomControls,
    h('p', 'nb-atlas-key', { 'aria-hidden': 'true' }, [
      keyMark('open'),
      'open',
      keyMark('closed'),
      'closed',
      keyMark('lead'),
      'a lead',
      keyMark('known'),
      'how well known',
    ]),
  ]);
}

function keyMark(kind: 'open' | 'closed' | 'lead' | 'known'): HTMLElement {
  const el = h('span', `nb-key is-${kind}`);
  if (kind === 'open' || kind === 'closed') el.innerHTML = placeMark(kind, 18);
  else if (kind === 'lead') el.innerHTML = leadMark(18);
  else
    el.innerHTML =
      '<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><circle class="k-on" cx="4" cy="9" r="1.6"/><circle class="k-on" cx="9" cy="9" r="1.6"/><circle class="k-off" cx="14" cy="9" r="1.6"/></svg>';
  return el;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

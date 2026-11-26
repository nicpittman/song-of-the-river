/**
 * Everything the notebook knows about one place, as a small field card: its
 * name and habitat sketch, how it stands today (and why, when closed or
 * special), what the friends have learned there, its possible finds, and any
 * lead with the days it has left.
 *
 * One component, two homes: pinned beside the place in the valley when the
 * player looks closely at it (a `place` tag), and at the top of the leaf's
 * planning card. Lines learned since the last look are gently marked; the
 * notebook remembers what has been read (`LearnedMemory`).
 */

import type { FindSlot, PlaceView } from '../../game/adventure/model';
import { h } from '../dom';
import { leadMark } from '../sketches';
import { caps, sketchEl } from './ink';
import { numberWord } from './words';

/** How many learned lines of each place the player has already seen. */
export class LearnedMemory {
  private readonly seen = new Map<string, number>();

  /** Lines before this index have been read. */
  read(place: PlaceView): number {
    return this.seen.get(place.id) ?? place.learned.length;
  }

  /** Called the first time the notebook ever sees a place, so old lines are not marked new on load. */
  know(place: PlaceView): void {
    if (!this.seen.has(place.id)) this.seen.set(place.id, place.learned.length);
  }

  /** Lines become read once the card that showed them is put away. */
  markRead(place: PlaceView): void {
    this.seen.set(place.id, place.learned.length);
  }
}

export interface PlaceCardOptions {
  /** Lines from this index on are new since the last look. */
  seen: number;
  /** The leaf leaves the note out when space is short. */
  compact?: boolean;
}

/** The card's contents (without any shell or actions), as a fragment of elements. */
export function placeCardBody(place: PlaceView, options: PlaceCardOptions): HTMLElement[] {
  const parts: HTMLElement[] = [placeHeader(place)];
  if (!options.compact && place.note) parts.push(h('p', 'nb-pc-note', null, [place.note]));
  // A village is where people live: described, never planned for.
  if (place.kind === 'settlement') return parts;
  if (place.lead) parts.push(leadLine(place));
  if (place.learned.length) parts.push(learnedList(place, options.seen));
  if (place.finds.length) parts.push(findsRow(place.finds));
  return parts;
}

function placeHeader(place: PlaceView): HTMLElement {
  const state = h('p', `nb-pc-state is-${place.state}`);
  const word = place.state === 'closed' ? 'Closed today' : place.state === 'special' ? 'Special today' : 'Open today';
  state.append(caps(word));
  if (place.stateLine) state.append(h('span', 'nb-pc-why', null, [place.stateLine]));
  const visits = place.kind === 'settlement' ? 'A village on the river' : place.visits === 0 ? 'Not yet visited' : place.visits === 1 ? 'Visited once' : `Visited ${numberWord(place.visits)} times`;
  return h('header', 'nb-pc-head', null, [
    sketchEl(habitatSketch(place), 44, true, 'nb-pc-sketch'),
    h('div', 'nb-pc-titles', null, [h('h3', 'nb-pc-name', null, [place.name]), h('p', 'nb-pc-visits', null, [visits])]),
    place.state !== 'open' || place.stateLine ? state : null,
  ]);
}

function leadLine(place: PlaceView): HTMLElement {
  const flag = h('span', 'nb-pc-flag', { 'aria-hidden': 'true' });
  flag.innerHTML = leadMark(20);
  const days = place.leadDays === null ? null : place.leadDays <= 1 ? 'Opportunity ends today' : `Opportunity: ${numberWord(place.leadDays)} days left`;
  return h('p', 'nb-pc-lead', null, [flag, h('span', null, null, [place.lead ?? '']), days ? caps(days, 'nb-pc-days') : null]);
}

function learnedList(place: PlaceView, seen: number): HTMLElement {
  const wrap = h('section', 'nb-pc-learned', { 'aria-label': 'Learned here' });
  wrap.append(caps('Learned here'));
  if (!place.learned.length) {
    wrap.append(h('p', 'nb-pc-empty', null, [place.visits > 0 ? 'Nothing has been noted here yet.' : 'Nobody has been here yet.']));
    return wrap;
  }
  const list = h('ol', 'nb-pc-lines');
  place.learned.forEach((line, i) => {
    const fresh = i >= seen;
    const item = h('li', fresh ? 'is-new' : null, null, [line]);
    if (fresh) item.prepend(h('span', 'visually-hidden', null, ['New: ']));
    list.append(item);
  });
  wrap.append(list);
  return wrap;
}

/** The finds as a row of sketches: drawn when found, dotted when not, with a short hint beneath. */
export function findsRow(finds: FindSlot[]): HTMLElement {
  const row = h('ul', 'nb-finds', { 'aria-label': 'Possible finds' });
  for (const find of finds) {
    const caption = find.found ? (find.name ?? '') : (find.hint ?? 'Not yet found');
    const classes = ['nb-find', find.found ? 'is-found' : 'is-unfound'];
    if (find.rare) classes.push('is-rare');
    if (!find.today) classes.push('is-not-today');
    const label = find.found
      ? `${find.name}${find.rare ? ', rare' : ''}`
      : `Not yet found${find.hint ? `: ${find.hint}` : ''}${find.today ? '' : ', not today'}`;
    row.append(
      h('li', classes.join(' '), { 'aria-label': label, title: label }, [
        sketchEl(find.sketch, 36, find.found),
        h('span', 'nb-find-caption', { 'aria-hidden': 'true' }, [caption]),
      ]),
    );
  }
  return row;
}

/** The place's own habitat drawing when the rules name one; otherwise the generic place sketch. */
function habitatSketch(place: PlaceView): string {
  const named = (place as PlaceView & { sketch?: string }).sketch;
  const quietPlaces: Record<string, string> = { yunotani: 'warm-spring', iori: 'hermit', kakureura: 'hidden-cove' };
  if (quietPlaces[place.id]) return quietPlaces[place.id]!;
  return named ?? (['mio', 'kawagiri'].includes(place.id) ? `place-${place.id}` : `place-${place.habitat}`);
}

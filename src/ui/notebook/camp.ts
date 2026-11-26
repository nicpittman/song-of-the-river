/**
 * Our companions at camp, across the top of the leaf. Everyone is always here,
 * so the morning's question is plain at a glance: who is still waiting?
 *
 *   waiting   a full token in its colour ring; tap to pick them up
 *   planned   same token, with activity and destination; tap to change
 *   resting   same token, by a little fire; tap to change
 */

import type { AdventureView, FriendView } from '../../game/adventure/model';
import { h } from '../dom';
import { fireGlyph, friendToken } from './ink';
import { ACTIVITY_WORDS } from './words';

export interface CampHandlers {
  pick(id: string): void;
  takeBack(id: string): void;
  stay?(id: string): void;
}

export function campShelf(view: AdventureView, picked: string | null, handlers: CampHandlers, suggested?: string): HTMLElement {
  const shelf = h('section', 'nb-camp', { 'aria-label': 'Companions and their homes' });
  shelf.append(
    h('header', 'nb-camp-head', null, [h('span', 'nb-town', null, ['Today’s plans'])]),
  );
  const row = h('div', 'nb-camp-row');
  row.style.setProperty('--people-count', String(Math.max(1, view.friends.length)));
  const commonHome = view.friends.every((f) => f.baseName === view.friends[0]?.baseName) ? view.friends[0]?.baseName : null;
  if (commonHome) shelf.append(h('p', 'nb-camp-home', null, [`Home: ${commonHome}`]));
  for (const friend of view.friends) {
    const token = campFriend(view, friend, picked, handlers, !!commonHome);
    token.classList.toggle('is-recommended', friend.id === suggested);
    if (friend.id === suggested) token.title = `${friend.name} is suggested for this place. Choose anyone to compare.`;
    row.append(token);
  }
  shelf.append(row);
  return shelf;
}

function campFriend(view: AdventureView, friend: FriendView, picked: string | null, handlers: CampHandlers, commonHome: boolean): HTMLElement {
  if (friend.status === 'home') {
    const lifted = friend.id === picked;
    const b = h('button', `nb-camper is-waiting${lifted ? ' is-lifted' : ''}`, {
      type: 'button',
      'aria-pressed': String(lifted),
      'aria-label': `${friend.name}, stays home unless assigned an outing. ${lifted ? 'Selected.' : 'Select.'}`,
      'aria-keyshortcuts': String(view.friends.indexOf(friend) + 1),
    });
    b.dataset.k = `camp-${friend.id}`;
    b.append(friendToken(friend, 40), personName(view, friend), h('span', 'nb-camper-status', null, ['At camp']));
    if (!commonHome) b.append(h('span', 'nb-camper-where', null, [h('span', 'nb-camper-where-label', null, ['Home: ']), friend.baseName]));
    b.addEventListener('click', () => handlers.pick(friend.id));
    return b;
  }
  if (friend.status === 'planned' || friend.status === 'resting' || (friend.status === 'building' && view.phase === 'morning')) {
    const plan = view.plans.find((p) => p.person === friend.id || p.companion === friend.id);
    const place = plan ? view.places.find((p) => p.id === plan.place) : null;
    const where = friend.status === 'building' ? 'Build today' : friend.status === 'resting' ? 'Stay at camp' : plan?.lodging !== undefined ? `Stay at ${view.lodgings.find((l) => l.id === plan.lodging)?.name ?? 'shelter'}` : place ? `${plan?.detour ? `${shortName(view.places.find((p) => p.id === plan.detour!.place)?.name ?? plan.detour.place)} → ` : ''}${shortName(place.name)}${plan?.second ? ` → ${shortName(view.places.find((p) => p.id === plan.second!.place)?.name ?? plan.second.place)}` : ''}${plan?.overnight ? ' · overnight' : ''}` : friend.statusLine;
    const doing = plan ? place?.kind === 'settlement' && !plan.visitOnly ? 'move camp' : ACTIVITY_WORDS[plan.activity].toLowerCase() : null;
    const label =
      friend.status === 'resting'
        ? `${friend.name} stays at camp. Change plan.`
        : `${friend.name}: ${doing ?? ''} at ${where}. Change plan.`;
    const b = h('button', `nb-camper is-${friend.status}${picked === friend.id ? ' is-inspected' : ''}`, { type: 'button', 'aria-label': label.replace('Change plan.', 'View plan.'), 'aria-keyshortcuts': String(view.friends.indexOf(friend) + 1), 'aria-pressed': String(picked === friend.id) });
    b.dataset.k = `camp-${friend.id}`;
    const token = friendToken(friend, 40);
    if (friend.status === 'resting') token.append(fireGlyph(14));
    b.append(token, personName(view, friend));
    b.append(h('span', 'nb-camper-status', null, [`✓ ${plan && plan.lodging === undefined && doing ? `${doing} · ` : ''}${where}`]));
    if (!commonHome) b.append(h('span', 'nb-camper-where', null, [h('span', 'nb-camper-where-label', null, ['Home: ']), friend.baseName]));
    b.addEventListener('click', () => handlers.takeBack(friend.id));
    return b;
  }
  // Building, out or aboard: shown, but not something to plan this morning.
  return h('div', `nb-camper is-${friend.status}`, { 'aria-label': `${friend.name}: ${friend.statusLine}` }, [
    friendToken(friend, 40),
    h('span', 'nb-camper-name', null, [friend.name]),
    h('span', 'nb-camper-where', null, [friend.statusLine]),
  ]);
}

function personName(view: AdventureView, friend: FriendView): HTMLElement {
  return h('span', 'nb-camper-name', null, [h('small', 'nb-person-key', { 'aria-hidden': 'true' }, [String(view.friends.indexOf(friend) + 1)]), friend.name]);
}

/** Compact, directly clickable alternatives beside the expedition forecast. */
export function personChoices(people: FriendView[], picked: string | null, suggested: string | undefined, pick: (id: string) => void): HTMLElement {
  const row = h('div', 'nb-plan-people', { role: 'group', 'aria-label': 'Choose who goes' });
  for (const person of people) {
    const selected = person.id === picked;
    const b = h('button', `nb-plan-person${selected ? ' is-selected' : ''}`, { type: 'button', 'aria-pressed': String(selected), 'aria-label': `Choose ${person.name}${person.id === suggested ? ', suggested' : ''}` }, [friendToken(person, 34),
      h('span', 'nb-plan-person-name', null, [person.name]), h('small', null, null, [person.id === suggested ? 'Suggested' : '']),
    ]);
    b.dataset.k = `go-${person.id}`;
    b.addEventListener('click', () => pick(person.id)); row.append(b);
  }
  return row;
}

/** "The mountain spring" reads as "the mountain spring" mid-sentence. */
function shortName(name: string): string {
  return name.startsWith('The ') ? `the ${name.slice(4)}` : name;
}


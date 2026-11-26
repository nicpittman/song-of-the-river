/**
 * Our companions as a two-page spread. Left: everyone, with what they are doing
 * now, then the people along the river not met yet (a blank ink outline and
 * what has been heard of them) or met but staying where they are. Right: one
 * friend's page: portrait, role, gift, ambition, practice and memories.
 */

import type { Activity, AdventureView, FriendView } from '../../../game/adventure/model';
import { personDef } from '../../../game/adventure/people';
import { h } from '../../dom';
import { caps, friendToken, wordButton } from '../ink';
import { ACTIVITY_WORDS, GIFT_WORDS } from '../words';

const ACTIVITIES: Activity[] = ['explore', 'fish', 'forage', 'investigate', 'visit', 'track'];
/** Outings of one kind after which a friend counts as practised. */
const PRACTISED = 3;

export interface FriendsState {
  friend: string | null;
}

export function friendsPages(
  view: AdventureView,
  state: FriendsState,
  rerender: () => void,
  click: () => void,
  follow: (id: string) => void,
): [HTMLElement, HTMLElement] {
  if (!state.friend || !view.friends.some((f) => f.id === state.friend)) state.friend = view.friends[0]?.id ?? null;
  const friend = view.friends.find((f) => f.id === state.friend) ?? null;

  const list = h('ul', 'nb-group');
  for (const f of view.friends) {
    const chosen = f.id === state.friend;
    const b = h('button', `nb-group-friend${chosen ? ' is-chosen' : ''}`, { type: 'button', 'aria-pressed': String(chosen) });
    b.dataset.k = `friend-${f.id}`;
    b.append(
      friendToken(f, 46),
      h('span', 'nb-group-words', null, [
        h('span', 'nb-group-name', null, [f.name]),
        h('span', 'nb-group-role', null, [f.role]),
        h('span', 'nb-group-status', null, [f.statusLine]),
      ]),
    );
    b.addEventListener('click', () => {
      state.friend = f.id;
      click();
      rerender();
    });
    list.append(h('li', null, null, [b]));
  }
  const others = alongTheRiver(view);
  const left = h('div', 'nb-page-body', null, [
    caps('People'), h('h2', 'nb-page-title', null, ['Our companions']), list,
    others.length ? caps('Along the river', 'nb-group-others-head') : null,
    others.length ? h('ul', 'nb-group is-others', null, others) : null,
  ]);
  const right = h('div', 'nb-page-body', null, friend ? friendPage(friend, follow) : []);
  return [left, right];
}

function friendPage(friend: FriendView, follow: (id: string) => void): HTMLElement[] {
  // Drawn at the size it shows, so the painted face is never scaled soft.
  const portrait = friendToken(friend, window.matchMedia('(max-width: 760px)').matches ? 96 : 132, 'nb-portrait');
  const practice = h('ul', 'nb-practice', { 'aria-label': 'Practice' });
  for (const a of ACTIVITIES) {
    const n = friend.practice[a] ?? 0;
    if (!n && a !== friend.gift) continue;
    const tally = h('span', 'nb-tally', { 'aria-hidden': 'true' });
    for (let i = 0; i < Math.min(n, 9); i++) tally.append(h('i'));
    practice.append(
      h('li', n >= PRACTISED ? 'is-practised' : null, { 'aria-label': `${ACTIVITY_WORDS[a]}: ${n} outings${n >= PRACTISED ? ', practised' : ''}` }, [
        h('span', 'nb-practice-name', null, [ACTIVITY_WORDS[a]]),
        tally,
        n >= PRACTISED ? caps('practised') : null,
      ]),
    );
  }
  const memories = h('ul', 'nb-memories');
  for (const m of friend.memories) memories.append(h('li', null, null, [m]));
  return [
    h('header', 'nb-friend-head', null, [
      portrait,
      h('div', null, null, [
        caps(friend.role),
        h('h2', 'nb-page-title', null, [friend.name]),
        h('p', 'nb-friend-gift', null, [`Based in ${friend.baseName}.`]),
        h('p', 'nb-friend-gift', null, [`A gift for ${GIFT_WORDS[friend.gift]}.`]),
        wordButton('Find in the valley', () => follow(friend.id), 'nb-quiet', `follow-${friend.id}`),
      ]),
    ]),
    h('p', 'nb-friend-ambition', null, [friend.ambition]),
    h('p', 'nb-friend-traits', null, [
      `${personDef(friend.id).pace >= 230 ? 'Quick-footed' : personDef(friend.id).pace >= 200 ? 'Steady walker' : 'Unhurried walker'} · ${personDef(friend.id).nature === 'follow' ? 'Follows a promising trail' : 'Stops to look closely'}`,
    ]),
    friend.id === 'aki' ? h('p', 'nb-friend-traits', null, ['Works quickly. Give him timber and a day, and something stands.']) : null,
    friend.wish ? h('p', `nb-friend-wish${friend.wish.granted ? ' is-granted' : ''}`, null, [friend.wish.text]) : null,
    caps('Practice'),
    practice,
    friend.memories.length ? caps('Remembers') : null,
    friend.memories.length ? memories : null,
  ].filter((x): x is HTMLElement => !!x);
}

/** Everyone the group could meet, in the order the river meets them (Sora only in Wander: in a Journey he is always with us). */
const ALONG = ['sora', 'ren', 'mina', 'aki', 'haru', 'yui'];

/** Where someone already met stays, when they keep to their own place. */
const STAYS: Record<string, string> = {
  sora: 'On a journey of his own, from Yamagoya.',
  aki: 'Still at work on the roofs of Mio.',
  haru: 'Keeps her camp among the Matsubara pines.',
  yui: 'Keeps the old stories at the Takayuka landing.',
};

/**
 * Only people the player could know of: someone whose meeting is hinted in a
 * reach already reached (the journal gives that hint), or someone met who has
 * not come along. Nobody further down the river is spoiled.
 */
function alongTheRiver(view: AdventureView): HTMLElement[] {
  return ALONG.flatMap((id) => {
    if (view.friends.some((f) => f.id === id)) return [];
    const meeting = view.journal.find((entry) => entry.id === `${id}-meeting`);
    if (!meeting) return [];
    const person = personDef(id);
    if (meeting.found) {
      return [h('li', null, null, [h('div', 'nb-group-friend is-met', { 'aria-label': `${person.name}, met, stays` }, [
        friendToken({ id, colour: person.colour, pack: null }, 46),
        h('span', 'nb-group-words', null, [
          h('span', 'nb-group-name', null, [person.name]),
          h('span', 'nb-group-role', null, [person.role]),
          h('span', 'nb-group-status', null, [STAYS[id] ?? 'Met along the way.']),
        ]),
      ])])];
    }
    if (!meeting.hint) return [];
    return [h('li', null, null, [h('div', 'nb-group-friend is-unmet', { 'aria-label': `Not yet met: ${meeting.hint}` }, [
      outline(46),
      h('span', 'nb-group-words', null, [
        h('span', 'nb-group-name', null, ['Not yet met']),
        h('span', 'nb-group-status', null, [meeting.hint]),
      ]),
    ])])];
  });
}

/** A blank ink outline where a portrait will be. */
function outline(size: number): HTMLElement {
  const el = h('span', 'nb-outline', { 'aria-hidden': 'true' });
  el.innerHTML = `<svg viewBox="0 0 46 46" width="${size}" height="${size}"><circle cx="23" cy="23" r="21.6" stroke-dasharray="1.6 3.2"/><circle cx="23" cy="18.5" r="6.6"/><path d="M11.5 37.5c1.6-6.8 6.2-10.2 11.5-10.2s9.9 3.4 11.5 10.2"/></svg>`;
  return el;
}

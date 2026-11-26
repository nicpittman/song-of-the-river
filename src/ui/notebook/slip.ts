/** Place advice within the notebook: choose a person, then confirm their outing. */

import type { Activity, AdventureView, Equipment, Forecast, FriendView, OutingPlan, PlaceView, SecondStop } from '../../game/adventure/model';
import { h } from '../dom';
import { leadMark } from '../sketches';
import { caps, friendToken, keyed, sketchEl, stampButton, wordButton } from './ink';
import { ACTIVITY_WORDS, numberWord } from './words';
import { defaultActivity, recommendPeople } from './recommendations';
import { plannedStopsAt, type StopHint } from './stopHints';
import { personChoices } from './camp';
import { shownName } from './board';
export { defaultActivity } from './recommendations';

export interface Selection {
  person: string | null;
  place: string | null;
  activity: Activity | null;
  item: Equipment | null;
  companion: string | null;
  overnight?: string;
  second?: SecondStop;
  everyone?: boolean;
}

export interface SlipHandlers {
  send(plan: OutingPlan): void;
  /** Select a person without confirming the proposed plan. */
  sendFriend(person: string): void;
  addPlannedStop?(hint: StopHint): void;
  activity(a: Activity): void;
  item(e: Equipment | null): void;
  companion(id: string | null): void;
  /** The friend in hand stays by the fire today instead. */
  rest(person: string): void;
  close(): void;
  refuse(): void;
  base?(): void;
  stay?(person: string, lodging: number | string): void;
  overnight?(place: string | undefined): void;
  moveEveryone?(place: string): void;
  everyone?(enabled: boolean): void;
  second?(): void;
  secondActivity?(activity: Activity): void;
  removeSecond?(): void;
  pickingSecond?: boolean;
  /** Extending a confirmed outing, rather than sending a new one. */
  addingStop?: boolean;
  updatingStop?: boolean;
  problem?: string | null;
  /** Today uses its one fixed portrait row for every person choice. */
  peopleOnShelf?: boolean;
  detailsOpen?: boolean;
  details?(open: boolean): void;
}

/** At most this many finds are shown, and this many reasons. */
const FINDS = 4;
const REASONS = 2;
const STRENGTHS: Record<Activity, string> = {
  explore: 'finds new paths', fish: 'knows fishing water', forage: 'an eye for useful plants',
  investigate: 'reads old workmanship', visit: 'a way with people', track: 'reads wildlife signs',
};

/** A plan for a friend at a place, with what is in hand or sensible defaults. */
export function planFor(friend: FriendView, place: PlaceView, sel: Selection | null): OutingPlan {
  const activity = sel?.activity && place.activities.includes(sel.activity) ? sel.activity : defaultActivity(friend, place);
  return { person: friend.id, place: place.id, activity, item: sel?.item ?? null, companion: sel?.companion ?? null, ...(place.kind === 'settlement' ? { visitOnly: sel?.overnight !== place.id } : sel?.overnight === place.id ? { overnight: place.id } : {}), ...(sel?.second ? { second: sel.second } : {}) };
}

export function placeSlip(view: AdventureView, place: PlaceView, sel: Selection, readOnly: boolean, handlers: SlipHandlers): HTMLElement {
  const slip = h('section', `nb-slip is-${place.state}`, { 'aria-label': place.name });
  const close = wordButton('×', handlers.close, 'nb-slip-close', 'slip-close');
  close.setAttribute('aria-label', 'Put the slip away');
  slip.append(close, header(view, place), ...stateLines(place));

  if (place.kind === 'settlement') {
    const villageBody = h('div', 'nb-slip-body');
    if (place.note) villageBody.append(h('p', 'nb-slip-note', null, [place.note]));
    slip.append(villageBody);
    const friend = view.friends.find((f) => f.id === sel.person) ?? null;
    if (view.canTravel && place.region > view.region) {
      const planned = view.plans.some((p) => p.place === place.id);
      villageBody.append(h('p', 'nb-slip-note', null, [`One day downriver together · ${view.travelCost} provisions. Tomorrow’s walks begin in the new reach.`]));
      const choose = stampButton(planned ? 'Move planned' : 'Plan this journey', () => handlers.moveEveryone?.(place.id), 'plan-journey');
      choose.disabled = planned; choose.classList.toggle('is-ready', !planned);
      slip.append(h('footer', 'nb-slip-go', null, [choose]));
      return slip;
    }
    if (!readOnly && view.phase === 'morning') {
      villageBody.append(whoGoes(view, place, handlers, sel));
      const alreadyHome = friend?.base === place.region && friend.lodging === undefined;
      const othersNeedCamp = view.friends.some((f) => f.base !== place.region || f.lodging !== undefined);
      const together = !!sel.everyone && othersNeedCamp;
      if (friend || together) {
        const plan = friend ? planFor(friend, place, sel) : null;
        const staying = together || !!plan && !plan.visitOnly;
        const problem = together ? view.moveEveryoneProblem(place.id) : plan ? view.forecast(plan).problem : null;
        const options = h('div', 'nb-camp-choices');
        if (!alreadyHome || othersNeedCamp) {
          const choice = h('label', 'nb-overnight-option');
          const stay = h('input', null, { type: 'checkbox', 'aria-label': 'Stay here tonight' });
          stay.checked = staying;
          stay.addEventListener('change', () => { handlers.overnight?.(stay.checked ? place.id : undefined); handlers.everyone?.(stay.checked && view.friends.length > 1 && othersNeedCamp); });
          choice.append(stay, h('span', null, null, ['Stay here tonight', h('small', null, null, ['Tomorrow’s walks begin here.'])]));
          options.append(choice);
          if (staying && view.friends.length > 1 && handlers.everyone && othersNeedCamp) {
            const group = h('label', 'nb-overnight-option');
            const check = h('input', null, { type: 'checkbox', 'aria-label': 'Bring everyone' });
            check.checked = together;
            check.addEventListener('change', () => handlers.everyone!(check.checked));
            group.append(check, h('span', null, null, ['Bring everyone'])); options.append(group);
          }
        }
        const label = together ? 'Move everyone here · E' : staying ? 'Move camp here · E' : `Visit ${place.name} · E`;
        const send = stampButton(label, () => together ? handlers.moveEveryone?.(place.id) : plan && handlers.send(plan), 'send');
        send.disabled = !!problem; send.classList.toggle('is-ready', !problem);
        villageBody.append(options);
        slip.append(h('footer', 'nb-slip-go', null, [send]));
        if (problem) villageBody.append(h('p', 'nb-problem', { role: 'status' }, [problem]));
        if (alreadyHome && friend && !together) villageBody.append(wordButton('Stay at camp · R', () => handlers.rest(friend.id), 'nb-quiet', 'camp-day'));
      }
    }
    return slip;
  }
  const friend = view.friends.find((f) => f.id === sel.person) ?? null;
  const planning = !readOnly && view.phase === 'morning' && place.state !== 'closed' && place.activities.length > 0;
  if (planning && friend) {
    const body = h('div', 'nb-slip-body', null, [whoGoes(view, place, handlers, sel)]);
    const plan = planFor(friend, place, sel);
    const forecast = view.forecast(plan);
    body.append(h('p', 'nb-slip-chance', null, [handlers.peopleOnShelf ? null : friendToken(friend, 22), h('span', 'nb-slip-purpose', null, [expectedOutcome(forecast, plan.activity)]), h('span', 'nb-length', null, [plan.second ? `${forecast.length} · two short visits` : forecast.length])]));
    const purpose = expectedOutcome(forecast, plan.activity);
    const reasons = forecast.reasons.filter((r) => r.text !== purpose && r.text !== `Usually ${purpose}` && r.text !== 'Nothing new to find here now').slice(0, REASONS).map((r) => r.text.startsWith('Reveals ') ? { ...r, text: 'Paths beyond the known map' } : r);
    if (reasons.length) {
      body.append(
        h(
          'ul',
          'nb-slip-reasons',
          null,
          reasons.map((r) => h('li', r.sign === '+' ? 'is-plus' : 'is-minus', null, [h('span', 'nb-sign', null, [r.sign === '+' ? '+' : '−']), r.text])),
        ),
      );
    }
    body.append(findsRow(place));
    body.append(choices(view, friend, place, plan, handlers));
    if (handlers.second && !plan.overnight) {
      const next = view.places.find((p) => p.id === sel.second?.place);
      if (next) {
        const remove = wordButton('×', () => handlers.removeSecond?.(), 'nb-quiet', 'remove-second');
        remove.setAttribute('aria-label', 'Remove second stop');
        body.append(h('div', 'nb-second-stop', null, [wordButton(handlers.pickingSecond ? 'Choose another second stop…' : `Then · ${next.name}`, handlers.second, 'nb-quiet', 'change-second'), remove,
          h('nav', 'nb-second-activities', { 'aria-label': `Activity at ${next.name}` }, next.activities.map(activity => {
            const button = wordButton(ACTIVITY_WORDS[activity].toLowerCase(), () => handlers.secondActivity?.(activity), activity === sel.second!.activity ? 'is-chosen' : '', `second-${activity}`);
            button.setAttribute('aria-pressed', String(activity === sel.second!.activity)); return button;
          })), h('span', 'nb-length', null, ['Two shorter visits; one walk home.'])]));
      }
      else body.append(wordButton(handlers.pickingSecond ? 'Choose a second place on the map…' : '+ A second stop', handlers.second, 'nb-quiet nb-second-stop', 'add-second'));
      if (handlers.pickingSecond) body.append(h('p', 'nb-second-hint', { role: 'status' }, ['Choose a nearby marked place. Both stops share today’s daylight.']));
    }
    if (handlers.addingStop && sel.second) {
      const next = view.places.find(p => p.id === sel.second!.place);
      body.prepend(h('p', 'nb-second-hint', { role: 'status' }, [`${friend.name}: ${place.name} → ${next?.name ?? sel.second.place}. The first visit stays planned.`]));
    }
    const send = stampButton(handlers.addingStop ? 'Add stop · E' : handlers.updatingStop ? 'Update stop · E' : `Send ${friend.name} · E`, () => (forecast.problem || handlers.pickingSecond ? handlers.refuse() : handlers.send(plan)), 'send');
    send.classList.toggle('is-ready', !forecast.problem && !handlers.pickingSecond);
    send.disabled = !!forecast.problem || !!handlers.pickingSecond;
    send.setAttribute('aria-disabled', String(!!forecast.problem || !!handlers.pickingSecond));
    const overnight = ['hut', 'inn'].includes(place.habitat ?? '') && !place.rumour && place.id !== friend.lodging && !sel.second && handlers.overnight ? h('label', 'nb-overnight-option') : null;
    if (overnight) {
      const check = h('input', null, { type: 'checkbox', 'aria-label': `Stay at ${place.name} tonight` });
      check.checked = sel.overnight === place.id;
      check.addEventListener('change', () => handlers.overnight!(check.checked ? place.id : undefined));
      overnight.append(check, h('span', null, null, ['Stay overnight', h('small', null, null, ['Explore today; start here tomorrow.'])]));
    }
    if (forecast.problem) body.append(h('p', 'nb-problem', null, [forecast.problem]));
    if (handlers.problem) body.append(h('p', 'nb-problem', { role: 'status' }, [handlers.problem]));
    slip.append(body, h('footer', 'nb-slip-go', null, [overnight,
      handlers.addingStop ? wordButton('Keep original plan', handlers.close, 'nb-quiet', 'keep-plan') : null, send]));
    return slip;
  }
  slip.append(findsRow(place));
  if (planning) slip.append(whoGoes(view, place, handlers));
  return slip;
}

export interface DetourHandlers {
  /** Consider this stop: its slip opens. */
  choose(stop: SecondStop): void;
  activity(activity: Activity): void;
  confirm(): void;
  /** Back to the short list of stops. */
  others(): void;
  close(): void;
  problem?: string | null;
}

/** The town at the end of today's walk down. */
const downTo = (view: AdventureView): string => view.chart.regions[view.region + 1]?.name ?? 'the new camp';

/** On the moving morning: a few stops near a friend's road down, each with what it might bring. */
export function detourList(view: AdventureView, friend: FriendView, handlers: DetourHandlers): HTMLElement {
  const close = wordButton('×', handlers.close, 'nb-slip-close', 'slip-close');
  close.setAttribute('aria-label', 'Put the slip away');
  const list = h('ul', 'nb-suggested-places nb-detour-stops');
  for (const offered of view.detourStops(friend.id)) {
    const place = view.places.find((p) => p.id === offered.place);
    if (!place) continue;
    const stop = { place: place.id, activity: place.activities.includes(defaultActivity(friend, place)) ? defaultActivity(friend, place) : offered.activity };
    const forecast = view.detour(friend.id, stop);
    list.append(h('li', null, null, [wordButton(place.name, () => handlers.choose(stop), 'nb-suggestion-link', `detour-${place.id}`), h('span', null, null, [`${ACTIVITY_WORDS[stop.activity]} · ${expectedOutcome(forecast, stop.activity)}`])]));
  }
  return h('section', 'nb-slip nb-detour', { 'aria-label': `A stop on the way for ${friend.name}` }, [close,
    h('header', 'nb-slip-head', null, [h('h3', 'nb-slip-name', null, ['A stop on the way']), h('p', 'nb-slip-known', null, [`${friend.name}, then on to ${downTo(view)}`])]),
    h('div', 'nb-slip-body', null, [list.childElementCount ? list : h('p', 'nb-slip-note', null, ['Nowhere near enough the road today.']), h('p', 'nb-slip-note', null, ['Or choose a place on the map.'])]),
  ]);
}

/** One stop on the way down: what they would do there, what it might bring, and when they catch up. */
export function detourSlip(view: AdventureView, friend: FriendView, place: PlaceView, stop: SecondStop, handlers: DetourHandlers): HTMLElement {
  const close = wordButton('×', handlers.close, 'nb-slip-close', 'slip-close');
  close.setAttribute('aria-label', 'Put the slip away');
  const forecast = view.detour(friend.id, stop);
  const purpose = expectedOutcome(forecast, stop.activity);
  const body = h('div', 'nb-slip-body', null, [h('p', 'nb-second-hint', null, [`${friend.name} · Stop at ${place.name}, then on to ${downTo(view)}.`]), h('p', 'nb-slip-chance', null, [h('span', 'nb-slip-purpose', null, [purpose]), h('span', 'nb-length', null, [forecast.length])])]);
  const reasons = forecast.reasons.filter((r) => r.text !== `Usually ${purpose}` && r.text !== 'Nothing new to find here now').slice(0, REASONS);
  if (reasons.length) body.append(h('ul', 'nb-slip-reasons', null, reasons.map((r) => h('li', r.sign === '+' ? 'is-plus' : 'is-minus', null, [h('span', 'nb-sign', null, [r.sign === '+' ? '+' : '−']), r.text]))));
  body.append(findsRow(place));
  const activities = place.activities.includes(friend.gift) ? [friend.gift, ...place.activities.filter((a) => a !== friend.gift)] : place.activities;
  if (activities.length > 1) body.append(h('div', 'nb-slip-choices', { role: 'group', 'aria-label': `What ${friend.name} does at ${place.name}` }, activities.map((a) => {
    const b = wordButton(ACTIVITY_WORDS[a].toLowerCase(), () => handlers.activity(a), `nb-slip-choice${a === stop.activity ? ' is-on' : ''}`, `detour-activity-${a}`);
    b.setAttribute('aria-pressed', String(a === stop.activity));
    return b;
  })));
  const problem = forecast.problem ?? handlers.problem;
  if (problem) body.append(h('p', 'nb-problem', { role: 'status' }, [problem]));
  const go = stampButton('Add stop · E', () => handlers.confirm(), 'detour-confirm');
  go.disabled = !!forecast.problem; go.classList.toggle('is-ready', !forecast.problem);
  return h('section', `nb-slip nb-detour is-${place.state}`, { 'aria-label': place.name }, [close, header(view, place), ...stateLines(place), body,
    h('footer', 'nb-slip-go', null, [wordButton('Other stops', handlers.others, 'nb-quiet', 'detour-others'), go])]);
}

/** The name, and in a word how well it is known: not yet visited, visited twice; a village says whose it is. */
function header(view: AdventureView, place: PlaceView): HTMLElement {
  const home = place.kind === 'settlement' && view.friends.some((f) => f.base === place.region && f.lodging === undefined);
  const descriptor: Record<string, string> = { inn: 'Village inn', hut: 'Travellers’ hut', pool: 'River pool', tarn: 'Mountain lake', waterfall: 'Waterfall', woodland: 'Woodland', forest: 'Woodland', mill: 'Watermill', farm: 'Fields', meadow: 'Meadow', shrine: 'Shrine', orchard: 'Orchard', reeds: 'Reed beds', riverbank: 'Riverbank' };
  const known = place.rumour ? place.rumour : home
    ? 'A small village · Our camp'
    : place.kind === 'settlement'
      ? 'A small village on the river'
      : place.visits === 0
        ? 'Not yet visited'
        : place.visits === 1
          ? 'Visited once'
          : `Visited ${numberWord(place.visits)} times`;
  const terrain = place.id === 'yamagoya' ? 'Sora’s mountain home' : place.id === 'izumi' ? 'River source' : place.id === 'kagami' ? 'Alpine lake' : descriptor[place.habitat ?? ''];
  return h('header', 'nb-slip-head', null, [h('h3', `nb-slip-name${place.rumour ? ' is-rumoured' : ''}`, null, [shownName(place)]), h('p', `nb-slip-known${place.visits === 0 && !home ? ' is-new' : ''}`, null, [[terrain, known].filter(Boolean).join(' · ')]), place.kind !== 'settlement' && !place.rumour && place.note ? h('p', 'nb-slip-note', null, [place.note]) : null]);
}

/** Closed or special today (and why), and any lead with the days it holds. */
function stateLines(place: PlaceView): HTMLElement[] {
  const lines: HTMLElement[] = [];
  if (place.state !== 'open' || place.stateLine) {
    const word = place.state === 'closed' ? 'Closed today' : place.state === 'special' ? 'Special today' : 'Today';
    lines.push(h('p', `nb-slip-state is-${place.state}`, null, [caps(word), place.stateLine ? h('span', null, null, [place.stateLine]) : null]));
  }
  if (place.lead) {
    const mark = h('span', 'nb-slip-lead-mark', { 'aria-hidden': 'true' });
    mark.innerHTML = leadMark(16);
    const days = place.leadDays === null ? '' : place.leadDays <= 1 ? ' This clue lasts through today.' : ` This clue lasts ${numberWord(place.leadDays)} more days.`;
    lines.push(h('p', 'nb-slip-lead', null, [mark, h('span', null, null, [`${place.lead}${days}`])]));
  }
  return lines;
}

/** What might come home: a few small sketches, dotted when not yet found. Names are their labels, never cut short. */
function findsRow(place: PlaceView): HTMLElement {
  const today = place.finds.filter((f) => f.today);
  const shown = (today.length ? today : place.finds).slice(0, FINDS);
  const row = h('ul', 'nb-slip-finds', { 'aria-label': 'What might come home' });
  for (const f of shown) {
    const label = f.found ? f.name ?? '' : f.hint ? `Not yet found: ${f.hint}` : 'Not yet found';
    row.append(h('li', f.found ? 'is-found' : 'is-unfound', { 'aria-label': label, title: label }, [sketchEl(f.sketch, 28, f.found)]));
  }
  return row;
}

/** One row of small choices: what to do (the friend's gift first), what to take, who goes along. */
function choices(view: AdventureView, friend: FriendView, place: PlaceView, plan: OutingPlan, handlers: SlipHandlers): HTMLElement {
  const wrap = h('div', 'nb-outing-options');
  const row = h('div', 'nb-slip-choices', { role: 'group', 'aria-label': 'Purpose of the outing' });
  const activities = place.activities.includes(friend.gift) ? [friend.gift, ...place.activities.filter((a) => a !== friend.gift)] : place.activities;
  if (activities.length > 1) {
    for (const a of activities) {
      const on = a === plan.activity;
      const b = wordButton(a === 'visit' && place.habitat === 'mill' ? 'talk to the miller' : a === 'investigate' && place.habitat === 'mill' ? 'inspect the mill' : ACTIVITY_WORDS[a].toLowerCase(), () => handlers.activity(a), `nb-slip-choice${on ? ' is-on' : ''}`, `activity-${a}`);
      b.setAttribute('aria-pressed', String(on));
      row.append(b);
    }
  }
  wrap.append(row);
  const equipment = view.equipment.filter((e) => e.owned && (e.with === null || e.with === friend.id));
  const companions = view.friends.filter((f) => f.id !== friend.id && f.status === 'home' && f.base === friend.base && f.lodging === friend.lodging);
  if (!equipment.length && !companions.length) return wrap;
  const extras = h('details', 'nb-outing-details');
  extras.open = handlers.detailsOpen ?? !!(plan.item || plan.companion);
  const selected = [plan.item ? view.equipment.find((e) => e.id === plan.item)?.name : null, plan.companion ? view.friends.find((f) => f.id === plan.companion)?.name : null].filter(Boolean);
  const summary = h('summary', null, null, [selected.length ? `Equipment & companions · ${selected.join(' · ')}` : 'Equipment & companions']);
  summary.dataset.k = 'outing-details'; extras.append(summary);
  extras.addEventListener('toggle', () => { if (extras.isConnected) handlers.details?.(extras.open); });
  const kit = h('div', 'nb-outing-extra-row', { role: 'group', 'aria-label': 'Shared equipment' }, [caps('Take along')]);
  for (const e of equipment) {
    const on = plan.item === e.id;
    const b = wordButton(e.name.toLowerCase(), () => handlers.item(on ? null : e.id), `nb-slip-choice is-item${on ? ' is-on' : ''}`, `item-${e.id}`);
    b.setAttribute('aria-pressed', String(on));
    b.title = e.effect;
    kit.append(b);
  }
  if (equipment.length) extras.append(kit);
  const group = h('div', 'nb-outing-extra-row', { role: 'group', 'aria-label': 'A companion from the same base' }, [caps('Go together')]);
  for (const f of companions) {
    const on = plan.companion === f.id;
    const b = h('button', `nb-slip-with${on ? ' is-on' : ''}`, { type: 'button', 'aria-pressed': String(on), 'aria-label': `${f.name} goes along`, title: `${f.name} goes along` });
    b.dataset.k = `with-${f.id}`;
    b.append(handlers.peopleOnShelf ? `${on ? '✓' : '+'} ${f.name}` : friendToken(f, 22));
    b.addEventListener('click', () => handlers.companion(on ? null : f.id));
    group.append(b);
  }
  if (companions.length) extras.append(group);
  wrap.append(extras);
  return wrap;
}

/** With nobody in hand: each waiting friend's face and their chance here; a tap sends them. */
function whoGoes(view: AdventureView, place: PlaceView, handlers: SlipHandlers, selected?: Selection): HTMLElement {
  const waiting = view.friends.filter((f) => f.status === 'home');
  if (!waiting.length) {
    const stops = plannedStopsAt(view, place.id);
    if (stops.length && handlers.addPlannedStop) return h('div', 'nb-slip-who', { 'aria-label': 'Add a stop to a planned outing' }, stops.map(hint => {
      const friend = view.friends.find(person => person.id === hint.person)!;
      const add = wordButton(`${friend.name} · Add stop`, () => handlers.addPlannedStop!(hint), 'nb-quiet');
      add.prepend(friendToken(friend, 28)); return add;
    }));
    return h('p', 'nb-slip-note', null, ['Everyone has a plan today.']);
  }
  if (handlers.peopleOnShelf) {
    const person = waiting.find((f) => f.id === selected?.person);
    const best = place.kind === 'settlement' ? undefined : recommendPeople(view, place, selected?.activity)[0]?.id;
    const line = h('div', 'nb-selected-person');
    line.append(personChoices(waiting, selected?.person ?? null, best, handlers.sendFriend));
    if (person) {
      const activity = selected?.activity ?? defaultActivity(person, place);
      line.append(h('span', 'nb-selected-home', null, [[person.name, person.gift === activity ? STRENGTHS[activity] : null, `from ${person.baseName}`].filter(Boolean).join(' · ')]));
      line.append(wordButton('Camp · R', () => handlers.rest(person.id), 'nb-quiet nb-selected-rest', 'camp-day'));
    } else line.append(...keyed('Choose a person above · 1–6'));
    return line;
  }
  const row = h('div', 'nb-slip-who', { role: 'group', 'aria-label': 'Who goes here' });
  const best = place.kind === 'settlement' ? undefined : recommendPeople(view, place, selected?.activity)[0]?.id;
  for (const f of waiting) {
    const odds = view.forecast(planFor(f, place, selected ?? null));
    const home = place.kind === 'settlement' && f.base === place.region && f.lodging === undefined;
    const b = h('button', 'nb-slip-friend', { type: 'button', 'aria-label': `Send ${f.name} here: ${odds.chance}` });
    b.dataset.k = `go-${f.id}`;
    b.setAttribute('aria-label', `Choose ${f.name}: ${odds.problem ?? expectedOutcome(odds, selected?.activity ?? defaultActivity(f, place))}`);
    b.classList.toggle('is-suited', place.activities.includes(f.gift));
    b.classList.toggle('is-unavailable', !!odds.problem && !home);
    b.classList.toggle('is-recommended', f.id === best);
    b.setAttribute('aria-pressed', String(f.id === selected?.person));
    b.setAttribute('aria-keyshortcuts', String(view.friends.indexOf(f) + 1));
    b.append(friendToken(f, 26), h('span', 'nb-slip-friend-name', null, [f.name]), h('span', 'nb-slip-person-outcome', null, [home ? 'Camp / build' : odds.problem ? 'Unavailable' : `${f.id === best ? 'Best fit · ' : ''}${ACTIVITY_WORDS[selected?.activity ?? defaultActivity(f, place)]}`]));
    b.querySelector('.nb-slip-friend-name')?.prepend(h('small', 'nb-person-key', { 'aria-hidden': 'true' }, [String(view.friends.indexOf(f) + 1)]));
    b.addEventListener('click', () => (odds.problem && !home ? handlers.refuse() : handlers.sendFriend(f.id)));
    row.append(b);
  }
  return h('div', 'nb-slip-who-wrap', null, [caps('Choose a person'), row]);
}



function expectedOutcome(forecast: Forecast, activity: Activity): string {
  // Curiosity leads; ordinary gains remain visible among the supporting reasons.
  if (forecast.discoveryHint) return forecast.discoveryHint;
  if (forecast.newGround) return forecast.reasons.some((r) => r.text === 'Finding the way there') ? 'Find this place' : 'Look for a path onward';
  const geography = forecast.reasons.find((r) => r.text.startsWith('Reveals '));
  if (geography) return 'Look for a path onward';
  if (forecast.reasons.some((r) => r.text === 'Finding the way there')) return 'Find this place';
  const resources = forecast.reasons.filter((r) => r.text.startsWith('Usually ')).map((r) => r.text.replace('Usually ', ''));
  if (resources.length) return resources.join(' · ');
  const purpose: Record<Activity, string> = { explore: 'Explore the nearby paths', investigate: 'Look closely for clues', track: 'Follow wildlife signs', visit: 'Talk and share news', forage: 'Gather useful plants', fish: 'Fish the water here' };
  return purpose[activity];
}

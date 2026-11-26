/**
 * "Make": the structures the group can build and the shared kit it can
 * craft, as a short illustrated list. Choosing a structure sends `place` (the
 * valley then asks for a site); choosing a kit item sends `craft`.
 */

import type { Way } from '../../game/adventure/course';
import type { AdventureView, Equipment, EquipmentView, StructureKind, StructureView } from '../../game/adventure/model';
import { h } from '../dom';
import { caps, friendToken, sketchEl, wordButton } from './ink';
import { resourceWords } from './words';
import { buildPreview } from './buildPreview';

export interface MakeHandlers {
  place(kind: StructureKind): void;
  craft(item: Equipment): void;
  refuse(): void;
  work?(person: string): void;
  recover?(site: number): void;
  /** When given, the list carries its own close word (the day strip's make sheet). */
  close?(): void;
}

export function makeList(view: AdventureView, handlers: MakeHandlers): HTMLElement {
  const wrap = h('section', 'nb-make', { 'aria-label': 'Make something' });
  const close = handlers.close ? wordButton('×', handlers.close, 'nb-close nb-make-close', 'make-close') : null;
  close?.setAttribute('aria-label', 'Put the make list away');
  wrap.append(
    h('header', 'nb-make-head', null, [caps('Build & equipment'), h('span', 'nb-make-supplies', null, [resourceWords(view)]), close]),
  );
  // Story works that are the way on come first; small works and wishes next; stalled, locked and finished story works sink.
  const stalled = (s: StructureView): boolean => s.status === 'building' && s.builders?.length === 0;
  const story = view.mode === 'free' ? null : view.region === 1 && !view.departure?.prepared
    ? new Set(['cottage', 'bridge']) : view.region === 2
      ? new Set([view.structures.some(s => s.id === 'dock' && s.status === 'built') ? 'boat' : 'dock']) : new Set<string>();
  // A story work stays at the top even while its materials are missing.
  const way = view.structures.filter((s) => s.major && !stalled(s) && s.status !== 'built'
    && (s.status === 'building' || (story ? story.has(s.id) : s.status === 'available')));
  const small = view.structures.filter((s) => !s.major);
  const rest = view.structures.filter((s) => s.major && !way.includes(s));
  const smallRank = (s: StructureView): number => (s.wish && !s.wish.granted && s.status !== 'built' ? 0 : ({ available: 1, building: 1, locked: 2, built: 3 })[s.status]);
  const restRank = (s: StructureView): number => ({ building: 0, locked: 1, built: 2, available: 3 })[s.status];
  const list = (rows: StructureView[], cls = ''): HTMLElement => {
    const ul = h('ul', `nb-make-list${cls}`);
    for (const s of rows) ul.append(structureRow(view, s, handlers));
    return ul;
  };
  if (way.length) wrap.append(list(way));
  if (small.length) {
    if (way.length) wrap.append(h('header', 'nb-make-head is-kit', null, [caps(small.some((s) => s.wish) ? 'Wishes & small works' : 'Small works')]));
    wrap.append(list([...small].sort((a, b) => smallRank(a) - smallRank(b))));
  }
  if (rest.length) wrap.append(list([...rest].sort((a, b) => restRank(a) - restRank(b)), ' is-later'));
  if (view.equipment.length) {
    wrap.append(h('header', 'nb-make-head is-kit', null, [caps('The shared kit')]));
    const kit = h('ul', 'nb-make-list is-kit');
    for (const e of view.equipment) kit.append(kitRow(view, e, handlers));
    wrap.append(kit);
  }
  return wrap;
}

/** What the narrows bridge does for this run's way down from Mio. */
const BRIDGE_EFFECT: Record<Way, string> = {
  reeds: 'Keeps Aki’s promise, and opens the far bank: Mukoniwa’s garden and the shrine hill.',
  herons: 'Keeps Aki’s promise, and opens the far bank. Mukoniwa’s gardener knows where the herons go.',
  'high-path': 'Keeps Aki’s promise, and opens the far bank, where the woods above Higashimori run south.',
};

/**
 * Grandfather's boat is mended, not made: the old hull wants materials and
 * days of work, and she will not sail without a sail. One quiet checklist.
 */
function boatNeeds(view: AdventureView, s: StructureView): HTMLElement | null {
  if (s.id !== 'boat' || s.status === 'built') return null;
  const sail = view.journal.some((e) => (e.id === 'mended-sail' || e.id === 'loft-sail') && e.found);
  const days = Math.ceil(s.workRemaining);
  const item = (done: boolean, text: string): HTMLElement => h('li', done ? 'is-done' : null, null, [text]);
  const dock = view.structures.some((d) => d.id === 'dock' && d.status === 'built');
  return h('ul', 'nb-make-needs', { 'aria-label': 'What the boat needs' }, [
    item(dock, dock ? 'A dock to bring her alongside' : 'A dock first, to bring her down from the reeds'),
    item(s.status === 'building', s.status === 'building' ? 'The old hull, brought down to the dock' : `Timber and pitch for the hull · ${materialWords(s.cost)}`),
    item(days <= 0, days > 0 ? `${days} ${days === 1 ? 'day' : 'days'} of mending` : 'Mended'),
    item(sail, sail ? 'A sail, folded and ready' : 'A sail · someone along this coast may keep one'),
  ]);
}

function structureRow(view: AdventureView, s: StructureView, handlers: MakeHandlers): HTMLElement {
  const affordable = view.materials >= s.cost;
  const can = s.status === 'available' && !s.problem && affordable;
  const mend = s.id === 'boat';
  const status = s.status === 'built' ? (s.count && s.count > 1 ? `${s.count} built` : mend ? 'Mended' : 'Built') : s.status === 'building' ? `${Math.round(s.progress * 100)}% ${mend ? 'mended' : 'built'}` : s.status === 'locked' && !affordable ? materialWords(s.cost) : s.status === 'locked' ? 'Not yet' : materialWords(s.cost);
  const short = !affordable && s.status !== 'built' && s.status !== 'building';
  const why = short ? `Needs ${materialWords(s.cost)} (${view.materials} available)` : s.problem;
  const body = h('span', 'nb-make-body', null, [
    h('span', 'nb-make-name', null, [s.name]),
    s.wish ? h('span', 'nb-make-wish', null, [s.wish.granted ? `${s.wish.name}’s, now.` : `${s.wish.name} would like one.`]) : null,
    h('span', 'nb-make-effect', null, [view.mode !== 'free' && view.region === 1 && !view.departure?.prepared && s.id === 'bridge'
      ? BRIDGE_EFFECT[view.course.way]
      : view.mode !== 'free' && view.region === 1 && !view.departure?.prepared && s.id === 'cottage'
        ? 'Keeps Aki’s promise to Mio. Some companions can work here while the others scout the way south.'
        : s.wish?.person === 'yui' && !s.wish.granted ? 'A roof near the coastal landing, open to the sound of the tide.' : s.effect]),
    boatNeeds(view, s),
    !(mend && s.status !== 'building') && s.major && s.workRemaining > 0 && !(s.status === 'building' && s.builders?.length === 0) ? h('span', 'nb-make-work', null, [s.status === 'building'
      ? buildPreview(view, s)
      : `${Math.ceil(s.workRemaining)} ${Math.ceil(s.workRemaining) === 1 ? 'day' : 'days'} of work for one builder · more hands go faster`]) : null,
    why && s.status !== 'built' ? h('span', `nb-make-why${short ? ' is-short' : ''}`, null, [why]) : null,
    short && s.problem && !/^Needs \d+ materials/.test(s.problem) ? h('span', 'nb-make-why', null, [s.problem]) : null,
  ]);
  const cost = h('span', `nb-make-cost${can ? ' is-ready' : ''}${short ? ' is-short' : ''}`, null, [status]);
  const content = [sketchEl(s.sketch, 44, s.status !== 'locked'), body, cost];
  if (s.status === 'building') {
    const bar = h('span', 'nb-make-progress', { 'aria-hidden': 'true' });
    bar.style.setProperty('--p', String(s.progress));
    content.push(bar);
  }
  if (s.status === 'built' || s.status === 'building') {
    const row = h('li', `nb-make-row is-${s.status}`, null, [h('div', 'nb-make-item', null, content)]);
    if (s.status === 'built' && s.repeatable) {
      const another = h('button', 'nb-make-another', { type: 'button' }, [`Build another · ${materialWords(s.cost)}`]);
      another.disabled = !!s.problem || !affordable;
      another.addEventListener('click', () => handlers.place(s.id));
      row.append(another);
      if (s.problem) row.append(h('p', 'nb-make-why', null, [s.problem]));
    }
    if (s.status === 'building' && view.phase !== 'morning') {
      const builders = view.friends.filter((f) => f.status === 'building' && f.base === s.region);
      row.append(h('p', 'nb-make-why', null, [builders.length ? `${builders.map((f) => f.name).join(' and ')} working today. Change builders in the morning.` : 'Choose builders in the morning.']));
    }
    if (s.status === 'building' && view.phase === 'morning' && handlers.work) {
      const people = h('div', 'nb-build-people', { role: 'group', 'aria-label': `Who ${mend ? 'mends' : 'builds'} ${s.name} today` });
      for (const person of view.friends.filter((f) => s.builders ? s.builders.includes(f.id) : f.base === s.region && f.lodging === undefined)) {
        const on = person.status === 'building';
        const b = h('button', 'nb-build-person', { type: 'button', 'aria-pressed': String(on), title: `${person.name} ${mend ? 'mends' : 'builds'} today${person.id === 'aki' ? ' · two days’ work' : ''}` }, [friendToken(person, 30), h('span', null, null, [on ? `${person.name} · ${mend ? 'mending' : 'building'}` : `${person.name} · ${mend ? 'mend' : 'build'} today`])]);
        b.addEventListener('click', () => handlers.work!(person.id));
        people.append(b);
      }
      row.append(people);
      row.append(h('p', 'nb-make-why', null, [s.builders?.length === 0 ? 'Left standing, too far from our camps now.' : 'Anyone left at camp will help. Choose an outing to send them elsewhere.']));
    }
    if (s.status === 'building' && view.phase === 'morning' && handlers.recover && s.siteId !== undefined) {
      row.append(wordButton(`Take it down · ${materialWords(s.recoverable ?? 0)} back`, () => handlers.recover!(s.siteId!), 'nb-quiet'));
    }
    return row;
  }
  const b = h('button', 'nb-make-item', { type: 'button', 'aria-disabled': String(!can) });
  b.dataset.k = `make-${s.id}`;
  b.append(...content);
  b.addEventListener('click', () => (can ? handlers.place(s.id) : handlers.refuse()));
  return h('li', `nb-make-row is-${s.status}${can ? '' : ' is-wanting'}`, null, [b]);
}

function kitRow(view: AdventureView, e: EquipmentView, handlers: MakeHandlers): HTMLElement {
  const can = !e.owned && view.materials >= e.cost;
  const withName = e.with ? (view.friends.find((f) => f.id === e.with)?.name ?? null) : null;
  const status = e.owned ? (withName ? `With ${withName}` : 'In the kit') : materialWords(e.cost);
  const content = [
    sketchEl(`item-${e.id}`, 36, e.owned),
    h('span', 'nb-make-body', null, [h('span', 'nb-make-name', null, [e.name]), h('span', 'nb-make-effect', null, [e.effect])]),
    h('span', `nb-make-cost${can ? ' is-ready' : ''}`, null, [status]),
  ];
  if (e.owned) return h('li', 'nb-make-row is-owned', null, [h('div', 'nb-make-item', null, content)]);
  const b = h('button', 'nb-make-item', { type: 'button', 'aria-disabled': String(!can) });
  b.dataset.k = `kit-${e.id}`;
  b.append(...content);
  b.addEventListener('click', () => (can ? handlers.craft(e.id) : handlers.refuse()));
  return h('li', `nb-make-row${can ? '' : ' is-wanting'}`, null, [b]);
}

const materialWords = (n: number): string => `${n} ${n === 1 ? 'material' : 'materials'}`;

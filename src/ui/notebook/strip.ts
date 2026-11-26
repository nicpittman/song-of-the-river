/**
 * Our companions by day. Folded, it is a single row of tokens in the bar at the
 * foot of the screen, each with the knot on its pack once a friend carries
 * something home. A tap unfolds it into a slip above the bar: who is where,
 * a hairline of how far the day has gone (which is how far along their trail
 * they are), and "Make" and "Skip to evening" beneath. Tapping a friend there
 * follows them in the valley.
 */

import type { AdventureCommand, AdventureView, FriendView } from '../../game/adventure/model';
import type { UiActions } from '../contract';
import { h } from '../dom';
import { focusKey, friendToken, restoreFocus, wordButton } from './ink';

export class Strip {
  /** The folded row of tokens, which lives in the bar. */
  readonly toggle = h('div', 'nb-group-row', { role: 'group', 'aria-label': 'People' });
  /** The unfolded slip above the bar. */
  readonly el = h('aside', 'nb-strip', { 'aria-label': 'Companions today', id: 'nb-strip' });
  private readonly list = h('ul', 'nb-strip-list');
  private readonly tools = h('div', 'nb-strip-tools');
  private open = false;
  private key = '';
  private rowKey = '';
  private view: AdventureView | null = null;

  constructor(
    private readonly actions: UiActions,
    private readonly command: (c: AdventureCommand) => void,
    /** In the morning the tokens open the leaf instead: planning happens there. */
    private readonly onMorning: (person?: string) => void,
  ) {
    this.el.append(this.list, this.tools);
    this.el.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      this.unfold(false);
    });
  }

  get unfolded(): boolean {
    return this.open;
  }

  update(view: AdventureView): void {
    this.view = view;
    // The day moves every frame or so; the trails are set directly rather than through a rebuild.
    this.list.style.setProperty('--p', view.dayProgress.toFixed(3));
    this.renderRow(view);
    const key = JSON.stringify([
      view.phase,
      view.provisions, view.materials,
      view.friends.map((f) => [f.id, f.status, f.statusLine, f.pack]),
      view.structures.map((s) => [s.id, s.status, s.problem, Math.round(s.progress * 20)]),
      view.equipment.map((e) => [e.id, e.owned, e.with]),
      this.open,
    ]);
    if (key === this.key) return;
    this.key = key;
    const focus = focusKey(this.el);
    this.el.classList.toggle('is-open', this.open);
    this.toggle.setAttribute('aria-expanded', String(this.open));
    this.list.replaceChildren(...view.friends.map((f) => this.row(f)));
    const make = wordButton('Build & equipment', () => {
      this.unfold(false);
      this.command({ type: 'notebook', page: 'make' });
    }, 'nb-quiet', 'strip-make');
    const skip = view.phase === 'day' ? wordButton('Skip to evening', () => this.skip(), 'nb-quiet', 'strip-skip') : null;
    this.tools.replaceChildren(make, ...(skip ? [skip] : []));
    restoreFocus(this.el, focus);
  }

  unfold(open: boolean): void {
    if (open === this.open) return;
    this.open = open;
    this.actions.cue(open ? 'leaf-open' : 'leaf-close');
    this.key = '';
    if (this.view) this.update(this.view);
    if (open) requestAnimationFrame(() => this.el.querySelector<HTMLElement>('button')?.focus({ preventScroll: true }));
  }

  /** Lets the rest of the day pass, from the bar or the slip. */
  skip(): void {
    this.actions.cue('click');
    this.unfold(false);
    this.command({ type: 'skip' });
  }

  /** The folded row: one small token per friend, knots showing, out friends a little forward. */
  private renderRow(view: AdventureView): void {
    const key = JSON.stringify([view.phase, view.friends.map((f) => [f.id, f.status, f.pack, f.storyNow])]);
    if (key === this.rowKey) return;
    this.rowKey = key;
    // Anyone stopped to talk comes first, so a phone's short row (three faces and "+N") never hides them.
    const faces = [...view.friends].sort((a, b) => Number(!!b.storyNow) - Number(!!a.storyNow));
    this.toggle.replaceChildren(...faces.map((f) => {
      const face = h('button', `nb-group-person${f.storyNow ? ' is-story' : ''}`, { type: 'button', 'aria-label': `${f.name}: ${f.statusLine}. ${f.storyNow ? 'A conversation here. ' : ''}${view.phase === 'morning' ? 'View plan.' : 'Go to person.'}` }, [friendToken(f, 30, `is-${f.status}`)]);
      if (f.storyNow) face.title = `${f.name} has stopped to talk. Go to person.`;
      face.addEventListener('click', () => this.focusPerson(f.id));
      return face;
    }));
    const details = h('button', 'nb-group-details', { type: 'button', 'aria-label': 'Companion details', 'aria-expanded': String(this.open), 'aria-controls': 'nb-strip' }, ['⌃']);
    details.addEventListener('click', () => this.view?.phase === 'morning' ? this.onMorning() : this.unfold(!this.open));
    // Shown only on a phone, where the row keeps three faces: the rest are counted, and open the list.
    if (faces.length > 3) {
      const hidden = faces.slice(3);
      const more = h('button', 'nb-group-more', { type: 'button', 'aria-label': `And ${hidden.map((f) => f.name).join(', ')}. Show everyone.` }, [`+${hidden.length}`]);
      more.addEventListener('click', () => this.view?.phase === 'morning' ? this.onMorning() : this.unfold(!this.open));
      this.toggle.append(more);
    }
    this.toggle.append(details);
    const out = view.friends.filter((f) => f.status === 'out').length;
    this.toggle.setAttribute('aria-label', out ? `Companions: ${out} out today. Show who is where.` : 'Companions. Show who is where.');
  }

  /** Portraits act directly; expanding the group is a separate small control. */
  focusPerson(person: string): void {
    if (this.view?.phase === 'morning') { this.onMorning(person); return; }
    this.unfold(false);
    this.command({ type: 'follow', person });
  }

  private row(friend: FriendView): HTMLElement {
    const out = friend.status === 'out';
    const b = h('button', `nb-strip-friend is-${friend.status}`, { type: 'button', 'aria-label': `${friend.name}: ${friend.statusLine}. Follow.` });
    b.dataset.k = `strip-${friend.id}`;
    const trail = h('span', 'nb-strip-trail', { 'aria-hidden': 'true' });
    trail.style.setProperty('--friend', friend.colour);
    b.append(
      friendToken(friend, 34),
      h('span', 'nb-strip-words', null, [
        h('span', 'nb-strip-name', null, [friend.name]),
        h('span', 'nb-strip-line', null, [friend.statusLine]),
        out ? trail : null,
      ]),
    );
    b.addEventListener('click', () => {
      this.actions.cue('click');
      this.unfold(false);
      this.command({ type: 'follow', person: friend.id });
    });
    return h('li', null, null, [b]);
  }
}

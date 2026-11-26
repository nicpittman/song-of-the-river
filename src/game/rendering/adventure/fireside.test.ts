import { describe, expect, it } from 'vitest';
import { FIRESIDE, FiresideUnpack, shortLine } from './fireside';

/** Plays the timeline at 60 fps, setting bundles down as it asks, and records when each thing happened. */
function play(total: number): { rises: number[]; lead: number | null; open: number | null } {
  const f = new FiresideUnpack();
  let shown = 0, settled = false, t = 0;
  const rises: number[] = []; let lead: number | null = null; let open: number | null = null;
  for (let i = 0; i < 60 * 60 && open === null; i++) {
    t += 1 / 60;
    const next = f.step(1 / 60, shown, total, settled);
    if (next === 'rise') { shown++; rises.push(t); if (shown === total) settled = true; }
    if (next === 'settle') settled = true;
    if (next === 'open') open = t;
    if (f.leadShowing && lead === null) lead = t;
  }
  return { rises, lead, open };
}

describe('unpacking at the fire', () => {
  it('lets a spoken outcome finish before introducing the next note', () => {
    const f = new FiresideUnpack();
    expect(f.step(FIRESIDE.gather, 0, 2, false)).toBe('rise');
    f.hold({ title: 'Met Aki the carpenter', text: '', kind: 'find', outcome: 'Finish a cottage or the footbridge in Mio, and Aki will come with us.' });
    expect(f.step(FIRESIDE.step + .1, 1, 2, false)).toBeNull();
    expect(f.step(4, 1, 2, false)).toBe('rise');
    f.hold({ title: 'One material', text: 'Useful timber.', kind: 'materials' });
    expect(f.step(FIRESIDE.step + .1, 2, 3, false)).toBe('rise');
  });
  it('sets bundles down one at a time after the gathering, then the lead, then the book', () => {
    const { rises, lead, open } = play(4);
    expect(rises).toHaveLength(4);
    expect(rises[0]).toBeGreaterThanOrEqual(FIRESIDE.gather);
    for (let i = 1; i < rises.length; i++) expect(rises[i]! - rises[i - 1]!).toBeCloseTo(FIRESIDE.step, 1);
    expect(lead! - rises[3]!).toBeCloseTo(FIRESIDE.step, 1);
    expect(open! - lead!).toBeCloseTo(FIRESIDE.lead, 1);
    // About four to six seconds at 1× for an ordinary evening.
    expect(open!).toBeGreaterThan(10);
    expect(open!).toBeLessThan(18);
  });

  it('settles an evening with nothing to unpack and still shows the lead', () => {
    const { rises, lead, open } = play(0);
    expect(rises).toHaveLength(0);
    expect(lead).not.toBeNull();
    expect(open).not.toBeNull();
  });

  it('skips straight to the book', () => {
    const f = new FiresideUnpack();
    f.step(0.5, 0, 3, false);
    f.skip();
    expect(f.done).toBe(true);
    expect(f.step(1, 0, 3, false)).toBeNull();
  });
});

it('lets the live presentation reveal each bundle without a second automatic unpack timer',async()=>{
  const {newExpedition,runUntil}=await import('../../adventure/testing');
  const {a,sim}=newExpedition();a.rest('sora');a.begin();runUntil(sim,()=>a.state.phase==='evening');
  a.presentingEvening=true;
  for(let i=0;i<300;i++) sim.step();
  expect(a.state.evening!.shown).toBe(0);
  a.command({type:'evening',step:'next'});
  expect(a.state.evening!.shown).toBe(1);
  for(let i=0;i<100;i++) sim.step();
  expect(a.state.evening!.shown).toBe(1);
});

it('keeps a quotation closed when only its first sentence is shown', () => {
  expect(shortLine({ text: '“A little bed of herbs near the fire. Somewhere to put the seeds before the bag splits.”' })).toBe('“A little bed of herbs near the fire.”');
  expect(shortLine({ text: '“Three planks.” Then he laughed.' })).toBe('“Three planks.”');
  expect(shortLine({ text: 'Star moss grows on the north sides of the stones.' })).toBe('Star moss grows on the north sides of the stones.');
});

it('moves on a line at a time when tapped, and the last tap opens the book', () => {
  const f = new FiresideUnpack();
  expect(f.next()).toBe(false);
  expect(f.step(0.01, 0, 2, false)).toBe('rise');
  f.hold({ title: 'A long line', text: 'Many words here to read slowly by the fire tonight, all of them.', kind: 'find' });
  expect(f.step(0.01, 1, 2, false)).toBeNull();
  expect(f.next()).toBe(false);
  expect(f.step(0.01, 1, 2, false)).toBe('rise');
  expect(f.next()).toBe(false);
  f.step(0.01, 2, 2, true);
  expect(f.leadShowing).toBe(true);
  expect(f.next()).toBe(true);
  expect(f.done).toBe(true);
});

import { expect, it } from 'vitest';
import { newExpedition } from '../../game/adventure/testing';
import { seaPreparation } from './seaPreparation';

it('makes the final journey a sequence of practical notebook actions', () => {
  const { a } = newExpedition(); a.state.region = 2;
  a.state.known.push('kawagiri', 'funaya', 'takayuka', 'kawaguchi');
  for (const person of a.state.people) person.base = 2;
  const find = (id: string) => { a.state.discoveries[id] = { day: 1, by: 'sora' }; };
  expect(seaPreparation(a.view())).toMatchObject({ place: 'funaya', activity: 'investigate' });
  find('boat-ledger'); expect(seaPreparation(a.view())).toMatchObject({ build: 'dock' });
  a.state.buildings.push({ id: 1, kind: 'dock', region: 2, x: 760, y: 5150, work: 2, placed: 1 });
  expect(seaPreparation(a.view())).toMatchObject({ build: 'boat' });
  a.state.buildings.push({ id: 2, kind: 'boat', region: 2, x: 820, y: 5350, work: 3, placed: 1 });
  expect(seaPreparation(a.view())).toMatchObject({ place: 'takayuka', activity: 'visit' });
  find('mended-sail'); expect(seaPreparation(a.view())).toMatchObject({ place: 'kawaguchi', activity: 'investigate' });
  find('tide-marks'); expect(seaPreparation(a.view())).toMatchObject({ activity: 'fish' });
  expect(seaPreparation(a.view())!.label).toContain('provisions');
  a.state.provisions = 20; expect(seaPreparation(a.view())).toBeNull(); expect(a.canSail).toBe(true);
});

it('leaves the earlier journey and Free Play free of the final preparation prompt', () => {
  const { a, sim } = newExpedition(); expect(seaPreparation(a.view())).toBeNull();
  a.state.region = 2; a.state.free = true; sim.state.mode = 'free'; expect(seaPreparation(a.view())).toBeNull();
});

it('names the missing sea preparation and offers builders for a boat that is already placed', () => {
  const { a } = newExpedition();
  a.state.region = 2; a.state.known.push('kawagiri', 'funaya', 'takayuka', 'kawaguchi');
  for (const person of a.state.people) person.base = 2;
  a.state.discoveries['boat-ledger'] = {day:1,by:'sora'};
  a.state.buildings.push({id:1,kind:'dock',region:2,x:1800,y:5800,placed:1,work:2}, {id:2,kind:'boat',region:2,x:1820,y:5920,placed:1,work:1});
  expect(seaPreparation(a.view())).toMatchObject({build:'boat',label:expect.stringContaining('restore')});
  a.state.buildings[1]!.work = 3;
  expect(a.sail(['sora'])).toMatchObject({ok:false,reason:'The boat will want a sail.'});
  a.state.discoveries['loft-sail'] = {day:1,by:'sora'};
  expect(a.sail(['sora'])).toMatchObject({ok:false,reason:'We need to know when the tide turns.'});
  a.state.discoveries['tide-marks'] = {day:1,by:'sora'}; a.state.provisions = 20;
  expect(a.sail(['sora']).ok).toBe(true);
});

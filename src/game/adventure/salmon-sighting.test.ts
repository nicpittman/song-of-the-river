import { expect, it } from 'vitest';
import { newExpedition } from './testing';

it('records the spring jumping salmon in the same collection entry as fishing, without resource rewards',()=>{
  const {a}=newExpedition(2086,true);
  a.state.tracked=['cherry-salmon'];
  a.rest('sora');a.begin();
  const salmon=a.state.sightings.find(s=>s.find==='cherry-salmon');
  expect(salmon).toBeDefined();
  a.state.elapsed=salmon!.appear+.1;
  const food=a.state.provisions;
  expect(a.sketch(salmon!.id)).toEqual({ok:true});
  expect(a.state.discoveries['cherry-salmon']).toMatchObject({by:'sketch',day:1});
  expect(a.view().journal.filter(e=>e.id==='cherry-salmon' && e.found)).toHaveLength(1);
  a.sketch(salmon!.id);
  expect(a.state.provisions).toBe(food);
});

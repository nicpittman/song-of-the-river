import { describe, expect, it } from 'vitest';
import { seseragi } from '../world/boards/seseragi';
import { newGameState, Simulation } from './simulation';
import { History } from '../interaction/history';
import { parseSave, defaultSave } from '../core/save';

const start=()=>new Simulation(seseragi,newGameState(seseragi,'free'));
const seconds=(s:Simulation,n:number)=>{for(let i=0;i<n*10;i++)s.step();};
const summer=(s:Simulation)=>{s.state.tick=750;};
function fishing(s:Simulation) {
  summer(s);s.state.arrivals['salmon-run'][0]=3;
  expect(s.chooseIdentity('seseragi-pool','fishing-reach').ok).toBe(true);
  const result=s.addConnection({type:'path',from:'seseragi',to:'fuchi-landing',control:[{x:620,y:1600},{x:710,y:1250}]});
  expect(result.ok).toBe(true);
}

describe('chosen places make observable seasonal life',()=>{
 it('offers a route-free wild meadow outcome, while hay needs a real footpath',()=>{
  const wild=start();expect(wild.chooseIdentity('hanano','wild-meadow').ok).toBe(true);
  seconds(wild,40);expect(wild.life.count('hanano','wild-meadow')).toBeGreaterThan(0);
  const hay=start();summer(hay);hay.chooseIdentity('hanano','hay-meadow');seconds(hay,40);
  expect(hay.life.count('hanano','hay-meadow')).toBe(0);expect(hay.life.problem('hanano')).toContain('footpath');
 });
 it('haymakers walk to the meadow, work, carry a harvest, and return',()=>{
  const s=start();summer(s);s.chooseIdentity('hanano','hay-meadow');
  const path=seseragi.solution.find(c=>c.type==='path'&&c.to==='hanano')!;
  expect(s.addConnection(path).ok).toBe(true);
  const phases=new Set<string>();for(let i=0;i<1400;i++){s.step();for(const a of s.state.life.actors)phases.add(a.phase);}
  expect(phases).toEqual(new Set(['outbound','working','homebound']));expect(s.life.count('hanano','hay-meadow')).toBeGreaterThan(0);
 });
 it('fishing includes arrival, casting/catch time and a return journey',()=>{
  const s=start();fishing(s);const phases=new Set<string>();
  for(let i=0;i<650;i++){s.step();for(const a of s.state.life.actors)if(a.kind==='fish')phases.add(a.phase);}
  expect(phases).toEqual(new Set(['outbound','working','homebound']));
  expect(s.life.count('seseragi-pool','fishing-reach')).toBeGreaterThan(0);
 });
 it('does not grant catches without a fish run or through a deleted route',()=>{
  const s=start();fishing(s);s.state.arrivals['salmon-run']=[0,0,0,0];seconds(s,20);
  expect(s.life.count('seseragi-pool','fishing-reach')).toBe(0);
  s.state.arrivals['salmon-run'][0]=3;seconds(s,10);s.removeConnection(s.connections[0].id);seconds(s,40);
  expect(s.life.count('seseragi-pool','fishing-reach')).toBe(0);
 });
 it('mill choice adds a fish-passage trade-off and undo restores the waterway',()=>{
  const s=start(),h=new History(s);const commit=h.begin();
  s.chooseIdentity('seseragi-pool','mill-reach');commit(0);
  expect(s.board.weirs?.some(w=>w.id==='identity-mill-weir')).toBe(true);
  const wish=seseragi.objectives.find(o=>o.id==='salmon-run')!;
  expect(s.outlook(wish).closure?.cause).toBe('weir');
  expect(h.undo()).toBe(true);expect(s.board.weirs?.some(w=>w.id==='identity-mill-weir')).toBe(false);
  expect(h.redo()).toBe(true);expect(s.state.identities['seseragi-pool']).toBe('mill-reach');
 });
 it('garden visitors replace a quiet bird stopover',()=>{
  const s=start();s.chooseIdentity('sagi','bird-refuge');expect(s.board.places.find(p=>p.id==='sagi')?.rest).toBe(true);
  s.chooseIdentity('sagi','shrine-garden');const p=s.board.places.find(p=>p.id==='sagi')!;
  expect(p.rest).toBe(false);expect(p.links).toEqual(['path']);
 });
 it('identity and in-progress activities survive save/load deterministically',()=>{
  const s=start();fishing(s);seconds(s,31);
  const save=defaultSave();save.free=structuredClone(s.state);
  const loaded=new Simulation(seseragi,parseSave(JSON.stringify(save)).free!);
  seconds(s,10);seconds(loaded,10);
  expect(loaded.state.life).toEqual(s.state.life);expect(loaded.state.identities).toEqual(s.state.identities);
 });
 it('legacy saves acquire identity/activity defaults without losing routes',()=>{
  const state=newGameState(seseragi,'free');delete (state as Partial<typeof state>).identities;delete (state as Partial<typeof state>).life;
  const s=new Simulation(seseragi,state);expect(s.state.identities).toEqual({});expect(s.state.life.actors).toEqual([]);
 });
 it('ignores corrupted activity records while preserving valid identity choices',()=>{
  const state=newGameState(seseragi,'free');state.identities.hanano='wild-meadow';
  state.life={next:NaN,actors:[{place:'hanano',identity:'wild-meadow',path:[{x:NaN,y:0}]}],totals:{'hanano:wild-meadow':[2,NaN,-4]},timers:{hanano:Infinity}} as unknown as typeof state.life;
  const s=new Simulation(seseragi,state);
  expect(s.state.identities.hanano).toBe('wild-meadow');expect(s.state.life.actors).toEqual([]);
  expect(s.life.count('hanano','wild-meadow')).toBe(2);seconds(s,15);
  expect(s.state.life.actors.every(a=>Number.isFinite(a.x))).toBe(true);
 });
 it('Journey accepts both a self-sustaining wild meadow and a connected grazing meadow',()=>{
  for(const role of ['wild-meadow','grazing-meadow'] as const){
   const s=new Simulation(seseragi,newGameState(seseragi,'journey'));summer(s);s.chooseIdentity('hanano',role);
   if(role==='grazing-meadow')expect(s.addConnection(seseragi.solution.find(c=>c.type==='corridor'&&c.to==='hanano')!).ok).toBe(true);
   seconds(s,60);
   expect(s.isGranted(seseragi.objectives.find(o=>o.id==='summer-grazing')!)).toBe(true);
  }
 });

});

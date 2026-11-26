import { expect,it } from 'vitest';
import { reviewGame, REVIEW_STAGES } from './review';
import { Simulation } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';

it.each(REVIEW_STAGES)('opens the disposable %s review scene', (stage)=>{
  const state=reviewGame(stage);
  const sim=new Simulation(adventureValley,state), a=sim.expedition!;
  // Sora leads every Journey stage; in Wander he is met, but keeps to his own journey.
  const wander = stage==='full-map' || stage==='wander';
  expect(a.state.people.some(p=>p.id==='sora')).toBe(!wander);
  expect(a.state.free).toBe(wander);
  if(stage==='evening') {expect(a.state.phase).toBe('evening');expect(a.state.evening?.settled).toBe(true);}
  if(stage==='boat') expect(a.canSail).toBe(true);
  if(stage==='crossing') {
    expect(a.state.people.every(p=>p.lodging==='ashikari')).toBe(true);
    expect(a.state.known).not.toContain('kawagiri');
    expect(a.state.people.map(p=>p.id)).not.toContain('yui');
  }
  if(stage==='ending') expect(a.state.voyage).toBe('sailing');
});

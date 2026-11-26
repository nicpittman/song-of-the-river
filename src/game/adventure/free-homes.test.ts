import {expect,it} from 'vitest';
import {newAdventure} from './state';
import {newGameState,Simulation} from '../simulation/simulation';
import {adventureValley} from '../world/boards/adventure';
import {homeName} from './world';
import {placeDef} from './content';
import {mapPosition} from '../../ui/notebook/campPoint';
import {FREE_PLAY_HOMES} from './people';

/** A Free Play valley in which everyone along the river has been met. */
const everyoneMet=(adventure:ReturnType<typeof newAdventure>)=>{
  for(const id of ['sora','ren','mina','aki'])adventure.people.push({id,...FREE_PLAY_HOMES[id]!,practice:{},memories:[]});
  // Their homes, and the coast, are on the map once they have been met there.
  for(const id of ['yamagoya','takayuka','matsubara']){adventure.known.push(id);adventure.visits[id]=1;}
  return adventure;
};

it('keeps coastal pins and idle companions on the real village and landing positions', () => {
  const game = newGameState(adventureValley, 'free'); game.adventure = everyoneMet(newAdventure(true));
  const a = new Simulation(adventureValley, game).expedition!;
  const view = a.view();
  for (const id of ['kawagiri','takayuka','matsubara']) {
    expect(view.places.find(place => place.id === id)!.at).toEqual(placeDef(id).at);
  }
  const yui = view.friends.find(friend => friend.id === 'yui')!;
  expect(mapPosition(view, yui)).toEqual(view.places.find(place => place.id === 'mio')!.at);
});
it('starts a fresh Free Play group at their own homes and preserves those homes on reload',()=>{
  const game=newGameState(adventureValley,'free');game.adventure=everyoneMet(newAdventure(true));
  const sim=new Simulation(adventureValley,game),s=sim.expedition!.state;
  expect(Object.fromEntries(s.people.map(p=>[p.id,homeName(s,p.id)]))).toEqual({haru:'Mio',yui:'Mio',sora:'Yamagoya',ren:'Seseragi',mina:'Seseragi',aki:'Mio'});
  const loaded=new Simulation(adventureValley,structuredClone(sim.state));
  expect(loaded.expedition!.state.people).toEqual(s.people);
});

it('keeps idle Free Play map portraits attached to their home marker while the villagers roam',async()=>{
  const {mapPosition}=await import('../../ui/notebook/campPoint');
  const {planningPins}=await import('../../ui/notebook/planRoutes');
  const game=newGameState(adventureValley,'free');game.adventure=everyoneMet(newAdventure(true));
  const sim=new Simulation(adventureValley,game),view=sim.expedition!.view();
  for(const person of view.friends) {
    const home=view.lodgings.find(l=>l.id===person.lodging)?.at ?? view.places.find(p=>p.region===person.base && p.kind==='settlement')!.at;
    expect(mapPosition(view,{...person,status:'home',at:{x:1,y:1}})).toEqual(home);
    expect(mapPosition(view,{...person,status:'out',at:{x:1,y:1}})).toEqual({x:1,y:1});
    expect(planningPins(view).find(pin=>pin.person===person.id)!.at).toEqual(home);
  }
});



it('uses the drawn inn marker as a home anchor rather than its physical doorstep',async()=>{
  const {mapPosition}=await import('../../ui/notebook/campPoint');
  const game=newGameState(adventureValley,'free');game.adventure=everyoneMet(newAdventure(true));
  game.adventure.day=2;game.adventure.visits.toroya=1;
  game.adventure.people.find(p=>p.id==='aki')!.lodging='toroya';
  const view=new Simulation(adventureValley,game).expedition!.view();
  const aki=view.friends.find(p=>p.id==='aki')!;
  const marker=view.places.find(p=>p.id==='toroya')!.at;
  expect(marker).not.toEqual(view.lodgings.find(p=>p.id==='toroya')!.at);
  expect(mapPosition(view,aki)).toEqual(marker);
});

it('lists Haru and Yui first in Free Play, then the friends met in river order',()=>{
  const game=newGameState(adventureValley,'free');game.adventure=everyoneMet(newAdventure(true));
  game.adventure.people.reverse();
  const view=new Simulation(adventureValley,game).expedition!.view();
  expect(view.friends.map(p=>p.id)).toEqual(['haru','yui','sora','ren','mina','aki']);
});

it('preserves the actual recruitment order in Journey, including late optional companions',async()=>{
  const {newExpedition}=await import('./testing');
  const {sim,a}=newExpedition(undefined,true);
  a.state.people.push(...['ren','aki','mina'].map(id=>({id,base:0,practice:{},memories:[]})));
  expect(a.view().friends.map(p=>p.id)).toEqual(['sora','ren','aki','mina']);
  const loaded=new Simulation(adventureValley,structuredClone(sim.state));
  expect(loaded.expedition!.view().friends.map(p=>p.id)).toEqual(['sora','ren','aki','mina']);
});

it('keeps Free Play morning advice local without calculating journeys for distant companions',async()=>{
  const {suggestedOutings}=await import('../../ui/notebook/recommendations');
  const {placeDef}=await import('./content');
  const game=newGameState(adventureValley,'free');game.adventure=everyoneMet(newAdventure(true));
  const view=new Simulation(adventureValley,game).expedition!.view();
  const forecast=view.forecast;let calls=0;
  view.forecast=plan=>{
    calls++;
    expect(placeDef(plan.place).region).toBe(view.region);
    expect(view.friends.find(f=>f.id===plan.person)!.base).toBe(view.region);
    return forecast(plan);
  };
  expect(suggestedOutings(view).length).toBeGreaterThan(0);
  expect(calls).toBeGreaterThan(0);
  expect(view.places.some(p=>p.region===2)).toBe(true);
});
it('follows the camp when it moves to another reach: the plan map’s home and the morning advice',async()=>{
  const {campPoint,homeName}=await import('../../ui/notebook/campPoint');
  const {suggestedOutings}=await import('../../ui/notebook/recommendations');
  const game=newGameState(adventureValley,'free');game.adventure=newAdventure(true);
  const a=new Simulation(adventureValley,game).expedition!;
  for(const p of a.state.people)p.base=2;
  const view=a.view();
  expect(campPoint(view)).toEqual(placeDef('kawagiri').at);
  expect(homeName(view)).toBe('Kawagiri');
  const advice=suggestedOutings(view);
  expect(advice.length).toBeGreaterThan(0);
  expect(advice.every(s=>placeDef(s.place).region===2)).toBe(true);
});

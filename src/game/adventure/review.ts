import { newGameState, Simulation, type GameState } from '../simulation/simulation';
import { adventureValley } from '../world/boards/adventure';
import { newAdventure } from './state';
import { PLACES } from './content';
import { isSecretPlace } from './places/freeplay';
import { FREE_PLAY_HOMES, PEOPLE } from './people';
import { creditsReplay } from './creditsReplay';
export const REVIEW_STAGES = [
  ['opening', 'Mountain opening'], ['seseragi', 'Seseragi · morning'], ['mio', 'Mio · morning'],
  ['crossing', 'Kawagiri · western arrival'], ['coast', 'Kawagiri · eastern village'],
  ['evening', 'Evening journal'], ['boat', 'Boat ready · boarding'], ['ending', 'Final voyage & credits'],
  ['wander', 'Wander · a fresh start'], ['full-map', 'Full map · everything open'],
] as const;
export type ReviewStage = (typeof REVIEW_STAGES)[number][0];
export function reviewGame(stage: ReviewStage): GameState {
  if (stage === 'full-map') return fullMap();
  if (stage === 'wander') {
    // Wander as a player first finds it, even before a Journey has opened it.
    const game = newGameState(adventureValley, 'free');
    game.adventure = newAdventure(true);
    game.chapter = 2;
    return game;
  }
  const game = newGameState(adventureValley, 'journey');
  const s = game.adventure = newAdventure(false, stage !== 'opening');
  if (stage === 'opening') return game;
  const region = ['mio', 'evening'].includes(stage) ? 1 : stage === 'seseragi' ? 0 : 2;
  s.region = game.chapter = region; s.day = region === 0 ? 4 : region === 1 ? 15 : 27;
  s.people = PEOPLE.filter(p=>region===2 && stage!=='crossing' || ['sora','ren','mina',...(region>=1?['aki']:[])].includes(p.id)).map((p) => ({ id:p.id, base:region, practice:{}, memories:[], ...(stage === 'crossing' ? {lodging:'ashikari'} : {}) }));
  s.provisions = 25; s.materials = 30; s.dayStart = { provisions:25, materials:30 };
  s.known = PLACES.filter((p) => p.region <= region && !isSecretPlace(p.id) && !(stage === 'crossing' && p.region === 2 && !['ashikari','shiobashi','shirasagi','hosokawa'].includes(p.id))).map((p) => p.id);
  s.visits = { yamagoya:1, seseragi:1, ...(region > 0 ? {mio:1} : {}), ...(region === 2 ? {ashikari:1} : {}), ...(region === 2 && stage !== 'crossing' ? {kawagiri:1} : {}) };
  for (const id of ['ren-meeting','mina-meeting','wild-mint', ...(region > 0 ? ['miller','waymark','aki-meeting','boat-ledger'] : []), ...(region === 2 && stage !== 'crossing' ? ['coastal-path','haru-meeting','yui-meeting'] : [])]) s.discoveries[id]={day:Math.max(1,s.day-1),by:'sora'};
  if (stage === 'boat' || stage === 'ending') {
    s.buildings.push({id:s.nextId++,kind:'dock',region:2,x:1800,y:5800,work:3,placed:s.day-1},{id:s.nextId++,kind:'boat',region:2,x:1820,y:5940,work:4,placed:s.day-1});
    for (const id of ['mended-sail','tide-marks','first-sea']) s.discoveries[id]={day:s.day-1,by:'sora'};
  }
  if (stage === 'ending') return creditsReplay(game);
  if (stage === 'evening') {
    const sim=new Simulation(adventureValley,game), a=sim.expedition!;
    // Everyone out at a different place round Mio, each at what they do best: a full evening's unpacking.
    const view=a.view(), around=['ringozaka','kurumaya','nishibayashi','toroya','higashida','omagari'], taken=new Set<string>();
    for (const friend of view.friends) {
      const place=view.places.find(p=>around.includes(p.id)&&!taken.has(p.id)&&p.activities.includes(friend.gift)) ?? view.places.find(p=>around.includes(p.id)&&!taken.has(p.id));
      if (!place) continue;
      taken.add(place.id);
      a.assign({person:friend.id,place:place.id,activity:place.activities.includes(friend.gift)?friend.gift:place.activities[0],item:null,companion:null});
    }
    a.begin();
    for(let i=0;i<1500&&a.state.phase==='day';i++) sim.step();
    a.collectReturns(); return sim.state;
  }
  return game;
}

/** The whole valley at once, for review: Wander with every place known (the secret ones too), everyone but Sora along, and plenty in the stores. */
function fullMap(): GameState {
  const game = newGameState(adventureValley, 'free');
  const s = game.adventure = newAdventure(true);
  game.chapter = 2;
  s.known = PLACES.map((p) => p.id);
  s.rumoured = [];
  s.visits = Object.fromEntries(PLACES.filter((p) => p.kind === 'settlement').map((p) => [p.id, 1]));
  // Sora is met, but keeps to his own journey: never one of the group in Wander.
  s.people = Object.entries(FREE_PLAY_HOMES).filter(([id]) => id !== 'sora').map(([id, home]) => ({ id, base: home.base, practice: {}, memories: [], ...(home.lodging ? { lodging: home.lodging } : {}) }));
  for (const id of ['ren-meeting', 'mina-meeting', 'aki-meeting', 'haru-meeting', 'yui-meeting', 'sora-meeting']) s.discoveries[id] = { day: 1, by: 'haru' };
  s.provisions = 40; s.materials = 40; s.dayStart = { provisions: 40, materials: 40 };
  return game;
}

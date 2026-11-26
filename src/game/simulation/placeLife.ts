/** Saved, deterministic little activities. Routes come from the real navigation network. */
import { dist, type Vec } from '../core/math';
import { IDENTITIES, identityFor, type ActivityKind } from '../world/identities';
import { isDisturbed, flightRoute } from './flight';
import { findRoute } from '../world/network';
import { landLegs, type Leg, legLength } from './legs';
import type { Simulation } from './simulation';

export interface LifeActor {
  id: number; place: string; identity: string; kind: ActivityKind;
  phase: 'outbound'|'working'|'homebound'; path: Vec[]; distance: number; x: number; y: number;
  work: number; duration: number; season: number; angle: number; deliveries: number; home: string;
}
export interface LifeState { next: number; actors: LifeActor[]; timers: Record<string,number>; totals: Record<string,number[]> }
export const newLifeState = (): LifeState => ({next:1,actors:[],timers:{},totals:{}});
/** Reads saved place activity, dropping malformed records instead of breaking a valley. */
export function restoreLifeState(raw: unknown): LifeState {
  const result=newLifeState();
  if(!raw || typeof raw!=='object')return result;
  const value=raw as Partial<LifeState>;
  if(value.totals && typeof value.totals==='object')for(const def of IDENTITIES){
    const key=`${def.place}:${def.id}`,a=value.totals[key];
    if(Array.isArray(a))result.totals[key]=[0,1,2,3].map(i=>Number.isFinite(a[i])?Math.max(0,Math.floor(a[i])):0);
  }
  if(value.timers&&typeof value.timers==='object')for(const def of IDENTITIES){const n=value.timers[def.place];if(Number.isFinite(n))result.timers[def.place]=Math.max(0,Math.min(120,n));}
  if(Array.isArray(value.actors))for(const a of value.actors.slice(0,12)) {
    if(!a||!identityFor(a.place,a.identity)||!['outbound','working','homebound'].includes(a.phase)||!Array.isArray(a.path)||a.path.length<2||a.path.length>4096)continue;
    if(!a.path.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y))||!['id','distance','x','y','work','duration','season','angle','deliveries'].every(k=>Number.isFinite(a[k as keyof LifeActor])))continue;
    if(a.duration<=0||a.duration>120||a.distance<0||!Number.isInteger(a.id)||a.id<1||!Number.isInteger(a.season)||a.season<0||a.season>3||identityFor(a.place,a.identity)?.activity!==a.kind||result.actors.some(old=>old.id===a.id))continue;
    result.actors.push(structuredClone(a));
  }
  result.next=Math.max(1,Number.isFinite(value.next)?Math.floor(value.next!):1,...result.actors.map(a=>a.id+1));
  return result;
}

function trace(legs: Leg[]): Vec[] {
  const points: Vec[]=[];
  for(const leg of legs) {
    const n=Math.max(1,Math.ceil(legLength(leg)/20));
    for(let i=0;i<=n;i++) { const p=leg.line.at(leg.from+(leg.to-leg.from)*i/n); points.push({x:p.x,y:p.y}); }
  }
  return points;
}
function position(actor: LifeActor, distance: number): void {
  let left=distance;
  for(let i=1;i<actor.path.length;i++) {
    const a=actor.path[i-1],b=actor.path[i],length=dist(a,b);
    if(left<=length || i===actor.path.length-1) {
      const t=length?Math.min(1,left/length):0;
      actor.x=a.x+(b.x-a.x)*t;actor.y=a.y+(b.y-a.y)*t;actor.angle=Math.atan2(b.y-a.y,b.x-a.x)+(actor.phase==='homebound'?Math.PI:0);return;
    }
    left-=length;
  }
}
const pathLength=(path:Vec[]):number=>path.slice(1).reduce((s,p,i)=>s+dist(path[i],p),0);

export class PlaceLife {
  private readonly routes=new Map<string,Vec[]|null>();
  constructor(private readonly sim: Simulation) {
    sim.events.on('network',()=>{
      this.routes.clear();
      for(const a of this.state.actors) {
        if(a.kind==='pollinate')continue;
        const route=this.way(a.place,a.kind==='graze'?'deer':a.kind==='birds'?'bird':'villager');
        if(route){const progress=a.distance/Math.max(1,pathLength(a.path));a.path=route;a.distance=progress*pathLength(route);}
      }
    });
  }
  get state():LifeState { return this.sim.state.life; }
  count(place:string,identity:string,season?:number):number { const a=this.state.totals[`${place}:${identity}`]??[];return season===undefined?a.reduce((s,n)=>s+n,0):a[season]??0; }
  /** Describes a current constraint using the same rules that dispatch actors. */
  problem(placeId:string):string|null {
    const s=this.sim, def=identityFor(placeId,s.state.identities[placeId]);
    if(!def)return null;
    if(!def.seasons.includes(s.season))return `This place rests in ${['spring','summer','autumn','winter'][s.season]}.`;
    if(def.id==='fish-run')return null;
    if(def.activity==='mill' && s.river.nearest(s.board.places.find(p=>p.id===placeId)!).channel.def.dry?.includes(s.season))return 'The mill channel is too shallow this season.';
    if(['pollinate','birds'].includes(def.activity)) {
      const place=s.board.places.find(p=>p.id===placeId)!;
      if(isDisturbed(place,s.connections))return 'Nearby footpaths disturb the quiet habitat.';
    }
    if(def.activity==='fish' && !(s.state.arrivals['salmon-run']??[]).some(n=>n>0))return 'Waiting for the spring salmon to reach Fuchi.';
    if(['fish','mill','hay','garden'].includes(def.activity) && !this.way(placeId,'villager'))return 'Needs an open village footpath to this place.';
    if(def.activity==='graze'&&!this.way(placeId,'deer'))return 'Needs an open woodland corridor from Kamimori.';
    if(def.activity==='birds' && !this.way(placeId,'bird'))return 'The birds need a quiet chain of resting places within flight range.';
    return null;
  }
  private way(placeId:string,who:'villager'|'deer'|'bird'):Vec[]|null {
    const key=`${placeId}:${who}:${this.sim.season}`;
    if(!this.routes.has(key))this.routes.set(key,this.computeWay(placeId,who));
    return this.routes.get(key)!;
  }
  private computeWay(placeId:string,who:'villager'|'deer'|'bird'):Vec[]|null {
    const s=this.sim,from=who==='deer'?'kamimori':who==='bird'?'kagami':'seseragi';
    const to=placeId==='seseragi-pool'?'fuchi-landing':placeId;
    if(!s.board.places.some(p=>p.id===from)||!s.board.places.some(p=>p.id===to))return null;
    if(who==='bird') {const r=flightRoute(s.board,s.connections,from,to);return r&&!r.closure?trace(r.legs):null;}
    const route=findRoute(s.connections,who,s.season,from,to);return route?trace(landLegs(route)):null;
  }
  step(dt:number):void {
    const s=this.sim,life=this.state;
    for(const def of IDENTITIES) {
      if(s.state.identities[def.place]!==def.id||def.id==='fish-run'||this.problem(def.place))continue;
      if(life.actors.filter(a=>a.place===def.place).length>=3)continue;
      life.timers[def.place]=(life.timers[def.place]??1)-dt;
      if(life.timers[def.place]>0)continue;
      life.timers[def.place]=def.activity==='pollinate'?8:10;
      const place=s.board.places.find(p=>p.id===def.place)!;
      const who=def.activity==='graze'?'deer':def.activity==='birds'?'bird':'villager';
      const local=def.activity==='pollinate';
      const path=local?[{x:place.x-55,y:place.y+20},{x:place.x+25,y:place.y}]:this.way(def.place,who);
      if(!path?.length)continue;
      const start=path[0];
      life.actors.push({id:life.next++,place:def.place,identity:def.id,kind:def.activity,phase:'outbound',path,distance:0,x:start.x,y:start.y,work:0,duration:def.activity==='hay'?12:def.activity==='fish'?14:10,season:s.season,angle:0,deliveries:0,home:who==='deer'?'kamimori':who==='bird'?'kagami':'seseragi'});
    }
    for(const a of [...life.actors]) {
      const changed=s.state.identities[a.place]!==a.identity;
      const def=identityFor(a.place,a.identity);
      if(changed || !def) {
        if(a.phase!=='homebound') {a.phase='homebound';a.distance=Math.min(a.distance,pathLength(a.path));}
      }
      // An edit or seasonal closure never permits an actor to walk through it.
      if(a.kind!=='pollinate' && !this.way(a.place,a.kind==='graze'?'deer':a.kind==='birds'?'bird':'villager')) {
        life.actors=life.actors.filter(x=>x!==a);continue;
      }
      if(a.kind==='mill' && a.phase==='working' && s.river.nearest(s.board.places.find(p=>p.id===a.place)!).channel.def.dry?.includes(s.season)) {a.phase='homebound';a.distance=pathLength(a.path);}
      const length=pathLength(a.path),speed=a.kind==='graze'?70:a.kind==='birds'?130:a.kind==='pollinate'?45:50;
      if(a.phase==='outbound') {a.distance=Math.min(length,a.distance+speed*dt);position(a,a.distance);if(a.distance>=length){a.phase='working';a.work=0;}}
      else if(a.phase==='working') {
        a.work+=dt;
        const end=a.path[a.path.length-1];
        a.x=end.x+Math.sin(a.work*.55+a.id)* (a.kind==='graze'?24:3);a.y=end.y+Math.cos(a.work*.7+a.id)* (a.kind==='graze'?12:1.5);
        if(a.work>=a.duration) {
          a.deliveries=1;a.phase='homebound';a.distance=length;
          const tally=life.totals[`${a.place}:${a.identity}`]??=[0,0,0,0];tally[a.season]++;
          s.events.emit('activity',{place:a.place,identity:a.identity,kind:a.kind});
        }
      } else {a.distance=Math.max(0,a.distance-speed*dt);position(a,a.distance);if(a.distance<=0)life.actors=life.actors.filter(x=>x!==a);}
    }
  }
}

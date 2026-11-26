/** Identity scenery and little activities, all read from deterministic simulation state. */
import { Container, Graphics, Sprite } from 'pixi.js';
import type { Simulation } from '../simulation/simulation';
import { millWheelSpeed } from '../world/millFlow';
import { IDENTITIES, identityFor } from '../world/identities';
import type { SceneryLayer } from './sceneryLayer';
import type { ArtLibrary } from './art';
import type { LifeActor } from '../simulation/placeLife';

interface Figure { root: Container; body: Sprite; action: Graphics; asset: string; catch?: Sprite }
export class PlaceLifeLayer {
  private readonly figures = new Map<number,Figure>();
  private readonly wheels: Array<{root:Container;rotor:Sprite;permanent:boolean;paddle:{x:number;y:number};speed:number}>=[];
  private key='';
  private readonly placeKeys=new Map<string,string>();
  private time=0;
  private flowKey='';
  private readonly weir=new Graphics();
  constructor(private readonly sim:Simulation,private readonly art:ArtLibrary,private readonly sorted:Container,private readonly scenery:SceneryLayer) {
    sorted.addChild(this.weir);
    if(art.has('mill-body'))for(const item of sim.board.sprites.filter(s=>s.asset==='watermill')) {
      const scale=(item.scale??1)*art.get('watermill').width/art.get('mill-body').width;
      this.addWheel(item.x,item.y,scale,true);
    }
  }
  private addWheel(x:number,y:number,scale:number,permanent:boolean,angle=0):void {
    const body=this.art.get('mill-body'), wheel=this.art.get('mill-wheel');
    const attachment=body.attachments?.wheel??{offset:[64,-58],diameter:120};
    const rotor=new Sprite(wheel.texture);rotor.anchor.set(...wheel.anchor);
    rotor.width=rotor.height=(attachment.diameter??120)*scale;rotor.rotation=angle;
    this.scenery.reserveFocalView(permanent?`mill:${x}:${y}`:'mill:fuchi',{left:x-110*scale,right:x+115*scale,top:y-165*scale,bottom:y+10*scale,depth:y});
    const root=new Container();root.scale.x=.78;root.skew.y=.08;root.position.set(x+attachment.offset[0]*scale,y+attachment.offset[1]*scale);root.zIndex=y+1;root.addChild(rotor);this.sorted.addChild(root);this.wheels.push({root,rotor,permanent,paddle:{x:root.x,y:root.y+(attachment.diameter??120)*scale*.5},speed:0});this.flowKey='';
  }
  update(dt:number,paused:boolean,reduced:boolean):void {
    if(!paused)this.time+=dt;
    const sim=this.sim;
    const key=JSON.stringify([sim.state.identities,sim.season,sim.state.life.totals]);
    if(key!==this.key){this.key=key;this.paintPlaces();}
    const flowKey=`${sim.season}:${sim.state.opened.join(',')}`;
    if(this.flowKey!==flowKey){this.flowKey=flowKey;for(const wheel of this.wheels)wheel.speed=millWheelSpeed(sim.river,wheel.paddle,sim.season);}
    for(const wheel of this.wheels) if(!paused && !reduced)wheel.rotor.rotation+=dt*wheel.speed;
    const live=new Set<number>();
    for(const a of sim.state.life.actors){
      live.add(a.id);let f=this.figures.get(a.id);
      if(!f){const root=new Container(),body=new Sprite(),action=new Graphics();root.addChild(body,action);this.sorted.addChild(root);f={root,body,action,asset:''};this.figures.set(a.id,f);}
      this.paintActor(f,a,reduced);
    }
    for(const [id,f] of this.figures)if(!live.has(id)){f.root.destroy({children:true});this.figures.delete(id);}
  }
  private paintPlaces():void {
    this.weir.clear();
    for(const w of this.sim.board.weirs??[])if(w.id==='identity-mill-weir') {
      const hit=this.sim.river.nearest(w),angle=hit.channel.line.at(hit.along).angle;
      const nx=-Math.sin(angle),ny=Math.cos(angle),half=hit.half;
      this.weir.moveTo(w.x-nx*half,w.y-ny*half).lineTo(w.x+nx*half,w.y+ny*half).stroke({color:0x777c6b,width:7});
      this.weir.moveTo(w.x-nx*half+2,w.y-ny*half+4).lineTo(w.x+nx*half+2,w.y+ny*half+4).stroke({color:0xdce8de,width:3,alpha:.8});
      this.weir.zIndex=w.y;
    }
    for(const id of new Set(IDENTITIES.map(d=>d.place))) {
      const group=`identity:${id}`;const def=identityFor(id,this.sim.state.identities[id]);
      const n=def?this.sim.life.count(id,def.id):0;
      const key=JSON.stringify([def?.id,def?.activity==='hay'?Math.min(4,n):def?.activity==='fish'?Math.min(1,n):0]);
      if(this.placeKeys.get(id)===key)continue;this.placeKeys.set(id,key);
      let wheelAngle=0;
      if(id==='seseragi-pool'){this.scenery.reserveFocalView('mill:fuchi',null);wheelAngle=this.wheels.find(w=>!w.permanent)?.rotor.rotation??0;for(let i=this.wheels.length-1;i>=0;i--)if(!this.wheels[i].permanent){this.wheels[i].root.destroy({children:true});this.wheels.splice(i,1);}}
      if(!def){this.scenery.removeGroup(group);continue;}
      const p=this.sim.board.places.find(p=>p.id===id);if(!p)continue;
      const items=def.decorations.map(([asset,dx,dy,scale],i)=>({asset,x:p.x+dx,y:p.y+dy,scale,flip:false,roll:i*.31,fixed:true}));
      if(def.activity==='hay'&&n)for(let i=0;i<Math.min(4,n);i++)items.push({asset:'haystack',x:p.x-40+i*28,y:p.y+65,scale:.8,flip:false,roll:0,fixed:true});
      if(def.activity==='fish'&&n)items.push({asset:'fish-basket',x:p.x-160,y:p.y+74,scale:.8,flip:false,roll:0,fixed:true});
      this.scenery.setGroup(group,items,true);
      if(def.activity==='mill') {
        const mill=items.find(item=>item.asset==='mill-body');
        if(mill)this.addWheel(mill.x,mill.y,mill.scale,false,wheelAngle);
      }
    }
  }
  private paintActor(f:Figure,a:LifeActor,reduced:boolean):void {
    const working=a.phase==='working',t=this.time;
    const frame=!working&&!reduced?Math.floor(t*3+a.id)%2:0;
    const prefix=a.kind==='hay'?'villager-farmer-walk':'villager-walk';
    const id=a.kind==='graze'?`deer-walk-${!working&&!reduced?Math.floor(t*5+a.id)%4:0}`:a.kind==='birds'?(working?'heron':'bird-up'):a.kind==='pollinate'?'butterfly':`${prefix}-${frame}`;
    if(id!==f.asset){const art=this.art.get(id);f.asset=id;f.body.texture=art.texture;f.body.anchor.set(...art.anchor);f.body.width=art.width;f.body.height=art.height;}
    f.root.position.set(a.x,a.y);f.root.zIndex=a.y+1;
    f.body.scale.x=Math.abs(f.body.scale.x)*(working&&a.kind==='fish'?1:Math.cos(a.angle)<0?-1:1);
    f.body.rotation=working?(a.kind==='graze'?.15+Math.sin(t*.9)*.07:a.kind==='hay'?Math.sin(t*2)*.08:0):0;
    f.body.y=working?0:reduced?0:-Math.abs(Math.sin(t*5+a.id))*1.5;
    if(f.catch)f.catch.visible=false;
    if(working&&a.kind==='fish'&&a.work%5>4.1) {
      if(!f.catch){const art=this.art.get('salmon');f.catch=new Sprite(art.texture);f.catch.anchor.set(.5);f.catch.width=17;f.catch.height=17*art.height/art.width;f.root.addChild(f.catch);}
      const lift=(a.work%5-4.1)/.9;
      f.catch.visible=true;f.catch.position.set(56*(1-lift),3-25*Math.sin(lift*Math.PI));f.catch.rotation=-.5+lift;
    }
    const g=f.action;g.clear();
    if(working&&a.kind==='fish') {
      const sway=reduced?0:Math.sin(t*1.4)*2;
      g.moveTo(3,-17).lineTo(23,-35+sway).stroke({color:0x685239,width:1.5});
      g.moveTo(23,-35+sway).quadraticCurveTo(41,-22,56,3).stroke({color:0xe6dec4,width:.6});
      const pulse=(a.work%4)/4;
      g.ellipse(56,3,4+pulse*13,2+pulse*5).stroke({color:0xd0e6df,width:1,alpha:1-pulse});
      if(a.work%5>4.1){g.moveTo(54,1).lineTo(52,-6).moveTo(59,2).lineTo(63,-4).stroke({color:0xe5f2ec,width:1});}
    }
    if(working&&a.kind==='hay') {
      g.moveTo(4,-15).lineTo(17+Math.sin(t*2)*5,0).stroke({color:0x8a7150,width:1});
      g.moveTo(11,2).quadraticCurveTo(26,-1,25,4).stroke({color:0xc9d3c0,width:1});
    }
    if(a.phase==='homebound'&&a.deliveries&&['hay','fish','mill'].includes(a.kind)) {
      g.roundRect(-10,-22,12,13,2).fill({color:a.kind==='hay'?0xc7ad61:0x9c7a4a});
      for(let i=0;i<3;i++)g.moveTo(-10,-19+i*3).lineTo(2,-19+i*3).stroke({color:0x6b583e,width:.6});
    }
  }
}

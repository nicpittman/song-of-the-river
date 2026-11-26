import type { ConnectionType, Season } from './types';

export type IdentityId = 'wild-meadow' | 'grazing-meadow' | 'hay-meadow' | 'fish-run' | 'fishing-reach' | 'mill-reach' | 'bird-refuge' | 'reed-wetland' | 'shrine-garden';
export type ActivityKind = 'pollinate' | 'graze' | 'hay' | 'fish' | 'mill' | 'birds' | 'garden';
export interface IdentityDef {
  id: IdentityId; place: string; title: string; description: string; needs: string; tradeoff: string;
  activity: ActivityKind; seasons: Season[]; links: ConnectionType[]; rest: boolean;
  decorations: Array<[asset: string, dx: number, dy: number, scale: number]>;
}
export const IDENTITIES: readonly IdentityDef[] = [
  { id:'wild-meadow',place:'hanano',title:'Wild Meadow',description:'Let flowers spread and insects find the high grass.',needs:'Spring and summer; a quiet meadow. No drawn route needed.',tradeoff:'No hay harvest or managed deer grazing. Busy paths disturb this quiet habitat.',activity:'pollinate',seasons:[0,1],links:[],rest:true,decorations:[['flower-meadow',-48,18,.9],['wildflowers',58,36,1],['shrubs',-80,-20,.55]] },
  { id:'grazing-meadow',place:'hanano',title:'Grazing Meadow',description:'Give the herd a summer home in the high grass.',needs:'A woodland corridor from Kamimori, open in summer.',tradeoff:'Shorter grass and animal tracks replace the wildflower meadow. No village haymaking.',activity:'graze',seasons:[1],links:['corridor'],rest:true,decorations:[['moss-grasses',-45,28,1],['moss-grasses',50,10,.9],['small-rocks',80,40,.55]] },
  { id:'hay-meadow',place:'hanano',title:'Hay Meadow',description:'Begin a small tradition of cutting and carrying the summer hay.',needs:'A summer footpath from Seseragi; workers must walk there and home.',tradeoff:'Mown rows replace flowers. People keep deer and shy birds away.',activity:'hay',seasons:[1],links:['path'],rest:false,decorations:[['crop-rows',0,35,.8],['scarecrow',70,20,.75]] },
  { id:'fish-run',place:'seseragi-pool',title:'Fish Run',description:'Keep Fuchi wild, with a clear passage for returning salmon.',needs:'Spring salmon need an open river. Stepping stones in use and weirs block passage.',tradeoff:'No fishing platform or milling activity at this reach.',activity:'birds',seasons:[0],links:[],rest:false,decorations:[['river-stones',-50,42,.7],['water-ripples',15,10,.7]] },
  { id:'fishing-reach',place:'seseragi-pool',title:'Fishing Reach',description:'Give the village a place to sit beside the pool and cast a line.',needs:'A footpath to Fuchi Landing, spring or summer, after salmon have reached Fuchi.',tradeoff:'Village visits disturb sensitive birds. Fishing pauses when the fish run has not arrived.',activity:'fish',seasons:[0,1],links:[],rest:false,decorations:[['dock',-145,55,.55],['fish-trap',-120,70,.8],['basket',-160,62,.8]] },
  { id:'mill-reach',place:'seseragi-pool',title:'Mill Reach',description:'Set a little mill beside the running water.',needs:'A footpath to Fuchi Landing and a flowing river in spring, summer or autumn.',tradeoff:'The mill weir blocks new upstream fish journeys. Switch back before the spring run to reopen passage.',activity:'mill',seasons:[0,1,2],links:[],rest:false,decorations:[['mill-body',-107,65,.62],['shed',-195,90,.6]] },
  { id:'bird-refuge',place:'sagi',title:'Bird Refuge',description:'Keep the heron pool quiet for birds arriving down the valley.',needs:'Spring and autumn; quiet resting places within flight range.',tradeoff:'Footpaths close to the pool frighten birds away. No garden visitors.',activity:'birds',seasons:[0,2],links:[],rest:true,decorations:[['wetland-reeds',-45,25,.8],['bank-vegetation',46,20,.8]] },
  { id:'reed-wetland',place:'sagi',title:'Reed Wetland',description:'Let reeds spread around the shallow edges of the pool.',needs:'Spring, summer and autumn; quiet access for wetland birds.',tradeoff:'Denser reeds leave less open water and make this a wildlife habitat rather than a village garden.',activity:'birds',seasons:[0,1,2],links:[],rest:true,decorations:[['reedbed',-35,15,.7],['wetland-reeds',45,-15,1.1],['wetland-reeds',55,40,1]] },
  { id:'shrine-garden',place:'sagi',title:'Shrine Garden',description:'Make a small planted place for quiet walks and seasonal visits.',needs:'A footpath from the village in spring, summer or autumn.',tradeoff:'The garden welcomes people; sensitive migrating birds will need another resting place.',activity:'garden',seasons:[0,1,2],links:['path'],rest:false,decorations:[['shrine',-30,-5,.6],['cherry-spring',55,-25,.7],['lantern',-60,35,.55]] },
];
export const identityFor = (place: string, id: string | undefined): IdentityDef | undefined => IDENTITIES.find((d) => d.place === place && d.id === id);
export const identitiesFor = (place: string): readonly IdentityDef[] => IDENTITIES.filter((d) => d.place === place);

/** A chosen way of life replaces the corresponding prescribed route wish. */
export function identityForObjective(id:string,chosen:Record<string,string>): IdentityDef|undefined {
  const place=['summer-grazing','hay-making'].includes(id)?'hanano':id==='salmon-run'?'seseragi-pool':id==='swans'?'sagi':null;
  return place?identityFor(place,chosen[place]):undefined;
}

/* Tower lifts use physical landings and clear shafts reserved for the cabin. */
const LIFT_SITES=[['burj',BURJ_LIFT],['sail',ARAB_LIFT]].map(([type,model])=>{
 const l=lmOf(type),xz=(x,z)=>{const p=[0,0];lm2w(l,x,z,p);return{x:p[0]+.5,z:p[1]+.5}};
 return{name:lmName(l),type,shaft:xz(...model.shaft),stops:model.stops.map(p=>({...p,...xz(p.x,p.z),y:l.y0+p.y,yaw:p.yaw-l.o*Math.PI/2}))};
});
const LIFT_SHAFT_CELLS=new Map(),LIFT_RESERVED=new Set();
for(const e of LIFT_SITES){
 const x=Math.floor(e.shaft.x),z=Math.floor(e.shaft.z),lo=e.stops[0].y,hi=e.stops[e.stops.length-1].y+1;
 LIFT_SHAFT_CELLS.set(x+z*WX,[lo,hi]);
 for(let y=lo;y<=hi;y++)LIFT_RESERVED.add(gkey(x,y,z));
 for(const p of e.stops)for(let y=p.y-1;y<=p.y+1;y++)LIFT_RESERVED.add(gkey(Math.floor(p.x),y,Math.floor(p.z)));
}
function liftShaftSolid(x,y,z){const h=LIFT_SHAFT_CELLS.get(x+z*WX);return h&&y>=h[0]&&y<=h[1]}
const liftProtected=(x,y,z)=>LIFT_RESERVED.has(gkey(x,y,z));
let LIFT_RIDE=null;
function liftNear(){
 if(!playing||curModal||FLY||TP||MG.on||mapDialog.open||LIFT_RIDE)return null;
 for(const e of LIFT_SITES)for(const p of e.stops)if(Math.abs(player.y-p.y)<.6&&Math.hypot(player.x-p.x,player.z-p.z)<1.55)return{e,p};
 return null;
}
function liftPanel(){
 const n=liftNear();if(!n)return false;
 const {e,p}=n;
 modal(`<h2>${e.name} elevator</h2><p>Current floor: ${p.name}</p><div class="liftFloors">${e.stops.map((q,i)=>`<button class="btn alt sm" data-floor="${i}"${p===q?' disabled':''}>${q.name}</button>`).join('')}</div><div class="row"><button class="btn sm" data-a="ok">Close</button></div>`,panel=>{
  panel.querySelector('[data-a=ok]').onclick=closeModal;
  panel.querySelectorAll('[data-floor]').forEach(b=>b.onclick=()=>{const to=e.stops[+b.dataset.floor];wantLock=false;closeModal();liftStart(e,p,to)});
 });
 return true;
}
function liftStanding(p){return solidAt(Math.floor(p.x),p.y-1,Math.floor(p.z))&&!collides(p.x,p.y,p.z)}
function liftStart(e,from,to){
 if(!liftStanding(from)||!liftStanding(to)){toast('The elevator landing is blocked.');return}
 input.keys.clear();input.jx=input.jy=0;input.jump=false;aim=null;
 LIFT_RIDE={e,from,to,t:0,duration:clamp(Math.abs(to.y-from.y)/7,.7,3.6),yaw:player.yaw};
 player.x=from.x;player.y=from.y;player.z=from.z;player.stepOff=0;player.vx=player.vy=player.vz=0;
 $('app').classList.add('lifting');
}
function liftFinish(){LIFT_RIDE=null;$('app').classList.remove('lifting')}
function liftStep(dt){
 const r=LIFT_RIDE,{from,to,e,duration}=r;
 const t=r.t+=dt,door=.38;
 if(t<door){const k=sstep(0,door,t);player.x=lerp(from.x,e.shaft.x,k);player.z=lerp(from.z,e.shaft.z,k);return}
 if(t<duration+door){player.x=e.shaft.x;player.z=e.shaft.z;player.y=lerp(from.y,to.y,sstep(door,duration+door,t));return}
 const k=sstep(duration+door,duration+door*2,t);
 player.x=lerp(e.shaft.x,to.x,k);player.z=lerp(e.shaft.z,to.z,k);player.y=to.y;
 const turn=Math.atan2(Math.sin(to.yaw-r.yaw),Math.cos(to.yaw-r.yaw));player.yaw=r.yaw+turn*k;player.pitch*=1-Math.min(1,dt*8);
 if(k===1){Object.assign(player,{ground:true,water:false,hold:false,stepOff:0,pitch:0});input.keys.clear();input.jx=input.jy=0;input.jump=false;liftFinish();queueSave();toast(to.name)}
}
function liftSavePos(){const p=LIFT_RIDE?.from;return p?[p.x,p.y,p.z,p.yaw,0]:null}
function liftRestorePos(pos){
 if(LIFT_RIDE)liftFinish();
 for(const e of LIFT_SITES)for(const p of e.stops){
  if(Math.abs(p.y-pos[1])>.65||Math.hypot(p.x-pos[0],p.z-pos[2])>.75)continue;
  forceLoad(Math.floor(p.x/16),Math.floor(p.z/16),2);
  if(liftStanding(p)){Object.assign(player,{x:p.x,y:p.y,z:p.z,yaw:pos[3],pitch:clamp(pos[4],-1.45,1.45),vx:0,vy:0,vz:0,ground:true,water:false,hold:false,stepOff:0});qCx=-9999;return true}
 }
 return false;
}
function liftHud(){
 const b=$('liftChip'),n=liftNear(),text=LIFT_RIDE?`Going to ${LIFT_RIDE.to.name}`:n?(touchMode?'Elevator':'Elevator · E'):'';
 b.hidden=!text;b.disabled=!!LIFT_RIDE;
 if(b.textContent!==text)b.textContent=text;
}
function liftDraw(){
 if(!LIFT_RIDE||botN+72>botGeo.length/7)return;
 const p={...LIFT_RIDE.e.shaft,y:player.y,yaw:0};
 part(p,0,-.045,0,.47,.04,.47,[.62,.66,.65]);part(p,0,2.39,0,.47,.05,.47,[.73,.72,.64]);
}

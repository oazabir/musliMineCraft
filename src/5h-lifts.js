/* Tower lifts use physical landings and clear shafts reserved for the cabin. */
const LIFT_SITES=[['burj',BURJ_LIFT],['sail',ARAB_LIFT],['kuwait',KUWAIT_LIFT]].map(([type,model])=>{
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
function summitSolid(x,y,z){
 for(const e of LIFT_SITES){
  const p=e.stops[e.stops.length-1];if(p.y<H||y<p.y-1||y>p.y)continue;
  const d=Math.max(Math.abs(x-Math.floor(e.shaft.x)),Math.abs(z-Math.floor(e.shaft.z)));
  if(y===p.y-1?d<=3:d===3)return true;
 }
 return false;
}
function liftDoorCollision(x,y,z,half,height){
 for(const e of LIFT_SITES)for(const p of e.stops){
  if(y>=p.y+2||y+height<=p.y||Math.abs(x-p.x)>1.5||Math.abs(z-p.z)>1.5)continue;
  const {nx,nz}=liftAxes(e,p),dx=x-p.x,dz=z-p.z;
  if(Math.abs(dx*nx+dz*nz+.49)<half+.04&&Math.abs(dx*nz-dz*nx)<half+.48&&liftOpening(p)<.9)return true;
 }
 return false;
}
let LIFT_RIDE=null,LIFT_CABIN=null;
const liftClock=()=>performance.now()/1000;
function liftOpening(p,t=liftClock()){
 const age=t-(p.openAt??-Infinity);
 return sstep(0,.32,age)*(1-sstep(5.32,5.64,age));
}
function liftDoorAction(e,p){
 if(LIFT_CABIN){liftExit();return true}
 if(liftOpening(p)<.9){p.openAt=liftClock();return true}
 if(!liftStanding(p))return true;
 LIFT_CABIN={e,p};
 Object.assign(player,{x:e.shaft.x,y:p.y,z:e.shaft.z,vx:0,vy:0,vz:0,yaw:liftAxes(e,p).yaw,pitch:0});
 input.keys.clear();input.jx=input.jy=0;input.jump=false;
 return true;
}
function liftExit(){
 const c=LIFT_CABIN;if(!c)return;
 LIFT_CABIN=null;c.p.openAt=liftClock();
 Object.assign(player,{x:c.p.x,y:c.p.y,z:c.p.z,yaw:c.p.yaw,pitch:0,vx:0,vy:0,vz:0,ground:true});
}
function liftBoardOnApproach(){
 const n=liftNear();if(!n||LIFT_CABIN||liftOpening(n.p)<.9)return;
 const {nx,nz}=liftAxes(n.e,n.p),dx=player.x-n.p.x,dz=player.z-n.p.z;
 if(dx*nx+dz*nz<-.20&&Math.abs(dx*nz-dz*nx)<.40&&player.vx*nx+player.vz*nz<-.16)liftDoorAction(n.e,n.p);
}
function liftClick(ray,hit){
 if(LIFT_CABIN){
  const {e,p}=LIFT_CABIN,dir=liftAxes(e,p),{o,d}=ray;
  const dot=d[0]*dir.rx+d[2]*dir.rz;
  if(dot<=0)return false;
  const t=(.42-(o[0]-e.shaft.x)*dir.rx-(o[2]-e.shaft.z)*dir.rz)/dot;
  if(t<=0||t>2)return false;
  const side=(o[0]+t*d[0]-e.shaft.x)*dir.nx+(o[2]+t*d[2]-e.shaft.z)*dir.nz;
  if(Math.abs(side)>.18)return false;
  const i=Math.round((o[1]+t*d[1]-p.y-.72)/.29);
  if(i>=0&&i<e.stops.length){if(e.stops[i]!==p)liftStart(e,p,e.stops[i]);return true}
  return false;
 }
 for(const e of LIFT_SITES)for(const p of e.stops){
  if(Math.abs(player.y-p.y)>1||Math.hypot(player.x-p.x,player.z-p.z)>4)continue;
  const {nx,nz}=liftAxes(e,p),x=p.x-nx*.49,z=p.z-nz*.49,{o,d}=ray,den=d[0]*nx+d[2]*nz;
  if(den>=-.01)continue;
  const t=((x-o[0])*nx+(z-o[2])*nz)/den;
  if(t<0||t>4||hit&&hit.t<t-.05)continue;
  const y=o[1]+d[1]*t-p.y,w=(o[0]+d[0]*t-x)*nz-(o[2]+d[2]*t-z)*nx;
  if(y>=0&&y<=2&&Math.abs(w)<=.49)return liftDoorAction(e,p);
 }
 return false;
}
function liftAxes(e,p){
 const nx=Math.sign(p.x-e.shaft.x),nz=Math.sign(p.z-e.shaft.z);
 return{nx,nz,rx:nz,rz:-nx,yaw:Math.atan2(nx,nz)};
}
function liftNear(){
 if(!playing||curModal||FLY||TP||MG.on||mapDialog.open||LIFT_RIDE)return null;
 for(const e of LIFT_SITES)for(const p of e.stops)if(Math.abs(player.y-p.y)<.6&&Math.hypot(player.x-p.x,player.z-p.z)<1.55)return{e,p};
 return null;
}
function liftPanel(){
 if(LIFT_CABIN){liftExit();return true}
 const n=liftNear();return n?liftDoorAction(n.e,n.p):false;
}
function liftStanding(p){return solidAt(Math.floor(p.x),p.y-1,Math.floor(p.z))&&!collides(p.x,p.y,p.z)}
function liftStart(e,from,to){
 if(!liftStanding(from)||!liftStanding(to)){toast('The elevator landing is blocked.');return}
 const boarded=LIFT_CABIN?.p===from;LIFT_CABIN=null;
 input.keys.clear();input.jx=input.jy=0;input.jump=false;aim=null;
 LIFT_RIDE={e,from,to,t:boarded?.38:0,duration:clamp(Math.abs(to.y-from.y)/7,.7,3.6),yaw:player.yaw};
 player.x=boarded?e.shaft.x:from.x;player.y=from.y;player.z=boarded?e.shaft.z:from.z;player.stepOff=0;player.vx=player.vy=player.vz=0;
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
 if(k===1){to.openAt=liftClock();Object.assign(player,{ground:true,water:false,hold:false,stepOff:0,pitch:0});input.keys.clear();input.jx=input.jy=0;input.jump=false;liftFinish();queueSave();toast(to.name)}
}
function liftSavePos(){
 let p=LIFT_RIDE?.from||LIFT_CABIN?.p;
 if(!p&&player.y>=H)for(const e of LIFT_SITES){
  const top=e.stops[e.stops.length-1];
  if(top.y>=H&&Math.abs(player.y-top.y)<4&&Math.abs(player.x-e.shaft.x)<3.5&&Math.abs(player.z-e.shaft.z)<3.5){p=top;break}
 }
 return p?[p.x,p.y,p.z,p.yaw,0]:null;
}
function liftRestorePos(pos){
 LIFT_CABIN=null;if(LIFT_RIDE)liftFinish();
 for(const e of LIFT_SITES)for(const p of e.stops){
  if(Math.abs(p.y-pos[1])>.65||Math.hypot(p.x-pos[0],p.z-pos[2])>.75)continue;
  forceLoad(Math.floor(p.x/16),Math.floor(p.z/16),2);
  if(liftStanding(p)){Object.assign(player,{x:p.x,y:p.y,z:p.z,yaw:pos[3],pitch:clamp(pos[4],-1.45,1.45),vx:0,vy:0,vz:0,ground:true,water:false,hold:false,stepOff:0});qCx=-9999;return true}
 }
 return false;
}
let liftHudCabin=null;
function liftHud(){
 const b=$('liftChip'),n=liftNear(),c=LIFT_CABIN,text=LIFT_RIDE?`Going to ${LIFT_RIDE.to.name}`:c?'Exit elevator':n?(liftOpening(n.p)>.9?'Enter elevator':'Open elevator \u00b7 F'):'';
 b.hidden=!text;b.disabled=!!LIFT_RIDE;
 if(b.textContent!==text)b.textContent=text;
 const panel=$('liftControls');panel.hidden=!c;
 if(c===liftHudCabin)return;
 liftHudCabin=c;panel.replaceChildren();if(!c)return;
 const head=document.createElement('div');head.className='liftHead';head.textContent=c.e.name;panel.appendChild(head);
 c.e.stops.forEach((stop,i)=>{
  const button=document.createElement('button'),here=stop===c.p;
  const floor=stop.name.match(/Levels? ([\d\u2013-]+)/)?.[1]||String(i+1),label=liftStopLabel(stop);
  button.type='button';button.className='liftStop';
  button.innerHTML=`<span class="fl">${floor}</span><span class="lb"><b>${label}</b><i>${here?'You are here':'Go to floor'}</i></span>`;
  button.setAttribute('aria-label',stop.name);button.setAttribute('aria-current',here?'true':'false');
  button.disabled=here;button.onclick=()=>liftStart(c.e,c.p,stop);panel.appendChild(button);
 });
}
/* "At the Top \u00b7 Level 148" reads "At the Top" on the button; the floor number sits in the badge. */
function liftStopLabel(stop){const i=stop.name.indexOf(' \u00b7 ');return i<0?stop.name:stop.name.slice(0,i)}
function liftDraw(){
 const metal=[.55,.60,.62],trim=[.27,.31,.33],dark=[.12,.15,.17];
 for(const e of LIFT_SITES)for(const p of e.stops){
  if(Math.abs(player.y-p.y)>15||Math.hypot(player.x-p.x,player.z-p.z)>30||botN+300>botGeo.length/7)continue;
  const {nx,nz,yaw}=liftAxes(e,p),door={x:p.x-nx*.49,z:p.z-nz*.49,y:p.y,yaw};
  if(liftOpening(p)<.01)part(door,0,1.03,-.08,.49,1.03,.035,dark);
  part(door,0,2.025,0,.51,.025,.045,trim);
  const gap=liftOpening(p);
  for(const side of [-1,1]){
   part(door,side*.50,1,0,.027,1,.05,trim);
   const width=.485*(1-gap);
   if(width>.005)part(door,side*(.49-width/2),1,.005,width/2,1,.04,metal);
  }
 }
 const cabin=LIFT_RIDE||LIFT_CABIN;
 if(!cabin||botN+360>botGeo.length/7)return;
 const e=cabin.e,stop=cabin.p||cabin.from,{yaw}=liftAxes(e,stop),p={...e.shaft,y:player.y,yaw};
 part(p,0,-.045,0,.47,.04,.47,metal);part(p,0,2.025,0,.47,.025,.47,metal);
 part(p,0,1,-.45,.47,1,.03,trim);
 part(p,-.45,1,0,.03,1,.47,metal);part(p,.45,1,0,.03,1,.47,metal);
 for(let i=0;i<e.stops.length;i++)part(p,.415,.72+i*.29,0,.015,.078,.10,[.89,.66,.27]);
}
/* The helicopter starts on the Burj Al Arab helipad. */
const HELI=(()=>{
 const l=lmOf('sail'),at=[];lm2w(l,0,-13,at);
 return{x:at[0]+.5,y:l.y0+23,z:at[1]+.5,yaw:Math.PI,on:false,landing:false};
})();
const HELI_HOME=[HELI.x,HELI.y,HELI.z];
function heliNear(){
 return playing&&!curModal&&!mapDialog.open&&!FLY&&!TP&&!MG.on&&!LIFT_RIDE&&!LIFT_CABIN
  &&Math.abs(player.y-HELI.y)<1.5&&Math.hypot(player.x-HELI.x,player.z-HELI.z)<4;
}
function heliAction(){
 if(!HELI.on&&!heliNear())return false;
 if(HELI.on){
  if(!solidAt(Math.floor(HELI.x),Math.floor(HELI.y-.04),Math.floor(HELI.z))){HELI.landing=!HELI.landing;return true}
  const exit=heliExitSpot();if(!exit){toast('Land near clear ground to exit.');return true}
  HELI.on=HELI.landing=false;
  Object.assign(player,{x:exit[0],y:exit[1],z:exit[2],ground:true,hold:false});queueSave();
 }else{
  HELI.on=true;HELI.landing=false;player.yaw=HELI.yaw;player.pitch=0;heliSeat();
  toast(touchMode?'Use the joystick and Jump to fly. Tap Land to descend.':'WASD to fly, Space to climb, Shift to descend, F to land.');
 }
 input.keys.clear();input.jx=input.jy=0;input.jump=false;
 return true;
}
function heliSeat(){
 Object.assign(player,{x:HELI.x,y:HELI.y+.18,z:HELI.z,stepOff:0,vx:0,vy:0,vz:0,water:false,ground:false});
}
function heliExitSpot(){
 for(const [dx,dz] of [[0,2],[2,0],[0,-2],[-2,0],[0,1],[1,0],[0,-1],[-1,0]]){
  const x=HELI.x+dx,z=HELI.z+dz,y=HELI.y;
  if(solidAt(Math.floor(x),Math.floor(y-.04),Math.floor(z))&&!collides(x,y,z))return[x,y,z];
 }
 return null;
}
function heliStep(dt){
 const keys=input.keys,up=input.jump||keys.has(' ')||keys.has('pageup');
 const down=keys.has('shift')||keys.has('pagedown')||HELI.landing;
 const forward=clamp(input.jy+Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown')),-1,1);
 const side=clamp(input.jx+Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')),-1,1);
 const sy=Math.sin(player.yaw),cy=Math.cos(player.yaw);
 const move=(x,y,z)=>{
  if(y<WL+1||y>680||collides(x,y,z))return false;
  Object.assign(HELI,{x,y,z});return true;
 };
 if(up)HELI.landing=false;
 const dy=up?8:down?-7:0;
 if(dy&&!move(HELI.x,HELI.y+dy*dt,HELI.z)&&dy<0)move(HELI.x,Math.floor(HELI.y),HELI.z);
 if(!HELI.landing)move(HELI.x+(-sy*forward+cy*side)*15*dt,HELI.y,HELI.z+(-cy*forward-sy*side)*15*dt);
 HELI.yaw=player.yaw;heliSeat();
}
function heliHud(){
 const b=$('heliChip');
 b.hidden=!HELI.on&&!heliNear();
 if(!b.hidden)b.textContent=HELI.on?(HELI.landing?'Landing · F':heliExitSpot()?'Exit helicopter · F':'Land · F'):'Fly helicopter · F';
}
function heliDraw(){
 if(Math.hypot(HELI.x-player.x,HELI.z-player.z)>farFog||botN+720>botGeo.length/7)return;
 const b=HELI,white=[.93,.94,.93],blue=[.09,.40,.65],dark=[.13,.17,.20];
 if(!b.on){part(b,0,.82,0,.69,.60,1.23,white);part(b,0,1.00,-.80,.62,.38,.43,blue)}
 part(b,0,.47,0,.74,.17,1.22,blue);
 part(b,0,.83,1.53,.16,.16,1.17,white);
 part(b,0,1.14,2.48,.11,.45,.29,blue);
 for(const side of [-1,1])part(b,side*.67,.11,0,.08,.08,1.26,dark);
 const rotor={...b,yaw:b.yaw+(b.on?performance.now()*.018:0)};
 part(rotor,0,1.72,0,2.0,.055,.095,dark);
 part(rotor,0,1.72,0,.095,.055,2.0,dark);
}

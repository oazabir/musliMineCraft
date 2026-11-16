/* ===== 6. Player, physics and ray casting ===== */
const player={x:0,y:0,z:0,vx:0,vy:0,vz:0,yaw:-Math.PI/2,pitch:-.2,ground:false,water:false,stepOff:0,hold:false,waterT:0,trapT:0};
const HALF=.3, HEIGHT=1.8;
function solidAt(x,y,z){
 if(x<0||x>=WX||z<0||z>=WZ||y<0)return true;if(y>=H)return false;
 const c=chunkAt(x>>4,z>>4);if(!c||c.st!==2)return true;
 return DEFS[c.v[(y<<8)|((z&15)<<4)|(x&15)]].solid;
}
function collides(px,py,pz){
 for(let y=Math.floor(py);y<=Math.floor(py+HEIGHT-1e-4);y++)for(let z=Math.floor(pz-HALF);z<=Math.floor(pz+HALF);z++)for(let x=Math.floor(px-HALF);x<=Math.floor(px+HALF);x++)if(solidAt(x,y,z))return true;
 return false;
}
/* raw placement, used only while booting and by the test hook: the player waits (hold) until the chunk below is built */
function rawTeleport(x,z,yaw,pitch){
 const gt=groundTop(Math.floor(x),Math.floor(z));
 Object.assign(player,{x:x,y:gt+2,z:z,vx:0,vy:0,vz:0,stepOff:0,hold:true});
 if(yaw!==undefined){player.yaw=yaw;player.pitch=pitch===undefined?-.2:pitch}
 qCx=-9999;
}
/* the one safe-placement function: loads the target chunks, finds the nearest valid standing spot (spiral, up to 48 blocks),
   never falls back to an unsafe spot. strict = keep 1 block away from water edges when possible */
const spotTmp=[0,0,0];
function spotOk(x,y,z,strict){
 const b0=getB(x,y-1,z);
 if(!b0||!DEFS[b0].solid||b0===B.LEAVES||b0===B.WOOD||b0===B.WATER||b0===B.DATES)return false;
 const f=getB(x,y,z),h=getB(x,y+1,z);
 if(f===B.WATER||h===B.WATER||(f&&DEFS[f].solid)||(h&&DEFS[h].solid))return false;
 if(collides(x+.5,y,z+.5))return false;
 const t=groundTop(x,z);
 if(y-1>t+4){let roofed=false;for(let k=2;k<=14;k++){const u=getB(x,y+k,z);if(u&&DEFS[u].solid){roofed=true;break}}if(!roofed)return false}
 if(strict){for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)if(getB(x+dx,y,z+dz)===B.WATER||getB(x+dx,y-1,z+dz)===B.WATER)return false}
 return true;
}
function colSpot(x,z,py,strict){
 const c=chunkAt(x>>4,z>>4);if(!c||c.st!==2||x<4||z<4||x>WX-4||z>WZ-4)return -1;
 const t=groundTop(x,z);let best=-1,bd=1e9;
 for(let y=Math.min(H-4,t+16);y>=1;y--){if(!spotOk(x,y,z,strict))continue;const d=py===undefined?Math.abs(y-t-1):Math.abs(y-py);if(d<bd){bd=d;best=y}}
 return best;
}
function findSafe(px,pz,py,out,maxR){
 maxR=maxR||48;
 for(let pass=0;pass<2;pass++){
  let bd=1e9,found=false;
  for(let r=0;r<=maxR&&!(found&&r*r>bd);r++){
   for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){
    if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;
    const d=dx*dx+dz*dz;if(d>=bd)continue;
    const x=Math.floor(px)+dx,z=Math.floor(pz)+dz,y=colSpot(x,z,py,pass===0);
    if(y>=0){out[0]=x+.5;out[1]=y;out[2]=z+.5;bd=d;found=true}
   }
  }
  if(found)return true;
 }
 return false;
}
const safeSpot=(px,pz,py,out)=>findSafe(px,pz,py,out,40);
function placeSafe(x,z,yaw,pitch,py){
 x=clamp(x,5,WX-5);z=clamp(z,5,WZ-5);
 const tries=[[x,z,py],[START.x+.5,START.z+.5,undefined],[PLOT_X,PLOT_Z,undefined]];
 for(let i=0;i<tries.length;i++){
  const t=tries[i];forceLoad(Math.floor(t[0]/16),Math.floor(t[1]/16),3);
  if(findSafe(t[0],t[1],t[2],spotTmp,i?96:48)){
   Object.assign(player,{x:spotTmp[0],y:spotTmp[1],z:spotTmp[2],vx:0,vy:0,vz:0,stepOff:0,hold:false,ground:true,water:false,waterT:0,trapT:0});
   if(yaw!==undefined){player.yaw=yaw;player.pitch=pitch===undefined?-.2:pitch}
   qCx=-9999;return true;
  }
 }
 return false;
}
function teleport(x,z,yaw,pitch,py){return placeSafe(x,z,yaw,pitch,py)}
function bootSpawn(){rawTeleport(START.x+.5,START.z+.5,SPAWN_YAW,SPAWN_PITCH)}
function spawnPlayer(){return placeSafe(START.x+.5,START.z+.5,SPAWN_YAW,SPAWN_PITCH)}
const input={jx:0,jy:0,keys:new Set(),jump:false};
let edgeHint=0,fallCd=0;
function stepPlayer(dt){
 const c0=chunkAt(Math.floor(player.x)>>4,Math.floor(player.z)>>4);
 if(!c0||c0.st!==2){player.hold=true;return}
 if(window.__fly)return;
 if(player.hold){let n=0;while(collides(player.x,player.y,player.z)&&n++<44)player.y+=1;player.hold=false;player.vy=0}
 player.stepOff=Math.max(0,player.stepOff-dt*5);
 const fwd=clamp(input.jy+(input.keys.has('w')||input.keys.has('arrowup')?1:0)-(input.keys.has('s')||input.keys.has('arrowdown')?1:0),-1,1);
 const str=clamp(input.jx+(input.keys.has('d')||input.keys.has('arrowright')?1:0)-(input.keys.has('a')||input.keys.has('arrowleft')?1:0),-1,1);
 const l=Math.hypot(fwd,str),k=l>1?1/l:1,sy=Math.sin(player.yaw),cy=Math.cos(player.yaw);
 const sp=(player.water?2.6:4.4)*k;
 player.vx=(-sy*fwd+cy*str)*sp;player.vz=(-cy*fwd-sy*str)*sp;
 const wx=Math.floor(player.x),wz=Math.floor(player.z),wy=Math.floor(player.y+.4),wasW=player.water,jmp=input.jump||input.keys.has(' ');
 player.water=getB(wx,wy,wz)===B.WATER;
 if(player.water){
  /* float: buoyancy lifts the head to the surface; Jump swims up; no sinking trap */
  let yt=wy;while(yt<H-2&&getB(wx,yt+1,wz)===B.WATER)yt++;
  const yeq=yt+.875-1.3;
  const want=jmp&&player.y<yeq+.4?3.2:clamp((yeq-player.y)*3,-1.6,2.2);
  player.vy+=(want-player.vy)*Math.min(1,dt*8);
  if(!wasW)sfx.splash();
  player.waterT+=dt;
 }else{
  player.waterT=0;
  player.vy=Math.max(player.vy-26*dt,-32);if(jmp&&player.ground)player.vy=8.6;
 }
 if(!player.water&&wasW)player.vy=Math.max(player.vy,0);
 for(const ax of ['x','z']){
  const d=(ax==='x'?player.vx:player.vz)*dt;if(!d)continue;
  const nx=ax==='x'?player.x+d:player.x,nz=ax==='z'?player.z+d:player.z;
  if(!collides(nx,player.y,nz)){player.x=nx;player.z=nz}
  else if(player.ground&&!player.water&&!collides(nx,player.y+1.001,nz)&&!collides(player.x,player.y+1.001,player.z)){player.x=nx;player.z=nz;player.y+=1.001;player.stepOff+=1}
  else if(player.water){
   /* climb out: step onto a bank up to ~1 above the water, or ~2 above while Jump is held */
   const mh=jmp?3.6:2.55;
   for(let h=1.001;h<=mh;h+=.25)if(!collides(nx,player.y+h,nz)){player.x=nx;player.z=nz;player.y+=h;player.stepOff=Math.min(2.5,player.stepOff+h);player.vy=0;break}
  }
 }
 const ny=player.y+player.vy*dt;
 if(!collides(player.x,ny,player.z)){player.y=ny;player.ground=false}
 else{
  if(player.vy<0){player.y=Math.floor(ny)+1;player.ground=true}
  else{player.y=Math.floor(ny+HEIGHT)-HEIGHT-.001;player.ground=false}
  player.vy=0;
 }
 const ex=clamp(player.x,3,WX-3),ez=clamp(player.z,3,WZ-3);
 if(ex!==player.x||ez!==player.z){player.x=ex;player.z=ez;if(edgeHint<=0){edgeHint=7;toast('This is the edge of our map. Turn back, there is so much more to explore!')}}
 if(player.y<-10){fallCd-=dt;if(fallCd<=0){fallCd=2;if(!teleport(player.x,player.z))rawTeleport(START.x+.5,START.z+.5,SPAWN_YAW,SPAWN_PITCH)}}
 /* never trapped: enclosed on land for a while */
 if(!player.water&&player.ground){
  const e=HALF+.2,x=player.x,y=player.y,z=player.z;
  const esc=(nx,nz)=>!collides(nx,y,nz)||!collides(nx,y+1.001,nz);
  if(!esc(x+e,z)&&!esc(x-e,z)&&!esc(x,z+e)&&!esc(x,z-e))player.trapT+=dt;else player.trapT=0;
 }else player.trapT=0;
}
function helpOut(){
 if(placeSafe(player.x,player.z,player.yaw,player.pitch,player.y)){player.waterT=0;player.trapT=0;player.stepOff=0;return true}
 return false;
}
const castN=[0,0,0],castR={x:0,y:0,z:0,n:castN,b:0,ghost:false,t:0};
/* returns one shared result object (valid until the next cast); no per-call allocation */
function cast(o,d,max,selBlock,plants){
 let x=Math.floor(o[0]),y=Math.floor(o[1]),z=Math.floor(o[2]);
 const sx=d[0]>0?1:-1,sy=d[1]>0?1:-1,sz=d[2]>0?1:-1;
 const tdx=d[0]?Math.abs(1/d[0]):Infinity,tdy=d[1]?Math.abs(1/d[1]):Infinity,tdz=d[2]?Math.abs(1/d[2]):Infinity;
 let tmx=d[0]?((d[0]>0?x+1-o[0]:o[0]-x)*tdx):Infinity,tmy=d[1]?((d[1]>0?y+1-o[1]:o[1]-y)*tdy):Infinity,tmz=d[2]?((d[2]>0?z+1-o[2]:o[2]-z)*tdz):Infinity;
 let t=0;castN[0]=castN[1]=castN[2]=0;
 while(t<=max){
  if(inb(x,y,z)){
   const b=getB(x,y,z);
   if(b&&b!==B.WATER&&(plants||DEFS[b].kind!=='x')){castR.x=x;castR.y=y;castR.z=z;castR.b=b;castR.ghost=false;castR.t=t;return castR}
   if(selBlock){const k=gkey(x,y,z);if(ghostMap.get(k)===selBlock||(joinMap.get(k)===selBlock)){castR.x=x;castR.y=y;castR.z=z;castR.b=0;castR.ghost=true;castR.t=t;return castR}}
  }else if(y<0||y>=H&&d[1]>=0)return null;
  castN[0]=castN[1]=castN[2]=0;
  if(tmx<tmy&&tmx<tmz){t=tmx;tmx+=tdx;castN[0]=-sx;x+=sx}
  else if(tmy<tmz){t=tmy;tmy+=tdy;castN[1]=-sy;y+=sy}
  else{t=tmz;tmz+=tdz;castN[2]=-sz;z+=sz}
 }
 return null;
}
function playerRay(px,py){return{o:cam.e,d:px===undefined?cam.fw:screenRay(px,py)}}
function overlapsPlayer(x,y,z){
 return x+1>player.x-HALF&&x<player.x+HALF&&y+1>player.y&&y<player.y+HEIGHT&&z+1>player.z-HALF&&z<player.z+HALF;
}

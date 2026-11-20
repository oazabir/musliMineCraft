/* ===== 8c. The Open Air Prison: families, drones, bombs and the shelters the player builds ===== */
/* A floor cell is a shelter spot when a solid block sits 2..8 above it. One person per spot, so a
   shelter holds as many people as it has roofed floor cells. People path-find (BFS) to the nearest free spot.
   Bombs never break blocks and nobody is shown dying: a person caught in the open is knocked down and gets up. */
const GZN=24,GZX0=GZ.x-GZ.hx-2,GZZ0=GZ.z-GZ.hz-2,GZW=GZ.hx*2+5,GZL=GZ.hz*2+5,GZC=GZW*GZL;
const GZ_MS=[5,10,15,20,24],GZ_ACT=46,GZ_HIT=3.6;
const gzIn=new Uint8Array(GZC),gzFl=new Int8Array(GZC).fill(-1),gzCov=new Uint8Array(GZC),gzOwn=new Int16Array(GZC).fill(-1);
const gzPrev=new Int32Array(GZC),gzMark=new Uint32Array(GZC),gzQ=new Int32Array(GZC);
const gzWalk=[],gzPeople=[],gzPlanes=[],gzBombs=[],gzFx=[];
const GZS={on:false,ready:false,inMask:false,gridT:0,raidT:6,raid:false,raidN:0,hurt:0,safe:0,last:null,mark:1,spawned:false,o:{x:0,y:0,z:0,yaw:0}};
const GZ_DRESS=[[.55,.18,.2],[.2,.3,.55],[.25,.45,.3],[.5,.4,.25],[.35,.35,.4],[.6,.5,.35],[.15,.35,.45]];
const GZ_COVER=[[.12,.12,.14],[.85,.85,.82],[.4,.2,.35],[.25,.3,.5],[.55,.45,.3]];
const GZ_SKIN=[[.86,.68,.52],[.78,.58,.42],[.66,.47,.33],[.92,.76,.62]];
const GZ_PANTS=[[.2,.2,.24],[.35,.3,.25],[.25,.28,.35]];
const gzIdx=(x,z)=>{const gx=Math.floor(x)-GZX0,gz=Math.floor(z)-GZZ0;return gx<0||gz<0||gx>=GZW||gz>=GZL?-1:gz*GZW+gx};
const gzCX=i=>GZX0+i%GZW+.5,gzCZ=i=>GZZ0+Math.floor(i/GZW)+.5;
function gzInit(){
 if(GZS.inMask)return;GZS.inMask=true;
 for(let i=0;i<GZC;i++)gzIn[i]=gzD(gzCX(i),gzCZ(i))<-.6?1:0;
}
const gzSolid=(x,y,z)=>{const b=getB(x,y,z);return b!==0&&DEFS[b].solid};
/* floor = lowest standing height on the island ground (solid below, two free cells above) */
function gzGrid(){
 gzWalk.length=0;
 for(let i=0;i<GZC;i++){
  gzFl[i]=-1;gzCov[i]=0;if(!gzIn[i])continue;
  const x=GZX0+i%GZW,z=GZZ0+Math.floor(i/GZW),c=chunkAt(x>>4,z>>4);if(!c||c.st!==2)continue;
  for(let y=WL;y<H-4;y++)if(gzSolid(x,y-1,z)&&!gzSolid(x,y,z)&&!gzSolid(x,y+1,z)&&getB(x,y,z)!==B.WATER){gzFl[i]=y;break}
  if(gzFl[i]<0)continue;
  gzWalk.push(i);
  for(let y=gzFl[i]+2;y<=gzFl[i]+8&&y<H;y++)if(gzSolid(x,y,z)){gzCov[i]=1;break}
 }
 /* a spot that lost its roof or its floor gives its person back to the crowd */
 for(let i=0;i<GZC;i++){const o=gzOwn[i];if(o<0)continue;const p=gzPeople[o];
  if(!gzCov[i]||!p||p.tgt!==i){gzOwn[i]=-1;if(p&&p.tgt===i){p.tgt=-1;p.path=null;if(p.st===2||p.st===1)p.st=0}}}
 for(const p of gzPeople)if(p.st===1&&p.path&&p.path.some(c=>gzFl[c]<0)){gzRelease(p);p.st=0}
 GZS.ready=gzWalk.length>40;
}
function gzRelease(p){if(p.tgt>=0&&gzOwn[p.tgt]===p.i)gzOwn[p.tgt]=-1;p.tgt=-1;p.path=null}
const gzPass=(a,b)=>a>=0&&b>=0&&gzFl[a]>=0&&gzFl[b]>=0&&Math.abs(gzFl[a]-gzFl[b])<=1;
/* nearest free roofed spot reachable from cell s (4-neighbour BFS); returns the path without s */
function gzFind(s){
 if(s<0||gzFl[s]<0)return null;
 const m=++GZS.mark;let h=0,t=0;gzQ[t++]=s;gzMark[s]=m;gzPrev[s]=-1;
 while(h<t){
  const c=gzQ[h++];
  if(gzCov[c]&&gzOwn[c]<0){const path=[];for(let k=c;k!==s;k=gzPrev[k])path.push(k);return path.reverse().concat(path.length?[]:[c])}
  const gx=c%GZW;
  for(const n of[gx>0?c-1:-1,gx<GZW-1?c+1:-1,c-GZW,c+GZW]){if(n<0||n>=GZC||gzMark[n]===m||!gzPass(c,n))continue;gzMark[n]=m;gzPrev[n]=c;gzQ[t++]=n}
 }
 return null;
}
function gzSpawn(){
 if(GZS.spawned||!GZS.ready)return;GZS.spawned=true;
 const rnd=mulberry(SEED+77);
 for(let i=0;i<GZN;i++){
  const c=gzWalk[Math.floor(rnd()*gzWalk.length)],kid=rnd()<.4,fem=rnd()<.5;
  gzPeople.push({i,x:gzCX(c),z:gzCZ(c),y:gzFl[c],yaw:rnd()*6.28,ph:rnd()*6,st:0,tgt:-1,path:null,rx:0,rz:0,rt:0,dn:0,leg:0,
   sc:kid?.62+rnd()*.12:.92+rnd()*.12,sp:(kid?3.3:2.9)+rnd()*.7,fem,
   dress:GZ_DRESS[Math.floor(rnd()*GZ_DRESS.length)],cover:GZ_COVER[Math.floor(rnd()*GZ_COVER.length)],
   skin:GZ_SKIN[Math.floor(rnd()*GZ_SKIN.length)],pants:GZ_PANTS[Math.floor(rnd()*GZ_PANTS.length)]});
 }
}
/* walk toward (tx,tz) one step; false when the next cell cannot be entered */
function gzMove(p,tx,tz,sp,dt){
 const dx=tx-p.x,dz=tz-p.z,d=Math.hypot(dx,dz);if(d<.05)return true;
 const st=Math.min(d,sp*dt),nx=p.x+dx/d*st,nz=p.z+dz/d*st,a=gzIdx(p.x,p.z),b=gzIdx(nx,nz);
 if(a!==b&&!gzPass(a,b))return false;
 p.x=nx;p.z=nz;p.yaw=Math.atan2(-dx,-dz);p.ph+=st*3.2/p.sc;p.leg=1;return true;
}
function gzPersonTick(p,dt){
 p.leg=0;
 if(p.st===3){p.dn-=dt;if(p.dn<=0)p.st=p.tgt>=0?1:0;return}
 const cur=gzIdx(p.x,p.z);
 if(cur>=0&&gzFl[cur]>=0)p.y+=(gzFl[cur]-p.y)*Math.min(1,dt*12);
 else if(cur<0||!gzIn[cur]){p.x+=(GZ.x-p.x)*dt*.5;p.z+=(GZ.z-p.z)*dt*.5}
 if(p.st===2){p.yaw+=Math.sin(GZS.t*.7+p.i)*dt*.3;return}
 const sp=p.sp*(GZS.raid?1.25:1);
 if(p.st===1&&p.path){
  if(!p.path.length){p.st=2;p.x=gzCX(p.tgt);p.z=gzCZ(p.tgt);return}
  const n=p.path[0];
  if(!gzMove(p,gzCX(n),gzCZ(n),sp,dt)){gzRelease(p);p.st=0;return}
  if(Math.abs(p.x-gzCX(n))<.08&&Math.abs(p.z-gzCZ(n))<.08)p.path.shift();
  return;
 }
 /* running around: a random spot on the island, a new one when blocked or reached */
 p.rt-=dt;
 if(p.rt<=0||Math.hypot(p.rx-p.x,p.rz-p.z)<.4){const c=gzWalk[Math.floor(Math.random()*gzWalk.length)];p.rx=gzCX(c)+Math.random()*.6-.3;p.rz=gzCZ(c)+Math.random()*.6-.3;p.rt=2+Math.random()*4}
 if(!gzMove(p,p.rx,p.rz,sp,dt))p.rt=0;
}
function gzStartRaid(){
 GZS.raid=true;GZS.raidN++;GZS.hurt=0;GZS.raidT=11+Math.random()*5;
 const n=Math.random()<.45?2:1;
 for(let k=0;k<n;k++){
  const dir=Math.random()<.5?1:-1,x=GZ.x+(Math.random()*2-1)*(GZ.hx-3),drops=[];
  for(let j=0;j<3+Math.floor(Math.random()*3);j++)drops.push(GZ.z+(Math.random()*2-1)*(GZ.hz-3));
  drops.sort((a,b)=>dir*(a-b));
  gzPlanes.push({x,y:29+k*2.5,z:GZ.z-dir*(GZ.hz+55+k*14),dir,sp:13,drops});
 }
 sfx.siren();
}
function gzBoom(x,y,z){
 const d=Math.hypot(x-player.x,z-player.z);sfx.boom(clamp(1-d/90,.06,1));
 gzFx.push({k:0,x,y:y+.6,z,vx:0,vy:1,vz:0,t:0,life:.35,s:1.1});
 for(let k=0;k<10;k++){const a=Math.random()*6.28,s=2+Math.random()*3.5;gzFx.push({k:0,x,y:y+.3,z,vx:Math.cos(a)*s,vy:2.5+Math.random()*3.5,vz:Math.sin(a)*s,t:0,life:.5+Math.random()*.35,s:.45+Math.random()*.4})}
 for(let k=0;k<11;k++)gzFx.push({k:1,x:x+Math.random()*2.4-1.2,y:y+.5,z:z+Math.random()*2.4-1.2,vx:Math.random()-.5,vy:1.5+Math.random()*1.6,vz:Math.random()-.5,t:-Math.random()*.3,life:2+Math.random()*1.6,s:.45+Math.random()*.35});
 while(gzFx.length>160)gzFx.shift();
 /* only people out in the open are knocked down; a roof keeps its people safe */
 for(const p of gzPeople){
  if(p.st===3||Math.hypot(p.x-x,p.z-z)>GZ_HIT)continue;
  const c=gzIdx(p.x,p.z);if(c>=0&&gzCov[c]&&gzFl[c]>=0&&y>gzFl[c]+1.5)continue;
  p.st=3;p.dn=3.5;GZS.hurt++;
 }
}
/* the highest solid block in a column (roofs included); unloaded columns use the terrain */
function gzImpactY(x,z){
 const ix=Math.floor(x),iz=Math.floor(z),c=chunkAt(ix>>4,iz>>4);
 if(!c||c.st!==2)return Math.max(WL,groundTop(ix,iz))+1;
 for(let y=H-2;y>0;y--)if(gzSolid(ix,y,iz))return y+1;
 return WL+1;
}
function gzEndRaid(){
 GZS.raid=false;let safe=0;for(const p of gzPeople)if(p.st===2)safe++;
 GZS.safe=safe;S.gz.pts+=safe;if(safe>S.gz.best)S.gz.best=safe;
 let won=0;for(let k=0;k<GZ_MS.length;k++)if(safe>=GZ_MS[k]&&!(S.gz.ms&(1<<k))){S.gz.ms|=1<<k;won++}
 if(won){S.stars+=3*won;S.skills.building+=won;updateHud();confetti();sfx.done();toast(`${safe} people safe in your shelters! +${3*won} stars`)}
 else toast(safe?`Drone attack over. ${safe} of ${GZN} people were safe. +${safe} points`:`Drone attack over. Nobody had a shelter. Build one with a roof!`);
 queueSave();
}
function gzIntro(){
 S.gz.seen=true;queueSave();
 modal(`<span class="tag">Open Air Prison</span><h2>Save the Muslims from Drone Attacks in the Open Air Prison</h2>
  <p>The Open Air Prison is a small strip of land by the sea, closed in on every side. More than two million people live here and cannot leave. Israeli drones are dropping bombs on it, and families have nowhere safe to go.</p>
  <p>Build shelters with a strong roof. Every roofed spot can hide one person, so a bigger shelter keeps more people safe. After each drone attack you earn a point for every person under a roof.</p>
  <div class="row"><button class="btn" data-a="ok">I will help</button></div>`,p=>{p.querySelector('[data-a=ok]').onclick=closeModal});
}
function gzTick(dt){
 const d=gzD(player.x,player.z),on=d<GZ_ACT;
 if(on!==GZS.on){GZS.on=on;gzHud(true)}
 if(!on)return;
 gzInit();GZS.t=(GZS.t||0)+dt;
 if(!S.gz.seen&&d<-1&&player.ground&&!FLY){gzIntro();return}
 GZS.gridT-=dt;if(GZS.gridT<=0){GZS.gridT=.4;gzGrid();gzSpawn();
  /* a few path searches per grid pass keep the frame cost flat */
  let n=0;for(const p of gzPeople){if(n>=6)break;if(p.st===0&&p.tgt<0){n++;const path=gzFind(gzIdx(p.x,p.z));if(path){p.tgt=path[path.length-1];gzOwn[p.tgt]=p.i;p.path=path;p.st=1}}}}
 if(!GZS.spawned)return;
 for(const p of gzPeople)gzPersonTick(p,dt);
 if(!GZS.raid){GZS.raidT-=dt;if(GZS.raidT<=0)gzStartRaid()}
 for(let i=gzPlanes.length-1;i>=0;i--){const a=gzPlanes[i];a.z+=a.dir*a.sp*dt;
  while(a.drops.length&&(a.z-a.drops[0])*a.dir>=0){a.drops.shift();gzBombs.push({x:a.x+Math.random()*3-1.5,y:a.y-1,z:a.z,vz:a.dir*a.sp*.35,vy:0});sfx.whistle()}
  if((a.z-GZ.z)*a.dir>GZ.hz+70)gzPlanes.splice(i,1)}
 for(let i=gzBombs.length-1;i>=0;i--){const b=gzBombs[i];b.vy-=22*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;
  const iy=gzImpactY(b.x,b.z);if(b.y<=iy){gzBombs.splice(i,1);gzBoom(b.x,iy,b.z)}}
 for(let i=gzFx.length-1;i>=0;i--){const f=gzFx[i];f.t+=dt;if(f.t>=f.life){gzFx.splice(i,1);continue}if(f.t<0)continue;
  f.x+=f.vx*dt;f.y+=f.vy*dt;f.z+=f.vz*dt;if(f.k===0){f.vx*=.9;f.vz*=.9;f.vy-=6*dt}else{f.vx*=.97;f.vz*=.97}}
 if(GZS.raid&&!gzPlanes.length&&!gzBombs.length)gzEndRaid();
 gzHud();
}
let gzHudTxt='';
function gzHud(force){
 const el=$('gzchip');
 if(!GZS.on||!playing){if(force||gzHudTxt){gzHudTxt='';el.style.display='none'}return}
 let safe=0;for(const p of gzPeople)if(p.st===2)safe++;
 let free=0;for(const i of gzWalk)if(gzCov[i]&&gzOwn[i]<0)free++;
 const t=`${GZS.raid?'Drone attack! ':'Open Air Prison: '}${safe}/${GZN} safe · ${free} free · ${S.gz.pts} pts`;
 if(t!==gzHudTxt||force){gzHudTxt=t;el.textContent=t;el.style.display='flex';el.classList.toggle('raid',GZS.raid)}
}
function visitPrison(){closeModal();teleport(GZ.x+.5,GZ.z+GZ.hz-5+.5,0,-.15)}
/* --- drawing (into the shared bot buffer) --- */
const GZ_PLANE=[.66,.68,.7],GZ_DARK=[.3,.32,.35],GZ_BOMB=[.18,.18,.2],GZ_FIRE=[[1,.95,.5],[1,.6,.15],[.85,.3,.08]],GZ_SMOKE=[.34,.32,.31];
const gzRoom=()=>botN*7+252*2<botGeo.length;
function gzBox(x,y,z,yaw,ox,oy,oz,hx,hy,hz,col,sw,pv){if(!gzRoom())return;const o=GZS.o;o.x=x;o.y=y;o.z=z;o.yaw=yaw;part(o,ox,oy,oz,hx,hy,hz,col,sw,pv)}
function gzFig(p){
 const s=p.sc,dn=p.st===3,tilt=dn?1.45:0,pv=dn?.1*s:0,sw=dn?0:Math.sin(p.ph)*.8*p.leg,y=p.y;
 const B_=(ox,oy,oz,hx,hy,hz,c,w,v)=>gzBox(p.x,y,p.z,p.yaw,ox*s,oy*s,oz*s,hx*s,hy*s,hz*s,c,tilt||w,dn?pv:v*s);
 B_(.12,.34,0,.11,.34,.12,p.fem?p.dress:p.pants,sw,.68);B_(-.12,.34,0,.11,.34,.12,p.fem?p.dress:p.pants,-sw,.68);
 B_(0,1.02,0,.23,.36,.15,p.dress,0,0);
 const ar=GZS.raid&&p.st!==2&&!dn?2.6:-sw;
 B_(.33,1.03,0,.08,.32,.09,p.dress,ar,1.34);B_(-.33,1.03,0,.08,.32,.09,p.dress,GZS.raid&&p.st!==2&&!dn?2.6:sw,1.34);
 B_(0,1.62,0,.24,.24,.22,p.skin,0,0);
 if(p.fem){B_(0,1.68,.08,.27,.26,.2,p.cover,0,0);B_(0,1.32,.03,.32,.1,.22,p.cover,0,0)}
 else B_(0,1.89,0,.25,.05,.23,p.cover,0,0);
}
function gzDraw(){
 if(!GZS.on||!GZS.spawned)return;
 const e=cam.e,fw=cam.fw,lim=farFog*farFog*1.1;
 const vis=(x,y,z)=>{const dx=x-e[0],dz=z-e[2];return dx*dx+dz*dz<lim&&dx*fw[0]+(y-e[1])*fw[1]+dz*fw[2]>-4};
 for(const p of gzPeople)if(vis(p.x,p.y+1,p.z))gzFig(p);
 /* drones: a slim body with a rounded sensor nose, long thin wings, a V tail and a pusher propeller */
 for(const a of gzPlanes){const yw=a.dir>0?Math.PI:0,x=a.x,y=a.y,z=a.z,pr=GZS.t*40;
  gzBox(x,y,z,yw,0,0,0,.3,.27,1.9,GZ_PLANE);gzBox(x,y,z,yw,0,-.06,-1.95,.34,.34,.32,GZ_PLANE);gzBox(x,y,z,yw,0,-.28,-1.6,.17,.12,.17,GZ_DARK);
  gzBox(x,y,z,yw,0,.08,-.1,3.9,.05,.36,GZ_PLANE);gzBox(x,y,z,yw,.45,.32,1.65,.42,.05,.22,GZ_DARK);gzBox(x,y,z,yw,-.45,.32,1.65,.42,.05,.22,GZ_DARK);
  gzBox(x,y,z,yw,0,.28,1.7,.05,.3,.2,GZ_DARK);gzBox(x,y,z,yw,0,0,2.02,.62*Math.abs(Math.cos(pr)),.08,.03,GZ_DARK);gzBox(x,y,z,yw,0,0,2.02,.08,.62*Math.abs(Math.sin(pr)),.03,GZ_DARK)}
 for(const b of gzBombs)gzBox(b.x,b.y,b.z,0,0,0,0,.14,.3,.14,GZ_BOMB);
 for(const f of gzFx){if(f.t<0||!vis(f.x,f.y,f.z))continue;const k=f.t/f.life;
  if(f.k===0){const c=GZ_FIRE[Math.min(2,Math.floor(k*3))],s=f.s*(1+k*.8);gzBox(f.x,f.y,f.z,f.t*3,0,0,0,s,s,s,c)}
  else{const s=f.s*(1+k*2.2),g=1-k*.35;gzBox(f.x,f.y,f.z,f.t,0,0,0,s,s,s,[GZ_SMOKE[0]*g,GZ_SMOKE[1]*g,GZ_SMOKE[2]*g])}}
}
/* test hooks */
window.__prison=()=>{let safe=0,down=0,seek=0;for(const p of gzPeople){if(p.st===2)safe++;else if(p.st===3)down++;else if(p.st===1)seek++}
 let cov=0,free=0;for(const i of gzWalk)if(gzCov[i]){cov++;if(gzOwn[i]<0)free++}
 return{on:GZS.on,ready:GZS.ready,spawned:GZS.spawned,people:gzPeople.length,safe,down,seek,walk:gzWalk.length,cov,free,raid:GZS.raid,raidN:GZS.raidN,
  planes:gzPlanes.length,bombs:gzBombs.length,fx:gzFx.length,pts:S.gz.pts,best:S.gz.best,ms:S.gz.ms,seen:S.gz.seen,
  pos:gzPeople.map(p=>[+p.x.toFixed(2),+p.y.toFixed(2),+p.z.toFixed(2),p.st,p.tgt])}};
window.__prisonStep=sec=>{for(let t=0;t<sec;t+=.05)gzTick(.05);return window.__prison()};
window.__prisonRaid=()=>{GZS.raidT=0};
window.__prisonBoom=(x,z)=>gzBoom(x,gzImpactY(x,z),z);

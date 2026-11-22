/* ===== 4. Chunk manager, edits and mesher ===== */
const chunks=new Map(),loaded=[],vpool=[],dirtySet=new Set(),botLog=[],blc=new Map(),MAXC=330,BLOG_MAX=12000;
const PERSIST={db:null,ok:false,dirty:new Set(),botDirty:false,cnt:0,clr:new Set()};
let lck=-1,lcv=null,worldDirty=false,RAD=4,loadBoost=0;
function chunkAt(cx,cz){if(cx<0||cz<0||cx>=NC||cz>=NC)return null;const k=cx+cz*NC;if(k===lck)return lcv;lck=k;lcv=chunks.get(k)||null;return lcv}
function getB(x,y,z){if(y<0||y>=H)return 0;const c=chunkAt(x>>4,z>>4);return c?c.v[(y<<8)|((z&15)<<4)|(x&15)]:0}
/* block at a place whether or not its chunk is loaded (uses saved edits) */
function getAny(x,y,z){
 if(y<0||y>=H)return 0;const c=chunkAt(x>>4,z>>4);if(c)return c.v[(y<<8)|((z&15)<<4)|(x&15)];
 const k=(x>>4)+(z>>4)*NC,li=(y<<8)|((z&15)<<4)|(x&15);let m=edits.get(k);if(m&&m.has(li))return m.get(li);
 m=bedits.get(k);return m&&m.has(li)?m.get(li):0;
}
function hasEdit(x,y,z){const k=(x>>4)+(z>>4)*NC,m=edits.get(k);return!!m&&m.has((y<<8)|((z&15)<<4)|(x&15))}
function nbReady(cx,cz){return(cx<=0||chunks.has(cx-1+cz*NC))&&(cx>=NC-1||chunks.has(cx+1+cz*NC))&&(cz<=0||chunks.has(cx+(cz-1)*NC))&&(cz>=NC-1||chunks.has(cx+(cz+1)*NC))}
/* hard cap: make room before loading, farthest chunk first, never the player's chunk or its 8 neighbours */
let evX=-1,evZ=-1;
function evictForCap(){
 const px=evX>=0?evX:clamp(Math.floor(player.x/16),0,NC-1),pz=evZ>=0?evZ:clamp(Math.floor(player.z/16),0,NC-1);
 while(loaded.length>=MAXC){
  let f=null,fd=-1;
  for(let i=0;i<loaded.length;i++){const c=loaded[i],dx=c.cx-px,dz=c.cz-pz;
   if(dx>=-1&&dx<=1&&dz>=-1&&dz<=1)continue;
   const d=dx*dx+dz*dz;if(d>fd){fd=d;f=c}}
  if(!f)break;
  unloadChunk(f);
 }
}
function loadChunk(cx,cz){
 if(loaded.length>=MAXC)evictForCap();
 const v=vpool.pop()||new Uint8Array(CV);v.fill(0);
 const c={key:cx+cz*NC,cx,cz,v,st:1,my:0,chests:[],buf:[null,null],cnt:[0,0],bytes:0};
 genChunk(c);chunks.set(c.key,c);loaded.push(c);lck=-1;beamsDirty=true;return c;
}
function freeMesh(c){for(let p=0;p<2;p++){if(c.buf[p]&&gl)gl.deleteBuffer(c.buf[p]);c.buf[p]=null;c.cnt[p]=0}c.bytes=0}
function unloadChunk(c){
 freeMesh(c);chunks.delete(c.key);const i=loaded.indexOf(c);if(i>=0){loaded[i]=loaded[loaded.length-1];loaded.pop()}
 if(vpool.length<80)vpool.push(c.v);c.v=null;dirtySet.delete(c.key);lck=-1;beamsDirty=true;
}
/* bot edits are remembered in a bounded log: the oldest ones are forgotten first, but a cell is only forgotten when no newer log entry exists for it */
function blAdd(k,li){botLog.push(k,li);const id=k*CV+li;blc.set(id,(blc.get(id)||0)+1)}
function blDrop(k,li){const id=k*CV+li,n=(blc.get(id)||1)-1;if(n>0){blc.set(id,n);return}blc.delete(id);const m=bedits.get(k);if(m){m.delete(li);if(!m.size)bedits.delete(k)}}
function blClear(){botLog.length=0;blc.clear()}
function trimBotLog(n){
 n=n||Math.max(2,(BLOG_MAX>>2)&~1);
 for(let i=0;i<n&&i<botLog.length;i+=2)blDrop(botLog[i],botLog[i+1]);
 botLog.splice(0,n);
}
/* generated terrain without any saved edit (used to restore ground when a bot tidies a structure away) */
const pristine=new Map();
function pristineChunk(cx,cz){
 const k=cx+cz*NC;let p=pristine.get(k);
 if(p){pristine.delete(k);pristine.set(k,p);return p}
 p={key:k,cx,cz,v:new Uint8Array(CV),chests:[],my:0,pure:true};genChunk(p);pristine.set(k,p);
 if(pristine.size>14)pristine.delete(pristine.keys().next().value);return p;
}
/* forget every saved edit of one cell so it reverts to generated terrain */
function clearEdit(x,y,z){
 if(!inb(x,y,z))return;
 const k=(x>>4)+(z>>4)*NC,li=(y<<8)|((z&15)<<4)|(x&15);
 for(const mp of[edits,bedits]){const m=mp.get(k);if(m&&m.delete(li)){if(!m.size)mp.delete(k);if(mp===edits){PERSIST.dirty.add(k);PERSIST.clr.add(k*CV+li)}else PERSIST.botDirty=true}}
 const c=chunks.get(k);
 if(c){const nb=pristineChunk(x>>4,z>>4).v[li];if(c.v[li]!==nb){c.v[li]=nb;markDirty(c,x,z);beamsDirty=true}}
 worldDirty=true;queueSave();
}
function unloadAll(){while(loaded.length)unloadChunk(loaded[loaded.length-1]);qList.length=0;qPos=0;qCx=-9999}
/* ---- edits ---- */
function setBlock(x,y,z,b,who){
 if(!inb(x,y,z)||y>=H-1||liftProtected(x,y,z))return false;
 const k=(x>>4)+(z>>4)*NC,li=(y<<8)|((z&15)<<4)|(x&15),bot=who===1;
 if(!bot){const bm=bedits.get(k);if(bm&&bm.has(li)){bm.delete(li);PERSIST.botDirty=true}}
 const mp=bot?bedits:edits;let m=mp.get(k);if(!m){m=new Map();mp.set(k,m)}m.set(li,b);if(!bot){PERSIST.dirty.add(k);PERSIST.cnt++}
 if(bot){blAdd(k,li);if(botLog.length>BLOG_MAX)trimBotLog();PERSIST.botDirty=true}
 else if(JB&&who===0){const gk=gkey(x,y,z);if(b&&joinMap.get(gk)===b)JB.mine.add(gk);else JB.mine.delete(gk)}
 const c=chunks.get(k);
 if(c){c.v[li]=b;if(b&&y>c.my)c.my=y;markDirty(c,x,z);if(b===B.CHEST||c.chests.length)beamsDirty=true}
 worldDirty=true;queueSave();
 if(who===0)checkMission();
 checkJoin();
 netLocalEdit(x,y,z,b,who);
 return true;
}
function markDirty(c,x,z){
 dirtySet.add(c.key);
 const lx=x&15,lz=z&15;
 if(lx===0&&c.cx>0)dirtySet.add(c.key-1);if(lx===15&&c.cx<NC-1)dirtySet.add(c.key+1);
 if(lz===0&&c.cz>0)dirtySet.add(c.key-NC);if(lz===15&&c.cz<NC-1)dirtySet.add(c.key+NC);
}
/* ---- mesher: compact 12-byte vertices (4 x int16 position/tile, 4 x uint8 light) ---- */
const PAD=new Uint8Array(18*H*18),MV=64000,MB=[new ArrayBuffer(MV*12),new ArrayBuffer(MV*12)];
const S16=[new Int16Array(MB[0]),new Int16Array(MB[1])],S8=[new Uint8Array(MB[0]),new Uint8Array(MB[1])],nv=[0,0];
const FACES=[
 {n:[1,0,0],u:[0,0,1],v:[0,1,0],s:.8,k:2},{n:[-1,0,0],u:[0,0,1],v:[0,1,0],s:.8,k:2},
 {n:[0,0,1],u:[1,0,0],v:[0,1,0],s:.68,k:2},{n:[0,0,-1],u:[1,0,0],v:[0,1,0],s:.68,k:2},
 {n:[0,1,0],u:[1,0,0],v:[0,0,1],s:1,k:0},{n:[0,-1,0],u:[1,0,0],v:[0,0,1],s:.5,k:1}];
const AO_K=[.55,.72,.86,1],CORN=[[0,0],[1,0],[1,1],[0,1]];
const di=a=>a[0]+a[2]*18+a[1]*324;
const FND=FACES.map(f=>di(f.n)),FPX=[],FAO=[],ao4=[0,0,0,0];
FACES.forEach((f,fi)=>{FPX[fi]=[];FAO[fi]=[];for(let c=0;c<4;c++){
 const a=CORN[c][0],b=CORN[c][1],sa=a*2-1,sb=b*2-1;
 FPX[fi].push([(f.n[0]>0?1:0)+a*f.u[0]+b*f.v[0],(f.n[1]>0?1:0)+a*f.u[1]+b*f.v[1],(f.n[2]>0?1:0)+a*f.u[2]+b*f.v[2],a|((1-b)<<1)]);
 FAO[fi].push([FND[fi]+sa*di(f.u),FND[fi]+sb*di(f.v),FND[fi]+sa*di(f.u)+sb*di(f.v)]);
}});
function fillPad(c){
 const v=c.v,cx=c.cx,cz=c.cz,W_=cx>0?chunks.get(c.key-1):null,E_=cx<NC-1?chunks.get(c.key+1):null,N_=cz>0?chunks.get(c.key-NC):null,S_=cz<NC-1?chunks.get(c.key+NC):null;
 const my=Math.min(c.my+2,H-1);
 PAD.fill(0);
 for(let y=0;y<=my;y++){
  for(let z=0;z<16;z++){const o=(y<<8)|(z<<4),p=(y*18+z+1)*18+1;for(let x=0;x<16;x++)PAD[p+x]=v[o+x];
   PAD[p-1]=W_?W_.v[o+15]:0;PAD[p+16]=E_?E_.v[o]:0}
  const p0=(y*18)*18+1,p1=(y*18+17)*18+1;
  for(let x=0;x<16;x++){PAD[p0+x]=N_?N_.v[(y<<8)|(15<<4)|x]:0;PAD[p1+x]=S_?S_.v[(y<<8)|x]:0}
 }
}
function vtx(p,X,Y,Z,w,sh,em){const n=nv[p]++,i=n*6,j=n*12;S16[p][i]=X;S16[p][i+1]=Y;S16[p][i+2]=Z;S16[p][i+3]=w;S8[p][j+8]=sh;S8[p][j+9]=em}
function plant(b,x,y,z,df){
 const t=df.t[2],h=df.h,sh=240,Y0=y*16,Y1=y*16+h,X0=x*16+1,X1=x*16+15,Z0=z*16+1,Z1=z*16+15;
 if(nv[0]>MV-8)return;
 vtx(0,X0,Y0,Z0,t+128,sh,0);vtx(0,X1,Y0,Z1,t+192,sh,0);vtx(0,X1,Y1,Z1,t+64,sh,0);vtx(0,X0,Y1,Z0,t,sh,0);
 vtx(0,X1,Y0,Z0,t+128,sh,0);vtx(0,X0,Y0,Z1,t+192,sh,0);vtx(0,X0,Y1,Z1,t+64,sh,0);vtx(0,X1,Y1,Z0,t,sh,0);
}
function meshChunk(c){
 fillPad(c);nv[0]=nv[1]=0;
 const my=Math.min(c.my+1,H-2);
 for(let y=0;y<=my;y++)for(let z=0;z<16;z++)for(let x=0;x<16;x++){
  const pi=(y*18+z+1)*18+x+1,b=PAD[pi];if(!b)continue;
  const df=DEFS[b];
  if(df.kind==='x'){plant(b,x,y,z,df);continue}
  const pass=df.trans?1:0,aoOn=df.kind==='o',dropTop=b===B.WATER&&PAD[pi+324]!==B.WATER;
  for(let f=0;f<6;f++){
   if(f===5&&y===0)continue;
   const nb=PAD[pi+FND[f]];
   if(OPQ[nb]||(df.trans&&nb===b))continue;
   if(nv[pass]>MV-8)break;
   const fa=FACES[f],t=df.t[fa.k],px=FPX[f],fo=FAO[f];
   for(let c4=0;c4<4;c4++){
    let o=3;
    if(aoOn){const q=fo[c4],s1=OPQ[PAD[pi+q[0]]],s2=OPQ[PAD[pi+q[1]]],cr=OPQ[PAD[pi+q[2]]];o=s1&&s2?0:3-(s1+s2+cr)}
    ao4[c4]=o;
   }
   const rot=ao4[0]+ao4[2]>ao4[1]+ao4[3]?0:1;
   for(let k=0;k<4;k++){
    const c4=(k+rot)&3,q=px[c4];let Y=(y+q[1])*16;if(dropTop&&q[1]===1)Y-=2;
    vtx(pass,(x+q[0])*16,Y,(z+q[2])*16,t+64*q[3],(fa.s*AO_K[ao4[c4]]*255)|0,df.emis?255:0);
   }
  }
 }
 return nv[0]+nv[1];
}
function uploadMesh(c){
 let bytes=0;
 for(let p=0;p<2;p++){
  if(!nv[p]){if(c.buf[p]){gl.deleteBuffer(c.buf[p]);c.buf[p]=null}c.cnt[p]=0;continue}
  if(!c.buf[p])c.buf[p]=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,c.buf[p]);gl.bufferData(gl.ARRAY_BUFFER,S8[p].subarray(0,nv[p]*12),gl.STATIC_DRAW);
  c.cnt[p]=nv[p];bytes+=nv[p]*12;
 }
 c.bytes=bytes;c.st=2;
}
function meshAndUpload(c){meshChunk(c);uploadMesh(c)}
/* ---- streaming: nearest-first queue biased toward the view direction ---- */
let qList=[],qPos=0,qCx=-9999,qCz=-9999,qYaw=0,qRad=0,qTime=0,pcx=0,pcz=0,streamIdle=true;
function buildQueue(now){
 qList.length=0;qPos=0;qCx=pcx;qCz=pcz;qYaw=player.yaw;qRad=RAD;qTime=now;
 const R=RAD,Gr=R+1,fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw),tmp=[];
 for(let dz=-Gr;dz<=Gr;dz++)for(let dx=-Gr;dx<=Gr;dx++){
  const d2=dx*dx+dz*dz;if(d2>Gr*Gr)continue;
  const cx=pcx+dx,cz=pcz+dz;if(cx<0||cz<0||cx>=NC||cz>=NC)continue;
  const c=chunks.get(cx+cz*NC);
  if(c&&(c.st!==1||d2>R*R))continue;
  const d=Math.sqrt(d2),fw=d?(dx*fx+dz*fz)/d:0;
  tmp.push([d*(1.35-.35*fw),cx+cz*NC]);
 }
 tmp.sort((a,b)=>a[0]-b[0]);
 for(const t of tmp)qList.push(t[1]);
}
function streamWork(ms,maxMesh,now){
 const t0=performance.now();let meshes=0,did=0;
 pcx=clamp(Math.floor(player.x/16),0,NC-1);pcz=clamp(Math.floor(player.z/16),0,NC-1);
 if(pcx!==qCx||pcz!==qCz||RAD!==qRad||Math.abs(player.yaw-qYaw)>.7||(qPos>=qList.length&&now-qTime>500)||now-qTime>2500)buildQueue(now);
 for(const k of dirtySet){
  const c=chunks.get(k);
  if(!c||c.st!==2){dirtySet.delete(k);continue}
  if(!nbReady(c.cx,c.cz))continue;
  dirtySet.delete(k);meshAndUpload(c);did++;if(++meshes>=3||performance.now()-t0>ms)break;
 }
 let spin=0;
 while(qPos<qList.length){
  if(did&&performance.now()-t0>ms)break;
  const k=qList[qPos++],c=chunks.get(k),cx=k%NC,cz=(k-cx)/NC;
  if(!c){loadChunk(cx,cz);did++}
  else if(c.st===1&&nbReady(cx,cz)){
   if(meshes>=maxMesh){qPos--;break}
   meshAndUpload(c);meshes++;did++}
  else if(c.st===1){if(spin++<64)qList.push(k)}
  if(qPos>qList.length+400)break;
 }
 streamIdle=qPos>=qList.length&&!dirtySet.size;
 return did;
}
function unloadFar(){
 const lim=(RAD+2)*(RAD+2);
 for(let i=loaded.length-1;i>=0;i--){const c=loaded[i],dx=c.cx-pcx,dz=c.cz-pcz;if(dx*dx+dz*dz>lim)unloadChunk(c)}
 while(loaded.length>MAXC){let f=null,fd=-1;for(const c of loaded){const d=(c.cx-pcx)*(c.cx-pcx)+(c.cz-pcz)*(c.cz-pcz);if(d>fd){fd=d;f=c}}unloadChunk(f)}
}
function memBytes(){let m=loaded.length*CV,k=0;for(const c of loaded){m+=c.bytes;if(c.st===2)k++}return[m,k]}
/* synchronous load for tests, teleports and hooks */
function forceLoad(cx,cz,r){
 evX=cx;evZ=cz;
 for(let z=cz-r-1;z<=cz+r+1;z++)for(let x=cx-r-1;x<=cx+r+1;x++){if(x<0||z<0||x>=NC||z>=NC||chunks.has(x+z*NC))continue;loadChunk(x,z)}
 for(let z=cz-r;z<=cz+r;z++)for(let x=cx-r;x<=cx+r;x++){const c=chunkAt(x,z);if(c&&c.st===1&&nbReady(x,z))meshAndUpload(c)}
 evX=evZ=-1;
}

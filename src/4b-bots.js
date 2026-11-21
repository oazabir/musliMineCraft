/* ===== 6b. Builder bots ===== */
const BN=['Yusuf','Maryam','Idris','Aisha','Bilal','Zaynab'];
const BSPEC=['arches and gates','wells and fountains','small houses','gardens','huts and shelters','pavilions and domes'];
/* friendly box characters: skin tone, outfit, head covering (kufi / turban / hijab), beard style, trade tool. m = man, f = woman (hijab, long abaya) */
const SK=[[.95,.78,.64],[.86,.65,.48],[.65,.45,.32],[.42,.28,.2]];
const BLOOK=[
 {m:1,skin:SK[1],dress:[.93,.9,.8],pants:[.35,.38,.45],sash:[.1,.55,.6],cover:[.97,.96,.92],cap:1,beard:1,bc:[.12,.1,.1],tool:[.75,.78,.8],shoe:[.35,.22,.12],r:[.1,.55,.6]},
 {m:0,skin:SK[0],dress:[.16,.24,.5],cover:[.25,.42,.72],shoe:[.2,.15,.12],tool:[.7,.45,.2],r:[.25,.42,.72]},
 {m:1,skin:SK[2],dress:[.82,.52,.25],pants:[.3,.25,.2],sash:[.25,.18,.12],cover:[.95,.93,.85],cap:2,beard:2,bc:[.25,.16,.1],tool:[.45,.45,.5],shoe:[.3,.2,.12],r:[.88,.52,.14]},
 {m:0,skin:SK[1],dress:[.4,.5,.22],cover:[.88,.5,.6],shoe:[.25,.16,.1],tool:[.3,.55,.85],r:[.88,.5,.6]},
 {m:1,skin:SK[3],dress:[.3,.55,.35],pants:[.25,.3,.28],sash:[.55,.25,.15],cover:[.6,.2,.22],cap:1,beard:3,bc:[.1,.08,.08],tool:[.6,.6,.62],shoe:[.2,.14,.1],r:[.3,.55,.35]},
 {m:0,skin:SK[2],dress:[.45,.28,.5],cover:[.52,.56,.3],shoe:[.22,.15,.1],tool:[1,.85,.4],r:[.52,.56,.3]}];
for(const L of BLOOK)L.bcol=L.beard?L.bc:[L.skin[0]*.45,L.skin[1]*.35,L.skin[2]*.3];
const MAXB=6,botGeo=new Float32Array(MAXB*16*252+160*252+1720*252+64),bots=[];let botN=0,partAmb=null;
const ringC=(n,y,b,sk)=>{const a=[];for(let i=0;i<n;i++)for(let j=0;j<n;j++)if(i===0||j===0||i===n-1||j===n-1)a.push([i,y,j,b]);return a};
const ringR=(w,d,y,b)=>{const a=[];for(let i=0;i<w;i++)for(let j=0;j<d;j++)if(i===0||j===0||i===w-1||j===d-1)a.push([i,y,j,b]);return a};
const fill=(w,d,y,b)=>{const a=[];for(let i=0;i<w;i++)for(let j=0;j<d;j++)a.push([i,y,j,b]);return a};
const col=(x,z,y0,y1,b)=>{const a=[];for(let y=y0;y<=y1;y++)a.push([x,y,z,b]);return a};
function house(v){
 const a=ringC(5,0,B.MUD).concat(ringC(5,1,B.MUD),ringC(5,2,B.MUD)).filter(c=>!(c[0]===2&&c[2]===0&&c[1]<2));
 for(const c of a){if(c[0]===0&&c[2]===2&&c[1]===1)c[3]=B.LATTICE;if(v===1&&c[0]===4&&c[2]===2&&c[1]===1)c[3]=B.LATTICE;if(v===2&&c[2]===4&&c[0]===2&&c[1]===1)c[3]=B.GLASS}
 a.push(...fill(5,5,3,B.SANDSTONE),...ringC(5,4,v===2?B.ARCH:B.MUD),[2,2,2,B.LANTERN]);
 if(v>=1)a.push([1,2,0,B.TURQ],[2,2,0,B.TURQ],[3,2,0,B.TURQ],[0,0,0,B.LANTERN]);
 if(v===2)a.push([1,5,1,B.TURQ],[2,5,2,B.GOLD],[3,5,3,B.TURQ],[2,5,0,B.FL0+2]);
 return a;
}
function tree(x,z,b,y0){return[...col(x,z,y0,y0+1,B.WOOD),[x,y0+2,z,b],[x-1,y0+2,z,B.LEAVES],[x+1,y0+2,z,B.LEAVES],[x,y0+2,z-1,B.LEAVES],[x,y0+2,z+1,B.LEAVES],[x,y0+3,z,B.LEAVES]]}
const TPLS=[ /* [bot index] -> its trade; each trade has 3-4 templates */
 {t:0,n:'a small arch',w:5,d:1,g:()=>{const a=[];for(let y=0;y<4;y++)a.push([0,y,0,B.ARCH],[4,y,0,B.ARCH]);for(let x=0;x<5;x++)a.push([x,4,0,B.ARCH]);a.push([1,3,0,B.ARCH],[3,3,0,B.ARCH],[2,5,0,B.GOLD],[0,5,0,B.LANTERN],[4,5,0,B.LANTERN]);return a}},
 {t:0,n:'a garden gate',w:7,d:1,g:()=>{const a=[];for(const x of[0,6])for(let y=0;y<5;y++)a.push([x,y,0,B.ARCH]);for(let x=0;x<7;x++)a.push([x,4,0,x===0||x===6?B.TURQ:B.ARCH]);for(let x=1;x<6;x++)a.push([x,3,0,B.LATTICE]);a.push([0,5,0,B.LANTERN],[6,5,0,B.LANTERN],[3,5,0,B.GOLD]);return a}},
 {t:0,n:'a pointed gateway',w:5,d:2,g:()=>{const a=[];for(const x of[0,4])for(const z of[0,1])for(let y=0;y<4;y++)a.push([x,y,z,B.ARCH]);for(const z of[0,1])a.push([1,3,z,B.ARCH],[3,3,z,B.ARCH],[2,4,z,B.ARCH],[1,4,z,B.TURQ],[3,4,z,B.TURQ]);a.push([2,5,0,B.GOLD],[0,4,0,B.LANTERN],[4,4,0,B.LANTERN]);return a}},
 {t:0,n:'a double arch',w:7,d:1,g:()=>{const a=[];for(const x of[0,3,6])for(let y=0;y<4;y++)a.push([x,y,0,B.ARCH]);for(const x of[1,2,4,5])a.push([x,3,0,B.ARCH]);for(const x of[0,3,6])a.push([x,4,0,B.LANTERN]);a.push([1,4,0,B.BLUE],[2,4,0,B.BLUE],[4,4,0,B.BLUE],[5,4,0,B.BLUE]);return a}},
 {t:1,n:'a well',w:3,d:3,g:()=>[...ringC(3,0,B.STONE),[1,0,1,B.WATER],[0,1,1,B.WOOD],[0,2,1,B.WOOD],[2,1,1,B.WOOD],[2,2,1,B.WOOD],[0,3,1,B.WOOD],[1,3,1,B.WOOD],[2,3,1,B.WOOD]]},
 {t:1,n:'a fountain',w:5,d:5,g:()=>{const a=ringC(5,0,B.ARCH);for(let i=1;i<4;i++)for(let j=1;j<4;j++)if(i!==2||j!==2)a.push([i,0,j,B.WATER]);a.push([2,0,2,B.MARBLE],[2,1,2,B.MARBLE],[2,2,2,B.WATER]);return a}},
 {t:1,n:'a roofed well',w:3,d:3,g:()=>{const a=[...ringC(3,0,B.STONE),[1,0,1,B.WATER]];for(const[x,z]of[[0,0],[2,0],[0,2],[2,2]])a.push(...col(x,z,1,2,B.WOOD));a.push(...ringC(3,3,B.MARBLE),[1,3,1,B.TURQ],[1,4,1,B.GOLD]);return a}},
 {t:1,n:'a drinking fountain',w:3,d:3,g:()=>[...ringC(3,0,B.ARCH),[1,0,1,B.MARBLE],[1,1,1,B.MARBLE],[1,2,1,B.WATER],[0,1,0,B.LANTERN],[2,1,2,B.LANTERN]]},
 {t:2,n:'a small house',w:5,d:5,g:()=>house(0)},
 {t:2,n:'a house with a blue door frame',w:5,d:5,g:()=>house(1)},
 {t:2,n:'a house with a roof garden',w:5,d:5,g:()=>house(2)},
 {t:3,n:'a flower garden',w:7,d:5,g:()=>{const a=ringR(7,5,0,B.ARCH);for(let i=1;i<6;i++)for(let j=1;j<4;j++)if(!(i===3&&j===2))a.push([i,0,j,B.FL0+((i+j*2)%6)]);a.push(...tree(3,2,B.ORANGE,0));return a}},
 {t:3,n:'a fruit garden',w:5,d:5,g:()=>{const a=ringC(5,0,B.MUD);for(let i=1;i<4;i++)for(let j=1;j<4;j++)a.push([i,0,j,(i+j)%2?B.FL0+1:B.TUFT]);a.push(...tree(1,1,B.ORANGE,0),...tree(3,3,B.POM,0));return a}},
 {t:3,n:'a garden with a water channel',w:7,d:5,g:()=>{const a=ringR(7,5,0,B.ARCH);for(let i=1;i<6;i++){a.push([i,0,2,B.WATER]);a.push([i,0,1,B.FL0+(i%6)],[i,0,3,B.FL0+((i+3)%6)])}a.push(...tree(1,2,B.POM,0).filter(c=>c[1]>0||c[0]!==1||c[2]!==2||true).map(c=>c),[5,1,2,B.LANTERN]);return a.filter(c=>!(c[0]===1&&c[2]===2&&c[1]===0)).concat([[1,0,2,B.DIRT]])}},
 {t:4,n:'a palm-wood hut',w:5,d:5,g:()=>{const a=[];for(const[x,z]of[[0,0],[4,0],[0,4],[4,4]])a.push(...col(x,z,0,2,B.WOOD));a.push(...fill(5,5,3,B.LEAVES),[2,4,2,B.LEAVES],[2,0,2,B.TRELLIS],[2,1,2,B.TRELLIS]);return a}},
 {t:4,n:'a market stall',w:3,d:3,g:()=>{const a=[];for(const[x,z]of[[0,0],[2,0],[0,2],[2,2]])for(let y=0;y<3;y++)a.push([x,y,z,B.TRELLIS]);const aw=B.AWR;
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)a.push([i,3,j,aw]);a.push([1,0,2,B.TRELLIS],[1,1,2,B.ORANGE]);return a}},
 {t:4,n:'a bench and lantern post',w:5,d:2,g:()=>[[0,0,1,B.ARCH],[2,0,1,B.ARCH],[0,1,0,B.TRELLIS],[2,1,0,B.TRELLIS],[0,1,1,B.TRELLIS],[1,1,1,B.TRELLIS],[2,1,1,B.TRELLIS],[0,2,0,B.TRELLIS],[1,2,0,B.TRELLIS],[2,2,0,B.TRELLIS],
  [4,0,0,B.TRELLIS],[4,1,0,B.TRELLIS],[4,2,0,B.TRELLIS],[4,3,0,B.LANTERN]]},
 {t:4,n:'a palm-leaf shade',w:3,d:3,g:()=>{const a=[];for(const[x,z]of[[0,0],[2,0],[0,2],[2,2]])a.push(...col(x,z,0,2,B.WOOD));a.push(...fill(3,3,3,B.LEAVES),[1,0,1,B.TRELLIS]);return a}},
 {t:5,n:'a little pavilion with a dome',w:5,d:5,g:()=>{const a=[];for(const[x,z]of[[0,0],[4,0],[0,4],[4,4]])for(let y=0;y<3;y++)a.push([x,y,z,B.ARCH]);
  a.push(...ringC(5,3,B.MARBLE));for(let i=1;i<4;i++)for(let j=1;j<4;j++)a.push([i,4,j,B.TURQ]);a.push([2,5,2,B.GOLD]);return a}},
 {t:5,n:'a lantern tower',w:3,d:3,g:()=>[...ringC(3,0,B.MARBLE),...col(1,1,0,5,B.MARBLE),...ringC(3,5,B.LATTICE),[1,6,1,B.TURQ],[1,7,1,B.GOLD],[0,6,0,B.LANTERN],[2,6,2,B.LANTERN]].filter(c=>!(c[0]===1&&c[2]===1&&c[1]===5&&0))},
 {t:5,n:'a domed shrine',w:3,d:3,g:()=>{const a=[...ringC(3,0,B.MARBLE),...ringC(3,1,B.MARBLE),...ringC(3,2,B.MARBLE)].filter(c=>!(c[0]===1&&c[2]===0&&c[1]<2));a.push(...fill(3,3,3,B.TURQ),[1,4,1,B.TURQ],[1,5,1,B.GOLD],[1,1,1,B.LANTERN]);return a}},
 {t:5,n:'a round kiosk',w:5,d:5,g:()=>{const a=[];for(const[x,z]of[[0,0],[4,0],[0,4],[4,4],[2,0],[0,2],[4,2],[2,4]])a.push(...col(x,z,0,2,B.MARBLE));a.push(...fill(5,5,3,B.ARCH),...fill(3,3,4,B.BLUE),[2,5,2,B.GOLD],[2,2,2,B.LANTERN]);return a.filter(c=>!(c[1]===2&&c[0]===2&&c[2]===2))}}];
TPLS.forEach((t,i)=>t.id=i);
const TRADE=[0,1,2,3,4,5].map(i=>TPLS.filter(t=>t.t===i));
let botSpawnT=0,lastTpl=[-1,-1,-1,-1,-1,-1],BSPD=1;
const BS={WANDER:0,BUILD:1,CELE:2,TIDY:3};
function walkY(x,z,y0){
 const ix=Math.floor(x),iz=Math.floor(z),c=chunkAt(ix>>4,iz>>4);if(!c||c.st!==2||ix<4||iz<4||ix>WX-4||iz>WZ-4)return -1;
 const lo=Math.max(1,Math.floor(y0)-3);
 for(let y=Math.min(H-4,Math.floor(y0)+2);y>=lo;y--){
  const o=((iz&15)<<4)|(ix&15),b0=c.v[((y-1)<<8)|o];
  if(!DEFS[b0].solid)continue;
  const f=c.v[(y<<8)|o],hd=c.v[((y+1)<<8)|o];
  if(DEFS[f].solid||DEFS[hd].solid||f===B.WATER||hd===B.WATER)return -1;
  return y;
 }
 return -1;
}
function getBot(i){
 if(!bots[i])bots[i]={i,name:BN[i],look:BLOOK[i],on:false,x:0,y:0,z:0,yaw:0,st:0,t:0,tx:0,tz:0,ph:0,leg:0,np:0,cells:[],skip:[],ci:0,site:null,tpl:null,sx:0,sz:0,stk:0,pxs:0,pzs:0,cele:0,arm:0,skip:null,idle:0,mvT:0,legsDone:1,done:[],ds:null,tag:'',tagK:-1,chk:0,rsT:0,pl:0};
 return bots[i];
}
/* tag text is cached and only rebuilt when the state changes (no per-frame strings) */
function botTag(b){
 const k=b.st*100+(b.st===BS.BUILD&&b.tpl?b.tpl.id+1:0);
 if(k!==b.tagK){b.tagK=k;b.tag=b.name+' · '+(b.st===BS.BUILD&&b.tpl?'building '+b.tpl.n:b.st===BS.TIDY?'tidying up':b.st===BS.CELE?'celebrating':'looking for a spot')}
 return b.tag;
}
function bodyHit(o,x,y,z){return o.x-.35<x+1&&o.x+.35>x&&o.z-.35<z+1&&o.z+.35>z&&o.y<y+1&&o.y+1.9>y}
function freeSpot(x,z,y0,self){
 const y=walkY(x,z,y0);if(y<0)return -1;
 if(Math.hypot(x-player.x,z-player.z)<1.2&&Math.abs(y-player.y)<2.5)return -1;
 for(const o of bots)if(o!==self&&o.on&&Math.hypot(o.x-x,o.z-z)<1.1)return -1;
 return y;
}
/* move a bot to the nearest free standing spot that is outside its own footprint (+1) */
function botEject(b){
 const s=b.site||(b.ds&&b.ds.s);
 let best=-1,bd=1e9,bx=0,bz=0;
 for(let r=1;r<=9;r+=1)for(let k=0;k<20;k++){
  const a=k*.3142+r*.7,x=b.x+Math.cos(a)*r,z=b.z+Math.sin(a)*r;
  if(s&&x>s.x0-1.2&&x<s.x0+s.w+1.2&&z>s.z0-1.2&&z<s.z0+s.d+1.2)continue;
  const y=freeSpot(x,z,b.y+1,b);if(y<0)continue;
  const d=r;if(d<bd){bd=d;best=y;bx=x;bz=z}
 }
 if(best<0)return false;
 b.x=bx;b.y=best;b.z=bz;b.pxs=bx;b.pzs=bz;b.stk=0;b.mvT=0;b.np=.4;return true;
}
function botToSite(b){
 const s=b.site||(b.ds&&b.ds.s);if(!s)return false;
 const rr=Math.max(s.w,s.d)/2+2.5;
 for(let k=0;k<20;k++){
  const a=Math.random()*6.283,x=s.x+Math.cos(a)*rr,z=s.z+Math.sin(a)*rr,y=freeSpot(x,z,s.y,b);
  if(y<0||Math.abs(y-s.y)>2)continue;
  b.x=x;b.y=y;b.z=z;b.pxs=x;b.pzs=z;b.stk=0;b.mvT=0;b.t=0;b.np=.3;return true;
 }
 return false;
}
/* place a bot near (nearX,nearZ), keeping clear of the plot, the player and the other bots; sector picks spread them out */
function botRespawn(b,nearX,nearZ,minD,maxD,y0,sector){
 for(let k=0;k<30;k++){
  const a=sector!==undefined&&k<18?sector+(Math.random()-.5)*1.0:Math.random()*6.283,d=minD+Math.random()*(maxD-minD),x=nearX+Math.cos(a)*d,z=nearZ+Math.sin(a)*d;
  const y=walkY(x,z,y0===undefined?player.y+1:y0);
  if(y<0||nearPlot(x,z,3)||inLm(x,z,0))continue;
  let near=false;for(const o of bots)if(o!==b&&o.on&&Math.hypot(o.x-x,o.z-z)<(k<22?8:3))near=true;
  if(near||Math.hypot(x-player.x,z-player.z)<4)continue;
  if(JB&&JB.bot===b)leaveBuild(b.name+' had to move, so you left the build.');
  if(b.st===BS.BUILD&&b.site&&b.ci>0){b.done.push({x0:b.site.x0,z0:b.site.z0,y:b.site.y,tid:b.site.tid});if(b.done.length>6)b.done.shift()}
  b.x=x;b.y=y;b.z=z;b.on=true;b.st=BS.WANDER;b.t=0;b.site=null;b.cells.length=0;b.ds=null;b.tx=x;b.tz=z;b.stk=0;b.pxs=x;b.pzs=z;b.idle=.3+b.i*.35;b.mvT=0;b.legsDone=1;return true;
 }
 return false;
}
function botStep(b,dt,tx,tz,sp){
 b.mvT+=dt;const dx=tx-b.x,dz=tz-b.z,d=Math.hypot(dx,dz);if(d<.15)return 1;
 const st=Math.min(sp*dt,d),nx=b.x+dx/d*st,nz=b.z+dz/d*st;
 b.yaw=Math.atan2(-dx,-dz);
 const ny=walkY(nx,nz,b.y);
 if(ny<0||Math.abs(ny-b.y)>1.05)return -1;
 if(nearPlot(nx,nz,1)&&!nearPlot(b.x,b.z,1))return -1;
 if(Math.hypot(nx-player.x,nz-player.z)<3&&Math.hypot(nx-player.x,nz-player.z)<Math.hypot(b.x-player.x,b.z-player.z)&&Math.abs(ny-player.y)<3)return -1;
 for(const o of bots)if(o!==b&&o.on&&Math.hypot(nx-o.x,nz-o.z)<.6&&Math.hypot(b.x-o.x,b.z-o.z)>Math.hypot(nx-o.x,nz-o.z))return -1;
 b.x=nx;b.z=nz;b.y+=(ny-b.y)*Math.min(1,dt*12);b.ph+=st*4;b.leg=1;
 return 0;
}
function planSite(b){
 const trade=TRADE[b.i];
 for(let tr=0;tr<40;tr++){
  let ti=Math.floor(Math.random()*trade.length);if(trade[ti].id===lastTpl[b.i])ti=(ti+1)%trade.length;
  const tp=trade[ti],cx=Math.floor(b.x+(Math.random()-.5)*30),cz=Math.floor(b.z+(Math.random()-.5)*30);
  const y0=walkY(cx+tp.w/2,cz+tp.d/2,b.y);if(y0<0||Math.abs(y0-b.y)>3)continue;
  let ok=true;const found=[];
  gatherLms(cx-6,cz-6,cx+tp.w+6,cz+tp.d+6);
  for(let x=cx-1;x<=cx+tp.w&&ok;x++)for(let z=cz-1;z<=cz+tp.d;z++){
   const wy=walkY(x+.5,z+.5,y0);
   if(wy<0||wy>y0||wy<y0-1){ok=false;break}
   if(wy===y0-1&&x>=cx&&x<cx+tp.w&&z>=cz&&z<cz+tp.d)found.push([x,y0-1,z,B.PATH]);
   if(nearPlot(x,z,10)||inLm(x,z,6)||gzD(x,z)<GZ.moat+3||portalPad(x,z,3)){ok=false;break}
   if(x>=cx&&x<cx+tp.w&&z>=cz&&z<cz+tp.d)for(let y=y0-1;y<y0+8;y++)if(hasEdit(x,y,z)){ok=false;break}
  }
  if(!ok)continue;
  const px=cx+tp.w/2,pz=cz+tp.d/2;
  if(Math.hypot(px-player.x,pz-player.z)<tp.w/2+tp.d/2+8)continue;
  let clash=false;
  for(const o of bots)if(o!==b&&o.on){
   if(o.site&&Math.hypot(o.site.x-px,o.site.z-pz)<(tp.w+tp.d+o.site.w+o.site.d)/2+3)clash=true;
   if(o.ds&&Math.hypot(o.ds.s.x-px,o.ds.s.z-pz)<10)clash=true;
   for(const d of o.done)if(Math.abs(d.x0+2-px)<8&&Math.abs(d.z0+2-pz)<8)clash=true;
  }
  for(const d of b.done)if(Math.abs(d.x0+2-px)<8&&Math.abs(d.z0+2-pz)<8)clash=true;
  if(clash)continue;
  lastTpl[b.i]=tp.id;
  const cells=found.concat(tp.g().map(c=>[cx+c[0],y0+c[1],cz+c[2],c[3]]));
  cells.sort((p,q)=>p[1]-q[1]);
  b.tpl=tp;b.site={x:px,z:pz,y:y0,x0:cx,z0:cz,w:tp.w,d:tp.d,tid:tp.id};b.cells=cells;b.ci=0;b.np=1;b.skip=[];b.st=BS.BUILD;b.t=0;b.stk=0;
  return true;
 }
 return false;
}
function botCellLeft(b){let n=0;for(const c of b.cells)if(getAny(c[0],c[1],c[2])!==c[3])n++;return n}
function botFinish(b){
 b.st=BS.CELE;b.cele=3;
 if(b.site){b.done.push({x0:b.site.x0,z0:b.site.z0,y:b.site.y,tid:b.site.tid});if(b.done.length>6)b.done.shift();queueSave()}
 b.site=null;
 if(JB&&JB.bot===b){checkJoin(true);if(JB&&JB.bot===b)leaveBuild(b.name+' finished the build.')}
}
function botUnstick(b){
 if(JB&&JB.bot===b&&botToSite(b))return true;
 if(b.st===BS.BUILD||b.st===BS.TIDY){if(botToSite(b))return true}
 return botEject(b)||botRespawn(b,b.x,b.z,4,12,b.y)||botRespawn(b,bAX,bAZ,10,30);
}
/* the template cells (plus the path fill) of a finished structure */
function structCells(d){
 const tp=TPLS[d.tid],a=tp.g().map(c=>[d.x0+c[0],d.y+c[1],d.z0+c[2],c[3]]);
 for(let x=d.x0;x<d.x0+tp.w;x++)for(let z=d.z0;z<d.z0+tp.d;z++)if(getAny(x,d.y-1,z)===B.PATH&&hasEdit(x,d.y-1,z)||bhas(x,d.y-1,z))a.push([x,d.y-1,z,B.PATH]);
 a.sort((p,q)=>q[1]-p[1]);return a;
}
function bhas(x,y,z){const m=bedits.get((x>>4)+(z>>4)*NC);return!!m&&m.has((y<<8)|((z&15)<<4)|(x&15))}
function occupied(s){
 const x0=s.x0-.6,x1=s.x0+s.w+.6,z0=s.z0-.6,z1=s.z0+s.d+.6;
 if(player.x>x0&&player.x<x1&&player.z>z0&&player.z<z1&&player.y>s.y-3&&player.y<s.y+10)return true;
 for(const o of bots)if(o.on&&o.x>x0&&o.x<x1&&o.z>z0&&o.z<z1&&o.y>s.y-3&&o.y<s.y+10&&!(o.st===BS.TIDY&&o.ds&&o.ds.s===s&&false))return true;
 return false;
}
function tidyStart(b){
 const d=b.done[0],tp=TPLS[d.tid];
 b.ds={s:{x:d.x0+tp.w/2,z:d.z0+tp.d/2,y:d.y,x0:d.x0,z0:d.z0,w:tp.w,d:tp.d,tid:d.tid},d,cells:structCells(d),i:0,acc:0,wait:0};
 b.st=BS.TIDY;b.t=0;b.stk=0;b.mvT=0;b.site=null;
}
function tidyDone(b){
 b.done.shift();b.ds=null;b.st=BS.WANDER;b.t=0;b.legsDone=1;b.idle=.6;queueSave();
}
function tidyTick(b,dt){
 const ds=b.ds,s=ds.s;
 const cx=s.x0>>4,cz=s.z0>>4;
 const loaded4=chunks.has(cx+cz*NC)&&chunks.has(((s.x0+s.w)>>4)+((s.z0+s.d)>>4)*NC);
 const jbHit=JB&&Math.hypot(JB.sx-s.x,JB.sz-s.z)<s.w+s.d;
 if(jbHit||(occupied(s)&&b.ds.i===0)||(b.ds.i>0&&occupiedByOther(b,s))){
  ds.wait+=dt;b.leg=0;
  if(ds.wait>60){ds.wait=0;if(b.done.length>1){b.done.push(b.done.shift());b.ds=null;b.st=BS.WANDER;b.legsDone=1;b.idle=.2;tagReset(b);return}}
  return;
 }
 ds.wait=0;
 if(!loaded4){
  /* nothing is meshed here: clear the saved edits straight away */
  for(const c of ds.cells)clearEdit(c[0],c[1],c[2]);
  tidyDone(b);return;
 }
 const dd=Math.hypot(s.x-b.x,s.z-b.z),near=Math.max(s.w,s.d)/2+3.2;
 if(dd>near){
  const a=Math.atan2(b.z-s.z,b.x-s.x),tx=s.x+Math.cos(a)*(near-.6),tz=s.z+Math.sin(a)*(near-.6);
  const r=botStep(b,dt,tx,tz,2.2);
  if(r===-1||b.t>14){b.t=0;if(!botToSite(b))botEject(b)}
  return;
 }
 b.yaw=Math.atan2(-(s.x-b.x),-(s.z-b.z));
 ds.acc+=dt*2.5;
 while(ds.acc>=1&&ds.i<ds.cells.length){
  ds.acc--;const c=ds.cells[ds.i++];
  clearEdit(c[0],c[1],c[2]);
  const up=getAny(c[0],c[1]+1,c[2]);
  if(up&&up!==B.WATER&&!DEFS[up].solid&&(hasEdit(c[0],c[1]+1,c[2])||bhas(c[0],c[1]+1,c[2])))clearEdit(c[0],c[1]+1,c[2]);
  b.arm=1;
  if(dd<26&&sfx.brkLow)sfx.brkLow();
 }
 if(ds.i>=ds.cells.length)tidyDone(b);
}
function occupiedByOther(b,s){
 const x0=s.x0-.6,x1=s.x0+s.w+.6,z0=s.z0-.6,z1=s.z0+s.d+.6;
 if(player.x>x0&&player.x<x1&&player.z>z0&&player.z<z1&&player.y>s.y-3&&player.y<s.y+10)return true;
 for(const o of bots)if(o!==b&&o.on&&o.x>x0&&o.x<x1&&o.z>z0&&o.z<z1&&o.y>s.y-3&&o.y<s.y+10)return true;
 return false;
}
function tagReset(b){b.tagK=-1}
function botTick(b,dt){
 const dp=Math.hypot(b.x-bAX,b.z-bAZ);
 if(dp>56&&!(JB&&JB.bot===b)){
  b.rsT-=dt;if(b.rsT<=0){b.rsT=1;if(!botRespawn(b,bAX,bAZ,14,30,undefined,b.i*1.047))b.on=true}
  if(dp>78)return;
 }
 b.leg=Math.max(0,b.leg-dt*6);b.arm=Math.max(0,b.arm-dt*3);
 b.t+=dt;
 /* a bot found inside a solid block or in water is moved to the nearest free spot */
 b.chk-=dt;
 if(b.chk<=0){b.chk=.4;
  const ix=Math.floor(b.x),iz=Math.floor(b.z),iy=Math.floor(b.y+.05),f=getAny(ix,iy,iz),h=getAny(ix,iy+1,iz);
  if((f&&(DEFS[f].solid||f===B.WATER))||(h&&(DEFS[h].solid||h===B.WATER)))botEject(b);
 }
 if(playing&&!(JB&&JB.bot===b)&&Math.abs(b.y-player.y)<3&&(b.x-player.x)**2+(b.z-player.z)**2<7.6){b.stk=0;botRespawn(b,player.x,player.z,8,20,undefined,b.i*1.047)}
 b.stk+=dt;
 if(b.stk>3.5){if(b.mvT>2.5&&Math.hypot(b.x-b.pxs,b.z-b.pzs)<.6&&b.st!==BS.CELE)botUnstick(b);b.pxs=b.x;b.pzs=b.z;b.stk=0;b.mvT=0}
 if(b.idle>0)b.idle-=dt;
 if(b.st===BS.WANDER){
  if(b.idle>0)return;
  if(b.done.length>=2){tidyStart(b);return}
  b.pl-=dt;if(b.pl<=0){b.pl=.8;if(planSite(b))return}
  const r=botStep(b,dt,b.tx,b.tz,1.7);
  if(r!==0&&(b.t>.4||r===1)){
   b.idle=r===1?0.4+Math.random()*.8:.15;
   for(let k=0;k<6;k++){const a=Math.random()*6.283,d=5+Math.random()*10,x=b.x+Math.cos(a)*d,z=b.z+Math.sin(a)*d;if(walkY(x,z,b.y)>=0){b.tx=x;b.tz=z;break}}
   b.t=0;
  }
 }else if(b.st===BS.TIDY){tidyTick(b,dt)}
 else if(b.st===BS.BUILD){
  while(b.ci<b.cells.length&&(getAny(b.cells[b.ci][0],b.cells[b.ci][1],b.cells[b.ci][2])===b.cells[b.ci][3]))b.ci++;
  if(b.ci>=b.cells.length){
   if(b.skip&&b.skip.length&&JB&&JB.bot===b)JB.cells=JB.cells.filter(c=>!b.skip.includes(c));
   botFinish(b);return}
  const c=b.cells[b.ci],cx=c[0]+.5,cz=c[2]+.5;
  const dd=Math.hypot(cx-b.x,cz-b.z);
  b.yaw=Math.atan2(-(cx-b.x),-(cz-b.z));
  if(b.np>0)b.np-=dt;
  if(dd>4.2||Math.abs(c[1]-b.y)>4){
   const s=b.site,ax=cx-s.x,az=cz-s.z,l=Math.hypot(ax,az)||1,sx=cx+ax/l*2.2,sz=cz+az/l*2.2;
   const r=botStep(b,dt,sx,sz,2.1);
   if(r===-1||b.t>9){b.t=0;
    if(dd<7&&Math.abs(c[1]-b.y)<5){b.np=0}else{b.skip.push(c);b.ci++;if(Math.random()<.3&&!(JB&&JB.bot===b))botToSite(b)}}
   if(b.np>0)return;
   if(dd>6.5)return;
  }
  if(b.np>0)return;
  if(!chunks.has((c[0]>>4)+(c[2]>>4)*NC)){b.np=.4;return}
  const cur=getAny(c[0],c[1],c[2]);
  if((cur&&cur!==B.WATER&&DEFS[cur].kind!=='x')||hasEdit(c[0],c[1],c[2])||(DEFS[c[3]].solid&&overlapsPlayer(c[0],c[1],c[2]))){
   if(overlapsPlayer(c[0],c[1],c[2])){b.np=.8;return}
   b.skip.push(c);b.ci++;return}
  /* never place a solid block into a bot's body: step aside first (own body), or wait (another bot) */
  if(DEFS[c[3]].solid){
   if(bodyHit(b,c[0],c[1],c[2])){if(!botEject(b)){b.skip.push(c);b.ci++}b.t=0;return}
   let blk=false;for(const o of bots)if(o!==b&&o.on&&bodyHit(o,c[0],c[1],c[2]))blk=true;
   if(blk){b.np=.5;if(b.t>6){b.t=0;b.skip.push(c);b.ci++}return}
  }
  b.t=0;
  setBlock(c[0],c[1],c[2],c[3],1);b.arm=1;b.np=(1+Math.random()*.5)*.8;b.ci++;
 }else{
  b.cele-=dt;b.leg=0;
  if(b.cele<=0){b.st=BS.WANDER;b.t=0;b.legsDone=1;b.idle=.5}
 }
}
let bAX=0,bAZ=0;
function stepBots(dt){
 dt*=BSPD;bAX=W.on&&!playing?W.gx:player.x;bAZ=W.on&&!playing?W.gz:player.z;
 if(JB){
  const jb=JB.bot;
  if(!jb.on||jb.st!==BS.BUILD||jb.site!==JB.site)leaveBuild(JB.name+' moved on, so the build ended.');
  else if(Math.hypot(JB.sx-player.x,JB.sz-player.z)>40)leaveBuild('You went far from the build, so you left it. Come back to join again!');
 }
 botSpawnT-=dt;
 if(botSpawnT<=0&&(playing||W.on)){
  botSpawnT=.3;
  for(let i=0;i<MAXB;i++){const b=getBot(i);if(!b.on){botRespawn(b,bAX,bAZ,10,28,undefined,i*1.047);break}}
 }
 for(let i=0;i<bots.length;i++){const b=bots[i];if(b.on)botTick(b,dt)}
}
/* persisted structure lists */
function botSaveState(){return bots.map(b=>b.done.map(d=>[d.x0,d.z0,d.y,d.tid]))}
function botLoadState(a){
 for(let i=0;i<MAXB;i++){const b=getBot(i),l=a&&a[i];b.done=[];
  if(l&&l.length)for(const d of l)if(d&&d.length===4&&TPLS[d[3]])b.done.push({x0:d[0]|0,z0:d[1]|0,y:d[2]|0,tid:d[3]|0})}
}
/* ---- drawing ---- */
const bcp=new Float32Array(24),FQ=[[0,1,3,2,.8],[4,5,7,6,.8],[0,1,5,4,.55],[2,3,7,6,1],[0,2,6,4,.68],[1,3,7,5,.68]],QI=[0,1,2,0,2,3];
function part(b,ox,oy,oz,hx,hy,hz,col,sw,pv){
 const sy=Math.sin(b.yaw),cy=Math.cos(b.yaw),cs=Math.cos(sw||0),sn=Math.sin(sw||0);
 for(let i=0;i<8;i++){
  let lx=ox+(i&1?hx:-hx),ly=oy+(i&2?hy:-hy),lz=oz+(i&4?hz:-hz);
  if(sw){const dy=ly-pv;const y1=pv+dy*cs-lz*sn;lz=dy*sn+lz*cs;ly=y1}
  /* right vector (cy,-sy), forward (-sy,-cy); local +z is behind */
  bcp[i*3]=b.x+lx*cy+lz*sy;bcp[i*3+1]=b.y+ly;bcp[i*3+2]=b.z-lx*sy+lz*cy;
 }
 const am=partAmb||sky.amb;
 for(let qi=0;qi<6;qi++){
  const q=FQ[qi],s=q[4];
  for(let ki=0;ki<6;ki++){const k=QI[ki],o=botN*7,p=q[k]*3;botGeo[o]=bcp[p];botGeo[o+1]=bcp[p+1];botGeo[o+2]=bcp[p+2];
   botGeo[o+3]=col[0]*s*am[0];botGeo[o+4]=col[1]*s*am[1];botGeo[o+5]=col[2]*s*am[2];botGeo[o+6]=1;botN++}
 }
}
const HARAM_CROWD=[];let haramCrowdReady=false;
function haramDraw(){
 if(!playing)return;const l=fixedList().find(q=>q.t==='haram');if(!l)return;
 const dx=l.x-player.x,dz=l.z-player.z,lim=farFog+22;if(dx*dx+dz*dz>lim*lim)return;
 if(!haramCrowdReady){haramCrowdReady=true;const rnd=mulberry(SEED+913),TAU=Math.PI*2;
  for(let r=0;r<12;r++){const rad=5.4+r*.98,n=Math.floor(TAU*rad/.66),off=rnd()*TAU;
   for(let i=0;i<n;i++){const look=Object.assign({},BLOOK[Math.floor(rnd()*MAXB)]);
    if(look.m){look.dress=[.96,.95,.9];look.pants=[.9,.89,.84];look.sash=[.72,.71,.67]}
    const p={r:rad,a:off+TAU*i/n,sp:.09+rnd()*.055,phase:rnd()*TAU,look};
    p.fig={x:0,y:0,z:0,yaw:0,ph:0,leg:0,arm:0,st:BS.WANDER,look};HARAM_CROWD.push(p)}
  }
 }
 const tm=performance.now()*.001,lim2=farFog*farFog*1.1,eye=cam.e,fw=cam.fw,base=l.y0+1;
 const k={x:l.x+.5,y:l.y0+4.5,z:l.z+.5,yaw:0};
 if(botN+36*52<botGeo.length/7){part(k,0,0,0,3.54,3.54,3.54,[.055,.055,.055]);
  const band=l.y0+5.4,gold=[.83,.64,.22],dark=[.5,.33,.1];
  part(k,0,band-k.y,-3.56,3.55,.12,.025,gold);part(k,0,band-k.y,3.56,3.55,.12,.025,gold);part(k,3.56,band-k.y,0,.025,.12,3.55,gold);part(k,-3.56,band-k.y,0,.025,.12,3.55,gold);
  const door={x:k.x+3.57,y:base+1.5,z:k.z,yaw:0};part(door,0,1.35,0,.035,.87,.58,dark);part(door,0,1.35,-.015,.04,.76,.47,gold);
  const stone={x:k.x+3.58,y:base+.48,z:k.z+3.53,yaw:0};part(stone,0,0,0,.23,.24,.065,[.76,.76,.72]);part(stone,0,0,-.045,.17,.18,.035,[.008,.008,.008]);
  for(let i=-3;i<=3;i++){part(k,i,.0+band-k.y+.42,-3.585,.09,.045,.025,gold);part(k,i,.0+band-k.y+.42,3.585,.09,.045,.025,gold);part(k,3.585,.0+band-k.y+.42,i,.025,.045,.09,gold);part(k,-3.585,.0+band-k.y+.42,i,.025,.045,.09,gold)}
  for(const sx of[-1,1])for(const sz of[-1,1]){const tower={x:l.x+.5+sx*19.5,y:l.y0+16,z:l.z+.5+sz*19.5,yaw:0};part(tower,0,.08,0,.53,.1,.53,gold);part(tower,0,.34,0,.2,.19,.2,gold);part(tower,0,.59,0,.07,.08,.07,gold)}
 }
 /* Tawaf circles counter-clockwise when viewed from above. */
 for(let i=0;i<HARAM_CROWD.length;i++){
  const p=HARAM_CROWD[i],a=p.a-tm*p.sp+Math.sin(tm*.42+p.phase)*.035,r=p.r+Math.sin(tm*.7+p.phase)*.14,
   x=l.x+.5+Math.cos(a)*r,z=l.z+.5+Math.sin(a)*r;
  const vx=x-eye[0],vz=z-eye[2],d2=vx*vx+vz*vz;if(d2>lim2||vx*fw[0]+(base-eye[1])*fw[1]+vz*fw[2]<-3)continue;
  if(d2>28*28&&i%2)continue;if(botN+720>botGeo.length/7)break;
  const f=p.fig;f.x=x;f.y=base;f.z=z;f.yaw=-a+Math.sin(tm*.5+p.phase)*.09;f.ph=tm*4+p.phase;f.leg=.65+Math.sin(tm*.6+p.phase)*.12;
  drawBotFig(f);
 }
}
let plog=null;
const pq=new Float32Array(12);
/* one front-facing plate (face details): local z = oz, facing forward (-z) */
const PQI=[0,1,3,0,3,2];
function plate(b,ox,oy,oz,hx,hy,col){
 const sy=Math.sin(b.yaw),cy=Math.cos(b.yaw),am=partAmb||sky.amb;
 for(let i=0;i<4;i++){const lx=ox+(i&1?hx:-hx),ly=oy+(i&2?hy:-hy);pq[i*3]=b.x+lx*cy+oz*sy;pq[i*3+1]=b.y+ly;pq[i*3+2]=b.z-lx*sy+oz*cy}
 for(let ki=0;ki<6;ki++){const k=PQI[ki],o=botN*7,p=k*3;botGeo[o]=pq[p];botGeo[o+1]=pq[p+1];botGeo[o+2]=pq[p+2];
  botGeo[o+3]=col[0]*.85*am[0];botGeo[o+4]=col[1]*.85*am[1];botGeo[o+5]=col[2]*.85*am[2];botGeo[o+6]=1;botN++}
}
const EYE=[.1,.08,.1],WHT=[1,1,1],MOUTH=[.62,.2,.2],BLUSH=[1,.55,.5];
function drawBotFig(b){
 const L=b.look,sw=Math.sin(b.ph)*.7*b.leg,hop=b.st===BS.CELE?Math.abs(Math.sin(b.cele*6))*.5:0,by=b.y,fem=!L.m;
 b.y=by+hop;
 const tool=b.st===BS.BUILD||b.st===BS.TIDY||b.work;
 /* legs (trousers or the long dress) and shoes */
 const lc=fem?L.dress:L.pants,lw=fem?.15:.12;
 part(b,.13,.34,0,lw,.34,.13,lc,sw,.68);part(b,-.13,.34,0,lw,.34,.13,lc,-sw,.68);
 part(b,.13,.05,-.05,.12,.05,.17,L.shoe,sw,.68);part(b,-.13,.05,-.05,.12,.05,.17,L.shoe,-sw,.68);
 /* body: tunic or abaya, long sleeves */
 part(b,0,1.03,0,.24,.36,.16,L.dress);
 if(!fem){part(b,0,.5,0,.26,.2,.17,L.dress);part(b,0,.86,-.001,.255,.03,.165,L.sash)}
 const ar=b.st===BS.CELE?2.5:b.arm>0?1.3+Math.sin(b.arm*9)*.5:-sw;
 part(b,.36,1.03,0,.09,.33,.1,L.dress,ar,1.36);part(b,-.36,1.03,0,.09,.33,.1,L.dress,b.st===BS.CELE?2.5:sw,1.36);
 if(tool)part(b,.36,.66,-.1,.07,.07,.1,L.tool,ar,1.36);
 /* head and face */
 part(b,0,1.67,0,.27,.27,.25,L.skin);
 const fz=-.255;
 plate(b,-.1,1.7,fz,.04,.05,EYE);plate(b,.1,1.7,fz,.04,.05,EYE);
 plate(b,-.09,1.72,fz-.002,.013,.016,WHT);plate(b,.11,1.72,fz-.002,.013,.016,WHT);
 const bc=L.bcol;
 plate(b,-.1,1.81,fz,.06,.012,bc);plate(b,.1,1.81,fz,.06,.012,bc);
 plate(b,0,1.55,fz-.03,.055,.012,MOUTH);plate(b,-.065,1.565,fz-.03,.014,.014,MOUTH);plate(b,.065,1.565,fz-.03,.014,.014,MOUTH);
 plate(b,-.17,1.6,fz,.05,.03,BLUSH);plate(b,.17,1.6,fz,.05,.03,BLUSH);
 if(fem){
  const hc=L.cover;
  part(b,0,1.69,.12,.3,.29,.2,hc);part(b,.285,1.67,0,.03,.27,.25,hc);part(b,-.285,1.67,0,.03,.27,.25,hc);
  part(b,0,1.88,-.255,.28,.06,.02,hc);part(b,0,1.3,.03,.37,.14,.25,hc);
 }else{
  if(L.cap===1)part(b,0,1.97,0,.275,.06,.26,L.cover);
  else{part(b,0,1.97,0,.3,.11,.29,L.cover);}
  if(L.beard===1)part(b,0,1.42,fz+.02,.19,.06,.04,L.bc);
  else if(L.beard===2)part(b,0,1.42,fz+.02,.07,.07,.04,L.bc);
  else if(L.beard===3)part(b,0,1.43,fz+.03,.25,.08,.05,L.bc);
 }
 if(plog){plog.push(fem?'hijab':L.cap===2?'turban':'kufi');plog.push('face');if(!fem)plog.push('beard'+L.beard);else plog.push('nohair')}
 b.y=by;
}
const portraits=[];
function botPortrait(i){
 if(portraits[i])return portraits[i];
 const c=document.createElement('canvas');c.width=c.height=48;const g=c.getContext('2d'),L=BLOOK[i],f=a=>'rgb('+(a[0]*255|0)+','+(a[1]*255|0)+','+(a[2]*255|0)+')';
 g.fillStyle='#e9dcae';g.fillRect(0,0,48,48);
 if(!L.m){g.fillStyle=f(L.cover);g.fillRect(4,2,40,46)}else{g.fillStyle=f(L.dress);g.fillRect(3,37,42,11)}
 g.fillStyle=f(L.skin);g.fillRect(11,11,26,27);
 if(L.m){g.fillStyle=f(L.cover);if(L.cap===2)g.fillRect(7,3,34,11);else g.fillRect(10,5,28,8);
  g.fillStyle=f(L.bc);if(L.beard===1)g.fillRect(11,30,26,8);else if(L.beard===2)g.fillRect(19,31,10,9);else g.fillRect(9,27,30,12)}
 g.fillStyle=f(L.m?L.bc:[L.skin[0]*.45,L.skin[1]*.35,L.skin[2]*.3]);g.fillRect(14,17,8,2);g.fillRect(26,17,8,2);
 g.fillStyle='#1a1418';g.fillRect(15,21,6,7);g.fillRect(27,21,6,7);g.fillStyle='#fff';g.fillRect(18,21,2,2);g.fillRect(30,21,2,2);
 g.fillStyle='rgba(255,120,110,.55)';g.fillRect(11,29,5,3);g.fillRect(32,29,5,3);
 g.fillStyle='#a03a3a';g.fillRect(20,32,8,2);g.fillRect(18,31,2,2);g.fillRect(28,31,2,2);
 return portraits[i]=c.toDataURL();
}
window.__botParts=i=>{const t=getBot(i),sv=[botN,t.x,t.y,t.z,t.yaw,t.st];botN=0;plog=[];t.x=t.y=t.z=0;t.yaw=0;t.st=BS.BUILD;drawBotFig(t);const r={verts:botN,parts:plog.slice(),name:t.name};plog=null;botN=sv[0];t.x=sv[1];t.y=sv[2];t.z=sv[3];t.yaw=sv[4];t.st=sv[5];return r};
function fillBotGeo(){
 botN=0;
 if(W.on&&!playing&&!glide){if(WM.ready)menuDraw();return}
 for(const b of bots){
  if(!b.on)continue;
  const dx=b.x-player.x,dz=b.z-player.z;if(dx*dx+dz*dz>farFog*farFog*1.1)continue;
  /* bots behind the camera are not uploaded */
  if((b.x-cam.e[0])*cam.fw[0]+(b.y+1-cam.e[1])*cam.fw[1]+(b.z-cam.e[2])*cam.fw[2]<-3)continue;
  drawBotFig(b);
 }
 haramDraw();
 gzDraw();machinePostDraw();
}
function botPick(o,d){
 let best=null,bt=1e9;
 for(const b of bots){
  if(!b.on)continue;
  let t0=0,t1=14;const mn=[b.x-.4,b.y,b.z-.4],mx=[b.x+.4,b.y+1.95,b.z+.4];
  for(let a=0;a<3;a++){
   if(Math.abs(d[a])<1e-6){if(o[a]<mn[a]||o[a]>mx[a]){t0=1e9;break}continue}
   let ta=(mn[a]-o[a])/d[a],tb=(mx[a]-o[a])/d[a];if(ta>tb){const q=ta;ta=tb;tb=q}
   t0=Math.max(t0,ta);t1=Math.min(t1,tb);if(t0>t1){t0=1e9;break}
  }
  if(t0<bt&&t0<1e8){bt=t0;best=b}
 }
 return best?{bot:best,t:bt}:null;
}
/* ---- name tags (HTML labels positioned from 3D) ---- */
let hudCk=0,hudBot=90,tagEls=null;const tagOrd=[];
function updateTags(){
 if(!tagEls){tagEls=[];const box=$('tags');for(let i=0;i<MAXB;i++){const d=document.createElement('div');d.className='ntag';d.innerHTML='<span><img class="pt" alt=""><i></i></span><button class="hb">Help build</button>';
  d.querySelector('button').onclick=e=>{e.stopPropagation();openBotCard(bots[i])};d.style.display='none';box.appendChild(d);
  d.firstChild.firstChild.src=botPortrait(i);tagEls.push({d,s:d.firstChild.lastChild,b:d.lastChild,txt:'',hb:false,shown:false,i,x:0,y:0,ty:0,h:26,w:150,wd:true,chip:false,dist:0,cand:false,px:-9999,py:-9999,op:1})}}
 if(--hudCk<=0){hudCk=20;const hb=$('hud').getBoundingClientRect();hudBot=hb.bottom+4}
 let nv=0,hbBest=-1,hbD=1e9;
 for(let i=0;i<MAXB;i++){
  const t=tagEls[i],b=bots[i];let show=false;
  if(b&&b.on&&playing&&!curModal){
   const dist=Math.hypot(b.x-player.x,b.z-player.z);
   if(dist<26){const p=project(b.x,b.y+2.25,b.z);
    if(p){const x=(p[0]*.5+.5)*vw,y=(.5-p[1]*.5)*vh;
     if(x>-60&&x<vw+60&&y>hudBot+26&&y<vh+30){
      show=true;t.x=x;t.y=y;t.dist=dist;
      t.cand=b.st===BS.BUILD&&dist<15&&!JB;
      if(t.cand&&dist<hbD){hbD=dist;hbBest=i}
      t.bn=b.name;t.full=botTag(b);
      let j=nv++;while(j>0&&tagOrd[j-1].dist>dist){tagOrd[j]=tagOrd[j-1];j--}tagOrd[j]=t;
     }}}
  }
  if(show!==t.shown){t.shown=show;t.d.style.display=show?'block':'none'}
 }
 /* nearest first. At most 3 full tags (the rest are small name-only chips). A tag that would overlap a nearer one
    is stacked above it with a gap; the nearest tag is never moved, clipped or shortened. Tags never enter the HUD band. */
 for(let k=0;k<nv;k++){
  const t=tagOrd[k],hb=t.i===hbBest&&k<3;
  if(hb!==t.hb){t.hb=hb;t.b.style.display=hb?'block':'none'}
  const chip=k>=3;
  if(chip!==t.chip){t.chip=chip;t.d.classList.toggle('tgc',chip);t.txt='';t.wd=true}
  const want=chip?t.bn:t.full;
  if(want!==t.txt){t.txt=want;t.s.textContent=want;t.wd=true}
  if(t.wd){t.wd=false;t.w=t.d.firstChild.offsetWidth||150}
  t.h=hb?70:(chip?20:26);let y=t.y,x=t.x;
  const hw=t.w/2+4;if(x<hw)x=hw;else if(x>vw-hw)x=vw-hw;t.cx=x;
  for(let pass=0;pass<8;pass++){
   let moved=false;
   for(let j=0;j<k;j++){const o=tagOrd[j];
    if(Math.abs(x-o.cx)<(t.w+o.w)/2+4&&y>o.ty-o.h-2&&y-t.h<o.ty+2){y=o.ty-o.h-4;moved=true}}
   if(!moved)break;
  }
  t.ty=y;
  const hide=k>0&&y-t.h<hudBot;
  if(hide!==t.hid){t.hid=hide;t.d.style.visibility=hide?'hidden':'visible'}
  const px=Math.round(x),py=Math.round(y);
  if(px!==t.px||py!==t.py){t.px=px;t.py=py;t.d.style.transform='translate('+px+'px,'+py+'px) translate(-50%,-100%)'}
 }
}
/* ---- join a build ---- */
let JB=null;const joinMap=new Map();
function openBotCard(b){
 if(!b||!b.on)return;
 if(JB&&JB.bot===b){modal(`<h2>Building with ${b.name}</h2><p>You are building ${JB.tpl} together.</p><div class="row"><button class="btn alt" data-a="leave">Leave build</button><button class="btn" data-a="ok">Keep going</button></div>`,
  p=>{p.querySelector('[data-a=leave]').onclick=()=>{closeModal();leaveBuild()};p.querySelector('[data-a=ok]').onclick=closeModal});return}
 if(b.st===BS.BUILD&&b.tpl&&!JB){
  modal(`<svg class="motif i"><use href="#star8"/></svg><img class="portrait" alt="" src="${botPortrait(b.i)}"><h2>Builder ${b.name}</h2><p>${b.name} is building ${b.tpl.n}. Build together?</p>
   <div class="row"><button class="btn alt" data-a="no">Not now</button><button class="btn" data-a="join">Join</button></div>`,
   p=>{p.querySelector('[data-a=no]').onclick=closeModal;p.querySelector('[data-a=join]').onclick=()=>{closeModal();joinBuild(b)}});return}
 modal(`<h2>Builder ${b.name}</h2><p>${b.name} says: ${b.st===BS.CELE?'We did it! Wonderful teamwork.':JB?'Finish your build first, then we can build together.':(b.st===BS.TIDY?'I am tidying up an old build.':'I am looking for a good spot to build something.')}</p><div class="row"><button class="btn" data-a="ok">OK</button></div>`,
  p=>{p.querySelector('[data-a=ok]').onclick=closeModal});
}
function joinBuild(b){
 if(JB||b.st!==BS.BUILD)return;
 const left=b.cells.filter(c=>getAny(c[0],c[1],c[2])!==c[3]);
 if(!left.length){toast(b.name+' is almost done!');return}
 JB={bot:b,tpl:b.tpl.n,name:b.name,cells:left.concat(b.cells.filter(c=>getAny(c[0],c[1],c[2])===c[3])),total:b.cells.length,
  site:b.site,sx:b.site.x,sz:b.site.z,need:Math.min(3,left.length),mine:new Set()};
 joinMap.clear();S.tmp=[];
 for(const c of JB.cells){joinMap.set(gkey(c[0],c[1],c[2]),c[3]);if(!S.tmp.includes(c[3])&&!S.unlocked.includes(c[3]))S.tmp.push(c[3])}
 rebuildGhost();buildHotbar();updateJoinChip();
 toast('Joined '+b.name+'. Fill the blue blueprint together!');
}
/* ends any join: clears the temporary block grant and makes sure the selected block is one the player really owns */
function leaveBuild(msg){
 JB=null;joinMap.clear();S.tmp=[];
 if(!S.unlocked.includes(S.sel)){const f=HOTBAR_IDS.find(id=>S.unlocked.includes(id));S.sel=f===undefined?B.SANDSTONE:f;queueSave()}
 rebuildGhost();buildHotbar();updateJoinChip();
 if(msg)toast(msg);
}
function joinDone(){return JB?JB.cells.reduce((n,c)=>n+(getAny(c[0],c[1],c[2])===c[3]?1:0),0):0}
function checkJoin(botDone){
 if(!JB)return;
 rebuildGhost();updateJoinChip();
 if(joinDone()>=JB.cells.length){
  const j=JB,earned=j.mine.size>=j.need;
  leaveBuild();j.bot.cele=3.5;j.bot.st=BS.CELE;
  if(earned){
   S.stars+=4;S.skills.building++;sfx.done();confetti();updateHud();queueSave();
   modal(`<svg class="motif i"><use href="#star8"/></svg><h2>Teamwork!</h2><p>You and ${j.name} built ${j.tpl} together.</p><p>+4 stars. Building skill +1.</p><p>Working together makes big jobs easy.</p>
    <div class="row"><button class="btn" data-a="ok">Wonderful</button></div>`,p=>{p.querySelector('[data-a=ok]').onclick=closeModal});
  }else{
   modal(`<svg class="motif i"><use href="#star8"/></svg><h2>${j.name} finished it!</h2><p>${j.tpl.charAt(0).toUpperCase()+j.tpl.slice(1)} is ready.</p><p>Place ${j.need===1?'1 block':j.need+' blocks'} yourself next time to earn stars.</p>
    <div class="row"><button class="btn" data-a="ok">OK</button></div>`,p=>{p.querySelector('[data-a=ok]').onclick=closeModal});
  }
 }
}
function updateJoinChip(){
 const el=$('joinchip');
 if(!JB){el.style.display='none';return}
 el.style.display='flex';
 el.innerHTML=`<span>Building with ${JB.name} ${joinDone()}/${JB.cells.length}</span><button class="btn alt sm" data-a="lv">Leave</button>`;
 el.querySelector('button').onclick=()=>leaveBuild();
}

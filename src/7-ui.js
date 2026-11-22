
/* ===== 10. Interface: modals, HUD, hotbar ===== */
const modalQ=[];let curModal=null,modalT=0,modalCloseT=-999,inPanelClick=false;
/* a card opened from a button of the card itself (settings redraws its own card) is not guarded against that same click */
$('panel').addEventListener('click',()=>{inPanelClick=true;setTimeout(()=>{inPanelClick=false},0)},true);
const welcomeUp=()=>$('welcome').style.display!=='none';
function modal(html,wire){modalQ.push({html,wire});if(!curModal)nextModal()}
function nextModal(){
 curModal=modalQ.shift()||null;
 const el=$('modal');
 /* a card opened over the welcome screen lifts the whole game layer above it */
 if(!curModal){el.classList.remove('on');return}
 /* a card opened by a tap is guarded against the click that same tap still sends; a card a button redrew is not */
 {modalT=inPanelClick?performance.now()-400:performance.now()}
 $('panel').innerHTML=curModal.html;$('panel').scrollTop=0;el.classList.add('on');
 input.jx=input.jy=0;input.jump=false;
 if(document.pointerLockElement){wantLock=true;document.exitPointerLock()}
 if(curModal.wire)curModal.wire($('panel'));
}
function closeModal(){curModal=null;modalCloseT=performance.now();nextModal();if(!curModal)relock()}
/* the synthetic click that follows a touch tap must not hit a button of the card that tap just opened */
$('modal').addEventListener('click',e=>{
 if(e.isTrusted&&modalT>0&&performance.now()-modalT<280&&e.target.closest&&e.target.closest('button')){e.stopPropagation();e.preventDefault()}
},true);
let toastTimer=0;
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('on'),2200)}
function confetti(){
 for(let i=0;i<14;i++){const d=document.createElement('div');d.className='confetti';
  d.style.left=Math.random()*100+'%';d.style.animationDelay=Math.random()*.6+'s';d.innerHTML='<svg class="i" style="width:100%;height:100%"><use href="#star8"/></svg>';
  $('app').appendChild(d);setTimeout(()=>d.remove(),3200)}
}
function updateHud(){$('starN').textContent=S.stars;$('rank').textContent=rankOf(S.stars)}
const mapDialog=$('worldMap'),mapCtx=$('mapCanvas').getContext('2d'),worldCtx=$('worldCanvas').getContext('2d');
let mapTerrain=null,mapT=-1000;
const mapPins=[];
function makeMapTerrain(){
 const cv=document.createElement('canvas');cv.width=cv.height=128;
 const c=cv.getContext('2d'),im=c.createImageData(128,128),data=im.data;
 for(let iy=0;iy<128;iy++)for(let ix=0;ix<128;ix++){
  const x=(ix+.5)*WX/128,z=(iy+.5)*WZ/128,h=raw(x,z),i=(iy*128+ix)*4;
  const tone=h<WL+.5?[91,137,145]:h>25?[172,136,96]:G.om>.52?[147,158,103]:[216,190,137];
  const shade=clamp(Math.round(h-WL),-10,10)+(ix%16===0||iy%16===0?-10:0);
  data[i]=tone[0]+shade;data[i+1]=tone[1]+shade;data[i+2]=tone[2]+shade;data[i+3]=255;
 }
 c.putImageData(im,0,0);return cv;
}
function drawMapView(c,x0,z0,sx,sz,mini){
 const w=c.canvas.width,h=c.canvas.height;
 c.fillStyle='#675b47';c.fillRect(0,0,w,h);c.imageSmoothingEnabled=false;
 c.drawImage(mapTerrain,-x0/sx*w,-z0/sz*h,WX/sx*w,WZ/sz*h);
 if(mini)for(const p of MAP_PLACES){
  const x=(p.x-x0)/sx*w,z=(p.z-z0)/sz*h;if(x<3||z<3||x>w-3||z>h-3)continue;
  c.fillStyle='#382c20';c.fillRect(x-3,z-3,6,6);c.fillStyle='#ffe1a1';c.fillRect(x-2,z-2,4,4);
 }
 if(!mini){
  c.strokeStyle='#493b2d';c.lineWidth=1.5;
  for(const {place,x,z} of mapPins){
   const px=place.x/WX*w,pz=place.z/WZ*h;
   c.beginPath();c.moveTo(px,pz);c.lineTo(x*w,z*h);c.stroke();c.fillStyle='#493b2d';c.fillRect(px-2,pz-2,4,4);
  }
 }
 const x=clamp((player.x-x0)/sx*w,7,w-7),z=clamp((player.z-z0)/sz*h,7,h-7);
 c.save();c.translate(x,z);c.rotate(-player.yaw);c.beginPath();c.moveTo(0,-8);c.lineTo(5,5);c.lineTo(0,3);c.lineTo(-5,5);c.closePath();
 c.strokeStyle='#17322c';c.lineWidth=3;c.stroke();c.fillStyle='#7cf3c4';c.fill();c.restore();
}
function drawMap(now){
 if(!playing||now-mapT<100)return;mapT=now;
 if(!mapTerrain)mapTerrain=makeMapTerrain();
 drawMapView(mapCtx,player.x-160,player.z-128,320,256,true);
 if(mapDialog.open)drawMapView(worldCtx,0,0,WX,WZ,false);
}
function layoutMapPins(){
 const chart=$('mapPins'),w=chart.clientWidth,h=chart.clientHeight;if(!w||!h)return;
 const used=[];
 for(const pin of mapPins){
  const px=pin.place.x/WX*w,pz=pin.place.z/WZ*h;let best=null,bestDist=Infinity;
  for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){
   const x=clamp(px+12+dx*24,12,w-12),z=clamp(pz-12+dz*24,12,h-12);
   const d=(dx*24)**2+(dz*24)**2;
   if(d>=bestDist||used.some(p=>Math.abs(x-p[0])<23&&Math.abs(z-p[1])<23))continue;
   best=[x,z];bestDist=d;
  }
  const [x,z]=best||[px,pz];used.push([x,z]);pin.x=x/w;pin.z=z/h;
  pin.el.style.left=`${pin.x*100}%`;pin.el.style.top=`${pin.z*100}%`;
 }
}
function setMapOpen(open){
 if(!open){if(mapDialog.open)mapDialog.close();return}
 if(mapDialog.open||!playing||curModal||FLY||TP||LIFT_RIDE)return;
 wantLock=false;MG.fireHeld=false;input.keys.clear();input.jx=input.jy=0;input.jump=false;aim=null;
 if(document.pointerLockElement)document.exitPointerLock();
 mapDialog.showModal();layoutMapPins();mapT=-1000;drawMap(performance.now());
}
function mapTravel(p){
 if(!playing||!mapDialog.open)return;
 if(MG.on)leaveMachinePost();
 const g=p.gate;
 const arrived=g?teleport(g.x+g.nx*2.8,g.z+g.nz*2.8,Math.atan2(-g.nx,-g.nz),-.08,g.base+1):spawnPlayer();
 setMapOpen(false);toast(arrived?`Arrived at ${p.name}`:'Could not find a safe place nearby.');
}
for(let i=0;i<MAP_PLACES.length;i++){
 const p=MAP_PLACES[i],pin=document.createElement('button'),row=document.createElement('button');
 pin.className='mapPin';pin.textContent=i+1;pin.title=p.name;pin.setAttribute('aria-label',`Travel to ${p.name}`);
 mapPins.push({el:pin,place:p,x:p.x/WX,z:p.z/WZ});
 row.className='mapPlace';row.innerHTML=`<i aria-hidden="true">${i+1}</i><span><b>${p.name}</b><small>${p.region}</small></span>`;
 pin.onclick=row.onclick=()=>mapTravel(p);$('mapPins').appendChild(pin);$('mapPlaces').appendChild(row);
}
$('map').onclick=()=>{if(!LIFT_CABIN)setMapOpen(true)};$('mapClose').onclick=()=>setMapOpen(false);
window.addEventListener('resize',()=>{if(mapDialog.open)layoutMapPins()});
function updateMode(){
 const b=$('btnMode');b.className=S.mode;
 b.innerHTML=`<svg class="i s"><use href="#${S.mode==='place'?'plus':'pick'}"/></svg>${S.mode==='place'?'Place':'Break'}`;
}
const hotbar=HOTBAR_IDS.slice(0,9);
let activeSlot=0;
function blockSlot(id,n){
 const open=S.unlocked.includes(id)||S.tmp.includes(id),b=document.createElement('button');
 b.type='button';b.className='slot'+(open?'':' locked')+(id===S.sel?' sel':'');
 b.setAttribute('aria-label',DEFS[id].name+(open?'':' (locked)'));b.title=DEFS[id].name;
 const c=document.createElement('canvas');c.width=c.height=16;
 const t=DEFS[id].t[2],g=c.getContext('2d');g.imageSmoothingEnabled=false;
 g.drawImage(atlasCanvas,(t&7)*16,(t>>3)*16,16,16,0,0,16,16);b.appendChild(c);
 if(n!==undefined)b.insertAdjacentHTML('beforeend',`<span class="no">${n+1}</span>`);
 if(!open)b.insertAdjacentHTML('beforeend','<svg class="i lk"><use href="#lock"/></svg>');
 return b;
}
function buildHotbar(){
 const hb=$('hotbar');hb.innerHTML='';
 const found=hotbar.indexOf(S.sel);
 if(found>=0)activeSlot=found;else hotbar[activeSlot]=S.sel;
 hotbar.forEach((id,n)=>{
  const b=blockSlot(id,n);b.onclick=()=>selectBlock(id);hb.appendChild(b);
 });
 $('selName').textContent=DEFS[S.sel].name;
}
function openInventory(){
 if(!playing||curModal||mapDialog.open||TP||FLY||MG.on||LIFT_RIDE)return;
 input.keys.clear();
 modal('<h2>Block inventory</h2><div id="blockInventory"></div><div class="row"><button class="btn" data-a="close">Close</button></div>',p=>{
  const grid=p.querySelector('#blockInventory');
  for(const id of HOTBAR_IDS){
   const b=blockSlot(id);
   b.onclick=()=>{
    if(!selectBlock(id))return;
    closeModal();
   };
   grid.appendChild(b);
  }
  const close=p.querySelector('[data-a=close]');close.onclick=closeModal;close.focus();
 });
}
$('btnInventory').onclick=openInventory;
function selectBlock(id){
 if(!S.unlocked.includes(id)&&!S.tmp.includes(id)){toast(DEFS[id].name+' is locked. Finish missions and open chests to earn it.');return false}
 S.sel=id;S.mode='place';updateMode();buildHotbar();queueSave();return true;
}
function cycleBlock(dir){
 const open=hotbar.filter(i=>S.unlocked.includes(i)||S.tmp.includes(i));
 selectBlock(open[(open.indexOf(S.sel)+dir+open.length)%open.length]);
}
const TIPS=['Domes can cover a big room with no pillars in the middle.','Tiles repeat in patterns. Count them: a 5 x 5 square holds 25 tiles.','An astrolabe helped travellers find the time and the stars.','Mud brick keeps a house cool, even in the hot desert.','Volume is length x width x height. Try it on a minaret!','Algebra comes from al-jabr, a word in a book from Baghdad.','A mirror line makes a symmetrical gate: the left matches the right.','The Museum of Islamic Heritage has 26 treasures to find.'];
let tipI=0,tipT=0,glide=null;const W={day:.15,t:0,y0:0,on:false,gx:1010,gz:1030,sp:1,snap:1};
function startScreen(){
 /* the welcome overlay is plain HTML; once the spawn area is built the progress bar is swapped for the buttons */
 $('wbar').style.display='none';$('wready').style.display='block';
 const has=SV.has,sm=SV.sum;
 $('wready').querySelector('[data-a=play]').textContent=has?'Continue':'Play';
 $('wready').querySelector('[data-a=reset]').style.display=has?'block':'none';
 const su=$('wsum'),bd=$('wbadge');
 if(has&&sm){su.style.display='block';su.textContent=sm.stars+' stars ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· Mission '+sm.mission+' ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· '+sm.blocks+' blocks built';bd.style.display='block';bd.textContent=(sm.rank||rankOf(sm.stars))+' ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· '+sm.stars+' stars'}
 else{su.style.display='none';bd.style.display='none'}
 W.on=true;if(RAD<6)RAD=6;
 worldsList();
 /* two frames later the illustration fades into the live panorama */
 requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!playing)$('welcome').classList.add('live')}));
}
function howCard(){
 const how=touchMode?['Drag the round pad to walk. Drag anywhere else to look.','Tap a block to break or place it. Use the Place / Break button to switch. Tap Blocks for the inventory.','Follow the glowing blueprint, open the glowing chests, and tap a builder to build together.','Swim east to the Open Air Prison, or tap My Skills then Open Air Prison. Build shelters with roofs to keep families safe from the drones.']
  :['Click the game to look around. Move with W A S D and jump with Space.','Left click breaks a block. Right click places one. Keys 1 to 9 pick a block. Press E for the block inventory and F to use a nearby lift.','Follow the glowing blueprint, open the glowing chests, and click a builder to build together.','Swim east to the Open Air Prison, or open My Skills then Open Air Prison. Build shelters with roofs to keep families safe from the drones.'];
 how.push(`${touchMode?'Tap Map':'Press M'} to travel to landmarks. The Landmarks wall across the lake has gates to these places.`);
 how.push(`${touchMode?'Open Settings then Console':'Press /'} for commands. /share opens a lobby so a friend can join your world from the Join lobby button.`);
 modal(`<svg class="motif i"><use href="#star8"/></svg><h2>How to play</h2><ul class="how">${how.map(h=>`<li>${h}</li>`).join('')}</ul><div class="row"><button class="btn" data-a="ok">Got it</button></div>`,p=>{p.querySelector('[data-a=ok]').onclick=closeModal});
}
function startPlay(){
 initAudio();
 const from=[player.x,player.y,player.z,player.yaw,player.pitch];
 dayT=SV.dayKeep===undefined?0.2:SV.dayKeep;
 let resumed=false;
 if(SV.has&&SV.pos)resumed=restorePos();else{spawnPlayer();W.y0=player.y}
 const to=[player.x,player.y,player.z,player.yaw,player.pitch];
 activeSec=SV.act||0;SV.act=0;
 for(const b of bots)if(b.on&&(Math.hypot(b.x-player.x,b.z-player.z)>26||Math.hypot(b.x-player.x,b.z-player.z)<7))botRespawn(b,player.x,player.z,10,26,undefined,b.i*1.047);
 W.on=false;$('welcome').style.opacity='0';
 const fin=()=>{$('app').classList.remove('pre');$('welcome').style.display='none';$('welcome').style.opacity='';playing=true;glide=null;applyGfx();if(!touchMode)wantLock=true;
  if(netGuest()){toast('You are in the host\'s world now.')}else if(resumed||SV.has){toast('Welcome back!')}else if(S.mission<MISSIONS.length){missionIntro(false)}else toast('Free building. Have fun!');
  if(!curModal)relock()};
 if(Math.hypot(from[0]-to[0],from[2]-to[2])<90&&Math.abs(from[1]-to[1])<40){
  glide={t:0,from,to,fin};player.x=from[0];player.y=from[1];player.z=from[2];player.yaw=from[3];player.pitch=from[4];
 }else{fin()}
}
function glideStep(dt){
 const g=glide;g.t+=dt;const k=Math.min(1,g.t/1.0),e=k*k*(3-2*k);
 let dy=g.to[3]-g.from[3];dy=Math.atan2(Math.sin(dy),Math.cos(dy));
 player.x=g.from[0]+(g.to[0]-g.from[0])*e;player.y=g.from[1]+(g.to[1]-g.from[1])*e;player.z=g.from[2]+(g.to[2]-g.from[2])*e;
 player.yaw=g.from[3]+dy*e;player.pitch=g.from[4]+(g.to[4]-g.from[4])*e;
 if(k>=1){const f=g.fin;glide=null;f()}
}
/* ---- the menu: a gentle ~54 s loop in front of the grand mosque; menu-only builders work in the foreground (they exist only while the menu is shown) ---- */
const MQP=[907,995],WP=54,wCam=new Float32Array(6),wRM=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
const WM={cx:985,cz:996,ready:false,act:[],st:[]};
const WCOL=[[.9,.78,.55],[.15,.65,.7],[.95,.75,.2],[.95,.94,.9],[.72,.5,.32]];
function wCells(a){a.sort((p,q)=>p[1]-q[1]);return a}
const WSTR=[
 wCells([[0,0,-1,0],[0,0,1,0],[0,1,-1,0],[0,1,1,0],[0,2,-1,0],[0,2,1,0],[0,3,-1,1],[0,3,0,0],[0,3,1,1],[0,4,0,2]]),
 wCells([[-1,0,-1,3],[1,0,-1,3],[-1,0,1,3],[1,0,1,3],[-1,1,-1,3],[1,1,-1,3],[-1,1,1,3],[1,1,1,3],[-1,2,-1,1],[0,2,-1,1],[1,2,-1,1],[-1,2,0,1],[0,2,0,1],[1,2,0,1],[-1,2,1,1],[0,2,1,1],[1,2,1,1],[0,3,0,1],[0,4,0,2]])];
const WTIME=[1.1,1.0],WHOLD=[5,6];
function cr(a,b,c,d,t){const t2=t*t;return .5*(2*b+(c-a)*t+(2*a-5*b+4*c-d)*t2+(3*b-a-3*c+d)*t2*t)}
function wGround(x,z){const ix=Math.floor(x),iz=Math.floor(z);for(let y=46;y>=0;y--){const b=getB(ix,y,iz);if(b&&b!==B.LEAVES&&b!==B.WOOD&&b!==B.GLASS&&b!==B.LATTICE&&b!==B.WATER)return y+1}return 0}
function menuChunksReady(){for(let cz=61;cz<=62;cz++)for(let cx=56;cx<=61;cx++){const c=chunks.get(cx+cz*NC);if(!c||c.st!==2)return false}return true}
/* places the camera centre and the two work crews for this screen shape (called once the chunks are meshed) */
function menuInit(){
 const as=aspect<.8?0:aspect<1.6?1:2,kf=aspect<1?1:1.3,tf=Math.tan((fovBase+(aspect<1?.2:0))/2)*aspect;
 WM.cx=[974,1000,954][as];WM.cz=996;WM.act.length=0;WM.st.length=0;
 /* [crew, forward distance, screen x (+ = left), trade bot] */
 const spec=[[0,9.2,.66,0],[0,9.8,.30,2],[1,9.6,-.66,5],[1,10,-.30,3]],sp=[[12,.9],[12.6,-.9]];
 for(let k=0;k<2;k++){
  const fw=sp[k][0]*kf,x=WM.cx-fw,z=WM.cz+sp[k][1]*tf*fw;let best=1e9,bx=x,bz=z,by=0;
  for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){
   let lo=99,hi=0;for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++){const g=wGround(x+dx+a,z+dz+b);lo=Math.min(lo,g);hi=Math.max(hi,g)}
   const sc=(hi-lo)*3+Math.abs(dx)+Math.abs(dz);if(sc<best){best=sc;bx=Math.floor(x+dx)+.5;bz=Math.floor(z+dz)+.5;by=hi}
  }
  WM.st.push({x:bx,y:by,z:bz,k,N:WSTR[k].length,n:0,off:k*7});
 }
 for(let i=0;i<4;i++){
  const s=spec[i],fw=s[1]*kf,st=WM.st[s[0]];
  let x=WM.cx-fw,z=WM.cz+s[2]*tf*fw;
  const y=wGround(x,z);
  WM.act.push({i:s[3],x,y,z,x0:x,z0:z,yaw:Math.atan2(-(st.x-x),-(st.z-z)),ph:0,leg:0,arm:0,look:BLOOK[s[3]],st:BS.BUILD,cele:0,k:s[0],work:false});
 }
 WM.ready=true;W.snap=1;
}
function menuAnim(){
 const t=W.t;
 for(const s of WM.st){
  const N=s.N,tb=N*WTIME[s.k],T=tb+WHOLD[s.k]+2,ph=(t+s.off)%T;
  s.work=ph<tb;s.n=ph<tb?Math.floor(ph/WTIME[s.k]):ph<tb+WHOLD[s.k]?N:Math.max(0,N-Math.floor((ph-tb-WHOLD[s.k])*N/2));
 }
 for(let i=0;i<WM.act.length;i++){
  const a=WM.act[i],s=WM.st[a.k];
  a.x=a.x0+.12*Math.sin(t*.8+i*2);a.z=a.z0+.1*Math.cos(t*.7+i);
  a.yaw=Math.atan2(-(s.x-a.x),-(s.z-a.z))+(a.i%2?2.1:-2.1);
  a.work=s.work;a.arm=s.work?.35+.65*(.5+.5*Math.sin(t*2.8+i*1.7)):0;a.leg=0;
 }
}
function menuDraw(){
 botN=0;partAmb=null;
 for(const a of WM.act)drawBotFig(a);
 for(const s of WM.st){
  const cs=WSTR[s.k];
  for(let i=0;i<s.n;i++){const c=cs[i];wbox.x=s.x+c[0]+.5;wbox.z=s.z+c[2]+.5;wbox.y=s.y+c[1];part(wbox,0,.5,0,.5,.5,.5,WCOL[c[3]])}
 }
}
const wbox={x:0,y:0,z:0,yaw:0};
function welcomeCam(dt){
 W.sp=(wRM&&wRM.matches)?.25:emaDt>.045?.6:1;
 W.t+=dt*W.sp;ckT+=dt;
 if(!WM.ready&&menuChunksReady())menuInit();
 const u=W.t*6.28318/WP,cx=WM.cx+1.2*Math.sin(u),cz=WM.cz+.6*Math.cos(u);
 const gy=wGround(cx,cz)+2.6;
 if(W.snap){W.y0=gy;W.snap=0}else W.y0+=(gy-W.y0)*Math.min(1,dt*4);
 const ty=26+1.5*Math.sin(2*u),tz=MQP[1]+4*Math.sin(u+2.4);
 player.x=cx;player.z=cz;player.y=W.y0-1.62;
 const dx=MQP[0]-cx,dz=tz-cz;
 player.yaw=Math.atan2(-dx,-dz);player.pitch=Math.atan2(ty-W.y0,Math.hypot(dx,dz));
 if(WM.ready)menuAnim();
 stepBots(dt);
 tipT+=dt;if(tipT>6){tipT=0;tipI=(tipI+1)%TIPS.length;const t=$('wtip');t.style.opacity=0;setTimeout(()=>{t.textContent=TIPS[tipI];t.style.opacity=1},400)}
}
function confirmReset(back){
 modal(`<h2>Start over?</h2><p>This removes your buildings, stars and unlocked blocks.</p>
  <div class="row"><button class="btn alt" data-a="no">Keep my world</button><button class="btn" data-a="yes">Yes, reset</button></div>`,
  p=>{p.querySelector('[data-a=no]').onclick=()=>{closeModal();if(back&&!playing)back()};
   p.querySelector('[data-a=yes]').onclick=()=>{closeModal();resetAll()}});
}
function resetAll(){
 LIFT_CABIN=null;if(LIFT_RIDE)liftFinish();
 clearTimeout(saveTimer);saveTimer=0;
 edits.clear();bedits.clear();blClear();PERSIST.dirty.clear();PERSIST.botDirty=false;worldDirty=false;resetState();SV.has=false;SV.pos=null;SV.sum=null;
 for(const b of bots){b.on=false;b.done=[];b.ds=null;b.site=null;b.st=0;b.cells.length=0}
 JB=null;joinMap.clear();playing=false;glide=null;
 dayT=.2;SV.dayKeep=.2;activeSec=0;
 wipeStores().then(()=>{unloadAll();bootSpawn();applyGfx();startMission(0,false);updateHud();updateMode();updateJoinChip();showWelcome();saveProg()});
}
function settingsPanel(){
 modal(`<h2>Settings</h2>
  <div class="row"><button class="btn alt" data-a="snd">Sound: ${S.settings.sound?'On':'Off'}</button><button class="btn alt" data-a="gfx">Graphics: ${S.settings.gfx==='auto'?'Auto':S.settings.gfx==='low'?'Low':'High'}</button></div>
  <div class="row"><button class="btn alt sm" data-a="m">-</button><span>Look speed: <b>${S.settings.sens}</b></span><button class="btn alt sm" data-a="p">+</button></div>
  <div class="row"><button class="btn alt" data-a="con">Console</button><button class="btn alt sm" data-a="reset">Reset world</button><button class="btn" data-a="ok">Close</button></div>`,
  p=>{
   const again=()=>{closeModal();settingsPanel()};
   p.querySelector('[data-a=con]').onclick=()=>{closeModal();conOpen(true)};
   p.querySelector('[data-a=snd]').onclick=()=>{S.settings.sound=!S.settings.sound;queueSave();again()};
   p.querySelector('[data-a=gfx]').onclick=()=>{S.settings.gfx=S.settings.gfx==='auto'?'low':S.settings.gfx==='low'?'high':'auto';applyGfx();queueSave();again()};
   p.querySelector('[data-a=m]').onclick=()=>{S.settings.sens=Math.max(1,S.settings.sens-1);queueSave();again()};
   p.querySelector('[data-a=p]').onclick=()=>{S.settings.sens=Math.min(6,S.settings.sens+1);queueSave();again()};
   p.querySelector('[data-a=reset]').onclick=()=>{closeModal();confirmReset(settingsPanel)};
   p.querySelector('[data-a=ok]').onclick=closeModal;
  });
}
function skillsPanel(){
 const nx=RANKS.find(r=>r[1]>S.stars);
 modal(`<h2>My Skills</h2><p><b>${rankOf(S.stars)}</b> with ${S.stars} stars${nx?`. ${nx[1]-S.stars} more stars to become ${nx[0]}.`:'.'}</p>
  ${SKILLS.map(s=>`<div class="skill"><span>${s[1]}</span><b>${S.skills[s[0]]}</b></div>`).join('')}
  <p>Open Air Prison: <b>${S.gz.pts}</b> points, best <b>${S.gz.best}</b> people safe in one drone attack.</p>
  <div class="row"><button class="btn alt" data-a="pass">Museum Passport</button><button class="btn alt" data-a="prison">Open Air Prison</button><button class="btn" data-a="ok">Close</button></div>`,p=>{p.querySelector('[data-a=ok]').onclick=closeModal;p.querySelector('[data-a=prison]').onclick=visitPrison;p.querySelector('[data-a=pass]').onclick=()=>{closeModal();passportPanel()}});
}
function breakReminder(){
 modal(`<svg class="motif"><use href="#star8"/></svg><h2>Time for a little break</h2>
  <p>You have been playing for a while. Look at something far away to rest your eyes, stretch your arms, and check if it is prayer time.</p>
  <div class="row"><button class="btn" data-a="ok">Continue playing</button></div>`,p=>{p.querySelector('[data-a=ok]').onclick=closeModal});
}

/* ===== 11. Input ===== */
function tryLock(){try{const r=canvas.requestPointerLock();if(r&&r.catch)r.catch(()=>{noLock=true})}catch(e){noLock=true}}
let noLock=false,aim=null,aimTime=0,hintTimer=0;
/* wantLock: the mouse should be captured whenever no card is open. Esc clears it, so the player is never forced back in. */
let wantLock=false;
function relock(){
 if(!wantLock||touchMode||noLock||!playing||curModal||mapDialog.open||LIFT_RIDE||document.pointerLockElement)return;
 try{const r=canvas.requestPointerLock();if(r&&r.catch)r.catch(()=>{})}catch(e){}
}
document.addEventListener('pointerlockchange',()=>{
 const h=$('lockhint');clearTimeout(hintTimer);
 if(document.pointerLockElement===canvas){
  /* a card opened while the lock request was pending: give the mouse back so its buttons can be clicked */
  if(curModal||mapDialog.open||LIFT_RIDE){document.exitPointerLock();return}
  h.classList.add('on');hintTimer=setTimeout(()=>h.classList.remove('on'),6000);
 }else{
  h.classList.remove('on');
  /* released with no card open means the player pressed Esc: leave the mouse free */
  if(!curModal)wantLock=false;MG.fireHeld=false;
 }
});
const locked=()=>document.pointerLockElement===canvas;
function look(dx,dy){const k=.0016*S.settings.sens;player.yaw-=dx*k;player.pitch=clamp(player.pitch-dy*k,-1.45,1.45);if(MG.on){player.x=MG_POST.x+Math.sin(player.yaw)*MG_RADIUS;player.z=MG_POST.z+Math.cos(player.yaw)*MG_RADIUS;player.vx=player.vy=player.vz=0}}
function act(px,py,button){
 if(!playing||curModal||mapDialog.open||FLY||TP||LIFT_RIDE)return;
 if(MG.on){if(button===2)leaveMachinePost();return}
 const r=playerRay(px,py),mode=button===0?'break':button===2?'place':S.mode;
 const hit=cast(r.o,r.d,REACH,mode==='place'?S.sel:0,mode==='break'),bp=botPick(r.o,r.d);
 if(liftClick(r,hit)||LIFT_CABIN)return;
 if(button===2&&hit&&!hit.ghost&&machinePostBlock(hit.x,hit.y,hit.z)){enterMachinePost();return}
 const xp=exPick(r.o,r.d);
 if(xp&&(!hit||xp.t<hit.t||(hit.b===B.GLASS&&xp.t<hit.t+2.5))&&(!bp||xp.t<bp.t)){openExhibit(xp.i);return}
 if(bp&&(!hit||bp.t<hit.t)){openBotCard(bp.bot);return}
 if(!hit)return;
 if(hit.b===B.CHEST){openChest(hit.x,hit.y,hit.z);return}
 if(mode==='break'){
  if(hit.ghost||hit.y===0)return;
  if(protectedLandmarkBlock(hit.x,hit.y,hit.z)||portalPad(hit.x,hit.z,0)||machinePostBlock(hit.x,hit.y,hit.z)||liftProtected(hit.x,hit.y,hit.z)){toast('This landmark or post is protected.');return}
  setBlock(hit.x,hit.y,hit.z,0,0);sfx.brk();return;
 }
 if(!S.unlocked.includes(S.sel)&&!S.tmp.includes(S.sel)){toast('That block is locked.');return}
 const x=hit.x+(hit.ghost?0:hit.n[0]),y=hit.y+(hit.ghost?0:hit.n[1]),z=hit.z+(hit.ghost?0:hit.n[2]);
 if(liftProtected(x,y,z)){toast('Keep the elevator clear.');return}
 const cur=getB(x,y,z);
 if(!inb(x,y,z)||y<1||!chunkAt(x>>4,z>>4)||(cur&&cur!==B.WATER&&DEFS[cur].kind!=='x')||(DEFS[S.sel].solid&&overlapsPlayer(x,y,z)))return;
 setBlock(x,y,z,S.sel,0);sfx.place();
}
const looks=new Map();
function aimAt(px,py){aim=[px,py];aimTime=performance.now()}
canvas.addEventListener('pointerdown',e=>{
 if(e.pointerType==='mouse'&&touchMode)setTouch(false);
 if(curModal||mapDialog.open||LIFT_RIDE||!playing)return;
 if(e.pointerType==='mouse'&&!noLock&&!locked()){wantLock=true;tryLock();return}
 if(locked()){if(MG.on&&e.button===0){MG.fireHeld=true;MG.fireT=MG_RATE;machineFire()}else act(undefined,undefined,e.button);return}
 canvas.setPointerCapture(e.pointerId);
 looks.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,t:performance.now(),moved:false,b:e.button});
 aimAt(e.clientX,e.clientY);
 if(MG.on&&e.button===0){MG.fireHeld=true;MG.fireT=MG_RATE;machineFire(e.clientX,e.clientY)}
});
canvas.addEventListener('pointermove',e=>{
 if(locked()){look(e.movementX,e.movementY);return}
 aimAt(e.clientX,e.clientY);
 const p=looks.get(e.pointerId);if(!p)return;
 if(Math.hypot(e.clientX-p.sx,e.clientY-p.sy)>10)p.moved=true;
 if(p.moved)look((e.clientX-p.x)*1.6,(e.clientY-p.y)*1.6);
 p.x=e.clientX;p.y=e.clientY;
});
const endLook=e=>{
 if((e.type==='pointerup'||e.type==='pointercancel')&&e.button===0)MG.fireHeld=false;
 const p=looks.get(e.pointerId);if(!p)return;looks.delete(e.pointerId);
 if(e.type==='pointerup'&&!p.moved&&performance.now()-p.t<350){if(MG.on&&p.b===2)leaveMachinePost();else if(!MG.on)act(p.sx,p.sy,e.pointerType==='mouse'?p.b:undefined)}
};
canvas.addEventListener('pointerup',endLook);canvas.addEventListener('pointercancel',endLook);
canvas.addEventListener('wheel',e=>{if(playing&&!curModal)cycleBlock(e.deltaY>0?1:-1)},{passive:true});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('contextmenu',e=>e.preventDefault());
for(const ev of['gesturestart','gesturechange','dblclick'])document.addEventListener(ev,e=>e.preventDefault());
document.addEventListener('touchmove',e=>{if(e.touches.length>1)e.preventDefault()},{passive:false});
document.addEventListener('pointerlockerror',()=>{noLock=true});
window.addEventListener('keydown',e=>{
 const k=e.key.toLowerCase();
 if(LIFT_RIDE)return;
 /* the console owns the keyboard while it is open: every letter must reach its input, so no bindings run */
 if(CON.on){if(k==='escape'){e.preventDefault();conOpen(false)}return}
 if(k==='e'||k==='escape'&&$('blockInventory')&&curModal){
  if(!e.repeat){
   if(curModal&&$('blockInventory')){if(k==='escape')wantLock=false;closeModal()}else if(k==='e')openInventory();
  }
  e.preventDefault();return;
 }
 if(curModal&&$('blockInventory'))return;
 if(k==='f'&&!e.repeat&&liftPanel()){e.preventDefault();return}
 if(k==='/'&&!e.repeat&&!curModal&&!mapDialog.open&&!LIFT_CABIN){conOpen(true);e.preventDefault();return}
 if(k==='m'&&!e.repeat&&playing&&!curModal&&!LIFT_CABIN){setMapOpen(!mapDialog.open);return}
 if(mapDialog.open)return;
 if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
 input.keys.add(k);
 if(playing&&!curModal&&k>='1'&&k<='9')selectBlock(hotbar[+k-1]);
});
window.addEventListener('keyup',e=>input.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{input.keys.clear();MG.fireHeld=false});
window.addEventListener('touchstart',()=>{if(!touchMode)setTouch(true)},{passive:true});
function setTouch(on){touchMode=on;$('app').classList.toggle('touch',on);$('app').classList.toggle('desk',!on);document.body.classList.toggle('touch',on)}

const joy=$('joy');let joyId=null;
function joyMove(e){
 const r=joy.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),m=r.width*.34,l=Math.hypot(dx,dy)||1,s=Math.min(1,l/m);
 const x=dx/l*s,y=dy/l*s;$('knob').style.transform=`translate(${x*m}px,${y*m}px)`;
 input.jx=Math.abs(x)<.12?0:x;input.jy=Math.abs(y)<.12?0:-y;
}
joy.addEventListener('pointerdown',e=>{if(joyId!==null)return;joyId=e.pointerId;joy.setPointerCapture(joyId);joyMove(e)});
joy.addEventListener('pointermove',e=>{if(e.pointerId===joyId)joyMove(e)});
const joyEnd=e=>{if(e.pointerId!==joyId)return;joyId=null;input.jx=input.jy=0;$('knob').style.transform=''};
joy.addEventListener('pointerup',joyEnd);joy.addEventListener('pointercancel',joyEnd);
const jb=$('btnJump');
jb.addEventListener('pointerdown',e=>{input.jump=true;jb.setPointerCapture(e.pointerId)});
for(const ev of['pointerup','pointercancel'])jb.addEventListener(ev,()=>{input.jump=false});
$('btnMode').addEventListener('click',()=>{S.mode=S.mode==='place'?'break':'place';updateMode()});
$('btnSet').addEventListener('click',settingsPanel);
$('btnQuest').addEventListener('click',questPanel);
$('btnStats').addEventListener('click',skillsPanel);
$('btnPass').addEventListener('click',passportPanel);
$('liftChip').addEventListener('click',liftPanel);
$('helpout').addEventListener('click',()=>{if(helpOut()){toast('Back on dry land');$('helpout').classList.remove('on')}else toast('Try walking towards the shore')});

/* ===== 12. Loader, main loop and boot ===== */
const LD={phase:'idle',gen:0,mesh:0,t0:0,menu:0};
function setProg(p,label){
 $('wfill').style.width=(p*100).toFixed(0)+'%';$('wpct').textContent=(p*100|0)+'%';if(label)$('wstage').textContent=label;
}
function showWelcome(){
 const w=$('welcome');w.style.display='block';w.classList.remove('live');$('app').classList.add('pre');$('wbar').style.display='block';$('wready').style.display='none';W.on=false;WM.ready=false;LD.menu=0;$('wtip').textContent=TIPS[0];
 setProg(.16,'Shaping the dunes and oasis');LD.phase='chunks';LD.t0=0;RAD=2;qCx=-9999;
}
/* chunks of the ring that really exist: near a world edge part of the ring lies outside the world */
function ringCount(r,cx,cz){let n=0;for(let z=-r;z<=r;z++)for(let x=-r;x<=r;x++)if(x*x+z*z<=r*r&&cx+x>=0&&cx+x<NC&&cz+z>=0&&cz+z<NC)n++;return n}
function loadStep(now){
 if(!SV.ready){if(!LD.t0)LD.t0=now;return}
 streamWork(10,3,now);
 if(!LD.t0)LD.t0=now;
 if(LD.menu){welcomeCam(0);if(WM.ready||now-LD.menu>9000){setProg(1,'Ready');LD.phase='ready';applyGfx();startScreen()}return}
 const gT=ringCount(3,pcx,pcz),mT=ringCount(2,pcx,pcz);let g=0,m=0;
 for(const c of loaded){const dx=c.cx-pcx,dz=c.cz-pcz,d=dx*dx+dz*dz;if(d<=9)g++;if(d<=4&&c.st===2)m++}
 const p=.16+.5*Math.min(1,g/gT)+.34*Math.min(1,m/mT);
 setProg(Math.min(.99,p),g<gT?'Shaping the dunes and oasis':'Raising the buildings');
 /* fallback: never keep a child waiting more than a few seconds */
 if((m>=mT&&g>=gT)||now-LD.t0>8000){
  /* the live menu scene (grand mosque and its avenue) is loaded before the buttons appear */
  if(!LD.menu){LD.menu=now;W.on=true;W.t=0;W.snap=1;RAD=6;qCx=-9999}
  if(WM.ready||now-LD.menu>9000){setProg(1,'Ready');LD.phase='ready';applyGfx();startScreen()}
  else setProg(.97,'Raising the buildings');
 }
}
function applyGfx(){
 const g=S.settings.gfx;
 if(g==='low'){RAD=3;dprCur=1}else if(g==='high'){RAD=7;dprCur=1.5}else{RAD=3;dprCur=1}
 if(LD.phase==='chunks')RAD=2;
 resize();
}
let emaDt=.02,adaptT=0,goodT=0,lastUnload=0,adaptClock=0,adaptChg=-99,adaptDown=-99,busyFrame=false;
/* adaptive quality with hysteresis: frames that generated or meshed chunks are not measured,
   10 s must pass after any change, and 30 s after a decrease before going up again */
function adapt(dt){
 if(!playing||curModal||player.hold)return;
 adaptClock+=dt;
 if(!busyFrame)emaDt+=(dt-emaDt)*.1;
 adaptT+=dt;
 if(adaptT<2.5||S.settings.gfx!=='auto')return;adaptT=0;
 if(adaptClock-adaptChg<10)return;
 if(emaDt>.03){goodT=0;
  let ch=false;
  if(dprCur>1.01){dprCur=Math.max(1,dprCur-.25);resize();ch=true}else if(RAD>(W.on&&!playing?4:3)){RAD--;ch=true}
  if(ch){adaptChg=adaptDown=adaptClock}
 }
 else if(emaDt<.02){
  if(++goodT>=3&&adaptClock-adaptDown>=30){goodT=0;
   let ch=false;
   if(RAD<7){RAD++;ch=true}else if(dprCur<1.49){dprCur=Math.min(1.5,dprCur+.25);resize();ch=true}
   if(ch)adaptChg=adaptClock;
  }
 }
 else goodT=0;
}
let last=0,activeSec=0,clockText='',uwOn=false,hoKind=0;
function uiWater(){
 const u=playing&&player.water&&getB(Math.floor(cam.e[0]),Math.floor(cam.e[1]),Math.floor(cam.e[2]))===B.WATER;
 if(u!==uwOn){uwOn=u;$('uw').style.display=u?'block':'none'}
 const k=playing&&player.waterT>20?1:playing&&player.trapT>20?2:0;
 if(k!==hoKind){hoKind=k;const h=$('helpout');h.classList.toggle('on',k>0);if(k)h.textContent=k===1?'Swim to shore':'Climb out'}
}
const WAQT_NAMES=['Fajr','Dhuhr','Asr','Maghrib','Isha'],WAQT_SECONDS=600,PRAYER_SECONDS=30;
const prayerHud=$('prayerHud'),prayerStatus=$('prayerStatus'),prayerBar=$('prayerBar');
let prayerHold=0,prayerAnchor=null,prayerState=null,prayerCell='',prayerLocal=[];
const isMasjid=l=>l&&(l.t==='mosque'||l.t==='haram');
function insideMasjid(l){
 const x=Math.floor(player.x)-l.x,z=Math.floor(player.z)-l.z,y=player.y-l.y0;
 if(l.t==='haram')return Math.abs(x)<=52&&Math.abs(z)<=52&&y>=.95&&y<14;
 const lx=[x,z,-x,-z][l.o],lz=[z,-x,-z,x][l.o],P=l.P;
 return Math.abs(lx)<P.hw&&lz>P.hb&&lz<P.hf&&y>=.95&&y<P.wh-1;
}
function currentMasjid(){
 const x=Math.floor(player.x/RG),z=Math.floor(player.z/RG),key=x+','+z;
 if(key!==prayerCell){
  prayerCell=key;prayerLocal=fixedList().filter(isMasjid);
  for(let a=x-1;a<=x+1;a++)for(let b=z-1;b<=z+1;b++){const l=lmCell(a,b);if(isMasjid(l))prayerLocal.push(l)}
 }
 return prayerLocal.find(insideMasjid);
}
function moveToNearestMasjid(){
 const x=player.x,z=player.z,dist=l=>Math.hypot(l.x-x,l.z-z);
 const options=fixedList().filter(isMasjid),radius=Math.min(...options.map(dist));
 for(let a=Math.max(0,Math.floor((x-radius)/RG));a<=Math.min(Math.ceil(WX/RG)-1,Math.floor((x+radius)/RG));a++)
 for(let b=Math.max(0,Math.floor((z-radius)/RG));b<=Math.min(Math.ceil(WZ/RG)-1,Math.floor((z+radius)/RG));b++){
  const l=lmCell(a,b);if(isMasjid(l)&&dist(l)<=radius)options.push(l);
 }
 options.sort((a,b)=>dist(a)-dist(b));
 for(const l of options){
  const [lx,lz]=l.t==='haram'?[13,6]:[1,Math.floor((l.P.hb+l.P.hf)/2)];
  const tx=l.x+[lx,-lz,-lx,lz][l.o]+.5,tz=l.z+[lz,lx,-lz,-lx][l.o]+.5;
  if(placeSafe(tx,tz,undefined,undefined,l.y0+1)&&insideMasjid(l)){
   input.keys.clear();input.jx=input.jy=0;input.jump=false;return true;
  }
 }
 return false;
}
function prayerStep(dt){
 const p=S.prayer,movingThrough=TP||FLY||MG.on||LIFT_RIDE;
 if(prayerState!==p){prayerState=p;prayerAnchor=null;prayerHold=0}
 const mosque=!p.done&&!movingThrough&&currentMasjid();
 const still=mosque&&player.ground&&!player.water&&!input.jump&&Math.hypot(player.vx,player.vz)<.08;
 if(!still){prayerHold=0;prayerAnchor=null}
 else{
  const a=prayerAnchor;
  if(!a||a.l!==mosque||Math.hypot(player.x-a.x,player.y-a.y,player.z-a.z)>.10){
   prayerHold=0;prayerAnchor={l:mosque,x:player.x,y:player.y,z:player.z};
  }
  prayerHold+=Math.min(dt,WAQT_SECONDS-p.time);
  if(prayerHold>=PRAYER_SECONDS){
   p.done=true;prayerHold=0;prayerAnchor=null;toast(WAQT_NAMES[p.waqt]+' prayer complete.');queueSave();
  }
 }
 p.time+=dt;
 if(p.time>=WAQT_SECONDS){
  if(!p.done){
   const hadPoint=S.stars>0;
   S.stars=Math.max(0,S.stars-1);updateHud();
   if(hadPoint&&S.stars===0){
    const moved=moveToNearestMasjid();
    toast(moved?'Missed prayer. You lost 1 point and were taken to a masjid.':'Missed prayer. You lost 1 point.');
   }else toast(hadPoint?'Missed prayer. You lost 1 point.':'Prayer missed.');
  }
  p.time%=WAQT_SECONDS;p.waqt=(p.waqt+1)%WAQT_NAMES.length;p.done=false;
  prayerHold=0;prayerAnchor=null;queueSave();
 }
}
function showPrayer(){
 prayerHud.hidden=!playing;
 if(!playing)return;
 const p=S.prayer,left=Math.ceil(WAQT_SECONDS-p.time),warn=!p.done&&left<=120;
 const text=WAQT_NAMES[p.waqt]+' Â· '+Math.floor(left/60)+':'+String(left%60).padStart(2,'0')+
  (p.done?' Â· Prayer complete':prayerHold>0?' Â· Praying â€” stand still':warn?' Â· Pray in a masjid or lose 1 point':' Â· Pray in a masjid');
 if(prayerStatus.textContent!==text)prayerStatus.textContent=text;
 prayerHud.classList.toggle('urgent',warn);prayerBar.hidden=prayerHold<=0;
 if(prayerHold>0)prayerBar.value=prayerHold;
}
function frame(now){
 requestAnimationFrame(frame);
 if(document.hidden){last=now;return}
 const elapsed=(now-last)/1000||0,dt=Math.min(.05,elapsed);last=now;
 if(playing&&!curModal&&!mapDialog.open){
 if(LIFT_RIDE)liftStep(elapsed);else if(LIFT_CABIN){player.ground=true}else if(MG.on){player.vx=player.vy=player.vz=0;if(MG.fireHeld){MG.fireT-=dt;if(MG.fireT<=0){MG.fireT=MG_RATE;machineFire(locked()||!aim?undefined:aim[0],locked()||!aim?undefined:aim[1])}}}else if(FLY)flyStep(dt);else if(TP)tpStep(Math.min(.12,elapsed));else{let r=dt;while(r>0){const s=Math.min(r,1/60);stepPlayer(s);r-=s}}
  if(!LIFT_CABIN)liftBoardOnApproach();
  activeSec+=dt;if(activeSec>=BREAK_SECONDS&&!LIFT_RIDE){activeSec=0;breakReminder()}
  if(!TP&&!FLY&&!MG.on&&!LIFT_RIDE&&!LIFT_CABIN)prayerStep(elapsed);
  else{prayerHold=0;prayerAnchor=null}
  edgeHint-=dt;stepBots(dt);gzTick(dt);questTick(dt);if(!TP&&!MG.on&&!LIFT_RIDE)portalTick(dt);saveTick(dt);
 }else if(glide)glideStep(dt);
 else if(!playing){if(W.on)welcomeCam(dt);else player.yaw+=dt*.08}
 if(curModal||mapDialog.open){prayerHold=0;prayerAnchor=null}
 showPrayer();
 /* the lobby keeps talking while a card is open, so a friend never waits on a paused card */
 netTick(dt);
 if(playing||glide)dayT=(dayT+dt/DAY_SECONDS)%1;else dayT=W.day;
 {const mt=W.on&&!playing&&!glide?1:0;menuK+=(mt-menuK)*Math.min(1,dt*(mt?2:3));if(menuK<.01&&!mt)menuK=0}
 const label=updateSky();
 if(label!==clockText){clockText=label;$('clock').textContent=label}
 if(LD.phase==='chunks'){busyFrame=true;loadStep(now)}
 else{busyFrame=streamWork(4,2,now)>0;if(now-lastUnload>400){lastUnload=now;unloadFar()}}
 if(beamsDirty&&now-beamsT>300){beamsT=now;rebuildBeams()}
 $('building').style.display=playing&&player.hold?'block':'none';
 drawMap(now);updateCamera();fillBotGeo();updateTags();updateSigns(dt);museumHud(dt);fillExGeo(now);uiWater();liftHud();
 hitView=null;
 if(playing&&!curModal&&!mapDialog.open){
  let r=null;
  if(locked())r=playerRay();
  else if(aim&&now-aimTime<(touchMode?600:5000))r=playerRay(aim[0],aim[1]);
  if(r){const h=cast(r.o,r.d,REACH,0,true);if(h)hitView=h}
 }
 $('cross').classList.toggle('on',playing&&locked());
 render(now);adapt(dt);
}
function fatal(msg){
 $('welcome').style.display='none';$('panel').innerHTML=`<h2>${GAME}</h2><p>${msg}</p>`;$('modal').classList.add('on');
}
function boot(){
 const steps=[
  ['Painting the blocks',.05,()=>{setTouch(window.matchMedia('(pointer: coarse)').matches);buildAtlas()}],
  ['Preparing the graphics',.12,()=>{initGL();resize()}],
  ['Opening your world',.16,()=>{
   bootSpawn();storeInit();SV.dayKeep=dayT;
   if(LD.phase!=='chunks'){LD.phase='chunks';}
   RAD=2;startMission(S.mission,false);updateHud();updateMode();$('wtip').textContent=TIPS[0];
   canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();saveNow(true)});
   canvas.addEventListener('webglcontextrestored',()=>{try{restoreGL()}catch(err){fatal('Graphics were interrupted. Please reload the page.')}});
   window.addEventListener('resize',resize);window.addEventListener('orientationchange',()=>setTimeout(resize,150));
   if(window.ResizeObserver)new ResizeObserver(resize).observe(document.documentElement);
   document.addEventListener('visibilitychange',()=>{if(document.hidden)saveNow(true);else{last=performance.now();if(actx)initAudio()}});
   window.addEventListener('pagehide',()=>saveNow(true));window.addEventListener('blur',()=>saveNow(true));document.addEventListener('freeze',()=>saveNow(true));
   document.addEventListener('pointerdown',initAudio);document.addEventListener('keydown',initAudio);
   const wq=k=>$('welcome').querySelector('[data-a='+k+']');
   wq('play').onclick=startPlay;wq('reset').onclick=()=>confirmReset();wq('set').onclick=settingsPanel;wq('how').onclick=howCard;wq('lobby').onclick=joinLobbyCard;
   requestAnimationFrame(frame);
  }]];
 let i=0;
 const next=()=>{
  if(i>=steps.length)return;
  const s=steps[i++];
  $('wstage').textContent=s[0];
  requestAnimationFrame(()=>setTimeout(()=>{
   try{s[2]();setProg(s[1])}catch(err){fatal('Sorry, the game could not start on this device. Please try another browser or device.');return}
   next();
  },0));
 };
 if(!gl){$('wbar').style.display='none';const m=$('wmsg');m.style.display='block';m.textContent='Your device could not start 3D graphics. Please try another browser or device. The musliMineCraft sunrise is waiting for you.';return}
 next();
}
/* ---- hooks for automated tests ---- */
window.__stats=()=>{const m=memBytes();return{loadedChunks:loaded.length,meshedChunks:m[1],queue:Math.max(0,qList.length-qPos)+dirtySet.size,radius:RAD,dpr:Math.min(window.devicePixelRatio||1,dprCur),approxBytes:m[0],fps:Math.round(1/Math.max(.001,emaDt)),bots:bots.filter(b=>b.on).length,phase:LD.phase,hold:player.hold}};
window.__tp=(x,z,yaw,pitch,sync)=>{rawTeleport(x,z,yaw,pitch);if(sync){const cx=Math.floor(x/16),cz=Math.floor(z/16);forceLoad(cx,cz,2);qCx=-9999;stepPlayer(.016);player.hold=false;let n=0;while(collides(player.x,player.y,player.z)&&n++<44)player.y+=1;player.vy=0}};
window.__find=(type,x,z)=>{
 x=x===undefined?player.x:x;z=z===undefined?player.z:z;let best=null,bd=1e12;
 const all=fixedList().slice();for(let rz=0;rz<NR;rz++)for(let rx=0;rx<NR;rx++){const l=lmCell(rx,rz);if(l)all.push(l)}
 for(const l of all){if(l.t!==type)continue;const d=(l.x-x)**2+(l.z-z)**2;if(d<bd){bd=d;best=l}}
 if(!best)return null;
 const F=[[0,1],[-1,0],[0,-1],[1,0]][best.o],dist=type==='mosque'?best.hz+13+best.v*3:best.ez+14;
 return{type:best.t,v:best.v,o:best.o,x:best.x,z:best.z,y:best.y0,ex:best.ex,ez:best.ez,vx:best.x+F[0]*dist,vz:best.z+F[1]*dist,yaw:Math.atan2(F[0],F[1]),fx:F[0],fz:F[1]};
};
window.__chunkHash=(cx,cz)=>{const c=chunks.get(cx+cz*NC);let h=2166136261;const v=c?c.v:null;if(!v)return -1;for(let i=0;i<v.length;i++){h^=v[i];h=Math.imul(h,16777619)}return h>>>0};
window.__genHash=(cx,cz)=>{const c={key:cx+cz*NC,cx,cz,v:new Uint8Array(CV),chests:[],my:0};genChunk(c);let h=2166136261;for(let i=0;i<c.v.length;i++){h^=c.v[i];h=Math.imul(h,16777619)}return h>>>0};
window.__unload=(cx,cz)=>{const c=chunks.get(cx+cz*NC);if(c)unloadChunk(c);return!!c};
window.__load=(cx,cz)=>{if(!chunks.has(cx+cz*NC))loadChunk(cx,cz);return true};
window.__stepBots=(sec)=>{const s0=playing;for(let t=0;t<sec;t+=.1){streamWork(30,3,performance.now());stepBots(.1)}};
window.__cam=(x,y,z,yaw,pitch)=>{forceLoad(Math.floor(x/16),Math.floor(z/16),3);qCx=-9999;Object.assign(player,{x,y:y-1.62,z,yaw,pitch,hold:false,vy:0});window.__fly=true};
window.__sil=()=>{silBuild(player.x,player.z);return{tris:SIL.n/3,drawCalls:1,list:SIL.list.map(e=>({id:e.l.id,t:e.l.t,v:e.l.v,o:e.l.o,x:e.l.x,z:e.l.z,y0:e.l.y0,ex:e.l.ex,ez:e.l.ez,a:e.a,tg:e.t,lod:e.lod,boxes:e.boxes,peaks:e.peaks,loaded:silLoaded(e.l)}))}};
window.__wset=t=>{W.t=t;W.snap=1;welcomeCam(0);if(WM.ready)menuAnim()};
window.__wm=()=>({period:WP,ready:WM.ready,t:W.t,on:W.on&&!playing,act:WM.act.map(a=>({i:a.i,x:a.x,y:a.y,z:a.z,work:a.work,k:a.k})),str:WM.st.map(s=>({x:s.x,y:s.y,z:s.z,n:s.n,N:s.N})),mq:{dome:[907,37.5,995],mins:[[915,46.5,984],[915,46.5,1006],[900,46.5,984],[900,46.5,1006]],mid:[910,28,995]}});
window.__ready=()=>LD.phase==='ready'||playing;
requestAnimationFrame(()=>setTimeout(boot,0));

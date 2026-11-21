
/* ===== 10. Interface: modals, HUD, hotbar ===== */
const modalQ=[];let curModal=null,modalT=0,modalCloseT=-999;
const welcomeUp=()=>$('welcome').style.display!=='none';
function modal(html,wire){modalQ.push({html,wire});if(!curModal)nextModal()}
function nextModal(){
 curModal=modalQ.shift()||null;
 const el=$('modal');
 /* a card opened over the welcome screen lifts the whole game layer above it */
 if(!curModal){el.classList.remove('on');return}
 /* the tap guard only protects a card that opens from closed; a re-render from the card's own button is not guarded */
 {const nw=performance.now();modalT=nw-modalCloseT<80?0:nw}
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
const mapCanvas=$('mapCanvas'),mapCtx=mapCanvas.getContext('2d');let mapT=0;
function drawMap(now){if(now-mapT<250)return;mapT=now;const c=mapCtx,w=mapCanvas.width,h=mapCanvas.height,full=$('map').classList.contains('open');
 c.fillStyle='#d5c18f';c.fillRect(0,0,w,h);
 for(let y=0;y<h;y+=12)for(let x=0;x<w;x+=12)if(hash2(x,y,SEED+72)>.62){c.fillStyle='#c8b17b';c.fillRect(x,y,12,12)}
 c.strokeStyle='#78603b';c.lineWidth=2;c.strokeRect(1,1,w-2,h-2);
 const points=[['Abu Dhabi',SPAWN.x,SPAWN.z],['Grand Mosque',SPAWN.x-108,SPAWN.z-29],['Louvre Abu Dhabi',SPAWN.x+10,SPAWN.z-93],['Qatar',SPAWN.x-370,SPAWN.z-385],['Doha',SPAWN.x-355,SPAWN.z-365],['Saudi Arabia',SPAWN.x-520,SPAWN.z+245],['Masjid al-Haram and Kaaba',SPAWN.x-520,SPAWN.z+245]];
 for(const [name,x,z] of points){const mx=x/WX*w,mz=z/WZ*h;c.fillStyle=name==='Abu Dhabi'?'#d74b31':name.includes('Kaaba')?'#27231e':'#f5e7c5';c.strokeStyle='#342a20';c.lineWidth=2;c.beginPath();c.arc(mx,mz,full?5:4,0,Math.PI*2);c.fill();c.stroke();if(full){c.font='bold 12px system-ui';c.fillStyle='#342a20';c.fillText(name,mx+8,mz+4)}}
 const px=player.x/WX*w,pz=player.z/WZ*h;c.fillStyle='#164d38';c.beginPath();c.moveTo(px,pz-6);c.lineTo(px-4,pz+4);c.lineTo(px+4,pz+4);c.closePath();c.fill();
}
function setMapOpen(open){const m=$('map');m.classList.toggle('open',open);m.setAttribute('aria-label',open?'Click a place to travel':'Expand world map');mapT=0}
$('map').onclick=e=>{const m=$('map');if(!m.classList.contains('open')){setMapOpen(true);return}const r=mapCanvas.getBoundingClientRect(),x=clamp(Math.floor((e.clientX-r.left)/r.width*WX),5,WX-5),z=clamp(Math.floor((e.clientY-r.top)/r.height*WZ),5,WZ-5);setMapOpen(false);if(!playing){toast('Start playing before travelling.');return}if(!teleport(x,z,player.yaw,player.pitch)){toast('Could not find a safe place nearby.');return}toast('Travelled to map location.')};
function updateMode(){
 const b=$('btnMode');b.className=S.mode;
 b.innerHTML=`<svg class="i s"><use href="#${S.mode==='place'?'plus':'pick'}"/></svg>${S.mode==='place'?'Place':'Break'}`;
}
function buildHotbar(){
 const hb=$('hotbar');hb.innerHTML='';
 HOTBAR_IDS.forEach((id,n)=>{
  const open=S.unlocked.includes(id)||S.tmp.includes(id),b=document.createElement('button');
  b.className='slot'+(open?'':' locked')+(id===S.sel?' sel':'');b.setAttribute('aria-label',DEFS[id].name+(open?'':' (locked)'));
  const c=document.createElement('canvas');c.width=c.height=16;
  const t=DEFS[id].t[2],g=c.getContext('2d');g.imageSmoothingEnabled=false;
  g.drawImage(atlasCanvas,(t&7)*16,(t>>3)*16,16,16,0,0,16,16);b.appendChild(c);
  if(n<9)b.insertAdjacentHTML('beforeend',`<span class="no">${n+1}</span>`);
  if(!open)b.insertAdjacentHTML('beforeend','<svg class="i lk"><use href="#lock"/></svg>');
  b.onclick=()=>selectBlock(id);hb.appendChild(b);
 });
 const s=hb.querySelector('.sel');if(s)s.scrollIntoView({block:'nearest',inline:'nearest'});
 $('selName').textContent=DEFS[S.sel].name;
}
function selectBlock(id){
 if(!S.unlocked.includes(id)&&!S.tmp.includes(id)){toast(DEFS[id].name+' is locked. Finish missions and open chests to earn it.');return}
 S.sel=id;S.mode='place';updateMode();buildHotbar();queueSave();
}
function cycleBlock(dir){
 const open=HOTBAR_IDS.filter(i=>S.unlocked.includes(i)||S.tmp.includes(i));
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
 if(has&&sm){su.style.display='block';su.textContent=sm.stars+' stars · Mission '+sm.mission+' · '+sm.blocks+' blocks built';bd.style.display='block';bd.textContent=(sm.rank||rankOf(sm.stars))+' · '+sm.stars+' stars'}
 else{su.style.display='none';bd.style.display='none'}
 W.on=true;if(RAD<6)RAD=6;
 /* two frames later the illustration fades into the live panorama */
 requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!playing)$('welcome').classList.add('live')}));
}
function howCard(){
 const how=touchMode?['Drag the round pad to walk. Drag anywhere else to look.','Tap a block to break or place it. Use the Place / Break button to switch.','Follow the glowing blueprint, open the glowing chests, and tap a builder to build together.','Swim east to the Open Air Prison, or tap My Skills then Open Air Prison. Build shelters with roofs to keep families safe from the drones.']
  :['Click the game to look around. Move with W A S D and jump with Space.','Left click breaks a block. Right click places one. Keys 1 to 9 pick a block.','Follow the glowing blueprint, open the glowing chests, and click a builder to build together.','Swim east to the Open Air Prison, or open My Skills then Open Air Prison. Build shelters with roofs to keep families safe from the drones.'];
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
  if(resumed||SV.has){toast('Welcome back!')}else if(S.mission<MISSIONS.length){missionIntro(false)}else toast('Free building. Have fun!');
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
  <div class="row"><button class="btn alt sm" data-a="reset">Reset world</button><button class="btn" data-a="ok">Close</button></div>`,
  p=>{
   const again=()=>{closeModal();settingsPanel()};
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
 if(!wantLock||touchMode||noLock||!playing||curModal||document.pointerLockElement)return;
 try{const r=canvas.requestPointerLock();if(r&&r.catch)r.catch(()=>{})}catch(e){}
}
document.addEventListener('pointerlockchange',()=>{
 const h=$('lockhint');clearTimeout(hintTimer);
 if(document.pointerLockElement===canvas){
  /* a card opened while the lock request was pending: give the mouse back so its buttons can be clicked */
  if(curModal){document.exitPointerLock();return}
  h.classList.add('on');hintTimer=setTimeout(()=>h.classList.remove('on'),6000);
 }else{
  h.classList.remove('on');
  /* released with no card open means the player pressed Esc: leave the mouse free */
  if(!curModal)wantLock=false;
 }
});
const locked=()=>document.pointerLockElement===canvas;
function look(dx,dy){const k=.0016*S.settings.sens;player.yaw-=dx*k;player.pitch=clamp(player.pitch-dy*k,-1.45,1.45);if(MG.on){player.x=MG_POST.x+Math.sin(player.yaw)*MG_RADIUS;player.z=MG_POST.z+Math.cos(player.yaw)*MG_RADIUS;player.vx=player.vy=player.vz=0}}
function act(px,py,button){
 if(!playing||curModal||FLY||TP)return;
 if(MG.on){if(button===2)leaveMachinePost();else if(button===0)machineFire(px,py);return}
 const r=playerRay(px,py),mode=button===0?'break':button===2?'place':S.mode;
 const hit=cast(r.o,r.d,REACH,mode==='place'?S.sel:0,mode==='break'),bp=botPick(r.o,r.d);
 if(button===2&&hit&&!hit.ghost&&machinePostBlock(hit.x,hit.y,hit.z)){enterMachinePost();return}
 const xp=exPick(r.o,r.d);
 if(xp&&(!hit||xp.t<hit.t||(hit.b===B.GLASS&&xp.t<hit.t+2.5))&&(!bp||xp.t<bp.t)){openExhibit(xp.i);return}
 if(bp&&(!hit||bp.t<hit.t)){openBotCard(bp.bot);return}
 if(!hit)return;
 if(hit.b===B.CHEST){openChest(hit.x,hit.y,hit.z);return}
 if(mode==='break'){
  if(hit.ghost||hit.y===0)return;
  if((typeof protectedLandmarkBlock==='function'&&protectedLandmarkBlock(hit.x,hit.y,hit.z))||portalPad(hit.x,hit.z,0)||machinePostBlock(hit.x,hit.y,hit.z)){toast('This landmark or post is protected.');return}
  setBlock(hit.x,hit.y,hit.z,0,0);sfx.brk();return;
 }
 if(!S.unlocked.includes(S.sel)&&!S.tmp.includes(S.sel)){toast('That block is locked.');return}
 const x=hit.x+(hit.ghost?0:hit.n[0]),y=hit.y+(hit.ghost?0:hit.n[1]),z=hit.z+(hit.ghost?0:hit.n[2]);
 const cur=getB(x,y,z);
 if(!inb(x,y,z)||y<1||!chunkAt(x>>4,z>>4)||(cur&&cur!==B.WATER&&DEFS[cur].kind!=='x')||(DEFS[S.sel].solid&&overlapsPlayer(x,y,z)))return;
 setBlock(x,y,z,S.sel,0);sfx.place();
}
const looks=new Map();
function aimAt(px,py){aim=[px,py];aimTime=performance.now()}
canvas.addEventListener('pointerdown',e=>{
 if(e.pointerType==='mouse'&&touchMode)setTouch(false);
 if(curModal||!playing)return;
 if(e.pointerType==='mouse'&&!noLock&&!locked()){wantLock=true;tryLock();return}
 if(locked()){act(undefined,undefined,e.button);return}
 canvas.setPointerCapture(e.pointerId);
 looks.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,t:performance.now(),moved:false,b:e.button});
 aimAt(e.clientX,e.clientY);
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
 const p=looks.get(e.pointerId);if(!p)return;looks.delete(e.pointerId);
 if(e.type==='pointerup'&&!p.moved&&performance.now()-p.t<350)act(p.sx,p.sy,e.pointerType==='mouse'?p.b:undefined);
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
 if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
 input.keys.add(k);
 if(playing&&!curModal&&k>='1'&&k<='9')selectBlock(HOTBAR_IDS[+k-1]);
});
window.addEventListener('keyup',e=>input.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>input.keys.clear());
window.addEventListener('touchstart',()=>{if(!touchMode)setTouch(true)},{passive:true});
function setTouch(on){touchMode=on;$('app').classList.toggle('touch',on);$('app').classList.toggle('desk',!on)}

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
function frame(now){
 requestAnimationFrame(frame);
 if(document.hidden){last=now;return}
 const dt=Math.min(.05,(now-last)/1000||0);last=now;
 if(playing&&!curModal){
  if(MG.on){player.vx=player.vy=player.vz=0}else if(FLY)flyStep(dt);else if(TP)tpStep(dt);else{let r=dt;while(r>0){const s=Math.min(r,1/60);stepPlayer(s);r-=s}}
  activeSec+=dt;if(activeSec>=BREAK_SECONDS){activeSec=0;breakReminder()}
  edgeHint-=dt;stepBots(dt);gzTick(dt);questTick(dt);if(!TP&&!MG.on)portalTick(dt);saveTick(dt);
 }else if(glide)glideStep(dt);
 else if(!playing){if(W.on)welcomeCam(dt);else player.yaw+=dt*.08}
 if(playing||glide)dayT=(dayT+dt/DAY_SECONDS)%1;else dayT=W.day;
 {const mt=W.on&&!playing&&!glide?1:0;menuK+=(mt-menuK)*Math.min(1,dt*(mt?2:3));if(menuK<.01&&!mt)menuK=0}
 const label=updateSky();
 if(label!==clockText){clockText=label;$('clock').textContent=label}
 if(LD.phase==='chunks'){busyFrame=true;loadStep(now)}
 else{busyFrame=streamWork(4,2,now)>0;if(now-lastUnload>400){lastUnload=now;unloadFar()}}
 if(beamsDirty&&now-beamsT>300){beamsT=now;rebuildBeams()}
 $('building').style.display=playing&&player.hold?'block':'none';
 drawMap(now);updateCamera();fillBotGeo();updateTags();updateSigns(dt);updatePortalLabels();museumHud(dt);fillExGeo(now);uiWater();
 hitView=null;
 if(playing&&!curModal){
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
   wq('play').onclick=startPlay;wq('reset').onclick=()=>confirmReset();wq('set').onclick=settingsPanel;wq('how').onclick=howCard;
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

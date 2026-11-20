/* ===== 8d. Places: signposts to the nearest places, quests, and the quest flight ===== */
const MQ_NAME=['Grand Mosque','Blue Mosque','Turquoise Mosque','Green Mosque'];
const LM_NAME={museum:'Museum of Islamic Heritage',charbagh:'Charbagh Garden',village:'Village',caravan:'Caravanserai',orchard:'Orchard',vineyard:'Vineyard',flowers:'Flower Garden'};
const lmName=l=>l.t==='mosque'?(l.id<100?MQ_NAME[l.v]:'Mosque'):LM_NAME[l.t];
let placeBase=null;
function placesNear(x,z){
 if(!placeBase)placeBase=fixedList().map(l=>({n:lmName(l),x:l.x,z:l.z})).concat([{n:'Lake',x:LAKE.x,z:LAKE.z},{n:'Open Air Prison',x:GZ.x,z:GZ.z}]);
 const out=placeBase.slice(),rx=Math.floor(x/RG),rz=Math.floor(z/RG);
 for(let a=rx-2;a<=rx+2;a++)for(let b=rz-2;b<=rz+2;b++){const l=lmCell(a,b);if(l)out.push({n:lmName(l),x:l.x,z:l.z})}
 for(const p of out)p.d=Math.hypot(p.x-x,p.z-z);
 return out.filter(p=>p.d>14).sort((p,q)=>p.d-q.d).slice(0,3);
}
/* the start sign lists the main attractions (nearest first) rather than just the three nearest places */
const START_PL=['Lake','Grand Mosque','Museum of Islamic Heritage','Charbagh Garden','Open Air Prison'];
function startPlaces(){placesNear(0,0);return START_PL.map(n=>placeBase.find(p=>p.n===n)).filter(Boolean).map(p=>({n:p.n,x:p.x,z:p.z,d:Math.hypot(p.x-START_SIGN.x,p.z-START_SIGN.z)})).sort((a,b)=>a.d-b.d)}
/* --- signposts: at most one per SG x SG cell, on dry open ground away from landmarks, the plot and the Open Air Prison --- */
const SG=56,signMemo=new Map(),START_SIGN={x:1023,z:1023};
function signCell(gx,gz){
 if(gx<0||gz<0||gx>=Math.ceil(WX/SG)||gz>=Math.ceil(WZ/SG))return null;
 const k=gx*64+gz;let s=signMemo.get(k);if(s!==undefined)return s;
 s=null;
 /* the start sign: two steps ahead of the start, to the right of the view of the Grand Mosque, so the first view shows it */
 if(gx===Math.floor(START_SIGN.x/SG)&&gz===Math.floor(START_SIGN.z/SG)){s={x:START_SIGN.x,z:START_SIGN.z,top:groundTop(START_SIGN.x,START_SIGN.z),k,b:2,pl:startPlaces()};signMemo.set(k,s);return s}
 for(let t=0;t<3&&!s;t++){
  const x=gx*SG+6+Math.floor(hash2(gx,gz,SEED+90+t)*(SG-12)),z=gz*SG+6+Math.floor(hash2(gx,gz,SEED+93+t)*(SG-12));
  const top=groundTop(x,z);
  if(top<=WL+1||CI.fl||CI.hm>.3||nearPlot(x,z,5)||inAvenue(x,z)||gzD(x,z)<GZ.moat+3||Math.hypot(x-START.x,z-START.z)<12)continue;
  let ok=true;for(let dx=-1;dx<=1&&ok;dx++)for(let dz=-1;dz<=1;dz++)if(Math.abs(groundTop(x+dx,z+dz)-top)>1){ok=false;break}
  if(ok)s={x,z,top,k,b:3};
 }
 signMemo.set(k,s);return s;
}
/* called at the end of genChunk (chunkLms is not needed any more there) */
function genSigns(x0,z0){
 for(let gz=Math.floor(z0/SG);gz<=Math.floor((z0+15)/SG);gz++)for(let gx=Math.floor(x0/SG);gx<=Math.floor((x0+15)/SG);gx++){
  const s=signCell(gx,gz);if(!s||s.x<x0||s.x>=x0+16||s.z<z0||s.z>=z0+16)continue;
  for(let y=1;y<s.b;y++)put(s.x,s.top+y,s.z,B.WOOD);put(s.x,s.top+s.b,s.z,B.SIGN);
 }
}
let signEls=null,signT=0,signNear=[],ctlTop=1e4;
function updateSigns(dt){
 if(!signEls){signEls=[];const box=$('tags');for(let i=0;i<2;i++){const d=document.createElement('div');d.className='ntag sign';d.style.display='none';box.appendChild(d);signEls.push({d,key:'',shown:false,w:0,h:0})}}
 const on=playing&&!curModal&&!FLY;
 signT-=dt;
 if(on&&signT<=0){signT=.5;signNear.length=0;
  /* labels stay above the touch buttons (Place / Jump) */
  {const m=$('btnMode').getBoundingClientRect();ctlTop=touchMode&&m.height?m.top:vh}
  const gx=Math.floor(player.x/SG),gz=Math.floor(player.z/SG);
  for(let a=gx-1;a<=gx+1;a++)for(let b=gz-1;b<=gz+1;b++){const s=signCell(a,b);if(!s)continue;const d=Math.hypot(s.x+.5-player.x,s.z+.5-player.z);
   if(d<18&&chunkAt(s.x>>4,s.z>>4)&&getB(s.x,s.top+s.b,s.z)===B.SIGN){if(!s.pl)s.pl=placesNear(s.x,s.z);signNear.push({s,d})}}
  signNear.sort((p,q)=>p.d-q.d);
 }
 const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw),rx=Math.cos(player.yaw),rz=-Math.sin(player.yaw);
 for(let i=0;i<signEls.length;i++){
  const E=signEls[i],n=on?signNear[i]:null;let show=false;
  if(n){const s=n.s,p=project(s.x+.5,s.top+s.b+1.1,s.z+.5);
   if(p){const x=(p[0]*.5+.5)*vw,y=(.5-p[1]*.5)*vh;
    if(x>-80&&x<vw+80&&y>-60&&y<vh){show=true;
     if(!E.shown){E.shown=true;E.d.style.display='block';E.w=0}
     const key=s.k+':'+s.pl.map(q=>Math.round(Math.hypot(q.x-player.x,q.z-player.z)/5)).join(',');
     if(key!==E.key){E.key=key;E.d.innerHTML='<span>'+s.pl.map(q=>`<em><i>\u2191</i>${q.n} \u00b7 ${Math.round(Math.hypot(q.x-player.x,q.z-player.z))} m</em>`).join('')+'</span>';E.w=0;E.ar=E.d.querySelectorAll('i')}
     /* measured while shown, so the first frame is already placed inside the screen */
     if(!E.w){E.w=E.d.offsetWidth;E.h=E.d.offsetHeight}
     s.pl.forEach((q,j)=>{const dx=q.x-player.x,dz=q.z-player.z;E.ar[j].style.transform=`rotate(${Math.atan2(dx*rx+dz*rz,dx*fx+dz*fz)*57.2958|0}deg)`});
     E.d.style.transform=`translate(${clamp(x-E.w/2,6,vw-E.w-6)|0}px,${clamp(y-E.h,hudBot,ctlTop-E.h-6)|0}px)`;
    }}}
  if(!show&&E.shown){E.shown=false;E.d.style.display='none'}
 }
}
/* --- quests --- */
const lmOf=(t,v)=>fixedList().find(l=>l.t===t&&(v===undefined||l.v===v));
function landNear(l){
 /* outside the landmark on the side that faces the start, looking at it */
 const dx=SPAWN.x-l.x,dz=SPAWN.z-l.z,n=Math.hypot(dx,dz)||1,r=Math.max(l.ex,l.ez)+7;
 return[l.x+dx/n*r,l.z+dz/n*r,Math.atan2(dx/n,dz/n),-.05];
}
const inType=t=>{gatherLms(player.x-1,player.z-1,player.x+1,player.z+1);return chunkLms.some(l=>l.t===t&&Math.abs(player.x-l.x)<=l.ex-1&&Math.abs(player.z-l.z)<=l.ez-1)};
const QUESTS=[
 {n:'Mosque Visit',d:'Fly to the Grand Mosque and step inside.',to:()=>[941.5,995.5,Math.PI/2,-.05],done:()=>inType('mosque')},
 {n:'Museum Visit',d:'Fly to the Museum of Islamic Heritage and walk in through its doors.',to:()=>landNear(lmOf('museum')),done:()=>mFloor>=0},
 {n:'Save the Muslims from Drone Attacks in the Open Air Prison',d:'Fly to the Open Air Prison, build a shelter with a roof and keep 5 people safe in a drone attack.',to:()=>[GZ.x+.5,GZ.z+GZ.hz-4.5,0,-.15],done:()=>!!(S.gz.ms&1)},
 {n:'Garden Walk',d:'Walk among the four water channels of the Charbagh Garden.',to:()=>landNear(lmOf('charbagh')),done:()=>inType('charbagh')},
 {n:'Lake Swim',d:'Take a swim in the lake near the start.',to:()=>[LAKE.x+.5,LAKE.z+15.5,0,-.2],done:()=>player.water&&Math.hypot(player.x-LAKE.x,player.z-LAKE.z)<30},
 {n:'Caravanserai Visit',d:'Visit the caravanserai, the inn where desert travellers rested.',to:()=>landNear(lmOf('caravan')),done:()=>inType('caravan')}];
let questT=0;
function questTick(dt){
 questT-=dt;if(questT>0||FLY)return;questT=.5;
 for(let i=0;i<QUESTS.length;i++){if(S.q&(1<<i))continue;
  if(QUESTS[i].done()){S.q|=1<<i;S.stars+=2;updateHud();sfx.chime();confetti();toast(`Quest complete: ${QUESTS[i].n}! +2 stars`);queueSave()}}
}
function questPanel(){
 const n=QUESTS.filter((q,i)=>S.q&(1<<i)).length;
 modal(`<h2>Quests</h2><p>${n} of ${QUESTS.length} done. Tap a quest to fly there.</p><div class="qlist">${QUESTS.map((q,i)=>{const ok=S.q&(1<<i);
  return`<button class="qitem${ok?' ok':''}" data-q="${i}"><b>${q.n}</b><span>${q.d}</span><em>${ok?'✓ Done · fly again':'Fly there'}</em></button>`}).join('')}</div>
  <div class="row"><button class="btn" data-a="ok">Close</button></div>`,p=>{
  p.querySelector('[data-a=ok]').onclick=closeModal;
  p.querySelectorAll('.qitem').forEach(b=>b.onclick=()=>{const q=QUESTS[+b.dataset.q];closeModal();const t=q.to();flyTo(t[0],t[1],t[2],t[3],q.n)});
 });
}
/* --- the flight: an eased arc over the world, then a safe landing --- */
let FLY=null;
function flyTo(x,z,yaw,pitch,name){
 const d=Math.hypot(x-player.x,z-player.z),ty=groundTop(Math.floor(x),Math.floor(z))+2;
 FLY={t:0,dur:clamp(d/80,1.6,4.5),a:[player.x,player.y,player.z,player.yaw,player.pitch],b:[x,ty,z,yaw,pitch],
  lift:Math.max(10,Math.min(40,d*.12))+Math.max(0,Math.max(player.y,ty)-player.y)*.5,head:Math.atan2(-(x-player.x),-(z-player.z)),name};
 input.jx=input.jy=0;input.jump=false;
}
function flyStep(dt){
 const f=FLY;f.t+=dt;const k=Math.min(1,f.t/f.dur),e=smooth(k);
 player.x=lerp(f.a[0],f.b[0],e);player.z=lerp(f.a[2],f.b[2],e);player.y=lerp(f.a[1],f.b[1],e)+f.lift*Math.sin(Math.PI*k);
 const yw=k<.65?f.head:f.b[3];let dy=yw-player.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));player.yaw+=dy*Math.min(1,dt*4);
 player.pitch+=((k<.75?-.42:f.b[4])-player.pitch)*Math.min(1,dt*3);
 player.vx=player.vy=player.vz=0;player.ground=false;
 if(k>=1){FLY=null;forceLoad(Math.floor(f.b[0]/16),Math.floor(f.b[2]/16),2);placeSafe(f.b[0],f.b[2],f.b[3],f.b[4]);if(f.name)toast(f.name)}
}
/* test hooks */
window.__signs=(x,z,r)=>{const out=[],gx=Math.floor(x/SG),gz=Math.floor(z/SG),R=r||1;for(let a=gx-R;a<=gx+R;a++)for(let b=gz-R;b<=gz+R;b++){const s=signCell(a,b);if(s)out.push({x:s.x,z:s.z,top:s.top,b:s.b,pl:(s.pl||placesNear(s.x,s.z)).map(p=>p.n)})}return out};
window.__quests=()=>({done:S.q,fly:!!FLY,list:QUESTS.map((q,i)=>({n:q.n,to:q.to(),ok:!!(S.q&(1<<i))}))});

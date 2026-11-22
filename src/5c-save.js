/* ===== 7b. Save and resume: IndexedDB per-chunk edits + small localStorage progress record ===== */
const JRN_KEY='musliMineCraft_jrn_v1',PROG_KEY='musliMineCraft_prog_v1',DB_NAME='musliMineCraft',SAVE_CAP=1500000;
const SV={ready:false,has:false,pos:null,useLs:false,changed:false,acc:0,lastBot:-99999,lastLs:-99999,px:0,pz:0,sum:null,migrated:false,tries:0,ver:4,writer:null,importing:false,progOk:true,lockQ:[],release:null,bc:null,merge:false};
function encMap(mp){const out=[];for(const[k,m]of mp){if(!m.size)continue;const a=[];for(const[li,b]of m)a.push(li*64+b);out.push([k,a])}return out}
function countBlocks(){let n=0;for(const m of edits.values())for(const b of m.values())if(b)n++;return n}
function queueSave(){if(netGuest())return;SV.changed=true;if(!saveTimer)saveTimer=setTimeout(saveNow,2000)}
function progObj(){
 const blocks=countBlocks();
 SV.sum={stars:S.stars,mission:Math.min(S.mission+1,MISSIONS.length),blocks,rank:rankOf(S.stars)};
 return{v:4,stars:S.stars,mission:S.mission,unlocked:S.unlocked,skills:S.skills,settings:S.settings,sel:S.sel,mode:S.mode,
  pos:(playing||glide)?(liftSavePos()||[player.x,player.y,player.z,player.yaw,player.pitch]):(SV.pos||null),day:(playing||glide)?dayT:(SV.dayKeep===undefined?dayT:SV.dayKeep),playT:Math.floor(S.playT),act:Math.floor(activeSec),
  prayer:S.prayer,pass:S.pass,passFl:S.passFl,title:S.title,gz:S.gz,q:S.q,bd:botSaveState(),sum:SV.sum,idb:PERSIST.ok?1:0,ts:Date.now()};
}
function saveProg(){if(SV.importing||SV.writer!==true)return false;try{localStorage.setItem(PROG_KEY,JSON.stringify(progObj()));return true}catch(e){return false}}
function notifySave(){
 const s=SV.sum;if(!s)return;
 try{if(window.musliMineCraft&&typeof window.musliMineCraft.onSave==='function')window.musliMineCraft.onSave({stars:s.stars,mission:s.mission,blocks:s.blocks,time:Date.now()})}catch(e){}
 /* the summary goes only to origins the host listed in window.musliMineCraftAllowedOrigins (never '*') */
 try{const ao=window.musliMineCraftAllowedOrigins;if(Array.isArray(ao)&&window.parent&&window.parent!==window)for(const o of ao)if(typeof o==='string'&&o&&o!=='*')window.parent.postMessage({type:'musliMineCraft:save',stars:s.stars,mission:s.mission,blocks:s.blocks},o)}catch(e){}
}
/* IndexedDB writes started right before the page unloads can be dropped, so the edited chunks that are not yet confirmed are
   also kept in a small synchronous journal (localStorage) that the next start merges and removes */
const pend=new Set();
function jrnWrite(){
 try{
  if(!pend.size){localStorage.removeItem(JRN_KEY);return}
  const a=[];let n=0;
  for(const k of pend){const m=edits.get(k),b=[];if(m)for(const[li,v]of m)b.push(li*64+v);a.push([k,b]);n+=b.length}
  if(n>40000){localStorage.removeItem(JRN_KEY);return}
  localStorage.setItem(JRN_KEY,JSON.stringify(a));
 }catch(e){}
}
function saveFail(){
 if(!PERSIST.ok&&SV.useLs)return;
 PERSIST.ok=false;SV.useLs=true;
 for(const k of edits.keys())PERSIST.dirty.add(k);
 PERSIST.botDirty=true;saveFallback(true);
}
/* batched write of only the edited chunks (one transaction) */
function flushStore(urgent,cb){
 const fin=()=>{if(cb)cb()};
 if(!PERSIST.ok||!PERSIST.db){fin();return}
 const now=performance.now(),doBot=PERSIST.botDirty&&(urgent||now-SV.lastBot>14000);
 const migOk=()=>{if(SV.migrated&&SV.progOk){SV.migrated=false;try{localStorage.removeItem(OLD_KEY)}catch(e){}}};
 if(!PERSIST.dirty.size&&!doBot){migOk();notifySave();fin();return}
 try{
  const keys=[...PERSIST.dirty];for(const k of keys)pend.add(k);jrnWrite();
  const tx=PERSIST.db.transaction(['c','m'],'readwrite'),c=tx.objectStore('c'),clr=PERSIST.clr;
  for(const k of PERSIST.dirty){
   const m=edits.get(k);
   if(SV.merge){
    /* no Web Locks: merge with what another tab stored, inside this one transaction */
    const rq=c.get(k);
    rq.onsuccess=()=>{const o=new Map();
     if(Array.isArray(rq.result))for(const v of rq.result){const li=v>>6;if(!clr.has(k*CV+li))o.set(li,v&63)}
     if(m)for(const[li,b]of m)o.set(li,b);
     if(o.size){const a=[];for(const[li,b]of o)a.push(li*64+b);c.put(a,k)}else c.delete(k)};
   }else if(m&&m.size){const a=[];for(const[li,b]of m)a.push(li*64+b);c.put(a,k)}else c.delete(k);
  }
  PERSIST.dirty.clear();
  if(doBot){tx.objectStore('m').put(encMap(bedits),'bot');PERSIST.botDirty=false;SV.lastBot=now}
  tx.onerror=tx.onabort=()=>{saveFail();fin()};
  tx.oncomplete=()=>{PERSIST.cnt=0;clr.clear();for(const k of keys)pend.delete(k);if(!pend.size&&!PERSIST.dirty.size)try{localStorage.removeItem(JRN_KEY)}catch(e){}else jrnWrite();migOk();notifySave();fin()};
 }catch(e){saveFail();fin()}
}
/* the older compact scheme, used only when IndexedDB is unavailable or failed */
function saveFallback(force){
 const now=performance.now();if(!force&&now-SV.lastLs<4000)return;SV.lastLs=now;
 const d={v:4,ed:encMap(edits),bed:encMap(bedits)};
 let str=JSON.stringify(d);
 while(str.length>SAVE_CAP&&botLog.length){
  const n=Math.min(botLog.length,Math.max(400,botLog.length>>2)&~1);
  trimBotLog(n);d.bed=encMap(bedits);str=JSON.stringify(d);
 }
 if(str.length>SAVE_CAP){if(!saveNotice){saveNotice=true;toast('World too big to save fully')}return}
 try{localStorage.setItem(SAVE_KEY,str)}catch(e){if(!saveNotice){saveNotice=true;toast('Could not save the world on this device')}}
 PERSIST.dirty.clear();PERSIST.botDirty=false;notifySave();
}
function saveNow(urgent,cb){
 saveTimer=0;SV.changed=false;SV.px=player.x;SV.pz=player.z;
 /* a guest plays in the host's world: nothing of it belongs in this device's save */
 if(netGuest()){if(cb)cb();return}
 if(!SV.ready||SV.importing||SV.writer!==true)return;
 if(playing||glide||SV.migrated||SV.has)SV.progOk=saveProg();
 if(PERSIST.ok)flushStore(urgent===true,cb);else{saveFallback(urgent===true);if(cb)cb()}
}
/* ---- one writer at a time (Web Locks); other tabs show an overlay and can take over ---- */
function setWriter(v){
 SV.writer=v;if(!v)showOther();
 const q=SV.lockQ;SV.lockQ=[];for(const f of q)f();
}
function afterLock(f){if(SV.writer!==null)f();else SV.lockQ.push(f)}
function showOther(){
 let o=document.getElementById('othertab');
 if(!o){o=document.createElement('div');o.id='othertab';
  o.style.cssText='position:fixed;left:0;top:0;width:100%;height:100%;z-index:99999;background:rgba(8,61,68,.94);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;font:700 20px/1.3 system-ui,sans-serif;padding:20px';
  o.innerHTML='<div>musliMineCraft is open in another tab.</div><div style="font-weight:400;font-size:16px">Only one tab can save your world at a time.</div><button style="background:#2a9d6b;color:#fff;border:2px solid #fff;border-radius:999px;padding:10px 24px;font:800 18px system-ui;min-height:48px">Play here</button>';
  o.querySelector('button').onclick=()=>{
   if(SV.bc)try{SV.bc.postMessage('take')}catch(e){}
   try{navigator.locks.request('musliMineCraft-writer',()=>{location.reload();return new Promise(()=>{})})}catch(e){location.reload()}
  };
  document.body.appendChild(o)}
 o.style.display='flex';
}
function lockInit(){
 if(!(navigator.locks&&navigator.locks.request)){SV.merge=true;setWriter(true);return}
 try{
  if(window.BroadcastChannel){SV.bc=new BroadcastChannel('musliMineCraft');
   SV.bc.onmessage=m=>{if(m.data==='take'&&SV.writer===true)saveNow(true,()=>{SV.writer=false;if(SV.release)SV.release();showOther()})}}
  const ac=window.AbortController?new AbortController():null,to=setTimeout(()=>{if(ac)ac.abort()},3000);
  navigator.locks.request('musliMineCraft-writer',ac?{signal:ac.signal}:{ifAvailable:true},lock=>{
   clearTimeout(to);
   if(!lock){setWriter(false);return}
   setWriter(true);return new Promise(r=>{SV.release=r});
  }).catch(()=>{if(SV.writer===null)setWriter(false)});
 }catch(e){SV.merge=true;setWriter(true)}
}
function validNum(v,def,lo,hi){v=Number(v);return isFinite(v)?clamp(Math.floor(v),lo,hi):def}
/* progress record -> game state (also reads old v1-v3 saves) */
function applyProg(d){
 if(!d||typeof d!=='object')return false;
 S.stars=validNum(d.stars,0,0,1000000);S.mission=validNum(d.mission,0,0,MISSIONS.length);
 const un=Array.isArray(d.unlocked)?d.unlocked.filter(id=>HOTBAR_IDS.includes(id)):[];
 S.unlocked=[...new Set(STARTER.concat(un))];
 const sk=d.skills&&typeof d.skills==='object'?d.skills:{};
 for(const k of Object.keys(S.skills))S.skills[k]=validNum(sk[k],0,0,1000000);
 const st=d.settings&&typeof d.settings==='object'?d.settings:{};
 S.settings.sound=st.sound!==false;S.settings.sens=validNum(st.sens,3,1,6);S.settings.gfx=st.gfx==='low'||st.gfx==='high'?st.gfx:'auto';
 if(HOTBAR_IDS.includes(d.sel)&&S.unlocked.includes(d.sel))S.sel=d.sel;
 S.mode=d.mode==='break'?'break':'place';
 if(typeof d.day==='number'&&isFinite(d.day))dayT=clamp(d.day,0,.999);
 if(typeof d.pass==='string'&&/^[012]{26}$/.test(d.pass))S.pass=d.pass;
 if(Array.isArray(d.passFl)&&d.passFl.length===4)S.passFl=d.passFl.map(v=>v?1:0);
 const prayer=d.prayer;
 S.prayer={time:validNum(prayer?.time,0,0,599.999),waqt:Math.floor(validNum(prayer?.waqt,0,0,4)),done:prayer?.done===true};
 S.title=!!d.title;S.playT=validNum(d.playT,0,0,1e9);SV.act=validNum(d.act,0,0,1e9);
 {const g=d.gz&&typeof d.gz==='object'?d.gz:{};S.gz={pts:validNum(g.pts,0,0,1e9),best:validNum(g.best,0,0,24),ms:validNum(g.ms,0,0,31),seen:!!g.seen}}
 S.q=validNum(d.q,0,0,63);
 botLoadState(Array.isArray(d.bd)?d.bd:null);
 const p=d.pos;
 SV.hasP=Array.isArray(p)||d.stars>0||d.mission>0||!!(d.sum&&d.sum.blocks>0);
 SV.pos=(d.v>=3&&Array.isArray(p)&&p.length===5&&p.every(v=>typeof v==='number'&&isFinite(v))&&p[0]>8&&p[0]<WX-8&&p[2]>8&&p[2]<WZ-8&&p[1]>=1&&(p[1]<H-2||LIFT_SITES.some(e=>e.stops.some(q=>q.y===p[1]&&q.x===p[0]&&q.z===p[2]))))?p.slice():null;
 if(d.sum&&typeof d.sum==='object')SV.sum={stars:validNum(d.sum.stars,0,0,1e9),mission:validNum(d.sum.mission,1,1,99),blocks:validNum(d.sum.blocks,0,0,1e9),rank:typeof d.sum.rank==='string'?d.sum.rank.slice(0,24):''};
 return true;
}
function loadBlob(raw,mark){
 try{
  const d=JSON.parse(raw);if(!d||typeof d!=='object')return false;
  applyEdits(d.ed,edits,false);applyEdits(d.bed,bedits,true);
  if(mark){for(const k of edits.keys())PERSIST.dirty.add(k);PERSIST.botDirty=bedits.size>0}
  worldDirty=edits.size>0||bedits.size>0;return d;
 }catch(e){edits.clear();bedits.clear();blClear();return false}
}
function readStores(done){
 let fin=false;const end=ok=>{if(fin)return;fin=true;PERSIST.ok=ok;SV.useLs=!ok;afterLock(()=>{SV.ready=true;done()})};
 try{
  if(!window.indexedDB){end(false);return}
  const rq=indexedDB.open(DB_NAME,2);
  rq.onupgradeneeded=()=>{const d=rq.result;if(!d.objectStoreNames.contains('c'))d.createObjectStore('c');if(!d.objectStoreNames.contains('m'))d.createObjectStore('m');if(!d.objectStoreNames.contains('w'))d.createObjectStore('w')};
  rq.onerror=rq.onblocked=()=>end(false);
  rq.onsuccess=()=>{
   if(fin){try{rq.result.close()}catch(e){}return}
   try{
    PERSIST.db=rq.result;PERSIST.db.onversionchange=()=>{try{PERSIST.db.close()}catch(e){}PERSIST.ok=false;SV.useLs=true};
    const tx=PERSIST.db.transaction(['c','m'],'readonly'),list=[];
    const cur=tx.objectStore('c').openCursor();
    cur.onsuccess=()=>{const c=cur.result;if(c){list.push([c.key,c.value]);c.continue()}};
    const bq=tx.objectStore('m').get('bot');
    tx.oncomplete=()=>{
     if(fin)return;
     try{
      const good=list.filter(e=>Number.isInteger(e[0])&&Array.isArray(e[1]));
      /* chunk records win over anything the old localStorage blob held */
      for(const e of good)edits.delete(e[0]);
      applyEdits(good,edits,false);
      if(Array.isArray(bq.result)){bedits.clear();blClear();applyEdits(bq.result,bedits,true)}
      worldDirty=edits.size>0||bedits.size>0;
     }catch(e){}
     end(true);
    };
    tx.onerror=tx.onabort=()=>end(false);
   }catch(e){end(false)}
  };
  setTimeout(()=>end(false),4000);
 }catch(e){end(false)}
}
/* sync part (progress) now, edits async; the loader waits for SV.ready */
function storeInit(){
 lockInit();
 let raw=null,old=null,blob=null;
 try{raw=localStorage.getItem(PROG_KEY);old=localStorage.getItem(OLD_KEY);blob=localStorage.getItem(SAVE_KEY)}catch(e){}
 let had=false;
 if(raw){try{had=applyProg(JSON.parse(raw))}catch(e){had=false}}
 if(blob)loadBlob(blob,true);
 if(!had&&old){
  /* one-time migration of an IslamineCraft save */
  try{const d=JSON.parse(old);if(d&&typeof d==='object'&&(d.v===1||d.v===2||d.v===3)){
   if(d.v===3){applyEdits(d.ed,edits,false);applyEdits(d.bed,bedits,true);for(const k of edits.keys())PERSIST.dirty.add(k);PERSIST.botDirty=bedits.size>0;worldDirty=true}
   had=applyProg(d);SV.migrated=true}}catch(e){}
 }
 SV.has=had&&SV.hasP;
 SV.px=player.x;SV.pz=player.z;
 readStores(()=>{
  if(SV.ready&&typeof window.__svReady==='function')window.__svReady();
  /* after the async load the blueprint progress may have changed */
  if(typeof startMission==='function'&&S.mission<=MISSIONS.length){try{startMission(S.mission,false);updateHud()}catch(e){}}
  /* edits that were journaled when the last page was closed abruptly */
  try{const j=localStorage.getItem(JRN_KEY);if(j){const a=JSON.parse(j);if(Array.isArray(a)){
   const good=a.filter(e=>Array.isArray(e)&&Number.isInteger(e[0])&&Array.isArray(e[1]));
   for(const e of good){edits.delete(e[0]);PERSIST.dirty.add(e[0])}
   applyEdits(good,edits,false);worldDirty=true;for(const e of good)pend.add(e[0])}}}catch(e){}
  if(SV.migrated||(blob&&PERSIST.ok)||PERSIST.dirty.size){saveNow(true,()=>{if(blob&&PERSIST.ok&&!PERSIST.dirty.size&&!PERSIST.botDirty)try{localStorage.removeItem(SAVE_KEY)}catch(e){}})}
  if(SV.migrated&&!PERSIST.ok&&SV.writer===true){saveFallback(true);if(SV.progOk||saveProg()){try{localStorage.removeItem(OLD_KEY)}catch(e){}SV.migrated=false}}
 });
}
function saveTick(dt){
 S.playT+=dt;SV.acc+=dt;
 if(SV.acc>=15){SV.acc=0;if(SV.changed||S.prayer.time>0||Math.hypot(player.x-SV.px,player.z-SV.pz)>1.5)saveNow(false)}
}
/* a saved position that is now inside a block or water is moved upward; spawn only when nothing works */
function restorePos(){
 const p=SV.pos;if(!p)return false;
 if(liftRestorePos(p))return true;
 const ok=placeSafe(p[0],p[2],p[3],clamp(p[4],-1.45,1.45),p[1]);
 if(!ok)spawnPlayer();
 return ok;
}
function wipeStores(){
 try{localStorage.removeItem(PROG_KEY);localStorage.removeItem(SAVE_KEY);localStorage.removeItem(JRN_KEY);pend.clear();localStorage.removeItem(OLD_KEY)}catch(e){}
 return new Promise(res=>{
  if(!PERSIST.db){res();return}
  try{const tx=PERSIST.db.transaction(['c','m'],'readwrite');tx.objectStore('c').clear();tx.objectStore('m').clear();tx.oncomplete=tx.onerror=tx.onabort=()=>res()}catch(e){res()}
 });
}
/* ---- embedding API ---- */
function exportSave(){
 return new Promise(res=>{res(JSON.stringify({musliMineCraft:4,prog:progObj(),ed:encMap(edits),bed:encMap(bedits)}))});
}
function importSave(json){
 return new Promise((res,rej)=>{
  if(SV.writer===false){rej(new Error('Another tab is saving this world'));return}
  if(typeof json!=='string'||json.length>20000000){rej(new Error('Save is too big'));return}
  let d;try{d=JSON.parse(json)}catch(e){rej(new Error('Not valid JSON'));return}
  if(!d||typeof d!=='object'||d.musliMineCraft!==4||!d.prog||typeof d.prog!=='object'||!Array.isArray(d.ed)||!Array.isArray(d.bed)){rej(new Error('Not a musliMineCraft save'));return}
  /* validate exactly like the loader: every record needs a chunk key and cell codes inside the world and the block range */
  const okCell=v=>Number.isSafeInteger(v)&&v>=0&&v<CV*64&&(v&63)<DEFS.length;
  const chk=l=>l.filter(e=>Array.isArray(e)&&Number.isInteger(e[0])&&e[0]>=0&&e[0]<NC*NC&&Array.isArray(e[1])).map(e=>[e[0],e[1].filter(okCell)]);
  const ed=chk(d.ed),bed=chk(d.bed);
  if(!Number.isFinite(Number(d.prog.stars))||Math.abs(Number(d.prog.stars))>1e9){rej(new Error('Bad progress record'));return}
  const prog=JSON.stringify(d.prog);
  if(prog.length>200000){rej(new Error('Bad progress record'));return}
  /* from here the running game must not write anything over the import */
  SV.importing=true;if(saveTimer){clearTimeout(saveTimer);saveTimer=0}
  let oldProg=null;try{oldProg=localStorage.getItem(PROG_KEY)}catch(e){}
  const fail=e=>{try{if(oldProg===null)localStorage.removeItem(PROG_KEY);else localStorage.setItem(PROG_KEY,oldProg)}catch(x){}SV.importing=false;rej(e)};
  try{localStorage.setItem(PROG_KEY,prog)}catch(e){fail(new Error('Could not store the progress'));return}
  const finish=()=>{
   try{localStorage.removeItem(JRN_KEY);localStorage.removeItem(OLD_KEY);pend.clear()}catch(e){}
   res(true);setTimeout(()=>location.reload(),40);
  };
  if(PERSIST.ok&&PERSIST.db){
   try{
    /* one transaction: either the whole import is stored or nothing changes */
    const tx=PERSIST.db.transaction(['c','m'],'readwrite'),c=tx.objectStore('c'),m=tx.objectStore('m');
    c.clear();m.clear();
    for(const e of ed)if(e[1].length)c.put(e[1],e[0]);
    m.put(bed,'bot');
    tx.oncomplete=()=>{try{localStorage.removeItem(SAVE_KEY)}catch(e){}finish()};
    tx.onerror=tx.onabort=()=>fail(new Error('Could not store the save'));
   }catch(e){fail(e)}
  }else{
   try{localStorage.setItem(SAVE_KEY,JSON.stringify({v:4,ed,bed}));finish()}catch(e){fail(e)}
  }
 });
}
window.musliMineCraft={exportSave,importSave,onSave:null,version:4};
window.IslamineCraft=window.musliMineCraft;
/* A host page may import a save by posting {type:'musliMineCraft:import',json}. It is accepted only when ALL hold:
   window.musliMineCraftAllowImport===true, the sender is window.parent, and its origin is listed in window.musliMineCraftAllowedOrigins
   (an array the host sets; there is no default). The save summary is posted back only to those listed origins. */
window.addEventListener('message',e=>{
 const d=e.data;
 if(!d||d.type!=='musliMineCraft:import'||typeof d.json!=='string')return;
 const ao=window.musliMineCraftAllowedOrigins;
 if(window.musliMineCraftAllowImport!==true||!Array.isArray(ao)||!ao.length||e.source!==window.parent||ao.indexOf(e.origin)<0)return;
 importSave(d.json).catch(()=>{});
});

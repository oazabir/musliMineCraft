/* ===== 7e. Command console, world slots and serverless multiplayer (WebRTC) ===== */
const WORLDS_KEY='musliMineCraft_worlds_v1',ACTIVE_KEY='musliMineCraft_active_v1',SLOT_PREFIX='musliMineCraft_w_';
let WORLDS=[],WACT='';
const CON={on:false,hist:[],hi:0};
/* NET is a var so the guards in earlier parts (netGuest) are safe before this line has run */
var NET={on:false,role:'',guest:false,me:'',peers:[],players:new Map(),lanes:new Map(),pending:null,invite:'',tick:0,q:[],sent:[],sim:false,seq:0,laneSeq:0,lane:0,entered:false,lost:0,ka:0,gen:0};
/* one lane is one invite: every friend answers its own, so a lobby can hold many players */
const NET_MAX=8,NET_SEND=.07,NET_LANE_TTL=1800000,NET_GRACE=15000,NET_STALE=45000,NET_CONNECT=25000,NET_WAIT=90000;
/* the guest's reconnection watchdog; a module let so it can be cleared from anywhere */
let NET_LOST_T=0;
/* an invite that arrived in a #join= link, waiting for the join card to show it */
let NET_PRE='';
function netGuest(){return !!(NET&&NET.guest)}
/* ---- console ---- */
function conLog(txt,cls){
 const l=$('conLog');if(!l)return;
 const d=document.createElement('div');if(cls)d.className=cls;d.textContent=txt;
 l.appendChild(d);while(l.childNodes.length>160)l.removeChild(l.firstChild);
 l.scrollTop=l.scrollHeight;
}
function conCopy(t,b){
 const done=ok=>{if(b)b.textContent=ok?'Copied':'Select it'};
 try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(()=>done(true),()=>done(false));return}}catch(e){}
 done(false);
}
/* the invite as a link: opening it fills the code into the join card, so a guest only taps Join */
function netLink(code){return String(location.href).split('#')[0]+'#join='+code}
function netShareCard(link){
 if(navigator.share){
  try{navigator.share({title:'musliMineCraft',text:'Join my musliMineCraft world',url:link}).catch(()=>{});return}catch(e){}
 }
 conLog('This browser has no share sheet. Use Copy link instead.','er');
}
/* a code is long, so it lives in a selectable box with copy and, where the browser has one, a share sheet */
function conCode(label,txt,link){
 conLog(label);
 const box=document.createElement('div');box.className='ccode';
 const ta=document.createElement('textarea');ta.readOnly=true;ta.rows=2;ta.className='cta';ta.value=txt;ta.setAttribute('aria-label',label);
 ta.onfocus=()=>{try{ta.select()}catch(e){}};
 const b=document.createElement('button');b.type='button';b.className='conBtn';b.textContent='Copy';
 b.onclick=()=>conCopy(txt,b);
 box.appendChild(ta);box.appendChild(b);
 if(link){
  const lk=document.createElement('button');lk.type='button';lk.className='conBtn';lk.textContent='Copy link';
  lk.onclick=()=>conCopy(link,lk);
  box.appendChild(lk);
  if(navigator.share){
   const sh=document.createElement('button');sh.type='button';sh.className='conBtn';sh.textContent='Share';sh.setAttribute('aria-label','Share the invite link');
   sh.onclick=()=>netShareCard(link);
   box.appendChild(sh);
  }
 }
 const l=$('conLog');l.appendChild(box);l.scrollTop=l.scrollHeight;
}
function conOpen(on){
 const c=$('con');if(!c)return;
 if(on&&curModal)return;
 CON.on=!!on;c.classList.toggle('on',CON.on);
 if(CON.on){
  input.keys.clear();input.jx=input.jy=0;input.jump=false;
  if(document.pointerLockElement)document.exitPointerLock();
  if(!CON.hist.length)conLog('Type /help for the commands. /share opens a lobby for a friend.');
  const i=$('conIn');if(i){i.value='';setTimeout(()=>{try{i.focus()}catch(e){}},30)}
 }else{
  const i=$('conIn');if(i){try{i.blur()}catch(e){}}
  if(!touchMode)relock();
 }
}
function conRun(text){
 const raw=String(text||'').trim();if(!raw)return;
 conLog('> '+raw,'in');CON.hist.push(raw);CON.hi=CON.hist.length;
 const sp=raw.split(/\s+/),name=sp[0].replace(/^\//,'').toLowerCase(),cmd=CMDS[name];
 if(!cmd){conLog('There is no command /'+name+'. Type /help.','er');return}
 try{cmd(raw.slice(sp[0].length).trim())}catch(e){conLog('That command did not work.','er')}
}
const CMDS={
 help(){
  conLog('Commands:');
  conLog('/share: get an invite code for a friend (type it again for another friend)');
  conLog('/join <code>: paste a reply code a friend sends back (one /join per friend)');
  conLog('/players: who is in the lobby');
  conLog('/endstream: close the lobby (you can keep playing alone)');
  conLog('/leave: leave a friend\'s lobby and go back to your world');
 },
 share(){netShare()},
 join(a){netAccept(a)},
 players(){netWho()},
 endstream(){netEnd()},
 leave(){netLeave()}
};
/* ---- worlds: the live store is the world being played, every other world is a slot in IndexedDB ---- */
function worldsInit(){
 try{const j=JSON.parse(localStorage.getItem(WORLDS_KEY)||'[]');if(Array.isArray(j))WORLDS=j.filter(w=>w&&typeof w.id==='string'&&w.id)}catch(e){WORLDS=[]}
 try{WACT=localStorage.getItem(ACTIVE_KEY)||''}catch(e){WACT=''}
 if(!WORLDS.length){WORLDS=[{id:'w1',name:'My world',ts:0,stars:0,mission:0,blocks:0}];WACT='w1';worldsSave()}
 if(!WORLDS.some(w=>w.id===WACT))WACT=WORLDS[0].id;
}
function worldsSave(){
 try{localStorage.setItem(WORLDS_KEY,JSON.stringify(WORLDS));localStorage.setItem(ACTIVE_KEY,WACT)}catch(e){}
}
function worldMetaUpdate(id){
 const w=WORLDS.find(x=>x.id===id);if(!w)return;
 w.ts=Date.now();
 if(id===WACT){
  w.stars=S.stars;w.mission=Math.min(S.mission+1,MISSIONS.length);w.blocks=countBlocks();
 }
}
/* the list on the start screen: one row per world, tap to continue that world */
function worldsList(){
 const box=$('wlist');if(!box)return;
 worldMetaUpdate(WACT);worldsSave();
 box.textContent='';
 for(const w of WORLDS){
  const b=document.createElement('button');b.type='button';b.className='wrow'+(w.id===WACT?' cur':'');
  const t=document.createElement('span'),n=document.createElement('b'),s=document.createElement('small');
  n.textContent=w.name;
  s.textContent=(w.stars||0)+' stars · Mission '+Math.max(1,w.mission||1)+(w.blocks>0?' · '+w.blocks+' blocks':'');
  t.appendChild(n);t.appendChild(s);
  const em=document.createElement('em');em.textContent=w.id===WACT?'Play':'Enter';
  b.appendChild(t);b.appendChild(em);
  b.setAttribute('aria-label',(w.id===WACT?'Continue ':'Enter ')+w.name);
  b.onclick=()=>{if(w.id===WACT){if(!playing)startPlay()}else worldSwitch(w.id)};
  box.appendChild(b);
 }
}
function slotSave(id,data,cb){
 if(PERSIST.ok&&PERSIST.db){
  try{const tx=PERSIST.db.transaction('w','readwrite');tx.objectStore('w').put(data,id);
   tx.oncomplete=()=>{if(cb)cb(true)};tx.onerror=tx.onabort=()=>{if(cb)cb(false)};return}catch(e){}
 }
 try{localStorage.setItem(SLOT_PREFIX+id,JSON.stringify(data));if(cb)cb(true)}catch(e){if(cb)cb(false)}
}
function slotFromLs(id,cb){
 let v=null;
 try{const raw=localStorage.getItem(SLOT_PREFIX+id);if(raw){const j=JSON.parse(raw);if(j&&typeof j==='object')v=j}}catch(e){v=null}
 if(cb)cb(v);
}
function slotLoad(id,cb){
 if(PERSIST.ok&&PERSIST.db){
  try{const tx=PERSIST.db.transaction('w','readonly'),rq=tx.objectStore('w').get(id);
   rq.onsuccess=()=>{if(rq.result)cb(rq.result);else slotFromLs(id,cb)};
   rq.onerror=()=>slotFromLs(id,cb);return}catch(e){}
 }
 slotFromLs(id,cb);
}
function worldInstall(id,data){
 const fin=()=>{
  try{localStorage.removeItem(JRN_KEY);localStorage.removeItem(SAVE_KEY)}catch(e){}
  try{localStorage.setItem(ACTIVE_KEY,id);localStorage.setItem(PROG_KEY,JSON.stringify(data.prog||{v:4}))}catch(e){}
  location.reload();
 };
 const ed=Array.isArray(data.ed)?data.ed.filter(e=>Array.isArray(e)&&Number.isInteger(e[0])&&Array.isArray(e[1])):[];
 const bed=Array.isArray(data.bed)?data.bed.filter(e=>Array.isArray(e)&&Number.isInteger(e[0])&&Array.isArray(e[1])):[];
 if(PERSIST.ok&&PERSIST.db){
  try{
   const tx=PERSIST.db.transaction(['c','m'],'readwrite'),c=tx.objectStore('c'),m=tx.objectStore('m');
   c.clear();m.clear();
   for(const e of ed)if(e[1].length)c.put(e[1],e[0]);
   m.put(bed,'bot');
   tx.oncomplete=fin;tx.onerror=tx.onabort=()=>toast('Could not open that world. Try again.');
   return;
  }catch(e){}
 }
 try{localStorage.setItem(SAVE_KEY,JSON.stringify({v:4,ed,bed}));fin()}catch(e){toast('Could not open that world. Try again.')}
}
/* a world is snapshotted from every stored chunk, not only the chunks that happen to be loaded */
function worldSnapshot(cb){
 const out={prog:progObj(),ed:encMap(edits),bed:encMap(bedits)},have=new Set(out.ed.map(e=>e[0]));
 let sent=false;const done=()=>{if(!sent){sent=true;cb(out)}};
 if(!(PERSIST.ok&&PERSIST.db)){done();return}
 try{
  const tx=PERSIST.db.transaction(['c','m'],'readonly'),rq=tx.objectStore('c').openCursor(),mq=tx.objectStore('m').get('bot');
  rq.onsuccess=()=>{
   const c=rq.result;if(!c)return;
   if(!have.has(c.key)&&Array.isArray(c.value)&&c.value.length){have.add(c.key);out.ed.push([c.key,c.value])}
   c.continue();
  };
  mq.onsuccess=()=>{const v=mq.result;if(Array.isArray(v)&&v.length)out.bed=v};
  tx.oncomplete=done;tx.onerror=tx.onabort=done;
 }catch(e){done()}
}
function worldSwitch(id){
 if(!id)return;
 if(id===WACT){if(!playing)startPlay();return}
 if(NET.on){toast('Type /endstream first, then change worlds.');return}
 const w=WORLDS.find(x=>x.id===id);
 toast('Opening '+(w?w.name:'world')+'…');
 worldSnapshot(cur=>slotSave(WACT,cur,ok=>{
  if(!ok){toast('Could not save this world on this device');return}
  worldMetaUpdate(WACT);worldsSave();
  slotLoad(id,data=>{
   if(!data||typeof data!=='object'){toast('That world could not be opened');return}
   worldInstall(id,data);
  });
 }));
}
function worldNew(){
 if(NET.on){toast('Type /endstream first, then start a new world.');return}
 toast('Starting a new world…');
 worldSnapshot(cur=>slotSave(WACT,cur,ok=>{
  if(!ok){toast('Could not save this world on this device');return}
  worldMetaUpdate(WACT);
  let n=WORLDS.length+1;while(WORLDS.some(w=>w.name==='World '+n))n++;
  const id='w'+Date.now().toString(36);
  WORLDS.push({id:id,name:'World '+n,ts:Date.now(),stars:0,mission:0,blocks:0});
  worldsSave();
  worldInstall(id,{prog:{v:4},ed:[],bed:[]});
 }));
}
/* ---- the lobby: a browser-to-browser WebRTC link, no server. The host world is the real one ---- */
const NET_STUN=[{urls:'stun:stun.l.google.com:19302'}];
function netEnc(o){
 try{
  const s=JSON.stringify(o);let b;
  if(window.TextEncoder){const u=new TextEncoder().encode(s);let t='';for(let i=0;i<u.length;i++)t+=String.fromCharCode(u[i]);b=btoa(t)}
  else b=btoa(unescape(encodeURIComponent(s)));
  return 'MMC1.'+b.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 }catch(e){return ''}
}
/* a paste arrives in a chat message, broken over lines, or as a whole link: find the code inside it */
function netCodeText(text){
 let t=String(text||'').replace(/\s+/g,'');
 const j=t.indexOf('#join=');if(j>=0)t=t.slice(j+6);
 const m=/MM(?:2|C1)\.[A-Za-z0-9_-]+/.exec(t);
 return m?m[0]:t;
}
function netDec(text){
 const t=netCodeText(text);
 if(t.slice(0,4)==='MM2.')return netUnpack(t.slice(4));
 const i=t.indexOf('.');
 if(i<1||t.slice(0,i)!=='MMC1')return null;
 let b=t.slice(i+1).replace(/-/g,'+').replace(/_/g,'/');
 while(b.length%4)b+='=';
 try{
  const raw=atob(b);let s;
  if(window.TextDecoder){const u=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i);s=new TextDecoder().decode(u)}
  else s=decodeURIComponent(escape(raw));
  const o=JSON.parse(s);return o&&typeof o==='object'?o:null;
 }catch(e){return null}
}
/* ---- short codes: an SDP is mostly boilerplate, so only the fields that differ travel and the
   SDP is rebuilt on the far side. MM2 is about 190 characters; an SDP we cannot read falls back to MM C1. ---- */
const NET_SETUP=['actpass','active','passive'],NET_CT=['host','srflx','prflx','relay'];
function netU8(A,v){A.push(v&255)}
function netStr(A,s){netU8(A,s.length);for(let i=0;i<s.length;i++)netU8(A,s.charCodeAt(i))}
function netStrRead(A,o){const n=A[o.p++]||0;let s='';for(let i=0;i<n;i++)s+=String.fromCharCode(A[o.p++]||0);return s}
function netU32Read(A,o){return ((A[o.p++]||0)<<24|(A[o.p++]||0)<<16|(A[o.p++]||0)<<8|(A[o.p++]||0))>>>0}
function netHex(h){if(!/^[0-9a-fA-F]{64}$/.test(h))return null;const a=[];for(let i=0;i<64;i+=2)a.push(parseInt(h.substr(i,2),16));return a}
function net4(s){const m=/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);if(!m)return null;const a=[];for(let i=1;i<5;i++){const v=+m[i];if(v>255)return null;a.push(v)}return a}
function net6(s){
 if(s.indexOf(':')<0||!/^[0-9a-fA-F:.]+$/.test(s))return null;
 const p=s.split('::');if(p.length>2)return null;
 const a=p[0]?p[0].split(':'):[],b=p.length>1?(p[1]?p[1].split(':'):[]):[];
 let g;
 if(p.length>1){if(a.length+b.length>7)return null;g=a.concat(new Array(8-a.length-b.length).fill('0'),b)}
 else{if(a.length!==8)return null;g=a}
 const out=[];
 for(const h of g){const v=parseInt(h,16);if(!isFinite(v)||v<0||v>65535)return null;out.push(v>>8,v&255)}
 return out;
}
function netMdns(s){const m=/^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\.local$/i.exec(s);if(!m)return null;const h=m.slice(1).join(''),a=[];for(let i=0;i<32;i+=2)a.push(parseInt(h.substr(i,2),16));return a}
function netAddr(s){
 const v4=net4(s),v6=net6(s),md=netMdns(s);
 if(v4)return{k:0,b:v4};if(v6)return{k:1,b:v6};if(md)return{k:2,b:md};
 if(/^[\w.-]{4,60}$/.test(s))return{k:3,b:s.toLowerCase().split('').map(c=>c.charCodeAt(0))};
 return null;
}
function netAddrText(k,b){
 if(k===0)return b.length===4?b.join('.'):'';
 if(k===1){if(b.length!==16)return '';const g=[];for(let i=0;i<16;i+=2)g.push(((b[i]<<8)|b[i+1]).toString(16));return g.join(':')}
 if(k===2){if(b.length!==16)return '';const h=b.map(x=>('0'+x.toString(16)).slice(-2)).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)+'.local'}
 return String.fromCharCode.apply(null,b);
}
function netCandPack(A,c){
 const p=c.split(/\s+/);
 if(p.length<8||p[6]!=='typ')return false;
 const ty=NET_CT.indexOf(p[7]),tr=p[2],addr=netAddr(p[4]),pr=Number(p[3]),port=Number(p[5]),comp=Number(p[1])||1;
 if(ty<0||!addr||(tr!=='udp'&&tr!=='tcp')||!isFinite(pr)||pr<0||!isFinite(port)||port<1||port>65535)return false;
 if(addr.k===3&&(!addr.b.length||addr.b.length>60))return false;
 netU8(A,(tr==='tcp'?1:0)|(addr.k<<1)|(ty<<3));
 netU8(A,pr>>>24&255);netU8(A,pr>>>16&255);netU8(A,pr>>>8&255);netU8(A,pr&255);
 netU8(A,comp);netU8(A,port>>8&255);netU8(A,port&255);
 netU8(A,addr.b.length);for(const b of addr.b)netU8(A,b);
 return true;
}
function netCandRead(A,o,i){
 const f=A[o.p++]||0,tr=(f&1)?'tcp':'udp',k=(f>>1)&3,ty=(f>>3)&3,pr=netU32Read(A,o),comp=A[o.p++]||1,port=(A[o.p++]||0)<<8|(A[o.p++]||0);
 const n=A[o.p++]||0,b=[];for(let j=0;j<n;j++)b.push(A[o.p++]||0);
 const addr=netAddrText(k,b);
 return addr?((i+1)+' '+comp+' '+tr+' '+pr+' '+addr+' '+port+' typ '+NET_CT[ty]):'';
}
function netSdpFields(sdp){
 const o={ufrag:'',pwd:'',fpHex:'',setup:'',c:[]};
 for(const ln of String(sdp).split(/\r?\n/)){
  if(ln.indexOf('a=ice-ufrag:')===0)o.ufrag=ln.slice(12).trim();
  else if(ln.indexOf('a=ice-pwd:')===0)o.pwd=ln.slice(10).trim();
  else if(ln.indexOf('a=fingerprint:')===0){const v=ln.slice(14).trim(),i=v.indexOf(' ');if(i>0&&v.slice(0,i).toLowerCase()==='sha-256')o.fpHex=v.slice(i+1).replace(/:/g,'')}
  else if(ln.indexOf('a=setup:')===0)o.setup=ln.slice(8).trim();
  else if(ln.indexOf('a=candidate:')===0)o.c.push(ln.slice(12).trim());
 }
 return o;
}
function netB64(A){let s='';for(const b of A)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function netUnB64(t){
 let b=String(t).replace(/-/g,'+').replace(/_/g,'/');
 while(b.length%4)b+='=';
 try{const raw=atob(b),A=[];for(let i=0;i<raw.length;i++)A.push(raw.charCodeAt(i));return A}catch(e){return null}
}
function netSdpBuild(ufrag,pwd,fb,setup,c){
 const fp=fb.map(b=>('0'+b.toString(16)).slice(-2).toUpperCase()).join(':');
 const L=['v=0','o=- 1 1 IN IP4 0.0.0.0','s=-','t=0 0','a=group:BUNDLE 0',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel','c=IN IP4 0.0.0.0',
  'a=ice-ufrag:'+ufrag,'a=ice-pwd:'+pwd];
 for(const x of c)L.push('a=candidate:'+x);
 L.push('a=fingerprint:sha-256 '+fp,'a=setup:'+setup,'a=mid:0','a=sctp-port:5000','a=max-message-size:262144','a=end-of-candidates');
 return L.join('\r\n')+'\r\n';
}
/* every invite carries a lane byte, and the reply echoes it, so the host can pair many reply codes with their invites */
function netPack(sdp,ans,lane){
 const f=netSdpFields(sdp||''),fb=netHex(f.fpHex);
 if(!f.ufrag||!f.pwd||!fb||!f.c.length)return '';
 const si=NET_SETUP.indexOf(f.setup);
 const A=[0x30|(ans?4:0)|(si<0?0:si),(lane|0)&255];
 netStr(A,f.ufrag);netStr(A,f.pwd);
 for(const b of fb)netU8(A,b);
 const at=A.length;netU8(A,0);
 let n=0,loc=0;
 /* a code is capped at ten addresses, and a machine with virtual adapters gathers many local ones:
    send the network (srflx/relay) addresses first so the cap can never throw away the only usable one.
    The local ones are all names for the same machine, so four of them are enough to reach any same-Wi-Fi friend */
 const rank=c=>/ typ (srflx|prflx|relay)/.test(c)?0:1;
 for(const c of f.c.slice().sort((a,b)=>rank(a)-rank(b))){
  if(n>=10||(rank(c)&&loc>=4))continue;
  if(!netCandPack(A,c))continue;
  n++;if(rank(c))loc++;
 }
 if(!n)return '';
 A[at]=n;
 return 'MM2.'+netB64(A);
}
function netUnpack(body){
 const A=netUnB64(body);
 if(!A||A.length<40)return null;
 const v=A[0]>>4;
 if(v!==2&&v!==3)return null;
 const lane=v===3?(A[1]||0):0,o={p:v===3?2:1},ufrag=netStrRead(A,o),pwd=netStrRead(A,o),fb=[];
 for(let i=0;i<32;i++)fb.push(A[o.p++]||0);
 const n=A[o.p++]||0,c=[];
 for(let i=0;i<n;i++){const s=netCandRead(A,o,i);if(s)c.push(s)}
 if(!ufrag||!pwd||!c.length)return null;
 return {v:v,t:(A[0]&4)?'answer':'offer',lane:lane,sdp:netSdpBuild(ufrag,pwd,fb,NET_SETUP[A[0]&3],c)};
}
const netNum=v=>{const n=Number(v);return isFinite(n)?n:0};
function netName(n){const s=String(n||'').replace(/[^\w \-'.]/g,'').slice(0,16).trim();return s||'Friend'}
/* the guest gets its channel from ondatachannel, so send and close always read p.dc, never the value passed in */
function netPeer(pc,dc){
 return{pc:pc,dc:dc,id:'',name:'Friend',
  send(o){const ch=this.dc;try{if(ch&&ch.readyState==='open')ch.send(JSON.stringify(o));else if(NET.sim)NET.sent.push(o)}catch(e){}},
  close(){const ch=this.dc;try{if(ch)ch.close()}catch(e){}try{if(this.pc)this.pc.close()}catch(e){}}};
}
/* a phone can take a few seconds to learn its own network address, and a code sealed before that carries only
   local addresses, which a host on another Wi-Fi can never reach: wait for a network address or the end of gathering */
function netIceDone(pc){
 if(pc.iceGatheringState==='complete')return true;
 const s=pc.localDescription?pc.localDescription.sdp:'';
 return /a=candidate:[^\n]* typ (srflx|prflx|relay)/.test(s);
}
function netIceWait(pc,cb){
 let done=false;const fin=()=>{if(done)return;done=true;cb()};
 if(netIceDone(pc)){setTimeout(fin,60);return}
 try{pc.addEventListener('icecandidate',()=>{if(netIceDone(pc))fin()})}catch(e){}
 try{pc.addEventListener('icegatheringstatechange',()=>{if(pc.iceGatheringState==='complete')fin()})}catch(e){}
 setTimeout(fin,8000);
}
function netLaneNext(){
 const lu=NET.lanes||new Map();
 for(let i=0;i<255;i++){NET.laneSeq=NET.laneSeq%255+1;if(!lu.has(NET.laneSeq))return NET.laneSeq}
 return 0;
}
function netLaneHas(p){
 if(!NET.lanes)return false;
 for(const l of NET.lanes.values())if(l.p===p)return true;
 return false;
}
function netShare(){
 if(!window.RTCPeerConnection){conLog('This browser cannot make a peer connection.','er');return}
 if(NET.on&&NET.role==='guest'){conLog('You are in a friend\'s lobby. Type /leave first.','er');return}
 if(!playing){conLog('Enter your world first, then type /share.','er');return}
 if(!NET.lanes)NET.lanes=new Map();
 if(NET.lanes.size>=NET_MAX){conLog('You already have '+NET.lanes.size+' invites waiting. A friend has to type /join first.','er');return}
 NET.role='host';NET.guest=false;NET.on=true;NET.me='h';
 netKeepAlive(document.hidden&&NET.on);
 if(!NET.players)NET.players=new Map();
 const lane=netLaneNext();if(!lane){conLog('There are no invite slots left.','er');return}
 const pc=new RTCPeerConnection({iceServers:NET_STUN});
 const p=netPeer(pc,pc.createDataChannel('mmc',{ordered:true}));
 p.lane=lane;
 NET.lanes.set(lane,{p:p,invite:'',ts:performance.now()});
 NET.pending=p;
 conLog('Making the invite code for friend '+(NET.peers.length+NET.lanes.size)+'…');
 pc.onconnectionstatechange=()=>{
  if(!NET.on)return;
  const s=pc.connectionState;if(s!=='failed'&&s!=='closed')return;
  if(NET.peers.indexOf(p)<0)conLog('That friend could not connect. Type /share for a fresh invite.','er');
  netDropPeer(p);
 };
 p.dc.onopen=()=>{if(NET.pending===p)NET.pending=null;netHostPeerJoin(p)};
 p.dc.onmessage=e=>netMsg(p,e.data);
 p.dc.onclose=()=>netDropPeer(p);
 pc.createOffer().then(o=>pc.setLocalDescription(o)).then(()=>{
  netIceWait(pc,()=>{
   if(!netLaneHas(p))return;
   const sdp=pc.localDescription?pc.localDescription.sdp:'';
   NET.invite=netPack(sdp,false,lane)||netEnc({v:1,t:'offer',sdp:sdp,lane:lane});
   const l=NET.lanes.get(lane);if(l)l.invite=NET.invite;
   if(!NET.invite){conLog('The invite could not be made.','er');netDropPeer(p);return}
   const link=netLink(NET.invite);if(l)l.link=link;
   conLog('Send this invite code to one friend:');
   conCode('Invite code',NET.invite,link);
   conLog('Or share this link, which fills the code in for them:');
   conLog(link);
   conLog('Type /share again for another friend, then paste each reply you get back with /join.');
  });
 }).catch(()=>{conLog('The invite could not be made.','er');netDropPeer(p)});
}
function netHostPeerJoin(p){
 if(NET.peers.indexOf(p)>=0)return;
 if(NET.lanes)NET.lanes.delete(p.lane);
 NET.peers.push(p);NET.seq=(NET.seq||0)+1;
 p.id='g'+NET.seq;p.name='Friend '+NET.seq;
 NET.players.set(p.id,{id:p.id,name:p.name,x:player.x,y:player.y,z:player.z,yaw:player.yaw,tx:player.x,ty:player.y,tz:player.z,tyaw:player.yaw,k:NET.seq%6,ph:0,leg:0,ts:performance.now()});
 p.send({t:'hi',i:p.id});
 netSendWorld(p);
 conLog(p.name+' joined your world. '+NET.peers.length+' friend'+(NET.peers.length===1?'':'s')+' in the lobby now; /players lists them.');
 toast(p.name+' joined your world');
}
/* the guest already builds the same terrain from the same seed, so only the edits have to travel */
function netSendWorld(p){
 const all=new Map();
 for(const mp of[bedits,edits])for(const[k,m]of mp){
  let a=all.get(k);if(!a){a=[];all.set(k,a)}
  for(const[li,b]of m)a.push(li*64+b);
 }
 const list=[...all];
 for(let i=0;i<list.length;i+=60)p.send({t:'wl',e:list.slice(i,i+60)});
 p.send({t:'go'});
}
function netAccept(text){
 if(!NET.on||NET.role!=='host'){conLog('No lobby is open yet. Type /share first.','er');return}
 if(!String(text||'').trim()){conLog('Type /join and paste the reply code a friend sent you.','er');return}
 const d=netDec(text);
 if(!d||d.t!=='answer'||typeof d.sdp!=='string'||!d.sdp){conLog('That reply code did not work. Check that you copied all of it.','er');return}
 const l=NET.lanes?NET.lanes.get(d.lane||0):null,p=l?l.p:null;
 /* one invite brings one friend: a second friend answering the same code needs a lane of their own, so make it here */
 if(!p||!p.pc||!netLaneHas(p)){
  conLog('That reply answers an invite that a friend already used or that has expired, so this friend needs a fresh one. Here it is:','er');
  netShare();
  return;
 }
 p.pc.setRemoteDescription({type:'answer',sdp:d.sdp}).then(()=>{
  conLog('Connecting…');
  const t0=performance.now();
  const w=setInterval(()=>{
   if(NET.peers.indexOf(p)>=0||!netLaneHas(p)){clearInterval(w);return}
   if(performance.now()-t0<NET_CONNECT)return;
   clearInterval(w);
   netDropPeer(p);
   conLog('That friend could not connect. Type /share and send the new invite code.','er');
  },1000);
 }).catch(()=>conLog('That reply code does not fit this invite. Ask your friend for a fresh one after typing /share again.','er'));
}
function netGuestJoin(text){
 const d=netDec(text);
 if(!d||d.t!=='offer'||typeof d.sdp!=='string'||!d.sdp){toast('That invite code did not work. Copy the whole code and try again.');return}
 if(!window.RTCPeerConnection){toast('This browser cannot join a lobby.');return}
 if(NET.on&&NET.role==='host'){toast('Close your own lobby first with /endstream.');return}
 netClose();
 NET.role='guest';NET.guest=true;NET.on=true;NET.sim=false;NET.entered=false;NET.lane=d.lane||0;
 netKeepAlive(document.hidden&&NET.on);
 NET.players=new Map();if(!NET.q)NET.q=[];
 const pc=new RTCPeerConnection({iceServers:NET_STUN});
 const p=netPeer(pc,null);
 NET.peers=[p];
 pc.ondatachannel=e=>{p.dc=e.channel;netGuestWire(p)};
 pc.onconnectionstatechange=()=>{const s=pc.connectionState;if(s==='failed'||s==='closed')netGuestLost('lost');else if(s==='connected')netLostBack()};
 pc.setRemoteDescription({type:'offer',sdp:d.sdp})
  .then(()=>pc.createAnswer())
  .then(a=>pc.setLocalDescription(a))
  .then(()=>{netIceWait(pc,()=>{
   const sdp=pc.localDescription?pc.localDescription.sdp:'';
   const reply=netPack(sdp,true,NET.lane)||netEnc({v:1,t:'answer',sdp:sdp,lane:NET.lane});
   if(!reply){toast('That invite code did not work.');netClose();return}
   netReplyCard(reply);
  })})
  .catch(()=>{toast('That invite code did not work. Copy the whole code and try again.');netClose()});
}
/* a reply that has not opened a line yet is not thrown away: the host is probably still typing, and the same
   code is still the only thing that can let the friend in. It runs on the game clock (netTick), not a wall timer. */
function netGuestStuck(){
 if(!NET.on||NET.role!=='guest'||NET.entered)return;
 const code=NET.reply||'';
 conLog('Still waiting for the host to paste your reply code. Keep this window open.','er');
 toast('Still waiting for the host. Keep this window open.');
 if(curModal)closeModal();
 modal('<h2>Still waiting for the host</h2><p>Your reply code has not opened a line yet. The host types <b>/join</b> and pastes the code below, so keep this window open and send it again if it got lost. One invite code lets one friend in, so if a friend answered the same invite before you the host could not let you in; ask for a fresh code with <b>/share</b>.</p><textarea id="wcode" class="cta" rows="3" readonly aria-label="Reply code"></textarea><div class="row"><button class="btn" data-a="copy">Copy reply</button><button class="btn alt" data-a="again">New invite code</button><button class="btn alt" data-a="no">Cancel</button></div>',p=>{
  const ta=p.querySelector('#wcode');ta.value=code;
  p.querySelector('[data-a=copy]').onclick=e=>conCopy(code,e.target);
  p.querySelector('[data-a=again]').onclick=()=>{closeModal();joinLobbyCard()};
  p.querySelector('[data-a=no]').onclick=()=>{netClose();closeModal()};
 });
}
function netGuestWire(p){
 const dc=p.dc;
 dc.onopen=()=>{try{dc.send(JSON.stringify({t:'hi',n:'Friend'}))}catch(e){}};
 dc.onmessage=e=>netMsg(p,e.data);
 dc.onclose=()=>netGuestLost('lost');
 if(dc.readyState==='open')dc.onopen();
}
function netReplyCard(reply){
 conLog('Reply code ready. Send it to the host.');
 NET.reply=reply;NET.waiting=.001;
 if(curModal)closeModal();
 modal('<h2>Send this to the host</h2><p>Copy the reply code and send it to the host. The host types <b>/join</b> and pastes it. You join the world as soon as it fits.</p><textarea id="rcode" class="cta" rows="3" readonly aria-label="Reply code"></textarea><div class="row"><button class="btn" data-a="copy">Copy reply</button><button class="btn alt" data-a="no">Cancel</button></div>',p=>{
  const ta=p.querySelector('#rcode');ta.value=reply;
  p.querySelector('[data-a=copy]').onclick=e=>conCopy(reply,e.target);
  p.querySelector('[data-a=no]').onclick=()=>{netClose();closeModal()};
 });
}
function netWho(){
 if(!NET.on){conLog('No lobby is open. Type /share to open one.');return}
 conLog(NET.role==='host'?'You are the host of this lobby.':'You are a guest in a friend\'s lobby.');
 if(NET.role==='host'){
  const wait=NET.lanes?NET.lanes.size:0;
  conLog('You and '+NET.peers.length+' friend'+(NET.peers.length===1?'':'s')+' in the world'+(wait?', with '+wait+' invite'+(wait===1?'':'s')+' waiting for a reply code':'')+'.');
  if(NET.peers.length)conLog('Players: you, '+NET.peers.map(p=>p.name).join(', ')+'.');
 }else{
  const names=[...NET.players.values()].map(p=>p.name||'Friend');
  conLog(NET.players.size+' other player'+(NET.players.size===1?'':'s')+' here'+(names.length?': '+names.join(', '):'')+'.');
 }
}
function netEnd(){
 if(!NET.on){conLog('No lobby is open.');return}
 const host=NET.role==='host';
 for(const p of NET.peers)p.send({t:'end'});
 netClose();
 if(host){conLog('Lobby closed. Your world is saved on this device and you can keep playing alone.');toast('Lobby closed. You are playing alone.')}
 else{conLog('You left the lobby.');toast('You left the lobby.');setTimeout(()=>location.reload(),500)}
}
function netLeave(){
 if(!NET.on){conLog('You are not in a lobby.');return}
 if(NET.role==='host'){netEnd();return}
 for(const p of NET.peers)p.send({t:'bye'});
 netClose();
 toast('You left the lobby.');
 setTimeout(()=>location.reload(),500);
}
/* a hidden tab stops its frame loop, so the lobby would go quiet and a friend would look gone: keep the packets flowing */
function netKeepAlive(on){
 if(on&&NET.on){if(!NET.ka)NET.ka=setInterval(()=>{if(!NET.on){netKeepAlive(false);return}netTick(.25)},500)}
 else if(NET.ka){clearInterval(NET.ka);NET.ka=0}
}
document.addEventListener('visibilitychange',()=>{
 netKeepAlive(document.hidden&&NET.on);
 if(!document.hidden&&NET.on)NET.tick=NET_SEND;
});
function netClose(){
 netLostStop();netKeepAlive(false);
 if(NET.lanes){for(const l of NET.lanes.values()){try{l.p.close()}catch(e){}}NET.lanes.clear()}
 for(const p of NET.peers)p.close();
 NET.on=false;NET.role='';NET.guest=false;NET.peers=[];NET.pending=null;NET.invite='';NET.me='';NET.tick=0;NET.q=[];NET.entered=false;NET.lane=0;NET.reply='';NET.waiting=0;
 if(NET.players)NET.players.clear();
}
function netDropPeer(p){
 if(!p)return;
 if(NET.pending===p)NET.pending=null;
 if(NET.lanes)for(const[lane,l]of NET.lanes)if(l.p===p)NET.lanes.delete(lane);
 const i=NET.peers.indexOf(p);
 if(i>=0)NET.peers.splice(i,1);
 if(p.id&&NET.players)NET.players.delete(p.id);
 const wasIn=i>=0;
 p.close();
 if(wasIn&&NET.role==='host'&&NET.on)conLog('A friend left the lobby.');
}
/* a dropped channel is not a cancelled game: sit it out for NET_GRACE and say so only when it stays down.
   Only the host's own {t:'end'} (/endstream) means "cancelled". */
function netGuestLost(why){
 if(!NET.on||NET.role!=='guest')return;
 if(why==='end'){netGuestEnd();return}
 if(NET.lost)return;
 NET.lost=performance.now();
 if(!NET_LOST_T)NET_LOST_T=setInterval(netLostCheck,700);
 toast(NET.entered?'Reconnecting to the host…':'Connecting to the host…');
}
function netLostStop(){
 if(NET_LOST_T){clearInterval(NET_LOST_T);NET_LOST_T=0}
 NET.lost=0;
}
/* the channel came back: carry on, and ask for the edits that were missed while it was down */
function netLostBack(){
 if(!NET.lost)return;
 netLostStop();NET.tick=NET_SEND;
 for(const p of NET.peers)p.send({t:'sync'});
 toast('Connected to the host again');
}
function netLostCheck(){
 if(!NET.on||NET.role!=='guest'){netLostStop();return}
 for(const p of NET.peers){
  const st=p.pc?p.pc.connectionState:'';
  if(p.dc&&p.dc.readyState==='open'&&(!st||st==='connected')){netLostBack();return}
 }
 if(!NET.lost||document.hidden)return;
 if(performance.now()-NET.lost<NET_GRACE)return;
 netLostStop();
 netGuestGone();
}
function netGuestEnd(){
 if(!NET.on||NET.role!=='guest')return;
 netLostStop();
 netClose();
 toast('The host has cancelled the game');
 if(curModal)closeModal();
 modal('<h2>The host has cancelled the game</h2><p>The host has cancelled this game. Nothing you built in your own world was touched. Go back to your own world to keep playing.</p><div class="row"><button class="btn" data-a="ok">Back to my world</button></div>',p=>{
  p.querySelector('[data-a=ok]').onclick=()=>{closeModal();location.reload()};
 });
}
/* what the line looked like when it failed: a bare "could not connect" cannot say whether the phone had no
   network address of its own or the two browsers never reached each other */
function netDiag(){
 const p=NET.peers[0],pc=p&&p.pc,st=pc?pc.connectionState:'none';
 let host=0,net=0;
 try{
  const sdp=pc&&pc.localDescription?pc.localDescription.sdp:'';
  for(const ln of sdp.split(/\r?\n/))if(ln.indexOf('a=candidate:')===0)(/ typ (srflx|prflx|relay)/.test(ln)?net++:host++);
 }catch(e){}
 return 'Line '+st+', with '+host+' local and '+net+' network address'+(net===1?'':'es')+'.';
}
function netGuestGone(){
 if(!NET.on||NET.role!=='guest')return;
 const never=!NET.entered;
 netClose();
 toast(never?'Could not connect to the host':'Lost the connection to the host');
 if(curModal)closeModal();
 modal('<h2>'+(never?'Could not connect to the host':'Lost the connection to the host')+'</h2><p>'+(never?'The invite and reply codes did not open a line to the host. Both devices have to be on the same Wi-Fi, and a firewall must let the browser in. Nothing you built in your own world was touched. Ask the host for a fresh invite code, or go back to your own world.':'The connection dropped, which a tab switch or a short network drop can cause. Nothing you built in your own world was touched. Ask the host for a fresh invite code to play together again, or go back to your own world.')+'</p><p><small>'+netDiag()+'</small></p><div class="row"><button class="btn" data-a="again">Join again</button><button class="btn alt" data-a="ok">Back to my world</button></div>',p=>{
  p.querySelector('[data-a=again]').onclick=()=>{closeModal();joinLobbyCard()};
  p.querySelector('[data-a=ok]').onclick=()=>{closeModal();location.reload()};
 });
}
function netMsg(p,raw){
 let m=null;
 try{m=JSON.parse(raw)}catch(e){return}
 if(!m||typeof m!=='object')return;
 if(NET.role==='host')netHostMsg(p,m);else if(NET.role==='guest')netGuestMsg(m);
}
function netHostMsg(p,m){
 if(m.t==='hi'&&p.id){
  p.name=netName(m.n);
  const pl=NET.players.get(p.id);if(pl)pl.name=p.name;
  conLog(p.name+' is in the lobby.');
  return;
 }
 if(m.t==='p'&&p.id){
  let pl=NET.players.get(p.id);
  /* a guest whose tab slept past NET_STALE was pruned; its next packet must bring the figure back */
  if(!pl){pl={id:p.id,name:p.name||'Friend',x:netNum(m.x),y:netNum(m.y),z:netNum(m.z),yaw:netNum(m.yaw),k:NET.seq%6,ph:0,leg:0};NET.players.set(p.id,pl)}
  pl.tx=netNum(m.x);pl.ty=netNum(m.y);pl.tz=netNum(m.z);pl.tyaw=netNum(m.yaw);pl.ts=performance.now();
  return;
 }
 if(m.t==='sync'){netSendWorld(p);return}
 if(m.t==='b'&&Array.isArray(m.l)){
  for(const e of m.l)if(Array.isArray(e)){
   netApply(e[0],e[1],e[2],e[3]);
   if(NET.q.length<600)NET.q.push([e[0],e[1],e[2],e[3]]);
  }
  return;
 }
 if(m.t==='bye')netDropPeer(p);
}
function netGuestMsg(m){
 if(m.t==='hi'){
  NET.me=typeof m.i==='string'?m.i:'g1';
  netGuestEnter();
  return;
 }
 if(m.t==='wl'&&Array.isArray(m.e)){netApplyList(m.e);return}
 if(m.t==='ps'&&Array.isArray(m.l)){netPlayers(m.l);return}
 if(m.t==='b'&&Array.isArray(m.l)){for(const e of m.l)if(Array.isArray(e))netApply(e[0],e[1],e[2],e[3]);return}
 if(m.t==='end'){netGuestLost('end')}
}
/* a remote edit is applied like any other block, but it is never sent on again and never saved as the guest's own */
function netApply(x,y,z,b){
 x=Math.floor(netNum(x));y=Math.floor(netNum(y));z=Math.floor(netNum(z));b=Math.floor(netNum(b));
 if(!inb(x,y,z)||y<1||b<0||!DEFS[b])return;
 setBlock(x,y,z,b,2);
}
function netApplyList(list){
 for(const e of list){
  if(!Array.isArray(e)||!Number.isInteger(e[0])||!Array.isArray(e[1]))continue;
  const k=e[0],cx=k%NC,cz=(k-cx)/NC;
  if(cx<0||cz<0||cx>=NC||cz>=NC)continue;
  for(const v of e[1]){
   if(!Number.isInteger(v)||v<0)continue;
   const li=v>>6,b=v&63;
   if(li>=CV||!DEFS[b])continue;
   netApply(cx*16+(li&15),li>>8,cz*16+((li>>4)&15),b);
  }
 }
}
function netPlayers(l){
 const now=performance.now();
 for(const r of l){
  if(!Array.isArray(r)||r.length<5)continue;
  const id=String(r[0]);
  let p=NET.players.get(id);
  if(!p){p={id:id,name:'Friend',k:(NET.players.size+1)%6,x:netNum(r[1]),y:netNum(r[2]),z:netNum(r[3]),yaw:netNum(r[4]),ph:0,leg:0};NET.players.set(id,p)}
  p.tx=netNum(r[1]);p.ty=netNum(r[2]);p.tz=netNum(r[3]);p.tyaw=netNum(r[4]);p.ts=now;
  if(Number.isInteger(r[5]))p.k=Math.abs(r[5])%6;
  if(id===NET.me)NET.players.delete(id);
 }
}
/* updates come in at most 14 times a second, so a remote figure is eased towards its last packet every frame instead of jumping */
function netEase(dt){
 if(!NET.players||!NET.players.size)return;
 const a=1-Math.exp(-dt*13),decay=Math.max(0,1-dt*8);
 for(const p of NET.players.values()){
  if(p.tx===undefined)continue;
  const dx=p.tx-p.x,dy=p.ty-p.y,dz=p.tz-p.z;
  if(dx*dx+dy*dy+dz*dz>64){p.x=p.tx;p.y=p.ty;p.z=p.tz;p.yaw=p.tyaw||0;p.leg=0;continue}
  p.x+=dx*a;p.y+=dy*a;p.z+=dz*a;
  if(p.tyaw!==undefined){const d=Math.atan2(Math.sin(p.tyaw-(p.yaw||0)),Math.cos(p.tyaw-(p.yaw||0)));p.yaw=(p.yaw||0)+d*a}
  const left=Math.hypot(dx,dy,dz);
  if(left>.03){p.leg=Math.min(1,.35+left*2);p.ph=(p.ph||0)+dt*7.5}else p.leg=(p.leg||0)*decay;
 }
}
function netTick(dt){
 if(!NET.on)return;
 netEase(dt);
 /* a host who is slow to relay the code must not be mistaken for a refused reply: the nudge runs on the game clock so
    the test can move it, and it is long enough for a code to travel through a chat app */
 if(NET.role==='guest'&&!NET.entered&&NET.waiting){NET.waiting+=dt*1000;if(NET.waiting>=NET_WAIT){NET.waiting=0;netGuestStuck()}}
 NET.tick+=dt;
 if(NET.tick<NET_SEND)return;
 NET.tick=0;
 const now=performance.now();
 if(NET.q.length){
  const q=NET.q;NET.q=[];
  for(const p of NET.peers)p.send({t:'b',l:q});
 }
 if(NET.players){
  for(const[id,p]of NET.players)if(now-(p.ts||now)>NET_STALE)NET.players.delete(id);
 }
 if(NET.role==='host'&&NET.lanes&&NET.lanes.size){
  for(const[lane,l]of NET.lanes)if(now-(l.ts||now)>NET_LANE_TTL){NET.lanes.delete(lane);try{l.p.close()}catch(e){}}
 }
 if(NET.role==='host'){
  if(!NET.peers.length)return;
  const l=[['h',player.x,player.y,player.z,player.yaw,0]];
  for(const[id,p]of NET.players)l.push([id,p.tx===undefined?p.x:p.tx,p.ty===undefined?p.y:p.ty,p.tz===undefined?p.z:p.tz,p.tyaw===undefined?p.yaw:p.tyaw,p.k]);
  for(const p of NET.peers)p.send({t:'ps',l:l});
 }else if(NET.role==='guest'){
  if(!NET.peers.length)return;
  for(const p of NET.peers)p.send({t:'p',x:player.x,y:player.y,z:player.z,yaw:player.yaw});
 }
}
/* called by setBlock; who 0 is the player, 1 a builder, 2 a remote edit that must not travel again */
function netLocalEdit(x,y,z,b,who){
 if(!NET.on||who===2)return;
 if(NET.role==='guest'||(NET.role==='host'&&NET.peers.length)){
  if(NET.q.length<600)NET.q.push([x,y,z,b|0]);
 }
}
/* a guest leaves its own world untouched: the host world is only in memory, so saving stops while a guest */
function netGuestEnter(){
 if(!NET.entered){NET.entered=true;NET.waiting=0;if(curModal)closeModal();netGuestWorld()}
}
function netGuestWorld(){
 if(typeof unloadAll==='function')unloadAll();
 edits.clear();bedits.clear();blClear();
 PERSIST.dirty.clear();PERSIST.botDirty=false;dirtySet.clear();
 SV.has=false;SV.pos=null;
 for(const b of bots){b.on=false;b.done=[];b.site=null;b.st=0;b.cells.length=0}
 if(!playing)startPlay();else spawnPlayer();
}
/* other players are drawn with the same figures as the builders */
function netDraw(){
 if(!NET.on||!playing||!NET.players||!NET.players.size)return;
 for(const p of NET.players.values()){
  const dx=p.x-player.x,dz=p.z-player.z;
  if(dx*dx+dz*dz>farFog*farFog*1.1)continue;
  if((p.x-cam.e[0])*cam.fw[0]+(p.y+1-cam.e[1])*cam.fw[1]+(p.z-cam.e[2])*cam.fw[2]<-3)continue;
  if(botN+80>botGeo.length/7)break;
  drawBotFig({x:p.x,y:p.y,z:p.z,yaw:p.yaw||0,ph:p.ph||0,leg:p.leg||0,arm:0,look:BLOOK[(p.k||0)%6],st:BS.WANDER,work:false,cele:0});
 }
}
/* ---- the "Join lobby" card on the start screen ---- */
function joinLobbyCard(){
   modal('<h2>Join a lobby</h2><p>A friend opens a lobby with <b>/share</b> in the game console and sends you the invite code or its link. Paste either one here.</p><textarea id="jcode" class="cta" rows=3 aria-label="Invite code" placeholder="MM2..."></textarea><div class="row"><button class="btn alt" data-a="no">Close</button><button class="btn" data-a="go">Join</button></div>',p=>{
  const ta=p.querySelector('#jcode');if(NET_PRE)ta.value=NET_PRE;
  p.querySelector('[data-a=no]').onclick=closeModal;
  p.querySelector('[data-a=go]').onclick=()=>{const v=p.querySelector('#jcode').value;NET_PRE='';netGuestJoin(v)};
 });
}
/* ---- wiring ---- */
(function conWire(){
 const inp=$('conIn');
 if(inp)inp.addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();const v=inp.value;inp.value='';conRun(v)}
  else if(e.key==='Escape'){e.preventDefault();conOpen(false)}
  else if(e.key==='ArrowUp'){e.preventDefault();if(CON.hist.length){CON.hi=Math.max(0,CON.hi-1);inp.value=CON.hist[CON.hi]||''}}
 });
 const cl=$('conClose');if(cl)cl.onclick=()=>conOpen(false);
 /* a tap on the world is meant for the world: step out of the way unless something was typed */
 document.addEventListener('pointerdown',e=>{
  if(!CON.on)return;
  const c=$('con');if(c&&c.contains(e.target))return;
  const i=$('conIn');if(!i||!String(i.value).trim())conOpen(false);
 },true);
 const nb=$('wneww');if(nb)nb.onclick=worldNew;
})();
/* a #join= link opens the join card with the code already in it; the hash is cleared so a reload does not reopen it.
   A link tapped while the game is already open only changes the hash, so hashchange is watched too. */
(function netJoinLink(){
 const go=()=>{
  const b=document.querySelector('[data-a=play]');
  if(b&&b.offsetParent===null&&!playing){setTimeout(go,200);return}
  if(!curModal)joinLobbyCard();else toast('Your invite is ready. Open Join lobby.');
 };
 const take=()=>{
  const h=location.hash||'',i=h.indexOf('#join=');
  if(i<0)return;
  const code=netCodeText(h.slice(i+6));
  if(!netDec(code))return;
  NET_PRE=code;
  try{history.replaceState(null,'',String(location.href).split('#')[0])}catch(e){try{location.hash=''}catch(e2){}}
  setTimeout(go,200);
 };
 take();
 addEventListener('hashchange',take);
})();
worldsInit();
/* ---- hooks for automated tests ---- */
window.__con=()=>({on:CON.on,text:($('conLog')||{}).textContent||''});
window.__cmd=t=>{conRun(String(t));return (($('conLog')||{}).textContent||'').slice(-600)};
window.__worlds=()=>({active:WACT,list:WORLDS.map(w=>({id:w.id,name:w.name,stars:w.stars||0,mission:w.mission||0,blocks:w.blocks||0}))});
window.__net=()=>({on:NET.on,role:NET.role,guest:NET.guest,peers:NET.peers.length,lanes:NET.lanes?NET.lanes.size:0,lane:NET.lane,players:[...NET.players.values()].map(p=>({id:p.id,name:p.name,x:p.x,y:p.y,z:p.z,tx:p.tx===undefined?null:p.tx,ty:p.ty===undefined?null:p.ty,tz:p.tz===undefined?null:p.tz,leg:p.leg||0}))});
window.__netCodes=()=>NET.lanes?[...NET.lanes.entries()].map(e=>({lane:e[0],invite:e[1].invite})):[];
window.__netCode=o=>o&&typeof o==='object'&&typeof o.sdp==='string'?(netPack(o.sdp,o.t==='answer',o.lane)||netEnc(o)):'';
window.__netParse=t=>netDec(t);
window.__netSim=role=>{
 netClose();NET.on=true;NET.sim=true;NET.role=role;NET.guest=role==='guest';NET.me=role==='guest'?'g1':'h';NET.sent=[];
 const p={id:'g1',name:'Friend',pc:null,dc:null,send(o){NET.sent.push(o)},close(){}};
 NET.peers=[p];
 if(role==='host')NET.players.set('g1',{id:'g1',name:'Friend',x:player.x+4,y:player.y,z:player.z,yaw:0,k:1,ts:performance.now()});
 return true;
};
window.__netFeed=m=>{const p=NET.peers[0]||{id:'g1',send(){}};netMsg(p,typeof m==='string'?m:JSON.stringify(m));return true};
window.__netSent=()=>NET.sent.slice();
window.__netTick=dt=>netTick(dt);
window.__netIce=()=>netDiag();
window.__netLost=why=>{netGuestLost(why||'lost');return true};

/* ===== 7e. Command console, world slots and serverless multiplayer (WebRTC) ===== */
const WORLDS_KEY='musliMineCraft_worlds_v1',ACTIVE_KEY='musliMineCraft_active_v1',SLOT_PREFIX='musliMineCraft_w_';
let WORLDS=[],WACT='';
const CON={on:false,hist:[],hi:0};
/* NET is a var so the guards in earlier parts (netGuest) are safe before this line has run */
var NET={on:false,role:'',guest:false,me:'',peers:[],players:new Map(),pending:null,invite:'',tick:0,q:[],sent:[],sim:false,seq:0,entered:false};
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
/* a code is long, so it lives in a selectable box with a copy button */
function conCode(label,txt){
 conLog(label);
 const box=document.createElement('div');box.className='ccode';
 const ta=document.createElement('textarea');ta.readOnly=true;ta.rows=2;ta.className='cta';ta.value=txt;ta.setAttribute('aria-label',label);
 ta.onfocus=()=>{try{ta.select()}catch(e){}};
 const b=document.createElement('button');b.type='button';b.className='conBtn';b.textContent='Copy';
 b.onclick=()=>conCopy(txt,b);
 box.appendChild(ta);box.appendChild(b);
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
  conLog('/share: open a lobby and get an invite code for a friend');
  conLog('/join <code>: paste the reply code a friend sends back to you');
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
function netDec(text){
 const t=String(text||'').replace(/\s+/g,'');
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
function netPack(sdp,ans){
 const f=netSdpFields(sdp||''),fb=netHex(f.fpHex);
 if(!f.ufrag||!f.pwd||!fb||!f.c.length)return '';
 const si=NET_SETUP.indexOf(f.setup);
 const A=[0x20|(ans?4:0)|(si<0?0:si)];
 netStr(A,f.ufrag);netStr(A,f.pwd);
 for(const b of fb)netU8(A,b);
 const at=A.length;netU8(A,0);
 let n=0;
 for(const c of f.c){if(n>=10)break;if(netCandPack(A,c))n++}
 if(!n)return '';
 A[at]=n;
 return 'MM2.'+netB64(A);
}
function netUnpack(body){
 const A=netUnB64(body);
 if(!A||A.length<40||(A[0]>>4)!==2)return null;
 const o={p:1},ufrag=netStrRead(A,o),pwd=netStrRead(A,o),fb=[];
 for(let i=0;i<32;i++)fb.push(A[o.p++]||0);
 const n=A[o.p++]||0,c=[];
 for(let i=0;i<n;i++){const s=netCandRead(A,o,i);if(s)c.push(s)}
 if(!ufrag||!pwd||!c.length)return null;
 return {v:2,t:(A[0]&4)?'answer':'offer',sdp:netSdpBuild(ufrag,pwd,fb,NET_SETUP[A[0]&3],c)};
}
const netNum=v=>{const n=Number(v);return isFinite(n)?n:0};
function netName(n){const s=String(n||'').replace(/[^\w \-'.]/g,'').slice(0,16).trim();return s||'Friend'}
/* the guest gets its channel from ondatachannel, so send and close always read p.dc, never the value passed in */
function netPeer(pc,dc){
 return{pc:pc,dc:dc,id:'',name:'Friend',
  send(o){const ch=this.dc;try{if(ch&&ch.readyState==='open')ch.send(JSON.stringify(o));else if(NET.sim)NET.sent.push(o)}catch(e){}},
  close(){const ch=this.dc;try{if(ch)ch.close()}catch(e){}try{if(this.pc)this.pc.close()}catch(e){}}};
}
function netIceWait(pc,cb){
 let done=false;const fin=()=>{if(done)return;done=true;cb()};
 if(pc.iceGatheringState==='complete'){setTimeout(fin,60);return}
 try{pc.addEventListener('icegatheringstatechange',()=>{if(pc.iceGatheringState==='complete')fin()})}catch(e){}
 setTimeout(fin,4000);
}
function netShare(){
 if(!window.RTCPeerConnection){conLog('This browser cannot make a peer connection.','er');return}
 if(NET.on&&NET.role==='guest'){conLog('You are in a friend\'s lobby. Type /leave first.','er');return}
 if(!playing){conLog('Enter your world first, then type /share.','er');return}
 if(NET.on&&NET.pending){conLog('Your invite is waiting. Send it to your friend, then type /join with the reply code they send back.');conCode('Invite code',NET.invite);return}
 NET.role='host';NET.guest=false;NET.on=true;NET.me='h';
 if(!NET.players)NET.players=new Map();
 const pc=new RTCPeerConnection({iceServers:NET_STUN});
 const p=netPeer(pc,pc.createDataChannel('mmc',{ordered:true}));
 NET.pending=p;
 conLog('Making the invite code…');
 pc.onconnectionstatechange=()=>{const s=pc.connectionState;if(s==='failed'||s==='closed')netDropPeer(p)};
 p.dc.onopen=()=>{if(NET.pending===p)NET.pending=null;netHostPeerJoin(p)};
 p.dc.onmessage=e=>netMsg(p,e.data);
 p.dc.onclose=()=>netDropPeer(p);
 pc.createOffer().then(o=>pc.setLocalDescription(o)).then(()=>{
  netIceWait(pc,()=>{
   if(NET.pending!==p)return;
   const sdp=pc.localDescription?pc.localDescription.sdp:'';
   NET.invite=netPack(sdp,false)||netEnc({v:1,t:'offer',sdp:sdp});
   if(!NET.invite){conLog('The invite could not be made.','er');netDropPeer(p);return}
   conLog('Send this invite code to your friend:');
   conCode('Invite code',NET.invite);
   conLog('Then type /join and paste the reply code your friend sends back.');
  });
 }).catch(()=>{conLog('The invite could not be made.','er');netDropPeer(p)});
}
function netHostPeerJoin(p){
 if(NET.peers.indexOf(p)>=0)return;
 NET.peers.push(p);NET.seq=(NET.seq||0)+1;
 p.id='g'+NET.seq;p.name='Friend '+NET.seq;
 NET.players.set(p.id,{id:p.id,name:p.name,x:player.x,y:player.y,z:player.z,yaw:player.yaw,k:NET.seq%6,ts:performance.now()});
 p.send({t:'hi',i:p.id});
 netSendWorld(p);
 conLog('A friend joined your world. Type /endstream to close the lobby and keep playing alone.');
 toast('A friend joined your world');
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
 const p=NET.pending;
 if(!p||!p.pc){conLog('There is no invite waiting. Type /share first.','er');return}
 const d=netDec(text);
 if(!d||d.t!=='answer'||typeof d.sdp!=='string'||!d.sdp){conLog('That reply code did not work. Check that you copied all of it.','er');return}
 p.pc.setRemoteDescription({type:'answer',sdp:d.sdp}).then(()=>{
  conLog('Connecting…');
 }).catch(()=>conLog('That reply code does not fit this invite. Ask your friend for a fresh one after typing /share again.','er'));
}
function netGuestJoin(text){
 const d=netDec(text);
 if(!d||d.t!=='offer'||typeof d.sdp!=='string'||!d.sdp){toast('That invite code did not work. Copy the whole code and try again.');return}
 if(!window.RTCPeerConnection){toast('This browser cannot join a lobby.');return}
 if(NET.on&&NET.role==='host'){toast('Close your own lobby first with /endstream.');return}
 netClose();
 NET.role='guest';NET.guest=true;NET.on=true;NET.sim=false;NET.entered=false;
 NET.players=new Map();if(!NET.q)NET.q=[];
 const pc=new RTCPeerConnection({iceServers:NET_STUN});
 const p=netPeer(pc,null);
 NET.peers=[p];
 pc.ondatachannel=e=>{p.dc=e.channel;netGuestWire(p)};
 pc.onconnectionstatechange=()=>{const s=pc.connectionState;if(s==='failed'||s==='closed')netGuestLost()};
 pc.setRemoteDescription({type:'offer',sdp:d.sdp})
  .then(()=>pc.createAnswer())
  .then(a=>pc.setLocalDescription(a))
  .then(()=>{netIceWait(pc,()=>{
   const sdp=pc.localDescription?pc.localDescription.sdp:'';
   const reply=netPack(sdp,true)||netEnc({v:1,t:'answer',sdp:sdp});
   if(!reply){toast('That invite code did not work.');netClose();return}
   netReplyCard(reply);
  })})
  .catch(()=>{toast('That invite code did not work. Copy the whole code and try again.');netClose()});
}
function netGuestWire(p){
 const dc=p.dc;
 dc.onopen=()=>{try{dc.send(JSON.stringify({t:'hi',n:'Friend'}))}catch(e){}};
 dc.onmessage=e=>netMsg(p,e.data);
 dc.onclose=()=>netGuestLost();
 if(dc.readyState==='open')dc.onopen();
}
function netReplyCard(reply){
 conLog('Reply code ready. Send it to the host.');
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
 if(NET.role==='host')conLog('You and '+NET.peers.length+' friend'+(NET.peers.length===1?'':'s')+' in the world.');
 else conLog(NET.players.size+' other player'+(NET.players.size===1?'':'s')+' here.');
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
function netClose(){
 for(const p of NET.peers)p.close();
 NET.on=false;NET.role='';NET.guest=false;NET.peers=[];NET.pending=null;NET.invite='';NET.me='';NET.tick=0;NET.q=[];NET.entered=false;
 if(NET.players)NET.players.clear();
}
function netDropPeer(p){
 if(!p)return;
 if(NET.pending===p)NET.pending=null;
 const i=NET.peers.indexOf(p);
 if(i>=0)NET.peers.splice(i,1);
 if(p.id&&NET.players)NET.players.delete(p.id);
 p.close();
 if(NET.role==='host'&&NET.on)conLog('A friend left the lobby.');
}
function netGuestLost(){
 if(!NET.on||NET.role!=='guest')return;
 netClose();
 toast('The host has cancelled the game');
 if(curModal)closeModal();
 modal('<h2>The host has cancelled the game</h2><p>The host has cancelled this game. Nothing you built in your own world was touched. Go back to your own world to keep playing.</p><div class="row"><button class="btn" data-a="ok">Back to my world</button></div>',p=>{
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
  const pl=NET.players.get(p.id);
  if(pl){pl.x=netNum(m.x);pl.y=netNum(m.y);pl.z=netNum(m.z);pl.yaw=netNum(m.yaw);pl.ts=performance.now()}
  return;
 }
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
 if(m.t==='end'){netGuestLost()}
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
  if(!p){p={id:id,name:'Friend',k:(NET.players.size+1)%6};NET.players.set(id,p)}
  p.x=netNum(r[1]);p.y=netNum(r[2]);p.z=netNum(r[3]);p.yaw=netNum(r[4]);p.ts=now;
  if(Number.isInteger(r[5]))p.k=Math.abs(r[5])%6;
  if(id===NET.me)NET.players.delete(id);
 }
}
function netTick(dt){
 if(!NET.on)return;
 NET.tick+=dt;
 if(NET.tick<.12)return;
 NET.tick=0;
 const now=performance.now();
 if(NET.q.length){
  const q=NET.q;NET.q=[];
  for(const p of NET.peers)p.send({t:'b',l:q});
 }
 if(NET.players){
  for(const[id,p]of NET.players)if(now-(p.ts||now)>15000)NET.players.delete(id);
 }
 if(NET.role==='host'){
  if(!NET.peers.length)return;
  const l=[['h',player.x,player.y,player.z,player.yaw,0]];
  for(const[id,p]of NET.players)l.push([id,p.x,p.y,p.z,p.yaw,p.k]);
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
 if(!NET.entered){NET.entered=true;if(curModal)closeModal();netGuestWorld()}
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
  drawBotFig({x:p.x,y:p.y,z:p.z,yaw:p.yaw||0,ph:0,leg:0,arm:0,look:BLOOK[(p.k||0)%6],st:BS.WANDER,work:false,cele:0});
 }
}
/* ---- the "Join lobby" card on the start screen ---- */
function joinLobbyCard(){
 modal('<h2>Join a lobby</h2><p>A friend opens a lobby with <b>/share</b> in the game console and sends you the invite code. Paste it here.</p><textarea id="jcode" class="cta" rows=3 aria-label="Invite code" placeholder="MM2..."></textarea><div class="row"><button class="btn alt" data-a="no">Close</button><button class="btn" data-a="go">Join</button></div>',p=>{
  p.querySelector('[data-a=no]').onclick=closeModal;
  p.querySelector('[data-a=go]').onclick=()=>{const v=p.querySelector('#jcode').value;netGuestJoin(v)};
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
worldsInit();
/* ---- hooks for automated tests ---- */
window.__con=()=>({on:CON.on,text:($('conLog')||{}).textContent||''});
window.__cmd=t=>{conRun(String(t));return (($('conLog')||{}).textContent||'').slice(-600)};
window.__worlds=()=>({active:WACT,list:WORLDS.map(w=>({id:w.id,name:w.name,stars:w.stars||0,mission:w.mission||0,blocks:w.blocks||0}))});
window.__net=()=>({on:NET.on,role:NET.role,guest:NET.guest,peers:NET.peers.length,players:[...NET.players.values()].map(p=>({id:p.id,x:p.x,y:p.y,z:p.z}))});
window.__netCode=o=>o&&typeof o==='object'&&typeof o.sdp==='string'?(netPack(o.sdp,o.t==='answer')||netEnc(o)):'';
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

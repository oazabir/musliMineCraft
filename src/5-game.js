
/* ===== 7. Game state, save and sound ===== */
const SKILLS=[['maths','Maths'],['arabic','Arabic'],['science','Science'],['knowledge','Knowledge'],['building','Building'],['museum','Museum stamps']];
const RANKS=[['Apprentice',0],['Builder',10],['Craftsman',30],['Architect',60],['Master Builder',100]];
const S={stars:0,mission:0,unlocked:STARTER.slice(),skills:{maths:0,arabic:0,science:0,knowledge:0,building:0,museum:0},settings:{sound:true,sens:3,gfx:'auto'},sel:B.SANDSTONE,mode:'place',tmp:[],pass:'00000000000000000000000000',passFl:[0,0,0,0],title:false,playT:0,prayer:{time:0,waqt:0,done:false},gz:{pts:0,best:0,ms:0,seen:false},q:0};
const rankOf=st=>RANKS.filter(r=>st>=r[1]).pop()[0];
let playing=false,touchMode=false,saveTimer=0;
let saveNotice=false;
function resetState(){
 Object.assign(S,{stars:0,mission:0,unlocked:STARTER.slice(),sel:B.SANDSTONE,mode:'place',tmp:[],pass:'00000000000000000000000000',passFl:[0,0,0,0],title:false,playT:0,prayer:{time:0,waqt:0,done:false},gz:{pts:0,best:0,ms:0,seen:false},q:0});
 for(const k of Object.keys(S.skills))S.skills[k]=0;
 S.settings.sound=true;S.settings.sens=3;S.settings.gfx='auto';
}
function applyEdits(list,mp,bot){
 if(!Array.isArray(list))return;
 for(const e of list){
  if(!Array.isArray(e)||!Number.isInteger(e[0])||e[0]<0||e[0]>=NC*NC||!Array.isArray(e[1]))continue;
  const m=new Map();for(const v of e[1]){if(!Number.isInteger(v)||v<0)continue;const li=v>>6,b=v&63;if(li<CV&&DEFS[b]!==undefined)m.set(li,b)}
  if(m.size){mp.set(e[0],m);if(bot)for(const li of m.keys())blAdd(e[0],li)}
 }
 while(bot&&botLog.length>BLOG_MAX)trimBotLog();
}
let actx=null;
function initAudio(){
 try{
  if(!actx){const C=window.AudioContext||window.webkitAudioContext;if(C)actx=new C()}
  if(actx&&actx.state==='suspended'){const r=actx.resume();if(r&&r.catch)r.catch(()=>{})}
 }catch(e){actx=null}
}
function blip(f,dur,type,vol,delay,slide){
 if(!actx||!S.settings.sound)return;
 try{
  const t=actx.currentTime+(delay||0),o=actx.createOscillator(),g=actx.createGain();
  o.type=type||'sine';o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+dur);
  g.gain.setValueAtTime(vol||.12,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
  o.connect(g);g.connect(actx.destination);o.start(t);o.stop(t+dur+.02);
 }catch(e){}
}
const sfx={
 place:()=>blip(330,.09,'square',.08,0,520),brk:()=>blip(200,.12,'sawtooth',.07,0,90),
 wrong:()=>blip(220,.25,'sine',.1,0,160),
 right:()=>[523,659,784].forEach((f,i)=>blip(f,.18,'triangle',.12,i*.09)),
 brkLow:()=>blip(190,.08,'sawtooth',.025,0,100),splash:()=>blip(420,.22,'sine',.05,0,120),chime:()=>[784,1047,1568].forEach((f,i)=>blip(f,.3,'sine',.1,i*.08)),
 done:()=>[523,659,784,1047,1319].forEach((f,i)=>blip(f,.25,'triangle',.12,i*.11)),
 siren:()=>{for(let i=0;i<3;i++){blip(560,.45,'sine',.045,i*.9,880);blip(880,.45,'sine',.045,i*.9+.45,560)}},
 whistle:()=>blip(1400,.9,'sine',.025,0,300),
 boom:v=>{blip(70,.7,'sawtooth',.16*v,0,28);blip(150,.35,'square',.06*v,0,40)}
};

/* ===== 8. Building missions ===== */
const ring=(n,o,dy,b)=>{const a=[];for(let i=0;i<n;i++)for(let j=0;j<n;j++)if(i===0||j===0||i===n-1||j===n-1)a.push([o+i,dy,o+j,b]);return a};
const MISSIONS=[
 {name:'The Well',x:58,z:44,idea:'Count the blocks around a square: a ring with 3 blocks on each side needs 8 blocks.',reward:B.MARBLE,
  know:'Oases appear where water comes up from under the ground. Travellers stopped at wells to rest and drink.',
  cells:()=>ring(3,0,0,B.STONE)},
 {name:'Garden Wall',x:63,z:44,idea:'Area means covering a surface: a wall 6 long and 3 high has 6 x 3 = 18 blocks.',reward:B.BLUE,
  know:'Mud brick is one of the oldest building materials. It helps keep houses cool in hot places.',
  cells:()=>{const a=[];for(let i=0;i<6;i++)for(let y=0;y<3;y++)a.push([i,y,0,B.MUD]);return a}},
 {name:'The Gate',x:71,z:44,idea:'Mirror symmetry: the left half of the gate is a mirror picture of the right half.',reward:B.GREEN,
  know:'Many arches and gates in Islamic buildings are symmetrical, so one side matches the other.',
  cells:()=>{const rows=['.###.','##.##','#...#','#...#','#...#'],a=[];rows.forEach((r,i)=>[...r].forEach((c,x)=>{if(c==='#')a.push([x,4-i,0,B.SANDSTONE])}));return a}},
 {name:'Tiled Courtyard',x:80,z:44,idea:'A pattern repeats: a 5 x 5 checkerboard has 25 tiles, 13 blue and 12 white. Odd and even take turns!',reward:B.LANTERN,
  know:'Tiled courtyards with geometric patterns are found in many homes and mosques. Makers used squares, circles and stars.',
  cells:()=>{const a=[];for(let i=0;i<5;i++)for(let j=0;j<5;j++)a.push([i,0,j,(i+j)%2?B.MARBLE:B.BLUE]);return a}},
 {name:'The Minaret',x:58,z:53,idea:'Volume is length x width x height: 2 x 2 x 8 = 32 blocks, plus 1 lantern = 33 blocks.',reward:B.GOLD,
  know:'A minaret is a tall tower next to a mosque. Its height helps people see and hear it from far away.',
  cells:()=>{const a=[];for(let i=0;i<2;i++)for(let j=0;j<2;j++)for(let y=0;y<8;y++)a.push([i,y,j,B.MARBLE]);a.push([0,8,0,B.LANTERN]);return a}},
 {name:'The Dome',x:63,z:53,idea:'Square numbers: the rings hold 24, 16, 8 and 1 blocks. Together that is 49, which is 7 x 7. Marble walls first, then a gold roof!',reward:B.SHELF,
  know:'Domes can cover a big room without pillars in the middle. Builders used geometry to shape them.',
  cells:()=>[...ring(7,0,0,B.MARBLE),...ring(5,1,1,B.GOLD),...ring(3,2,2,B.GOLD),[3,3,3,B.GOLD]]},
 {name:'House of Wisdom',x:73,z:53,idea:'Count in twos: 2 layers of 11 wall blocks make 22, plus 4 bookshelves = 26 blocks.',reward:B.LATTICE,
  know:'The House of Wisdom in Baghdad was a famous place where scholars translated, wrote and shared books over 1,000 years ago.',
  cells:()=>{const a=[];for(let y=0;y<2;y++){for(const c of ring(4,0,y,B.SANDSTONE))if(!(c[0]===1&&c[2]===0))a.push(c);a.push([1,y,2,B.SHELF],[2,y,2,B.SHELF])}return a}}
];
let ghostCells=[],ghostMap=new Map(),missionDone=false;
function startMission(i,clear){
 S.mission=i;ghostCells=[];ghostMap=new Map();missionDone=false;
 if(i<MISSIONS.length){
  const m=MISSIONS[i];
  ghostCells=m.cells().map(c=>[m.x+OX+c[0],PLOT_Y+1+c[1],m.z+OZ+c[2],c[3]]);
  for(const g of ghostCells){
   ghostMap.set(gkey(g[0],g[1],g[2]),g[3]);
   if(!S.unlocked.includes(g[3]))S.unlocked.push(g[3]);
   const cur=getAny(g[0],g[1],g[2]);
   if(clear&&cur!==g[3]&&cur!==0)setBlock(g[0],g[1],g[2],0,2);
  }
  const need=ghostCells.map(g=>g[3]);for(const id of need)hotbarEnsure(id,need);
 }
 rebuildGhost();updateMissionUI();buildHotbar();
}
let missionMin=false;
const missionCount=()=>ghostCells.reduce((n,g)=>n+(getAny(g[0],g[1],g[2])===g[3]?1:0),0);
function checkMission(){
 if(S.mission>=MISSIONS.length)return;
 rebuildGhost();updateMissionUI();
 if(!missionDone&&missionCount()===ghostCells.length)completeMission();
}
function completeMission(){
 missionDone=true;
 const m=MISSIONS[S.mission];
 S.stars+=5;S.skills.building++;sfx.done();confetti();
 const reward=m.reward;let rewardTxt='';
 if(!S.unlocked.includes(reward)){S.unlocked.push(reward);rewardTxt=`<p><b>New block unlocked: ${DEFS[reward].name}</b></p>`}
 hotbarEnsure(reward);
 const next=S.mission+1;
 S.mission=next;queueSave();updateHud();buildHotbar();
 modal(`<svg class="motif i"><use href="#star8"/></svg><h2>${m.name} is built!</h2><p>+5 stars</p>${rewardTxt}
  <div class="why"><b>Did you know?</b><br>${m.know}</div>
  <div class="row"><button class="btn" data-a="ok">${next<MISSIONS.length?'Next mission':'Keep building'}</button></div>`,
  p=>{p.querySelector('[data-a=ok]').onclick=()=>{closeModal();startMission(next,true);if(next<MISSIONS.length)missionIntro(true)}});
}
function missionIntro(turn){
 if(S.mission>=MISSIONS.length)return;
 const m=MISSIONS[S.mission];
 modal(`<span class="tag">Mission ${S.mission+1} of ${MISSIONS.length}</span><h2>${m.name}</h2><p>${m.idea}</p>
  <p>Fill the glowing blueprint with blocks. Pick the right block in the hotbar and tap the glowing cubes. Tap Show me to find the blueprint.</p>
  <div class="row"><button class="btn" data-a="go">Let's build!</button></div>`,
  p=>{p.querySelector('[data-a=go]').onclick=()=>{closeModal();missionMin=true;updateMissionUI();if(turn&&missionNear())faceMission()}});
}
function missionCenter(){
 const cs=ghostCells,n=cs.length;
 return[cs.reduce((a,g)=>a+g[0]+.5,0)/n,cs.reduce((a,g)=>a+g[1]+.5,0)/n,cs.reduce((a,g)=>a+g[2]+.5,0)/n];
}
function missionNear(){const c=missionCenter();return Math.hypot(c[0]-player.x,c[2]-player.z)<=40}
/* turns the view to the blueprint; never moves the player */
function faceMission(){
 if(S.mission>=MISSIONS.length)return;
 const m=MISSIONS[S.mission],c=missionCenter();
 const dx=c[0]-player.x,dz=c[2]-player.z,dy=c[1]-(player.y+1.62);
 player.yaw=Math.atan2(-dx,-dz);player.pitch=clamp(Math.atan2(dy,Math.hypot(dx,dz)),-1.2,1.2);
 toast(m.name);
}
/* the explicit "Show me" button: when far away it asks before taking the player back */
function showMe(){
 if(S.mission>=MISSIONS.length)return;
 if(!missionNear()){
  modal(`<h2>Go back to the building plot?</h2><p>The blueprint is far from here.</p>
   <div class="row"><button class="btn alt" data-a="stay">Stay here</button><button class="btn" data-a="yes">Yes</button></div>`,
   p=>{p.querySelector('[data-a=stay]').onclick=closeModal;
    p.querySelector('[data-a=yes]').onclick=()=>{closeModal();spawnPlayer();faceMission()}});
  return;
 }
 faceMission();
}
function updateMissionUI(){
 const el=$('mission');
 if(S.mission>=MISSIONS.length){el.classList.remove('min');el.innerHTML='<span class="mt">Free building</span><p class="md">All missions done! Build anything you can imagine.</p>';return}
 const m=MISSIONS[S.mission],c=missionCount(),n=ghostCells.length;
 el.classList.toggle('min',missionMin);
 el.innerHTML=`<span class="mt">${m.name}</span><span class="mc">${c}/${n}</span><button class="btn alt sm" id="btnShow">Show me</button><button class="mtog" id="mtog" aria-label="${missionMin?'Show mission details':'Hide mission details'}">${missionMin?'+':'\u2212'}</button>
  <div class="bar"><i style="width:${c/n*100}%"></i></div><p class="md">${m.idea}</p>`;
 $('btnShow').onclick=showMe;$('mtog').onclick=()=>{missionMin=!missionMin;updateMissionUI()};
}

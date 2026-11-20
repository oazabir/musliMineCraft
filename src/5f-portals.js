/* ===== 8e. Stargate portals: three gates around the start, and a gate home at each place ===== */
/* A gate is a ring of stone segments with a turning glyph ring and nine chevrons around a rippling event horizon.
   Walking through the horizon locks the chevrons, the horizon bursts out (the "kawoosh"), the screen warps and the
   player steps out in front of the gate at the other end. Gates are drawn, not built from blocks: only their
   marble pad is part of the world (genPortals), so they can not be broken. */
/* PS scales the whole gate (0.6 = 40% smaller than the first design) */
const PS=.6,PR=2.7*PS,PSEG=40,PRING=9,PHS=48,PHR=PR-.5*PS;
let PORT=null;
function portalList(){
 if(PORT)return PORT;
 const mk=(x,z,nx,nz,name,to)=>{const n=Math.hypot(nx,nz)||1;nx/=n;nz/=n;const cx=Math.floor(x)+.5,cz=Math.floor(z)+.5;
  const base=Math.max(WL+1,groundTop(Math.floor(x),Math.floor(z)));
  return{x:cx,z:cz,nx,nz,tx:-nz,tz:nx,base,cy:base+1+PR-.05,name,to,spin:Math.random()*6,act:0,kw:0}};
 const sx=START.x+.5,sz=START.z+.5,toS=(x,z)=>[sx-x,sz-z];
 /* 0-2 stand around the start and face it; 3-5 stand at the places, face them, and lead back */
 PORT=[mk(1027,1006,...toS(1027,1006),'Museum of Islamic Heritage',3),mk(998,1006,...toS(998,1006),'Grand Mosque',4),
  mk(1026,1041,...toS(1026,1041),'Open Air Prison',5),
  /* beside each place, never on its entrance path: east of the museum's avenue and south of the Grand Mosque's
     plaza, each turned to face its building */
  mk(museumLm().x+20,museumLm().z+52,-20,-79,'the start',0),mk(950,1019,916-950,995-1019,'the start',1),mk(GZ.x,GZ.z+GZ.hz-3,0,-1,'the start',2)];
 return PORT;
}
portalList();
/* the gate's marble pad (5 x 9, carved border) with the space above it cleared */
function portalPad(x,z,m){for(const p of PORT){const dx=x+.5-p.x,dz=z+.5-p.z;if(Math.abs(dx*p.tx+dz*p.tz)<=2.6+m&&Math.abs(dx*p.nx+dz*p.nz)<=4.1+m)return p}return null}
function genPortals(x0,z0){
 for(const p of PORT){if(p.x+6<x0||p.x-6>x0+16||p.z+6<z0||p.z-6>z0+16)continue;
  for(let z=z0;z<z0+16;z++)for(let x=x0;x<x0+16;x++){const dx=x+.5-p.x,dz=z+.5-p.z,a=Math.abs(dx*p.tx+dz*p.tz),b=Math.abs(dx*p.nx+dz*p.nz);if(a>2.6||b>4.1)continue;
   for(let y=Math.max(1,p.base-4);y<p.base;y++)put(x,y,z,B.LIME);
   put(x,p.base,z,a>1.6||b>3.1?B.LIMEP:B.MARBLE);
   for(let y=p.base+1;y<=p.base+8;y++)put(x,y,z,0);
  }}
}
/* --- drawing: opaque ring parts, the translucent horizon, and additive glow --- */
const PO=new Float32Array(7*36*320),PT=new Float32Array(7*3*7200),PA=new Float32Array(7*3*2400);
let pBuf=null,pN=[0,0,0],pTime=0;
const PBC=new Float32Array(24),PLIT=[1,1,1];
function pbox(o,cx,cy,cz,ux,uy,uz,vx,vy,vz,wx,wy,wz,hu,hv,hw,r,g,b,lit){
 if(o+252>PO.length)return o;
 for(let i=0;i<8;i++){const su=i&1?hu:-hu,sv=i&2?hv:-hv,sw=i&4?hw:-hw;PBC[i*3]=cx+ux*su+vx*sv+wx*sw;PBC[i*3+1]=cy+uy*su+vy*sv+wy*sw;PBC[i*3+2]=cz+uz*su+vz*sv+wz*sw}
 const am=lit?PLIT:sky.amb;
 for(const q of FQ){const s=lit?1:q[4];for(const k of QI){const p=q[k]*3;PO[o++]=PBC[p];PO[o++]=PBC[p+1];PO[o++]=PBC[p+2];PO[o++]=r*s*am[0];PO[o++]=g*s*am[1];PO[o++]=b*s*am[2];PO[o++]=1}}
 return o;
}
function ptri(A,o,ax,ay,az,bx,by,bz,cx,cy,cz,c1,c2,c3){
 if(o+21>A.length)return o;
 A[o++]=ax;A[o++]=ay;A[o++]=az;A[o++]=c1[0];A[o++]=c1[1];A[o++]=c1[2];A[o++]=c1[3];
 A[o++]=bx;A[o++]=by;A[o++]=bz;A[o++]=c2[0];A[o++]=c2[1];A[o++]=c2[2];A[o++]=c2[3];
 A[o++]=cx;A[o++]=cy;A[o++]=cz;A[o++]=c3[0];A[o++]=c3[1];A[o++]=c3[2];A[o++]=c3[3];return o;
}
const HC=[];for(let i=0;i<=PRING;i++){HC.push([]);for(let s=0;s<=PHS;s++)HC[i].push([0,0,0,[0,0,0,0]])}
function portalGeo(p,t,o){
 const C=[p.x,p.cy,p.z],T=[p.tx,0,p.tz],N=[p.nx,0,p.nz];
 const near=Math.hypot(player.x-p.x,player.z-p.z)<14;
 for(let k=0;k<PSEG;k++){
  const th=k/PSEG*6.2832,c=Math.cos(th),s=Math.sin(th),rx=T[0]*c,ry=s,rz=T[2]*c,vx=-T[0]*s,vy=c,vz=-T[2]*s,sh=k%2?.04:0;
  o[0]=pbox(o[0],C[0]+rx*PR,C[1]+ry*PR,C[2]+rz*PR,rx,ry,rz,vx,vy,vz,N[0],0,N[2],.3*PS,PR*.082,.34*PS,.34+sh,.37+sh,.42+sh);
  /* the inner glyph ring turns; every fourth glyph glows */
  const t2=th+p.spin,c2=Math.cos(t2),s2=Math.sin(t2),Rx=T[0]*c2,Ry=s2,Rz=T[2]*c2,Vx=-T[0]*s2,Vy=c2,Vz=-T[2]*s2,ri=PR-.42*PS;
  const g=k%4===0,pul=.65+.35*Math.sin(t*3+k);
  o[0]=pbox(o[0],C[0]+Rx*ri,C[1]+Ry*ri,C[2]+Rz*ri,Rx,Ry,Rz,Vx,Vy,Vz,N[0],0,N[2],.13*PS,ri*.077,.26*PS,g?.3*pul+.1:.5,g?.8*pul+.1:.47,g?1:.42,g);
 }
 for(let j=0;j<9;j++){
  const th=1.5708+j*.6981,c=Math.cos(th),s=Math.sin(th),rx=T[0]*c,ry=s,rz=T[2]*c,vx=-T[0]*s,vy=c,vz=-T[2]*s;
  const on=p.act>0?j<p.act*12:false,b=on?1.25:near?.75+.2*Math.sin(t*4+j):.55;
  o[0]=pbox(o[0],C[0]+rx*(PR+.26*PS),C[1]+ry*(PR+.26*PS),C[2]+rz*(PR+.26*PS),rx,ry,rz,vx,vy,vz,N[0],0,N[2],.22*PS,.3*PS,.44*PS,b,.42*b+(on?.2:0),.12*b,true);
 }
 /* event horizon: rings of rippling blue that burst out along the normal when the gate opens */
 const kw=p.kw>0?Math.sin(Math.min(1,p.kw)*3.1416)*3.2*PS:0;
 for(let i=0;i<=PRING;i++){const r=PHR*i/PRING,q=1-r/PHR;
  for(let s=0;s<=PHS;s++){const ph=s/PHS*6.2832,w=Math.sin(r*4.6-t*5+Math.sin(ph*3+t*1.3)*.9),k=.5+.5*w,bl=kw*q*q+(near?.04*w:0);
   const H=HC[i][s];H[0]=C[0]+T[0]*Math.cos(ph)*r+N[0]*bl;H[1]=C[1]+Math.sin(ph)*r;H[2]=C[2]+T[2]*Math.cos(ph)*r+N[2]*bl;
   const ctr=q*q*.35;H[3][0]=.08+.42*k+ctr;H[3][1]=.3+.55*k+ctr;H[3][2]=.85+.15*k;H[3][3]=.78+.12*q+(p.act>0?.1:0)}}
 for(let i=0;i<PRING;i++)for(let s=0;s<PHS;s++){const a=HC[i][s],b=HC[i][s+1],c=HC[i+1][s+1],d=HC[i+1][s];
  o[1]=ptri(PT,o[1],a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2],a[3],b[3],c[3]);o[1]=ptri(PT,o[1],a[0],a[1],a[2],c[0],c[1],c[2],d[0],d[1],d[2],a[3],c[3],d[3])}
 /* additive halo around the ring and drifting sparkles on the horizon */
 const hi=[.35,.75,1,.3+(p.act>0?.45:0)+.08*Math.sin(t*2)],ho=[.35,.75,1,0];
 for(let s=0;s<PHS;s++){const a0=s/PHS*6.2832,a1=(s+1)/PHS*6.2832,r0=PR+.35*PS,r1=PR+1.4*PS;
  const P=(a,r)=>[C[0]+T[0]*Math.cos(a)*r,C[1]+Math.sin(a)*r,C[2]+T[2]*Math.cos(a)*r];
  const A=P(a0,r0),Bp=P(a1,r0),Cc=P(a1,r1),D=P(a0,r1);
  o[2]=ptri(PA,o[2],...A,...Bp,...Cc,hi,hi,ho);o[2]=ptri(PA,o[2],...A,...Cc,...D,hi,ho,ho)}
 for(let k=0;k<18;k++){const h=hash2(k,p.to,9),a=h*6.2832+t*(.2+h*.3),r=PHR*((h*7.3+t*.15)%1),sz=.025+.025*h,f=.06+.02*Math.sin(t*3+k);
  const x=C[0]+T[0]*Math.cos(a)*r+N[0]*f,y=C[1]+Math.sin(a)*r,z=C[2]+T[2]*Math.cos(a)*r+N[2]*f,cl=[.85,.97,1,.55];
  o[2]=ptri(PA,o[2],x-T[0]*sz,y-sz,z-T[2]*sz,x+T[0]*sz,y-sz,z+T[2]*sz,x+T[0]*sz,y+sz,z+T[2]*sz,cl,cl,cl);
  o[2]=ptri(PA,o[2],x-T[0]*sz,y-sz,z-T[2]*sz,x+T[0]*sz,y+sz,z+T[2]*sz,x-T[0]*sz,y+sz,z-T[2]*sz,cl,cl,cl)}
}
const pObj=[{b:null,n:0},{b:null,n:0},{b:null,n:0}];
function portalDraw(now){
 if(!(playing||glide))return;
 const t=now/1000,e=cam.e,fw=cam.fw,lim=(farFog+12)*(farFog+12),o=[0,0,0];
 for(const p of PORT){const dx=p.x-e[0],dz=p.z-e[2];if(dx*dx+dz*dz>lim||dx*fw[0]+(p.cy-e[1])*fw[1]+dz*fw[2]<-PR-2)continue;portalGeo(p,t,o)}
 if(!o[0]&&!o[1])return;
 if(!pBuf||!gl.isBuffer(pBuf[0]))pBuf=[gl.createBuffer(),gl.createBuffer(),gl.createBuffer()];
 const arrs=[PO,PT,PA];
 for(let i=0;i<3;i++){pObj[i].b=pBuf[i];pObj[i].n=o[i]/7;if(!o[i])continue;gl.bindBuffer(gl.ARRAY_BUFFER,pBuf[i]);gl.bufferData(gl.ARRAY_BUFFER,arrs[i].subarray(0,o[i]),gl.DYNAMIC_DRAW)}
 drawColor(pObj[0],gl.TRIANGLES,1,1);
 gl.enable(gl.BLEND);gl.depthMask(false);
 gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);drawColor(pObj[1],gl.TRIANGLES,1,.6);
 gl.blendFunc(gl.SRC_ALPHA,gl.ONE);drawColor(pObj[2],gl.TRIANGLES,1,.5);
 gl.depthMask(true);gl.disable(gl.BLEND);
}
/* --- sound: everything is synthesised (Web Audio), nothing is downloaded --- */
let pNoise=null,pHum=null;
function pAudio(){return actx&&S.settings.sound?actx:null}
function noiseBuf(a){if(!pNoise){const n=a.sampleRate,b=a.createBuffer(1,n,n),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;pNoise=b}return pNoise}
function sweep(a,t0,dur,f0,f1,type,vol){const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(f0,t0);o.frequency.exponentialRampToValueAtTime(f1,t0+dur);
 g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(vol,t0+dur*.25);g.gain.exponentialRampToValueAtTime(.0001,t0+dur);o.connect(g);g.connect(a.destination);o.start(t0);o.stop(t0+dur+.05)}
function whoosh(a,t0,dur,f0,f1,vol){const s=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain();s.buffer=noiseBuf(a);f.type='bandpass';f.Q.value=1.4;
 f.frequency.setValueAtTime(f0,t0);f.frequency.exponentialRampToValueAtTime(f1,t0+dur*.7);g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(vol,t0+dur*.35);g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
 s.connect(f);f.connect(g);g.connect(a.destination);s.start(t0);s.stop(t0+dur+.05)}
const psfx={
 /* chevrons lock (clicks), the horizon bursts (noise swell + rising tone), then the jump (deep whoosh) */
 open:()=>{const a=pAudio();if(!a)return;try{const t=a.currentTime;for(let j=0;j<4;j++){sweep(a,t+j*.07,.09,1500,700,'square',.05)}
  whoosh(a,t+.15,.9,220,2800,.32);sweep(a,t+.15,.9,90,760,'sine',.16);sweep(a,t+.45,.7,180,1400,'triangle',.06)}catch(e){}},
 arrive:()=>{const a=pAudio();if(!a)return;try{const t=a.currentTime;whoosh(a,t,.8,2600,260,.22);sweep(a,t,.5,140,46,'sine',.2);
  [784,988,1175,1568,1976].forEach((f,i)=>sweep(a,t+.2+i*.06,.7,f,f*1.01,'triangle',.05))}catch(e){}}
};
/* a soft two-note hum near a gate */
function portalHum(dt,d){
 const a=pAudio();
 if(!a){if(pHum)pHum.g.gain.setTargetAtTime(0,actx.currentTime,.1);return}
 try{if(!pHum){const g=a.createGain();g.gain.value=0;g.connect(a.destination);const o1=a.createOscillator(),o2=a.createOscillator(),lfo=a.createOscillator(),lg=a.createGain();
   o1.type='sine';o1.frequency.value=55;o2.type='sine';o2.frequency.value=82.5;lfo.frequency.value=.35;lg.gain.value=12;lfo.connect(lg);lg.connect(o2.frequency);
   o1.connect(g);o2.connect(g);o1.start();o2.start();lfo.start();pHum={g}}
  const v=document.hidden||!playing||curModal?0:.07*clamp(1-d/16,0,1);pHum.g.gain.setTargetAtTime(v,a.currentTime,.25)}catch(e){}
}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&pHum&&actx)try{pHum.g.gain.setValueAtTime(0,actx.currentTime)}catch(e){}});
/* --- walking through a gate --- */
let TP=null,tpCd=0;
function portalTick(dt){
 let best=1e9;tpCd-=dt;
 for(const p of PORT){
  const dx=player.x-p.x,dz=player.z-p.z,d=Math.hypot(dx,dz);if(d<best)best=d;
  p.spin+=dt*(p.act>0?2.4:d<14?.35:.12);
  if(p.kw>0){p.kw+=dt*1.6;if(p.kw>=1)p.kw=0}
  if(p.act>0&&!(TP&&(TP.p===p||TP.d===p))){p.act=Math.max(0,p.act-dt*.6)}
  if(d>8)continue;
  /* stepping into the horizon (from either side) opens the gate while it is still in front of the player */
  const dn=dx*p.nx+dz*p.nz,dl=dx*p.tx+dz*p.tz,dy=player.y+1-p.cy;
  if(!TP&&tpCd<=0&&Math.abs(dn)<1.5&&dl*dl+dy*dy<(PHR-.25*PS)*(PHR-.25*PS)){startTP(p);return}
 }
 portalHum(dt,best);
}
function startTP(p){
 const d=PORT[p.to];TP={t:0,p,d,moved:false,from:[player.x,player.y,player.z],side:(player.x-p.x)*p.nx+(player.z-p.z)*p.nz>=0?1:-1};p.act=.01;p.kw=.01;
 input.jx=input.jy=0;input.jump=false;input.keys.clear();psfx.open();
 const w=$('warp');w.style.display='block';w.style.opacity='0';$('app').classList.add('warping');
}
function tpStep(dt){
 const T=TP;T.t+=dt;const t=T.t;
 T.p.act=Math.min(1,T.p.act+dt*1.8);
 if(!T.moved){
  /* pulled into the gate: drift to its centre, field of view stretches, the tunnel fades in */
  const k=sstep(0,.75,t),gx=T.p.x+T.p.nx*T.side*.15,gz=T.p.z+T.p.nz*T.side*.15;player.x=lerp(T.from[0],gx,k);player.z=lerp(T.from[2],gz,k);player.vx=player.vy=player.vz=0;
  fovKick=1.05*sstep(.1,.8,t);$('warp').style.opacity=sstep(.2,.8,t).toFixed(3);
  if(t>=.8){T.moved=true;const d=T.d,ax=d.x+d.nx*2.8,az=d.z+d.nz*2.8;
   /* step out onto the far gate's marble pad (always dry and clear), facing away from the gate */
   forceLoad(Math.floor(ax/16),Math.floor(az/16),2);placeSafe(ax,az,Math.atan2(-d.nx,-d.nz),-.08,d.base+1);
   d.kw=.01;d.act=1;psfx.arrive()}
  return;
 }
 fovKick=1.05*(1-sstep(.8,1.6,t));$('warp').style.opacity=(1-sstep(.85,1.6,t)).toFixed(3);
 if(t>=1.6){TP=null;tpCd=1;fovKick=0;const w=$('warp');w.style.display='none';w.style.opacity='0';$('app').classList.remove('warping');toast(`Welcome to ${T.d.name==='the start'?T.p.name:'the start'}`)}
}
/* --- labels above the gates --- */
let ptEls=null;
function updatePortalLabels(){
 if(!ptEls){ptEls=[];const box=$('tags');for(let i=0;i<3;i++){const d=document.createElement('div');d.className='ntag portal';d.style.display='none';d.innerHTML='<span></span>';box.appendChild(d);ptEls.push({d,s:d.firstChild,txt:'',shown:false,w:0})}}
 const on=playing&&!curModal&&!FLY&&!TP,list=[];
 if(on)for(const p of PORT){const d=Math.hypot(p.x-player.x,p.z-player.z);if(d<34)list.push([d,p])}
 list.sort((a,b)=>a[0]-b[0]);
 for(let i=0;i<ptEls.length;i++){
  const E=ptEls[i],it=list[i];let show=false;
  if(it){const p=it[1],q=project(p.x,p.cy+PR+.9,p.z);
   if(q){const x=(q[0]*.5+.5)*vw,y=(.5-q[1]*.5)*vh;
    if(x>-60&&x<vw+60&&y>-40&&y<vh){show=true;
     if(!E.shown){E.shown=true;E.d.style.display='block';E.w=0}
     const txt=p.name==='the start'?'Portal back to the start':`Portal to ${p.name}`;
     if(txt!==E.txt){E.txt=txt;E.s.textContent=txt;E.w=0}
     if(!E.w)E.w=E.d.offsetWidth;
     E.d.style.transform=`translate(${clamp(x-E.w/2,6,vw-E.w-6)|0}px,${Math.max(hudBot,y-30)|0}px)`;
    }}}
  if(!show&&E.shown){E.shown=false;E.d.style.display='none'}
 }
}
/* test hooks */
window.__portals=()=>PORT.map(p=>({x:p.x,z:p.z,nx:p.nx,nz:p.nz,base:p.base,cy:p.cy,name:p.name,to:p.to}));
window.__tpState=()=>TP?{on:true,t:TP.t,moved:TP.moved,from:TP.p.name,to:TP.d.name}:{on:false};

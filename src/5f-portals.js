/* ===== 8e. Stargate portals: gates around the start and a return gate at each place ===== */
/* The frame is drawn separately from the world blocks so the gate cannot be broken. */
const PS=.43,PR=2.7*PS,PHR=PR-.5*PS,PGS=.6,PGY=.72,PGZ=.72;
const PORT_ROWS=[[1,.76,.32],[1.32,1.08,.35],[1.67,1.27,2.4],[4.07,1.08,.34],[4.41,.76,.33]];
let PORT=null;
function portalList(){
 if(PORT)return PORT;
 const mk=(x,z,nx,nz,name,to,level)=>{
  if(Math.abs(nx)>=Math.abs(nz)){nx=Math.sign(nx);nz=0}else{nz=Math.sign(nz);nx=0}
  const cx=Math.floor(x)+.5,cz=Math.floor(z)+.5;
  const base=level??Math.max(WL+1,groundTop(Math.floor(x),Math.floor(z)));
  return{x:cx,z:cz,nx,nz,tx:-nz,tz:nx,base,cy:base+1+PR-.05,name,to,act:0,kw:0}};
 const haram=lmOf('haram'),museum=museumLm();
 const hub=(i,name,to)=>{const s=(i-(GATE_HUB.count-1)/2)*GATE_HUB.step;return mk(GATE_HUB.x+GATE_HUB.tx*s,GATE_HUB.z+GATE_HUB.tz*s,GATE_HUB.nx,GATE_HUB.nz,name,to,GATE_HUB.y)};
 /* Keep the original four pairs at their existing indices. */
 PORT=[hub(0,'Museum of Islamic Heritage',4),hub(1,'Grand Mosque',5),hub(2,'Open Air Prison',6),hub(3,'Masjid al-Haram and the Kaaba',7),
  mk(museum.x+20,museum.z+52,-20,-79,'the start',0),mk(950,1019,916-950,995-1019,'the start',1),
  mk(GZ.x,GZ.z+GZ.hz-3,0,-1,'the start',2),mk(haram.x+haram.ex+8,haram.z+4,-1,0,'the start',3)];
 for(let i=0;i<FEATURED_LMS.length;i++){
  const f=FEATURED_LMS[i],l=lmOf(f.t),j=PORT.length;
  const dx=f.t==='petra'?8:l.ex+10,dz=l.ez+10;
  PORT.push(hub(i+4,f.name,j+1),mk(l.x+dx,l.z+dz,-dx,-dz,'the start',j));
 }
 return PORT;
}
portalList();
const MAP_PLACES=[{name:'Abu Dhabi spawn',region:'Abu Dhabi, UAE',x:START.x,z:START.z},
 ...[['Abu Dhabi, UAE',museumLm()],['Abu Dhabi, UAE',lmOf('mosque',0)],['Island',GZ],['Makkah, Saudi Arabia',lmOf('haram')]]
 .map(([region,l],i)=>({name:PORT[i].name,region,x:l.x,z:l.z,gate:PORT[PORT[i].to]})),
 ...FEATURED_LMS.map(f=>{const l=lmOf(f.t),p=PORT.find(g=>g.name===f.name);return{name:f.name,region:f.region,x:l.x,z:l.z,gate:PORT[p.to]}})];
/* the gate's marble pad (5 x 9, carved border) with the space above it cleared */
function portalPad(x,z,m){for(const p of PORT){const dx=x+.5-p.x,dz=z+.5-p.z;if(Math.abs(dx*p.tx+dz*p.tz)<=2.6+m&&Math.abs(dx*p.nx+dz*p.nz)<=4.1+m)return p}return null}
function genPortals(x0,z0){
 for(const p of PORT){if(p.x+6<x0||p.x-6>x0+16||p.z+6<z0||p.z-6>z0+16)continue;
  for(let z=z0;z<z0+16;z++)for(let x=x0;x<x0+16;x++){const dx=x+.5-p.x,dz=z+.5-p.z,a=Math.abs(dx*p.tx+dz*p.tz),b=Math.abs(dx*p.nx+dz*p.nz);if(a>2.6||b>4.1)continue;
   for(let y=Math.max(1,p.base-4);y<p.base;y++)put(x,y,z,B.LIME);
   put(x,p.base,z,a>1.6||b>3.1?B.LIMEP:B.MARBLE);
   for(let y=p.base+1;y<=p.base+8;y++)put(x,y,z,0);
  }}
 const hub=GATE_HUB,wallX=Math.floor(hub.x)-2,half=(hub.count-1)*hub.step/2+2;
 if(wallX>=x0&&wallX<x0+16){
  for(let z=z0;z<z0+16;z++)if(Math.abs(z+.5-hub.z)<=half){
   for(let y=hub.y+1;y<hub.y+8;y++)put(wallX,y,z,B.LIME);
   put(wallX,hub.y+8,z,B.LIMEP);
  }
 }
}
/* --- drawing: masonry, portal surface, and sparks --- */
const PO=new Float32Array(252*240*PORT.length),PT=new Float32Array(42*624*PORT.length),PA=new Float32Array(42*40*PORT.length),PE=new Float32Array(42*4200);
let pBuf=null,pTextN=0,pTextUploaded=false;
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
/* Cache a low resolution elevation from the destination's block generator. */
const PVW=30,PVH=40;
function portalPreview(p){
 const out=new Float32Array(PVW*PVH*3),place=MAP_PLACES.find(q=>q.gate===PORT[p.to]);
 const l=place&&fixedList().find(q=>q.x===place.x&&q.z===place.z);
 const span=l?Math.max(l.hx*1.9,l.h*.32):22,high=l?Math.max(l.h+1,span*1.3):18;
 for(let j=0;j<PVH;j++)for(let i=0;i<PVW;i++){
  const u=(i+.5)/PVW,v=(j+.5)/PVH,x=Math.round((u-.5)*span),y=Math.floor(v*high)-1;
  let col=[.20+.16*v,.13+.13*v,.40+.22*v];
  if(l&&Math.abs(x)<=l.hx&&y>=l.ymin&&y<=l.h){
   for(let z=l.hz;z>=-l.hz;z--){
    const b=l.fn(l,x,y,z);
    if(b>0){col=GHOST_COL[b]||[.72,.62,.54];break}
   }
  }else if(place&&!l&&v<.30&&gzD(GZ.x+x,GZ.z)<0)col=[.45,.52,.30];
  else if(!place&&v<.54)col=v>.12&&v<.45&&i%4===1?[.48,.11,.70]:[.67,.52,.44];
  out.set(col,(j*PVW+i)*3);
 }
 return out;
}
function portalPreviewColor(img,u,v,k){
 const x=clamp(u*PVW-.5,0,PVW-1.001),y=clamp(v*PVH-.5,0,PVH-1.001);
 const i=Math.floor(x),j=Math.floor(y),a=(j*PVW+i)*3+k,b=a+PVW*3;
 return lerp(lerp(img[a],img[a+3],x-i),lerp(img[b],img[b+3],x-i),y-j);
}
function portalGeo(p,t,o){
 const near=Math.hypot(player.x-p.x,player.z-p.z)<14;
 const box=(x,y,z,w,h,d,v,lit=false)=>{
  o[0]=pbox(o[0],p.x+p.tx*x*PGS+p.nx*z*PGZ,p.base+1+(y-1)*PGY,p.z+p.tz*x*PGS+p.nz*z*PGZ,p.tx,0,p.tz,0,1,0,p.nx,0,p.nz,w*PGS/2,h*PGY/2,d*PGZ/2,...v,lit);
 };
 const stone=[.89,.85,.82],trim=[.99,.97,.94],shadow=[.72,.67,.63],green=[.27,.52,.16];
 for(const side of [-1,1]){
  box(side*1.72,1.09,0,1.65,.18,2.20,shadow);
  box(side*1.66,1.25,0,1.34,.14,1.84,trim);
  box(side*1.68,2.94,0,.82,3.24,1.05,stone);
  for(let j=0;j<8;j++)box(side*1.69,1.52+j*.39,0,.89,.09,1.14,j%2?stone:trim);
  box(side*2.17,2.94,-.10,.28,3.12,.62,shadow);
  for(const [y,x,w,d] of [[1.38,2.19,.57,1.27],[2.18,2.25,.50,.88],[3.80,2.26,.55,1.10],[4.87,2.34,.65,1.53],[5.04,2.51,.51,1.45]]){
   box(side*x,y,0,w,.19,d,y>4?trim:stone);
  }
  box(side*1.72,4.53,0,1.42,.22,1.36,trim);
  for(const face of [-1,1]){
   box(side*1.66,1.48,face*.61,.68,.27,.26,trim);
   const iron=[.17,.20,.22],brass=[.48,.34,.17];
   for(const [offset,depth,low,top] of [[2.39,.72,2.91,4.91],[1.48,1.04,2.66,4.79]]){
    const x=side*offset,z=face*depth;
    box(x,top,face*(depth+.32)/2,.16,.12,depth-.24,stone);
    for(let y=low+.20;y<top-.06;y+=.16){
     const flat=Math.round((y-low)*100)%32<16,w=flat?.105:.048,d=flat?.048:.105;
     box(x,y,z,w,.115,d,iron);
     box(x,y+.065,z,.038,.043,.038,iron);
    }
    box(x,low,z,.23,.24,.23,[1,.76,.33],true);
    box(x,low, z,.14,.17,.243,[1,.94,.67],true);
    box(x,low+.14,z,.29,.065,.29,brass);
    box(x,low-.14,z,.27,.065,.27,brass);
    for(const rail of [-1,1])box(x+rail*.106,low,z,.027,.24,.237,iron);
   }
   for(let j=0;j<5;j++){
    const x=side*(2.08+hash2(j,side,87)*.28);
    box(x,4.43-j*.34,face*.29,.22,.28,.22,j%2?green:[.49,.66,.22]);
   }
  }
  for(let j=0;j<5;j++)box(side*(1.29+j*.15),5.35+hash2(j,side,31)*.24,0,.26,.25,.51,j%2?green:[.49,.66,.22]);
 }
 box(0,1.035,0,5.98,.07,5.20,shadow);
 for(const face of [-1,1])for(let i=-2;i<=2;i++){
  const x=i*.96,z=face*(Math.abs(i)===2?1.82:2.22);
  box(x,1.06,z,.96,.12,.84,i%2?stone:trim);
  for(let j=-1;j<=1;j++)box(x+j*.16,1.126,z,.066,.014,.40,shadow);
 }
 for(const side of [-1,1])for(const z of [-.83,0,.83]){
  box(side*2.67,1.055,z,.68,.11,.83,stone);
  box(side*2.67,1.12,z,.40,.028,.46,trim);
 }
 box(0,1.08,0,1.52,.16,2.23,shadow);
 for(const [y,w,h] of PORT_ROWS){
  const edge=1.28;
  for(const side of [-1,1])if(w<edge)box(side*(w+edge)/2,y+h/2,0,edge-w,h,.89,shadow);
 }
 box(0,4.91,0,3.31,.35,1.33,stone);
 box(0,5.15,0,4.84,.16,1.66,trim);
 box(0,5.33,0,3.66,.20,1.30,stone);
 box(0,5.49,0,2.50,.12,1.03,trim);
 const kw=p.kw>0?Math.sin(p.kw*Math.PI)*1.5:0;
 const quad=(A,k,x,y,w,h,z,c,b=c,d=c,e=c)=>{
  x*=PGS;y=1+(y-1)*PGY;w*=PGS;h*=PGY;z*=PGZ;
  const X=p.x+p.tx*x+p.nx*z,Z=p.z+p.tz*x+p.nz*z,Y=p.base+y,dx=p.tx*w,dz=p.tz*w;
  o[k]=ptri(A,o[k],X,Y,Z,X+dx,Y,Z+dz,X+dx,Y+h,Z+dz,c,b,d);
  o[k]=ptri(A,o[k],X,Y,Z,X+dx,Y+h,Z+dz,X,Y+h,Z,c,d,e);
 };
 for(let row=0;row<PORT_ROWS.length;row++){
  const [y,w,h]=PORT_ROWS[row],cols=near?24:6,rows=Math.max(1,Math.round(h*(near?8:3)));
  const img=p.preview||(p.preview=portalPreview(p));
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
   const x=-w+2*w*i/cols,py=y+h*j/rows,dx=2*w/cols,dy=h/rows;
   const shade=(sx,sy)=>{
    const v=(sy-1)/3.74,u=.5+sx/2.54+.043*Math.sin(v*19+t*2.1);
    const glow=.035*(1+Math.sin(sy*6+sx*4-t*2)),c=[.12+glow+p.act*.13,.025+glow*.16,.24+glow,1];
    for(let k=0;k<3;k++)c[k]+=.135*(portalPreviewColor(img,u-.012,v,k)+portalPreviewColor(img,u+.012,v,k)+portalPreviewColor(img,u,v-.012,k)+portalPreviewColor(img,u,v+.012,k));
    return c;
   };
   quad(PT,1,x,py,dx,dy,kw,shade(x,py),shade(x+dx,py),shade(x+dx,py+dy),shade(x,py+dy));
  }
 }
 for(let i=0;i<(near?36:12);i++){
  const seed=hash2(i,p.to,12),y=1.06+3.6*((seed+t*(.11+seed*.08))%1);
  const row=PORT_ROWS.find(r=>y>=r[0]&&y<r[0]+r[2]);
  if(!row)continue;
  const x=(hash2(i,p.to,26)*2-1)*(row[1]-.09),size=.025+.05*seed;
  const face=(player.x-p.x)*p.nx+(player.z-p.z)*p.nz>=kw?1:-1;
  quad(PA,2,x,y,size,size,kw+face*.025,[.92,.19,1,.38+.36*Math.sin(t*5+i)**2]);
 }
}
const PGLYPH={A:'010/101/111/101/101',B:'110/101/110/101/110',C:'011/100/100/100/011',D:'110/101/101/101/110',E:'111/100/110/100/111',F:'111/100/110/100/100',G:'011/100/101/101/011',H:'101/101/111/101/101',I:'111/010/010/010/111',J:'001/001/001/101/010',K:'101/101/110/101/101',L:'100/100/100/100/111',M:'101/111/111/101/101',N:'101/111/111/111/101',O:'010/101/101/101/010',P:'110/101/110/100/100',Q:'010/101/101/111/011',R:'110/101/110/101/101',S:'011/100/010/001/110',T:'111/010/010/010/010',U:'101/101/101/101/111',V:'101/101/101/101/010',W:'101/101/111/111/101',X:'101/101/010/101/101',Y:'101/101/010/010/010',Z:'111/001/010/100/111','-':'000/000/111/000/000'};
const pObj=[{b:null,n:0},{b:null,n:0},{b:null,n:0},{b:null,n:0}];
function engraveQuad(o,p,x,y,z,s,c){
 const rx=-p.tx,rz=-p.tz,X=p.x+rx*x+p.nx*z,Z=p.z+rz*x+p.nz*z,dx=rx*s,dz=rz*s;
 o=ptri(PE,o,X,y,Z,X+dx,y,Z+dz,X+dx,y+s,Z+dz,c,c,c);
 return ptri(PE,o,X,y,Z,X+dx,y+s,Z+dz,X,y+s,Z,c,c,c);
}
function engraveText(o,p,text,cy,c,s=.08,width=8,z=-.43){
 const words=text.toUpperCase().split(/\s+/),lines=[];let line='';
 for(const w of words){const n=line?line+' '+w:w;if(n.length>width&&line){lines.push(line);line=w}else line=n}if(line)lines.push(line);
 const advance=s*4,gap=Math.min(.12,s*1.5),total=lines.length*s*5+(lines.length-1)*gap,top=cy+total/2;
 for(let r=0;r<lines.length;r++){
  const q=lines[r],left=-(q.length*advance-s)/2,ytop=top-r*(s*5+gap);
  for(let i=0;i<q.length;i++){
   if(q[i]===' ')continue;const rows=(PGLYPH[q[i]]||PGLYPH['-']).split('/');
   for(let yy=0;yy<5;yy++)for(let xx=0;xx<3;xx++)if(rows[yy][xx]==='1')o=engraveQuad(o,p,left+i*advance+xx*s,ytop-(yy+1)*s,z,s,c);
  }
 }
 return o;
}
function buildPortalEngraving(){
 if(pTextN)return;
 let o=0;const ink=[.08,.075,.07,1];
 for(const p of PORT)o=engraveText(o,p,p.name,p.base+1+3.91*PGY,ink,p.name.length>20?.0195:.022,20,.665*PGZ+.012);
 for(const l of fixedList()){
  const art=l.t==='dohaMia';if(!art&&l.t!=='museum')continue;
  const name=art?'Museum of Islamic Art':'Museum of Islamic Heritage';
  const facade={x:l.x+(art?-2.5:.5),z:l.z+(art?11:26-MZC),nx:0,nz:1,tx:-1,tz:0};
  o=engraveText(o,facade,name,l.y0+5.5,ink,.13,32,.015);
 }
 pTextN=o;
}
function portalDraw(now){
 if(!(playing||glide))return;
 buildPortalEngraving();
 const t=now/1000,e=cam.e,fw=cam.fw,lim=(farFog+12)*(farFog+12),o=[0,0,0,0];
 for(const p of PORT){const dx=p.x-e[0],dz=p.z-e[2];if(dx*dx+dz*dz>lim||dx*fw[0]+(p.cy-e[1])*fw[1]+dz*fw[2]<-PR-2)continue;portalGeo(p,t,o)}
 if(!o[0]&&!o[1]&&!o[2]&&!pTextN)return;
 if(!pBuf||!gl.isBuffer(pBuf[0])){pBuf=[gl.createBuffer(),gl.createBuffer(),gl.createBuffer(),gl.createBuffer()];pTextUploaded=false}
 const arrs=[PO,PT,PA,PE];
 for(let i=0;i<4;i++){
  pObj[i].b=pBuf[i];pObj[i].n=i===3?pTextN/7:o[i]/7;
  if(i===3){if(pTextUploaded)continue;gl.bindBuffer(gl.ARRAY_BUFFER,pBuf[i]);gl.bufferData(gl.ARRAY_BUFFER,arrs[i].subarray(0,pTextN),gl.STATIC_DRAW);pTextUploaded=true;continue}
  if(!o[i])continue;gl.bindBuffer(gl.ARRAY_BUFFER,pBuf[i]);gl.bufferData(gl.ARRAY_BUFFER,arrs[i].subarray(0,o[i]),gl.DYNAMIC_DRAW)
 }
 drawColor(pObj[0],gl.TRIANGLES,1,1);
 drawColor(pObj[3],gl.TRIANGLES,1,1);
 gl.enable(gl.BLEND);gl.depthMask(false);
 gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);drawColor(pObj[1],gl.TRIANGLES,1,.25);
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
/* test hooks */
window.__portals=()=>PORT.map(p=>({x:p.x,z:p.z,nx:p.nx,nz:p.nz,base:p.base,cy:p.cy,name:p.name,to:p.to}));
window.__tpState=()=>TP?{on:true,t:TP.t,moved:TP.moved,from:TP.p.name,to:TP.d.name}:{on:false};

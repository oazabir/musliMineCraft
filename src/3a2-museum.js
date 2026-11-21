/* ===== 3b. Museum of Islamic Heritage (original design) and far silhouettes ===== */
/* frame: mx=lx, mz=lz+27, y relative to y0. Building centre (0,0); floors (slab layers) 0,6,12,18; roof 24; tower to 31 */
const MZC=27;
const oct=(dx,dz,R)=>{const a=dx<0?-dx:dx,b=dz<0?-dz:dz;return a<=R&&b<=R&&a+b<=R*1.4142};
/* exhibit cases: [floor, side(-1 west,1 east), z]; 26 exhibits in the order of the museum list */
const EXP=[[0,-1,-17],[0,-1,-6],[0,-1,5],[0,1,-17],[0,1,-6],[0,1,5],[1,-1,-17],[1,-1,-6],[1,-1,5],[1,1,-17],[1,1,-6],[1,1,5],
 [2,-1,-18],[2,-1,-11],[2,-1,-4],[2,-1,3],[2,1,-17],[2,1,-8],[2,1,1],[3,-1,-18],[3,-1,-11],[3,-1,-4],[3,-1,3],[3,1,-17],[3,1,-8],[3,1,1]];
const EXK=new Map();EXP.forEach((e,i)=>EXK.set(e[0]*1000+(e[1]>0?200:0)+e[2]+100,i));
const exAt=(f,mx,mz)=>{const v=EXK.get(f*1000+(mx>0?200:0)+mz+100);return v===undefined?-1:v};
function galleryDivider(f,mx,mz){
 if(f<2)return mz===-12||mz===0;
 return mx<0?(mz===-15||mz===-8||mz===-1):(mz===-13||mz===-4);
}
const PLAQUE={mx:0,mz:15};
function palmB(dx,y,dz,th){
 const a=dx<0?-dx:dx,b=dz<0?-dz:dz;
 if(a===0&&b===0)return y>=1&&y<=th?B.WOOD:y===th+1?B.LEAVES:-1;
 if(y===th)return a<=1&&b<=1||(a===2&&b===0)||(a===0&&b===2)?B.LEAVES:-1;
 if(y===th+1)return a+b===1?B.LEAVES:-1;
 if(y===th-1)return (a===3&&b===0)||(a===0&&b===3)?B.LEAVES:(a===1&&b===1?B.DATES:-1);
 return -1;
}
function mOut(mx,y,mz,ax,az,m){
 if(m<=28)return y>=-2&&y<0?B.LIME:-1;
 if(ax<=5&&mz>=29&&mz<=88){
  if(y===0)return ax<=1?B.WATER:((mz&3)===0||ax===5)?B.PATH:B.ARCH;
  if(y===-1)return B.LIME;if(y===-2)return mz<=62?B.LIME:-1;
  if(y>0){
   if(ax===0&&(mz-36)%12===0&&y<=3)return B.WATER;
   if(ax===5&&(mz&7)===2&&y<=3)return y===3?B.LANTERN:B.LIME;
  }
  return -1;
 }
 if(ax<=33&&mz>=-33&&mz<=62)return y===-1||y===-2?B.WATER:y===0?0:-1;
 return -1;
}
function mArc(mx,y,mz,ax,az,m){
 if(y<0)return -1;
 if(m>=26){return y===0?(((ax&3)===0||(az&3)===0)?B.PATH:B.ARCH):m===28&&y===1&&!(ax<=5&&mz>=28)?B.LIME:(ax===27&&az===27&&y>=1&&y<=4?(y===4?B.LANTERN:B.LIME):-1)}
 /* arcade of pointed arches (m=24..25) */
 if(y===0)return((ax&3)===0||(az&3)===0)?B.PATH:B.ARCH;
 if(y===5)return B.LIME;
 if(y===6&&m===24)return B.LIMEP;
 if(m===24&&y>=7&&y<=11){const t=ax>az?mz:mx,o=ax>az?az:ax;if(o<=22&&((t&7)===4))return B.LIME;return -1}
 if(m===25&&y>=1&&y<=4){
  if(ax===25&&az===25)return B.LIME;
  const t=ax>az?mz:mx,i=(((t+2)%4)+4)%4;
  if(i===0)return B.LIME;
  if(i===2)return -1;
  return y===4?B.ARCH:-1;
 }
 return -1;
}
function hang(mx,y,mz){
 const dx=mx,dz=mz+8;
 if(dx===0&&dz===0)return y>=21&&y<=29?B.LATTICE:y===20?B.LANTERN:y===18?B.LANTERN:y===16?B.LANTERN:y===19||y===17?B.GOLD:-1;
 const a=dx<0?-dx:dx,b=dz<0?-dz:dz;
 if(a<=1&&b<=1){if(y===18)return B.LANTERN;if((y===19||y===17)&&a+b===1)return B.LANTERN}
 return -1;
}
function lantOn(ax,mz){return((mz+22)%6)===3&&(ax===14||ax===20||ax===16||ax===9)}
function mIn(mx,y,mz,ax,az,m){
 if(y>=24)return mTop(mx,y,mz,ax);
 const f=(y/6)|0,k=y-f*6,T2=f>=2;
 const X=T2?18:22,Zs=T2?18:22;
 if(T2&&!(ax<=19&&mz>=-23&&mz<=19)){ /* roof deck of the lower block */
  if(y===12)return B.LIME;
  if(m===23)return y===13?B.LIME:y===14?B.LATTICE:-1;
  if(y>=13&&y<=23&&((ax===20&&mz>=-22&&mz<=18&&(mz&7)===2)||(mz===20&&ax<=18&&(ax&7)===2)))return B.LIME;
  return -1;
 }
 const outer=ax===X+1||mz===Zs+1||mz===-23;
 if(outer){
  if(k===0)return y===0||k===0?B.LIMEP:B.LIME;
  if(mz===-23&&ax<=6)return ax%3===0?B.LIME:B.GLASS;
  if(f===0&&mz===23&&ax<=2&&(k<=4&&!(ax===2&&k===4)))return 0;
  if(f===2&&mz===19&&ax<=1&&k<=3)return 0;
  const t=(mz===-23||mz===Zs+1)?mx:mz,tt=t<0?-t:t;
  if(k>=2&&k<=4&&(t&3)===2&&tt>=3&&tt<=X-2)return B.GLASS;
  return B.LIME;
 }
 /* interior classes */
 let cls;
 if(ax<=6&&mz<=6)cls=2;
 else if((ax===7&&mz<=7)||(mz===7&&ax<=7))cls=3;
 else if(ax<=10&&mz<=10&&(ax>=8||mz>=8))cls=4;
 else if(ax===11||mz===11)cls=5;
 else if(ax>=12&&mz<=10)cls=6;
 else if(ax<=10&&mz>=12)cls=7;
 else if(ax>=12&&ax<=18&&mz>=12&&mz<=15)cls=8;
 else cls=9;
 if(cls===8)return mCore(ax,mz,y);
 if(k===0){
  if(cls===2){if(f>0)return -1;const dd=Math.max(ax,Math.abs(mz+8));return dd%6===0?B.BLUE:dd%6===3?B.TURQ:((mx&1)===0&&(mz&1)===0)?B.STAR:B.MARBLE}
  if(cls===6){const d=ax-12;return d>=2&&d<=X-14||d>=2&&d<=4?B.CARPET:((mx+mz)&1)?B.MARBLE:B.ARCH}
  if(cls===7){return ax<=3?B.CARPET:((mx+mz)&1)?B.MARBLE:B.ARCH}
  if(cls===4||cls===3)return ((mx+mz)&1)?B.MARBLE:B.ARCH;
  return B.LIME;
 }
 switch(cls){
  case 2:return hang(mx,y,mz);
  case 3:return f>0&&k<=2?B.LATTICE:-1;
  case 4:return k===5&&lantOn(ax,mz)?B.LANTERN:-1;
  case 5:{
   if(mz===11){ /* wall between the galleries and the south hall */
    if(f===0){if(ax<=4&&k<=4)return 0;}else if(ax<=1&&k<=4)return 0;
    return k===5?B.LIMEP:B.LIME}
   if(ax===11&&mz<=10){
    const middle=exAt(f,mx,mz)>=0,side=exAt(f,mx,mz-1)>=0||exAt(f,mx,mz+1)>=0;
    if((middle||side)&&(k<=3||middle&&k===4))return 0;
    if(middle&&k===5)return B.LANTERN;
    return k===5||k===4&&side?B.LIMEP:B.LIME;
   }
   if(ax===11&&mz>=12&&mz<=14&&k<=4)return 0;
   if(ax===11&&mz===15&&k===2)return B.LANTERN;
   return B.LIME}
  case 6:{
   if(ax===X){const e=exAt(f,mx,mz);if(e>=0)return k===1?B.LIMEP:k===2?B.GLASS:k===5&&0?B.LANTERN:-1}
   if(galleryDivider(f,mx,mz))return k===5?B.LIMEP:B.LIME;
   if(k===5&&lantOn(ax,mz))return B.LANTERN;
   if(ax===12&&mz===-6)return -1;
   return -1}
  case 7:{
   if(k===5&&((mz+22)%6===3&&(ax===4||ax===9)))return B.LANTERN;
   if(f===1&&mz===Zs&&ax>=2&&ax<=9&&k<=2)return B.SHELF;
   if(f===3&&mz===Zs&&ax>=2&&ax<=9&&k<=2)return B.SHELF;
   if(k===1&&ax===9&&(mz===14||mz===16))return B.TRELLIS;
   return -1}
  default:return B.LIME;
 }
}
/* stairs: two switchback cores, 2-wide flights, landings, rise 1 per step. Local v along x from the hall, u across z */
function mCore(ax,mz,y){
 const v=ax-12,u=mz-12,r=y%6;
 if(y===0)return B.LIME;
 if(y===24)return u>=2&&v>=2&&v<=4?-1:B.LIMEP;
 if(v===0)return r===0?B.LIMEP:-1;
 if(v<=3){
  if(u<2)return r===v?B.ARCH:-1;
  if(v===1)return r===0?B.LIMEP:-1;
  return r===7-v?B.ARCH:-1;
 }
 return r===3?B.LIMEP:v===6&&r===5?B.LANTERN:-1;
}
function planter(ax,mz,x0,z0){return ax>=x0-1&&ax<=x0+1&&mz>=z0-1&&mz<=z0+1}
function mTop(mx,y,mz,ax){
 const dx=mx,dz=mz+8;
 if(!(ax<=19&&mz>=-23&&mz<=19))return -1;
 if(y===24){
  if(ax<=6&&mz<=6)return oct(dx,dz,6)?-1:B.GLASS;
  if(ax>=12&&ax<=18&&mz>=12&&mz<=15)return mCore(ax,mz,24);
  if(planter(ax,mz,15,-18)||planter(ax,mz,7,16))return B.GRASS;
  return((mx+mz)&1)?B.LIME:B.LIMEP;
 }
 if(y<=26&&(ax===19||mz===19||mz===-23))return y===25?B.LIME:B.LATTICE;
 if(y<=26){
  if(planter(ax,mz,15,-18))return treeBlk(0,ax-15,mz+18,y-24,.9);
  if(planter(ax,mz,7,16))return treeBlk(2,ax-7,mz-16,y-24,.9);
  if((ax===13&&mz>=12&&mz<=13)||(ax>=14&&ax<=15&&(mz===11||mz===16))||(ax===16&&mz>=12&&mz<=15))return B.LATTICE;
  if(mx===PLAQUE.mx&&mz===PLAQUE.mz)return y===25?B.LIMEP:B.GLASS;
 }
 if(y<=31){
  let R,Ri;
  if(y<=27){R=9;Ri=6.2}else if(y<=29){R=7;Ri=4.8}else if(y===30){R=5;Ri=-1}else{R=2;Ri=-1}
  if(!oct(dx,dz,R))return -1;
  if(Ri>0&&oct(dx,dz,Ri))return -1;
  const a=dx<0?-dx:dx,b=dz<0?-dz:dz;
  if(y===31&&dx===0&&dz===0)return B.LANTERN;
  if(Ri>0&&y>=26&&((Math.max(a,b)>=R-1&&Math.min(a,b)<=1)||(a+b>=R*1.4142-1.6&&Math.abs(a-b)<=1)))return B.GLASS;
  return(y===25||y===28||y===30)?B.LIMEP:B.LIME;
 }
 return -1;
}
function museumTop(l,lx,lz){
 const mz=lz+MZC,ax=lx<0?-lx:lx,az=mz<0?-mz:mz,m=ax>az?ax:az;
 if(m<=23){if(ax<=19&&mz>=-23&&mz<=19)return oct(lx,mz+8,9)||mz===13||ax===16?31:26;return 14}
 if(m<=28)return 11;
 if(ax<=5&&mz>=29&&mz<=88)return 11;
 return 3;
}
function museum(l,lx,y,lz){
 if(y>museumTop(l,lx,lz))return -1;
 const mx=lx,mz=lz+MZC,ax=mx<0?-mx:mx,az=mz<0?-mz:mz,m=ax>az?ax:az;
 if(m<=23&&y>=0)return mIn(mx,y,mz,ax,az,m);
 if(m<=28&&y>=0)return mArc(mx,y,mz,ax,az,m);
 if(y>0&&ax>=1&&ax<=7&&mz>=33&&mz<=88){const bz=mx<0?5:13,pz=bz+16*Math.round((mz-bz)/16),dz=mz-pz,dx=mx-(mx<0?-4:4);if(pz>=37&&pz<=85&&dx>=-3&&dx<=3&&dz>=-3&&dz<=3){const r=palmB(dx,y,dz,7);if(r>=0)return r}}
 return mOut(mx,y,mz,ax,az,m);
}
/* ---- far silhouettes: a few boxes per landmark, built from the same parameters as the real structure ---- */
const SILC=[[.66,.46,.3],[.93,.88,.76],[.95,.94,.92],[.93,.72,.2],[.12,.34,.63],[.1,.59,.63],[.07,.5,.36],[.84,.69,.46],[.18,.5,.24]];
function domeRings(add,cx,cz,r,yb,mat,n){
 for(let i=0;i<n;i++){const a=Math.round(i*r/n),b=i===n-1?r:Math.round((i+1)*r/n)-1,ytop=i===n-1?r:b;
  const w=Math.floor(Math.sqrt(Math.max(0,(r+.45)*(r+.45)-ytop*ytop)));
  if(b>=a)add(cx-w,yb+a,cz-w,cx+w,yb+b,cz+w,mat)}
}
function silMosque(l,add,pk,lod){
 const P=l.P,hw=P.hw,wh=P.wh,zc=P.zc,dr=P.dr,db=wh+P.dh+1;
 add(-hw,0,P.hb,hw,wh,P.hf,P.white?2:7);
 add(-dr,wh+1,zc-dr,dr,wh+P.dh,zc+dr,1);
 domeRings(add,0,zc,dr,db,P.dome,lod?2:3);
 add(0,db+dr+1,zc,0,db+dr+3,zc,3);pk.push([0,zc,db+dr+3]);
 if(P.sd){const s=hw-3;for(const a of[-s,s])for(const b of[zc-s,zc+s]){domeRings(add,a,b,3,wh+1,P.dome,lod?1:2);add(a,wh+5,b,a,wh+5,b,3)}}
 if(P.white&&!lod)for(const x of[-hw,hw])for(let z=P.hf+5;z<P.fw;z+=5)domeRings(add,x,z,1.7,5,2,1);
 add(-hw,0,P.fw+1,hw,0,l.o&1?l.ex:l.ez,7);add(-hw,0,P.hf+1,-hw,4,P.fw,7);add(hw,0,P.hf+1,hw,4,P.fw,7);add(-hw,0,P.fw,hw,5,P.fw,7);
 const bal=P.mh-9;
 for(const m of P.mn){const cx=m[0]*(hw+3),cz=m[1];
  if(lod){add(cx-1,0,cz-1,cx+1,bal+6,cz+1,2);add(cx-2,bal,cz-2,cx+2,bal+1,cz+2,2)}
  else{add(cx-2,0,cz-2,cx+2,1,cz+2,2);add(cx-1,2,cz-1,cx+1,bal-1,cz+1,2);add(cx-2,bal,cz-2,cx+2,bal+1,cz+2,2);add(cx-1,bal+2,cz-1,cx+1,bal+4,cz+1,7);add(cx-1,bal+5,cz-1,cx+1,bal+6,cz+1,P.dome)}
  add(cx,bal+7,cz,cx,bal+8,cz,3);pk.push([cx,cz,bal+8])}
}
function silCharbagh(l,add,pk,lod){
 add(-17,0,-17,17,4,-17,7);add(-17,0,17,17,4,17,7);add(-17,0,-16,-17,4,16,7);add(17,0,-16,17,4,16,7);
 add(-3,0,-3,3,6,3,2);domeRings(add,0,0,3,7,B.TURQ,lod?1:2);add(0,11,0,0,13,0,3);pk.push([0,0,13]);
}
function silVillage(l,add,pk,lod){
 add(-19,0,-19,19,0,19,7);
 add(10,0,-3,16,6,3,0);domeRings(add,13,0,3,7,B.TURQ,lod?1:2);add(13,10,0,13,11,0,3);pk.push([13,0,11]);
 add(17,0,-1,19,13,1,2);add(17,14,-1,19,14,1,2);add(17,15,-1,19,17,1,5);add(18,18,0,18,18,0,3);pk.push([18,0,18]);
 if(lod){add(-19,0,-19,6,5,19,0);return}
 for(let i=0;i<3;i++)for(let j=0;j<3;j++){if((i===1&&j===1)||(i===2&&j===1))continue;
  const cx=13*i-13,cz=13*j-13,t=(hash2(i+l.id,j,77)*4)|0;
  if(t===1)add(cx-4,0,cz-4,cx+4,4,cz+4,0);else if(t===2)add(cx-2,0,cz-2,cx+2,3,cz+2,0);
  else{add(cx-3,0,cz-3,cx+3,6,cz+3,0);if(t===3)domeRings(add,cx,cz,2,6,B.TURQ,1)}}
}
function silCaravan(l,add,pk,lod){
 add(-13,0,-13,13,5,-11,0);add(-13,0,11,13,5,13,0);add(-13,0,-10,-11,5,10,0);add(11,0,-10,13,5,10,0);
 add(-3,0,9,3,12,13,0);domeRings(add,0,11,2,12,B.TURQ,1);add(0,15,11,0,16,11,3);pk.push([0,11,16]);
}
function silMuseum(l,add,pk,lod){
 const A=(a,b,c,d,e,f,g)=>add(a,b,c-MZC,d,e,f-MZC,g);
 A(-28,0,-28,28,0,28,2);A(-5,0,29,5,0,88,2);A(-25,1,-25,25,5,25,1);A(-23,6,-23,23,12,23,1);A(-19,13,-23,19,26,19,1);
 A(-9,25,-14,9,27,-2,1);A(-6,25,-17,6,27,1,1);A(-7,28,-13,7,29,-3,1);A(-5,28,-15,5,29,-1,1);
 A(-5,30,-11,5,30,-5,1);A(-3,30,-13,3,30,-3,1);A(-2,31,-10,2,31,-6,3);pk.push([0,-8-MZC,31]);
}
const BMAT={10:2,11:4,23:5,12:6,14:3};
const SILF={mosque:silMosque,charbagh:silCharbagh,village:silVillage,caravan:silCaravan,museum:silMuseum,
 burj:silBurjKhalifa,sail:silBurjAlArab,dohaMia:silDohaMia,petra:silPetraTreasury,kuwait:silKuwaitTowers,hegra:silHegraTomb};
const isIslamic=l=>!!SILF[l.t];
/* local cell -> world cell (inverse of the generator's rotation) */
function lm2w(l,lx,lz,out){let dx,dz;switch(l.o){case 0:dx=lx;dz=lz;break;case 1:dx=-lz;dz=lx;break;case 2:dx=-lx;dz=-lz;break;default:dx=lz;dz=-lx}out[0]=l.x+dx;out[1]=l.z+dz}
/* returns boxes as flat [x0,y0,z0,x1,y1,z1,mat] in world units, plus peaks [wx,wz,topY] */
function silGeo(l,lod,boxes,peaks){
 const a=[0,0],b=[0,0];
 const add=(lx0,y0,lz0,lx1,y1,lz1,mat)=>{lm2w(l,lx0,lz0,a);lm2w(l,lx1,lz1,b);
  boxes.push(Math.min(a[0],b[0]),l.y0+y0,Math.min(a[1],b[1]),Math.max(a[0],b[0])+1,l.y0+y1+1,Math.max(a[1],b[1])+1,mat>=9?BMAT[mat]:mat)};
 const pk=[];SILF[l.t](l,add,pk,lod);
 for(const p of pk){lm2w(l,p[0],p[1],a);peaks.push([a[0],a[1],l.y0+p[2]])}
}
/* the set of landmarks near the player, a triangle budget, and one vertex array */
const SIL={list:[],ids:'',px:-9999,pz:-9999,tris:0,buf:null,verts:new Float32Array(3000*3*7+64),n:0,dirty:false,alpha:new Map(),nextChk:0};
const SIL_BUDGET=2700,SIL_R=400,BOXTRI=10;
function silSelect(px,pz){
 const c=[];
 for(const l of fixedList())if(isIslamic(l))c.push(l);
 const r0=Math.max(0,Math.floor((px-SIL_R)/RG)),r1=Math.min(NR-1,Math.floor((px+SIL_R)/RG)),q0=Math.max(0,Math.floor((pz-SIL_R)/RG)),q1=Math.min(NR-1,Math.floor((pz+SIL_R)/RG));
 for(let rz=q0;rz<=q1;rz++)for(let rx=r0;rx<=r1;rx++){const l=lmCell(rx,rz);if(l&&isIslamic(l))c.push(l)}
 const out=[];
 for(const l of c){const d=Math.hypot(l.x-px,l.z-pz);if(d<SIL_R+60){l.sd=d;out.push(l)}}
 out.sort((a,b)=>a.sd-b.sd);return out;
}
const silBoxes=[],silPeaks=[];
function silBuild(px,pz){
 for(const e of SIL.list)SIL.alpha.set(e.l.id,e.a);
 const sel=silSelect(px,pz);let tris=0,n=0;const list=[],ids=[];
 for(const l of sel){
  silBoxes.length=0;silPeaks.length=0;const lod=l.sd>200?1:0;
  silGeo(l,lod,silBoxes,silPeaks);const nb=silBoxes.length/7;
  if(tris+nb*BOXTRI>SIL_BUDGET)continue;
  tris+=nb*BOXTRI;list.push({l,boxes:silBoxes.slice(),peaks:silPeaks.slice(),lod,v0:0,v1:0,a:SIL.alpha.has(l.id)?SIL.alpha.get(l.id):1,t:SIL.alpha.has(l.id)?SIL.alpha.get(l.id):1});ids.push(l.id+(lod?'l':''));
 }
 const key=ids.join(',');
 SIL.px=px;SIL.pz=pz;
 if(key===SIL.ids)return false;
 SIL.ids=key;SIL.list=list;SIL.tris=tris;
 const V=SIL.verts;let o=0;
 for(const e of list){
  e.v0=o/7;const b=e.boxes;
  for(let i=0;i<b.length;i+=7){const x0=b[i],y0=b[i+1]<=e.l.y0+1?b[i+1]-7:b[i+1],z0=b[i+2],x1=b[i+3],y1=b[i+4],z1=b[i+5],c=SILC[b[i+6]];
   const put=(x,y,z,k)=>{V[o++]=x;V[o++]=y;V[o++]=z;V[o++]=c[0]*k;V[o++]=c[1]*k;V[o++]=c[2]*k;V[o++]=e.a};
   const quad=(p,q,r,s,k)=>{put(p[0],p[1],p[2],k);put(q[0],q[1],q[2],k);put(r[0],r[1],r[2],k);put(p[0],p[1],p[2],k);put(r[0],r[1],r[2],k);put(s[0],s[1],s[2],k)};
   quad([x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],1);
   quad([x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1],.82);
   quad([x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[x0,y0,z0],.7);
   quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],.6);
   quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],.54);
  }
  e.v1=o/7;
 }
 SIL.n=o/7;SIL.dirty=true;return true;
}

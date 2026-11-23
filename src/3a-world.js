/* ===== 3. Terrain, landmarks and chunk generation (pure functions of the seed) ===== */
const G={om:0,hm:0};
function raw(x,z){
 const wx=x+16*vnoise(x/70,z/70,21),wz=z+16*vnoise(x/70+9,z/70-4,22);
 let dune=3.4*vnoise(wx/52,wz/52,1)+1.5*vnoise(wx/21,wz/21,2)+.6*vnoise(x/8,z/8,3);
 const rg=Math.abs(vnoise(wx/30+wz/70,wz/26,4)*2-1);dune+=(1-rg)*(1-rg)*2.6;
 const ds=Math.hypot(x-SPAWN.x,z-SPAWN.z),sp=1-sstep(55,115,ds);
 const om=Math.max(sstep(.57,.74,vnoise(x/170,z/170,8)),sp);
 const hm=sstep(.55,.76,vnoise(x/210,z/210,6))*(1-sp);
 let h=15+dune*(1-.55*om)+hm*(5+17*vnoise(x/44,z/44,7)+3*vnoise(x/13,z/13,5));
 h-=om*sstep(.5,.7,vnoise(x/36,z/36,9))*8.5;
 h-=om*(1-sstep(0,.028,Math.abs(vnoise(x/85+z/230,z/85,10)-.5)))*(1-hm)*4.5;
 h=lerp(h,15.6+1.1*vnoise(x/26,z/26,12),sp*.7);
 const ld=Math.hypot(x-LAKE.x,z-LAKE.z)+3*(vnoise(x/6,z/6,3)-.5);
 h=lerp(WL-4,h,smooth(clamp((ld-7)/9,0,1)));
 let om2=om,hm2=hm;const gd=gzD(x,z);
 if(gd<GZ.moat+14){
  /* flat sand island, a short beach, a deep channel, then back to the desert */
  const isl=WL+2.2+.9*vnoise(x/9,z/9,72),g=gd<1?lerp(isl,WL-1,sstep(-4,1,gd)):lerp(WL-1,WL-4,sstep(1,3,gd)),k=sstep(GZ.moat,GZ.moat+14,gd);
  h=lerp(g,h,k);om2*=k;hm2*=k;
 }
 G.om=om2;G.hm=hm2;return h;
}
/* --- shared small builders --- */
const FRUIT=[B.ORANGE,B.POM,B.OLIVE],TTOP=[2,1,2],TBOT=[3,2,3];
function treeBlk(t,dx,dz,y,hv){
 const a=Math.abs(dx),b=Math.abs(dz),s=a+b;
 if(s===0&&y>=1&&y<=TTOP[t])return B.WOOD;
 const k=y-TBOT[t];if(k<0||k>(t===0?2:1))return -1;
 const ok=t===0?(k===0?a<=1&&b<=1:k===1?s<=1:s===0):(k===0?a<=1&&b<=1:s<=1);
 return ok?(hv<(t===2? .5:.78)?FRUIT[t]:B.LEAVES):-1;
}
const PW=[0,2,2,2,1,0,-1];
function portal(ax,y){const w=PW[y];if(w===undefined||y<1)return -1;return ax<=w?0:ax===w+1?B.ARCH:-1}
function dome(dx,dy,dz,r,mat,acc){
 if(dy<0)return -1;const d=Math.sqrt(dx*dx+dy*dy+dz*dz);
 return d<=r+.45&&d>r-1.35?(dy%3===2?acc:mat):-1;
}
/* --- mosque --- */
function minaret(mx,y,mz,P){
 const ax=Math.abs(mx),az=Math.abs(mz);if(ax>2||az>2)return -1;
 const bal=P.mh-9,s=ax+az;
 if(y<2)return y===0?B.ARCH:B.MARBLE;
 if(y<bal)return s<=1?(y%6===4&&s===1?B.LATTICE:y===bal-2?P.acc:B.MARBLE):-1;
 if(y===bal)return B.ARCH;
 if(y===bal+1)return(ax===2||az===2)?B.LATTICE:s<=1?B.MARBLE:-1;
 if(y<=bal+4)return s<=1&&ax<2&&az<2?(y===bal+3?P.acc:B.SANDSTONE):-1;
 if(y===bal+5)return ax<=1&&az<=1?B.ARCH:-1;
 if(y===bal+6)return s<=1?P.dome:-1;
 if(y===bal+7)return s===0?P.dome:-1;
 return s===0&&y===bal+8?B.LANTERN:-1;
}
function mosque(l,lx,y,lz){
 const P=l.P,hw=P.hw,wh=P.wh,ax=Math.abs(lx);let r;
 for(const m of P.mn){r=minaret(lx-m[0]*(hw+3),y,lz-m[1],P);if(r>=0)return r}
 if(P.white&&ax>=hw+2&&ax<=hw+5&&lz>=P.hb+1&&lz<P.fw){
  if(y===0)return ax===hw+3||ax===hw+4?B.WATER:B.MARBLE;
  if(y===-1)return B.TURQ;
 }
 const inHall=ax<=hw&&lz>=P.hb&&lz<=P.hf,dz=lz-P.zc,rr=lx*lx+dz*dz;
 if(inHall){
  const edge=ax===hw||lz===P.hb||lz===P.hf;
  if(y===0)return edge?B.ARCH:(ax===hw-1||lz===P.hb+1||lz===P.hf-1)?B.MARBLE:P.white&&(ax===0||((lz-P.hb)%4===0&&ax%3===0))?B.TURQ:B.CARPET;
  if(y<wh){
   if(edge){
    if(lz===P.hf){r=portal(ax,y);if(r>=0)return r}
    if(y===1)return B.ARCH;
    if(y===wh-1)return P.acc;
    if(y>=3&&y<=wh-3&&(ax===hw?(lz-P.hb)%4===2:lz===P.hb?ax%4===2:false))return B.LATTICE;
    if(lz===P.hb&&ax<=1&&y<=4)return B.BLUE;
    return B.MARBLE;
   }
   const px=hw>>1,pq=Math.abs(dz);
   if(hw>=6&&ax===px&&pq===px)return B.ARCH;
   if(y===wh-1&&((lx===0&&dz===0)||(hw>=6&&ax===px&&dz===0)||(ax===hw-1&&lz===P.hb+1)))return B.LATTICE;
   if(y===wh-2&&((lx===0&&dz===0)||(hw>=6&&ax===px&&dz===0)||(ax===hw-1&&lz===P.hb+1)))return B.LANTERN;
   return -1;
  }
  if(y===wh){return rr<(P.dr-1.2)*(P.dr-1.2)?-1:edge?B.ARCH:B.SANDSTONE}
  if(y===wh+1&&edge)return(lx+lz)&1?-1:B.MARBLE;
  if(y>wh){
   if(y<=wh+P.dh){return rr<=(P.dr+.4)*(P.dr+.4)&&rr>(P.dr-1.2)*(P.dr-1.2)?((ax<1.2||Math.abs(dz)<1.2||Math.abs(ax-Math.abs(dz))<1.2)&&y===wh+1+(P.dh>>1)?B.LATTICE:B.MARBLE):-1}
   const dy=y-(wh+P.dh+1);
   r=dome(lx,dy,dz,P.dr,P.dome,P.acc);if(r>=0)return r;
   if(lx===0&&dz===0&&dy>P.dr&&dy<=P.dr+3)return dy===P.dr+2?B.LANTERN:B.GOLD;
   if(P.sd&&y>wh){const s=hw-3,cx=ax-s,cz=Math.abs(dz)-s;if(cx===0&&cz===0&&y===wh+5)return B.GOLD;return dome(cx,y-wh-1,cz,3,P.dome,P.dome)}
  }
  return -1;
 }
 /* courtyard and apron */
 if(ax>hw||lz<=P.hf)return -1;
 if(lz>P.fw){return y===0&&ax<=3?B.PATH:-1}
 if(P.white){
  const col=((lz-P.hf)%5+5)%5,near=Math.min(col,5-col),petal=Math.abs(ax-4);
  if(y===0){if(ax===hw||lz===P.fw)return B.ARCH;if(petal+near===1)return B.TURQ;if(petal===0&&near===0)return B.GOLD;if(petal===2&&near===0)return B.GREEN;return B.MARBLE}
  if(y>=5&&ax>=hw-1&&lz<P.fw){if(y===8&&ax===hw&&col===0)return B.GOLD;const cap=dome(ax-hw,y-5,near,1.7,B.MARBLE,B.MARBLE);if(cap>=0)return cap}
 }
 if(y===0){
  const fz=(P.hf+1+P.fw)>>1,fx=Math.abs(lx),fd=Math.abs(lz-fz);
  if(Math.max(fx,fd)<=1)return B.WATER;if(Math.max(fx,fd)===2&&fx+fd<4)return B.ARCH;
  if(ax===hw||lz===P.fw)return B.ARCH;
  return (lx&3)===0&&(lz&3)===0?B.STAR:(lx&3)===2&&(lz&3)===2?B.BLUE:B.MARBLE}
 const fz=(P.hf+1+P.fw)>>1,fx=Math.abs(lx),fd=Math.abs(lz-fz);
 if(!P.white&&Math.max(fx,fd)<=2&&!(fx===2&&fd===2)){
  if(Math.max(fx,fd)===2)return y===1?B.ARCH:-1;
  if(fx===0&&fd===0)return y<=3?B.ARCH:y===4||y===5?B.WATER:-1;
  return -1}
 if(lz===P.fw){
  r=portal(ax,y);if(r>=0)return r;
  if(y===1)return B.ARCH;if(y<=5)return y===5?P.acc:B.MARBLE;
  return y===6&&ax===hw?B.LANTERN:y===6&&(lx&1)?B.MARBLE:-1}
 if(ax===hw){
  const q=(lz-P.hf)%3;
  if(y<=3)return q===1?B.ARCH:(y===3?B.ARCH:-1);
  if(y===4)return B.MARBLE;
  return y===5&&(lz-P.hf)%6===1?B.LANTERN:-1}
 return -1;
}
const MQ=[
 {hw:8,cd:14,wh:9,dr:7,dh:2,dome:B.MARBLE,acc:B.MARBLE,mh:32,sd:1,white:true,ymin:-1,mn:[[-1,0],[1,0],[-1,1],[1,1]]},
 {hw:6,cd:9,wh:8,dr:5,dh:2,dome:B.BLUE,acc:B.TURQ,mh:24,sd:0,mn:[[-1,0],[1,0]]},
 {hw:4,cd:6,wh:6,dr:3,dh:1,dome:B.TURQ,acc:B.BLUE,mh:18,sd:0,mn:[[1,0]]},
 {hw:5,cd:8,wh:7,dr:4,dh:2,dome:B.GREEN,acc:B.GOLD,mh:22,sd:0,mn:[[-1,0],[1,1]]}];
for(const P of MQ){P.hx=P.hw+5;P.hz=Math.ceil((2*P.hw+P.cd+5)/2);P.hb=-P.hz+1;P.zc=P.hb+P.hw;P.hf=P.hb+2*P.hw;P.fw=P.hf+P.cd;P.h=Math.max(P.mh,P.wh+P.dh+P.dr+5);P.top=P.mh-1;
 P.mn=P.mn.map(m=>[m[0],m[1]?P.hb+1:(P.white?P.fw-1:P.hf)])}
/* --- charbagh --- */
function charbagh(l,lx,y,lz){
 const ax=Math.abs(lx),az=Math.abs(lz),m=Math.max(ax,az);
 if(m===17){
  const g=Math.min(ax,az)<=1;
  if(g){if(y<=2&&y>=1)return 0;if(y===3)return B.ARCH;return y===0?B.PATH:-1}
  if(Math.min(ax,az)===2&&y<=5)return y===5?B.LANTERN:B.ARCH;
  return y>=1&&y<=3?B.ARCH:y===4&&((lx+lz)&1)?B.ARCH:-1}
 if(ax<=3&&az<=3){
  if(y===-1||y===0){if(ax===3&&az===3)return B.ARCH}
  else if(y<=4){if(ax===3&&az===3)return B.MARBLE}
  else if(y===5)return ax===3||az===3?B.ARCH:-1;
  else if(y===6)return ax===0&&az===0?B.LATTICE:B.MARBLE;
  else if(y>=7){const r=dome(lx,y-7,lz,3,B.TURQ,B.GOLD);if(r>=0)return r;return lx===0&&lz===0&&y>=11&&y<=12?B.GOLD:lx===0&&lz===0&&y===13?B.LANTERN:-1}
 }
 if(y>5)return -1;
 const rr=lx*lx+lz*lz,ch=ax<=1||az<=1;
 if(rr<=20){
  if(y<=0)return y>=-1?B.WATER:-1;
  if(ax===0&&az===0)return y<=2?B.ARCH:y<=4?B.WATER:-1;
  return -1}
 if(rr<=30){return y===0||y===1?B.ARCH:-1}
 if(ch){return y===0||y===-1?B.WATER:-1}
 if(ax===2||az===2){return y===0?B.PATH:-1}
 const qx=lx>0?1:0,qz=lz>0?1:0,qi=qx+2*qz;
 const mm=Math.min(ax-3,az-3,16-ax,16-az);
 if(mm===0)return y===0?B.PATH:(ax+az)%6===0?(y===1?B.ARCH:y===2?B.LANTERN:-1):-1;
 if(y===0)return B.GRASS;
 if(mm===2||mm===4){if(y===1)return B.FL0+((qi*2+(mm===4?3:0))%6);return -1}
 if(mm===3||mm===6){return y===1&&(ax*3+az)%3?B.TUFT:-1}
 if(ax===9&&az===9||ax===10&&az===10)return -1;
 if(ax===9&&az===10||false)return -1;
 const dx=ax-9,dz=az-9;if(Math.abs(dx)<=1&&Math.abs(dz)<=1&&mm>=5)return treeBlk(qi===0||qi===3?0:2,dx,dz,y,hash2(lx,lz+y*9,3));
 return -1;
}
/* --- village --- */
function village(l,lx,y,lz){
 const u=lx+19,v=lz+19;if(u<0||v<0||u>38||v>38)return -1;
 const i=(u/13)|0,j=(v/13)|0,cu=u%13,cv=v%13;
 if(cu<2||cv<2)return y===0?B.PATH:-1;
 const typ=i===1&&j===1?9:i===2&&j===1?7:(hash2(i+l.id,j,77)*4)|0,wx=cu-6,wz=cv-6;
 const ax=Math.abs(wx),az=Math.abs(wz);
 if(typ===7){ /* small neighbourhood masjid with a minaret */
  const mx=Math.abs(wx-5),mm=mx+az;
  if(wx>=4&&az<=1&&mx<=1){
   if(y<=1)return B.ARCH;if(y<=13)return mm<=1&&!(mx===1&&az===1)||(mx===0&&az===0)?(y%5===0?B.LATTICE:B.MARBLE):-1;
   if(y===14)return B.ARCH;if(y<=16)return mm===0?B.MARBLE:mm<=1&&!(mx===1&&az===1)&&y===16?B.LATTICE:-1;
   if(y===17)return mm<=1&&!(mx===1&&az===1)?B.TURQ:-1;if(y===18)return mm===0?B.GOLD:-1;return -1}
  const m=Math.max(ax,az);if(m>3)return y===0?B.PATH:-1;
  if(y===0)return m===3?B.ARCH:B.CARPET;
  if(y<=5){if(m<3)return y===4&&ax<=1&&az<=1?B.LANTERN:-1;if(wx===-3&&az===0&&y<=3)return 0;if(wx===-3&&az===0&&y===4)return B.ARCH;if(y===3&&(wz===0&&wx===3||wx===0&&az===3))return B.LATTICE;return y===5?B.TURQ:B.MUD}
  if(y===6)return B.SANDSTONE;if(y===7&&m===3)return(wx+wz)&1?-1:B.MUD;
  const r=y>=7?dome(wx,y-7,wz,3,B.TURQ,B.BLUE):-1;if(r>=0)return r;
  return wx===0&&wz===0&&y>=10&&y<=11?B.GOLD:-1}
 if(typ===9){
  if(ax<=1&&az<=1){if(ax===0&&az===0)return y<=0&&y>=-1?B.WATER:-1;return y<=1&&y>=0?B.ARCH:-1}
  if(az===0&&ax===1&&false)return -1;
  if(y===0)return B.PATH;
  if(az===0&&ax===2&&y<=3)return B.TRELLIS;
  if(y===3&&az===0&&ax<=2)return B.TRELLIS;
  return -1}
 if(typ===2){ /* market stall plaza */
  if(y===0)return B.PATH;
  const sx=Math.abs(wx)<=1&&Math.abs(wz)<=1;
  if(ax===2&&az===2&&y<=2)return B.TRELLIS;
  if(y===3&&ax<=2&&az<=2)return B.AWR+((i*2+j)%4);
  if(y===1&&wz===2&&ax<=1)return B.TRELLIS;
  if(y===2&&wz===2&&ax<=1&&hash2(wx,i+j,5)>.5)return B.FL0+((wx+i+4)%6);
  if(y===1&&sx&&hash2(wx,wz,i+j)>.7)return B.MUD;
  return -1}
 if(typ===1){ /* walled courtyard house */
  const m=Math.max(ax,az);
  if(y===0)return m<=4?(m===4?B.PATH:B.GRASS):-1;
  if(m===4&&y<=3){if(wz===4&&ax<=1)return y<=2?0:B.ARCH;return B.MUD}
  if(m===4&&y===4)return(wx+wz)&1?B.MUD:-1;
  if(ax<=1&&az<=1&&y<=3)return y===3?B.SANDSTONE:B.MUD;
  if(ax===0&&az===2&&y===1)return B.FL0+(i+j)%6;
  if(ax===3&&az===3)return y>=1&&y<=2?treeBlk(2,0,0,y,.9):-1;
  return -1}
 /* house */
 const m=Math.max(ax,az);
 if(m>3)return -1;
 if(y===0)return B.PATH;
 const wall=m===3;
 if(y<=4){
  if(wall){
   if(wz===3&&wx===0&&y<=2)return 0;
   if(wz===3&&wx===0&&y===3)return B.ARCH;
   if(y===3&&(ax===0||az===0)&&!(wz===3))return B.LATTICE;
   if(y===2&&(wz===-3||ax===3)&&((wx+wz)&1)===0&&false)return B.LATTICE;
   return B.MUD}
  return -1}
 if(y===5)return B.SANDSTONE;
 if(y===6)return m===3&&((wx+wz)&1)?B.MUD:(typ===3&&ax<=1&&az<=1?B.ARCH:-1);
 if(typ===3&&y>=6)return dome(wx,y-6,wz,2,B.TURQ,B.BLUE);
 return -1;
}
/* --- caravanserai --- */
function caravan(l,lx,y,lz){
 const ax=Math.abs(lx),az=Math.abs(lz),m=Math.max(ax,az);
 if(m>13)return -1;
 if(y===0)return m>=11?B.ARCH:(ax<=1&&az<=1?B.WATER:B.PATH);
 if(ax===0&&az===0)return y===-1?B.WATER:-1;
 if(ax<=3&&lz>=9&&lz<=13){ /* gate tower with a small dome */
  if(y>=1&&y<=5&&ax<=PW[y])return 0;
  if(y<=9)return ax===3||lz===9||lz===13?((lz===13||lz===9)&&(y===8||y===9)&&ax%2===0&&ax<3?B.LATTICE:B.MUD):(y<=5?-1:B.MUD);
  if(y===10)return B.TURQ;if(y===11)return B.SANDSTONE;
  if(y===12)return(ax===3||lz===9||lz===13)?((lx+lz)&1?-1:B.MUD):-1;
  const r=dome(lx,y-12,lz-11,2,B.TURQ,B.GOLD);if(r>=0)return r;
  return lx===0&&lz===11&&y>=15&&y<=16?(y===16?B.LANTERN:B.GOLD):-1}
 if(m===13){
  if(lz===13){const r=portal(ax,y);if(r>=0)return r}
  if(y<=5)return y===1?B.ARCH:y===5?B.TURQ:B.MUD;return y===6&&(lx&1)?B.MUD:-1}
 if(m>=11){
  if(y===5)return B.SANDSTONE;if(y===6)return m===12?-1:-1;
  if(m===11){const q=(ax===11?lz:lx)&3;if(y<=3&&(q===1||q===2)&&!(ax===11&&az===11))return 0;if(y<=4)return B.MUD;return -1}
  if(m===12&&y<=4&&!(ax===12&&az===12)){return -1}
  return -1}
 if(ax===5&&az===5&&y<=4)return y===4?B.LANTERN:B.TRELLIS;
 if(ax===8&&az===8&&y<=3)return treeBlk(0,0,0,y,.5);
 return -1;
}
/* --- orchard, vineyard, flower garden --- */
function orchard(l,lx,y,lz){
 const px=lx+14,pz=lz+11,ax=Math.abs(lx),az=Math.abs(lz);
 if(ax===14||az===11){if(Math.min(ax===14?az:ax,99)<=1&&(ax===14?az:ax)<=1)return y===0?B.PATH:-1;return y===0?B.GRASS:y===1?B.MUD:y===2&&ax===14&&az===11?B.LANTERN:-1}
 const qx=px-4,qz=pz-3;
 if(y===0)return qx>=-2&&((qx+2)&3)-2===0&&((qz+2)%5+5)%5-2===0&&px<=24&&pz<=18?B.DIRT:B.GRASS;
 if(px<3||px>25||pz<2||pz>19)return y===1&&hash2(lx,lz,6)>.9?B.TUFT:-1;
 const dx=((qx+2)&3)-2,dz=(((qz+2)%5)+5)%5-2;
 if(Math.abs(dx)<=1&&Math.abs(dz)<=1&&qx>=-1&&qz>=-1){const t=Math.floor((qz+2)/5)%3;return treeBlk(t<0?0:t,dx,dz,y,hash2(lx*3+y,lz,8))}
 return y===1&&hash2(lx,lz,6)>.86?B.FL0+((lx+lz)&1?1:3):-1;
}
function vineyard(l,lx,y,lz){
 const px=lx+15,pz=lz+11,ax=Math.abs(lx),az=Math.abs(lz);
 if(ax===15||az===11){return y===0?B.GRASS:y===1?((ax===15&&az===11)?B.TRELLIS:B.MUD):-1}
 /* tidy rows: a soil strip with light posts every 4 blocks and one lattice rail on top; grass paths between rows */
 const row=pz>=2&&pz<=18&&(pz&3)===2,span=px>=2&&px<=28;
 if(y===0)return row&&span?B.DIRT:B.GRASS;
 if(!row||!span)return y===1&&hash2(lx,lz,6)>.93?B.TUFT:-1;
 const post=(px&3)===2;
 if(y===1)return post?B.LATTICE:B.VINE;
 if(y===2)return post?B.LATTICE:hash2(px,pz,9)>.25?B.GRAPE:B.VINE;
 return y===3?B.LATTICE:-1;
}
function flowers(l,lx,y,lz){
 const ax=Math.abs(lx),az=Math.abs(lz),m=Math.max(ax,az);
 if(m===10){if(Math.min(ax,az)<=1)return y===0?B.PATH:y===1&&Math.min(ax,az)===1?B.LANTERN:-1;return y===0?B.GRASS:y===1?B.LEAVES:y===2&&(lx+lz)%3===0?B.LEAVES:-1}
 if(m<=2&&ax+az<=3){if(ax+az<=1)return y<=0&&y>=-1?B.WATER:-1;return y===0||y===1?B.ARCH:-1}
 if(y>3)return -1;
 if(ax===0||az===0)return y===0?B.PATH:-1;
 if(y===0)return m===9?B.PATH:B.GRASS;
 if(ax===8&&az===8)return treeBlk(0,0,0,y,.4);
 if(m===9)return -1;
 if(y===1){const k=m&1?-1:B.FL0+((m+(lx>0?1:0)+(lz>0?2:0))%6);return k>=0?k:(hash2(lx,lz,4)>.5?B.TUFT:-1)}
 return -1;
}
/* Five simplified entrances around the mataf. */
const HARAM_GATES=[
 ['King Abdulaziz Gate',0,1,52,0],['King Fahd Gate',-1,0,52,19],
 ['King Abdullah Gate',0,-1,52,0],['Umrah Gate',-1,0,52,-19],['Al-Fath Gate',1,0,52,0]
];
const HARAM_TOWERS=[
 [-68,-4,7,8,47],[-69,-24,6,7,25],[-69,17,6,7,28],
 [-85,-25,6,7,23],[-85,18,6,7,26],[-87,-10,6,6,31],[-87,5,6,6,33]
];
function haramGate(lx,y,lz){
 for(const [name,nx,nz,depth,center] of HARAM_GATES){
  const d=lx*nx+lz*nz,a=(nx?lz:lx)-center,w=Math.abs(a);
  if(d<29||d>depth+6||w>10)continue;
  if(d>=depth-2&&d<=depth+2&&(Math.abs(w-8)<=1)){
   if(y<=19)return y%5===0?B.LIMEP:B.MARBLE;
   if(y<=31&&w===8&&Math.abs(d-depth)<=1)return y>=29?B.GOLD:y%4===0?B.LIMEP:B.MARBLE;
  }
  const arch=Math.min(Math.abs(a),Math.abs(a-5),Math.abs(a+5));
  if(d>=depth-1&&d<=depth+2&&w<=7){
   if(y===0)return w===2||w===3?B.LIMEP:B.PATH;
   if(y<=5&&(arch<=1||y===1&&arch===2))return B.AIR;
   if(y===6&&arch===0)return B.AIR;
   if(y<=8)return (a+y)%2===0?B.MARBLE:B.LIMEP;
   if(y===9)return B.ARCH;
   if(y===10&&w<=6)return w%2===0?B.TURQ:B.LIMEP;
  }
  if(w<=6&&d<depth-1){
   if(y===0)return B.PATH;
   if(y<=4)return B.AIR;
  }
  if(d>depth+2&&w<=7&&y===0)return B.PATH;
 }
 return -1;
}
function haramHotel(lx,y,lz){
 for(const [x,z,w,d,h] of HARAM_TOWERS){
  const dx=lx-x,dz=lz-z,ax=Math.abs(dx),az=Math.abs(dz),clock=h===47;
  if(ax>w||az>d||y>h)continue;
  const edge=ax===w||az===d;
  if(y===0)return dx===w&&az<=2?B.PATH:B.MARBLE;
  if(y<12){
   if(dx===w&&az<=2&&y<=4)return B.AIR;
   if(edge)return y===1||y===5||y===6||y===11||ax===w&&az===d?B.LIMEP:y%3===0?B.MARBLE:B.GLASS;
   if(y===1&&dx===-w+1&&az<=1)return B.ARCH;
   if(y===4&&dx===w-1&&az===3||y===10&&az===d-2&&dx%3===0)return B.LANTERN;
   const stair=dz===-d+2&&dx>=-3&&dx<=2,step=dx+4;
   if(stair&&y<=step)return B.ARCH;
   if(y===6&&!stair)return B.MARBLE;
   if(y===6&&stair&&step===6)return B.ARCH;
   return B.AIR;
  }
  if(clock&&y>=20&&y<=27&&edge){
   const u=ax===w?dz:dx,v=y-23,r=u*u+v*v;
   if(r<=13)return u===0&&v>=0||v===0&&u>=0?B.GOLD:r>=9?B.LIMEP:B.TURQ;
   return B.STONE;
  }
  if(clock&&y>=30){
   const r=y<=35?Math.max(1,6-(y-30)):y<=43?1:0;
   if(y>=44)return dz===0&&(y===44&&ax<=2||y===45&&ax===2||y===46&&dx===-1||y===47&&dx===0)?B.GOLD:-1;
   return ax<=r&&az<=r?(y===31||y%4===0?B.GOLD:B.LIMEP):-1;
  }
  if(!clock&&y>=h-3)return ax<=w-1&&az<=d-1?(y===h?B.GOLD:B.LIMEP):-1;
  if(edge)return y%4===0?B.LIMEP:(dx+dz)%3===0?B.MARBLE:B.GLASS;
  return y%4===0?B.MARBLE:B.AIR;
 }
 return -1;
}
function haram(l,lx,y,lz){
 const ax=Math.abs(lx),az=Math.abs(lz),m=Math.max(ax,az);
 const gate=haramGate(lx,y,lz);if(gate>=0)return gate;
 const hotel=haramHotel(lx,y,lz);if(hotel>=0)return hotel;
 /* broad marble mataf with the northern expansion and its four minarets */
 if(y===0){if(m<=56)return m>=54?B.ARCH:(m>21&&(lx%8===0||lz%8===0)?B.PATH:B.MARBLE);
  return lx>=-95&&lx<-56&&az<=33?(lx%5===0||lz%5===0?B.PATH:B.MARBLE):-1}
 /* King Abdullah expansion: wide prayer halls, roof terraces and colonnades */
 if(lz>=-53&&lz<=-29&&ax<=42){
  if(y===1||y===2){if(ax<=40&&lz>=-51&&lz<=-31)return y===1?B.MARBLE:B.LIMEP}
  if(y>=3&&y<=14){const col=lx%8===0&&ax<=40||lz%8===0&&lz>=-52&&lz<=-30;
   if(ax>=40||lz===-52||lz===-30||col)return y%6===0?B.ARCH:B.MARBLE}
  if(y===15&&ax<=40&&lz>=-52&&lz<=-30)return B.LIMEP;
  if(y>=16&&y<=18&&(ax>=39||lz===-52||lz===-30))return y===18?B.ARCH:B.MARBLE;
  if(y===19&&ax<=40)return B.GOLD;
 }
 /* The east, west and south prayer galleries wrap the open mataf. */
 if((ax>=34&&ax<=52&&lz>=-31&&lz<=52)||(lz>=34&&lz<=52&&ax<=52)){
  const south=lz>=ax,depth=south?lz:ax,along=south?lx:lz;
  const bay=Math.abs(along%8),post=bay===0||depth===52&&bay===1;
  const entrance=depth===52&&Math.abs(along)<=3;
  if(y===0)return B.MARBLE;
  if(y===9)return B.LIMEP;
  if(y===10)return depth===34||depth===52?B.ARCH:-1;
  if(y>0&&y<9){
   if(entrance&&y<=5)return B.AIR;
   if(post&&(depth===34||depth===42||depth===52))return y===1||y===7?B.ARCH:B.MARBLE;
   if(depth===34&&y>=7||depth===52&&y>=6)return B.ARCH;
   if(depth===52&&y>=3)return B.LATTICE;
   if(depth===42&&bay===4&&y===8)return B.LANTERN;
   return B.AIR;
  }
 }
 /* expansion minarets at the north corners */
 if((ax===39||ax===41)&&(lz===-51||lz===-31)){
  if(y>=2&&y<=27)return y%6===0?B.ARCH:B.MARBLE;
  if(y===28)return B.GOLD;if(y===29)return B.TURQ;if(y===30)return B.GOLD;
 }
 if(ax<=3&&az<=3&&y>=1&&y<=7)return B.STONE;
 return -1;
}
const LMT={
 mosque:{fn:mosque,p:v=>MQ[v]},
 charbagh:{fn:charbagh,p:()=>({hx:17,hz:17,h:13,ymin:-1})},
 museum:{fn:museum,p:()=>({hx:34,hz:61,h:31,ymin:-3,top:31,y0:15,top2:museumTop})},
 village:{fn:village,p:()=>({hx:20,hz:20,h:19,ymin:-1})},
 caravan:{fn:caravan,p:()=>({hx:14,hz:14,h:17,ymin:-1})},
 orchard:{fn:orchard,p:()=>({hx:14,hz:11,h:7})},
 vineyard:{fn:vineyard,p:()=>({hx:15,hz:11,h:5})},
 flowers:{fn:flowers,p:()=>({hx:10,hz:10,h:5,ymin:-1})}
 ,haram:{fn:haram,p:()=>({hx:96,hz:75,h:47,top:47,ymin:0})},
 landmarks:{fn:()=>-1,p:()=>({hx:15,hz:26,h:8,y0:16,ymin:0})},
 burj:{fn:burjKhalifa,p:()=>({hx:19,hz:21,h:63,top:63,y0:15,ymin:0})},
 sail:{fn:burjAlArab,p:()=>({hx:16,hz:20,h:31,top:31,y0:15,ymin:-2})},
 dohaMia:{fn:dohaMia,p:()=>({hx:19,hz:20,h:26,top:26,ymin:0})},
 petra:{fn:petraTreasury,p:()=>({hx:19,hz:20,h:27,top:27,ymin:0})},
 kuwait:{fn:kuwaitTowers,p:()=>({hx:20,hz:15,h:31,top:31,y0:15,ymin:-1})},
 hegra:{fn:hegraTomb,p:()=>({hx:12,hz:15,h:24,top:24,ymin:0})}
};
let lmId=0;
function makeLm(type,v,o,x,z,fixed,id){
 const T0=LMT[type],P=T0.p(v),hx=P.hx,hz=P.hz,ex=o&1?hz:hx,ez=o&1?hx:hz;
 const pts=[[0,0],[-ex,-ez],[ex,-ez],[-ex,ez],[ex,ez],[0,-ez],[0,ez],[-ex,0],[ex,0]];let s=0,mn=99,mx=0;
 for(const p of pts){const h=raw(x+p[0],z+p[1]);s+=h;mn=Math.min(mn,h);mx=Math.max(mx,h)}
 if(!fixed&&(mn<WL+1.5||mx-mn>7.5))return null;
 const cap=Math.max(WL+3,Math.min(type==='mosque'?18:22,H-2-(P.top||P.h)));
 const edge=fixed?Math.round(mx):Math.round(s/pts.length);
 const y0=type==='landmarks'?P.y0:fixed?clamp(Math.max(P.y0||0,edge),WL+1,H-2-(P.top||P.h)):clamp(edge,WL+3,cap);
 return{t:type,v,o,x,z,hx,hz,ex,ez,y0,h:P.h,ymin:P.ymin||0,P,fn:T0.fn,tp:P.top2||null,id:id};
}
/* Abu Dhabi's central district, then smaller landmark clusters across the Gulf. */
const FEATURED_LMS=[
 {t:'burj',name:'Burj Khalifa',region:'Dubai, UAE',dx:85,dz:-110},
 {t:'sail',name:'Burj Al Arab',region:'Dubai, UAE',dx:190,dz:-80},
 {t:'dohaMia',name:'Museum of Islamic Art',region:'Doha, Qatar',dx:-275,dz:-405},
 {t:'petra',name:'The Treasury at Petra',region:'Petra, Jordan',dx:-745,dz:-155},
 {t:'kuwait',name:'Kuwait Towers',region:'Kuwait City, Kuwait',dx:-525,dz:-615},
 {t:'hegra',name:'Hegra',region:'AlUla, Saudi Arabia',dx:-390,dz:135}
];
const FIXED=[['mosque',0,3,-108,-29],['mosque',1,2,-30,108],['mosque',2,0,-46,-100],['mosque',3,2,59,95],['museum',0,0,10,-93],['charbagh',0,0,-91,43],['village',0,0,118,21],['caravan',0,0,97,-68],
 ['orchard',0,0,58,62],['vineyard',0,1,-48,62],['flowers',0,0,6,52],
 /* Qatar, north-west across the Gulf: a compact Doha skyline and grand mosque. */
 ['museum',0,0,-355,-365],['mosque',1,1,-390,-330],['village',0,0,-330,-410],
 /* Saudi Arabia to the west and south-west: oasis town, caravan stop and mosques. */
 ['haram',0,0,-520,245],['mosque',0,0,-520,165],['village',0,0,-620,310],['caravan',0,0,-485,390],['charbagh',0,0,-660,235],['landmarks',0,0,-35,-9],
 ...FEATURED_LMS.map(l=>[l.t,0,0,l.dx,l.dz])];
const GATE_HUB={x:981.5,z:1013.5,step:4.76,nx:1,nz:0,y:16,count:4+FEATURED_LMS.length,tx:0,tz:1};
const hubDist=(x,z)=>{const dx=x-GATE_HUB.x,dz=z-GATE_HUB.z,s=dx*GATE_HUB.tx+dz*GATE_HUB.tz,d=dx*GATE_HUB.nx+dz*GATE_HUB.nz;
 return Math.max(Math.abs(s)-(GATE_HUB.count-1)*GATE_HUB.step/2-3,Math.abs(d)-4,0)};
const SPAWN_PALMS=[[-17,7],[-7,-13],[-21,-10],[-2,12]];
/* an open avenue in front of the grand mosque (kept free of trees) with a few palms that frame it from the sides */
const inAvenue=(x,z)=>x>=928&&x<=1002&&z>=984&&z<=1006;
const AVE_PALMS=[[944,1010],[950,981],[958,1011],[961,980],[972,1012],[974,979]];
const lmMemo=new Map();let fixedLms=null;
function fixedList(){if(!fixedLms)fixedLms=FIXED.map((f,i)=>makeLm(f[0],f[1],f[2],SPAWN.x+f[3],SPAWN.z+f[4],true,i));return fixedLms}
function protectedLandmarkBlock(x,y,z){for(const l of fixedList())if((l.t==='haram'||l.t==='landmarks')&&Math.abs(x-l.x)<=l.ex&&Math.abs(z-l.z)<=l.ez&&y>=l.y0&&y<=l.y0+l.h)return true;return false}
const RG=112,NR=Math.ceil(WX/RG);
function lmCell(rx,rz){
 if(rx<0||rz<0||rx>=NR||rz>=NR)return null;
 const k=rx*64+rz;let l=lmMemo.get(k);if(l!==undefined)return l;
 l=null;
 if(hash2(rx,rz,SEED+11)<.9){
  const x=rx*RG+32+Math.floor(hash2(rx,rz,SEED+13)*(RG-64)),z=rz*RG+32+Math.floor(hash2(rx,rz,SEED+14)*(RG-64));
  if(Math.hypot(x-SPAWN.x,z-SPAWN.z)>190&&!(Math.abs(x-GZ.x)<GZ.hx+GZ.moat+60&&Math.abs(z-GZ.z)<GZ.hz+GZ.moat+60)){
   const t=hash2(rx,rz,SEED+12),v3=hash2(rx,rz,SEED+15),o=Math.floor(hash2(rx,rz,SEED+16)*4);
   const ty=t<.26?'mosque':t<.4?'charbagh':t<.58?'village':t<.68?'caravan':t<.8?'orchard':t<.9?'vineyard':'flowers';
   l=makeLm(ty,v3<.34?1:v3<.67?2:3,o,x,z,false,100+rx*64+rz);
   if(l&&FEATURED_LMS.some(f=>Math.abs(x-SPAWN.x-f.dx)<l.ex+LMT[f.t].p(0).hx+22&&Math.abs(z-SPAWN.z-f.dz)<l.ez+LMT[f.t].p(0).hz+22))l=null;
  }
 }
 lmMemo.set(k,l);return l;
}
const chunkLms=[];
function gatherLms(x0,z0,x1,z1){
 chunkLms.length=0;
 for(const l of fixedList())if(l.x+l.ex+17>=x0&&l.x-l.ex-9<=x1&&l.z+l.ez+17>=z0&&l.z-l.ez-9<=z1)chunkLms.push(l);
 for(let rz=Math.floor((z0-60)/RG);rz<=Math.floor((z1+60)/RG);rz++)for(let rx=Math.floor((x0-60)/RG);rx<=Math.floor((x1+60)/RG);rx++){
  const l=lmCell(rx,rz);if(l&&l.x+l.ex+17>=x0&&l.x-l.ex-9<=x1&&l.z+l.ez+17>=z0&&l.z-l.ez-9<=z1)chunkLms.push(l)}
}
const CI={top:0,om:0,hm:0,fl:0,plot:0};
function colInfo(x,z){
 let h=raw(x,z),fl=0;CI.om=G.om;CI.hm=G.hm;
 for(let i=0;i<chunkLms.length;i++){const l=chunkLms[i];let dx,dz;
  if(l.t==='landmarks'){const vx=x-l.x,vz=z-l.z,s=vx*GATE_HUB.tx+vz*GATE_HUB.tz,d=vx*GATE_HUB.nx+vz*GATE_HUB.nz;dx=Math.abs(s)-24;dz=d< -8?-8-d:d>4?d-4:0}
  else{dx=Math.abs(x-l.x)-l.ex;dz=Math.abs(z-l.z)-l.ez}
  const d=Math.hypot(Math.max(dx,0),Math.max(dz,0));const apron=l.id<100&&l.t!=='landmarks'?3:0,grade=apron?16:8;
  if(d<grade){h=lerp(l.y0,h,smooth(clamp((d-apron)/(grade-apron),0,1)));if(dx<=0&&dz<=0)fl=1}}
 const dp=Math.hypot(Math.max(PLOT.x0-x,0,x-PLOT.x1),Math.max(PLOT.z0-z,0,z-PLOT.z1));
 h=lerp(PLOT_Y,h,smooth(clamp(dp/8,0,1)));
 const hd=hubDist(x,z);if(hd<4){h=lerp(GATE_HUB.y,h,smooth(hd/4));if(hd===0)fl=1}
 CI.top=clamp(Math.round(h),2,H-12);CI.fl=fl;CI.plot=dp===0?1:0;
 if(dp<4)CI.fl=Math.max(CI.fl,1);
 return CI.top;
}
const inLm=(x,z,m)=>{for(let i=0;i<chunkLms.length;i++){const l=chunkLms[i];if(Math.abs(x-l.x)<=l.ex+m&&Math.abs(z-l.z)<=l.ez+m)return true}return false};
const nearPlot=(x,z,m)=>x>=PLOT.x0-m&&x<=PLOT.x1+m&&z>=PLOT.z0-m&&z<=PLOT.z1+m;
/* chest per 48x48 cell */
function chestPos(gx,gz,out){
 if(gx===21&&gz===21){out[0]=1015;out[1]=1040;return true}
 if(hash2(gx,gz,SEED+50)>.85)return false;
 out[0]=gx*48+4+Math.floor(hash2(gx,gz,SEED+51)*40);out[1]=gz*48+4+Math.floor(hash2(gx,gz,SEED+52)*40);return true;
}
/* ---- chunk generation ---- */
const FLS=new Uint8Array(256),edits=new Map(),bedits=new Map(),tops=new Uint8Array(256),cpos=[0,0];
let gc=null,gx0=0,gz0=0;
function put(x,y,z,b,airOnly){
 const lx=x-gx0,lz=z-gz0;if((lx>>4)|(lz>>4)||y<0||y>=H-1)return;
 const i=(y<<8)|(lz<<4)|lx;if(airOnly&&gc.v[i])return;gc.v[i]=b;if(y>gc.my)gc.my=y;
}
const PCR=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
function palm(x,z,top,hv){
 const th=7+Math.floor(hv*4),ty=top+th;
 for(let k=1;k<=th;k++)put(x,top+k,z,B.WOOD);
 put(x,ty+1,z,B.LEAVES,1);
 for(const d of PCR)put(x+d[0],ty,z+d[1],B.LEAVES,1);
 for(const d of PCR.slice(0,4)){put(x+d[0]*2,ty,z+d[1]*2,B.LEAVES,1);put(x+d[0]*3,ty-1,z+d[1]*3,B.LEAVES,1);put(x+d[0]*4,ty-2,z+d[1]*4,B.LEAVES,1);
  put(x+d[0],ty-1,z+d[1],B.DATES,1);if(hv*7%1>.4)put(x+d[0],ty-2,z+d[1],B.DATES,1)}
 for(const d of PCR.slice(4)){put(x+d[0]*2,ty-1,z+d[1]*2,B.LEAVES,1);put(x+d[0]*3,ty-2,z+d[1]*3,B.LEAVES,1)}
}
function genChunk(c){
 const cx=c.cx,cz=c.cz,x0=cx*16,z0=cz*16,v=c.v;gc=c;gx0=x0;gz0=z0;c.my=0;c.chests.length=0;
 gatherLms(x0-14,z0-14,x0+29,z0+29);
 const fl=FLS;
 for(let lz=0;lz<16;lz++)for(let lx=0;lx<16;lx++){
  const x=x0+lx,z=z0+lz,top=colInfo(x,z),om=CI.om,hm=CI.hm,i=(lz<<4)|lx;tops[i]=top;fl[i]=CI.fl;
  const hill=hm>.3&&!CI.fl,plot=CI.plot;
  const rn=hash2(x,z,31);
  let sb=B.SAND,grass=false;
  if(hubDist(x,z)===0)sb=B.PATH;
  else if(plot)sb=B.SANDSTONE;
  else if(hill){sb=top>=33?B.STONE:top%4<2?B.SANDSTONE:B.RROCK}
  else if(top>WL+1&&om>.36+.2*(rn-.5)){sb=B.GRASS;grass=true}
  else if(top>=WL+1&&hm>.14+.3*rn)sb=B.SANDSTONE;
  for(let y=0;y<=top;y++){
   let b=B.STONE;
   if(y===top)b=sb;
   else if(grass&&y>=top-2)b=B.DIRT;
   else if(hill&&y>=WL)b=(y%4<2?B.SANDSTONE:B.RROCK);
   else if(y>=top-3)b=hill?B.SANDSTONE:B.SANDSTONE;
   if(y===0)b=B.STONE;
   v[(y<<8)|i]=b;
  }
  for(let y=top+1;y<=WL;y++)v[(y<<8)|i]=B.WATER;
  let my=Math.max(top,WL);
  if(!CI.fl){
   if(grass&&top>WL){
    const q=hash2(x,z,32),zone=vnoise(x/12,z/12,33)>.64;
    if(q<(zone? .42:.17)){v[((top+1)<<8)|i]=zone?B.FL0+Math.floor(vnoise(x/6+3,z/6,34)*6):B.TUFT;my=top+1}
   }else if(top>=WL-1&&top<=WL+1&&om>.2&&!hill&&rn<.3){v[((top+1)<<8)|i]=B.REED;my=Math.max(my,top+1)}
   /* Open Air Prison: scattered rubble from broken buildings, never a roof */
   if(top>WL&&gzD(x,z)<-3){const r=hash2(x,z,73);if(r<.025){v[((top+1)<<8)|i]=r<.01?B.STONE:B.SANDSTONE;my=Math.max(my,top+1);if(r<.007){v[((top+2)<<8)|i]=B.STONE;my=Math.max(my,top+2)}}}
  }
  if(my>c.my)c.my=my;
 }
 /* date palms: jittered or lattice cells, resolved by deterministic queries around the chunk */
 for(let gz=Math.floor((z0-4)/5);gz<=Math.floor((z0+19)/5);gz++)for(let gx=Math.floor((x0-4)/5);gx<=Math.floor((x0+19)/5);gx++){
  const hs=hash2(gx,gz,SEED+60);
  const grove=sstep(.56,.64,vnoise(gx/8,gz/8,40));
  let x=gx*5+2,z=gz*5+2;if(grove<.5){x+=Math.floor(hash2(gx,gz,SEED+61)*3)-1;z+=Math.floor(hash2(gx,gz,SEED+62)*3)-1}
  const top=colInfo(x,z);
  if(CI.fl||CI.hm>.1||top<=WL+1||nearPlot(x,z,5)||gzD(x,z)<GZ.moat+2)continue;
  const sp=Math.hypot(x-SPAWN.x,z-SPAWN.z);if(sp<5)continue;
  const p=CI.om>.3? .04+.4*grove*sstep(.3,.6,CI.om):.01;
  if(hs>p||inLm(x,z,11)||inAvenue(x,z)||hubDist(x,z)<5)continue;
  palm(x,z,top,hash2(gx,gz,SEED+63));
 }
 for(const p of SPAWN_PALMS){const x=SPAWN.x+p[0],z=SPAWN.z+p[1];if(x<x0-4||x>x0+19||z<z0-4||z>z0+19)continue;const top=colInfo(x,z);if(top<=WL+1||CI.fl)continue;palm(x,z,top,hash2(p[0],p[1],SEED+64))}
 for(const p of AVE_PALMS){const x=p[0],z=p[1];if(x<x0-4||x>x0+19||z<z0-4||z>z0+19)continue;const top=colInfo(x,z);if(top<=WL+1||CI.fl)continue;palm(x,z,top,hash2(x,z,SEED+65))}
 /* landmarks */
 for(const l of chunkLms){
  const ax0=Math.max(x0,l.x-l.ex),ax1=Math.min(x0+15,l.x+l.ex),az0=Math.max(z0,l.z-l.ez),az1=Math.min(z0+15,l.z+l.ez);
  if(ax0>ax1||az0>az1)continue;
  for(let z=az0;z<=az1;z++)for(let x=ax0;x<=ax1;x++){
   const dx=x-l.x,dz=z-l.z;let lx,lz;
   switch(l.o){case 0:lx=dx;lz=dz;break;case 1:lx=dz;lz=-dx;break;case 2:lx=-dx;lz=-dz;break;default:lx=-dz;lz=dx}
   const i=((z-z0)<<4)|(x-x0);
   const th=l.tp?l.tp(l,lx,lz):l.h;for(let y=l.ymin;y<=th;y++){const b=l.fn(l,lx,y,lz);if(b>=0){const Y=l.y0+y;if(Y>=0&&Y<H-1){v[(Y<<8)|i]=b;if(b&&Y>c.my)c.my=Y}}}
  }
 }
 /* knowledge chests */
 for(let gz=Math.floor(z0/48);gz<=Math.floor((z0+15)/48);gz++)for(let gx=Math.floor(x0/48);gx<=Math.floor((x0+15)/48);gx++){
  if(!chestPos(gx,gz,cpos))continue;
  const x=cpos[0],z=cpos[1];if(x<x0||x>=x0+16||z<z0||z>=z0+16)continue;
  const i=((z-z0)<<4)|(x-x0),top=tops[i];
  if(top<=WL||fl[i]||nearPlot(x,z,3))continue;
  let ty=top;if(v[((top+1)<<8)|i])continue;
  const sb=v[(top<<8)|i];if(sb===B.LEAVES||sb===B.WOOD)continue;
  v[((ty+1)<<8)|i]=B.CHEST;if(ty+1>c.my)c.my=ty+1;
 }
 genSigns(x0,z0);genPortals(x0,z0);genMachinePost(x0,z0);
 /* player and bot edits */
 if(!c.pure)for(const mp of [bedits.get(c.key),edits.get(c.key)])if(mp)for(const [i,b] of mp){
  const y=i>>8;if(liftProtected(x0+(i&15),y,z0+((i>>4)&15)))continue;
  v[i]=b;if(b&&y>c.my)c.my=y;
 }
 for(let y=1;y<H-1;y++){const o=y<<8;for(let i=0;i<256;i++)if(v[o+i]===B.CHEST&&c.chests.length<8)c.chests.push([x0+(i&15),y,z0+(i>>4)])}
 gc=null;
}
function groundTop(x,z){gatherLms(x-2,z-2,x+2,z+2);return colInfo(x,z)}

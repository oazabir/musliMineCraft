/* Burj Khalifa: three wings around the stepped core, with the approach from +Z. */
const BURJ_MASS=[
 [-3,-3,3,3,20],[-2,-2,2,2,25],[-1,-1,1,1,27],[0,0,0,0,31],
 [-2,2,2,8,8],[-2,2,2,6,12],[-1,2,1,5,15],[-1,2,1,4,18],
 [-6,-4,-2,0,13],[-8,-5,-5,-2,7],[-5,-3,-2,-1,17],
 [2,-4,6,0,15],[5,-5,8,-2,10],[2,-3,4,-1,19]
];
const BURJ_LIFT={shaft:[0,0],stops:[
 {name:'Lobby',x:0,y:1,z:1,yaw:Math.PI},
 {name:'At the Top · Levels 124–125',x:0,y:18,z:1,yaw:Math.PI},
 {name:'At the Top SKY · Level 148',x:0,y:23,z:1,yaw:Math.PI}
]};
const BURJ_STRIDE=21,BURJ_CENTER=10;
const burjFootprint=new Uint8Array(BURJ_STRIDE*BURJ_STRIDE);
for(const [x0,z0,x1,z1,top] of BURJ_MASS)for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
 const i=(z+BURJ_CENTER)*BURJ_STRIDE+x+BURJ_CENTER;
 burjFootprint[i]=Math.max(burjFootprint[i],top);
}
function burjKhalifa(l,lx,y,lz){
 const ax=Math.abs(lx),az=Math.abs(lz);
 if(ax>9||az>10||y<0||y>31)return -1;
 const i=(lz+BURJ_CENTER)*BURJ_STRIDE+lx+BURJ_CENTER,top=burjFootprint[i];
 if(y===0){
  if(ax>=5&&ax<=7&&lz>=4&&lz<=8)return B.WATER;
  if(ax>=4&&ax<=8&&lz>=3&&lz<=9)return B.ARCH;
  if(ax<=2&&lz>=3)return ax===2?B.ARCH:B.PATH;
  return (lx+lz)%2===0?B.MARBLE:B.LIME;
 }
 if(ax===0&&lz===0&&y<=24)return B.AIR;
 if(ax===0&&lz===1&&y>=4&&y<=22&&(y<18||y>19))return B.LIMEP;
 if(y>=18&&y<=19&&lx===-3&&(lz===-2||lz===-1))return B.AIR;
 if(y>=17&&y<=18&&lx>=-6&&lx<=-4&&lz>=-3&&lz<=0){
  if(y===17)return B.MARBLE;
  if(lx===-6||lz===-3||lz===0)return B.GLASS;
 }
 if(y>=22&&y<=23&&ax<=2&&lz>=3&&lz<=4){
  if(y===22)return B.MARBLE;
  if(lz===4||ax===2)return B.GLASS;
 }
 if(y>=23&&y<=24&&ax<=1&&lz===2)return B.AIR;
 if(y>top)return y===1&&ax===3&&lz===9?B.LANTERN:-1;
 if(y>=28)return y===31?B.LANTERN:B.MARBLE;
 if(y<=3&&ax<=1&&lz>=4)return B.AIR;
 const edge=burjFootprint[i-1]<y||burjFootprint[i+1]<y||
  (burjFootprint[i-BURJ_STRIDE]||0)<y||(burjFootprint[i+BURJ_STRIDE]||0)<y;
 if(y<=3){
  if(edge)return (lx%3===0&&lz%3===0)?B.MARBLE:B.GLASS;
  if(y===3&&ax===2&&lz>=-2&&lz<=3&&lz%3===0)return B.LANTERN;
  if(ax<=1&&lz<=0&&lz>=-1)return B.LIMEP;
  return B.AIR;
 }
 if((ax<=3&&az<=3&&y>=17&&y<=19)||(ax<=2&&az<=2&&y>=22&&y<=24)){
  const lower=y<=19,floor=lower?17:22,limit=lower?3:2;
  if(y===floor)return ax===2&&lz===0?B.LANTERN:B.MARBLE;
  if(ax===limit||az===limit)return (lx+lz)%4===0?B.LIMEP:B.GLASS;
  return ax<=1&&lz<=0&&lz>=-1?B.LIMEP:B.AIR;
 }
 if(y===top||y===4||y%5===0)return B.MARBLE;
 if(!edge)return B.STONE;
 return (lx+lz)%3===0?B.LIMEP:(lx-lz)%4===0?B.TURQ:B.GLASS;
}
function silBurjKhalifa(l,add,pk,lod){
 add(-9,0,-10,9,0,10,2);
 for(let i=0;i<BURJ_MASS.length;i++){
  const [x0,z0,x1,z1,top]=BURJ_MASS[i];
  const bottom=i===0?1:i===1?21:i===2?26:i===3?28:1;
  add(x0,bottom,z0,x1,top,z1,i===3?2:23);
 }
 if(!lod){add(-6,17,-3,-4,17,0,2);add(-2,22,3,2,22,4,2);add(-2,23,4,2,23,4,23)}
 pk.push([0,0,31]);
}

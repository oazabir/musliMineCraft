/* Burj Khalifa: three wings around a stepped core, with a walk-in lobby from +Z. */
const BURJ_MASS=[
 [-3,-3,3,3,21],[-2,-2,2,2,24],[-1,-1,1,1,27],[0,0,0,0,31],
 [-2,2,2,8,8],[-1,2,1,6,13],[-1,2,1,4,16],
 [-6,-3,-2,0,13],[-8,-4,-5,-1,7],[-5,-3,-2,-1,17],
 [2,-3,6,0,15],[5,-4,8,-1,10],[2,-3,4,-1,19]
];
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
 if(y>top)return y===1&&ax===3&&lz===9?B.LANTERN:-1;
 if(y>=28)return y===31?B.LANTERN:B.MARBLE;
 if(y<=3&&ax<=1&&lz>=4)return 0;
 const edge=burjFootprint[i-1]<y||burjFootprint[i+1]<y||
  (burjFootprint[i-BURJ_STRIDE]||0)<y||(burjFootprint[i+BURJ_STRIDE]||0)<y;
 if(y<=3){
  if(edge)return (lx%3===0&&lz%3===0)?B.MARBLE:B.GLASS;
  if(y===3&&ax===2&&lz>=-2&&lz<=3&&lz%3===0)return B.LANTERN;
  return 0;
 }
 if(y===top||y===4||y%5===0)return B.MARBLE;
 if(!edge)return B.STONE;
 return (lx+lz)%3===0?B.LIMEP:(lx-lz)%4===0?B.GLASS:B.TURQ;
}
function silBurjKhalifa(l,add,pk,lod){
 add(-9,0,-10,9,0,10,2);
 for(let i=0;i<BURJ_MASS.length;i++){
  const [x0,z0,x1,z1,top]=BURJ_MASS[i];
  const bottom=i===0?1:i===1?22:i===2?25:i===3?28:1;
  add(x0,bottom,z0,x1,top,z1,i===3?2:23);
 }
 pk.push([0,0,31]);
}

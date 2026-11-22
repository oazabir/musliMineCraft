/* Burj Khalifa: three wings around the stepped core, with the approach from +Z. */
const BURJ_MASS=[
 [-3,-3,3,3,20],[-2,-2,2,2,25],[-1,-1,1,1,27],[0,0,0,0,31],
 [-2,2,2,8,8],[-2,2,2,6,12],[-1,2,1,5,15],[-1,2,1,4,18],
 [-6,-4,-2,0,13],[-8,-5,-5,-2,7],[-5,-3,-2,-1,17],
 [2,-4,6,0,15],[5,-5,8,-2,10],[2,-3,4,-1,19]
];
const BURJ_SKY_HEIGHT=630;
const BURJ_LIFT={shaft:[0,0],summit:BURJ_SKY_HEIGHT,stops:[
 {name:'Lobby',x:0,y:2,z:2,yaw:Math.PI},
 {name:'At the Top Ã‚Â· Levels 124Ã¢â‚¬â€œ125',x:0,y:36,z:2,yaw:Math.PI},
 {name:'At the Top SKY Ã‚Â· Level 148',x:0,y:46,z:2,yaw:Math.PI},
 {name:'Spire summit',x:0,y:BURJ_SKY_HEIGHT,z:2,yaw:Math.PI}
]};
const BURJ_STRIDE=21,BURJ_CENTER=10;
const burjFootprint=new Uint8Array(BURJ_STRIDE*BURJ_STRIDE);
for(const [x0,z0,x1,z1,top] of BURJ_MASS)for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
 const i=(z+BURJ_CENTER)*BURJ_STRIDE+x+BURJ_CENTER;
 burjFootprint[i]=Math.max(burjFootprint[i],top);
}
function burjKhalifa(l,lx,y,lz){
 if(lx===0&&lz===0&&y>=2)return B.AIR;
 if(Math.abs(lx)<=1&&lz>=3&&y>=1&&y<=4)return lz===3&&y===1?B.MARBLE:B.AIR;
 if(lz===2)for(const p of BURJ_LIFT.stops){
  if(lx===0&&y===p.y+2)return B.LANTERN;
  if(Math.abs(lx)===1&&y>=p.y&&y<=p.y+2)return B.LIMEP;
 }
 const x=Math.floor(lx/2),floor=Math.floor(y/2),z=Math.floor(lz/2),block=burjBlock(x,floor,z);
 if(y<2||block!==B.GLASS&&block!==B.TURQ&&block!==B.BLUE)return block;
 const i=(z+BURJ_CENTER)*BURJ_STRIDE+x+BURJ_CENTER;
 if(burjFootprint[i]<floor)return block;
 const side=(burjFootprint[i-1]||0)<floor||(burjFootprint[i+1]||0)<floor;
 const bay=side?lz:lx;
 if(y%5===4||bay%3===0)return B.LIMEP;
 if(y%10===3&&(bay+y)%7===0)return B.LANTERN;
 return (bay+y)&1?B.BLUE:B.TURQ;
}
function burjBlock(lx,y,lz){
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
 if((lx+lz)%3===0)return B.LIMEP;
 if(y%5===1)return B.BLUE;
 return (lx-lz)%4===0?B.TURQ:B.GLASS;
}
function silBurjKhalifa(l,add,pk,lod){
 const rawAdd=add;
 add=(x0,y0,z0,x1,y1,z1,mat)=>rawAdd(x0*2,y0*2,z0*2,x1*2+1,y1*2+1,z1*2+1,mat);
 add(-9,0,-10,9,0,10,2);
 for(let i=0;i<BURJ_MASS.length;i++){
  const [x0,z0,x1,z1,top]=BURJ_MASS[i];
  const bottom=i===0?1:i===1?21:i===2?26:i===3?28:1;
  add(x0,bottom,z0,x1,top,z1,i===3?2:23);
 }
 if(!lod){add(-6,17,-3,-4,17,0,2);add(-2,22,3,2,22,4,2);add(-2,23,4,2,23,4,23)}
 pk.push([0,0,63]);
}

/* Upper facade in world units, independent of the terrain chunk height. */
function burjUpper(q,box){
 const blue=[.12,.34,.66],cyan=[.29,.61,.77],silver=[.76,.85,.87],dark=[.10,.23,.38],lit=[.83,.73,.49];
 const tier=(x,z,w,d,y,top)=>{
  const left=Math.floor(x-w/2),right=Math.ceil(x+w/2),back=Math.floor(z-d/2),front=Math.ceil(z+d/2);
  box(left,y,back,right,top,front,dark);
  for(let floor=y;floor<top;floor+=5){
   const ceiling=Math.min(floor+5,top);
   box(left-1,ceiling-1,back-1,right+1,ceiling,front+1,silver);
   if(ceiling-floor<2)continue;
   for(let a=left;a<right;a+=3)for(const side of [back-1,front]){
    const color=(a+floor)%11===0?lit:(a+floor)%2?blue:cyan;
    box(a,floor,side,Math.min(a+2,right),ceiling-1,side+1,color);
   }
   for(let a=back;a<front;a+=3)for(const side of [left-1,right]){
    const color=(a-floor)%11===0?lit:(a-floor)%2?blue:cyan;
    box(side,floor,a,side+1,ceiling-1,Math.min(a+2,front),color);
   }
   if(w>=7&&ceiling-floor>=4&&floor%4===1){
    box(left+1,floor+1,front+1,right-1,floor+2,front+2,silver);
   }
  }
  if(w>=7&&d>=7){
   box(left,top,back,right,top+1,front,silver);
   box(left+1,top+1,back+1,left+3,top+3,back+3,dark);
   box(right-3,top+1,front-3,right-1,top+3,front-1,dark);
   for(const a of [left,right-1])for(const b of [back,front-1])box(a,top+1,b,a+1,top+2,b+1,lit);
  }
 };
 for(const [x,z,w,d,base,top] of [
  [0,0,26,26,41,169],[-15,-5,17,19,45,117],[15,-5,17,19,46,138],[0,15,18,17,42,104],
  [-9,5,15,16,168,226],[7,-7,18,16,162,271],[0,0,22,22,163,307],
  [-5,4,12,14,299,347],[5,-5,13,12,300,397],[0,0,16,16,301,433],
  [-2,1,10,10,426,482],[1,-1,7,7,475,517],[0,0,4,4,511,553],[0,0,2,2,552,581]
 ])tier(x,z,w,d,base,top);
 box(-1,580,-1,1,609,1,silver);
 box(0,609,0,1,BURJ_SKY_HEIGHT,1,silver);
}

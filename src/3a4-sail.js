/* Burj Al Arab: curving causeway, open atrium, scenic lift and two cantilevers. */
const ARAB_LIFT={shaft:[1,5],stops:[
 {name:'Atrium lobby',x:0,y:1,z:5,yaw:Math.PI},
 {name:'Skyview lounge',x:0,y:20,z:5,yaw:Math.PI},
 {name:'Helipad level',x:0,y:23,z:5,yaw:0}
]};
const BAA_W=[8,8,9,9,9,9,9,9,9,9,9,9,9,8,8,8,7,7,6,6,5,5,4,4,3,2,1];
const BAA_EDGE=[-8,-9,-10,-11,-11,-12,-12,-12,-12,-12,-12,-11,-11,-11,-10,-10,-9,-8,-8,-7,-6,-5,-4,-3,-1,1,3];
function burjArabLiftBlock(x,y,z){
 if(y<1||y>25)return -1;
 if(x===1&&z===5)return 0;
 if(x===0&&z===5){
  if(y===19||y===22)return B.MARBLE;
  if(ARAB_LIFT.stops.some(s=>y===s.y||y===s.y+1))return 0;
  return y%4===0?B.GOLD:B.GLASS;
 }
 if((x===2&&z===5)||(x===1&&(z===4||z===6)))return y%4===0?B.MARBLE:B.GLASS;
 return -1;
}
function burjAlArab(l,x,y,z){
 const ax=Math.abs(x),bridgeCenter=Math.max(0,Math.floor((z-9)*(z-9)/29)),bax=Math.abs(x-bridgeCenter);
 const bridge=z>=9&&bax<=3,island=x*x*144+z*z*225<=32400,terrace=z<=-12&&z>=-18&&ax<=Math.min(9,z+25);
 if(y<=0){
  if(bridge)return y===0?(bax===3?B.ARCH:B.PATH):bax===2&&z%5===0?B.STONE:B.WATER;
  if(terrace){if(y<0)return B.SANDSTONE;
   if(z>=-17&&z<=-14&&ax>=3&&ax<=7)return z===-17||z===-14||ax===3||ax===7?B.TURQ:B.WATER;
   return z===-18?B.ARCH:B.PATH}
  if(!island){if(ax>=15||z>=19||z<=-19)return -1;return y>=-1?B.WATER:B.SAND;}
  if(y<0)return B.SANDSTONE;
  if(x*x+z*z<=4)return B.WATER;
  if(x*x+z*z<=10)return B.TURQ;
  if(z>=4&&ax<=2)return ax===2?B.GOLD:B.PATH;
  return ((x+z)&3)===0?B.LIMEP:B.MARBLE;
 }
 const lift=burjArabLiftBlock(x,y,z);if(lift>=0)return lift;
 if(bridge&&bax===3&&z>12&&z<20&&y===1)return z%4===0?B.LANTERN:B.LATTICE;
 if(terrace&&z===-18&&ax%4===0&&y===1)return B.LANTERN;
 const pad=z+13,padR=x*x+pad*pad;
 if(y===22&&padR<=20){
  if(padR>=15)return B.GOLD;
  return ax===1&&Math.abs(pad)<=1||ax===0&&pad===0?B.MARBLE:B.GREEN;
 }
 if(z>=-11&&z<=4&&ax<=1&&y>=21&&y<=24){
  if(y===22||y===21&&z>=-9&&z%3===0)return B.MARBLE;
  if(y===23&&ax===1&&padR>20)return B.GLASS;
  if(y>=23)return 0;
 }
 if(z>=6&&z<=12&&ax<=4&&y>=19&&y<=22){
  if(y===19||y===22)return ax===4||z===12?B.MARBLE:B.LIMEP;
  if(ax===4||z===12)return x%3===0&&ax!==0?B.LIME:B.GLASS;
  if(y===20&&ax===2&&(z===8||z===10))return B.SHELF;
  if(y===20&&ax===3&&z%2)return B.CARPET;
  return 0;
 }
 if(y>=28)return ax===0&&z===5?(y===31?B.LANTERN:B.MARBLE):-1;
 if(y<=5&&z>=4&&z<=10&&ax<=4){
  if(y===5&&z>=8)return ax===4||z===10?B.MARBLE:B.LIMEP;
  if(ax===4&&z>=7&&z<=9)return y===4?B.LANTERN:y<=3?B.GLASS:B.ARCH;
  if(ax===3&&z>=7&&z<=9&&y===1)return B.BLUE;
  if(y<=4&&ax<=2)return 0;
 }
 if(z>=4&&z<=7&&ax<=1)return x===0&&z===7&&y<26&&y%5!==0?B.GLASS:B.MARBLE;
 if(ax===3&&z===2&&y<=17)return y%5===0?B.LANTERN:B.GOLD;
 const width=BAA_W[y-1],edge=BAA_EDGE[y-1];
 if(ax>width||z<edge||z>6)return -1;
 const sail=edge+Math.floor(ax*ax/(width*2));
 if(z===sail){if(y%6===0||ax===width||ax===0)return B.MARBLE;return y%6===1?B.GLASS:B.LIME;}
 if(z<sail)return -1;
 const wing=Math.max(2,Math.round(width*(6-z)/(6-edge)));
 if(ax===wing)return y%5===0?B.MARBLE:((y+z)%6===0?B.BLUE:B.GLASS);
 if(ax===wing+1&&ax<=width&&(y%6<2||Math.abs(z-(5-y*.55))<1))return B.MARBLE;
 if(ax>2&&ax<wing&&y%4===0&&z<3)return B.ARCH;
 if(ax===wing-1&&ax>2&&y%4===1&&y>2&&z<3)return y%8===1?B.TURQ:B.GLASS;
 if(y===26&&ax<=wing&&z>=sail)return B.MARBLE;
 return -1;
}
function silBurjAlArab(l,add,pk,lod){
 add(-13,0,-9,13,0,9,1);add(-9,0,-18,9,0,-10,1);
 add(-3,0,8,3,0,14,1);add(-2,0,15,5,0,17,1);add(0,0,18,7,0,20,1);
 const step=lod?5:3;
 for(let y=1;y<=27;y+=step){
  const end=Math.min(27,y+step-1),at=(y+end-2)>>1,w=BAA_W[at],edge=BAA_EDGE[at];
  add(-w,y,edge,w,end,edge,2);add(-w,y,edge+1,w,end,3,4);
 }
 add(-1,1,4,2,27,7,2);add(0,28,5,0,31,5,2);
 add(-3,22,-16,3,22,-10,2);add(-1,22,-12,1,22,-5,2);
 add(-4,19,6,4,22,12,4);pk.push([0,5,31]);
}

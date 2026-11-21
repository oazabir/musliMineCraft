/* Burj Al Arab: a sail over a tiled island, with a bridge leading into the atrium. */
const BAA_W=[8,8,9,9,9,9,9,9,9,9,9,9,9,8,8,8,7,7,6,6,5,5,4,4,3,2,1];
const BAA_EDGE=[-8,-9,-10,-11,-11,-12,-12,-12,-12,-12,-12,-11,-11,-11,-10,-10,-9,-8,-8,-7,-6,-5,-4,-3,-1,1,3];
function burjAlArab(l,x,y,z){
 const ax=Math.abs(x),bridge=ax<=3&&z>=9,island=x*x*144+z*z*225<=32400;
 if(y<=0){
  if(bridge)return y===0?(ax===3?B.ARCH:B.PATH):ax===2&&z%5===0?B.STONE:B.WATER;
  if(!island){if(ax>=15||z>=19||z<=-19)return -1;return y>=-1?B.WATER:B.SAND;}
  if(y<0)return B.SANDSTONE;
  if(x*x+z*z<=4)return B.WATER;
  if(x*x+z*z<=10)return B.TURQ;
  return z>=4&&ax<=2?B.PATH:((x+z)&3)===0?B.LIMEP:B.MARBLE;
 }
 if(bridge&&ax===3&&z>12&&z<20&&y===1)return z%4===0?B.LANTERN:B.LATTICE;
 const pad=z+13;
 if(y===21&&x*x+pad*pad<=16){
  if(x*x+pad*pad>=10)return B.MARBLE;
  return ax===1||ax===0&&pad===0?B.MARBLE:B.GREEN;
 }
 if(ax<=1&&z>=-12&&z<=-5&&y===21)return B.MARBLE;
 if(z>=8&&z<=12&&ax<=4&&y>=19&&y<=22){
  if(y===19||y===22)return B.MARBLE;
  if(ax===4||z===12)return x%3===0?B.LIME:B.GLASS;
 }
 if(y>=28)return ax===0&&z===5?(y===31?B.LANTERN:B.MARBLE):-1;
 if(y<=5&&z>=4&&z<=10&&ax<=4){
  if(y===5)return ax===4||z===10?B.MARBLE:B.LIMEP;
  if(ax===4&&z===9)return y===4?B.LANTERN:B.ARCH;
  if(y<=4&&ax<=2)return 0;
 }
 if(z>=4&&z<=7&&ax<=1)return x===0&&z===7&&y<26&&y%5!==0?B.GLASS:B.MARBLE;
 if(ax===3&&z===2&&y<=10)return y%5===0?B.LANTERN:B.GOLD;
 const width=BAA_W[y-1],edge=BAA_EDGE[y-1];
 if(ax>width||z<edge||z>6)return -1;
 const sail=edge+Math.floor(ax*ax/(width*2));
 if(z===sail){if(y%6===0||ax===width||ax===0)return B.MARBLE;return y%6===1?B.GLASS:B.LIME;}
 if(z<sail)return -1;
 const wing=Math.max(2,Math.round(width*(6-z)/(6-edge)));
 if(ax===wing)return y%5===0?B.MARBLE:((y+z)%6===0?B.BLUE:B.GLASS);
 if(ax===wing+1&&ax<=width&&(y%6<2||Math.abs(z-2-y%8)<1))return B.MARBLE;
 if(ax===wing-1&&y%5===0&&z<3)return y%10===0?B.TURQ:B.BLUE;
 if(y===26&&ax<=wing&&z>=sail)return B.MARBLE;
 return -1;
}
function silBurjAlArab(l,add,pk,lod){
 add(-13,0,-9,13,0,9,1);add(-3,0,8,3,0,20,1);
 const step=lod?5:3;
 for(let y=1;y<=27;y+=step){
  const end=Math.min(27,y+step-1),at=(y+end-2)>>1,w=BAA_W[at],edge=BAA_EDGE[at];
  add(-w,y,edge,w,end,edge,2);add(-w,y,edge+1,w,end,3,4);
 }
 add(-1,1,4,1,27,7,2);add(0,28,5,0,31,5,2);
 add(-3,21,-16,3,21,-10,2);add(-1,21,-12,1,21,-5,2);
 add(-4,19,8,4,22,12,4);pk.push([0,5,31]);
}

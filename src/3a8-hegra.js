/* Hegra: the partly carved façade of the Tomb of Lihyan son of Kuza. */
const HEGRA_ROCK=[
 [-11,-10,11,4,4],[-10,-10,10,4,13],[-10,-9,9,4,18],
 [-9,-8,7,4,21],[-8,-7,5,3,23],[-6,-6,2,1,24]
];
function hegraTomb(l,x,y,z){
 const ax=Math.abs(x);
 if(y===0){
  if(z>=8&&z<=15&&ax<=3+(z>=12?2:0))return B.PATH;
  if(ax<=11&&z>=-11&&z<8)return B.SAND;
  return -1;
 }
 if(y>=4&&y<=23&&z>=5&&z<=7){
  /* The doorway is recessed into the rock, beneath four pilasters and two cornices. */
  if(y<=9&&ax<=1)return B.AIR;
  if(y<=9&&ax===2&&z===5)return y<=5?B.RROCK:B.SANDSTONE;
  if(y===9&&ax<=3&&z===6||y===10&&ax<=2&&z===6||y===11&&ax<=1&&z===6)return B.ARCH;
  if(y>=7&&y<=12&&(ax===3||ax===7)&&z===6)return y===12?B.ARCH:B.SANDSTONE;
  if(y===12&&z===5&&(ax===4||ax===6))return B.ARCH;
  if(y===13&&ax<=7&&z<=6||y===14&&ax<=8)return B.ARCH;
  if(y>=15&&y<=16&&ax<=7&&z===5)return B.SANDSTONE;
  if(y===17&&ax<=8&&z<=6||y===18&&ax<=8)return B.ARCH;
  if(y>=19&&ax>=2&&ax<=8&&z<=6&&y<=18+Math.ceil((ax-1)*.62))return B.SANDSTONE;
  if(y<=6&&ax>=2&&ax<=7&&z===5&&(y<=5||ax>=5))return B.RROCK;
 }
 if(y>24||z>4)return -1;
 const tier=y<=4?0:y<=13?1:y<=18?2:y<=21?3:y<=23?4:5;
 const [left,back,right,front]=HEGRA_ROCK[tier];
 if(x<left||x>right||z<back||z>front)return -1;
 const corner=Math.min(x-left,right-x)+Math.min(z-back,front-z);
 if(corner<2+(tier>=3?0:1))return -1;
 if(ax<=1&&y>=5&&y<=8&&z>=2)return B.AIR;
 if(z===1&&ax<=1&&y>=5&&y<=8)return B.RROCK;
 const layer=(y+(x+z>2?1:0))%7;
 return layer<=1||y<4&&ax>6?B.RROCK:B.SANDSTONE;
}
function silHegraTomb(l,add,pk,lod){
 for(let i=0;i<HEGRA_ROCK.length;i++){
  const [left,back,right,front,top]=HEGRA_ROCK[i],bottom=i?HEGRA_ROCK[i-1][4]+1:0;
  add(left,bottom,back+2,right,top,front-2,0);
  if(!lod)add(left+2,bottom,back,right-2,top,front,0);
 }
 add(-8,13,5,8,14,7,7);add(-7,15,5,7,16,5,0);add(-8,17,5,8,18,7,7);
 if(!lod){
  for(const dx of[-7,-3,3,7])add(dx,7,5,dx,12,6,7);
  for(const side of[-1,1])for(let step=0;step<4;step++){
   const a=(2+step*2)*side,b=(step===3?8:3+step*2)*side;
   add(Math.min(a,b),19,5,Math.max(a,b),19+step,6,7);
  }
 }
 pk.push([-2,-3,24]);
}

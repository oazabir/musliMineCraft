/* Hegra: the partly carved façade of the Tomb of Lihyan son of Kuza. */
const HEGRA_ROCK=[
 [-10,-11,9,6,3],[-9,-11,8,5,9],[-9,-10,8,5,15],
 [-8,-9,8,5,20],[-8,-8,8,5,22],[-7,-7,8,4,24]
];
function hegraTomb(l,x,y,z){
 const ax=Math.abs(x);
 if(y===0){
  if(z>=8&&z<=15&&ax<=3+(z>=12?2:0))return (x*3+z)%7===0?B.SANDSTONE:B.SAND;
  if(ax<=11&&z>=-12&&z<8)return B.SAND;
  return -1;
 }
 if(z>=7&&z<=8&&ax<=5&&y<=9-z)return y===9-z?B.SANDSTONE:B.RROCK;
 if(y>=4&&y<=24&&z>=5&&z<=7){
  if(y<=8&&ax<=1)return B.AIR;
  if(y<=8&&ax===2&&z===5)return y<=5?B.RROCK:B.SANDSTONE;
  if(z===6&&(y===9&&ax<=3||y===10&&ax<=2||y===11&&ax<=1))return B.ARCH;
  if(z===6&&y===10&&ax===3||z===6&&y===12&&ax===0)return B.SANDSTONE;
  /* Only the capitals project from the partly finished pilasters. */
  if(z===5&&y>=7&&y<=11&&(ax===3||ax===7))return y===7?B.RROCK:B.SANDSTONE;
  if(y===12&&z===6&&(ax===3||ax>=6&&ax<=8))return B.ARCH;
  if(y===13&&ax<=7&&z<=6||y===14&&ax<=8&&z<=6)return y===13&&z===6?B.LIME:B.ARCH;
  if(y>=15&&y<=16&&ax<=7&&z===5)return B.SANDSTONE;
  if(y===17&&ax<=7&&z<=6||y===18&&ax<=8)return y===18&&z===7?B.LIME:B.ARCH;
  if(y>=19&&ax<=8&&z<=6&&ax>=(y-18)*2-1)return y===19?B.ARCH:B.SANDSTONE;
  if(z===5&&y>=19&&ax<=8)return B.RROCK;
  if(y<=7&&ax>=2&&ax<=8&&z===5)return (x+y)%5===0?B.SANDSTONE:B.RROCK;
 }
 if(y>24||z>6)return -1;
 const tier=y<=3?0:y<=9?1:y<=15?2:y<=20?3:y<=22?4:5;
 const [left,back,right,front]=HEGRA_ROCK[tier];
 if(x<left||x>right||z<back||z>front)return -1;
 const corner=Math.min(x-left,right-x)+Math.min(z-back,front-z),carved=z===front&&y>=4&&y<=22&&ax<=8;
 if(!carved&&(corner<2+(tier<2?1:0)||y===24&&(x<-4||z<-5||x>2&&z>0)))return -1;
 if(ax<=1&&y>=4&&y<=8&&z>=2)return B.AIR;
 const layer=(y+Math.floor((x+z+23)/7))%7;
 return layer<=1||y<5&&ax>4||z===1&&ax<=1&&y<=8?B.RROCK:B.SANDSTONE;
}
function silHegraTomb(l,add,pk,lod){
 for(let i=0;i<HEGRA_ROCK.length;i++){
  const [left,back,right,front,top]=HEGRA_ROCK[i],bottom=i?HEGRA_ROCK[i-1][4]+1:0;
  add(left,bottom,back+2,right,top,front-2,0);
  if(!lod)add(left+2,bottom,back,right-2,top,front,0);
 }
 add(-5,1,4,5,2,7,0);add(-8,13,5,8,14,6,7);add(-7,15,5,7,16,5,0);add(-8,17,5,8,18,7,7);
 if(!lod){
  add(-3,9,5,3,9,6,7);add(-2,10,5,2,10,6,7);add(-1,11,5,1,11,6,7);
  for(const dx of[-7,-3,3,7])add(dx,9,5,dx,12,6,7);
  for(const side of[-1,1])for(let step=0;step<4;step++){
   const a=(1+step*2)*side,b=(step===3?8:2+step*2)*side;
   add(Math.min(a,b),19,5,Math.max(a,b),19+step,6,7);
  }
 }
 pk.push([-2,-3,24]);
}

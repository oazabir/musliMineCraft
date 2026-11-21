/* Kuwait Towers: two tiled water towers and the slender lighting tower. */
const KUWAIT_MAIN={x:-7,z:0,h:31},KUWAIT_WATER={x:7,z:-4,h:25},KUWAIT_LIGHT={x:14,z:6,h:19};
function kuwaitBulb(x,y,z,r,view){
 const d2=x*x+y*y+z*z;
 if(d2>r*r+.5)return -1;
 if(d2<(r-.8)*(r-.8))return view&&y===0?B.MARBLE:-1;
 if(view&&y===1)return B.GLASS;
 if(view&&y===0)return B.MARBLE;
 const tile=((x+z+((y&1)<<1)+y)%8+8)%8;
 return tile<2?B.GREEN:tile<5?B.TURQ:tile<7?B.BLUE:B.MARBLE;
}
function kuwaitTowers(l,x,y,z){
 const mainX=x-KUWAIT_MAIN.x,mainZ=z-KUWAIT_MAIN.z,waterX=x-KUWAIT_WATER.x,waterZ=z-KUWAIT_WATER.z,lightX=x-KUWAIT_LIGHT.x,lightZ=z-KUWAIT_LIGHT.z;
 const plaza=Math.abs(x)<=18&&Math.abs(z)<=14&&Math.abs(x)+Math.abs(z)<29;
 const avenue=Math.abs(mainX)<=2&&z>=4;
 if(y<0){if(plaza||avenue)return B.ARCH;return -1;}
 if(y===0){
  if(avenue)return B.PATH;
  if(!plaza)return -1;
  if(Math.abs(x+13)<=2&&z>=6&&z<=11||Math.abs(x-5)<=2&&z>=7&&z<=12)return B.WATER;
  return (x+z)%5===0?B.LIMEP:B.MARBLE;
 }
 if(y<=5&&Math.abs(mainX)<=3&&Math.abs(mainZ)<=3){
  if(y<=3&&Math.abs(mainX)<=1&&mainZ===3)return 0;
  if(y===5)return B.MARBLE;
  if(Math.abs(mainX)===3||Math.abs(mainZ)===3)return y===1||y===4||Math.abs(mainX)===3&&Math.abs(mainZ)===3?B.MARBLE:B.GLASS;
  if(Math.abs(mainX)<=1&&mainZ===-2)return y===4?B.LANTERN:B.LIMEP;
 }
 if(y===4&&Math.abs(mainX)<=2&&mainZ>=4&&mainZ<=6)return mainZ===6?B.TURQ:B.MARBLE;
 if(y===1&&z>=7&&(mainX===-3||mainX===3)&&z%3===1)return B.LANTERN;
 if(Math.abs(mainX)<=5&&Math.abs(mainZ)<=5){
  let bulb=kuwaitBulb(mainX,y-13,mainZ,5,true);if(bulb>=0)return bulb;
  bulb=kuwaitBulb(mainX,y-23,mainZ,3,true);if(bulb>=0)return bulb;
  const r=y<=16?2:y<=26?1:0;
  if(y>=5&&y<=KUWAIT_MAIN.h&&mainX*mainX+mainZ*mainZ<=r*r)return y===KUWAIT_MAIN.h?B.LANTERN:B.MARBLE;
 }
 if(Math.abs(waterX)<=4&&Math.abs(waterZ)<=4){
  const bulb=kuwaitBulb(waterX,y-16,waterZ,4,false);if(bulb>=0)return bulb;
  const r=y<=15?2:y<=21?1:0;
  if(y<=KUWAIT_WATER.h&&waterX*waterX+waterZ*waterZ<=r*r)return B.MARBLE;
 }
 if(y===8&&Math.abs(lightX)+Math.abs(lightZ)===1)return B.LANTERN;
 if(y<=KUWAIT_LIGHT.h&&Math.abs(lightX)+Math.abs(lightZ)<=(y<=7?1:0))return y===KUWAIT_LIGHT.h?B.LANTERN:B.MARBLE;
 return -1;
}
function silKuwaitTowers(l,add,pk,lod){
 add(-17,0,-12,17,0,12,2);add(-9,0,13,-5,0,15,1);
 const shaft=(p,y0,y1,r)=>add(p.x-r,y0,p.z-r,p.x+r,y1,p.z+r,2);
 const sphere=(p,y,r)=>{
  if(lod){add(p.x-r,y-2,p.z-r,p.x+r,y+2,p.z+r,5);return;}
  const shoulder=r-1,crown=r-2;
  add(p.x-crown,y-r,p.z-crown,p.x+crown,y-r+1,p.z+crown,4);
  if(r>=4)add(p.x-shoulder,y-r+2,p.z-shoulder,p.x+shoulder,y-2,p.z+shoulder,5);
  add(p.x-r,y-1,p.z-r,p.x+r,y+1,p.z+r,5);
  if(r>=4)add(p.x-shoulder,y+2,p.z-shoulder,p.x+shoulder,y+r-2,p.z+shoulder,5);
  add(p.x-crown,y+r-1,p.z-crown,p.x+crown,y+r,p.z+crown,4);
 };
 add(-10,1,-3,-4,5,3,2);
 shaft(KUWAIT_MAIN,6,16,2);shaft(KUWAIT_MAIN,17,26,1);shaft(KUWAIT_MAIN,27,31,0);
 shaft(KUWAIT_WATER,1,15,2);shaft(KUWAIT_WATER,16,21,1);shaft(KUWAIT_WATER,22,25,0);
 shaft(KUWAIT_LIGHT,1,7,1);shaft(KUWAIT_LIGHT,8,19,0);
 sphere(KUWAIT_MAIN,13,5);sphere(KUWAIT_MAIN,23,3);sphere(KUWAIT_WATER,16,4);
 for(const p of [KUWAIT_MAIN,KUWAIT_WATER,KUWAIT_LIGHT])pk.push([p.x,p.z,p.h]);
}

/* Kuwait Towers: enamelled reservoirs, a glazed lookout and the floodlight needle. */
const KUWAIT_MAIN={x:-7,z:0,h:31},KUWAIT_WATER={x:7,z:-4,h:25},KUWAIT_LIGHT={x:14,z:6,h:17};
const KT_RESTAURANT=13,KT_LOOKOUT=21,KT_RESERVOIR=16;
const KUWAIT_LIFT={shaft:[-7,0],stops:[
 {name:'Lobby',x:-7,y:1,z:1,yaw:Math.PI},
 {name:'Restaurant',x:-7,y:KT_RESTAURANT+1,z:1,yaw:Math.PI},
 {name:'Observation sphere',x:-7,y:KT_LOOKOUT,z:1,yaw:Math.PI}
]};
function kuwaitBulb(x,y,z,r,room){
 const d2=x*x+y*y+z*z;
 if(d2>r*r+.5)return -1;
 const shell=d2>=(r-.8)*(r-.8);
 if(room===2&&y>=-1&&y<=2){
  if(y===-1)return shell?B.BLUE:B.MARBLE;
  if(shell)return (x===0||z===0)?B.LIMEP:((x+z+y)&3)===0?B.BLUE:B.GLASS;
  if(x===0&&z===0)return B.LIMEP;
  return B.AIR;
 }
 if(room===1&&y>=0){
  if(y===0)return shell?B.BLUE:B.MARBLE;
  if(shell&&y<=3)return x===0||z===0?B.LIMEP:y===3?B.TURQ:y===1&&((x-z)&1)?B.BLUE:B.GLASS;
  if(!shell){
   if(Math.abs(x)===2&&Math.abs(z)===2){if(y===1)return B.WOOD;if(y===2)return B.LANTERN}
   if(y===1&&Math.abs(x)===3&&Math.abs(z)===1)return B.CARPET;
   return B.AIR;
  }
 }
 if(!shell)return B.STONE;
 if(y===r||y===-r)return B.LIMEP;
 if(y===-1||y===2&&room===0)return B.TURQ;
 const tile=(Math.abs(x)+2*Math.abs(z)+3*(y+r))%9;
 return tile<4?B.BLUE:tile<7?B.TURQ:tile===7?B.GREEN:B.LIMEP;
}
function kuwaitMast(y,top){
 if(y===top)return B.LANTERN;
 if(y===top-2||y===top-3)return B.BLUE;
 return y%5===0?B.LIMEP:B.MARBLE;
}
function kuwaitTowers(l,x,y,z){
 const mainX=x-KUWAIT_MAIN.x,mainZ=z-KUWAIT_MAIN.z,waterX=x-KUWAIT_WATER.x,waterZ=z-KUWAIT_WATER.z,lightX=x-KUWAIT_LIGHT.x,lightZ=z-KUWAIT_LIGHT.z;
 const oval=x*x*196+z*z*400,plaza=oval<=78400,avenue=Math.abs(mainX)<=2&&z>=4;
 const mound=mainX*mainX+mainZ*mainZ,entrance=mainZ>=3&&Math.abs(mainX)<=2;
 if(mainX===0&&mainZ===0&&y>=1&&y<=KT_LOOKOUT+1)return B.AIR;
 if(mainX===0&&mainZ===1)for(const p of KUWAIT_LIFT.stops){
  if(y===p.y-1)return B.MARBLE;
  if(y===p.y||y===p.y+1)return B.AIR;
 }
 if(y<0)return plaza||avenue?B.ARCH:-1;
 if(y===0){
  if(avenue)return B.PATH;
  if(mound<=18)return (mainX+mainZ)%3===0?B.LIMEP:B.SANDSTONE;
  if(!plaza)return -1;
  if(oval>59000)return oval>70600?B.LIMEP:B.PATH;
  if(Math.abs(x)<=2||Math.abs(z-4)<=1||mound<=48)return B.PATH;
  return B.GRASS;
 }
 for(const [dx,dz] of [[waterX,waterZ],[lightX,lightZ]]){
  if(Math.abs(dx)>2||Math.abs(dz)>2||y>4)continue;
  if(dz===2&&Math.abs(dx)<=1&&y<=3)return B.AIR;
  if(y===4)return B.LIMEP;
  return Math.abs(dx)===2||Math.abs(dz)===2?(y===2?B.GLASS:B.MARBLE):B.AIR;
 }
 if(y<=5&&Math.abs(mainX)<=3&&Math.abs(mainZ)<=3){
  if(y<=3&&Math.abs(mainX)<=1&&mainZ===3)return B.AIR;
  if(y===5)return Math.abs(mainX)===3||Math.abs(mainZ)===3?B.BLUE:B.MARBLE;
  if(Math.abs(mainX)===3||Math.abs(mainZ)===3)return y===1||y===4||Math.abs(mainX)===3&&Math.abs(mainZ)===3?B.MARBLE:B.GLASS;
  if(Math.abs(mainX)<=1&&mainZ===-2)return y===4?B.LANTERN:B.STONE;
  if(y===4&&Math.abs(mainX)===2)return B.LANTERN;
  return B.AIR;
 }
 if(y===1&&mound<=38&&!entrance)return B.LIMEP;
 if(y===2&&mound>=29&&mound<=38&&!entrance)return B.GLASS;
 if(y===4&&entrance&&mainZ<=6)return B.MARBLE;
 if(y===1&&plaza&&oval>=59500&&oval<66000&&(x+z)%7===0)return B.LANTERN;
 if(Math.abs(mainX)<=5&&Math.abs(mainZ)<=5){
  let bulb=kuwaitBulb(mainX,y-KT_RESTAURANT,mainZ,5,1);if(bulb>=0)return bulb;
  bulb=kuwaitBulb(mainX,y-KT_LOOKOUT,mainZ,3,2);if(bulb>=0)return bulb;
  const r=y<=8?2.3:y<=15?1.6:y<=25?1:0;
  if(y>=5&&y<=KUWAIT_MAIN.h&&mound<=r*r)return kuwaitMast(y,KUWAIT_MAIN.h);
 }
 if(Math.abs(waterX)<=4&&Math.abs(waterZ)<=4){
  const bulb=kuwaitBulb(waterX,y-KT_RESERVOIR,waterZ,4,0);if(bulb>=0)return bulb;
  const r=y<=8?2:y<=15?1.5:y<=21?1:0;
  if(y<=KUWAIT_WATER.h&&waterX*waterX+waterZ*waterZ<=r*r)return kuwaitMast(y,KUWAIT_WATER.h);
 }
 const lamp=Math.abs(lightX)+Math.abs(lightZ);
 if(y===8&&lamp===1)return B.LANTERN;
 if(y===13&&lamp<=1)return lamp?B.LANTERN:B.LIMEP;
 if(y<=KUWAIT_LIGHT.h&&lamp<=(y<=8?1:0))return kuwaitMast(y,KUWAIT_LIGHT.h);
 return -1;
}
function silKuwaitTowers(l,add,pk,lod){
 add(-16,0,-8,16,0,8,8);add(-10,0,-13,10,0,13,8);add(-9,0,7,-5,0,15,1);
 const shaft=(p,y0,y1,r)=>add(p.x-r,y0,p.z-r,p.x+r,y1,p.z+r,2);
 const sphere=(p,y,r,glass)=>{
  if(lod){add(p.x-r,y-2,p.z-r,p.x+r,y+2,p.z+r,glass?4:5);return;}
  const shoulder=r-1,crown=r-2;
  add(p.x-crown,y-r,p.z-crown,p.x+crown,y-r+1,p.z+crown,4);
  if(r>=4)add(p.x-shoulder,y-r+2,p.z-shoulder,p.x+shoulder,y-2,p.z+shoulder,5);
  add(p.x-r,y,p.z-r,p.x+r,y+1,p.z+r,glass?4:5);
  add(p.x-r,y-1,p.z-r,p.x+r,y-1,p.z+r,4);
  if(r>=4)add(p.x-shoulder,y+2,p.z-shoulder,p.x+shoulder,y+r-2,p.z+shoulder,5);
  add(p.x-crown,y+r-1,p.z-crown,p.x+crown,y+r,p.z+crown,4);
 };
 add(-10,1,-3,-4,5,3,2);
 shaft(KUWAIT_MAIN,6,8,2);shaft(KUWAIT_MAIN,9,25,1);shaft(KUWAIT_MAIN,26,31,0);
 shaft(KUWAIT_WATER,1,8,2);shaft(KUWAIT_WATER,9,21,1);shaft(KUWAIT_WATER,22,25,0);
 shaft(KUWAIT_LIGHT,1,8,1);shaft(KUWAIT_LIGHT,9,17,0);
 sphere(KUWAIT_MAIN,KT_RESTAURANT,5,false);sphere(KUWAIT_MAIN,KT_LOOKOUT,3,true);sphere(KUWAIT_WATER,KT_RESERVOIR,4,false);
 for(const p of [KUWAIT_MAIN,KUWAIT_WATER,KUWAIT_LIGHT])pk.push([p.x,p.z,p.h]);
}

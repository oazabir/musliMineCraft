/* Al Khazneh, carved into a cliff at the end of the sandstone Siq. */
const PETRA_X=19,PETRA_Z=20,PETRA_W=PETRA_X*2+1;
const petraCliff=new Uint8Array(PETRA_W*(PETRA_Z*2+1));
for(let z=-PETRA_Z;z<=PETRA_Z;z++)for(let x=-PETRA_X;x<=PETRA_X;x++){
 const ax=Math.abs(x),bend=Math.round(Math.sin(z*.36)*1.5);
 const gap=z<7?12:z<14?12-(z-7):5;
 if(z<=-6||(z>=-7&&Math.abs(x-bend)>=gap)){
  const i=(z+PETRA_Z)*PETRA_W+x+PETRA_X,wall=z<=-6?24:19;
  const rim=Math.max(ax-17,Math.abs(z)-18,0);
  petraCliff[i]=clamp(wall+Math.round(vnoise(x/5,z/5,111)*8)-rim*3,10,27);
 }
}
function petraTreasury(l,lx,y,lz){
 const ax=Math.abs(lx),az=Math.abs(lz);
 if(ax>PETRA_X||az>PETRA_Z||y<0||y>27)return -1;
 const rock=petraCliff[(lz+PETRA_Z)*PETRA_W+lx+PETRA_X];
 if(y===0)return ax<=3&&lz>=-5?B.PATH:rock?B.RROCK:B.SANDSTONE;
 if(y<=2&&ax<=12&&lz>=-5&&lz<=2-y)return B.ARCH;
 if(ax<=3&&lz>=-12&&lz<=-3&&y>=3&&y<=7&&(ax<=1||lz<=-7))return 0;
 if(ax<=11&&lz>=-5&&lz<=-1){
  if(y>=3&&y<=9){
   const col=Math.min(Math.abs(ax-2),Math.abs(ax-6),Math.abs(ax-10));
   if(lz===-5)return (ax===4||ax===8)&&y>=5&&y<=7?B.RROCK:B.SANDSTONE;
   if(y===3||y>=8){
    if(col<=1&&lz>=-3)return y===8?B.LIMEP:B.ARCH;
   }else if(col===0&&(lz===-2||lz===-3))return lz===-2?B.ARCH:B.SANDSTONE;
   if(lz===-4&&((ax===2&&y<=8)||(ax<=3&&y===8)))return B.ARCH;
  }
  if(y===10||y===11)return y===10&&(lx%3===0)?B.LIMEP:B.ARCH;
  if(y>=12&&y<=16&&ax<=11-(y-12)*2){
   if(lz<=-3)return ax>=10-(y-12)*2?B.ARCH:B.SANDSTONE;
   if(y===12)return B.ARCH;
  }
  if(y>=14&&y<=18&&ax>=4&&ax<=10&&lz<=-3){
   if(ax===4||ax===10||y===18)return B.ARCH;
   if(lz===-5)return y===16&&ax===7?B.LIMEP:B.RROCK;
  }
  if(y>=19&&y<=22&&ax>=4+(y-19)*2&&ax<=11&&lz<=-3)return B.ARCH;
 }
 if(ax<=3&&lz>=-5&&lz<=0){
  const circle=lx*lx+(lz+3)*(lz+3);
  if(y>=16&&y<=20&&circle<=(y===16||y===20?10:7))return circle>=5?B.ARCH:B.SANDSTONE;
  if(y>=21&&y<=23&&circle<=(24-y)*(24-y))return B.ARCH;
  if(lz===-3&&y>=24&&y<=25&&ax<=(y===24?1:0))return B.LIMEP;
 }
 if(y<=rock)return (y+(lx>>2)-(lz>>2))%7===0?B.SANDSTONE:B.RROCK;
 return -1;
}
function silPetraTreasury(l,add,pk,lod){
 add(-19,0,-20,19,23,-6,0);
 add(-19,0,-14,-13,21,12,0);add(13,0,-14,19,22,12,0);
 add(-17,0,13,-5,17,20,0);add(5,0,13,17,18,20,0);
 add(-12,0,-5,12,2,0,7);
 add(-11,3,-5,11,11,-5,7);add(-11,10,-4,11,11,-1,1);
 add(-10,12,-5,10,12,-2,1);add(-7,13,-5,7,14,-3,7);add(-3,15,-5,3,16,-3,7);
 add(-10,14,-5,-4,20,-3,7);add(4,14,-5,10,20,-3,7);
 add(-2,16,-5,2,21,-1,1);add(-1,22,-4,1,23,-2,1);add(0,24,-3,0,25,-3,7);
 if(!lod)for(const x of[-10,-6,-2,2,6,10])add(x,3,-3,x,9,-2,1);
 pk.push([0,-3,25]);
}

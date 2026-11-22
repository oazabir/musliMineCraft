/* Al Khazneh, carved into a cliff at the end of the sandstone Siq. */
const PETRA_X=19,PETRA_Z=20,PETRA_W=PETRA_X*2+1;
const petraCliff=new Uint8Array(PETRA_W*(PETRA_Z*2+1));
const PETRA_COLUMNS=[-8,-5,-2,2,5,8];
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
 if(ax<=1&&lz>=-11&&lz<=7){
  const step=lz<=0?2:lz===1?1:0;
  if(y<=step)return B.PATH;
  if(y<=step+3)return B.AIR;
 }
 if(y<=2&&ax<=9&&lz>=-7&&lz<=2-y)return B.ARCH;
 if(ax<=3&&lz>=-12&&lz<=-3&&y>=3&&y<=8&&(ax<=1||lz<=-7))return 0;
 if(ax<=9&&lz>=-5&&lz<=-1){
  const col=Math.min(Math.abs(ax-2),Math.abs(ax-5),Math.abs(ax-8));
  if(y>=3&&y<=12){
   if(y===3||y===11||y===12){
    if(col<=1&&(lz===-3||col===0&&lz===-2))return y===11&&col!==0?B.LIMEP:B.ARCH;
   }else if(col===0&&(lz===-3||lz===-2))return lz===-2||y===6?B.ARCH:B.SANDSTONE;
   if(lz===-4){
    if(ax===2&&y<=9||ax<=2&&(y===9||y===10))return B.ARCH;
    if((ax===4||ax===7)&&y>=6&&y<=8)return B.SANDSTONE;
   }
   if(lz===-5)return (ax>=3&&ax<=4||ax>=6&&ax<=7)&&y>=5&&y<=9?B.RROCK:B.SANDSTONE;
  }
  if(y===13)return lz<=-2?(lz===-2&&ax%3===1?B.LIMEP:B.ARCH):-1;
  if(y===14)return B.ARCH;
  /* The lower gable is whole. The upper gable separates around the round tholos. */
  if(y>=15&&y<=18&&ax<=9-(y-15)*2){
   const edge=ax>=8-(y-15)*2;
   if(lz<=-3||edge&&lz===-2)return edge||ax<=1&&y===16?B.ARCH:B.SANDSTONE;
  }
  if(y>=17&&y<=22&&ax>=4&&lz<=-3){
   if(y<=20&&(ax===4||ax===8))return y===20?B.LIMEP:B.ARCH;
   if(y===21||y===22&&ax>=6)return B.ARCH;
   if(lz===-5&&y<=20)return ax===6&&y>=18?B.ARCH:B.RROCK;
  }
 }
 if(ax<=3&&lz>=-5&&lz<=0){
  const ring=lx*lx+(lz+3)*(lz+3);
  if(y===16&&ring<=10||y===21&&ring<=9)return B.ARCH;
  if(y>=17&&y<=20&&ring<=7){
   if(ring>=4)return y===20?B.LIMEP:B.ARCH;
   if(lz<=-3||lx===0&&y<=19)return B.SANDSTONE;
  }
  if(y>=22&&y<=24&&ring<=(25-y)*(25-y))return B.ARCH;
  if(lz===-3&&y>=25&&y<=26&&ax<=(y===25?1:0))return B.LIMEP;
 }
 if(y<=rock)return (y+(lx>>2)-(lz>>2))%7===0?B.SANDSTONE:B.RROCK;
 return -1;
}
function silPetraTreasury(l,add,pk,lod){
 add(-19,0,-20,19,23,-6,0);
 add(-19,0,-14,-13,21,12,0);add(13,0,-14,19,22,12,0);
 add(-17,0,13,-5,17,20,0);add(5,0,13,17,18,20,0);
 add(-9,0,-5,9,2,0,7);
 add(-9,3,-5,-2,12,-5,7);add(2,3,-5,9,12,-5,7);add(-9,13,-5,9,14,-1,1);
 add(-9,15,-5,9,15,-2,1);add(-7,16,-5,7,17,-3,7);add(-3,18,-5,3,18,-3,1);
 add(-9,17,-5,-4,21,-3,7);add(4,17,-5,9,21,-3,7);
 add(-9,22,-5,-6,22,-3,1);add(6,22,-5,9,22,-3,1);
 add(-2,16,-5,2,21,-1,1);add(-2,22,-5,2,23,-1,1);add(-1,24,-4,1,25,-2,1);add(0,26,-3,0,26,-3,7);
 if(!lod)for(const x of PETRA_COLUMNS)add(x,3,-3,x,12,-2,1);
 pk.push([0,-3,26]);
}

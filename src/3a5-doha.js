/* Limestone tiers: half width, back, front, top, diagonal corner limit. */
const DOHA_MIA_TIERS=[
 [11,-13,10,5,23], [10,-13,9,10,21], [8,-13,6,15,17],
 [7,-11,3,20,11], [5,-9,1,23,8], [3,-7,-1,26,5]
];
function dohaMiaTier(t,x,z){
 return x<=t[0]&&z>=t[1]&&z<=t[2]&&x+Math.abs(z-((t[1]+t[2])>>1))<=t[4];
}
function dohaMia(l,lx,y,z){
 const x=Math.abs(lx+3);
 if(lx>=12&&lx<=18&&z>=-8&&z<=7){
  if(y===0)return B.LIMEP;
  if(y===5)return B.LIME;
  if(y>5)return -1;
  if(lx===12&&(z===-1||z===0)&&y<=3)return B.AIR;
  if(lx===12||lx===18||z===-8||z===7)return y>=2&&y<=3&&z%3!==0?B.LATTICE:B.LIME;
  return B.AIR;
 }
 if(lx>=9&&lx<=11&&z>=-9&&z<=8)return y===0?B.ARCH:-1;
 if(z>=11&&x<=7){
  if(y!==0)return y===1&&x===7&&z%4===0?B.LANTERN:-1;
  if(x>=4&&x<=6&&z>=13&&z<=19)return x===5&&z>=14&&z<=18?B.WATER:B.LIMEP;
  return x===0&&z%3===0?B.STAR:B.PATH;
 }

 const n=y<=5?0:y<=10?1:y<=15?2:y<=20?3:y<=23?4:5,t=DOHA_MIA_TIERS[n];
 if(y>t[3]||!dohaMiaTier(t,x,z))return -1;
 if(y===0){
  if(x+Math.abs(z+3)<=4)return (x+z)%2===0?B.STAR:B.ARCH;
  return (lx+z)&1?B.MARBLE:B.LIME;
 }
 if(z===10&&x<=3&&y<=4)return B.AIR;
 if(z===-13&&x<=4&&y>=2&&y<=14)return x===0||y%4===0?B.LIMEP:B.GLASS;
 if(n===5&&y===26)return x+Math.abs(z+4)<=1?B.GLASS:B.LIMEP;
 const edge=!dohaMiaTier(t,x+1,z)||!dohaMiaTier(t,x,z-1)||!dohaMiaTier(t,x,z+1);
 if(edge){
  if(y===t[3])return B.LIMEP;
  if(n===4&&z===1&&x===2&&y===22)return B.GLASS;
  if(n<=1&&x===t[0]&&z%4===0&&y%5>=2&&y%5<=3)return B.LATTICE;
  return B.LIME;
 }
 if(n===0&&x>=6&&x<=7&&z>=5&&z<=9&&y<=10-z)return B.LIMEP;
 if(y===5&&z===5&&x>=5)return B.MARBLE;
 if(y===6&&x===5&&z===5)return B.LATTICE;
 if(y===t[3]&&n<5){
  if(!dohaMiaTier(DOHA_MIA_TIERS[n+1],x,z))return B.LIME;
  if(n<3&&(x>=8-n||z<=-10+n))return B.MARBLE;
 }
 if(y===17&&x+Math.abs(z+4)===4)return B.LANTERN;
 if(y>=18&&y<=25&&x===0&&z===-4)return B.LATTICE;
 if(y===1&&x===8&&z%4===0)return B.LIMEP;
 if(y===2&&x===8&&z%4===0)return B.TURQ;
 if(y===4&&x===9&&z%4===0)return B.LANTERN;
 return B.AIR;
}
function silDohaMia(l,add,pk,lod){
 add(-14,0,-13,8,0,10,1);
 const tiers=DOHA_MIA_TIERS;
 for(let i=0;i<tiers.length;i++){
  const [w,z0,z1,y1]=tiers[i],y0=i?tiers[i-1][3]+1:1;
  add(-3-w,y0,i<3?z0+1:z0,-3+w,y1,z1,1);
  if(i<3){
   add(-3-w,y0,z0,-8,y1,z0,1);add(2,y0,z0,-3+w,y1,z0,1);
   add(-7,y0,z0,1,y1,z0,4);
  }
 }
 if(!lod){add(12,0,-8,18,5,7,1);add(-10,0,11,4,0,20,1)}
 pk.push([-3,-4,26]);
}

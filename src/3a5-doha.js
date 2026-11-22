/* Limestone tiers: half width, back, front, top, diagonal corner limit. */
const DOHA_MIA_TIERS=[
 [11,-13,10,5,23], [10,-13,9,10,21], [8,-13,6,15,17],
 [7,-11,3,20,11], [5,-9,1,23,8], [3,-7,-1,26,5]
];
function dohaMiaTier(t,x,z){
 return x<=t[0]&&z>=t[1]&&z<=t[2]&&x+Math.abs(z-((t[1]+t[2])>>1))<=t[4];
}
function dohaMiaEdge(t,x,z){
 return !dohaMiaTier(t,x+1,z)||!dohaMiaTier(t,x,z-1)||!dohaMiaTier(t,x,z+1);
}
/* The paired atrium stairs curve out and back. The gallery flights continue up the east side. */
const DOHA_MIA_STEPS=new Int8Array(41*41);
for(const [floor,pair,steps] of [
 [0,true,[[7,4,6],[6,5,6],[5,5,6],[4,5,6],[3,4,6]]],
 [5,false,[[2,4,5],[1,4,5],[0,4,5],[-1,4,5],[-2,4,5]]],
 [10,false,[[-3,4,5],[-4,4,5],[-5,4,5],[-6,4,5],[-7,4,5]]],
 [15,false,[[-8,3,4],[-7,2,3],[-6,2,3],[-5,2,3],[-4,2,3]]],
 [20,false,[[-3,4,4],[-2,4,4],[-1,4,4]]]
])for(let i=0;i<steps.length;i++){
 const [z,left,right]=steps[i];
 for(let x=left;x<=right;x++){
  const k=(z+20)*41+20;DOHA_MIA_STEPS[k+x]=floor+i+1;
  if(pair)DOHA_MIA_STEPS[k-x]=floor+i+1;
 }
}
/* Room boxes in atrium coordinates: level, west, north, east, south, door, display. */
const DOHA_MIA_ROOMS=[
 [0,-9,-8,-5,-2,-7,'ceramic'],[0,5,-8,9,-2,7,'lantern'],
 [5,-8,-10,-4,-3,-6,'astrolabe'],[5,6,-10,9,-3,7,'folio'],
 [10,-6,-8,-3,-2,-5,'textile'],[15,-5,-7,-2,-2,-4,'ewer'],
 [20,-3,-3,-1,0,-2,'tile']
];
function dohaMiaArtifact(kind,x,y,z){
 if(kind==='textile'&&z===0&&Math.abs(x)<=1&&y>=1&&y<=3)return x===0&&y===2?B.STAR:B.CARPET;
 if(kind==='folio'&&z===0&&Math.abs(x)<=1&&y>=1&&y<=2)return y===2&&x===0?B.GOLD:B.BLUE;
 if(kind==='tile'&&z===0&&Math.abs(x)<=1&&y>=1&&y<=3)return x===0&&y===2?B.STAR:(x+y)%2===0?B.TURQ:B.BLUE;
 if(z!==1)return -1;
 if(y===1&&(x===0||kind==='ceramic'&&Math.abs(x)===1))return B.LIMEP;
 if(kind==='ceramic'&&y===2&&Math.abs(x)<=1)return x===0?B.BLUE:B.TURQ;
 if(kind==='ceramic'&&y===3&&x===0)return B.TURQ;
 if(kind==='lantern'&&y===2&&x===0)return B.LANTERN;
 if(kind==='ewer'){
  if(y===2&&(x===0||x===1))return x===0?B.GOLD:B.ARCH;
  if(y===3&&(x===0||x===-1))return B.GOLD;
 }
 if(kind==='bowl'&&Math.abs(x)<=1){
  if(y===2)return B.BLUE;
  if(y===3&&x!==0)return B.TURQ;
 }
 if(kind==='astrolabe'){
  if(y===2&&Math.abs(x)<=1)return x===0?B.LATTICE:B.GOLD;
  if(y===3&&x===0)return B.GOLD;
 }
 return -1;
}
function dohaMiaRoom(x,y,z){
 for(const [floor,west,north,east,south,door,kind] of DOHA_MIA_ROOMS){
  const dy=y-floor;
  if(dy<0||dy>3||x<west||x>east||z<north||z>south)continue;
  if(dy===0)return B.MARBLE;
  if(z===south&&x===door)return B.AIR;
  const artifact=dohaMiaArtifact(kind,x-door,dy,z-north);
  if(artifact>=0)return artifact;
  if(x===west||x===east||z===north||z===south)return dy===3&&z===south?B.LATTICE:B.LIMEP;
  return B.AIR;
 }
 return -1;
}
function dohaMia(l,lx,y,z){
 const px=lx+3,x=Math.abs(px);
 if(lx>=12&&lx<=18&&z>=-8&&z<=7){
  if(y===0)return B.LIMEP;
  if(y===5)return B.LIME;
  if(y>5)return -1;
  if(lx===12&&(z===-1||z===0)&&y<=3)return B.AIR;
  if(lx===12||lx===18||z===-8||z===7)return y>=2&&y<=3&&z%3!==0?B.LATTICE:B.LIME;
  const artifact=dohaMiaArtifact('lantern',lx-15,y,z+6);
  if(artifact>=0)return artifact;
  const bowl=dohaMiaArtifact('bowl',lx-15,y,z-3);
  if(bowl>=0)return bowl;
  return B.AIR;
 }
 if(lx>=9&&lx<=11&&z>=-9&&z<=8)return y===0?(z%4===0?B.STAR:B.ARCH):-1;
 if(z>=11&&x<=7){
  if(y!==0)return y===1&&x===7&&z%4===0?B.LANTERN:-1;
  if(x>=4&&x<=6&&z>=13&&z<=19)return x===5&&z>=14&&z<=18?B.WATER:B.LIMEP;
  return x===0&&z%3===0?B.STAR:B.PATH;
 }

 const n=y<=5?0:y<=10?1:y<=15?2:y<=20?3:y<=23?4:5,t=DOHA_MIA_TIERS[n];
 if(y>t[3])return -1;
 if(!dohaMiaTier(t,x,z)){
  const terrace=y===21?DOHA_MIA_TIERS[3]:y===24?DOHA_MIA_TIERS[4]:null;
  if(terrace&&dohaMiaTier(terrace,x,z)&&dohaMiaEdge(terrace,x,z))return B.LATTICE;
  return -1;
 }
 if(y===0){
  if(x+Math.abs(z+3)<=4)return (x+z)%2===0?B.STAR:B.ARCH;
  if(z>=7&&z<=9&&x>=4&&x<=6)return x===5?B.PATH:B.LIMEP;
  return (lx+z)&1?B.MARBLE:B.LIME;
 }
 if((z===10&&x<=3&&y<=4)||(z===1&&(x===2||px===3)&&y>=21&&y<=22))return B.AIR;
 if(z===-13&&x<=4&&y>=1&&y<=15)return x===0||y%5===0?B.LIMEP:B.GLASS;
 if(n===5&&y===26)return x+Math.abs(z+4)<=1?B.GLASS:B.LIMEP;
 const step=DOHA_MIA_STEPS[(z+20)*41+px+20];
 if(px===4&&z===-4&&y>=21&&y<=23)return B.AIR;
 /* Stepping up raises the player's body before it clears the previous tread. */
 if(step&&y>=step-1&&y<=step+3)return y<step?B.MARBLE:y===step?B.LIMEP:B.AIR;
 if(dohaMiaEdge(t,x,z)){
  if(y===t[3])return B.LIMEP;
  if(n===4&&z===1&&x===2&&y===22)return B.GLASS;
  if(n<=1&&x===t[0]&&z%4===0&&y%5>=2&&y%5<=3)return B.LATTICE;
  return B.LIME;
 }
 const room=dohaMiaRoom(px,y,z);
 if(room>=0)return room;
 const floor=y%5===0&&y<=20;
 const atrium=x<3&&z>-9&&z<2&&!(y===20&&z>=0);
 if(floor)return atrium?B.AIR:(x===3&&z>-9&&z<2?B.LIMEP:B.MARBLE);
 if(y%5===1&&y>=6&&y<=16&&x===3&&z>-9&&z<2&&!(px>0&&z<=-4&&y===16))return B.LATTICE;
 if(y===t[3]&&n<5){
  if(!dohaMiaTier(DOHA_MIA_TIERS[n+1],x,z))return B.LIME;
  return x+Math.abs(z+4)<=1?B.AIR:B.MARBLE;
 }
 if(y===17&&x+Math.abs(z+4)===2)return B.LANTERN;
 if(y>=18&&y<=25&&x===0&&z===-4)return B.LATTICE;
 if(y%5===4&&y<=19&&x>=4&&z%4===0&&z>-12)return B.LANTERN;
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

'use strict';
/* ===== 1. Constants and helpers ===== */
const GAME='musliMineCraft', SAVE_KEY='musliMineCraft_save_v1', OLD_KEY='islaminecraft_save_v1';
const WX=2048, WZ=2048, H=48, CS=16, NC=128, CV=CS*CS*H, WL=12;
const OX=971, OZ=973, SPAWN={x:1024,z:1024}, LAKE={x:1011,z:1021};
const SPAWN_YAW=1.3, SPAWN_PITCH=.1;
const START={x:1025,z:1024},PLOT_X=1042.5,PLOT_Z=1024.5;
const PLOT={x0:1026,x1:1059,z0:1014,z1:1034}, PLOT_Y=15;
const DAY_SECONDS=600, BREAK_SECONDS=1200, REACH=6, SEED=20240611;
const $=id=>document.getElementById(id);
const inb=(x,y,z)=>x>=0&&x<WX&&z>=0&&z<WZ&&y>=0&&y<H;
const gkey=(x,y,z)=>(y*WZ+z)*WX+x;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
const sstep=(a,b,x)=>smooth(clamp((x-a)/(b-a),0,1));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function hash2(x,y,s){let h=Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,1274126177)|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296}
function vnoise(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),u=smooth(x-xi),v=smooth(y-yi);
 return lerp(lerp(hash2(xi,yi,s),hash2(xi+1,yi,s),u),lerp(hash2(xi,yi+1,s),hash2(xi+1,yi+1,s),u),v)}
function mulberry(a){return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const ri=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

/* ===== 2. Blocks and texture atlas ===== */
const B={AIR:0,SAND:1,SANDSTONE:2,STONE:3,DIRT:4,GRASS:5,WOOD:6,LEAVES:7,WATER:8,MUD:9,MARBLE:10,BLUE:11,GREEN:12,STAR:13,GOLD:14,LANTERN:15,GLASS:16,CARPET:17,LATTICE:18,SHELF:19,CHEST:20,
 PATH:21,ARCH:22,TURQ:23,RROCK:24,TRELLIS:25,ORANGE:26,POM:27,OLIVE:28,GRAPE:29,VINE:30,DATES:31,AWR:32,AWB:33,AWG:34,AWY:35,FL0:36,TUFT:42,REED:43,LIME:44,LIMEP:45};
const T={SAND:0,SSIDE:1,STOP:2,STONE:3,DIRT:4,GTOP:5,GSIDE:6,WSIDE:7,WTOP:8,LEAF:9,WATER:10,MUD:11,MARBLE:12,BLUE:13,GREEN:14,STAR:15,GOLD:16,LANT:17,GLASS:18,CARPET:19,LATTICE:20,SHELF:21,PLANK:22,CHEST:23,
 PATH:24,ARCH:25,TURQ:26,RROCK:27,TRELLIS:28,ORANGE:29,POM:30,OLIVE:31,GRAPE:32,VINE:33,DATES:34,AWR:35,AWB:36,AWG:37,AWY:38,FL0:39,TUFT:45,REED:46,LIME:47,LIMEP:48};
const DEFS=[];
const OPQ=new Uint8Array(256);
DEFS[0]={name:'Air',t:[0,0,0],kind:'a',trans:false,emis:false,solid:false,h:16};
function def(id,name,top,bot,side,kind,h){DEFS[id]={name,t:[top,bot,side],kind,trans:kind==='t',emis:kind==='e',solid:id!==B.WATER&&kind!=='x',h:h||16};OPQ[id]=(kind==='o'||kind==='e')?1:0}
def(B.SAND,'Sand',T.SAND,T.SAND,T.SAND,'o');def(B.SANDSTONE,'Sandstone',T.STOP,T.STOP,T.SSIDE,'o');
def(B.STONE,'Stone',T.STONE,T.STONE,T.STONE,'o');def(B.DIRT,'Dirt',T.DIRT,T.DIRT,T.DIRT,'o');
def(B.GRASS,'Grass',T.GTOP,T.DIRT,T.GSIDE,'o');def(B.WOOD,'Palm wood',T.WTOP,T.WTOP,T.WSIDE,'o');
def(B.LEAVES,'Palm leaves',T.LEAF,T.LEAF,T.LEAF,'c');def(B.WATER,'Water',T.WATER,T.WATER,T.WATER,'t');
def(B.MUD,'Mud brick',T.MUD,T.MUD,T.MUD,'o');def(B.MARBLE,'White marble',T.MARBLE,T.MARBLE,T.MARBLE,'o');
def(B.BLUE,'Blue tile',T.BLUE,T.BLUE,T.BLUE,'o');def(B.GREEN,'Green tile',T.GREEN,T.GREEN,T.GREEN,'o');
def(B.STAR,'Star tile',T.STAR,T.STAR,T.STAR,'o');def(B.GOLD,'Gold block',T.GOLD,T.GOLD,T.GOLD,'o');
def(B.LANTERN,'Lantern',T.LANT,T.LANT,T.LANT,'e');def(B.GLASS,'Glass',T.GLASS,T.GLASS,T.GLASS,'t');
def(B.CARPET,'Red carpet',T.CARPET,T.CARPET,T.CARPET,'o');def(B.LATTICE,'Lattice',T.LATTICE,T.LATTICE,T.LATTICE,'c');
def(B.SHELF,'Bookshelf',T.PLANK,T.PLANK,T.SHELF,'o');def(B.CHEST,'Knowledge chest',T.CHEST,T.CHEST,T.CHEST,'o');
def(B.PATH,'Stone path',T.PATH,T.PATH,T.PATH,'o');def(B.ARCH,'Arch stone',T.ARCH,T.ARCH,T.ARCH,'o');
def(B.TURQ,'Turquoise tile',T.TURQ,T.TURQ,T.TURQ,'o');def(B.RROCK,'Red rock',T.RROCK,T.RROCK,T.RROCK,'o');
def(B.TRELLIS,'Trellis wood',T.TRELLIS,T.TRELLIS,T.TRELLIS,'o');
def(B.ORANGE,'Orange tree',T.ORANGE,T.ORANGE,T.ORANGE,'c');def(B.POM,'Pomegranate tree',T.POM,T.POM,T.POM,'c');
def(B.OLIVE,'Olive tree',T.OLIVE,T.OLIVE,T.OLIVE,'c');def(B.GRAPE,'Grapes',T.GRAPE,T.GRAPE,T.GRAPE,'c');
def(B.VINE,'Grapevine',T.VINE,T.VINE,T.VINE,'c');def(B.DATES,'Dates',T.DATES,T.DATES,T.DATES,'c');
['Red awning','Blue awning','Green awning','Yellow awning'].forEach((n,i)=>def(B.AWR+i,n,T.AWR+i,T.AWR+i,T.AWR+i,'o'));
['Red tulip','Yellow flower','Purple flower','White daisy','Pink rose','Blue flower'].forEach((n,i)=>def(B.FL0+i,n,T.FL0+i,T.FL0+i,T.FL0+i,'x',i%2?11:12));
def(B.LIME,'Limestone',T.LIME,T.LIME,T.LIME,'o');def(B.LIMEP,'Carved limestone',T.LIMEP,T.LIMEP,T.LIMEP,'o');
def(B.TUFT,'Grass tuft',T.TUFT,T.TUFT,T.TUFT,'x',9);def(B.REED,'Reeds',T.REED,T.REED,T.REED,'x',16);
const DECOR_IDS=[21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,8];
const HOTBAR_IDS=[1,2,3,4,5,6,7,9,10,11,12,13,14,15,16,17,18,19].concat(DECOR_IDS,[44,45]);
const STARTER=[1,2,3,4,5,6,7,9].concat(DECOR_IDS);
const GHOST_COL=[];
let atlasCanvas;

function buildAtlas(){
 const cv=document.createElement('canvas');cv.width=128;cv.height=128;
 const g=cv.getContext('2d'),img=g.createImageData(128,128),d=img.data;
 const px=(t,x,y,c)=>{const o=(((t>>3)*16+y)*128+(t&7)*16+x)*4;d[o]=c[0];d[o+1]=c[1];d[o+2]=c[2];d[o+3]=c[3]===undefined?255:c[3]};
 const paint=(t,fn)=>{for(let y=0;y<16;y++)for(let x=0;x<16;x++)px(t,x,y,fn(x,y))};
 const n=(t,x,y)=>hash2(x,y,t+7);
 const jit=(c,a,t,x,y)=>{const k=(n(t,x,y)-.5)*a;return[c[0]+k,c[1]+k,c[2]+k]};
 const shade=(c,k)=>[c[0]+k,c[1]+k,c[2]+k];
 paint(T.SAND,(x,y)=>jit([222,196,140],22,T.SAND,x,y));
 paint(T.SSIDE,(x,y)=>jit(shade([205,165,105],y%6===0?-24:0),12,T.SSIDE,x,y));
 paint(T.STOP,(x,y)=>jit([214,176,118],14,T.STOP,x,y));
 paint(T.STONE,(x,y)=>jit(shade([128,130,134],(x*7+y*3)%23===0?-34:0),26,T.STONE,x,y));
 paint(T.DIRT,(x,y)=>jit([121,85,58],22,T.DIRT,x,y));
 paint(T.GTOP,(x,y)=>jit([84,150,58],24,T.GTOP,x,y));
 paint(T.GSIDE,(x,y)=>y<3+(n(T.GSIDE,x,0)>.6?2:0)?jit([84,150,58],24,T.GSIDE,x,y):jit([121,85,58],22,T.GSIDE,x,y));
 paint(T.WSIDE,(x,y)=>jit(shade([112,78,46],x%4===0?-20:0),10,T.WSIDE,x,y));
 paint(T.WTOP,(x,y)=>{const r=Math.max(Math.abs(x-7.5),Math.abs(y-7.5));return r>6.5?jit([92,64,38],10,T.WTOP,x,y):jit(Math.floor(r)%2?[150,110,70]:[124,88,54],10,T.WTOP,x,y)});
 paint(T.LEAF,(x,y)=>{const c=jit([46,128,62],36,T.LEAF,x,y);c[3]=n(T.LEAF,x+31,y)>.78?0:255;return c});
 paint(T.WATER,(x,y)=>{const c=jit([45,125,175],10,T.WATER,x,y);if((x+y*2)%7===0)c[0]+=40,c[1]+=40,c[2]+=30;c[3]=175;return c});
 paint(T.MUD,(x,y)=>{const off=(y>>2)%2?4:0;return y%4===3||(x+off)%8===7?[196,170,130]:jit([168,116,76],16,T.MUD,x,y)});
 paint(T.MARBLE,(x,y)=>(x*2+y*5)%11===0&&n(T.MARBLE,x,y)>.3?[170,176,188]:jit([240,238,232],8,T.MARBLE,x,y));
 const tile=(t,bg,edge,mid)=>paint(t,(x,y)=>{const a=x%8,b=y%8;if(a===0||b===0||a===7||b===7)return edge;
  return Math.abs(a-3.5)+Math.abs(b-3.5)<2.6?mid:jit(bg,8,t,x,y)});
 tile(T.BLUE,[28,86,160],[96,156,214],[232,242,252]);tile(T.GREEN,[18,128,92],[96,206,156],[240,230,170]);
 const star=(x,y)=>{const dx=x-7.5,dy=y-7.5;return(Math.abs(dx)<=5&&Math.abs(dy)<=5)||(Math.abs(dx+dy)<=7&&Math.abs(dx-dy)<=7)};
 paint(T.STAR,(x,y)=>{if(x===0||y===0||x===15||y===15)return[200,160,60];
  if(Math.abs(x-7.5)<2&&Math.abs(y-7.5)<2)return[226,178,60];return star(x,y)?[20,110,120]:jit([242,232,206],8,T.STAR,x,y)});
 paint(T.GOLD,(x,y)=>{const e=x===0||y===0||x===15||y===15;return jit(e?[178,134,30]:[232,184,48],12,T.GOLD,x,y).map((v,i)=>i<3&&(x+y)%9===0&&!e?v+28:v)});
 paint(T.LANT,(x,y)=>{if(x<2||x>13||y<2||y>13||((x===7||x===8)&&y%5===0))return[86,56,24];
  const k=1-Math.hypot(x-7.5,y-7.5)/10;return[255,150+k*90,60+k*110]});
 paint(T.GLASS,(x,y)=>x===0||y===0||x===15||y===15?[205,238,248,215]:(x+y===9||x+y===11)&&x>2&&x<8?[255,255,255,150]:[190,225,240,55]);
 paint(T.CARPET,(x,y)=>{const e=Math.min(x,y,15-x,15-y);if(e<=1)return[222,172,52];if(e===2)return[100,16,28];
  return(x+y)%4===0||(x-y+16)%4===0?[196,64,64]:jit([150,28,40],10,T.CARPET,x,y)});
 paint(T.LATTICE,(x,y)=>x%4===0||y%4===0?jit([152,102,58],14,T.LATTICE,x,y):[0,0,0,0]);
 const books=[[170,50,50],[40,110,150],[222,182,60],[60,140,90],[120,70,140]];
 paint(T.SHELF,(x,y)=>{const row=y<8?0:1;const yy=y-row*8;if(yy<1||yy>6||x<1||x>14)return jit([110,76,44],12,T.SHELF,x,y);
  const bk=Math.floor(n(T.SHELF,x>>1,row)*5);return(x&1)?shade(books[bk],-26):books[bk]});
 paint(T.PLANK,(x,y)=>jit(shade([178,134,84],y%4===0?-26:0),12,T.PLANK,x,y));
 paint(T.CHEST,(x,y)=>{if(Math.min(x,y,15-x,15-y)<2)return[226,178,60];
  const dx=x-7.5,dy=y-7.5;return Math.abs(dx)+Math.abs(dy)<4?[250,220,110]:star(x,y)&&Math.abs(dx)+Math.abs(dy)<8?[30,130,140]:[18,92,102]});
 /* landscape tiles */
 paint(T.PATH,(x,y)=>{const o=((y>>2)&1)*2;return(x+o)%4===3||y%4===3?[150,138,118]:jit([204,192,166],16,T.PATH,x,y)});
 paint(T.ARCH,(x,y)=>{const o=((y>>3)&1)*8;return y%8===7||(x+o)%16===15?[196,184,154]:jit([238,228,204],8,T.ARCH,x,y)});
 tile(T.TURQ,[24,150,160],[120,222,220],[246,250,240]);
 paint(T.RROCK,(x,y)=>jit(y%8<3?[160,84,56]:y%8<6?[190,112,70]:[176,98,62],16,T.RROCK,x,y));
 paint(T.TRELLIS,(x,y)=>jit(shade([104,70,42],x%5===0?-18:0),10,T.TRELLIS,x,y));
 const fruit=(t,leaf,col,dens,big)=>paint(t,(x,y)=>{const c=jit(leaf,30,t,x,y);const k=big?(x>>1)*7+(y>>1):x*5+y*3;
  const f=hash2(x>>(big?1:0),y>>(big?1:0),t*3)>dens;
  c[3]=n(t,x+31,y)>.86?0:255;return f?[col[0]+(n(t,x,y)-.5)*20,col[1]+(n(t,x,y)-.5)*16,col[2],255]:c});
 fruit(T.ORANGE,[40,120,58],[246,140,28],.74,1);fruit(T.POM,[52,128,60],[200,30,44],.78,1);
 fruit(T.OLIVE,[104,132,84],[58,48,72],.84,0);fruit(T.GRAPE,[58,128,52],[104,44,138],.68,1);
 paint(T.VINE,(x,y)=>{const c=jit([72,142,56],34,T.VINE,x,y);c[3]=n(T.VINE,x+31,y)>.8?0:255;return(x+y)%7===0?[44,100,40]:c});
 paint(T.DATES,(x,y)=>{const dx=x-7.5,dy=y-7;if(Math.abs(dx)<4+(y>8?0:0)&&y>3&&y<14&&Math.hypot(dx*1.2,y-9)<5.2)return jit(y%3?[168,84,24]:[132,60,20],18,T.DATES,x,y);
  if(x===7||x===8)return y<4?[90,60,30]:[0,0,0,0];const c=jit([46,128,62],30,T.DATES,x,y);c[3]=y<4&&n(T.DATES,x,y)>.3?255:0;return c});
 const awn=(t,c)=>paint(t,(x,y)=>(x>>2)%2?jit([238,230,208],10,t,x,y):jit(c,12,t,x,y));
 awn(T.AWR,[196,52,48]);awn(T.AWB,[40,92,170]);awn(T.AWG,[34,134,84]);awn(T.AWY,[232,180,40]);
 const fcol=[[214,46,52],[244,204,40],[146,74,178],[246,246,240],[240,122,166],[70,112,206]];
 for(let i=0;i<6;i++)paint(T.FL0+i,(x,y)=>{const c=fcol[i],dx=x-7.5;
  if(i%2===0?(y>=2&&y<=6&&Math.abs(dx)<=2.3-(y===2?1:0)):Math.hypot(dx,y-4.5)<3.2){return i===3&&Math.hypot(dx,y-4.5)<1.2?[240,200,40]:c}
  if(y>6&&(x===7||x===8))return[52,120,48];if(y>9&&Math.abs(dx+(y>11?2:-2))<1.2&&y<13)return[60,140,56];return[0,0,0,0]});
 paint(T.TUFT,(x,y)=>{const hh=4+Math.floor(n(T.TUFT,x,3)*10);return y>=16-hh&&n(T.TUFT,x,9)>.25?jit([84,152,60],34,T.TUFT,x,y):[0,0,0,0]});
 paint(T.REED,(x,y)=>{const s=x===3||x===7||x===11||x===13;if(!s)return[0,0,0,0];const top=x===7?0:x===3?3:x===11?5:7;
  if(y<top)return[0,0,0,0];return y<top+4&&x!==13?[112,70,40]:jit([126,160,76],18,T.REED,x,y)});
 paint(T.LIME,(x,y)=>{const o=((y>>2)&1)*4;return y%4===3||(x+o)%8===7?[208,194,160]:jit([236,224,196],10,T.LIME,x,y)});
 paint(T.LIMEP,(x,y)=>{if(x===0||y===0||x===15||y===15)return[206,192,158];const dx=x-7.5,dy=y-7.5;const k=Math.abs(Math.abs(dx)-Math.abs(dy))<1||Math.abs(dx)<.8||Math.abs(dy)<.8;return k&&Math.abs(dx)+Math.abs(dy)<9?[198,180,140]:jit([238,227,200],8,T.LIMEP,x,y)});
 g.putImageData(img,0,0);
 for(let b=1;b<DEFS.length;b++){if(!DEFS[b])continue;const t=DEFS[b].t[2];let r=0,gg=0,bb=0,c=0;
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){const o=(((t>>3)*16+y)*128+(t&7)*16+x)*4;if(d[o+3]>100){r+=d[o];gg+=d[o+1];bb+=d[o+2];c++}}
  GHOST_COL[b]=c?[r/c/255,gg/c/255,bb/c/255]:[1,1,1]}
 atlasCanvas=cv;
}

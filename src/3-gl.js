/* ===== 5. WebGL renderer, sky and day cycle ===== */
const canvas=$('gl');
let gl=null;
try{gl=canvas.getContext('webgl',{antialias:false,alpha:false,powerPreference:'high-performance'})||canvas.getContext('experimental-webgl')}catch(e){gl=null}
let progT,progS,progC,progH,atlasTex,quadBuf,hitBuf,idxBuf,botBuf,silBuf,vw=1,vh=1,aspect=1,fovY=1.1,dprCur=1.25,farFog=60,fovBase=1.1,fovKick=0;
const cam={e:[0,0,0],fw:[0,0,-1],rt:[1,0,0],up:[0,1,0],tx:1,ty:1};
const PROJ=new Float32Array(16),VIEW=new Float32Array(16),VP=new Float32Array(16),PROJS=new Float32Array(16),VPS=new Float32Array(16),ambU=new Float32Array(3);
function program(vs,fs,attrs){
 const mk=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o};
 const p=gl.createProgram();gl.attachShader(p,mk(gl.VERTEX_SHADER,vs));gl.attachShader(p,mk(gl.FRAGMENT_SHADER,fs));
 attrs.forEach((a,i)=>gl.bindAttribLocation(p,i,a));
 gl.linkProgram(p);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
 const u={};for(const n of ['u_vp','u_cam','u_tex','u_fog','u_amb','u_near','u_far','u_pass','u_a','u_fa','u_off','u_f','u_r','u_u','u_t','u_hz','u_zen','u_sun','u_ck'])u[n]=gl.getUniformLocation(p,n);
 return{p,u};
}
function initGL(){
 progT=program(`attribute vec4 a_p;attribute vec4 a_s;uniform mat4 u_vp;uniform vec3 u_cam;uniform vec2 u_off;varying vec2 v_uv;varying vec2 v_sh;varying float v_d;
void main(){vec3 p=a_p.xyz*.0625+vec3(u_off.x,0.,u_off.y);float c=floor(a_p.w/64.);float t=a_p.w-c*64.;float cv=floor(c/2.);float cu=c-cv*2.;float tv=floor(t/8.);float tu=t-tv*8.;
v_uv=vec2(tu+.02+.96*cu,tv+.02+.96*cv)*.125;v_sh=a_s.xy;v_d=distance(p,u_cam);gl_Position=u_vp*vec4(p,1.);}`,
`precision mediump float;uniform sampler2D u_tex;uniform vec3 u_fog;uniform vec3 u_amb;uniform float u_near,u_far,u_pass;uniform vec2 u_ck;varying vec2 v_uv;varying vec2 v_sh;varying float v_d;
void main(){vec4 t=texture2D(u_tex,v_uv);if(u_pass<.5&&t.a<.5)discard;if(u_pass>.5&&u_ck.y>0.){vec2 q=floor(v_uv*128.);t.rgb+=step(.94,fract(sin(dot(q,vec2(12.9898,78.233))+u_ck.x*1.7)*43758.5))*u_ck.y*.4;}
vec3 l=mix(v_sh.x*u_amb,vec3(1.15),v_sh.y);vec3 c=mix(t.rgb*l,u_fog,clamp((v_d-u_near)/(u_far-u_near),0.,1.));
gl_FragColor=vec4(c,u_pass<.5?1.:t.a);}`,['a_p','a_s']);
 progC=program(`attribute vec3 a_pos;attribute vec4 a_col;uniform mat4 u_vp;uniform vec3 u_cam;varying vec4 v_c;varying float v_d;void main(){v_c=a_col;v_d=distance(a_pos,u_cam);gl_Position=u_vp*vec4(a_pos,1.);}`,
`precision mediump float;uniform float u_a,u_fa,u_near,u_far;uniform vec3 u_fog;varying vec4 v_c;varying float v_d;void main(){
gl_FragColor=vec4(mix(v_c.rgb,u_fog,clamp((v_d-u_near)/(u_far-u_near),0.,1.)*u_fa),v_c.a*u_a);}`,['a_pos','a_col']);
 progH=program(`attribute vec3 a_pos;attribute vec4 a_col;uniform mat4 u_vp;uniform vec3 u_cam;varying vec4 v_c;varying float v_d;void main(){v_c=a_col;v_d=distance(a_pos,u_cam);gl_Position=u_vp*vec4(a_pos,1.);}`,
`precision mediump float;uniform vec3 u_amb,u_hz;uniform vec2 u_ck;varying vec4 v_c;varying float v_d;void main(){float h=clamp(.5+.42*smoothstep(70.,360.,v_d),0.,.95)*(1.-.55*u_ck.y);gl_FragColor=vec4(mix(v_c.rgb*u_amb,u_hz,h),v_c.a);}`,['a_pos','a_col']);
 progS=program(`attribute vec2 a_p;varying vec2 v_p;void main(){v_p=a_p;gl_Position=vec4(a_p,.9999,1.);}`,
`precision mediump float;uniform vec3 u_f,u_r,u_u,u_hz,u_zen,u_sun;uniform vec2 u_t,u_ck;varying vec2 v_p;
void main(){vec3 ray=normalize(u_f+u_r*v_p.x*u_t.x+u_u*v_p.y*u_t.y);
vec3 c=ray.y<0.?u_hz:mix(u_hz,u_zen,sqrt(clamp(ray.y*1.8,0.,1.)));
float s=dot(ray,u_sun),m=dot(ray,-u_sun);
c+=vec3(.35,.2,.05)*pow(max(s,0.),30.)*clamp(u_sun.y+.4,0.,1.);
c=mix(c,vec3(1.,.96,.8),smoothstep(.9985,.9992,s)*step(-.05,u_sun.y));
c=mix(c,vec3(.92,.94,1.),smoothstep(.9988,.9993,m)*step(-.05,-u_sun.y));
if(u_ck.y>0.){c+=vec3(.5,.34,.12)*pow(max(s,0.),6.)*u_ck.y*.6;if(ray.y>.03){vec2 q=ray.xz/(ray.y+.3)*2.1+vec2(u_ck.x*.015,0.);float n=sin(q.x*1.7)*cos(q.y*2.3)+.5*sin(q.x*3.9+q.y*1.3)+.25*sin(q.y*6.1-q.x*2.7);c=mix(c,vec3(1.,.97,.9),smoothstep(.45,1.,n)*smoothstep(.03,.3,ray.y)*u_ck.y*.85);}}
gl_FragColor=vec4(c,1.);}`,['a_p']);
 atlasTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,atlasTex);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlasCanvas);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 quadBuf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quadBuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
 hitBuf=gl.createBuffer();silBuf=gl.createBuffer();SIL.dirty=true;SIL.upd=true;
 botBuf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,botBuf);gl.bufferData(gl.ARRAY_BUFFER,botGeo.byteLength,gl.DYNAMIC_DRAW);
 const ix=new Uint16Array(16000*6);for(let q=0;q<16000;q++){const b=q*4,o=q*6;ix[o]=b;ix[o+1]=b+1;ix[o+2]=b+2;ix[o+3]=b;ix[o+4]=b+2;ix[o+5]=b+3}
 idxBuf=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,idxBuf);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,ix,gl.STATIC_DRAW);
 gl.enable(gl.DEPTH_TEST);
}
function restoreGL(){
 initGL();
 for(const c of loaded){c.buf=[null,null];c.cnt=[0,0];c.bytes=0;c.st=1}
 dyn.ghostT=dyn.ghostL=dyn.beams=dyn.jT=dyn.jL=null;
 rebuildGhost();beamsDirty=true;
}
function resize(){
 const dpr=Math.min(window.devicePixelRatio||1,dprCur);
 vw=Math.max(1,window.innerWidth);vh=Math.max(1,window.innerHeight);
 canvas.width=Math.round(vw*dpr);canvas.height=Math.round(vh*dpr);aspect=vw/vh;fovBase=fovY=aspect<1?1.3:1.1;
 if(gl)gl.viewport(0,0,canvas.width,canvas.height);
 setProj();
}
function setProj(){
 const t=1/Math.tan(fovY/2),n=.1,f=950;
 PROJ.fill(0);PROJ[0]=t/aspect;PROJ[5]=t;PROJ[10]=(f+n)/(n-f);PROJ[11]=-1;PROJ[14]=2*f*n/(n-f);
 {const n2=2,f2=900;PROJS.fill(0);PROJS[0]=t/aspect;PROJS[5]=t;PROJS[10]=(f2+n2)/(n2-f2);PROJS[11]=-1;PROJS[14]=2*f2*n2/(n2-f2)}
}
function mul(o,a,b){for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+j]*b[i*4+k];o[i*4+j]=s}}
function updateCamera(){
 const sy=Math.sin(player.yaw),cy=Math.cos(player.yaw),sp=Math.sin(player.pitch),cp=Math.cos(player.pitch);
 const e=cam.e,w=cam.fw,r=cam.rt,u=cam.up;
 e[0]=player.x;e[1]=player.y+1.62-player.stepOff;e[2]=player.z;
 w[0]=-sy*cp;w[1]=sp;w[2]=-cy*cp;r[0]=cy;r[1]=0;r[2]=-sy;u[0]=sy*sp;u[1]=cp;u[2]=cy*sp;
 cam.ty=Math.tan(fovY/2);cam.tx=cam.ty*aspect;
 VIEW[0]=r[0];VIEW[1]=u[0];VIEW[2]=-w[0];VIEW[3]=0;VIEW[4]=r[1];VIEW[5]=u[1];VIEW[6]=-w[1];VIEW[7]=0;
 VIEW[8]=r[2];VIEW[9]=u[2];VIEW[10]=-w[2];VIEW[11]=0;VIEW[12]=-dot(r,e);VIEW[13]=-dot(u,e);VIEW[14]=dot(w,e);VIEW[15]=1;
 mul(VP,PROJ,VIEW);mul(VPS,PROJS,VIEW);
}
function screenRay(px,py){
 const nx=px/vw*2-1,ny=1-py/vh*2,d=[0,0,0];
 for(let i=0;i<3;i++)d[i]=cam.fw[i]+cam.rt[i]*nx*cam.tx+cam.up[i]*ny*cam.ty;
 const l=Math.hypot(d[0],d[1],d[2]);return[d[0]/l,d[1]/l,d[2]/l];
}
const prj=[0,0,0];
function project(x,y,z){
 const w=VP[3]*x+VP[7]*y+VP[11]*z+VP[15];if(w<=.1)return null;
 prj[0]=(VP[0]*x+VP[4]*y+VP[8]*z+VP[12])/w;prj[1]=(VP[1]*x+VP[5]*y+VP[9]*z+VP[13])/w;prj[2]=w;
 return prj;
}
const KEYS=[
 {p:0,hz:[240,170,140],zen:[70,80,140],amb:[.66,.6,.8]},{p:.12,hz:[250,215,160],zen:[110,170,225],amb:[.95,.9,.85]},
 {p:.35,hz:[190,225,245],zen:[60,140,215],amb:[1,1,1]},{p:.62,hz:[235,225,190],zen:[80,150,215],amb:[1,.96,.88]},
 {p:.78,hz:[250,140,80],zen:[90,70,130],amb:[.85,.62,.62]},{p:.88,hz:[48,58,105],zen:[14,22,56],amb:[.42,.46,.7]},
 {p:.96,hz:[38,48,92],zen:[10,16,46],amb:[.38,.42,.66]},{p:1,hz:[240,170,140],zen:[70,80,140],amb:[.66,.6,.8]}];
/* sun rises at .08, peaks at .44 and sets at .8 */
const SUN_RISE=.08,SUN_SET=.8,LABELS=[[SUN_RISE,'Fajr'],[.44,'Morning'],[.62,'Dhuhr'],[SUN_SET,'Asr'],[.88,'Maghrib'],[1.01,'Isha']];
let dayT=.2;
const sky={hz:[0,0,0],zen:[0,0,0],amb:[1,1,1],sun:[0,1,0]},WARM=[1,.8,.6];let menuK=0,ckT=0;const MENU={hz:[200,218,228],zen:[34,104,208],amb:[1,.97,.88],sun:[.34,.24,-.91]};
function updateSky(){
 let i=0;while(KEYS[i+1].p<dayT)i++;
 const a=KEYS[i],b=KEYS[i+1],t=(dayT-a.p)/(b.p-a.p);
 for(let c=0;c<3;c++){sky.hz[c]=lerp(a.hz[c],b.hz[c],t);sky.zen[c]=lerp(a.zen[c],b.zen[c],t);sky.amb[c]=lerp(a.amb[c],b.amb[c],t)}
 const ang=Math.PI*(dayT-SUN_RISE)/(SUN_SET-SUN_RISE),l=Math.hypot(Math.cos(ang),Math.sin(ang),.3);
 sky.sun[0]=Math.cos(ang)/l;sky.sun[1]=Math.sin(ang)/l;sky.sun[2]=.3/l;
 const warm=clamp(1-Math.abs(sky.sun[1])/.45,0,1)*(sky.sun[1]>-.3?1:0)*.4;
 for(let c=0;c<3;c++){sky.amb[c]=lerp(sky.amb[c],WARM[c]*sky.amb[c],warm);sky.hz[c]=lerp(sky.hz[c],sky.hz[c]*.5+[255,170,110][c]*.5,warm*.35)}
 if(menuK>0){const pu=.5+.5*Math.sin(ckT*.6),m=menuK;for(let c=0;c<3;c++){sky.hz[c]=lerp(sky.hz[c],MENU.hz[c]+(c===0?12*pu:0),m);sky.zen[c]=lerp(sky.zen[c],MENU.zen[c],m);sky.amb[c]=lerp(sky.amb[c],MENU.amb[c]*(.94+.06*pu),m);sky.sun[c]=lerp(sky.sun[c],MENU.sun[c],m)}}
 for(let k=0;k<LABELS.length;k++)if(dayT<LABELS[k][0])return LABELS[k][1];
 return'Isha';
}
const LINE_IDX=[0,1,2,3,4,5,6,7,0,2,1,3,4,6,5,7,0,4,1,5,2,6,3,7];
function lineBox(a,x,y,z,e,c){
 const x0=x-e,y0=y-e,z0=z-e,x1=x+1+e,y1=y+1+e,z1=z+1+e;
 for(let k=0;k<24;k++){const i=LINE_IDX[k];a.push(i&1?x1:x0,i&2?y1:y0,i&4?z1:z0,c[0],c[1],c[2],c[3])}
}
function quadTris(a,p0,p1,p2,p3,c){for(const p of[p0,p1,p2,p0,p2,p3])a.push(p[0],p[1],p[2],c[0],c[1],c[2],c[3])}
function cubeTris(a,x,y,z,e,c){
 const lo=[x+e,y+e,z+e],hi=[x+1-e,y+1-e,z+1-e],V=i=>[i&1?hi[0]:lo[0],i&2?hi[1]:lo[1],i&4?hi[2]:lo[2]];
 for(const q of[[0,1,3,2],[4,5,7,6],[0,1,5,4],[2,3,7,6],[0,2,6,4],[1,3,7,5]])quadTris(a,V(q[0]),V(q[1]),V(q[2]),V(q[3]),c);
}
const dyn={ghostT:null,ghostL:null,beams:null,jT:null,jL:null};
function makeBuf(arr,old){
 if(old)gl.deleteBuffer(old.b);
 const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gl.STATIC_DRAW);return{b,n:arr.length/7}}
function drawColor(o,mode,alpha,fa){
 if(!o||!o.n)return;
 gl.bindBuffer(gl.ARRAY_BUFFER,o.b);
 gl.vertexAttribPointer(0,3,gl.FLOAT,false,28,0);gl.vertexAttribPointer(1,4,gl.FLOAT,false,28,12);
 gl.uniform1f(progC.u.u_a,alpha);gl.uniform1f(progC.u.u_fa,fa||0);gl.drawArrays(mode,0,o.n);
}
const JTINT=[.45,.85,1];
function ghostGeo(cells,tint){
 const t=[],l=[];
 for(const g of cells){
  if(getAny(g[0],g[1],g[2])===g[3])continue;
  const c=GHOST_COL[g[3]]||[1,1,1],m=tint? .55:1;
  cubeTris(t,g[0],g[1],g[2],.06,tint?[c[0]*.4+tint[0]*.6,c[1]*.4+tint[1]*.6,c[2]*.4+tint[2]*.6,.6]:[c[0],c[1],c[2],.55]);lineBox(l,g[0],g[1],g[2],0,tint?[.5,.9,1,1]:[1,1,1,1]);
 }
 return[t,l];
}
function rebuildGhost(){
 if(!gl)return;
 let g=ghostGeo(ghostCells,null);dyn.ghostT=makeBuf(g[0],dyn.ghostT);dyn.ghostL=makeBuf(g[1],dyn.ghostL);
 g=ghostGeo(JB?JB.cells:[],JTINT);dyn.jT=makeBuf(g[0],dyn.jT);dyn.jL=makeBuf(g[1],dyn.jL);
}
function beamQuad(a,p0,p1,p2,p3,g){const lo=[g[0],g[1],g[2],.5],hi=[g[0],g[1],g[2],0];for(const[p,k]of[[p0,lo],[p1,lo],[p2,hi],[p0,lo],[p2,hi],[p3,hi]])a.push(p[0],p[1],p[2],k[0],k[1],k[2],k[3])}
let beamsDirty=true,beamsT=0,beamSig=-1;const beamArr=[];let beamF=new Float32Array(1024);
/* the beams only change when the set of standing chests changes: skip the rebuild otherwise, reuse one buffer */
function rebuildBeams(){
 beamsDirty=false;
 let sig=0,n=0;
 for(let i=0;i<loaded.length;i++){const ch=loaded[i];for(let k=0;k<ch.chests.length;k++){const c=ch.chests[k];
  if(ch.v[(c[1]<<8)|((c[2]&15)<<4)|(c[0]&15)]!==B.CHEST)continue;
  n++;sig=(Math.imul(sig,31)+((c[0]*2053+c[2])^(c[1]<<20)))|0}}
 sig=(sig^(n<<24))|0;
 if(sig===beamSig&&dyn.beams)return;
 beamSig=sig;
 const a=beamArr,g=[1,.86,.4];a.length=0;
 for(let i=0;i<loaded.length;i++){const ch=loaded[i];for(let k=0;k<ch.chests.length;k++){const c=ch.chests[k];
  if(ch.v[(c[1]<<8)|((c[2]&15)<<4)|(c[0]&15)]!==B.CHEST)continue;
  const x=c[0]+.5,z=c[2]+.5,y0=c[1]+1,y1=y0+22,w=.4;
  beamQuad(a,[x-w,y0,z],[x+w,y0,z],[x+w,y1,z],[x-w,y1,z],g);
  beamQuad(a,[x,y0,z-w],[x,y0,z+w],[x,y1,z+w],[x,y1,z-w],g);
 }}
 if(a.length>beamF.length)beamF=new Float32Array(a.length*2);
 for(let i=0;i<a.length;i++)beamF[i]=a[i];
 if(!dyn.beams)dyn.beams={b:gl.createBuffer(),n:0};
 gl.bindBuffer(gl.ARRAY_BUFFER,dyn.beams.b);gl.bufferData(gl.ARRAY_BUFFER,beamF.subarray(0,a.length),gl.DYNAMIC_DRAW);
 dyn.beams.n=a.length/7;
}
let hitView=null;
const hzV=new Float32Array(3),zenV=new Float32Array(3),visC=new Array(400),visD=new Float32Array(400);
const hitArr=[],hitF=new Float32Array(24*7),HIT_COL=[1,.85,.2,1],hitObj={b:null,n:24},botObj={b:null,n:0};
let silT=0,silLast=0;
function silLoaded(l){
 const x0=(l.x-l.ex)>>4,x1=(l.x+l.ex)>>4,z0=(l.z-l.ez)>>4,z1=(l.z+l.ez)>>4;
 for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const c=chunks.get(x+z*NC);if(!c||c.st!==2)return false}
 return true;
}
/* silhouettes: one static buffer, one draw call, drawn after the sky with the depth test off (so they never write depth); skipped when every entry is invisible */
function silDraw(time){
 const px=player.x,pz=player.z;
 if(time-silT>500){
  silT=time;
  if(Math.hypot(px-SIL.px,pz-SIL.pz)>28)silBuild(px,pz);
  for(const e of SIL.list){e.t=(Math.hypot(e.l.x-px,e.l.z-pz)<240&&silLoaded(e.l))?0:1}
 }
 const dt=Math.min(.1,(time-silLast)/1000||0);silLast=time;
 let any=false;
 for(const e of SIL.list){
  if(e.a!==e.t){const st=dt*2,d=e.t-e.a;e.a=Math.abs(d)<=st?e.t:e.a+Math.sign(d)*st;
   for(let i=e.v0;i<e.v1;i++)SIL.verts[i*7+6]=e.a;SIL.upd=true}
  if(e.a>0)any=true;
 }
 if(!SIL.n||!any)return;
 gl.useProgram(progH.p);const u=progH.u;
 gl.bindBuffer(gl.ARRAY_BUFFER,silBuf);
 if(SIL.dirty||SIL.upd){gl.bufferData(gl.ARRAY_BUFFER,SIL.verts.subarray(0,SIL.n*7),gl.DYNAMIC_DRAW);SIL.dirty=false;SIL.upd=false}
 gl.uniformMatrix4fv(u.u_vp,false,VPS);gl.uniform3fv(u.u_cam,cam.e);gl.uniform3fv(u.u_amb,sky.amb);gl.uniform3fv(u.u_hz,hzV);gl.uniform2f(u.u_ck,ckT,menuK);
 gl.enableVertexAttribArray(0);gl.enableVertexAttribArray(1);
 gl.vertexAttribPointer(0,3,gl.FLOAT,false,28,0);gl.vertexAttribPointer(1,4,gl.FLOAT,false,28,12);
 gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 gl.depthMask(false);gl.drawArrays(gl.TRIANGLES,0,SIL.n);gl.depthMask(true);
 gl.disable(gl.BLEND);
}
/* The tall skyline uses static meshes and the same depth buffer as terrain. */
let upperTowerMeshes=null;
let upperTowerBlocks=null;
function upperTowerSolid(x,y,z){
 if(y<32||!upperTowerBlocks)return false;
 for(const {l,levels} of upperTowerBlocks){
  if(y<=l.y0+l.h||Math.abs(x-l.x)>32||Math.abs(z-l.z)>32)continue;
  const boxes=levels[y-l.y0];if(!boxes)continue;
  for(const [west,north,east,south] of boxes)if(x>=west&&x<=east&&z>=north&&z<=south)return true;
 }
 return false;
}
function drawUpperTowers(){
 if(!upperTowerMeshes)upperTowerMeshes=[['burj',burjUpper],['sail',arabUpper]].map(([type,build])=>{
  const l=lmOf(type),verts=[],at=[0,0],levels=[];
  const quad=(a,b,c,d,col,shade=1)=>{
   for(const v of [a,b,c,a,c,d]){
    lm2w(l,v[0],v[2],at);
    verts.push(at[0]+.5,l.y0+v[1],at[1]+.5,col[0]*shade,col[1]*shade,col[2]*shade,1);
   }
  };
  const box=(x,y,z,X,Y,Z,c)=>{
   quad([x,Y,z],[X,Y,z],[X,Y,Z],[x,Y,Z],c);
   quad([x,y,z],[X,y,z],[X,Y,z],[x,Y,z],c,.78);
   quad([X,y,z],[X,y,Z],[X,Y,Z],[X,Y,z],c,.89);
   quad([X,y,Z],[x,y,Z],[x,Y,Z],[X,Y,Z],c,.95);
   quad([x,y,Z],[x,y,z],[x,Y,z],[x,Y,Z],c,.72);
   quad([x,y,Z],[X,y,Z],[X,y,z],[x,y,z],c,.60);
  };
  build(quad,(x,y,z,X,Y,Z,c)=>{
   box(x-.5,y,z-.5,X-.5,Y,Z-.5,c);
   const a=[],b=[];lm2w(l,x+.5,z+.5,a);lm2w(l,X-.5,Z-.5,b);
   const cells=[Math.floor(Math.min(a[0],b[0])),Math.floor(Math.min(a[1],b[1])),Math.floor(Math.max(a[0],b[0])),Math.floor(Math.max(a[1],b[1]))];
   for(let h=y;h<Y;h++)(levels[h]??=[]).push(cells);
  });
  const {summit:y,shaft:[x,z]}=type==='burj'?BURJ_LIFT:ARAB_LIFT;
  const deck=[.60,.67,.69],rail=[.32,.47,.54],trim=[.85,.71,.40];
  box(x-3.5,y-1,z-3.5,x+3.5,y,z+3.5,deck);
  for(const side of [-1,1]){
   const a=Math.min(side*2.5,side*3.5),b=a+1;
   box(x+a,y,z-3.5,x+b,y+1,z+3.5,rail);
   box(x-2.5,y,z+a,x+2.5,y+1,z+b,rail);
   box(x+a,y+.88,z-3.5,x+b,y+1,z+3.5,trim);
   box(x-2.5,y+.88,z+a,x+2.5,y+1,z+b,trim);
  }
  return{l,levels,data:new Float32Array(verts),b:null,n:verts.length/7};
 });
 upperTowerBlocks=upperTowerMeshes;
 for(const o of upperTowerMeshes){
  if(Math.hypot(o.l.x-cam.e[0],o.l.z-cam.e[2])>570)continue;
  if(!o.b||!gl.isBuffer(o.b)){
   o.b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,o.b);gl.bufferData(gl.ARRAY_BUFFER,o.data,gl.STATIC_DRAW);
  }
  drawColor(o,gl.TRIANGLES,1,.30);
 }
}
function render(time){
 updateCamera();
 for(let c=0;c<3;c++){hzV[c]=sky.hz[c]/255;zenV[c]=sky.zen[c]/255}
 gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.depthMask(true);
 gl.clearColor(hzV[0],hzV[1],hzV[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 gl.useProgram(progS.p);const s=progS.u;
 gl.uniform3fv(s.u_f,cam.fw);gl.uniform3fv(s.u_r,cam.rt);gl.uniform3fv(s.u_u,cam.up);gl.uniform2f(s.u_t,cam.tx,cam.ty);
 gl.uniform3fv(s.u_hz,hzV);gl.uniform3fv(s.u_zen,zenV);gl.uniform3fv(s.u_sun,sky.sun);gl.uniform2f(s.u_ck,ckT,menuK);
 gl.bindBuffer(gl.ARRAY_BUFFER,quadBuf);gl.enableVertexAttribArray(0);gl.disableVertexAttribArray(1);
 gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLES,0,3);
 gl.enable(gl.DEPTH_TEST);
 silDraw(time);
 gl.useProgram(progT.p);const u=progT.u;
 const fb=Math.max(36,RAD*16-6),fT=fovBase+fovKick+(aspect<1?.2:0)*menuK;
 if(Math.abs(fT-fovY)>.0005){fovY=fT;setProj()}
 farFog=fb+(150-fb)*menuK;const nearU=fb*.38+(78-fb*.38)*menuK;
 gl.uniformMatrix4fv(u.u_vp,false,VP);gl.uniform3fv(u.u_cam,cam.e);gl.uniform3fv(u.u_fog,hzV);for(let c=0;c<3;c++)ambU[c]=sky.amb[c]+(1-sky.amb[c])*.8*museumLit;gl.uniform3fv(u.u_amb,ambU);
 gl.uniform1f(u.u_near,nearU);gl.uniform1f(u.u_far,farFog);gl.uniform2f(u.u_ck,ckT,menuK);gl.bindTexture(gl.TEXTURE_2D,atlasTex);gl.uniform1i(u.u_tex,0);
 gl.enableVertexAttribArray(0);gl.enableVertexAttribArray(1);
 gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,idxBuf);
 /* frustum + distance culling, sorted far to near for the see-through pass */
 let on=0;const e=cam.e,lim=farFog+14,fw=cam.fw,rt=cam.rt,up=cam.up,tx=cam.tx,ty=cam.ty,sx=Math.sqrt(1+tx*tx),sy=Math.sqrt(1+ty*ty);
 for(let i=0;i<loaded.length;i++){
  const c=loaded[i];if(c.st!==2)continue;
  const px=c.cx*16+8-e[0],py=24-e[1],pz=c.cz*16+8-e[2],dist=Math.hypot(px,pz);
  if(dist>lim)continue;
  if(dist>16){const zf=px*fw[0]+py*fw[1]+pz*fw[2];if(zf<-27)continue;
   if(Math.abs(px*rt[0]+pz*rt[2])>zf*tx+27*sx)continue;
   if(Math.abs(px*up[0]+py*up[1]+pz*up[2])>zf*ty+30*sy)continue}
  let j=on++;
  while(j>0&&visD[j-1]<dist){visD[j]=visD[j-1];visC[j]=visC[j-1];j--}
  visD[j]=dist;visC[j]=c;
 }
 for(let pass=0;pass<2;pass++){
  gl.uniform1f(u.u_pass,pass);
  if(pass){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false)}
  for(let k=0;k<on;k++){
   const c=visC[k];if(!c.cnt[pass])continue;
   gl.bindBuffer(gl.ARRAY_BUFFER,c.buf[pass]);
   gl.vertexAttribPointer(0,4,gl.SHORT,false,12,0);gl.vertexAttribPointer(1,4,gl.UNSIGNED_BYTE,true,12,8);
   gl.uniform2f(u.u_off,c.cx*16,c.cz*16);
   gl.drawElements(gl.TRIANGLES,c.cnt[pass]/4*6,gl.UNSIGNED_SHORT,0);}
 }
 gl.depthMask(true);gl.disable(gl.BLEND);
 gl.useProgram(progC.p);const cu=progC.u;gl.uniformMatrix4fv(cu.u_vp,false,VP);gl.uniform3fv(cu.u_cam,cam.e);gl.uniform3fv(cu.u_fog,hzV);
 gl.uniform1f(cu.u_near,farFog*.38);gl.uniform1f(cu.u_far,farFog);
 gl.enableVertexAttribArray(0);gl.enableVertexAttribArray(1);gl.disableVertexAttribArray(2);
 drawUpperTowers();
 if(botN){botObj.b=botBuf;botObj.n=botN;gl.bindBuffer(gl.ARRAY_BUFFER,botBuf);gl.bufferSubData(gl.ARRAY_BUFFER,0,botGeo.subarray(0,botN*7));drawColor(botObj,gl.TRIANGLES,1,1)}
 portalDraw(time);drawLandmarkPhotos();
 gl.enable(gl.BLEND);
 const pulse=.75+.25*Math.sin(time*.003);
 gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 drawColor(dyn.ghostT,gl.TRIANGLES,.55*pulse);drawColor(dyn.ghostL,gl.LINES,.9);
 drawColor(dyn.jT,gl.TRIANGLES,.6*pulse);drawColor(dyn.jL,gl.LINES,.9);
 gl.blendFunc(gl.SRC_ALPHA,gl.ONE);if(playing||glide)drawColor(dyn.beams,gl.TRIANGLES,pulse);
 gl.depthMask(true);gl.disable(gl.BLEND);
 if(hitView){
  hitArr.length=0;lineBox(hitArr,hitView.x,hitView.y,hitView.z,.004,HIT_COL);hitF.set(hitArr);
  gl.bindBuffer(gl.ARRAY_BUFFER,hitBuf);gl.bufferData(gl.ARRAY_BUFFER,hitF,gl.DYNAMIC_DRAW);
  hitObj.b=hitBuf;drawColor(hitObj,gl.LINES,1);
 }
}

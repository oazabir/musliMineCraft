/* ===== 8f. Fixed, non-lethal machine-gun post ===== */
const MG_POST={x:GZ.x,z:GZ.z};
const MG_RADIUS=2.7;
const MG={on:false,back:null,shot:null,buf:null,obj:{b:null,n:0}};
function machinePostBase(){return Math.round(raw(MG_POST.x,MG_POST.z))}
function machinePostBlock(x,y,z){return y===machinePostBase()+1&&x>=MG_POST.x-1&&x<=MG_POST.x&&z>=MG_POST.z-1&&z<=MG_POST.z}
function genMachinePost(x0,z0){
 const b=machinePostBase();for(let z=MG_POST.z-1;z<=MG_POST.z;z++)for(let x=MG_POST.x-1;x<=MG_POST.x;x++)if(x>=x0&&x<x0+16&&z>=z0&&z<z0+16)put(x,b+1,z,B.STONE,1);
}
function mgHint(on){$('mgHint').classList.toggle('on',on)}
function enterMachinePost(){
 if(MG.on||!playing)return;
 const back={x:player.x,y:player.y,z:player.z,yaw:player.yaw,pitch:player.pitch};
 if(!teleport(MG_POST.x,MG_POST.z+MG_RADIUS,0,-.08))return;
 MG.back=back;MG.on=true;mgHint(true);input.jx=input.jy=0;input.jump=false;
}
function leaveMachinePost(){
 if(!MG.on)return;
 const p=MG.back;MG.on=false;MG.back=null;mgHint(false);MG.shot=null;
 if(p)Object.assign(player,{x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:p.pitch,vx:0,vy:0,vz:0,hold:false});qCx=-9999;
}
function machineFire(px,py){
 if(!MG.on)return;
 const r=playerRay(px,py),h=cast(r.o,r.d,96,0,true),d=h?Math.max(1,h.t):64;gzShoot(r.o,r.d,d);
 const start=[r.o[0]+cam.fw[0]*.9+cam.rt[0]*.2,r.o[1]+cam.fw[1]*.9+cam.rt[1]*.2,r.o[2]+cam.fw[2]*.9+cam.rt[2]*.2];
 for(let i=0;i<3;i++)gzFx.push({k:2,x:start[0]-r.d[0]*i*.24,y:start[1]-r.d[1]*i*.24,z:start[2]-r.d[2]*i*.24,vx:r.d[0]*46,vy:r.d[1]*46,vz:r.d[2]*46,t:0,life:.5,s:.075});
 MG.shot={a:start,b:[r.o[0]+r.d[0]*d,r.o[1]+r.d[1]*d,r.o[2]+r.d[2]*d],dir:r.d.slice(),until:performance.now()+150};
}
function machineDraw(time){
 const s=MG.shot;if(!s)return;if(time>s.until){MG.shot=null;return}
 if(!MG.buf)MG.buf=gl.createBuffer();
 const t=clamp(1-(s.until-time)/150,0,1),len=Math.min(14,Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1],s.b[2]-s.a[2])),p=[s.a[0]+s.dir[0]*t*len,s.a[1]+s.dir[1]*t*len,s.a[2]+s.dir[2]*t*len];
 const a=new Float32Array([...s.a,1,.72,.18,.3,...s.b,1,.35,.08,.08,...p,1,.9,.42,1,p[0]+s.dir[0]*.34,p[1]+s.dir[1]*.34,p[2]+s.dir[2]*.34,1,.52,.12,.9]);
 gl.bindBuffer(gl.ARRAY_BUFFER,MG.buf);gl.bufferData(gl.ARRAY_BUFFER,a,gl.DYNAMIC_DRAW);
 MG.obj.b=MG.buf;MG.obj.n=4;drawColor(MG.obj,gl.LINES,1);
}
window.__machinePost=()=>({on:MG.on,x:MG_POST.x,z:MG_POST.z});
const MG_BLACK=[.025,.03,.035];
function machinePostDraw(){
 const b={x:MG_POST.x,y:machinePostBase()+1,z:MG_POST.z,yaw:MG.on?player.yaw:0},p=MG.on?player.pitch:0,v=1.48;
 part(b,0,.12,0,.28,.12,.28,MG_BLACK);
 part(b,0,.77,0,.085,.67,.085,MG_BLACK);
 part(b,0,v,-.04,.2,.14,.34,MG_BLACK,p,v);
 part(b,0,v,-.72,.075,.075,.58,MG_BLACK,p,v);
 part(b,0,v,.42,.12,.09,.24,MG_BLACK,p,v);
 part(b,0,1.19,.04,.055,.18,.07,MG_BLACK,p,v);
 part(b,0,1.67,-.1,.045,.05,.07,MG_BLACK,p,v);
}

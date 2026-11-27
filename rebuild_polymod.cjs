const fs=require('fs'),path=require('path');
const ROOT=__dirname, SRC=process.argv[2]||path.join('/tmp','polymod-extract');
const MB=path.join(SRC,'main.bundle.js'), WB=path.join(SRC,'simulation_worker.bundle.js');
let src=fs.readFileSync(MB,'utf8');
const SHIM_A='/*PT_MP_SHIM_START*/',SHIM_B='/*PT_MP_SHIM_END*/';
{const s0=src.indexOf(SHIM_A);if(s0>=0){const s1=src.indexOf(SHIM_B,s0);if(s1>s0)src=src.slice(0,s0)+src.slice(s1+SHIM_B.length);}}
const shim=fs.readFileSync(path.join(ROOT,'mod_mp.js'),'utf8');
const START='/*CAMERA_ORBIT_IJKL*/';
const TAIL='"loading"===document.readyState?document.addEventListener("DOMContentLoaded",buildUI):buildUI();';
const i=src.indexOf(START); if(i<0)throw new Error('mod start marker missing');
const t=src.indexOf(TAIL,i); if(t<0)throw new Error('mod tail marker missing');
const e=src.indexOf('})();',t)+5;
const block=src.slice(i,e);
const grab=n=>{const m=new RegExp('^const '+n+'=([\\s\\S]*?);\\r?$','m').exec(block);if(!m)throw new Error(n+' missing');return m[1]};
const tn=grab('TRACK_NAMES'), of=grab('OFFICIAL');
let mod=fs.readFileSync(path.join(ROOT,'mod5.js'),'utf8').replace('__PT_TRACK_NAMES__',()=>tn).replace('__PT_OFFICIAL__',()=>of);
if(/__PT_[A-Z_]+__/.test(mod))throw new Error('unfilled placeholder');
src=src.slice(0,i)+mod+'\n'+SHIM_A+'\n'+shim+'\n'+SHIM_B+src.slice(e);
const AA='antialias:t?.getSettingBoolean(O.A.Antialiasing)??!0';
const AAN='antialias:(window.__ptGameAA=!!(t?.getSettingBoolean(O.A.Antialiasing)??!0),window.__ptAA?window.__ptAA(window.__ptGameAA):window.__ptGameAA)';
if(src.includes(AA)){src=src.split(AA).join(AAN);console.log('AA hook: patched');}else console.log('AA hook: present');
src=src.split('&&!1((0,').join('&&!1&&((0,').split('&&!1&&!1&&').join('&&!1&&');
const INV='"Invalid replay detected!"',SUPPRESSED='&&!1&&((0,';
if(!src.includes(INV))console.log('invalid-replay popup: marker missing');
else if(src.includes(SUPPRESSED))console.log('invalid-replay popup: already suppressed');
else{
  const invAt=src.indexOf(INV);
  const showAt=src.lastIndexOf('.show(',invAt);
  const ampAt=showAt>0?src.lastIndexOf('&&',showAt):-1;
  if(ampAt>0&&showAt-ampAt<40){src=src.slice(0,ampAt)+'&&!1'+src.slice(ampAt);console.log('invalid-replay popup: suppressed');}
  else console.log('invalid-replay popup: anchor not found');
}
// VerifyResult carries the finish frame, so the move editor can simulate a run's time.
{const VOLD="postMessage({messageType:Ki.VerifyResult,carId:l,result:A})",VNEW="postMessage({messageType:Ki.VerifyResult,carId:l,result:A,frames:h.frames,finished:h.hasFinished})";
const wsrc=fs.readFileSync(WB,'utf8');
if(wsrc.includes(VNEW))console.log('verify frames: present');
else if(wsrc.includes(VOLD)){fs.writeFileSync(WB,wsrc.replace(VOLD,VNEW));console.log('verify frames: patched');}
else console.log('verify frames: anchor missing');}

const WK='new Worker("simulation_worker.bundle.js")';
if(src.includes(WK)){src=src.split(WK).join('new Worker("simulation_worker.bundle.js#ptSpeed="+(window.__ptCheatSpeed?window.__ptCheatSpeed():1))');console.log('worker URL: factor added');}else console.log('worker URL: factor present');
const RRE=/\(0,([A-Za-z_$][\w$]*)\.gn\)\(this,([A-Za-z_$][\w$]*),"f"\)\.recordFrame\(([A-Za-z_$][\w$]*)\.frames,\(0,\1\.gn\)\(this,([A-Za-z_$][\w$]*),"f"\)\.controls\)/g;
if(src.includes('window.__ptRec?'))console.log('record hook: present');
else{
  let hits=0;
  src=src.replace(RRE,(m,mod,rf,pv,cuf)=>{hits++;const R='(0,'+mod+'.gn)(this,'+rf+',"f")',C='(0,'+mod+'.gn)(this,'+cuf+',"f")';return '(window.__ptRec?window.__ptRec('+R+','+pv+','+C+'):'+R+'.recordFrame('+pv+'.frames,'+C+'.controls))'});
  if(hits!==1)throw new Error('record hook: matched '+hits);
  console.log('record hook: patched (exact control frames)');
}
const mcheck=src;
if(!mcheck.includes('window.__ptRec?window.__ptRec('))throw new Error('record hook missing after patch');
fs.writeFileSync(MB,src);
let w=fs.readFileSync(WB,'utf8');
const PRE=`;(function(){
var g=self;if(g.__ptWasmSetup)return;g.__ptWasmSetup=1;
var m=/#ptSpeed=([0-9.]+)/.exec(g.location.hash||""),f=m?+m[1]:1;
if(!isFinite(f)||f<1)f=1;if(f>4)f=4;g.__ptWasmFactor=f;
if(f<=1)return;
var WA=g.WebAssembly;if(!WA)return;
function patch(buf){
try{
var a=(buf instanceof Uint8Array)?buf:new Uint8Array(buf);
var hits=0,idx=-1;
for(var i=0;i<a.length-4;i++){if(a[i]===0x43&&a[i+1]===0&&a[i+2]===0&&a[i+3]===122&&a[i+4]===0x45){hits++;if(idx<0)idx=i}}
if(hits!==1)return a;
var dv=new DataView(a.buffer,a.byteOffset,a.byteLength);
if(Math.abs(dv.getFloat32(idx+1,true)-4000)>1e-3)return a;
dv.setFloat32(idx+1,4000*f,true);
g.__ptPatched={offset:idx,factor:f,hits:hits,now:dv.getFloat32(idx+1,true)};
return a;
}catch(e){return buf}
}
var oi=WA.instantiate,os=WA.instantiateStreaming;
if(os)WA.instantiateStreaming=function(s,im){
try{return Promise.resolve(s).then(function(r){return r.arrayBuffer()}).then(function(b){return oi.call(WA,patch(b),im)})}catch(e){}
return os.apply(WA,arguments)};
if(oi)WA.instantiate=function(b,im){
try{if(b&&(b instanceof ArrayBuffer||ArrayBuffer.isView(b)))return oi.call(WA,patch(b),im)}catch(e){}
return oi.apply(WA,arguments)};
})();
`;
if(!w.includes('__ptWasmSetup')){w=PRE+w;console.log('wasm patcher: prepended');}else console.log('wasm patcher: present');
const STEP='var add=s-1+(car.__ptAcc||0),ex=Math.floor(add+1e-9);car.__ptAcc=add-ex;';
if(w.includes(STEP)){w=w.replace(STEP,'var ex=0;car.__ptAcc=0;');console.log('extra steps: off');}else console.log('extra steps: already off');
w=w.split('g.__ptKmh').join('self.__ptKmh');
const KMH='var h=t.HEAPU8,dv=new DataView(h.buffer);if(null!=f){';
if(w.includes('self.__ptKmh=dv.getFloat32'))console.log('kmh capture: present');
else if(w.includes(KMH)){w=w.replace(KMH,'var h=t.HEAPU8,dv=new DataView(h.buffer);self.__ptKmh=dv.getFloat32(i+7,!0);if(null!=f){');console.log('kmh capture: added');}
else throw new Error('kmh anchor missing');
const TRC='self.__ptKmh=dv.getFloat32(i+7,!0);';
if(!w.includes('self.__ptTrace&&')&&w.includes(TRC)){
  w=w.replace(TRC,TRC+'try{self.__ptTrace&&self.__ptTrace(e,r,f,dv,h,i)}catch(_p){}');
  console.log('stall trace hook: added');
}
const STAT='g.__ptStat={frames:0,extra:0,grip:0};';
const TRACEDEF=`g.__ptTrace=(function(){var M={};function st(id){var s=M[id];if(!s){s={ring:[],post:null,left:0,stall:0,cool:0,at:null,prev:null,uc:!1};M[id]=s}return s}return function(car,ctl,frame,dv,h,sp){try{if(!car||car.id==null)return;var s=st(car.id);s.uc=!!car.userControls;if(s.uc&&typeof frame=="number"&&isFinite(frame)){var ck=(ctl&&ctl.up?1:0)|(ctl&&ctl.right?2:0)|(ctl&&ctl.down?4:0)|(ctl&&ctl.left?8:0)|(ctl&&ctl.reset?16:0);if(s.ck!==ck){s.ck=ck;try{g.postMessage({ptCtl:[frame,ck]})}catch(_c){}}}var fl=h[sp+11],po=sp+14+(2&fl?3:0);var px=dv.getFloat32(po,true),py=dv.getFloat32(po+4,true),pz=dv.getFloat32(po+8,true);var qx=dv.getFloat32(po+12,true),qy=dv.getFloat32(po+16,true),qz=dv.getFloat32(po+20,true),qw=dv.getFloat32(po+24,true);var k=+dv.getFloat32(sp+7,true).toFixed(1);var fx=2*(qx*qz+qw*qy),fz=1-2*(qx*qx+qy*qy);var p=s.prev,vx=0,vz=0;if(p){vx=px-p[0];vz=pz-p[1]}s.prev=[px,pz];var vm=Math.sqrt(vx*vx+vz*vz),fm=Math.sqrt(fx*fx+fz*fz);var slip=(vm>1e-6&&fm>1e-6)?Math.round(Math.acos(Math.max(-1,Math.min(1,(vx*fx+vz*fz)/(vm*fm))))*57.2958):null;var smp=[frame,k,+px.toFixed(2),+py.toFixed(2),+pz.toFixed(2),+qx.toFixed(3),+qy.toFixed(3),+qz.toFixed(3),+qw.toFixed(3),fl,ctl&&ctl.up?1:0,ctl&&ctl.down?1:0,ctl&&ctl.left?1:0,ctl&&ctl.right?1:0,slip];s.ring.push(smp);if(s.ring.length>600)s.ring.shift();if(s.post){s.post.push(smp);if(--s.left<=0){var pk={at:s.at,before:s.ring.slice(),after:s.post,car:car.id,uc:s.uc};s.post=null;try{g.postMessage({messageType:"ptStallTrace",ptStallTrace:pk})}catch(e){}}}var mx=0,q;for(q=Math.max(0,s.ring.length-300);q<s.ring.length;q++)if(s.ring[q][1]>mx)mx=s.ring[q][1];var gate=s.uc?!!(ctl&&ctl.up)&&k<10:k<20;if(!s.post&&frame>s.cool&&frame>120&&gate&&mx>45){if(++s.stall>=10){s.post=[];s.left=240;s.at=smp;s.cool=frame+1200;s.stall=0}}else if(!s.post)s.stall=0;}catch(e){}}})();`;
if(w.includes('g.__ptTrace=')){w=w.replace(/g\.__ptTrace=\(function\(\)\{[\s\S]*?\}\)\(\);/,()=>TRACEDEF)}else if(w.includes(STAT)){w=w.replace(STAT,STAT+TRACEDEF)}
let k=0,n=0;
while(true){
  const at=w.indexOf('ptCheatAck:{',k); if(at<0)break;
  const seg=w.slice(at,at+300);
  if(seg.indexOf('factor:g.__ptWasmFactor')<0){
    w=w.slice(0,at+12)+'factor:g.__ptWasmFactor,patched:g.__ptPatched||null,kmh:+(self.__ptKmh||0).toFixed(1),'+w.slice(at+12);
    n++; k=at+100;
  } else k=at+12;
}
console.log('ack payloads extended:',n);
// Autopilot: the worker already knows how to deserialize a recording for ghost/verify cars.
// Arm one over the message port and it returns that run's controls instead of the keyboard's.
const UCTL='{up:t.userControls.up,right:t.userControls.right,down:t.userControls.down,left:t.userControls.left,reset:t.userControls.reset}';
if(!w.includes('__ptAutoCtl')){
  if(!w.includes(UCTL))throw new Error('autopilot controls anchor missing');
  // Both the realtime and the batched update loops build a user car's controls this way.
  w=w.split(UCTL).join('((self.__ptAutoCtl&&self.__ptAutoCtl(t.frames))||'+UCTL+')');
  const MSG='const r=i.data;switch(r.messageType){case Ki.Init:';
  if(!w.includes(MSG))throw new Error('autopilot message anchor missing');
  w=w.replace(MSG,'const r=i.data;if(r&&void 0!==r.ptAutoRec){try{const _d=Qa.deserialize(r.ptAutoRec);self.__ptAutoCtl=_d&&_d.getControls?function(f){try{return _d.getControls(f)}catch(e){return null}}:null}catch(e){self.__ptAutoCtl=null}try{postMessage({ptAutoReady:!!self.__ptAutoCtl})}catch(e){}return}switch(r.messageType){case Ki.Init:');
  console.log('autopilot hooks: patched');
}else console.log('autopilot hooks: present');
fs.writeFileSync(WB,w);

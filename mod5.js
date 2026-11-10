/*CAMERA_ORBIT_IJKL*/(function(){
const keys=Object.create(null);
const DEFAULTS={left:"KeyJ",right:"KeyL",up:"KeyI",down:"KeyK",menu:"ShiftRight",resetCam:"KeyC"};
const ACTIONS=[["left","Orbit left"],["right","Orbit right"],["up","Camera up"],["down","Camera down"],["menu","Menu key"],["resetCam","Reset view key"]];
const STORE="ptCamBindings",GFXKEY="ptGfx",HUDKEY="ptHud",CHEATKEY="ptCheats",PANELKEY="ptPanel";
const bind=Object.assign({},DEFAULTS);
try{const saved=JSON.parse(localStorage.getItem(STORE)||"null");if(saved&&"object"==typeof saved)for(const k in DEFAULTS)"string"==typeof saved[k]&&saved[k]&&(bind[k]=saved[k])}catch(e){}
const gfx=Object.assign({scale:1,wireframe:!1,fov:1,dist:1,aa:"game"},(function(){try{const v=JSON.parse(localStorage.getItem(GFXKEY)||"null");return v&&"object"==typeof v?v:{}}catch(e){return{}}})());
const hud=Object.assign({progress:!1,keys:!1,pos:"top"},(function(){try{const v=JSON.parse(localStorage.getItem(HUDKEY)||"null");return v&&"object"==typeof v?v:{}}catch(e){return{}}})());
const cheat=Object.assign({speed:1,grip:1,others:!1},(function(){try{const v=JSON.parse(localStorage.getItem(CHEATKEY)||"null");return v&&"object"==typeof v?v:{}}catch(e){return{}}})());
const cheatState=()=>({speed:cheat.speed,grip:cheat.grip,others:!!cheat.others});
window.__ptGhostRate=()=>1;
window.__ptAA=function(gameValue){try{if("off"===gfx.aa)return!1;if("msaa"===gfx.aa)return!0;return!!gameValue}catch(e){return gameValue}};
window.__ptCheatSpeed=function(){try{return Math.max(1,Math.min(4,+cheat.speed||1))}catch(e){return 1}};try{window.__ptStallTrace=JSON.parse(localStorage.getItem("ptStallTrace")||"null")}catch(e){}
window.__ptCtlQ=[];window.__ptRecLast=-1;window.__ptRecMode=new WeakMap();window.__ptRecStat={mode:0,ev:0,last:-1,q:0,seed:0,drop:0};window.__ptSeeded=new Set();
window.__ptRec=function(rec,prev,cur){try{
if(!rec||!cur)return;
var cf=+cur.frames;if(!(cf>=0))cf=-1;
var q=window.__ptCtlQ;
if(cf>=0&&cf<window.__ptRecLast){window.__ptRecLast=-1;var wnd=cf+64,keep=[],iz;for(iz=0;iz<q.length;iz++){if(q[iz][0]<=wnd)keep.push(q[iz]);else window.__ptRecStat.drop++}q.length=0;for(iz=0;iz<keep.length;iz++)q.push(keep[iz])}
if(!window.__ptSeeded.has(rec)){window.__ptSeeded.add(rec);try{rec.recordFrame(0,cur.controls);window.__ptRecStat.seed=1}catch(x){window.__ptRecStat.seed=-1}}
var mode=window.__ptRecMode.get(rec);
if(mode===void 0){mode=q.length>0;window.__ptRecMode.set(rec,mode);window.__ptRecStat.mode=mode?1:0}
if(!mode){if(prev&&prev.frames!=null)rec.recordFrame(prev.frames,cur.controls);return}
if(q.length>8192)q.splice(0,q.length-8192);
var k=0,e;
while(k<q.length&&q[k][0]<=cf){e=q[k++];if(e[0]>window.__ptRecLast){try{rec.recordFrame(e[0],{up:!!(1&e[1]),right:!!(2&e[1]),down:!!(4&e[1]),left:!!(8&e[1]),reset:!!(16&e[1])});window.__ptRecStat.ev++}catch(x){}window.__ptRecLast=e[0]}}
if(k)q.splice(0,k);
window.__ptRecStat.last=window.__ptRecLast;window.__ptRecStat.q=q.length;
}catch(x){}};
let yaw=0,pitch=0,open=!1,capture=null,panel=null,tabBar=null,panelBody=null,replayStatus=null,camCalls=0,camHintEl=null;
const pad={up:!1,down:!1,left:!1,right:!1};
const tabs=[],tabHooks={},rate=2,limit=1.25;
const TRACK_NAMES=__PT_TRACK_NAMES__;
const OFFICIAL=__PT_OFFICIAL__;
const RECORD_RE=/^(polytrack_v\d+_[a-z]+_)record_(\d+)_([a-z]+)_([0-9a-f]{64})$/i;
const HISTKEY="pthist_";const trackFilter={on:!0};const curTrack={id:null,at:0,pending:0};let drawBusy=0;
const setCurTrack=id=>{if("string"!=typeof id||!id)return;id=id.toLowerCase();if(id===curTrack.id)return;curTrack.id=id,curTrack.at=Date.now();if(drawBusy)return void(curTrack.pending=1);try{tabHooks.Replays&&tabHooks.Replays()}catch(e){}};
function listHistory(){const out=[];try{for(const k of Object.keys(localStorage)){if(0!==k.indexOf(HISTKEY))continue;try{const v=JSON.parse(localStorage.getItem(k)||"null");if(!v||"string"!=typeof v.recording||!v.recording||"number"!=typeof v.frames)continue;out.push({key:k,slot:v.slot|0,kind:"string"==typeof v.kind?v.kind:"default",prefix:"string"==typeof v.prefix?v.prefix:"polytrack_v5_prod_",id:String(v.id||"").toLowerCase(),frames:v.frames,recording:v.recording,at:v.at|0})}catch(e){}}}catch(e){}return out}
function pruneHistory(){try{const all=listHistory();if(all.length<=160)return;all.sort(((a,b)=>a.at-b.at));for(let i=0;i<all.length-160;i++)try{localStorage.removeItem(all[i].key)}catch(e){}}catch(e){}}
function archiveRecord(key,val){try{const m=RECORD_RE.exec(key);if(!m||!val)return;const old=localStorage.getItem(key);if(!old||old===val)return;let o=null;try{o=JSON.parse(old)}catch(e){return}if(!o||"string"!=typeof o.recording||!o.recording||"number"!=typeof o.frames)return;const id=m[4].toLowerCase(),at=Date.now();localStorage.setItem(HISTKEY+m[2]+"_"+m[3]+"_"+id+"_"+o.frames+"_"+at,JSON.stringify({slot:Number(m[2]),kind:m[3],prefix:m[1],id:id,frames:o.frames,recording:o.recording,at:at}));pruneHistory()}catch(e){}}
(function(){try{const SP=Storage.prototype;if(SP.__ptRecHooked)return;SP.__ptRecHooked=1;const si=SP.setItem,gi=SP.getItem;SP.setItem=function(k,v){try{"string"==typeof k&&archiveRecord(k,v)}catch(e){}return si.call(this,k,v)};SP.getItem=function(k){const v=gi.call(this,k);try{if("string"==typeof k){const m=RECORD_RE.exec(k);if(m)setCurTrack(m[4])}}catch(e){}return v}}catch(e){}})();
(function(){try{const byUrl={};for(const id in OFFICIAL)byUrl[OFFICIAL[id].url]=id;const mark=u=>{try{const s=String(u).split("?")[0].split("#")[0];if(byUrl[s])return setCurTrack(byUrl[s]);const m=/tracks\/[^?#]*?([0-9a-f]{64})\.track/i.exec(s);if(m)setCurTrack(m[1])}catch(e){}};const f=window.fetch;if(f&&!f.__ptHooked){const wf=function(i){try{mark("string"==typeof i?i:i&&i.url)}catch(e){}return f.apply(this,arguments)};wf.__ptHooked=1,window.fetch=wf}const op=XMLHttpRequest.prototype.open;if(op&&!op.__ptHooked){const wo=function(m,u){try{mark(u)}catch(e){}return op.apply(this,arguments)};wo.__ptHooked=1,XMLHttpRequest.prototype.open=wo}}catch(e){}})();
window.__ptCamPatch="PolyMod UI + IJKL orbit + HUD/gfx/debug/AA + drag/resize";
function saveCheat(){persist(CHEATKEY,cheat)}
function syncCheat(){try{const w=window.__ptSimWorker;if(w)w.postMessage({ptCheat:cheatState()})}catch(e){}}
(function(){try{const P=Worker.prototype;if(P.__ptCheatHooked)return;const post=P.postMessage;
P.postMessage=function(m,t){try{if(m&&"object"==typeof m&&!ArrayBuffer.isView(m)){window.__ptSimWorker=this;const c={};for(const k in m)c[k]=m[k];c.ptCheat=cheatState();m=c,window.__ptLastWorkerMsg=c}}catch(e){}return void 0===t?post.call(this,m):post.call(this,m,t)};
const addL=P.addEventListener;P.addEventListener=function(t,f,o){try{if("message"===t&&!this.__ptTapped){this.__ptTapped=1;addL.call(this,"message",function(ev){try{const d=ev&&ev.data;if(d&&d.ptCheatAck)window.__ptAckStats=d.ptCheatAck;if(d&&d.ptCtl){window.__ptCtlQ.push(d.ptCtl)}if(d&&d.ptStallTrace){window.__ptStallTrace=d.ptStallTrace;try{localStorage.setItem("ptStallTrace",JSON.stringify(d.ptStallTrace))}catch(e){};console.warn("[pt stall] frame "+d.ptStallTrace.at[0]+" at "+d.ptStallTrace.at[1]+" km/h")}}catch(e){}})}}catch(e){}return addL.call(this,t,f,o)};
P.__ptCheatHooked=!0}catch(e){}})();
const persist=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const save=()=>persist(STORE,bind),saveGfx=()=>persist(GFXKEY,gfx),saveHud=()=>persist(HUDKEY,hud);
const typing=()=>{const a=document.activeElement;return!!a&&("INPUT"===a.tagName||"TEXTAREA"===a.tagName||a.isContentEditable)};
const NAMES={ArrowUp:"\u2191",ArrowDown:"\u2193",ArrowLeft:"\u2190",ArrowRight:"\u2192",Space:"Space",ShiftLeft:"LShift",ShiftRight:"RShift",ControlLeft:"LCtrl",ControlRight:"RCtrl",AltLeft:"LAlt",AltRight:"RAlt",Tab:"Tab",Enter:"Enter",Backspace:"Backspace",Minus:"-",Equal:"=",Comma:",",Period:".",Slash:"/",Semicolon:";",Quote:"'",BracketLeft:"[",BracketRight:"]",Backquote:"`",Backslash:"\\",Escape:"Esc"};
const keyLabel=c=>NAMES[c]||("Key"===c.slice(0,3)?c.slice(3):"Digit"===c.slice(0,5)?c.slice(5):"Numpad"===c.slice(0,6)?"Num "+c.slice(6):c);
const fmtTime=frames=>{const ms=Math.max(0,Math.round(frames)),m=Math.floor(ms/6e4),s=Math.floor(ms%6e4/1e3),r=ms%1e3;return m+":"+String(s).padStart(2,"0")+"."+String(r).padStart(3,"0")};
const fmtSize=n=>n<1024?n+" B":Math.round(n/1024)+" KB";
const profileName=(prefix,slot)=>{try{const u=JSON.parse(localStorage.getItem(prefix+"user_"+slot)||"null");if(u&&"object"==typeof u&&"string"==typeof u.nickname&&u.nickname)return u.nickname}catch(e){}return "Profile "+(slot+1)};

/* ---------- input ---------- */
window.addEventListener("keydown",(function(e){
if(capture){e.preventDefault(),e.stopPropagation();const act=capture;if("Escape"!==e.code){const old=bind[act];for(const k in bind)k!==act&&bind[k]===e.code&&(bind[k]=old);bind[act]=e.code,save()}capture=null,render();return}
if(typing())return;
if(e.code===bind.menu){e.preventDefault(),open=!open,applyOpen();return}
if(e.code===bind.resetCam){yaw=0,pitch=0;return}
keys[e.code]=!0;
}),!0);
window.addEventListener("keyup",(e=>{keys[e.code]=!1}),!0);
window.addEventListener("blur",(()=>{for(const code in keys)keys[code]=!1}));

/* ---------- renderer + camera ---------- */
const up=new c.Pq0(0,1,0),right=new c.Pq0(1,0,0),off=new c.Pq0(),orig=x.prototype.update;
const baseRatio=new WeakMap();
let renderer=null,sceneRef=null,camRef=null,drawCalls=0,triangles=0,appliedWireframe=!1;
let hookedRenderers=0;
const hookRenderer=r=>{
if(!r||r.__ptHooked)return r;
r.__ptHooked=!0;
const origRender=r.render&&r.render.bind(r),origSet=r.setPixelRatio&&r.setPixelRatio.bind(r);
if(origRender)r.render=function(s,c){renderer=r,sceneRef=s,camRef=c;try{applyOrbit()}catch(e){}const out=origRender.apply(r,arguments);try{drawCalls=r.info.render.calls,triangles=r.info.render.triangles}catch(e){}return out};
if(origSet)r.setPixelRatio=function(v){baseRatio.set(r,v);if("number"==typeof v&&gfx.scale!==1)v*=gfx.scale;return origSet.call(r,v)};
renderer=r,hookedRenderers++;
return r};
window.__ptMakeRenderer=function(o){const K=(function(){try{return n(9437).JeP}catch(e){return null}})();if(!K)throw new Error("renderer class not found");return hookRenderer(new K(o))};
window.__ptGfxProbe=()=>({renderer:!!renderer,hooked:hookedRenderers,three:!!window.__THREE__});
const applyScale=r=>{if(!r)return;try{const base=baseRatio.has(r)?baseRatio.get(r):r.getPixelRatio();baseRatio.set(r,base),r.setPixelRatio(base)}catch(e){}};
const setWireframe=on=>{if(!sceneRef)return;try{sceneRef.traverse((o=>{if(!o||!o.material)return;const list=Array.isArray(o.material)?o.material:[o.material];for(const m of list)if(m&&"wireframe"in m)m.wireframe=on}))}catch(e){}};
x.prototype.update=function(e,t,n,i){
orig.call(this,e,t,n,i);
camCalls++;
const cam=this.camera;
if(gfx.dist!==1&&cam&&cam.position){cam.position.x=t.x+(cam.position.x-t.x)*gfx.dist,cam.position.y=t.y+(cam.position.y-t.y)*gfx.dist,cam.position.z=t.z+(cam.position.z-t.z)*gfx.dist,cam.updateMatrix()}
if(gfx.fov!==1&&cam){cam.fov*=gfx.fov,cam.updateProjectionMatrix()}
target.x=t.x,target.y=t.y,target.z=t.z,
lastCar.x=t.x,lastCar.y=t.y,lastCar.z=t.z,lastCar.t=performance.now(),window.__ptCarPos=function(){return {x:lastCar.x,y:lastCar.y,z:lastCar.z,t:lastCar.t}};
};
const target={x:0,y:0,z:0};
window.__ptCamDbg=()=>({patch:window.__ptCamPatch,yaw:+yaw.toFixed(3),pitch:+pitch.toFixed(3),updateCalls:camCalls,renderer:!!renderer,draws:drawCalls,target:[+target.x.toFixed(2),+target.y.toFixed(2),+target.z.toFixed(2)],cam:camRef&&camRef.position?[+camRef.position.x.toFixed(2),+camRef.position.y.toFixed(2),+camRef.position.z.toFixed(2)]:null});
function orbitTarget(){
if(camCalls)return target;
const cam=camRef,out={x:0,y:0,z:0};
if(!cam||!cam.position)return out;
off.set(0,0,-1).applyQuaternion(cam.quaternion).multiplyScalar(5.5);
out.x=cam.position.x+off.x,out.y=cam.position.y+off.y,out.z=cam.position.z+off.z;
return out}
function applyOrbit(){
const cam=camRef;if(!cam||!cam.position||0===yaw&&0===pitch)return;
const t=orbitTarget();
let ox=cam.position.x-t.x,oy=cam.position.y-t.y,oz=cam.position.z-t.z;
const len=Math.sqrt(ox*ox+oy*oy+oz*oz);if(len<1e-4)return;
const cy=Math.cos(yaw),sy=Math.sin(yaw);
let rx=ox*cy+oz*sy,rz=-ox*sy+oz*cy;
const hd=Math.sqrt(rx*rx+rz*rz);
const ang=Math.max(-1.35,Math.min(1.35,Math.atan2(oy,hd)+pitch));
const hh=Math.cos(ang)*len,vy=Math.sin(ang)*len,k2=hd>1e-5?hh/hd:0;
cam.position.set(t.x+rx*k2,t.y+Math.max(.25,vy),t.z+rz*k2);
cam.lookAt(t.x,t.y+.9,t.z);
cam.updateMatrix();
}
const lastCar={x:0,y:0,z:0,t:0,prevX:0,prevY:0,prevZ:0,prevT:0,speed:0};

/* ---------- HUD overlays ---------- */
let barEl=null,barFill=null,barText=null,keysEl=null,cheatStatEl=null,cheatStatAt=0;
function updateCheatStat(){if(!cheatStatEl)return;const t=performance.now();if(t-cheatStatAt<250)return;cheatStatAt=t;const s=window.__ptAckStats;
if(!s){cheatStatEl.textContent="Waiting for live telemetry...";return}
cheatStatEl.textContent="Live: "+(s.frames?((s.factor>1?"physics "+s.factor.toFixed(2)+"\u00d7":"stock engine")+", "+s.grip+" grip fixes"):"no car detected")+(s.kmh?" \u00b7 "+s.kmh+" km/h":"")}
function buildHud(){
if(!barEl){
barEl=el("div");barEl.id="pt-progress";
const track=el("div","pt-pbar");barFill=el("div","pt-pfill");track.appendChild(barFill);
barText=el("span","pt-ptext","0%");
barEl.appendChild(track);barEl.appendChild(barText);document.body.appendChild(barEl)}
if(!keysEl){keysEl=el("div");keysEl.id="pt-keys";document.body.appendChild(keysEl)}
barEl.style.display=hud.progress?"":"none";
keysEl.style.display=hud.keys?"":"none";
}
let lastProgress=-1;
function updateProgress(){
if(!hud.progress||!barEl)return;
const span=document.querySelector(".checkpoint-ui span");
let frac=null,label="";
if(span){const m=/^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(span.textContent||"");if(m){const a=Number(m[1]),b=Number(m[2]);if(b>0){frac=Math.max(0,Math.min(1,a/b));label=a+" / "+b}}}
const pct=null==frac?null:Math.round(frac*100);
if(pct!==lastProgress){lastProgress=pct;barFill.style.width=(null==pct?0:pct)+"%";barText.textContent=null==pct?"\u2014":pct+"%";barEl.classList.toggle("stale",null==pct)}
barEl.title=label?label:"No checkpoint data"
}
let keysSig="";
function updateKeyHud(){
if(!hud.keys||!keysEl)return;
const held=Object.keys(keys).filter(k=>keys[k]);
held.sort();
const sig=held.join(",");
if(sig===keysSig)return;
keysSig=sig;keysEl.textContent="";
for(const code of held){keysEl.appendChild(el("span","pt-chip",keyLabel(code)))}
}

/* ---------- frame loop ---------- */
let frames=0,fps=0,fpsAt=0,lastFrame=0,frameMs=0,debugEls=null;
function loop(now){
const dt=Math.max(0,Math.min((now-(loop.prev||now))/1000,.1));loop.prev=now;
if(pad.left||pad.right||pad.up||pad.down||keys[bind.left]||keys[bind.right]||keys[bind.up]||keys[bind.down]){
(pad.left||keys[bind.left])&&(yaw+=rate*dt),(pad.right||keys[bind.right])&&(yaw-=rate*dt),
(pad.up||keys[bind.up])&&(pitch=Math.min(limit,pitch+rate*dt)),(pad.down||keys[bind.down])&&(pitch=Math.max(-limit,pitch-rate*dt))}
frames++;
if(lastFrame)frameMs=frameMs*0.85+(now-lastFrame)*0.15;
lastFrame=now;
if(!fpsAt)fpsAt=now;
if(now-fpsAt>=500){fps=Math.round(frames*1e3/(now-fpsAt));frames=0;fpsAt=now}
if(hud.progress)updateProgress();
if(hud.keys)updateKeyHud();
if(now-(loop.lastSlow||0)>120){loop.lastSlow=now;if(debugEls)fillDebug();updateCheatStat()}
requestAnimationFrame(loop);
}

/* ---------- helpers ---------- */
function el(tag,cls,text){const d=document.createElement(tag);cls&&(d.className=cls),null!=text&&(d.textContent=text);return d}
function applyOpen(){panel&&(panel.style.display=open?"":"none",open&&applyLayout())}
function syncCamHint(){if(!camHintEl)return;camHintEl.textContent="Hold the arrows above or IJKL to orbit. Press "+keyLabel(bind.menu)+" to open or close PolyMod; "+keyLabel(bind.resetCam)+" recentres the view."}
function render(){if(!panel)return;for(const b of panel.querySelectorAll("[data-act]")){const a=b.dataset.act;b.textContent=capture===a?"Press a key\u2026":keyLabel(bind[a]);b.classList.toggle("capturing",capture===a)}syncCamHint()}
function showTab(name){for(const t of tabs){const on=t.name===name;t.btn.classList.toggle("active",on),t.pane.style.display=on?"":"none",on&&(t.built||(t.build(t.pane),t.built=!0),tabHooks[name]&&tabHooks[name]())}}
function addTab(name,build){const btn=el("button","pt-tab",name);btn.type="button",btn.addEventListener("click",(e=>{e.preventDefault(),showTab(name)}));tabBar.appendChild(btn);const pane=el("div","pt-pane");pane.style.display="none",panelBody.appendChild(pane),tabs.push({name:name,btn:btn,pane:pane,build:build,built:!1})}

/* ---------- Camera tab ---------- */
function buildCameraTab(pane){
const padBox=el("div","pt-pad");
const mkPad=(act,glyph,title)=>{const b=el("button","pt-padbtn",glyph);b.type="button",b.title=title;
const on=e=>{e.preventDefault(),pad[act]=!0,b.classList.add("down")};
const stopPad=()=>{pad[act]=!1,b.classList.remove("down")};
b.addEventListener("pointerdown",on),b.addEventListener("pointerup",stopPad),b.addEventListener("pointerleave",stopPad),b.addEventListener("pointercancel",stopPad);
return b};
padBox.appendChild(el("div","pt-padbtn empty")),padBox.appendChild(mkPad("up","\u25b2","Orbit up")),padBox.appendChild(el("div","pt-padbtn empty")),
padBox.appendChild(mkPad("left","\u25c0","Orbit left")),padBox.appendChild(mkPad("down","\u25bc","Orbit down")),padBox.appendChild(mkPad("right","\u25b6","Orbit right"));
pane.appendChild(padBox);
for(const pair of ACTIONS){
const act=pair[0],row=el("div","pt-row");
row.appendChild(el("span","pt-label",pair[1]));
const b=el("button","pt-key");b.type="button",b.dataset.act=act,b.title="Click, then press a key";
b.addEventListener("click",(e=>{e.preventDefault(),e.stopPropagation(),capture=act,render()}));
row.appendChild(b),pane.appendChild(row)}
const rc=el("button","pt-wide","Reset camera");rc.type="button",rc.addEventListener("click",(e=>{e.preventDefault(),yaw=0,pitch=0})),pane.appendChild(rc);
const rk=el("button","pt-wide pt-secondary","Restore default keys");rk.type="button",rk.addEventListener("click",(e=>{e.preventDefault(),Object.assign(bind,DEFAULTS),save(),render()})),pane.appendChild(rk);
camHintEl=el("div","pt-hint","");pane.appendChild(camHintEl),syncCamHint()
}

/* ---------- Replays tab ---------- */
const activeSlot=()=>{try{const raw=localStorage.getItem("polytrack_v5_prod_user_slot");if(null==raw)return null;let v=JSON.parse(raw);"string"==typeof v&&(v=Number(v));return Number.isSafeInteger(v)?v:null}catch(e){return null}};
function listRecords(){
const items=[],cur=activeSlot();
try{for(const key of Object.keys(localStorage)){
const m=RECORD_RE.exec(key);if(!m)continue;
if(null!==cur&&Number(m[2])!==cur)continue;
let v=null;try{v=JSON.parse(localStorage.getItem(key)||"null")}catch(e){}
const frames=v&&"number"==typeof v.frames&&isFinite(v.frames)?v.frames:null;
const recording=v&&"string"==typeof v.recording?v.recording:"";
const id=m[4].toLowerCase();
items.push({name:TRACK_NAMES[id]||"Track "+id.slice(0,8),slot:Number(m[2]),kind:m[3],prefix:m[1],frames:frames,size:recording.length,recording:recording,id:id,best:!0,at:0})}}catch(e){}
for(const h of listHistory()){
if(null!==cur&&h.slot!==cur)continue;
items.push({name:TRACK_NAMES[h.id]||"Track "+h.id.slice(0,8),slot:h.slot,kind:h.kind,prefix:h.prefix,frames:h.frames,size:h.recording.length,recording:h.recording,id:h.id,best:!1,at:h.at})}
items.sort((a,b)=>a.name===b.name?((null==a.frames?1e15:a.frames)-(null==b.frames?1e15:b.frames)||(a.best===b.best?0:a.best?-1:1)):(a.name<b.name?-1:1));
return items}
function buildReplaysTab(pane){
const head=el("div","pt-row");
const count=el("span","pt-count","Loading\u2026");
const filt=el("button","pt-mini","This track");filt.type="button",filt.title="Show only the track you are on";
const rfr=el("button","pt-mini","Refresh");rfr.type="button";
head.appendChild(count),head.appendChild(filt),head.appendChild(rfr),pane.appendChild(head);
const list=el("div","pt-list");pane.appendChild(list);
replayStatus=el("div","pt-status","");pane.appendChild(replayStatus);pane.appendChild(el("div","pt-hint","Replays re-simulate the recorded controls with the physics the game is running now, so a run recorded at a different Car speed (or before a speed change) will not reproduce exactly \u2014 re-record it with the setting you want to watch. The race clock and finish line use that same physics."));
const setStatus=t=>{replayStatus.textContent=t||"";replayStatus.classList.toggle("on",!!t)};
const paint=()=>{
const all=listRecords(),cur=activeSlot(),curId=curTrack.id;
const items=trackFilter.on&&curId?all.filter((it=>it.id===curId)):all;
const tname=curId?TRACK_NAMES[curId]||"Track "+curId.slice(0,8):null;
filt.textContent=trackFilter.on?"This track":"All tracks",filt.classList.toggle("active",trackFilter.on);
count.textContent=items.length+(1===items.length?" replay":" replays")+(null!==cur?" \u00b7 "+profileName("polytrack_v5_prod_",cur):"")+(trackFilter.on&&tname?" \u00b7 "+tname:"");
list.textContent="";
if(!items.length){list.appendChild(el("div","pt-empty",trackFilter.on&&curId?"No replays stored for this track yet.":"No stored replays yet."));return}
for(const it of items){
const row=el("div","pt-replay"),top=el("div","pt-rtop");
top.appendChild(el("span","pt-rname",it.name));
top.appendChild(el("span","pt-rtime",null==it.frames?"\u2014":fmtTime(it.frames)));
const play=el("button","pt-play","\u25b6");play.type="button";play.title="Replay this run";
play.addEventListener("click",(e=>{e.preventDefault(),e.stopPropagation(),startReplay(it,setStatus)}));
top.appendChild(play);
row.appendChild(top);
row.appendChild(el("div","pt-rmeta",profileName(it.prefix,it.slot)+" \u00b7 "+it.kind+" \u00b7 "+fmtSize(it.size)+(it.best?"":" \u00b7 older run")));
row.title=it.name+"\n"+it.id;
list.appendChild(row)} };
const draw=()=>{drawBusy++;try{paint()}catch(e){}finally{drawBusy--}curTrack.pending&&(curTrack.pending=0,setTimeout(draw,0))};
tabHooks.Replays=draw;
rfr.addEventListener("click",(e=>{e.preventDefault(),draw()}));
filt.addEventListener("click",(e=>{e.preventDefault(),trackFilter.on=!trackFilter.on,draw()}));
draw()}

async function startReplay(it,setStatus){
setStatus("Loading track\u2026");
try{
if(typeof window.__ptStartReplay!=="function")throw new Error("replay hook missing");
let text=null,category="official";
if(OFFICIAL[it.id]){const res=await fetch(OFFICIAL[it.id].url);if(!res.ok)throw new Error("track file not found");text=await res.text()}
else{
const pfx="polytrack_v5_prod_track_";
for(const k of Object.keys(localStorage)){
if(k.indexOf(pfx)!==0)continue;
try{const v=JSON.parse(localStorage.getItem(k)||"null");if(!v||"string"!=typeof v.data)continue;
const parsed=n(9117).A.fromExportString(v.data);
if(parsed&&parsed.trackData&&"function"==typeof parsed.trackData.getId&&parsed.trackData.getId()===it.id){text=v.data,category="custom";break}}catch(e){}}
}
if(!text)throw new Error("no track file for this replay");
const parsed=n(9117).A.fromExportString(text);
if(!parsed||!parsed.trackData)throw new Error("could not parse track");
const rec=n(1754).A.deserialize(it.recording);
if(!rec)throw new Error("invalid recording data");
open=!1,applyOpen();
const ok=window.__ptStartReplay(parsed.trackMetadata,parsed.trackData,category,it.slot,rec,it.frames||0);
setStatus(ok?"Replay started":"Replay failed (hook error)");
}catch(e){console.warn("pt replay:",e),setStatus("Replay failed: "+e.message)}
}

/* ---------- HUD tab ---------- */
function toggleRow(pane,label,get,set){
const row=el("div","pt-row"),b=el("button","pt-toggle");b.type="button";
const sync=()=>{const on=!!get();b.textContent=on?"On":"Off";b.classList.toggle("on",on)};
b.addEventListener("click",(e=>{e.preventDefault(),set(!get()),sync(),buildHud()}));
sync(),row.appendChild(el("span","pt-label",label)),row.appendChild(b),pane.appendChild(row);return sync}
function buildHudTab(pane){
toggleRow(pane,"Progress bar (top)",()=>hud.progress,(v)=>{hud.progress=v,saveHud(),lastProgress=-1});
toggleRow(pane,"Pressed keys overlay",()=>hud.keys,(v)=>{hud.keys=v,saveHud(),keysSig=""});
pane.appendChild(el("div","pt-hint","Progress uses the game's checkpoint counter; it hides outside a race."))
}

/* ---------- Graphics tab ---------- */
const sliderRefs={};
function sliderRow(pane,label,min,max,step,get,set){
const row=el("div","pt-row"),wrap=el("div","pt-sliderwrap");
const range=el("input");range.type="range",range.min=String(min),range.max=String(max),range.step=String(step),range.value=String(get());
const val=el("span","pt-val",String(get()));
sliderRefs[label]=range;
range.addEventListener("input",(()=>{const v=Number(range.value);set(v),val.textContent=v.toFixed(step<1?2:0),saveGfx(),"Render scale"===label&&(gfx.aa=aaPick(),aaSync())}));
wrap.appendChild(range),wrap.appendChild(val);
row.appendChild(el("span","pt-label",label)),row.appendChild(wrap),pane.appendChild(row)}
const AAMODES=[["game","Game"],["off","Off"],["msaa","MSAA"],["ssaa15","SSAA 1.5\u00d7"],["ssaa2","SSAA 2\u00d7"]];
let aaStatusEl=null,aaButtons=null;
function aaPick(){const s=+gfx.scale||1;if("off"===gfx.aa||"msaa"===gfx.aa||"game"===gfx.aa)return gfx.aa;return s>=1.95?"ssaa2":s>=1.4?"ssaa15":"game"}
function aaSync(){
if(!aaStatusEl)return;
const cur=aaPick(),label={game:"game setting",off:"off",msaa:"on (forced)",ssaa15:"SSAA 1.5\u00d7",ssaa2:"SSAA 2\u00d7"};
if(aaButtons)for(const k in aaButtons)aaButtons[k].classList.toggle("active",k===cur);
let ctx="no renderer yet";
try{const gl=renderer&&renderer.getContext?renderer.getContext():null;
if(gl){const a=gl.getContextAttributes?gl.getContextAttributes():null;let n=0;try{n=gl.getParameter(gl.SAMPLES)||0}catch(e){}
ctx=a&&a.antialias?"context MSAA on"+(n?", "+n+"\u00d7":""):"context MSAA off"}}catch(e){}
aaStatusEl.textContent="PolyMod: "+(label[cur]||cur)+" \u00b7 "+ctx+" \u00b7 game setting "+(window.__ptGameAA===!1?"off":"on")}
function setAA(m){
gfx.aa=m;
if("ssaa15"===m)gfx.scale=1.5;else if("ssaa2"===m)gfx.scale=2;
saveGfx();
try{applyScale(renderer)}catch(e){}
const sr=sliderRefs["Render scale"];if(sr){sr.value=String(gfx.scale);const v=sr.parentNode&&sr.parentNode.querySelector(".pt-val");v&&(v.textContent=gfx.scale.toFixed(2))}
aaSync()}
function buildGraphicsTab(pane){
const aarow=el("div","pt-row");aarow.appendChild(el("span","pt-label","Antialiasing"));
const seg=el("div","pt-seg");aaButtons={};
for(const pair of AAMODES){const b=el("button","pt-segbtn",pair[1]);b.type="button";b.dataset.aa=pair[0];
b.addEventListener("click",(e=>{e.preventDefault(),setAA(pair[0])}));aaButtons[pair[0]]=b;seg.appendChild(b)}
aarow.appendChild(seg);pane.appendChild(aarow);
aaStatusEl=el("div","pt-hint","");pane.appendChild(aaStatusEl);
pane.appendChild(el("div","pt-hint","Game keeps PolyTrack's own Antialiasing setting. Off and MSAA change the WebGL context, so they take effect after a restart. SSAA renders at a higher resolution and downsamples immediately; it stacks with MSAA."));
toggleRow(pane,"Wireframe",()=>gfx.wireframe,(v)=>{gfx.wireframe=v,setWireframe(v)});
sliderRow(pane,"Render scale",0.5,2,0.05,()=>gfx.scale,(v)=>{gfx.scale=v,applyScale(renderer)});
sliderRow(pane,"FOV",0.6,1.8,0.05,()=>gfx.fov,(v)=>{gfx.fov=v});
sliderRow(pane,"Camera distance",0.5,3,0.05,()=>gfx.dist,(v)=>{gfx.dist=v});
const row=el("div","pt-row");const info=el("span","pt-meta","");
const syncInfo=()=>{info.textContent=renderer?(Math.round(drawCalls)+" draws"):"no renderer yet"};
row.appendChild(info);pane.appendChild(row);
const btn=el("button","pt-wide pt-secondary","Reapply");btn.type="button";
btn.addEventListener("click",(e=>{e.preventDefault(),applyScale(renderer),setWireframe(gfx.wireframe),syncInfo(),aaSync()}));
pane.appendChild(btn);
aaSync();
tabHooks.Graphics=()=>{syncInfo(),aaSync()};
}

/* ---------- Cheats tab ---------- */
function buildCheatsTab(pane){
sliderRow(pane,"Car speed",1,3,0.05,()=>cheat.speed,(v)=>{cheat.speed=v,saveCheat(),syncCheat()});
sliderRow(pane,"Car grip",0.25,2,0.05,()=>cheat.grip,(v)=>{cheat.grip=v,saveCheat(),syncCheat()});
pane.appendChild(el("div","pt-hint","Ghost cars replay a recorded run frame by frame, so a ghost already moves at whatever speed that run was driven at. No extra multiplier is applied, and a run recorded at 2\u00d7 looks 2\u00d7 fast."));
const reset=el("button","pt-wide pt-secondary","Reset to defaults");reset.type="button";
reset.addEventListener("click",(e=>{e.preventDefault(),cheat.speed=1,cheat.grip=1,cheat.others=!1,saveCheat(),syncCheat();
for(const w of pane.querySelectorAll(".pt-sliderwrap")){w.querySelector("input").value="1";w.querySelector(".pt-val").textContent="1.00"}}));
pane.appendChild(reset);
pane.appendChild(el("div","pt-hint","Car speed raises the engine force inside the physics module, so acceleration and top speed scale while the race clock, checkpoints and every other car keep real timing. PolyTrack builds the physics module once at launch, so a new speed takes effect the next time you start the game. The engine force applies to every car simulated in that module, so rivals get it too. Grip above 1 makes the car resist sliding, below 1 lets it drift wide. Ghost cars replay a recorded run, so no extra multiplier is applied to them. Active while driving, not during replay playback."));cheatStatEl=el("div","pt-hint","Waiting for live telemetry..."),pane.appendChild(cheatStatEl)
}

/* ---------- Debug tab ---------- */
function fillDebug(){
if(!debugEls)return;
const d=debugEls;
d.fps.textContent=String(fps);
d.ms.textContent=frameMs.toFixed(1)+" ms";
d.draws.textContent=String(drawCalls);
d.tris.textContent=String(triangles);
d.car.textContent=lastCar.x.toFixed(1)+", "+lastCar.y.toFixed(1)+", "+lastCar.z.toFixed(1);
d.cam.textContent=Math.round(yaw*57.2958)+"\u00b0 / "+Math.round(pitch*57.2958)+"\u00b0";
d.res.textContent=renderer&&renderer.getPixelRatio?renderer.getPixelRatio().toFixed(2)+"x":"\u2014";
d.keys.textContent=Object.keys(keys).filter(k=>keys[k]).length+" held";d.stall.textContent=window.__ptStallTrace?"frame "+window.__ptStallTrace.at[0]+" | "+window.__ptStallTrace.at[1]+" km/h":"none";
}
function buildDebugTab(pane){
debugEls={};
const rows=[["fps","FPS"],["ms","Frame"],["draws","Draw calls"],["tris","Triangles"],["car","Car pos"],["cam","Yaw / pitch"],["res","Pixel ratio"],["keys","Inputs"],["stall","Stall trace"]];
for(const pair of rows){const row=el("div","pt-row");row.appendChild(el("span","pt-label",pair[1]));const v=el("span","pt-meta","\u2014");debugEls[pair[0]]=v;row.appendChild(v);pane.appendChild(row)}
const copy=el("button","pt-wide","Copy diagnostics");copy.type="button";
copy.addEventListener("click",(e=>{e.preventDefault();const data={fps:fps,frameMs:+frameMs.toFixed(2),drawCalls:drawCalls,triangles:triangles,car:{x:lastCar.x,y:lastCar.y,z:lastCar.z},yaw:yaw,pitch:pitch,stall:window.__ptStallTrace||null,ack:window.__ptAckStats||null,rec:window.__ptRecStat||null,pixelRatio:renderer&&renderer.getPixelRatio?renderer.getPixelRatio():null,scale:gfx.scale,fov:gfx.fov,dist:gfx.dist,wireframe:gfx.wireframe,panel:window.__ptCamPatch,ua:navigator.userAgent};
const text=JSON.stringify(data,null,2);
try{navigator.clipboard.writeText(text).then((()=>{copy.textContent="Copied"}),(function(){copy.textContent="Copy failed (console)"}))}catch(err){copy.textContent="Copy failed (console)"}
console.log("[pt debug]",text)}));
pane.appendChild(copy);
fillDebug();
tabHooks.Debug=fillDebug;
}

/* ---------- Help tab ---------- */
function buildHelpTab(pane){
const head=t=>pane.appendChild(el("div","pt-help-h",t));
const para=t=>pane.appendChild(el("div","pt-help-p",t));
head("Getting started");
para("Press "+keyLabel(bind.menu)+" at any time to open or close PolyMod. It works in menus and while driving, and it starts closed. Drag the title bar to move the window, drag the bottom-right corner to resize it, and rebind both hotkeys under Camera.");
para("PolyMod is a local overlay: nothing is uploaded, every setting is stored in this game's local storage, and replays are listed for the profile slot that is active.");
head("Tabs");
para("Camera \u2014 orbit with IJKL or the arrow pad, and click any key button to rebind it, including the menu key and the view-reset key. Reset camera clears the orbit offset.");
para("Replays \u2014 the runs stored for your profile. \u25b6 loads that run's track and plays it back in game.");
para("HUD \u2014 a progress bar driven by the game's checkpoint counter, and a pressed-keys overlay.");
para("Graphics \u2014 antialiasing, wireframe, render scale, FOV and camera distance. All of it applies live; Reapply is there after a resolution change.");
para("Cheats \u2014 car speed and grip. Reset to defaults returns to 1\u00d7 speed and 1\u00d7 grip.");
para("Debug \u2014 FPS, frame time, draw calls, car position, and Copy diagnostics for bug reports.");
head("Antialiasing");
para("Game follows PolyTrack's own Antialiasing setting, so the in-game toggle keeps working. Off and MSAA override the WebGL context and only take effect after restarting the game. SSAA 1.5\u00d7 and 2\u00d7 render larger and downsample, which is instant and can be combined with MSAA. On a weak GPU use SSAA 1.5\u00d7, or leave the render scale near 1.00.");
head("Before you race");
para("Cheated runs will not verify. Leaderboard submissions replay your inputs, so a run made with speed or grip changes gets rejected. Use the Cheats tab for practice and reset it before a real attempt.");
para("Back up your profile before testing anything new. PolyMod stores its settings under ptCamBindings, ptGfx, ptHud, ptCheats, ptPanel and ptSeenHelp.");
}

/* ---------- panel layout: drag + resize ---------- */
const layout=Object.assign({x:null,y:null,w:null,h:null},(function(){try{const v=JSON.parse(localStorage.getItem(PANELKEY)||"null");return v&&"object"==typeof v?v:{}}catch(e){return{}}})());
const saveLayout=()=>persist(PANELKEY,{x:layout.x,y:layout.y,w:layout.w,h:layout.h});
let dragGrab=null,resizeGrab=null;
const clampNum=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
function applyLayout(){
if(!panel)return;
if(null!=layout.w)panel.style.width=Math.round(clampNum(+layout.w||540,360,Math.max(360,innerWidth-16)))+"px";
if(null!=layout.h)panel.style.height=Math.round(clampNum(+layout.h||400,240,Math.max(240,innerHeight-16)))+"px";
if(null!=layout.x&&null!=layout.y){
const w=panel.offsetWidth||540,h=panel.offsetHeight||400;
layout.x=Math.round(clampNum(+layout.x||0,0,Math.max(0,innerWidth-w))),layout.y=Math.round(clampNum(+layout.y||0,0,Math.max(0,innerHeight-h)));
panel.style.transform="none",panel.style.left=layout.x+"px",panel.style.top=layout.y+"px"
}else panel.style.left="50%",panel.style.top="50%",panel.style.transform="translate(-50%,-50%)"
}
function startDrag(e){
if(e.button>0||(e.target&&e.target.closest&&e.target.closest("button")))return;
const r=panel.getBoundingClientRect();
dragGrab={dx:e.clientX-r.left,dy:e.clientY-r.top};
layout.w=Math.round(r.width),layout.h=Math.round(r.height);
panel.style.width=layout.w+"px",panel.style.height=layout.h+"px",panel.style.transform="none";
try{e.currentTarget.setPointerCapture(e.pointerId)}catch(err){}
e.preventDefault()}
function moveDrag(e){
if(!dragGrab)return;
const w=layout.w||panel.offsetWidth,h=layout.h||panel.offsetHeight;
layout.x=Math.round(clampNum(e.clientX-dragGrab.dx,0,Math.max(0,innerWidth-w)));
layout.y=Math.round(clampNum(e.clientY-dragGrab.dy,0,Math.max(0,innerHeight-h)));
panel.style.left=layout.x+"px",panel.style.top=layout.y+"px"}
function endDrag(e){if(!dragGrab)return;dragGrab=null;try{e.currentTarget.releasePointerCapture(e.pointerId)}catch(err){}saveLayout()}
function startResize(e){
e.preventDefault(),e.stopPropagation();
const r=panel.getBoundingClientRect();
if(null==layout.x||null==layout.y){layout.x=Math.round(r.left),layout.y=Math.round(r.top),panel.style.transform="none",panel.style.left=layout.x+"px",panel.style.top=layout.y+"px"}
resizeGrab={x:e.clientX,y:e.clientY,w:r.width,h:r.height};
try{e.currentTarget.setPointerCapture(e.pointerId)}catch(err){}}
function moveResize(e){
if(!resizeGrab)return;
layout.w=Math.round(clampNum(resizeGrab.w+(e.clientX-resizeGrab.x),360,Math.max(360,innerWidth-16)));
layout.h=Math.round(clampNum(resizeGrab.h+(e.clientY-resizeGrab.y),240,Math.max(240,innerHeight-16)));
panel.style.width=layout.w+"px",panel.style.height=layout.h+"px"}
function endResize(e){if(!resizeGrab)return;resizeGrab=null;try{e.currentTarget.releasePointerCapture(e.pointerId)}catch(err){}saveLayout()}
window.addEventListener("resize",(()=>{null!=layout.x&&applyLayout()}));

/* ---------- panel ---------- */
function buildUI(){
if(document.getElementById("pt-mod-panel"))return;
const css=document.createElement("style");
css.textContent=`#pt-mod-panel{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483647;width:min(540px,92vw);max-height:88vh;overflow:hidden;padding:14px 16px;box-sizing:border-box;border-radius:6px;background:rgba(17,32,82,.94);color:#fff;font-family:inherit;font-size:15px;box-shadow:0 12px 38px rgba(0,0,0,.55);user-select:none;-webkit-user-select:none;display:flex;flex-direction:column}
#pt-mod-panel .pt-head{cursor:grab;touch-action:none}
#pt-mod-panel .pt-head:active{cursor:grabbing}
#pt-mod-panel .pt-resize{position:absolute;right:3px;bottom:3px;width:16px;height:16px;cursor:nwse-resize;touch-action:none;border-radius:2px;background:linear-gradient(135deg,transparent 0 42%,rgba(255,255,255,.4) 42% 54%,transparent 54% 100%)}
#pt-mod-panel .pt-head{display:flex;align-items:center;justify-content:space-between;margin:0 0 6px;cursor:grab;touch-action:none}
#pt-mod-panel .pt-title{font-size:13px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;opacity:.85}
#pt-mod-panel .pt-close{padding:0 2px;border:0;background:none;color:#fff;font:inherit;font-size:16px;line-height:1;cursor:pointer;opacity:.7}
#pt-mod-panel .pt-close:hover{opacity:1}
#pt-mod-panel .pt-tabs{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 6px}
#pt-mod-panel .pt-tab{flex:1 1 auto;padding:6px 8px;border:0;border-radius:3px;background:rgba(255,255,255,.08);color:#fff;font:inherit;font-size:12px;cursor:pointer}
#pt-mod-panel .pt-tab:hover{background:rgba(255,255,255,.16)}
#pt-mod-panel .pt-tab.active{background:rgba(255,255,255,.26)}
#pt-mod-panel .pt-pane{display:block}
#pt-mod-panel .pt-pane-wrap{flex:1 1 auto;min-height:0;overflow:auto;margin-top:2px}
#pt-mod-panel .pt-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:3px 0}
#pt-mod-panel .pt-label{opacity:.9;font-size:14px}
#pt-mod-panel .pt-key{min-width:78px;padding:4px 6px;border:1px solid rgba(255,255,255,.2);border-radius:3px;background:rgba(0,0,0,.28);color:#fff;font:inherit;font-size:12px;cursor:pointer}
#pt-mod-panel .pt-key:hover{background:rgba(0,0,0,.42)}
#pt-mod-panel .pt-key.capturing{border-color:#ffd453;color:#ffd453}
#pt-mod-panel .pt-wide{display:block;width:100%;margin-top:6px;padding:5px;border:0;border-radius:3px;background:rgba(255,255,255,.14);color:#fff;font:inherit;font-size:12px;cursor:pointer}
#pt-mod-panel .pt-wide:hover{background:rgba(255,255,255,.22)}
#pt-mod-panel .pt-secondary{background:rgba(255,255,255,.06)}
#pt-mod-panel .pt-hint{margin-top:6px;font-size:11px;line-height:1.4;opacity:.62}
#pt-mod-panel .pt-seg{display:flex;flex-wrap:wrap;gap:3px;justify-content:flex-end;max-width:330px}
#pt-mod-panel .pt-segbtn{padding:3px 8px;border:0;border-radius:3px;background:rgba(255,255,255,.1);color:#fff;font:inherit;font-size:11px;cursor:pointer}
#pt-mod-panel .pt-segbtn:hover{background:rgba(255,255,255,.2)}
#pt-mod-panel .pt-segbtn.active{background:rgba(127,182,255,.42);box-shadow:inset 0 0 0 1px rgba(127,182,255,.85)}
#pt-mod-panel .pt-help-h{margin:10px 0 2px;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;opacity:.8}
#pt-mod-panel .pt-help-h:first-child{margin-top:0}
#pt-mod-panel .pt-help-p{margin:0 0 5px;font-size:12px;line-height:1.45;opacity:.85}
#pt-mod-panel .pt-count{font-size:12px;opacity:.8}
#pt-mod-panel .pt-mini{padding:3px 8px;border:0;border-radius:3px;background:rgba(255,255,255,.14);color:#fff;font:inherit;font-size:11px;cursor:pointer}
#pt-mod-panel .pt-mini:hover{background:rgba(255,255,255,.24)}
#pt-mod-panel .pt-list{max-height:38vh;overflow:auto;margin-top:2px}
#pt-mod-panel .pt-list::-webkit-scrollbar{width:6px}
#pt-mod-panel .pt-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.25);border-radius:3px}
#pt-mod-panel .pt-replay{padding:4px 2px;border-bottom:1px solid rgba(255,255,255,.08)}
#pt-mod-panel .pt-replay:last-child{border-bottom:0}
#pt-mod-panel .pt-rtop{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
#pt-mod-panel .pt-rname{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#pt-mod-panel .pt-rtime{font-size:12px;font-variant-numeric:tabular-nums;opacity:.9;margin-left:auto}
#pt-mod-panel .pt-play{padding:1px 7px;border:0;border-radius:3px;background:rgba(120,200,255,.22);color:#fff;font:inherit;font-size:10px;line-height:1.5;cursor:pointer}
#pt-mod-panel .pt-play:hover{background:rgba(120,200,255,.4)}
#pt-mod-panel .pt-rmeta{font-size:10px;opacity:.55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#pt-mod-panel .pt-status{margin-top:6px;font-size:10px;line-height:1.3;opacity:0;transition:opacity .15s}
#pt-mod-panel .pt-status.on{opacity:.85}
#pt-mod-panel .pt-toggle{min-width:56px;padding:4px 8px;border:1px solid rgba(255,255,255,.2);border-radius:3px;background:rgba(0,0,0,.28);color:#fff;font:inherit;font-size:12px;cursor:pointer}
#pt-mod-panel .pt-toggle.on{border-color:#7fe08a;color:#7fe08a;background:rgba(127,224,138,.12)}
#pt-mod-panel .pt-sliderwrap{display:flex;align-items:center;gap:6px}
#pt-mod-panel .pt-sliderwrap input[type=range]{-webkit-appearance:none!important;appearance:none!important;width:104px!important;height:14px!important;min-height:14px!important;max-height:14px!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;outline:0}
#pt-mod-panel .pt-sliderwrap input[type=range]::-webkit-slider-runnable-track{height:6px!important;border:0!important;border-radius:3px!important;background:rgba(255,255,255,.22)!important}
#pt-mod-panel .pt-sliderwrap input[type=range]::-webkit-slider-thumb{-webkit-appearance:none!important;appearance:none!important;width:12px!important;height:12px!important;margin-top:-3px!important;border:0!important;border-radius:50%!important;background:#7fb6ff!important;box-shadow:0 1px 2px rgba(0,0,0,.5)!important;cursor:pointer}
#pt-mod-panel .pt-pad{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,26px);gap:4px;margin:2px 0 6px}
#pt-mod-panel .pt-padbtn{padding:0;border:0;border-radius:3px;background:rgba(255,255,255,.1);color:#fff;font:inherit;font-size:13px;line-height:1;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none}
#pt-mod-panel .pt-padbtn:hover{background:rgba(255,255,255,.18)}
#pt-mod-panel .pt-padbtn.down{background:rgba(127,182,255,.4)}
#pt-mod-panel .pt-padbtn.empty{visibility:hidden;pointer-events:none}
#pt-mod-panel .pt-val{font-size:11px;opacity:.8;min-width:34px;text-align:right;font-variant-numeric:tabular-nums}
#pt-mod-panel .pt-meta{font-size:12px;font-variant-numeric:tabular-nums;opacity:.9}
#pt-progress{position:fixed;top:calc(6px + var(--safe-area-vertical,0px));left:50%;transform:translateX(-50%);z-index:2147483600;display:flex;align-items:center;gap:8px;width:min(60vw,620px);pointer-events:none;font-family:inherit;color:#fff}
#pt-progress .pt-pbar{position:relative;flex:1;height:9px;border-radius:5px;background:rgba(10,20,45,.55);box-shadow:0 1px 4px rgba(0,0,0,.4);overflow:hidden}
#pt-progress .pt-pfill{height:100%;width:0%;border-radius:5px;background:linear-gradient(90deg,#63d2ff,#7fe08a);transition:width .18s ease-out}
#pt-progress .pt-ptext{font-size:11px;font-variant-numeric:tabular-nums;text-shadow:0 1px 3px rgba(0,0,0,.6);min-width:36px;text-align:left}
#pt-progress.stale{opacity:.45}
#pt-keys{position:fixed;left:calc(10px + var(--safe-area-horizontal,0px));bottom:calc(10px + var(--safe-area-vertical,0px));z-index:2147483600;display:flex;flex-wrap:wrap;gap:4px;max-width:40vw;pointer-events:none;font-family:inherit}
#pt-keys .pt-chip{padding:2px 7px;border-radius:4px;background:rgba(10,20,45,.6);border:1px solid rgba(255,255,255,.18);color:#fff;font-size:12px;font-variant-numeric:tabular-nums;box-shadow:0 1px 4px rgba(0,0,0,.35)}`;
document.head.appendChild(css);
panel=el("div");panel.id="pt-mod-panel";panel.style.display="none";
const head=el("div","pt-head");head.appendChild(el("span","pt-title","PolyMod"));
const close=el("button","pt-close","\u00d7");close.type="button",close.title="Close (Right Shift)",close.addEventListener("click",(e=>{e.preventDefault(),open=!1,applyOpen()}));
head.appendChild(close),panel.appendChild(head);
tabBar=el("div","pt-tabs"),panelBody=el("div","pt-pane-wrap"),panel.appendChild(tabBar),panel.appendChild(panelBody);
document.body.appendChild(panel);
const grip=el("div","pt-resize");grip.title="Drag to resize";panel.appendChild(grip);
head.addEventListener("pointerdown",startDrag),head.addEventListener("pointermove",moveDrag),head.addEventListener("pointerup",endDrag),head.addEventListener("pointercancel",endDrag);
grip.addEventListener("pointerdown",startResize),grip.addEventListener("pointermove",moveResize),grip.addEventListener("pointerup",endResize),grip.addEventListener("pointercancel",endResize);
applyLayout();
buildHud();
addTab("Camera",buildCameraTab);
addTab("Replays",buildReplaysTab);
addTab("HUD",buildHudTab);
addTab("Graphics",buildGraphicsTab);
addTab("Cheats",buildCheatsTab);
addTab("Help",buildHelpTab);
addTab("Debug",buildDebugTab);
let seenHelp=!1;try{seenHelp="1"===localStorage.getItem("ptSeenHelp")}catch(e){}
showTab(seenHelp?"Camera":"Help");
try{seenHelp||localStorage.setItem("ptSeenHelp","1")}catch(e){}
render();
applyOpen();
requestAnimationFrame(loop);
}
"loading"===document.readyState?document.addEventListener("DOMContentLoaded",buildUI):buildUI();
})();

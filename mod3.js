/*CAMERA_ORBIT_IJKL*/(function(){
const keys=Object.create(null);
const DEFAULTS={left:"KeyJ",right:"KeyL",up:"KeyI",down:"KeyK"};
const ACTIONS=[["left","Orbit left"],["right","Orbit right"],["up","Camera up"],["down","Camera down"]];
const STORE="ptCamBindings",GFXKEY="ptGfx",HUDKEY="ptHud";
const bind=Object.assign({},DEFAULTS);
try{const saved=JSON.parse(localStorage.getItem(STORE)||"null");if(saved&&"object"==typeof saved)for(const k in DEFAULTS)"string"==typeof saved[k]&&saved[k]&&(bind[k]=saved[k])}catch(e){}
const gfx=Object.assign({scale:1,shadows:!0,wireframe:!1,fov:1,dist:1},(function(){try{const v=JSON.parse(localStorage.getItem(GFXKEY)||"null");return v&&"object"==typeof v?v:{}}catch(e){return{}}})());
const hud=Object.assign({progress:!1,keys:!1,pos:"top"},(function(){try{const v=JSON.parse(localStorage.getItem(HUDKEY)||"null");return v&&"object"==typeof v?v:{}}catch(e){return{}}})());
let yaw=0,pitch=0,open=!1,capture=null,panel=null,tabBar=null,panelBody=null,replayStatus=null;
const tabs=[],tabHooks={},rate=2,limit=1.25;
const TRACK_NAMES=__PT_TRACK_NAMES__;
const OFFICIAL=__PT_OFFICIAL__;
const RECORD_RE=/^(polytrack_v\d+_[a-z]+_)record_(\d+)_([a-z]+)_([0-9a-f]{64})$/i;
window.__ptCamPatch="IJKL orbit + rebind GUI + HUD/gfx/debug";
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
if("ShiftRight"===e.code){e.preventDefault(),open=!open,applyOpen();return}
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
if(origRender)r.render=function(s,c){renderer=r,sceneRef=s,camRef=c;const out=origRender.apply(r,arguments);try{drawCalls=r.info.render.calls,triangles=r.info.render.triangles}catch(e){}return out};
if(origSet)r.setPixelRatio=function(v){baseRatio.set(r,v);if("number"==typeof v&&gfx.scale!==1)v*=gfx.scale;return origSet.call(r,v)};
renderer=r,hookedRenderers++;
return r};
window.__ptMakeRenderer=function(o){const K=(function(){try{return n(9437).JeP}catch(e){return null}})();if(!K)throw new Error("renderer class not found");return hookRenderer(new K(o))};
window.__ptGfxProbe=()=>({renderer:!!renderer,hooked:hookedRenderers,three:!!window.__THREE__});
const applyScale=r=>{if(!r)return;try{const base=baseRatio.has(r)?baseRatio.get(r):r.getPixelRatio();baseRatio.set(r,base),r.setPixelRatio(base)}catch(e){}};
const applyShadows=()=>{if(!renderer)return;try{renderer.shadowMap.enabled=!!gfx.shadows,renderer.shadowMap.needsUpdate=!0}catch(e){}};
const setWireframe=on=>{if(!sceneRef)return;try{sceneRef.traverse((o=>{if(!o||!o.material)return;const list=Array.isArray(o.material)?o.material:[o.material];for(const m of list)if(m&&"wireframe"in m)m.wireframe=on}))}catch(e){}};
x.prototype.update=function(e,t,n,i){
orig.call(this,e,t,n,i);
const dt=Math.max(0,Math.min(e||0,.1));
keys[bind.left]&&(yaw+=rate*dt),keys[bind.right]&&(yaw-=rate*dt),
keys[bind.up]&&(pitch=Math.min(limit,pitch+rate*dt)),keys[bind.down]&&(pitch=Math.max(-limit,pitch-rate*dt));
const cam=this.camera;
if(0!==yaw||0!==pitch){
up.set(0,1,0).applyQuaternion(n),off.subVectors(cam.position,t).applyAxisAngle(up,yaw),
right.set(1,0,0).applyQuaternion(n).applyAxisAngle(up,yaw),off.applyAxisAngle(right,pitch),
cam.position.set(t.x+off.x,t.y+off.y,t.z+off.z);
const h=1.8/Math.min(cam.zoom,2);
cam.lookAt(t.x+up.x*h,t.y+up.y*h,t.z+up.z*h),cam.updateMatrix()}
if(gfx.dist!==1&&cam&&cam.position){cam.position.x=t.x+(cam.position.x-t.x)*gfx.dist,cam.position.y=t.y+(cam.position.y-t.y)*gfx.dist,cam.position.z=t.z+(cam.position.z-t.z)*gfx.dist,cam.updateMatrix()}
if(gfx.fov!==1&&cam){cam.fov*=gfx.fov,cam.updateProjectionMatrix()}
lastCar.x=t.x,lastCar.y=t.y,lastCar.z=t.z,lastCar.t=performance.now();
};
const lastCar={x:0,y:0,z:0,t:0,prevX:0,prevY:0,prevZ:0,prevT:0,speed:0};

/* ---------- HUD overlays ---------- */
let barEl=null,barFill=null,barText=null,keysEl=null;
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
frames++;
if(lastFrame)frameMs=frameMs*0.85+(now-lastFrame)*0.15;
lastFrame=now;
if(!fpsAt)fpsAt=now;
if(now-fpsAt>=500){fps=Math.round(frames*1e3/(now-fpsAt));frames=0;fpsAt=now}
if(hud.progress)updateProgress();
if(hud.keys)updateKeyHud();
if(now-(loop.lastSlow||0)>120){loop.lastSlow=now;if(debugEls)fillDebug()}
requestAnimationFrame(loop);
}

/* ---------- helpers ---------- */
function el(tag,cls,text){const d=document.createElement(tag);cls&&(d.className=cls),null!=text&&(d.textContent=text);return d}
function applyOpen(){panel&&(panel.style.display=open?"":"none")}
function render(){if(!panel)return;for(const b of panel.querySelectorAll("[data-act]")){const a=b.dataset.act;b.textContent=capture===a?"Press a key\u2026":keyLabel(bind[a]);b.classList.toggle("capturing",capture===a)}}
function showTab(name){for(const t of tabs){const on=t.name===name;t.btn.classList.toggle("active",on),t.pane.style.display=on?"":"none",on&&(t.built||(t.build(t.pane),t.built=!0),tabHooks[name]&&tabHooks[name]())}}
function addTab(name,build){const btn=el("button","pt-tab",name);btn.type="button",btn.addEventListener("click",(e=>{e.preventDefault(),showTab(name)}));tabBar.appendChild(btn);const pane=el("div","pt-pane");pane.style.display="none",panelBody.appendChild(pane),tabs.push({name:name,btn:btn,pane:pane,build:build,built:!1})}

/* ---------- Camera tab ---------- */
function buildCameraTab(pane){
for(const pair of ACTIONS){
const act=pair[0],row=el("div","pt-row");
row.appendChild(el("span","pt-label",pair[1]));
const b=el("button","pt-key");b.type="button",b.dataset.act=act,b.title="Click, then press a key";
b.addEventListener("click",(e=>{e.preventDefault(),e.stopPropagation(),capture=act,render()}));
row.appendChild(b),pane.appendChild(row)}
const rc=el("button","pt-wide","Reset camera");rc.type="button",rc.addEventListener("click",(e=>{e.preventDefault(),yaw=0,pitch=0})),pane.appendChild(rc);
const rk=el("button","pt-wide pt-secondary","Restore default keys");rk.type="button",rk.addEventListener("click",(e=>{e.preventDefault(),Object.assign(bind,DEFAULTS),save(),render()})),pane.appendChild(rk);
pane.appendChild(el("div","pt-hint","Press Right Shift to open or close this panel."))
}

/* ---------- Replays tab ---------- */
function listRecords(){
const items=[];
try{for(const key of Object.keys(localStorage)){
const m=RECORD_RE.exec(key);if(!m)continue;
let v=null;try{v=JSON.parse(localStorage.getItem(key)||"null")}catch(e){}
const frames=v&&"number"==typeof v.frames&&isFinite(v.frames)?v.frames:null;
const recording=v&&"string"==typeof v.recording?v.recording:"";
const id=m[4].toLowerCase();
items.push({name:TRACK_NAMES[id]||"Track "+id.slice(0,8),slot:Number(m[2]),kind:m[3],prefix:m[1],frames:frames,size:recording.length,recording:recording,id:id})}}catch(e){}
items.sort((a,b)=>a.name===b.name?((null==a.frames?1e15:a.frames)-(null==b.frames?1e15:b.frames)):(a.name<b.name?-1:1));
return items}
function buildReplaysTab(pane){
const head=el("div","pt-row");
const count=el("span","pt-count","Loading\u2026");
const rfr=el("button","pt-mini","Refresh");rfr.type="button";
head.appendChild(count),head.appendChild(rfr),pane.appendChild(head);
const list=el("div","pt-list");pane.appendChild(list);
replayStatus=el("div","pt-status","");pane.appendChild(replayStatus);
const setStatus=t=>{replayStatus.textContent=t||"";replayStatus.classList.toggle("on",!!t)};
const draw=()=>{
const items=listRecords();
count.textContent=items.length+(1===items.length?" replay":" replays");
list.textContent="";
if(!items.length){list.appendChild(el("div","pt-empty","No stored replays yet."));return}
for(const it of items){
const row=el("div","pt-replay"),top=el("div","pt-rtop");
top.appendChild(el("span","pt-rname",it.name));
top.appendChild(el("span","pt-rtime",null==it.frames?"\u2014":fmtTime(it.frames)));
const play=el("button","pt-play","\u25b6");play.type="button";play.title="Replay this run";
play.addEventListener("click",(e=>{e.preventDefault(),e.stopPropagation(),startReplay(it,setStatus)}));
top.appendChild(play);
row.appendChild(top);
row.appendChild(el("div","pt-rmeta",profileName(it.prefix,it.slot)+" \u00b7 "+it.kind+" \u00b7 "+fmtSize(it.size)));
row.title=it.name+"\n"+it.id;
list.appendChild(row)} };
tabHooks.Replays=draw;
rfr.addEventListener("click",(e=>{e.preventDefault(),draw()}));
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
function sliderRow(pane,label,min,max,step,get,set){
const row=el("div","pt-row"),wrap=el("div","pt-sliderwrap");
const range=el("input");range.type="range",range.min=String(min),range.max=String(max),range.step=String(step),range.value=String(get());
const val=el("span","pt-val",String(get()));
range.addEventListener("input",(()=>{const v=Number(range.value);set(v),val.textContent=v.toFixed(step<1?2:0),saveGfx()}));
wrap.appendChild(range),wrap.appendChild(val);
row.appendChild(el("span","pt-label",label)),row.appendChild(wrap),pane.appendChild(row)}
function buildGraphicsTab(pane){
toggleRow(pane,"Shadows",()=>gfx.shadows,(v)=>{gfx.shadows=v,applyShadows()});
toggleRow(pane,"Wireframe",()=>gfx.wireframe,(v)=>{gfx.wireframe=v,setWireframe(v)});
sliderRow(pane,"Render scale",0.5,2,0.05,()=>gfx.scale,(v)=>{gfx.scale=v,applyScale(renderer)});
sliderRow(pane,"FOV",0.6,1.8,0.05,()=>gfx.fov,(v)=>{gfx.fov=v});
sliderRow(pane,"Camera distance",0.5,3,0.05,()=>gfx.dist,(v)=>{gfx.dist=v});
const row=el("div","pt-row");const info=el("span","pt-meta","");
const syncInfo=()=>{info.textContent=renderer?(Math.round(drawCalls)+" draws"):"no renderer yet"};
row.appendChild(info);pane.appendChild(row);
const btn=el("button","pt-wide pt-secondary","Reapply");btn.type="button";
btn.addEventListener("click",(e=>{e.preventDefault(),applyScale(renderer),applyShadows(),setWireframe(gfx.wireframe),syncInfo()}));
pane.appendChild(btn);
tabHooks.Graphics=syncInfo;
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
d.keys.textContent=Object.keys(keys).filter(k=>keys[k]).length+" held";
}
function buildDebugTab(pane){
debugEls={};
const rows=[["fps","FPS"],["ms","Frame"],["draws","Draw calls"],["tris","Triangles"],["car","Car pos"],["cam","Yaw / pitch"],["res","Pixel ratio"],["keys","Inputs"]];
for(const pair of rows){const row=el("div","pt-row");row.appendChild(el("span","pt-label",pair[1]));const v=el("span","pt-meta","\u2014");debugEls[pair[0]]=v;row.appendChild(v);pane.appendChild(row)}
const copy=el("button","pt-wide","Copy diagnostics");copy.type="button";
copy.addEventListener("click",(e=>{e.preventDefault();const data={fps:fps,frameMs:+frameMs.toFixed(2),drawCalls:drawCalls,triangles:triangles,car:{x:lastCar.x,y:lastCar.y,z:lastCar.z},yaw:yaw,pitch:pitch,pixelRatio:renderer&&renderer.getPixelRatio?renderer.getPixelRatio():null,scale:gfx.scale,fov:gfx.fov,dist:gfx.dist,shadows:gfx.shadows,wireframe:gfx.wireframe,panel:window.__ptCamPatch,ua:navigator.userAgent};
const text=JSON.stringify(data,null,2);
try{navigator.clipboard.writeText(text).then((()=>{copy.textContent="Copied"}),(function(){copy.textContent="Copy failed (console)"}))}catch(err){copy.textContent="Copy failed (console)"}
console.log("[pt debug]",text)}));
pane.appendChild(copy);
fillDebug();
tabHooks.Debug=fillDebug;
}

/* ---------- panel ---------- */
function buildUI(){
if(document.getElementById("pt-mod-panel"))return;
const css=document.createElement("style");
css.textContent=`#pt-mod-panel{position:fixed;top:calc(10px + var(--safe-area-vertical,0px));right:calc(10px + var(--safe-area-horizontal,0px));z-index:2147483647;width:302px;padding:8px;box-sizing:border-box;border-radius:4px;background:rgba(17,32,82,.9);color:#fff;font-family:inherit;font-size:14px;box-shadow:0 6px 20px rgba(0,0,0,.45);user-select:none;-webkit-user-select:none}
#pt-mod-panel .pt-head{display:flex;align-items:center;justify-content:space-between;margin:0 0 6px}
#pt-mod-panel .pt-title{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.75}
#pt-mod-panel .pt-close{padding:0 2px;border:0;background:none;color:#fff;font:inherit;font-size:16px;line-height:1;cursor:pointer;opacity:.7}
#pt-mod-panel .pt-close:hover{opacity:1}
#pt-mod-panel .pt-tabs{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 6px}
#pt-mod-panel .pt-tab{flex:1 1 auto;padding:4px 6px;border:0;border-radius:3px;background:rgba(255,255,255,.08);color:#fff;font:inherit;font-size:11px;cursor:pointer}
#pt-mod-panel .pt-tab:hover{background:rgba(255,255,255,.16)}
#pt-mod-panel .pt-tab.active{background:rgba(255,255,255,.26)}
#pt-mod-panel .pt-pane{display:block;max-height:58vh;overflow:auto}
#pt-mod-panel .pt-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:3px 0}
#pt-mod-panel .pt-label{opacity:.9;font-size:13px}
#pt-mod-panel .pt-key{min-width:78px;padding:4px 6px;border:1px solid rgba(255,255,255,.2);border-radius:3px;background:rgba(0,0,0,.28);color:#fff;font:inherit;font-size:12px;cursor:pointer}
#pt-mod-panel .pt-key:hover{background:rgba(0,0,0,.42)}
#pt-mod-panel .pt-key.capturing{border-color:#ffd453;color:#ffd453}
#pt-mod-panel .pt-wide{display:block;width:100%;margin-top:6px;padding:5px;border:0;border-radius:3px;background:rgba(255,255,255,.14);color:#fff;font:inherit;font-size:12px;cursor:pointer}
#pt-mod-panel .pt-wide:hover{background:rgba(255,255,255,.22)}
#pt-mod-panel .pt-secondary{background:rgba(255,255,255,.06)}
#pt-mod-panel .pt-hint{margin-top:6px;font-size:10px;line-height:1.35;opacity:.6}
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
#pt-mod-panel .pt-sliderwrap input{width:104px;accent-color:#7fb6ff}
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
const head=el("div","pt-head");head.appendChild(el("span","pt-title","Mod settings"));
const close=el("button","pt-close","\u00d7");close.type="button",close.title="Close (Right Shift)",close.addEventListener("click",(e=>{e.preventDefault(),open=!1,applyOpen()}));
head.appendChild(close),panel.appendChild(head);
tabBar=el("div","pt-tabs"),panelBody=el("div","pt-pane-wrap"),panel.appendChild(tabBar),panel.appendChild(panelBody);
document.body.appendChild(panel);
buildHud();
addTab("Camera",buildCameraTab);
addTab("Replays",buildReplaysTab);
addTab("HUD",buildHudTab);
addTab("Graphics",buildGraphicsTab);
addTab("Debug",buildDebugTab);
showTab("Camera");
render();
applyOpen();
requestAnimationFrame(loop);
}
"loading"===document.readyState?document.addEventListener("DOMContentLoaded",buildUI):buildUI();
})();

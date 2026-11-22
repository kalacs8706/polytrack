/*POLYMOD_LITE*/(function(){
/* PolyMod Lite: video (graphics) settings + admin. No camera orbit, replays, HUD, cheats
   or multiplayer shim. Injected into main.bundle.js at the "m={value:70};const k=x;" anchor. */
const TOUCH=(function(){try{return("ontouchstart"in window)||(navigator.maxTouchPoints||0)>0||!!(window.matchMedia&&matchMedia("(pointer:coarse)").matches)}catch(e){return!1}})();
const LANGKEY="ptLang",GFXKEY="ptGfx",PANELKEY="ptPanel",ADMINKEY="ptAdmin";
let lang="de";try{const lv=localStorage.getItem(LANGKEY);if("en"===lv||"de"===lv)lang=lv}catch(e){}
const DE={
"Close (Right Shift)":"Schlie\u00dfen (RShift)",
"Open PolyMod":"PolyMod \u00f6ffnen",
"Drag to resize":"Zum Gr\u00f6\u00dfe\u00e4ndern ziehen",
"Graphics":"Grafik",
"Antialiasing":"Kantengl\u00e4ttung",
"Wireframe":"Drahtgitter",
"Render scale":"Render-Skalierung",
"Camera distance":"Kameraabstand",
"Reapply":"Erneut anwenden",
"draws":"Draws",
"no renderer yet":"noch kein Renderer",
"game setting":"Spieleinstellung",
"Off":"Aus",
"on (forced)":"an (erzwungen)",
"On":"An",
"Game keeps PolyTrack's own Antialiasing setting. Off and MSAA change the WebGL context, so they take effect after a restart. SSAA renders at a higher resolution and downsamples immediately; it stacks with MSAA.":"PolyTrack beh\u00e4lt seine eigene Kantengl\u00e4ttung. Aus und MSAA \u00e4ndern den WebGL-Kontext und greifen erst nach einem Neustart. SSAA rendert in h\u00f6herer Aufl\u00f6sung und skaliert sofort herunter; es l\u00e4sst sich mit MSAA kombinieren.",
"Admin":"Admin",
"Admin password":"Admin-Passwort",
"Apply":"Anwenden",
"Refresh":"Aktualisieren",
"Delete all on this track":"Alle Eintr\u00e4ge dieser Strecke l\u00f6schen",
"Sign out":"Abmelden",
"Signed in.":"Angemeldet.",
"Enter the admin password.":"Admin-Passwort eingeben.",
"No records yet.":"Noch keine Eintr\u00e4ge.",
"records":"Eintr\u00e4ge",
"Delete this record":"Diesen Eintrag l\u00f6schen",
"Delete every record on this track?":"Wirklich alle Eintr\u00e4ge dieser Strecke l\u00f6schen?",
"Deleted.":"Gel\u00f6scht.",
"Delete failed: ":"L\u00f6schen fehlgeschlagen: ",
"Admin request failed: ":"Admin-Anfrage fehlgeschlagen: ",
"clean":"sauber",
"Cheated":"Geschummelt",
"speed":"Tempo",
"grip":"Grip",
"The admin tools need the self-hosted server (web build only).":"Die Admin-Werkzeuge brauchen den eigenen Server (nur Web-Build)."
};
const tr=s=>"de"===lang?(DE[s]??s):s;
const GFXHINT="Game keeps PolyTrack's own Antialiasing setting. Off and MSAA change the WebGL context, so they take effect after a restart. SSAA renders at a higher resolution and downsamples immediately; it stacks with MSAA.";
const gfx=Object.assign({scale:1,wireframe:!1,fov:1,dist:1,aa:"game"},(function(){try{const v=JSON.parse(localStorage.getItem(GFXKEY)||"null");return v&&"object"==typeof v?v:{}}catch(e){return{}}})());
const persist=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const saveGfx=()=>persist(GFXKEY,gfx);
window.__ptAA=function(gameValue){try{if("off"===gfx.aa)return!1;if("msaa"===gfx.aa)return!0;return!!gameValue}catch(e){return gameValue}};
window.__ptCamPatch="PolyMod Lite (video settings + admin)";

/* ---------- renderer hooks ---------- */
const orig=x.prototype.update;
const baseRatio=new WeakMap();
let renderer=null,sceneRef=null,camRef=null,drawCalls=0,triangles=0;
const applyScale=r=>{if(!r)return;try{const base=baseRatio.has(r)?baseRatio.get(r):r.getPixelRatio();baseRatio.set(r,base),r.setPixelRatio(base)}catch(e){}};
const setWireframe=on=>{if(!sceneRef)return;try{sceneRef.traverse((o=>{if(!o||!o.material)return;const list=Array.isArray(o.material)?o.material:[o.material];for(const m of list)if(m&&"wireframe"in m)m.wireframe=on}))}catch(e){}};
const hookRenderer=r=>{
if(!r||r.__ptHooked)return r;
r.__ptHooked=!0;
const origRender=r.render&&r.render.bind(r),origSet=r.setPixelRatio&&r.setPixelRatio.bind(r);
if(origRender)r.render=function(s,c){renderer=r,sceneRef=s,camRef=c;const out=origRender.apply(r,arguments);try{drawCalls=r.info.render.calls,triangles=r.info.render.triangles}catch(e){}return out};
if(origSet)r.setPixelRatio=function(v){baseRatio.set(r,v);if("number"==typeof v&&gfx.scale!==1)v*=gfx.scale;return origSet.call(r,v)};
renderer=r;
return r};
window.__ptHookRenderer=hookRenderer;
x.prototype.update=function(e,t,n,i){
orig.call(this,e,t,n,i);
const cam=this.camera;
if(gfx.dist!==1&&cam&&cam.position){cam.position.x=t.x+(cam.position.x-t.x)*gfx.dist,cam.position.y=t.y+(cam.position.y-t.y)*gfx.dist,cam.position.z=t.z+(cam.position.z-t.z)*gfx.dist,cam.updateMatrix()}
if(gfx.fov!==1&&cam){cam.fov*=gfx.fov,cam.updateProjectionMatrix()}
};

/* ---------- track the track the player is on (for the admin tools) ---------- */
const curTrack={id:null,at:0};
const setCurTrack=id=>{if("string"!=typeof id||!id)return;id=id.toLowerCase();if(id===curTrack.id)return;curTrack.id=id,curTrack.at=Date.now()};
(function(){try{
const mark=u=>{try{const tq=/[?&]trackId=([0-9a-f]{64})/i.exec(String(u));if(tq)return setCurTrack(tq[1])}catch(e){}};
const f=window.fetch;if(f&&!f.__ptLiteFetch){const wf=function(i){try{mark("string"==typeof i?i:i&&i.url)}catch(e){}return f.apply(this,arguments)};wf.__ptLiteFetch=1,window.fetch=wf}
const op=XMLHttpRequest.prototype.open;if(op&&!op.__ptLiteXhr){const wo=function(m,u){try{mark(u)}catch(e){}return op.apply(this,arguments)};wo.__ptLiteXhr=1,XMLHttpRequest.prototype.open=wo}
}catch(e){}})();

/* ---------- panel ---------- */
let open=!1,capture=null,panel=null,tabBar=null,panelBody=null,langBtn=null,fabEl=null,currentTab=null;
const tabs=[],tabHooks={};
function el(tag,cls,text){const d=document.createElement(tag);cls&&(d.className=cls),null!=text&&(d.textContent=tr(text));return d}
function localizeTitles(root){if(!root)return;for(const n of root.querySelectorAll("[title]")){const s=n.getAttribute("title");const g=tr(s);if(g!==s)n.title=g}}
function showTab(name){currentTab=name;for(const t of tabs){const on=t.name===name;t.btn.classList.toggle("active",on),t.pane.style.display=on?"":"none",on&&(t.built||(t.build(t.pane),t.built=!0),localizeTitles(t.pane),tabHooks[name]&&tabHooks[name]())}}
function addTab(name,build){const btn=el("button","pt-tab",name);btn.type="button",btn.dataset.tab=name,btn.addEventListener("click",(e=>{e.preventDefault(),showTab(name)}));tabBar.appendChild(btn);const pane=el("div","pt-pane");pane.style.display="none",panelBody.appendChild(pane),tabs.push({name:name,btn:btn,pane:pane,build:build,built:!1})}
function setLang(l){lang="en"===l?"en":"de";try{localStorage.setItem(LANGKEY,lang)}catch(e){}langBtn&&(langBtn.textContent="de"===lang?"DE":"EN");localizeTitles(panel);for(const t of tabs){t.btn.textContent=tr(t.name),t.built=!1,t.pane.textContent=""}showTab(currentTab||"Graphics")}
function applyOpen(){panel&&(panel.style.display=open?"":"none",open&&applyLayout()),fabEl&&(fabEl.style.display=open?"none":"")}

/* ---------- Graphics tab ---------- */
const sliderRefs={};
function sliderRow(pane,label,min,max,step,get,set){
const row=el("div","pt-row"),wrap=el("div","pt-sliderwrap");
const track=el("div","pt-slide"),fill=el("div","pt-slide-fill"),knob=el("div","pt-slide-knob");
track.appendChild(fill),track.appendChild(knob);
const val=el("span","pt-val",""),dec=step<1?2:0;
const paint=v=>{const n=Math.max(min,Math.min(max,void 0===v?Number(get()):Number(v))),f=(n-min)/(max-min);knob.style.left=(f*100)+"%",fill.style.width=(f*100)+"%",val.textContent=n.toFixed(dec)};
const commit=cx=>{const r=track.getBoundingClientRect();if(!r.width)return;const f=Math.max(0,Math.min(1,(cx-r.left)/r.width));let v=min+f*(max-min);v=Math.max(min,Math.min(max,Math.round(v/step)*step)),v=+v.toFixed(4);set(v),paint(v),saveGfx(),"Render scale"===label&&(gfx.aa=aaPick(),aaSync())};
let pid=null;
track.addEventListener("pointerdown",(e=>{e.preventDefault(),e.stopPropagation(),pid=e.pointerId;try{track.setPointerCapture(pid)}catch(err){}commit(e.clientX)})),
track.addEventListener("pointermove",(e=>{if(null===pid||e.pointerId!==pid)return;e.preventDefault(),e.stopPropagation(),commit(e.clientX)})),
track.addEventListener("pointerup",(e=>{if(null===pid)return;try{track.releasePointerCapture(pid)}catch(err){}pid=null})),
track.addEventListener("pointercancel",(()=>{if(null===pid)return;try{track.releasePointerCapture(pid)}catch(err){}pid=null}));
track.__ptSet=v=>paint(v);
sliderRefs[label]=track;
paint();
wrap.appendChild(track),wrap.appendChild(val);
row.appendChild(el("span","pt-label",label)),row.appendChild(wrap),pane.appendChild(row)}
function toggleRow(pane,label,get,set){
const row=el("div","pt-row");
row.appendChild(el("span","pt-label",label));
const b=el("button","pt-toggle");b.type="button";
const sync=()=>{const on=!!get();b.textContent=on?tr("On"):tr("Off");b.classList.toggle("on",on)};
b.addEventListener("click",(e=>{e.preventDefault(),set(!get()),sync()}));
sync();row.appendChild(b);pane.appendChild(row)}
const AAMODES=[["game","Game"],["off","Off"],["msaa","MSAA"],["ssaa15","SSAA 1.5\u00d7"],["ssaa2","SSAA 2\u00d7"]];
let aaStatusEl=null,aaButtons=null;
function aaPick(){const s=+gfx.scale||1;if("off"===gfx.aa||"msaa"===gfx.aa||"game"===gfx.aa)return gfx.aa;return s>=1.95?"ssaa2":s>=1.4?"ssaa15":"game"}
function aaSync(){
if(!aaStatusEl)return;
const cur=aaPick(),label={game:tr("game setting"),off:tr("Off").toLowerCase(),msaa:tr("on (forced)"),ssaa15:"SSAA 1.5\u00d7",ssaa2:"SSAA 2\u00d7"};
if(aaButtons)for(const k in aaButtons)aaButtons[k].classList.toggle("active",k===cur);
let ctx="no renderer yet";
try{const gl=renderer&&renderer.getContext?renderer.getContext():null;
if(gl){const a=gl.getContextAttributes?gl.getContextAttributes():null;let n=0;try{n=gl.getParameter(gl.SAMPLES)||0}catch(e){}
ctx=a&&a.antialias?"context MSAA on"+(n?", "+n+"\u00d7":""):"context MSAA off"}}catch(e){}
{const c="de"===lang?ctx.replace("context MSAA on","Kontext-MSAA an").replace("context MSAA off","Kontext-MSAA aus").replace("no renderer yet","noch kein Renderer"):ctx;aaStatusEl.textContent="PolyMod: "+(label[cur]||cur)+" \u00b7 "+c+" \u00b7 "+tr("game setting")+" "+(window.__ptGameAA===!1?tr("Off").toLowerCase():tr("On").toLowerCase())}}
function setAA(m){
gfx.aa=m;
if("ssaa15"===m)gfx.scale=1.5;else if("ssaa2"===m)gfx.scale=2;
saveGfx();
try{applyScale(renderer)}catch(e){}
const sr=sliderRefs["Render scale"];sr&&sr.__ptSet&&sr.__ptSet(gfx.scale)
aaSync()}
function buildGraphicsTab(pane){
const aarow=el("div","pt-row");aarow.appendChild(el("span","pt-label","Antialiasing"));
const seg=el("div","pt-seg");aaButtons={};
for(const pair of AAMODES){const b=el("button","pt-segbtn",pair[1]);b.type="button";b.dataset.aa=pair[0];
b.addEventListener("click",(e=>{e.preventDefault(),setAA(pair[0])}));aaButtons[pair[0]]=b;seg.appendChild(b)}
aarow.appendChild(seg);pane.appendChild(aarow);
aaStatusEl=el("div","pt-hint","");pane.appendChild(aaStatusEl);
pane.appendChild(el("div","pt-hint",GFXHINT));
toggleRow(pane,"Wireframe",()=>gfx.wireframe,(v)=>{gfx.wireframe=v,setWireframe(v)});
sliderRow(pane,"Render scale",0.5,2,0.05,()=>gfx.scale,(v)=>{gfx.scale=v,applyScale(renderer)});
sliderRow(pane,"FOV",0.6,1.8,0.05,()=>gfx.fov,(v)=>{gfx.fov=v});
sliderRow(pane,"Camera distance",0.5,3,0.05,()=>gfx.dist,(v)=>{gfx.dist=v});
const row=el("div","pt-row");const info=el("span","pt-meta","");
const syncInfo=()=>{info.textContent=renderer?(Math.round(drawCalls)+tr(" draws")):tr("no renderer yet")};
row.appendChild(info);pane.appendChild(row);
const btn=el("button","pt-wide pt-secondary","Reapply");btn.type="button";
btn.addEventListener("click",(e=>{e.preventDefault(),applyScale(renderer),setWireframe(gfx.wireframe),syncInfo(),aaSync()}));
pane.appendChild(btn);
syncInfo();aaSync();
tabHooks.Graphics=()=>{syncInfo(),aaSync()};
}

/* ---------- Admin tab ---------- */
const APIBASE=(function(){try{return String(window.__ptAPIBase||"").replace(/\/+$/,"")}catch(e){return""}})();
const TRACK_NAMES=__PT_TRACK_NAMES__;
const trackLabel=id=>TRACK_NAMES[id]||("de"===lang?"Strecke ":"Track ")+String(id).slice(0,8);
const fmtTime=frames=>{const ms=Math.max(0,Math.round(frames)),m=Math.floor(ms/6e4),s=Math.floor(ms%6e4/1e3),r=ms%1e3;return m+":"+String(s).padStart(2,"0")+"."+String(r).padStart(3,"0")};
function cheatBadgeText(e){
const sp=+(e&&e.cheatSpeed)||1,gr=+(e&&e.cheatGrip)||1,parts=[];
if(sp>1.001)parts.push(sp.toFixed(2)+"\u00d7 "+tr("speed"));
if(Math.abs(gr-1)>0.001)parts.push(gr.toFixed(2)+" "+tr("grip"));
return parts.length?tr("Cheated")+": "+parts.join(", "):"";
}
function apiJson(path,opt){return fetch(APIBASE+"/v6/"+path,opt).then(r=>{if(!r.ok)throw new Error("http "+r.status);return r.json()})}
let adminToken="";try{adminToken=localStorage.getItem(ADMINKEY)||""}catch(e){}
function saveAdmin(){try{localStorage.setItem(ADMINKEY,adminToken)}catch(e){}}
function buildAdminTab(pane){
if(!APIBASE){pane.appendChild(el("div","pt-hint","The admin tools need the self-hosted server (web build only)."));return}
const status=el("div","pt-status",""),countEl=el("div","pt-count",""),listEl=el("div","pt-list","");
const pw=document.createElement("input");pw.type="password";pw.autocomplete="current-password";pw.placeholder=tr("Admin password");
pw.style.cssText="width:100%;box-sizing:border-box;margin:2px 0 4px;padding:6px 8px;border:1px solid rgba(255,255,255,.25);border-radius:3px;background:rgba(0,0,0,.28);color:#fff;font:inherit;font-size:13px";
pane.appendChild(pw);
const applyBtn=el("button","pt-wide",adminToken?"Refresh":"Apply");applyBtn.type="button";pane.appendChild(applyBtn);
const allBtn=el("button","pt-wide pt-secondary","Delete all on this track");allBtn.type="button";pane.appendChild(allBtn);
const outBtn=el("button","pt-wide pt-secondary","Sign out");outBtn.type="button";pane.appendChild(outBtn);
pane.appendChild(countEl);pane.appendChild(listEl);pane.appendChild(status);
const say=(t,on)=>{status.textContent=t;status.classList.toggle("on",!!on)};
if(adminToken){pw.placeholder=tr("Signed in.");pw.disabled=!0}
async function refresh(){
  if(!adminToken)return;
  const q=curTrack.id?"&trackId="+encodeURIComponent(curTrack.id):"";
  const d=await apiJson("admin/entries?token="+encodeURIComponent(adminToken)+q+"&limit=100");
  countEl.textContent=String(d.total|0)+" "+tr("records")+(curTrack.id?" \u00b7 "+trackLabel(curTrack.id):"");
  listEl.textContent="";
  if(!(d.entries||[]).length)listEl.appendChild(el("div","pt-empty","No records yet."));
  for(const en of d.entries||[]){
    const row=el("div","pt-replay"),top=el("div","pt-rtop");
    top.appendChild(el("span","pt-rname","#"+en.id+" "+en.nickname));
    top.appendChild(el("span","pt-rtime",fmtTime?fmtTime(en.frames):String(en.frames)));
    const del=el("button","pt-play","\u2715");del.type="button";del.title=tr("Delete this record");
    del.addEventListener("click",(async ev=>{ev.preventDefault();
      try{await apiJson("admin/delete",{method:"POST",headers:{"content-type":"text/plain"},body:JSON.stringify({token:adminToken,ids:[en.id]})});await refresh();say(tr("Deleted."),!0)}
      catch(err){say(tr("Delete failed: ")+((err&&err.message)||err),!0)}}));
    top.appendChild(del);row.appendChild(top);
    const badge=cheatBadgeText(en);
    row.appendChild(el("div","pt-rmeta",trackLabel(en.trackId)+" \u00b7 "+(badge||tr("clean"))));
    listEl.appendChild(row)}
}
tabHooks.Admin=refresh;
applyBtn.addEventListener("click",(async e=>{e.preventDefault();
  try{
    if(!adminToken){
      if(!pw.value)return say(tr("Enter the admin password."),!0);
      const r=await apiJson("admin/login",{method:"POST",headers:{"content-type":"text/plain"},body:JSON.stringify({password:pw.value})});
      adminToken=r.token;saveAdmin();pw.value="";pw.disabled=!0;applyBtn.textContent=tr("Refresh");say(tr("Signed in."),!0);
    }
    await refresh();
  }catch(err){adminToken="";saveAdmin();pw.disabled=!1;applyBtn.textContent=tr("Apply");say(tr("Admin request failed: ")+((err&&err.message)||err),!0)}}));
outBtn.addEventListener("click",(async e=>{e.preventDefault();
  try{await apiJson("admin/logout",{method:"POST",headers:{"content-type":"text/plain"},body:JSON.stringify({token:adminToken})})}catch(err){}
  adminToken="";saveAdmin();pw.value="";pw.disabled=!1;applyBtn.textContent=tr("Apply");countEl.textContent="";listEl.textContent="";say("",!1)}));
allBtn.addEventListener("click",(async e=>{e.preventDefault();
  if(!adminToken)return say(tr("Enter the admin password."),!0);
  if(!curTrack.id)return say(tr("No records yet."),!0);
  if(!window.confirm(tr("Delete every record on this track?")))return;
  try{await apiJson("admin/delete",{method:"POST",headers:{"content-type":"text/plain"},body:JSON.stringify({token:adminToken,trackId:curTrack.id})});await refresh();say(tr("Deleted."),!0)}
  catch(err){say(tr("Delete failed: ")+((err&&err.message)||err),!0)}}));
if(adminToken)refresh().catch(()=>{});
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

/* ---------- input ---------- */
const typing=()=>{const a=document.activeElement;return!!a&&("INPUT"===a.tagName||"TEXTAREA"===a.tagName||a.isContentEditable)};
window.addEventListener("keydown",(function(e){
if(capture){e.preventDefault(),capture=null;return}
if(typing())return;
if("ShiftRight"===e.code){e.preventDefault(),open=!open,applyOpen();return}
if("Escape"===e.code&&open){e.preventDefault(),open=!1,applyOpen()}
}),!0);

/* ---------- build ---------- */
function buildUI(){
if(document.getElementById("pt-mod-panel"))return;
const css=document.createElement("style");
css.textContent=`#pt-mod-panel{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483647;width:min(540px,92vw);max-height:88vh;overflow:hidden;padding:14px 16px;box-sizing:border-box;border-radius:6px;background:rgba(17,32,82,.94);color:#fff;font-family:inherit;font-size:15px;box-shadow:0 12px 38px rgba(0,0,0,.55);user-select:none;-webkit-user-select:none;display:flex;flex-direction:column}
#pt-mod-panel .pt-head{display:flex;align-items:center;justify-content:space-between;margin:0 0 6px;cursor:grab;touch-action:none}
#pt-mod-panel .pt-head:active{cursor:grabbing}
#pt-mod-panel .pt-resize{position:absolute;right:3px;bottom:3px;width:16px;height:16px;cursor:nwse-resize;touch-action:none;border-radius:2px;background:linear-gradient(135deg,transparent 0 42%,rgba(255,255,255,.4) 42% 54%,transparent 54% 100%)}
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
#pt-mod-panel .pt-wide{display:block;width:100%;margin-top:6px;padding:5px;border:0;border-radius:3px;background:rgba(255,255,255,.14);color:#fff;font:inherit;font-size:12px;cursor:pointer}
#pt-mod-panel .pt-wide:hover{background:rgba(255,255,255,.22)}
#pt-mod-panel .pt-secondary{background:rgba(255,255,255,.06)}
#pt-mod-panel .pt-hint{margin-top:6px;font-size:11px;line-height:1.4;opacity:.62}
#pt-mod-panel .pt-seg{display:flex;flex-wrap:wrap;gap:3px;justify-content:flex-end;max-width:330px}
#pt-mod-panel .pt-segbtn{padding:3px 8px;border:0;border-radius:3px;background:rgba(255,255,255,.1);color:#fff;font:inherit;font-size:11px;cursor:pointer}
#pt-mod-panel .pt-segbtn:hover{background:rgba(255,255,255,.2)}
#pt-mod-panel .pt-segbtn.active{background:rgba(127,182,255,.42);box-shadow:inset 0 0 0 1px rgba(127,182,255,.85)}
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
#pt-mod-panel .pt-empty{font-size:12px;opacity:.6;padding:4px 0}
#pt-mod-panel .pt-status{margin-top:6px;font-size:10px;line-height:1.3;opacity:0;transition:opacity .15s}
#pt-mod-panel .pt-status.on{opacity:.85}
#pt-mod-panel .pt-toggle{min-width:56px;padding:4px 8px;border:1px solid rgba(255,255,255,.2);border-radius:3px;background:rgba(0,0,0,.28);color:#fff;font:inherit;font-size:12px;cursor:pointer}
#pt-mod-panel .pt-toggle.on{border-color:#7fe08a;color:#7fe08a;background:rgba(127,224,138,.12)}
#pt-mod-panel .pt-sliderwrap{display:flex;align-items:center;gap:6px}
#pt-mod-panel .pt-slide{position:relative;width:104px;height:20px;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none}
#pt-mod-panel .pt-slide::before{content:"";position:absolute;left:0;right:0;top:50%;height:6px;margin-top:-3px;border-radius:3px;background:rgba(255,255,255,.22)}
#pt-mod-panel .pt-slide-fill{position:absolute;left:0;top:50%;height:6px;margin-top:-3px;border-radius:3px;background:#7fb6ff;pointer-events:none}
#pt-mod-panel .pt-slide-knob{position:absolute;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:#7fb6ff;box-shadow:0 1px 2px rgba(0,0,0,.5);pointer-events:none}
#pt-mod-panel .pt-val{font-size:11px;opacity:.8;min-width:34px;text-align:right;font-variant-numeric:tabular-nums}
#pt-mod-panel .pt-meta{font-size:12px;font-variant-numeric:tabular-nums;opacity:.9}
#pt-fab{position:fixed;right:calc(12px + var(--safe-area-horizontal,0px));bottom:calc(12px + var(--safe-area-vertical,0px));z-index:2147483646;width:44px;height:44px;padding:0;border:0;border-radius:50%;background:rgba(17,32,82,.88);color:#fff;font:inherit;font-size:17px;line-height:44px;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.45);cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;opacity:.85}
#pt-fab:hover{opacity:1}
#pt-fab:active{transform:scale(.94)}
#pt-fab:focus{outline:0}
html.pt-touch #pt-mod-panel{width:min(700px,96vw);max-height:94vh;font-size:17px}
html.pt-touch #pt-mod-panel .pt-title{font-size:15px}
html.pt-touch #pt-mod-panel .pt-close{font-size:27px;padding:0 6px}
html.pt-touch #pt-mod-panel .pt-tab{font-size:15px;padding:10px 10px}
html.pt-touch #pt-mod-panel .pt-label{font-size:17px}
html.pt-touch #pt-mod-panel .pt-wide{font-size:16px;padding:11px}
html.pt-touch #pt-mod-panel .pt-hint{font-size:14px;line-height:1.55}
html.pt-touch #pt-mod-panel .pt-count{font-size:14px}
html.pt-touch #pt-mod-panel .pt-mini{font-size:14px;padding:8px 12px}
html.pt-touch #pt-mod-panel .pt-list{max-height:46vh}
html.pt-touch #pt-mod-panel .pt-replay{padding:8px 2px}
html.pt-touch #pt-mod-panel .pt-rname{font-size:15px}
html.pt-touch #pt-mod-panel .pt-rtime{font-size:15px}
html.pt-touch #pt-mod-panel .pt-play{font-size:14px;padding:7px 14px;line-height:1.4}
html.pt-touch #pt-mod-panel .pt-rmeta{font-size:12px}
html.pt-touch #pt-mod-panel .pt-status{font-size:13px}
html.pt-touch #pt-mod-panel .pt-toggle{font-size:15px;padding:9px 12px;min-width:70px}
html.pt-touch #pt-mod-panel .pt-segbtn{font-size:14px;padding:8px 12px}
html.pt-touch #pt-mod-panel .pt-seg{max-width:58%}
html.pt-touch #pt-mod-panel .pt-val,html.pt-touch #pt-mod-panel .pt-meta{font-size:14px}
html.pt-touch #pt-mod-panel .pt-slide{width:150px;height:34px}
html.pt-touch #pt-mod-panel .pt-slide::before{height:10px;margin-top:-5px}
html.pt-touch #pt-mod-panel .pt-slide-fill{height:10px;margin-top:-5px}
html.pt-touch #pt-mod-panel .pt-slide-knob{width:24px;height:24px;margin:-12px 0 0 -12px}
html.pt-touch #pt-fab{width:56px;height:56px;line-height:56px;font-size:22px}`;
document.head.appendChild(css);
if(TOUCH)document.documentElement.classList.add("pt-touch");
panel=el("div");panel.id="pt-mod-panel";panel.style.display="none";
const head=el("div","pt-head");head.appendChild(el("span","pt-title","PolyMod Lite"));
langBtn=el("button","pt-mini","de"===lang?"DE":"EN");langBtn.type="button";langBtn.title="de"===lang?"Auf Englisch umschalten":"Switch to German";langBtn.style.marginLeft="auto",langBtn.style.marginRight="8px";langBtn.addEventListener("click",(e=>{e.preventDefault(),setLang("de"===lang?"en":"de")}));
const close=el("button","pt-close","\u00d7");close.type="button",close.title=tr("Close (Right Shift)"),close.addEventListener("click",(e=>{e.preventDefault(),open=!1,applyOpen()}));
head.appendChild(langBtn),head.appendChild(close),panel.appendChild(head);
tabBar=el("div","pt-tabs"),panelBody=el("div","pt-pane-wrap"),panel.appendChild(tabBar),panel.appendChild(panelBody);
document.body.appendChild(panel);
fabEl=el("button","","\u2630");fabEl.id="pt-fab";fabEl.type="button";fabEl.title=tr("Open PolyMod");fabEl.setAttribute("aria-label",tr("Open PolyMod"));
fabEl.addEventListener("click",(e=>{e.preventDefault(),e.stopPropagation(),open=!open,applyOpen(),fabEl.blur()}));
document.body.appendChild(fabEl);
const gripEl=el("div","pt-resize");gripEl.title=tr("Drag to resize");panel.appendChild(gripEl);
head.addEventListener("pointerdown",startDrag),head.addEventListener("pointermove",moveDrag),head.addEventListener("pointerup",endDrag),head.addEventListener("pointercancel",endDrag);
gripEl.addEventListener("pointerdown",startResize),gripEl.addEventListener("pointermove",moveResize),gripEl.addEventListener("pointerup",endResize),gripEl.addEventListener("pointercancel",endResize);
applyLayout();
addTab("Graphics",buildGraphicsTab);
addTab("Admin",buildAdminTab);
showTab("Graphics");
localizeTitles(panel);
applyOpen();
}
"loading"===document.readyState?document.addEventListener("DOMContentLoaded",buildUI):buildUI();
})();

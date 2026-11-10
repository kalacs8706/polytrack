/*CAMERA_ORBIT_IJKL*/(function(){
const keys=Object.create(null);
const DEFAULTS={left:"KeyJ",right:"KeyL",up:"KeyI",down:"KeyK"};
const ACTIONS=[["left","Orbit left"],["right","Orbit right"],["up","Camera up"],["down","Camera down"]];
const STORE="ptCamBindings",GFXKEY="ptGfx",HUDKEY="ptHud";
const bind=Object.assign({},DEFAULTS);
try{const saved=JSON.parse(localStorage.getItem(STORE)||"null");if(saved&&"object"==typeof saved)for(const k in DEFAULTS)"string"==typeof saved[k]&&saved[k]&&(bind[k]=saved[k])}catch(e){}
const gfx=Object.assign({scale:1,wireframe:!1,fov:1,dist:1},(function(){try{const v=JSON.parse(localStorage.getItem(GFXKEY)||"null");return v&&"object"==typeof v?v:{}}catch(e){return{}}})());
const hud=Object.assign({progress:!1,keys:!1,pos:"top"},(function(){try{const v=JSON.parse(localStorage.getItem(HUDKEY)||"null");return v&&"object"==typeof v?v:{}}catch(e){return{}}})());
let yaw=0,pitch=0,open=!1,capture=null,panel=null,tabBar=null,panelBody=null,replayStatus=null,camCalls=0;
const pad={up:!1,down:!1,left:!1,right:!1};
const tabs=[],tabHooks={},rate=2,limit=1.25;
const TRACK_NAMES={"5803f9e963625804e3de3246d043dc7dde847aa32e991f7f7326b0453f1fa038":"Summer 1","7eac4fee1111152cfba4d3737410264ca0f22c7f5a2211e79f0099589b8b48c0":"Summer 2","148826aa16ffaa23dbc453b32cff05e025ddbce1773fc7733cc13d218926515a":"Summer 3","93c7363dfea7fb09ca1d23b72cad5df43a30841d41c8ff25fb544c85bb03c7ae":"Summer 4","7603aaeffa1989a649dfaa8e1804bed4481b49df233e377687d0669899566e52":"Summer 5","c117823cf6788e3247b9ee63a0c091c07352bbe352c650a7790dc6718148c2fa":"Summer 6","e4bcaca3a583bb0eb62a700a69d14e89c852f0c5bf740fca76e0519ebdfc9ab1":"Summer 7","7239b17057127936907a805b0caa5d8c6f6c97eca9bdabf1a5312dce479629b7":"Winter 1","99864b635d1891d22e17eb9267527a07a92c49c0f02893729fa2ded90e3ca0f9":"Winter 2","a5341fe706097cff2a3812a3fc0d87399254557328351ae8e5c882700fc1a196":"Winter 3","7d134c939df80c676a258266201beedd3b93572d5603f3ff4339ff8679803715":"Winter 4","2fe4bd46b0075cc25fc770ce50adbb68447cf493c999635bb272d231811dd264":"Winter 5","c20b4ee3cd517ca6cae7e43f047548757287fbd08ba81b97892a3ef520159a34":"Desert 1","88647ea04145fbbbb19b55f1590e038fb0378acb2571110f02cb545cc46b0d57":"Desert 2","2806030c503abb41a1a26fa9a570888be14296172bb273798ef0ad87a108a2ec":"Desert 3","4697ea67b18c3f49b30a3d8884602115536650bc5435c88e3732e64d21a72d33":"Desert 4","e5d084e06db4ab71196fea44efeceb23c8561266a78669c324a38f92581fe2db":"Desert 5","387aab2d3400ebf74b5a780d15c911cdc695053b94be3e7ad23f6ae313b2471c":"La Infinita","a680fa81e6a4b9dec06b4197833f0a96334a275faf387d495c9c674ffd6b8686":"Oyasumi","439f1c61263987365996667f99d65f899ec482dfe21c64edcd9a1b1ae5b4a0a9":"Zenith","dc7783fef2a5fbb7a2d75b9c6fdd6a9d600b833d47c6274374ea4388c707517a":"\ud835\udd1a\ud835\udd26\ud835\udd2b\ud835\udd31\ud835\udd22\ud835\udd2f\ud835\udd31\ud835\udd26\ud835\udd21\ud835\udd22","f40d385d5e97e00a166a9a05d19789d8f2bf3621a8c1c8919c8bec41ab6347ab":"The CrossFades","d57a81355f36d5ef0bd2c063d251baf6d28401c275a8b3e3a62e0ae5071a2559":"Out of Bounds","225fad12335dadc12b60bfa1b31369b1026d8a084fd4670583870fb3b71f7ec0":"Solaris","0338f449b9948f06c03ffc2ab3ab6cf551fd08a9f2c09a16156b93ef52dd4411":"\u0741\u02d6.\u02da Evanescent Bliss. \u0741\u208a\u02da .","27c3384de80b1bed23f1ea15316abe62c8cca33e955805f23d461803f6dee8d4":"\ud800\udf00\ud800\udf15\ud800\udf0b\ud800\udf00\ud800\udf0d\ud800\udf15\ud800\udf09\ud800\udf14","d9bc51ec180bc46558e079c7949ba10b9ade52078c4c145f217a6a8543df2377":"Tucks Factory","5159a8dac6a1f397407a7b5233ad570613531f6609f7dc897490c28c9f2c7a4e":"Apostle","1783b7b6c30e7fddf7ffb7c8a4a8a3b65c1ef6ec317d908d6eb05e6c905a57f6":"Stardust","ddfe00045807e2786552d1e31e1363384c365487180f65d4eff1aa41e334a8e8":"Overclocked","4058e3616fbd79b848e70037adde4f12b4413011050aaf1c9d875cdbe2e33d68":"Amberbound","2ec74a179c8aba94354e3c6dee2a2920bedd7d84adf4d0a691f4a7453afdb1e8":"The Eldritch Estate","76e1920a3ca015033a0b21156848def2c248c95d97ccf4aab2312a0302beefe0":"Star Bound","81cede50724b1ee0c2ebcef973c37d620680766bd75771c5ae2728b8732c7a66":"Natsu","76269faf38e8726671c05b2b9044f7aa3e66c4313cb4fa5d0fbb23fc8524fe9e":"Lenore","151f12fd3ebc8942f7aaef669024a0fc149bc220f370753efe14d9371acc9c87":"sandy lanes II","f9283607ecec9c89583205cf08715c8f504cc271eec51209bb6fc0cc37ddc915":"Planet 97","64bf7efaed2a47dfb03a6b152e3aef637ac251b68a725a28352f3376ff1384d7":"Marvelous Marble","520c4f511821ced30b99bceafbb02e6b7531e867126b0756e68d5e157691ef2f":"Arx Lucida","315c9e95c567cce4feca78f5ad6e8d08d0a22dac0d56061af567b43eea3d4fa8":"Koselig","a8913b96daceb5b615fe45aad2bb104e04eb7db140242934657111e1d1f55b89":"Sky Bound","66f43b2d2a17f3cee05a127040ca409795058510bd3d1ac7eee224512ec532f5":"ShardMir","fcbba504800751b0fb404a7cd1c9591befdf688ad5451ab2bc1f3651590cc5fc":"\ud835\udd16\ud835\udd31\ud835\udd22\ud835\udd26\ud835\udd2b\ud835\udd34\ud835\udd1e\ud835\udd29\ud835\udd29\ud835\udd1f\ud835\udd32\ud835\udd2f\ud835\udd24","9ba44e8eafd0158e7e1f63e7d609db308c53f337b79e86bd0b630225451eef34":"\ud835\udd7b\ud835\udd86\ud835\udd97\ud835\udd86\ud835\udd89\ud835\udd8e\ud835\udd98\ud835\udd8a \ud835\udd7b\ud835\udd86\ud835\udd91\ud835\udd86\ud835\udd88\ud835\udd8a","b3889905b6df31cbe302e58e975988385607771605bf6e8e8e8e31b3d2dc8aa1":"Sunken Glyphs","3cd94552b12fb3a8ac45ca3a5e21a882b71b31c788989b396ab382afc69414ac":"Grimspyre","3125a5f98c3b43cf1e2604e25e8504bffd714ea5843200fa8ddf0b4c58842f16":"Magenta Mines","a2137c20c03ad1848098b47f70417cc0b0bf169010c825dc6fb82f37066808a0":"Cruising Altitude","d03b9f7c10c95f40eed389458be51bdf2437febd5673d028da134e59e503c10b":"Termite Terror","f68a709a296a60f6e6f73a2da670f95aca424be0f2fda5d6b608ece71f339b7c":"4 seasons","a1f41dc9e884d5d4b1b6025158d70f0934dc4d892076e6c4b32dc3f3846b882e":"Lost at sea","b430aad5e481caa4588e30f46352b876b62f1ba0cf7730a15efd026c91a8f32e":"Frosted Fjords \u5bd2\u3044","95d8f7cbe11053dbdfaeeb2f3c3d8f53f0d45fb6abeb411a74949a4cf52f427f":"\u301c\u2727\u301c\u1e3cevitation\u301c\u2727\u301c","409f26b9faf55bd0ad748177bf85ebdcfc0ddd572190e7f464f38b4a60587b7e":"Frozen Ramparts","c1a2c5aef1029d7bbf946f08cd087dd25bad6e019a41694a48a0024c27627dc8":"Tangled Cliffs","9e53d03f4efe86834c49ce202b528d769d9aa7a6e17732d0fc56440463956a1b":"Sludge Pipe Circuit","b77ec520a40c4b38d3d7d653b747b1f8627c98709096568db22cd1bfec534ba6":"Zealot","9f827673c4132828009237a03e12ead73eae87504b4708a79c6cc0858212262d":"Shrouded Oasis","9acd9aef650c4ccc41bb01f72ed44dfaa13f2e4404d2e3466f09cc1adcd9a9c0":"\u2699\ufe0eCogware\u2699\ufe0e","62d9989187e4508f7866e7b30aa187ddbee2595df21ff5988d7fec3589f9048d":"Land of the Rising Sun","b36162623435dc90a54f57590d2baa9f2d67a51cb12c393531f4b6d5e5528ebf":"Midas Metropolis","74ae56c0f278a19f3b69f3903198c7b9de09981133205856b53bf6bdf8db4211":"Frozen In Time","9f4597449906aa0c2baf9a4737406385c829533e64e9e972b25b4189f4593a54":"Winterfell","28b658c7d10eb8b5de6f465e034e87e40f70b37e4534d8c37d1f2af06b5a36d7":"Launch Control","470af92ed4c0a6f62028d7dea4dbc7765d1db16a3698d6a0c271be582a20a7c6":"Fractured Shores","a6b990137e404c9ef2cb4399c463acbed8ebfa3bb82ab5315027118604c4ec03":"Starry Tropisx","35fe02bf18312713c05528f0b7b8fd15c83dac50bcdcbd373040a16e8bfcc138":"Flying Dreams","18b69f54f119cfb2867abded9a1574f0799a750ef94aa744d9ec8ef6b4d565ae":"Ghost City","5ea46b3ae268a0196dcc59dabe88926400b56e29814658bfed06a284f837cefd":"MOS ESPA","ab8e1c13ddf394102be1cb04adcff8411127f1e7140a216d27a94fc19b7d0428":"Joenail Jones","86335d78d1a06d3dc81d80f84b8ac2e8f6359e9a206826e2c36f7d3f4351bea4":"Anubis","a510bbd3341f2992a12db8a3780cb8943b6087538345d58d16602d6129742df0":"Natsuj\u014d","8cf99166f12cbb56a9df4e022a0e9b8c78973adb929dbf1e265ebb9f99f01163":"Arabica","33d99aad2ad5cef45b1d3afb8735c5229cfd98ac7cc24916e0da7283f7a545ce":"Hyperion's Sanctuary","5c00f2c90bcf8230183484225d1a417e45b0ad310379acfafd4c8f1dc7345dd7":"Winter Hollow","009fad7fcc215022c6b2dbb2b6de622f07cd88d4930b8e2b6a6b74c1f5de9e44":"Clay temples","1ad53694ee3e96aea27afa7b64d5c29d115de88a17b69cf3fe3f5609c52b040b":"Las Calles","2ed125037366052871fbb97da6e1bda49cfeb471f6b9c8fa799d520bdb3683e2":"DESERT STALLION","f79b1d863d50f9e3b4489988698065c6d775ff3ec90bf91085bad05ad5ec8316":"Last Remnant","27429a1d1bf05770851e3919af70f47c6cd7a269c67032b084fb4345f6c271ce":"lu muvimento","f5c327cf09b90e4de8c3c1f9c910dbb7988cf15485d2e4beec3cc03aef408c5c":"90*RESET","7451c2128cb96bc28195cf0ca0f83a46c3b55d78d434232d9de085dd1cf0ab36":"Opal Palace - Repolished","af6ef508e1f6e47a462a6998b950ef535d1e8a38fe67ead891bf5f2de1346f43":"Re : Akina","089f2aebcfe4f24d8dda3a8a630172d2bd13793e78c5247adfaa760743a377e1":"Sandline Ultimatum","5e40f730509204c77e9c610839ed43addddbe0f8aa007168447f7fde38583905":"Malformations","191737cc4d1b74949e992d99371e5c7f5fc446a716af571c6e5449b23e9f4558":"Snow Park","39bd3fa6c3c769b298c219aee7561af35a6d856bfee14b46b0b48499e7a57ed5":"concrete jungle"};;;
const OFFICIAL={"5803f9e963625804e3de3246d043dc7dde847aa32e991f7f7326b0453f1fa038":{"url":"tracks/official/summer1.track","name":"Summer 1"},"7eac4fee1111152cfba4d3737410264ca0f22c7f5a2211e79f0099589b8b48c0":{"url":"tracks/official/summer2.track","name":"Summer 2"},"148826aa16ffaa23dbc453b32cff05e025ddbce1773fc7733cc13d218926515a":{"url":"tracks/official/summer3.track","name":"Summer 3"},"93c7363dfea7fb09ca1d23b72cad5df43a30841d41c8ff25fb544c85bb03c7ae":{"url":"tracks/official/summer4.track","name":"Summer 4"},"7603aaeffa1989a649dfaa8e1804bed4481b49df233e377687d0669899566e52":{"url":"tracks/official/summer5.track","name":"Summer 5"},"c117823cf6788e3247b9ee63a0c091c07352bbe352c650a7790dc6718148c2fa":{"url":"tracks/official/summer6.track","name":"Summer 6"},"e4bcaca3a583bb0eb62a700a69d14e89c852f0c5bf740fca76e0519ebdfc9ab1":{"url":"tracks/official/summer7.track","name":"Summer 7"},"7239b17057127936907a805b0caa5d8c6f6c97eca9bdabf1a5312dce479629b7":{"url":"tracks/official/winter1.track","name":"Winter 1"},"99864b635d1891d22e17eb9267527a07a92c49c0f02893729fa2ded90e3ca0f9":{"url":"tracks/official/winter2.track","name":"Winter 2"},"a5341fe706097cff2a3812a3fc0d87399254557328351ae8e5c882700fc1a196":{"url":"tracks/official/winter3.track","name":"Winter 3"},"7d134c939df80c676a258266201beedd3b93572d5603f3ff4339ff8679803715":{"url":"tracks/official/winter4.track","name":"Winter 4"},"2fe4bd46b0075cc25fc770ce50adbb68447cf493c999635bb272d231811dd264":{"url":"tracks/official/winter5.track","name":"Winter 5"},"c20b4ee3cd517ca6cae7e43f047548757287fbd08ba81b97892a3ef520159a34":{"url":"tracks/official/desert1.track","name":"Desert 1"},"88647ea04145fbbbb19b55f1590e038fb0378acb2571110f02cb545cc46b0d57":{"url":"tracks/official/desert2.track","name":"Desert 2"},"2806030c503abb41a1a26fa9a570888be14296172bb273798ef0ad87a108a2ec":{"url":"tracks/official/desert3.track","name":"Desert 3"},"4697ea67b18c3f49b30a3d8884602115536650bc5435c88e3732e64d21a72d33":{"url":"tracks/official/desert4.track","name":"Desert 4"},"e5d084e06db4ab71196fea44efeceb23c8561266a78669c324a38f92581fe2db":{"url":"tracks/official/desert5.track","name":"Desert 5"}};;
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
lastCar.x=t.x,lastCar.y=t.y,lastCar.z=t.z,lastCar.t=performance.now();
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
pane.appendChild(el("div","pt-hint","Hold the arrows above or IJKL to orbit. Press Right Shift to open or close this panel."))
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
const items=listRecords(),cur=activeSlot();
count.textContent=items.length+(1===items.length?" replay":" replays")+(null!==cur?" \u00b7 "+profileName("polytrack_v5_prod_",cur):"");
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
toggleRow(pane,"Wireframe",()=>gfx.wireframe,(v)=>{gfx.wireframe=v,setWireframe(v)});
sliderRow(pane,"Render scale",0.5,2,0.05,()=>gfx.scale,(v)=>{gfx.scale=v,applyScale(renderer)});
sliderRow(pane,"FOV",0.6,1.8,0.05,()=>gfx.fov,(v)=>{gfx.fov=v});
sliderRow(pane,"Camera distance",0.5,3,0.05,()=>gfx.dist,(v)=>{gfx.dist=v});
const row=el("div","pt-row");const info=el("span","pt-meta","");
const syncInfo=()=>{info.textContent=renderer?(Math.round(drawCalls)+" draws"):"no renderer yet"};
row.appendChild(info);pane.appendChild(row);
const btn=el("button","pt-wide pt-secondary","Reapply");btn.type="button";
btn.addEventListener("click",(e=>{e.preventDefault(),applyScale(renderer),setWireframe(gfx.wireframe),syncInfo()}));
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
copy.addEventListener("click",(e=>{e.preventDefault();const data={fps:fps,frameMs:+frameMs.toFixed(2),drawCalls:drawCalls,triangles:triangles,car:{x:lastCar.x,y:lastCar.y,z:lastCar.z},yaw:yaw,pitch:pitch,pixelRatio:renderer&&renderer.getPixelRatio?renderer.getPixelRatio():null,scale:gfx.scale,fov:gfx.fov,dist:gfx.dist,wireframe:gfx.wireframe,panel:window.__ptCamPatch,ua:navigator.userAgent};
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

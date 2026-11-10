// Build: cheats tab + car-only speed stepping, injected into every Worker message
const fs = require("fs");
const { execSync } = require("child_process");
const sh = (cmd, cwd) => execSync(cmd, { cwd: cwd || "/tmp", stdio: ["ignore", "pipe", "pipe"] }).toString();

const PRISTINE = "/home/balint/Asztal/app.asar";
const WORK = "/tmp/pt_b6", OUT = "/tmp/out6.asar", VERIFY = "/tmp/v6";

fs.rmSync(WORK, { recursive: true, force: true });
fs.rmSync(VERIFY, { recursive: true, force: true });
fs.rmSync(OUT, { force: true });
sh(`asar extract ${PRISTINE} ${WORK}`);

/* ---------- main bundle ---------- */
const bp = `${WORK}/main.bundle.js`;
let bundle = fs.readFileSync(bp, "utf8");

let patch = fs.readFileSync("mod5.js", "utf8");
const maps = fs.readFileSync("mod4_final.js", "utf8");
const m1 = maps.indexOf("const TRACK_NAMES="), m2 = maps.indexOf("\n", m1);
const m3 = maps.indexOf("const OFFICIAL="), m4 = maps.indexOf("\n", m3);
if (m1 < 0 || m3 < 0) throw new Error("track maps not found");
patch = patch.replace("__PT_TRACK_NAMES__", maps.slice(m1 + "const TRACK_NAMES=".length, m2))
             .replace("__PT_OFFICIAL__", maps.slice(m3 + "const OFFICIAL=".length, m4));
if (patch.includes("__PT_")) throw new Error("placeholder left");
if (!patch.includes("__ptCheatHooked")) throw new Error("mod5 missing postMessage hook");
fs.writeFileSync("mod5_final.js", patch);

const ANCHOR = "m={value:70};const k=x;";
if (bundle.split(ANCHOR).length - 1 !== 1) throw new Error("anchor");
bundle = bundle.replace(ANCHOR, ANCHOR + patch);

const TAIL = "t.loadedResource()}()";
if (bundle.split(TAIL).length - 1 !== 1) throw new Error("tail");
bundle = bundle.replace(TAIL, fs.readFileSync("replayhook.txt", "utf8") + TAIL);

const JEP = '(0,i.GG)(this,S,new a.JeP(s),"f")';
if (bundle.split(JEP).length - 1 !== 2) throw new Error("renderer sites");
bundle = bundle.split(JEP).join('(0,i.GG)(this,S,(window.__ptMakeRenderer||a.JeP)(s),"f")');
fs.writeFileSync(bp, bundle);
sh(`node --check ${bp}`);

/* ---------- simulation worker ---------- */
const wp = `${WORK}/simulation_worker.bundle.js`;
let w = fs.readFileSync(wp, "utf8");

const LIVE = "else{const e=t.controls.getControls(t.frames);i.push({car:t,controls:e}),t.frames++}";
if (w.split(LIVE).length - 1 !== 1) throw new Error("live car branch");
w = w.replace(LIVE, "else{const e=t.controls.getControls(t.frames);__ptStep(i,t,e),t.frames++}");

const APPEND = `
;(function(){
var g=self;if(g.__ptCheatSetup)return;g.__ptCheatSetup=1;
g.__ptCheat={speed:1,friction:1};
var tick=0;
g.__ptStep=function(list,car,controls){
var c=controls,f=+g.__ptCheat.friction;
if(isFinite(f)&&f!==1){tick++;var phase=(tick%24)/24;
if(f>1){if(!c.up&&phase<Math.min(.75,f-1))c=Object.assign({},c,{down:!0})}
else if(!c.down&&phase<Math.min(.45,1-f))c=Object.assign({},c,{up:!0})}
list.push({car:car,controls:c});
var s=+g.__ptCheat.speed;
if(isFinite(s)&&s>1){car.__ptAcc=(car.__ptAcc||0)+(s-1);
while(car.__ptAcc>=1){car.__ptAcc-=1;list.push({car:car,controls:c});car.frames++}}};
g.addEventListener("message",function(e){
var d=e.data;if(!d||!d.ptCheat)return;
var s=+d.ptCheat.speed,f=+d.ptCheat.friction;
if(isFinite(s)&&s>0)g.__ptCheat.speed=Math.min(6,Math.max(1,s));
if(isFinite(f))g.__ptCheat.friction=Math.min(3,Math.max(0,f));
try{g.postMessage({messageType:"ptCheatAck",ptCheat:{speed:g.__ptCheat.speed,friction:g.__ptCheat.friction}})}catch(err){}})})();
`;
w += APPEND;
fs.writeFileSync(wp, w);
sh(`node --check ${wp}`);

/* ---------- unit-test the injected worker logic ---------- */
{
  const stub = { __ptCheatSetup: 0, listen: null, addEventListener(t, f) { if (t === "message") this.listen = f }, postMessage() {} };
  new Function("self", APPEND.replace(/^;/, ""))(stub);
  const car = { frames: 0 };
  let list = [];
  stub.__ptCheat.speed = 2;
  stub.__ptStep(list, car, { up: true });
  if (list.length !== 2) throw new Error("speed 2 pushed " + list.length);
  if (car.frames !== 1) throw new Error("extra step did not advance frames");
  list = [];
  stub.__ptStep(list, car, { up: true });
  if (list.length !== 2) throw new Error("second substep did not keep pace");
  stub.__ptCheat.speed = 1.5;
  list = []; car.frames = 0;
  for (let i = 0; i < 10; i++) stub.__ptStep(list, car, { up: true });
  if (list.length !== 15) throw new Error("1.5x pushed " + list.length + " over 10 substeps");
  stub.__ptCheat.speed = 1;
  stub.__ptCheat.friction = 2;
  let braked = 0;
  for (let i = 0; i < 24; i++) { list = []; stub.__ptStep(list, {}, { up: false, down: false }); if (list[0].controls.down) braked++; }
  if (braked === 0) throw new Error("friction>1 never braked");
  stub.__ptCheat.friction = 0;
  let throttled = 0;
  for (let i = 0; i < 24; i++) { list = []; stub.__ptStep(list, {}, { up: false, down: false }); if (list[0].controls.up) throttled++; }
  if (throttled === 0) throw new Error("friction<1 never throttled");
  stub.listen({ data: { ptCheat: { speed: 2.5, friction: 0.5 } } });
  if (stub.__ptCheat.speed !== 2.5 || stub.__ptCheat.friction !== 0.5) throw new Error("message did not update state");
  console.log("worker logic ok: speed steps, friction nudges, message handling");
}

/* ---------- pack + verify ---------- */
sh(`asar pack ${WORK} ${OUT}`);
sh(`asar extract ${OUT} ${VERIFY}`);
sh(`node --check ${VERIFY}/main.bundle.js`);
sh(`node --check ${VERIFY}/simulation_worker.bundle.js`);
const vm = fs.readFileSync(`${VERIFY}/main.bundle.js`, "utf8");
const vw = fs.readFileSync(`${VERIFY}/simulation_worker.bundle.js`, "utf8");
for (const p of ["__ptStartReplay=function", "applyOrbit", "pt-padbtn", "buildCheatsTab", "__ptCheatHooked"])
  if (!vm.includes(p)) throw new Error("main missing " + p);
for (const p of ["__ptStep", "ptCheatAck", "car.__ptAcc", "__ptStep(i,t,e)"])
  if (!vw.includes(p)) throw new Error("worker missing " + p);
if (vw.includes("self.__ptCheat?self.__ptCheat.speed:1")) throw new Error("whole-clock scaling still present");

/* ---------- install ---------- */
fs.copyFileSync(OUT, "resources/app.asar");
fs.copyFileSync(OUT, "resources/app1.asar");
fs.copyFileSync(bp, "app/main.bundle.js");
fs.copyFileSync(wp, "app/simulation_worker.bundle.js");
console.log("installed", fs.statSync(OUT).size, "bytes");

// PolyMod Lite build: pristine PolyTrack 0.6.3 bundle + mod_lite.js (video settings + admin),
// packaged as polytrack-lite.zip with render.yaml + web/ at the archive root, so unzipping it
// at the root of a Git repo gives Render a working static site with no build step.
//   node build_lite.cjs https://your-api.example.com/
// The API base is baked into web/api-origin.js (window.__ptAPIBase); the bundle reads it at
// runtime, so it can also be changed in that one file after the build.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = __dirname;
const SRC = "/tmp/ptlite-src";
const OUT = path.join(ROOT, "polytrack-lite");
const WEB = path.join(OUT, "web");
const PRISTINE = path.join(ROOT, "resources", "app.asar.orig");
const ZIP = path.join(ROOT, "polytrack-lite.zip");

const API = (process.argv[2] || "").trim();
if (!/^https?:\/\/[^"'\s]+\/$/.test(API)) {
  console.error("usage: node build_lite.cjs https://your-api.example.com/");
  process.exit(1);
}

fs.rmSync(SRC, { recursive: true, force: true });
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// 0.6.3 evidence: the archive must still be the pristine one.
const md5 = execFileSync("md5sum", [PRISTINE]).toString().split(/\s+/)[0];
if (md5 !== "cdc154858a7930feaaab329cef3fa1eb") throw new Error("app.asar.orig changed: " + md5);
execFileSync("npx", ["--no-install", "asar", "extract", PRISTINE, SRC], { stdio: "inherit" });

const MB = path.join(SRC, "main.bundle.js");
let src = fs.readFileSync(MB, "utf8");

// Track names for the admin list come from the original mod's map.
const maps = fs.readFileSync(path.join(ROOT, "mod4_final.js"), "utf8");
const mapLine = (n) => {
  const m = new RegExp("^const " + n + "=(.*)$", "m").exec(maps);
  if (!m) throw new Error("map " + n + " missing");
  return m[1];
};
let mod = fs.readFileSync(path.join(ROOT, "mod_lite.js"), "utf8")
  .replace("__PT_TRACK_NAMES__", () => mapLine("TRACK_NAMES"));
if (/__PT_[A-Z_]+__/.test(mod)) throw new Error("unfilled placeholder in mod_lite.js");

const ANCHOR = "m={value:70};const k=x;";
if (src.split(ANCHOR).length - 1 !== 1) throw new Error("mod anchor missing");
src = src.replace(ANCHOR, ANCHOR + "\n" + mod);

// Antialiasing: let the mod's setting win, and remember the game's own value for the UI.
const AA = "antialias:t?.getSettingBoolean(O.A.Antialiasing)??!0";
const AAN = "antialias:(window.__ptGameAA=!!(t?.getSettingBoolean(O.A.Antialiasing)??!0),window.__ptAA?window.__ptAA(window.__ptGameAA):window.__ptGameAA)";
const aaCount = src.split(AA).length - 1;
if (aaCount < 1) throw new Error("AA anchor missing");
src = src.split(AA).join(AAN);
console.log(`antialias hook: ${aaCount} site(s)`);

// Renderer: hook the instance the game builds so scale/wireframe/draw-call stats work.
const JEP = '(0,i.GG)(this,S,new a.JeP(s),"f")';
const jepCount = src.split(JEP).length - 1;
if (jepCount < 1) throw new Error("renderer anchor missing");
src = src.split(JEP).join('(0,i.GG)(this,S,(window.__ptHookRenderer||function(r){return r})(new a.JeP(s)),"f")');
console.log(`renderer hook: ${jepCount} site(s)`);

// Server: every v6 call goes through the runtime base, so api-origin.js can repoint it.
const KODUB = '"https://vps.kodub.com/"';
const kodubCount = src.split(KODUB).length - 1;
if (kodubCount < 1) throw new Error("kodub base missing");
src = src.split(KODUB).join('(window.__ptAPIBase||"https://vps.kodub.com/")');

fs.writeFileSync(MB, src);
execFileSync("node", ["--check", MB], { stdio: "inherit" });
for (const p of ["__ptHookRenderer", "__ptAA", "POLYMOD_LITE", "__ptAPIBase||"])
  if (!src.includes(p)) throw new Error("bundle missing " + p);
if (src.includes("CAMERA_ORBIT_IJKL") || src.includes("ptCheatHook") || src.includes("__ptStartReplay"))
  throw new Error("lite bundle picked up full-mod code");
console.log(`bundle patched: mod inserted, AA + renderer hooks, ${kodubCount} API call sites`);

// Site tree, then the one-line server pointer and its script tag.
fs.cpSync(SRC, WEB, { recursive: true });
const IDX = path.join(WEB, "index.html");
let html = fs.readFileSync(IDX, "utf8");
const TAG = '<script defer="defer" src="main.bundle.js"></script>';
if (html.split(TAG).length - 1 !== 1) throw new Error("index.html script tag missing");
html = html.replace(TAG, '<script defer="defer" src="api-origin.js"></script>' + TAG);
fs.writeFileSync(IDX, html);
fs.writeFileSync(
  path.join(WEB, "api-origin.js"),
  "// PolyTrack Lite: the server the game talks to. This is your own API, not Kodub's.\n" +
    "// Change this one line to point the site at a different deployment.\n" +
    'window.__ptAPIBase = "' + API + '";\n',
);

// The custom server ships next to the site so the same repo can deploy it.
fs.cpSync(path.join(ROOT, "server"), path.join(OUT, "server"), { recursive: true });
fs.writeFileSync(
  path.join(OUT, "render.yaml"),
  `# Render Blueprint for PolyTrack Lite.
# Unzip polytrack-lite.zip at the root of your repo: this file lands next to web/.
# "name" must match the service name in your Render dashboard, otherwise Render
# creates a second site instead of updating the existing one.
services:
  - type: web
    name: pserver2026
    runtime: static
    staticPublishPath: ./web
    headers:
      - path: /*.wasm
        name: Content-Type
        value: application/wasm
      - path: /**/*.wasm
        name: Content-Type
        value: application/wasm
`,
);

// Zip flat: render.yaml and web/ sit at the archive root. The .orig archive and local secrets stay out.
fs.rmSync(ZIP, { force: true });
execFileSync("python3", ["-c", `
import os, zipfile
root = ${JSON.stringify(OUT)}
out = ${JSON.stringify(ZIP)}
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for d, _, files in os.walk(root):
        for f in sorted(files):
            p = os.path.join(d, f)
            if f.endswith((".asar", ".orig")) or f.startswith("admin-password"):
                continue
            z.write(p, os.path.relpath(p, root))
`], { stdio: "inherit" });

const zip = fs.readFileSync(ZIP);
const pages = execFileSync("python3", ["-c", `import zipfile;print("\\n".join(zipfile.ZipFile(${JSON.stringify(ZIP)}).namelist()))`]).toString().trim().split("\n");
for (const must of [
  "render.yaml",
  "web/index.html",
  "web/api-origin.js",
  "web/main.bundle.js",
  "web/polytrack_physics.wasm",
  "web/lib/draco/draco_decoder.wasm",
  "server/index.js",
  "server/manifest.json",
]) if (!pages.includes(must)) throw new Error("zip missing " + must);

console.log(`zip: ${pages.length} entries, ${(zip.length / 1048576).toFixed(1)} MiB -> ${path.relative(ROOT, ZIP)}`);
console.log(`server: ${API}`);

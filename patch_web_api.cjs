// Repoints the extracted web build at the self-hosted PolyTrack API and wires the
// multiplayer signalling shim (see mod_mp.js). Run after any `asar extract` into web/:
//   node patch_web_api.cjs [api-base]
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_API = "https://site-ba117be33b694461992db987ce77b70d.freebuff.page/";
const API = (process.argv[2] || DEFAULT_API).replace(/\/?$/, "/");
const MP_BASE = API.replace(/\/+$/, "");
const file = path.join(__dirname, "web", "main.bundle.js");

let out = fs.readFileSync(file, "utf8");
const kodub = "https://vps.kodub.com/";
const kodubCount = out.split(kodub).length - 1;

if (kodubCount === 0 && !out.includes(API)) {
  console.error("no kodub base URL and no API URL found — unexpected bundle");
  process.exit(1);
}
out = out.split(kodub).join(API);

// The relay shim only activates when the web build knows the API origin.
const marker = "window.__ptMPBase=";
if (!out.includes(marker)) {
  out = 'window.__ptMPBase="' + MP_BASE + '";' + out;
}

// Route the two multiplayer sockets through the shim when it is installed.
const plain = "new WebSocket(";
const shimmed = "new ((window.__ptWS)||WebSocket)(";
const wsSites = out.split(plain).length - 1;
if (wsSites) out = out.split(plain).join(shimmed);

fs.writeFileSync(file, out);
console.log(
  `patched ${kodubCount} call sites -> ${API}; mp base ${MP_BASE}; ${wsSites} socket call(s) shim-aware`,
);
if (out.includes(kodub)) {
  console.error("warning: kodub references remain");
  process.exit(1);
}

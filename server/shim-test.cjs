// Drives mod_mp.js the way the game does: an offer followed immediately by
// every buffered ICE candidate, all in the same tick.
const fs = require("node:fs");
const API = "https://site-ba117be33b694461992db987ce77b70d.freebuff.page";
global.window = { __ptMPBase: API };
eval(fs.readFileSync("mod_mp.js", "utf8"));
const PTWS = global.window.__ptWS;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 8000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await sleep(100);
  }
  return false;
};
const open = async (ws) => until(() => ws.readyState === 1, 8000);

(async () => {
  const out = {};
  let failed = 0;
  const check = (name, ok, extra) => {
    console.log((ok ? "PASS  " : "FAIL  ") + name + (extra ? "  " + JSON.stringify(extra) : ""));
    if (!ok) failed++;
  };

  const hostMsgs = [];
  const host = new PTWS(API + "/v6/multiplayer/host");
  host.addEventListener("message", (e) => hostMsgs.push(JSON.parse(e.data)));
  check("host socket opens", await open(host));
  host.send(JSON.stringify({ version: "0.6.3", type: "createInvite", key: "k1" }));
  await until(() => hostMsgs.some((m) => m.type === "createInvite"));
  const code = (hostMsgs.find((m) => m.type === "createInvite") || {}).inviteCode;
  check("invite code returned", /^[A-Z0-9]{6}$/.test(code || ""), code);

  const guestMsgs = [];
  let guestClosed = false;
  const guest = new PTWS(API + "/v6/multiplayer/join");
  guest.addEventListener("message", (e) => guestMsgs.push(JSON.parse(e.data)));
  guest.addEventListener("close", () => (guestClosed = true));
  await open(guest);
  // Exactly what the client does on open: offer, then all buffered candidates at once.
  guest.send(JSON.stringify({ version: "0.6.3", inviteCode: code, offer: "OFFER_SDP", mods: [], isModsVanillaCompatible: true, nickname: "Guest", countryCode: null, carStyle: "{}" }));
  for (const c of ["c1", "c2", null]) guest.send(JSON.stringify({ version: "0.6.3", candidate: c === null ? null : { candidate: c } }));

  const gotJoin = await until(() => hostMsgs.some((m) => m.type === "joinInvite"));
  const ji = hostMsgs.find((m) => m.type === "joinInvite");
  check("host receives joinInvite despite the burst", !!gotJoin, ji && { offer: ji.offer, nickname: ji.nickname });
  check("guest socket stays open", !guestClosed);

  if (ji) {
    host.send(JSON.stringify({ type: "acceptJoin", session: ji.session, answer: "ANSWER_SDP", version: "0.6.3", mods: [], isModsVanillaCompatible: true, clientId: 5 }));
    await sleep(400);
    host.send(JSON.stringify({ version: "0.6.3", type: "iceCandidate", session: ji.session, candidate: { candidate: "h1" } }));
    host.send(JSON.stringify({ version: "0.6.3", type: "iceCandidate", session: ji.session, candidate: null }));
    const gotAnswer = await until(() => guestMsgs.some((m) => m.type === "acceptJoin"));
    check("guest receives acceptJoin", !!gotAnswer, (guestMsgs.find((m) => m.type === "acceptJoin") || {}).clientId);
    await until(() => guestMsgs.filter((m) => m.type === "iceCandidate").length >= 2);
    const guestIce = guestMsgs.filter((m) => m.type === "iceCandidate").map((m) => (m.candidate ? m.candidate.candidate : null));
    check("guest receives both host ICE frames", JSON.stringify(guestIce) === JSON.stringify(["h1", null]), guestIce);
    const hostIce = hostMsgs.filter((m) => m.type === "iceCandidate").map((m) => (m.candidate ? m.candidate.candidate : null));
    check("host receives all guest ICE frames", JSON.stringify(hostIce) === JSON.stringify(["c1", "c2", null]), hostIce);
    check("every relayed frame carries the session", hostMsgs.concat(guestMsgs).filter((m) => m.type === "iceCandidate").every((m) => typeof m.session === "string"));
  }
  out.end = true;
  host.close();
  guest.close();

  const badMsgs = [];
  const bad = new PTWS(API + "/v6/multiplayer/join");
  bad.addEventListener("message", (e) => badMsgs.push(JSON.parse(e.data)));
  await open(bad);
  bad.send(JSON.stringify({ version: "0.6.3", inviteCode: "ZZZZZZ", offer: "x", mods: [], isModsVanillaCompatible: true, nickname: "G", countryCode: null, carStyle: "{}" }));
  await until(() => badMsgs.length > 0, 6000);
  check("wrong code reports ExpiredInvite, not a network error", badMsgs[0] && badMsgs[0].type === "error" && badMsgs[0].error === "ExpiredInvite", badMsgs[0]);

  console.log(failed ? failed + " check(s) failed" : "all shim checks passed");
  process.exit(failed ? 1 : 0);
})();

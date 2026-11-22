// Live end-to-end checks against the deployed replacement API.
//   node server/live-test.cjs
const crypto = require("node:crypto");

const API = "https://site-ba117be33b694461992db987ce77b70d.freebuff.page";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(path, opts = {}) {
  const res = await fetch(API + path, { signal: AbortSignal.timeout(20000), ...opts });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {}
  return { status: res.status, body, text, headers: res.headers };
}
const jsonPost = (path, obj) =>
  req(path, { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify(obj) });
const formPost = (path, body) =>
  req(path, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
const get = (path) => req(path);

let failed = 0;
const check = (name, fn) => checks.push([name, fn]);
const checks = [];
const assert = {
  ok(v, m) {
    if (!v) throw new Error(m || "assertion failed");
  },
  eq(a, b, m) {
    if (a !== b) throw new Error((m || "not equal") + ": " + JSON.stringify(a) + " !== " + JSON.stringify(b));
  },
};

// The Worker hashes the token with SHA-256 and keeps the first 16 bytes (32 hex chars).
const hex = (n) => crypto.createHash("sha256").update(n).digest("hex").slice(0, 32);

check("relay is deployed", async () => {
  let last = null;
  for (let i = 0; i < 40; i++) {
    last = await jsonPost("/v6/mp/host", { key: "probe" });
    if (last.status === 200 && last.body && last.body.inviteCode) return;
    await sleep(1000);
  }
  throw new Error("relay not answering: " + last.status + " " + last.text.slice(0, 80));
});

check("iceServers exposes public STUN", async () => {
  const r = await get("/v6/iceServers?version=0.6.3");
  assert.eq(r.status, 200);
  assert.ok(Array.isArray(r.body) && r.body.length > 0, "empty ice server list");
  assert.ok(String(r.body[0].urls).includes("stun:"), "first entry is not STUN: " + JSON.stringify(r.body[0]));
});

let code = "";
let session = "";
let hostCursor = 0;

check("host creates an invite", async () => {
  const r = await jsonPost("/v6/mp/host", { key: "hostkey" });
  assert.eq(r.status, 200);
  assert.ok(/^[A-Z0-9]{6}$/.test(r.body.inviteCode), "unexpected invite code " + JSON.stringify(r.body.inviteCode));
  code = r.body.inviteCode;
});

check("guest joins and the host receives joinInvite", async () => {
  const join = await jsonPost("/v6/mp/join", {
    code,
    payload: {
      version: "0.6.3",
      offer: "OFFER_SDP",
      mods: [],
      isModsVanillaCompatible: true,
      nickname: "Guest",
      countryCode: null,
      carStyle: "{}",
    },
  });
  assert.eq(join.status, 200);
  assert.ok(typeof join.body.session === "string" && join.body.session.length > 8, "no session");
  session = join.body.session;

  const poll = await get(`/v6/mp/poll?code=${code}&role=host&after=0`);
  assert.eq(poll.status, 200);
  const msg = (poll.body.messages || [])[0];
  assert.ok(msg, "host poll returned nothing");
  assert.eq(msg.type, "joinInvite");
  assert.eq(msg.offer, "OFFER_SDP");
  assert.eq(msg.session, session);
  assert.eq(msg.nickname, "Guest");
  assert.ok(Array.isArray(msg.iceServers), "joinInvite lost iceServers");
  hostCursor = poll.body.cursor;
});

check("host answer reaches the guest", async () => {
  const send = await jsonPost("/v6/mp/send", {
    role: "host",
    code,
    payload: {
      type: "acceptJoin",
      session,
      answer: "ANSWER_SDP",
      version: "0.6.3",
      mods: [],
      isModsVanillaCompatible: true,
      clientId: 7,
    },
  });
  assert.eq(send.status, 200);
  const poll = await get(`/v6/mp/poll?code=${code}&role=guest&session=${session}&after=0`);
  const msg = (poll.body.messages || [])[0];
  assert.ok(msg, "guest poll returned nothing");
  assert.eq(msg.type, "acceptJoin");
  assert.eq(msg.answer, "ANSWER_SDP");
  assert.eq(msg.clientId, 7);
});

check("guest ICE reaches the host typed and sessioned", async () => {
  await jsonPost("/v6/mp/send", {
    role: "guest",
    code,
    session,
    payload: { version: "0.6.3", candidate: { candidate: "cand-guest" } },
  });
  const poll = await get(`/v6/mp/poll?code=${code}&role=host&after=${hostCursor}`);
  const msg = (poll.body.messages || [])[0];
  assert.ok(msg, "host got no ICE frame");
  assert.eq(msg.type, "iceCandidate");
  assert.eq(msg.session, session);
  assert.eq(msg.candidate.candidate, "cand-guest");
  hostCursor = poll.body.cursor;
});

check("host ICE reaches the guest", async () => {
  await jsonPost("/v6/mp/send", {
    role: "host",
    code,
    payload: { type: "iceCandidate", session, candidate: { candidate: "cand-host" } },
  });
  const poll = await get(`/v6/mp/poll?code=${code}&role=guest&session=${session}&after=0`);
  const msg = (poll.body.messages || [])[0];
  assert.ok(msg, "guest got no ICE frame");
  assert.eq(msg.type, "iceCandidate");
  assert.eq(msg.candidate.candidate, "cand-host");
});

check("unknown invite is rejected", async () => {
  const r = await jsonPost("/v6/mp/join", { code: "ZZZZZZ", payload: { offer: "x" } });
  assert.eq(r.status, 404);
});

const trackId = crypto.randomBytes(32).toString("hex");
const token = "livetoken" + Date.now();
let entryId = 0;

check("submitted run is stored as verified", async () => {
  const r = await formPost(
    "/v6/leaderboard",
    `version=0.6.3&userToken=${encodeURIComponent(token)}&nickname=${encodeURIComponent("Live Racer")}` +
      `&carStyle=%7B%7D&trackId=${trackId}&frames=12345&recording=REC123&speed=1.5&grip=0.8`,
  );
  assert.eq(r.status, 200);
});

check("verified leaderboard lists the run", async () => {
  const r = await get(`/v6/leaderboard?version=0.6.3&trackId=${trackId}&skip=0&amount=10&onlyVerified=true`);
  assert.eq(r.status, 200);
  assert.eq(r.body.total, 1);
  const e = r.body.entries[0];
  assert.eq(e.verifiedState, 1, "entry is not verified");
  assert.eq(e.frames, 12345);
  // The client parses this with new Date(), so it has to be a string.
  assert.ok(typeof e.time === "string", "time is not a string: " + JSON.stringify(e.time));
  assert.ok(!Number.isNaN(Date.parse(e.time)), "time is not a parseable date: " + e.time);
  assert.ok("userEntry" in r.body, "userEntry field is missing");
  assert.eq(e.nickname, "Live Racer");
  assert.eq(e.cheatSpeed, 1.5, "cheat speed was not stored");
  assert.eq(e.cheatGrip, 0.8, "cheat grip was not stored");
  entryId = e.id;
});

check("unfiltered leaderboard lists the same run", async () => {
  const r = await get(`/v6/leaderboard?version=0.6.3&trackId=${trackId}&skip=0&amount=10&onlyVerified=false`);
  assert.eq(r.body.total, 1);
});

check("leaderboard recognises your own row", async () => {
  const h = hex(token);
  const r = await get(
    `/v6/leaderboard?version=0.6.3&trackId=${trackId}&skip=0&amount=10&onlyVerified=true&userTokenHash=${h}`,
  );
  assert.eq(r.status, 200);
  assert.eq(r.body.entries[0].userId, h, "userId is not the token hash the client sent");
  assert.ok(r.body.userEntry, "userEntry should be present for your own run");
  assert.eq(r.body.userEntry.position, 1);
  assert.eq(r.body.userEntry.frames, 12345);
});

check("leaderboard replay can be loaded", async () => {
  const r = await get(`/v6/recordings?version=0.6.3&ids=${entryId}`);
  assert.eq(r.status, 200);
  assert.ok(Array.isArray(r.body));
  assert.eq(r.body[0].recording, "REC123");
  assert.eq(r.body[0].frames, 12345);
  assert.eq(r.body[0].verifiedState, 1);
});

check("user entry lookup finds the run", async () => {
  const r = await get(
    `/v6/leaderboardUserEntry?version=0.6.3&trackId=${trackId}&userTokenHash=${hex(token)}&onlyVerified=true`,
  );
  assert.eq(r.status, 200);
  assert.eq(r.body.position, 1);
  assert.eq(r.body.frames, 12345);
});

const ADMIN_PW = require("node:fs").readFileSync("admin-password.txt", "utf8").trim();
let adminTok = "";

check("admin login rejects a wrong password", async () => {
  const r = await jsonPost("/v6/admin/login", { password: "definitely-not-the-password" });
  assert.ok(r.status === 401 || r.status === 503, "unexpected status " + r.status);
});

check("admin login accepts the configured password", async () => {
  const r = await jsonPost("/v6/admin/login", { password: ADMIN_PW });
  assert.eq(r.status, 200, "status " + r.status + " " + r.text.slice(0, 100));
  assert.ok(typeof r.body.token === "string" && r.body.token.length > 20, "no session token");
  adminTok = r.body.token;
});

check("admin lists records", async () => {
  const r = await get(`/v6/admin/entries?token=${adminTok}&trackId=${trackId}`);
  assert.eq(r.status, 200);
  assert.eq(r.body.total, 1);
  assert.eq(r.body.entries[0].cheatSpeed, 1.5);
  assert.eq(r.body.entries[0].cheatGrip, 0.8);
});

check("admin delete needs a session", async () => {
  const r = await jsonPost("/v6/admin/delete", { ids: [entryId] });
  assert.eq(r.status, 401);
});

check("admin deletes the record", async () => {
  const r = await jsonPost("/v6/admin/delete", { token: adminTok, ids: [entryId] });
  assert.eq(r.status, 200);
  const board = await get(
    `/v6/leaderboard?version=0.6.3&trackId=${trackId}&skip=0&amount=10&onlyVerified=false`,
  );
  assert.eq(board.body.total, 0, "record still on the board");
});

(async () => {
  for (const [name, fn] of checks) {
    try {
      await fn();
      console.log("PASS  " + name);
    } catch (err) {
      failed++;
      console.log("FAIL  " + name + " -> " + err.message);
    }
  }
  console.log(failed ? `${failed} check(s) failed` : "all live checks passed");
  process.exit(failed ? 1 : 0);
})();

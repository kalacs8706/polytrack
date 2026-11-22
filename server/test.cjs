// Local shape test: runs the Worker against a stub D1 and checks that each
// response matches what the PolyTrack 0.6.3 client parser requires.
const assert = require("node:assert");

const ENTRY = {
  seq: 7,
  token: "tok_abcdef0123456789",
  nickname: "Racer",
  country_code: null,
  car_style: "",
  frames: 18075,
  ms: 18075,
  recording: "rec",
  verified_state: 1,
  created_at: 1760000000000,
};

const DB = {
  prepare(sql) {
    const stmt = { sql, args: [] };
    stmt.bind = (...args) => {
      stmt.args = args;
      return stmt;
    };
    stmt.first = async () => {
      if (/FROM users/i.test(sql)) {
        return { nickname: "Racer", country_code: null, car_style: "" };
      }
      if (/FROM admin_sessions/i.test(sql))
        return stmt.args[0] === "sess" ? { token: "sess", expires: Date.now() + 60000 } : null;
      if (/COUNT\(\*\)/i.test(sql)) return { n: 1 };
      return null;
    };
    stmt.all = async () => (/FROM entries/i.test(sql) ? { results: [ENTRY] } : { results: [] });
    stmt.run = async () => ({ success: true });
    return stmt;
  },
  batch: async () => [],
};

const env = { DB, ADMIN_PASSWORD: "testpass" };
const base = "https://api.test";

(async () => {
  const worker = (await import("./index.js")).default;
  const call = (path, init) => worker.fetch(new Request(base + path, init), env);
  const body = async (res) => JSON.parse(await res.text());

  const checks = [];
  const check = (name, fn) => checks.push([name, fn]);

  check("GET user -> profile object", async () => {
    const res = await call("/v6/user?version=0.6.3&userToken=tok");
    const b = await body(res);
    assert.equal(res.status, 200);
    assert.equal(typeof b.nickname, "string");
    assert.ok(b.nickname.length >= 1 && b.nickname.length <= 50);
    assert.ok(b.countryCode === null || typeof b.countryCode === "string");
    assert.equal(typeof b.carStyle, "string");
    assert.equal(typeof b.isVerifier, "boolean");
  });

  check("GET user with no token -> null", async () => {
    const res = await call("/v6/user?version=0.6.3");
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "null");
  });

  check("POST user -> 200 empty", async () => {
    const res = await call("/v6/user", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "version=0.6.3&userToken=tok&nickname=Racer&carStyle=%7B%7D",
    });
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "");
  });

  check("POST user rejects empty nickname", async () => {
    const res = await call("/v6/user", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "userToken=tok&nickname=",
    });
    assert.equal(res.status, 400);
  });

  check("GET leaderboard -> total + full entries", async () => {
    const res = await call("/v6/leaderboard?version=0.6.3&trackId=t&skip=0&amount=10&onlyVerified=false");
    const b = await body(res);
    assert.equal(res.status, 200);
    assert.equal(typeof b.total, "number");
    assert.ok(Array.isArray(b.entries));
    const e = b.entries[0];
    for (const f of ["id", "userId", "nickname", "frames", "time", "carStyle", "verifiedState", "countryCode"]) {
      assert.ok(f in e, "missing " + f);
    }
    assert.equal(typeof e.id, "number");
    assert.equal(typeof e.userId, "string");
    assert.equal(typeof e.nickname, "string");
    assert.equal(typeof e.frames, "number");
    assert.ok(Number.isSafeInteger(e.frames) && e.frames > 0);
    assert.equal(typeof e.verifiedState, "number");
    assert.ok(e.countryCode === null || typeof e.countryCode === "string");
    // The client runs new Date() on this field, so a number makes it reject the response.
    assert.equal(typeof e.time, "string");
    assert.ok(!Number.isNaN(new Date(e.time).getTime()), "time is not a parseable date: " + e.time);
    // The parser refuses the whole leaderboard when this key is absent.
    assert.ok("userEntry" in b, "userEntry field is missing");
    assert.equal(b.userEntry, null);
    assert.equal(typeof e.cheatSpeed, "number");
    assert.equal(typeof e.cheatGrip, "number");
  });

  check("GET leaderboardUserEntry -> null when unknown", async () => {
    const res = await call("/v6/leaderboardUserEntry?version=0.6.3&trackId=t&userTokenHash=deadbeef&onlyVerified=false");
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "null");
  });

  check("POST leaderboard -> number or null", async () => {
    const res = await call("/v6/leaderboard", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "version=0.6.3&userToken=tok&nickname=Racer&carStyle=%7B%7D&trackId=t&frames=18075&recording=abc",
    });
    assert.equal(res.status, 200);
    const raw = await res.text();
    assert.ok(raw === "null" || typeof JSON.parse(raw) === "number", "got " + raw);
  });

  check("POST leaderboard rejects bad frames", async () => {
    const res = await call("/v6/leaderboard", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "userToken=tok&trackId=t&frames=0",
    });
    assert.equal(res.status, 400);
  });

  check("POST verifyRecordings -> 200 empty body", async () => {
    const res = await call("/v6/verifyRecordings", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "userToken=tok&maxFrames=10&getEstimatedRemaining=false&recordings=%5B%5D",
    });
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "");
  });

  check("GET recordings -> array", async () => {
    const res = await call("/v6/recordings?version=0.6.3&ids=7,8");
    const b = await body(res);
    assert.ok(Array.isArray(b));
    assert.equal(b.length, 2);
    assert.equal(b[1], null, "an unknown id should come back as null");
    const r = b[0];
    assert.ok(r && typeof r.recording === "string", "missing recording");
    assert.equal(typeof r.carStyle, "string");
    assert.equal(typeof r.frames, "number");
    assert.ok(Number.isSafeInteger(r.frames) && r.frames > 0, "frames invalid");
    assert.equal(typeof r.verifiedState, "number");
    assert.ok(Number.isSafeInteger(r.verifiedState) && r.verifiedState >= 0, "verifiedState invalid");
  });

  check("GET iceServers -> array", async () => {
    const b = await body(await call("/v6/iceServers?version=0.6.3"));
    assert.ok(Array.isArray(b));
  });

  check("GET trackOfTheWeek -> serverTime string", async () => {
    const b = await body(await call("/v6/trackOfTheWeek?version=0.6.3"));
    assert.equal(typeof b.serverTime, "string");
    assert.ok(!Number.isNaN(new Date(b.serverTime).getTime()));
  });

  check("POST admin/login -> session token", async () => {
    const res = await call("/v6/admin/login", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ password: "testpass" }),
    });
    const b = await body(res);
    assert.equal(res.status, 200);
    assert.equal(typeof b.token, "string");
    assert.ok(b.token.length > 20);
  });

  check("POST admin/login rejects a wrong password", async () => {
    const res = await call("/v6/admin/login", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ password: "nope" }),
    });
    assert.equal(res.status, 401);
  });

  check("GET admin/entries needs a session", async () => {
    const res = await call("/v6/admin/entries?token=missing");
    assert.equal(res.status, 401);
  });

  check("GET admin/entries with a session -> list", async () => {
    const res = await call("/v6/admin/entries?token=sess");
    const b = await body(res);
    assert.equal(res.status, 200);
    assert.equal(typeof b.total, "number");
    assert.ok(Array.isArray(b.entries));
    assert.equal(typeof b.entries[0].cheatSpeed, "number");
  });

  check("POST admin/delete needs a session", async () => {
    const res = await call("/v6/admin/delete", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ ids: [7] }),
    });
    assert.equal(res.status, 401);
  });

  check("OPTIONS preflight -> CORS", async () => {
    const res = await call("/v6/user", { method: "OPTIONS" });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("access-control-allow-origin"), "*");
  });

  check("unknown path -> 404 json", async () => {
    const res = await call("/v6/nope");
    assert.equal(res.status, 404);
    assert.equal((await body(res)).error, "not found");
  });

  let failed = 0;
  for (const [name, fn] of checks) {
    try {
      await fn();
      console.log("PASS  " + name);
    } catch (err) {
      failed++;
      console.log("FAIL  " + name + " -> " + err.message);
    }
  }
  console.log(failed ? `\n${failed} check(s) failed` : `\nall ${checks.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();

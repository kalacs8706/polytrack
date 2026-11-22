// PolyTrack replacement API (Cloudflare Worker + D1).
// Implements the subset of the game's v6 API that the client actually calls.
// Response shapes were taken from the 0.6.3 bundle's parsers:
//   GET  v6/user                -> {nickname, countryCode, carStyle, isVerifier} | null
//   POST v6/user                -> 200, empty body
//   GET  v6/leaderboard         -> {total, entries:[{id,userId,nickname,frames,time,carStyle,verifiedState,countryCode}], userEntry}
//                                  `time` is an ISO string (the client runs new Date() on it), and
//                                  `userEntry` must be present (null or {position,frames,id}).
//   GET  v6/leaderboardUserEntry-> {position,frames,id,...} | null
//   POST v6/leaderboard         -> number | null | {uploadId,...}
//   GET  v6/recordings          -> [ {recording,carStyle,frames,verifiedState} | null, ... ]
//   POST v6/verifyRecordings    -> 200 + empty body (client treats that as "nothing pending")
//   GET  v6/iceServers          -> [ {urls, ...} ]
//   GET  v6/trackOfTheWeek      -> {serverTime, ...}
// Multiplayer signalling (the client only speaks WebSocket; the shim in the mod
// translates it to these long-poll endpoints, which a Worker can host):
//   POST v6/mp/host             -> {inviteCode}
//   POST v6/mp/join             -> {session}
//   POST v6/mp/send             -> {ok}
//   GET  v6/mp/poll             -> {messages:[...], cursor, closed}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

// The game's enum: Pending=0, Verified=1, Invalid=2, InvalidDuplicate=3, InvalidManual=4.
// This server cannot re-simulate runs, so submissions are stored as Verified instead of
// the old "3", which the client rendered as an invalid duplicate and hid from the verified tab.
const VERIFIED_STATE = 1;

// Public STUN is enough for most home routers; there is no TURN here, so symmetric NAT
// players still fail. Empty list would restrict multiplayer to the same LAN.
const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
     token TEXT PRIMARY KEY,
     nickname TEXT NOT NULL,
     country_code TEXT,
     car_style TEXT NOT NULL DEFAULT '',
     updated_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS entries (
     seq INTEGER PRIMARY KEY AUTOINCREMENT,
     track_id TEXT NOT NULL,
     token TEXT NOT NULL,
     nickname TEXT NOT NULL,
     country_code TEXT,
     car_style TEXT NOT NULL DEFAULT '',
     frames INTEGER NOT NULL,
     ms INTEGER NOT NULL,
     recording TEXT NOT NULL DEFAULT '',
     verified_state INTEGER NOT NULL DEFAULT ${VERIFIED_STATE},
     created_at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS entries_track_ms ON entries (track_id, ms)`,
  `CREATE TABLE IF NOT EXISTS mp_rooms (
     code TEXT PRIMARY KEY,
     created_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS mp_msgs (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     code TEXT NOT NULL,
     target TEXT NOT NULL,
     session TEXT,
     payload TEXT NOT NULL,
     created_at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS mp_msgs_lookup ON mp_msgs (code, target, id)`,
  `CREATE TABLE IF NOT EXISTS admin_sessions (
     token TEXT PRIMARY KEY,
     expires INTEGER NOT NULL
   )`,
];

let schemaReady = false;

async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch(SCHEMA.map((sql) => env.DB.prepare(sql)));
  // Added after the first deploy; a fresh database already has them via CREATE above,
  // so a duplicate-column error is expected and ignored.
  for (const sql of [
    "ALTER TABLE entries ADD COLUMN cheat_speed REAL NOT NULL DEFAULT 1",
    "ALTER TABLE entries ADD COLUMN cheat_grip REAL NOT NULL DEFAULT 1",
  ]) {
    try {
      await env.DB.prepare(sql).run();
    } catch {}
  }
  schemaReady = true;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });

const text = (body, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", ...CORS } });

const form = async (req) => new URLSearchParams(await req.text());
const body = async (req) => {
  try {
    return JSON.parse(await req.text());
  } catch {
    return null;
  }
};
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const int = (value, fallback = 0) => {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function tokenHash(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getUser(url, env) {
  const token = url.searchParams.get("userToken") || "";
  if (!token) return json(null);
  const row = await env.DB.prepare(
    "SELECT nickname, country_code, car_style FROM users WHERE token = ?",
  )
    .bind(token)
    .first();
  if (!row) return json(null);
  return json({
    nickname: row.nickname,
    countryCode: row.country_code ?? null,
    carStyle: row.car_style || "",
    isVerifier: false,
  });
}

async function saveUser(req, env) {
  const f = await form(req);
  const token = (f.get("userToken") || "").trim();
  const nickname = (f.get("nickname") || "").trim();
  const countryCode = f.get("countryCode") || null;
  const carStyle = f.get("carStyle") || "";
  if (!token) return text("missing userToken", 400);
  if (nickname.length < 1 || nickname.length > 50) return text("invalid nickname", 400);
  await env.DB.prepare(
    `INSERT INTO users (token, nickname, country_code, car_style, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(token) DO UPDATE SET
       nickname = excluded.nickname,
       country_code = excluded.country_code,
       car_style = excluded.car_style,
       updated_at = excluded.updated_at`,
  )
    .bind(token, nickname, countryCode, carStyle, Date.now())
    .run();
  return text("");
}

async function getLeaderboard(url, env) {
  const trackId = url.searchParams.get("trackId") || "";
  const skip = clamp(int(url.searchParams.get("skip")), 0, 1000000);
  const amount = clamp(int(url.searchParams.get("amount"), 10), 1, 100);
  const onlyVerified = url.searchParams.get("onlyVerified") === "true";
  const where = onlyVerified
    ? "track_id = ? AND verified_state = 1"
    : "track_id = ?";

  const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS n FROM entries WHERE ${where}`)
    .bind(trackId)
    .first();
  const rows = await env.DB.prepare(
    `SELECT seq, token, nickname, country_code, car_style, frames, ms, verified_state, created_at,
            cheat_speed, cheat_grip
       FROM entries WHERE ${where} ORDER BY ms ASC, created_at ASC LIMIT ? OFFSET ?`,
  )
    .bind(trackId, amount, skip)
    .all();

  // The client compares entry.userId against the token hash it sent to mark your own row,
  // so the hash (not a slice of the token) is what has to go out here.
  const hashes = new Map();
  const hashOf = async (token) => {
    if (!hashes.has(token)) hashes.set(token, await tokenHash(token));
    return hashes.get(token);
  };

  const entries = [];
  for (const r of rows.results || []) {
    entries.push({
      id: r.seq,
      userId: await hashOf(r.token),
      nickname: r.nickname,
      frames: r.frames,
      time: new Date(r.created_at).toISOString(),
      carStyle: r.car_style || "",
      verifiedState: r.verified_state,
      countryCode: r.country_code ?? null,
      // Extra fields: the game's parser ignores them, PolyMod reads them for its badge.
      cheatSpeed: r.cheat_speed ?? 1,
      cheatGrip: r.cheat_grip ?? 1,
    });
  }

  let userEntry = null;
  const wanted = url.searchParams.get("userTokenHash") || "";
  if (wanted) {
    const all = await env.DB.prepare(
      `SELECT seq, token, frames FROM entries WHERE ${where} ORDER BY ms ASC, created_at ASC`,
    )
      .bind(trackId)
      .all();
    const list = all.results || [];
    for (let i = 0; i < list.length; i++) {
      if ((await hashOf(list[i].token)) === wanted) {
        userEntry = { position: i + 1, frames: list[i].frames, id: list[i].seq };
        break;
      }
    }
  }

  return json({ total: totalRow ? totalRow.n : entries.length, entries, userEntry });
}

async function leaderboardUserEntry(url, env) {
  const trackId = url.searchParams.get("trackId") || "";
  const wanted = url.searchParams.get("userTokenHash") || "";
  const onlyVerified = url.searchParams.get("onlyVerified") === "true";
  if (!trackId || !wanted) return json(null);
  const where = onlyVerified
    ? "track_id = ? AND verified_state = 1"
    : "track_id = ?";
  const rows = await env.DB.prepare(
    `SELECT seq, token, frames, ms FROM entries WHERE ${where} ORDER BY ms ASC, created_at ASC`,
  )
    .bind(trackId)
    .all();
  const list = rows.results || [];
  for (let i = 0; i < list.length; i++) {
    if ((await tokenHash(list[i].token)) === wanted) {
      return json({ position: i + 1, frames: list[i].frames, id: list[i].seq, time: list[i].ms / 1000 });
    }
  }
  return json(null);
}

async function submitEntry(req, env) {
  const f = await form(req);
  const token = (f.get("userToken") || "").trim();
  const trackId = (f.get("trackId") || "").trim();
  const frames = int(f.get("frames"));
  const nickname = (f.get("nickname") || "").trim() || "Racer";
  // PolyMod stamps the cheat settings it was running with; anything unset means stock.
  const speed = clamp(Number(f.get("speed")) || 1, 1, 4);
  const gripRaw = Number(f.get("grip"));
  const grip = clamp(Number.isFinite(gripRaw) && gripRaw > 0 ? gripRaw : 1, 0.25, 2);
  if (!token || !trackId || frames <= 0) return text("bad request", 400);
  await env.DB.prepare(
    `INSERT INTO entries (track_id, token, nickname, country_code, car_style, frames, ms, recording, verified_state, created_at, cheat_speed, cheat_grip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      trackId,
      token,
      nickname,
      f.get("countryCode") || null,
      f.get("carStyle") || "",
      frames,
      frames, // the game's frames are milliseconds
      f.get("recording") || "",
      VERIFIED_STATE,
      Date.now(),
      speed,
      grip,
    )
    .run();
  return json(null);
}

/* ---------------- admin ---------------- */

const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function adminSession(env, token) {
  if (!token) return null;
  const row = await env.DB.prepare("SELECT expires FROM admin_sessions WHERE token = ?")
    .bind(token)
    .first();
  return row && row.expires > Date.now() ? row : null;
}

// The password lives in the Worker secret ADMIN_PASSWORD (Sites -> Secrets), never in the bundle.
async function adminLogin(req, env) {
  const data = await body(req);
  const password = data && typeof data.password === "string" ? data.password : "";
  const expected = env.ADMIN_PASSWORD || "";
  if (!expected) return json({ error: "admin password is not configured" }, 503);
  if (!password) return json({ error: "missing password" }, 400);
  if ((await sha256Hex(password)) !== (await sha256Hex(expected))) {
    return json({ error: "wrong password" }, 401);
  }
  const token = [...crypto.getRandomValues(new Uint8Array(24))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const expires = Date.now() + ADMIN_SESSION_MS;
  await env.DB.prepare("DELETE FROM admin_sessions WHERE expires < ?").bind(Date.now()).run();
  await env.DB.prepare("INSERT INTO admin_sessions (token, expires) VALUES (?, ?)")
    .bind(token, expires)
    .run();
  return json({ token, expires });
}

async function adminLogout(req, env) {
  const data = await body(req);
  if (data && typeof data.token === "string") {
    await env.DB.prepare("DELETE FROM admin_sessions WHERE token = ?").bind(data.token).run();
  }
  return json({ ok: true });
}

async function adminEntries(url, env) {
  if (!(await adminSession(env, url.searchParams.get("token") || ""))) {
    return json({ error: "session expired" }, 401);
  }
  const trackId = url.searchParams.get("trackId") || "";
  const limit = clamp(int(url.searchParams.get("limit"), 100), 1, 200);
  const filter = trackId ? "WHERE track_id = ?" : "";
  const rows = await env.DB.prepare(
    `SELECT seq, track_id, nickname, frames, ms, verified_state, cheat_speed, cheat_grip, created_at
       FROM entries ${filter} ORDER BY seq DESC LIMIT ?`,
  )
    .bind(...(trackId ? [trackId, limit] : [limit]))
    .all();
  const count = await env.DB.prepare(`SELECT COUNT(*) AS n FROM entries ${filter}`)
    .bind(...(trackId ? [trackId] : []))
    .first();
  return json({
    total: count ? count.n : 0,
    entries: (rows.results || []).map((r) => ({
      id: r.seq,
      trackId: r.track_id,
      nickname: r.nickname,
      frames: r.frames,
      time: new Date(r.created_at).toISOString(),
      verifiedState: r.verified_state,
      cheatSpeed: r.cheat_speed ?? 1,
      cheatGrip: r.cheat_grip ?? 1,
    })),
  });
}

// Deletes by id list, by track, or everything.
async function adminDelete(req, env) {
  const data = await body(req);
  if (!data || !(await adminSession(env, typeof data.token === "string" ? data.token : ""))) {
    return json({ error: "session expired" }, 401);
  }
  if (Array.isArray(data.ids) && data.ids.length) {
    const ids = data.ids.map((v) => int(v, -1)).filter((v) => v > 0);
    if (ids.length) {
      await env.DB.prepare(`DELETE FROM entries WHERE seq IN (${ids.map(() => "?").join(",")})`)
        .bind(...ids)
        .run();
    }
    return json({ ok: true, deleted: ids.length });
  }
  if (typeof data.trackId === "string" && data.trackId) {
    await env.DB.prepare("DELETE FROM entries WHERE track_id = ?").bind(data.trackId).run();
    return json({ ok: true });
  }
  if (data.all === true) {
    await env.DB.prepare("DELETE FROM entries").run();
    return json({ ok: true });
  }
  return json({ error: "nothing to delete" }, 400);
}

// The leaderboard "Watch"/"Play" buttons fetch the stored runs by entry id.
async function getRecordings(url, env) {
  const ids = (url.searchParams.get("ids") || "")
    .split(",")
    .map((v) => int(v, -1))
    .filter((n) => n > 0);
  if (!ids.length) return json([]);
  const placeholders = ids.map(() => "?").join(",");
  const rows = await env.DB.prepare(
    `SELECT seq, recording, car_style, frames, verified_state
       FROM entries WHERE seq IN (${placeholders})`,
  )
    .bind(...ids)
    .all();
  const byId = new Map((rows.results || []).map((r) => [r.seq, r]));
  return json(
    ids.map((id) => {
      const r = byId.get(id);
      if (!r || !r.recording) return null;
      // The client's replay parser requires frames and verifiedState on every item.
      return {
        recording: r.recording,
        carStyle: r.car_style || "",
        frames: r.frames,
        verifiedState: r.verified_state,
      };
    }),
  );
}

/* ---------------- multiplayer signalling relay ---------------- */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randomCode = (len = 6) => {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
};
const randomSession = () => {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
};

async function mpHost(req, env) {
  const body = await req.text();
  let inviteCode = "";
  for (let i = 0; i < 6; i++) {
    inviteCode = randomCode();
    const taken = await env.DB.prepare("SELECT code FROM mp_rooms WHERE code = ?")
      .bind(inviteCode)
      .first();
    if (!taken) break;
    inviteCode = "";
  }
  if (!inviteCode) return json({ error: "could not allocate a room" }, 503);
  // Reap rooms older than an hour so the table cannot grow forever.
  await env.DB.prepare("DELETE FROM mp_rooms WHERE created_at < ?")
    .bind(Date.now() - 3600000)
    .run();
  await env.DB.prepare("INSERT INTO mp_rooms (code, created_at) VALUES (?, ?)")
    .bind(inviteCode, Date.now())
    .run();
  return json({ inviteCode, timeoutMilliseconds: 600000 });
}

async function mpJoin(req, env) {
  const data = await body(req);
  if (!data || typeof data.code !== "string") return json({ error: "bad request" }, 400);
  const code = data.code.toUpperCase();
  const room = await env.DB.prepare("SELECT code FROM mp_rooms WHERE code = ?").bind(code).first();
  if (!room) return json({ error: "no such invite" }, 404);
  const payload = data.payload && typeof data.payload === "object" ? data.payload : {};
  if (typeof payload.offer !== "string") return json({ error: "missing offer" }, 400);
  const session = randomSession();
  const joinInvite = {
    type: "joinInvite",
    session,
    offer: payload.offer,
    version: typeof payload.version === "string" ? payload.version : "0.6.3",
    mods: Array.isArray(payload.mods) ? payload.mods : [],
    isModsVanillaCompatible: payload.isModsVanillaCompatible === true,
    nickname: typeof payload.nickname === "string" ? payload.nickname : null,
    countryCode: typeof payload.countryCode === "string" ? payload.countryCode : null,
    carStyle: typeof payload.carStyle === "string" ? payload.carStyle : "",
    iceServers: ICE_SERVERS,
  };
  await env.DB.prepare(
    "INSERT INTO mp_msgs (code, target, session, payload, created_at) VALUES (?, 'host', ?, ?, ?)",
  )
    .bind(code, session, JSON.stringify(joinInvite), Date.now())
    .run();
  return json({ session });
}

async function mpSend(req, env) {
  const data = await body(req);
  if (!data || typeof data.code !== "string") return json({ error: "bad request" }, 400);
  const role = data.role === "guest" ? "guest" : "host";
  const payload = data.payload && typeof data.payload === "object" ? data.payload : null;
  if (!payload) return json({ error: "missing payload" }, 400);
  const session =
    (typeof payload.session === "string" && payload.session) ||
    (typeof data.session === "string" && data.session) ||
    null;
  const target = role === "host" ? "guest" : "host";
  const row = { ...payload };
  // The host addresses its replies by session, so it must survive the round trip;
  // the guest's ICE frames go out without a type, which the host's parser requires.
  if (session) row.session = session;
  if (role === "guest" && typeof row.type !== "string") row.type = "iceCandidate";
  await env.DB.prepare(
    "INSERT INTO mp_msgs (code, target, session, payload, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(data.code.toUpperCase(), target, session, JSON.stringify(row), Date.now())
    .run();
  return json({ ok: true });
}

async function mpPoll(url, env) {
  const code = (url.searchParams.get("code") || "").toUpperCase();
  const role = url.searchParams.get("role") === "guest" ? "guest" : "host";
  const session = url.searchParams.get("session") || "";
  const after = int(url.searchParams.get("after"), 0);
  if (!code) return json({ messages: [], cursor: after });

  let cursor = after;
  // Long-poll: keep the request alive briefly so the client sees new frames fast.
  for (let attempt = 0; attempt < 24; attempt++) {
    // The host sees every session in its room; a guest only sees its own session.
    const guestFilter = role === "guest" ? " AND session = ?" : "";
    const rows = await env.DB.prepare(
      `SELECT id, payload FROM mp_msgs
        WHERE code = ? AND target = ? AND id > ?${guestFilter}
        ORDER BY id ASC LIMIT 20`,
    )
      .bind(...(role === "guest" ? [code, role, cursor, session] : [code, role, cursor]))
      .all();
    const list = rows.results || [];
    if (list.length) {
      const ids = list.map((r) => r.id);
      await env.DB.prepare(`DELETE FROM mp_msgs WHERE id IN (${ids.map(() => "?").join(",")})`)
        .bind(...ids)
        .run();
      cursor = ids[ids.length - 1];
      return json({
        messages: list.map((r) => JSON.parse(r.payload)),
        cursor,
      });
    }
    const room = await env.DB.prepare("SELECT code FROM mp_rooms WHERE code = ?").bind(code).first();
    if (!room) return json({ messages: [], cursor, closed: true });
    await sleep(250);
  }
  return json({ messages: [], cursor });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    const path = url.pathname.replace(/^\/+/, "").replace(/^v6\//, "").replace(/\/+$/, "");
    try {
      await ensureSchema(env);
      if (path === "user") {
        if (req.method === "GET") return await getUser(url, env);
        if (req.method === "POST") return await saveUser(req, env);
      }
      if (path === "leaderboard") {
        if (req.method === "GET") return await getLeaderboard(url, env);
        if (req.method === "POST") return await submitEntry(req, env);
      }
      if (path === "leaderboardUserEntry") return await leaderboardUserEntry(url, env);
      if (path === "recordings") return await getRecordings(url, env);
      if (path === "verifyRecordings") return text("");
      if (path === "iceServers") return json(ICE_SERVERS);
      if (path === "admin/login" && req.method === "POST") return await adminLogin(req, env);
      if (path === "admin/logout" && req.method === "POST") return await adminLogout(req, env);
      if (path === "admin/entries" && req.method === "GET") return await adminEntries(url, env);
      if (path === "admin/delete" && req.method === "POST") return await adminDelete(req, env);
      if (path === "trackOfTheWeek") {
        return json({ serverTime: new Date().toISOString(), trackId: null, name: null });
      }
      if (path === "mp/host" && req.method === "POST") return await mpHost(req, env);
      if (path === "mp/join" && req.method === "POST") return await mpJoin(req, env);
      if (path === "mp/send" && req.method === "POST") return await mpSend(req, env);
      if (path === "mp/poll" && req.method === "GET") return await mpPoll(url, env);
      return json({ error: "not found", path }, 404);
    } catch (err) {
      return json({ error: String((err && err.message) || err) }, 500);
    }
  },
};

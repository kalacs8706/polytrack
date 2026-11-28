// Runs in the page (MAIN world) before the mod.
//
// The mod reaches game webpack modules through its bundle-scope `n(id)`: the replay codec
// (1754), the recording decoder (6551), pako (3075), the track data class (9117), track
// meshes (6421) and the renderer class (9437). On the unmodified game there is no `n`, so
// this file provides one. Two sources feed it:
//
//  1. The recording codec is reimplemented here, because the game builds it from raw data:
//     recording = base64url( zlib( five uint24-delta lists: up, right, down, left, reset ) )
//     Verified byte-for-byte against zlib on live official recordings. Encoding writes the
//     same payload as uncompressed (stored) deflate blocks, which any inflater reads back.
//
//  2. Every other module (9117 track data, 6421, 9437, ...) is the page's own, taken from
//     the game's webpack runtime. There is no way to reimplement 9117 by hand: it is the
//     whole track model behind fromExportString. Instead this file seeds the chunk array
//     (`self.webpackChunk`) before the game's bundles run, which makes webpack hand over its
//     real `require` and with it every module of the build.
(function () {
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const KEYS = ["up", "right", "down", "left", "reset"];

  function b64decode(s) {
    s = String(s).replace(/=+$/, "");
    const out = new Uint8Array(((s.length * 6) / 8) | 0);
    let buf = 0, bits = 0, at = 0;
    for (let i = 0; i < s.length; i++) {
      const v = B64.indexOf(s[i]);
      if (v < 0) throw new Error("invalid recording data");
      buf = (buf << 6) | v;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out[at++] = (buf >> bits) & 255;
      }
    }
    return out.subarray(0, at);
  }

  function b64encode(bytes) {
    let out = "", buf = 0, bits = 0;
    for (let i = 0; i < bytes.length; i++) {
      buf = (buf << 8) | bytes[i];
      bits += 8;
      while (bits >= 6) {
        bits -= 6;
        out += B64[(buf >> bits) & 63];
      }
    }
    if (bits) out += B64[(buf << (6 - bits)) & 63];
    return out;
  }

  const LEN_BASE = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  const LEN_EXTRA = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  const DIST_BASE = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  const DIST_EXTRA = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  const CL_ORDER = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];

  function buildTree(lengths) {
    const counts = new Array(16).fill(0);
    for (let i = 0; i < lengths.length; i++) counts[lengths[i]]++;
    counts[0] = 0;
    const offs = new Array(16).fill(0);
    for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + counts[i - 1];
    const symbol = new Array(lengths.length).fill(0);
    for (let i = 0; i < lengths.length; i++) if (lengths[i]) symbol[offs[lengths[i]]++] = i;
    return { counts, symbol };
  }

  function inflateZlib(src) {
    if (src.length < 2) throw new Error("invalid recording data");
    if ((src[0] & 15) !== 8 || ((src[0] << 8) | src[1]) % 31) throw new Error("invalid recording data");
    if (src[1] & 32) throw new Error("invalid recording data");

    let pos = 2, bitBuf = 0, bitCnt = 0;
    const need = (n) => { while (bitCnt < n) { bitBuf |= src[pos++] << bitCnt; bitCnt += 8; } };
    const bits = (n) => {
      if (!n) return 0;
      need(n);
      const v = bitBuf & ((1 << n) - 1);
      bitBuf >>>= n;
      bitCnt -= n;
      return v;
    };

    let out = new Uint8Array(Math.max(1024, src.length * 4)), outLen = 0;
    const room = (n) => {
      if (outLen + n <= out.length) return;
      let cap = out.length * 2;
      while (cap < outLen + n) cap *= 2;
      const next = new Uint8Array(cap);
      next.set(out.subarray(0, outLen));
      out = next;
    };

    function symbol(tree) {
      let code = 0, first = 0, index = 0;
      for (let len = 1; len < 16; len++) {
        code |= bits(1);
        const cnt = tree.counts[len];
        if (code - first < cnt) return tree.symbol[index + (code - first)];
        index += cnt;
        first = (first + cnt) << 1;
        code <<= 1;
      }
      throw new Error("invalid recording data");
    }

    const FIXED_LIT = new Array(288);
    for (let i = 0; i < 288; i++) FIXED_LIT[i] = i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8;
    const fixedLit = buildTree(FIXED_LIT), fixedDist = buildTree(new Array(30).fill(5));

    for (let final = 0; !final; ) {
      final = bits(1);
      const type = bits(2);
      if (type === 0) {
        bitBuf = 0;
        bitCnt = 0;
        const len = src[pos] | (src[pos + 1] << 8);
        pos += 4;
        room(len);
        out.set(src.subarray(pos, pos + len), outLen);
        outLen += len;
        pos += len;
        continue;
      }
      let lit, dist;
      if (type === 1) {
        lit = fixedLit;
        dist = fixedDist;
      } else if (type === 2) {
        const hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4;
        const clLens = new Array(19).fill(0);
        for (let i = 0; i < hclen; i++) clLens[CL_ORDER[i]] = bits(3);
        const clTree = buildTree(clLens);
        const lens = [];
        while (lens.length < hlit + hdist) {
          const s = symbol(clTree);
          if (s < 16) lens.push(s);
          else if (s === 16) {
            if (!lens.length) throw new Error("invalid recording data");
            const prev = lens[lens.length - 1], rep = 3 + bits(2);
            for (let i = 0; i < rep; i++) lens.push(prev);
          } else if (s === 17) {
            const rep = 3 + bits(3);
            for (let i = 0; i < rep; i++) lens.push(0);
          } else {
            const rep = 11 + bits(7);
            for (let i = 0; i < rep; i++) lens.push(0);
          }
        }
        lit = buildTree(lens.slice(0, hlit));
        dist = buildTree(lens.slice(hlit, hlit + hdist));
      } else throw new Error("invalid recording data");

      for (;;) {
        const s = symbol(lit);
        if (s === 256) break;
        if (s < 256) {
          room(1);
          out[outLen++] = s;
          continue;
        }
        const li = s - 257;
        if (li >= LEN_BASE.length) throw new Error("invalid recording data");
        const len = LEN_BASE[li] + bits(LEN_EXTRA[li]);
        const ds = symbol(dist);
        const d = DIST_BASE[ds] + bits(DIST_EXTRA[ds]);
        if (d > outLen) throw new Error("invalid recording data");
        room(len);
        for (let i = 0; i < len; i++) {
          out[outLen] = out[outLen - d];
          outLen++;
        }
      }
    }
    return out.subarray(0, outLen);
  }

  function deflateStored(data) {
    const parts = [];
    let i = 0;
    do {
      const len = Math.min(65535, data.length - i);
      const last = i + len >= data.length ? 1 : 0;
      parts.push(new Uint8Array([last, len & 255, (len >> 8) & 255, ~len & 255, (~len >> 8) & 255]));
      parts.push(data.subarray(i, i + len));
      i += len;
    } while (i < data.length);
    let size = 6;
    for (const p of parts) size += p.length;
    const out = new Uint8Array(size);
    out[0] = 0x78;
    out[1] = 0x01;
    let at = 2;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    let a = 1, b = 0;
    for (let k = 0; k < data.length; k++) {
      a = (a + data[k]) % 65521;
      b = (b + a) % 65521;
    }
    const adler = ((b << 16) | a) >>> 0;
    out[at++] = adler >>> 24;
    out[at++] = (adler >>> 16) & 255;
    out[at++] = (adler >>> 8) & 255;
    out[at++] = adler & 255;
    return out;
  }

  // Module 1754.A: the game's replay codec, built from the five toggle-frame lists.
  function Codec(lists) {
    this.lists = lists || {};
  }
  Codec.prototype.serialize = function () {
    let size = 0;
    for (const k of KEYS) size += 3 + 3 * (this.lists[k] || []).length;
    const raw = new Uint8Array(size);
    let at = 0;
    for (const k of KEYS) {
      const arr = this.lists[k] || [];
      raw[at++] = arr.length & 255;
      raw[at++] = (arr.length >> 8) & 255;
      raw[at++] = (arr.length >> 16) & 255;
      for (let j = 0; j < arr.length; j++) {
        const d = j ? arr[j] - arr[j - 1] : arr[j];
        raw[at++] = d & 255;
        raw[at++] = (d >> 8) & 255;
        raw[at++] = (d >> 16) & 255;
      }
    }
    return b64encode(deflateStored(raw));
  };
  Codec.deserialize = function () {
    throw new Error("replays are not available in the extension");
  };

  // Module 3075.Ay: pako. The decoder below already inflates, so this only passes bytes on.
  function Inflate() {
    this.result = null;
    this.err = null;
  }
  Inflate.prototype.push = function (data) {
    this.result = data instanceof Uint8Array ? data : new Uint8Array(data || 0);
    this.err = null;
  };

  // Reimplementations used for the ids above; they win over the page's own modules so the
  // verified recording behaviour is unchanged.
  const modules = {
    1754: { A: Codec },
    6551: { D: (recording) => inflateZlib(b64decode(recording)) },
    3075: { Ay: { Inflate } },
  };

  /* ---------- the page's own webpack runtime ---------- */
  // At document_start the game's bundles have not run yet. Their runtime starts with
  //
  //   n = self.webpackChunk = self.webpackChunk || [];
  //   n.forEach(t.bind(null, 0)); n.push = t.bind(null, n.push.bind(n));
  //
  // where `t` installs a chunk's modules and then calls the chunk's optional third element
  // (its runtime callback) with webpack's own require. This build keeps its main module
  // table inside the runtime closure, so it never arrives as a chunk - but the replay above
  // runs whatever is already in the array, so one seeded entry is all it takes to recover
  // that require. The chunk id is arbitrary and matches no chunk and the table is empty, so
  // webpack does nothing with it beyond the callback.
  //
  // The array itself is left alone: intercepting `push` breaks webpack's own callback, which
  // pushes the same entry a second time and would recurse into the interceptor forever.
  let realRequire = null;

  (function seedChunks() {
    try {
      const current = self.webpackChunk;
      if (current && current.__ptSeed) return;
      const chunks = Array.isArray(current) ? current : [];
      chunks.__ptSeed = 1;
      Array.prototype.push.call(chunks, [
        [999999991],
        {},
        function (require) {
          if (!realRequire && typeof require === "function") realRequire = require;
        },
      ]);
      self.webpackChunk = chunks;
    } catch (err) {}
  })();

  /* ---------- simulation worker ---------- */
  // The official worker answers a verify with `{messageType, carId, result}` only: it reports
  // whether the run finished on exactly the requested frame, never the frame it finished on.
  // The mod needs that frame to time edited moves, so the page's own worker script is
  // fetched, patched in memory and started from a blob. Nothing is shipped with the
  // extension: the script is the game's, served by the game, and the patch only exposes the
  // loop's final frame in the reply. The self-hosted build has no such helper and keeps
  // using the worker it ships.
  let simUrl = null;
  let simInit = null;

  (function hookWorker() {
    try {
      const Native = self.Worker;
      if (!Native || Native.__ptWorker) return;
      const Wrapped = function (url, options) {
        try {
          const abs = new URL(String(url), location.href).href;
          if (!/^blob:/i.test(abs)) simUrl = abs;
        } catch (e) {}
        return new Native(url, options);
      };
      Wrapped.prototype = Native.prototype;
      Wrapped.__ptWorker = 1;
      self.Worker = Wrapped;
      // The game initialises its worker with one message that carries the track parts and the
      // car shape; the patched worker needs the same setup, so the last one seen is kept.
      const post = Native.prototype.postMessage;
      Native.prototype.postMessage = function (message, transfer) {
        try {
          if (message && "object" === typeof message && 0 === message.messageType) {
            const copy = {};
            for (const key in message) copy[key] = message[key];
            simInit = copy;
          }
        } catch (e) {}
        return arguments.length > 1 ? post.call(this, message, transfer) : post.call(this, message);
      };
    } catch (e) {}
  })();

  const SIM_PRELUDE =
    "(function(){var p=self.postMessage;" +
    "self.postMessage=function(m,t){try{if(m&&8===m.messageType&&self.__ptVerify&&void 0===m.frames){" +
    "m.frames=self.__ptVerify.frames;m.finished=!!self.__ptVerify.hasFinished}}catch(e){}" +
    "return void 0===t?p.call(self,m):p.call(self,m,t)}})();\n";

  async function simSource() {
    const base = simUrl;
    const [worker, loader] = await Promise.all([
      fetch(base, { cache: "force-cache" }).then((r) => { if (!r.ok) throw new Error("simulation worker http " + r.status); return r.text(); }),
      fetch(new URL("lib/polytrack_physics.js", base).href, { cache: "force-cache" })
        .then((r) => { if (!r.ok) throw new Error("physics loader http " + r.status); return r.text(); }),
    ]);
    // The loader resolves its wasm next to the worker script, and a blob URL has no
    // directory, so it is inlined and handed the worker's real URL instead of imported.
    const physics = loader.split("self.location.href").join(JSON.stringify(base));
    const patched = worker
      // `0`, not nothing: the call sits in a comma expression (`…),importScripts(…);`).
      .replace(/importScripts\(\s*["']lib\/polytrack_physics\.js["']\s*\)/, "0")
      .replace(
        /for\(;!([A-Za-z_$][\w$]*)\.hasFinished&&\1\.frames<([A-Za-z_$][\w$]*);\)/,
        "for(self.__ptVerify=$1;!$1.hasFinished&&$1.frames<$2;)",
      );
    if (patched === worker) throw new Error("simulation worker was not patched");
    return SIM_PRELUDE + physics + "\n" + patched;
  }

  let simWorker = null;
  let simWorkerInit = null;
  let simMaking = null;

  window.__ptVerifyWorkerFor = function () {
    if (!simUrl || !simInit) return Promise.resolve(null);
    if (simWorker && simWorkerInit === simInit) return Promise.resolve(simWorker);
    if (simMaking) return simMaking;
    simMaking = (async () => {
      const source = await simSource();
      const worker = new Worker(URL.createObjectURL(new Blob([source], { type: "text/javascript" })));
      worker.postMessage(simInit);
      if (simWorker) { try { simWorker.terminate(); } catch (e) {} }
      simWorker = worker;
      simWorkerInit = simInit;
      return worker;
    })().catch((err) => {
      simMaking = null;
      throw err;
    });
    simMaking.then(() => { simMaking = null; }, () => {});
    return simMaking;
  };

  window.__ptRequire = function (id) {
    const found = modules[id];
    if (found) return found;
    if (realRequire) return realRequire(id);
    throw new Error("game module " + id + " is not available in the extension");
  };
  window.__ptWebpackProbe = () => ({ seeded: !!(self.webpackChunk && self.webpackChunk.__ptSeed), require: !!realRequire, chunks: self.webpackChunk ? self.webpackChunk.length : 0 });
})();

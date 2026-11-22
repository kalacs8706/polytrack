/* PolyMod multiplayer relay shim.
   The game only speaks WebSocket for signalling (v6/multiplayer/host and v6/multiplayer/join),
   and the Worker that hosts this site cannot accept socket upgrades. This shim implements the
   small WebSocket surface the client uses and relays the same JSON messages through
   v6/mp/host|join|send|poll, which a Worker can serve. It only installs when the web build
   defines window.__ptMPBase, so the desktop install keeps talking to PolyTrack's own server. */
;(function () {
  try {
    if (window.__ptWS || !window.__ptMPBase) return;
    var BASE = function () {
      return String(window.__ptMPBase || "").replace(/\/+$/, "");
    };
    var toJson = function (r) {
      if (!r.ok) {
        var err = new Error("http " + r.status);
        err.status = r.status;
        throw err;
      }
      return r.json();
    };
    var post = function (p, b) {
      return fetch(BASE() + "/v6/" + p, {
        method: "POST",
        headers: { "content-type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(b),
      }).then(toJson);
    };
    var getJson = function (p) {
      return fetch(BASE() + "/v6/" + p, { cache: "no-store" }).then(toJson);
    };

    function PTWS(url) {
      var self = this;
      this.url = String(url || "");
      this.readyState = 0;
      this._l = { open: [], close: [], message: [], error: [] };
      this._after = 0;
      this._session = null;
      this._code = null;
      this._dead = false;
      this._joining = false;
      this._queue = [];
      this._chain = Promise.resolve();
      this._role = /multiplayer\/host/i.test(this.url)
        ? "host"
        : /multiplayer\/join/i.test(this.url)
          ? "guest"
          : null;
      if (!this._role) {
        this.readyState = 3;
        setTimeout(function () {
          self._fire("close");
        }, 0);
        return;
      }
      setTimeout(function () {
        self._boot();
      }, 0);
    }
    PTWS.CONNECTING = 0;
    PTWS.OPEN = 1;
    PTWS.CLOSING = 2;
    PTWS.CLOSED = 3;
    PTWS.prototype.addEventListener = function (t, f) {
      var a = this._l[t];
      if (a && a.indexOf(f) < 0) a.push(f);
    };
    PTWS.prototype.removeEventListener = function (t, f) {
      var a = this._l[t];
      if (a) {
        var i = a.indexOf(f);
        if (i >= 0) a.splice(i, 1);
      }
    };
    PTWS.prototype._fire = function (t, data) {
      var a = (this._l[t] || []).slice();
      for (var i = 0; i < a.length; i++) {
        try {
          a[i].call(this, { type: t, data: data, target: this });
        } catch (e) {}
      }
    };
    PTWS.prototype._fail = function () {
      if (this._dead) return;
      this._dead = true;
      this.readyState = 3;
      this._fire("close");
    };
    PTWS.prototype._boot = function () {
      var self = this;
      if ("host" === self._role) {
        post("mp/host", { key: Math.random().toString(36).slice(2) })
          .then(function (d) {
            if (self._dead) return;
            self._code = d.inviteCode;
            self.readyState = 1;
            self._fire("open");
            self._loop();
          })
          .catch(function () {
            self._fail();
          });
      } else {
        self.readyState = 1;
        self._fire("open");
        // The client only ever sends a join message from its open handler; if it never
        // does, give up instead of sitting on a socket that will never connect.
        setTimeout(function () {
          if (!self._dead && !self._joining && null === self._session) self._fail();
        }, 10000);
      }
    };
    PTWS.prototype.send = function (str) {
      var self = this;
      if (1 !== self.readyState) return;
      var m = null;
      try {
        m = JSON.parse(str);
      } catch (e) {
        return;
      }
      if (!m || "object" != typeof m) return;
      if ("guest" === self._role && null === self._session) {
        // The client sends its offer and then its buffered ICE candidates in one burst,
        // all before the join request has returned a session. Only the offer may create
        // the session; everything sent meanwhile has to wait for it, otherwise each frame
        // would open a new join with an empty code and tear the socket down.
        if (!self._joining && "string" == typeof m.inviteCode && m.inviteCode) {
          self._join(m);
          return;
        }
        self._queue.push(m);
        return;
      }
      if ("host" === self._role && "createInvite" === m.type) {
        setTimeout(function () {
          if (self._dead) return;
          self._fire(
            "message",
            JSON.stringify({
              type: "createInvite",
              inviteCode: self._code,
              key: String(m.key || ""),
              timeoutMilliseconds: null,
              censoredNickname: "string" == typeof m.nickname ? m.nickname : null,
            }),
          );
        }, 0);
        return;
      }
      self._post(m);
    };
    PTWS.prototype._post = function (m) {
      var self = this;
      // Keep the relay in the order the client sent it: one HTTP request at a time.
      self._chain = self._chain.then(function () {
        return post("mp/send", {
          role: self._role,
          code: self._code,
          session: self._session || m.session || null,
          payload: m,
        }).catch(function () {});
      });
    };
    PTWS.prototype._join = function (m) {
      var self = this;
      var code = String(m.inviteCode || "").toUpperCase();
      self._joining = true;
      post("mp/join", { code: code, payload: m })
        .then(function (d) {
          if (self._dead) return;
          self._code = code;
          self._session = d.session;
          self._joining = false;
          var q = self._queue;
          self._queue = [];
          for (var i = 0; i < q.length; i++) self._post(q[i]);
          self._loop();
        })
        .catch(function (err) {
          self._joining = false;
          self._queue = [];
          if (self._dead) return;
          // A wrong or expired code is a normal decline, not a broken connection: report
          // it the way the server does so the game shows the right message.
          if (err && err.status >= 400 && err.status < 500) {
            self._fire("message", JSON.stringify({ type: "error", error: "ExpiredInvite" }));
            return self.close();
          }
          self._fail();
        });
    };
    PTWS.prototype._loop = function () {
      var self = this;
      (function step() {
        if (self._dead) return;
        var q =
          "mp/poll?code=" +
          encodeURIComponent(self._code || "") +
          "&role=" +
          self._role +
          "&after=" +
          self._after +
          (self._session ? "&session=" + encodeURIComponent(self._session) : "");
        getJson(q)
          .then(function (d) {
            if (self._dead) return;
            if (d && d.cursor) self._after = d.cursor;
            var list = (d && d.messages) || [];
            for (var i = 0; i < list.length; i++) self._fire("message", JSON.stringify(list[i]));
            if (d && d.closed) return self.close();
            step();
          })
          .catch(function () {
            setTimeout(step, 600);
          });
      })();
    };
    PTWS.prototype.close = function () {
      if (this._dead) return;
      this._dead = true;
      this.readyState = 3;
      this._fire("close");
    };
    window.__ptWS = PTWS;
  } catch (e) {}
})();

// Runs in the page (MAIN world) before the game and before the mod.
//
// mod5.js is spliced into a PolyTrack module on the site build, so two minified names it
// closes over come from that bundle scope: `c.Pq0` (three's Vector3) and `x` (the game's
// camera controller). Neither exists on the unmodified game, so this file supplies a
// small Vector3 and a no-op camera controller, and captures the real WebGLRenderer through
// three's own devtools observe hook (`__THREE_DEVTOOLS__`), which the 0.6.3 build ships.
// The mod then attaches its render hook to that live renderer.
(function () {
  function Vec3(x, y, z) {
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
  }
  Vec3.prototype.set = function (x, y, z) {
    (this.x = x), (this.y = y), (this.z = z);
    return this;
  };
  Vec3.prototype.copy = function (v) {
    return this.set(v.x, v.y, v.z);
  };
  Vec3.prototype.add = function (v) {
    (this.x += v.x), (this.y += v.y), (this.z += v.z);
    return this;
  };
  Vec3.prototype.sub = function (v) {
    (this.x -= v.x), (this.y -= v.y), (this.z -= v.z);
    return this;
  };
  Vec3.prototype.multiplyScalar = function (s) {
    (this.x *= s), (this.y *= s), (this.z *= s);
    return this;
  };
  Vec3.prototype.applyQuaternion = function (q) {
    const x = this.x, y = this.y, z = this.z;
    const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
    const xx = qx * x2, xy = qx * y2, xz = qx * z2;
    const yy = qy * y2, yz = qy * z2, zz = qz * z2;
    const wx = qw * x2, wy = qw * y2, wz = qw * z2;
    this.x = (1 - (yy + zz)) * x + (xy - wz) * y + (xz + wy) * z;
    this.y = (xy + wz) * x + (1 - (xx + zz)) * y + (yz - wx) * z;
    this.z = (xz - wy) * x + (yz + wx) * y + (1 - (xx + yy)) * z;
    return this;
  };

  window.__ptCompat = {
    three: { Pq0: Vec3 },
    // Stand-in for the game's camera controller class: the mod patches its prototype.update
    // to follow the car, which does nothing here. Camera orbit runs from the render hook.
    camCtl: { prototype: { update: function () {} } },
  };

  let pending = null;
  const isRenderer = (o) =>
    !!o &&
    typeof o.render === "function" &&
    typeof o.getContext === "function" &&
    !!o.domElement &&
    !!o.info;

  function hookRenderer(o) {
    if (!isRenderer(o)) return false;
    if (typeof window.__ptHookRenderer === "function") {
      window.__ptHookRenderer(o);
      return true;
    }
    pending = o;
    return false;
  }

  const timer = setInterval(() => {
    if (pending && hookRenderer(pending)) {
      pending = null;
      clearInterval(timer);
    }
  }, 500);
  setTimeout(() => clearInterval(timer), 120000);

  window.__THREE_DEVTOOLS__ = {
    dispatchEvent(ev) {
      try {
        if (ev && "observe" === ev.type) hookRenderer(ev.detail);
      } catch (e) {}
      return true;
    },
  };
})();

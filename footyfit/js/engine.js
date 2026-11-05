/* Stick-figure animation engine and pose library. Original drawings, no external assets. */
(function (global) {
  "use strict";
  var W = 240, H = 150, G = 136;
  var LEN = { torso: 32, neck: 12, head: 7.5, thigh: 24, shin: 24, foot: 8, upper: 17, fore: 16 };
  var NS = "http://www.w3.org/2000/svg";
  function rad(a) { return a * Math.PI / 180; }
  function go(p, a, l) { return [p[0] + Math.sin(rad(a)) * l, p[1] + Math.cos(rad(a)) * l]; }
  function P(o) {
    var q = Object.assign({ t: 180, hd: 0, L1: [0, 0, 90], L2: [0, 0, 90], A1: [8, 4], A2: [-8, -4], lift: 0, dx: 0 }, o);
    if (q.L1.length < 3) q.L1 = q.L1.concat([90]);
    if (q.L2.length < 3) q.L2 = q.L2.concat([90]);
    return q;
  }
  function X(p, o) { return P(Object.assign({}, p, o)); }
  function swapAll(p) { return X(p, { L1: p.L2, L2: p.L1, A1: p.A2, A2: p.A1 }); }
  function solve(q) {
    var hip = [0, 0], sh = go(hip, q.t, LEN.torso), head = go(sh, q.t + q.hd, LEN.neck + LEN.head);
    function leg(l) { var k = go(hip, l[0], LEN.thigh), a = go(k, l[1], LEN.shin), f = go(a, l[2], LEN.foot); return [k, a, f]; }
    function arm(r) { var e = go(sh, r[0], LEN.upper), w = go(e, r[1], LEN.fore); return [e, w]; }
    var l1 = leg(q.L1), l2 = leg(q.L2), r1 = arm(q.A1), r2 = arm(q.A2);
    return { hip: hip, sh: sh, head: head, k1: l1[0], a1: l1[1], f1: l1[2], k2: l2[0], a2: l2[1], f2: l2[2], e1: r1[0], w1: r1[1], e2: r2[0], w2: r2[1] };
  }
  var LIMBS = ["k1", "a1", "f1", "k2", "a2", "f2", "e1", "w1", "e2", "w2"];
  function lowest(j) {
    var m = Math.max(j.head[1] + LEN.head, j.sh[1] + 3.2, j.hip[1] + 3.2);
    for (var i = 0; i < LIMBS.length; i++) m = Math.max(m, j[LIMBS[i]][1] + 2.6);
    return m;
  }
  function place(q, anchor) {
    var j = solve(q), dy = G - lowest(j) - (q.lift || 0), dx = -j[anchor][0] + (q.dx || 0);
    for (var k in j) { j[k] = [j[k][0] + dx, j[k][1] + dy]; }
    return j;
  }
  function mix(a, b, u) {
    var r = {};
    ["t", "hd", "lift", "dx"].forEach(function (k) { r[k] = a[k] + (b[k] - a[k]) * u; });
    ["L1", "L2", "A1", "A2"].forEach(function (k) { r[k] = a[k].map(function (v, i) { return v + (b[k][i] - v) * u; }); });
    return r;
  }
  function ease(u) { return 0.5 - 0.5 * Math.cos(Math.PI * u); }
  function el(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function pts(arr) { return arr.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" "); }

  var CONE = { blue: "#2f6fd6", red: "#d23b2c", yellow: "#e0b000" };
  var reduce = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var scenes = [];

  function Scene(svg, spec) {
    var self = this;
    this.svg = svg; this.spec = spec; this.visible = true; this.t0 = Math.random() * 1500;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var figs = (spec.figs || [{ frames: spec.frames, anchor: spec.anchor }]).map(function (f) { var o = Object.assign({}, f); o.anchor = f.anchor || "hip"; return o; });
    this.figs = figs;
    var n = figs[0].frames.length; this.n = n;
    var mv = spec.move != null ? spec.move : 650, hd = spec.hold != null ? spec.hold : 260;
    this.segs = []; var total = 0;
    for (var i = 0; i < n; i++) {
      var to = (i + 1) % n, fr = figs[0].frames[to];
      var m = (to === 0 && spec.reset) ? 0 : (fr.mv != null ? fr.mv : mv);
      var h = figs[0].frames[i].hold != null ? figs[0].frames[i].hold : hd;
      this.segs.push({ i: i, to: to, h: h, m: m, s: total }); total += h + m;
    }
    this.total = Math.max(total, 1);
    this.offset = 0;
    if (!spec.figs) {
      var minX = 1e9, maxX = -1e9;
      figs[0].frames.forEach(function (q) { var j = place(q, figs[0].anchor); for (var k in j) { minX = Math.min(minX, j[k][0] - 8); maxX = Math.max(maxX, j[k][0] + 8); } });
      (spec.props || []).forEach(function (p) {
        if (p.type === "band") { minX = Math.min(minX, p.ax - 6); maxX = Math.max(maxX, p.ax + 8); return; }
        if (p.at || p.path) return;
        var xs = p.xs || (p.x != null ? [p.x] : []);
        xs.forEach(function (x) { var w = p.w || 12; minX = Math.min(minX, x - 6); maxX = Math.max(maxX, x + w); });
      });
      this.offset = W / 2 - (minX + maxX) / 2;
    }
    el("rect", { x: 0, y: 0, width: W, height: H, fill: "var(--sky)" }, svg);
    el("rect", { x: 0, y: G, width: W, height: H - G, fill: "var(--grass)" }, svg);
    for (var s = 0; s < W; s += 40) el("rect", { x: s, y: G, width: 20, height: H - G, fill: "var(--grass2)" }, svg);
    el("line", { x1: 0, y1: G, x2: W, y2: G, stroke: "var(--far)", "stroke-width": 1 }, svg);
    this.dyn = [];
    var balls = [];
    (spec.props || []).forEach(function (p) {
      var g = el("g", {}, svg);
      if (p.type === "cone") {
        var sc = p.small ? 0.7 : 1, c = p.color ? CONE[p.color] : "var(--cone)";
        el("polygon", { points: [[-6 * sc, G], [6 * sc, G], [1.6 * sc, G - 13 * sc], [-1.6 * sc, G - 13 * sc]].map(function (a) { return a.join(","); }).join(" "), fill: c }, g);
        el("rect", { x: -3.8 * sc, y: G - 7.5 * sc, width: 7.6 * sc, height: 2 * sc, fill: "#fff", opacity: .85 }, g);
      } else if (p.type === "wall") {
        el("rect", { x: 0, y: G - 86, width: 8, height: 86, fill: "var(--line)", stroke: "var(--far)", "stroke-width": 1 }, g);
      } else if (p.type === "box") {
        el("rect", { x: 0, y: G - p.h, width: p.w, height: p.h, rx: 2, fill: "var(--line)", stroke: "var(--far)", "stroke-width": 1 }, g);
      } else if (p.type === "line") {
        el("rect", { x: -1.2, y: G, width: 2.4, height: H - G, fill: "var(--card)" }, g);
      } else if (p.type === "ball") {
        el("circle", { r: 5.2, fill: "#fff", stroke: "var(--ink)", "stroke-width": 1.3 }, g);
        el("circle", { r: 1.9, fill: "var(--ink)" }, g);
        balls.push(g);
      } else if (p.type === "db") {
        var dg = el("g", p.vert ? { transform: "rotate(90)" } : {}, g);
        el("rect", { x: -6, y: -1.2, width: 12, height: 2.4, rx: 1, fill: "#5b6670" }, dg);
        el("rect", { x: -7.5, y: -3.6, width: 3.2, height: 7.2, rx: 1, fill: "#2f6fd6" }, dg);
        el("rect", { x: 4.3, y: -3.6, width: 3.2, height: 7.2, rx: 1, fill: "#2f6fd6" }, dg);
        balls.push(g);
      } else if (p.type === "loop") {
        el("ellipse", { rx: 3.2, ry: 4.2, fill: "none", stroke: "#d23b2c", "stroke-width": 2.2 }, g);
        balls.push(g);
      } else if (p.type === "band") {
        el("rect", { x: p.ax, y: G - 96, width: 6, height: 96, fill: "var(--line)", stroke: "var(--far)", "stroke-width": 1 }, g);
        g.setAttribute("transform", "translate(" + self.offset.toFixed(1) + ",0)");
        var bl = el("line", { stroke: "#d23b2c", "stroke-width": 2.2, "stroke-linecap": "round" }, svg);
        self.dyn.push({ p: p, line: bl }); balls.push(bl);
        return;
      }
      if (p.at || p.path || p.xs || p.type === "ball") self.dyn.push({ p: p, g: g });
      else g.setAttribute("transform", "translate(" + (p.x + self.offset).toFixed(1) + ",0)");
    });
    this.els = figs.map(function (f) {
      var alt = f.color === "alt";
      var ink = alt ? "var(--alt)" : "var(--ink)", far = alt ? "var(--alt-far)" : "var(--far)";
      var g = el("g", { "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none" }, svg);
      return {
        farArm: el("polyline", { stroke: far, "stroke-width": 4.6 }, g),
        farLeg: el("polyline", { stroke: far, "stroke-width": 5 }, g),
        torso: el("line", { stroke: ink, "stroke-width": 6.5 }, g),
        head: el("circle", { r: LEN.head, fill: ink, stroke: "none" }, g),
        nearLeg: el("polyline", { stroke: ink, "stroke-width": 5 }, g),
        nearArm: el("polyline", { stroke: ink, "stroke-width": 4.6 }, g)
      };
    });
    balls.forEach(function (g) { svg.appendChild(g); });
    this.still = reduce || n === 1;
    this.draw(spec.key != null ? spec.key : (n > 1 ? 1 : 0), null, 0);
    svg._scene = this;
    scenes.push(this);
    if (io) io.observe(svg);
  }
  Scene.prototype.draw = function (i, to, u) {
    var self = this, joints0 = null;
    this.figs.forEach(function (f, fi) {
      var q = to == null ? f.frames[i] : mix(f.frames[i], f.frames[to], u);
      var j = place(q, f.anchor);
      for (var k in j) { var x = f.mirror ? (f.x - j[k][0]) : ((f.x || 0) + j[k][0]); j[k] = [x + self.offset, j[k][1]]; }
      if (fi === 0) joints0 = j;
      var o = self.els[fi];
      o.farArm.setAttribute("points", pts([j.sh, j.e2, j.w2]));
      o.farLeg.setAttribute("points", pts([j.hip, j.k2, j.a2, j.f2]));
      o.torso.setAttribute("x1", j.hip[0].toFixed(1)); o.torso.setAttribute("y1", j.hip[1].toFixed(1));
      o.torso.setAttribute("x2", j.sh[0].toFixed(1)); o.torso.setAttribute("y2", j.sh[1].toFixed(1));
      o.head.setAttribute("cx", j.head[0].toFixed(1)); o.head.setAttribute("cy", j.head[1].toFixed(1));
      o.nearLeg.setAttribute("points", pts([j.hip, j.k1, j.a1, j.f1]));
      o.nearArm.setAttribute("points", pts([j.sh, j.e1, j.w1]));
    });
    this.dyn.forEach(function (d) {
      var p = d.p, x, y = 0;
      if (d.line) {
        var hj = joints0[p.at];
        d.line.setAttribute("x1", hj[0].toFixed(1)); d.line.setAttribute("y1", hj[1].toFixed(1));
        d.line.setAttribute("x2", (p.ax + 1 + self.offset).toFixed(1)); d.line.setAttribute("y2", (G - p.ah).toFixed(1));
        return;
      }
      var lift = p.type === "db" ? 3.6 : p.type === "loop" ? 4.2 : 5.2;
      if (p.path) {
        var ja = joints0[p.path[Math.min(i, p.path.length - 1)]], jb = to == null ? ja : joints0[p.path[Math.min(to, p.path.length - 1)]];
        x = ja[0] + (jb[0] - ja[0]) * u + (p.dx || 0);
        y = p.ground ? G - lift : ja[1] + (jb[1] - ja[1]) * u + (p.dy || 0);
      } else if (p.at) {
        var a = joints0[p.at]; x = a[0] + (p.dx || 0);
        if (p.ground) y = G - lift;
        else if (p.type === "ball" || p.type === "db" || p.type === "loop") y = a[1] + (p.dy || 0);
      } else {
        var xs = p.xs || [p.x], ys = p.ys || [0];
        var xa = xs[Math.min(i, xs.length - 1)], xb = to == null ? xa : xs[Math.min(to, xs.length - 1)];
        var ya = ys[Math.min(i, ys.length - 1)], yb = to == null ? ya : ys[Math.min(to, ys.length - 1)];
        x = xa + (xb - xa) * u + self.offset;
        y = p.type === "ball" ? G - 5.2 - (ya + (yb - ya) * u) : 0;
      }
      d.g.setAttribute("transform", "translate(" + x.toFixed(1) + "," + y.toFixed(1) + ")");
    });
  };
  Scene.prototype.tick = function (now) {
    if (this.still || !this.visible) return;
    var t = (now + this.t0) % this.total;
    for (var k = 0; k < this.segs.length; k++) {
      var s = this.segs[k];
      if (t < s.s + s.h + s.m || k === this.segs.length - 1) {
        var r = t - s.s;
        if (r < s.h || s.m === 0) this.draw(s.i, null, 0);
        else this.draw(s.i, s.to, ease(Math.min(1, (r - s.h) / s.m)));
        return;
      }
    }
  };
  var io = ("IntersectionObserver" in global) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.target._scene) e.target._scene.visible = e.isIntersecting; });
  }, { rootMargin: "80px" }) : null;
  function loop(now) {
    for (var i = scenes.length - 1; i >= 0; i--) {
      var s = scenes[i];
      if (!s.svg.isConnected) { if (io) io.unobserve(s.svg); scenes.splice(i, 1); continue; }
      s.tick(now);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ---------------- poses ---------------- */
  var STAND = P({});
  var DB0 = P({ t: -90, hd: -10, L1: [180, 90, 180], L2: [180, 90, 180], A1: [180, 180], A2: [180, 180] });
  var DB1 = X(DB0, { A1: [-100, -100], L2: [100, 100, 180] }), DB2 = X(DB0, { A2: [-100, -100], L1: [100, 100, 180] });
  var DBs0 = X(DB0, { L1: [180, 180, 180], L2: [180, 180, 180] });
  var DBs1 = X(DBs0, { A1: [-100, -100], L2: [100, 100, 180] }), DBs2 = X(DBs0, { A2: [-100, -100], L1: [100, 100, 180] });
  var PL = P({ t: 97, L1: [-83, -83, 0], L2: [-83, -83, 0], A1: [0, 90], A2: [0, 90] });
  var PLl2 = X(PL, { L2: [-97, -97, 0] }), PLl1 = X(PL, { L1: [-97, -97, 0] });
  var HP = P({ t: 108, L1: [-72, -72, 0], L2: [-72, -72, 0], A1: [0, 0], A2: [0, 0] });
  var HPt1 = X(HP, { A1: [40, -140] }), HPt2 = X(HP, { A2: [40, -140] }), HPp = X(HP, { A1: [55, 50] });
  var SPK = P({ t: 108, L1: [-72, -120, -90], L2: [-72, -120, -90], A1: [0, 90], A2: [180, 180] });
  var SPF = P({ t: 102, L1: [-78, -78, -90], L2: [-78, -78, -90], A1: [0, 90], A2: [180, 180] });
  var SPL = X(SPF, { L2: [-108, -108, -90] });
  var GB0 = P({ t: -90, hd: -10, L1: [135, 35, 90], L2: [135, 35, 90], A1: [90, 90], A2: [90, 90] });
  var GB1 = P({ t: -68, hd: -32, L1: [112, 29, 90], L2: [112, 29, 90], A1: [90, 90], A2: [90, 90] });
  var GBm1 = X(GB1, { L1: [172, 90, 150] }), GBm2 = X(GB1, { L2: [172, 90, 150] });
  var GBs0 = X(GB0, { L2: [135, 135, 160] }), GBs1 = X(GB1, { L2: [112, 112, 160] });
  var BD = P({ t: 106, L1: [0, -90, -80], L2: [0, -90, -80], A1: [0, 0], A2: [0, 0] });
  var BD1 = X(BD, { A1: [95, 95], L2: [-95, -95, 0] }), BD2 = X(BD, { A2: [95, 95], L1: [-95, -95, 0] });
  var SQ0 = P({}), SQ1 = P({ t: 145, hd: 15, L1: [80, -25, 90], L2: [80, -25, 90], A1: [90, 90], A2: [90, 90] });
  var SQ0o = P({ A1: [180, 180], A2: [180, 180] }), SQ1o = X(SQ1, { A1: [160, 160], A2: [160, 160] });
  var LU0 = P({ A1: [-30, 60], A2: [-30, 60] }), LU1 = P({ L1: [85, 0, 90], L2: [-10, -88, 50], A1: [-30, 60], A2: [-30, 60] });
  var LUb0 = P({ A1: [45, 125], A2: [45, 125] }), LUb1 = X(LU1, { A1: [45, 125], A2: [45, 125] });
  var PU1 = P({ t: 90, L1: [-90, -90, 0], L2: [-90, -90, 0], A1: [-95, 60], A2: [-95, 60] });
  var PI0 = P({ t: 125, L1: [-55, -55, 0], L2: [-55, -55, 0], A1: [0, 0], A2: [0, 0] });
  var PI1 = P({ t: 110, L1: [-70, -70, 0], L2: [-70, -70, 0], A1: [-95, 27], A2: [-95, 27] });
  var SL = P({ L2: [60, -15, 90], A1: [60, 70], A2: [-50, -40] }), SLs = X(SL, { t: 177, A1: [70, 82], A2: [-60, -50] });
  var SLc = P({ L2: [60, -15, 90], A1: [50, 120], A2: [50, 120] }), SLth = X(SLc, { A1: [100, 105], A2: [100, 105] });
  var SLrA = P({ t: 186, L1: [15, -12, 90], L2: [72, 72, 90], A1: [50, 60], A2: [-40, -30] }), SLrB = P({ t: 160, L1: [22, -12, 90], L2: [-40, -40, 10], A1: [80, 90], A2: [60, 70] });
  var BH = P({ t: 96, L1: [10, -88, 50], L2: [10, -88, 50], A1: [0, 0], A2: [0, 0] });
  var BH1 = X(BH, { A1: [25, 25], L2: [30, -80, 50] }), BH2 = X(BH, { A2: [25, 25], L1: [30, -80, 50] });
  var JG1 = P({ t: 172, L1: [50, -30, 90], L2: [-20, -50, 40], A1: [-35, 40], A2: [35, 120], lift: 2 }), JG2 = swapAll(JG1);
  var HK1 = P({ t: 178, L1: [90, 0, 90], L2: [0, 0, 60], A1: [-40, 30], A2: [45, 140] }), HK2 = swapAll(HK1);
  var HF1 = P({ t: 176, L1: [-5, -160, -70], L2: [0, 0, 60], A1: [-35, 40], A2: [35, 120] }), HF2 = swapAll(HF1);
  var SH1 = P({ t: 180, L1: [28, 8, 90], L2: [-28, -8, -90], A1: [35, 10], A2: [-35, -10] }), SH2 = P({ t: 180, L1: [12, 2, 90], L2: [-12, -2, -90], A1: [35, 10], A2: [-35, -10] });
  var IW1 = P({ t: 40, A1: [35, 35], A2: [35, 35] });
  var SPM0 = P({ t: 103, hd: -15, L1: [75, -35, 90], L2: [-50, -75, 60], A1: [0, 0], A2: [0, 0] }), SPM1 = X(SPM0, { t: 112, A1: [180, 180] });
  var AS1 = P({ t: 178, L1: [95, 0, 95], L2: [0, 0, 60], A1: [-45, 30], A2: [50, 150], lift: 4 }), AS2 = swapAll(AS1);
  var AM1 = X(AS1, { lift: 0 }), AM2 = X(AS2, { lift: 0 });
  var WD1 = P({ t: 135, L2: [-45, -45, 60], L1: [75, -45, 45], A1: [90, 90], A2: [90, 90] }), WD2 = X(WD1, { L1: WD1.L2, L2: WD1.L1 });
  var PG0 = P({ L1: [0, 0, 60], L2: [0, 0, 60], A1: [-15, 20], A2: [-15, 20] }), PG1 = X(PG0, { L1: [0, 0, 30], L2: [0, 0, 30], A1: [10, 40], A2: [10, 40], lift: 10 });
  var BJ1 = P({ t: 140, hd: 20, L1: [60, -25, 90], L2: [60, -25, 90], A1: [-60, -50], A2: [-60, -50], hold: 450 }),
      BJ2 = P({ t: 150, hd: 10, L1: [30, -20, 40], L2: [40, -10, 40], A1: [150, 150], A2: [150, 150], lift: 22, dx: 34, hold: 0 }),
      BJ3 = P({ t: 145, hd: 15, L1: [75, -25, 90], L2: [75, -25, 90], A1: [90, 90], A2: [90, 90], dx: 68, hold: 950 });
  var SK1 = P({ t: 170, L1: [14, -6, 90], L2: [-40, -80, -90], A1: [-45, -20], A2: [70, 110], dx: 30, hold: 450 }),
      SK2 = P({ t: 180, L1: [22, 8, 90], L2: [-22, -8, -90], A1: [-20, -10], A2: [20, 10], lift: 14, dx: 0, hold: 0 }),
      SK3 = P({ t: 190, L1: [40, 80, 90], L2: [-14, 6, -90], A1: [-70, -110], A2: [45, 20], dx: -30, hold: 450 });
  var SPR1 = P({ t: 140, hd: 12, L1: [75, -10, 80], L2: [-30, -40, 30], A1: [-55, 20], A2: [50, 135] }), SPR2 = swapAll(SPR1);
  var STOP = P({ t: 182, L1: [55, 30, 90], L2: [-30, -15, 90], A1: [60, 90], A2: [40, 80], mv: 420, hold: 900 });
  var ATH = P({ t: 155, hd: 20, L1: [45, -15, 90], L2: [30, -20, 90], A1: [30, 70], A2: [20, 60] });
  var TURN = P({ t: 105, hd: 35, L1: [80, -30, 90], L2: [-30, -80, 75], A1: [8, 0], A2: [80, 130], dx: 42 });
  var SU0 = P({ t: 220, L1: [130, 40, 90], L2: [130, 40, 90], A1: [200, 195], A2: [200, 195] }), SU1 = P({ t: 168, hd: 8, L1: [130, 40, 90], L2: [130, 40, 90], A1: [140, 120], A2: [140, 120] });
  var GU0 = P({ t: 90, hd: 10, L1: [-90, -90, -90], L2: [-90, -90, -90], A1: [-100, 50], A2: [-100, 50], hold: 700 }), GU1 = P({ t: 125, L1: [70, -40, 40], L2: [-50, -60, 20], A1: [0, 0], A2: [0, 0] });
  var SHD = P({ t: 172, hd: 5, L1: [35, -10, 90], L2: [-25, -15, 90], A1: [-75, -40], A2: [30, 60] }), SHD2 = X(SHD, { dx: -4, t: 168, A1: [-80, -50] });
  var ATK = P({ t: 150, hd: 15, L1: [45, -15, 90], L2: [-15, -25, 90], A1: [75, 80], A2: [50, 70] }), ATK2 = X(ATK, { dx: 6, A1: [88, 92] });
  var DR1 = P({ t: 170, L1: [45, -25, 80], L2: [-20, -50, 40], A1: [-35, 40], A2: [35, 110] }), DR2 = swapAll(DR1);
  var KB = P({ t: 172, hd: 10, L1: [15, -5, 90], L2: [-40, -110, -10], A1: [-70, -30], A2: [70, 100], hold: 120 }), KS = P({ t: 186, hd: -5, L1: [5, -5, 90], L2: [70, 60, 95], A1: [60, 100], A2: [-60, -20], hold: 800 });
  // new poses
  var HOt = P({ t: -100, hd: -12, L1: [150, 95, 180], L2: [150, 95, 180], A1: [115, 105], A2: [115, 105] });
  var HOs1 = P({ t: -100, hd: -12, L1: [150, 95, 180], L2: [98, 98, 180], A1: [115, 105], A2: [115, 105] }), HOs2 = X(HOs1, { L1: [98, 98, 180], L2: [150, 95, 180] });
  var HOf = P({ t: -100, hd: -12, L1: [98, 98, 180], L2: [98, 98, 180], A1: [-105, -105], A2: [-105, -105] });
  var MC1 = X(HP, { L1: [90, -60, -30] }), MC2 = X(HP, { L2: [90, -60, -30] });
  var SM0 = P({ t: 90, hd: 10, L1: [-90, -90, -90], L2: [-90, -90, -90], A1: [92, 92], A2: [92, 92] }), SM1 = P({ t: 97, hd: 5, L1: [-97, -97, -90], L2: [-97, -97, -90], A1: [100, 100], A2: [100, 100] });
  var SM2 = X(SM1, { A1: [106, 106], A2: [94, 94], L1: [-101, -101, -90], L2: [-94, -94, -90] }), SM3 = X(SM1, { A1: [94, 94], A2: [106, 106], L1: [-94, -94, -90], L2: [-101, -101, -90] });
  var VS1 = P({ t: 215, hd: -10, L1: [130, 40, 90], L2: [130, 40, 90], A1: [110, 100], A2: [110, 100] });
  var VS2 = P({ t: 215, hd: -10, L1: [135, 90, 120], L2: [135, 90, 120], A1: [110, 100], A2: [110, 100] });
  var VS3 = P({ t: 210, hd: -10, L1: [125, 125, 150], L2: [125, 125, 150], A1: [115, 115], A2: [115, 115] });
  var SS0 = P({ L1: [40, -10, 90], L2: [-37, -37, 60], A1: [-30, 60], A2: [-30, 60] }), SS1 = P({ L1: [85, -5, 90], L2: [5, -88, 70], A1: [-30, 60], A2: [-30, 60] });
  var LL0 = P({ L1: [33, 33, 90], L2: [-33, -33, -90], A1: [20, -20], A2: [-20, 20] }), LL1 = P({ t: 172, L1: [60, 0, 90], L2: [-41, -41, -90], A1: [20, -20], A2: [-20, 20] }), LL2 = P({ t: 188, L1: [41, 41, 90], L2: [-60, 0, -90], A1: [20, -20], A2: [-20, 20] });
  var CR0 = P({ L2: [-5, -100, -10], A1: [70, 60], A2: [60, 50] }), CR1 = X(CR0, { L1: [0, 0, 40] });
  var NH0 = P({ L1: [0, -90, -90], L2: [0, -90, -90], A1: [30, 150], A2: [30, 150] }), NH1 = P({ t: 130, L1: [-50, -90, -90], L2: [-50, -90, -90], A1: [60, 50], A2: [60, 50], mv: 1500, hold: 300 });
  var PK = P({ t: 115, hd: 20, L1: [0, -90, -90], L2: [0, -90, -90], A1: [0, 0], A2: [0, 0] });
  var WS = P({ L1: [88, 0, 90], L2: [88, 0, 90], A1: [70, 20], A2: [70, 20] });
  var ST0 = P({ L1: [70, -10, 90], L2: [-15, -5, 90], A1: [-20, 40], A2: [20, 60] }), ST1 = P({ L1: [0, 0, 90], L2: [90, 0, 90], A1: [30, 80], A2: [-30, 20], lift: 15.3, hold: 500 });
  var HS0 = P({ t: 160, hd: 15, L1: [40, -20, 90], L2: [30, -80, 40], A1: [-50, -30], A2: [-50, -30], hold: 350 }),
      HS1 = P({ t: 170, L1: [15, -10, 50], L2: [40, -60, 40], A1: [120, 120], A2: [120, 120], lift: 14, dx: 20, hold: 0 }),
      HS2 = P({ t: 160, hd: 15, L1: [45, -22, 90], L2: [30, -80, 40], A1: [70, 80], A2: [60, 70], dx: 40, hold: 900 });
  var QF0 = P({ L1: [6, 0, 90], L2: [-6, 0, -90], A1: [30, 80], A2: [-30, -80], lift: 4 }), QF1 = P({ L1: [20, 6, 90], L2: [-20, -6, -90], A1: [30, 80], A2: [-30, -80] });
  var CUT = P({ t: 150, hd: 20, L1: [50, 10, 90], L2: [-35, -40, 40], A1: [-40, 20], A2: [60, 120], hold: 200 });
  var BP1 = P({ t: 162, hd: 15, L1: [20, -30, 90], L2: [-15, -40, 60], A1: [-20, 60], A2: [30, 90] }), BP2 = swapAll(BP1);
  var TT1 = P({ t: 178, L1: [50, -15, 60], L2: [0, 0, 60], A1: [-30, 40], A2: [30, 100], lift: 2 }), TT2 = swapAll(TT1);
  var JU0 = P({ L1: [60, 20, 80], A1: [40, 60], A2: [-40, -20], hold: 0 }), JU1 = P({ L1: [8, 4, 70], A1: [40, 60], A2: [-40, -20], hold: 0 });
  var CS = P({ t: 150, L1: [40, -15, 90], L2: [-32, -32, 90], A1: [95, 95], A2: [95, 95] });
  var HFS = P({ t: 185, L1: [90, 0, 90], L2: [-25, -90, -90], A1: [20, 30], A2: [175, 180] });
  var HMS = P({ t: 140, hd: 10, L1: [60, 60, 150], L2: [0, 0, 90], A1: [55, 55], A2: [55, 55] });
  var QS = P({ L2: [0, 0, 90], L1: [-15, -165, -60], A1: [-21, -21], A2: [80, 80] });


  // ---- FIFA 11+ Kids and light-kit strength poses
  var HOLD = { A1: [55, 120], A2: [55, 120] };
  var SLF = P({ L2: [62, -12, 90], A1: [70, 85], A2: [-60, -70] });
  var JGb1 = X(JG1, HOLD), JGb2 = X(JG2, HOLD), SLb = X(SLF, HOLD);
  var SLfoot = P({ L2: [45, 10, 90], A1: [60, 70], A2: [-50, -40] });
  var PAR = P({}), PARu = P({ A1: [172, 178] }), PARf = P({ A1: [88, 92] }), PARb = P({ A1: [-88, -92] });
  var SKa1 = X(SK1, { hold: 900 }), SKa3 = X(SK3, { hold: 900 });
  var SKb1 = X(SK1, HOLD), SKb2 = X(SK2, HOLD), SKb3 = X(SK3, HOLD);
  var ONEH = { A1: [92, 92] };
  var SKo1 = X(SK1, ONEH), SKo2 = X(SK2, ONEH), SKo3 = X(SK3, ONEH);
  var BEND1 = X(SK1, { t: 122, hd: 10, A1: [28, 28], A2: [28, 28], hold: 500 }), BEND3 = X(SK3, { t: 122, hd: 10, A1: [28, 28], A2: [28, 28], hold: 500 });
  var AIR1 = X(SK1, { t: 96, hd: -6, L1: [6, -4, 90], L2: [-84, -86, -20], A1: [94, 94], A2: [94, 94], hold: 900 });
  var AIR3 = X(SK3, { t: 96, hd: -6, L2: [6, -4, 90], L1: [-84, -86, -20], A1: [94, 94], A2: [94, 94], hold: 900 });
  var SLc2 = X(SLc, {}), SLleg = P({ t: 168, L2: [86, 2, 90], A1: [38, 22], A2: [38, 22] });
  var SLp0 = P({ L2: [-25, -45, 60], A1: [45, 60], A2: [-45, -30] }), SLp1 = P({ L2: [32, 18, 95], A1: [35, 50], A2: [-55, -40] });
  var SLpush = X(SLc, { A1: [88, 92], A2: [88, 92] });
  var PLB = P({ t: 97, L1: [-90, -90, 0], L2: [-90, -90, 0], A1: [0, 90], A2: [0, 90] }), PLB2 = X(PLB, { t: 99, L1: [-87, -87, 0], L2: [-87, -87, 0] });
  var HPB = P({ t: 118, L1: [-68, -68, 0], L2: [-68, -68, 0], A1: [0, 0], A2: [0, 0] }), HPB2 = X(HPB, { L1: [-73, -73, 0], L2: [-73, -73, 0] });
  var HSb0 = X(HS0, HOLD), HSb1 = X(HS1, HOLD), HSb2 = X(HS2, HOLD);
  var SPD = P({ t: 65, hd: -22, L1: [0, -25, 90], L2: [0, -25, 90], A1: [0, 0], A2: [0, 0] });
  var SPDf = X(SPD, { L1: [-30, -62, 0] });
  var SPDx = P({ t: 78, hd: -12, L1: [-40, -40, 40], L2: [-40, -40, 40], A1: [0, 0], A2: [0, 0] });
  var SPDs1 = X(SPD, { A1: [-14, -14], L2: [-12, -40, 90] }), SPDs2 = X(SPD, { A2: [-14, -14], L1: [-12, -40, 90] });
  var SPD5 = P({ t: 65, hd: -22, L1: [10, -55, 90], L2: [10, -55, 90], A1: [0, 0], A2: [0, 0] });
  var CR7 = P({ t: 150, hd: 20, L1: [95, -25, 90], L2: [95, -25, 90], A1: [60, 140], A2: [60, 140] });
  var TUCK = P({ t: -112, hd: 40, L1: [165, 70, 140], L2: [165, 70, 140], A1: [150, 80], A2: [150, 80] });
  var WK1 = P({ t: 178, L1: [24, 6, 90], L2: [-20, -12, 90], A1: [-18, 10], A2: [18, 30] }), WK2 = swapAll(WK1);
  var GS0 = P({ A1: [22, 162], A2: [22, 162] }), GS1 = X(SQ1, { A1: [42, 168], A2: [42, 168] });
  var SSd0 = X(SS0, { A1: [2, 2], A2: [-2, -2] }), SSd1 = X(SS1, { A1: [2, 2], A2: [-2, -2] });
  var BR0 = P({ t: 172, L1: [22, -12, 90], L2: [-10, -16, 90], A1: [90, 90], A2: [90, 90] }), BR1 = X(BR0, { A1: [-38, 86], A2: [-38, 86], hold: 500 });
  var HPr = X(HP, { A1: [-12, -70] });
  var FC1 = X(WK1, { A1: [2, 2], A2: [-2, -2] }), FC2 = X(WK2, { A1: [-2, -2], A2: [2, 2] });
  var YR0 = P({ t: 90, hd: 10, L1: [-90, -90, -90], L2: [-90, -90, -90], A1: [92, 92], A2: [92, 92] }), YR1 = P({ t: 94, hd: 0, L1: [-90, -90, -90], L2: [-90, -90, -90], A1: [104, 104], A2: [104, 104] });

  function seq(frames, dxs) { return frames.map(function (f, i) { return X(f, { dx: dxs[i] }); }); }

  var SC = {
    W1: { frames: [JG1, JG2], move: 300, hold: 0 },
    W2: { frames: [HK1, HK2], move: 230, hold: 0 },
    W3: { frames: [HF1, HF2], move: 230, hold: 0 },
    W4: { frames: seq([SH1, SH2, SH1, SH2, SH1, SH2, SH1, SH2], [0, 9, 18, 27, 36, 27, 18, 9]), move: 210, hold: 0 },
    W5: { frames: [STAND, IW1, HP, IW1], anchor: "a1", move: 850, hold: 300 },
    W6: { frames: [SPM0, SPM1], anchor: "a1", move: 900, hold: 500 },
    W7: { frames: [SPR1, SPR2], move: 250, hold: 0 },
    A1: [{ frames: [DB0, DB1, DB0, DB2], move: 950, hold: 250 }, { frames: [DB0, X(DB1, { hold: 1300 }), DB0, X(DB2, { hold: 1300 })], move: 950, hold: 250 }, { frames: [DBs0, DBs1, DBs0, DBs2], move: 1300, hold: 250 }],
    A2: [{ frames: [PL] }, { frames: [HP, HPt1, HP, HPt2], anchor: "a1", move: 420, hold: 250 }, { frames: [PL, PLl2, PL, PLl1], move: 500, hold: 900 }],
    A3: [{ frames: [SPK] }, { frames: [SPF] }, { frames: [SPF, SPL], move: 750, hold: 300 }],
    A4: [{ frames: [GB0, X(GB1, { hold: 900 })], anchor: "a1", move: 800, hold: 300 }, { frames: [GB1, GBm1, GB1, GBm2], anchor: "a1", move: 550, hold: 300 }, { frames: [GBs0, X(GBs1, { hold: 800 })], anchor: "a1", move: 800, hold: 300 }],
    A5: { frames: [BD, X(BD1, { hold: 900 }), BD, X(BD2, { hold: 900 })], move: 800, hold: 250 },
    A6: [{ frames: [SQ0, SQ1], anchor: "a1", move: 900, hold: 300, props: [{ type: "box", x: -37, w: 24, h: 24 }] }, { frames: [X(SQ0, { mv: 500 }), X(SQ1, { mv: 1500 })], anchor: "a1", hold: 300 }, { frames: [SQ0o, X(SQ1o, { hold: 1000 })], anchor: "a1", move: 900, hold: 300 }],
    A7: [{ frames: [LU0, LU1], anchor: "a1", move: 800, hold: 350 }, { frames: [LU0, LU1], anchor: "a1", move: 800, hold: 350 }, { frames: [LUb0, LUb1], anchor: "a1", move: 800, hold: 450, props: [{ type: "ball", at: "w1", dy: -3 }] }],
    A8: [{ frames: [PI0, PI1], anchor: "a1", move: 900, hold: 200, props: [{ type: "box", x: 52, w: 28, h: 20 }] }, { frames: [X(HP, { mv: 600 }), X(PU1, { mv: 1300 })], anchor: "a1", hold: 200 }, { frames: [HP, PU1, HP, HPt1], anchor: "a1", move: 650, hold: 200 }],
    A9: [{ frames: [SL, SLs], move: 1600, hold: 200 }, { frames: [SLc, SLth], move: 500, hold: 400, props: [{ type: "ball", at: "w1", dy: -2 }] }, { frames: [SLrA, SLrB], anchor: "a1", move: 1100, hold: 400 }],
    A10: [{ frames: [BH] }, { frames: [BH, BH1, BH, BH2], move: 380, hold: 80 }, { frames: [BH, BH1, BH, BH2], move: 380, hold: 80 }],
    A11: [{ frames: [HOt] }, { frames: [HOs1, HOs2], move: 900, hold: 1500 }, { frames: [HOf] }],
    A12: [{ frames: [HP, MC1, HP, MC2], anchor: "w1", move: 450, hold: 250 }, { frames: [MC1, MC2], anchor: "w1", move: 330, hold: 40 }, { frames: [MC1, MC2], anchor: "w1", move: 220, hold: 0 }],
    A13: [{ frames: [SM0, X(SM1, { hold: 900 })], move: 700, hold: 300 }, { frames: [SM0, X(SM1, { hold: 1500 })], move: 700, hold: 300 }, { frames: [SM2, SM3], move: 300, hold: 0 }],
    A14: [{ frames: [VS1] }, { frames: [VS2] }, { frames: [VS3] }],
    A15: { frames: [SS0, SS1], anchor: "a1", move: 900, hold: 350 },
    A16: { frames: [LL0, LL1, LL0, LL2], anchor: "a1", move: 900, hold: 350 },
    A17: { frames: [CR0, CR1], anchor: "f1", move: 800, hold: 400, props: [{ type: "wall", at: "w1", dx: 2.5 }] },
    A18: { figs: [{ frames: [NH0, NH1], anchor: "k1", x: 128 }, { frames: [PK, PK], x: 75, color: "alt" }], move: 900, hold: 400 },
    A19: { frames: [WS], props: [{ type: "wall", at: "hip", dx: -11.5 }] },
    A20: { frames: [ST0, ST1], anchor: "a1", move: 800, hold: 300, props: [{ type: "box", x: -8, w: 30, h: 15 }] },
    B1: [{ frames: [AM1, AM2], move: 700, hold: 200 }, { frames: [AS1, AS2], move: 300, hold: 40 }, { frames: [AS1, AS2], move: 300, hold: 40 }],
    B2: [{ frames: [WD1], anchor: "w1", props: [{ type: "wall", x: 2.5 }] }, { frames: [WD1, WD2], anchor: "w1", move: 700, hold: 500, props: [{ type: "wall", x: 2.5 }] }, { frames: [WD1, WD2, WD1, X(WD2, { hold: 900 })], anchor: "w1", move: 150, hold: 0, props: [{ type: "wall", x: 2.5 }] }],
    B3: { frames: [PG0, PG1], move: 200, hold: 60 },
    B4: { frames: [BJ1, BJ2, BJ3], reset: true, move: 430, hold: 250, props: [{ type: "line", x: 4 }] },
    B5: { frames: [SK1, SK2, SK3, SK2], move: 340, hold: 0 },
    B6: { frames: [SPR1, SPR2], move: 220, hold: 0, props: [{ type: "cone", x: -58 }, { type: "cone", x: 64 }] },
    B7: { frames: [SPR1, SPR2, SPR1, STOP], reset: true, move: 220, hold: 0 },
    B8: { frames: [ATH, TURN], move: 450, hold: 400, props: [{ type: "cone", x: -50 }, { type: "cone", x: 12 }, { type: "cone", x: 84 }] },
    B9: { figs: [{ frames: [ATH, X(ATH, { lift: 5 })], x: 60 }, { frames: [ATH, X(ATH, { lift: 5 })], x: 180, mirror: true, color: "alt" }], move: 260, hold: 120, props: [{ type: "line", x: 120 }] },
    B10: { frames: [ATH, X(ATH, { lift: 6, hold: 0 }), ATH, X(SPR1, { dx: 22, mv: 300, hold: 0 }), X(SPR2, { dx: 42, hold: 350 })], reset: true, move: 250, hold: 350, props: [{ type: "cone", x: -64, color: "blue" }, { type: "cone", x: -36, small: true, color: "red" }, { type: "cone", x: 76, small: true, color: "yellow" }, { type: "cone", x: 100 }] },
    B11: { frames: [HS0, HS1, HS2], reset: true, move: 420, hold: 250, props: [{ type: "line", x: 52 }] },
    B12: { frames: [QF0, QF1], move: 170, hold: 0, props: [{ type: "line", x: 0 }] },
    B13: { frames: [SPR1, X(SPR2, { dx: 20 }), X(STOP, { dx: 40, hold: 300, mv: 300 }), X(SH1, { dx: 40 }), X(SH2, { dx: 52, hold: 300 })], reset: true, move: 260, hold: 0, props: [{ type: "cone", x: -14 }, { type: "cone", x: 44, small: true }, { type: "cone", x: 66 }, { type: "cone", x: 88, small: true }] },
    B14: { frames: [SPR1, X(SPR2, { dx: 16 }), X(CUT, { dx: 30 }), X(SPR1, { dx: 46 }), X(SPR2, { dx: 62, hold: 200 })], reset: true, move: 240, hold: 0, props: [{ type: "cone", x: 40, small: true }, { type: "cone", x: 76 }, { type: "cone", x: 4 }] },
    B15: { frames: seq([BP1, BP2, BP1, BP2, BP1], [0, -10, -20, -30, -40]).map(function (f, i, a) { return i === a.length - 1 ? X(f, { hold: 400 }) : f; }), reset: true, move: 230, hold: 0 },
    C1: { figs: [{ frames: [HP, HPp, HP, HP], x: 52 }, { frames: [HP, HP, HP, HPp], x: 188, mirror: true, color: "alt" }], move: 600, hold: 250, props: [{ type: "ball", xs: [90, 150, 150, 90] }] },
    C2: { frames: [SU0, SU1], move: 800, hold: 300, props: [{ type: "ball", at: "w1", dy: -5 }] },
    C3: { frames: [GU0, GU1, X(SPR1, { dx: 28 }), X(SPR2, { dx: 54, hold: 300 })], reset: true, move: 380, hold: 0, props: [{ type: "cone", x: 112 }] },
    C4: { figs: [{ frames: [SHD, SHD2], x: 148 }, { frames: [ATK, ATK2], x: 74, color: "alt" }], move: 700, hold: 200, props: [{ type: "ball", x: 176 }] },
    C5: { frames: seq([DR1, DR2, DR1, DR2, DR1, DR2], [0, 13, 26, 39, 52, 65]), reset: true, move: 280, hold: 0, props: [{ type: "cone", x: 28, small: true }, { type: "cone", x: 58, small: true }, { type: "cone", x: 88, small: true }, { type: "ball", xs: [22, 35, 48, 61, 74, 87] }] },
    C6: { frames: [X(JG1, { dx: -40, lift: 0 }), X(JG2, { dx: -20, lift: 0 }), KB, KS], reset: true, move: 300, hold: 0, props: [{ type: "ball", xs: [16, 16, 16, 96], ys: [0, 0, 0, 34] }] },
    C7: { frames: [TT1, TT2], move: 200, hold: 60, props: [{ type: "ball", x: 18 }] },
    C8: { frames: [JU0, JU1], move: 420, hold: 0, props: [{ type: "ball", xs: [33, 33], ys: [12, 46] }] },
    // ---- FIFA 11+ Kids (index = level - 1)
    K1: [
      { frames: seq([JG1, JG2, JG1, JG2, X(SLF, { hold: 1200 })], [0, 14, 28, 42, 50]), reset: true, move: 240, hold: 0 },
      { figs: [{ frames: seq([JG1, JG2, JG1, JG2, X(SLF, { hold: 1200 })], [0, 14, 28, 42, 50]), x: 40 }, { frames: [PAR, PAR, PAR, PAR, PARu], x: 212, mirror: true, color: "alt" }], reset: true, move: 240, hold: 0 },
      { frames: seq([JGb1, JGb2, JGb1, JGb2, X(SLb, { hold: 1200 })], [0, 14, 28, 42, 50]), reset: true, move: 240, hold: 0, props: [{ type: "ball", at: "w1", dx: 3, dy: -2 }] },
      { figs: [{ frames: seq([JGb1, JGb2, JGb1, JGb2, X(SLb, { hold: 1200 })], [0, 14, 28, 42, 50]), x: 40 }, { frames: [PAR, PAR, PAR, PAR, PARu], x: 212, mirror: true, color: "alt" }], reset: true, move: 240, hold: 0, props: [{ type: "ball", at: "w1", dx: 3, dy: -2 }] },
      { frames: seq([DR1, DR2, DR1, DR2, X(SLfoot, { hold: 1200 })], [0, 12, 24, 36, 40]), reset: true, move: 280, hold: 0, props: [{ type: "ball", path: ["f1", "f2", "f1", "f2", "f2"], dx: 7, ground: true }] }
    ],
    K2: [
      { frames: [SKa1, SK2, SKa3, SK2], move: 360, hold: 0 },
      { frames: [X(SKb1, { hold: 900 }), SKb2, X(SKb3, { hold: 900 }), SKb2], move: 360, hold: 0, props: [{ type: "ball", at: "w1", dx: 3, dy: -2 }] },
      { frames: [X(SKo1, { hold: 900 }), SKo2, X(SKo3, { hold: 900 }), SKo2], move: 360, hold: 0, props: [{ type: "ball", at: "w1", dx: 1, dy: -6 }] },
      { frames: [X(SKb1, { hold: 300 }), BEND1, X(SKb1, { hold: 200 }), SKb2, X(SKb3, { hold: 300 }), BEND3, X(SKb3, { hold: 200 }), SKb2], move: 380, hold: 0, props: [{ type: "ball", at: "w1", dx: 3, dy: -2 }] },
      { frames: [X(SKb1, { hold: 200 }), AIR1, X(SKb1, { hold: 100 }), SKb2, X(SKb3, { hold: 200 }), AIR3, X(SKb3, { hold: 100 }), SKb2], move: 420, hold: 0, props: [{ type: "ball", at: "w1", dx: 5, dy: -1 }] }
    ],
    K3: [
      { figs: [{ frames: [SLc, SLth, SLc, SLc], x: 66 }, { frames: [SLc, SLc, SLc, SLth], x: 176, mirror: true, color: "alt" }], move: 520, hold: 250, props: [{ type: "ball", xs: [95, 147, 147, 95], ys: [74, 74, 74, 74] }] },
      { frames: [SLc, X(SLleg, { hold: 500 }), SLc], move: 700, hold: 300, props: [{ type: "ball", at: "w1", dx: 3, dy: -2 }] },
      { figs: [{ frames: [SLp0, SLp1, SLp0, SLp0], x: 70 }, { frames: [SLp0, SLp0, SLp0, SLp1], x: 172, mirror: true, color: "alt" }], move: 420, hold: 300, props: [{ type: "ball", xs: [88, 152, 152, 88], ys: [0, 0, 0, 0] }] },
      { figs: [{ frames: [SLc, SLth, SLc, SLc], x: 66 }, { frames: [SLp0, SLp0, SLp1, SLp0], x: 176, mirror: true, color: "alt" }], move: 460, hold: 250, props: [{ type: "ball", xs: [95, 152, 152, 95], ys: [74, 22, 22, 74] }] },
      { figs: [{ frames: [SLc, SLpush, SLc], x: 88 }, { frames: [SLc, X(SLc, { t: 186 }), SLc], x: 150, mirror: true, color: "alt" }], move: 500, hold: 350, props: [{ type: "ball", at: "w1", dx: 3, dy: -2 }] }
    ],
    K4: [
      { frames: [HP, HP, HP], reset: true, move: 900, hold: 0, props: [{ type: "ball", xs: [70, 0, -70], ground: true }] },
      { frames: [PLB, PLB2], move: 1200, hold: 300, props: [{ type: "ball", at: "a1", dx: -2, ground: true }] },
      { frames: [HP, HPt1, HP, HPt2], anchor: "a1", move: 520, hold: 200, props: [{ type: "ball", path: ["w1", "w1", "w1", "w1"], dx: 9, ground: true }] },
      { frames: [HP, HP, HP, HP], anchor: "a1", move: 800, hold: 150, props: [{ type: "ball", path: ["w1", "hip", "a1", "hip"], ground: true }] },
      { frames: [HPB, HPB2], anchor: "w1", move: 900, hold: 400, props: [{ type: "ball", at: "w1", ground: true }] }
    ],
    K5: [
      { frames: [HS0, HS1, HS2], reset: true, move: 420, hold: 250, props: [{ type: "line", x: 52 }] },
      { frames: [HS0, HS1, X(HS2, { hold: 700 }), X(HS1, { dx: 20 }), X(HS0, { dx: 0, hold: 700 })], move: 420, hold: 250, props: [{ type: "line", x: 20 }] },
      { frames: [X(HS0, { hold: 600 }), X(HS1, { dx: 3 }), X(HS2, { dx: 0, hold: 900 })], reset: true, move: 420, hold: 250 },
      { figs: [{ frames: [HS0, HS1, X(HS2, { hold: 700 }), X(HS1, { dx: 20 }), X(HS0, { dx: 0, hold: 700 })], x: 40 }, { frames: [PARf, PARf, PARb, PARb, PARf], x: 210, mirror: true, color: "alt" }], move: 420, hold: 250 },
      { figs: [{ frames: [HSb0, HSb1, X(HSb2, { hold: 700 }), X(HSb1, { dx: 20 }), X(HSb0, { dx: 0, hold: 700 })], x: 40 }, { frames: [PARf, PARf, PARb, PARb, PARf], x: 210, mirror: true, color: "alt" }], move: 420, hold: 250, props: [{ type: "ball", at: "w1", dx: 3, dy: -2 }] }
    ],
    K6: [
      { frames: [SPD, SPDf, X(SPDf, { L1: [-46, -64, 0] }), SPDf, SPD], anchor: "w1", move: 650, hold: 150, props: [{ type: "ball", at: "a1", dx: -5, ground: true }] },
      { frames: [SPD, X(SPDx, { hold: 900 })], anchor: "w1", move: 1300, hold: 300 },
      { frames: seq([SPD, SPDs1, SPD, SPDs2, SPD], [0, -8, -16, -24, -32]), reset: true, move: 420, hold: 0 },
      { frames: seq([SPD, SPDs1, SPD, SPDs2, SPD], [0, -8, -16, -24, -32]), reset: true, move: 420, hold: 0, props: [{ type: "ball", path: ["w1", "w1", "w1", "w1", "w1"], dx: 10, ground: true }] },
      { frames: seq([SPD5, X(SPD5, { A1: [14, 14] }), SPD5, X(SPD5, { A2: [14, 14] })], [0, 6, 12, 18]), reset: true, move: 600, hold: 0, props: [{ type: "ball", at: "a1", dx: -2, ground: true }] }
    ],
    K7: [
      { frames: [X(CR7, { hold: 700 }), X(TUCK, { hold: 300 }), CR7], anchor: "a1", move: 650, hold: 0 },
      { frames: [X(STAND, { hold: 500 }), X(CR7, { mv: 1100 }), X(TUCK, { hold: 300 }), CR7], anchor: "a1", reset: true, move: 650, hold: 0 },
      { frames: [X(STAND, { hold: 400 }), CR7, X(TUCK, { hold: 200 }), CR7], anchor: "a1", reset: true, move: 380, hold: 0 },
      { frames: seq([WK1, WK2, WK1, CR7, X(TUCK, { hold: 300 }), CR7], [-40, -28, -16, 0, 0, 0]), anchor: "a1", reset: true, move: 420, hold: 0 },
      { frames: seq([JG1, JG2, JG1, CR7, TUCK, CR7], [-50, -32, -14, 0, 0, 0]), anchor: "a1", reset: true, move: 300, hold: 0 }
    ],
    // ---- light-kit strength
    E1: { frames: [GS0, GS1], anchor: "a1", move: 950, hold: 300, props: [{ type: "db", at: "w1", vert: true, dx: 2, dy: -2 }] },
    E2: { frames: [SSd0, SSd1], anchor: "a1", move: 950, hold: 350, props: [{ type: "db", at: "w1", dy: 1 }] },
    E3: { frames: [BR0, BR1], anchor: "a1", move: 700, hold: 250, props: [{ type: "band", at: "w1", ax: 96, ah: 82 }] },
    E7: [{ frames: [GB0, X(GB1, { hold: 900 })], anchor: "a1", move: 800, hold: 300, props: [{ type: "loop", at: "k1", dx: -2 }] }],
    E8: { frames: [HP, X(HPr, { hold: 300 }), HP], anchor: "a1", move: 650, hold: 250, props: [{ type: "db", path: ["w1", "w1", "w1"], dx: 12, ground: true }] },
    E9: { frames: seq([FC1, FC2, FC1, FC2, FC1, FC2], [0, 11, 22, 33, 44, 55]), reset: true, move: 360, hold: 0, props: [{ type: "db", at: "w1", dy: 1 }] },
    Y1: { frames: [YR0, X(YR1, { hold: 900 })], move: 800, hold: 300 },
    D1: { frames: [CS], props: [{ type: "wall", at: "w1", dx: 2.5 }] },
    D2: { frames: [HFS] },
    D3: { frames: [HMS], props: [{ type: "box", x: 32, w: 22, h: 24 }] },
    D4: { frames: [QS, X(QS, { t: 178, A2: [85, 85] })], move: 1600, hold: 300 }
  };
  function specFor(id, ph) {
    var s = SC[id];
    if (!s) return { frames: [STAND] };
    return Array.isArray(s) ? (s[ph] || s[0]) : s;
  }
  function mount(svg, id, ph) { return new Scene(svg, specFor(id, ph)); }

  global.Figures = { mount: mount, specFor: specFor, W: W, H: H };
})(window);

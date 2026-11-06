/* Football Fitness app: profiles, schedule, workouts, guided sessions, progress. Data stays on this device. */
(function () {
  "use strict";
  var D = window.DATA, EX = D.EX, SESS = D.SESS, Figures = window.Figures;
  var KEY = "footyfit.v1";
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var DAYS_L = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var COLORS = ["#16774a", "#d9570f", "#2f6fd6", "#8a3fd1", "#c22f4a", "#0f8a8a"];
  var PHN = ["Foundation", "Build", "Power"], PHW = ["Weeks 1–4", "Weeks 5–8", "Weeks 9–12"];
  var TYPE_NAME = { A: "A · Core & Strength", lite: "A-lite · Core circuit", B: "B · Speed & Agility", C: "C · Brothers' Challenge", club: "Club training", match: "Match day", rest: "Rest day" };
  var TYPE_SHORT = { A: "A", lite: "A-lite", B: "B", C: "C", club: "Club", match: "Match", rest: "Rest" };
  var HOME = { A: 1, lite: 1, B: 1, C: 1 };
  var VIEWS = ["today", "week", "workouts", "library", "progress", "more"];
  var KIT = D.KIT, APP_URL = "https://mial8727.github.io/footyfit/";

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parse(s) { var a = String(s || "").split("-"); var d = new Date(+a[0], (+a[1] || 1) - 1, +a[2] || 1); return isNaN(d) ? today() : d; }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
  function fmtDate(d) { return DAYS[d.getDay()] + " " + d.getDate() + " " + MON[d.getMonth()]; }
  function pick(v, ph) { return Array.isArray(v) ? v[ph] : v; }
  function uid() { return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  var inFrame = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();

  /* ---------------- storage ---------------- */
  var store = { v: 1, profiles: [], active: null };
  var storageOK = true;
  function load() {
    try {
      var s = localStorage.getItem(KEY);
      if (s) { var o = JSON.parse(s); if (o && Array.isArray(o.profiles)) { store = o; store.profiles = store.profiles.map(normProfile); } }
    } catch (e) { storageOK = false; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); storageOK = true; }
    catch (e) { storageOK = false; toast("Couldn't save on this device"); }
  }
  function normProfile(o) {
    o = o || {};
    var age = Math.max(5, Math.min(18, parseInt(o.age, 10) || 10));
    var days = Array.isArray(o.days) && o.days.length === 7 ? o.days.map(function (t) { return TYPE_NAME[t] ? t : "rest"; }) : D.PRESETS[0].days.slice();
    return {
      id: o.id || uid(), name: String(o.name || "Player").slice(0, 24), age: age,
      track: o.track === "y" || o.track === "o" ? o.track : (age <= 10 ? "y" : "o"),
      start: /^\d{4}-\d{2}-\d{2}$/.test(o.start || "") ? o.start : iso(today()),
      phaseMode: ["auto", "0", "1", "2"].indexOf(String(o.phaseMode)) >= 0 ? String(o.phaseMode) : "auto",
      color: (parseInt(o.color, 10) || 0) % COLORS.length, days: days,
      swaps: o.swaps && typeof o.swaps === "object" ? o.swaps : {},
      log: Array.isArray(o.log) ? o.log.filter(function (l) { return l && l.d && l.t; }) : [],
      tests: o.tests && typeof o.tests === "object" ? o.tests : {},
      equip: o.equip === "kit" ? "kit" : "bw",
      warm: o.warm === "quick" ? "quick" : "k11",
      lv: normLv(o.lv),
      vars: o.vars && typeof o.vars === "object" ? o.vars : {},
      wk: o.wk && /^\d{4}-\d{2}-\d{2}$/.test(o.wk.start || "") && Array.isArray(o.wk.days) && o.wk.days.length === 7 ? { start: o.wk.start, days: o.wk.days.map(function (t) { return TYPE_NAME[t] ? t : "rest"; }) } : null
    };
  }
  function normLv(o) { var r = {}; ["K1", "K2", "K3", "K4", "K5", "K6", "K7"].forEach(function (k) { var v = o && parseInt(o[k], 10); r[k] = v >= 1 && v <= 5 ? v : 1; }); return r; }
  function prof() {
    var p = null;
    for (var i = 0; i < store.profiles.length; i++) if (store.profiles[i].id === store.active) p = store.profiles[i];
    return p || store.profiles[0] || null;
  }

  /* ---------------- programme logic ---------------- */
  function weekOf(p, d) { var n = daysBetween(parse(p.start), d || today()); return n < 0 ? 0 : Math.floor(n / 7) + 1; }
  function phaseOf(p, d) {
    if (p.phaseMode !== "auto") return +p.phaseMode;
    var w = Math.max(1, weekOf(p, d));
    return w <= 4 ? 0 : w <= 8 ? 1 : 2;
  }
  function lvOf(p, id) { return p && p.lv && p.lv[id] ? p.lv[id] : 1; }
  function dose(id, p, ph) { var e = EX[id]; if (e.kd) return e.kd[lvOf(p, id) - 1]; if (e.both) return pick(e.both, ph); return (p.track === "y" ? e.d10 : e.d12)[ph]; }
  function howOf(id, p, ph) { var e = EX[id]; return e.lv ? e.lv[lvOf(p, id) - 1] : pick(e.v, ph); }
  function howLabel(id, p) { var e = EX[id]; return e.lv ? "This level" : e.cat === "warm" || e.cat === "cool" ? "How" : "This phase"; }
  function variantOf(p, base) { var k = KIT[base]; if (!k) return base; var v = p.vars[base]; return (v ? v === "kit" : p.equip === "kit") ? k : base; }
  function warmType(p) { return p && p.warm === "quick" ? "warm" : "warm11"; }
  function totalMins(p, type, ph) { return sessionMins(type, ph) + (p.warm === "quick" ? 0 : 7); }
  function planLabel(p) { return p.track === "y" ? "Younger plan" : "Older plan"; }
  function slotKey(type, bi, si) { return (type === "lite" ? "A" : type) + "-" + bi + "-" + si; }
  function slotIndex(p, type, bi, si, n, week) {
    var sw = p.swaps[slotKey(type, bi, si)];
    if (sw && sw.w === week) return sw.i % n;
    return (Math.max(1, week) - 1) % n;
  }
  function sessionPlan(p, type, d) {
    var s = SESS[type], week = Math.max(1, weekOf(p, d));
    return s.blocks.map(function (b, bi) {
      var items = b.slots.map(function (opts, si) {
        var k = slotIndex(p, type, bi, si, opts.length, week);
        return { id: variantOf(p, opts[k]), base: opts[k], opts: opts, k: k, si: si, bi: bi, key: slotKey(type, bi, si) };
      });
      if (b.stations) {
        var start = ((week - 1) * 4) % items.length;
        items.forEach(function (it, i) { it.station = ((i - start + items.length) % items.length) < 4; });
      }
      return Object.assign({}, b, { items: items, bi: bi });
    });
  }
  function setsOf(t) { var m = /^(\d+)\s*×/.exec(t || ""); return m ? +m[1] : 0; }
  function perSet(t) { return String(t).replace(/^\d+\s*×\s*/, ""); }
  function secsOf(t) { var m = /(\d+)\s*s\b/.exec(t || ""); return m ? +m[1] : 0; }
  function sessionMins(type, ph) { return SESS[type] && SESS[type].mins ? SESS[type].mins[ph] : 0; }
  function warnings(days) {
    var out = [], hard = function (t) { return t === "A" || t === "B" || t === "C"; };
    for (var i = 0; i < 7; i++) {
      var n = (i + 1) % 7;
      if (days[i] === "B" && days[n] === "match") out.push("No Session B the day before a match (" + DAYS[i] + " → " + DAYS[n] + ").");
      if (hard(days[i]) && hard(days[n])) out.push("Two hard home sessions in a row: " + DAYS[i] + " and " + DAYS[n] + ". Put a rest or club day between them.");
      if (HOME[days[i]] && days[i] !== "lite" && (days[n] === "match" || days[i] === "match")) { /* handled above for B */ }
    }
    var count = function (t) { return days.filter(function (x) { return x === t; }).length; };
    var home = count("A") + count("B") + count("C") + count("lite") * 0.5;
    if (count("B") > 2) out.push("Two B sessions a week is the most this age needs.");
    if (home > 4) out.push("That's a lot of home training. Three sessions a week is plenty on top of club football.");
    if (count("rest") === 0) out.push("Keep at least one full rest day each week.");
    if (count("club") + count("match") >= 3 && count("A") + count("B") + count("C") >= 3) out.push("With 3+ club days, two home sessions (A and A-lite) are enough.");
    return out;
  }
  function logsOn(p, isoDay) { return p.log.filter(function (l) { return l.d === isoDay; }); }

  /* ---------------- this week only: train on a rest day, move a session; usual days return on Sunday ---------------- */
  var HARD = { A: 1, B: 1, C: 1 };
  function sunOf(d) { return addDays(d, -d.getDay()); }
  function thisWeek() { return iso(sunOf(today())); }
  function moved(p) { return !!(p.wk && p.wk.start === thisWeek()); }
  function weekDays(p) { return moved(p) ? p.wk.days.slice() : p.days.slice(); }
  function dayType(p, d) { return iso(sunOf(d)) === thisWeek() ? weekDays(p)[d.getDay()] : p.days[d.getDay()]; }
  function doneOn(p, i) { return logsOn(p, iso(addDays(sunOf(today()), i))).length > 0; }
  function clash(days, i) {
    var t = days[i]; if (!HOME[t]) return false;
    if (HARD[t] && ((i > 0 && HARD[days[i - 1]]) || (i < 6 && HARD[days[i + 1]]))) return true;
    return t === "B" && i < 6 && days[i + 1] === "match";
  }
  function respace(p, days, d) {
    for (var pass = 0; pass < 3; pass++) {
      var changed = false;
      for (var j = d + 1; j < 7; j++) {
        if (!HOME[days[j]] || doneOn(p, j) || !clash(days, j)) continue;
        var t = days[j], best = -1;
        for (var k = d + 1; k < 7; k++) {
          if (k === j || days[k] !== "rest") continue;
          var tr = days.slice(); tr[j] = "rest"; tr[k] = t;
          if (clash(tr, k)) continue;
          if (best < 0 || Math.abs(k - j) < Math.abs(best - j) || (Math.abs(k - j) === Math.abs(best - j) && k > best)) best = k;
        }
        if (best >= 0) { days[best] = t; days[j] = "rest"; changed = true; }
      }
      if (!changed) break;
    }
    return days;
  }
  function pickFor(p, d) {
    var days = weekDays(p), td = today().getDay(), c = [];
    for (var i = 0; i < 7; i++) if (i !== d && HOME[days[i]] && !doneOn(p, i)) c.push(i);
    var order = c.filter(function (i) { return i >= td && i < d; }).reverse()
      .concat(c.filter(function (i) { return i > d; }), c.filter(function (i) { return i < td; }).reverse());
    for (var k = 0; k < order.length; k++) { var tr = days.slice(); tr[d] = days[order[k]]; tr[order[k]] = "rest"; if (!clash(tr, d)) return order[k]; }
    return order.length ? order[0] : -1;
  }
  function planTrain(p, d, src) {
    var days = weekDays(p), t = days[src]; days[src] = "rest"; days[d] = t;
    return { days: respace(p, days, d), t: t };
  }
  function planMove(p, d) {
    // nearest later rest day where the week still follows the rules once later sessions shift; else the one with fewest clashes
    var base = weekDays(p), t = base[d], best = null;
    for (var k = d + 1; k < 7; k++) {
      if (base[k] !== "rest") continue;
      var tr = base.slice(); tr[d] = "rest"; tr[k] = t; tr = respace(p, tr, k);
      var bad = 0; for (var j = k; j < 7; j++) if (clash(tr, j) && !doneOn(p, j)) bad++;
      if (!best || bad < best.bad) best = { days: tr, t: t, to: k, bad: bad };
      if (!bad) break;
    }
    return best;
  }
  function weekLine(days, from) {
    var out = []; for (var i = from; i < 7; i++) if (HOME[days[i]]) out.push(DAYS[i] + " " + TYPE_SHORT[days[i]]);
    return out.length ? out.join(" · ") : "no more home sessions";
  }
  function applyWeek(p, days) { p.wk = { start: thisWeek(), days: days }; save(); }
  function cycleStats(p) {
    var start = parse(p.start), t = today(), planned = 0, done = 0;
    var end = addDays(start, 12 * 7 - 1);
    for (var d = new Date(start); d <= t && d <= end; d = addDays(d, 1)) if (HOME[dayType(p, d)]) planned++;
    p.log.forEach(function (l) { var ld = parse(l.d); if (ld >= start && ld <= end) done++; });
    return { planned: planned, done: done };
  }

  /* ---------------- sound + timers ---------------- */
  var ac = null;
  function audio() { try { if (!ac) { var C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); } if (ac && ac.state === "suspended") ac.resume(); } catch (e) { ac = null; } }
  function beep(f, d) { if (!ac) return; try { var o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; o.connect(g); g.connect(ac.destination); g.gain.setValueAtTime(.2, ac.currentTime); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + d); o.start(); o.stop(ac.currentTime + d); } catch (e) {} }
  function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function fmtT(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ":" + pad(s % 60); }
  function Timer(onTick, onEnd) { this.onTick = onTick; this.onEnd = onEnd; this.iv = null; }
  Timer.prototype.start = function (sec) {
    var self = this; audio(); this.stop(); this.end = performance.now() + sec * 1000; this.last = -1; beep(660, .1);
    this.onTick(sec);
    this.iv = setInterval(function () {
      var left = (self.end - performance.now()) / 1000; self.onTick(left);
      var w = Math.ceil(left);
      if (w <= 3 && w > 0 && w !== self.last) { self.last = w; beep(880, .08); }
      if (left <= 0) { self.stop(); beep(1175, .45); vibrate([120, 60, 120]); self.onEnd(); }
    }, 100);
  };
  Timer.prototype.stop = function () { clearInterval(this.iv); this.iv = null; };
  Timer.prototype.running = function () { return !!this.iv; };

  var pill = $("#tpill"), pillTxt = $("#tpillTxt");
  var pillTimer = new Timer(function (s) { pillTxt.textContent = fmtT(s); }, function () { pillTxt.textContent = "Done"; setTimeout(function () { pill.hidden = true; }, 1500); });
  function startPill(sec) { pill.hidden = false; pillTimer.start(sec); }

  /* ---------------- toast + sheet ---------------- */
  var toastT = null;
  function toast(msg) { var t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("on"); }, 2200); }
  var sheetBack = $("#sheetBack"), sheetBox = $("#sheet"), lastFocus = null;
  function openSheet(html, cls) {
    lastFocus = document.activeElement;
    sheetBox.className = "sheet" + (cls ? " " + cls : "");
    sheetBox.innerHTML = '<button class="sheet-x" data-act="sheet-close" aria-label="Close">×</button>' + html;
    sheetBack.hidden = false; document.body.classList.add("locked");
    mountFigs(sheetBox);
    var f = sheetBox.querySelector("input,select,textarea,button:not(.sheet-x)"); if (f && f.tagName !== "BUTTON") f.focus(); else sheetBox.focus();
  }
  function closeSheet() { sheetBack.hidden = true; sheetBox.innerHTML = ""; if (!sess) document.body.classList.remove("locked"); if (lastFocus && lastFocus.focus) lastFocus.focus(); }

  /* ---------------- figures ---------------- */
  function figSvg(id, ph, cls) { if (EX[id].lv) ph = lvOf(sess ? store.profiles.filter(function (x) { return x.id === sess.pid; })[0] : prof(), id) - 1; return '<svg class="' + (cls || "") + '" data-fig="' + id + '" data-ph="' + ph + '" role="img" aria-label="Animated demo: ' + esc(EX[id].name) + '" viewBox="0 0 240 150"></svg>'; }
  function mountFigs(root) { $$("svg[data-fig]", root).forEach(function (s) { if (!s._scene) Figures.mount(s, s.getAttribute("data-fig"), +s.getAttribute("data-ph")); }); }

  /* ---------------- shared pieces ---------------- */
  var YT = function (q) { return "https://www.youtube.com/results?search_query=" + encodeURIComponent(q); };
  var PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true" class="yt"><rect x="1" y="4" width="22" height="16" rx="5" fill="#e0281b"/><path d="M10 8.5v7l6-3.5z" fill="#fff"/></svg>';
  function doseChip(label, txt, cls) {
    var s = secsOf(txt);
    if (s) return '<button type="button" class="dose ' + (cls || "") + '" data-act="timer" data-s="' + s + '" aria-label="' + esc(label + ": " + txt + ". Start a " + s + " second timer") + '"><small>' + esc(label) + '</small><span>' + esc(txt) + ' <i class="go">▶</i></span></button>';
    return '<div class="dose ' + (cls || "") + '"><small>' + esc(label) + '</small><span>' + esc(txt) + '</span></div>';
  }
  function avatar(p, big) { return '<span class="av' + (big ? " big" : "") + '" style="background:' + COLORS[p.color] + '">' + esc((p.name || "?").charAt(0).toUpperCase()) + '</span>'; }
  function levelCtl(id, p) {
    var L = lvOf(p, id);
    return '<div class="lvl"><span class="lvn">Level <b>' + L + '</b> of 5</span><button type="button" class="chip-btn" data-act="lv" data-id="' + id + '" data-d="-1"' + (L <= 1 ? " disabled" : "") + ' aria-label="Level down">▼</button><button type="button" class="chip-btn" data-act="lv" data-id="' + id + '" data-d="1"' + (L >= 5 ? " disabled" : "") + '>Next level ▲</button></div>';
  }
  function kitCtl(item, p) {
    if (!KIT[item.base]) return "";
    var onKit = item.id !== item.base;
    return '<div class="vsw" role="group" aria-label="Version"><button type="button" aria-pressed="' + !onKit + '" data-act="var" data-base="' + item.base + '" data-v="bw">Bodyweight: ' + esc(EX[item.base].name) + '</button><button type="button" aria-pressed="' + onKit + '" data-act="var" data-base="' + item.base + '" data-v="kit">Light kit: ' + esc(EX[KIT[item.base]].name) + '</button></div>';
  }
  function exCard(item, p, ph, num) {
    var e = EX[item.id];
    var extra = p.track === "o" && e.extra12 && e.extra12[ph] ? '<p class="extra">' + esc(e.extra12[ph]) + '</p>' : "";
    var swap = item.opts && item.opts.length > 1 ? '<button type="button" class="chip-btn" data-act="swap" data-key="' + item.key + '" data-k="' + item.k + '" data-n="' + item.opts.length + '">⇄ Swap (' + (item.k + 1) + '/' + item.opts.length + ')</button>' : "";
    return '<article class="ex">' +
      '<div class="fig">' + figSvg(item.id, ph) + '</div>' +
      '<div class="ex-b">' +
      '<div class="ex-top">' + (num ? '<span class="code">' + num + '</span>' : "") + '<h4>' + esc(e.name) + '</h4></div>' +
      '<p class="tag">' + esc(e.tag) + '</p>' +
      (e.lv ? levelCtl(item.id, p) : kitCtl(item, p)) +
      '<p class="now"><b>' + howLabel(item.id, p) + ':</b> ' + esc(howOf(item.id, p, ph)) + '</p>' +
      '<div class="doses">' + doseChip(p.name, dose(item.id, p, ph), e.lv ? "both" : p.track === "y" ? "y10" : "y12") + '</div>' +
      '<ul class="cues">' + e.cues.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + '</ul>' +
      (e.watch ? '<p class="watch"><b>Watch for:</b> ' + esc(e.watch) + '</p>' : "") + extra +
      (e.kit ? '<p class="extra">Light kit: start with 1–2 kg or a water bottle. Add a little only when every set reaches 15 clean reps.</p>' : "") +
      '<div class="ex-act"><a class="vid" href="' + YT(e.lv ? e.yt + " level " + lvOf(p, item.id) : e.yt) + '" target="_blank" rel="noopener">' + PLAY + 'Demo videos</a>' + swap +
      '<button type="button" class="chip-btn" data-act="open-ex" data-id="' + item.id + '">All levels</button></div>' +
      '</div></article>';
  }

  /* ---------------- views ---------------- */
  var ui = { view: "today", wtab: null, cat: "all", libPh: null, note: "" };
  var deferredInstall = null;

  function renderAppbar() {
    var p = prof(), b = $("#profBtn");
    if (!p) { b.innerHTML = '<span class="pn">Football Fitness</span>'; return; }
    var w = weekOf(p), ph = phaseOf(p);
    b.innerHTML = avatar(p) + '<span class="pt"><span class="pn">' + esc(p.name) + '</span><span class="pm">' + (w === 0 ? "Starts " + fmtDate(parse(p.start)) : w > 12 ? "Cycle complete" : "Week " + w + " · " + PHN[ph]) + '</span></span><span class="caret" aria-hidden="true">▾</span>';
    b.setAttribute("aria-label", "Profile: " + p.name + ". Switch profile");
  }

  function renderToday() {
    var el = $("#v-today"), p = prof();
    if (!p) {
      el.innerHTML = '<div class="welcome"><img src="icons/icon-192.png" alt="" width="72" height="72"><h2>Football Fitness</h2>' +
        '<p>Core strength, speed and agility for young footballers. Make a profile for each player: each one gets his own training days, doses for his age, and a progress log.</p>' +
        '<button type="button" class="btn primary" data-act="prof-add">Create the first profile</button>' +
        '<a class="link" href="#more">How to install the app</a></div>';
      return;
    }
    var t = today(), dow = t.getDay(), wd = weekDays(p), type = wd[dow], w = weekOf(p), ph = phaseOf(p);
    var doneToday = logsOn(p, iso(t));
    var head = '<p class="eyebrow">' + DAYS_L[dow] + " " + t.getDate() + " " + MON[t.getMonth()] + (w ? " · Week " + Math.min(w, 12) + " of 12 · " + PHN[ph] : " · Starts " + fmtDate(parse(p.start))) + '</p>';
    var card;
    if (HOME[type]) {
      var plan = sessionPlan(p, type === "lite" ? "lite" : type);
      var names = [];
      plan.forEach(function (b) { b.items.forEach(function (it) { if (!b.stations || it.station) names.push(EX[it.id].name); }); });
      card = '<div class="today-card t-' + type + '"><span class="badge">' + TYPE_SHORT[type] + '</span><h2>' + TYPE_NAME[type] + '</h2>' +
        '<p class="mins">About ' + totalMins(p, type, ph) + ' min with the ' + (p.warm === "quick" ? "warm-up" : "FIFA 11+ Kids warm-up") + ' and cool-down · ' + PHW[ph] + '</p>' +
        '<ul class="names">' + names.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + '</ul>' +
        (doneToday.length ? '<p class="donep">Done today ✓ ' + feelIcon(doneToday[0].feel) + '</p>' : "") +
        '<div class="row"><button type="button" class="btn primary big" data-act="start" data-type="' + type + '">' + (doneToday.length ? "Train again" : "Start session") + '</button>' +
        '<a class="btn ghost" href="#workouts" data-act="wtab-go" data-t="' + (type === "lite" ? "A" : type) + '">See exercises</a></div></div>';
    } else {
      var msg = type === "club" ? "Club training today. Nothing extra is needed at home. Bring water and eat a snack 1–2 hours before."
        : type === "match" ? "Match day. Light warm-up only, plenty of water, and a proper meal 2–3 hours before kick-off. Enjoy it."
          : "Rest day. Free play is fine; no hard training. Aim for 9–12 hours of sleep.";
      card = '<div class="today-card t-' + type + '"><span class="badge">' + TYPE_SHORT[type] + '</span><h2>' + TYPE_NAME[type] + '</h2><p>' + msg + '</p>' + nextSessionLine(p) + '</div>';
    }
    var shift = "";
    if (type === "rest") shift = trainCard(p, dow, true);
    else if (HOME[type] && !doneToday.length) shift = moveCard(p, dow, true);
    // week strip
    var sun = addDays(t, -dow), strip = "";
    for (var i = 0; i < 7; i++) {
      var d = addDays(sun, i), ty = wd[i], logs = logsOn(p, iso(d)), past = d < t;
      var st = logs.length ? "done" : (HOME[ty] && past ? "missed" : "");
      strip += '<div class="wd ' + st + (i === dow ? " now" : "") + ' t-' + ty + '"><span class="d">' + DAYS[i] + '</span><span class="s">' + TYPE_SHORT[ty] + '</span><span class="m">' + (logs.length ? "✓" : st === "missed" ? "–" : "") + '</span></div>';
    }
    var cs = cycleStats(p);
    var pct = cs.planned ? Math.min(100, Math.round(cs.done / cs.planned * 100)) : 0;
    var other = ["A", "lite", "B", "C"].filter(function (x) { return x !== type; }).map(function (x) {
      return '<button type="button" class="chip-btn" data-act="start" data-type="' + x + '">' + TYPE_SHORT[x] + '</button>';
    }).join("");
    var cycle = w > 12 ? '<div class="box alert"><h3>12 weeks done</h3><p>Great work. Do the tests in Progress, take an easy week, then start a new cycle. The plan will begin again at Weeks 1–4 unless you choose a phase in Week.</p><button type="button" class="btn primary" data-act="new-cycle">Start a new 12 weeks today</button></div>' : "";
    var note = ui.note; ui.note = "";
    el.innerHTML = (note ? '<div class="box okbox">' + note + '</div>' : "") + head + card + shift + cycle +
      '<div class="box"><h3>This week' + (moved(p) ? ' <span class="pill o">changed this week</span>' : "") + '</h3><div class="wstrip">' + strip + '</div><a class="link" href="#week">Change training days</a></div>' +
      '<div class="box"><h3>This cycle</h3><div class="bar" role="img" aria-label="' + cs.done + ' of ' + cs.planned + ' planned sessions done"><i style="width:' + pct + '%"></i></div><p class="small">' + cs.done + ' of ' + cs.planned + ' planned home sessions done so far.</p></div>' +
      '<div class="box"><h3>Train something else today</h3><div class="row wrap">' + other + '</div></div>' +
      '<div class="tip"><b>Coach tip</b> ' + esc(D.TIPS[(t.getDate() + store.profiles.indexOf(p)) % D.TIPS.length]) + '</div>';
  }
  function trainCard(p, d, isToday) {
    var src = pickFor(p, d), when = isToday ? "today" : "on " + DAYS_L[d];
    if (src < 0) return '<div class="box"><h3>Want to train ' + when + '?</h3><p class="small">All of this week\'s home sessions are done. ' + (isToday ? "You can still do an extra one below with “Train something else today”." : "") + '</p></div>';
    var r = planTrain(p, d, src), td = today().getDay(), warn = clash(r.days, d);
    var from = src < td ? " (missed on " + DAYS_L[src] + ")" : " (moved from " + DAYS_L[src] + ")";
    return '<div class="box"><h3>Want to train ' + when + '?</h3><p>Do <b>' + TYPE_NAME[r.t] + '</b> ' + when + from + '. The rest of the week shifts to keep a rest day between hard sessions where it can.</p>' +
      '<p class="small">Rest of the week: <b>' + weekLine(r.days, td) + '</b></p>' +
      (warn ? '<p class="small warnline">Heads-up: ' + (r.t === "B" && r.days[d + 1] === "match" ? "match the next day. A-lite or C would be kinder to the legs." : "this sits next to another hard session. Keep it light if he feels tired.") + '</p>' : "") +
      '<div class="row"><button type="button" class="btn primary" data-act="wk-train" data-d="' + d + '" data-src="' + src + '">Move ' + TYPE_SHORT[r.t] + ' to ' + (isToday ? "today" : DAYS[d]) + '</button></div></div>';
  }
  function moveCard(p, d, isToday) {
    var r = planMove(p, d); if (!r) return "";
    return '<div class="box"><h3>Can\'t train ' + (isToday ? "today" : "on " + DAYS_L[d]) + '?</h3><p class="small">Move ' + TYPE_SHORT[r.t] + ' to <b>' + DAYS_L[r.to] + '</b>. Rest of the week: <b>' + weekLine(r.days, today().getDay()) + '</b></p>' +
      (clash(r.days, r.to) ? '<p class="small warnline">Heads-up: on ' + DAYS_L[r.to] + ' it sits next to another hard session' + (r.t === "B" && r.days[r.to + 1] === "match" ? " and the day before a match" : "") + '. Keep it light, or skip it this week.</p>' : "") +
      '<div class="row"><button type="button" class="btn ghost" data-act="wk-move" data-d="' + d + '">Move to ' + DAYS_L[r.to] + '</button></div></div>';
  }
  function nextSessionLine(p) {
    var t = today();
    for (var i = 1; i <= 7; i++) { var d = addDays(t, i), ty = dayType(p, d); if (HOME[ty]) return '<p class="small">Next: <b>' + TYPE_NAME[ty] + '</b> on ' + DAYS_L[d.getDay()] + '.</p>'; }
    return '<p class="small">No home sessions planned. Set training days in Week.</p>';
  }
  function feelIcon(f) { return f === 1 ? "· felt easy" : f === 2 ? "· felt good" : f === 3 ? "· felt hard" : ""; }

  function renderWeek() {
    var el = $("#v-week"), p = prof();
    if (!p) { el.innerHTML = needProfile(); return; }
    var w = weekOf(p), ph = phaseOf(p);
    var rows = p.days.map(function (ty, i) {
      return '<div class="drow t-' + ty + '"><label for="day' + i + '">' + DAYS_L[i] + '</label><select id="day' + i + '" data-day="' + i + '">' +
        D.DAYTYPES.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === ty ? " selected" : "") + '>' + o[1] + '</option>'; }).join("") + '</select></div>';
    }).join("");
    var warn = warnings(p.days);
    var others = store.profiles.filter(function (q) { return q.id !== p.id; });
    var wd = weekDays(p), td = today().getDay();
    var thisWk = wd.map(function (ty, i) {
      var done = doneOn(p, i), act = "";
      if (i >= td && !done) {
        if (ty === "rest" && pickFor(p, i) >= 0) act = '<button type="button" class="chip-btn" data-act="wk-train" data-d="' + i + '" data-src="' + pickFor(p, i) + '">Train here</button>';
        else if (HOME[ty] && planMove(p, i)) act = '<button type="button" class="chip-btn" data-act="wk-move" data-d="' + i + '">Move later</button>';
      }
      return '<div class="drow t-' + ty + (i === td ? " now" : "") + '"><label>' + DAYS_L[i] + '</label><span class="wkt">' + TYPE_NAME[ty] + (done ? " ✓" : "") + (ty !== p.days[i] ? ' <small>(usually ' + TYPE_SHORT[p.days[i]] + ')</small>' : "") + '</span>' + act + '</div>';
    }).join("");
    el.innerHTML = '<div class="lead"><h2>' + esc(p.name) + "'s training week</h2><p>Pick what happens on each day. Changes save straight away. Fit home sessions around club training and matches.</p></div>" +
      '<div class="box"><h3>This week only</h3><p class="small">Train on a rest day or push a session later. The other sessions shift by themselves, and the usual days below come back on Sunday.</p><div class="days wkdays">' + thisWk + '</div>' +
      (moved(p) ? '<div class="row"><button type="button" class="btn ghost" data-act="wk-undo">Undo changes this week</button></div>' : "") + '</div>' +
      '<h3 class="subh">Usual week</h3>' +
      '<div class="box"><h3>Quick start</h3><div class="row wrap">' + D.PRESETS.map(function (pr, i) { return '<button type="button" class="chip-btn" data-act="preset" data-i="' + i + '">' + pr.name + '</button>'; }).join("") + '</div></div>' +
      '<div class="box"><div class="days">' + rows + '</div>' +
      (warn.length ? '<ul class="warn">' + warn.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + '</ul>' : '<p class="ok">✓ This week follows the rules: rest days in place and no hard days back to back.</p>') +
      (others.length ? '<div class="row wrap">' + others.map(function (q) { return '<button type="button" class="chip-btn" data-act="copy-days" data-to="' + q.id + '">Copy to ' + esc(q.name) + '</button>'; }).join("") + '</div>' : "") + '</div>' +
      '<div class="box"><h3>Programme</h3><div class="form">' +
      '<label>Start date<input type="date" id="startDate" value="' + p.start + '"></label>' +
      '<label>Phase<select id="phaseMode">' +
      [["auto", "Automatic from start date"], ["0", "Weeks 1–4 · Foundation"], ["1", "Weeks 5–8 · Build"], ["2", "Weeks 9–12 · Power"]].map(function (o) { return '<option value="' + o[0] + '"' + (p.phaseMode === o[0] ? " selected" : "") + '>' + o[1] + '</option>'; }).join("") +
      '</select></label></div><p class="small">' + (w === 0 ? "Starts " + fmtDate(parse(p.start)) + "." : "Now in week " + w + (w > 12 ? " (cycle complete)" : " of 12") + ", " + PHW[ph] + " · " + PHN[ph] + ".") + ' Move up a phase early only if every rep looks clean for two sessions in a row.</p></div>';
  }
  function needProfile() { return '<div class="welcome"><p>Create a profile first.</p><button type="button" class="btn primary" data-act="prof-add">Create profile</button></div>'; }

  function renderWorkouts() {
    var el = $("#v-workouts"), p = prof();
    if (!p) { el.innerHTML = needProfile(); return; }
    var ph = phaseOf(p);
    if (!ui.wtab) { var ty = weekDays(p)[today().getDay()]; ui.wtab = ty === "lite" ? "A" : (["A", "B", "C"].indexOf(ty) >= 0 ? ty : "A"); }
    var tabs = [["warm", "Warm-up"], ["A", "A · Core"], ["B", "B · Speed"], ["C", "C · Challenge"], ["cool", "Cool-down"]];
    var t = ui.wtab, html = '<div class="seg" role="tablist">' + tabs.map(function (x) { return '<button type="button" role="tab" aria-selected="' + (x[0] === t) + '" data-act="wtab" data-t="' + x[0] + '">' + x[1] + '</button>'; }).join("") + '</div>';
    var s = SESS[t === "warm" ? warmType(p) : t];
    var head = '<div class="lead"><h2>' + (t === "warm" ? "Warm-up" : t === "cool" ? "Cool-down" : TYPE_NAME[t]) + '</h2><p>';
    if (t === "A") head += "Two circuits. Go through every exercise in a circuit, rest 90 s, then repeat for the number of rounds shown. Exercises with ⇄ change each week; tap Swap to choose another this week. With bands or light weights, some exercises get a light-kit version; switch any of them back to bodyweight on its card.";
    else if (t === "B") head += "Do this when fresh, never straight after a hard club session. Work through the blocks in order with full rest; stop a block when they start slowing down.";
    else if (t === "C") head += "The fun day with a ball. Four stations rotate each week; the rest are listed below if you want to change.";
    else if (t === "warm") head += p.warm === "quick" ? "The quick warm-up: about 8 minutes, easy to nearly full speed. FIFA 11+ Kids is the recommended warm-up; switch back below." : "FIFA 11+ Kids: seven exercises in this order, about 15 minutes, before every session. Each exercise has five levels. Start at level 1 and tap Next level only after he has done it well for several sessions in a row. Levels can differ between exercises; never skip one.";
    else head += "After every session. Gentle stretches, never painful.";
    head += '</p><div class="meta"><span class="pill">' + esc(p.name) + ' · ' + planLabel(p) + '</span><span class="pill o">' + PHW[ph] + ' · ' + PHN[ph] + '</span>' + (s.mins ? '<span class="pill">~' + s.mins[ph] + ' min</span>' : "") + '</div>' +
      (["A", "B", "C"].indexOf(t) >= 0 ? '<div class="row"><button type="button" class="btn primary" data-act="start" data-type="' + t + '">Start guided session</button>' + (t === "A" ? '<button type="button" class="btn ghost" data-act="start" data-type="lite">A-lite</button>' : "") + '</div>' : "") +
      (t === "warm" ? '<div class="vsw" role="group" aria-label="Warm-up"><button type="button" aria-pressed="' + (p.warm !== "quick") + '" data-act="warm" data-v="k11">FIFA 11+ Kids · recommended</button><button type="button" aria-pressed="' + (p.warm === "quick") + '" data-act="warm" data-v="quick">Quick 8-minute warm-up</button></div>' : "") +
      (t === "A" ? '<div class="vsw" role="group" aria-label="Equipment"><button type="button" aria-pressed="' + (p.equip !== "kit") + '" data-act="equip" data-v="bw">Bodyweight only</button><button type="button" aria-pressed="' + (p.equip === "kit") + '" data-act="equip" data-v="kit">Bands & light weights</button></div>' : "") + '</div>';
    html += head;
    sessionPlan(p, t === "warm" ? warmType(p) : t).forEach(function (b) {
      var p2 = b.contacts ? "Jump contacts this phase: about " + D.CONTACTS[p.track][ph] + ". That stays inside the 50–120 per session advised for this age." : b.p;
      var items = b.items;
      if (b.stations) {
        var on = items.filter(function (i) { return i.station; }), off = items.filter(function (i) { return !i.station; });
        html += '<div class="block-h"><h3>' + b.h + '</h3>' + (p2 ? "<p>" + esc(p2) + "</p>" : "") + '</div>' + on.map(function (it, i) { return exCard(it, p, ph, i + 1); }).join("");
        html += '<div class="block-h"><h3>Other stations</h3><p>Swap any of these in if you prefer.</p></div>' + off.map(function (it) { return exCard(it, p, ph); }).join("");
      } else {
        html += '<div class="block-h"><h3>' + b.h + '</h3>' + (p2 ? "<p>" + esc(p2) + "</p>" : "") + '</div>' + items.map(function (it, i) { return exCard(it, p, ph, i + 1); }).join("");
      }
    });
    el.innerHTML = html;
    mountFigs(el);
  }

  function renderLibrary() {
    var el = $("#v-library"), p = prof(), ph = p ? phaseOf(p) : 0;
    var ids = Object.keys(EX).filter(function (id) { return ui.cat === "all" || EX[id].cat === ui.cat; });
    var chips = '<div class="chips"><button type="button" class="chip' + (ui.cat === "all" ? " on" : "") + '" data-act="cat" data-cat="all">All ' + Object.keys(EX).length + '</button>' +
      D.CATS.map(function (c) { var n = Object.keys(EX).filter(function (id) { return EX[id].cat === c[0]; }).length; return '<button type="button" class="chip' + (ui.cat === c[0] ? " on" : "") + '" data-act="cat" data-cat="' + c[0] + '">' + c[1] + ' ' + n + '</button>'; }).join("") + '</div>';
    el.innerHTML = '<div class="lead"><h2>Exercise library</h2><p>' + Object.keys(EX).length + ' exercises. Tap one to see every level and the doses for both plans.</p></div>' + chips +
      '<div class="lib">' + ids.map(function (id) {
        var e = EX[id], cat = D.CATS.filter(function (c) { return c[0] === e.cat; })[0];
        return '<button type="button" class="lcard" data-act="open-ex" data-id="' + id + '"><span class="fig">' + figSvg(id, ph) + '</span><span class="lt"><b>' + esc(e.name) + '</b><small>' + esc(cat ? cat[1] : "") + '</small></span></button>';
      }).join("") + '</div>';
    mountFigs(el);
  }
  function openExercise(id) {
    var e = EX[id], p = prof(), ph = p ? phaseOf(p) : 0;
    if (e.lv) {
      var L = lvOf(p, id);
      var lrows = e.lv.map(function (txt, i) { return '<tr' + (i === L - 1 ? ' class="cur"' : "") + '><th>' + (i + 1) + '</th><td>' + esc(txt) + '</td><td>' + esc(e.kd[i]) + '</td><td><a class="vid sm" href="' + YT(e.yt + " level " + (i + 1)) + '" target="_blank" rel="noopener" aria-label="Videos for level ' + (i + 1) + '">' + PLAY + '</a></td></tr>'; }).join("");
      openSheet('<div class="fig sheet-fig">' + figSvg(id, L - 1) + '</div><h2>' + esc(e.name) + '</h2><p class="tag">' + esc(e.tag) + '</p>' + (p ? levelCtl(id, p) : "") +
        '<div class="tbl-wrap"><table><thead><tr><th>Level</th><th>How</th><th>Dose</th><th></th></tr></thead><tbody>' + lrows + '</tbody></table></div>' +
        '<ul class="cues">' + e.cues.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + '</ul>' +
        (e.watch ? '<p class="watch"><b>Watch for:</b> ' + esc(e.watch) + '</p>' : "") +
        '<p class="small">Same doses for both plans. Move up only after he has done the current level well for several sessions in a row; never skip a level.</p>', "ex-sheet");
      return;
    }
    var baseOf = Object.keys(KIT).filter(function (k) { return KIT[k] === id; }).map(function (k) { return EX[k].name; });
    var rows = [0, 1, 2].map(function (i) {
      var dy = e.both ? pick(e.both, i) : e.d10[i], dol = e.both ? pick(e.both, i) : e.d12[i];
      return '<tr' + (i === ph ? ' class="cur"' : "") + '><th>' + PHW[i] + '</th><td>' + esc(pick(e.v, i)) + '</td><td>' + esc(dy) + '</td><td>' + esc(dol) + '</td></tr>';
    }).join("");
    var same = !Array.isArray(e.v) && !Array.isArray(e.both);
    openSheet('<div class="fig sheet-fig">' + figSvg(id, ph) + '</div><h2>' + esc(e.name) + '</h2><p class="tag">' + esc(e.tag) + '</p>' +
      (same ? '<p class="now"><b>How:</b> ' + esc(pick(e.v, 0)) + '</p><div class="doses">' + doseChip("Both plans", pick(e.both, 0), "both") + '</div>' :
        '<div class="tbl-wrap"><table><thead><tr><th>Phase</th><th>Version</th><th>Younger</th><th>Older</th></tr></thead><tbody>' + rows + '</tbody></table></div>') +
      '<ul class="cues">' + e.cues.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + '</ul>' +
      (e.watch ? '<p class="watch"><b>Watch for:</b> ' + esc(e.watch) + '</p>' : "") +
      (e.extra12 && e.extra12[2] ? '<p class="extra">' + esc(e.extra12[2]) + '</p>' : "") +
      (e.kit ? '<p class="extra">Light-kit version of: ' + esc(baseOf.join(", ")) + '. Start with 1–2 kg or a water bottle; add a little only when every set reaches 15 clean reps.</p>' : "") +
      (KIT[id] ? '<p class="extra">With bands or light weights: ' + esc(EX[KIT[id]].name) + '.</p>' : "") +
      '<a class="vid" href="' + YT(e.yt) + '" target="_blank" rel="noopener">' + PLAY + 'Demo videos on YouTube</a>', "ex-sheet");
  }

  function renderProgress() {
    var el = $("#v-progress"), p = prof();
    if (!p) { el.innerHTML = needProfile(); return; }
    var t = today(), sun = addDays(t, -t.getDay()), wkDone = 0, wkPlan = 0;
    var wdP = weekDays(p);
    for (var i = 0; i < 7; i++) { var d = addDays(sun, i); if (HOME[wdP[i]]) wkPlan++; if (logsOn(p, iso(d)).length) wkDone++; }
    var cs = cycleStats(p), mins = p.log.reduce(function (a, l) { return a + (l.mins || 0); }, 0);
    var cols = ["Wk 0", "Wk 4", "Wk 8", "Wk 12"];
    var tests = D.TESTS.map(function (ts) {
      var vals = p.tests[ts.k] || [];
      var first = parseFloat(vals[0]), lastV = null;
      for (var j = 3; j >= 1; j--) { if (vals[j] !== "" && vals[j] != null && !isNaN(parseFloat(vals[j]))) { lastV = parseFloat(vals[j]); break; } }
      var ch = "";
      if (!isNaN(first) && lastV != null) {
        var diff = lastV - first, better = ts.lower ? diff < 0 : diff > 0;
        ch = '<span class="chg ' + (diff === 0 ? "" : better ? "up" : "down") + '">' + (diff > 0 ? "+" : "") + (Math.round(diff * 100) / 100) + " " + ts.unit + '</span>';
      }
      return '<tr><th>' + esc(ts.short) + ' <small>' + ts.unit + '</small>' + (ch ? '<br>' + ch : '') + '</th>' + cols.map(function (c, j) {
        return '<td><input type="number" inputmode="decimal" step="any" min="0" aria-label="' + esc(ts.name + " " + c) + '" data-test="' + ts.k + '" data-col="' + j + '" value="' + esc(vals[j] == null ? "" : vals[j]) + '"></td>';
      }).join("") + '</tr>';
    }).join("");
    var hist = p.log.slice().sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : (b.at || 0) - (a.at || 0); }).slice(0, 40);
    el.innerHTML = '<div class="lead"><h2>' + esc(p.name) + "'s progress</h2><p>Test in week 0, then at the end of weeks 4, 8 and 12. Compare him with his own last score, never with his brother.</p></div>" +
      '<div class="tiles"><div class="tile"><b>' + wkDone + '/' + wkPlan + '</b><span>This week</span></div><div class="tile"><b>' + cs.done + '</b><span>This cycle</span></div><div class="tile"><b>' + mins + '</b><span>Minutes total</span></div></div>' +
      '<div class="box"><h3>Tests</h3><div class="tbl-wrap"><table class="tests"><thead><tr><th>Test</th>' + cols.map(function (c) { return "<th>" + c + "</th>"; }).join("") + '</tr></thead><tbody>' + tests + '</tbody></table></div>' +
      '<p class="small">Under each test name: the change since week 0 (green = better).</p><details><summary>How to do each test</summary><ul>' + D.TESTS.map(function (ts) { return "<li><b>" + esc(ts.name) + ":</b> " + esc(ts.how) + "</li>"; }).join("") + '</ul><p class="small">During a growth spurt, sprint and agility times can stall for a few weeks. That is normal.</p></details></div>' +
      '<div class="box"><h3>Session history</h3>' + (hist.length ? '<ul class="hist">' + hist.map(function (l) {
        var idx = p.log.indexOf(l);
        return '<li><span class="hb t-' + l.t + '">' + TYPE_SHORT[l.t] + '</span><span class="hm"><b>' + fmtDate(parse(l.d)) + '</b> · ' + (l.done != null ? l.done + "/" + l.total + " exercises" : "") + (l.mins ? " · " + l.mins + " min" : "") + ' ' + feelIcon(l.feel) + (l.pain ? ' <span class="painf">pain noted</span>' : "") + (l.note ? '<br><small>' + esc(l.note) + '</small>' : "") + '</span><button type="button" class="del" data-act="log-del" data-i="' + idx + '" aria-label="Delete this entry">×</button></li>';
      }).join("") + '</ul>' : '<p class="small">No sessions yet. Finish a guided session and it appears here.</p>') + '</div>';
  }

  function renderMore() {
    var el = $("#v-more");
    var standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone;
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var profs = store.profiles.map(function (p) {
      return '<li>' + avatar(p) + '<span class="pi"><b>' + esc(p.name) + '</b><small>Age ' + p.age + ' · ' + planLabel(p) + ' · ' + (weekOf(p) ? "Week " + weekOf(p) : "Not started") + '</small></span>' +
        (p.id === (prof() || {}).id ? '<span class="pill">Active</span>' : '<button type="button" class="chip-btn" data-act="prof-pick" data-id="' + p.id + '">Use</button>') +
        '<button type="button" class="chip-btn" data-act="prof-edit" data-id="' + p.id + '">Edit</button></li>';
    }).join("");
    el.innerHTML = '<div class="box"><h3>Profiles</h3>' + (profs ? '<ul class="profs">' + profs + '</ul>' : '<p class="small">No profiles yet.</p>') + '<button type="button" class="btn primary" data-act="prof-add">Add a profile</button></div>' +
      '<div class="box" id="install"><h3>Install on a phone</h3>' +
      '<p class="small">App address: <a href="' + APP_URL + '" target="_blank" rel="noopener"><b>' + APP_URL.replace("https://", "") + '</b></a> <button type="button" class="chip-btn" data-act="copy-url">Copy link</button></p>' +
      (inFrame ? '<p class="note">You are viewing a preview inside Claude. To install, open the address above on the phone. Profiles saved here don\'t move across by themselves: use “Copy backup code” below, then “Paste backup code” in the installed app.</p>' : "") +
      (standalone ? '<p class="ok">✓ Installed. It works offline too.</p>' :
        (deferredInstall ? '<button type="button" class="btn primary" data-act="install">Install app</button>' : "") +
        '<ol><li><b>iPhone:</b> open the app link in Safari, tap the Share button, then <b>Add to Home Screen</b>.</li><li><b>Android:</b> open it in Chrome, tap <b>Install app</b> (or the ⋮ menu, then <b>Install app</b> / <b>Add to Home screen</b>).</li></ol>' +
        '<p class="small">' + (ios ? "On iPhone, the installed app keeps its own data, separate from Safari. Install first, then create the profiles inside the app (or move them with a backup)." : "After the first open it works without internet.") + '</p>') + '</div>' +
      '<div class="box"><h3>Backup & move to another phone</h3><p class="small">Profiles are saved only on this phone. Make a backup now and then, and use it to put a profile on each boy\'s own phone.</p>' +
      '<div class="row wrap"><button type="button" class="btn ghost" data-act="share-backup">Save / share backup</button><button type="button" class="btn ghost" data-act="copy-backup">Copy backup code</button></div>' +
      '<div class="row wrap"><label class="btn ghost file">Restore from file<input type="file" id="importFile" accept="application/json,.json"></label><button type="button" class="btn ghost" data-act="paste-backup">Paste backup code</button></div></div>' +
      '<div class="box"><h3>Advice for the parent-coach</h3>' + D.ADVICE.map(function (a, i) { return '<details' + (i === 0 ? " open" : "") + '><summary>' + (i + 1) + " · " + esc(a[0]) + '</summary><p>' + esc(a[1]) + '</p></details>'; }).join("") + '</div>' +
      '<div class="box"><h3>Sources</h3><ol class="src">' + D.SOURCES.map(function (s) { return '<li><a href="' + s[1] + '" target="_blank" rel="noopener">' + esc(s[0]) + '</a></li>'; }).join("") + '</ol>' +
      '<p class="small">General guidance for healthy children. If a player has a medical condition or a current injury, check with his doctor or physiotherapist first. Demo video buttons open a YouTube search; pick clips from coach or physio channels.</p></div>' +
      '<div class="box"><h3>Reset</h3><p class="small">Deletes every profile, schedule and log on this phone.</p><button type="button" class="btn danger" data-act="reset-all">Delete all data</button></div>';
  }

  function render() {
    renderAppbar();
    var v = ui.view;
    VIEWS.forEach(function (n) { var s = $("#v-" + n); s.hidden = n !== v; });
    $$(".bnav a").forEach(function (a) { if (a.getAttribute("data-v") === v) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    if (v === "today") renderToday();
    else if (v === "week") renderWeek();
    else if (v === "workouts") renderWorkouts();
    else if (v === "library") renderLibrary();
    else if (v === "progress") renderProgress();
    else renderMore();
    $("#storeWarn").hidden = storageOK;
  }
  function route() {
    var v = (location.hash || "").replace("#", "");
    ui.view = VIEWS.indexOf(v) >= 0 ? v : "today";
    render();
    window.scrollTo(0, 0);
  }

  /* ---------------- profile sheets ---------------- */
  function profileForm(p) {
    var isNew = !p;
    p = p || normProfile({ name: "", age: store.profiles.length ? 12 : 10, color: store.profiles.length % COLORS.length });
    openSheet('<h2>' + (isNew ? "New profile" : "Edit " + esc(p.name)) + '</h2><form id="profForm" class="form" data-id="' + (isNew ? "" : p.id) + '">' +
      '<label>Name<input name="name" required maxlength="24" autocomplete="off" value="' + esc(isNew ? "" : p.name) + '" placeholder="e.g. Omar"></label>' +
      '<label>Age<input name="age" type="number" inputmode="numeric" min="5" max="18" value="' + p.age + '"></label>' +
      '<label>Doses<select name="track"><option value="y"' + (p.track === "y" ? " selected" : "") + '>Younger plan (about 9–10)</option><option value="o"' + (p.track === "o" ? " selected" : "") + '>Older plan (about 11–13)</option></select></label>' +
      '<label>Start date<input name="start" type="date" value="' + p.start + '"></label>' +
      '<label>Phase<select name="phaseMode">' + [["auto", "Automatic from start date"], ["0", "Weeks 1–4 · Foundation"], ["1", "Weeks 5–8 · Build"], ["2", "Weeks 9–12 · Power"]].map(function (o) { return '<option value="' + o[0] + '"' + (p.phaseMode === o[0] ? " selected" : "") + '>' + o[1] + '</option>'; }).join("") + '</select></label>' +
      '<label>Equipment at home<select name="equip"><option value="bw"' + (p.equip !== "kit" ? " selected" : "") + '>Bodyweight only</option><option value="kit"' + (p.equip === "kit" ? " selected" : "") + '>Bands & light weights (1–3 kg)</option></select><small>Light kit swaps in some versions with a band or light dumbbell. Each card can switch back.</small></label>' +
      '<label>Warm-up<select name="warm"><option value="k11"' + (p.warm !== "quick" ? " selected" : "") + '>FIFA 11+ Kids (recommended, ~15 min)</option><option value="quick"' + (p.warm === "quick" ? " selected" : "") + '>Quick warm-up (~8 min)</option></select></label>' +
      (isNew ? '<label>Training days<select name="preset">' + D.PRESETS.map(function (pr, i) { return '<option value="' + i + '">' + pr.name + '</option>'; }).join("") + '</select><small>You can change each day later in Week.</small></label>' : "") +
      '<fieldset class="colors"><legend>Colour</legend>' + COLORS.map(function (c, i) { return '<label class="sw"><input type="radio" name="color" value="' + i + '"' + (p.color === i ? " checked" : "") + '><span style="background:' + c + '"></span><span class="vh">Colour ' + (i + 1) + '</span></label>'; }).join("") + '</fieldset>' +
      '<div class="row"><button type="submit" class="btn primary">' + (isNew ? "Create profile" : "Save") + '</button>' + (isNew ? "" : '<button type="button" class="btn danger" data-act="prof-del" data-id="' + p.id + '">Delete</button>') + '</div></form>');
    var f = $("#profForm"), touched = false;
    f.track.addEventListener("change", function () { touched = true; });
    f.age.addEventListener("input", function () { if (!touched) f.track.value = (parseInt(f.age.value, 10) || 10) <= 10 ? "y" : "o"; });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = f.name.value.trim(); if (!name) { f.name.focus(); return; }
      var data = { name: name, age: f.age.value, track: f.track.value, start: f.start.value || iso(today()), phaseMode: f.phaseMode.value, color: +(f.querySelector("input[name=color]:checked") || { value: 0 }).value, equip: f.equip.value, warm: f.warm.value };
      var id = f.getAttribute("data-id");
      if (id) {
        var q = store.profiles.filter(function (x) { return x.id === id; })[0];
        Object.assign(q, normProfile(Object.assign({}, q, data)));
        toast("Saved");
      } else {
        data.days = D.PRESETS[+f.preset.value || 0].days.slice();
        var np = normProfile(data); store.profiles.push(np); store.active = np.id;
        try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (er) {}
        toast("Profile created");
      }
      save(); closeSheet(); render();
    });
  }
  function profileSwitcher() {
    var cur = prof();
    openSheet('<h2>Who is training?</h2><ul class="profs pick">' + store.profiles.map(function (p) {
      return '<li><button type="button" class="pbtn' + (cur && p.id === cur.id ? " on" : "") + '" data-act="prof-pick" data-id="' + p.id + '">' + avatar(p, true) + '<span class="pi"><b>' + esc(p.name) + '</b><small>Age ' + p.age + ' · ' + planLabel(p) + '</small></span></button></li>';
    }).join("") + '</ul><div class="row wrap"><button type="button" class="btn ghost" data-act="prof-add">Add profile</button>' + (cur ? '<button type="button" class="btn ghost" data-act="prof-edit" data-id="' + cur.id + '">Edit ' + esc(cur.name) + '</button>' : "") + '</div>');
  }
  function confirmSheet(title, text, okLabel, okAct, extra) {
    openSheet('<h2>' + esc(title) + '</h2><p>' + esc(text) + '</p><div class="row"><button type="button" class="btn danger" data-act="' + okAct + '"' + (extra || "") + '>' + esc(okLabel) + '</button><button type="button" class="btn ghost" data-act="sheet-close">Cancel</button></div>');
  }

  /* ---------------- backup ---------------- */
  function exportJSON() { return JSON.stringify({ app: "footyfit", v: 1, at: new Date().toISOString(), profiles: store.profiles }); }
  function importJSON(txt) {
    var o; try { o = JSON.parse(txt); } catch (e) { toast("That isn't a valid backup"); return false; }
    var list = o && Array.isArray(o.profiles) ? o.profiles : (o && o.id && o.name ? [o] : null);
    if (!list || !list.length) { toast("No profiles found in that backup"); return false; }
    var added = 0, updated = 0;
    list.forEach(function (raw) {
      var np = normProfile(raw), ex = -1;
      store.profiles.forEach(function (q, i) { if (q.id === np.id) ex = i; });
      if (ex >= 0) { store.profiles[ex] = np; updated++; } else { store.profiles.push(np); added++; }
    });
    if (!prof() || !store.active) store.active = store.profiles[0].id;
    save(); render();
    toast((added ? added + " added" : "") + (added && updated ? ", " : "") + (updated ? updated + " updated" : ""));
    return true;
  }
  function shareBackup() {
    var json = exportJSON(), name = "football-fitness-backup-" + iso(today()) + ".json";
    try {
      var file = new File([json], name, { type: "application/json" });
      if (!inFrame && navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: "Football Fitness backup" }).catch(function () {}); return; }
    } catch (e) {}
    if (!inFrame) {
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([json], { type: "application/json" })); a.download = name;
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      toast("Backup saved");
    } else showCode(json);
  }
  function showCode(json) {
    openSheet('<h2>Backup code</h2><p class="small">Copy all of this text and keep it somewhere safe, or send it to the other phone and use “Paste backup code” there.</p><textarea id="codeOut" class="code-area" readonly>' + esc(json) + '</textarea><div class="row"><button type="button" class="btn primary" data-act="copy-code">Copy</button></div>');
  }
  function copyText(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt).then(function () { toast("Copied"); return true; }, function () { showCode(txt); });
    showCode(txt);
  }

  /* ---------------- guided session ---------------- */
  var sess = null, sessTimer = null, restTimer = null;
  var ssEl = $("#session");
  function buildSteps(p, type) {
    var ph = phaseOf(p), steps = [];
    sessionPlan(p, warmType(p)).forEach(function (b) { b.items.forEach(function (it, i, arr) { steps.push({ id: it.id, label: (b.fifa ? "FIFA 11+ Kids " : "Warm-up ") + (i + 1) + " of " + arr.length + (b.fifa ? " · Level " + lvOf(p, it.id) : ""), txt: dose(it.id, p, ph), rest: 0 }); }); });
    sessionPlan(p, type).forEach(function (b) {
      var items = b.stations ? b.items.filter(function (i) { return i.station; }) : b.items;
      if (b.circuit) {
        var ns = items.map(function (it) { return setsOf(dose(it.id, p, ph)) || 1; });
        var R = Math.max.apply(null, ns);
        for (var r = 1; r <= R; r++) {
          var inR = items.filter(function (it, k) { return ns[k] >= r; });
          inR.forEach(function (it, k) {
            var last = k === inR.length - 1;
            steps.push({ id: it.id, label: b.h + " · Round " + r + " of " + R, txt: perSet(dose(it.id, p, ph)), rest: last ? b.roundRest : b.rest, restLabel: last && r < R ? "Round " + r + " done. Rest before round " + (r + 1) : "Rest" });
          });
        }
      } else {
        items.forEach(function (it, k) { steps.push({ id: it.id, label: b.h + (b.stations ? " · " + (k + 1) + " of " + items.length : ""), txt: dose(it.id, p, ph), rest: b.rest }); });
      }
    });
    if (steps.length) steps[steps.length - 1].rest = 0;
    sessionPlan(p, "cool").forEach(function (b) { b.items.forEach(function (it, i, arr) { steps.push({ id: it.id, label: "Cool-down " + (i + 1) + " of " + arr.length, txt: dose(it.id, p, ph), rest: 0 }); }); });
    return steps;
  }
  function startSession(type) {
    var p = prof(); if (!p) { profileForm(); return; }
    closeSheet();
    sess = { pid: p.id, type: type, steps: buildSteps(p, type), i: 0, done: {}, start: Date.now(), mode: "step", ph: phaseOf(p) };
    ssEl.hidden = false; document.body.classList.add("locked");
    audio();
    try { if (navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request("screen").then(function (l) { sess && (sess.lock = l); }).catch(function () {}); } catch (e) {}
    drawSession();
  }
  function stopTimers() { if (sessTimer) sessTimer.stop(); if (restTimer) restTimer.stop(); }
  function endSession() { stopTimers(); try { if (sess && sess.lock) sess.lock.release(); } catch (e) {} sess = null; ssEl.hidden = true; ssEl.innerHTML = ""; document.body.classList.remove("locked"); render(); }
  function drawSession() {
    var p = store.profiles.filter(function (x) { return x.id === sess.pid; })[0];
    var n = sess.steps.length, pct = Math.round(sess.i / n * 100);
    var top = '<div class="ss-top"><button type="button" class="ss-x" data-act="ss-exit" aria-label="End session">×</button><div class="ss-prog" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%"></i></div><span class="ss-n">' + Math.min(sess.i + 1, n) + '/' + n + '</span></div>';
    if (sess.mode === "finish") {
      var doneN = Object.keys(sess.done).length, mins = Math.max(1, Math.round((Date.now() - sess.start) / 60000));
      ssEl.innerHTML = top + '<div class="ss-body center"><p class="ss-label">' + TYPE_NAME[sess.type] + '</p><h2>Session done</h2><p>' + doneN + ' of ' + n + ' exercises · ' + mins + ' min</p>' +
        '<p class="q">How did it feel?</p><div class="feel" role="radiogroup" aria-label="How did it feel">' +
        [[1, "Easy"], [2, "Good"], [3, "Hard"]].map(function (f) { return '<button type="button" role="radio" aria-checked="' + (sess.feel === f[0]) + '" data-act="ss-feel" data-v="' + f[0] + '">' + f[1] + '</button>'; }).join("") + '</div>' +
        '<label class="chk"><input type="checkbox" id="ssPain"' + (sess.pain ? " checked" : "") + '> Any pain? (not just tired muscles)</label>' +
        '<label class="form">Note<input id="ssNote" maxlength="140" placeholder="Optional, e.g. new record in plank" value="' + esc(sess.note || "") + '"></label>' +
        (p && p.warm !== "quick" ? '<p class="small">FIFA 11+ Kids: if an exercise looked easy and clean for a few sessions, move it up a level in Workouts › Warm-up.</p>' : "") +
        '<p class="small" id="painTip"' + (sess.pain ? "" : " hidden") + '>If it hurts in a joint, the knee or the heel, rest from jumping and sprinting for a few days. See a physio if it doesn\'t settle.</p></div>' +
        '<div class="ss-foot"><button type="button" class="btn primary big" data-act="ss-save">Save session</button></div>';
      var pain = $("#ssPain"); pain.addEventListener("change", function () { sess.pain = pain.checked; $("#painTip").hidden = !pain.checked; });
      $("#ssNote").addEventListener("input", function (e) { sess.note = e.target.value; });
      return;
    }
    var st = sess.steps[sess.i], e = EX[st.id];
    if (sess.mode === "rest") {
      var next = sess.steps[sess.i];
      ssEl.innerHTML = top + '<div class="ss-body center rest"><p class="ss-label">' + esc(sess.restLabel || "Rest") + '</p><div class="big-t" id="restT">' + fmtT(sess.restSecs) + '</div>' +
        '<p class="small">Next up</p><div class="ss-fig small">' + figSvg(next.id, sess.ph) + '</div><h3>' + esc(EX[next.id].name) + '</h3><p class="ss-dose">' + esc(next.txt) + '</p></div>' +
        '<div class="ss-foot"><button type="button" class="btn ghost" data-act="ss-rest-add">+15 s</button><button type="button" class="btn primary big" data-act="ss-rest-skip">Skip rest</button></div>';
      mountFigs(ssEl);
      restTimer = restTimer || new Timer(function (s) { var r = $("#restT"); if (r) r.textContent = fmtT(s); }, function () { if (sess && sess.mode === "rest") { sess.mode = "step"; drawSession(); } });
      restTimer.start(sess.restSecs);
      return;
    }
    var secs = secsOf(st.txt);
    ssEl.innerHTML = top + '<div class="ss-body"><p class="ss-label">' + esc(st.label) + '</p><div class="ss-fig">' + figSvg(st.id, sess.ph) + '</div>' +
      '<h2>' + esc(e.name) + '</h2><p class="ss-dose">' + esc(st.txt) + '</p>' +
      (secs ? '<button type="button" class="btn timer" data-act="ss-timer" data-s="' + secs + '"><span id="ssT">Start ' + secs + ' s timer</span></button>' : "") +
      '<p class="now"><b>' + howLabel(st.id, p) + ':</b> ' + esc(howOf(st.id, p, sess.ph)) + '</p>' +
      '<ul class="cues">' + e.cues.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + '</ul>' +
      (e.watch ? '<p class="watch"><b>Watch for:</b> ' + esc(e.watch) + '</p>' : "") +
      '<a class="vid" href="' + YT(e.lv ? e.yt + " level " + lvOf(p, st.id) : e.yt) + '" target="_blank" rel="noopener">' + PLAY + 'Demo videos</a></div>' +
      '<div class="ss-foot"><button type="button" class="btn ghost" data-act="ss-back"' + (sess.i === 0 ? " disabled" : "") + '>Back</button><button type="button" class="btn ghost" data-act="ss-skip">Skip</button><button type="button" class="btn primary big" data-act="ss-done">Done ✓</button></div>';
    mountFigs(ssEl);
    ssEl.scrollTop = 0;
  }
  function advance(markDone) {
    stopTimers();
    var st = sess.steps[sess.i];
    if (markDone) sess.done[sess.i] = 1;
    sess.i++;
    if (sess.i >= sess.steps.length) { sess.mode = "finish"; drawSession(); return; }
    if (markDone && st.rest > 0) { sess.mode = "rest"; sess.restSecs = st.rest; sess.restLabel = st.restLabel || "Rest"; }
    else sess.mode = "step";
    drawSession();
  }
  function saveSession(partial) {
    var p = store.profiles.filter(function (x) { return x.id === sess.pid; })[0];
    if (p) {
      p.log.push({ d: iso(today()), t: sess.type, done: Object.keys(sess.done).length, total: sess.steps.length, feel: sess.feel || 0, pain: !!sess.pain, note: (sess.note || "").slice(0, 140), mins: Math.max(1, Math.round((Date.now() - sess.start) / 60000)), at: Date.now(), partial: !!partial });
      save();
    }
    toast(partial ? "Saved what you did" : "Session saved. Well done!");
    endSession();
  }

  /* ---------------- events ---------------- */
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-act]"); if (!t) return;
    var act = t.getAttribute("data-act"), p = prof();
    switch (act) {
      case "sheet-close": closeSheet(); break;
      case "timer": startPill(+t.getAttribute("data-s")); break;
      case "tstop": pillTimer.stop(); pill.hidden = true; break;
      case "prof-switch": if (store.profiles.length) profileSwitcher(); else profileForm(); break;
      case "prof-add": closeSheet(); profileForm(); break;
      case "prof-edit": closeSheet(); profileForm(store.profiles.filter(function (x) { return x.id === t.getAttribute("data-id"); })[0]); break;
      case "prof-pick": store.active = t.getAttribute("data-id"); save(); closeSheet(); ui.wtab = null; render(); toast("Now training: " + prof().name); break;
      case "prof-del": confirmSheet("Delete this profile?", "This removes the profile, its schedule, test results and session history from this phone.", "Delete profile", "prof-del-yes", ' data-id="' + t.getAttribute("data-id") + '"'); break;
      case "prof-del-yes":
        store.profiles = store.profiles.filter(function (x) { return x.id !== t.getAttribute("data-id"); });
        if (!prof()) store.active = store.profiles[0] ? store.profiles[0].id : null; else if (store.active === t.getAttribute("data-id")) store.active = store.profiles[0] ? store.profiles[0].id : null;
        save(); closeSheet(); render(); toast("Profile deleted"); break;
      case "preset": p.days = D.PRESETS[+t.getAttribute("data-i")].days.slice(); p.wk = null; save(); render(); toast("Week updated"); break;
      case "copy-days": var to = store.profiles.filter(function (x) { return x.id === t.getAttribute("data-to"); })[0]; if (to) { to.days = p.days.slice(); save(); toast("Copied to " + to.name); } break;
      case "wtab": ui.wtab = t.getAttribute("data-t"); render(); break;
      case "wtab-go": ui.wtab = t.getAttribute("data-t"); break;
      case "swap":
        var key = t.getAttribute("data-key"), k = +t.getAttribute("data-k"), n = +t.getAttribute("data-n");
        p.swaps[key] = { w: Math.max(1, weekOf(p)), i: (k + 1) % n }; save(); render(); break;
      case "open-ex": openExercise(t.getAttribute("data-id")); break;
      case "lv":
        var lid = t.getAttribute("data-id"), nl = Math.max(1, Math.min(5, lvOf(p, lid) + +t.getAttribute("data-d")));
        p.lv[lid] = nl; save(); toast(EX[lid].name + ": level " + nl);
        if (!sheetBack.hidden) openExercise(lid); render(); break;
      case "var": p.vars[t.getAttribute("data-base")] = t.getAttribute("data-v"); save(); render(); break;
      case "equip": p.equip = t.getAttribute("data-v"); p.vars = {}; save(); render(); toast(p.equip === "kit" ? "Light-kit versions on" : "Bodyweight versions on"); break;
      case "warm": p.warm = t.getAttribute("data-v"); save(); render(); break;
      case "wk-train":
        var dd = +t.getAttribute("data-d"), r1 = planTrain(p, dd, +t.getAttribute("data-src"));
        applyWeek(p, r1.days); ui.note = "<b>" + TYPE_NAME[r1.t] + "</b> is now on " + (dd === today().getDay() ? "today" : DAYS_L[dd]) + ". Rest of the week: <b>" + weekLine(r1.days, today().getDay()) + "</b>.";
        if (ui.view !== "today") { toast(TYPE_SHORT[r1.t] + " moved to " + DAYS[dd]); render(); } else { render(); window.scrollTo(0, 0); } break;
      case "wk-move":
        var dm = +t.getAttribute("data-d"), r2 = planMove(p, dm); if (!r2) break;
        applyWeek(p, r2.days); ui.note = "Moved <b>" + TYPE_NAME[r2.t] + "</b> to " + DAYS_L[r2.to] + ". Rest of the week: <b>" + weekLine(r2.days, today().getDay()) + "</b>.";
        if (ui.view !== "today") { toast(TYPE_SHORT[r2.t] + " moved to " + DAYS[r2.to]); render(); } else { render(); window.scrollTo(0, 0); } break;
      case "wk-undo": p.wk = null; save(); render(); toast("Back to the usual week"); break;
      case "copy-url": copyText(APP_URL); break;
      case "cat": ui.cat = t.getAttribute("data-cat"); render(); break;
      case "start": startSession(t.getAttribute("data-type")); break;
      case "new-cycle": p.start = iso(today()); p.phaseMode = "auto"; save(); render(); toast("New 12 weeks started"); break;
      case "log-del": confirmSheet("Delete this session?", "It will be removed from the history.", "Delete", "log-del-yes", ' data-i="' + t.getAttribute("data-i") + '"'); break;
      case "log-del-yes": p.log.splice(+t.getAttribute("data-i"), 1); save(); closeSheet(); render(); break;
      case "share-backup": if (!store.profiles.length) { toast("Nothing to back up yet"); break; } shareBackup(); break;
      case "copy-backup": if (!store.profiles.length) { toast("Nothing to back up yet"); break; } copyText(exportJSON()); break;
      case "copy-code": var ta = $("#codeOut"); copyText(ta.value); ta.select(); break;
      case "paste-backup":
        openSheet('<h2>Paste backup code</h2><textarea id="codeIn" class="code-area" placeholder="Paste the backup code here"></textarea><div class="row"><button type="button" class="btn primary" data-act="paste-go">Restore</button></div>'); break;
      case "paste-go": if (importJSON($("#codeIn").value.trim())) closeSheet(); break;
      case "install": if (deferredInstall) { deferredInstall.prompt(); deferredInstall.userChoice.finally(function () { deferredInstall = null; render(); }); } break;
      case "reset-all": confirmSheet("Delete all data?", "Every profile, schedule, test and session on this phone will be deleted. Make a backup first if you might need it.", "Delete everything", "reset-yes"); break;
      case "reset-yes": store = { v: 1, profiles: [], active: null }; save(); closeSheet(); render(); toast("All data deleted"); break;
      // session
      case "ss-done": advance(true); break;
      case "ss-skip": advance(false); break;
      case "ss-back": stopTimers(); if (sess.i > 0) { sess.i--; sess.mode = "step"; drawSession(); } break;
      case "ss-rest-skip": stopTimers(); sess.mode = "step"; drawSession(); break;
      case "ss-rest-add": if (restTimer && restTimer.running()) { restTimer.end += 15000; } break;
      case "ss-timer":
        var lab = $("#ssT"), s = +t.getAttribute("data-s");
        sessTimer = sessTimer || new Timer(function (x) { var l = $("#ssT"); if (l) l.textContent = fmtT(x); }, function () { var l = $("#ssT"); if (l) l.textContent = "Time! Tap Done ✓"; });
        if (sessTimer.running()) { sessTimer.stop(); lab.textContent = "Start " + s + " s timer"; } else sessTimer.start(s);
        break;
      case "ss-feel": sess.feel = +t.getAttribute("data-v"); $$(".feel button").forEach(function (b) { b.setAttribute("aria-checked", String(+b.getAttribute("data-v") === sess.feel)); }); break;
      case "ss-save": saveSession(false); break;
      case "ss-exit":
        var dn = Object.keys(sess.done).length;
        openSheet('<h2>End the session?</h2><p>' + dn + ' of ' + sess.steps.length + ' exercises done.</p><div class="row wrap">' + (dn ? '<button type="button" class="btn primary" data-act="ss-save-part">Save what we did</button>' : "") + '<button type="button" class="btn danger" data-act="ss-discard">Discard</button><button type="button" class="btn ghost" data-act="sheet-close">Keep going</button></div>');
        break;
      case "ss-save-part": closeSheet(); saveSession(true); break;
      case "ss-discard": closeSheet(); endSession(); break;
    }
  });
  document.addEventListener("change", function (ev) {
    var t = ev.target, p = prof(); if (!p) return;
    if (t.matches("select[data-day]")) { p.days[+t.getAttribute("data-day")] = t.value; p.wk = null; save(); render(); }
    else if (t.id === "startDate" && t.value) { p.start = t.value; save(); render(); }
    else if (t.id === "phaseMode") { p.phaseMode = t.value; save(); render(); }
    else if (t.matches("input[data-test]")) {
      var k = t.getAttribute("data-test"), c = +t.getAttribute("data-col");
      p.tests[k] = p.tests[k] || ["", "", "", ""]; p.tests[k][c] = t.value; save(); renderProgress();
    } else if (t.id === "importFile" && t.files && t.files[0]) {
      var r = new FileReader(); r.onload = function () { importJSON(String(r.result)); }; r.readAsText(t.files[0]); t.value = "";
    }
  });
  sheetBack.addEventListener("click", function (e) { if (e.target === sheetBack) closeSheet(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !sheetBack.hidden) closeSheet(); });
  window.addEventListener("hashchange", route);
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferredInstall = e; if (ui.view === "more") render(); });
  window.addEventListener("appinstalled", function () { deferredInstall = null; toast("Installed"); });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible" && sess && sess.lock && sess.lock.released && navigator.wakeLock) { navigator.wakeLock.request("screen").then(function (l) { if (sess) sess.lock = l; }).catch(function () {}); } });

  /* ---------------- boot ---------------- */
  load();
  if (inFrame) $("#previewNote").hidden = false;
  if ("serviceWorker" in navigator && !inFrame && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
      // FitForm used to live at the site root and its worker covered this folder too; retire it.
      try { navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { if (r.scope === location.origin + "/") r.unregister(); }); }); } catch (e) {}
    });
  }
  route();
})();

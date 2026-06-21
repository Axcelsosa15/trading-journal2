/* Bitácora — Trading Journal (multi-user)
 *
 * Static front-end backed by Supabase: email/password auth and a Postgres
 * database with Row Level Security, so every trader signs up and sees only
 * their own trades and journal. No build step; the Supabase JS SDK is loaded
 * from a CDN and this file talks only to our own project.
 */
(function () {
  "use strict";

  // ---------- Supabase ----------
  // The anon/publishable key is meant to live in the client; data is protected
  // server-side by Row Level Security, not by hiding this key.
  var SUPABASE_URL = "https://ajihczecndwznolgbrdc.supabase.co";
  var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqaWhjemVjbmR3em5vbGdicmRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNjYzNjAsImV4cCI6MjA5NzY0MjM2MH0.TVFPDqESi2K25LG-5syZ70KLpmlDzQhLB1aXa3RZWWc";
  var SB = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ---------- tiny DOM builders ----------
  var SVG_NS = "http://www.w3.org/2000/svg";

  function build(ns, tag, props, children) {
    var e = ns ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
    if (props) {
      for (var k in props) {
        var v = props[k];
        if (v == null || v === false) continue;
        if (k === "style") { if (ns) e.setAttribute("style", v); else e.style.cssText = v; }
        else if (k === "html") e.innerHTML = v;
        else if (k === "class") e.setAttribute("class", v);
        else if (k === "hoverBg") wireHover(e, v);
        else if (k.slice(0, 2) === "on" && typeof v === "function") e.addEventListener(k.slice(2).toLowerCase(), v);
        else e.setAttribute(k, v);
      }
    }
    append(e, children);
    return e;
  }
  function append(parent, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) { for (var i = 0; i < child.length; i++) append(parent, child[i]); return; }
    if (child instanceof Node) { parent.appendChild(child); return; }
    parent.appendChild(document.createTextNode(String(child)));
  }
  function h(tag, props) { return build(false, tag, props, [].slice.call(arguments, 2)); }
  function s(tag, props) { return build(true, tag, props, [].slice.call(arguments, 2)); }
  function icon(str) { var t = document.createElement("template"); t.innerHTML = str.trim(); return t.content.firstElementChild; }
  function wireHover(e, color) {
    var base = e.style.background;
    e.addEventListener("mouseenter", function () { e.style.background = color; });
    e.addEventListener("mouseleave", function () { e.style.background = base; });
  }

  // ===================================================================
  // State
  // ===================================================================
  var state = {
    booting: true,
    user: null,
    authMode: "login", authEmail: "", authPass: "", authError: "", authBusy: false,
    loadingData: false,
    view: "dashboard",
    trades: [], journal: [], accounts: [],
    selectedId: null,
    fResult: "all", fSymbol: "all", fSetup: "all", fAccount: "all", fTag: "all",
    calMonth: thisMonth(),
    showAdd: false, editId: null, draft: blankDraft(),
    showJournalAdd: false, jdraft: blankJournalDraft(),
    showAccountAdd: false, accountEditId: null, accountDraft: blankAccountDraft(),
  };

  // ---------- helpers ----------
  var MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  var MESL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function todayISO() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function thisMonth() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1); }
  function fmtDate(iso) { var p = iso.split("-").map(Number); return p[2] + " " + MES[p[1] - 1]; }
  function fmtDateLong(iso) { var p = iso.split("-").map(Number); return p[2] + " " + MES[p[1] - 1] + " " + p[0]; }
  function money(n) { return "$" + Math.abs(Math.round(n)).toLocaleString("en-US"); }
  function signed(n) { return (n >= 0 ? "+" : "−") + "$" + Math.abs(Math.round(n)).toLocaleString("en-US"); }
  function num(n) { return Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
  function stars(r) { return "★★★★★".slice(0, r) + "☆☆☆☆☆".slice(0, 5 - r); }
  function pnlColor(n) { return n >= 0 ? "color:#16915B;" : "color:#D6483B;"; }

  function PV(t) {
    var P = { ES: 50, MES: 5, NQ: 20, MNQ: 2, CL: 1000, GC: 100, MGC: 10, RTY: 50, MRTY: 5 };
    return t.type === "option" ? 100 : (P[(t.symbol || "").toUpperCase()] || 1);
  }
  function pnlOf(t) {
    var dir = t.side === "long" ? 1 : -1;
    return Math.round((Number(t.exit) - Number(t.entry)) * PV(t) * Number(t.contracts) * dir);
  }
  function blankDraft() {
    return { symbol: "MES", type: "future", side: "long", contracts: 1, entry: "", exit: "", date: todayISO(), setup: "Ruptura", emotion: "Tranquilo", rating: 3, note: "", account_id: "", tags: "", mae: "", mfe: "" };
  }
  function blankAccountDraft() {
    return { name: "", kind: "fondeo", firm: "", balance: "", currency: "USD", phase: "", status: "activa", profit_target: "", max_drawdown: "", notes: "" };
  }
  function blankJournalDraft() {
    return { date: todayISO(), mood: "Enfocado", title: "", body: "", lesson: "" };
  }

  // ---------- data access (Supabase) ----------
  function coerceTrade(r) {
    return { id: r.id, date: r.date, symbol: r.symbol, type: r.type, side: r.side, contracts: Number(r.contracts), entry: Number(r.entry), exit: Number(r.exit), setup: r.setup, emotion: r.emotion, rating: Number(r.rating), note: r.note || "", pnl: Number(r.pnl), account_id: r.account_id || null, tags: Array.isArray(r.tags) ? r.tags : [], mae: r.mae == null ? "" : Number(r.mae), mfe: r.mfe == null ? "" : Number(r.mfe) };
  }
  function parseTags(str) {
    if (Array.isArray(str)) return str;
    return String(str || "").split(",").map(function (s) { return s.trim(); }).filter(function (s, i, a) { return s && a.indexOf(s) === i; });
  }
  function coerceAccount(r) {
    return { id: r.id, name: r.name, kind: r.kind, firm: r.firm || "", balance: Number(r.balance), currency: r.currency || "USD", phase: r.phase || "", status: r.status, profit_target: r.profit_target == null ? "" : Number(r.profit_target), max_drawdown: r.max_drawdown == null ? "" : Number(r.max_drawdown), notes: r.notes || "" };
  }
  function coerceJournal(r) {
    return { id: r.id, date: r.date, mood: r.mood, title: r.title, body: r.body || "", lesson: r.lesson || "" };
  }
  async function loadData() {
    state.loadingData = true; render();
    try {
      var t = await SB.from("trades").select("*").order("date", { ascending: false }).order("created_at", { ascending: false });
      var j = await SB.from("journal").select("*").order("date", { ascending: false }).order("created_at", { ascending: false });
      var a = await SB.from("accounts").select("*").order("created_at", { ascending: false });
      state.trades = (t.data || []).map(coerceTrade);
      state.journal = (j.data || []).map(coerceJournal);
      state.accounts = (a.data || []).map(coerceAccount);
    } catch (e) { /* leave empty on error */ }
    state.loadingData = false;
    render();
  }

  // ---------- auth ----------
  function translateAuthError(msg) {
    msg = msg || "";
    if (/Invalid login credentials/i.test(msg)) return "Email o contraseña incorrectos.";
    if (/already registered|already exists/i.test(msg)) return "Ese email ya tiene cuenta. Inicia sesión.";
    if (/at least 6/i.test(msg)) return "La contraseña debe tener al menos 6 caracteres.";
    if (/valid email|invalid format/i.test(msg)) return "Introduce un email válido.";
    if (/rate limit/i.test(msg)) return "Demasiados intentos. Espera un momento e inténtalo otra vez.";
    return msg;
  }
  async function doAuth() {
    var email = (state.authEmail || "").trim();
    var password = state.authPass || "";
    if (!email || !password) { state.authError = "Introduce email y contraseña."; render(); return; }
    if (state.authMode === "signup" && password.length < 8) { state.authError = "La contraseña debe tener al menos 8 caracteres."; render(); return; }
    state.authBusy = true; state.authError = ""; render();
    try {
      if (state.authMode === "signup") {
        var su = await SB.auth.signUp({ email: email, password: password });
        if (su.error) throw su.error;
        var si = await SB.auth.signInWithPassword({ email: email, password: password });
        if (si.error) throw si.error;
      } else {
        var r = await SB.auth.signInWithPassword({ email: email, password: password });
        if (r.error) throw r.error;
      }
      // onAuthStateChange (SIGNED_IN) takes it from here.
    } catch (e) {
      state.authBusy = false;
      state.authError = translateAuthError(e && e.message);
      render();
    }
  }
  function logout() { SB.auth.signOut(); }

  // ---------- CSV export ----------
  function csvCell(v) {
    var s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function exportCSV(rows) {
    if (!rows || !rows.length) { window.alert("No hay operaciones para exportar."); return; }
    var headers = ["Fecha", "Símbolo", "Instrumento", "Dirección", "Contratos", "Entrada", "Salida", "Setup", "Emoción", "Valoración", "Cuenta", "PnL", "Notas"];
    var lines = [headers.map(csvCell).join(",")];
    rows.forEach(function (t) {
      lines.push([t.date, t.symbol, (t.type === "option" ? "Opción" : "Futuro"), (t.side === "long" ? "Largo" : "Corto"), t.contracts, t.entry, t.exit, t.setup, t.emotion, t.rating, accountName(t.account_id) || "", t.pnl, t.note].map(csvCell).join(","));
    });
    var csv = "﻿" + lines.join("\r\n"); // BOM so Excel reads accents correctly
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "bitacora-operaciones-" + todayISO() + ".csv";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function downloadText(filename, text, mime) {
    var blob = new Blob([text], { type: (mime || "text/plain") + ";charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function exportAll() {
    var data = { app: "Bitacora", exported_at: new Date().toISOString(), accounts: state.accounts, trades: state.trades, journal: state.journal };
    downloadText("bitacora-backup-" + todayISO() + ".json", JSON.stringify(data, null, 2), "application/json");
  }
  function exportTax(rows) {
    if (!rows || !rows.length) { window.alert("No hay operaciones para exportar."); return; }
    var sorted = rows.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var headers = ["Año", "Fecha", "Cuenta", "Símbolo", "Instrumento", "Dirección", "Contratos", "PnL"];
    var lines = [headers.map(csvCell).join(",")];
    sorted.forEach(function (t) {
      lines.push([t.date.slice(0, 4), t.date, accountName(t.account_id) || "", t.symbol, (t.type === "option" ? "Opción" : "Futuro"), (t.side === "long" ? "Largo" : "Corto"), t.contracts, t.pnl].map(csvCell).join(","));
    });
    downloadText("bitacora-impuestos-" + todayISO() + ".csv", "﻿" + lines.join("\r\n"), "text/csv");
  }

  // ---------- mutations ----------
  async function saveTrade() {
    var d = state.draft;
    if (!d.symbol || d.entry === "" || d.exit === "" || Number(d.contracts) <= 0) return;
    var pnl = pnlOf({ symbol: d.symbol, type: d.type, side: d.side, contracts: Number(d.contracts), entry: Number(d.entry), exit: Number(d.exit) });
    var row = { date: d.date, symbol: d.symbol.toUpperCase(), type: d.type, side: d.side, contracts: Number(d.contracts), entry: Number(d.entry), exit: Number(d.exit), setup: d.setup, emotion: d.emotion, rating: Number(d.rating) || 3, note: d.note, pnl: pnl, account_id: d.account_id || null, tags: parseTags(d.tags), mae: d.mae === "" ? null : Number(d.mae), mfe: d.mfe === "" ? null : Number(d.mfe) };
    if (state.editId) {
      var up = await SB.from("trades").update(row).eq("id", state.editId).select().single();
      if (up.error) { window.alert("No se pudo actualizar la operación: " + up.error.message); return; }
      var updated = coerceTrade(up.data);
      state.trades = state.trades.map(function (t) { return t.id === updated.id ? updated : t; });
    } else {
      var res = await SB.from("trades").insert(row).select().single();
      if (res.error) { window.alert("No se pudo guardar la operación: " + res.error.message); return; }
      state.trades = [coerceTrade(res.data)].concat(state.trades);
    }
    closeAdd();
    render();
  }
  function openEdit(t) {
    state.editId = t.id;
    state.draft = { symbol: t.symbol, type: t.type, side: t.side, contracts: t.contracts, entry: t.entry, exit: t.exit, date: t.date, setup: t.setup, emotion: t.emotion, rating: t.rating, note: t.note, account_id: t.account_id || "", tags: (t.tags || []).join(", "), mae: t.mae, mfe: t.mfe };
    state.selectedId = null;
    state.showAdd = true;
    render();
  }
  function select(id) { state.selectedId = id; render(); }
  function closeDetail() { state.selectedId = null; render(); }
  async function deleteSelected() {
    var id = state.selectedId;
    var res = await SB.from("trades").delete().eq("id", id);
    if (res.error) { window.alert("No se pudo eliminar: " + res.error.message); return; }
    state.trades = state.trades.filter(function (t) { return t.id !== id; });
    state.selectedId = null;
    render();
  }
  async function saveJournal() {
    var d = state.jdraft;
    if (!d.title.trim()) return;
    var row = { date: d.date, mood: d.mood, title: d.title.trim(), body: d.body, lesson: d.lesson };
    var res = await SB.from("journal").insert(row).select().single();
    if (res.error) { window.alert("No se pudo guardar la entrada: " + res.error.message); return; }
    state.journal = [coerceJournal(res.data)].concat(state.journal);
    closeJournalAdd();
    render();
  }
  function setView(v) { state.view = v; render(); }
  function shiftMonth(dir) {
    var p = state.calMonth.split("-").map(Number), y = p[0], m = p[1];
    m += dir; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    state.calMonth = y + "-" + pad(m); render();
  }
  async function saveAccount() {
    var d = state.accountDraft;
    if (!d.name.trim()) return;
    var row = {
      name: d.name.trim(), kind: d.kind, firm: d.firm || null, balance: Number(d.balance) || 0, currency: d.currency || "USD",
      phase: d.phase || null, status: d.status,
      profit_target: d.profit_target === "" ? null : Number(d.profit_target),
      max_drawdown: d.max_drawdown === "" ? null : Number(d.max_drawdown), notes: d.notes,
    };
    if (state.accountEditId) {
      var up = await SB.from("accounts").update(row).eq("id", state.accountEditId).select().single();
      if (up.error) { window.alert("No se pudo actualizar la cuenta: " + up.error.message); return; }
      var u = coerceAccount(up.data);
      state.accounts = state.accounts.map(function (a) { return a.id === u.id ? u : a; });
    } else {
      var res = await SB.from("accounts").insert(row).select().single();
      if (res.error) { window.alert("No se pudo crear la cuenta: " + res.error.message); return; }
      state.accounts = [coerceAccount(res.data)].concat(state.accounts);
    }
    closeAccountAdd();
    render();
  }
  async function deleteAccount() {
    var id = state.accountEditId;
    if (!id) return;
    if (!window.confirm("¿Eliminar esta cuenta? Las operaciones asociadas se conservarán pero quedarán sin cuenta.")) return;
    var res = await SB.from("accounts").delete().eq("id", id);
    if (res.error) { window.alert("No se pudo eliminar: " + res.error.message); return; }
    state.accounts = state.accounts.filter(function (a) { return a.id !== id; });
    state.trades = state.trades.map(function (t) { return t.account_id === id ? Object.assign({}, t, { account_id: null }) : t; });
    closeAccountAdd();
    render();
  }
  function openAccountAdd() { state.accountEditId = null; state.accountDraft = blankAccountDraft(); state.showAccountAdd = true; renderModal(); }
  function openAccountEdit(a) {
    state.accountEditId = a.id;
    state.accountDraft = { name: a.name, kind: a.kind, firm: a.firm, balance: a.balance, currency: a.currency, phase: a.phase, status: a.status, profit_target: a.profit_target, max_drawdown: a.max_drawdown, notes: a.notes };
    state.showAccountAdd = true; renderModal();
  }
  function closeAccountAdd() { state.showAccountAdd = false; state.accountEditId = null; renderModal(); }
  function accountStats(accId) {
    var ts = state.trades.filter(function (t) { return t.account_id === accId; });
    var wins = ts.filter(function (t) { return t.pnl > 0; }).length;
    var net = ts.reduce(function (a, t) { return a + t.pnl; }, 0);
    return { count: ts.length, net: net, winRate: ts.length ? Math.round(wins / ts.length * 100) : 0 };
  }
  function accountName(accId) {
    if (!accId) return null;
    var a = state.accounts.find(function (x) { return x.id === accId; });
    return a ? a.name : null;
  }

  function openAdd() { state.editId = null; state.draft = blankDraft(); state.showAdd = true; renderModal(); }
  function closeAdd() { state.showAdd = false; state.editId = null; renderModal(); }
  function openJournalAdd() { state.jdraft = blankJournalDraft(); state.showJournalAdd = true; renderModal(); }
  function closeJournalAdd() { state.showJournalAdd = false; renderModal(); }

  // ---------- metrics & grouping ----------
  function metrics() {
    var ts = state.trades, n = ts.length;
    var wins = ts.filter(function (t) { return t.pnl > 0; });
    var losses = ts.filter(function (t) { return t.pnl < 0; });
    var gp = wins.reduce(function (a, t) { return a + t.pnl; }, 0);
    var gl = Math.abs(losses.reduce(function (a, t) { return a + t.pnl; }, 0));
    var net = gp - gl, wr = n ? wins.length / n : 0;
    return { n: n, net: net, wr: wr, wins: wins.length, losses: losses.length, pf: gl ? gp / gl : (gp > 0 ? 99 : 0), exp: n ? net / n : 0, gp: gp, gl: gl };
  }
  function group(keyFn) {
    var m = {};
    state.trades.forEach(function (t) {
      var k = keyFn(t);
      if (!m[k]) m[k] = { key: k, pnl: 0, count: 0, wins: 0 };
      m[k].pnl += t.pnl; m[k].count++; if (t.pnl > 0) m[k].wins++;
    });
    return m;
  }

  // ---------- charts (inline SVG) ----------
  function equityPts() {
    var arr = state.trades.slice().sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
    var c = 0;
    return arr.map(function (t, i) { c += t.pnl; return { i: i, v: c }; });
  }
  function equityEl() {
    var pts = equityPts();
    if (!pts.length) return null;
    var w = 1000, h = 250, pl = 10, pr = 10, pt = 16, pb = 10;
    var xs = function (i) { return pl + (pts.length <= 1 ? 0 : (i / (pts.length - 1)) * (w - pl - pr)); };
    var vals = pts.map(function (p) { return p.v; }).concat([0]);
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    var sp = (mx - mn) || 1;
    var ys = function (v) { return pt + (h - pt - pb) - ((v - mn) / sp) * (h - pt - pb); };
    var line = pts.map(function (p, i) { return (i ? "L" : "M") + xs(i).toFixed(1) + " " + ys(p.v).toFixed(1); }).join(" ");
    var area = "M" + xs(0).toFixed(1) + " " + ys(mn).toFixed(1) + " " + pts.map(function (p, i) { return "L" + xs(i).toFixed(1) + " " + ys(p.v).toFixed(1); }).join(" ") + " L" + xs(pts.length - 1).toFixed(1) + " " + ys(mn).toFixed(1) + " Z";
    var last = pts[pts.length - 1], up = last.v >= 0, col = up ? "#16915B" : "#D6483B";
    var grad = s("linearGradient", { id: "eqg", x1: 0, y1: 0, x2: 0, y2: 1 },
      s("stop", { offset: "0%", "stop-color": col, "stop-opacity": .16 }),
      s("stop", { offset: "100%", "stop-color": col, "stop-opacity": 0 }));
    var zero = (mn < 0 && mx > 0) ? s("line", { x1: pl, y1: ys(0), x2: w - pr, y2: ys(0), stroke: "#E2DDD3", "stroke-width": 1, "stroke-dasharray": "4 5" }) : null;
    return s("svg", { viewBox: "0 0 " + w + " " + h, style: "width:100%;height:auto;display:block;" },
      s("defs", null, grad), zero,
      s("path", { d: area, fill: "url(#eqg)" }),
      s("path", { d: line, fill: "none", stroke: col, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }),
      s("circle", { cx: xs(pts.length - 1), cy: ys(last.v), r: 3.5, fill: col })
    );
  }
  function barsEl(data, opts) {
    opts = opts || {};
    var w = opts.w || 480, h = opts.h || 232;
    if (!data.length) return null;
    var pl = 8, pr = 8, pt = 22, pb = 30, plotH = h - pt - pb;
    var maxPos = Math.max.apply(null, [0].concat(data.map(function (d) { return d.value; })));
    var maxNeg = Math.max.apply(null, [0].concat(data.map(function (d) { return -d.value; })));
    var total = (maxPos + maxNeg) || 1, k = plotH / total, zeroY = pt + maxPos * k;
    var bw = (w - pl - pr) / data.length, barW = Math.min(48, bw * 0.56);
    var kids = [s("line", { x1: pl, y1: zeroY, x2: w - pr, y2: zeroY, stroke: "#E2DDD3", "stroke-width": 1 })];
    data.forEach(function (d, i) {
      var cx = pl + bw * i + bw / 2, pos = d.value >= 0, bh = Math.abs(d.value) * k;
      var y = pos ? zeroY - bh : zeroY, col = pos ? "#16915B" : "#D6483B";
      kids.push(s("rect", { x: cx - barW / 2, y: y, width: barW, height: Math.max(bh, 1), rx: 3, fill: col, opacity: .92 }));
      kids.push(s("text", { x: cx, y: pos ? y - 6 : y + bh + 13, "text-anchor": "middle", "font-size": 10.5, "font-family": "Geist Mono, monospace", "font-weight": 600, fill: col }, signed(d.value)));
      kids.push(s("text", { x: cx, y: h - 9, "text-anchor": "middle", "font-size": 11, "font-family": "Geist, sans-serif", fill: "#807B72" }, d.label));
    });
    return s("svg", { viewBox: "0 0 " + w + " " + h, style: "width:100%;height:auto;display:block;" }, kids);
  }

  // ---------- shared style fragments ----------
  function sideStyle(side) {
    return "display:inline-flex;align-items:center;justify-content:center;width:24px;height:22px;border-radius:6px;font-size:11px;font-weight:700;font-family:Geist Mono,monospace;" +
      (side === "long" ? "background:#E8F3EC;color:#16915B;" : "background:#FBEAE7;color:#D6483B;");
  }
  function setupStyleOf() { return "display:inline-flex;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;background:#F1EDE5;color:#54514A;"; }
  function emoStyleOf(em) {
    var map = { Confiado: "#E8F3EC;color:#16915B", Tranquilo: "#EAF0F7;color:#3D6FB0", Ansioso: "#FBF1E6;color:#C77B2A", FOMO: "#FBEAE7;color:#D6483B" };
    return "display:inline-flex;padding:4px 11px;border-radius:20px;font-size:12px;font-weight:600;background:#" + (map[em] || "F1EDE5;color:#54514A");
  }
  function buildRow(t) {
    return {
      id: t.id, onClick: function () { select(t.id); }, dateStr: fmtDate(t.date), symbol: t.symbol,
      instr: t.type === "option" ? "Opc" : "Fut", sideShort: t.side === "long" ? "L" : "S", sideStyle: sideStyle(t.side),
      contracts: t.contracts, entryStr: num(t.entry), exitStr: num(t.exit), setup: t.setup, setupStyle: setupStyleOf(t.setup),
      pnlStr: signed(t.pnl), pnlColor: pnlColor(t.pnl), stars: stars(t.rating), emotion: t.emotion, emoStyle: emoStyleOf(t.emotion),
    };
  }
  function exportBtnStyle() { return "display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:#16181C;background:#fff;border:1px solid #E2DDD3;border-radius:9px;padding:8px 12px;"; }
  function emptyCard(title, sub) {
    return h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:48px 24px;text-align:center;" },
      h("div", { style: "font-size:15px;font-weight:600;margin-bottom:6px;" }, title),
      h("div", { style: "font-size:13px;color:#A39E94;" }, sub));
  }

  // ===================================================================
  // Render entry
  // ===================================================================
  function render() {
    var root = document.getElementById("app");
    root.innerHTML = "";
    if (state.booting) { root.appendChild(centerWrap(h("div", { style: "color:#A39E94;font-size:14px;" }, "Cargando…"))); renderModal(); return; }
    if (!state.user) { root.appendChild(authScreen()); renderModal(); return; }
    root.appendChild(appShell());
    renderModal();
  }
  function centerWrap(child) {
    return h("div", { style: "display:flex;height:100vh;width:100%;align-items:center;justify-content:center;background:#FAF8F4;font-family:Geist,sans-serif;" }, child);
  }

  // ---------- auth screen ----------
  function authScreen() {
    var signup = state.authMode === "signup";
    var emailInput = h("input", { type: "email", placeholder: "tu@email.com", autocomplete: "email", style: authInputStyle(), onInput: function (e) { state.authEmail = e.target.value; } });
    emailInput.value = state.authEmail;
    var passInput = h("input", { type: "password", placeholder: signup ? "Mínimo 8 caracteres" : "Tu contraseña", autocomplete: signup ? "new-password" : "current-password", style: authInputStyle(), onInput: function (e) { state.authPass = e.target.value; } });
    passInput.value = state.authPass;
    passInput.addEventListener("keydown", function (e) { if (e.key === "Enter") doAuth(); });
    emailInput.addEventListener("keydown", function (e) { if (e.key === "Enter") passInput.focus(); });

    var submit = h("button", {
      onClick: doAuth,
      style: "width:100%;padding:12px;border-radius:10px;font-weight:600;font-size:14px;margin-top:4px;" + (state.authBusy ? "background:#CFC9BD;color:#fff;cursor:wait;" : "background:#16181C;color:#fff;")
    }, state.authBusy ? "Un momento…" : (signup ? "Crear cuenta" : "Entrar"));

    var toggle = h("button", {
      style: "background:none;border:none;color:#807B72;font-size:13px;margin-top:14px;width:100%;text-align:center;",
      onClick: function () { state.authMode = signup ? "login" : "signup"; state.authError = ""; render(); }
    }, signup ? "¿Ya tienes cuenta? Inicia sesión" : "¿Nuevo aquí? Crea tu cuenta");

    var card = h("div", { class: "dc-modal", style: "width:380px;max-width:92vw;background:#fff;border:1px solid #ECE7DD;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.10);padding:30px 28px;" },
      h("div", { style: "display:flex;align-items:center;gap:11px;margin-bottom:22px;" },
        h("div", { style: "width:34px;height:34px;border-radius:9px;background:#16181C;display:flex;align-items:center;justify-content:center;flex:none;" },
          icon('<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><rect x="4" y="9" width="3.4" height="11" rx="1" fill="#16915B"/><line x1="5.7" y1="5" x2="5.7" y2="9" stroke="#16915B" stroke-width="1.6"/><line x1="5.7" y1="20" x2="5.7" y2="22.5" stroke="#16915B" stroke-width="1.6"/><rect x="13" y="6" width="3.4" height="9" rx="1" fill="#D6483B"/><line x1="14.7" y1="3" x2="14.7" y2="6" stroke="#D6483B" stroke-width="1.6"/><line x1="14.7" y1="15" x2="14.7" y2="18" stroke="#D6483B" stroke-width="1.6"/></svg>')),
        h("div", { style: "line-height:1.05;" },
          h("div", { style: "font-weight:700;font-size:17px;letter-spacing:-0.3px;" }, "Bitácora"),
          h("div", { style: "font-size:11px;color:#A39E94;letter-spacing:.3px;margin-top:3px;" }, "TRADING JOURNAL"))),
      h("div", { style: "font-size:15px;font-weight:600;margin-bottom:3px;" }, signup ? "Crea tu cuenta" : "Bienvenido de nuevo"),
      h("div", { style: "font-size:13px;color:#A39E94;margin-bottom:18px;" }, signup ? "Tu propio diario de trading, privado." : "Entra para ver tus operaciones."),
      h("label", { style: authLabelStyle() }, "Email"), emailInput,
      h("label", { style: authLabelStyle() }, "Contraseña"), passInput,
      state.authError ? h("div", { style: "margin-top:12px;font-size:12.5px;color:#D6483B;background:#FCF1EF;border:1px solid #F2D9D5;border-radius:9px;padding:9px 11px;" }, state.authError) : null,
      h("div", { style: "margin-top:18px;" }, submit),
      toggle
    );
    return centerWrap(card);
  }
  function authInputStyle() { return "width:100%;padding:11px 12px;border:1px solid #E2DDD3;border-radius:9px;font-size:14px;margin-top:6px;margin-bottom:4px;"; }
  function authLabelStyle() { return "display:block;font-size:12px;font-weight:600;color:#54514A;margin-top:12px;"; }

  // ---------- app shell ----------
  function appShell() {
    return h("div", { style: "display:flex;height:100vh;width:100%;overflow:hidden;background:#FAF8F4;font-family:Geist,sans-serif;color:#16181C;-webkit-font-smoothing:antialiased;font-size:14px;" },
      sidebar(), mainColumn(), detailDrawer());
  }

  function sidebar() {
    var m = metrics();
    var acctBal = 25000 + m.net;
    var today = todayISO();
    var todayPnl = state.trades.filter(function (t) { return t.date === today; }).reduce(function (a, t) { return a + t.pnl; }, 0);
    var navBase = "display:flex;align-items:center;gap:11px;width:100%;text-align:left;padding:9px 11px;border-radius:9px;font-size:13.5px;font-weight:500;transition:background .12s;";
    var navStyle = function (k) { return navBase + (state.view === k ? "background:#16181C;color:#fff;font-weight:600;" : "color:#54514A;background:none;"); };
    var navCountStyle = "margin-left:auto;font-size:11px;font-weight:600;color:#A39E94;font-family:Geist Mono,monospace;";

    function navItem(view, iconSvg, label, count) {
      var children = [icon(iconSvg), h("span", null, label)];
      if (count != null) children.push(h("span", { style: navCountStyle }, count));
      return h("button", { style: navStyle(view), onClick: function () { setView(view); }, hoverBg: state.view === view ? "" : "#FAF8F4" }, children);
    }

    return h("aside", { style: "width:240px;flex:none;display:flex;flex-direction:column;background:#FFFFFF;border-right:1px solid #ECE7DD;padding:20px 14px;" },
      h("div", { style: "display:flex;align-items:center;gap:10px;padding:6px 8px 22px 8px;" },
        h("div", { style: "width:30px;height:30px;border-radius:8px;background:#16181C;display:flex;align-items:center;justify-content:center;flex:none;" },
          icon('<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="4" y="9" width="3.4" height="11" rx="1" fill="#16915B"/><line x1="5.7" y1="5" x2="5.7" y2="9" stroke="#16915B" stroke-width="1.6"/><line x1="5.7" y1="20" x2="5.7" y2="22.5" stroke="#16915B" stroke-width="1.6"/><rect x="13" y="6" width="3.4" height="9" rx="1" fill="#D6483B"/><line x1="14.7" y1="3" x2="14.7" y2="6" stroke="#D6483B" stroke-width="1.6"/><line x1="14.7" y1="15" x2="14.7" y2="18" stroke="#D6483B" stroke-width="1.6"/></svg>')),
        h("div", { style: "line-height:1;" },
          h("div", { style: "font-weight:700;font-size:15px;letter-spacing:-0.2px;" }, "Bitácora"),
          h("div", { style: "font-size:11px;color:#A39E94;margin-top:3px;letter-spacing:.3px;" }, "TRADING JOURNAL"))),
      h("nav", { style: "display:flex;flex-direction:column;gap:2px;" },
        navItem("dashboard", '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>', "Resumen"),
        navItem("trades", '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r="1.3" fill="currentColor" stroke="none"/></svg>', "Operaciones", state.trades.length),
        navItem("calendar", '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4.5" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2.5" x2="8" y2="6"/><line x1="16" y1="2.5" x2="16" y2="6"/></svg>', "Calendario"),
        navItem("analytics", '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><line x1="4" y1="20" x2="4" y2="13"/><line x1="10" y1="20" x2="10" y2="5"/><line x1="16" y1="20" x2="16" y2="9"/><line x1="22" y1="20" x2="22" y2="15"/></svg>', "Analítica"),
        navItem("journal", '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v14H6.5A2.5 2.5 0 0 0 4 19.5z"/><line x1="4" y1="19.5" x2="4" y2="5.5"/><line x1="20" y1="17" x2="20" y2="21"/><path d="M6.5 21H20"/></svg>', "Diario"),
        navItem("accounts", '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2" y="5" width="20" height="14" rx="2.5"/><line x1="2" y1="10" x2="22" y2="10"/></svg>', "Cuentas", state.accounts.length)),
      h("div", { style: "margin-top:auto;display:flex;flex-direction:column;gap:12px;" },
        h("div", { style: "border:1px solid #ECE7DD;border-radius:12px;padding:14px;background:#FBFAF7;" },
          h("div", { style: "font-size:11px;color:#A39E94;letter-spacing:.4px;text-transform:uppercase;" }, "Cuenta · Sim"),
          h("div", { style: "font-family:'Geist Mono',monospace;font-size:21px;font-weight:600;margin-top:6px;letter-spacing:-0.5px;" }, money(acctBal)),
          h("div", { style: "display:flex;align-items:center;gap:6px;margin-top:8px;" },
            h("span", { style: "font-size:11px;color:#807B72;" }, "Hoy"),
            h("span", { style: "font-family:Geist Mono,monospace;font-size:12.5px;font-weight:600;" + pnlColor(todayPnl) }, signed(todayPnl)))),
        h("div", { style: "display:flex;align-items:center;gap:9px;padding:4px 6px;" },
          h("div", { style: "width:28px;height:28px;border-radius:50%;background:#16181C;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex:none;" }, (state.user.email || "?").charAt(0).toUpperCase()),
          h("div", { style: "min-width:0;flex:1;" }, h("div", { style: "font-size:12px;color:#54514A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" }, state.user.email)),
          h("button", { title: "Cerrar sesión", onClick: logout, style: "width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#807B72;flex:none;", hoverBg: "#FAF8F4" },
            icon('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>'))))
    );
  }

  var TITLES = { dashboard: "Resumen", trades: "Operaciones", calendar: "Calendario de resultados", analytics: "Analítica", journal: "Diario de trading", accounts: "Cuentas" };

  function mainColumn() {
    return h("main", { style: "flex:1;display:flex;flex-direction:column;min-width:0;" },
      header(),
      h("div", { style: "flex:1;overflow-y:auto;padding:28px;" }, state.loadingData ? loadingBody() : viewBody()));
  }
  function loadingBody() { return h("div", { style: "max-width:1180px;margin:0 auto;color:#A39E94;font-size:14px;padding:40px;text-align:center;" }, "Cargando tus datos…"); }

  function dateRangeLabel() {
    if (!state.trades.length) return "Sin operaciones aún";
    var dates = state.trades.map(function (t) { return t.date; }).sort();
    var a = dates[0], b = dates[dates.length - 1];
    return fmtDateLong(a) + " – " + fmtDateLong(b);
  }

  function header() {
    return h("header", { style: "height:62px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 28px;border-bottom:1px solid #ECE7DD;background:rgba(250,248,244,.85);backdrop-filter:blur(8px);" },
      h("div", null, h("div", { style: "font-size:17px;font-weight:600;letter-spacing:-0.3px;" }, TITLES[state.view])),
      h("div", { style: "display:flex;align-items:center;gap:12px;" },
        h("div", { style: "display:flex;align-items:center;gap:7px;font-size:12.5px;color:#807B72;padding:7px 12px;border:1px solid #ECE7DD;border-radius:9px;background:#fff;" },
          icon('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4.5" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>'),
          dateRangeLabel()),
        h("button", { style: "display:flex;align-items:center;gap:7px;background:#16181C;color:#fff;font-weight:600;font-size:13px;padding:9px 15px;border-radius:9px;box-shadow:0 1px 2px rgba(0,0,0,.12);", onClick: openAdd },
          icon('<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'),
          "Nueva operación")));
  }

  function viewBody() {
    switch (state.view) {
      case "dashboard": return dashboardView();
      case "trades": return tradesView();
      case "calendar": return calendarView();
      case "analytics": return analyticsView();
      case "journal": return journalView();
      case "accounts": return accountsView();
    }
  }

  // ---------- cuentas ----------
  var KIND_LABEL = { fondeo: "Fondeo", live: "Live", demo: "Demo" };
  function kindStyle(kind) {
    var map = { fondeo: "#EAF0F7;color:#3D6FB0", live: "#E8F3EC;color:#16915B", demo: "#F1EDE5;color:#54514A" };
    return "display:inline-flex;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#" + (map[kind] || "F1EDE5;color:#54514A");
  }
  function statusStyle(status) {
    var map = { activa: "#E8F3EC;color:#16915B", aprobada: "#E8F3EC;color:#16915B", quemada: "#FBEAE7;color:#D6483B", pausada: "#FBF1E6;color:#C77B2A", cerrada: "#F1EDE5;color:#54514A" };
    return "display:inline-flex;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#" + (map[status] || "F1EDE5;color:#54514A");
  }
  function accountsView() {
    var topBar = h("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;" },
      h("div", { style: "font-size:13px;color:#A39E94;" }, state.accounts.length + (state.accounts.length === 1 ? " cuenta" : " cuentas")),
      h("button", { style: "display:flex;align-items:center;gap:7px;background:#16181C;color:#fff;font-weight:600;font-size:13px;padding:9px 15px;border-radius:9px;", onClick: openAccountAdd },
        icon('<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'), "Nueva cuenta"));
    if (!state.accounts.length) {
      return h("div", { style: "max-width:1080px;margin:0 auto;display:flex;flex-direction:column;gap:16px;" }, topBar,
        emptyCard("Sin cuentas todavía", "Crea tus cuentas de fondeo (prop firms) y lives para llevar el control de cada una por separado."));
    }
    var cards = state.accounts.map(function (a) {
      var st = accountStats(a.id);
      var rows = [];
      function row(label, value, valStyle) {
        return h("div", { style: "display:flex;align-items:center;justify-content:space-between;font-size:12.5px;padding:3px 0;" },
          h("span", { style: "color:#807B72;" }, label),
          h("span", { style: "font-family:'Geist Mono',monospace;font-weight:600;" + (valStyle || "") }, value));
      }
      rows.push(row("Balance", "$" + Number(a.balance).toLocaleString("en-US") + " " + a.currency));
      if (a.phase) rows.push(row("Fase", a.phase, "font-family:inherit;"));
      if (a.profit_target !== "") rows.push(row("Objetivo", "$" + Number(a.profit_target).toLocaleString("en-US")));
      if (a.max_drawdown !== "") rows.push(row("Drawdown máx.", "$" + Number(a.max_drawdown).toLocaleString("en-US")));
      rows.push(row("P&L registrado", signed(st.net), pnlColor(st.net)));
      rows.push(row("Operaciones", st.count + " · " + st.winRate + "% WR", "font-family:'Geist Mono',monospace;"));
      return h("button", { style: "text-align:left;background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:4px;", hoverBg: "#FBFAF7", onClick: function () { openAccountEdit(a); } },
        h("div", { style: "display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;gap:8px;" },
          h("div", { style: "min-width:0;" },
            h("div", { style: "font-size:15.5px;font-weight:700;letter-spacing:-0.2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" }, a.name),
            a.firm ? h("div", { style: "font-size:12px;color:#A39E94;margin-top:2px;" }, a.firm) : null),
          h("div", { style: "display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex:none;" },
            h("span", { style: kindStyle(a.kind) }, KIND_LABEL[a.kind] || a.kind),
            h("span", { style: statusStyle(a.status) }, a.status.charAt(0).toUpperCase() + a.status.slice(1)))),
        h("div", { style: "border-top:1px solid #F3EFE7;margin-top:4px;padding-top:8px;" }, rows));
    });
    return h("div", { style: "max-width:1080px;margin:0 auto;" }, topBar,
      h("div", { style: "display:grid;grid-template-columns:repeat(3,1fr);gap:16px;" }, cards));
  }

  // ---------- dashboard ----------
  function kpiCard(label, valueStyle, value, extra, sub) {
    var kids = [
      h("div", { style: "font-size:12px;color:#807B72;font-weight:500;" }, label),
      h("div", { style: "font-family:'Geist Mono',monospace;font-size:27px;font-weight:600;letter-spacing:-1px;margin-top:8px;" + (valueStyle || "") }, value),
    ];
    if (extra) kids.push(extra);
    kids.push(h("div", { style: "font-size:11.5px;color:#A39E94;margin-top:6px;" }, sub));
    return h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:18px;" }, kids);
  }
  function dashboardView() {
    if (!state.trades.length) {
      return h("div", { style: "max-width:1180px;margin:0 auto;" },
        emptyCard("Aún no tienes operaciones", "Pulsa “Nueva operación” arriba a la derecha para registrar tu primer trade."));
    }
    var m = metrics();
    var setupG = group(function (t) { return t.setup; });
    var setupData = Object.keys(setupG).map(function (k) { return { label: setupG[k].key, value: setupG[k].pnl }; });
    var recentRows = state.trades.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 6).map(buildRow);
    var winBar = h("div", { style: "display:flex;height:5px;border-radius:3px;overflow:hidden;margin-top:12px;background:#FBEAE7;" },
      h("div", { style: "height:100%;background:#16915B;width:" + Math.round(m.wr * 100) + "%;" }));
    return h("div", { style: "max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:18px;" },
      h("div", { style: "display:grid;grid-template-columns:repeat(4,1fr);gap:14px;" },
        kpiCard("P&L neto", pnlColor(m.net), signed(m.net), null, m.n + " operaciones cerradas"),
        kpiCard("Win rate", "", Math.round(m.wr * 100) + "%", winBar, m.wins + " ganadoras · " + m.losses + " perdedoras"),
        kpiCard("Profit factor", "", m.pf.toFixed(2), null, money(m.gp) + " / " + money(m.gl)),
        kpiCard("Esperanza / op.", pnlColor(m.exp), signed(m.exp), null, "media por operación")),
      h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:20px 20px 14px;" },
        h("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;" },
          h("div", { style: "font-size:14px;font-weight:600;" }, "Curva de capital"),
          h("div", { style: "font-size:12px;color:#807B72;font-family:'Geist Mono',monospace;" }, "acumulado · " + state.trades.length + " ops")),
        h("div", { style: "width:100%;" }, equityEl())),
      h("div", { style: "display:grid;grid-template-columns:1.25fr 1fr;gap:18px;" },
        recentPanel(recentRows),
        h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:18px;" },
          h("div", { style: "font-size:14px;font-weight:600;margin-bottom:4px;" }, "Rendimiento por setup"),
          h("div", { style: "font-size:12px;color:#A39E94;margin-bottom:8px;" }, "P&L acumulado"),
          h("div", null, barsEl(setupData, { w: 420, h: 210 })))));
  }
  function recentPanel(rows) {
    var list = rows.map(function (row) {
      return h("button", { style: "display:grid;grid-template-columns:54px 1fr auto;align-items:center;gap:12px;width:100%;text-align:left;padding:10px 14px;border-radius:10px;border:none;background:none;", hoverBg: "#FAF8F4", onClick: row.onClick },
        h("span", { style: row.sideStyle }, row.sideShort),
        h("span", { style: "min-width:0;" },
          h("span", { style: "font-weight:600;font-size:13.5px;" }, row.symbol),
          h("span", { style: "font-size:11.5px;color:#A39E94;margin-left:7px;" }, row.setup + " · " + row.dateStr)),
        h("span", { style: "font-family:'Geist Mono',monospace;font-size:13.5px;font-weight:600;" + row.pnlColor }, row.pnlStr));
    });
    return h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:6px 6px 6px;" },
      h("div", { style: "display:flex;align-items:center;justify-content:space-between;padding:14px 14px 10px;" },
        h("div", { style: "font-size:14px;font-weight:600;" }, "Últimas operaciones"),
        h("button", { style: "font-size:12px;color:#807B72;font-weight:500;", onClick: function () { setView("trades"); } }, "Ver todas →")),
      list);
  }

  // ---------- operaciones ----------
  function tradesView() {
    var ft = state.trades.slice();
    if (state.fResult === "win") ft = ft.filter(function (t) { return t.pnl > 0; });
    else if (state.fResult === "loss") ft = ft.filter(function (t) { return t.pnl < 0; });
    if (state.fSymbol !== "all") ft = ft.filter(function (t) { return t.symbol === state.fSymbol; });
    if (state.fSetup !== "all") ft = ft.filter(function (t) { return t.setup === state.fSetup; });
    if (state.fAccount !== "all") ft = ft.filter(function (t) { return (t.account_id || "none") === state.fAccount; });
    if (state.fTag !== "all") ft = ft.filter(function (t) { return (t.tags || []).indexOf(state.fTag) >= 0; });
    ft.sort(function (a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });
    var tradeRows = ft.map(buildRow);
    var symbolOpts = Object.keys(state.trades.reduce(function (acc, t) { acc[t.symbol] = 1; return acc; }, {})).sort();

    var fSeg = function (v, label) {
      return h("button", { style: "padding:6px 14px;border-radius:7px;font-size:12.5px;font-weight:600;" + (state.fResult === v ? "background:#fff;color:#16181C;box-shadow:0 1px 2px rgba(0,0,0,.08);" : "background:none;color:#807B72;"), onClick: function () { state.fResult = v; render(); } }, label);
    };
    var symbolSelect = h("select", { style: "font-size:12.5px;padding:8px 11px;border:1px solid #ECE7DD;border-radius:9px;background:#fff;font-weight:500;cursor:pointer;", onChange: function (ev) { state.fSymbol = ev.target.value; render(); } },
      [h("option", { value: "all" }, "Todos los símbolos")].concat(symbolOpts.map(function (sy) { return h("option", { value: sy }, sy); })));
    symbolSelect.value = state.fSymbol;
    var setupSelect = h("select", { style: "font-size:12.5px;padding:8px 11px;border:1px solid #ECE7DD;border-radius:9px;background:#fff;font-weight:500;cursor:pointer;", onChange: function (ev) { state.fSetup = ev.target.value; render(); } },
      h("option", { value: "all" }, "Todos los setups"), h("option", { value: "Ruptura" }, "Ruptura"), h("option", { value: "Reversión" }, "Reversión"), h("option", { value: "Pullback" }, "Pullback"));
    setupSelect.value = state.fSetup;
    var accountSelect = null;
    if (state.accounts.length) {
      accountSelect = h("select", { style: "font-size:12.5px;padding:8px 11px;border:1px solid #ECE7DD;border-radius:9px;background:#fff;font-weight:500;cursor:pointer;", onChange: function (ev) { state.fAccount = ev.target.value; render(); } },
        [h("option", { value: "all" }, "Todas las cuentas"), h("option", { value: "none" }, "Sin cuenta")].concat(state.accounts.map(function (a) { return h("option", { value: a.id }, a.name); })));
      accountSelect.value = state.fAccount;
    }
    var allTags = Object.keys(state.trades.reduce(function (acc, t) { (t.tags || []).forEach(function (tg) { acc[tg] = 1; }); return acc; }, {})).sort();
    var tagSelect = null;
    if (allTags.length) {
      tagSelect = h("select", { style: "font-size:12.5px;padding:8px 11px;border:1px solid #ECE7DD;border-radius:9px;background:#fff;font-weight:500;cursor:pointer;", onChange: function (ev) { state.fTag = ev.target.value; render(); } },
        [h("option", { value: "all" }, "Todas las etiquetas")].concat(allTags.map(function (tg) { return h("option", { value: tg }, tg); })));
      tagSelect.value = state.fTag;
    }

    var gridCols = "84px 60px 1fr 64px 92px 92px 110px 120px 96px";
    var headerCols = ["Fecha", "Lado", "Símbolo", "Cont.", "Entrada", "Salida", "Setup", "P&L", "Valor."];
    var headerRow = h("div", { style: "display:grid;grid-template-columns:" + gridCols + ";gap:8px;padding:11px 18px;border-bottom:1px solid #ECE7DD;font-size:11px;color:#A39E94;font-weight:600;letter-spacing:.3px;text-transform:uppercase;background:#FBFAF7;" },
      headerCols.map(function (c, i) { return h("span", { style: (i === 3 || i === 4 || i === 5 || i === 7 || i === 8) ? "text-align:right;" : "" }, c); }));
    var bodyRows = tradeRows.map(function (row) {
      return h("button", { style: "display:grid;grid-template-columns:" + gridCols + ";gap:8px;align-items:center;width:100%;text-align:left;padding:13px 18px;border:none;border-bottom:1px solid #F3EFE7;background:none;font-size:13px;", hoverBg: "#FAF8F4", onClick: row.onClick },
        h("span", { style: "color:#807B72;font-family:'Geist Mono',monospace;font-size:12.5px;" }, row.dateStr),
        h("span", { style: row.sideStyle }, row.sideShort),
        h("span", null, h("span", { style: "font-weight:600;" }, row.symbol), h("span", { style: "font-size:11px;color:#A39E94;margin-left:6px;" }, row.instr)),
        h("span", { style: "text-align:right;font-family:'Geist Mono',monospace;color:#54514A;" }, row.contracts),
        h("span", { style: "text-align:right;font-family:'Geist Mono',monospace;color:#54514A;" }, row.entryStr),
        h("span", { style: "text-align:right;font-family:'Geist Mono',monospace;color:#54514A;" }, row.exitStr),
        h("span", null, h("span", { style: row.setupStyle }, row.setup)),
        h("span", { style: "text-align:right;font-family:'Geist Mono',monospace;font-weight:600;" + row.pnlColor }, row.pnlStr),
        h("span", { style: "text-align:right;color:#D8B23E;letter-spacing:1px;font-size:12px;" }, row.stars));
    });
    if (ft.length === 0) bodyRows.push(h("div", { style: "padding:48px;text-align:center;color:#A39E94;font-size:13px;" }, state.trades.length === 0 ? "Aún no tienes operaciones. Pulsa “Nueva operación”." : "Sin operaciones para este filtro."));

    return h("div", { style: "max-width:1180px;margin:0 auto;" },
      h("div", { style: "display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px;flex-wrap:wrap;" },
        h("div", { style: "display:flex;gap:4px;background:#F1EDE5;padding:4px;border-radius:10px;" }, fSeg("all", "Todas"), fSeg("win", "Ganadoras"), fSeg("loss", "Perdedoras")),
        h("div", { style: "display:flex;gap:10px;align-items:center;flex-wrap:wrap;" }, symbolSelect, setupSelect, accountSelect, tagSelect,
          h("span", { style: "font-size:12.5px;color:#807B72;font-family:'Geist Mono',monospace;" }, ft.length + " ops · " + signed(ft.reduce(function (a, t) { return a + t.pnl; }, 0))),
          h("button", { title: "Exportar a CSV las operaciones filtradas", onClick: function () { exportCSV(ft); }, style: exportBtnStyle(), hoverBg: "#FAF8F4" },
            icon('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'), "CSV"),
          h("button", { title: "Exportar CSV para impuestos (año + P&L)", onClick: function () { exportTax(ft); }, style: exportBtnStyle(), hoverBg: "#FAF8F4" }, "Tax"),
          h("button", { title: "Copia de seguridad de todos tus datos (JSON)", onClick: exportAll, style: exportBtnStyle(), hoverBg: "#FAF8F4" }, "Backup"))),
      h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;overflow:hidden;" }, headerRow, bodyRows));
  }

  // ---------- calendario ----------
  function calendarView() {
    var p = state.calMonth.split("-").map(Number), cy = p[0], cm = p[1];
    var dayMap = {}, monthNet = 0, monthDays = 0, monthGreen = 0;
    state.trades.forEach(function (t) { if (t.date.slice(0, 7) === state.calMonth) dayMap[t.date] = (dayMap[t.date] || 0) + t.pnl; });
    var maxAbs = 1;
    Object.keys(dayMap).forEach(function (key) { maxAbs = Math.max(maxAbs, Math.abs(dayMap[key])); });
    Object.keys(dayMap).forEach(function (key) { var v = dayMap[key]; monthNet += v; monthDays++; if (v > 0) monthGreen++; });
    var cntMap = {};
    state.trades.forEach(function (t) { if (t.date.slice(0, 7) === state.calMonth) cntMap[t.date] = (cntMap[t.date] || 0) + 1; });
    var first = new Date(cy, cm - 1, 1), startDow = (first.getDay() + 6) % 7, dim = new Date(cy, cm, 0).getDate();
    var cells = [];
    var cellBase = "border-radius:10px;padding:8px 9px;min-height:74px;display:flex;flex-direction:column;justify-content:space-between;border:1px solid #ECE7DD;";
    for (var i = 0; i < startDow; i++) cells.push(h("div", { style: "min-height:74px;border-radius:10px;background:transparent;" }));
    for (var dd = 1; dd <= dim; dd++) {
      var key = cy + "-" + pad(cm) + "-" + pad(dd);
      var v = dayMap[key], has = v !== undefined;
      var bg = "background:#fff;";
      if (has) { var inten = Math.min(.9, .16 + Math.abs(v) / maxAbs * 0.7); bg = v >= 0 ? "background:rgba(22,145,91," + inten.toFixed(2) + ");" : "background:rgba(214,72,59," + inten.toFixed(2) + ");"; }
      var light = has && Math.abs(v) / maxAbs > 0.35;
      var top = h("div", { style: "display:flex;justify-content:space-between;align-items:flex-start;" },
        h("span", { style: "font-size:12px;font-weight:600;" + (light ? "color:#fff;" : "color:#807B72;") }, dd),
        has ? h("span", { style: "font-size:9.5px;color:#A39E94;font-family:'Geist Mono',monospace;" }, (cntMap[key] || 0) + " op") : null);
      var pnlLine = has ? h("div", { style: "font-family:'Geist Mono',monospace;font-size:13px;font-weight:600;" + (light ? "color:#fff;" : pnlColor(v)) }, signed(v)) : null;
      cells.push(h("div", { style: cellBase + bg + (has ? "border-color:transparent;" : "") }, top, pnlLine));
    }
    while (cells.length % 7) cells.push(h("div", { style: "min-height:74px;" }));
    var monthLabel = MESL[cm - 1].charAt(0).toUpperCase() + MESL[cm - 1].slice(1) + " " + cy;
    var weekdayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    return h("div", { style: "max-width:1100px;margin:0 auto;" },
      h("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;" },
        h("div", { style: "display:flex;align-items:center;gap:14px;" },
          h("button", { style: "width:34px;height:34px;border:1px solid #ECE7DD;border-radius:9px;background:#fff;display:flex;align-items:center;justify-content:center;", hoverBg: "#FAF8F4", onClick: function () { shiftMonth(-1); } }, icon('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>')),
          h("div", { style: "font-size:18px;font-weight:600;min-width:160px;text-align:center;" }, monthLabel),
          h("button", { style: "width:34px;height:34px;border:1px solid #ECE7DD;border-radius:9px;background:#fff;display:flex;align-items:center;justify-content:center;", hoverBg: "#FAF8F4", onClick: function () { shiftMonth(1); } }, icon('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>'))),
        h("div", { style: "display:flex;gap:22px;" },
          statBlock("P&L del mes", signed(monthNet), pnlColor(monthNet)),
          statBlock("Días op.", monthDays, ""),
          statBlock("Días verdes", monthGreen, "color:#16915B;"))),
      h("div", { style: "display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:8px;" },
        weekdayLabels.map(function (w) { return h("div", { style: "text-align:center;font-size:11px;color:#A39E94;font-weight:600;letter-spacing:.4px;text-transform:uppercase;" }, w); })),
      h("div", { style: "display:grid;grid-template-columns:repeat(7,1fr);gap:8px;" }, cells));
  }
  function statBlock(label, value, valueStyle) {
    return h("div", null,
      h("div", { style: "font-size:11px;color:#807B72;" }, label),
      h("div", { style: "font-family:'Geist Mono',monospace;font-size:18px;font-weight:600;" + (valueStyle || "") }, value));
  }

  // ---------- analítica ----------
  function analyticsView() {
    if (!state.trades.length) {
      return h("div", { style: "max-width:1180px;margin:0 auto;" }, emptyCard("Sin datos para analizar", "Registra operaciones y aquí verás tu curva de capital y tu rendimiento por día, emoción y símbolo."));
    }
    var wdNames = ["Lun", "Mar", "Mié", "Jue", "Vie"], wdG = {};
    wdNames.forEach(function (w) { wdG[w] = 0; });
    state.trades.forEach(function (t) { var dow = new Date(t.date + "T12:00:00").getDay(); var idx = dow - 1; if (idx >= 0 && idx < 5) wdG[wdNames[idx]] += t.pnl; });
    var weekdayData = wdNames.map(function (w) { return { label: w, value: wdG[w] }; });
    var emoOrder = ["Tranquilo", "Confiado", "Ansioso", "FOMO"], emoG = group(function (t) { return t.emotion; });
    var emotionData = emoOrder.filter(function (k) { return emoG[k]; }).map(function (k) { return { label: k, value: emoG[k].pnl }; });
    var symG = group(function (t) { return t.symbol; });
    var symArr = Object.keys(symG).map(function (k) { return symG[k]; }).sort(function (a, b) { return b.pnl - a.pnl; });
    var symMax = Math.max.apply(null, [1].concat(symArr.map(function (x) { return Math.abs(x.pnl); })));
    var symbolStats = symArr.map(function (x) {
      return { symbol: x.key, winRate: Math.round(x.wins / x.count * 100) + "%", count: x.count + " ops", pnlStr: signed(x.pnl), pnlColor: pnlColor(x.pnl), barW: (Math.abs(x.pnl) / symMax * 100).toFixed(0) + "%", barBg: x.pnl >= 0 ? "background:#16915B;" : "background:#D6483B;" };
    });
    var tagG = {};
    state.trades.forEach(function (t) { (t.tags || []).forEach(function (tg) { if (!tagG[tg]) tagG[tg] = { key: tg, pnl: 0, count: 0, wins: 0 }; tagG[tg].pnl += t.pnl; tagG[tg].count++; if (t.pnl > 0) tagG[tg].wins++; }); });
    var tagArr = Object.keys(tagG).map(function (k) { return tagG[k]; }).sort(function (a, b) { return b.pnl - a.pnl; });
    var tagMax = Math.max.apply(null, [1].concat(tagArr.map(function (x) { return Math.abs(x.pnl); })));
    var tagStats = tagArr.map(function (x) {
      return { tag: x.key, winRate: Math.round(x.wins / x.count * 100) + "%", count: x.count + " ops", pnlStr: signed(x.pnl), pnlColor: pnlColor(x.pnl), barW: (Math.abs(x.pnl) / tagMax * 100).toFixed(0) + "%", barBg: x.pnl >= 0 ? "background:#3D6FB0;" : "background:#D6483B;" };
    });
    return h("div", { style: "max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:18px;" },
      h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:20px;" },
        h("div", { style: "font-size:14px;font-weight:600;margin-bottom:10px;" }, "Curva de capital"),
        h("div", null, equityEl())),
      h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:18px;" },
        analyticsCard("P&L por día de la semana", "acumulado por sesión", barsEl(weekdayData, { w: 460, h: 226 })),
        analyticsCard("P&L por emoción", "psicología vs. resultado", barsEl(emotionData, { w: 460, h: 226 }))),
      h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:18px;" },
        h("div", { style: "font-size:14px;font-weight:600;margin-bottom:12px;" }, "Rendimiento por símbolo"),
        h("div", { style: "display:flex;flex-direction:column;gap:11px;" },
          symbolStats.map(function (x) {
            return h("div", { style: "display:grid;grid-template-columns:62px 1fr 86px 92px;gap:14px;align-items:center;" },
              h("span", { style: "font-weight:600;font-size:13.5px;" }, x.symbol),
              h("div", { style: "height:8px;background:#F1EDE5;border-radius:4px;overflow:hidden;" }, h("div", { style: "height:100%;border-radius:4px;width:" + x.barW + ";" + x.barBg })),
              h("span", { style: "font-size:12.5px;color:#807B72;text-align:right;font-family:'Geist Mono',monospace;" }, x.winRate + " WR · " + x.count),
              h("span", { style: "font-family:'Geist Mono',monospace;font-weight:600;font-size:13.5px;text-align:right;" + x.pnlColor }, x.pnlStr));
          }))),
      tagStats.length ? h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:18px;" },
        h("div", { style: "font-size:14px;font-weight:600;margin-bottom:12px;" }, "P&L por etiqueta"),
        h("div", { style: "display:flex;flex-direction:column;gap:11px;" },
          tagStats.map(function (x) {
            return h("div", { style: "display:grid;grid-template-columns:minmax(80px,auto) 1fr 86px 92px;gap:14px;align-items:center;" },
              h("span", { style: "font-weight:600;font-size:13px;" }, x.tag),
              h("div", { style: "height:8px;background:#F1EDE5;border-radius:4px;overflow:hidden;" }, h("div", { style: "height:100%;border-radius:4px;width:" + x.barW + ";" + x.barBg })),
              h("span", { style: "font-size:12.5px;color:#807B72;text-align:right;font-family:'Geist Mono',monospace;" }, x.winRate + " WR · " + x.count),
              h("span", { style: "font-family:'Geist Mono',monospace;font-weight:600;font-size:13.5px;text-align:right;" + x.pnlColor }, x.pnlStr));
          }))) : null);
  }
  function analyticsCard(title, sub, chart) {
    return h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:18px;" },
      h("div", { style: "font-size:14px;font-weight:600;margin-bottom:2px;" }, title),
      h("div", { style: "font-size:12px;color:#A39E94;margin-bottom:8px;" }, sub),
      h("div", null, chart));
  }

  // ---------- diario ----------
  function journalView() {
    var moodColors = { Disciplinado: "#E8F3EC;color:#16915B", Enfocado: "#EAF0F7;color:#3D6FB0", Paciente: "#EAF0F7;color:#3D6FB0", Frustrado: "#FBEAE7;color:#D6483B", Codicioso: "#FBF1E6;color:#C77B2A", Neutral: "#F1EDE5;color:#54514A" };
    var topBar = h("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;" },
      h("div", { style: "font-size:13px;color:#A39E94;" }, state.journal.length + (state.journal.length === 1 ? " entrada" : " entradas")),
      h("button", { style: "display:flex;align-items:center;gap:7px;background:#fff;border:1px solid #E2DDD3;color:#16181C;font-weight:600;font-size:13px;padding:8px 13px;border-radius:9px;", hoverBg: "#FAF8F4", onClick: openJournalAdd },
        icon('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'), "Nueva entrada"));
    if (!state.journal.length) {
      return h("div", { style: "max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:14px;" }, topBar,
        emptyCard("Tu diario está vacío", "Escribe tu primera reflexión: cómo te sentiste, qué aprendiste, qué mejorar."));
    }
    var cards = state.journal.map(function (j) {
      var dayPnl = state.trades.filter(function (t) { return t.date === j.date; }).reduce(function (a, t) { return a + t.pnl; }, 0);
      var moodStyle = "display:inline-flex;padding:4px 11px;border-radius:20px;font-size:12px;font-weight:600;background:#" + (moodColors[j.mood] || "F1EDE5;color:#54514A");
      return h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:20px 22px;" },
        h("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;" },
          h("div", { style: "display:flex;align-items:center;gap:11px;" },
            h("span", { style: "font-size:13px;font-weight:600;color:#807B72;font-family:'Geist Mono',monospace;" }, fmtDateLong(j.date)),
            j.mood ? h("span", { style: moodStyle }, j.mood) : null),
          h("span", { style: "font-family:'Geist Mono',monospace;font-weight:600;font-size:14px;" + pnlColor(dayPnl) }, signed(dayPnl))),
        h("div", { style: "font-size:15.5px;font-weight:600;margin-bottom:6px;letter-spacing:-0.2px;" }, j.title),
        j.body ? h("div", { style: "font-size:13.5px;color:#54514A;line-height:1.6;" }, j.body) : null,
        j.lesson ? h("div", { style: "display:flex;gap:9px;margin-top:14px;padding-top:13px;border-top:1px solid #F3EFE7;align-items:flex-start;" },
          icon('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16915B" stroke-width="2" style="flex:none;margin-top:1px;"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'),
          h("span", { style: "font-size:13px;color:#16181C;line-height:1.5;" }, h("b", { style: "font-weight:600;" }, "Lección: "), j.lesson)) : null);
    });
    return h("div", { style: "max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:14px;" }, topBar, cards);
  }

  // ---------- detail drawer ----------
  function detailDrawer() {
    var st = state.trades.find(function (t) { return t.id === state.selectedId; });
    if (!st) return null;
    var r = buildRow(st);
    var moveUnit = st.type === "option" ? " pts prima" : " pts";
    var mv = Number(st.exit) - Number(st.entry);
    var movePts = (mv >= 0 ? "+" : "−") + num(Math.abs(mv)) + moveUnit + " × " + st.contracts;
    var instr = st.type === "option" ? "Opción" : "Futuro";
    var note = st.note || "Sin notas.";
    function infoBox(label, value, valueStyle) {
      return h("div", { style: "border:1px solid #ECE7DD;border-radius:11px;padding:13px 15px;" },
        h("div", { style: "font-size:11px;color:#807B72;" }, label),
        h("div", { style: (valueStyle || "font-family:'Geist Mono',monospace;font-size:16px;font-weight:600;") + "margin-top:3px;" }, value));
    }
    return h("div", { style: "position:fixed;inset:0;z-index:40;" },
      h("div", { class: "dc-overlay", style: "position:absolute;inset:0;background:rgba(22,24,28,.28);", onClick: closeDetail }),
      h("div", { class: "dc-drawer", style: "position:absolute;top:0;right:0;height:100%;width:420px;background:#fff;border-left:1px solid #ECE7DD;box-shadow:-12px 0 40px rgba(0,0,0,.10);display:flex;flex-direction:column;" },
        h("div", { style: "display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid #ECE7DD;" },
          h("div", { style: "display:flex;align-items:center;gap:11px;" },
            h("span", { style: r.sideStyle }, r.sideShort),
            h("div", null, h("div", { style: "font-size:17px;font-weight:700;letter-spacing:-0.3px;" }, st.symbol),
              h("div", { style: "font-size:11.5px;color:#A39E94;" }, instr + " · " + fmtDateLong(st.date)))),
          h("button", { style: "width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#807B72;", hoverBg: "#FAF8F4", onClick: closeDetail }, icon('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'))),
        h("div", { style: "flex:1;overflow-y:auto;padding:22px;" },
          h("div", { style: "background:#FBFAF7;border:1px solid #ECE7DD;border-radius:13px;padding:18px;text-align:center;margin-bottom:18px;" },
            h("div", { style: "font-size:12px;color:#807B72;" }, "Resultado"),
            h("div", { style: "font-family:'Geist Mono',monospace;font-size:34px;font-weight:700;letter-spacing:-1.5px;margin-top:4px;" + pnlColor(st.pnl) }, signed(st.pnl)),
            h("div", { style: "font-size:12px;color:#A39E94;margin-top:4px;" }, movePts)),
          h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;" },
            infoBox("Entrada", num(st.entry)), infoBox("Salida", num(st.exit)),
            infoBox("Contratos", st.contracts), infoBox("Setup", st.setup, "font-size:14px;font-weight:600;")),
          h("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;" },
            h("div", null, h("div", { style: "font-size:11px;color:#807B72;margin-bottom:5px;" }, "Emoción"), h("span", { style: emoStyleOf(st.emotion) }, st.emotion)),
            h("div", { style: "text-align:right;" }, h("div", { style: "font-size:11px;color:#807B72;margin-bottom:5px;" }, "Valoración"), h("span", { style: "color:#D8B23E;letter-spacing:2px;font-size:15px;" }, stars(st.rating)))),
          (st.mae !== "" || st.mfe !== "") ? h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;" },
            infoBox("MAE", st.mae === "" ? "—" : num(st.mae)), infoBox("MFE", st.mfe === "" ? "—" : num(st.mfe))) : null,
          (st.tags && st.tags.length) ? h("div", { style: "margin-bottom:14px;" },
            h("div", { style: "font-size:11px;color:#807B72;margin-bottom:6px;" }, "Etiquetas"),
            h("div", { style: "display:flex;flex-wrap:wrap;gap:6px;" }, st.tags.map(function (tg) { return h("span", { style: "display:inline-flex;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;background:#EAF0F7;color:#3D6FB0;" }, tg); }))) : null,
          accountName(st.account_id) ? h("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding:11px 13px;border:1px solid #ECE7DD;border-radius:11px;background:#FBFAF7;" },
            h("span", { style: "font-size:11px;color:#807B72;" }, "Cuenta"),
            h("span", { style: "font-size:13px;font-weight:600;" }, accountName(st.account_id))) : null,
          h("div", { style: "margin-bottom:8px;font-size:11px;color:#807B72;" }, "Notas"),
          h("div", { style: "background:#FBFAF7;border:1px solid #ECE7DD;border-radius:11px;padding:15px;font-size:13.5px;line-height:1.6;color:#33312C;" }, note)),
        h("div", { style: "padding:16px 22px;border-top:1px solid #ECE7DD;display:flex;gap:10px;" },
          h("button", { style: "flex:1;padding:11px;border-radius:10px;border:none;background:#16181C;color:#fff;font-weight:600;font-size:13px;display:flex;align-items:center;justify-content:center;gap:7px;", onClick: function () { openEdit(st); } },
            icon('<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>'), "Editar"),
          h("button", { style: "flex:1;padding:11px;border-radius:10px;border:1px solid #F2D9D5;background:#FCF1EF;color:#D6483B;font-weight:600;font-size:13px;", hoverBg: "#FBEAE7", onClick: deleteSelected }, "Eliminar"))));
  }

  // ===================================================================
  // Modals (managed separately so typing doesn't lose input focus)
  // ===================================================================
  function renderModal() {
    var root = document.getElementById("modal-root");
    root.innerHTML = "";
    if (!state.user) return;
    if (state.showAdd) root.appendChild(addModal());
    else if (state.showJournalAdd) root.appendChild(journalModal());
    else if (state.showAccountAdd) root.appendChild(accountModal());
  }

  function draftPnl() {
    var d = state.draft;
    var valid = d.entry !== "" && d.exit !== "";
    var pnl = valid ? pnlOf({ symbol: d.symbol, type: d.type, side: d.side, contracts: Number(d.contracts) || 0, entry: Number(d.entry), exit: Number(d.exit) }) : 0;
    return { valid: valid, pnl: pnl };
  }
  function isSaveValid() { var d = state.draft; return d.symbol && d.entry !== "" && d.exit !== "" && Number(d.contracts) > 0; }

  function modalFrame(title, onClose, bodyChildren, footerChildren, width) {
    var modal = h("div", { class: "dc-modal", style: "position:relative;width:" + (width || 540) + "px;max-width:100%;max-height:92vh;overflow-y:auto;background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.22);" },
      h("div", { style: "display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #ECE7DD;position:sticky;top:0;background:#fff;border-radius:18px 18px 0 0;" },
        h("div", { style: "font-size:16px;font-weight:600;" }, title),
        h("button", { style: "width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#807B72;", hoverBg: "#FAF8F4", onClick: onClose }, icon('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'))),
      h("div", { style: "padding:22px 24px;display:flex;flex-direction:column;gap:16px;" }, bodyChildren),
      h("div", { style: "display:flex;gap:10px;padding:18px 24px;border-top:1px solid #ECE7DD;position:sticky;bottom:0;background:#fff;border-radius:0 0 18px 18px;" }, footerChildren));
    return h("div", { style: "position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:24px;" },
      h("div", { class: "dc-overlay", style: "position:absolute;inset:0;background:rgba(22,24,28,.34);", onClick: onClose }), modal);
  }
  function field(labelText, control) {
    return h("label", { style: "display:flex;flex-direction:column;gap:6px;" },
      h("span", { style: "font-size:12px;font-weight:600;color:#54514A;" }, labelText), control);
  }
  function fieldInput(getset, name, attrs) {
    var props = { onInput: function (e) { getset[name] = e.target.value; } };
    for (var k in attrs) props[k] = attrs[k];
    var el = h("input", props);
    el.value = getset[name];
    return el;
  }
  function fieldSelect(getset, name, options, onAfter) {
    var el = h("select", { style: "padding:10px 12px;border:1px solid #E2DDD3;border-radius:9px;font-size:14px;cursor:pointer;background:#fff;", onChange: function (e) { getset[name] = e.target.value; if (onAfter) onAfter(); } },
      options.map(function (o) { return h("option", { value: o[0] }, o[1]); }));
    el.value = getset[name];
    return el;
  }

  function addModal() {
    var inMono = "padding:10px 12px;border:1px solid #E2DDD3;border-radius:9px;font-size:14px;font-family:'Geist Mono',monospace;";
    var editing = state.editId != null;
    var previewSpan = h("span", { style: "font-family:'Geist Mono',monospace;font-size:18px;font-weight:600;" });
    var saveBtn = h("button", { onClick: saveTrade }, editing ? "Guardar cambios" : "Guardar operación");
    function refresh() {
      var dp = draftPnl();
      previewSpan.textContent = dp.valid ? signed(dp.pnl) : "—";
      previewSpan.style.cssText = "font-family:'Geist Mono',monospace;font-size:18px;font-weight:600;" + (dp.valid ? pnlColor(dp.pnl) : "color:#A39E94;");
      var valid = isSaveValid();
      saveBtn.style.cssText = "flex:1.4;padding:11px;border-radius:10px;font-weight:600;font-size:13.5px;" + (valid ? "background:#16181C;color:#fff;" : "background:#CFC9BD;color:#fff;cursor:not-allowed;");
    }
    var d = state.draft;
    var note = h("textarea", { rows: "3", placeholder: "¿Qué viste? ¿Seguiste el plan?", style: "padding:10px 12px;border:1px solid #E2DDD3;border-radius:9px;font-size:14px;line-height:1.5;resize:vertical;", onInput: function (e) { d.note = e.target.value; } });
    note.value = d.note;
    var body = [
      h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:14px;" },
        field("Símbolo", fieldInput(d, "symbol", { placeholder: "MES, NQ, SPY…", style: inMono + "text-transform:uppercase;", onInput: function (e) { d.symbol = e.target.value; refresh(); } })),
        field("Fecha", fieldInput(d, "date", { type: "date", style: inMono }))),
      h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:14px;" },
        field("Instrumento", fieldSelect(d, "type", [["future", "Futuro"], ["option", "Opción"]], refresh)),
        field("Dirección", fieldSelect(d, "side", [["long", "Largo"], ["short", "Corto"]], refresh))),
      h("div", { style: "display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;" },
        field("Contratos", fieldInput(d, "contracts", { type: "number", min: "1", style: inMono, onInput: function (e) { d.contracts = e.target.value; refresh(); } })),
        field("Entrada", fieldInput(d, "entry", { type: "number", step: "0.01", placeholder: "0.00", style: inMono, onInput: function (e) { d.entry = e.target.value; refresh(); } })),
        field("Salida", fieldInput(d, "exit", { type: "number", step: "0.01", placeholder: "0.00", style: inMono, onInput: function (e) { d.exit = e.target.value; refresh(); } }))),
      h("div", { style: "display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;" },
        field("Setup", fieldSelect(d, "setup", [["Ruptura", "Ruptura"], ["Reversión", "Reversión"], ["Pullback", "Pullback"]])),
        field("Emoción", fieldSelect(d, "emotion", [["Tranquilo", "Tranquilo"], ["Confiado", "Confiado"], ["Ansioso", "Ansioso"], ["FOMO", "FOMO"]])),
        field("Valoración", fieldSelect(d, "rating", [["1", "★"], ["2", "★★"], ["3", "★★★"], ["4", "★★★★"], ["5", "★★★★★"]]))),
      field("Cuenta", fieldSelect(d, "account_id", [["", "Sin cuenta"]].concat(state.accounts.map(function (a) { return [a.id, a.name + " · " + (KIND_LABEL[a.kind] || a.kind)]; })))),
      field("Etiquetas (separadas por comas)", fieldInput(d, "tags", { placeholder: "NY open, breakout, BTC, 5m…", style: "padding:10px 12px;border:1px solid #E2DDD3;border-radius:9px;font-size:14px;" })),
      h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:14px;" },
        field("MAE (excursión adversa)", fieldInput(d, "mae", { type: "number", step: "0.01", placeholder: "opcional", style: inMono })),
        field("MFE (excursión favorable)", fieldInput(d, "mfe", { type: "number", step: "0.01", placeholder: "opcional", style: inMono }))),
      field("Notas", note),
      h("div", { style: "display:flex;align-items:center;justify-content:space-between;background:#FBFAF7;border:1px solid #ECE7DD;border-radius:11px;padding:13px 16px;" },
        h("span", { style: "font-size:12.5px;color:#807B72;" }, "P&L estimado"), previewSpan),
    ];
    var footer = [
      h("button", { style: "flex:1;padding:11px;border-radius:10px;border:1px solid #E2DDD3;background:#fff;font-weight:600;font-size:13.5px;", hoverBg: "#FAF8F4", onClick: closeAdd }, "Cancelar"),
      saveBtn,
    ];
    var frame = modalFrame(editing ? "Editar operación" : "Nueva operación", closeAdd, body, footer, 540);
    refresh();
    return frame;
  }

  function journalModal() {
    var d = state.jdraft;
    var saveBtn = h("button", { onClick: saveJournal }, "Guardar entrada");
    function refresh() {
      var valid = d.title.trim().length > 0;
      saveBtn.style.cssText = "flex:1.4;padding:11px;border-radius:10px;font-weight:600;font-size:13.5px;" + (valid ? "background:#16181C;color:#fff;" : "background:#CFC9BD;color:#fff;cursor:not-allowed;");
    }
    var base = "padding:10px 12px;border:1px solid #E2DDD3;border-radius:9px;font-size:14px;";
    var bodyTa = h("textarea", { rows: "4", placeholder: "¿Cómo fue la sesión? ¿Seguiste el plan?", style: base + "line-height:1.5;resize:vertical;", onInput: function (e) { d.body = e.target.value; } });
    bodyTa.value = d.body;
    var lessonTa = h("textarea", { rows: "2", placeholder: "¿Qué aprendiste hoy?", style: base + "line-height:1.5;resize:vertical;", onInput: function (e) { d.lesson = e.target.value; } });
    lessonTa.value = d.lesson;
    var body = [
      h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:14px;" },
        field("Fecha", fieldInput(d, "date", { type: "date", style: base + "font-family:'Geist Mono',monospace;" })),
        field("Estado de ánimo", fieldSelect(d, "mood", [["Disciplinado", "Disciplinado"], ["Enfocado", "Enfocado"], ["Paciente", "Paciente"], ["Neutral", "Neutral"], ["Frustrado", "Frustrado"], ["Codicioso", "Codicioso"]]))),
      field("Título", fieldInput(d, "title", { placeholder: "Resumen del día…", style: base, onInput: function (e) { d.title = e.target.value; refresh(); } })),
      field("Reflexión", bodyTa),
      field("Lección", lessonTa),
    ];
    var footer = [
      h("button", { style: "flex:1;padding:11px;border-radius:10px;border:1px solid #E2DDD3;background:#fff;font-weight:600;font-size:13.5px;", hoverBg: "#FAF8F4", onClick: closeJournalAdd }, "Cancelar"),
      saveBtn,
    ];
    var frame = modalFrame("Nueva entrada de diario", closeJournalAdd, body, footer, 540);
    refresh();
    return frame;
  }

  function accountModal() {
    var editing = state.accountEditId != null;
    var d = state.accountDraft;
    var base = "padding:10px 12px;border:1px solid #E2DDD3;border-radius:9px;font-size:14px;";
    var mono = base + "font-family:'Geist Mono',monospace;";
    var saveBtn = h("button", { onClick: saveAccount }, editing ? "Guardar cambios" : "Crear cuenta");
    function refresh() {
      var valid = d.name.trim().length > 0;
      saveBtn.style.cssText = "flex:1.4;padding:11px;border-radius:10px;font-weight:600;font-size:13.5px;" + (valid ? "background:#16181C;color:#fff;" : "background:#CFC9BD;color:#fff;cursor:not-allowed;");
    }
    var notesTa = h("textarea", { rows: "2", placeholder: "Reglas, notas…", style: base + "line-height:1.5;resize:vertical;", onInput: function (e) { d.notes = e.target.value; } });
    notesTa.value = d.notes;
    var body = [
      field("Nombre de la cuenta", fieldInput(d, "name", { placeholder: "Apex 50K #1, IBKR Live…", style: base, onInput: function (e) { d.name = e.target.value; refresh(); } })),
      h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:14px;" },
        field("Tipo", fieldSelect(d, "kind", [["fondeo", "Fondeo (prop firm)"], ["live", "Live"], ["demo", "Demo"]])),
        field("Firma / bróker", fieldInput(d, "firm", { placeholder: "Apex, Topstep, IBKR…", style: base }))),
      h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:14px;" },
        field("Balance", fieldInput(d, "balance", { type: "number", step: "0.01", placeholder: "0.00", style: mono })),
        field("Moneda", fieldSelect(d, "currency", [["USD", "USD"], ["EUR", "EUR"], ["GBP", "GBP"], ["MXN", "MXN"]]))),
      h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:14px;" },
        field("Estado", fieldSelect(d, "status", [["activa", "Activa"], ["aprobada", "Aprobada"], ["quemada", "Quemada"], ["pausada", "Pausada"], ["cerrada", "Cerrada"]])),
        field("Fase", fieldInput(d, "phase", { placeholder: "Evaluación, Fase 1, Fondeada…", style: base }))),
      h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:14px;" },
        field("Objetivo de beneficio", fieldInput(d, "profit_target", { type: "number", step: "0.01", placeholder: "opcional", style: mono })),
        field("Drawdown máx.", fieldInput(d, "max_drawdown", { type: "number", step: "0.01", placeholder: "opcional", style: mono }))),
      field("Notas", notesTa),
    ];
    var footer = [
      h("button", { style: "flex:1;padding:11px;border-radius:10px;border:1px solid #E2DDD3;background:#fff;font-weight:600;font-size:13.5px;", hoverBg: "#FAF8F4", onClick: closeAccountAdd }, "Cancelar"),
    ];
    if (editing) footer.push(h("button", { style: "flex:1;padding:11px;border-radius:10px;border:1px solid #F2D9D5;background:#FCF1EF;color:#D6483B;font-weight:600;font-size:13.5px;", hoverBg: "#FBEAE7", onClick: deleteAccount }, "Eliminar"));
    footer.push(saveBtn);
    var frame = modalFrame(editing ? "Editar cuenta" : "Nueva cuenta", closeAccountAdd, body, footer, 560);
    refresh();
    return frame;
  }

  // ===================================================================
  // Boot
  // ===================================================================
  // Anti-clickjacking: refuse to run framed by another site (no headers on Pages).
  if (window.top !== window.self) {
    try { window.top.location = window.self.location; } catch (e) { }
    document.body.innerHTML = '<div style="font-family:sans-serif;padding:40px;color:#16181C;">Por seguridad, Bitácora no puede abrirse dentro de otra página.</div>';
    return;
  }

  SB.auth.onAuthStateChange(function (event, session) {
    if (event === "INITIAL_SESSION") return; // handled by getSession below
    state.user = session ? session.user : null;
    if (event === "SIGNED_IN") { state.authBusy = false; state.authEmail = ""; state.authPass = ""; loadData(); }
    else if (event === "SIGNED_OUT") { state.trades = []; state.journal = []; state.accounts = []; state.view = "dashboard"; state.selectedId = null; state.fAccount = "all"; state.fTag = "all"; render(); }
  });
  SB.auth.getSession().then(function (res) {
    state.user = res.data.session ? res.data.session.user : null;
    state.booting = false;
    if (state.user) loadData(); else render();
  }).catch(function () { state.booting = false; render(); });

  render();
})();

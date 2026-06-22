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
  var DEFAULT_CHECKLIST = [
    "¿La operación está dentro de mi plan?",
    "¿Tengo el stop y el riesgo definidos?",
    "¿El ratio riesgo/beneficio es al menos 1.5?",
    "¿Estoy operando con calma, sin FOMO ni revancha?",
  ];
  function defaultSettings() {
    return { rules: { maxTradesPerDay: "", maxDailyLoss: "", maxWeeklyLoss: "" }, checklist: DEFAULT_CHECKLIST.slice(), onboardingDone: false };
  }
  function applySettings(data) {
    data = data || {};
    var r = data.rules || {};
    state.settings = {
      rules: {
        maxTradesPerDay: r.maxTradesPerDay == null ? "" : r.maxTradesPerDay,
        maxDailyLoss: r.maxDailyLoss == null ? "" : r.maxDailyLoss,
        maxWeeklyLoss: r.maxWeeklyLoss == null ? "" : r.maxWeeklyLoss,
      },
      checklist: Array.isArray(data.checklist) && data.checklist.length ? data.checklist : DEFAULT_CHECKLIST.slice(),
      onboardingDone: !!data.onboardingDone,
    };
  }
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
    showJournalAdd: false, jdraft: blankJournalDraft(), journalEditId: null, jSearch: "", jMood: "all",
    showAccountAdd: false, accountEditId: null, accountDraft: blankAccountDraft(),
    settings: defaultSettings(), settingsSaved: false,
    showChecklist: false, checkState: [],
    quickNote: "", quickMood: "Enfocado",
    online: (typeof navigator !== "undefined" ? navigator.onLine !== false : true), pending: 0, usingCache: false,
    corrFactor: "rating", corrResult: "expectancy",
    mfaGate: false, mfaChecked: false, mfa: { code: "", busy: false, error: "" },
    showMfa: false, mfaFactors: [], mfaFactorsLoaded: false,
    mfaEnroll: { id: null, qr: "", secret: "", code: "", busy: false, error: "" },
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

  // ---------- numeric helpers (advanced stats) ----------
  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
  function stdev(a) { if (a.length < 2) return 0; var m = mean(a); var v = a.reduce(function (x, y) { return x + (y - m) * (y - m); }, 0) / (a.length - 1); return Math.sqrt(v); }
  function percentile(sorted, p) { if (!sorted.length) return 0; var idx = (sorted.length - 1) * p, lo = Math.floor(idx), hi = Math.ceil(idx); return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo); }
  function ratioStr(x, dp) { if (!isFinite(x)) return "∞"; return Number(x).toFixed(dp == null ? 2 : dp); }
  function rStr(x) { return (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(2) + "R"; }
  // Pearson correlation coefficient for paired numeric data.
  function pearson(xs, ys) {
    var n = xs.length;
    if (n < 2) return 0;
    var mx = mean(xs), my = mean(ys), cov = 0, sx = 0, sy = 0;
    for (var i = 0; i < n; i++) { var dx = xs[i] - mx, dy = ys[i] - my; cov += dx * dy; sx += dx * dx; sy += dy * dy; }
    if (sx === 0 || sy === 0) return 0;
    return cov / Math.sqrt(sx * sy);
  }
  function corrStrength(r) {
    var a = Math.abs(r);
    var mag = a < 0.1 ? "nula" : a < 0.3 ? "débil" : a < 0.5 ? "moderada" : a < 0.7 ? "fuerte" : "muy fuerte";
    return mag + (a < 0.1 ? "" : (r >= 0 ? " positiva" : " negativa"));
  }
  function corrColor(r) { return Math.abs(r) < 0.1 ? "color:#807B72;" : (r >= 0 ? "color:#16915B;" : "color:#D6483B;"); }

  function PV(t) {
    var P = { ES: 50, MES: 5, NQ: 20, MNQ: 2, CL: 1000, GC: 100, MGC: 10, RTY: 50, MRTY: 5 };
    return t.type === "option" ? 100 : (P[(t.symbol || "").toUpperCase()] || 1);
  }
  function pnlOf(t) {
    var dir = t.side === "long" ? 1 : -1;
    return Math.round((Number(t.exit) - Number(t.entry)) * PV(t) * Number(t.contracts) * dir);
  }
  function blankDraft() {
    return { symbol: "MES", type: "future", side: "long", contracts: 1, entry: "", exit: "", date: todayISO(), time: "", setup: "Ruptura", emotion: "Tranquilo", rating: 3, note: "", account_id: "", tags: "", mae: "", mfe: "" };
  }
  function blankAccountDraft() {
    return { name: "", kind: "fondeo", firm: "", balance: "", currency: "USD", phase: "", status: "activa", profit_target: "", max_drawdown: "", notes: "" };
  }
  function blankJournalDraft() {
    return { date: todayISO(), mood: "Enfocado", title: "", body: "", lesson: "" };
  }

  // ---------- data access (Supabase) ----------
  function coerceTrade(r) {
    return { id: r.id, date: r.date, time: r.time || "", symbol: r.symbol, type: r.type, side: r.side, contracts: Number(r.contracts), entry: Number(r.entry), exit: Number(r.exit), setup: r.setup, emotion: r.emotion, rating: Number(r.rating), note: r.note || "", pnl: Number(r.pnl), account_id: r.account_id || null, tags: Array.isArray(r.tags) ? r.tags : [], mae: r.mae == null ? "" : Number(r.mae), mfe: r.mfe == null ? "" : Number(r.mfe) };
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
  // ---------- offline cache + outbox (PWA) ----------
  function isOnline() { return typeof navigator === "undefined" ? true : navigator.onLine !== false; }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function cacheKey() { return "bitacora_cache_" + (state.user ? state.user.id : "anon"); }
  function outboxKey() { return "bitacora_outbox_" + (state.user ? state.user.id : "anon"); }
  function saveCache() {
    if (!state.user) return;
    lsSet(cacheKey(), { trades: state.trades, journal: state.journal, accounts: state.accounts, settings: state.settings, ts: Date.now() });
  }
  function getOutbox() { return lsGet(outboxKey()) || []; }
  function setOutbox(q) { lsSet(outboxKey(), q); state.pending = q.length; }
  function enqueue(table, row, tempId) { var q = getOutbox(); q.push({ table: table, row: row, tempId: tempId, ts: Date.now() }); setOutbox(q); }
  async function flushOutbox() {
    if (!isOnline() || !state.user) return;
    var q = getOutbox();
    if (!q.length) { state.pending = 0; return; }
    var remaining = [];
    for (var i = 0; i < q.length; i++) {
      var item = q[i];
      try {
        var res = await SB.from(item.table).insert(item.row).select().single();
        if (res.error) throw res.error;
        if (item.table === "trades") { var ct = coerceTrade(res.data); state.trades = state.trades.map(function (t) { return t.id === item.tempId ? ct : t; }); }
        else if (item.table === "journal") { var cj = coerceJournal(res.data); state.journal = state.journal.map(function (jj) { return jj.id === item.tempId ? cj : jj; }); }
      } catch (e) { remaining.push(item); }
    }
    setOutbox(remaining);
    saveCache();
  }
  function hydrateFromCache() {
    var c = lsGet(cacheKey());
    if (!c) return false;
    state.trades = c.trades || [];
    state.journal = c.journal || [];
    state.accounts = c.accounts || [];
    applySettings(c.settings || null);
    state.usingCache = true;
    state.pending = getOutbox().length;
    return true;
  }
  async function loadData() {
    state.loadingData = true; state.online = isOnline(); render();
    try {
      var t = await SB.from("trades").select("*").order("date", { ascending: false }).order("created_at", { ascending: false });
      if (t.error) throw t.error;
      var j = await SB.from("journal").select("*").order("date", { ascending: false }).order("created_at", { ascending: false });
      var a = await SB.from("accounts").select("*").order("created_at", { ascending: false });
      var st = await SB.from("user_settings").select("data").maybeSingle();
      state.trades = (t.data || []).map(coerceTrade);
      state.journal = (j.data || []).map(coerceJournal);
      state.accounts = (a.data || []).map(coerceAccount);
      applySettings(st && st.data ? st.data.data : null);
      state.usingCache = false;
      saveCache();
      await flushOutbox();
    } catch (e) {
      // Offline or transient failure: fall back to the last cached snapshot.
      hydrateFromCache();
    }
    state.loadingData = false;
    render();
  }
  async function saveSettings() {
    var s = state.settings;
    s.checklist = (s.checklist || []).map(function (x) { return String(x).trim(); }).filter(function (x) { return x; });
    if (!isOnline()) { window.alert("Necesitas conexión para guardar los ajustes."); return; }
    var row = { user_id: state.user.id, data: s, updated_at: new Date().toISOString() };
    var res = await SB.from("user_settings").upsert(row, { onConflict: "user_id" }).select().single();
    if (res.error) { window.alert("No se pudieron guardar los ajustes: " + res.error.message); return; }
    if (res.data && res.data.data) applySettings(res.data.data);
    state.settingsSaved = true;
    saveCache();
    render();
  }

  // ---------- risk / rules ----------
  function ruleNum(v) { var n = Number(v); return n > 0 ? n : 0; }
  function weekStartISO() {
    var d = new Date(); var dow = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - dow);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function riskStatus() {
    var r = state.settings.rules;
    var maxT = ruleNum(r.maxTradesPerDay), maxD = ruleNum(r.maxDailyLoss), maxW = ruleNum(r.maxWeeklyLoss);
    var today = todayISO(), wkStart = weekStartISO();
    var todays = state.trades.filter(function (t) { return t.date === today; });
    var tradesToday = todays.length;
    var pnlToday = todays.reduce(function (a, t) { return a + t.pnl; }, 0);
    var pnlWeek = state.trades.filter(function (t) { return t.date >= wkStart; }).reduce(function (a, t) { return a + t.pnl; }, 0);
    var breaches = [];
    if (maxT && tradesToday >= maxT) breaches.push("Has alcanzado tu límite de " + maxT + " operaciones hoy (" + tradesToday + ").");
    if (maxD && pnlToday <= -maxD) breaches.push("Has superado tu pérdida máxima diaria (" + signed(pnlToday) + " de −" + money(maxD) + ").");
    if (maxW && pnlWeek <= -maxW) breaches.push("Has superado tu pérdida máxima semanal (" + signed(pnlWeek) + " de −" + money(maxW) + ").");
    return { maxT: maxT, maxD: maxD, maxW: maxW, tradesToday: tradesToday, pnlToday: pnlToday, pnlWeek: pnlWeek, breaches: breaches, hasRules: !!(maxT || maxD || maxW) };
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

  // ---------- MFA (TOTP 2FA) ----------
  function hasMfaApi() { return SB.auth && SB.auth.mfa; }
  // Decide whether to block the app behind a 2FA challenge after password login.
  async function checkMfaGate() {
    state.mfaChecked = false;
    if (!hasMfaApi()) { state.mfaGate = false; state.mfaChecked = true; render(); return; }
    try {
      var r = await SB.auth.mfa.getAuthenticatorAssuranceLevel();
      var d = r && r.data;
      state.mfaGate = !!(d && d.currentLevel === "aal1" && d.nextLevel === "aal2");
    } catch (e) { state.mfaGate = false; }
    state.mfaChecked = true;
    render();
  }
  async function submitMfaChallenge() {
    var code = (state.mfa.code || "").trim();
    if (!/^\d{6}$/.test(code)) { state.mfa.error = "Introduce el código de 6 dígitos."; render(); return; }
    state.mfa.busy = true; state.mfa.error = ""; render();
    try {
      var fr = await SB.auth.mfa.listFactors();
      var totp = (fr.data && fr.data.totp) || [];
      var factor = totp.filter(function (f) { return f.status === "verified"; })[0];
      if (!factor) { state.mfaGate = false; state.mfa.busy = false; render(); return; }
      var v = await SB.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code });
      if (v.error) throw v.error;
      state.mfa = { code: "", busy: false, error: "" };
      await checkMfaGate();
      if (!state.mfaGate) loadData();
    } catch (e) {
      state.mfa.busy = false;
      state.mfa.error = "Código incorrecto o caducado. Inténtalo de nuevo.";
      render();
    }
  }
  async function loadMfaFactors() {
    if (!hasMfaApi()) { state.mfaFactorsLoaded = true; return; }
    try {
      var fr = await SB.auth.mfa.listFactors();
      state.mfaFactors = (fr.data && fr.data.totp) || [];
    } catch (e) { state.mfaFactors = []; }
    state.mfaFactorsLoaded = true;
    renderModal();
  }
  function openMfa() { state.showMfa = true; state.mfaFactorsLoaded = false; state.mfaEnroll = { id: null, qr: "", secret: "", code: "", busy: false, error: "" }; renderModal(); loadMfaFactors(); }
  function closeMfa() { state.showMfa = false; renderModal(); render(); }
  async function startMfaEnroll() {
    state.mfaEnroll.busy = true; state.mfaEnroll.error = ""; renderModal();
    try {
      var r = await SB.auth.mfa.enroll({ factorType: "totp", friendlyName: "Bitácora " + Date.now() });
      if (r.error) throw r.error;
      var t = r.data && r.data.totp;
      state.mfaEnroll = { id: r.data.id, qr: t && t.qr_code, secret: t && t.secret, code: "", busy: false, error: "" };
    } catch (e) {
      state.mfaEnroll.busy = false;
      state.mfaEnroll.error = /not enabled|disabled|unsupported/i.test(e && e.message || "") ? "Activa MFA (TOTP) en el panel de Supabase para poder enrolar." : ("No se pudo iniciar: " + (e && e.message || ""));
    }
    renderModal();
  }
  async function verifyMfaEnroll() {
    var code = (state.mfaEnroll.code || "").trim();
    if (!/^\d{6}$/.test(code)) { state.mfaEnroll.error = "Introduce el código de 6 dígitos."; renderModal(); return; }
    state.mfaEnroll.busy = true; state.mfaEnroll.error = ""; renderModal();
    try {
      var v = await SB.auth.mfa.challengeAndVerify({ factorId: state.mfaEnroll.id, code: code });
      if (v.error) throw v.error;
      state.mfaEnroll = { id: null, qr: "", secret: "", code: "", busy: false, error: "" };
      await loadMfaFactors();
    } catch (e) {
      state.mfaEnroll.busy = false;
      state.mfaEnroll.error = "Código incorrecto o caducado. Reinténtalo.";
      renderModal();
    }
  }
  async function unenrollMfa(id) {
    if (!window.confirm("¿Quitar este autenticador? Perderás el segundo factor.")) return;
    try {
      var r = await SB.auth.mfa.unenroll({ factorId: id });
      if (r.error) throw r.error;
      await loadMfaFactors();
    } catch (e) { window.alert("No se pudo quitar: " + (e && e.message || "")); }
  }

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
    var row = { date: d.date, time: d.time || null, symbol: d.symbol.toUpperCase(), type: d.type, side: d.side, contracts: Number(d.contracts), entry: Number(d.entry), exit: Number(d.exit), setup: d.setup, emotion: d.emotion, rating: Number(d.rating) || 3, note: d.note, pnl: pnl, account_id: d.account_id || null, tags: parseTags(d.tags), mae: d.mae === "" ? null : Number(d.mae), mfe: d.mfe === "" ? null : Number(d.mfe) };
    if (state.editId) {
      if (!isOnline()) { window.alert("Necesitas conexión para editar una operación. Las operaciones nuevas sí se guardan sin conexión."); return; }
      var up = await SB.from("trades").update(row).eq("id", state.editId).select().single();
      if (up.error) { window.alert("No se pudo actualizar la operación: " + up.error.message); return; }
      var updated = coerceTrade(up.data);
      state.trades = state.trades.map(function (t) { return t.id === updated.id ? updated : t; });
    } else if (!isOnline()) {
      // Offline: optimistic insert + queue for sync when back online.
      var tempId = "tmp_" + Date.now();
      state.trades = [coerceTrade(Object.assign({ id: tempId }, row))].concat(state.trades);
      enqueue("trades", row, tempId);
    } else {
      try {
        var res = await SB.from("trades").insert(row).select().single();
        if (res.error) throw res.error;
        state.trades = [coerceTrade(res.data)].concat(state.trades);
      } catch (e) {
        var tid = "tmp_" + Date.now();
        state.trades = [coerceTrade(Object.assign({ id: tid }, row))].concat(state.trades);
        enqueue("trades", row, tid);
      }
    }
    saveCache();
    closeAdd();
    render();
  }
  function openEdit(t) {
    state.editId = t.id;
    state.draft = { symbol: t.symbol, type: t.type, side: t.side, contracts: t.contracts, entry: t.entry, exit: t.exit, date: t.date, time: t.time || "", setup: t.setup, emotion: t.emotion, rating: t.rating, note: t.note, account_id: t.account_id || "", tags: (t.tags || []).join(", "), mae: t.mae, mfe: t.mfe };
    state.selectedId = null;
    state.showAdd = true;
    render();
  }
  function select(id) { state.selectedId = id; render(); }
  function closeDetail() { state.selectedId = null; render(); }
  async function deleteSelected() {
    var id = state.selectedId;
    if (String(id).slice(0, 4) === "tmp_") { // not yet synced — drop locally + from outbox
      state.trades = state.trades.filter(function (t) { return t.id !== id; });
      setOutbox(getOutbox().filter(function (it) { return it.tempId !== id; }));
      state.selectedId = null; saveCache(); render(); return;
    }
    if (!isOnline()) { window.alert("Necesitas conexión para eliminar una operación."); return; }
    var res = await SB.from("trades").delete().eq("id", id);
    if (res.error) { window.alert("No se pudo eliminar: " + res.error.message); return; }
    state.trades = state.trades.filter(function (t) { return t.id !== id; });
    state.selectedId = null;
    saveCache();
    render();
  }
  async function saveJournal() {
    var d = state.jdraft;
    if (!d.title.trim()) return;
    var row = { date: d.date, mood: d.mood, title: d.title.trim(), body: d.body, lesson: d.lesson };
    if (state.journalEditId) {
      if (!isOnline()) { window.alert("Necesitas conexión para editar una entrada."); return; }
      var up = await SB.from("journal").update(row).eq("id", state.journalEditId).select().single();
      if (up.error) { window.alert("No se pudo actualizar la entrada: " + up.error.message); return; }
      var u = coerceJournal(up.data);
      state.journal = state.journal.map(function (j) { return j.id === u.id ? u : j; });
      saveCache(); closeJournalAdd(); render(); return;
    }
    if (!isOnline()) {
      var tid = "tmp_" + Date.now();
      state.journal = [coerceJournal(Object.assign({ id: tid }, row))].concat(state.journal);
      enqueue("journal", row, tid); saveCache(); closeJournalAdd(); render(); return;
    }
    try {
      var res = await SB.from("journal").insert(row).select().single();
      if (res.error) throw res.error;
      state.journal = [coerceJournal(res.data)].concat(state.journal);
    } catch (e) {
      var tid2 = "tmp_" + Date.now();
      state.journal = [coerceJournal(Object.assign({ id: tid2 }, row))].concat(state.journal);
      enqueue("journal", row, tid2);
    }
    saveCache();
    closeJournalAdd();
    render();
  }
  async function deleteJournal(id) {
    if (String(id).slice(0, 4) === "tmp_") {
      state.journal = state.journal.filter(function (j) { return j.id !== id; });
      setOutbox(getOutbox().filter(function (it) { return it.tempId !== id; }));
      saveCache(); closeJournalAdd(); render(); return;
    }
    if (!isOnline()) { window.alert("Necesitas conexión para eliminar una entrada."); return; }
    if (!window.confirm("¿Eliminar esta entrada del diario?")) return;
    var res = await SB.from("journal").delete().eq("id", id);
    if (res.error) { window.alert("No se pudo eliminar: " + res.error.message); return; }
    state.journal = state.journal.filter(function (j) { return j.id !== id; });
    saveCache(); closeJournalAdd(); render();
  }
  async function saveJournalQuick() {
    var text = (state.quickNote || "").trim();
    if (!text) return;
    var row = { date: todayISO(), mood: state.quickMood, title: text, body: "", lesson: "" };
    if (!isOnline()) {
      var tid = "tmp_" + Date.now();
      state.journal = [coerceJournal(Object.assign({ id: tid }, row))].concat(state.journal);
      enqueue("journal", row, tid); state.quickNote = ""; saveCache(); render(); return;
    }
    try {
      var res = await SB.from("journal").insert(row).select().single();
      if (res.error) throw res.error;
      state.journal = [coerceJournal(res.data)].concat(state.journal);
    } catch (e) {
      var tid2 = "tmp_" + Date.now();
      state.journal = [coerceJournal(Object.assign({ id: tid2 }, row))].concat(state.journal);
      enqueue("journal", row, tid2);
    }
    state.quickNote = "";
    saveCache();
    render();
  }
  async function dismissOnboarding() {
    state.settings.onboardingDone = true;
    await saveSettings();
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
    if (!isOnline()) { window.alert("Necesitas conexión para crear o editar cuentas."); return; }
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
    saveCache();
    closeAccountAdd();
    render();
  }
  async function deleteAccount() {
    var id = state.accountEditId;
    if (!id) return;
    if (!isOnline()) { window.alert("Necesitas conexión para eliminar cuentas."); return; }
    if (!window.confirm("¿Eliminar esta cuenta? Las operaciones asociadas se conservarán pero quedarán sin cuenta.")) return;
    var res = await SB.from("accounts").delete().eq("id", id);
    if (res.error) { window.alert("No se pudo eliminar: " + res.error.message); return; }
    state.accounts = state.accounts.filter(function (a) { return a.id !== id; });
    state.trades = state.trades.map(function (t) { return t.account_id === id ? Object.assign({}, t, { account_id: null }) : t; });
    saveCache();
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
    var s = advancedStats(ts);
    return { count: ts.length, net: net, winRate: ts.length ? Math.round(wins / ts.length * 100) : 0, pf: s.pf, expectancy: s.expectancy, maxDD: s.maxDD };
  }
  function accountName(accId) {
    if (!accId) return null;
    var a = state.accounts.find(function (x) { return x.id === accId; });
    return a ? a.name : null;
  }

  function openAdd() { state.editId = null; state.draft = blankDraft(); state.showAdd = true; renderModal(); }
  function closeAdd() { state.showAdd = false; state.editId = null; renderModal(); }
  function openJournalAdd() { state.journalEditId = null; state.jdraft = blankJournalDraft(); state.showJournalAdd = true; renderModal(); }
  function openJournalEdit(j) { state.journalEditId = j.id; state.jdraft = { date: j.date, mood: j.mood, title: j.title, body: j.body, lesson: j.lesson }; state.showJournalAdd = true; renderModal(); }
  function closeJournalAdd() { state.showJournalAdd = false; state.journalEditId = null; renderModal(); }
  function openChecklist() { state.checkState = (state.settings.checklist || []).map(function () { return false; }); state.showChecklist = true; renderModal(); }
  function closeChecklist() { state.showChecklist = false; renderModal(); }

  // ---------- metrics & grouping ----------
  function metrics() {
    var ts = state.trades, n = ts.length;
    var wins = ts.filter(function (t) { return t.pnl > 0; });
    var losses = ts.filter(function (t) { return t.pnl < 0; });
    var gp = wins.reduce(function (a, t) { return a + t.pnl; }, 0);
    var gl = Math.abs(losses.reduce(function (a, t) { return a + t.pnl; }, 0));
    var net = gp - gl, wr = n ? wins.length / n : 0;
    return { n: n, net: net, wr: wr, wins: wins.length, losses: losses.length, pf: gl ? gp / gl : (gp > 0 ? Infinity : 0), exp: n ? net / n : 0, gp: gp, gl: gl };
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
  function byDateAsc(a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); }
  // The R unit (1R) when no per-trade stop is recorded: the average loss size.
  function rUnitOf(rows) {
    var losses = rows.filter(function (t) { return t.pnl < 0; }).map(function (t) { return t.pnl; });
    if (losses.length) return Math.abs(mean(losses));
    var wins = rows.filter(function (t) { return t.pnl > 0; }).map(function (t) { return t.pnl; });
    return wins.length ? mean(wins) : 1;
  }
  // Full professional statistics for a set of trades.
  function advancedStats(rows) {
    rows = rows || state.trades;
    var n = rows.length;
    var pnls = rows.map(function (t) { return t.pnl; });
    var wins = pnls.filter(function (x) { return x > 0; });
    var losses = pnls.filter(function (x) { return x < 0; });
    var be = pnls.filter(function (x) { return x === 0; }).length;
    var gp = wins.reduce(function (a, x) { return a + x; }, 0);
    var gl = Math.abs(losses.reduce(function (a, x) { return a + x; }, 0));
    var net = gp - gl, wr = n ? wins.length / n : 0;
    var avgWin = wins.length ? mean(wins) : 0, avgLoss = losses.length ? mean(losses) : 0;
    var payoff = avgLoss !== 0 ? avgWin / Math.abs(avgLoss) : (avgWin > 0 ? Infinity : 0);
    var pf = gl > 0 ? gp / gl : (gp > 0 ? Infinity : 0);
    var expectancy = n ? net / n : 0;
    var rUnit = rUnitOf(rows);
    var rMul = rUnit > 0 ? pnls.map(function (x) { return x / rUnit; }) : pnls.map(function () { return 0; });
    var expR = mean(rMul), sdR = stdev(rMul);
    var sqn = (n >= 2 && sdR > 0) ? (expR / sdR) * Math.sqrt(n) : 0;
    var sd = stdev(pnls);
    var sharpe = sd > 0 ? mean(pnls) / sd : 0;
    var downside = Math.sqrt(mean(pnls.map(function (x) { var m = Math.min(x, 0); return m * m; })));
    var sortino = downside > 0 ? mean(pnls) / downside : 0;
    var kelly = payoff > 0 && isFinite(payoff) ? (wr - (1 - wr) / payoff) : 0; if (kelly < 0) kelly = 0;
    // streaks + drawdown over chronological equity
    var chrono = rows.slice().sort(byDateAsc);
    var maxW = 0, maxL = 0, cw = 0, cl = 0;
    chrono.forEach(function (t) {
      if (t.pnl > 0) { cw++; cl = 0; if (cw > maxW) maxW = cw; }
      else if (t.pnl < 0) { cl++; cw = 0; if (cl > maxL) maxL = cl; }
    });
    var cur = 0;
    for (var i = chrono.length - 1; i >= 0; i--) {
      if (chrono[i].pnl > 0) { if (cur < 0) break; cur++; }
      else if (chrono[i].pnl < 0) { if (cur > 0) break; cur--; }
      else break;
    }
    var eq = 0, peak = 0, maxDD = 0, curDur = 0, maxDur = 0;
    chrono.forEach(function (t) {
      eq += t.pnl;
      if (eq > peak) { peak = eq; curDur = 0; } else { curDur++; if (curDur > maxDur) maxDur = curDur; }
      var dd = peak - eq; if (dd > maxDD) maxDD = dd;
    });
    var recovery = maxDD > 0 ? net / maxDD : (net > 0 ? Infinity : 0);
    var sorted = pnls.slice().sort(function (a, b) { return a - b; });
    var maes = rows.filter(function (t) { return t.mae !== "" && t.mae != null; }).map(function (t) { return Math.abs(Number(t.mae)); });
    var mfes = rows.filter(function (t) { return t.mfe !== "" && t.mfe != null; }).map(function (t) { return Math.abs(Number(t.mfe)); });
    var avgMae = maes.length ? mean(maes) : null, avgMfe = mfes.length ? mean(mfes) : null;
    var edge = (avgMae && avgMae > 0 && avgMfe != null) ? avgMfe / avgMae : null;
    var byDay = {}; rows.forEach(function (t) { byDay[t.date] = (byDay[t.date] || 0) + t.pnl; });
    var dayVals = Object.keys(byDay).map(function (k) { return byDay[k]; });
    var greenDays = dayVals.filter(function (x) { return x > 0; }).length;
    return {
      n: n, wins: wins.length, losses: losses.length, be: be, net: net, gp: gp, gl: gl, wr: wr,
      avgWin: avgWin, avgLoss: avgLoss, payoff: payoff, pf: pf, expectancy: expectancy,
      rUnit: rUnit, rMul: rMul, expR: expR, sdR: sdR, sqn: sqn, sd: sd, sharpe: sharpe, sortino: sortino, kelly: kelly,
      maxWinStreak: maxW, maxLossStreak: maxL, curStreak: cur, maxDD: maxDD, maxDDDur: maxDur, recovery: recovery,
      median: percentile(sorted, .5), p25: percentile(sorted, .25), p75: percentile(sorted, .75),
      best: n ? Math.max.apply(null, pnls) : 0, worst: n ? Math.min.apply(null, pnls) : 0,
      avgMae: avgMae, avgMfe: avgMfe, edge: edge,
      days: dayVals.length, greenDays: greenDays, dayWr: dayVals.length ? greenDays / dayVals.length : 0,
      avgDay: dayVals.length ? mean(dayVals) : 0, bestDay: dayVals.length ? Math.max.apply(null, dayVals) : 0, worstDay: dayVals.length ? Math.min.apply(null, dayVals) : 0,
    };
  }
  // Trading session derived from the entry hour (local time the user typed).
  var SESSIONS = ["Asia", "Londres", "Nueva York"];
  function sessionOf(time) {
    if (!time) return null;
    var hr = parseInt(String(time).slice(0, 2), 10);
    if (isNaN(hr)) return null;
    if (hr >= 7 && hr < 13) return "Londres";
    if (hr >= 13 && hr < 22) return "Nueva York";
    return "Asia";
  }
  // Monthly net P&L and a benchmark = average of completed past months.
  function monthlyBenchmark() {
    var byMonth = {};
    state.trades.forEach(function (t) { var k = t.date.slice(0, 7); byMonth[k] = (byMonth[k] || 0) + t.pnl; });
    var cur = thisMonth();
    var past = Object.keys(byMonth).filter(function (k) { return k !== cur; });
    if (!past.length) return null;
    var avg = past.reduce(function (a, k) { return a + byMonth[k]; }, 0) / past.length;
    return { current: byMonth[cur] || 0, avg: avg, months: past.length, hasCurrent: byMonth.hasOwnProperty(cur) };
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
  // Underwater (drawdown) curve: distance below the running equity peak.
  function drawdownEl() {
    var chrono = state.trades.slice().sort(byDateAsc);
    if (!chrono.length) return null;
    var eq = 0, peak = 0, dd = [];
    chrono.forEach(function (t) { eq += t.pnl; if (eq > peak) peak = eq; dd.push(eq - peak); });
    var w = 1000, h = 200, pl = 10, pr = 10, pt = 14, pb = 10;
    var xs = function (i) { return pl + (dd.length <= 1 ? 0 : (i / (dd.length - 1)) * (w - pl - pr)); };
    var mn = Math.min.apply(null, dd.concat([0])) || -1;
    var ys = function (v) { return pt + (v / mn) * (h - pt - pb); };
    var line = dd.map(function (v, i) { return (i ? "L" : "M") + xs(i).toFixed(1) + " " + ys(v).toFixed(1); }).join(" ");
    var area = "M" + xs(0).toFixed(1) + " " + ys(0).toFixed(1) + " " + dd.map(function (v, i) { return "L" + xs(i).toFixed(1) + " " + ys(v).toFixed(1); }).join(" ") + " L" + xs(dd.length - 1).toFixed(1) + " " + ys(0).toFixed(1) + " Z";
    var grad = s("linearGradient", { id: "ddg", x1: 0, y1: 0, x2: 0, y2: 1 },
      s("stop", { offset: "0%", "stop-color": "#D6483B", "stop-opacity": .04 }),
      s("stop", { offset: "100%", "stop-color": "#D6483B", "stop-opacity": .20 }));
    return s("svg", { viewBox: "0 0 " + w + " " + h, style: "width:100%;height:auto;display:block;" },
      s("defs", null, grad),
      s("line", { x1: pl, y1: ys(0), x2: w - pr, y2: ys(0), stroke: "#E2DDD3", "stroke-width": 1 }),
      s("path", { d: area, fill: "url(#ddg)" }),
      s("path", { d: line, fill: "none", stroke: "#D6483B", "stroke-width": 2, "stroke-linejoin": "round" }));
  }
  // Distribution histogram of per-trade P&L (binned).
  function histogramEl(pnls) {
    if (!pnls.length) return null;
    var mn = Math.min.apply(null, pnls), mx = Math.max.apply(null, pnls);
    if (mn === mx) { mn -= 1; mx += 1; }
    var BINS = Math.min(11, Math.max(5, Math.round(Math.sqrt(pnls.length))));
    var span = (mx - mn) || 1, bw = span / BINS;
    var bins = []; for (var b = 0; b < BINS; b++) bins.push({ lo: mn + b * bw, hi: mn + (b + 1) * bw, count: 0 });
    pnls.forEach(function (x) { var idx = Math.min(BINS - 1, Math.floor((x - mn) / bw)); bins[idx].count++; });
    var maxC = Math.max.apply(null, bins.map(function (b) { return b.count; })) || 1;
    var w = 1000, h = 240, pl = 12, pr = 12, pt = 18, pb = 28, plotH = h - pt - pb;
    var cw = (w - pl - pr) / BINS;
    var kids = [s("line", { x1: pl, y1: h - pb, x2: w - pr, y2: h - pb, stroke: "#E2DDD3", "stroke-width": 1 })];
    bins.forEach(function (bn, i) {
      var bh = bn.count / maxC * plotH, x = pl + cw * i + 2, y = h - pb - bh;
      var mid = (bn.lo + bn.hi) / 2, col = mid >= 0 ? "#16915B" : "#D6483B";
      kids.push(s("rect", { x: x, y: y, width: cw - 4, height: Math.max(bh, bn.count ? 2 : 0), rx: 3, fill: col, opacity: .9 }));
      if (bn.count) kids.push(s("text", { x: x + (cw - 4) / 2, y: y - 5, "text-anchor": "middle", "font-size": 11, "font-family": "Geist Mono, monospace", "font-weight": 600, fill: "#54514A" }, bn.count));
    });
    // axis labels at the extremes and zero
    kids.push(s("text", { x: pl, y: h - 9, "font-size": 10.5, "font-family": "Geist Mono, monospace", fill: "#A39E94" }, signed(mn)));
    kids.push(s("text", { x: w - pr, y: h - 9, "text-anchor": "end", "font-size": 10.5, "font-family": "Geist Mono, monospace", fill: "#A39E94" }, signed(mx)));
    return s("svg", { viewBox: "0 0 " + w + " " + h, style: "width:100%;height:auto;display:block;" }, kids);
  }
  // Scatter of a numeric factor (x) vs P&L (y) with a least-squares trend line.
  function scatterEl(pairs, xlabel) {
    if (pairs.length < 2) return null;
    var w = 1000, h = 320, pl = 52, pr = 16, pt = 16, pb = 36;
    var xs = pairs.map(function (p) { return p.x; }), ys = pairs.map(function (p) { return p.y; });
    var xmn = Math.min.apply(null, xs), xmx = Math.max.apply(null, xs); if (xmn === xmx) { xmn -= 1; xmx += 1; }
    var ymn = Math.min.apply(null, ys.concat([0])), ymx = Math.max.apply(null, ys.concat([0])); if (ymn === ymx) { ymn -= 1; ymx += 1; }
    var X = function (v) { return pl + (v - xmn) / (xmx - xmn) * (w - pl - pr); };
    var Y = function (v) { return pt + (1 - (v - ymn) / (ymx - ymn)) * (h - pt - pb); };
    var kids = [];
    kids.push(s("line", { x1: pl, y1: pt, x2: pl, y2: h - pb, stroke: "#E2DDD3", "stroke-width": 1 }));
    kids.push(s("line", { x1: pl, y1: Y(0), x2: w - pr, y2: Y(0), stroke: "#E2DDD3", "stroke-width": 1, "stroke-dasharray": "4 5" }));
    // trend line (least squares)
    var mx = mean(xs), my = mean(ys), sxx = 0, sxy = 0;
    for (var i = 0; i < xs.length; i++) { sxx += (xs[i] - mx) * (xs[i] - mx); sxy += (xs[i] - mx) * (ys[i] - my); }
    if (sxx > 0) {
      var slope = sxy / sxx, b0 = my - slope * mx;
      kids.push(s("line", { x1: X(xmn), y1: Y(b0 + slope * xmn), x2: X(xmx), y2: Y(b0 + slope * xmx), stroke: "#16181C", "stroke-width": 2, opacity: .65 }));
    }
    pairs.forEach(function (p) { kids.push(s("circle", { cx: X(p.x), cy: Y(p.y), r: 4, fill: p.y >= 0 ? "#16915B" : "#D6483B", opacity: .6 })); });
    kids.push(s("text", { x: pl, y: pt + 4, "font-size": 10.5, "font-family": "Geist Mono, monospace", fill: "#A39E94" }, signed(ymx)));
    kids.push(s("text", { x: pl, y: h - pb, "font-size": 10.5, "font-family": "Geist Mono, monospace", fill: "#A39E94" }, signed(ymn)));
    kids.push(s("text", { x: (pl + w - pr) / 2, y: h - 8, "text-anchor": "middle", "font-size": 11.5, "font-family": "Geist, sans-serif", fill: "#807B72" }, xlabel + " →"));
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
    if (!state.mfaChecked) { root.appendChild(centerWrap(h("div", { style: "color:#A39E94;font-size:14px;" }, "Verificando seguridad…"))); renderModal(); return; }
    if (state.mfaGate) { root.appendChild(mfaGateScreen()); renderModal(); return; }
    root.appendChild(appShell());
    renderModal();
  }
  function mfaGateScreen() {
    var input = h("input", { type: "text", inputmode: "numeric", maxlength: "6", autocomplete: "one-time-code", placeholder: "000000", style: "width:100%;text-align:center;letter-spacing:8px;font-family:'Geist Mono',monospace;font-size:24px;padding:12px;border:1px solid #E2DDD3;border-radius:10px;margin-top:6px;", onInput: function (e) { state.mfa.code = e.target.value.replace(/\D/g, ""); } });
    input.value = state.mfa.code;
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") submitMfaChallenge(); });
    var card = h("div", { class: "dc-modal", style: "width:380px;max-width:92vw;background:#fff;border:1px solid #ECE7DD;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.10);padding:30px 28px;" },
      h("div", { style: "width:42px;height:42px;border-radius:11px;background:#EAF0F7;display:flex;align-items:center;justify-content:center;margin-bottom:16px;" },
        icon('<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3D6FB0" stroke-width="1.9"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>')),
      h("div", { style: "font-size:17px;font-weight:600;margin-bottom:3px;" }, "Verificación en dos pasos"),
      h("div", { style: "font-size:13px;color:#807B72;margin-bottom:14px;" }, "Introduce el código de 6 dígitos de tu app de autenticación."),
      input,
      state.mfa.error ? h("div", { style: "margin-top:10px;font-size:12.5px;color:#D6483B;background:#FCF1EF;border:1px solid #F2D9D5;border-radius:9px;padding:9px 11px;" }, state.mfa.error) : null,
      h("button", { onClick: submitMfaChallenge, style: "width:100%;padding:12px;border-radius:10px;font-weight:600;font-size:14px;margin-top:16px;" + (state.mfa.busy ? "background:#CFC9BD;color:#fff;cursor:wait;" : "background:#16181C;color:#fff;") }, state.mfa.busy ? "Verificando…" : "Verificar"),
      h("button", { onClick: logout, style: "width:100%;background:none;border:none;color:#807B72;font-size:13px;margin-top:12px;" }, "Cancelar y cerrar sesión"));
    return centerWrap(card);
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
    return h("div", { class: "app-shell", style: "display:flex;height:100vh;width:100%;overflow:hidden;background:#FAF8F4;font-family:Geist,sans-serif;color:#16181C;-webkit-font-smoothing:antialiased;font-size:14px;" },
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

    return h("aside", { class: "side", style: "width:240px;flex:none;display:flex;flex-direction:column;background:#FFFFFF;border-right:1px solid #ECE7DD;padding:20px 14px;" },
      h("div", { style: "display:flex;align-items:center;gap:10px;padding:6px 8px 22px 8px;" },
        h("div", { style: "width:30px;height:30px;border-radius:8px;background:#16181C;display:flex;align-items:center;justify-content:center;flex:none;" },
          icon('<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="4" y="9" width="3.4" height="11" rx="1" fill="#16915B"/><line x1="5.7" y1="5" x2="5.7" y2="9" stroke="#16915B" stroke-width="1.6"/><line x1="5.7" y1="20" x2="5.7" y2="22.5" stroke="#16915B" stroke-width="1.6"/><rect x="13" y="6" width="3.4" height="9" rx="1" fill="#D6483B"/><line x1="14.7" y1="3" x2="14.7" y2="6" stroke="#D6483B" stroke-width="1.6"/><line x1="14.7" y1="15" x2="14.7" y2="18" stroke="#D6483B" stroke-width="1.6"/></svg>')),
        h("div", { class: "side-text", style: "line-height:1;" },
          h("div", { style: "font-weight:700;font-size:15px;letter-spacing:-0.2px;" }, "Bitácora"),
          h("div", { style: "font-size:11px;color:#A39E94;margin-top:3px;letter-spacing:.3px;" }, "TRADING JOURNAL"))),
      h("nav", { style: "display:flex;flex-direction:column;gap:2px;" },
        navItem("dashboard", '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>', "Resumen"),
        navItem("trades", '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r="1.3" fill="currentColor" stroke="none"/></svg>', "Operaciones", state.trades.length),
        navItem("calendar", '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4.5" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2.5" x2="8" y2="6"/><line x1="16" y1="2.5" x2="16" y2="6"/></svg>', "Calendario"),
        navItem("analytics", '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><line x1="4" y1="20" x2="4" y2="13"/><line x1="10" y1="20" x2="10" y2="5"/><line x1="16" y1="20" x2="16" y2="9"/><line x1="22" y1="20" x2="22" y2="15"/></svg>', "Analítica"),
        navItem("stats", '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 19h16"/><path d="M4 5v14"/><path d="M8 15l3-4 3 2 4-6"/><circle cx="8" cy="15" r="0.6" fill="currentColor"/></svg>', "Estadísticas"),
        navItem("correlations", '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="6" cy="17" r="1.6"/><circle cx="10" cy="11" r="1.6"/><circle cx="14" cy="13" r="1.6"/><circle cx="18" cy="6" r="1.6"/><path d="M4 21V4" stroke-width="1.4"/><path d="M4 21h17" stroke-width="1.4"/></svg>', "Correlaciones"),
        navItem("journal", '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v14H6.5A2.5 2.5 0 0 0 4 19.5z"/><line x1="4" y1="19.5" x2="4" y2="5.5"/><line x1="20" y1="17" x2="20" y2="21"/><path d="M6.5 21H20"/></svg>', "Diario"),
        navItem("accounts", '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2" y="5" width="20" height="14" rx="2.5"/><line x1="2" y1="10" x2="22" y2="10"/></svg>', "Cuentas", state.accounts.length),
        navItem("settings", '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>', "Ajustes")),
      h("div", { class: "side-foot", style: "margin-top:auto;display:flex;flex-direction:column;gap:12px;" },
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

  var TITLES = { dashboard: "Resumen", trades: "Operaciones", calendar: "Calendario de resultados", analytics: "Analítica", stats: "Estadísticas avanzadas", correlations: "Correlaciones con tus resultados", journal: "Diario de trading", accounts: "Cuentas", settings: "Ajustes" };

  function mainColumn() {
    return h("main", { style: "flex:1;display:flex;flex-direction:column;min-width:0;" },
      header(),
      offlineBanner(),
      rulesBanner(),
      h("div", { class: "dc-scroll", style: "flex:1;overflow-y:auto;padding:28px;" }, state.loadingData ? loadingBody() : viewBody()));
  }
  function offlineBanner() {
    if (!state.online) {
      return h("div", { style: "flex:none;display:flex;align-items:center;gap:10px;padding:10px 28px;background:#FBF1E6;border-bottom:1px solid #F0E0C8;color:#9A6418;" },
        icon('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex:none;"><path d="M1 1l22 22"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>'),
        h("div", { style: "font-size:12.5px;font-weight:600;" }, "Sin conexión — puedes seguir registrando; se sincroniza al volver." + (state.pending ? "  (" + state.pending + " sin sincronizar)" : "")));
    }
    if (state.pending) {
      return h("div", { style: "flex:none;display:flex;align-items:center;gap:10px;padding:10px 28px;background:#EAF0F7;border-bottom:1px solid #D6E2F0;color:#3D6FB0;" },
        icon('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex:none;"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>'),
        h("div", { style: "font-size:12.5px;font-weight:600;" }, "Sincronizando " + state.pending + " operación(es) pendientes…"));
    }
    return null;
  }
  function rulesBanner() {
    if (state.loadingData) return null;
    var rk = riskStatus();
    if (!rk.breaches.length) return null;
    return h("div", { style: "flex:none;display:flex;align-items:flex-start;gap:11px;padding:12px 28px;background:#FCF1EF;border-bottom:1px solid #F2D9D5;color:#B23A2E;" },
      icon('<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex:none;margin-top:1px;"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'),
      h("div", null,
        h("div", { style: "font-size:13px;font-weight:700;margin-bottom:2px;" }, "Has roto una regla de tu plan"),
        h("div", { style: "font-size:12.5px;line-height:1.5;" }, rk.breaches.join(" · "))));
  }
  function loadingBody() { return h("div", { style: "max-width:1180px;margin:0 auto;color:#A39E94;font-size:14px;padding:40px;text-align:center;" }, "Cargando tus datos…"); }

  function dateRangeLabel() {
    if (!state.trades.length) return "Sin operaciones aún";
    var dates = state.trades.map(function (t) { return t.date; }).sort();
    var a = dates[0], b = dates[dates.length - 1];
    return fmtDateLong(a) + " – " + fmtDateLong(b);
  }

  function header() {
    return h("header", { class: "head", style: "height:62px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 28px;border-bottom:1px solid #ECE7DD;background:rgba(250,248,244,.85);backdrop-filter:blur(8px);" },
      h("div", null, h("div", { style: "font-size:17px;font-weight:600;letter-spacing:-0.3px;" }, TITLES[state.view])),
      h("div", { style: "display:flex;align-items:center;gap:12px;" },
        h("div", { class: "head-date", style: "display:flex;align-items:center;gap:7px;font-size:12.5px;color:#807B72;padding:7px 12px;border:1px solid #ECE7DD;border-radius:9px;background:#fff;" },
          icon('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4.5" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>'),
          dateRangeLabel()),
        h("button", { title: "Checklist antes de operar", style: "display:flex;align-items:center;gap:7px;background:#fff;border:1px solid #E2DDD3;color:#16181C;font-weight:600;font-size:13px;padding:9px 13px;border-radius:9px;", hoverBg: "#FAF8F4", onClick: openChecklist },
          icon('<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'),
          "Checklist"),
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
      case "stats": return statsView();
      case "correlations": return correlationsView();
      case "journal": return journalView();
      case "accounts": return accountsView();
      case "settings": return settingsView();
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
      if (st.count) {
        rows.push(row("Profit factor", ratioStr(st.pf), st.pf >= 1 ? "color:#16915B;" : "color:#D6483B;"));
        rows.push(row("Expectativa/op.", signed(st.expectancy), pnlColor(st.expectancy)));
        rows.push(row("DD realizado", "−" + money(st.maxDD), "color:#D6483B;"));
      }
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
  function onboardingPanel() {
    var rk = riskStatus();
    var steps = [
      { done: state.accounts.length > 0, title: "Crea tu primera cuenta", desc: "Fondeo, live o demo — para separar tus resultados.", label: "Crear cuenta", action: openAccountAdd },
      { done: state.trades.length > 0, title: "Registra tu primera operación", desc: "Entrada, salida y cómo te sentiste. Bitácora calcula el P&L.", label: "Nueva operación", action: openAdd },
      { done: rk.hasRules, title: "Define tus reglas de riesgo", desc: "Límite de pérdida y de operaciones para protegerte de ti mismo.", label: "Configurar", action: function () { setView("settings"); } },
    ];
    var done = steps.filter(function (s) { return s.done; }).length;
    var rows = steps.map(function (st) {
      return h("div", { style: "display:flex;align-items:center;gap:13px;padding:13px 0;border-top:1px solid #F3EFE7;" },
        h("span", { style: "width:24px;height:24px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;" + (st.done ? "background:#16915B;color:#fff;" : "background:#F1EDE5;color:#A39E94;") }, st.done ? "✓" : ""),
        h("div", { style: "flex:1;min-width:0;" },
          h("div", { style: "font-size:13.5px;font-weight:600;" + (st.done ? "color:#A39E94;text-decoration:line-through;" : "") }, st.title),
          h("div", { style: "font-size:12px;color:#A39E94;margin-top:1px;" }, st.desc)),
        st.done ? null : h("button", { style: "flex:none;font-size:12.5px;font-weight:600;color:#fff;background:#16181C;border-radius:9px;padding:8px 13px;", onClick: st.action }, st.label));
    });
    return h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:22px;" },
      h("div", { style: "display:flex;align-items:flex-start;justify-content:space-between;gap:12px;" },
        h("div", null,
          h("div", { style: "font-size:16px;font-weight:700;letter-spacing:-0.2px;" }, "Bienvenido a Bitácora 👋"),
          h("div", { style: "font-size:13px;color:#807B72;margin-top:3px;" }, "Tres pasos para sacarle partido. Llevas " + done + " de " + steps.length + ".")),
        h("button", { style: "flex:none;font-size:12px;color:#A39E94;font-weight:600;", onClick: dismissOnboarding }, "Ocultar guía")),
      h("div", { style: "margin-top:8px;" }, rows));
  }
  function dashboardView() {
    var onb = state.settings.onboardingDone ? null : onboardingPanel();
    if (!state.trades.length) {
      return h("div", { style: "max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:18px;" },
        onb || emptyCard("Aún no tienes operaciones", "Pulsa “Nueva operación” arriba a la derecha para registrar tu primer trade."));
    }
    var m = metrics();
    var setupG = group(function (t) { return t.setup; });
    var setupData = Object.keys(setupG).map(function (k) { return { label: setupG[k].key, value: setupG[k].pnl }; });
    var recentRows = state.trades.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 6).map(buildRow);
    var winBar = h("div", { style: "display:flex;height:5px;border-radius:3px;overflow:hidden;margin-top:12px;background:#FBEAE7;" },
      h("div", { style: "height:100%;background:#16915B;width:" + Math.round(m.wr * 100) + "%;" }));
    var bench = monthlyBenchmark();
    return h("div", { style: "max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:18px;" },
      onb,
      h("div", { style: "display:grid;grid-template-columns:repeat(4,1fr);gap:14px;" },
        kpiCard("P&L neto", pnlColor(m.net), signed(m.net), null, m.n + " operaciones cerradas"),
        kpiCard("Win rate", "", Math.round(m.wr * 100) + "%", winBar, m.wins + " ganadoras · " + m.losses + " perdedoras"),
        kpiCard("Profit factor", "", ratioStr(m.pf), null, money(m.gp) + " / " + money(m.gl)),
        kpiCard("Esperanza / op.", pnlColor(m.exp), signed(m.exp), null, "media por operación")),
      bench ? benchmarkPanel(bench) : null,
      riskTrackerPanel(),
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
  function benchmarkPanel(b) {
    var delta = b.current - b.avg;
    var above = delta >= 0;
    var deltaStr = (above ? "+" : "−") + "$" + Math.abs(Math.round(delta)).toLocaleString("en-US");
    var msg = b.hasCurrent
      ? deltaStr + (above ? " por encima de tu media mensual" : " por debajo de tu media mensual")
      : "Aún sin operaciones este mes";
    function cell(label, value, vStyle) {
      return h("div", null,
        h("div", { style: "font-size:11px;color:#807B72;" }, label),
        h("div", { style: "font-family:'Geist Mono',monospace;font-size:20px;font-weight:600;margin-top:4px;" + (vStyle || "") }, value));
    }
    return h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:18px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;" },
      h("div", null,
        h("div", { style: "font-size:14px;font-weight:600;" }, "Este mes vs. tu histórico"),
        h("div", { style: "font-size:12px;color:#A39E94;margin-top:3px;" }, "Comparado con la media de " + b.months + (b.months === 1 ? " mes anterior" : " meses anteriores"))),
      h("div", { style: "display:flex;align-items:center;gap:28px;" },
        cell("Este mes", signed(b.current), pnlColor(b.current)),
        cell("Media mensual", signed(b.avg), pnlColor(b.avg)),
        h("div", { style: "padding:8px 14px;border-radius:10px;font-size:12.5px;font-weight:600;" + (above ? "background:#E8F3EC;color:#16915B;" : "background:#FBEAE7;color:#D6483B;") }, msg)));
  }
  function riskTrackerPanel() {
    var rk = riskStatus();
    if (!rk.hasRules) {
      return h("div", { style: "background:#fff;border:1px dashed #E2DDD3;border-radius:14px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;" },
        h("div", null,
          h("div", { style: "font-size:13.5px;font-weight:600;" }, "Control de riesgo diario y semanal"),
          h("div", { style: "font-size:12.5px;color:#A39E94;margin-top:2px;" }, "Define tus límites (operaciones y pérdida máxima) para que Bitácora te avise si los rompes.")),
        h("button", { style: "font-size:12.5px;font-weight:600;color:#fff;background:#16181C;border-radius:9px;padding:9px 14px;", onClick: function () { setView("settings"); } }, "Configurar reglas"));
    }
    function meter(label, valueStr, valueStyle, pct, danger) {
      return h("div", { style: "flex:1;min-width:160px;" },
        h("div", { style: "display:flex;align-items:baseline;justify-content:space-between;margin-bottom:7px;" },
          h("span", { style: "font-size:12px;color:#807B72;" }, label),
          h("span", { style: "font-family:'Geist Mono',monospace;font-size:13.5px;font-weight:600;" + (valueStyle || "") }, valueStr)),
        h("div", { style: "height:7px;background:#F1EDE5;border-radius:4px;overflow:hidden;" },
          h("div", { style: "height:100%;border-radius:4px;width:" + Math.max(0, Math.min(100, pct)).toFixed(0) + "%;" + (danger ? "background:#D6483B;" : "background:#16915B;") })));
    }
    var meters = [];
    if (rk.maxT) meters.push(meter("Operaciones hoy", rk.tradesToday + " / " + rk.maxT, "", rk.tradesToday / rk.maxT * 100, rk.tradesToday >= rk.maxT));
    if (rk.maxD) { var dl = rk.pnlToday < 0 ? -rk.pnlToday : 0; meters.push(meter("Pérdida hoy", signed(rk.pnlToday), pnlColor(rk.pnlToday), dl / rk.maxD * 100, dl >= rk.maxD)); }
    if (rk.maxW) { var wl = rk.pnlWeek < 0 ? -rk.pnlWeek : 0; meters.push(meter("Pérdida esta semana", signed(rk.pnlWeek), pnlColor(rk.pnlWeek), wl / rk.maxW * 100, wl >= rk.maxW)); }
    return h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:18px 20px;" },
      h("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;" },
        h("div", { style: "font-size:14px;font-weight:600;" }, "Control de riesgo"),
        rk.breaches.length
          ? h("span", { style: "font-size:11.5px;font-weight:600;color:#D6483B;background:#FBEAE7;padding:4px 10px;border-radius:20px;" }, "Regla rota")
          : h("span", { style: "font-size:11.5px;font-weight:600;color:#16915B;background:#E8F3EC;padding:4px 10px;border-radius:20px;" }, "Dentro de tus límites")),
      h("div", { style: "display:flex;gap:24px;flex-wrap:wrap;" }, meters));
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
      h("div", { class: "trades-card", style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;overflow:hidden;" },
        h("div", { class: "trades-scroll" }, headerRow, bodyRows)));
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
    var sessG = {}, sessCnt = {}, timed = 0;
    SESSIONS.forEach(function (sname) { sessG[sname] = 0; sessCnt[sname] = 0; });
    var hourG = {};
    state.trades.forEach(function (t) {
      var sname = sessionOf(t.time);
      if (sname) { sessG[sname] += t.pnl; sessCnt[sname]++; timed++; }
      if (t.time) { var hr = parseInt(t.time.slice(0, 2), 10); if (!isNaN(hr)) hourG[hr] = (hourG[hr] || 0) + t.pnl; }
    });
    var sessionData = SESSIONS.filter(function (sname) { return sessCnt[sname]; }).map(function (sname) { return { label: sname, value: sessG[sname] }; });
    var hourData = Object.keys(hourG).map(Number).sort(function (a, b) { return a - b; }).map(function (hr) { return { label: hr + "h", value: hourG[hr] }; });
    return h("div", { style: "max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:18px;" },
      h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:20px;" },
        h("div", { style: "font-size:14px;font-weight:600;margin-bottom:10px;" }, "Curva de capital"),
        h("div", null, equityEl())),
      h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:18px;" },
        analyticsCard("P&L por día de la semana", "acumulado por sesión", barsEl(weekdayData, { w: 460, h: 226 })),
        analyticsCard("P&L por emoción", "psicología vs. resultado", barsEl(emotionData, { w: 460, h: 226 }))),
      timed ? h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:18px;" },
        analyticsCard("P&L por sesión", "Asia · Londres · Nueva York (según la hora)", barsEl(sessionData, { w: 460, h: 226 })),
        analyticsCard("P&L por hora", "por hora de entrada", barsEl(hourData, { w: 460, h: 226 }))) :
        h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:18px;display:flex;align-items:center;gap:12px;" },
          icon('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A39E94" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>'),
          h("div", null,
            h("div", { style: "font-size:13.5px;font-weight:600;" }, "P&L por sesión y por hora"),
            h("div", { style: "font-size:12.5px;color:#A39E94;margin-top:2px;" }, "Añade la hora a tus operaciones para desbloquear el análisis por sesión (Asia/Londres/NY) y por hora del día."))),
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

  // ---------- estadísticas avanzadas ----------
  function statCard(label, value, valueStyle, hint) {
    return h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:13px;padding:15px 16px;" },
      h("div", { style: "font-size:11.5px;color:#807B72;font-weight:500;min-height:28px;" }, label),
      h("div", { style: "font-family:'Geist Mono',monospace;font-size:21px;font-weight:600;letter-spacing:-0.5px;margin-top:4px;" + (valueStyle || "") }, value),
      hint ? h("div", { style: "font-size:11px;color:#A39E94;margin-top:5px;line-height:1.35;" }, hint) : null);
  }
  function statSection(title, sub, cards, cols) {
    return h("div", { style: "background:#FBFAF7;border:1px solid #ECE7DD;border-radius:16px;padding:18px;" },
      h("div", { style: "margin-bottom:13px;" },
        h("div", { style: "font-size:14.5px;font-weight:600;" }, title),
        sub ? h("div", { style: "font-size:12px;color:#A39E94;margin-top:2px;" }, sub) : null),
      h("div", { style: "display:grid;grid-template-columns:repeat(" + (cols || 4) + ",1fr);gap:12px;" }, cards));
  }
  function statsView() {
    if (!state.trades.length) {
      return h("div", { style: "max-width:1180px;margin:0 auto;" }, emptyCard("Sin datos para las estadísticas", "Registra operaciones y aquí verás métricas profesionales: expectativa en R, SQN, Sharpe, Sortino, Kelly, drawdown, rachas y distribución."));
    }
    var x = advancedStats();
    var moneyS = function (v) { return signed(v); };
    return h("div", { style: "max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:16px;" },
      statSection("Rentabilidad", "Resultado y calidad del beneficio · " + x.n + " operaciones", [
        statCard("P&L neto", signed(x.net), pnlColor(x.net), money(x.gp) + " brutos / " + money(x.gl) + " en pérdidas"),
        statCard("Profit factor", ratioStr(x.pf), x.pf >= 1 ? "color:#16915B;" : "color:#D6483B;", "Beneficio bruto ÷ pérdida bruta. >1 es rentable."),
        statCard("Expectativa / op.", signed(x.expectancy), pnlColor(x.expectancy), "Lo que esperas ganar por operación de media."),
        statCard("Expectativa en R", rStr(x.expR), pnlColor(x.expR), "Ganancia media por operación medida en múltiplos de riesgo."),
        statCard("Ganancia media", signed(x.avgWin), "color:#16915B;", x.wins + " ganadoras"),
        statCard("Pérdida media", signed(x.avgLoss), "color:#D6483B;", x.losses + " perdedoras"),
        statCard("Ratio de pago", ratioStr(x.payoff), "", "Ganancia media ÷ pérdida media (payoff)."),
        statCard("Win rate", Math.round(x.wr * 100) + "%", "", x.wins + "G · " + x.losses + "P · " + x.be + " BE"),
      ]),
      statSection("Calidad del sistema y riesgo ajustado", "1R = pérdida media (" + money(x.rUnit) + ") al no haber stop registrado", [
        statCard("SQN", ratioStr(x.sqn), x.sqn >= 2 ? "color:#16915B;" : (x.sqn < 1 ? "color:#D6483B;" : ""), "System Quality Number (Van Tharp). >2 bueno, >3 excelente."),
        statCard("Sharpe (por op.)", ratioStr(x.sharpe), "", "Rendimiento medio ÷ desviación típica."),
        statCard("Sortino (por op.)", ratioStr(x.sortino), "", "Como Sharpe pero penaliza solo la volatilidad a la baja."),
        statCard("Kelly", Math.round(x.kelly * 100) + "%", "", "Fracción óptima teórica. Prudente: la mitad (" + Math.round(x.kelly * 50) + "%)."),
        statCard("Desv. típica P&L", money(x.sd), "", "Dispersión de resultados por operación."),
        statCard("Volatilidad en R", ratioStr(x.sdR) + "R", "", "Desviación típica de los R-múltiplos."),
      ], 3),
      statSection("Drawdown y rachas", "Resistencia del sistema en el peor tramo", [
        statCard("Drawdown máximo", "−" + money(x.maxDD), "color:#D6483B;", "Mayor caída desde un máximo de capital."),
        statCard("Duración del DD", x.maxDDDur + " ops", "", "Operaciones seguidas por debajo del máximo."),
        statCard("Factor de recuperación", ratioStr(x.recovery), "", "P&L neto ÷ drawdown máximo."),
        statCard("Racha ganadora máx.", x.maxWinStreak, "color:#16915B;", "Mayor nº de ganadoras seguidas."),
        statCard("Racha perdedora máx.", x.maxLossStreak, "color:#D6483B;", "Mayor nº de perdedoras seguidas."),
        statCard("Racha actual", (x.curStreak > 0 ? "+" : "") + x.curStreak, x.curStreak >= 0 ? "color:#16915B;" : "color:#D6483B;", x.curStreak >= 0 ? "ganadoras seguidas" : "perdedoras seguidas"),
      ], 3),
      statSection("Distribución de resultados", "Cómo se reparten tus operaciones", [
        statCard("Mejor operación", signed(x.best), "color:#16915B;"),
        statCard("Peor operación", signed(x.worst), "color:#D6483B;"),
        statCard("Mediana", signed(x.median), pnlColor(x.median), "El resultado del 50% central."),
        statCard("Percentil 25", signed(x.p25), pnlColor(x.p25)),
        statCard("Percentil 75", signed(x.p75), pnlColor(x.p75)),
        statCard("Operaciones BE", x.be, "", "Cerradas en empate."),
      ], 3),
      h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:16px;padding:18px;" },
        h("div", { style: "font-size:14.5px;font-weight:600;margin-bottom:2px;" }, "Distribución de P&L por operación"),
        h("div", { style: "font-size:12px;color:#A39E94;margin-bottom:10px;" }, "Histograma: nº de operaciones por rango de resultado"),
        histogramEl(state.trades.map(function (t) { return t.pnl; }))),
      h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:16px;padding:18px;" },
        h("div", { style: "font-size:14.5px;font-weight:600;margin-bottom:2px;" }, "Curva de drawdown (underwater)"),
        h("div", { style: "font-size:12px;color:#A39E94;margin-bottom:10px;" }, "Distancia bajo el máximo de capital a lo largo del tiempo"),
        drawdownEl()),
      statSection("Consistencia por día", x.days + " días de trading · " + x.greenDays + " verdes", [
        statCard("% días verdes", Math.round(x.dayWr * 100) + "%", x.dayWr >= 0.5 ? "color:#16915B;" : ""),
        statCard("P&L medio / día", signed(x.avgDay), pnlColor(x.avgDay)),
        statCard("Mejor día", signed(x.bestDay), "color:#16915B;"),
        statCard("Peor día", signed(x.worstDay), "color:#D6483B;"),
      ]),
      (x.avgMae != null || x.avgMfe != null) ? statSection("Eficiencia MAE / MFE", "Excursión adversa y favorable (solo operaciones con datos)", [
        statCard("MAE medio", x.avgMae == null ? "—" : num(x.avgMae), "color:#D6483B;", "Cuánto fueron en tu contra de media."),
        statCard("MFE medio", x.avgMfe == null ? "—" : num(x.avgMfe), "color:#16915B;", "Cuánto fueron a tu favor de media."),
        statCard("Edge ratio", x.edge == null ? "—" : ratioStr(x.edge), x.edge != null && x.edge >= 1 ? "color:#16915B;" : "", "MFE medio ÷ MAE medio. >1 indica ventaja."),
      ], 3) : null);
  }

  // ---------- correlaciones ----------
  var WD = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  function numericFactors() {
    return [
      { key: "rating", label: "Valoración (estrellas)", get: function (t) { return t.rating; } },
      { key: "contracts", label: "Tamaño (contratos)", get: function (t) { return t.contracts; } },
      { key: "hour", label: "Hora de entrada", get: function (t) { return t.time ? parseInt(t.time.slice(0, 2), 10) : null; } },
      { key: "mae", label: "MAE (excursión adversa)", get: function (t) { return t.mae !== "" && t.mae != null ? Math.abs(Number(t.mae)) : null; } },
      { key: "mfe", label: "MFE (excursión favorable)", get: function (t) { return t.mfe !== "" && t.mfe != null ? Math.abs(Number(t.mfe)) : null; } },
    ];
  }
  function categoricalFactors() {
    return [
      { key: "emotion", label: "Emoción", get: function (t) { return t.emotion; } },
      { key: "setup", label: "Setup", get: function (t) { return t.setup; } },
      { key: "side", label: "Dirección", get: function (t) { return t.side === "long" ? "Largo" : "Corto"; } },
      { key: "session", label: "Sesión", get: function (t) { return sessionOf(t.time); } },
      { key: "weekday", label: "Día de la semana", get: function (t) { return WD[new Date(t.date + "T12:00:00").getDay()]; } },
      { key: "symbol", label: "Símbolo", get: function (t) { return t.symbol; } },
      { key: "account", label: "Cuenta", get: function (t) { return accountName(t.account_id) || "Sin cuenta"; } },
      { key: "tag", label: "Etiqueta", multi: true, get: function (t) { return t.tags || []; } },
    ];
  }
  var RESULTS = {
    expectancy: { label: "Expectativa / op.", agg: function (p) { return mean(p); }, fmt: signed, color: pnlColor },
    net: { label: "P&L neto", agg: function (p) { return p.reduce(function (a, x) { return a + x; }, 0); }, fmt: signed, color: pnlColor },
    winrate: { label: "Win rate", agg: function (p) { return p.filter(function (x) { return x > 0; }).length / p.length * 100; }, fmt: function (v) { return Math.round(v) + "%"; }, color: function () { return ""; } },
    expR: { label: "Expectativa en R", agg: function (p, ru) { return ru > 0 ? mean(p) / ru : 0; }, fmt: rStr, color: pnlColor },
  };
  // Group trades by a categorical factor → [{key,count,pnls,value}] for a result.
  function groupByFactor(f, resultKey) {
    var ru = rUnitOf(state.trades), R = RESULTS[resultKey];
    var g = {};
    state.trades.forEach(function (t) {
      var keys = f.multi ? f.get(t) : [f.get(t)];
      keys.forEach(function (k) {
        if (k == null || k === "") return;
        if (!g[k]) g[k] = [];
        g[k].push(t.pnl);
      });
    });
    return Object.keys(g).map(function (k) {
      return { key: k, count: g[k].length, value: R.agg(g[k], ru) };
    }).sort(function (a, b) { return b.value - a.value; });
  }
  function correlationsView() {
    if (state.trades.length < 3) {
      return h("div", { style: "max-width:1180px;margin:0 auto;" }, emptyCard("Aún no hay suficientes datos", "Registra al menos 3 operaciones (mejor con valoración, emoción, hora y etiquetas) para descubrir qué factores se correlacionan con tus resultados."));
    }
    var ru = rUnitOf(state.trades);
    // ---- Auto-insights: numeric Pearson r vs P&L ----
    var numInsights = numericFactors().map(function (f) {
      var pairs = state.trades.map(function (t) { return { x: f.get(t), y: t.pnl }; }).filter(function (p) { return p.x != null && !isNaN(p.x); });
      if (pairs.length < 3) return null;
      var r = pearson(pairs.map(function (p) { return p.x; }), pairs.map(function (p) { return p.y; }));
      return { label: f.label, r: r, n: pairs.length };
    }).filter(Boolean).sort(function (a, b) { return Math.abs(b.r) - Math.abs(a.r); });
    var maxR = Math.max.apply(null, [0.0001].concat(numInsights.map(function (x) { return Math.abs(x.r); })));
    var numRows = numInsights.map(function (x) {
      return h("div", { class: "corr-grid", style: "display:grid;grid-template-columns:minmax(120px,1.3fr) 1fr 150px;gap:14px;align-items:center;" },
        h("span", { style: "font-size:13px;font-weight:600;" }, x.label),
        h("div", { class: "corr-bar", style: "height:8px;background:#F1EDE5;border-radius:4px;overflow:hidden;" }, h("div", { style: "height:100%;border-radius:4px;width:" + (Math.abs(x.r) / maxR * 100).toFixed(0) + "%;" + (x.r >= 0 ? "background:#16915B;" : "background:#D6483B;") })),
        h("span", { style: "text-align:right;font-family:'Geist Mono',monospace;font-size:13px;font-weight:600;" + corrColor(x.r) }, (x.r >= 0 ? "+" : "−") + Math.abs(x.r).toFixed(2) + " · " + corrStrength(x.r)));
    });
    // ---- Auto-insights: best/worst categorical by expectancy ----
    var catRows = categoricalFactors().map(function (f) {
      var groups = groupByFactor(f, "expectancy").filter(function (gr) { return gr.count >= 2; });
      if (groups.length < 2) return null;
      var best = groups[0], worst = groups[groups.length - 1];
      return h("div", { style: "display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid #F3EFE7;" },
        h("span", { style: "font-size:13px;font-weight:600;flex:none;width:140px;" }, f.label),
        h("div", { style: "display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;flex:1;" },
          h("span", { style: "font-size:12px;background:#E8F3EC;color:#16915B;border-radius:20px;padding:3px 10px;font-weight:600;" }, "Mejor: " + best.key + " (" + signed(best.value) + "/op)"),
          h("span", { style: "font-size:12px;background:#FBEAE7;color:#D6483B;border-radius:20px;padding:3px 10px;font-weight:600;" }, "Peor: " + worst.key + " (" + signed(worst.value) + "/op)")));
    }).filter(Boolean);
    // ---- Explorer ----
    var allFactors = numericFactors().map(function (f) { return { f: f, type: "num" }; }).concat(categoricalFactors().map(function (f) { return { f: f, type: "cat" }; }));
    var sel = null;
    for (var k = 0; k < allFactors.length; k++) if (allFactors[k].f.key === state.corrFactor) sel = allFactors[k];
    if (!sel) sel = allFactors[0];
    var factorSelect = h("select", { style: "font-size:13px;padding:9px 11px;border:1px solid #E2DDD3;border-radius:9px;background:#fff;font-weight:500;cursor:pointer;", onChange: function (e) { state.corrFactor = e.target.value; render(); } },
      allFactors.map(function (a) { return h("option", { value: a.f.key }, a.f.label); }));
    factorSelect.value = sel.f.key;
    var resNum = sel.type === "num";
    var resultSelect = h("select", { disabled: resNum, title: resNum ? "Para factores numéricos se mide la correlación con el P&L" : "", style: "font-size:13px;padding:9px 11px;border:1px solid #E2DDD3;border-radius:9px;background:#fff;font-weight:500;cursor:pointer;" + (resNum ? "opacity:.5;cursor:not-allowed;" : ""), onChange: function (e) { state.corrResult = e.target.value; render(); } },
      Object.keys(RESULTS).map(function (rk) { return h("option", { value: rk }, RESULTS[rk].label); }));
    resultSelect.value = resNum ? "net" : state.corrResult;
    var explorer;
    if (sel.type === "num") {
      var pairs = state.trades.map(function (t) { return { x: sel.f.get(t), y: t.pnl }; }).filter(function (p) { return p.x != null && !isNaN(p.x); });
      var r = pairs.length >= 2 ? pearson(pairs.map(function (p) { return p.x; }), pairs.map(function (p) { return p.y; })) : 0;
      explorer = h("div", null,
        h("div", { style: "display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:12px;" },
          h("div", null, h("div", { style: "font-size:11px;color:#807B72;" }, "Correlación de Pearson (r) con el P&L"),
            h("div", { style: "font-family:'Geist Mono',monospace;font-size:24px;font-weight:600;" + corrColor(r) }, (r >= 0 ? "+" : "−") + Math.abs(r).toFixed(2))),
          h("div", { style: "font-size:13px;color:#54514A;" }, "Correlación " + corrStrength(r) + " · " + pairs.length + " operaciones con dato")),
        pairs.length >= 2 ? scatterEl(pairs, sel.f.label) : h("div", { style: "font-size:13px;color:#A39E94;padding:20px;text-align:center;" }, "Sin datos suficientes para este factor."));
    } else {
      var R = RESULTS[state.corrResult];
      var groups = groupByFactor(sel.f, state.corrResult);
      var maxAbs = Math.max.apply(null, [1].concat(groups.map(function (g) { return Math.abs(g.value); })));
      explorer = h("div", { style: "display:flex;flex-direction:column;gap:11px;" }, groups.length ? groups.map(function (g) {
        return h("div", { class: "corr-grid", style: "display:grid;grid-template-columns:minmax(90px,1fr) 2fr 130px;gap:14px;align-items:center;" },
          h("span", { style: "font-size:13px;font-weight:600;" }, g.key),
          h("div", { class: "corr-bar", style: "height:9px;background:#F1EDE5;border-radius:4px;overflow:hidden;" }, h("div", { style: "height:100%;border-radius:4px;width:" + (Math.abs(g.value) / maxAbs * 100).toFixed(0) + "%;" + (g.value >= 0 ? "background:#16915B;" : "background:#D6483B;") })),
          h("span", { style: "text-align:right;font-family:'Geist Mono',monospace;font-size:13px;font-weight:600;" + (R.color(g.value) || "") }, R.fmt(g.value) + "  ·  " + g.count + " op"));
      }) : h("div", { style: "font-size:13px;color:#A39E94;padding:16px;text-align:center;" }, "Sin datos para este factor."));
    }
    return h("div", { style: "max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:18px;" },
      numRows.length ? h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:16px;padding:20px;" },
        h("div", { style: "font-size:15px;font-weight:600;margin-bottom:2px;" }, "Qué influye en tu P&L"),
        h("div", { style: "font-size:12.5px;color:#A39E94;margin-bottom:14px;" }, "Correlación (Pearson) de cada factor numérico con el resultado de la operación"),
        h("div", { style: "display:flex;flex-direction:column;gap:12px;" }, numRows)) : null,
      catRows.length ? h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:16px;padding:20px;" },
        h("div", { style: "font-size:15px;font-weight:600;margin-bottom:2px;" }, "Tu mejor y peor contexto"),
        h("div", { style: "font-size:12.5px;color:#A39E94;margin-bottom:6px;" }, "Categoría con mayor y menor expectativa por operación (mín. 2 ops)"),
        h("div", null, catRows)) : null,
      h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:16px;padding:20px;" },
        h("div", { style: "display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px;" },
          h("div", { style: "font-size:15px;font-weight:600;margin-right:auto;" }, "Explorador"),
          h("span", { style: "font-size:12px;color:#807B72;" }, "Factor"), factorSelect,
          h("span", { style: "font-size:12px;color:#807B72;" }, "Resultado"), resultSelect),
        explorer),
      h("div", { style: "font-size:11.5px;color:#A39E94;text-align:center;padding:0 20px 8px;" }, "La correlación no implica causalidad. Con muestras pequeñas los resultados son orientativos."));
  }

  // ---------- diario ----------
  function journalView() {
    var moodColors = { Disciplinado: "#E8F3EC;color:#16915B", Enfocado: "#EAF0F7;color:#3D6FB0", Paciente: "#EAF0F7;color:#3D6FB0", Frustrado: "#FBEAE7;color:#D6483B", Codicioso: "#FBF1E6;color:#C77B2A", Neutral: "#F1EDE5;color:#54514A" };
    var topBar = h("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;" },
      h("div", { style: "font-size:13px;color:#A39E94;" }, state.journal.length + (state.journal.length === 1 ? " entrada" : " entradas")),
      h("button", { style: "display:flex;align-items:center;gap:7px;background:#fff;border:1px solid #E2DDD3;color:#16181C;font-weight:600;font-size:13px;padding:8px 13px;border-radius:9px;", hoverBg: "#FAF8F4", onClick: openJournalAdd },
        icon('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'), "Nueva entrada"));
    var quick = quickJournalBar();
    if (!state.journal.length) {
      return h("div", { style: "max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:14px;" }, topBar, quick,
        emptyCard("Tu diario está vacío", "Escribe tu primera reflexión: cómo te sentiste, qué aprendiste, qué mejorar."));
    }
    // Build cards (with live, focus-preserving DOM filtering).
    var refs = [];
    var cards = state.journal.map(function (j) {
      var dayTrades = state.trades.filter(function (t) { return t.date === j.date; });
      var dayPnl = dayTrades.reduce(function (a, t) { return a + t.pnl; }, 0);
      var moodStyle = "display:inline-flex;padding:4px 11px;border-radius:20px;font-size:12px;font-weight:600;background:#" + (moodColors[j.mood] || "F1EDE5;color:#54514A");
      var tradeChips = dayTrades.length ? h("div", { style: "display:flex;flex-wrap:wrap;gap:6px;margin-top:14px;padding-top:13px;border-top:1px solid #F3EFE7;" },
        h("span", { style: "font-size:11px;color:#A39E94;align-self:center;margin-right:2px;" }, dayTrades.length + " op. ese día:"),
        dayTrades.map(function (t) {
          return h("button", { title: "Ver operación", onClick: function () { select(t.id); }, style: "display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;background:#FBFAF7;border:1px solid #ECE7DD;font-family:'Geist Mono',monospace;", hoverBg: "#F1EDE5" },
            h("span", { style: "font-family:Geist,sans-serif;" }, t.symbol),
            h("span", { style: pnlColor(t.pnl) }, signed(t.pnl)));
        })) : null;
      var editBtn = h("button", { title: "Editar entrada", onClick: function () { openJournalEdit(j); }, style: "width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#807B72;flex:none;", hoverBg: "#FAF8F4" },
        icon('<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>'));
      var el = h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:20px 22px;" },
        h("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px;" },
          h("div", { style: "display:flex;align-items:center;gap:11px;min-width:0;" },
            h("span", { style: "font-size:13px;font-weight:600;color:#807B72;font-family:'Geist Mono',monospace;" }, fmtDateLong(j.date)),
            j.mood ? h("span", { style: moodStyle }, j.mood) : null),
          h("div", { style: "display:flex;align-items:center;gap:8px;flex:none;" },
            h("span", { style: "font-family:'Geist Mono',monospace;font-weight:600;font-size:14px;" + pnlColor(dayPnl) }, signed(dayPnl)),
            editBtn)),
        h("div", { style: "font-size:15.5px;font-weight:600;margin-bottom:6px;letter-spacing:-0.2px;" }, j.title),
        j.body ? h("div", { style: "font-size:13.5px;color:#54514A;line-height:1.6;" }, j.body) : null,
        j.lesson ? h("div", { style: "display:flex;gap:9px;margin-top:14px;padding-top:13px;border-top:1px solid #F3EFE7;align-items:flex-start;" },
          icon('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16915B" stroke-width="2" style="flex:none;margin-top:1px;"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'),
          h("span", { style: "font-size:13px;color:#16181C;line-height:1.5;" }, h("b", { style: "font-weight:600;" }, "Lección: "), j.lesson)) : null,
        tradeChips);
      refs.push({ el: el, text: (j.date + " " + fmtDateLong(j.date) + " " + j.mood + " " + j.title + " " + j.body + " " + j.lesson).toLowerCase(), mood: j.mood });
      return el;
    });
    var countEl = h("span", { style: "font-size:12.5px;color:#807B72;font-family:'Geist Mono',monospace;" });
    function applyFilter() {
      var q = (state.jSearch || "").trim().toLowerCase(), shown = 0;
      refs.forEach(function (r) {
        var ok = (state.jMood === "all" || r.mood === state.jMood) && (!q || r.text.indexOf(q) >= 0);
        r.el.style.display = ok ? "" : "none";
        if (ok) shown++;
      });
      countEl.textContent = shown + " de " + refs.length;
    }
    var searchInput = h("input", { placeholder: "Buscar en el diario…", style: "flex:1;min-width:120px;padding:9px 12px;border:1px solid #E2DDD3;border-radius:9px;font-size:13.5px;", onInput: function (e) { state.jSearch = e.target.value; applyFilter(); } });
    searchInput.value = state.jSearch;
    var moodFilter = h("select", { style: "font-size:12.5px;padding:9px 11px;border:1px solid #ECE7DD;border-radius:9px;background:#fff;font-weight:500;cursor:pointer;", onChange: function (e) { state.jMood = e.target.value; applyFilter(); } },
      [h("option", { value: "all" }, "Todos los ánimos")].concat(["Disciplinado", "Enfocado", "Paciente", "Neutral", "Frustrado", "Codicioso"].map(function (mm) { return h("option", { value: mm }, mm); })));
    moodFilter.value = state.jMood;
    var filterBar = h("div", { style: "display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:10px 12px;" },
      searchInput, moodFilter, countEl);
    applyFilter();
    return h("div", { style: "max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:14px;" },
      topBar, quick, filterBar,
      moodPerformancePanel(moodColors),
      h("div", { style: "display:flex;flex-direction:column;gap:14px;" }, cards),
      lessonsLibrary());
  }
  // Average day P&L grouped by the journal mood logged that day.
  function moodPerformancePanel(moodColors) {
    var g = {};
    state.journal.forEach(function (j) {
      if (!j.mood) return;
      var dayPnl = state.trades.filter(function (t) { return t.date === j.date; }).reduce(function (a, t) { return a + t.pnl; }, 0);
      if (!g[j.mood]) g[j.mood] = { sum: 0, count: 0 };
      g[j.mood].sum += dayPnl; g[j.mood].count++;
    });
    var order = ["Disciplinado", "Enfocado", "Paciente", "Neutral", "Frustrado", "Codicioso"];
    var data = order.filter(function (m) { return g[m]; }).map(function (m) { return { label: m, value: g[m].sum / g[m].count }; });
    if (data.length < 2) return null;
    return h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:18px;" },
      h("div", { style: "font-size:14px;font-weight:600;margin-bottom:2px;" }, "Ánimo vs. resultado"),
      h("div", { style: "font-size:12px;color:#A39E94;margin-bottom:10px;" }, "P&L medio del día según tu estado de ánimo"),
      barsEl(data, { w: 760, h: 220 }));
  }
  // All recorded lessons, newest first.
  function lessonsLibrary() {
    var withLesson = state.journal.filter(function (j) { return j.lesson && j.lesson.trim(); });
    if (!withLesson.length) return null;
    return h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:18px;" },
      h("div", { style: "display:flex;align-items:center;gap:8px;margin-bottom:12px;" },
        icon('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16915B" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'),
        h("div", { style: "font-size:14px;font-weight:600;" }, "Biblioteca de lecciones"),
        h("span", { style: "font-size:11.5px;color:#A39E94;font-family:'Geist Mono',monospace;" }, withLesson.length)),
      h("div", { style: "display:flex;flex-direction:column;gap:9px;" }, withLesson.map(function (j) {
        return h("div", { style: "display:flex;gap:10px;align-items:baseline;padding:8px 0;border-top:1px solid #F3EFE7;" },
          h("span", { style: "font-size:11px;color:#A39E94;font-family:'Geist Mono',monospace;flex:none;width:88px;" }, fmtDateLong(j.date)),
          h("span", { style: "font-size:13px;color:#33312C;line-height:1.5;" }, j.lesson));
      })));
  }
  // Journal en 10 segundos: nota de una línea + estado de ánimo, sin abrir el modal.
  function quickJournalBar() {
    var moodSel = h("select", { style: "font-size:12.5px;padding:9px 11px;border:1px solid #E2DDD3;border-radius:9px;background:#fff;font-weight:500;cursor:pointer;flex:none;", onChange: function (e) { state.quickMood = e.target.value; } },
      [["Disciplinado", "Disciplinado"], ["Enfocado", "Enfocado"], ["Paciente", "Paciente"], ["Neutral", "Neutral"], ["Frustrado", "Frustrado"], ["Codicioso", "Codicioso"]].map(function (o) { return h("option", { value: o[0] }, o[1]); }));
    moodSel.value = state.quickMood;
    var input = h("input", { placeholder: "Nota rápida de hoy… (Enter para guardar)", style: "flex:1;min-width:0;padding:10px 12px;border:1px solid #E2DDD3;border-radius:9px;font-size:14px;", onInput: function (e) { state.quickNote = e.target.value; } });
    input.value = state.quickNote;
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") saveJournalQuick(); });
    var btn = h("button", { style: "flex:none;background:#16181C;color:#fff;font-weight:600;font-size:13px;padding:10px 16px;border-radius:9px;", onClick: saveJournalQuick }, "Guardar");
    return h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;" },
      moodSel, input, btn);
  }

  // ---------- ajustes ----------
  function settingsView() {
    var s = state.settings;
    var inBase = "padding:10px 12px;border:1px solid #E2DDD3;border-radius:9px;font-size:14px;width:100%;";
    var mono = inBase + "font-family:'Geist Mono',monospace;";
    function ruleField(label, hint, name) {
      var inp = h("input", { type: "number", min: "0", step: "1", placeholder: "Sin límite", style: mono, onInput: function (e) { s.rules[name] = e.target.value; state.settingsSaved = false; } });
      inp.value = s.rules[name];
      return h("label", { style: "display:flex;flex-direction:column;gap:6px;" },
        h("span", { style: "font-size:12.5px;font-weight:600;color:#54514A;" }, label),
        inp,
        h("span", { style: "font-size:11.5px;color:#A39E94;" }, hint));
    }
    var clText = (s.checklist || []).join("\n");
    var clTa = h("textarea", { rows: "6", placeholder: "Una pregunta por línea…", style: inBase + "line-height:1.6;resize:vertical;", onInput: function (e) { s.checklist = e.target.value.split("\n"); state.settingsSaved = false; } });
    clTa.value = clText;
    var saveBtn = h("button", { style: "background:#16181C;color:#fff;font-weight:600;font-size:13.5px;padding:11px 20px;border-radius:10px;", onClick: saveSettings }, "Guardar ajustes");
    return h("div", { style: "max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:18px;" },
      h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:22px;" },
        h("div", { style: "font-size:15px;font-weight:600;margin-bottom:3px;" }, "Reglas de riesgo"),
        h("div", { style: "font-size:12.5px;color:#A39E94;margin-bottom:16px;" }, "Bitácora te avisará con una alerta cuando rompas cualquiera de estos límites. Déjalo en blanco para no fijar límite."),
        h("div", { style: "display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;" },
          ruleField("Máx. operaciones / día", "Nº de operaciones antes de parar", "maxTradesPerDay"),
          ruleField("Pérdida máx. diaria ($)", "Pérdida que no quieres superar en un día", "maxDailyLoss"),
          ruleField("Pérdida máx. semanal ($)", "Pérdida que no quieres superar en la semana", "maxWeeklyLoss"))),
      h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:22px;" },
        h("div", { style: "font-size:15px;font-weight:600;margin-bottom:3px;" }, "Checklist antes de operar"),
        h("div", { style: "font-size:12.5px;color:#A39E94;margin-bottom:16px;" }, "Las preguntas que repasarás al pulsar “Checklist” en la barra superior. Una por línea."),
        clTa),
      h("div", { style: "display:flex;align-items:center;gap:14px;" },
        saveBtn,
        state.settingsSaved ? h("span", { style: "font-size:12.5px;color:#16915B;font-weight:600;" }, "✓ Ajustes guardados") : null),
      h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:22px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;" },
        h("div", null,
          h("div", { style: "font-size:15px;font-weight:600;margin-bottom:3px;" }, "Seguridad · Verificación en dos pasos (2FA)"),
          h("div", { style: "font-size:12.5px;color:#A39E94;max-width:520px;" }, "Añade un código de tu app de autenticación (TOTP) al iniciar sesión. Requiere tener MFA activado en el proyecto de Supabase.")),
        h("button", { style: "background:#16181C;color:#fff;font-weight:600;font-size:13.5px;padding:11px 18px;border-radius:10px;flex:none;", onClick: openMfa },
          icon('<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:6px;"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'), "Gestionar 2FA")));
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
              h("div", { style: "font-size:11.5px;color:#A39E94;" }, instr + " · " + fmtDateLong(st.date) + (st.time ? " · " + st.time : "")))),
          h("button", { style: "width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#807B72;", hoverBg: "#FAF8F4", onClick: closeDetail }, icon('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'))),
        h("div", { style: "flex:1;overflow-y:auto;padding:22px;" },
          h("div", { style: "background:#FBFAF7;border:1px solid #ECE7DD;border-radius:13px;padding:18px;text-align:center;margin-bottom:18px;" },
            h("div", { style: "font-size:12px;color:#807B72;" }, "Resultado"),
            h("div", { style: "font-family:'Geist Mono',monospace;font-size:34px;font-weight:700;letter-spacing:-1.5px;margin-top:4px;" + pnlColor(st.pnl) }, signed(st.pnl)),
            h("div", { style: "font-size:12px;color:#A39E94;margin-top:4px;" }, movePts),
            (function () { var ru = rUnitOf(state.trades); return ru > 0 ? h("div", { style: "display:inline-block;margin-top:8px;font-family:'Geist Mono',monospace;font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;" + (st.pnl >= 0 ? "background:#E8F3EC;color:#16915B;" : "background:#FBEAE7;color:#D6483B;") }, rStr(st.pnl / ru) + " · 1R = " + money(ru)) : null; })()),
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
    else if (state.showChecklist) root.appendChild(checklistModal());
    else if (state.showMfa) root.appendChild(mfaModal());
  }

  function mfaModal() {
    var en = state.mfaEnroll;
    var body = [];
    // Enrolled factors
    if (!state.mfaFactorsLoaded) {
      body.push(h("div", { style: "font-size:13px;color:#A39E94;padding:14px;text-align:center;" }, "Cargando…"));
    } else if (state.mfaFactors.length) {
      body.push(h("div", { style: "font-size:12px;font-weight:600;color:#54514A;" }, "Autenticadores activos"));
      body.push(h("div", { style: "display:flex;flex-direction:column;gap:8px;" }, state.mfaFactors.map(function (f) {
        return h("div", { style: "display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 13px;border:1px solid #ECE7DD;border-radius:11px;background:#FBFAF7;" },
          h("div", null,
            h("div", { style: "font-size:13px;font-weight:600;" }, f.friendly_name || "Autenticador TOTP"),
            h("div", { style: "font-size:11px;color:#A39E94;" }, f.status === "verified" ? "Verificado" : "Pendiente")),
          h("button", { style: "font-size:12px;font-weight:600;color:#D6483B;border:1px solid #F2D9D5;background:#FCF1EF;border-radius:8px;padding:7px 11px;", hoverBg: "#FBEAE7", onClick: function () { unenrollMfa(f.id); } }, "Quitar"));
      })));
    } else {
      body.push(h("div", { style: "font-size:13px;color:#807B72;" }, "No tienes 2FA configurado. Añade un autenticador para proteger tu cuenta."));
    }
    // Enrollment flow
    if (en.id && en.qr) {
      var codeInput = h("input", { type: "text", inputmode: "numeric", maxlength: "6", placeholder: "000000", style: "width:100%;text-align:center;letter-spacing:8px;font-family:'Geist Mono',monospace;font-size:22px;padding:11px;border:1px solid #E2DDD3;border-radius:10px;", onInput: function (e) { state.mfaEnroll.code = e.target.value.replace(/\D/g, ""); } });
      codeInput.value = en.code;
      codeInput.addEventListener("keydown", function (e) { if (e.key === "Enter") verifyMfaEnroll(); });
      body.push(h("div", { style: "border-top:1px solid #F3EFE7;margin-top:6px;padding-top:16px;display:flex;flex-direction:column;gap:12px;" },
        h("div", { style: "font-size:13px;color:#54514A;" }, "1. Escanea este código QR con Google Authenticator, Authy, 1Password, etc."),
        h("div", { style: "display:flex;justify-content:center;" }, h("img", { src: en.qr, alt: "QR", style: "width:180px;height:180px;border:1px solid #ECE7DD;border-radius:12px;background:#fff;" })),
        en.secret ? h("div", { style: "font-size:11px;color:#A39E94;text-align:center;" }, "o introduce la clave: ", h("span", { style: "font-family:'Geist Mono',monospace;color:#54514A;word-break:break-all;" }, en.secret)) : null,
        h("div", { style: "font-size:13px;color:#54514A;" }, "2. Escribe el código de 6 dígitos que muestra la app:"),
        codeInput));
    }
    if (en.error) body.push(h("div", { style: "font-size:12.5px;color:#D6483B;background:#FCF1EF;border:1px solid #F2D9D5;border-radius:9px;padding:9px 11px;" }, en.error));

    var footer = [h("button", { style: "flex:1;padding:11px;border-radius:10px;border:1px solid #E2DDD3;background:#fff;font-weight:600;font-size:13.5px;", hoverBg: "#FAF8F4", onClick: closeMfa }, "Cerrar")];
    if (en.id && en.qr) {
      footer.push(h("button", { style: "flex:1.4;padding:11px;border-radius:10px;font-weight:600;font-size:13.5px;" + (en.busy ? "background:#CFC9BD;color:#fff;" : "background:#16915B;color:#fff;"), onClick: verifyMfaEnroll }, en.busy ? "Verificando…" : "Activar 2FA"));
    } else {
      footer.push(h("button", { style: "flex:1.4;padding:11px;border-radius:10px;font-weight:600;font-size:13.5px;" + (en.busy ? "background:#CFC9BD;color:#fff;" : "background:#16181C;color:#fff;"), onClick: startMfaEnroll }, en.busy ? "Generando…" : "Añadir autenticador"));
    }
    return modalFrame("Verificación en dos pasos (2FA)", closeMfa, body, footer, 460);
  }

  function checklistModal() {
    var items = state.settings.checklist || [];
    var saveBtn = h("button", { onClick: closeChecklist }, "Todo listo, a operar");
    function refresh() {
      var all = items.length > 0 && state.checkState.every(function (x) { return x; });
      saveBtn.style.cssText = "flex:1.4;padding:11px;border-radius:10px;font-weight:600;font-size:13.5px;" + (all ? "background:#16915B;color:#fff;" : "background:#CFC9BD;color:#fff;cursor:not-allowed;");
      saveBtn.disabled = !all;
    }
    var rows = items.length ? items.map(function (q, i) {
      var box = h("span", { style: "" });
      function paint() {
        var on = state.checkState[i];
        box.style.cssText = "width:22px;height:22px;border-radius:6px;flex:none;display:flex;align-items:center;justify-content:center;border:2px solid " + (on ? "#16915B" : "#D8D2C6") + ";background:" + (on ? "#16915B" : "#fff") + ";color:#fff;font-size:13px;font-weight:700;";
        box.textContent = on ? "✓" : "";
      }
      paint();
      var rowEl = h("button", { style: "display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:12px 14px;border:1px solid #ECE7DD;border-radius:11px;background:#fff;", hoverBg: "#FBFAF7", onClick: function () { state.checkState[i] = !state.checkState[i]; paint(); refresh(); } },
        box, h("span", { style: "font-size:13.5px;" }, q));
      return rowEl;
    }) : [h("div", { style: "font-size:13px;color:#A39E94;text-align:center;padding:20px;" }, "No tienes preguntas en tu checklist. Añádelas en Ajustes.")];
    var body = [
      h("div", { style: "font-size:12.5px;color:#807B72;margin-bottom:2px;" }, "Repasa tu plan antes de entrar. Marca cada punto."),
      h("div", { style: "display:flex;flex-direction:column;gap:8px;" }, rows),
    ];
    var footer = [
      h("button", { style: "flex:1;padding:11px;border-radius:10px;border:1px solid #E2DDD3;background:#fff;font-weight:600;font-size:13.5px;", hoverBg: "#FAF8F4", onClick: closeChecklist }, "Cerrar"),
      saveBtn,
    ];
    var frame = modalFrame("Checklist antes de operar", closeChecklist, body, footer, 460);
    refresh();
    return frame;
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
      h("div", { style: "display:grid;grid-template-columns:1.2fr 1fr 0.9fr;gap:14px;" },
        field("Símbolo", fieldInput(d, "symbol", { placeholder: "MES, NQ, SPY…", style: inMono + "text-transform:uppercase;", onInput: function (e) { d.symbol = e.target.value; refresh(); } })),
        field("Fecha", fieldInput(d, "date", { type: "date", style: inMono })),
        field("Hora (opcional)", fieldInput(d, "time", { type: "time", style: inMono }))),
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
    var editing = state.journalEditId != null;
    var saveBtn = h("button", { onClick: saveJournal }, editing ? "Guardar cambios" : "Guardar entrada");
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
    ];
    if (editing) footer.push(h("button", { style: "flex:1;padding:11px;border-radius:10px;border:1px solid #F2D9D5;background:#FCF1EF;color:#D6483B;font-weight:600;font-size:13.5px;", hoverBg: "#FBEAE7", onClick: function () { deleteJournal(state.journalEditId); } }, "Eliminar"));
    footer.push(saveBtn);
    var frame = modalFrame(editing ? "Editar entrada de diario" : "Nueva entrada de diario", closeJournalAdd, body, footer, 540);
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
    var prevUser = state.user; // capture before we clear it, to wipe that user's cache
    state.user = session ? session.user : null;
    if (event === "SIGNED_IN") { state.authBusy = false; state.authEmail = ""; state.authPass = ""; checkMfaGate().then(function () { if (!state.mfaGate) loadData(); }); }
    else if (event === "SIGNED_OUT") {
      // Wipe the cached financial snapshot + outbox so it can't be read on a
      // shared device after logout (security hardening F-05).
      if (prevUser) { try { localStorage.removeItem("bitacora_cache_" + prevUser.id); localStorage.removeItem("bitacora_outbox_" + prevUser.id); } catch (e) { } }
      state.trades = []; state.journal = []; state.accounts = []; state.settings = defaultSettings(); state.view = "dashboard"; state.selectedId = null; state.fAccount = "all"; state.fTag = "all"; state.quickNote = ""; state.jSearch = ""; state.jMood = "all"; state.pending = 0;
      state.mfaGate = false; state.mfaChecked = false; state.mfaFactors = []; state.mfaFactorsLoaded = false; render();
    }
  });
  SB.auth.getSession().then(function (res) {
    state.user = res.data.session ? res.data.session.user : null;
    state.booting = false;
    if (state.user) { checkMfaGate().then(function () { if (!state.mfaGate) loadData(); }); } else render();
  }).catch(function () { state.booting = false; render(); });

  // Connectivity: reflect status and flush queued writes when back online.
  if (typeof window.addEventListener === "function") {
    window.addEventListener("online", function () { state.online = true; if (state.user) flushOutbox().then(render); else render(); });
    window.addEventListener("offline", function () { state.online = false; render(); });
  }

  // Register the service worker (offline app shell). CSP allows worker-src 'self'.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () { }); });
  }

  render();
})();

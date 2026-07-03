(function () {
  "use strict";

  var VERSION = "2026.07.03-research-polish";
  var FLOW_LABELS = {
    chop: "Chop",
    pinning: "Pinning",
    "fake-breakout": "Fake breakout",
    expansion: "Expansion"
  };
  var TEST_LABELS = {
    "A-ema-continuation": "A · EMA continuation",
    "B-vwap-clean-pullback": "B · VWAP limpio"
  };
  var VWAP_LABELS = {
    "above-hold": "Above-hold",
    "below-hold": "Below-hold",
    reject: "Reject",
    "inside-chop": "Inside chop"
  };
  var CONTEXT_LABELS = {
    "opening-drive": "Opening drive",
    "ema-continuation": "EMA continuation",
    "vwap-reclaim": "VWAP reclaim",
    "prior-hl-retest": "Prior H/L retest",
    "failed-breakout": "Failed breakout"
  };

  document.documentElement.setAttribute("data-rp-build", VERSION);
  document.body.classList.add("rp-ready");

  function textOf(el) { return (el && el.textContent || "").trim(); }
  function money(n) {
    if (n == null || !isFinite(n)) return "-";
    var sign = n > 0 ? "+" : n < 0 ? "-" : "";
    return sign + "$" + Math.abs(Math.round(n)).toLocaleString("en-US");
  }
  function pct(n) {
    if (n == null || !isFinite(n)) return "-";
    return Math.round(n * 100) + "%";
  }
  function avg(list, get) {
    var xs = list.map(get).filter(function (v) { return v !== "" && v != null && isFinite(Number(v)); }).map(Number);
    return xs.length ? xs.reduce(function (a, b) { return a + b; }, 0) / xs.length : null;
  }
  function parseTags(tags) {
    if (Array.isArray(tags)) return tags.map(String);
    if (typeof tags === "string") {
      try {
        var parsed = JSON.parse(tags);
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch (e) { }
      return tags.split(",").map(function (t) { return t.trim(); }).filter(Boolean);
    }
    return [];
  }
  function stripUnit(value) {
    return String(value == null ? "" : value).replace(/[^\d.-]/g, "");
  }
  function researchFromTags(tags) {
    var r = {
      sameBar: "",
      stopPts: "",
      targetPts: "",
      timeInTrade: "",
      entryContext: "",
      vwapStatus: "",
      testGroup: "",
      macroIvFilter: false,
      microOptionsExpiration: false,
      near: [],
      flow: []
    };
    parseTags(tags).forEach(function (raw) {
      var tag = String(raw || "").trim();
      var low = tag.toLowerCase();
      if (low === "same-bar-conflict" || low === "same-bar:yes" || low === "samebar:yes") r.sameBar = "yes";
      else if (low === "same-bar:no" || low === "samebar:no") r.sameBar = "no";
      else if (low.indexOf("stop:") === 0) r.stopPts = stripUnit(tag.slice(5));
      else if (low.indexOf("target:") === 0) r.targetPts = stripUnit(tag.slice(7));
      else if (low.indexOf("tit:") === 0) r.timeInTrade = stripUnit(tag.slice(4));
      else if (low.indexOf("ctx:") === 0) r.entryContext = tag.slice(4);
      else if (low.indexOf("vwap:") === 0) r.vwapStatus = tag.slice(5);
      else if (low.indexOf("test:") === 0) r.testGroup = tag.slice(5);
      else if (low === "macro-iv-filter") r.macroIvFilter = true;
      else if (low === "micro-options-expiration") r.microOptionsExpiration = true;
      else if (low.indexOf("near:") === 0) r.near.push(tag.slice(5));
      else if (low.indexOf("flow:") === 0) r.flow.push(tag.slice(5));
    });
    return r;
  }
  function hasResearch(t) {
    var r = researchFromTags(t.tags);
    return !!(r.sameBar || r.stopPts || r.targetPts || r.timeInTrade || r.entryContext || r.vwapStatus || r.testGroup || r.macroIvFilter || r.microOptionsExpiration || r.near.length || r.flow.length || t.mae !== "" || t.mfe !== "");
  }
  function latestCache() {
    var best = null;
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!/^bitacora_cache_/.test(key || "")) continue;
      try {
        var value = JSON.parse(localStorage.getItem(key));
        if (value && Array.isArray(value.trades) && (!best || (value.ts || 0) > (best.ts || 0))) best = value;
      } catch (e) { }
    }
    return best || { trades: [] };
  }
  function summarize() {
    var trades = latestCache().trades || [];
    var closed = trades.filter(function (t) { return isFinite(Number(t.pnl)); });
    var research = closed.filter(hasResearch);
    var knownSame = closed.filter(function (t) { return !!researchFromTags(t.tags).sameBar; });
    var conflicts = knownSame.filter(function (t) { return researchFromTags(t.tags).sameBar === "yes"; });
    var aRows = closed.filter(function (t) { return researchFromTags(t.tags).testGroup === "A-ema-continuation"; });
    var bRows = closed.filter(function (t) { return researchFromTags(t.tags).testGroup === "B-vwap-clean-pullback"; });
    var vwapGroups = {};
    closed.forEach(function (t) {
      var key = researchFromTags(t.tags).vwapStatus;
      if (!key) return;
      if (!vwapGroups[key]) vwapGroups[key] = [];
      vwapGroups[key].push(t);
    });
    var flow = {};
    closed.forEach(function (t) {
      researchFromTags(t.tags).flow.forEach(function (f) {
        if (!flow[f]) flow[f] = [];
        flow[f].push(t);
      });
    });
    return {
      trades: closed,
      coverage: closed.length ? research.length / closed.length : null,
      conflicts: conflicts.length,
      sameKnown: knownSame.length,
      conflictRate: knownSame.length ? conflicts.length / knownSame.length : null,
      avgTit: avg(research, function (t) { return researchFromTags(t.tags).timeInTrade; }),
      avgMae: avg(closed, function (t) { return t.mae; }),
      avgMfe: avg(closed, function (t) { return t.mfe; }),
      aEdge: avg(aRows, function (t) { return t.pnl; }),
      bEdge: avg(bRows, function (t) { return t.pnl; }),
      vwapGroups: vwapGroups,
      flow: flow
    };
  }
  function groupRows(groups, labels) {
    return Object.keys(groups).sort().map(function (key) {
      var rows = groups[key];
      var edge = avg(rows, function (t) { return t.pnl; });
      var width = Math.max(6, Math.min(100, Math.abs(edge || 0) / 6));
      return '<div class="rp-bar-row"><span>' + (labels[key] || key) + '</span><span class="rp-bar-track"><span class="rp-bar-fill" style="--rp-w:' + width + '%;--rp-color:' + ((edge || 0) < 0 ? 'var(--rp-red)' : 'var(--rp-green)') + '"></span></span><strong style="color:' + ((edge || 0) < 0 ? 'var(--rp-red)' : 'var(--rp-green)') + '">' + money(edge) + '/op</strong></div>';
    }).join("");
  }
  function exportResearchCsv() {
    var trades = summarize().trades;
    var headers = ["date", "time", "symbol", "side", "pnl", "mae", "mfe", "same_bar", "stop_pts", "target_pts", "time_in_trade", "entry_context", "vwap_status", "test_group", "macro_iv_filter", "micro_options_expiration", "flow", "tags"];
    var lines = [headers.join(",")];
    trades.forEach(function (t) {
      var r = researchFromTags(t.tags);
      var row = [t.date, t.time || "", t.symbol, t.side, t.pnl, t.mae || "", t.mfe || "", r.sameBar, r.stopPts, r.targetPts, r.timeInTrade, r.entryContext, r.vwapStatus, r.testGroup, r.macroIvFilter ? "yes" : "", r.microOptionsExpiration ? "yes" : "", r.flow.join("|"), parseTags(t.tags).join("|")];
      lines.push(row.map(function (cell) { return '"' + String(cell == null ? "" : cell).replace(/"/g, '""') + '"'; }).join(","));
    });
    var blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "bitacora-research-metrics.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 800);
    toast("CSV de research exportado.");
  }
  function researchPanelHtml() {
    var s = summarize();
    var aVsB = s.aEdge == null || s.bEdge == null ? null : s.bEdge - s.aEdge;
    return '<section class="rp-research-panel" data-rp-panel="research">' +
      '<div class="rp-panel-head"><div><div class="rp-panel-title">Research quality</div><div class="rp-panel-copy">Convierte el research semanal en evidencia: same-bar conflicts, A/B de EMA/VWAP, filtros macro/IV, MAE/MFE y contexto de liquidez.</div></div><button class="rp-export-btn" type="button" data-rp-export>Export research CSV</button></div>' +
      '<div class="rp-kpi-grid">' +
      '<div class="rp-kpi"><div class="rp-kpi-label">Same-bar conflict</div><div class="rp-kpi-value" style="color:' + (s.conflictRate != null && s.conflictRate > .1 ? 'var(--rp-red)' : 'var(--rp-green)') + '">' + (s.conflictRate == null ? '-' : pct(s.conflictRate)) + '</div><div class="rp-kpi-note">' + s.conflicts + '/' + s.sameKnown + ' operaciones clasificadas</div></div>' +
      '<div class="rp-kpi"><div class="rp-kpi-label">Cobertura research</div><div class="rp-kpi-value" style="color:var(--rp-green)">' + (s.coverage == null ? '-' : pct(s.coverage)) + '</div><div class="rp-kpi-note">' + s.trades.filter(hasResearch).length + ' con protocolo</div></div>' +
      '<div class="rp-kpi"><div class="rp-kpi-label">Time-in-trade</div><div class="rp-kpi-value">' + (s.avgTit == null ? '-' : Math.round(s.avgTit) + 'm') + '</div><div class="rp-kpi-note">promedio de duracion</div></div>' +
      '<div class="rp-kpi"><div class="rp-kpi-label">B vs A</div><div class="rp-kpi-value" style="color:' + ((aVsB || 0) < 0 ? 'var(--rp-red)' : 'var(--rp-green)') + '">' + (aVsB == null ? '-' : money(aVsB)) + '</div><div class="rp-kpi-note">edge incremental VWAP vs EMA</div></div>' +
      '</div>' +
      '<div class="rp-breakdown"><div class="rp-bars"><div class="rp-bars-title">VWAP status</div>' + (groupRows(s.vwapGroups, VWAP_LABELS) || '<div class="rp-chip">Sin datos VWAP todavia</div>') + '</div><div class="rp-bars"><div class="rp-bars-title">Liquidez / flow</div>' + (groupRows(s.flow, FLOW_LABELS) || '<div class="rp-chip">Sin datos de flow todavia</div>') + '</div></div>' +
      '<div class="rp-chip-row"><span class="rp-chip">MAE avg: ' + (s.avgMae == null ? '-' : money(s.avgMae)) + '</span><span class="rp-chip">MFE avg: ' + (s.avgMfe == null ? '-' : money(s.avgMfe)) + '</span><span class="rp-chip">Build ' + VERSION + '</span></div>' +
      '</section>';
  }
  function mountResearchPanel() {
    var main = document.querySelector("main");
    if (!main || !/Resumen/.test(textOf(main))) return;
    var existing = main.querySelector('[data-rp-panel="research"]');
    if (existing) {
      existing.outerHTML = researchPanelHtml();
    } else {
      var anchor = Array.prototype.find.call(main.children, function (el) {
        return /P&L neto|Win rate|Profit factor|Esperanza/.test(textOf(el));
      });
      if (anchor) anchor.insertAdjacentHTML("beforebegin", researchPanelHtml());
      else main.insertAdjacentHTML("beforeend", researchPanelHtml());
    }
    var btn = main.querySelector("[data-rp-export]");
    if (btn && !btn.__rpBound) {
      btn.__rpBound = true;
      btn.addEventListener("click", exportResearchCsv);
    }
  }
  function authBadge() {
    if (document.querySelector(".rp-auth-badge")) return;
    var app = document.getElementById("app");
    if (!app || !/Bienvenido de nuevo|Crea tu cuenta|Entrar/.test(textOf(app))) return;
    var title = Array.prototype.find.call(app.querySelectorAll("div"), function (el) {
      return /Bienvenido de nuevo|Crea tu cuenta/.test(textOf(el));
    });
    if (title) {
      var badge = document.createElement("div");
      badge.className = "rp-auth-badge";
      badge.textContent = "Research metrics build activo";
      title.insertAdjacentElement("afterend", badge);
    }
  }
  function makeField(label, control) {
    var wrap = document.createElement("div");
    wrap.className = "rp-field";
    var l = document.createElement("label");
    l.textContent = label;
    wrap.appendChild(l);
    wrap.appendChild(control);
    return wrap;
  }
  function select(name, options) {
    var s = document.createElement("select");
    s.setAttribute("data-rp-name", name);
    options.forEach(function (opt) {
      var o = document.createElement("option");
      o.value = opt[0];
      o.textContent = opt[1];
      s.appendChild(o);
    });
    return s;
  }
  function input(name, placeholder) {
    var i = document.createElement("input");
    i.type = "number";
    i.step = "1";
    i.placeholder = placeholder || "";
    i.setAttribute("data-rp-name", name);
    return i;
  }
  function toggle(name, label) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "rp-toggle";
    b.setAttribute("aria-pressed", "false");
    b.setAttribute("data-rp-name", name);
    b.textContent = label;
    b.addEventListener("click", function () {
      b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true");
    });
    return b;
  }
  function modalProtocol() {
    var root = document.getElementById("modal-root");
    if (!root || !/Nueva operaci|Editar operaci/.test(textOf(root)) || root.querySelector(".rp-protocol")) return;
    var section = document.createElement("section");
    section.className = "rp-protocol";
    section.innerHTML = '<div class="rp-protocol-head"><div><div class="rp-protocol-title">Research protocol</div><div class="rp-protocol-copy">Campos para medir same-bar conflict, EMA/VWAP, liquidez y calidad del trade sin depender de notas sueltas.</div></div></div>';
    var grid = document.createElement("div");
    grid.className = "rp-protocol-grid";
    grid.appendChild(makeField("Same-bar conflict", select("sameBar", [["", "Sin marcar"], ["yes", "Si"], ["no", "No"]])));
    grid.appendChild(makeField("Research test", select("testGroup", [["", "Sin grupo"], ["A-ema-continuation", TEST_LABELS["A-ema-continuation"]], ["B-vwap-clean-pullback", TEST_LABELS["B-vwap-clean-pullback"]]])));
    grid.appendChild(makeField("VWAP status", select("vwapStatus", [["", "Sin clasificar"], ["above-hold", "Above-hold"], ["below-hold", "Below-hold"], ["reject", "Reject"], ["inside-chop", "Inside chop"]])));
    grid.appendChild(makeField("Stop pts", input("stopPts", "10")));
    grid.appendChild(makeField("Target pts", input("targetPts", "20")));
    grid.appendChild(makeField("Time-in-trade", input("timeInTrade", "min")));
    grid.appendChild(makeField("Entry context", select("entryContext", [["", "Sin clasificar"], ["opening-drive", CONTEXT_LABELS["opening-drive"]], ["ema-continuation", CONTEXT_LABELS["ema-continuation"]], ["vwap-reclaim", CONTEXT_LABELS["vwap-reclaim"]], ["prior-hl-retest", CONTEXT_LABELS["prior-hl-retest"]], ["failed-breakout", CONTEXT_LABELS["failed-breakout"]]])));
    section.appendChild(grid);
    var toggles = document.createElement("div");
    toggles.className = "rp-toggle-row";
    [
      ["macroIvFilter", "Macro/IV filter"],
      ["microOptionsExpiration", "Micro options exp."],
      ["nearRoundNumber", "Round number"],
      ["nearPriorRange", "Prior H/L"],
      ["nearVwap", "Near VWAP"],
      ["flowChop", "Chop"],
      ["flowPinning", "Pinning"],
      ["flowFakeBreakout", "Fake breakout"],
      ["flowExpansion", "Expansion"]
    ].forEach(function (x) { toggles.appendChild(toggle(x[0], x[1])); });
    section.appendChild(toggles);
    var textarea = root.querySelector("textarea");
    var target = textarea && textarea.parentElement ? textarea.parentElement : null;
    if (target) target.insertAdjacentElement("beforebegin", section);
    else root.appendChild(section);
  }
  function collectProtocolTags(root) {
    function val(name) {
      var el = root.querySelector('[data-rp-name="' + name + '"]');
      return el ? String(el.value || "").trim() : "";
    }
    function on(name) {
      var el = root.querySelector('[data-rp-name="' + name + '"]');
      return !!el && el.getAttribute("aria-pressed") === "true";
    }
    var tags = [];
    if (val("sameBar") === "yes") tags.push("same-bar:yes");
    if (val("sameBar") === "no") tags.push("same-bar:no");
    if (val("stopPts")) tags.push("stop:" + Number(val("stopPts")) + "pt");
    if (val("targetPts")) tags.push("target:" + Number(val("targetPts")) + "pt");
    if (val("timeInTrade")) tags.push("tit:" + Number(val("timeInTrade")) + "m");
    if (val("entryContext")) tags.push("ctx:" + val("entryContext"));
    if (val("vwapStatus")) tags.push("vwap:" + val("vwapStatus"));
    if (val("testGroup")) tags.push("test:" + val("testGroup"));
    if (on("macroIvFilter")) tags.push("macro-iv-filter");
    if (on("microOptionsExpiration")) tags.push("micro-options-expiration");
    if (on("nearRoundNumber")) tags.push("near:round-number");
    if (on("nearPriorRange")) tags.push("near:prior-range");
    if (on("nearVwap")) tags.push("near:vwap");
    if (on("flowChop")) tags.push("flow:chop");
    if (on("flowPinning")) tags.push("flow:pinning");
    if (on("flowFakeBreakout")) tags.push("flow:fake-breakout");
    if (on("flowExpansion")) tags.push("flow:expansion");
    return tags;
  }
  function bindModalSave() {
    var root = document.getElementById("modal-root");
    if (!root || root.__rpSaveBound) return;
    root.__rpSaveBound = true;
    root.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest("button") : null;
      if (!btn || !/Guardar operaci/.test(textOf(btn))) return;
      var tags = collectProtocolTags(root);
      if (!tags.length) return;
      var tagInput = Array.prototype.find.call(root.querySelectorAll("input"), function (i) {
        return /NY open|breakout|BTC|5m/i.test(i.getAttribute("placeholder") || "");
      });
      if (!tagInput) return;
      var existing = tagInput.value.split(",").map(function (t) { return t.trim(); }).filter(Boolean);
      tags.forEach(function (t) { if (existing.indexOf(t) < 0) existing.push(t); });
      tagInput.value = existing.join(", ");
      tagInput.dispatchEvent(new Event("input", { bubbles: true }));
      toast("Research protocol agregado a las etiquetas del trade.");
    }, true);
  }
  function toast(message) {
    var old = document.querySelector(".rp-toast");
    if (old) old.remove();
    var box = document.createElement("div");
    box.className = "rp-toast";
    box.textContent = message;
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 2600);
  }
  function tick() {
    authBadge();
    mountResearchPanel();
    modalProtocol();
    bindModalSave();
  }
  var observer = new MutationObserver(function () { window.requestAnimationFrame(tick); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("storage", tick);
  window.addEventListener("focus", tick);
  setInterval(tick, 2000);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tick);
  else tick();
})();

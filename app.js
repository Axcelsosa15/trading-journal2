/* Bitácora — Trading Journal
 *
 * Faithful, dependency-free re-implementation of the Claude Design prototype
 * `Bitácora.dc.html`. The prototype ran on a custom React-based template
 * runtime; this version reproduces the same data model, computed metrics,
 * inline-SVG charts and interactions in plain JavaScript so it opens and runs
 * with no build step and no network dependency.
 */
(function () {
  "use strict";

  // ---------- tiny DOM builders ----------
  var SVG_NS = "http://www.w3.org/2000/svg";

  function build(ns, tag, props, children) {
    var e = ns ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
    if (props) {
      for (var k in props) {
        var v = props[k];
        if (v == null || v === false) continue;
        if (k === "style") {
          if (ns) e.setAttribute("style", v); else e.style.cssText = v;
        } else if (k === "html") {
          e.innerHTML = v;
        } else if (k === "class") {
          e.setAttribute("class", v);
        } else if (k === "hoverBg") {
          wireHover(e, v);
        } else if (k.slice(0, 2) === "on" && typeof v === "function") {
          e.addEventListener(k.slice(2).toLowerCase(), v);
        } else {
          e.setAttribute(k, v);
        }
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

  // Parse a static SVG/HTML icon string into a node (template parses SVG correctly).
  function icon(str) {
    var t = document.createElement("template");
    t.innerHTML = str.trim();
    return t.content.firstElementChild;
  }

  // Hover-background helper replacing the prototype's `style-hover` attribute.
  function wireHover(e, color) {
    var base = e.style.background;
    e.addEventListener("mouseenter", function () { e.style.background = color; });
    e.addEventListener("mouseleave", function () { e.style.background = base; });
  }

  // ===================================================================
  // State
  // ===================================================================
  var state = {
    view: "dashboard",
    trades: seedTrades(),
    journal: seedJournal(),
    selectedId: null,
    fResult: "all", fSymbol: "all", fSetup: "all",
    calMonth: "2026-06",
    showAdd: false,
    draft: blankDraft(),
  };

  // ---------- data ----------
  function PV(t) {
    var P = { ES: 50, MES: 5, NQ: 20, MNQ: 2, CL: 1000, GC: 100, MGC: 10, RTY: 50, MRTY: 5 };
    return t.type === "option" ? 100 : (P[(t.symbol || "").toUpperCase()] || 1);
  }
  function pnlOf(t) {
    var dir = t.side === "long" ? 1 : -1;
    return Math.round((Number(t.exit) - Number(t.entry)) * PV(t) * Number(t.contracts) * dir);
  }
  function blankDraft() {
    return { symbol: "MES", type: "future", side: "long", contracts: 1, entry: "", exit: "", date: "2026-06-19", setup: "Ruptura", emotion: "Tranquilo", rating: 3, note: "" };
  }
  function seedTrades() {
    var raw = [
      ["2026-05-18", "MES", "future", "long", 4, 5285, 5298.5, "Ruptura", "Confiado", 4, "Ruptura limpia sobre el máximo de premarket, volumen acompañando."],
      ["2026-05-19", "MNQ", "future", "short", 3, 18420, 18365, "Reversión", "Tranquilo", 4, "Rechazo en resistencia diaria, gestión por tramos."],
      ["2026-05-20", "CL", "future", "long", 1, 78.20, 77.65, "Pullback", "Ansioso", 2, "Entré tarde y salté el plan. Stop bien colocado al menos."],
      ["2026-05-21", "MES", "future", "long", 5, 5302, 5294, "Ruptura", "FOMO", 2, "Perseguí la vela sin confirmación. Lección clara."],
      ["2026-05-22", "NQ", "future", "long", 1, 18510, 18588, "Pullback", "Confiado", 5, "Pullback a la EMA20, dejé correr la ganancia."],
      ["2026-05-26", "MES", "future", "short", 4, 5330, 5318, "Reversión", "Tranquilo", 3, "Doble techo, salida parcial en soporte."],
      ["2026-05-27", "MNQ", "future", "long", 3, 18600, 18555, "Ruptura", "Ansioso", 2, "Ruptura falsa, respeté el stop sin dudar."],
      ["2026-05-28", "CL", "future", "short", 1, 79.10, 78.40, "Reversión", "Confiado", 4, "Agotamiento alcista tras el dato de inventarios."],
      ["2026-05-29", "SPY", "option", "long", 5, 4.20, 5.85, "Ruptura", "Confiado", 4, "Calls sobre ruptura de rango, theta a favor."],
      ["2026-06-01", "MES", "future", "long", 6, 5345, 5358, "Pullback", "Tranquilo", 4, "Tendencia clara, añadí en el pullback."],
      ["2026-06-02", "QQQ", "option", "long", 4, 3.10, 2.35, "Reversión", "FOMO", 1, "Entré contra tendencia por impaciencia. Mal."],
      ["2026-06-02", "MNQ", "future", "short", 2, 18720, 18760, "Ruptura", "Ansioso", 2, "Short prematuro, el mercado siguió subiendo."],
      ["2026-06-03", "ES", "future", "long", 1, 5360, 5377, "Pullback", "Confiado", 5, "De libro: pullback y continuación de tendencia."],
      ["2026-06-04", "MES", "future", "short", 5, 5388, 5379, "Reversión", "Tranquilo", 3, "Rechazo en VWAP, salida disciplinada."],
      ["2026-06-05", "CL", "future", "long", 2, 80.20, 80.95, "Ruptura", "Confiado", 4, "Ruptura con volumen tras los inventarios."],
      ["2026-06-08", "MNQ", "future", "long", 3, 18810, 18770, "Pullback", "FOMO", 2, "Tamaño excesivo, nervios, salí mal."],
      ["2026-06-09", "MES", "future", "long", 4, 5402, 5418, "Ruptura", "Confiado", 4, "Continuación de tendencia, plan ejecutado."],
      ["2026-06-09", "SPY", "option", "long", 6, 5.50, 4.20, "Reversión", "Ansioso", 1, "Compré el rebote, no llegó. Sobreoperé."],
      ["2026-06-10", "NQ", "future", "short", 1, 18920, 18860, "Reversión", "Tranquilo", 4, "Divergencia clara, objetivo alcanzado."],
      ["2026-06-11", "MES", "future", "long", 5, 5430, 5421, "Ruptura", "FOMO", 2, "Otra ruptura perseguida. Patrón a corregir."],
      ["2026-06-12", "CL", "future", "long", 1, 81.40, 80.75, "Pullback", "Ansioso", 2, "Stop respetado, contexto macro en contra."],
      ["2026-06-15", "MES", "future", "short", 6, 5455, 5441, "Reversión", "Confiado", 4, "Reversión en apertura, gestión por tramos."],
      ["2026-06-15", "QQQ", "option", "long", 5, 2.80, 4.10, "Ruptura", "Confiado", 5, "Mejor trade de la semana, dejé correr."],
      ["2026-06-16", "MNQ", "future", "long", 4, 18990, 19035, "Pullback", "Tranquilo", 4, "Pullback limpio, riesgo controlado."],
      ["2026-06-17", "ES", "future", "long", 1, 5470, 5455, "Ruptura", "FOMO", 1, "Entré sin confirmación tras la apertura."],
      ["2026-06-17", "MES", "future", "long", 4, 5462, 5474, "Reversión", "Confiado", 3, "Recuperé parte tras el error anterior."],
      ["2026-06-18", "NQ", "future", "long", 1, 19080, 19142, "Pullback", "Confiado", 5, "Tendencia fuerte, ejecución perfecta."],
      ["2026-06-18", "CL", "future", "short", 1, 82.10, 82.55, "Ruptura", "Ansioso", 2, "Short en ruptura falsa, stop tocado."],
      ["2026-06-19", "MES", "future", "short", 5, 5495, 5483, "Reversión", "Tranquilo", 4, "Cierre de semana disciplinado."],
      ["2026-06-19", "SPY", "option", "long", 4, 3.40, 4.95, "Ruptura", "Confiado", 5, "Calls sobre ruptura, salida en objetivo."],
    ];
    return raw.map(function (r, i) {
      var t = { id: "t" + (i + 1), date: r[0], symbol: r[1], type: r[2], side: r[3], contracts: r[4], entry: r[5], exit: r[6], setup: r[7], emotion: r[8], rating: r[9], note: r[10] || "" };
      t.pnl = pnlOf(t);
      return t;
    });
  }
  function seedJournal() {
    return [
      { id: "j1", date: "2026-06-19", mood: "Disciplinado", title: "Cierre de semana sólido", body: "Solo dos operaciones, ambas dentro del plan. El short de MES lo gestioné por tramos y las calls de SPY salieron en el objetivo sin dudar. No forcé nada en la tarde.", lesson: "Menos es más: 2 buenos trades valen más que 5 forzados." },
      { id: "j2", date: "2026-06-17", mood: "Frustrado", title: "Día de errores evitables", body: "Entré en ES sin confirmación nada más abrir y me sacaron al instante. La de MES fue revancha emocional, aunque salió. Tengo que separar la decisión del impulso de recuperar.", lesson: "No operar para \"recuperar\" la pérdida anterior." },
      { id: "j3", date: "2026-06-12", mood: "Paciente", title: "Aceptar la pérdida limpia", body: "CL en contra todo el día por el contexto macro. Respeté el stop sin moverlo y no insistí. Una pérdida planificada no es un error.", lesson: "Un stop respetado es una operación bien ejecutada." },
      { id: "j4", date: "2026-06-09", mood: "Codicioso", title: "Sobreoperé la tarde", body: "Tras un buen trade de MES por la mañana, me sobró ego y compré un rebote en SPY que nunca llegó. La euforia me costó parte de las ganancias del día.", lesson: "Después de un gran trade, reducir tamaño, no subirlo." },
      { id: "j5", date: "2026-06-05", mood: "Enfocado", title: "Mejor ejecución del mes", body: "La ruptura de CL tras inventarios fue de manual: esperé el retest, entré con volumen y dejé correr a objetivo. Plan, paciencia y ejecución alineados.", lesson: "El setup A+ aparece pocas veces; cuando llega, tamaño completo." },
    ];
  }

  // ---------- helpers ----------
  var MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  var MESL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function fmtDate(iso) { var p = iso.split("-").map(Number); return p[2] + " " + MES[p[1] - 1]; }
  function fmtDateLong(iso) { var p = iso.split("-").map(Number); return p[2] + " " + MES[p[1] - 1] + " " + p[0]; }
  function money(n) { return "$" + Math.abs(Math.round(n)).toLocaleString("en-US"); }
  function signed(n) { return (n >= 0 ? "+" : "−") + "$" + Math.abs(Math.round(n)).toLocaleString("en-US"); }
  function num(n) { return Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
  function stars(r) { return "★★★★★".slice(0, r) + "☆☆☆☆☆".slice(0, 5 - r); }
  function pnlColor(n) { return n >= 0 ? "color:#16915B;" : "color:#D6483B;"; }

  // ---------- mutations ----------
  function setView(v) { state.view = v; render(); }
  function select(id) { state.selectedId = id; render(); }
  function closeDetail() { state.selectedId = null; render(); }
  function deleteSelected() {
    var id = state.selectedId;
    state.trades = state.trades.filter(function (t) { return t.id !== id; });
    state.selectedId = null;
    render();
  }
  function shiftMonth(dir) {
    var p = state.calMonth.split("-").map(Number), y = p[0], m = p[1];
    m += dir; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    state.calMonth = y + "-" + pad(m);
    render();
  }
  function saveTrade() {
    var d = state.draft;
    if (!d.symbol || d.entry === "" || d.exit === "" || Number(d.contracts) <= 0) return;
    var t = { id: "t" + Date.now(), date: d.date, symbol: d.symbol.toUpperCase(), type: d.type, side: d.side, contracts: Number(d.contracts), entry: Number(d.entry), exit: Number(d.exit), setup: d.setup, emotion: d.emotion, rating: Number(d.rating) || 3, note: d.note };
    t.pnl = pnlOf(t);
    state.trades = [t].concat(state.trades);
    closeAdd();
    render();
  }

  // ---------- metrics & grouping ----------
  function metrics() {
    var ts = state.trades, n = ts.length;
    var wins = ts.filter(function (t) { return t.pnl > 0; });
    var losses = ts.filter(function (t) { return t.pnl < 0; });
    var gp = wins.reduce(function (a, t) { return a + t.pnl; }, 0);
    var gl = Math.abs(losses.reduce(function (a, t) { return a + t.pnl; }, 0));
    var net = gp - gl, wr = n ? wins.length / n : 0;
    return { n: n, net: net, wr: wr, wins: wins.length, losses: losses.length, pf: gl ? gp / gl : (gp > 0 ? 99 : 0), avgWin: wins.length ? gp / wins.length : 0, avgLoss: losses.length ? gl / losses.length : 0, exp: n ? net / n : 0, gp: gp, gl: gl };
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
      s("defs", null, grad),
      zero,
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
    var kids = [];
    kids.push(s("line", { x1: pl, y1: zeroY, x2: w - pr, y2: zeroY, stroke: "#E2DDD3", "stroke-width": 1 }));
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

  // ===================================================================
  // Render
  // ===================================================================
  function render() {
    var root = document.getElementById("app");
    root.innerHTML = "";
    root.appendChild(appShell());
    renderModal();
  }

  function appShell() {
    return h("div", { style: "display:flex;height:100vh;width:100%;overflow:hidden;background:#FAF8F4;font-family:Geist,sans-serif;color:#16181C;-webkit-font-smoothing:antialiased;font-size:14px;" },
      sidebar(),
      mainColumn(),
      detailDrawer()
    );
  }

  // ---------- sidebar ----------
  function sidebar() {
    var m = metrics();
    var acctBal = 25000 + m.net;
    var today = state.trades.filter(function (t) { return t.date === "2026-06-19"; }).reduce(function (a, t) { return a + t.pnl; }, 0);
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
          icon('<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="4" y="9" width="3.4" height="11" rx="1" fill="#16915B"/><line x1="5.7" y1="5" x2="5.7" y2="9" stroke="#16915B" stroke-width="1.6"/><line x1="5.7" y1="20" x2="5.7" y2="22.5" stroke="#16915B" stroke-width="1.6"/><rect x="13" y="6" width="3.4" height="9" rx="1" fill="#D6483B"/><line x1="14.7" y1="3" x2="14.7" y2="6" stroke="#D6483B" stroke-width="1.6"/><line x1="14.7" y1="15" x2="14.7" y2="18" stroke="#D6483B" stroke-width="1.6"/></svg>')
        ),
        h("div", { style: "line-height:1;" },
          h("div", { style: "font-weight:700;font-size:15px;letter-spacing:-0.2px;" }, "Bitácora"),
          h("div", { style: "font-size:11px;color:#A39E94;margin-top:3px;letter-spacing:.3px;" }, "TRADING JOURNAL")
        )
      ),
      h("nav", { style: "display:flex;flex-direction:column;gap:2px;" },
        navItem("dashboard", '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>', "Resumen"),
        navItem("trades", '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r="1.3" fill="currentColor" stroke="none"/></svg>', "Operaciones", state.trades.length),
        navItem("calendar", '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4.5" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2.5" x2="8" y2="6"/><line x1="16" y1="2.5" x2="16" y2="6"/></svg>', "Calendario"),
        navItem("analytics", '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><line x1="4" y1="20" x2="4" y2="13"/><line x1="10" y1="20" x2="10" y2="5"/><line x1="16" y1="20" x2="16" y2="9"/><line x1="22" y1="20" x2="22" y2="15"/></svg>', "Analítica"),
        navItem("journal", '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v14H6.5A2.5 2.5 0 0 0 4 19.5z"/><line x1="4" y1="19.5" x2="4" y2="5.5"/><line x1="20" y1="17" x2="20" y2="21"/><path d="M6.5 21H20"/></svg>', "Diario")
      ),
      h("div", { style: "margin-top:auto;border:1px solid #ECE7DD;border-radius:12px;padding:14px;background:#FBFAF7;" },
        h("div", { style: "font-size:11px;color:#A39E94;letter-spacing:.4px;text-transform:uppercase;" }, "Cuenta · Sim"),
        h("div", { style: "font-family:'Geist Mono',monospace;font-size:21px;font-weight:600;margin-top:6px;letter-spacing:-0.5px;" }, money(acctBal)),
        h("div", { style: "display:flex;align-items:center;gap:6px;margin-top:8px;" },
          h("span", { style: "font-size:11px;color:#807B72;" }, "Hoy"),
          h("span", { style: "font-family:Geist Mono,monospace;font-size:12.5px;font-weight:600;" + pnlColor(today) }, signed(today))
        )
      )
    );
  }

  // ---------- main column ----------
  var TITLES = { dashboard: "Resumen", trades: "Operaciones", calendar: "Calendario de resultados", analytics: "Analítica", journal: "Diario de trading" };

  function mainColumn() {
    return h("main", { style: "flex:1;display:flex;flex-direction:column;min-width:0;" },
      header(),
      h("div", { style: "flex:1;overflow-y:auto;padding:28px;" }, viewBody())
    );
  }

  function header() {
    return h("header", { style: "height:62px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 28px;border-bottom:1px solid #ECE7DD;background:rgba(250,248,244,.85);backdrop-filter:blur(8px);" },
      h("div", null, h("div", { style: "font-size:17px;font-weight:600;letter-spacing:-0.3px;" }, TITLES[state.view])),
      h("div", { style: "display:flex;align-items:center;gap:12px;" },
        h("div", { style: "display:flex;align-items:center;gap:7px;font-size:12.5px;color:#807B72;padding:7px 12px;border:1px solid #ECE7DD;border-radius:9px;background:#fff;" },
          icon('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4.5" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>'),
          "18 May – 19 Jun 2026"
        ),
        h("button", { style: "display:flex;align-items:center;gap:7px;background:#16181C;color:#fff;font-weight:600;font-size:13px;padding:9px 15px;border-radius:9px;box-shadow:0 1px 2px rgba(0,0,0,.12);", onClick: openAdd },
          icon('<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'),
          "Nueva operación"
        )
      )
    );
  }

  function viewBody() {
    switch (state.view) {
      case "dashboard": return dashboardView();
      case "trades": return tradesView();
      case "calendar": return calendarView();
      case "analytics": return analyticsView();
      case "journal": return journalView();
    }
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
        kpiCard("Esperanza / op.", pnlColor(m.exp), signed(m.exp), null, "media por operación")
      ),
      h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:20px 20px 14px;" },
        h("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;" },
          h("div", { style: "font-size:14px;font-weight:600;" }, "Curva de capital"),
          h("div", { style: "font-size:12px;color:#807B72;font-family:'Geist Mono',monospace;" }, "acumulado · " + state.trades.length + " ops")
        ),
        h("div", { style: "width:100%;" }, equityEl())
      ),
      h("div", { style: "display:grid;grid-template-columns:1.25fr 1fr;gap:18px;" },
        recentPanel(recentRows),
        h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:18px;" },
          h("div", { style: "font-size:14px;font-weight:600;margin-bottom:4px;" }, "Rendimiento por setup"),
          h("div", { style: "font-size:12px;color:#A39E94;margin-bottom:8px;" }, "P&L acumulado"),
          h("div", null, barsEl(setupData, { w: 420, h: 210 }))
        )
      )
    );
  }

  function recentPanel(rows) {
    var list = rows.map(function (row) {
      return h("button", { style: "display:grid;grid-template-columns:54px 1fr auto;align-items:center;gap:12px;width:100%;text-align:left;padding:10px 14px;border-radius:10px;border:none;background:none;", hoverBg: "#FAF8F4", onClick: row.onClick },
        h("span", { style: row.sideStyle }, row.sideShort),
        h("span", { style: "min-width:0;" },
          h("span", { style: "font-weight:600;font-size:13.5px;" }, row.symbol),
          h("span", { style: "font-size:11.5px;color:#A39E94;margin-left:7px;" }, row.setup + " · " + row.dateStr)
        ),
        h("span", { style: "font-family:'Geist Mono',monospace;font-size:13.5px;font-weight:600;" + row.pnlColor }, row.pnlStr)
      );
    });
    return h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:6px 6px 6px;" },
      h("div", { style: "display:flex;align-items:center;justify-content:space-between;padding:14px 14px 10px;" },
        h("div", { style: "font-size:14px;font-weight:600;" }, "Últimas operaciones"),
        h("button", { style: "font-size:12px;color:#807B72;font-weight:500;", onClick: function () { setView("trades"); } }, "Ver todas →")
      ),
      list
    );
  }

  // ---------- operaciones ----------
  function tradesView() {
    var ft = state.trades.slice();
    if (state.fResult === "win") ft = ft.filter(function (t) { return t.pnl > 0; });
    else if (state.fResult === "loss") ft = ft.filter(function (t) { return t.pnl < 0; });
    if (state.fSymbol !== "all") ft = ft.filter(function (t) { return t.symbol === state.fSymbol; });
    if (state.fSetup !== "all") ft = ft.filter(function (t) { return t.setup === state.fSetup; });
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
      h("option", { value: "all" }, "Todos los setups"),
      h("option", { value: "Ruptura" }, "Ruptura"),
      h("option", { value: "Reversión" }, "Reversión"),
      h("option", { value: "Pullback" }, "Pullback"));
    setupSelect.value = state.fSetup;

    var headerCols = ["Fecha", "Lado", "Símbolo", "Cont.", "Entrada", "Salida", "Setup", "P&L", "Valor."];
    var gridCols = "84px 60px 1fr 64px 92px 92px 110px 120px 96px";
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
        h("span", { style: "text-align:right;color:#D8B23E;letter-spacing:1px;font-size:12px;" }, row.stars)
      );
    });
    if (ft.length === 0) bodyRows.push(h("div", { style: "padding:48px;text-align:center;color:#A39E94;font-size:13px;" }, "Sin operaciones para este filtro."));

    return h("div", { style: "max-width:1180px;margin:0 auto;" },
      h("div", { style: "display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px;flex-wrap:wrap;" },
        h("div", { style: "display:flex;gap:4px;background:#F1EDE5;padding:4px;border-radius:10px;" },
          fSeg("all", "Todas"), fSeg("win", "Ganadoras"), fSeg("loss", "Perdedoras")),
        h("div", { style: "display:flex;gap:10px;align-items:center;" },
          symbolSelect, setupSelect,
          h("span", { style: "font-size:12.5px;color:#807B72;font-family:'Geist Mono',monospace;" }, ft.length + " ops · " + signed(ft.reduce(function (a, t) { return a + t.pnl; }, 0)))
        )
      ),
      h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;overflow:hidden;" }, headerRow, bodyRows)
    );
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
          h("button", { style: "width:34px;height:34px;border:1px solid #ECE7DD;border-radius:9px;background:#fff;display:flex;align-items:center;justify-content:center;", hoverBg: "#FAF8F4", onClick: function () { shiftMonth(1); } }, icon('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>'))
        ),
        h("div", { style: "display:flex;gap:22px;" },
          statBlock("P&L del mes", signed(monthNet), pnlColor(monthNet)),
          statBlock("Días op.", monthDays, ""),
          statBlock("Días verdes", monthGreen, "color:#16915B;")
        )
      ),
      h("div", { style: "display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:8px;" },
        weekdayLabels.map(function (w) { return h("div", { style: "text-align:center;font-size:11px;color:#A39E94;font-weight:600;letter-spacing:.4px;text-transform:uppercase;" }, w); })),
      h("div", { style: "display:grid;grid-template-columns:repeat(7,1fr);gap:8px;" }, cells)
    );
  }
  function statBlock(label, value, valueStyle) {
    return h("div", null,
      h("div", { style: "font-size:11px;color:#807B72;" }, label),
      h("div", { style: "font-family:'Geist Mono',monospace;font-size:18px;font-weight:600;" + (valueStyle || "") }, value));
  }

  // ---------- analítica ----------
  function analyticsView() {
    var setupG = group(function (t) { return t.setup; }); // referenced for parity with dashboard
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

    return h("div", { style: "max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:18px;" },
      h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:20px;" },
        h("div", { style: "font-size:14px;font-weight:600;margin-bottom:10px;" }, "Curva de capital"),
        h("div", null, equityEl())
      ),
      h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:18px;" },
        analyticsCard("P&L por día de la semana", "acumulado por sesión", barsEl(weekdayData, { w: 460, h: 226 })),
        analyticsCard("P&L por emoción", "psicología vs. resultado", barsEl(emotionData, { w: 460, h: 226 }))
      ),
      h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:18px;" },
        h("div", { style: "font-size:14px;font-weight:600;margin-bottom:12px;" }, "Rendimiento por símbolo"),
        h("div", { style: "display:flex;flex-direction:column;gap:11px;" },
          symbolStats.map(function (x) {
            return h("div", { style: "display:grid;grid-template-columns:62px 1fr 86px 92px;gap:14px;align-items:center;" },
              h("span", { style: "font-weight:600;font-size:13.5px;" }, x.symbol),
              h("div", { style: "height:8px;background:#F1EDE5;border-radius:4px;overflow:hidden;" }, h("div", { style: "height:100%;border-radius:4px;width:" + x.barW + ";" + x.barBg })),
              h("span", { style: "font-size:12.5px;color:#807B72;text-align:right;font-family:'Geist Mono',monospace;" }, x.winRate + " WR · " + x.count),
              h("span", { style: "font-family:'Geist Mono',monospace;font-weight:600;font-size:13.5px;text-align:right;" + x.pnlColor }, x.pnlStr)
            );
          })
        )
      )
    );
  }
  function analyticsCard(title, sub, chart) {
    return h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:18px;" },
      h("div", { style: "font-size:14px;font-weight:600;margin-bottom:2px;" }, title),
      h("div", { style: "font-size:12px;color:#A39E94;margin-bottom:8px;" }, sub),
      h("div", null, chart));
  }

  // ---------- diario ----------
  function journalView() {
    var moodColors = { Disciplinado: "#E8F3EC;color:#16915B", Enfocado: "#EAF0F7;color:#3D6FB0", Paciente: "#EAF0F7;color:#3D6FB0", Frustrado: "#FBEAE7;color:#D6483B", Codicioso: "#FBF1E6;color:#C77B2A" };
    var cards = state.journal.map(function (j) {
      var dayPnl = state.trades.filter(function (t) { return t.date === j.date; }).reduce(function (a, t) { return a + t.pnl; }, 0);
      var moodStyle = "display:inline-flex;padding:4px 11px;border-radius:20px;font-size:12px;font-weight:600;background:#" + (moodColors[j.mood] || "F1EDE5;color:#54514A");
      return h("div", { style: "background:#fff;border:1px solid #ECE7DD;border-radius:14px;padding:20px 22px;" },
        h("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;" },
          h("div", { style: "display:flex;align-items:center;gap:11px;" },
            h("span", { style: "font-size:13px;font-weight:600;color:#807B72;font-family:'Geist Mono',monospace;" }, fmtDateLong(j.date)),
            h("span", { style: moodStyle }, j.mood)
          ),
          h("span", { style: "font-family:'Geist Mono',monospace;font-weight:600;font-size:14px;" + pnlColor(dayPnl) }, signed(dayPnl))
        ),
        h("div", { style: "font-size:15.5px;font-weight:600;margin-bottom:6px;letter-spacing:-0.2px;" }, j.title),
        h("div", { style: "font-size:13.5px;color:#54514A;line-height:1.6;" }, j.body),
        h("div", { style: "display:flex;gap:9px;margin-top:14px;padding-top:13px;border-top:1px solid #F3EFE7;align-items:flex-start;" },
          icon('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16915B" stroke-width="2" style="flex:none;margin-top:1px;"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'),
          h("span", { style: "font-size:13px;color:#16181C;line-height:1.5;" }, h("b", { style: "font-weight:600;" }, "Lección: "), j.lesson)
        )
      );
    });
    return h("div", { style: "max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:14px;" }, cards);
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
            h("div", null,
              h("div", { style: "font-size:17px;font-weight:700;letter-spacing:-0.3px;" }, st.symbol),
              h("div", { style: "font-size:11.5px;color:#A39E94;" }, instr + " · " + fmtDateLong(st.date)))
          ),
          h("button", { style: "width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#807B72;", hoverBg: "#FAF8F4", onClick: closeDetail }, icon('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'))
        ),
        h("div", { style: "flex:1;overflow-y:auto;padding:22px;" },
          h("div", { style: "background:#FBFAF7;border:1px solid #ECE7DD;border-radius:13px;padding:18px;text-align:center;margin-bottom:18px;" },
            h("div", { style: "font-size:12px;color:#807B72;" }, "Resultado"),
            h("div", { style: "font-family:'Geist Mono',monospace;font-size:34px;font-weight:700;letter-spacing:-1.5px;margin-top:4px;" + pnlColor(st.pnl) }, signed(st.pnl)),
            h("div", { style: "font-size:12px;color:#A39E94;margin-top:4px;" }, movePts)
          ),
          h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;" },
            infoBox("Entrada", num(st.entry)),
            infoBox("Salida", num(st.exit)),
            infoBox("Contratos", st.contracts),
            infoBox("Setup", st.setup, "font-size:14px;font-weight:600;")
          ),
          h("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;" },
            h("div", null, h("div", { style: "font-size:11px;color:#807B72;margin-bottom:5px;" }, "Emoción"), h("span", { style: emoStyleOf(st.emotion) }, st.emotion)),
            h("div", { style: "text-align:right;" }, h("div", { style: "font-size:11px;color:#807B72;margin-bottom:5px;" }, "Valoración"), h("span", { style: "color:#D8B23E;letter-spacing:2px;font-size:15px;" }, stars(st.rating)))
          ),
          h("div", { style: "margin-bottom:8px;font-size:11px;color:#807B72;" }, "Notas"),
          h("div", { style: "background:#FBFAF7;border:1px solid #ECE7DD;border-radius:11px;padding:15px;font-size:13.5px;line-height:1.6;color:#33312C;" }, note)
        ),
        h("div", { style: "padding:16px 22px;border-top:1px solid #ECE7DD;" },
          h("button", { style: "width:100%;padding:11px;border-radius:10px;border:1px solid #F2D9D5;background:#FCF1EF;color:#D6483B;font-weight:600;font-size:13px;", hoverBg: "#FBEAE7", onClick: deleteSelected }, "Eliminar operación")
        )
      )
    );
  }

  // ===================================================================
  // Add modal (managed separately so typing doesn't lose input focus)
  // ===================================================================
  function openAdd() { state.showAdd = true; state.draft = blankDraft(); renderModal(); }
  function closeAdd() { state.showAdd = false; renderModal(); }

  function renderModal() {
    var root = document.getElementById("modal-root");
    root.innerHTML = "";
    if (!state.showAdd) return;
    root.appendChild(addModal());
  }

  function draftPnl() {
    var d = state.draft;
    var valid = d.entry !== "" && d.exit !== "";
    var pnl = valid ? pnlOf({ symbol: d.symbol, type: d.type, side: d.side, contracts: Number(d.contracts) || 0, entry: Number(d.entry), exit: Number(d.exit) }) : 0;
    return { valid: valid, pnl: pnl };
  }
  function isSaveValid() {
    var d = state.draft;
    return d.symbol && d.entry !== "" && d.exit !== "" && Number(d.contracts) > 0;
  }

  function addModal() {
    // Live elements updated on input without re-rendering the whole modal.
    var previewSpan = h("span", { style: "font-family:'Geist Mono',monospace;font-size:18px;font-weight:600;" }, "");
    var saveBtn = h("button", { onClick: saveTrade }, "Guardar operación");

    function refresh() {
      var dp = draftPnl();
      previewSpan.textContent = dp.valid ? signed(dp.pnl) : "—";
      previewSpan.style.cssText = "font-family:'Geist Mono',monospace;font-size:18px;font-weight:600;" + (dp.valid ? pnlColor(dp.pnl) : "color:#A39E94;");
      var valid = isSaveValid();
      saveBtn.style.cssText = "flex:1.4;padding:11px;border-radius:10px;font-weight:600;font-size:13.5px;" + (valid ? "background:#16181C;color:#fff;" : "background:#CFC9BD;color:#fff;cursor:not-allowed;");
    }
    function bind(name) { return function (ev) { state.draft[name] = ev.target.value; refresh(); }; }

    function field(labelText, control) {
      return h("label", { style: "display:flex;flex-direction:column;gap:6px;" },
        h("span", { style: "font-size:12px;font-weight:600;color:#54514A;" }, labelText), control);
    }
    function input(name, attrs) {
      var props = { value: state.draft[name], onInput: bind(name) };
      for (var k in attrs) props[k] = attrs[k];
      var el = h("input", props);
      el.value = state.draft[name];
      return el;
    }
    function selectField(name, options) {
      var el = h("select", { style: "padding:10px 12px;border:1px solid #E2DDD3;border-radius:9px;font-size:14px;cursor:pointer;background:#fff;", onChange: bind(name) },
        options.map(function (o) { return h("option", { value: o[0] }, o[1]); }));
      el.value = state.draft[name];
      return el;
    }

    var inMono = "padding:10px 12px;border:1px solid #E2DDD3;border-radius:9px;font-size:14px;font-family:'Geist Mono',monospace;";

    var modal = h("div", { class: "dc-modal", style: "position:relative;width:540px;max-width:100%;max-height:92vh;overflow-y:auto;background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.22);" },
      h("div", { style: "display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #ECE7DD;position:sticky;top:0;background:#fff;border-radius:18px 18px 0 0;" },
        h("div", { style: "font-size:16px;font-weight:600;" }, "Nueva operación"),
        h("button", { style: "width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#807B72;", hoverBg: "#FAF8F4", onClick: closeAdd }, icon('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'))
      ),
      h("div", { style: "padding:22px 24px;display:flex;flex-direction:column;gap:16px;" },
        h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:14px;" },
          field("Símbolo", input("symbol", { placeholder: "MES, NQ, SPY…", style: inMono + "text-transform:uppercase;" })),
          field("Fecha", input("date", { type: "date", style: inMono }))
        ),
        h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:14px;" },
          field("Instrumento", selectField("type", [["future", "Futuro"], ["option", "Opción"]])),
          field("Dirección", selectField("side", [["long", "Largo"], ["short", "Corto"]]))
        ),
        h("div", { style: "display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;" },
          field("Contratos", input("contracts", { type: "number", min: "1", style: inMono })),
          field("Entrada", input("entry", { type: "number", step: "0.01", placeholder: "0.00", style: inMono })),
          field("Salida", input("exit", { type: "number", step: "0.01", placeholder: "0.00", style: inMono }))
        ),
        h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:14px;" },
          field("Setup", selectField("setup", [["Ruptura", "Ruptura"], ["Reversión", "Reversión"], ["Pullback", "Pullback"]])),
          field("Emoción", selectField("emotion", [["Tranquilo", "Tranquilo"], ["Confiado", "Confiado"], ["Ansioso", "Ansioso"], ["FOMO", "FOMO"]]))
        ),
        field("Notas", (function () {
          var ta = h("textarea", { rows: "3", placeholder: "¿Qué viste? ¿Seguiste el plan?", style: "padding:10px 12px;border:1px solid #E2DDD3;border-radius:9px;font-size:14px;line-height:1.5;resize:vertical;", onInput: bind("note") });
          ta.value = state.draft.note;
          return ta;
        })()),
        h("div", { style: "display:flex;align-items:center;justify-content:space-between;background:#FBFAF7;border:1px solid #ECE7DD;border-radius:11px;padding:13px 16px;" },
          h("span", { style: "font-size:12.5px;color:#807B72;" }, "P&L estimado"),
          previewSpan
        )
      ),
      h("div", { style: "display:flex;gap:10px;padding:18px 24px;border-top:1px solid #ECE7DD;position:sticky;bottom:0;background:#fff;border-radius:0 0 18px 18px;" },
        h("button", { style: "flex:1;padding:11px;border-radius:10px;border:1px solid #E2DDD3;background:#fff;font-weight:600;font-size:13.5px;", hoverBg: "#FAF8F4", onClick: closeAdd }, "Cancelar"),
        saveBtn
      )
    );

    refresh();

    return h("div", { style: "position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:24px;" },
      h("div", { class: "dc-overlay", style: "position:absolute;inset:0;background:rgba(22,24,28,.34);", onClick: closeAdd }),
      modal
    );
  }

  // ---------- boot ----------
  render();
})();

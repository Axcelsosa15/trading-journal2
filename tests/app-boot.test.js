// Boots the new single-file journal in jsdom, loads the demo dataset and
// asserts the dashboard (hero, KPI tiles, charts) and persistence render.
const fs = require("fs"); const { JSDOM } = require("jsdom"); const vm = require("vm");
const html = fs.readFileSync("index.html", "utf8");
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.com/" });
const { window } = dom; const d = window.document;
const script = [...d.querySelectorAll("script")].map(s => s.textContent).join(";\n");
vm.runInContext(script, dom.getInternalVMContext(), { filename: "inline.js" });
const click = el => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
try {
  const tabs = [...d.querySelectorAll("nav.tabs button")].map(b => b.textContent.trim());
  console.log("5 tabs render:", tabs.length === 5, "(" + tabs.join(", ") + ")");
  console.log("Empty state visible:", !!d.querySelector("#dash-body .empty"));
  const demoBtn = d.querySelector("#load-demo");
  console.log("Demo button present:", !!demoBtn);
  click(demoBtn);
  const state = JSON.parse(window.localStorage.getItem("trading-journal-v2"));
  console.log("Demo trades persisted (>=20):", state.trades.length >= 20, "(" + state.trades.length + ")");
  console.log("Hero P&L renders:", !!d.querySelector(".hero-v") && /\$/.test(d.querySelector(".hero-v").textContent));
  console.log("3 hero KPIs:", d.querySelectorAll(".hkpi").length === 3);
  console.log("12 stat tiles:", d.querySelectorAll(".stat").length === 12);
  const tileText = [...d.querySelectorAll(".stat .k")].map(k => k.textContent);
  console.log("Scalping KPIs present:", ["MFE promedio", "MAE promedio", "Eficiencia captura", "Conflicto misma vela"].every(k => tileText.includes(k)));
  const svgs = d.querySelectorAll("#dash-body .chart-box svg").length;
  console.log("Dashboard charts render (>=5 svg):", svgs >= 5, "(" + svgs + ")");
  console.log("Breakdown tables render:", !!d.querySelector("#setup-table table") && !!d.querySelector("#dir-table table") && !!d.querySelector("#plan-table table") && !!d.querySelector("#ctx-table table") && !!d.querySelector("#vwap-table table"));
  console.log("BOOT SMOKE OK");
} catch (e) { console.log("ERR", e.message, e.stack); }

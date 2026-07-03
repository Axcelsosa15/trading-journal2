// Stored data is untrusted (imports, old caches): hostile strings in
// localStorage must be typed/escaped on load and never reach the DOM as HTML.
const fs = require("fs"); const { JSDOM } = require("jsdom"); const vm = require("vm");
const html = fs.readFileSync("index.html", "utf8");
const EVIL = {
  version: 2,
  trades: [{
    id: '"><img src=x onerror=alert(1)>',
    date: "2026-06-05", time: "bad<time>",
    symbol: "<script>alert(1)</script>", dir: "short",
    setup: '"><svg onload=alert(2)>', session: "Londres",
    size: "<b>2</b>", entry: null, exit: null, sl: null, risk: 100,
    pnl: 50, fees: null, emotion: "<i>x</i>", plan: "Sí",
    tags: ["<u>t</u>"], notes: '"onmouseover="alert(3)'
  }],
  system: { setups: ["<script>s</script>"], checklist: ["<img src=x>"], entrada: "", salida: "", riesgo: "", notas: "" }
};
try {
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.com/" });
  const { window } = dom; const d = window.document;
  window.localStorage.setItem("trading-journal-v2", JSON.stringify(EVIL));
  const script = [...d.querySelectorAll("script")].map(s => s.textContent).join(";\n");
  vm.runInContext(script, dom.getInternalVMContext(), { filename: "inline.js" });
  const click = el => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  click([...d.querySelectorAll("nav.tabs button")].find(b => b.getAttribute("data-view") === "trades"));
  const editBtn = d.querySelector("#trades-tbody [data-edit]");
  console.log("Hostile id stripped to safe charset:", !!editBtn && !/[<>"']/.test(editBtn.getAttribute("data-edit")));
  const cells = [...d.querySelectorAll("#trades-tbody td")].map(td => td.textContent);
  console.log("Non-numeric size nulled (renders em dash):", cells.some(c => c.trim() === "\u2014" || c.trim() === "—"));
  console.log("Invalid time dropped from row:", !/bad/.test(d.querySelector("#trades-tbody tr").textContent));
  console.log("No script element injected:", d.querySelectorAll("#trades-tbody script, #trades-tbody img, #trades-tbody svg").length === 0);
  console.log("Symbol rendered as text:", /<script>alert\(1\)<\/script>/.test(d.querySelector("#trades-tbody .sym").textContent));
  click([...d.querySelectorAll("nav.tabs button")].find(b => b.getAttribute("data-view") === "system"));
  console.log("Setup chip rendered as text:", d.querySelectorAll("#setup-chips script").length === 0 && /<script>s<\/script>/.test(d.querySelector("#setup-chips .chip").textContent));
  console.log("Dashboard renders without throwing:", !!d.querySelector(".hero-v"));
  console.log("SANITIZE SMOKE OK");
} catch (e) { console.log("ERR", e.message, e.stack); }

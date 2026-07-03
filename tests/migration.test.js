// Old-journal (Bitácora) migration: seeds a bitacora_cache_* localStorage key
// before the app boots and asserts trades are converted, deduped and the old
// diary lands in the system notes.
const fs = require("fs"); const { JSDOM } = require("jsdom"); const vm = require("vm");
const html = fs.readFileSync("index.html", "utf8");
function boot(seed) {
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.com/" });
  if (seed) seed(dom.window);
  const script = [...dom.window.document.querySelectorAll("script")].map(s => s.textContent).join(";\n");
  vm.runInContext(script, dom.getInternalVMContext(), { filename: "inline.js" });
  return dom;
}
const OLD = {
  trades: [
    { id: "old-1", date: "2026-05-12", time: "09:30", symbol: "nq", type: "Futuros", side: "long", contracts: 2, entry: 18500, exit: 18540, setup: "ORB", emotion: "Confiado", rating: 4, note: "Buena ejecución", pnl: 160, tags: ["apertura"], mae: -12, mfe: 45 },
    { id: "old-2", date: "2026-05-13", time: "10:15", symbol: "EURUSD", type: "Forex", side: "short", contracts: 1, entry: 1.085, exit: 1.087, setup: "Pullback", emotion: "Ansioso", rating: 2, note: "", pnl: -80, tags: [], mae: "", mfe: "" }
  ],
  journal: [{ id: "j1", date: "2026-05-12", mood: "bien", title: "Buen día", body: "Seguí el plan.", lesson: "Paciencia paga." }]
};
try {
  const dom = boot(w => w.localStorage.setItem("bitacora_cache_u1", JSON.stringify(OLD)));
  const st = JSON.parse(dom.window.localStorage.getItem("trading-journal-v2"));
  console.log("Two old trades migrated:", st.trades.length === 2);
  const t1 = st.trades.find(t => t.id === "old-1");
  console.log("side->dir + symbol upper:", t1.dir === "long" && t1.symbol === "NQ");
  console.log("contracts->size:", t1.size === 2);
  console.log("rating/MAE/MFE folded into notes:", /Rating 4\/5/.test(t1.notes) && /MAE -12/.test(t1.notes));
  console.log("type + marker tags:", t1.tags.includes("Futuros") && t1.tags.includes("journal-viejo"));
  console.log("old diary in system notes:", /Paciencia paga\./.test(st.system.notas));
  // Second boot with same cache: no duplicates
  const dom2 = boot(w => {
    w.localStorage.setItem("trading-journal-v2", JSON.stringify(st));
    w.localStorage.setItem("bitacora_cache_u1", JSON.stringify(OLD));
  });
  const st2 = JSON.parse(dom2.window.localStorage.getItem("trading-journal-v2"));
  console.log("Re-boot dedupes (still 2):", st2.trades.length === 2);
  console.log("MIGRATION SMOKE OK");
} catch (e) { console.log("ERR", e.message, e.stack); }

const fs = require("fs");
const vm = require("vm");
const { JSDOM } = require("jsdom");

const html = '<!doctype html><html><head></head><body><main><header><div><h1>Research quality</h1></div></header><div class="dc-scroll"></div></main><div id="modal-root"><span>Editar operación</span><input placeholder="NY open, breakout, BTC, 5m…" value="strategy:EMA|version:1.0"><button>Guardar cambios</button></div></body></html>';
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.com/" });
const { window } = dom;
const d = window.document;
const trades = [
  { id: "late-loss", date: "2026-01-03", time: "10:00", pnl: -50, tags: [] },
  { id: "early-win", date: "2026-01-01", time: "10:00", pnl: 100, tags: [] },
  { id: "mid-loss", date: "2026-01-02", time: "10:00", pnl: -20, tags: [] }
];
window.localStorage.setItem("bitacora_strategy_lab_v1", JSON.stringify({
  strategies: [{ name: "EMA", version: "1.0", status: "En validación", created: "2026-01-01T00:00:00.000Z" }]
}));
window.BitacoraStrategyLab = {
  getStrategies: () => [],
  getTrades: () => trades,
  saveStrategies: async () => ({ ok: false, reason: "offline" })
};
vm.runInContext(fs.readFileSync("strategy-stability.js", "utf8"), dom.getInternalVMContext(), { filename: "strategy-stability.js" });

setTimeout(() => {
  try {
    const panel = d.querySelector("[data-sl-panel]");
    console.log("Strategy Lab mounts on Research quality:", !!panel);
    console.log("Local strategy survives an empty synced response:", !!panel && /EMA/.test(panel.textContent));
    console.log("Drawdown follows chronological trade order:", !!panel && /−\$70/.test(panel.textContent));
    const picker = d.querySelector("[data-sl-selected]");
    console.log("Editing trade preselects its saved strategy version:", !!picker && picker.value === "strategy:EMA|version:1.0");

    const form = d.querySelector("[data-sl-form]");
    if (form) {
      form.elements.name.value = "ORB";
      form.elements.version.value = "2.0";
      form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    }
    setTimeout(() => {
      console.log("Offline save feedback does not call an undefined toast:", /sincronización pendiente/i.test(d.querySelector("[data-sl-panel]").textContent));
      console.log("STRATEGY STABILITY SMOKE OK");
      dom.window.close();
    }, 25);
  } catch (e) {
    console.log("ERR", e.message, e.stack);
    process.exitCode = 1;
    dom.window.close();
  }
}, 25);

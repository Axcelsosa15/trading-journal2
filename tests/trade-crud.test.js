// Drives the trade form end-to-end: create, live R calc, edit and delete.
const fs = require("fs"); const { JSDOM } = require("jsdom"); const vm = require("vm");
const dom = new JSDOM(fs.readFileSync("index.html", "utf8"), { runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.com/" });
const { window } = dom; const d = window.document;
window.confirm = () => true;
const script = [...d.querySelectorAll("script")].map(s => s.textContent).join(";\n");
vm.runInContext(script, dom.getInternalVMContext(), { filename: "inline.js" });
const click = el => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const input = (id, v) => { const el = d.getElementById(id); el.value = v; el.dispatchEvent(new window.Event("input", { bubbles: true })); };
try {
  click([...d.querySelectorAll("nav.tabs button")].find(b => b.getAttribute("data-view") === "trades"));
  input("f-fecha", "2026-07-01"); input("f-simbolo", "nq"); input("f-pnl", "150.5"); input("f-riesgo", "100");
  console.log("Live R preview:", /1\.50R/.test(d.getElementById("r-preview").textContent));
  d.getElementById("trade-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  let state = JSON.parse(window.localStorage.getItem("trading-journal-v2"));
  console.log("Trade saved:", state.trades.length === 1);
  console.log("Symbol upper-cased:", state.trades[0].symbol === "NQ");
  const row = d.querySelector("#trades-tbody tr");
  console.log("Row rendered:", !!row && /NQ/.test(row.textContent));
  click(row.querySelector("button[data-edit]") || [...row.querySelectorAll("button")].find(b => /Editar/i.test(b.textContent) || /✎/.test(b.textContent)));
  input("f-pnl", "-80");
  d.getElementById("trade-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  state = JSON.parse(window.localStorage.getItem("trading-journal-v2"));
  console.log("Edit updates not duplicates:", state.trades.length === 1 && state.trades[0].pnl === -80);
  const delBtn = [...d.querySelectorAll("#trades-tbody button")].find(b => /borrar|eliminar|✕|🗑/i.test(b.textContent + (b.getAttribute("aria-label") || "")));
  click(delBtn);
  state = JSON.parse(window.localStorage.getItem("trading-journal-v2"));
  console.log("Delete removes trade:", state.trades.length === 0);
  console.log("CRUD SMOKE OK");
} catch (e) { console.log("ERR", e.message, e.stack); }

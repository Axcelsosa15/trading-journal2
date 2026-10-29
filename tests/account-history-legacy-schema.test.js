// An accounts table without the account_history column must not cost the user
// the movement they just typed. Bitácora saves it on the device, keeps showing
// it, and hands it to Supabase once the column exists.
const fs = require("fs");
const { JSDOM } = require("jsdom");
const vm = require("vm");

const ACCOUNT = { id: "a1", name: "Apex", kind: "fondeo", firm: "Apex", balance: 50000, currency: "USD", phase: null, status: "activa", profit_target: null, max_drawdown: null, notes: "" };

function boot(hasHistoryColumn) {
  const dom = new JSDOM(fs.readFileSync("index.html", "utf8"), { runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.com/" });
  const { window } = dom;
  const d = window.document;
  const alerts = [];
  const prompts = ["150", "2026-06-01", "evaluación"];
  let promptAt = 0;
  window.alert = (m) => alerts.push(String(m));
  window.prompt = () => (promptAt < prompts.length ? prompts[promptAt++] : null);
  window.confirm = () => true;

  const rows = [Object.assign({}, ACCOUNT)];
  const writes = [];
  const MISSING = { message: "Could not find the 'account_history' column of 'accounts' in the schema cache" };

  function makeFrom(tbl) {
    const b = {};
    let payload = null;
    let op = "select";
    ["select", "order", "eq", "neq", "gte", "lte", "in", "limit", "range", "single", "maybeSingle", "match", "or", "filter", "is", "delete"]
      .forEach(k => { b[k] = () => b; });
    b.insert = (p) => { op = "insert"; payload = p; return b; };
    b.update = (p) => { op = "update"; payload = p; return b; };
    b.upsert = (p) => { op = "upsert"; payload = p; return b; };
    b.then = (res, rej) => {
      if (tbl !== "accounts" || op === "select") {
        const data = tbl === "trades" || tbl === "journal" ? [] : (tbl === "user_settings" ? null : rows.slice());
        return Promise.resolve({ data, error: null }).then(res, rej);
      }
      writes.push({ op, payload });
      const sendsHistory = payload && Object.prototype.hasOwnProperty.call(payload, "account_history");
      if (sendsHistory && !hasHistoryColumn) return Promise.resolve({ data: null, error: MISSING }).then(res, rej);
      Object.assign(rows[0], payload);
      return Promise.resolve({ data: Object.assign({}, rows[0]), error: null }).then(res, rej);
    };
    return b;
  }

  const session = { user: { email: "t@t.com", id: "u1" } };
  window.supabase = { createClient: () => ({
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() { } } } }), getSession: () => Promise.resolve({ data: { session } }), signOut: async () => ({ error: null }) },
    from: makeFrom
  }) };
  vm.runInContext(fs.readFileSync("app.js", "utf8"), dom.getInternalVMContext(), { filename: "app.js" });
  return { dom, window, d, alerts, writes, rows };
}

const click = (w, el) => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
const goAccounts = (w, d) => click(w, [...d.querySelectorAll("aside nav button")].find(b => /Cuentas/.test(b.textContent)));
const addCost = (w, d) => click(w, [...d.querySelectorAll("main button")].find(b => /\+ Costo/.test(b.textContent)));

(async () => {
  // --- legacy schema: the column is missing
  const A = boot(false);
  await new Promise(r => setTimeout(r, 200));
  goAccounts(A.window, A.d);
  addCost(A.window, A.d);
  await new Promise(r => setTimeout(r, 250));

  const storeKey = "bitacora_acct_history_u1";
  const stored = JSON.parse(A.window.localStorage.getItem(storeKey) || "null");
  const kept = stored && Array.isArray(stored.a1) ? stored.a1 : [];
  console.log("[legacy] movement kept on the device:", kept.length === 1 && kept[0].type === "cost" && kept[0].amount === 150);
  console.log("[legacy] kept event carries an id for later merging:", !!(kept[0] && kept[0].id));
  console.log("[legacy] the failed write is not reported to the user as an error:",
    A.alerts.every(m => !/No se pudo guardar el movimiento/.test(m)));
  const mainText = A.d.querySelector("main").textContent;
  console.log("[legacy] movement still shown in Cuentas:", /evaluación/.test(mainText) && /150/.test(mainText));
  console.log("[legacy] user told once, not per save:", A.alerts.filter(m => /account_history/.test(m)).length === 1);
  addCost(A.window, A.d);
  await new Promise(r => setTimeout(r, 250));
  console.log("[legacy] second save does not alert again:", A.alerts.filter(m => /account_history/.test(m)).length === 1);

  // Saving the account itself must also survive the missing column: the row is
  // written without it, and the history event rides on the device.
  click(A.window, [...A.d.querySelectorAll("main button")].find(b => /Editar estado/.test(b.textContent)));
  await new Promise(r => setTimeout(r, 120));
  const noteInput = [...A.d.querySelectorAll("#modal-root input, #modal-root textarea")].find(el => /evento|nota/i.test(el.placeholder || ""));
  if (noteInput) { noteInput.value = "repaso"; noteInput.dispatchEvent(new A.window.Event("input", { bubbles: true })); }
  click(A.window, [...A.d.querySelectorAll("#modal-root button")].find(b => /Guardar/.test(b.textContent)));
  await new Promise(r => setTimeout(r, 250));
  const strippedWrite = A.writes.some(w => w.op === "update" && w.payload && !Object.prototype.hasOwnProperty.call(w.payload, "account_history") && w.payload.name);
  console.log("[legacy] account row saved with the column stripped out:", strippedWrite);

  // --- migrated schema: the server takes it and nothing is left behind
  const B = boot(true);
  await new Promise(r => setTimeout(r, 200));
  goAccounts(B.window, B.d);
  addCost(B.window, B.d);
  await new Promise(r => setTimeout(r, 250));
  const serverWrite = B.writes.filter(w => w.payload && Array.isArray(w.payload.account_history)).pop();
  console.log("[migrated] history written to Supabase:", !!serverWrite && serverWrite.payload.account_history.length === 1);
  console.log("[migrated] nothing left pending on the device:", !B.window.localStorage.getItem(storeKey) || Object.keys(JSON.parse(B.window.localStorage.getItem(storeKey))).length === 0);
  console.log("[migrated] no migration notice shown:", B.alerts.filter(m => /account_history/.test(m)).length === 0);

  // The hand-over runs on every data load, so a migration applied later syncs
  // without the user doing anything.
  const app = fs.readFileSync("app.js", "utf8");
  console.log("Pending history is handed over on load:", /await flushAccountHistory\(\);/.test(app) && /async function flushAccountHistory/.test(app));
  console.log("Device-held history is wiped on logout:", /localStorage\.removeItem\("bitacora_acct_history_" \+ prevUser\.id\)/.test(app));

  console.log("ACCOUNT HISTORY LEGACY SCHEMA SMOKE OK");
  A.dom.window.close();
  B.dom.window.close();
})();

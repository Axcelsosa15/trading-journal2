// Account lifecycle regression checks: keep UI states, SQL constraint, and
// failure-handling contracts aligned. These are source-level checks, not a
// substitute for exercising a live Supabase project.
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const schema = fs.readFileSync(path.join(root, "supabase", "schema.sql"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase", "account-lifecycle.sql"), "utf8");

function check(label, condition) {
  console.log(label + ": " + !!condition);
  if (!condition) process.exitCode = 1;
}

const states = ["activa", "evaluacion", "fondeada", "payout_pedido", "payout_aprobado", "aprobada", "quemada", "pausada", "cerrada", "archivada"];
const sqlStates = schema.match(/check \(status in \(([^)]*)\)\)/i);
const migrationStates = migration.match(/check \(status in \(([^)]*)\)\)/i);
function parseStates(match) {
  return match ? Array.from(match[1].matchAll(/'([^']+)'/g), m => m[1]) : [];
}
const uiStates = Array.from(app.matchAll(/\[\s*["']([a-z_]+)["']\s*,\s*["'][^"']+["']\s*\]/g), m => m[1]);
check("Schema constraint contains all lifecycle states", states.every(s => parseStates(sqlStates).includes(s)));
check("Existing-installation migration contains all lifecycle states", states.every(s => parseStates(migrationStates).includes(s)));
check("UI exposes every lifecycle state", states.every(s => uiStates.includes(s)));
check("Account save validates non-negative target and drawdown", /optionalNonNegative\(d\.profit_target/.test(app) && /optionalNonNegative\(d\.max_drawdown/.test(app));
check("Account save catches unexpected async failures", /No se pudo guardar la cuenta por un error de conexión o del servidor/.test(app));
check("Account archive catches unexpected async failures", /No se pudo archivar la cuenta por un error de conexión o del servidor/.test(app));
check("Archiving updates status/history rather than deleting the account", /update\(\{ status: "archivada", account_history: history \}\)/.test(app) && !/from\("accounts"\)\.delete\(\)/.test(app));
check("Archived account cannot be archived again", /account\.status === "archivada"/.test(app) && /editing && d\.status !== "archivada"/.test(app));

if (!process.exitCode) console.log("ACCOUNT LIFECYCLE SMOKE OK");

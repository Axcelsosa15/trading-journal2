#!/usr/bin/env node
/*
 * Runtime verification for Bitacora's Supabase RLS policies.
 *
 * Usage:
 *   SUPABASE_TEST_EMAIL="user@example.com" \
 *   SUPABASE_TEST_PASSWORD="password" \
 *   node supabase/verify_runtime.js
 *
 * The script signs in as a normal user, verifies anonymous table access is not
 * granted, then creates/updates/deletes rows through the public REST API. It
 * uses only the public anon key from app.js, never a service-role key.
 */
"use strict";

var SUPABASE_URL = "https://ajihczecndwznolgbrdc.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqaWhjemVjbmR3em5vbGdicmRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNjYzNjAsImV4cCI6MjA5NzY0MjM2MH0.TVFPDqESi2K25LG-5syZ70KLpmlDzQhLB1aXa3RZWWc";

var email = process.env.SUPABASE_TEST_EMAIL;
var password = process.env.SUPABASE_TEST_PASSWORD;
var captchaToken = process.env.SUPABASE_CAPTCHA_TOKEN;

function fail(message, detail) {
  console.error("FAIL:", message);
  if (detail) console.error(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
  process.exitCode = 1;
}

async function request(path, opts) {
  opts = opts || {};
  var headers = Object.assign({
    apikey: SUPABASE_ANON_KEY,
    Authorization: "Bearer " + (opts.jwt || SUPABASE_ANON_KEY),
    Accept: "application/json",
  }, opts.headers || {});
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  var res = await fetch(SUPABASE_URL + path, {
    method: opts.method || "GET",
    headers: headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  var text = await res.text();
  var json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) { json = text; }
  return { ok: res.ok, status: res.status, body: json, headers: res.headers };
}

async function signIn() {
  if (!email || !password) {
    fail("Set SUPABASE_TEST_EMAIL and SUPABASE_TEST_PASSWORD before running runtime verification.");
    return null;
  }
  var payload = { email: email, password: password };
  if (captchaToken) payload.gotrue_meta_security = { captcha_token: captchaToken };
  var res = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { Authorization: "Bearer " + SUPABASE_ANON_KEY },
    body: payload,
  });
  if (!res.ok || !res.body || !res.body.access_token) {
    fail("Could not sign in test user. If CAPTCHA protection is enabled, run this from the browser flow or provide SUPABASE_CAPTCHA_TOKEN.", res.body);
    return null;
  }
  return res.body.access_token;
}

async function expectAnonDenied(table) {
  var res = await request("/rest/v1/" + table + "?select=*&limit=1");
  if (res.ok) fail("Anonymous access should be denied for " + table, res.body);
  else console.log("anon denied:", table, res.status);
}

async function insert(jwt, table, body) {
  var res = await request("/rest/v1/" + table, {
    method: "POST",
    jwt: jwt,
    headers: { Prefer: "return=representation" },
    body: body,
  });
  if (!res.ok || !Array.isArray(res.body) || !res.body[0]) {
    fail("Insert failed for " + table, res.body);
    return null;
  }
  console.log("insert ok:", table, res.body[0].id);
  return res.body[0];
}

async function patch(jwt, table, id, body) {
  var res = await request("/rest/v1/" + table + "?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    jwt: jwt,
    headers: { Prefer: "return=representation" },
    body: body,
  });
  if (!res.ok || !Array.isArray(res.body) || !res.body[0]) fail("Update failed for " + table, res.body);
  else console.log("update ok:", table, id);
}

async function remove(jwt, table, id) {
  var res = await request("/rest/v1/" + table + "?id=eq." + encodeURIComponent(id), {
    method: "DELETE",
    jwt: jwt,
  });
  if (!res.ok) fail("Delete failed for " + table, res.body);
  else console.log("delete ok:", table, id);
}

async function upsertSettings(jwt) {
  var res = await request("/rest/v1/user_settings?on_conflict=user_id", {
    method: "POST",
    jwt: jwt,
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: { data: { rules: {}, checklist: ["runtime verifier"], onboardingDone: true } },
  });
  if (!res.ok) fail("user_settings upsert failed", res.body);
  else console.log("upsert ok: user_settings");
}

(async function main() {
  await Promise.all(["trades", "journal", "accounts", "user_settings"].map(expectAnonDenied));
  var jwt = await signIn();
  if (!jwt) return;

  var account = await insert(jwt, "accounts", {
    name: "RLS Runtime Test",
    kind: "demo",
    firm: "QA",
    balance: 10000,
    currency: "USD",
    phase: null,
    status: "activa",
    profit_target: null,
    max_drawdown: null,
    notes: "temporary verifier row",
  });
  if (!account) return;

  var trade = await insert(jwt, "trades", {
    date: "2026-07-03",
    time: "12:00",
    symbol: "NQ",
    type: "future",
    side: "long",
    contracts: 1,
    entry: 20000,
    exit: 20010,
    setup: "Ruptura",
    emotion: "Enfocado",
    rating: 5,
    note: "temporary verifier row",
    pnl: 200,
    fees: 0,
    account_id: account.id,
    tags: ["runtime-verifier"],
    mae: null,
    mfe: null,
    screenshot_path: null,
  });
  var journal = await insert(jwt, "journal", {
    date: "2026-07-03",
    mood: "Enfocado",
    title: "Runtime verifier",
    body: "temporary verifier row",
    lesson: "RLS works",
  });

  if (trade) await patch(jwt, "trades", trade.id, { note: "runtime verifier updated" });
  if (journal) await patch(jwt, "journal", journal.id, { lesson: "updated" });
  if (account) await patch(jwt, "accounts", account.id, { notes: "updated" });
  await upsertSettings(jwt);

  if (trade) await remove(jwt, "trades", trade.id);
  if (journal) await remove(jwt, "journal", journal.id);
  if (account) await remove(jwt, "accounts", account.id);

  if (!process.exitCode) console.log("SUPABASE RLS RUNTIME VERIFY OK");
})().catch(function (err) {
  fail("Unexpected verifier error", err && (err.stack || err.message) || String(err));
});

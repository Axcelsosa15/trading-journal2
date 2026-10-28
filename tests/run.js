/* Headless smoke-test runner.
 *
 * Each tests/*.test.js boots the app in jsdom with a mocked Supabase client and
 * prints "Label: true/false" assertions plus a final "… SMOKE OK" sentinel.
 * A test fails if it exits non-zero, throws (ERR/Error), prints any failing
 * assertion ("…: false"), never reaches its sentinel, or hangs past
 * BITACORA_TEST_TIMEOUT_MS (default 60s). Runs from repo root.
 */
"use strict";
var fs = require("fs");
var path = require("path");
var cp = require("child_process");

var dir = __dirname;
var root = path.join(dir, "..");
var files = fs.readdirSync(dir).filter(function (f) { return /\.test\.js$/.test(f); }).sort();

// A hung test must fail instead of blocking the whole suite (and CI) forever.
var TIMEOUT_MS = Number(process.env.BITACORA_TEST_TIMEOUT_MS) || 60000;

var failed = 0;
files.forEach(function (f) {
  var res = cp.spawnSync(process.execPath, [path.join(dir, f)], { cwd: root, encoding: "utf8", timeout: TIMEOUT_MS, killSignal: "SIGKILL" });
  var out = (res.stdout || "") + (res.stderr || "");
  var problems = [];
  var timedOut = !!(res.error && res.error.code === "ETIMEDOUT") || res.signal === "SIGKILL";
  if (timedOut) problems.push("timed out after " + (TIMEOUT_MS / 1000) + "s (a leaked timer or pending promise keeps the process alive)");
  else if (res.status !== 0) problems.push("exit code " + res.status);
  if (/\bERR\b/.test(out) || /Error:/.test(out) || /\bundefined\b is not/.test(out)) problems.push("threw an error");
  var falses = out.split("\n").filter(function (l) { return /:\s*false(\s|$|\b)/i.test(l); });
  if (falses.length) problems.push("failing assertions:\n    " + falses.join("\n    "));
  if (!/SMOKE OK/.test(out)) problems.push("did not reach its success sentinel");

  if (problems.length) {
    failed++;
    console.log("✗ FAIL  " + f);
    problems.forEach(function (p) { console.log("   - " + p); });
    console.log("   --- output ---\n" + out.split("\n").map(function (l) { return "   " + l; }).join("\n"));
  } else {
    console.log("✓ PASS  " + f);
  }
});

console.log("\n" + (files.length - failed) + "/" + files.length + " test files passed.");
process.exit(failed ? 1 : 0);

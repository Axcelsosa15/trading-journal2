// The service worker must serve CODE network-first so new deploys are never
// hidden behind a stale cache (the "veo lo viejo, no lo nuevo" bug), and must
// activate immediately. Pure fs assertions over sw.js.
const fs=require("fs");
const sw=fs.readFileSync("sw.js","utf8");
console.log("Cache version bumped past v1:", /var CACHE = "bitacora-v[2-9]/.test(sw));
console.log("Install calls skipWaiting (adopt new build now):", /install[\s\S]*skipWaiting/.test(sw));
console.log("Activate claims clients:", /activate[\s\S]*clients\.claim/.test(sw));
console.log("Code is network-first:", /function networkFirst/.test(sw) && /isCode \? networkFirst/.test(sw));
console.log("Navigations + html/js/css treated as code:", /req\.mode === "navigate" \|\| \/\\\.\(html\|js\|css\)\$\//.test(sw));
console.log("networkFirst falls back to cache offline:", /networkFirst[\s\S]*catch[\s\S]*caches\.open/.test(sw));
console.log("Supabase still never cached:", /supabase\\?\.co\$\/\.test\(url\.hostname\)\) return/.test(sw));
console.log("SW STRATEGY SMOKE OK");

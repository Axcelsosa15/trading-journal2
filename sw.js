/* Bitácora service worker — offline app shell.
 *
 * Strategy:
 *  - Code (navigations + .html/.js/.css): NETWORK-FIRST. The newest deploy always
 *    wins when online; the cache is only a fallback for offline. This is what
 *    keeps users from getting stuck on a stale build.
 *  - Other same-origin assets (icons, manifest): cache-first with background
 *    refresh (they change rarely).
 *  - Cross-origin (Supabase SDK, fonts): cache-first.
 *  - Supabase API/auth/realtime: never cached.
 *
 * The worker activates immediately (skipWaiting + clients.claim) so a new deploy
 * takes over on the next load instead of waiting behind the old one. Bump CACHE
 * to purge old asset versions.
 */
var CACHE = "bitacora-v3";
var SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./styles.css",
  "./theme-dark.css",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // Tolerant add so one missing asset doesn't fail the whole install.
      return Promise.all(SHELL.map(function (url) {
        return c.add(url).catch(function () { });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

// Still honour an explicit skipWaiting message (kept for compatibility).
self.addEventListener("message", function (e) {
  if (!e) return;
  if (e.origin && e.origin !== self.location.origin) return;
  if (e.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function networkFirst(req) {
  return fetch(req).then(function (res) {
    if (res && res.status === 200) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
    }
    return res;
  }).catch(function () {
    return caches.open(CACHE).then(function (c) {
      return c.match(req).then(function (cached) {
        if (cached) return cached;
        if (req.mode === "navigate") return c.match("./index.html");
        return new Response("", { status: 504, statusText: "offline" });
      });
    });
  });
}

function cacheFirst(req, allowOpaque) {
  return caches.open(CACHE).then(function (c) {
    return c.match(req).then(function (cached) {
      var net = fetch(req).then(function (res) {
        if (res && (res.status === 200 || (allowOpaque && res.type === "opaque"))) c.put(req, res.clone());
        return res;
      }).catch(function () { return null; });
      if (cached) { net.catch(function () { }); return cached; }
      return net.then(function (res) { return res || new Response("", { status: 504 }); });
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  // Never cache Supabase (auth/data/realtime) — always go to network.
  if (/supabase\.co$/.test(url.hostname)) return;

  if (url.origin === self.location.origin) {
    // Code must be fresh: navigations and our HTML/JS/CSS go network-first.
    var isCode = req.mode === "navigate" || /\.(html|js|css)$/.test(url.pathname);
    e.respondWith(isCode ? networkFirst(req) : cacheFirst(req, false));
    return;
  }

  // Cross-origin (CDN SDK, fonts): cache-first.
  e.respondWith(cacheFirst(req, true));
});

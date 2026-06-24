/* Bitácora service worker — offline app shell.
 *
 * Caches the static shell so the app loads with no connection. Supabase API
 * calls are never cached (the app caches its own data in localStorage and
 * queues writes in an outbox); the SDK and fonts are cached so the shell can
 * boot offline. Bump CACHE to invalidate old assets on deploy.
 */
var CACHE = "bitacora-v1";
var SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./styles.css",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // addAll is atomic; add tolerantly so one miss doesn't fail install.
      return Promise.all(SHELL.map(function (url) {
        return c.add(url).catch(function () { });
      }));
    })
    // Do NOT skipWaiting here: let the new worker wait so the app can prompt the
    // user ("nueva versión disponible") and activate it on demand.
  );
});

// Activate the waiting worker when the page asks (user clicked "Actualizar").
self.addEventListener("message", function (e) {
  if (!e) return;
  // Only honour messages from same-origin clients (origin is "" for same-context).
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

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  // Never cache Supabase (auth/data/realtime) — always go to network.
  if (/supabase\.co$/.test(url.hostname)) return;

  var sameOrigin = url.origin === self.location.origin;

  if (sameOrigin) {
    // Stale-while-revalidate for our own shell assets.
    e.respondWith(
      caches.open(CACHE).then(function (c) {
        return c.match(req).then(function (cached) {
          var net = fetch(req).then(function (res) {
            if (res && res.status === 200) c.put(req, res.clone());
            return res;
          }).catch(function () { return null; });
          // For navigations offline, fall back to cached index.html.
          if (cached) { net.catch(function () { }); return cached; }
          return net.then(function (res) {
            if (res) return res;
            if (req.mode === "navigate") return c.match("./index.html");
            return new Response("", { status: 504, statusText: "offline" });
          });
        });
      })
    );
    return;
  }

  // Cross-origin (CDN SDK, fonts): cache-first, then network.
  e.respondWith(
    caches.open(CACHE).then(function (c) {
      return c.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req).then(function (res) {
          if (res && (res.status === 200 || res.type === "opaque")) c.put(req, res.clone());
          return res;
        }).catch(function () { return cached || new Response("", { status: 504 }); });
      });
    })
  );
});

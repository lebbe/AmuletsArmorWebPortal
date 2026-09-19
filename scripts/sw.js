// Service worker for the site shell: pages, scripts, styles and icons.
// vite.config.ts copies this to dist/sw.js and fills in VERSION and PRECACHE,
// so the worker changes (and updates) whenever any of those files change.
//
// The engine files (engine/) and the map packs (mods/) are NOT handled here:
// the page keeps them in the Cache API itself (src/engine/cache.ts,
// src/mods/mods.ts), which works on the very first visit too.

const VERSION = "__VERSION__";
const PRECACHE = __PRECACHE__;
const CACHE = `aa-shell-${VERSION}`;
const SCOPE = self.registration.scope;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // all or nothing: if a file is missing, this worker is not installed
      await cache.addAll(PRECACHE.map((path) => new Request(new URL(path, SCOPE), { cache: "reload" })));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith("aa-shell-") && name !== CACHE) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (!url.href.startsWith(SCOPE)) return;
  const path = url.href.slice(SCOPE.length);
  if (path.startsWith("engine/") || path.startsWith("mods/")) return;

  event.respondWith(
    (async () => {
      // "play.html?mods=..." is the same page as "play.html". Hosts may send "Vary: Origin",
      // which would keep the module scripts (fetched in CORS mode) from matching what was precached.
      const hit = await caches.match(request, {
        cacheName: CACHE,
        ignoreSearch: request.mode === "navigate",
        ignoreVary: true,
      });
      return hit ?? fetch(request);
    })(),
  );
});

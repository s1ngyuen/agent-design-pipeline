// Scanna service worker — hand-rolled (vanilla, no Workbox/next-pwa).
//
// Deviation note (see frontend-developer's final report): plan.md §1
// specified next-pwa (Workbox) for the PWA layer. next-pwa's last release
// predates Next.js's App Router/Turbopack-era config surface by years and
// its webpack-plugin approach doesn't line up cleanly with this project's
// Next 16.2 build — rather than fight a stale dependency, this is a small
// hand-written SW covering exactly the caching behaviour plan.md §PWA
// describes: app-shell precaching, stale-while-revalidate for the TCDB
// checklist, and an offline navigation fallback. The IndexedDB write-outbox
// itself (src/lib/offlineQueue.ts) is unaffected either way — it never
// depended on Workbox.

const CACHE_VERSION = "scanna-v1";
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const TCDB_CACHE = `${CACHE_VERSION}-tcdb`;

const PRECACHE_URLS = ["/offline.html", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("scanna-") && !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never cache mutating requests
  const url = new URL(request.url);

  // TCDB checklist: stale-while-revalidate, per plan.md §PWA — serve the
  // cached copy instantly (if any) for offline manual entry, refresh in the
  // background whenever there's connectivity.
  if (url.pathname === "/api/tcdb/checklist") {
    event.respondWith(
      caches.open(TCDB_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => undefined);
        return cached ?? (await network) ?? new Response(JSON.stringify({ error: "offline" }), { status: 503 });
      }),
    );
    return;
  }

  // Never cache other API calls — recognition/estimate/mutations must
  // always hit the network or fail explicitly, never serve stale data.
  if (url.pathname.startsWith("/api/")) return;

  // Next.js static build assets — immutable, hashed filenames: cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // Page navigations: network-first, falling back to a cached copy, then
  // to the offline fallback page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, res.clone()));
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(RUNTIME_CACHE);
          const cached = await cache.match(request);
          return cached ?? caches.match("/offline.html");
        }),
    );
  }
});

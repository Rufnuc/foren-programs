/* Prutet — minimal service worker.
 *
 * Goals (Phase 4):
 *   1. Make the shell available offline so a user who is in distress and
 *      offline can still capture evidence into the IndexedDB queue.
 *   2. Never cache user content. The evidence list is fetched from
 *      IndexedDB at runtime — the SW only caches static app assets.
 *
 * Phase 5 will replace this with `next-pwa`'s precache manifest, which
 * builds the asset list automatically from the Next.js compile output.
 */
const VERSION = "prutet-v1";
const PRECACHE = [
  "/",
  "/onboarding",
  "/evidence",
  "/settings",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  // Never cache calls to the relay or to RPC endpoints — they must fail
  // openly when offline so the UI can queue.
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          // Don't cache opaque/error responses or the ZK artefacts (they're large).
          if (res.ok && !url.pathname.startsWith("/zk/")) {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

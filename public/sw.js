// Trewel service worker — deliberately minimal. Its only job is to satisfy
// installability requirements (Add to Home Screen, standalone launch). It
// performs NO caching and NO request interception logic beyond a network
// passthrough, so the app behaves identically to a normal browser visit.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Network passthrough — no cache layer, no offline shell.
  event.respondWith(fetch(event.request));
});

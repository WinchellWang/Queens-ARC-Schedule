const CACHE_NAME = "queens-arc-shell-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./about.html",
  "./manifest.json",
  "./web_logo.jpg",
  "./assets/style.css",
  "./assets/app.js",
  "./assets/index.global.min.js",
  "./assets/ical.min.js",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    }),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.pathname.endsWith("/gym.ics")) {
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy);
            });
          }
          return response;
        })
        .catch(async () => {
          return (
            (await caches.match(request)) ||
            (await caches.match("./index.html"))
          );
        }),
    );
    return;
  }

  /*
   * Static app resources:
   *
   * Cache first for fast PWA startup.
   * Refresh cache in the background.
   */
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkResponse = fetch(request)
        .then((response) => {
          if (
            response &&
            (response.ok || response.type === "opaque")
          ) {
            const copy = response.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy);
            });
          }
          return response;
        })
        .catch(() => cachedResponse);
      return cachedResponse || networkResponse;
    }),
  );
});
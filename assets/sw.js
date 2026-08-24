const CACHE_NAME = "queens-arc-shell-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./about.html",
  "./manifest.json",
  "./web_logo.jpg",
  "./assets/ical.min.js",
  "./assets/analytics.js",
];

// 安装：预缓存本地 UI / app shell。
// gym.ics 故意不在这里。
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );

  self.skipWaiting();
});

// 激活：删除旧缓存。
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // gym.ics：严格 network-only。
  // 永远不读 Service Worker cache。
  if (
    url.origin === self.location.origin &&
    url.pathname.endsWith("/gym.ics")
  ) {
    event.respondWith(
      fetch(request, {
        cache: "no-store",
      })
    );
    return;
  }

  // 页面导航：
  // 优先网络，失败时立即使用缓存中的页面。
  // 这样 PWA 冷启动没网时也不会白屏，
  // 在线时又不会长期卡在旧 HTML。
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, copy));
          }

          return response;
        })
        .catch(async () => {
          return (
            (await caches.match(request)) ||
            (await caches.match("./index.html"))
          );
        })
    );

    return;
  }

  // 其余静态资源：
  // cache-first，后台网络更新。
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkRequest = fetch(request)
        .then((response) => {
          // same-origin 或可正常缓存的 CDN resource
          if (response && (response.ok || response.type === "opaque")) {
            const copy = response.clone();

            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, copy));
          }

          return response;
        })
        .catch(() => cached);

      return cached || networkRequest;
    })
  );
});
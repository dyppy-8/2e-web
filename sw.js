const CACHE_NAME = "2e-pwa-v8";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=18",
  "./app.js?v=19",
  "./config.js?v=13",
  "./manifest.webmanifest",
  "./pwa-icon-180.png",
  "./pwa-icon-192.png",
  "./pwa-icon-512.png",
  "./pwa-maskable-512.png",
  "./real_app_logo.png",
  "./in_app_icon.png",
  "./in_app_icon_2e.png",
  "./in_app_e_pink.png",
  "./in_app_e_blue.png",
  "./2e_app_icon.png",
  "./rainbow.jpg",
  "./istanbul_unsplash.jpg",
  "./eiffel_unsplash.jpg",
  "./eiffel_photo.jpg",
  "./bosphorus_bridge.jpg",
  "./hagia_sophia.jpg",
  "./blue_mosque.jpg",
  "./notre_dame.jpg",
  "./galata.jpg",
  "./columbina.png",
  "./fischl.webp",
  "./hutao.webp",
  "./wanderer.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try { payload = event.data.json(); }
    catch { payload = { title: "2E", body: event.data.text() }; }
  }
  const title = payload.title || "2E";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "./pwa-icon-192.png",
    badge: payload.badge || "./pwa-icon-192.png",
    tag: payload.tag || "2e-push",
    data: payload.data || {},
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of allClients) {
      if ("focus" in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow("./");
  })());
});

const NETWORK_FIRST = /\/(index\.html|app\.js|config\.js|sw\.js|styles\.css)(\?|$)/;

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (NETWORK_FIRST.test(url.pathname + url.search) || url.pathname.endsWith("/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});

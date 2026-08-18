// Service worker : notifications + coquille hors-ligne (PWA).
// Stratégie "réseau d'abord" : jamais de version périmée quand le réseau
// est là, démarrage instantané et mode hors-ligne quand il ne l'est pas.

const CACHE = "sacoches-v1";
const SHELL = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "db.js",
  "firebase-config.js",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;
  event.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return resp;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || caches.match("./"))
      )
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      const tab = tabs.find((t) => t.url.includes("/sacoches"));
      if (tab) return tab.focus();
      return self.clients.openWindow("./");
    })
  );
});

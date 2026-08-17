// Service worker minimal : nécessaire pour afficher des notifications
// système sur Android (registration.showNotification) et ramener
// l'utilisateur sur l'app au clic.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

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

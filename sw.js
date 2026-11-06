/* Retired. FitForm used to live at the site root; it now lives in /fitform/ and Football Fitness in /footyfit/.
   This worker deletes the old root caches, unregisters itself and reloads open pages so each app's own worker takes over. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith("fitform-") && !k.startsWith("fitform-app-")).map(k => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then(cs => cs.forEach(c => c.navigate(c.url)))
  );
});

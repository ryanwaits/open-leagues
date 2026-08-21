/* open-ff push worker.
 * Network-only for documents — never store a navigation (stale index.html).
 * Passthrough for /__grok/ (install tutorial ?install=1).
 * Push + passthrough fetch only.
 */
self.addEventListener("install", (_event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/__grok")) {
    event.respondWith(fetch(event.request));
    return;
  }
  if (event.request.mode === "navigate") {
    // network-only: fetch( without a cached HTML fallback
    event.respondWith(fetch(event.request));
  }
});

self.addEventListener("push", (event) => {
  let payload = { title: "Open Leagues", body: "", url: "/" };
  try {
    if (event.data) payload = { ...payload, ...JSON.parse(event.data.text()) };
  } catch {
    /* keep defaults */
  }
  const title = String(payload.title || "Open Leagues");
  const body = String(payload.body || "");
  const url = String(payload.url || "/");
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/__grok/icon-180.png",
      badge: "/__grok/icon-180.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(self.clients.openWindow(url));
});

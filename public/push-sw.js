/* ULPA · push notifications (imported into the generated service worker). */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "ULPA", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "ULPA";
  const options = {
    body: data.body || "",
    icon: "/pwa-192.png",
    badge: "/badge-96.png",
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || "/" },
    lang: "kk",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin)) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});

// Zmieniaj wersję tylko wtedy, gdy aktualizujemy powłokę aplikacji.
// Dzięki temu zainstalowany panel nie otworzy przestarzałego index.html.
const CACHE = "kamera-domowa-shell-v150";
const SHELL = ["./panel-entry.mjs?v=2", "./", "./index.html", "./panel.html", "./public-entry.js?v=2", "./style.css?v=185", "./workspace-ui.css?v=13", "./workspace-panels.mjs?v=2", "./account-ui.mjs?v=3", "./auth.js?v=13", "./account-security.mjs?v=1", "./access.js?v=19", "./lock.js?v=19", "./app.js?v=240", "./zoom.js?v=17", "./audio-profile.mjs?v=1", "./diskstore.js?v=11", "./local-retention.mjs?v=1", "./dvr-ui.js?v=105", "./remote-folder-ui.mjs", "./communication/folder-channel.mjs", "./communication/folder-readiness.mjs", "./desktop.js?v=40", "./camera-workspace.css?v=2", "./camera-workspace.mjs?v=2", "./core/camera-catalog.mjs?v=2", "./core/camera-sources.mjs?v=2", "./mobile.js?v=18", "./core/store.mjs", "./core/router.mjs", "./core/peer-diagnostics.mjs", "./communication/commands.mjs", "./auth-experience.css?v=2", "./auth-experience.mjs?v=2", "./manifest.webmanifest?v=3", "./icons/kamera-192.svg", "./icons/apple-touch-icon.png", "./icons/kamera-512.svg", "./vendor/supabase.js?v=2.117.2"];

SHELL.push("./core/view-memory.mjs?v=1", "./recording-view-state.mjs?v=1", "./recording-time.mjs?v=1", "./recording-actions.mjs?v=2", "./native-drive-ui.mjs?v=2", "./interface-theme.css?v=3", "./interface-concept.css?v=2", "./core/client-layout.js?v=2", "./core/web-updates.mjs?v=4", "./core/operator-status.mjs?v=1", "./communication/agent-telemetry.mjs?v=2", "./communication/native-agent-client.mjs");
self.addEventListener("install", event => {
  SHELL.push("./marketing.css?v=13", "./marketing-motion.css?v=2", "./marketing-motion.mjs?v=3", "./marketing-gallery.css?v=3", "./marketing-gallery.mjs?v=2", "./marketing-start.css?v=3", "./marketing-start.mjs?v=2", "./marketing-auto-update.css?v=2", "./marketing-auto-update.mjs?v=5", "./marketing-contact.js?v=8");
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("kamera-domowa-shell-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // Release metadata must never be frozen by the offline asset cache.
  if (/\/(?:desktop-update|version)\.json$/.test(url.pathname)) {
    event.respondWith(fetch(event.request, {cache: 'no-store'}));
    return;
  }
  if (event.request.mode === "navigate") {
    const panelPath = new URL("./", self.location.href).pathname;
    const homeNavigation = url.pathname === panelPath || url.pathname === panelPath + "index.html";
    const panelNavigation = url.pathname === panelPath + "panel.html";
    const pageKey = panelNavigation ? "./panel.html" : homeNavigation ? "./index.html" : url.origin + url.pathname;
    event.respondWith(fetch(event.request).then(async response => {
      if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
        try { const cache = await caches.open(CACHE); await cache.put(pageKey, response.clone()); } catch { /* A full cache must not hide a working network response. */ }
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(pageKey);
      if (cached) return cached;
      return new Response('<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Brak połączenia — HOME SECURITY</title><h1>Ta strona nie jest dostępna offline</h1><p>Połącz się z internetem i spróbuj ponownie.</p><a href="' + panelPath + '">Wróć do HOME SECURITY</a></html>', {status:503,headers:{"Content-Type":"text/html; charset=utf-8"}});
    }));
    return;
  }
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => { if (response.ok && url.pathname.includes("/kamera/")) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); } return response; })));
});

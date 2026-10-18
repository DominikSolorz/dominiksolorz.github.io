// Zmieniaj wersję tylko wtedy, gdy aktualizujemy powłokę aplikacji.
// Dzięki temu zainstalowany panel nie otworzy przestarzałego index.html.
const CACHE = "kamera-domowa-shell-v103";
const SHELL = ["./", "./index.html", "./style.css?v=184", "./workspace-ui.css?v=8", "./workspace-panels.mjs?v=1", "./account-ui.mjs?v=3", "./auth.js?v=11", "./account-security.mjs?v=1", "./access.js?v=19", "./lock.js?v=19", "./app.js?v=200", "./audio-profile.mjs?v=1", "./diskstore.js?v=10", "./local-retention.mjs?v=1", "./dvr-ui.js?v=102", "./remote-folder-ui.mjs", "./communication/folder-channel.mjs", "./communication/folder-readiness.mjs", "./desktop.js?v=31", "./mobile.js?v=13", "./core/store.mjs", "./core/router.mjs", "./core/peer-diagnostics.mjs", "./communication/commands.mjs", "./manifest.webmanifest?v=1", "./icons/kamera-192.svg", "./icons/kamera-512.svg", "./vendor/supabase.js?v=2.117.2"];

self.addEventListener("install", event => {
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
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put("./index.html", copy)); return response; }).catch(() => caches.match("./index.html")));
    return;
  }
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => { if (response.ok && url.pathname.includes("/kamera/")) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); } return response; })));
});

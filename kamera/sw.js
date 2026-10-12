// Zmieniaj wersję tylko wtedy, gdy aktualizujemy powłokę aplikacji.
// Dzięki temu zainstalowany panel nie otworzy przestarzałego index.html.
const CACHE = "kamera-domowa-shell-v11";
const SHELL = ["./", "./index.html", "./style.css?v=133", "./app.js?v=127", "./desktop.js?v=9", "./mobile.js?v=3", "./manifest.webmanifest?v=1", "./icons/kamera-192.svg", "./icons/kamera-512.svg", "./vendor/supabase.js?v=2.117.2"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("kamera-domowa-shell-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
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

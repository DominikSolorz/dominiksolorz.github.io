// Zmieniaj wersję tylko wtedy, gdy aktualizujemy powłokę aplikacji.
// Dzięki temu zainstalowany panel nie otworzy przestarzałego index.html.
const CACHE = "kamera-domowa-shell-v289";
const SHELL = ["./desktop-update-presentation.mjs?v=1", "./desktop-auth-return.js?v=1", "./desktop-oauth.mjs?v=1", "./desktop-auth.html", "./panel-entry.mjs?v=4", "./", "./index.html", "./panel.html", "./public-entry.js?v=9", "./style.css?v=185", "./workspace-ui.css?v=13", "./panel.css?v=21", "./workspace-panels.mjs?v=4", "./account-ui.mjs?v=3", "./auth.js?v=17", "./account-security.mjs?v=1", "./access.js?v=21", "./lock.js?v=23", "./app.js?v=289&pin=23", "./core/reconnecting-channel.mjs?v=1", "./zoom.js?v=17", "./audio-profile.mjs?v=2", "./audio-cleaner.mjs?v=1", "./noise-gate.worklet.js?v=1", "./diskstore.js?v=12", "./close-recording-fragment.mjs?v=1", "./local-retention.mjs?v=1", "./dvr-ui.js?v=109", "./core/dvr-navigation.mjs?v=1", "./remote-folder-ui.mjs", "./communication/folder-channel.mjs", "./communication/folder-readiness.mjs", "./desktop.js?v=64", "./home-dashboard.mjs?v=2", "./camera-workspace.mjs?v=3", "./core/camera-catalog.mjs?v=2", "./core/camera-sources.mjs?v=2", "./mobile.js?v=52", "./mobile-map.mjs?v=8", "./location-history.mjs?v=1", "./mobile-camera-frame.mjs?v=1", "./mobile-camera-status.mjs?v=1", "./picture-in-picture.mjs?v=1", "./core/store.mjs", "./core/router.mjs", "./core/peer-diagnostics.mjs", "./communication/commands.mjs", "./auth-experience.mjs?v=3", "./manifest.webmanifest?v=4", "./icons/kamera-192.svg", "./icons/apple-touch-icon.png", "./icons/kamera-512.svg", "./vendor/supabase.js?v=2.117.2"];

SHELL.push("./dokumenty.html", "./instrukcja.html", "./zasady-korzystania.html", "./polityka-prywatnosci.html", "./rodo.html", "./regulamin.html", "./legal-premium.css?v=7", "./recording-storage.mjs?v=1", "./recstore.js?v=78", "./camera-fit.mjs?v=1", "./recording-init.mjs?v=1", "./ui-icons.mjs?v=1", "./assets/ds-shield.svg", "./gallery-viewer.mjs?v=1", "./gallery-catalog.mjs?v=2", "./core/view-memory.mjs?v=1", "./recording-view-state.mjs?v=1", "./recording-time.mjs?v=1", "./recording-actions.mjs?v=2", "./native-drive-ui.mjs?v=2", "./remote-unlock-crypto.mjs?v=1", "./remote-unlock-protocol.mjs?v=2", "./remote-unlock-device-store.mjs?v=1", "./remote-unlock-host.mjs?v=2", "./remote-unlock-phone.mjs?v=2", "./core/client-layout.js?v=3", "./core/web-updates.mjs?v=3", "./core/update-navigation.mjs?v=1", "./communication/agent-telemetry.mjs?v=2", "./communication/native-agent-client.mjs");
// Reklamowy obraz startowy dostępny także w zainstalowanej PWA.
SHELL.push("./assets/hs-logo.webp");
// Trzy lekkie banery otwarcia mobilnego oraz ich kod: dostepne rowniez w PWA.
// Publiczne arkusze strony startowej także są częścią pamięci offline.
SHELL.push("./marketing.css?v=20", "./marketing-motion.css?v=3", "./marketing-motion.mjs?v=3", "./marketing-navigation.css?v=5", "./marketing-navigation.mjs?v=2", "./marketing-gallery.css?v=5", "./marketing-gallery.mjs?v=2", "./marketing-start.css?v=4", "./marketing-start.mjs?v=2", "./marketing-auto-update.css?v=3", "./marketing-auto-update.mjs?v=6", "./marketing-contact.js?v=9", "./tech-theme.css?v=9");
// Wygląd i kod pobierane z sieci z pominięciem pamięci HTTP przeglądarki,
// żeby nowy service worker nie zapisał do pamięci offline starej kopii pliku.
const FRESH_ASSET = /\.(?:css|m?js|webmanifest)$/;
const NETWORK_WAIT_MS = 4000;
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL.map(path => new Request(path, {cache: "reload"})))).then(() => self.skipWaiting()));
});
// Usuwa z bieżącej pamięci arkusze i skrypty, których nie ma już na liście SHELL
// (stare wersje ?v= lub arkusze zastąpione przez panel.css). Obrazy i strony zostają.
async function pruneObsoleteAssets() {
  const cache = await caches.open(CACHE);
  const wanted = new Set(SHELL.map(path => new URL(path, self.location.href).href));
  for (const request of await cache.keys()) {
    const url = new URL(request.url);
    if (FRESH_ASSET.test(url.pathname) && !wanted.has(url.href)) await cache.delete(request);
  }
}
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("kamera-domowa-shell-") && key !== CACHE).map(key => caches.delete(key))))
    .then(() => pruneObsoleteAssets()).catch(() => {}).then(() => self.clients.claim()));
});
// CSS/JS: najpierw sieć (zapytanie warunkowe, zwykle 304); bez sieci albo przy odpowiedzi
// dłuższej niż NETWORK_WAIT_MS — kopia offline. Nowa treść pliku jest widoczna po publikacji.
async function networkFirstAsset(request) {
  const cache = await caches.open(CACHE);
  const network = fetch(request, {cache: "no-cache"}).then(response => {
    if (response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  });
  const cached = await cache.match(request);
  if (!cached) return network;
  const fallback = network.then(response => response.ok ? response : cached, () => cached);
  return Promise.race([fallback, new Promise(resolve => setTimeout(() => resolve(cached), NETWORK_WAIT_MS))]);
}
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
    // A user-requested upgrade must not reuse the browser's old HTML cache.
    // Ordinary navigation stays network-first and revalidates the browser HTTP cache.
    const upgradeNavigation = url.searchParams.has('hs_release');
    const navigationRequest = upgradeNavigation
      ? fetch(event.request, {cache: 'no-store'})
      : fetch(event.request, {cache: 'no-cache'});
    event.respondWith(navigationRequest.then(async response => {
      if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
        try { const cache = await caches.open(CACHE); await cache.put(pageKey, response.clone()); } catch { /* A full cache must not hide a working network response. */ }
      }
      return response;
    }).catch(async () => {
      // Never report a successful new release while offline or serving old HTML.
      if (upgradeNavigation) return new Response('Aktualizacja wymaga połączenia z internetem. Spróbuj ponownie.', {status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}});
      const cached = await caches.match(pageKey);
      if (cached) return cached;
      return new Response('<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Brak połączenia — HOME SECURITY</title><h1>Ta strona nie jest dostępna offline</h1><p>Połącz się z internetem i spróbuj ponownie.</p><a href="' + panelPath + '">Wróć do HOME SECURITY</a></html>', {status:503,headers:{"Content-Type":"text/html; charset=utf-8"}});
    }));
    return;
  }
  if (url.pathname.includes("/kamera/") && FRESH_ASSET.test(url.pathname)) {
    event.respondWith(networkFirstAsset(event.request));
    return;
  }
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => { if (response.ok && url.pathname.includes("/kamera/")) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); } return response; })));
});

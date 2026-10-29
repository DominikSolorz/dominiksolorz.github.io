// The current public homepage stays on GitHub Pages, where the release is verified.
// Private account, PIN and camera routes retain the existing same-origin panel.
// No tracking, authentication or camera commands are issued here.
(() => {
  const params = new URLSearchParams(location.search);
  const fragment = new URLSearchParams(location.hash.replace(/^#/, ''));
  const privateLink = params.get('section') === 'recordings' || params.get('wroc') === 'nagrania' || params.has('auth') || params.has('code') || params.get('panel') === 'owner' ||
    params.get('app') === 'android' || /^cam-[a-f0-9]{32}$/.test(params.get('odbiorca') || '') ||
    location.hash === '#nadaj' || fragment.has('access_token') || fragment.has('error') ||
    fragment.get('type') === 'recovery';
  let pendingEntry = false;
  try { pendingEntry = !!sessionStorage.getItem('hs-device-entry-v1'); } catch { /* private mode */ }
  const native = window.__HOME_SECURITY_DESKTOP__ === true || !!window.chrome?.webview;
  const installed = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  if (!privateLink && !pendingEntry && !native && !installed) {
    const topics={"mozliwosci":"mozliwosci.html","jak-dziala":"jak-dziala.html","specyfikacja":"wymagania.html","stan-projektu":"stan-projektu.html","przygotowanie":"przygotowanie.html","zobacz-panel":"prezentacja.html","galeria":"galeria.html","faq":"pytania.html","asystent":"pytania.html","w-praktyce":"jak-dziala.html","zastosowania":"mozliwosci.html","prywatnosc":"jak-dziala.html"};
    const topic=topics[location.hash.slice(1)];
    if(topic){const destination=new URL(topic,location.href);destination.search=location.search;location.replace(destination.href);return;}
    // Full public content is already in this HTML. Never redirect to a stale mirror.
    // Local support and internal anchor links stay available.
    return;
  }
  const target = new URL('./panel.html', location.href);
  target.search = location.search;
  target.hash = location.hash;
  location.replace(target.href);
})();

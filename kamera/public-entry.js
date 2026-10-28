// Public website uses the controlled HTTP host; private entry remains on its original origin.
// Fixed same-origin destination. No network requests, analytics, authentication or device access.
(() => {
  const params = new URLSearchParams(location.search);
  const fragment = new URLSearchParams(location.hash.replace(/^#/, ''));
  const privateLink = params.has('auth') || params.has('code') || params.get('panel') === 'owner' ||
    params.get('app') === 'android' || /^cam-[a-f0-9]{32}$/.test(params.get('odbiorca') || '') ||
    location.hash === '#nadaj' || fragment.has('access_token') || fragment.has('error') ||
    fragment.get('type') === 'recovery';
  let pendingEntry = false;
  try { pendingEntry = !!sessionStorage.getItem('hs-device-entry-v1'); } catch { /* private mode */ }
  const native = window.__HOME_SECURITY_DESKTOP__ === true || !!window.chrome?.webview;
  const installed = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  if (!privateLink && !pendingEntry && !native && !installed) {
    // The support assistant keeps its existing same-origin backend and consent UI.
    if (location.hash === '#asystent') return;
    const publicTarget = new URL('https://home-security-dominik-solorz.vercel.app/kamera/');
    publicTarget.search = location.search;
    publicTarget.hash = location.hash;
    location.replace(publicTarget.href);
    return;
  }
  const target = new URL('./panel.html', location.href);
  target.search = location.search;
  target.hash = location.hash;
  location.replace(target.href);
})();

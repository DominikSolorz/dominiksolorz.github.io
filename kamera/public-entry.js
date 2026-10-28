// Always serve the up-to-date public homepage from GitHub Pages.
// Private authentication, transmitter and owner-panel entries stay on their original origin.
// No network requests, analytics, authentication or device access.
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
    // The page is already complete static marketing HTML.
    // Do not send people to a separately queued, potentially outdated Vercel release.
    // The public support assistant (#asystent) remains on this same origin.
    return;
  }
  const target = new URL('./panel.html', location.href);
  target.search = location.search;
  target.hash = location.hash;
  location.replace(target.href);
})();

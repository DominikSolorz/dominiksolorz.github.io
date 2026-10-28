// Loading policy only. Authentication, PIN and camera permissions remain in their existing modules.
export function needsPanelRuntime({ search = '', hash = '', native = false, pendingEntry = false } = {}) {
  const params = new URLSearchParams(search);
  const callback = new URLSearchParams(hash.replace(/^#/, ''));
  return native || pendingEntry || params.has('auth') || params.has('code') ||
    /^cam-[a-f0-9]{32}$/.test(params.get('odbiorca') || '') || hash === '#nadaj' ||
    callback.has('access_token') || callback.has('error') || callback.get('type') === 'recovery';
}

if (typeof document !== 'undefined') {
  let started = false;
  const showFailure = () => {
    const box = document.getElementById('bootError');
    if (!box) return;
    box.hidden = false;
    box.textContent = 'Nie udało się pobrać panelu. Sprawdź połączenie i odśwież stronę.';
  };
  const loadStyle = source => new Promise((resolve, reject) => {
    const link = source.cloneNode(true);
    link.onload = resolve;
    link.onerror = reject;
    document.head.append(link);
  });
  const loadScript = source => new Promise((resolve, reject) => {
    // Scripts cloned directly from a template are inert: create fresh script nodes.
    const script = document.createElement('script');
    for (const attribute of source.attributes) script.setAttribute(attribute.name, attribute.value);
    script.onload = resolve;
    script.onerror = reject;
    document.body.append(script);
  });
  const start = async () => {
    if (started) return;
    started = true;
    window.__panelRuntimeStarted = true;
    window.dispatchEvent(new Event('hs-panel-runtime-started'));
    try {
      const styles = document.getElementById('panelStyles');
      const runtime = document.getElementById('panelRuntime');
      await Promise.all([...styles.content.querySelectorAll('link')].map(loadStyle));
      document.documentElement.classList.remove('publicLanding');
      const scripts = [...runtime.content.querySelectorAll('script')];
      // The classic Supabase library must exist before any account module evaluates.
      for (const script of scripts.filter(script => script.type !== 'module')) await loadScript(script);
      // app.js waits at its secure entry gate. Do not await it before mounting device UI.
      for (const script of scripts.filter(script => script.type === 'module')) loadScript(script).catch(showFailure);
    } catch { showFailure(); }
  };
  window.addEventListener('hs-auth-request', () => {
    if (started) return; // Once loaded, auth.js owns this event.
    start();
    window.__authReady.then(() => window.__showAccount?.());
  });
  let pendingEntry = false;
  try { pendingEntry = !!sessionStorage.getItem('hs-device-entry-v1'); } catch { /* private mode */ }
  if (needsPanelRuntime({ search: location.search, hash: location.hash,
    native: location.pathname.endsWith("/panel.html") || window.__HOME_SECURITY_DESKTOP__ === true || !!window.chrome?.webview, pendingEntry })) start();
}

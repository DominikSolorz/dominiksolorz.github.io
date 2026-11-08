// PKCE desktop handoff. Only the authorization code crosses the native bridge.
export const DESKTOP_RETURN_KEY = 'hs-desktop-oauth-v1';
export const ACCOUNT_RETURN = 'https://dominiksolorz.github.io/kamera/';
export function validAuthorizeUrl(value) {
  try {
    const url = new URL(value);
    const allowed = new Set(['provider','redirect_to','scopes','code_challenge','code_challenge_method','skip_http_redirect','prompt']);
    const keys = [...url.searchParams.keys()];
    return url.origin === 'https://ksacbcrzuwdahnmggfxg.supabase.co' && url.pathname === '/auth/v1/authorize'
      && !url.hash && !url.username && !url.password && keys.every(key => allowed.has(key)) && new Set(keys).size === keys.length
      && url.searchParams.get('provider') === 'google' && url.searchParams.get('redirect_to') === ACCOUNT_RETURN
      && /^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get('code_challenge') || '')
      && String(url.searchParams.get('code_challenge_method')).toLowerCase() === 's256';
  } catch { return false; }
}
export function validHandoff(value) {
  return !!value && /^[A-Za-z0-9_-]{43}$/.test(value.nonce || '')
    && Number.isInteger(value.port) && value.port >= 1024 && value.port <= 65535 && validAuthorizeUrl(value.url);
}
const errors = {
  AUTH_URL_REJECTED:'Nie potwierdzono bezpiecznego adresu Google. Zaktualizuj program i spróbuj ponownie.',
  AUTH_ALREADY_RUNNING:'Logowanie Google jest już otwarte. Dokończ je w przeglądarce.',
  AUTH_CANCELLED:'Logowanie Google zostało anulowane.',
  AUTH_TIMEOUT:'Minął czas logowania Google. Kliknij ponownie i dokończ logowanie w przeglądarce.',
  AUTH_BROWSER_UNAVAILABLE:'Nie udało się otworzyć systemowej przeglądarki. Sprawdź domyślną przeglądarkę Windows.',
};
export function desktopGoogleCode(url, {signal, webview = window.chrome?.webview, supported = window.__HOME_SECURITY_ACCOUNT_OAUTH__ === true} = {}) {
  if (!supported || !webview) return Promise.reject(new Error('Zaktualizuj HOME SECURITY Desktop, aby zalogować się przez Google.'));
  if (!validAuthorizeUrl(url)) return Promise.reject(new Error(errors.AUTH_URL_REJECTED));
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    let timer;
    const clean = () => { clearTimeout(timer); webview.removeEventListener('message', receive); signal?.removeEventListener('abort', cancel); };
    const cancel = () => {
      clean();
      webview.postMessage({type:'desktop.auth.cancel',id});
      reject(new Error(errors.AUTH_CANCELLED));
    };
    const receive = event => {
      const data = event.data;
      if (data?.type !== 'desktop.auth.google.result' || data.id !== id) return;
      clean();
      if (data.error || !/^[A-Za-z0-9._~-]{8,2048}$/.test(data.code || '')) reject(new Error(errors[data.error] || errors.AUTH_URL_REJECTED));
      else resolve(data.code);
    };
    if (signal?.aborted) { reject(new Error(errors.AUTH_CANCELLED)); return; }
    webview.addEventListener('message',receive);
    signal?.addEventListener('abort',cancel,{once:true});
    timer = setTimeout(() => { clean(); reject(new Error(errors.AUTH_TIMEOUT)); },185000);
    try { webview.postMessage({type:'desktop.auth.google',id,url}); }
    catch { clean(); reject(new Error(errors.AUTH_BROWSER_UNAVAILABLE)); }
  });
}
export function beginBrowserHandoff({hash = location.hash, storage = sessionStorage, navigate = url => location.replace(url), now = Date.now()} = {}) {
  try {
    const raw = hash.replace(/^#/,'');
    if (!/^[A-Za-z0-9_-]{1,16384}$/.test(raw)) return false;
    const value = JSON.parse(atob(raw.replace(/-/g,'+').replace(/_/g,'/')));
    if (!validHandoff(value)) return false;
    storage.setItem(DESKTOP_RETURN_KEY,JSON.stringify({nonce:value.nonce,port:value.port,at:now}));
    // Nothing in this record is an account token or PKCE verifier.
    navigate(value.url);
    return true;
  } catch { return false; }
}
if (typeof document !== 'undefined' && document.getElementById('desktopAuthStatus')) {
  const status = document.getElementById('desktopAuthStatus');
  if (!beginBrowserHandoff()) status.textContent = 'Link logowania wygasł lub jest nieprawidłowy. Wróć do programu i ponownie kliknij Google.';
}

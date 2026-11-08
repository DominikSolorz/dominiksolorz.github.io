// Must run before public-entry and the account client. Never forward JWTs.
(() => {
  let record;
  try { record = JSON.parse(sessionStorage.getItem('hs-desktop-oauth-v1') || 'null'); } catch { return; }
  if (!record) return;
  const elapsed = Date.now() - Number(record.at);
  if (!/^[A-Za-z0-9_-]{43}$/.test(record.nonce || '') || !Number.isInteger(record.port)
      || record.port < 1024 || record.port > 65535 || elapsed < 0 || elapsed > 180000) {
    try { sessionStorage.removeItem('hs-desktop-oauth-v1'); } catch {}
    return;
  }
  const query = new URLSearchParams(location.search);
  const fragment = new URLSearchParams(location.hash.slice(1));
  const code = query.get('code');
  const failed = query.has('error') || fragment.has('error');
  if (!code && !failed) return;
  if (query.getAll('code').length > 1) return;
  if (code && !/^[A-Za-z0-9._~-]{8,2048}$/.test(code)) return;
  const callback = new URL(`http://127.0.0.1:${record.port}/oauth/callback`);
  callback.searchParams.set('state', record.nonce);
  if (failed) callback.searchParams.set('error','cancelled');
  else callback.searchParams.set('code',code);
  window.__hsDesktopOAuthReturning = true;
  sessionStorage.removeItem('hs-desktop-oauth-v1');
  location.replace(callback.href);
})();

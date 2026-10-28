// HOME SECURITY browser release navigation.
// The browser may hold a previous HTML document, even after a version manifest
// reports a new build. Use a distinct same-origin navigation URL instead of
// reloading the identical, potentially cached address.
export function freshUpdateURL(href, build, nonce = Date.now()) {
  const version = Number(build);
  if (!Number.isSafeInteger(version) || version <= 0) throw new TypeError('Invalid release build');
  const current = new URL(href);
  if (!/^https?:$/.test(current.protocol)) throw new TypeError('Invalid page protocol');
  current.searchParams.set('hs_release', String(version));
  current.searchParams.set('hs_refresh', String(Number.isFinite(Number(nonce)) ? Math.trunc(Number(nonce)) : Date.now()));
  return current.href;
}

export function pendingUpdateBuild(href) {
  const value = Number(new URL(href).searchParams.get('hs_release'));
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

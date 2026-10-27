// HOME SECURITY — public website update notifications (no service workers, no tracking).
// Detect published releases automatically. One click updates immediately; idle pages
// may refresh on their own. Never silently discard unsent contact-form content.
const buildMeta = document.querySelector('meta[name="home-security-build"]');
if (document.body?.classList.contains('marketingPage') && buildMeta?.content) {
  const currentBuild = Number(buildMeta.content);
  const versionURL = new URL('./version.json', import.meta.url);
  const validVersion = value => Number.isSafeInteger(value) && value > 0;
  let checking = false;
  let dirty = false;
  let newerBuild = 0;
  let pendingReload = false;
  let autoTimer = null;
  let lastAttempt = 0;

  const banner = document.createElement('aside');
  banner.className = 'mktUpdateBanner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Aktualizacja HOME SECURITY');
  banner.hidden = true;
  const copy = document.createElement('div');
  copy.className = 'mktUpdateCopy';
  const title = document.createElement('strong');
  title.textContent = 'Nowa wersja HOME SECURITY';
  const description = document.createElement('p');
  description.setAttribute('role', 'status');
  description.setAttribute('aria-live', 'polite');
  copy.append(title, description);
  const actions = document.createElement('div');
  actions.className = 'mktUpdateActions';
  const update = document.createElement('button');
  update.type = 'button';
  update.className = 'mktUpdateApply';
  update.textContent = 'Zaktualizuj';
  update.setAttribute('aria-label', 'Zaktualizuj HOME SECURITY do najnowszej wersji');
  const later = document.createElement('button');
  later.type = 'button';
  later.className = 'mktUpdateLater';
  later.textContent = 'Później';
  actions.append(update, later);
  banner.append(copy, actions);
  document.body.append(banner);

  const hasOpenDialog = () => !!document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]:not([hidden])');
  const hasActiveField = () => !!document.querySelector('input:focus, textarea:focus, select:focus, [contenteditable]:focus');
  const safeToReload = () => document.visibilityState === 'visible' && !dirty && !hasOpenDialog() && !hasActiveField();
  const marker = 'hs-marketing-reload-' + currentBuild;

  function showOffer() {
    if (!validVersion(newerBuild) || newerBuild <= currentBuild) return;
    banner.hidden = false;
    title.textContent = 'Nowa wersja HOME SECURITY ' + newerBuild;
    description.textContent = dirty
      ? 'Masz niezapisane dane formularza. Aktualizację możesz uruchomić ręcznie po ich zapisaniu.'
      : 'Nowa wersja jest gotowa. Kliknij „Zaktualizuj” lub pozostaw tę stronę bez zmian — odświeży się automatycznie, gdy będzie bezpiecznie.';
  }
  function alreadyReloaded() {
    try { return Date.now() - Number(sessionStorage.getItem(marker) || 0) < 90000; }
    catch { return Date.now() - lastAttempt < 90000; }
  }
  function reloadLatest() {
    if (pendingReload || !validVersion(newerBuild) || newerBuild <= currentBuild || alreadyReloaded()) return;
    pendingReload = true;
    lastAttempt = Date.now();
    try { sessionStorage.setItem(marker, String(lastAttempt)); } catch {}
    description.textContent = 'Wczytuję najnowszą wersję…';
    window.location.reload();
  }
  function queueAutomaticReload() {
    if (autoTimer !== null || !newerBuild || !safeToReload() || alreadyReloaded()) return;
    autoTimer = window.setTimeout(() => {
      autoTimer = null;
      if (safeToReload()) reloadLatest();
    }, 12000);
  }
  function cancelAutomaticReload() {
    if (autoTimer === null) return;
    window.clearTimeout(autoTimer);
    autoTimer = null;
  }

  update.addEventListener('click', () => {
    if (!newerBuild || pendingReload || hasOpenDialog()) return;
    if (dirty && !window.confirm('Masz niezapisane zmiany w formularzu. Czy na pewno chcesz odświeżyć stronę i je utracić?')) return;
    reloadLatest();
  });
  later.addEventListener('click', () => { cancelAutomaticReload(); banner.hidden = true; });
  document.addEventListener('input', event => {
    if (event.target?.matches?.('input,textarea,select,[contenteditable]')) {
      dirty = true;
      cancelAutomaticReload();
      showOffer();
    }
  }, { capture: true });
  document.addEventListener('change', event => {
    if (event.target?.matches?.('input,textarea,select,[contenteditable]')) {
      dirty = true;
      cancelAutomaticReload();
      showOffer();
    }
  }, { capture: true });
  const check = async () => {
    if (checking || !validVersion(currentBuild)) return;
    checking = true;
    try {
      const response = await fetch(versionURL, { cache: 'no-store' });
      if (!response.ok) return;
      const latest = Number((await response.json()).version);
      if (!validVersion(latest) || latest <= currentBuild) return;
      newerBuild = latest;
      showOffer();
      queueAutomaticReload();
    } catch { /* Offline: remain usable and check again. */ }
    finally { checking = false; }
  };
  if (document.readyState === 'complete') void check();
  else window.addEventListener('load', () => void check(), { once: true });
  window.addEventListener('focus', () => { if (newerBuild) showOffer(); void check(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { void check(); queueAutomaticReload(); }
    else cancelAutomaticReload();
  });
  document.addEventListener('focusout', () => { if (newerBuild) queueAutomaticReload(); });
  const interval = window.setInterval(() => {
    if (document.visibilityState === 'visible') { void check(); queueAutomaticReload(); }
  }, 2 * 60000);
  window.addEventListener('pagehide', event => {
    if (!event.persisted) { window.clearInterval(interval); cancelAutomaticReload(); }
  });
}

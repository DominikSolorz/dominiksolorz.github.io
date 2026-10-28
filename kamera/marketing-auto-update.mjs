// HOME SECURITY: public-page update notice, without tracking or camera access.
// Keep manifest-based Windows installer links working on every marketing page.
import './marketing-downloads.mjs?v=2';

const buildMeta = document.querySelector('meta[name="home-security-build"]');
if (document.body?.classList.contains('marketingPage') && buildMeta?.content) {
  const currentBuild = Number(buildMeta.content);
  const validVersion = value => Number.isSafeInteger(value) && value > 0;
  const versionURL = new URL('./version.json', import.meta.url);
  let checking = false;
  let backgroundReady = false;
  let initialCheckTimer = null;
  let dirty = false;
  let newest = 0;
  let pendingReload = false;
  let autoTimer = null;
  let lastAttempt = 0;
  let snoozedUntil = 0;

  const banner = document.createElement('aside');
  banner.className = 'mktUpdateBanner';
  banner.hidden = true;
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Dostępna aktualizacja HOME SECURITY');
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
  update.setAttribute('aria-label', 'Wczytaj najnowszą wersję strony HOME SECURITY');
  const later = document.createElement('button');
  later.type = 'button';
  later.className = 'mktUpdateLater';
  later.textContent = 'Później';
  actions.append(update, later);
  banner.append(copy, actions);
  document.body.append(banner);

  const hasDialog = () => !!document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]:not([hidden])');
  const hasActiveField = () => !!document.querySelector('input:focus,textarea:focus,select:focus,[contenteditable]:focus');
  const safeToRefresh = () => document.visibilityState === 'visible' && !dirty && !hasDialog() && !hasActiveField();
  const stampKey = 'hs-marketing-refresh-' + currentBuild;

  const alreadyReloaded = () => {
    try { return Date.now() - Number(sessionStorage.getItem(stampKey) || 0) < 90000; }
    catch { return Date.now() - lastAttempt < 90000; }
  };
  const cancelAuto = () => {
    if (autoTimer !== null) window.clearTimeout(autoTimer);
    autoTimer = null;
  };
  const showOffer = () => {
    if (!validVersion(newest) || newest <= currentBuild || Date.now() < snoozedUntil || pendingReload) return;
    banner.hidden = false;
    title.textContent = 'Dostępna wersja HOME SECURITY ' + newest;
    description.textContent = dirty
      ? 'Masz niezapisane dane. Aktualizacja nie przerwie pracy automatycznie.'
      : 'Kliknij „Zaktualizuj” lub pozostaw stronę bezczynnie. Odświeżymy ją, gdy będzie bezpiecznie.';
  };
  const reloadLatest = () => {
    if (pendingReload || !validVersion(newest) || newest <= currentBuild || alreadyReloaded()) return;
    pendingReload = true;
    lastAttempt = Date.now();
    try { sessionStorage.setItem(stampKey, String(lastAttempt)); } catch {}
    description.textContent = 'Wczytuję najnowszą wersję…';
    window.location.reload();
  };
  const queueAuto = () => {
    if (autoTimer !== null || !validVersion(newest) || Date.now() < snoozedUntil || alreadyReloaded() || !safeToRefresh()) return;
    autoTimer = window.setTimeout(() => {
      autoTimer = null;
      if (safeToRefresh()) reloadLatest();
    }, 12000);
  };

  update.addEventListener('click', () => {
    if (pendingReload || hasDialog()) return;
    if (dirty && !window.confirm('Masz niezapisane zmiany. Czy na pewno chcesz je utracić i wczytać nową wersję strony?')) return;
    reloadLatest();
  });
  later.addEventListener('click', () => {
    snoozedUntil = Date.now() + 60 * 60000;
    banner.hidden = true;
    cancelAuto();
  });

  const markDirty = event => {
    if (!event.target?.matches?.('input,textarea,select,[contenteditable]')) return;
    dirty = true;
    cancelAuto();
    showOffer();
  };
  document.addEventListener('input', markDirty, {capture: true});
  document.addEventListener('change', markDirty, {capture: true});

  const check = async () => {
    if (!backgroundReady || checking || !validVersion(currentBuild)) return;
    checking = true;
    try {
      const response = await fetch(versionURL, {cache: 'no-store'});
      if (!response.ok) return;
      const version = Number((await response.json()).version);
      if (!validVersion(version) || version <= currentBuild) return;
      newest = version;
      showOffer();
      queueAuto();
    } catch { /* Keep the existing page usable offline. */ }
    finally { checking = false; }
  };
  // Release checks are maintenance, not a dependency of the first public view.
  const startBackgroundChecks = () => {
    initialCheckTimer = window.setTimeout(() => {
      initialCheckTimer = null;
      backgroundReady = true;
      if (document.visibilityState === 'visible') void check();
    }, 30000);
  };
  if (document.readyState === 'complete') startBackgroundChecks();
  else window.addEventListener('load', startBackgroundChecks, {once: true});
  window.addEventListener('focus', () => { showOffer(); void check(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { void check(); queueAuto(); }
    else cancelAuto();
  });
  document.addEventListener('focusout', queueAuto);
  const interval = window.setInterval(() => {
    if (document.visibilityState === 'visible') { void check(); queueAuto(); }
  }, 2 * 60000);
  window.addEventListener('pagehide', event => {
    if (!event.persisted) { window.clearInterval(interval); window.clearTimeout(initialCheckTimer); cancelAuto(); }
  });
}

// HOME SECURITY public navigation only. Native <details> remains usable without JS.
// This module does not read account state, camera state or private user data.
const marketingMenus = [...document.querySelectorAll('.mktHeader .mktMobileMenu')];
for (const menu of marketingMenus) {
  const trigger = menu.querySelector(':scope > summary');
  const navigation = menu.querySelector(':scope > nav');
  if (!trigger || !navigation) continue;

  const sync = () => {
    const isOpen = menu.open;
    trigger.setAttribute('aria-expanded', String(isOpen));
    trigger.setAttribute('aria-label', isOpen ? 'Zamknij menu nawigacji' : 'Otwórz menu nawigacji');
    trigger.title = isOpen ? 'Zamknij menu' : 'Otwórz menu';
  };
  const close = (returnFocus = false) => {
    if (!menu.open) return;
    menu.open = false;
    sync();
    if (returnFocus && trigger.isConnected) trigger.focus({ preventScroll: true });
  };

  menu.addEventListener('toggle', sync);
  // Native <summary> toggles the menu on both the first and second click,
  // including keyboard Enter/Space; no custom click handler is needed.
  navigation.addEventListener('click', event => {
    if (event.target.closest('a[href]')) close();
  });
  document.addEventListener('pointerdown', event => {
    if (menu.open && !menu.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) {
      event.preventDefault();
      close(true);
    }
  });
  window.addEventListener('resize', () => {
    if (window.matchMedia('(min-width: 1180px)').matches) close();
  }, { passive: true });
  sync();
}

// Real page facts in the footer and the "Szybkie uruchamianie" card: measured
// load time of this page and the browser's network state. Nothing is estimated.
const canShowFacts = typeof document.querySelector === 'function' && typeof navigator !== 'undefined' && typeof performance !== 'undefined';
const showPageFacts = () => {
  const [entry] = performance.getEntriesByType?.('navigation') || [];
  const ms = entry && entry.loadEventEnd > 0 ? entry.loadEventEnd : performance.now();
  const seconds = (ms / 1000).toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' s';
  for (const node of document.querySelectorAll('[data-hs-load-time]')) node.textContent = seconds;
  // Full arc at 0.5 s or faster, empty at 5 s or slower.
  const share = Math.max(0, Math.min(1, (5000 - ms) / 4500));
  for (const arc of document.querySelectorAll('[data-hs-load-arc]')) arc.style.strokeDashoffset = String(158 * (1 - share));
};
const showOnline = () => {
  for (const node of document.querySelectorAll('[data-hs-online]')) {
    node.textContent = navigator.onLine ? 'online' : 'offline';
    node.dataset.hsOnline = navigator.onLine ? 'online' : 'offline';
  }
};
if (!canShowFacts) { /* page facts need a full browser */ }
else if (document.readyState === 'complete') setTimeout(showPageFacts, 0);
else window.addEventListener('load', () => setTimeout(showPageFacts, 0), { once: true });
const release = canShowFacts && document.querySelector('meta[name="home-security-desktop"]')?.content;
if (release) for (const node of document.querySelectorAll('[data-hs-version]')) node.textContent = 'v' + release;
if (canShowFacts) {
  showOnline();
  window.addEventListener('online', showOnline);
  window.addEventListener('offline', showOnline);
}

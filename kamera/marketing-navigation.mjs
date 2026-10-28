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
    if (window.matchMedia('(min-width: 761px)').matches) close();
  }, { passive: true });
  sync();
}

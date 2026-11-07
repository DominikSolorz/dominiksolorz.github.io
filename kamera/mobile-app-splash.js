// Reklama startowa tylko dla strony głównej otwartej w Chrome/Safari na telefonie.
// 3 plansze po 10 sekund = 30 sekund przy każdym odświeżeniu.
// Logowanie, PIN, nagrywanie, uprawnienia kamery i wersja desktop nie są zmieniane.
(() => {
  const root = document.documentElement;
  if (!root.classList.contains('hsMobileLaunch')) return;
  const splash = document.getElementById('hsMobileSplash');
  if (!splash) { root.classList.remove('hsMobileLaunch'); return; }
  const slides = [...splash.querySelectorAll('.hsMobileSplashImage[data-src]')];
  const started = Number(window.__hsMobileSplashStarted) || performance.now();
  const timers = [];
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    for (const timer of timers) clearTimeout(timer);
    root.classList.remove('hsMobileLaunch');
    splash.hidden = true;
  };
  splash.querySelector('button')?.addEventListener('click', finish);
  // Małe pliki WebP pobierają się równolegle, bez blokowania zawartości WWW.
  for (const slide of slides) {
    slide.decoding = 'async';
    slide.src = slide.dataset.src;
  }
  const activate = index => {
    if (finished) return;
    slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
    });
  };
  activate(0);
  // Odmierzamy od uruchomienia w nagłówku strony, aby nie dokładać czekania
  // podczas wolnego pobierania HTML/JS. Trzy plansze: 0–10, 10–20, 20–30 s.
  const after = (ms, fn) => timers.push(setTimeout(fn, Math.max(0, ms - (performance.now() - started))));
  after(10000, () => activate(1));
  after(20000, () => activate(2));
  after(30000, finish);
  window.addEventListener('pagehide', finish, {once:true});
})();

// Promocyjny ekran startowy tylko dla wejscia z ikony PWA.
// Nie zmienia logowania, PIN-u, tras prywatnego panelu ani uprawnien kamer.
(() => {
  const root = document.documentElement;
  if (!root.classList.contains('hsMobileLaunch')) return;
  const splash = document.getElementById('hsMobileSplash');
  if (!splash) { root.classList.remove('hsMobileLaunch'); return; }
  const preview = splash.querySelector("img[data-src]");
  if (preview) preview.src = preview.dataset.src;
  const started = Number(window.__hsMobileSplashStarted) || performance.now();
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    root.classList.remove('hsMobileLaunch');
    splash.setAttribute('hidden','');
  };
  splash.querySelector('button')?.addEventListener('click',finish);
  // Strona laduje sie normalnie pod spodem. Znikamy od razu po krotkiej
  // prezentacji albo najpozniej po 8 s, rowniez przy zablokowanym zasobie.
  const onReady = () => {
    const elapsed = performance.now() - started;
    window.setTimeout(finish, Math.max(0,900-elapsed));
  };
  if (document.readyState === 'complete') onReady();
  else window.addEventListener('load',onReady,{once:true});
  window.setTimeout(finish,Math.max(0,8000-(performance.now()-started)));
})();

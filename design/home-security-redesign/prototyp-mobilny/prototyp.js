// Browser-only walkthrough. No production account, PIN or camera is accessed.
(function () {
  'use strict';
  const screens = [...document.querySelectorAll('.screen')];
  const tabs = document.getElementById('tabs');
  const switcher = document.querySelector('.demo-switch');
  const inspectMode = new URLSearchParams(location.search).get('demo') === '1';
  const dialog = document.getElementById('previewDialog');
  const login = document.getElementById('previewLogin');
  const pinStatus = document.getElementById('pinStatus');
  const pinDots = [...document.querySelectorAll('.pin-dots i')];
  const adImages = [...document.querySelectorAll('#ad > img')];
  const adDots = [...document.querySelectorAll('#adDots i')];
  const protectedScreens = new Set(['dash', 'cams', 'recs', 'settings']);
  const captions = ['Inteligentna ochrona domu', 'Twój dom. Twoje bezpieczeństwo.', 'HOME SECURITY zawsze pod ręką'];
  const AD_SECONDS = 30;
  let current = '', loginPassed = false, pinPassed = false, pin = '';
  let adTimer = null, splashTimer = null, pinTimer = null;
  switcher.hidden = !inspectMode;

  function stopTimers() {
    clearInterval(adTimer);
    clearInterval(splashTimer);
    clearTimeout(pinTimer);
    adTimer = splashTimer = pinTimer = null;
  }
  function renderPin() {
    pinDots.forEach((dot, index) => dot.classList.toggle('on', index < pin.length));
  }
  function show(id, { replace = false, fromHistory = false } = {}) {
    let target = screens.find(screen => screen.id === id);
    if (!target) return false;
    if (!inspectMode && protectedScreens.has(id) && !pinPassed) id = loginPassed ? 'pin' : 'login';
    if (!inspectMode && id === 'pin' && !loginPassed) id = 'login';
    target = screens.find(screen => screen.id === id);
    stopTimers();
    current = id;
    screens.forEach(screen => { screen.hidden = screen !== target; });
    tabs.hidden = !target.classList.contains('has-nav');
    document.querySelectorAll('[data-go]').forEach(button => {
      const active = button.dataset.go === id;
      button.classList.toggle('on', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    const scroller = target.querySelector('.scroll');
    if (scroller) scroller.scrollTop = 0;
    if (id === 'pin') {
      pin = '';
      renderPin();
      pinStatus.textContent = 'PIN pokazowy: 1234';
      pinStatus.classList.remove('error');
    }
    if (!fromHistory || location.hash !== '#' + id) {
      const url = new URL(location.href);
      url.hash = id;
      history[replace || fromHistory ? 'replaceState' : 'pushState'](null, '', url);
    }
    if (id === 'reklama') startAds();
    if (id === 'start') startSplash();
    return true;
  }
  function startAds() {
    const began = performance.now();
    const progress = document.getElementById('adProgress');
    function paint() {
      const elapsed = Math.min(AD_SECONDS, (performance.now() - began) / 1000);
      const index = Math.min(adImages.length - 1, Math.floor(elapsed / 10));
      adImages.forEach((image, i) => image.classList.toggle('on', i === index));
      adDots.forEach((dot, i) => dot.classList.toggle('on', i === index));
      document.getElementById('adBar').style.width = (elapsed / AD_SECONDS * 100) + '%';
      progress.setAttribute('aria-valuenow', String(Math.floor(elapsed)));
      document.getElementById('adCountdown').textContent = Math.ceil(AD_SECONDS - elapsed) + ' s';
      document.getElementById('adCaption').textContent = captions[index] + ' · ' + (index + 1) + ' z 3';
      if (elapsed >= AD_SECONDS) show('start', { replace: true });
    }
    paint();
    adTimer = setInterval(paint, 100);
  }
  function startSplash() {
    const began = performance.now();
    const bar = document.getElementById('splashBar');
    bar.style.width = '0%';
    splashTimer = setInterval(() => {
      const percent = Math.min(100, (performance.now() - began) / 1200 * 100);
      bar.style.width = percent + '%';
      if (percent === 100) show('intro', { replace: true });
    }, 50);
  }
  function reset() {
    loginPassed = pinPassed = false;
    pin = '';
    login.reset();
    document.getElementById('previewPassword').type = 'password';
    const toggle = document.getElementById('togglePassword');
    toggle.setAttribute('aria-pressed', 'false');
    toggle.setAttribute('aria-label', 'Pokaż hasło');
    if (dialog.open) dialog.close();
    show('reklama', { replace: true });
  }
  function information(title, text, image) {
    document.getElementById('previewDialogTitle').textContent = title;
    const body = document.getElementById('previewDialogBody');
    body.replaceChildren();
    if (image) {
      const preview = document.createElement('img');
      preview.src = image.src;
      preview.alt = image.alt || 'Kadr przykładowy';
      body.append(preview);
    }
    const description = document.createElement('p');
    description.textContent = text;
    body.append(description);
    dialog.showModal();
  }
  function pressPin(value) {
    if (current !== 'pin' || pinTimer) return;
    pin = value === 'delete' ? pin.slice(0, -1) : (pin + value).slice(0, 4);
    pinStatus.classList.remove('error');
    pinStatus.textContent = 'PIN pokazowy: 1234';
    renderPin();
    if (pin.length !== 4) return;
    if (pin !== '1234') {
      pin = '';
      renderPin();
      pinStatus.textContent = 'Spróbuj ponownie. PIN pokazowy to 1234.';
      pinStatus.classList.add('error');
      return;
    }
    pinStatus.textContent = 'Gotowe. Otwieramy pulpit…';
    pinTimer = setTimeout(() => {
      pinTimer = null;
      pinPassed = true;
      show('dash');
    }, 220);
  }
  login.addEventListener('submit', event => {
    event.preventDefault();
    if (!login.reportValidity()) return;
    loginPassed = true;
    pinPassed = false;
    show('pin');
  });
  document.getElementById('togglePassword').addEventListener('click', event => {
    const field = document.getElementById('previewPassword');
    const visible = field.type === 'password';
    field.type = visible ? 'text' : 'password';
    event.currentTarget.setAttribute('aria-pressed', String(visible));
    event.currentTarget.setAttribute('aria-label', visible ? 'Ukryj hasło' : 'Pokaż hasło');
  });
  document.getElementById('restartPreview').addEventListener('click', reset);
  document.getElementById('previewLogout').addEventListener('click', () => {
    loginPassed = pinPassed = false;
    show('login');
  });
  document.getElementById('biometricPreview').addEventListener('click', () => {
    information('Dostęp PIN', 'W tym podglądzie wpisz PIN 1234. Odcisk palca jest tylko elementem projektu.');
  });
  document.addEventListener('click', event => {
    const destination = event.target.closest('[data-go]');
    if (destination) { event.preventDefault(); show(destination.dataset.go); return; }
    const key = event.target.closest('[data-pin]');
    if (key) { pressPin(key.dataset.pin); return; }
    const tile = event.target.closest('[data-info]');
    if (tile) information(tile.dataset.info, 'Ten ekran nie należy do ośmiu makiet. Tutaj możesz ocenić wygląd przycisku; funkcja nie jest połączona z kontem.');
    const camera = event.target.closest('.cam');
    if (camera) information(camera.querySelector('strong').textContent, 'Zdjęcie przykładowe — podgląd układu kamery.', camera.querySelector('img'));
    const recording = event.target.closest('.rec');
    if (recording) information('Przykładowe nagranie', 'To przykładowa miniatura, bez odtwarzania prawdziwego nagrania.', recording.querySelector('img'));
  });
  document.addEventListener('keydown', event => {
    if (current !== 'pin' || dialog.open) return;
    if (/^\d$/.test(event.key)) { event.preventDefault(); pressPin(event.key); }
    if (event.key === 'Backspace') { event.preventDefault(); pressPin('delete'); }
  });
  document.querySelectorAll('.seg button').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.seg button').forEach(item => {
      item.classList.toggle('on', item === button);
      item.setAttribute('aria-selected', String(item === button));
    });
  }));
  window.addEventListener('popstate', () => {
    if (dialog.open) dialog.close();
    if (!show(location.hash.slice(1), { fromHistory: true })) show('intro', { replace: true });
  });
  window.addEventListener('pagehide', stopTimers);
  window.addEventListener('pageshow', event => { if (event.persisted && ['reklama', 'start'].includes(current)) show(current, { replace: true }); });
  const initial = location.hash.slice(1);
  if (!show(initial, { replace: true })) show('reklama', { replace: true });
})();

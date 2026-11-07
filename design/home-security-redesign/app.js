/*
 * HOME SECURITY — projekt graficzny (wersja demonstracyjna), interakcje.
 * Bez żądań sieciowych, bez logowania, bez PIN-u i bez nagrań. Dane z DEMO
 * są przykładowe i każdy widoczny wpis jest oznaczony jako DEMO.
 */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k, f) { try { const v = localStorage.getItem('hs-redesign-' + k); return v === null ? f : JSON.parse(v); } catch { return f; } },
    set(k, v) { try { localStorage.setItem('hs-redesign-' + k, JSON.stringify(v)); } catch { /* prywatny tryb */ } }
  };

  /* ---------- Ekrany ---------- */
  const SCREENS = {
    start: ['www', 'Strona główna'], 'jak-dziala': ['www', 'Jak działa'], mozliwosci: ['www', 'Możliwości'],
    'pierwsze-uruchomienie': ['www', 'Pierwsze uruchomienie'], wymagania: ['www', 'Wymagania'], pobierz: ['www', 'Pobierz'],
    kontakt: ['www', 'Kontakt i pomoc'], faq: ['www', 'FAQ'], dokumenty: ['www', 'Dokumenty'], 'stan-projektu': ['www', 'Stan projektu'],
    'polityka-prywatnosci': ['www', 'Polityka prywatności'], rodo: ['www', 'RODO'], regulamin: ['www', 'Regulamin'],
    logowanie: ['auth', 'Logowanie'], rejestracja: ['auth', 'Rejestracja'], pin: ['auth', 'PIN'],
    pulpit: ['app', 'Pulpit główny', 'Pełna kontrola i podgląd Twojego domu'],
    kamery: ['app', 'Kamery', 'Podgląd w czasie rzeczywistym ze wszystkich kamer'],
    archiwum: ['app', 'Archiwum nagrań', 'Przeglądaj i odtwarzaj zapisane nagrania'],
    zdarzenia: ['app', 'Zdarzenia i alerty', 'Wykrycia i komunikaty systemu'],
    ustawienia: ['app', 'Ustawienia', 'Konfiguracja systemu, urządzeń i konta']
  };

  /* ---------- Dane DEMO ---------- */
  const CAMS = [
    ['KAM 01 – Wejście główne', 'demo-kam01.webp'], ['KAM 02 – Podjazd / Garaż', 'demo-kam02.webp'], ['KAM 03 – Salon / Taras', 'demo-kam03.webp'],
    ['KAM 04 – Ogród', 'demo-kam04.webp'], ['KAM 05 – Boczna furtka', 'demo-kam05.webp'], ['KAM 06 – Brama wjazdowa', 'demo-kam06.webp']
  ];
  const ALERTS = [
    { ico: 'walk', tone: 'red', title: 'Wykryto ruch', sub: 'Strefa: Wejście główne', ago: 1, lvl: 'high', lbl: 'Wysoki', hot: true },
    { ico: 'car', tone: 'amber', title: 'Wykryto pojazd', sub: 'Strefa: Podjazd / Garaż', ago: 3, lvl: 'mid', lbl: 'Średni' },
    { ico: 'box', tone: '', title: 'Pozostawiony obiekt', sub: 'Strefa: Taras', ago: 6, lvl: 'low', lbl: 'Niski' }
  ];
  const EVENTS = [
    { kind: 'person', ico: 'user', tone: 'red', title: 'Wykryto osobę', sub: 'Wejście główne (KAM 01)', cam: 0, ago: 2, lvl: 'high', lbl: 'Wysoki', hot: true },
    { kind: 'vehicle', ico: 'car', tone: 'amber', title: 'Wykryto pojazd', sub: 'Podjazd (KAM 02)', cam: 1, ago: 7, lvl: 'mid', lbl: 'Średni' },
    { kind: 'motion', ico: 'walk', tone: '', title: 'Wykryto ruch', sub: 'Ogród (KAM 04)', cam: 3, ago: 33, lvl: 'low', lbl: 'Niski' },
    { kind: 'motion', ico: 'walk', tone: '', title: 'Wykryto ruch', sub: 'Taras (KAM 03)', cam: 2, ago: 48, lvl: 'low', lbl: 'Niski' },
    { kind: 'system', ico: 'shield', tone: 'green', title: 'System uzbrojony', sub: 'Tryb przykładowy', cam: 5, ago: 75 },
    { kind: 'system', ico: 'info', tone: '', title: 'Kamera online', sub: 'Boczna furtka (KAM 05)', cam: 4, ago: 160 }
  ];
  const timeFmt = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const shortFmt = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });
  const dateFmt = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
  const ago = m => new Date(Date.now() - m * 60000);
  const svg = id => `<svg class="i"><use href="#${id}"/></svg>`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function camTile([name, img], i) {
    return `<article class="cam" data-cam="${i}"><header><span class="sdot"></span><span class="name">${esc(name)}</span><span class="demo">DEMO</span><time class="tick">--:--:--</time></header>
      <div class="ph" style="background-image:url(assets/${img})" role="img" aria-label="Ilustracja z projektu: ${esc(name)} (DEMO, nie obraz na żywo)">
      <div class="ov"><span class="live">NA ŻYWO</span><span class="demo">DEMO</span><span class="tools"><button type="button" data-full aria-label="Pełny ekran">${svg('expand')}</button><button type="button" data-demo-msg="Zrzut ekranu działa tylko w prawdziwym panelu." aria-label="Zrzut">${svg('snap')}</button></span></div></div></article>`;
  }
  function alertItem(a) {
    return `<li class="alertItem${a.hot ? ' hot' : ''}"><span class="icoBox ${a.tone}">${svg(a.ico)}</span><div><b>${esc(a.title)} <span class="demo">DEMO</span></b><small>${esc(a.sub)}</small></div>
      <div class="meta"><time>${timeFmt.format(ago(a.ago))}</time>${a.lvl ? `<span class="badge ${a.lvl}">${a.lbl}</span>` : ''}</div></li>`;
  }
  function eventItem(e) {
    return `<li class="eventItem" data-kind="${e.kind}"><span class="th" style="background-image:url(assets/${CAMS[e.cam][1]})" role="img" aria-label="Miniatura z projektu (DEMO)"></span>
      <div><b>${esc(e.title)} <span class="demo">DEMO</span>${e.lvl ? ` <span class="badge ${e.lvl}">${e.lbl}</span>` : ''}</b><small>${esc(e.sub)}</small></div><time>Dziś, ${shortFmt.format(ago(e.ago))}</time></li>`;
  }

  function render() {
    $('#dashCams').innerHTML = CAMS.map(camTile).join('');
    $('#allCams').innerHTML = CAMS.map(camTile).join('');
    $('#dashAlerts').innerHTML = ALERTS.map(alertItem).join('');
    $('#thumbs').innerHTML = CAMS.slice(0, 4).map(([n, img], i) => `<button type="button" style="background-image:url(assets/${img})" aria-pressed="${i === 0}" aria-label="Miniatura ${esc(n)} (DEMO)" data-thumb="${i}"><span>${shortFmt.format(ago(4 + i * 6))}</span></button>`).join('');
    renderEvents('all');
    tick();
  }
  function renderEvents(kind) {
    const list = EVENTS.filter(e => kind === 'all' || e.kind === kind);
    $('#evList').innerHTML = list.length ? list.map(eventItem).join('') : '<li class="muted">Brak zdarzeń tego typu (DEMO).</li>';
  }

  /* ---------- Zegar: czas tego urządzenia ---------- */
  function tick() {
    const now = new Date();
    $('#clockT').textContent = timeFmt.format(now);
    $('#clockD').textContent = dateFmt.format(now);
    $$('.tick').forEach(t => { t.textContent = timeFmt.format(now); });
  }

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200); }

  /* ---------- Nawigacja ---------- */
  function show(name) {
    if (!SCREENS[name]) name = 'start';
    const [shell, title, sub] = SCREENS[name];
    $$('[data-shell]').forEach(s => { s.hidden = s.dataset.shell !== shell; });
    $$('[data-screen]').forEach(s => { s.hidden = s.dataset.screen !== name; });
    $$('.webNav a, .sideNav a, .screensPanel a').forEach(a => {
      if (a.getAttribute('href') === '#' + name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (shell === 'app') { $('#appTitle').textContent = title; $('#appSub').textContent = sub; }
    document.title = `${title} — HOME SECURITY (projekt, wersja demo)`;
    closeAll();
    window.scrollTo(0, 0);
    if (name === 'pin') resetPin();
  }
  function closeAll() {
    $('.site').classList.remove('navOpen'); $('.app').classList.remove('navOpen');
    $('#appScrim').hidden = true; $('#screensPanel').hidden = true; $('#screensBtn').setAttribute('aria-expanded', 'false');
    $$('[data-toggle-nav],[data-toggle-side]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    $('.cam.full')?.classList.remove('full');
  }
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));

  /* ---------- PIN (bez sprawdzania) ---------- */
  let pin = '';
  function drawPin() { $$('#pinBoxes span').forEach((s, i) => s.classList.toggle('on', i < pin.length)); }
  function resetPin() { pin = ''; drawPin(); $('#pinMsg').textContent = ''; }
  $('#keypad').addEventListener('click', e => {
    const k = e.target.closest('button')?.dataset.k; if (!k) return;
    if (k === 'del') pin = pin.slice(0, -1);
    else if (k === 'ok') {
      if (pin.length !== 4 && pin.length !== 6) { $('#pinMsg').textContent = 'PIN ma 4 lub 6 cyfr.'; return; }
      $('#pinMsg').textContent = 'Wersja demo: PIN nie jest sprawdzany. Przechodzę do pulpitu.';
      setTimeout(() => { location.hash = 'pulpit'; }, 700); return;
    } else if (pin.length < 6) pin += k;
    $('#pinMsg').textContent = '';
    drawPin();
  });
  document.addEventListener('keydown', e => {
    if (location.hash !== '#pin') return;
    if (/^\d$/.test(e.key) && pin.length < 6) { pin += e.key; drawPin(); }
    if (e.key === 'Backspace') { pin = pin.slice(0, -1); drawPin(); }
    if (e.key === 'Enter') $('#keypad [data-k="ok"]').click();
  });

  /* ---------- Formularze demo ---------- */
  $('#loginForm').addEventListener('submit', e => { e.preventDefault(); toast('Wersja demo: logowanie nie jest wykonywane. Następny krok to PIN.'); location.hash = 'pin'; });
  $('#registerForm').addEventListener('submit', e => {
    e.preventDefault();
    if ($('#regPass').value !== $('#regPass2').value) { toast('Hasła nie są takie same.'); return; }
    toast('Wersja demo: konto nie zostało utworzone.'); location.hash = 'logowanie';
  });
  const pwCheck = () => {
    const a = $('#regPass').value, b = $('#regPass2').value;
    $('#pwRules [data-rule="len"]').classList.toggle('ok', a.length >= 10);
    $('#pwRules [data-rule="same"]').classList.toggle('ok', !!a && a === b);
  };
  $('#regPass').addEventListener('input', pwCheck); $('#regPass2').addEventListener('input', pwCheck);
  $('#contactForm').addEventListener('submit', e => { e.preventDefault(); toast('Wersja demo: wiadomość nie została wysłana.'); });
  const settings = $('#settingsForm');
  settings.addEventListener('submit', e => {
    e.preventDefault();
    store.set('settings', { name: $('#sysName').value, s1: $('#s1').checked, s2: $('#s2').checked, s3: $('#s3').checked });
    toast('Zapisano tylko w tej przeglądarce (DEMO).');
  });
  const saved = store.get('settings', null);
  if (saved) { $('#sysName').value = saved.name; $('#s1').checked = saved.s1; $('#s2').checked = saved.s2; $('#s3').checked = saved.s3; }

  /* ---------- FAQ ---------- */
  let faqCat = 'all';
  function filterFaq() {
    const q = $('#faqSearch').value.trim().toLocaleLowerCase('pl');
    let n = 0;
    $$('#faqList details').forEach(d => {
      const ok = (faqCat === 'all' || d.dataset.cat === faqCat) && (!q || d.textContent.toLocaleLowerCase('pl').includes(q));
      d.hidden = !ok; if (ok) n++;
    });
    $('#faqEmpty').hidden = n > 0;
  }
  $('#faqSearch').addEventListener('input', filterFaq);
  $$('#faqList details').forEach(d => d.addEventListener('toggle', () => { d.querySelector('.pm').textContent = d.open ? '−' : '+'; }));
  $$('#faqList details[open] .pm').forEach(p => { p.textContent = '−'; });

  /* ---------- Kliknięcia ---------- */
  let zoom = 1;
  document.addEventListener('click', e => {
    const t = e.target.closest('button,a'); if (!t) return;
    if (t.dataset.demoMsg) { e.preventDefault(); toast(t.dataset.demoMsg); return; }
    if (t.dataset.go) { location.hash = t.dataset.go; return; }
    if (t.matches('[data-toggle-nav]')) { const o = $('.site').classList.toggle('navOpen'); t.setAttribute('aria-expanded', String(o)); return; }
    if (t.matches('[data-toggle-side]')) { const o = $('.app').classList.toggle('navOpen'); $('#appScrim').hidden = !o; t.setAttribute('aria-expanded', String(o)); return; }
    if (t.id === 'screensBtn') { const p = $('#screensPanel'); p.hidden = !p.hidden; t.setAttribute('aria-expanded', String(!p.hidden)); return; }
    if (t.matches('[data-eye]')) { const i = t.parentElement.querySelector('input'); const v = i.type === 'password'; i.type = v ? 'text' : 'password'; t.setAttribute('aria-label', v ? 'Ukryj hasło' : 'Pokaż hasło'); return; }
    if (t.matches('[data-full]')) { const c = t.closest('.cam'); const on = !c.classList.contains('full'); $('.cam.full')?.classList.remove('full'); c.classList.toggle('full', on); $('#appScrim').hidden = !on; return; }
    if (t.matches('[data-fullfirst]')) { $('#allCams .cam')?.classList.add('full'); $('#appScrim').hidden = false; return; }
    if (t.dataset.layout) { $('#dashCams').classList.toggle('cols2', t.dataset.layout === '2'); $$('[data-layout]').forEach(b => b.setAttribute('aria-pressed', String(b === t))); return; }
    if (t.dataset.layoutAll) { $('#allCams').classList.toggle('cols2', t.dataset.layoutAll === '2'); $$('.camBar button, [data-layout-all]').forEach(b => b.setAttribute('aria-pressed', String(b === t))); return; }
    if (t.matches('[data-fav]')) { toast('Ulubione kamery pojawią się po podłączeniu prawdziwych kamer.'); return; }
    if (t.dataset.zoom) { zoom = Math.min(2.2, Math.max(1, zoom + (t.dataset.zoom === 'in' ? .2 : -.2))); $('#mapInner').style.setProperty('--z', zoom); return; }
    if (t.dataset.ev) { $$('#evTabs button').forEach(b => b.setAttribute('aria-pressed', String(b === t))); renderEvents(t.dataset.ev); return; }
    if (t.matches('[data-markread]')) { $$('#evList .badge').forEach(b => b.remove()); $$('#evList .eventItem').forEach(i => { i.style.opacity = '.7'; }); toast('Oznaczono jako przeczytane (DEMO).'); return; }
    if (t.dataset.faq) { faqCat = t.dataset.faq; $$('.faqCats button').forEach(b => b.setAttribute('aria-pressed', String(b === t))); filterFaq(); return; }
    if (t.dataset.quick) { $$('[data-quick]').forEach(b => b.setAttribute('aria-pressed', String(b === t))); toast(t.dataset.quick === 'arm' ? 'Tryb przykładowy: system uzbrojony (DEMO).' : 'Tryb przykładowy: system rozbrojony (DEMO).'); return; }
    if (t.dataset.thumb !== undefined) { $$('#thumbs button').forEach(b => b.setAttribute('aria-pressed', String(b === t))); return; }
    // Przyciski przełączające w obrębie jednej grupy (strefy, kategorie, zakładki).
    const group = t.closest('.zones,.setNav,.tabs:not(#evTabs)');
    if (group && t.tagName === 'BUTTON') { $$('button', group).forEach(b => b.setAttribute('aria-pressed', String(b === t))); return; }
  });
  $('#appScrim').addEventListener('click', closeAll);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAll();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { const s = $('#appSearch'); if (s.offsetParent) { e.preventDefault(); s.focus(); } }
  });
  $('#appSearch').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const q = e.target.value.trim().toLocaleLowerCase('pl');
    const hit = Object.entries(SCREENS).find(([k, v]) => v[0] === 'app' && (k.includes(q) || v[1].toLocaleLowerCase('pl').includes(q)));
    if (hit && q) { location.hash = hit[0]; e.target.value = ''; } else toast('Brak widoku pasującego do wyszukiwania.');
  });

  /* ---------- Oś czasu archiwum (tylko wskaźnik, bez nagrania) ---------- */
  const tl = $('#timeline');
  const setTl = pct => {
    pct = Math.min(100, Math.max(0, pct));
    tl.style.setProperty('--x', pct + '%'); tl.setAttribute('aria-valuenow', String(Math.round(pct)));
    const mins = 35 + pct / 100 * 20, h = 23, m = Math.floor(mins), s = Math.round((mins - m) * 60) % 60;
    $('#tlLabel').textContent = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  tl.addEventListener('click', e => { const r = tl.getBoundingClientRect(); setTl((e.clientX - r.left) / r.width * 100); });
  tl.addEventListener('keydown', e => { const v = +tl.getAttribute('aria-valuenow'); if (e.key === 'ArrowRight') setTl(v + 2); if (e.key === 'ArrowLeft') setTl(v - 2); });

  /* ---------- Start ---------- */
  render();
  setInterval(tick, 1000);
  show(location.hash.slice(1) || 'start');
})();

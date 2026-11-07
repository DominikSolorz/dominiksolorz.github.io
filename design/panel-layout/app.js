/*
 * HOME SECURITY — projekt układu panelu (etap 1), interakcje.
 * Samodzielny skrypt projektu. Nie łączy się z kamerą, kontem, PIN-em,
 * nagrywaniem ani mechanizmem aktualizacji. Nie wysyła żadnych żądań sieciowych.
 * Dane przykładowe pojawiają się tylko po świadomym włączeniu i są oznaczone.
 */
(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem('hs-layout-' + key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem('hs-layout-' + key, JSON.stringify(value)); } catch { /* tryb prywatny */ } }
  };

  const VIEWS = {
    pulpit: ['Pulpit', 'Podgląd na żywo i stan systemu'],
    kamery: ['Kamery', 'Wszystkie źródła obrazu'],
    mapa: ['Mapa', 'Plan obiektu i położenie kamer'],
    zdarzenia: ['Zdarzenia', 'Wykrycia ruchu i dźwięku'],
    analityka: ['Analityka', 'Statystyki pracy systemu'],
    detekcja: ['Detekcja', 'Ustawienia wykrywania'],
    alarmy: ['Alarmy', 'Komunikaty o stanie systemu'],
    raporty: ['Raporty', 'Zestawienia i eksport'],
    system: ['System', 'Diagnostyka i aktualizacje'],
    ustawienia: ['Ustawienia', 'Wygląd i miejsce zapisu']
  };

  // Sześć miejsc na kamery. Nazwy są opisem miejsca w siatce, nie prawdziwymi kamerami.
  const SLOTS = [1, 2, 3, 4, 5, 6].map(n => ({ name: `Miejsce na kamerę ${n}`, dot: '' }));

  // Ilustracja układu — pokazywana tylko po włączeniu „danych przykładowych”.
  const SAMPLE = {
    cameras: ['PRZYKŁAD · Wejście', 'PRZYKŁAD · Podjazd', 'PRZYKŁAD · Salon', 'PRZYKŁAD · Ogród', 'PRZYKŁAD · Garaż', 'PRZYKŁAD · Taras'],
    dots: ['cyan', 'violet', 'blue', 'blue', 'cyan', 'violet'],
    alerts: [
      { icon: 'i-alert', tone: 'red', title: 'Utrata połączenia', sub: 'PRZYKŁAD · Podjazd', level: 'high', label: 'Wysoki', ago: 2 },
      { icon: 'i-alert', tone: 'amber', title: 'Mało miejsca na dysku', sub: 'PRZYKŁAD · Folder nagrań', level: 'medium', label: 'Średni', ago: 9 },
      { icon: 'i-bell', tone: 'violet', title: 'Wykryto ruch', sub: 'PRZYKŁAD · Ogród', level: 'low', label: 'Niski', ago: 14 }
    ],
    events: [
      { icon: 'i-bell', kind: 'motion', title: 'Wykryto ruch', sub: 'PRZYKŁAD · Wejście', ago: 3 },
      { icon: 'i-bell', kind: 'sound', title: 'Wykryto dźwięk', sub: 'PRZYKŁAD · Salon', ago: 11 },
      { icon: 'i-bell', kind: 'motion', title: 'Wykryto ruch', sub: 'PRZYKŁAD · Garaż', ago: 26 }
    ],
    stats: { total: '6', active: '4', events: '3', alerts: '3', bandwidth: '— Mb/s' },
    metrics: { cameras: '4 / 6', network: '—', storage: '—', agent: '—' },
    ring: 67
  };

  const shell = $('#shell');
  const html = document.documentElement;
  let sampleOn = store.get('sample', false);
  let eventFilter = 'all';

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(text) {
    const box = $('#toast');
    box.textContent = text;
    box.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { box.hidden = true; }, 3200);
  }

  /* ---------- Zegar: prawdziwy czas tego urządzenia ---------- */
  const timeFmt = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateFmt = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
  function tick() {
    const now = new Date();
    const t = timeFmt.format(now);
    $('#clockTime').textContent = t;
    $('#clockDate').textContent = dateFmt.format(now);
    $$('.camTime').forEach(el => { el.textContent = t; });
  }

  /* ---------- Kamery ---------- */
  function renderCameras(grid) {
    const tpl = $('#cameraTpl');
    grid.replaceChildren(...SLOTS.map((slot, i) => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      const name = sampleOn ? SAMPLE.cameras[i] : slot.name;
      $('.camName', node).textContent = name;
      $('.dot', node).className = 'dot ' + (sampleOn ? SAMPLE.dots[i] : '');
      node.classList.toggle('sample', sampleOn);
      if (sampleOn) {
        $('.camEmpty strong', node).textContent = 'Kafelek przykładowy';
        $('.camEmpty span', node).textContent = 'Brak obrazu — dane przykładowe';
      }
      const menuBtn = $('.camMenuBtn', node);
      menuBtn.setAttribute('aria-label', 'Menu: ' + name);
      return node;
    }));
  }

  /* ---------- Listy ---------- */
  const ago = minutes => new Date(Date.now() - minutes * 60000);
  function emptyItem(icon, title, text) {
    const li = document.createElement('li');
    li.className = 'feedEmpty';
    li.innerHTML = `<svg><use href="#${icon}"/></svg><strong></strong><span></span>`;
    li.querySelector('strong').textContent = title;
    li.querySelector('span').textContent = text;
    return li;
  }
  function feedItem({ icon, tone = '', title, sub, at, badge }) {
    const li = document.createElement('li');
    li.className = 'feedItem';
    li.innerHTML = `<span class="feedIcon ${tone}"><svg><use href="#${icon}"/></svg></span><span class="feedText"><strong></strong><small></small></span><span class="feedMeta"><time></time></span>`;
    li.querySelector('strong').textContent = title;
    li.querySelector('small').textContent = sub;
    const time = li.querySelector('time');
    time.dateTime = at.toISOString();
    time.textContent = timeFmt.format(at);
    if (badge) {
      const b = document.createElement('span');
      b.className = 'badge ' + badge.level;
      b.textContent = badge.label;
      li.querySelector('.feedMeta').append(b);
    }
    return li;
  }
  function renderAlerts() {
    for (const list of [$('#alertsList'), $('#alertsListAll')]) {
      if (!sampleOn) { list.replaceChildren(emptyItem('i-shield', 'Brak alarmów', 'Kanał alarmów systemu nie jest podłączony.')); continue; }
      list.replaceChildren(...SAMPLE.alerts.map(a => feedItem({ icon: a.icon, tone: a.tone, title: a.title, sub: a.sub, at: ago(a.ago), badge: { level: a.level, label: a.label } })));
    }
  }
  function renderEvents() {
    const items = SAMPLE.events.filter(e => eventFilter === 'all' || e.kind === eventFilter);
    for (const list of [$('#eventsList'), $('#eventsListAll')]) {
      if (!sampleOn) { list.replaceChildren(emptyItem('i-bell', 'Brak zdarzeń', 'Lista zdarzeń panelu nie jest podłączona.')); continue; }
      if (!items.length) { list.replaceChildren(emptyItem('i-bell', 'Brak zdarzeń', 'Brak przykładowych zdarzeń dla tego filtra.')); continue; }
      list.replaceChildren(...items.map(e => feedItem({ icon: e.icon, tone: e.kind === 'sound' ? 'violet' : '', title: e.title, sub: e.sub, at: ago(e.ago) })));
    }
  }
  function renderStats() {
    $$('[data-stat]').forEach(dd => {
      const dot = dd.querySelector('.dot');
      dd.textContent = sampleOn ? SAMPLE.stats[dd.dataset.stat] : '—';
      if (dot) dd.prepend(dot);
    });
    $$('[data-metric]').forEach(b => { b.textContent = sampleOn ? SAMPLE.metrics[b.dataset.metric] : '—'; });
    $$('.metricList .state').forEach(s => { s.textContent = sampleOn ? 'przykład' : 'brak danych'; s.classList.toggle('warn', sampleOn); });
    const pct = sampleOn ? SAMPLE.ring : 0;
    $('#ringValue').setAttribute('stroke-dasharray', `${pct} 100`);
    $('#ringPercent').textContent = sampleOn ? pct + '%' : '—';
    $('#ringState').textContent = sampleOn ? 'Przykład' : 'Niepodłączony';
    $('.ring').setAttribute('aria-label', sampleOn ? `Stan ogólny: przykład ${pct}%` : 'Stan ogólny: niepodłączony');
  }
  function renderAll() {
    renderCameras($('#cameraGrid'));
    renderCameras($('#cameraGridAll'));
    renderAlerts();
    renderEvents();
    renderStats();
    $('#sampleBanner').hidden = !sampleOn;
    $('#sampleSwitch').checked = sampleOn;
    tick();
  }
  function setSample(on) {
    sampleOn = on;
    store.set('sample', on);
    renderAll();
    toast(on ? 'Włączono dane przykładowe. Nie pochodzą z kamer.' : 'Wyłączono dane przykładowe.');
  }

  /* ---------- Widoki ---------- */
  function showView(view, section) {
    if (!VIEWS[view]) view = 'pulpit';
    $$('[data-view-panel]').forEach(p => { p.hidden = p.dataset.viewPanel !== view; });
    $$('.navItem').forEach(b => {
      if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    const [title, subtitle] = VIEWS[view];
    $('#pageTitle').textContent = title;
    $('#pageSubtitle').textContent = subtitle;
    document.title = `${title} — HOME SECURITY (projekt układu)`;
    if (location.hash.slice(1) !== view) history.replaceState(null, '', '#' + view);
    store.set('view', view);
    closeNav();
    if (section) document.getElementById('section-' + section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else $('#main').scrollTo?.(0, 0);
  }

  /* ---------- Menu boczne ---------- */
  function setCollapsed(on) {
    shell.classList.toggle('collapsed', on);
    $('#collapseBtn').setAttribute('aria-pressed', String(on));
    $('#collapseBtn').setAttribute('aria-label', on ? 'Rozwiń menu' : 'Zwiń menu');
    $('#collapseSwitch').checked = on;
    store.set('collapsed', on);
  }
  function openNav() { shell.classList.add('navOpen'); $('#scrim').hidden = false; $('#menuBtn').setAttribute('aria-expanded', 'true'); $('#nav .navItem')?.focus(); }
  function closeNav() { shell.classList.remove('navOpen'); $('#scrim').hidden = true; $('#menuBtn').setAttribute('aria-expanded', 'false'); }

  /* ---------- Motyw ---------- */
  function setTheme(light) {
    html.dataset.theme = light ? 'light' : 'dark';
    $('#themeBtn').setAttribute('aria-pressed', String(light));
    $('#themeBtn').setAttribute('aria-label', light ? 'Przełącz ciemny motyw' : 'Przełącz jasny motyw');
    $('#themeSwitch').checked = light;
    store.set('light', light);
  }

  /* ---------- Okienka (powiadomienia, profil, menu kafelka) ---------- */
  let openPop = null;
  function closePop() {
    if (!openPop) return;
    openPop.pop.hidden = true;
    openPop.btn.setAttribute('aria-expanded', 'false');
    openPop = null;
  }
  function togglePop(btn, pop) {
    const same = openPop?.pop === pop;
    closePop();
    if (same) return;
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    openPop = { btn, pop };
  }

  /* ---------- Wyszukiwanie: filtruje menu i przechodzi do widoku ---------- */
  function search(query) {
    const q = query.trim().toLocaleLowerCase('pl');
    let first = null;
    $$('.navItem').forEach(b => {
      const match = !q || b.textContent.toLocaleLowerCase('pl').includes(q);
      b.style.opacity = match ? '' : '.35';
      if (match && q && !first) first = b;
    });
    return first;
  }

  /* ---------- Mapa (siatka zastępcza) ---------- */
  let zoom = 1;
  function setZoom(z) {
    zoom = Math.min(2.5, Math.max(.6, z));
    $('#mapCanvas').style.setProperty('--zoom', zoom);
  }

  /* ---------- Zdarzenia ---------- */
  document.addEventListener('click', event => {
    const t = event.target.closest('button,[data-go]');
    if (openPop && !openPop.pop.contains(event.target) && t !== openPop.btn) closePop();
    if (!t) return;

    if (t.matches('.navItem')) {
      if (t.classList.contains('hasSub')) {
        const sub = document.getElementById(t.getAttribute('aria-controls'));
        const open = t.getAttribute('aria-expanded') !== 'true';
        t.setAttribute('aria-expanded', String(open));
        sub.hidden = !open;
        if (shell.classList.contains('collapsed')) setCollapsed(false);
      }
      showView(t.dataset.view);
      return;
    }
    if (t.closest('.subNav')) { showView(t.dataset.view, t.dataset.section); return; }
    if (t.dataset.go) { showView(t.dataset.go); return; }
    if (t.id === 'collapseBtn') { setCollapsed(!shell.classList.contains('collapsed')); return; }
    if (t.id === 'menuBtn') { shell.classList.contains('navOpen') ? closeNav() : openNav(); return; }
    if (t.id === 'themeBtn') { setTheme(html.dataset.theme !== 'light'); return; }
    if (t.id === 'notifyBtn') { togglePop(t, $('#notifyMenu')); return; }
    if (t.id === 'messagesBtn') { togglePop(t, $('#messagesMenu')); return; }
    if (t.id === 'profileBtn') { togglePop(t, $('#profileMenu')); return; }
    if (t.matches('.camMenuBtn')) { togglePop(t, t.parentElement.querySelector('.camMenu')); return; }
    if (t.dataset.cam === 'full') {
      const tile = t.closest('.camTile');
      closePop();
      tile.classList.toggle('expanded');
      t.lastChild.textContent = tile.classList.contains('expanded') ? 'Zamknij pełny ekran' : 'Pełny ekran kafelka';
      return;
    }
    if (t.dataset.cols) {
      $$('.segmented button').forEach(b => b.setAttribute('aria-pressed', String(b === t)));
      $('#cameraGrid').dataset.cols = t.dataset.cols;
      store.set('cols', t.dataset.cols);
      return;
    }
    if (t.dataset.map) { setZoom(t.dataset.map === 'in' ? zoom + .25 : t.dataset.map === 'out' ? zoom - .25 : 1); return; }
    if (t.dataset.filter) {
      eventFilter = t.dataset.filter;
      $$('.filters .chip').forEach(c => c.setAttribute('aria-pressed', String(c === t)));
      renderEvents();
      if (!sampleOn) toast('Filtr działa, ale lista zdarzeń nie jest podłączona.');
      return;
    }
    if (t.dataset.action === 'toggle-sample') { setSample(false); return; }
    if (t.disabled) return;
  });

  $('#scrim').addEventListener('click', closeNav);
  $('#themeSwitch').addEventListener('change', e => setTheme(e.target.checked));
  $('#collapseSwitch').addEventListener('change', e => setCollapsed(e.target.checked));
  $('#sampleSwitch').addEventListener('change', e => setSample(e.target.checked));
  $('#searchInput').addEventListener('input', e => search(e.target.value));
  $('#searchInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const hit = search(e.target.value);
      if (hit) { showView(hit.dataset.view); e.target.value = ''; search(''); }
      else toast('Brak pozycji menu pasującej do wyszukiwania.');
    }
    if (e.key === 'Escape') { e.target.value = ''; search(''); e.target.blur(); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closePop(); closeNav();
      $('.camTile.expanded')?.classList.remove('expanded');
    }
    if (e.key === '/' && !e.target.closest('input,textarea,select')) { e.preventDefault(); $('#searchInput').focus(); }
  });
  window.addEventListener('hashchange', () => showView(location.hash.slice(1)));
  matchMedia('(min-width:901px)').addEventListener('change', closeNav);

  /* ---------- Start ---------- */
  setTheme(store.get('light', false));
  setCollapsed(store.get('collapsed', false));
  const cols = store.get('cols', '3');
  $('#cameraGrid').dataset.cols = cols;
  $$('.segmented button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cols === cols)));
  renderAll();
  showView(location.hash.slice(1) || store.get('view', 'pulpit'));
  setInterval(tick, 1000);
})();

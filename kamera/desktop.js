// HOME SECURITY Desktop: nakładka robocza dla dużego ekranu.
// Używa tego samego silnika transmisji, zapisu i archiwum co index.html.
// Nie uruchamia kamery ani nie zmienia jej konfiguracji samodzielnie.
const desktopRequested = new URLSearchParams(location.search).get("desktop") === "1";

if (desktopRequested) {
  const $ = id => document.getElementById(id);
  document.documentElement.classList.add("desktopMode");
  document.body.classList.add("desktopMode");

  const header = document.querySelector(".topbar");
  const search = document.createElement("label");
  search.className = "desktopSearch";
  search.innerHTML = '<span aria-hidden="true">⌕</span><input id="desktopSearchInput" type="search" placeholder="Szukaj zdarzeń i nagrań…" aria-label="Szukaj zdarzeń i nagrań">';
  header?.insertBefore(search, header.querySelector(".nav"));

  const shell = document.createElement("aside");
  shell.className = "desktopSidebar";
  shell.setAttribute("aria-label", "Nawigacja HOME SECURITY Desktop");
  shell.innerHTML = `
    <div class="desktopBrand"><span class="desktopShield">⌾</span><span><b>HOME SECURITY</b><small>DESKTOP</small></span><button id="desktopCollapse" type="button" aria-label="Rozwiń menu">›</button></div>
    <div class="desktopDevice"><span id="desktopLiveDot" class="desktopDot"></span><span><b id="desktopLiveState">Sprawdzam połączenie</b><small id="desktopLiveDetail">—</small></span></div>
    <nav class="desktopNav" aria-label="Moduły monitoringu">
      <button class="active" type="button" data-desktop-view="live"><i>▦</i><span><b>Pulpit</b><small>podgląd na żywo</small></span><kbd>1</kbd></button>
      <button type="button" data-desktop-view="controls"><i>◉</i><span><b>Sterowanie</b><small>zapis i tryb pracy</small></span><kbd>2</kbd></button>
      <button type="button" data-desktop-view="archive"><i>⏪</i><span><b>Archiwum DVR</b><small>oś czasu i nagrania</small></span><kbd>3</kbd></button>
      <button type="button" data-desktop-view="settings"><i>◌</i><span><b>Obraz i dźwięk</b><small>kamera oraz jakość</small></span><kbd>4</kbd></button>
      <button type="button" data-desktop-view="diagnostics"><i>⌁</i><span><b>Diagnostyka</b><small>stan systemu</small></span><kbd>5</kbd></button>
    </nav>
    <section class="desktopCapabilities" aria-label="Możliwości urządzenia">
      <h2>Urządzenie</h2>
      <p><span class="capOk">●</span> Podgląd, zapis i DVR</p>
      <p><span class="capOk">●</span> Zoom cyfrowy</p>
      <p><span class="capOff">●</span> PTZ: brak w PC Camera</p>
      <p><span class="capOff">●</span> Siatki 2–16: brak kamer</p>
    </section>
    <div class="desktopSidebarFoot"><span>Alt + 1–5 przełącza moduły</span><a href="./?panel=owner" title="Otwórz interfejs mobilny">Widok Mobile</a></div>`;
  document.body.prepend(shell);

  const context = document.createElement("section");
  context.className = "desktopContext";
  context.setAttribute("aria-label", "Kontekst pulpitu");
  context.innerHTML = `
    <div><p>Pulpit <span>/</span> Na żywo</p><h1>Monitoring domu</h1></div>
    <div class="desktopContextActions">
      <span id="desktopCameraCount" class="desktopCameraCount">Kamery: sprawdzam…</span>
      <div class="desktopLayouts" role="group" aria-label="Układ kamer">
        <button type="button" class="active" aria-pressed="true">1×1</button>
        <button type="button" disabled title="Dodaj kolejne kamery, aby użyć układu 2×2">2×2</button>
        <button type="button" disabled title="Dodaj kolejne kamery, aby użyć układu 3×3">3×3</button>
        <button type="button" id="desktopOpenLive" title="Otwórz aktualny obraz w pełnym ekranie">⛶ Pełny ekran</button>
      </div>
    </div>`;
  const main = document.querySelector("main");
  const layout = main?.querySelector(".layout");
  if (main && layout) main.insertBefore(context, layout);

  const resize = document.createElement("div");
  resize.className = "desktopResize";
  resize.id = "desktopResize";
  resize.setAttribute("role", "separator");
  resize.setAttribute("aria-orientation", "vertical");
  resize.setAttribute("aria-label", "Zmień szerokość prawego panelu");
  document.body.append(resize);

  const openExistingView = view => {
    const main = document.querySelector(".mainCol");
    // Mobilne menu używa klas focus-* do ukrywania kart. Desktop ma utrzymać
    // układ wielopanelowy, dlatego przełącza tylko aktywny moduł i przewija.
    main?.classList.remove("focus-live", "focus-controls", "focus-settings", "focus-archive");
    if (main) main.dataset.desktopView = view;
    const target = { live: "stage", controls: "modeCard", settings: "setCard", archive: "dvrCard" }[view];
    if (target) {
      if (view === "archive") document.querySelector('[data-menu-view="archive"]')?.click();
      main?.classList.remove("focus-live", "focus-controls", "focus-settings", "focus-archive");
      $(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const diag = $("diagCard");
    if (diag) { diag.hidden = false; diag.open = true; diag.scrollIntoView({ behavior: "smooth", block: "start" }); }
  };
  const setActive = view => {
    shell.querySelectorAll("[data-desktop-view]").forEach(button => button.classList.toggle("active", button.dataset.desktopView === view));
    openExistingView(view);
  };
  shell.querySelectorAll("[data-desktop-view]").forEach(button => button.addEventListener("click", () => setActive(button.dataset.desktopView)));

  const sync = () => {
    const live = $("topStatus");
    const mode = $("systemMode");
    const isLive = live?.classList.contains("live");
    $("desktopLiveDot")?.classList.toggle("live", Boolean(isLive));
    if ($("desktopLiveState")) $("desktopLiveState").textContent = isLive ? "Transmisja aktywna" : "Brak transmisji";
    if ($("desktopLiveDetail")) $("desktopLiveDetail").textContent = mode?.textContent?.trim() || live?.textContent?.trim() || "Sprawdzam stan…";
    const choices = $("cameraSelect")?.options;
    const count = choices ? Math.max(1, choices.length - 1) : 1;
    if ($("desktopCameraCount")) $("desktopCameraCount").textContent = `Kamery: ${count} aktywna${count === 1 ? "" : "e"}`;
  };
  // Obserwujemy wyłącznie prawdziwe źródła stanu. Obserwowanie całego body
  // powodowałoby pętlę, bo sync() zmienia klasę własnej ikonki w sidebarze.
  const statusObserver = new MutationObserver(sync);
  [$("topStatus"), $("systemMode")].filter(Boolean).forEach(node => statusObserver.observe(node, {
    subtree: true, characterData: true, childList: true, attributes: true, attributeFilter: ["class"]
  }));
  sync();

  const collapse = $("desktopCollapse");
  const expanded = localStorage.getItem("home-security-desktop-sidebar") === "expanded";
  document.documentElement.classList.toggle("desktopSidebarCollapsed", !expanded);
  const paintCollapse = () => {
    const isCollapsed = document.documentElement.classList.contains("desktopSidebarCollapsed");
    if (collapse) { collapse.textContent = isCollapsed ? "›" : "‹"; collapse.setAttribute("aria-label", isCollapsed ? "Rozwiń menu" : "Zwiń menu"); }
  };
  paintCollapse();
  collapse?.addEventListener("click", () => {
    const next = !document.documentElement.classList.contains("desktopSidebarCollapsed");
    document.documentElement.classList.toggle("desktopSidebarCollapsed", next);
    localStorage.setItem("home-security-desktop-sidebar", next ? "collapsed" : "expanded");
    paintCollapse();
  });

  $("desktopOpenLive")?.addEventListener("click", () => $("fullBtn")?.click());
  $("desktopSearchInput")?.addEventListener("input", event => {
    const term = String(event.target.value || "").trim().toLocaleLowerCase("pl-PL");
    document.querySelectorAll("#viewEvents li,#pcEvents li,.recList li").forEach(item => {
      item.hidden = Boolean(term) && !item.textContent.toLocaleLowerCase("pl-PL").includes(term);
    });
  });

  let resizing = false;
  resize.addEventListener("pointerdown", event => { resizing = true; resize.setPointerCapture(event.pointerId); document.body.classList.add("desktopResizing"); });
  resize.addEventListener("pointermove", event => {
    if (!resizing) return;
    const width = Math.max(300, Math.min(520, window.innerWidth - event.clientX - 18));
    document.documentElement.style.setProperty("--desktop-right-width", `${width}px`);
    localStorage.setItem("home-security-desktop-right", String(width));
  });
  const stopResize = () => { resizing = false; document.body.classList.remove("desktopResizing"); };
  resize.addEventListener("pointerup", stopResize); resize.addEventListener("pointercancel", stopResize);
  const storedWidth = Number(localStorage.getItem("home-security-desktop-right"));
  if (storedWidth >= 300 && storedWidth <= 520) document.documentElement.style.setProperty("--desktop-right-width", `${storedWidth}px`);

  window.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); $("desktopSearchInput")?.focus(); return; }
    if (!event.altKey || event.ctrlKey || event.metaKey) return;
    const view = { 1: "live", 2: "controls", 3: "archive", 4: "settings", 5: "diagnostics" }[event.key];
    if (view) { event.preventDefault(); setActive(view); }
  });
}

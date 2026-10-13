// HOME SECURITY Desktop: nakładka robocza dla dużego ekranu.
// Używa tego samego silnika transmisji, zapisu i archiwum co index.html.
// Nie uruchamia kamery ani nie zmienia jej konfiguracji samodzielnie.
const routeParams = new URLSearchParams(location.search);
const desktopParam = routeParams.get("desktop");
const isTransmitter = location.hash === "#nadaj";
const isMobileApp = routeParams.get("app") === "android" && (window.matchMedia("(max-width: 700px)").matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));
const desktopRequested = !isTransmitter && !isMobileApp && (desktopParam === "1" || (desktopParam !== "0" && window.matchMedia("(min-width: 1024px)").matches));

if (desktopRequested) {
  const $ = id => document.getElementById(id);
  document.documentElement.classList.add("desktopMode");
  document.body.classList.add("desktopMode");
  // Panel operatora jest elementem po zalogowaniu. Desktop tworzy strukturę
  // wcześniej, ale do pomyślnego PIN-u lewy pasek pozostaje niewidoczny.
  document.body.classList.add("accessPending");

  const header = document.querySelector(".topbar");
  const desktopTopStatus = document.createElement("div");
  desktopTopStatus.className = "desktopTopStatus";
  desktopTopStatus.innerHTML = '<i></i><span id="desktopTopStatusText">Sprawdzam system…</span>';
  header?.prepend(desktopTopStatus);
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
      <button type="button" data-desktop-view="settings"><i>◌</i><span><b>Ustawienia</b><small>obraz, dźwięk i zapis</small></span><kbd>4</kbd></button>
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

  // Pulpit jest jednym stanowiskiem operatora, nie stroną z powielonymi
  // kartami. Pokazuje tylko prawdziwy obraz jednej kamery oraz pełną oś DVR.
  // Pozostałe funkcje są w bocznych modułach — nie dokładamy pustych kafelków
  // ani sterowania pod obrazem.
  const mainCol = document.querySelector(".mainCol");
  const liveStage = document.querySelector(".mainCol > .stage");
  const eventCard = $("viewEventsCard");
  const ctrlBar = $("ctrlBar");
  const overview = document.createElement("section");
  overview.className = "desktopOverview";
  overview.setAttribute("aria-label", "Pulpit podglądu kamer");
  overview.innerHTML = `
    <section class="desktopLiveScene" aria-label="Obraz z kamery na żywo">
      <article class="desktopCameraTile desktopCameraLive"><div class="desktopTileMeta"><strong>Pokój dziecka — Kamera 1</strong><span class="desktopCameraSource">aktualny obraz</span><span class="desktopLivePill">● NA ŻYWO</span></div></article>
    </section>
    <section class="desktopTimelineDock" aria-label="Oś czasu nagrań bieżącej kamery"></section>
    <section class="desktopControlDock" aria-label="Sterowanie transmisją i nagrywaniem"><div class="desktopControlLocked" hidden><span>🔒</span><div><b>Sterowanie właściciela</b><small>Start, Stop i Restart są dostępne wyłącznie na komputerze-kamerze lub po zalogowaniu PIN-em właściciela.</small></div></div></section>
    <details class="desktopEventsDrawer" aria-label="Ostatnie zdarzenia"><summary><span>Ostatnie zdarzenia</span><small>ruch i dźwięk</small><b id="desktopEventCount">—</b></summary></details>`;
  if (context.parentElement) context.insertAdjacentElement("afterend", overview);
  const liveTile = overview.querySelector(".desktopCameraLive");
  if (liveStage && liveTile) liveTile.append(liveStage);
  const eventsDrawer = overview.querySelector(".desktopEventsDrawer");
  if (eventCard && eventsDrawer) {
    eventsDrawer.append(eventCard);
    // Zdarzenia są częścią pulpitu operatorskiego, nie ukrytą kartą pod
    // obrazem. Użytkownik od razu widzi ostatnie prawdziwe wykrycia.
    eventsDrawer.open = true;
    eventCard.open = true;
  }

  // Na pulpicie operatora oś doby jest częścią głównego widoku, obok obrazu
  // i zdarzeń. Pełna lista plików pojawia się dopiero w module Archiwum DVR.
  const timelineDock = overview.querySelector(".desktopTimelineDock");
  const dvrCard = $("dvrCard");
  if (dvrCard) timelineDock.append(dvrCard);
  const controlDock = overview.querySelector(".desktopControlDock");
  const lockedControls = overview.querySelector(".desktopControlLocked");
  // To są oryginalne przyciski aplikacji — zmieniamy wyłącznie ich miejsce
  // na pulpicie. Start, Stop i Restart pozostają połączone z tą samą logiką.
  if (ctrlBar && controlDock) controlDock.append(ctrlBar);
  const syncControlAccess = () => {
    if (!lockedControls || !ctrlBar) return;
    lockedControls.hidden = !ctrlBar.hidden;
  };
  syncControlAccess();
  if (ctrlBar) new MutationObserver(syncControlAccess).observe(ctrlBar, { attributes: true, attributeFilter: ["hidden"] });

  const summary = document.createElement("section");
  summary.className = "desktopSummary";
  summary.setAttribute("aria-label", "Stan systemu");
  summary.innerHTML = `
    <article><span class="desktopSummaryIcon">◈</span><div><b>System</b><strong id="desktopSummaryStatus">Sprawdzam…</strong><small>stan połączenia</small></div></article>
    <article><span class="desktopSummaryIcon">▣</span><div><b>Kamery</b><strong id="desktopSummaryCamera">1 aktywna</strong><small>kolejne urządzenia można dodać</small></div></article>
    <article><span class="desktopSummaryIcon">◉</span><div><b>Nagrania</b><strong id="desktopSummaryRecording">Sprawdzam…</strong><small>status zapisu i DVR</small></div></article>
    <article><span class="desktopSummaryIcon">⌁</span><div><b>Tryb ochrony</b><strong>Gotowy</strong><small>wykrywanie ruchu i dźwięku</small></div></article>`;
  overview.insertAdjacentElement("afterend", summary);

  // Ustawienia są osobnym ekranem desktopowym, a nie kartą pozostawioną pod
  // podglądem. Prawdziwe kontrolki aplikacji przenosimy do nowego układu,
  // dzięki czemu nie dublujemy logiki kamery ani nie tworzymy atrap.
  const setCard = $("setCard");
  const pictureRow = $("pictureStyle")?.closest(".setRow");
  const gridRow = $("gridToggle")?.closest(".setRow");
  const settingsScreen = document.createElement("section");
  settingsScreen.className = "desktopSettingsScreen";
  settingsScreen.hidden = true;
  settingsScreen.setAttribute("aria-label", "Ustawienia kamery");
  settingsScreen.innerHTML = `
    <header class="desktopSettingsHeader">
      <span class="desktopSettingsIcon">▣</span>
      <div><h2>Ustawienia kamery</h2><p>Dostosuj obraz, dźwięk, nagrywanie i dostęp do wybranej kamery.</p></div>
    </header>
    <nav class="desktopSettingsTabs" aria-label="Kategorie ustawień kamery">
      <button type="button" data-settings-group="picture">▣ <span>Obraz</span></button>
      <button type="button" data-settings-group="sound">⌁ <span>Dźwięk</span></button>
      <button type="button" data-settings-group="quality">HD <span>Jakość</span></button>
      <button type="button" data-settings-group="recording">◉ <span>Nagrywanie</span></button>
      <button type="button" data-settings-group="detection">◌ <span>Detekcja</span></button>
      <button type="button" data-settings-group="devices">▤ <span>Urządzenia</span></button>
      <button type="button" data-settings-group="access">▢ <span>Dostęp</span></button>
      <button type="button" data-settings-group="application">▦ <span>Aplikacja</span></button>
    </nav>
    <div class="desktopSettingsGrid">
      <section class="desktopSettingsControls" aria-label="Parametry wybranej kategorii"></section>
      <section class="desktopSettingsPreview" aria-label="Rzeczywisty podgląd kamery">
        <div class="desktopSettingsPreviewHead"><b id="desktopSettingsCameraName">Podgląd kamery</b><span id="desktopSettingsLiveState">● oczekiwanie</span></div>
        <div class="desktopSettingsLiveFrame"></div>
        <button id="desktopResetPicture" class="desktopResetPicture" type="button">⟳ Przywróć naturalne kolory</button>
      </section>
    </div>
    <footer class="desktopSettingsFooter">
      <div><span id="desktopSettingsDevice">Kamera: sprawdzam…</span><span id="desktopSettingsResolution">—</span><span id="desktopSettingsFps">FPS: —</span></div>
      <button id="desktopSettingsSaved" type="button">▣ Zapis ustawień</button>
    </footer>`;
  context.insertAdjacentElement("afterend", settingsScreen);
  const settingsControls = settingsScreen.querySelector(".desktopSettingsControls");
  const settingsPreviewFrame = settingsScreen.querySelector(".desktopSettingsLiveFrame");
  if (setCard && settingsControls) settingsControls.append(setCard);

  const previewTweaks = document.createElement("section");
  previewTweaks.className = "desktopPreviewTweaks";
  previewTweaks.innerHTML = `
    <p class="desktopSettingNote">Korekta podglądu na tym urządzeniu — nie zmienia fizycznych ustawień kamery.</p>
    <label>Kontrast podglądu <input id="desktopPreviewContrast" type="range" min="70" max="140" value="100"><output>100%</output></label>
    <label>Nasycenie kolorów <input id="desktopPreviewSaturation" type="range" min="0" max="160" value="100"><output>100%</output></label>
    <label class="desktopPreviewSelect">Balans bieli <select disabled><option>Automatyczny — steruje kamera</option></select></label>
    <label class="desktopPreviewSelect">Ostrość obrazu <select disabled><option>Automatyczna — steruje kamera</option></select></label>`;
  setCard?.querySelector(".panelHead")?.insertAdjacentElement("afterend", previewTweaks);

  const settingsGroups = {
    picture: [$("ownerLight"), previewTweaks, pictureRow, gridRow],
    sound: [$("ownerMedia")],
    quality: [$("ownerQuality")],
    recording: [$("ownerOnce")],
    detection: [],
    devices: [],
    access: [],
    application: []
  };
  let activeSettingsGroup = "picture";
  const settingsTabs = settingsScreen.querySelector(".desktopSettingsTabs");
  const emptySettings = document.createElement("p");
  emptySettings.className = "desktopSettingsEmpty";
  const setSettingsGroup = group => {
    activeSettingsGroup = settingsGroups[group] ? group : "picture";
    const visible = new Set(settingsGroups[activeSettingsGroup].filter(Boolean));
    Object.values(settingsGroups).flat().filter(Boolean).forEach(row => { row.hidden = !visible.has(row); });
    emptySettings.textContent = ({
      detection: "Detekcja ruchu i dźwięku jest konfigurowana na komputerze-kamerze. Po uruchomieniu transmisji pokażemy tu faktycznie dostępne opcje urządzenia.",
      devices: "Ta kamera korzysta obecnie z urządzenia wybranego na komputerze-kamerze. Nie zmieniamy źródła zdalnie bez potwierdzenia tego komputera.",
      access: "Dostęp właściciela jest chroniony PIN-em. Link odbiorcy pozostaje tylko do podglądu.",
      application: "Autostart działa tylko po zalogowaniu do Windows. Nie uruchamia ponownie kamery po ręcznym zatrzymaniu w tej samej sesji."
    })[activeSettingsGroup] || "";
    emptySettings.hidden = Boolean(visible.size) || !emptySettings.textContent;
    if (!emptySettings.parentElement) setCard?.append(emptySettings);
    settingsTabs.querySelectorAll("button").forEach(button => {
      const active = button.dataset.settingsGroup === activeSettingsGroup;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  };
  if (setCard) {
    settingsTabs.addEventListener("click", event => {
      const button = event.target.closest("button[data-settings-group]");
      if (button) setSettingsGroup(button.dataset.settingsGroup);
    });
    setSettingsGroup(activeSettingsGroup);
  }

  const previewPrefsKey = "home-security-desktop-preview-tweaks";
  const savedPreviewTweaks = JSON.parse(localStorage.getItem(previewPrefsKey) || '{"contrast":100,"saturation":100}');
  const applyPreviewTweaks = () => {
    const contrast = Number($("desktopPreviewContrast")?.value || 100);
    const saturation = Number($("desktopPreviewSaturation")?.value || 100);
    const stage = $("stage");
    stage?.style.setProperty("--desktop-preview-contrast", `${contrast}%`);
    stage?.style.setProperty("--desktop-preview-saturation", `${saturation}%`);
    ["desktopPreviewContrast", "desktopPreviewSaturation"].forEach(id => {
      const input = $(id); const output = input?.parentElement?.querySelector("output");
      if (input && output) output.value = `${input.value}%`;
    });
    localStorage.setItem(previewPrefsKey, JSON.stringify({ contrast, saturation }));
  };
  ["desktopPreviewContrast", "desktopPreviewSaturation"].forEach(id => {
    if ($(id)) $(id).value = String(savedPreviewTweaks[id === "desktopPreviewContrast" ? "contrast" : "saturation"] || 100);
    $(id)?.addEventListener("input", applyPreviewTweaks);
  });
  applyPreviewTweaks();
  $("desktopResetPicture")?.addEventListener("click", () => {
    if ($("pictureStyle")) { $("pictureStyle").value = "color"; $("pictureStyle").dispatchEvent(new Event("change")); }
    if ($("gridToggle")) { $("gridToggle").checked = false; $("gridToggle").dispatchEvent(new Event("change")); }
    if ($("desktopPreviewContrast")) $("desktopPreviewContrast").value = "100";
    if ($("desktopPreviewSaturation")) $("desktopPreviewSaturation").value = "100";
    applyPreviewTweaks();
  });
  $("desktopSettingsSaved")?.addEventListener("click", () => {
    $("desktopSettingsSaved").textContent = "✓ Ustawienia zapisane";
    setTimeout(() => { if ($("desktopSettingsSaved")) $("desktopSettingsSaved").textContent = "▣ Zapis ustawień"; }, 2200);
  });

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
    // Każdy wpis w bocznym menu ma własny pełnoekranowy obszar. Dzięki temu
    // Diagnostyka i Archiwum nie zostawiają pustej połowy monitora.
    overview.hidden = view !== "live";
    settingsScreen.hidden = view !== "settings";
    if (layout) layout.hidden = view === "settings";
    if (view === "settings" && liveStage?.parentElement !== settingsPreviewFrame) settingsPreviewFrame?.append(liveStage);
    if (view !== "settings" && liveStage?.parentElement !== liveTile) liveTile?.append(liveStage);
    // Pulpit ma być roboczy: kamera, zdarzenia i oś czasu — bez dodatkowych
    // kart diagnostycznych pod spodem. Ich dane są w module Diagnostyka.
    summary.hidden = true;
    if (view === "live" && $("dvrCard")?.parentElement !== timelineDock) timelineDock.append($("dvrCard"));
    if (view === "live" && ctrlBar?.parentElement !== controlDock) controlDock?.append(ctrlBar);
    if (view === "live") $("dvrCard").hidden = false;
    if (view === "archive" && $("dvrCard")?.parentElement !== main) main?.prepend($("dvrCard"));
    if (view === "controls" && ctrlBar?.parentElement !== main) main?.append(ctrlBar);
    const labels = {
      live: ["Pulpit", "Monitoring domu"],
      controls: ["Sterowanie", "Sterowanie kamerą"],
      archive: ["Archiwum", "Nagrania DVR"],
      settings: ["Ustawienia", "Ustawienia kamery"],
      diagnostics: ["Diagnostyka", "Stan systemu"]
    };
    const label = labels[view] || labels.live;
    const crumb = context.querySelector("p");
    const heading = context.querySelector("h1");
    if (crumb) crumb.innerHTML = `${label[0]} <span>/</span> HOME SECURITY`;
    if (heading) heading.textContent = label[1];
    // Po opuszczeniu ustawień przywracamy komplet pól dla innych trybów
    // interfejsu; wybrana kategoria jest widoczna tylko w module Ustawienia.
    if (view === "settings") setSettingsGroup(activeSettingsGroup);
    else Object.values(settingsGroups).flat().filter(Boolean).forEach(row => { row.hidden = false; });
    const target = { live: "stage", controls: "modeCard", settings: "setCard", archive: "dvrCard" }[view];
    if (target) {
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
    if ($("desktopSummaryCamera")) $("desktopSummaryCamera").textContent = `${count} aktywna${count === 1 ? "" : "e"}`;
    if ($("desktopSummaryStatus")) $("desktopSummaryStatus").textContent = isLive ? "System online" : "Oczekiwanie na transmisję";
    if ($("desktopSummaryRecording")) $("desktopSummaryRecording").textContent = mode?.textContent?.trim() || "Brak danych";
    if ($("desktopTopStatusText")) $("desktopTopStatusText").textContent = isLive ? "System online" : "System offline";
    desktopTopStatus.classList.toggle("live", Boolean(isLive));
    const settingsState = $("desktopSettingsLiveState");
    if (settingsState) { settingsState.textContent = isLive ? "● Na żywo" : "● oczekiwanie"; settingsState.classList.toggle("live", Boolean(isLive)); }
    const mediaSettings = document.querySelector("#video")?.srcObject?.getVideoTracks?.()[0]?.getSettings?.() || {};
    if ($("desktopSettingsDevice")) $("desktopSettingsDevice").textContent = `Kamera: ${mediaSettings.deviceId ? "PC Camera" : "brak transmisji"}`;
    if ($("desktopSettingsResolution")) $("desktopSettingsResolution").textContent = mediaSettings.width && mediaSettings.height ? `${mediaSettings.width} × ${mediaSettings.height}` : "Rozdzielczość: —";
    if ($("desktopSettingsFps")) $("desktopSettingsFps").textContent = mediaSettings.frameRate ? `${Math.round(mediaSettings.frameRate)} FPS` : "FPS: —";
    const events = document.querySelectorAll("#viewEvents li,#pcEvents li");
    if ($("desktopEventCount")) $("desktopEventCount").textContent = events.length ? `${events.length} zdarzeń` : "Brak zdarzeń";
  };
  // Obserwujemy wyłącznie prawdziwe źródła stanu. Obserwowanie całego body
  // powodowałoby pętlę, bo sync() zmienia klasę własnej ikonki w sidebarze.
  const statusObserver = new MutationObserver(sync);
  [$("topStatus"), $("systemMode")].filter(Boolean).forEach(node => statusObserver.observe(node, {
    subtree: true, characterData: true, childList: true, attributes: true, attributeFilter: ["class"]
  }));
  sync();

  const collapse = $("desktopCollapse");
  // Pierwsze uruchomienie pokazuje pełne opisy modułów. Zwinięcie paska
  // jest wyłącznie świadomą decyzją użytkownika, nie domyślnym stanem.
  const collapsed = localStorage.getItem("home-security-desktop-sidebar") === "collapsed";
  document.documentElement.classList.toggle("desktopSidebarCollapsed", collapsed);
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
    if (event.key === "Escape") { setActive("live"); return; }
    if (event.ctrlKey || event.metaKey || event.target.matches("input,select,textarea")) return;
    const view = { 1: "live", 2: "controls", 3: "archive", 4: "settings", 5: "diagnostics" }[event.key];
    if (view && (event.altKey || !event.shiftKey)) { event.preventDefault(); setActive(view); }
  });

  // Link z `view=settings` otwiera od razu właściwy ekran — jest przydatny
  // dla skrótu aplikacji i eliminuje ryzyko, że użytkownik zostanie na
  // starym pulpicie po aktualizacji. Bez parametru zachowujemy Pulpit.
  const initialView = ["live", "controls", "archive", "settings", "diagnostics"].includes(routeParams.get("view"))
    ? routeParams.get("view")
    : "live";
  setActive(initialView);
}

// HOME SECURITY Desktop: nakładka robocza dla dużego ekranu.
// Używa tego samego silnika transmisji, zapisu i archiwum co index.html.
// Nie uruchamia kamery ani nie zmienia jej konfiguracji samodzielnie.
import { createRouter } from "./core/router.mjs";
import { createViewMemory } from './core/view-memory.mjs?v=1';
import { systemStore } from "./core/store.mjs";
import { operatorStatus } from "./core/operator-status.mjs?v=1";
import { mountCameraWorkspace } from './camera-workspace.mjs?v=2';
import { mountEventWorkspace, mountDiagnosticWorkspace, mirrorLivePreview } from "./workspace-panels.mjs?v=2";
const isTransmitter = location.hash === "#nadaj";
// Tryb urządzenia jest rozstrzygany raz, przed załadowaniem CSS w index.html.
// Dzięki temu Chrome w telefonie i wersja instalowana PWA nie rozchodzą się
// z desktopowym panelem przy kolejnych aktualizacjach.
const desktopRequested = !isTransmitter && document.documentElement.classList.contains("desktopMode");

if (desktopRequested) {
  const $ = id => document.getElementById(id);
  let cameraWorkspace = null;
  document.documentElement.classList.add("desktopMode");
  document.body.classList.add("desktopMode");
  // Panel operatora jest elementem po zalogowaniu. Desktop tworzy strukturę
  // wcześniej, ale do pomyślnego PIN-u lewy pasek pozostaje niewidoczny.
  if ($('app')?.hidden !== false) document.body.classList.add("accessPending");

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
    <div class="desktopBrand"><img class="dsPanelLogo" src="assets/ds-logo.jpg" alt="Logo DS"><span><b>HOME SECURITY</b><small>DESKTOP</small></span><button id="desktopCollapse" type="button" aria-label="Rozwiń menu">›</button></div>
    <div class="desktopDevice"><span id="desktopLiveDot" class="desktopDot"></span><span><b id="desktopLiveState">Sprawdzam połączenie</b><small id="desktopLiveDetail">—</small></span></div>
    <nav class="desktopNav" aria-label="Moduły monitoringu">
      <button class="active" type="button" data-desktop-view="live"><i>▦</i><span><b>Pulpit</b><small>podgląd na żywo</small></span><kbd>1</kbd></button>
      <button type="button" data-desktop-view="controls"><i>◉</i><span><b>Sterowanie</b><small>zapis i tryb pracy</small></span><kbd>2</kbd></button>
      <button type="button" data-desktop-view="events"><i>♧</i><span><b>Alarmy</b><small>zdarzenia z kamery</small></span><kbd>6</kbd></button>
      <button type="button" data-desktop-view="archive"><i>⏪</i><span><b>Nagrania</b><small>archiwum DVR i folder zapisu</small></span><kbd>3</kbd></button>
      <button type="button" data-desktop-view="settings"><i>◌</i><span><b>Ustawienia</b><small>obraz, dźwięk i zapis</small></span><kbd>4</kbd></button>
      <button type="button" data-desktop-view="diagnostics"><i>⌁</i><span><b>Diagnostyka</b><small>stan systemu</small></span><kbd>5</kbd></button>
    </nav>
    <section class="desktopCapabilities" aria-label="Możliwości urządzenia">
      <h2>Urządzenie</h2>
      <p>Stan kamery, zapisu i sieci odczytasz w Diagnostyce.</p>
      <p class="muted">Podgląd obrazu nie potwierdza zapisanego nagrania.</p>
    </section>
    <div class="desktopSidebarFoot"><span>Alt + 1–6 przełącza moduły</span><a href="./?panel=owner" title="Otwórz interfejs mobilny">Widok Mobile</a></div>`;
  document.body.prepend(shell);
  const updateNotice = document.createElement("section");
  updateNotice.id = "desktopUpdateNotice"; updateNotice.className = "desktopUpdateNotice"; updateNotice.hidden = true;
  updateNotice.innerHTML = '<button type="button" id="desktopUpdateAction" aria-label="Zaktualizuj program HOME SECURITY">↻ Zaktualizuj</button><progress id="desktopUpdateProgress" max="100" hidden></progress><small id="desktopUpdateStatus" role="status" aria-live="polite"></small>';
  // Always show the available native update inside the LEFT navigation rail.
  shell.insertBefore(updateNotice, shell.querySelector('.desktopNav'));
  $("desktopUpdateAction").addEventListener("click", () => { if (updatePanelVisible) window.chrome?.webview?.postMessage({ type: "desktop.update.request" }); });
  window.chrome?.webview?.addEventListener("message", event => {
    const state = event.data;
    if (state?.type !== "desktop.update.state") return;
    updateNotice.hidden = state.status === "none";
    $("desktopUpdateAction").disabled = !["available", "error"].includes(state.status);
    $("desktopUpdateAction").textContent = state.status === "available" ? `↻ Zaktualizuj do ${state.version}` : state.status === "error" ? "↻ Spróbuj ponownie" : "↻ Aktualizacja programu";
    $("desktopUpdateStatus").textContent = state.message || "";
    const progress = $("desktopUpdateProgress"); progress.hidden = state.status !== "downloading";
    if (Number.isFinite(state.percent)) progress.value = Math.max(0, Math.min(100, state.percent));
    else progress.removeAttribute("value");
  });
  // The updater is available only after account login and PIN unlock. Keep
  // background version checks independent from this presentation boundary.
  let updatePanelVisible = false;
  const syncUpdateAccess = () => {
    const app = $("app");
    updatePanelVisible = Boolean(app && !app.hidden && !document.body.classList.contains("accessPending"));
    window.chrome?.webview?.postMessage({ type: "desktop.update.visibility", visible: updatePanelVisible });
  };
  const updateAccessObserver = new MutationObserver(syncUpdateAccess);
  updateAccessObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  if ($("app")) updateAccessObserver.observe($("app"), { attributes: true, attributeFilter: ["hidden"] });
  document.addEventListener("hs-panel-ready", syncUpdateAccess);
  syncUpdateAccess();
  window.chrome?.webview?.postMessage({ type: "desktop.update.query" });

  const context = document.createElement("section");
  context.className = "desktopContext";
  context.setAttribute("aria-label", "Kontekst pulpitu");
  context.innerHTML = `
    <div><p>Pulpit <span>/</span> Na żywo</p><h1>Monitoring domu</h1></div>
    <div class="desktopContextActions">
      <span id="desktopCameraCount" class="desktopCameraCount">Kamery: sprawdzam…</span>
      <div class="desktopLayouts" role="group" aria-label="Układ kamer">
        <button type="button" id="desktopAddCamera" title="Dodaj osobne źródło obrazu">＋ Dodaj kamerę</button>
        <button type="button" id="desktopOpenLive" title="Otwórz aktualny obraz w pełnym ekranie">⛶ Pełny ekran</button>
      </div>
    </div>`;
  // Strona informacyjna również ma <main>. Pulpit i kamera muszą być
  // montowane w chronionym panelu #app, a nie w publicznej stronie głównej.
  const main = $("app");
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
      <article class="desktopCameraTile desktopCameraLive"><div class="desktopTileMeta"><strong>Kamera główna</strong><span class="desktopCameraSource">podgląd z wybranego źródła</span></div></article>
    </section>
    <section class="desktopTimelineDock" aria-label="Oś czasu nagrań bieżącej kamery"></section>
    <section class="desktopControlDock" aria-label="Sterowanie transmisją i nagrywaniem"><div class="desktopControlLocked" hidden><span>🔒</span><div><b>Sterowanie właściciela</b><small>Start, Stop i Restart są dostępne wyłącznie na komputerze-kamerze lub po zalogowaniu PIN-em właściciela.</small></div></div></section>
    <details class="desktopEventsDrawer" aria-label="Ostatnie zdarzenia"><summary><span>Ostatnie zdarzenia</span><small>ruch i dźwięk</small><b id="desktopEventCount">—</b></summary></details>`;
  if (context.parentElement) context.insertAdjacentElement("afterend", overview);
  const liveTile = overview.querySelector(".desktopCameraLive");
  if (liveStage && liveTile) liveTile.append(liveStage);
  $('desktopAddCamera').onclick=()=>{
    if(cameraWorkspace)void cameraWorkspace.openSetup();
    else $('desktopCameraCount').textContent='Konfiguracja kamer jest dostępna po zalogowaniu właściciela.';
  };
  const mountOwnerCameras=ownerId=>{
    if(cameraWorkspace||!ownerId||$('app')?.hidden||document.body.classList.contains('accessPending'))return;
    try{
      cameraWorkspace=mountCameraWorkspace({root:overview.querySelector('.desktopLiveScene'),primaryTile:liveTile,primaryVideo:$('video'),ownerId,native:window.__HOME_SECURITY_DESKTOP__===true,
        onState:(id,state)=>systemStore.component('camera:'+id,state)});
    }catch(error){$('desktopCameraCount').textContent=error.message||'Nie udało się odczytać konfiguracji kamer.';}
  };
  document.addEventListener('hs-panel-ready',event=>mountOwnerCameras(event.detail?.ownerId));
  mountOwnerCameras(window.__HOME_SECURITY_CAMERA_OWNER__);
  // A route change only hides the workspace. Logout closes its owned previews.
  new MutationObserver(()=>{if($('app')?.hidden)cameraWorkspace?.connections.stopAll();}).observe($('app'),{attributes:true,attributeFilter:['hidden']});
  window.addEventListener('pagehide',()=>cameraWorkspace?.dispose(),{once:true});
  const eventsDrawer = overview.querySelector(".desktopEventsDrawer");
  if (eventCard && eventsDrawer) {
    eventsDrawer.append(eventCard);
    // Zdarzenia są częścią pulpitu operatorskiego, nie ukrytą kartą pod
    // obrazem. Użytkownik od razu widzi ostatnie prawdziwe wykrycia.
    eventsDrawer.open = true;
    eventCard.open = true;
  }
  const eventsScreen = document.createElement("section");
  eventsScreen.className = "desktopEventsScreen"; eventsScreen.hidden = true;
  eventsScreen.setAttribute("aria-label", "Alarmy i zdarzenia");
  eventsScreen.innerHTML = '<h2>Alarmy i zdarzenia</h2><p>Rzeczywiste wykrycia ruchu i dźwięku z kamery. Zmiana widoku nie zatrzymuje transmisji ani zapisu.</p>';
  context.insertAdjacentElement("afterend", eventsScreen);
  mountEventWorkspace(eventsScreen);
  const diagnosticsScreen = document.createElement("section");
  diagnosticsScreen.className = "desktopDiagnosticsScreen"; diagnosticsScreen.hidden = true;
  diagnosticsScreen.setAttribute("aria-label", "Diagnostyka systemu");
  mountDiagnosticWorkspace(diagnosticsScreen);
  context.insertAdjacentElement("afterend", diagnosticsScreen);
  if ($("diagCard")) diagnosticsScreen.append($("diagCard"));

  // Na pulpicie operatora oś doby jest częścią głównego widoku, obok obrazu
  // i zdarzeń. Pełna lista plików pojawia się dopiero w module Archiwum DVR.
  const timelineDock = overview.querySelector(".desktopTimelineDock");
  // Archiwum jest osobnym ekranem; DVR pozostaje przygotowany w ukrytym
  // kontenerze do przeniesienia przez ten sam odtwarzacz, bez jego kopiowania.
  timelineDock.hidden = true;
  const dvrCard = $("dvrCard");
  if (dvrCard) timelineDock.append(dvrCard);
  const controlDock = overview.querySelector(".desktopControlDock");
  const deviceManager = document.createElement("section");
  deviceManager.className = "desktopDeviceManager";
  deviceManager.setAttribute("aria-label", "Kamera i mikrofon tego komputera");
  deviceManager.innerHTML = '<h2>Kamera i mikrofon</h2><div class="deviceFields"></div><div class="row"><button id="refreshCameraDevices" class="btn primary" type="button">＋ Dodaj / wykryj kamerę</button><button id="removeCameraDevice" class="btn ghost" type="button">Odłącz kamerę</button></div><p class="muted small">Podłącz kamerę USB, wykryj urządzenia i wybierz kamerę z listy, aby ją zastąpić. Zmiana urządzenia jest dostępna w programie Windows.</p>';
  const cameraFields = $("cameraSelect")?.closest(".grid");
  if (cameraFields) deviceManager.querySelector(".deviceFields").append(cameraFields);
  if ($("retryCameraBtn")) deviceManager.querySelector(".row").append($("retryCameraBtn"));
  controlDock?.append(deviceManager);
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
    <article><span class="desktopSummaryIcon">▣</span><div><b>Kamery</b><strong id="desktopSummaryCamera">Sprawdzam…</strong><small>liczba urządzeń z telemetrii</small></div></article>
    <article><span class="desktopSummaryIcon">◉</span><div><b>Nagrania</b><strong id="desktopSummaryRecording">Sprawdzam…</strong><small>status zapisu i DVR</small></div></article>
    <article><span class="desktopSummaryIcon">⌁</span><div><b>Zdarzenia</b><strong>Sprawdź alarmy</strong><small>stan w module Alarmy</small></div></article>`;
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
  settingsControls.append(deviceManager);
  // Stały właściciel kontrolek. Zmiana ekranu nie zatrzymuje strumienia.
  const controlsScreen = document.createElement("section");
  controlsScreen.className = "desktopControlsScreen";
  controlsScreen.hidden = true;
  controlsScreen.innerHTML = '<header><p class="desktopEyebrow">CENTRUM STEROWANIA</p><h2>Transmisja i nagrywanie</h2><p>Stop kończy zapis, ale pozostawia kamerę na żywo. Pełne wyłączenie jest osobnym trybem.</p></header>';
  context.insertAdjacentElement("afterend", controlsScreen);
  if (ctrlBar) controlsScreen.append(ctrlBar);
  if (lockedControls) controlsScreen.append(lockedControls);
  if ($("modeCard")) controlsScreen.append($("modeCard"));
  const controlWorkspace = document.createElement("div");controlWorkspace.className="controlWorkspace";
  const controlPreview = document.createElement("section");controlPreview.className="controlPreview";
  const previewVideo = document.createElement("video");previewVideo.muted=true;previewVideo.playsInline=true;previewVideo.autoplay=true;
  previewVideo.setAttribute("aria-label","Podgląd aktywnej kamery");
  const previewEmpty=document.createElement("p");previewEmpty.textContent="Oczekiwanie na obraz kamery. Uruchom podgląd przyciskiem Start.";
  controlPreview.append(previewVideo,previewEmpty);
  const controlDeviceDock=document.createElement("aside");controlDeviceDock.className="controlDeviceDock";
  controlWorkspace.append(controlPreview,controlDeviceDock);controlsScreen.querySelector("header").after(controlWorkspace);
  mirrorLivePreview($("video"),previewVideo,previewEmpty);
  controlDock.hidden = true;
  settingsScreen.querySelector(".desktopSettingsPreview").hidden = true;
  settingsScreen.querySelector(".desktopSettingsGrid").classList.add("settingsOnly");
  const settingsHelp=document.createElement("aside");settingsHelp.className="settingsHelp";
  settingsHelp.innerHTML='<h3>Pomoc</h3><p></p><small>Zmiana zakładki nie zatrzymuje kamery ani nagrywania. Dostępność ustawień zależy od urządzenia i uprawnień.</small>';
  settingsScreen.querySelector(".desktopSettingsGrid").append(settingsHelp);
  settingsScreen.querySelector(".desktopSettingsFooter button").remove();
  const autoSaveNote = document.createElement("p");
  autoSaveNote.className = "muted small";
  autoSaveNote.textContent = "Zmiany są stosowane przez poszczególne kontrolki. Parametry dostępne tylko na nadajniku pozostają zablokowane w podglądzie.";
  settingsScreen.querySelector(".desktopSettingsFooter").append(autoSaveNote);

  const previewTweaks = document.createElement("section");
  previewTweaks.className = "desktopPreviewTweaks";
  previewTweaks.innerHTML = `
    <p class="desktopSettingNote">Korekta podglądu na tym urządzeniu — nie zmienia fizycznych ustawień kamery.</p>
    <label>Kontrast podglądu <input id="desktopPreviewContrast" type="range" min="70" max="140" value="100"><output>100%</output></label>
    <label>Nasycenie kolorów <input id="desktopPreviewSaturation" type="range" min="0" max="160" value="100"><output>100%</output></label>
    <label class="desktopPreviewSelect">Balans bieli <select disabled><option>Automatyczny — steruje kamera</option></select></label>
    <label class="desktopPreviewSelect">Ostrość obrazu <select disabled><option>Automatyczna — steruje kamera</option></select></label>`;
  setCard?.querySelector(".panelHead")?.insertAdjacentElement("afterend", previewTweaks);

  const recordingSettings = $("recordPlan")?.closest(".card");
  const detectionSettings = $("detectToggle")?.closest(".card");
  if (recordingSettings) settingsControls.append(recordingSettings);
  if (detectionSettings) settingsControls.append(detectionSettings);
  const settingsGroups = {
    picture: [$("ownerLight"), previewTweaks, pictureRow, gridRow],
    sound: [$("ownerMedia")],
    quality: [$("ownerQuality")],
    recording: [$("ownerOnce"), recordingSettings],
    detection: [detectionSettings],
    devices: [deviceManager],
    access: [],
    application: []
  };
  let activeSettingsGroup = "picture";
  const settingsTabs = settingsScreen.querySelector(".desktopSettingsTabs");
  const emptySettings = document.createElement("p");
  emptySettings.className = "desktopSettingsEmpty";
  const setSettingsGroup = group => {
    activeSettingsGroup = settingsGroups[group] ? group : "picture";
    settingsHelp.querySelector("p").textContent=({picture:"Korekta podglądu zmienia wygląd obrazu na tym ekranie. Nie udaje sprzętowej regulacji obiektywu.",sound:"Wybierz obraz z dźwiękiem lub sam obraz. Mikrofon wymaga zgody na komputerze nadającym.",quality:"Wyższa jakość zwiększa rozmiar nagrań i obciążenie łącza. Faktyczne parametry odczytasz w Diagnostyce.",recording:"Harmonogram i długość segmentu dotyczą nowych nagrań. Zatrzymanie zapisu pozostawia podgląd na żywo.",detection:"Zdarzenia ruchu i dźwięku pojawią się w zakładce Alarmy. Nie są klasyfikacją osób ani pojazdów.",devices:"Podłącz urządzenie, wykryj je i wybierz z listy. Zmiana źródła wymaga dostępu do komputera.",access:"PIN odblokowuje panel. Dostęp do folderu oraz autoryzacja Google Drive są osobnymi zgodami.",application:"Program Windows działa bez Chrome. Aktualizacja jest pokazywana dopiero po wykryciu nowszej wersji."})[activeSettingsGroup]||"";
    if (activeSettingsGroup === "devices") settingsControls.append(deviceManager);
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
    controlsScreen.hidden = view !== "controls";
    eventsScreen.hidden = view !== "events";
    diagnosticsScreen.hidden = view !== "diagnostics";
    if(view==="controls"){controlDeviceDock.append(deviceManager);deviceManager.hidden=false;}
    if (eventCard) { eventsDrawer.append(eventCard); eventCard.open = true; }
    if (layout) layout.hidden = true;
    context.querySelector(".desktopContextActions").hidden = view !== "live";
    // Pulpit ma być roboczy: kamera, zdarzenia i oś czasu — bez dodatkowych
    // kart diagnostycznych pod spodem. Ich dane są w module Diagnostyka.
    summary.hidden = true;
    if (view === "live" && $("dvrCard")?.parentElement !== timelineDock) timelineDock.append($("dvrCard"));
    if (view === "live") $("dvrCard").hidden = false;
    if (view === "archive" && $("dvrCard")?.parentElement !== main) main?.prepend($("dvrCard"));
    const labels = {
      live: ["Pulpit", "Monitoring domu"],
      controls: ["Sterowanie", "Sterowanie kamerą"],
      events: ["Alarmy", "Alarmy i zdarzenia"],
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
    if(view==="events"){eventsScreen.scrollIntoView({block:"start"});return;}
    const target = { live: "stage", controls: "ctrlBar", settings: "setCard", archive: "dvrCard" }[view];
    if (target) {
      main?.classList.remove("focus-live", "focus-controls", "focus-settings", "focus-archive");
      $(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const diag = $("diagCard");
    if (diag) { diag.hidden = false; diag.open = true; diag.scrollIntoView({ behavior: "smooth", block: "start" }); }
  };
  const viewMemory=createViewMemory({key:'hs-desktop-view-v1',routes:['live','controls','events','archive','settings','diagnostics'],fallback:'live'});
  const renderRoute = view => {
    viewMemory.save(view);
    if(view!=="archive"&&document.body.classList.contains("archiveOpen"))document.dispatchEvent(new Event("hs-close-recordings"));
    if (view === "archive") {
      shell.querySelectorAll("[data-desktop-view]").forEach(button => { const active = button.dataset.desktopView === "archive"; button.classList.toggle("active", active); if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current"); });
      document.dispatchEvent(new Event("hs-open-recordings"));
      return;
    }
    shell.querySelectorAll("[data-desktop-view]").forEach(button => { const active = button.dataset.desktopView === view; button.classList.toggle("active", active); if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current"); });
    openExistingView(view);
  };
  const router = createRouter({ routes: ["live", "controls", "events", "archive", "settings", "diagnostics"], render: renderRoute });
  const setActive = view => router.navigate(view);
  document.addEventListener('hs-panel-ready',()=>{if(router.current==='archive')document.dispatchEvent(new Event('hs-open-recordings'));});
  shell.querySelectorAll("[data-desktop-view]").forEach(button => button.addEventListener("click", () => setActive(button.dataset.desktopView)));
  document.addEventListener("hs-recordings-closed", () => setActive("live"));
  shell.querySelectorAll("[data-desktop-view]").forEach(button => { button.title = button.querySelector("b").textContent; });

  const sync = () => {
    const live = $("topStatus");
    const mode = $("systemMode");
    const isLive = live?.classList.contains("live");
    $("desktopLiveDot")?.classList.toggle("live", Boolean(isLive));
    if ($("desktopLiveState")) $("desktopLiveState").textContent = isLive ? "Transmisja aktywna" : "Brak transmisji";
    if ($("desktopLiveDetail")) $("desktopLiveDetail").textContent = mode?.textContent?.trim() || live?.textContent?.trim() || "Sprawdzam stan…";
    const choices = $("cameraSelect")?.options;
    const count = choices ? Array.from(choices).filter(option => option.value).length : 0;
    if ($("desktopCameraCount")) $("desktopCameraCount").textContent = cameraWorkspace ? `Kamery: ${cameraWorkspace.catalog.list().length+1}` : `Wykryte źródła: ${count}`;
    if ($("desktopSummaryCamera")) $("desktopSummaryCamera").textContent = cameraWorkspace ? `${cameraWorkspace.catalog.list().length+1} skonfigurowanych` : `${count} wykrytych źródeł`;
    if ($("desktopSummaryStatus")) $("desktopSummaryStatus").textContent = isLive ? "System online" : "Oczekiwanie na transmisję";
    if ($("desktopSummaryRecording")) $("desktopSummaryRecording").textContent = mode?.textContent?.trim() || "Brak danych";
    const operation=operatorStatus({isLive,recording:systemStore.read('recording',45000),storage:systemStore.read('storage',90000)});
    if ($("desktopTopStatusText")) $("desktopTopStatusText").textContent = operation.text;
    desktopTopStatus.classList.toggle("live", operation.severity==='active');
    desktopTopStatus.classList.toggle("warning", operation.severity==='warning');
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
  const stopStatusUpdates=systemStore.subscribe(sync);
  const statusFreshnessTimer=setInterval(sync,15000);
  window.addEventListener('pagehide',event=>{if(!event.persisted){stopStatusUpdates();clearInterval(statusFreshnessTimer);statusObserver.disconnect();}});

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
    const view = { 1: "live", 2: "controls", 3: "archive", 4: "settings", 5: "diagnostics", 6: "events" }[event.key];
    if (view && (event.altKey || !event.shiftKey)) { event.preventDefault(); setActive(view); }
  });

  // Link z `view=settings` otwiera od razu właściwy ekran — jest przydatny
  // dla skrótu aplikacji i eliminuje ryzyko, że użytkownik zostanie na
  // starym pulpicie po aktualizacji. Bez parametru zachowujemy Pulpit.
  const initialView = viewMemory.read(routeParams.get('view'));
  setActive(initialView);
}

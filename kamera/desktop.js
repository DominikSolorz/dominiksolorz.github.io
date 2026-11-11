import {desktopUpdatePresentation} from "./desktop-update-presentation.mjs?v=1";
import {iconMarkup} from "./ui-icons.mjs?v=1";
// HOME SECURITY Desktop: nakładka robocza dla dużego ekranu.
// Używa tego samego silnika transmisji, zapisu i archiwum co index.html.
// Nie uruchamia kamery ani nie zmienia jej konfiguracji samodzielnie.
import { createRouter } from "./core/router.mjs";
import { createViewMemory } from './core/view-memory.mjs?v=1';
import { systemStore } from "./core/store.mjs";
import { operatorStatus } from "./core/operator-status.mjs?v=1";
import { mountCameraWorkspace } from './camera-workspace.mjs?v=3';
import { mountEventWorkspace, mountDiagnosticWorkspace, mirrorLivePreview, diagnosticCards } from "./workspace-panels.mjs?v=4";
import { mountLocationMap } from "./mobile-map.mjs?v=7";
import { ICONS, mountRecentEvents, mountLiveOverlay, systemStatus } from "./home-dashboard.mjs?v=2";
// „Łączenie…” mówi więcej: z czym się łączymy (pomysł z rundy Replit).
const clarifyConnectionText=()=>{const node=document.getElementById("placeholder");if(!node)return;const fix=()=>{if(node.textContent.trim()==="Łączenie…")node.textContent="Łączenie z komputerem z kamerą…";};const watch=new MutationObserver(fix);watch.observe(node,{childList:true,characterData:true,subtree:true});fix();window.addEventListener("pagehide",()=>watch.disconnect(),{once:true});};

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
    <div class="desktopBrand"><img class="dsPanelLogo" src="assets/ds-shield.svg" width="88" height="110" alt="Logo DS"><span><b>HOME SECURITY</b><small>MONITORING · OCHRONA · KONTROLA</small></span><button id="desktopCollapse" type="button" aria-label="Rozwiń menu">›</button></div>
    <div class="desktopDevice"><span id="desktopLiveDot" class="desktopDot"></span><span><b id="desktopLiveState">Sprawdzam połączenie</b><small id="desktopLiveDetail">—</small></span></div>
    <nav class="desktopNav" aria-label="Moduły monitoringu">
      <button class="active" type="button" data-desktop-view="live"><i>▦</i><span><b>Pulpit</b><small>podgląd na żywo</small></span><kbd>1</kbd></button>
      <button type="button" data-desktop-view="controls"><i>◉</i><span><b>Kamery</b><small>obraz, zapis i tryb pracy</small></span><kbd>2</kbd></button>
      <button type="button" data-desktop-view="events"><i>♧</i><span><b>Zdarzenia</b><small>zdarzenia z kamery</small></span><kbd>6</kbd></button>
      <button type="button" data-desktop-view="archive"><i>⏪</i><span><b>Nagrania</b><small>archiwum DVR i folder zapisu</small></span><kbd>3</kbd></button>
      <button type="button" data-desktop-view="settings"><i>◌</i><span><b>Ustawienia</b><small>obraz, dźwięk i zapis</small></span><kbd>4</kbd></button>
      <button type="button" data-desktop-view="diagnostics"><i>⌁</i><span><b>Diagnostyka</b><small>stan systemu</small></span><kbd>5</kbd></button>
    </nav>
    <button type="button" class="hsSideStatus" id="hsSideStatus" data-tone="off"><span class="hsShield">${ICONS.shield}</span><span><b id="hsSideStatusTitle">Brak transmisji</b><small id="hsSideStatusDetail">Sprawdzam system…</small></span></button>
    <section class="desktopCapabilities" aria-label="Możliwości urządzenia">
      <h2>Urządzenie</h2>
      <p>Stan kamery, zapisu i sieci odczytasz w Diagnostyce.</p>
      <p class="muted">Podgląd obrazu nie potwierdza zapisanego nagrania.</p>
    </section>
`;
  const navPaths = {
    live: '<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
    controls: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
    events: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    archive: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m10 8 6 4-6 4Z"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
    diagnostics: '<path d="M2 12h5l3-8 4 16 3-8h5"/>'
  };
  shell.querySelectorAll('[data-desktop-view]').forEach(button => {
    button.querySelector('i').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${navPaths[button.dataset.desktopView]}</svg>`;
  });
  // Mapa (OSM, ta sama zgoda na lokalizację przy każdym otwarciu) także w programie Windows.
  shell.append(mountLocationMap());
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
    const presentation=desktopUpdatePresentation(state);
    updateNotice.hidden = !presentation.visible;
    $("desktopUpdateAction").disabled = !presentation.enabled;
    $("desktopUpdateAction").textContent = presentation.label;
    $("desktopUpdateStatus").textContent = state.message || "";
    const progress = $("desktopUpdateProgress"); progress.hidden = !presentation.progress;
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
    <div><p>Pulpit <span>/</span> Na żywo</p><h1>Monitoring domu</h1><small class="hsSubtitle">Podgląd na żywo, zdarzenia i ustawienia systemu</small></div>
    <div class="hsHeadCards"><div class="hsClockCard" aria-live="off">${ICONS.calendar}<span><small id="hsDate">—</small><b id="hsTime">--:--:--</b></span></div><button type="button" class="hsRecCard" id="hsRecCard" role="switch" aria-checked="false"><span class="hsRecIcon">${ICONS.shield}</span><span><small>Nagrywanie</small><b id="hsRecCardText">Sprawdzam…</b></span><i class="hsSwitch" aria-hidden="true"></i></button></div>
    <div class="hsHeadActions"><button type="button" class="hsStatusPill" id="hsStatusPill" data-tone="off"><span class="hsShield">${ICONS.shield}</span><b id="hsStatusPillText">Brak transmisji</b></button><button type="button" class="hsRoundBtn" id="hsHeadTheme" aria-label="Przełącz motyw jasny lub ciemny" title="Motyw jasny / ciemny"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v2M12 19v2M5 5l1.4 1.4M17.6 17.6 19 19M3 12h2M19 12h2M5 19l1.4-1.4M17.6 6.4 19 5"/><circle cx="12" cy="12" r="4"/></svg></button><button type="button" class="hsRoundBtn" id="hsHeadEvents" aria-label="Zdarzenia">${ICONS.bell}</button><button type="button" class="hsRoundBtn" id="hsHeadSettings" aria-label="Ustawienia">${ICONS.gear}</button></div>
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
    <section class="hsStats" aria-label="Najważniejsze wskaźniki">
      <article class="hsStat" data-stat="cams"><span class="hsStatIcon">${ICONS.record}</span><span><small>Kamery</small><b id="hsStatCams">1</b><em id="hsStatCamsNote">Sprawdzam…</em></span></article>
      <article class="hsStat" data-stat="rec"><span class="hsStatIcon">${ICONS.camera}</span><span><small>Nagrywanie</small><b id="hsStatRec">—</b><em id="hsStatRecNote">Sprawdzam…</em></span></article>
      <article class="hsStat" data-stat="events"><span class="hsStatIcon">${ICONS.bell}</span><span><small>Zdarzenia</small><b id="hsStatEvents">0</b><em id="hsStatEventsNote">ostatnie 24 h</em></span></article>
      <article class="hsStat" data-stat="system"><span class="hsStatIcon">${ICONS.signal}</span><span><small>System</small><b id="hsStatSystem">—</b><em id="hsStatSystemNote">Sprawdzam…</em></span></article>
      <article class="hsStat" data-stat="storage"><span class="hsStatIcon">${ICONS.storage}</span><span><small>Miejsce zapisu</small><b id="hsStatStorage">—</b><em id="hsStatStorageNote">Sprawdzam…</em></span></article>
    </section>
    <aside class="hsSideCol" aria-label="Sterowanie, stan i zdarzenia">
      <article class="hsCard hsQuickCard"><header class="hsCardHead"><h2>${ICONS.bolt} Szybkie sterowanie</h2></header><div class="hsQuickGrid">
        <button type="button" class="hsQuick" id="hsQuickRecord">${ICONS.record}<b>Nagrywaj</b></button>
        <button type="button" class="hsQuick" id="hsQuickSnap">${ICONS.camera}<b>Zdjęcie</b></button>
        <button type="button" class="hsQuick" id="hsQuickArchive">${ICONS.list}<b>Nagrania</b></button>
        <button type="button" class="hsQuick" data-hs-view="controls">${ICONS.gear}<b>Sterowanie</b></button>
      </div></article>
      <article class="hsCard hsStatusCard"><header class="hsCardHead"><h2>${ICONS.shield} Status systemu</h2><button type="button" class="hsLink" data-hs-view="diagnostics">Szczegóły →</button></header>
        <button type="button" class="hsStatusRow" id="hsStatusRow" data-tone="off" hidden><span><b id="hsStatusTitle">Brak transmisji</b><small id="hsStatusDetail">Sprawdzam…</small></span></button>
        <ul class="hsStatusList" id="hsStatusList"></ul></article>
      <article class="hsCard hsEventsCard"></article>
    </aside>
    <details class="desktopEventsDrawer" aria-label="Ostatnie zdarzenia" hidden><summary><span>Ostatnie zdarzenia</span><small>ruch i dźwięk</small><b id="desktopEventCount">—</b></summary></details>`;
  if (context.parentElement) context.insertAdjacentElement("afterend", overview);
  const homeGuide = document.createElement("section");
  homeGuide.className = "desktopHomeGuide";
  homeGuide.id = "desktopHomeGuide";
  homeGuide.setAttribute("aria-label", "Najważniejsze funkcje pulpitu");
  homeGuide.innerHTML = `<div><h2>Twój podgląd i nagrania</h2><p id="desktopHomeOperation" role="status">Oczekiwanie na aktualny stan urządzenia.</p></div><nav aria-label="Skróty pulpitu"><button type="button" data-home-view="controls">Sterowanie kamerą</button><button type="button" data-home-view="archive">Nagrania</button><button type="button" data-home-view="diagnostics">Sprawdź stan</button></nav>`;
  overview.insertAdjacentElement("beforebegin", homeGuide);
  const liveTile = overview.querySelector(".desktopCameraLive");
  if (liveStage && liveTile) liveTile.append(liveStage);
  clarifyConnectionText();
  // Projekt „Monitoring domu”: przyciski na obrazie, miniatura kamery, karty pod obrazem.
  mountLiveOverlay(liveStage, { video: $("video"), onMore: () => setActive("settings") });
  mountRecentEvents(overview.querySelector(".hsEventsCard"), { limit: 4, onAll: () => setActive("events") });
  $("hsRecCard").addEventListener("click", () => $("hsQuickRecord").click());
  const paintClock = () => { const now = new Date(); $("hsDate").textContent = now.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); $("hsTime").textContent = now.toLocaleTimeString("pl-PL"); };
  paintClock(); setInterval(paintClock, 1000);
  $("hsQuickRecord").addEventListener("click", () => { const recording = systemStore.read("recording", 45000).status === "recording"; ($(recording ? "ctrlStop" : "ctrlStart"))?.click(); });
  $("hsQuickSnap").addEventListener("click", () => overview.querySelector(".hsSnap")?.click());
  $("hsQuickArchive").addEventListener("click", () => setActive("archive"));
  $("hsStatusRow").addEventListener("click", () => setActive("diagnostics"));
  $("hsSideStatus").addEventListener("click", () => setActive("diagnostics"));
  $("hsStatusPill").addEventListener("click", () => setActive("controls"));
  $("hsHeadEvents").addEventListener("click", () => setActive("events"));
  $("hsHeadSettings").addEventListener("click", () => setActive("settings"));
  $("hsHeadTheme").addEventListener("click", () => {
    const light = !document.documentElement.classList.contains("hsLight");
    document.documentElement.classList.toggle("hsLight", light);
    try { localStorage.setItem("hs-theme-v1", light ? "light" : "dark"); } catch (_) { /* tryb prywatny */ }
  });
  overview.querySelectorAll("[data-hs-view]").forEach(b => b.addEventListener("click", () => setActive(b.dataset.hsView)));
  overview.querySelectorAll("[data-hs-settings]").forEach(b => b.addEventListener("click", () => { setActive("settings"); setTimeout(() => settingsScreen.querySelector(`[data-settings-group="${b.dataset.hsSettings}"]`)?.click(), 0); }));
  const paintDashboard = () => {
    const live = $("topStatus")?.classList.contains("live");
    const status = systemStatus({ live });
    for (const id of ["hsStatusPill", "hsStatusRow", "hsSideStatus"]) if ($(id)) $(id).dataset.tone = status.tone;
    $("hsStatusPillText").textContent = status.pill; $("hsStatusTitle").textContent = status.title; $("hsStatusDetail").textContent = status.detail;
    $("hsSideStatusTitle").textContent = status.title; $("hsSideStatusDetail").textContent = status.detail;
    const recording = systemStore.read("recording", 45000);
    const on = recording.status === "recording";
    const fresh = recording.freshness === "fresh";
    $("hsQuickRecord").classList.toggle("on", on); $("hsQuickRecord").querySelector("b").textContent = on ? "Zatrzymaj" : "Nagrywaj";
    $("hsRecCard").setAttribute("aria-checked", String(on)); $("hsRecCard").dataset.on = String(on);
    $("hsRecCardText").textContent = fresh ? (on ? "Aktywne" : "Zatrzymane") : "Brak danych";
    const events = systemStore.read("cameraEvents", 86400000).items || [];
    const cams = (cameraWorkspace ? cameraWorkspace.catalog.list().length : 0) + 1;
    const storage = systemStore.read("storage", 90000);
    const tone = (id, value) => { const card = overview.querySelector(`[data-stat="${id}"]`); if (card) card.dataset.tone = value; };
    $("hsStatCams").textContent = String(cams); $("hsStatCamsNote").textContent = live ? "Obraz na żywo" : "Brak obrazu"; tone("cams", live ? "ok" : "warn");
    $("hsStatRec").textContent = fresh ? (on ? "Aktywne" : "Zatrzymane") : "—"; $("hsStatRecNote").textContent = recording.lastFile ? `Ostatni plik: ${recording.lastFile}` : "Brak pliku"; tone("rec", on ? "ok" : recording.status === "error" ? "bad" : "warn");
    $("hsStatEvents").textContent = String(events.length); tone("events", events.length ? "alert" : "ok");
    $("hsStatSystem").textContent = live ? "Online" : "Offline"; $("hsStatSystemNote").textContent = status.title; tone("system", live ? "ok" : "warn");
    $("hsStatStorage").textContent = storage.name || storage.folderName || "—"; $("hsStatStorageNote").textContent = ({ready:"Zapis potwierdzony",permission_required:"Wymaga zgody",error:"Błąd dostępu",unselected:"Nie wybrano folderu"})[storage.status] || "Nie wybrano folderu"; tone("storage", storage.status === "ready" ? "ok" : storage.status === "error" ? "bad" : "warn");
    const good = ["recording","track_live","ready","healthy","connected","live","ok"], bad = ["error","failed","auth_required","degraded"];
    const list = $("hsStatusList"); list.replaceChildren();
    for (const card of diagnosticCards(systemStore.snapshot()).slice(0, 5)) {
      const row = document.createElement("li"); const state = good.includes(card.state) ? "ok" : bad.includes(card.state) ? "bad" : card.state === "unknown" || card.state === "stale" ? "none" : "warn";
      row.dataset.tone = state; const name = document.createElement("span"); name.textContent = card.name; const value = document.createElement("b");
      value.textContent = { ok: "Aktywne", bad: "Błąd", warn: "Oczekuje", none: "Brak danych" }[state]; value.title = card.detail; row.append(name, value); list.append(row);
    }
  };
  systemStore.subscribe(paintDashboard); setInterval(paintDashboard, 10000);
  new MutationObserver(paintDashboard).observe($("topStatus"), { attributes: true, attributeFilter: ["class"], childList: true });
  queueMicrotask(paintDashboard);
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
  eventsScreen.setAttribute("aria-label", "Zdarzenia");
  eventsScreen.innerHTML = '';
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
    <article><span class="desktopSummaryIcon">${iconMarkup('camera')}</span><div><b>Status kamer</b><strong id="desktopSummaryCamera">Sprawdzam…</strong><small id="desktopSummaryStatus">Oczekiwanie na dane</small></div></article>
    <article><span class="desktopSummaryIcon">${iconMarkup('recording')}</span><div><b>Nagrywanie</b><strong id="desktopSummaryRecording">Sprawdzam…</strong><small id="desktopSummaryLastFile">Nie potwierdzono zapisu pliku</small></div></article>
    <article><span class="desktopSummaryIcon">${iconMarkup('storage')}</span><div><b>Miejsce zapisu</b><strong id="desktopSummaryStorage">Sprawdzam…</strong><small id="desktopSummaryStorageDetail">Folder i dostęp do zapisu</small></div></article>`;
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
  const previewCaption=document.createElement("div");previewCaption.className="controlPreviewCaption";
  const previewTitle=document.createElement("span");previewTitle.textContent="Podgląd kamery";
  const previewFormat=document.createElement("output");previewFormat.setAttribute("aria-label","Rozdzielczość obrazu");
  const updatePreviewFormat=()=>{previewFormat.textContent=previewVideo.videoWidth?`${previewVideo.videoWidth} × ${previewVideo.videoHeight}`:"Oczekiwanie na sygnał";};
  previewVideo.addEventListener("loadedmetadata",updatePreviewFormat);previewVideo.addEventListener("resize",updatePreviewFormat);updatePreviewFormat();
  previewCaption.append(previewTitle,previewFormat);
  controlPreview.append(previewVideo,previewEmpty,previewCaption);
  const controlDeviceDock=document.createElement("aside");controlDeviceDock.className="controlDeviceDock";
  if ($("modeCard")) controlDeviceDock.append($("modeCard"));
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
    settingsHelp.querySelector("p").textContent=({picture:"Korekta podglądu zmienia wygląd obrazu na tym ekranie. Nie udaje sprzętowej regulacji obiektywu.",sound:"Wybierz obraz z dźwiękiem lub sam obraz. Mikrofon wymaga zgody na komputerze nadającym.",quality:"Wyższa jakość zwiększa rozmiar nagrań i obciążenie łącza. Faktyczne parametry odczytasz w Diagnostyce.",recording:"Harmonogram i długość segmentu dotyczą nowych nagrań. Zatrzymanie zapisu pozostawia podgląd na żywo.",detection:"Zdarzenia ruchu i dźwięku pojawią się w zakładce Zdarzenia. Nie są klasyfikacją osób ani pojazdów.",devices:"Podłącz urządzenie, wykryj je i wybierz z listy. Zmiana źródła wymaga dostępu do komputera.",access:"PIN odblokowuje panel. Dostęp do folderu oraz autoryzacja Google Drive są osobnymi zgodami.",application:"Program Windows działa bez Chrome. Aktualizacja jest pokazywana dopiero po wykryciu nowszej wersji."})[activeSettingsGroup]||"";
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
    homeGuide.hidden = true;
    settingsScreen.hidden = view !== "settings";
    controlsScreen.hidden = view !== "controls";
    eventsScreen.hidden = view !== "events";
    diagnosticsScreen.hidden = view !== "diagnostics";
    if(view==="controls"){controlDeviceDock.prepend(deviceManager);deviceManager.hidden=false;}
    const audioHud=$("audioHud");if(audioHud)(view==="controls"?controlPreview:liveStage)?.append(audioHud);
    if (eventCard) { eventsDrawer.append(eventCard); eventCard.open = true; }
    if (layout) layout.hidden = true;
    context.querySelector(".desktopContextActions").hidden = view !== "live";
    // Pulpit ma być roboczy: kamera, zdarzenia i oś czasu — bez dodatkowych
    // kart diagnostycznych pod spodem. Ich dane są w module Diagnostyka.
    summary.hidden = view !== "controls";
    if (view === "live" && $("dvrCard")?.parentElement !== timelineDock) timelineDock.append($("dvrCard"));
    if (view === "live") $("dvrCard").hidden = false;
    if (view === "archive" && $("dvrCard")?.parentElement !== main) main?.prepend($("dvrCard"));
    const labels = {
      live: ["Pulpit", "Monitoring domu", "Twój system monitoringu i ochrony domu."],
      controls: ["Kamery", "Kamery i sterowanie", "Wybór kamery, tryb pracy, start i zatrzymanie zapisu."],
      events: ["Zdarzenia", "Zdarzenia", "Wykrycia ruchu i dźwięku. Transmisja i zapis działają dalej."],
      archive: ["Archiwum", "Nagrania DVR", "Odtwarzanie zapisanych nagrań i miejsce zapisu."],
      settings: ["Ustawienia", "Ustawienia kamery", "Obraz, dźwięk, nagrywanie, wykrywanie i dostęp."],
      diagnostics: ["Diagnostyka", "Stan systemu", "Stan kamery, zapisu, połączenia i dziennik zdarzeń."]
    };
    const label = labels[view] || labels.live;
    const crumb = context.querySelector("p");
    const heading = context.querySelector("h1");
    if (crumb) crumb.innerHTML = `${label[0]} <span>/</span> HOME SECURITY`;
    if (heading) { if (view === "live") heading.innerHTML = "Witaj w <em>HOME SECURITY</em>"; else heading.textContent = label[1]; }
    context.dataset.view = view;
    const subtitle = context.querySelector(".hsSubtitle");
    if (subtitle) subtitle.textContent = label[2];
    // Po opuszczeniu ustawień przywracamy komplet pól dla innych trybów
    // interfejsu; wybrana kategoria jest widoczna tylko w module Ustawienia.
    if (view === "settings") setSettingsGroup(activeSettingsGroup);
    if(view==="events"){window.scrollTo({top:0,behavior:"instant"});return;}
    if (["controls", "settings", "live", "diagnostics"].includes(view)) { window.scrollTo({top:0,behavior:"instant"}); return; }
    const target = { live: "desktopHomeGuide", controls: "ctrlBar", settings: "setCard", archive: "dvrCard" }[view];
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
  homeGuide.querySelectorAll("[data-home-view]").forEach(button => button.addEventListener("click", () => setActive(button.dataset.homeView)));
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
    const recordingState=systemStore.read('recording',45000),storageState=systemStore.read('storage',90000);
    const recordingLabels={recording:'Nagrywanie aktywne',waiting:'Oczekiwanie / harmonogram',idle:'Zapis zatrzymany',stopped:'Zapis zatrzymany',disabled:'Zapis wyłączony',error:'Błąd zapisu'};
    if ($("desktopSummaryRecording")) $("desktopSummaryRecording").textContent = recordingState.freshness==='fresh'?(recordingLabels[recordingState.status]||'Stan niepotwierdzony'):'Brak aktualnych danych';
    $("desktopSummaryLastFile").textContent=recordingState.lastFile?`Ostatni plik: ${recordingState.lastFile}`:'Nie potwierdzono zapisu pliku';
    $("desktopSummaryStorage").textContent=storageState.name||storageState.folderName||'Brak danych o folderze';
    $("desktopSummaryStorageDetail").textContent=storageState.message||({ready:'Dostęp do zapisu potwierdzony',permission_required:'Wymaga zatwierdzenia dostępu',error:'Błąd dostępu do folderu'}[storageState.status]||'Brak aktualnej telemetrii folderu');
    const operation=operatorStatus({isLive,recording:systemStore.read('recording',45000),storage:systemStore.read('storage',90000)});
    if ($("desktopTopStatusText")) $("desktopTopStatusText").textContent = operation.text;
    const homeOperation = $("desktopHomeOperation");
    if (homeOperation && homeOperation.textContent !== operation.text) homeOperation.textContent = operation.text;
    desktopTopStatus.classList.toggle("live", operation.severity==='active');
    desktopTopStatus.classList.toggle("warning", operation.severity==='warning');
    const settingsState = $("desktopSettingsLiveState");
    if (settingsState) { settingsState.textContent = isLive ? "● Na żywo" : "● oczekiwanie"; settingsState.classList.toggle("live", Boolean(isLive)); }
    const mediaSettings = document.querySelector("#video")?.srcObject?.getVideoTracks?.()[0]?.getSettings?.() || {};
    if ($("desktopSettingsDevice")) $("desktopSettingsDevice").textContent = `Kamera: ${mediaSettings.deviceId ? "PC Camera" : "brak transmisji"}`;
    if ($("desktopSettingsResolution")) $("desktopSettingsResolution").textContent = mediaSettings.width && mediaSettings.height ? `${mediaSettings.width} × ${mediaSettings.height}` : "Rozdzielczość: —";
    if ($("desktopSettingsFps")) $("desktopSettingsFps").textContent = mediaSettings.frameRate ? `${Math.round(mediaSettings.frameRate)} FPS` : "FPS: —";
    const events = systemStore.read("cameraEvents").items || [];
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

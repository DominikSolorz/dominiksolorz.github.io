// HOME SECURITY Mobile: osobny układ PWA dla właściciela.
// Przełącza tylko widoki istniejącej strony — transmisja i nagrywanie działają dalej.
// index.html wybiera tryb urządzenia przed narysowaniem strony. To obejmuje
// aplikację instalowaną oraz zwykły Chrome na telefonie/tablecie.
import { createRouter } from "./core/router.mjs";
import { mountEventWorkspace, mountDiagnosticWorkspace } from "./workspace-panels.mjs?v=2";
const isMobileOwnerApp = document.documentElement.classList.contains("mobileOwnerMode");

if (isMobileOwnerApp) {
  const byId = id => document.getElementById(id);
  const app = byId("app");
  document.body.classList.add("mobileOwnerMode");

  const mobileHeader = document.createElement("section");
  mobileHeader.className = "mobileAppHeader";
  mobileHeader.innerHTML = `
    <img class="mobileBrandLogo" src="assets/ds-logo.jpg" alt="DS"><div><h1 id="mobilePageTitle">Dom</h1><p><i></i><span id="mobileOnline">Sprawdzam połączenie…</span></p></div>
    <button id="deviceLayoutBtn" type="button" aria-label="Zmień układ urządzenia"><span>▣</span><b>Telefon</b></button>
    <div class="mobileRelease"><small id="mobileBuild"></small><button type="button" data-web-update>Sprawdź aktualizację</button><span id="mobileUpdateStatus" role="status" aria-live="polite"></span></div>`;
  app?.insertBefore(mobileHeader, app.firstChild);
  const platformName=({android:'Android',ios:'iPhone / iPad'})[document.documentElement.dataset.phonePlatform]||'Telefon';
  byId('deviceLayoutBtn').querySelector('b').textContent=platformName;
  byId('mobileBuild').textContent=`Panel ${document.querySelector('meta[name="home-security-build"]')?.content||'—'} · ${platformName}`;
  mobileHeader.querySelector('[data-web-update]').addEventListener('click',()=>document.dispatchEvent(new Event('hs-check-web-update')));
  document.dispatchEvent(new Event('hs-web-update-ui-ready'));

  const nav = document.createElement("nav");
  nav.className = "mobileBottomNav";
  nav.setAttribute("aria-label", "Nawigacja mobilna");
  nav.innerHTML = `
    <button class="active" type="button" data-mobile-view="home"><b>⌂</b><span>Dom</span></button>
    <button type="button" data-mobile-view="alerts"><b>♧</b><span>Alarmy</span></button>
    <button type="button" data-mobile-view="recordings"><b>▷</b><span>Nagrania</span></button>
    <button type="button" data-mobile-view="settings"><b>⚙</b><span>Ustawienia</span></button>`;
  document.body.append(nav);

  const deviceSheet = document.createElement("section");
  deviceSheet.className = "deviceLayoutSheet";
  deviceSheet.hidden = true;
  deviceSheet.innerHTML = `
    <div class="deviceLayoutCard" role="dialog" aria-modal="true" aria-labelledby="deviceLayoutTitle">
      <button class="deviceLayoutClose" type="button" aria-label="Zamknij">×</button>
      <p>UKŁAD APLIKACJI</p><h2 id="deviceLayoutTitle">Na czym oglądasz?</h2>
      <span>Zmienia się tylko wielkość i układ ekranu. Nadajnik kamery pozostaje w programie Windows.</span>
      <div>
        <button type="button" data-ui-mode="phone"><b>▯</b><strong>Telefon</strong><small>duży obraz, dolna nawigacja, obsługa dotykiem</small></button>
        <button type="button" data-ui-mode="computer"><b>▣</b><strong>Komputer</strong><small>panel boczny, pełny pulpit i więcej informacji</small></button>
      </div>
    </div>`;
  document.body.append(deviceSheet);
  const setDeviceSheet = open => { deviceSheet.hidden = !open; if (open) deviceSheet.querySelector("[data-ui-mode='phone']")?.focus(); };
  byId("deviceLayoutBtn")?.addEventListener("click", () => setDeviceSheet(true));
  deviceSheet.addEventListener("click", event => {
    if (event.target === deviceSheet || event.target.closest(".deviceLayoutClose")) return setDeviceSheet(false);
    const button = event.target.closest("[data-ui-mode]");
    if (!button) return;
    try { localStorage.setItem("hs-ui-mode", button.dataset.uiMode); } catch (_) { /* tryb prywatny */ }
    const url = new URL(location.href);
    url.searchParams.set("ui", button.dataset.uiMode);
    location.assign(url.toString());
  });

  // Jedna brama do ustawień. Kategorie pokazują wyłącznie elementy, których dotyczą;
  // nie są kopią ekranów rozmieszczoną pod podglądem.
  const settingsHome = document.createElement("section");
  settingsHome.id = "mobileSettingsHome";
  settingsHome.className = "mobileSettingsHome";
  settingsHome.innerHTML = `
    <header><p class="eyebrow">USTAWIENIA</p><h2>Konfiguracja systemu</h2><p>Wybierz kategorię — podgląd i transmisja pozostają aktywne.</p></header>
    <div class="mobileSettingCategories">
      <button type="button" data-setting-section="image"><b>◉</b><span><strong>Obraz i jakość</strong><small>jasność, kolor, siatka, jakość</small></span><i>›</i></button>
      <button type="button" data-setting-section="sound"><b>◖</b><span><strong>Dźwięk</strong><small>mikrofon i źródło transmisji</small></span><i>›</i></button>
      <button type="button" data-setting-section="recording"><b>▣</b><span><strong>Nagrywanie</strong><small>tryb, jakość i długość zapisu</small></span><i>›</i></button>
      <button type="button" data-setting-section="system"><b>⌘</b><span><strong>System i diagnostyka</strong><small>połączenie, stan i kontrola</small></span><i>›</i></button>
    </div>`;
  document.querySelector(".mainCol")?.append(settingsHome);
  const backSettings = document.createElement("button");
  backSettings.type = "button";
  backSettings.className = "mobileSettingsBack";
  backSettings.textContent = "← Kategorie ustawień";
  document.querySelector(".mainCol")?.prepend(backSettings);
  backSettings.addEventListener("click", () => { document.body.dataset.mobileSettings = "root"; });

  const views = {
    home: ["stage", "watchPanel"],
    alerts: ["mobileEventsWorkspace"],
    recordings: ["dvrCard", "dvrListCard", "mobileRecordingStorage"],
    settings: ["modeCard", "systemPanel", "setCard", "diagCard", "mobileDiagnosticWorkspace"]
  };
  const eventsWorkspace=document.createElement("section");eventsWorkspace.id="mobileEventsWorkspace";eventsWorkspace.className="card mobileHidden";mountEventWorkspace(eventsWorkspace);
  const diagnosticWorkspace=document.createElement("section");diagnosticWorkspace.id="mobileDiagnosticWorkspace";diagnosticWorkspace.className="card mobileHidden";mountDiagnosticWorkspace(diagnosticWorkspace);
  document.querySelector(".mainCol")?.append(eventsWorkspace,diagnosticWorkspace);
  const recordingStorage = document.createElement("details");
  recordingStorage.id = "mobileRecordingStorage";
  recordingStorage.className = "card mobileRecordingStorage mobileHidden";
  recordingStorage.open = true;
  recordingStorage.innerHTML = `<summary>Zapis i kopia Drive</summary>
    <p id="mobileRecordingState" role="status">Oczekuję na stan komputera nagrywającego.</p>
    <p class="muted small">Nagrania są zapisywane na komputerze z kamerą. Z telefonu zarządzasz miejscem wcześniej zatwierdzonym na komputerze.</p>
    <div id="mobileRecordingFolderControls"><button type="button" id="mobileChooseComputerFolder">📁 Wybierz folder komputera</button></div>
    <p class="muted small">Komputer musi być włączony. Widzisz miejsce wcześniej zatwierdzone w programie Windows; możesz otwierać podfoldery, tworzyć je i wybierać miejsce zapisu.</p>`;
  document.querySelector(".mainCol")?.append(recordingStorage);
  const managed = [...new Set([...Object.values(views).flat(),"viewEventsCard"])];

  function renderView(view) {
    byId("mobilePageTitle").textContent = ({ home: "Dom", alerts: "Alarmy", recordings: "Nagrania", settings: "Ustawienia" })[view] || "Dom";
    const visible = new Set(views[view] || views.home);
    document.body.dataset.mobileView = view;
    document.body.dataset.mobileSettings = view === "settings" ? "root" : "";
    settingsHome.classList.toggle("mobileHidden", view !== "settings");
    managed.forEach(id => {
      const el = byId(id);
      if (!el) return;
      el.classList.toggle("mobileHidden", !visible.has(id));
      if (visible.has(id) && (id === "dvrCard" || id === "dvrListCard")) el.hidden = false;
    });
    nav.querySelectorAll("button").forEach(button => {
      const active = button.dataset.mobileView === view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    try { sessionStorage.setItem("hs-mobile-view", view); } catch (_) { /* tryb prywatny */ }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const router = createRouter({ routes: Object.keys(views), render: renderView });
  const setView = view => router.navigate(view);
  nav.addEventListener("click", event => {
    const button = event.target.closest("button[data-mobile-view]");
    if (button) setView(button.dataset.mobileView);
  });
  settingsHome.addEventListener("click", event => {
    const button = event.target.closest("button[data-setting-section]");
    if (!button) return;
    document.body.dataset.mobileSettings = button.dataset.settingSection;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  const topStatus = byId("topStatus");
  const updateStatus = () => {
    const label = byId("mobileOnline");
    const connected = topStatus?.classList.contains("live");
    mobileHeader.classList.toggle("online", Boolean(connected));
    if (label && topStatus) label.textContent = connected ? "Transmisja aktywna" : topStatus.textContent?.trim() || "Sprawdzam połączenie…";
  };
  new MutationObserver(updateStatus).observe(topStatus || document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
  updateStatus();
  // Powrót z archiwum lub ustawień nie może wyrzucać użytkownika na początek.
  let initialView = "home";
  try { initialView = sessionStorage.getItem("hs-mobile-view") || "home"; } catch (_) { /* tryb prywatny */ }
  const requestedMobileView=new URLSearchParams(location.search).get('mobileView');
  if(Object.hasOwn(views,requestedMobileView))initialView=requestedMobileView;
  setTimeout(() => setView(views[initialView] ? initialView : "home"), 350);
}

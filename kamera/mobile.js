import {iconMarkup} from "./ui-icons.mjs?v=1";
// HOME SECURITY Mobile: osobny układ PWA dla właściciela.
// Przełącza tylko widoki istniejącej strony — transmisja i nagrywanie działają dalej.
// index.html wybiera tryb urządzenia przed narysowaniem strony. To obejmuje
// aplikację instalowaną oraz zwykły Chrome na telefonie/tablecie.
import { createRouter } from "./core/router.mjs";
import { mountMobileCameraFrame } from './mobile-camera-frame.mjs?v=1';
import { mountMobileCameraInfo } from './mobile-camera-status.mjs?v=1';
import { createViewMemory } from './core/view-memory.mjs?v=1';
import { mountEventWorkspace, mountDiagnosticWorkspace } from "./workspace-panels.mjs?v=2";
const isMobileOwnerApp = document.documentElement.classList.contains("mobileOwnerMode");

if (isMobileOwnerApp) {
  const byId = id => document.getElementById(id);
  const app = byId("app");
  document.body.classList.add("mobileOwnerMode");
  document.querySelectorAll('#authDialog .authBrand img, #lock .pinLogo img').forEach(image => {
    image.src = 'assets/mobile-app-mark.svg';
    image.alt = 'HOME SECURITY';
  });
  const disposeCameraFrame=mountMobileCameraFrame(byId('stage'),byId('video'));
  window.addEventListener('pagehide',event=>{if(!event.persisted)disposeCameraFrame();});
  const cameraInfo=mountMobileCameraInfo({stage:byId('stage'),video:byId('video'),statusNode:byId('topStatus')});
  // Keep original media/control nodes: changing orientation must never reopen the camera.
  const zoomControls=byId('zoomBar');
  if(zoomControls){zoomControls.classList.add('mobileZoomControls');byId('stage').after(zoomControls);}
  const listeningControls=byId('audioHud');
  if(listeningControls){listeningControls.classList.add('mobileListeningControls');(zoomControls||byId('stage')).after(listeningControls);}
  byId('watchPanel')?.after(cameraInfo.element);
  const infoToggle=document.createElement('button');
  infoToggle.type='button';infoToggle.className='mobileCameraInfoToggle';infoToggle.textContent='Szczegóły';
  infoToggle.setAttribute('aria-expanded','false');infoToggle.setAttribute('aria-label','Pokaż szczegóły kamery');
  infoToggle.addEventListener('click',()=>{const expanded=cameraInfo.element.classList.toggle('expanded');infoToggle.setAttribute('aria-expanded',String(expanded));infoToggle.textContent=expanded?'Zwiń':'Szczegóły';});
  cameraInfo.element.append(infoToggle);
  window.addEventListener('pagehide',event=>{if(!event.persisted)cameraInfo.dispose();});

  const mobileHeader = document.createElement("section");
  mobileHeader.className = "mobileAppHeader";
  mobileHeader.innerHTML = `
    <img class="mobileBrandLogo" src="assets/mobile-app-mark.svg" width="48" height="48" alt="DS"><div><span class="mobileBrandName">HOME <b>SECURITY</b></span><h1 id="mobilePageTitle">Pulpit</h1><p><i></i><span id="mobileOnline">Sprawdzam połączenie…</span></p></div>
    <button id="mobileMenuBtn" type="button" aria-label="Otwórz menu" aria-controls="mobileMenuPage" aria-expanded="false">•••</button>`;
  app?.insertBefore(mobileHeader, app.firstChild);
  const makePage = (id, title, intro, content) => {
    const page = document.createElement('section');
    page.id = id; page.className = 'mobileFunctionPage mobileHidden';
    page.innerHTML = `<header class="mobileFunctionHeading"><h2>${title}</h2><p>${intro}</p></header>${content}`;
    document.querySelector('.mainCol')?.append(page);
    return page;
  };
  const menuPage = makePage('mobileMenuPage','Menu','Wybierz funkcję. Każda otwiera osobny ekran.',`
    <div class="mobileFunctionLinks">
      <button type="button" data-open-mobile-view="home">Pulpit <span>›</span></button>
      <button type="button" data-open-mobile-view="camera">Kamery <span>›</span></button>
      <button type="button" data-open-mobile-view="recordings">Nagrania <span>›</span></button>
      <button type="button" data-open-mobile-view="cloud">Chmura i miejsce zapisu <span>›</span></button>
      <button type="button" data-open-mobile-view="settings">Ustawienia <span>›</span></button>
      <button type="button" data-open-mobile-view="appearance">Wygląd i urządzenie <span>›</span></button>
      <button type="button" data-open-mobile-view="updates">Aktualizacje i wersja <span>›</span></button>
      <button type="button" data-open-mobile-view="playback">Mini-okno kamery <span>›</span></button>
      <a href="https://dominiksolorz.github.io/kamera/dokumenty.html" target="_blank" rel="noopener">Instrukcja i dokumenty ↗</a>
    </div><div class="mobileAccountOptions"></div>`);
  const updatesPage = makePage('mobileUpdatesPage','Aktualizacje','Sprawdź dostępność nowej wersji panelu.',
    '<p id="mobileBuild"></p><button type="button" data-web-update>Sprawdź aktualizacje</button><p id="mobileUpdateStatus" role="status" aria-live="polite"></p><button type="button" data-open-project-gallery>Projekty interfejsu</button>');
  makePage('mobilePlaybackPage','Mini-okno kamery','Ustaw zachowanie podglądu po przełączeniu aplikacji.','<div class="mobileOptionsBody"></div>');
  // Retain the original profile/logout controls and their security handlers.
  const accountOptions=menuPage.querySelector('.mobileAccountOptions');
  const moveAccountActions=()=>{const actions=mobileHeader.querySelector('.accountActions');if(actions)accountOptions.append(actions);};
  const accountObserver=new MutationObserver(moveAccountActions);accountObserver.observe(mobileHeader,{childList:true});moveAccountActions();
  window.addEventListener('pagehide',event=>{if(!event.persisted)accountObserver.disconnect();});
  const platformName=({android:'Android',ios:'iPhone / iPad'})[document.documentElement.dataset.phonePlatform]||'Telefon';
  byId('mobileBuild').textContent=`Panel ${document.querySelector('meta[name="home-security-build"]')?.content||'—'} · ${platformName}`;
  updatesPage.querySelector('[data-web-update]').addEventListener('click',()=>document.dispatchEvent(new Event('hs-check-web-update')));
  document.dispatchEvent(new Event('hs-web-update-ui-ready'));
  const backHome=document.createElement('button');
  backHome.type='button';backHome.id='mobileBackHome';backHome.textContent='← Wróć do pulpitu';backHome.hidden=true;
  document.querySelector('.mainCol')?.prepend(backHome);

  const deviceSheet = document.createElement("section");
  deviceSheet.id = "mobileAppearancePage";
  deviceSheet.className = "mobileFunctionPage mobileAppearance mobileHidden";

  deviceSheet.innerHTML = `
    <div class="deviceLayoutCard" aria-labelledby="deviceLayoutTitle">
      <p>UKŁAD APLIKACJI</p><h2 id="deviceLayoutTitle">Na czym oglądasz?</h2>
      <span>Zmienia się tylko wielkość i układ ekranu. Nadajnik kamery pozostaje w programie Windows.</span>
      <div>
        <button type="button" data-ui-mode="auto"><b>↔</b><strong>Automatycznie</strong><small>dopasuj do tego urządzenia i ekranu — zalecane</small></button>
        <button type="button" data-ui-mode="phone"><b>▯</b><strong>Telefon</strong><small>duży obraz, osobne ekrany, obsługa dotykiem</small></button>
        <button type="button" data-ui-mode="computer"><b>▣</b><strong>Komputer</strong><small>panel boczny, pełny pulpit i więcej informacji</small></button>
      </div>
    </div>`;
  document.querySelector(".mainCol")?.append(deviceSheet);
  deviceSheet.addEventListener("click", event => {
    const button = event.target.closest("[data-ui-mode]");
    if (!button) return;
    const automatic = button.dataset.uiMode === "auto";
    try {
      localStorage.setItem("hs-layout-mode-v2", automatic ? "auto" : "manual");
      localStorage.setItem("hs-layout-choice-v2", automatic ? "" : button.dataset.uiMode);
    } catch (_) { /* tryb prywatny */ }
    const url = new URL(location.href);
    ["ui", "view", "desktop"].forEach(key=>url.searchParams.delete(key));
    url.searchParams.set("layout", automatic ? "auto" : "manual");
    if (!automatic) url.searchParams.set("ui", button.dataset.uiMode);
    location.assign(url.toString());
  });

  // Jedna brama do ustawień. Kategorie pokazują wyłącznie elementy, których dotyczą;
  // nie są kopią ekranów rozmieszczoną pod podglądem.
  const settingsHome = document.createElement("section");
  settingsHome.id = "mobileSettingsHome";
  settingsHome.className = "mobileSettingsHome";
  settingsHome.innerHTML = `
    <header class="settingsTitle"><div><h2>Ustawienia</h2><p>Dostosuj swój system</p></div></header>
    <div class="mobileSettingCategories">
      <button type="button" data-setting-section="controls"><b>▣</b><span><strong>Urządzenia i kamery</strong><small>Połączone źródła obrazu</small></span><i>›</i></button>
      <button type="button" data-setting-section="image"><b>◉</b><span><strong>Obraz i dźwięk</strong><small>Jakość, mikrofon i odsłuch</small></span><i>›</i></button>
      <button type="button" data-setting-section="recording"><b>▤</b><span><strong>Nagrywanie i archiwum</strong><small>Zapis i przechowywanie</small></span><i>›</i></button>
      <button type="button" data-settings-events><b>♧</b><span><strong>Powiadomienia</strong><small>Zdarzenia i alerty</small></span><i>›</i></button>
      <button type="button" data-settings-remote><b>⌘</b><span><strong>Dostęp zdalny</strong><small>Komputer i połączenia</small></span><i>›</i></button>
      <button type="button" data-settings-account><b>◇</b><span><strong>Bezpieczeństwo</strong><small>Konto i kod PIN</small></span><i>›</i></button>
      <a href="https://dominiksolorz.github.io/kamera/dokumenty.html" target="_blank" rel="noopener"><b>▧</b><span><strong>Prywatność i dokumenty</strong><small>Zgody i informacje</small></span><i>›</i></a>
    </div>
    <button id="deviceLayoutBtn" type="button" class="settingsAbout" data-open-mobile-view="appearance">Wygląd i urządzenie <span>›</span></button>
    <button type="button" class="settingsAbout" data-setting-section="system">ⓘ Informacje o aplikacji <span>›</span></button>
    <p class="settingsVersion">HOME SECURITY · ustawienia konta i urządzeń</p>`;
  document.querySelector(".mainCol")?.append(settingsHome);
  const backSettings = document.createElement("button");
  backSettings.type = "button";
  backSettings.className = "mobileSettingsBack";
  backSettings.textContent = "← Kategorie ustawień";
  const mediaTabs = document.createElement("div");
  mediaTabs.className = "mobileMediaTabs";
  mediaTabs.innerHTML = '<button type="button" data-setting-section="image">Obraz</button><button type="button" data-setting-section="sound">Dźwięk</button>';
  document.querySelector(".mainCol")?.prepend(mediaTabs);
  document.querySelector(".mainCol")?.prepend(backSettings);
  backSettings.addEventListener("click", () => { document.body.dataset.mobileSettings = "root"; });

  const overview = document.createElement("section");
  overview.id = "mobileOverview";
  overview.className = "mobileOverview mobileHidden";
  overview.innerHTML = `
    <section class="mobileOverviewCard" aria-labelledby="mobileOverviewTitle">
      <h2 id="mobileOverviewTitle">Witaj w HOME SECURITY</h2>
    </section>
    <section class="mobileOverviewActions" aria-label="Skróty panelu">
      <button type="button" data-open-mobile-view="camera"><b>${iconMarkup('camera')}</b><span><strong>Kamery</strong></span></button>
      <button type="button" data-open-mobile-view="recordings"><b>${iconMarkup('archive')}</b><span><strong>Nagrania</strong></span></button>
      <button type="button" data-open-mobile-view="alerts"><b>${iconMarkup('alerts')}</b><span><strong>Zdarzenia</strong></span></button>
      <button type="button" data-open-mobile-view="settings"><b>${iconMarkup('settings')}</b><span><strong>Ustawienia</strong></span></button>
      <button type="button" data-open-mobile-view="cloud"><b>${iconMarkup('cloud')}</b><span><strong>Chmura</strong></span></button>
      <button type="button" data-open-mobile-profile><b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M4 21c0-8 16-8 16 0"/></svg></b><span><strong>Profil</strong></span></button>
    </section>
    <p class="mobileOverviewStatus" id="mobileOverviewStatus" role="status">Podgląd kamery nie został uruchomiony.</p>
    <p class="mobileOverviewHint">Obraz nie włącza się sam po zalogowaniu. Otwórz go świadomie w zakładce Kamery.</p>`;
  document.querySelector(".mainCol")?.prepend(overview);

  const views = {
    home: ["mobileOverview"],
    camera: ["mobileCameraInfo", "stage", "zoomBar", "audioHud", "watchPanel"],
    alerts: ["mobileEventsWorkspace"],
    recordings: ["dvrCard", "dvrListCard"],
    cloud: ["mobileCloudHeading", "mobileRecordingStorage"],
    menu: ["mobileMenuPage"],
    appearance: ["mobileAppearancePage"],
    updates: ["mobileUpdatesPage"],
    playback: ["mobilePlaybackPage"],
    settings: ["modeCard", "ctrlBar", "systemPanel", "setCard", "diagCard", "mobileDiagnosticWorkspace"]
  };
  const viewMemory=createViewMemory({key:'hs-mobile-view-v2',routes:Object.keys(views),fallback:'home'});
  const eventsWorkspace=document.createElement("section");eventsWorkspace.id="mobileEventsWorkspace";eventsWorkspace.className="card mobileHidden";mountEventWorkspace(eventsWorkspace);
  const diagnosticWorkspace=document.createElement("section");diagnosticWorkspace.id="mobileDiagnosticWorkspace";diagnosticWorkspace.className="card mobileHidden";mountDiagnosticWorkspace(diagnosticWorkspace);
  document.querySelector(".mainCol")?.append(eventsWorkspace,diagnosticWorkspace);
  makePage('mobileCloudHeading','Chmura i miejsce zapisu','Wybierz, gdzie komputer zapisuje i wysyła nagrania.','');
  const recordingStorage = document.createElement("details");
  recordingStorage.id = "mobileRecordingStorage";
  recordingStorage.className = "card mobileRecordingStorage mobileHidden";
  recordingStorage.open = true;
    recordingStorage.innerHTML = `<summary>Miejsce zapisu nagrań</summary>
    <p id="mobileRecordingState" role="status">Oczekuję na stan komputera nagrywającego.</p>
    <details class="localRecordingDetails"><summary>Szczegóły zapisu i diagnostyka</summary><p id="mobileRecordingDetails"></p><p class="muted small">Starsza kolejka w szczegółach pochodzi z panelu komputera. Aktualny stan miejsca zapisu i wysyłania pokazuje panel powyżej.</p></details>
    <p class="muted small">Wybierz komputer, Google Drive albo oba miejsca. Telefon przekazuje ustawienie do komputera z kamerą.</p>
    <div id="mobileRecordingFolderControls"><button type="button" id="mobileChooseComputerFolder">📁 Wybierz folder komputera</button></div>
    <p class="muted small">Komputer musi być włączony. Widzisz miejsce wcześniej zatwierdzone w programie Windows; możesz otwierać podfoldery, tworzyć je i wybierać miejsce zapisu.</p>`;
  document.querySelector(".mainCol")?.append(recordingStorage);
  const managed = [...new Set([...Object.values(views).flat(),"viewEventsCard"])];

  function renderView(view) {
    byId("mobilePageTitle").textContent = ({ home: "Pulpit", camera: "Kamery", alerts: "Zdarzenia", recordings: "Nagrania", settings: "Ustawienia", cloud:"Chmura",menu:"Menu",appearance:"Wygląd",updates:"Aktualizacje",playback:"Mini-okno" })[view] || "Panel";
    const visible = new Set(views[view] || views.home);
    document.body.dataset.mobileView = view;
    document.body.dataset.mobileSettings = view === "settings" ? "root" : "";
    backHome.hidden = view === 'home';
    byId('mobileMenuBtn').setAttribute('aria-expanded',String(view==='menu'));
    byId('mobileMenuBtn').setAttribute('aria-label',view==='menu'?'Zamknij menu':'Otwórz menu');
    settingsHome.classList.toggle("mobileHidden", view !== "settings");
    document.getElementById("mobileOverviewStatus").textContent = view === "camera"
      ? "Podgląd kamery został otwarty."
      : "Podgląd kamery nie został uruchomiony.";
    managed.forEach(id => {
      const el = byId(id);
      if (!el) return;
      el.classList.toggle("mobileHidden", !visible.has(id));
      if (visible.has(id) && (id === "dvrCard" || id === "dvrListCard")) el.hidden = false;
    });
    try { sessionStorage.setItem("hs-mobile-view", view); } catch (_) { /* tryb prywatny */ }
    viewMemory.save(view);
    document.dispatchEvent(new CustomEvent("hs-mobile-view-change", { detail: { view } }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const router = createRouter({ routes: Object.keys(views), render: renderView });
  const setView = view => router.navigate(view);
  let beforeMenu='home';
  byId('mobileMenuBtn').addEventListener('click',()=>{
    if(router.current==='menu')return setView(beforeMenu);
    beforeMenu=router.current||'home';setView('menu');
  });
  backHome.addEventListener('click',()=>setView('home'));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&router.current==='menu')setView(beforeMenu);});
  app.addEventListener('click',event=>{
    const button=event.target.closest('[data-open-mobile-view]');
    if(button)setView(button.dataset.openMobileView);
  });
  overview.addEventListener("click", event => {
    if (event.target.closest('[data-open-mobile-profile]')) {
      accountOptions.querySelector('.accountActions > button')?.click();
    }
  });
  settingsHome.addEventListener("click", event => {
    if(event.target.closest('[data-settings-home]')) return setView('home');
    if(event.target.closest('[data-settings-events]')) return setView('alerts');
    if(event.target.closest('[data-settings-remote]')) return document.querySelector('.hsRemoteEntry')?.click();
    if(event.target.closest('[data-settings-account]')) return accountOptions.querySelector('.accountActions > button')?.click();
  });
  const openSettingSection = event => {
    const button = event.target.closest("button[data-setting-section]");
    if (!button) return;
    document.body.dataset.mobileSettings = button.dataset.settingSection;
    const title=({controls:'Sterowanie i zapis na komputerze',image:'Ustawienia obrazu',sound:'Ustawienia dźwięku',recording:'Ustawienia nagrywania',system:'Ustawienia systemu i diagnostyki'})[button.dataset.settingSection] || 'Ustawienia';
    const card=byId('setCard');
    if(card){card.setAttribute('aria-label',title);const heading=card.querySelector('h2');if(heading)heading.textContent=title;}
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  settingsHome.addEventListener("click", openSettingSection);
  byId("deviceLayoutBtn")?.addEventListener("click",()=>setView("appearance"));
  mediaTabs.addEventListener("click", openSettingSection);

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
  let legacyView = "home";
  try { legacyView = sessionStorage.getItem("hs-mobile-view") || "home"; } catch (_) { /* tryb prywatny */ }
  const requestedMobileView=new URLSearchParams(location.search).get('mobileView');
  const rememberedView=viewMemory.read(requestedMobileView,legacyView);
  const initialView=rememberedView === "camera" ? "home" : rememberedView;
  setTimeout(() => setView(views[initialView] ? initialView : "home"), 350);
}

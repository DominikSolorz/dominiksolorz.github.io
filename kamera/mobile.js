import {iconMarkup} from "./ui-icons.mjs?v=1";
// HOME SECURITY Mobile: osobny układ PWA dla właściciela.
// Przełącza tylko widoki istniejącej strony — transmisja i nagrywanie działają dalej.
// index.html wybiera tryb urządzenia przed narysowaniem strony. To obejmuje
// aplikację instalowaną oraz zwykły Chrome na telefonie/tablecie.
import { createRouter } from "./core/router.mjs";
import { mountMobileCameraFrame } from './mobile-camera-frame.mjs?v=1';
import { mountMobileCameraInfo } from './mobile-camera-status.mjs?v=1';
import { createViewMemory } from './core/view-memory.mjs?v=1';
import { mountEventWorkspace, mountDiagnosticWorkspace } from "./workspace-panels.mjs?v=5";
import { mountLocationMap } from "./mobile-map.mjs?v=8";
import { ICONS, mountRecentEvents, mountLiveOverlay, systemStatus } from "./home-dashboard.mjs?v=3";
import { systemStore } from "./core/store.mjs";
import { mirrorLivePreview } from "./workspace-panels.mjs?v=5";
// „Łączenie…” mówi więcej: z czym się łączymy (pomysł z rundy Replit).
const clarifyConnectionText=()=>{const node=document.getElementById("placeholder");if(!node)return;const fix=()=>{if(node.textContent.trim()==="Łączenie…")node.textContent="Łączenie z komputerem z kamerą…";};const watch=new MutationObserver(fix);watch.observe(node,{childList:true,characterData:true,subtree:true});fix();window.addEventListener("pagehide",()=>watch.disconnect(),{once:true});};
const isMobileOwnerApp = document.documentElement.classList.contains("mobileOwnerMode");

if (isMobileOwnerApp) {
  const byId = id => document.getElementById(id);
  const app = byId("app");
  document.body.classList.add("mobileOwnerMode");
  document.querySelectorAll('#authDialog .authBrand img, #lock .pinLogo img').forEach(image => {
    image.src = 'assets/hs-logo.webp';
    image.alt = 'HOME SECURITY';
  });
  const disposeCameraFrame=mountMobileCameraFrame(byId('stage'),byId('video'));
  clarifyConnectionText();
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
    <button id="mobileMenuBtn" type="button" aria-label="Otwórz menu" aria-controls="mobileMenuPage" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
    <div class="mobileBrandBlock"><img class="mobileBrandLogo" src="assets/hs-logo.webp" width="48" height="48" alt="HOME SECURITY"><div><span class="mobileBrandName">HOME <b>SECURITY</b></span><small class="mobileBrandSub">System Monitoringu Domowego</small><h1 id="mobilePageTitle">Pulpit</h1><p class="mobileOnlineLine"><i></i><span id="mobileOnline">Sprawdzam połączenie…</span></p></div></div>
    <div class="hsHeadActions"><button id="hsPhoneBell" class="hsPhoneBell" type="button" aria-label="Zdarzenia">${ICONS.bell}<span id="hsPhoneBellBadge" class="hsPhoneBadge" hidden>0</span></button><button id="hsPhoneAvatar" class="hsPhoneAvatar" type="button" data-open-mobile-profile aria-label="Mój profil"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="9" r="3.6"/><path d="M5.5 19.5c1.3-3.3 3.8-4.8 6.5-4.8s5.2 1.5 6.5 4.8"/></svg></button></div>`;
  app?.insertBefore(mobileHeader, app.firstChild);
  // Awatar w nagłówku pokazuje zdjęcie profilu, gdy użytkownik je dodał (zdarzenie z profilu / po zalogowaniu).
  document.addEventListener("hs-profile-avatar", event => {
    const button = byId("hsPhoneAvatar"), url = String(event.detail?.url || "");
    if (!button) return;
    button.classList.toggle("hasPhoto", Boolean(url));
    button.style.backgroundImage = url ? `url("${url.replace(/"/g, "%22")}")` : "";
  });
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
      <button type="button" data-open-mobile-profile>Mój profil <span>›</span></button>
      <button type="button" data-open-mobile-view="camera">Kamery <span>›</span></button>
      <button type="button" data-open-mobile-view="recordings">Nagrania <span>›</span></button>
      <button type="button" data-open-mobile-view="alerts">Zdarzenia <span>›</span></button>
      <button type="button" data-open-mobile-map>Mapa <span>›</span></button>
      <button type="button" data-open-mobile-view="cloud">Chmura i miejsce zapisu <span>›</span></button>
      <button type="button" data-open-mobile-view="settings">Ustawienia <span>›</span></button>
      <button type="button" data-open-mobile-view="appearance">Wygląd i urządzenie <span>›</span></button>
      <button type="button" data-open-mobile-view="updates">Aktualizacje i wersja <span>›</span></button>
      <button type="button" data-open-mobile-view="playback">Mini-okno kamery <span>›</span></button>
      <a href="https://dominiksolorz.github.io/kamera/dokumenty.html" target="_blank" rel="noopener">Instrukcja i dokumenty ↗</a>
      <a href="https://dominiksolorz.github.io/kamera/usun-konto.html" target="_blank" rel="noopener">Usuń konto i dane ↗</a>
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
  backHome.type='button';backHome.id='mobileBackHome';backHome.hidden=true;
  backHome.setAttribute('aria-label','Wróć do pulpitu');
  backHome.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg><span class="hsSrOnly">Wróć do pulpitu</span>';
  // Projekt: na podstronach nagłówek ma strzałkę „wstecz” i tytuł ekranu zamiast menu i logo.
  mobileHeader.prepend(backHome);

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
    </div>
    <div class="deviceLayoutCard" aria-labelledby="deviceThemeTitle">
      <p>MOTYW</p><h2 id="deviceThemeTitle">Ciemny czy jasny?</h2>
      <span>Zmienia tylko kolory panelu na tym urządzeniu.</span>
      <div>
        <button type="button" data-theme-mode="dark"><b>☾</b><strong>Ciemny</strong><small>czarny z czerwonymi akcentami — wygodny nocą</small></button>
        <button type="button" data-theme-mode="light"><b>☀</b><strong>Jasny</strong><small>biały z czerwonymi akcentami — czytelny w dzień</small></button>
      </div>
    </div>`;
  document.querySelector(".mainCol")?.append(deviceSheet);
  deviceSheet.addEventListener("click", event => {
    const themeButton = event.target.closest("[data-theme-mode]");
    if (themeButton) {
      const light = themeButton.dataset.themeMode === "light";
      document.documentElement.classList.toggle("hsLight", light);
      try { localStorage.setItem("hs-theme-v1", light ? "light" : "dark"); } catch (_) { /* tryb prywatny */ }
      return;
    }
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
      <button type="button" data-setting-section="controls"><b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg></b><span><strong>Urządzenia i kamery</strong><small>Połączone źródła obrazu</small></span><i>›</i></button>
      <button type="button" data-setting-section="image"><b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3.2"/><path d="M7 8h.01"/></svg></b><span><strong>Obraz i dźwięk</strong><small>Jakość, mikrofon i odsłuch</small></span><i>›</i></button>
      <button type="button" data-setting-section="recording"><b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/></svg></b><span><strong>Nagrywanie i archiwum</strong><small>Zapis i przechowywanie</small></span><i>›</i></button>
      <button type="button" data-settings-events><b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg></b><span><strong>Powiadomienia</strong><small>Zdarzenia i alerty</small></span><i>›</i></button>
      <button type="button" data-settings-remote><b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg></b><span><strong>Dostęp zdalny</strong><small>Komputer i połączenia</small></span><i>›</i></button>
      <button type="button" data-settings-account><b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6z"/><rect x="9" y="10.5" width="6" height="5" rx="1"/><path d="M10.2 10.5V9a1.8 1.8 0 0 1 3.6 0v1.5"/></svg></b><span><strong>Bezpieczeństwo</strong><small>Konto i kod PIN</small></span><i>›</i></button>
      <a href="https://dominiksolorz.github.io/kamera/dokumenty.html" target="_blank" rel="noopener"><b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4"/><path d="M9.5 12h6M9.5 15.5h6"/></svg></b><span><strong>Prywatność i dokumenty</strong><small>Zgody i informacje</small></span><i>›</i></a>
    </div>
    <button id="deviceLayoutBtn" type="button" class="settingsAbout" data-open-mobile-view="appearance">Wygląd i urządzenie <span>›</span></button>
    <button type="button" class="settingsAbout" data-setting-section="system">ⓘ Informacje o aplikacji <span>›</span></button>
    <p class="settingsVersion">HOME SECURITY · ustawienia konta i urządzeń</p>`;
  document.querySelector(".mainCol")?.append(settingsHome);
  const backSettings = document.createElement("button");
  backSettings.type = "button";
  backSettings.className = "mobileSettingsBack";
  backSettings.setAttribute("aria-label", "Kategorie ustawień");
  backSettings.innerHTML = backHome.innerHTML.replace("Wróć do pulpitu", "Kategorie ustawień");
  const mediaTabs = document.createElement("div");
  mediaTabs.className = "mobileMediaTabs";
  mediaTabs.innerHTML = '<button type="button" data-setting-section="image">Obraz</button><button type="button" data-setting-section="sound">Dźwięk</button>';
  document.querySelector(".mainCol")?.prepend(mediaTabs);
  mobileHeader.prepend(backSettings);
  backSettings.addEventListener("click", () => { document.body.dataset.mobileSettings = "root"; byId("mobilePageTitle").textContent = "Ustawienia"; });

  const overview = document.createElement("section");
  overview.id = "mobileOverview";
  overview.className = "mobileOverview mobileHidden";
  overview.innerHTML = `
    <section class="hsGuard" aria-label="Stan ochrony">
      <span class="hsGuardShield">${ICONS.shield}</span>
      <div class="hsGuardText"><h2 id="mobileOverviewTitle">System chroniony</h2><p><i class="hsDot" id="hsGuardDot"></i><span id="hsGuardState">Sprawdzam…</span></p><small id="hsGuardDetail">Oczekuję na stan komputera z kamerą.</small></div>
      <button type="button" class="hsSwitch" id="hsGuardSwitch" role="switch" aria-checked="false" aria-label="Nagrywanie na komputerze z kamerą"><i></i></button>
    </section>
    <section class="mobileOverviewActions hsTiles" aria-label="Skróty panelu">
      <button type="button" data-open-mobile-view="camera"><b>${iconMarkup('camera')}</b><span><strong>Kamery</strong><small id="hsTileCams">—</small></span></button>
      <button type="button" data-open-mobile-view="recordings"><b>${iconMarkup('archive')}</b><span><strong>Nagrania</strong><small id="hsTileRec">—</small></span></button>
      <button type="button" data-open-mobile-view="alerts"><b>${iconMarkup('alerts')}<em id="hsTileEventsBadge" class="hsPhoneBadge" hidden>0</em></b><span><strong>Zdarzenia</strong><small id="hsTileEvents">—</small></span></button>
      <button type="button" data-open-mobile-view="cloud"><b>${iconMarkup('cloud')}</b><span><strong>Chmura</strong><small>Miejsce zapisu</small></span></button>
      <button type="button" data-open-mobile-view="settings"><b>${iconMarkup('settings')}</b><span><strong>Ustawienia</strong><small>System</small></span></button>
    </section>
    <section class="hsPhoneLive" aria-labelledby="hsPhoneLiveTitle">
      <header class="hsCardHead"><h2 id="hsPhoneLiveTitle"><span class="hsHeadIco">${ICONS.record}</span>Podgląd kamer na żywo</h2><button type="button" class="hsLink" data-hs-go="camera">Wszystkie ›</button></header>
      <div class="hsPhoneCamGrid">
        <button type="button" class="hsPhoneLiveTile" id="hsPhoneLiveTile" data-hs-go="camera" aria-label="Otwórz podgląd na żywo">
          <video muted playsinline autoplay hidden></video>
          <span class="hsPhoneLiveEmpty"><span class="hsPlay">${ICONS.play}</span><b>Otwórz podgląd</b><small>Obraz nie włącza się sam po zalogowaniu</small></span>
          <span class="hsChip"><i class="hsDot" id="hsPhoneCamDot"></i>Kamera główna</span><span class="hsLiveBadge" id="hsPhoneLiveBadge" hidden>• NA ŻYWO</span><span class="hsFullIco">${ICONS.full}</span>
        </button>
      </div>
    </section>
    <section class="hsPhoneStats" aria-label="Stan urządzenia">
      <div class="hsPhoneStat"><span class="hsStatIco">${ICONS.storage}</span><div><b>Pamięć</b><strong id="hsPhoneStorage">—</strong><span class="hsBar"><i id="hsPhoneStorageBar"></i></span></div><em id="hsPhoneStoragePct"></em></div>
      <button type="button" class="hsPhoneStat" data-hs-go="settings"><span class="hsStatIco">${ICONS.signal}</span><div><b>Połączenie</b><strong><i class="hsDot" id="hsPhoneNetDot"></i><span id="hsPhoneNet">—</span></strong></div><span class="hsChevron">${ICONS.chevron}</span></button>
    </section>
    <section class="hsPhoneModes" aria-label="Tryby pracy">
      <button type="button" data-hs-mode="record">${ICONS.record}<span>Na żywo + zapis</span></button>
      <button type="button" data-hs-mode="rec-only">${ICONS.storage}<span>Tylko zapis</span></button>
      <button type="button" data-hs-mode="preview">${ICONS.camera}<span>Sam podgląd</span></button>
      <button type="button" data-hs-mode="off">${ICONS.bolt}<span>Wyłącz kamerę</span></button>
    </section>
    <section class="hsPhoneEvents" id="hsPhoneEvents"></section>
    <p class="mobileOverviewStatus" id="mobileOverviewStatus" role="status">Podgląd kamery nie został uruchomiony.</p>`;
  const mapCard = mountLocationMap();
  const mapTile = document.createElement("button");
  mapTile.type = "button";
  mapTile.className = "mobileMapTile";
  mapTile.innerHTML = '<b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg></b><span><strong>Mapa</strong></span>';
  mapTile.addEventListener("click", () => mapCard.querySelector(".mobileMapOpen").click());
  mapCard.classList.add("hsPhoneMapCard");
  overview.append(mapCard);
  document.querySelector(".mainCol")?.prepend(overview);
  // Projekt „Mój dom”: prawdziwe zdarzenia, stan transmisji, dolny pasek zakładek.
  mountRecentEvents(overview.querySelector("#hsPhoneEvents"), { limit: 3, onAll: () => setView("alerts") });
  mirrorLivePreview(byId("video"), overview.querySelector("#hsPhoneLiveTile video"), overview.querySelector(".hsPhoneLiveEmpty"));
  mountLiveOverlay(byId("stage"), { video: byId("video"), phone: true });
  const isNativeShell = /HomeSecurityNative/i.test(navigator.userAgent);
  const tabBar = document.createElement("nav");
  tabBar.className = "hsTabBar"; tabBar.setAttribute("aria-label", "Główne sekcje");
  const gridIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>';
  tabBar.innerHTML = [["home","Pulpit",ICONS.home],["camera","Kamery",ICONS.record],["recordings","Nagrania",ICONS.play],["alerts","Zdarzenia",ICONS.bell],["menu","Więcej",gridIcon]]
    .map(([v,l,i]) => `<button type="button" data-hs-tab="${v}">${i}<span>${l}</span></button>`).join("");
  if (!isNativeShell) { app?.append(tabBar); document.body.classList.add("hsHasTabBar"); }
  // Tablet (od 768 px): boczne menu zamiast dolnego paska — specyfikacja APK, ekrany 117–185.
  // Każda pozycja otwiera jeden istniejący ekran. Harmonogramu nie ma, bo ustawia się go tylko w programie Windows.
  const SIDE_PIN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>', SIDE_CLOUD='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.3 4.4 4.4 0 0 0 7 18Z"/></svg>', SIDE_USER='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="9" r="3.6"/><path d="M5.5 19.5c1.3-3.3 3.8-4.8 6.5-4.8s5.2 1.5 6.5 4.8"/></svg>';
  const sideNav = document.createElement("nav");
  sideNav.className = "hsSideNav"; sideNav.setAttribute("aria-label", "Menu boczne");
  sideNav.innerHTML = [
    ['data-hs-side="home"','Pulpit',ICONS.home],['data-hs-side="camera"','Kamery',ICONS.record],['data-hs-side="recordings"','Nagrania',ICONS.play],
    ['data-hs-side="alerts"','Zdarzenia',ICONS.bell],['data-open-mobile-map','Mapa',SIDE_PIN],
    ['data-hs-side="cloud"','Chmura',SIDE_CLOUD],['data-hs-side="settings"','Ustawienia',ICONS.gear],['data-open-mobile-profile','Profil',SIDE_USER]
  ].map(([attr,label,icon]) => `<button type="button" ${attr}>${icon}<span>${label}</span></button>`).join("")
    + '<a href="https://dominiksolorz.github.io/kamera/pomoc.html" target="_blank" rel="noopener"><span>Pomoc ↗</span></a><a href="https://dominiksolorz.github.io/kamera/o-systemie.html" target="_blank" rel="noopener"><span>Strona WWW ↗</span></a>';
  if (!isNativeShell) app?.append(sideNav);
  sideNav.addEventListener("click", event => {
    const b = event.target.closest("[data-hs-side]"); if (b) return setView(b.dataset.hsSide);
  });
  tabBar.addEventListener("click", event => {
    const b = event.target.closest("[data-hs-tab]"); if (!b) return;
    setView(b.dataset.hsTab);
  });
  // Tryby pracy: te same przyciski co w ustawieniach komputera (#modeCard).
  overview.addEventListener("click", event => { const b = event.target.closest("[data-hs-mode]"); if (b) document.querySelector(`#modeCard [data-mode="${b.dataset.hsMode}"]`)?.click(); });
  overview.querySelector("#hsGuardSwitch").addEventListener("click", () => {
    const recording = systemStore.read("recording", 45000).status === "recording";
    byId(recording ? "ctrlStop" : "ctrlStart")?.click();
  });
  let storageUse = null;
  const readStorage = () => navigator.storage?.estimate?.().then(e => { if (e?.quota) { storageUse = { usage: e.usage || 0, quota: e.quota }; paintPhone(); } }).catch(() => {});
  readStorage(); setInterval(readStorage, 60000);
  systemStore.subscribe(() => paintPhone());
  overview.addEventListener("click", event => { const b = event.target.closest("[data-hs-go]"); if (b) setView(b.dataset.hsGo); });
  document.addEventListener("hs-open-recordings-at", () => { if (router.current !== "recordings") setView("recordings"); });
  const size = bytes => bytes >= 1e12 ? `${(bytes / 1e12).toFixed(1)} TB` : bytes >= 1e9 ? `${Math.round(bytes / 1e9)} GB` : `${Math.max(1, Math.round(bytes / 1e6))} MB`;
  const setText = (id, text) => { const n = byId(id); if (n) n.textContent = text; };
  const paintPhone = () => {
    const live = Boolean(byId("topStatus")?.classList.contains("live"));
    const st = systemStatus({ live });
    const recording = systemStore.read("recording", 45000);
    const on = recording.status === "recording", fresh = recording.freshness === "fresh";
    const guard = overview.querySelector(".hsGuard"); if (guard) guard.dataset.tone = on ? "ok" : st.tone;
    setText("mobileOverviewTitle", on ? "System chroniony" : "Ochrona wyłączona");
    setText("hsGuardState", fresh ? (on ? "Aktywny" : "Nagrywanie wyłączone") : "Brak danych z komputera");
    setText("hsGuardDetail", st.detail);
    const sw = byId("hsGuardSwitch"); if (sw) { sw.setAttribute("aria-checked", String(on)); sw.dataset.on = String(on); }
    const events = systemStore.read("cameraEvents", 86400000).items || [];
    const storage = systemStore.read("storage", 90000);
    setText("hsTileCams", live ? "1 online" : "1 offline");
    setText("hsTileRec", Number.isFinite(storage.saved) ? storage.saved.toLocaleString("pl-PL") : "Archiwum");
    setText("hsTileEvents", events.length ? "Nowe" : "Brak");
    for (const id of ["hsTileEventsBadge", "hsPhoneBellBadge"]) { const n = byId(id); if (n) { n.textContent = String(events.length); n.hidden = !events.length; } }
    byId("hsPhoneCamDot")?.classList.toggle("on", live);
    const badge = byId("hsPhoneLiveBadge"); if (badge) badge.hidden = !live;
    setText("hsPhoneNet", navigator.onLine ? (live ? "Online" : "Brak obrazu") : "Brak internetu");
    byId("hsPhoneNetDot")?.classList.toggle("on", navigator.onLine && live);
    if (storageUse) {
      const pct = Math.min(100, Math.round(storageUse.usage / storageUse.quota * 100));
      setText("hsPhoneStorage", `${size(storageUse.usage)} / ${size(storageUse.quota)}`); setText("hsPhoneStoragePct", `${pct}%`);
      const bar = byId("hsPhoneStorageBar"); if (bar) bar.style.width = `${Math.max(2, pct)}%`;
    } else setText("hsPhoneStorage", "Pamięć aplikacji");
    overview.querySelectorAll("[data-hs-mode]").forEach(b => { const active = !!document.querySelector(`#modeCard [data-mode="${b.dataset.hsMode}"].on`); b.classList.toggle("on", active); b.setAttribute("aria-pressed", String(active)); });
  };
  window.addEventListener("online", () => paintPhone()); window.addEventListener("offline", () => paintPhone());
  const modeCard = byId("modeCard"); if (modeCard) new MutationObserver(() => paintPhone()).observe(modeCard, { subtree: true, attributes: true, attributeFilter: ["class"] });

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
  // Chmura: trzy przyciski zamiast listy i „Zastosuj”. Każdy ustawia to samo pole
  // [data-storage-mode] i wywołuje istniejące polecenie zapisu na komputerze z kamerą.
  const storageChoice = byId("recordingStorageChoice");
  const storageMode = storageChoice?.querySelector("[data-storage-mode]");
  const storageApply = storageChoice?.querySelector("[data-storage-apply]");
  if (storageChoice && storageMode && storageApply) {
    const pick = document.createElement("div");
    pick.className = "hsStoragePick"; pick.setAttribute("role", "group"); pick.setAttribute("aria-label", "Gdzie zapisywać nowe nagrania");
    pick.innerHTML = [["local","Komputer","Folder na dysku"],["cloud","Google Drive","Tylko chmura"],["both","Oba miejsca","Komputer i Drive"]]
      .map(([m,t,d]) => `<button type="button" data-storage-pick="${m}" aria-pressed="false"><strong>${t}</strong><small>${d}</small></button>`).join("");
    storageChoice.querySelector("h3")?.after(pick);
    const syncPick = () => pick.querySelectorAll("[data-storage-pick]").forEach(b => { b.setAttribute("aria-pressed", String(b.dataset.storagePick === storageMode.value)); b.disabled = storageMode.disabled; });
    pick.addEventListener("click", event => {
      const b = event.target.closest("[data-storage-pick]"); if (!b || b.disabled) return;
      storageMode.value = b.dataset.storagePick; syncPick(); storageApply.click();
    });
    const storageStatus = storageChoice.querySelector("[data-storage-status]");
    if (storageStatus) new MutationObserver(syncPick).observe(storageStatus, { childList: true, characterData: true, subtree: true });
    syncPick();
  }
  const managed = [...new Set([...Object.values(views).flat(),"viewEventsCard"])];

  function renderView(view) {
    byId("mobilePageTitle").textContent = ({ home: "Pulpit", camera: "Kamery", alerts: "Zdarzenia", recordings: "Nagrania", settings: "Ustawienia", cloud:"Chmura",menu:"Menu",appearance:"Wygląd",updates:"Aktualizacje",playback:"Mini-okno" })[view] || "Panel";
    const visible = new Set(views[view] || views.home);
    document.body.dataset.mobileView = view;
    document.querySelectorAll(".hsTabBar [data-hs-tab]").forEach(b => b.classList.toggle("active", b.dataset.hsTab === view));
    document.querySelectorAll(".hsSideNav [data-hs-side]").forEach(b => b.classList.toggle("active", b.dataset.hsSide === view));
    document.body.dataset.mobileSettings = view === "settings" ? "root" : "";
    backHome.hidden = view === 'home' || view === 'menu';
    byId('mobileMenuBtn').hidden = !(view === 'home' || view === 'menu');
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
  byId('hsPhoneBell')?.addEventListener('click',()=>setView('alerts'));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&router.current==='menu')setView(beforeMenu);});
  app.addEventListener('click',event=>{
    const button=event.target.closest('[data-open-mobile-view]');
    if(button)setView(button.dataset.openMobileView);
  });
  // Mapa z menu „Więcej”: ten sam pełnoekranowy widok z przyciskiem „‹ Wstecz”.
  app.addEventListener("click", event => {
    if (event.target.closest('[data-open-mobile-map]')) mapCard.querySelector(".mobileMapOpen")?.click();
  });
  app.addEventListener("click", event => {
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
    byId('mobilePageTitle').textContent=({controls:'Sterowanie',image:'Obraz',sound:'Dźwięk',recording:'Nagrywanie',system:'System'})[button.dataset.settingSection]||title;
    if(card){card.setAttribute('aria-label',title);const heading=card.querySelector('h2');if(heading)heading.textContent=title;}
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  settingsHome.addEventListener("click", openSettingSection);
  byId("deviceLayoutBtn")?.addEventListener("click",()=>setView("appearance"));
  mediaTabs.addEventListener("click", openSettingSection);

  const topStatus = byId("topStatus");
  const updateStatus = () => {
    paintPhone();
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

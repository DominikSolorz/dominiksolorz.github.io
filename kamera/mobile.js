// HOME SECURITY Mobile: osobny układ PWA dla właściciela.
// Przełącza tylko widoki istniejącej strony — transmisja i nagrywanie działają dalej.
const mobileParams = new URLSearchParams(location.search);
const isMobileOwnerApp = mobileParams.get("app") === "android";

if (isMobileOwnerApp) {
  const byId = id => document.getElementById(id);
  const app = byId("app");
  document.body.classList.add("mobileOwnerMode");

  const mobileHeader = document.createElement("section");
  mobileHeader.className = "mobileAppHeader";
  mobileHeader.innerHTML = `
    <div><h1>Dom</h1><p><i></i><span id="mobileOnline">System sprawdzam…</span></p></div>
    <button id="mobileMore" type="button" aria-label="Ustawienia">⚙</button>`;
  app?.insertBefore(mobileHeader, app.firstChild);

  const nav = document.createElement("nav");
  nav.className = "mobileBottomNav";
  nav.setAttribute("aria-label", "Nawigacja mobilna");
  nav.innerHTML = `
    <button class="active" type="button" data-mobile-view="home"><b>⌂</b><span>Dom</span></button>
    <button type="button" data-mobile-view="alerts"><b>♧</b><span>Alarmy</span></button>
    <button type="button" data-mobile-view="recordings"><b>▷</b><span>Nagrania</span></button>
    <button type="button" data-mobile-view="settings"><b>⚙</b><span>Ustawienia</span></button>`;
  document.body.append(nav);

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

  const views = {
    home: ["stage", "watchPanel", "dvrCard", "viewEventsCard"],
    alerts: ["viewEventsCard"],
    recordings: ["dvrCard", "dvrListCard"],
    settings: ["modeCard", "systemPanel", "setCard", "diagCard"]
  };
  const managed = [...new Set(Object.values(views).flat())];

  function setView(view) {
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  nav.addEventListener("click", event => {
    const button = event.target.closest("button[data-mobile-view]");
    if (button) setView(button.dataset.mobileView);
  });
  byId("mobileMore")?.addEventListener("click", () => setView("settings"));
  settingsHome.addEventListener("click", event => {
    const button = event.target.closest("button[data-setting-section]");
    if (!button) return;
    document.body.dataset.mobileSettings = button.dataset.settingSection;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  const topStatus = byId("topStatus");
  const updateStatus = () => {
    const label = byId("mobileOnline");
    if (label && topStatus) label.textContent = topStatus.textContent?.trim() === "● NA ŻYWO" ? "System online" : "Łączenie z kamerą…";
  };
  new MutationObserver(updateStatus).observe(topStatus || document.body, { childList: true, subtree: true, characterData: true });
  updateStatus();
  // app.js ustawia stan odbiorcy asynchronicznie; widok Dom jest wymuszony po starcie.
  setTimeout(() => setView("home"), 350);
}

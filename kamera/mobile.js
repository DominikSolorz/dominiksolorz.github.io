// HOME SECURITY Mobile: osobny układ PWA dla właściciela.
// Przełącza tylko widoki istniejącej strony — transmisja i nagrywanie działają dalej.
const mobileParams = new URLSearchParams(location.search);
const isMobileOwnerApp = mobileParams.get("app") === "android";

if (isMobileOwnerApp) {
  const byId = id => document.getElementById(id);
  const app = byId("app");
  const main = document.querySelector(".mainCol");

  document.body.classList.add("mobileOwnerMode");

  const mobileHeader = document.createElement("section");
  mobileHeader.className = "mobileAppHeader";
  mobileHeader.innerHTML = `
    <div><h1>Dom</h1><p><i></i><span id="mobileOnline">System sprawdzam…</span></p></div>
    <button id="mobileMore" type="button" aria-label="Ustawienia i więcej">⚙</button>`;
  app?.insertBefore(mobileHeader, app.firstChild);

  const nav = document.createElement("nav");
  nav.className = "mobileBottomNav";
  nav.setAttribute("aria-label", "Nawigacja mobilna");
  nav.innerHTML = `
    <button class="active" type="button" data-mobile-view="home"><b>⌂</b><span>Dom</span></button>
    <button type="button" data-mobile-view="alerts"><b>♧</b><span>Alarmy</span></button>
    <button type="button" data-mobile-view="recordings"><b>▷</b><span>Nagrania</span></button>
    <button type="button" data-mobile-view="more"><b>•••</b><span>Więcej</span></button>`;
  document.body.append(nav);

  const views = {
    home: ["stage", "watchPanel", "viewEventsCard"],
    alerts: ["viewEventsCard"],
    recordings: ["dvrCard", "dvrListCard"],
    // Jedno miejsce na sterowanie: karta trybu, stan i ustawienia obrazu.
    // Nie dublujemy tu dolnego Start/Stop ani przycisków podglądu z ekranu Dom.
    more: ["modeCard", "systemPanel", "setCard", "diagCard"]
  };
  const managed = [...new Set(Object.values(views).flat())];

  function setView(view) {
    const visible = new Set(views[view] || views.home);
    document.body.dataset.mobileView = view;
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
  byId("mobileMore")?.addEventListener("click", () => setView("more"));

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

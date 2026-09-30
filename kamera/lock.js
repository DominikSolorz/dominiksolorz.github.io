// Ekran blokady z klawiaturą PIN (telefon) i wpisywaniem z klawiatury (komputer).
import { unlock, savedKey } from "./access.js?v=14";

export function requireAccess() {
  const key = savedKey();
  if (key) return Promise.resolve(key);
  const root = document.getElementById("lock");
  root.hidden = false;
  const dots = root.querySelector(".pinDots");
  const msg = root.querySelector(".pinMsg");
  const remember = root.querySelector("#pinRemember");
  let pin = "", busy = false;

  const render = () => { dots.innerHTML = Array.from({ length: Math.max(6, pin.length) }, (_, i) => `<i class="${i < pin.length ? "on" : ""}"></i>`).join(""); };
  render();

  return new Promise(resolve => {
    async function submit() {
      if (busy || pin.length < 4) return;
      busy = true; msg.textContent = "Sprawdzam…"; msg.className = "pinMsg";
      const key = await unlock(pin, remember.checked);
      busy = false;
      if (key) { root.hidden = true; document.removeEventListener("keydown", onKey); resolve(key); return; }
      pin = ""; render(); msg.textContent = "Zły PIN. Spróbuj ponownie."; msg.className = "pinMsg bad";
      root.querySelector(".pinCard").classList.remove("shake"); void root.offsetWidth; root.querySelector(".pinCard").classList.add("shake");
    }
    function press(k) {
      if (busy) return;
      if (k === "del") pin = pin.slice(0, -1);
      else if (k === "ok") return submit();
      else if (pin.length < 12) pin += k;
      msg.textContent = ""; render();
      if (pin.length === 6) submit();
    }
    function onKey(e) {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("del");
      else if (e.key === "Enter") press("ok");
    }
    root.querySelectorAll("[data-k]").forEach(b => b.addEventListener("click", () => press(b.dataset.k)));
    document.addEventListener("keydown", onKey);
  });
}

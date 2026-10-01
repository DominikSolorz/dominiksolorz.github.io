// Lista nagrań: dzień → godzina → pliki (co 10 min), z usuwaniem pliku, godziny albo całego dnia.
// Ten sam widok działa na komputerze-kamerze (bezpośrednio na folderze) i na stronie z telefonu
// (przez komputer). `api` = { days(), day(d), remove(target), watchUrl(name) }.
const mb = n => `${(n / 1048576).toFixed(1)} MB`;
const timeOf = name => (/_(\d{2})-(\d{2})-(\d{2})\./.exec(name) || []).slice(1).join(":");
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };

export function mountLibrary(root, api) {
  let onlyEvents = false;
  async function share(file) {
    const url = api.watchUrl?.(file.name, file.id);
    try {
      if (navigator.share && url) await navigator.share({ title: `Nagranie z kamery ${file.name}`, text: "Prywatne nagranie z kamery", url });
      else if (url && navigator.clipboard) { await navigator.clipboard.writeText(url); alert("Skopiowano link. Wklej go w Messengerze, WhatsAppie, SMS-ie lub e-mailu."); }
      else alert("Otwórz nagranie i użyj przycisku pobierania, aby wysłać plik.");
    } catch (e) { if (e?.name !== "AbortError") alert(`Nie udało się przygotować udostępniania: ${e.message || e}`); }
  }
  async function del(target, what) {
    if (!confirm(`Usunąć ${what}? Nagranie trafi do kosza Google Drive (można je stamtąd przywrócić przez 30 dni).`)) return;
    try { await api.remove(target); await refresh(); }
    catch (e) { alert(`Nie udało się usunąć: ${e.message || e}`); }
  }

  async function renderDay(box, day) {
    box.replaceChildren(el("p", { className: "muted small", textContent: "Wczytuję…" }));
    try {
      const hours = await api.day(day);
      box.replaceChildren();
      if (!hours?.length) return box.append(el("p", { className: "muted small", textContent: "Brak nagrań w tym dniu." }));
      for (const h of hours) {
        const hh = h.hour.slice(0, 2);
        const list = el("ul", { className: "libFiles" });
        const shown = onlyEvents ? h.files.filter(f => f.ev?.ruch || f.ev?.dzwiek) : h.files;
        if (!shown.length) continue;
        for (const f of shown) {
          const watch = api.watchUrl ? el("a", { className: "btn ghost small", href: api.watchUrl(f.name, f.id), target: "_blank", rel: "noopener", textContent: "▶ Obejrzyj" }) : "";
          const rm = el("button", { className: "btn ghost small danger", textContent: "🗑", title: "Usuń to nagranie", onclick: () => del({ day, hour: h.hour, name: f.name }, `nagranie z ${day} ${timeOf(f.name)}`) });
          const shareBtn = el("button", { className: "btn ghost small", textContent: "📤 Udostępnij", title: "Wyślij ręcznie przez Messenger, WhatsApp, SMS lub e-mail", onclick: () => share(f) });
          const badges = [f.ev?.ruch ? `🏃${f.ev.ruch}` : "", f.ev?.dzwiek ? `🔊${f.ev.dzwiek}` : ""].filter(Boolean).join(" ");
          const label = el("span", { textContent: `${timeOf(f.name)} · ${mb(f.size)}` }, badges ? el("span", { className: "evBadge", title: "Wykryty ruch / dźwięk", textContent: badges }) : "");
          list.append(el("li", {}, label, el("span", { className: "libActions" }, watch, shareBtn, rm)));
        }
        const rmHour = el("button", { className: "btn ghost small danger", textContent: "🗑 godzina", onclick: () => del({ day, hour: h.hour }, `wszystkie nagrania z ${day}, godz. ${hh}:00–${hh}:59`) });
        box.append(el("div", { className: "libHour" }, el("div", { className: "libHead" }, el("b", { textContent: `🕐 ${hh}:00–${hh}:59 (${shown.length})` }), rmHour), list));
      }
      if (!box.children.length) box.append(el("p", { className: "muted small", textContent: "Brak nagrań z ruchem lub dźwiękiem w tym dniu." }));
    } catch (e) { box.replaceChildren(el("p", { className: "status", textContent: e.message || String(e) })); }
  }

  async function refresh() {
    root.replaceChildren(el("p", { className: "muted small", textContent: "Wczytuję listę nagrań…" }));
    try {
      const days = await api.days();
      const filter = el("input", { type: "checkbox", checked: onlyEvents, onchange: e => { onlyEvents = e.target.checked; root.querySelectorAll(".libDay[open]").forEach(d => d.dispatchEvent(new Event("toggle"))); } });
      root.replaceChildren(el("label", { className: "libFilter" }, filter, "Pokaż tylko nagrania z ruchem lub dźwiękiem (🏃 / 🔊)"));
      if (days === null) return root.append(el("p", { className: "status", textContent: "Komputer-kamera nie ma jeszcze dostępu do folderu Google Drive." }));
      if (!days.length) return root.append(el("p", { className: "muted small", textContent: "Brak nagrań." }));
      for (const d of days) {
        const box = el("div", { className: "libDayBody" });
        const rmDay = el("button", { className: "btn ghost small danger", textContent: "🗑 cały dzień", onclick: e => { e.preventDefault(); del({ day: d.day }, `wszystkie nagrania z dnia ${d.day}`); } });
        const det = el("details", { className: "libDay" }, el("summary", {}, el("b", { textContent: `📅 ${d.day}` }), el("span", { className: "muted small", textContent: ` ${d.count} nagr.` }), rmDay), box);
        det.addEventListener("toggle", () => { if (det.open) renderDay(box, d.day); });
        root.append(det);
      }
    } catch (e) { root.replaceChildren(el("p", { className: "status", textContent: e.message || String(e) })); }
  }

  refresh();
  return { refresh };
}

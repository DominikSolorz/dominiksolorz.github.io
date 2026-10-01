// Podgląd jak w rejestratorze (DVR) na telefonie: pod obrazem na żywo pasek czasu dnia z nagraniami z komputera-kamery,
// znaczniki ruchu 🏃 i dźwięku 🔊, szare przerwy (kamera nie nagrywała), przewijanie, „● NA ŻYWO”
// i biblioteka z przyciskami Udostępnij / Pobierz / ☁️ Wyślij na Google Drive.
// Pliki pobierane są z komputera przez kanał danych WebRTC (recproto.js) — działa też na internecie komórkowym.
const pad = n => String(n).padStart(2, "0");
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const hms = t => { const d = new Date(t); return `${hm(t)}:${pad(d.getSeconds())}`; };
const mb = n => `${(n / 1048576).toFixed(1)} MB`;
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids.filter(k => k !== null && k !== undefined && k !== "")); return e; };
const DAY_MS = 86400000;

export function mountDvr({ client, root, stage, liveVideo, toast }) {
  const playback = el("video", { className: "playback", playsInline: true, controls: true, hidden: true });
  playback.setAttribute("playsinline", "");
  stage.append(playback);
  const progressBadge = el("div", { className: "badge dvrBadge", hidden: true });
  stage.append(progressBadge);

  let day = dayKey(new Date()), files = [], now = Date.now(), zoom = "day", cursor = null, playing = null, refreshTimer = null;
  const cache = new Map(); // nazwa → Blob (ostatnie 3 pliki)

  // ----- układ -----
  const dateInput = el("input", { type: "date", className: "dvrDate", value: day, onchange: () => setDay(dateInput.value) });
  const liveBtn = el("button", { className: "btn primary small dvrLive", textContent: "● NA ŻYWO", onclick: () => goLive() });
  const zoomBtn = el("button", { className: "btn ghost small", textContent: "🔍 1 h", onclick: () => { zoom = zoom === "day" ? "hour" : "day"; zoomBtn.textContent = zoom === "day" ? "🔍 1 h" : "🔍 24 h"; draw(); } });
  const bar = el("div", { className: "dvrBar" });
  const segsLayer = el("div", { className: "dvrSegs" });
  const evLayer = el("div", { className: "dvrEvents" });
  const cursorEl = el("div", { className: "dvrCursor", hidden: true });
  const nowEl = el("div", { className: "dvrNow" });
  bar.append(segsLayer, evLayer, nowEl, cursorEl);
  const ticks = el("div", { className: "dvrTicks" });
  const timeLabel = el("span", { className: "dvrTime muted small" });
  const info = el("p", { className: "muted small dvrInfo" });
  const lib = el("div", { className: "libList" });
  const jump = sec => el("button", { className: "btn ghost small", textContent: sec < 0 ? `−${-sec / 60} min` : `+${sec / 60} min`, onclick: () => seekTo((cursor ?? now) + sec * 1000) });

  root.replaceChildren(
    el("div", { className: "cardHead" }, el("h2", { textContent: "⏪ Nagrania z kamery" }), liveBtn),
    el("div", { className: "dvrDays" },
      el("button", { className: "btn ghost small", textContent: "Dziś", onclick: () => setDay(dayKey(new Date())) }),
      el("button", { className: "btn ghost small", textContent: "Wczoraj", onclick: () => setDay(dayKey(new Date(Date.now() - DAY_MS))) }),
      dateInput, zoomBtn),
    bar, ticks,
    el("div", { className: "dvrJumps" }, jump(-300), jump(-60), timeLabel, jump(60), jump(300)),
    info,
    el("details", { className: "libDay dvrLibBox", open: false }, el("summary", {}, el("b", { textContent: "📼 Lista nagrań dnia" })), lib),
  );

  // ----- zakres paska -----
  const dayStart = () => { const [y, m, d] = day.split("-").map(Number); return new Date(y, m - 1, d).getTime(); };
  function range() {
    const s = dayStart();
    if (zoom === "day") return [s, s + DAY_MS];
    const c = cursor ?? Math.min(now, s + DAY_MS - 1);
    const from = Math.max(s, Math.min(c - 1800000, s + DAY_MS - 3600000));
    return [from, from + 3600000];
  }
  const pct = (t, [a, b]) => `${Math.max(0, Math.min(100, (100 * (t - a)) / (b - a)))}%`;

  function draw() {
    const r = range();
    segsLayer.replaceChildren(...files.map(f => el("div", {
      className: `dvrSeg${f.recording ? " rec" : ""}${f.uploaded ? " cloud" : ""}`,
      title: `${hm(f.start)}–${hm(f.end)}`,
      style: `left:${pct(f.start, r)};width:calc(${pct(f.end, r)} - ${pct(f.start, r)})`,
    })));
    const evs = files.flatMap(f => (f.events || []).map(e => ({ ...e, file: f })));
    evLayer.replaceChildren(...evs.filter(e => e.at >= r[0] && e.at <= r[1]).map(e => el("button", {
      className: "dvrEv", textContent: e.kind === "ruch" ? "🏃" : "🔊", title: `${e.kind === "ruch" ? "Ruch" : "Dźwięk"} ${hms(e.at)}`,
      style: `left:${pct(e.at, r)}`, onclick: ev => { ev.stopPropagation(); seekTo(e.at - 3000); },
    })));
    nowEl.hidden = !(now >= r[0] && now <= r[1]); nowEl.style.left = pct(now, r);
    cursorEl.hidden = cursor === null; if (cursor !== null) cursorEl.style.left = pct(cursor, r);
    const n = zoom === "day" ? 8 : 6, step = (r[1] - r[0]) / n;
    ticks.replaceChildren(...Array.from({ length: n + 1 }, (_, i) => el("span", { textContent: hm(r[0] + i * step), style: `left:${(100 * i) / n}%` })));
    timeLabel.textContent = cursor === null ? "na żywo" : hms(cursor);
  }

  // ----- przeciąganie po pasku -----
  let dragging = false;
  const timeAt = x => { const b = bar.getBoundingClientRect(), r = range(); return r[0] + ((x - b.left) / b.width) * (r[1] - r[0]); };
  bar.addEventListener("pointerdown", e => { dragging = true; bar.setPointerCapture(e.pointerId); cursor = timeAt(e.clientX); draw(); });
  bar.addEventListener("pointermove", e => { if (!dragging) return; cursor = timeAt(e.clientX); draw(); });
  const release = () => { if (!dragging) return; dragging = false; seekTo(cursor); };
  bar.addEventListener("pointerup", release); bar.addEventListener("pointercancel", release);

  // ----- odtwarzanie -----
  async function fetchFile(f) {
    if (cache.has(f.name)) return cache.get(f.name);
    progressBadge.hidden = false; progressBadge.textContent = `Pobieram ${hm(f.start)}… 0%`;
    try {
      const { blob } = await client.get(f.name, (got, size) => { progressBadge.textContent = `Pobieram ${hm(f.start)}… ${Math.round((100 * got) / size)}%`; });
      cache.set(f.name, blob);
      while (cache.size > 3) cache.delete(cache.keys().next().value);
      return blob;
    } finally { progressBadge.hidden = true; }
  }

  function showPlayback(on) {
    playback.hidden = !on; liveVideo.style.visibility = on ? "hidden" : "";
    liveBtn.classList.toggle("off", !on);
  }

  async function play(f, offsetMs = 0) {
    if (!f) return;
    if (f.recording) { toast("Ten fragment jeszcze się nagrywa — będzie do obejrzenia po zamknięciu pliku (co 10 min). Pokazuję obraz na żywo."); return goLive(); }
    try {
      const blob = await fetchFile(f);
      playing = f;
      if (playback.src) URL.revokeObjectURL(playback.src);
      playback.src = URL.createObjectURL(blob);
      showPlayback(true);
      await new Promise(res => { playback.onloadedmetadata = res; setTimeout(res, 3000); });
      if (offsetMs > 0) {
        // Pliki z nagrywania bywają bez długości — „przewinięcie na koniec” każe przeglądarce ją ustalić.
        if (!Number.isFinite(playback.duration)) { playback.currentTime = 1e9; await new Promise(r => setTimeout(r, 300)); }
        playback.currentTime = offsetMs / 1000;
      }
      playback.play().catch(() => {});
    } catch (e) { toast(`Nie udało się pobrać nagrania: ${e.message || e}`); }
  }

  function fileAt(t) { return files.find(f => t >= f.start && t < f.end) || null; }
  async function seekTo(t) {
    cursor = t; draw();
    const f = fileAt(t);
    if (!f) {
      const next = files.find(f2 => f2.start > t);
      if (next && next.start - t < 15 * 60000) return seekTo(next.start);
      return toast(`O ${hm(t)} kamera nie nagrywała (albo nagranie skasowała pętla zapisu).`);
    }
    play(f, t - f.start);
  }

  playback.addEventListener("timeupdate", () => { if (playing && !dragging) { cursor = playing.start + playback.currentTime * 1000; draw(); } });
  // Po końcu pliku od razu następny — ciągłe oglądanie.
  playback.addEventListener("ended", () => {
    const i = files.indexOf(playing);
    const next = files[i + 1];
    if (next && !next.recording && next.start - playing.end < 60000) play(next); else goLive();
  });

  function goLive() {
    playback.pause(); showPlayback(false); playing = null; cursor = null;
    if (day !== dayKey(new Date())) setDay(dayKey(new Date())); else draw();
  }

  // ----- biblioteka dnia -----
  async function share(f) {
    try {
      const blob = await fetchFile(f);
      const file = new File([blob], f.name, { type: blob.type || "video/mp4" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `Kamera ${day} ${hm(f.start)}` });
      else { download(blob, f.name); toast("Ten telefon nie udostępnia plików z przeglądarki — nagranie zostało pobrane."); }
    } catch (e) { if (e?.name !== "AbortError") toast(`Nie udało się udostępnić: ${e.message || e}`); }
  }
  function download(blob, name) {
    const a = el("a", { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }
  async function save(f) { try { download(await fetchFile(f), f.name); } catch (e) { toast(`Nie udało się pobrać: ${e.message || e}`); } }
  async function toDrive(f) {
    try { const r = await client.upload(f.name); toast(r.uploaded ? "To nagranie już jest na Google Drive." : "Wysyłam na Google Drive — komputer wyśle je w tle."); refresh(); }
    catch (e) { toast(`Nie udało się zlecić wysłania: ${e.message || e}`); }
  }

  function drawLib() {
    const real = files.filter(f => !f.recording);
    if (!real.length) return lib.replaceChildren(el("p", { className: "muted small", textContent: client.connected ? "Brak nagrań w tym dniu na komputerze." : "Łączę z kamerą…" }));
    const byHour = new Map();
    for (const f of real) { const h = new Date(f.start).getHours(); if (!byHour.has(h)) byHour.set(h, []); byHour.get(h).push(f); }
    lib.replaceChildren(...[...byHour].map(([h, list]) => el("div", { className: "libHour" },
      el("b", { textContent: `🕐 ${pad(h)}:00–${pad(h)}:59 (${list.length})` }),
      el("ul", { className: "libFiles" }, ...list.map(f => {
        const ruch = (f.events || []).filter(e => e.kind === "ruch").length, dzwiek = (f.events || []).filter(e => e.kind === "dzwiek").length;
        return el("li", {},
          el("span", { textContent: `${hm(f.start)}–${hm(f.end)} · ${mb(f.size || 0)}` }, ruch ? el("span", { className: "evBadge", textContent: ` 🏃${ruch}` }) : null, dzwiek ? el("span", { className: "evBadge", textContent: ` 🔊${dzwiek}` }) : null, f.uploaded ? el("span", { className: "evBadge", textContent: " ☁️" }) : null),
          el("span", { className: "libActions" },
            el("button", { className: "btn ghost small", textContent: "▶", title: "Odtwórz", onclick: () => { cursor = f.start; play(f); window.scrollTo({ top: 0, behavior: "smooth" }); } }),
            el("button", { className: "btn ghost small", textContent: "📤 Udostępnij", onclick: () => share(f) }),
            el("button", { className: "btn ghost small", textContent: "⬇ Pobierz", onclick: () => save(f) }),
            f.uploaded ? null : el("button", { className: "btn ghost small", textContent: "☁️ Na Drive", onclick: () => toDrive(f) })));
      })))));
  }

  async function refresh() {
    try {
      const r = await client.list(day);
      files = (r.files || []).sort((a, b) => a.start - b.start); now = r.now || Date.now();
      const total = files.filter(f => !f.recording);
      info.textContent = total.length
        ? `Na komputerze: ${total.length} nagr. z tego dnia, od ${hm(total[0].start)}. Szare = brak nagrania. Przeciągnij po pasku albo dotknij 🏃/🔊.`
        : "Brak nagrań z tego dnia na komputerze-kamerze.";
    } catch (e) { info.textContent = e.message || String(e); files = []; }
    draw(); drawLib();
  }

  function setDay(d) { day = d; dateInput.value = d; cursor = null; refresh(); }

  // Odświeżanie listy co minutę (nowe pliki pojawiają się co 10 min).
  function start() { clearInterval(refreshTimer); refresh(); refreshTimer = setInterval(() => { now = Date.now(); refresh(); }, 60000); }
  function stop() { clearInterval(refreshTimer); goLive(); }
  draw();
  return { start, stop, refresh, goLive };
}

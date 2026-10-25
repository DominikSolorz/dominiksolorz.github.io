// Podgląd jak w rejestratorze (DVR) na telefonie: pod obrazem na żywo pasek czasu dnia z nagraniami z Google Drive
// (plus pliki, które komputer-kamera jeszcze wysyła),
// znaczniki ruchu 🏃 i dźwięku 🔊, szare przerwy (kamera nie nagrywała), przewijanie, „● NA ŻYWO”
// i biblioteka z przyciskami Udostępnij / Pobierz / ☁️ Wyślij na Google Drive.
// Pliki pobierane są z komputera przez kanał danych WebRTC (recproto.js) — działa też na internecie komórkowym.
import { fixMp4Duration } from "./mp4fix.js?v=2";
import {validThumbnail,captureEventFrame} from "./workspace-panels.mjs?v=1";
import {localDayRange,previousLocalDay} from './recording-time.mjs?v=1';
import {confirmRecordingDeletion} from './recording-actions.mjs?v=2';
const pad = n => String(n).padStart(2, "0");
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const hms = t => { const d = new Date(t); return `${hm(t)}:${pad(d.getSeconds())}`; };
const mb = n => n>=1073741824?`${(n/1073741824).toFixed(2)} GB`:`${(n / 1048576).toFixed(1)} MB`;
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids.filter(k => k !== null && k !== undefined && k !== "")); return e; };
const DAY_MS = 86400000;

const nameTime = n => { const m = /(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/.exec(n || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : 0; };
const SEG_MS = 600000;

export function mountDvr({ client, drive, allowUpload = true, removeRecording=null, canRemove=()=>false, root, listRoot = null, stage: liveStage, toast, onState = () => {} }) {
  // Odtwarzacz ma własny kontener. Nigdy nie przenosi i nie modyfikuje liveVideo.
  const stage = el("div", { className: "stage archivePlaybackStage", hidden: true });
  root.before(stage);
  const playback = el("video", { className: "playback", playsInline: true, controls: true, hidden: true });
  playback.setAttribute("playsinline", "");
  // Nagrania z Google Drive odtwarza odtwarzacz Google (zalogowane konto właściciela).
  const frame = el("iframe", { className: "playback", hidden: true, allow: "autoplay; fullscreen", allowFullscreen: true });
  stage.append(playback, frame);
  const progressBadge = el("div", { className: "badge dvrBadge", hidden: true });
  stage.append(progressBadge);
  const latestButton=el('button',{className:'archivePlayLatest',type:'button',textContent:'Odtwórz ostatnie nagranie',hidden:true,onclick:()=>{const latest=files.filter(f=>!f.recording).at(-1);if(latest){latestButton.hidden=true;cursor=latest.start;play(latest,0,true);}}});
  stage.append(latestButton);

  let day = dayKey(new Date()), files = [], now = Date.now(), zoom = "day", cursor = null, playing = null, refreshTimer = null;
  const cache = new Map(); // nazwa → Blob (ostatnie 3 pliki)
  const thumbnails = new Map(); // bounded decoded frames; no background video downloads
  let archiveModal = null, restoreStage = null, restoreDvr = null, restoreList = null, restoreStorage = null;

  // Prawy klik na obrazie otwiera pełne archiwum. To te same działające elementy,
  // więc w oknie jest prawdziwy obraz kamery/odtwarzacz i prawdziwy pasek doby.
  function openArchive() {
    if (archiveModal) return;
    restoreStage = document.createComment("kamera-stage");
    restoreDvr = document.createComment("kamera-dvr");
    stage.before(restoreStage); root.before(restoreDvr);
    if (listRoot) { restoreList = document.createComment("kamera-dvr-list"); listRoot.before(restoreList); }
    const closeBtn = el("button", { className: "archiveClose", type: "button", textContent: "← Wróć do kamery na żywo", onclick: () => closeArchive() });
    const hint = el("p", { className: "archiveHint", textContent: "Wybierz dzień i nagranie. Kolorowe odcinki na osi czasu oznaczają dostępny zapis. Kamera i nagrywanie działają niezależnie od tego widoku." });
    const body = el("div", { className: "archiveModalBody" });
    body.append(stage, root);
    if (listRoot) body.append(listRoot);
    const workspace = el("div", { className: "archiveWorkspace" }, body);
    const storage = document.getElementById("archiveStoragePanel");
    if (document.documentElement.classList.contains("desktopMode") && storage) {
      restoreStorage = document.createComment("archive-storage-home"); storage.before(restoreStorage);
      const tools = el("aside", { className: "archiveStorageSidebar", ariaLabel: "Zarządzanie folderem nagrań" }, storage);
      workspace.append(tools);
    }
    archiveModal = el("section", { className: "archiveModal", role: "dialog", ariaModal: "true", ariaLabel: "Archiwum nagrań kamery" },
      el("header", { className: "archiveModalHead" }, el("div", {}, el("h2", { textContent: "Nagrania" }), hint), closeBtn), workspace);
    document.body.append(archiveModal); document.body.classList.add("archiveOpen"); closeBtn.focus();
    stage.hidden = false;
    progressBadge.hidden = false; progressBadge.textContent = "Wybierz nagranie lub dzień. Otwarcie archiwum nie zmienia stanu kamery ani zapisu.";
    refresh().then(() => {
      const latest = files.filter(f => !f.recording).at(-1);
      if (latest) {latestButton.hidden=false;progressBadge.hidden=false;progressBadge.textContent='Archiwum gotowe. Wybierz nagranie — plik zostanie wczytany dopiero po naciśnięciu odtwarzania.';}
      else { progressBadge.hidden = false; progressBadge.textContent = "Brak zamkniętych nagrań z wybranego dnia. Wybierz inny dzień."; }
    });
  }
  function closeArchive() {
    if (!archiveModal) return;
    goLive(); progressBadge.hidden = true; latestButton.hidden=true;stage.hidden = true;
    restoreStage.replaceWith(stage); restoreDvr.replaceWith(root);
    if (listRoot && restoreList) restoreList.replaceWith(listRoot);
    if (restoreStorage) { restoreStorage.replaceWith(document.getElementById("archiveStoragePanel")); restoreStorage = null; }
    archiveModal.remove(); archiveModal = null; restoreStage = restoreDvr = restoreList = null;
    document.body.classList.remove("archiveOpen");
    document.dispatchEvent(new Event("hs-recordings-closed"));
  }
  liveStage.addEventListener("contextmenu", e => {
    if (e.target.closest("#zoomBar, #startHere")) return;
    e.preventDefault(); openArchive();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && archiveModal) closeArchive(); });
  document.addEventListener("hs-open-recordings", openArchive);
  document.addEventListener("hs-close-recordings",closeArchive);

  // ----- układ -----
  const dateInput = el("input", { type: "date", className: "dvrDate", value: day, onchange: () => setDay(dateInput.value) });
  const liveBtn = el("button", { className: "dvrBtn dvrLive", textContent: "NA ŻYWO", onclick: () => goLive() });
  const zoomBtn = el("button", { className: "dvrBtn", textContent: "🔍 1 h", onclick: () => { zoom = zoom === "day" ? "hour" : "day"; zoomBtn.textContent = zoom === "day" ? "🔍 1 h" : "🔍 24 h"; draw(); } });
  const bar = el("div", { className: "dvrBar" });
  const segsLayer = el("div", { className: "dvrSegs" });
  const evLayer = el("div", { className: "dvrEvents" });
  const cursorEl = el("div", { className: "dvrCursor", hidden: true });
  const nowEl = el("div", { className: "dvrNow" });
  bar.append(segsLayer, evLayer, nowEl, cursorEl);
  const ticks = el("div", { className: "dvrTicks" });
  const posLabel = el("span", { className: "dvrPos" });
  const timeLabel = el("span", { className: "dvrTime muted small" });
  const info = el("p", { className: "muted small dvrInfo" });
  const lib = el("div", { className: "libList" });
  const thumbnailStrip=el("div",{className:"dvrThumbnailStrip",ariaLabel:"Klatki zapisanych nagrań"});
  const jump = sec => el("button", { className: "dvrBtn", textContent: sec < 0 ? `− ${-sec / 60} min` : `+ ${sec / 60} min`, onclick: () => seekTo((cursor ?? now) + sec * 1000) });
  const todayBtn = el("button", { className: "dvrBtn", textContent: "Dziś", onclick: () => setDay(dayKey(new Date())) });
  const yestBtn = el("button", { className: "dvrBtn", textContent: "Wczoraj", onclick: () => setDay(dayKey(previousLocalDay())) });

  root.replaceChildren(
    el("div", { className: "dvrTop" },
      el("div", { className: "panelHead" }, el("div", {}, el("h2", { textContent: "Odtwarzacz nagrań (DVR)" }), el("p", { textContent: "Przeglądaj zapisane nagrania z kamery" }))),
      el("div", { className: "dvrCtrls" },
        el("button", { className: "dvrBtn dvrOpenArchive", textContent: "Otwórz odtwarzanie nagrań ↗", onclick: openArchive }),
        el("div", { className: "dvrGroup" }, todayBtn, yestBtn, dateInput),
        el("div", { className: "dvrGroup" }, jump(-300), jump(-60), liveBtn, jump(60), jump(300)))),
    bar, el("div", { className: "dvrTickWrap" }, ticks, posLabel),
    el("div", { className: "dvrFoot" },
      el("span", { className: "dvrLegend", ariaLabel: "Legenda osi czasu" },
        el("i", { className: "lgRec" }), "Obraz nagrany",
        el("i", { className: "lgMotion" }), "Ruch w obrazie",
        el("i", { className: "lgSound" }), "Dźwięk",
        el("i", { className: "lgGap" }), "Brak nagrania"),
      timeLabel, zoomBtn),
    thumbnailStrip, info,
  );
  // Lista nagrań: osobna karta obok osi czasu (albo zwijana pod nią, gdy brak miejsca na kartę).
  const listCount = el("span", { className: "muted small" });
  if (listRoot) {
    listRoot.hidden = false;
    listRoot.replaceChildren(el("div", { className: "panelHead" }, el("div", {}, el("h2", { textContent: "Lista nagrań (archiwum)" }), el("p", { textContent: "Kliknij, aby odtworzyć wybrany plik" })), listCount), lib);
  } else root.append(el("details", { className: "libDay dvrLibBox" }, el("summary", {}, el("b", { textContent: "📼 Lista nagrań dnia" })), lib));

  // ----- zakres paska -----
  const dayStart = () => localDayRange(day)[0];
  function range() {
    const s = dayStart();
    const end=localDayRange(day)[1];
    if (zoom === "day") return [s, end];
    const c = cursor ?? Math.min(now, end - 1);
    const from = Math.max(s, Math.min(c - 1800000, end - 3600000));
    return [from, from + 3600000];
  }
  const pct = (t, [a, b]) => `${Math.max(0, Math.min(100, (100 * (t - a)) / (b - a)))}%`;

  function draw() {
    const r = range();
    segsLayer.replaceChildren(...files.map(f => el("div", {
      className: `dvrSeg${f.recording ? " rec" : ""}`,
      title: `${hm(f.start)}–${hm(f.end)}`,
      style: `left:${pct(f.start, r)};width:calc(${pct(f.end, r)} - ${pct(f.start, r)})`,
    })));
    const evs = files.flatMap(f => (f.events || []).map(e => ({ ...e, file: f })));
    // Z Google Drive znamy tylko liczbę zdarzeń w pliku — znacznik stoi na początku pliku.
    evLayer.replaceChildren(...evs.filter(e => e.at >= r[0] && e.at <= r[1]).map(e => el("button", {
      className: `dvrEv ${e.kind === "ruch" ? "motion" : "sound"}`,
      textContent: e.kind === "ruch" ? "▰" : "🔊",
      ariaLabel: `${e.kind === "ruch" ? "Ruch w obrazie" : "Dźwięk"} ${hms(e.at)}`,
      title: `${e.kind === "ruch" ? "Ruch w obrazie" : "Dźwięk"} ${hms(e.at)}`,
      style: `left:${pct(e.at, r)}`, onclick: ev => { ev.stopPropagation(); seekTo(Math.max(e.file.start, e.at - 3000)); },
    })));
    nowEl.hidden = !(now >= r[0] && now <= r[1]); nowEl.style.left = pct(now, r);
    cursorEl.hidden = cursor === null; if (cursor !== null) cursorEl.style.left = pct(cursor, r);
    const compact = document.documentElement.classList.contains("mobileOwnerMode");
    const narrow=compact||(bar.clientWidth||600)<480;
    const n = narrow ? (zoom === "day" ? 4 : 3) : (zoom === "day" ? 6 : 6), step = (r[1] - r[0]) / n;
    ticks.replaceChildren(...Array.from({ length: n + 1 }, (_, i) => {
      const time=zoom==='day'?+new Date(new Date(r[0]).setHours(i*24/n,0,0,0)):r[0]+i*step;
      return el("span", { textContent:zoom==='day'&&i===n?'24:00':hm(time), style:`left:${100*(time-r[0])/(r[1]-r[0])}%` });
    }));
    timeLabel.textContent = cursor === null ? "● na żywo" : `▶ ${hms(cursor)}`;
    const at = cursor ?? now, show = at >= r[0] && at <= r[1];
    posLabel.hidden = !show; posLabel.style.left = pct(at, r); posLabel.textContent = cursor === null ? hm(now) : hms(cursor);
    posLabel.classList.toggle("play", cursor !== null);
    const today = dayKey(new Date());
    todayBtn.classList.toggle("on", day === today); yestBtn.classList.toggle("on", day === dayKey(previousLocalDay()));
    liveBtn.classList.toggle("on", cursor === null && day === today);
  }

  // ----- przeciąganie po pasku -----
  let dragging = false, scrubTimer = null;
  const timeAt = x => { const b = bar.getBoundingClientRect(), r = range(); return r[0] + ((x - b.left) / b.width) * (r[1] - r[0]); };
  bar.addEventListener("pointerdown", e => { dragging = true; bar.setPointerCapture(e.pointerId); cursor = timeAt(e.clientX); draw(); });
  bar.addEventListener("pointermove", e => { if (!dragging) return; cursor = timeAt(e.clientX); draw(); clearTimeout(scrubTimer); scrubTimer = setTimeout(() => { const f = fileAt(cursor); if (f?.local && !f.recording) play(f, cursor - f.start, true); }, 220); });
  const release = () => { if (!dragging) return; clearTimeout(scrubTimer); dragging = false; seekTo(cursor); };
  bar.addEventListener("pointerup", release); bar.addEventListener("pointercancel", release);

  // ----- odtwarzanie -----
  async function fetchFile(f) {
    if (cache.has(f.name)) return cache.get(f.name);
    progressBadge.hidden = false; progressBadge.textContent = `Pobieram ${hm(f.start)}… 0%`;
    try {
      const { blob: raw } = await client.get(f.name, (got, size) => { progressBadge.textContent = `Pobieram ${hm(f.start)}… ${Math.round((100 * got) / size)}%`; });
      // Dopisanie długości nagrania — bez tego iPhone nie pozwala przewijać (traktuje plik jak transmisję na żywo).
      const blob = await fixMp4Duration(raw).catch(() => raw);
      cache.set(f.name, blob);
      while (cache.size > 3) cache.delete(cache.keys().next().value);
      return blob;
    } finally { progressBadge.hidden = true; }
  }

  function showPlayback(on, viaFrame = false) {
    playback.hidden = !on || viaFrame; frame.hidden = !on || !viaFrame;
    stage.hidden = !on && !archiveModal;
    onState(on);
    if (!on || !viaFrame) frame.removeAttribute("src");
    liveBtn.classList.toggle("off", !on);
  }

  async function play(f, offsetMs = 0, paused = false) {
    if (!f) return;
    latestButton.hidden=true;
    if (f.recording) { toast("Ten fragment jeszcze się nagrywa — będzie do obejrzenia po zamknięciu pliku (co 10 min). Pokazuję obraz na żywo."); return goLive(); }
    if (!f.local) {
      // Plik z Google Drive: odtwarzacz Google. Przewijanie w obrębie pliku — suwakiem odtwarzacza.
      playback.pause(); playing = f; cursor = f.start; draw();
      frame.src = `https://drive.google.com/file/d/${encodeURIComponent(f.id)}/preview`;
      showPlayback(true, true);
      if (offsetMs > 30000) toast(`Nagranie ${hm(f.start)}–${hm(f.end)} z Google Drive — przewiń w odtwarzaczu do ${hms(f.start + offsetMs)}.`);
      return;
    }
    try {
      if (playing?.name === f.name && playback.src) {
        showPlayback(true); playback.currentTime = Math.max(0, offsetMs / 1000);
        if (paused) playback.pause(); else playback.play().catch(() => {});
        return;
      }
      const blob = await fetchFile(f);
      playing = f; drawLib();
      if (playback.src) URL.revokeObjectURL(playback.src);
      playback.src = URL.createObjectURL(blob);
      showPlayback(true);
      await new Promise(res => { playback.onloadedmetadata = res; setTimeout(res, 3000); });
      if (offsetMs > 0) {
        // Pliki z nagrywania bywają bez długości — „przewinięcie na koniec” każe przeglądarce ją ustalić.
        if (!Number.isFinite(playback.duration)) { playback.currentTime = 1e9; await new Promise(r => setTimeout(r, 300)); }
        playback.currentTime = offsetMs / 1000;
      }
      if (paused) playback.pause(); else playback.play().catch(() => {});
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
    // Lista odświeża się co minutę (nowe obiekty) — następny plik szukamy po czasie, nie po pozycji obiektu.
    const next = files.find(f => f.start > playing.start && f.name !== playing.name);
    if (next && !next.recording && next.start - playing.end < 60000) play(next); else goLive();
  });

  function goLive() {
    playback.pause(); showPlayback(false); playing = null; cursor = null; drawLib();
    if (day !== dayKey(new Date())) setDay(dayKey(new Date())); else draw();
  }

  // ----- biblioteka dnia -----
  const thumbnailFor=f=>thumbnails.get(f.name)||(validThumbnail(f.thumbnail)?f.thumbnail:(f.events||[]).map(e=>e.thumbnail).find(validThumbnail));
  function drawThumbnails(){thumbnailStrip.replaceChildren(...files.filter(f=>!f.recording&&thumbnailFor(f)).slice(-12).map(f=>el("button",{type:"button",className:"dvrThumbnail",onclick:()=>play(f),title:`Odtwórz nagranie ${hm(f.start)}`},el("img",{src:thumbnailFor(f),alt:`Klatka nagrania ${hm(f.start)}`}),el("span",{textContent:hm(f.start)}))));thumbnailStrip.hidden=!thumbnailStrip.childElementCount;}
  playback.addEventListener("loadeddata",()=>{if(!playing)return;const frame=captureEventFrame(playback);if(frame){thumbnails.set(playing.name,frame);while(thumbnails.size>64)thumbnails.delete(thumbnails.keys().next().value);drawLib();drawThumbnails();}});
  const driveView = f => `https://drive.google.com/file/d/${encodeURIComponent(f.id)}/view`;
  async function share(f) {
    if (!f.local) {
      try {
        if (navigator.share) await navigator.share({ title: `Kamera ${day} ${hm(f.start)}`, url: driveView(f) });
        else { await navigator.clipboard.writeText(driveView(f)); toast("Skopiowano link do nagrania na Google Drive."); }
      } catch (e) { if (e?.name !== "AbortError") toast(`Nie udało się udostępnić: ${e.message || e}`); }
      return;
    }
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
  async function save(f) {
    if (!f.local) { window.open(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(f.id)}`, "_blank", "noopener"); return; }
    try { download(await fetchFile(f), f.name); } catch (e) { toast(`Nie udało się pobrać: ${e.message || e}`); }
  }
  async function toDrive(f) {
    try { const r = await client.upload(f.name); toast(r.uploaded ? "To nagranie już jest na Google Drive." : "Przesyłam na Google Drive — komputer wyśle je w tle, nagranie zostaje też na stronie."); refresh(); }
    catch (e) { toast(`Nie udało się zlecić wysłania: ${e.message || e}`); }
  }

  const removing=new Set();
  async function removeFile(f) {
    if(!f.local||!removeRecording||!canRemove()||removing.has(f.name))return;
    const warning=dayKey(new Date(f.start))===dayKey(new Date())?' To dzisiejszy materiał. Jeżeli nie ma jeszcze potwierdzonej kopii w Drive, możesz go utracić.':'';
    if(!await confirmRecordingDeletion(`Nagranie ${hms(f.start)}–${hms(f.end)} (${mb(f.size||0)}) zostanie usunięte z dostępnego archiwum tego komputera. Kopia na Google Drive pozostaje bez zmian.${warning}`))return;
    if(!canRemove())return toast('Panel został zablokowany. Otwórz go ponownie przed usuwaniem.');
    removing.add(f.name);drawLib();
    try {
      const receipt=await removeRecording(f.name);
      if(receipt?.deleted!==true)throw Error('Komputer nie potwierdził usunięcia.');
      cache.delete(f.name);thumbnails.delete(f.name);if(playing?.name===f.name)goLive();
      await refresh();toast('Usunięto nagranie z dostępnego archiwum komputera. Kopii Google Drive nie usunięto.');
    }catch(error){toast(`Nie udało się usunąć: ${error.message||error}`);}
    finally{removing.delete(f.name);drawLib();}
  }

  function drawLib() {
    const real = files.filter(f => !f.recording).slice().reverse();
    listCount.textContent = real.length ? `${real.length} plików` : "";
    if (!real.length) return lib.replaceChildren(el("p", { className: "muted small", textContent: "Brak nagrań w tym dniu." }));
    lib.replaceChildren(el("ul", { className: "recList" }, ...real.map(f => {
      const ruch = (f.events || []).filter(e => e.kind === "ruch").length, dzwiek = (f.events || []).filter(e => e.kind === "dzwiek").length;
      const min = Math.max(1, Math.round((f.end - f.start) / 60000));
      const playIt = () => { cursor = f.start; play(f); if (window.innerWidth < 1100) window.scrollTo({ top: 0, behavior: "smooth" }); };
      return el("li", { className: playing && playing.name === f.name ? "on" : "" },
        el('button',{className:'recPlay recPreview',type:'button',ariaLabel:`Odtwórz nagranie ${hms(f.start)}`,onclick:playIt},thumbnailFor(f)?el("img",{className:"recThumbnail",src:thumbnailFor(f),alt:`Klatka nagrania ${hm(f.start)}`}):el("span",{className:"recThumbnail recThumbnailEmpty",textContent:"▶",title:"Klatka pojawi się po otwarciu nagrania"})),
        el('div',{className:'recDetails'},
        el("button", { className: "recTimes", onclick: playIt },
          el("b", { textContent: `${hms(f.start)} – ${hms(f.end)}` }),
          el("small", { textContent: [`${min} min`, f.size ? mb(f.size) : "", ruch ? `🏃${ruch}` : "", dzwiek ? `🔊${dzwiek}` : "", f.uploaded || !f.local ? "☁️" : ""].filter(Boolean).join(" · ") })),
        el("span", { className: "recActs" },
          el("button", { className: "recIcon", title: "Pobierz plik nagrania", textContent: "Pobierz", onclick: () => save(f) }),
          el("button", { className: "recIcon", title: "Wyślij plik przez menu udostępniania urządzenia; gdy niedostępne, pobierz plik", textContent: "Wyślij", onclick: () => share(f) }),
          allowUpload && f.local && !f.uploaded ? el("button", { className: "recIcon", title: "Prześlij do Google Drive", textContent: "Google Drive", onclick: () => toDrive(f) }) : null,
          f.local&&removeRecording&&canRemove()?el('button',{className:'recIcon recDelete',type:'button',textContent:removing.has(f.name)?'Usuwanie…':'Usuń',disabled:removing.has(f.name),onclick:()=>removeFile(f)}):null)));
    })));
  }


  // Nagrania dnia: z Google Drive (przechowywanie) + jeszcze niewysłane z komputera-kamery.
  async function refresh() {
    let driveErr = null;
    const [dr, lr] = await Promise.all([
      drive ? drive.day(day).catch(e => { driveErr = e; return null; }) : null,
      client.connected ? client.list(day).catch(() => null) : null,
    ]);
    const map = new Map();
    for (const h of dr?.hours || dr || []) for (const f of h.files || []) {
      const start = nameTime(f.name);
      const events = [];
      if (f.ev?.ruch) events.push({ kind: "ruch", at: start + 2000, count: f.ev.ruch });
      if (f.ev?.dzwiek) events.push({ kind: "dzwiek", at: start + 4000, count: f.ev.dzwiek });
      map.set(f.name, { name: f.name, id: f.id, size: f.size, start, end: start + SEG_MS, events });
    }
    for (const f of lr?.files || []) {
      if (f.recording) map.set("__nagrywany", f);
      else map.set(f.name, { ...map.get(f.name), ...f, local: true });
    }
    files = [...map.values()].filter(f => f.start).sort((a, b) => a.start - b.start);
    // Koniec pliku z Drive = początek następnego (najwyżej 10 min).
    files.forEach((f, i) => { if (!f.local && !f.recording && files[i + 1]) f.end = Math.min(f.end, files[i + 1].start); });
    now = lr?.now || Date.now();
    const total = files.filter(f => !f.recording);
    info.textContent = (total.length
      ? `${total.length} nagrań z tego dnia (od ${hm(total[0].start)}). Przeciągnij po pasku, aby przewinąć, albo dotknij 🏃/🔊.`
      : driveErr ? "Nie udało się sprawdzić archiwum Google Drive." : "Brak nagrań z tego dnia.") + (driveErr ? ` Błąd dostępu: ${driveErr.message || driveErr}. Sprawdź połączenie z archiwum w konfiguracji nadajnika.` : "");
    draw(); drawLib();drawThumbnails();
  }

  function setDay(d) { day = d; dateInput.value = d; cursor = null; refresh(); }

  // Odświeżanie listy co minutę (nowe pliki pojawiają się co 10 min).
  function start() { clearInterval(refreshTimer); refresh(); refreshTimer = setInterval(() => { now = Date.now(); refresh(); }, 60000); }
  function stop() { clearInterval(refreshTimer); goLive(); }
  draw();
  return { start, stop, refresh, goLive, openArchive, closeArchive };
}

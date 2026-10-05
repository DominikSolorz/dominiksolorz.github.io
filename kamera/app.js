// vendor/supabase.js (@supabase/supabase-js 2.117.2) ładowany w index.html przed tym modułem.
// Pliki mają numer wersji w adresie (?v=…), bo GitHub Pages trzyma je w pamięci podręcznej przez 10 min.
const { createClient } = window.supabase;
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, TURN_SERVER, DRIVE_SCRIPT_URL, driveWatchUrl } from "./config.js?v=34";
import { b64, sign, targetString } from "./pin.js?v=14";
import { mountLibrary } from "./library-ui.js?v=22";
import { requireAccess } from "./lock.js?v=14";
import { channelFor, lock } from "./access.js?v=14";
import { createDetector, EVENT_LABEL } from "./detect.js?v=32";
import { createZoomer, normalize, MAX_ZOOM } from "./zoom.js?v=16";
import * as recstore from "./recstore.js?v=77";
import { fixMp4Duration } from "./mp4fix.js?v=2";
import * as diskstore from "./diskstore.js?v=4";
import { serve as serveRecordings, createClient as createRecClient } from "./recproto.js?v=34";
import { mountDvr } from "./dvr-ui.js?v=87";

// Wejście PIN-em: z PIN-u powstaje klucz dostępu, a z niego tajna nazwa kanału sygnalizacji.
// Supabase służy tylko do wymiany sygnałów WebRTC; obraz i dźwięk płyną peer-to-peer.
let ACCESS_KEY = null, CHANNEL = null;
// Link odbiorcy zawiera wyłącznie niezgadywalną nazwę kanału WebRTC, nigdy PIN ani klucz właściciela.
// Każdy, komu właściciel przekaże ten adres, może oglądać kamerę i archiwum przez ten link.
const receiverChannel = new URLSearchParams(location.search).get("odbiorca") || "";
const RECEIVER_ONLY = /^cam-[a-f0-9]{32}$/.test(receiverChannel);
const VERSION = "89"; // musi się zgadzać z version.json
const recClient = createRecClient(); // telefon: nagrania z komputera-kamery przez kanał danych WebRTC
// Komputer-kamera: ta sama oś czasu, ale nagrania czytane prosto z własnej pamięci (bez kanału danych).
const localRecClient = {
  connected: true,
  set onopen(fn) { /* zawsze połączony */ },
  days: () => archive.local.days(),
  list: day => archive.local.list(day),
  upload: name => archive.local.upload(name),
  get: async name => { const f = await archive.local.file(name); if (!f) throw new Error("nie ma takiego nagrania"); return f; },
};
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// Komputer (nie telefon) z kamerą dostaje duży przycisk „Włącz kamerę”, gdy nikt nie nadaje.
const IS_DESKTOP = !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) && !!navigator.mediaDevices?.getUserMedia;
// 12 odbiorców przy 2,5 Mb/s wymaga do ok. 30 Mb/s uploadu; przy słabszym łączu obraz sam obniży jakość zamiast zrywać połączenie.
const MAX_VIEWERS = 12;
// Jakość przesyłu na żywo: HD 720p, 30 kl./s, do 2,5 Mb/s na oglądającego; H.264 = sprzętowe dekodowanie na iPhonie.
const LIVE_MAX_BITRATE = 1500000;
const LIVE_FPS = 30;
// Wysyłka na żywo lżejsza dla procesora (cichsze wentylatory): 1280 px szerokości i 20 kl./s.
// Nagrania nadal w pełnej rozdzielczości kamery.
const LIVE_SEND_WIDTH = 1280, LIVE_SEND_FPS = 20;
// Wirtualne kamery (OBS, Snap, ManyCam…) pokazują zastępczy obrazek, gdy ich program nie działa — pomijamy je.
const VIRTUAL_CAM = /obs|virtual|snap camera|manycam|xsplit|ndi|splitcam|vcam|droidcam|epoccam|camo|iriun/i; // wirtualne kamery — nigdy nieużywane
const HEARTBEAT_MS = 15000;
const OFFLINE_AFTER_MS = 45000;
const PREFS_KEY = "prywatna-kamera-v2";
const retryDelay = n => Math.min(30000, 2000 * 2 ** n);
const $ = id => document.getElementById(id);
const errText = e => (e instanceof Error ? e.message : String(e));
const pad = n => String(n).padStart(2, "0");
const fmtTime = s => `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
const nameTime = n => { const m = /(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/.exec(n || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : 0; };
const stamp = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;

const iceServers = () => {
  const s = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];
  if (TURN_SERVER) s.push(TURN_SERVER);
  return s;
};

// ---------- Ustawienia (pamiętane w przeglądarce) ----------
const DEFAULTS = { role: null, cameraId: "", audio: true, detect: true, sensitivity: "medium", recQuality: "p360", segmentMin: 10, retentionDays: 1, mode: "record", recordPlan: "always", pictureStyle: "color", pictureGrid: false, pano360: false, media: "av" };
// Źródło transmisji i zapisu: "av" = obraz + dźwięk, "v" = tylko obraz, "a" = tylko dźwięk.
const MEDIA_LABEL = { av: "obraz + dźwięk", v: "tylko obraz", a: "tylko dźwięk" };
// Tryby, w których powstają pliki ("rec-only" = zapis bez transmisji na żywo).
const RECORDING_MODES = new Set(["record", "rec-only"]);

// 360p tworzy mały plik, pozostałe ustawienia zachowują pełny kadr. Wysoka i maksymalna
// jakość używają stałej przepływności, aby obraz nie stawał się rozmyty.
const REC_QUALITY = {
  p360: { bps: 400000, height: 360, label: "Niska — 360p (ok. 30 MB / 10 min)", short: "niska 360p" },
  eco:  { bps: 600000, label: "Oszczędna — pełna rozdzielczość (ok. 45 MB / 10 min)", short: "oszczędna" },
  high: { bps: 1500000, cbr: true, label: "Wysoka — wyraźny obraz (ok. 110 MB / 10 min)", short: "wysoka" },
  max:  { bps: 4000000, cbr: true, label: "Maksymalna — najostrzej (ok. 300 MB / 10 min)", short: "maksymalna" },
};
const recQuality = () => REC_QUALITY[prefs.recQuality] || REC_QUALITY.high;
function loadPrefs() { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") }; } catch { return { ...DEFAULTS }; } }
function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* tryb prywatny */ } }
const prefs = loadPrefs();
function recordingScheduledNow() {
  if (prefs.recordUntil > Date.now()) return true; // nagranie jednorazowe — niezależnie od harmonogramu
  const hour = new Date().getHours();
  if (prefs.recordPlan === "day") return hour >= 7 && hour < 22;
  if (prefs.recordPlan === "night") return hour < 7 || hour >= 22;
  return true;
}
// Jednorazowo: nowy plik co 10 minut i przechowywanie 30 dni (biblioteka nagrań na Google Drive).
if (!prefs.lib1) { prefs.segmentMin = 10; prefs.retentionDays = 30; prefs.lib1 = true; savePrefs(); }
// Ustawienie domyślne właściciela: faktyczne 360p, czyli mniejszy obraz w zapisywanym pliku.
// Zmiana na inną jakość w panelu wyłącza ten tryb bez utraty pozostałych ustawień.
if (!prefs.q360) { prefs.recQuality = "p360"; prefs.q360 = true; savePrefs(); }
// Jednoznaczne przejście ze starych, niejasnych trybów: po aktualizacji właściciela
// komputer-kamera zawsze wraca do zapisu 24/7. Późniejsze świadome wybory w panelu
// są zachowane, bo znacznik migracji wykonuje się tylko raz.
if (!prefs.mode85) { prefs.mode = "record"; prefs.recordPlan = "always"; prefs.recordUntil = 0; prefs.mode85 = true; savePrefs(); }
// Jednorazowo (życzenie właściciela): nagrywanie bez przerwy — dzień i noc, bez harmonogramu i bez trybu „tylko podgląd”.
// Później tryb można dowolnie zmieniać z telefonu.
if (!prefs.rec247) { prefs.mode = "record"; prefs.recordPlan = "always"; prefs.recordUntil = 0; prefs.rec247 = true; savePrefs(); }


// ---------- UI pomocnicze ----------
const video = $("video");
function updateMonitorClock() {
  const now = new Date();
  $("monitorDate").textContent = now.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
  $("monitorTime").textContent = now.toLocaleTimeString("pl-PL", { hour12: false });
}
updateMonitorClock(); setInterval(updateMonitorClock, 1000);
function setStatus(text) { $("status").textContent = text || ""; $("status").hidden = !text; }
function showPlaceholder(text) { $("placeholder").textContent = text; $("placeholder").hidden = !text; }
function showLive(text) {
  $("liveBadge").hidden = !text; if (text) $("liveText").textContent = text;
  $("topStatus").textContent = text ? "● na żywo" : "offline"; $("topStatus").classList.toggle("live", !!text);
  const operational = $("opLive"); if (operational) operational.textContent = text ? "Działa" : "Offline";
}

const MIME = (() => {
  if (typeof MediaRecorder === "undefined") return null;
  return ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find(t => MediaRecorder.isTypeSupported(t)) ?? "";
})();
const extFor = type => (type.startsWith("video/mp4") ? "mp4" : "webm");

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ---------- Pamięć folderu zapisu (IndexedDB trzyma uchwyt do folderu) ----------
const idb = {
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open("prywatna-kamera", 2);
      r.onupgradeneeded = () => { for (const s of ["kv", "queue"]) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  },
  async get(k) { const db = await this.open(); return new Promise(res => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); },
  async set(k, v) { const db = await this.open(); return new Promise(res => { const t = db.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = () => res(); t.onerror = () => res(); }); },
  // Kolejka nagrań czekających na wysłanie (przetrwa brak internetu i odświeżenie strony).
  async qPut(k, v) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction("queue", "readwrite"); t.objectStore("queue").put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
  async qDel(k) { const db = await this.open(); return new Promise(res => { const t = db.transaction("queue", "readwrite"); t.objectStore("queue").delete(k); t.oncomplete = () => res(); t.onerror = () => res(); }); },
  async qKeys() { const db = await this.open(); return new Promise(res => { const q = db.transaction("queue").objectStore("queue").getAllKeys(); q.onsuccess = () => res(q.result.map(String).sort()); q.onerror = () => res([]); }); },
  async qGet(k) { const db = await this.open(); return new Promise(res => { const q = db.transaction("queue").objectStore("queue").get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); },
};

// ---------- Google Drive bez programu na komputerze: skrypt Google Apps Script (kamera/drive-skrypt.gs) ----------
// Strona wysyła każdy plik nagrania prosto przez internet na Google Drive właściciela — nic nie zależy
// od dysku C: ani od programu „Dysk Google na komputer”. Token do skryptu wyliczany jest z klucza PIN-u.
const cloud = (() => {
  const enabled = !!DRIVE_SCRIPT_URL;
  let token = null;
  async function call(action, extra = {}, timeoutMs = 60000) {
    token ??= [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`drive:${ACCESS_KEY}`)))].map(b => b.toString(16).padStart(2, "0")).join("");
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      // text/plain = bez zapytania wstępnego CORS (Apps Script go nie obsługuje).
      const res = await fetch(DRIVE_SCRIPT_URL, { method: "POST", body: JSON.stringify({ action, token, ...extra }), headers: { "Content-Type": "text/plain;charset=utf-8" }, signal: ctrl.signal });
      if (!res.ok) throw new Error(`Google Drive odpowiedział ${res.status}`);
      const out = await res.json();
      if (out.error) throw new Error(out.error);
      return out;
    } catch (e) {
      throw new Error(e?.name === "AbortError" ? "przekroczono czas wysyłania" : errText(e));
    } finally { clearTimeout(t); }
  }
  let mbps = 0; // zmierzona szybkość ostatniego wysłania (Mb/s)
  let progress = null; // { name, sent, total, t0 } — bieżące wysyłanie (widoczne w stanie kamery)
  // Wysyłanie pliku zwykłym „prostym” zapytaniem (fetch, text/plain). Uwaga: nasłuch postępu w XHR
  // (xhr.upload.onprogress) wymusza zapytanie wstępne CORS, którego Apps Script nie obsługuje — wtedy nic nie wychodzi.
  async function post(body, timeoutMs, name) {
    progress = { name, size: body.length, t0: Date.now() };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(DRIVE_SCRIPT_URL, { method: "POST", body, headers: { "Content-Type": "text/plain;charset=utf-8" }, signal: ctrl.signal });
      if (!res.ok) throw new Error(`Google Drive odpowiedział ${res.status}`);
      const out = await res.json();
      if (out.error) throw new Error(out.error);
      return out;
    } catch (e) {
      throw new Error(e?.name === "AbortError" ? `przekroczono czas wysyłania (${Math.round(timeoutMs / 60000)} min)` : errText(e));
    } finally { clearTimeout(t); progress = null; }
  }
  const toBase64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { const u = String(r.result), i = u.indexOf("base64,"); res(i < 0 ? "" : u.slice(i + 7)); }; r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  // Wersja skryptu Google: 2+ umie wysyłanie wznawialne (duże pliki kawałkami prosto do Google Drive).
  // Dopóki skrypt jest w starej wersji, sprawdzamy co 10 min — po jego aktualizacji duże pliki ruszą same.
  let scriptVersion = 0, versionAt = 0;
  async function version() {
    if (scriptVersion < 2 && Date.now() - versionAt > 10 * 60000) {
      versionAt = Date.now();
      try { scriptVersion = Number((await call("ping", {}, 30000)).version) || 1; } catch { scriptVersion ||= 1; }
    }
    return scriptVersion;
  }
  // Jeden kawałek pliku prosto do Google Drive (adres sesji od skryptu). 308 = kawałek przyjęty, czekamy na kolejne.
  function putChunk(url, part, start, total) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open("PUT", url);
      x.setRequestHeader("Content-Range", `bytes ${start}-${start + part.size - 1}/${total}`);
      x.timeout = 10 * 60000;
      x.upload.onprogress = e => { if (progress) progress.sent = start + e.loaded; };
      x.onload = () => {
        if (x.status === 308) return resolve(null);
        if (x.status === 200 || x.status === 201) { try { return resolve(JSON.parse(x.responseText)); } catch { return resolve({}); } }
        reject(new Error(`Google Drive odpowiedział ${x.status}`));
      };
      x.onerror = () => reject(new Error("przerwane połączenie z Google Drive"));
      x.ontimeout = () => reject(new Error("przekroczono czas wysyłania kawałka"));
      x.send(part);
    });
  }
  const CHUNK = 8 * 1024 * 1024; // wielokrotność 256 KB (wymóg Google)
  async function uploadResumable(blob, name, events, mime) {
    const s = await call("session", { name, mime, size: blob.size }, 60000);
    if (s.duplicate) return s;
    if (!s.url) throw new Error("Google Drive nie dał adresu wysyłania");
    progress = { name, size: blob.size, sent: 0, t0: Date.now() };
    try {
      let out = null;
      for (let start = 0; start < blob.size; start += CHUNK) out = await putChunk(s.url, blob.slice(start, Math.min(blob.size, start + CHUNK)), start, blob.size);
      if (events.length) await call("events", { name, events }).catch(() => {});
      mbps = blob.size * 8 / Math.max(1, Date.now() - progress.t0) / 1000;
      return { id: out?.id, size: Number(out?.size ?? blob.size) };
    } finally { progress = null; }
  }

  async function upload(blob, name, events = []) {
    // Typ bez kodeków („video/webm;codecs=vp9,opus” → „video/webm”) — przecinek psuł adres data: przy kodowaniu.
    const mime = (blob.type || "video/webm").split(";")[0];
    if (blob.size && await version() >= 2) {
      try { return await uploadResumable(blob, name, events, mime); }
      catch (e) {
        // Skrypt bez zgody na UrlFetchApp (brak uprawnienia „połączenia zewnętrzne”): pliki do ~30 MB
        // wysyłamy starym sposobem, który tej zgody nie potrzebuje.
        if (!/UrlFetchApp|uprawnie|permission/i.test(String(e?.message || e)) || blob.size > 30 * 1048576) throw e;
      }
    }
    const t0 = Date.now();
    token ??= [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`drive:${ACCESS_KEY}`)))].map(b => b.toString(16).padStart(2, "0")).join("");
    const body = JSON.stringify({ action: "upload", token, name, mime, events, data: await toBase64(new Blob([blob], { type: mime })) });
    const out = await post(body, 25 * 60000, name); // wolne łącze + podgląd na żywo
    if (!out.duplicate) mbps = (blob.size * 8 * 4 / 3) / Math.max(1, Date.now() - t0) / 1000;
    return out;
  }
  // Opis bieżącego wysyłania: „Wysyłam kamera-…webm (62 MB): 45%, 1.8 Mb/s” albo „… od 3 min”.
  function sending() {
    if (!progress) return "";
    const sec = Math.max(1, (Date.now() - progress.t0) / 1000);
    const mb = Math.round(progress.size / 1048576);
    if (progress.sent !== undefined) return `Wysyłam ${progress.name} (${mb} MB): ${Math.round(100 * progress.sent / progress.size)}%, ${(progress.sent * 8 / sec / 1e6).toFixed(1)} Mb/s.`;
    return `Wysyłam ${progress.name} (${mb} MB) od ${Math.floor(sec / 60)} min.`;
  }
  return { enabled, call, upload, sending, version, get big() { return scriptVersion >= 2; }, get mbps() { return mbps; } };
})();

// ---------- Nagrywanie ciągłe 24/7 → trwałe pliki na dysku komputera-kamery ----------
// Każdy 10-minutowy plik najpierw trafia do wybranego folderu na dysku. IndexedDB jest tylko podręczną
// kopią do szybkiego odtwarzania na telefonie przez WebRTC. Na Google Drive NIC nie idzie samo — tylko po kliknięciu.
// Obraz w pełnej rozdzielczości kamery: 5 kl./s gdy spokojnie, 30 kl./s przy ruchu/dźwięku (+10 s po ustaniu).
const REC_MIME = (() => {
  if (typeof MediaRecorder === "undefined") return null;
  // MP4/H.264: odtwarza go iPhone i przyjmuje WhatsApp/Messenger; zapasowo WebM (AV1/VP9).
  // Samo „video/mp4” bez kodeka bywa VP9 w MP4, którego iPhone nie odtworzy — więc dopiero po WebM.
  return ["video/mp4;codecs=avc1,mp4a", "video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1.4d0028,mp4a.40.2", "video/mp4;codecs=avc1,opus", "video/mp4;codecs=avc1",
    "video/webm;codecs=av01,opus", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find(t => MediaRecorder.isTypeSupported(t)) ?? "";
})();
const SLOW_FPS = 5, FAST_FPS = 30, FAST_HOLD_MS = 10000;
const REC_AUDIO_BPS = 64000;

const archive = (() => {
  let source = null, recStream = null, running = false, rec = null, segTimer = null, clock = null;
  let recSince = 0, saved = 0, lastName = "", lastError = "", queued = 0, sentToDrive = 0, pumping = false, retryTimer = null, looped = 0;
  let local = { count: 0, bytes: 0, oldest: 0 }, free = Infinity, persisted = false;
  let diskFiles = { count: 0, bytes: 0, oldest: 0 };
  let disk = { selected: false, name: "", ready: false, saved: 0, error: "" };
  let fast = false, slowTimer = null, segStart = 0, watermarkStop = null;
  // Limit skryptu Google w starej wersji (bez wysyłania w kawałkach): ok. 35 MB pliku.
  const MAX_UPLOAD = 34 * 1024 * 1024;
  const oversize = new Set();
  const adaptive = () => !!prefs.detect; // bez wykrywania ruchu — stale 30 kl./s

  async function refreshLocal() {
    try { local = await recstore.stats(); free = (await recstore.space()).free; } catch { /* brak IndexedDB */ }
    try {
      const files = await diskstore.list();
      diskFiles = { count: files.length, bytes: files.reduce((sum, f) => sum + f.size, 0), oldest: files.length ? Math.min(...files.map(f => nameTime(f.name) || f.lastModified)) : 0 };
    } catch { /* folder zostanie opisany przez stan dysku */ }
    render();
  }

  // Jednorazowa naprawa starszych nagrań (zapisanych bez długości): po kolei, z przerwami, żeby nie obciążać komputera.
  async function repairOld() {
    if (prefs.durFix1) return;
    let fixed = 0;
    const pause = () => new Promise(r => setTimeout(r, 1500));
    try {
      for (const m of await recstore.list()) {
        const b = await recstore.blob(m.name); if (!b) continue;
        const out = await fixMp4Duration(b).catch(() => b);
        if (out !== b) { await recstore.replaceBlob(m.name, out); fixed++; }
        await pause();
      }
      for (const f of await diskstore.list()) {
        const out = await fixMp4Duration(f).catch(() => f);
        if (out !== f && await diskstore.save(f.name, out)) fixed++;
        await pause();
      }
      prefs.durFix1 = true; savePrefs();
      if (fixed) toastMsg(`Naprawiono ${fixed} starszych nagrań — można je przewijać.`);
    } catch { /* spróbujemy przy następnym uruchomieniu */ }
  }

  async function init() {
    setTimeout(repairOld, 60000);
    persisted = !!(await recstore.persist());
    try { disk = { ...disk, ...(await diskstore.status()) }; } catch (e) { disk.error = errText(e); }
    // Jednorazowo: automatyczna kolejka z poprzednich wersji znika — nic nie idzie na Drive bez kliknięcia.
    // Stare pliki czekające w kolejce trafiają na stronę (do biblioteki nagrań), skąd można je wysłać ręcznie.
    if (!prefs.siteOnly) {
      try {
        for (const k of await idb.qKeys()) {
          const it = await idb.qGet(k);
          if (it?.blob && !(await recstore.meta(k))) {
            const t = nameTime(k) || Date.now();
            await recstore.put({ name: k, start: t, end: t + 600000, events: it.events || [], type: it.blob.type, uploaded: false }, it.blob);
          }
          await idb.qDel(k);
        }
        prefs.siteOnly = true; savePrefs();
      } catch { /* spróbujemy przy następnym uruchomieniu */ }
    }
    await refreshLocal();
    resume();
    pump();
    clearInterval(init.timer);
    init.timer = setInterval(refreshLocal, 60000);
  }

  // Wysyła na Google Drive kolejkę: pliki ze zdarzeniami, pliki wysłane ręcznie i stare oczekujące nagrania.
  // Element kolejki: { blob } (stare) albo { ref: nazwa } (plik z pamięci nagrań).
  async function pump() {
    if (!cloud.enabled || pumping) return;
    pumping = true; clearTimeout(retryTimer);
    const skip = new Set();
    oversize.clear();
    await cloud.version();
    const failed = (name, e) => { skip.add(name); lastError = `Nie udało się wysłać ${name} na Google Drive (${errText(e)}). Spróbuję ponownie.`; };
    try {
      for (;;) {
        const keys = await idb.qKeys();
        queued = keys.length; render();
        let key = null, item = null, data = null;
        for (const k of keys) {
          if (skip.has(k)) continue;
          const it = await idb.qGet(k);
          const b = it?.blob || (it?.ref ? await recstore.blob(it.ref) : null);
          if (!b) { await idb.qDel(k); continue; } // nagranie zniknęło w pętli zapisu
          if (!cloud.big && b.size > MAX_UPLOAD) { skip.add(k); oversize.add(k); continue; }
          if (!data || b.size < data.size) { key = k; item = it; data = b; }
        }
        if (!key) break;
        try {
          await cloud.upload(data, key, item.events || []);
          if (item.ref) await recstore.update(item.ref, { uploaded: true }).catch(() => {}); // zostaje też na stronie
          await idb.qDel(key);
          sentToDrive++; lastError = "";
        } catch (e) { failed(key, e); }
      }
    } catch (e) {
      lastError = `Nie udało się wysłać na Google Drive (${errText(e)}). Ponawiam za minutę.`;
    } finally {
      pumping = false; render();
      if (skip.size || lastError) retryTimer = setTimeout(pump, 60000);
    }
  }

  // Ręczne „☁️ Wyślij na Google Drive” z telefonu.
  async function requestUpload(name) {
    const m = await recstore.meta(name);
    const diskFile = !m ? await diskstore.load(name) : null;
    if (!m && !diskFile) throw new Error("tego nagrania nie ma już na komputerze");
    if (m?.uploaded) return { uploaded: true };
    await idb.qPut(name, m ? { ref: name, events: m.events || [] } : { blob: diskFile, events: [] });
    pump();
    return { queued: true };
  }

  let segEvents = null; // zdarzenia (ruch / dźwięk) w bieżącym pliku nagrania
  function markEvent(ev) { segEvents?.push(ev); }

  async function save(data, name, events, start, end) {
    // Długość nagrania wpisana od razu do pliku — przewijanie działa w każdym odtwarzaczu (telefon, WhatsApp, Windows).
    data = await fixMp4Duration(data).catch(() => data);
    let savedToDisk = false;
    try {
      savedToDisk = await diskstore.save(name, data);
      if (savedToDisk) { disk.saved++; disk.ready = true; disk.error = ""; saved++; lastName = name; lastError = ""; }
      else if (disk.selected) { disk.ready = false; disk.error = "Brak zgody na zapis do folderu. Wybierz folder ponownie."; }
    } catch (e) { disk.error = `Nie udało się zapisać do folderu: ${errText(e)}`; }
    // Bez folderu archiwum (albo gdy zapis do niego się nie udał) nagranie trafia do pamięci strony —
    // nigdy nie przepada. Każda 10-minutowa część istnieje tylko raz: w folderze albo w pamięci strony.
    if (!savedToDisk) {
      try {
        await recstore.put({ name, start, end, events: events || [], type: data.type, uploaded: false }, data);
        saved++; lastName = name; lastError = "";
      } catch (e) { lastError = `Nie udało się zapisać ${name}: ${errText(e)}`; }
    }
    // Na Google Drive tylko po kliknięciu „☁️ Prześlij do Google Drive” (requestUpload).
    refreshLocal();
    pump();
  }

  // Kopia obrazu tylko do nagrywania: pełna rozdzielczość kamery, zmienna liczba klatek
  // oraz trwały znacznik daty i godziny wewnątrz zapisanego kadru.
  async function makeRecStream(s) {
    const v = s.getVideoTracks()[0]?.clone();
    fast = !adaptive();
    if (v) { try { await v.applyConstraints({ frameRate: { ideal: fast ? FAST_FPS : SLOW_FPS, max: fast ? FAST_FPS : SLOW_FPS } }); } catch { /* zostaje 30 kl./s */ } }
    if (!v || !HTMLCanvasElement.prototype.captureStream) return new MediaStream([...(v ? [v] : []), ...s.getAudioTracks()]);
    const input = document.createElement("video");
    input.muted = true; input.playsInline = true; input.srcObject = new MediaStream([v]);
    try {
      await new Promise((resolve, reject) => { input.onloadedmetadata = resolve; input.onerror = reject; });
      await input.play();
      const settings = v.getSettings();
      const srcW = settings.width || input.videoWidth || 1280, srcH = settings.height || input.videoHeight || 720;
      // 360p: mały obraz; pozostałe jakości — pełna rozdzielczość kamery.
      const scale = recQuality().height ? Math.min(1, recQuality().height / srcH) : 1;
      const width = Math.round(srcW * scale / 2) * 2, height = Math.round(srcH * scale / 2) * 2;
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("brak obsługi znacznika obrazu");
      // Rysujemy tylko tyle klatek, ile nagrywamy (5 kl./s w spokoju, 30 przy ruchu) — wcześniej ~60 kl./s
      // w pełnej rozdzielczości mocno grzało procesor (głośne wentylatory). Napis liczony raz na sekundę.
      let frame = 0, stopped = false, lastSec = -1, text = "";
      const draw = () => {
        if (stopped) return;
        if (input.readyState >= 2) {
          if (prefs.media === "a") { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, width, height); } // tylko dźwięk
          else ctx.drawImage(input, 0, 0, width, height);
          const sec = Math.floor(Date.now() / 1000);
          if (sec !== lastSec) { lastSec = sec; text = `KAMERA DOMOWA · ${new Date().toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}`; }
          const size = Math.max(20, Math.round(width / 38));
          ctx.font = `700 ${size}px Arial, sans-serif`; ctx.textBaseline = "middle";
          const pad = Math.round(size * .6), boxW = Math.ceil(ctx.measureText(text).width + pad * 2), boxH = Math.round(size * 1.8);
          const x = width - boxW - pad, y = pad;
          ctx.fillStyle = "rgba(3, 8, 22, .78)"; ctx.fillRect(x, y, boxW, boxH);
          ctx.strokeStyle = "rgba(196, 181, 253, .9)"; ctx.lineWidth = Math.max(2, Math.round(size / 13)); ctx.strokeRect(x, y, boxW, boxH);
          ctx.fillStyle = "#ffffff"; ctx.fillText(text, x + pad, y + boxH / 2);
        }
        frame = setTimeout(draw, 1000 / (fast ? FAST_FPS : SLOW_FPS));
      };
      draw();
      const marked = canvas.captureStream(fast ? FAST_FPS : SLOW_FPS).getVideoTracks()[0];
      watermarkStop = () => { stopped = true; clearTimeout(frame); input.pause(); input.srcObject = null; v.stop(); marked.stop(); };
      return new MediaStream([marked, ...s.getAudioTracks()]);
    } catch {
      input.pause(); input.srcObject = null;
      return new MediaStream([v, ...s.getAudioTracks()]);
    }
  }

  function setFps(fps) { recStream?.getVideoTracks()[0]?.applyConstraints({ frameRate: { ideal: fps, max: fps } }).catch(() => {}); }

  // Ruch lub dźwięk: od razu 30 kl./s, powrót do 5 kl./s po 10 s spokoju.
  function activity() {
    if (!running || !adaptive()) return;
    if (!fast) { fast = true; setFps(FAST_FPS); render(); }
    clearTimeout(slowTimer);
    slowTimer = setTimeout(() => { fast = false; setFps(SLOW_FPS); render(); }, FAST_HOLD_MS);
  }

  function startSegment() {
    if (!running || !recStream) return;
    const startedAt = new Date();
    segStart = startedAt.getTime();
    const opts = { ...(REC_MIME ? { mimeType: REC_MIME } : {}), videoBitsPerSecond: recQuality().bps, audioBitsPerSecond: REC_AUDIO_BPS, ...(recQuality().cbr ? { videoBitrateMode: "constant" } : {}) };
    let r;
    try { r = new MediaRecorder(recStream, opts); }
    catch {
      const { videoBitrateMode, ...plain } = opts; // starsza przeglądarka bez stałej przepływności
      try { r = new MediaRecorder(recStream, plain); }
      catch { r = new MediaRecorder(recStream); } // kodek niedostępny — domyślny przeglądarki
    }
    const chunks = [], events = [];
    segEvents = events;
    r.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    r.onstop = () => {
      if (!chunks.length) return;
      const type = r.mimeType || REC_MIME || "video/webm";
      const file = new Blob(chunks, { type });
      if (!file.size) return; // przerwane przełączenie nigdy nie tworzy pustego „nagrania”
      save(file, `kamera-${stamp(startedAt)}.${extFor(type)}`, events, startedAt.getTime(), Date.now());
    };
    r.onerror = e => { lastError = `Błąd nagrywania: ${errText(e.error || e)}`; render(); };
    r.start(5000);
    rec = r;
    clearTimeout(segTimer);
    segTimer = setTimeout(rotate, Number(prefs.segmentMin) * 60000);
  }

  // Nowy plik startuje zanim zamkniemy poprzedni — bez dziury w nagraniu.
  function rotate() {
    const old = rec;
    if (running && source) startSegment();
    if (old && old.state !== "inactive") old.stop();
  }

  async function resume() {
    if (!running && source && REC_MIME !== null) {
      running = true; recSince = Date.now();
      recStream = await makeRecStream(source);
      if (!running) { recStream.getVideoTracks().forEach(t => t.stop()); recStream = null; return; }
      startSegment();
      clearInterval(clock);
      clock = setInterval(() => { $("recTime").textContent = fmtTime(Math.floor((Date.now() - recSince) / 1000)); }, 1000);
    }
    render();
  }

  function halt() {
    running = false;
    clearTimeout(segTimer); clearInterval(clock); clearTimeout(slowTimer);
    if (rec && rec.state !== "inactive") rec.stop();
    rec = null;
    const stopWatermark = watermarkStop; watermarkStop = null;
    const rs = recStream; recStream = null;
    setTimeout(() => { stopWatermark?.(); rs?.getVideoTracks().forEach(t => t.stop()); }, 1000);
  }

  function start(s) { source = s; resume(); }
  function stop() { halt(); source = null; render(); }
  function restart() { if (running) { halt(); resume(); } else render(); }

  const gb = n => `${(n / 1073741824).toFixed(1)} GB`;
  function describe() {
    if (REC_MIME === null) return "Ta przeglądarka nie obsługuje nagrywania.";
    let text = prefs.mode === "off" ? "Kamera wstrzymana z telefonu — nie nagrywa i nie nadaje."
      : prefs.mode === "preview" ? "Tylko na żywo — bez zapisu plików."
      : prefs.mode === "rec-only" && running ? `Tylko zapis (bez transmisji na żywo), pliki co ${prefs.segmentMin} min.`
      : running && prefs.recordUntil > Date.now() ? `Nagranie jednorazowe do ${new Date(prefs.recordUntil).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}, potem tylko podgląd.`
      : running ? `Nagrywa bez przerwy (pliki co ${prefs.segmentMin} min).` : "Nagrywanie ruszy, gdy kamera będzie włączona.";
    if (disk.ready) text += ` Trwałe archiwum: folder „${disk.name}”; plików na dysku: ${diskFiles.count} (${gb(diskFiles.bytes)}).`;
    else if (disk.selected) text += ` ⚠ Folder „${disk.name}” czeka na ponowną zgodę Chrome (po odświeżeniu strony) — na komputerze kliknij „Przywróć dostęp do folderu”. Pliki w folderze są bezpieczne; do tego czasu nagrania zapisują się w pamięci strony.`;
    else text += " Nagrania zapisują się w pamięci strony (folder archiwum nie jest ustawiony).";
    text += " Na Google Drive tylko po kliknięciu.";
    if (local.count) text += ` W pamięci strony: ${local.count} nagrań (${gb(local.bytes)}).`;
    if (Number.isFinite(free)) text += ` Wolne miejsce dla strony: ${gb(free)}${free < 2 * 1073741824 ? " ⚠ mało miejsca — najstarsze nagrania w pamięci strony są kasowane, żeby nagrywanie nie stanęło" : ""}.${persisted ? "" : " Pamięć nietrwała."}`;
    const set = source?.getVideoTracks()[0]?.getSettings?.() || {};
    if (set.width) text += ` Obraz: ${set.width}×${set.height}, ${fast ? FAST_FPS : SLOW_FPS} kl./s${fast && adaptive() ? " (ruch)" : ""}, ${(REC_MIME || "").split(";")[0] || "domyślny kodek"}, jakość ${recQuality().short}.`;
    if (cloud.enabled) {
      if (queued) text += ` Wysyłam na Google Drive (na Twoje życzenie): ${queued}.`;
      if (sentToDrive) text += ` Wysłano: ${sentToDrive}.`;
      if (oversize.size) text += ` Za duże na starą wersję skryptu: ${oversize.size}.`;
      const now = cloud.sending();
      if (now) text += ` ${now}`;
    }
    return `${text}${disk.error ? ` ${disk.error}` : ""}${lastError ? ` ${lastError}` : ""}`;
  }

  const status = () => ({ recording: running, since: running ? recSince : 0, reason: describe(), folder: disk.ready ? disk.name : "nieustawiony", lastFile: lastName, saved, queued, migrated: sentToDrive });

  function render() {
    $("recBadge").hidden = !running;
    $("archiveInfo").textContent = describe();
    const operational = $("opArchive");
    if (operational) operational.textContent = disk.ready ? `Dysk: ${diskFiles.count} pl.` : disk.selected ? "Przywróć dostęp" : "Wybierz folder";
    const btn = $("chooseArchiveDir");
    if (btn && !btn.disabled) btn.textContent = disk.selected && !disk.ready ? `🔓 Przywróć dostęp do folderu „${disk.name}”` : "📁 Wybierz folder archiwum";
  }

  // ----- Dla telefonu (kanał danych): nagrania z pamięci komputera -----
  const dayOf = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const brief = m => ({ name: m.name, start: m.start, end: m.end, size: m.size, type: m.type, uploaded: !!m.uploaded, events: m.events || [] });
  const diskBrief = f => { const start = nameTime(f.name) || f.lastModified; return { name: f.name, start, end: start + 600000, size: f.size, type: f.type, uploaded: false, events: [] }; };
  async function savedFiles() {
    const files = new Map((await recstore.list()).map(m => [m.name, brief(m)]));
    for (const f of await diskstore.list()) if (!files.has(f.name)) files.set(f.name, diskBrief(f));
    return [...files.values()];
  }
  const local_ = {
    async days() {
      const map = {};
      for (const m of await savedFiles()) { const d = dayOf(m.start); map[d] = (map[d] || 0) + 1; }
      return Object.keys(map).sort().reverse().map(day => ({ day, count: map[day] }));
    },
    async list(day) {
      const out = (await savedFiles()).filter(m => dayOf(m.start) === day);
      // Bieżący, jeszcze nagrywany plik — żeby oś czasu sięgała do „teraz”.
      if (running && rec && dayOf(Date.now()) === day) out.push({ name: null, start: segStart, end: Date.now(), recording: true, events: [...(segEvents || [])] });
      return { files: out, now: Date.now() };
    },
    async file(name) {
      const m = await recstore.meta(name), b = m && await recstore.blob(name);
      if (b) return { blob: b, meta: brief(m) };
      const onDisk = await diskstore.load(name);
      return onDisk ? { blob: onDisk, meta: { name, size: onDisk.size, type: onDisk.type, start: nameTime(name), end: nameTime(name) + 600000, events: [] } } : null;
    },
    upload: requestUpload,
  };

  async function localHours(day) {
    const byHour = {};
    for (const f of (await local_.list(day)).files) {
      if (!f.name) continue;
      const hour = `${pad(new Date(f.start).getHours())}-00`;
      (byHour[hour] ||= []).push({ name: f.name, size: f.size, ev: { ruch: (f.events || []).filter(e => e.kind === "ruch").length, dzwiek: (f.events || []).filter(e => e.kind === "dzwiek").length } });
    }
    return Object.keys(byHour).sort().map(hour => ({ hour, files: byHour[hour].sort((a, b) => a.name.localeCompare(b.name)) }));
  }
  async function shareLocal(f) {
    const got = await local_.file(f.name);
    if (!got) throw new Error("tego pliku nie ma w archiwum na dysku");
    const file = new File([got.blob], f.name, { type: got.blob.type || "video/mp4" });
    const canShareFiles = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
    if (canShareFiles && typeof navigator.share === "function") return navigator.share({ files: [file], title: "Nagranie z kamery" });
    download(got.blob, f.name);
    toastMsg("Pobrano plik — możesz go dodać do Messengera, WhatsAppa, SMS-a lub e-maila.");
  }

  // ----- Biblioteka Google Drive na komputerze (karta „Nagrania”) -----
  async function listDays() { return cloud.enabled ? (await cloud.call("days")).days : []; }
  async function listDay(day) { return cloud.enabled ? (await cloud.call("day", { day })).hours : []; }
  async function remove(t = {}) {
    if (!cloud.enabled) throw new Error("brak skryptu Google Drive");
    await cloud.call("remove", { target: { day: t.day, hour: t.hour, name: t.name } });
  }

  // Chrome po odświeżeniu strony pyta ponownie o zgodę na zapis do folderu — wymaga kliknięcia.
  async function regrantDisk() {
    disk = { ...disk, ...(await diskstore.status(true)) };
    if (disk.ready) { disk.error = ""; await refreshLocal(); }
    render();
    return disk.ready;
  }

  async function chooseDisk() {
    const name = await diskstore.choose();
    disk = { ...disk, selected: true, name, ready: true, error: "" };
    render();
    return name;
  }

  return { init, chooseDisk, regrantDisk, get diskNeedsGrant() { return disk.selected && !disk.ready; }, start, stop, restart, needsGrant: () => false, listDays, listDay, remove, markEvent, activity, status, local: local_, localHours, shareLocal };
})();

// ---------- Kanał sygnalizacji z automatycznym wznawianiem ----------
function reconnectingChannel({ onSignal, onSubscribed, label }) {
  let channel = null, attempt = 0, timer = null, active = false;
  function connect() {
    if (!active) return;
    clearTimeout(timer);
    const old = channel; channel = null;
    if (old) supabase.removeChannel(old);
    const ch = supabase.channel(CHANNEL, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "signal" }, ({ payload }) => Promise.resolve(onSignal(payload)).catch(e => setStatus(`Błąd połączenia: ${errText(e)}`)));
    channel = ch;
    ch.subscribe(s => {
      if (channel !== ch) return;
      if (s === "SUBSCRIBED") { attempt = 0; onSubscribed(ch); }
      else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
        const d = retryDelay(attempt++);
        setStatus(`${label}: utracono połączenie z serwerem. Ponawiam za ${Math.round(d / 1000)} s…`);
        clearTimeout(timer); timer = setTimeout(connect, d);
      }
    });
  }
  return {
    get channel() { return channel; },
    start() { active = true; attempt = 0; connect(); },
    reconnect() { attempt = 0; connect(); },
    stop() { active = false; clearTimeout(timer); const c = channel; channel = null; if (c) supabase.removeChannel(c); },
  };
}
const send = (ch, payload) => ch?.send({ type: "broadcast", event: "signal", payload });

// Polecenia zmieniające pracę komputera-kamery muszą być podpisane kluczem z PIN-u.
// Link odbiorcy zawiera tylko nazwę kanału, dlatego nie wystarcza jako uprawnienie do sterowania.
const OWNER_CONTROL = new Set(["mode-set", "quality-set", "media-set", "restart", "reload"]);
const controlText = sig => `${sig.type}|${sig.mode || ""}|${Number(sig.minutes) || 0}|${sig.q || ""}${sig.media ? `|${sig.media}` : ""}`;
async function signedOwnerControl(payload) {
  if (!ACCESS_KEY) return null;
  const ts = Date.now();
  return { ...payload, ts, mac: await sign(ACCESS_KEY, `${ts}|${controlText(payload)}`) };
}
async function validOwnerControl(sig) {
  if (!OWNER_CONTROL.has(sig.type) || !ACCESS_KEY || !Number.isFinite(sig.ts) || Math.abs(Date.now() - sig.ts) > 60000 || typeof sig.mac !== "string") return false;
  return sig.mac === await sign(ACCESS_KEY, `${sig.ts}|${controlText(sig)}`);
}

// ---------- Biblioteka nagrań: polecenia z telefonu (lista / usuwanie podpisane kluczem z PIN-u) ----------
const library = (() => {
  const nonces = new Map(); // jednorazowe numery do podpisywania poleceń usunięcia (ważne 5 min)
  let fails = 0, lockedUntil = 0;
  const newNonce = () => { const n = b64(crypto.getRandomValues(new Uint8Array(16))); nonces.set(n, Date.now() + 300000); return n; };
  setInterval(() => { const now = Date.now(); for (const [k, v] of nonces) if (v < now) nonces.delete(k); }, 60000);

  async function handle(sig, ch) {
    const reply = extra => send(ch, { type: "lib-reply", reqId: sig.reqId, nonce: newNonce(), ...extra });
    try {
      if (sig.type === "lib-days") return reply({ days: await archive.listDays() });
      if (sig.type === "lib-day") return reply({ hours: await archive.listDay(sig.day) });
      if (sig.type === "lib-delete") {
        if (Date.now() < lockedUntil) return reply({ error: "Za dużo błędnych prób — spróbuj za 10 minut." });
        const exp = nonces.get(sig.nonce); nonces.delete(sig.nonce);
        const ok = exp > Date.now() && sig.mac === await sign(ACCESS_KEY, `${sig.nonce}|${targetString(sig.target || {})}`);
        if (!ok) { if (++fails >= 5) { lockedUntil = Date.now() + 600000; fails = 0; } return reply({ error: "Zły PIN.", badPin: true }); }
        fails = 0;
        await archive.remove(sig.target);
        pcLibrary?.refresh();
        return reply({ ok: true });
      }
    } catch (e) { return reply({ error: errText(e) }); }
  }

  return { handle };
})();
let pcLibrary = null;

// ---------- Wykrywanie ruchu i dźwięku (kroki, głosy) na komputerze-kamerze ----------
const fmtClock = t => new Date(t).toLocaleTimeString("pl-PL");
const recentEvents = [];
function renderEvents(listId, items) {
  const ul = $(listId);
  if (!ul) return;
  ul.replaceChildren(...(items.length ? items.map(e => Object.assign(document.createElement("li"), { textContent: `${fmtClock(e.at)} — ${EVENT_LABEL[e.kind] || e.kind}` }))
    : [Object.assign(document.createElement("li"), { className: "muted", textContent: "Brak zdarzeń." })]));
}
const detector = createDetector({
  getSensitivity: () => prefs.sensitivity,
  onActivity: () => archive.activity(),
  onEvent: ev => {
    archive.markEvent(ev);
    sender.notifyViewers(ev);
    recentEvents.unshift(ev); recentEvents.length = Math.min(recentEvents.length, 30);
    renderEvents("pcEvents", recentEvents);
  },
});

// ---------- Jakość WebRTC ----------
// H.264 na pierwszym miejscu (iPhone dekoduje go sprzętowo — płynniej i mniej baterii), reszta jako zapas.
function preferH264(pc) {
  const caps = RTCRtpSender.getCapabilities?.("video");
  if (!caps) return;
  const h264 = caps.codecs.filter(c => /h264/i.test(c.mimeType));
  const rest = caps.codecs.filter(c => !/h264/i.test(c.mimeType));
  for (const t of pc.getTransceivers()) {
    if (t.sender.track?.kind === "video" && t.setCodecPreferences && h264.length) {
      try { t.setCodecPreferences([...h264, ...rest]); } catch { /* przeglądarka bez tej opcji */ }
    }
  }
}

// Chrome zaczyna od ~300 kb/s i powoli podnosi jakość — zaczynamy od razu wysoko, żeby obraz był ostry od pierwszej sekundy.
function fastStart(sdp) {
  const kbps = Math.round(LIVE_MAX_BITRATE / 1000);
  let inVideo = false, inAudio = false;
  return sdp.split("\r\n").map(line => {
    if (line.startsWith("m=")) { inVideo = line.startsWith("m=video"); inAudio = line.startsWith("m=audio"); }
    // Dźwięk na żywo w wysokiej jakości (Opus do 128 kb/s, odporny na utratę pakietów).
    if (inAudio && line.startsWith("a=fmtp:") && line.includes("useinbandfec") && !line.includes("maxaveragebitrate")) return `${line};maxaveragebitrate=128000`;
    if (inVideo && line.startsWith("a=fmtp:") && !line.includes("x-google-start-bitrate")) {
      return `${line};x-google-min-bitrate=600;x-google-start-bitrate=1000;x-google-max-bitrate=${kbps}`;
    }
    return line;
  }).join("\r\n");
}

// Wyższy limit przepływności; przy słabszym łączu równoważy ostrość i płynność.
// cropWidth: szerokość wysyłanego kadru — powyżej Full HD zmniejszamy, żeby łącze i procesor nadążały.
async function tuneVideoSender(pc, cropWidth = 0) {
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind !== "video") continue;
    try {
      const p = sender.getParameters();
      if (!p.encodings?.length) p.encodings = [{}];
      p.encodings[0].scaleResolutionDownBy = Math.max(1, (cropWidth || sender.track.getSettings?.().width || 1920) / LIVE_SEND_WIDTH);
      p.encodings[0].maxBitrate = LIVE_MAX_BITRATE;
      p.encodings[0].maxFramerate = LIVE_SEND_FPS;
      p.degradationPreference = "balanced";
      await sender.setParameters(p);
    } catch { /* starsza przeglądarka — zostają ustawienia domyślne */ }
  }
}

// Karta „Kontrola kamery” (komputer i telefon): czy kamera i mikrofon są podłączone, czy obraz dociera,
// czy trwa zapis i jaki był ostatni plik. Dane z komputera-kamery (heartbeat co 15 s).
function renderDiag(d, extra = []) {
  if (!$("diagList") || !d) return;
  const ok = (good, text) => Object.assign(document.createElement("li"), { className: good ? "ok" : "bad", textContent: `${good ? "✅" : "❌"} ${text}` });
  const rows = [
    ok(!!d.cam && d.camLive, d.cam ? `Kamera podłączona: ${d.cam}${d.w ? ` · ${d.w}×${d.h}` : ""}${d.fps ? ` · ${d.fps} kl./s` : ""}` : `Kamera nie daje obrazu${d.camError ? ` — ${d.camError}` : ""}`),
    ok(!!d.mic && d.micOn, d.mic ? `Mikrofon podłączony: ${d.mic}` : "Mikrofon nie jest używany (brak dźwięku w nagraniach)"),
    ok(d.recording, d.recording ? `Nagrywanie trwa · ${d.quality || ""}` : d.mode === "preview" ? "Nie nagrywa — tryb „Sam podgląd”" : d.mode === "off" ? "Nie nagrywa — kamera wyłączona" : "Nie nagrywa"),
    ok(!!d.lastFile, d.lastFile ? `Ostatni zapisany plik: ${d.lastFile}` : "Jeszcze żaden plik nie został zapisany w tej sesji (pierwszy po ok. 10 min)"),
    ...extra,
  ];
  $("diagList").replaceChildren(...rows);
  $("diagTime").textContent = `sprawdzono ${new Date().toLocaleTimeString("pl-PL")} · wersja ${d.version || "?"}`;
  $("diagCard").hidden = false;
}
const diagRow = (good, text) => Object.assign(document.createElement("li"), { className: good ? "ok" : "bad", textContent: `${good ? "✅" : "❌"} ${text}` });

// Pasek pod osią czasu: licznik nagrywania (godz:min:s) i przyciski Start / Stop / Restart.
const ctrlState = { recording: false, since: 0, mode: "", until: 0, skew: 0, hasCam: true };
let viewingArchive = false;
function paintSystemPanel() {
  if (!$("systemPanel")) return;
  const now = Date.now() + ctrlState.skew;
  const active = RECORDING_MODES.has(ctrlState.mode) && ctrlState.recording;
  $("systemView").textContent = viewingArchive ? "Nagranie z archiwum" : "Obraz na żywo";
  $("systemMode").textContent = ctrlState.mode === "off" ? "Kamera wyłączona" : ctrlState.mode === "preview" ? "Na żywo bez zapisu" : ctrlState.mode === "rec-only" ? "Zapis bez transmisji" : active ? "Na żywo + zapis 24/7" : "Uruchamianie kamery";
  $("systemArchive").textContent = active ? `Plik co ${prefs.segmentMin} min · ${recQuality().short}` : "Brak zapisu w tym trybie";
  const badge = $("systemStateBadge");
  badge.textContent = viewingArchive ? "ARCHIWUM" : active ? "● NAGRYWA" : ctrlState.mode === "preview" ? "PODGLĄD" : ctrlState.mode === "off" ? "WYŁĄCZONA" : "ŁĄCZENIE";
  badge.dataset.state = viewingArchive ? "archive" : active ? "record" : ctrlState.mode || "waiting";
  $("systemHint").textContent = viewingArchive
    ? "Odtwarzasz zapisane wydarzenie. Przycisk „● NA ŻYWO” pod osią czasu wraca do bieżącego obrazu."
    : ctrlState.mode === "preview" ? "Kamera pokazuje bieżący obraz, ale nie zapisuje plików."
    : ctrlState.mode === "off" ? "Kamera i zapis są zatrzymane — użyj Start albo trybu „Na żywo + zapis”."
    : active ? `Bieżący obraz jest zapisywany w osobnych plikach co ${prefs.segmentMin} minut.` : "Łączę się z kamerą i sprawdzam stan zapisu.";
}
function setCtrlState(s) { Object.assign(ctrlState, s); paintCtrl(); paintSystemPanel(); }
function paintCtrl() {
  const now = Date.now() + ctrlState.skew;
  const rec = ctrlState.recording && ctrlState.since > 0;
  $("ctrlTime").textContent = fmtTime(rec ? Math.max(0, Math.floor((now - ctrlState.since) / 1000)) : 0);
  $("ctrlLabel").textContent = !ctrlState.mode ? "łączenie z kamerą…"
    : ctrlState.mode === "off" ? "kamera wyłączona"
    : !ctrlState.hasCam ? "brak obrazu z kamery"
    : rec ? (ctrlState.until > now ? `na żywo · nagrywa jednorazowo (do ${new Date(ctrlState.until).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })})` : "na żywo · nagrywa bez przerwy")
    : ctrlState.mode === "preview" ? "na żywo · bez nagrywania" : ctrlState.mode === "rec-only" ? "tylko zapis · bez transmisji na żywo" : "na żywo · nagrywanie zaraz ruszy";
  $("ctrlBar").dataset.state = ctrlState.mode === "off" ? "off" : rec ? "rec" : ctrlState.mode ? "live" : "";
}
setInterval(paintCtrl, 1000);

// Panel „Sterowanie kamerą” (telefon i komputer): podświetla bieżący tryb i pokazuje czas nagrania jednorazowego.
function paintMode(m, until = 0) {
  $("modeCard").hidden = false;
  const once = m === "record" && until > Date.now();
  const shown = once ? "once" : m;
  document.querySelectorAll("#modeCard [data-mode]").forEach(b => b.classList.toggle("on", b.dataset.mode === shown));
  $("onceLeft").textContent = once ? `zostało ${Math.max(1, Math.ceil((until - Date.now()) / 60000))} min` : "";
}

// ---------- NADAJNIK (komputer z kamerą) ----------
const sender = (() => {
  const peers = new Map();
  let zoomer = null, cropWidth = 0; // zbliżenie: wycinany kadr z pełnej rozdzielczości kamery
  let stream = null, live = false, heartbeat = null, reportTimer = null, keepAlive = null, camTimer = null, scheduleTimer = null, camAttempt = 0, wakeLock = null, lastCameraError = "";
  // Dwa skróty Windows lub dwie przypadkowo otwarte karty nie mogą nagrywać tą samą kamerą równocześnie.
  // Dzierżawa jest odnawiana co 10 s i po 35 s sama wygasa, np. po awarii przeglądarki.
  const senderLockKey = "prywatna-kamera-sender-lock-v1";
  const senderLockId = crypto.randomUUID();
  let senderLockTimer = null;
  const readSenderLock = () => { try { return JSON.parse(localStorage.getItem(senderLockKey) || "null"); } catch { return null; } };
  const lockFresh = lock => lock && Number.isFinite(lock.at) && Date.now() - lock.at < 35000;
  function renewSenderLock() {
    try { localStorage.setItem(senderLockKey, JSON.stringify({ id: senderLockId, at: Date.now() })); } catch { /* tryb prywatny — kamera pozostaje uruchamialna */ }
  }
  function claimSenderLock() {
    const other = readSenderLock();
    if (lockFresh(other) && other.id !== senderLockId) return false;
    renewSenderLock();
    const check = readSenderLock();
    return !check || check.id === senderLockId;
  }
  function releaseSenderLock() {
    clearInterval(senderLockTimer); senderLockTimer = null;
    try { if (readSenderLock()?.id === senderLockId) localStorage.removeItem(senderLockKey); } catch { /* brak localStorage */ }
  }
  window.addEventListener("storage", e => {
    if (e.key !== senderLockKey || !live) return;
    let lock = null; try { lock = e.newValue && JSON.parse(e.newValue); } catch { /* zły wpis ignorujemy */ }
    if (lockFresh(lock) && lock.id !== senderLockId) {
      setStatus("Druga karta kamery jest już uruchomiona na tym komputerze — nie tworzę podwójnego nagrania.");
      stop();
    }
  });
  const chan = reconnectingChannel({
    label: "Nadajnik",
    onSignal,
    onSubscribed: ch => { if (stream) setStatus(""); send(ch, { type: "broadcaster-ready" }); },
  });

  function renderViewers() { if (live) showLive(`NA ŻYWO · oglądający: ${peers.size}`); }
  function closePeer(id) { peers.get(id)?.pc.close(); peers.delete(id); renderViewers(); }
  function closeAll() { peers.forEach(p => p.pc.close()); peers.clear(); renderViewers(); }

  async function connectViewer(viewerId) {
    const ch = chan.channel;
    if (!ch || !stream) return;
    if (!peers.has(viewerId) && peers.size >= MAX_VIEWERS) return send(ch, { type: "busy", viewerId });
    closePeer(viewerId);
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    const peer = { pc, pending: [] };
    peers.set(viewerId, peer); renderViewers();
    // „Tylko zapis”: bez obrazu i dźwięku na żywo — zostaje kanał danych (telefon nadal przegląda nagrania).
    const out = zoomer?.stream || stream;
    if (prefs.mode !== "rec-only") out.getTracks().forEach(t => pc.addTrack(t, out));
    // Kanał danych: telefon ogląda i pobiera nagrania z pamięci tego komputera.
    serveRecordings(pc.createDataChannel("nagrania", { ordered: true }), archive.local);
    preferH264(pc);
    pc.onicecandidate = e => { if (e.candidate) send(ch, { type: "ice", viewerId, from: "broadcaster", candidate: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => { if (["failed", "closed"].includes(pc.connectionState) && peers.get(viewerId)?.pc === pc) closePeer(viewerId); };
    const offer = await pc.createOffer();
    offer.sdp = fastStart(offer.sdp);
    await pc.setLocalDescription(offer);
    await tuneVideoSender(pc, cropWidth);
    send(ch, { type: "offer", viewerId, sdp: offer });
  }

  async function onSignal(sig) {
    if (typeof sig.type === "string" && sig.type.startsWith("lib-") && sig.type !== "lib-reply") return library.handle(sig, chan.channel);
    if (sig.type === "viewer-join") return connectViewer(sig.viewerId);
    if (sig.type === "zoom" && zoomer) { zoomer.set(sig); return sendZoomState(); }
    if (sig.type === "zoom-get") return sendZoomState();
    // Drugi nadajnik (inna przeglądarka lub profil na tym samym komputerze) ma już obraz z kamery,
    // a to okno nie (kamera zajęta) — wycofujemy się, żeby nie walczyć o kamerę i nie mylić stanu.
    if (sig.type === "heartbeat") {
      if (sig.from && sig.from !== INSTANCE && sig.hasCam && live && !stream) yieldToOther();
      return;
    }
    if (sig.type === "takeover") { if (sig.from && sig.from !== INSTANCE && live) yieldToOther(); return; }
    if (OWNER_CONTROL.has(sig.type)) {
      if (!(await validOwnerControl(sig))) return;
      if (sig.type === "mode-set") return setMode(sig.mode, sig.minutes);
      if (sig.type === "quality-set") return setQuality(sig.q);
      if (sig.type === "media-set") return setMedia(sig.media);
      if (sig.type === "restart") return restart();
      if (sig.type === "reload") return forceReload();
    }
    if (sig.type === "viewer-leave") return closePeer(sig.viewerId);
    const peer = sig.viewerId ? peers.get(sig.viewerId) : null;
    if (!peer) return;
    if (sig.type === "answer") {
      await peer.pc.setRemoteDescription(sig.sdp);
      for (const c of peer.pending.splice(0)) await peer.pc.addIceCandidate(c);
    } else if (sig.type === "ice" && sig.from === "viewer") {
      if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(sig.candidate); else peer.pending.push(sig.candidate);
    }
  }

  async function requestWakeLock() { try { wakeLock = await navigator.wakeLock?.request("screen") ?? null; } catch { /* brak wsparcia */ } }

  const mediaConstraints = deviceId => ({
    // Ok. 1920 px szerokości przy 30 kl./s — płynny obraz. Pełne 5 MP kamery dają tylko kilka klatek na sekundę.
    video: { width: { ideal: 1920 }, frameRate: { ideal: LIVE_FPS, max: LIVE_FPS }, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) },
    // Mikrofon: tłumienie szumów, usuwanie echa i automatyczne wzmocnienie włączone (czysty, wyrównany dźwięk).
    audio: prefs.audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
  });
  const getMedia = async deviceId => {
    try {
      const s = await navigator.mediaDevices.getUserMedia(mediaConstraints(deviceId));
      s.getVideoTracks().forEach(t => { t.contentHint = "motion"; });
      return s;
    } catch (e) {
      // Brak mikrofonu (odłączony / wyłączony) = przeglądarka odrzuca też obraz. Próbujemy sam obraz.
      if (e?.name === "NotFoundError" && prefs.audio) {
        const s = await navigator.mediaDevices.getUserMedia({ video: mediaConstraints(deviceId).video, audio: false });
        s.getVideoTracks().forEach(t => { t.contentHint = "motion"; });
        return s;
      }
      // Starsze/tańsze kamery czasem odrzucają 1080p/30 fps mimo że działają bez dodatkowych wymagań.
      if (e?.name !== "OverconstrainedError") throw e;
      const s = await navigator.mediaDevices.getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId } } : true, audio: prefs.audio ? true : false });
      s.getVideoTracks().forEach(t => { t.contentHint = "motion"; });
      return s;
    }
  };

  function cameraErrorMessage(e) {
    const name = e?.name || "";
    if (name === "NotAllowedError" || name === "SecurityError") return "Brak zgody na kamerę lub mikrofon. W ustawieniach strony zezwól na dostęp, potem kliknij „Spróbuj ponownie”.";
    if (name === "NotReadableError" || name === "TrackStartError") return "Kamera jest zajęta przez inny program albo kartę. Zamknij program używający kamery (np. Teams, Zoom, OBS lub inną kartę), potem kliknij „Spróbuj ponownie”.";
    if (name === "NotFoundError" || name === "DevicesNotFoundError") return "Nie znaleziono kamery. Sprawdź kabel/USB albo wybierz kamerę z listy.";
    if (name === "AbortError") return "Uruchamianie kamery zostało przerwane. Kliknij „Spróbuj ponownie”.";
    return `Nie udało się uruchomić kamery${e?.message ? `: ${e.message}` : ""}. Kliknij „Spróbuj ponownie”.`;
  }

  // Lista kamer do wyboru + automatyczny wybór prawdziwej kamery zamiast wirtualnej.
  // Tylko prawdziwe kamery — wirtualne (OBS, Snap, ManyCam…) nie pojawiają się na liście i nigdy nie są używane.
  async function listCameras() {
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput" && !VIRTUAL_CAM.test(d.label));
    const sel = $("cameraSelect");
    sel.innerHTML = "";
    sel.append(new Option("Automatycznie", ""));
    cams.forEach((c, i) => sel.append(new Option(c.label || `Kamera ${i + 1}`, c.deviceId)));
    sel.value = cams.some(c => c.deviceId === prefs.cameraId) ? prefs.cameraId : "";
    return cams;
  }

  async function openBestCamera() {
    let s;
    try { s = await getMedia(prefs.cameraId); }
    catch (e) {
      if (!prefs.cameraId) throw e;
      prefs.cameraId = ""; savePrefs(); // zapamiętana kamera zniknęła — wybierz automatycznie
      s = await getMedia("");
    }
    const cams = await listCameras().catch(() => []);
    if (VIRTUAL_CAM.test(s.getVideoTracks()[0]?.label || "")) {
      s.getTracks().forEach(t => t.stop());
      if (prefs.cameraId) { prefs.cameraId = ""; savePrefs(); }
      if (!cams.length) throw new Error("nie znaleziono prawdziwej kamery (wirtualne kamery, np. OBS, są pomijane) — podłącz kamerę");
      s = await getMedia(cams[0].deviceId);
    }
    return s;
  }

  let camWaitSince = 0; // >0 = czekamy na kamerę (np. okno zgody przeglądarki)
  async function acquireCamera() {
    camWaitSince = Date.now();
    try {
      const s = await openBestCamera();
      camWaitSince = 0;
      if (!live) { s.getTracks().forEach(t => t.stop()); return false; }
      stream = s;
      lastCameraError = ""; $("retryCameraBtn").hidden = true;
      video.srcObject = s; video.muted = true;
      zoomer?.stop();
      zoomer = createZoomer(s, w => { cropWidth = w; peers.forEach(p => tuneVideoSender(p.pc, w)); });
      showPlaceholder("");
      s.getVideoTracks()[0]?.addEventListener("ended", () => { if (live && stream === s) cameraLost(); });
      camAttempt = 0;
      applyMedia();
      if (prefs.mode !== "preview" && recordingScheduledNow()) archive.start(s);
      else archive.stop();
      if (prefs.detect) detector.start(s, video);
      return true;
    } catch (e) {
      camWaitSince = 0;
      lastCameraError = `${cameraErrorMessage(e)} [${e?.name || "błąd"}]`;
      $("retryCameraBtn").hidden = false;
      setStatus(`${lastCameraError} Automatyczna próba zostanie ponowiona.`);
      return false;
    }
  }

  function cameraLost() {
    archive.stop(); detector.stop(); closeAll();
    zoomer?.stop(); zoomer = null;
    stream?.getTracks().forEach(t => t.stop()); stream = null;
    video.srcObject = null; showPlaceholder("Utracono obraz z kamery…");
    setStatus("Utracono obraz z kamery — próbuję ją ponownie uruchomić…");
    scheduleCameraRetry();
  }

  function scheduleCameraRetry() {
    clearTimeout(camTimer);
    camTimer = setTimeout(async () => {
      if (!live || prefs.mode === "off") return;
      if (await acquireCamera()) { setStatus(""); send(chan.channel, { type: "broadcaster-ready" }); }
      else if (live) scheduleCameraRetry();
    }, retryDelay(camAttempt++));
  }

  // Tryb ustawiany z telefonu: „record” = podgląd + nagrywanie, „preview” = tylko podgląd, „off” = kamera wyłączona.
  // Przy „off” strona dalej słucha poleceń, więc telefon może ją w każdej chwili włączyć z powrotem.
  // „once” = nagranie jednorazowe na `minutes` minut, potem kamera sama wraca do samego podglądu.
  // Źródło (obraz/dźwięk) dla transmisji i zapisu: wyłączona ścieżka daje czarny obraz albo ciszę.
  function applyMedia() {
    stream?.getVideoTracks().forEach(t => { t.enabled = prefs.media !== "a"; });
    stream?.getAudioTracks().forEach(t => { t.enabled = prefs.media !== "v"; });
  }
  function setMedia(m) {
    if (!MEDIA_LABEL[m]) return;
    prefs.media = m; savePrefs(); applyMedia();
    if ($("mediaPick")) $("mediaPick").value = m;
    beat(); report();
  }

  async function setMode(m, minutes) {
    if (!live || !["record", "rec-only", "once", "preview", "off"].includes(m)) return;
    prefs.recordUntil = m === "once" ? Date.now() + Math.min(240, Math.max(1, Number(minutes) || 15)) * 60000 : 0;
    if (m === "once") m = "record";
    const liveChanged = (prefs.mode === "rec-only") !== (m === "rec-only");
    prefs.mode = m; savePrefs();
    // Włączenie/wyłączenie transmisji: oglądający łączą się ponownie (z obrazem albo tylko z nagraniami).
    if (liveChanged && stream && m !== "off") { closeAll(); send(chan.channel, { type: "broadcaster-ready" }); }
    if (m === "off") {
      clearTimeout(camTimer);
      archive.stop(); detector.stop(); closeAll();
      zoomer?.stop(); zoomer = null;
      stream?.getTracks().forEach(t => t.stop()); stream = null;
      video.srcObject = null; setStatus(""); showPlaceholder("Kamera wstrzymana — włącz ją z telefonu.");
    } else if (!stream) {
      camAttempt = 0; setStatus("Uruchamiam kamerę i mikrofon…");
      if (await acquireCamera()) { setStatus(""); send(chan.channel, { type: "broadcaster-ready" }); }
      else if (live) scheduleCameraRetry();
    } else if (RECORDING_MODES.has(m) && recordingScheduledNow()) archive.start(stream);
    else archive.stop();
    beat();
    report();
  }

  async function retryCamera() {
    if (!live) return start();
    clearTimeout(camTimer); camAttempt = 0;
    setStatus("Ponawiam uruchamianie kamery…");
    if (await acquireCamera()) { setStatus(""); send(chan.channel, { type: "broadcaster-ready" }); }
    else if (live) scheduleCameraRetry();
  }

  function applyRecordingPlan() {
    // Koniec nagrania jednorazowego → sam podgląd.
    if (prefs.recordUntil && prefs.recordUntil <= Date.now()) { prefs.recordUntil = 0; savePrefs(); if (prefs.mode === "record") return setMode("preview"); }
    if (!live || !stream) return;
    if (RECORDING_MODES.has(prefs.mode) && recordingScheduledNow()) archive.start(stream);
    else archive.stop();
    report();
  }

  // Zmiana kamery z listy: przełącz obraz i daj znać oglądającym, żeby połączyli się ponownie.
  // Restart: kamera i nagrywanie od nowa (bieżący plik zostaje zapisany), oglądający łączą się ponownie.
  async function restart() {
    if (!live) return start();
    if (prefs.mode === "off") return setMode("record");
    setStatus("Restartuję kamerę…");
    await switchCamera();
    beat(); report();
  }

  async function switchCamera() {
    if (!live) return;
    archive.stop(); detector.stop(); closeAll();
    zoomer?.stop(); zoomer = null;
    stream?.getTracks().forEach(t => t.stop()); stream = null;
    lastCameraError = ""; $("retryCameraBtn").hidden = true;
    if (await acquireCamera()) {
      setStatus("");
      send(chan.channel, { type: "broadcaster-ready" });
    } else scheduleCameraRetry();
  }

  async function start() {
    if (live) return;
    if (!claimSenderLock()) {
      $("startBtn").hidden = false; $("stopBtn").hidden = true;
      showLive(""); showPlaceholder("Kamera działa już w innym oknie na tym komputerze.");
      setStatus("Nie uruchomiono drugiej kamery, aby nie powstały podwójne nagrania.");
      return false;
    }
    live = true;
    clearInterval(senderLockTimer); senderLockTimer = setInterval(renewSenderLock, 10000);
    $("startBtn").hidden = true; $("stopBtn").hidden = false;
    showLive("NA ŻYWO · oglądający: 0");
    if (prefs.mode === "off") { setStatus(""); showPlaceholder("Kamera wstrzymana — włącz ją z telefonu."); }
    else {
      setStatus("Uruchamiam kamerę i mikrofon…");
      if (!(await acquireCamera()) && live) scheduleCameraRetry();
    }
    chan.start();
    clearInterval(heartbeat);
    heartbeat = setInterval(beat, HEARTBEAT_MS);
    clearInterval(scheduleTimer);
    scheduleTimer = setInterval(applyRecordingPlan, 30000);
    clearInterval(reportTimer);
    reportTimer = setInterval(report, 60000);
    setTimeout(report, 5000);
    // Lekki sygnał do Supabase co 6 h, żeby darmowy projekt nie był uznany za nieużywany.
    clearInterval(keepAlive);
    keepAlive = setInterval(() => { fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } }).catch(() => {}); }, 6 * 3600000);
    clearInterval(updateTimer);
    updateTimer = setInterval(checkUpdate, 10 * 60000);
    requestWakeLock();
  }

  function stop() {
    if (!live) return;
    live = false;
    releaseSenderLock();
    archive.stop(); detector.stop();
    clearInterval(heartbeat); clearInterval(reportTimer); clearInterval(keepAlive); clearInterval(updateTimer); clearInterval(scheduleTimer); clearTimeout(camTimer);
    if (!yielded) send(chan.channel, { type: "broadcaster-stop" }); // drugie okno nie wyłącza obrazu u oglądających
    report();
    chan.stop();
    closeAll();
    zoomer?.stop(); zoomer = null;
    stream?.getTracks().forEach(t => t.stop()); stream = null;
    video.srcObject = null;
    wakeLock?.release().catch(() => {}); wakeLock = null;
    $("startBtn").hidden = false; $("stopBtn").hidden = true;
    showLive(""); showPlaceholder("Kamera wyłączona"); setStatus("");
  }

  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && live) requestWakeLock(); });
  window.addEventListener("online", () => { if (live) chan.reconnect(); });
  window.addEventListener("beforeunload", () => { if (live) send(chan.channel, { type: "broadcaster-stop" }); releaseSenderLock(); });

  // Samoaktualizacja komputera-kamery: nowa wersja strony (version.json) = domknięcie bieżącego pliku
  // nagrania i przeładowanie — bez klikania przy komputerze. Najwyżej raz na 30 min (pamięć podręczna Pages).
  let updateTimer = null;
  // Zdalne odświeżenie z telefonu: domknięcie nagrania i wczytanie najnowszej wersji strony (z pominięciem pamięci podręcznej).
  function forceReload() {
    setStatus("Odświeżam stronę kamery na życzenie z telefonu — nagrywanie wróci za chwilę…");
    archive.stop();
    releaseSenderLock();
    const u = new URL(location.href); u.searchParams.set("v", String(Date.now()));
    setTimeout(() => location.replace(u.href), 5000);
  }

  async function checkUpdate() {
    try {
      const v = (await (await fetch(`version.json?t=${Date.now()}`, { cache: "no-store" })).json()).version;
      if (!v || String(v) === VERSION) return;
      const last = Number(sessionStorage.getItem("kamera-update") || 0);
      if (Date.now() - last < 30 * 60000) return;
      sessionStorage.setItem("kamera-update", String(Date.now()));
      setStatus("Nowa wersja strony kamery — zapisuję nagranie i odświeżam…");
      archive.stop();
      releaseSenderLock();
      // Adres z numerem wersji: przeglądarka pobiera świeżą stronę zamiast starej z pamięci podręcznej.
      const u = new URL(location.href); u.searchParams.set("v", String(v));
      setTimeout(() => location.replace(u.href), 8000);
    } catch { /* brak internetu — sprawdzimy później */ }
  }

  // Powiadomienie oglądających o wykrytym ruchu / dźwięku.
  function sendZoomState() {
    if (!live || !zoomer) return;
    send(chan.channel, { type: "zoom-state", ...zoomer.state, lossless: zoomer.lossless, supported: zoomer.supported, max: MAX_ZOOM });
  }

  function notifyViewers(ev) { if (live) send(chan.channel, { type: "alert", ...ev }); }

  // Co minutę zapis stanu nagrywania na serwerze — da się sprawdzić zdalnie, czy i dlaczego nie nagrywa.
  const INSTANCE = crypto.randomUUID().slice(0, 8);
  // Dlaczego nie ma obrazu — widać zdalnie (raport i telefon): błąd kamery albo czekanie na zgodę przeglądarki.
  function camProblem() {
    if (!live || stream || prefs.mode === "off") return "";
    if (lastCameraError) return lastCameraError;
    return camWaitSince ? `Czekam na kamerę od ${Math.round((Date.now() - camWaitSince) / 1000)} s (okno zgody przeglądarki?).` : "";
  }
  function diag() {
    const v = stream?.getVideoTracks()[0], a = stream?.getAudioTracks()[0], st = v?.getSettings?.() || {}, r = archive.status();
    return { cam: v ? (v.label || "kamera") : "", camLive: v?.readyState === "live", w: st.width, h: st.height, fps: Math.round(st.frameRate || 0),
      mic: a ? (a.label || "mikrofon") : "", micOn: !!a && a.enabled && a.readyState === "live", recording: r.recording, lastFile: r.lastFile,
      quality: recQuality().short, mode: prefs.mode, viewers: peers.size, version: VERSION, camError: camProblem() };
  }
  const beat = () => (renderDiag(diag(), [diagRow(true, `Strona nadaje obraz · oglądających teraz: ${peers.size}`)]), paintMode(prefs.mode, prefs.recordUntil), $("viewQuality").value = REC_QUALITY[prefs.recQuality] ? prefs.recQuality : "high", send(chan.channel, { type: "heartbeat", rec: archive.status(), mode: prefs.mode, until: prefs.recordUntil > Date.now() ? prefs.recordUntil : 0, quality: prefs.recQuality, media: prefs.media, now: Date.now(), camError: camProblem(), from: INSTANCE, hasCam: !!stream, diag: diag() }), setCtrlState({ ...archive.status(), mode: prefs.mode, until: prefs.recordUntil, skew: 0, hasCam: !!stream }));
  // Zmiana jakości nagrań: bieżący plik zostaje domknięty, następny nagrywa się już w nowej jakości.
  function setQuality(q) {
    if (!REC_QUALITY[q]) return;
    prefs.recQuality = q; savePrefs();
    $("quality").value = q;
    archive.restart();
    beat(); report();
  }

  let yielded = false;
  function yieldToOther() {
    yielded = true;
    stop();
    showPlaceholder("Kamera działa i nagrywa w innym oknie na tym komputerze\n(często zminimalizowane okno „Kamera na żywo” z autostartu — sprawdź pasek zadań).\nTo okno niczego nie nagrywa. Możesz je zamknąć albo przejąć kamerę tutaj.");
    $("takeoverBtn").hidden = false;
    setStatus("");
  }
  // „Przejmij kamerę w tym oknie”: tamto okno oddaje kamerę (zapisuje bieżący plik), to ją przejmuje.
  function takeover() {
    $("takeoverBtn").hidden = true;
    showPlaceholder("Przejmuję kamerę od drugiego okna…");
    chan.start();
    setTimeout(() => send(chan.channel, { type: "takeover", from: INSTANCE }), 3000);
    setTimeout(() => { yielded = false; start(); }, 7000);
  }

  function report() {
    if (yielded) return; // stan raportuje okno, które ma kamerę
    const r = archive.status();
    const cam = camProblem() ? `KAMERA: ${camProblem()} ` : "";
    const s = { id: CHANNEL, instance: INSTANCE, live: live && !!stream, recording: r.recording, reason: cam + r.reason, folder: r.folder,
      last_file: r.lastFile, saved: r.saved, viewers: peers.size, version: VERSION, user_agent: navigator.userAgent };
    fetch(`${SUPABASE_URL}/rest/v1/rpc/report_camera_status`, {
      method: "POST", keepalive: true,
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ s }),
    }).catch(() => {});
  }

  return { start, stop, restart, forceReload, takeover, setMedia, applyMedia, retryCamera, switchCamera, applyRecordingPlan, notifyViewers, setQuality, setMode, beat: () => beat(), get live() { return live; } };
})();

// ---------- PODGLĄD (telefon) ----------
const viewer = (() => {
  const viewerId = crypto.randomUUID();
  let pc = null, pending = [], lastSeen = 0, lastJoin = 0, brokenSince = 0, watchdog = null, active = false;
  let rec = null, recClock = null, camOff = false, liveNote = false;
  const chan = reconnectingChannel({
    label: "Podgląd",
    onSignal,
    onSubscribed: () => { if (pc?.connectionState !== "connected") { setStatus(""); showPlaceholder("Czekam na obraz z kamery…"); join(); } },
  });

  function join() { lastJoin = Date.now(); send(chan.channel, { type: "viewer-join", viewerId }); }

  function reset() {
    stopRec();
    pc?.close(); pc = null; pending = [];
    video.srcObject = null;
    showLive(""); showPlaceholder("Łączenie…"); $("startHere").hidden = true;
    $("soundBtn").hidden = true; $("fullBtn").disabled = true; $("watchRecBtn").disabled = true;
  }

  async function onSignal(sig) {
    if (!active) return;
    if (!["viewer-join", "viewer-leave"].includes(sig.type) && !(sig.type === "ice" && sig.from === "viewer")) lastSeen = Date.now();
    if (sig.type === "heartbeat") {
      if (sig.rec) showRecStatus(sig.rec);
      if (sig.mode) applyMode(sig.mode, sig.until);
      if (sig.diag) renderDiag(sig.diag, [
        diagRow(pc?.connectionState === "connected", pc?.connectionState === "connected" ? "Telefon połączony z kamerą" : "Telefon nie jest jeszcze połączony z kamerą"),
        diagRow(video.videoWidth > 0, video.videoWidth > 0 ? `Obraz dociera na ten ekran (${video.videoWidth}×${video.videoHeight})` : "Obraz jeszcze nie dotarł na ten ekran"),
      ]);
      setCtrlState({ recording: !!sig.rec?.recording, since: sig.rec?.since || 0, mode: sig.mode || "", until: sig.until || 0, skew: sig.now ? sig.now - Date.now() : 0, hasCam: !sig.camError });
      if (REC_QUALITY[sig.quality] && document.activeElement !== $("viewQuality")) $("viewQuality").value = sig.quality;
      if (MEDIA_LABEL[sig.media] && document.activeElement !== $("mediaPick")) $("mediaPick").value = sig.media;
      // Bez obrazu na żywo — powiedz dlaczego (tryb „Tylko zapis” albo transmisja samego dźwięku).
      const note = sig.mode === "rec-only" ? "Kamera tylko nagrywa — transmisja na żywo jest wyłączona.\nNagrania są dostępne na osi czasu." : sig.media === "a" ? "🎙 Transmisja tylko dźwięku (obraz wyłączony)" : "";
      if (note) { showPlaceholder(note); liveNote = true; } else if (liveNote) { liveNote = false; if (pc?.connectionState === "connected") showPlaceholder(""); }
      if (camOff) return;
      // Komputer działa, ale nie ma obrazu z kamery — pokaż przyczynę zamiast „Łączenie…”.
      if (sig.camError && pc?.connectionState !== "connected") { showPlaceholder(`Komputer działa, ale nie ma obrazu z kamery:\n${sig.camError}`); return; }
      const st = pc?.connectionState;
      if ((!st || st === "failed" || st === "closed") && Date.now() - lastJoin > 10000) join();
      return;
    }
    if (sig.type === "broadcaster-ready") { if (camOff) return; reset(); return join(); }
    if (sig.type === "broadcaster-stop") { reset(); lastSeen = 0; showPlaceholder("Kamera jest wyłączona."); return; }
    if (sig.type === "alert") return showAlert(sig);
    if (sig.type === "zoom-state") return zoomUi.apply(sig);
    if (sig.viewerId !== viewerId) return;
    if (sig.type === "busy") { showPlaceholder(`Ogląda już ${MAX_VIEWERS} osób — spróbuję ponownie za chwilę…`); return; }
    if (sig.type === "offer") {
      reset();
      const conn = new RTCPeerConnection({ iceServers: iceServers() });
      pc = conn;
      conn.ontrack = e => {
        // Minimalne opóźnienie odtwarzania (obraz „na żywo”, bez zbędnego buforowania).
        try { e.receiver.jitterBufferTarget = 0; } catch { /* brak wsparcia */ }
        try { e.receiver.playoutDelayHint = 0; } catch { /* brak wsparcia */ }
        const s = e.streams[0];
        if (video.srcObject !== s) { video.srcObject = s; video.play().catch(() => {}); }
        $("soundBtn").hidden = s.getAudioTracks().length === 0;
      };
      conn.ondatachannel = e => { if (e.channel.label === "nagrania") recClient.attach(e.channel); };
      conn.onicecandidate = e => { if (e.candidate) send(chan.channel, { type: "ice", viewerId, from: "viewer", candidate: e.candidate.toJSON() }); };
      conn.onconnectionstatechange = () => {
        if (pc !== conn) return;
        const st = conn.connectionState;
        if (st === "connected") {
          brokenSince = 0; showPlaceholder(""); showLive("NA ŻYWO"); setStatus("");
          send(chan.channel, { type: "zoom-get" });
          $("fullBtn").disabled = false; $("watchRecBtn").disabled = MIME === null;
        } else if (st === "failed") { showLive(""); setStatus("Nie udało się zestawić połączenia. Przy sieci komórkowej może być potrzebny serwer TURN."); }
        else if (st === "disconnected") { showLive(""); setStatus("Połączenie przerwane — wznawiam…"); }
      };
      await conn.setRemoteDescription(sig.sdp);
      for (const c of pending.splice(0)) await conn.addIceCandidate(c);
      const answer = await conn.createAnswer();
      await conn.setLocalDescription(answer);
      send(chan.channel, { type: "answer", viewerId, sdp: answer });
    } else if (sig.type === "ice" && sig.from === "broadcaster") {
      if (pc?.remoteDescription) await pc.addIceCandidate(sig.candidate); else pending.push(sig.candidate);
    }
  }

  // Przyciski trybu kamery na telefonie: podświetlony = bieżący tryb komputera.
  function applyMode(m, until = 0) {
    if (RECEIVER_ONLY) return;
    paintMode(m, until);
    const off = m === "off";
    if (off && !camOff) { reset(); showPlaceholder("Kamera wstrzymana.\nNaciśnij „Nagrywaj” albo „Tylko podgląd”, aby ją włączyć."); }
    if (!off && camOff) { reset(); join(); }
    camOff = off;
  }
  async function setMode(m) {
    if (m === "off" && !confirm("Wyłączyć kamerę? Nie będzie podglądu ani nagrywania, dopóki nie włączysz jej z powrotem.")) return;
    const command = await signedOwnerControl({ type: "mode-set", mode: m, minutes: Number($("onceMin").value) });
    if (!command) return;
    send(chan.channel, command);
    setStatus("Wysłano polecenie do kamery…");
    setTimeout(() => setStatus(""), 4000);
  }

  // Ręczne nagranie na telefonie (niezależne od nagrywania 24/7 na komputerze).
  function startRec() {
    const s = video.srcObject;
    if (!s || MIME === null) return;
    const r = new MediaRecorder(s, MIME ? { mimeType: MIME } : undefined);
    const chunks = [], t0 = new Date();
    r.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    r.onstop = () => {
      if (!chunks.length) return;
      const type = r.mimeType || MIME || "video/webm";
      const blob = new Blob(chunks, { type }), name = `kamera-telefon-${stamp(t0)}.${extFor(type)}`;
      const a = $("lastRec"); a.hidden = false; a.href = URL.createObjectURL(blob); a.download = name;
      a.textContent = `Pobierz nagranie (${(blob.size / 1048576).toFixed(1)} MB)`;
      download(blob, name);
    };
    r.start(1000); rec = r;
    $("recBadge").hidden = false;
    recClock = setInterval(() => {
      const sec = Math.floor((Date.now() - t0) / 1000);
      $("recTime").textContent = fmtTime(sec); $("watchRecBtn").textContent = `Zatrzymaj nagrywanie (${fmtTime(sec)})`;
    }, 500);
    $("watchRecBtn").classList.add("rec-on");
  }
  function stopRec() {
    if (rec && rec.state !== "inactive") rec.stop();
    rec = null; clearInterval(recClock);
    $("recBadge").hidden = true; $("watchRecBtn").textContent = "Nagrywaj tutaj"; $("watchRecBtn").classList.remove("rec-on");
  }

  function start() {
    if (active) return;
    active = true;
    reset();
    chan.start();
    // Strażnik 24/7: wznawia zerwane połączenie, wykrywa brak nadajnika.
    watchdog = setInterval(() => {
      const now = Date.now();
      if (pc?.connectionState === "connected" || (camOff && now - lastSeen < OFFLINE_AFTER_MS)) { brokenSince = 0; return; }
      if (!brokenSince) brokenSince = now;
      const offline = !lastSeen || now - lastSeen > OFFLINE_AFTER_MS;
      if (offline && chan.channel) {
        showPlaceholder(IS_DESKTOP ? "Kamera nie nadaje.\nJeśli to komputer z kamerą, kliknij przycisk poniżej." : "Kamera nie nadaje (komputer offline).\nPołączę się sam, gdy wróci.");
        $("startHere").hidden = !IS_DESKTOP;
      }
      else if (now - brokenSince > 10000 && now - lastJoin > 10000) { reset(); join(); }
    }, 5000);
  }

  function stop() {
    if (!active) return;
    active = false;
    clearInterval(watchdog);
    send(chan.channel, { type: "viewer-leave", viewerId });
    chan.stop(); reset();
  }

  window.addEventListener("online", () => { if (active) chan.reconnect(); });
  window.addEventListener("beforeunload", () => { if (active) send(chan.channel, { type: "viewer-leave", viewerId }); });

  function sendZoom(st) { send(chan.channel, { type: "zoom", ...st }); }

  async function setMedia(m) {
    const command = await signedOwnerControl({ type: "media-set", media: m });
    if (!command) return;
    send(chan.channel, command);
    setStatus(`Zmieniam źródło na: ${MEDIA_LABEL[m]}.`);
    setTimeout(() => setStatus(""), 4000);
  }

  async function setQuality(q) {
    const command = await signedOwnerControl({ type: "quality-set", q });
    if (!command) return;
    send(chan.channel, command);
    setStatus("Zmieniam jakość nagrań — następny plik nagra się już w tej jakości.");
    setTimeout(() => setStatus(""), 4000);
  }

  async function reloadPc() {
    const command = await signedOwnerControl({ type: "reload" });
    if (!command) return;
    send(chan.channel, command);
    setStatus("Komputer-kamera odświeża stronę i pobiera najnowszą wersję — obraz wróci za ok. 15 s…");
    setTimeout(() => setStatus(""), 8000);
  }
  async function restart() {
    const command = await signedOwnerControl({ type: "restart" });
    if (!command) return;
    send(chan.channel, command);
    setStatus("Restartuję kamerę na komputerze — obraz wróci za kilka sekund…");
    setTimeout(() => setStatus(""), 6000);
  }

  return { start, stop, restart, reloadPc, sendZoom, setMode, setQuality, setMedia, toggleRec() { rec ? stopRec() : startRec(); }, rejoin() { reset(); setStatus("Łączę ponownie…"); join(); } };
})();

// Zdarzenie na telefonie: wyskakujące powiadomienie, wibracja, lista ostatnich zdarzeń.
const viewEvents = [];
let toastTimer = null;
// Linijka pod obrazem na telefonie: czy komputer nagrywa do Google Drive, a jeśli nie — dlaczego.
function showRecStatus(r) {
  const el = $("recStatus");
  el.hidden = false;
  el.className = `recStatus ${r.recording ? "ok" : "bad"}`;
  el.textContent = r.recording
    ? `⏺ Nagrywanie: działa — folder „${r.folder}”${r.saved ? `, zapisano ${r.saved} pl., ostatni ${r.lastFile}` : ", pierwszy plik po ~10 min"}${r.queued ? `, czeka na wysłanie: ${r.queued}` : ""}${r.migrated ? `, dosłano starych: ${r.migrated}` : ""}`
    : `⚠ ${r.reason}`;
}

function showAlert(ev) {
  viewEvents.unshift(ev); viewEvents.length = Math.min(viewEvents.length, 20);
  renderEvents("viewEvents", viewEvents);
  const t = $("toast");
  t.textContent = `${EVENT_LABEL[ev.kind] || ev.kind} — ${fmtClock(ev.at)}`;
  t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 6000);
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* brak wibracji */ }
}

// ---------- Zbliżenie na telefonie: szczypanie, przesuwanie, kółko myszy, przyciski ----------
const zoomUi = (() => {
  let state = { z: 1, cx: 0.5, cy: 0.5 }, lossless = 1, max = MAX_ZOOM, enabled = false, timer = null;
  const pointers = new Map();
  let pinch = null;

  function label() {
    // Bez przybliżenia palec na obrazie przewija stronę; przy przybliżeniu — przesuwa kadr.
    $("stage").classList.toggle("zoomed", state.z > 1.01);
    $("zoomLabel").textContent = `${state.z.toFixed(1)}×`;
    $("zoomHint").textContent = state.z <= 1.01 ? "" : state.z <= lossless + 0.05 ? "pełna jakość" : `pełna jakość do ${lossless.toFixed(1)}×`;
  }
  function push() { clearTimeout(timer); timer = setTimeout(() => viewer.sendZoom(state), 60); label(); }
  function set(next) { state = normalize(next); push(); }

  function apply(sig) {
    enabled = !!sig.supported; lossless = sig.lossless || 1; max = sig.max || MAX_ZOOM;
    $("zoomBar").hidden = !enabled; $("stage").classList.toggle("zoomable", enabled);
    if (!pointers.size) state = normalize(sig);
    label();
  }

  const stage = $("stage");
  const rect = () => stage.getBoundingClientRect();
  stage.addEventListener("pointerdown", e => { if (!enabled || prefs.role === "send" || e.target.closest("#zoomBar, #startHere, .playback")) return; stage.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
  stage.addEventListener("pointermove", e => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) set({ ...state, z: Math.min(max, state.z * dist / pinch) });
      pinch = dist;
    } else if (pointers.size === 1 && state.z > 1) {
      const r = rect();
      set({ ...state, cx: state.cx - (e.clientX - prev.x) / r.width / state.z, cy: state.cy - (e.clientY - prev.y) / r.height / state.z });
    }
  });
  const end = e => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; };
  stage.addEventListener("pointerup", end); stage.addEventListener("pointercancel", end);
  stage.addEventListener("wheel", e => {
    if (!enabled || prefs.role === "send") return;
    e.preventDefault();
    const r = rect();
    // Zbliżaj w miejsce kursora.
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    const z = Math.min(max, Math.max(1, state.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    set({ z, cx: state.cx + (px - 0.5) / state.z - (px - 0.5) / z, cy: state.cy + (py - 0.5) / state.z - (py - 0.5) / z });
  }, { passive: false });
  $("zoomIn").addEventListener("click", () => set({ ...state, z: Math.min(max, state.z * 1.25) }));
  $("zoomOut").addEventListener("click", () => set({ ...state, z: state.z / 1.25 }));
  $("zoomReset").addEventListener("click", () => set({ z: 1, cx: 0.5, cy: 0.5 }));
  return { apply };
})();

// ---------- Widoki ----------
// Lista nagrań na komputerze-kamerze (działa bezpośrednio na folderze Google Drive).
function showPcLibrary() {
  if (!pcLibrary) pcLibrary = mountLibrary($("pcLibrary"), { days: () => archive.local.days(), day: d => archive.localHours(d), share: f => archive.shareLocal(f) });
  else pcLibrary.refresh();
}
function showSender() {
  document.body.classList.add("cameraPc"); // bez animacji i rozmyć — mniej pracy dla procesora i karty graficznej
  $("sendPanel").hidden = false; $("watchPanel").hidden = true; $("viewEventsCard").hidden = true; $("layout").classList.add("sender");
  // Jedna kolumna: kamera, oś czasu, Start/Stop/Restart, sterowanie — ustawienia na dole.
  $("recStatus").after($("modeCard"));
  dvr ??= mountDvr({ client: localRecClient, drive: null, allowUpload: true, root: $("dvrCard"), stage: $("stage"), liveVideo: video, toast: toastMsg, onState: playback => { viewingArchive = playback; paintSystemPanel(); } });
  $("dvrCard").hidden = false;
  dvr.start();
  $("roleBtn").textContent = "Wyłącz nadawanie na tym komputerze (tylko oglądaj)";
  archive.init().then(showPcLibrary);
  sender.start();
  sender.beat();
}

function copyReceiverLink() {
  const url = new URL(location.href);
  url.hash = "";
  url.search = "";
  url.searchParams.set("odbiorca", CHANNEL);
  navigator.clipboard.writeText(url.href)
    .then(() => toastMsg("Skopiowano link odbiorcy. Otwiera podgląd bez PIN-u — przekaż go tylko zaufanej osobie."))
    .catch(() => prompt("Skopiuj ten link i przekaż go zaufanej osobie:", url.href));
}

// Krótki komunikat na dole ekranu (ten sam element co powiadomienia o ruchu).
function toastMsg(text) {
  const t = $("toast");
  t.textContent = text; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 6000);
}
let dvr = null;
function showViewer() {
  $("sendPanel").hidden = true; $("watchPanel").hidden = false; $("viewEventsCard").hidden = false; $("layout").classList.remove("sender");
  // Na telefonie/podglądzie ustawienia wracają pod obraz, aby nie powstawała pusta prawa kolumna.
  if ($("picturePanel").parentElement !== $("layout").querySelector(".mainCol")) $("layout").querySelector(".mainCol").appendChild($("picturePanel"));
  $("recStatus").after($("modeCard"));
  // Oś czasu i biblioteka pokazują nagrania zapisane na stronie (nie z Google Drive).
  dvr ??= mountDvr({ client: recClient, drive: null, allowUpload: !RECEIVER_ONLY, root: $("dvrCard"), stage: $("stage"), liveVideo: video, toast: toastMsg, onState: playback => { viewingArchive = playback; paintSystemPanel(); } });
  recClient.onopen = () => dvr.refresh();
  $("dvrCard").hidden = false;
  dvr.start();
  $("roleBtn").textContent = "To jest komputer z kamerą — nadawaj z niego";
  if (RECEIVER_ONLY) {
    $("picturePanel").hidden = true;
    $("modeCard").hidden = true;
    $("viewEventsCard").hidden = true;
    document.querySelector("#ctrlBar .ctrlBtns").hidden = true;
    $("watchRecBtn").hidden = true;
    $("roleBtn").hidden = true;
    document.querySelectorAll('a[href="nagrania.html"]').forEach(a => a.hidden = true);
  }
  viewer.start();
}

// ---------- Przyciski ----------
function setRole(toSend) {
  sender.stop(); viewer.stop();
  prefs.role = toSend ? "send" : "watch"; savePrefs();
  location.reload(); // czysty start w nowej roli (oś czasu czyta nagrania z innego źródła)
}
$("roleBtn").addEventListener("click", () => {
  const toSend = prefs.role !== "send";
  if (!confirm(toSend
    ? "Ustawić to urządzenie jako kamerę? Będzie nadawać obraz i dźwięk (widzą je osoby z PIN-em) i nagrywać 24/7."
    : "Wyłączyć nadawanie? To urządzenie będzie tylko oglądać.")) return;
  setRole(toSend);
});
$("takeoverBtn").addEventListener("click", () => sender.takeover());
$("startHere").addEventListener("click", () => {
  if (!confirm("Włączyć kamerę i mikrofon tego komputera? Obraz zobaczą osoby z PIN-em.")) return;
  setRole(true);
});
$("pcLibRefresh").addEventListener("click", () => showPcLibrary());
$("copyViewerLink").addEventListener("click", copyReceiverLink);
function applyPictureLayout() {
  const style = prefs.pictureStyle || "color";
  $("pictureStyle").value = style;
  $("pano360").checked = !!prefs.pano360;
  $("stage").classList.toggle("visual-mono", style === "mono");
  $("stage").classList.toggle("visual-contrast", style === "contrast");
  $("stage").classList.toggle("visual-night", style === "night");
  $("stage").classList.toggle("visual-cool", style === "cool");
  $("stage").classList.toggle("visual-warm", style === "warm");
  $("stage").classList.toggle("visual-negative", style === "negative");
  $("stage").classList.toggle("visual-bright", style === "bright");
  $("stage").classList.toggle("visual-brightsharp", style === "brightsharp");
  $("stage").classList.toggle("frame-grid", !!prefs.pictureGrid);
  $("stage").classList.toggle("pano360", !!prefs.pano360);
  $("gridBtn").textContent = `▦ Siatka kadru: ${prefs.pictureGrid ? "wł." : "wył."}`;
  $("gridBtn").setAttribute("aria-pressed", prefs.pictureGrid ? "true" : "false");
}
$("pictureStyle").addEventListener("change", e => { prefs.pictureStyle = e.target.value; savePrefs(); applyPictureLayout(); toastMsg("Zmieniono efekt podglądu."); });
$("gridBtn").addEventListener("click", () => { prefs.pictureGrid = !prefs.pictureGrid; savePrefs(); applyPictureLayout(); toastMsg(prefs.pictureGrid ? "Włączono siatkę kadru." : "Wyłączono siatkę kadru."); });
$("pano360").addEventListener("change", e => { prefs.pano360 = e.target.checked; savePrefs(); applyPictureLayout(); toastMsg(prefs.pano360 ? "Włączono podgląd panoramy 360°. Działa prawidłowo tylko z kamerą 360°." : "Wyłączono podgląd panoramy 360°."); });
applyPictureLayout();
$("lockBtn").addEventListener("click", () => { if (confirm("Zablokować stronę na tym urządzeniu? Przy następnym wejściu trzeba będzie wpisać PIN.")) { sender.stop(); viewer.stop(); lock(); location.reload(); } });
$("startBtn").addEventListener("click", () => sender.start());
$("ctrlStart").addEventListener("click", async () => {
  if (RECEIVER_ONLY) return;
  if (prefs.role === "send") { if (!sender.live) await sender.start(); return sender.setMode("record"); }
  viewer.setMode("record");
});
$("ctrlStop").addEventListener("click", () => {
  if (RECEIVER_ONLY) return;
  if (prefs.role !== "send") return viewer.setMode("off");
  if (confirm("Zatrzymać kamerę? Nie będzie podglądu ani nagrywania, dopóki nie naciśniesz Start.")) sender.setMode("off");
});
$("reloadPcBtn").addEventListener("click", () => {
  if (RECEIVER_ONLY || !confirm("Odświeżyć stronę na komputerze-kamerze i pobrać najnowszą wersję? Nagrywanie przerwie się na kilkanaście sekund.")) return;
  if (prefs.role === "send") sender.forceReload(); else viewer.reloadPc();
});
$("ctrlRestart").addEventListener("click", () => {
  if (RECEIVER_ONLY) return;
  if (prefs.role === "send") sender.restart(); else viewer.restart();
});

// Na komputerze z kamerą przyciski działają od razu, na telefonie wysyłają polecenie do komputera.
document.querySelectorAll("#modeCard [data-mode]").forEach(b => b.addEventListener("click", () => {
  if (RECEIVER_ONLY) return;
  if (!sender.live) return viewer.setMode(b.dataset.mode);
  if (b.dataset.mode === "off" && !confirm("Wyłączyć kamerę? Nie będzie podglądu ani nagrywania, dopóki nie włączysz jej z powrotem.")) return;
  sender.setMode(b.dataset.mode, Number($("onceMin").value));
}));
$("stopBtn").addEventListener("click", () => sender.stop());
$("retryCameraBtn").addEventListener("click", () => sender.retryCamera());
$("chooseArchiveDir").addEventListener("click", async () => {
  const button = $("chooseArchiveDir"), old = button.textContent;
  button.disabled = true;
  if (archive.diskNeedsGrant) {
    button.textContent = "Czekam na zgodę Chrome…";
    let ok = false;
    try { ok = await archive.regrantDisk(); } catch { /* brak zgody — poniżej wybór folderu od nowa */ }
    button.disabled = false;
    if (ok) { button.textContent = "📁 Wybierz folder archiwum"; toastMsg("Dostęp do folderu przywrócony — nagrania znów zapisują się na dysku."); return; }
    button.disabled = true;
  }
  button.textContent = "Otwieram wybór folderu…";
  try { toastMsg(`Trwałe archiwum ustawione: ${await archive.chooseDisk()}`); }
  catch (e) { setStatus(`Folder archiwum nie został ustawiony: ${errText(e)}`); }
  finally { button.disabled = false; button.textContent = old; }
});
// Jakość nagrań: wybór na komputerze albo z telefonu (polecenie „quality-set”). Stare nagrania kasuje pętla zapisu.
for (const id of ["quality", "viewQuality"]) {
  $(id).replaceChildren(...Object.entries(REC_QUALITY).map(([k, q]) => new Option(q.label, k)));
  $(id).value = REC_QUALITY[prefs.recQuality] ? prefs.recQuality : "high";
}
$("quality").addEventListener("change", e => sender.setQuality(e.target.value));
$("mediaPick").value = MEDIA_LABEL[prefs.media] ? prefs.media : "av";
$("mediaPick").addEventListener("change", e => { if (RECEIVER_ONLY) return; prefs.role === "send" ? sender.setMedia(e.target.value) : viewer.setMedia(e.target.value); });
$("viewQuality").addEventListener("change", e => sender.live ? sender.setQuality(e.target.value) : viewer.setQuality(e.target.value));
$("retentionDays").closest("label").hidden = true;
for (const id of ["segmentMin", "retentionDays"]) {
  $(id).value = String(prefs[id]);
  $(id).addEventListener("change", e => { prefs[id] = Number(e.target.value); savePrefs(); });
}
$("recordPlan").value = prefs.recordPlan || "always";
$("recordPlan").addEventListener("change", e => {
  prefs.recordPlan = e.target.value; savePrefs();
  sender.applyRecordingPlan();
  toastMsg(`Harmonogram: ${e.target.options[e.target.selectedIndex].text}.`);
});
$("cameraSelect").addEventListener("change", e => { prefs.cameraId = e.target.value; savePrefs(); sender.switchCamera(); });
$("detectToggle").checked = prefs.detect;
$("detectToggle").addEventListener("change", e => { prefs.detect = e.target.checked; savePrefs(); sender.switchCamera(); });
$("sensitivity").value = prefs.sensitivity;
$("sensitivity").addEventListener("change", e => { prefs.sensitivity = e.target.value; savePrefs(); });
renderEvents("pcEvents", recentEvents); renderEvents("viewEvents", viewEvents);
$("withAudio").checked = prefs.audio;
$("withAudio").addEventListener("change", e => {
  prefs.audio = e.target.checked; savePrefs();
  // Zmiana ścieżki audio wymaga nowego MediaStreamu; bez tego checkbox wyglądał jak działający, ale nic nie zmieniał.
  if (prefs.role === "send") sender.switchCamera();
});
$("reconnectBtn").addEventListener("click", () => {
  const b = $("reconnectBtn");
  if (b.disabled) return;
  b.disabled = true; b.textContent = "Łączę…";
  viewer.rejoin();
  setTimeout(() => { b.disabled = false; b.textContent = "↻ Połącz ponownie"; }, 2000);
});
$("watchRecBtn").addEventListener("click", () => viewer.toggleRec());
$("fullBtn").addEventListener("click", () => (video.requestFullscreen?.() ?? video.webkitEnterFullscreen?.())?.catch?.(() => {}));
$("soundBtn").addEventListener("click", () => { video.muted = !video.muted; video.volume = 1; $("soundBtn").textContent = video.muted ? "🔊 Włącz dźwięk" : "🔇 Wycisz"; });

// ---------- Start: PIN, potem od razu podgląd (albo nadawanie na komputerze-kamerze) ----------
// Adres dominiksolorz.github.io/#nadaj ustawia to urządzenie jako kamerę (bez klikania na stronie).
if (location.hash === "#nadaj") { prefs.role = "send"; savePrefs(); history.replaceState(null, "", location.pathname); }
window.__kameraReady = true;
$("bootError").hidden = true;
if (RECEIVER_ONLY) {
  CHANNEL = receiverChannel;
  $("app").hidden = false;
  showViewer();
} else {
  ACCESS_KEY = await requireAccess();
  CHANNEL = await channelFor(ACCESS_KEY);
  if (new URLSearchParams(location.search).get("wroc") === "nagrania") location.replace("nagrania.html");
  $("app").hidden = false; $("lockBtn").hidden = false;
  if (prefs.role === "send") showSender();
  else showViewer();
}

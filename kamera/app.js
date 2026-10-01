// vendor/supabase.js (@supabase/supabase-js 2.117.2) ładowany w index.html przed tym modułem.
// Pliki mają numer wersji w adresie (?v=…), bo GitHub Pages trzyma je w pamięci podręcznej przez 10 min.
const { createClient } = window.supabase;
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, TURN_SERVER, DRIVE_SCRIPT_URL, driveWatchUrl } from "./config.js?v=32";
import { b64, sign, targetString } from "./pin.js?v=14";
import { mountLibrary } from "./library-ui.js?v=19";
import { requireAccess } from "./lock.js?v=14";
import { channelFor, lock } from "./access.js?v=14";
import { createDetector, EVENT_LABEL } from "./detect.js?v=32";
import { createZoomer, normalize, MAX_ZOOM } from "./zoom.js?v=16";
import * as recstore from "./recstore.js?v=32";
import { serve as serveRecordings, createClient as createRecClient } from "./recproto.js?v=32";
import { mountDvr } from "./dvr-ui.js?v=32";

// Wejście PIN-em: z PIN-u powstaje klucz dostępu, a z niego tajna nazwa kanału sygnalizacji.
// Supabase służy tylko do wymiany sygnałów WebRTC; obraz i dźwięk płyną peer-to-peer.
let ACCESS_KEY = null, CHANNEL = null;
const VERSION = "32"; // musi się zgadzać z version.json
const recClient = createRecClient(); // telefon: nagrania z komputera-kamery przez kanał danych WebRTC
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// Komputer (nie telefon) z kamerą dostaje duży przycisk „Włącz kamerę”, gdy nikt nie nadaje.
const IS_DESKTOP = !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) && !!navigator.mediaDevices?.getUserMedia;
const MAX_VIEWERS = 5;
// Jakość przesyłu na żywo: HD 720p, 30 kl./s, do 2,5 Mb/s na oglądającego; H.264 = sprzętowe dekodowanie na iPhonie.
const LIVE_MAX_BITRATE = 2500000;
const LIVE_FPS = 30;
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
const stamp = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;

const iceServers = () => {
  const s = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];
  if (TURN_SERVER) s.push(TURN_SERVER);
  return s;
};

// ---------- Ustawienia (pamiętane w przeglądarce) ----------
const DEFAULTS = { role: null, cameraId: "", audio: true, detect: true, sensitivity: "medium", recQuality: "small", segmentMin: 10, retentionDays: 1 };

// Jakość NAGRAŃ (osobno od obrazu na żywo, który zostaje w HD). Mniejsza rozdzielczość, mniej klatek
// i niska przepływność = małe pliki na Google Drive. Rozmiary to przybliżenie dla 5 minut nagrania.
const REC_PRESETS = {
  mini:   { w: 426,  h: 240, fps: 8,  video: 40000,  audio: 32000, label: "Mini — 240p (~2 MB / 5 min)" },
  small:  { w: 640,  h: 360, fps: 10, video: 90000,  audio: 48000, label: "Mała — 360p (~4 MB / 5 min)" },
  medium: { w: 854,  h: 480, fps: 15, video: 190000, audio: 64000, label: "Średnia — 480p (~8 MB / 5 min)" },
  hd:     { w: 1280, h: 720, fps: 20, video: 350000, audio: 96000, label: "HD — 720p (~15 MB / 5 min)" },
};
const recPreset = () => REC_PRESETS[prefs.recQuality] || REC_PRESETS.small;
function loadPrefs() { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") }; } catch { return { ...DEFAULTS }; } }
function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* tryb prywatny */ } }
const prefs = loadPrefs();
// Jednorazowo: nowy plik co 10 minut i przechowywanie 30 dni (biblioteka nagrań na Google Drive).
if (!prefs.lib1) { prefs.segmentMin = 10; prefs.retentionDays = 30; prefs.lib1 = true; savePrefs(); }
// Jednorazowo: nagrania w HD 720p. Gdy łącze nie nadąża (≥3 pliki w kolejce), archiwum samo
// chwilowo nagrywa w 360p i wraca do HD po opróżnieniu kolejki — żadna godzina nie przepada.
if (!prefs.q720) { prefs.recQuality = "hd"; prefs.q720 = true; savePrefs(); }


// ---------- UI pomocnicze ----------
const video = $("video");
function setStatus(text) { $("status").textContent = text || ""; $("status").hidden = !text; }
function showPlaceholder(text) { $("placeholder").textContent = text; $("placeholder").hidden = !text; }
function showLive(text) {
  $("liveBadge").hidden = !text; if (text) $("liveText").textContent = text;
  $("topStatus").textContent = text ? "● na żywo" : "offline"; $("topStatus").classList.toggle("live", !!text);
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
    if (blob.size && await version() >= 2) return uploadResumable(blob, name, events, mime);
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

// ---------- Nagrywanie ciągłe 24/7 → pamięć strony na komputerze-kamerze (pętla zapisu) ----------
// Każdy 10-minutowy plik zostaje na komputerze (IndexedDB, recstore.js). Gdy wolnego miejsca jest mniej
// niż 1 GB, najstarsze nagrania są kasowane. Na Google Drive idą automatycznie tylko pliki z wykrytym ruchem
// lub dźwiękiem (bezpiecznik na dowody) — resztę wysyła się ręcznie z telefonu („☁️ Wyślij na Google Drive”).
// Telefon ogląda i pobiera nagrania z komputera przez kanał danych WebRTC (recproto.js).
// Obraz w pełnej rozdzielczości kamery: 5 kl./s gdy spokojnie, 30 kl./s przy ruchu/dźwięku (+10 s po ustaniu).
const REC_MIME = (() => {
  if (typeof MediaRecorder === "undefined") return null;
  // MP4/H.264: odtwarza go iPhone i przyjmuje WhatsApp/Messenger; zapasowo WebM (AV1/VP9).
  // Samo „video/mp4” bez kodeka bywa VP9 w MP4, którego iPhone nie odtworzy — więc dopiero po WebM.
  return ["video/mp4;codecs=avc1,mp4a", "video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1.4d0028,mp4a.40.2", "video/mp4;codecs=avc1,opus", "video/mp4;codecs=avc1",
    "video/webm;codecs=av01,opus", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find(t => MediaRecorder.isTypeSupported(t)) ?? "";
})();
const SLOW_FPS = 5, FAST_FPS = 30, FAST_HOLD_MS = 10000;
const REC_VIDEO_BPS = 600000, REC_AUDIO_BPS = 64000;

const archive = (() => {
  let source = null, recStream = null, running = false, rec = null, segTimer = null, clock = null;
  let recSince = 0, saved = 0, lastName = "", lastError = "", queued = 0, sentToDrive = 0, pumping = false, retryTimer = null, looped = 0;
  let local = { count: 0, bytes: 0, oldest: 0 }, free = Infinity, persisted = false;
  let fast = false, slowTimer = null, segStart = 0;
  // Limit skryptu Google w starej wersji (bez wysyłania w kawałkach): ok. 35 MB pliku.
  const MAX_UPLOAD = 34 * 1024 * 1024;
  const oversize = new Set();
  const adaptive = () => !!prefs.detect; // bez wykrywania ruchu — stale 30 kl./s

  async function refreshLocal() {
    try { local = await recstore.stats(); free = (await recstore.space()).free; } catch { /* brak IndexedDB */ }
    render();
  }

  async function init() {
    persisted = !!(await recstore.persist());
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
          if (item.ref) await recstore.update(item.ref, { uploaded: true }).catch(() => {});
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
    if (!m) throw new Error("tego nagrania nie ma już na komputerze");
    if (m.uploaded) return { uploaded: true };
    await idb.qPut(name, { ref: name, events: m.events || [] });
    pump();
    return { queued: true };
  }

  let segEvents = null; // zdarzenia (ruch / dźwięk) w bieżącym pliku nagrania
  function markEvent(ev) { segEvents?.push(ev); }

  async function save(data, name, events, start, end) {
    try {
      looped += await recstore.put({ name, start, end, events, type: data.type, uploaded: false }, data);
      saved++; lastName = name; lastError = "";
    } catch (e) {
      lastError = `Nie udało się zapisać ${name} na komputerze (${errText(e)}).`;
    }
    // Bezpiecznik na dowody: plik z ruchem lub dźwiękiem od razu na Google Drive.
    if (events.length && cloud.enabled) await idb.qPut(name, { ref: name, events }).catch(() => {});
    refreshLocal();
    pump();
  }

  // Kopia obrazu tylko do nagrywania: pełna rozdzielczość kamery, zmienna liczba klatek.
  async function makeRecStream(s) {
    const v = s.getVideoTracks()[0]?.clone();
    fast = !adaptive();
    if (v) { try { await v.applyConstraints({ frameRate: { ideal: fast ? FAST_FPS : SLOW_FPS, max: fast ? FAST_FPS : SLOW_FPS } }); } catch { /* zostaje 30 kl./s */ } }
    return new MediaStream([...(v ? [v] : []), ...s.getAudioTracks()]);
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
    const opts = { ...(REC_MIME ? { mimeType: REC_MIME } : {}), videoBitsPerSecond: REC_VIDEO_BPS, audioBitsPerSecond: REC_AUDIO_BPS };
    let r;
    try { r = new MediaRecorder(recStream, opts); }
    catch { r = new MediaRecorder(recStream); } // kodek niedostępny — domyślny przeglądarki
    const chunks = [], events = [];
    segEvents = events;
    r.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    r.onstop = () => {
      if (!chunks.length) return;
      const type = r.mimeType || REC_MIME || "video/webm";
      save(new Blob(chunks, { type }), `kamera-${stamp(startedAt)}.${extFor(type)}`, events, startedAt.getTime(), Date.now());
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
    const rs = recStream; recStream = null;
    if (rs) setTimeout(() => rs.getVideoTracks().forEach(t => t.stop()), 1000);
  }

  function start(s) { source = s; resume(); }
  function stop() { halt(); source = null; render(); }
  function restart() { if (running) { halt(); resume(); } else render(); }

  const gb = n => `${(n / 1073741824).toFixed(1)} GB`;
  function describe() {
    if (REC_MIME === null) return "Ta przeglądarka nie obsługuje nagrywania.";
    let text = running ? `Nagrywa bez przerwy na tym komputerze (pliki co ${prefs.segmentMin} min).` : "Nagrywanie ruszy, gdy kamera będzie włączona.";
    text += ` Na komputerze: ${local.count} nagr. (${gb(local.bytes)})${local.oldest ? `, najstarsze z ${new Date(local.oldest).toLocaleString("pl-PL")}` : ""}.`;
    if (Number.isFinite(free)) text += ` Wolne miejsce: ${gb(free)} (poniżej 1 GB najstarsze nagrania są kasowane).`;
    if (looped) text += ` Skasowano najstarszych: ${looped}.`;
    if (!persisted) text += " Pamięć nietrwała — przeglądarka może sama skasować nagrania przy braku miejsca.";
    const set = source?.getVideoTracks()[0]?.getSettings?.() || {};
    if (set.width) text += ` Obraz: ${set.width}×${set.height}, ${fast ? FAST_FPS : SLOW_FPS} kl./s${fast && adaptive() ? " (ruch)" : ""}, ${(REC_MIME || "").split(";")[0] || "domyślny kodek"}.`;
    if (cloud.enabled) {
      text += " Google Drive: pliki z ruchem/dźwiękiem automatycznie, reszta na życzenie.";
      if (queued) text += ` Czeka na wysłanie: ${queued}.`;
      if (sentToDrive) text += ` Wysłano: ${sentToDrive}.`;
      if (oversize.size) text += ` Za duże na starą wersję skryptu: ${oversize.size}.`;
      const now = cloud.sending();
      if (now) text += ` ${now}`;
    }
    return `${text}${lastError ? ` ${lastError}` : ""}`;
  }

  const status = () => ({ recording: running, reason: describe(), folder: "komputer (pamięć strony)", lastFile: lastName, saved, queued, migrated: sentToDrive });

  function render() {
    $("recBadge").hidden = !running;
    $("archiveInfo").textContent = describe();
    $("pickDir").hidden = true; $("grantDir").hidden = true; $("grantBanner").hidden = true;
  }

  // ----- Dla telefonu (kanał danych): nagrania z pamięci komputera -----
  const dayOf = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const brief = m => ({ name: m.name, start: m.start, end: m.end, size: m.size, type: m.type, uploaded: !!m.uploaded, events: m.events || [] });
  const local_ = {
    async days() {
      const map = {};
      for (const m of await recstore.list()) { const d = dayOf(m.start); map[d] = (map[d] || 0) + 1; }
      return Object.keys(map).sort().reverse().map(day => ({ day, count: map[day] }));
    },
    async list(day) {
      const out = (await recstore.list()).filter(m => dayOf(m.start) === day).map(brief);
      // Bieżący, jeszcze nagrywany plik — żeby oś czasu sięgała do „teraz”.
      if (running && rec && dayOf(Date.now()) === day) out.push({ name: null, start: segStart, end: Date.now(), recording: true, events: [...(segEvents || [])] });
      return { files: out, now: Date.now() };
    },
    async file(name) { const m = await recstore.meta(name); const b = m && await recstore.blob(name); return b ? { blob: b, meta: brief(m) } : null; },
    upload: requestUpload,
  };

  // ----- Biblioteka Google Drive na komputerze (karta „Nagrania”) -----
  async function listDays() { return cloud.enabled ? (await cloud.call("days")).days : []; }
  async function listDay(day) { return cloud.enabled ? (await cloud.call("day", { day })).hours : []; }
  async function remove(t = {}) {
    if (!cloud.enabled) throw new Error("brak skryptu Google Drive");
    await cloud.call("remove", { target: { day: t.day, hour: t.hour, name: t.name } });
  }

  return { init, pick() {}, grant() {}, start, stop, restart, needsGrant: () => false, listDays, listDay, remove, markEvent, activity, status, local: local_ };
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
      return `${line};x-google-min-bitrate=600;x-google-start-bitrate=1500;x-google-max-bitrate=${kbps}`;
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
      p.encodings[0].scaleResolutionDownBy = Math.max(1, (cropWidth || 1920) / 1920);
      p.encodings[0].maxBitrate = LIVE_MAX_BITRATE;
      p.encodings[0].maxFramerate = LIVE_FPS;
      p.degradationPreference = "balanced";
      await sender.setParameters(p);
    } catch { /* starsza przeglądarka — zostają ustawienia domyślne */ }
  }
}

// ---------- NADAJNIK (komputer z kamerą) ----------
const sender = (() => {
  const peers = new Map();
  let zoomer = null, cropWidth = 0; // zbliżenie: wycinany kadr z pełnej rozdzielczości kamery
  let stream = null, live = false, heartbeat = null, reportTimer = null, keepAlive = null, camTimer = null, camAttempt = 0, wakeLock = null;
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
    const out = zoomer?.stream || stream;
    out.getTracks().forEach(t => pc.addTrack(t, out));
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

  const getMedia = deviceId => navigator.mediaDevices.getUserMedia({
    // Ok. 1920 px szerokości przy 30 kl./s — płynny obraz. Pełne 5 MP kamery dają tylko kilka klatek na sekundę.
    video: { width: { ideal: 1920 }, frameRate: { ideal: LIVE_FPS, max: LIVE_FPS }, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) },
    // Mikrofon: tłumienie szumów, usuwanie echa i automatyczne wzmocnienie włączone (czysty, wyrównany dźwięk).
    audio: prefs.audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
  }).then(s => { s.getVideoTracks().forEach(t => { t.contentHint = "motion"; }); return s; });

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

  async function acquireCamera() {
    try {
      const s = await openBestCamera();
      if (!live) { s.getTracks().forEach(t => t.stop()); return false; }
      stream = s;
      video.srcObject = s; video.muted = true;
      zoomer?.stop();
      zoomer = createZoomer(s, w => { cropWidth = w; peers.forEach(p => tuneVideoSender(p.pc, w)); });
      showPlaceholder("");
      s.getVideoTracks()[0]?.addEventListener("ended", () => { if (live && stream === s) cameraLost(); });
      camAttempt = 0;
      archive.start(s);
      if (prefs.detect) detector.start(s, video);
      return true;
    } catch (e) {
      setStatus(`Brak dostępu do kamery/mikrofonu: ${errText(e)}. Zezwól przeglądarce — ponawiam próbę…`);
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
      if (!live) return;
      if (await acquireCamera()) { setStatus(""); send(chan.channel, { type: "broadcaster-ready" }); }
      else if (live) scheduleCameraRetry();
    }, retryDelay(camAttempt++));
  }

  // Zmiana kamery z listy: przełącz obraz i daj znać oglądającym, żeby połączyli się ponownie.
  async function switchCamera() {
    if (!live) return;
    archive.stop(); detector.stop(); closeAll();
    zoomer?.stop(); zoomer = null;
    stream?.getTracks().forEach(t => t.stop()); stream = null;
    if (await acquireCamera()) {
      setStatus("");
      send(chan.channel, { type: "broadcaster-ready" });
    } else scheduleCameraRetry();
  }

  async function start() {
    if (live) return;
    live = true;
    $("startBtn").hidden = true; $("stopBtn").hidden = false;
    showLive("NA ŻYWO · oglądający: 0");
    setStatus("Uruchamiam kamerę i mikrofon…");
    if (!(await acquireCamera()) && live) scheduleCameraRetry();
    chan.start();
    clearInterval(heartbeat);
    heartbeat = setInterval(() => { if (stream) send(chan.channel, { type: "heartbeat", rec: archive.status() }); }, HEARTBEAT_MS);
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
    archive.stop(); detector.stop();
    clearInterval(heartbeat); clearInterval(reportTimer); clearInterval(keepAlive); clearInterval(updateTimer); clearTimeout(camTimer);
    send(chan.channel, { type: "broadcaster-stop" });
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
  window.addEventListener("beforeunload", () => { if (live) send(chan.channel, { type: "broadcaster-stop" }); });

  // Samoaktualizacja komputera-kamery: nowa wersja strony (version.json) = domknięcie bieżącego pliku
  // nagrania i przeładowanie — bez klikania przy komputerze. Najwyżej raz na 30 min (pamięć podręczna Pages).
  let updateTimer = null;
  async function checkUpdate() {
    try {
      const v = (await (await fetch(`version.json?t=${Date.now()}`, { cache: "no-store" })).json()).version;
      if (!v || String(v) === VERSION) return;
      const last = Number(sessionStorage.getItem("kamera-update") || 0);
      if (Date.now() - last < 30 * 60000) return;
      sessionStorage.setItem("kamera-update", String(Date.now()));
      setStatus("Nowa wersja strony kamery — zapisuję nagranie i odświeżam…");
      archive.stop();
      setTimeout(() => location.reload(), 8000);
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
  function report() {
    const r = archive.status();
    const s = { id: CHANNEL, instance: INSTANCE, live: live && !!stream, recording: r.recording, reason: r.reason, folder: r.folder,
      last_file: r.lastFile, saved: r.saved, viewers: peers.size, version: VERSION, user_agent: navigator.userAgent };
    fetch(`${SUPABASE_URL}/rest/v1/rpc/report_camera_status`, {
      method: "POST", keepalive: true,
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ s }),
    }).catch(() => {});
  }

  return { start, stop, switchCamera, notifyViewers, get live() { return live; } };
})();

// ---------- PODGLĄD (telefon) ----------
const viewer = (() => {
  const viewerId = crypto.randomUUID();
  let pc = null, pending = [], lastSeen = 0, lastJoin = 0, brokenSince = 0, watchdog = null, active = false;
  let rec = null, recClock = null;
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
      const st = pc?.connectionState;
      if ((!st || st === "failed" || st === "closed") && Date.now() - lastJoin > 10000) join();
      return;
    }
    if (sig.type === "broadcaster-ready") { reset(); return join(); }
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
      if (pc?.connectionState === "connected") { brokenSince = 0; return; }
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

  return { start, stop, sendZoom, toggleRec() { rec ? stopRec() : startRec(); }, rejoin() { reset(); setStatus("Łączę ponownie…"); join(); } };
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
  if (!pcLibrary) pcLibrary = mountLibrary($("pcLibrary"), { days: () => archive.listDays(), day: d => archive.listDay(d), remove: t => archive.remove(t), watchUrl: driveWatchUrl });
  else pcLibrary.refresh();
}
function showSender() {
  dvr?.stop(); $("dvrCard").hidden = true;
  $("sendPanel").hidden = false; $("watchPanel").hidden = true; $("viewEventsCard").hidden = true; $("layout").classList.add("sender");
  $("roleBtn").textContent = "Wyłącz nadawanie na tym komputerze (tylko oglądaj)";
  archive.init().then(showPcLibrary);
  sender.start();
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
  dvr ??= mountDvr({ client: recClient, root: $("dvrCard"), stage: $("stage"), liveVideo: video, toast: toastMsg });
  recClient.onopen = () => dvr.refresh();
  $("dvrCard").hidden = false;
  dvr.start();
  $("roleBtn").textContent = "To jest komputer z kamerą — nadawaj z niego";
  viewer.start();
}

// ---------- Przyciski ----------
function setRole(toSend) {
  sender.stop(); viewer.stop();
  prefs.role = toSend ? "send" : "watch"; savePrefs();
  toSend ? showSender() : showViewer();
}
$("roleBtn").addEventListener("click", () => {
  const toSend = prefs.role !== "send";
  if (!confirm(toSend
    ? "Ustawić to urządzenie jako kamerę? Będzie nadawać obraz i dźwięk (widzą je osoby z PIN-em) i nagrywać 24/7."
    : "Wyłączyć nadawanie? To urządzenie będzie tylko oglądać.")) return;
  setRole(toSend);
});
$("startHere").addEventListener("click", () => {
  if (!confirm("Włączyć kamerę i mikrofon tego komputera? Obraz zobaczą osoby z PIN-em.")) return;
  setRole(true);
});
$("pickDir").addEventListener("click", () => archive.pick());
$("grantDir").addEventListener("click", () => archive.grant());
$("pcLibRefresh").addEventListener("click", () => showPcLibrary());
$("lockBtn").addEventListener("click", () => { if (confirm("Zablokować stronę na tym urządzeniu? Przy następnym wejściu trzeba będzie wpisać PIN.")) { sender.stop(); viewer.stop(); lock(); location.reload(); } });
$("grantBanner").addEventListener("click", () => archive.grant());
// Chrome po odświeżeniu strony wymaga ponownej zgody na zapis do folderu, a zgodę można poprosić
// tylko po kliknięciu — wystarczy więc dowolne kliknięcie na stronie, żeby wznowić nagrywanie.
document.addEventListener("pointerdown", () => { if (prefs.role === "send" && archive.needsGrant()) archive.grant(); }, true);
$("startBtn").addEventListener("click", () => sender.start());
$("stopBtn").addEventListener("click", () => sender.stop());
// Jakość nagrań jest stała (pełna rozdzielczość, 5/30 kl./s), a stare nagrania kasuje pętla zapisu — te ustawienia znikają.
$("quality").closest("label").hidden = true;
$("retentionDays").closest("label").hidden = true;
for (const id of ["segmentMin", "retentionDays"]) {
  $(id).value = String(prefs[id]);
  $(id).addEventListener("change", e => { prefs[id] = Number(e.target.value); savePrefs(); });
}
$("cameraSelect").addEventListener("change", e => { prefs.cameraId = e.target.value; savePrefs(); sender.switchCamera(); });
$("detectToggle").checked = prefs.detect;
$("detectToggle").addEventListener("change", e => { prefs.detect = e.target.checked; savePrefs(); sender.switchCamera(); });
$("sensitivity").value = prefs.sensitivity;
$("sensitivity").addEventListener("change", e => { prefs.sensitivity = e.target.value; savePrefs(); });
renderEvents("pcEvents", recentEvents); renderEvents("viewEvents", viewEvents);
$("withAudio").checked = prefs.audio;
$("withAudio").addEventListener("change", e => { prefs.audio = e.target.checked; savePrefs(); });
$("reconnectBtn").addEventListener("click", () => viewer.rejoin());
$("watchRecBtn").addEventListener("click", () => viewer.toggleRec());
$("fullBtn").addEventListener("click", () => (video.requestFullscreen?.() ?? video.webkitEnterFullscreen?.())?.catch?.(() => {}));
$("soundBtn").addEventListener("click", () => { video.muted = !video.muted; video.volume = 1; $("soundBtn").textContent = video.muted ? "🔊 Włącz dźwięk" : "🔇 Wycisz"; });

// ---------- Start: PIN, potem od razu podgląd (albo nadawanie na komputerze-kamerze) ----------
// Adres dominiksolorz.github.io/#nadaj ustawia to urządzenie jako kamerę (bez klikania na stronie).
if (location.hash === "#nadaj") { prefs.role = "send"; savePrefs(); history.replaceState(null, "", location.pathname); }
window.__kameraReady = true;
$("bootError").hidden = true;
ACCESS_KEY = await requireAccess();
CHANNEL = await channelFor(ACCESS_KEY);
if (new URLSearchParams(location.search).get("wroc") === "nagrania") location.replace("nagrania.html");
$("app").hidden = false; $("lockBtn").hidden = false;
if (prefs.role === "send") showSender();
else showViewer();

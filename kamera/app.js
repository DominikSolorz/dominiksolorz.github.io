// vendor/supabase.js (@supabase/supabase-js 2.117.2) ładowany w index.html przed tym modułem.
// Pliki mają numer wersji w adresie (?v=…), bo GitHub Pages trzyma je w pamięci podręcznej przez 10 min.
const { createClient } = window.supabase;
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, TURN_SERVER } from "./config.js?v=11";

// Bez logowania, publicznie: każdy, kto otworzy stronę, ogląda kamerę. Supabase służy tylko
// do wymiany sygnałów WebRTC na jednym stałym kanale; obraz i dźwięk płyną peer-to-peer.
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const CHANNEL = "cam-dominiksolorz-live";
// Komputer (nie telefon) z kamerą dostaje duży przycisk „Włącz kamerę”, gdy nikt nie nadaje.
const IS_DESKTOP = !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) && !!navigator.mediaDevices?.getUserMedia;
const MAX_VIEWERS = 5;
// Jakość przesyłu na żywo: HD 720p, 30 kl./s, do 2,5 Mb/s na oglądającego; H.264 = sprzętowe dekodowanie na iPhonie.
const LIVE_MAX_BITRATE = 2500000;
const LIVE_FPS = 30;
// Wirtualne kamery (OBS, Snap, ManyCam…) pokazują zastępczy obrazek, gdy ich program nie działa — pomijamy je.
const VIRTUAL_CAM = /obs|virtual|snap camera|manycam|xsplit|ndi|splitcam|vcam|droidcam|epoccam|camo|iriun/i; // każdy oglądający to osobny strumień z domowego łącza
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
const DEFAULTS = { role: null, cameraId: "", audio: true, recQuality: "small", segmentMin: 10, retentionDays: 1 };

// Jakość NAGRAŃ (osobno od obrazu na żywo, który zostaje w HD). Mniejsza rozdzielczość, mniej klatek
// i niska przepływność = małe pliki na Google Drive. Rozmiary to przybliżenie dla 5 minut nagrania.
const REC_PRESETS = {
  mini:   { w: 426,  h: 240, fps: 8,  video: 40000,  audio: 16000, label: "Mini — 240p (~2 MB / 5 min)" },
  small:  { w: 640,  h: 360, fps: 10, video: 90000,  audio: 20000, label: "Mała — 360p (~4 MB / 5 min)" },
  medium: { w: 854,  h: 480, fps: 15, video: 190000, audio: 24000, label: "Średnia — 480p (~8 MB / 5 min)" },
  hd:     { w: 1280, h: 720, fps: 20, video: 350000, audio: 32000, label: "HD — 720p (~15 MB / 5 min)" },
};
const recPreset = () => REC_PRESETS[prefs.recQuality] || REC_PRESETS.small;
function loadPrefs() { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") }; } catch { return { ...DEFAULTS }; } }
function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* tryb prywatny */ } }
const prefs = loadPrefs();
// Jednorazowo: nowy plik co 10 minut i przechowywanie 30 dni (biblioteka nagrań na Google Drive).
if (!prefs.lib1) { prefs.segmentMin = 10; prefs.retentionDays = 30; prefs.lib1 = true; savePrefs(); }


// ---------- UI pomocnicze ----------
const video = $("video");
function setStatus(text) { $("status").textContent = text || ""; $("status").hidden = !text; }
function showPlaceholder(text) { $("placeholder").textContent = text; $("placeholder").hidden = !text; }
function showLive(text) { $("liveBadge").hidden = !text; if (text) $("liveText").textContent = text; }

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
      const r = indexedDB.open("prywatna-kamera", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  },
  async get(k) { const db = await this.open(); return new Promise(res => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); },
  async set(k, v) { const db = await this.open(); return new Promise(res => { const t = db.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = () => res(); t.onerror = () => res(); }); },
};

// ---------- Nagrywanie ciągłe 24/7 → wyłącznie folder Google Drive (nic nie trafia do „Pobrane”) ----------
// Nagrywa tylko, gdy wybrano folder Google Drive (Dysk Google na komputer w trybie strumieniowania
// trzyma pliki w chmurze). Bez tego folderu nagrania nie są nigdzie zapisywane.
const archive = (() => {
  const fsSupported = "showDirectoryPicker" in window;
  let dir = null, granted = false, source = null, recStream = null, running = false, rec = null, segTimer = null, clock = null;
  let recSince = 0, saved = 0, lastName = "", lastError = "";
  const canWrite = () => !!(dir && granted);

  async function init() {
    if (fsSupported) {
      try { dir = (await idb.get("dir")) || null; } catch { dir = null; }
      if (dir) granted = (await dir.queryPermission({ mode: "readwrite" }).catch(() => "denied")) === "granted";
    }
    resume();
  }

  async function pick() {
    try {
      dir = await window.showDirectoryPicker({ id: "prywatna-kamera", mode: "readwrite" });
      await idb.set("dir", dir);
      granted = true; lastError = "";
      resume();
    } catch (e) { if (e?.name !== "AbortError") { lastError = errText(e); render(); } }
  }

  async function grant() {
    if (!dir) return;
    granted = (await dir.requestPermission({ mode: "readwrite" }).catch(() => "denied")) === "granted";
    resume();
  }

  async function save(blob, name) {
    if (!canWrite()) { lastError = "Brak dostępu do folderu Google Drive — ten fragment nagrania nie został zapisany."; return render(); }
    try {
      // Biblioteka: folder dnia (RRRR-MM-DD) → folder godziny (GG-00) → plik z godziną, minutą i sekundą.
      const m = /^kamera-(\d{4}-\d{2}-\d{2})_(\d{2})-\d{2}-\d{2}\./.exec(name);
      const dayDir = m ? await dir.getDirectoryHandle(m[1], { create: true }) : dir;
      const hourDir = m ? await dayDir.getDirectoryHandle(`${m[2]}-00`, { create: true }) : dir;
      const fh = await hourDir.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      await w.write(blob); await w.close();
      saved++; lastName = name; lastError = "";
      await cleanup();
    } catch (e) {
      lastError = `Nie udało się zapisać do folderu Google Drive (${errText(e)}). Nagrywanie wstrzymane — kliknij „Zezwól na zapis do folderu”.`;
      granted = false; halt();
    }
    render();
  }

  // Usuwa własne nagrania starsze niż wybrana liczba dni: całe foldery dni „RRRR-MM-DD”
  // oraz starsze pojedyncze pliki „kamera-RRRR-MM-DD_…” (sprzed podziału na foldery).
  async function cleanup() {
    const days = Number(prefs.retentionDays);
    if (!days || !canWrite()) return;
    const limit = Date.now() - days * 86400000;
    for await (const [name, handle] of dir.entries()) {
      const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(name);
      if (d && handle.kind === "directory") {
        if (new Date(+d[1], +d[2] - 1, +d[3], 23, 59, 59).getTime() < limit) await dir.removeEntry(name, { recursive: true }).catch(() => {});
        continue;
      }
      const m = /^kamera-(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.(webm|mp4)$/.exec(name);
      if (!m || handle.kind !== "file") continue;
      const t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
      if (t < limit) await dir.removeEntry(name).catch(() => {});
    }
  }

  // Osobna, pomniejszona kopia obrazu tylko do nagrywania (podgląd na żywo zostaje w pełnej jakości).
  async function makeRecStream(s) {
    const p = recPreset();
    const v = s.getVideoTracks()[0]?.clone();
    if (v) { try { await v.applyConstraints({ width: { ideal: p.w }, height: { ideal: p.h }, frameRate: { ideal: p.fps, max: p.fps } }); } catch { /* zostaje oryginalna rozdzielczość */ } }
    return new MediaStream([...(v ? [v] : []), ...s.getAudioTracks()]);
  }

  function startSegment() {
    const startedAt = new Date();
    const p = recPreset();
    const r = new MediaRecorder(recStream, { ...(MIME ? { mimeType: MIME } : {}), videoBitsPerSecond: p.video, audioBitsPerSecond: p.audio });
    const chunks = [];
    r.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    r.onstop = () => {
      if (!chunks.length) return;
      const type = r.mimeType || MIME || "video/webm";
      save(new Blob(chunks, { type }), `kamera-${stamp(startedAt)}.${extFor(type)}`);
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

  // Zaczyna nagrywać, gdy jest obraz z kamery i dostęp do folderu Google Drive.
  async function resume() {
    if (!running && source && canWrite() && MIME !== null) {
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
    clearTimeout(segTimer); clearInterval(clock);
    if (rec && rec.state !== "inactive") rec.stop();
    rec = null;
    const rs = recStream; recStream = null;
    // Kopię obrazu zatrzymujemy po domknięciu ostatniego pliku.
    if (rs) setTimeout(() => rs.getVideoTracks().forEach(t => t.stop()), 1000);
  }

  function start(s) { source = s; resume(); }
  function stop() { halt(); source = null; render(); }
  // Zmiana jakości nagrań: bieżący plik zostaje zapisany, następny już w nowej jakości.
  function restart() { if (running) { halt(); resume(); } else render(); }

  function render() {
    $("recBadge").hidden = !running;
    let text;
    if (MIME === null) text = "Ta przeglądarka nie obsługuje nagrywania.";
    else if (!fsSupported) text = "Nagrywanie do Google Drive działa w Chrome lub Edge na komputerze. W tej przeglądarce nic nie jest nagrywane.";
    else if (!dir) text = "Nagrywanie wyłączone — nic nie zapisuje się na komputerze. Wybierz folder Google Drive, żeby nagrania szły do chmury.";
    else if (!granted) text = `Folder „${dir.name}” wymaga zgody — kliknij „Zezwól na zapis do folderu”. Do tego czasu nic nie jest nagrywane.`;
    else text = running ? `Nagrywa bez przerwy do „${dir.name}” (pliki co ${prefs.segmentMin} min).` : `Folder zapisu: „${dir.name}”. Nagrywanie ruszy, gdy kamera będzie włączona.`;
    const count = saved ? ` Zapisano plików: ${saved}, ostatni: ${lastName}.` : "";
    $("archiveInfo").textContent = `${text}${count}${lastError ? ` ${lastError}` : ""}`;
    $("pickDir").hidden = !fsSupported;
    $("pickDir").textContent = dir ? "Zmień folder Google Drive" : "Wybierz folder Google Drive";
    $("grantDir").hidden = !(fsSupported && dir && !granted);
  }

  return { init, pick, grant, start, stop, restart };
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
  let inVideo = false;
  return sdp.split("\r\n").map(line => {
    if (line.startsWith("m=")) inVideo = line.startsWith("m=video");
    if (inVideo && line.startsWith("a=fmtp:") && !line.includes("x-google-start-bitrate")) {
      return `${line};x-google-min-bitrate=600;x-google-start-bitrate=1500;x-google-max-bitrate=${kbps}`;
    }
    return line;
  }).join("\r\n");
}

// Wyższy limit przepływności; przy słabszym łączu równoważy ostrość i płynność.
async function tuneVideoSender(pc) {
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind !== "video") continue;
    try {
      const p = sender.getParameters();
      if (!p.encodings?.length) p.encodings = [{}];
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
  let stream = null, live = false, heartbeat = null, keepAlive = null, camTimer = null, camAttempt = 0, wakeLock = null;
  const chan = reconnectingChannel({
    label: "Nadajnik",
    onSignal,
    onSubscribed: ch => { if (stream && !VIRTUAL_CAM.test(stream.getVideoTracks()[0]?.label || "")) setStatus(""); send(ch, { type: "broadcaster-ready" }); },
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
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    preferH264(pc);
    pc.onicecandidate = e => { if (e.candidate) send(ch, { type: "ice", viewerId, from: "broadcaster", candidate: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => { if (["failed", "closed"].includes(pc.connectionState) && peers.get(viewerId)?.pc === pc) closePeer(viewerId); };
    const offer = await pc.createOffer();
    offer.sdp = fastStart(offer.sdp);
    await pc.setLocalDescription(offer);
    await tuneVideoSender(pc);
    send(ch, { type: "offer", viewerId, sdp: offer });
  }

  async function onSignal(sig) {
    if (sig.type === "viewer-join") return connectViewer(sig.viewerId);
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
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: LIVE_FPS, max: LIVE_FPS }, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) },
    audio: prefs.audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
  }).then(s => { s.getVideoTracks().forEach(t => { t.contentHint = "motion"; }); return s; });

  // Lista kamer do wyboru + automatyczny wybór prawdziwej kamery zamiast wirtualnej.
  async function listCameras() {
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput");
    const sel = $("cameraSelect");
    sel.innerHTML = "";
    sel.append(new Option("Automatycznie (prawdziwa kamera)", ""));
    cams.forEach((c, i) => sel.append(new Option(`${c.label || `Kamera ${i + 1}`}${VIRTUAL_CAM.test(c.label) ? " (wirtualna)" : ""}`, c.deviceId)));
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
    const label = s.getVideoTracks()[0]?.label || "";
    if (!prefs.cameraId && VIRTUAL_CAM.test(label)) {
      const real = cams.find(c => c.label && !VIRTUAL_CAM.test(c.label));
      if (real) { s.getTracks().forEach(t => t.stop()); s = await getMedia(real.deviceId); }
    }
    return s;
  }

  async function acquireCamera() {
    try {
      const s = await openBestCamera();
      if (!live) { s.getTracks().forEach(t => t.stop()); return false; }
      const label = s.getVideoTracks()[0]?.label || "";
      if (VIRTUAL_CAM.test(label)) setStatus(`Używana jest wirtualna kamera „${label}” — jeśli widać logo zamiast obrazu, wybierz prawdziwą kamerę na liście „Kamera” poniżej.`);
      stream = s;
      video.srcObject = s; video.muted = true;
      showPlaceholder("");
      s.getVideoTracks()[0]?.addEventListener("ended", () => { if (live && stream === s) cameraLost(); });
      camAttempt = 0;
      archive.start(s);
      return true;
    } catch (e) {
      setStatus(`Brak dostępu do kamery/mikrofonu: ${errText(e)}. Zezwól przeglądarce — ponawiam próbę…`);
      return false;
    }
  }

  function cameraLost() {
    archive.stop(); closeAll();
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
    archive.stop(); closeAll();
    stream?.getTracks().forEach(t => t.stop()); stream = null;
    if (await acquireCamera()) {
      if (!VIRTUAL_CAM.test(stream?.getVideoTracks()[0]?.label || "")) setStatus("");
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
    heartbeat = setInterval(() => { if (stream) send(chan.channel, { type: "heartbeat" }); }, HEARTBEAT_MS);
    // Lekki sygnał do Supabase co 6 h, żeby darmowy projekt nie był uznany za nieużywany.
    clearInterval(keepAlive);
    keepAlive = setInterval(() => { fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } }).catch(() => {}); }, 6 * 3600000);
    requestWakeLock();
  }

  function stop() {
    if (!live) return;
    live = false;
    archive.stop();
    clearInterval(heartbeat); clearInterval(keepAlive); clearTimeout(camTimer);
    send(chan.channel, { type: "broadcaster-stop" });
    chan.stop();
    closeAll();
    stream?.getTracks().forEach(t => t.stop()); stream = null;
    video.srcObject = null;
    wakeLock?.release().catch(() => {}); wakeLock = null;
    $("startBtn").hidden = false; $("stopBtn").hidden = true;
    showLive(""); showPlaceholder("Kamera wyłączona"); setStatus("");
  }

  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && live) requestWakeLock(); });
  window.addEventListener("online", () => { if (live) chan.reconnect(); });
  window.addEventListener("beforeunload", () => { if (live) send(chan.channel, { type: "broadcaster-stop" }); });

  return { start, stop, switchCamera, get live() { return live; } };
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
      const st = pc?.connectionState;
      if ((!st || st === "failed" || st === "closed") && Date.now() - lastJoin > 10000) join();
      return;
    }
    if (sig.type === "broadcaster-ready") { reset(); return join(); }
    if (sig.type === "broadcaster-stop") { reset(); lastSeen = 0; showPlaceholder("Kamera jest wyłączona."); return; }
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
      conn.onicecandidate = e => { if (e.candidate) send(chan.channel, { type: "ice", viewerId, from: "viewer", candidate: e.candidate.toJSON() }); };
      conn.onconnectionstatechange = () => {
        if (pc !== conn) return;
        const st = conn.connectionState;
        if (st === "connected") {
          brokenSince = 0; showPlaceholder(""); showLive("NA ŻYWO"); setStatus("");
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

  return { start, stop, toggleRec() { rec ? stopRec() : startRec(); }, rejoin() { reset(); setStatus("Łączę ponownie…"); join(); } };
})();

// ---------- Widoki ----------
function showSender() {
  $("sendPanel").hidden = false; $("watchPanel").hidden = true;
  $("roleBtn").textContent = "Wyłącz nadawanie na tym komputerze (tylko oglądaj)";
  archive.init();
  sender.start();
}

function showViewer() {
  $("sendPanel").hidden = true; $("watchPanel").hidden = false;
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
    ? "Ustawić to urządzenie jako kamerę? Będzie nadawać obraz i dźwięk publicznie (każdy na stronie zobaczy) i nagrywać 24/7."
    : "Wyłączyć nadawanie? To urządzenie będzie tylko oglądać.")) return;
  setRole(toSend);
});
$("startHere").addEventListener("click", () => {
  if (!confirm("Włączyć kamerę i mikrofon tego komputera? Obraz będzie widoczny publicznie na tej stronie.")) return;
  setRole(true);
});
$("pickDir").addEventListener("click", () => archive.pick());
$("grantDir").addEventListener("click", () => archive.grant());
$("startBtn").addEventListener("click", () => sender.start());
$("stopBtn").addEventListener("click", () => sender.stop());
$("quality").innerHTML = "";
for (const [key, p] of Object.entries(REC_PRESETS)) $("quality").append(new Option(p.label, key));
$("quality").value = prefs.recQuality in REC_PRESETS ? prefs.recQuality : "small";
$("quality").addEventListener("change", e => { prefs.recQuality = e.target.value; savePrefs(); archive.restart(); });
for (const id of ["segmentMin", "retentionDays"]) {
  $(id).value = String(prefs[id]);
  $(id).addEventListener("change", e => { prefs[id] = Number(e.target.value); savePrefs(); });
}
$("cameraSelect").addEventListener("change", e => { prefs.cameraId = e.target.value; savePrefs(); sender.switchCamera(); });
$("withAudio").checked = prefs.audio;
$("withAudio").addEventListener("change", e => { prefs.audio = e.target.checked; savePrefs(); });
$("reconnectBtn").addEventListener("click", () => viewer.rejoin());
$("watchRecBtn").addEventListener("click", () => viewer.toggleRec());
$("fullBtn").addEventListener("click", () => (video.requestFullscreen?.() ?? video.webkitEnterFullscreen?.())?.catch?.(() => {}));
$("soundBtn").addEventListener("click", () => { video.muted = !video.muted; $("soundBtn").textContent = video.muted ? "Włącz dźwięk" : "Wycisz"; });

// ---------- Start: od razu, bez logowania — domyślnie podgląd ----------
// Adres dominiksolorz.github.io/#nadaj ustawia to urządzenie jako kamerę (bez klikania na stronie).
if (location.hash === "#nadaj") { prefs.role = "send"; savePrefs(); history.replaceState(null, "", location.pathname); }
if (prefs.role === "send") showSender();
else showViewer();
window.__kameraReady = true;
$("bootError").hidden = true;

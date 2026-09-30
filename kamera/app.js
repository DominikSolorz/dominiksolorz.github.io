// vendor/supabase.js (@supabase/supabase-js 2.117.2) i vendor/qrcode.js (qrcode-generator 1.4.4) ładowane w index.html przed tym modułem.
// Pliki mają numer wersji w adresie (?v=…), bo GitHub Pages trzyma je w pamięci podręcznej przez 10 min.
const { createClient } = window.supabase;
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, TURN_SERVER } from "./config.js?v=3";

// Bez logowania: Supabase służy tylko do wymiany sygnałów WebRTC. Dostęp chroni tajny klucz
// w linku (192 bity losowości) — kanał `cam-<klucz>` zna tylko komputer i osoby z linkiem.
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

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
const DEFAULTS = { role: null, key: null, audio: true, quality: 600000, segmentMin: 10, retentionDays: 1 };
function loadPrefs() { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") }; } catch { return { ...DEFAULTS }; } }
function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* tryb prywatny */ } }
const prefs = loadPrefs();

function newKey() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const viewUrl = key => `${location.origin}${location.pathname}#k=${key}`;

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

// ---------- Nagrywanie ciągłe 24/7 (pliki co N minut → folder Google Drive) ----------
const archive = (() => {
  const fsSupported = "showDirectoryPicker" in window;
  let dir = null, granted = false, stream = null, running = false, rec = null, segTimer = null, clock = null;
  let recSince = 0, saved = 0, lastName = "", lastError = "";

  async function init() {
    if (!fsSupported) return render();
    try { dir = (await idb.get("dir")) || null; } catch { dir = null; }
    if (dir) granted = (await dir.queryPermission({ mode: "readwrite" }).catch(() => "denied")) === "granted";
    render();
  }

  async function pick() {
    try {
      dir = await window.showDirectoryPicker({ id: "prywatna-kamera", mode: "readwrite" });
      await idb.set("dir", dir);
      granted = true; lastError = "";
      render();
    } catch (e) { if (e?.name !== "AbortError") { lastError = errText(e); render(); } }
  }

  async function grant() {
    if (!dir) return;
    granted = (await dir.requestPermission({ mode: "readwrite" }).catch(() => "denied")) === "granted";
    render();
  }

  async function save(blob, name) {
    if (dir && granted) {
      try {
        const fh = await dir.getFileHandle(name, { create: true });
        const w = await fh.createWritable();
        await w.write(blob); await w.close();
        saved++; lastName = name; lastError = "";
        await cleanup();
        return render();
      } catch (e) { lastError = `Nie udało się zapisać do folderu (${errText(e)}) — zapisuję do „Pobrane”.`; granted = false; }
    }
    download(blob, name);
    saved++; lastName = name;
    render();
  }

  // Usuwa własne nagrania starsze niż wybrana liczba dni (tylko pliki „kamera-RRRR-MM-DD_…”).
  async function cleanup() {
    const days = Number(prefs.retentionDays);
    if (!days || !dir || !granted) return;
    const limit = Date.now() - days * 86400000;
    for await (const [name, handle] of dir.entries()) {
      const m = /^kamera-(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.(webm|mp4)$/.exec(name);
      if (!m || handle.kind !== "file") continue;
      const t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
      if (t < limit) await dir.removeEntry(name).catch(() => {});
    }
  }

  function startSegment() {
    const startedAt = new Date();
    const r = new MediaRecorder(stream, { ...(MIME ? { mimeType: MIME } : {}), videoBitsPerSecond: Number(prefs.quality), audioBitsPerSecond: 64000 });
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
    if (running && stream) startSegment();
    if (old && old.state !== "inactive") old.stop();
  }

  function start(s) {
    if (MIME === null) { lastError = "Ta przeglądarka nie obsługuje nagrywania."; return render(); }
    stream = s; running = true; recSince = Date.now();
    startSegment();
    clearInterval(clock);
    clock = setInterval(() => { $("recTime").textContent = fmtTime(Math.floor((Date.now() - recSince) / 1000)); }, 1000);
    render();
  }

  function stop() {
    running = false;
    clearTimeout(segTimer); clearInterval(clock);
    if (rec && rec.state !== "inactive") rec.stop();
    rec = null; stream = null;
    render();
  }

  function render() {
    $("recBadge").hidden = !running;
    const where = !fsSupported
      ? "Pliki zapisują się w folderze „Pobrane” tej przeglądarki — ustaw w niej folder pobierania na folder Google Drive."
      : dir && granted ? `Folder zapisu: „${dir.name}”.`
      : dir ? `Folder „${dir.name}” wymaga zgody — kliknij „Zezwól na zapis do folderu”. Do tego czasu pliki idą do „Pobrane”.`
      : "Nie wybrano folderu — pliki idą do „Pobrane”. Wybierz folder Google Drive.";
    const state = running ? `Nagrywa bez przerwy (pliki co ${prefs.segmentMin} min).` : "Nagrywanie zatrzymane.";
    const count = saved ? ` Zapisano plików: ${saved}, ostatni: ${lastName}.` : "";
    $("archiveInfo").textContent = `${state} ${where}${count}${lastError ? ` ${lastError}` : ""}`;
    $("pickDir").hidden = !fsSupported;
    $("pickDir").textContent = dir ? "Zmień folder zapisu" : "Wybierz folder zapisu (Google Drive)";
    $("grantDir").hidden = !(fsSupported && dir && !granted);
  }

  return { init, pick, grant, start, stop };
})();

// ---------- Kanał sygnalizacji z automatycznym wznawianiem ----------
function reconnectingChannel({ onSignal, onSubscribed, label }) {
  let channel = null, attempt = 0, timer = null, active = false;
  function connect() {
    if (!active || !prefs.key) return;
    clearTimeout(timer);
    const old = channel; channel = null;
    if (old) supabase.removeChannel(old);
    const ch = supabase.channel(`cam-${prefs.key}`, { config: { broadcast: { self: false } } });
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

// ---------- NADAJNIK (komputer z kamerą) ----------
const sender = (() => {
  const peers = new Map();
  let stream = null, live = false, heartbeat = null, keepAlive = null, camTimer = null, camAttempt = 0, wakeLock = null;
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
    closePeer(viewerId);
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    const peer = { pc, pending: [] };
    peers.set(viewerId, peer); renderViewers();
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    pc.onicecandidate = e => { if (e.candidate) send(ch, { type: "ice", viewerId, from: "broadcaster", candidate: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => { if (["failed", "closed"].includes(pc.connectionState) && peers.get(viewerId)?.pc === pc) closePeer(viewerId); };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
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

  async function acquireCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: prefs.audio ? { echoCancellation: true, noiseSuppression: true } : false,
      });
      if (!live) { s.getTracks().forEach(t => t.stop()); return false; }
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

  function restartChannel() { if (live) { closeAll(); chan.reconnect(); } }

  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && live) requestWakeLock(); });
  window.addEventListener("online", () => { if (live) chan.reconnect(); });
  window.addEventListener("beforeunload", () => { if (live) send(chan.channel, { type: "broadcaster-stop" }); });

  return { start, stop, restartChannel, get live() { return live; } };
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
    showLive(""); showPlaceholder("Łączenie…");
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
    if (sig.type === "offer") {
      reset();
      const conn = new RTCPeerConnection({ iceServers: iceServers() });
      pc = conn;
      conn.ontrack = e => {
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
      if (offline && chan.channel) showPlaceholder("Kamera nie nadaje (komputer offline).\nPołączę się sam, gdy wróci.");
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
function renderLink() {
  const url = viewUrl(prefs.key);
  $("viewLink").value = url;
  try {
    const qr = window.qrcode(0, "M");
    qr.addData(url); qr.make();
    $("qr").innerHTML = "";
    const img = new Image();
    img.src = qr.createDataURL(6, 2);
    img.alt = "Kod QR z linkiem do podglądu";
    $("qr").appendChild(img);
  } catch { $("qr").textContent = ""; }
}

function showSender() {
  $("setup").hidden = true; $("app").hidden = false; $("resetRole").hidden = false;
  $("sendPanel").hidden = false; $("watchPanel").hidden = true;
  renderLink();
  archive.init();
  sender.start();
}

function showViewer() {
  $("setup").hidden = true; $("app").hidden = false; $("resetRole").hidden = false;
  $("sendPanel").hidden = true; $("watchPanel").hidden = false;
  viewer.start();
}

function showSetup() {
  $("setup").hidden = false; $("app").hidden = true; $("resetRole").hidden = true;
}

// ---------- Przyciski ----------
$("chooseSend").addEventListener("click", () => { prefs.role = "send"; if (!prefs.key) prefs.key = newKey(); savePrefs(); showSender(); });
$("chooseWatch").addEventListener("click", () => { $("watchHelp").hidden = false; });
$("resetRole").addEventListener("click", () => {
  if (!confirm("Zmienić rolę tego urządzenia? Kamera/podgląd na nim się zatrzyma.")) return;
  sender.stop(); viewer.stop();
  prefs.role = null; savePrefs();
  history.replaceState(null, "", location.pathname);
  showSetup();
});
$("copyLink").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("viewLink").value); $("copyLink").textContent = "Skopiowano"; }
  catch { $("viewLink").select(); document.execCommand("copy"); $("copyLink").textContent = "Skopiowano"; }
  setTimeout(() => { $("copyLink").textContent = "Kopiuj"; }, 2000);
});
$("newKey").addEventListener("click", () => {
  if (!confirm("Utworzyć nowy link? Stary link przestanie działać — trzeba będzie otworzyć nowy na telefonie.")) return;
  prefs.key = newKey(); savePrefs(); renderLink(); sender.restartChannel();
});
$("pickDir").addEventListener("click", () => archive.pick());
$("grantDir").addEventListener("click", () => archive.grant());
$("startBtn").addEventListener("click", () => sender.start());
$("stopBtn").addEventListener("click", () => sender.stop());
for (const id of ["quality", "segmentMin", "retentionDays"]) {
  $(id).value = String(prefs[id]);
  $(id).addEventListener("change", e => { prefs[id] = Number(e.target.value); savePrefs(); });
}
$("withAudio").checked = prefs.audio;
$("withAudio").addEventListener("change", e => { prefs.audio = e.target.checked; savePrefs(); });
$("reconnectBtn").addEventListener("click", () => viewer.rejoin());
$("watchRecBtn").addEventListener("click", () => viewer.toggleRec());
$("fullBtn").addEventListener("click", () => (video.requestFullscreen?.() ?? video.webkitEnterFullscreen?.())?.catch?.(() => {}));
$("soundBtn").addEventListener("click", () => { video.muted = !video.muted; $("soundBtn").textContent = video.muted ? "Włącz dźwięk" : "Wycisz"; });

// ---------- Start: od razu, bez logowania ----------
const hashKey = new URLSearchParams(location.hash.slice(1)).get("k");
if (hashKey && hashKey !== prefs.key) { prefs.key = hashKey; prefs.role = "watch"; savePrefs(); }
else if (hashKey && prefs.role !== "send") { prefs.role = "watch"; savePrefs(); }

if (prefs.role === "send" && prefs.key) showSender();
else if (prefs.role === "watch" && prefs.key) showViewer();
else showSetup();
window.__kameraReady = true;
$("bootError").hidden = true;

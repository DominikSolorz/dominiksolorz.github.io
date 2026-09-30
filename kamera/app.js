// @supabase/supabase-js 2.117.2 (UMD, przypięta wersja + SRI) ładowany w index.html przed tym modułem.
const { createClient } = window.supabase;
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, TURN_SERVER } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const HEARTBEAT_MS = 15000;
const OFFLINE_AFTER_MS = 45000;
const PREFS_KEY = "prywatna-kamera-prefs";
const retryDelay = n => Math.min(30000, 2000 * 2 ** n);
const $ = id => document.getElementById(id);
const errText = e => (e instanceof Error ? e.message : String(e));

const iceServers = () => {
  const s = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];
  if (TURN_SERVER) s.push(TURN_SERVER);
  return s;
};

// ---------- UI pomocnicze ----------
const video = $("video");
function setStatus(text) { $("status").textContent = text || ""; $("status").hidden = !text; }
function showPlaceholder(text) { $("placeholder").textContent = text; $("placeholder").hidden = !text; }
function showLive(text) { $("liveBadge").hidden = !text; if (text) $("liveText").textContent = text; }

function loadPrefs() {
  try { return { autostart: false, audio: true, mode: "send", ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") }; }
  catch { return { autostart: false, audio: true, mode: "send" }; }
}
function savePrefs(p) { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* tryb prywatny */ } }
const prefs = loadPrefs();

// ---------- Nagrywanie (MediaRecorder, plik zostaje na urządzeniu) ----------
const recorder = (() => {
  const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  const mime = typeof MediaRecorder === "undefined" ? null : (types.find(t => MediaRecorder.isTypeSupported(t)) ?? "");
  let rec = null, timer = null, lastUrl = null, button = null;
  const pad = n => String(n).padStart(2, "0");
  const fmt = s => `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  function fileName(type) {
    const d = new Date();
    return `kamera-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.${type.startsWith("video/mp4") ? "mp4" : "webm"}`;
  }
  function render(recording, elapsed = 0) {
    $("recBadge").hidden = !recording;
    $("recTime").textContent = fmt(elapsed);
    for (const b of [$("sendRecBtn"), $("watchRecBtn")]) {
      b.textContent = recording && b === button ? `Zatrzymaj nagrywanie (${fmt(elapsed)})` : "Nagrywaj";
      b.classList.toggle("rec-on", recording && b === button);
    }
  }
  return {
    supported: mime !== null,
    get active() { return !!rec; },
    start(stream, btn) {
      if (!stream || mime === null) { setStatus(stream ? "Ta przeglądarka nie obsługuje nagrywania." : "Brak obrazu do nagrania."); return; }
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = [];
      r.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      r.onstop = () => {
        clearInterval(timer); rec = null; render(false);
        if (!chunks.length) return;
        const type = r.mimeType || mime || "video/webm";
        const blob = new Blob(chunks, { type });
        if (lastUrl) URL.revokeObjectURL(lastUrl);
        lastUrl = URL.createObjectURL(blob);
        const name = fileName(type);
        const a = $("lastRec");
        a.href = lastUrl; a.download = name; a.hidden = false;
        a.textContent = `Pobierz ostatnie nagranie (${(blob.size / 1048576).toFixed(1)} MB)`;
        a.click();
      };
      r.start(1000);
      rec = r; button = btn;
      const t0 = Date.now();
      render(true, 0);
      timer = setInterval(() => render(true, Math.floor((Date.now() - t0) / 1000)), 500);
    },
    stop() { if (rec && rec.state !== "inactive") rec.stop(); },
  };
})();

// ---------- Kanał sygnalizacji (prywatny: camera:<user_id>, RLS) ----------
let userId = null;

async function openChannel(onSignal, onStatus) {
  const { data: { session } } = await supabase.auth.getSession();
  await supabase.realtime.setAuth(session?.access_token ?? null);
  const ch = supabase.channel(`camera:${userId}`, { config: { private: true, broadcast: { self: false } } });
  ch.on("broadcast", { event: "signal" }, ({ payload }) => onSignal(payload));
  ch.subscribe(s => onStatus(s, ch));
  return ch;
}
const send = (ch, payload) => ch?.send({ type: "broadcast", event: "signal", payload });

// Wspólny mechanizm: kanał z automatycznym wznawianiem (rosnący odstęp).
function reconnectingChannel({ onSignal, onSubscribed, label }) {
  let channel = null, attempt = 0, timer = null, active = false;
  async function connect() {
    if (!active || !userId) return;
    clearTimeout(timer);
    const old = channel; channel = null;
    if (old) supabase.removeChannel(old);
    const ch = await openChannel(sig => Promise.resolve(onSignal(sig)).catch(e => setStatus(`Błąd połączenia: ${errText(e)}`)), (s, c) => {
      if (channel !== c) return;
      if (s === "SUBSCRIBED") { attempt = 0; onSubscribed(c); }
      else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
        const d = retryDelay(attempt++);
        setStatus(`${label}: utracono połączenie z serwerem. Ponawiam za ${Math.round(d / 1000)} s…`);
        clearTimeout(timer); timer = setTimeout(connect, d);
      }
    });
    if (!active) { supabase.removeChannel(ch); return; }
    channel = ch;
  }
  return {
    get channel() { return channel; },
    start() { active = true; attempt = 0; return connect(); },
    reconnect() { attempt = 0; return connect(); },
    stop() { active = false; clearTimeout(timer); const c = channel; channel = null; if (c) supabase.removeChannel(c); return c; },
  };
}

// ---------- NADAJNIK ----------
const sender = (() => {
  const peers = new Map();
  let stream = null, live = false, heartbeat = null, camTimer = null, camAttempt = 0, wakeLock = null;
  const chan = reconnectingChannel({
    label: "Nadajnik",
    onSignal,
    onSubscribed: ch => { setStatus(stream ? "Nadaję. Otwórz „Podgląd” na telefonie (to samo konto)." : "Połączono — czekam na kamerę…"); send(ch, { type: "broadcaster-ready" }); },
  });

  function renderViewers() { if (live) showLive(`NA ŻYWO · widzowie: ${peers.size}`); }
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
      $("sendRecBtn").disabled = !recorder.supported;
      return true;
    } catch (e) {
      setStatus(`Brak dostępu do kamery/mikrofonu: ${errText(e)}. Zezwól przeglądarce — ponawiam próbę…`);
      return false;
    }
  }

  function cameraLost() {
    recorder.stop(); closeAll();
    stream?.getTracks().forEach(t => t.stop()); stream = null;
    video.srcObject = null; showPlaceholder("Utracono obraz z kamery…");
    $("sendRecBtn").disabled = true;
    setStatus("Utracono obraz z kamery — próbuję ją ponownie uruchomić…");
    scheduleCameraRetry();
  }

  function scheduleCameraRetry() {
    clearTimeout(camTimer);
    camTimer = setTimeout(async () => {
      if (!live) return;
      if (await acquireCamera()) { setStatus("Kamera wznowiona. Nadaję."); send(chan.channel, { type: "broadcaster-ready" }); }
      else if (live) scheduleCameraRetry();
    }, retryDelay(camAttempt++));
  }

  async function start() {
    if (live || !userId) return;
    live = true;
    $("startBtn").hidden = true; $("stopBtn").hidden = false; $("withAudio").disabled = true;
    showLive("NA ŻYWO · widzowie: 0");
    setStatus("Uruchamiam kamerę i mikrofon…");
    if (!(await acquireCamera()) && live) scheduleCameraRetry();
    await chan.start();
    clearInterval(heartbeat);
    heartbeat = setInterval(() => { if (stream) send(chan.channel, { type: "heartbeat" }); }, HEARTBEAT_MS);
    requestWakeLock();
  }

  function stop() {
    if (!live) return;
    live = false;
    recorder.stop();
    clearInterval(heartbeat); clearTimeout(camTimer);
    send(chan.channel, { type: "broadcaster-stop" });
    chan.stop();
    closeAll();
    stream?.getTracks().forEach(t => t.stop()); stream = null;
    video.srcObject = null;
    wakeLock?.release().catch(() => {}); wakeLock = null;
    $("startBtn").hidden = false; $("stopBtn").hidden = true; $("withAudio").disabled = false; $("sendRecBtn").disabled = true;
    showLive(""); showPlaceholder("Kamera wyłączona"); setStatus("");
  }

  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && live) requestWakeLock(); });
  window.addEventListener("online", () => { if (live) chan.reconnect(); });
  window.addEventListener("beforeunload", () => { if (live) send(chan.channel, { type: "broadcaster-stop" }); });

  return { start, stop, get stream() { return stream; }, get live() { return live; } };
})();

// ---------- PODGLĄD ----------
const viewer = (() => {
  const viewerId = crypto.randomUUID();
  let pc = null, pending = [], lastSeen = 0, lastJoin = 0, brokenSince = 0, watchdog = null, active = false;
  const chan = reconnectingChannel({
    label: "Podgląd",
    onSignal,
    onSubscribed: () => { if (pc?.connectionState !== "connected") { setStatus("Czekam na obraz z komputera…"); join(); } },
  });

  function join() { lastJoin = Date.now(); send(chan.channel, { type: "viewer-join", viewerId }); }

  function reset() {
    recorder.stop();
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
      if ((!st || st === "failed" || st === "closed") && Date.now() - lastJoin > 10000) { setStatus("Komputer nadaje — łączę…"); join(); }
      return;
    }
    if (sig.type === "broadcaster-ready") { reset(); setStatus("Komputer nadaje — łączę…"); return join(); }
    if (sig.type === "broadcaster-stop") { reset(); lastSeen = 0; showPlaceholder("Kamera na komputerze jest wyłączona."); setStatus(""); return; }
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
          $("fullBtn").disabled = false; $("watchRecBtn").disabled = !recorder.supported;
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

  function start() {
    if (active) return;
    active = true;
    reset(); setStatus("Łączenie…");
    chan.start();
    // Strażnik 24/7: wznawia zerwane połączenie, wykrywa brak nadajnika.
    watchdog = setInterval(() => {
      const now = Date.now();
      if (pc?.connectionState === "connected") { brokenSince = 0; return; }
      if (!brokenSince) brokenSince = now;
      const offline = !lastSeen || now - lastSeen > OFFLINE_AFTER_MS;
      if (offline && chan.channel) { showPlaceholder("Komputer nie nadaje (offline).\nPołączę się sam, gdy wróci."); }
      else if (now - brokenSince > 10000 && now - lastJoin > 10000) { reset(); setStatus("Wznawiam połączenie…"); join(); }
    }, 5000);
  }

  function stop() {
    if (!active) return;
    active = false;
    clearInterval(watchdog);
    send(chan.channel, { type: "viewer-leave", viewerId });
    chan.stop(); reset(); showPlaceholder(""); setStatus("");
  }

  window.addEventListener("online", () => { if (active) chan.reconnect(); });
  window.addEventListener("beforeunload", () => { if (active) send(chan.channel, { type: "viewer-leave", viewerId }); });

  return { start, stop, rejoin() { reset(); setStatus("Łączę ponownie…"); join(); } };
})();

// ---------- Tryby i przyciski ----------
function setMode(mode) {
  prefs.mode = mode; savePrefs(prefs);
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.mode === mode));
  $("sendPanel").hidden = mode !== "send";
  $("watchPanel").hidden = mode !== "watch";
  if (mode === "send") {
    viewer.stop();
    showPlaceholder(sender.live ? "" : "Kamera wyłączona");
    if (sender.stream) { video.srcObject = sender.stream; video.muted = true; }
    $("hint").textContent = "Zostaw tę stronę otwartą na komputerze. W trybie 24/7 kamera włącza się sama, a połączenie i kamera są automatycznie wznawiane. Komputer nie może przechodzić w uśpienie.";
  } else {
    sender.stop();
    video.muted = true; $("soundBtn").textContent = "Włącz dźwięk";
    viewer.start();
    $("hint").textContent = "Widzisz obraz i słyszysz dźwięk z komputera. „Nagrywaj” zapisuje plik wideo na tym urządzeniu. Strona sama łączy się ponownie, gdy komputer lub internet wróci.";
  }
}

document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => setMode(t.dataset.mode)));
$("autostart").checked = prefs.autostart;
$("withAudio").checked = prefs.audio;
$("autostart").addEventListener("change", e => { prefs.autostart = e.target.checked; savePrefs(prefs); });
$("withAudio").addEventListener("change", e => { prefs.audio = e.target.checked; savePrefs(prefs); });
$("startBtn").addEventListener("click", () => sender.start());
$("stopBtn").addEventListener("click", () => sender.stop());
$("sendRecBtn").addEventListener("click", e => recorder.active ? recorder.stop() : recorder.start(sender.stream, e.currentTarget));
$("watchRecBtn").addEventListener("click", e => recorder.active ? recorder.stop() : recorder.start(video.srcObject, e.currentTarget));
$("reconnectBtn").addEventListener("click", () => viewer.rejoin());
$("fullBtn").addEventListener("click", () => (video.requestFullscreen?.() ?? video.webkitEnterFullscreen?.())?.catch?.(() => {}));
$("soundBtn").addEventListener("click", () => { video.muted = !video.muted; $("soundBtn").textContent = video.muted ? "Włącz dźwięk" : "Wycisz"; });

// ---------- Logowanie ----------
function authMsg(text) { $("authMsg").textContent = text || ""; $("authMsg").hidden = !text; }

$("authForm").addEventListener("submit", async e => {
  e.preventDefault();
  authMsg("Logowanie…");
  const { error } = await supabase.auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
  authMsg(error ? (error.message.includes("Email not confirmed") ? "Potwierdź najpierw adres e-mail (link w wiadomości od Supabase)." : `Błąd: ${error.message}`) : "");
});
$("signup").addEventListener("click", async () => {
  if (!$("authForm").reportValidity()) return;
  authMsg("Zakładam konto…");
  const { data, error } = await supabase.auth.signUp({
    email: $("email").value.trim(), password: $("password").value,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  if (error) return authMsg(`Błąd: ${error.message}`);
  authMsg(data.session ? "" : "Konto założone. Kliknij link w e-mailu od Supabase (jeśli potem zobaczysz stronę z błędem — to nic, konto jest już potwierdzone), a następnie zaloguj się tutaj.");
});
$("logout").addEventListener("click", async () => { sender.stop(); viewer.stop(); await supabase.auth.signOut(); });

let started = false;
function onSession(session) {
  const logged = !!session;
  $("auth").hidden = logged; $("app").hidden = !logged; $("logout").hidden = !logged;
  if (!logged) { userId = null; started = false; return; }
  userId = session.user.id;
  if (started) return;
  started = true;
  const hashMode = location.hash === "#podglad" ? "watch" : location.hash === "#nadajnik" ? "send" : null;
  setMode(hashMode || prefs.mode);
  if (prefs.mode === "send" && prefs.autostart) sender.start();
}

supabase.auth.onAuthStateChange((_event, session) => onSession(session));
supabase.auth.getSession().then(({ data: { session } }) => onSession(session));

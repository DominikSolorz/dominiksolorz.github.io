import { systemStore } from "./store.mjs";
export function createPeerDiagnostics({ store = systemStore, report = () => {}, turnConfigured = false } = {}) {
  const peers = new Map(), events = [];
  const snapshot = () => {
    const active = [...peers.values()].filter(peer => peer.connection !== "closed");
    return { failed: active.some(peer => peer.connection === "failed" || peer.ice === "failed"),
      last: active.length ? active.map(peer => `${peer.role}: ${peer.connection} / ICE ${peer.ice}`).join(" · ") : "Brak aktywnej sesji WebRTC.",
      recent: events.slice(-6) };
  };
  function note(role, text, level = "info") {
    events.push({ role, text, level, at: Date.now() });
    if (events.length > 40) events.shift();
    store.event({ component: "webrtc", role, message: text, level });
    report(snapshot());
  }
  function attach(pc, role) {
    const id = crypto.randomUUID(), key = `webrtc:${id}`;
    let busy = false, disposed = false, previousBytes = 0;
    const update = () => {
      const state = { role, connection: pc.connectionState, ice: pc.iceConnectionState };
      peers.set(id, state);
      store.component(key, { status: state.connection, ...state, turnConfigured });
      report(snapshot());
      if (state.connection === "closed") dispose();
    };
    const sample = async () => {
      if (busy || disposed || pc.connectionState !== "connected") return;
      busy = true;
      try {
        const stats = await pc.getStats();
        if (disposed || pc.connectionState === "closed") return;
        let pair, bytes = 0, frames = 0;
        stats.forEach(stat => {
          if (stat.type === "transport" && stat.selectedCandidatePairId) pair = stats.get(stat.selectedCandidatePairId);
          if (stat.type === "inbound-rtp" && !stat.isRemote) { bytes += stat.bytesReceived || 0; frames += stat.framesDecoded || 0; }
        });
        const local = pair && stats.get(pair.localCandidateId), remote = pair && stats.get(pair.remoteCandidateId);
        store.component(key, { status: pc.connectionState, role, ice: pc.iceConnectionState,
          route: pair ? `${local?.candidateType || "?"} → ${remote?.candidateType || "?"}` : null,
          bytesReceived: bytes, framesDecoded: frames, receiving: bytes > previousBytes,
          rttSeconds: pair?.currentRoundTripTime ?? null, turnConfigured });
        previousBytes = bytes;
      } catch { note(role, "Statystyki WebRTC chwilowo niedostępne.", "warning"); }
      finally { busy = false; }
    };
    const onState = () => { update(); void sample(); };
    const onError = event => note(role, `ICE ${event.errorCode || "?"}: nie udało się użyć jednego serwera; oceniamy końcowy stan połączenia.`, "warning");
    pc.addEventListener("connectionstatechange", onState);
    pc.addEventListener("iceconnectionstatechange", onState);
    pc.addEventListener("icecandidateerror", onError);
    const timer = setInterval(() => { if (pc.connectionState === "closed") dispose(); else void sample(); }, 3000);
    update();
    function dispose() {
      disposed = true; clearInterval(timer); peers.delete(id);
      pc.removeEventListener("connectionstatechange", onState);
      pc.removeEventListener("iceconnectionstatechange", onState);
      pc.removeEventListener("icecandidateerror", onError);
      store.removeComponent(key);
    }
    return dispose;
  }
  return { attach, snapshot };
}

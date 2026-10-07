// Wykrywanie ruchu (obraz) i dźwięku — kroków, głosów, trzasków (mikrofon) na komputerze-kamerze.
// Obraz: mała kopia ścieżki kamery (160×90, 5 kl./s) czytana przez ImageCapture, więc działa też,
// gdy okno jest zminimalizowane. Porównujemy kolejne klatki w skali szarości (64×36).
// Dźwięk: poziom głośności (RMS) z mikrofonu ponad tło szumu.

const SENS = {
  // Ruch musi zajmować zauważalną część obrazu i utrzymać się przez kilka
  // kolejnych próbek. To celowo odrzuca szum matrycy oraz drobne migotanie.
  low:    { pixels: 0.12, delta: 38, frames: 3, over: 3.0 },
  medium: { pixels: 0.065, delta: 34, frames: 2, over: 2.4 },
  high:   { pixels: 0.035, delta: 30, frames: 2, over: 2.8 },
};
const W = 64, H = 36, COOLDOWN_MS = 10000;

export function createDetector({ onEvent, onActivity, getSensitivity, getSoundEnabled }) {
  let track = null, capture = null, timer = null, prev = null, audioCtx = null, analyser = null, buf = null, noise = 0.004, settleFrames = 0, motionFrames = 0;
  const last = { ruch: 0, dzwiek: 0 };
  const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(W, H) : Object.assign(document.createElement("canvas"), { width: W, height: H });
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  function fire(kind) {
    onActivity?.(kind); // bez przerwy między zdarzeniami — np. przełącza nagrywanie na 30 kl./s
    const now = Date.now();
    if (now - last[kind] < COOLDOWN_MS) return;
    last[kind] = now;
    onEvent({ kind, at: now });
  }

  async function grab(fallbackVideo) {
    if (capture) {
      try { return await capture.grabFrame(); } catch { /* klatka niedostępna — spróbuj później */ }
    }
    return fallbackVideo?.readyState >= 2 ? fallbackVideo : null;
  }

  async function tick(fallbackVideo) {
    const s = SENS[getSensitivity()] || SENS.medium;
    const frame = await grab(fallbackVideo);
    if (frame) {
      ctx.drawImage(frame, 0, 0, W, H);
      frame.close?.();
      const d = ctx.getImageData(0, 0, W, H).data;
      const g = new Uint8Array(W * H);
      for (let i = 0; i < g.length; i++) g[i] = (d[i * 4] * 3 + d[i * 4 + 1] * 6 + d[i * 4 + 2]) / 10;
      if (prev) {
        // Autoekspozycja rozjaśnia lub przyciemnia prawie cały obraz naraz.
        // Odejmujemy taki wspólny skok jasności, żeby nie zgłaszać go jako ruch.
        let shift = 0;
        for (let i = 0; i < g.length; i++) shift += g[i] - prev[i];
        shift /= g.length;
        let changed = 0;
        for (let i = 0; i < g.length; i++) if (Math.abs((g[i] - prev[i]) - shift) > s.delta) changed++;
        const moving = settleFrames >= 3 && changed / g.length > s.pixels;
        motionFrames = moving ? motionFrames + 1 : 0;
        if (motionFrames >= s.frames) fire("ruch");
      }
      prev = g;
      settleFrames++;
    }
    if (analyser && getSoundEnabled?.()) {
      if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const rms = Math.sqrt(sum / buf.length);
      if (rms > Math.max(0.01, noise * s.over)) fire("dzwiek");
      noise = noise * 0.98 + Math.min(rms, noise * 3) * 0.02; // powoli uczy się tła (szum wentylatora itp.)
    }
  }

  async function start(stream, fallbackVideo) {
    stop();
    const v = stream.getVideoTracks()[0];
    if (v) {
      track = v.clone();
      try { await track.applyConstraints({ width: { ideal: 160 }, height: { ideal: 90 }, frameRate: { ideal: 5, max: 5 } }); } catch { /* zostaje pełna rozdzielczość */ }
      if ("ImageCapture" in window) capture = new ImageCapture(track);
    }
    const a = stream.getAudioTracks()[0];
    // Dźwięk nie jest ruchem. Domyślnie go nie analizujemy, aby szum USB,
    // wentylator albo trzaski nie tworzyły fałszywych zdarzeń.
    if (a && getSoundEnabled?.()) {
      try {
        audioCtx = new AudioContext();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        buf = new Float32Array(analyser.fftSize);
        audioCtx.createMediaStreamSource(new MediaStream([a])).connect(analyser);
      } catch { analyser = null; }
    }
    timer = setInterval(() => { tick(fallbackVideo).catch(() => {}); }, 500);
  }

  function stop() {
    clearInterval(timer); timer = null; prev = null; settleFrames = 0; motionFrames = 0;
    capture = null;
    track?.stop(); track = null;
    audioCtx?.close().catch(() => {}); audioCtx = null; analyser = null;
  }

  // Przeglądarka może wstrzymać dźwięk do pierwszego kliknięcia — wznawiamy przy każdym kliknięciu.
  document.addEventListener("pointerdown", () => { audioCtx?.resume().catch(() => {}); }, true);

  return { start, stop };
}

export const EVENT_LABEL = { ruch: "🏃 Ruch", dzwiek: "🔊 Dźwięk (kroki / głosy)" };

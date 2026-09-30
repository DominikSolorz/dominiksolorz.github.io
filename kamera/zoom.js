// Zbliżenie bez utraty jakości: kamera pracuje w maksymalnej rozdzielczości, a do oglądających
// wysyłany jest tylko wybrany fragment klatki — prawdziwe piksele z sensora, bez rozciągania.
// Wycinanie przez VideoFrame.visibleRect (bez kopiowania), w tle (MediaStreamTrackProcessor/Generator).
// Nagrania i wykrywanie ruchu dalej korzystają z pełnego kadru.

export const MAX_ZOOM = 4;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const even = v => Math.round(v / 2) * 2;

export function zoomSupported() {
  return typeof MediaStreamTrackProcessor !== "undefined" && typeof MediaStreamTrackGenerator !== "undefined" && typeof VideoFrame !== "undefined";
}

// Pilnuje, żeby kadr mieścił się w obrazie.
export function normalize(s) {
  const z = clamp(Number(s?.z) || 1, 1, MAX_ZOOM);
  const half = 0.5 / z;
  return { z, cx: clamp(Number(s?.cx) || 0.5, half, 1 - half), cy: clamp(Number(s?.cy) || 0.5, half, 1 - half) };
}

export function createZoomer(source, onFrameSize) {
  const video = source.getVideoTracks()[0];
  let state = { z: 1, cx: 0.5, cy: 0.5 };
  if (!video || !zoomSupported()) return { stream: source, set() {}, get state() { return state; }, lossless: 1, supported: false, stop() {} };

  const input = video.clone();
  const processor = new MediaStreamTrackProcessor({ track: input });
  const generator = new MediaStreamTrackGenerator({ kind: "video" });
  const stream = new MediaStream([generator, ...source.getAudioTracks()]);
  let stopped = false, lastW = 0;

  (async () => {
    const reader = processor.readable.getReader();
    const writer = generator.writable.getWriter();
    while (!stopped) {
      const { value: frame, done } = await reader.read();
      if (done || stopped) { frame?.close(); break; }
      const r = frame.visibleRect;
      const w = Math.min(r.width, even(r.width / state.z)), h = Math.min(r.height, even(r.height / state.z));
      const x = r.x + clamp(even(state.cx * r.width - w / 2), 0, r.width - w);
      const y = r.y + clamp(even(state.cy * r.height - h / 2), 0, r.height - h);
      let out;
      try { out = new VideoFrame(frame, { visibleRect: { x, y, width: w, height: h }, displayWidth: w, displayHeight: h, timestamp: frame.timestamp }); }
      catch { out = new VideoFrame(frame, { timestamp: frame.timestamp }); }
      frame.close();
      if (w !== lastW) { lastW = w; onFrameSize?.(w, h); }
      try { await writer.write(out); } catch { out.close(); break; }
    }
  })().catch(() => {});

  const settings = video.getSettings();
  // Do jakiego zbliżenia obraz ma co najmniej 720 linii prawdziwych pikseli.
  const lossless = Math.max(1, Math.round(((settings.height || 720) / 720) * 10) / 10);

  return {
    stream,
    supported: true,
    lossless,
    get state() { return state; },
    set(next) { state = normalize(next); return state; },
    stop() { stopped = true; input.stop(); generator.stop(); },
  };
}

// Nagrania z komputera-kamery na telefon przez kanał danych WebRTC — tym samym połączeniem co obraz na żywo,
// więc działa też na internecie komórkowym. Zapytania i odpowiedzi to JSON; plik idzie kawałkami binarnie
// zaraz po nagłówku {t:"res", file:{…}} (kanał jest uporządkowany, więc kawałki przychodzą po kolei).
const CHUNK = 64 * 1024;
const HIGH_WATER = 4 * 1024 * 1024;

// Strona komputera: obsługa zapytań jednego oglądającego. `api` = { list(day), days(), file(name), upload(name) }.
export function serve(dc, api) {
  dc.binaryType = "arraybuffer";
  dc.bufferedAmountLowThreshold = 1024 * 1024;
  const cancelled = new Set();
  let chain = Promise.resolve(); // pliki wysyłamy po kolei
  const send = o => { if (dc.readyState === "open") dc.send(JSON.stringify(o)); };
  const drained = () => new Promise(res => {
    if (dc.bufferedAmount < HIGH_WATER) return res();
    const on = () => { dc.removeEventListener("bufferedamountlow", on); res(); };
    dc.addEventListener("bufferedamountlow", on);
  });

  async function sendFile(id, name) {
    const f = await api.file(name);
    if (!f) return send({ t: "res", id, error: "nie ma takiego nagrania" });
    send({ t: "res", id, file: { name, size: f.blob.size, type: f.blob.type, meta: f.meta } });
    for (let pos = 0; pos < f.blob.size; pos += CHUNK) {
      if (dc.readyState !== "open") return;
      if (cancelled.delete(id)) return send({ t: "abort", id });
      await drained();
      dc.send(await f.blob.slice(pos, pos + CHUNK).arrayBuffer());
    }
  }

  dc.onmessage = async e => {
    if (typeof e.data !== "string") return;
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.t === "cancel") { cancelled.add(m.id); return; }
    if (m.t !== "req") return;
    try {
      if (m.op === "get") { chain = chain.then(() => sendFile(m.id, m.name)).catch(err => send({ t: "res", id: m.id, error: String(err?.message || err) })); return; }
      if (m.op === "list") return send({ t: "res", id: m.id, data: await api.list(m.day) });
      if (m.op === "days") return send({ t: "res", id: m.id, data: await api.days() });
      if (m.op === "upload") return send({ t: "res", id: m.id, data: await api.upload(m.name) });
      send({ t: "res", id: m.id, error: "nieznane polecenie" });
    } catch (err) { send({ t: "res", id: m.id, error: String(err?.message || err) }); }
  };
}

// Strona telefonu: zapytania do komputera. Jeden obiekt na cały czas działania strony; kanał podpinamy
// za każdym razem, gdy połączenie z kamerą powstaje na nowo.
export function createClient() {
  let dc = null, seq = 0, cur = null, onOpen = null; // cur = bieżący odbierany plik
  const pending = new Map();
  const waiters = new Set();

  function attach(channel) {
    dc = channel; dc.binaryType = "arraybuffer";
    dc.onopen = () => { waiters.forEach(w => w()); waiters.clear(); onOpen?.(); };
    dc.onclose = () => {
      for (const [, p] of pending) p.reject(new Error("rozłączono z kamerą"));
      pending.clear(); cur = null;
    };
    dc.onmessage = e => {
      if (typeof e.data !== "string") {
        if (!cur) return;
        cur.parts.push(e.data); cur.got += e.data.byteLength;
        cur.onProgress?.(cur.got, cur.size);
        if (cur.got >= cur.size) { const c = cur; cur = null; pending.delete(c.id); c.resolve({ blob: new Blob(c.parts, { type: c.type }), meta: c.meta }); }
        return;
      }
      let m; try { m = JSON.parse(e.data); } catch { return; }
      const p = pending.get(m.id);
      if (!p) return;
      if (m.t === "abort") { if (cur?.id === m.id) cur = null; pending.delete(m.id); return p.reject(new Error("przerwano")); }
      if (m.error) { pending.delete(m.id); return p.reject(new Error(m.error)); }
      if (m.file) {
        if (!m.file.size) { pending.delete(m.id); return p.resolve({ blob: new Blob([], { type: m.file.type }), meta: m.file.meta }); }
        cur = { id: m.id, size: m.file.size, type: m.file.type, meta: m.file.meta, parts: [], got: 0, resolve: p.resolve, onProgress: p.onProgress };
        return;
      }
      pending.delete(m.id); p.resolve(m.data);
    };
    if (dc.readyState === "open") dc.onopen();
  }

  const ready = (ms = 15000) => new Promise((res, rej) => {
    if (dc?.readyState === "open") return res();
    const w = () => { clearTimeout(t); res(); };
    const t = setTimeout(() => { waiters.delete(w); rej(new Error("brak połączenia z kamerą — poczekaj, aż pojawi się obraz na żywo")); }, ms);
    waiters.add(w);
  });

  async function request(op, extra = {}, onProgress) {
    await ready();
    const id = ++seq;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, onProgress });
      dc.send(JSON.stringify({ t: "req", id, op, ...extra }));
    });
  }

  return {
    attach,
    get connected() { return dc?.readyState === "open"; },
    set onopen(fn) { onOpen = fn; },
    days: () => request("days"),
    list: day => request("list", { day }),
    upload: name => request("upload", { name }),
    // Pobranie pliku z postępem; zwraca { blob, meta }.
    get: (name, onProgress) => request("get", { name }, onProgress),
  };
}

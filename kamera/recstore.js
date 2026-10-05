// Nagrania przechowywane na komputerze-kamerze w pamięci strony (IndexedDB), z pętlą zapisu:
// gdy wolnego miejsca zostaje mniej niż 1 GB, najstarsze nagrania są kasowane — nagrywanie nigdy nie staje.
// Dwa magazyny: „meta” (małe opisy, szybka lista) i „blobs” (same pliki wideo).
const DB = "kamera-nagrania";
const MIN_FREE = 1024 * 1024 * 1024; // 1 GB

let dbp = null;
function open() {
  dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "name" }).createIndex("start", "start");
      if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => { dbp = null; rej(r.error); };
  });
  return dbp;
}

const done = t => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error("przerwany zapis")); });
const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

// Prośba o trwałą pamięć: przeglądarka nie skasuje nagrań sama przy braku miejsca na dysku.
export async function persist() { try { return await navigator.storage?.persist?.(); } catch { return false; } }

export async function space() {
  try { const e = await navigator.storage.estimate(); return { usage: e.usage || 0, quota: e.quota || 0, free: Math.max(0, (e.quota || 0) - (e.usage || 0)) }; }
  catch { return { usage: 0, quota: 0, free: Infinity }; }
}

export async function list() {
  const db = await open();
  const all = await req(db.transaction("meta").objectStore("meta").getAll());
  return all.sort((a, b) => a.start - b.start);
}

export async function meta(name) { const db = await open(); return req(db.transaction("meta").objectStore("meta").get(name)); }
export async function blob(name) { const db = await open(); return req(db.transaction("blobs").objectStore("blobs").get(name)); }

export async function update(name, patch) {
  const db = await open();
  const t = db.transaction("meta", "readwrite"), s = t.objectStore("meta");
  const m = await req(s.get(name));
  if (m) s.put({ ...m, ...patch });
  return done(t);
}

export async function remove(name) {
  const db = await open();
  const t = db.transaction(["meta", "blobs"], "readwrite");
  t.objectStore("meta").delete(name); t.objectStore("blobs").delete(name);
  return done(t);
}

// Podmiana samego pliku (np. po dopisaniu długości nagrania) — bez kasowania innych nagrań.
export async function replaceBlob(name, data) {
  const db = await open();
  const t = db.transaction(["meta", "blobs"], "readwrite"), s = t.objectStore("meta");
  const m = await req(s.get(name));
  if (!m) return done(t);
  t.objectStore("blobs").put(data, name); s.put({ ...m, size: data.size });
  return done(t);
}

// Kasuje najstarsze nagrania, aż zostanie co najmniej 1 GB (+ miejsce na nowy plik). Zwraca liczbę skasowanych.
export async function makeRoom(need = 0) {
  let removed = 0;
  for (;;) {
    const { free } = await space();
    if (free >= MIN_FREE + need) return removed;
    const oldest = (await list())[0];
    if (!oldest) return removed;
    await remove(oldest.name); removed++;
  }
}

// Zapis nagrania. Przy braku miejsca kasuje najstarsze i próbuje ponownie (pętla zapisu).
export async function put(m, data) {
  let removed = await makeRoom(data.size);
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const db = await open();
      const t = db.transaction(["meta", "blobs"], "readwrite");
      t.objectStore("blobs").put(data, m.name);
      t.objectStore("meta").put({ ...m, size: data.size });
      await done(t);
      return removed;
    } catch (e) {
      if (e?.name !== "QuotaExceededError") throw e;
      const oldest = (await list()).find(x => x.name !== m.name);
      if (!oldest) throw e;
      await remove(oldest.name); removed++;
    }
  }
  throw new Error("brak miejsca na nagranie");
}

// Liczba i rozmiar nagrań — do stanu kamery.
export async function stats() {
  const all = await list();
  return { count: all.length, bytes: all.reduce((n, m) => n + (m.size || 0), 0), oldest: all[0]?.start || 0 };
}

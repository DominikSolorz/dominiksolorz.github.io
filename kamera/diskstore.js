// Trwałe archiwum na dysku komputera-kamery. Katalog wybiera właściciel raz;
// uchwyt jest zapamiętywany przez przeglądarkę i pliki nie zależą od limitu IndexedDB.
const DB = "kamera-archiwum-dysk-v1";
const STORE = "settings";

function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function get(key) { const db = await open(); return new Promise((resolve, reject) => { const r = db.transaction(STORE).objectStore(STORE).get(key); r.onsuccess = () => resolve(r.result || null); r.onerror = () => reject(r.error); }); }
async function put(key, value) { const db = await open(); return new Promise((resolve, reject) => { const r = db.transaction(STORE, "readwrite").objectStore(STORE).put(value, key); r.onsuccess = () => resolve(); r.onerror = () => reject(r.error); }); }

async function usable(handle, ask = false) {
  if (!handle) return false;
  const state = await handle.queryPermission({ mode: "readwrite" });
  return state === "granted" || (ask && await handle.requestPermission({ mode: "readwrite" }) === "granted");
}

export async function choose() {
  if (!window.showDirectoryPicker) throw new Error("Ta przeglądarka nie obsługuje zapisu do folderu. Użyj aktualnego Chrome lub Edge.");
  const handle = await window.showDirectoryPicker({ mode: "readwrite" });
  if (!(await usable(handle, true))) throw new Error("Brak zgody na zapis do wybranego folderu.");
  await put("folder", handle);
  return handle.name;
}
export async function status(ask = false) { const h = await get("folder"); return { selected: !!h, name: h && h.name ? h.name : "", ready: await usable(h, ask) }; }
// Nazwa pliku → uchwyt (także w podfolderach dni/godzin), uzupełniane przy każdym przeglądaniu folderu.
const handles = new Map();

export async function save(name, blob) {
  const h = await get("folder");
  if (!(await usable(h))) return false;
  const file = handles.get(name) || await h.getFileHandle(name, { create: true });
  const out = await file.createWritable();
  await out.write(blob); await out.close();
  return true;
}
export async function load(name) {
  const h = await get("folder");
  if (!(await usable(h))) return null;
  try { return await (handles.get(name) || await h.getFileHandle(name)).getFile(); } catch { return null; }
}

// Nagrania kamery: „kamera-RRRR-MM-DD_GG-MM-SS.mp4”, także z telefonu („kamera-telefon-…”) i kopie („… (1).mp4”).
const REC_RE = /^kamera-.*\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}.*\.(webm|mp4)$/i;

// Lista plików na dysku — razem z podfolderami (np. 2026-10-01/14-00 z Google Drive), do 3 poziomów.
// Pozwala stronie i telefonowi pokazać wszystkie nagrania z folderu, także po wyczyszczeniu pamięci przeglądarki.
export async function list() {
  const h = await get("folder");
  if (!(await usable(h))) return [];
  const out = [], seen = new Set();
  async function walk(dir, depth) {
    // Bez "for await": starsze telefony potrafią na nim zatrzymać ładowanie całego modułu.
    const iterator = dir.entries();
    while (true) {
      const next = await iterator.next();
      if (next.done) break;
      const name = next.value[0], entry = next.value[1];
      if (entry.kind === "directory") { if (depth < 3) await walk(entry, depth + 1); continue; }
      if (!REC_RE.test(name) || seen.has(name)) continue;
      try { const f = await entry.getFile(); if (!f.size) continue; seen.add(name); handles.set(name, entry); out.push(f); }
      catch { /* plik mógł zostać zmieniony poza stroną */ }
    }
  }
  await walk(h, 0);
  return out.sort((a, b) => b.name.localeCompare(a.name));
}

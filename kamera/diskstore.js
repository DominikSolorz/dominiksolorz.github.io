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
async function put(key, value) { const db = await open(); return new Promise((resolve, reject) => { const t = db.transaction(STORE, "readwrite"); t.objectStore(STORE).put(value, key); t.oncomplete = () => resolve(); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error || new Error("Nie zapisano wyboru folderu.")); }); }

async function usable(handle, ask = false) {
  if (!handle) return false;
  const state = await handle.queryPermission({ mode: "readwrite" });
  return state === "granted" || (ask && await handle.requestPermission({ mode: "readwrite" }) === "granted");
}

export function validFolderName(name) {
  return typeof name === "string" && name.length > 0 && name.length <= 100 &&
    name === name.trim() && !/[<>:"/\\|?*\x00-\x1f]/.test(name) &&
    !/[. ]$/.test(name) && !/^(\.|\.\.|CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i.test(name);
}

export async function choose({ newFolder = null } = {}) {
  if (newFolder !== null && !validFolderName(newFolder)) throw new Error("Podaj poprawną nazwę folderu, bez ścieżki i znaków specjalnych.");
  if (!window.showDirectoryPicker) throw new Error("Ta przeglądarka nie obsługuje zapisu do folderu. Użyj aktualnego Chrome lub Edge.");
  let handle = await window.showDirectoryPicker({ id: "home-security-archive", mode: "readwrite", startIn: "desktop" });
  if (!(await usable(handle, true))) throw new Error("Brak zgody na zapis do wybranego folderu.");
  if (newFolder !== null) handle = await handle.getDirectoryHandle(newFolder, { create: true });
  await put("folder", handle);
  handles.clear(); // Never reuse handles belonging to the previous archive location.
  return handle.name;
}
export async function status(ask = false) { const h = await get("folder"); return { selected: !!h, name: h && h.name ? h.name : "", ready: await usable(h, ask) }; }
// Nazwa pliku → uchwyt (także w podfolderach dni/godzin), uzupełniane przy każdym przeglądaniu folderu.
const handles = new Map();

export async function save(name, blob) {
  if (!REC_RE.test(name || "") || /[/\\]/.test(name)) throw new Error("Nieprawidłowa nazwa nagrania.");
  const h = await get("folder");
  if (!(await usable(h))) return false;
  const file = handles.get(name) || await h.getFileHandle(name, { create: true });
  const out = await file.createWritable();
  try {
    await out.write(blob); await out.close();
    if ((await file.getFile()).size !== blob.size) throw new Error("Rozmiar zapisanego nagrania jest nieprawidłowy.");
  } catch (error) {
    try { await out.abort(); } catch { /* stream may already be closed */ }
    throw error;
  }
  handles.set(name, file);
  return true;
}
export async function load(name) {
  const h = await get("folder");
  if (!(await usable(h))) return null;
  try { return await (handles.get(name) || await h.getFileHandle(name)).getFile(); } catch { return null; }
}

// Usuwa wyłącznie plik nagrania wskazany przez system kamery. Wywoływane dopiero
// po potwierdzonym zapisie tego samego pliku na Google Drive; nigdy nie czyści
// całego folderu ani cudzych dokumentów.
export async function remove(name) {
  if (!REC_RE.test(name || "")) throw new Error("odmowa usunięcia pliku spoza archiwum kamery");
  const h = await get("folder");
  if (!(await usable(h))) return false;
  try {
    const entry = handles.get(name);
    // Nagrania utworzone przez aktualny zapis są w katalogu głównym. Dla plików
    // odnalezionych w podfolderach nie zgadujemy ścieżki i niczego nie kasujemy.
    if (!entry) return false;
    await h.removeEntry(name);
    handles.delete(name);
    return true;
  } catch {
    // Po ręcznej zmianie lub pliku z podfolderu kopia zostaje lokalnie.
    return false;
  }
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

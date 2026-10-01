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
export async function status(ask = false) { const h = await get("folder"); return { selected: !!h, name: h?.name || "", ready: await usable(h, ask) }; }
export async function save(name, blob) {
  const h = await get("folder");
  if (!(await usable(h))) return false;
  const file = await h.getFileHandle(name, { create: true });
  const out = await file.createWritable();
  await out.write(blob); await out.close();
  return true;
}
export async function load(name) {
  const h = await get("folder");
  if (!(await usable(h))) return null;
  try { return await (await h.getFileHandle(name)).getFile(); } catch { return null; }
}

// Lista plików na dysku pozwala stronie i telefonowi odzyskać starsze nagrania nawet po
// wyczyszczeniu podręcznej pamięci przeglądarki.
export async function list() {
  const h = await get("folder");
  if (!(await usable(h))) return [];
  const out = [];
  for await (const [name, entry] of h.entries()) {
    if (entry.kind !== "file" || !/^kamera-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.(webm|mp4)$/i.test(name)) continue;
    try { out.push(await entry.getFile()); } catch { /* plik mógł zostać zmieniony poza stroną */ }
  }
  return out.sort((a, b) => b.name.localeCompare(a.name));
}

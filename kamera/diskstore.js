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

async function verifyWritable(handle) {
  const name = `.home-security-write-check-${crypto.randomUUID()}.tmp`;
  let created = false;
  try {
    try { await handle.getFileHandle(name); throw new Error("Kolizja pliku kontrolnego."); }
    catch (error) { if (error.name !== "NotFoundError") throw error; }
    const file = await handle.getFileHandle(name, { create: true }); created = true;
    const output = await file.createWritable();
    try { await output.write("HOME SECURITY write check"); await output.close(); }
    catch (error) { try { await output.abort(); } catch {} throw error; }
    if ((await file.getFile()).size !== 25) throw new Error("Nie udało się potwierdzić zapisu w folderze.");
  } finally {
    if (created) await handle.removeEntry(name, { recursive: false });
  }
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
  let managed = null;
  if (newFolder !== null) {
    const parent = handle;
    let existed = true;
    try { await parent.getDirectoryHandle(newFolder); }
    catch (error) { if (error.name !== "NotFoundError") throw error; existed = false; }
    handle = await parent.getDirectoryHandle(newFolder, { create: true });
    if (!existed) managed = { parent, name: newFolder, handle };
  }
  await verifyWritable(handle);
  await put("folder", handle);
  await put("browseRoot", handle);
  await put("managedFolder", managed);
  handles.clear(); // Never reuse handles belonging to the previous archive location.
  return handle.name;
}
export async function disconnect() {
  await put("folder", null); await put("managedFolder", null); await put("browseRoot", null); handles.clear();
}
async function remoteDirectory(path) {
  if (!Array.isArray(path) || path.length>12 || path.some(name=>!validFolderName(name))) throw new Error("Nieprawidłowa ścieżka folderu.");
  const root=await get("browseRoot") || await get("folder");
  if (!root || !(await usable(root))) throw new Error("Na komputerze najpierw wybierz folder nadrzędny i przywróć dostęp do niego. Telefon widzi tylko zatwierdzone miejsce.");
  let handle=root;
  for (const name of path) handle=await handle.getDirectoryHandle(name);
  const relative=await root.resolve(handle);
  if (!relative || relative.length!==path.length || relative.some((name,i)=>name!==path[i])) throw new Error("Folder poza zatwierdzonym miejscem.");
  return {root,handle};
}
export async function browseFolders(path=[], offset=0) {
  if (!Number.isInteger(offset) || offset<0 || offset>10000) throw new Error("Nieprawidłowa strona listy.");
  const {root,handle}=await remoteDirectory(path);
  const entries=[]; let index=0, more=false;
  const iterator=handle.entries();
  for (;;) {
    const next=await iterator.next(); if(next.done) break;
    const [name,entry]=next.value;
    if(entry.kind!=="directory" || !validFolderName(name)) continue;
    if(index++<offset) continue;
    if(entries.length===100) {more=true;break;}
    entries.push({name});
  }
  entries.sort((a,b)=>a.name.localeCompare(b.name));
  return {root:root.name,path:[...path],entries,offset,nextOffset:more?offset+100:null};
}
export async function selectRemoteFolder(path) {
  const {handle}=await remoteDirectory(path);
  await verifyWritable(handle);
  await put("folder",handle); await put("managedFolder",null); handles.clear();
  return {name:handle.name};
}
export async function createRemoteFolder(path,name) {
  if(!validFolderName(name)) throw new Error("Nieprawidłowa nazwa nowego folderu.");
  const {handle}=await remoteDirectory(path);
  await handle.getDirectoryHandle(name,{create:true});
  return {name};
}
export async function deleteRemoteEmptyFolder(path) {
  if (!Array.isArray(path) || !path.length) throw new Error("Nie można usunąć zatwierdzonego folderu nadrzędnego.");
  const {handle} = await remoteDirectory(path);
  const selected = await get("folder");
  if (selected && (await handle.isSameEntry(selected) || await handle.resolve(selected) !== null))
    throw new Error("Ten folder jest używany do zapisu nagrań. Najpierw wybierz inne miejsce.");
  if (!(await handle.entries().next()).done) throw new Error("Folder nie jest pusty. Żadne pliki nie zostały usunięte.");
  const {handle:parent} = await remoteDirectory(path.slice(0,-1));
  const current = await parent.getDirectoryHandle(path.at(-1));
  if (!(await current.isSameEntry(handle))) throw new Error("Folder zmienił się. Odśwież listę.");
  await parent.removeEntry(path.at(-1), {recursive:false});
  return {deleted:true};
}
export async function deleteEmptyCreatedFolder() {
  const managed = await get("managedFolder"), current = await get("folder");
  if (!managed || !current || !(await current.isSameEntry(managed.handle)))
    throw new Error("Można usunąć tylko folder utworzony przez program i aktualnie wybrany.");
  if (!(await usable(managed.parent))) throw new Error("Brak dostępu do folderu nadrzędnego.");
  const first = await current.entries().next();
  if (!first.done) throw new Error("Folder nie jest pusty. Nie usunięto żadnych plików.");
  await managed.parent.removeEntry(managed.name, { recursive: false });
  await disconnect();
}
export async function status(ask = false) { const h = await get("folder"); return { selected: !!h, name: h && h.name ? h.name : "", ready: await usable(h, ask) }; }
// Nazwa pliku → uchwyt (także w podfolderach dni/godzin), uzupełniane przy każdym przeglądaniu folderu.
const handles = new Map();

export async function save(name, blob) {
  if (!REC_RE.test(name || "") || /[/\\]/.test(name)) throw new Error("Nieprawidłowa nazwa nagrania.");
  if (!Number.isSafeInteger(blob?.size) || blob.size <= 0) throw new Error("Pustego nagrania nie można potwierdzić jako zapisanego.");
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

/**
 * Kamera na żywo — zapis nagrań prosto na Google Drive (bez programu „Dysk Google na komputer”).
 *
 * Instalacja (jednorazowo, na koncie właściciela Google Drive):
 *  1. https://script.google.com → „Nowy projekt”, wklej cały ten plik zamiast przykładowego kodu, zapisz.
 *  2. „Wdróż” → „Nowe wdrożenie” → typ „Aplikacja internetowa”:
 *       Wykonaj jako: Ja,  Kto ma dostęp: Każdy.
 *  3. Zatwierdź dostęp do Google Drive, skopiuj adres aplikacji (…/exec) i wpisz go w config.js (DRIVE_SCRIPT_URL).
 *
 * Bezpieczeństwo: pierwsze wywołanie zapamiętuje skrót tajnego tokenu komputera-kamery (token wyliczany z PIN-u,
 * PIN nigdy tu nie trafia). Potem skrypt odrzuca każde wywołanie bez tego tokenu.
 * Skrypt działa wyłącznie w folderze „nagrania” i tylko na plikach o nazwach kamery.
 */
const ROOT_ID = "15c9XPFi55XkQnCjfW_cvDHqhEXo_M5V2"; // folder „nagrania” na Google Drive
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/, HOUR_RE = /^\d{2}-00$/;
const FILE_RE = /^kamera-(\d{4}-\d{2}-\d{2})_(\d{2})-\d{2}-\d{2}\.(webm|mp4)$/;
const EVENTS = "zdarzenia.json";

function doGet() { return json({ ok: true, app: "kamera-drive", version: 1 }); }

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    checkToken(req.token);
    const root = DriveApp.getFolderById(ROOT_ID);
    switch (req.action) {
      case "ping": return json({ ok: true });
      case "upload": return json(upload(root, req));
      case "days": return json({ days: listDays(root) });
      case "day": return json({ hours: listDay(root, req.day) });
      case "remove": remove(root, req.target || {}); return json({ ok: true });
      case "cleanup": return json({ removed: cleanup(root, Number(req.days)) });
      default: throw new Error("nieznane polecenie");
    }
  } catch (err) {
    return json({ error: String(err && err.message || err) });
  }
}

function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function sha256(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(b => ((b + 256) % 256).toString(16).padStart(2, "0")).join("");
}

function checkToken(token) {
  if (typeof token !== "string" || token.length < 32) throw new Error("brak tokenu");
  const props = PropertiesService.getScriptProperties();
  const known = props.getProperty("TOKEN_SHA256");
  const got = sha256(token);
  if (!known) { props.setProperty("TOKEN_SHA256", got); return; } // pierwsze połączenie komputera-kamery
  if (known !== got) throw new Error("zły token");
}

function child(folder, name, create) {
  const it = folder.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return create ? folder.createFolder(name) : null;
}

function upload(root, req) {
  const m = FILE_RE.exec(req.name || "");
  if (!m) throw new Error("zła nazwa pliku");
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let hour;
  try { hour = child(child(root, m[1], true), `${m[2]}-00`, true); } finally { lock.releaseLock(); }
  const bytes = Utilities.base64Decode(req.data);
  // Ponowne wysłanie tego samego pliku (np. po zerwanym połączeniu) nie tworzy duplikatu.
  const same = hour.getFilesByName(req.name);
  while (same.hasNext()) {
    const f = same.next();
    if (f.getSize() === bytes.length) return { id: f.getId(), size: f.getSize(), duplicate: true };
  }
  const file = hour.createFile(Utilities.newBlob(bytes, req.mime || "video/webm", req.name));
  if (Array.isArray(req.events) && req.events.length) addEvents(hour, req.name, req.events);
  return { id: file.getId(), size: file.getSize() };
}

function readEvents(hour) {
  const it = hour.getFilesByName(EVENTS);
  if (!it.hasNext()) return { file: null, all: {} };
  const file = it.next();
  try { return { file, all: JSON.parse(file.getBlob().getDataAsString() || "{}") }; } catch (e) { return { file, all: {} }; }
}

function addEvents(hour, name, events) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const { file, all } = readEvents(hour);
    all[name] = (all[name] || []).concat(events.map(ev => ({ kind: String(ev.kind), at: Number(ev.at) })));
    if (file) file.setContent(JSON.stringify(all));
    else hour.createFile(EVENTS, JSON.stringify(all), "application/json");
  } finally { lock.releaseLock(); }
}

function listDays(root) {
  const days = [];
  const it = root.getFolders();
  while (it.hasNext()) {
    const d = it.next();
    if (!DAY_RE.test(d.getName())) continue;
    let count = 0;
    const hs = d.getFolders();
    while (hs.hasNext()) {
      const h = hs.next();
      if (!HOUR_RE.test(h.getName())) continue;
      const fs = h.getFiles();
      while (fs.hasNext()) if (FILE_RE.test(fs.next().getName())) count++;
    }
    days.push({ day: d.getName(), count });
  }
  // Ten sam dzień może mieć kilka folderów (np. z Dysku Google na komputer) — łączymy je.
  const merged = {};
  days.forEach(d => { merged[d.day] = (merged[d.day] || 0) + d.count; });
  return Object.keys(merged).sort().reverse().map(day => ({ day, count: merged[day] }));
}

function foldersByName(parent, name) {
  const out = [], it = parent.getFoldersByName(name);
  while (it.hasNext()) out.push(it.next());
  return out;
}

function listDay(root, day) {
  if (!DAY_RE.test(day || "")) throw new Error("zła data");
  const byHour = {};
  foldersByName(root, day).forEach(d => {
    const hs = d.getFolders();
    while (hs.hasNext()) {
      const h = hs.next();
      if (!HOUR_RE.test(h.getName())) continue;
      const evMap = readEvents(h).all;
      const files = byHour[h.getName()] = byHour[h.getName()] || [];
      const fs = h.getFiles();
      while (fs.hasNext()) {
        const f = fs.next(), name = f.getName();
        if (!FILE_RE.test(name)) continue;
        const ev = { ruch: 0, dzwiek: 0 };
        (evMap[name] || []).forEach(x => { if (x.kind in ev) ev[x.kind]++; });
        files.push({ name, size: f.getSize(), id: f.getId(), ev });
      }
    }
  });
  return Object.keys(byHour).sort().map(hour => ({ hour, files: byHour[hour].sort((a, b) => a.name.localeCompare(b.name)) }));
}

// Usuwa dzień, godzinę albo jeden plik (do kosza Google Drive — można przywrócić przez 30 dni).
function remove(root, t) {
  if (!DAY_RE.test(t.day || "")) throw new Error("zła data");
  const days = foldersByName(root, t.day);
  if (!t.hour) return days.forEach(d => d.setTrashed(true));
  if (!HOUR_RE.test(t.hour)) throw new Error("zła godzina");
  days.forEach(d => foldersByName(d, t.hour).forEach(h => {
    if (!t.name) return h.setTrashed(true);
    if (!FILE_RE.test(t.name)) throw new Error("zła nazwa pliku");
    const fs = h.getFilesByName(t.name);
    while (fs.hasNext()) fs.next().setTrashed(true);
  }));
}

// Przenosi do kosza foldery dni starsze niż `days` dni (0 = nic nie usuwa).
function cleanup(root, days) {
  if (!days || days < 1) return 0;
  const limit = Date.now() - days * 86400000;
  let removed = 0;
  const it = root.getFolders();
  while (it.hasNext()) {
    const d = it.next(), m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.getName());
    if (m && new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59).getTime() < limit) { d.setTrashed(true); removed++; }
  }
  return removed;
}

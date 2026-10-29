export function driveFolderId(value) {
  const text = String(value || '').trim();
  let id = text;
  if (/^https:\/\//i.test(text)) {
    const url = new URL(text);
    if (url.hostname !== 'drive.google.com' || url.username || url.password || (url.port&&url.port!=='443')) throw Error('Wklej adres folderu Google Drive.');
    id = /^\/drive\/(?:u\/\d+\/)?folders\/([\w-]+)\/?$/.exec(url.pathname)?.[1] || '';
  }
  if (!/^[\w-]{10,200}$/.test(id)) throw Error('Nieprawidłowy adres lub identyfikator folderu Google Drive.');
  return id;
}
export function storageDescription(state) {
  if (!state) return 'Łączę z komputerem nadającym. Miejsce zapisu nie zostało jeszcze potwierdzone.';
  const counts = state.counts || {};
  const place = { local: 'Komputer', cloud: 'Google Drive', both: 'Komputer i Google Drive' }[state.mode] || 'Nieznane';
  return `Miejsce zapisu nowych nagrań: ${place}. Drive: ${state.connected ? 'podłączony' : 'odłączony'}. ` +
    `Potwierdzone na Drive: ${counts.succeeded || 0}. Oczekujące: ${(counts.queued || 0) + (counts.retry_wait || 0) + (counts.running || 0)}. Wymagające sprawdzenia: ${(counts.blocked || 0) + (counts.failed || 0)}.` +
    (state.mode === 'cloud' ? ' Bufor tymczasowy jest usuwany dopiero po potwierdzeniu pliku przez serwer Google. Bez internetu nagrania czekają na komputerze.' : '');
}
export class RecordingStorageClient {
  constructor(webview = globalThis.__HOME_SECURITY_STORAGE_BRIDGE__ && globalThis.chrome?.webview) {
    this.webview = webview; this.pending = new Map(); this.state = null;
    this.listener = event => {
      const reply = event.data;
      if (reply?.type !== 'storage.result') return;
      const pending = this.pending.get(reply.id); if (!pending) return;
      clearTimeout(pending.timer); this.pending.delete(reply.id);
      if (reply.error) pending.reject(Error(`Operacja zapisu niepotwierdzona (${reply.error}).`));
      else pending.resolve(reply.result);
    };
    webview?.addEventListener('message', this.listener);
  }
  request(name, args = {}) {
    if (!this.webview) return Promise.reject(Error('Zaktualizuj program Windows, aby włączyć wybór miejsca zapisu.'));
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(Error('Komputer nie potwierdził operacji zapisu.')); }, name === 'authorize' ? 330000 : 90000);
      this.pending.set(id, { resolve, reject, timer });
      try { this.webview.postMessage({ type: 'storage.command', id, name, args }); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  async refresh() { this.state = await this.request('snapshot'); return this.state; }
  async save(blob, name, state) {
    const { transfer } = await this.request('begin', { name, size: blob.size, revision: state.revision });
    try {
    for (let offset = 0; offset < blob.size;) {
      const bytes = new Uint8Array(await blob.slice(offset, offset + 1048576).arrayBuffer());
      let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const reply = await this.request('chunk', { transfer, offset, data: btoa(binary) });
      if (reply.offset !== offset + bytes.length) throw Error('Nieprawidłowe potwierdzenie fragmentu.');
      offset = reply.offset;
    }
    const result = await this.request('complete', { transfer });
    if (!result?.queued || result.bytes !== blob.size || result.name !== name) throw Error('Brak potwierdzenia bufora wysyłania.');
    return result;
    } catch(error) { await this.request('abort',{transfer}).catch(()=>{});throw error; }
  }
  dispose() {
    this.webview?.removeEventListener('message', this.listener);
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(Error('Panel zamknięty.')); }
    this.pending.clear();
  }
}
export function mountRecordingStorage({ root, execute, authorize, canManage = () => true }) {
  const mode = root.querySelector('[data-storage-mode]'), folder = root.querySelector('[data-storage-folder]');
  const status = root.querySelector('[data-storage-status]'), link = root.querySelector('[data-storage-open]');
  let busy = false;
  async function refresh() {
    const state = await execute('storage-snapshot');
    if (!busy) mode.value = state.mode;
    if (document.activeElement !== folder) folder.value = state.folderId ? `https://drive.google.com/drive/folders/${state.folderId}` : '';
    link.hidden = !state.folderId; if (state.folderId) link.href = `https://drive.google.com/drive/folders/${driveFolderId(state.folderId)}`;
    status.textContent = storageDescription(state); return state;
  }
  const run = async operation => {
    if (busy || !canManage()) return;
    busy = true; root.querySelectorAll('button,select,input').forEach(el => el.disabled = true);
    status.textContent = 'Sprawdzam i zapisuję ustawienie na komputerze nadającym…';
    try { await operation(); busy = false; await refresh(); }
    catch (error) { status.textContent = error.message; }
    finally { busy = false; root.querySelectorAll('button,select,input').forEach(el => el.disabled = !canManage()); }
  };
  root.querySelector('[data-storage-apply]').onclick = () => run(() => execute('storage-set', { mode: mode.value }));
  root.querySelector('[data-storage-connect]').onclick = () => run(() => execute('storage-connect', { folderId: driveFolderId(folder.value) }));
  root.querySelector('[data-storage-disconnect]').onclick = () => run(() => execute('storage-disconnect'));
  root.querySelector('[data-storage-refresh]').onclick = () => run(() => Promise.resolve());
  const auth = root.querySelector('[data-storage-authorize]'); auth.hidden = !authorize;
  auth.onclick = () => run(() => authorize(driveFolderId(folder.value)));
  refresh().catch(error => { status.textContent = error.message; });
  const timer = setInterval(() => { if (!busy) refresh().catch(() => {}); }, 15000);
  return () => clearInterval(timer);
}

// HOME SECURITY — wspólne elementy pulpitu (komputer i telefon) według projektu
// „Monitoring domu / Mój dom”. Wyłącznie prawdziwe dane: zdarzenia z kamery,
// stan transmisji i zapisu, istniejące przyciski aplikacji. Bez atrap.
import {systemStore} from './core/store.mjs';
import {validThumbnail} from './workspace-panels.mjs?v=4';

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const svg = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
export const ICONS = Object.freeze({
  shield: svg('<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'),
  bell: svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>'),
  camera: svg('<path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><circle cx="12" cy="13" r="4"/>'),
  record: svg('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>'),
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  sound: svg('<path d="M4 9v6h4l5 4V5L8 9Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  full: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  more: svg('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'),
  motion: svg('<circle cx="13" cy="4" r="2"/><path d="m7 21 3-6 3 2v4M10 15l2-6 4 3 3-1M9 9l-3 3"/>'),
  sound2: svg('<path d="M3 12h3l3-7 4 14 3-7h5"/>'),
  play: svg('<path d="M8 5v14l11-7Z" fill="currentColor"/>'),
  chevron: svg('<path d="m9 6 6 6-6 6"/>'),
  home: svg('<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>'),
  list: svg('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>')
});

/** Komunikat w istniejącym dymku aplikacji (#toast). */
let toastTimer = 0;
export function hsToast(text) { const t = document.getElementById('toast'); if (!t) return; t.textContent = text; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 5000); }
const timeLabel = at => new Date(at).toLocaleTimeString('pl-PL', {hour: '2-digit', minute: '2-digit'});

/** Prawdziwy stan systemu do pigułki i karty „Status systemu”. */
export function systemStatus({live = false, store = systemStore} = {}) {
  const recording = store.read?.('recording', 45000) || {};
  const fresh = recording.freshness === 'fresh' || recording.freshness === undefined;
  if (live && fresh && recording.status === 'recording') return {tone: 'ok', pill: 'Monitoring aktywny', title: 'Monitoring aktywny', detail: 'Obraz na żywo i nagrywanie działają'};
  if (live) return {tone: 'live', pill: 'Na żywo', title: 'Podgląd na żywo', detail: recording.status === 'error' ? 'Błąd zapisu — sprawdź Diagnostykę' : 'Nagrywanie nie jest potwierdzone'};
  return {tone: 'off', pill: 'Brak transmisji', title: 'Brak transmisji', detail: 'Komputer z kamerą nie nadaje obrazu'};
}

/** Lista „Ostatnie zdarzenia” z miniaturami; kliknięcie otwiera nagranie z tej chwili. */
export function mountRecentEvents(container, {limit = 4, onAll = null, store = systemStore} = {}) {
  container.classList.add('hsRecentEvents');
  const head = el('header', 'hsCardHead');
  head.append(el('h2', null, 'Ostatnie zdarzenia'));
  if (onAll) { const all = el('button', 'hsLink', 'Zobacz wszystkie →'); all.type = 'button'; all.addEventListener('click', onAll); head.append(all); }
  const list = el('ol', 'hsEventList');
  container.replaceChildren(head, list);
  const render = snapshot => {
    const items = (snapshot.components.cameraEvents?.items || []).filter(e => Number.isFinite(e.at)).slice(0, limit);
    if (!items.length) { const empty = el('li', 'hsEventEmpty', 'Brak zdarzeń. Wykrycia ruchu i dźwięku pojawią się tutaj.'); list.replaceChildren(empty); return; }
    list.replaceChildren(...items.map(e => {
      const li = el('li', 'hsEventRow');
      const time = el('time', 'hsEventTime', timeLabel(e.at)); time.dateTime = new Date(e.at).toISOString();
      const icon = el('span', 'hsEventIcon'); icon.innerHTML = e.kind === 'ruch' ? ICONS.motion : ICONS.sound2;
      const text = el('span', 'hsEventText'); text.append(el('strong', null, e.kind === 'ruch' ? 'Wykryto ruch' : 'Wykryto dźwięk'), el('small', null, 'Kamera główna'));
      const thumb = el('button', 'hsEventThumb'); thumb.type = 'button';
      thumb.setAttribute('aria-label', `Odtwórz nagranie z ${timeLabel(e.at)}`);
      if (validThumbnail(e.thumbnail)) { const img = el('img'); img.src = e.thumbnail; img.alt = ''; thumb.append(img); }
      const play = el('span', 'hsPlay'); play.innerHTML = ICONS.play; thumb.append(play);
      thumb.addEventListener('click', () => document.dispatchEvent(new CustomEvent('hs-open-recordings-at', {detail: {at: Math.max(0, e.at - 3000)}})));
      li.append(time, icon, text, thumb);
      return li;
    }));
  };
  const unsubscribe = store.subscribe(render); render(store.snapshot());
  return unsubscribe;
}

/** Zdjęcie bieżącej klatki obrazu na żywo (zapis na tym urządzeniu). */
export function saveSnapshot(video, toast = hsToast) {
  if (!video || video.readyState < 2 || !video.videoWidth) { toast('Brak obrazu na żywo — zdjęcie nie zostało zrobione.'); return false; }
  const canvas = el('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  canvas.getContext('2d')?.drawImage(video, 0, 0);
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const name = `HOME-SECURITY-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.jpg`;
  canvas.toBlob(blob => {
    if (!blob) { toast('Nie udało się zapisać zdjęcia.'); return; }
    const a = el('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000); toast('Zapisano zdjęcie z kamery.');
  }, 'image/jpeg', 0.92);
  return true;
}

/** Etykieta jakości obrazu: FHD / HD / SD na podstawie rzeczywistej rozdzielczości. */
export const qualityLabel = video => !video?.videoHeight ? '' : video.videoHeight >= 1080 ? 'FHD' : video.videoHeight >= 720 ? 'HD' : 'SD';

/**
 * Przyciski na obrazie (jak w projekcie): górny pasek z „NA ŻYWO”, nazwą kamery,
 * jakością i pełnym ekranem; dolny z głośnikiem, zdjęciem, nagrywaniem i (telefon) mikrofonem.
 * Każdy przycisk wywołuje istniejącą funkcję aplikacji (te same handlery).
 */
export function mountLiveOverlay(stage, {video, phone = false, toast = hsToast, onMore = null} = {}) {
  if (!stage || stage.querySelector('.hsLiveTop')) return () => {};
  const $ = id => document.getElementById(id);
  const top = el('div', 'hsLiveTop');
  const name = el('span', 'hsChip hsCamName', 'Kamera główna');
  const quality = el('span', 'hsChip hsQuality'); quality.hidden = true;
  const full = el('button', 'hsIconBtn hsFull'); full.type = 'button'; full.innerHTML = ICONS.full; full.setAttribute('aria-label', 'Pełny ekran');
  full.addEventListener('click', e => { e.stopPropagation(); $('fullBtn')?.click(); });
  const right = el('span', 'hsLiveTopRight'); right.append(quality, full);
  top.append(name, right);
  const bar = el('div', 'hsLiveBar');
  const btn = (cls, icon, label, handler) => { const b = el('button', `hsIconBtn ${cls}`); b.type = 'button'; b.innerHTML = icon; b.setAttribute('aria-label', label); b.title = label; b.addEventListener('click', e => { e.stopPropagation(); handler(b); }); return b; };
  const sound = btn('hsSound', ICONS.sound, 'Odsłuch z kamery', () => $('soundBtn')?.click());
  const snap = btn('hsSnap', ICONS.camera, 'Zrób zdjęcie', () => saveSnapshot(video, toast));
  const rec = btn('hsRec', ICONS.record, 'Nagrywanie', () => { const start = $('ctrlStart'), stop = $('ctrlStop'); const recording = systemStore.read?.('recording', 45000)?.status === 'recording'; (recording ? stop : start)?.click(); });
  const actions = el('span', 'hsLiveActions'); actions.append(snap, rec);
  if (phone && $('talkbackBtn')) actions.append(btn('hsTalk', ICONS.mic, 'Rozmowa z komputerem', () => $('talkbackBtn')?.click()));
  else if (onMore) actions.append(btn('hsMore', ICONS.more, 'Więcej ustawień', onMore));
  bar.append(sound, actions);
  for (const node of [top, bar]) { node.addEventListener('dblclick', e => e.stopPropagation()); node.addEventListener('pointerup', e => e.stopPropagation()); }
  stage.append(top, bar);
  const sync = () => {
    const q = qualityLabel(video); quality.textContent = q; quality.hidden = !q;
    sound.classList.toggle('on', $('soundBtn')?.getAttribute('aria-pressed') === 'true');
    rec.classList.toggle('on', systemStore.read?.('recording', 45000)?.status === 'recording');
    const talk = $('talkbackBtn'); actions.querySelector('.hsTalk')?.classList.toggle('on', talk?.getAttribute('aria-pressed') === 'true');
    stage.classList.toggle('hsHasLive', !$('placeholder') || $('placeholder').hidden);
  };
  video?.addEventListener('resize', sync); video?.addEventListener('loadedmetadata', sync);
  const watch = new MutationObserver(sync);
  for (const id of ['soundBtn', 'talkbackBtn', 'placeholder']) if ($(id)) watch.observe($(id), {attributes: true, attributeFilter: ['aria-pressed', 'hidden']});
  const unsub = systemStore.subscribe(sync); const timer = setInterval(sync, 5000); sync();
  return () => { watch.disconnect(); unsub(); clearInterval(timer); };
}

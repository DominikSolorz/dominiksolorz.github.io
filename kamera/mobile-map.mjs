// Mapa telefonu: pozycja na żywo, wyszukiwarka adresów i firm, firmy w widocznym
// obszarze oraz przejście do nawigacji. Lokalizacja jest pobierana tylko po
// potwierdzeniu przy każdym otwarciu mapy, działa wyłącznie dopóki mapa jest
// otwarta. Domyślnie nie jest nigdzie zapisywana. Tylko gdy użytkownik sam włączy
// „Zapisuj moją trasę”, punkty trafiają do jego prywatnej historii na koncie
// (patrz location-history.mjs), widocznej wyłącznie dla niego.
// Dane: OpenStreetMap (kafelki, Nominatim, Overpass). Zdjęcia i opinie otwiera
// użytkownik sam w Mapach Google.

import { groupRoutes } from './location-history.mjs?v=1';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
// Główny serwer Overpass bywa przeciążony; jeden zapasowy serwer tej samej usługi.
const OVERPASS_FALLBACK_URL = 'https://overpass.kumi.systems/api/interpreter';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
// Logo sieci (np. Biedronka, Żabka): identyfikator marki z OpenStreetMap → plik logo w Wikimedia Commons.
// Do tych usług trafia tylko identyfikator marki, nigdy pozycja użytkownika.
const WIKIDATA_URL = 'https://www.wikidata.org/w/api.php';
const COMMONS_FILE_URL = 'https://commons.wikimedia.org/wiki/Special:FilePath/';
const logoCache = new Map(); // tylko w pamięci, do zamknięcia strony
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const MIN_POI_ZOOM = 15;
const LEAFLET_JS = new URL('./vendor/leaflet/leaflet.js', import.meta.url).href;
const LEAFLET_CSS = new URL('./vendor/leaflet/leaflet.css', import.meta.url).href;
const LEAFLET_IMAGES = new URL('./vendor/leaflet/images/', import.meta.url).href;

const ROUTE_COLORS = ['#1de9e0', '#ffb020', '#c084fc', '#f87171'];
let store = null;
export function setLocationStore(next) { store = next || null; }

const AMENITY = {
  pharmacy: 'Apteka', restaurant: 'Restauracja', cafe: 'Kawiarnia', fast_food: 'Bar szybkiej obsługi', bar: 'Bar', pub: 'Pub',
  bank: 'Bank', atm: 'Bankomat', fuel: 'Stacja paliw', hospital: 'Szpital', clinic: 'Przychodnia', doctors: 'Lekarz', dentist: 'Dentysta',
  school: 'Szkoła', kindergarten: 'Przedszkole', university: 'Uczelnia', post_office: 'Poczta', police: 'Policja', fire_station: 'Straż pożarna',
  townhall: 'Urząd', bus_stop: 'Przystanek', tram_stop: 'Przystanek tramwajowy', station: 'Stacja', viewpoint: 'Punkt widokowy', attraction: 'Atrakcja', museum: 'Muzeum', hotel: 'Hotel', supermarket: 'Supermarket', convenience: 'Sklep', mall: 'Centrum handlowe', house: 'Budynek', building: 'Budynek', public: 'Budynek publiczny', residential: 'Ulica', primary: 'Ulica', secondary: 'Ulica', tertiary: 'Ulica', city: 'Miasto', town: 'Miasto', village: 'Wieś', suburb: 'Dzielnica', postcode: 'Kod pocztowy', administrative: 'Obszar', library: 'Biblioteka', cinema: 'Kino', theatre: 'Teatr', parking: 'Parking', place_of_worship: 'Miejsce kultu', veterinary: 'Weterynarz'
};

export function describeLocationError(error) {
  switch (error?.code) {
    case 1: return 'Brak zgody przeglądarki na lokalizację. Zezwól na nią w ustawieniach witryny i spróbuj ponownie.';
    case 2: return 'Nie udało się ustalić lokalizacji. Sprawdź GPS lub połączenie i spróbuj ponownie.';
    case 3: return 'Ustalanie lokalizacji trwało zbyt długo. Spróbuj ponownie.';
    default: return 'Lokalizacja jest niedostępna na tym urządzeniu.';
  }
}

export function validCoordinates(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

export function distanceMeters(lat1, lon1, lat2, lon2) {
  const rad = d => d * Math.PI / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(a));
}

export const brandId = value => (typeof value === 'string' && /^Q\d{1,12}$/.test(value.trim()) ? value.trim() : '');

export function logoUrl(file, width = 96) {
  return typeof file === 'string' && file ? `${COMMONS_FILE_URL}${encodeURIComponent(file.replace(/ /g, '_'))}?width=${width}` : '';
}

export function parseLogos(data) {
  const out = {};
  for (const [id, entity] of Object.entries(data?.entities || {})) {
    const file = entity?.claims?.P154?.[0]?.mainsnak?.datavalue?.value;
    if (brandId(id) && typeof file === 'string' && /\.(svg|png|jpe?g|webp|gif)$/i.test(file)) out[id] = file;
  }
  return out;
}

// Pieszo ok. 4,8 km/h.
export const walkingMinutes = meters => Math.max(1, Math.round(meters / 80));

export function formatDistance(meters) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export function buildPlacesQuery({ south, west, north, east }) {
  const box = [south, west, north, east].map(v => v.toFixed(6)).join(',');
  const keys = ['shop', 'amenity', 'office', 'tourism', 'craft', 'healthcare'];
  return `[out:json][timeout:15];(${keys.map(k => `nwr[${k}][name](${box});`).join('')});out center 80;`;
}

// Sieci sklepów i firmy po nazwie lub marce w pobliżu (np. „Biedronka”, „Żabka”).
export function buildNameQuery(text, { lat, lng }, radius = 5000) {
  const term = String(text || '').replace(/[^\p{L}\p{N} '&-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (term.length < 2 || !validCoordinates(lat, lng)) return '';
  const around = `(around:${Math.round(radius)},${lat.toFixed(6)},${lng.toFixed(6)})`;
  return `[out:json][timeout:15];(nwr["name"~"${term}",i]${around};nwr["brand"~"${term}",i]${around};);out center 60;`;
}

// Łączy wyniki obu źródeł bez duplikatów (ta sama nazwa w promieniu 60 m).
export function mergePlaces(...lists) {
  const out = [];
  for (const place of lists.flat()) {
    const twin = out.find(p => p.name.toLowerCase() === place.name.toLowerCase() && distanceMeters(p.lat, p.lon, place.lat, place.lon) < 60);
    if (!twin) { out.push({ ...place }); continue; }
    twin.brand ||= place.brand;
    if (!twin.address && place.address) twin.address = place.address;
  }
  // Ta sama sieć pod tą samą nazwą: logo także dla punktów bez oznaczonej marki.
  const brands = new Map(out.filter(p => p.brand).map(p => [p.name.toLowerCase(), p.brand]));
  for (const p of out) p.brand ||= brands.get(p.name.toLowerCase()) || '';
  return out;
}

function kindLabel(tags) {
  if (tags.amenity) return AMENITY[tags.amenity] || 'Instytucja / usługa';
  if (tags.shop) return 'Sklep';
  if (tags.office) return 'Biuro / firma';
  if (tags.tourism) return 'Turystyka';
  if (tags.healthcare) return 'Zdrowie';
  if (tags.craft) return 'Rzemiosło / usługi';
  return 'Miejsce';
}

function joinAddress(street, number, postcode, city) {
  const line1 = [street, number].filter(Boolean).join(' ');
  const line2 = [postcode, city].filter(Boolean).join(' ');
  return [line1, line2].filter(Boolean).join(', ');
}

export function parsePlaces(data, from, limit = 40) {
  const out = [];
  for (const el of Array.isArray(data?.elements) ? data.elements : []) {
    const tags = el.tags || {};
    const name = typeof tags.name === 'string' ? tags.name.trim().slice(0, 80) : '';
    const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
    if (!name || !validCoordinates(lat, lon)) continue;
    out.push({
      name, lat, lon, kind: kindLabel(tags), brand: brandId(tags['brand:wikidata']),
      address: joinAddress(tags['addr:street'], tags['addr:housenumber'], tags['addr:postcode'], tags['addr:city']),
      distance: from ? Math.round(distanceMeters(from.lat, from.lon, lat, lon)) : null
    });
  }
  return out.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0)).slice(0, limit);
}

// Wyszukiwanie preferuje okolicę (~40 km od środka mapy), nie tylko widoczny wycinek ulicy.
export function searchViewbox(center, km = 40) {
  const dLat = km / 111, dLon = km / (111 * Math.max(0.2, Math.cos(center.lat * Math.PI / 180)));
  return [center.lng - dLon, center.lat + dLat, center.lng + dLon, center.lat - dLat].map(v => v.toFixed(5)).join(',');
}

// Najbliższe wyniki najpierw; odrzuca odległe zbieżności nazw (np. w innym kraju),
// gdy blisko jest trafienie. Bez znanej pozycji zostawia kolejność serwera.
export function nearestResults(places, limit = 8) {
  if (!places.length || places.some(p => p.distance === null)) return places.slice(0, limit);
  const sorted = [...places].sort((a, b) => a.distance - b.distance);
  const reach = Math.max(30000, sorted[0].distance * 3);
  return sorted.filter(p => p.distance <= reach).slice(0, limit);
}

export function parseGeocode(data, from, limit = 8) {
  const out = [];
  for (const item of Array.isArray(data) ? data : []) {
    const lat = Number(item.lat), lon = Number(item.lon);
    if (!validCoordinates(lat, lon)) continue;
    const a = item.address || {};
    const city = a.city || a.town || a.village || a.municipality || '';
    const address = joinAddress(a.road || a.pedestrian || '', a.house_number, a.postcode, city);
    const name = String(item.name || item.display_name || '').split(',')[0].trim().slice(0, 80) || address || 'Miejsce';
    out.push({
      name, lat, lon, brand: brandId(item.extratags?.['brand:wikidata']), kind: AMENITY[item.type] || String(item.type || '').replace(/_/g, ' ') || 'Miejsce',
      address: address || String(item.display_name || '').slice(0, 120),
      distance: from ? Math.round(distanceMeters(from.lat, from.lon, lat, lon)) : null
    });
  }
  return out.slice(0, limit);
}

export function placeSearchUrl(place) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.lat.toFixed(6)},${place.lon.toFixed(6)}`)}`;
}

export function directionsUrl(place) {
  return `https://www.google.com/maps/dir/?api=1&destination=${place.lat.toFixed(6)},${place.lon.toFixed(6)}&travelmode=walking`;
}

let leafletPromise = null;
function loadLeaflet(doc) {
  if (globalThis.L) return Promise.resolve(globalThis.L);
  leafletPromise ||= new Promise((resolve, reject) => {
    const css = doc.createElement('link');
    css.rel = 'stylesheet';
    css.href = LEAFLET_CSS;
    doc.head.append(css);
    const script = doc.createElement('script');
    script.src = LEAFLET_JS;
    script.onload = () => resolve(globalThis.L);
    script.onerror = () => { leafletPromise = null; reject(new Error('leaflet')); };
    doc.head.append(script);
  });
  return leafletPromise;
}

export function mountLocationMap({ geolocation = globalThis.navigator?.geolocation, doc = document } = {}) {
  const section = doc.createElement('section');
  section.className = 'mobileMapCard';
  section.setAttribute('aria-label', 'Mapa');
  section.innerHTML = `<button type="button" class="mobileMapOpen"><b aria-hidden="true">⌖</b><span><strong>Mapa</strong><small>Twoja pozycja, firmy i adresy</small></span><i aria-hidden="true">›</i></button>`;

  const dialog = doc.createElement('dialog');
  dialog.className = 'mobileMapDialog';
  dialog.setAttribute('aria-labelledby', 'mobileMapTitle');
  dialog.innerHTML = `
    <h2 id="mobileMapTitle">Mapa</h2>
    <p class="mobileMapText" role="status"></p>
    <div class="mobileMapTools" hidden>
      <form class="mobileMapSearch" role="search">
        <input type="search" name="q" placeholder="Szukaj firmy, adresu, ulicy…" aria-label="Szukaj na mapie" autocomplete="off" maxlength="120">
        <button type="submit">Szukaj</button>
      </form>
      <div class="mobileMapRow">
        <button type="button" class="mobileMapPlaces">⌕ Firmy w tym obszarze</button>
        <button type="button" class="mobileMapFollow" aria-pressed="true">◎ Śledzę Twoją pozycję</button>
        <button type="button" class="mobileMapRecord" aria-pressed="false" hidden>Zapis trasy: wył.</button>
        <button type="button" class="mobileMapHistory" hidden>Historia tras (24 h)</button>
      </div>
    </div>
    <label class="mobileMapRecordOpt" hidden><input type="checkbox" name="record"><span>Zapisuj moją trasę na moim koncie HOME SECURITY (tylko dla mnie, przez 30 dni, z możliwością usunięcia). Bez zaznaczenia nic nie jest zapisywane.</span></label>
    <div class="mobileMapCanvas" hidden></div>
    <p class="mobileMapAttribution" hidden>© współtwórcy OpenStreetMap</p>
    <section class="mobileMapResults" aria-label="Wyniki" aria-live="polite" hidden></section>
    <div class="mobileMapActions">
      <button type="button" class="mobileMapConfirm">Pobierz lokalizację</button>
      <button type="button" class="mobileMapCancel">Anuluj</button>
    </div>`;
  section.append(dialog);

  const $ = selector => dialog.querySelector(selector);
  const text = $('.mobileMapText'), tools = $('.mobileMapTools'), canvas = $('.mobileMapCanvas'), attribution = $('.mobileMapAttribution');
  const results = $('.mobileMapResults'), confirm = $('.mobileMapConfirm'), cancel = $('.mobileMapCancel');
  const recordBtn = $('.mobileMapRecord'), historyBtn = $('.mobileMapHistory'), recordOpt = $('.mobileMapRecordOpt');
  const followBtn = $('.mobileMapFollow'), placesBtn = $('.mobileMapPlaces'), searchForm = $('.mobileMapSearch');
  let session = 0, query = 0, resizeWatch = null, watchId = null, map = null, me = null, accuracy = null, markers = null, here = null, follow = true, recording = false, routes = null;

  const syncFollow = () => {
    followBtn.textContent = follow ? '◎ Śledzę Twoją pozycję' : '◎ Wróć do mojej pozycji';
    followBtn.setAttribute('aria-pressed', String(follow));
  };

  const syncRecord = () => {
    recordBtn.textContent = recording ? 'Zapis trasy: wł.' : 'Zapis trasy: wył.';
    recordBtn.setAttribute('aria-pressed', String(recording));
  };

  const teardown = () => {
    session += 1;
    recording = false;
    if (watchId !== null) geolocation?.clearWatch(watchId);
    watchId = null;
    resizeWatch?.disconnect();
    resizeWatch = null;
    map?.remove();
    map = me = accuracy = markers = routes = here = null;
    canvas.replaceChildren();
    results.replaceChildren();
  };

  const note = message => {
    const p = doc.createElement('p');
    p.className = 'mobileMapNote';
    p.textContent = message;
    results.replaceChildren(p);
    results.hidden = false;
  };

  const paintLogos = () => {
    for (const thumb of results.querySelectorAll('.mobileMapThumb[data-brand]:not(.hasLogo)')) {
      const file = logoCache.get(thumb.dataset.brand);
      if (!file) continue;
      const img = doc.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.src = logoUrl(file);
      img.addEventListener('error', () => { img.remove(); thumb.classList.remove('hasLogo'); });
      thumb.replaceChildren(img);
      thumb.classList.add('hasLogo');
    }
  };

  const loadLogos = async (current, places) => {
    const ids = [...new Set(places.map(p => p.brand).filter(id => id && !logoCache.has(id)))].slice(0, 25);
    if (ids.length) {
      try {
        const data = await request(current, `${WIKIDATA_URL}?${new URLSearchParams({ action: 'wbgetentities', ids: ids.join('|'), props: 'claims', format: 'json', origin: '*' })}`, { referrerPolicy: 'no-referrer' });
        const found = parseLogos(data);
        for (const id of ids) logoCache.set(id, found[id] || '');
      } catch { return; }
    }
    if (current === session) paintLogos();
  };

  const showAsk = () => {
    teardown();
    canvas.hidden = tools.hidden = attribution.hidden = results.hidden = true;
    confirm.hidden = !geolocation;
    confirm.disabled = false;
    confirm.textContent = 'Pobierz lokalizację';
    cancel.textContent = 'Anuluj';
    follow = true;
    syncFollow();
    recordOpt.hidden = !(geolocation && store);
    recordOpt.querySelector('input').checked = false;
    recordBtn.hidden = historyBtn.hidden = true;
    text.textContent = geolocation
      ? 'Czy pobrać Twoją aktualną lokalizację i śledzić ją na mapie, dopóki jest otwarta? Zgoda dotyczy tylko tego otwarcia. Domyślnie lokalizacja nie jest zapisywana ani wysyłana na serwer HOME SECURITY. Do mapy, wyszukiwania i listy firm współrzędne trafią do OpenStreetMap, Nominatim i Overpass.'
      : 'Lokalizacja jest niedostępna w tej przeglądarce.';
  };

  const renderPlaces = (L, places, emptyMessage) => {
    markers.clearLayers();
    if (!places.length) return note(emptyMessage);
    const list = doc.createElement('ul');
    for (const place of places) {
      L.marker([place.lat, place.lon], { title: place.name }).bindPopup(() => {
        const box = doc.createElement('div');
        const strong = doc.createElement('strong');
        strong.textContent = place.name;
        const addr = doc.createElement('div');
        addr.textContent = place.address || place.kind;
        box.append(strong, addr);
        return box;
      }).addTo(markers);
      const li = doc.createElement('li');
      const info = doc.createElement('button');
      info.type = 'button';
      info.className = 'mobileMapPlace';
      const thumb = doc.createElement('span');
      thumb.className = 'mobileMapThumb';
      thumb.setAttribute('aria-hidden', 'true');
      thumb.textContent = (place.name.match(/[\p{L}\p{N}]/u)?.[0] || '•').toUpperCase();
      if (place.brand) thumb.dataset.brand = place.brand;
      const text = doc.createElement('span');
      text.className = 'mobileMapPlaceText';
      const name = doc.createElement('strong');
      name.textContent = place.name;
      const meta = doc.createElement('small');
      meta.textContent = [place.kind, place.address].filter(Boolean).join(' · ');
      text.append(name, meta);
      if (place.distance !== null) {
        const far = doc.createElement('small');
        far.className = 'mobileMapDistance';
        far.textContent = place.distance <= 3000
          ? `${formatDistance(place.distance)} · ok. ${walkingMinutes(place.distance)} min pieszo`
          : formatDistance(place.distance);
        text.append(far);
      }
      info.append(thumb, text);
      info.addEventListener('click', () => {
        follow = false;
        syncFollow();
        map.setView([place.lat, place.lon], Math.max(map.getZoom(), 17));
        canvas.scrollIntoView?.({ block: 'nearest' });
      });
      const links = doc.createElement('span');
      links.className = 'mobileMapLinks';
      for (const [label, href] of [['➜ Prowadź', directionsUrl(place)], ['Zdjęcia i opinie ↗', placeSearchUrl(place)]]) {
        const a = doc.createElement('a');
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = label;
        links.append(a);
      }
      li.append(info, links);
      list.append(li);
    }
    results.replaceChildren(list);
    results.hidden = false;
    void loadLogos(session, places);
    follow = false;
    syncFollow();
    const layers = markers.getLayers();
    if (layers.length > 1) map.fitBounds(markers.getBounds().pad(0.15), { maxZoom: 18 });
    else map.setView(layers[0].getLatLng(), 17);
  };

  const request = async (current, url, options) => {
    const response = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(20000), ...options });
    if (!response.ok) throw new Error('http');
    const data = await response.json();
    if (current !== session) throw new Error('stale');
    return data;
  };

  const startMap = (L, position, current) => {
    const { latitude, longitude, accuracy: acc } = position.coords;
    if (!validCoordinates(latitude, longitude)) { text.textContent = describeLocationError(); confirm.hidden = true; return; }
    here = { lat: latitude, lon: longitude };
    L.Icon.Default.imagePath = LEAFLET_IMAGES;
    canvas.hidden = tools.hidden = attribution.hidden = false;
    map = L.map(canvas, { attributionControl: false }).setView([latitude, longitude], 17);
    // Lista wyników zmienia wysokość mapy — Leaflet musi przeliczyć rozmiar.
    if (typeof ResizeObserver === 'function') { resizeWatch = new ResizeObserver(() => map?.invalidateSize()); resizeWatch.observe(canvas); }
    L.tileLayer(TILE_URL, { maxZoom: 19, referrerPolicy: 'origin' }).addTo(map);
    markers = L.featureGroup().addTo(map);
    accuracy = L.circle([latitude, longitude], { radius: Math.min(acc || 30, 500), color: '#1de9e0', weight: 1, fillOpacity: 0.1 }).addTo(map);
    me = L.circleMarker([latitude, longitude], { radius: 8, color: '#fff', weight: 2, fillColor: '#1de9e0', fillOpacity: 1 }).addTo(map);
    map.on('dragstart', () => { follow = false; syncFollow(); });
    setTimeout(() => map?.invalidateSize(), 50);
    confirm.hidden = true;
    cancel.textContent = 'Zamknij';
    recordOpt.hidden = true;
    recordBtn.hidden = historyBtn.hidden = !store;
    routes = L.featureGroup().addTo(map);

    const unavailableNote = () => {
      recording = false;
      syncRecord();
      note('Historia tras jest niedostępna: baza nie ma jeszcze wgranej tabeli. Administrator musi zastosować migrację.');
    };
    const startRecording = async () => {
      const result = await store.start();
      if (current !== session) return;
      if (result.unavailable) return unavailableNote();
      if (result.error) { recording = false; syncRecord(); note('Nie udało się włączyć zapisu trasy. Spróbuj ponownie.'); return; }
      saveHere(latitude, longitude, acc);
    };
    const saveHere = (la, lo, ac) => {
      if (!recording || !store) return;
      store.save({ lat: la, lon: lo, accuracy: ac }).then(result => {
        if (current === session && result?.unavailable) unavailableNote();
      });
    };
    syncRecord();
    text.textContent = recording
      ? 'Twoja pozycja jest śledzona na żywo, a trasa zapisuje się na Twoim koncie (tylko dla Ciebie, 30 dni). Wyłączysz to przyciskiem „Zapis trasy”.'
      : 'Twoja pozycja jest śledzona na żywo, dopóki mapa jest otwarta. Nic nie jest zachowane po jej zamknięciu.';
    if (recording && store) startRecording();

    watchId = geolocation.watchPosition(next => {
      if (current !== session || !map) return;
      const { latitude: la, longitude: lo, accuracy: ac } = next.coords;
      if (!validCoordinates(la, lo)) return;
      here = { lat: la, lon: lo };
      me.setLatLng([la, lo]);
      accuracy.setLatLng([la, lo]).setRadius(Math.min(ac || 30, 500));
      saveHere(la, lo, ac);
      if (follow) map.setView([la, lo], map.getZoom(), { animate: true });
    }, error => {
      if (current === session) text.textContent = describeLocationError(error);
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 });

    followBtn.onclick = () => {
      follow = !follow;
      syncFollow();
      if (follow && here) map.setView([here.lat, here.lon], Math.max(map.getZoom(), 16));
    };

    recordBtn.onclick = () => {
      recording = !recording;
      syncRecord();
      if (recording) startRecording();
      else text.textContent = 'Zapis trasy wyłączony. Zapisane wcześniej punkty zostają w historii do czasu usunięcia lub upływu 30 dni.';
    };

    historyBtn.onclick = async () => {
      note('Pobieram historię tras…');
      const result = await store.recent(24);
      if (current !== session || !map) return;
      if (result.unavailable) return unavailableNote();
      if (result.error) return note('Nie udało się pobrać historii tras.');
      routes.clearLayers();
      const groups = groupRoutes(result.points, store.device.id);
      if (!groups.length) return note('Brak zapisanych tras z ostatnich 24 godzin. Włącz „Zapis trasy” na telefonie lub komputerze.');
      const list = doc.createElement('ul');
      groups.forEach((group, index) => {
        const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
        const latlngs = group.points.map(p => [p.lat, p.lon]);
        L.polyline(latlngs, { color, weight: 4, opacity: 0.85 }).addTo(routes);
        L.circleMarker(latlngs.at(-1), { radius: 6, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }).addTo(routes);
        const li = doc.createElement('li');
        const info = doc.createElement('button');
        info.type = 'button';
        info.className = 'mobileMapPlace';
        const name = doc.createElement('strong');
        name.textContent = `${group.label}${group.own ? ' (to urządzenie)' : ''}`;
        const meta = doc.createElement('small');
        meta.textContent = `${group.points.length} pkt · ostatnio ${new Date(group.points.at(-1).at).toLocaleString('pl-PL')}`;
        info.append(name, meta);
        info.addEventListener('click', () => { follow = false; syncFollow(); map.setView(latlngs.at(-1), Math.max(map.getZoom(), 16)); });
        li.append(info);
        list.append(li);
      });
      const wipe = doc.createElement('button');
      wipe.type = 'button';
      wipe.className = 'mobileMapWipe';
      wipe.textContent = 'Usuń całą historię tras';
      wipe.addEventListener('click', async () => {
        wipe.disabled = true;
        const done = await store.clear();
        if (current !== session || !map) return;
        routes.clearLayers();
        note(done.ok ? 'Historia tras została usunięta z Twojego konta.' : 'Nie udało się usunąć historii. Spróbuj ponownie.');
      });
      results.replaceChildren(list, wipe);
      results.hidden = false;
      map.fitBounds(routes.getBounds().pad(0.2), { maxZoom: 17 });
      follow = false;
      syncFollow();
    };

    placesBtn.onclick = async () => {
      if (map.getZoom() < MIN_POI_ZOOM) return note('Przybliż mapę, aby zobaczyć firmy i instytucje w tym obszarze.');
      const b = map.getBounds();
      const mine = ++query;
      note('Szukam firm i instytucji…');
      try {
        const body = new URLSearchParams({ data: buildPlacesQuery({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() }) });
        const options = { method: 'POST', body, referrerPolicy: 'no-referrer' };
        const data = await request(current, OVERPASS_URL, options).catch(error => {
          if (error.message === 'stale') throw error;
          return request(current, OVERPASS_FALLBACK_URL, options);
        });
        if (mine !== query) return;
        renderPlaces(L, parsePlaces(data, here), 'W tym obszarze nie ma firm ani instytucji w danych OpenStreetMap.');
      } catch (error) {
        if (error.message !== 'stale' && mine === query) note('Nie udało się pobrać listy firm (serwer OpenStreetMap nie odpowiada). Spróbuj za chwilę — mapa działa bez niej.');
      }
    };

    searchForm.onsubmit = async event => {
      event.preventDefault();
      const q = new FormData(searchForm).get('q')?.toString().trim();
      if (!q) return;
      const mine = ++query;
      note('Szukam…');
      const base = { format: 'jsonv2', addressdetails: '1', extratags: '1', limit: '15', 'accept-language': 'pl', q, viewbox: searchViewbox(map.getCenter()) };
      try {
        // Najpierw tylko okolica (np. „Biedronka” → sklepy w pobliżu), dopiero potem cała mapa.
        const nameQuery = buildNameQuery(q, map.getCenter());
        const nearby = nameQuery
          ? request(current, OVERPASS_URL, { method: 'POST', body: new URLSearchParams({ data: nameQuery }), referrerPolicy: 'no-referrer' }).then(d => parsePlaces(d, here, 40), () => [])
          : Promise.resolve([]);
        const empty = 'Nic nie znaleziono. Spróbuj podać ulicę, miasto lub nazwę firmy.';
        let data = await request(current, `${NOMINATIM_URL}?${new URLSearchParams({ ...base, bounded: '1' })}`, { referrerPolicy: 'origin' });
        if (mine !== query) return;
        let found = parseGeocode(data, here, 15);
        // Wyniki pokazujemy od razu; sklepy z okolicy (Overpass) dochodzą, gdy serwer odpowie.
        if (found.length) renderPlaces(L, nearestResults(found, 12), empty);
        const near = await nearby;
        if (mine !== query) return;
        if (!found.length && !near.length) {
          found = parseGeocode(await request(current, `${NOMINATIM_URL}?${new URLSearchParams(base)}`, { referrerPolicy: 'origin' }), here, 15);
          if (mine !== query) return;
        }
        if (near.length || !results.querySelector('li')) renderPlaces(L, nearestResults(mergePlaces(found, near), 12), empty);
      } catch (error) {
        if (error.message !== 'stale' && mine === query) note('Wyszukiwanie jest chwilowo niedostępne. Spróbuj ponownie.');
      }
    };
  };

  confirm.addEventListener('click', () => {
    const current = ++session;
    recording = !!store && recordOpt.querySelector('input').checked;
    confirm.disabled = true;
    text.textContent = 'Pobieram lokalizację…';
    Promise.all([
      loadLeaflet(doc),
      new Promise((resolve, reject) => geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }))
    ]).then(([L, position]) => {
      if (current === session) startMap(L, position, current);
    }).catch(error => {
      if (current !== session) return;
      text.textContent = error?.message === 'leaflet' ? 'Nie udało się wczytać mapy. Sprawdź połączenie i spróbuj ponownie.' : describeLocationError(error);
      confirm.disabled = false;
      confirm.textContent = 'Spróbuj ponownie';
    });
  });
  cancel.addEventListener('click', () => { teardown(); if (dialog.open) dialog.close(); });
  dialog.addEventListener('close', teardown);
  section.querySelector('.mobileMapOpen').addEventListener('click', () => {
    showAsk();
    dialog.showModal();
  });
  return section;
}

// Mapa lokalizacji telefonu. Lokalizacja jest pobierana jednorazowo, tylko po
// potwierdzeniu użytkownika przy każdym otwarciu mapy. Nie jest zapisywana,
// nie trafia do serwera HOME SECURITY, konta, PIN-u ani logów. Pobliskie sklepy
// pochodzą z otwartych danych OpenStreetMap (Overpass); zdjęcia i opinie
// otwiera użytkownik sam w Mapach Google.

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const SHOP_RADIUS_M = 800;

export function buildShopsQuery(lat, lon, radius = SHOP_RADIUS_M) {
  const around = `around:${Math.round(radius)},${lat.toFixed(6)},${lon.toFixed(6)}`;
  return `[out:json][timeout:12];(node(${around})[shop][name];way(${around})[shop][name];);out center 40;`;
}

export function distanceMeters(lat1, lon1, lat2, lon2) {
  const rad = d => d * Math.PI / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(a));
}

export function parseShops(data, lat, lon, limit = 8) {
  const out = [];
  for (const el of Array.isArray(data?.elements) ? data.elements : []) {
    const name = typeof el.tags?.name === 'string' ? el.tags.name.trim().slice(0, 80) : '';
    const sLat = el.lat ?? el.center?.lat, sLon = el.lon ?? el.center?.lon;
    if (!name || !Number.isFinite(sLat) || !Number.isFinite(sLon)) continue;
    out.push({ name, lat: sLat, lon: sLon, distance: Math.round(distanceMeters(lat, lon, sLat, sLon)) });
  }
  return out.sort((a, b) => a.distance - b.distance).slice(0, limit);
}

export function placeSearchUrl(shop) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shop.name} ${shop.lat.toFixed(6)},${shop.lon.toFixed(6)}`)}`;
}

export function formatDistance(meters) {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export function buildMapUrl(lat, lon, span = 0.006) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const f = value => value.toFixed(6);
  const bbox = [lon - span, lat - span, lon + span, lat + span].map(f).join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${f(lat)}%2C${f(lon)}`;
}

export function describeLocationError(error) {
  switch (error?.code) {
    case 1: return 'Brak zgody przeglądarki na lokalizację. Zezwól na nią w ustawieniach witryny i spróbuj ponownie.';
    case 2: return 'Nie udało się ustalić lokalizacji. Sprawdź GPS lub połączenie i spróbuj ponownie.';
    case 3: return 'Ustalanie lokalizacji trwało zbyt długo. Spróbuj ponownie.';
    default: return 'Lokalizacja jest niedostępna na tym urządzeniu.';
  }
}

export function mountLocationMap({ geolocation = globalThis.navigator?.geolocation, doc = document } = {}) {
  const section = doc.createElement('section');
  section.className = 'mobileMapCard';
  section.setAttribute('aria-label', 'Mapa');
  section.innerHTML = `<button type="button" class="mobileMapOpen"><b aria-hidden="true">⌖</b><span><strong>Mapa</strong><small>Pokaż swoją lokalizację</small></span><i aria-hidden="true">›</i></button>`;

  const dialog = doc.createElement('dialog');
  dialog.className = 'mobileMapDialog';
  dialog.setAttribute('aria-labelledby', 'mobileMapTitle');
  dialog.innerHTML = `
    <h2 id="mobileMapTitle">Mapa</h2>
    <p class="mobileMapText" role="status"></p>
    <div class="mobileMapFrame" hidden></div>
    <section class="mobileMapShops" aria-label="Sklepy w pobliżu" hidden></section>
    <div class="mobileMapActions">
      <button type="button" class="mobileMapConfirm">Pobierz lokalizację</button>
      <button type="button" class="mobileMapCancel">Anuluj</button>
    </div>`;
  section.append(dialog);

  const text = dialog.querySelector('.mobileMapText');
  const frameBox = dialog.querySelector('.mobileMapFrame');
  const shopsBox = dialog.querySelector('.mobileMapShops');
  const confirm = dialog.querySelector('.mobileMapConfirm');
  const cancel = dialog.querySelector('.mobileMapCancel');
  let request = 0;

  const showAsk = () => {
    request += 1;
    frameBox.replaceChildren();
    frameBox.hidden = true;
    shopsBox.replaceChildren();
    shopsBox.hidden = true;
    confirm.hidden = false;
    confirm.disabled = false;
    confirm.textContent = 'Pobierz lokalizację';
    cancel.textContent = 'Anuluj';
    text.textContent = geolocation
      ? 'Czy pobrać Twoją aktualną lokalizację, aby pokazać ją na mapie? Zgoda dotyczy tylko tego otwarcia. Lokalizacja nie jest zapisywana ani wysyłana na serwer HOME SECURITY. Do wyświetlenia mapy i listy sklepów w pobliżu współrzędne trafią do OpenStreetMap i serwisu Overpass.'
      : 'Lokalizacja jest niedostępna w tej przeglądarce.';
    if (!geolocation) confirm.hidden = true;
  };

  const close = () => {
    request += 1;
    frameBox.replaceChildren();
    shopsBox.replaceChildren();
    if (dialog.open) dialog.close();
  };

  async function loadShops(lat, lon, current) {
    const note = msg => { const p = doc.createElement('p'); p.className = 'mobileMapShopNote'; p.textContent = msg; shopsBox.replaceChildren(p); shopsBox.hidden = false; };
    note('Szukam sklepów w pobliżu…');
    try {
      const response = await fetch(OVERPASS_URL, { method: 'POST', body: new URLSearchParams({ data: buildShopsQuery(lat, lon) }), referrerPolicy: 'no-referrer', credentials: 'omit', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('overpass');
      const shops = parseShops(await response.json(), lat, lon);
      if (current !== request) return;
      if (!shops.length) return note('Nie znaleziono sklepów w promieniu 800 m w danych OpenStreetMap.');
      const heading = doc.createElement('h3');
      heading.textContent = 'Sklepy w pobliżu (od najbliższego)';
      const list = doc.createElement('ul');
      for (const shop of shops) {
        const li = doc.createElement('li');
        const label = doc.createElement('span');
        label.textContent = `${shop.name} · ${formatDistance(shop.distance)}`;
        const link = doc.createElement('a');
        link.href = placeSearchUrl(shop);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Zdjęcia i opinie';
        li.append(label, link);
        list.append(li);
      }
      const hint = doc.createElement('p');
      hint.className = 'mobileMapShopNote';
      hint.textContent = 'Kolejność wg odległości. Zdjęcia i oceny otworzą się w Mapach Google.';
      shopsBox.replaceChildren(heading, list, hint);
    } catch {
      if (current === request) note('Nie udało się pobrać listy sklepów. Mapa działa bez niej.');
    }
  }

  confirm.addEventListener('click', () => {
    const current = ++request;
    confirm.disabled = true;
    text.textContent = 'Pobieram lokalizację…';
    geolocation.getCurrentPosition(position => {
      if (current !== request) return;
      const url = buildMapUrl(position.coords.latitude, position.coords.longitude);
      if (!url) { text.textContent = describeLocationError(); confirm.hidden = true; return; }
      const frame = doc.createElement('iframe');
      frame.title = 'Mapa z Twoją lokalizacją';
      frame.src = url;
      frame.loading = 'lazy';
      frame.referrerPolicy = 'no-referrer';
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      frameBox.replaceChildren(frame);
      frameBox.hidden = false;
      confirm.hidden = true;
      text.textContent = 'Twoja lokalizacja z tego otwarcia. Po zamknięciu mapy nic nie jest zachowane.';
      cancel.textContent = 'Zamknij';
      loadShops(position.coords.latitude, position.coords.longitude, current);
    }, error => {
      if (current !== request) return;
      text.textContent = describeLocationError(error);
      confirm.disabled = false;
      confirm.textContent = 'Spróbuj ponownie';
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 });
  });
  cancel.addEventListener('click', close);
  dialog.addEventListener('close', () => { request += 1; frameBox.replaceChildren(); });
  section.querySelector('.mobileMapOpen').addEventListener('click', () => {
    showAsk();
    dialog.showModal();
  });
  return section;
}

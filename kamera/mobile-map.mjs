// Mapa lokalizacji telefonu. Lokalizacja jest pobierana jednorazowo, tylko po
// potwierdzeniu użytkownika przy każdym otwarciu mapy. Nie jest zapisywana,
// nie trafia do serwera HOME SECURITY, konta, PIN-u ani logów.

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
    <div class="mobileMapActions">
      <button type="button" class="mobileMapConfirm">Pobierz lokalizację</button>
      <button type="button" class="mobileMapCancel">Anuluj</button>
    </div>`;
  section.append(dialog);

  const text = dialog.querySelector('.mobileMapText');
  const frameBox = dialog.querySelector('.mobileMapFrame');
  const confirm = dialog.querySelector('.mobileMapConfirm');
  const cancel = dialog.querySelector('.mobileMapCancel');
  let request = 0;

  const showAsk = () => {
    request += 1;
    frameBox.replaceChildren();
    frameBox.hidden = true;
    confirm.hidden = false;
    confirm.disabled = false;
    confirm.textContent = 'Pobierz lokalizację';
    cancel.textContent = 'Anuluj';
    text.textContent = geolocation
      ? 'Czy pobrać Twoją aktualną lokalizację, aby pokazać ją na mapie? Zgoda dotyczy tylko tego otwarcia. Lokalizacja nie jest zapisywana ani wysyłana na serwer HOME SECURITY. Do wyświetlenia mapy współrzędne trafią do OpenStreetMap.'
      : 'Lokalizacja jest niedostępna w tej przeglądarce.';
    if (!geolocation) confirm.hidden = true;
  };

  const close = () => {
    request += 1;
    frameBox.replaceChildren();
    if (dialog.open) dialog.close();
  };

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

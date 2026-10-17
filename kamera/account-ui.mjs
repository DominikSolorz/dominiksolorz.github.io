export function profileRows(user, profile = {}) {
  const p = profile || {};
  return [
    ['Imię', p.first_name], ['Nazwisko', p.last_name], ['E-mail', user?.email],
    ['Telefon', p.phone], ['Adres', p.address_line], ['Kod pocztowy', p.postal_code],
    ['Potwierdzenie e-maila', user?.email_confirmed_at ? 'Potwierdzony' : 'Niepotwierdzony'],
    ['Konto utworzone', user?.created_at ? new Date(user.created_at).toLocaleDateString('pl-PL') : null],
  ].map(([label, value]) => [label, value ? String(value) : 'Nie podano']);
}

// Reads only the current account; no tokens, PINs or passwords reach the DOM.
export function validateProfile(values) {
  const text = key => String(values[key] || '').trim();
  const data = Object.fromEntries(['first_name','last_name','phone','address_line','postal_code'].map(key => [key, text(key)]));
  if (!data.first_name || !data.last_name) throw new Error('Podaj imię i nazwisko.');
  if (!data.address_line || !/^\d{2}-\d{3}$/.test(data.postal_code)) throw new Error('Podaj adres i kod pocztowy w formacie 00-000.');
  if (data.first_name.length > 80 || data.last_name.length > 80 || data.address_line.length > 240 || data.phone.length > 32) throw new Error('Podane dane są zbyt długie.');
  return { ...data, phone: data.phone || null };
}

export function mountAccountUI({ loadProfile, saveProfile, logout, onError }) {
  const actions = document.createElement('div');
  actions.className = 'accountActions';
  const profileButton = document.createElement('button');
  profileButton.type = 'button'; profileButton.textContent = 'Mój profil';
  const logoutButton = document.getElementById('lockBtn');
  logoutButton.textContent = 'Wyloguj'; logoutButton.title = 'Wyloguj się z konta na tym urządzeniu';
  logoutButton.setAttribute('aria-label', 'Wyloguj się');
  actions.append(profileButton, logoutButton);
  (document.querySelector('.mobileAppHeader') || document.querySelector('.topbar .nav')).append(actions);
  const dialog = document.createElement('dialog');
  dialog.className = 'accountDialog accountWorkspace'; dialog.setAttribute('aria-labelledby', 'accountProfileTitle');
  const title = document.createElement('h2'); title.id = 'accountProfileTitle'; title.textContent = 'Mój profil';
  const intro = document.createElement('p'); intro.textContent = 'Twoje dane zapisane na koncie HOME SECURITY.';
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  const details = document.createElement('dl'); details.className = 'profileDetails';
  const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Wróć do panelu';
  close.className = 'profileBack';
  const hero = document.createElement('header'); hero.className = 'profileHero';
  const logo = document.createElement('img'); logo.src = 'assets/ds-logo.jpg'; logo.alt = 'Logo DS';
  const heading = document.createElement('div'); heading.append(title, intro); hero.append(logo, heading, close);
  const content = document.createElement('section'); content.className = 'profileContent';
  const card = document.createElement('section'); card.className = 'profileCard';
  const subtitle = document.createElement('h3'); subtitle.textContent = 'Dane osobowe i kontaktowe';
  const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Edytuj dane'; edit.disabled = true;
  const form = document.createElement('form'); form.className = 'profileEditForm'; form.hidden = true;
  const inputs = {};
  for (const [name,label,autocomplete] of [['first_name','Imię','given-name'],['last_name','Nazwisko','family-name'],['phone','Telefon (opcjonalnie)','tel'],['address_line','Adres','street-address'],['postal_code','Kod pocztowy','postal-code']]) {
    const field = document.createElement('label'); field.textContent = label;
    const input = document.createElement('input'); input.name = name; input.autocomplete = autocomplete;
    input.required = name !== 'phone'; input.maxLength = name === 'address_line' ? 240 : name === 'phone' ? 32 : 80;
    if (name === 'phone') input.type = 'tel';
    if (name === 'postal_code') { input.pattern = '[0-9]{2}-[0-9]{3}'; input.maxLength = 6; input.placeholder = '00-000'; }
    inputs[name] = input; field.append(input); form.append(field);
  }
  const save = document.createElement('button'); save.type = 'submit'; save.textContent = 'Zapisz zmiany'; save.className = 'profileSave';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Anuluj';
  form.append(save, cancel);
  const security = document.createElement('aside'); security.className = 'profileCard profileSecurity';
  const securityTitle = document.createElement('h3'); securityTitle.textContent = 'Bezpieczeństwo konta';
  const securityText = document.createElement('p'); securityText.textContent = 'Hasło i PIN nie są wyświetlane. Ten formularz zmienia wyłącznie dane profilu — nie zmienia e-maila logowania, PIN-u ani połączenia Google Drive.';
  const continuity = document.createElement('p'); continuity.textContent = 'Przeglądanie i edycja profilu nie zatrzymują kamery ani nagrywania.';
  security.append(securityTitle, securityText, continuity);
  card.append(subtitle, status, details, edit, form); content.append(card, security);
  dialog.append(hero, content); document.body.append(dialog);
  let current = null, saving = false;
  function endEdit() { form.hidden = true; details.hidden = false; edit.hidden = false; }
  function leave() {
    if (saving) return;
    if (!form.hidden && !confirm('Odrzucić niezapisane zmiany profilu?')) return;
    dialog.close(); profileButton.focus();
  }
  close.addEventListener('click', leave);
  dialog.addEventListener('cancel', event => { event.preventDefault(); leave(); });
  dialog.addEventListener('close', () => { ++request; details.replaceChildren(); status.textContent = ''; current = null; endEdit(); });
  edit.addEventListener('click', () => {
    if (!current || saving) return;
    for (const [name,input] of Object.entries(inputs)) input.value = current.profile?.[name] || '';
    form.hidden = false; details.hidden = true; edit.hidden = true; status.textContent = ''; inputs.first_name.focus();
  });
  cancel.addEventListener('click', () => { if (!saving) { endEdit(); status.textContent = 'Zmiany nie zostały zapisane.'; } });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (saving || !current) return;
    let values;
    try { values = validateProfile(Object.fromEntries(Object.entries(inputs).map(([key,input]) => [key,input.value]))); }
    catch (error) { status.textContent = error.message; return; }
    saving = true; save.disabled = true; cancel.disabled = true; close.disabled = true; retry.disabled = true;
    status.textContent = 'Zapisuję dane…';
    try {
      const result = await saveProfile(values, current.user.id);
      if (!result?.user || result.user.id !== current.user.id || !result.profile) throw new Error('Nie potwierdzono zapisu.');
      current = result; renderProfile(result); endEdit(); status.textContent = 'Dane zostały zapisane.';
    } catch { status.textContent = 'Nie potwierdzono zapisu. Twoje zmiany pozostają w formularzu — spróbuj ponownie.'; }
    finally { saving = false; save.disabled = false; cancel.disabled = false; close.disabled = false; retry.disabled = false; }
  });
  let request = 0;
  function renderProfile({user, profile}) {
    details.replaceChildren();
    title.textContent = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Mój profil';
    intro.textContent = 'Mój profil · HOME SECURITY';
    for (const [label, value] of profileRows(user, profile)) {
      const group = document.createElement('div');
      const dt = document.createElement('dt'); dt.textContent = label;
      const dd = document.createElement('dd'); dd.textContent = value;
      group.append(dt, dd); details.append(group);
    }
  }
  async function refreshProfile() {
    if (saving) return;
    const id = ++request; current = null; edit.disabled = true; endEdit(); details.replaceChildren(); status.textContent = 'Wczytuję dane konta…';
    try {
      const { user, profile } = await loadProfile();
      if (id !== request || !dialog.open) return;
      current = {user, profile}; renderProfile(current); edit.disabled = false;
      status.textContent = profile ? '' : 'Brak zapisanych dodatkowych danych profilu.';
    } catch { if (id === request && dialog.open) status.textContent = 'Nie udało się pobrać danych. Sprawdź połączenie i spróbuj ponownie.'; }
  }
  profileButton.addEventListener('click', () => { dialog.showModal(); refreshProfile(); });
  const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Odśwież dane';
  retry.addEventListener('click', () => { if (!form.hidden && !confirm('Odrzucić zmiany i pobrać zapisane dane?')) return; refreshProfile(); }); card.append(retry);
  const sidebar = document.querySelector('.desktopNav');
  if (sidebar) {
    const entry = document.createElement('button'); entry.type = 'button'; entry.textContent = 'Mój profil'; entry.className = 'profileNavEntry';
    entry.addEventListener('click', () => profileButton.click()); sidebar.append(entry);
  }
  logoutButton.addEventListener('click', async () => {
    if (!confirm('Wylogować konto na tym urządzeniu? Jeżeli ten program jest nadajnikiem, zapis zostanie domknięty, a kamera zatrzymana. Pozostałe urządzenia nie zostaną wylogowane.')) return;
    logoutButton.disabled = true; logoutButton.textContent = 'Wylogowywanie…';
    try { await logout(); } catch { onError('Nie udało się bezpiecznie wylogować. Sesja pozostaje otwarta — spróbuj ponownie.'); }
    finally { logoutButton.disabled = false; logoutButton.textContent = 'Wyloguj'; }
  });
}

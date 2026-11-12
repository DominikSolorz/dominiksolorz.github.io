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

// Etykieta urządzenia z historii logowań (system · przeglądarka). Pełny nagłówek nie trafia do widoku.
export function describeDevice(userAgent) {
  const ua = String(userAgent || '');
  if (!ua) return 'Nieznane urządzenie';
  const system = /iPad/.test(ua) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Inne urządzenie';
  const browser = /HomeSecurityNative/.test(ua) ? 'program HOME SECURITY' : /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome'
    : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'przeglądarka';
  return `${system} · ${browser}`;
}

// Zdjęcie profilu: środkowy kwadrat 512 × 512 px, WebP (albo JPEG, gdy przeglądarka nie zapisuje WebP).
async function squareAvatar(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const side = Math.min(bitmap.width, bitmap.height), canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  canvas.getContext('2d').drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 512, 512);
  bitmap.close?.();
  const encode = (type, quality) => new Promise(resolve => canvas.toBlob(resolve, type, quality));
  let blob = await encode('image/webp', 0.86);
  if (!blob || blob.type !== 'image/webp') blob = await encode('image/jpeg', 0.88);
  if (!blob || blob.size > 1024 * 1024) throw new Error('Nie udało się przygotować zdjęcia. Wybierz inne.');
  return blob;
}

export function mountAccountUI({ loadProfile, saveProfile, requestReset, changePin, logout, onError, avatar = null, loadActivity = null }) {
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
  const heading = document.createElement('div'); heading.append(title, intro);
  const heroAvatar = document.createElement('img'); heroAvatar.className = 'profileAvatar'; heroAvatar.alt = 'Zdjęcie profilu'; heroAvatar.hidden = true;
  hero.append(logo, heroAvatar, heading, close);
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
  const securityText = document.createElement('p'); securityText.textContent = 'Zmianę hasła potwierdzasz jednorazowym linkiem wysłanym na e-mail konta. Zmiana PIN-u wymaga obecnego PIN-u. Hasło i PIN nie są wyświetlane.';
  const continuity = document.createElement('p'); continuity.textContent = 'Przeglądanie i edycja profilu nie zatrzymują kamery ani nagrywania.';
  security.append(securityTitle, securityText, continuity);
  const resetLink = document.createElement('button'); resetLink.type = 'button'; resetLink.textContent = 'Zmień hasło — wyślij link'; resetLink.disabled = true;
  const pinButton = document.createElement('button'); pinButton.type = 'button'; pinButton.textContent = 'Zmień PIN'; pinButton.disabled = true;
  const securityStatus = document.createElement('p'); securityStatus.setAttribute('role','status');
  const pinForm = document.createElement('form'); pinForm.className = 'profilePinForm'; pinForm.hidden = true;
  const pinInputs = {};
  for (const [key,label] of [['current','Obecny PIN'],['next','Nowy PIN (4 lub 6 cyfr)'],['repeat','Powtórz nowy PIN']]) {
    const field = document.createElement('label'); field.textContent = label;
    const input = document.createElement('input'); input.type = 'password'; input.inputMode = 'numeric'; input.maxLength = 6; input.pattern = '(?:[0-9]{4}|[0-9]{6})'; input.required = true; input.autocomplete = key === 'current' ? 'current-password' : 'new-password'; input.name = key;
    pinInputs[key] = input; field.append(input); pinForm.append(field);
  }
  const pinSave = document.createElement('button'); pinSave.type = 'submit'; pinSave.textContent = 'Zapisz nowy PIN';
  const pinCancel = document.createElement('button'); pinCancel.type = 'button'; pinCancel.textContent = 'Anuluj zmianę PIN-u';
  const clearPins = () => { for (const input of Object.values(pinInputs)) input.value = ''; pinForm.hidden = true; };
  let securityBusy = false;
  pinCancel.addEventListener('click',()=>{if(!securityBusy)clearPins();});
  pinButton.addEventListener('click',()=>{if(!current || securityBusy)return;pinForm.hidden=false;securityStatus.textContent='Aktywne połączenia pozostaną otwarte. Nowy PIN będzie wymagany przy kolejnym odblokowaniu.';pinInputs.current.focus();});
  resetLink.addEventListener('click',async()=>{
    if(!current || securityBusy)return; securityBusy=true;resetLink.disabled=true;close.disabled=true;
    try{await requestReset(current.user.id);securityStatus.textContent='Poproszono o link resetujący na adres konta. Sprawdź pocztę oraz Spam. Hasło nie zostało jeszcze zmienione.';}
    catch(error){securityStatus.textContent=error.message || 'Nie udało się wysłać linku. Spróbuj później.';}
    finally{securityBusy=false;resetLink.disabled=false;close.disabled=false;}
  });
  pinForm.addEventListener('submit',async event=>{
    event.preventDefault();if(!current || securityBusy)return;
    if(pinInputs.next.value!==pinInputs.repeat.value){securityStatus.textContent='Nowe numery PIN nie są identyczne.';return;}
    securityBusy=true;pinSave.disabled=true;pinCancel.disabled=true;close.disabled=true;
    try{await changePin(pinInputs.current.value,pinInputs.next.value,current.user.id);clearPins();securityStatus.textContent='Nowy PIN został zapisany. Kamera i połączenie Drive pozostają bez zmian.';}
    catch(error){securityStatus.textContent=error.message || 'Nie potwierdzono zmiany PIN-u. Sprawdź połączenie.';}
    finally{pinInputs.current.value='';pinInputs.next.value='';pinInputs.repeat.value='';securityBusy=false;pinSave.disabled=false;pinCancel.disabled=false;close.disabled=false;}
  });
  pinForm.append(pinSave,pinCancel);security.append(resetLink,pinButton,securityStatus,pinForm);
  // Zdjęcie profilu (wybór → podgląd → zapisz lub anuluj) i historia logowań — tylko gdy aplikacja je obsługuje.
  let avatarCard = null, avatarPreview = null, avatarStatus = null, avatarInput = null, avatarSave = null, avatarCancel = null, avatarRemove = null;
  let avatarBlob = null, avatarObjectUrl = '', avatarBusy = false;
  const setAvatar = url => {
    heroAvatar.src = url || ''; heroAvatar.hidden = !url; hero.className = url ? 'profileHero hasAvatar' : 'profileHero';
    if (avatarRemove) avatarRemove.hidden = !url;
    if (typeof CustomEvent === 'function') document.dispatchEvent?.(new CustomEvent('hs-profile-avatar', { detail: { url: url || '' } }));
  };
  const dropPreview = () => {
    if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
    avatarObjectUrl = ''; avatarBlob = null;
    if (avatarPreview) { avatarPreview.hidden = true; avatarPreview.src = ''; avatarSave.hidden = true; avatarCancel.hidden = true; avatarInput.value = ''; }
  };
  if (avatar) {
    avatarCard = document.createElement('section'); avatarCard.className = 'profileCard profileAvatarCard';
    const avatarTitle = document.createElement('h3'); avatarTitle.textContent = 'Zdjęcie profilu';
    const avatarText = document.createElement('p'); avatarText.textContent = 'Wybierz dowolne zdjęcie z telefonu lub komputera. Zapisujemy kwadrat 512 × 512 px widoczny tylko na Twoim koncie.';
    avatarPreview = document.createElement('img'); avatarPreview.className = 'profileAvatarPreview'; avatarPreview.alt = 'Podgląd nowego zdjęcia'; avatarPreview.hidden = true;
    const pick = document.createElement('label'); pick.className = 'profileAvatarPick'; pick.textContent = 'Wybierz zdjęcie';
    avatarInput = document.createElement('input'); avatarInput.type = 'file'; avatarInput.accept = 'image/*'; avatarInput.className = 'profileAvatarInput';
    pick.append(avatarInput);
    avatarSave = document.createElement('button'); avatarSave.type = 'button'; avatarSave.textContent = 'Zapisz zdjęcie'; avatarSave.hidden = true; avatarSave.className = 'profileSave';
    avatarCancel = document.createElement('button'); avatarCancel.type = 'button'; avatarCancel.textContent = 'Anuluj'; avatarCancel.hidden = true;
    avatarRemove = document.createElement('button'); avatarRemove.type = 'button'; avatarRemove.textContent = 'Usuń zdjęcie'; avatarRemove.hidden = true;
    avatarStatus = document.createElement('p'); avatarStatus.setAttribute('role', 'status');
    avatarCard.append(avatarTitle, avatarText, avatarPreview, pick, avatarSave, avatarCancel, avatarRemove, avatarStatus);
    avatarInput.addEventListener('change', async () => {
      const file = avatarInput.files?.[0]; if (!file || avatarBusy) return;
      if (!/^image\//.test(file.type) || file.size > 20 * 1024 * 1024) { avatarStatus.textContent = 'Wybierz plik zdjęcia (JPG, PNG, HEIC, WebP) do 20 MB.'; avatarInput.value = ''; return; }
      avatarStatus.textContent = 'Przygotowuję podgląd…';
      try {
        const blob = await squareAvatar(file); dropPreview(); avatarBlob = blob; avatarObjectUrl = URL.createObjectURL(blob);
        avatarPreview.src = avatarObjectUrl; avatarPreview.hidden = false; avatarSave.hidden = false; avatarCancel.hidden = false;
        avatarStatus.textContent = 'Tak będzie wyglądać zdjęcie. Zapisz albo anuluj.';
      } catch (error) { avatarStatus.textContent = error.message || 'Tego pliku nie da się odczytać. Wybierz inne zdjęcie.'; avatarInput.value = ''; }
    });
    avatarCancel.addEventListener('click', () => { if (!avatarBusy) { dropPreview(); avatarStatus.textContent = 'Zdjęcie nie zostało zmienione.'; } });
    avatarSave.addEventListener('click', async () => {
      if (!current || !avatarBlob || avatarBusy) return;
      avatarBusy = true; avatarSave.disabled = true; avatarCancel.disabled = true; close.disabled = true; avatarStatus.textContent = 'Zapisuję zdjęcie…';
      try { const url = await avatar.save(avatarBlob, current.user.id); dropPreview(); setAvatar(url); avatarStatus.textContent = 'Zdjęcie zostało zapisane.'; }
      catch (error) { avatarStatus.textContent = error.message || 'Nie udało się zapisać zdjęcia. Spróbuj ponownie.'; }
      finally { avatarBusy = false; avatarSave.disabled = false; avatarCancel.disabled = false; close.disabled = false; }
    });
    avatarRemove.addEventListener('click', async () => {
      if (!current || avatarBusy || !confirm('Usunąć zdjęcie profilu?')) return;
      avatarBusy = true; avatarRemove.disabled = true; avatarStatus.textContent = 'Usuwam zdjęcie…';
      try { await avatar.remove(current.user.id); setAvatar(null); avatarStatus.textContent = 'Zdjęcie zostało usunięte.'; }
      catch (error) { avatarStatus.textContent = error.message || 'Nie udało się usunąć zdjęcia.'; }
      finally { avatarBusy = false; avatarRemove.disabled = false; }
    });
  }
  let activityCard = null, activitySummary = null, activityList = null, activityStatus = null;
  if (loadActivity) {
    activityCard = document.createElement('section'); activityCard.className = 'profileCard profileActivity';
    const activityTitle = document.createElement('h3'); activityTitle.textContent = 'Historia logowań';
    activitySummary = document.createElement('dl'); activitySummary.className = 'profileActivityStats';
    activityList = document.createElement('ol'); activityList.className = 'profileSignIns';
    activityStatus = document.createElement('p'); activityStatus.setAttribute('role', 'status');
    activityCard.append(activityTitle, activitySummary, activityList, activityStatus);
  }
  function renderActivity({ events = [], count30 = 0, failedPin = 0 }) {
    activitySummary.replaceChildren(); activityList.replaceChildren();
    for (const [label, value] of [['Udane logowania (30 dni)', String(count30)], ['Nieudane próby PIN-u od ostatniego odblokowania', String(failedPin)], ['Ostatnie logowanie', events[0] ? new Date(events[0].created_at).toLocaleString('pl-PL') : 'Brak danych']]) {
      const group = document.createElement('div'); const dt = document.createElement('dt'); dt.textContent = label; const dd = document.createElement('dd'); dd.textContent = value;
      group.append(dt, dd); activitySummary.append(group);
    }
    for (const event of events) {
      const item = document.createElement('li'); const when = document.createElement('strong'); when.textContent = new Date(event.created_at).toLocaleString('pl-PL');
      const device = document.createElement('span'); device.textContent = describeDevice(event.user_agent); item.append(when, device); activityList.append(item);
    }
    activityStatus.textContent = events.length ? 'Pokazujemy 10 ostatnich logowań. Historia jest przechowywana 180 dni.' : 'Nowe logowania pojawią się tutaj.';
  }
  async function loadExtras(userId, id) {
    if (avatar) { try { const url = await avatar.load(userId); if (id === request && dialog.open) setAvatar(url); } catch { if (id === request) setAvatar(null); } }
    if (loadActivity) {
      activityStatus.textContent = 'Wczytuję historię logowań…';
      try { const data = await loadActivity(userId); if (id === request && dialog.open) renderActivity(data); }
      catch (error) { if (id === request && dialog.open) { activitySummary.replaceChildren(); activityList.replaceChildren(); activityStatus.textContent = error?.code === 'missing' ? 'Historia logowań pojawi się po aktualizacji bazy danych konta.' : 'Nie udało się pobrać historii logowań. Sprawdź połączenie.'; } }
    }
  }
  card.append(subtitle, status, details, edit, form); content.append(...[avatarCard, card, activityCard, security].filter(Boolean));
  dialog.append(hero, content); document.body.append(dialog);
  let current = null, saving = false;
  function endEdit() { form.hidden = true; details.hidden = false; edit.hidden = false; }
  function leave() {
    if (saving || securityBusy) return;
    if (!form.hidden && !confirm('Odrzucić niezapisane zmiany profilu?')) return;
    dialog.close(); profileButton.focus();
  }
  close.addEventListener('click', leave);
  dialog.addEventListener('cancel', event => { event.preventDefault(); leave(); });
  dialog.addEventListener('close', () => { ++request; dropPreview(); details.replaceChildren(); status.textContent = ''; securityStatus.textContent = '';clearPins();current = null; endEdit(); });
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
    if (saving || securityBusy) return;
    const id = ++request; current = null; edit.disabled = true; resetLink.disabled = true; pinButton.disabled = true; clearPins(); endEdit(); details.replaceChildren(); status.textContent = 'Wczytuję dane konta…';
    try {
      const { user, profile } = await loadProfile();
      if (id !== request || !dialog.open) return;
      current = {user, profile}; renderProfile(current); edit.disabled = false; resetLink.disabled = false; pinButton.disabled = false; loadExtras(user.id, id);
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

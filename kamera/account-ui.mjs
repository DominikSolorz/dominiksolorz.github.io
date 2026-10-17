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
export function mountAccountUI({ loadProfile, logout, onError }) {
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
  dialog.className = 'accountDialog'; dialog.setAttribute('aria-labelledby', 'accountProfileTitle');
  const title = document.createElement('h2'); title.id = 'accountProfileTitle'; title.textContent = 'Mój profil';
  const intro = document.createElement('p'); intro.textContent = 'Twoje dane zapisane na koncie HOME SECURITY.';
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  const details = document.createElement('dl'); details.className = 'profileDetails';
  const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Zamknij profil';
  close.addEventListener('click', () => { dialog.close(); details.replaceChildren(); status.textContent = ''; profileButton.focus(); });
  dialog.addEventListener('close', () => { details.replaceChildren(); status.textContent = ''; });
  dialog.append(title, intro, status, details, close); document.body.append(dialog);
  let request = 0;
  async function refreshProfile() {
    const id = ++request; details.replaceChildren(); status.textContent = 'Wczytuję dane konta…';
    try {
      const { user, profile } = await loadProfile();
      if (id !== request || !dialog.open) return;
      for (const [label, value] of profileRows(user, profile)) {
        const group = document.createElement('div');
        const dt = document.createElement('dt'); dt.textContent = label;
        const dd = document.createElement('dd'); dd.textContent = value;
        group.append(dt, dd); details.append(group);
      }
      status.textContent = profile ? '' : 'Brak zapisanych dodatkowych danych profilu.';
    } catch { if (id === request && dialog.open) status.textContent = 'Nie udało się pobrać danych. Sprawdź połączenie i spróbuj ponownie.'; }
  }
  profileButton.addEventListener('click', () => { dialog.showModal(); refreshProfile(); });
  const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Odśwież dane';
  retry.addEventListener('click', refreshProfile); dialog.append(retry);
  logoutButton.addEventListener('click', async () => {
    if (!confirm('Wylogować konto na tym urządzeniu? Jeżeli ten program jest nadajnikiem, zapis zostanie domknięty, a kamera zatrzymana. Pozostałe urządzenia nie zostaną wylogowane.')) return;
    logoutButton.disabled = true; logoutButton.textContent = 'Wylogowywanie…';
    try { await logout(); } catch { onError('Nie udało się bezpiecznie wylogować. Sesja pozostaje otwarta — spróbuj ponownie.'); }
    finally { logoutButton.disabled = false; logoutButton.textContent = 'Wyloguj'; }
  });
}

// Installation of the existing owner-panel PWA; no accounts or recordings are read.
const button = document.getElementById('android-install');
const status = document.getElementById('android-install-status');
let pendingInstall = null;
const standalone = () => window.matchMedia('(display-mode: standalone)').matches;
function installed() {
  pendingInstall = null;
  button.hidden = true;
  status.textContent = 'Aplikacja jest zainstalowana. Otwórz ją z ikony na ekranie głównym lub przyciskiem poniżej.';
}
if (button && status) {
  if (standalone()) installed();
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    pendingInstall = event;
    button.hidden = false;
    status.textContent = 'HOME SECURITY jest gotowe do instalacji. Naciśnij przycisk, aby dodać aplikację do telefonu lub tabletu.';
  });
  window.addEventListener('appinstalled', installed);
  button.addEventListener('click', async () => {
    if (!pendingInstall) {
      status.textContent = 'Otwórz menu Chrome (trzy kropki) i wybierz „Zainstaluj aplikację” lub „Dodaj do ekranu głównego”. Jeśli masz już ikonę HOME SECURITY, uruchom ją. Na komputerze otwórz tę stronę na swoim Androidzie.';
      return;
    }
    const prompt = pendingInstall;
    pendingInstall = null;
    button.disabled = true;
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      if (result.outcome === 'accepted') {
        status.textContent = 'Zatwierdzono instalację. Po jej zakończeniu uruchom HOME SECURITY z ikony na ekranie głównym.';
      } else {
        status.textContent = 'Instalacja została anulowana. Możesz nadal otworzyć aplikację przyciskiem poniżej.';
      }
    } catch {
      status.textContent = 'Nie udało się otworzyć instalacji. Spróbuj przez menu Chrome: „Zainstaluj aplikację” lub „Dodaj do ekranu głównego”.';
    } finally {
      button.disabled = false;
    }
  });
  if (window.isSecureContext && 'serviceWorker' in navigator) {
    // Reuse the panel worker; do not force an update of an active recording session.
    navigator.serviceWorker.getRegistration(new URL('./', location.href).href)
      .then(registration => registration || navigator.serviceWorker.register('./sw.js'))
      .catch(() => {
        status.textContent = 'Instalacja wymaga połączenia z internetem i obsługiwanej przeglądarki. Otwórz tę stronę w Chrome na Androidzie i spróbuj ponownie.';
      });
  }
}

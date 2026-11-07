# HOME SECURITY / kamera — indeks plików głównego katalogu

To spis **wszystkich 112 plików bezpośrednio w katalogu `kamera/`** według stanu sprawdzonego 7.11.2026. Podkatalogi opisane są osobno w [README.md](README.md) i [drzewie projektu](../docs/DRZEWO-PROJEKTU.md).

Nazwy i role pozwalają znaleźć odpowiedni kod. **To opis nawigacyjny, a nie gwarancja zachowania funkcji bez przeczytania implementacji.** Przy zmianie sprawdź importy, testy i wymagania wydania.

## 01. Publiczna witryna i strony informacyjne

| Plik | Cel i przeznaczenie |
| --- | --- |
| [`galeria.html`](galeria.html) | Strona HTML: galeria |
| [`index.html`](index.html) | Strona HTML: index |
| [`instrukcja.html`](instrukcja.html) | Strona HTML: instrukcja |
| [`jak-dziala.html`](jak-dziala.html) | Strona HTML: jak dziala |
| [`kontakt.html`](kontakt.html) | Strona HTML: kontakt |
| [`marketing-auto-update.css`](marketing-auto-update.css) | Style informacji o automatycznych aktualizacjach |
| [`marketing-auto-update.mjs`](marketing-auto-update.mjs) | Logika komunikatów o aktualizacjach na stronie |
| [`marketing-contact.js`](marketing-contact.js) | Obsługa publicznego kontaktu |
| [`marketing-downloads.mjs`](marketing-downloads.mjs) | Sekcja pobierania instalatorów |
| [`marketing-gallery.css`](marketing-gallery.css) | Style publicznej galerii |
| [`marketing-gallery.mjs`](marketing-gallery.mjs) | Obsługa publicznej galerii |
| [`marketing-motion.css`](marketing-motion.css) | Animacje i przejścia strony |
| [`marketing-motion.mjs`](marketing-motion.mjs) | Logika animacji strony |
| [`marketing-navigation.css`](marketing-navigation.css) | Wygląd nawigacji publicznej |
| [`marketing-navigation.mjs`](marketing-navigation.mjs) | Nawigacja publiczna |
| [`marketing-start.css`](marketing-start.css) | Styl strony startowej |
| [`marketing-start.mjs`](marketing-start.mjs) | Sekcja startowa publicznej strony |
| [`marketing.css`](marketing.css) | Główny arkusz stylów strony publicznej |
| [`mozliwosci.html`](mozliwosci.html) | Strona HTML: mozliwosci |
| [`nagrania.html`](nagrania.html) | Strona HTML: nagrania |
| [`o-systemie.html`](o-systemie.html) | Strona HTML: o systemie |
| [`pobierz.html`](pobierz.html) | Strona HTML: pobierz |
| [`pomoc.html`](pomoc.html) | Strona HTML: pomoc |
| [`prezentacja.html`](prezentacja.html) | Strona HTML: prezentacja |
| [`przygotowanie.html`](przygotowanie.html) | Strona HTML: przygotowanie |
| [`pytania.html`](pytania.html) | Strona HTML: pytania |
| [`stan-projektu.html`](stan-projektu.html) | Strona HTML: stan projektu |
| [`wymagania.html`](wymagania.html) | Strona HTML: wymagania |

## 02. Dokumenty i prywatność

| Plik | Cel i przeznaczenie |
| --- | --- |
| [`dokumenty.html`](dokumenty.html) | Strona HTML: dokumenty |
| [`legal-premium.css`](legal-premium.css) | Style stron prawnych |
| [`polityka-prywatnosci.html`](polityka-prywatnosci.html) | Strona HTML: polityka prywatnosci |
| [`regulamin.html`](regulamin.html) | Strona HTML: regulamin |
| [`rodo.html`](rodo.html) | Strona HTML: rodo |
| [`zasady-korzystania.html`](zasady-korzystania.html) | Strona HTML: zasady korzystania |

## 03. Telefon, PWA i cache

| Plik | Cel i przeznaczenie |
| --- | --- |
| [`manifest.webmanifest`](manifest.webmanifest) | Manifest instalowanej PWA |
| [`mobile-camera-frame.css`](mobile-camera-frame.css) | Style obrazu kamery na telefonie |
| [`mobile-camera-frame.mjs`](mobile-camera-frame.mjs) | Dopasowanie obrazu kamery na telefonie |
| [`mobile-camera-status.mjs`](mobile-camera-status.mjs) | Informacje o stanie kamery na telefonie |
| [`mobile-viewer.css`](mobile-viewer.css) | Style mobilnego podglądu |
| [`mobile.js`](mobile.js) | Zachowanie panelu na telefonie |
| [`sw.js`](sw.js) | Service worker PWA i aktualizacje cache |
| [`version.json`](version.json) | Wersja PWA |

## 04. Logowanie, PIN i urządzenia

| Plik | Cel i przeznaczenie |
| --- | --- |
| [`access.js`](access.js) | Zasady dostępu w panelu |
| [`account-security.mjs`](account-security.mjs) | Funkcje bezpieczeństwa konta |
| [`account-ui.mjs`](account-ui.mjs) | Interfejs konta |
| [`auth-experience.css`](auth-experience.css) | Wygląd ekranów logowania |
| [`auth-experience.mjs`](auth-experience.mjs) | Zachowanie ekranów logowania |
| [`auth.js`](auth.js) | Uwierzytelnianie użytkownika |
| [`lock.js`](lock.js) | Ekran blokady |
| [`pin.js`](pin.js) | Obsługa kodu PIN |
| [`remote-unlock-crypto.mjs`](remote-unlock-crypto.mjs) | Funkcje kryptograficzne odblokowania |
| [`remote-unlock-device-store.mjs`](remote-unlock-device-store.mjs) | Magazyn zaufanych urządzeń do odblokowania |
| [`remote-unlock-host.mjs`](remote-unlock-host.mjs) | Część hosta zdalnego odblokowania |
| [`remote-unlock-phone.mjs`](remote-unlock-phone.mjs) | Część telefonu zdalnego odblokowania |
| [`remote-unlock-protocol.mjs`](remote-unlock-protocol.mjs) | Protokół zdalnego odblokowania |
| [`remote-unlock-ui.css`](remote-unlock-ui.css) | Style interfejsu zdalnego odblokowania |

## 05. Nagrywanie, archiwum i foldery

| Plik | Cel i przeznaczenie |
| --- | --- |
| [`close-recording-fragment.mjs`](close-recording-fragment.mjs) | Domykanie fragmentu nagrania |
| [`diskstore.js`](diskstore.js) | Przechowywanie danych na dysku |
| [`dvr-ui.js`](dvr-ui.js) | Odtwarzanie i nawigacja archiwum DVR |
| [`library-ui.js`](library-ui.js) | Widok biblioteki nagrań |
| [`local-retention.mjs`](local-retention.mjs) | Retencja danych na lokalnym dysku |
| [`mp4fix.js`](mp4fix.js) | Obsługa lub naprawa pliku MP4 |
| [`recording-actions.mjs`](recording-actions.mjs) | Polecenia nagrywania |
| [`recording-init.mjs`](recording-init.mjs) | Uruchomienie nagrywania |
| [`recording-storage.mjs`](recording-storage.mjs) | Przechowywanie nagrań |
| [`recording-time.mjs`](recording-time.mjs) | Obsługa czasu nagrywania |
| [`recording-view-state.mjs`](recording-view-state.mjs) | Stan widoku nagrywania |
| [`recproto.js`](recproto.js) | Protokół danych nagrań |
| [`recstore.js`](recstore.js) | Magazyn nagrań |
| [`remote-folder-ui.mjs`](remote-folder-ui.mjs) | Interfejs zdalnego wyboru folderu |

## 06. Dźwięk

| Plik | Cel i przeznaczenie |
| --- | --- |
| [`audio-cleaner.mjs`](audio-cleaner.mjs) | Oczyszczanie sygnału audio |
| [`audio-listen.css`](audio-listen.css) | Styl odtwarzania i odsłuchu |
| [`audio-meter.mjs`](audio-meter.mjs) | Pomiar poziomu dźwięku |
| [`audio-profile.mjs`](audio-profile.mjs) | Profile ustawień dźwięku |
| [`audio-source.mjs`](audio-source.mjs) | Wybór i obsługa źródła dźwięku |
| [`noise-gate.worklet.js`](noise-gate.worklet.js) | Procesor bramki szumów audio |

## 07. Kamera, galeria i wygląd panelu

| Plik | Cel i przeznaczenie |
| --- | --- |
| [`camera-fit.mjs`](camera-fit.mjs) | Dopasowanie obrazu kamery do widoku |
| [`camera-workspace.css`](camera-workspace.css) | Style obszaru kamer |
| [`camera-workspace.mjs`](camera-workspace.mjs) | Widok i układ kamer |
| [`gallery-catalog.mjs`](gallery-catalog.mjs) | Lista elementów galerii |
| [`gallery-viewer.css`](gallery-viewer.css) | Style przeglądarki galerii |
| [`gallery-viewer.mjs`](gallery-viewer.mjs) | Przeglądanie zdjęć galerii |
| [`interface-concept.css`](interface-concept.css) | Wizualna koncepcja interfejsu |
| [`interface-theme.css`](interface-theme.css) | Motyw wyglądu aplikacji |
| [`picture-in-picture.mjs`](picture-in-picture.mjs) | Funkcja obrazu w obrazie |
| [`premium-dark-pro.css`](premium-dark-pro.css) | Ciemny motyw premium panelu |
| [`reference-ui.css`](reference-ui.css) | Style widoku referencyjnego |
| [`ui-icons.mjs`](ui-icons.mjs) | Ikony w interfejsie |
| [`workspace-panels.mjs`](workspace-panels.mjs) | Panele przestrzeni roboczej |
| [`workspace-ui.css`](workspace-ui.css) | Style przestrzeni roboczej |
| [`zoom.js`](zoom.js) | Powiększanie obrazu |

## 08. Windows i Drive

| Plik | Cel i przeznaczenie |
| --- | --- |
| [`desktop-product.css`](desktop-product.css) | Wygląd prezentacji produktu desktopowego |
| [`desktop-update.json`](desktop-update.json) | Manifest bieżącej publikowanej aktualizacji Windows |
| [`desktop.js`](desktop.js) | Zachowanie interfejsu na komputerze |
| [`drive-instalacja.html`](drive-instalacja.html) | Instrukcja instalacji lub konfiguracji Dysku Google |
| [`drive-skrypt.gs`](drive-skrypt.gs) | Skrypt Google Apps Script dla integracji Drive |
| [`kamera-autostart.vbs`](kamera-autostart.vbs) | Skrypt autostartu na Windows |
| [`kamera-instaluj.bat`](kamera-instaluj.bat) | Skrypt instalacji lub konfiguracji na Windows |
| [`native-drive-ui.mjs`](native-drive-ui.mjs) | Interfejs integracji natywnej z Dyskiem Google |

## 09. Uruchamianie, konfiguracja i pozostałe pliki

| Plik | Cel i przeznaczenie |
| --- | --- |
| [`PLAN-100-USPRAWNIEN.md`](PLAN-100-USPRAWNIEN.md) | Plan usprawnień projektu |
| [`README.md`](README.md) | Dokumentacja: README |
| [`app.js`](app.js) | Główna logika panelu kamer, nie mylić z /app.js |
| [`config.js`](config.js) | Konfiguracja aplikacji webowej |
| [`detect.js`](detect.js) | Wykrywanie możliwości lub środowiska |
| [`panel-entry.mjs`](panel-entry.mjs) | Uruchomienie logiki panelu |
| [`panel.html`](panel.html) | Główna strona prywatnego panelu |
| [`public-entry.js`](public-entry.js) | Uruchomienie strony publicznej |
| [`sitemap.xml`](sitemap.xml) | Mapa publicznych adresów URL |
| [`style.css`](style.css) | Główny arkusz stylów prywatnego panelu |
| [`support-entry.mjs`](support-entry.mjs) | Inicjalizacja widoku pomocy |
| [`support-view.mjs`](support-view.mjs) | Widok pomocy |
| [`support.css`](support.css) | Wygląd pomocy |

Nie przenoś działających `*.html`, `*.js`, manifestów i plików CSS bez migracji ścieżek oraz testów GitHub Pages, PWA i instalatora Windows. Zasady: [AGENTS.md](../AGENTS.md).

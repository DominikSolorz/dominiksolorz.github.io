# HOME SECURITY / GitHub Actions — mapa automatów

Ten katalog zawiera automaty budowania, testowania i publikacji HOME SECURITY. **Nie są to pliki aplikacji**. Uruchamiany kod znajduje się w `kamera/`, `desktop-client/`, `native-mobile/`, `agent/`, `scripts/` i `tests/`.

GitHub wymaga, aby wykonywalne pliki workflow `.yml` znajdowały się **bezpośrednio w `.github/workflows/`**. Podkatalogi kategorii spowodowałyby utratę wykrywania workflow. Dlatego pliki pozostają na swoich miejscach, a nazwy widoczne w zakładce **Actions** mają polskie oznaczenia kategorii.

## 01. DESKTOP — aplikacja Windows i instalator

| Plik | Do czego służy |
| --- | --- |
| [desktop-scheduled-release.yml](desktop-scheduled-release.yml) | Przygotowanie i publikacja wydań programu Windows zgodnie z procesem release |
| [desktop-ui-preview.yml](desktop-ui-preview.yml) | Budowa podglądu interfejsu aplikacji desktopowej |
| [desktop-ui220-installer.yml](desktop-ui220-installer.yml) | Przygotowanie instalatora wariantu interfejsu UI 220 |
| [home-security-audio-desktop-preview.yml](home-security-audio-desktop-preview.yml) | Weryfikacja lub podgląd funkcji audio programu desktopowego |
| [verify-desktop-update-center.yml](verify-desktop-update-center.yml) | Kontrola centrum aktualizacji desktopowej |
| [verify-native-camera-recording-index.yml](verify-native-camera-recording-index.yml) | Kontrola mechanizmu nagrywania i indeksowania w środowisku natywnym |

Kod: [desktop-client/](../../desktop-client/), [agent/](../../agent/). Wersja i paczki: [kamera/desktop-update.json](../../kamera/desktop-update.json), [kamera/downloads/](../../kamera/downloads/), [kamera/updates/](../../kamera/updates/).

## 02. MOBILE — telefon, PWA i Android

| Plik | Do czego służy |
| --- | --- |
| [android-emulator.yml](android-emulator.yml) | Uruchamianie testów związanych z emulatorem Android |
| [mobile-preview.yml](mobile-preview.yml) | Przygotowanie podglądu mobilnego |
| [verify-home-mobile-phone.yml](verify-home-mobile-phone.yml) | Testy widoku telefonu, kamery i mechanizmu aktualizacji |

Kod PWA: [kamera/mobile.js](../../kamera/mobile.js), [kamera/sw.js](../../kamera/sw.js). Kod natywny: [native-mobile/](../../native-mobile/).

## 03. WWW — strona i publikacja

| Plik | Do czego służy |
| --- | --- |
| [pages.yml](pages.yml) | Kontrola i publikacja strony oraz panelu przez GitHub Pages |
| [pagespeed-audit.yml](pagespeed-audit.yml) | Audyt wydajności i PageSpeed |
| [verify-home-vercel-public.yml](verify-home-vercel-public.yml) | Kontrola oddzielnej publicznej witryny Vercel |
| [verify-pages-public-bundle.yml](verify-pages-public-bundle.yml) | Kontrola pakietu plików przygotowanych do GitHub Pages |
| [verify-public-website-premium.yml](verify-public-website-premium.yml) | Kontrola wyglądu publicznej strony |

Kod: [kamera/](../../kamera/), [hosting/public-site/](../../hosting/public-site/). Generator: [scripts/build-marketing.mjs](../../scripts/build-marketing.mjs).

## 04. WSPÓLNE — funkcje wykorzystywane w kilku miejscach

| Plik | Do czego służy |
| --- | --- |
| [verify-dvr-time-navigation.yml](verify-dvr-time-navigation.yml) | Sprawdzenie nawigacji po czasie w archiwum nagrań |
| [verify-home-security-audio.yml](verify-home-security-audio.yml) | Kontrola funkcji dźwięku |
| [verify-phone-pin-windows.yml](verify-phone-pin-windows.yml) | Kontrola połączenia funkcji PIN telefonu i Windows |
| [verify-premium-dark-pro.yml](verify-premium-dark-pro.yml) | Testy wariantu wizualnego Premium Dark Pro |
| [verify-unified-ui-remote-pin.yml](verify-unified-ui-remote-pin.yml) | Kontrola wspólnego interfejsu i zdalnego PIN |

## 05. HISTORYCZNE

| Plik | Status |
| --- | --- |
| [stable-desktop-149.yml](stable-desktop-149.yml) | Historyczna procedura Windows 1.4.9. Nie jest bieżącym sposobem publikacji wydań. |

## Jak bezpiecznie zmieniać automaty

Przed edycją otwórz konkretny `.yml` i sprawdź pola `on:`, `jobs:`, `permissions:`, `paths:` oraz uruchamiane skrypty. Sama obecność pliku **nie oznacza**, że dany workflow uruchamia się na `main`, działa automatycznie albo aktualnie przechodzi testy. Nie uruchamiaj release wyłącznie po to, by sprawdzić nazwę workflow.

Nie zmieniaj nazw ani lokalizacji plików tylko dla wyglądu. Odwołania do workflow mogą znajdować się w innych automatach, konfiguracjach i instrukcjach. Najpierw wyszukaj zależności, potem zaproponuj migrację.

Więcej: [główna mapa projektu](../../docs/REPO-MAP.md), [mapa wydań](../../docs/RELEASE-MAP.md), [instrukcje agentów](../../AGENTS.md).

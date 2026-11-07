# HOME SECURITY / kamera — publiczna strona, panel i PWA

To **główny katalog działającej aplikacji webowej HOME SECURITY**, a nie zbiór plików przeznaczonych do swobodnego przenoszenia. Widoczne tutaj ścieżki są wykorzystywane przez GitHub Pages, panel, service worker i aplikację Windows.

**Zacznij od pytania: co chcesz zmienić?** Każda pozycja prowadzi do konkretnego pliku w tym katalogu.

## 01. Strona internetowa dostępna publicznie

| Cel | Gdzie wejść |
| --- | --- |
| Główna strona projektu | [index.html](index.html), [marketing.css](marketing.css) |
| Nawigacja publicznej strony | [marketing-navigation.mjs](marketing-navigation.mjs), [marketing-navigation.css](marketing-navigation.css) |
| Animacje i układ strony | [marketing-motion.mjs](marketing-motion.mjs), [marketing-motion.css](marketing-motion.css), [marketing-start.mjs](marketing-start.mjs) |
| Informacje, pomoc, kontakt, pobieranie | [o-systemie.html](o-systemie.html), [pomoc.html](pomoc.html), [kontakt.html](kontakt.html), [pobierz.html](pobierz.html) |
| Informacje prawne | [regulamin.html](regulamin.html), [rodo.html](rodo.html), [polityka-prywatnosci.html](polityka-prywatnosci.html) |

**Ważne:** część stron generuje [../scripts/build-marketing.mjs](../scripts/build-marketing.mjs). Przed zmianą HTML sprawdź, czy nie powinno się zmienić generatora.

## 02. Panel obsługi kamer i wygląd

| Cel | Gdzie wejść |
| --- | --- |
| Główny ekran po zalogowaniu | [panel.html](panel.html), [app.js](app.js), [panel-entry.mjs](panel-entry.mjs) |
| Style panelu i układ okien | [style.css](style.css), [workspace-ui.css](workspace-ui.css), [workspace-panels.mjs](workspace-panels.mjs) |
| Wygląd premium | [premium-dark-pro.css](premium-dark-pro.css), [interface-theme.css](interface-theme.css) |
| Widok kamer | [camera-workspace.mjs](camera-workspace.mjs), [camera-workspace.css](camera-workspace.css) |
| Galeria, biblioteka i nagrania | [gallery-viewer.mjs](gallery-viewer.mjs), [library-ui.js](library-ui.js), [dvr-ui.js](dvr-ui.js) |

## 03. Telefon i aplikacja instalowana z przeglądarki

| Cel | Gdzie wejść |
| --- | --- |
| Zachowanie widoku mobilnego | [mobile.js](mobile.js), [mobile-viewer.css](mobile-viewer.css) |
| Obraz i stan kamery na telefonie | [mobile-camera-frame.mjs](mobile-camera-frame.mjs), [mobile-camera-frame.css](mobile-camera-frame.css), [mobile-camera-status.mjs](mobile-camera-status.mjs) |
| Instalacja i aktualizacja PWA | [manifest.webmanifest](manifest.webmanifest), [sw.js](sw.js), [version.json](version.json) |
| Odblokowanie Windows przez telefon | [remote-unlock-phone.mjs](remote-unlock-phone.mjs), [remote-unlock-host.mjs](remote-unlock-host.mjs), [remote-unlock-protocol.mjs](remote-unlock-protocol.mjs) |

Natywne Android i iOS znajdują się osobno w [../native-mobile/](../native-mobile/). Nie utożsamiaj ich z PWA.

## 04. Konto, dostęp i bezpieczeństwo

[auth.js](auth.js) odpowiada za uwierzytelnianie, [lock.js](lock.js) i [pin.js](pin.js) za obsługę blokady i PIN, [access.js](access.js) za logikę dostępu, a [account-security.mjs](account-security.mjs) za funkcje bezpieczeństwa konta. Zmiany w tych plikach wymagają kontroli testów i nie mogą osłabić zabezpieczeń.

## 05. Nagrywanie, archiwum i przechowywanie

[recording-init.mjs](recording-init.mjs), [recording-actions.mjs](recording-actions.mjs), [recording-storage.mjs](recording-storage.mjs), [recording-time.mjs](recording-time.mjs), [recstore.js](recstore.js), [recproto.js](recproto.js), [local-retention.mjs](local-retention.mjs) i [close-recording-fragment.mjs](close-recording-fragment.mjs) obsługują różne części zapisu i odczytu. Odpowiedni proces lokalny znajduje się też w [../agent/](../agent/).

## 06. Wersje i pliki gotowe do pobrania

- [desktop-update.json](desktop-update.json) — manifest aktualizacji Windows. Nie aktualizuj ręcznie wersji ani sum kontrolnych.
- [version.json](version.json) — wersja aplikacji PWA.
- [downloads/](downloads/) — opublikowane instalatory.
- [updates/](updates/) — pakiety aktualizacji i powrotu do poprzedniej wersji.

Nie przenoś tych plików, jeśli istnieją na nie aktywne odnośniki.

## Jak pracuje agent

Najpierw przeczytaj [../AGENTS.md](../AGENTS.md), [../AGENT-SHORTCUTS.md](../AGENT-SHORTCUTS.md) i [../docs/REPO-MAP.md](../docs/REPO-MAP.md). Wybierz obszar, znajdź źródło zmian, sprawdź zależności i uruchom odpowiednie testy z [../tests/](../tests/). Nie zmieniaj jednocześnie kilku różnych części aplikacji bez uzasadnienia.

Ten dokument jest **mapą nawigacji**, a nie poleceniem przeniesienia istniejącego kodu.

## Pełny spis plików w tym katalogu

[Otwórz KATALOG-PLIKOW.md](KATALOG-PLIKOW.md), aby znaleźć każdy plik bezpośrednio w `kamera/`, z linkiem i krótkim opisem odpowiedzialności.

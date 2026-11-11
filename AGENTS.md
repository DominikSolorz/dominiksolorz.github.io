# Instrukcje dla agentów — repozytorium 01: HOME SECURITY

Zakres wyłącznie `DominikSolorz/dominiksolorz.github.io`. Nie wykonuj zmian w LinkTalk ani LinkTalk-Releases bez wyraźnego osobnego zadania.

Jeśli użytkownik poda alias typu `HS-PANEL`, `HS-TELEFON` lub `HS-AKTUALIZATOR`, rozwiąż go przez [AGENT-SHORTCUTS.md](AGENT-SHORTCUTS.md), a następnie sprawdź dokładne ścieżki i zależności.

**Zawsze zacznij od:** `README.md`, `docs/REPO-MAP.md` i `docs/RELEASE-MAP.md`. Domyślna gałąź docelowa: `main`; pracuj na osobnej gałęzi i używaj PR.

## Wyznaczanie celu
1. Użytkownik mówi „strona główna” → źródło: `kamera/marketing.css`, `kamera/index.html`, generator `scripts/build-marketing.mjs`. Odnajdź rzeczywiste źródło zamiast ręcznie modyfikować wygenerowane HTML.
2. „Program Windows” → `desktop-client/Program.cs` i komponenty `desktop-client/`; przy zmianach w interfejsie także lokalnie pakowany `kamera/panel.html` i `kamera/app.js`. `app.js` w korzeniu to INNY plik.
3. „Telefon” → `kamera/mobile.js` / `kamera/sw.js` / sekcje telefonu w `kamera/panel.css` (07, 12, 19). Nie myl PWA z natywnym `native-mobile/`.
4. „Nagrywanie” → `kamera/app.js`, `kamera/recording-*.mjs`, `agent/` oraz testy. Zmiany muszą zachować zapis i domknięcie fragmentów.
5. „Odblokowanie PIN” → `kamera/lock.js`, `kamera/account-security.mjs`, `kamera/remote-unlock-*.mjs`. Nigdy nie wysyłaj PIN, JWT ani kluczy w jawnej postaci.
6. „Pobierz / aktualizacja” → `kamera/desktop-update.json`, `kamera/pobierz.html`, `desktop-client/Program.cs`, `scripts/desktop-release.mjs`, `.github/workflows/desktop-scheduled-release.yml`.
7. „Vercel” → jedynie `hosting/public-site/`. Publiczna kopia nie jest działającym prywatnym panelem PWA.

## Ochrona działającego projektu
- Nie zmieniaj nazw plików, katalogów, URL i głównej gałęzi tylko dla estetyki. Najpierw wyszukaj wszystkie importy, odnośniki, manifesty, service worker, instalator, testy i publikacje. Zaproponuj migrację ze zgodnością wsteczną.
- Nie kasuj starych instalatorów ani pakietów ZIP: mogą być używane do aktualizacji lub rollbacku. Nie usuwaj branchy i historii bez potwierdzenia.
- Nie zmieniaj ręcznie wersji instalatora lub sum SHA-256. Jedyny zweryfikowany manifest wydania Windows to `kamera/desktop-update.json`, aktualizowany przez release workflow. Wersja PWA: `kamera/version.json`, wersja publicznej kopii: `hosting/public-site/release.json`.
- Brak automatycznego wdrożenia z samego commita. Oddzielaj zmianę w kodzie, zaliczone testy, opublikowaną wersję, oraz instalację na fizycznym urządzeniu.
- Wymagaj kontroli zapisów nagrań przed restartem Windows. Nigdy nie obchodź blokady PIN, RLS i zgody użytkownika na aktualizacje.
- Ogranicz pliki i sekrety do uprawnionych środowisk; nie kopiuj ich do publicznej strony.


## Zasady zmian CSS i widoków HAEM
- **Prywatny panel (PIN, kamera, nagrania, ustawienia, telefon/PWA, Windows) ma jeden arkusz: `kamera/panel.css`.** Ładuje go wyłącznie `<template id="panelStyles">` w `kamera/panel.html`. Opis sekcji, trybów i procedury: [docs/PANEL-CSS.md](docs/PANEL-CSS.md).
- Strona publiczna ma osobne arkusze (`kamera/marketing*.css`, `kamera/tech-theme.css`, generator `scripts/build-marketing.mjs`). Nie mieszaj ich z panelem. `kamera/style.css` i `kamera/workspace-ui.css` służą tylko dokumentom i `nagrania.html`; panel ich nie ładuje.
- Zmieniaj istniejącą deklarację w odpowiedniej sekcji `panel.css`. **Nie twórz** nowych plików-nakładek (`new-style.css`, `final-design.css`, `visual-refresh-2.css` itp.), nie dopisuj na końcu kopii selektora z nową wartością i nie dodawaj `!important` tylko po to, by przebić poprzednią regułę. `tests/panel-css-single-source.test.mjs` odrzuca nieznane pliki `.css` i martwe (nadpisane) deklaracje.
- Zachowaj identyfikatory i klasy używane przez JS, atrybut `hidden` oraz tryby `desktopMode`, `mobileOwnerMode`, `policeCommand`, `usMilitary`. Kolejność sekcji to kolejność kaskady.
- Po zmianie wyglądu podnieś `?v=` arkusza w `panel.html` i w `SHELL` w `kamera/sw.js`. Service worker pobiera CSS/JS najpierw z sieci (kopia offline tylko bez sieci), więc zmiana dotrze po publikacji. Numer wydania (`kamera/version.json`, `CACHE`) zmieniaj tylko przy faktycznym wydaniu.
- Testuj komputer, telefon (320–430 px), tablet, krótkie okno Windows, tryby specjalne i `hidden`. Zmiany wyłącznie na osobnej gałęzi i przez PR. Sprawdzenie po publikacji: docs/PANEL-CSS.md → „Jak sprawdzić, że zmiana dotrze do użytkownika”.

## Zakończenie zadania
Podaj repo, pełne ścieżki plików, gałąź, PR, uruchomione testy, numer rzeczywiście opublikowanego wydania oraz kanał (GitHub Pages / Windows / Vercel / PWA). Jeśli nie ma testu na fizycznym komputerze, napisz o tym otwarcie. Nie deklaruj gotowej publikacji na podstawie samego commita.

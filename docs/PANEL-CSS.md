# Arkusz CSS prywatnego panelu HOME SECURITY

## Gdzie jest wygląd panelu

| Co | Plik | Uwagi |
| --- | --- | --- |
| Prywatny panel po zalogowaniu, PIN, kamera, nagrania, ustawienia, telefon/PWA i program Windows | `kamera/panel.css` | **Jedyny** arkusz panelu. Ładowany przez `<template id="panelStyles">` w `kamera/panel.html` (wstrzykuje go `kamera/panel-entry.mjs`). Windows pakuje cały `kamera/` (`desktop-client/HomeSecurityDesktop.csproj`), więc używa tego samego pliku. |
| Publiczna strona startowa w `panel.html` i podstrony | `kamera/marketing*.css`, `kamera/tech-theme.css`, `kamera/mobile-home.css`, `kamera/mobile-app-splash.css` | Osobny system strony publicznej; generator `scripts/build-marketing.mjs`. Nie dokładaj tu stylów panelu. |
| Dokumenty prawne i `nagrania.html` | `kamera/style.css`, `kamera/workspace-ui.css`, `kamera/legal-premium.css` | `style.css` i `workspace-ui.css` zostały, bo korzystają z nich dokumenty (`scripts/build-documents.mjs`) i `nagrania.html`. Panel ich **nie** ładuje — ich treść jest w sekcjach 01–02 `panel.css`. |

`kamera/panel.css` jest podzielony na 19 sekcji w kolejności kaskady. Każdy nagłówek ma opis i nazwę dawnego pliku, np. `SEKCJA 17: Układ operatora na komputerze (dawniej operator-layout.css)`:

| Sekcja | Zakres |
| --- | --- |
| 01 | Podstawa: zmienne, układ, karty, kamera, PIN, nagrania |
| 02 | Obszar roboczy, nawigacja, fokus klawiatury |
| 03 | Motyw właściciela (komputer i telefon) |
| 04 | Ekrany operatora Windows: pasek boczny, zdarzenia, diagnostyka, archiwum |
| 05 | Logowanie, rejestracja, okno konta |
| 06 | Obszar kamery i kafelki podglądu |
| 07 | Ramka kamery na telefonie |
| 08 | Pulpit komputera: karty urządzeń, przyciski nagrywania |
| 09 | Przeglądarka galerii |
| 10 | Wspólne elementy: przyciski, pola, odznaki |
| 11 | Odsłuch i rozmowa dwukierunkowa |
| 12 | Podgląd na telefonie i orientacja pozioma |
| 13 | Premium Dark Pro (ciemny motyw), wspólny ekran PIN |
| 14 | Dopracowanie kart i nagłówków |
| 15 | Zdalne odblokowanie komputera PIN-em |
| 16 | Tech Ops: kolorystyka i stany |
| 17 | Układ operatora na komputerze |
| 18 | Pulpit główny (dashboard), aktywna pozycja menu |
| 19 | Wygląd aplikacji na telefonie — sekcja końcowa dla telefonu |

Tryby: `html.desktopMode` (komputer/Windows), `html.mobileOwnerMode` + `body[data-mobile-view=…]` (telefon), `html.policeCommand` i `html.usMilitary` (motywy specjalne; reguły motywu standardowego używają `:not(.policeCommand):not(.usMilitary)`).

## Jak zmienić wygląd

1. Znajdź regułę, która **faktycznie** działa: DevTools → element → Styles; numer linii wskazuje sekcję w `panel.css`.
2. Zmień tę deklarację w miejscu. Nie dopisuj na końcu pliku tego samego selektora z nową wartością i nie dokładaj `!important`, żeby „przebić” starszą regułę.
3. Nowy komponent dopisz do sekcji, która odpowiada jego ekranowi. Pamiętaj, że przeniesienie reguły do innej sekcji zmienia kolejność kaskady.
4. **Zakaz** tworzenia nowych plików-nakładek (`new-style.css`, `final-design.css`, `visual-refresh-2.css` itp.). Test `tests/panel-css-single-source.test.mjs` odrzuca nieznane pliki `.css` w `kamera/` oraz martwe deklaracje (ten sam selektor i właściwość nadpisane później w tym samym lub szerszym kontekście).
5. Podnieś numer `?v=` arkusza w obu miejscach naraz: `<template id="panelStyles">` w `kamera/panel.html` oraz lista `SHELL` w `kamera/sw.js`. Numeru wydania PWA (`kamera/version.json`, `CACHE` w `sw.js`) nie zmieniaj bez wydania.

## Jak sprawdzić, że zmiana dotrze do użytkownika

`kamera/sw.js` (od tej zmiany):

- CSS, JS i manifest (`*.css`, `*.js`, `*.mjs`, `*.webmanifest` w `/kamera/`) są pobierane **najpierw z sieci** zapytaniem warunkowym (`cache: no-cache`, zwykle 304). Bez sieci albo przy odpowiedzi dłuższej niż 4 s użytkownik dostaje kopię offline. Opublikowana zmiana jest więc widoczna przy następnym otwarciu, nawet gdy ktoś zapomniał podbić `?v=`.
- Nawigacje (HTML) są pobierane z sieci z rewalidacją HTTP cache. Offline obowiązuje dotychczasowe zachowanie: zapisany `panel.html` lub `index.html`, a gdy go brak — strona 503.
- Instalacja service workera pobiera `SHELL` z pominięciem HTTP cache (`cache: reload`), więc do pamięci offline nie trafia stara kopia.
- Aktywacja usuwa z pamięci arkusze i skrypty spoza bieżącego `SHELL` (np. dawne `operator-layout.css?v=11`). Obrazy i zapisane strony zostają. Nagrania, ustawienia i klucze (IndexedDB, localStorage, sessionStorage) nie są dotykane.

Po publikacji:
1. `curl -s https://dominiksolorz.github.io/kamera/panel.html | grep panelStyles -A3` — adres `panel.css?v=N` musi być nowy.
2. `curl -sI "https://dominiksolorz.github.io/kamera/panel.css?v=N"` — 200.
3. W przeglądarce: DevTools → Application → Service Workers (aktywny nowy `sw.js`), Network → `panel.css` (z sieci lub 304).
4. Testy: `node --test tests/*.test.mjs` (w tym `panel-css-single-source`, `sw-fresh-assets`).

## Historia: konsolidacja z 10.11.2026

Wcześniej panel ładował 19 arkuszy (`style.css` … `mobile-app-look.css`, ok. 557 KB, 13 435 deklaracji, 2 662 `!important`). Zostały scalone w `panel.css` w tej samej kolejności kaskady. Usunięto 1 430 deklaracji, które nigdy nie działały (w tym 263 identyczne duplikaty i 290 `!important`), oraz 285 pustych reguł. Pozostało 12 005 deklaracji i 2 372 `!important`.

Pozostałe `!important` nie zostały zdjęte automatycznie: wiele z nich wygrywa z `style=""` ustawianym przez JavaScript (kamera, mapa, nagrania), czego nie da się udowodnić statycznie. Zdejmuj je pojedynczo, przy okazji edycji danego komponentu, z testem na telefonie i komputerze.

Równoważność sprawdzono w Chrome: computed style każdego elementu oraz `::before`/`::after` na DOM-ie zbudowanym przez prawdziwy panel (telefon i komputer), we wszystkich trybach (`desktopMode`, zwinięty pasek, `policeCommand`, `usMilitary`, `mobileOwnerMode` z 10 widokami, ustawienia, `cameraPc`/`archiveOpen`, `publicLanding`), dla szerokości 320–1920 px i krótkiego okna 1280×600, z ukrytymi sekcjami w stanie naturalnym i odsłoniętym.

# Układ panelu HOME SECURITY — etap 1 (analiza i struktura)

Wzór graficzny: zrzut panelu operatora z menu bocznym, siatką kamer, alarmami, mapą,
paskiem statystyk i listą zdarzeń. Pliki w tym folderze to **własna implementacja**
układu, nie kod żadnej istniejącej strony. Nazwa i znak wzoru nie są używane.

Folder `design/panel-layout/` **nie jest publikowany** (`pages.yml` wyklucza `/design/`)
i **nie uruchamia wydania Windows** (workflow reaguje tylko na `design/marketing/**`
i `design/documents/**`). Etap 1 nie zmienia żadnego pliku w `kamera/`.

## Co jest w folderze

| Plik | Rola |
| --- | --- |
| `index.html` | Docelowa struktura: menu boczne, pasek górny, kamery, alarmy, mapa, statystyki, zdarzenia, widoki podrzędne. Atrybut `data-hs-source` wskazuje źródło danych w obecnym panelu. |
| `style.css` | Wygląd i układ responsywny (komputer, tablet, telefon). Bez zewnętrznych czcionek i obrazów. |
| `app.js` | Tylko interakcje projektu: widoki, zwijanie menu, szuflada na telefonie, motyw, okienka, siatka 1/4/6, pełny ekran kafelka, filtr, przybliżanie siatki mapy, wyszukiwanie w menu. Zero żądań sieciowych. |

Bez danych przykładowych każde pole pokazuje `—` i opis „niepodłączone”. Dane przykładowe
włącza się świadomie w Ustawieniach; wtedy widać żółty baner „DANE PRZYKŁADOWE”, a każda
nazwa zaczyna się od „PRZYKŁAD”.

## Analiza obecnego panelu

- `kamera/panel.html` — 171 identyfikatorów, z czego 115 w `<main id="app">`.
  Moduły ładowane z `<template id="panelRuntime">`: `vendor/supabase.js`, `auth.js`,
  `auth-experience.mjs`, `app.js`, `desktop.js`, `mobile.js`; style z `<template id="panelStyles">`.
- `kamera/app.js` — 2839 linii, `$()` = `getElementById`, ponad 200 odwołań do identyfikatorów.
- `kamera/desktop.js` — buduje pasek boczny (`.desktopSidebar`, `.desktopNav`) **poza** `#app`
  i przenosi istniejące elementy między ekranami. Szuka po klasach: `.mainCol`, `.layout`,
  `.topbar`, `.nav`, `.panelHead`, `.row`, `.deviceFields`.
- `kamera/mobile.js` — przełącza widoki klasą `.mobileHidden` na liście identyfikatorów
  (`mobileOverview`, `stage`, `dvrCard`, `setCard`…), dopina elementy do `.mainCol`.
- `kamera/style.css` i inne arkusze używają selektorów potomka bezpośredniego, np.
  `.mainCol[class*="focus-"]>.stage`, `.desktopMode .mainCol[data-desktop-view="live"]>#stage`.

**Wniosek:** dodanie nowej obudowy wokół istniejących elementów w `panel.html` przerwałoby
selektory `>` i przenoszenie elementów w `desktop.js` / `mobile.js`. Dlatego etap 1 zostawia
`panel.html` bez zmian, a strukturę przygotowuje obok, z mapą źródeł.

### Mechanizmy, których etap 1 nie dotyka

| Obszar | Pliki |
| --- | --- |
| Logowanie | `auth.js`, `auth-experience.mjs`, `#authDialog`, `#loginForm` |
| PIN | `lock.js`, `access.js`, `account-security.mjs`, `#lock`, `.keypad` |
| Nagrywanie | `app.js` (MediaRecorder), `recording-*.mjs`, `recstore.js`, `#ctrlStart`, `#ctrlStop`, `#ctrlRestart` |
| Aktualizacje PWA | `sw.js`, `core/web-updates.mjs`, `version.json` |
| Samoaktualizacja komputera-kamery | `app.js` (sprawdza `version.json`, domyka bieżący plik) |
| Aktualizacje Windows | `desktop-update.json`, `desktop-client/Program.cs`, `desktop-scheduled-release.yml` |

## Mapa obszarów → obecne źródła

| Obszar projektu | `data-hs-source` | Stan w obecnym wydaniu |
| --- | --- | --- |
| Menu boczne | `desktop.js: .desktopSidebar / .desktopNav` | Istnieje: Pulpit, Sterowanie, Zdarzenia, Nagrania, Ustawienia, Diagnostyka |
| Mapa, Analityka, Raporty | — | **Brak funkcji** — w projekcie oznaczone „brak” |
| Pasek górny i stan | `.topbar`, `#topStatus`, `.desktopTopStatus` | Istnieje |
| Wyszukiwanie | `desktop.js: #desktopSearchInput` | Istnieje (zdarzenia i nagrania) |
| Zegar | `#monitorTime`, `#monitorDate` | Istnieje |
| Siatka kamer | `#stage`, `#video`, `#liveBadge`, `#recBadge`, `core/camera-catalog.mjs`, `camera-workspace.mjs` | Jedna transmisja na żywo; katalog kamer istnieje |
| Alarmy systemu | `#status`, `#recStatus`, `#diagList`, `core/operator-status.mjs` | Istnieją komunikaty stanu |
| Ostatnie zdarzenia | `#viewEvents`, `#pcEvents`, `workspace-panels.mjs: mountEventWorkspace` | Istnieje (ruch i dźwięk) |
| Przegląd systemu | `#systemPanel`, `#systemStateBadge`, `#diagSum`, `operator-status.mjs` | Istnieje |
| Dysk / miejsce zapisu | `#archiveInfo`, `#archiveStoragePanel`, `#recordingStorageChoice`, `#driveBackupStatus` | Istnieje |
| Agent Windows | `communication/agent-telemetry.mjs` | Istnieje |
| Sieć | `core/peer-diagnostics.mjs` | Istnieje (WebRTC) |
| Detekcja | `#detectToggle`, `#detectSound`, `#sensitivity` | Istnieje (ruch, dźwięk); brak rozpoznawania obiektów |
| Konto / wylogowanie | `auth.js`, `#lockBtn` | Istnieje |
| Pasek statystyk | `camera-catalog.mjs`, `#viewEvents`, `agent-telemetry.mjs` | Częściowo; transfer wymaga nowego pomiaru |
| Diagnostyka | `#diagCard`, `#diagSum`, `#diagTime`, `#diagList` | Istnieje |
| Aktualizacje | `core/web-updates.mjs`, `version.json`, `desktop-update.json` | Istnieje, bez zmian |

## Propozycja etapu 2 (do zatwierdzenia)

1. Nowy arkusz ładowany po `tech-ops.css` w `panelStyles`, który nadaje istniejącym
   elementom ten układ (siatka pulpitu, prawa kolumna alarmów i zdarzeń, pasek statystyk)
   **bez przenoszenia ich w DOM**.
2. Ewentualne nowe kontenery tworzone w `desktop.js` tylko obok istniejących, z testem,
   że każdy identyfikator z `panel.html` pozostaje i działa.
3. Mapa, Analityka i Raporty zostają ukryte albo wyraźnie oznaczone, dopóki nie ma danych.
4. Testy: istniejące 450+ testów, nowy test układu, zrzuty na 360–1440 px, ręczna próba
   na komputerze z kamerą (podgląd, start/stop zapisu, PIN, aktualizacja).

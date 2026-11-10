# HAEM: audyt warstw CSS i widoczności aktualizacji

Stan wstępny, bez usuwania reguł przed testami renderowania.

## Potwierdzone fakty

- `kamera/panel.html` ładuje 24 zewnętrzne arkusze CSS i zawiera blok `<style>`. Kolejność ma znaczenie; część arkuszy używa `!important`.
- `kamera/index.html` ładuje osobne style marketingowe. `kamera/marketing.css` deklaruje, że dotyczy marketingu, a mimo to jest też ładowany w `panel.html`; należy sprawdzić, czy jest potrzebny dla publicznego widoku panelu.
- `kamera/operator-layout.css` (ok. 75 KB), `kamera/dashboard-design.css` (ok. 20 KB), `kamera/visual-refresh.css` (ok. 11 KB) i `kamera/premium-dark-pro.css` (ok. 9 KB) zawierają reguły prezentacji panelu. Wspólny zakres wymaga analizy kaskady; nie dowodzi automatycznie, że którykolwiek cały plik jest zbędny.
- `kamera/sw.js` używa `kamera-domowa-shell-v289` i dla zasobów innych niż nawigacje stosuje cache-first. `kamera/version.json` zawiera 289. Przy zmianach CSS trzeba synchronizować numerowane URL w HTML i SHELL oraz przeprowadzić faktyczną procedurę wydania.

## Mapa obszarów

| Obszar | Punkt wejścia | Pliki do weryfikacji |
| --- | --- | --- |
| Publiczna strona | `kamera/index.html` | `kamera/marketing.css`, `scripts/build-marketing.mjs`, marketingowe arkusze |
| Prywatny panel | `kamera/panel.html` | `kamera/style.css`, `kamera/workspace-ui.css`, `kamera/interface-theme.css`, `kamera/interface-concept.css` |
| Układ desktop | `kamera/panel.html` | `kamera/operator-layout.css`, `kamera/dashboard-design.css`, `kamera/desktop-product.css` |
| Nakładki wizualne | `kamera/panel.html` | `kamera/premium-dark-pro.css`, `kamera/visual-refresh.css`, `kamera/reference-ui.css` |
| Telefon / PWA | `kamera/panel.html` | `kamera/mobile-viewer.css`, `kamera/mobile-app-look.css`, `kamera/mobile-camera-frame.css`, `kamera/sw.js` |

## Kryteria bezpiecznego usunięcia

1. Wskaż identyczny lub faktycznie nadpisany selektor i deklarację wraz z kolejnością i specyficznością.
2. Sprawdź HTML, JS, media queries, `[hidden]`, wszystkie tryby oraz pakiet Windows.
3. Porównaj zrzuty ekranów przed i po na desktopie i telefonie; uruchom testy repozytorium.
4. Usuń wyłącznie potwierdzone zbędne deklaracje, nie kasuj arkusza na podstawie nazwy.
5. Zsynchronizuj wersjonowanie zasobów i test aktualizacji PWA online/offline. Dopiero potem PR do zatwierdzenia i wydanie.

## Stan realizacji

Audyt (gałąź `chore/haem-css-ownership-audit`) został zrealizowany na gałęzi `chore/haem-panel-css-consolidation-2026-11-10`:
- 19 arkuszy z `<template id="panelStyles">` scalono w `kamera/panel.css` w kolejności kaskady. Usunięto 1 430 dowodliwie martwych deklaracji i 285 pustych reguł. Wynik zweryfikowano porównaniem computed style w Chrome (szczegóły: [PANEL-CSS.md](PANEL-CSS.md)).
- 17 dawnych plików panelu usunięto z repozytorium; `style.css` i `workspace-ui.css` zostały dla dokumentów i `nagrania.html`.
- `kamera/sw.js`: CSS/JS najpierw z sieci, instalacja z pominięciem HTTP cache, usuwanie nieużywanych arkuszy z pamięci offline.
- Arkusze marketingowe nadal ładują się w `panel.html` (strona startowa w tym samym dokumencie) i pozostają aktywne po wejściu do panelu. Ich ewentualne wyłączenie po zalogowaniu to osobna zmiana z testem wizualnym.

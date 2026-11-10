# Instrukcje dla agentów — repozytorium 01: HOME SECURITY

Zakres wyłącznie `DominikSolorz/dominiksolorz.github.io`. Nie wykonuj zmian w LinkTalk ani LinkTalk-Releases bez wyraźnego osobnego zadania.

Jeśli użytkownik poda alias typu `HS-PANEL`, `HS-TELEFON` lub `HS-AKTUALIZATOR`, rozwiąż go przez [AGENT-SHORTCUTS.md](AGENT-SHORTCUTS.md), a następnie sprawdź dokładne ścieżki i zależności.

**Zawsze zacznij od:** `README.md`, `docs/REPO-MAP.md` i `docs/RELEASE-MAP.md`. Domyślna gałąź docelowa: `main`; pracuj na osobnej gałęzi i używaj PR.

## Wyznaczanie celu
1. Użytkownik mówi „strona główna” → źródło: `kamera/marketing.css`, `kamera/index.html`, generator `scripts/build-marketing.mjs`. Odnajdź rzeczywiste źródło zamiast ręcznie modyfikować wygenerowane HTML.
2. „Program Windows” → `desktop-client/Program.cs` i komponenty `desktop-client/`; przy zmianach w interfejsie także lokalnie pakowany `kamera/panel.html` i `kamera/app.js`. `app.js` w korzeniu to INNY plik.
3. „Telefon” → `kamera/mobile.js` / `kamera/sw.js` / pliki mobile CSS. Nie myl PWA z natywnym `native-mobile/`.
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
- Przed edycją znajdź źródłowy plik, wszystkie odwołania w HTML/JS oraz kolejność ładowania arkuszy. Nie dodawaj kolejnego pliku CSS ani !important tylko po to, by ominąć poprzednią regułę.
- Oddziel stronę marketingową (kamera/marketing.css i generator) od prywatnego panelu (kamera/panel.html), Windows i mobilnej PWA. Nie zakładaj, że ostatni arkusz jest źródłem prawdy.
- Przed usunięciem selektora zbadaj wszystkie jego użycia, media queries, specyficzność, tryby policeCommand/usMilitary i wpływ na PIN, kamerę oraz nagrywanie. Usuwaj tylko potwierdzone duplikaty.
- Po zmianach sprawdź URL ?v= w HTML, listę SHELL i CACHE w kamera/sw.js oraz manifest kamera/version.json. CSS jest obsługiwany cache-first, więc commit nie gwarantuje widocznej aktualizacji. Nie zmieniaj numeru wydania bez faktycznej publikacji.
- Testuj desktop, telefon, PWA, tryby specjalne i atrybut hidden. Zmiany wyłącznie na osobnej gałęzi i przez PR.
- Mapa odpowiedzialności i wykryte ryzyka: docs/CSS-OWNERSHIP-AUDIT.md.

## Zakończenie zadania
Podaj repo, pełne ścieżki plików, gałąź, PR, uruchomione testy, numer rzeczywiście opublikowanego wydania oraz kanał (GitHub Pages / Windows / Vercel / PWA). Jeśli nie ma testu na fizycznym komputerze, napisz o tym otwarcie. Nie deklaruj gotowej publikacji na podstawie samego commita.

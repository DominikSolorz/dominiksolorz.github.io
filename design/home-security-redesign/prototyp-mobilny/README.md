# HOME SECURITY — podgląd aplikacji mobilnej w przeglądarce

Publiczny podgląd po wdrożeniu: https://dominiksolorz.github.io/podglad-mobilny/

Otwórz link w Safari lub Chrome na telefonie. Nie trzeba mieć aplikacji Android. Na komputerze podgląd ma szerokość telefonu; na telefonie wypełnia dostępny ekran. Można też dodać go do ekranu głównego jako osobny podgląd.

## Pełna ścieżka testowa

1. Oczekiwanie: trzy banery po 10 sekund, licznik i pasek postępu. „Pomiń oczekiwanie” od razu otwiera stronę główną.
2. Po pełnej prezentacji pojawia się krótki ekran startowy z pierwszej makiety, a następnie strona główna/wprowadzenie.
3. „Zaloguj się” otwiera formularz z wpisanymi danymi pokazowymi. Pola są edytowalne. Nie używaj prawdziwego hasła.
4. Po formularzu wpisz PIN pokazowy **1234**. Działa klawiatura ekranowa, kasowanie i klawiatura komputera. Błędny PIN pokazuje informację.
5. Po PIN-ie otwiera się pulpit. Działają przejścia do kamer, nagrań i ustawień oraz dolna nawigacja.
6. „Od początku” powtarza całą prezentację. W ustawieniach można wylogować się z podglądu. Przycisk Wstecz przeglądarki zachowuje kolejność ekranów; automatyczne przejścia nie dodają pustych etapów historii.

Osiem widoków odpowiada załączonym makietom: start, wprowadzenie, logowanie, PIN, pulpit, kamery, nagrania, ustawienia. Reklamy są osobnym etapem oczekiwania.

## Zakres demonstracji

Podgląd służy do testowania wyglądu i przejść. Dane formularza i PIN nie są zapisywane ani wysyłane do Supabase. Zdjęcia i miniatury są przykładami. Wpisanie 1234 otwiera wyłącznie demonstracyjny pulpit, bez dostępu do konta, kamery i nagrań. Odcisk palca, chmura, profil i zdarzenia pokazują jedynie informację o zakresie podglądu. Prawdziwy panel pozostaje pod `kamera/panel.html`.

Oryginalny baner i obraz kamery pochodzą z ZIP-a `HS_8_EKRANOW.zip` przekazanego przez użytkownika. Pliki `kamera/`, logowanie produkcyjne, PIN produkcyjny, nagrywanie i instalator Windows pozostają niezależne od tego podglądu.

## Uruchomienie i weryfikacja

Lokalnie: `python3 -m http.server -d design/home-security-redesign/prototyp-mobilny`.

Przełącznik wszystkich ekranów do porównywania makiet: `?demo=1`. Zwykły link uruchamia pełny przebieg. Bez trybu porównania bezpośredni odnośnik do pulpitu wymaga przejścia demonstracyjnego formularza i PIN-u; nie stanowi to prawdziwego uwierzytelniania.

Test przeglądarkowy, z Playwright dostępnym w środowisku: `CHROMIUM_PATH=/usr/bin/chromium node scripts/verify-mobile-walkthrough.cjs`. Zmienna `HS_PREVIEW_URL` pozwala sprawdzić ten sam przebieg na opublikowanym podglądzie. Test używa wyłącznie danych pokazowych.

Workflow Pages kopiuje wyłącznie ten katalog do `/podglad-mobilny/`; pozostała zawartość `design/` nadal jest wyłączona z publikacji.

## Karta „Lokalizacja” (demo)
Schematyczna mapa na Pulpicie jest wyłącznie demonstracyjna (grafika SVG). Aplikacja nie ma obecnie funkcji lokalizacji ani adresu, więc prototyp nie pobiera lokalizacji i nie łączy się z usługą map. Wdrożenie wymaga osobnej decyzji (źródło danych, zgoda, prywatność).

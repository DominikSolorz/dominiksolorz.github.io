# Etap 3: przygotowanie zgłoszenia HOME SECURITY
Stan sprawdzony 9 listopada 2026. Dokument roboczy, nie potwierdzenie publikacji ani zgodności.

## Stan
Play Console dla konta właściciela otwiera formularz rejestracji dewelopera z wyborem konta osobistego albo organizacji. Typ nie został wybrany, konto deweloperskie ani aplikacja nie zostały utworzone.
Etap 1: PR #210, wariant Play i AAB. Etap 2: PR #211, obsługa błędów, lokalizacja i ikona. Oba PR wymagają scalenia przed przygotowaniem docelowego wydania. Testy tych gałęzi nie oznaczają, że zmiany są opublikowane.

## Materiały do formularzy
Opis oraz wykaz grafik: [LISTING.md](LISTING.md). Przed zgłoszeniem porównać zrzuty i opis z dokładnie tym podpisanym AAB, które trafi do Google.
Polityka prywatności: https://dominiksolorz.github.io/kamera/polityka-prywatnosci.html
Wniosek o usunięcie konta: https://dominiksolorz.github.io/kamera/usun-konto.html
Proponowana kategoria: Dom i wnętrze. Proponowany odbiorca: osoby dorosłe. To propozycje do zatwierdzenia, nie wypełnione formularze.
Ocenę treści należy uzyskać po rzeczywistym wypełnieniu kwestionariusza. Nie wpisywać z góry wyniku oceny.
Deklarację reklam sprawdzić również dla treści ładowanych w WebView i mobilnego ekranu startowego. Sama obecność slajdów nie rozstrzyga, czy zawierają reklamy.

## Bezpieczeństwo danych: szkic wymagający weryfikacji
Zakres obejmuje aplikację natywną oraz kontrolowaną przez projekt stronę WebView. Nie zaznaczać zbiorczo „nie zbieramy danych”.

Konto: sprawdzić e-mail, identyfikator użytkownika, dane profilu i mechanizmy logowania w Supabase. Cel roboczy: zarządzanie kontem i funkcjonalność aplikacji. Dokładny zakres zależy również od dostawcy logowania.
Lokalizacja: mapa jest opcjonalna. W etapie 2 aplikacja obsługuje zgodę na pozycję przybliżoną lub dokładną. W module kamera/location-history.mjs opcjonalna historia wysyła owner_id, device_id, etykietę urządzenia, lat, lon, accuracy i recorded_at do hs_location_points. Są to dane zapisane, a nie wyłącznie chwilowe przetwarzanie.
Retencja tras: komentarz kodu podaje 30 dni, ale klient wywołuje hs_prune_location_points przy start(). Przed zadeklarowaniem gwarantowanego terminu sprawdzić funkcję SQL, harmonogram usuwania, kopie zapasowe i rzeczywiste ustawienia serwera.
Mapa korzysta z zewnętrznych usług mapowych. Sprawdzić zakres zapytań, obszar mapy, wyszukiwania, adresy IP oraz rolę dostawców przed odpowiedzią na pytanie o udostępnianie danych.
Obraz, dźwięk i nagrania: sprawdzić rzeczywistą drogę transmisji, serwery pośredniczące, archiwum oraz opcjonalny Google Drive. Nie zakładać, że transmisja między urządzeniami zwalnia z deklaracji.
Identyfikatory urządzenia: moduł historii generuje UUID przechowywany lokalnie i wysyła go przy zapisie trasy. Uwzględnić go w ocenie kategorii identyfikatorów.
Wsparcie i diagnostyka: sprawdzić zawartość formularzy kontaktowych oraz logów backendu. Nie zakładać braku zbierania tylko dlatego, że nie dodano SDK analitycznego.
Szyfrowanie w transmisji, brak udostępniania, obowiązkowość poszczególnych danych oraz cele przetwarzania wymagają potwierdzenia dla wszystkich faktycznie używanych ścieżek.

## Usuwanie konta
Obecna strona uruchamia procedurę zgłoszenia i potwierdzenia właściciela, nie natychmiastowe usunięcie.
Przed zgłoszeniem przetestować na oddzielnym koncie: formularz, odbiór prośby, potwierdzenie właściciela, usunięcie konta i powiązań po stronie serwera, historii lokalizacji, zakończenie sesji i wiadomość potwierdzającą. Sprawdzić rzeczywistą retencję oraz wyjątki.
Nagrania na komputerze i prywatnym Google Drive są opisane na stronie jako usuwane osobno przez użytkownika. Zweryfikować zgodność z rzeczywistą integracją.
Nie obiecywać usuwania danych z serwera bez sprawdzonej procedury wykonania.

## Warunki zakończenia etapu
Właściciel wybiera typ konta i kończy wymaganą rejestrację. Następnie można utworzyć aplikację w konsoli, uzupełnić materiały i deklaracje po weryfikacji, dodać sprawdzony dostęp dla recenzenta oraz podpisać właściwy AAB.
Danych testowego konta nie umieszczać w repozytorium. Wzór instrukcji: [REVIEWER-ACCESS.md](REVIEWER-ACCESS.md).
Ten dokument nie tworzy konta testowego, środowiska demonstracyjnego, podpisanego wydania ani testu zamkniętego.

## Źródła Google
https://support.google.com/googleplay/android-developer/answer/10787469?hl=en
https://support.google.com/googleplay/android-developer/answer/15748846?hl=en
https://support.google.com/googleplay/android-developer/answer/9859455?hl=en

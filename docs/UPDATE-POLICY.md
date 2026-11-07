# HOME SECURITY — aktualizacje: stan obowiązujący

Dokument odświeżony 7.11.2026. Dawny opis sprawdzania co 6 godzin i wymaganego ręcznego restartu jest nieaktualny dla Windows 1.4.58 i nowszych. Aktualny numer wydania sprawdzaj w `kamera/desktop-update.json`, a nie w tym dokumencie.

## Kto tworzy nowe wydanie

`.github/workflows/desktop-scheduled-release.yml` sprawdza, czy zmieniły się źródła wymagające nowego natywnego wydania; ma też harmonogram czterech kontroli dziennie i możliwość ręcznego uruchomienia. To budowanie i publikowanie na GitHub, NIE aktualizacja komputera użytkownika. Workflow zapisuje numer Windows, instalator i ZIP oraz sumy SHA-256 w manifeście. Nie nadpisuj tego ręcznie.

## Co robi zainstalowany Windows

W wersji 1.4.58+ program sprawdza dostępność przy starcie, co 10 minut podczas działania i po powrocie do aktywnego okna, z ograniczeniem częstotliwości. Nowa wersja wyświetla wyraźne pytanie po lokalnym odblokowaniu PIN-em. Pobieranie wymaga zgody. Po pobraniu i weryfikacji SHA-256 program żąda zapisania ostatniego fragmentu nagrania, a dopiero po potwierdzeniu uruchamia zewnętrzny, rollback-safe instalator. Ten czeka na zamknięcie głównego procesu, wymienia pliki i automatycznie wznawia aplikację.

Brak potwierdzenia zapisu, błąd sprawdzania, przerwa internetowa lub brak gotowego panelu NIE powinny wymuszać zamknięcia programu. W takim przypadku zweryfikowany pakiet pozostaje do ponownej próby „Zainstaluj teraz”. W trakcie instalacji powstaje przerwa w bieżącym podglądzie, dlatego zamknięcie nagrywania musi być bezpieczne. Aktualizator nadal wymaga testu na konkretnym fizycznym komputerze i nie może gwarantować zerowej przerwy.

Starsze instalacje mogą posiadać poprzedni kod aktualizatora i przy pierwszym przejściu na 1.4.58 wymagać ręcznego ponownego uruchomienia. Zainstalowanie nowej wersji nie następuje od samego opublikowania ZIP.

## Telefon i strona

Panel PWA ma własny bezpieczny mechanizm cache i wersję `kamera/version.json`; nie należy wymuszać odświeżenia trwającego nadawania ani niezapisanego formularza. Publiczna kopia Vercel posiada oddzielny numer `hosting/public-site/release.json` i nie publikuje prywatnego panelu kamer.

## Zakazy i weryfikacja

Nie utożsamiaj wersji Windows, PWA i Vercel. Nie przepisuj manifestu ani sum SHA-256 ręcznie. Nie kasuj archiwalnych ZIP, EXE ani punktów rollbacku bez audytu. Po zmianie wymagane są testy, zbudowany instalator, sprawdzenie manifestu i publicznego URL oraz — jeżeli ogłaszamy działanie na komputerze — test na fizycznym urządzeniu.

Pełna mapa: [RELEASE-MAP.md](RELEASE-MAP.md).

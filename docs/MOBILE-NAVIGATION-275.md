# HOME SECURITY — osobne ekrany telefonu, panel 275

Repozytorium: DominikSolorz/dominiksolorz.github.io. Gałąź: fix/mobile-single-screen-navigation.

Podstawa: zdjęcia użytkownika z panelu 274. Nagłówek miał cztery kolumny, a etykieta iPhone/iPad nachodziła na markę. Trzy kropki rozwijały pozycjonowany absolutnie panel z aktualizacjami, profilem i mini-oknem nad pulpitem. Zmiana układu urządzenia otwierała dodatkową nakładkę. Dolna nawigacja powielała funkcje kafelków i zasłaniała treść.

## Zmiana

- kamera/mobile.js: trzy kolumny nagłówka (logo, marka/stan, menu); usunięty dolny pasek. Menu, wygląd urządzenia, aktualizacje i mini-okno to osobne widoki obsługiwane przez istniejący router. W każdym widoku poza pulpitem działa Wróć do pulpitu. Ponowne naciśnięcie menu wraca do poprzedniego widoku.
- kamera/mobile.js: Chmura pokazuje wyłącznie konfigurację zapisu/Google Drive, Nagrania wyłącznie odtwarzacz i archiwum. Zachowano istniejące kontrolki, ich identyfikatory i obsługę; nie duplikowano wideo ani nie modyfikowano mechanizmu zapisu. Profil i wylogowanie korzystają z oryginalnych przycisków; profil pozostaje osobnym ekranem pełnej wysokości. Zdalne odblokowanie jest dostępne w Ustawienia → Dostęp zdalny.
- kamera/mobile-app-look.css: odstępy nagłówka, normalny przepływ stron zamiast absolutnej nakładki, brak pustego miejsca po stopce, czytelne opcje na wąskim ekranie. Etykieta urządzenia i numer wersji są w Aktualizacjach; wybór urządzenia w Ustawienia → Wygląd i urządzenie.
- kamera/version.json, kamera/app.js, kamera/panel.html, kamera/sw.js i desktop-client/Program.cs: panel 275, cache PWA 195, nowe wersje zasobów. Instalator jest wersjonowany wyłącznie przez workflow wydania.

## Weryfikacja

508 testów Node. scripts/verify-real-mobile-layout.cjs sprawdza rzeczywiste moduły na 390×844, 320×568, 844×390 i 1280×900: logowanie, błędny i poprawny PIN PBKDF2, sześć kafelków, brak dolnego paska, menu zastępujące pulpit, osobne strony wyglądu/aktualizacji/mini-okna, brak poziomego przepełnienia i zachowanie pierwotnego elementu wideo. Odpowiedzi konta są izolowanymi atrapami. scripts/verify-google-login.cjs weryfikuje nadal Google PKCE i obowiązkowy PIN bez używania konta produkcyjnego.

Zrzuty przeglądarki służą ocenie rzeczywistego układu, nie zastępują testu na fizycznym iPhonie użytkownika. Publikację Pages oraz numer instalatora Windows należy potwierdzić po zakończeniu workflow.

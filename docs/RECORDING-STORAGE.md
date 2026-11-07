# Miejsce zapisu nagrań

Panel „Nagrania → Miejsce zapisu” przekazuje ustawienie do programu Windows. Telefon używa istniejących podpisanych poleceń właściciela, z zaszyfrowanym żądaniem i odpowiedzią. Link odbiorcy nie daje dostępu do tych ustawień. Pierwsza autoryzacja Google wymaga zgody właściciela w przeglądarce systemowej i konfiguracji klienta OAuth aplikacji; sam adres folderu nie nadaje uprawnień.

- **Komputer**: dotychczasowy folder lokalny, z awaryjnym zapisem IndexedDB przy utracie dostępu. Wysyłka natywna jest wstrzymana.
- **Google Drive**: zamknięty segment trafia przez mostek WebView2 do prywatnego `HomeSecurityAgent/recording-spool`. Nie powstaje stała kopia w wybranym folderze lokalnym. To wymaga bufora na komputerze także przy działającym internecie. Uploader wznawia błędy i usuwa wyłącznie zgodny plik bufora po serwerowym potwierdzeniu ID, rozmiaru i MD5. Materiały w chmurze otwiera przycisk wybranego folderu Drive.
- **Komputer i Google Drive**: pozostaje stałe archiwum lokalne, a osobny bufor obsługuje wysyłkę i ponowienia. Usuwana jest tylko kopia bufora.

Polityka jest trwała w `HomeSecurityAgent/recording-storage.json`; tokeny pozostają w natywnym magazynie DPAPI. Przy aktualizacji istniejąca konfiguracja `drive-sync.json` jest odczytywana jako dotychczasowy tryb obu miejsc. Dopiero świadome zastosowanie ustawienia przejmuje sterowanie od starego pomocnika. Odłączenie Drive przełącza nowe fragmenty na komputer i zachowuje oczekujące pliki. Zmiana folderu dotyczy nowych fragmentów; stare zadania zachowują swój pierwotny cel. Nie ma migracji ani usuwania wcześniejszych nagrań użytkownika.

Po zamknięciu programu wysyłka z nowego bufora jest kontynuowana po jego ponownym uruchomieniu. Gdy nie ma internetu, bufor może rosnąć: oczekujących plików nie usuwa się automatycznie. Przerwane niekompletne transfery pozostają zachowane do odzyskania; pełne transfery bez potwierdzenia frontendowego są odtwarzane do kolejki przy kolejnym uruchomieniu.

Zablokowanie wcześniej odblokowanego panelu nie zatrzymuje przekazywania segmentów przez tę samą kartę. Zmiana konfiguracji nadal wymaga odblokowanego panelu, a nawigacja unieważnia autoryzację sesji mostka.

Weryfikacja: testy natywnego bufora, testy Google Drive API i rekoncyliacji, izolowany rzeczywisty WebView2 (`--recording-storage-test <raport.json>`), testy frontendowe i układów telefonu. Test WebView2 używa danych syntetycznych i osobnego profilu, nie fizycznej kamery ani produkcyjnego konta Google.

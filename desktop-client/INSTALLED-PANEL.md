# Desktop 1.4.0 — pierwszy etap rozdzielenia wydań

Instalator zawiera EXE i katalog `Panel` z HTML, CSS, JS oraz grafiką. Katalog
instalacji jest wybierany w instalatorze; skróty wskazują EXE w tym katalogu.
Dane pozostają w `%LOCALAPPDATA%\HomeSecurityDesktop`, a folder nagrań nadal
wybiera użytkownik. Odinstalowanie nie ma reguł kasowania prywatnego archiwum.

WebView2 przechwytuje żądania statycznych plików `/kamera/` i czyta zainstalowaną
paczkę. Zachowujemy istniejący origin, aby nie przenosić sesji, PIN-u ani starych
nagrań IndexedDB. Brakujący plik daje 404, nie pobiera cichego zamiennika ze strony.
Wyjątki online to manifest aktualizacji oraz katalogi dystrybucji. Zewnętrzne API
pozostają online; lokalny interfejs NIE oznacza kont i transmisji offline.
Service worker nie rejestruje się w tej powłoce; przy zmianie generacji powłoki
czyszczony jest jedynie cache/service worker, nie dane konta i nagrań.

Nie jest to jeszcze migracja silnika MediaRecorder do agenta. Zamknięcie okna
nie jest obecnie potwierdzonym bezpiecznym sposobem kontynuowania nagrywania.
Nie ogłaszamy też zakończenia logowania Google przez zewnętrzną przeglądarkę.

Przed zastąpieniem działającego procesu trzeba zakończyć i potwierdzić zapis.
Po instalacji sprawdzić diagnostykę `panel-navigation`: `source=installed-bundle`,
wersja 1.4.0. Zweryfikować konto, PIN, wybór folderu i odtwarzanie krótkiego pliku.
Następnie sprawdzić aktualizację i zachowanie wszystkich ustawień. Nie publikować
manifestu automatycznej aktualizacji przed testem tej paczki w działającym WebView2.

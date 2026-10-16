# HOME SECURITY Desktop

Natywna aplikacja Windows dla panelu `HOME SECURITY Desktop`.

- Nie ma paska adresu ani kart przeglądarki.
- Otwiera pełny ekran panelu bez paska adresu i kart; klawisz `F11` przełącza pełny ekran.
- Komputer z tą aplikacją jest jedynym nadajnikiem kamery i miejscem lokalnego archiwum DVR.
- Przy pierwszym zapisie wybierz folder archiwum w module **Nagrywanie**. Nagrania pozostają na tym komputerze.
- Telefon oraz publiczna strona są odbiornikami: oglądają obraz i archiwum udostępniane przez komputer-kamerę, nie przejmują jego kamery.
- Dane programu są trzymane osobno od plików programu w `%LOCALAPPDATA%\HomeSecurityDesktop` (`WebView`, `Diagnostics`, `Updates`). Nie usuwaj tego katalogu, jeżeli chcesz zachować sesję i diagnostykę.
- Właściwy instalator pozwala wybrać katalog programu. Aktualizacje są sprawdzane po uruchomieniu, a pobrana poprawna aktualizacja jest stosowana przy następnym uruchomieniu.

Publikacja lokalna:

Stan przygotowania, 2026-10-16: powłoka natywna wskazuje build panelu 185.
Test zgodności wydania sprawdza ten numer względem manifestu strony. Zmiana
znacznika czyści tylko cache/service worker, nie sesję ani zapisane ustawienia.
Nie oznacza to publikacji nowego instalatora ani zdalnego wdrożenia panelu.

Wiadomości strony zapisywane w diagnostyce są ograniczone do zaufanego dokumentu
i jawnej listy pól: typ, rola, live, recording, at, fps. Dowolny tekst, dane
logowania, argumenty IPC i nieznane pola nie trafiają do dziennika. Starsza
telemetria przesyłana jako JSON-string jest nadal obsługiwana. Szczegółowe
zagnieżdżone raporty WebRTC wymagają osobnego, bezpiecznego schematu, zanim będą
zapisywane natywnie. Istniejących historycznych logów nie usunięto.

Powrót sesji Google z przeglądarki do WebView2 pozostaje niewdrożony. Nie wolno
odblokowywać logowania w osadzonej przeglądarce ani przekazywać tokenów w URL.

```powershell
dotnet publish .\HomeSecurityDesktop.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o .\publish
```

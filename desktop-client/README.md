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

```powershell
dotnet publish .\HomeSecurityDesktop.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o .\publish
```

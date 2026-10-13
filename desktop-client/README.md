# HOME SECURITY Desktop

Natywna aplikacja Windows dla panelu `HOME SECURITY Desktop`.

- Nie ma paska adresu ani kart przeglądarki.
- Uruchamia dołączoną, lokalną kopię panelu — bez paska adresu, kart i zależności od otwartego Chrome.
- Komputer z tą aplikacją jest jedynym nadajnikiem kamery i miejscem lokalnego archiwum DVR.
- Przy pierwszym zapisie wybierz folder archiwum w module **Nagrywanie**. Nagrania pozostają na tym komputerze.
- Telefon oraz publiczna strona są odbiornikami: oglądają obraz i archiwum udostępniane przez komputer-kamerę, nie przejmują jego kamery.

Publikacja lokalna:

```powershell
dotnet publish .\HomeSecurityDesktop.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o .\publish
```

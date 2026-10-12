# HOME SECURITY Desktop

Natywna powłoka Windows dla panelu `HOME SECURITY Desktop`.

- Nie ma paska adresu ani kart przeglądarki.
- Otwiera wyłącznie publiczny panel desktopowy monitoringu.
- Nie uruchamia nadajnika kamery, nie zmienia jakości, nie zatrzymuje nagrywania i nie przechowuje nagrań.
- Telefon korzysta z osobnej PWA pod adresem `?panel=owner&app=android`.

Publikacja lokalna:

```powershell
dotnet publish .\HomeSecurityDesktop.csproj -c Release -r win-x64 --self-contained false -o .\publish
```

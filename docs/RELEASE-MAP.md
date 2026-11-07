# Mapa wydań i adresów HOME SECURITY

Stan orientacyjny z 7.11.2026: instalator Windows `1.4.58`, web/PWA `272`. Numery te są tylko punktem odniesienia — aktualne zawsze odczytuj z manifestów poniżej.

| Co jest wydawane | Gdzie jest prawda o wersji | Źródło / pipeline | Dostęp publiczny |
| --- | --- | --- | --- |
| HOME SECURITY na Windows | `kamera/desktop-update.json` i `desktop-client/Program.cs` | `.github/workflows/desktop-scheduled-release.yml`, `scripts/desktop-release.mjs` | `kamera/pobierz.html`, `kamera/downloads/HOME-SECURITY-Desktop-Setup-<wersja>.exe` |
| ZIP natywnej aktualizacji / rollback | `kamera/desktop-update.json` (`packageUrl`, `sha256`) | wyżej wskazany pipeline | `kamera/updates/HomeSecurityDesktop-<wersja>-win-x64.zip` |
| Prywatny panel + PWA na telefon | `kamera/version.json`; odpowiadające odniesienia w `kamera/panel.html`, `kamera/sw.js`, `kamera/app.js` | `.github/workflows/pages.yml` | https://dominiksolorz.github.io/kamera/panel.html |
| Publiczne podstrony w GitHub Pages | `kamera/index.html`, generator `scripts/build-marketing.mjs` | `.github/workflows/pages.yml` | https://dominiksolorz.github.io/kamera/ |
| Osobna kopia publicznej witryny Vercel | `hosting/public-site/release.json` | `hosting/public-site/vercel-build.mjs`, `vercel.json` | https://home-security-dominik-solorz.vercel.app |

## Podstawowe zasady

1. `main` zawiera kod i wersje zatwierdzone w repozytorium. Nie każdy commit jest instalatorem użytkownika.
2. Automatyczne tworzenie natywnego wydania i sprawdzanie dostępności przez zainstalowany program to dwie osobne rzeczy. Workflow może być uruchamiany cyklicznie, lecz Windows sprawdza manifest przy starcie, co 10 minut i po aktywacji okna.
3. Użytkownik wybiera „Zaktualizuj”. Pakiet jest pobierany i sprawdzany (SHA-256), nagranie bezpiecznie domykane, instalator uruchamiany; program wznawia pracę po aktualizacji. Starszy program może wymagać jednorazowego ręcznego restartu po pierwszym przejściu.
4. Nie kasuj nieużywanych na pierwszy rzut oka plików archiwalnych ZIP/EXE. Mogą być potrzebne do powrotu do poprzedniej wersji.
5. PWA i instalator mają różne numery. Aktualizacja plików PWA **nie dowodzi**, że na komputerze zainstalowano najnowszą wersję EXE.
6. Vercel służy tylko publicznej prezentacji. Nie jest automatycznie takim samym wdrożeniem jak GitHub Pages; prywatne konta i kamery nie są kopiowane na Vercel.
7. Po każdym wdrożeniu sprawdź faktyczny adres, wersję oraz testy CI; nie utożsamiaj stanu `merged` z `READY` ani instalacją fizyczną.

Zobacz także [UPDATE-POLICY.md](UPDATE-POLICY.md) i [AUTOMATIC-INSTALLER-RELEASES.md](AUTOMATIC-INSTALLER-RELEASES.md).

## Repozytoria niezwiązane z wydaniami HOME SECURITY

- `DominikSolorz/LinkTalk`: osobny produkt, kod aplikacji afiliacyjnej.
- `DominikSolorz/LinkTalk-Releases`: publiczne pliki Android LinkTalk, nie instalatory HOME SECURITY Windows.

# 01 / HOME SECURITY — główne repozytorium projektu

**Oficjalny kod:** https://github.com/DominikSolorz/dominiksolorz.github.io  
**Gałąź robocza i źródłowa:** `main`  
**Publiczna aplikacja, panel, PWA, kanał aktualizacji:** https://dominiksolorz.github.io/kamera/  
**Osobna witryna informacyjna Vercel:** https://home-security-dominik-solorz.vercel.app

To repozytorium zawiera cały system monitoringu HOME SECURITY: aplikację Windows, kamerę/nagrania, panel na telefon, stronę informacyjną, połączenia, agenta systemowego, migracje bazy i mechanizm publikacji. Nie jest repozytorium LinkTalk i nie przechowuje jego wydań.

## Dokąd wejść

| Chcę zmienić | Dokładny punkt wejścia |
| --- | --- |
| Stronę główną, ofertę, menu publiczne | `kamera/index.html`, `kamera/marketing.css`, `scripts/build-marketing.mjs` |
| Panel po zalogowaniu, uprawnienia i nagrania | `kamera/panel.html`, `kamera/app.js`, `kamera/auth.js` |
| Widok na telefonie / PWA | `kamera/mobile.js`, `kamera/mobile-viewer.css`, `kamera/sw.js` |
| Ekran PIN | `kamera/lock.js`, `kamera/access.js`, `kamera/account-security.mjs` |
| Odblokowanie Windows z telefonu | `kamera/remote-unlock-host.mjs`, `kamera/remote-unlock-phone.mjs`, `kamera/remote-unlock-protocol.mjs` |
| Windows: instalator, aktualizacje, uruchamianie | `desktop-client/Program.cs`, `desktop-client/installer/`, `.github/workflows/desktop-scheduled-release.yml` |
| Lokalny agent, nagrywanie i Dysk Google | `agent/`, `agent-client/`, `agent-contracts/`, `drive-sync/` |
| Stronę wyłącznie informacyjną Vercel | `hosting/public-site/`, `vercel.json` |
| Supabase | `supabase/migrations/`, `supabase/functions/` |
| Testy i publikację | `tests/`, `scripts/`, `.github/workflows/` |

**Krótkie nazwy zadań dla agentów:** [AGENT-SHORTCUTS.md](AGENT-SHORTCUTS.md).

**Pełna mapa:** [docs/REPO-MAP.md](docs/REPO-MAP.md). **Wersje, adresy i proces publikacji:** [docs/RELEASE-MAP.md](docs/RELEASE-MAP.md). **Zasady dla Codexa i innych agentów:** [AGENTS.md](AGENTS.md).

## Ważne

`app.js` w katalogu głównym **nie jest** tym samym plikiem co `kamera/app.js`. Podawaj agentowi pełną ścieżkę, a nie tylko nazwę pliku. Nie przenoś ani nie zmieniaj nazw działających plików, instalatorów lub manifestów bez poprawienia wszystkich importów, ścieżek, konfiguracji i testów.

Repozytoria **02 / LinkTalk** i **03 / LinkTalk-Releases** są odrębne. Tutaj wersja Windows nie jest wersją PWA ani wersją informacyjnej witryny Vercel. Zajrzyj do mapy wydań przed publikacją.

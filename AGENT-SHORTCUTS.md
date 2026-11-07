# Krótkie nazwy zadań i plików — 01 / HOME SECURITY

Te nazwy są **aliasami dla agentów**, a NIE nazwami plików w repozytorium. Nie przenoś plików, aby dopasować je do aliasu. Zawsze sprawdzaj importy i odpowiedni zakres.

| Powiedz agentowi | Docelowe pliki / źródła |
| --- | --- |
| `HS-STRONA` | `scripts/build-marketing.mjs`, `kamera/index.html`, `kamera/marketing.css` |
| `HS-STRONA-MENU` | `kamera/marketing-navigation.mjs`, `kamera/marketing-navigation.css`, `scripts/build-marketing.mjs` |
| `HS-PANEL` | `kamera/panel.html`, `kamera/app.js` |
| `HS-PANEL-STYL` | `kamera/style.css`, `kamera/premium-dark-pro.css`, `kamera/workspace-ui.css` |
| `HS-PIN` | `kamera/lock.js`, `kamera/auth.js`, `kamera/account-security.mjs` |
| `HS-WINDOWS` | `desktop-client/Program.cs`, `desktop-client/BundledPanel.cs`, `desktop-client/HomeSecurityDesktop.csproj` |
| `HS-AKTUALIZATOR` | `desktop-client/Program.cs`, `scripts/desktop-release.mjs`, `.github/workflows/desktop-scheduled-release.yml` |
| `HS-INSTALATOR` | `desktop-client/installer/`, `desktop-client/build-release.ps1`, `kamera/desktop-update.json` |
| `HS-TELEFON` | `kamera/mobile.js`, `kamera/mobile-viewer.css`, `kamera/sw.js` |
| `HS-TELEFON-PIN` | `kamera/remote-unlock-phone.mjs`, `kamera/remote-unlock-host.mjs`, `kamera/remote-unlock-protocol.mjs` |
| `HS-KAMERY` | `kamera/app.js`, `kamera/camera-workspace.mjs`, `agent/` |
| `HS-NAGRANIA` | `kamera/recording-*.mjs`, `kamera/dvr-ui.js`, `agent/RecordingStorage.cs` |
| `HS-DYSK` | `drive-sync/`, `agent/GoogleDriveApi.cs`, `agent/DriveUploadQueue.cs` |
| `HS-BAZA` | `supabase/migrations/`, `supabase/functions/` |
| `HS-PWA-WERSJA` | `kamera/version.json`, `kamera/sw.js`, `kamera/panel.html` — aktualizuj spójnie |
| `HS-WINDOWS-WERSJA` | `kamera/desktop-update.json` — **tylko workflow wydania**, nie ręcznie |
| `HS-VERCEL` | `hosting/public-site/`, `vercel.json`; wyłącznie publiczna prezentacja |
| `HS-TESTY` | `tests/`, `kamera/tests/`, `.github/workflows/` |

## Gotowe zlecenie

> Repo: `DominikSolorz/dominiksolorz.github.io`. Gałąź bazowa: `main`. Obszar: `HS-AKTUALIZATOR`. Zadanie: popraw komunikat o aktualizacji. Nie zmieniaj kamery ani nagrań, zachowaj SHA-256 i rollback. Uruchom odpowiednie testy, pokaż PR i potwierdź rzeczywiście opublikowaną wersję.

Jeżeli zmiana przechodzi przez dwa obszary, agent ma wypisać wszystkie zależności. Nie wolno zakładać, że sam alias pozwala ominąć kontrolę testów, PIN albo proces release. Pełna mapa: [docs/REPO-MAP.md](docs/REPO-MAP.md).

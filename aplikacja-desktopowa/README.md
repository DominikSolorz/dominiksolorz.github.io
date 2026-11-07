# APLIKACJA DESKTOPOWA — HOME SECURITY Windows

To jest **czytelny punkt wejścia** dla prac nad programem instalowanym na komputerze. Działających plików nie duplikujemy tutaj, bo powstałyby dwie różne wersje tego samego programu.

## Kod programu
- `desktop-client/Program.cs` — główna aplikacja Windows, WebView2, aktualizacje.
- `desktop-client/HomeSecurityDesktop.csproj` — projekt Windows.
- `desktop-client/BundledPanel.cs` — panel pakowany do programu.
- `desktop-client/installer/` — instalator.
- `agent/`, `agent-client/`, `agent-contracts/` — agent kamery, nagrywanie i komunikacja.
- `drive-sync/` — synchronizacja nagrań.

## Aktualizacje
- `kamera/desktop-update.json` — manifest opublikowanej wersji.
- `kamera/downloads/` — instalatory EXE.
- `kamera/updates/` — paczki ZIP aktualizacji/rollbacku.
- `.github/workflows/desktop-scheduled-release.yml` — budowanie i publikacja.

Agentowi można powiedzieć: **„APLIKACJA DESKTOPOWA: zmień aktualizator”**. Najpierw ma przeczytać ten plik i `AGENT-SHORTCUTS.md`. Nie zmieniaj ręcznie sum SHA-256 ani nazw opublikowanych instalatorów.

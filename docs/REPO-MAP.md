# Mapa plików HOME SECURITY (repo 01)

Obowiązują pełne ścieżki od katalogu głównego. Ten dokument opisuje przeznaczenie, a nie przenosi plików. Ścieżki wykonywalne zachowujemy dla istniejących adresów i automatycznych aktualizacji.

| Obszar | Pliki / katalogi | Modyfikować przy |
| --- | --- | --- |
| Oficjalny publiczny HOME SECURITY | `kamera/index.html`, `kamera/o-systemie.html`, `kamera/pobierz.html`, `kamera/kontakt.html`, `kamera/pomoc.html`, `kamera/marketing*.css`, `kamera/marketing*.mjs` | teksty, układ publicznych podstron, stopka, menu, pobieranie |
| Generator publicznej strony | `scripts/build-marketing.mjs`, `scripts/harden-public-pages.mjs`, `scripts/verify-live-marketing.mjs` | wspólne zmiany na wielu generowanych stronach |
| Panel właściciela | `kamera/panel.html`, `kamera/app.js`, `kamera/style.css`, `kamera/premium-dark-pro.css` | nawigacja po zalogowaniu, kamery, sterowanie, integracja UI |
| Telefon / PWA | `kamera/mobile.js`, `kamera/mobile-viewer.css`, `kamera/mobile-camera-frame.css`, `kamera/manifest.webmanifest`, `kamera/sw.js` | widok mobilny, krajobraz, cache, powiadomienie o aktualizacji |
| Uwierzytelnianie | `kamera/auth.js`, `kamera/lock.js`, `kamera/pin.js`, `kamera/access.js`, `kamera/account-security.mjs` | konto, lokalny PIN, ekran blokady |
| Zdalne odblokowanie | `kamera/remote-unlock-host.mjs`, `kamera/remote-unlock-phone.mjs`, `kamera/remote-unlock-crypto.mjs`, `kamera/remote-unlock-protocol.mjs`, `kamera/remote-unlock-device-store.mjs` | parowanie, dowód PIN, zaufane urządzenia |
| Nagrywanie i archiwum | `kamera/recording-*.mjs`, `kamera/recstore.js`, `kamera/recproto.js`, `kamera/dvr-ui.js`, `kamera/recording-storage.mjs` | fragmenty nagrań, odzyskiwanie i odtwarzanie |
| Desktop Windows | `desktop-client/Program.cs`, `desktop-client/HomeSecurityDesktop.csproj`, `desktop-client/BundledPanel.cs`, `desktop-client/installer/` | okno WinForms/WebView2, instalacja, aktualizacje |
| Agent komputera i komunikacja | `agent/`, `agent-client/`, `agent-contracts/`, `agent-tests/` | lokalne zadania i nagrywanie, kontrakty IPC |
| Google Drive | `drive-sync/`, `agent/DriveUploadQueue.cs`, `agent/GoogleDriveApi.cs` | synchronizacja nagrań i uprawnienia |
| Natywne prototypy mobilne | `native-mobile/android/`, `native-mobile/ios/` | aplikacje natywne, NIE zwykła PWA |
| Baza i funkcje serwerowe | `supabase/migrations/`, `supabase/functions/` | schemat, autoryzacja, bezpieczne serwisy |
| Osobna witryna informacyjna Vercel | `hosting/public-site/`, `vercel.json` | tylko statyczna publiczna prezentacja |
| Publikacja i testy | `.github/workflows/`, `scripts/`, `tests/`, `kamera/tests/` | walidacja, wydania, CI |
| Dokumentacja i projekty | `docs/`, `design/` | opisy, koncepcje, plany i zrzuty |
| Inny projekt we wspólnym historycznym drzewie | `nextup/`, `nextup-import.html`, `nextup-base44.html` | NIE edytować podczas prac nad kamerą bez osobnego zlecenia |

## Własne nazwy a kolizje

- `/app.js` ≠ `/kamera/app.js`; `/index.html` ≠ `/kamera/index.html` ≠ `/nextup/index.html`.
- `/kamera/desktop-update.json` to manifest aktualizacji zainstalowanego Windows. `/kamera/version.json` dotyczy web/PWA. `/hosting/public-site/release.json` dotyczy osobnej witryny Vercel.
- `/kamera/downloads/*.exe` oznacza instalatory. `/kamera/updates/*.zip` oznacza pakiety wymiany i rollbacku. Nie zmieniaj ich nazw po opublikowaniu.
- `/kamera/marketing.css` steruje stroną publiczną; `/kamera/style.css` steruje panelem użytkownika. Łączenie ich bez audytu może zepsuć PIN lub kamerę.

## Jak zlecać zmiany agentowi

Najlepszy wzór: „Repo: `DominikSolorz/dominiksolorz.github.io`; gałąź bazowa: `main`; plik: `kamera/mobile.js`; cel: …; zachowaj: PIN, DVR, nagrywanie; przetestuj: …; wynik: PR i potwierdzone wdrożenie”. Jeśli nie znasz pliku, wybierz obszar z powyższej tabeli; nie pozwalaj agentowi zgadywać repozytorium.

# APLIKACJA MOBILNA — HOME SECURITY

Ten katalog jest punktem wejścia do wszystkiego, co użytkownik obsługuje telefonem.

## PWA / strona działająca w przeglądarce telefonu
- `kamera/mobile.js` — zachowanie mobilne.
- `kamera/mobile-viewer.css`, `kamera/mobile-camera-frame.css` — wygląd telefonu i kamery.
- `kamera/sw.js` — cache i aktualizacje PWA.
- `kamera/manifest.webmanifest` — instalowalna PWA.
- `kamera/remote-unlock-phone.mjs` — odblokowanie komputera telefonem.
- `kamera/remote-unlock-host.mjs`, `kamera/remote-unlock-protocol.mjs` — druga strona bezpiecznego połączenia.

## Natywna aplikacja
- `native-mobile/android/` — Android.
- `native-mobile/ios/` — iOS.

## Testy i automaty
Workflowy w GitHub Actions oznaczone **MOBILE** dotyczą tego obszaru. Agentowi można powiedzieć: **„APLIKACJA MOBILNA: popraw widok kamery”**. Ma rozróżnić PWA od aplikacji natywnej i nie zmieniać Windows ani publicznej strony bez potrzeby.

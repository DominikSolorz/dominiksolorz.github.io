# Automaty GitHub — podział po polsku

GitHub wymaga, aby wykonywalne pliki workflow `.yml` leżały **bezpośrednio w `.github/workflows/`**. Nie wolno wkładać ich do podfolderów `desktop/`, `mobile/` i `www/`, bo przestaną być wykrywane. Dlatego podział jest realizowany jednoznacznym prefiksem w polu `name:`.

## DESKTOP
Windows, instalator, aktualizator i agent kamery:
`desktop-scheduled-release.yml`, `desktop-ui-preview.yml`, `desktop-ui220-installer.yml`, `home-security-audio-desktop-preview.yml`, `verify-desktop-update-center.yml`, `verify-native-camera-recording-index.yml`.

## MOBILE
Android, iOS oraz PWA telefonu:
`android-emulator.yml`, `mobile-preview.yml`, `verify-home-mobile-phone.yml`.

## WWW
Publiczna strona, GitHub Pages i Vercel:
`pages.yml`, `pagespeed-audit.yml`, `verify-home-vercel-public.yml`, `verify-pages-public-bundle.yml`, `verify-public-website-premium.yml`.

## WSPÓLNE
Funkcje współdzielone przez kilka powierzchni:
`verify-dvr-time-navigation.yml`, `verify-home-security-audio.yml`, `verify-phone-pin-windows.yml`, `verify-premium-dark-pro.yml`, `verify-unified-ui-remote-pin.yml`.

## ARCHIWUM
`stable-desktop-149.yml` — historyczny proces przygotowania Windows 1.4.9. Nie używać do bieżących wydań. Bieżący release Windows wykonuje `desktop-scheduled-release.yml`.

**Nazwy plików YAML pozostają stabilne**, ponieważ są przywoływane przez filtry `paths`, dokumentację i procesy CI. W GitHub Actions użytkownik widzi natomiast polskie nazwy z kategorią.

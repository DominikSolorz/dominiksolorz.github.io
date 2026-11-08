# Aktualizacje APK Android
Status: stały podpis właściciela skonfigurowany jako zaszyfrowany sekret HOME_SECURITY_ANDROID_SIGNING. Automatyczne wydanie 0.3.x jest blokowane do czasu zaliczenia kompilacji, testów jednostkowych, lint, podpisu i instalacji oraz aktualizacji na emulatorze API 35. Test fizycznego telefonu pozostaje do wykonania.
Opublikowany APK 0.2.0-preview nie zawiera tego kodu.

## Działanie
Sprawdza publiczny HTTPS manifest przy uruchomieniu, wznowieniu i co 10 minut w otwartej aplikacji. Dodatkowy przycisk pozwala sprawdzić ręcznie.
Po zgodzie pobiera APK, ogranicza rozmiar, sprawdza SHA256, identyfikator pakietu, rosnący versionCode i ten sam certyfikat podpisu co zainstalowana aplikacja.
System Android potwierdza instalację. Nigdy nie odinstalowuje poprzedniej wersji ani nie czyści jej danych. Nie instaluje aktualizacji po samym wykryciu nowej wersji.
Brak internetu lub błędny plik pozostawia obecną aplikację.

## Wydanie
Przed pierwszą dystrybucją 0.3.0 trzeba utworzyć lub wskazać trwały keystore właściciela i przechować go poza publicznym repozytorium, z kopią zapasową. Nie używać jednorazowego debug keystore CI.
Gradle obsługuje zmienne HOME_SECURITY_ANDROID_KEYSTORE (ścieżka pliku), HOME_SECURITY_ANDROID_STORE_PASSWORD, HOME_SECURITY_ANDROID_KEY_ALIAS i HOME_SECURITY_ANDROID_KEY_PASSWORD.
Nie zapisuj klucza ani haseł w kodzie, logach, release assets ani opisie PR. W CI wartości muszą pochodzić z zaszyfrowanych secrets.
Nie zmieniaj pakietu ani certyfikatu pomiędzy aktualizacjami.
Przejście z obecnej testowej .preview na produkcyjne pl.solorz.homesecurity będzie osobną pierwszą instalacją. Nie opisuj tego jako aktualizacji istniejącej .preview.

Po podpisaniu i testach fizycznych v3 -> v4, anulowania instalacji, braku uprawnienia instalacji, błędnego hasha i obcego podpisu, opublikuj APK i dopiero wtedy manifest kamera/android-update.json:
```json
{"enabled":true,"schema":1,"packageName":"pl.solorz.homesecurity","versionCode":4,"versionName":"0.3.1","url":"https://github.com/DominikSolorz/dominiksolorz.github.io/releases/download/WLASCIWY_TAG/WLASCIWY_PLIK.apk","sha256":"SUMA_SHA256_OPUBLIKOWANEGO_PLIKU","size":123}
```
Wartości w przykładzie to szablon, nie dane wydania.
Google Play wymaga osobnego kanału aktualizacji i sprawdzenia zasad REQUEST_INSTALL_PACKAGES przed publikacją w sklepie.

## Automatyczna publikacja
`.github/workflows/android-release.yml` uruchamia się po zmianach Androida na main i ręcznie. Podpisuje stałym kluczem, weryfikuje publiczny fingerprint 7707e0ab9616e88ea2e98416d7e6b98f30fdb79f8bd673b083f95b02a4e07d47, buduje następny numer jako próbę aktualizacji i instaluje go na emulatorze przez adb install -r. Tylko po sukcesie publikuje APK i podnosi versionCode w kanale oraz uruchamia Pages. Nie publikuje prywatnego klucza. Numery versionCode są monotoniczne względem numeru przebiegu workflow. Nie zmieniaj nazwy ani licznika tego workflow bez migracji wersjonowania. Kopia klucza znajduje się w prywatnym pliku właściciela, poza repozytorium.

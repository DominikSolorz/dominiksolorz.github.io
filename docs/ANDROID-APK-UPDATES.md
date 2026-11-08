# Aktualizacje APK Android
Status: przygotowany aktualizator 0.3.0, kanał wyłączony do czasu przygotowania stałego podpisu.
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

# Wariant Google Play

`direct` zachowuje identyfikator `pl.solorz.homesecurity`, podpis właściciela
i dotychczasowy aktualizator APK. Instalatory ze strony pozostają w tym kanale.
`play` używa tego samego identyfikatora aplikacji, ale nie kompiluje `AppUpdater`
ani `UpdatePolicy`, nie ma uprawnienia instalacji pakietów, dostawcy plików
aktualizacji ani przycisku pobierania APK. Aktualizacje obsługuje Google Play.

Budowanie: `gradle :app:bundlePlayRelease`. Wynik:
`app/build/outputs/bundle/playRelease/app-play-release.aab`.
Podpis korzysta z istniejących zmiennych `HOME_SECURITY_ANDROID_*`.
Bez klucza lokalny/PR bundle jest niepodpisany i nie nadaje się do wysłania do sklepu.
Nie zmieniaj ani nie zapisuj klucza w repozytorium.

Workflow `android-release.yml` buduje podpisany AAB jako osobny artefakt
`signed-google-play-bundle`. Nie publikuje go automatycznie w Play Console
i nie dodaje go do kanału aktualizacji APK. Zawartość AAB sprawdza
`verify-play-bundle.py`; emulator testuje oba warianty na API 30 i 35.

Oba warianty produkcyjne zajmują to samo miejsce na urządzeniu. Przejście
między kanałami wymaga zgodnego certyfikatu podpisu aplikacji i większego
versionCode. Przy konfiguracji Play App Signing właściciel musi sprawdzić
zgodność klucza podpisywania aplikacji z obecnymi instalacjami. Klucz wysyłania
do Google i klucz podpisywania instalacji nie muszą być tym samym kluczem.
Nie obiecujemy migracji istniejącego APK do Play przed sprawdzeniem tej konfiguracji.

To przygotowanie techniczne, nie publikacja ani akceptacja Google. Pozostają:
rzeczywiste sprawdzenie usuwania konta i danych, deklaracje na podstawie przepływów
danych, konto recenzenta, testy fizycznego telefonu i wymagany proces Play Console.
Ekran błędu sieci już istnieje; ten etap nie wdraża FCM ani geolokalizacji.

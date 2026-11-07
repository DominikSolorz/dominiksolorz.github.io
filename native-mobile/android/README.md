# HOME SECURITY / native-mobile/android

Projekt natywnej aplikacji Android. Nie myl z PWA w kamera/mobile.js.

| Plik lub katalog | Do czego służy |
| --- | --- |
| [`app/`](app/) | Źródła aplikacji Android, manifest, Java, zasoby i testy |
| [`build.gradle`](build.gradle) | Konfiguracja budowania Gradle na poziomie projektu |
| [`gradle.properties`](gradle.properties) | Ustawienia Gradle |
| [`run-emulator-tests.sh`](run-emulator-tests.sh) | Skrypt uruchamiania testów emulatora |
| [`settings.gradle`](settings.gradle) | Rejestr modułów i konfiguracja projektu Gradle |

Kod Java: [MainActivity.java](app/src/main/java/pl/solorz/homesecurity/MainActivity.java), [NavigationPolicy.java](app/src/main/java/pl/solorz/homesecurity/NavigationPolicy.java). Testy: [androidTest/](app/src/androidTest/), [test/](app/src/test/). Pliki zasobów mają nazwy wymagane przez Androida. Nie dodawaj README do katalogów `res/` i `java/` tylko dla estetyki.

## Zasady dla agentów

Przejdź do [README głównego](../../README.md), [mapy kodu](../../docs/REPO-MAP.md) i [instrukcji agentów](../../AGENTS.md). Sprawdź, do czego plik jest używany, przed jego przeniesieniem. Nie zmieniaj publicznych adresów i nazw instalatorów z powodu porządkowania katalogów.

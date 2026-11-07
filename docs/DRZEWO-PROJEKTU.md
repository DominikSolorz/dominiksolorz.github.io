# HOME SECURITY — kompletne drzewo katalogów

To mapa nawigacji po strukturze repozytorium na gałęzi dokumentacyjnej (stan sprawdzony 7.11.2026). **Repozytorium to projekt HOME SECURITY**, a nie zbiór różnych aplikacji. Oddzielny LinkTalk ma swoje repozytorium.

| Katalog (kliknij, aby wejść) | Główna funkcja | Pliki bezpośrednio w folderze | README w folderze |
| --- | --- | ---: | --- |
| [`.github/`](../.github/) | Automaty GitHub i CI | 1 | Tak |
| [`.github/workflows/`](../.github/workflows/) | Automaty GitHub i CI | 21 | Tak |
| [`agent-client/`](../agent-client/) | Klient komunikacji z agentem | 4 | Tak |
| [`agent-contracts/`](../agent-contracts/) | Kontrakty komunikacji agenta | 3 | Tak |
| [`agent-tests/`](../agent-tests/) | Testy natywnego agenta | 10 | Tak |
| [`agent-tests/fixtures/`](../agent-tests/fixtures/) | Testy natywnego agenta | 1 | Nie (podział narzędzia lub zasobów) |
| [`agent/`](../agent/) | Usługa agenta Windows | 24 | Tak |
| [`aplikacja-desktopowa/`](../aplikacja-desktopowa/) | Punkt wejścia do części Windows | 1 | Tak |
| [`aplikacja-mobilna/`](../aplikacja-mobilna/) | Punkt wejścia do telefonu | 1 | Tak |
| [`design/`](../design/) | Makiety i materiały projektowe | 3 | Tak |
| [`design/documents/`](../design/documents/) | Wzorce dokumentów | 7 | Tak |
| [`design/marketing/`](../design/marketing/) | Wzorce i dane strony publicznej | 18 | Tak |
| [`desktop-client/`](../desktop-client/) | Natywna aplikacja Windows | 16 | Tak |
| [`desktop-client/AgentTestAssets/`](../desktop-client/AgentTestAssets/) | Natywna aplikacja Windows | 2 | Nie (podział narzędzia lub zasobów) |
| [`desktop-client/installer/`](../desktop-client/installer/) | Budowanie instalatora Windows | 4 | Tak |
| [`desktop-client/installer/brand/`](../desktop-client/installer/brand/) | Zasoby graficzne instalatora | 4 | Tak |
| [`docs/`](../docs/) | Dokumentacja, wersje i historia | 32 | Tak |
| [`docs/ui-193/`](../docs/ui-193/) | Dokumentacja, wersje i historia | 12 | Tak |
| [`docs/ui-220/`](../docs/ui-220/) | Dokumentacja, wersje i historia | 1 | Tak |
| [`drive-sync/`](../drive-sync/) | Wysyłanie nagrań na Dysk Google | 3 | Tak |
| [`hosting/`](../hosting/) | Osobna witryna Vercel | 1 | Tak |
| [`hosting/public-site/`](../hosting/public-site/) | Osobna witryna Vercel | 5 | Tak |
| [`kamera/`](../kamera/) | Panel kamer, strona i PWA | 112 | Tak |
| [`kamera/assets/`](../kamera/assets/) | Panel kamer, strona i PWA | 5 | Tak |
| [`kamera/blog/`](../kamera/blog/) | Publiczne poradniki | 5 | Tak |
| [`kamera/communication/`](../kamera/communication/) | Komunikacja panelu z agentem | 6 | Tak |
| [`kamera/core/`](../kamera/core/) | Podstawowa logika panelu | 13 | Tak |
| [`kamera/downloads/`](../kamera/downloads/) | Instalatory EXE, nie zmieniać nazw | 63 | Tak |
| [`kamera/icons/`](../kamera/icons/) | Panel kamer, strona i PWA | 4 | Tak |
| [`kamera/tests/`](../kamera/tests/) | Testy funkcji audio w frontendzie | 5 | Tak |
| [`kamera/updates/`](../kamera/updates/) | Archiwa ZIP aktualizacji, nie usuwać | 68 | Tak |
| [`kamera/vendor/`](../kamera/vendor/) | Panel kamer, strona i PWA | 2 | Tak |
| [`native-mobile/`](../native-mobile/) | Projekty mobilne | 2 | Tak |
| [`native-mobile/android/`](../native-mobile/android/) | Natywna aplikacja Android i jej zasoby | 5 | Tak |
| [`native-mobile/android/app/`](../native-mobile/android/app/) | Natywna aplikacja Android i jej zasoby | 1 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/android/app/src/`](../native-mobile/android/app/src/) | Natywna aplikacja Android i jej zasoby | 0 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/android/app/src/androidTest/`](../native-mobile/android/app/src/androidTest/) | Natywna aplikacja Android i jej zasoby | 0 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/android/app/src/androidTest/java/`](../native-mobile/android/app/src/androidTest/java/) | Natywna aplikacja Android i jej zasoby | 0 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/android/app/src/androidTest/java/pl/`](../native-mobile/android/app/src/androidTest/java/pl/) | Natywna aplikacja Android i jej zasoby | 0 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/android/app/src/androidTest/java/pl/solorz/`](../native-mobile/android/app/src/androidTest/java/pl/solorz/) | Natywna aplikacja Android i jej zasoby | 0 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/android/app/src/androidTest/java/pl/solorz/homesecurity/`](../native-mobile/android/app/src/androidTest/java/pl/solorz/homesecurity/) | Natywna aplikacja Android i jej zasoby | 1 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/android/app/src/debug/`](../native-mobile/android/app/src/debug/) | Natywna aplikacja Android i jej zasoby | 0 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/android/app/src/debug/assets/`](../native-mobile/android/app/src/debug/assets/) | Natywna aplikacja Android i jej zasoby | 1 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/android/app/src/main/`](../native-mobile/android/app/src/main/) | Natywna aplikacja Android i jej zasoby | 1 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/android/app/src/main/java/`](../native-mobile/android/app/src/main/java/) | Natywna aplikacja Android i jej zasoby | 0 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/android/app/src/main/java/pl/`](../native-mobile/android/app/src/main/java/pl/) | Natywna aplikacja Android i jej zasoby | 0 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/android/app/src/main/java/pl/solorz/`](../native-mobile/android/app/src/main/java/pl/solorz/) | Natywna aplikacja Android i jej zasoby | 0 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/android/app/src/main/java/pl/solorz/homesecurity/`](../native-mobile/android/app/src/main/java/pl/solorz/homesecurity/) | Natywna aplikacja Android i jej zasoby | 2 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/android/app/src/main/res/`](../native-mobile/android/app/src/main/res/) | Natywna aplikacja Android i jej zasoby | 0 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/android/app/src/main/res/drawable/`](../native-mobile/android/app/src/main/res/drawable/) | Natywna aplikacja Android i jej zasoby | 12 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/android/app/src/main/res/layout/`](../native-mobile/android/app/src/main/res/layout/) | Natywna aplikacja Android i jej zasoby | 1 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/android/app/src/main/res/values/`](../native-mobile/android/app/src/main/res/values/) | Natywna aplikacja Android i jej zasoby | 3 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/android/app/src/main/res/xml/`](../native-mobile/android/app/src/main/res/xml/) | Natywna aplikacja Android i jej zasoby | 1 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/android/app/src/test/`](../native-mobile/android/app/src/test/) | Natywna aplikacja Android i jej zasoby | 0 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/android/app/src/test/java/`](../native-mobile/android/app/src/test/java/) | Natywna aplikacja Android i jej zasoby | 0 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/android/app/src/test/java/pl/`](../native-mobile/android/app/src/test/java/pl/) | Natywna aplikacja Android i jej zasoby | 0 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/android/app/src/test/java/pl/solorz/`](../native-mobile/android/app/src/test/java/pl/solorz/) | Natywna aplikacja Android i jej zasoby | 0 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/android/app/src/test/java/pl/solorz/homesecurity/`](../native-mobile/android/app/src/test/java/pl/solorz/homesecurity/) | Natywna aplikacja Android i jej zasoby | 1 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/ios/`](../native-mobile/ios/) | Natywna aplikacja iOS i jej zasoby | 2 | Tak |
| [`native-mobile/ios/HomeSecurity/`](../native-mobile/ios/HomeSecurity/) | Natywna aplikacja iOS i jej zasoby | 2 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/ios/HomeSecurity/Assets.xcassets/`](../native-mobile/ios/HomeSecurity/Assets.xcassets/) | Natywna aplikacja iOS i jej zasoby | 1 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/ios/HomeSecurity/Assets.xcassets/AppIcon.appiconset/`](../native-mobile/ios/HomeSecurity/Assets.xcassets/AppIcon.appiconset/) | Natywna aplikacja iOS i jej zasoby | 2 | Nie (podział narzędzia lub zasobów) |
| [`native-mobile/ios/HomeSecurityTests/`](../native-mobile/ios/HomeSecurityTests/) | Natywna aplikacja iOS i jej zasoby | 1 | Nie (podział narzędzia lub zasobów) |
| [`nextup/`](../nextup/) | Osobna historyczna część NextUp | 2 | Tak |
| [`scripts/`](../scripts/) | Skrypty testów, publikacji i budowania | 25 | Tak |
| [`strona-www/`](../strona-www/) | Punkt wejścia do publicznej strony | 1 | Tak |
| [`supabase/`](../supabase/) | Baza i backend Supabase | 3 | Tak |
| [`supabase/functions/`](../supabase/functions/) | Funkcje serwerowe Supabase | 1 | Tak |
| [`supabase/functions/home-contact/`](../supabase/functions/home-contact/) | Funkcje serwerowe Supabase | 3 | Nie (podział narzędzia lub zasobów) |
| [`supabase/functions/home-support/`](../supabase/functions/home-support/) | Funkcje serwerowe Supabase | 2 | Nie (podział narzędzia lub zasobów) |
| [`supabase/migrations/`](../supabase/migrations/) | Migracje bazy SQL | 5 | Tak |
| [`supabase/templates/`](../supabase/templates/) | Szablony wiadomości | 2 | Tak |
| [`tests/`](../tests/) | Testy regresji aplikacji | 87 | Tak |

## Ważne reguły

Katalogi specjalne, zwłaszcza `.github/workflows`, `native-mobile/android/app/src/main/res`, `native-mobile/ios/**/Assets.xcassets` i `supabase/migrations`, mają nazwy i strukturę istotne dla narzędzi. Nie dodawaj tam podziałów wyłącznie estetycznych. Nazwy EXE, ZIP, tras HTML i importów również mają odbiorców poza repozytorium.

Zaczynaj od [README głównego](../README.md), [mapy plików](REPO-MAP.md) i [instrukcji agentów](../AGENTS.md). Foldery bez README można otwierać przez powyższe odnośniki; nadrzędny katalog wyjaśnia ich przeznaczenie.

Po zmianach drzewa aktualizuj liczbę plików i opis. To **spis nawigacyjny**, nie potwierdzenie, że każda funkcja została przetestowana.

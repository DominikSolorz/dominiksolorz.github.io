# Dostęp recenzenta Google Play
Szkic z 9 listopada 2026. Nie wklejać do konsoli przed utworzeniem i sprawdzeniem środowiska testowego. Poniższe pola nie są prawdziwymi danymi logowania.

## Przygotowanie właściciela
Utworzyć osobne konto HOME SECURITY przeznaczone do recenzji. Odizolować je od prywatnych urządzeń, nagrań i kont Google Drive. Przygotować wyłącznie materiał testowy, bez prywatnych pomieszczeń ani osób.
Zapewnić działający nadajnik HOME SECURITY Desktop oraz dostęp do funkcji wymagających kamery przez cały okres recenzji. Alternatywny tryb demonstracyjny wymaga osobnej implementacji i testów; obecność tego dokumentu go nie dodaje.
Sprawdzić pełne logowanie oraz PIN na czystej instalacji aplikacji, poza siecią nadajnika. Recenzent nie powinien potrzebować osobistego telefonu właściciela ani jego kodów jednorazowych.
Dane logowania i PIN podać wyłącznie w prywatnym polu dostępu w Play Console. Nie zapisywać ich w tym pliku, opisie PR ani zgłoszeniu GitHub.
Nie wyłączać zabezpieczeń kont zwykłych użytkowników. Jeżeli aktualne logowanie nie zapewnia samodzielnego dostępu recenzenta, przygotować oddzielne rozwiązanie przed wysłaniem aplikacji.

## English instruction template
Application: HOME SECURITY
Access: Some functionality requires a HOME SECURITY account and an application PIN.

Test account email: [Enter the verified review account in Play Console only]
Test account password: [Enter the verified password in Play Console only]
Application PIN: [Enter the verified PIN in Play Console only]

Open HOME SECURITY and select the sign-in option. Sign in with the review account provided above, then enter the application PIN when prompted.
The Android application is a viewer for HOME SECURITY Desktop running on a Windows computer. The phone does not act as the camera transmitter.
[After verifying the review setup, insert the exact test device name and the steps shown in the submitted build to open its live view, event history and recordings.]
[Describe any additional action needed to access settings and optional location features, using labels matching the submitted build.]
[Confirm only after testing that the dedicated transmitter and test recordings remain accessible throughout review, including from another network.]

## Kontrola przed zapisaniem w konsoli
Wszystkie nawiasy zastąpić sprawdzonymi informacjami. Potwierdzić dostęp do podglądu, dźwięku, zdarzeń, archiwum, ustawień i ścieżki usunięcia konta. Sam ekran „Łączenie…” nie wystarcza.
Sprawdzić odmowę lokalizacji, ponowną próbę po błędzie sieci oraz powrót po zamknięciu aplikacji. Zapisać wersję AAB, datę i wynik testu prywatnie, bez haseł w repozytorium.
Instrukcja ma być po angielsku, a dostęp możliwy wielokrotnie i niezależnie od lokalizacji recenzenta.
Źródło: https://support.google.com/googleplay/android-developer/answer/15748846?hl=en

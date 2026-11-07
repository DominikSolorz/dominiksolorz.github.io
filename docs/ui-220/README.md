# HOME SECURITY — wdrożenie prawdziwego interfejsu UI 220

Data: 27.10.2026. Punktem odniesienia są makiety UI 193 z galerii strony głównej, ale ekran programu pozostaje prawdziwym interfejsem WebView2.

## Zmiany

- Ciemniejsza stylistyka: grafit, bordo i subtelne złoto w istniejących zakładkach pulpitu, sterowania, nagrań, alarmów, ustawień i diagnostyki.
- Spójne menu boczne, nagłówek, formularze, karty stanu, pole wyszukiwania i responsywny widok telefonu.
- Nadal jedna prawdziwa instancja wideo, oryginalne przyciski Start/Stop/Restart oraz prawdziwa telemetria stanu; nie wstawiono wygenerowanych plansz zamiast obrazu. Zachowano też ręcznie wybrane tryby obrazu (np. kontrast i tryb nocny).
- Czytelniejsze ostrzeżenia, focus klawiatury, rozróżnienie stanu błędu i wymaganych uprawnień, prefers-reduced-motion.
- Aktywna zakładka ma także aria-current=page, a nie wyłącznie klasę active. Usunięto statyczne deklaracje o gotowości ochrony, gdy brak potwierdzenia.
- Motywy specjalne Police i US Military pozostają nietknięte.

## Uwaga na nagrywanie

Na dostarczonych zdjęciach program sygnalizuje: problem z zapisem do folderu, wymagane uprawnienia folderu, brak potwierdzonego zamkniętego pliku, a przy braku odbiorcy nieaktywną sesję WebRTC. Są to PRAWDZIWE OSTRZEŻENIA, których zmiana wyglądu nie usuwa i nie ukrywa.

Przed potwierdzeniem poprawnego zapisu:
1. Wybierz lokalny folder w zakładce Nagrania na komputerze.
2. Przyznaj wymagany dostęp i sprawdź ilość wolnego miejsca.
3. Uruchom zapis z kontrolowanej kamery testowej.
4. Potwierdź powstanie i odtworzenie nowego pliku po zamknięciu segmentu.
5. Niezależnie sprawdź WebRTC i opcjonalny Google Drive.

Zdjęć zawierających domowników oraz prywatny pokój NIE dodano do kodu, galerii, marketingu ani pakietu instalacyjnego.

## Windows — testowe wykonanie nowej wersji

Panel ma numer 220, a natywny host Windows nadal numer 1.4.8. Nowa kompilacja testowa z WebPanelBuild 220 powstaje w workflow desktop-ui-preview.yml w GitHub Actions. Buduje prawdziwy HomeSecurityDesktop.exe oraz natywnego agenta. Nie jest to oficjalna automatyczna aktualizacja ani zaktualizowany publiczny instalator.

Archiwum testowe przeznaczone jest do wypakowania w całości i próby na oddzielnym Windows lub koncie testowym. Nie uruchamiaj dwóch nadajników równocześnie i nie nadpisuj działającej instalacji. Program może używać profilu danych użytkownika; sama zmiana CSS nie gwarantuje rozdzielenia danych.

## Nadal poza zakresem

Wielokamerowy podgląd, wykrywanie osób i pojazdów, czujniki oraz uzbrajanie na planszach UI 193 są wyłącznie koncepcjami. Nie dodano atrap tych funkcji. Osobny etap implementacji natywnej funkcjonalności wymaga integracji i testów na urządzeniach.

## Weryfikacja

- Frontend: node --test tests/*.test.mjs
- Windows: kompilacja HomeSecurityDesktop.csproj i testy natywnego agenta
- Pakiet preview: desktop-client/build-release.ps1 -Version 1.4.8
- Krytyczny test ręczny: realna kamera, zgoda folderu, zapis i odtworzenie potwierdzonego pliku

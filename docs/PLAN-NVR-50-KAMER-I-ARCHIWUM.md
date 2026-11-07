# HOME SECURITY: plan systemu monitoringu dla domu i firmy

Stan odniesienia: `main` z 7 listopada 2026, Windows 1.4.47. To wymagania i plan wdrożenia, **nie** deklaracja gotowego systemu NVR dla 50 kamer.

## Co realnie działa, a czego jeszcze nie ma

- Zabezpieczony PIN-em panel właściciela, aktywna kamera główna, jej nagrania, DVR, podgląd zdalny, lokalny zapis i opcjonalny Drive.
- Konfiguracja do 128 dodatkowych źródeł na właściciela; jednoczesny podgląd jest ograniczony do 9 dodatkowych źródeł. WHEP i HTTPS MJPEG/zdjęcia oraz lokalne urządzenia Windows mają adaptery podglądu.
- **Dodatkowe kamery nie są jeszcze objęte wielokanałowym rejestratorem.** Nie należy reklamować ich jako 50 działających kanałów ciągłego nagrywania.
- RTSP/ONVIF nie działa bezpośrednio w przeglądarce. Wymagany odrębny serwis Windows/NVR z adapterem i bezpiecznym przechowywaniem haseł. Nie kopiować sekretów do HTML, URL ani localStorage.
- Sterowanie klatkami w istniejącym pliku za pomocą HTML video nie gwarantuje odtworzenia dokładnie następnej zakodowanej klatki. Nie przedstawiać orientacyjnego kroku jako funkcji dowodowej.

## Etap 1. Rzeczywiste przeglądanie nagrań z jednej kamery

Użytkownik może wybrać dzień i HH:MM:SS, skoczyć 5/10 minut wstecz, przesunąć o jedną sekundę lub godzinę i wykonać orientacyjny krok klatki w już pobranym nagraniu lokalnym. Oś czasu ma odróżniać brak nagrania, trwający zapis, błąd połączenia i gotowy plik. Nie wolno zatrzymywać streamu live ani nagrywania podczas szukania.

Dostęp do Google Drive przez osadzony player nie zapewnia sterowania `currentTime` z naszej aplikacji. Komunikat ma uczciwie wskazywać ręczne przewijanie w Google. Etap 1 nie tworzy indeksu wszystkich klatek.

Akceptacja: testy daty, lokalnej strefy czasowej, luk między fragmentami, przerwanego nagrania, ograniczeń odtwarzania i regresji PIN/MediaRecorder; osobny test na fizycznym Windows/WebView2 przed wdrożeniem produkcyjnym.

## Etap 2. Właściwy rejestrator NVR dla wielu kamer

- Serwis Windows uruchamiany niezależnie od WebView2. Jedna kolejka nagrywania na kamerę, odrębne stany, restart pojedynczego źródła bez zatrzymania pozostałych. Kontrolowane zamykanie segmentów i zapis atomowy.
- Odkrywanie i konfiguracja urządzeń ONVIF Profile T (obraz, metadane) oraz Profile G (wyszukiwanie i odtwarzanie archiwum zgodnych urządzeń); RTSP/RTSPS z kompatybilnym adapterem. Realne wsparcie protokołów potwierdzają testy na sprzęcie, nie sam fakt istnienia pola URL.
- Dwa profile obrazu: główny strumień wysokiej jakości do zapisu, lekki strumień do siatki wielokamerowej. Nie dekodować 50 obrazów HD jednocześnie na każdym telefonie.
- Repozytorium nagrań z kluczem `tenantId/cameraId/startUtc/endUtc`, indeksem segmentów, wersją formatu, integralnością pliku, stanem potwierdzenia i informacją o lukach. Czas UTC do przechowywania, lokalna strefa tylko do prezentacji. Zsynchronizowane zegary kamer/NVR.
- Obsługa magazynu per kamera: retencja, limit miejsca, utrata dysku, pełny dysk, nieudany zapis, odtworzenie po awarii, kopia/eksport oraz brak cichego kasowania materiału.

Akceptacja: co najmniej 50 źródeł testowych na hostach o zmierzonych zasobach; 24/72 h bez utraty ciągłości (z wyjątkiem jawnie raportowanych awarii), test dysku i restartu, pomiar opóźnienia, zajętości dysku, CPU/RAM oraz użycia sieci. Dopiero potem oznaczyć produkt jako gotowy dla 50 kamer.

## Etap 3. Konsola operatora i profesjonalne archiwum

Siatki 1, 4, 9, 16 i paginacja do 50 kamer, filtry po lokalizacji i statusie, pełny ekran, role, wyszukiwanie po kamerze i dacie. Oś czasu per kamera z widocznymi lukami i zdarzeniami; synchronizacja kilku kamer. Przewijanie o sekundę, minutę, godzinę, dowolny dzień; **dokładna klatka po klatce** dopiero po wdrożeniu indeksu klatek/PTS i kontrolowanego dekodera dla formatu, który to wspiera. Eksport zakresu z metadanymi czasu i sumą kontrolną. Brak niepotwierdzonych stanów typu „Nagrywa” na podstawie samego kliknięcia Start.

## Etap 4. Uprawnienia, bezpieczeństwo i konserwacja

Role administratora, operatora i osoby tylko do odczytu, oddzielne obiekty/firmy i uprawnienia do konkretnych kamer. Dziennik logowań, odczytów, eksportów, usunięć i zmian retencji; szyfrowane połączenia, zarządzanie hasłami w magazynie systemowym, izolacja sieci kamer. Zgodność z przepisami o ochronie danych i informowaniem osób monitorowanych wymaga osobnej weryfikacji przed wdrożeniem firmowym.

## Aktualizacje: co, gdzie, kiedy i jak

- Windows: aplikacja okresowo sprawdza dostępność wydania (aktualny kod: co około 6 godzin). Po odblokowaniu panelu PIN-em pokazuje w lewym menu „Zaktualizuj do wersji X”. Instalację należy zatwierdzić po bezpiecznym zamknięciu fragmentu; hash SHA-256 instalatora i pakietu jest weryfikowany. Nie wymuszać restartu podczas zapisu.
- WWW/PWA: po wejściu i powrocie do aktywnej karty oraz okresowo sprawdzany jest service worker. Przycisk „Sprawdź aktualizacje” lub „Zaktualizuj” pokazuje stan. Automatyczne odświeżenie tylko wtedy, gdy nie trwa zapis i nie ma niezapisanych zmian.
- Wersja kodu, wersja opublikowanego pakietu, wersja uruchomiona na komputerze i wynik aktualizacji to **cztery różne informacje**; panel powinien je pokazywać oddzielnie.
- Zawsze zachować rollback, informację „co zmieniono”, datę wydania, stan pobierania, błąd, ponowienie i wynik testów. Nigdy nie obiecywać konkretnej godziny aktualizacji, dopóki GitHub Actions nie zakończy wydania.

## Współpraca z GitHub Copilot i kontrola zmian

PR #142 dotyczy łączy na stronie prezentacji, **nie** implementacji rejestratora. Nie scalać go bez aktualizacji względem `main` i testów. Oddzielać pracę na małe PR-y funkcjonalne: moduł rejestratora, indeks archiwum, adapter ONVIF, UI operatora, uprawnienia i wydanie. Każdy PR ma podać: faktycznie działające funkcje, ograniczenia, testy, wpływ na użytkownika, migracje danych i plan cofnięcia. Nie nadpisywać zmian innych gałęzi bez obejrzenia diffu.

Ostateczny wygląd zatwierdza właściciel projektu na podstawie prawdziwych ekranów i nagrań testowych, nie wygenerowanych makiet.

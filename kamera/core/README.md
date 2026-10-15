# Frontend — pierwsza partia etapu 1

## Moduły

- store.mjs: centralny stan komponentów, świeżość pomiarów i ograniczona historia zdarzeń. Wpis logu nie zmienia statusu komponentu.
- router.mjs: wybór widoku i aktualizacja Store; nie zna nadajnika ani rejestratora.
- peer-diagnostics.mjs: stan każdej sesji, pomiary getStats, typ wybranej trasy; ICE 701 jest ostrzeżeniem, nie zmianą stanu na failed.
- ../communication/commands.mjs: CommandClient i CommandDispatcher; wyniki succeeded/failed/rejected oraz unknown po timeout/zerwaniu transportu.

## Podłączenie

app.js pozostaje adapterem istniejącego silnika. Start/Stop/Restart, tryby i podstawowe ustawienia (jakość, źródło, jasność) korzystają z klienta poleceń. Lokalne wykonanie i komendy telefonu używają tego samego dispatchera. Polecenia i wyniki zdalne są podpisywane istniejącym kluczem, z powiązaniem ID klienta i komendy.

Wynik succeeded oznacza zakończenie handlera, a nie deklarację, że wszystkie przyszłe segmenty będą poprawne. Kamera i zapis mają osobną telemetrię. accepted nie jest terminalnym sukcesem. Po unknown nie należy automatycznie wysyłać nowej operacji.

Deduplikacja jest ograniczona do 256 wpisów w pamięci tego procesu, nie przeżywa restartu i nie gwarantuje wykonania exactly-once. Docelowy agent potrzebuje trwałego dziennika komend i API odczytu ich wyników.

desktop.js i mobile.js korzystają z routera. DVR ma oddzielny element video i kontener; oryginalne #stage i #video nie są przenoszone do archiwum.

## Granice tej partii

- MediaRecorder, bufor, autoryzacja i kamera nadal działają w procesie WebView2.
- Zamykanie lub przeładowanie procesu nadal przerywa pracę. Osobny agent nie został jeszcze wdrożony.
- Token Drive nadal pochodzi z istniejącego mechanizmu PIN; zmieniono izolację i prezentację błędów, nie poświadczenia ani parowanie.
- Aktualizacja/reload, zmiana urządzenia, wybór folderu, zarządzanie plikami i część starszych kontrolek nadal używają adapterów legacy.
- Zachowano obsługę podpisanych komend starego protokołu dla zgodności. Stary nadajnik nie potwierdzi nowej komendy; klient pokaże unknown zamiast fałszywego sukcesu.
- Nie zastąpiono jeszcze kanału danych archiwum przez HTTPS ani nie dodano zdalnego API odczytu statusu komendy.
- Statystyki i testy jednostkowe nie dowodzą fizycznej ciągłości nagrania ani odbioru obrazu na iPhonie.

## Weryfikacja

Uruchom z katalogu repozytorium: node --test tests/frontend-core.test.mjs

Przed publikacją: uruchomić nadajnik i odbiornik z nowym protokołem, sprawdzić Start/Stop/Restart, timeout oraz ciągłość segmentu podczas otwierania Ustawień i DVR. Nie przerywać działającego nagrywania wyłącznie w celu wymuszenia aktualizacji.

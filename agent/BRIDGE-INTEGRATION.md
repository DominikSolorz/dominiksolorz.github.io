# Test integracyjny WebView2 → Named Pipe → osobny agent

Data: 2026-10-15. Test wykonano na rzeczywistym WebView2 w procesie HomeSecurityDesktop.exe i osobnym HomeSecurityAgent.exe. Nie był to wyłącznie test jednostkowy ani serwer IPC w procesie testera.

## Izolacja

- Tryb panelu: --agent-bridge-test <absolutny katalog testowy>.
- Tryb agenta: --bridge-test <ten sam katalog>.
- Osobna baza, profil WebView2 i nazwa pipe wyprowadzona z SID użytkownika i katalogu testowego.
- Brak ładowania publicznego panelu, app.js, aktualizatora, PIN-u, kamery i prawdziwych poświadczeń.
- Potwierdzono zgodność SID procesów panelu i agenta.
- Agent przetrwał zamknięcie procesów panelu. Restartowano i zakończono wyłącznie testowy agent, po sprawdzeniu ścieżki EXE i argumentu katalogu.

## Wyniki

| Przebieg | Wynik |
| --- | --- |
| Ping, snapshot, wynik wcześniejszej komendy | PASS |
| Powtórzenie ID i argumentów | PASS — zwrócono utrwalony wynik |
| To samo ID, inne polecenie | PASS — ID_CONFLICT |
| secret.read oraz nieoczekiwany argument sql | PASS — COMMAND_NOT_ALLOWED |
| Wyłączony agent | PASS — natywne unknown/TIMEOUT_OR_CANCELLED, nie timeout samej strony |
| Restart agenta i ponowne otwarcie panelu | PASS — wynik komendy sprzed restartu odczytany z SQLite |
| Dokument /untrusted.html w tym samym lokalnym originie testowym | PASS — nie otrzymał odpowiedzi IPC |
| Nawigacja podczas oczekiwania | PASS — odnotowano jedną odpowiedź stłumioną przez natywną kontrolę generacji/dokumentu |

Pierwszy przebieg: ping 379 ms, snapshot 91 ms, odczyt wyniku 53 ms. To pojedyncze pomiary funkcjonalne, nie benchmark wydajności.

Raporty surowe pozostały wyłącznie lokalnie w katalogu tymczasowym HomeSecurityBridge-live-e438251880f647d2a653ecd1ca1d4af2/reports. Zawierają identyfikator konta Windows, dlatego nie są dodane do Git.

## Powtarzanie

1. Zbuduj agenta i panel z tego samego checkoutu.
2. Utwórz nowy katalog testowy i uruchom agent z --bridge-test.
3. Uruchom panel z --agent-bridge-test i tym katalogiem. Bez dodatkowych flag pozostanie widoczny ekran z trzema przyciskami.
4. --auto wykonuje zestaw sprawdzeń i zamyka wyłącznie panel po zapisaniu raportu.
5. Po zatrzymaniu testowego agenta użyj --auto --expect-unavailable.
6. Uruchom ponownie agenta z tym samym katalogiem i panel z --auto --prior-id <ID pierwszego udanego ping>.
7. --auto --denied-source sprawdza niedozwolony dokument.
8. --auto --navigate-pending sprawdza odpowiedź po nawigacji. Opóźnienie 600 ms jest włączane wyłącznie w tym natywnym trybie testowym, nie przez wiadomość strony.

Nie uruchamiaj równocześnie dwóch okien używających tego samego profilu testowego WebView2.

## Ograniczenia

Testy funkcjonalne uruchamia kod strony testowej wewnątrz rzeczywistego WebView2. Nie potwierdzono ręcznego klikania ani wyglądu okna: Computer Use zgłosił błąd inicjalizacji (os error 3).

To test kanału i jego granic, nie dowód działania autoryzacji konta/PIN, rejestratora, chmury ani pracy jako usługa Windows. Nie zastąpiono zainstalowanego programu i nie opublikowano nowej wersji strony.

# HomeSecurityAgent — szkielet etapu 2

Natywny adapter Google Drive API, autoryzację OAuth i granice weryfikacji opisano w [GOOGLE-DRIVE.md](GOOGLE-DRIVE.md). Adapter nie został jeszcze zweryfikowany uploadem na rzeczywiste konto ani dołączony do instalatora.

Agent jest osobnym procesem .NET 10 dla Windows. Nie jest uruchamiany przez panel, nie ma zależności od WebView2 i nie otwiera kamery. Nie zainstalowano autostartu ani usługi Windows.

## Projekty

- agent-contracts: wersjonowany kontrakt, walidacja dozwolonych operacji, ramki JSON z 4-bajtowym nagłówkiem i limitem 64 KiB.
- agent-client: natywny CommandClient, lokalny Named Pipe, timeout i wynik unknown bez automatycznych ponowień.
- agent: SQLite, dispatcher, serwer IPC i magazyn DPAPI.
- desktop-client/AgentWebViewBridge.cs: mostek WebView2 z allowlistą dokumentów i komend.
- kamera/communication/native-agent-client.mjs: adapter istniejącego frontendowego CommandClient do mostka natywnego.
- agent-tests: integracyjne testy działającego Named Pipe i DPAPI w osobnym katalogu tymczasowym.

## Uruchamianie deweloperskie

Z katalogu repozytorium:

```powershell
dotnet build agent/HomeSecurityAgent.csproj -c Release
dotnet run --project agent-tests/HomeSecurity.Agent.Tests.csproj -c Release
dotnet run --project agent/HomeSecurityAgent.csproj -c Release
```

Agent używa katalogu LocalApplicationData/HomeSecurityAgent bieżącego użytkownika: agent.db, agent.lock, integration-secrets/. Katalog ma chroniony ACL z dostępem dla użytkownika procesu. Nie używa istniejącego katalogu nagrań. Ctrl+C kończy proces deweloperski. Moduł fikcyjnych integracji i ograniczenia DPAPI opisano w [INTEGRATION-CREDENTIALS.md](INTEGRATION-CREDENTIALS.md).

Mostek w nowo skompilowanym panelu włącza się wyłącznie zmienną środowiskową HOME_SECURITY_AGENT_BRIDGE=1. Samo włączenie mostka nie uruchamia agenta. Nie podmieniono zainstalowanego EXE.

Przykładowe wykorzystanie w panelu (nie zostało dodane automatycznie do app.js):

```js
import { NativeAgentClient } from './communication/native-agent-client.mjs';
const client = new NativeAgentClient();
const state = await client.execute('system.snapshot');
// Przy odłączeniu danego adaptera:
client.dispose();
```

## Granice bezpieczeństwa

- Serwer ma jawny ACL: bieżący SID użytkownika dozwolony, Network SID odrzucony. Nazwa pipe jest rozdzielona po SID. Klient używa serwera lokalnego "." i CurrentUserOnly.
- To granica konta Windows, nie ochrona przed złośliwym procesem działającym jako ten sam użytkownik lub administrator. Przyszłe operacje modyfikujące wymagają dodatkowej autoryzacji użytkownika/agenta; sam adres strony ani flaga JS nie wystarczą.
- Mostek akceptuje tylko HTTPS, port 443, host dominiksolorz.github.io oraz dokument /kamera/ lub /kamera/index.html. Porównuje nadawcę z dokumentem głównym. Wynik nie jest przekazywany do nowego dokumentu po nawigacji.
- Mostek ogranicza równoległość do 4, serwer do 8 klientów. Obowiązują limity ramek, głębokości JSON i czasu połączenia.
- Dostępne operacje: agent.ping, system.snapshot, command.status. Wszystkie są tylko do odczytu; brak SQL, dostępu do plików, sekretów, procesów, kamery i uploadów.
- Magazyn DPAPI używa CurrentUser. Nie jest zależny od PIN-u. Sekretów nie wysyłamy do JavaScript ani nie zapisujemy w bazie komend. Na razie nie zapisano prawdziwych poświadczeń Drive.
- Istniejący handler diagnostyki WebView2 pomija komunikaty agent.command zamiast zapisywać ich treść.

## Trwałość i ograniczenia

SQLite działa w WAL. Polecenie jest zapisywane jako executing przed handlerem i otrzymuje trwały wynik po wykonaniu. Powtórzone ID i argumenty zwracają poprzedni wynik; konflikt ID jest odrzucany. Po restarcie niedokończone polecenia mają unknown i nie są wykonywane ponownie automatycznie. To nie jest gwarancja exactly-once dla przyszłych efektów zewnętrznych.

Tabela commands nie ma jeszcze polityki retencji. Tabele segments i upload_jobs to schemat przyszłych repozytoriów, nie działający rejestrator ani uploader. Przed migracją produkcyjną potrzebne są wersjonowane migracje, retencja dziennika, autoryzacja operacji modyfikujących i protokół instalowania/nadzorowania agenta.

Nie migrowano tokenu Apps Script, nie uruchomiono FFmpeg, nie dodano obsługi WebRTC w agencie i nie przełączono obecnego silnika app.js. Wykonano instrumentowany test rzeczywistego WebView2 i osobnego procesu agenta: wyniki oraz ograniczenia opisuje BRIDGE-INTEGRATION.md. Ręczna kontrola wizualna pozostaje do wykonania.

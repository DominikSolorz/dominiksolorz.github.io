# HOME SECURITY / agent — kompletna mapa plików

Natywny agent .NET wspierający HOME SECURITY. Komunikacja, przechowywanie, migracje, zadania i Drive są odrębnymi modułami. Dla każdego pliku podano jego rolę w projekcie; rzeczywisty zakres potwierdza kod. Nie zmieniaj nazw klas C# bez aktualizacji projektu, odwołań i testów.

| Plik lub katalog | Funkcja |
| --- | --- |
| [`AgentDatabase.cs`](AgentDatabase.cs) | Lokalna baza agenta |
| [`AgentDispatcher.cs`](AgentDispatcher.cs) | Wykonywanie i rozdzielanie poleceń |
| [`AssemblyInfo.cs`](AssemblyInfo.cs) | Metadane zestawu .NET |
| [`BRIDGE-INTEGRATION.md`](BRIDGE-INTEGRATION.md) | Dokumentacja mostka agenta |
| [`CameraRecordingIndex.cs`](CameraRecordingIndex.cs) | Indeks nagrań kamer |
| [`CrashTestHost.cs`](CrashTestHost.cs) | Host testów odporności na awarie |
| [`DatabaseMigrations.cs`](DatabaseMigrations.cs) | Migracje lokalnej bazy agenta |
| [`DriveNativeCommands.cs`](DriveNativeCommands.cs) | Komendy natywnej integracji Drive |
| [`DriveUploadQueue.cs`](DriveUploadQueue.cs) | Kolejka przesyłania na Dysk Google |
| [`GOOGLE-DRIVE.md`](GOOGLE-DRIVE.md) | Instrukcja integracji z Google Drive |
| [`GoogleDriveApi.cs`](GoogleDriveApi.cs) | Klient API Dysku Google |
| [`GoogleDriveAuthorization.cs`](GoogleDriveAuthorization.cs) | Autoryzacja Dysku Google |
| [`HomeSecurityAgent.csproj`](HomeSecurityAgent.csproj) | Projekt .NET agenta |
| [`INTEGRATION-CREDENTIALS.md`](INTEGRATION-CREDENTIALS.md) | Zasady poświadczeń integracji |
| [`IntegrationCredentials.cs`](IntegrationCredentials.cs) | Obsługa poświadczeń integracji |
| [`PROCESS-CRASH-TESTS.md`](PROCESS-CRASH-TESTS.md) | Testy awarii procesu |
| [`PipeServer.cs`](PipeServer.cs) | Lokalny serwer komunikacji Named Pipes |
| [`Program.cs`](Program.cs) | Uruchomienie procesu agenta |
| [`README.md`](README.md) | Dokumentacja modułu |
| [`RecordingStorage.cs`](RecordingStorage.cs) | Magazyn nagrań |
| [`SYNTHETIC-WORKER.md`](SYNTHETIC-WORKER.md) | Opis syntetycznych zadań |
| [`SecretStore.cs`](SecretStore.cs) | Magazyn sekretów użytkownika |
| [`SyntheticJobs.cs`](SyntheticJobs.cs) | Syntetyczne zadania testowe |
| [`packages.lock.json`](packages.lock.json) | Zablokowane wersje zależności .NET |

Wprowadzenie: [README.md](README.md). Instrukcje agenta: [../AGENTS.md](../AGENTS.md). Mapa wydania: [../docs/RELEASE-MAP.md](../docs/RELEASE-MAP.md).

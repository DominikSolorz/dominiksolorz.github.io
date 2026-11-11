# HOME SECURITY / agent-tests — przewodnik po plikach

Testy modułu agenta desktopowego: nagrywania, uprawnień, synchronizacji i awarii.

| Plik lub katalog | Do czego służy |
| --- | --- |
| [`CameraRecordingIndexTests.cs`](CameraRecordingIndexTests.cs) | Testy indeksowania nagrań kamer |
| [`CredentialTests.cs`](CredentialTests.cs) | Testy obsługi danych uwierzytelniających |
| [`DriveTests.cs`](DriveTests.cs) | Testy integracji z Dyskiem Google |
| [`HomeSecurity.Agent.Tests.csproj`](HomeSecurity.Agent.Tests.csproj) | Konfiguracja projektu testowego .NET |
| [`JobTests.cs`](JobTests.cs) | Testy zadań agenta |
| [`ProcessCrashTests.cs`](ProcessCrashTests.cs) | Testy odporności na awarie procesu |
| [`Program.cs`](Program.cs) | Program uruchamiający zestaw testów |
| [`RecordingStorageTests.cs`](RecordingStorageTests.cs) | Testy przechowywania nagrań |
| [`fixtures/`](fixtures/) | Dane przykładowe używane w testach |
| [`packages.lock.json`](packages.lock.json) | Dane lub konfiguracja tego obszaru |

## Dla człowieka i agenta AI

Najpierw otwórz [mapę główną](../README.md), [instrukcje agentów](../AGENTS.md) oraz [mapę plików](../docs/REPO-MAP.md). Idź do pliku od zadania, nie edytuj przypadkowych podobnie nazwanych plików. Przy zmianach kodu sprawdź importy, testy i publikację. Opisy są wskazówką nawigacyjną; rzeczywiste zachowanie potwierdza zawartość kodu.

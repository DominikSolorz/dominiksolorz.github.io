# HOME SECURITY / kamera/communication — przewodnik po plikach

Moduły komunikacji panelu z lokalnym agentem, sterowania i przygotowania katalogów. Zmiany wymagają testów autoryzacji i działania agenta.

| Plik lub katalog | Do czego służy |
| --- | --- |
| [`agent-telemetry.mjs`](agent-telemetry.mjs) | Odbieranie lub przetwarzanie telemetrii agenta |
| [`commands.mjs`](commands.mjs) | Polecenia wysyłane do modułów sterujących |
| [`folder-channel.mjs`](folder-channel.mjs) | Kanał komunikacji dotyczący katalogów |
| [`folder-readiness.mjs`](folder-readiness.mjs) | Sprawdzenie gotowości katalogu |
| [`native-agent-client.mjs`](native-agent-client.mjs) | Klient komunikacji z natywnym agentem |

## Dla człowieka i agenta AI

Najpierw otwórz [mapę główną](../../README.md), [instrukcje agentów](../../AGENTS.md) oraz [mapę plików](../../docs/REPO-MAP.md). Idź do pliku od zadania, nie edytuj przypadkowych podobnie nazwanych plików. Przy zmianach kodu sprawdź importy, testy i publikację. Opisy są wskazówką nawigacyjną; rzeczywiste zachowanie potwierdza zawartość kodu.

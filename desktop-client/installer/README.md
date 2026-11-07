# HOME SECURITY / desktop-client/installer — przewodnik po plikach

Pliki budowania instalatora aplikacji Windows, a nie kod głównego interfejsu. Zmiany mogą wpłynąć na aktualizacje zainstalowanych programów.

| Plik lub katalog | Do czego służy |
| --- | --- |
| [`BuildBrandAssets.ps1`](BuildBrandAssets.ps1) | Skrypt przygotowujący zasoby identyfikacji wizualnej instalatora |
| [`HomeSecurityDesktop.UI220.Preview.iss`](HomeSecurityDesktop.UI220.Preview.iss) | Konfiguracja instalatora podglądu wariantu UI220 |
| [`HomeSecurityDesktop.iss`](HomeSecurityDesktop.iss) | Konfiguracja instalatora Inno Setup |
| [`brand/`](brand/) | Grafiki i ikona instalatora |

## Dla człowieka i agenta AI

Najpierw otwórz [mapę główną](../../README.md), [instrukcje agentów](../../AGENTS.md) oraz [mapę plików](../../docs/REPO-MAP.md). Idź do pliku od zadania, nie edytuj przypadkowych podobnie nazwanych plików. Przy zmianach kodu sprawdź importy, testy i publikację. Opisy są wskazówką nawigacyjną; rzeczywiste zachowanie potwierdza zawartość kodu.

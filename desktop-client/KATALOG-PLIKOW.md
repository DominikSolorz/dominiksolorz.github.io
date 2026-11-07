# HOME SECURITY / desktop-client — kompletna mapa plików

Kod desktopowej aplikacji HOME SECURITY dla Windows (WebView2, diagnostyka, instalator, aktualizacje). Dla każdego pliku podano jego rolę w projekcie; rzeczywisty zakres potwierdza kod. Nie zmieniaj nazw klas C# bez aktualizacji projektu, odwołań i testów.

| Plik lub katalog | Funkcja |
| --- | --- |
| [`AgentBridgeTestWindow.cs`](AgentBridgeTestWindow.cs) | Testowe okno mostka agenta |
| [`AgentRuntime.cs`](AgentRuntime.cs) | Uruchamianie i obsługa agenta w procesie Windows |
| [`AgentTestAssets/`](AgentTestAssets/) | Testowe strony mostka agenta |
| [`AgentWebViewBridge.cs`](AgentWebViewBridge.cs) | Mostek komunikacji z WebView2 |
| [`BundleTestWindow.cs`](BundleTestWindow.cs) | Testowe okno spakowanego panelu |
| [`BundledPanel.cs`](BundledPanel.cs) | Obsługa panelu dołączonego do instalacji |
| [`CameraWorkspaceTestWindow.cs`](CameraWorkspaceTestWindow.cs) | Testowe okno obszaru kamery |
| [`ExternalLinks.cs`](ExternalLinks.cs) | Bezpieczna obsługa odnośników zewnętrznych |
| [`HomeSecurityDesktop.csproj`](HomeSecurityDesktop.csproj) | Projekt .NET aplikacji Windows |
| [`INSTALLED-PANEL.md`](INSTALLED-PANEL.md) | Dokumentacja panelu dołączonego do instalatora |
| [`PanelDiagnostics.cs`](PanelDiagnostics.cs) | Diagnostyka panelu |
| [`Program.cs`](Program.cs) | Główny punkt wejścia programu Windows |
| [`README.md`](README.md) | Dokumentacja modułu |
| [`RecordingStorageBridge.cs`](RecordingStorageBridge.cs) | Mostek magazynu nagrań |
| [`RecordingStorageTestWindow.cs`](RecordingStorageTestWindow.cs) | Testowe okno magazynu nagrań |
| [`app.manifest`](app.manifest) | Manifest wymagań aplikacji Windows |
| [`build-release.ps1`](build-release.ps1) | Skrypt budowania wersji Windows |
| [`installer/`](installer/) | Instalator Inno Setup i zasoby graficzne |

Wprowadzenie: [README.md](README.md). Instrukcje agenta: [../AGENTS.md](../AGENTS.md). Mapa wydania: [../docs/RELEASE-MAP.md](../docs/RELEASE-MAP.md).

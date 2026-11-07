using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Diagnostics;
using System.IO.Compression;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;

namespace HomeSecurityDesktop;

internal static class Program
{
    private const string DesktopVersion = "1.4.61";
    private const string WebPanelBuild = "272";
    // Desktop serves its installed Panel bundle at the existing trusted origin.
    // The website and installed UI can now be released independently without
    // migrating the user's existing session, PIN or IndexedDB recordings.
    private const string PanelUrl = "https://dominiksolorz.github.io/kamera/?desktop=1&native=windows&host=computer&ui_build=" + WebPanelBuild;
    private const string PublicHost = "dominiksolorz.github.io";
    private const string UpdateManifestUrl = "https://dominiksolorz.github.io/kamera/desktop-update.json";
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromMinutes(16) };

    [STAThread]
    private static void Main(string[] args)
    {
        if(args.Length==2&&args[0]=="--recording-storage-test")
        {
            ApplicationConfiguration.Initialize();Application.Run(new RecordingStorageTestWindow(Path.GetFullPath(args[1])));return;
        }
        if (args.Length == 2 && args[0] == "--camera-workspace-test")
        {
            ApplicationConfiguration.Initialize();
            Application.Run(new CameraWorkspaceTestWindow(Path.GetFullPath(args[1])));
            return;
        }
        if (args.Length == 2 && args[0] == "--agent-health-test")
        {
            using var runtime = new AgentRuntime();
            var ready = runtime.EnsureStartedAsync().GetAwaiter().GetResult();
            var client = new HomeSecurity.Agent.Client.AgentCommandClient();
            var empty = HomeSecurity.Agent.Contracts.AgentProtocol.Element(new { });
            var ping = client.ExecuteAsync("agent.ping", empty).GetAwaiter().GetResult();
            var snapshot = client.ExecuteAsync("system.snapshot", empty).GetAwaiter().GetResult();
            File.WriteAllText(Path.GetFullPath(args[1]), JsonSerializer.Serialize(new {
                ok = ready && ping.Status == "succeeded" && snapshot.Status == "succeeded",
                ping = ping.Status, snapshot = snapshot.Status,
                mediaEngine = ping.Result?.GetProperty("mediaEngine").GetString()
            }));
            return;
        }
        if (args.Length == 2 && args[0] == "--bundle-test")
        {
            ApplicationConfiguration.Initialize();
            Application.Run(new BundleTestWindow(Path.GetFullPath(args[1])));
            return;
        }
        if (args.Length >= 2 && args[0] == "--agent-bridge-test")
        {
            ApplicationConfiguration.Initialize();
            Application.Run(new AgentBridgeTestWindow(args));
            return; // Bez aktualizatora, strony publicznej, PIN-u i uruchamiania kamery.
        }
        if (args.Length == 5 && args[0] == "--apply-update")
        {
            ApplyPreparedUpdate(args);
            return;
        }
        if (StartPreparedUpdateIfAny()) return;
        CleanupOldUpdaterCopies();
        ApplicationConfiguration.Initialize();
        Application.Run(new HomeSecurityWindow());
    }

    private static string DataRoot => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "HomeSecurityDesktop");
    private static string UpdateRoot => Path.Combine(DataRoot, "Updates");
    private static string PendingUpdatePath => Path.Combine(UpdateRoot, "pending.json");
    private static string DiagnosticsRoot => Path.Combine(
        DataRoot, "Diagnostics");
    private static string WebShellMarkerPath => Path.Combine(DataRoot, "web-shell-build.txt");

    private static void WriteDiagnostic(string kind, object? detail = null)
    {
        try
        {
            Directory.CreateDirectory(DiagnosticsRoot);
            var record = new { at = DateTimeOffset.UtcNow, kind, detail };
            File.WriteAllText(Path.Combine(DiagnosticsRoot, "latest.json"), JsonSerializer.Serialize(record, new JsonSerializerOptions { WriteIndented = true }));
            File.AppendAllText(Path.Combine(DiagnosticsRoot, "events.ndjson"), JsonSerializer.Serialize(record) + Environment.NewLine);
        }
        catch { /* Diagnostyka nigdy nie może zatrzymać kamery. */ }
    }

    private static bool StartPreparedUpdateIfAny()
    {
        try
        {
            if (!File.Exists(PendingUpdatePath)) return false;
            var pending = JsonSerializer.Deserialize<PendingUpdate>(File.ReadAllText(PendingUpdatePath));
            var exe = Environment.ProcessPath;
            if (pending is null || string.IsNullOrWhiteSpace(exe) || string.IsNullOrWhiteSpace(pending.Version) ||
                pending.Sha256?.Length != 64 || string.IsNullOrWhiteSpace(pending.PackagePath) || !File.Exists(pending.PackagePath))
            {
                // A previous/incomplete schema must not block all future update checks.
                try { File.Delete(PendingUpdatePath); } catch { }
                return false;
            }
            var updaterFolder = Path.Combine(UpdateRoot, "helpers");
            Directory.CreateDirectory(updaterFolder);
            var helper = Path.Combine(updaterFolder, $"HomeSecurityDesktop.Updater.{Guid.NewGuid():N}.exe");
            File.Copy(exe, helper, true);
            var startInfo = new ProcessStartInfo(helper) { UseShellExecute = false };
            startInfo.ArgumentList.Add("--apply-update");
            startInfo.ArgumentList.Add(pending.PackagePath);
            startInfo.ArgumentList.Add(AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
            startInfo.ArgumentList.Add(Environment.ProcessId.ToString());
            startInfo.ArgumentList.Add(PendingUpdatePath);
            Process.Start(startInfo);
            return true;
        }
        catch { return false; }
    }

    // The native helper runs only after the panel has acknowledged safe recording shutdown.
    // All replacement files are backed up BEFORE touching the installed program.
    // On any failed copy or failed relaunch, put the old files back and restart the old app.
    private static void ApplyPreparedUpdate(string[] args)
    {
        var package = Path.GetFullPath(args[1]);
        var installDirectory = Path.GetFullPath(args[2]);
        var pendingPath = Path.GetFullPath(args[4]);
        // A pending request is not a generic arbitrary-directory file installer.
        var updateRoot = Path.GetFullPath(UpdateRoot) + Path.DirectorySeparatorChar;
        if (!package.StartsWith(updateRoot, StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(pendingPath, Path.GetFullPath(PendingUpdatePath), StringComparison.OrdinalIgnoreCase) ||
            !Directory.Exists(installDirectory) || !File.Exists(package) || !File.Exists(pendingPath)) return;

        string? staging = null;
        string? backupRoot = null;
        var originals = new List<(string Destination, string? Backup)>();
        var startedReplacing = false;
        var rollbackOk = true;
        var success = false;
        var parentStopped = false;
        try
        {
            if (!int.TryParse(args[3], out var parentPid) || parentPid <= 0)
                throw new InvalidDataException("Nieprawidłowy proces aktualizacji.");
            // Never try to overwrite a running host or companion process.
            try
            {
                using var parent = Process.GetProcessById(parentPid);
                if (!parent.WaitForExit(60000))
                    throw new IOException("Program nie zakończył jeszcze pracy. Aktualizacja wstrzymana.");
                parentStopped = true;
            }
            catch (ArgumentException) { parentStopped = true; /* The parent has already exited. */ }

            var pending = JsonSerializer.Deserialize<PendingUpdate>(File.ReadAllText(pendingPath));
            if (pending is null ||
                !string.Equals(Path.GetFullPath(pending.PackagePath), package, StringComparison.OrdinalIgnoreCase) ||
                string.IsNullOrWhiteSpace(pending.Version) ||
                pending.Sha256 is null || pending.Sha256.Length != 64 ||
                !pending.Sha256.All(Uri.IsHexDigit))
                throw new InvalidDataException("Nieprawidłowe dane aktualizacji.");

            using (var input = File.OpenRead(package))
            {
                var actualHash = Convert.ToHexString(SHA256.HashData(input));
                if (!string.Equals(actualHash, pending.Sha256, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidDataException("Pakiet aktualizacji zmienił się po pobraniu.");
            }

            staging = Path.Combine(UpdateRoot, "staging-" + Guid.NewGuid().ToString("N"));
            ZipFile.ExtractToDirectory(package, staging);
            if (!File.Exists(Path.Combine(staging, "HomeSecurityDesktop.exe")) ||
                !File.Exists(Path.Combine(staging, "Panel", "index.html")) ||
                !File.Exists(Path.Combine(staging, "Agent", pending.Version, "HomeSecurityAgent.exe")))
                throw new InvalidDataException("Pakiet nie zawiera kompletnego programu i agenta Windows.");

            // Establish the entire plan before changing ANY installed file.
            var root = installDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
                + Path.DirectorySeparatorChar;
            var plan = Directory.EnumerateFiles(staging, "*", SearchOption.AllDirectories)
                .Select(source =>
                {
                    var relative = Path.GetRelativePath(staging, source);
                    var destination = Path.GetFullPath(Path.Combine(installDirectory, relative));
                    if (Path.IsPathRooted(relative) || relative == ".." ||
                        relative.StartsWith(".." + Path.DirectorySeparatorChar, StringComparison.Ordinal) ||
                        !destination.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                        throw new InvalidDataException("Niebezpieczna ścieżka pliku aktualizacji.");
                    return (Source: source, Relative: relative, Destination: destination);
                }).ToArray();
            if (plan.Length < 3) throw new InvalidDataException("Niekompletny pakiet aktualizacji.");
            backupRoot = Path.Combine(UpdateRoot, "rollback-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(backupRoot);
            foreach (var file in plan)
            {
                string? backup = null;
                if (File.Exists(file.Destination))
                {
                    backup = Path.Combine(backupRoot, file.Relative);
                    Directory.CreateDirectory(Path.GetDirectoryName(backup)!);
                    File.Copy(file.Destination, backup, true);
                }
                originals.Add((file.Destination, backup));
            }

            startedReplacing = true;
            foreach (var file in plan)
            {
                Directory.CreateDirectory(Path.GetDirectoryName(file.Destination)!);
                File.Copy(file.Source, file.Destination, true);
            }
            // Remove the pending instruction before relaunching, to prevent an update loop.
            File.Delete(pendingPath);
            if (Process.Start(new ProcessStartInfo(Path.Combine(installDirectory, "HomeSecurityDesktop.exe"))
                { UseShellExecute = true, WorkingDirectory = installDirectory }) is null)
                throw new IOException("Windows nie uruchomił nowej wersji programu.");
            success = true;
            WriteDiagnostic("update-installed", new { pending.Version });
            try { File.Delete(package); } catch { /* A verified cache file is harmless. */ }
        }
        catch (Exception error)
        {
            WriteDiagnostic("update-apply-failed", new { error = error.Message, startedReplacing });
            if (startedReplacing)
            {
                // Restore in reverse order: never claim rollback succeeded until all files match.
                foreach (var original in originals.AsEnumerable().Reverse())
                {
                    try
                    {
                        if (original.Backup is null) { if (File.Exists(original.Destination)) File.Delete(original.Destination); }
                        else File.Copy(original.Backup, original.Destination, true);
                    }
                    catch (Exception restoreError)
                    {
                        rollbackOk = false;
                        WriteDiagnostic("update-rollback-failed", new { file = original.Destination, error = restoreError.Message });
                    }
                }
            }
            try { File.Delete(pendingPath); } catch { /* No automatic retry loop. */ }
            if (rollbackOk && parentStopped)
            {
                try
                {
                    Process.Start(new ProcessStartInfo(Path.Combine(installDirectory, "HomeSecurityDesktop.exe"))
                        { UseShellExecute = true, WorkingDirectory = installDirectory });
                }
                catch (Exception restartError)
                {
                    WriteDiagnostic("update-old-version-restart-failed", new { error = restartError.Message });
                }
            }
        }
        finally
        {
            try { if (staging is not null && Directory.Exists(staging)) Directory.Delete(staging, true); } catch { }
            // Preserve the backups if even one rollback restoration failed.
            try { if ((success || rollbackOk) && backupRoot is not null && Directory.Exists(backupRoot)) Directory.Delete(backupRoot, true); } catch { }
        }
    }

    private static void CleanupOldUpdaterCopies()
    {
        try
        {
            var folder = Path.Combine(UpdateRoot, "helpers");
            if (!Directory.Exists(folder)) return;
            foreach (var file in Directory.EnumerateFiles(folder, "HomeSecurityDesktop.Updater.*.exe")) File.Delete(file);
        }
        catch { }
    }

    private sealed class HomeSecurityWindow : Form
    {
        private readonly WebView2 webView = new() { Dock = DockStyle.Fill };
        private readonly Panel updateBar = new() { Dock = DockStyle.Top, Height = 56, Visible = false, BackColor = Color.FromArgb(19, 27, 47) };
        private readonly Label updateInfo = new() { ForeColor = Color.FromArgb(229, 235, 249), AutoEllipsis = true, TextAlign = ContentAlignment.MiddleLeft, Font = new Font("Segoe UI", 9F) };
        private readonly Button checkUpdateButton = new() { AutoSize = true, Height = 36, FlatStyle = FlatStyle.Flat, ForeColor = Color.White, BackColor = Color.FromArgb(46, 60, 96), Text = "Sprawdź aktualizacje", UseVisualStyleBackColor = false };
        private readonly Button cancelUpdateButton = new() { AutoSize = true, Height = 36, FlatStyle = FlatStyle.Flat, ForeColor = Color.White, BackColor = Color.FromArgb(78, 53, 64), Text = "Anuluj pobraną aktualizację", Visible = false, UseVisualStyleBackColor = false };
        private readonly Button updateButton = new() { AutoSize = true, Anchor = AnchorStyles.Top | AnchorStyles.Right, FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(190, 27, 50), ForeColor = Color.White, Font = new Font("Segoe UI", 10F, FontStyle.Bold), Text = "↻ Aktualizacja", UseVisualStyleBackColor = false };
        private bool checkingUpdate;
        private AgentWebViewBridge? agentBridge;
        private readonly AgentRuntime agentRuntime = new();
        private bool downloadingUpdate;
        private bool panelUnlocked;
        private DesktopUpdateManifest? offeredUpdate;
        // Check at startup, every 10 minutes and when the owner returns to the app.
        // Detection never downloads, installs or interrupts camera recording.
        private readonly System.Windows.Forms.Timer updateCheckTimer = new() { Interval = 10 * 60 * 1000 };
        private readonly ProgressBar updateProgress = new() { Dock = DockStyle.Bottom, Height = 6, Visible = false };

        private DateTimeOffset? lastSuccessfulUpdateCheckUtc;
        private DateTimeOffset? lastAttemptedUpdateCheckUtc;
        private string? lastPromptedUpdateVersion;
        private object updateState = new { type = "desktop.update.state", status = "none" };
        private TaskCompletionSource<bool>? updatePrepared;
        private string? updatePreparationId;

        private void LayoutUpdateCenter()
        {
            var right = updateBar.ClientSize.Width - 16;
            foreach (var button in new[] { updateButton, cancelUpdateButton, checkUpdateButton })
            {
                if (!button.Visible) continue;
                button.Width = Math.Max(120, button.PreferredSize.Width + 12);
                button.Height = 36;
                button.Location = new Point(Math.Max(12, right - button.Width), 8);
                right -= button.Width + 9;
            }
            updateInfo.SetBounds(16, 4, Math.Max(100, right - 24), 42);
        }

        private void PublishUpdateState(string status, string message = "", double? percent = null)
        {
            updateState = new {
                type = "desktop.update.state", status, version = offeredUpdate?.Version,
                installedVersion = DesktopVersion,
                lastCheckedUtc = lastSuccessfulUpdateCheckUtc.HasValue ? lastSuccessfulUpdateCheckUtc.Value.ToString("O") : null,
                checkIntervalMinutes = 10,
                message, percent
            };
            try { if (AgentWebViewBridge.Trusted(webView.CoreWebView2.Source)) webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(updateState)); } catch { }
            var checkedText = lastSuccessfulUpdateCheckUtc.HasValue
                ? lastSuccessfulUpdateCheckUtc.Value.ToLocalTime().ToString("dd.MM HH:mm")
                : "jeszcze nie sprawdzono";
            updateInfo.Text = $"Zainstalowana {DesktopVersion} · ostatnie sprawdzenie: {checkedText} · {message}";
            updateButton.Visible = offeredUpdate is not null || File.Exists(PendingUpdatePath);
            if (status == "staged")
            {
                updateButton.Text = "↻ Zainstaluj teraz";
                updateButton.Enabled = panelUnlocked && !downloadingUpdate;
            }
            cancelUpdateButton.Visible = File.Exists(PendingUpdatePath);
            checkUpdateButton.Enabled = !checkingUpdate && !downloadingUpdate && !File.Exists(PendingUpdatePath);
            // The owner sees the update center only after unlocking the panel.
            updateBar.Visible = panelUnlocked;
            LayoutUpdateCenter();
        }

        public HomeSecurityWindow()
        {
            Text = "HOME SECURITY Desktop";
            MinimumSize = new Size(1180, 720);
            ClientSize = new Size(1600, 950);
            StartPosition = FormStartPosition.CenterScreen;
            WindowState = FormWindowState.Maximized;
            BackColor = Color.FromArgb(7, 11, 22);
            var brandIconPath = Path.Combine(AppContext.BaseDirectory, "home-security.ico");
            Icon = File.Exists(brandIconPath) ? new Icon(brandIconPath) : SystemIcons.Shield;
            FormBorderStyle = FormBorderStyle.Sizable;
            KeyPreview = true;
            updateBar.Controls.Add(updateInfo);
            updateBar.Controls.Add(checkUpdateButton);
            updateBar.Controls.Add(cancelUpdateButton);
            updateBar.Controls.Add(updateButton);
            updateBar.Controls.Add(updateProgress);
            updateButton.Visible = false;
            checkUpdateButton.FlatAppearance.BorderColor = Color.FromArgb(120, 140, 185);
            cancelUpdateButton.FlatAppearance.BorderColor = Color.FromArgb(173, 103, 115);
            checkUpdateButton.Click += async (_, _) => { if (panelUnlocked) await CheckForUpdateAsync(); };
            cancelUpdateButton.Click += (_, _) => CancelPreparedUpdate();
            updateCheckTimer.Tick += async (_, _) => await CheckForUpdateAsync();
            Activated += async (_, _) =>
            {
                // Catch newly published versions promptly after the computer was idle.
                if (webView.CoreWebView2 is null || checkingUpdate || downloadingUpdate) return;
                if (lastAttemptedUpdateCheckUtc.HasValue &&
                    DateTimeOffset.UtcNow - lastAttemptedUpdateCheckUtc.Value < TimeSpan.FromMinutes(2)) return;
                await CheckForUpdateAsync();
                PromptForAvailableUpdate();
            };
            FormClosed += (_, _) => { updateCheckTimer.Dispose(); agentRuntime.Dispose(); };
            updateBar.Resize += (_, _) => LayoutUpdateCenter();
            updateButton.FlatAppearance.BorderColor = Color.FromArgb(255, 112, 128);
            updateButton.Click += async (_, _) => await DownloadAndPrepareOfferedUpdateAsync();
            Controls.Add(webView);
            Controls.Add(updateBar);
            Shown += async (_, _) => await StartPanelAsync();
            KeyDown += (_, e) => { if (e.KeyCode == Keys.F11) ToggleFullScreen(); };
            PublishUpdateState("none", "Sprawdzam przy uruchomieniu, co 10 minut i po powrocie do okna. Pobieranie tylko za zgodą.");
            WriteDiagnostic("desktop-start", new { version = DesktopVersion, process = Environment.ProcessId });
        }

        private async Task StartPanelAsync()
        {
            var dataPath = Path.Combine(
                DataRoot, "WebView");
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: dataPath);
            await webView.EnsureCoreWebView2Async(environment);
            // Only the existing strict read-only protocol is exposed. Media and
            // secrets remain inaccessible to arbitrary page messages.
            agentRuntime.StartMonitoring();
            agentBridge = new AgentWebViewBridge(webView.CoreWebView2);
            var recordingStorage = new RecordingStorageBridge(webView.CoreWebView2, () => panelUnlocked);
            FormClosed += (_, _) => recordingStorage.Dispose();
            await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync("window.__HOME_SECURITY_STORAGE_BRIDGE__ = true;");
            FormClosed += (_, _) => agentBridge?.Dispose();
            await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync("window.__HOME_SECURITY_AGENT_BRIDGE__ = true;");
            await RefreshWebShellIfNeededAsync();
            new BundledPanel().Attach(webView.CoreWebView2);
            await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(
                "window.__HOME_SECURITY_DESKTOP__ = true; window.__HOME_SECURITY_DEVICE__ = 'windows'; window.__HOME_SECURITY_BUNDLED_PANEL__ = true;");
            WriteDiagnostic("webview-ready", new { dataPath });

            var settings = webView.CoreWebView2.Settings;
            settings.AreDefaultContextMenusEnabled = false;
            settings.AreDevToolsEnabled = false;
            settings.AreBrowserAcceleratorKeysEnabled = true;
            settings.IsStatusBarEnabled = false;

            // Ten program jest komputerem-kamerą. Zgoda dotyczy wyłącznie
            // oficjalnej strony HOME SECURITY, nie dowolnej strony internetowej.
            webView.CoreWebView2.PermissionRequested += (_, e) =>
            {
                if (Uri.TryCreate(e.Uri, UriKind.Absolute, out var permissionUri) &&
                    string.Equals(permissionUri.Host, PublicHost, StringComparison.OrdinalIgnoreCase) &&
                    e.PermissionKind is CoreWebView2PermissionKind.Camera or CoreWebView2PermissionKind.Microphone)
                {
                    e.State = CoreWebView2PermissionState.Allow;
                    WriteDiagnostic("media-permission-allowed", new { e.Uri, permission = e.PermissionKind.ToString() });
                }
            };

            webView.CoreWebView2.WebMessageReceived += async (_, e) =>
            {
                // Never persist arbitrary page payloads, OAuth sessions or IPC arguments.
                if (e.Source != webView.CoreWebView2.Source || !AgentWebViewBridge.Trusted(e.Source)) return;
                try {
                    using var message = JsonDocument.Parse(e.WebMessageAsJson);
                    var root = message.RootElement;
                    if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("type", out var type) && type.ValueKind == JsonValueKind.String) {
                        if (type.GetString() == "desktop.update.visibility") {
                            panelUnlocked = root.TryGetProperty("visible", out var visible) && visible.ValueKind == JsonValueKind.True;
                            updateBar.Visible = panelUnlocked;
                            // Unlocking does NOT authorize an update download.
                            webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(updateState));
                            if (panelUnlocked) PromptForAvailableUpdate();
                            return;
                        }
                        if (type.GetString() == "desktop.update.query") {
                            // A query does not prove the HTML sidebar is visible. Keep the native offer.
                            webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(updateState)); return;
                        }
                        if (type.GetString() == "desktop.update.check") { if (panelUnlocked) await CheckForUpdateAsync(); return; }
                        if (type.GetString() == "desktop.update.cancel") { CancelPreparedUpdate(); return; }
                        if (type.GetString() == "desktop.update.request") {
                            if (!panelUnlocked) return;
                            // The web sidebar also uses this action for retry after a failed manifest check.
                            // With no offered version, retry discovery instead of silently doing nothing.
                            if (offeredUpdate is null) await CheckForUpdateAsync();
                            else await DownloadAndPrepareOfferedUpdateAsync();
                            return;
                        }
                        if (type.GetString() == "desktop.update.prepared") {
                            if (root.TryGetProperty("id", out var id) && id.ValueKind == JsonValueKind.String && id.GetString() == updatePreparationId)
                                updatePrepared?.TrySetResult(root.TryGetProperty("ok", out var ok) && ok.ValueKind == JsonValueKind.True);
                            return;
                        }
                    }
                } catch (JsonException) { return; }
                var safe = PanelDiagnostics.Project(e.WebMessageAsJson);
                if (safe is not null) WriteDiagnostic("panel-state", safe);
            };
            webView.CoreWebView2.NavigationStarting += (_, _) => { panelUnlocked = false; updateBar.Visible = false; };
            webView.CoreWebView2.ProcessFailed += (_, e) => WriteDiagnostic("webview-process-failed", new { reason = e.Reason.ToString(), kind = e.ProcessFailedKind.ToString() });

            webView.CoreWebView2.NewWindowRequested += (_, e) => {
                e.Handled=true;
                if(!e.IsUserInitiated||!AgentWebViewBridge.Trusted(webView.CoreWebView2.Source)||(!ExternalLinks.IsDriveFolder(e.Uri)&&!ExternalLinks.IsDocumentation(e.Uri)))return;
                try{Process.Start(new ProcessStartInfo(e.Uri){UseShellExecute=true});}
                catch(Exception error) when(error is System.ComponentModel.Win32Exception or InvalidOperationException){WriteDiagnostic("external-drive-open-failed",new{code="BROWSER_UNAVAILABLE"});}
            };
            webView.CoreWebView2.NavigationStarting += (_, e) =>
            {
                if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri) ||
                    !string.Equals(uri.Host, PublicHost, StringComparison.OrdinalIgnoreCase))
                {
                    e.Cancel = true;
                }
            };
            webView.CoreWebView2.Navigate(PanelUrl);
            WriteDiagnostic("panel-navigation", new { url = PanelUrl, source = "installed-bundle", version = DesktopVersion, installDirectory = AppContext.BaseDirectory });
            _ = CheckForUpdateAsync();
            updateCheckTimer.Start();
        }

        private async Task RefreshWebShellIfNeededAsync()
        {
            try
            {
                var installedBuild = File.Exists(WebShellMarkerPath)
                    ? File.ReadAllText(WebShellMarkerPath).Trim()
                    : string.Empty;
                // Native releases may update bundled HTML/CSS without changing
                // the live recorder's web protocol version. Include both values.
                var installedShell = DesktopVersion + ":" + WebPanelBuild;
                if (installedBuild == installedShell) return;

                // Usuwamy wyłącznie pamięć powłoki strony i service worker.
                // Sesja użytkownika, PIN i pozostałe ustawienia nie są kasowane.
                await webView.CoreWebView2.CallDevToolsProtocolMethodAsync("Network.clearBrowserCache", "{}");
                await webView.CoreWebView2.CallDevToolsProtocolMethodAsync(
                    "Storage.clearDataForOrigin",
                    "{\"origin\":\"https://dominiksolorz.github.io\",\"storageTypes\":\"cache_storage,service_workers\"}");
                Directory.CreateDirectory(DataRoot);
                File.WriteAllText(WebShellMarkerPath, installedShell);
                WriteDiagnostic("web-shell-cache-cleared", new { build = WebPanelBuild });
            }
            catch (Exception ex)
            {
                WriteDiagnostic("web-shell-cache-clear-failed", new { build = WebPanelBuild, error = ex.Message });
            }
        }

        private void ToggleFullScreen()
        {
            var fullScreen = FormBorderStyle == FormBorderStyle.None;
            FormBorderStyle = fullScreen ? FormBorderStyle.Sizable : FormBorderStyle.None;
            WindowState = FormWindowState.Maximized;
        }

        private async Task CheckForUpdateAsync()
        {
            if (checkingUpdate || downloadingUpdate) return;
            if (File.Exists(PendingUpdatePath))
            {
                PublishUpdateState("staged", "Aktualizacja jest pobrana. Kliknij „Zainstaluj teraz”, aby bezpiecznie zapisać nagranie, zainstalować nową wersję i uruchomić program ponownie.");
                return;
            }
            checkingUpdate = true;
            lastAttemptedUpdateCheckUtc = DateTimeOffset.UtcNow;
            PublishUpdateState("checking", "Sprawdzam oficjalny kanał aktualizacji Windows…");
            try
            {
                using var manifestDeadline = new CancellationTokenSource(TimeSpan.FromSeconds(20));
                var manifest = await Http.GetFromJsonAsync<DesktopUpdateManifest>($"{UpdateManifestUrl}?t={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}", manifestDeadline.Token);
                if (manifest is null || !Version.TryParse(manifest.Version, out var available))
                    throw new InvalidDataException("Kanał aktualizacji nie podał poprawnej wersji.");
                var installed = Version.Parse(DesktopVersion);
                if (available > installed &&
                    (!Uri.TryCreate(manifest.PackageUrl, UriKind.Absolute, out var packageUri) ||
                     packageUri.Scheme != "https" || packageUri.Host != PublicHost ||
                     packageUri.Port != 443 || packageUri.UserInfo.Length != 0 ||
                     !packageUri.AbsolutePath.StartsWith("/kamera/updates/", StringComparison.Ordinal) ||
                     manifest.Sha256?.Length != 64 || !manifest.Sha256.All(Uri.IsHexDigit)))
                    throw new InvalidDataException("Nowe wydanie ma nieprawidłowe źródło lub sumę kontrolną.");
                lastSuccessfulUpdateCheckUtc = DateTimeOffset.UtcNow;
                WriteDiagnostic("update-manifest", new { installed = DesktopVersion, available = manifest.Version });
                if (available <= installed)
                {
                    offeredUpdate = null;
                    PublishUpdateState("current", $"Wersja {DesktopVersion} jest aktualna. Kolejna kontrola automatycznie za 10 minut lub po powrocie do programu.");
                    return;
                }
                offeredUpdate = manifest;
                ShowUpdateOffer(manifest.Version);
                WriteDiagnostic("update-offered", new { manifest.Version });
            }
            catch (Exception ex)
            {
                WriteDiagnostic("update-check-failed", new { error = ex.Message });
                if (offeredUpdate is not null)
                    PublishUpdateState("available", $"Nie udało się ponownie sprawdzić kanału. Ostatnio wykryto {offeredUpdate.Version}. Możesz ponowić sprawdzenie.");
                else
                    PublishUpdateState("error", "Nie udało się sprawdzić aktualizacji. Sprawdź internet i ponów próbę.");
            }
            finally
            {
                checkingUpdate = false;
                checkUpdateButton.Enabled = !downloadingUpdate && !File.Exists(PendingUpdatePath);
                if (updateCheckTimer.Enabled) { updateCheckTimer.Stop(); updateCheckTimer.Start(); }
            }
        }

        // Download only after explicit owner click. Once verified, ask the recorder to
        // flush its last segment before launching the existing rollback-safe updater.
        private void ShowUpdateOffer(string version)
        {
            updateButton.Text = $"↻ Zaktualizuj do wersji {version}";
            updateButton.Enabled = true;
            PublishUpdateState("available", "NOWA WERSJA. Wybierz „Zaktualizuj”, aby ją pobrać, bezpiecznie domknąć nagranie, zainstalować i automatycznie uruchomić program ponownie.");
            PromptForAvailableUpdate();
        }

        // Announce every NEW version once per running desktop session.
        // The owner can defer it; the normal toolbar remains available afterwards.
        // Only a confirmed click may download. No modal before account + PIN unlock.
        private void PromptForAvailableUpdate()
        {
            if (!panelUnlocked || offeredUpdate is null || downloadingUpdate ||
                File.Exists(PendingUpdatePath) || !IsHandleCreated || IsDisposed) return;
            var version = offeredUpdate.Version;
            if (lastPromptedUpdateVersion == version) return;
            lastPromptedUpdateVersion = version;
            BeginInvoke(new Action(async () =>
            {
                if (IsDisposed || !panelUnlocked || downloadingUpdate ||
                    offeredUpdate?.Version != version || File.Exists(PendingUpdatePath)) return;
                var answer = MessageBox.Show(this,
                    $"Dostępna jest aktualizacja HOME SECURITY Desktop {version}.\n\n" +
                    $"Zainstalowana wersja: {DesktopVersion}.\n\n" +
                    "Pobrać i zainstalować teraz? Przed restartem ostatni fragment nagrania zostanie zapisany. " +
                    "Program zamknie się, zaktualizuje i uruchomi ponownie. Jeśli nie można zapisać nagrania, instalacja nie ruszy.",
                    "HOME SECURITY · Dostępna aktualizacja",
                    MessageBoxButtons.YesNo, MessageBoxIcon.Information,
                    MessageBoxDefaultButton.Button2);
                if (answer == DialogResult.Yes)
                    await DownloadAndPrepareOfferedUpdateAsync();
            }));
        }

        private void CancelPreparedUpdate()
        {
            if (!panelUnlocked || downloadingUpdate) return;
            try
            {
                if (!File.Exists(PendingUpdatePath)) return;
                // The pending instruction belongs to the updater; never remove
                // arbitrary user files or recordings through a supplied path.
                File.Delete(PendingUpdatePath);
                offeredUpdate = null;
                updateButton.Enabled = true;
                PublishUpdateState("current", "Anulowano instalację przy następnym uruchomieniu. Twoje nagrania nie zostały zmienione.");
                WriteDiagnostic("update-cancelled", new { installed = DesktopVersion });
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                PublishUpdateState("error", "Nie udało się anulować przygotowanej aktualizacji. " + ex.Message);
            }
        }

        // The user consented by clicking "Zaktualizuj" or Yes on the offered-version prompt.
        // Do not exit until the camera confirms that its current recording fragment was saved.
        // If anything fails, leave the verified package staged for retry and keep Windows running.
        private async Task<bool> RestartIntoPreparedUpdateAsync()
        {
            if (!panelUnlocked || !File.Exists(PendingUpdatePath) ||
                webView.CoreWebView2 is null || !AgentWebViewBridge.Trusted(webView.CoreWebView2.Source))
            {
                PublishUpdateState("staged", "Pakiet jest pobrany, ale panel nie jest gotowy do bezpiecznego restartu. Odblokuj HOME SECURITY i wybierz „Zainstaluj teraz”.");
                return false;
            }
            updatePreparationId = Guid.NewGuid().ToString("N");
            updatePrepared = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            try
            {
                PublishUpdateState("preparing", "Zapisuję ostatni fragment nagrania przed instalacją. Nie wyłączaj komputera.");
                webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new {
                    type = "desktop.update.prepare", id = updatePreparationId
                }));
                var recorderReady = await updatePrepared.Task.WaitAsync(TimeSpan.FromMinutes(2));
                if (!recorderReady)
                    throw new IOException("Nagranie nie zostało bezpiecznie zapisane. Aktualizacja wstrzymana.");
                if (!panelUnlocked || IsDisposed || !File.Exists(PendingUpdatePath))
                    throw new InvalidOperationException("Sesja została zamknięta przed instalacją.");
                PublishUpdateState("installing", "Nagranie zapisane. Zamykanie, instalowanie i automatyczne ponowne uruchamianie programu…");
                WriteDiagnostic("update-restart-authorized", new { installed = DesktopVersion });
                // Spawn the already implemented independent helper. It waits until our process
                // has exited, verifies SHA-256 again, backs up installed files, and relaunches.
                if (!StartPreparedUpdateIfAny())
                    throw new IOException("Nie udało się uruchomić instalatora aktualizacji.");
                Close();
                return true;
            }
            catch (Exception error)
            {
                WriteDiagnostic("update-auto-restart-blocked", new { error = error.Message });
                if (webView.CoreWebView2 is not null && updatePreparationId is not null)
                {
                    try
                    {
                        webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new {
                            type = "desktop.update.abort", id = updatePreparationId
                        }));
                    }
                    catch { /* Manual PIN and camera must remain available. */ }
                }
                if (!IsDisposed)
                    PublishUpdateState("staged", "Aktualizacja pobrana, ale automatyczny restart nie powiódł się: " +
                        error.Message + " Kliknij „Zainstaluj teraz”, aby ponowić po sprawdzeniu nagrań.");
                return false;
            }
            finally
            {
                updatePrepared = null;
                updatePreparationId = null;
            }
        }

        private async Task DownloadAndPrepareOfferedUpdateAsync()
        {
            if (!panelUnlocked || downloadingUpdate) return;
            // A previous download may already be verified; the same button retries
            // the safe restart, never redownloads or silently abandons a package.
            if (File.Exists(PendingUpdatePath))
            {
                downloadingUpdate = true;
                try { await RestartIntoPreparedUpdateAsync(); }
                finally
                {
                    downloadingUpdate = false;
                    if (!IsDisposed)
                        updateButton.Enabled = panelUnlocked && File.Exists(PendingUpdatePath);
                }
                return;
            }
            if (offeredUpdate is null) return;
            downloadingUpdate = true;
            var manifest = offeredUpdate;
            updateButton.Enabled = false;
            updateButton.Text = "Pobieranie aktualizacji…";
            try
            {
                Directory.CreateDirectory(UpdateRoot);
                var packagePath = Path.Combine(UpdateRoot, $"HomeSecurityDesktop-{manifest.Version}.zip");
                var temporaryPath = packagePath + ".download";
                PublishUpdateState("downloading", "Pobieranie aktualizacji…");
                updateProgress.Visible = true;
                using (var response = await Http.GetAsync(manifest.PackageUrl, HttpCompletionOption.ResponseHeadersRead)) {
                    using var downloadDeadline = new CancellationTokenSource(TimeSpan.FromMinutes(15));
                    response.EnsureSuccessStatusCode();
                    var total = response.Content.Headers.ContentLength;
                    await using var source = await response.Content.ReadAsStreamAsync();
                    await using var target = File.Create(temporaryPath);
                    var buffer = new byte[65536]; long received = 0; var lastReport = Stopwatch.StartNew();
                    int length;
                    while ((length = await source.ReadAsync(buffer, downloadDeadline.Token)) != 0) {
                        await target.WriteAsync(buffer.AsMemory(0, length), downloadDeadline.Token); received += length;
                        if (lastReport.ElapsedMilliseconds < 150 && received != total) continue;
                        lastReport.Restart();
                        double? percent = total is > 0 ? Math.Min(100, 100.0 * received / total.Value) : null;
                        updateProgress.Style = percent.HasValue ? ProgressBarStyle.Continuous : ProgressBarStyle.Marquee;
                        if (percent.HasValue) updateProgress.Value = (int)percent.Value;
                        PublishUpdateState("downloading", percent.HasValue ? $"Pobrano {percent.Value:0}%" : $"Pobrano {received / 1048576} MB", percent);
                    }
                    if (total.HasValue && received != total.Value) throw new InvalidDataException("Pobieranie nie jest kompletne.");
                }
                PublishUpdateState("verifying", "Sprawdzanie pakietu…");
                string downloadedHash;
                await using (var packageStream = File.OpenRead(temporaryPath))
                {
                    downloadedHash = Convert.ToHexString(await SHA256.HashDataAsync(packageStream));
                }
                if (!string.Equals(downloadedHash, manifest.Sha256, StringComparison.OrdinalIgnoreCase))
                {
                    File.Delete(temporaryPath);
                    WriteDiagnostic("update-hash-mismatch", new { manifest.Version, downloadedHash });
                    throw new InvalidDataException("Pobrany pakiet ma nieprawidłową sumę kontrolną.");
                }
                File.Move(temporaryPath, packagePath, true);
                var pendingTemporaryPath = PendingUpdatePath + ".tmp";
                File.WriteAllText(pendingTemporaryPath, JsonSerializer.Serialize(new PendingUpdate(packagePath, manifest.Version, manifest.Sha256)));
                File.Move(pendingTemporaryPath, PendingUpdatePath, true);
                WriteDiagnostic("update-ready", new { manifest.Version, packagePath });
                updateButton.Text = $"Wersja {manifest.Version} gotowa";
                PublishUpdateState("staged", "Pakiet sprawdzony. Zapisuję nagranie i przygotowuję automatyczny restart…");
                await RestartIntoPreparedUpdateAsync();
            }
            catch (Exception ex)
            {
                if (updatePreparationId is not null) {
                    try { webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new { type = "desktop.update.abort", id = updatePreparationId })); } catch { }
                }
                WriteDiagnostic("update-download-failed", new { manifest.Version, error = ex.Message });
                updateButton.Enabled = true;
                updateButton.Text = $"↻ Spróbuj ponownie: {manifest.Version}";
                PublishUpdateState("error", "Aktualizacja nie została zainstalowana. " + ex.Message);
            }
            finally
            {
                downloadingUpdate = false;
                updatePrepared = null;
                updatePreparationId = null;
                if (!IsDisposed)
                {
                    updateProgress.Visible = false;
                    checkUpdateButton.Enabled = !File.Exists(PendingUpdatePath);
                    if (File.Exists(PendingUpdatePath))
                        updateButton.Enabled = panelUnlocked;
                }
            }
        }

    }

    private sealed record DesktopUpdateManifest(string Version, string PackageUrl, string Sha256);
    private sealed record PendingUpdate(string PackagePath, string Version, string Sha256);
}

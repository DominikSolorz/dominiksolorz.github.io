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
    private const string DesktopVersion = "1.4.0";
    private const string WebPanelBuild = "202";
    // Desktop serves its installed Panel bundle at the existing trusted origin.
    // The website and installed UI can now be released independently without
    // migrating the user's existing session, PIN or IndexedDB recordings.
    private const string PanelUrl = "https://dominiksolorz.github.io/kamera/?desktop=1&native=windows&host=computer&ui_build=" + WebPanelBuild;
    private const string PublicHost = "dominiksolorz.github.io";
    private const string UpdateManifestUrl = "https://dominiksolorz.github.io/kamera/desktop-update.json";
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromMinutes(4) };

    [STAThread]
    private static void Main(string[] args)
    {
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
            if (pending is null || string.IsNullOrWhiteSpace(exe) || !File.Exists(pending.PackagePath)) return false;
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

    private static void ApplyPreparedUpdate(string[] args)
    {
        var package = args[1];
        var installDirectory = args[2];
        var pendingPath = args[4];
        try
        {
            if (int.TryParse(args[3], out var parentPid))
            {
                try { Process.GetProcessById(parentPid).WaitForExit(60000); } catch { }
            }
            if (!File.Exists(package) || !Directory.Exists(installDirectory)) return;
            var staging = Path.Combine(Path.GetDirectoryName(installDirectory)!, $".home-security-update-{Guid.NewGuid():N}");
            ZipFile.ExtractToDirectory(package, staging);
            foreach (var source in Directory.EnumerateFiles(staging, "*", SearchOption.AllDirectories))
            {
                var relative = Path.GetRelativePath(staging, source);
                var destination = Path.Combine(installDirectory, relative);
                Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
                File.Copy(source, destination, true);
            }
            File.Delete(pendingPath);
            File.Delete(package);
            Process.Start(new ProcessStartInfo(Path.Combine(installDirectory, "HomeSecurityDesktop.exe")) { UseShellExecute = true });
            Directory.Delete(staging, true);
        }
        catch { /* Zachowujemy poprzedni program oraz pakiet do kolejnej próby. */ }
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
        private readonly Panel updateBar = new() { Dock = DockStyle.Top, Height = 48, Visible = false, BackColor = Color.FromArgb(43, 14, 19) };
        private readonly Button updateButton = new() { AutoSize = true, Anchor = AnchorStyles.Top | AnchorStyles.Right, FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(190, 27, 50), ForeColor = Color.White, Font = new Font("Segoe UI", 10F, FontStyle.Bold), Text = "↻ Aktualizacja", UseVisualStyleBackColor = false };
        private bool checkingUpdate;
        private AgentWebViewBridge? agentBridge;
        private bool downloadingUpdate;
        private DesktopUpdateManifest? offeredUpdate;
        private readonly System.Windows.Forms.Timer updateCheckTimer = new() { Interval = 15 * 60 * 1000 };
        private readonly ProgressBar updateProgress = new() { Dock = DockStyle.Bottom, Height = 6, Visible = false };
        private bool sidebarUpdateReady;
        private object updateState = new { type = "desktop.update.state", status = "none" };
        private TaskCompletionSource<bool>? updatePrepared;
        private string? updatePreparationId;

        private void PublishUpdateState(string status, string message = "", double? percent = null)
        {
            updateState = new { type = "desktop.update.state", status, version = offeredUpdate?.Version, message, percent };
            try { if (AgentWebViewBridge.Trusted(webView.CoreWebView2.Source)) webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(updateState)); } catch { }
            updateBar.Visible = !sidebarUpdateReady && status != "none";
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
            updateBar.Controls.Add(updateButton);
            updateBar.Controls.Add(updateProgress);
            updateCheckTimer.Tick += async (_, _) => await CheckForUpdateAsync();
            FormClosed += (_, _) => updateCheckTimer.Dispose();
            updateBar.Resize += (_, _) => updateButton.Location = new Point(Math.Max(12, updateBar.ClientSize.Width - updateButton.Width - 16), 8);
            updateButton.FlatAppearance.BorderColor = Color.FromArgb(255, 112, 128);
            updateButton.Click += async (_, _) => await DownloadAndPrepareOfferedUpdateAsync();
            Controls.Add(webView);
            Controls.Add(updateBar);
            Shown += async (_, _) => await StartPanelAsync();
            KeyDown += (_, e) => { if (e.KeyCode == Keys.F11) ToggleFullScreen(); };
            WriteDiagnostic("desktop-start", new { version = DesktopVersion, process = Environment.ProcessId });
        }

        private async Task StartPanelAsync()
        {
            var dataPath = Path.Combine(
                DataRoot, "WebView");
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: dataPath);
            await webView.EnsureCoreWebView2Async(environment);
            // Włączane wyłącznie dla testów nowej architektury; nie uruchamia agenta ani kamery.
            if (Environment.GetEnvironmentVariable("HOME_SECURITY_AGENT_BRIDGE") == "1")
            {
                agentBridge = new AgentWebViewBridge(webView.CoreWebView2);
                FormClosed += (_, _) => agentBridge?.Dispose();
                await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync("window.__HOME_SECURITY_AGENT_BRIDGE__ = true;");
            }
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
                        if (type.GetString() == "desktop.update.query") {
                            sidebarUpdateReady = true; updateBar.Visible = false;
                            webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(updateState)); return;
                        }
                        if (type.GetString() == "desktop.update.request") { await DownloadAndPrepareOfferedUpdateAsync(); return; }
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
            webView.CoreWebView2.ProcessFailed += (_, e) => WriteDiagnostic("webview-process-failed", new { reason = e.Reason.ToString(), kind = e.ProcessFailedKind.ToString() });

            webView.CoreWebView2.NewWindowRequested += (_, e) => e.Handled = true;
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
                if (installedBuild == WebPanelBuild) return;

                // Usuwamy wyłącznie pamięć powłoki strony i service worker.
                // Sesja użytkownika, PIN i pozostałe ustawienia nie są kasowane.
                await webView.CoreWebView2.CallDevToolsProtocolMethodAsync("Network.clearBrowserCache", "{}");
                await webView.CoreWebView2.CallDevToolsProtocolMethodAsync(
                    "Storage.clearDataForOrigin",
                    "{\"origin\":\"https://dominiksolorz.github.io\",\"storageTypes\":\"cache_storage,service_workers\"}");
                Directory.CreateDirectory(DataRoot);
                File.WriteAllText(WebShellMarkerPath, WebPanelBuild);
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
            if (checkingUpdate || downloadingUpdate || File.Exists(PendingUpdatePath)) return;
            checkingUpdate = true;
            try
            {
                var manifest = await Http.GetFromJsonAsync<DesktopUpdateManifest>($"{UpdateManifestUrl}?t={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}");
                WriteDiagnostic("update-manifest", new { installed = DesktopVersion, available = manifest?.Version });
                if (manifest is null || !Version.TryParse(manifest.Version, out var available) || available <= Version.Parse(DesktopVersion)) return;
                if (!Uri.TryCreate(manifest.PackageUrl, UriKind.Absolute, out var packageUri) || packageUri.Scheme != "https" || packageUri.Host != PublicHost || packageUri.Port != 443 || packageUri.UserInfo.Length != 0 || !packageUri.AbsolutePath.StartsWith("/kamera/updates/", StringComparison.Ordinal) || manifest.Sha256?.Length != 64 || !manifest.Sha256.All(Uri.IsHexDigit)) return;
                offeredUpdate = manifest;
                BeginInvoke(() => ShowUpdateOffer(manifest.Version));
                WriteDiagnostic("update-offered", new { manifest.Version });
            }
            catch (Exception ex) { WriteDiagnostic("update-check-failed", new { error = ex.Message }); }
            finally { checkingUpdate = false; }
        }

        // Samo sprawdzenie wersji nie pobiera plików i nie restartuje programu.
        // Aktualizacja następuje dopiero po wyraźnym kliknięciu użytkownika.
        private void ShowUpdateOffer(string version)
        {
            updateButton.Text = $"↻ Aktualizuj do wersji {version}";
            updateButton.Location = new Point(Math.Max(12, updateBar.ClientSize.Width - updateButton.Width - 16), 8);
            PublishUpdateState("available", "Nowa wersja jest gotowa do pobrania.");
        }

        private async Task DownloadAndPrepareOfferedUpdateAsync()
        {
            if (downloadingUpdate || offeredUpdate is null) return;
            downloadingUpdate = true;
            var manifest = offeredUpdate;
            if (MessageBox.Show(this, $"Pobrać i zainstalować wersję {manifest.Version}? Program najpierw zapisze bieżący fragment. Aktualizacja może spowodować krótką przerwę w nagrywaniu.", "Aktualizacja HOME SECURITY", MessageBoxButtons.YesNo, MessageBoxIcon.Information) != DialogResult.Yes) { downloadingUpdate = false; return; }
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
                    using var downloadDeadline = new CancellationTokenSource(TimeSpan.FromMinutes(4));
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
                PublishUpdateState("preparing", "Zapisywanie bieżącego fragmentu nagrania…");
                updatePreparationId = Guid.NewGuid().ToString();
                updatePrepared = new(TaskCreationOptions.RunContinuationsAsynchronously);
                webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new { type = "desktop.update.prepare", id = updatePreparationId }));
                bool prepared;
                try { prepared = await updatePrepared.Task.WaitAsync(TimeSpan.FromSeconds(60)); }
                catch (TimeoutException) { prepared = false; }
                if (!prepared) {
                    webView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new { type = "desktop.update.abort", id = updatePreparationId }));
                    throw new InvalidDataException("Brak potwierdzenia bezpiecznego zapisu nagrania. Aktualizacja wstrzymana.");
                }
                File.WriteAllText(PendingUpdatePath, JsonSerializer.Serialize(new PendingUpdate(packagePath)));
                WriteDiagnostic("update-ready", new { manifest.Version, packagePath });
                RestartIntoPreparedUpdate(manifest.Version);
                PublishUpdateState("installing", "Pakiet sprawdzony. Ponowne uruchamianie programu…");
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
            finally { downloadingUpdate = false; updateProgress.Visible = false; updatePrepared = null; updatePreparationId = null; }
        }

        private void RestartIntoPreparedUpdate(string version)
        {
            Text = $"HOME SECURITY Desktop · instaluję aktualizację {version}…";
            var timer = new System.Windows.Forms.Timer { Interval = 2500 };
            timer.Tick += (_, _) =>
            {
                timer.Stop();
                timer.Dispose();
                Application.Restart();
            };
            timer.Start();
        }
    }

    private sealed record DesktopUpdateManifest(string Version, string PackageUrl, string Sha256);
    private sealed record PendingUpdate(string PackagePath);
}

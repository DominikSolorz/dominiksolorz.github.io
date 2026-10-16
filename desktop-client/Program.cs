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
    private const string DesktopVersion = "1.3.4";
    private const string WebPanelBuild = "185";
    // Jedna kanoniczna powłoka: EXE oraz Chrome wyświetlają tę samą
    // opublikowaną stronę. Tylko to EXE przekazuje do strony chroniony znacznik
    // Desktop, który pozwala udostępnić kamerę i mikrofon.
    private const string PanelUrl = "https://dominiksolorz.github.io/kamera/?desktop=1&native=windows&host=computer&ui_build=" + WebPanelBuild;
    private const string PublicHost = "dominiksolorz.github.io";
    private const string UpdateManifestUrl = "https://dominiksolorz.github.io/kamera/desktop-update.json";
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromMinutes(4) };

    [STAThread]
    private static void Main(string[] args)
    {
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

        public HomeSecurityWindow()
        {
            Text = "HOME SECURITY Desktop";
            MinimumSize = new Size(1180, 720);
            ClientSize = new Size(1600, 950);
            StartPosition = FormStartPosition.CenterScreen;
            WindowState = FormWindowState.Maximized;
            BackColor = Color.FromArgb(7, 11, 22);
            Icon = SystemIcons.Shield;
            FormBorderStyle = FormBorderStyle.Sizable;
            KeyPreview = true;
            updateBar.Controls.Add(updateButton);
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
            await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(
                "window.__HOME_SECURITY_DESKTOP__ = true; window.__HOME_SECURITY_DEVICE__ = 'windows';");
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

            webView.CoreWebView2.WebMessageReceived += (_, e) =>
            {
                // Never persist arbitrary page payloads, OAuth sessions or IPC arguments.
                if (e.Source != webView.CoreWebView2.Source || !AgentWebViewBridge.Trusted(e.Source)) return;
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
            WriteDiagnostic("panel-navigation", new { url = PanelUrl });
            _ = CheckForUpdateAsync();
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
            if (checkingUpdate || File.Exists(PendingUpdatePath)) return;
            checkingUpdate = true;
            try
            {
                var manifest = await Http.GetFromJsonAsync<DesktopUpdateManifest>($"{UpdateManifestUrl}?t={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}");
                WriteDiagnostic("update-manifest", new { installed = DesktopVersion, available = manifest?.Version });
                if (manifest is null || !Version.TryParse(manifest.Version, out var available) || available <= Version.Parse(DesktopVersion)) return;
                if (string.IsNullOrWhiteSpace(manifest.PackageUrl) || string.IsNullOrWhiteSpace(manifest.Sha256)) return;
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
            updateBar.Visible = true;
        }

        private async Task DownloadAndPrepareOfferedUpdateAsync()
        {
            if (downloadingUpdate || offeredUpdate is null) return;
            downloadingUpdate = true;
            var manifest = offeredUpdate;
            updateButton.Enabled = false;
            updateButton.Text = "Pobieranie aktualizacji…";
            try
            {
                Directory.CreateDirectory(UpdateRoot);
                var packagePath = Path.Combine(UpdateRoot, $"HomeSecurityDesktop-{manifest.Version}.zip");
                var temporaryPath = packagePath + ".download";
                using (var source = await Http.GetStreamAsync(manifest.PackageUrl))
                using (var target = File.Create(temporaryPath)) await source.CopyToAsync(target);
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
                File.WriteAllText(PendingUpdatePath, JsonSerializer.Serialize(new PendingUpdate(packagePath)));
                WriteDiagnostic("update-ready", new { manifest.Version, packagePath });
                RestartIntoPreparedUpdate(manifest.Version);
            }
            catch (Exception ex)
            {
                WriteDiagnostic("update-download-failed", new { manifest.Version, error = ex.Message });
                updateButton.Enabled = true;
                updateButton.Text = $"↻ Spróbuj ponownie: {manifest.Version}";
            }
            finally { downloadingUpdate = false; }
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

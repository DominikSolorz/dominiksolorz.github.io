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
    private const string DesktopVersion = "1.1.1";
    // Jedna kanoniczna powłoka: EXE oraz Chrome wyświetlają tę samą
    // opublikowaną stronę. Tylko to EXE przekazuje do strony chroniony znacznik
    // Desktop, który pozwala udostępnić kamerę i mikrofon.
    private const string PanelUrl = "https://dominiksolorz.github.io/kamera/?desktop=1&native=windows&host=computer";
    private const string PublicHost = "dominiksolorz.github.io";
    private const string UpdateManifestUrl = "https://dominiksolorz.github.io/kamera/desktop-update.json";
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromMinutes(4) };

    [STAThread]
    private static void Main(string[] args)
    {
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

    private static string UpdateRoot => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "HomeSecurityDesktop", "Updates");
    private static string PendingUpdatePath => Path.Combine(UpdateRoot, "pending.json");

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
            Process.Start(new ProcessStartInfo(helper,
                $"--apply-update \"{pending.PackagePath}\" \"{AppContext.BaseDirectory}\" {Environment.ProcessId} \"{PendingUpdatePath}\"")
            { UseShellExecute = false });
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
        private readonly System.Windows.Forms.Timer updateTimer = new() { Interval = 4 * 60 * 60 * 1000 };
        private bool checkingUpdate;

        public HomeSecurityWindow()
        {
            Text = "HOME SECURITY Desktop";
            MinimumSize = new Size(1180, 720);
            ClientSize = new Size(1600, 950);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(7, 11, 22);
            Icon = SystemIcons.Shield;
            FormBorderStyle = FormBorderStyle.Sizable;
            Controls.Add(webView);
            Shown += async (_, _) => await StartPanelAsync();
        }

        private async Task StartPanelAsync()
        {
            var dataPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "HomeSecurityDesktop", "WebView");
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: dataPath);
            await webView.EnsureCoreWebView2Async(environment);
            await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(
                "Object.defineProperty(window, '__HOME_SECURITY_DESKTOP__', { value: true, configurable: false, writable: false });");

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
                }
            };

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
            _ = CheckForUpdateAsync();
            updateTimer.Tick += async (_, _) => await CheckForUpdateAsync();
            updateTimer.Start();
        }

        private async Task CheckForUpdateAsync()
        {
            if (checkingUpdate || File.Exists(PendingUpdatePath)) return;
            checkingUpdate = true;
            try
            {
                var manifest = await Http.GetFromJsonAsync<DesktopUpdateManifest>($"{UpdateManifestUrl}?t={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}");
                if (manifest is null || !Version.TryParse(manifest.Version, out var available) || available <= Version.Parse(DesktopVersion)) return;
                if (string.IsNullOrWhiteSpace(manifest.PackageUrl) || string.IsNullOrWhiteSpace(manifest.Sha256)) return;
                Directory.CreateDirectory(UpdateRoot);
                var packagePath = Path.Combine(UpdateRoot, $"HomeSecurityDesktop-{manifest.Version}.zip");
                var temporaryPath = packagePath + ".download";
                using (var source = await Http.GetStreamAsync(manifest.PackageUrl))
                using (var target = File.Create(temporaryPath)) await source.CopyToAsync(target);
                await using var packageStream = File.OpenRead(temporaryPath);
                var downloadedHash = Convert.ToHexString(await SHA256.HashDataAsync(packageStream));
                if (!string.Equals(downloadedHash, manifest.Sha256, StringComparison.OrdinalIgnoreCase))
                {
                    File.Delete(temporaryPath);
                    return;
                }
                File.Move(temporaryPath, packagePath, true);
                File.WriteAllText(PendingUpdatePath, JsonSerializer.Serialize(new PendingUpdate(packagePath)));
                BeginInvoke(() => Text = $"HOME SECURITY Desktop · aktualizacja {manifest.Version} gotowa przy następnym uruchomieniu");
            }
            catch { /* Brak sieci nie blokuje kamery ani bieżącej pracy programu. */ }
            finally { checkingUpdate = false; }
        }
    }

    private sealed record DesktopUpdateManifest(string Version, string PackageUrl, string Sha256);
    private sealed record PendingUpdate(string PackagePath);
}

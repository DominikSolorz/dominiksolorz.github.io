using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace HomeSecurityDesktop;

internal static class Program
{
    // EXE ładuje pliki dołączone do instalacji z lokalnego, bezpiecznego hosta.
    // Dzięki temu komputer-kamera nie zależy od otwartej karty Chrome ani od
    // chwilowej dostępności GitHub Pages; telefon otrzymuje obraz przez istniejący
    // kanał WebRTC, ale nie ma dostępu do kamery urządzenia Windows.
    private const string PanelUrl = "https://home-security.local/index.html?desktop=1&native=windows&host=computer";
    private const string LocalHost = "home-security.local";

    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new HomeSecurityWindow());
    }

    private sealed class HomeSecurityWindow : Form
    {
        private readonly WebView2 webView = new() { Dock = DockStyle.Fill };

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

            var contentPath = Path.Combine(AppContext.BaseDirectory, "kamera");
            if (!Directory.Exists(contentPath))
            {
                MessageBox.Show(
                    "Brakuje lokalnych plików HOME SECURITY. Zainstaluj kompletną paczkę aplikacji.",
                    "HOME SECURITY Desktop", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
                return;
            }
            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                LocalHost, contentPath, CoreWebView2HostResourceAccessKind.Allow);

            var settings = webView.CoreWebView2.Settings;
            settings.AreDefaultContextMenusEnabled = false;
            settings.AreDevToolsEnabled = false;
            settings.AreBrowserAcceleratorKeysEnabled = true;
            settings.IsStatusBarEnabled = false;

            // Ten program jest komputerem-kamerą. Zgoda dotyczy wyłącznie
            // lokalnego hosta aplikacji, nie dowolnej strony internetowej.
            webView.CoreWebView2.PermissionRequested += (_, e) =>
            {
                if (Uri.TryCreate(e.Uri, UriKind.Absolute, out var permissionUri) &&
                    string.Equals(permissionUri.Host, LocalHost, StringComparison.OrdinalIgnoreCase) &&
                    e.PermissionKind is CoreWebView2PermissionKind.Camera or CoreWebView2PermissionKind.Microphone)
                {
                    e.State = CoreWebView2PermissionState.Allow;
                }
            };

            webView.CoreWebView2.NewWindowRequested += (_, e) => e.Handled = true;
            webView.CoreWebView2.NavigationStarting += (_, e) =>
            {
                if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri) ||
                    !string.Equals(uri.Host, LocalHost, StringComparison.OrdinalIgnoreCase))
                {
                    e.Cancel = true;
                }
            };
            webView.CoreWebView2.Navigate(PanelUrl);
        }
    }
}

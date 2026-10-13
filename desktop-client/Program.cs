using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace HomeSecurityDesktop;

internal static class Program
{
    // Jedna kanoniczna powłoka: EXE oraz Chrome wyświetlają tę samą
    // opublikowaną stronę. Tylko to EXE przekazuje do strony chroniony znacznik
    // Desktop, który pozwala udostępnić kamerę i mikrofon.
    private const string PanelUrl = "https://dominiksolorz.github.io/kamera/?desktop=1&native=windows&host=computer";
    private const string PublicHost = "dominiksolorz.github.io";

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
        }
    }
}

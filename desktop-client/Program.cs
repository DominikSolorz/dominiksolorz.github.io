using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace HomeSecurityDesktop;

internal static class Program
{
    private const string PanelUrl = "https://dominiksolorz.github.io/kamera/?desktop=1&native=windows";

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

            var settings = webView.CoreWebView2.Settings;
            settings.AreDefaultContextMenusEnabled = false;
            settings.AreDevToolsEnabled = false;
            settings.AreBrowserAcceleratorKeysEnabled = true;
            settings.IsStatusBarEnabled = false;

            webView.CoreWebView2.NewWindowRequested += (_, e) => e.Handled = true;
            webView.CoreWebView2.NavigationStarting += (_, e) =>
            {
                if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri) ||
                    !string.Equals(uri.Host, "dominiksolorz.github.io", StringComparison.OrdinalIgnoreCase))
                {
                    e.Cancel = true;
                }
            };
            webView.CoreWebView2.Navigate(PanelUrl);
        }
    }
}

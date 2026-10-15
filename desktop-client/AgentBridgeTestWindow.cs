using System.Text.Json;
using HomeSecurity.Agent.Contracts;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace HomeSecurityDesktop;

internal sealed class AgentBridgeTestWindow : Form
{
    internal const string DocumentUrl = "https://agent-test.home-security.invalid/index.html";
    private const string DeniedDocumentUrl = "https://agent-test.home-security.invalid/untrusted.html";
    private readonly WebView2 view = new() { Dock = DockStyle.Fill };
    private readonly string directory;
    private readonly bool automatic, unavailable;
    private readonly bool deniedSource, navigatePending;
    private readonly string? priorId;
    private AgentWebViewBridge? bridge;
    internal AgentBridgeTestWindow(string[] args)
    {
        if (!Path.IsPathFullyQualified(args[1])) throw new ArgumentException("Absolute test directory required.");
        directory = Path.GetFullPath(args[1]); Directory.CreateDirectory(directory);
        automatic = args.Contains("--auto"); unavailable = args.Contains("--expect-unavailable");
        deniedSource = args.Contains("--denied-source"); navigatePending = args.Contains("--navigate-pending");
        var index = Array.IndexOf(args, "--prior-id");
        if (index >= 0 && index + 1 < args.Length && Guid.TryParse(args[index + 1], out var id)) priorId = id.ToString();
        Text = "HOME SECURITY — izolowany test mostka (bez kamery)";
        ClientSize = new Size(1050, 760); Controls.Add(view);
        Shown += async (_, _) => {
            try { await InitializeAsync(); }
            catch (Exception error) { Save(new { passed = false, code = "HARNESS_INIT_FAILED", error = error.GetType().Name }); if (automatic) Close(); }
        };
        FormClosed += (_, _) => bridge?.Dispose();
    }
    private async Task InitializeAsync()
    {
        var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: Path.Combine(directory, "webview-test"));
        await view.EnsureCoreWebView2Async(environment);
        var web = view.CoreWebView2;
        web.Settings.AreDevToolsEnabled = false;
        web.PermissionRequested += (_, args) => args.State = CoreWebView2PermissionState.Deny;
        web.NewWindowRequested += (_, args) => args.Handled = true;
        web.NavigationStarting += (_, args) => { if (args.Uri != DocumentUrl && args.Uri != DeniedDocumentUrl) args.Cancel = true; };
        web.SetVirtualHostNameToFolderMapping("agent-test.home-security.invalid",
            Path.Combine(AppContext.BaseDirectory, "AgentTestAssets"), CoreWebView2HostResourceAccessKind.DenyCors);
        bridge = AgentWebViewBridge.CreateForTest(web, directory, navigatePending);
        var config = JsonSerializer.Serialize(new { automatic, unavailable, priorId, navigatePending }, AgentProtocol.Json);
        await web.AddScriptToExecuteOnDocumentCreatedAsync("window.bridgeTestConfig=" + config + ";");
        web.WebMessageReceived += (_, args) => {
            if ((args.Source != DocumentUrl && args.Source != DeniedDocumentUrl) || web.Source != args.Source) return;
            try {
                using var doc = JsonDocument.Parse(args.WebMessageAsJson);
                if (doc.RootElement.TryGetProperty("type", out var type) && type.GetString() == "bridge-test.report")
                {
                    Save(doc.RootElement.GetProperty("report").Clone());
                    if (automatic) Close();
                }
            } catch (JsonException) { }
        };
        web.Navigate(deniedSource ? DeniedDocumentUrl : DocumentUrl);
    }
    private void Save(object report)
    {
        var output = Path.Combine(directory, "reports"); Directory.CreateDirectory(output);
        File.WriteAllText(Path.Combine(output, DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fffffff") + ".json"),
            JsonSerializer.Serialize(new { at = DateTimeOffset.UtcNow, panelPid = Environment.ProcessId,
                windowsUser = System.Security.Principal.WindowsIdentity.GetCurrent().User?.Value,
                source = view.CoreWebView2?.Source, suppressedReplies = bridge?.SuppressedReplies ?? 0,
                navigationSuppressionPassed = !navigatePending || bridge?.SuppressedReplies > 0, report }, AgentProtocol.Json));
    }
}

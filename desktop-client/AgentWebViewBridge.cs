using System.Text;
using System.Text.Json;
using HomeSecurity.Agent.Client;
using HomeSecurity.Agent.Contracts;
using Microsoft.Web.WebView2.Core;

namespace HomeSecurityDesktop;

internal sealed class AgentWebViewBridge : IDisposable
{
    private readonly CoreWebView2 web;
    private readonly AgentCommandClient client;
    private readonly string? testDocument;
    private int testReplyDelayMs;
    internal int SuppressedReplies { get; private set; }
    private readonly SemaphoreSlim capacity = new(4);
    private readonly CancellationTokenSource lifetime = new();
    private long navigation;
    public AgentWebViewBridge(CoreWebView2 web) : this(web, new AgentCommandClient(), null) { }
    private AgentWebViewBridge(CoreWebView2 web, AgentCommandClient client, string? testDocument)
    {
        this.web = web;
        this.client = client; this.testDocument = testDocument;
        web.NavigationStarting += OnNavigation;
        web.WebMessageReceived += OnMessage;
    }
    // Dostępne tylko z dedykowanego trybu testowego, nie przez wiadomość strony.
    internal static AgentWebViewBridge CreateForTest(CoreWebView2 web, string directory, bool delayReply = false) =>
        new(web, new AgentCommandClient(AgentProtocol.TestPipeName(directory)), AgentBridgeTestWindow.DocumentUrl)
        { testReplyDelayMs = delayReply ? 600 : 0 };
    private bool Allowed(string source) => testDocument is null ? Trusted(source) : source == testDocument;
    internal static bool Trusted(string source) => AgentProtocol.IsTrustedPanel(source);
    private void OnNavigation(object? sender, CoreWebView2NavigationStartingEventArgs args) => navigation++;
    private async void OnMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs args)
    {
        var source = args.Source; var generation = navigation;
        if (!Allowed(source) || source != web.Source || lifetime.IsCancellationRequested) return;
        Guid id = Guid.Empty; var acquired = false;
        try
        {
            var json = args.WebMessageAsJson;
            if (Encoding.UTF8.GetByteCount(json) > AgentProtocol.MaxFrameBytes) return;
            using var doc = JsonDocument.Parse(json, new JsonDocumentOptions { MaxDepth = 8 });
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("type", out var type)
                || type.GetString() != "agent.command") return;
            if (!root.TryGetProperty("id", out var requestId) || !Guid.TryParse(requestId.GetString(), out id) || id == Guid.Empty) return;
            if (!root.TryGetProperty("name", out var name) || name.ValueKind != JsonValueKind.String
                || !root.TryGetProperty("args", out var arguments) || !AgentProtocol.IsAllowed(name.GetString()!, arguments))
            { Reply(new(id, "rejected", "COMMAND_NOT_ALLOWED"), source, generation); return; }
            acquired = await capacity.WaitAsync(0, lifetime.Token);
            if (!acquired) { Reply(new(id, "rejected", "BRIDGE_BUSY"), source, generation); return; }
            var result = await client.ExecuteAsync(name.GetString()!, arguments.Clone(), id, ct: lifetime.Token);
            if (testReplyDelayMs > 0) await Task.Delay(testReplyDelayMs, lifetime.Token);
            Reply(result, source, generation);
        }
        catch (Exception error) when (error is JsonException or InvalidOperationException or OperationCanceledException or ArgumentException)
        { if (id != Guid.Empty) Reply(new(id, "rejected", "INVALID_MESSAGE"), source, generation); }
        finally { if (acquired) capacity.Release(); }
    }
    private void Reply(AgentReply reply, string source, long generation)
    {
        if (lifetime.IsCancellationRequested || generation != navigation || source != web.Source || !Allowed(web.Source))
        { if (testDocument is not null) SuppressedReplies++; return; }
        try { web.PostWebMessageAsJson(JsonSerializer.Serialize(new { type = "agent.result", result = reply }, AgentProtocol.Json)); }
        catch (Exception error) when (error is InvalidOperationException or System.Runtime.InteropServices.COMException) { /* okno jest zamykane */ }
    }
    public void Dispose()
    {
        lifetime.Cancel();
        web.NavigationStarting -= OnNavigation; web.WebMessageReceived -= OnMessage;
        // W toku mogą być await-y; ich finally zwolnią semafor.
    }
}

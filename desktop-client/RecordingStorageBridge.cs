using System.Text.Json;
using HomeSecurity.Agent;
using HomeSecurity.Agent.Contracts;
using Microsoft.Web.WebView2.Core;

namespace HomeSecurityDesktop;

internal sealed class RecordingStorageBridge : IDisposable
{
    private readonly CoreWebView2 web;
    private readonly Func<bool> unlocked;
    private readonly RecordingStorage storage;
    private readonly AgentDatabase database;
    private readonly IntegrationCredentials credentials;
    private readonly string directory;
    private readonly SemaphoreSlim serial = new(1, 1);
    private readonly CancellationTokenSource lifetime = new();
    private long navigation;
    private bool recordingSessionAuthorized;
    private readonly object uploadGate=new();
    private CancellationTokenSource? activeUpload;
    private readonly string? testDocument;
    public RecordingStorageBridge(CoreWebView2 web, Func<bool> unlocked) : this(web,unlocked,null,null) { }
    private RecordingStorageBridge(CoreWebView2 web, Func<bool> unlocked,string? testDirectory,string? testDocument)
    {
        this.web = web; this.unlocked = unlocked;
        this.testDocument=testDocument;
        directory = testDirectory??Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "HomeSecurityAgent");
        storage = new(directory); database = new(directory, recoverInterrupted: false);
        credentials = new(database, Path.Combine(directory, "integration-secrets"));
        web.WebMessageReceived += OnMessage; web.NavigationStarting += OnNavigation;
        if(testDocument is null)_ = Task.Run(RunWorker);
    }
    internal static RecordingStorageBridge CreateForTest(CoreWebView2 web,Func<bool> unlocked,string directory,string document)=>new(web,unlocked,directory,document);
    private bool Trusted(string source)=>testDocument is null?AgentWebViewBridge.Trusted(source):source==testDocument;
    private void OnNavigation(object? sender, CoreWebView2NavigationStartingEventArgs args) { navigation++; recordingSessionAuthorized=false; storage.AbandonTransfers(); }
    private async Task RunWorker()
    {
        using var api = new GoogleDriveApi(credentials, sessionDirectory: Path.Combine(directory, "drive-sessions"));
        var worker = new DriveUploadWorker(new DriveUploadQueue(database), api);
        while (!lifetime.IsCancellationRequested)
        {
            try
            {
                RecordingStoragePolicy policy;CancellationTokenSource iteration;
                lock(uploadGate){policy=storage.Read();iteration=CancellationTokenSource.CreateLinkedTokenSource(lifetime.Token);activeUpload=iteration;}
                try { if (policy.Connected && policy.Mode != "local") await worker.RunOne(iteration.Token,policy.IntegrationId); }
                finally {lock(uploadGate){activeUpload=null;iteration.Dispose();}}
                storage.CleanupConfirmed();
            }
            catch(OperationCanceledException) when(!lifetime.IsCancellationRequested){/* Owner paused uploads; keep the durable job for reconciliation. */}
            catch(OperationCanceledException){return;}
            catch (Exception error) when (error is IOException or UnauthorizedAccessException or HttpRequestException or DriveFailure or JsonException or Microsoft.Data.Sqlite.SqliteException) { /* Keep files and retry. */ }
            try { await Task.Delay(5000, lifetime.Token); } catch (OperationCanceledException) { return; }
        }
    }
    private async void OnMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs args)
    {
        var source = args.Source; var generation = navigation;
        if (source != web.Source || !Trusted(source) || lifetime.IsCancellationRequested) return;
        string? id = null; bool acquired = false;
        try
        {
            var raw = args.WebMessageAsJson;
            if (raw.Length > 1500000) return;
            using var json = JsonDocument.Parse(raw, new JsonDocumentOptions { MaxDepth = 5 });
            var root = json.RootElement;
            if (root.GetProperty("type").GetString() != "storage.command") return;
            id = root.GetProperty("id").GetString();
            if (!Guid.TryParse(id, out _)) return;
            var name = root.GetProperty("name").GetString();
            if(unlocked())recordingSessionAuthorized=true;
            // Locking the UI must not interrupt the already authorized recorder. Configuration still requires unlock.
            if(!unlocked()&&(!recordingSessionAuthorized||name is not ("snapshot" or "begin" or "chunk" or "complete" or "abort")))return;
            acquired = await serial.WaitAsync(0, lifetime.Token);
            if (!acquired) throw new IOException("STORAGE_BUSY");
            var value = root.GetProperty("args");
            object result;
            switch (name)
            {
                case "snapshot": result = storage.Snapshot(); break;
                case "set":
                    var mode = value.GetProperty("mode").GetString()!;
                    if (mode is not ("local" or "cloud" or "both")) throw new ArgumentException("INVALID_STORAGE_MODE");
                    var old = storage.Read();
                    if (mode != "local")
                    {
                        if (!old.Connected) throw new IOException("CONNECT_DRIVE_FIRST");
                        using var api = new GoogleDriveApi(credentials); await api.ValidateFolder(old.IntegrationId, old.FolderId!, lifetime.Token);
                    }
                    EnsureCurrent(source, generation); StopLegacyScanner();lock(uploadGate){storage.Write(old with { Mode = mode });if(mode=="local")activeUpload?.Cancel();} result = storage.Snapshot(); break;
                case "disconnect":
                    StopLegacyScanner();lock(uploadGate){storage.Write(storage.Read() with { Mode = "local", Connected = false });activeUpload?.Cancel();} result = storage.Snapshot(); break;
                case "connect":
                case "authorize":
                    var folder = GoogleDriveApi.ValidateId(value.GetProperty("folderId").GetString()!);
                    var previous = storage.Read();
                    var integration = name=="authorize"||previous.IntegrationId == Guid.Empty ? Guid.NewGuid() : previous.IntegrationId;
                    if (name == "authorize")
                    {
                        using var dialog = new OpenFileDialog { Title = "Konfiguracja Google OAuth aplikacji — plik JSON", Filter = "Google OAuth (*.json)|*.json", CheckFileExists = true };
                        if (dialog.ShowDialog() != DialogResult.OK) throw new IOException("AUTHORIZATION_CANCELLED");
                        await GoogleDriveAuthorization.Authorize(dialog.FileName, integration, credentials, lifetime.Token, pickFolder: folder);
                    }
                    using (var api = new GoogleDriveApi(credentials)) await api.ValidateFolder(integration, folder, lifetime.Token);
                    EnsureCurrent(source, generation);
                    StopLegacyScanner(); storage.Write(previous with { Connected = true, IntegrationId = integration, FolderId = folder });
                    result = storage.Snapshot(); break;
                case "begin":
                    result = new { transfer = storage.Begin(value.GetProperty("name").GetString()!, value.GetProperty("size").GetInt64(), value.GetProperty("revision").GetInt64()) }; break;
                case "chunk":
                    result = new { offset = storage.Append(value.GetProperty("transfer").GetGuid(), value.GetProperty("offset").GetInt64(), Convert.FromBase64String(value.GetProperty("data").GetString()!)) }; break;
                case "complete": var transferId=value.GetProperty("transfer").GetGuid(); result = await Task.Run(()=>storage.Complete(transferId),lifetime.Token); break;
                case "abort": storage.Abort(value.GetProperty("transfer").GetGuid());result=new{preserved=true};break;
                default: throw new ArgumentException("STORAGE_COMMAND_NOT_ALLOWED");
            }
            Reply(id, result, null, source, generation);
        }
        catch (OperationCanceledException) { if (id is not null) Reply(id, null, "STORAGE_CANCELLED", source, generation); }
        catch (Exception error) when (error is JsonException or KeyNotFoundException or InvalidOperationException or ArgumentException or IOException or UnauthorizedAccessException or DriveFailure or HttpRequestException or Microsoft.Data.Sqlite.SqliteException)
        { if (id is not null) Reply(id, null, error is DriveFailure drive ? drive.Code : "STORAGE_OPERATION_FAILED", source, generation); }
        finally { if (acquired) serial.Release(); }
    }
    private void EnsureCurrent(string source, long generation)
    { if (!unlocked() || generation != navigation || source != web.Source) throw new IOException("PANEL_LOCKED_OR_CHANGED"); }
    private void StopLegacyScanner()
    {
        if(testDocument is not null)return;
        // Migrate only this user's old helper. Its upload leases reconcile after interruption; source files are untouched.
        var legacyRoot=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs","Home Security","DriveSync")+Path.DirectorySeparatorChar;
        foreach(var process in System.Diagnostics.Process.GetProcessesByName("HomeSecurityDriveSync"))
        {
            using(process)
            {
                try
                {
                    if(process.SessionId!=System.Diagnostics.Process.GetCurrentProcess().SessionId)continue;
                    var path=process.MainModule?.FileName;
                    if(path is not null&&Path.GetFullPath(path).StartsWith(legacyRoot,StringComparison.OrdinalIgnoreCase))
                    {process.Kill();if(!process.WaitForExit(5000))throw new IOException("LEGACY_SYNC_STILL_ACTIVE");}
                }
                catch(System.ComponentModel.Win32Exception){throw new IOException("LEGACY_SYNC_MIGRATION_FAILED");}
                catch(InvalidOperationException){/* It exited before inspection. */}
            }
        }
    }
    private void Reply(string id, object? result, string? error, string source, long generation)
    {
        if ((!unlocked()&&!recordingSessionAuthorized) || generation != navigation || source != web.Source || lifetime.IsCancellationRequested) return;
        try { web.PostWebMessageAsJson(JsonSerializer.Serialize(new { type = "storage.result", id, result, error }, AgentProtocol.Json)); }
        catch (InvalidOperationException) { }
    }
    public void Dispose()
    { lifetime.Cancel(); web.WebMessageReceived -= OnMessage; web.NavigationStarting -= OnNavigation; }
}

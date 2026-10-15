using System.Buffers.Binary;
using System.IO.Pipes;
using System.Security.Cryptography;
using HomeSecurity.Agent;
using HomeSecurity.Agent.Client;
using HomeSecurity.Agent.Contracts;

var count = 0;
void Check(bool condition, string name) { if (!condition) throw new Exception("FAIL: " + name); Console.WriteLine("PASS: " + name); count++; }
var directory = Path.Combine(Path.GetTempPath(), "HomeSecurityAgent-tests-" + Guid.NewGuid().ToString("N"));
var pipeName = "HomeSecurityAgent.tests." + Guid.NewGuid().ToString("N");
PrivateDirectory.Create(directory);
var database = new AgentDatabase(directory);
var dispatcher = new AgentDispatcher(database);
using var stopping = new CancellationTokenSource();
var server = new PipeServer(dispatcher, pipeName).RunAsync(stopping.Token);
try
{
    var client = new AgentCommandClient(pipeName);
    var empty = AgentProtocol.Element(new { });
    var id = Guid.NewGuid();
    var ping = await client.ExecuteAsync("agent.ping", empty, id);
    Check(ping.Status == "succeeded", "real Named Pipe ping");
    Check((await client.ExecuteAsync("agent.ping", empty, id)).Status == "succeeded", "durable deduplication");
    Check((await client.ExecuteAsync("system.snapshot", empty, id)).Code == "ID_CONFLICT", "conflicting ID rejected");
    Check((await client.ExecuteAsync("secret.read", AgentProtocol.Element(new { id = "drive" }))).Status == "rejected", "secret commands not exposed");
    Check((await client.ExecuteAsync("system.snapshot", AgentProtocol.Element(new { sql = "DROP TABLE commands" }))).Status == "rejected", "unexpected args rejected");
    var status = await client.ExecuteAsync("command.status", AgentProtocol.Element(new { id }));
    Check(status.Result?.GetProperty("status").GetString() == "succeeded", "lookup terminal result by ID");
    // Nowy klient po zamknięciu poprzedniego połączenia nadal widzi agenta.
    Check((await new AgentCommandClient(pipeName).ExecuteAsync("system.snapshot", empty)).Status == "succeeded", "client disconnect does not stop agent");
    var expired = await dispatcher.ExecuteAsync(new(1, Guid.NewGuid(), "agent.ping", empty, DateTimeOffset.UtcNow.AddSeconds(-1)), CancellationToken.None);
    Check(expired.Status == "rejected", "expired command rejected");

    using (var malformed = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly))
    {
        await malformed.ConnectAsync(2000);
        var header = new byte[4]; BinaryPrimitives.WriteInt32LittleEndian(header, AgentProtocol.MaxFrameBytes + 1);
        await malformed.WriteAsync(header); await malformed.FlushAsync();
    }
    Check((await client.ExecuteAsync("agent.ping", empty)).Status == "succeeded", "oversized frame does not stop listener");

    var secrets = new SecretStore(Path.Combine(directory, "secrets"));
    var original = RandomNumberGenerator.GetBytes(32);
    secrets.Save("drive-test", original); var restored = secrets.Read("drive-test")!;
    Check(CryptographicOperations.FixedTimeEquals(original, restored), "DPAPI round trip");
    Check(!File.ReadAllBytes(Path.Combine(directory, "secrets", "drive-test.dpapi")).AsSpan().SequenceEqual(original), "plaintext not stored");
    var denied = false; try { secrets.Read("../escape"); } catch (ArgumentException) { denied = true; }
    Check(denied, "secret path traversal rejected");
    CryptographicOperations.ZeroMemory(original); CryptographicOperations.ZeroMemory(restored);

    Check(AgentProtocol.IsTrustedPanel("https://dominiksolorz.github.io/kamera/?ui=computer"), "official panel allowed");
    Check(!AgentProtocol.IsTrustedPanel("https://dominiksolorz.github.io/other/") &&
        !AgentProtocol.IsTrustedPanel("http://dominiksolorz.github.io/kamera/") &&
        !AgentProtocol.IsTrustedPanel("https://dominiksolorz.github.io.evil.test/kamera/") &&
        !AgentProtocol.IsTrustedPanel("https://dominiksolorz.github.io:444/kamera/"), "wrong origin/path/port rejected");

    await stopping.CancelAsync(); await server;
    var restarted = new AgentDatabase(directory);
    Check(restarted.Find(id)?.Reply.Status == "succeeded", "result survives database reopen");
    var pendingId = Guid.NewGuid();
    restarted.Begin(new(1, pendingId, "agent.ping", empty, DateTimeOffset.UtcNow.AddSeconds(5)), "test-fingerprint");
    var recovered = new AgentDatabase(directory);
    Check(recovered.Find(pendingId)?.Reply.Status == "unknown", "unfinished command is unknown after restart, never auto-reexecuted");
    Check((await new AgentCommandClient(pipeName + ".absent").ExecuteAsync("agent.ping", empty, timeout: TimeSpan.FromMilliseconds(100))).Status == "unknown", "missing agent yields unknown");
    await JobTests.RunAsync(Check, Path.Combine(directory, "jobs"));
    CredentialTests.Run(Check, Path.Combine(directory, "credentials"));
    if (args.Length == 2 && args[0] == "--process-crash") await ProcessCrashTests.RunAsync(Check, Path.GetFullPath(args[1]));
    Console.WriteLine($"ALL {count} TESTS PASSED");
}
finally
{
    await stopping.CancelAsync(); await server;
    // Test data retained for inspection, with no production credentials or recordings.
    Console.WriteLine("Isolated test directory: " + directory);
}

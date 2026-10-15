using HomeSecurity.Agent;

if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("Windows only.");
// Explicit isolated process-test entry point; never reachable through IPC or the panel.
if (args.FirstOrDefault() == "--crash-harness") {
    await CrashTestHost.RunAsync(args); return;
}
var directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "HomeSecurityAgent");
string? testPipe = null;
if (args.Length != 0)
{
    if (args.Length != 2 || args[0] is not ("--bridge-test" or "--synthetic-test") || !Path.IsPathFullyQualified(args[1]))
        throw new ArgumentException("Expected --bridge-test <absolute isolated directory>.");
    directory = Path.GetFullPath(args[1]);
    testPipe = HomeSecurity.Agent.Contracts.AgentProtocol.TestPipeName(directory);
}
PrivateDirectory.Create(directory);
// Blokada nie jest związana z oknem UI; drugi agent nie przejmuje zasobów pierwszego.
using var instance = new FileStream(Path.Combine(directory, "agent.lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
var database = new AgentDatabase(directory);
_ = new IntegrationCredentials(database, Path.Combine(directory, "integration-secrets"));
using var stop = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; stop.Cancel(); };
Console.WriteLine("HomeSecurityAgent: ready; media engine not implemented.");
var maintenance = Task.Run(async () => {
    while (!stop.IsCancellationRequested) {
        database.RetainJournal(DateTimeOffset.UtcNow, TimeSpan.FromDays(30));
        try { await Task.Delay(TimeSpan.FromHours(1), stop.Token); } catch (OperationCanceledException) { break; }
    }
});
var worker = args.FirstOrDefault() == "--synthetic-test"
    ? new SyntheticFileWorker(new SyntheticJobs(database), directory) : null;
var work = Task.Run(async () => {
    while (worker is not null && !stop.IsCancellationRequested) {
        try { await worker.RunOneAsync(DateTimeOffset.UtcNow, stop.Token); await Task.Delay(250, stop.Token); }
        catch (OperationCanceledException) { break; }
    }
});
try { await new PipeServer(new AgentDispatcher(database), testPipe).RunAsync(stop.Token); }
finally { await stop.CancelAsync(); await Task.WhenAll(maintenance, work); }

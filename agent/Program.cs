using HomeSecurity.Agent;

if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("Windows only.");
var directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "HomeSecurityAgent");
string? testPipe = null;
if (args.Length != 0)
{
    if (args.Length != 2 || args[0] != "--bridge-test" || !Path.IsPathFullyQualified(args[1]))
        throw new ArgumentException("Expected --bridge-test <absolute isolated directory>.");
    directory = Path.GetFullPath(args[1]);
    testPipe = HomeSecurity.Agent.Contracts.AgentProtocol.TestPipeName(directory);
}
PrivateDirectory.Create(directory);
// Blokada nie jest związana z oknem UI; drugi agent nie przejmuje zasobów pierwszego.
using var instance = new FileStream(Path.Combine(directory, "agent.lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
var database = new AgentDatabase(directory);
_ = new SecretStore(Path.Combine(directory, "secrets"));
using var stop = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; stop.Cancel(); };
Console.WriteLine("HomeSecurityAgent: ready; media engine not implemented.");
await new PipeServer(new AgentDispatcher(database), testPipe).RunAsync(stop.Token);

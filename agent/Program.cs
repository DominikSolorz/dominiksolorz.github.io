using HomeSecurity.Agent;

if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("Windows only.");
var directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "HomeSecurityAgent");
PrivateDirectory.Create(directory);
// Blokada nie jest związana z oknem UI; drugi agent nie przejmuje zasobów pierwszego.
using var instance = new FileStream(Path.Combine(directory, "agent.lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
var database = new AgentDatabase(directory);
_ = new SecretStore(Path.Combine(directory, "secrets"));
using var stop = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; stop.Cancel(); };
Console.WriteLine("HomeSecurityAgent: ready; media engine not implemented.");
await new PipeServer(new AgentDispatcher(database)).RunAsync(stop.Token);

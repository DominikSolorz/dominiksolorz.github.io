using System.Diagnostics;
using HomeSecurity.Agent.Client;
using HomeSecurity.Agent.Contracts;

namespace HomeSecurityDesktop;

// Owns the health loop, not the agent lifetime. Closing the panel never kills it.
internal sealed class AgentRuntime : IDisposable
{
    private readonly AgentCommandClient client = new();
    private readonly SemaphoreSlim startup = new(1, 1);
    private readonly CancellationTokenSource lifetime = new();
    private Process? startedProcess;
    private Task? monitor;
    internal async Task<bool> EnsureStartedAsync(CancellationToken ct = default)
    {
        await startup.WaitAsync(ct);
        try
        {
            var ping = await client.ExecuteAsync("agent.ping", AgentProtocol.Element(new { }), timeout: TimeSpan.FromSeconds(1), ct: ct);
            if (ping.Status == "succeeded") return true;
            var version = typeof(AgentRuntime).Assembly.GetName().Version!.ToString(3);
            // Updates write a new versioned directory instead of overwriting a
            // running agent executable. Compatible existing agents are reused.
            var executable = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "Agent", version, "HomeSecurityAgent.exe"));
            if (!File.Exists(executable)) return false;
            if (startedProcess is null || startedProcess.HasExited)
            {
                startedProcess?.Dispose();
                startedProcess = Process.Start(new ProcessStartInfo(executable)
                {
                    UseShellExecute = false, CreateNoWindow = true,
                    WorkingDirectory = Path.GetDirectoryName(executable)!, WindowStyle = ProcessWindowStyle.Hidden
                });
            }
            for (var attempt = 0; attempt < 6; attempt++)
            {
                await Task.Delay(400, ct);
                ping = await client.ExecuteAsync("agent.ping", AgentProtocol.Element(new { }), timeout: TimeSpan.FromSeconds(1), ct: ct);
                if (ping.Status == "succeeded") return true;
            }
            return false;
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException or System.ComponentModel.Win32Exception or InvalidOperationException)
        { return false; }
        finally { startup.Release(); }
    }
    internal void StartMonitoring()
    {
        monitor ??= Task.Run(async () =>
        {
            try
            {
                while (!lifetime.IsCancellationRequested)
                {
                    await EnsureStartedAsync(lifetime.Token);
                    await Task.Delay(TimeSpan.FromMinutes(2), lifetime.Token);
                }
            }
            catch (OperationCanceledException) { }
        });
    }
    public void Dispose()
    {
        lifetime.Cancel();
        // Do not kill a worker when its client closes. Its own file lock protects
        // against a second panel starting a competing database owner.
    }
}

using System.IO.Pipes;
using System.Security.AccessControl;
using System.Security.Principal;
using HomeSecurity.Agent.Contracts;

namespace HomeSecurity.Agent;

public sealed class PipeServer(AgentDispatcher dispatcher, string? pipeName = null)
{
    public async Task RunAsync(CancellationToken stopping)
    {
        using var slots = new SemaphoreSlim(8); var clients = new List<Task>();
        try
        {
            while (!stopping.IsCancellationRequested)
            {
                await slots.WaitAsync(stopping);
                NamedPipeServerStream? pipe = null;
                try
                {
                    var security = new PipeSecurity();
                    var user = WindowsIdentity.GetCurrent().User!;
                    security.SetAccessRuleProtection(true, false); security.SetOwner(user);
                    security.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.NetworkSid, null), PipeAccessRights.FullControl, AccessControlType.Deny));
                    security.AddAccessRule(new PipeAccessRule(user, PipeAccessRights.FullControl, AccessControlType.Allow));
                    pipe = NamedPipeServerStreamAcl.Create(pipeName ?? AgentProtocol.PipeName, PipeDirection.InOut, 8,
                        PipeTransmissionMode.Byte, PipeOptions.Asynchronous, 0, 0, security);
                    await pipe.WaitForConnectionAsync(stopping);
                    var connected = pipe; pipe = null;
                    clients.RemoveAll(task => task.IsCompleted);
                    clients.Add(ServeAsync(connected, slots, stopping));
                }
                catch { pipe?.Dispose(); slots.Release(); throw; }
            }
        }
        catch (OperationCanceledException) when (stopping.IsCancellationRequested) { }
        finally { await Task.WhenAll(clients); }
    }
    private async Task ServeAsync(NamedPipeServerStream pipe, SemaphoreSlim slots, CancellationToken stopping)
    {
        using (pipe)
        using (var deadline = CancellationTokenSource.CreateLinkedTokenSource(stopping))
        {
            deadline.CancelAfter(TimeSpan.FromSeconds(10));
            try
            {
                var request = await AgentProtocol.ReadAsync<AgentCommand>(pipe, deadline.Token);
                var reply = await dispatcher.ExecuteAsync(request, deadline.Token);
                await AgentProtocol.WriteAsync(pipe, reply, deadline.Token);
            }
            catch (Exception error) when (error is IOException or InvalidDataException or System.Text.Json.JsonException or OperationCanceledException or UnauthorizedAccessException or Microsoft.Data.Sqlite.SqliteException)
            { /* nie zapisujemy treści żądań ani poświadczeń do logu */ }
            finally { slots.Release(); }
        }
    }
}

using System.IO.Pipes;
using System.Security.Principal;
using System.Text.Json;
using HomeSecurity.Agent.Contracts;

namespace HomeSecurity.Agent.Client;

public sealed class AgentCommandClient(string? pipeName = null)
{
    // .NET 10 CurrentUserOnly compares the token OWNER (which can be the
    // Administrators group), not the actual user SID. Validate the pipe owner
    // explicitly against User before writing any command. Server DACL remains
    // restricted to that same user, with network clients explicitly denied.
    internal static bool IsExpectedOwner(IdentityReference? owner, SecurityIdentifier currentUser) => owner?.Equals(currentUser) == true;
    // Brak automatycznych ponowień: po przerwaniu odczytu wykonanie jest nieznane.
    public async Task<AgentReply> ExecuteAsync(string name, JsonElement args, Guid? id = null,
        TimeSpan? timeout = null, CancellationToken ct = default)
    {
        var commandId = id ?? Guid.NewGuid();
        var budget = timeout ?? TimeSpan.FromSeconds(5);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct);
        linked.CancelAfter(budget);
        try
        {
            using var pipe = new NamedPipeClientStream(".", pipeName ?? AgentProtocol.PipeName,
                PipeDirection.InOut, PipeOptions.Asynchronous);
            await pipe.ConnectAsync(linked.Token);
            using var identity = WindowsIdentity.GetCurrent();
            if (identity.User is null || !IsExpectedOwner(pipe.GetAccessControl().GetOwner(typeof(SecurityIdentifier)), identity.User))
                return new(commandId, "rejected", "PIPE_ACCESS_DENIED");
            await AgentProtocol.WriteAsync(pipe, new AgentCommand(1, commandId, name, args,
                DateTimeOffset.UtcNow.Add(budget)), linked.Token);
            var reply = await AgentProtocol.ReadAsync<AgentReply>(pipe, linked.Token);
            if (reply.Id != commandId) return new(commandId, "unknown", "REPLY_ID_MISMATCH");
            if (reply.Status is not ("succeeded" or "rejected" or "failed" or "unknown"))
                return new(commandId, "unknown", "INVALID_REPLY");
            return reply;
        }
        catch (OperationCanceledException) { return new(commandId, "unknown", "TIMEOUT_OR_CANCELLED"); }
        catch (IOException) { return new(commandId, "unknown", "PIPE_UNAVAILABLE"); }
        catch (InvalidDataException) { return new(commandId, "unknown", "INVALID_REPLY"); }
        catch (UnauthorizedAccessException) { return new(commandId, "rejected", "PIPE_ACCESS_DENIED"); }
        catch (JsonException) { return new(commandId, "unknown", "INVALID_REPLY"); }
    }
}
